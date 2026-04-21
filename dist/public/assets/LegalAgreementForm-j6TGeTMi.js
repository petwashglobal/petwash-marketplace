import{k as R,r as i,j as e}from"./vendor-react-Ch-B_epf.js";import{M as w,a as j,b as x,c as n,d as m,e as M,f as b}from"./MobileFormShell-Dy5XW81y.js";import{u as D,a as L}from"./App-C8n_vkqv.js";import{bz as O,c as H,O as G}from"./vendor-ui-CXymklqR.js";import"./vendor-i18n-BnqEsHlA.js";import"./index-CxhyN_ak.js";import"./firebase-CmeULmoJ.js";import"./vendor-firebase-CN_QjCL2.js";import"./apiConfig-Bk47H2Vy.js";import"./vendor-query-T5l4y54Q.js";import"./card-DQssqFjR.js";const S=[{id:"terms-of-service",title:"Terms of Service",titleHe:"תנאי שימוש",version:"v4.2 – March 2026",description:"General terms governing use of all PetWash™ platforms",content:`PETWASH™ TERMS OF SERVICE – VERSION 4.2 (MARCH 2026)

1. PARTIES
These Terms of Service ("Agreement") are entered into between PetWash™ Ltd., company registration number 515234567, registered in Israel ("PetWash", "we", "us"), and the user ("you", "User").

2. SERVICES
PetWash™ operates the following platforms: K9000 automated pet wash stations, Sitter Suite, Walk My Pet, PetTrek, Academy, and Plush Lab. By using any of our platforms, you agree to these terms.

3. ELIGIBILITY
You must be at least 18 years old to use our services. By accepting, you represent that you meet this requirement.

4. PAYMENT & VAT
All prices include VAT at the current Israeli rate (18% as of 2026). Payments are processed via secure PCI-DSS compliant gateways. Refunds are processed within 3–7 business days.

5. PET SAFETY
You are responsible for ensuring your pet is healthy and fit for the requested service. PetWash™ reserves the right to refuse service if a pet displays signs of illness, aggression, or other conditions that may compromise safety.

6. CANCELLATION POLICY
Free cancellation up to 2 hours before scheduled service. Late cancellations may incur a fee of 50% of the service price.

7. LIABILITY
PetWash™ carries full commercial liability insurance. In the event of an incident, please contact us immediately at support@petwash.co.il.

8. DATA PROTECTION
Your personal data is processed in accordance with Israeli Privacy Protection Law 5742-1981 and GDPR principles. See our Privacy Policy at petwash.co.il/privacy-policy.

9. GOVERNING LAW
This agreement is governed by the laws of the State of Israel. Disputes shall be resolved in Tel Aviv courts.

10. CONTACT
PetWash™ Ltd. | 1 Rothschild Blvd, Tel Aviv 6688101 | support@petwash.co.il | 1-800-PETWASH`},{id:"provider-agreement",title:"Provider Service Agreement",titleHe:"הסכם ספק שירות",version:"v3.1 – March 2026",description:"Agreement for service providers on all PetWash™ platforms",content:`PETWASH™ PROVIDER SERVICE AGREEMENT – VERSION 3.1

1. ENGAGEMENT
This agreement governs the independent contractor relationship between PetWash™ Ltd. and the Provider. The Provider is not an employee of PetWash™.

2. COMMISSION STRUCTURE
PetWash™ retains a platform commission of 15–25% depending on the service tier. Providers receive payment within 3 business days of service completion.

3. STANDARDS OF SERVICE
All providers must maintain a minimum rating of 4.2 stars. Providers are required to comply with all animal welfare laws in force in Israel.

4. BACKGROUND VERIFICATION
All providers consent to identity verification and background checks. False information will result in immediate suspension.

5. INSURANCE
Providers are required to maintain professional liability insurance with a minimum coverage of ₪500,000.

6. INTELLECTUAL PROPERTY
PetWash™ retains all rights to its brand, marks, and platform content. Providers may not use the PetWash™ brand independently.

7. TERMINATION
Either party may terminate this agreement with 14 days written notice. PetWash™ may terminate immediately for breach of conduct standards.`},{id:"club-membership",title:"Club Membership Agreement",titleHe:"הסכם חברות במועדון",version:"v2.0 – March 2026",description:"Terms for Prestige Club Gold, Platinum, and Diamond members",content:`PETWASH™ PRESTIGE CLUB MEMBERSHIP AGREEMENT – VERSION 2.0

1. MEMBERSHIP TIERS
Gold: ₪89/month | Platinum: ₪149/month | Diamond: ₪249/month
All prices include VAT 18%.

2. BENEFITS
Club benefits are non-transferable and apply to one registered pet per membership.

3. BILLING
Membership fees are billed monthly by automatic credit card charge. You may cancel at any time with 30 days notice.

4. REFUND POLICY
Monthly fees are non-refundable after the 14-day cooling-off period. Unused wash credits roll over for one month.

5. SUSPENSION
PetWash™ reserves the right to suspend a membership for violation of our Terms of Service.`},{id:"data-processing",title:"Data Processing Agreement",titleHe:"הסכם עיבוד נתונים",version:"v1.5 – March 2026",description:"GDPR & Israeli Privacy Law DPA for business customers",content:`PETWASH™ DATA PROCESSING AGREEMENT – VERSION 1.5

This Data Processing Agreement ("DPA") applies to the processing of personal data by PetWash™ on behalf of business customers ("Controller").

1. ROLES
PetWash™ acts as Data Processor. The business customer acts as Data Controller.

2. DATA CATEGORIES
Personal data processed includes: name, email, phone, address, payment data, and pet health information.

3. LEGAL BASIS
Processing is conducted under consent (Art. 6(1)(a) GDPR) and contractual necessity (Art. 6(1)(b) GDPR).

4. SECURITY MEASURES
AES-256 encryption at rest, TLS 1.3 in transit, access controls, audit logging, and annual penetration testing.

5. SUB-PROCESSORS
Approved sub-processors: Google Cloud Platform (Firebase, Cloud Run), SendGrid, Stripe, Twilio.

6. DATA RETENTION
Personal data is retained for 7 years to comply with Israeli tax law, then securely deleted.

7. RIGHTS
Data subjects may exercise rights of access, correction, deletion, and portability at privacy@petwash.co.il.`}],B=["Customer / Individual","HR & Employment","Legal & Compliance","Finance & Accounting","Operations","Marketing","Technology","Provider Relations"];function Q(){const{toast:h}=D(),[,v]=R(),[l,p]=i.useState(1),[y,u]=i.useState(!1),[g,E]=i.useState(""),A=i.useRef(null),[o,N]=i.useState(""),[c,f]=i.useState(!1),[s,P]=i.useState({fullName:"",idNumber:"",email:"",department:"",representingCompany:"",companyRegNumber:"",accepted:!1}),r=(t,d)=>P(C=>({...C,[t]:d})),a=S.find(t=>t.id===o),T=t=>{const d=t.currentTarget;d.scrollHeight-d.scrollTop<=d.clientHeight+60&&f(!0)},I=async()=>{if(!s.fullName||!s.idNumber||!s.email){h({variant:"destructive",title:"Name, ID and email are required"});return}if(!s.accepted){h({variant:"destructive",title:"You must read and accept the agreement"});return}u(!0);try{const t=await L("POST","/api/global-forms/legal-agreement",{...s,agreementId:o,agreementTitle:a==null?void 0:a.title,agreementVersion:a==null?void 0:a.version,signedAt:new Date().toISOString()});E((t==null?void 0:t.signatureId)||`SIG-${Date.now().toString(36).toUpperCase()}`)}catch{h({variant:"destructive",title:"Submission failed",description:"Contact legal@petwash.co.il"})}finally{u(!1)}};return g?e.jsx(w,{emoji:"✍️",title:"Agreement Signed",titleHe:"ההסכם נחתם",message:"A signed copy has been sent to your email. This acceptance is legally binding.",messageHe:"עותק חתום נשלח לאימייל שלך",refId:g,refLabel:"Signature ID",onDone:()=>v("/")}):e.jsxs(j,{emoji:"📜",title:"Legal Agreements",titleHe:"הסכמים משפטיים",subtitle:"Digital signing — legally binding under Israeli law",step:l,totalSteps:2,onBack:l>1?()=>{p(1),f(!1)}:void 0,footer:l===1?e.jsx(b,{onClick:()=>{if(!o){h({variant:"destructive",title:"Select an agreement"});return}p(2)},children:"Read & Sign →"}):e.jsx(b,{onClick:I,loading:y,disabled:!c||!s.accepted,children:c?"✍️ Sign Agreement":"Scroll to read full agreement ↓"}),children:[l===1&&e.jsxs(e.Fragment,{children:[e.jsx(x,{title:"Select Agreement",titleHe:"בחר הסכם",children:e.jsx("div",{className:"space-y-2",children:S.map(t=>e.jsxs("label",{className:`flex gap-3 p-4 rounded-xl border cursor-pointer transition-all ${o===t.id?"border-[#C6A35B] bg-[#C6A35B]/10":"border-white/8 bg-white/[0.02]"}`,children:[e.jsx("input",{type:"radio",name:"agreement",value:t.id,checked:o===t.id,onChange:()=>N(t.id),className:"mt-0.5 accent-[#C6A35B] w-4 h-4 shrink-0"}),e.jsxs("div",{children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("p",{className:"text-white text-sm font-semibold",children:t.title}),e.jsx("span",{className:"text-white/30 text-xs",children:t.version})]}),e.jsx("p",{className:"text-white/40 text-xs mt-0.5",dir:"rtl",children:t.titleHe}),e.jsx("p",{className:"text-white/35 text-xs mt-1",children:t.description})]})]},t.id))})}),e.jsxs(x,{title:"Your Details",titleHe:"פרטי החותם",children:[e.jsx(n,{label:"Full Legal Name",labelHe:"שם מלא",required:!0,children:e.jsx(m,{value:s.fullName,onChange:t=>r("fullName",t),placeholder:"David Ben Cohen",autoComplete:"name"})}),e.jsx(n,{label:"ID / Passport Number",labelHe:"תעודת זהות",required:!0,children:e.jsx(m,{value:s.idNumber,onChange:t=>r("idNumber",t),inputMode:"numeric",placeholder:"123456789"})}),e.jsx(n,{label:"Email",labelHe:"אימייל",required:!0,children:e.jsx(m,{type:"email",value:s.email,onChange:t=>r("email",t),inputMode:"email",placeholder:"legal@company.co.il"})}),e.jsx(n,{label:"Department / Role",labelHe:"מחלקה / תפקיד",children:e.jsxs(M,{value:s.department,onChange:t=>r("department",t),children:[e.jsx("option",{value:"",children:"Select…"}),B.map(t=>e.jsx("option",{value:t,children:t},t))]})}),e.jsx(n,{label:"Company Name (if applicable)",labelHe:"שם חברה",children:e.jsx(m,{value:s.representingCompany,onChange:t=>r("representingCompany",t),placeholder:"ABC Ltd."})}),e.jsx(n,{label:"Company Reg. No.",labelHe:"מספר חברה",children:e.jsx(m,{value:s.companyRegNumber,onChange:t=>r("companyRegNumber",t),inputMode:"numeric",placeholder:"515000000"})})]})]}),l===2&&a&&e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"flex items-center gap-3 bg-[#C6A35B]/10 border border-[#C6A35B]/30 rounded-2xl p-4",children:[e.jsx(O,{className:"w-6 h-6 text-[#E7C978] shrink-0"}),e.jsxs("div",{children:[e.jsx("p",{className:"text-white font-semibold text-sm",children:a.title}),e.jsxs("p",{className:"text-white/40 text-xs",children:[a.version," · ",a.description]})]})]}),e.jsxs("div",{ref:A,onScroll:T,className:"bg-black/30 border border-white/8 rounded-2xl p-5 h-72 overflow-y-auto text-white/65 text-xs leading-relaxed font-mono whitespace-pre-wrap",children:[a.content,e.jsx("div",{className:"h-12 flex items-center justify-center mt-4",children:c?e.jsxs("div",{className:"flex items-center gap-2 text-green-400 text-xs",children:[e.jsx(H,{className:"w-4 h-4"}),e.jsx("span",{children:"You have read the full agreement"})]}):e.jsx("span",{className:"text-white/25 text-xs",children:"↓ Continue reading…"})})]}),e.jsxs("label",{className:`flex gap-3 items-start p-4 rounded-xl border cursor-pointer transition-all ${c?"border-[#C6A35B]/40 bg-[#C6A35B]/8":"border-white/8 bg-white/[0.02] opacity-50"}`,children:[e.jsx("input",{type:"checkbox",className:"mt-0.5 w-5 h-5 rounded accent-[#C6A35B]",checked:s.accepted,disabled:!c,onChange:t=>r("accepted",t.target.checked)}),e.jsxs("div",{children:[e.jsxs("p",{className:"text-white/80 text-sm font-medium",children:["I have read, understood, and accept this agreement ",e.jsx("span",{className:"text-red-400",children:"*"})]}),e.jsx("p",{className:"text-white/35 text-xs mt-0.5",dir:"rtl",children:"קראתי והבנתי את ההסכם ואני מסכים/ה לתנאיו"}),e.jsxs("p",{className:"text-white/25 text-xs mt-1",children:["Signed electronically as ",s.fullName," · ID ",s.idNumber]})]})]}),e.jsxs("div",{className:"flex items-center gap-2 text-white/25 text-xs px-1",children:[e.jsx(G,{className:"w-4 h-4 shrink-0"}),e.jsx("span",{children:"Electronic signatures are legally binding under the Israeli Electronic Signature Law 5761-2001."})]})]})]})}export{Q as default};
