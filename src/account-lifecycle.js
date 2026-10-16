import {decryptToken,encryptToken} from './instagram-oauth.js';
import {respond,nowSeconds} from './identity.js';

async function requireReconnect(env,account){
 const result=await env.DB.batch([
  env.DB.prepare("UPDATE flows SET enabled=0,version=version+1 WHERE account_id=(SELECT id FROM instagram_accounts WHERE id=? AND status='connected' AND encrypted_token=?) AND enabled=1").bind(account.id,account.encrypted_token),
  env.DB.prepare("UPDATE instagram_accounts SET status='reconnect_required',encrypted_token=NULL,token_expires_at=NULL WHERE id=? AND status='connected' AND encrypted_token=?").bind(account.id,account.encrypted_token)
 ]);
 return Boolean(result[1].meta.changes);
}

// Official Instagram Login endpoint; never log request URLs or provider payloads.
export async function refreshAccounts(env){
 const summary={checked:0,refreshed:0,reconnect_required:0,failed:0,skipped:0};
 if(!env.DB||!env.TOKEN_ENCRYPTION_KEY)return{...summary,error:'configuration_required'};
 const now=nowSeconds();
 const result=await env.DB.prepare("SELECT id,encrypted_token,token_expires_at FROM instagram_accounts WHERE status='connected' AND encrypted_token IS NOT NULL AND token_expires_at<=? ORDER BY token_expires_at,id LIMIT 2").bind(now+7*86400).all();
 for(const account of result.results){
  summary.checked++;
  try{
   if(account.token_expires_at<=now){if(await requireReconnect(env,account))summary.reconnect_required++;else summary.skipped++;continue;}
   const token=await decryptToken(account.encrypted_token,env.TOKEN_ENCRYPTION_KEY);
   const url=new URL('https://graph.instagram.com/refresh_access_token');
   url.search=new URLSearchParams({grant_type:'ig_refresh_token',access_token:token}).toString();
   const response=await(env.META_FETCH||fetch)(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(15000)});
   const data=await response.json();
   if(Number(data.error?.code)===190){if(await requireReconnect(env,account))summary.reconnect_required++;else summary.skipped++;continue;}
   // Reject malformed lifetimes instead of making an invalid account appear healthy.
   if(!response.ok||typeof data.access_token!=='string'||!data.access_token||data.access_token.length>16384||!Number.isSafeInteger(data.expires_in)||data.expires_in<=0||data.expires_in>90*86400){summary.failed++;continue;}
   const expires=nowSeconds()+data.expires_in;
   if(expires<=account.token_expires_at){summary.failed++;continue;}
   const encrypted=await encryptToken(data.access_token,env.TOKEN_ENCRYPTION_KEY);
   const updated=await env.DB.prepare("UPDATE instagram_accounts SET encrypted_token=?,token_expires_at=? WHERE id=? AND status='connected' AND encrypted_token=?").bind(encrypted,expires,account.id,account.encrypted_token).run();
   if(updated.meta.changes)summary.refreshed++;else summary.skipped++;
  }catch{summary.failed++;}
 }
 return summary;
}

function decodeBase64Url(value){
 if(typeof value!=='string'||!value||!/^[A-Za-z0-9_-]+={0,2}$/.test(value))throw Error('invalid_signed_request');
 const base=value.replace(/-/g,'+').replace(/_/g,'/').replace(/=+$/,'');
 const padded=base+'='.repeat((4-base.length%4)%4);
 return Uint8Array.from(atob(padded),char=>char.charCodeAt(0));
}
async function boundedForm(request){
 if(Number(request.headers.get('content-length')||0)>16384)throw Object.assign(Error('payload_too_large'),{status:413});
 if(!request.body)throw Error('invalid_signed_request');
 const reader=request.body.getReader(),chunks=[];let length=0;
 try{while(true){const{done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>16384){await reader.cancel();throw Object.assign(Error('payload_too_large'),{status:413});}chunks.push(value);}}finally{reader.releaseLock();}
 const joined=new Uint8Array(length);let offset=0;for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.byteLength;}
 return new URLSearchParams(new TextDecoder('utf-8',{fatal:true}).decode(joined));
}

// Meta sends this callback server-to-server: authenticate the signed payload, not Origin.
export async function deauthorize(request,env){
 if(request.method!=='POST')return respond({error:'method_not_allowed'},405);
 if(!env.DB||!env.META_APP_SECRET)return respond({error:'configuration_required'},503);
 if(!/^application\/x-www-form-urlencoded(?:\s*;|$)/i.test(request.headers.get('content-type')||''))return respond({error:'invalid_content_type'},415);
 let userId;
 try{
  const form=await boundedForm(request);if(form.getAll('signed_request').length!==1)throw Error('invalid_signed_request');
  const signed=form.get('signed_request'),segments=signed.split('.');if(segments.length!==2)throw Error('invalid_signed_request');
  const signature=decodeBase64Url(segments[0]);if(signature.byteLength!==32)throw Error('invalid_signed_request');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.META_APP_SECRET),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('HMAC',key,signature,new TextEncoder().encode(segments[1])))throw Error('invalid_signed_request');
  const payload=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(decodeBase64Url(segments[1])));
  if(payload.algorithm!=='HMAC-SHA256'||typeof payload.user_id!=='string'||!/^\d{1,50}$/.test(payload.user_id))throw Error('invalid_signed_request');
  userId=payload.user_id;
 }catch(error){return respond({error:error.status===413?'payload_too_large':'invalid_signed_request'},error.status===413?413:403);}
 try{
  await env.DB.batch([
   env.DB.prepare('UPDATE flows SET enabled=0,version=version+1 WHERE account_id IN (SELECT id FROM instagram_accounts WHERE ig_user_id=?) AND enabled=1').bind(userId),
   env.DB.prepare("UPDATE instagram_accounts SET encrypted_token=NULL,token_expires_at=NULL,status='revoked' WHERE ig_user_id=?").bind(userId)
  ]);
  return respond({ok:true});
 }catch{return respond({error:'deauthorization_failed'},503);}
}
