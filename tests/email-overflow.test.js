import test from 'node:test';
import assert from 'node:assert/strict';
import {deliverEmail} from '../src/transactional-email.js';

const json=(o,status=200)=>new Response(JSON.stringify(o),{status,headers:{'content-type':'application/json'}});
const payload={from:'FlowNexa <hello@flownex.online>',to:['a@b.com'],subject:'s',html:'<p>x</p>',text:'x'};

test('Resend no limite → NovaMail com remetente em mail.flownex.online', async()=>{
 const calls=[];
 const env={RESEND_API_KEY:'re',NOVAMAIL_API_KEY:'nm',RESEND_FETCH:async(url,init)=>{calls.push([String(url),JSON.parse(init.body)]);return String(url).includes('resend')?json({name:'daily_quota_exceeded',message:'quota'},429):json({id:'n1'});}};
 assert.equal(await deliverEmail(env,payload,'k1'),'nm:n1');
 assert.equal(calls[1][1].from,'FlowNexa <hello@mail.flownex.online>');
});

test('erro comum do Resend não transborda', async()=>{
 let n=0;
 const env={RESEND_API_KEY:'re',NOVAMAIL_API_KEY:'nm',RESEND_FETCH:async()=>{n++;return json({message:'invalid'},422);}};
 await assert.rejects(deliverEmail(env,payload,'k2'),/email_delivery_unavailable/);
 assert.equal(n,1);
});

test('sucesso no Resend devolve o id do Resend', async()=>{
 const env={RESEND_API_KEY:'re',RESEND_FETCH:async()=>json({id:'r1'})};
 assert.equal(await deliverEmail(env,payload,'k3'),'r1');
});
