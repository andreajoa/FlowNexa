const enc=new TextEncoder();
const hex=buf=>Array.from(new Uint8Array(buf),x=>x.toString(16).padStart(2,'0')).join('');
export const nowSeconds=()=>Math.floor(Date.now()/1000);
export const sha=async value=>hex(await crypto.subtle.digest('SHA-256',enc.encode(value)));
export const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
// Vercel Node uses 600000 PBKDF2-SHA256 iterations; retain explicit legacy versions.
// Versioned hashes allow future work-factor upgrades without guessing old parameters.
async function derive(password,salt,iterations){const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations,hash:'SHA-256'},key,256));}
export async function passwordHash(password,salt=crypto.randomUUID()){return `pbkdf2-sha256$600000$${salt}$${await derive(password,salt,600000)}`;}
export async function verifyPassword(password,stored){
 if(typeof stored!=='string')return false;
 let computed;
 if(stored.startsWith('pbkdf2-sha256$')){const [algorithm,work,salt,digest]=stored.split('$');if(algorithm!=='pbkdf2-sha256'||!['100000','600000'].includes(work)||!salt||!/^[a-f0-9]{64}$/.test(digest||''))return false;computed=`pbkdf2-sha256$${work}$${salt}$${await derive(password,salt,Number(work))}`;}
 else if(stored.includes(':')){const [salt,digest]=stored.split(':');if(!/^[a-f0-9]{64}$/.test(digest||''))return false;computed=salt+':'+await derive(password,salt,210000);}
 else return false;
 const x=enc.encode(stored),y=enc.encode(computed);let difference=x.length^y.length;for(let i=0;i<Math.max(x.length,y.length);i++)difference|=(x[i]||0)^(y[i]||0);return difference===0;
}
export function cookieToken(request){return(request.headers.get('cookie')||'').match(/(?:^|;\s*)fn_session=([^;]+)/)?.[1]||null;}
export async function getSessionUser(request,env){const token=cookieToken(request);if(!token||token.length>200||!env.DB)return null;return env.DB.prepare('SELECT u.id,u.email,u.email_verified_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id_hash=? AND s.expires_at>? AND u.email_verified_at IS NOT NULL').bind(await sha(token),nowSeconds()).first();}
export async function requireMembership(db,userId,workspaceId,roles){if(!workspaceId||!userId)return null;const row=await db.prepare('SELECT workspace_id,user_id,role FROM memberships WHERE workspace_id=? AND user_id=?').bind(workspaceId,userId).first();return row&&(!roles||roles.includes(row.role))?row:null;}
export async function sessionFor(userId,env){const token=crypto.randomUUID()+crypto.randomUUID();await env.DB.prepare('INSERT INTO sessions(id_hash,user_id,expires_at) VALUES (?,?,?)').bind(await sha(token),userId,nowSeconds()+604800).run();return token;}
export function withCookie(response,token,clear=false){response.headers.set('set-cookie',`fn_session=${clear?'':token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${clear?0:604800}`);return response;}
export function sameOrigin(request){const origin=request.headers.get('origin');return Boolean(origin&&origin===new URL(request.url).origin);}
export async function payload(request,maxBytes=12000){if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw Object.assign(Error('invalid_content_type'),{status:415});if(Number(request.headers.get('content-length')||0)>maxBytes)throw Object.assign(Error('payload_too_large'),{status:413});if(!request.body)throw Error('invalid_payload');const reader=request.body.getReader();let size=0;const chunks=[];try{while(true){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw Object.assign(Error('payload_too_large'),{status:413});}chunks.push(value);}}finally{reader.releaseLock();}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}const parsed=JSON.parse(new TextDecoder().decode(bytes));if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('invalid_payload');return parsed;}
// Atomic counters are shared between isolates; raw addresses are never stored.
export async function rateLimit(request,env,operation,email=''){const ip=request.headers.get('cf-connecting-ip')||'unknown';const window=Math.floor(nowSeconds()/900)*900;const buckets=[[`ip:${ip}`,operation==='login'?30:20]];if(email)buckets.push([`email:${email}`,operation==='login'?10:5]);for(const[identity,limit]of buckets){const key=await sha(`${operation}:${identity}`);const row=await env.DB.prepare('INSERT INTO auth_rate_limits(key_hash,window_start,attempts) VALUES (?,?,1) ON CONFLICT(key_hash) DO UPDATE SET attempts=CASE WHEN auth_rate_limits.window_start=excluded.window_start THEN auth_rate_limits.attempts+1 ELSE 1 END,window_start=excluded.window_start RETURNING attempts').bind(key,window).first();if(row.attempts>limit)return false;}return true;}
