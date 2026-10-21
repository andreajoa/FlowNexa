# Commerce verification — 2026-10-21

- Full Node suite: 264 passed, 0 failed.
- After batching schema initialization: 34 commerce/conversation tests passed, 0 failed.
- `npm run check` and `git diff --check`: passed.
- Browser: actual commerce API and SQLite, mocked external Shopify responses; form connection, cleared credentials, product lookup and graph editor opening passed at 375, 768 and 1440 px without horizontal overflow or JavaScript errors. Results and screenshots are in this directory.
- WordPress plugin: parsed successfully with PHP 8 syntax using php-parser. PHP/WordPress execution was not available on this machine; this does not validate plugin runtime behavior.
- No real store credentials were supplied. No live store, real email recipient or real Instagram recipient was used in verification.
- Live provider OAuth approval, protected customer data, platform permissions, WordPress classic/Blocks recovery and actual scheduled delivery remain staging homologation requirements. See `docs/COMMERCE-INTEGRATIONS.md`.
