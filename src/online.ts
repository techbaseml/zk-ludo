import {API} from './config.ts';
let session=JSON.parse(sessionStorage.getItem('zk-room')||'null');
export const savedRoom=()=>session?.code;
export function forget(){session=null;sessionStorage.removeItem('zk-room')}
export async function request(action:string,body:any={}){
 const response=await fetch(API+'/api/'+action,{method:'POST',headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.key}:{})},body:JSON.stringify({code:session?.code,...body}),signal:AbortSignal.timeout(9000)});
 if(!response.headers.get('content-type')?.includes('json'))throw Error('Online rooms need the ZK LUDO server. Offline modes are available.');
 const r=await response.json();if(r.error)throw Error(r.error);if(r.key){session={code:r.code,key:r.key};sessionStorage.setItem('zk-room',JSON.stringify(session));delete r.key}return r;
}
