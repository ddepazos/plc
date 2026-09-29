export const storageKey = 'plc-portfolio-v1';
const copy = value => JSON.parse(JSON.stringify(value));
export function createDemo(seed, storage) {
  function read() {
    const raw = storage.getItem(storageKey);
    if (!raw) return copy(seed);
    let value;
    try { value = JSON.parse(raw); } catch { throw new Error('Datos locales dañados. Usa Reiniciar demo.'); }
    if (value.version !== 1 || !Array.isArray(value.state?.transactions) ||
        value.state?.users?.[0]?.id !== seed.users[0].id ||
        !Number.isFinite(value.state.users[0].balance) || value.state.users[0].balance < 0) {
      throw new Error('Datos locales incompatibles. Usa Reiniciar demo.');
    }
    return value.state;
  }
  function save(state) {
    try { storage.setItem(storageKey, JSON.stringify({ version: 1, state })); }
    catch { throw new Error('El navegador no permite guardar la demo. Habilita el almacenamiento local o libera espacio. No se guardó la operación.'); }
  }
  return {
    read,
    reset() { const state = copy(seed); save(state); return state; },
    operate(endpoint, body) {
      const state = read();
      const user = state.users[0];
      const amountText = String(body.amount);
      if (!/^\d+(\.\d{1,2})?$/.test(amountText)) throw new Error('Introduce un monto positivo con hasta dos decimales.');
      const cents = Math.round(Number(amountText) * 100);
      if (!Number.isSafeInteger(cents) || cents < 1 || cents > 100000000) throw new Error('El monto debe estar entre 0,01 y 1.000.000 PLC.');
      const type = ({ '/api/send': 'sent', '/api/receive': 'received', '/api/topups': 'topup' })[endpoint];
      if (!type) throw new Error('Operación desconocida.');
      if (type === 'sent' && (!/^PLC-DEMO-[A-Z0-9-]{3,60}$/.test(body.recipient) || body.recipient === user.walletAddress)) throw new Error('Usa otro destinatario ficticio, por ejemplo PLC-DEMO-DESTINO.');
      if (body.note && (typeof body.note !== 'string' || body.note.length > 140)) throw new Error('La nota admite hasta 140 caracteres.');
      if (type === 'topup' && !['bank', 'ethereum'].includes(body.method)) throw new Error('Método de recarga inválido.');
      const balance = Math.round(user.balance * 100) + (type === 'sent' ? -cents : cents);
      if (balance < 0) throw new Error('Saldo insuficiente.');
      if (balance > 1000000000) throw new Error('El saldo máximo es 10.000.000 PLC.');
      const id = crypto.randomUUID();
      const transaction = { id, userId: user.id, type, amount: cents / 100, date: new Date().toISOString(), status: 'completed', reference: 'DEMO-' + id.slice(0, 8), demo: true };
      if (type === 'sent') { transaction.recipient = body.recipient; transaction.note = body.note || ''; }
      if (type === 'topup') transaction.method = body.method;
      user.balance = balance / 100;
      state.transactions.unshift(transaction);
      save(state);
      return { transaction };
    }
  };
}
