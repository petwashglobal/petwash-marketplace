const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/App-FzlSJEoj.js","assets/index-DKuo1Gum.js","assets/vendor-react-BCjBfcUn.js","assets/vendor-i18n-BnqEsHlA.js","assets/vendor-react-DpsRipQV.css","assets/index-DJaF_xhS.css","assets/firebase-CnYXWNeX.js","assets/vendor-firebase-DLajiYPP.js","assets/apiConfig-X1cvbUYf.js","assets/index-Dzn3_rKv.js","assets/vendor-query-GTlYtUtw.js","assets/vendor-ui-p7Mv80br.js","assets/sentry-BaqNgyUv.js"])))=>i.map(i=>d[i]);
import{_ as Be}from"./index-DKuo1Gum.js";import{V as Me,W as He,r as d,j as e,l as Ue,X as ie,Y as he,Z as ne,_ as ge,$ as ue,a0 as W,a1 as qe,a2 as Ve,a3 as me,a4 as $e,a5 as We,a6 as Ye,a7 as Je,a8 as Ke}from"./vendor-react-BCjBfcUn.js";import{E as Qe,f as xe,s as Xe,b as Ze}from"./vendor-firebase-DLajiYPP.js";import{l as I,a as z}from"./firebase-CnYXWNeX.js";import{i as et,s as tt,a as at,c as it,b as nt,d as st,g as rt}from"./iosAuthHandler-DDM-rOdX.js";import{getApiUrl as v}from"./apiConfig-X1cvbUYf.js";import{u as ot,s as k,n as lt,l as Y}from"./vendor-forms-TW2AGUu8.js";import{u as dt,l as pt,P as ct,ae as ht}from"./App-FzlSJEoj.js";import{e as gt}from"./sentry-BaqNgyUv.js";import{a as ut}from"./intentParam-BCPXKpPr.js";import{A as mt}from"./apple-wheel-picker-C0R1WNnx.js";import{e as xt}from"./TurnstileWidget-BONodpnU.js";import{a as ft,g as bt,s as vt,b as wt}from"./passkey-DtHHfqK3.js";import"./vendor-i18n-BnqEsHlA.js";import"./index-Dzn3_rKv.js";import"./vendor-query-GTlYtUtw.js";import"./vendor-ui-p7Mv80br.js";import"./index-XIwHffga.js";const yt={"validation.required":{en:"This field is required",he:"שדה חובה"},"validation.text.tooShort":{en:"This is too short",he:"הטקסט קצר מדי"},"validation.text.tooLong":{en:"This is too long",he:"הטקסט ארוך מדי"},"validation.consent.required":{en:"Please accept to continue",he:"יש לאשר כדי להמשיך"},"validation.email.invalid":{en:"Please enter a valid email address",he:"אנא הזן כתובת אימייל תקינה"},"validation.phone.invalid":{en:"Please enter a valid phone number",he:"אנא הזן מספר טלפון תקין"},"validation.id.invalid":{en:"Please enter a valid ID number",he:"אנא הזן מספר תעודת זהות תקין"},"validation.postalCode.invalid":{en:"Please enter a valid postal code",he:"אנא הזן מיקוד תקין"},"validation.name.required":{en:"Please enter your full name",he:"אנא הזן שם מלא"},"validation.password.tooShort":{en:"Password must be at least 8 characters",he:"הסיסמה חייבת להכיל לפחות 8 תווים"},"validation.password.needsUpper":{en:"Password must include an uppercase letter",he:"הסיסמה חייבת לכלול אות גדולה"},"validation.password.needsNumber":{en:"Password must include a number",he:"הסיסמה חייבת לכלול ספרה"},"validation.date.required":{en:"Please select a date",he:"אנא בחר תאריך"},"validation.date.invalid":{en:"Please enter a valid date",he:"אנא הזן תאריך תקין"},"validation.date.futureRequired":{en:"Date must be in the future",he:"התאריך חייב להיות עתידי"},"validation.date.notFuture":{en:"Date cannot be in the future",he:"התאריך לא יכול להיות עתידי"},"validation.date.endBeforeStart":{en:"End date must be after the start date",he:"תאריך הסיום חייב להיות אחרי תאריך ההתחלה"},"validation.user.mustBe18":{en:"You must be at least 18 years old",he:"עליך להיות בן 18 לפחות"},"validation.pet.nameRequired":{en:"Please enter your pet's name",he:"אנא הזן את שם חיית המחמד"},"validation.pet.dobFuture":{en:"Birth date can't be in the future",he:"תאריך הלידה לא יכול להיות עתידי"},"validation.booking.petRequired":{en:"Please select a pet",he:"אנא בחר חיית מחמד"},"validation.booking.dateRequired":{en:"Please select booking dates",he:"אנא בחר תאריכי הזמנה"},"validation.booking.startInPast":{en:"Start date cannot be in the past",he:"תאריך ההתחלה לא יכול להיות בעבר"},"validation.payment.amountInvalid":{en:"Please enter a valid amount",he:"אנא הזן סכום תקין"},"validation.payment.amountMin":{en:"Amount is below the minimum",he:"הסכום נמוך מהמינימום"},"validation.payment.amountMax":{en:"Amount is above the maximum",he:"הסכום גבוה מהמקסימום"},"validation.provider.serviceRequired":{en:"Please select at least one service",he:"אנא בחר לפחות שירות אחד"},"validation.pawFinder.petTypeRequired":{en:"Please select the pet type",he:"אנא בחר סוג חיה"},"validation.pawFinder.locationRequired":{en:"Please provide a location or area",he:"אנא ציין מיקום או אזור"},"validation.pawFinder.contactRequired":{en:"Please choose a contact preference",he:"אנא בחר אופן יצירת קשר"},"validation.incident.descriptionRequired":{en:"Please describe what happened",he:"אנא תאר מה קרה"},"validation.gift.recipientRequired":{en:"Please enter the recipient's email or mobile",he:"אנא הזן אימייל או נייד של הנמען"}};function ye(i,n="en"){const r=yt[i];return r?String(n).toLowerCase().startsWith("he")?r.he:r.en:i}function jt(i,n){var r=Array.prototype.slice.call(n);return r.push(Me),i.apply(this,r)}function kt(){return jt(He,arguments)}function Nt(i){const n=(i||"").replace(/\D/g,"");if(n.length===0||n.length>9||/^0+$/.test(n))return!1;const r=n.padStart(9,"0");let u=0;for(let t=0;t<9;t++){let A=parseInt(r[t],10)*(t%2+1);A>9&&(A-=9),u+=A}return u%10===0}function fe(i){if(!i)return!1;try{return kt(i)}catch{return!1}}const be=/^\d{5,7}$/;function St(i="en"){const n=r=>ye(r,i);return{email:k().trim().min(1,n("validation.required")).email(n("validation.email.invalid")),emailOptional:k().trim().refine(r=>r===""||k().email().safeParse(r).success,n("validation.email.invalid")).optional().or(Y("")),phone:k().trim().min(1,n("validation.required")).refine(fe,n("validation.phone.invalid")),phoneOptional:k().trim().refine(r=>!r||fe(r),n("validation.phone.invalid")).optional().or(Y("")),israeliId:k().trim().min(1,n("validation.required")).refine(r=>Nt(r),n("validation.id.invalid")),postalCode:k().trim().regex(be,n("validation.postalCode.invalid")),postalCodeOptional:k().trim().refine(r=>!r||be.test(r),n("validation.postalCode.invalid")).optional().or(Y("")),requiredName:k().trim().min(2,n("validation.name.required")),password:k().min(8,n("validation.password.tooShort")).regex(/[A-Z]/,n("validation.password.needsUpper")).regex(/\d/,n("validation.password.needsNumber")),consent:Y(!0,{errorMap:()=>({message:n("validation.consent.required")})}),requiredString:k().trim().min(1,n("validation.required")),text:(r=1,u=5e3)=>k().trim().min(r,r<=1?n("validation.required"):n("validation.text.tooShort")).max(u,n("validation.text.tooLong")),amount:(r=1,u=1e5)=>ot([k(),lt()]).transform(t=>typeof t=="number"?t:Number(String(t).replace(/[^\d.]/g,""))).refine(t=>!Number.isNaN(t)&&t>0,n("validation.payment.amountInvalid")).refine(t=>t>=r,n("validation.payment.amountMin")).refine(t=>t<=u,n("validation.payment.amountMax"))}}function ve({length:i=6,onComplete:n,loading:r=!1,error:u,title:t,subtitle:A,language:J="en"}){const[N,R]=d.useState(Array(i).fill("")),f=d.useRef([]),y=d.useRef(!1);d.useEffect(()=>{y.current=!1,R(Array(i).fill("")),setTimeout(()=>{var p;return(p=f.current[0])==null?void 0:p.focus()},120)},[u,i]),d.useEffect(()=>{if(!("OTPCredential"in window))return;const p=new AbortController;return navigator.credentials.get({otp:{transport:["sms"]},signal:p.signal}).then(c=>{if(c!=null&&c.code&&!y.current){const j=c.code.replace(/\D/g,"").slice(0,i).split(""),m=Array(i).fill("");j.forEach((x,C)=>{m[C]=x}),R(m),m.every(x=>x!=="")&&(y.current=!0,n(m.join("")))}}).catch(()=>{}),()=>p.abort()},[i,n]);const P=d.useCallback(p=>{var m;const c=p.replace(/\D/g,"").slice(0,i),g=Array(i).fill("");c.split("").forEach((x,C)=>{g[C]=x}),R(g);const j=Math.min(c.length-1,i-1);(m=f.current[j])==null||m.focus(),g.every(x=>x!=="")&&!y.current&&(y.current=!0,n(g.join("")))},[i,n]),K=d.useCallback((p,c)=>{var j;const g=c.replace(/\D/g,"");if(g.length>1){P(g);return}if(g.length===1){const m=[...N];m[p]=g,R(m),p<i-1&&((j=f.current[p+1])==null||j.focus()),m.every(x=>x!=="")&&!y.current&&(y.current=!0,n(m.join("")))}},[N,i,n,P]),O=d.useCallback((p,c)=>{var g,j,m;if(c.key==="Backspace"){if(c.preventDefault(),y.current=!1,N[p]){const x=[...N];x[p]="",R(x)}else if(p>0){const x=[...N];x[p-1]="",R(x),(g=f.current[p-1])==null||g.focus()}}else c.key==="ArrowLeft"&&p>0?(j=f.current[p-1])==null||j.focus():c.key==="ArrowRight"&&p<i-1&&((m=f.current[p+1])==null||m.focus())},[N,i]),Q=d.useCallback(p=>{p.preventDefault(),P(p.clipboardData.getData("text"))},[P]);return e.jsxs("div",{className:"flex flex-col items-center gap-4 py-4",children:[t&&e.jsx("h2",{className:"text-xl font-semibold text-neutral-900 dark:text-black text-center",children:t}),A&&e.jsx("p",{className:"text-sm text-neutral-500 dark:text-neutral-400 text-center px-4",children:A}),e.jsx("div",{className:"flex gap-2 justify-center",dir:"ltr",children:Array.from({length:i}).map((p,c)=>e.jsx("input",{ref:g=>{f.current[c]=g},type:"text",inputMode:"numeric",pattern:"\\d*",maxLength:c===0?i:1,value:N[c],autoComplete:c===0?"one-time-code":"off",onChange:g=>K(c,g.target.value),onKeyDown:g=>O(c,g),onFocus:g=>g.target.select(),onPaste:Q,disabled:r,"aria-label":`Digit ${c+1} of ${i}`,className:gt("w-11 h-14 text-center text-2xl font-bold rounded-lg border-2 transition-all duration-150 bg-white dark:bg-white","focus:outline-none focus:ring-0",N[c]?"border-neutral-900 text-neutral-900 dark:border-white dark:text-black":"border-neutral-300 text-neutral-400 dark:border-neutral-600",u?"border-red-400 dark:border-red-500 animate-shake":"focus:border-neutral-900 dark:focus:border-white",r?"opacity-50 cursor-not-allowed":"cursor-text")},c))}),u&&e.jsx("p",{className:"text-sm text-red-500 text-center",children:u}),r&&e.jsxs("div",{className:"flex items-center gap-2 text-sm text-neutral-500",children:[e.jsx("div",{className:"w-4 h-4 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin"}),J==="he"?"מאמת...":"Verifying..."]})]})}const It={BASE_URL:"/",DEV:!1,MODE:"production",PROD:!0,SSR:!1},je=It??{},_=i=>je[i]!=="false",se=i=>je[i]==="true",E={unifiedRoute:_("VITE_AUTH_SIGNUP_UNIFIED_ROUTE_ENABLED"),googleSignin:_("VITE_AUTH_SIGNUP_GOOGLE_SIGNIN_ENABLED"),appleSignin:_("VITE_AUTH_SIGNUP_APPLE_SIGNIN_ENABLED"),facebookSignin:_("VITE_AUTH_SIGNUP_FACEBOOK_SIGNIN_ENABLED"),instagramSignin:_("VITE_AUTH_SIGNUP_INSTAGRAM_SIGNIN_ENABLED"),tiktokSignin:_("VITE_AUTH_SIGNUP_TIKTOK_SIGNIN_ENABLED"),emailPassword:_("VITE_AUTH_SIGNUP_EMAIL_PASSWORD_ENABLED"),twoFactor:se("VITE_AUTH_SIGNUP_2FA_ENABLED"),passkey:_("VITE_AUTH_SIGNUP_PASSKEY_ENABLED"),keychainPrompt:se("VITE_AUTH_SIGNUP_KEYCHAIN_PROMPT_ENABLED"),legacyPanelHidden:se("VITE_AUTH_SIGNUP_LEGACY_PANEL_HIDDEN_ENABLED"),smsFallbackAndRealErrors:_("VITE_FEATURE_SMS_FALLBACK_AND_REAL_ERRORS")},Pt=["customer","loyalty","provider","staff_request"];async function Tt(){try{const i=typeof window<"u"&&window.localStorage?window.localStorage.getItem("signup_intent"):null;if(!i||!Pt.includes(i))return;const n=await fetch(v("/api/auth/seed-intent"),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({intent:i}),keepalive:!0});n.ok||I.warn("[seedIntent] Server rejected intent seed",{status:n.status})}catch(i){I.warn("[seedIntent] Network error seeding intent (non-fatal)",{err:String(i)})}}function Et(i){return i==="provider"||i==="guest"||i==="booking"||i==="prestige"?i:"general"}function At(i){switch(i){case"provider":return"/provider-onboarding";case"guest":return"/egift";case"booking":return"/booking";case"prestige":return"/dashboard";default:return"/dashboard"}}const H="pw_redirect_provider",Ct=5*60*1e3;function zt(i){const n=JSON.stringify({provider:i,ts:Date.now()});try{sessionStorage.setItem(H,n)}catch{}try{localStorage.setItem(H,n)}catch{}}function _t(){for(const i of[sessionStorage,localStorage])try{const n=i.getItem(H);if(!n)continue;const{provider:r,ts:u}=JSON.parse(n);if(Date.now()-u>Ct){i.removeItem(H);continue}return r}catch{continue}return null}function we(){try{sessionStorage.removeItem(H)}catch{}try{localStorage.removeItem(H)}catch{}}function ra({language:i="en",onLanguageChange:n}){const[,r]=Ue(),{toast:u}=dt(),t=i==="he",[A,J]=d.useState(!1),[N,R]=d.useState(!1),f=A&&N;d.useEffect(()=>{ut()},[]),d.useEffect(()=>{const a=document.getElementById("root");return document.documentElement.setAttribute("data-pw-page","signup"),document.body.setAttribute("data-pw-page","signup"),a==null||a.setAttribute("data-pw-page","signup"),()=>{document.documentElement.removeAttribute("data-pw-page"),document.body.removeAttribute("data-pw-page"),a==null||a.removeAttribute("data-pw-page")}},[]);const y=d.useMemo(()=>new URLSearchParams(typeof window<"u"?window.location.search:""),[]),[P,K]=d.useState(()=>Et(y.get("flow")||y.get("intent"))),O=P==="provider";function Q(){const a=P!=="provider";K(a?"provider":"prestige");try{a?ht():localStorage.removeItem("signup_intent")}catch{}}const p=y.get("redirect")||y.get("from"),c=p&&/^\/(?!\/)/.test(p)?p:null,g=c??At(P),j=O?"provider":y.get("flow")||y.get("intent")||void 0,{user:m}=pt();d.useEffect(()=>{if(!m)return;if(c){r(c);return}let a=!1;return(async()=>{try{const{resolvePostLogin:s}=await Be(async()=>{const{resolvePostLogin:b}=await import("./App-FzlSJEoj.js").then(D=>D.an);return{resolvePostLogin:b}},__vite__mapDeps([0,1,2,3,4,5,6,7,8,9,10,11,12])),l=await s({body:j?{intent:j}:void 0});a||r((l==null?void 0:l.nextUrl)||(l==null?void 0:l.redirectTo)||g)}catch{a||r(g)}})(),()=>{a=!0}},[m,c,j,g,r]),d.useEffect(()=>{let a=!1;return(async()=>{try{const s=await Qe(z);if(a)return;if(!s){_t()&&(we(),z.currentUser||h(t?"ההרשמה לא הושלמה — נסה שוב":"Sign-in did not complete. Please try again."));return}we(),w(!0);const l=await s.user.getIdToken();if(!(await fetch(v("/api/auth/session"),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({idToken:l})})).ok){h(t?"יצירת ההתחברות נכשלה — נסה שוב":"Could not establish your session. Please try again.");return}await B()}catch(s){if((s==null?void 0:s.code)==="auth/popup-closed-by-user"||(s==null?void 0:s.code)==="auth/cancelled-popup-request")return;I.error("[signup] redirect result",s)}finally{a||w(!1)}})(),()=>{a=!0}},[]);const[x,C]=d.useState("mobile"),[L,ke]=d.useState(""),[T,Ne]=d.useState(""),[Ot,Lt]=d.useState(""),[Gt,Bt]=d.useState(""),[$,U]=d.useState(!1),[S,w]=d.useState(!1),[re,F]=d.useState(null),[Se,oe]=d.useState(!0),[q,Ie]=d.useState(""),[Pe,Te]=d.useState(!1),[Ee,Ae]=d.useState(!1),[le,Ce]=d.useState("Face ID"),h=a=>F(a);d.useEffect(()=>{let a=!1;return(async()=>{try{const s=await ft();if(a)return;Ae(s),s&&Ce(bt()),vt().catch(()=>{})}catch{}})(),()=>{a=!0}},[]);async function ze(){w(!0),F(null);try{const a=await wt();a.success||h(a.error||(t?"התחברות עם Face ID נכשלה":"Face ID sign-in failed"))}catch(a){h((a==null?void 0:a.message)||(t?"התחברות עם Face ID נכשלה":"Face ID sign-in failed"))}finally{w(!1)}}d.useEffect(()=>{if(!E.smsFallbackAndRealErrors||!E.emailPassword)return;let a=!1;return fetch(v("/api/auth/sms/status"),{credentials:"include"}).then(s=>s.json()).then(s=>{a||(s==null?void 0:s.smsProviderHealthy)!==!1||(oe(!1),C(l=>l==="mobile"?"email":l))}).catch(s=>{I.warn("[signup] sms status unavailable",{error:s==null?void 0:s.message})}),()=>{a=!0}},[]);const de=()=>f?!0:(h(t?"יש לאשר את התנאים ומדיניות הפרטיות וגיל 18+":"Please accept the Terms and Privacy Policy and confirm you are 18+ to continue."),!1);async function B(){try{await fetch(v("/api/session/whoami"),{credentials:"include"})}catch(a){I.error("[signup] whoami",a)}r(g)}async function _e(){if(!L){h(t?"הזן מספר טלפון":"Enter your mobile number");return}if(de()){F(null),w(!0);try{const a=await xt("signup_sms_start").catch(()=>null),l=await(await fetch(v("/api/auth/sms/start"),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({phone:L,language:i,flow:P,turnstileToken:a})})).json();if(!l.ok){if(E.smsFallbackAndRealErrors){if(oe(!1),E.emailPassword){C("email"),h(l.message||(t?"SMS אינו זמין כעת — המשך עם אימייל.":"SMS is temporarily unavailable — continue with email."));return}h(t?"SMS אינו זמין כעת — המשך עם Google או Apple.":"SMS is temporarily unavailable — continue with Google or Apple.");return}h(l.message||(t?"SMS אינו זמין כעת — המשך עם אימייל.":"SMS is temporarily unavailable — continue with email."));return}U(!0),u({title:t?"קוד נשלח 📲":"Code sent 📲"})}catch(a){I.error("[signup] sendCode",a),h(t?"שגיאת רשת":"Network error")}finally{w(!1)}}}async function Re(a){F(null),w(!0);try{const l=await(await fetch(v("/api/auth/sms/verify"),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({phone:L,code:a,language:i,flow:P})})).json();if(!l.ok){h(l.message||(t?"קוד שגוי":"Invalid code"));return}const D=await(await fetch(v("/api/auth/phone-session"),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({verificationToken:l.verificationToken,dateOfBirth:q,email:T})})).json();if(D.customToken){const M=await(await xe(z,D.customToken)).user.getIdToken(!0);await fetch(v("/api/auth/session"),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({idToken:M})})}if(D.isNewUser&&Z){Te(!0),C("email"),U(!0);try{await fetch(v("/api/auth/email/start"),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({email:T,purpose:"signup",language:i})}),u({title:t?"קוד נשלח לאימייל 📧":"Code sent to your email 📧"})}catch{}return}await B()}catch(s){I.error("[signup] verify",s),h(t?"האימות נכשל":"Verification failed")}finally{w(!1)}}async function Fe(){if(!T){h(t?"הזן כתובת אימייל":"Enter your email");return}if(!St(i).email.safeParse(T.trim()).success){h(ye("validation.email.invalid",i));return}if(de()){F(null),w(!0);try{const s=await(await fetch(v("/api/auth/email/start"),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({email:T,purpose:"signup",language:i})})).json();if(!s.ok){h(s.message||(t?"לא ניתן לשלוח קוד כעת":"Could not send the code right now"));return}U(!0),u({title:t?"קוד נשלח לאימייל 📧":"Code sent to your email 📧"})}catch(a){I.error("[signup] sendEmailCode",a),h(t?"שגיאת רשת":"Network error")}finally{w(!1)}}}async function De(a){var s;F(null),w(!0);try{const b=await(await fetch(v("/api/auth/email/verify"),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({email:T,code:a,purpose:"signup"})})).json();if(!b.ok||!b.sessionToken){h(b.message||(t?"קוד שגוי":"Invalid code"));return}if(Pe){const M=await((s=z.currentUser)==null?void 0:s.getIdToken(!0)),V=await(await fetch(v("/api/auth/verify-signup-email"),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({idToken:M,sessionToken:b.sessionToken})})).json();if(!V.ok){h(V.error||(t?"אימות האימייל נכשל":"Email verification failed"));return}await B();return}const G=await(await fetch(v("/api/auth/email-session"),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({sessionToken:b.sessionToken,dateOfBirth:q})})).json();if(G.customToken){const ae=await(await xe(z,G.customToken)).user.getIdToken(!0);await fetch(v("/api/auth/session"),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({idToken:ae})}),await B();return}h(t?"האימות נכשל":"Verification failed")}catch(l){I.error("[signup] verifyEmailCode",l),h(t?"האימות נכשל":"Verification failed")}finally{w(!1)}}async function X(a){if(!f){h(t?"יש לאשר את התנאים ומדיניות הפרטיות וגיל 18+":"Please accept the Terms and Privacy Policy and confirm you are 18+ to continue.");return}F(null),w(!0);try{if(et()&&(a==="google"||a==="apple")){const M=await(a==="google"?await tt(z):await at(z)).user.getIdToken(!0);if(!(await fetch(v("/api/auth/session"),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({idToken:M})})).ok){const V=a==="google"?"Google":"Apple";h(t?`התחברות ${V} לא הושלמה — נסה שוב`:`${V} sign-in could not be completed. Please try again.`);return}await B();return}const s=a==="google"?it():a==="apple"?nt():st();if(rt()==="redirect"){zt(a),await Tt(),await Xe(z,s);return}const b=await(await Ze(z,s)).user.getIdToken(!0);if(!(await fetch(v("/api/auth/session"),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({idToken:b})})).ok){const G=a==="google"?"Google":a==="apple"?"Apple":"Facebook";h(t?`התחברות ${G} לא הושלמה — נסה שוב`:`${G} sign-in could not be completed. Please try again.`);return}await B()}catch(s){if((s==null?void 0:s.code)==="auth/popup-closed-by-user")return;I.error("[signup] social",s);const l=a==="google"?"Google":a==="apple"?"Apple":"Facebook";h(t?`התחברות ${l} לא הושלמה — נסה נייד או אימייל`:`${l} sign-in did not complete. Please try mobile or email.`)}finally{w(!1)}}async function Oe(a){if(!f){h(t?"יש לאשר את התנאים ומדיניות הפרטיות וגיל 18+":"Please accept the Terms and Privacy Policy and confirm you are 18+ to continue.");return}F(null),w(!0);try{const l=await(await fetch(v(`/api/auth/social/${a}/authorize`),{credentials:"include"})).json().catch(()=>({}));if(l!=null&&l.authUrl){window.location.href=l.authUrl;return}const b=a==="instagram"?"Instagram":"TikTok";h(t?`${b} עדיין לא פעיל — נסה Google, נייד או אימייל`:`${b} sign-in is not active yet — please try Google, mobile or email.`)}catch(s){I.error("[signup] socialExternal",s),h(t?"שגיאת רשת":"Network error")}finally{w(!1)}}const Z=/\S+@\S+\.\S+/.test(T),pe=L.replace(/\D/g,"").length>6,ee=/^\d{4}-\d{2}-\d{2}$/.test(q),ce=(()=>{if(!ee)return-1;const a=new Date(q+"T00:00:00"),s=new Date;let l=s.getFullYear()-a.getFullYear();const b=s.getMonth()-a.getMonth();return(b<0||b===0&&s.getDate()<a.getDate())&&l--,l})()>=18,te=!S&&pe&&Z&&ce,Le=S?"…":t?"המשך":"Continue";function Ge(){pe?(C("mobile"),_e()):Z&&(C("email"),Fe())}const o={eyebrow:t?"אקוסיסטם חכם לטיפול בחיות מחמד":"INTELLIGENT PET-CARE ECOSYSTEM",h1a:t?"העתיד של":"The Future of",h1b:t?"חיי חיות המחמד":"Pet Lifestyle",sub1:t?"שמונה פלטפורמות מהפכניות.":"Eight Revolutionary Platforms.",sub2:t?"אקוסיסטם חכם אחד לטיפול בחיות מחמד.":"One Intelligent Pet-Care Ecosystem.",premium:t?"חוויית פרמיום":"PREMIUM EXPERIENCE",premiumSub:t?"חכם. מאובטח. חלק.":"Intelligent. Secure. Seamless.",badges:t?[{t:"טיפול חכם בכוח AI",I:he},{t:"תגמולי VIP",I:ne},{t:"הזמנה חכמה",I:ge},{t:"מעקב בריאות",I:ue}]:[{t:"AI Powered Pet Care",I:he},{t:"VIP Rewards",I:ne},{t:"Smart Booking",I:ge},{t:"Health Tracking",I:ue}],trusted:t?"נפתחים בקרוב בכפר סבא":"Opening soon in Kfar Saba",rating:t?"טיפול טבעי פרימיום · מותג ישראלי":"Premium natural care · Israeli brand",secure:t?"מאובטח · פרטי · מוצפן":"SECURE · PRIVATE · ENCRYPTED",secureSub:t?"הנתונים שלך מוגנים ומוצפנים.":"Your data is protected and encrypted.",create:t?"צור את חשבון PetWash שלך":"Create your PetWash account",helper:t?"הצטרף ל־PetWash Prestige וקבל 5% תגמול על כל רחיצה זכאית במכונת K9000.":"Join PetWash Prestige and earn 5% rewards on every eligible K9000 wash.",cwGoogle:t?"המשך עם Google":"Continue with Google",cwApple:t?"המשך עם Apple":"Continue with Apple",cwFb:t?"המשך עם Facebook":"Continue with Facebook",cwIg:t?"המשך עם Instagram":"Continue with Instagram",or:t?"או הירשם עם":"or sign up with",phoneLabel:t?"מספר נייד":"Mobile Number",emailPh:"name@email.com",emailLabel:t?"אימייל":"Email",completeFields:t?"יש להזין נייד, אימייל ותאריך לידה (18+), ולאשר את התנאים.":"Enter mobile, email and date of birth (18+), and accept the terms.",bank:t?"מאובטח ומוצפן":"Secure & encrypted",enc:t?"הצפנת 256-bit":"256-bit encryption",safe:t?"הנתונים שלך בטוחים":"Your data is safe",dlTitle:t?"הורד את האפליקציה שלנו":"Download Our App",dlSub:t?"גש לכל הפיצ׳רים בנייד":"Access all features on the go",storeApple:"App Store",storeAppleLine:t?"הורד מ-":"Download on the",storeGoogle:"Google Play",storeGoogleLine:"GET IT ON",comingSoon:t?"בקרוב":"Coming soon"};return e.jsxs("div",{id:"petwash-signup-page",className:"sl-shell",dir:t?"rtl":"ltr",children:[e.jsx("style",{children:Dt(t)}),e.jsxs("div",{className:"sl-frame",children:[e.jsxs("aside",{className:"sl-hero",children:[e.jsxs("header",{className:"sl-heroHead",children:[e.jsx("img",{src:"/brand/petwash-logo-white-tight.png",alt:"PetWash",className:"sl-logo",width:365,height:123,decoding:"async"}),e.jsx("div",{className:"sl-eyebrow",children:o.eyebrow})]}),e.jsxs("h1",{className:"sl-h1",children:[o.h1a,e.jsx("br",{}),e.jsx("span",{className:"sl-gold",children:o.h1b})]}),e.jsxs("p",{className:"sl-sub",children:[o.sub1,e.jsx("br",{}),o.sub2]}),e.jsxs("div",{className:"sl-divPaw","aria-hidden":!0,children:[e.jsx("span",{}),e.jsx(ie,{}),e.jsx("span",{})]}),e.jsx("div",{className:"sl-dogWrap",children:e.jsx("img",{src:"/brand/hero-dog-lux.jpg",alt:"",className:"sl-dog",loading:"eager",decoding:"async","aria-hidden":!0})}),e.jsxs("section",{className:"sl-card",children:[e.jsxs("div",{className:"sl-cardHead",children:[e.jsx("div",{className:"sl-cardTitle",children:o.premium}),e.jsx("div",{className:"sl-cardSub",children:o.premiumSub})]}),e.jsx("div",{className:"sl-badges",children:o.badges.map(({t:a,I:s})=>e.jsxs("div",{className:"sl-badge",children:[e.jsx(s,{className:"sl-badgeIcon","aria-hidden":!0}),e.jsx("span",{children:a})]},a))})]}),e.jsxs("section",{className:"sl-card sl-trustCard",children:[e.jsx("div",{className:"sl-cardTitle",children:o.trusted}),e.jsx("div",{className:"sl-ratingTxt",children:o.rating})]}),e.jsxs("div",{className:"sl-secBadge",children:[e.jsx(W,{"aria-hidden":!0}),e.jsxs("div",{children:[e.jsx("div",{className:"sl-secBadgeTitle",children:o.secure}),e.jsx("div",{className:"sl-secBadgeSub",children:o.secureSub})]})]})]}),e.jsxs("main",{className:"sl-panel",role:"main",children:[e.jsxs("header",{className:"sl-panelHead",children:[e.jsxs("div",{children:[e.jsx("h2",{className:"sl-title",children:o.create}),e.jsx("p",{className:"sl-helper",children:o.helper})]}),n&&e.jsxs("button",{type:"button",className:"sl-lang",onClick:()=>n(t?"en":"he"),"aria-label":"Switch language",children:["🌐 ",t?"עברית":"English"," ▾"]})]}),re&&e.jsx("p",{className:"sl-inlineError",role:"alert",children:re}),!$&&e.jsxs(e.Fragment,{children:[Ee&&e.jsxs(e.Fragment,{children:[e.jsxs("button",{type:"button",className:"sl-bio",disabled:S,onClick:ze,children:[e.jsx(qe,{"aria-hidden":!0})," ",t?`התחברות עם ${le}`:`Sign in with ${le}`]}),e.jsx("div",{className:"sl-div",children:t?"או הצטרפו לחשבון חדש":"or create a new account"})]}),e.jsxs("div",{className:"sl-intent",children:[e.jsx("div",{className:"sl-intentQ",children:t?"איך תרצו להצטרף?":"How would you like to join?"}),e.jsxs("div",{className:"sl-intentGrid",children:[e.jsxs("div",{className:"sl-intentCard sl-intentCard--on",children:[e.jsx(ne,{className:"sl-intentIcon","aria-hidden":!0}),e.jsxs("div",{className:"sl-intentText",children:[e.jsx("div",{className:"sl-intentName",children:t?"חבר/ת PetWash Prestige":"PetWash Prestige member"}),e.jsx("div",{className:"sl-intentSub",children:t?"תגמולי VIP · 5% על כל רחיצת K9000":"VIP rewards · 5% on every K9000 wash"})]}),e.jsx("span",{className:"sl-intentTick","aria-hidden":!0,children:"✓"})]}),e.jsxs("button",{type:"button",className:`sl-intentCard${O?" sl-intentCard--on":""}`,"aria-pressed":O,onClick:Q,children:[e.jsx(ie,{className:"sl-intentIcon","aria-hidden":!0}),e.jsxs("div",{className:"sl-intentText",children:[e.jsx("div",{className:"sl-intentName",children:t?"להפוך לספק/ית":"Become a provider"}),e.jsx("div",{className:"sl-intentSub",children:t?"בכפוף לתנאים ואישור":"Conditions apply · approval required"})]}),e.jsx("span",{className:O?"sl-intentTick":"sl-intentAdd","aria-hidden":!0,children:O?"✓":"+"})]})]}),e.jsx("div",{className:"sl-intentHint",children:t?"אפשר גם וגם — תמיד תהיו חברים, וגם ספקים אם תבחרו.":"Either or both — you’re always a member, and a provider too if you choose."})]}),e.jsxs("div",{className:"sl-field",children:[e.jsx("label",{className:"sl-label",children:t?"תאריך לידה · גיל 18 ומעלה":"Date of birth · 18+"}),e.jsx(mt,{value:q||`${new Date().getFullYear()-25}-06-15`,onChange:Ie,minYear:new Date().getFullYear()-100,maxYear:new Date().getFullYear()-18,monthNames:t?["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"]:void 0,dayLabel:t?"יום":"Day",monthLabel:t?"חודש":"Month",yearLabel:t?"שנה":"Year"}),!ee&&e.jsx("div",{className:"sl-hint",children:t?"גללו לבחירת תאריך הלידה.":"Scroll to set your date of birth."}),ee&&!ce&&e.jsx("div",{className:"sl-hint sl-submitHint",children:t?"יש להיות בגיל 18 ומעלה.":"You must be 18 or older."})]}),E.smsFallbackAndRealErrors&&!Se&&e.jsx("p",{className:"sl-inlineError",role:"status",children:t?"SMS אינו זמין כעת — אפשר להמשיך עם אימייל למטה.":"SMS is temporarily unavailable — continue with email below."}),e.jsxs("div",{className:"sl-field",children:[e.jsx("label",{className:"sl-label",children:o.phoneLabel}),e.jsx(ct,{value:L,onChange:ke,language:i,defaultCountry:"IL"})]}),E.emailPassword&&e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"sl-div",children:t?"וגם":"and"}),e.jsxs("div",{className:"sl-field",children:[e.jsx("label",{className:"sl-label",children:o.emailLabel}),e.jsxs("div",{className:"sl-inputWrap",children:[e.jsx(Ve,{className:"sl-inputIcon","aria-hidden":!0}),e.jsx("input",{className:"sl-input sl-input--icon",type:"email",inputMode:"email",autoComplete:"username email webauthn",autoCapitalize:"off",autoCorrect:"off",spellCheck:!1,value:T,onChange:a=>Ne(a.target.value),placeholder:o.emailPh})]}),e.jsx("div",{className:"sl-hint",children:t?"Gmail, Hotmail, Yahoo או כל כתובת אימייל":"Gmail, Hotmail, Yahoo or any email works"})]})]})]}),x==="mobile"&&$&&e.jsxs(e.Fragment,{children:[e.jsx("p",{className:"sl-helper sl-center",children:t?`הזן את הקוד שנשלח ל-${L}`:`Enter the code sent to ${L}`}),e.jsx(ve,{length:6,onComplete:a=>{Re(a)},loading:S,language:t?"he":"en"}),e.jsx("button",{className:"sl-btn",disabled:S,onClick:()=>U(!1),children:t?"שלח קוד חדש":"Resend code"})]}),x==="email"&&$&&e.jsxs(e.Fragment,{children:[e.jsx("p",{className:"sl-helper sl-center",children:t?`הזן את הקוד שנשלח ל-${T}`:`Enter the code sent to ${T}`}),e.jsx(ve,{length:6,onComplete:a=>{De(a)},loading:S,language:t?"he":"en"}),e.jsx("button",{className:"sl-btn",disabled:S,onClick:()=>U(!1),children:t?"שלח קוד חדש":"Resend code"})]}),!$&&e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"sl-consent",dir:t?"rtl":"ltr",style:{margin:"14px 0 6px",fontSize:"13px",lineHeight:1.6,textAlign:t?"right":"left"},children:[e.jsxs("label",{style:{display:"flex",gap:"8px",alignItems:"flex-start",cursor:"pointer"},children:[e.jsx("input",{type:"checkbox",checked:A,onChange:a=>J(a.target.checked),style:{marginTop:"2px",width:"20px",height:"20px",flexShrink:0,accentColor:"#E6C766"}}),e.jsxs("span",{children:[t?"אני מסכים/ה ל":"I agree to the ",e.jsx("a",{href:"/terms",target:"_blank",rel:"noopener noreferrer",style:{textDecoration:"underline",color:"inherit"},children:t?"תנאי השימוש":"Terms of Service"}),t?" ול":" and ",e.jsx("a",{href:"/privacy",target:"_blank",rel:"noopener noreferrer",style:{textDecoration:"underline",color:"inherit"},children:t?"מדיניות הפרטיות":"Privacy Policy"})]})]}),e.jsxs("label",{style:{display:"flex",gap:"8px",alignItems:"flex-start",cursor:"pointer",marginTop:"8px"},children:[e.jsx("input",{type:"checkbox",checked:N,onChange:a=>R(a.target.checked),style:{marginTop:"2px",width:"20px",height:"20px",flexShrink:0,accentColor:"#E6C766"}}),e.jsx("span",{children:t?"אני מאשר/ת שאני בן/בת 18 ומעלה":"I confirm I am 18 years or older"})]})]}),e.jsxs("button",{className:"sl-cta",disabled:!te||!f,onClick:Ge,children:[e.jsx(me,{"aria-hidden":!0})," ",Le]}),!te&&e.jsx("div",{className:"sl-hint sl-submitHint",children:o.completeFields}),te&&!f&&e.jsx("div",{className:"sl-hint sl-submitHint",children:t?"יש לאשר את התנאים וגיל 18+":"Please accept the terms and confirm you are 18+"}),e.jsxs("div",{className:"sl-bank",children:[e.jsx(W,{"aria-hidden":!0})," ",e.jsx("span",{children:o.bank}),e.jsx("span",{"aria-hidden":!0,children:" · "}),e.jsx("span",{children:o.enc}),e.jsx("span",{"aria-hidden":!0,children:" · "}),e.jsx("span",{children:o.safe})]}),e.jsxs("div",{className:"sl-secRow","aria-label":t?"אבטחה מתקדמת 2026":"2026 advanced security",children:[e.jsx("div",{className:"sl-secTitle",children:t?"אבטחה מתקדמת 2026":"2026 ADVANCED SECURITY"}),e.jsxs("div",{className:"sl-secItems",children:[e.jsxs("span",{className:"sl-secItem",children:[e.jsx(W,{"aria-hidden":!0})," ",t?"מוכן ל-Passkey":"Passkey ready"]}),e.jsxs("span",{className:"sl-secItem",children:[e.jsx(W,{"aria-hidden":!0})," ",t?"הגנת בוטים":"Bot protection"]}),e.jsxs("span",{className:"sl-secItem",children:[e.jsx(me,{"aria-hidden":!0})," ",t?"אימות OTP":"OTP verification"]})]})]}),e.jsx("div",{className:"sl-div",children:o.or}),e.jsxs("div",{className:"sl-social4",children:[E.googleSignin&&e.jsxs("button",{className:"sl-soc",disabled:S||!f,onClick:()=>X("google"),children:[e.jsx(Rt,{})," ",e.jsx("span",{className:"sl-socLabel",children:o.cwGoogle})]}),E.appleSignin&&e.jsxs("button",{className:"sl-soc sl-soc--apple",disabled:S||!f,onClick:()=>X("apple"),children:[e.jsx($e,{"aria-hidden":!0})," ",e.jsx("span",{className:"sl-socLabel",children:o.cwApple})]}),E.facebookSignin&&e.jsxs("button",{className:"sl-soc sl-soc--fb",disabled:S||!f,onClick:()=>X("facebook"),children:[e.jsx("span",{className:"sl-fbIcon","aria-hidden":!0,children:e.jsx(We,{})}),e.jsx("span",{className:"sl-socLabel",children:o.cwFb})]}),E.instagramSignin&&e.jsxs("button",{className:"sl-soc sl-soc--ig",disabled:S||!f,onClick:()=>Oe("instagram"),children:[e.jsx("span",{className:"sl-igIcon","aria-hidden":!0,children:e.jsx(Ye,{})}),e.jsx("span",{className:"sl-socLabel",children:o.cwIg})]})]})]})]})]}),e.jsxs("section",{className:"sl-dl",children:[e.jsxs("div",{className:"sl-dlLeft",children:[e.jsx("span",{className:"sl-dlPaw","aria-hidden":!0,children:e.jsx(ie,{})}),e.jsxs("div",{children:[e.jsx("div",{className:"sl-dlTitle",children:o.dlTitle}),e.jsx("div",{className:"sl-dlSub",children:o.dlSub})]})]}),e.jsxs("div",{className:"sl-dlRight",children:[e.jsxs("span",{className:"sl-store","aria-disabled":"true",style:{cursor:"not-allowed",opacity:.6},title:o.comingSoon??"בקרוב",children:[e.jsx(Je,{"aria-hidden":!0}),e.jsxs("span",{children:[e.jsx("small",{children:o.storeAppleLine}),e.jsx("strong",{children:o.storeApple})]})]}),e.jsxs("span",{className:"sl-store","aria-disabled":"true",style:{cursor:"not-allowed",opacity:.6},title:o.comingSoon??"בקרוב",children:[e.jsx(Ke,{"aria-hidden":!0}),e.jsxs("span",{children:[e.jsx("small",{children:o.storeGoogleLine}),e.jsx("strong",{children:o.storeGoogle})]})]}),e.jsx("div",{className:"sl-qr","aria-hidden":!0,children:e.jsx(Ft,{})})]})]})]})}function Rt(){return e.jsxs("svg",{className:"sl-gIcon",viewBox:"0 0 48 48","aria-hidden":!0,children:[e.jsx("path",{fill:"#EA4335",d:"M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"}),e.jsx("path",{fill:"#4285F4",d:"M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"}),e.jsx("path",{fill:"#FBBC05",d:"M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"}),e.jsx("path",{fill:"#34A853",d:"M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"})]})}function Ft(){const i=["1111111011111110","1000001011001010","1011101010111010","1011101011010110","1011101011001010","1000001010100110","1111111010101010","0000000010111100","1100110110010010","1011011000111110","0010011011000110","0001110110111010","1111111011010010","1000001011111010","1011101010001100","1011101011100110"];return e.jsxs("svg",{className:"sl-qrSvg",viewBox:"0 0 16 16",role:"img","aria-label":"QR code",children:[e.jsx("rect",{width:"16",height:"16",fill:"#fffaf0"}),i.map((n,r)=>n.split("").map((u,t)=>u==="1"?e.jsx("rect",{x:t,y:r,width:"1",height:"1",fill:"#0a0a0a"},`${t}-${r}`):null))]})}function Dt(i){return`
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
      --gold:#D4AF37; --gold2:#E6C766; --gold3:#B8932F; --white:#fffaf0;
      --muted:rgba(255,250,240,.6); --line:rgba(255,255,255,.10);
      /* Field/box edges: FRESH BRIGHT gold thin line (CEO 2026-07-02 — the old
         .22 alpha over black read as rust/brown). gold2 = the bright champagne. */
      --line2:rgba(230,199,102,.50); --ink:#0a0a0a;
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
    .sl-divPaw span{ height:1px; background:linear-gradient(90deg, transparent, rgba(212,175,55,.45), transparent); flex:1 }
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
    .sl-avatars{ display:flex; align-items:center; ${i?"gap:6px":"gap:0"}; justify-content:center; flex-wrap:wrap }
    .sl-avatar{
      width:34px; height:34px; border-radius:50%;
      display:inline-flex; align-items:center; justify-content:center;
      color:#fff; font-weight:900; font-size:11px;
      border:2px solid #0a0a0a; box-shadow:0 4px 12px rgba(0,0,0,.5);
      margin-${i?"right":"left"}:-8px;
    }
    .sl-avatar:first-child{ margin-${i?"right":"left"}:0 }
    .sl-avatarMore{
      margin-${i?"right":"left"}:10px; padding:5px 10px; border-radius:999px;
      background:linear-gradient(135deg, var(--gold2), var(--gold));
      color:#0a0a0a; font-weight:900; font-size:11px;
    }
    .sl-stars{ color:var(--gold2); font-size:18px; letter-spacing:4px; text-shadow:0 0 12px rgba(212,175,55,.5) }
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
    .sl-lang:hover{ border-color:rgba(212,175,55,.5) }

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
    .sl-soc:hover:not(:disabled){ transform:translateY(-1px); border-color:rgba(212,175,55,.55); box-shadow:0 0 0 3px rgba(212,175,55,.12) }
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

    /* Intent selector — full-width, fills the form on every size: 1 column on a
       small iPhone, 2 columns once there is room. No dead space, same on tablet. */
    .sl-intent{ display:flex; flex-direction:column; gap:8px; width:100%; margin-bottom:2px }
    .sl-intentQ{ color:var(--white); font-size:13px; font-weight:800; opacity:.92 }
    /* Always one column: full-width cards read the same on a small iPhone and a
       big tablet, use 100% of the form width, and never cramp/wrap the card text. */
    .sl-intentGrid{ display:grid; grid-template-columns:1fr; gap:10px; width:100% }

    /* Face ID / Touch ID passkey button — white-on-dark secondary, gold-tinted. */
    .sl-bio{ display:flex; align-items:center; justify-content:center; gap:10px; width:100%;
      min-height:56px; border-radius:12px; box-sizing:border-box; cursor:pointer; appearance:none;
      -webkit-appearance:none; font-size:15px; font-weight:700;
      background:rgba(212,175,55,.04); border:1px solid var(--gold2); color:var(--white);
      transition:background .2s, filter .15s }
    .sl-bio:hover:not(:disabled){ background:rgba(212,175,55,.10); filter:brightness(1.04) }
    .sl-bio:disabled{ opacity:.5; cursor:not-allowed }
    .sl-bio svg{ color:var(--gold2); font-size:18px }
    .sl-intentCard{ display:flex; align-items:center; gap:10px; width:100%; text-align:start;
      min-height:64px; padding:12px 14px; border-radius:14px; box-sizing:border-box;
      background:rgba(255,255,255,.04); border:1px solid var(--line); color:var(--white);
      cursor:pointer; appearance:none; -webkit-appearance:none; transition:border-color .2s, background .2s }
    .sl-intentCard--on{ border-color:var(--gold2); background:rgba(212,175,55,.05); box-shadow:0 0 0 1px rgba(230,199,102,.25) }
    .sl-intentIcon{ color:var(--gold2); font-size:20px; flex-shrink:0 }
    .sl-intentText{ flex:1; min-width:0 }
    .sl-intentName{ font-size:14px; font-weight:700; line-height:1.2 }
    .sl-intentSub{ font-size:12px; color:var(--muted); line-height:1.35 }
    .sl-intentTick{ color:var(--gold2); font-size:18px; font-weight:900; flex-shrink:0 }
    .sl-intentAdd{ color:var(--muted); font-size:22px; font-weight:700; flex-shrink:0; line-height:1 }
    .sl-intentHint{ font-size:11.5px; color:var(--muted); line-height:1.4 }

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
    .sl-tab[aria-selected="true"]{ background:rgba(212,175,55,.05); border-color:var(--line2); color:var(--white) }
    .sl-tab:hover{ border-color:rgba(230,199,102,.4) }

    /* Fields */
    .sl-field{ display:grid; gap:8px }
    .sl-label{ font-size:13.5px; color:var(--white); font-weight:700; letter-spacing:.01em }
    .sl-labelWithInfo{ display:flex; align-items:center; gap:6px }
    .sl-infoIcon{ color:var(--muted); font-size:12px }
    .sl-inputWrap{ position:relative; display:flex }
    .sl-inputIcon{
      position:absolute; top:50%; transform:translateY(-50%);
      ${i?"right:14px":"left:14px"}; color:var(--muted); font-size:16px; pointer-events:none;
    }
    .sl-input{
      width:100%; min-height:54px; border-radius:12px;
      border:1px solid var(--line2); background:rgba(0,0,0,.55);
      color:var(--white); font-size:16px; font-weight:500;
      padding:0 16px; outline:none;
      transition:border-color .15s ease, box-shadow .15s ease;
    }
    .sl-input--icon{ ${i?"padding-right:42px; padding-left:16px":"padding-left:42px; padding-right:16px"} }
    .sl-input::placeholder{ color:rgba(255,250,240,.4); font-weight:400 }
    .sl-input:focus{ border-color:rgba(212,175,55,.55); box-shadow:0 0 0 3px rgba(212,175,55,.18) }
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
      border-color:var(--line2) !important;
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
      border:1px solid rgba(212,175,55,.24);
      border-radius:14px;
      background:rgba(212,175,55,.06);
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
      box-shadow:0 18px 50px rgba(212,175,55,.28);
      transition:transform .15s ease, box-shadow .15s ease, filter .15s ease;
      -webkit-tap-highlight-color:transparent;
    }
    .sl-cta:hover:not(:disabled){ transform:translateY(-1px); filter:brightness(1.06); box-shadow:0 22px 64px rgba(212,175,55,.5) }
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

    /* 2026 Advanced Security trust row */
    .sl-secRow{
      margin-top:12px; padding:10px 12px; border:1px solid rgba(212,175,55,.22);
      border-radius:12px; background:rgba(212,175,55,.04);
    }
    .sl-secTitle{
      text-align:center; font-size:10px; letter-spacing:.18em; text-transform:uppercase;
      color:var(--gold2); margin-bottom:6px;
    }
    .sl-secItems{ display:flex; align-items:center; justify-content:center; gap:14px; flex-wrap:wrap }
    .sl-secItem{ display:inline-flex; align-items:center; gap:5px; font-size:11.5px; color:var(--muted) }
    .sl-secItem svg{ color:var(--gold2); font-size:12px }

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
    .sl-store:hover{ border-color:rgba(212,175,55,.4); box-shadow:0 0 0 3px rgba(212,175,55,.1) }
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
        border-color:var(--line2) !important;
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
  `}export{ra as default};
