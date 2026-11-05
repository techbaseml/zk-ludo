import postgres from 'npm:postgres@3.4.7';
import {newGame, move, roll, defaults, colors} from '../../../src/engine.ts';
const db=postgres(Deno.env.get('SUPABASE_DB_URL')!,{prepare:false,max:1,idle_timeout:10});
const headers={'Access-Control-Allow-Origin':'https://techbaseml.github.io','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Cache-Control':'no-store'};
function requireThat(condition:unknown,message:string){if(!condition)throw new InputError(message)}
class InputError extends Error {}
function hex(n:number){return Array.from(crypto.getRandomValues(new Uint8Array(n)),b=>b.toString(16).padStart(2,'0')).join('')}
function newSeat(name:unknown){
 requireThat(typeof name==='string'&&name.trim().length>0&&name.trim().length<=28,'Enter a name (1–28 characters).');
 return {name:(name as string).trim(),key:hex(32),ready:false,vote:false,left:false,seen:Date.now()};
}
function launch(r:any){r.game=newGame(r.seats.map((s:any,i:number)=>({name:s.name,color:colors[r.size===2?i*2:i]})),r.rules);r.seats.forEach((s:any)=>s.vote=false)}
function snapshot(r:any,i:number,key?:string){return {code:r.code,size:r.size,rev:r.rev,rules:r.rules,you:i,key,game:r.game,seats:r.seats.map((s:any)=>({name:s.name,ready:s.ready,vote:s.vote,left:s.left,connected:!s.left&&Date.now()-s.seen<20000}))}}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 try{
 const origin=req.headers.get('origin');requireThat(!origin||origin===headers['Access-Control-Allow-Origin'],'Origin denied.');
 requireThat(req.method==='POST','POST required.');
 const raw=await req.text();requireThat(raw.length<=4096,'Request too large.');
 const body=JSON.parse(raw),action=new URL(req.url).pathname.split('/').pop();
 const result=await db.begin(async tx=>{
 if(action==='create'){
 requireThat([2,3,4].includes(body.size),'Choose 2–4 seats.');
 await tx`select pg_advisory_xact_lock(73490216)`;
 await tx`delete from zk_ludo.rooms where touched<now()-interval '6 hours'`;
 const [quota]=await tx`select count(*)::int as total from zk_ludo.rooms`;requireThat(quota.total<500,'Room limit reached.');
 const seat=newSeat(body.name),code=hex(5).toUpperCase(),rules={...defaults};
 for(const k of Object.keys(rules))if(typeof body.rules?.[k]==='boolean')rules[k]=body.rules[k];
 const room={code,rev:1,size:body.size,rules,seats:[seat],game:null};
 await tx`insert into zk_ludo.rooms(code,snapshot) values (${code},${tx.json(room)})`;return snapshot(room,0,seat.key);
 }
 requireThat(typeof body.code==='string'&&/^[0-9A-F]{10}$/.test(body.code),'Enter a valid room code.');
 const [row]=await tx`select snapshot from zk_ludo.rooms where code=${body.code} and touched>now()-interval '6 hours' for update`;
 requireThat(row,'Room unavailable or expired.');
 const r=row.snapshot;let key,i,remove=false;const g=r.game;
 if(action==='join'){requireThat(!g&&r.seats.length<r.size,'Room full or already started.');const s=newSeat(body.name);i=r.seats.push(s)-1;key=s.key}
 else{
 i=r.seats.findIndex((s:any)=>!s.left&&req.headers.get('authorization')==='Bearer '+s.key);
 requireThat(i>=0,'Session unavailable.');const s=r.seats[i];
 if(action==='state'&&Date.now()-s.seen<6000)return snapshot(r,i);
 s.seen=Date.now();
 if(action!=='state')requireThat(body.rev===r.rev,'Board changed. Try again.');
 switch(action){
 case 'state':break;
 case 'ready':requireThat(!g,'Match started.');s.ready=!s.ready;break;
 case 'start':requireThat(!g&&i===0&&r.seats.length===r.size&&r.seats.every((s:any)=>s.ready&&Date.now()-s.seen<20000),'All players must be ready.');launch(r);break;
 case 'roll':case 'move':requireThat(g&&g.turn===i,'Wait for your turn.');
 requireThat(action==='roll'?g.phase==='roll':g.phase==='move','Wait for the next action.');
 if(action==='roll')roll(g);else move(g,body.token);break;
 case 'resign':requireThat(g&&g.phase!=='over','No active match.');g.phase='over';g.end=Date.now();g.winner=r.size===2?1-i:-1;g.note=s.name+' resigned.';break;
 case 'rematch':requireThat(g?.phase==='over'&&!r.seats.some((s:any)=>s.left),'All players must remain for a rematch.');s.vote=true;if(r.seats.every((s:any)=>s.vote))launch(r);break;
 case 'leave':requireThat(!g||g.phase==='over','Resign before leaving.');if(g){s.left=true;s.vote=false}else r.seats.splice(i,1);remove=r.seats.every((s:any)=>s.left);break;
 default:throw new InputError('Unknown action.');
 }}
 if(action!=='state')r.rev++;
 if(remove)await tx`delete from zk_ludo.rooms where code=${r.code}`;else await tx`update zk_ludo.rooms set snapshot=${tx.json(r)}, touched=now() where code=${r.code}`;
 return snapshot(r,i,key);
 });
 return Response.json(result,{headers})
 }catch(e){const expected=e instanceof InputError||e instanceof SyntaxError;return Response.json({error:expected?e.message:'Unable to complete room action.'},{status:expected?400:503,headers})}
});
