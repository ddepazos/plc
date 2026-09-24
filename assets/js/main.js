$(function(){
  const $menu=$('.main-nav');
  let plcData=null;
  const STORAGE_KEY='plc-demo-state-v1';
  const isPage=location.pathname.includes('/pages/');
  const dataUrl=isPage?'../data/plc-demo.json':'data/plc-demo.json';
  const money=value=>new Intl.NumberFormat('es-CL',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value)+' PLC';
  const typeLabel=type=>type==='sent'?'Enviado':type==='topup'?'Carga de saldo':'Recibido';
  const txSign=type=>type==='sent'?'-':'+';
  const today=()=>new Date().toISOString().slice(0,10);
  const makeId=prefix=>prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);

  function saveState(){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(plcData))}catch(error){console.warn('PLC localStorage:',error.message)}
  }

  function applyStoredState(seed){
    try{
      const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      if(saved?.users?.length&&Array.isArray(saved.transactions))return saved;
    }catch(error){console.warn('PLC state:',error.message)}
    return seed;
  }

  function renderUser(){
    const user=plcData?.users?.[0];
    if(!user)return;
    $('[data-plc="name"]').text(user.name);
    $('[data-plc="email"]').text(user.email);
    $('[data-plc="balance"]').text(money(user.balance));
    $('[data-plc="wallet"]').text(user.walletAddress);
    $('[data-plc="sessions"]').text(user.security?.activeSessions??0);
    $('[data-plc="two-factor"]').text(user.security?.twoFactor?'Activado':'Desactivado');
    $('#wallet-address').text(user.walletAddress);
    $('.js-max').attr('data-balance',user.balance);
  }

  function renderHistory(transactions){
    const $list=$('#transaction-list');
    if(!$list.length)return;
    const rows=transactions.map(tx=>`<a class="transaction-row" href="detalle.html?id=${encodeURIComponent(tx.id)}" data-search="${typeLabel(tx.type)} ${tx.date} ${tx.reference}"><span>${typeLabel(tx.type)} · ${tx.date}</span><strong>${txSign(tx.type)}${money(tx.amount)}</strong></a>`).join('');
    $list.html(rows||'<p>No hay movimientos de demostración.</p>');
  }

  function renderDetail(transactions){
    if(!$('#transaction-detail').length)return;
    const id=new URLSearchParams(location.search).get('id');
    const tx=transactions.find(item=>item.id===id)||transactions[0];
    if(!tx)return;
    $('[data-transaction="amount"]').text(txSign(tx.type)+money(tx.amount));
    $('[data-transaction="type"]').text(typeLabel(tx.type));
    $('[data-transaction="date"]').text(tx.date);
    $('[data-transaction="status"]').text(tx.status==='completed'?'Confirmada':tx.status);
    $('[data-transaction="reference"]').text(tx.reference);
  }

  function refresh(){
    renderUser();
    const transactions=plcData?.transactions||[];
    renderHistory(transactions);
    renderDetail(transactions);
  }

  async function loadDemoData(){
    try{
      const response=await fetch(dataUrl,{cache:'no-store'});
      if(!response.ok)throw new Error('No se pudo cargar plc-demo.json');
      plcData=applyStoredState(await response.json());
      refresh();
    }catch(error){
      console.warn('PLC demo data:',error.message);
      $('.js-demo-status').text('Demo sin conexión al archivo de datos.');
    }
  }

  $('.menu-toggle').on('click',function(){const open=$menu.toggleClass('open').hasClass('open');$(this).attr('aria-expanded',open)});
  $menu.find('a').on('click',()=>{$menu.removeClass('open');$('.menu-toggle').attr('aria-expanded','false')});
  $('[data-copy]').on('click',async function(){const $button=$(this),value=$($button.data('copy')).text().trim(),old=$button.text();try{await navigator.clipboard.writeText(value);$button.text('Copiado')}catch(e){$button.text('Copia manualmente')}setTimeout(()=>$button.text(old),1400)});
  $('.js-max').on('click',function(){const balance=Number($(this).attr('data-balance')??plcData?.users?.[0]?.balance??0);$('#amount').val(balance.toFixed(2)).trigger('input')});

  $('.js-send').on('click',function(e){
    e.preventDefault();
    const to=$('#recipient').val()?.trim(),amount=parseFloat($('#amount').val()),user=plcData?.users?.[0],balance=Number(user?.balance??0),$message=$('.form-message');
    if(!to||!Number.isFinite(amount)||amount<=0){$message.text('Completa un destinatario y un monto válido.');return}
    if(amount>balance){$message.text('El monto supera tu saldo disponible.');return}
    const tx={id:makeId('tx-demo'),userId:user.id,type:'sent',amount:Number(amount.toFixed(2)),date:today(),status:'completed',reference:makeId('PLC-DEMO').toUpperCase(),recipient:to};
    user.balance=Number((balance-amount).toFixed(2));
    plcData.transactions=[tx,...(plcData.transactions||[])];
    saveState();
    location.href=`detalle.html?id=${encodeURIComponent(tx.id)}`;
  });

  $('.js-topup').on('submit',function(e){
    e.preventDefault();
    const amount=parseFloat($('#topup-amount').val()),method=$('#topup-method').val(),user=plcData?.users?.[0],$message=$(this).find('.form-message');
    if(!user){$message.text('No se pudo cargar el usuario demo.');return}
    if(!Number.isFinite(amount)||amount<=0){$message.text('Ingresa un monto mayor que 0.');return}
    const tx={id:makeId('tx-demo'),userId:user.id,type:'topup',amount:Number(amount.toFixed(2)),date:today(),status:'completed',reference:makeId('PLC-TOPUP').toUpperCase(),method};
    user.balance=Number((Number(user.balance)+amount).toFixed(2));
    plcData.transactions=[tx,...(plcData.transactions||[])];
    saveState();
    $message.text('Carga simulada correctamente. Nuevo balance: '+money(user.balance));
    $('#topup-amount').val('');
    refresh();
  });

  $('.tabs [role="tab"]').on('click',function(){$(this).attr('aria-selected','true').siblings('[role="tab"]').attr('aria-selected','false')});
  $('.form-stack .btn[type="button"]').not('.js-max').on('click',function(){const $button=$(this),old=$button.text();$button.text('Cambios guardados');setTimeout(()=>$button.text(old),1400)});
  $('#transaction-search').on('input',function(){const q=$(this).val().trim().toLowerCase();$('#transaction-list .transaction-row').each(function(){$(this).toggle($(this).attr('data-search').toLowerCase().includes(q))})});
  loadDemoData();
});