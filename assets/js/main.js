$(function(){
  const $menu=$('.main-nav');
  $('.menu-toggle').on('click',function(){
    const open=$menu.toggleClass('open').hasClass('open');
    $(this).attr('aria-expanded',open);
  });

  $menu.find('a').on('click',()=>{$menu.removeClass('open');$('.menu-toggle').attr('aria-expanded','false')});

  $('[data-copy]').on('click',async function(){
    const $button=$(this),value=$($button.data('copy')).text().trim(),old=$button.text();
    try{
      await navigator.clipboard.writeText(value);
      $button.text('Copiado');
    }catch(e){
      $button.text('Copia manualmente');
    }
    setTimeout(()=>$button.text(old),1400);
  });

  $('.js-max').on('click',()=>$('#amount').val('2450.00').trigger('input'));

  $('.js-send').on('click',function(e){
    e.preventDefault();
    const to=$('#recipient').val()?.trim();
    const amount=parseFloat($('#amount').val());
    const $message=$('.form-message');
    if(!to||!Number.isFinite(amount)||amount<=0){
      $message.text('Completa un destinatario y un monto válido.');
      return;
    }
    if(amount>2450){
      $message.text('El monto supera tu saldo disponible.');
      return;
    }
    $message.text('Transacción preparada para confirmación (demo).');
  });

  $('.tabs [role="tab"]').on('click',function(){
    $(this).attr('aria-selected','true').siblings('[role="tab"]').attr('aria-selected','false');
  });

  $('.form-stack .btn[type="button"]').on('click',function(){
    const $button=$(this),old=$button.text();
    $button.text('Cambios guardados');
    setTimeout(()=>$button.text(old),1400);
  });
});