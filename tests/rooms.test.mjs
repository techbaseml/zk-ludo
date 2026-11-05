import test from 'node:test';import assert from 'node:assert/strict';import {createServer} from '../server/start.mjs';
for(const size of [2,3,4])test(size+' authenticated seats, authoritative match, reconnect and rematch',async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/api/';let room;const keys=[];
 async function api(action,i,extra={}){const res=await fetch(url+action,{method:'POST',headers:{Authorization:'Bearer '+keys[i]},body:JSON.stringify({size,name:'Player '+i,code:room?.code,rev:room?.rev,...extra})});return res.json()}
 try{room=await api('create',0);keys.push(room.key);for(let i=1;i<size;i++){room=await api('join',i);keys.push(room.key)}for(let i=0;i<size;i++)room=await api('ready',i);room=await api('start',0);assert.equal(room.game.players.length,size);
 assert.ok((await api('state',99)).error);assert.ok((await api('roll',1)).error);const rev=room.rev;room=await api('roll',0,{die:42});assert.ok(room.game.die<=6);assert.ok((await api('roll',0,{rev})).error);
 for(let n=0;n<200&&room.game.phase!=='move';n++)room=await api('roll',room.game.turn);room=await api('move',room.game.turn,{token:0});assert.deepEqual((await api('state',1)).game,room.game);assert.ok(!JSON.stringify(await api('state',0)).includes(keys[1]));
 room=await api('resign',1);assert.equal(room.game.phase,'over');for(let i=0;i<size;i++)room=await api('rematch',i);assert.equal(room.game.phase,'roll')
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r))}});
test('a waiting client is notified of a new revision',async()=>{const s=createServer();await new Promise(r=>s.listen(0,r));const url='http://localhost:'+s.address().port+'/api/';
 const call=async(a,b,key)=>(await fetch(url+a,{method:'POST',headers:{Authorization:'Bearer '+key},body:JSON.stringify(b)})).json();
 try{const host=await call('create',{name:'Host',size:2});const pending=call('state',{code:host.code,rev:host.rev,wait:true},host.key);await call('join',{name:'Guest',code:host.code});assert.equal((await pending).seats.length,2)}finally{s.closeAllConnections();await new Promise(r=>s.close(r))}});
test('restart recovery, presence expiry, reconnect and final score retrieval after opponent leaves',async()=>{
 const {mkdtemp,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const dir=await mkdtemp(join(tmpdir(),'zk-room-'));let s;const db=join(dir,'test.sqlite');
 async function boot(){s=createServer({database:db});await new Promise(r=>s.listen(0,r))}
 async function stop(){s.closeAllConnections();await new Promise(r=>s.close(r))}
 const call=async(a,b,key)=>(await fetch('http://localhost:'+s.address().port+'/api/'+a,{method:'POST',headers:{Authorization:'Bearer '+key},body:JSON.stringify(b)})).json();
 const clock=Date.now;await boot();try{const h=await call('create',{name:'Host',size:2}),code=h.code;const guest=await call('join',{name:'Guest',code});await stop();await boot();
 let r=await call('state',{code},h.key);assert.equal(r.seats.length,2);Date.now=()=>clock()+16000;r=await call('state',{code},h.key);assert.equal(r.seats[1].connected,false);r=await call('state',{code},guest.key);assert.equal(r.seats[1].connected,true);
 for(const key of [h.key,guest.key])r=await call('ready',{code,rev:r.rev},key);r=await call('start',{code,rev:r.rev},h.key);r=await call('resign',{code,rev:r.rev},guest.key);await call('leave',{code,rev:r.rev},guest.key);
 r=await call('state',{code},h.key);assert.equal(r.game.winner,0);assert.equal(r.seats[1].left,true);assert.ok((await call('state',{code},guest.key)).error);
 }finally{Date.now=clock;await stop();await rm(dir,{recursive:true,force:true})}
});
