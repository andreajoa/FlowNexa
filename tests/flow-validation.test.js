import test from "node:test";import assert from "node:assert/strict";
import {validateFlowConfiguration as validate} from "../src/flow-validation.js";
test("valid supported comment draft",()=>{assert.equal(validate("comment_keyword","selected",{keywords:["QUERO"],media_ids:["123"],actions:[{type:"draft_private_reply",text:"Olá!"}]}).ok,true)});
test("unsupported modes cannot be configured",()=>{assert.equal(validate("story_reply","all",{actions:[]}).ok,false);assert.equal(validate("comment_any","next",{actions:[]}).ok,false)});
test("actions cannot inject types, invalid text or oversized configs",()=>{assert.equal(validate("comment_any","all",{actions:[{type:"send_http_request",url:"https://example.org"}]}).ok,false);assert.equal(validate("comment_any","all",{actions:[{type:"draft_message",text:""}]}).ok,false);assert.equal(validate("comment_any","all",{actions:[{type:"draft_message",text:"x".repeat(1001)}]}).ok,false)});
test("selected-media IDs and keywords are required",()=>{assert.equal(validate("comment_keyword","selected",{actions:[],keywords:["QUERO"],media_ids:["bad"]}).ok,false);assert.equal(validate("dm_keyword","all",{actions:[],keywords:[]}).ok,false)});
