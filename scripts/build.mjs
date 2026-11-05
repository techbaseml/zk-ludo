import {stripTypeScriptTypes} from 'node:module';import {mkdir,cp,readdir,writeFile,readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
await mkdir('dist',{recursive:true});await cp('public','dist',{recursive:true});
for(const f of await readdir('src')){let src=await readFile('src/'+f,'utf8');if(f==='config.ts'&&process.env.API_ORIGIN){const url=new URL(process.env.API_ORIGIN);if(url.protocol!=='https:')throw Error('API_ORIGIN requires HTTPS');src='export const API='+JSON.stringify(url.href.replace(/\/$/,''))}await writeFile('dist/'+f.replace('.ts','.js'),stripTypeScriptTypes(src,{mode:'transform',disableWarning:true}).replaceAll(".ts'",".js'"))}
const files=(await readdir('dist')).filter(f=>f!=='sw.js').sort();const hash=createHash('sha256');for(const f of files)hash.update(await readFile('dist/'+f));hash.update('network-refresh-v1');const version=hash.digest('hex').slice(0,16);
await writeFile('dist/sw.js',`
const prefix='zk-ludo:'+self.registration.scope+':',cache=prefix+'${version}',assets=${JSON.stringify(files.map(f=>'./'+f))};
self.addEventListener('install',e=>e.waitUntil(caches.open(cache).then(c=>c.addAll(assets.map(path=>new Request(path,{cache:'reload'}))))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(prefix)&&k!==cache).map(k=>caches.delete(k)))).then(()=>clients.claim())));
self.addEventListener('fetch',e=>{const url=new URL(e.request.url);if(e.request.method!=='GET'||url.origin!==location.origin||!url.href.startsWith(self.registration.scope)||url.pathname.includes('/api/'))return;e.respondWith(caches.open(cache).then(async c=>await c.match(e.request.mode==='navigate'?new URL('index.html',self.registration.scope).href:e.request)||fetch(e.request)))});
`);console.log('Built '+files.length+' offline assets · '+version);
