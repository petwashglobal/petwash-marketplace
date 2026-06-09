import{l as pe,r as o,j as e,Y as W,Z as V,_ as $,$ as Y,a0 as q,a1 as J,a2 as de,a3 as L,a4 as O,a5 as ce,a6 as ge,a7 as he,a8 as xe,a9 as me}from"./vendor-react-BZU4O_hH.js";import{e as ue,b as fe,d as be,n as we,m as ve,s as ye}from"./vendor-firebase-6O9bE4If.js";import{l as u,a as I}from"./firebase-D94XF2F-.js";import{c as je,a as ke,b as Ne,g as Ie}from"./iosAuthHandler-D-SC3cNV.js";import{getApiUrl as g}from"./apiConfig-DlfJFfO5.js";import{P as Pe}from"./PhoneInput-B9cUSkDz.js";import{O as Se,e as Ee}from"./TurnstileWidget-Bs2hv4DR.js";import{u as Te,p as Ae}from"./App-CrRLiWTb.js";import"./vendor-i18n-BnqEsHlA.js";import"./card-DIa05OC5.js";import"./vendor-ui-DjOQ4pac.js";import"./index-DEV0qW16.js";import"./vendor-query-D1vAQCVh.js";const ze={BASE_URL:"/",DEV:!1,MODE:"production",PROD:!0,SSR:!1},K=ze??{},E=l=>K[l]!=="false",P=l=>K[l]==="true",h={unifiedRoute:E("VITE_AUTH_SIGNUP_UNIFIED_ROUTE_ENABLED"),googleSignin:E("VITE_AUTH_SIGNUP_GOOGLE_SIGNIN_ENABLED"),appleSignin:P("VITE_AUTH_SIGNUP_APPLE_SIGNIN_ENABLED"),emailPassword:E("VITE_AUTH_SIGNUP_EMAIL_PASSWORD_ENABLED"),twoFactor:P("VITE_AUTH_SIGNUP_2FA_ENABLED"),passkey:P("VITE_AUTH_SIGNUP_PASSKEY_ENABLED"),keychainPrompt:P("VITE_AUTH_SIGNUP_KEYCHAIN_PROMPT_ENABLED"),legacyPanelHidden:P("VITE_AUTH_SIGNUP_LEGACY_PANEL_HIDDEN_ENABLED"),smsFallbackAndRealErrors:E("VITE_FEATURE_SMS_FALLBACK_AND_REAL_ERRORS")};function Ce(l){return l==="provider"||l==="guest"||l==="booking"||l==="prestige"?l:"general"}function _e(l){switch(l){case"provider":return"/provider-onboarding";case"guest":return"/egift";case"booking":return"/booking";case"prestige":return"/dashboard";default:return"/dashboard"}}function Qe({language:l="en",onLanguageChange:S}){const[,f]=pe(),{toast:T}=Te(),a=l==="he";o.useEffect(()=>{const t=document.getElementById("root");return document.documentElement.setAttribute("data-pw-page","signup"),document.body.setAttribute("data-pw-page","signup"),t==null||t.setAttribute("data-pw-page","signup"),()=>{document.documentElement.removeAttribute("data-pw-page"),document.body.removeAttribute("data-pw-page"),t==null||t.removeAttribute("data-pw-page")}},[]);const R=o.useMemo(()=>new URLSearchParams(typeof window<"u"?window.location.search:""),[]),A=Ce(R.get("flow")||R.get("intent")),z=_e(A),{user:G}=Ae();o.useEffect(()=>{G&&f(z)},[G,z,f]);const[p,j]=o.useState("mobile"),[m,Q]=o.useState(""),[k,X]=o.useState(""),[b,Z]=o.useState(""),[H,ee]=o.useState(""),[N,ae]=o.useState(!1),[w,C]=o.useState(!1),[x,d]=o.useState(!1),[U,v]=o.useState(null),[te,B]=o.useState(!0),n=t=>v(t);o.useEffect(()=>{if(!h.smsFallbackAndRealErrors||!h.emailPassword)return;let t=!1;return fetch(g("/api/auth/sms/status"),{credentials:"include"}).then(r=>r.json()).then(r=>{t||(r==null?void 0:r.smsProviderHealthy)!==!1||(B(!1),j(i=>i==="mobile"?"email":i))}).catch(r=>{u.warn("[signup] sms status unavailable",{error:r==null?void 0:r.message})}),()=>{t=!0}},[]);const M=()=>N?!0:(n(a?"יש לאשר את התנאים ומדיניות הפרטיות":"Please accept the Terms and Privacy Policy to continue."),!1);async function _(){try{await fetch(g("/api/session/whoami"),{credentials:"include"})}catch(t){u.error("[signup] whoami",t)}f(z)}async function se(){if(!m){n(a?"הזן מספר טלפון":"Enter your mobile number");return}if(M()){v(null),d(!0);try{const t=await Ee("signup_sms_start").catch(()=>null),i=await(await fetch(g("/api/auth/sms/start"),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({phone:m,language:l,flow:A,turnstileToken:t})})).json();if(!i.ok){h.smsFallbackAndRealErrors&&(B(!1),h.emailPassword&&j("email")),n(i.message||(a?"SMS אינו זמין כעת — המשך עם אימייל.":"SMS is temporarily unavailable — continue with email."));return}C(!0),T({title:a?"קוד נשלח 📲":"Code sent 📲"})}catch(t){u.error("[signup] sendCode",t),n(a?"שגיאת רשת":"Network error")}finally{d(!1)}}}async function ie(t){v(null),d(!0);try{const i=await(await fetch(g("/api/auth/sms/verify"),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({phone:m,code:t,language:l,flow:A})})).json();if(!i.ok){n(i.message||(a?"קוד שגוי":"Invalid code"));return}const c=await(await fetch(g("/api/auth/phone-session"),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({verificationToken:i.verificationToken})})).json();if(c.customToken){const oe=await(await ue(I,c.customToken)).user.getIdToken(!0);await fetch(g("/api/auth/session"),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({idToken:oe})})}await _()}catch(r){u.error("[signup] verify",r),n(a?"האימות נכשל":"Verification failed")}finally{d(!1)}}async function F(t){if(!N){n(a?"יש לאשר את התנאים ומדיניות הפרטיות":"Please accept the Terms and Privacy Policy to continue.");return}v(null),d(!0);try{const r=t==="google"?je():t==="apple"?ke():Ne();if(Ie()==="redirect"){await fe(I,r);return}const y=await(await be(I,r)).user.getIdToken(!0);await fetch(g("/api/auth/session"),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({idToken:y})}),await _()}catch(r){if((r==null?void 0:r.code)==="auth/popup-closed-by-user")return;u.error("[signup] social",r);const i=t==="google"?"Google":t==="apple"?"Apple":"Facebook";n(a?`התחברות ${i} לא הושלמה — נסה נייד או אימייל`:`${i} sign-in did not complete. Please try mobile or email.`)}finally{d(!1)}}async function re(t){if(!N){n(a?"יש לאשר את התנאים ומדיניות הפרטיות":"Please accept the Terms and Privacy Policy to continue.");return}v(null),d(!0);try{const i=await(await fetch(g(`/api/auth/social/${t}/authorize`),{credentials:"include"})).json().catch(()=>({}));if(i!=null&&i.authUrl){window.location.href=i.authUrl;return}const y=t==="instagram"?"Instagram":"TikTok";n(a?`${y} עדיין לא פעיל — נסה Google, נייד או אימייל`:`${y} sign-in is not active yet — please try Google, mobile or email.`)}catch(r){u.error("[signup] socialExternal",r),n(a?"שגיאת רשת":"Network error")}finally{d(!1)}}async function le(){if(!k||!b){n(a?"הזן אימייל וסיסמה":"Enter your email and password");return}if(M()){v(null),d(!0);try{let t;try{t=await we(I,k,b)}catch(i){if((i==null?void 0:i.code)==="auth/user-not-found"||(i==null?void 0:i.code)==="auth/invalid-credential"){if(b!==H){n(a?"אשר את הסיסמה כדי ליצור חשבון חדש":"Confirm your password to create a new account.");return}try{t=await ve(I,k,b);try{await ye(t.user)}catch{}}catch(c){if((c==null?void 0:c.code)==="auth/email-already-in-use"){n(a?"החשבון קיים — בדוק את הסיסמה":"Account exists — please check your password.");return}if((c==null?void 0:c.code)==="auth/weak-password"){n(a?"סיסמה חלשה מדי (6 תווים לפחות)":"Password too weak (min 6 characters).");return}throw c}}else if((i==null?void 0:i.code)==="auth/wrong-password"){n(a?"סיסמה שגויה":"Wrong password.");return}else if((i==null?void 0:i.code)==="auth/invalid-email"){n(a?"כתובת אימייל לא תקינה":"Invalid email address.");return}else throw i}const r=await t.user.getIdToken(!0);await fetch(g("/api/auth/session"),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({idToken:r})}),await _()}catch(t){u.error("[signup] email",t),n(a?"ההתחברות נכשלה":"Sign-in failed")}finally{d(!1)}}}const D=N&&!x&&(p==="mobile"?m.length>4:k.length>3&&b.length>0),ne=x?"…":p==="mobile"?a?"שלח קוד אימות":"Send Verification Code":a?"צור חשבון מאובטח":"Create Secure Account",s={eyebrow:a?"אקוסיסטם חכם לטיפול בחיות מחמד":"INTELLIGENT PET-CARE ECOSYSTEM",h1a:a?"העתיד של":"The Future of",h1b:a?"חיי חיות המחמד":"Pet Lifestyle",sub1:a?"שמונה פלטפורמות מהפכניות.":"Eight Revolutionary Platforms.",sub2:a?"אקוסיסטם חכם אחד לטיפול בחיות מחמד.":"One Intelligent Pet-Care Ecosystem.",premium:a?"חוויית פרמיום":"PREMIUM EXPERIENCE",premiumSub:a?"חכם. מאובטח. חלק.":"Intelligent. Secure. Seamless.",badges:a?[{t:"טיפול חכם בכוח AI",I:V},{t:"תגמולי VIP",I:$},{t:"הזמנה חכמה",I:Y},{t:"מעקב בריאות",I:q}]:[{t:"AI Powered Pet Care",I:V},{t:"VIP Rewards",I:$},{t:"Smart Booking",I:Y},{t:"Health Tracking",I:q}],trusted:a?"נפתחים בקרוב בכפר סבא":"Opening soon in Kfar Saba",rating:a?"טיפול טבעי פרימיום · מותג ישראלי":"Premium natural care · Israeli brand",secure:a?"מאובטח · פרטי · מוצפן":"SECURE · PRIVATE · ENCRYPTED",secureSub:a?"הנתונים שלך מוגנים ומוצפנים.":"Your data is protected and encrypted.",create:a?"צור את החשבון שלך":"Create Your Account",helper:a?"הצטרף לעתיד של טיפול חכם בחיות מחמד":"Join the future of intelligent pet care",cwGoogle:a?"המשך עם Google":"Continue with Google",cwApple:a?"המשך עם Apple":"Continue with Apple",cwFb:a?"המשך עם Facebook":"Continue with Facebook",cwIg:a?"המשך עם Instagram":"Continue with Instagram",or:a?"או הירשם עם":"or sign up with",tabMobile:a?"נייד":"Mobile",tabEmail:a?"אימייל":"Email",tabOther:a?"אימייל אחר":"Other Email",phoneLabel:a?"מספר נייד":"Mobile Number",emailPh:"name@email.com",emailLabel:a?"אימייל":"Email",pwd:a?"סיסמה":"Password",pwd2:a?"אישור סיסמה (לחשבון חדש)":"Confirm password (new account)",iAgree:a?"אני מסכים/ה ל":"I agree to the ",termsLink:a?"תנאי השימוש":"Terms of Service",andTo:a?" ול":" and ",privLink:a?"מדיניות הפרטיות":"Privacy Policy",completeFields:a?"אשר תנאים והזן פרטים כדי להמשיך.":"Accept the terms and enter your details to continue.",bank:a?"אבטחה ברמת בנק":"Bank-level security",enc:a?"הצפנת 256-bit":"256-bit encryption",safe:a?"הנתונים שלך בטוחים":"Your data is safe",dlTitle:a?"הורד את האפליקציה שלנו":"Download Our App",dlSub:a?"גש לכל הפיצ׳רים בנייד":"Access all features on the go",storeApple:"App Store",storeAppleLine:a?"הורד מ-":"Download on the",storeGoogle:"Google Play",storeGoogleLine:"GET IT ON",comingSoon:a?"בקרוב":"Coming soon"};return e.jsxs("div",{id:"petwash-signup-page",className:"sl-shell",dir:a?"rtl":"ltr",children:[e.jsx("style",{children:Oe(a)}),e.jsxs("div",{className:"sl-frame",children:[e.jsxs("aside",{className:"sl-hero",children:[e.jsxs("header",{className:"sl-heroHead",children:[e.jsx("img",{src:"/brand/petwash-logo-white-tight.png",alt:"PetWash",className:"sl-logo",width:365,height:123,decoding:"async"}),e.jsx("div",{className:"sl-eyebrow",children:s.eyebrow})]}),e.jsxs("h1",{className:"sl-h1",children:[s.h1a,e.jsx("br",{}),e.jsx("span",{className:"sl-gold",children:s.h1b})]}),e.jsxs("p",{className:"sl-sub",children:[s.sub1,e.jsx("br",{}),s.sub2]}),e.jsxs("div",{className:"sl-divPaw","aria-hidden":!0,children:[e.jsx("span",{}),e.jsx(W,{}),e.jsx("span",{})]}),e.jsx("div",{className:"sl-dogWrap",children:e.jsx("img",{src:"/brand/hero-dog-lux.jpg",alt:"",className:"sl-dog",loading:"eager",decoding:"async","aria-hidden":!0})}),e.jsxs("section",{className:"sl-card",children:[e.jsxs("div",{className:"sl-cardHead",children:[e.jsx("div",{className:"sl-cardTitle",children:s.premium}),e.jsx("div",{className:"sl-cardSub",children:s.premiumSub})]}),e.jsx("div",{className:"sl-badges",children:s.badges.map(({t,I:r})=>e.jsxs("div",{className:"sl-badge",children:[e.jsx(r,{className:"sl-badgeIcon","aria-hidden":!0}),e.jsx("span",{children:t})]},t))})]}),e.jsxs("section",{className:"sl-card sl-trustCard",children:[e.jsx("div",{className:"sl-cardTitle",children:s.trusted}),e.jsx("div",{className:"sl-ratingTxt",children:s.rating})]}),e.jsxs("div",{className:"sl-secBadge",children:[e.jsx(J,{"aria-hidden":!0}),e.jsxs("div",{children:[e.jsx("div",{className:"sl-secBadgeTitle",children:s.secure}),e.jsx("div",{className:"sl-secBadgeSub",children:s.secureSub})]})]})]}),e.jsxs("main",{className:"sl-panel",role:"main",children:[e.jsxs("header",{className:"sl-panelHead",children:[e.jsxs("div",{children:[e.jsx("h2",{className:"sl-title",children:s.create}),e.jsx("p",{className:"sl-helper",children:s.helper})]}),S&&e.jsxs("button",{type:"button",className:"sl-lang",onClick:()=>S(a?"en":"he"),"aria-label":"Switch language",children:["🌐 ",a?"עברית":"English"," ▾"]})]}),!w&&e.jsxs("label",{className:"sl-terms sl-terms--quick",children:[e.jsx("input",{type:"checkbox",checked:N,onChange:t=>ae(t.target.checked)}),e.jsxs("span",{children:[s.iAgree,e.jsx("a",{href:"/terms",target:"_blank",rel:"noreferrer",children:s.termsLink}),s.andTo,e.jsx("a",{href:"/privacy-policy",target:"_blank",rel:"noreferrer",children:s.privLink})]})]}),U&&e.jsx("p",{className:"sl-inlineError",role:"alert",children:U}),!w&&e.jsxs("div",{className:"sl-tabs",role:"tablist",children:[e.jsxs("button",{type:"button",className:"sl-tab",role:"tab","aria-selected":p==="mobile",onClick:()=>{j("mobile"),C(!1)},children:[e.jsx(de,{"aria-hidden":!0})," ",s.tabMobile]}),h.emailPassword&&e.jsxs("button",{type:"button",className:"sl-tab",role:"tab","aria-selected":p==="email",onClick:()=>j("email"),children:[e.jsx(L,{"aria-hidden":!0})," ",s.tabEmail]}),h.emailPassword&&e.jsxs("button",{type:"button",className:"sl-tab",role:"tab","aria-selected":p==="other",onClick:()=>j("other"),children:[e.jsx(L,{"aria-hidden":!0})," ",s.tabOther]})]}),p==="mobile"&&!w&&e.jsxs(e.Fragment,{children:[h.smsFallbackAndRealErrors&&!te&&e.jsx("p",{className:"sl-inlineError",role:"status",children:a?"SMS אינו זמין כעת — אפשר להמשיך עם אימייל.":"SMS is temporarily unavailable — continue with email."}),e.jsxs("div",{className:"sl-field",children:[e.jsx("label",{className:"sl-label",children:s.phoneLabel}),e.jsx(Pe,{value:m,onChange:Q,language:l,defaultCountry:"IL"})]})]}),(p==="email"||p==="other")&&!w&&e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"sl-field",children:[e.jsx("label",{className:"sl-label",children:s.emailLabel}),e.jsxs("div",{className:"sl-inputWrap",children:[e.jsx(L,{className:"sl-inputIcon","aria-hidden":!0}),e.jsx("input",{className:"sl-input sl-input--icon",type:"email",inputMode:"email",autoComplete:"username email",autoCapitalize:"off",autoCorrect:"off",spellCheck:!1,value:k,onChange:t=>X(t.target.value),placeholder:p==="other"?a?"Outlook, Yahoo, ProtonMail, אחר…":"Outlook, Yahoo, ProtonMail, other…":s.emailPh})]})]}),e.jsxs("div",{className:"sl-field",children:[e.jsx("label",{className:"sl-label",children:s.pwd}),e.jsxs("div",{className:"sl-inputWrap",children:[e.jsx(O,{className:"sl-inputIcon","aria-hidden":!0}),e.jsx("input",{className:"sl-input sl-input--icon",type:"password",autoComplete:"current-password",value:b,onChange:t=>Z(t.target.value),placeholder:"••••••••"})]})]}),e.jsxs("div",{className:"sl-field",children:[e.jsx("label",{className:"sl-label",children:s.pwd2}),e.jsxs("div",{className:"sl-inputWrap",children:[e.jsx(O,{className:"sl-inputIcon","aria-hidden":!0}),e.jsx("input",{className:"sl-input sl-input--icon",type:"password",autoComplete:"new-password",value:H,onChange:t=>ee(t.target.value),placeholder:"••••••••"})]})]})]}),p==="mobile"&&w&&e.jsxs(e.Fragment,{children:[e.jsx("p",{className:"sl-helper sl-center",children:a?`הזן את הקוד שנשלח ל-${m}`:`Enter the code sent to ${m}`}),e.jsx(Se,{length:6,onComplete:t=>{ie(t)},loading:x,language:a?"he":"en"}),e.jsx("button",{className:"sl-btn",disabled:x,onClick:()=>C(!1),children:a?"שלח קוד חדש":"Resend code"})]}),!w&&e.jsxs(e.Fragment,{children:[e.jsxs("button",{className:"sl-cta",disabled:!D,onClick:()=>p==="email"||p==="other"?void le():void se(),children:[e.jsx(O,{"aria-hidden":!0})," ",ne]}),!D&&e.jsx("div",{className:"sl-hint sl-submitHint",children:s.completeFields}),e.jsxs("div",{className:"sl-bank",children:[e.jsx(J,{"aria-hidden":!0})," ",e.jsx("span",{children:s.bank}),e.jsx("span",{"aria-hidden":!0,children:" · "}),e.jsx("span",{children:s.enc}),e.jsx("span",{"aria-hidden":!0,children:" · "}),e.jsx("span",{children:s.safe})]}),e.jsx("div",{className:"sl-div",children:s.or}),e.jsxs("div",{className:"sl-social4",children:[h.googleSignin&&e.jsxs("button",{className:"sl-soc",disabled:x,onClick:()=>F("google"),children:[e.jsx(Fe,{})," ",e.jsx("span",{className:"sl-socLabel",children:s.cwGoogle})]}),h.appleSignin&&e.jsxs("button",{className:"sl-soc sl-soc--apple",disabled:x,onClick:()=>F("apple"),children:[e.jsx(ce,{"aria-hidden":!0})," ",e.jsx("span",{className:"sl-socLabel",children:s.cwApple})]}),e.jsxs("button",{className:"sl-soc sl-soc--fb",disabled:x,onClick:()=>F("facebook"),children:[e.jsx("span",{className:"sl-fbIcon","aria-hidden":!0,children:e.jsx(ge,{})}),e.jsx("span",{className:"sl-socLabel",children:s.cwFb})]}),e.jsxs("button",{className:"sl-soc sl-soc--ig",disabled:x,onClick:()=>re("instagram"),children:[e.jsx("span",{className:"sl-igIcon","aria-hidden":!0,children:e.jsx(he,{})}),e.jsx("span",{className:"sl-socLabel",children:s.cwIg})]})]})]})]})]}),e.jsxs("section",{className:"sl-dl",children:[e.jsxs("div",{className:"sl-dlLeft",children:[e.jsx("span",{className:"sl-dlPaw","aria-hidden":!0,children:e.jsx(W,{})}),e.jsxs("div",{children:[e.jsx("div",{className:"sl-dlTitle",children:s.dlTitle}),e.jsx("div",{className:"sl-dlSub",children:s.dlSub})]})]}),e.jsxs("div",{className:"sl-dlRight",children:[e.jsxs("span",{className:"sl-store","aria-disabled":"true",style:{cursor:"not-allowed",opacity:.6},title:s.comingSoon??"בקרוב",children:[e.jsx(xe,{"aria-hidden":!0}),e.jsxs("span",{children:[e.jsx("small",{children:s.storeAppleLine}),e.jsx("strong",{children:s.storeApple})]})]}),e.jsxs("span",{className:"sl-store","aria-disabled":"true",style:{cursor:"not-allowed",opacity:.6},title:s.comingSoon??"בקרוב",children:[e.jsx(me,{"aria-hidden":!0}),e.jsxs("span",{children:[e.jsx("small",{children:s.storeGoogleLine}),e.jsx("strong",{children:s.storeGoogle})]})]}),e.jsx("div",{className:"sl-qr","aria-hidden":!0,children:e.jsx(Le,{})})]})]})]})}function Fe(){return e.jsxs("svg",{className:"sl-gIcon",viewBox:"0 0 48 48","aria-hidden":!0,children:[e.jsx("path",{fill:"#EA4335",d:"M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"}),e.jsx("path",{fill:"#4285F4",d:"M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"}),e.jsx("path",{fill:"#FBBC05",d:"M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"}),e.jsx("path",{fill:"#34A853",d:"M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"})]})}function Le(){const l=["1111111011111110","1000001011001010","1011101010111010","1011101011010110","1011101011001010","1000001010100110","1111111010101010","0000000010111100","1100110110010010","1011011000111110","0010011011000110","0001110110111010","1111111011010010","1000001011111010","1011101010001100","1011101011100110"];return e.jsxs("svg",{className:"sl-qrSvg",viewBox:"0 0 16 16",role:"img","aria-label":"QR code",children:[e.jsx("rect",{width:"16",height:"16",fill:"#fffaf0"}),l.map((S,f)=>S.split("").map((T,a)=>T==="1"?e.jsx("rect",{x:a,y:f,width:"1",height:"1",fill:"#0a0a0a"},`${a}-${f}`):null))]})}function Oe(l){return`
    /* ── Page-scoped overrides ────────────────────────────────────────────
     * The global html/body bg in client/index.html:101-104 is white.
     * That shows through as "white empty space" on iOS Safari overscroll
     * and on short content. The signup page is a dark luxury surface, so
     * we override body bg to black while this component is mounted and
     * disable overscroll bounce so the dark canvas never breaks.
     * The style tag unmounts with the page, restoring the global rule.
     */
    html, body, #root {
      background:#000 !important;
      background-color:#000 !important;
      overscroll-behavior:none;
      margin:0 !important;
    }
    body[data-pw-page="signup"] {
      padding-top:0 !important;
      padding-bottom:0 !important;
      min-height:100dvh;
      overflow-x:hidden;
    }

    body > #root > #petwash-signup-page.sl-shell,
    #petwash-signup-page.sl-shell {
      background:#000 !important;
      background-color:#000 !important;
    }

    .sl-shell{
      --gold:#b0841c; --gold2:#d9bd72; --gold3:#8f6a16; --white:#fffaf0;
      --muted:rgba(255,250,240,.6); --line:rgba(255,255,255,.10);
      --line2:rgba(176,132,28,.22); --ink:#0a0a0a;
      position:relative; min-height:100dvh; background:#000 !important;
      background-color:#000 !important;
      color:var(--white);
      font-family:Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
      /* iOS notch + bottom home indicator. Top inset is added once at the
       * shell so it applies before any internal scroll. */
      padding-top:0;
      padding-left:env(safe-area-inset-left);
      padding-right:env(safe-area-inset-right);
    }
    @supports not (height:100dvh){ .sl-shell{ min-height:100vh } }

    /* Frame caps the layout at 1440px and centers it on big screens. */
    .sl-frame{
      max-width:1440px; margin:0 auto;
      display:flex; flex-direction:column;
      padding:clamp(20px,4vw,40px) clamp(16px,3vw,40px) 0;
      gap:clamp(20px,3vw,32px);
    }

    /* HERO LEFT — logo dominant, headline subordinate, dog supports */
    .sl-hero{ display:flex; flex-direction:column; gap:18px; align-items:center; text-align:center }
    .sl-heroHead{ display:flex; flex-direction:column; gap:12px; align-items:center; text-align:center; width:100% }
    /* Logo is width-driven so it stays the dominant first-read brand mark. */
    .sl-logo{ width:clamp(320px,38vw,520px); max-width:100%; height:auto; display:block; object-fit:contain }
    .sl-eyebrow{ color:var(--muted); font-size:11px; letter-spacing:.32em; font-weight:800; text-transform:uppercase }
    /* Headline is intentionally smaller than the logo above. */
    .sl-h1{ font-family:"Playfair Display", Georgia, serif; font-size:clamp(28px,3.1vw,44px); line-height:1.06; letter-spacing:-.01em; margin:0; font-weight:600; text-align:center }
    .sl-gold{ background:linear-gradient(180deg, #ead8a5 0%, var(--gold2) 18%, var(--gold) 62%, var(--gold3) 100%); -webkit-background-clip:text; background-clip:text; color:transparent; display:inline-block; padding-bottom:.08em }
    .sl-sub{ margin:0 auto; color:var(--muted); font-size:clamp(14px,1.4vw,17px); line-height:1.5; max-width:520px; text-align:center }

    .sl-divPaw{ display:flex; align-items:center; gap:10px; color:var(--gold); margin:2px 0 }
    .sl-divPaw span{ height:1px; background:linear-gradient(90deg, transparent, rgba(176,132,28,.45), transparent); flex:1 }
    .sl-divPaw svg{ width:14px; height:14px }

    /* Dog can be large and emotional, but it supports the brand identity. */
    .sl-dogWrap{ display:flex; justify-content:center; padding:4px 0 }
    .sl-dog{ width:min(58%, 340px); height:auto; aspect-ratio:1/1.05; object-fit:cover; border-radius:18px; box-shadow:0 24px 60px rgba(0,0,0,.55); border:1px solid rgba(255,255,255,.06) }

    .sl-card{
      border:1px solid var(--line);
      background:linear-gradient(160deg, rgba(255,255,255,.04), rgba(0,0,0,.55));
      border-radius:18px; padding:18px;
      display:flex; flex-direction:column; gap:14px;
    }
    .sl-cardHead{ text-align:center; display:flex; flex-direction:column; gap:4px }
    .sl-cardTitle{ color:var(--gold2); font-size:11.5px; letter-spacing:.32em; text-transform:uppercase; font-weight:900 }
    .sl-cardSub{ color:var(--white); font-size:14px; opacity:.95 }

    .sl-badges{ display:grid; grid-template-columns:repeat(4, 1fr); gap:8px }
    .sl-badge{
      display:flex; flex-direction:column; align-items:center; gap:8px;
      padding:14px 8px; border-radius:14px;
      background:rgba(0,0,0,.45); border:1px solid var(--line);
      font-weight:700; font-size:11.5px; text-align:center; color:var(--white); line-height:1.25;
      min-height:88px; justify-content:center;
    }
    .sl-badgeIcon{ font-size:24px; color:var(--gold2) }

    .sl-trustCard{ align-items:center; text-align:center }
    .sl-avatars{ display:flex; align-items:center; ${l?"gap:6px":"gap:0"}; justify-content:center; flex-wrap:wrap }
    .sl-avatar{
      width:34px; height:34px; border-radius:50%;
      display:inline-flex; align-items:center; justify-content:center;
      color:#fff; font-weight:900; font-size:11px;
      border:2px solid #0a0a0a; box-shadow:0 4px 12px rgba(0,0,0,.5);
      margin-${l?"right":"left"}:-8px;
    }
    .sl-avatar:first-child{ margin-${l?"right":"left"}:0 }
    .sl-avatarMore{
      margin-${l?"right":"left"}:10px; padding:5px 10px; border-radius:999px;
      background:linear-gradient(135deg, var(--gold2), var(--gold));
      color:#0a0a0a; font-weight:900; font-size:11px;
    }
    .sl-stars{ color:var(--gold2); font-size:18px; letter-spacing:4px; text-shadow:0 0 12px rgba(176,132,28,.5) }
    .sl-ratingTxt{ color:var(--white); font-weight:800; font-size:14px }

    .sl-secBadge{
      display:flex; align-items:center; gap:12px;
      padding:14px 16px; border-radius:14px;
      background:rgba(0,0,0,.55); border:1px solid var(--line);
    }
    .sl-secBadge > svg{ color:var(--gold2); font-size:22px; flex:0 0 auto }
    .sl-secBadgeTitle{ font-size:11.5px; letter-spacing:.24em; font-weight:900; color:var(--white); text-transform:uppercase }
    .sl-secBadgeSub{ color:var(--muted); font-size:12.5px; margin-top:2px }

    /* PANEL RIGHT */
    .sl-panel{
      display:flex; flex-direction:column; gap:14px;
      border:1px solid var(--line);
      background:linear-gradient(180deg, rgba(20,20,20,.95), rgba(8,8,8,.95)) !important;
      background-color:#090909 !important;
      border-radius:24px; padding:clamp(20px,3vw,32px);
    }
    .sl-panelHead{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap }
    .sl-title{ font-family:"Playfair Display", Georgia, serif; font-size:clamp(28px,3.6vw,42px); margin:0; line-height:1.05; font-weight:600 }
    .sl-helper{ margin:4px 0 0; color:var(--muted); font-size:15px; line-height:1.5 }
    .sl-helper.sl-center{ text-align:center }
    .sl-lang{
      appearance:none; cursor:pointer;
      border:1px solid var(--line); background:rgba(0,0,0,.5);
      color:var(--white); font-weight:700; font-size:13px;
      border-radius:999px; padding:10px 16px; min-height:44px;
    }
    .sl-lang:hover{ border-color:rgba(176,132,28,.5) }

    /* Social tiles 2x2 */
    .sl-social4{ display:grid; grid-template-columns:1fr 1fr; gap:10px }
    .sl-soc{
      appearance:none; cursor:pointer; position:relative;
      min-height:60px; border-radius:14px;
      border:1px solid var(--line); background:rgba(0,0,0,.55);
      color:var(--white); display:flex; align-items:center; gap:12px; padding:0 16px;
      font-weight:700; font-size:14px; line-height:1.2;
      transition:transform .15s ease, border-color .15s ease, box-shadow .15s ease;
      -webkit-tap-highlight-color:transparent;
    }
    .sl-soc:hover:not(:disabled){ transform:translateY(-1px); border-color:rgba(176,132,28,.45); box-shadow:0 0 0 3px rgba(176,132,28,.10) }
    .sl-soc:disabled{ cursor:not-allowed }
    .sl-socLabel{ flex:1; min-width:0; text-align:start; overflow-wrap:normal }
    .sl-gIcon{ width:24px; height:24px; flex:0 0 auto }
    .sl-fbIcon{ width:24px; height:24px; flex:0 0 auto; border-radius:6px; background:#1877F2; display:inline-flex; align-items:center; justify-content:center; color:#fff }
    .sl-fbIcon svg{ font-size:14px }
    .sl-igIcon{ width:24px; height:24px; flex:0 0 auto; border-radius:6px; background:linear-gradient(135deg, #fdc468 0%, #d83689 50%, #5b4ad0 100%); display:inline-flex; align-items:center; justify-content:center; color:#fff }
    .sl-igIcon svg{ font-size:14px }
    .sl-soc--apple svg{ font-size:22px }
    .sl-div{ display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:12px; color:var(--muted); font-size:13px; font-weight:600; padding:4px 0 }
    .sl-div:before, .sl-div:after{ content:""; height:1px; background:linear-gradient(90deg, transparent, rgba(255,255,255,.18), transparent) }

    /* Method tabs */
    .sl-tabs{ display:grid; grid-template-columns:repeat(3, 1fr); gap:8px }
    .sl-tab{
      appearance:none; cursor:pointer; min-height:54px;
      background:rgba(0,0,0,.55); border:1px solid var(--line);
      color:var(--muted); font-weight:700; font-size:13.5px;
      border-radius:12px; display:flex; align-items:center; justify-content:center; gap:8px;
      padding:0 8px; transition:background .15s ease, border-color .15s ease, color .15s ease;
    }
    .sl-tab svg{ font-size:16px }
    .sl-tab[aria-selected="true"]{ background:rgba(176,132,28,.12); border-color:rgba(176,132,28,.4); color:var(--white) }
    .sl-tab:hover{ border-color:rgba(176,132,28,.35) }

    /* Fields */
    .sl-field{ display:grid; gap:8px }
    .sl-label{ font-size:13.5px; color:var(--white); font-weight:700; letter-spacing:.01em }
    .sl-labelWithInfo{ display:flex; align-items:center; gap:6px }
    .sl-infoIcon{ color:var(--muted); font-size:12px }
    .sl-inputWrap{ position:relative; display:flex }
    .sl-inputIcon{
      position:absolute; top:50%; transform:translateY(-50%);
      ${l?"right:14px":"left:14px"}; color:var(--muted); font-size:16px; pointer-events:none;
    }
    .sl-input{
      width:100%; min-height:54px; border-radius:12px;
      border:1px solid var(--line); background:rgba(0,0,0,.55);
      color:var(--white); font-size:16px; font-weight:500;
      padding:0 16px; outline:none;
      transition:border-color .15s ease, box-shadow .15s ease;
    }
    .sl-input--icon{ ${l?"padding-right:42px; padding-left:16px":"padding-left:42px; padding-right:16px"} }
    .sl-input::placeholder{ color:rgba(255,250,240,.4); font-weight:400 }
    .sl-input:focus{ border-color:rgba(176,132,28,.55); box-shadow:0 0 0 3px rgba(176,132,28,.18) }
    .sl-hint{ color:var(--muted); font-size:12.5px; line-height:1.4 }
    .sl-inlineError{
      margin:0;
      padding:10px 12px;
      border-radius:12px;
      border:1px solid rgba(255,90,90,.4);
      background:rgba(150,20,20,.22);
      color:#ffd7d7;
      font-size:13px;
      font-weight:700;
      line-height:1.35;
    }
    .sl-submitHint{ text-align:center; margin-top:-3px }
    .sl-field .intl-phone-wrapper{
      min-height:54px;
      border-radius:12px !important;
      padding:9px 14px !important;
      background:rgba(0,0,0,.55) !important;
      border-color:var(--line) !important;
      color:var(--white) !important;
    }
    .sl-field .intl-phone-wrapper .PhoneInput{ gap:10px }
    .sl-field .intl-phone-wrapper .PhoneInputCountry{ margin-right:8px }
    .sl-field .intl-phone-wrapper .PhoneInputInput{
      min-width:0;
      font-size:16px;
      background:transparent !important;
      color:var(--white) !important;
    }
    .sl-field .intl-phone-wrapper .PhoneInputInput::placeholder{ color:rgba(255,250,240,.42) !important }
    .sl-field .intl-phone-wrapper .PhoneInputCountrySelect{ color:var(--white) !important }
    .sl-field .intl-phone-wrapper .PhoneInputCountrySelectArrow{ color:var(--gold2) !important; opacity:.9 }

    /* Terms — entire row is the tap target (label wraps the checkbox + text).
     * Checkbox visible size is 24 px and min-height:44 px gives an easy tap. */
    .sl-terms{
      display:flex; align-items:flex-start; gap:12px; cursor:pointer;
      color:var(--muted); font-size:13px; line-height:1.5;
      min-height:44px; padding:6px 0;
    }
    .sl-terms input{ width:24px; height:24px; accent-color:var(--gold); flex:0 0 auto; margin-top:1px }
    .sl-terms a{ color:var(--gold2); font-weight:700; text-decoration:underline }
    .sl-terms--quick{
      margin:-2px 0 0;
      padding:10px 12px;
      border:1px solid rgba(176,132,28,.24);
      border-radius:14px;
      background:rgba(176,132,28,.06);
    }

    /* CTA — premium gold gradient (luxury house brand). Min-height 58px keeps
     * it well above the 44 px tap-target floor on every device. */
    .sl-cta{
      appearance:none; cursor:pointer; width:100%; min-height:58px;
      border-radius:14px; border:0;
      background:linear-gradient(180deg, #ead8a5 0%, var(--gold2) 16%, var(--gold) 58%, var(--gold3) 100%);
      color:#0a0a0a;
      display:flex; align-items:center; justify-content:center; gap:10px;
      font-weight:900; font-size:16px; letter-spacing:.02em;
      box-shadow:0 18px 50px rgba(176,132,28,.28);
      transition:transform .15s ease, box-shadow .15s ease, filter .15s ease;
      -webkit-tap-highlight-color:transparent;
    }
    .sl-cta:hover:not(:disabled){ transform:translateY(-1px); filter:brightness(1.06); box-shadow:0 22px 64px rgba(176,132,28,.5) }
    .sl-cta:disabled{ opacity:.5; cursor:not-allowed }
    .sl-cta svg{ font-size:18px }
    .sl-btn{
      appearance:none; cursor:pointer; width:100%; min-height:48px;
      border-radius:12px; border:1px solid var(--line);
      background:rgba(0,0,0,.4); color:var(--white);
      font-weight:700; font-size:14px;
    }

    .sl-bank{
      display:flex; align-items:center; justify-content:center; gap:8px; flex-wrap:wrap;
      color:var(--muted); font-size:12.5px; padding-top:4px;
    }
    .sl-bank svg{ color:var(--gold2); font-size:13px }

    /* DOWNLOAD APP BANNER */
    .sl-dl{
      max-width:1440px; margin:clamp(24px,3vw,40px) auto 0;
      padding:clamp(18px,2.5vw,24px) clamp(16px,3vw,32px);
      border-top:1px solid var(--line);
      display:flex; align-items:center; justify-content:space-between; gap:18px; flex-wrap:wrap;
    }
    .sl-dlLeft{ display:flex; align-items:center; gap:14px; min-width:0 }
    .sl-dlPaw{
      width:54px; height:54px; border-radius:50%;
      background:rgba(255,255,255,.06); border:1px solid var(--line);
      display:inline-flex; align-items:center; justify-content:center;
      color:var(--gold2); font-size:22px; flex:0 0 auto;
    }
    .sl-dlTitle{ font-family:"Playfair Display", Georgia, serif; font-size:22px; color:var(--white) }
    .sl-dlSub{ color:var(--muted); font-size:13px; margin-top:2px }
    .sl-dlRight{ display:flex; align-items:center; gap:10px; flex-wrap:wrap }
    .sl-store{
      display:flex; align-items:center; gap:10px;
      padding:10px 16px; border-radius:12px;
      background:#0a0a0a; border:1px solid rgba(255,255,255,.14);
      color:#fff; text-decoration:none; min-height:54px;
      transition:border-color .15s ease, box-shadow .15s ease;
    }
    .sl-store:hover{ border-color:rgba(176,132,28,.4); box-shadow:0 0 0 3px rgba(176,132,28,.1) }
    .sl-store svg{ font-size:26px; flex:0 0 auto }
    .sl-store span{ display:flex; flex-direction:column; line-height:1.05; align-items:flex-start }
    .sl-store small{ font-size:10px; opacity:.78; font-weight:700; letter-spacing:.06em; text-transform:uppercase }
    .sl-store strong{ font-size:14.5px; font-weight:900 }
    .sl-qr{ width:54px; height:54px }
    .sl-qrSvg{ width:54px; height:54px; border-radius:6px }

    /* ====== BREAKPOINTS ====== */

    /* ≤ 767px (phones) — single column, compact direct signup.
     * Operator brief 2026-05-26: keep CTA reachable, never let the dog push
     * the form down. Logo stays dominant; dog scales down accordingly. */
    @media(max-width:767px){
      .sl-shell{ min-height:auto; padding-top:0 }
      .sl-frame{ gap:10px; padding:max(6px, env(safe-area-inset-top)) 12px calc(92px + env(safe-area-inset-bottom)) }
      .sl-hero{ gap:6px; padding-top:0 }
      .sl-logo{ width:min(86vw, 382px) }
      .sl-eyebrow{ font-size:9px; letter-spacing:.20em; margin-top:0 }
      .sl-h1{ font-size:clamp(23px,6vw,28px); line-height:1.04; max-width:352px }
      .sl-sub{ font-size:clamp(13px,3.4vw,15px); line-height:1.32; max-width:344px }
      .sl-divPaw{ display:none }
      .sl-dogWrap{ padding:0 }
      .sl-dog{ width:min(42vw, 162px); border-radius:16px; box-shadow:0 14px 38px rgba(0,0,0,.42); object-position:center top }
      .sl-card,.sl-trustCard,.sl-secBadge{ display:none }
      .sl-panel{ padding:16px 14px; border-radius:22px; gap:11px; scroll-margin-top:8px }
      .sl-panelHead{ gap:8px }
      .sl-title{ font-size:clamp(23px,6vw,28px); line-height:1.05; letter-spacing:.02em }
      .sl-helper{ font-size:13.5px; line-height:1.35 }
      .sl-lang{ min-height:40px; padding:8px 12px; border-radius:999px }
      .sl-social4{ grid-template-columns:1fr 1fr; gap:8px }
      .sl-soc{ min-height:50px; border-radius:14px; padding:0 12px; gap:10px; font-size:13px; line-height:1.15 }
      .sl-soc svg,.sl-fbIcon,.sl-igIcon{ flex:0 0 auto }
      .sl-div{ margin:2px 0; font-size:12px }
      .sl-tabs{ grid-template-columns:repeat(3, minmax(0,1fr)); gap:8px }
      .sl-tab{ min-height:46px; border-radius:14px; padding:8px 8px; font-size:13px; line-height:1.15 }
      .sl-label{ font-size:13px }
      .sl-input{ min-height:50px; border-radius:14px; font-size:16px }
      .sl-inputWrap .sl-inputIcon{ left:14px }
      .sl-field .intl-phone-wrapper{
        min-height:50px;
        border-radius:14px !important;
        padding:8px 12px !important;
        background:rgba(0,0,0,.55) !important;
        border-color:var(--line) !important;
        color:var(--white) !important;
      }
      .sl-field .intl-phone-wrapper .PhoneInput{ gap:10px }
      .sl-field .intl-phone-wrapper .PhoneInputCountry{ margin-right:8px }
      .sl-field .intl-phone-wrapper .PhoneInputInput{
        min-width:0;
        font-size:16px;
        background:transparent !important;
        color:var(--white) !important;
      }
      .sl-field .intl-phone-wrapper .PhoneInputInput::placeholder{ color:rgba(255,250,240,.42) !important }
      .sl-field .intl-phone-wrapper .PhoneInputCountrySelect{ color:var(--white) !important }
      .sl-field .intl-phone-wrapper .PhoneInputCountrySelectArrow{ color:var(--gold2) !important; opacity:.9 }
      .sl-badges{ grid-template-columns:1fr 1fr; gap:8px }
      .sl-badge{ min-height:54px; padding:10px 8px }
      .sl-terms{ align-items:flex-start; font-size:12.5px; line-height:1.35 }
      .sl-dl{ display:none }
    }

    /* ≤ 420px (very small phones, iPhone SE) — keep the dog visible but
     * compact. The logo still owns the hierarchy; the CTA remains reachable. */
    @media(max-width:420px){
      .sl-frame{ padding-top:max(4px, env(safe-area-inset-top)) }
      .sl-logo{ width:min(84vw, 352px) }
      .sl-h1{ font-size:clamp(21px,5.7vw,26px) }
      .sl-sub{ font-size:13px }
      .sl-dog{ width:min(38vw, 142px) }
    }

    @media(max-width:380px){
      .sl-dogWrap{ display:none }
    }

    /* 768-1023 (tablet portrait, iPad mini portrait) — two columns so iPad
     * does not bury the signup form under an oversized hero. */
    @media(min-width:768px) and (max-width:1023px){
      .sl-frame{
        display:grid;
        grid-template-columns:minmax(360px,.9fr) minmax(360px,1.1fr);
        gap:14px;
        align-items:start;
        padding:14px 14px 40px;
      }
      .sl-hero{ position:sticky; top:14px; gap:12px }
      .sl-logo{ width:min(48vw, 420px); min-width:360px; max-width:100% }
      .sl-eyebrow{ font-size:10px; letter-spacing:.24em }
      .sl-h1{ font-size:clamp(26px,3.4vw,34px); line-height:1.08 }
      .sl-sub{ font-size:clamp(14px,2vw,17px); line-height:1.35 }
      .sl-dog{ width:min(32vw, 260px) }
      .sl-title{ font-size:clamp(27px,3.7vw,34px); line-height:1.05 }
      .sl-panel{ padding:22px; border-radius:26px }
    }

    /* ≥ 1024px (iPad landscape, desktop) — two columns, sticky left.
     * The hero is sticky so the brand stays visible while the form scrolls. */
    @media(min-width:1024px){
      .sl-frame{
        display:grid; grid-template-columns:1fr 1.05fr;
        gap:clamp(32px,4vw,56px);
        align-items:start;
        padding-top:clamp(20px,2.6vw,40px);
      }
      .sl-hero{ position:sticky; top:18px; gap:18px }
      .sl-logo{ width:clamp(360px,28vw,520px) }
      .sl-h1{ font-size:clamp(32px,2.6vw,44px) }
      .sl-dog{ width:min(56%, 360px) }
      .sl-panel{ padding:clamp(28px,2.6vw,38px) }
    }

    /* Rotated phones and compact webviews — use every pixel. This overrides
     * tablet/desktop breakpoints when height is the limiting dimension. */
    @media(max-height:500px) and (orientation:landscape){
      .sl-shell{ min-height:auto; padding-top:0 }
      .sl-frame{
        display:grid;
        grid-template-columns:minmax(240px,.74fr) minmax(320px,1.26fr);
        gap:10px;
        align-items:start;
        padding:max(6px, env(safe-area-inset-top)) 10px calc(72px + env(safe-area-inset-bottom));
      }
      .sl-hero{
        position:static;
        top:auto;
        gap:5px;
        padding-top:0;
        min-width:0;
      }
      .sl-logo{ width:min(42vw, 280px); min-width:0; max-width:100% }
      .sl-eyebrow{ font-size:8px; letter-spacing:.18em; margin-top:0 }
      .sl-h1{ font-size:clamp(18px,3.1vw,24px); line-height:1.02; max-width:300px }
      .sl-sub{ font-size:11px; line-height:1.25; max-width:300px }
      .sl-divPaw{ display:none }
      .sl-dogWrap{ padding:0 }
      .sl-dog{ width:min(19vw, 96px); border-radius:12px; box-shadow:0 10px 28px rgba(0,0,0,.42) }
      .sl-card,.sl-trustCard,.sl-secBadge,.sl-dl{ display:none }
      .sl-panel{
        padding:12px;
        border-radius:18px;
        gap:9px;
        min-width:0;
      }
      .sl-panelHead{ display:flex; flex-direction:row; align-items:center; justify-content:space-between; gap:10px }
      .sl-title{ font-size:clamp(20px,3.2vw,25px); line-height:1.02 }
      .sl-helper{ font-size:12px; line-height:1.25 }
      .sl-lang{ min-height:34px; padding:6px 10px; font-size:12px }
      .sl-social4{ grid-template-columns:1fr 1fr; gap:7px }
      .sl-soc{ min-height:42px; border-radius:12px; padding:0 10px; gap:8px; font-size:12px; line-height:1.05 }
      .sl-soc svg,.sl-fbIcon,.sl-igIcon{ width:21px; height:21px; flex:0 0 auto }
      .sl-div{ display:none }
      .sl-tabs{ gap:7px }
      .sl-tab{ min-height:40px; border-radius:12px; font-size:12px; padding:6px }
      .sl-field{ gap:6px }
      .sl-label{ font-size:12px }
      .sl-input{ min-height:42px; border-radius:12px; font-size:15px }
      .sl-field .intl-phone-wrapper{ min-height:42px; border-radius:12px !important; padding:6px 10px !important }
      .sl-terms{ min-height:38px; padding:7px 9px; font-size:11px; line-height:1.25 }
      .sl-terms input{ width:21px; height:21px }
    }

    /* Hover affordances (mouse-only) */
    @media(hover:hover){
      .sl-input:hover{ border-color:rgba(255,255,255,.2) }
    }

    @media(prefers-reduced-motion:reduce){
      .sl-soc, .sl-cta, .sl-store, .sl-tab{ transition:none }
    }
  `}export{Qe as default};
