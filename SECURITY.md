# Produção: requisitos bloqueantes

- Sem ações Meta reais até OAuth e app review concluídos.
- Tokens Meta criptografados em repouso; key de criptografia somente em secret manager.
- Proteção de login: rate-limiting por IP/conta, confirmação de e-mail, recuperação segura, 2FA ou passkeys.
- RBAC testado, isolamento de tenant, trilha de auditoria, observabilidade e retenção de dados.
- Webhooks: assinatura válida, replay controlado e fila de processamento com idempotência.
- Janelas de mensagens e consentimento avaliados para cada ação da API.
- LGPD: termos, finalidade, direitos de titulares e exclusão de dados.
- Gestão de quotas: hard limit que interrompe operações antes da cobrança.
- Testes de integração em oito contas reais e simulação de falhas.
- Nunca usar dados reais para desenvolvimento sem base legal e autorização.
- IMPORTANTE: endpoints de cadastro são fundação de desenvolvimento e NÃO devem ser publicados externamente sem anti-abuso, e-mail verificado e proteção de sessão completa.

A ausência de qualquer etapa significa: NÃO PRONTO PARA PRODUÇÃO.
