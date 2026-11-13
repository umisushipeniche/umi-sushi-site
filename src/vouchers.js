// UMI SUSHI voucher API. Fail closed until D1 and Cloudflare Access settings are configured.
// This module does not change existing contact or analytics endpoints.
const J=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
const iso=()=>new Date().toISOString();
const day=()=>new Date().toISOString().slice(0,10);
const codeOk=s=>/^UMI-[A-F0-9]{32}$/.test(s||"");
const wait=(str)=>new TextEncoder().encode(str);
function decode(s){try{return JSON.parse(atob(s.replace(/-/g,"+").replace(/_/g,"/")))}catch{return null}}
function b64bytes(s){try{const bin=atob(s.replace(/-/g,"+").replace(/_/g,"/"));return Uint8Array.from(bin,c=>c.charCodeAt(0))}catch{return null}}
async function requireAdmin(request,env){
 const email=(env.VOUCHER_ADMIN_EMAIL||"").toLowerCase().trim();
 const domain=(env.VOUCHER_ACCESS_TEAM_DOMAIN||"").replace(/^https?:\/\//,"").replace(/\/$/,"");
 const audience=env.VOUCHER_ACCESS_AUD||"";
 if(!email||!domain||!audience) return null;
 const token=request.headers.get("Cf-Access-Jwt-Assertion");
 if(!token)return null;
 const parts=token.split(".");
 if(parts.length!==3)return null;
 const header=decode(parts[0]),payload=decode(parts[1]),sig=b64bytes(parts[2]);
 if(!header||!payload||!sig||header.alg!=="RS256"||typeof header.kid!=="string")return null;
 if(payload.iss!=="https://"+domain||!Array.isArray(payload.aud)||!payload.aud.includes(audience))return null;
 const now=Math.floor(Date.now()/1000);
 if(typeof payload.exp!=="number"||payload.exp<=now||typeof payload.nbf==="number"&&payload.nbf>now+60)return null;
 if(typeof payload.email!=="string"||payload.email.toLowerCase()!==email)return null;
 try{
  const reply=await fetch("https://"+domain+"/cdn-cgi/access/certs",{cf:{cacheTtl:300,cacheEverything:true}});
  if(!reply.ok)return null;
  const jwks=await reply.json();
  const jwk=(jwks.keys||[]).find(k=>k.kid===header.kid&&k.kty==="RSA");
  if(!jwk)return null;
  const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
  const valid=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,sig,wait(parts[0]+"."+parts[1]));
  return valid?email:null;
 }catch{return null}
}
function monthDate(s,m){const [y,mo,d]=s.split("-").map(Number);const z=new Date(Date.UTC(y,mo-1+m,1));const max=new Date(Date.UTC(z.getUTCFullYear(),z.getUTCMonth()+1,0)).getUTCDate();z.setUTCDate(Math.min(d,max));return z.toISOString().slice(0,10)}
const body=async request=>{if(Number(request.headers.get("content-length")||0)>2048)return null;try{return await request.json()}catch{return null}};
function info(r){return {code:r.code,kind:r.kind,meal:r.meal,people:r.people,amount_cents:r.amount_cents,issued_at:r.issued_at,expires_at:r.expires_at,status:r.status==="unused"&&r.expires_at<day()?"expired":r.status,created_at:r.created_at,redeemed_at:r.redeemed_at,cancelled_at:r.cancelled_at}}
const allowed=(request,url)=>{const origin=request.headers.get("origin");return !origin||origin===url.origin};
const cleanCode=code=>typeof code==="string"?code.trim().toUpperCase():"";
export async function voucherApi(request,env,url){
 if(!env.VOUCHER_DB)return J({error:"Voucher database not configured"},503);
 const path=url.pathname,method=request.method;
 // Public read-only endpoint. Codes are 128-bit cryptographically random bearer identifiers.
 if(path==="/api/voucher/verify"){
  if(method!=="GET")return J({error:"Method not allowed"},405);
  const code=cleanCode(url.searchParams.get("code"));
  if(!codeOk(code))return J({error:"Invalid code"},400);
  try{const row=await env.VOUCHER_DB.prepare("SELECT code,kind,meal,people,amount_cents,issued_at,expires_at,status FROM vouchers WHERE code=?").bind(code).first();
   return row?J({voucher:info(row)}):J({error:"Voucher not found"},404)
  }catch{return J({error:"Voucher service unavailable"},503)}
 }
 if(!path.startsWith("/api/vouchers"))return null;
 if(!allowed(request,url))return J({error:"Forbidden origin"},403);
 const actor=await requireAdmin(request,env);
 if(!actor)return J({error:"Unauthorized; Cloudflare Access required"},401);
 if(path==="/api/vouchers/me"&&method==="GET")return J({email:actor,role:"admin"});
 try{
  if(path==="/api/vouchers"&&method==="GET"){
   const result=await env.VOUCHER_DB.prepare("SELECT * FROM vouchers ORDER BY id DESC LIMIT 200").all();
   return J({vouchers:(result.results||[]).map(info)});
  }
  if(path==="/api/vouchers"&&method==="POST"){
   const b=await body(request);if(!b||!["value","meal"].includes(b.kind))return J({error:"Invalid voucher type"},400);
   const people=Number(b.people||1),meal=b.kind==="meal"?b.meal:null;
   if(!Number.isInteger(people)||people<1||people>20||b.kind==="meal"&&!["lunch","dinner"].includes(meal))return J({error:"Invalid meal"},400);
   const months=Number(b.months||12);if(!Number.isInteger(months)||months<1||months>24)return J({error:"Invalid validity"},400);
   let cents;
   if(b.kind==="value"){cents=Number(b.amount_cents);if(!Number.isInteger(cents)||cents<100||cents>100000)return J({error:"Invalid amount"},400)}
   else cents=(meal==="lunch"?1795:2295)*people;
   const issued=day(),expires=monthDate(issued,months),stamp=iso();
   const bytes=crypto.getRandomValues(new Uint8Array(16));
   const code="UMI-"+Array.from(bytes,x=>x.toString(16).padStart(2,"0")).join("").toUpperCase();
   const statement=env.VOUCHER_DB.prepare("INSERT INTO vouchers (code,kind,meal,people,amount_cents,issued_at,expires_at,status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'unused',?,?,?)").bind(code,b.kind,meal,people,cents,issued,expires,actor,stamp,stamp);
   const audit=env.VOUCHER_DB.prepare("INSERT INTO voucher_events(voucher_code,action,actor_email,occurred_at) VALUES (?,'created',?,?)").bind(code,actor,stamp);
   await env.VOUCHER_DB.batch([statement,audit]);
   return J({voucher:{code,kind:b.kind,meal,people,amount_cents:cents,issued_at:issued,expires_at:expires,status:"unused"}},201);
  }
  const match=path.match(/^\/api\/vouchers\/(UMI-[A-F0-9]{32})(?:\/(redeem|cancel))?$/);
  if(!match)return J({error:"Not found"},404);
  const code=match[1],action=match[2];
  if(!action&&method==="GET"){
   const row=await env.VOUCHER_DB.prepare("SELECT * FROM vouchers WHERE code=?").bind(code).first();
   if(!row)return J({error:"Voucher not found"},404);
   const ev=await env.VOUCHER_DB.prepare("SELECT action,actor_email,occurred_at FROM voucher_events WHERE voucher_code=? ORDER BY id DESC LIMIT 50").bind(code).all();
   return J({voucher:info(row),events:ev.results||[]});
  }
  if(method!=="POST"||!action)return J({error:"Method not allowed"},405);
  if(await body(request)===null)return J({error:"Invalid request"},400);
  const stamp=iso(),status=action==="redeem"?"used":"cancelled";
  // Atomic conditional update: only one concurrent request can transition from unused.
  const sql=action==="redeem"
    ?"UPDATE vouchers SET status='used',redeemed_at=?,updated_at=? WHERE code=? AND status='unused' AND expires_at>=?"
    :"UPDATE vouchers SET status='cancelled',cancelled_at=?,updated_at=? WHERE code=? AND status='unused'";
  const update=action==="redeem"
    ?env.VOUCHER_DB.prepare(sql).bind(stamp,stamp,code,day())
    :env.VOUCHER_DB.prepare(sql).bind(stamp,stamp,code);
  const result=await update.run();
  if(result.meta?.changes!==1)return J({error:"Voucher not found, already used, cancelled, or expired"},409);
  await env.VOUCHER_DB.prepare("INSERT INTO voucher_events(voucher_code,action,actor_email,occurred_at) VALUES (?,?,?,?)").bind(code,action==="redeem"?"redeemed":"cancelled",actor,stamp).run();
  return J({ok:true,code,status});
 }catch(e){console.error("Voucher database operation failed");return J({error:"Voucher service unavailable"},503)}
}
