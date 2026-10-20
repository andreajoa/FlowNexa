// Approved application catalog: amounts are minor units, annual plans renew once a year.
export const PLAN_TIERS=[
 {id:'pro',name:'FlowNexa Pro',accounts:1,messages:10000,amounts:{brl:{month:5990,year:59900},usd:{month:990,year:12900}}},
 {id:'teams',name:'FlowNexa Equipes',name_en:'FlowNexa Teams',accounts:2,messages:20000,amounts:{brl:{month:11990,year:119900},usd:{month:2490,year:24900}}}
];
export function commercialPlans(){return PLAN_TIERS.flatMap(tier=>['brl','usd'].flatMap(currency=>['month','year'].map(interval=>({id:`${tier.id}_${currency}_${interval}`,tier:tier.id,name:currency==='usd'?(tier.name_en||tier.name):tier.name,unit_amount:tier.amounts[currency][interval],currency,interval,interval_count:1,accounts:tier.accounts,messages:tier.messages}))));}
export function browserBillingPreference(languages, pageLanguage='') {
 const language=pageLanguage||(Array.isArray(languages)?languages:[languages]).find(v=>typeof v==='string'&&v)||'pt-BR';
 return /^pt(?:-|$)/i.test(language)?{currency:'brl',locale:'pt-BR'}:{currency:'usd',locale:'en'};
}
export function planDisplay(plan,locale='pt-BR'){
 const money=amount=>new Intl.NumberFormat(locale,{style:'currency',currency:plan.currency.toUpperCase()}).format(amount/100);
 return{price:money(plan.unit_amount),monthly_equivalent:plan.interval==='year'?money(plan.unit_amount/12):money(plan.unit_amount)};
}
export function pricingClient(){return `(${pricingBoot.toString()})(${JSON.stringify(commercialPlans())},${browserBillingPreference.toString()},${planDisplay.toString()});`;}
function pricingBoot(plans,browserBillingPreference,planDisplay){
 const section=document.getElementById('precos');if(!section)return;
 let pref=browserBillingPreference(navigator.languages||[navigator.language],document.documentElement.lang);let currency=pref.currency,interval='month';
 let english=pref.locale==='en';
 const text=(selector,value)=>{const el=section.querySelector(selector);if(el)el.textContent=value;};

 function render(){
  text('#plans-title',english?'Simple, transparent pricing':'Preços simples e transparentes');
  text('.plans-sub',english?'Choose a monthly or yearly subscription. Compare the total before subscribing.':'Escolha uma assinatura mensal ou anual. Confira o total antes de contratar.');
  text('.plans-rating',english?'Instagram automations, visual conversation flows and campaign scheduling.':'Automações no Instagram, conversas com nós e campanhas por calendário.');
  for(const b of section.querySelectorAll('[data-billing]'))b.textContent=b.dataset.billing==='yearly'?(english?'Yearly':'Anual'):(english?'Monthly':'Mensal');
  for(const card of section.querySelectorAll('[data-plan-tier]')){const p=plans.find(p=>p.tier===card.dataset.planTier&&p.currency===currency&&p.interval===interval);if(!p)continue;const display=planDisplay(p,pref.locale);card.querySelector('.plan-name').textContent=p.name;card.querySelector('.plan-price').textContent=display.price+(interval==='year'?(english?'/year':'/ano'):(english?'/month':'/mês'));
   card.querySelector('.plan-description').textContent=interval==='year'?(english?'Charged once per year. '+display.monthly_equivalent+'/month equivalent.':'Cobrado uma vez por ano. Equivalente a '+display.monthly_equivalent+'/mês.'):(english?'Renews monthly. Manage or cancel your subscription in the billing portal.':'Renova mensalmente. Gerencie ou cancele a assinatura no portal de cobrança.');
   const features=english?[p.accounts+' connected Instagram account'+(p.accounts>1?'s':''),new Intl.NumberFormat(pref.locale).format(p.messages)+' outbound messages per calendar month','Visual conversation flows and quick replies','Comments, Direct and story replies','Seasonal campaigns and scheduled paths']:[p.accounts+' conta'+(p.accounts>1?'s':'')+' do Instagram conectada'+(p.accounts>1?'s':''),new Intl.NumberFormat(pref.locale).format(p.messages)+' mensagens enviadas por mês calendário','Fluxos visuais e respostas rápidas','Comentários, Direct e respostas a stories','Campanhas e caminhos por calendário'];
   const list=card.querySelector('ul');list.replaceChildren();for(const value of features){const li=document.createElement('li');li.textContent=value;list.append(li);}const link=card.querySelector('.plan-action');link.textContent=english?'Choose '+p.name:'Escolher '+p.name;link.href='/app?lang='+encodeURIComponent(pref.locale)+'&plan='+encodeURIComponent(p.id)+'#billing';
  }
  for(const b of section.querySelectorAll('[data-billing]'))b.setAttribute('aria-pressed',String((b.dataset.billing==='yearly'?'year':'month')===interval));
  text('#billing-note',english?'Yearly plans are paid in full and renew yearly. Monthly usage resets each calendar month, including on yearly subscriptions. No automatic overage charges. Instagram account eligibility and messaging windows apply.':'O anual é cobrado integralmente e renova a cada ano. A franquia renova a cada mês calendário, inclusive na assinatura anual. Sem cobrança automática de excedentes. Sujeito à elegibilidade da conta e às janelas de envio do Instagram.');
 }
 new MutationObserver(()=>{pref=browserBillingPreference(navigator.languages||[navigator.language],document.documentElement.lang);currency=pref.currency;english=pref.locale==='en';render();}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 for(const b of section.querySelectorAll('[data-billing]'))b.addEventListener('click',()=>{interval=b.dataset.billing==='yearly'?'year':'month';render();});render();
}
