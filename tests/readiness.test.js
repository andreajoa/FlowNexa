import test from "node:test";
import assert from "node:assert/strict";
import {validateProductionConfiguration,readyResponse} from "../src/readiness.js";
test("production readiness fails closed with missing configuration",async()=>{
 const result=validateProductionConfiguration({});
 assert.equal(result.ready,false);
 assert.ok(result.missing.includes("DB"));
 assert.equal((await readyResponse({}).json()).status,"not_ready");
 assert.equal(readyResponse({}).status,503);
});
test("correct configuration exposes readiness without enabling messages",async()=>{
 const env={DB:{},APP_MODE:"production",MESSAGING_ENABLED:"false",META_APP_ID:"id",META_APP_SECRET:"secret",META_VERIFY_TOKEN:"verify",META_REDIRECT_URI:"https://example.com/api/instagram/callback",TOKEN_ENCRYPTION_KEY:"a".repeat(64),SESSION_SECRET:"s".repeat(40)};
 assert.equal(validateProductionConfiguration(env).ready,true);
 const response=readyResponse(env);assert.equal(response.status,200);
 const result=await response.json();assert.equal(result.liveMessaging,false);
 assert.equal(JSON.stringify(result).includes("secret"),false);
});
test("real messaging and invalid crypto configuration block readiness",()=>{
 const env={DB:{},APP_MODE:"production",MESSAGING_ENABLED:"true",META_APP_ID:"id",META_APP_SECRET:"m",META_VERIFY_TOKEN:"v",META_REDIRECT_URI:"http://insecure/api/instagram/callback",TOKEN_ENCRYPTION_KEY:"weak",SESSION_SECRET:"short"};
 assert.equal(validateProductionConfiguration(env).ready,false);
});
