# FlowNexa — revisão visual local do dashboard

Implementação em `src/app-ui.js`, restrita ao stylesheet embutido. Nenhum HTML, texto, ID, classe ou evento foi removido ou alterado. A camada visual adicional tem comentário próprio e pode ser revisada/revertida sem tocar no CSS original.

## Alterações

- Mesma família tipográfica e cores da landing: Inter/system, roxo #7c3ee9, hover #6730cf, bordas #ece5f2, sombra #341b4c12.
- Fundo com o mesmo padrão diagonal e gradientes lilás/rosa de `src/landing.js`.
- Header e sidebar claros, elevados; navegação ativa roxa com profundidade.
- Títulos editoriais, controles com foco visível e botões com estados hover/pressed/disabled.
- Automações organizadas em cards; mint para publicação e amarelo discreto no progresso. Nenhum status foi modificado.
- Menu em grade no mobile, campos flexíveis, cards empilhados e tabela com rolagem interna. Breakpoints preparados para 320, 375, 768, 1024 e 1440px.
- Nenhum seletor específico do editor ou do mapa foi alterado; os controles do editor são excluídos das novas regras gerais de botões e campos.
- Respeito a reduced-motion. Nenhuma dependência adicionada.

## Verificações realizadas

- `node --check src/app-ui.js`: passou.
- `npm run check`: passou.
- `git diff --check`: passou.
- Comparação do HTML gerado antes/depois, removendo apenas `<style>`: idêntico byte por byte.
- Apenas `src/app-ui.js` mudou entre os arquivos rastreados. Landing, landing-script, logos, favicon, assets, rotas públicas, app-client e backend permanecem byte por byte iguais ao HEAD.
- `npm test`: **130 passaram / 2 falharam / 132 testes**. Falhas: teste de webhook em `tests/billing.test.js` e importação de `tests/vercel-home.test.js`, ambos por `ERR_MODULE_NOT_FOUND` de `@vercel/functions`. Log completo em `npm-test.log`.
- Instalação da dependência existente tentada sem scripts e sem modificar lockfile: cache indisponível (`ENOTCACHED`); rede indisponível (`ENOTFOUND registry.npmjs.org`).

## Limites e pendências de homologação

A conferência final de `git branch --show-current` confirmou `feat/dashboard-brand-redesign-20261020`. A primeira tentativa de criação havia falhado por restrição de escrita em `.git`; o estado final já apresenta a branch solicitada. Os arquivos estão nesta cópia isolada, sem commit, push, merge ou deploy.

Chrome e Chrome Headless Shell instalados foram tentados; ambos encerraram antes de abrir uma página. Portanto **não há screenshots nem validação visual executada**, e ausência de overflow nas cinco larguras ainda precisa ser confirmada em navegador. Não houve acesso a produção ou chamadas reais de API.

`visual-check.mjs` fica disponível para executar a revisão em ambiente com navegador funcional. Intercepta todas as requisições, fornece dados fictícios, compara HTML, verifica overflow nas cinco larguras e exercita navegação de autenticação, atualização de atividade, âncoras e abertura/fechamento do diálogo de nós. Também captura antes/depois, estado vazio, autenticação e landing. Não exercita gravações, OAuth ou pagamentos. Exige Puppeteer já disponível, apontado por `PUPPETEER_PATH`, e opcionalmente `CHROME_PATH`.

Os arquivos de `review/` são evidências e ferramenta local de revisão; não são importados pelo produto.

## Verificação complementar — 20/10/2026, após execução do Codex

O ambiente local recebeu as dependências travadas em `package-lock.json` com `npm ci --ignore-scripts --no-audit --no-fund`. A suíte foi repetida, agora com `@vercel/functions` presente: **133 testes aprovados, zero falhas**. Registro completo: `npm-test-verified.log`. Portanto a informação de 130 aprovados e 2 falhas acima descreve somente a primeira execução com dependência ausente, não o resultado final.

A validação automatizada de comportamento foi concluída; capturas de tela e homologação visual interativa nos cinco breakpoints seguem pendentes. Não houve publicação na Vercel nem push/merge.
