$(function(){
  const $menu=$('.main-nav');
  let plcData=null;
  const isPage=location.pathname.includes('/pages/');
  const dataUrl=isPage?'../data/plc-demo.json':'data/plc-demo.json';

  function money(value){return new Intl.NumberFormat('es-CL',{maximumFractionDigits:2}).format(value)+' PLC'}

  async function loadDemoData(){
    try{
      const response=await fetch(dataUrl,{cache:'no-store'});
      if(!response.ok) throw new Error('No se pudo cargar plc-demo.json');
      plcData=await response.json();
      const user=plcData.users?.[0];
      if(!user) return;

      $('[data-plc="name"]').text(user.name);
      $('[data-plc="email"]').text(user.email);
      $('[data-plc="balance"]').text(money(user.balance));
      $('[data-plc="wallet"]').text(user.walletAddress);
      $('[data-plc="sessions"]').text(user.security?.activeSessions ?? 0);
      $('[data-plc="two-factor"]').text(user.security?.twoFactor?'Activado':'Desactivado');

      $('#wallet-address').text(user.walletAddress);
      $('.js-max').attr('data-balance',user.balance);
      document.dispatchEvent(new CustomEvent('plc:data',{detail:plcData}));
    }catch(error){
      console.warn('PLC demo data:',error.message);
      $('.js-demo-status').text('Demo sin conexión al archivo de datos.');
    }
  }

  $('.menu-toggle').on('click',function(){
    const open=$menu.toggleClass('open').hasClass('open');
    $(this).attr('aria-expanded',open);
  });
  $menu.find('a').on('click',()=>{$menu.removeClass('open');$('.menu-toggle').attr('aria-expanded','false')});

  $('[data-copy]').on('click',async function(){
    const $button=$(this),value=$($button.data('copy')).text().trim(),old=$button.text();
    try{await navigator.clipboard.writeText(value);$button.text('Copiado')}
    catch(e){$button.text('Copia manualmente')}
    setTimeout(()=>$button.text(old),1400);
  });

  $('.js-max').on('click',function(){
    const balance=Number($(this).attr('data-balance') ?? plcData?.users?.[0]?.balance ?? 2450);
    $('#amount').val(balance.toFixed(2)).trigger('input');
  });

  $('.js-send').on('click',function(e){
    e.preventDefault();
    const to=$('#recipient').val()?.trim();
    const amount=parseFloat($('#amount').val());
    const balance=Number(plcData?.users?.[0]?.balance ?? 2450);
    const $message=$('.form-message');
    if(!to||!Number.isFinite(amount)||amount<=0){$message.text('Completa un destinatario y un monto válido.');return}
    if(amount>balance){$message.text('El monto supera tu saldo disponible.');return}
    $message.text('Transacción preparada para confirmación (demo).');
  });

  $('.tabs [role="tab"]').on('click',function(){
    $(this).attr('aria-selected','true').siblings('[role="tab"]').attr('aria-selected','false');
  });

  $('.form-stack .btn[type="button"]').on('click',function(){
    const $button=$(this),old=$button.text();
    $button.text('Cambios guardados');setTimeout(()=>$button.text(old),1400);
  });

  loadDemoData();
});