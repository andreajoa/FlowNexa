// English copy based on the author's supplied manuscript and official English storefront.
// Deterministic phrase routing, not a clinical assessment or generative AI agent.
export const BOOK_URL='https://www.gilberto-souza.com/en';
const CONTACT='https://www.gilberto-souza.com/en/contact';
const qr=(title,payload)=>({title,payload});
const bookChoice=[qr('About the book','BOOK_DETAILS'),qr('Paperback','PAPERBACK'),qr('Contact','HUMAN_CONTACT')];
const supportChoice=[qr('About the book','BOOK_DETAILS'),qr('Faith & hope','FAITH'),qr('Contact','HUMAN_CONTACT')];
const rule=(id,label,words,next=id)=>({id,label,value:words.join('\n'),next});
const message=(id,text,replies,next='finish')=>({id,type:'message',text, next,...(replies?{quick_replies:replies}:{})});
export function gilbertoFlow({comments=false}={}){
 const nodes=[
 {id:'safety',type:'switch',operator:'contains_any',cases:[
 rule('crisis','Risco imediato',['kill myself','end my life','want to die','suicidal thoughts','hurt myself','harm myself','not safe right now',"can't go on",'cannot go on','kill him','kill her','hurt someone','suicide plan']),
 rule('human','Contato humano',['HUMAN_CONTACT','real person','speak to gilberto','talk to gilberto','human agent','talk to a human','customer service','contact you','contact gilberto']),
 rule('decline','Respeitar recusa',['not interested','no thanks','no thank you',"don't want the book",'do not want the book','stop selling','no more promotions','not looking for a book','not ready','cannot afford',"can't afford",'no money']),
 rule('thanks','Agradecimento',['thank you','thanks','appreciate it','god bless'])],default:'campaigns'},
 {id:'campaigns',type:'switch',operator:'contains_any',cases:[
 rule('black_friday','Black Friday',['BLACKFRIDAY','black friday','cyber monday']),
 rule('christmas','Natal',['CHRISTMAS_BOOK','christmas','xmas','holiday gift']),
 rule('new_year','Ano Novo',['NEWYEAR','new year','newyear','new years'])],default:'topics'},
 {id:'topics',type:'switch',operator:'contains_any',cases:[
 rule('guru','Quem é Gilberto / credibilidade',['guru','scam','fraud','therapist','psychologist','who are you','who is gilberto','your qualifications','credentials','your story','what happened to you','coach']),
 rule('support','Compra já realizada',['already bought','already purchased','bought your book','my order','download link','cannot download',"can't download",'refund','charged','payment failed','did not receive','haven’t received',"haven't received",'receipt','customer support','SUPPORT']),
 rule('paperback','Livro físico',['PAPERBACK','paperback','hardcopy','hard copy','physical book','printed book','amazon','barnes','shipping']),
 rule('book','Conhecer e comprar o livro',['BOOK_DETAILS','book','buy','price','cost','ebook','e-book','audio','purchase','read it','send me the link','send the link','where can i get','how much']),
 rule('anger','Raiva e limites',['anger','angry','revenge','hate her','hate him','get back at','furious','rage','show her','make her regret']),
 rule('sleep','Noites difíceis / ruminação',['sleep','insomnia','2am','3am','panic','overthinking','checking her profile','checking his profile','keep thinking']),
 rule('identity','Identidade / valor próprio',['worthless','not enough','identity','self worth','self-worth','confidence','lost myself','failure','rebuild','start over','purpose']),
 rule('faith','Fé e esperança',['FAITH','god','faith','jesus','pray','prayer','christian','bible','hope']),
 rule('pain','Separação / escuta inicial',['GOING_THROUGH_IT','cheated','cheating','betrayal','betrayed','replaced','left me','breakup','break up','divorce','abandoned','heartbreak','heartbroken','hurting','pain','depressed','depression','lonely','alone','struggling','hard time','difficult time','lost','help me',"can't move on",'cannot move on']),
 rule('language','Outros idiomas',['portuguese','português','portugues','spanish','español','espanol','portuguese version','spanish version'])],default:'hello'},
 message('crisis',"I'm Gilberto's automated assistant. I'm sorry you're facing this. If you might act on thoughts of harming yourself or someone else, contact local emergency services now and ask a trusted person to stay with you. In the US or Canada, call or text 988 for crisis support. Elsewhere, find a local helpline at https://findahelpline.com/ . This automated inbox cannot provide emergency care. You do not need to buy anything to deserve support."),
 message('human',"I'm Gilberto's automated assistant, so I can't promise a personal response or an appointment. To contact Gilberto, use the contact form: "+CONTACT+" . Please don't send payment details or private medical information here. Reply STOP if you want to pause automated replies."),
 message('decline',"Understood — no book link or sales message in this reply. You don't have to buy anything to be welcome here. If you want to pause automated replies completely, send STOP. For a personal enquiry: "+CONTACT),
 message('thanks',"You're welcome. Thank you for taking the time to connect with Gilberto's page. Take things at your own pace. — Gilberto's automated assistant"),
 message('guru',"I'm Gilberto's automated assistant. Gilberto shares his experience of betrayal and rebuilding; this page presents him as an author, not a guru or a mental-health professional. His book, How to Overcome the Pain of Being Replaced by Someone Else, combines his personal story, reflections on identity and boundaries, and Christian faith. It offers a perspective, not guaranteed results. Would you like to know what the book covers, or are you going through something yourself?",[qr('About the book','BOOK_DETAILS'),qr("Going through it",'GOING_THROUGH_IT'),qr('Contact','HUMAN_CONTACT')]),
 message('support',"I'm Gilberto's automated assistant. If you've already bought the book, you don't need to buy it again to ask for help. Check the email address used at checkout and your spam folder for digital delivery. For an order, access or refund enquiry, use "+CONTACT+" and include your order reference there. For Amazon or Barnes & Noble orders, contact the retailer's order support. Please don't post card details or passwords in this chat.",[qr('Contact','HUMAN_CONTACT')]),
 message('paperback',"I'm Gilberto's automated assistant. You can view the English paperback through the official retailer links:\nAmazon: https://www.amazon.com/dp/B0H2LXHCH4\nBarnes & Noble: https://www.barnesandnoble.com/w/how-to-overcome-the-pain-of-being-replaced-by-someone-else-gilberto-de-souza/1150279536?ean=9798256373504\nThe retailer shows the current price, delivery options and availability. Prefer the digital edition? Reply BOOK.",bookChoice),
 message('book',"I'm Gilberto's automated assistant. The book follows his experience of being replaced and rebuilding his life. Chapters explore identity, anger without revenge, purpose, faith and hope. It may offer perspective and help you feel less alone; it's a personal account, not therapy or a promise of recovery.\nRead about the English digital edition and check the current price and included formats here: "+BOOK_URL+"\nWould you prefer a paperback, or do you have a question about the story?",[qr('Paperback','PAPERBACK'),qr('Who is Gilberto?','YOUR_STORY'),qr('Contact','HUMAN_CONTACT')]),
 message('anger',"I'm Gilberto's automated assistant. Betrayal can bring up anger. You don't have to turn that feeling into revenge or another message to your ex. If you can, step away from the conversation and reach out to someone you trust. Gilberto writes about anger, boundaries and rebuilding without retaliation. Would you like to hear what the book covers? If someone may be in immediate danger, contact local emergency services.",supportChoice),
 message('sleep',"I'm Gilberto's automated assistant. Those quiet hours after a breakup can feel especially heavy. A recurring theme on Gilberto's page is giving yourself time before making decisions or contacting an ex late at night. His book also reflects on rumination and rebuilding daily life. If sleep problems or distress keep affecting your life, consider support from a qualified professional. Would you like to know what the book covers?",supportChoice),
 message('identity',"I'm Gilberto's automated assistant. Being replaced doesn't decide your value. Rebuilding Your Identity is one of the book's chapters: Gilberto reflects on who you are beyond a relationship, your boundaries and a sense of purpose. His experience may give you something to reflect on as you find your own way forward. Would you like an overview of the book?",supportChoice),
 message('faith',"I'm Gilberto's automated assistant. Christian faith, prayer and hope are part of Gilberto's story and the book. He writes about finding purpose after betrayal and rebuilding when life feels uncertain. That's his personal perspective; you don't have to share his beliefs to be treated with respect here. Faith and a book can sit alongside professional support. Would you like to know more about the book?",bookChoice),
 message('pain',"I'm Gilberto's automated assistant. I'm sorry you're going through a difficult time. You don't have to explain everything at once or buy anything to be heard. Gilberto wrote from his own experience of betrayal and being replaced. His reflections on identity, anger and hope may help you feel less alone. What's weighing on you most right now: the breakup, your confidence, or the nights when your mind won't stop?",[qr('My confidence','SELF_WORTH'),qr('Difficult nights','SLEEP'),qr('About the book','BOOK_DETAILS')]),
 message('language',"I'm Gilberto's automated English assistant. The official book page lists English, Portuguese and Spanish editions and their purchase links: https://www.gilberto-souza.com/links . Choose the edition you prefer. For a personal enquiry: "+CONTACT),
 message('hello',"Hi — I'm Gilberto's automated assistant. Thanks for reaching out. Gilberto writes about rebuilding after betrayal and being replaced. I can share his story, explain the book or point you to the contact page. What brought you here? You can choose an option or write a little more. If you sent a voice note or image, please describe your question in text. Reply STOP at any time to pause automated replies.",[qr('About the book','BOOK_DETAILS'),qr('Going through it','GOING_THROUGH_IT'),qr('Who is Gilberto?','YOUR_STORY')]),
 {id:'finish',type:'end'}
 ];
 // Payloads are alternatives too, and never rely on the visible button label.
 nodes.find(n=>n.id==='topics').cases.find(c=>c.id==='guru').value+='\nYOUR_STORY';
 nodes.find(n=>n.id==='topics').cases.find(c=>c.id==='identity').value+='\nSELF_WORTH';
 const seasons=[['black_friday','Black Friday','A new chapter starts with you.','black-friday'],['christmas','Christmas','Give hope. Begin a new chapter.','christmas'],['new_year','New Year','Your story is still being written.','new-year']];
 for(const [id,name,line,file] of seasons){
  nodes.push(message(id,"I'm Gilberto's automated assistant. "+name+" reading: "+line+" Discover Gilberto's personal story of rebuilding after betrayal. Explore the English book, formats and current price at "+BOOK_URL+" . See the official page for availability and terms.",undefined,comments?'finish':id+'_art'));
  if(!comments)nodes.push({id:id+'_art',type:'image',url:'https://flownex.online/campaigns/gilberto-rebuild/'+file+'.png',next:id+'_link'},{id:id+'_link',type:'buttons',text:'Explore the book and choose your edition',buttons:[{type:'web_url',title:'Discover the book',url:BOOK_URL},{type:'postback',title:'Paperback',payload:'PAPERBACK'},{type:'postback',title:'Contact',payload:'HUMAN_CONTACT'}],next:'finish'});
 }
 nodes.find(n=>n.id==='topics').cases.find(c=>c.id==='book').next='reading_season';
 nodes.push({id:'reading_season',type:'switch',operator:'date_between',cases:[
  {id:'bf_2026',label:'Black Friday 2026',value:'2026-10-18/2026-11-30',next:'black_friday'},
  {id:'christmas_2026',label:'Christmas 2026',value:'2026-12-01/2026-12-25',next:'christmas'},
  {id:'newyear_2027',label:'New Year 2027',value:'2026-12-26/2027-01-07',next:'new_year'}
 ],default:'book'});
 const rows=nodes.filter(n=>n.type==='message');
 const graph_layout=Object.fromEntries(nodes.map(n=>[n.id,{x:n.id==='safety'?40:n.id==='campaigns'?370:n.id==='topics'?700:n.id==='reading_season'?1360:n.type==='end'?2350:n.type==='image'?1690:n.type==='buttons'?2020:1030,y:n.type==='switch'?(n.id==='reading_season'?560:60):60+Math.max(0,rows.findIndex(m=>m.id===n.id.replace(/_(art|link)$/,'')))*230}]));
 return {name:comments?'Gilberto | EN | Comments · all posts':'Gilberto | EN | Direct · care & book campaigns',trigger_type:'comment_any',scope:'all',configuration:{...(comments?{}:{entry_points:['dm','story']}),reply_per_message:true,once_per_contact:comments,opt_out_keywords:['STOP','UNSUBSCRIBE','CANCEL','STOP MESSAGES','PARAR','SAIR'],graph:{version:1,start:'safety',nodes},graph_layout}};
}
