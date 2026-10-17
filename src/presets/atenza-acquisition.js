// Atenza acquisition conversation for @atenzaon. Every claim mirrors https://www.atenza.online/precos (checked 2026-10-17).
export const ATENZA_OPENING='Oi! Aqui é a Atenza 👋 Vi seu comentário e separei algo pra você: um jeito de organizar o WhatsApp da sua empresa com vários atendentes no mesmo número, IA que responde com as informações do seu negócio e um funil de vendas com o histórico de cada cliente. Quer que eu te mostre em menos de 1 minuto?';
export function buildAtenzaAcquisition({opening=ATENZA_OPENING,assetBase='https://flownex.online',site='https://www.atenza.online'}={}){
 if(typeof opening!=='string'||!opening.trim()||opening.length>1000)throw Error('invalid_opening');
 const asset=name=>assetBase+'/assets/funnel/atenza/'+name,signup=site+'/signup',pricing=site+'/precos',demo=site+'/demonstracao',video=site+'/media/atenza/atenza-explica.mp4';
 const postback=(title,payload)=>({type:'postback',title,payload}),link=(title,url)=>({type:'web_url',title,url});
 const wait=(id,on_reply,on_timeout='finish',extra={})=>({id,type:'wait_reply',timeout_seconds:259200,on_reply,on_timeout,on_timeout_without_window:on_timeout,...extra});
 // Follow-up waits stay under Meta's 24h window; without an open window the conversation simply ends.
 const followUp=(id,on_reply)=>wait(id,on_reply,'last_call',{timeout_seconds:79200,on_timeout_without_window:'finish'});
 const nodes=[
  {id:'welcome',type:'message',text:opening,next:'first_wait'},
  wait('first_wait','hook','reminder',{timeout_seconds:3600,on_timeout_without_window:'silent_wait',deadline_seconds_from_start:259200}),
  {id:'reminder',type:'message',text:'Passando só mais uma vez 🙂 Se quiser ver a Atenza funcionando em menos de 1 minuto, responda VER. Para não receber mais mensagens, escreva PARAR.',next:'silent_wait'},
  wait('silent_wait','hook','finish',{timeout_seconds:255600,deadline_seconds_from_start:259200}),
  {id:'hook',type:'image',url:asset('atenza-atendimento.png'),next:'menu'},
  {id:'menu',type:'buttons',text:'Pra eu te mostrar o que importa: o que mais pesa hoje no seu WhatsApp?',buttons:[postback('Demoro a responder','DEMORA'),postback('Cliente some','SOME'),postback('Time bagunçado','TIME')],next:'menu_wait'},
  wait('menu_wait','route'),
  {id:'route',type:'switch',operator:'equals',cases:[{id:'slow',label:'Demora para responder',value:'DEMORA',next:'ai_image'},{id:'lost',label:'Cliente some',value:'SOME',next:'crm_image'},{id:'team',label:'Time desorganizado',value:'TIME',next:'team_copy'}],default:'ai_image'},
  {id:'ai_image',type:'image',url:asset('atenza-agentes-ia-whatsapp.png'),next:'ai_copy'},
  {id:'ai_copy',type:'message',text:'Na Atenza, um atendente de IA responde 24 horas usando a base de conhecimento que você cadastra: preços, horários, políticas, dúvidas frequentes. Quando a conversa precisa de uma pessoa, ela passa para o seu time com todo o histórico. E os limites do que a IA pode fazer são definidos por você.',next:'demo_offer'},
  {id:'crm_image',type:'image',url:asset('atenza-crm-whatsapp.png'),next:'crm_copy'},
  {id:'crm_copy',type:'message',text:'Na Atenza, cada conversa vira uma negociação no funil de vendas, com o histórico do cliente sempre à mão. E o follow-up automático volta a falar com quem parou de responder, sem depender da memória de ninguém (follow-up e campanhas estão a partir do plano Pro).',next:'demo_offer'},
  {id:'team_copy',type:'message',text:'Na Atenza, vários atendentes usam o mesmo número de WhatsApp numa caixa de entrada compartilhada: cada conversa tem responsável e histórico, e ninguém responde por cima de ninguém. Seu número continua o mesmo.',next:'demo_offer'},
  {id:'demo_offer',type:'buttons',text:'Quer ver o sistema funcionando? O vídeo tem menos de 1 minuto.',buttons:[postback('Ver o vídeo','VIDEO'),postback('Ver os planos','PLANOS'),postback('Tenho dúvidas','DUVIDA')],next:'demo_wait'},
  wait('demo_wait','demo_route'),
  {id:'demo_route',type:'switch',operator:'equals',cases:[{id:'video',label:'Ver o vídeo',value:'VIDEO',next:'video'},{id:'plans',label:'Ver os planos',value:'PLANOS',next:'plans'},{id:'faq',label:'Tenho dúvidas',value:'DUVIDA',next:'faq'}],default:'video'},
  {id:'video',type:'video',url:video,next:'offer'},
  {id:'offer',type:'buttons',text:'Dá pra testar 7 dias sem cobrança e cancelar em um clique.',buttons:[link('Testar 7 dias',signup),postback('Ver os planos','PLANOS'),postback('Tenho dúvidas','DUVIDA')],next:'offer_wait'},
  followUp('offer_wait','offer_route'),
  {id:'offer_route',type:'switch',operator:'equals',cases:[{id:'plans',label:'Ver os planos',value:'PLANOS',next:'plans'},{id:'faq',label:'Tenho dúvidas',value:'DUVIDA',next:'faq'}],default:'faq'},
  {id:'plans',type:'message',text:'Planos da Atenza (por mês):\n\n• Essencial — R$ 97: 1 número, até 3 pessoas, atendente de IA com a sua base, funil e histórico.\n• Pro — R$ 197: até 3 números, até 10 pessoas, follow-up automático, campanhas e relatórios.\n• Ilimitado — R$ 397: números e time sem limite, API e webhooks, suporte prioritário.\n\nTodos com 7 dias sem cobrança (cartão necessário, cancele quando quiser). A IA usa a chave do provedor que você escolher, e o uso é pago direto a ele, sem taxa nossa por cima.',next:'plans_cta'},
  {id:'plans_cta',type:'buttons',text:'Qual o próximo passo pra você?',buttons:[link('Começar o teste',signup),link('Comparar planos',pricing),postback('Tenho dúvidas','DUVIDA')],next:'plans_wait'},
  followUp('plans_wait','faq'),
  {id:'faq',type:'message',text:'Respostas rápidas:\n\n• Meu número muda? Não. Você continua atendendo pelo mesmo número.\n• Preciso de cartão? Sim, mas nada é cobrado nos 7 primeiros dias. Cancelou antes, não paga.\n• A IA está inclusa? Você conecta a chave do provedor (OpenAI, Anthropic, Google ou OpenRouter) e paga o uso direto a ele.\n• Serve pro meu negócio? A Atenza é usada por lojas, clínicas, escolas, imobiliárias, escritórios, restaurantes, agências e prestadores de serviço.\n\nOutra dúvida? Escreva aqui ou mande para suporte@atenza.online.',next:'faq_cta'},
  {id:'faq_cta',type:'buttons',text:'Quando quiser, é só começar:',buttons:[link('Testar 7 dias',signup),link('Ver demonstração',demo)],next:'finish'},
  {id:'last_call',type:'message',text:'Oi! Ficou alguma dúvida sobre a Atenza? O teste de 7 dias sem cobrança continua disponível em '+signup+' 🙂 Se preferir não receber mais mensagens, escreva PARAR.',next:'finish'},
  {id:'finish',type:'end'}
 ];
 const labels={welcome:'Abertura Atenza',first_wait:'Resposta ou 1 hora',reminder:'Único lembrete',silent_wait:'Esperar até 3 dias',hook:'Imagem: atendimento',menu:'Qual a maior dor?',menu_wait:'Esperar escolha',route:'Bifurcação por dor',ai_image:'Imagem: agentes de IA',ai_copy:'IA que responde 24h',crm_image:'Imagem: CRM',crm_copy:'Funil e follow-up',team_copy:'Multiatendimento',demo_offer:'Oferecer demonstração',demo_wait:'Esperar escolha',demo_route:'Vídeo, planos ou dúvidas',video:'Vídeo de 1 minuto',offer:'Teste de 7 dias',offer_wait:'Esperar até 22h',offer_route:'Planos ou dúvidas',plans:'Planos e preços',plans_cta:'Começar ou comparar',plans_wait:'Esperar até 22h',faq:'Dúvidas frequentes',faq_cta:'Teste ou demonstração',last_call:'Último lembrete (24h)',finish:'Encerramento'};
 const positions={welcome:[40,60],first_wait:[370,60],reminder:[370,360],silent_wait:[700,360],hook:[1030,60],menu:[1360,60],menu_wait:[1690,60],route:[2020,60],ai_image:[2350,-200],ai_copy:[2680,-200],crm_image:[2350,100],crm_copy:[2680,100],team_copy:[2680,400],demo_offer:[3010,100],demo_wait:[3340,100],demo_route:[3670,100],video:[4000,-100],offer:[4330,-100],offer_wait:[4660,-100],offer_route:[4990,-100],plans:[4330,300],plans_cta:[4660,300],plans_wait:[4990,300],faq:[5320,100],faq_cta:[5650,100],last_call:[5320,500],finish:[5980,300]};
 return {name:'automacao 1',trigger_type:'comment_any',scope:'all',configuration:{keywords:[],media_ids:[],once_per_contact:true,opt_out_keywords:['PARAR','STOP','SAIR','CANCELAR'],graph:{version:1,start:'welcome',nodes},graph_layout:Object.fromEntries(nodes.map(n=>[n.id,{x:positions[n.id][0],y:positions[n.id][1]+260,label:labels[n.id]}]))}};
}
