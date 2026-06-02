import{l as Ae,r as o,j as e,Y as ie,Z as re,_ as ne,$ as _,a0 as oe,a1 as F,a2 as ze,a3 as Fe,a4 as Oe,a5 as Be,a6 as U,a7 as k,a8 as de,a9 as Le,aa as Re,ab as Me,ac as Ge,ad as We}from"./vendor-react-BkY-0lV0.js";import{e as De,b as _e,d as Ue,n as He,m as $e,s as Ye}from"./vendor-firebase-CG1MhA7b.js";import{l as N,a as I}from"./firebase-Dtv7hjOo.js";import{c as Ve,a as qe,b as Je,g as Ke}from"./iosAuthHandler-BlSR-RAo.js";import{getApiUrl as m}from"./apiConfig-DqyqUl6t.js";import{P as Qe}from"./PhoneInput-DUkjIs5j.js";import{O as Xe,e as Ze}from"./TurnstileWidget-ChXG69b_.js";import{u as es,p as ss}from"./App-swfvw17p.js";import"./vendor-i18n-BnqEsHlA.js";import"./index-CZ4w66EW.js";import"./card-BgQ4pz9l.js";import"./vendor-ui-CIYxMNs1.js";import"./vendor-query-D6sFmr-P.js";const as={BASE_URL:"/",DEV:!1,MODE:"production",PROD:!0,SSR:!1},he=as??{},ce=l=>he[l]!=="false",ts=l=>he[l]==="true",w={googleSignin:ce("VITE_AUTH_SIGNUP_GOOGLE_SIGNIN_ENABLED"),appleSignin:ts("VITE_AUTH_SIGNUP_APPLE_SIGNIN_ENABLED"),emailPassword:ce("VITE_AUTH_SIGNUP_EMAIL_PASSWORD_ENABLED")};function ls(l){return l==="provider"||l==="guest"||l==="booking"||l==="prestige"?l:"general"}function is(l){switch(l){case"provider":return"/provider-onboarding";case"guest":return"/egift";case"booking":return"/booking";case"prestige":return"/dashboard";default:return"/dashboard"}}function rs(l){const{savePassword:p,...n}=l;try{localStorage.setItem("petwash_signup_prefs",JSON.stringify(n))}catch{}}function ns(){const[l,p]=o.useState(()=>typeof window<"u"&&window.matchMedia("(max-width: 767px)").matches);return o.useEffect(()=>{if(typeof window>"u")return;const n=window.matchMedia("(max-width: 767px)"),g=s=>p(s.matches);return n.addEventListener("change",g),()=>n.removeEventListener("change",g)},[]),l}function Cs({language:l="en",onLanguageChange:p}){const[,n]=Ae(),{toast:g}=es(),s=l==="he",f=ns(),$=o.useMemo(()=>new URLSearchParams(typeof window<"u"?window.location.search:""),[]),O=ls($.get("flow")||$.get("intent")),B=is(O),{user:Y}=ss();o.useEffect(()=>{Y&&n(B)},[Y,B,n]);const[c,L]=o.useState("mobile"),[b,xe]=o.useState(""),[ue,me]=o.useState(""),[S,fe]=o.useState(""),[y,be]=o.useState(""),[V,ve]=o.useState(""),[R,q]=o.useState(""),[J,we]=o.useState(!1),[K,ye]=o.useState(!1),[Q,je]=o.useState(!0),[T,ke]=o.useState(!0),[v,X]=o.useState(null),[E,Ne]=o.useState(!1),[C,M]=o.useState(!1),[h,x]=o.useState(!1),[P,Z]=o.useState(1),d=t=>g({variant:"destructive",title:s?"שגיאה":"Error",description:t}),ee=()=>E?!0:(d(s?"יש לאשר את התנאים ומדיניות הפרטיות":"Please accept the Terms and Privacy Policy to continue."),!1),G=()=>rs({entryCode:R,biometric:J,savePassword:K,rememberMe:Q,walletConsent:T,walletIntent:v});async function W(){G();try{await fetch(m("/api/session/whoami"),{credentials:"include"})}catch(t){N.error("[signup] whoami",t)}n(B)}async function se(){if(!b){d(s?"הזן מספר טלפון":"Enter your mobile number");return}if(ee()){x(!0);try{const t=await Ze("signup_sms_start").catch(()=>null),i=await(await fetch(m("/api/auth/sms/start"),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({phone:b,language:l,flow:O,turnstileToken:t})})).json();if(!i.ok){d(i.message||(s?"SMS אינו זמין כעת — נסה אימייל או Google":"SMS is temporarily unavailable. Please use email or Google."));return}M(!0),g({title:s?"קוד נשלח 📲":"Code sent 📲"})}catch(t){N.error("[signup] sendCode",t),d(s?"שגיאת רשת":"Network error")}finally{x(!1)}}}async function Se(t){x(!0);try{const i=await(await fetch(m("/api/auth/sms/verify"),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({phone:b,code:t,language:l,flow:O})})).json();if(!i.ok){d(i.message||(s?"קוד שגוי":"Invalid code"));return}const u=await(await fetch(m("/api/auth/phone-session"),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({verificationToken:i.verificationToken})})).json();if(u.customToken){const Ee=await(await De(I,u.customToken)).user.getIdToken(!0);await fetch(m("/api/auth/session"),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({idToken:Ee})})}await W()}catch(r){N.error("[signup] verify",r),d(s?"האימות נכשל":"Verification failed")}finally{x(!1)}}async function D(t){if(!E){d(s?"יש לאשר את התנאים ומדיניות הפרטיות":"Please accept the Terms and Privacy Policy to continue.");return}x(!0);try{const r=t==="google"?Ve():t==="apple"?qe():Je();if(Ke()==="redirect"){G(),await _e(I,r);return}const j=await(await Ue(I,r)).user.getIdToken(!0);await fetch(m("/api/auth/session"),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({idToken:j})}),await W()}catch(r){if((r==null?void 0:r.code)==="auth/popup-closed-by-user")return;N.error("[signup] social",r);const i=t==="google"?"Google":t==="apple"?"Apple":"Facebook";d(s?`התחברות ${i} לא הושלמה — נסה נייד או אימייל`:`${i} sign-in did not complete. Please try mobile or email.`)}finally{x(!1)}}async function Ce(t){if(!E){d(s?"יש לאשר את התנאים ומדיניות הפרטיות":"Please accept the Terms and Privacy Policy to continue.");return}x(!0);try{G();const i=await(await fetch(m(`/api/auth/social/${t}/authorize`),{credentials:"include"})).json().catch(()=>({}));if(i!=null&&i.authUrl){window.location.href=i.authUrl;return}const j=t==="instagram"?"Instagram":"TikTok";d(s?`${j} עדיין לא פעיל — נסה Google, נייד או אימייל`:`${j} sign-in is not active yet — please try Google, mobile or email.`)}catch(r){N.error("[signup] socialExternal",r),d(s?"שגיאת רשת":"Network error")}finally{x(!1)}}async function ae(){if(!S||!y){d(s?"הזן אימייל וסיסמה":"Enter your email and password");return}if(ee()){x(!0);try{let t;try{t=await He(I,S,y)}catch(i){if((i==null?void 0:i.code)==="auth/user-not-found"||(i==null?void 0:i.code)==="auth/invalid-credential"){if(y!==V){d(s?"אשר את הסיסמה כדי ליצור חשבון חדש":"Confirm your password to create a new account.");return}try{t=await $e(I,S,y);try{await Ye(t.user)}catch{}}catch(u){if((u==null?void 0:u.code)==="auth/email-already-in-use"){d(s?"החשבון קיים — בדוק את הסיסמה":"Account exists — please check your password.");return}if((u==null?void 0:u.code)==="auth/weak-password"){d(s?"סיסמה חלשה מדי (6 תווים לפחות)":"Password too weak (min 6 characters).");return}throw u}}else if((i==null?void 0:i.code)==="auth/wrong-password"){d(s?"סיסמה שגויה":"Wrong password.");return}else if((i==null?void 0:i.code)==="auth/invalid-email"){d(s?"כתובת אימייל לא תקינה":"Invalid email address.");return}else throw i}const r=await t.user.getIdToken(!0);await fetch(m("/api/auth/session"),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({idToken:r})}),await W()}catch(t){N.error("[signup] email",t),d(s?"ההתחברות נכשלה":"Sign-in failed")}finally{x(!1)}}}const Pe=()=>c==="mobile"?b.length>4:S.length>3&&y.length>0,Ie=()=>{if(!Pe()){d(c==="mobile"?s?"הזן מספר נייד תקין":"Enter a valid mobile number":s?"הזן אימייל וסיסמה":"Enter your email and password");return}Z(2)},A=f&&P===2,te=!f||P===1,Te=!f||P===2,le=h?"…":c==="mobile"?s?"שלח קוד אימות":"Send Verification Code":s?"צור חשבון מאובטח":"Create Secure Account",a={eyebrow:s?"אקוסיסטם חכם לטיפול בחיות מחמד":"INTELLIGENT PET-CARE ECOSYSTEM",h1a:s?"העתיד של":"The Future of",h1b:s?"חיי חיות המחמד":"Pet Lifestyle",sub1:s?"שמונה פלטפורמות מהפכניות.":"Eight Revolutionary Platforms.",sub2:s?"אקוסיסטם חכם אחד לטיפול בחיות מחמד.":"One Intelligent Pet-Care Ecosystem.",premium:s?"חוויית פרמיום":"PREMIUM EXPERIENCE",premiumSub:s?"חכם. מאובטח. חלק.":"Intelligent. Secure. Seamless.",badges:s?[{t:"טיפול חכם בכוח AI",I:re},{t:"תגמולי VIP",I:ne},{t:"הזמנה חכמה",I:_},{t:"מעקב בריאות",I:oe}]:[{t:"AI Powered Pet Care",I:re},{t:"VIP Rewards",I:ne},{t:"Smart Booking",I:_},{t:"Health Tracking",I:oe}],trusted:s?"מהימן על-ידי הורי חיות מחמד בעולם":"TRUSTED BY PET PARENTS WORLDWIDE",rating:s?"4.9/5 דירוג ממוצע":"4.9/5 Average Rating",secure:s?"מאובטח · פרטי · מוצפן":"SECURE · PRIVATE · ENCRYPTED",secureSub:s?"הנתונים שלך 100% בטוחים אצלנו.":"Your data is 100% safe with us.",create:s?"צור את החשבון שלך":"Create Your Account",helper:s?"הצטרף לעתיד של טיפול חכם בחיות מחמד":"Join the future of intelligent pet care",cwGoogle:s?"המשך עם Google":"Continue with Google",cwApple:s?"המשך עם Apple":"Continue with Apple",cwFb:s?"המשך עם Facebook":"Continue with Facebook",cwIg:s?"המשך עם Instagram":"Continue with Instagram",soon:s?"בקרוב":"SOON",or:s?"או הירשם עם":"or sign up with",tabMobile:s?"נייד":"Mobile",tabEmail:s?"אימייל":"Email",tabOther:s?"אימייל אחר":"Other Email",phoneLabel:s?"מספר נייד":"Mobile Number",phonePh:s?"הזן את מספר הנייד":"Enter your mobile number",emailOpt:s?"כתובת אימייל (אופציונלי)":"Email Address (Optional)",emailPh:"name@email.com",emailHelper:s?"ניתן להשתמש ב-Gmail, Hotmail, Yahoo או כל אימייל":"You can use Gmail, Hotmail, Yahoo or any email address",emailLabel:s?"אימייל":"Email",pwd:s?"סיסמה":"Password",pwd2:s?"אישור סיסמה (לחשבון חדש)":"Confirm password (new account)",entryTitle:s?"צור קוד כניסה מהיר":"Create Next-Time Entry Code",entryPh:s?"צור קוד 6 ספרות":"Create 6-digit code",entryBtn:s?"שלח קוד":"Send Code",entryHelper:s?"השתמש בקוד זה בכניסה הבאה לאימות מהיר ובטוח.":"Use this code next time to login quickly and securely.",advTitle:s?"אבטחה מתקדמת 2026":"2026 ADVANCED SECURITY",advPasskey:s?"מוכן ל-Passkey":"Passkey Ready",advPasskeySub:s?"עתיד ללא סיסמה":"Passwordless future",advRecap:"reCAPTCHA v3",advRecapSub:s?"הגנה מבוטים והונאה":"Bot & fraud protection",advOtp:s?"אימות OTP":"OTP Verification",advOtpSub:s?"אימות SMS ואימייל":"SMS & Email verify",consentBio:s?"הסכמה לזיהוי ביומטרי / Face ID":"Face ID / Biometric Consent",consentBioSub:s?"אני מסכים/ה להשתמש ב-Face ID, Touch ID או כניסה ביומטרית במכשיר זה.":"I consent to use Face ID, Touch ID or biometric login on this device.",consentSavePwd:s?"שמור סיסמה במכשיר":"Save Password to My Device",consentSavePwdSub:s?"שמור את הסיסמה שלי באופן מאובטח במכשיר זה.":"Save my password securely to this device.",consentRemember:s?"זכור אותי ל-30 יום":"Remember Me for 30 Days",consentRememberSub:s?"השאר אותי מחובר/ת במכשיר זה למשך 30 יום אלא אם אצא ידנית.":"Keep me signed in on this device for 30 days unless I sign out.",consentWallet:s?"הסכמה לארנק נייד":"Mobile Wallet Consent",consentWalletSub:s?"אני מסכים/ה לקבל כרטיסי נאמנות, הצעות ומנויים בארנק הנייד.":"I agree to receive loyalty cards, offers and membership passes in mobile wallet.",addApple:"Add to Apple Wallet",addGoogle:"Add to Google Wallet",iAgree:s?"אני מסכים/ה ל":"I agree to the ",termsLink:s?"תנאי השימוש":"Terms of Service",andTo:s?" ול":" and ",privLink:s?"מדיניות הפרטיות":"Privacy Policy",cta:s?"צור חשבון מאובטח":"Create Secure Account",bank:s?"אבטחה ברמת בנק":"Bank-level security",enc:s?"הצפנת 256-bit":"256-bit encryption",safe:s?"הנתונים שלך בטוחים":"Your data is safe",dlTitle:s?"הורד את האפליקציה שלנו":"Download Our App",dlSub:s?"גש לכל הפיצ׳רים בנייד":"Access all features on the go",storeApple:"App Store",storeAppleLine:s?"הורד מ-":"Download on the",storeGoogle:"Google Play",storeGoogleLine:"GET IT ON",comingSoon:s?"בקרוב":"Coming soon",back:s?"חזרה":"Back",next:s?"המשך":"Continue"};return e.jsxs("div",{className:"sl-shell",dir:s?"rtl":"ltr",children:[e.jsx("style",{children:ps(s)}),e.jsxs("div",{className:"sl-frame",children:[e.jsxs("aside",{className:"sl-hero",children:[e.jsxs("header",{className:"sl-heroHead",children:[e.jsx("img",{src:"/brand/petwash-logo-white.png",alt:"PetWash",className:"sl-logo",width:600,height:240,decoding:"async"}),e.jsx("div",{className:"sl-eyebrow",children:a.eyebrow})]}),e.jsxs("h1",{className:"sl-h1",children:[a.h1a,e.jsx("br",{}),e.jsx("span",{className:"sl-gold",children:a.h1b})]}),e.jsxs("p",{className:"sl-sub",children:[a.sub1,e.jsx("br",{}),a.sub2]}),e.jsxs("div",{className:"sl-divPaw","aria-hidden":!0,children:[e.jsx("span",{}),e.jsx(ie,{}),e.jsx("span",{})]}),e.jsx("div",{className:"sl-dogWrap",children:e.jsx("img",{src:"/brand/hero-dog-lux.jpg",alt:"",className:"sl-dog",loading:"eager",decoding:"async","aria-hidden":!0})}),e.jsxs("section",{className:"sl-card",children:[e.jsxs("div",{className:"sl-cardHead",children:[e.jsx("div",{className:"sl-cardTitle",children:a.premium}),e.jsx("div",{className:"sl-cardSub",children:a.premiumSub})]}),e.jsx("div",{className:"sl-badges",children:a.badges.map(({t,I:r})=>e.jsxs("div",{className:"sl-badge",children:[e.jsx(r,{className:"sl-badgeIcon","aria-hidden":!0}),e.jsx("span",{children:t})]},t))})]}),e.jsxs("section",{className:"sl-card sl-trustCard",children:[e.jsx("div",{className:"sl-cardTitle",children:a.trusted}),e.jsxs("div",{className:"sl-avatars","aria-hidden":!0,children:[["#F4D48A","#E8B04A","#C5A55A","#9D6F23","#6E4A1A","#3A260A"].map((t,r)=>e.jsx("span",{className:"sl-avatar",style:{background:`linear-gradient(135deg, ${t}, #000)`},children:["NH","AL","MK","RS","TY","OS"][r]},r)),e.jsx("span",{className:"sl-avatarMore",children:"+25K"})]}),e.jsx("div",{className:"sl-stars","aria-hidden":!0,children:"★★★★★"}),e.jsx("div",{className:"sl-ratingTxt",children:a.rating})]}),e.jsxs("div",{className:"sl-secBadge",children:[e.jsx(F,{"aria-hidden":!0}),e.jsxs("div",{children:[e.jsx("div",{className:"sl-secBadgeTitle",children:a.secure}),e.jsx("div",{className:"sl-secBadgeSub",children:a.secureSub})]})]})]}),e.jsxs("main",{className:"sl-panel",role:"main",children:[e.jsxs("header",{className:"sl-panelHead",children:[e.jsxs("div",{children:[e.jsx("h2",{className:"sl-title",children:a.create}),e.jsx("p",{className:"sl-helper",children:a.helper})]}),p&&e.jsxs("button",{type:"button",className:"sl-lang",onClick:()=>p(s?"en":"he"),"aria-label":"Switch language",children:["🌐 ",s?"עברית":"English"," ▾"]})]}),A&&e.jsxs("button",{type:"button",className:"sl-back",onClick:()=>Z(1),children:["← ",a.back]}),!A&&e.jsxs("div",{className:"sl-social4",children:[w.googleSignin&&e.jsxs("button",{className:"sl-soc",disabled:h,onClick:()=>D("google"),children:[e.jsx(os,{})," ",e.jsx("span",{className:"sl-socLabel",children:a.cwGoogle})]}),e.jsxs("button",{className:`sl-soc sl-soc--apple${w.appleSignin?"":" sl-soc--soon"}`,disabled:h||!w.appleSignin,onClick:()=>w.appleSignin&&D("apple"),children:[e.jsx(ze,{"aria-hidden":!0})," ",e.jsx("span",{className:"sl-socLabel",children:a.cwApple}),!w.appleSignin&&e.jsx("span",{className:"sl-soonPill",children:a.soon})]}),e.jsxs("button",{className:"sl-soc sl-soc--fb",disabled:h,onClick:()=>D("facebook"),children:[e.jsx("span",{className:"sl-fbIcon","aria-hidden":!0,children:e.jsx(Fe,{})}),e.jsx("span",{className:"sl-socLabel",children:a.cwFb})]}),e.jsxs("button",{className:"sl-soc sl-soc--ig",disabled:h,onClick:()=>Ce("instagram"),children:[e.jsx("span",{className:"sl-igIcon","aria-hidden":!0,children:e.jsx(Oe,{})}),e.jsx("span",{className:"sl-socLabel",children:a.cwIg})]})]}),!A&&e.jsx("div",{className:"sl-div",children:a.or}),!A&&e.jsxs("div",{className:"sl-tabs",role:"tablist",children:[e.jsxs("button",{type:"button",className:"sl-tab",role:"tab","aria-selected":c==="mobile",onClick:()=>{L("mobile"),M(!1)},children:[e.jsx(Be,{"aria-hidden":!0})," ",a.tabMobile]}),w.emailPassword&&e.jsxs("button",{type:"button",className:"sl-tab",role:"tab","aria-selected":c==="email",onClick:()=>L("email"),children:[e.jsx(U,{"aria-hidden":!0})," ",a.tabEmail]}),w.emailPassword&&e.jsxs("button",{type:"button",className:"sl-tab",role:"tab","aria-selected":c==="other",onClick:()=>L("other"),children:[e.jsx(ds,{})," ",a.tabOther]})]}),te&&c==="mobile"&&!C&&e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"sl-field",children:[e.jsx("label",{className:"sl-label",children:a.phoneLabel}),e.jsx(Qe,{value:b,onChange:xe,language:l,defaultCountry:"IL"})]}),e.jsxs("div",{className:"sl-field",children:[e.jsx("label",{className:"sl-label",children:a.emailOpt}),e.jsxs("div",{className:"sl-inputWrap",children:[e.jsx(U,{className:"sl-inputIcon","aria-hidden":!0}),e.jsx("input",{className:"sl-input sl-input--icon",type:"email",inputMode:"email",autoComplete:"email",autoCapitalize:"off",autoCorrect:"off",spellCheck:!1,value:ue,onChange:t=>me(t.target.value),placeholder:a.emailPh})]}),e.jsx("div",{className:"sl-hint",children:a.emailHelper})]}),e.jsx(pe,{value:R,onChange:q,t:a})]}),te&&(c==="email"||c==="other")&&e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"sl-field",children:[e.jsx("label",{className:"sl-label",children:a.emailLabel}),e.jsxs("div",{className:"sl-inputWrap",children:[e.jsx(U,{className:"sl-inputIcon","aria-hidden":!0}),e.jsx("input",{className:"sl-input sl-input--icon",type:"email",inputMode:"email",autoComplete:"username email",autoCapitalize:"off",autoCorrect:"off",spellCheck:!1,value:S,onChange:t=>fe(t.target.value),placeholder:c==="other"?s?"Outlook, Yahoo, ProtonMail, אחר…":"Outlook, Yahoo, ProtonMail, other…":a.emailPh})]})]}),e.jsxs("div",{className:"sl-field",children:[e.jsx("label",{className:"sl-label",children:a.pwd}),e.jsxs("div",{className:"sl-inputWrap",children:[e.jsx(k,{className:"sl-inputIcon","aria-hidden":!0}),e.jsx("input",{className:"sl-input sl-input--icon",type:"password",autoComplete:"current-password",value:y,onChange:t=>be(t.target.value),placeholder:"••••••••"})]})]}),e.jsxs("div",{className:"sl-field",children:[e.jsx("label",{className:"sl-label",children:a.pwd2}),e.jsxs("div",{className:"sl-inputWrap",children:[e.jsx(k,{className:"sl-inputIcon","aria-hidden":!0}),e.jsx("input",{className:"sl-input sl-input--icon",type:"password",autoComplete:"new-password",value:V,onChange:t=>ve(t.target.value),placeholder:"••••••••"})]})]}),e.jsx(pe,{value:R,onChange:q,t:a})]}),c==="mobile"&&C&&e.jsxs(e.Fragment,{children:[e.jsx("p",{className:"sl-helper sl-center",children:s?`הזן את הקוד שנשלח ל-${b}`:`Enter the code sent to ${b}`}),e.jsx(Xe,{length:6,onComplete:t=>{Se(t)},loading:h,language:s?"he":"en"}),e.jsx("button",{className:"sl-btn",disabled:h,onClick:()=>M(!1),children:s?"שלח קוד חדש":"Resend code"})]}),f&&P===1&&!C&&e.jsxs("button",{className:"sl-cta sl-cta--ghost",disabled:h,onClick:Ie,children:[a.next," →"]}),Te&&!(c==="mobile"&&C)&&e.jsxs(e.Fragment,{children:[e.jsxs("section",{className:"sl-adv",children:[e.jsx("div",{className:"sl-advTitle",children:a.advTitle}),e.jsxs("div",{className:"sl-advCells",children:[e.jsx(H,{I:de,title:a.advPasskey,sub:a.advPasskeySub}),e.jsx(H,{I:F,title:a.advRecap,sub:a.advRecapSub}),e.jsx(H,{I:k,title:a.advOtp,sub:a.advOtpSub})]})]}),e.jsx(z,{I:de,checked:J,setChecked:we,title:a.consentBio,sub:a.consentBioSub}),e.jsx(z,{I:k,checked:K,setChecked:ye,title:a.consentSavePwd,sub:a.consentSavePwdSub}),e.jsx(z,{I:_,checked:Q,setChecked:je,title:a.consentRemember,sub:a.consentRememberSub}),e.jsx(z,{I:Le,checked:T,setChecked:ke,title:a.consentWallet,sub:a.consentWalletSub}),e.jsxs("div",{className:"sl-wallets",children:[e.jsxs("button",{type:"button",className:`sl-wbtn sl-wbtn--apple${v==="apple"?" is-on":""}`,disabled:!T,"aria-pressed":v==="apple",onClick:()=>X(v==="apple"?null:"apple"),children:[e.jsx(ge,{variant:"apple"})," ",e.jsx("strong",{children:a.addApple})]}),e.jsxs("button",{type:"button",className:`sl-wbtn sl-wbtn--google${v==="google"?" is-on":""}`,disabled:!T,"aria-pressed":v==="google",onClick:()=>X(v==="google"?null:"google"),children:[e.jsx(ge,{variant:"google"})," ",e.jsx("strong",{children:a.addGoogle})]})]}),e.jsxs("label",{className:"sl-terms",children:[e.jsx("input",{type:"checkbox",checked:E,onChange:t=>Ne(t.target.checked)}),e.jsxs("span",{children:[a.iAgree,e.jsx("a",{href:"/terms",target:"_blank",rel:"noreferrer",children:a.termsLink}),a.andTo,e.jsx("a",{href:"/privacy-policy",target:"_blank",rel:"noreferrer",children:a.privLink})]})]}),e.jsxs("button",{className:"sl-cta",disabled:h,onClick:()=>c==="email"||c==="other"?void ae():void se(),children:[e.jsx(k,{"aria-hidden":!0})," ",le]}),e.jsxs("div",{className:"sl-bank",children:[e.jsx(F,{"aria-hidden":!0})," ",e.jsx("span",{children:a.bank}),e.jsx("span",{"aria-hidden":!0,children:" · "}),e.jsx("span",{children:a.enc}),e.jsx("span",{"aria-hidden":!0,children:" · "}),e.jsx("span",{children:a.safe})]})]})]})]}),e.jsxs("section",{className:"sl-dl",children:[e.jsxs("div",{className:"sl-dlLeft",children:[e.jsx("span",{className:"sl-dlPaw","aria-hidden":!0,children:e.jsx(ie,{})}),e.jsxs("div",{children:[e.jsx("div",{className:"sl-dlTitle",children:a.dlTitle}),e.jsx("div",{className:"sl-dlSub",children:a.dlSub})]})]}),e.jsxs("div",{className:"sl-dlRight",children:[e.jsxs("span",{className:"sl-store","aria-disabled":"true",style:{cursor:"not-allowed",opacity:.6},title:a.comingSoon??"בקרוב",children:[e.jsx(Re,{"aria-hidden":!0}),e.jsxs("span",{children:[e.jsx("small",{children:a.storeAppleLine}),e.jsx("strong",{children:a.storeApple})]})]}),e.jsxs("span",{className:"sl-store","aria-disabled":"true",style:{cursor:"not-allowed",opacity:.6},title:a.comingSoon??"בקרוב",children:[e.jsx(Me,{"aria-hidden":!0}),e.jsxs("span",{children:[e.jsx("small",{children:a.storeGoogleLine}),e.jsx("strong",{children:a.storeGoogle})]})]}),e.jsx("div",{className:"sl-qr","aria-hidden":!0,children:e.jsx(cs,{})})]})]}),f&&P===2&&!(c==="mobile"&&C)&&e.jsx("div",{className:"sl-stickyWrap",children:e.jsxs("button",{className:"sl-cta sl-cta--sticky",disabled:h,onClick:()=>c==="email"||c==="other"?void ae():void se(),children:[e.jsx(k,{"aria-hidden":!0})," ",le]})})]})}function pe({value:l,onChange:p,t:n}){return e.jsxs("div",{className:"sl-field",children:[e.jsxs("label",{className:"sl-label sl-labelWithInfo",children:[n.entryTitle,e.jsx(Ge,{className:"sl-infoIcon","aria-hidden":!0})]}),e.jsxs("div",{className:"sl-entryRow",children:[e.jsxs("div",{className:"sl-inputWrap sl-entryInputWrap",children:[e.jsx(F,{className:"sl-inputIcon","aria-hidden":!0}),e.jsx("input",{className:"sl-input sl-input--icon",type:"text",inputMode:"numeric",pattern:"\\d{6}",maxLength:6,value:l,onChange:g=>p(g.target.value.replace(/\D/g,"").slice(0,6)),placeholder:n.entryPh})]}),e.jsx("button",{type:"button",className:"sl-entryBtn",disabled:!/^\d{6}$/.test(l),children:n.entryBtn})]}),e.jsx("div",{className:"sl-hint",children:n.entryHelper})]})}function H({I:l,title:p,sub:n}){return e.jsxs("div",{className:"sl-advCell",children:[e.jsx(l,{className:"sl-advIcon","aria-hidden":!0}),e.jsxs("div",{children:[e.jsx("div",{className:"sl-advCellTitle",children:p}),e.jsx("div",{className:"sl-advCellSub",children:n})]})]})}function z({I:l,checked:p,setChecked:n,title:g,sub:s}){return e.jsxs("label",{className:`sl-consent${p?" is-on":""}`,children:[e.jsx("span",{className:"sl-consentIcon",children:e.jsx(l,{"aria-hidden":!0})}),e.jsxs("span",{className:"sl-consentBody",children:[e.jsx("span",{className:"sl-consentTitle",children:g}),e.jsx("span",{className:"sl-consentSub",children:s})]}),e.jsxs("span",{className:"sl-consentBox",children:[e.jsx("input",{type:"checkbox",checked:p,onChange:f=>n(f.target.checked)}),e.jsx(We,{className:"sl-consentMark","aria-hidden":!0})]})]})}function os(){return e.jsxs("svg",{className:"sl-gIcon",viewBox:"0 0 48 48","aria-hidden":!0,children:[e.jsx("path",{fill:"#EA4335",d:"M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"}),e.jsx("path",{fill:"#4285F4",d:"M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"}),e.jsx("path",{fill:"#FBBC05",d:"M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"}),e.jsx("path",{fill:"#34A853",d:"M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"})]})}function ds(){return e.jsx("span",{className:"sl-yIcon","aria-hidden":!0,children:e.jsx("span",{className:"sl-yText",children:"Y!"})})}function ge({variant:l}){return e.jsxs("svg",{className:"sl-wcardIcon",viewBox:"0 0 32 22","aria-hidden":!0,children:[e.jsx("rect",{x:"0.5",y:"0.5",width:"31",height:"21",rx:"3",fill:l==="apple"?"url(#wgrad-a)":"url(#wgrad-g)",stroke:"rgba(255,255,255,.18)"}),e.jsxs("defs",{children:[e.jsxs("linearGradient",{id:"wgrad-a",x1:"0",y1:"0",x2:"32",y2:"22",gradientUnits:"userSpaceOnUse",children:[e.jsx("stop",{offset:"0",stopColor:"#f4d48a"}),e.jsx("stop",{offset:".5",stopColor:"#d8ad55"}),e.jsx("stop",{offset:"1",stopColor:"#9d6f23"})]}),e.jsxs("linearGradient",{id:"wgrad-g",x1:"0",y1:"0",x2:"32",y2:"22",gradientUnits:"userSpaceOnUse",children:[e.jsx("stop",{offset:"0",stopColor:"#4285F4"}),e.jsx("stop",{offset:".33",stopColor:"#34A853"}),e.jsx("stop",{offset:".66",stopColor:"#FBBC05"}),e.jsx("stop",{offset:"1",stopColor:"#EA4335"})]})]}),e.jsx("rect",{x:"3",y:"13",width:"9",height:"2",rx:"1",fill:"rgba(255,255,255,.65)"})]})}function cs(){const l=["1111111011111110","1000001011001010","1011101010111010","1011101011010110","1011101011001010","1000001010100110","1111111010101010","0000000010111100","1100110110010010","1011011000111110","0010011011000110","0001110110111010","1111111011010010","1000001011111010","1011101010001100","1011101011100110"];return e.jsxs("svg",{className:"sl-qrSvg",viewBox:"0 0 16 16",role:"img","aria-label":"QR code",children:[e.jsx("rect",{width:"16",height:"16",fill:"#fffaf0"}),l.map((p,n)=>p.split("").map((g,s)=>g==="1"?e.jsx("rect",{x:s,y:n,width:"1",height:"1",fill:"#0a0a0a"},`${s}-${n}`):null))]})}function ps(l){return`
    /* ── Page-scoped overrides ────────────────────────────────────────────
     * The global html/body bg in client/index.html:101-104 is white.
     * That shows through as "white empty space" on iOS Safari overscroll
     * and on short content. The signup page is a dark luxury surface, so
     * we override body bg to black while this component is mounted and
     * disable overscroll bounce so the dark canvas never breaks.
     * The style tag unmounts with the page, restoring the global rule.
     */
    html, body { background:#000 !important; overscroll-behavior:none }

    .sl-shell{
      --gold:#d8ad55; --gold2:#f4d48a; --white:#fffaf0;
      --muted:rgba(255,250,240,.6); --line:rgba(255,255,255,.10);
      --line2:rgba(244,212,138,.22); --ink:#0a0a0a;
      position:relative; min-height:100dvh; background:#000;
      color:var(--white);
      font-family:Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
      /* iOS notch + bottom home indicator. Top inset is added once at the
       * shell so it applies before any internal scroll; bottom inset is
       * handled per-component (sticky CTA below adds its own). */
      padding-top:env(safe-area-inset-top);
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
    .sl-hero{ display:flex; flex-direction:column; gap:18px }
    .sl-heroHead{ display:flex; flex-direction:column; gap:10px; align-items:flex-start }
    /* Logo is the dominant brand mark — larger than the headline below. */
    .sl-logo{ height:clamp(96px,18vw,180px); width:auto; display:block }
    .sl-eyebrow{ color:var(--muted); font-size:11px; letter-spacing:.32em; font-weight:800; text-transform:uppercase }
    /* Headline is intentionally smaller than the logo above. */
    .sl-h1{ font-family:"Playfair Display", Georgia, serif; font-size:clamp(24px,3.6vw,42px); line-height:1.05; letter-spacing:-.02em; margin:0; font-weight:600 }
    .sl-gold{ background:linear-gradient(180deg, var(--gold2), var(--gold) 60%, #b48830); -webkit-background-clip:text; background-clip:text; color:transparent; display:inline-block; padding-bottom:.08em }
    .sl-sub{ margin:0; color:var(--muted); font-size:clamp(14px,1.4vw,17px); line-height:1.5; max-width:520px }

    .sl-divPaw{ display:flex; align-items:center; gap:10px; color:var(--gold); margin:2px 0 }
    .sl-divPaw span{ height:1px; background:linear-gradient(90deg, transparent, rgba(244,212,138,.4), transparent); flex:1 }
    .sl-divPaw svg{ width:14px; height:14px }

    /* Dog supports the brand — never larger than the logo, never dominant. */
    .sl-dogWrap{ display:flex; justify-content:center; padding:4px 0 }
    .sl-dog{ width:min(50%, 240px); height:auto; aspect-ratio:1/1.05; object-fit:cover; border-radius:18px; box-shadow:0 24px 60px rgba(0,0,0,.55); border:1px solid rgba(255,255,255,.06) }

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
    .sl-stars{ color:var(--gold2); font-size:18px; letter-spacing:4px; text-shadow:0 0 12px rgba(244,212,138,.5) }
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
      background:linear-gradient(180deg, rgba(20,20,20,.95), rgba(8,8,8,.95));
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
    .sl-lang:hover{ border-color:rgba(244,212,138,.5) }

    .sl-back{
      align-self:flex-start; appearance:none; cursor:pointer;
      background:transparent; border:0; color:var(--gold2);
      font-weight:800; font-size:14px; padding:10px 6px; min-height:44px;
    }

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
    .sl-soc:hover:not(:disabled){ transform:translateY(-1px); border-color:rgba(244,212,138,.45); box-shadow:0 0 0 3px rgba(244,212,138,.10) }
    .sl-soc:disabled{ cursor:not-allowed }
    .sl-soc--soon{ opacity:.78 }
    .sl-socLabel{ flex:1; text-align:start }
    .sl-gIcon{ width:24px; height:24px; flex:0 0 auto }
    .sl-fbIcon{ width:24px; height:24px; flex:0 0 auto; border-radius:6px; background:#1877F2; display:inline-flex; align-items:center; justify-content:center; color:#fff }
    .sl-fbIcon svg{ font-size:14px }
    .sl-igIcon{ width:24px; height:24px; flex:0 0 auto; border-radius:6px; background:linear-gradient(135deg, #fdc468 0%, #d83689 50%, #5b4ad0 100%); display:inline-flex; align-items:center; justify-content:center; color:#fff }
    .sl-igIcon svg{ font-size:14px }
    .sl-soc--apple svg{ font-size:22px }
    .sl-soonPill{
      position:absolute; top:8px; ${l?"left:10px":"right:10px"};
      font-size:9.5px; font-weight:900; letter-spacing:.1em; text-transform:uppercase;
      padding:2px 7px; border-radius:999px;
      background:linear-gradient(135deg, var(--gold2), var(--gold)); color:#0a0a0a;
    }

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
    .sl-tab[aria-selected="true"]{ background:rgba(244,212,138,.12); border-color:rgba(244,212,138,.4); color:var(--white) }
    .sl-tab:hover{ border-color:rgba(244,212,138,.35) }
    .sl-yIcon{ width:18px; height:18px; border-radius:4px; background:#5F01D1; display:inline-flex; align-items:center; justify-content:center }
    .sl-yText{ color:#fff; font-weight:900; font-size:10.5px; letter-spacing:-.5px }

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
    .sl-input:focus{ border-color:rgba(244,212,138,.55); box-shadow:0 0 0 3px rgba(244,212,138,.18) }
    .sl-hint{ color:var(--muted); font-size:12.5px; line-height:1.4 }

    .sl-entryRow{ display:grid; grid-template-columns:1fr auto; gap:8px }
    .sl-entryInputWrap{ min-width:0 }
    .sl-entryBtn{
      appearance:none; cursor:pointer; min-height:54px; padding:0 18px;
      border-radius:12px; border:1px solid var(--line); background:#fff; color:#0a0a0a;
      font-weight:800; font-size:14px;
      transition:transform .15s ease, box-shadow .15s ease;
      white-space:nowrap;
    }
    .sl-entryBtn:hover:not(:disabled){ transform:translateY(-1px); box-shadow:0 6px 20px rgba(255,255,255,.18) }
    .sl-entryBtn:disabled{ opacity:.45; cursor:not-allowed }

    /* Advanced security panel */
    .sl-adv{
      border:1px solid var(--line); border-radius:14px;
      background:rgba(0,0,0,.45); padding:14px; display:grid; gap:12px;
    }
    .sl-advTitle{ color:var(--gold2); font-size:11.5px; letter-spacing:.28em; text-transform:uppercase; font-weight:900; text-align:center }
    .sl-advCells{ display:grid; grid-template-columns:repeat(3, 1fr); gap:10px }
    .sl-advCell{
      display:flex; flex-direction:column; align-items:center; gap:6px;
      padding:6px 4px; text-align:center;
    }
    .sl-advIcon{ font-size:22px; color:var(--gold2) }
    .sl-advCellTitle{ font-size:12.5px; font-weight:800; color:var(--white) }
    .sl-advCellSub{ font-size:11px; color:var(--muted); margin-top:2px }

    /* Consent cards — large clickable rows */
    .sl-consent{
      display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:14px;
      padding:14px 16px; border-radius:14px;
      border:1px solid var(--line); background:rgba(0,0,0,.55);
      cursor:pointer; min-height:64px;
      transition:border-color .15s ease, background .15s ease;
    }
    .sl-consent.is-on{ border-color:rgba(244,212,138,.5); background:rgba(244,212,138,.06) }
    .sl-consent:hover{ border-color:rgba(244,212,138,.35) }
    .sl-consentIcon{
      width:40px; height:40px; border-radius:10px;
      background:rgba(244,212,138,.10); border:1px solid rgba(244,212,138,.22);
      display:inline-flex; align-items:center; justify-content:center;
      color:var(--gold2); font-size:18px; flex:0 0 auto;
    }
    .sl-consentBody{ display:flex; flex-direction:column; gap:3px; min-width:0 }
    .sl-consentTitle{ font-size:14px; font-weight:800; color:var(--white); line-height:1.2 }
    .sl-consentSub{ font-size:12px; color:var(--muted); line-height:1.4 }
    .sl-consentBox{
      position:relative; width:26px; height:26px; flex:0 0 auto;
      border-radius:7px; border:1.5px solid rgba(244,212,138,.45);
      background:rgba(0,0,0,.55); display:inline-flex; align-items:center; justify-content:center;
    }
    .sl-consentBox input{ position:absolute; inset:0; width:100%; height:100%; opacity:0; cursor:pointer }
    .sl-consentMark{ color:var(--gold2); font-size:18px; opacity:0; transition:opacity .15s ease }
    .sl-consent.is-on .sl-consentMark{ opacity:1 }
    .sl-consent.is-on .sl-consentBox{ border-color:var(--gold2); background:rgba(244,212,138,.14) }

    /* Wallet buttons */
    .sl-wallets{ display:grid; grid-template-columns:1fr 1fr; gap:10px }
    .sl-wbtn{
      appearance:none; cursor:pointer; min-height:56px; border-radius:14px;
      display:flex; align-items:center; justify-content:center; gap:10px; padding:0 14px;
      border:1px solid var(--line); color:#fff; font-weight:800; font-size:14px;
      background:linear-gradient(180deg, #1d1d1f, #0a0a0a);
      transition:transform .15s ease, border-color .15s ease, box-shadow .15s ease;
    }
    .sl-wbtn:disabled{ opacity:.48; cursor:not-allowed }
    .sl-wbtn:not(:disabled):hover{ transform:translateY(-1px); border-color:rgba(244,212,138,.4); box-shadow:0 0 0 3px rgba(244,212,138,.12) }
    .sl-wbtn.is-on{ border-color:var(--gold2); box-shadow:0 0 0 3px rgba(244,212,138,.22) }
    .sl-wcardIcon{ width:32px; height:22px; flex:0 0 auto; filter:drop-shadow(0 2px 6px rgba(0,0,0,.6)) }

    /* Terms — entire row is the tap target (label wraps the checkbox + text).
     * Checkbox visible size is 24 px and min-height:44 px gives an easy tap. */
    .sl-terms{
      display:flex; align-items:flex-start; gap:12px; cursor:pointer;
      color:var(--muted); font-size:13px; line-height:1.5;
      min-height:44px; padding:6px 0;
    }
    .sl-terms input{ width:24px; height:24px; accent-color:var(--gold); flex:0 0 auto; margin-top:1px }
    .sl-terms a{ color:var(--gold2); font-weight:700; text-decoration:underline }

    /* CTA — premium gold gradient (luxury house brand). Min-height 58px keeps
     * it well above the 44 px tap-target floor on every device. */
    .sl-cta{
      appearance:none; cursor:pointer; width:100%; min-height:58px;
      border-radius:14px; border:0;
      background:linear-gradient(180deg, var(--gold2) 0%, var(--gold) 55%, #b48830 100%);
      color:#0a0a0a;
      display:flex; align-items:center; justify-content:center; gap:10px;
      font-weight:900; font-size:16px; letter-spacing:.02em;
      box-shadow:0 18px 50px rgba(244,212,138,.28);
      transition:transform .15s ease, box-shadow .15s ease, filter .15s ease;
      -webkit-tap-highlight-color:transparent;
    }
    .sl-cta:hover:not(:disabled){ transform:translateY(-1px); filter:brightness(1.06); box-shadow:0 22px 64px rgba(244,212,138,.5) }
    .sl-cta:disabled{ opacity:.5; cursor:not-allowed }
    .sl-cta svg{ font-size:18px }
    .sl-cta--ghost{
      background:rgba(255,255,255,.06); color:var(--white);
      border:1px solid rgba(244,212,138,.4); box-shadow:none;
    }
    .sl-cta--ghost:hover:not(:disabled){ background:rgba(244,212,138,.12); border-color:var(--gold2) }
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
    .sl-store:hover{ border-color:rgba(244,212,138,.4); box-shadow:0 0 0 3px rgba(244,212,138,.1) }
    .sl-store svg{ font-size:26px; flex:0 0 auto }
    .sl-store span{ display:flex; flex-direction:column; line-height:1.05; align-items:flex-start }
    .sl-store small{ font-size:10px; opacity:.78; font-weight:700; letter-spacing:.06em; text-transform:uppercase }
    .sl-store strong{ font-size:14.5px; font-weight:900 }
    .sl-qr{ width:54px; height:54px }
    .sl-qrSvg{ width:54px; height:54px; border-radius:6px }

    /* Sticky CTA on phones */
    .sl-stickyWrap{
      position:fixed; left:0; right:0; bottom:0; z-index:50;
      padding:12px 16px max(12px, env(safe-area-inset-bottom));
      background:linear-gradient(180deg, transparent, rgba(0,0,0,.95) 30%);
      pointer-events:none;
    }
    .sl-cta--sticky{ pointer-events:auto; box-shadow:0 14px 40px rgba(0,0,0,.65) }

    /* ====== BREAKPOINTS ====== */

    /* ≤ 767px (phones) — single column, progressive disclosure, sticky CTA.
     * Operator brief 2026-05-26: keep CTA reachable, never let the dog push
     * the form down. Logo stays dominant; dog scales down accordingly. */
    @media(max-width:767px){
      .sl-frame{ gap:16px; padding-bottom:calc(120px + env(safe-area-inset-bottom)) }
      .sl-hero{ gap:14px }
      .sl-logo{ height:clamp(80px,22vw,140px) }
      .sl-h1{ font-size:clamp(22px,6.6vw,32px) }
      .sl-dog{ width:min(40%, 180px) }
      .sl-social4{ grid-template-columns:1fr 1fr }
      .sl-badges{ grid-template-columns:1fr 1fr }
      .sl-advCells{ grid-template-columns:1fr }
      .sl-wallets{ grid-template-columns:1fr }
      .sl-tabs{ grid-template-columns:repeat(3, 1fr) }
      .sl-dl{ flex-direction:column; align-items:stretch; gap:14px }
      .sl-dlRight{ justify-content:center }
      .sl-title{ font-size:clamp(24px,7vw,30px) }
    }

    /* ≤ 420px (very small phones, iPhone SE) — hide the dog so the form
     * fits without scroll for the primary action. Logo + brand stay. */
    @media(max-width:420px){
      .sl-dogWrap{ display:none }
    }

    /* 768-1023 (tablet portrait, iPad mini portrait) — single column, single step */
    @media(min-width:768px) and (max-width:1023px){
      .sl-frame{ gap:24px }
      .sl-hero{ gap:18px; align-items:stretch }
      .sl-logo{ height:clamp(120px,14vw,160px) }
      .sl-h1{ font-size:clamp(28px,4.4vw,40px) }
      .sl-dog{ width:min(38%, 260px) }
      .sl-title{ font-size:32px }
      .sl-panel{ padding:28px }
      .sl-advCells{ grid-template-columns:repeat(3, 1fr) }
      .sl-wallets{ grid-template-columns:1fr 1fr }
    }

    /* ≥ 1024px (iPad landscape, desktop) — two columns, sticky left.
     * The hero is sticky so the brand stays visible while the form scrolls. */
    @media(min-width:1024px){
      .sl-frame{
        display:grid; grid-template-columns:1fr 1.05fr;
        gap:clamp(32px,4vw,56px);
        align-items:start;
        padding-top:clamp(32px,4vw,56px);
      }
      .sl-hero{ position:sticky; top:24px; gap:18px }
      .sl-logo{ height:clamp(140px,12vw,180px) }
      .sl-h1{ font-size:clamp(30px,2.8vw,42px) }
      .sl-dog{ width:min(48%, 240px) }
      .sl-panel{ padding:clamp(28px,2.6vw,38px) }
    }

    /* Hover affordances (mouse-only) */
    @media(hover:hover){
      .sl-input:hover{ border-color:rgba(255,255,255,.2) }
    }

    @media(prefers-reduced-motion:reduce){
      .sl-soc, .sl-cta, .sl-wbtn, .sl-entryBtn, .sl-store, .sl-tab, .sl-consent{ transition:none }
    }
  `}export{Cs as default};
