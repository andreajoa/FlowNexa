(() => {
  const screen = document.getElementById("conversation");
  if (!screen) return;
  const dots = [...document.querySelectorAll("[data-slide]")];
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let timer, generation = 0;
  const slides = [
    [
      ["in","Olá! Gostaria de receber o catálogo. 😊"],
      ["out","Oi, Beatriz! Claro 💜 Posso te enviar as novidades por aqui?"],
      ["in","Pode sim!"],
      ["out","Perfeito! Confira nossa coleção. ✨","Ver coleção → exemplo.com/colecao"],
      ["in","Vocês entregam em todo o Brasil?"],
      ["out","Entregamos, sim! Quer consultar o prazo para sua região?"],
      ["in","Quero!"]
    ],
    [
      ["in","Vi a publicação da nova coleção!"],
      ["out","Que bom! 💜 Qual peça chamou mais sua atenção?"],
      ["in","O vestido lilás."],
      ["out","Ótima escolha! Posso te mostrar as opções de tamanho?"],
      ["in","Sim, por favor!"]
    ],
    [
      ["in","Respondi ao Story com QUERO."],
      ["out","Oi, Beatriz! ✨ Vi seu interesse. Posso compartilhar o material?"],
      ["in","Claro!"],
      ["out","Aqui está o conteúdo que você pediu.","Abrir material → exemplo.com/material"]
    ]
  ];
  function appendBubble(role,text,link) {
    const bubble = document.createElement("div");
    bubble.className = "bubble " + role;
    bubble.textContent = text;
    if(link) {
      const card = document.createElement("div");
      card.className = "link-card";
      card.textContent = link;
      bubble.append(card);
    }
    const time = document.createElement("small");
    time.textContent = "agora";
    bubble.append(time);
    screen.append(bubble);
    screen.scrollTop = screen.scrollHeight;
  }
  function start(index) {
    generation++;
    const id=generation;
    clearTimeout(timer);
    screen.replaceChildren();
    dots.forEach((dot,i)=>dot.classList.toggle("active",i===index));
    let at=0;
    const next=()=>{
      if(id!==generation)return;
      if(at>=slides[index].length){timer=setTimeout(()=>start((index+1)%slides.length),reduced?6000:3400);return;}
      const [role,msg,link]=slides[index][at++];
      if(!reduced && role==="out"){
        const typing=document.createElement("div");typing.className="typing";typing.textContent="•••";screen.append(typing);
        timer=setTimeout(()=>{if(id!==generation)return;typing.remove();appendBubble(role,msg,link);timer=setTimeout(next,1900)},900);
      } else {appendBubble(role,msg,link);timer=setTimeout(next,reduced?170:1900);}
    };
    next();
  }
  dots.forEach(dot=>dot.addEventListener("click",()=>start(Number(dot.dataset.slide))));
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)start(0);else {generation++;clearTimeout(timer);}});
  start(0);
})();