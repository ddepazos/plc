import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { createPostgresStore } from '../services/postgres-store.js';
import { transact } from '../services/wallet.js';

// A small transactional PostgreSQL stand-in. It checks the values sent to SQL
// and makes separate stores share one committed database, without a test server.
function database(initial = {}) {
  const db = {
    data: {
      users: initial.users || [],
      wallets: initial.wallets || [],
      transactions: [],
      requests: [],
      nextUserId: (initial.users?.length || 0) + 1,
      nextWalletId: (initial.wallets?.length || 0) + 1
    },
    tail: Promise.resolve(),
    closedPools: 0
  };

  class Client {
    constructor() { this.working = null; this.unlock = null; }
    release() {}
    async query(sql, params = []) {
      const query = sql.replace(/\s+/g, ' ').trim();
      if (query === 'BEGIN') {
        const previous = db.tail;
        db.tail = new Promise(resolve => { this.unlock = resolve; });
        await previous;
        this.working = structuredClone(db.data);
        return { rows: [] };
      }
      if (query === 'COMMIT' || query === 'ROLLBACK') {
        if (query === 'COMMIT') db.data = this.working;
        this.working = null;
        this.unlock?.();
        this.unlock = null;
        return { rows: [] };
      }
      const state = this.working || db.data;
      const rows = value => ({ rows: value });
      if (query.startsWith('SELECT pg_advisory_xact_lock')) return rows([{}]);
      if (query.startsWith('SELECT COUNT(*)::int AS n FROM users')) return rows([{ n: state.users.length }]);
      if (query.startsWith('INSERT INTO users(')) {
        const id = state.nextUserId++;
        state.users.push({ id, name: params[0], email: params[1] });
        return rows([{ id }]);
      }
      if (query.startsWith('INSERT INTO wallets(')) {
        const id = state.nextWalletId++;
        state.wallets.push({ id, user_id: params[0], address: params[1], currency: params[2], balance_cents: params[3] });
        return rows([{ id }]);
      }
      if (query.startsWith('SELECT u.id,u.name,u.email,w.id AS wallet_id')) {
        const user = state.users.find(u => u.email === params[0]);
        const wallet = state.wallets.find(w => w.user_id === user?.id && w.address === params[1]);
        return rows(wallet ? [{ ...user, wallet_id: wallet.id, address: wallet.address, currency: wallet.currency, balance_cents: wallet.balance_cents }] : []);
      }
      if (query.startsWith('SELECT id,type,amount_cents,status,reference,recipient,method,note,created_at')) {
        return rows(state.transactions.filter(tx => tx.wallet_id === params[0]).map(tx => ({ ...tx })).reverse());
      }
      if (query.startsWith('SELECT r.request_key,r.request_signature,r.transaction_id')) {
        const ids = new Set(state.transactions.filter(tx => tx.wallet_id === params[0]).map(tx => tx.id));
        return rows(state.requests.filter(request => ids.has(request.transaction_id)));
      }
      if (query.startsWith('SELECT id FROM wallets WHERE user_id=')) {
        return rows(state.wallets.filter(w => w.user_id === Number(params[0])).map(w => ({ id: w.id })));
      }
      if (query.startsWith('UPDATE wallets SET balance_cents=')) {
        const wallet = state.wallets.find(w => w.id === params[1]);
        assert.ok(wallet, 'La actualización debe corresponder a una billetera existente');
        wallet.balance_cents = params[0];
        return rows([]);
      }
      if (query.startsWith('INSERT INTO transactions(')) {
        assert.match(params[0], /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'El esquema PostgreSQL exige UUID');
        assert.ok(!state.transactions.some(tx => tx.id === params[0]), 'ID de transacción duplicado');
        state.transactions.push({ id: params[0], wallet_id: params[1], type: params[2], amount_cents: params[3], status: params[4], reference: params[5], recipient: params[6], method: params[7], note: params[8], created_at: params[9] });
        return rows([]);
      }
      if (query.startsWith('INSERT INTO idempotency_requests(')) {
        assert.ok(!state.requests.some(r => r.request_key === params[0]), 'Clave de idempotencia duplicada');
        state.requests.push({ request_key: params[0], request_signature: params[1], transaction_id: params[2] });
        return rows([]);
      }
      throw new Error(`Consulta no implementada en la prueba: ${query}`);
    }
  }

  const poolFactory = () => ({
    connect: async () => new Client(),
    query: (...args) => new Client().query(...args),
    end: async () => { db.closedPools++; }
  });
  return { db, poolFactory };
}

function settings(poolFactory) {
  return { ...config(), databaseUrl: 'postgres://fake/plc_demo', poolFactory };
}

test('PostgreSQL inicializa los datos seed con IDs UUID válidos', async t => {
  const { db, poolFactory } = database();
  const store = await createPostgresStore(settings(poolFactory));
  t.after(() => store.close());
  assert.equal(store.read().user.balanceCents, 245000);
  assert.equal(store.read().transactions.length, 4);
  assert.equal(db.data.transactions.length, 4);
  for (const tx of db.data.transactions) assert.match(tx.id, /^[0-9a-f-]{36}$/i);
});

test('PostgreSQL rechaza una base con otra cuenta y conserva su saldo', async () => {
  const { db, poolFactory } = database({
    users: [{ id: 1, name: 'Otra persona', email: 'otra@example.test' }],
    wallets: [{ id: 1, user_id: 1, address: 'OTRA-BILLETERA', currency: 'PLC', balance_cents: 77700 }]
  });
  await assert.rejects(createPostgresStore(settings(poolFactory)), /cuenta ficticia|seed PLC/i);
  assert.equal(db.data.wallets[0].balance_cents, 77700);
  assert.equal(db.closedPools, 1, 'El pool se cierra si falla el inicio');
});

test('dos instancias leen saldo vigente bajo bloqueo y no permiten sobregiro', async t => {
  const { db, poolFactory } = database();
  const first = await createPostgresStore(settings(poolFactory));
  const second = await createPostgresStore(settings(poolFactory));
  t.after(async () => { await first.close(); await second.close(); });
  const body = { amount: 1500, recipient: 'PLC-DEMO-DESTINO' };
  const results = await Promise.allSettled([
    transact(first, 'sent', body, randomUUID()),
    transact(second, 'sent', body, randomUUID())
  ]);
  assert.deepEqual(results.map(r => r.status).sort(), ['fulfilled', 'rejected']);
  assert.equal(results.find(r => r.status === 'rejected').reason.status, 409);
  assert.equal(db.data.wallets[0].balance_cents, 95000);
  assert.equal(db.data.transactions.length, 5);
});

test('una clave confirmada en otra instancia reproduce la misma transacción', async t => {
  const { db, poolFactory } = database();
  const first = await createPostgresStore(settings(poolFactory));
  const second = await createPostgresStore(settings(poolFactory));
  t.after(async () => { await first.close(); await second.close(); });
  const key = randomUUID();
  const body = { amount: 10, method: 'bank' };
  const original = await transact(first, 'topup', body, key);
  const replay = await transact(second, 'topup', body, key);
  assert.equal(replay.replayed, true);
  assert.equal(replay.transaction.id, original.transaction.id);
  assert.equal(db.data.wallets[0].balance_cents, 246000);
  assert.equal(db.data.transactions.length, 5);
  assert.equal(db.data.requests.length, 1);
});
