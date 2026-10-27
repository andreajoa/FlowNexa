const copy={
 'pt-BR':{verify:['Confirme seu e-mail no FlowNexa','Confirme seu endereço para acessar seu espaço de trabalho.','Confirmar e-mail'],reset:['Redefina sua senha no FlowNexa','Recebemos uma solicitação para redefinir sua senha.','Redefinir senha'],expiry:'Este link expira em breve e só pode ser utilizado uma vez. Se você não fez esta solicitação, ignore esta mensagem.'},
 en:{verify:['Verify your FlowNexa email','Confirm your email address to access your workspace.','Verify email'],reset:['Reset your FlowNexa password','We received a request to reset your password.','Reset password'],expiry:'This link expires shortly and can only be used once. If you did not request this, ignore this email.'},
 de:{verify:['Bestätigen Sie Ihre FlowNexa-E-Mail','Bestätigen Sie Ihre E-Mail-Adresse, um auf Ihren Arbeitsbereich zuzugreifen.','E-Mail bestätigen'],reset:['FlowNexa-Passwort zurücksetzen','Wir haben eine Anfrage zum Zurücksetzen Ihres Passworts erhalten.','Passwort zurücksetzen'],expiry:'Dieser Link läuft in Kürze ab und kann nur einmal verwendet werden. Ignorieren Sie diese Nachricht, wenn Sie diese Anfrage nicht gestellt haben.'},
 fr:{verify:['Confirmez votre adresse e-mail FlowNexa','Confirmez votre adresse e-mail pour accéder à votre espace de travail.','Confirmer mon adresse'],reset:['Réinitialisez votre mot de passe FlowNexa','Nous avons reçu une demande de réinitialisation de votre mot de passe.','Réinitialiser mon mot de passe'],expiry:'Ce lien expire bientôt et ne peut être utilisé qu’une seule fois. Si vous n’avez pas fait cette demande, ignorez ce message.'},
 es:{verify:['Confirma tu correo de FlowNexa','Confirma tu dirección de correo para acceder a tu espacio de trabajo.','Confirmar correo'],reset:['Restablece tu contraseña de FlowNexa','Recibimos una solicitud para restablecer tu contraseña.','Restablecer contraseña'],expiry:'Este enlace caduca pronto y solo puede utilizarse una vez. Si no lo solicitaste, ignora este mensaje.'},
 it:{verify:['Conferma la tua email FlowNexa','Conferma il tuo indirizzo email per accedere al tuo spazio di lavoro.','Conferma email'],reset:['Reimposta la password FlowNexa','Abbiamo ricevuto una richiesta di reimpostazione della password.','Reimposta password'],expiry:'Questo link scade a breve e può essere utilizzato una sola volta. Se non hai fatto questa richiesta, ignora questo messaggio.'}
};
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function identityEmail({purpose,token,locale='en'},env){
 const language=copy[locale]?locale:'en',c=copy[language],parts=c[purpose==='verify_email'?'verify':'reset'];
 const base=new URL(env.PUBLIC_BASE_URL||'https://flownex.online');
 if(base.protocol!=='https:')throw Error('invalid_public_url');
 const link=new URL(language==='en'?'/app?lang=en':'/app',base);link.hash=new URLSearchParams({[purpose==='verify_email'?'verify':'reset']:token}).toString();
 const text=`FlowNexa\n\n${parts[1]}\n\n${parts[2]}: ${link}\n\n${c.expiry}`;
 const html=`<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(parts[0])}</title></head><body style="margin:0;background:#f6f7fb;color:#182033;font-family:Arial,sans-serif"><main style="max-width:560px;margin:32px auto;padding:32px;background:white;border-radius:12px"><p style="font-size:24px;font-weight:bold">FlowNexa</p><h1 style="font-size:24px">${escape(parts[0])}</h1><p>${escape(parts[1])}</p><p style="margin:32px 0"><a href="${escape(link)}" style="display:inline-block;background:#3730a3;color:white;padding:14px 22px;border-radius:6px;text-decoration:none">${escape(parts[2])}</a></p><p style="font-size:13px;color:#4b5563">${escape(c.expiry)}</p><p style="font-size:12px;overflow-wrap:anywhere">${escape(link)}</p></main></body></html>`;
 return{subject:parts[0],html,text};
}
export async function sendIdentityEmail(env,{email,purpose,token,tokenHash,locale}){
 if(!env.RESEND_API_KEY)throw Error('email_configuration_missing');
 const message=identityEmail({purpose,token,locale},env);
 try {
 const response=await(env.RESEND_FETCH||fetch)('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${env.RESEND_API_KEY}`,'content-type':'application/json','idempotency-key':`flownexa-${purpose}-${tokenHash}`},body:JSON.stringify({from:env.RESEND_FROM||'FlowNexa <hello@flownex.online>',reply_to:env.RESEND_REPLY_TO||'flownex@proton.me',to:[email],...message}),signal:AbortSignal.timeout(12000)});
 const result=await response.json();
 if(!response.ok||typeof result.id!=='string'||!result.id)throw Error('email_delivery_unavailable');
 return result.id;
 } catch {throw Error('email_delivery_unavailable');}
}


// Trial reminder (Stripe trial_will_end, 3 days before the first charge). Plain, self-serve: cancel in the portal.
export function trialReminderEmail({trialEnd,plan,locale='pt-BR'},env){
 const en=locale==='en',base=new URL(env.PUBLIC_BASE_URL||'https://flownex.online');
 const day=new Date(trialEnd*1000).toLocaleDateString(en?'en-US':'pt-BR',{day:'numeric',month:'long'});
 const price=plan?new Intl.NumberFormat(en?'en-US':'pt-BR',{style:'currency',currency:plan.currency.toUpperCase()}).format(plan.unit_amount/100):null;
 const link=new URL(en?'/app?lang=en#billing':'/app#billing',base).toString();
 const subject=en?'Your FlowNexa trial ends in 3 days':'Seu teste do FlowNexa termina em 3 dias';
 const lines=en?[`Your 7-day free trial ends on ${day}.`,price?`On that day your card will be charged ${price} for ${plan.name}.`:'On that day your card will be charged for your plan.','Want to keep your automations running? Do nothing. Prefer to stop? Cancel in one click from Billing in your dashboard, before that date, and you will not be charged.']
  :[`Seu teste grátis de 7 dias termina em ${day}.`,price?`Nesse dia o cartão será cobrado em ${price} pelo ${plan.name}.`:'Nesse dia o cartão será cobrado pelo seu plano.','Quer manter suas automações? Não precisa fazer nada. Prefere parar? Cancele em um clique em Assinatura, no seu painel, antes dessa data, e nada será cobrado.'];
 const button=en?'Open Billing':'Abrir Assinatura';
 const text=`FlowNexa\n\n${lines.join('\n\n')}\n\n${button}: ${link}`;
 const html=`<!doctype html><html lang="${en?'en':'pt-BR'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(subject)}</title></head><body style="margin:0;background:#faf9fc;color:#111016;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif"><main style="max-width:560px;margin:32px auto;background:#fff;border:2px solid #18141d;border-radius:18px;padding:28px"><p style="font-weight:900;font-size:20px;margin:0 0 18px">Flow<span style="color:#7c3ee9">Nexa</span></p>${lines.map(l=>`<p style="font-size:16px;line-height:1.6;margin:0 0 14px">${escape(l)}</p>`).join('')}<p style="margin:22px 0 0"><a href="${escape(link)}" style="display:inline-block;background:#7c3ee9;color:#fff;border-radius:12px;padding:14px 22px;font-weight:800;text-decoration:none">${escape(button)}</a></p></main></body></html>`;
 return{subject,html,text};
}
export async function sendTrialReminder(env,{email,trialEnd,plan,locale,eventId}){
 if(!env.RESEND_API_KEY)throw Error('email_configuration_missing');
 const message=trialReminderEmail({trialEnd,plan,locale},env);
 const response=await(env.RESEND_FETCH||fetch)('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${env.RESEND_API_KEY}`,'content-type':'application/json','idempotency-key':`flownexa-trial-${eventId}`},body:JSON.stringify({from:env.RESEND_FROM||'FlowNexa <hello@flownex.online>',to:[email],subject:message.subject,html:message.html,text:message.text})});
 const result=await response.json();
 if(!response.ok||typeof result.id!=='string')throw Error('email_delivery_unavailable');
 return result.id;
}
