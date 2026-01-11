import{D as R,B as k,C as P,_ as E,E as J,X as z,Q as X}from"./firebase-DuGdOXoW.js";import{a0 as je,a1 as $e,a2 as Be,a3 as Ue,a4 as He,a5 as We,G as Ke,a6 as Ge,a7 as Je,P as ze,R as Xe,a8 as Qe,m as Ye,W as Ze,a9 as et,aa as tt,ab as nt,n as at,p as rt,I as st,ac as ot,g as it,ad as ct,ae as ut,af as dt,o as ft,ag as lt,ah as pt,H as gt,K as ht,U as wt,ai as mt,h as It,r as At,s as Tt,e as St,V as bt,J as kt,u as Pt,v as yt}from"./firebase-DuGdOXoW.js";import"./index-qyQPv92m.js";const v="@firebase/installations",A="0.6.19";/**
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
 */const N=1e4,q=`w:${A}`,_="FIS_v2",Q="https://firebaseinstallations.googleapis.com/v1",Y=60*60*1e3,Z="installations",ee="Installations";/**
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
 */const te={"missing-app-config-values":'Missing App configuration value: "{$valueName}"',"not-registered":"Firebase Installation is not registered.","installation-not-found":"Firebase Installation not found.","request-failed":'{$requestName} request failed with error "{$serverCode} {$serverStatus}: {$serverMessage}"',"app-offline":"Could not process request. Application offline.","delete-pending-registration":"Can't delete installation while there is a pending registration request."},f=new J(Z,ee,te);function O(e){return e instanceof X&&e.code.includes("request-failed")}/**
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
 */function D({projectId:e}){return`${Q}/projects/${e}/installations`}function F(e){return{token:e.token,requestStatus:2,expiresIn:ae(e.expiresIn),creationTime:Date.now()}}async function V(e,t){const a=(await t.json()).error;return f.create("request-failed",{requestName:e,serverCode:a.code,serverMessage:a.message,serverStatus:a.status})}function L({apiKey:e}){return new Headers({"Content-Type":"application/json",Accept:"application/json","x-goog-api-key":e})}function ne(e,{refreshToken:t}){const n=L(e);return n.append("Authorization",re(t)),n}async function x(e){const t=await e();return t.status>=500&&t.status<600?e():t}function ae(e){return Number(e.replace("s","000"))}function re(e){return`${_} ${e}`}/**
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
 */async function se({appConfig:e,heartbeatServiceProvider:t},{fid:n}){const a=D(e),s=L(e),r=t.getImmediate({optional:!0});if(r){const c=await r.getHeartbeatsHeader();c&&s.append("x-firebase-client",c)}const o={fid:n,authVersion:_,appId:e.appId,sdkVersion:q},i={method:"POST",headers:s,body:JSON.stringify(o)},u=await x(()=>fetch(a,i));if(u.ok){const c=await u.json();return{fid:c.fid||n,registrationStatus:2,refreshToken:c.refreshToken,authToken:F(c.authToken)}}else throw await V("Create Installation",u)}/**
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
 */function M(e){return new Promise(t=>{setTimeout(t,e)})}/**
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
 */const j=new Map;function $(e,t){const n=g(e);B(n,t),de(n,t)}function B(e,t){const n=j.get(e);if(n)for(const a of n)a(t)}function de(e,t){const n=fe();n&&n.postMessage({key:e,fid:t}),le()}let d=null;function fe(){return!d&&"BroadcastChannel"in self&&(d=new BroadcastChannel("[Firebase] FID Change"),d.onmessage=e=>{B(e.data.key,e.data.fid)}),d}function le(){j.size===0&&d&&(d.close(),d=null)}/**
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
 */const pe="firebase-installations-database",ge=1,l="firebase-installations-store";let w=null;function T(){return w||(w=z(pe,ge,{upgrade:(e,t)=>{switch(t){case 0:e.createObjectStore(l)}}})),w}async function p(e,t){const n=g(e),s=(await T()).transaction(l,"readwrite"),r=s.objectStore(l),o=await r.get(n);return await r.put(t,n),await s.done,(!o||o.fid!==t.fid)&&$(e,t.fid),t}async function U(e){const t=g(e),a=(await T()).transaction(l,"readwrite");await a.objectStore(l).delete(t),await a.done}async function h(e,t){const n=g(e),s=(await T()).transaction(l,"readwrite"),r=s.objectStore(l),o=await r.get(n),i=t(o);return i===void 0?await r.delete(n):await r.put(i,n),await s.done,i&&(!o||o.fid!==i.fid)&&$(e,i.fid),i}/**
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
 */async function S(e){let t;const n=await h(e.appConfig,a=>{const s=he(a),r=we(e,s);return t=r.registrationPromise,r.installationEntry});return n.fid===I?{installationEntry:await t}:{installationEntry:n,registrationPromise:t}}function he(e){const t=e||{fid:ce(),registrationStatus:0};return H(t)}function we(e,t){if(t.registrationStatus===0){if(!navigator.onLine){const s=Promise.reject(f.create("app-offline"));return{installationEntry:t,registrationPromise:s}}const n={fid:t.fid,registrationStatus:1,registrationTime:Date.now()},a=me(e,n);return{installationEntry:n,registrationPromise:a}}else return t.registrationStatus===1?{installationEntry:t,registrationPromise:Ie(e)}:{installationEntry:t}}async function me(e,t){try{const n=await se(e,t);return p(e.appConfig,n)}catch(n){throw O(n)&&n.customData.serverCode===409?await U(e.appConfig):await p(e.appConfig,{fid:t.fid,registrationStatus:0}),n}}async function Ie(e){let t=await y(e.appConfig);for(;t.registrationStatus===1;)await M(100),t=await y(e.appConfig);if(t.registrationStatus===0){const{installationEntry:n,registrationPromise:a}=await S(e);return a||n}return t}function y(e){return h(e,t=>{if(!t)throw f.create("installation-not-found");return H(t)})}function H(e){return Ae(e)?{fid:e.fid,registrationStatus:0}:e}function Ae(e){return e.registrationStatus===1&&e.registrationTime+N<Date.now()}/**
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
 */async function Te({appConfig:e,heartbeatServiceProvider:t},n){const a=Se(e,n),s=ne(e,n),r=t.getImmediate({optional:!0});if(r){const c=await r.getHeartbeatsHeader();c&&s.append("x-firebase-client",c)}const o={installation:{sdkVersion:q,appId:e.appId}},i={method:"POST",headers:s,body:JSON.stringify(o)},u=await x(()=>fetch(a,i));if(u.ok){const c=await u.json();return F(c)}else throw await V("Generate Auth Token",u)}function Se(e,{fid:t}){return`${D(e)}/${t}/authTokens:generate`}/**
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
 */async function b(e,t=!1){let n;const a=await h(e.appConfig,r=>{if(!W(r))throw f.create("not-registered");const o=r.authToken;if(!t&&Pe(o))return r;if(o.requestStatus===1)return n=be(e,t),r;{if(!navigator.onLine)throw f.create("app-offline");const i=Ce(r);return n=ke(e,i),i}});return n?await n:a.authToken}async function be(e,t){let n=await C(e.appConfig);for(;n.authToken.requestStatus===1;)await M(100),n=await C(e.appConfig);const a=n.authToken;return a.requestStatus===0?b(e,t):a}function C(e){return h(e,t=>{if(!W(t))throw f.create("not-registered");const n=t.authToken;return Re(n)?{...t,authToken:{requestStatus:0}}:t})}async function ke(e,t){try{const n=await Te(e,t),a={...t,authToken:n};return await p(e.appConfig,a),n}catch(n){if(O(n)&&(n.customData.serverCode===401||n.customData.serverCode===404))await U(e.appConfig);else{const a={...t,authToken:{requestStatus:0}};await p(e.appConfig,a)}throw n}}function W(e){return e!==void 0&&e.registrationStatus===2}function Pe(e){return e.requestStatus===2&&!ye(e)}function ye(e){const t=Date.now();return t<e.creationTime||e.creationTime+e.expiresIn<t+Y}function Ce(e){const t={requestStatus:1,requestTime:Date.now()};return{...e,authToken:t}}function Re(e){return e.requestStatus===1&&e.requestTime+N<Date.now()}/**
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
 */async function Ee(e){const t=e,{installationEntry:n,registrationPromise:a}=await S(t);return a?a.catch(console.error):b(t).catch(console.error),n.fid}/**
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
 */async function ve(e,t=!1){const n=e;return await Ne(n),(await b(n,t)).token}async function Ne(e){const{registrationPromise:t}=await S(e);t&&await t}/**
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
 */function qe(e){if(!e||!e.options)throw m("App Configuration");if(!e.name)throw m("App Name");const t=["projectId","apiKey","appId"];for(const n of t)if(!e.options[n])throw m(n);return{appName:e.name,projectId:e.options.projectId,apiKey:e.options.apiKey,appId:e.options.appId}}function m(e){return f.create("missing-app-config-values",{valueName:e})}/**
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
 */const K="installations",_e="installations-internal",Oe=e=>{const t=e.getProvider("app").getImmediate(),n=qe(t),a=E(t,"heartbeat");return{app:t,appConfig:n,heartbeatServiceProvider:a,_delete:()=>Promise.resolve()}},De=e=>{const t=e.getProvider("app").getImmediate(),n=E(t,K).getImmediate();return{getId:()=>Ee(n),getToken:s=>ve(n,s)}};function Fe(){k(new P(K,Oe,"PUBLIC")),k(new P(_e,De,"PRIVATE"))}Fe();R(v,A);R(v,A,"esm2020");export{je as ActionCodeURL,$e as AuthCredential,Be as EmailAuthCredential,Ue as EmailAuthProvider,He as FacebookAuthProvider,We as GithubAuthProvider,Ke as GoogleAuthProvider,Ge as OAuthCredential,Je as PhoneAuthCredential,ze as PhoneAuthProvider,Xe as RecaptchaVerifier,Qe as TwitterAuthProvider,Ye as applyActionCode,Ze as browserLocalPersistence,et as browserPopupRedirectResolver,tt as browserSessionPersistence,nt as checkActionCode,at as confirmPasswordReset,rt as createUserWithEmailAndPassword,st as getAdditionalUserInfo,ot as getIdTokenResult,it as getRedirectResult,ct as inMemoryPersistence,ut as indexedDBLocalPersistence,dt as initializeAuth,ft as onAuthStateChanged,lt as prodErrorMap,pt as reload,gt as sendPasswordResetEmail,ht as sendSignInLinkToEmail,wt as setPersistence,mt as signInWithCredential,It as signInWithCustomToken,At as signInWithEmailAndPassword,Tt as signInWithPopup,St as signInWithRedirect,bt as signOut,kt as updatePhoneNumber,Pt as updateProfile,yt as verifyPasswordResetCode};
