# Objetivo concluído — 18 outubro 2026

Os dois fluxos estão publicados (enabled1/version2), não recriar nem publicar duplicatas:
Direct e7892923-edd3-4b3e-aa2e-d29e9b301c19 (29 nós), comentários d092adbb-413d-4d30-8bad-a8c13c0c2c9c (23 nós).
Deployment dpl_ykby3Mwo4rsYEC28msSEVaBxbVVm / código adb8ed9, promovido https://flownex.online.
169 testes completos aprovados; browser de nós/editor/preview/publicação/mobile aprovado. 3 PNGs reais verificados no deployment. Configurações salvas comparadas ao gerador antes da publicação. Scheduler: cinco ticks de minuto HTTP200.
Nenhum envio real executado pelo agente. Entrega externa precisa de um novo Direct/comentário real de outra conta Instagram. Não chamar teste simulado de entrega real.
Leia campaigns/gilberto-rebuild/README.md para conteúdo, links e calendário. Rotação automática ao pedir livro: agora–30/11/2026 Black Friday; 01–25/12 Natal; 26/12–07/01/2027 Ano Novo; depois evergreen. Sem desconto inventado. Posts não publicados, sem broadcast. Likes/saves/shares entre terceiros não são gatilhos suportados. Usuário foi informado.
Monitor deve estar encerrado com marcador complete após finalizar evidências e atualização da PR15. Se houver nova tarefa, usar esse estado para continuar sem repetir o que já está publicado.

--- Registro de implementação (histórico, tarefas acima já concluídas) ---

# Continuação autorizada — Gilberto Instagram / campanhas

Objetivo atual: publicar no workspace GILBERT.REBUILD dois fluxos em inglês, Direct/story e comentários de qualquer publicação, baseados no PDF fornecido e no site oficial. Incluir criativos clean de Black Friday, Natal e Ano Novo. O usuário esclareceu que também desejava likes, saves e shares: esses eventos de publicações não permitem iniciar DM oficial; compartilhamento recebido como mensagem pode iniciar Direct. Não inventar suporte a likes/saves nem descontos. Pergunta opcional de oferta pendente.

Trabalho em `/Users/andrealmeida/flownexa-instagram-audit`, branch `fix/instagram-profile-connection`, PR15 já existente. Não alterar outros worktrees. Conta conectada gilberto.rebuild, workspace878a9e78-44a1-42ca-8cce-e454ce36da22, account1f0b1c19-2cb5-4f9e-94f4-701af3c98e6e. Não enviar DMs históricas/testes para terceiros. Autorizado criar e publicar automações novas nesse workspace.

Código em andamento (ainda não commitado/deploy): `contains_any` por expressões em linhas; início com router/condition; edição/simulador correspondentes; `reply_per_message` para não perder DMs concorrentes; normalização de DMs com anexos. `campaigns/gilberto-rebuild/flows.js` cria grafos válidos (28/22 nós; configuração próxima16KB, validar após qualquer mudança). Assets PNG finais gerados e copiados para `public/campaigns/gilberto-rebuild/{black-friday,christmas,new-year}.png`. Skill imagegen aplicada. Não gerar novamente sem necessidade.

Pendente: testes relevantes para classificação, concorrência, optout, media/compartilhamento, edição/simulação; revisar diffs; npm test; browser smoke. Confirmar arquivos public são servidos corretamente no deployment. Publicar nova versão Vercel e promover após validação. Criar dois fluxos via fetch autenticado na aba Chrome FlowNexa, inspecionar e publicar. Pode precisar corrigir UI que classifica subconjunto entry_points como engagement: já ajustada parcialmente, verificar persistência. Gerar documentação de campanhas com legendas/keywords e status real. Atualizar PR15. Não afirmar teste real de entrega se só mocks.

Vercel projeto flownexa / team flownexa3; CLI token anteriormente fornecido, nunca imprimir; helper `/tmp/flownexa-vercel-session.py` getpass e comandos JSON. Identidade git local corrigida email100246160+andreajoa@users.noreply.github.com. Deploy `npx --yes vercel@63.1.2 deploy --prod --skip-domain --yes --scope flownexa3`, inspecionar, promover. Produção anterior dpl_Ct5KpZfp6ytNJUbNNwRypf9a1vvW, https://flownex.online. Segredos Zernio configurados e write-only; NÃO recriar secret/webhook. Webhookevents comment.received/message.received/account.disconnected suficientes.

Chrome real via AppleScriptJS; helper `/tmp/flownexa-tab.py https://flownex.online`, stdinIIFE JS. Fetch promises não await: armazenar em window e consultar na chamada seguinte. TabFlowNexa1773772504,window1773772455. Sessão Gilberto autenticada. Nunca imprimircookies/credenciais. CriarPOST/api/flows(bodyworkspace_id/account_id/name/trigger_type/scope/configuration), publicarPOST/api/flows/ID/publish. Consulteflowsantes para evitar duplicatas. Não usar apelidos de autenticador/session pessoal.

Pesquisa: PDFextraído `/tmp/gilberto-book-en.txt`114p; livro How to Overcome the Pain of Being Replaced by Someone Else, Gilberto de Souza. Site https://www.gilberto-souza.com/en, hub/links verificouAmazonB0H2LXHCH4. Preços site contraditórios24.99/49.99: não fixar preço. Não replicar alegações antiterapia do livro nem falsas credenciais. Não chamar roteamento determinístico de IA. Crise sem venda e recursos988USCanada/findahelpline. Nenhuma oferta real definida.

Ao terminar ou cancelamento, criar novamente `/Users/andrealmeida/.local/share/flownexa-codex-resume/complete`. Monitor só tenta retomar após erro real de quota +reset; não ultrapassaquota e exigeMacligado.
