# Retomada: Stripe e planos localizados do FlowNexa

Atualizado em 18/10/2026. Branch `feat/stripe-localized-subscriptions`, baseada em `9e111b6`, no worktree `/Users/andrealmeida/flownexa-instagram-audit`.

## Concluído

- Atenza investigado sem alterar código, produtos, assinaturas ou portal. Não abrir/copiar seus arquivos `.env`.
- Pesquisa oficial registrada em `docs/research/PRICING-AND-CHANNELS-2026-10-18.md`.
- Catálogo com oito preços: Pro R$59,90/mês ou R$599/ano; US$12,90/mês ou US$129/ano. Equipes R$119,90/mês ou R$1.199/ano; US$24,90/mês ou US$249/ano.
- Português seleciona BRL; inglês e demais idiomas selecionam USD. Troca manual persistida. Anual cobrado integralmente, com equivalente mensal informativo.
- Checkout embutido, validação de valor/moeda/recorrência no servidor, troca segura de checkout não pago, idioma e configuração exclusiva do portal.
- Limites Pro: uma conta e 10.000 envios/mês calendário UTC; Equipes: duas contas e 20.000. Sem cobrança automática de excedentes.
- `BILLING_LEGACY_BEFORE` preserva espaços existentes; ativar cobrança apenas com configuração real verificada.
- 180 testes Node passaram. Navegador passou em português/inglês, troca manual de moeda, anual integral, checkout simulado e celular. Regressão do Gilberto passou: 29 nós, edição, preview, publicação e celular. Nenhuma mensagem real nem cobrança de teste foi enviada. Não repetir testes sem nova alteração.

## Bloqueio: verificação do titular na Stripe

Conta correta: CoreUnit `acct_1OOu0JG3HxcyUpFW`, confirmada pelos produtos Atenza Essencial, Pro e Ilimitado.

A credencial restrita “FlowNexa subscriptions live” foi preparada, mas a Stripe exigiu “Verification required” e um link por e-mail aberto pelo titular no mesmo navegador/dispositivo. O proprietário foi avisado. Não enviar verificação por ele, abrir e-mail, coletar OTP ou tentar contornar essa etapa. Na última conferência a tela de criação estava aberta, sem chave nova visível; a ausência do modal não comprova conclusão da verificação.

Não foram criados produtos/preços/webhook/portal do FlowNexa na Stripe. Pagamentos reais ainda não estão ativos. A produção e os fluxos existentes devem continuar funcionando.

## Próxima ação após o titular concluir

1. Confirmar a verificação na aba Stripe do Chrome; criar apenas a chave restrita preparada. Permissões: escrita Customers, Products, Prices, Subscriptions, Customer Portal, Checkout Sessions e Webhook Endpoints; leitura Payment Methods e Invoices. Nenhuma permissão de saques, transferências ou reembolsos.
2. `scripts/provision-stripe-catalog.mjs` cria somente dois produtos/oito preços, portal e webhook exclusivos do FlowNexa, com idempotência e validação do catálogo. Não altera o Atenza.
3. Ponte temporária `/tmp/flownexa-stripe-provision-live.mjs` captura a chave nova diretamente do navegador em memória e persiste segredos como variáveis sensíveis da Vercel. Não imprimir segredos ou gravá-los em arquivos. Exige a chave completa visível; falha antes de mutações se não conseguir capturá-la.
4. Helper Vercel `/tmp/flownexa-vercel-session.py`, sessão 62008, mantém token autorizado em memória. Confirmar se ainda está ativo antes de reutilizar. Progresso sem segredos: `/tmp/flownexa-stripe-provision-progress.json`. Se houver falha parcial, inspecionar antes de repetir; preservar o segredo de webhook já criado.
5. Publicar release com as variáveis reais, verificar saúde, catálogo, checkout sem cobrar cartão e webhook. Só então promover para `flownex.online`. Não contratar plano pago nem cobrar cartão para teste.

## Preservação e ferramentas

Produção anterior: `dpl_ykby3Mwo4rsYEC28msSEVaBxbVVm`, código `adb8ed9`, URL `https://flownexa-dw66okd87-flownexa3.vercel.app`. Projeto `flownexa`, equipe `flownexa3`. PR anterior #15 contém os fluxos do Gilberto; não sobrescrever nem mesclar automaticamente.

Chrome Stripe: prefixo `https://dashboard.stripe.com/acct_1OOu0JG3HxcyUpFW/apikeys/create`; helper `/tmp/flownexa-tab.py` via `python3`. Consultar apenas seletores/booleanos, nunca retornar segredos. Playwright `channel: chrome` interfere na resolução do Chrome do proprietário: usar o Headless Shell separado em `/tmp/flownexa-playwright-browsers`.

Facebook, TikTok e YouTube foram pesquisados, mas ainda não implementados. Facebook: Páginas/Messenger; TikTok: contas Business elegíveis e capacidades diferentes; YouTube: comentários públicos, sem DM na API usada. Não anunciá-los como canais ativos.

O monitor de retomada só deve encerrar quando o objetivo estiver concluído ou o proprietário cancelar: criar `/Users/andrealmeida/.local/share/flownexa-codex-resume/complete`. Não criar enquanto a ativação Stripe estiver pendente.

## Revisão salva nesta retomada

- Implementação commitada em `b1096d6`, enviada para `origin/feat/stripe-localized-subscriptions`.
- PR de rascunho #16: https://github.com/andreajoa/FlowNexa/pull/16, com base na branch da PR #15 para separar o trabalho de cobrança.
- Release preparado sem promover o domínio público: `dpl_98WdFujgowmaL62TaStRaEX2cMRp`, https://flownexa-1jje9c8j9-flownexa3.vercel.app. Build READY. Usa as variáveis atuais, sem pagamentos reais configurados. A prévia exige autenticação Vercel.
- Não há `/tmp/flownexa-stripe-provision-progress.json`: o provisionamento real ainda não foi executado. Aguardar a verificação do titular, conforme instrução expressa do proprietário.
- Verificação remota do release passou: `/api/health` OK, preços localizados presentes, JavaScript da landing e do aplicativo válido, capacidades dos fluxos presentes. `https://flownex.online` continua servindo a versão anterior; o domínio público não foi promovido. Zero cobranças reais.
