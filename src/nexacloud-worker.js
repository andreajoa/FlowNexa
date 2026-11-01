/** NexaCloud production entry: same public pages as api/index.js, then the FlowNexa runtime on Workers. */
import runtime from "./index.js";
import {landingPagePt,landingPageEn,landingClientEn} from "./landing-en.js";
import {landingClient} from "./landing-script.js";
const BASE="https://flownex.online";
const ROBOTS="User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /webhooks/\nDisallow: /mcp\nDisallow: /app.js\nSitemap: "+BASE+"/sitemap.xml\n";
const SITEMAP='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+["/","/en","/privacy","/terms","/data-deletion"].map(p=>"  <url><loc>"+BASE+p+"</loc></url>").join("\n")+"\n</urlset>\n";
const LANDING_CSP="default-src 'self'; img-src 'self' https://images.unsplash.com; script-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'";
function page(body,type,extra={}){return new Response(body,{status:200,headers:{"content-type":type,"x-content-type-options":"nosniff",...extra}});}
export default {
 async fetch(request,env,ctx){
  const path=new URL(request.url).pathname;
  if(request.method==="GET"){
   if(path==="/robots.txt")return page(ROBOTS,"text/plain; charset=utf-8",{"cache-control":"public, max-age=3600"});
   if(path==="/sitemap.xml")return page(SITEMAP,"application/xml; charset=utf-8",{"cache-control":"public, max-age=3600"});
   if(["/","/en","/en/"].includes(path)){
    const en=path.startsWith("/en");
    return page(en?landingPageEn():landingPagePt(),"text/html; charset=utf-8",{"cache-control":"public, max-age=60","content-security-policy":LANDING_CSP});
   }
   if(path==="/landing.js"||path==="/en/landing.js")
    return page(path.startsWith("/en")?landingClientEn():landingClient(),"application/javascript; charset=utf-8",{"cache-control":"public, max-age=300"});
  }
  return runtime.fetch(request,env,ctx);
 },
 // Minute trigger (enabled in the cutover config): same call the old flownexa-runner made, without leaving the Worker.
 async scheduled(controller,env,ctx){
  if(typeof env.CRON_SECRET!=="string"||env.CRON_SECRET.length<24)throw new Error("scheduler_configuration_missing");
  const res=await runtime.fetch(new Request((env.PUBLIC_BASE_URL||BASE)+"/api/internal/tick",{method:"POST",headers:{authorization:"Bearer "+env.CRON_SECRET,"content-type":"application/json"},body:"{}"}),env,ctx);
  if(!res.ok)throw new Error("scheduler_tick_http_"+res.status);
 }
};
