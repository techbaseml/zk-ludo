import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomBytes,randomInt} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {newGame,roll,move,colors,defaults} from '../src/engine.ts';

const root=fileURLToPath(new URL('../dist/',import.meta.url));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const expiry=6*3600000;
function check(condition,message){if(!condition)throw Error(message)}
function seat(name){check(typeof name==='string'&&name.trim().length>0&&name.trim().length<=28,'Enter a name (1–28 characters).');return {name:name.trim(),key:randomBytes(32).toString('hex'),ready:false,vote:false,seen:Date.now()}}
function launch(r){r.game=newGame(r.seats.map((p,i)=>({name:p.name,color:colors[(r.size===2?i*2:i)]})),r.rules);r.seats.forEach(s=>s.vote=false)}
export function createServer({database=':memory:'}={}){
 if(database!==':memory:')mkdirSync(dirname(database),{recursive:true,mode:0o700});
 const db=new DatabaseSync(database);
 db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, snapshot TEXT NOT NULL, updated INTEGER NOT NULL)');
 const upsert=db.prepare('INSERT OR REPLACE INTO rooms VALUES(?,?,?)'),remove=db.prepare('DELETE FROM rooms WHERE code=?');
 db.prepare('DELETE FROM rooms WHERE updated < ?').run(Date.now()-expiry);
 const rooms=new Map(db.prepare('SELECT * FROM rooms').all().map(row=>[row.code,JSON.parse(row.snapshot)])),limits=new Map(),subscriptions=new Map();
 function notify(code){for(const done of subscriptions.get(code)||[])done();subscriptions.delete(code)}
 function changed(code,res){return new Promise(resolve=>{
 const set=subscriptions.get(code)||new Set();subscriptions.set(code,set);
 const done=()=>{clearTimeout(timeout);set.delete(done);res.off('close',done);if(!set.size)subscriptions.delete(code);resolve()};
 const timeout=setTimeout(done,7000);set.add(done);res.once('close',done);
 })}
 
 const sweep=setInterval(()=>{const now=Date.now();for(const [code,r] of rooms)if(now-r.updated>expiry){rooms.delete(code);remove.run(code);notify(code)};for(const [key,v] of limits)if(v.until<now)limits.delete(key)},60000).unref();
 const server=http.createServer(async(req,res)=>{
 try{
 const path=new URL(req.url,'http://local').pathname;
 if(!path.startsWith('/api/')){
 check(req.method==='GET','GET required');const file=resolve(root,'.'+(path==='/'?'/index.html':path));check(file.startsWith(resolve(root)+sep),'Invalid path');let body;try{body=await readFile(file)}catch{res.writeHead(404);return res.end()}res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');return res.end(body)}
 const origin=req.headers.origin,allowed=process.env.FRONTEND_ORIGIN;
 if(origin){check(allowed?origin===allowed:new URL(origin).host===req.headers.host,'Origin denied');res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin')}
 if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'POST, OPTIONS'});return res.end()}
 check(req.method==='POST','POST required');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
 const ip=req.socket.remoteAddress;let lim=limits.get(ip);if(!lim||lim.until<Date.now()){lim={count:0,until:Date.now()+60000};limits.set(ip,lim)}check(++lim.count<1200,'Please slow down.');
 let raw='';for await(const chunk of req){raw+=chunk;check(raw.length<=4096,'Request too large')}const b=JSON.parse(raw||'{}');const action=path.slice(5);
 let r=rooms.get(b.code),member,key;
 if(action==='create'){lim.created=(lim.created||0)+1;check(lim.created<=20,'Room creation limit reached.');check(rooms.size<1500,'Room limit reached');check([2,3,4].includes(b.size),'Choose 2–4 seats');let code;do{code=randomBytes(5).toString('hex').toUpperCase()}while(rooms.has(code));member=seat(b.name);key=member.key;
 const rules={...defaults};for(const name of Object.keys(rules))if(typeof b.rules?.[name]==='boolean')rules[name]=b.rules[name];
 r={code,size:b.size,rules,rev:0,seats:[member],game:null,updated:Date.now()};rooms.set(code,r)
 }else{check(r,'Room unavailable or expired.');
 if(action==='join'){check(!r.game&&r.seats.length<r.size,'Room is full or in play.');member=seat(b.name);r.seats.push(member);key=member.key}
 else{member=r.seats.find(s=>req.headers.authorization==='Bearer '+s.key);check(member&&!member.left,'Session unavailable.');member.seen=Date.now();const i=r.seats.indexOf(member);
 if(action==='state'&&b.wait===true&&b.rev===r.rev){await changed(r.code,res);check(rooms.has(r.code),'Room unavailable or expired.')}
 if(action!=='state'){check(b.rev===r.rev,'Board changed. Try again.');const g=r.game;
 switch(action){
 case 'ready':check(!g,'Match started');member.ready=!member.ready;break;
 case 'start':check(!g&&i===0&&r.seats.length===r.size&&r.seats.every(s=>s.ready&&Date.now()-s.seen<15000),'All seats must be ready and connected.');launch(r);break;
 case 'roll':case 'move':check(g&&g.turn===i,'Wait for your turn.');if(action==='roll')roll(g,randomInt(1,7));else move(g,b.token);break;
 case 'resign':check(g&&g.phase!=='over','No active match');g.phase='over';g.end=Date.now();g.winner=r.size===2?1-i:-1;g.note=member.name+' resigned.';break;
 case 'rematch':check(g?.phase==='over'&&!r.seats.some(s=>s.left),'All players must remain for a rematch.');member.vote=true;if(r.seats.every(s=>s.vote))launch(r);break;
 case 'leave':check(!g||g.phase==='over','Resign before leaving.');if(g){member.left=true;member.vote=false;member.seen=0;if(r.seats.every(s=>s.left))rooms.delete(r.code)}else r.seats.splice(i,1);if(!r.seats.length)rooms.delete(r.code);break;
 default:throw Error('Unknown action');}}}}
 r.updated=Date.now();
 if(action!=='state'){r.rev++;if(rooms.has(r.code))upsert.run(r.code,JSON.stringify(r),r.updated);else remove.run(r.code);notify(r.code)}
 res.end(JSON.stringify({code:r.code,size:r.size,rules:r.rules,rev:r.rev,you:r.seats.indexOf(member),key,seats:r.seats.map(s=>({name:s.name,ready:s.ready,vote:s.vote,left:!!s.left,connected:Date.now()-s.seen<15000})),game:r.game}));
 }catch(e){if(!res.headersSent)res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}))}});
 server.on('close',()=>{clearInterval(sweep);db.close()});return server
}
if(process.argv[1]===fileURLToPath(import.meta.url))createServer({database:process.env.ROOM_DB||'data/rooms.sqlite'}).listen(Number(process.env.PORT||4173),process.env.HOST||'0.0.0.0',()=>console.log('ZK LUDO listening on port '+(process.env.PORT||4173)));
