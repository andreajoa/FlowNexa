import {createHmac,timingSafeEqual} from 'node:crypto';
import {getSessionUser,requireMembership,sameOrigin,payload,sha,respond} from '../identity.js';
import {ensureCommerceSchema} from './schema.js';
import {commerceHttp,fail,storeOrigin} from './http.js';
import {connectStore} from './service.js';
export async function commerceOauth(request,env){
 const url=new URL(request.url);
 try{
  const user=await getSessionUser(request,env);if(!user)return respond({error:'unauthorized'},401);await ensureCommerceSchema(env);
  if(url.pathname.endsWith('/start')){
   if(request.method!=='POST'||!sameOrigin(request))throw fail('commerce_forbidden',403);
   const body=await payload(request),provider=body.provider,workspace=body.workspace_id;
   if(!await requireMembership(env.DB,user.id,workspace,['owner','admin']))throw fail('commerce_forbidden',403);
   if(!['shopify','nuvemshop'].includes(provider))throw fail('commerce_invalid_provider');
   const client=provider==='shopify'?env.SHOPIFY_CLIENT_ID:env.NUVEMSHOP_CLIENT_ID,secret=provider==='shopify'?env.SHOPIFY_CLIENT_SECRET:env.NUVEMSHOP_CLIENT_SECRET;
   if(!client||!secret)throw fail('commerce_oauth_not_configured',503);
   let shop='';if(provider==='shopify'){shop=storeOrigin(body.url);if(!/^https:\/\/[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop))throw fail('commerce_shopify_domain');}
   const state=crypto.randomUUID()+crypto.randomUUID();await env.DB.prepare('INSERT INTO commerce_oauth_states(state_hash,user_id,workspace_id,provider,shop,expires_at) VALUES(?,?,?,?,?,?)').bind(await sha(state),user.id,workspace,provider,shop,Date.now()+600000).run();
   const destination=provider==='shopify'?new URL(shop+'/admin/oauth/authorize'):new URL('https://www.tiendanube.com/apps/'+encodeURIComponent(client)+'/authorize');
   destination.searchParams.set('state',state);destination.searchParams.set('redirect_uri',url.origin+'/api/commerce/oauth/callback');
   if(provider==='shopify'){destination.searchParams.set('client_id',client);destination.searchParams.set('scope','read_products,read_orders');}
   return respond({url:destination.href});
  }
  const state=url.searchParams.get('state'),code=url.searchParams.get('code');if(!state||!code||code.length>2048)throw fail('commerce_invalid_oauth');
  const row=await env.DB.prepare('DELETE FROM commerce_oauth_states WHERE state_hash=? AND user_id=? AND expires_at>? RETURNING *').bind(await sha(state),user.id,Date.now()).first();
  if(!row||!await requireMembership(env.DB,user.id,row.workspace_id,['owner','admin']))throw fail('commerce_invalid_oauth',403);
  let credentials;
  if(row.provider==='shopify'){
   if('https://'+url.searchParams.get('shop')!==row.shop)throw fail('commerce_invalid_oauth',403);
   const params=[...url.searchParams].filter(([k])=>k!=='hmac'&&k!=='signature').sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('&');
   const expected=Buffer.from(createHmac('sha256',env.SHOPIFY_CLIENT_SECRET).update(params).digest('hex')),actual=Buffer.from(url.searchParams.get('hmac')||'');
   if(expected.length!==actual.length||!timingSafeEqual(expected,actual))throw fail('commerce_invalid_oauth',403);
   const t=await commerceHttp(env,row.shop+'/admin/oauth/access_token',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({client_id:env.SHOPIFY_CLIENT_ID,client_secret:env.SHOPIFY_CLIENT_SECRET,code})});
   credentials={url:row.shop,access_token:t.access_token,webhook_secret:env.SHOPIFY_CLIENT_SECRET};
  }else{
   const t=await commerceHttp(env,'https://www.tiendanube.com/apps/authorize/token',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({client_id:env.NUVEMSHOP_CLIENT_ID,client_secret:env.NUVEMSHOP_CLIENT_SECRET,grant_type:'authorization_code',code})});
   credentials={store_id:String(t.user_id),access_token:t.access_token,webhook_secret:env.NUVEMSHOP_CLIENT_SECRET};
  }
  await connectStore(env,row.workspace_id,row.provider,credentials);
  return Response.redirect(url.origin+'/app#commerce',303);
 }catch(e){return respond({error:e.message?.startsWith('commerce_')?e.message:'commerce_oauth_failed'},e.status||503);}
}
