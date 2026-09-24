$(function(){
  const $menu=$('.main-nav');
  let plcData=null;
  const isPage=location.pathname.includes('/pages/');
  const dataUrl=isPage?'../data/plc-demo.json':'data/plc-demo.json';
  const money=value=>new Intl.NumberFormat('es-CL',{maximumFractionDigits:2}).format(value)+' PLC';
  const typeLabel=type=>type==='sent'?'Enviado':'Recibido';

  function renderHistory(transactions){
    const $list=$('#transaction-list');
    if(!$list.length)return;
    const rows=transactions.map(tx=>{
      const sign=tx.type==='sent'?'-':'+';
      return `<a class="transaction-row" href="detalle.html?id=${encodeURIComponent(tx.id)}" data-search="${typeLabel(tx.type)} ${tx.date} ${tx.reference}"><span>${typeLabel(tx.type)} · ${tx.date}</span><strong>${sign}${money(tx.amount)}</strong></a>`;
    }).join('');
    $list.html(rows||'<p>No hay movimientos de demostración.</p>');
  }

  function renderDetail(transactions){
    if(!$('#transaction-detail').length)return;
    const id=new URLSearchParams(location.search).get('id');
    const tx=transactions.find(item=>item.id===id)||transactions[0];
    if(!tx)return;
    const sign=tx.type==='sent'?'-':'+';
    $('[data-transaction="amount"]').text(sign+money(tx.amount));
    $('[data-transaction="type"]').text(typeLabel(tx.type));
    $('[data-transaction="date"]').text(tx.date);
    $('[data-transaction="status"]').text(tx.status==='completed'?'Confirmada':tx.status);
    $('[data-transaction="reference"]').text(tx.reference);
  }

  async function loadDemoData(){
    try{
      const response=await fetch(dataUrl,{cache:'no-store'});
      if(!response.ok)throw new Error('No se pudo cargar plc-demo.json');
      plcData=await response.json();
      const user=plcData.users?.[0];
      if(user){
        $('[data-plc="name"]').text(user.name); $('[data-plc="email"]').text(user.email);
        $('[data-plc="balance"]').text(money(user.balance)); $('[data-plc="wallet"]').text(user.walletAddress);
        $('[data-plc="sessions"]').text(user.security?.activeSessions??0);
        $('[data-plc="two-factor"]').text(user.security?.twoFactor?'Activado':'Desactivado');
        $('#wallet-address').text(user.walletAddress); $('.js-max').attr('data-balance',user.balance);
      }
      const transactions=plcData.transactions||[];
      renderHistory(transactions); renderDetail(transactions);
    }catch(error){
      console.warn('PLC demo data:',error.message);
      $('.js-demo-status').text('Demo sin conexión al archivo de datos.');
    }
  }

  $('.menu-toggle').on('click',function(){const open=$menu.toggleClass('open').hasClass('open');$(this).attr('aria-expanded',open)});
  $menu.find('a').on('click',()=>{$menu.removeClass('open');$('.menu-toggle').attr('aria-expanded','false')});
  $('[data-copy]').on('click',async function(){const $button=$(this),value=$($button.data('copy')).text().trim(),old=$button.text();try{await navigator.clipboard.writeText(value);$button.text('Copiado')}catch(e){$button.text('Copia manualmente')}setTimeout(()=>$button.text(old),1400)});
  $('.js-max').on('click',function(){const balance=Number($(this).attr('data-balance')??plcData?.users?.[0]?.balance??0);$('#amount').val(balance.toFixed(2)).trigger('input')});
  $('.js-send').on('click',function(e){e.preventDefault();const to=$('#recipient').val()?.trim(),amount=parseFloat($('#amount').val()),balance=Number(plcData?.users?.[0]?.balance??0),$message=$('.form-message');if(!to||!Number.isFinite(amount)||amount<=0){$message.text('Completa un destinatario y un monto válido.');return}if(amount>balance){$message.text('El monto supera tu saldo disponible.');return}location.href=`detalle.html?id=tx-demo-001`});
  $('.tabs [role="tab"]').on('click',function(){$(this).attr('aria-selected','true').siblings('[role="tab"]').attr('aria-selected','false')});
  $('.form-stack .btn[type="button"]').not('.js-max').on('click',function(){const $button=$(this),old=$button.text();$button.text('Cambios guardados');setTimeout(()=>$button.text(old),1400)});
  $('#transaction-search').on('input',function(){const q=$(this).val().trim().toLowerCase();$('#transaction-list .transaction-row').each(function(){$(this).toggle($(this).attr('data-search').toLowerCase().includes(q))})});
  loadDemoData();
});