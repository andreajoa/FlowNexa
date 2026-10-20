# Concluído: Stripe e planos localizados do FlowNexa

Stripe ativada em produção em 18/10/2026 (horário de São Paulo). O titular concluiu a verificação exigida pela Stripe. O provisionamento e a publicação foram concluídos sem cobrança de teste e sem alterar produtos ou configurações do Atenza.

## Produção atual

- Site: https://flownex.online
- Deployment: `dpl_Euw1dSJEGfV12YD8mqtub51Hy6Hf`
- Release: https://flownexa-fo9lyb9ua-flownexa3.vercel.app
- Código: `aed9016`, branch `feat/stripe-localized-subscriptions`, PR https://github.com/andreajoa/FlowNexa/pull/16
- Vercel: projeto `flownexa`, equipe `flownexa3`.
- Conta Stripe CoreUnit confirmada pelos três produtos Atenza existentes. Catálogo FlowNexa separado: dois produtos, oito preços; portal exclusivo; webhook https://flownex.online/webhooks/stripe.
- Segredos configurados como variáveis sensíveis na Vercel. Não imprimir, copiar para o repositório ou reutilizar os segredos do Atenza.
- `BILLING_ENFORCED=true`; corte `BILLING_LEGACY_BEFORE=2026-10-19T00:11:58Z`. Espaços anteriores preservados; novos espaços exigem assinatura para os recursos protegidos.

## Preços aprovados

Pro: R$59,90/mês ou R$599/ano; US$9,90/mês ou US$129/ano. Uma conta Instagram e 10.000 envios/mês calendário UTC.

Equipes: R$119,90/mês ou R$1.199/ano; US$24,90/mês ou US$249/ano. Duas contas Instagram e 20.000 envios/mês calendário UTC.

O proprietário pediu preservar o anual Pro USD em US$129, embora doze mensalidades de US$9,90 somem US$118,80. Não anunciar desconto nesse caso. Anuais cobrados integralmente. Sem cobrança automática de excedentes. Idioma português seleciona BRL, inglês/demais idiomas USD; troca manual permitida.

## Evidências

- 180 testes Node passaram na implementação; após a mudança de preço passaram 27 testes focados e navegador pt-BR/en-US, incluindo moeda, anual integral, checkout simulado e celular.
- Regressão dos fluxos do Gilberto passou sem envios reais.
- Stripe real: oito preços, portal e webhook conferidos. Checkout Pro USD de 990 centavos criado e expirado sem cartão ou cobrança.
- Release verificado antes da promoção: saúde OK, preços e JavaScript corretos, domínio público preservado até a promoção.
- Webhook rejeitou POST sem assinatura com HTTP 400 `invalid_signature`.
- Release promovido para o domínio público. Saúde pública OK; API autenticada `/api/billing/status` retornou configurado, oito planos, Pro USD 990 e `legacy_access=true` para o espaço Gilberto.
- Formulário real montado dentro do aplicativo, iframe Stripe “Embedded checkout”, sem alertas. Sua sessão foi conferida na API Stripe, vinculada ao espaço correto, total USD 990, e expirada sem pagamento. Nenhuma assinatura paga foi criada para teste.
- A confirmação de um pagamento e a entrega do evento financeiro correspondente dependem da primeira transação real; não foram simuladas como pagamento efetivo.

## Pesquisa de canais concluída

Relatórios: `docs/research/PRICING-AND-CHANNELS-2026-10-18.md` e `docs/research/MULTICHANNEL-IMPLEMENTATION-2026-10-18.md`.

Facebook → TikTok → YouTube. A pesquisa documenta OAuth, escopos, endpoints, eventos, capacidades, limites, armazenamento separado, migração aditiva e flags desligadas. Nenhum canal novo foi conectado ou anunciado como disponível. O próximo trabalho, se solicitado, é implementar os contratos/fixtures e armazenamento isolado; preservar tabelas, IDs e fluxos Instagram existentes.

Não contratar plano pago, cobrar cartão ou conectar contas sem consentimento do titular. Atenza deve permanecer intacto. Não repetir o provisionamento: preservar webhook e credenciais existentes.

## Monitor

Objetivo desta etapa concluído: criar `/Users/andrealmeida/.local/share/flownexa-codex-resume/complete` para encerrar a retomada automática. A expansão multicanal descrita acima é projeto técnico de pesquisa, não uma integração ativa.
