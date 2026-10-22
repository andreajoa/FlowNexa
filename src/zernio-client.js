// Zernio owns the platform credential. Never treat its account ID as a Meta token.
export const isZernioAccount=account=>typeof account?.ig_user_id==='string'&&account.ig_user_id.startsWith('zernio:');
export const zernioAccountId=account=>{const id=account?.ig_user_id?.slice(7);if(!isZernioAccount(account)||!/^\w{1,100}$/.test(id))throw Error('account_reconnect_required');return id;};
export const accountUsable=account=>account?.status==='connected'&&(isZernioAccount(account)||Number(account.token_expires_at)>Date.now()/1000);
export async function zernioRequest(env,path,{method='GET',body}={}){
 if(!env.ZERNIO_API_KEY)throw Error('zernio_configuration_missing');
 const remaining=env.RUNTIME_DEADLINE_MS?env.RUNTIME_DEADLINE_MS-Date.now()-1500:15000;
 if(remaining<1000)throw Object.assign(Error('processing_deferred'),{deferred:true,retryable:true});
 const url=new URL('https://zernio.com/api/v1/'+path);
 if(url.origin!=='https://zernio.com'||!url.pathname.startsWith('/api/v1/'))throw Error('invalid_provider_path');
 let response;
 try{response=await(env.ZERNIO_FETCH||fetch)(url,{method,headers:{authorization:'Bearer '+env.ZERNIO_API_KEY,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(Math.min(15000,remaining))});}
 catch{throw Object.assign(Error(method==='GET'?'zernio_unavailable':'delivery_unknown'),{retryable:method==='GET'});}
 const data=await response.json().catch(()=>null);
 if(!response.ok){
  const auth=['TOKEN_EXPIRED','ACCOUNT_DISCONNECTED','account_disconnected'].includes(data?.code);
  const error=Error(method!=='GET'&&response.status>=500?'delivery_unknown':auth?'account_reconnect_required':response.status===429?'meta_rate_limited':'zernio_request_rejected');
  error.status=response.status;error.retryable=response.status===429||method==='GET'&&response.status>=500;throw error;
 }
 if(!data||typeof data!=='object')throw Error(method==='GET'?'zernio_invalid_response':'delivery_unknown');
 return data;
}
export async function zernioMedia(env,account){
 if(!accountUsable(account))throw Error('account_reconnect_required');
 const result=await zernioRequest(env,`accounts/${zernioAccountId(account)}/posts`);
 if(!Array.isArray(result.posts))throw Error('zernio_invalid_response');
 return result.posts.map(post=>({id:post.id,caption:post.message||'',media_type:post.mediaType,permalink:post.permalink,thumbnail_url:post.picture}));
}
export async function zernioSend(env,account,event,action){
 if(!accountUsable(account))throw Error('account_reconnect_required');
 const accountId=zernioAccountId(account),age=Date.now()-event.at;
 if(!Number.isFinite(age)||age< -300000)throw Error('event_time_invalid');
 let path,body={accountId};
 if(['private_reply','public_reply'].includes(action.type)){
  if(event.kind!=='comment'||!/^\d{1,100}$/.test(event.comment_id||'')||!/^\d{1,100}$/.test(event.media_id||''))throw Error('invalid_comment');
  if(action.type==='private_reply'&&age>7*86400000)throw Error('private_reply_window_expired');
  path=`inbox/comments/${encodeURIComponent(event.media_id)}`;
  if(action.type==='private_reply')path+=`/${encodeURIComponent(event.comment_id)}/private-reply`;
  else body.commentId=event.comment_id;
  body.message=action.text;if(action.type==='private_reply'&&action.quick_replies)body.quickReplies=action.quick_replies;
 }else{
  if(!['dm','story'].includes(event.kind)||!/^\d{1,100}$/.test(event.sender_id||'')||typeof event.conversation_id!=='string'||!event.conversation_id||event.conversation_id.length>1000)throw Error('invalid_recipient');
  if(age>86400000)throw Error('message_window_expired');
  path=`inbox/conversations/${encodeURIComponent(event.conversation_id)}/messages`;
  if(action.type==='message'){body.message=action.text;if(action.quick_replies)body.quickReplies=action.quick_replies;}
  else if(['image','video','audio'].includes(action.type)){body.attachmentUrl=action.url;body.attachmentType=action.type;}
  // Generic card preserves FlowNexa's 80-character heading, unlike the 640-char button template.
  else if(action.type==='buttons')body.template={type:'generic',elements:[{title:action.text,buttons:action.buttons.map(button=>({...button,type:button.type==='web_url'?'url':'postback'}))}]};
  else throw Error('unsupported_action');
 }
 const result=await zernioRequest(env,path,{method:'POST',body});
 const id=result.data?.messageId||result.data?.commentId||result.messageId||result.message?.platformMessageId||result.message?.id||result.comment?.id||result.id;
 if(typeof id!=='string'||!id.trim())throw Error('delivery_unknown');
 return id;
}
