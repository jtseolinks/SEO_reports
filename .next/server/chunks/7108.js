"use strict";exports.id=7108,exports.ids=[7108],exports.modules={14303:(a,b,c)=>{c.d(b,{KR:()=>k,Ld:()=>i,QU:()=>j});var d=c(51691),e=c(18739);let f=["smtpPass"],g="********",h=["agencyName","agencyUrl","contactName","contactEmail","description","logoUrl","reportPrimaryColor","reportAccentColor","reportFooterText","smtpHost","smtpPort","smtpUser","smtpPass","emailSenderName","emailSenderEmail","emailSubjectTemplate","emailIntroText","agencyBccEmail","agencyBccEnabled","emailHtmlTemplate","defaultSendDay","defaultLanguage","defaultAutoSend"];async function i(a){let b=Object.fromEntries((await d.prisma.agencySetting.findMany({where:{agencyId:a,key:{in:h}}})).map(a=>[a.key,a.value])),c={agencyName:process.env.AGENCY_NAME??"",agencyUrl:"",contactName:"",contactEmail:process.env.AGENCY_EMAIL??"",description:"",logoUrl:"",reportPrimaryColor:"#1E2D7D",reportAccentColor:"#1E6FBF",reportFooterText:"",smtpHost:process.env.SMTP_HOST??"",smtpPort:process.env.SMTP_PORT??"587",smtpUser:process.env.SMTP_USER??"",smtpPass:process.env.SMTP_PASS??"",emailSenderName:process.env.AGENCY_NAME??"",emailSenderEmail:process.env.AGENCY_EMAIL??"",emailSubjectTemplate:"דוח SEO חודשי – {client} – {month}",emailIntroText:"",agencyBccEmail:"",agencyBccEnabled:"true",emailHtmlTemplate:"",defaultSendDay:"5",defaultLanguage:"he",defaultAutoSend:"true"};return h.reduce((a,d)=>{let g=b[d],h=f.includes(d)?void 0!==g?function(a){if(!a)return"";try{return(0,e.Y)(a)}catch{return a}}(g):c[d]:g??c[d];return{...a,[d]:h}},{})}function j(a){let b={...a};for(let a of f)b[a]&&(b[a]=g);return b}async function k(a,b){await Promise.all(Object.entries(b).filter(([a])=>h.includes(a)).filter(([a,b])=>!(f.includes(a)&&b===g)).map(([b,c])=>{let g=c??"",h=f.includes(b)&&g?(0,e.w)(g):g;return d.prisma.agencySetting.upsert({where:{agencyId_key:{agencyId:a,key:b}},create:{agencyId:a,key:b,value:h},update:{value:h}})}))}},15604:(a,b,c)=>{c.d(b,{GO:()=>l,KL:()=>j,M6:()=>m,hv:()=>i,pZ:()=>k});var d=c(33873),e=c.n(d),f=c(57367),g=c.n(f);let h=e().join(process.cwd(),"private","reports");function i(a,b){return`/reports/${a}/${b}`}function j(a,b){return e().join(h,e().basename(a),e().basename(b))}function k(a){let b=a.split("/").filter(Boolean),c=b[b.length-1]??"";return j(b.length>=3?b[b.length-2]:"",c)}function l(a){return e().join(h,e().basename(a))}async function m(a){try{await g().unlink(k(a))}catch{}}},18739:(a,b,c)=>{c.d(b,{Y:()=>h,w:()=>g});var d=c(55511);let e="aes-256-gcm";function f(){let a=process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;if(!a)throw Error("GOOGLE_TOKEN_ENCRYPTION_KEY is not set");return(0,d.createHash)("sha256").update(a).digest()}function g(a){let b=f(),c=(0,d.randomBytes)(12),g=(0,d.createCipheriv)(e,b,c),h=Buffer.concat([g.update(a,"utf8"),g.final()]),i=g.getAuthTag();return Buffer.concat([c,i,h]).toString("base64")}function h(a){let b=f(),c=Buffer.from(a,"base64"),g=c.subarray(0,12),h=c.subarray(12,28),i=c.subarray(28),j=(0,d.createDecipheriv)(e,b,g);return j.setAuthTag(h),Buffer.concat([j.update(i),j.final()]).toString("utf8")}},37108:(a,b,c)=>{c.d(b,{AQ:()=>p,FI:()=>l,Ge:()=>r,J1:()=>q,L2:()=>k,qO:()=>o,wR:()=>m});var d=c(35924),e=c(57367),f=c.n(e),g=c(14303),h=c(15604);async function i(a){let b=await (0,g.Ld)(a),c=b.smtpHost||process.env.SMTP_HOST,e=parseInt(b.smtpPort||process.env.SMTP_PORT||"587"),f=b.smtpUser||process.env.SMTP_USER,h=b.smtpPass||process.env.SMTP_PASS;if(!c||!f||!h)throw Error("SMTP לא מוגדר — הכנס פרטי שרת בהגדרות האימייל");return d.createTransport({host:c,port:e,secure:465===e,auth:{user:f,pass:h}})}function j(a,b){return a.replace(/\{(\w+)\}/g,(a,c)=>b[c]??`{${c}}`)}async function k(a){var b;let c,d,{agencyId:e,to:k,cc:l=[],clientName:m,monthName:n,pdfUrl:o}=a,p=await (0,g.Ld)(e),q=p.agencyName||process.env.AGENCY_NAME||"SEO Agency",r=p.emailSenderName||q,s=p.emailSenderEmail||process.env.SMTP_FROM||"noreply@example.com",t=(0,h.pZ)(o),u=await f().readFile(t),v=t.split(/[\\/]/).pop()??"report.pdf",w="true"===p.agencyBccEnabled&&p.agencyBccEmail?p.agencyBccEmail:void 0,x=j(p.emailSubjectTemplate||"דוח SEO חודשי – {client} – {month}",{client:m,month:n,agency:q}),y=(b=p.emailIntroText,d=b?.trim()||`מצורף דוח ה-SEO החודשי עבור ${m} לחודש ${n}.

הדוח כולל נתוני Search Console, נתוני תנועה אורגנית מ-GA4, השוואה לחודש הקודם והמלצות להמשך עבודה.`,`שלום,

${d}

בברכה,
${q}`),z=(process.env.NEXTAUTH_URL||process.env.APP_URL||"").replace(/\/$/,""),A=p.logoUrl?p.logoUrl.startsWith("http")?p.logoUrl:`${z}${p.logoUrl}`:"",B=p.emailIntroText?.trim()||"הדוח כולל נתוני Search Console, נתוני תנועה אורגנית מ-GA4, השוואה לחודש הקודם והמלצות להמשך עבודה.";p.emailHtmlTemplate?.trim()&&(c=j(p.emailHtmlTemplate,{client:m,month:n,agency:q,introText:B,logoUrl:A}));let C=await i(e);return(await C.sendMail({from:`${r} <${s}>`,to:k,cc:l.length>0?l:void 0,bcc:w,subject:x,text:y,...c?{html:c}:{},attachments:[{filename:v,content:u,contentType:"application/pdf"}]})).messageId??""}async function l(a,b){let c=await (0,g.Ld)(a),d=c.agencyName||process.env.AGENCY_NAME||"SEO Agency",e=c.emailSenderName||d,f=c.emailSenderEmail||process.env.SMTP_FROM||"noreply@example.com",h=await i(a);return(await h.sendMail({from:`${e} <${f}>`,to:b,subject:"[Test] SEO Reports – email configuration test",text:`This is a test email from ${d} SEO Reports system.

If you received this, your SMTP configuration is working correctly.`})).messageId??""}async function m(a,b,c,d){let e=await (0,g.Ld)(a),f=e.agencyName||process.env.AGENCY_NAME||"SEO Agency",h=e.emailSenderName||f,j=e.emailSenderEmail||process.env.SMTP_FROM||"noreply@example.com",k=await i(a),l=`<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"/><title>הזמנה להצטרף</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#1E2D7D;padding:32px 40px;">
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.6);margin-bottom:6px;">הזמנה לסוכנות</p>
            <h1 style="margin:0;font-size:26px;font-weight:800;color:#ffffff;">${f}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">שלום,</p>
            <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.7;">
              <strong>${c}</strong> הזמין אותך להצטרף ל-<strong>${f}</strong> במערכת Rankey SEO Reports.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#1E2D7D;border-radius:8px;padding:14px 32px;text-align:center;">
                  <a href="${d}" style="color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;">קבל הזמנה ←</a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 6px;font-size:13px;color:#9CA3AF;">לא עובד הכפתור? העתק את הקישור:</p>
            <p style="margin:0 0 20px;font-size:12px;"><a href="${d}" dir="ltr" style="color:#1E2D7D;word-break:break-all;">${d}</a></p>
            <p style="margin:0;font-size:13px;color:#9CA3AF;">הקישור תקף ל-7 ימים.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:11px;color:#9CA3AF;text-align:center;">מייל זה נשלח אוטומטית על ידי מערכת Rankey SEO Reports</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;return(await k.sendMail({from:`${h} <${j}>`,to:b,subject:`הוזמנת להצטרף ל-${f}`,text:`שלום,

${c} הזמין אותך להצטרף ל-${f} במערכת Rankey SEO Reports.

לחץ על הקישור:
${d}

הקישור תקף ל-7 ימים.

בברכה,
${f}`,html:l})).messageId??""}async function n(){let a=process.env.SMTP_HOST,b=process.env.SMTP_PORT||"587",e=process.env.SMTP_USER,f=process.env.SMTP_PASS,g=process.env.SMTP_FROM,h=process.env.SMTP_FROM_NAME||process.env.AGENCY_NAME||"Rankey SEO Reports";if(!a||!e||!f){let{prisma:d}=await Promise.resolve().then(c.bind(c,51691)),h=await d.agencySetting.findMany({where:{key:{in:["smtpHost","smtpPort","smtpUser","smtpPass","emailSenderEmail"]}},orderBy:{updatedAt:"desc"}}),i={};for(let a of h)i[a.agencyId]||(i[a.agencyId]={}),i[a.agencyId][a.key]=a.value;for(let c of Object.values(i))if(c.smtpHost&&c.smtpUser&&c.smtpPass){a=a||c.smtpHost,b=b||c.smtpPort||"587",e=e||c.smtpUser,f=f||c.smtpPass,g=g||c.emailSenderEmail;break}}if(!a||!e||!f)throw Error("SMTP לא מוגדר — הגדר SMTP_HOST / SMTP_USER / SMTP_PASS ב-.env.local או בהגדרות הסוכנות");let i=parseInt(b);return{transporter:d.createTransport({host:a,port:i,secure:465===i,auth:{user:e,pass:f}}),fromEmail:g||e,fromName:h}}async function o(a,b,c){let{transporter:d,fromEmail:e,fromName:f}=await n(),g=`<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"/><title>הוזמנת לצוות</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#1E2D7D 0%,#2a3d9a 100%);padding:32px 40px;">
            <div style="width:36px;height:36px;background:#00d4d4;border-radius:8px;margin-bottom:14px;display:inline-flex;align-items:center;justify-content:center;">
              <span style="color:#1E2D7D;font-size:20px;font-weight:900;">#</span>
            </div>
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.6);margin-bottom:4px;">הוזמנת לצוות</p>
            <h1 style="margin:0;font-size:22px;font-weight:800;color:#ffffff;">${b}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">שלום,</p>
            <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.7;">
              הוספת אותך כחבר צוות ב-<strong>${b}</strong> במערכת Rankey SEO Reports.<br/>
              לחץ על הכפתור להגדרת סיסמא וכניסה למערכת.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#1E2D7D;border-radius:8px;padding:14px 40px;text-align:center;">
                  <a href="${c}" style="color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;">הגדר סיסמא וכנס ←</a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 6px;font-size:13px;color:#9CA3AF;">לא עובד הכפתור? העתק את הקישור:</p>
            <p style="margin:0 0 20px;font-size:12px;"><a href="${c}" dir="ltr" style="color:#1E2D7D;word-break:break-all;">${c}</a></p>
            <p style="margin:0;font-size:13px;color:#9CA3AF;">הקישור תקף ל-7 ימים.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:16px 40px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:11px;color:#9CA3AF;text-align:center;">מייל זה נשלח אוטומטית על ידי מערכת Rankey SEO Reports</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;return(await d.sendMail({from:`${f} <${e}>`,to:a,subject:`הוזמנת להצטרף לצוות ${b}`,text:`שלום,

הוספת אותך כחבר צוות ב-${b} במערכת Rankey SEO Reports.

להגדרת סיסמא וכניסה:
${c}

הקישור תקף ל-7 ימים.

בברכה,
צוות Rankey`,html:g})).messageId??""}async function p(a,b,c){let{transporter:d,fromEmail:e,fromName:f}=await n(),g=`<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"/><title>הגדרת חשבון סוכנות</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#1E2D7D 0%,#2a3d9a 100%);padding:32px 40px;">
            <div style="width:40px;height:40px;background:#00d4d4;border-radius:8px;margin-bottom:16px;display:inline-flex;align-items:center;justify-content:center;">
              <span style="color:#1E2D7D;font-size:22px;font-weight:900;">#</span>
            </div>
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.6);margin-bottom:6px;">ברוכים הבאים ל-Rankey SEO Reports</p>
            <h1 style="margin:0;font-size:24px;font-weight:800;color:#ffffff;">${b}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">שלום,</p>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.7;">
              חשבון הסוכנות <strong>${b}</strong> נוצר עבורך במערכת Rankey SEO Reports.<br/>
              להשלמת ההגדרה הראשונית, לחץ על הכפתור למטה.
            </p>
            <div style="background:#f8faff;border-radius:10px;padding:20px 24px;margin-bottom:28px;border:1px solid #e0e7ff;">
              <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#1E2D7D;">בהגדרה תוכל:</p>
              <ul style="margin:0;padding:0 20px 0 0;font-size:13px;color:#374151;line-height:2;">
                <li>הגדרת סיסמא לכניסה למערכת</li>
                <li>פרטי הסוכנות (שם, לוגו, כתובת)</li>
                <li>חיבור Google Search Console</li>
                <li>הוספת חברי צוות</li>
                <li>הגדרות אימייל (SMTP)</li>
              </ul>
            </div>
            <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#1E2D7D;border-radius:8px;padding:14px 40px;text-align:center;">
                  <a href="${c}" style="color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;">התחל הגדרה ←</a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 6px;font-size:13px;color:#9CA3AF;">לא עובד הכפתור? העתק את הקישור:</p>
            <p style="margin:0 0 20px;font-size:12px;"><a href="${c}" dir="ltr" style="color:#1E2D7D;word-break:break-all;">${c}</a></p>
            <p style="margin:0;font-size:13px;color:#9CA3AF;">הקישור תקף ל-7 ימים.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:11px;color:#9CA3AF;text-align:center;">מייל זה נשלח אוטומטית על ידי מערכת Rankey SEO Reports</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;return(await d.sendMail({from:`${f} <${e}>`,to:a,subject:`הגדרת חשבון סוכנות – ${b}`,text:`שלום,

חשבון הסוכנות ${b} נוצר עבורך במערכת Rankey SEO Reports.

להשלמת ההגדרה הראשונית:
${c}

הקישור תקף ל-7 ימים.

בברכה,
צוות Rankey`,html:g})).messageId??""}async function q(a,b){let{transporter:c,fromEmail:d,fromName:e}=await n(),f=`<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"/><title>איפוס סיסמא</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#1E2D7D 0%,#2a3d9a 100%);padding:32px 40px;">
            <div style="width:36px;height:36px;background:#00d4d4;border-radius:8px;margin-bottom:14px;display:inline-flex;align-items:center;justify-content:center;">
              <span style="color:#1E2D7D;font-size:20px;font-weight:900;">#</span>
            </div>
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.6);margin-bottom:4px;">Rankey SEO Reports</p>
            <h1 style="margin:0;font-size:22px;font-weight:800;color:#ffffff;">איפוס סיסמא</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">שלום,</p>
            <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.7;">
              התקבלה בקשה לאיפוס הסיסמא שלך במערכת Rankey SEO Reports.<br/>
              לחץ על הכפתור להגדרת סיסמא חדשה.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#1E2D7D;border-radius:8px;padding:14px 40px;text-align:center;">
                  <a href="${b}" style="color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;">הגדר סיסמא חדשה ←</a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 6px;font-size:13px;color:#9CA3AF;">לא עובד הכפתור? העתק את הקישור:</p>
            <p style="margin:0 0 20px;font-size:12px;"><a href="${b}" dir="ltr" style="color:#1E2D7D;word-break:break-all;">${b}</a></p>
            <p style="margin:0;font-size:13px;color:#9CA3AF;">הקישור תקף ל-7 ימים. אם לא ביקשת איפוס סיסמא — התעלם ממייל זה.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:16px 40px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:11px;color:#9CA3AF;text-align:center;">מייל זה נשלח אוטומטית על ידי מערכת Rankey SEO Reports</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;return(await c.sendMail({from:`${e} <${d}>`,to:a,subject:"איפוס סיסמא – Rankey SEO Reports",text:`שלום,

התקבלה בקשה לאיפוס הסיסמא שלך.

להגדרת סיסמא חדשה:
${b}

הקישור תקף ל-7 ימים.

צוות Rankey`,html:f})).messageId??""}function r(a){let[b,c]=a.split("-").map(Number);return new Date(b,c-1,1).toLocaleDateString("he-IL",{month:"long",year:"numeric"})}}};