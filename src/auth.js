import {respond,passwordHash,verifyPassword,getSessionUser,requireMembership,cookieToken,sessionFor,withCookie,sameOrigin,payload,rateLimit,sha,nowSeconds} from './identity.js';
import {sendIdentityEmail} from './transactional-email.js';
export {passwordHash,verifyPassword} from './identity.js';
const normalizedEmail=value=>typeof value==='string'?value.trim().toLowerCase():'';
const validEmail=email=>email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validPassword=password=>typeof password==='string'&&password.length>=12&&password.length<=200;
const generic=()=>respond({ok:true},202);
const tokenValue=value=>typeof value==='string'&&/^[a-f0-9-]{72}$/.test(value)?value:null;
async function issueToken(env,userId,purpose,email,locale){
 const token=crypto.randomUUID()+crypto.randomUUID(),tokenHash=await sha(token),now=nowSeconds();
 await env.DB.prepare('INSERT INTO auth_tokens(token_hash,user_id,purpose,expires_at,created_at) VALUES (?,?,?,?,?)').bind(tokenHash,userId,purpose,now+(purpose==='reset_password'?1800:86400),now).run();
 // Keep the token after an uncertain provider response: an accepted email may still arrive.
 // Provider idempotency prevents duplicates when replaying a request with the same token.
 await sendIdentityEmail(env,{email,purpose,token,tokenHash,locale});
}
async function readToken(env,token,purpose){return env.DB.prepare('SELECT user_id FROM auth_tokens WHERE token_hash=? AND purpose=? AND consumed_at IS NULL AND expires_at>?').bind(await sha(token),purpose,nowSeconds()).first();}
export async function accountApi(request,env){
 if(!env.DB)return respond({error:'database_unavailable'},503);
 if(request.method!=='GET'&&!sameOrigin(request))return respond({error:'invalid_origin'},403);
 const url=new URL(request.url),path=url.pathname;
 try{
  if(path==='/api/auth/register'&&request.method==='POST'){
   const b=await payload(request),email=normalizedEmail(b.email);
   if(!await rateLimit(request,env,'register',email))return respond({error:'rate_limited'},429);
   if(!validEmail(email)||!validPassword(b.password))return respond({error:'invalid_registration'},400);
   if(!env.RESEND_API_KEY)return respond({error:'email_configuration_missing'},503);
   const existing=await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first();
   if(existing)return respond({ok:true,verification_required:true},202);
   const id=crypto.randomUUID(),workspace=crypto.randomUUID();
   const workspaceName=typeof b.workspace_name==='string'?b.workspace_name.trim().slice(0,100):'My workspace';
   const hash=await passwordHash(b.password);
   try{await env.DB.batch([
    env.DB.prepare('INSERT INTO users(id,email,password_hash) VALUES(?,?,?)').bind(id,email,hash),
    env.DB.prepare('INSERT INTO workspaces(id,name,owner_id) VALUES(?,?,?)').bind(workspace,workspaceName||'My workspace',id),
    env.DB.prepare("INSERT INTO memberships(workspace_id,user_id,role) VALUES(?,?,'owner')").bind(workspace,id)
   ]);}catch(error){if(/unique/i.test(String(error)))return respond({ok:true,verification_required:true},202);throw error;}
   await issueToken(env,id,'verify_email',email,b.locale);
   return respond({ok:true,verification_required:true},202);
  }
  if(path==='/api/auth/login'&&request.method==='POST'){
   const b=await payload(request),email=normalizedEmail(b.email);
   if(!await rateLimit(request,env,'login',email))return respond({error:'rate_limited'},429);
   if(!validEmail(email)||!validPassword(b.password))return respond({error:'invalid_credentials'},401);
   const user=await env.DB.prepare('SELECT id,email,password_hash,email_verified_at FROM users WHERE email=?').bind(email).first();
   // Perform the same PBKDF2 work for unknown addresses to reduce account enumeration.
   const valid=await verifyPassword(b.password,user?.password_hash||'pbkdf2-sha256$600000$flownexa-dummy-salt$'+ '0'.repeat(64));
   if(!user||!valid)return respond({error:'invalid_credentials'},401);
   if(!user.email_verified_at)return respond({error:'email_verification_required'},403);
   return withCookie(respond({user:{id:user.id,email:user.email,email_verified_at:user.email_verified_at}}),await sessionFor(user.id,env));
  }
  if((path==='/api/auth/resend-verification'||path==='/api/auth/forgot-password')&&request.method==='POST'){
   const b=await payload(request),email=normalizedEmail(b.email),purpose=path.endsWith('forgot-password')?'reset_password':'verify_email';
   if(!await rateLimit(request,env,purpose,email))return respond({error:'rate_limited'},429);
   if(!validEmail(email))return generic();
   if(!env.RESEND_API_KEY)return respond({error:'email_configuration_missing'},503);
   const user=await env.DB.prepare('SELECT id,email_verified_at FROM users WHERE email=?').bind(email).first();
   if(user&&(purpose==='verify_email'?!user.email_verified_at:Boolean(user.email_verified_at)))await issueToken(env,user.id,purpose,email,b.locale);
   return generic();
  }
  if(path==='/api/auth/verify-email'&&request.method==='POST'){
   const b=await payload(request);
   if(!await rateLimit(request,env,'verify'))return respond({error:'rate_limited'},429);
   const token=tokenValue(b.token);if(!token)return respond({error:'invalid_token'},400);
   const row=await readToken(env,token,'verify_email');if(!row)return respond({error:'invalid_token'},400);
   const hash=await sha(token),now=nowSeconds();
   const result=await env.DB.batch([
    env.DB.prepare("UPDATE users SET email_verified_at=COALESCE(email_verified_at,?) WHERE id=(SELECT user_id FROM auth_tokens WHERE token_hash=? AND purpose='verify_email' AND consumed_at IS NULL AND expires_at>?)").bind(now,hash,now),
    env.DB.prepare("UPDATE auth_tokens SET consumed_at=? WHERE user_id=? AND purpose='verify_email' AND consumed_at IS NULL").bind(now,row.user_id)
   ]);
   if(!result[0].meta.changes)return respond({error:'invalid_token'},400);
   const user=await env.DB.prepare('SELECT id,email,email_verified_at FROM users WHERE id=?').bind(row.user_id).first();
   return withCookie(respond({ok:true,user}),await sessionFor(row.user_id,env));
  }
  if(path==='/api/auth/reset-password'&&request.method==='POST'){
   const b=await payload(request);
   if(!await rateLimit(request,env,'reset'))return respond({error:'rate_limited'},429);
   if(!validPassword(b.password))return respond({error:'invalid_password'},400);
   const token=tokenValue(b.token);if(!token)return respond({error:'invalid_token'},400);
   const row=await readToken(env,token,'reset_password');if(!row)return respond({error:'invalid_token'},400);
   const hash=await sha(token),now=nowSeconds(),password=await passwordHash(b.password);
   const result=await env.DB.batch([
    env.DB.prepare("UPDATE users SET password_hash=? WHERE id=(SELECT user_id FROM auth_tokens WHERE token_hash=? AND purpose='reset_password' AND consumed_at IS NULL AND expires_at>?)").bind(password,hash,now),
    env.DB.prepare("DELETE FROM sessions WHERE user_id=(SELECT user_id FROM auth_tokens WHERE token_hash=? AND purpose='reset_password' AND consumed_at IS NULL AND expires_at>?)").bind(hash,now),
    env.DB.prepare("UPDATE auth_tokens SET consumed_at=? WHERE user_id=? AND consumed_at IS NULL AND purpose='reset_password'").bind(now,row.user_id)
   ]);
   if(!result[0].meta.changes)return respond({error:'invalid_token'},400);
   return withCookie(respond({ok:true}),null,true);
  }
  if(path==='/api/auth/logout'&&request.method==='POST'){
   const token=cookieToken(request);if(token&&token.length<=200)await env.DB.prepare('DELETE FROM sessions WHERE id_hash=?').bind(await sha(token)).run();
   return withCookie(respond({ok:true}),null,true);
  }
  const user=await getSessionUser(request,env);if(!user)return respond({error:'unauthorized'},401);
  if(path==='/api/auth/me'&&request.method==='GET')return respond({user});
  if(path==='/api/workspaces'&&request.method==='GET'){
   const result=await env.DB.prepare('SELECT w.id,w.name,m.role FROM workspaces w JOIN memberships m ON m.workspace_id=w.id WHERE m.user_id=?').bind(user.id).all();
   return respond({workspaces:result.results});
  }
  if(path==='/api/accounts'&&request.method==='GET'){
   const workspace=url.searchParams.get('workspace');if(!workspace)return respond({error:'workspace_required'},400);
   if(!await requireMembership(env.DB,user.id,workspace))return respond({error:'forbidden'},403);
   const result=await env.DB.prepare('SELECT id,username,status FROM instagram_accounts WHERE workspace_id=?').bind(workspace).all();
   return respond({accounts:result.results});
  }
  return respond({error:'not_found'},404);
 }catch(error){
  if(error.message==='email_configuration_missing')return respond({error:'email_configuration_missing'},503);
  if(error.message==='email_delivery_unavailable'||error.name==='TimeoutError')return respond({error:'email_delivery_unavailable'},503);
  if(error.status)return respond({error:error.message},error.status);
  if(error instanceof SyntaxError)return respond({error:'invalid_payload'},400);
  return respond({error:'request_failed'},500);
 }
}
