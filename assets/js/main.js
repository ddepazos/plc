const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const money = value => new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) + ' PLC';
const label = type => ({sent:'Enviado', received:'Recibido', topup:'Recarga'})[type] || type;
const sign = type => type === 'sent' ? '−' : '+';
const isPage = location.pathname.includes('/pages/');
const isGithubPages = location.hostname === 'ddepazos.github.io' && location.pathname.startsWith('/plc/');
const isPortfolio = isGithubPages;
const liveHref = href => href;
let demo;
let state, online = false;
const pending = new Map();
const status = document.createElement('p');
status.className = 'demo-banner';
status.setAttribute('role', 'status');
status.textContent = 'Cargando demo…';
($('main') || document.body).prepend(status);
const connectedMessage = 'DEMO · API conectada · PLC ficticios, sin pagos reales';
function showStaticNotice() {
  status.textContent = 'Demostración · sin dinero real · tus movimientos se guardan solo en este navegador. ';
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'btn btn-small btn-ghost';
  reset.textContent = 'Reiniciar demo';
  reset.addEventListener('click', async () => {
    if (!demo || !confirm('¿Reiniciar el saldo y borrar los movimientos de esta demo en este navegador?')) return;
    try {
      const perform = () => demo.reset();
      state = navigator.locks ? await navigator.locks.request('plc-portfolio', perform) : perform();
      pending.clear(); online = true; render();
      $$('.form-message').forEach(el => el.textContent = '');
      showStaticNotice();
      await detail();
    } catch (error) { status.append(' ' + error.message); }
  });
  status.append(reset);
}
function text(selector, value) { $$(selector).forEach(el => el.textContent = value); }
async function request(url, options = {}) {
  if (isPortfolio && url.startsWith('/api/')) {
    if (url === '/api/state') return demo.read();
    if (url.startsWith('/api/transactions/')) {
      const tx = demo.read().transactions.find(item => item.id === decodeURIComponent(url.slice('/api/transactions/'.length)));
      if (!tx) throw new Error('Transacción no encontrada.');
      return tx;
    }
    if (options.method === 'POST') {
      const perform = () => demo.operate(url, JSON.parse(options.body));
      return navigator.locks ? navigator.locks.request('plc-portfolio', perform) : perform();
    }
    throw new Error('Ruta de demostración desconocida.');
  }
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(6000), cache: 'no-store' });
  let result;
  try { result = await response.json(); } catch { throw new Error('Respuesta de API no válida.'); }
  if (!response.ok) throw new Error(result.error || 'No se pudo completar la solicitud.');
  return result;
}
function rows(container, txs) {
  if (!container) return;
  container.replaceChildren();
  const query = $('#transaction-search')?.value.trim().toLowerCase() || '';
  txs.filter(tx => `${label(tx.type)} ${tx.date} ${tx.reference} ${tx.recipient || ''} ${tx.method || ''}`.toLowerCase().includes(query)).forEach(tx => {
    const link = document.createElement('a');
    link.className = 'transaction-row';
    link.href = liveHref('detalle.html?id=' + encodeURIComponent(tx.id));
    const title = document.createElement('span');
    title.textContent = `${label(tx.type)} · ${tx.date.slice(0, 10)}`;
    const amount = document.createElement('strong');
    amount.textContent = sign(tx.type) + money(tx.amount);
    link.append(title, amount); container.append(link);
  });
  if (!container.children.length) container.textContent = 'No hay movimientos que mostrar.';
}
function render() {
  const user = state.users[0];
  for (const field of ['name','email','walletAddress']) text(`[data-plc="${field === 'walletAddress' ? 'wallet' : field}"]`, user[field]);
  text('[data-plc="balance"]', money(user.balance));
  text('[data-plc="sessions"]', 'No disponibles en esta demo');
  text('[data-plc="two-factor"]', 'No disponible en esta demo');
  rows($('#transaction-list'), state.transactions);
  rows($('#recent-transactions'), state.transactions.slice(0, 3));
  rows($('#latest-transaction'), state.transactions.slice(0, 1));
  $$('.demo-operation button[type="submit"]').forEach(button => button.disabled = !online);
}
function showDetail(tx) {
  for (const [key, value] of Object.entries({ amount: sign(tx.type) + money(tx.amount), type: label(tx.type), date: tx.date, status: 'Completada · simulación', reference: tx.reference, recipient: tx.recipient || '—', method: ({bank:'Cuenta bancaria genérica',ethereum:'Ethereum simulado'})[tx.method] || '—', note: tx.note || '—' })) text(`[data-transaction="${key}"]`, value);
}
async function detail() {
  if (!$('#transaction-detail')) return;
  const id = new URLSearchParams(location.search).get('id');
  try {
    if (!id) throw new Error('Selecciona un movimiento desde el historial.');
    const tx = online ? await request('/api/transactions/' + encodeURIComponent(id)) : state.transactions.find(t => t.id === id);
    if (!tx) throw new Error('Transacción no encontrada en los datos disponibles.');
    text('#detail-message', '');
    showDetail(tx);
  } catch (error) { text('#detail-message', error.message); }
}
async function load() {
  if (isGithubPages) {
    online = false;
    showStaticNotice();
    try {
      const seed = await request((isPage ? '../' : '') + 'data/plc-demo.json');
      const { createDemo } = await import('./portfolio-demo.js');
      demo = createDemo(seed, localStorage);
      state = demo.read(); online = true;
      render(); await detail();
    } catch (error) { status.append(' ' + error.message); }
    return;
  }
  try {
    state = await request('/api/state'); online = true;
    status.textContent = connectedMessage;
  } catch {
    online = false;
    try {
      state = await request((isPage ? '../' : '') + 'data/plc-demo.json');
      status.textContent = 'DEMO · API no disponible · datos iniciales de solo lectura. Las operaciones están desactivadas.';
    } catch { status.textContent = 'No se pudieron cargar la API ni los datos demo. Abre el proyecto mediante HTTP.'; return; }
  }
  render(); await detail();
}
async function operate(form, endpoint, body) {
  const message = form.querySelector('.form-message');
  if (!online) { message.textContent = 'API no disponible. El modo seed es de solo lectura.'; return; }
  const serialized = JSON.stringify(body);
  let operation = pending.get(form);
  if (!operation || operation.serialized !== serialized) {
    operation = { serialized, key: crypto.randomUUID() }; pending.set(form, operation);
  }
  const button = form.querySelector('button[type="submit"]');
  if (button.disabled) return;
  button.disabled = true; message.textContent = 'Procesando simulación…';
  let confirmed = false;
  try {
    const result = await request(endpoint, { method: 'POST', headers: { 'Content-Type':'application/json', 'Idempotency-Key':operation.key }, body: serialized });
    confirmed = true; pending.delete(form);
    if (endpoint === '/api/send') { location.href = 'detalle.html?id=' + encodeURIComponent(result.transaction.id); return; }
    state = await request('/api/state'); render(); form.reset();
    form.querySelector('select')?.dispatchEvent(new Event('change'));
    message.textContent = 'Simulación completada. Saldo: ' + money(state.users[0].balance);
    const link = document.createElement('a'); link.href = 'detalle.html?id=' + encodeURIComponent(result.transaction.id); link.textContent = ' Ver detalle'; message.append(link);
  } catch (error) {
    message.textContent = confirmed ? 'Operación confirmada, pero no se pudo actualizar el saldo. Recarga la página antes de otra operación.' : (isPortfolio ? error.message : error.message + ' Si hubo un corte de conexión, reintenta sin cambiar los datos: se usará la misma clave para evitar duplicados.');
    if (confirmed) online = false;
  } finally { button.disabled = !online; }
}
$('.menu-toggle')?.addEventListener('click', event => { const open = $('.main-nav').classList.toggle('open'); event.currentTarget.setAttribute('aria-expanded', String(open)); });
$$('.main-nav a').forEach(link => link.addEventListener('click', () => { $('.main-nav').classList.remove('open'); $('.menu-toggle').setAttribute('aria-expanded','false'); }));
$$('[data-copy]').forEach(button => button.addEventListener('click', async () => { try { await navigator.clipboard.writeText($(button.dataset.copy).textContent); button.textContent = 'Copiado'; } catch { button.textContent = 'Selecciona la dirección para copiar'; } }));
$('.js-max')?.addEventListener('click', () => { if (state) $('#amount').value = Math.min(state.users[0].balance, 1000000).toFixed(2); });
$('.js-send-form')?.addEventListener('submit', event => { event.preventDefault(); operate(event.currentTarget, '/api/send', { recipient: $('#recipient').value.trim(), amount: $('#amount').value, note: $('[name="nota"]').value.trim() }); });
$('.js-topup')?.addEventListener('submit', event => { event.preventDefault(); operate(event.currentTarget, '/api/topups', { amount: $('#topup-amount').value, method: $('#topup-method').value }); });
$('.js-receive')?.addEventListener('submit', event => { event.preventDefault(); operate(event.currentTarget, '/api/receive', { amount: $('#receive-amount').value }); });
$('#transaction-search')?.addEventListener('input', () => { if (state) rows($('#transaction-list'), state.transactions); });
$('#topup-method')?.addEventListener('change', () => { text('#method-help', $('#topup-method').value === 'bank' ? 'Cuenta ficticia DEMO-BANCO-001. Sin número bancario real ni transferencia.' : 'Ethereum de demostración. No solicita wallet, red, gas, ETH ni firma. El monto está expresado en PLC ficticios.'); });
window.addEventListener('focus', async () => {
  if (!state || pending.size) return;
  try {
    state = await request('/api/state');
    online = true;
    if (isPortfolio) showStaticNotice(); else status.textContent = connectedMessage;
    render();
    await detail();
  } catch {
    online = false;
    if (isPortfolio) { showStaticNotice(); status.append(' No se pudieron leer los datos locales. Usa Reiniciar demo.'); }
    else status.textContent = 'DEMO · Conexión interrumpida. Las operaciones están desactivadas hasta recuperar la API.';
    if (state) render();
  }
});
load();
