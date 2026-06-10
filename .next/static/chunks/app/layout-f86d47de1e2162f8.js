(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[7177],{3321:(e,t,r)=>{"use strict";var a=r(4645);r.o(a,"usePathname")&&r.d(t,{usePathname:function(){return a.usePathname}}),r.o(a,"useRouter")&&r.d(t,{useRouter:function(){return a.useRouter}})},3976:(e,t,r)=>{"use strict";r.d(t,{NavProgress:()=>o});var a=r(5155),s=r(2115),n=r(3321);function o(){let[e,t]=(0,s.useState)(!1),[r,o]=(0,s.useState)(!1),i=(0,n.usePathname)(),l=(0,s.useRef)(i),d=(0,s.useRef)(null);if((0,s.useEffect)(()=>{function e(e){let r=e.target.closest("a[href]");if(!r)return;let a=r.getAttribute("href")??"";if(!a||a.startsWith("http")||a.startsWith("//")||a.startsWith("#")||a.startsWith("mailto:")||a.startsWith("tel:")||r.hasAttribute("download")||"_blank"===r.target)return;let s=window.location.pathname+window.location.search,n=a.startsWith("/")?a:`/${a}`;n!==s&&n!==window.location.pathname&&(d.current&&clearTimeout(d.current),o(!1),t(!0))}return document.addEventListener("click",e,!0),()=>document.removeEventListener("click",e,!0)},[]),(0,s.useEffect)(()=>{i!==l.current&&(l.current=i,o(!0),d.current=setTimeout(()=>{t(!1),o(!1)},280))},[i]),(0,s.useEffect)(()=>()=>{d.current&&clearTimeout(d.current)},[]),!e)return null;let p=!r;return(0,a.jsxs)(a.Fragment,{children:[(0,a.jsx)("style",{children:`
        @keyframes np-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes np-spin-reverse {
          to { transform: rotate(-360deg); }
        }
        @keyframes np-overlay-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes np-overlay-out {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
        @keyframes np-card-in {
          from { opacity: 0; transform: scale(0.92) translateY(6px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
        @keyframes np-card-out {
          from { opacity: 1; transform: scale(1); }
          to   { opacity: 0; transform: scale(0.94); }
        }
        @keyframes np-pulse {
          0%, 100% { opacity: 0.5; transform: scale(0.96); }
          50%       { opacity: 1;   transform: scale(1.04); }
        }
      `}),(0,a.jsx)("div",{"aria-hidden":!0,style:{position:"fixed",inset:0,background:"rgba(10, 21, 69, 0.35)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",zIndex:9998,animation:p?"np-overlay-in 0.18s ease forwards":"np-overlay-out 0.28s ease forwards"}}),(0,a.jsxs)("div",{"aria-label":"טוען",role:"status",style:{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%, -50%)",zIndex:9999,background:"#FFFFFF",borderRadius:"20px",padding:"32px 40px",display:"flex",flexDirection:"column",alignItems:"center",gap:"16px",boxShadow:"0 24px 64px rgba(10, 21, 69, 0.22), 0 4px 20px rgba(0,0,0,0.06)",animation:p?"np-card-in 0.2s cubic-bezier(0.34,1.56,0.64,1) forwards":"np-card-out 0.25s ease forwards"},children:[(0,a.jsx)("div",{style:{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:"48px",height:"3px",borderRadius:"0 0 3px 3px",background:"linear-gradient(90deg, #5BC2F0, #1E2D7D)"}}),(0,a.jsxs)("div",{style:{position:"relative",width:52,height:52},children:[(0,a.jsx)("div",{style:{position:"absolute",inset:0,borderRadius:"50%",border:"3px solid #E8F6FD",borderTopColor:"#5BC2F0",animation:"np-spin 0.8s linear infinite"}}),(0,a.jsx)("div",{style:{position:"absolute",inset:10,borderRadius:"50%",border:"2px solid #EEF0F9",borderBottomColor:"#1E2D7D",animation:"np-spin-reverse 1.2s linear infinite"}}),(0,a.jsx)("div",{style:{position:"absolute",top:"50%",left:"50%",width:7,height:7,marginTop:-3.5,marginLeft:-3.5,borderRadius:"50%",background:"#5BC2F0",animation:"np-pulse 1.2s ease-in-out infinite"}})]}),(0,a.jsx)("span",{style:{fontSize:"13px",fontWeight:500,color:"#6B7280",fontFamily:"var(--font-heebo, sans-serif)",letterSpacing:"0.01em"},children:"טוען..."})]})]})}},6872:()=>{},9362:e=>{e.exports={style:{fontFamily:"'Heebo', 'Heebo Fallback'",fontStyle:"normal"},className:"__className_152d43",variable:"__variable_152d43"}},9562:(e,t,r)=>{Promise.resolve().then(r.bind(r,3976)),Promise.resolve().then(r.t.bind(r,9362,23)),Promise.resolve().then(r.t.bind(r,6872,23))}},e=>{e.O(0,[8530,8441,3794,7358],()=>e(e.s=9562)),_N_E=e.O()}]);