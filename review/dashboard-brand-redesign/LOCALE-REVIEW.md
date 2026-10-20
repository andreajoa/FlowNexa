# Dashboard and pricing review — 20 October 2026

The dashboard now follows the supplied landing-page references with dark borders, solid offset shadows, heavy headings, a yellow primary creation button, purple navigation, and restrained mint accents. The mobile AI connection heading now stacks above its action.

Pricing uses the displayed document language before browser preferences: Portuguese selects BRL, English selects USD. Stored currency preferences are ignored. Language changes refresh pricing; checkout links carry the language into the dashboard. Monthly/yearly controls show two plans at a time. Catalog amounts are reused unchanged from the existing `feat/stripe-localized-subscriptions` branch; no Stripe products or prices are created or edited. The backend still validates the chosen plan against its configured Stripe price map.

This preview is based on `76c2663` (dashboard redesign). It does not merge the separate Instagram, Facebook, or Stripe backend branches. This change adds localized pricing, not a complete translation of every page or dashboard control. No live purchase, message sending, or customer-data mutation is part of verification.

Browser checks use intercepted requests and fixture accounts, cover 320/375/768/1024/1440px, login navigation, the graph dialog, sidebar navigation, empty states, BRL/USD language changes, stale currency storage, and monthly/yearly prices. Screenshots and visual-results.json are generated locally by visual-check.mjs.
