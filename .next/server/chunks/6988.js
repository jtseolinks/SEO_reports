"use strict";exports.id=6988,exports.ids=[6988],exports.modules={26351:(a,b,c)=>{c.d(b,{OW:()=>e,SU:()=>d});let d={kpi_clicks:!0,kpi_impressions:!0,kpi_ctr:!0,kpi_position:!0,exec_summary:!0,trend_chart:!1,ga4_sessions:!0,ga4_revenue:!0,keywords_table:!0,pages_table:!0,ga4_pages:!0};function e(a){return a&&"object"==typeof a?{...d,...a}:{...d}}},64499:(a,b,c)=>{c.d(b,{H:()=>m});var d=c(26351);function e(a){return String(a??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function f(a){return a>=1e6?(a/1e6).toFixed(1).replace(/\.0$/,"")+"M":a>=1e3?(a/1e3).toFixed(1).replace(/\.0$/,"")+"K":a.toLocaleString("he-IL")}function g(a,b=2){return a.toFixed(b)+"%"}function h(a,b){let c=new Date(a+"T12:00:00"),d=new Date(b+"T12:00:00");return`${c.getDate().toString().padStart(2,"0")} ${c.toLocaleDateString("he-IL",{month:"long"})} – ${d.getDate().toString().padStart(2,"0")} ${d.toLocaleDateString("he-IL",{month:"long",year:"numeric"})}`}function i(a,b,c,d,e=!1){return`
  <div style="flex:1;background:#F8F9FB;border:1.5px solid #E8EAEE;border-radius:12px;padding:18px 20px;">
    <div style="font-size:11px;color:#6b7280;font-weight:500;margin-bottom:4px">${a}</div>
    <div style="font-size:28px;font-weight:800;color:#111827;letter-spacing:-0.03em;line-height:1.1">${b}</div>
    ${c?`<div style="font-size:11px;color:#9ca3af;margin-top:2px">${c}</div>`:""}
    <div style="margin-top:10px">${function(a,b=!1){if(.01>Math.abs(a.changePct)&&.01>Math.abs(a.change))return'<span style="font-size:11px;color:#9ca3af;font-weight:500">ללא שינוי</span>';let c=b?a.change<0:a.change>0,d=a.change>0?"↑":"↓",e=a.changePct>0?"+":"";return`<span style="display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:600;color:${c?"#16a34a":"#dc2626"};background:${c?"#f0fdf4":"#fef2f2"};border:1px solid ${c?"#bbf7d0":"#fecaca"};padding:2px 7px;border-radius:20px;line-height:1.4">${d} ${e}${g(Math.abs(a.changePct),1)}</span>`}(d,e)}</div>
  </div>`}function j(a){if(!a||0===a)return'<span style="color:#9ca3af">—</span>';let b=a<=3?"#16a34a":a<=10?"#1E2D7D":a<=20?"#d97706":"#9ca3af",c=Math.max(4,Math.min(100,Math.round(100-a/100*88)));return`<span style="display:inline-flex;align-items:center;gap:5px;direction:ltr">
    <span style="font-weight:700;color:${b};font-size:12px;min-width:30px">${a.toFixed(1)}</span>
    <span style="display:inline-block;width:40px;height:4px;background:#e5e7eb;border-radius:2px;overflow:hidden;flex-shrink:0">
      <span style="display:block;width:${c}%;height:100%;background:${b};border-radius:2px"></span>
    </span>
  </span>`}function k(a,b){return`
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid #EEF0F9">
    <div style="font-size:17px;font-weight:800;color:#111827;letter-spacing:-0.01em">${a}</div>
    <div style="font-size:11px;font-weight:700;color:#1E2D7D;background:#EEF0F9;padding:3px 10px;border-radius:20px">${b}</div>
  </div>`}function l(a){let b='<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:600;color:#166534;background:#f0fdf4;border:1px solid #bbf7d0;padding:2px 8px;border-radius:20px;line-height:1.5"><span style="width:6px;height:6px;border-radius:50%;background:#16a34a;display:inline-block;flex-shrink:0"></span>Google Search Console</span>',c='<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:600;color:#9a3412;background:#fff7ed;border:1px solid #fed7aa;padding:2px 8px;border-radius:20px;line-height:1.5"><span style="width:6px;height:6px;border-radius:50%;background:#ea580c;display:inline-block;flex-shrink:0"></span>Google Analytics 4</span>',d="gsc"===a?b:"ga4"===a?c:`${b}${c}`;return`<div style="display:flex;align-items:center;gap:6px;margin-bottom:12px"><span style="font-size:10px;color:#9ca3af;font-weight:500">מקור נתונים:</span>${d}</div>`}function m(a,b,c,n="",o=d.SU){let p=h(a.period.startDate,a.period.endDate),q=h(a.comparisonPeriod.startDate,a.comparisonPeriod.endDate),r=new Date().toLocaleDateString("he-IL",{day:"2-digit",month:"long",year:"numeric"}),s=a.ga4.sessions.current>0,t=[o.kpi_clicks&&i("קליקים אורגניים",f(a.gsc.clicks.current),"",a.gsc.clicks),o.kpi_impressions&&i("חשיפות",f(a.gsc.impressions.current),"",a.gsc.impressions),o.kpi_ctr&&i("CTR ממוצע",g(100*a.gsc.ctr.current),"",a.gsc.ctr),o.kpi_position&&i("פוזיציה ממוצעת",function(a,b=0){return a.toFixed(b)}(a.gsc.position.current,1),"מיקום ממוצע ב-Google",a.gsc.position,!0)].filter(Boolean).join(""),u=t?`<div style="display:flex;gap:12px">${t}</div>`:"",v=a.gsc.clicks.improved?"עלו":!1===a.gsc.clicks.improved?"ירדו":"נשארו יציבים",w=a.keywords.filter(a=>!a.isBrand&&a.change>2).length,x=o.exec_summary?`הקליקים האורגניים ${v} ב-${g(Math.abs(a.gsc.clicks.changePct))} בהשוואה ל-${q}.${a.gsc.opportunities.length>0?` קיימות ${a.gsc.opportunities.length} הזדמנויות SEO עם פוטנציאל חשיפה גבוה.`:""}${w>0?` ${w} ביטויים עוקבים שיפרו את מיקומם.`:""}`:"",y=o.trend_chart?function(a){if(!a||a.length<3)return'<div style="height:120px;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:12px">אין נתוני מגמה זמינים</div>';let b=a.length,c=Math.max(...a.map(a=>a.clicks),1),d=Math.min(...a.map(a=>a.clicks)),e=c-d||1,f=a=>36+a/(b-1)*632,g=a=>16+(1-(a-d)/e)*96,h=a.map((a,b)=>`${f(b).toFixed(1)},${g(a.clicks).toFixed(1)}`).join(" "),i=`${f(0).toFixed(1)},112.0 ${h} ${f(b-1).toFixed(1)},112.0`,j=Math.ceil(b/6),k=a.filter((a,c)=>0===c||c===b-1||c%j==0).map(b=>{let c=a.indexOf(b),d=new Date(b.date+"T12:00:00").getDate();return`<text x="${f(c).toFixed(1)}" y="134" text-anchor="middle" font-size="9" fill="#9ca3af" font-family="Heebo,Arial,sans-serif">${d}</text>`}).join(""),l=[0,.5,1].map(a=>{let b=16+(1-a)*96,c=Math.round(d+a*e),f=c>=1e3?(c/1e3).toFixed(1).replace(/\.0$/,"")+"K":c.toString();return`
      <line x1="36" y1="${b.toFixed(1)}" x2="668" y2="${b.toFixed(1)}" stroke="#f1f5f9" stroke-width="1"/>
      <text x="31.0" y="${(b+3.5).toFixed(1)}" text-anchor="end" font-size="8" fill="#cbd5e1" font-family="Heebo,Arial,sans-serif">${f}</text>`}).join(""),m=a.reduce((b,c,d)=>c.clicks>a[b].clicks?d:b,0);return`
  <svg width="680" height="140" viewBox="0 0 680 140" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:140px">
    <defs>
      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1E2D7D" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="#1E2D7D" stop-opacity="0.01"/>
      </linearGradient>
    </defs>
    ${l}
    <polygon points="${i}" fill="url(#areaGrad)"/>
    <polyline points="${h}" fill="none" stroke="#1E2D7D" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${a.map((a,b)=>`<circle cx="${f(b).toFixed(1)}" cy="${g(a.clicks).toFixed(1)}" r="${b===m?4:2.5}" fill="${b===m?"#5BC2F0":"#1E2D7D"}" opacity="${b===m?1:.7}"/>`).join("")}
    ${k}
  </svg>`}(a.gsc.trendData):"",z=s?[o.ga4_sessions?`
    <div style="flex:1;padding-left:20px;border-left:1px solid #E8EAEE">
      <div style="font-size:10px;color:#9ca3af;margin-bottom:3px">סשנים אורגניים</div>
      <div style="font-size:20px;font-weight:700;color:#111827">${f(a.ga4.sessions.current)}</div>
      ${0!==a.ga4.sessions.change?`<div style="font-size:11px;color:${a.ga4.sessions.improved?"#16a34a":"#dc2626"};margin-top:2px">${a.ga4.sessions.improved?"+":""}${g(a.ga4.sessions.changePct,1)}</div>`:""}
    </div>`:"",o.ga4_revenue?`
    <div style="flex:1">
      <div style="font-size:10px;color:#9ca3af;margin-bottom:3px">הכנסות כוללות</div>
      <div style="font-size:20px;font-weight:700;color:#111827">₪${f(a.ga4.revenue.current)}</div>
      ${0!==a.ga4.revenue.change?`<div style="font-size:11px;color:${a.ga4.revenue.improved?"#16a34a":"#dc2626"};margin-top:2px">${a.ga4.revenue.improved?"+":""}${g(a.ga4.revenue.changePct,1)}</div>`:""}
    </div>`:""].filter(Boolean):[],A=z.length?`<div style="display:flex;gap:0;margin-top:16px;padding-top:16px;border-top:1px solid #E8EAEE">${z.join("")}</div>`:"",B=a.keywords.map((a,b)=>`
    <tr style="${b%2==0?"":"background:#fafafa"}">
      <td style="padding:9px 14px;font-size:12.5px;color:#1f2937;font-weight:500;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e(a.keyword)}</td>
      <td style="padding:9px 14px;text-align:left">${j(a.position)}</td>
      <td style="padding:9px 14px;text-align:left;font-size:12px;color:#374151">${g(a.ctr,2)}</td>
      <td style="padding:9px 14px;text-align:left">${function(a){if(!a)return'<span style="color:#9ca3af">—</span>';let b=a>0;return`<span style="color:${b?"#16a34a":"#dc2626"};font-weight:600;font-size:11px">${b?"↑":"↓"} ${Math.abs(a).toFixed(1)}</span>`}(a.change)}</td>
    </tr>`).join(""),C=a.gsc.topPages.slice(0,12).map((a,b)=>{let c=(a.page??"").replace(/^https?:\/\/[^/]+/,"").replace(/\/$/,"")||"/";return`
    <tr style="${b%2==0?"":"background:#fafafa"}">
      <td style="padding:9px 14px;font-size:11.5px;color:#4b5563;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:monospace">${e(c)}</td>
      <td style="padding:9px 14px;text-align:left;font-size:12px;font-weight:600;color:#111827;font-variant-numeric:tabular-nums">${f(a.clicks)}</td>
      <td style="padding:9px 14px;text-align:left;font-size:12px;color:#374151;font-variant-numeric:tabular-nums">${f(a.impressions)}</td>
      <td style="padding:9px 14px;text-align:left;font-size:12px;color:#374151">${g(100*a.ctr,2)}</td>
      <td style="padding:9px 14px;text-align:left">${j(a.position)}</td>
    </tr>`}).join(""),D=a.ga4.topLandingPages.slice(0,10).map((a,b)=>{let c=(a.landingPage??"").replace(/^https?:\/\/[^/]+/,"").replace(/\/$/,"")||"/";return`
    <tr style="${b%2==0?"":"background:#fafafa"}">
      <td style="padding:9px 14px;font-size:11.5px;color:#4b5563;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:monospace">${e(c)}</td>
      <td style="padding:9px 14px;text-align:left;font-size:12px;font-weight:600;color:#111827">${f(a.sessions)}</td>
      <td style="padding:9px 14px;text-align:left;font-size:12px;color:#374151">${a.keyEvents>0?f(a.keyEvents):"—"}</td>
    </tr>`}).join("");return`<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Heebo', Arial, 'Segoe UI', sans-serif;
    color: #1f2937;
    background: white;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    direction: rtl;
  }
  @page { size: A4; margin: 0; }
  @media print {
    .section { page-break-inside: avoid; }
  }
  table { border-collapse: collapse; width: 100%; }
  th { background: #F8F9FB; font-size: 11px; font-weight: 600; color: #6b7280; padding: 9px 14px; text-align: right; border-bottom: 1.5px solid #E8EAEE; }
  th.num { text-align: left; }
</style>
</head>
<body>
<div style="width:794px;background:white;">

  <!-- ══ COVER ══ -->
  <div style="background:#1E2D7D;color:white;padding:44px 48px 40px;position:relative;min-height:210px">
    <!-- Logo or branding top-left -->
    <div style="position:absolute;top:36px;left:48px;">
      ${n?`<img src="${e(n)}" alt="${e(b)}" style="max-height:48px;max-width:140px;object-fit:contain;display:block;"/>`:'<div style="font-size:13px;font-weight:800;opacity:0.45;letter-spacing:0.02em">#RANKEY</div>'}
    </div>

    <!-- Tag line -->
    <div style="font-size:11px;font-weight:600;opacity:0.55;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:14px">
      דוח SEO חודשי • ${p}
    </div>

    <!-- Client name -->
    <div style="font-size:34px;font-weight:800;letter-spacing:-0.02em;margin-bottom:6px;line-height:1.1">${e(a.client.name)}</div>
    <div style="font-size:15px;opacity:0.7;margin-bottom:28px">${e(a.client.domain)}</div>

    <!-- Meta row -->
    <div style="display:flex;gap:36px">
      <div>
        <div style="font-size:10px;opacity:0.55;margin-bottom:3px;font-weight:500">תקופת הדוח</div>
        <div style="font-size:13px;font-weight:600">${p}</div>
      </div>
      <div>
        <div style="font-size:10px;opacity:0.55;margin-bottom:3px;font-weight:500">השוואה ל</div>
        <div style="font-size:13px;font-weight:600">${q}</div>
      </div>
      <div>
        <div style="font-size:10px;opacity:0.55;margin-bottom:3px;font-weight:500">הופק ב</div>
        <div style="font-size:13px;font-weight:600">${r}</div>
      </div>
      ${c?`<div>
        <div style="font-size:10px;opacity:0.55;margin-bottom:3px;font-weight:500">הכין עבורך</div>
        <div style="font-size:13px;font-weight:600">${e(c)}</div>
      </div>`:""}
    </div>
  </div>

  <div style="padding:36px 48px">

    <!-- ══ SECTION 01: PERFORMANCE SUMMARY ══ -->
    ${o.kpi_clicks||o.kpi_impressions||o.kpi_ctr||o.kpi_position||o.exec_summary?`
    <div style="margin-bottom:32px">
      ${k("תקציר ביצועים","01")}
      ${l("gsc")}
      ${u}
      ${x?`<div style="margin-top:14px;padding:14px 18px;background:#F8F9FB;border:1px solid #E8EAEE;border-radius:10px;font-size:13px;line-height:1.75;color:#374151">${x}</div>`:""}
    </div>`:""}

    <!-- ══ SECTION 02: ORGANIC TRAFFIC ══ -->
    ${o.trend_chart||o.ga4_sessions||o.ga4_revenue?`
    <div style="margin-bottom:32px;page-break-inside:avoid">
      ${k(`תנועה אורגנית – ${p}`,"02")}
      ${s?l("both"):l("gsc")}
      <div style="background:#F8F9FB;border:1.5px solid #E8EAEE;border-radius:12px;padding:20px 20px 16px">
        ${y}
        ${A}
      </div>
    </div>`:""}

    <!-- ══ SECTION 03: KEYWORDS ══ -->
    ${o.keywords_table?`
    <div style="margin-bottom:32px;page-break-inside:avoid">
      ${k("ביטויי מפתח ומיקומים ב-Google","03")}
      ${l("gsc")}
      <div style="font-size:11px;color:#9ca3af;margin-bottom:10px">
        ביטויים נבחרים שנבדקים ומעוקבים עבור הלקוח.
      </div>
      <div style="border:1.5px solid #E8EAEE;border-radius:12px;overflow:hidden">
        <table>
          <thead>
            <tr>
              <th>ביטוי</th>
              <th class="num">פוזיציה</th>
              <th class="num">CTR</th>
              <th class="num">שינוי</th>
            </tr>
          </thead>
          <tbody>${B||'<tr><td colspan="4" style="padding:20px;text-align:center;color:#9ca3af;font-size:12px">לא הוגדרו ביטויים מעוקבים ללקוח זה</td></tr>'}</tbody>
        </table>
      </div>
    </div>`:""}

    <!-- ══ SECTION 04: TOP PAGES ══ -->
    ${o.pages_table?`
    <div style="margin-bottom:32px;page-break-inside:avoid">
      ${k("דפים מובילים","04")}
      ${l("gsc")}
      <div style="border:1.5px solid #E8EAEE;border-radius:12px;overflow:hidden">
        <table>
          <thead>
            <tr>
              <th>דף</th>
              <th class="num">קליקים</th>
              <th class="num">חשיפות</th>
              <th class="num">CTR</th>
              <th class="num">פוזיציה</th>
            </tr>
          </thead>
          <tbody>${C}</tbody>
        </table>
      </div>
    </div>`:""}

    <!-- ══ SECTION 05: GA4 PAGES ══ -->
    ${o.ga4_pages&&s&&a.ga4.topLandingPages.length>0?`
    <div style="margin-bottom:32px;page-break-inside:avoid">
      ${k("דפי נחיתה אורגניים (Analytics)","05")}
      ${l("ga4")}
      <div style="border:1.5px solid #E8EAEE;border-radius:12px;overflow:hidden">
        <table>
          <thead>
            <tr>
              <th>דף</th>
              <th class="num">סשנים אורגניים</th>
              <th class="num">Key Events</th>
            </tr>
          </thead>
          <tbody>${D}</tbody>
        </table>
      </div>
    </div>`:""}

  </div>

  <!-- ══ FOOTER ══ -->
  <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 48px;background:#F8F9FB;border-top:1.5px solid #E8EAEE;font-size:11px;color:#9ca3af">
    <span>${a.period.startDate} – ${a.period.endDate}</span>
    <span style="font-weight:800;color:#1E2D7D;font-size:13px;letter-spacing:0.02em">#RANKEY</span>
    <span>${e(b)}${c?" \xb7 "+e(c):""}</span>
  </div>

</div>
</body>
</html>`}},65430:(a,b,c)=>{c.d(b,{I:()=>j,M:()=>i});var d=c(33873),e=c.n(d),f=c(57367),g=c.n(f),h=c(15604);async function i(a,b,d){let f,i=(0,h.GO)(b);await g().mkdir(i,{recursive:!0});let j=e().join(i,e().basename(d)),k=await Promise.resolve().then(c.bind(c,8856));if("linux"===process.platform){let a=(await Promise.resolve().then(c.bind(c,34442))).default;f=await k.default.launch({executablePath:await a.executablePath(),args:[...a.args,"--disable-dev-shm-usage"],headless:!0})}else f=await k.default.launch({channel:"chrome",headless:!0,args:["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage"]});try{let b=await f.newPage();await b.setContent(a,{waitUntil:"load"}),await b.pdf({path:j,format:"A4",printBackground:!0,margin:{top:"0",right:"0",bottom:"0",left:"0"}})}finally{await f.close()}return(0,h.hv)(b,d)}function j(a,b){let c=b.replace(/-/g,"_");return`report_${a}_${c}.pdf`}}};