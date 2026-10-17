// Preset de automação cutting-edge para AMB BOUTIQUE (Instagram @ambb.outique)
// 100% in American English.
// Important Policy: AMB Boutique is an exclusively online boutique.
// "San Diego" is never mentioned in general copy. If asked for address or location,
// it explains that operation is 100% online with fulfillment facilities in multiple countries
// (including the United States, Australia, and the UK) to serve customers faster worldwide,
// avoiding physical warehouse addresses.
// Connected with AliExpress Store Manager (https://github.com/andreajoa/aliexpress-store-manager)
// to track orders, payment, shipping address, inventory, and delivery status in real time.

export function buildAmbBoutiqueMaster() {
  const site = 'https://www.ambboutique.online';
  const postback = (title, payload) => ({ type: 'postback', title, payload });
  const link = (title, url) => ({ type: 'web_url', title, url });
  const wait = (id, on_reply, on_timeout = 'finish', extra = {}) => ({
    id, type: 'wait_reply', timeout_seconds: 3600, on_reply, on_timeout, ...extra
  });

  const nodes = [
    // 1. Welcome - Editorial Concierge (Pure Online Boutique + Customer Detection)
    {
      id: 'welcome',
      type: 'message',
      text: 'Hello! Welcome to AMB BOUTIQUE ✨\n\nI’m your virtual concierge. How can I assist you today?\n\n• Already a customer? Share your Order ID / reference or tap Track Order for live parcel status.\n• Exploring new styles? Browse our curated collections & exclusive cart rewards!\n\nWhat can I help you find today?',
      text_returning: 'Wonderful to see you again at AMB BOUTIQUE ✨\n\nHow can I help you today? Would you like to check the live status of an order, explore our newest arrivals, or get sizing advice?',
      next: 'first_wait'
    },
    wait('first_wait', 'first_route', 'reminder', { timeout_seconds: 3600, on_timeout_without_window: 'finish', deadline_seconds_from_start: 259200 }),
    { id: 'reminder', type: 'message', text: 'Just checking in to make sure you have everything you need ✨ Reply anytime for sizing, styling, or order assistance. Type STOP to unsubscribe.', next: 'finish' },

    // 2. Intelligent Intent Router (Customer detection vs Inquiry)
    { id: 'first_route', type: 'switch', operator: 'contains', cases: [
      { id: 'fr_order', label: 'Order', value: 'ORDER', next: 'order_lookup' },
      { id: 'fr_pedid', label: 'Pedido', value: 'PEDID', next: 'order_lookup' },
      { id: 'fr_track', label: 'Track / Rastreio', value: 'TRACK', next: 'order_lookup' },
      { id: 'fr_bought', label: 'Bought / Comprei', value: 'BOUGHT', next: 'order_lookup' },
      { id: 'fr_code', label: 'Code / Reference', value: 'CODE', next: 'order_lookup' },
      { id: 'fr_where', label: 'Where', value: 'WHERE', next: 'location_info' },
      { id: 'fr_loc', label: 'Location', value: 'LOC', next: 'location_info' },
      { id: 'fr_addr', label: 'Address', value: 'ADDR', next: 'location_info' },
      { id: 'fr_ship', label: 'Shipping', value: 'SHIP', next: 'shipping_info' },
      { id: 'fr_size', label: 'Size', value: 'SIZE', next: 'size_guide' }
    ], default: 'showcase' },

    // 3. Location & Online Operations Policy (Explicitly Online + Worldwide Warehouses)
    { id: 'location_info', type: 'message', text: 'AMB BOUTIQUE is an exclusively online boutique ✨\n\nTo offer our customers curated collections, competitive pricing, and fast dispatch, we operate 100% online. We maintain fulfillment facilities in multiple countries, including the United States, Australia, and the United Kingdom, allowing us to serve and deliver to our customers quickly and efficiently worldwide.\n\nAll orders are processed securely through our official website: https://www.ambboutique.online', next: 'location_cta' },
    { id: 'location_cta', type: 'buttons', text: 'Explore our collections online or check shipping estimates:', buttons: [
      link('Shop All Pieces', site + '/collections'),
      postback('Shipping Estimates', 'SHIP'),
      postback('Contact Concierge', 'HELP')
    ], next: 'location_wait' },
    wait('location_wait', 'location_route'),

    { id: 'location_route', type: 'switch', operator: 'contains', cases: [
      { id: 'lr_ship', label: 'Shipping', value: 'SHIP', next: 'shipping_info' },
      { id: 'lr_help', label: 'Help', value: 'HELP', next: 'human_concierge' }
    ], default: 'customer_vip_upsell' },

    // 4. Shop All / Featured Collection (Pure contemporary style)
    { id: 'showcase', type: 'buttons', text: 'Explore our contemporary women’s collections curated for effortless style ✨', buttons: [
      link('Shop All Pieces', site + '/collections'),
      link('New In & Sale', site + '/sale'),
      postback('Browse Categories', 'CATEGORIES')
    ], next: 'showcase_wait' },
    wait('showcase_wait', 'showcase_route'),

    { id: 'showcase_route', type: 'switch', operator: 'contains', cases: [
      { id: 'sr_cat', label: 'Categories', value: 'CATEGOR', next: 'categories_menu' },
      { id: 'sr_ship', label: 'Shipping', value: 'SHIP', next: 'shipping_info' },
      { id: 'sr_size', label: 'Sizing', value: 'SIZE', next: 'size_guide' },
      { id: 'sr_order', label: 'Track Order', value: 'ORDER', next: 'order_lookup' }
    ], default: 'categories_menu' },

    // 5. Category Menu with Direct Editorial Links
    { id: 'categories_menu', type: 'buttons', text: 'Which category would you like to explore today?', buttons: [
      link('Dresses & Sets', site + '/collections/dresses'),
      link('Shoes & Heels', site + '/collections/heels'),
      link('Everyday Bags', site + '/collections/bags')
    ], next: 'categories_wait' },
    wait('categories_wait', 'categories_route'),

    { id: 'categories_route', type: 'switch', operator: 'contains', cases: [
      { id: 'cr_ship', label: 'Shipping', value: 'SHIP', next: 'shipping_info' },
      { id: 'cr_size', label: 'Sizing', value: 'SIZE', next: 'size_guide' },
      { id: 'cr_track', label: 'Track', value: 'TRACK', next: 'order_lookup' },
      { id: 'cr_help', label: 'Help', value: 'HELP', next: 'human_concierge' }
    ], default: 'customer_vip_upsell' },

    // 6. Official Shipping & Estimates by Region
    { id: 'shipping_info', type: 'message', text: 'AMB BOUTIQUE Shipping & Delivery Estimates 📦\n\n• Order Processing: In-stock orders are prepared within 1–3 business days.\n• United States: Standard delivery in 12–18 business days (Complimentary Free Shipping on orders $99+).\n• Canada & United Kingdom: ~10–21 business days after dispatch.\n• Australia & New Zealand: ~12–21 business days.\n• Tracking: Real-time tracking link emailed as soon as your parcel ships!\n\nFull details available at https://www.ambboutique.online/shipping', next: 'shipping_cta' },
    { id: 'shipping_cta', type: 'buttons', text: 'Would you like to explore the shop or track an existing order?', buttons: [
      link('Shop Collections', site + '/collections'),
      link('Track an Order', site + '/track-order'),
      postback('Contact Concierge', 'HELP')
    ], next: 'shipping_wait' },
    wait('shipping_wait', 'shipping_route'),

    { id: 'shipping_route', type: 'switch', operator: 'contains', cases: [
      { id: 'shr_human', label: 'Concierge', value: 'HELP', next: 'human_concierge' },
      { id: 'shr_vip', label: 'VIP Perks', value: 'VIP', next: 'customer_vip_upsell' }
    ], default: 'customer_vip_upsell' },

    // 7. Size Guide & Fit Guidance
    { id: 'size_guide', type: 'message', text: 'Size & Fit Guidance 📏\n\nOur garments follow standard U.S. sizing (US 2 to 12):\n• US 2: Bust 33" (84cm) | Waist 25" (64cm) | Hip 35" (89cm)\n• US 4: Bust 34" (86cm) | Waist 26" (66cm) | Hip 36" (91cm)\n• US 6: Bust 35" (89cm) | Waist 27" (69cm) | Hip 37" (94cm)\n• US 8: Bust 36" (91cm) | Waist 28" (71cm) | Hip 38" (97cm)\n• US 10–12: Check our full interactive guide online!\n\nFor shoes, we recommend measuring foot length in centimeters for the perfect fit.', next: 'size_cta' },
    { id: 'size_cta', type: 'buttons', text: 'View our complete interactive size chart or reach out for fit advice:', buttons: [
      link('Full Size Guide', site + '/size-guide'),
      link('Shop Dresses', site + '/collections/dresses'),
      postback('Fit Advice', 'HELP')
    ], next: 'size_wait' },
    wait('size_wait', 'size_route'),

    { id: 'size_route', type: 'switch', operator: 'contains', cases: [
      { id: 'sz_help', label: 'Help', value: 'HELP', next: 'human_concierge' },
      { id: 'sz_vip', label: 'VIP Perks', value: 'VIP', next: 'customer_vip_upsell' }
    ], default: 'customer_vip_upsell' },

    // 8. Order Lookup & Fulfillment Integration (AliExpress Store Manager)
    {
      id: 'order_lookup',
      type: 'message',
      text: 'Order & Delivery Concierge 📦✨\n\nOur system is connected in real time to our fulfillment and inventory manager (AliExpress Store Manager) which synchronizes all store sales, items bought, payment, shipping address, and live parcel tracking in real time.\n\nTo view your complete order details, carrier updates, and expected delivery date, simply open our live tracker below using your Order ID or checkout email. If you need an exchange or quick address update, our team is right here!',
      next: 'order_cta'
    },
    {
      id: 'order_cta',
      type: 'buttons',
      text: 'Track your order live, unlock VIP perks, or reach our concierge:',
      buttons: [
        link('Track My Order', site + '/track-order'),
        postback('VIP Member Perks', 'VIP'),
        postback('Contact Support', 'HELP')
      ],
      next: 'order_wait'
    },
    wait('order_wait', 'order_route'),

    {
      id: 'order_route',
      type: 'switch',
      operator: 'contains',
      cases: [
        { id: 'or_help', label: 'Support', value: 'HELP', next: 'human_concierge' },
        { id: 'or_vip', label: 'VIP Perks', value: 'VIP', next: 'customer_vip_upsell' },
        { id: 'or_shop', label: 'Shop Collections', value: 'SHOP', next: 'customer_vip_upsell' }
      ],
      default: 'customer_vip_upsell'
    },

    // 9. Customer Cross-Sell & VIP Upsell
    {
      id: 'customer_vip_upsell',
      type: 'message',
      text: 'Exclusive VIP Perk for AMB Clients ✨\n\nThank you for choosing AMB BOUTIQUE! To celebrate your style, we’ve unlocked an exclusive returning-client perk for you:\n\n• Use code VIP10 at checkout for an extra 10% OFF your next piece\n• Stackable with our automatic Tiered Cart Rewards (save up to 25% on $500+ orders)\n• Complimentary U.S. Shipping on orders $99+\n\nExplore our latest statement heels and dresses:',
      next: 'vip_cta'
    },
    {
      id: 'vip_cta',
      type: 'buttons',
      text: 'Explore our latest curated drops with your VIP perk:',
      buttons: [
        link('Shop All Pieces', site + '/collections'),
        link('Shoes & Heels', site + '/collections/heels'),
        link('Dresses & Sets', site + '/collections/dresses')
      ],
      next: 'finish'
    },

    // 10. Personal Concierge & Human Support
    {
      id: 'human_concierge',
      type: 'message',
      text: 'Our team is here to assist you personally! 🙂\n\nIf you have a question about an existing order or need help with sizing, email us directly at info@ambboutique.online with your Order ID, and a dedicated stylist will respond promptly.\n\nPrefer to keep shopping? Visit https://www.ambboutique.online',
      next: 'finish'
    },

    // 11. Finish
    { id: 'finish', type: 'end' }
  ];

  const labels = {
    welcome: 'Welcome AMB', first_wait: 'Wait Reply', reminder: 'Gentle Reminder',
    first_route: 'Intent Router',
    location_info: 'Online Boutique Policy', location_cta: 'Online Actions', location_wait: 'Wait Location', location_route: 'Location Target',
    order_lookup: 'Order & Fulfillment System', order_cta: 'Order Actions', order_wait: 'Wait Order', order_route: 'Order Target',
    size_guide: 'Size Guidance', size_cta: 'Size Actions', size_wait: 'Wait Size', size_route: 'Size Target',
    showcase: 'Featured Showcase', showcase_wait: 'Wait Showcase', showcase_route: 'Showcase Target',
    categories_menu: 'Categories Menu', categories_wait: 'Wait Category', categories_route: 'Category Target',
    shipping_info: 'Shipping Estimates', shipping_cta: 'Shipping Actions', shipping_wait: 'Wait Shipping', shipping_route: 'Shipping Target',
    customer_vip_upsell: 'VIP Client Upsell', vip_cta: 'VIP Drops Shop', human_concierge: 'Personal Concierge', finish: 'End Conversation'
  };

  const positions = {
    welcome: [40, 320], first_wait: [370, 320], reminder: [370, 620],
    first_route: [700, 320],
    location_info: [1030, -500], location_cta: [1360, -500], location_wait: [1690, -500], location_route: [2020, -500],
    order_lookup: [1030, -200], order_cta: [1360, -200], order_wait: [1690, -200], order_route: [2020, -200],
    size_guide: [1030, 80], size_cta: [1360, 80], size_wait: [1690, 80], size_route: [2020, 80],
    showcase: [1030, 350], showcase_wait: [1360, 350], showcase_route: [1690, 350],
    categories_menu: [2020, 350], categories_wait: [2350, 350], categories_route: [2680, 350],
    shipping_info: [1030, 600], shipping_cta: [1360, 600], shipping_wait: [1690, 600], shipping_route: [2020, 600],
    customer_vip_upsell: [3010, 150], vip_cta: [3340, 150],
    human_concierge: [3010, -100], finish: [3670, 150]
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
      if (currentConfig.includes('order_lookup') && currentConfig.includes('customer_vip_upsell') && !currentConfig.includes('San Diego') && flow.enabled === 1) {
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

