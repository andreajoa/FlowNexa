import test from 'node:test';import assert from 'node:assert/strict';
import {gilbertoFlow} from '../campaigns/gilberto-rebuild/flows.js';
import {validateFlow,matchFlow} from '../src/flow-runtime.js';
import {switchTarget,phraseMatches} from '../src/conversation-graph.js';
import {previewConversation,appClient} from '../src/app-client.js';
import {normalizeZernio} from '../src/zernio-webhook.js';
const route=(text,now=Date.parse('2026-08-01T12:00:00Z'))=>{const g=gilbertoFlow().configuration.graph;let n=g.nodes.find(n=>n.id===g.start);while(n.type==='switch')n=g.nodes.find(x=>x.id===switchTarget(n,text,null,now));return n;};
test('English paths recognize initial questions, refusals, risk and real book enquiries without substring collisions',()=>{
 for(const [text,id] of [["Are you a guru?",'guru'],['my wife cheated on me','pain'],['I am struggling','pain'],["I can’t sleep",'sleep'],['I want revenge','anger'],['I lost myself','identity'],['I already bought your book','support'],['Where can I buy the book?','book'],['I want a physical book','paperback'],['I have faith','faith'],['no thanks','decline'],["I can't afford the book",'decline'],['I want to die and buy the book','crisis'],['BLACKFRIDAY','black_friday'],['Christmas gift','christmas'],['new year','new_year'],['a bookshelf','hello'],['hello','hello'],['voice note','hello']])assert.equal(route(text).id,id,text);
 assert.equal(phraseMatches('a shelf',['help'].join('\n')),false);assert.equal(phraseMatches('HELP!','help'),true);
 const node=gilbertoFlow().configuration.graph.nodes.find(n=>n.id==='topics');assert.equal(switchTarget(node,'different label','BOOK_DETAILS'),'reading_season');assert.equal(switchTarget(node,'book','UNKNOWN'),'hello');assert.equal(switchTarget(node,'different label','YOUR_STORY'),'guru');
});
test('both workspace flows validate, stay below limits and cover distinct events',()=>{
 for(const comments of [false,true]){const f=gilbertoFlow({comments});assert.deepEqual(validateFlow(f.trigger_type,f.scope,f.configuration),{ok:true});assert.ok(JSON.stringify(f.configuration).length<16000);assert.equal(matchFlow(f,{kind:'dm',text:'hi'}).matched,!comments);assert.equal(matchFlow(f,{kind:'comment',text:'nice',media_id:'123'}).matched,comments);}
 const f=gilbertoFlow();f.configuration.graph.nodes.push({id:'wait',type:'wait_reply',timeout_seconds:60,on_reply:'finish',on_timeout:'finish'});assert.equal(validateFlow(f.trigger_type,f.scope,f.configuration).error,'invalid_reply_per_message');
});
test('browser preview takes the same first-message campaign and safety branches as runtime',()=>{
 const g=gilbertoFlow().configuration.graph;assert.equal(previewConversation(g,{reply:'BLACKFRIDAY'}).find(n=>n.type==='image').id,'black_friday_art');assert.match(previewConversation(g,{reply:'kill myself'}).find(n=>n.type==='message').text,/988/);assert.doesNotThrow(()=>new Function(appClient()));
});
test('incoming shared attachments can start a DM; post likes, saves, reactions and own messages cannot',()=>{
 const a={ig_user_id:'zernio:account',platform_user_id:'111',username:'gilberto.rebuild'};const b={event:'message.received',account:{platform:'instagram'},conversation:{id:'thread'},message:{platform:'instagram',direction:'incoming',platformMessageId:'mid',sender:{id:'222'},sentAt:new Date().toISOString(),attachments:[{type:'share',url:'https://instagram.com/p/example'}]}};
 assert.equal(normalizeZernio(b,a)[0].kind,'dm');assert.equal(normalizeZernio(b,a)[0].text,'');assert.equal(normalizeZernio({...b,event:'reaction.received'},a).length,0);for(const event of ['post.liked','post.saved','post.shared'])assert.equal(normalizeZernio({...b,event},a).length,0);
 const own=structuredClone(b);own.message.direction='outgoing';assert.equal(normalizeZernio(own,a).length,0);const standby=structuredClone(b);standby.metadata={standby:true};assert.equal(normalizeZernio(standby,a).length,0);
});

test('book enquiries select the scheduled artwork, then return to evergreen after the season',()=>{
 for(const [day,id] of [['2026-10-18','black_friday'],['2026-11-30','black_friday'],['2026-12-01','christmas'],['2026-12-25','christmas'],['2026-12-26','new_year'],['2027-01-07','new_year'],['2027-01-08','book']])assert.equal(route('Where can I buy your book?',Date.parse(day+'T12:00:00Z')).id,id,day);
 const f=gilbertoFlow();f.configuration.graph.nodes.find(n=>n.id==='reading_season').cases[0].value='2026-02-30/2026-11-30';assert.equal(validateFlow(f.trigger_type,f.scope,f.configuration).error,'invalid_graph_switch');
});
