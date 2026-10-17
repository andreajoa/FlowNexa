export function buildAtenzaHumanClean({assetBase="https://flownex.online/assets/funnel/atenza", site="https://www.atenza.online"} = {}) {
  const signup = site + '/signup';
  const pricing = site + '/precos';
  const demo = site + '/demonstracao';
  const postback = (title, payload) => ({ type: 'postback', title, payload });
  const link = (title, url) => ({ type: 'web_url', title, url });
  const wait = (id, on_reply, on_timeout = 'finish', extra = {}) => ({
    id, type: 'wait_reply', timeout_seconds: 259200, on_reply, on_timeout, on_timeout_without_window: on_timeout, ...extra
  });
  const followUp = (id, on_reply) => wait(id, on_reply, 'last_call', { timeout_seconds: 79200, on_timeout_without_window: 'finish' });

  const nodes = [
    // 1. Abertura humana e natural
    { id: 'welcome', type: 'message', text: 'Oi! Aqui é a equipe da Atenza 👋\n\nVi seu comentário e quis te responder por aqui. A gente ajuda empresas a organizar o WhatsApp com múltiplos atendentes, CRM e atendimento automático com IA.\n\nVocê já conhece a Atenza ou é seu primeiro contato?', next: 'first_wait' },
    
    wait('first_wait', 'first_route', 'reminder', { timeout_seconds: 3600, on_timeout_without_window: 'silent_wait', deadline_seconds_from_start: 259200 }),
    
    { id: 'reminder', type: 'message', text: 'Passando só pra não te deixar sem retorno 🙂\nSe quiser ver como funciona em 1 minuto, me dá um alô por aqui. Se preferir não receber mais mensagens, é só escrever PARAR.', next: 'silent_wait' },
    
    wait('silent_wait', 'first_route', 'finish', { timeout_seconds: 255600, deadline_seconds_from_start: 259200 }),

    // 2. Reconhecimento inteligente da intenção
    { id: 'first_route', type: 'switch', operator: 'contains', cases: [
      { id: 'retomada_txt', label: 'Já conversou antes', value: 'JA', next: 'retomada' },
      { id: 'retomada_txt2', label: 'Conversou antes', value: 'CONVERS', next: 'retomada' },
      { id: 'p_direct', label: 'Preço direto', value: 'PRECO', next: 'plans' },
      { id: 'p_direct2', label: 'Quanto custa', value: 'QUANTO', next: 'plans' },
      { id: 'p_direct3', label: 'Valor', value: 'VALOR', next: 'plans' },
      { id: 'd_direct', label: 'Vídeo/Demo', value: 'VIDEO', next: 'demo_offer' }
    ], default: 'hook' },

    // 3. Ramificação para quem já conhece
    { id: 'retomada', type: 'buttons', text: 'Que ótimo te ver de novo por aqui! Como posso te ajudar hoje?', buttons: [
      link('Ver os planos', pricing),
      link('Testar 7 dias grátis', signup),
      postback('Falar com atendente', 'HUMANO')
    ], next: 'retomada_wait' },
    wait('retomada_wait', 'retomada_route'),

    { id: 'retomada_route', type: 'switch', operator: 'contains', cases: [
      { id: 'humano_case', label: 'Atendente humano', value: 'HUMANO', next: 'humano_msg' },
      { id: 'duvida_retomada', label: 'Dúvidas', value: 'DUVID', next: 'faq' }
    ], default: 'humano_msg' },

    // Mensagem de acolhimento humano
    { id: 'humano_msg', type: 'message', text: 'Perfeito! Sinalizei sua conversa na caixa de entrada da nossa equipe. Em instantes um de nós vai te responder por aqui mesmo 🙂', next: 'finish' },

    // 4. Fluxo de apresentação visual
    { id: 'hook', type: 'image', url: assetBase + '/atenza-atendimento.png', next: 'menu' },
    
    { id: 'menu', type: 'buttons', text: 'Pra eu te direcionar pro que mais te ajuda: qual o maior desafio hoje?', buttons: [
      postback('Demoro a responder', 'DEMORA'),
      postback('Cliente some', 'SOME'),
      postback('Time bagunçado', 'TIME')
    ], next: 'menu_wait' },
    wait('menu_wait', 'menu_route'),

    { id: 'menu_route', type: 'switch', operator: 'contains', cases: [
      { id: 'slow_btn', label: 'Demora', value: 'DEMORA', next: 'ai_image' },
      { id: 'slow_txt', label: 'Demora (texto)', value: 'DEMOR', next: 'ai_image' },
      { id: 'slow_ia', label: 'IA/Chatbot', value: 'IA', next: 'ai_image' },
      { id: 'lost_btn', label: 'Cliente some', value: 'SOME', next: 'crm_image' },
      { id: 'lost_txt', label: 'Perde venda', value: 'PERD', next: 'crm_image' },
      { id: 'lost_crm', label: 'CRM/Funil', value: 'CRM', next: 'crm_image' },
      { id: 'team_btn', label: 'Time', value: 'TIME', next: 'team_copy' },
      { id: 'team_txt', label: 'Atendentes', value: 'ATEND', next: 'team_copy' },
      { id: 'price_txt', label: 'Preço', value: 'PRECO', next: 'plans' }
    ], default: 'ai_image' },

    { id: 'ai_image', type: 'image', url: assetBase + '/atenza-agentes-ia-whatsapp.png', next: 'ai_copy' },
    { id: 'ai_copy', type: 'message', text: 'Na Atenza, a IA responde 24 horas usando as informações que você cadastrar (tabela de preços, horários, dúvidas e políticas). Se a conversa precisar de alguém da equipe, ela passa o contato com todo o histórico.', next: 'demo_offer' },
    
    { id: 'crm_image', type: 'image', url: assetBase + '/atenza-crm-whatsapp.png', next: 'crm_copy' },
    { id: 'crm_copy', type: 'message', text: 'Na Atenza, cada conversa vira uma oportunidade no funil de vendas, e o follow-up automático reativa quem parou de responder, sem depender de ninguém lembrar de mandar mensagem.', next: 'demo_offer' },
    
    { id: 'team_copy', type: 'message', text: 'Na Atenza, sua equipe inteira atende usando o mesmo número de WhatsApp numa caixa de entrada compartilhada, com cada conversa atribuída a um responsável e sem ninguém responder por cima.', next: 'demo_offer' },

    { id: 'demo_offer', type: 'buttons', text: 'Veja o sistema funcionando ou conheça os planos:', buttons: [
      link('Ver vídeo (1 min)', demo),
      postback('Ver os planos', 'PLANOS'),
      postback('Tenho dúvidas', 'DUVIDA')
    ], next: 'demo_wait' },
    wait('demo_wait', 'demo_route'),

    { id: 'demo_route', type: 'switch', operator: 'contains', cases: [
      { id: 'p_btn', label: 'Planos', value: 'PLANOS', next: 'plans' },
      { id: 'p_txt1', label: 'Preço/Planos', value: 'PRECO', next: 'plans' },
      { id: 'p_txt2', label: 'Quanto custa', value: 'QUANTO', next: 'plans' },
      { id: 'f_btn', label: 'Dúvidas', value: 'DUVIDA', next: 'faq' },
      { id: 'f_txt1', label: 'Dúvida', value: 'DUVID', next: 'faq' },
      { id: 'f_txt2', label: 'Como funciona', value: 'FUNCIONA', next: 'faq' },
      { id: 'h_txt', label: 'Humano', value: 'HUMANO', next: 'humano_msg' }
    ], default: 'plans' },

    { id: 'plans', type: 'message', text: 'Valores da Atenza (mensalidade sem taxa extra por mensagem):\n\n• Essencial — R$ 97: 1 número, até 3 pessoas, IA personalizada, funil e histórico.\n• Pro — R$ 197: até 3 números, até 10 pessoas, follow-up automático e campanhas.\n• Ilimitado — R$ 397: números e equipe sem limite, API e suporte prioritário.\n\nTodos têm 7 dias sem cobrança pra você testar na prática.', next: 'plans_cta' },
    { id: 'plans_cta', type: 'buttons', text: 'Qual o melhor próximo passo pra você?', buttons: [
      link('Começar o teste', signup),
      link('Comparar planos', pricing),
      postback('Tenho dúvidas', 'DUVIDA')
    ], next: 'plans_wait' },
    followUp('plans_wait', 'faq'),

    { id: 'faq', type: 'message', text: 'Dúvidas mais comuns:\n\n• O número muda? Não, você mantém seu número atual.\n• Precisa de cartão? Sim, mas os primeiros 7 dias são gratuitos. Cancelou antes, não paga nada.\n• Custo de IA: Você usa a chave da sua IA favorita (OpenAI, Anthropic, Google) direto a preço de custo.\n\nQuer falar direto com a gente? Mande mensagem aqui que te atendemos!', next: 'faq_cta' },
    { id: 'faq_cta', type: 'buttons', text: 'Escolha uma opção:', buttons: [
      link('Testar 7 dias grátis', signup),
      postback('Falar com atendente', 'HUMANO')
    ], next: 'finish' },

    { id: 'last_call', type: 'message', text: 'Oi! Passando só pra saber se ficou alguma dúvida sobre a Atenza. O teste de 7 dias sem cobrança segue disponível em ' + signup + ' 🙂 Se preferir encerrar, escreva PARAR.', next: 'finish' },
    { id: 'finish', type: 'end' }
  ];

  const labels = {
    welcome: 'Abertura Humanizada', first_wait: 'Resposta ou 1 hora', reminder: 'Lembrete amigável', silent_wait: 'Aguardar até 3 dias',
    first_route: 'Intenção inicial', retomada: 'Menu de Retomada', retomada_wait: 'Aguardar escolha', retomada_route: 'Destino da retomada',
    humano_msg: 'Aviso de transbordo', hook: 'Prévia da tela', menu: 'Desafio atual', menu_wait: 'Aguardar resposta', menu_route: 'Roteamento semântico',
    ai_image: 'Imagem: IA', ai_copy: 'Explicação IA', crm_image: 'Imagem: CRM', crm_copy: 'Explicação CRM', team_copy: 'Multiatendimento',
    demo_offer: 'Demonstração ou planos', demo_wait: 'Aguardar decisão', demo_route: 'Encaminhar decisão',
    plans: 'Planos detalhados', plans_cta: 'Opções de adesão', plans_wait: 'Aguardar ação',
    faq: 'Perguntas e respostas', faq_cta: 'Teste ou humano',
    last_call: 'Follow-up final', finish: 'Encerramento'
  };

  const positions = {
    welcome: [40, 320], first_wait: [370, 320], reminder: [370, 620], silent_wait: [700, 620],
    first_route: [700, 320], retomada: [1030, 80], retomada_wait: [1360, 80], retomada_route: [1690, 80], humano_msg: [2020, 80],
    hook: [1030, 320], menu: [1360, 320], menu_wait: [1690, 320], menu_route: [2020, 320],
    ai_image: [2350, 60], ai_copy: [2680, 60], crm_image: [2350, 360], crm_copy: [2680, 360],
    team_copy: [2680, 660], demo_offer: [3010, 360], demo_wait: [3340, 360], demo_route: [3670, 360],
    plans: [4000, 360], plans_cta: [4330, 360], plans_wait: [4660, 360], faq: [4990, 360],
    faq_cta: [5320, 360], last_call: [4990, 660], finish: [5650, 360]
  };

  const layout = Object.fromEntries(nodes.map(n => [n.id, { x: positions[n.id][0], y: positions[n.id][1], label: labels[n.id] }]));

  return {
    name: 'automacao 1',
    trigger_type: 'comment_any',
    scope: 'all',
    configuration: {
      keywords: [],
      media_ids: [],
      once_per_contact: false,
      opt_out_keywords: ['PARAR', 'STOP', 'SAIR', 'CANCELAR'],
      graph: { version: 1, start: 'welcome', nodes },
      graph_layout: layout
    }
  };
}
