import test from "node:test";
import assert from "node:assert/strict";
import {outboundAuthorized,sendCommentReply,sendPrivateReply} from "../src/meta-delivery.js";
const env={APP_MODE:"production",MESSAGING_ENABLED:"true",META_LIVE_SEND_APPROVED:"true",META_API_VERSION:"v22.0"};
test("outbound always fails closed without all approval signals",async()=>{
 let called=false;const fetcher=async()=>{called=true;throw Error("must never send")};
 for(const settings of [{...env,MESSAGING_ENABLED:"false"},{...env,META_LIVE_SEND_APPROVED:"false"},{...env,APP_MODE:"development"},env]){
  const result=await sendCommentReply(settings,{commentId:"123",text:"Hello",accessToken:"token"},{fetcher});
  assert.equal(result.error,"sending_disabled");
 }
 assert.equal(called,false);
});
test("public comment reply uses correct path and validated fields",async()=>{
 let url,request;
 const fetcher=async(u,o)=>{url=u;request=o;return {ok:true,json:async()=>({id:"reply-1"})}};
 const result=await sendCommentReply(env,{commentId:"123",text:"Thank you",accessToken:"test-token"},{authorized:true,fetcher});
 assert.equal(result.ok,true);assert.ok(url.endsWith("/123/replies"));
 assert.equal(new URLSearchParams(request.body).get("message"),"Thank you");
});
test("private reply uses comment recipient and bearer token",async()=>{
 let options;const fetcher=async(u,o)=>{options=o;return {ok:true,json:async()=>({message_id:"m1"})}};
 const result=await sendPrivateReply(env,{commentId:"123",text:"Hello",accessToken:"token"},{authorized:true,fetcher});
 assert.equal(result.ok,true);assert.equal(JSON.parse(options.body).recipient.comment_id,"123");
 assert.equal(options.headers.authorization,"Bearer token");
});
test("API errors do not expose response secrets and rate limits can retry",async()=>{
 const fetcher=async()=>({ok:false,status:429,json:async()=>({error:{message:"sensitive"}})});
 const result=await sendCommentReply(env,{commentId:"123",text:"Hello",accessToken:"token"},{authorized:true,fetcher});
 assert.deepEqual(result,{ok:false,error:"meta_api_error",status:429,retryable:true});
});
