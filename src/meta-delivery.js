// Outbound Instagram API client. No outbound request may occur without explicit
// per-call authorization AND production messaging switch.
export function outboundAuthorized(env,options={}) {
 return env?.APP_MODE==="production" && env?.MESSAGING_ENABLED==="true" &&
 env?.META_LIVE_SEND_APPROVED==="true" && options.authorized===true;
}
export async function sendCommentReply(env,{commentId,text,accessToken},{authorized=false,fetcher=fetch}={}) {
 if(!outboundAuthorized(env,{authorized}))return {ok:false,error:"sending_disabled"};
 if(!/^[0-9]+$/.test(String(commentId||""))||!String(text||"").trim()||String(text).length>1000||!accessToken)return {ok:false,error:"invalid_input"};
 const endpoint="https://graph.instagram.com/"+encodeURIComponent(env.META_API_VERSION||"v22.0")+"/"+encodeURIComponent(commentId)+"/replies";
 const form=new URLSearchParams({message:text,access_token:accessToken});
 let response;
 try{response=await fetcher(endpoint,{method:"POST",body:form,headers:{"content-type":"application/x-www-form-urlencoded"}})}
 catch{return {ok:false,error:"network_error",retryable:true}};
 const payload=await response.json().catch(()=>({}));
 if(!response.ok)return {ok:false,error:"meta_api_error",status:response.status,retryable:response.status===429||response.status>=500};
 return {ok:true,id:String(payload.id||"")};
}
export async function sendPrivateReply(env,{commentId,text,accessToken},{authorized=false,fetcher=fetch}={}) {
 if(!outboundAuthorized(env,{authorized}))return {ok:false,error:"sending_disabled"};
 if(!/^[0-9]+$/.test(String(commentId||""))||!String(text||"").trim()||String(text).length>1000||!accessToken)return {ok:false,error:"invalid_input"};
 // Instagram private reply uses recipient.comment_id rather than a user DM identifier.
 const endpoint="https://graph.instagram.com/"+encodeURIComponent(env.META_API_VERSION||"v22.0")+"/me/messages";
 const body={recipient:{comment_id:String(commentId)},message:{text}};
 let response;
 try{response=await fetcher(endpoint,{method:"POST",headers:{authorization:"Bearer "+accessToken,"content-type":"application/json"},body:JSON.stringify(body)})}
 catch{return {ok:false,error:"network_error",retryable:true}};
 const payload=await response.json().catch(()=>({}));
 if(!response.ok)return {ok:false,error:"meta_api_error",status:response.status,retryable:response.status===429||response.status>=500};
 return {ok:true,id:String(payload.message_id||payload.id||"")};
}
