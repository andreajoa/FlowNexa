import test from 'node:test';
import assert from 'node:assert/strict';
import {identityDatabase} from './identity-helper.js';
import {ensureFacebookSchema} from '../src/facebook-schema.js';
import {acceptFacebookWebhook,processFacebookJobs} from '../src/facebook-runtime.js';
import {validateFacebookGraph} from '../src/facebook-graph.js';
import {buildAmbBoutiqueMaster} from '../src/presets/amb-boutique-acquisition.js';
const remote='abcdefabcdefabcdefabcdef';
const graph={version:1,start:'hi',nodes:[
 {id:'hi',type:'message',text:'Hi! What are you looking for?',quick_replies:[{title:'Dresses',payload:'DRESS'},{title:'Order',payload:'ORDER'}],next:'w'},
 {id:'w',type:'wait_reply',timeout_seconds:3600,on_reply:'route',on_timeout:'end'},
 {id:'route',type:'switch',operator:'contains',cases:[{id:'c1',label:'Dress',value:'DRESS',next:'dress'},{id:'c2',label:'Order',value:'ORDER',next:'order'}],default:'help'},
 {id:'dress',type:'buttons',text:'Our dresses',buttons:[{type:'web_url',title:'See dresses',url:'https://www.ambboutique.online/collections/dresses'}],next:'end'},
 {id:'order',type:'message',text:'Track it here: https://www.ambboutique.online/track-order',next:'end'},
 {id:'help',type:'message',text:'A stylist will reply shortly.',next:'end'},
 {id:'end',type:'end'}]};
function dm(text,id,payload){return{event:'message.received',account:{platform:'facebook',accountId:remote,profileId:'profile_fb'},message:{platform:'facebook',direction:'incoming',sender:{id:'person/opaque'},platformMessageId:id,conversationId:'thread/opaque',text,sentAt:new Date().toISOString(),...(payload?{metadata:{quickReply:{payload}}}:{})},conversation:{id:'thread/opaque'}};}
function comment(){return{event:'comment.received',account:dm().account,comment:{platform:'facebook',id:'page_1/post_2/c3',platformPostId:'page_1/post_2',isReply:false,author:{id:'person/opaque'},text:'price?',createdAt:new Date().toISOString()}};}
async function setup(t,trigger='dm_any'){
 const db=identityDatabase();t.after(()=>db.close());const calls=[];
 const env={DB:db,TOKEN_ENCRYPTION_KEY:'ab'.repeat(32),ZERNIO_API_KEY:'mock',FACEBOOK_CHANNEL_ENABLED:'true',FACEBOOK_SENDS_ENABLED:'true',FACEBOOK_PILOT_WORKSPACES:'workspace',ZERNIO_FETCH:async(url,options)=>{calls.push({url:String(url),body:JSON.parse(options.body)});return Response.json({messageId:'sent'+calls.length});}};
 await ensureFacebookSchema(env);
 db.sqlite.exec("INSERT INTO users(id,email,password_hash) VALUES('u','owner@example.test','unused');INSERT INTO workspaces(id,name,owner_id) VALUES('workspace','Test','u');INSERT INTO facebook_accounts(id,workspace_id,remote_id,profile_id,native_id,name,status,created_at) VALUES('fb','workspace','"+remote+"','profile_fb','page_1','Page','connected',1)");
 await db.prepare("INSERT INTO facebook_flows(id,workspace_id,account_id,name,trigger_type,response_kind,response_text,graph,enabled,created_at,updated_at) VALUES('flow','workspace','fb','Concierge',?,'graph','Conversa com nós',?,1,1,1)").bind(trigger,JSON.stringify(graph)).run();
 return{db,env,calls};
}
const accept=async(env,body)=>(await acceptFacebookWebhook(body,env)).json();
test('the AMB Instagram concierge graph is valid for Facebook',()=>{assert.deepEqual(validateFacebookGraph(buildAmbBoutiqueMaster().configuration.graph),{ok:true});});
test('a Messenger graph sends the opening with quick replies, waits, then routes the tapped payload',async t=>{
 const{env,db,calls}=await setup(t);
 assert.equal((await accept(env,dm('hello','m1'))).queued,1);await processFacebookJobs(env);
 assert.equal(calls.length,1);assert.match(calls[0].url,/thread%2Fopaque\/messages$/);assert.equal(calls[0].body.message,'Hi! What are you looking for?');assert.deepEqual(calls[0].body.quickReplies.map(q=>q.payload),['DRESS','ORDER']);
 assert.equal((await db.prepare('SELECT node_id FROM facebook_sessions').first()).node_id,'route');
 assert.equal((await accept(env,dm('Dresses','m2','DRESS'))).queued,1);await processFacebookJobs(env);
 assert.equal(calls[1].body.template.elements[0].buttons[0].type,'url');assert.equal(await db.prepare('SELECT * FROM facebook_sessions').first(),null);
 assert.equal((await accept(env,dm('where is my package','m3'))).queued,1);await processFacebookJobs(env);
 assert.equal(calls[2].body.message,'Hi! What are you looking for?');
});
test('free text that matches no option gets the help path, and a paused flow drops the session',async t=>{
 const{env,db,calls}=await setup(t);await accept(env,dm('hello','m1'));await processFacebookJobs(env);
 await accept(env,dm('do you ship to Canada?','m2'));await processFacebookJobs(env);assert.equal(calls[1].body.message,'A stylist will reply shortly.');
 await accept(env,dm('hello','m3'));await processFacebookJobs(env);
 db.sqlite.exec('UPDATE facebook_flows SET enabled=0,version=version+1');assert.equal((await accept(env,dm('DRESS','m4','DRESS'))).queued,0);
});
test('a comment receives only the opening as one private reply',async t=>{
 const{env,calls}=await setup(t,'comment_any');assert.equal((await accept(env,comment())).queued,1);await processFacebookJobs(env);
 assert.equal(calls.length,1);assert.match(calls[0].url,/private-reply$/);assert.equal(calls[0].body.message,'Hi! What are you looking for?');
});
