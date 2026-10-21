import {encryptToken,decryptToken} from '../instagram-oauth.js';
import {sha} from '../identity.js';
import {ensureCommerceSchema} from './schema.js';
import {validateCredentials,probeStore,queryStore,registerWebhooks,removeWebhooks} from './providers.js';
import {fail} from './http.js';
export const safeStore=s=>({id:s.id,provider:s.provider,name:s.name,origin:s.origin,status:s.status,hooks_status:s.hooks_status,capabilities:JSON.parse(s.capabilities),updated_at:s.updated_at});
export async function ownedStore(env,workspace,id){await ensureCommerceSchema(env);const row=await env.DB.prepare('SELECT * FROM commerce_stores WHERE id=? AND workspace_id=?').bind(id,workspace).first();if(!row)throw fail('commerce_store_not_found',404);if(row.status!=='connected')throw fail('commerce_store_disconnected',409);return row;}
export async function credentialsFor(env,store){return JSON.parse(await decryptToken(store.encrypted_credentials,env.TOKEN_ENCRYPTION_KEY));}
export async function connectStore(env,workspace,provider,input){
 await ensureCommerceSchema(env);const c=validateCredentials(provider,input);
 const info=await probeStore(env,provider,c);if(!info.remote_id||!info.name)throw fail('commerce_invalid_response',502);
 const existing=await env.DB.prepare('SELECT id,workspace_id FROM commerce_stores WHERE provider=? AND remote_id=?').bind(provider,info.remote_id).first();
 if(existing&&existing.workspace_id!==workspace)throw fail('commerce_store_already_connected',409);
 if(provider==='woocommerce'&&!c.webhook_secret)c.webhook_secret=crypto.randomUUID()+crypto.randomUUID();
 const id=existing?.id||crypto.randomUUID(),now=Date.now();
 await env.DB.prepare("INSERT INTO commerce_stores(id,workspace_id,provider,remote_id,name,origin,encrypted_credentials,capabilities,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(provider,remote_id) DO UPDATE SET name=excluded.name,encrypted_credentials=excluded.encrypted_credentials,capabilities=excluded.capabilities,status='connected',hooks_status='not_configured',updated_at=excluded.updated_at WHERE commerce_stores.workspace_id=excluded.workspace_id").bind(id,workspace,provider,info.remote_id,String(info.name).slice(0,160),c.origin,await encryptToken(JSON.stringify(c),env.TOKEN_ENCRYPTION_KEY),JSON.stringify(info.capabilities),now,now).run();
 await env.DB.prepare('INSERT OR IGNORE INTO commerce_polling(store_id) VALUES(?)').bind(id).run();
 return safeStore(await ownedStore(env,workspace,id));
}
export async function readStore(env,workspace,id,operation,input){
 const row=await ownedStore(env,workspace,id),c=await credentialsFor(env,row),capability={order:'orders',tracking:'tracking',products:'products',abandoned_carts:'abandoned_carts',content:'content'}[operation];
 if(!capability||!JSON.parse(row.capabilities)[capability])throw fail('commerce_capability_unavailable',409);
 const result=await queryStore(env,row.provider,c,operation,input);
 // Persist renewed Shopify access tokens without touching a concurrently revoked connection.
 await env.DB.prepare("UPDATE commerce_stores SET encrypted_credentials=?,updated_at=? WHERE id=? AND workspace_id=? AND status='connected' AND encrypted_credentials=?").bind(await encryptToken(JSON.stringify(c),env.TOKEN_ENCRYPTION_KEY),Date.now(),id,workspace,row.encrypted_credentials).run();
 const still=await ownedStore(env,workspace,id);if(still.status!=='connected')throw fail('commerce_store_disconnected',409);
 return result;
}
export async function activateHooks(env,workspace,id,origin){
 const row=await ownedStore(env,workspace,id),c=await credentialsFor(env,row);
 if(!JSON.parse(row.capabilities).webhooks)throw fail('commerce_webhook_secret_required',409);
 // Existing subscriptions are reused, avoiding duplicate webhook registrations on repeat clicks.
 if(c.hook_ids?.length&&row.hooks_status==='active')return{status:'active',url:origin+'/webhooks/commerce/'+id};
 const url=origin+'/webhooks/commerce/'+id;
 if(row.provider==='wordpress')return{status:'plugin_required',url};
 const claimed=await env.DB.prepare("UPDATE commerce_stores SET hooks_status='registering',updated_at=? WHERE id=? AND status='connected' AND (hooks_status!='registering' OR updated_at<?) RETURNING id").bind(Date.now(),id,Date.now()-120000).first();if(!claimed)throw fail('commerce_hooks_busy',409);
 try{c.hook_ids=await registerWebhooks(env,row.provider,c,url,async()=>{await env.DB.prepare("UPDATE commerce_stores SET encrypted_credentials=? WHERE id=? AND status='connected'").bind(await encryptToken(JSON.stringify(c),env.TOKEN_ENCRYPTION_KEY),id).run();});await env.DB.prepare("UPDATE commerce_stores SET encrypted_credentials=?,hooks_status='active',updated_at=? WHERE id=? AND workspace_id=? AND status='connected'").bind(await encryptToken(JSON.stringify(c),env.TOKEN_ENCRYPTION_KEY),Date.now(),id,workspace).run();return{status:'active',url};}
 catch(error){await env.DB.prepare("UPDATE commerce_stores SET hooks_status='error' WHERE id=?").bind(id).run();throw error;}
}
export async function disconnectStore(env,workspace,id){
 const store=await ownedStore(env,workspace,id),credentials=await credentialsFor(env,store);
 await env.DB.batch([
  env.DB.prepare("UPDATE commerce_stores SET status='disconnected',encrypted_credentials='',hooks_status='disabled',updated_at=? WHERE id=? AND workspace_id=?").bind(Date.now(),id,workspace),
  env.DB.prepare('DELETE FROM commerce_identities WHERE store_id=?').bind(id),
  env.DB.prepare('DELETE FROM commerce_challenges WHERE store_id=?').bind(id),
  env.DB.prepare('UPDATE commerce_rules SET enabled=0 WHERE store_id=?').bind(id),
  env.DB.prepare("UPDATE commerce_deliveries SET status='cancelled',error='store_disconnected' WHERE store_id=? AND status='pending'").bind(id),
  env.DB.prepare('DELETE FROM commerce_events WHERE store_id=?').bind(id)
 ]);
 return {remote_cleanup_failed:await removeWebhooks({...env,COMMERCE_DEADLINE:Date.now()+10000},store.provider,credentials)};
}
export async function verifiedEmail(env,storeId,accountId,recipient){
 const r=await env.DB.prepare('SELECT * FROM commerce_identities WHERE store_id=? AND account_id=? AND recipient_hash=? AND verified_until>?').bind(storeId,accountId,await sha(recipient),Date.now()).first();
 if(!r)throw fail('commerce_customer_verification_required',403);
 return JSON.parse(await decryptToken(r.encrypted_identity,env.TOKEN_ENCRYPTION_KEY)).email;
}

export async function validateCommerceReferences(env,workspace,config){
 for(const node of config?.graph?.nodes||[])if(node.type==='commerce'){
  const store=await ownedStore(env,workspace,node.store_id),caps=JSON.parse(store.capabilities);
  const cap={products:'products',content:'content',order:'orders',tracking:'tracking',abandoned_carts:'abandoned_carts'}[node.operation];
  if(cap&&!caps[cap])throw fail('commerce_capability_unavailable',409);
 }
}
