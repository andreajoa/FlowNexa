// Preset de automação cutting-edge para AMB BOUTIQUE (Instagram @ambb.outique)
// Baseado no e-commerce real da marca: https://www.ambboutique.online
// Fundada por Ana Paula Maciel em San Diego, Califórnia.

export function buildAmbBoutiqueMaster() {
  const site = 'https://www.ambboutique.online';
  const postback = (title, payload) => ({ type: 'postback', title, payload });
  const link = (title, url) => ({ type: 'web_url', title, url });
  const wait = (id, on_reply, on_timeout = 'finish', extra = {}) => ({
    id, type: 'wait_reply', timeout_seconds: 3600, on_reply, on_timeout, ...extra
  });

  const nodes = [
    // 1. Boas-vindas personal stylist
    {
      id: 'welcome',
      type: 'message',
      text: 'Olá! Que bom ter você por aqui na AMB BOUTIQUE ✨\n\nSou a concierge virtual da fundadora Ana Paula Maciel direto de San Diego, Califórnia. Como posso te ajudar hoje? Quer conhecer nossos lançamentos, tirar dúvidas de tamanhos e frete, ou consultar um pedido?',
      text_returning: 'Que ótimo te ver de novo na AMB BOUTIQUE ✨\n\nComo posso te ajudar hoje? Quer explorar as novidades, ver tabela de medidas, consultar frete ou falar sobre um pedido existente?',
      next: 'first_wait'
    },
    wait('first_wait', 'first_route', 'reminder', { timeout_seconds: 3600, on_timeout_without_window: 'finish', deadline_seconds_from_start: 259200 }),
    { id: 'reminder', type: 'message', text: 'Passando só pra te avisar que estou por aqui se precisar de ajuda com looks, tamanhos ou pedidos na AMB Boutique ✨ Digite PARAR se preferir não receber mais nada.', next: 'finish' },

    // 2. Reconhecimento de Intenção Inteligente (10 caminhos semânticos)
    { id: 'first_route', type: 'switch', operator: 'contains', cases: [
      { id: 'fr_order', label: 'Order', value: 'ORDER', next: 'track_order' },
      { id: 'fr_pedid', label: 'Pedido', value: 'PEDID', next: 'track_order' },
      { id: 'fr_rastre', label: 'Rastreio', value: 'RASTRE', next: 'track_order' },
      { id: 'fr_fret', label: 'Frete', value: 'FRET', next: 'shipping_info' },
      { id: 'fr_envio', label: 'Envio', value: 'ENVIO', next: 'shipping_info' },
      { id: 'fr_entreg', label: 'Entrega', value: 'ENTREG', next: 'shipping_info' },
      { id: 'fr_ship', label: 'Shipping', value: 'SHIP', next: 'shipping_info' },
      { id: 'fr_tamanh', label: 'Tamanho', value: 'TAMANH', next: 'size_guide' },
      { id: 'fr_size', label: 'Size', value: 'SIZE', next: 'size_guide' },
      { id: 'fr_humano', label: 'Equipe / Atendente', value: 'HUMAN', next: 'human_concierge' }
    ], default: 'showcase' },

    // 3. Vitrine Principal / Shop All
    { id: 'showcase', type: 'buttons', text: 'Conheça nossas peças contemporâneas com o melhor da elegância de San Diego ✨', buttons: [
      link('Ver Toda a Coleção', site + '/collections'),
      link('Novidades & Sale', site + '/sale'),
      postback('Ver Categorias', 'CATEGORIAS')
    ], next: 'showcase_wait' },
    wait('showcase_wait', 'showcase_route'),

    { id: 'showcase_route', type: 'switch', operator: 'contains', cases: [
      { id: 'sr_cat', label: 'Categorias', value: 'CATEGORIAS', next: 'categories_menu' },
      { id: 'sr_ship', label: 'Frete', value: 'FRET', next: 'shipping_info' },
      { id: 'sr_size', label: 'Tamanhos', value: 'TAMANH', next: 'size_guide' },
      { id: 'sr_help', label: 'Ajuda', value: 'HUMAN', next: 'human_concierge' }
    ], default: 'categories_menu' },

    // 4. Menu por Categoria com Links Diretos
    { id: 'categories_menu', type: 'buttons', text: 'Escolha qual categoria você deseja explorar agora na boutique:', buttons: [
      link('Vestidos & Conjuntos', site + '/collections/dresses'),
      link('Sapatos & Saltos', site + '/collections/heels'),
      link('Bolsas Estruturadas', site + '/collections/bags')
    ], next: 'categories_wait' },
    wait('categories_wait', 'categories_route'),

    { id: 'categories_route', type: 'switch', operator: 'contains', cases: [
      { id: 'cr_ship', label: 'Frete', value: 'FRET', next: 'shipping_info' },
      { id: 'cr_size', label: 'Tamanhos', value: 'TAMANH', next: 'size_guide' },
      { id: 'cr_track', label: 'Rastreio', value: 'RASTRE', next: 'track_order' },
      { id: 'cr_help', label: 'Consultora', value: 'HUMAN', next: 'human_concierge' }
    ], default: 'rewards_info' },

    // 5. Tabela de Frete & Prazos por Região
    { id: 'shipping_info', type: 'message', text: 'Informações de Frete e Prazos da AMB BOUTIQUE 📦\n\n• Separação: Pedidos em estoque são preparados em 1 a 3 dias úteis.\n• Estados Unidos: Entrega padrão em 12–18 dias úteis (Frete Grátis acima de US$ 99).\n• Canadá e Reino Unido: 10–21 dias úteis após despacho.\n• Austrália e Nova Zelândia: 12–21 dias úteis.\n• Rastreamento: Código enviado diretamente no seu e-mail assim que postado!\n\nConfira todos os detalhes em https://www.ambboutique.online/shipping', next: 'shipping_cta' },
    { id: 'shipping_cta', type: 'buttons', text: 'Deseja conferir a coleção ou precisa de suporte com uma entrega?', buttons: [
      link('Ir para a Loja', site + '/collections'),
      link('Rastrear Pedido', site + '/track-order'),
      postback('Falar com Atendente', 'HUMAN')
    ], next: 'shipping_wait' },
    wait('shipping_wait', 'shipping_route'),

    { id: 'shipping_route', type: 'switch', operator: 'contains', cases: [
      { id: 'shr_human', label: 'Atendente', value: 'HUMAN', next: 'human_concierge' },
      { id: 'shr_rewards', label: 'Descontos', value: 'CUPOM', next: 'rewards_info' }
    ], default: 'rewards_info' },

    // 6. Guia de Medidas & Caimento
    { id: 'size_guide', type: 'message', text: 'Guia de Medidas & Tamanhos Internacionais 📏\n\nNossas peças seguem a numeração dos EUA (US 2 ao 12):\n• US 2: Busto 84cm | Cintura 64cm | Quadril 89cm\n• US 4: Busto 86cm | Cintura 66cm | Quadril 91cm\n• US 6: Busto 89cm | Cintura 69cm | Quadril 94cm\n• US 8: Busto 91cm | Cintura 71cm | Quadril 97cm\n• US 10-12: Consulte a tabela completa no site!\n\nPara sapatos, recomendamos medir o pé em centímetros para acertar no calce!', next: 'size_cta' },
    { id: 'size_cta', type: 'buttons', text: 'Acesse a tabela interativa completa ou tire dúvidas de caimento:', buttons: [
      link('Tabela Completa', site + '/size-guide'),
      link('Ver Vestidos', site + '/collections/dresses'),
      postback('Ajuda com Tamanho', 'HUMAN')
    ], next: 'size_wait' },
    wait('size_wait', 'size_route'),

    { id: 'size_route', type: 'switch', operator: 'contains', cases: [
      { id: 'sz_help', label: 'Ajuda', value: 'HUMAN', next: 'human_concierge' },
      { id: 'sz_rewards', label: 'Descontos', value: 'CUPOM', next: 'rewards_info' }
    ], default: 'rewards_info' },

    // 7. Pós-venda e Rastreamento
    { id: 'track_order', type: 'buttons', text: 'Acompanhe sua compra ou solicite troca em até 30 dias após a entrega ✨', buttons: [
      link('Rastrear Pedido', site + '/track-order'),
      link('Política de Trocas', site + '/returns'),
      postback('Falar com Suporte', 'HUMAN')
    ], next: 'track_wait' },
    wait('track_wait', 'track_route'),

    { id: 'track_route', type: 'switch', operator: 'contains', cases: [
      { id: 'tr_help', label: 'Suporte', value: 'HUMAN', next: 'human_concierge' },
      { id: 'tr_rewards', label: 'Ver Loja', value: 'LOJA', next: 'rewards_info' }
    ], default: 'human_concierge' },

    // 8. Descontos progressivos de carrinho (Cart Rewards)
    { id: 'rewards_info', type: 'message', text: 'Benefícios exclusivos no carrinho da AMB BOUTIQUE ✨\n\n• Frete Grátis nos EUA acima de US$ 99\n• Descontos automáticos aplicados no carrinho:\n  - 5% OFF a partir de US$ 100\n  - 10% OFF a partir de US$ 200\n  - 15% OFF a partir de US$ 300\n  - 20% OFF a partir de US$ 400\n  - 25% OFF a partir de US$ 500\n\nAcesse e monte seu look: https://www.ambboutique.online', next: 'finish' },

    // 9. Atendimento Humanizado VIP
    { id: 'human_concierge', type: 'message', text: 'Com certeza! Nossa equipe de atendimento está pronta para te atender com carinho 🙂\n\nVocê também pode enviar um e-mail para info@ambboutique.online informando seu pedido ou dúvida que te responderemos prontamente!', next: 'finish' },

    // 10. Encerramento
    { id: 'finish', type: 'end' }
  ];

  const labels = {
    welcome: 'Boas-vindas AMB', first_wait: 'Aguardar resposta', reminder: 'Lembrete suave',
    first_route: 'Roteador de intenção',
    showcase: 'Vitrine San Diego', showcase_wait: 'Aguardar vitrine', showcase_route: 'Destino vitrine',
    categories_menu: 'Menu Categorias', categories_wait: 'Aguardar categoria', categories_route: 'Destino categoria',
    shipping_info: 'Prazos de Frete', shipping_cta: 'Ações de frete', shipping_wait: 'Aguardar frete', shipping_route: 'Destino frete',
    size_guide: 'Guia de Medidas', size_cta: 'Ações de tamanho', size_wait: 'Aguardar tamanho', size_route: 'Destino tamanho',
    track_order: 'Rastreio e Trocas', track_wait: 'Aguardar pós-venda', track_route: 'Destino pós-venda',
    rewards_info: 'Benefícios & Descontos', human_concierge: 'Atendente VIP', finish: 'Encerramento'
  };

  const positions = {
    welcome: [40, 320], first_wait: [370, 320], reminder: [370, 620],
    first_route: [700, 320],
    showcase: [1030, 200], showcase_wait: [1360, 200], showcase_route: [1690, 200],
    categories_menu: [2020, 200], categories_wait: [2350, 200], categories_route: [2680, 200],
    shipping_info: [1030, 500], shipping_cta: [1360, 500], shipping_wait: [1690, 500], shipping_route: [2020, 500],
    size_guide: [1030, -100], size_cta: [1360, -100], size_wait: [1690, -100], size_route: [2020, -100],
    track_order: [1030, -350], track_wait: [1360, -350], track_route: [1690, -350],
    rewards_info: [3010, 200], human_concierge: [3010, -100], finish: [3340, 200]
  };

  const layout = Object.fromEntries(nodes.map(n => [n.id, { x: positions[n.id][0], y: positions[n.id][1], label: labels[n.id] }]));

  return {
    name: 'AMB Boutique Concierge',
    trigger_type: 'comment_any',
    scope: 'all',
    configuration: {
      keywords: [],
      media_ids: [],
      entry_points: ['comment', 'dm', 'story'],
      once_per_contact: false,
      opt_out_keywords: ['PARAR', 'STOP', 'SAIR', 'CANCELAR'],
      graph: { version: 1, start: 'welcome', nodes },
      graph_layout: layout
    }
  };
}

