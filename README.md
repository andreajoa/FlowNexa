# FlowNexa

Plataforma multi-conta de automação Instagram, com editor visual, templates e isolamento por workspace.

> STATUS: desenvolvimento. NÃO habilitar disparos reais até autorização Meta, teste de webhooks, revisão de segurança e certificação. Meta login profissional via OAuth, nunca capturar senhas Instagram.

## Arquitetura

- Cloudflare Worker (API e frontend), D1 (SQLite)
- Workspaces, contas Instagram, fluxos e execuções isolados por tenant
- Webhook Meta: assinatura HMAC-SHA256 e idempotência
- Automação sempre desativada por padrão (kill switch)
- Oito ou mais contas por arquitetura, sem limite fixo de código
- Templates de palavra-chave, resposta genérica e funis; editor de JSON até o editor drag-and-drop ser implementado

## Instalação

```bash
npm install
npx wrangler d1 create flownexa
# inserir o database_id em wrangler.toml
npx wrangler d1 migrations apply flownexa --local
npm test
npm run dev
```

Secrets obrigatórios de produção: `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_APP_ID`, `SESSION_SECRET` e `TOKEN_ENCRYPTION_KEY`. Nunca commitar segredos. A integração OAuth, autenticação de usuários e envio real exigem implementação e validação antes de qualquer uso.

## Política de segurança

A API de demonstração não pode disparar mensagens reais. Integrações e credenciais não devem ser copiadas do publicador existente. Desabilitado por padrão. Nenhum pagamento automático é habilitado.

## Referências

- https://www.postman.com/meta/instagram/folder/1z5vxzu/instagram-api-with-instagram-login
- https://developers.cloudflare.com/workers/
