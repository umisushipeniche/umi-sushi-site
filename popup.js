/* UMI seasonal notice, configured in content/popup.json.
 * No tracking and no third-party dependencies.
 * Show only when enabled, in Lisbon date range, and the poster image loads.
 */
(()=>{'use strict';
  const overlay=document.getElementById('umiEventOverlay');
  const panel=document.getElementById('umiEventPanel');
  const title=document.getElementById('umiEventTitle');
  const image=document.getElementById('umiEventImage');
  const close=document.getElementById('umiEventClose');
  if(!overlay||!panel||!title||!image||!close)return;
  let previousFocus=null;
  let dismissKey='';
  const localDate=()=>{
    const pieces=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const parts=Object.fromEntries(pieces.filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
    return parts.year+'-'+parts.month+'-'+parts.day;
  };
  const wasDismissed=()=>{try{return sessionStorage.getItem(dismissKey)==='1'}catch{return false}};
  const rememberDismissal=()=>{try{sessionStorage.setItem(dismissKey,'1')}catch{}};
  function dismiss(){
    overlay.hidden=true;
    document.body.classList.remove('umiEventOpen');
    rememberDismissal();
    if(previousFocus&&previousFocus.isConnected)previousFocus.focus();
  }
  close.addEventListener('click',dismiss);
  overlay.addEventListener('click',e=>{if(e.target===overlay)dismiss()});
  document.addEventListener('keydown',e=>{
    if(overlay.hidden)return;
    if(e.key==='Escape'){e.preventDefault();dismiss()}
    if(e.key==='Tab'){
      e.preventDefault();close.focus();
    }
  });
  fetch('content/popup.json',{cache:'no-store'})
    .then(r=>{if(!r.ok)throw Error('notice configuration unavailable');return r.json()})
    .then(cfg=>{
      if(cfg.enabled!==true)return;
      const today=localDate();
      if(cfg.start_date&&today<cfg.start_date)return;
      if(cfg.end_date&&today>cfg.end_date)return;
      if(typeof cfg.image!=='string'||!/^assets\/[a-z0-9/_-]+\.(?:webp|png|jpe?g)$/i.test(cfg.image))return;
      dismissKey='umi-event-dismissed-'+String(cfg.id||cfg.image);
      if(wasDismissed())return;
      const en=document.documentElement.lang==='en';
      title.textContent=(en?cfg.title_en:cfg.title_pt)||cfg.title_pt||'UMI SUSHI';
      image.alt=(en?cfg.image_alt_en:cfg.image_alt_pt)||title.textContent;
      const preload=new Image();
      preload.onload=()=>{
        image.src=cfg.image;
        previousFocus=document.activeElement;
        overlay.hidden=false;
        close.focus({preventScroll:true});
      };
      preload.onerror=()=>{/* Do not display a broken poster. */};
      preload.src=cfg.image;
    }).catch(()=>{/* Promotional feature must not block the main website. */});
})();
