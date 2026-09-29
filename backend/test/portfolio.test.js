import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDemo, storageKey } from '../../assets/js/portfolio-demo.js';
const seed = JSON.parse(await readFile(new URL('../../data/plc-demo.json', import.meta.url)));
function storage() { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v) }; }
test('operaciones, detalle, persistencia, aislamiento y reinicio del portafolio', () => {
  const local = storage();
  const demo = createDemo(seed, local);
  const tx = demo.operate('/api/send', { amount:'25.10', recipient:'PLC-DEMO-DESTINO', note:'Ensayo' }).transaction;
  demo.operate('/api/receive', { amount:'10.20' });
  demo.operate('/api/topups', { amount:'100', method:'bank' });
  demo.operate('/api/topups', { amount:'20', method:'ethereum' });
  const reopened = createDemo(seed, local);
  assert.equal(reopened.read().users[0].balance, 2555.10);
  assert.equal(reopened.read().transactions.find(t => t.id === tx.id).note, 'Ensayo');
  assert.equal(createDemo(seed, storage()).read().users[0].balance, 2450);
  assert.deepEqual(demo.reset(), seed);
  assert.deepEqual(reopened.read(), seed);
});
test('rechaza operaciones inválidas sin cambiar saldo ni historial', () => {
  const demo = createDemo(seed, storage());
  for (const amount of ['0','-1','0.001','1e2','NaN','1000001']) assert.throws(() => demo.operate('/api/receive', {amount}));
  assert.throws(() => demo.operate('/api/send', {amount:'2451',recipient:'PLC-DEMO-DESTINO'}));
  assert.throws(() => demo.operate('/api/send', {amount:'1',recipient:seed.users[0].walletAddress}));
  assert.throws(() => demo.operate('/api/send', {amount:'1',recipient:'real'}));
  assert.throws(() => demo.operate('/api/topups', {amount:'1',method:'other'}));
  assert.deepEqual(demo.read(), seed);
});
test('almacenamiento lleno no confirma cambios y datos dañados se pueden reiniciar', () => {
  const demo = createDemo(seed, { getItem: () => null, setItem: () => { throw Error('quota'); } });
  assert.throws(() => demo.operate('/api/receive', { amount:'10' }), /No se guardó/);
  assert.deepEqual(demo.read(), seed);
  const local = storage(); local.setItem(storageKey, '{broken');
  const corrupt = createDemo(seed, local);
  assert.throws(() => corrupt.read(), /Reiniciar/);
  corrupt.reset(); assert.deepEqual(corrupt.read(), seed);
});
