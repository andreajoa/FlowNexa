// Preset de automação para AMB BOUTIQUE (Instagram @ambb.outique)
// 100% American English. Persona: "Jasmin L.", the AMB virtual stylist.
// Voice: warm, gracious, elegant and gently persuasive — never blunt. The audience is women.
// Jasmin always presents herself as a *virtual* stylist (honest about being automated).
// If a client says Jasmin is the name of her daughter, sister, mom, aunt, grandma, friend...
// Jasmin reacts sweetly and gracefully guides the conversation back to shopping.
// Policies: 100% online boutique; never name suppliers; deliver to all 50 U.S. states.

export function buildAmbBoutiqueMaster() {
  const site = 'https://www.ambboutique.online';
  const postback = (title, payload) => ({ type: 'postback', title, payload });
  const link = (title, url) => ({ type: 'web_url', title, url });
  const wait = (id, on_reply, on_timeout = 'finish', extra = {}) => ({
    id, type: 'wait_reply', timeout_seconds: 3600, on_reply, on_timeout, ...extra
  });

  const nodes = [
    // 1. Welcome — Jasmin introduces herself with warmth, links and quick options
    {
      id: 'welcome',
      type: 'message',
      text: 'Hi there, lovely! 🌸 Welcome to AMB BOUTIQUE.\n\nI’m Jasmin L., your AMB virtual stylist, and I’m so happy you stopped by! ✨\n\nWhether you’re dreaming of the perfect midi dress, curious about delivery, or checking on an order, I’m here for you:\n\n💕 Our collections: https://www.ambboutique.online/collections\n📦 Order tracker: https://www.ambboutique.online/track-order\n🇺🇸 We deliver beautifully to all 50 U.S. states\n\nJust tap an option below or tell me what you have in mind 😊',
      text_returning: 'Welcome back, beautiful! 🌸 It’s Jasmin L., your AMB virtual stylist — so lovely to see you again! ✨\n\nWhat can I help you with today? A new favorite dress, a little update on your order, or delivery details? I’m all yours 💕\n\n👗 Collections: https://www.ambboutique.online/collections\n📦 Order tracker: https://www.ambboutique.online/track-order',
      quick_replies: [
        { title: '👗 Midi Dresses', payload: 'DRESS' },
        { title: '📦 Track My Order', payload: 'ORDER' },
        { title: '🚚 Delivery & Times', payload: 'DELIV' },
        { title: '💎 VIP Perk 10% OFF', payload: 'VIP' }
      ],
      next: 'first_wait'
    },
    wait('first_wait', 'first_route', 'reminder', { timeout_seconds: 3600, on_timeout_without_window: 'finish', deadline_seconds_from_start: 259200 }),
    { id: 'reminder', type: 'message', text: 'Just a gentle hello from Jasmin 🌸 I’m still right here whenever you’d like a little styling advice, sizing help, or an update on your order. Take your time, lovely 💕\n\n(Reply STOP anytime to unsubscribe.)', next: 'finish' },

    // 2. Intent router — name coincidence, orders, dresses, delivery, sizing, VIP
    { id: 'first_route', type: 'switch', operator: 'contains', cases: [
      { id: 'fr_name', label: 'Name Jasmin', value: 'JASMIN', next: 'name_moment' },
      { id: 'fr_order', label: 'Order', value: 'ORDER', next: 'order_lookup' },
      { id: 'fr_track', label: 'Track', value: 'TRACK', next: 'order_lookup' },
      { id: 'fr_dress', label: 'Dresses / Midi', value: 'DRESS', next: 'dresses_info' },
      { id: 'fr_loc', label: 'Location / Boutique', value: 'LOC', next: 'location_info' },
      { id: 'fr_sandiego', label: 'San Diego / CA', value: 'SAN DIEGO', next: 'shipping_info' },
      { id: 'fr_deliv', label: 'Delivery / Deliver', value: 'DELIV', next: 'shipping_info' },
      { id: 'fr_ship', label: 'Shipping / Ship', value: 'SHIP', next: 'shipping_info' },
      { id: 'fr_size', label: 'Size & Fit', value: 'SIZE', next: 'size_guide' },
      { id: 'fr_vip', label: 'VIP Perk', value: 'VIP', next: 'customer_vip_upsell' }
    ], default: 'showcase' },

    // 3. Name coincidence — sweet reaction, then gracefully back to the boutique
    { id: 'name_moment', type: 'message', text: 'Oh, that’s just the sweetest! 🥹💕 What a lovely coincidence — clearly Jasmin is a name for wonderful women! Please send her a warm hug from me.\n\nNow, let me spoil you a little… I’ve picked a few pieces I think you’ll absolutely adore ✨', next: 'showcase' },

    // 4. Online boutique policy
    { id: 'location_info', type: 'message', text: 'Such a great question, lovely! 🌸\n\nAMB BOUTIQUE is an exclusively online boutique — that’s how we bring you curated collections at thoughtful prices, without showroom markups.\n\nWe have fulfillment centers in several countries, including the United States, Australia and the United Kingdom, so your pieces reach you quickly and safely, right at your doorstep 💕\n\nYou can explore everything here: https://www.ambboutique.online', next: 'location_cta' },
    { id: 'location_cta', type: 'buttons', text: 'Would you like to browse or see delivery times? 💕', buttons: [
      link('Shop All Pieces', site + '/collections'),
      postback('Delivery Times', 'DELIV'),
      postback('Talk to Our Team', 'HELP')
    ], next: 'location_wait' },
    wait('location_wait', 'location_route'),

    { id: 'location_route', type: 'switch', operator: 'contains', cases: [
      { id: 'lr_ship', label: 'Shipping', value: 'DELIV', next: 'shipping_info' },
      { id: 'lr_help', label: 'Help', value: 'HELP', next: 'human_concierge' }
    ], default: 'customer_vip_upsell' },

    // 5. Showcase
    { id: 'showcase', type: 'buttons', text: 'Pieces our clients are loving right now ✨', buttons: [
      link('Shop All Pieces', site + '/collections'),
      link('Midi & Dresses', site + '/collections/dresses'),
      postback('My VIP Perk', 'VIP')
    ], next: 'showcase_wait' },
    wait('showcase_wait', 'showcase_route'),

    { id: 'showcase_route', type: 'switch', operator: 'contains', cases: [
      { id: 'sr_dress', label: 'Dresses', value: 'DRESS', next: 'dresses_info' },
      { id: 'sr_midi', label: 'Midi', value: 'MIDI', next: 'dresses_info' },
      { id: 'sr_ship', label: 'Shipping', value: 'DELIV', next: 'shipping_info' },
      { id: 'sr_order', label: 'Track Order', value: 'ORDER', next: 'order_lookup' }
    ], default: 'customer_vip_upsell' },

    // 6. Shipping (explicit U.S. / San Diego confirmation)
    { id: 'shipping_info', type: 'message', text: 'Absolutely, lovely! 🌸 We deliver to all 50 U.S. states — San Diego and all of California included 💕\n\nHere’s how it works:\n• Your order is lovingly prepared within 1–3 business days\n• U.S. delivery: 12–18 business days\n• Complimentary U.S. shipping on orders $99+ ✨\n• Canada & UK: about 10–21 business days\n• Australia & New Zealand: about 12–21 business days\n• You’ll receive a tracking link so you can follow your pieces all the way to your door\n\nAll the details: https://www.ambboutique.online/shipping', next: 'shipping_cta' },
    { id: 'shipping_cta', type: 'buttons', text: 'Shall we find your next favorite piece? 💕', buttons: [
      link('Shop Collections', site + '/collections'),
      link('Track an Order', site + '/track-order'),
      postback('Talk to Our Team', 'HELP')
    ], next: 'shipping_wait' },
    wait('shipping_wait', 'shipping_route'),

    { id: 'shipping_route', type: 'switch', operator: 'contains', cases: [
      { id: 'shr_human', label: 'Concierge', value: 'HELP', next: 'human_concierge' },
      { id: 'shr_vip', label: 'VIP Perks', value: 'VIP', next: 'customer_vip_upsell' }
    ], default: 'customer_vip_upsell' },

    // 7. Size guide
    { id: 'size_guide', type: 'message', text: 'Finding your perfect fit is my favorite part! 📏💕\n\nOur pieces follow standard U.S. sizing:\n• US 2: Bust 33" | Waist 25" | Hip 35"\n• US 4: Bust 34" | Waist 26" | Hip 36"\n• US 6: Bust 35" | Waist 27" | Hip 37"\n• US 8: Bust 36" | Waist 28" | Hip 38"\n• US 10–12: see our full guide online\n\nFor shoes, measuring your foot length in centimeters gives the most flattering fit. If you’re between sizes, just tell me — I’m happy to help you choose 🌸\n\nFull guide: https://www.ambboutique.online/size-guide', next: 'size_cta' },
    { id: 'size_cta', type: 'buttons', text: 'Your full size guide, or a little fit advice? 🌸', buttons: [
      link('Full Size Guide', site + '/size-guide'),
      link('Shop Dresses', site + '/collections/dresses'),
      postback('Fit Advice', 'HELP')
    ], next: 'size_wait' },
    wait('size_wait', 'size_route'),

    { id: 'size_route', type: 'switch', operator: 'contains', cases: [
      { id: 'sz_help', label: 'Help', value: 'HELP', next: 'human_concierge' },
      { id: 'sz_vip', label: 'VIP Perks', value: 'VIP', next: 'customer_vip_upsell' }
    ], default: 'customer_vip_upsell' },

    // 8. Order lookup (100% AMB branded)
    {
      id: 'order_lookup',
      type: 'message',
      text: 'Of course, lovely! I’d be delighted to help you with your order 📦💕\n\nYou can see everything about it — your pieces, delivery address, and every step of the journey to your door — right here, using your order number or checkout email:\n👉 https://www.ambboutique.online/track-order\n\nIf anything needs a little attention, like an exchange or an address update, our team will gladly take care of it for you 🌸',
      next: 'order_cta'
    },
    {
      id: 'order_cta',
      type: 'buttons',
      text: 'Follow your order, or unlock a little gift? ✨',
      buttons: [
        link('Track My Order', site + '/track-order'),
        postback('My VIP Perk', 'VIP'),
        postback('Talk to Our Team', 'HELP')
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
        { id: 'or_dress', label: 'Midi Dresses', value: 'DRESS', next: 'dresses_info' }
      ],
      default: 'customer_vip_upsell'
    },

    // 9. Midi dresses
    {
      id: 'dresses_info',
      type: 'message',
      text: 'Oh, you have wonderful taste! 😍 Yes, we have gorgeous midi dresses waiting for you 💕\n\nFrom effortless everyday silhouettes to elegant evening looks, each one is chosen for a soft, flattering drape and beautiful fabrics — the kind of dress that makes you feel special the moment you put it on ✨\n\nTake a peek here:\n👉 https://www.ambboutique.online/collections/dresses\n\nAnd a little secret: use code VIP10 at checkout for an extra 10% OFF 🌸',
      next: 'dresses_cta'
    },
    {
      id: 'dresses_cta',
      type: 'buttons',
      text: 'Shall I show you the dresses, lovely? 💕',
      buttons: [
        link('Shop Midi Dresses', site + '/collections/dresses'),
        link('Shop All Pieces', site + '/collections'),
        postback('Ask Our Stylists', 'HELP')
      ],
      next: 'finish'
    },

    // 10. VIP perk
    {
      id: 'customer_vip_upsell',
      type: 'message',
      text: 'I saved something special just for you 💎✨\n\n• Code VIP10 — an extra 10% OFF your order\n• Automatic cart rewards — up to 25% OFF on orders of $500+\n• Complimentary U.S. shipping on orders $99+\n\nIt’s the perfect excuse to treat yourself 💕\n👉 https://www.ambboutique.online/collections\n\nAnd if you’d love help choosing a dress, shoes or your size, just ask me 🌸',
      next: 'vip_cta'
    },
    {
      id: 'vip_cta',
      type: 'buttons',
      text: 'Treat yourself with code VIP10 ✨',
      buttons: [
        link('Shop Midi Dresses', site + '/collections/dresses'),
        link('Shoes & Heels', site + '/collections/heels'),
        link('Shop All Pieces', site + '/collections')
      ],
      next: 'finish'
    },

    // 11. Human team
    {
      id: 'human_concierge',
      type: 'message',
      text: 'I’d love for our team to take care of you personally 🌸\n\nJust email info@ambboutique.online with your order number (if you have one), and one of our stylists will get back to you very soon 💕\n\nIn the meantime, feel free to browse: https://www.ambboutique.online',
      next: 'finish'
    },

    { id: 'finish', type: 'end' }
  ];

  const labels = {
    welcome: 'Welcome (Jasmin L.)', first_wait: 'Wait Reply', reminder: 'Gentle Reminder',
    first_route: 'Intent Router', name_moment: 'Name Coincidence',
    location_info: 'Online Boutique Policy', location_cta: 'Online Actions', location_wait: 'Wait Location', location_route: 'Location Target',
    order_lookup: 'Order & Tracking Portal', order_cta: 'Order Actions', order_wait: 'Wait Order', order_route: 'Order Target',
    dresses_info: 'Midi Dresses Info', dresses_cta: 'Midi Dress Actions',
    size_guide: 'Size Guidance', size_cta: 'Size Actions', size_wait: 'Wait Size', size_route: 'Size Target',
    showcase: 'Featured Showcase', showcase_wait: 'Wait Showcase', showcase_route: 'Showcase Target',
    shipping_info: 'Shipping Estimates', shipping_cta: 'Shipping Actions', shipping_wait: 'Wait Shipping', shipping_route: 'Shipping Target',
    customer_vip_upsell: 'VIP Client Upsell', vip_cta: 'VIP Drops Shop', human_concierge: 'Personal Concierge', finish: 'End Conversation'
  };

  const positions = {
    welcome: [40, 320], first_wait: [370, 320], reminder: [370, 620],
    first_route: [700, 320], name_moment: [700, 620],
    location_info: [1030, -500], location_cta: [1360, -500], location_wait: [1690, -500], location_route: [2020, -500],
    order_lookup: [1030, -200], order_cta: [1360, -200], order_wait: [1690, -200], order_route: [2020, -200],
    dresses_info: [1030, -50], dresses_cta: [1360, -50],
    size_guide: [1030, 150], size_cta: [1360, 150], size_wait: [1690, 150], size_route: [2020, 150],
    showcase: [1030, 350], showcase_wait: [1360, 350], showcase_route: [1690, 350],
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
      if (currentConfig === configStr && flow.enabled === 1) {
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
