import {createHmac,timingSafeEqual} from 'node:crypto';
import {sha,respond} from '../identity.js';
import {encryptToken} from '../instagram-oauth.js';
import {credentialsFor} from './service.js';
import {ensureCommerceSchema} from './schema.js';
export function validSignature(raw,signature,secret,encoding='base64'){
 if(!secret||typeof signature!=='string'||signature.length>128)return false;
 const expected=createHmac('sha256',secret).update(raw).digest(encoding),a=Buffer.from(expected),b=Buffer.from(signature);return a.length===b.length&&timingSafeEqual(a,b);
}
export async function commerceWebhook(request,env,id){
 if(request.method!=='POST')return respond({error:'method_not_allowed'},405);
 await ensureCommerceSchema(env);const store=await env.DB.prepare("SELECT * FROM commerce_stores WHERE id=? AND status='connected'").bind(id).first();if(!store)return respond({error:'not_found'},404);
 const chunks=[];let size=0;const reader=request.body?.getReader();if(!reader)return respond({error:'invalid_payload'},400);
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>262144){await reader.cancel();return respond({error:'payload_too_large'},413);}chunks.push(Buffer.from(value));}const raw=Buffer.concat(chunks),c=await credentialsFor(env,store);
 if(store.provider==='woocommerce'&&request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')&&/^webhook_id=\d+$/.test(raw.toString()))return respond({ping:true});
 const provider=store.provider;let topic,delivery,signature,secret,encoding='base64';
 if(provider==='shopify'){topic=request.headers.get('x-shopify-topic');delivery=request.headers.get('x-shopify-event-id')||request.headers.get('x-shopify-webhook-id');signature=request.headers.get('x-shopify-hmac-sha256');secret=c.webhook_secret||c.client_secret;if(request.headers.get('x-shopify-shop-domain')!==new URL(store.origin).hostname)return respond({error:'invalid_store'},403);}
 else if(provider==='woocommerce'&&!request.headers.has('x-flownexa-signature')){topic=request.headers.get('x-wc-webhook-topic');delivery=request.headers.get('x-wc-webhook-delivery-id');signature=request.headers.get('x-wc-webhook-signature');secret=c.webhook_secret;}
 else if(provider==='nuvemshop'){signature=request.headers.get('x-linkedstore-hmac-sha256');secret=c.webhook_secret||env.NUVEMSHOP_CLIENT_SECRET;encoding='hex';}
 else{signature=request.headers.get('x-flownexa-signature');secret=c.bridge_secret;encoding='hex';}
 if(!validSignature(raw,signature,secret,encoding))return respond({error:'invalid_signature'},401);
 let data;try{data=JSON.parse(raw);}catch{return respond({error:'invalid_payload'},400);}
 if(provider==='nuvemshop'){if(String(data.store_id)!==store.remote_id)return respond({error:'invalid_store'},403);topic=data.event;delivery=request.headers.get('x-webhook-id')||crypto.randomUUID();}
 if(request.headers.has('x-flownexa-signature')){if(!Number.isFinite(data.timestamp)||Math.abs(Date.now()-data.timestamp)>300000)return respond({error:'expired_event'},401);topic=data.event;delivery=data.id;}
 if(typeof topic!=='string'||topic.length>80||typeof delivery!=='string'||delivery.length>200)return respond({error:'invalid_event'},400);
 const eventId=await sha(store.id+':'+delivery),now=Date.now();
 await env.DB.prepare('INSERT OR IGNORE INTO commerce_events(id,store_id,topic,encrypted_payload,due_at,received_at) VALUES(?,?,?,?,?,?)').bind(eventId,id,topic,await encryptToken(raw.toString(),env.TOKEN_ENCRYPTION_KEY),now,now).run();
 if(['app/uninstalled'].includes(topic))await env.DB.prepare("UPDATE commerce_stores SET status='revoked',encrypted_credentials='',updated_at=? WHERE id=?").bind(now,id).run();
 return respond({received:true});
}
