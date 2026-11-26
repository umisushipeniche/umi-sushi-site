async function readLimitedJson(request, maxBytes) {
  if (!request.body) return { error: 'Invalid JSON', status: 400 };

  const reader = request.body.getReader();
  const bytes = new Uint8Array(maxBytes);
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.byteLength > maxBytes - length) {
        void reader.cancel().catch(() => {});
        return { error: 'Payload too large', status: 413 };
      }
      bytes.set(value, length);
      length += value.byteLength;
    }
    return { body: JSON.parse(new TextDecoder().decode(bytes.subarray(0, length))) };
  } catch {
    return { error: 'Invalid JSON', status: 400 };
  } finally {
    reader.releaseLock();
  }
}


// Anonymous click counters: Cloudflare Analytics Engine dataset; no visitor identifiers.
const ALLOWED_EVENTS=new Set(['page_view','takeaway','view_prices','call_phone','contact_submit_attempt','footer_phone','directions','instagram','facebook','gallery_previous','gallery_next','full_menu','booking_section','menu_section','contact_dialog','booking_whatsapp_attempt']);
async function trackClick(request,env,url){
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  const origin=request.headers.get('Origin');
  if(origin&&origin!==url.origin)return json({error:'Origin not allowed'},403);
  if(Number(request.headers.get('Content-Length')||0)>512)return json({error:'Payload too large'},413);
  const {body,error,status}=await readLimitedJson(request,512);if(error)return json({error},status);
  if(!body||!ALLOWED_EVENTS.has(body.event)||!['home','menu'].includes(body.page))return json({error:'Invalid event'},400);
  if(!env.UMI_CLICK_ANALYTICS)return json({enabled:false},202);
  try{env.UMI_CLICK_ANALYTICS.writeDataPoint({blobs:[body.event,body.page],doubles:[1]})}catch(e){console.error('Anonymous analytics write failed');return json({error:'Analytics unavailable'},503)}
  return json({ok:true});
}
// UMI SUSHI contact endpoint. Configure RESEND_API_KEY and CONTACT_FROM_EMAIL in Cloudflare.
const RECIPIENT='umisushi.peniche@gmail.com';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Stable UMI takeaway entrypoint. Change TAKEAWAY_REDIRECT_URL when the provider changes.
const DEFAULT_TAKEAWAY_REDIRECT_URL="https://pud.gostar.pro/go/?rid=52742&tid=-2&h5sty=5&preview=1&tpl_id=537";
function takeawayRedirect(request, env) {
  if (request.method !== 'GET' && request.method !== 'HEAD')
    return new Response('Method Not Allowed', {status:405, headers:{Allow:'GET, HEAD', 'Cache-Control':'no-store'}});
  const configured=env.TAKEAWAY_REDIRECT_URL||DEFAULT_TAKEAWAY_REDIRECT_URL;
  let location;
  try {
    location=new URL(configured);
    if (location.protocol!=='https:') throw Error('HTTPS redirect required');
  } catch {
    return new Response('Takeaway unavailable', {status:503, headers:{'Cache-Control':'no-store'}});
  }
  return new Response(null,{status:302,headers:{Location:location.toString(),'Cache-Control':'no-store, max-age=0','X-Robots-Tag':'noindex'}});
}
export default {async fetch(request,env){const url=new URL(request.url);if(url.pathname==='/takeaway'||url.pathname==='/takeaway/')return takeawayRedirect(request,env);if(url.pathname==='/api/event')return trackClick(request,env,url);if(url.pathname!=='/api/contact')return env.ASSETS.fetch(request);if(request.method!=='POST')return json({error:'Method not allowed'},405);if(!env.RESEND_API_KEY||!env.CONTACT_FROM_EMAIL)return json({error:'Mail service not configured'},503);const origin=request.headers.get('Origin');if(origin&&origin!==url.origin)return json({error:'Origin not allowed'},403);if(Number(request.headers.get('Content-Length')||0)>12000)return json({error:'Payload too large'},413);const {body,error,status}=await readLimitedJson(request,12000);if(error)return json({error},status);const {name,email,phone='',message,website='',consent}=body||{};if(website)return json({ok:true});if(typeof name!=='string'||name.trim().length<2||name.length>100||typeof email!=='string'||email.length>254||!/^\S+@\S+\.\S+$/.test(email)||typeof phone!=='string'||phone.length>30||typeof message!=='string'||message.trim().length<10||message.length>3000||consent!==true)return json({error:'Invalid fields'},400);const safeName=name.trim(),safeEmail=email.trim(),safePhone=phone.trim(),safeMessage=message.trim();const payload={from:env.CONTACT_FROM_EMAIL,to:[RECIPIENT],reply_to:safeEmail,subject:'UMI SUSHI — Novo contacto pelo website',text:'Nome: '+safeName+'\nEmail: '+safeEmail+'\nTelefone: '+(safePhone||'-')+'\n\nMensagem:\n'+safeMessage,html:'<h2>Novo contacto — UMI SUSHI</h2><p><strong>Nome:</strong> '+esc(safeName)+'</p><p><strong>Email:</strong> '+esc(safeEmail)+'</p><p><strong>Telefone:</strong> '+esc(safePhone||'-')+'</p><p><strong>Mensagem:</strong></p><p style="white-space:pre-wrap">'+esc(safeMessage)+'</p>'};try{const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify(payload)});if(!response.ok){console.error('Contact email provider returned status',response.status);return json({error:'Delivery failed'},502)}return json({ok:true})}catch(e){console.error('Contact email transport failed');return json({error:'Delivery failed'},502)}}};
