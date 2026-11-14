// Isolated UMI voucher manager: PRIVATE API only. No guest or public verification endpoint.
const J=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
const iso=()=>new Date().toISOString();
const day=()=>new Date().toISOString().slice(0,10);
const codeOk=s=>/^UMI-[A-F0-9]{32}$/.test(s||"");
// Identity comes only from Cloudflare's verified Worker-level Access context.
async function requireAdmin(ctx,env){
 if(!ctx?.access?.getIdentity || !env.VOUCHER_ADMIN_EMAIL) return null;
 try{const ident=await ctx.access.getIdentity();const email=String(ident?.email||"").toLowerCase().trim();
 return email && email===env.VOUCHER_ADMIN_EMAIL.toLowerCase().trim()?email:null;}catch{return null}
}
function monthDate(s,m){const [y,mo,d]=s.split("-").map(Number);const z=new Date(Date.UTC(y,mo-1+m,1));const max=new Date(Date.UTC(z.getUTCFullYear(),z.getUTCMonth()+1,0)).getUTCDate();z.setUTCDate(Math.min(d,max));return z.toISOString().slice(0,10)}
const body=async request=>{if(Number(request.headers.get("content-length")||0)>2048)return null;try{return await request.json()}catch{return null}};
function info(r){return {code:r.code,kind:r.kind,meal:r.meal,people:r.people,amount_cents:r.amount_cents,issued_at:r.issued_at,expires_at:r.expires_at,status:r.status==="unused"&&r.expires_at<day()?"expired":r.status,created_at:r.created_at,redeemed_at:r.redeemed_at,cancelled_at:r.cancelled_at}}
const allowed=(request,url)=>{const origin=request.headers.get("origin");return !origin||origin===url.origin};
const cleanCode=code=>typeof code==="string"?code.trim().toUpperCase():"";
export async function voucherApi(request,env,url,ctx){
 if(!env.VOUCHER_DB)return J({error:"Voucher database not configured"},503);
 const path=url.pathname,method=request.method;
 if(!path.startsWith("/api/vouchers"))return J({error:"Not found"},404);
 if(!allowed(request,url))return J({error:"Forbidden origin"},403);
 const actor=await requireAdmin(ctx,env);
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
  // Batch is transactional in D1: the state change and audit event commit together.
  // The INSERT SELECT writes no audit event if the conditional UPDATE did not change the voucher.
  const audit=env.VOUCHER_DB.prepare("INSERT INTO voucher_events(voucher_code,action,actor_email,occurred_at) SELECT code,?,?,? FROM vouchers WHERE code=? AND status=? AND updated_at=?").bind(action==="redeem"?"redeemed":"cancelled",actor,stamp,code,status,stamp);
  const results=await env.VOUCHER_DB.batch([update,audit]);
  if(results[0]?.meta?.changes!==1)return J({error:"Voucher not found, already used, cancelled, or expired"},409);
  if(results[1]?.meta?.changes!==1)return J({error:"Audit log unavailable; contact administrator"},503);
  return J({ok:true,code,status});
 }catch(e){console.error("Voucher database operation failed");return J({error:"Voucher service unavailable"},503)}
}
