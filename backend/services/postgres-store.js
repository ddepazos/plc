import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const { Pool } = pg;

export async function createPostgresStore({ databaseUrl, seedFile, poolFactory = options => new Pool(options) }) {
  const seed = JSON.parse(await readFile(seedFile, 'utf8'));
  const demoUser = seed.users?.[0];
  if (!demoUser?.email || !demoUser.walletAddress) throw new Error('Seed PLC inválido.');
  const pool = poolFactory({ connectionString: databaseUrl });
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Dos procesos que arrancan juntos no deben insertar el mismo seed.
      await client.query('SELECT pg_advisory_xact_lock(134717829)');
      const count = await client.query('SELECT COUNT(*)::int AS n FROM users');
      if (count.rows[0].n === 0) await seedDatabase(client, seed);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }

    let state = await loadState(pool, false, demoUser);
    let queue = Promise.resolve();
    return {
      read: () => structuredClone(state),
      refresh() {
        const job = queue.then(async () => { state = await loadState(pool, false, demoUser); });
        queue = job.catch(() => {});
        return job;
      },
      update(operation) {
        const job = queue.then(async () => {
          const client = await pool.connect();
          try {
            await client.query('BEGIN');
            // El bloqueo y la lectura vigente deben compartir transacción.
            // Así otro proceso no puede confirmar un saldo nuevo entre ambos.
            const current = await loadState(client, true, demoUser);
            const next = structuredClone(current);
            const result = operation(next);
            if (!result?.replayed) await persistChanges(client, current, next);
            await client.query('COMMIT');
            state = next;
            return result;
          } catch (error) {
            await client.query('ROLLBACK');
            throw error;
          } finally { client.release(); }
        });
        queue = job.catch(() => {});
        return job;
      },
      close: async () => { await queue; await pool.end(); }
    };
  } catch (error) {
    await pool.end();
    throw error;
  }
}

async function seedDatabase(client, seed) {
  const user = seed.users[0];
  const u = await client.query(
    `INSERT INTO users(name,email,status) VALUES($1,$2,'active') RETURNING id`,
    [user.name, user.email]
  );
  const w = await client.query(
    `INSERT INTO wallets(user_id,address,currency,balance_cents) VALUES($1,$2,$3,$4) RETURNING id`,
    [u.rows[0].id, user.walletAddress, user.currency || 'PLC', Math.round(user.balance * 100)]
  );
  for (const tx of seed.transactions) {
    await client.query(
      `INSERT INTO transactions(id,wallet_id,type,amount_cents,status,reference,recipient,method,note,created_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      // El seed JSON usa ids descriptivos; PostgreSQL exige UUID.
      [randomUUID(), w.rows[0].id, tx.type, Math.round(tx.amount * 100), tx.status || 'completed', tx.reference, tx.recipient || null, tx.method || null, tx.note || null, tx.date]
    );
  }
}

async function loadState(pool, lockWallet, demoUser) {
  const userResult = await pool.query(
    `SELECT u.id,u.name,u.email,w.id AS wallet_id,w.address,w.currency,w.balance_cents
     FROM users u JOIN wallets w ON w.user_id=u.id
     WHERE u.email=$1 AND w.address=$2 LIMIT 1${lockWallet ? ' FOR UPDATE OF w' : ''}`,
    [demoUser.email, demoUser.walletAddress]
  );
  if (!userResult.rows.length) throw new Error('PostgreSQL no contiene la cuenta ficticia del seed PLC; no se usará otra billetera.');
  const row = userResult.rows[0];
  const txResult = await pool.query(
    `SELECT id,type,amount_cents,status,reference,recipient,method,note,created_at
     FROM transactions WHERE wallet_id=$1 ORDER BY created_at DESC`, [row.wallet_id]
  );
  const requestResult = await pool.query(
    `SELECT r.request_key,r.request_signature,r.transaction_id
     FROM idempotency_requests r JOIN transactions t ON t.id=r.transaction_id
     WHERE t.wallet_id=$1`, [row.wallet_id]
  );
  return {
    version: 1,
    user: { id: String(row.id), name: row.name, email: row.email, walletAddress: row.address, currency: row.currency, balanceCents: Number(row.balance_cents) },
    transactions: txResult.rows.map(tx => ({ id: tx.id, userId: String(row.id), type: tx.type, amountCents: Number(tx.amount_cents), status: tx.status, reference: tx.reference, recipient: tx.recipient || undefined, method: tx.method || undefined, note: tx.note || undefined, date: new Date(tx.created_at).toISOString(), demo: true })),
    requests: Object.fromEntries(requestResult.rows.map(r => [r.request_key, { signature: r.request_signature, id: r.transaction_id }]))
  };
}

async function persistChanges(client, before, state) {
  const wallet = await client.query('SELECT id FROM wallets WHERE user_id=$1', [state.user.id]);
  if (!wallet.rows.length) throw new Error('Billetera PostgreSQL no encontrada.');
  const walletId = wallet.rows[0].id;
  await client.query('UPDATE wallets SET balance_cents=$1,updated_at=NOW() WHERE id=$2', [state.user.balanceCents, walletId]);
  const knownTransactions = new Set(before.transactions.map(tx => tx.id));
  for (const tx of state.transactions.filter(tx => !knownTransactions.has(tx.id))) {
    await client.query(
      `INSERT INTO transactions(id,wallet_id,type,amount_cents,status,reference,recipient,method,note,created_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [tx.id, walletId, tx.type, tx.amountCents, tx.status, tx.reference, tx.recipient || null, tx.method || null, tx.note || null, tx.date]
    );
  }
  for (const [key, request] of Object.entries(state.requests).filter(([key]) => !Object.hasOwn(before.requests, key))) {
    await client.query(
      `INSERT INTO idempotency_requests(request_key,operation,request_signature,transaction_id)
       VALUES($1,'wallet-operation',$2,$3)`,
      [key, request.signature, request.id]
    );
  }
}
