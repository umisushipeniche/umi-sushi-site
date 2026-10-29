
// Anonymous click counters: Cloudflare Analytics Engine dataset; no visitor identifiers.
const ALLOWED_EVENTS=new Set(['takeaway','view_prices','call_phone','contact_submit_attempt','footer_phone','directions','instagram','facebook','gallery_previous','gallery_next','full_menu','booking_section','menu_section','contact_dialog','booking_whatsapp_attempt']);
async function trackClick(request,env,url){
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  const origin=request.headers.get('Origin');
  if(origin&&origin!==url.origin)return json({error:'Origin not allowed'},403);
  if(Number(request.headers.get('Content-Length')||0)>512)return json({error:'Payload too large'},413);
  let body;try{body=await request.json()}catch{return json({error:'Invalid JSON'},400)}
  if(!body||!ALLOWED_EVENTS.has(body.event)||!['home','menu'].includes(body.page))return json({error:'Invalid event'},400);
  if(!env.UMI_CLICK_ANALYTICS)return json({enabled:false},202);
  try{env.UMI_CLICK_ANALYTICS.writeDataPoint({blobs:[body.event,body.page],doubles:[1]})}catch(e){console.error('Anonymous analytics write failed');return json({error:'Analytics unavailable'},503)}
  return json({ok:true});
}
// UMI SUSHI contact endpoint. Configure RESEND_API_KEY and CONTACT_FROM_EMAIL in Cloudflare.
const RECIPIENT='umisushi.peniche@gmail.com';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export default {async fetch(request,env){const url=new URL(request.url);if(url.pathname==='/api/event')return trackClick(request,env,url);if(url.pathname!=='/api/contact')return env.ASSETS.fetch(request);if(request.method!=='POST')return json({error:'Method not allowed'},405);if(!env.RESEND_API_KEY||!env.CONTACT_FROM_EMAIL)return json({error:'Mail service not configured'},503);const origin=request.headers.get('Origin');if(origin&&origin!==url.origin)return json({error:'Origin not allowed'},403);if(Number(request.headers.get('Content-Length')||0)>12000)return json({error:'Payload too large'},413);let body;try{body=await request.json()}catch{return json({error:'Invalid JSON'},400)}const {name,email,phone='',message,website='',consent}=body||{};if(website)return json({ok:true});if(typeof name!=='string'||name.trim().length<2||name.length>100||typeof email!=='string'||email.length>254||!/^\S+@\S+\.\S+$/.test(email)||typeof phone!=='string'||phone.length>30||typeof message!=='string'||message.trim().length<10||message.length>3000||consent!==true)return json({error:'Invalid fields'},400);const safeName=name.trim(),safeEmail=email.trim(),safePhone=phone.trim(),safeMessage=message.trim();const payload={from:env.CONTACT_FROM_EMAIL,to:[RECIPIENT],reply_to:safeEmail,subject:'UMI SUSHI — Novo contacto pelo website',text:'Nome: '+safeName+'\nEmail: '+safeEmail+'\nTelefone: '+(safePhone||'-')+'\n\nMensagem:\n'+safeMessage,html:'<h2>Novo contacto — UMI SUSHI</h2><p><strong>Nome:</strong> '+esc(safeName)+'</p><p><strong>Email:</strong> '+esc(safeEmail)+'</p><p><strong>Telefone:</strong> '+esc(safePhone||'-')+'</p><p><strong>Mensagem:</strong></p><p style="white-space:pre-wrap">'+esc(safeMessage)+'</p>'};try{const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify(payload)});if(!response.ok){console.error('Contact email provider returned status',response.status);return json({error:'Delivery failed'},502)}return json({ok:true})}catch(e){console.error('Contact email transport failed');return json({error:'Delivery failed'},502)}}};
