/** NexaCloud FlowNexa read-only staging adapter. No prod traffic or secrets. */
import app from "./index.js";
import {landingPagePt,landingPageEn,landingClientEn} from "./landing-en.js";
import {landingClient} from "./landing-script.js";
const pages=new Set(["/","/en","/en/","/landing.js","/en/landing.js"]);
const shell=new Set(["/app","/app/","/app.js","/privacy","/terms","/data-deletion"]);
const baseHeaders={"x-nexacloud-staging-revision":"github-branch-validation-01","x-robots-tag":"noindex, nofollow","x-content-type-options":"nosniff",
 "referrer-policy":"no-referrer","x-frame-options":"DENY","cache-control":"no-store"};
function response(body,status=200,extra={}){
 return new Response(body,{status,headers:{...baseHeaders,...extra}});
}
export default {async fetch(request,env,ctx){
 const path=new URL(request.url).pathname;
 if(request.method!=="GET"&&request.method!=="HEAD")return response("Read-only staging",403);
 if(path==="/robots.txt")return response("User-agent: *\nDisallow: /\n",200,
  {"content-type":"text/plain; charset=utf-8"});
 if(pages.has(path)){
  const en=path.startsWith("/en"),js=path.endsWith(".js");
  const body=js?(en?landingClientEn():landingClient()):(en?landingPageEn():landingPagePt());
  return response(request.method==="HEAD"?null:body,200,{
   "content-type":js?"application/javascript; charset=utf-8":"text/html; charset=utf-8",
   "content-security-policy":"default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self' https://images.unsplash.com data:; base-uri 'none'; frame-ancestors 'none'"
  });
 }
 if(shell.has(path)||path==="/api/health"){
  const upstream=await app.fetch(request,env,ctx);
  const headers=new Headers(upstream.headers);
  for(const [k,v] of Object.entries(baseHeaders))headers.set(k,v);
  return new Response(request.method==="HEAD"?null:upstream.body,
   {status:upstream.status,statusText:upstream.statusText,headers});
 }
 return response("Not found in staging",404);
}};
