import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { createApp } from '../server.js';
import { config, root } from '../config.js';
import { createStore } from '../services/store.js';

async function fixture(t) {
 const dir = await mkdtemp(path.join(os.tmpdir(), 'plc-test-'));
 const settings = { ...config(), port:0, storeFile:path.join(dir,'demo.json') };
 const server = await createApp(settings);
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
 t.after(async () => { await new Promise(resolve => server.close(resolve)); await rm(dir,{recursive:true,force:true}); });
 const base = `http://127.0.0.1:${server.address().port}`;
 const get = async route => { const response = await fetch(base+route); return {status:response.status,body:await response.json()}; };
 const post = async (route,body,key=randomUUID(),headers={}) => {const response=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':key,...headers},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};};
 return {base,get,post,settings};
}
test('operaciones, detalle, idempotencia y persistencia',async t=>{
 const {get,post,settings}=await fixture(t);
 assert.equal((await get('/api/wallet')).body.balance,2450);
 const key=randomUUID();
 const sent=await post('/api/send',{amount:'25.10',recipient:'PLC-DEMO-DESTINO',note:'Ensayo'},key);
 assert.equal(sent.status,200);
 assert.equal((await post('/api/send',{amount:'25.10',recipient:'PLC-DEMO-DESTINO',note:'Ensayo'},key)).body.replayed,true);
 assert.equal((await post('/api/send',{amount:'26',recipient:'PLC-DEMO-DESTINO'},key)).status,409);
 assert.equal((await get('/api/transactions/'+sent.body.transaction.id)).body.note,'Ensayo');
 await post('/api/receive',{amount:'10.20'});
 await post('/api/topups',{amount:'100',method:'bank'});
 await post('/api/topups',{amount:'20',method:'ethereum'});
 assert.equal((await get('/api/wallet')).body.balance,2555.1);
 const reopened=await createStore(settings);
 assert.equal(reopened.read().user.balanceCents,255510);
 assert.equal(reopened.read().transactions.length,8);
 assert.equal((await get('/api/transactions/missing')).status,404);
});
test('rechaza montos, credenciales, métodos y sobregiros sin mutar saldo',async t=>{
 const {get,post}=await fixture(t);
 for(const amount of [0,-1,'0.001','1e3','abc',true,null,1000001]) assert.equal((await post('/api/receive',{amount})).status,400);
 assert.equal((await post('/api/send',{amount:2451,recipient:'PLC-DEMO-DESTINO'})).status,409);
 assert.equal((await post('/api/send',{amount:10,recipient:'real@example.com'})).status,400);
 assert.equal((await post('/api/send',{amount:10,recipient:'PLC-DEMO-7A21-F9C4-2B83'})).status,400);
 assert.equal((await post('/api/topups',{amount:10,method:'card'})).status,400);
 assert.equal((await post('/api/topups',{amount:10,method:'bank',password:'fake'})).status,400);
 assert.equal((await post('/api/receive',{amount:10},'')).status,400);
 assert.equal((await get('/api/wallet')).body.balance,2450);
});
test('cada operación rechaza campos que no pertenecen a su contrato',async t=>{
 const {get,post}=await fixture(t);
 const key=randomUUID();
 assert.equal((await post('/api/receive',{amount:2},key)).status,200);
 assert.equal((await post('/api/receive',{amount:2,recipient:'PLC-DEMO-DESTINO'},key)).status,400);
 assert.equal((await post('/api/receive',{amount:2,method:'bank'})).status,400);
 assert.equal((await post('/api/send',{amount:2,recipient:'PLC-DEMO-DESTINO',method:'bank'})).status,400);
 assert.equal((await post('/api/topups',{amount:2,method:'bank',note:'extra'})).status,400);
 assert.equal((await get('/api/wallet')).body.balance,2452);
 assert.equal((await get('/api/transactions')).body.length,5);
});
test('concurrencia no pierde actualizaciones ni permite sobregiro',async t=>{
 const {get,post}=await fixture(t);
 const results=await Promise.all([1,2,3].map(()=>post('/api/send',{amount:1000,recipient:'PLC-DEMO-DESTINO'})));
 assert.deepEqual(results.map(r=>r.status).sort(),[200,200,409]);
 assert.equal((await get('/api/wallet')).body.balance,450);
 const key=randomUUID();
 await Promise.all([1,2,3].map(()=>post('/api/receive',{amount:'0.01'},key)));
 assert.equal((await get('/api/wallet')).body.balance,450.01);
});
test('seguridad HTTP, archivos privados y JSON inválido',async t=>{
 const {base,get,post}=await fixture(t);
 for(const route of ['/backend/storage/demo.json','/.git/config','/package.json','/pages/missing.html']) assert.equal((await get(route)).status,404);
 assert.equal((await post('/api/receive',{amount:1},randomUUID(),{Origin:'https://example.com'})).status,403);
 assert.equal((await post('/api/receive',{amount:1},randomUUID(),{'Content-Type':'text/plain'})).status,415);
 const malformed=await fetch(base+'/api/receive',{method:'POST',headers:{'Content-Type':'application/json'},body:'{broken'});
 assert.equal(malformed.status,400);
 const large=await post('/api/receive',{amount:1,note:'x'.repeat(9000)});assert.equal(large.status,413);
 const html=await fetch(base+'/pages/wallet.html');assert.equal(html.status,200);assert.match(html.headers.get('content-security-policy'),/frame-ancestors 'none'/);
});
test('configuración pública exige HTTPS y clave demo; acepta URL de Render', () => {
 assert.equal(config({}).host, '127.0.0.1');
 assert.throws(() => config({HOST:'0.0.0.0'}), /PUBLIC_ORIGIN/);
 assert.throws(() => config({HOST:'0.0.0.0',PUBLIC_ORIGIN:'https://plc.example.test'}), /PLC_DEMO_PASSWORD/);
 assert.throws(() => config({HOST:'0.0.0.0',PUBLIC_ORIGIN:'http://plc.example.test',PLC_DEMO_PASSWORD:'clave-de-prueba-larga'}), /HTTPS/);
 assert.throws(() => config({HOST:'0.0.0.0',PUBLIC_ORIGIN:'https://plc.example.test/ruta',PLC_DEMO_PASSWORD:'clave-de-prueba-larga'}), /sin ruta/);
 assert.throws(() => config({HOST:'0.0.0.0',PUBLIC_ORIGIN:'https://plc.example.test',PLC_DEMO_PASSWORD:'clave-de-prueba-larga'}), /DATABASE_URL/);
 const settings=config({HOST:'0.0.0.0',RENDER_EXTERNAL_URL:'https://plc.example.test',PLC_DEMO_PASSWORD:'clave-de-prueba-larga',DATABASE_URL:'postgres://demo@localhost/plc'});
 assert.equal(settings.publicOrigin,'https://plc.example.test');
 assert.equal(settings.host,'0.0.0.0');
});
test('error de conexión PostgreSQL no imprime la contraseña', () => {
 const password='secreto-de-prueba-no-real';
 const result=spawnSync(process.execPath,[path.join(root,'backend/server.js')],{
   env:{...process.env,HOST:'127.0.0.1',PORT:'0',DATABASE_URL:`postgres://demo:${password}@127.0.0.1:1/plc`},
   encoding:'utf8',timeout:10000
 });
 assert.equal(result.status,1,result.stderr);
 assert.match(result.stderr,/no se pudo iniciar la persistencia/);
 assert.ok(!result.stderr.includes(password));
});
test('servicio público valida Host y Origin, requiere Basic Auth y permite health check', async t => {
 const dir=await mkdtemp(path.join(os.tmpdir(),'plc-public-test-'));
 // El test del servidor usa JSON aislado; config() exige PostgreSQL en el arranque público real.
 const settings={...config({}),host:'0.0.0.0',publicOrigin:'https://plc.example.test',demoPassword:'clave-de-prueba-larga',port:0,storeFile:path.join(dir,'demo.json')};
 const server=await createApp(settings);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${server.address().port}`;
 const auth='Basic '+Buffer.from('demo:clave-de-prueba-larga').toString('base64');
 const request=(route,options={})=>new Promise((resolve,reject)=>{
   const headers=Object.fromEntries(Object.entries({Host:'plc.example.test',...options.headers}).filter(([,value])=>value!==undefined));
   const req=http.request(base+route,{method:options.method || 'GET',headers},res=>{
     const chunks=[];
     res.on('data',chunk=>chunks.push(chunk));
     res.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:res.headers})));
   });
   req.on('error',reject);
   req.end(options.body);
 });
 const health=await request('/api/health');
 assert.equal(health.status,200,await health.text());
 const anonymous=await request('/pages/wallet.html');
 assert.equal(anonymous.status,401);
 assert.match(anonymous.headers.get('www-authenticate'),/Basic/);
 assert.equal((await request('/api/wallet',{headers:{Authorization:'Basic '+Buffer.from('demo:incorrecta').toString('base64')}})).status,401);
 assert.equal((await request('/api/wallet',{headers:{Authorization:auth}})).status,200);
 assert.equal((await request('/api/wallet',{headers:{Host:'otro.example.test',Authorization:auth}})).status,403);
 const post=(headers={})=>request('/api/receive',{method:'POST',headers:{Authorization:auth,Origin:'https://plc.example.test','Content-Type':'application/json','Idempotency-Key':randomUUID(),...headers},body:JSON.stringify({amount:1})});
 assert.equal((await post()).status,200);
 assert.equal((await post({Origin:'http://plc.example.test'})).status,403);
 assert.equal((await post({'Sec-Fetch-Site':'cross-site'})).status,403);
 assert.equal((await post({Authorization:undefined})).status,401);
 assert.equal((await (await request('/api/wallet',{headers:{Authorization:auth}})).json()).balance,2451);
});
test('archivo dañado no se reemplaza por seed',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'plc-corrupt-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const file=path.join(dir,'demo.json');await writeFile(file,'broken');
 await assert.rejects(createStore({...config(),storeFile:file}));assert.equal(await readFile(file,'utf8'),'broken');
});
test('rutas locales HTML, CSS, JS y enlaces con ancla existen',async()=>{
 const {readdir}=await import('node:fs/promises');
 const files=['index.html',...(await readdir(path.join(root,'pages'))).map(f=>'pages/'+f)];
 for(const file of files){
 const html=await readFile(path.join(root,file),'utf8');
 assert.ok(!html.includes('jquery'));
 for(const match of html.matchAll(/(?:href|src)="([^\"]+)"/g)){
 const value=match[1];if(/^(https?:|mailto:)/.test(value))continue;
 const [rel,hash]=value.split('#');const clean=rel.split('?')[0];const target=clean?path.resolve(root,path.dirname(file),clean):path.resolve(root,file);
 const content=await readFile(target,'utf8');
 if(hash)assert.ok(content.includes(`id="${hash}"`),`${file}: ancla ${value}`);
 }
 }
});
