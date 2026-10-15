// Defensive runtime validation for flow templates. No arbitrary action execution.
export const SUPPORTED_ACTIONS = new Set(["log","draft_message","draft_private_reply"]);
export function validateFlowConfiguration(triggerType,scope,config) {
 if(!config||typeof config!=="object"||Array.isArray(config))return {ok:false,error:"invalid_configuration"};
 if(!Array.isArray(config.actions)||config.actions.length>30)return {ok:false,error:"invalid_actions"};
 if(!config.actions.every(a=>a&&SUPPORTED_ACTIONS.has(a.type)&&(a.type==="log"||(typeof a.text==="string"&&a.text.trim()&&a.text.length<=1000))))return {ok:false,error:"invalid_actions"};
 if(JSON.stringify(config).length>16000)return {ok:false,error:"configuration_too_large"};
 if(scope==="selected"&&(!Array.isArray(config.media_ids)||!config.media_ids.length||!config.media_ids.every(v=>typeof v==="string"&&/^[0-9]+$/.test(v))))return {ok:false,error:"selected_media_required"};
 if(scope==="next")return {ok:false,error:"next_post_not_implemented"};
 if(triggerType==="story_reply")return {ok:false,error:"story_reply_not_implemented"};
 if(triggerType.endsWith("_keyword")&&(!Array.isArray(config.keywords)||!config.keywords.length||!config.keywords.every(x=>typeof x==="string"&&x.trim().length>0&&x.length<=100)))return {ok:false,error:"keywords_required"};
 return {ok:true};
}
