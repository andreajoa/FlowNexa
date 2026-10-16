import {decryptToken} from './instagram-oauth.js';
export function messagingReady(env){return env.MESSAGING_ENABLED==='true'&&Boolean(env.META_APP_ID&&env.META_APP_SECRET&&env.META_WEBHOOK_SECRET&&env.TOKEN_ENCRYPTION_KEY);}
export async function metaRequest(env,account,path,{method='GET',body}={}){
 const remaining=env.RUNTIME_DEADLINE_MS?env.RUNTIME_DEADLINE_MS-Date.now()-1500:15000;
 if(remaining<1000){const error=Error('processing_deferred');error.deferred=true;error.retryable=true;throw error;}
 if(account.status!=='connected'||account.token_expires_at<=Date.now()/1000)throw Error('account_reconnect_required');
 const token=await decryptToken(account.encrypted_token,env.TOKEN_ENCRYPTION_KEY);
 const version=env.META_API_VERSION||'v24.0';if(!/^v\d+\.0$/.test(version))throw Error('invalid_meta_version');
 const url=new URL(`https://graph.instagram.com/${version}/${path}`);
 const headers={'authorization':'Bearer '+token};if(body)headers['content-type']='application/json';
 let response;try{response=await (env.META_FETCH||fetch)(url,{method,headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(Math.min(15000,remaining))});}catch(error){error.retryable=method==='GET';throw error;}
 let data;try{data=await response.json();}catch{throw Error(method==='POST'?'delivery_unknown':'meta_invalid_response');}
 if(!response.ok){const error=Error(data?.error?.code===190?'account_reconnect_required':response.status===429?'meta_rate_limited':response.status>=500&&method==='POST'?'delivery_unknown':'meta_request_rejected');error.retryable=response.status===429||response.status>=500&&method==='GET';throw error;}
 return data;
}
export async function sendAction(env,account,event,action){
 if(!messagingReady(env))throw Error('messaging_disabled');
 const age=Date.now()-event.at;if(age< -300000)throw Error('event_time_invalid');
 if(action.type==='private_reply'){
  if(event.kind!=='comment'||!/^\d+$/.test(event.comment_id||''))throw Error('invalid_comment');
  // Use the provider's comment timestamp, never webhook arrival time, for private replies.
  const comment=await metaRequest(env,account,`${event.comment_id}?fields=id,timestamp`);
  const time=Date.parse(comment.timestamp);if(!Number.isFinite(time)||Date.now()-time>7*86400000||time>Date.now()+300000)throw Error('private_reply_window_expired');
 }else if(action.type==='message'){
  if(!['dm','story'].includes(event.kind)||!/^\d+$/.test(event.sender_id||''))throw Error('invalid_recipient');
  if(age>86400000)throw Error('message_window_expired');
 }else if(action.type!=='public_reply')throw Error('unsupported_action');
 let result;
 try{
  if(action.type==='public_reply')result=await metaRequest(env,account,`${event.comment_id}/replies`,{method:'POST',body:{message:action.text}});
  else result=await metaRequest(env,account,`${account.ig_user_id}/messages`,{method:'POST',body:{recipient:action.type==='private_reply'?{comment_id:event.comment_id}:{id:event.sender_id},message:{text:action.text}}});
 }catch(error){if(error.name==='TimeoutError'||error.name==='AbortError'||error instanceof TypeError)throw Error('delivery_unknown');throw error;}
 const id=result.message_id||result.id;if(typeof id!=='string'||!id.trim())throw Error('delivery_unknown');
 return id;
}
