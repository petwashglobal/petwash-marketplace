import{A as E,z as b,C as P,_ as R,E as J,a3 as z,W as Y}from"./firebase-B3khMlfs.js";import{a7 as xe,a8 as $e,a9 as Be,aa as He,K as Ue,ab as We,G as Ke,ac as Ge,O as Je,ad as ze,P as Ye,R as Qe,ae as Xe,k as Ze,a0 as et,af as tt,a1 as nt,ag as at,m as rt,n as st,I as ot,ah as it,Y as ct,ai as ut,$ as dt,aj as ft,M as lt,Z as pt,ak as gt,al as ht,D as mt,H as wt,Q as It,a2 as At,am as Tt,g as kt,o as St,N as bt,e as Pt,s as yt,F as Ct,J as Et,u as Rt,v as vt}from"./firebase-B3khMlfs.js";import"./index-DVGWAqPa.js";const v="@firebase/installations",A="0.6.19";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const N=1e4,q=`w:${A}`,_="FIS_v2",Q="https://firebaseinstallations.googleapis.com/v1",X=60*60*1e3,Z="installations",ee="Installations";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const te={"missing-app-config-values":'Missing App configuration value: "{$valueName}"',"not-registered":"Firebase Installation is not registered.","installation-not-found":"Firebase Installation not found.","request-failed":'{$requestName} request failed with error "{$serverCode} {$serverStatus}: {$serverMessage}"',"app-offline":"Could not process request. Application offline.","delete-pending-registration":"Can't delete installation while there is a pending registration request."},f=new J(Z,ee,te);function O(e){return e instanceof Y&&e.code.includes("request-failed")}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function F({projectId:e}){return`${Q}/projects/${e}/installations`}function D(e){return{token:e.token,requestStatus:2,expiresIn:ae(e.expiresIn),creationTime:Date.now()}}async function V(e,t){const a=(await t.json()).error;return f.create("request-failed",{requestName:e,serverCode:a.code,serverMessage:a.message,serverStatus:a.status})}function L({apiKey:e}){return new Headers({"Content-Type":"application/json",Accept:"application/json","x-goog-api-key":e})}function ne(e,{refreshToken:t}){const n=L(e);return n.append("Authorization",re(t)),n}async function M(e){const t=await e();return t.status>=500&&t.status<600?e():t}function ae(e){return Number(e.replace("s","000"))}function re(e){return`${_} ${e}`}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function se({appConfig:e,heartbeatServiceProvider:t},{fid:n}){const a=F(e),s=L(e),r=t.getImmediate({optional:!0});if(r){const c=await r.getHeartbeatsHeader();c&&s.append("x-firebase-client",c)}const o={fid:n,authVersion:_,appId:e.appId,sdkVersion:q},i={method:"POST",headers:s,body:JSON.stringify(o)},u=await M(()=>fetch(a,i));if(u.ok){const c=await u.json();return{fid:c.fid||n,registrationStatus:2,refreshToken:c.refreshToken,authToken:D(c.authToken)}}else throw await V("Create Installation",u)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function j(e){return new Promise(t=>{setTimeout(t,e)})}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function oe(e){return btoa(String.fromCharCode(...e)).replace(/\+/g,"-").replace(/\//g,"_")}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ie=/^[cdef][\w-]{21}$/,I="";function ce(){try{const e=new Uint8Array(17);(self.crypto||self.msCrypto).getRandomValues(e),e[0]=112+e[0]%16;const n=ue(e);return ie.test(n)?n:I}catch{return I}}function ue(e){return oe(e).substr(0,22)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function g(e){return`${e.appName}!${e.appId}`}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const x=new Map;function $(e,t){const n=g(e);B(n,t),de(n,t)}function B(e,t){const n=x.get(e);if(n)for(const a of n)a(t)}function de(e,t){const n=fe();n&&n.postMessage({key:e,fid:t}),le()}let d=null;function fe(){return!d&&"BroadcastChannel"in self&&(d=new BroadcastChannel("[Firebase] FID Change"),d.onmessage=e=>{B(e.data.key,e.data.fid)}),d}function le(){x.size===0&&d&&(d.close(),d=null)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const pe="firebase-installations-database",ge=1,l="firebase-installations-store";let m=null;function T(){return m||(m=z(pe,ge,{upgrade:(e,t)=>{switch(t){case 0:e.createObjectStore(l)}}})),m}async function p(e,t){const n=g(e),s=(await T()).transaction(l,"readwrite"),r=s.objectStore(l),o=await r.get(n);return await r.put(t,n),await s.done,(!o||o.fid!==t.fid)&&$(e,t.fid),t}async function H(e){const t=g(e),a=(await T()).transaction(l,"readwrite");await a.objectStore(l).delete(t),await a.done}async function h(e,t){const n=g(e),s=(await T()).transaction(l,"readwrite"),r=s.objectStore(l),o=await r.get(n),i=t(o);return i===void 0?await r.delete(n):await r.put(i,n),await s.done,i&&(!o||o.fid!==i.fid)&&$(e,i.fid),i}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function k(e){let t;const n=await h(e.appConfig,a=>{const s=he(a),r=me(e,s);return t=r.registrationPromise,r.installationEntry});return n.fid===I?{installationEntry:await t}:{installationEntry:n,registrationPromise:t}}function he(e){const t=e||{fid:ce(),registrationStatus:0};return U(t)}function me(e,t){if(t.registrationStatus===0){if(!navigator.onLine){const s=Promise.reject(f.create("app-offline"));return{installationEntry:t,registrationPromise:s}}const n={fid:t.fid,registrationStatus:1,registrationTime:Date.now()},a=we(e,n);return{installationEntry:n,registrationPromise:a}}else return t.registrationStatus===1?{installationEntry:t,registrationPromise:Ie(e)}:{installationEntry:t}}async function we(e,t){try{const n=await se(e,t);return p(e.appConfig,n)}catch(n){throw O(n)&&n.customData.serverCode===409?await H(e.appConfig):await p(e.appConfig,{fid:t.fid,registrationStatus:0}),n}}async function Ie(e){let t=await y(e.appConfig);for(;t.registrationStatus===1;)await j(100),t=await y(e.appConfig);if(t.registrationStatus===0){const{installationEntry:n,registrationPromise:a}=await k(e);return a||n}return t}function y(e){return h(e,t=>{if(!t)throw f.create("installation-not-found");return U(t)})}function U(e){return Ae(e)?{fid:e.fid,registrationStatus:0}:e}function Ae(e){return e.registrationStatus===1&&e.registrationTime+N<Date.now()}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Te({appConfig:e,heartbeatServiceProvider:t},n){const a=ke(e,n),s=ne(e,n),r=t.getImmediate({optional:!0});if(r){const c=await r.getHeartbeatsHeader();c&&s.append("x-firebase-client",c)}const o={installation:{sdkVersion:q,appId:e.appId}},i={method:"POST",headers:s,body:JSON.stringify(o)},u=await M(()=>fetch(a,i));if(u.ok){const c=await u.json();return D(c)}else throw await V("Generate Auth Token",u)}function ke(e,{fid:t}){return`${F(e)}/${t}/authTokens:generate`}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function S(e,t=!1){let n;const a=await h(e.appConfig,r=>{if(!W(r))throw f.create("not-registered");const o=r.authToken;if(!t&&Pe(o))return r;if(o.requestStatus===1)return n=Se(e,t),r;{if(!navigator.onLine)throw f.create("app-offline");const i=Ce(r);return n=be(e,i),i}});return n?await n:a.authToken}async function Se(e,t){let n=await C(e.appConfig);for(;n.authToken.requestStatus===1;)await j(100),n=await C(e.appConfig);const a=n.authToken;return a.requestStatus===0?S(e,t):a}function C(e){return h(e,t=>{if(!W(t))throw f.create("not-registered");const n=t.authToken;return Ee(n)?{...t,authToken:{requestStatus:0}}:t})}async function be(e,t){try{const n=await Te(e,t),a={...t,authToken:n};return await p(e.appConfig,a),n}catch(n){if(O(n)&&(n.customData.serverCode===401||n.customData.serverCode===404))await H(e.appConfig);else{const a={...t,authToken:{requestStatus:0}};await p(e.appConfig,a)}throw n}}function W(e){return e!==void 0&&e.registrationStatus===2}function Pe(e){return e.requestStatus===2&&!ye(e)}function ye(e){const t=Date.now();return t<e.creationTime||e.creationTime+e.expiresIn<t+X}function Ce(e){const t={requestStatus:1,requestTime:Date.now()};return{...e,authToken:t}}function Ee(e){return e.requestStatus===1&&e.requestTime+N<Date.now()}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Re(e){const t=e,{installationEntry:n,registrationPromise:a}=await k(t);return a?a.catch(console.error):S(t).catch(console.error),n.fid}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function ve(e,t=!1){const n=e;return await Ne(n),(await S(n,t)).token}async function Ne(e){const{registrationPromise:t}=await k(e);t&&await t}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function qe(e){if(!e||!e.options)throw w("App Configuration");if(!e.name)throw w("App Name");const t=["projectId","apiKey","appId"];for(const n of t)if(!e.options[n])throw w(n);return{appName:e.name,projectId:e.options.projectId,apiKey:e.options.apiKey,appId:e.options.appId}}function w(e){return f.create("missing-app-config-values",{valueName:e})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const K="installations",_e="installations-internal",Oe=e=>{const t=e.getProvider("app").getImmediate(),n=qe(t),a=R(t,"heartbeat");return{app:t,appConfig:n,heartbeatServiceProvider:a,_delete:()=>Promise.resolve()}},Fe=e=>{const t=e.getProvider("app").getImmediate(),n=R(t,K).getImmediate();return{getId:()=>Re(n),getToken:s=>ve(n,s)}};function De(){b(new P(K,Oe,"PUBLIC")),b(new P(_e,Fe,"PRIVATE"))}De();E(v,A);E(v,A,"esm2020");export{xe as ActionCodeURL,$e as AuthCredential,Be as EmailAuthCredential,He as EmailAuthProvider,Ue as FacebookAuthProvider,We as GithubAuthProvider,Ke as GoogleAuthProvider,Ge as OAuthCredential,Je as OAuthProvider,ze as PhoneAuthCredential,Ye as PhoneAuthProvider,Qe as RecaptchaVerifier,Xe as TwitterAuthProvider,Ze as applyActionCode,et as browserLocalPersistence,tt as browserPopupRedirectResolver,nt as browserSessionPersistence,at as checkActionCode,rt as confirmPasswordReset,st as createUserWithEmailAndPassword,ot as getAdditionalUserInfo,it as getIdTokenResult,ct as getRedirectResult,ut as inMemoryPersistence,dt as indexedDBLocalPersistence,ft as initializeAuth,lt as isSignInWithEmailLink,pt as onAuthStateChanged,gt as prodErrorMap,ht as reload,mt as sendEmailVerification,wt as sendPasswordResetEmail,It as sendSignInLinkToEmail,At as setPersistence,Tt as signInWithCredential,kt as signInWithCustomToken,St as signInWithEmailAndPassword,bt as signInWithEmailLink,Pt as signInWithPopup,yt as signInWithRedirect,Ct as signOut,Et as updatePhoneNumber,Rt as updateProfile,vt as verifyPasswordResetCode};
