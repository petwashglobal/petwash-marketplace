import fs from 'fs';
import admin from 'firebase-admin';

const txt = fs.readFileSync('.env','utf8');
const lines = txt.split('\n');
// capture from the key line to end-of-object (brace balance), preserving real newlines
let raw=null;
for(let i=0;i<lines.length;i++){
  const m=lines[i].match(/^FIREBASE_SERVICE_ACCOUNT_KEY=(.*)$/);
  if(!m) continue;
  let val=m[1].replace(/^["']/,'');
  if(val.trimStart().startsWith('{')){
    let buf=val, open=(val.match(/{/g)||[]).length, close=(val.match(/}/g)||[]).length, j=i;
    while(open>close && j+1<lines.length){ j++; buf+='\n'+lines[j]; open+=(lines[j].match(/{/g)||[]).length; close+=(lines[j].match(/}/g)||[]).length; }
    raw=buf.replace(/["']\s*$/,''); break;
  }
}
if(!raw){ console.error('not found'); process.exit(1); }

// State machine: escape real newlines INSIDE strings as \n; turn structural newlines into spaces
let out=''; let inStr=false; let esc=false;
for(const ch of raw){
  if(esc){ out+=ch; esc=false; continue; }
  if(ch==='\\'){ out+=ch; esc=true; continue; }
  if(ch==='"'){ inStr=!inStr; out+=ch; continue; }
  if(ch==='\n'||ch==='\r'){ out+= inStr ? '\\n' : ' '; continue; }
  out+=ch;
}
let cred;
try{ cred=JSON.parse(out); }catch(e){ console.error('parse failed:', e.message); process.exit(1); }
if(cred.private_key && cred.private_key.includes('\\n')) cred.private_key=cred.private_key.replace(/\\n/g,'\n');
admin.initializeApp({ credential: admin.credential.cert(cred) });
console.log('Firebase project:', cred.project_id);

async function show(label,p){
  try{ const u=await p; console.log(`\n${label}:`);
    console.log('  uid       :', u.uid, `(len=${u.uid.length})`);
    console.log('  email     :', u.email, 'verified=', u.emailVerified);
    console.log('  phone     :', u.phoneNumber);
    console.log('  providers :', (u.providerData||[]).map(x=>x.providerId).join(', ')||'(none)');
    console.log('  created   :', u.metadata.creationTime, ' lastSignIn=', u.metadata.lastSignInTime);
    console.log('  claims    :', JSON.stringify(u.customClaims||{}));
  }catch(e){ console.log(`\n${label}: NOT FOUND (${e.code||e.message})`); }
}
await show('by phone +61419773360', admin.auth().getUserByPhoneNumber('+61419773360'));
await show('by email nir.h@petwash.co.il', admin.auth().getUserByEmail('nir.h@petwash.co.il'));
await show('by email nirhadad1@gmail.com', admin.auth().getUserByEmail('nirhadad1@gmail.com'));
await show('orphan uid ll1tn4dpyuNrJ87tq0xSBXyeV7M2', admin.auth().getUser('ll1tn4dpyuNrJ87tq0xSBXyeV7M2'));
process.exit(0);
