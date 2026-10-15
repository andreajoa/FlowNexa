import test from "node:test";
import assert from "node:assert/strict";
import {parseInstagramEvents,processInstagramWebhook} from "../src/webhook-engine.js";

test("only supported Instagram events are normalized", () => {
 const payload={object:"instagram",entry:[{id:"account-1",changes:[{field:"comments",value:{id:"c1",text:"QUERO",media:{id:"p1"}}},{field:"mentions",value:{id:"c2",text:"ignore"}}],messaging:[{message:{mid:"m1",text:"AJUDA"}},{message:{mid:"m2",text:"echo",is_echo:true}}]}]};
 assert.deepEqual(parseInstagramEvents(payload),[
 {sourceId:"comment:c1",accountId:"account-1",triggerType:"comment",media_id:"p1",text:"QUERO"},
 {sourceId:"dm:m1",accountId:"account-1",triggerType:"dm",media_id:null,text:"AJUDA"}
 ]);
 assert.deepEqual(parseInstagramEvents({object:"page",entry:[{id:"x"}]}),[]);
});

test("matching execution is draft-only and idempotent",async()=>{
 const keys=new Set();const queries=[];
 const db={prepare(sql){const p={args:[],bind(...args){this.args=args;return this},async first(){queries.push(sql);return {id:"account-db",workspace_id:"w"}},async all(){return {results:[{id:"f1",trigger_type:"comment_keyword",scope:"selected",configuration:JSON.stringify({media_ids:["p1"],keywords:["quero"]})}]}},async run(){const k=this.args[1]+":"+this.args[2];const changes=keys.has(k)?0:1;keys.add(k);return {meta:{changes}}}};return p}};
 const body={object:"instagram",entry:[{id:"account-1",changes:[{field:"comments",value:{id:"c1",text:"Quero o link",media:{id:"p1"}}}]}]};
 const first=await processInstagramWebhook(db,body);
 const second=await processInstagramWebhook(db,body);
 assert.deepEqual(first,{events:1,matched:1,logged:1,mode:"draft_only"});
 assert.equal(second.logged,0);
 assert.ok(queries.some(q=>q.includes("ig_user_id")));
});
