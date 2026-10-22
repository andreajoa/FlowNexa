import {assertMessageCapacity} from './billing.js';
import {isZernioAccount,accountUsable,zernioSend} from './zernio-client.js';
import {validOutboundAction} from './conversation-graph.js';
import {decryptToken} from './instagram-oauth.js';
export function messagingReady(env,account){const meta=Boolean(env.META_APP_ID&&env.META_APP_SECRET&&env.META_WEBHOOK_SECRET),zernio=Boolean(env.ZERNIO_API_KEY&&env.ZERNIO_WEBHOOK_SECRET);return env.MESSAGING_ENABLED==='true'&&Boolean(env.TOKEN_ENCRYPTION_KEY)&&(account?(isZernioAccount(account)?zernio:meta):(meta||zernio));}
export async function metaRequest(env,account,path,{method='GET',body}={}){
 if(isZernioAccount(account))throw Error('wrong_account_provider');
 const remaining=env.RUNTIME_DEADLINE_MS?env.RUNTIME_DEADLINE_MS-Date.now()-1500:30000;
 if(remaining<1000){const error=Error('processing_deferred');error.deferred=true;error.retryable=true;throw error;}
 if(account.status!=='connected'||account.token_expires_at<=Date.now()/1000)throw Error('account_reconnect_required');
 const token=await decryptToken(account.encrypted_token,env.TOKEN_ENCRYPTION_KEY);
 const version=env.META_API_VERSION||'v24.0';if(!/^v\d+\.0$/.test(version))throw Error('invalid_meta_version');
 const url=new URL(`https://graph.instagram.com/${version}/${path}`);
 const headers={'authorization':'Bearer '+token};if(body)headers['content-type']='application/json';
 let response;try{response=await (env.META_FETCH||fetch)(url,{method,headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(Math.min(30000,remaining))});}catch(error){error.retryable=method==='GET';throw error;}
 let data;try{data=await response.json();}catch{throw Error(method==='POST'?'delivery_unknown':'meta_invalid_response');}
 if(!response.ok){const error=Error(data?.error?.code===190?'account_reconnect_required':response.status===429?'meta_rate_limited':response.status>=500&&method==='POST'?'delivery_unknown':'meta_request_rejected');error.retryable=response.status===429||response.status>=500&&method==='GET';throw error;}
 return data;
}
export async function sendAction(env,account,event,action){
 if(!messagingReady(env,account))throw Error('messaging_disabled');
 if(!validOutboundAction(action))throw Error('unsupported_action');
 if(!accountUsable(account))throw Error('account_reconnect_required');
 await assertMessageCapacity(env,account.workspace_id);
 if(isZernioAccount(account))return zernioSend(env,account,event,action);
 const age=Date.now()-event.at;if(age< -300000)throw Error('event_time_invalid');
 if(action.type==='private_reply'){
  if(event.kind!=='comment'||!/^\d+$/.test(event.comment_id||''))throw Error('invalid_comment');
  // Use the provider's comment timestamp, never webhook arrival time, for private replies.
  const comment=await metaRequest(env,account,`${event.comment_id}?fields=id,timestamp`);
  const time=Date.parse(comment.timestamp);if(!Number.isFinite(time)||Date.now()-time>7*86400000||time>Date.now()+300000)throw Error('private_reply_window_expired');
 }else if(['message','image','video','audio','buttons'].includes(action.type)){
  if(!['dm','story'].includes(event.kind)||!/^\d+$/.test(event.sender_id||''))throw Error('invalid_recipient');
  if(age>86400000)throw Error('message_window_expired');
 }else if(action.type!=='public_reply')throw Error('unsupported_action');
 let message={text:action.text};
 if(action.type==='message'&&action.quick_replies)message.quick_replies=action.quick_replies.map(({title,payload})=>({content_type:'text',title,payload}));
 if(['image','video','audio'].includes(action.type))message={attachment:{type:action.type,payload:{url:action.url}}};
 if(action.type==='buttons')message={attachment:{type:'template',payload:{template_type:'generic',elements:[{title:action.text,buttons:action.buttons.map(button=>button.type==='web_url'?{type:'web_url',title:button.title,url:button.url}:{type:'postback',title:button.title,payload:button.payload})}]}}};
 let result;
 try{
  if(action.type==='public_reply')result=await metaRequest(env,account,`${event.comment_id}/replies`,{method:'POST',body:{message:action.text}});
  else result=await metaRequest(env,account,`${account.ig_user_id}/messages`,{method:'POST',body:{recipient:action.type==='private_reply'?{comment_id:event.comment_id}:{id:event.sender_id},message}});
 }catch(error){if(error.name==='TimeoutError'||error.name==='AbortError'||error instanceof TypeError)throw Error('delivery_unknown');throw error;}
 const id=result.message_id||result.id;if(typeof id!=='string'||!id.trim())throw Error('delivery_unknown');
 return id;
}
