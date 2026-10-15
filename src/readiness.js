export function validateProductionConfiguration(env) {
 const missing=[];
 for(const key of ["META_APP_ID","META_APP_SECRET","META_VERIFY_TOKEN","META_REDIRECT_URI","TOKEN_ENCRYPTION_KEY","SESSION_SECRET"]) {
   if(!env[key])missing.push(key);
 }
 if(!env.DB)missing.push("DB");
 if(env.APP_MODE!=="production")missing.push("APP_MODE=production");
 if(env.MESSAGING_ENABLED!=="false" && !(env.MESSAGING_ENABLED==="true" && env.META_LIVE_SEND_APPROVED==="true"))missing.push("messaging kill switch or explicit approval required");
 if(env.META_REDIRECT_URI && (!env.META_REDIRECT_URI.startsWith("https://") || !new URL(env.META_REDIRECT_URI).pathname.endsWith("/api/instagram/callback")))missing.push("valid META_REDIRECT_URI");
 if(env.TOKEN_ENCRYPTION_KEY && !/^[a-f0-9]{64}$/i.test(env.TOKEN_ENCRYPTION_KEY))missing.push("TOKEN_ENCRYPTION_KEY (64 hex chars)");
 if(env.SESSION_SECRET && env.SESSION_SECRET.length<32)missing.push("SESSION_SECRET (at least 32 chars)");
 return {ready:missing.length===0,missing};
}
export function readyResponse(env) {
 const result=validateProductionConfiguration(env);
 return new Response(JSON.stringify({status:result.ready?"configured":"not_ready",liveMessaging:false,checks:{configuration:result.ready},missing:result.missing}),{
 status:result.ready?200:503,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}
 });
}
