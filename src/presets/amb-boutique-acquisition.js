// Preset de automação cutting-edge para AMB BOUTIQUE (Instagram @ambb.outique)
// 100% in American English, matching the official storefront: https://www.ambboutique.online
// Founded by Ana Paula Maciel in San Diego, California.

export function buildAmbBoutiqueMaster() {
  const site = 'https://www.ambboutique.online';
  const postback = (title, payload) => ({ type: 'postback', title, payload });
  const link = (title, url) => ({ type: 'web_url', title, url });
  const wait = (id, on_reply, on_timeout = 'finish', extra = {}) => ({
    id, type: 'wait_reply', timeout_seconds: 3600, on_reply, on_timeout, ...extra
  });

  const nodes = [
    // 1. Welcome - Editorial San Diego Concierge
    {
      id: 'welcome',
      type: 'message',
      text: 'Hello! Welcome to AMB BOUTIQUE ✨\n\nI’m your virtual concierge from San Diego, California. How can I help you today? Would you like to explore our latest pieces, check our size guide & shipping, or track an existing order?',
      text_returning: 'Wonderful to see you again at AMB BOUTIQUE ✨\n\nHow can I help you today? Would you like to explore new arrivals, check our sizing & delivery estimates, or get help with an order?',
      next: 'first_wait'
    },
    wait('first_wait', 'first_route', 'reminder', { timeout_seconds: 3600, on_timeout_without_window: 'finish', deadline_seconds_from_start: 259200 }),
    { id: 'reminder', type: 'message', text: 'Just checking in to make sure you have everything you need ✨ Reply anytime for sizing, styling, or order assistance. Type STOP to unsubscribe.', next: 'finish' },

    // 2. Intelligent Intent Router (Bilingual triggers -> American English response)
    { id: 'first_route', type: 'switch', operator: 'contains', cases: [
      { id: 'fr_order', label: 'Order', value: 'ORDER', next: 'track_order' },
      { id: 'fr_pedid', label: 'Pedido', value: 'PEDID', next: 'track_order' },
      { id: 'fr_track', label: 'Track / Rastreio', value: 'TRACK', next: 'track_order' },
      { id: 'fr_ship', label: 'Shipping', value: 'SHIP', next: 'shipping_info' },
      { id: 'fr_fret', label: 'Frete', value: 'FRET', next: 'shipping_info' },
      { id: 'fr_deliv', label: 'Delivery', value: 'DELIV', next: 'shipping_info' },
      { id: 'fr_size', label: 'Size', value: 'SIZE', next: 'size_guide' },
      { id: 'fr_tamanh', label: 'Tamanho', value: 'TAMANH', next: 'size_guide' },
      { id: 'fr_fit', label: 'Fit', value: 'FIT', next: 'size_guide' },
      { id: 'fr_human', label: 'Human / Support', value: 'HUMAN', next: 'human_concierge' }
    ], default: 'showcase' },

    // 3. Shop All / Featured Collection
    { id: 'showcase', type: 'buttons', text: 'Explore contemporary women’s pieces curated in San Diego, California ✨', buttons: [
      link('Shop All Pieces', site + '/collections'),
      link('New In & Sale', site + '/sale'),
      postback('Browse Categories', 'CATEGORIES')
    ], next: 'showcase_wait' },
    wait('showcase_wait', 'showcase_route'),

    { id: 'showcase_route', type: 'switch', operator: 'contains', cases: [
      { id: 'sr_cat', label: 'Categories', value: 'CATEGOR', next: 'categories_menu' },
      { id: 'sr_ship', label: 'Shipping', value: 'SHIP', next: 'shipping_info' },
      { id: 'sr_size', label: 'Sizing', value: 'SIZE', next: 'size_guide' },
      { id: 'sr_help', label: 'Help', value: 'HELP', next: 'human_concierge' }
    ], default: 'categories_menu' },

    // 4. Category Menu with Direct Editorial Links
    { id: 'categories_menu', type: 'buttons', text: 'Which category would you like to explore today?', buttons: [
      link('Dresses & Sets', site + '/collections/dresses'),
      link('Shoes & Heels', site + '/collections/heels'),
      link('Everyday Bags', site + '/collections/bags')
    ], next: 'categories_wait' },
    wait('categories_wait', 'categories_route'),

    { id: 'categories_route', type: 'switch', operator: 'contains', cases: [
      { id: 'cr_ship', label: 'Shipping', value: 'SHIP', next: 'shipping_info' },
      { id: 'cr_size', label: 'Sizing', value: 'SIZE', next: 'size_guide' },
      { id: 'cr_track', label: 'Track', value: 'TRACK', next: 'track_order' },
      { id: 'cr_help', label: 'Help', value: 'HELP', next: 'human_concierge' }
    ], default: 'rewards_info' },

    // 5. Official Shipping & Estimates by Region
    { id: 'shipping_info', type: 'message', text: 'AMB BOUTIQUE Shipping & Delivery Estimates 📦\n\n• Order Processing: In-stock orders are prepared within 1–3 business days.\n• United States: Standard delivery in 12–18 business days (Complimentary Free Shipping on orders $99+).\n• Canada & United Kingdom: ~10–21 business days after dispatch.\n• Australia & New Zealand: ~12–21 business days.\n• Tracking: Real-time tracking link emailed as soon as your parcel ships!\n\nFull details available at https://www.ambboutique.online/shipping', next: 'shipping_cta' },
    { id: 'shipping_cta', type: 'buttons', text: 'Would you like to explore the shop or track an existing order?', buttons: [
      link('Shop Collections', site + '/collections'),
      link('Track an Order', site + '/track-order'),
      postback('Contact Concierge', 'HELP')
    ], next: 'shipping_wait' },
    wait('shipping_wait', 'shipping_route'),

    { id: 'shipping_route', type: 'switch', operator: 'contains', cases: [
      { id: 'shr_human', label: 'Concierge', value: 'HELP', next: 'human_concierge' },
      { id: 'shr_rewards', label: 'Rewards', value: 'REWARD', next: 'rewards_info' }
    ], default: 'rewards_info' },

    // 6. Size Guide & Fit Guidance
    { id: 'size_guide', type: 'message', text: 'Size & Fit Guidance 📏\n\nOur garments follow standard U.S. sizing (US 2 to 12):\n• US 2: Bust 33" (84cm) | Waist 25" (64cm) | Hip 35" (89cm)\n• US 4: Bust 34" (86cm) | Waist 26" (66cm) | Hip 36" (91cm)\n• US 6: Bust 35" (89cm) | Waist 27" (69cm) | Hip 37" (94cm)\n• US 8: Bust 36" (91cm) | Waist 28" (71cm) | Hip 38" (97cm)\n• US 10–12: Check our full interactive guide online!\n\nFor shoes, we recommend measuring foot length in centimeters for the perfect fit.', next: 'size_cta' },
    { id: 'size_cta', type: 'buttons', text: 'View our complete interactive size chart or reach out for fit advice:', buttons: [
      link('Full Size Guide', site + '/size-guide'),
      link('Shop Dresses', site + '/collections/dresses'),
      postback('Fit Advice', 'HELP')
    ], next: 'size_wait' },
    wait('size_wait', 'size_route'),

    { id: 'size_route', type: 'switch', operator: 'contains', cases: [
      { id: 'sz_help', label: 'Help', value: 'HELP', next: 'human_concierge' },
      { id: 'sz_rewards', label: 'Rewards', value: 'REWARD', next: 'rewards_info' }
    ], default: 'rewards_info' },

    // 7. Post-Purchase Tracking & 30-Day Returns
    { id: 'track_order', type: 'buttons', text: 'Track your order or request an eligible exchange within 30 days ✨', buttons: [
      link('Track My Order', site + '/track-order'),
      link('30-Day Returns', site + '/returns'),
      postback('Contact Support', 'HELP')
    ], next: 'track_wait' },
    wait('track_wait', 'track_route'),

    { id: 'track_route', type: 'switch', operator: 'contains', cases: [
      { id: 'tr_help', label: 'Support', value: 'HELP', next: 'human_concierge' },
      { id: 'tr_rewards', label: 'Shop', value: 'SHOP', next: 'rewards_info' }
    ], default: 'human_concierge' },

    // 8. Tiered Cart Rewards & Margin Protection
    { id: 'rewards_info', type: 'message', text: 'Exclusive Cart Rewards at AMB BOUTIQUE ✨\n\n• Complimentary U.S. Shipping on orders $99+\n• Automatic Tiered Cart Rewards:\n  - 5% OFF at $100\n  - 10% OFF at $200\n  - 15% OFF at $300\n  - 20% OFF at $400\n  - 25% OFF at $500\n\nBuild your capsule wardrobe today at https://www.ambboutique.online', next: 'finish' },

    // 9. Personal Concierge & Human Support
    { id: 'human_concierge', type: 'message', text: 'We’d love to assist you personally! 🙂\n\nFeel free to email us directly at info@ambboutique.online with your order number or question, and our team will get back to you promptly!', next: 'finish' },

    // 10. Finish
    { id: 'finish', type: 'end' }
  ];

  const labels = {
    welcome: 'Welcome AMB', first_wait: 'Wait Reply', reminder: 'Gentle Reminder',
    first_route: 'Intent Router',
    showcase: 'San Diego Showcase', showcase_wait: 'Wait Showcase', showcase_route: 'Showcase Target',
    categories_menu: 'Categories Menu', categories_wait: 'Wait Category', categories_route: 'Category Target',
    shipping_info: 'Shipping Estimates', shipping_cta: 'Shipping Actions', shipping_wait: 'Wait Shipping', shipping_route: 'Shipping Target',
    size_guide: 'Size Guidance', size_cta: 'Size Actions', size_wait: 'Wait Size', size_route: 'Size Target',
    track_order: 'Order & Returns', track_wait: 'Wait Tracking', track_route: 'Tracking Target',
    rewards_info: 'Tiered Cart Rewards', human_concierge: 'Personal Concierge', finish: 'End Conversation'
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
      opt_out_keywords: ['STOP', 'UNSUBSCRIBE', 'PARAR', 'CANCEL'],
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
      if (currentConfig.includes('Hello! Welcome to AMB BOUTIQUE') && flow.enabled === 1) {
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