export async function syncAmbBoutiqueFlow(db) {
  if (!db) return { error: 'no_db' };
  try {
    const workspaceId = 'b83bd3c3-0897-4bd1-8a50-2cc5933418fb';
    const account = await db.prepare('SELECT id FROM instagram_accounts WHERE username = ? OR workspace_id = ?').bind('ambb.outique', workspaceId).first();
    if (!account) return { error: 'account_not_found' };

    const flow = await db.prepare('SELECT id, version, enabled, configuration FROM flows WHERE workspace_id = ? OR account_id = ? LIMIT 1').bind(workspaceId, account.id).first();
    const preset = buildAmbBoutiqueMaster();
    const configStr = JSON.stringify(preset.configuration);

    if (flow) {
      const currentConfig = typeof flow.configuration === 'string' ? flow.configuration : JSON.stringify(flow.configuration);
      if (currentConfig.includes('AMB BOUTIQUE') && flow.enabled === 1) {
        return { ok: true, already: true, flowId: flow.id, version: flow.version, enabled: flow.enabled };
      }
      await db.prepare(
        'UPDATE flows SET configuration = ?, enabled = 1, version = version + 1 WHERE id = ?'
      ).bind(configStr, flow.id).run();
      return { ok: true, updated: true, flowId: flow.id, newVersion: flow.version + 1 };
    }

    const newId = crypto.randomUUID();
    await db.prepare(
      'INSERT INTO flows (id, workspace_id, account_id, name, trigger_type, scope, configuration, enabled, version) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1)'
    ).bind(newId, workspaceId, account.id, 'AMB Boutique Concierge', 'comment_any', 'all', configStr).run();

    return { ok: true, created: true, flowId: newId, version: 1, enabled: 1 };
  } catch (err) {
    return { error: err.message };
  }
}
