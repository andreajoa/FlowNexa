import {landingPage} from "../src/landing.js";
import {landingClient} from "../src/landing-script.js";
// Vercel HTTP gateway for a Cloudflare Worker/D1 backend.
// Configure FLOWNEXA_WORKER_ORIGIN to the HTTPS origin of your Worker.
// Never proxy arbitrary URLs supplied by clients.
export const config={api:{bodyParser:false}};
const MAX_BODY=1024*1024;
export default async function handler(req,res){
 const pathname=new URL(req.url||"/","https://flownexa.invalid").pathname;
 if(req.method==="GET" && (pathname==="/"||pathname==="/landing.js")){
  const script=pathname==="/landing.js";
  res.statusCode=200;
  res.setHeader("content-type",script?"application/javascript; charset=utf-8":"text/html; charset=utf-8");
  res.setHeader("cache-control",script?"public, max-age=300":"public, max-age=60");
  res.setHeader("x-content-type-options","nosniff");
  if(!script)res.setHeader("content-security-policy","default-src 'self'; img-src 'self' https://images.unsplash.com; script-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
  return res.end(script?landingClient():landingPage());
 }

 let backend;
 try{backend=new URL(process.env.FLOWNEXA_WORKER_ORIGIN||"");if(backend.protocol!=="https:"||backend.username||backend.password||backend.pathname!=="/")throw Error("invalid")}
 catch{res.statusCode=503;return res.end("Backend not configured");}
 const host=req.headers.host;
 if(!host||/[\\/\s]/.test(host)){res.statusCode=400;return res.end("Invalid host");}
 const publicOrigin="https://"+host;
 const origin=req.headers.origin;
 if(origin && origin!==publicOrigin){res.statusCode=403;return res.end("Forbidden origin");}
 const path=String(req.url||"/");
 const target=new URL(path,backend);
 if(target.origin!==backend.origin){res.statusCode=400;return res.end("Invalid path");}
 const headers=new Headers();
 for(const key of ["accept","accept-language","content-type","cookie","x-hub-signature-256","user-agent"]){
  const value=req.headers[key];if(typeof value==="string")headers.set(key,value);
 }
 if(origin)headers.set("origin",backend.origin);
 if(req.headers["x-forwarded-proto"] && req.headers["x-forwarded-proto"]!=="https"){res.statusCode=403;return res.end("HTTPS required");}
 let body;
 if(!["GET","HEAD"].includes(req.method)){
  const chunks=[];let total=0;
  for await(const chunk of req){total+=chunk.length;if(total>MAX_BODY){res.statusCode=413;return res.end("Payload too large");}chunks.push(chunk)}
  body=Buffer.concat(chunks);
 }
 try{
  const response=await fetch(target,{method:req.method,headers,body,redirect:"manual",signal:AbortSignal.timeout(20000)});
  res.statusCode=response.status;
  for(const key of ["content-type","cache-control","set-cookie","content-security-policy","x-content-type-options"]){
    const value=response.headers.get(key);if(value)res.setHeader(key,value);
  }
  const location=response.headers.get("location");
  if(location){const url=new URL(location,backend);if(url.origin===backend.origin)res.setHeader("location",publicOrigin+url.pathname+url.search);}
  res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.statusCode=502;res.end("Backend temporarily unavailable")}
}
