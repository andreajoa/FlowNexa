import {randomInt} from 'node:crypto';
import {sha,rateLimit} from '../identity.js';
import {encryptToken,decryptToken} from '../instagram-oauth.js';
import {ownedStore,readStore,verifiedEmail} from './service.js';
import {fail} from './http.js';
const emailOf=s=>String(s||'').trim().toLowerCase();
export async function issueChallenge(env,context,email){
 email=emailOf(email);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw fail('commerce_invalid_email');
 if(!env.RESEND_API_KEY&&!env.COMMERCE_SEND_CODE)throw fail('commerce_email_not_configured',503);
 await ownedStore(env,context.workspace,context.store);
 const recipient=await sha(context.recipient),id=await sha('commerce-code:'+context.session+':'+context.step);
 let row=await env.DB.prepare('SELECT * FROM commerce_challenges WHERE id=?').bind(id).first();
 if(!row){
  const request=new Request('https://flownexa.invalid',{headers:{'cf-connecting-ip':context.account+':'+recipient}});
  if(!await rateLimit(request,env,'commerce_code',email))throw fail('commerce_verification_rate_limit',429);
  const code=String(randomInt(100000,1000000));
  await env.DB.prepare('INSERT OR IGNORE INTO commerce_challenges(id,store_id,account_id,recipient_hash,encrypted_email,code_hash,expires_at) VALUES(?,?,?,?,?,?,?)').bind(id,context.store,context.account,recipient,await encryptToken(JSON.stringify({email,code}),env.TOKEN_ENCRYPTION_KEY),await sha(id+':'+code+':'+env.TOKEN_ENCRYPTION_KEY),Date.now()+600000).run();
  row=await env.DB.prepare('SELECT * FROM commerce_challenges WHERE id=?').bind(id).first();
 }
 if(row.expires_at<Date.now())throw fail('commerce_verification_expired',409);
 const saved=JSON.parse(await decryptToken(row.encrypted_email,env.TOKEN_ENCRYPTION_KEY));
 if(env.COMMERCE_SEND_CODE)await env.COMMERCE_SEND_CODE({email:saved.email,code:saved.code,id});
 else{const res=await(env.RESEND_FETCH||fetch)('https://api.resend.com/emails',{method:'POST',headers:{authorization:'Bearer '+env.RESEND_API_KEY,'content-type':'application/json','idempotency-key':'commerce-'+id},body:JSON.stringify({from:env.RESEND_FROM||'FlowNexa <hello@flownex.online>',to:[saved.email],subject:'Confirme seu acesso aos pedidos da loja',text:'Seu código de verificação FlowNexa é '+saved.code+'. Ele expira em 10 minutos. Informe o código apenas na conversa da loja em que você solicitou a consulta. Se não foi você, ignore este e-mail.'}),signal:AbortSignal.timeout(10000)});if(!res.ok)throw fail('commerce_verification_email_failed',502);}
 return id;
}
export async function confirmChallenge(env,context,code){
 const recipient=await sha(context.recipient);const row=await env.DB.prepare('SELECT * FROM commerce_challenges WHERE id=? AND store_id=? AND account_id=? AND recipient_hash=? AND expires_at>? AND attempts<5').bind(context.challenge,context.store,context.account,recipient,Date.now()).first();
 if(!row)throw fail('commerce_invalid_verification',403);
 if(row.consumed_at){
  const saved=JSON.parse(await decryptToken(row.encrypted_email,env.TOKEN_ENCRYPTION_KEY));
  if(row.code_hash!==await sha(row.id+':'+String(code).trim()+':'+env.TOKEN_ENCRYPTION_KEY)||await verifiedEmail(env,context.store,context.account,context.recipient)!==saved.email)throw fail('commerce_invalid_verification',403);
  return saved.email;
 }
 const updated=await env.DB.prepare('UPDATE commerce_challenges SET attempts=attempts+1 WHERE id=? AND consumed_at IS NULL AND attempts<5 RETURNING attempts').bind(row.id).first();
 if(!updated||row.code_hash!==await sha(row.id+':'+String(code).trim()+':'+env.TOKEN_ENCRYPTION_KEY))throw fail('commerce_invalid_verification',403);
 const {email}=JSON.parse(await decryptToken(row.encrypted_email,env.TOKEN_ENCRYPTION_KEY));
 const identity=await encryptToken(JSON.stringify({email,recipient:context.recipient}),env.TOKEN_ENCRYPTION_KEY);
 // The verification claim and identity change commit together. A changed email never inherits marketing consent.
 const now=Date.now();
 await env.DB.batch([
  env.DB.prepare('INSERT INTO commerce_identities(store_id,account_id,recipient_hash,encrypted_identity,email_hash,verified_until,last_incoming_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM commerce_challenges WHERE id=? AND consumed_at IS NULL) ON CONFLICT(store_id,account_id,recipient_hash) DO UPDATE SET marketing_opt_in=CASE WHEN commerce_identities.email_hash=excluded.email_hash THEN commerce_identities.marketing_opt_in ELSE 0 END,encrypted_identity=excluded.encrypted_identity,email_hash=excluded.email_hash,verified_until=excluded.verified_until,last_incoming_at=excluded.last_incoming_at').bind(context.store,context.account,recipient,identity,await sha(email),now+3600000,Math.min(context.incomingAt||now,now),row.id),
  env.DB.prepare('UPDATE commerce_challenges SET consumed_at=? WHERE id=? AND consumed_at IS NULL').bind(now,row.id)
 ]);
 return email;
}
export async function observeCommerceInbound(env,account,event){
 if(!env.DB||!event.sender_id||!['dm','story'].includes(event.kind))return;
 // Existing installations without commerce storage keep working until first store setup/migration.
 try{await env.DB.prepare('UPDATE commerce_identities SET last_incoming_at=MAX(last_incoming_at,?),opted_out=CASE WHEN ?=1 THEN 1 ELSE opted_out END,marketing_opt_in=CASE WHEN ?=1 THEN 0 ELSE marketing_opt_in END WHERE account_id=? AND recipient_hash=?').bind(event.at,/^(sair|parar|cancelar|stop|unsubscribe)$/i.test((event.text||'').trim())?1:0,/^(sair|parar|cancelar|stop|unsubscribe)$/i.test((event.text||'').trim())?1:0,account.id,await sha(event.sender_id)).run();}catch(error){if(!/no such table/i.test(error.message))throw error;}
}
export async function commerceNode(env,row,state,node){
 const context={workspace:row.workspace_id,store:node.store_id,account:row.account_id,recipient:state.origin.sender_id,session:row.id,step:row.step_index,incomingAt:state.inbound?.at};
 await ownedStore(env,context.workspace,context.store);
 if(node.operation==='identify'){state.commerceChallenge=await issueChallenge(env,context,state.replyText);return 'Enviamos um código de 6 dígitos para o e-mail informado. Responda com o código para consultar seus pedidos. Ele expira em 10 minutos.';}
 if(node.operation==='verify'){await confirmChallenge(env,{...context,challenge:state.commerceChallenge},state.replyText);return 'E-mail confirmado. Agora envie o número do seu pedido.';}
 if(node.operation==='marketing_opt_in'){
  await verifiedEmail(env,node.store_id,row.account_id,context.recipient);
  if(!/^autorizo novidades e lembretes$/i.test(String(state.replyText).trim()))return 'Você não foi inscrito em novidades. Pode continuar usando o atendimento normalmente.';
  await env.DB.prepare('UPDATE commerce_identities SET marketing_opt_in=1,opted_out=0 WHERE store_id=? AND account_id=? AND recipient_hash=?').bind(node.store_id,row.account_id,await sha(context.recipient)).run();
  return 'Você autorizou novidades e lembretes desta loja neste canal. Para cancelar, responda SAIR. Os envios seguem a disponibilidade do canal.';
 }
 const input={search:node.search||'',reference:state.replyText};
 if(!['products','content'].includes(node.operation))input.email=await verifiedEmail(env,node.store_id,row.account_id,context.recipient);
 const result=await readStore(env,row.workspace_id,node.store_id,node.operation,input);
 if(result.products)return result.products.length?result.products.map(p=>p.name+(p.price?' · '+p.price:'')+(p.url?'\n'+p.url:'')).join('\n\n').slice(0,1000):'Não encontramos produtos publicados para essa consulta.';
 if(result.carts)return result.carts.length?result.carts.slice(0,3).map(c=>'Seu carrinho'+(c.recovery_url?': '+c.recovery_url:' está registrado. Peça ajuda à loja para retomá-lo.')).join('\n').slice(0,1000):'Não encontramos carrinhos recuperáveis para seu e-mail. Alguns registros podem demorar para aparecer.';
 if(!result.order)return 'Não encontramos um pedido com esse número para o e-mail verificado. Confira os dados ou fale com a equipe da loja.';
 const order=result.order;return ('Pedido '+order.reference+'\nStatus: '+order.status+(order.fulfillment?'\nEnvio: '+order.fulfillment:'')+'\n'+(order.tracking?.length?order.tracking.map(t=>[t.company,t.number,t.url].filter(Boolean).join(' · ')).join('\n'):'O código de rastreio ainda não está disponível na integração da loja.')).slice(0,1000);
}
