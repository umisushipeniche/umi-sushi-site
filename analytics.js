/* UMI anonymous button analytics: no names, phone numbers, form contents, cookies or IDs. */
(()=>{
  'use strict';
  if(navigator.doNotTrack==='1'||navigator.globalPrivacyControl===true)return;
  const rules=[
    ['#headerTakeaway','takeaway'],
    ['#priceToggle','view_prices'],
    ['#callBtn','call_phone'],
    ['#contactSubmit','contact_submit_attempt'],
    ['#footerPhoneLink','footer_phone'],
    ['#mapLink','directions'],
    ['#instagramLink','instagram'],
    ['#facebookLink','facebook'],
    ['#galleryPrev','gallery_previous'],
    ['#galleryNext','gallery_next'],
    ['a[href="menu.html"]','full_menu'],
    ['a[href="#booking"]','booking_section'],
    ['a[href="#menu"]','menu_section'],
    ['a[data-t="navContact"]','contact_dialog']
  ];
  function send(eventName){
    try{
      const payload=JSON.stringify({event:eventName,page:location.pathname.includes('menu')?'menu':'home'});
      fetch('/api/event',{method:'POST',headers:{'Content-Type':'application/json'},body:payload,keepalive:true,credentials:'omit'}).catch(()=>{});
    }catch(_){}
  }
  send('page_view');
  document.addEventListener('click',e=>{
    if(!(e.target instanceof Element))return;
    const el=e.target;
    if(el.closest('#bookingForm button[type="submit"]')){send('booking_whatsapp_attempt');return}
    for(const [selector,eventName] of rules){if(el.closest(selector)){send(eventName);return}}
  },{capture:true,passive:true});
})();
