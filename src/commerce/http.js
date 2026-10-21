import {lookup} from 'node:dns/promises';
import {request as httpsRequest} from 'node:https';
import {isIP} from 'node:net';
export const fail=(code,status=400)=>Object.assign(Error(code),{status});
export function publicAddress(address){
 if(isIP(address)===6)return /^[23][0-9a-f]{3}:/i.test(address)&&!/^2002:/i.test(address)&&!/^2001:(?:0:|db8:|10:|20:)/i.test(address);
 if(isIP(address)!==4)return false;
 const [a,b]=address.split('.').map(Number);
 return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19)||a===192&&b===2||a===198&&b===51||a===203&&b===0);
}
export function storeOrigin(value){
 let u;try{u=new URL(value);}catch{throw fail('commerce_invalid_url');}
 if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||u.search||u.hash||u.pathname!=='/'||isIP(u.hostname)||!u.hostname.includes('.')||! /^[a-z0-9.-]+$/i.test(u.hostname)||/(?:^|\.)(?:local|localhost|internal|invalid|test)$/.test(u.hostname))throw fail('commerce_invalid_url');
 return u.origin;
}
// Pin the DNS answer to the socket: validating a hostname then using plain fetch permits DNS rebinding.
export async function commerceHttp(env,url,{method='GET',headers={},body}={}){
 const u=new URL(url);storeOrigin(u.origin);
 const timeout=Math.min(10000,(env.COMMERCE_DEADLINE||Date.now()+10000)-Date.now());
 if(timeout<250)throw fail('commerce_timeout',504);
 if(env.COMMERCE_FETCH){const r=await env.COMMERCE_FETCH(u.href,{method,headers,body,redirect:'error'});if(!r.ok)throw fail(r.status===401||r.status===403?'commerce_credentials_or_scope':r.status===429?'commerce_rate_limited':r.status===404?'commerce_resource_not_found':'commerce_provider_unavailable',r.status===429?429:r.status===404?404:502);return r.json();}
 const answers=await lookup(u.hostname,{all:true});if(!answers.length||answers.some(a=>!publicAddress(a.address)))throw fail('commerce_private_address');
 const answer=answers[0];
 return new Promise((resolve,reject)=>{
  const req=httpsRequest(u,{method,headers:{accept:'application/json',...headers},lookup:(host,options,callback)=>options.all?callback(null,[answer]):callback(null,answer.address,answer.family),timeout},res=>{
   let size=0;const chunks=[];
   res.on('data',chunk=>{size+=chunk.length;if(size>2*1024*1024){req.destroy(fail('commerce_response_too_large',502));return;}chunks.push(chunk);});
   res.on('end',()=>{if(res.statusCode<200||res.statusCode>=300){reject(fail(res.statusCode===401||res.statusCode===403?'commerce_credentials_or_scope':res.statusCode===429?'commerce_rate_limited':res.statusCode===404?'commerce_resource_not_found':'commerce_provider_unavailable',res.statusCode===429?429:res.statusCode===404?404:502));return;}try{resolve(chunks.length?JSON.parse(Buffer.concat(chunks).toString()):{});}catch{reject(fail('commerce_invalid_response',502));}});
  });const timer=setTimeout(()=>req.destroy(fail('commerce_timeout',504)),timeout);req.on('close',()=>clearTimeout(timer));req.on('timeout',()=>req.destroy(fail('commerce_timeout',504)));req.on('error',()=>reject(fail('commerce_provider_unavailable',502)));if(body)req.write(body);req.end();
 });
}
