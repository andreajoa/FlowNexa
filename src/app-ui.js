export function appPage() {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><link rel="icon" type="image/svg+xml" href="/assets/flownexa-icon.svg"><title>FlowNexa · Aplicativo</title><style>
:root{font-family:Inter,system-ui,sans-serif;color:#221735;background:#faf9fc;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button,input,select,textarea{font:inherit}a{color:#663bc8}button,.button{cursor:pointer;border:0;border-radius:9px;padding:11px 16px;background:#663bc8;color:white;font-weight:650;text-decoration:none;display:inline-block}button:disabled{opacity:.55;cursor:wait}button.secondary{background:#f0eafa;color:#503582}button.danger{background:#fff0f0;color:#a62236}button.link{background:transparent;color:#663bc8;padding:5px}button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid #b99aef;outline-offset:3px}header{background:#1a1036;color:white;padding:18px max(24px,calc((100vw - 1240px)/2));display:flex;gap:20px;align-items:center;justify-content:space-between}header a{display:inline-flex;align-items:center;white-space:nowrap;gap:8px;color:white;text-decoration:none;font-size:24px;font-weight:800;letter-spacing:-1px}.mark{width:34px;height:34px;vertical-align:middle;flex-shrink:0}main{max-width:1240px;margin:30px auto;padding:0 24px 60px}h1{font-size:30px;letter-spacing:-1px}h2{font-size:21px}h3{font-size:16px}p{line-height:1.6}.muted,small{color:#665b77}.panel{background:white;border:1px solid #e5dff0;border-radius:16px;padding:24px;margin:18px 0}.billing-plans{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:16px}.billing-plan{border:1px solid #d9ccea;border-radius:12px;padding:20px;background:#fcfaff}.billing-price{font-size:26px;font-weight:750;letter-spacing:-.6px}.checkout-shell{border:1px solid #d9ccea;border-radius:16px;padding:22px;background:#fcfaff;margin-top:20px}.checkout-shell #embedded-checkout{background:white;border-radius:12px;min-height:260px;margin-top:18px;overflow:hidden}.conversation-preset{margin-top:20px;padding-top:12px;border-top:1px solid #e5dff0}#graph-dialog{width:calc(100vw - 32px);max-width:1520px;height:calc(100dvh - 32px);max-height:calc(100dvh - 32px);margin:auto;padding:24px;border:1px solid #d9ccea;border-radius:18px;background:#faf9fc;color:#221735}#graph-dialog::backdrop{background:#17102499}.graph-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.graph-workspace{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:18px;margin-top:16px}.graph-workspace>div,.graph-workspace>aside,.graph-meta>label{min-width:0}.graph-scroll{height:550px;overflow:auto;border:1px solid #d9ccea;border-radius:14px;background-color:#f5f0fb;background-image:radial-gradient(#cbbce1 1px,transparent 1px);background-size:20px 20px;position:relative}.graph-world{position:relative;min-width:100%;min-height:100%}.graph-wires{position:absolute;inset:0;overflow:visible;pointer-events:none}.graph-card{position:absolute;width:250px;padding:14px;background:white;border:2px solid #d9ccea;border-radius:13px;box-shadow:0 3px 10px #3013540a}.graph-card.selected{border-color:#663bc8;box-shadow:0 0 0 3px #663bc818}.graph-card small{display:block;line-height:1.6}.graph-card p{font-size:13px;margin:7px 0;overflow-wrap:anywhere}.graph-card-title{padding:0;background:transparent;color:#221735;text-align:left;font-size:14px}.graph-drag{padding:3px 7px;background:#f0eafa;color:#503582;cursor:grab;font-size:12px}.graph-inspector{padding:18px;border:1px solid #d9ccea;border-radius:14px;background:white;min-width:0}.graph-inspector .stack{gap:12px}.graph-minimap{font-size:12px}.graph-meta{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:16px 0}.graph-results{padding:16px;border:1px solid #d9ccea;border-radius:12px;background:white;margin-top:16px}.graph-results li{margin-bottom:10px;line-height:1.5}.graph-node-list{padding-left:22px}.graph-scroll:focus-visible{outline:3px solid #b99aef;outline-offset:2px}@media(max-width:800px){#graph-dialog{padding:16px}.graph-workspace{grid-template-columns:minmax(0,1fr)}.graph-scroll{height:410px}.graph-meta{grid-template-columns:minmax(0,1fr)}.graph-inspector{min-width:0}}.auth{max-width:470px;margin:50px auto}.row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.between{justify-content:space-between}.grid{display:grid;grid-template-columns:1fr 1.15fr;gap:22px}.grid>section{min-width:0}.setup-steps{list-style:none;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.setup-step h3{margin:10px 0 6px}.step-number{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:50%;background:#f0eafa;color:#663bc8;font-weight:700}.template-preview{margin-top:18px;padding:16px;border:1px solid #d9ccea;border-radius:12px;background:#fcfaff}.template-message{padding:14px;border-radius:10px;background:white;border:1px solid #e5dff0;overflow-wrap:anywhere}.template-message p{margin:6px 0}.stack{display:grid;gap:16px}label{display:grid;gap:7px;font-weight:600;font-size:14px}input,select,textarea{width:100%;border:1px solid #cbbfda;border-radius:8px;padding:11px;background:#fff;color:#221735;min-height:44px}textarea{min-height:110px;resize:vertical}label.check{display:flex;align-items:center}label.check input{width:18px;min-height:18px}.status{padding:13px 17px;border-radius:10px;background:#f0eafa;color:#503582;margin:18px 0;line-height:1.5;overflow-wrap:anywhere}.status.error{background:#fff0f0;color:#9b2538}.status.success{background:#e7f6ed;color:#1c6440}.badge{background:#f1edf7;padding:5px 10px;border-radius:20px;font-size:12px;font-weight:600}.flow-item{border-top:1px solid #ece6f2;padding:16px 0}.sequence{display:grid;gap:0}.node{border:1px solid #d9ccea;background:#fcfaff;border-radius:12px;padding:17px}.connector{height:24px;margin-left:28px;border-left:2px solid #b99aef}.node h3{margin:0 0 12px}.actions{display:grid;gap:12px}.action{border:1px solid #e5dff0;border-radius:10px;padding:12px;background:white}.mini{font-size:12px;padding:7px 10px}.table-wrap{overflow:auto;max-width:100%}table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:12px;border-bottom:1px solid #ece6f2;vertical-align:top}.hidden,[hidden]{display:none!important}.wide{flex:1;min-width:180px}.callout{border-left:3px solid #8352d7;padding-left:16px}.notice{font-size:13px;color:#665b77}fieldset{border:0;padding:0;margin:0}.authnav{margin-top:22px;display:flex;gap:8px;flex-wrap:wrap}#identity{font-size:13px}pre{white-space:pre-wrap;word-break:break-word;font-family:inherit;font-size:14px}footer{color:#665b77;text-align:center;font-size:12px;padding:24px}@media(max-width:800px){.setup-steps{grid-template-columns:1fr}.setup-step{padding-bottom:12px;border-bottom:1px solid #ece6f2}.grid{grid-template-columns:1fr}main{padding:0 16px 35px}.panel{padding:18px}header{padding:16px}h1{font-size:26px}.auth{margin:24px auto}header .row{gap:6px}#identity{max-width:140px;overflow-wrap:anywhere}}

.editor-upgrade{padding:18px;border:1px solid #c9b2e7;border-radius:12px;background:#f5f0fb;margin-bottom:22px}.editor-upgrade h3{margin:0}.graph-palette{display:grid;grid-template-columns:1fr 1fr 0.55fr;gap:16px;padding:18px;background:#fff;border:1px solid #d9ccea;border-radius:12px}.graph-palette-group{display:grid;gap:12px;align-content:start}.graph-palette-group>.row{gap:8px}.option-editor{padding:12px;border:1px solid #e5dff0;border-radius:9px;background:#faf9fc}.graph-guide{max-width:100ch}.graph-inspector{max-height:680px;overflow:auto}@media(max-width:800px){.graph-palette{grid-template-columns:1fr}.graph-inspector{max-height:none}}.graph-port{width:18px;height:18px;min-height:18px;flex-shrink:0;border:3px solid #663bc8;border-radius:50%;background:white;padding:0;touch-action:none;cursor:crosshair}.graph-input{position:absolute;left:-10px;top:60px}.graph-output{display:flex;gap:8px;align-items:center;justify-content:space-between;margin-top:8px}.graph-output small{max-width:185px}.graph-output .graph-port{margin-right:-24px}.graph-drag{touch-action:none}html{scroll-behavior:smooth;scroll-padding-top:24px}.skip-link{position:absolute;left:16px;top:-80px}.skip-link:focus{top:16px;z-index:10}.app-sidebar{position:fixed;left:0;top:70px;bottom:0;width:224px;background:#21143b;color:#f5f0fb;padding:28px 18px;overflow:auto}.app-sidebar p{font-size:12px;color:#c3b6da;margin:0 12px 18px}.app-sidebar nav{display:grid;gap:8px}.app-sidebar a{display:flex;gap:12px;align-items:center;text-decoration:none;color:#e1d6f2;padding:13px 14px;border-radius:9px;font-weight:600;font-size:14px}.app-sidebar a:hover,.app-sidebar a[aria-current]{background:#3b275a;color:white}.nav-symbol{font-size:18px;width:22px;text-align:center}.app-sidebar .sidebar-help{margin-top:30px;line-height:1.7}.app-main{max-width:1440px;margin-left:224px;margin-right:auto;padding:0 32px 60px}.app-sidebar[hidden]+.app-main{margin-left:auto;max-width:1240px}.saved-flows{margin-top:22px}.saved-flows>h3{font-size:19px}.flow-item.active{border-left:3px solid #663bc8;padding-left:16px}.flow-description{font-size:13px;margin:9px 0}.flow-item .row{margin-bottom:6px}.models-layout{margin-top:24px}.editor-hint{padding:18px;background:#f5f0fb;border-radius:12px}.app-sidebar~main section[id]{scroll-margin-top:24px}@media(min-width:801px){body>header{padding:18px 28px;min-height:70px}.models-layout{grid-template-columns:1fr 1fr}}@media(max-width:800px){.app-sidebar{position:static;width:auto;padding:12px 16px}.app-sidebar p,.app-sidebar .sidebar-help{display:none}.app-sidebar nav{display:flex;gap:8px;overflow:auto}.app-sidebar a{flex-shrink:0;padding:10px 12px;font-size:13px}.nav-symbol{display:none}.app-main{margin:22px auto;padding:0 16px 35px}.models-layout{grid-template-columns:1fr}}@media(prefers-reduced-motion:reduce){.graph-port{width:18px;height:18px;min-height:18px;flex-shrink:0;border:3px solid #663bc8;border-radius:50%;background:white;padding:0;touch-action:none;cursor:crosshair}.graph-input{position:absolute;left:-10px;top:60px}.graph-output{display:flex;gap:8px;align-items:center;justify-content:space-between;margin-top:8px}.graph-output small{max-width:185px}.graph-output .graph-port{margin-right:-24px}.graph-drag{touch-action:none}html{scroll-behavior:auto}}
/* App-only brand layer. Tokens mirror src/landing.js; original editor styles stay intact. */
:root {
  --app-ink:#17121e;
  --app-muted:#625b69;
  --app-purple:#7c3ee9;
  --app-purple-hover:#6730cf;
  --app-border:#ece5f2;
  --app-shadow:0 12px 32px #341b4c12;
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,Arial,sans-serif;
  color:var(--app-ink);
  background:#faf8fd;
}
body {
  min-height:100dvh;
  background:repeating-linear-gradient(45deg,transparent 0 53px,rgba(112,72,150,.024) 53px 107px),radial-gradient(ellipse 37% 62% at 0% 32%,#e9d9fa 0,transparent 100%),radial-gradient(ellipse 32% 65% at 96% 70%,#fbe0ee 0,transparent 100%),#fcfafc;
  background-attachment:fixed;
}
body>header {
  margin:20px 24px 0;
  padding:13px 19px;
  min-height:70px;
  border:1px solid var(--app-border);
  border-radius:17px;
  background:rgba(255,255,255,.94);
  color:var(--app-ink);
  box-shadow:var(--app-shadow);
  gap:16px;
}
body>header>a {color:var(--app-ink);font-size:25px;font-weight:900;letter-spacing:-1.1px}
body>header>.row {justify-content:flex-end;min-width:0}
#identity {color:var(--app-muted);overflow-wrap:anywhere;min-width:0}
#logout {border:1px solid #e0d1f3;background:#f5effc;color:#6030a5;border-radius:12px;min-height:44px}
.app-sidebar {
  top:110px;bottom:24px;left:24px;width:238px;padding:24px 14px;
  background:linear-gradient(160deg,#fff 0%,#faf5ff 100%);
  border:1px solid var(--app-border);border-radius:17px;
  color:var(--app-ink);box-shadow:var(--app-shadow);
}
.app-sidebar p {font-size:10px;letter-spacing:.1em;font-weight:800;color:#796b89;margin:0 12px 20px}
.app-sidebar nav {gap:7px}
.app-sidebar a {color:#62536f;border:1px solid transparent;border-radius:12px;padding:12px;font-weight:650;line-height:1.45;transition:background .2s,color .2s,box-shadow .2s}
.app-sidebar a:hover {background:#f0e5fc;color:#6030a5}
.app-sidebar a[aria-current] {background:var(--app-purple);color:#fff;border-color:#7235d9;box-shadow:0 5px 0 #56249f,0 8px 18px #6e32ce20}
.nav-symbol {flex:none;font-size:20px}
.app-sidebar .sidebar-help {margin:30px 10px 0;padding-top:20px;border-top:1px solid #e7dcec;font-size:12px;font-weight:400;letter-spacing:0;color:var(--app-muted)}
.app-main {max-width:1440px;margin:34px auto 0 286px;padding:0 24px 48px 0;min-width:0}
.app-sidebar[hidden]+.app-main {margin:40px auto 0;padding:0 24px 48px}
#workspace>.row:first-child {gap:20px;margin-bottom:28px;align-items:center}
#workspace>.row:first-child>div {flex:1;min-width:0}
#workspace>.row:first-child>label {width:240px;max-width:100%;font-size:12px;color:var(--app-muted)}
#workspace h1,.auth h1 {font-size:clamp(30px,3.2vw,46px);line-height:1.08;letter-spacing:-.055em;font-weight:950;margin:0 0 12px;text-wrap:balance}
#workspace>.row:first-child p {margin:0;font-size:16px;color:var(--app-muted)}
.app-main h2:not(#editor *) {font-size:22px;line-height:1.2;letter-spacing:-.035em;font-weight:850;margin:0 0 12px;text-wrap:balance}
.app-main h3:not(#editor *) {letter-spacing:-.025em;line-height:1.35;font-weight:800}
.app-main .muted:not(#editor *),.app-main .notice:not(#editor *) {color:var(--app-muted)}
.app-main .panel:not(#editor) {background:rgba(255,255,255,.96);border:1px solid var(--app-border);border-radius:20px;padding:26px;margin:20px 0;box-shadow:var(--app-shadow)}
.app-main .panel>.row h2:not(#editor *) {margin-bottom:0}
.app-main :is(button,.button):not(#editor *) {
  border:1px solid #7134d7;border-radius:12px;background:var(--app-purple);color:#fff;
  min-height:44px;padding:12px 18px;font-weight:800;font-size:14px;line-height:1.4;
  box-shadow:0 3px 0 #56249f,0 8px 18px #6e32ce20;
  transition:transform .2s,background .2s,box-shadow .2s;
  white-space:normal;overflow-wrap:anywhere;max-width:100%;
}
.app-main button.secondary:not(#editor *) {background:#f6f0fc;color:#6030a5;border-color:#e0d1f3;box-shadow:0 2px 0 #e7dcec;font-weight:750}
.app-main button.danger:not(#editor *) {background:#fff3f4;color:#a62236;border-color:#efd3d9;box-shadow:none}
.app-main button.link:not(#editor *) {background:transparent;color:#6730cf;border-color:transparent;box-shadow:none;padding:8px}
.app-main button.mini:not(#editor *) {font-size:12px;padding:9px 12px}
@media(hover:hover) {
  .app-main :is(button,.button):not(#editor *):not(:disabled):hover {transform:translateY(-2px);background:var(--app-purple-hover);color:white}
  .app-main button.secondary:not(#editor *):not(:disabled):hover {background:#ece0fc;color:#56249f}
  .app-main button.danger:not(#editor *):not(:disabled):hover {background:#fce1e5;color:#922036}
}
.app-main button:not(#editor *):not(:disabled):active {transform:translateY(1px);box-shadow:none}
.app-main button:disabled:not(#editor *) {box-shadow:none}
body>header :is(a,button):focus-visible,.app-sidebar a:focus-visible,.app-main :is(a,button,input,select,textarea):not(#editor *):focus-visible {outline:3px solid #7c3ee9;outline-offset:4px}
.app-main :is(input,select,textarea):not(#editor *) {border-color:#d9ccea;border-radius:10px;background:#fffdff;min-width:0;max-width:100%;box-shadow:0 2px 4px #341b4c05;accent-color:var(--app-purple)}
.app-main :is(input,select,textarea):not(#editor *):focus {border-color:#8c42ed}
.app-main label:not(#editor *) {line-height:1.5}
.app-main .badge:not(#editor *) {background:#f0e5fc;color:#6030a5;border:1px solid #e5d5f7;font-weight:750;line-height:1.5;font-variant-numeric:tabular-nums}
#flow-count {display:inline-flex;vertical-align:middle;margin-left:6px;min-width:30px;justify-content:center}
#flows {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:24px}
#flows>.flow-item {margin:0;padding:20px;border:1px solid #e7dcec;border-radius:14px;background:#fcfaff;min-width:0}
#flows>.flow-item.active {border-left:3px solid #8c42ed;background:linear-gradient(125deg,#f7f0ff,#fff)}
#flows>.flow-item.active .badge {background:#e0f7ef;color:#21644f;border-color:#bee5d8}
#flows>.flow-item>button {margin:8px 6px 0 0}
#flows>p:only-child {grid-column:1/-1;padding:28px;border:1px dashed #d9ccea;border-radius:14px;background:#fcfaff;margin:0;line-height:1.7}
#setup {background:linear-gradient(120deg,#f8f1ff,#fff9ef)}
#setup-progress {background:#fff2b7;color:#68531b;border-color:#ebd990}
.setup-steps {margin:24px 0 0;gap:16px}
.setup-step {padding:18px;border:1px solid #e7dcec;border-radius:14px;background:#ffffffb8;min-width:0}
.step-number {width:34px;height:34px;background:#eadbfc;color:#6030a5;border:1px solid #d6bbee;border-radius:11px}
.setup-step .notice {font-size:13px;line-height:1.65}
#accounts .flow-item {gap:12px;padding-top:20px;overflow-wrap:anywhere}
.models-layout {gap:20px;align-items:start}
.models-layout>.panel,.models-layout>section>.panel {margin-top:0}
#conversation-models .template-preview {background:#faf5ff;border-color:#e5d5f7;border-radius:14px}
#conversation-template-fields {margin:16px 0}
#activity-panel .table-wrap {border:1px solid var(--app-border);border-radius:12px;margin-top:20px}
#activity-panel th {background:#f7f1fc;color:#62536f;font-size:12px;font-weight:800}
#activity-panel td {font-variant-numeric:tabular-nums;overflow-wrap:anywhere;min-width:110px;line-height:1.5}
#activity-panel tbody tr:last-child td {border-bottom:0}
#activity-panel tbody tr:hover {background:#fcfaff}
.app-main .billing-plan {border-color:#e5d5f7;border-radius:14px;background:#fcfaff;padding:22px}
.billing-price {font-variant-numeric:tabular-nums;letter-spacing:-.05em;color:#6030a5}
#ai-agents>.row>div {flex:1;min-width:0}
#ai-agents .callout {background:#faf5ff;padding:4px 18px;border-radius:0 12px 12px 0}
.app-main .status {border:1px solid #e0d1f3;border-radius:12px}
.app-main .status.success {border-color:#bee5d8}
.app-main .status.error {border-color:#efd3d9}
.app-main .row>*:not(#editor *) {min-width:0;max-width:100%}
.app-main :is(p,strong,h2,h3,code):not(#editor *) {overflow-wrap:anywhere}
.app-main fieldset:not(#editor *) {min-width:0}
.auth {max-width:490px}
body>footer {margin-left:286px;color:#796b89;padding:12px 24px 32px}
body:has(.app-sidebar[hidden])>footer {margin-left:0}
.skip-link:focus {background:#7c3ee9;color:white;box-shadow:0 5px 0 #56249f}
@media(min-width:801px) and (max-width:1100px) {
  .app-sidebar {width:210px;left:20px}
  .app-main {margin-left:250px}
  body>footer {margin-left:250px}
  .models-layout,#flows,.setup-steps {grid-template-columns:minmax(0,1fr)}
}
@media(max-width:800px) {
  body>header {margin:12px 12px 0;padding:12px;gap:12px;flex-wrap:wrap}
  body>header>.row {flex:1}
  #identity {max-width:180px;font-size:12px}
  .app-sidebar {position:static;width:auto;margin:14px 12px 0;padding:10px;border-radius:15px}
  .app-sidebar nav {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;overflow:visible}
  .app-sidebar a {font-size:12px;padding:11px 8px;justify-content:center;text-align:center;overflow-wrap:anywhere}
  .app-main,.app-sidebar[hidden]+.app-main {margin:26px auto 0;padding:0 16px 28px}
  #workspace>.row:first-child>label {width:100%}
  .app-main .panel:not(#editor) {padding:20px;border-radius:17px}
  .setup-steps {grid-template-columns:minmax(0,1fr)}
  .setup-step {padding:16px}
  body>footer {margin-left:0}
}
@media(max-width:480px) {
  body>header>a {font-size:23px}
  #identity {max-width:130px}
  .app-main,.app-sidebar[hidden]+.app-main {padding-left:12px;padding-right:12px}
  .app-main .panel:not(#editor) {padding:18px}
  #flows {grid-template-columns:minmax(0,1fr)}
  #saved-automations>.row>.row {width:100%;display:grid;grid-template-columns:minmax(0,1fr)}
  #saved-automations>.row>.row>button {width:100%}
  .app-main h2:not(#editor *) {font-size:20px}
  .app-sidebar a {font-size:11px}
  .app-main .wide:not(#editor *) {min-width:0;flex-basis:100%}
  .authnav {gap:4px}
}
@media(prefers-reduced-motion:reduce) {
  .app-main :is(button,.button),.app-sidebar a {transition:none}
  .app-main :is(button,.button):not(#editor *):hover {transform:none}
}

</style><script src="/app.js" defer></script></head><body><a class="skip-link button" href="#workspace">Ir para o painel</a><header><a href="/app" aria-label="FlowNexa início"><img class="mark" src="/assets/flownexa-mark.svg" alt="" width="34" height="34">FlowNexa</a><div class="row"><span id="identity"></span><button id="logout" class="secondary" hidden>Sair</button></div></header><aside id="app-sidebar" class="app-sidebar" aria-label="Menu do painel" hidden><p>SEU ESPAÇO DE TRABALHO</p><nav aria-label="Navegação principal"><a href="#saved-automations" aria-current="page"><span class="nav-symbol" aria-hidden="true">▦</span>Automações</a><a href="#conversation-models"><span class="nav-symbol" aria-hidden="true">⌘</span>Modelos com nós</a><a href="#instagram-panel"><span class="nav-symbol" aria-hidden="true">◎</span>Instagram</a><a href="#activity-panel"><span class="nav-symbol" aria-hidden="true">↗</span>Atividade</a><a href="#billing"><span class="nav-symbol" aria-hidden="true">▤</span>Assinatura</a><a href="#ai-agents"><span class="nav-symbol" aria-hidden="true">⚡</span>Conectar IA (Claude / Codex)</a></nav><p class="sidebar-help">Abra uma automação salva ou escolha um modelo para editar mensagens e conectar os próximos passos.</p></aside><main class="app-main"><div id="notice" class="status" role="status" aria-live="polite" hidden></div><section id="auth" class="panel auth"></section><section id="workspace" hidden><div class="row between"><div><h1>Suas automações</h1><p class="muted">Transforme conversas no Instagram em próximos passos.</p></div><label>Espaço de trabalho<select id="workspace-select"></select></label></div><section id="saved-automations" class="panel"><div class="row between"><h2>Suas automações salvas <span id="flow-count" class="badge"></span></h2><div class="row"><button id="new-flow" class="secondary">Criar do zero</button><button id="choose-template" class="secondary">Usar modelo pronto</button><button id="new-conversation">Criar conversa visual</button></div></div><p class="notice">As automações publicadas aparecem primeiro. Abra uma delas para conferir o gatilho e as mensagens. Para montar uma conversa com ramificações, use Criar conversa visual ou Modelos com nós.</p><div id="flows" class="saved-flows"></div></section><section id="setup" class="panel" aria-labelledby="setup-heading"><div class="row between"><h2 id="setup-heading">Comece por aqui</h2><span id="setup-progress" class="badge"></span></div><ol id="setup-steps" class="setup-steps"></ol></section><section id="instagram-panel" class="panel"><div class="row between"><div><h2>Instagram</h2><p id="account-summary" class="muted">Carregando contas…</p></div><button id="connect">Conectar Instagram</button></div><p class="notice">Conecte uma conta profissional e autorize o acesso pela Meta. A publicação depende das permissões e da configuração da integração.</p><div id="accounts"></div></section><div class="grid models-layout"><section><div id="conversation-models" class="panel"><div id="template-library"><h3>Modelos para o seu objetivo</h3><p class="notice">Escolha o resultado, personalize os detalhes e confira a mensagem antes de abrir o editor.</p><label>Começar com um modelo<select id="template" aria-label="Começar com um modelo"><option value="">Escolher modelo</option></select></label><div id="template-preview" class="template-preview" hidden></div></div><div class="conversation-preset"><h3>Modelos de conversa com nós</h3><p class="notice">Escolha um objetivo. Os caminhos já vêm conectados e você pode mudar todas as frases.</p><label>Modelo de conversa<select id="conversation-template" aria-label="Modelo de conversa"></select></label><div id="conversation-template-fields" class="stack"></div><button id="conversation-model" class="secondary">Usar modelo de conversa</button></div></div></section><section id="editor" class="panel"><h2>Editor de automações</h2><p class="muted">Escolha uma automação salva acima para abrir sua configuração.</p><p class="editor-hint">Quer usar nós? Clique em <strong>Criar conversa visual</strong> para começar do zero ou escolha um dos <strong>Modelos de conversa com nós</strong>. No mapa, clique em cada bloco para mudar a frase e o próximo passo.</p></section></div><section id="activity-panel" class="panel"><div class="row between"><h2>Atividade real</h2><button id="refresh-activity" class="secondary mini">Atualizar</button></div><div id="executions"><p class="muted">Nenhuma execução carregada.</p></div></section><section id="billing" class="panel" aria-labelledby="billing-heading"><div class="row between"><div><span class="badge">Sua assinatura</span><h2 id="billing-heading">Um plano para o seu próximo passo</h2></div><button id="billing-refresh" class="secondary mini">Atualizar assinatura</button></div><p id="billing-status" class="muted" aria-live="polite">Carregando informações da assinatura…</p><div id="billing-plans" class="billing-plans"></div><div id="checkout-shell" class="checkout-shell" hidden><div class="row between"><h3>Finalize sua assinatura com segurança</h3><button id="checkout-close" class="secondary mini">Fechar checkout</button></div><p class="notice">Confira o plano e a periodicidade abaixo antes de confirmar. Os dados de pagamento são preenchidos no formulário seguro da Stripe.</p><div id="embedded-checkout"></div></div></section><section id="ai-agents" class="panel" aria-labelledby="ai-agents-heading"><div class="row between"><div><span class="badge">Isolamento Seguro Zero-Trust</span><h2 id="ai-agents-heading">Conectar Claude Code & Codex</h2><p class="muted">Permita que agentes de IA construam e organizem os nós do seu fluxo diretamente no seu painel, sem acesso a dados confidenciais ou outros clientes.</p></div><button id="new-agent-token">Gerar Chave de Acesso</button></div><div class="callout" style="margin:16px 0; border-color:#663bc8;"><p><strong>🔒 4 Travas de Segurança Ativas:</strong></p><ul style="margin:6px 0; padding-left:20px; font-size:13px; color:#503582; line-height:1.6;"><li><strong>Isolamento de Tenant:</strong> A chave só acessa os fluxos deste espaço de trabalho; nunca outros clientes ou o servidor FlowNexa.</li><li><strong>Bloqueio de Dados Críticos:</strong> Proibido acesso a faturamento, senhas, tokens do Instagram ou exclusão de contas.</li><li><strong>Validador Anti-Falhas:</strong> A IA só pode enviar fluxos válidos (máximo 30 nós, sem loops infinitos, textos padronizados).</li><li><strong>Revogação em 1 Clique:</strong> Cancele o acesso de qualquer agente instantaneamente.</li></ul></div><div id="token-reveal" class="status success" hidden><p><strong>Guarde sua chave com segurança (ela não será mostrada novamente):</strong></p><div class="row" style="margin-top:8px;"><input id="token-value" type="text" readonly style="font-family:monospace; background:white; font-size:13px; font-weight:700;"><button id="copy-token" class="secondary mini">Copiar</button></div><div style="margin-top:12px; font-size:13px;"><p><strong>Como conectar no Claude Code:</strong></p><pre id="claude-cmd" style="background:#1a1036; color:#a3e635; padding:10px; border-radius:8px; font-family:monospace; font-size:12px; overflow-x:auto;"></pre><p style="margin-top:8px;"><strong>Como conectar no Codex / Cursor / cURL:</strong></p><pre id="codex-cmd" style="background:#1a1036; color:#38bdf8; padding:10px; border-radius:8px; font-family:monospace; font-size:12px; overflow-x:auto;"></pre></div></div><h3 style="margin-top:24px;">Chaves de Agentes Ativas</h3><div id="agent-tokens-list"><p class="muted">Nenhuma chave de agente criada ainda.</p></div></section></section></main><footer>FlowNexa · Área privada de trabalho</footer><dialog id="graph-dialog" aria-labelledby="graph-heading"></dialog></body></html>`;
}
