const Fy=()=>{};var lh={};/**
 * @license
 * Copyright 2017 Google LLC
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
 */const kf=function(n){const e=[];let t=0;for(let r=0;r<n.length;r++){let i=n.charCodeAt(r);i<128?e[t++]=i:i<2048?(e[t++]=i>>6|192,e[t++]=i&63|128):(i&64512)===55296&&r+1<n.length&&(n.charCodeAt(r+1)&64512)===56320?(i=65536+((i&1023)<<10)+(n.charCodeAt(++r)&1023),e[t++]=i>>18|240,e[t++]=i>>12&63|128,e[t++]=i>>6&63|128,e[t++]=i&63|128):(e[t++]=i>>12|224,e[t++]=i>>6&63|128,e[t++]=i&63|128)}return e},By=function(n){const e=[];let t=0,r=0;for(;t<n.length;){const i=n[t++];if(i<128)e[r++]=String.fromCharCode(i);else if(i>191&&i<224){const s=n[t++];e[r++]=String.fromCharCode((i&31)<<6|s&63)}else if(i>239&&i<365){const s=n[t++],a=n[t++],c=n[t++],u=((i&7)<<18|(s&63)<<12|(a&63)<<6|c&63)-65536;e[r++]=String.fromCharCode(55296+(u>>10)),e[r++]=String.fromCharCode(56320+(u&1023))}else{const s=n[t++],a=n[t++];e[r++]=String.fromCharCode((i&15)<<12|(s&63)<<6|a&63)}}return e.join("")},bc={byteToCharMap_:null,charToByteMap_:null,byteToCharMapWebSafe_:null,charToByteMapWebSafe_:null,ENCODED_VALS_BASE:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",get ENCODED_VALS(){return this.ENCODED_VALS_BASE+"+/="},get ENCODED_VALS_WEBSAFE(){return this.ENCODED_VALS_BASE+"-_."},HAS_NATIVE_SUPPORT:typeof atob=="function",encodeByteArray(n,e){if(!Array.isArray(n))throw Error("encodeByteArray takes an array as a parameter");this.init_();const t=e?this.byteToCharMapWebSafe_:this.byteToCharMap_,r=[];for(let i=0;i<n.length;i+=3){const s=n[i],a=i+1<n.length,c=a?n[i+1]:0,u=i+2<n.length,h=u?n[i+2]:0,f=s>>2,m=(s&3)<<4|c>>4;let y=(c&15)<<2|h>>6,b=h&63;u||(b=64,a||(y=64)),r.push(t[f],t[m],t[y],t[b])}return r.join("")},encodeString(n,e){return this.HAS_NATIVE_SUPPORT&&!e?btoa(n):this.encodeByteArray(kf(n),e)},decodeString(n,e){return this.HAS_NATIVE_SUPPORT&&!e?atob(n):By(this.decodeStringToByteArray(n,e))},decodeStringToByteArray(n,e){this.init_();const t=e?this.charToByteMapWebSafe_:this.charToByteMap_,r=[];for(let i=0;i<n.length;){const s=t[n.charAt(i++)],c=i<n.length?t[n.charAt(i)]:0;++i;const h=i<n.length?t[n.charAt(i)]:64;++i;const m=i<n.length?t[n.charAt(i)]:64;if(++i,s==null||c==null||h==null||m==null)throw new $y;const y=s<<2|c>>4;if(r.push(y),h!==64){const b=c<<4&240|h>>2;if(r.push(b),m!==64){const k=h<<6&192|m;r.push(k)}}}return r},init_(){if(!this.byteToCharMap_){this.byteToCharMap_={},this.charToByteMap_={},this.byteToCharMapWebSafe_={},this.charToByteMapWebSafe_={};for(let n=0;n<this.ENCODED_VALS.length;n++)this.byteToCharMap_[n]=this.ENCODED_VALS.charAt(n),this.charToByteMap_[this.byteToCharMap_[n]]=n,this.byteToCharMapWebSafe_[n]=this.ENCODED_VALS_WEBSAFE.charAt(n),this.charToByteMapWebSafe_[this.byteToCharMapWebSafe_[n]]=n,n>=this.ENCODED_VALS_BASE.length&&(this.charToByteMap_[this.ENCODED_VALS_WEBSAFE.charAt(n)]=n,this.charToByteMapWebSafe_[this.ENCODED_VALS.charAt(n)]=n)}}};class $y extends Error{constructor(){super(...arguments),this.name="DecodeBase64StringError"}}const qy=function(n){const e=kf(n);return bc.encodeByteArray(e,!0)},Ds=function(n){return qy(n).replace(/\./g,"")},Os=function(n){try{return bc.decodeString(n,!0)}catch(e){console.error("base64Decode failed: ",e)}return null};/**
 * @license
 * Copyright 2022 Google LLC
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
 */function Nf(){if(typeof self<"u")return self;if(typeof window<"u")return window;if(typeof global<"u")return global;throw new Error("Unable to locate global object.")}/**
 * @license
 * Copyright 2022 Google LLC
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
 */const jy=()=>Nf().__FIREBASE_DEFAULTS__,Hy=()=>{if(typeof process>"u"||typeof lh>"u")return;const n=lh.__FIREBASE_DEFAULTS__;if(n)return JSON.parse(n)},zy=()=>{if(typeof document>"u")return;let n;try{n=document.cookie.match(/__FIREBASE_DEFAULTS__=([^;]+)/)}catch{return}const e=n&&Os(n[1]);return e&&JSON.parse(e)},io=()=>{try{return Fy()||jy()||Hy()||zy()}catch(n){console.info(`Unable to get __FIREBASE_DEFAULTS__ due to: ${n}`);return}},Df=n=>{var e,t;return(t=(e=io())==null?void 0:e.emulatorHosts)==null?void 0:t[n]},Wy=n=>{const e=Df(n);if(!e)return;const t=e.lastIndexOf(":");if(t<=0||t+1===e.length)throw new Error(`Invalid host ${e} with no separate hostname and port!`);const r=parseInt(e.substring(t+1),10);return e[0]==="["?[e.substring(1,t-1),r]:[e.substring(0,t),r]},Of=()=>{var n;return(n=io())==null?void 0:n.config},Vf=n=>{var e;return(e=io())==null?void 0:e[`_${n}`]};/**
 * @license
 * Copyright 2017 Google LLC
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
 */class ar{constructor(){this.reject=()=>{},this.resolve=()=>{},this.promise=new Promise((e,t)=>{this.resolve=e,this.reject=t})}wrapCallback(e){return(t,r)=>{t?this.reject(t):this.resolve(r),typeof e=="function"&&(this.promise.catch(()=>{}),e.length===1?e(t):e(t,r))}}}/**
 * @license
 * Copyright 2025 Google LLC
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
 */function fn(n){try{return(n.startsWith("http://")||n.startsWith("https://")?new URL(n).hostname:n).endsWith(".cloudworkstations.dev")}catch{return!1}}async function Sc(n){return(await fetch(n,{credentials:"include"})).ok}/**
 * @license
 * Copyright 2021 Google LLC
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
 */function Gy(n,e){if(n.uid)throw new Error('The "uid" field is no longer supported by mockUserToken. Please use "sub" instead for Firebase Auth User ID.');const t={alg:"none",type:"JWT"},r=e||"demo-project",i=n.iat||0,s=n.sub||n.user_id;if(!s)throw new Error("mockUserToken must contain 'sub' or 'user_id' field!");const a={iss:`https://securetoken.google.com/${r}`,aud:r,iat:i,exp:i+3600,auth_time:i,sub:s,user_id:s,firebase:{sign_in_provider:"custom",identities:{}},...n};return[Ds(JSON.stringify(t)),Ds(JSON.stringify(a)),""].join(".")}const ri={};function Ky(){const n={prod:[],emulator:[]};for(const e of Object.keys(ri))ri[e]?n.emulator.push(e):n.prod.push(e);return n}function Yy(n){let e=document.getElementById(n),t=!1;return e||(e=document.createElement("div"),e.setAttribute("id",n),t=!0),{created:t,element:e}}let hh=!1;function Mf(n,e){if(typeof window>"u"||typeof document>"u"||!fn(window.location.host)||ri[n]===e||ri[n]||hh)return;ri[n]=e;function t(y){return`__firebase__banner__${y}`}const r="__firebase__banner",s=Ky().prod.length>0;function a(){const y=document.getElementById(r);y&&y.remove()}function c(y){y.style.display="flex",y.style.background="#7faaf0",y.style.position="fixed",y.style.bottom="5px",y.style.left="5px",y.style.padding=".5em",y.style.borderRadius="5px",y.style.alignItems="center"}function u(y,b){y.setAttribute("width","24"),y.setAttribute("id",b),y.setAttribute("height","24"),y.setAttribute("viewBox","0 0 24 24"),y.setAttribute("fill","none"),y.style.marginLeft="-6px"}function h(){const y=document.createElement("span");return y.style.cursor="pointer",y.style.marginLeft="16px",y.style.fontSize="24px",y.innerHTML=" &times;",y.onclick=()=>{hh=!0,a()},y}function f(y,b){y.setAttribute("id",b),y.innerText="Learn more",y.href="https://firebase.google.com/docs/studio/preview-apps#preview-backend",y.setAttribute("target","__blank"),y.style.paddingLeft="5px",y.style.textDecoration="underline"}function m(){const y=Yy(r),b=t("text"),k=document.getElementById(b)||document.createElement("span"),V=t("learnmore"),N=document.getElementById(V)||document.createElement("a"),F=t("preprendIcon"),$=document.getElementById(F)||document.createElementNS("http://www.w3.org/2000/svg","svg");if(y.created){const j=y.element;c(j),f(N,V);const Y=h();u($,F),j.append($,k,N,Y),document.body.appendChild(j)}s?(k.innerText="Preview backend disconnected.",$.innerHTML=`<g clip-path="url(#clip0_6013_33858)">
<path d="M4.8 17.6L12 5.6L19.2 17.6H4.8ZM6.91667 16.4H17.0833L12 7.93333L6.91667 16.4ZM12 15.6C12.1667 15.6 12.3056 15.5444 12.4167 15.4333C12.5389 15.3111 12.6 15.1667 12.6 15C12.6 14.8333 12.5389 14.6944 12.4167 14.5833C12.3056 14.4611 12.1667 14.4 12 14.4C11.8333 14.4 11.6889 14.4611 11.5667 14.5833C11.4556 14.6944 11.4 14.8333 11.4 15C11.4 15.1667 11.4556 15.3111 11.5667 15.4333C11.6889 15.5444 11.8333 15.6 12 15.6ZM11.4 13.6H12.6V10.4H11.4V13.6Z" fill="#212121"/>
</g>
<defs>
<clipPath id="clip0_6013_33858">
<rect width="24" height="24" fill="white"/>
</clipPath>
</defs>`):($.innerHTML=`<g clip-path="url(#clip0_6083_34804)">
<path d="M11.4 15.2H12.6V11.2H11.4V15.2ZM12 10C12.1667 10 12.3056 9.94444 12.4167 9.83333C12.5389 9.71111 12.6 9.56667 12.6 9.4C12.6 9.23333 12.5389 9.09444 12.4167 8.98333C12.3056 8.86111 12.1667 8.8 12 8.8C11.8333 8.8 11.6889 8.86111 11.5667 8.98333C11.4556 9.09444 11.4 9.23333 11.4 9.4C11.4 9.56667 11.4556 9.71111 11.5667 9.83333C11.6889 9.94444 11.8333 10 12 10ZM12 18.4C11.1222 18.4 10.2944 18.2333 9.51667 17.9C8.73889 17.5667 8.05556 17.1111 7.46667 16.5333C6.88889 15.9444 6.43333 15.2611 6.1 14.4833C5.76667 13.7056 5.6 12.8778 5.6 12C5.6 11.1111 5.76667 10.2833 6.1 9.51667C6.43333 8.73889 6.88889 8.06111 7.46667 7.48333C8.05556 6.89444 8.73889 6.43333 9.51667 6.1C10.2944 5.76667 11.1222 5.6 12 5.6C12.8889 5.6 13.7167 5.76667 14.4833 6.1C15.2611 6.43333 15.9389 6.89444 16.5167 7.48333C17.1056 8.06111 17.5667 8.73889 17.9 9.51667C18.2333 10.2833 18.4 11.1111 18.4 12C18.4 12.8778 18.2333 13.7056 17.9 14.4833C17.5667 15.2611 17.1056 15.9444 16.5167 16.5333C15.9389 17.1111 15.2611 17.5667 14.4833 17.9C13.7167 18.2333 12.8889 18.4 12 18.4ZM12 17.2C13.4444 17.2 14.6722 16.6944 15.6833 15.6833C16.6944 14.6722 17.2 13.4444 17.2 12C17.2 10.5556 16.6944 9.32778 15.6833 8.31667C14.6722 7.30555 13.4444 6.8 12 6.8C10.5556 6.8 9.32778 7.30555 8.31667 8.31667C7.30556 9.32778 6.8 10.5556 6.8 12C6.8 13.4444 7.30556 14.6722 8.31667 15.6833C9.32778 16.6944 10.5556 17.2 12 17.2Z" fill="#212121"/>
</g>
<defs>
<clipPath id="clip0_6083_34804">
<rect width="24" height="24" fill="white"/>
</clipPath>
</defs>`,k.innerText="Preview backend running in this workspace."),k.setAttribute("id",b)}document.readyState==="loading"?window.addEventListener("DOMContentLoaded",m):m()}/**
 * @license
 * Copyright 2017 Google LLC
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
 */function Me(){return typeof navigator<"u"&&typeof navigator.userAgent=="string"?navigator.userAgent:""}function Qy(){return typeof window<"u"&&!!(window.cordova||window.phonegap||window.PhoneGap)&&/ios|iphone|ipod|ipad|android|blackberry|iemobile/i.test(Me())}function Jy(){var e;const n=(e=io())==null?void 0:e.forceEnvironment;if(n==="node")return!0;if(n==="browser")return!1;try{return Object.prototype.toString.call(global.process)==="[object process]"}catch{return!1}}function Xy(){return typeof navigator<"u"&&navigator.userAgent==="Cloudflare-Workers"}function Pc(){const n=typeof chrome=="object"?chrome.runtime:typeof browser=="object"?browser.runtime:void 0;return typeof n=="object"&&n.id!==void 0}function Zy(){return typeof navigator=="object"&&navigator.product==="ReactNative"}function eT(){const n=Me();return n.indexOf("MSIE ")>=0||n.indexOf("Trident/")>=0}function tT(){return!Jy()&&!!navigator.userAgent&&navigator.userAgent.includes("Safari")&&!navigator.userAgent.includes("Chrome")}function On(){try{return typeof indexedDB=="object"}catch{return!1}}function Di(){return new Promise((n,e)=>{try{let t=!0;const r="validate-browser-context-for-indexeddb-analytics-module",i=self.indexedDB.open(r);i.onsuccess=()=>{i.result.close(),t||self.indexedDB.deleteDatabase(r),n(!0)},i.onupgradeneeded=()=>{t=!1},i.onerror=()=>{var s;e(((s=i.error)==null?void 0:s.message)||"")}}catch(t){e(t)}})}function so(){return!(typeof navigator>"u"||!navigator.cookieEnabled)}/**
 * @license
 * Copyright 2017 Google LLC
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
 */const nT="FirebaseError";class rt extends Error{constructor(e,t,r){super(t),this.code=e,this.customData=r,this.name=nT,Object.setPrototypeOf(this,rt.prototype),Error.captureStackTrace&&Error.captureStackTrace(this,Et.prototype.create)}}class Et{constructor(e,t,r){this.service=e,this.serviceName=t,this.errors=r}create(e,...t){const r=t[0]||{},i=`${this.service}/${e}`,s=this.errors[e],a=s?rT(s,r):"Error",c=`${this.serviceName}: ${a} (${i}).`;return new rt(i,c,r)}}function rT(n,e){return n.replace(iT,(t,r)=>{const i=e[r];return i!=null?String(i):`<${r}?>`})}const iT=/\{\$([^}]+)}/g;/**
 * @license
 * Copyright 2017 Google LLC
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
 */function dh(n){return JSON.parse(n)}/**
 * @license
 * Copyright 2017 Google LLC
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
 */const sT=function(n){let e={},t={},r={},i="";try{const s=n.split(".");e=dh(Os(s[0])||""),t=dh(Os(s[1])||""),i=s[2],r=t.d||{},delete t.d}catch{}return{header:e,claims:t,data:r,signature:i}},oT=function(n){const e=sT(n).claims;return typeof e=="object"&&e.hasOwnProperty("iat")?e.iat:null};function aT(n){for(const e in n)if(Object.prototype.hasOwnProperty.call(n,e))return!1;return!0}function Dt(n,e){if(n===e)return!0;const t=Object.keys(n),r=Object.keys(e);for(const i of t){if(!r.includes(i))return!1;const s=n[i],a=e[i];if(fh(s)&&fh(a)){if(!Dt(s,a))return!1}else if(s!==a)return!1}for(const i of r)if(!t.includes(i))return!1;return!0}function fh(n){return n!==null&&typeof n=="object"}/**
 * @license
 * Copyright 2017 Google LLC
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
 */function gr(n){const e=[];for(const[t,r]of Object.entries(n))Array.isArray(r)?r.forEach(i=>{e.push(encodeURIComponent(t)+"="+encodeURIComponent(i))}):e.push(encodeURIComponent(t)+"="+encodeURIComponent(r));return e.length?"&"+e.join("&"):""}function Qr(n){const e={};return n.replace(/^\?/,"").split("&").forEach(r=>{if(r){const[i,s]=r.split("=");e[decodeURIComponent(i)]=decodeURIComponent(s)}}),e}function Jr(n){const e=n.indexOf("?");if(!e)return"";const t=n.indexOf("#",e);return n.substring(e,t>0?t:void 0)}function cT(n,e){const t=new uT(n,e);return t.subscribe.bind(t)}class uT{constructor(e,t){this.observers=[],this.unsubscribes=[],this.observerCount=0,this.task=Promise.resolve(),this.finalized=!1,this.onNoObservers=t,this.task.then(()=>{e(this)}).catch(r=>{this.error(r)})}next(e){this.forEachObserver(t=>{t.next(e)})}error(e){this.forEachObserver(t=>{t.error(e)}),this.close(e)}complete(){this.forEachObserver(e=>{e.complete()}),this.close()}subscribe(e,t,r){let i;if(e===void 0&&t===void 0&&r===void 0)throw new Error("Missing Observer.");lT(e,["next","error","complete"])?i=e:i={next:e,error:t,complete:r},i.next===void 0&&(i.next=ca),i.error===void 0&&(i.error=ca),i.complete===void 0&&(i.complete=ca);const s=this.unsubscribeOne.bind(this,this.observers.length);return this.finalized&&this.task.then(()=>{try{this.finalError?i.error(this.finalError):i.complete()}catch{}}),this.observers.push(i),s}unsubscribeOne(e){this.observers===void 0||this.observers[e]===void 0||(delete this.observers[e],this.observerCount-=1,this.observerCount===0&&this.onNoObservers!==void 0&&this.onNoObservers(this))}forEachObserver(e){if(!this.finalized)for(let t=0;t<this.observers.length;t++)this.sendOne(t,e)}sendOne(e,t){this.task.then(()=>{if(this.observers!==void 0&&this.observers[e]!==void 0)try{t(this.observers[e])}catch(r){typeof console<"u"&&console.error&&console.error(r)}})}close(e){this.finalized||(this.finalized=!0,e!==void 0&&(this.finalError=e),this.task.then(()=>{this.observers=void 0,this.onNoObservers=void 0}))}}function lT(n,e){if(typeof n!="object"||n===null)return!1;for(const t of e)if(t in n&&typeof n[t]=="function")return!0;return!1}function ca(){}/**
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
 */const hT=1e3,dT=2,fT=4*60*60*1e3,pT=.5;function Ha(n,e=hT,t=dT){const r=e*Math.pow(t,n),i=Math.round(pT*r*(Math.random()-.5)*2);return Math.min(fT,r+i)}/**
 * @license
 * Copyright 2021 Google LLC
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
 */function L(n){return n&&n._delegate?n._delegate:n}class Ce{constructor(e,t,r){this.name=e,this.instanceFactory=t,this.type=r,this.multipleInstances=!1,this.serviceProps={},this.instantiationMode="LAZY",this.onInstanceCreated=null}setInstantiationMode(e){return this.instantiationMode=e,this}setMultipleInstances(e){return this.multipleInstances=e,this}setServiceProps(e){return this.serviceProps=e,this}setInstanceCreatedCallback(e){return this.onInstanceCreated=e,this}}/**
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
 */const In="[DEFAULT]";/**
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
 */class mT{constructor(e,t){this.name=e,this.container=t,this.component=null,this.instances=new Map,this.instancesDeferred=new Map,this.instancesOptions=new Map,this.onInitCallbacks=new Map}get(e){const t=this.normalizeInstanceIdentifier(e);if(!this.instancesDeferred.has(t)){const r=new ar;if(this.instancesDeferred.set(t,r),this.isInitialized(t)||this.shouldAutoInitialize())try{const i=this.getOrInitializeService({instanceIdentifier:t});i&&r.resolve(i)}catch{}}return this.instancesDeferred.get(t).promise}getImmediate(e){const t=this.normalizeInstanceIdentifier(e==null?void 0:e.identifier),r=(e==null?void 0:e.optional)??!1;if(this.isInitialized(t)||this.shouldAutoInitialize())try{return this.getOrInitializeService({instanceIdentifier:t})}catch(i){if(r)return null;throw i}else{if(r)return null;throw Error(`Service ${this.name} is not available`)}}getComponent(){return this.component}setComponent(e){if(e.name!==this.name)throw Error(`Mismatching Component ${e.name} for Provider ${this.name}.`);if(this.component)throw Error(`Component for ${this.name} has already been provided`);if(this.component=e,!!this.shouldAutoInitialize()){if(_T(e))try{this.getOrInitializeService({instanceIdentifier:In})}catch{}for(const[t,r]of this.instancesDeferred.entries()){const i=this.normalizeInstanceIdentifier(t);try{const s=this.getOrInitializeService({instanceIdentifier:i});r.resolve(s)}catch{}}}}clearInstance(e=In){this.instancesDeferred.delete(e),this.instancesOptions.delete(e),this.instances.delete(e)}async delete(){const e=Array.from(this.instances.values());await Promise.all([...e.filter(t=>"INTERNAL"in t).map(t=>t.INTERNAL.delete()),...e.filter(t=>"_delete"in t).map(t=>t._delete())])}isComponentSet(){return this.component!=null}isInitialized(e=In){return this.instances.has(e)}getOptions(e=In){return this.instancesOptions.get(e)||{}}initialize(e={}){const{options:t={}}=e,r=this.normalizeInstanceIdentifier(e.instanceIdentifier);if(this.isInitialized(r))throw Error(`${this.name}(${r}) has already been initialized`);if(!this.isComponentSet())throw Error(`Component ${this.name} has not been registered yet`);const i=this.getOrInitializeService({instanceIdentifier:r,options:t});for(const[s,a]of this.instancesDeferred.entries()){const c=this.normalizeInstanceIdentifier(s);r===c&&a.resolve(i)}return i}onInit(e,t){const r=this.normalizeInstanceIdentifier(t),i=this.onInitCallbacks.get(r)??new Set;i.add(e),this.onInitCallbacks.set(r,i);const s=this.instances.get(r);return s&&e(s,r),()=>{i.delete(e)}}invokeOnInitCallbacks(e,t){const r=this.onInitCallbacks.get(t);if(r)for(const i of r)try{i(e,t)}catch{}}getOrInitializeService({instanceIdentifier:e,options:t={}}){let r=this.instances.get(e);if(!r&&this.component&&(r=this.component.instanceFactory(this.container,{instanceIdentifier:gT(e),options:t}),this.instances.set(e,r),this.instancesOptions.set(e,t),this.invokeOnInitCallbacks(r,e),this.component.onInstanceCreated))try{this.component.onInstanceCreated(this.container,e,r)}catch{}return r||null}normalizeInstanceIdentifier(e=In){return this.component?this.component.multipleInstances?e:In:e}shouldAutoInitialize(){return!!this.component&&this.component.instantiationMode!=="EXPLICIT"}}function gT(n){return n===In?void 0:n}function _T(n){return n.instantiationMode==="EAGER"}/**
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
 */class yT{constructor(e){this.name=e,this.providers=new Map}addComponent(e){const t=this.getProvider(e.name);if(t.isComponentSet())throw new Error(`Component ${e.name} has already been registered with ${this.name}`);t.setComponent(e)}addOrOverwriteComponent(e){this.getProvider(e.name).isComponentSet()&&this.providers.delete(e.name),this.addComponent(e)}getProvider(e){if(this.providers.has(e))return this.providers.get(e);const t=new mT(e,this);return this.providers.set(e,t),t}getProviders(){return Array.from(this.providers.values())}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */var z;(function(n){n[n.DEBUG=0]="DEBUG",n[n.VERBOSE=1]="VERBOSE",n[n.INFO=2]="INFO",n[n.WARN=3]="WARN",n[n.ERROR=4]="ERROR",n[n.SILENT=5]="SILENT"})(z||(z={}));const TT={debug:z.DEBUG,verbose:z.VERBOSE,info:z.INFO,warn:z.WARN,error:z.ERROR,silent:z.SILENT},ET=z.INFO,IT={[z.DEBUG]:"log",[z.VERBOSE]:"log",[z.INFO]:"info",[z.WARN]:"warn",[z.ERROR]:"error"},wT=(n,e,...t)=>{if(e<n.logLevel)return;const r=new Date().toISOString(),i=IT[e];if(i)console[i](`[${r}]  ${n.name}:`,...t);else throw new Error(`Attempted to log a message with an invalid logType (value: ${e})`)};class _r{constructor(e){this.name=e,this._logLevel=ET,this._logHandler=wT,this._userLogHandler=null}get logLevel(){return this._logLevel}set logLevel(e){if(!(e in z))throw new TypeError(`Invalid value "${e}" assigned to \`logLevel\``);this._logLevel=e}setLogLevel(e){this._logLevel=typeof e=="string"?TT[e]:e}get logHandler(){return this._logHandler}set logHandler(e){if(typeof e!="function")throw new TypeError("Value assigned to `logHandler` must be a function");this._logHandler=e}get userLogHandler(){return this._userLogHandler}set userLogHandler(e){this._userLogHandler=e}debug(...e){this._userLogHandler&&this._userLogHandler(this,z.DEBUG,...e),this._logHandler(this,z.DEBUG,...e)}log(...e){this._userLogHandler&&this._userLogHandler(this,z.VERBOSE,...e),this._logHandler(this,z.VERBOSE,...e)}info(...e){this._userLogHandler&&this._userLogHandler(this,z.INFO,...e),this._logHandler(this,z.INFO,...e)}warn(...e){this._userLogHandler&&this._userLogHandler(this,z.WARN,...e),this._logHandler(this,z.WARN,...e)}error(...e){this._userLogHandler&&this._userLogHandler(this,z.ERROR,...e),this._logHandler(this,z.ERROR,...e)}}const vT=(n,e)=>e.some(t=>n instanceof t);let ph,mh;function AT(){return ph||(ph=[IDBDatabase,IDBObjectStore,IDBIndex,IDBCursor,IDBTransaction])}function RT(){return mh||(mh=[IDBCursor.prototype.advance,IDBCursor.prototype.continue,IDBCursor.prototype.continuePrimaryKey])}const Lf=new WeakMap,za=new WeakMap,Uf=new WeakMap,ua=new WeakMap,Cc=new WeakMap;function bT(n){const e=new Promise((t,r)=>{const i=()=>{n.removeEventListener("success",s),n.removeEventListener("error",a)},s=()=>{t(Pt(n.result)),i()},a=()=>{r(n.error),i()};n.addEventListener("success",s),n.addEventListener("error",a)});return e.then(t=>{t instanceof IDBCursor&&Lf.set(t,n)}).catch(()=>{}),Cc.set(e,n),e}function ST(n){if(za.has(n))return;const e=new Promise((t,r)=>{const i=()=>{n.removeEventListener("complete",s),n.removeEventListener("error",a),n.removeEventListener("abort",a)},s=()=>{t(),i()},a=()=>{r(n.error||new DOMException("AbortError","AbortError")),i()};n.addEventListener("complete",s),n.addEventListener("error",a),n.addEventListener("abort",a)});za.set(n,e)}let Wa={get(n,e,t){if(n instanceof IDBTransaction){if(e==="done")return za.get(n);if(e==="objectStoreNames")return n.objectStoreNames||Uf.get(n);if(e==="store")return t.objectStoreNames[1]?void 0:t.objectStore(t.objectStoreNames[0])}return Pt(n[e])},set(n,e,t){return n[e]=t,!0},has(n,e){return n instanceof IDBTransaction&&(e==="done"||e==="store")?!0:e in n}};function PT(n){Wa=n(Wa)}function CT(n){return n===IDBDatabase.prototype.transaction&&!("objectStoreNames"in IDBTransaction.prototype)?function(e,...t){const r=n.call(la(this),e,...t);return Uf.set(r,e.sort?e.sort():[e]),Pt(r)}:RT().includes(n)?function(...e){return n.apply(la(this),e),Pt(Lf.get(this))}:function(...e){return Pt(n.apply(la(this),e))}}function kT(n){return typeof n=="function"?CT(n):(n instanceof IDBTransaction&&ST(n),vT(n,AT())?new Proxy(n,Wa):n)}function Pt(n){if(n instanceof IDBRequest)return bT(n);if(ua.has(n))return ua.get(n);const e=kT(n);return e!==n&&(ua.set(n,e),Cc.set(e,n)),e}const la=n=>Cc.get(n);function oo(n,e,{blocked:t,upgrade:r,blocking:i,terminated:s}={}){const a=indexedDB.open(n,e),c=Pt(a);return r&&a.addEventListener("upgradeneeded",u=>{r(Pt(a.result),u.oldVersion,u.newVersion,Pt(a.transaction),u)}),t&&a.addEventListener("blocked",u=>t(u.oldVersion,u.newVersion,u)),c.then(u=>{s&&u.addEventListener("close",()=>s()),i&&u.addEventListener("versionchange",h=>i(h.oldVersion,h.newVersion,h))}).catch(()=>{}),c}function ha(n,{blocked:e}={}){const t=indexedDB.deleteDatabase(n);return e&&t.addEventListener("blocked",r=>e(r.oldVersion,r)),Pt(t).then(()=>{})}const NT=["get","getKey","getAll","getAllKeys","count"],DT=["put","add","delete","clear"],da=new Map;function gh(n,e){if(!(n instanceof IDBDatabase&&!(e in n)&&typeof e=="string"))return;if(da.get(e))return da.get(e);const t=e.replace(/FromIndex$/,""),r=e!==t,i=DT.includes(t);if(!(t in(r?IDBIndex:IDBObjectStore).prototype)||!(i||NT.includes(t)))return;const s=async function(a,...c){const u=this.transaction(a,i?"readwrite":"readonly");let h=u.store;return r&&(h=h.index(c.shift())),(await Promise.all([h[t](...c),i&&u.done]))[0]};return da.set(e,s),s}PT(n=>({...n,get:(e,t,r)=>gh(e,t)||n.get(e,t,r),has:(e,t)=>!!gh(e,t)||n.has(e,t)}));/**
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
 */class OT{constructor(e){this.container=e}getPlatformInfoString(){return this.container.getProviders().map(t=>{if(VT(t)){const r=t.getImmediate();return`${r.library}/${r.version}`}else return null}).filter(t=>t).join(" ")}}function VT(n){const e=n.getComponent();return(e==null?void 0:e.type)==="VERSION"}const Ga="@firebase/app",_h="0.14.9";/**
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
 */const Ot=new _r("@firebase/app"),MT="@firebase/app-compat",LT="@firebase/analytics-compat",UT="@firebase/analytics",xT="@firebase/app-check-compat",FT="@firebase/app-check",BT="@firebase/auth",$T="@firebase/auth-compat",qT="@firebase/database",jT="@firebase/data-connect",HT="@firebase/database-compat",zT="@firebase/functions",WT="@firebase/functions-compat",GT="@firebase/installations",KT="@firebase/installations-compat",YT="@firebase/messaging",QT="@firebase/messaging-compat",JT="@firebase/performance",XT="@firebase/performance-compat",ZT="@firebase/remote-config",eE="@firebase/remote-config-compat",tE="@firebase/storage",nE="@firebase/storage-compat",rE="@firebase/firestore",iE="@firebase/ai",sE="@firebase/firestore-compat",oE="firebase",aE="12.10.0";/**
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
 */const Ka="[DEFAULT]",cE={[Ga]:"fire-core",[MT]:"fire-core-compat",[UT]:"fire-analytics",[LT]:"fire-analytics-compat",[FT]:"fire-app-check",[xT]:"fire-app-check-compat",[BT]:"fire-auth",[$T]:"fire-auth-compat",[qT]:"fire-rtdb",[jT]:"fire-data-connect",[HT]:"fire-rtdb-compat",[zT]:"fire-fn",[WT]:"fire-fn-compat",[GT]:"fire-iid",[KT]:"fire-iid-compat",[YT]:"fire-fcm",[QT]:"fire-fcm-compat",[JT]:"fire-perf",[XT]:"fire-perf-compat",[ZT]:"fire-rc",[eE]:"fire-rc-compat",[tE]:"fire-gcs",[nE]:"fire-gcs-compat",[rE]:"fire-fst",[sE]:"fire-fst-compat",[iE]:"fire-vertex","fire-js":"fire-js",[oE]:"fire-js-all"};/**
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
 */const gi=new Map,uE=new Map,Ya=new Map;function yh(n,e){try{n.container.addComponent(e)}catch(t){Ot.debug(`Component ${e.name} failed to register with FirebaseApp ${n.name}`,t)}}function Le(n){const e=n.name;if(Ya.has(e))return Ot.debug(`There were multiple attempts to register component ${e}.`),!1;Ya.set(e,n);for(const t of gi.values())yh(t,n);for(const t of uE.values())yh(t,n);return!0}function Ke(n,e){const t=n.container.getProvider("heartbeat").getImmediate({optional:!0});return t&&t.triggerHeartbeat(),n.container.getProvider(e)}function ie(n){return n==null?!1:n.settings!==void 0}/**
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
 */const lE={"no-app":"No Firebase App '{$appName}' has been created - call initializeApp() first","bad-app-name":"Illegal App name: '{$appName}'","duplicate-app":"Firebase App named '{$appName}' already exists with different options or config","app-deleted":"Firebase App named '{$appName}' already deleted","server-app-deleted":"Firebase Server App has been deleted","no-options":"Need to provide options, when not being deployed to hosting via source.","invalid-app-argument":"firebase.{$appName}() takes either no argument or a Firebase App instance.","invalid-log-argument":"First argument to `onLog` must be null or a function.","idb-open":"Error thrown when opening IndexedDB. Original error: {$originalErrorMessage}.","idb-get":"Error thrown when reading from IndexedDB. Original error: {$originalErrorMessage}.","idb-set":"Error thrown when writing to IndexedDB. Original error: {$originalErrorMessage}.","idb-delete":"Error thrown when deleting from IndexedDB. Original error: {$originalErrorMessage}.","finalization-registry-not-supported":"FirebaseServerApp deleteOnDeref field defined but the JS runtime does not support FinalizationRegistry.","invalid-server-app-environment":"FirebaseServerApp is not for use in browser environments."},Xt=new Et("app","Firebase",lE);/**
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
 */class hE{constructor(e,t,r){this._isDeleted=!1,this._options={...e},this._config={...t},this._name=t.name,this._automaticDataCollectionEnabled=t.automaticDataCollectionEnabled,this._container=r,this.container.addComponent(new Ce("app",()=>this,"PUBLIC"))}get automaticDataCollectionEnabled(){return this.checkDestroyed(),this._automaticDataCollectionEnabled}set automaticDataCollectionEnabled(e){this.checkDestroyed(),this._automaticDataCollectionEnabled=e}get name(){return this.checkDestroyed(),this._name}get options(){return this.checkDestroyed(),this._options}get config(){return this.checkDestroyed(),this._config}get container(){return this._container}get isDeleted(){return this._isDeleted}set isDeleted(e){this._isDeleted=e}checkDestroyed(){if(this.isDeleted)throw Xt.create("app-deleted",{appName:this._name})}}/**
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
 */const Vn=aE;function dE(n,e={}){let t=n;typeof e!="object"&&(e={name:e});const r={name:Ka,automaticDataCollectionEnabled:!0,...e},i=r.name;if(typeof i!="string"||!i)throw Xt.create("bad-app-name",{appName:String(i)});if(t||(t=Of()),!t)throw Xt.create("no-options");const s=gi.get(i);if(s){if(Dt(t,s.options)&&Dt(r,s.config))return s;throw Xt.create("duplicate-app",{appName:i})}const a=new yT(i);for(const u of Ya.values())a.addComponent(u);const c=new hE(t,r,a);return gi.set(i,c),c}function yr(n=Ka){const e=gi.get(n);if(!e&&n===Ka&&Of())return dE();if(!e)throw Xt.create("no-app",{appName:n});return e}function W0(){return Array.from(gi.values())}function Te(n,e,t){let r=cE[n]??n;t&&(r+=`-${t}`);const i=r.match(/\s|\//),s=e.match(/\s|\//);if(i||s){const a=[`Unable to register library "${r}" with version "${e}":`];i&&a.push(`library name "${r}" contains illegal characters (whitespace or "/")`),i&&s&&a.push("and"),s&&a.push(`version name "${e}" contains illegal characters (whitespace or "/")`),Ot.warn(a.join(" "));return}Le(new Ce(`${r}-version`,()=>({library:r,version:e}),"VERSION"))}/**
 * @license
 * Copyright 2021 Google LLC
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
 */const fE="firebase-heartbeat-database",pE=1,_i="firebase-heartbeat-store";let fa=null;function xf(){return fa||(fa=oo(fE,pE,{upgrade:(n,e)=>{switch(e){case 0:try{n.createObjectStore(_i)}catch(t){console.warn(t)}}}}).catch(n=>{throw Xt.create("idb-open",{originalErrorMessage:n.message})})),fa}async function mE(n){try{const t=(await xf()).transaction(_i),r=await t.objectStore(_i).get(Ff(n));return await t.done,r}catch(e){if(e instanceof rt)Ot.warn(e.message);else{const t=Xt.create("idb-get",{originalErrorMessage:e==null?void 0:e.message});Ot.warn(t.message)}}}async function Th(n,e){try{const r=(await xf()).transaction(_i,"readwrite");await r.objectStore(_i).put(e,Ff(n)),await r.done}catch(t){if(t instanceof rt)Ot.warn(t.message);else{const r=Xt.create("idb-set",{originalErrorMessage:t==null?void 0:t.message});Ot.warn(r.message)}}}function Ff(n){return`${n.name}!${n.options.appId}`}/**
 * @license
 * Copyright 2021 Google LLC
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
 */const gE=1024,_E=30;class yE{constructor(e){this.container=e,this._heartbeatsCache=null;const t=this.container.getProvider("app").getImmediate();this._storage=new EE(t),this._heartbeatsCachePromise=this._storage.read().then(r=>(this._heartbeatsCache=r,r))}async triggerHeartbeat(){var e,t;try{const i=this.container.getProvider("platform-logger").getImmediate().getPlatformInfoString(),s=Eh();if(((e=this._heartbeatsCache)==null?void 0:e.heartbeats)==null&&(this._heartbeatsCache=await this._heartbeatsCachePromise,((t=this._heartbeatsCache)==null?void 0:t.heartbeats)==null)||this._heartbeatsCache.lastSentHeartbeatDate===s||this._heartbeatsCache.heartbeats.some(a=>a.date===s))return;if(this._heartbeatsCache.heartbeats.push({date:s,agent:i}),this._heartbeatsCache.heartbeats.length>_E){const a=IE(this._heartbeatsCache.heartbeats);this._heartbeatsCache.heartbeats.splice(a,1)}return this._storage.overwrite(this._heartbeatsCache)}catch(r){Ot.warn(r)}}async getHeartbeatsHeader(){var e;try{if(this._heartbeatsCache===null&&await this._heartbeatsCachePromise,((e=this._heartbeatsCache)==null?void 0:e.heartbeats)==null||this._heartbeatsCache.heartbeats.length===0)return"";const t=Eh(),{heartbeatsToSend:r,unsentEntries:i}=TE(this._heartbeatsCache.heartbeats),s=Ds(JSON.stringify({version:2,heartbeats:r}));return this._heartbeatsCache.lastSentHeartbeatDate=t,i.length>0?(this._heartbeatsCache.heartbeats=i,await this._storage.overwrite(this._heartbeatsCache)):(this._heartbeatsCache.heartbeats=[],this._storage.overwrite(this._heartbeatsCache)),s}catch(t){return Ot.warn(t),""}}}function Eh(){return new Date().toISOString().substring(0,10)}function TE(n,e=gE){const t=[];let r=n.slice();for(const i of n){const s=t.find(a=>a.agent===i.agent);if(s){if(s.dates.push(i.date),Ih(t)>e){s.dates.pop();break}}else if(t.push({agent:i.agent,dates:[i.date]}),Ih(t)>e){t.pop();break}r=r.slice(1)}return{heartbeatsToSend:t,unsentEntries:r}}class EE{constructor(e){this.app=e,this._canUseIndexedDBPromise=this.runIndexedDBEnvironmentCheck()}async runIndexedDBEnvironmentCheck(){return On()?Di().then(()=>!0).catch(()=>!1):!1}async read(){if(await this._canUseIndexedDBPromise){const t=await mE(this.app);return t!=null&&t.heartbeats?t:{heartbeats:[]}}else return{heartbeats:[]}}async overwrite(e){if(await this._canUseIndexedDBPromise){const r=await this.read();return Th(this.app,{lastSentHeartbeatDate:e.lastSentHeartbeatDate??r.lastSentHeartbeatDate,heartbeats:e.heartbeats})}else return}async add(e){if(await this._canUseIndexedDBPromise){const r=await this.read();return Th(this.app,{lastSentHeartbeatDate:e.lastSentHeartbeatDate??r.lastSentHeartbeatDate,heartbeats:[...r.heartbeats,...e.heartbeats]})}else return}}function Ih(n){return Ds(JSON.stringify({version:2,heartbeats:n})).length}function IE(n){if(n.length===0)return-1;let e=0,t=n[0].date;for(let r=1;r<n.length;r++)n[r].date<t&&(t=n[r].date,e=r);return e}/**
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
 */function wE(n){Le(new Ce("platform-logger",e=>new OT(e),"PRIVATE")),Le(new Ce("heartbeat",e=>new yE(e),"PRIVATE")),Te(Ga,_h,n),Te(Ga,_h,"esm2020"),Te("fire-js","")}wE("");var vE="firebase",AE="12.10.0";/**
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
 */Te(vE,AE,"app");/**
 * @license
 * Copyright 2021 Google LLC
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
 */const RE={PHONE:"phone",TOTP:"totp"},bE={FACEBOOK:"facebook.com",GITHUB:"github.com",GOOGLE:"google.com",PASSWORD:"password",PHONE:"phone",TWITTER:"twitter.com"},SE={EMAIL_LINK:"emailLink",EMAIL_PASSWORD:"password",FACEBOOK:"facebook.com",GITHUB:"github.com",GOOGLE:"google.com",PHONE:"phone",TWITTER:"twitter.com"},PE={LINK:"link",REAUTHENTICATE:"reauthenticate",SIGN_IN:"signIn"},CE={EMAIL_SIGNIN:"EMAIL_SIGNIN",PASSWORD_RESET:"PASSWORD_RESET",RECOVER_EMAIL:"RECOVER_EMAIL",REVERT_SECOND_FACTOR_ADDITION:"REVERT_SECOND_FACTOR_ADDITION",VERIFY_AND_CHANGE_EMAIL:"VERIFY_AND_CHANGE_EMAIL",VERIFY_EMAIL:"VERIFY_EMAIL"};/**
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
 */function kE(){return{"admin-restricted-operation":"This operation is restricted to administrators only.","argument-error":"","app-not-authorized":"This app, identified by the domain where it's hosted, is not authorized to use Firebase Authentication with the provided API key. Review your key configuration in the Google API console.","app-not-installed":"The requested mobile application corresponding to the identifier (Android package name or iOS bundle ID) provided is not installed on this device.","captcha-check-failed":"The reCAPTCHA response token provided is either invalid, expired, already used or the domain associated with it does not match the list of whitelisted domains.","code-expired":"The SMS code has expired. Please re-send the verification code to try again.","cordova-not-ready":"Cordova framework is not ready.","cors-unsupported":"This browser is not supported.","credential-already-in-use":"This credential is already associated with a different user account.","custom-token-mismatch":"The custom token corresponds to a different audience.","requires-recent-login":"This operation is sensitive and requires recent authentication. Log in again before retrying this request.","dependent-sdk-initialized-before-auth":"Another Firebase SDK was initialized and is trying to use Auth before Auth is initialized. Please be sure to call `initializeAuth` or `getAuth` before starting any other Firebase SDK.","dynamic-link-not-activated":"Please activate Dynamic Links in the Firebase Console and agree to the terms and conditions.","email-change-needs-verification":"Multi-factor users must always have a verified email.","email-already-in-use":"The email address is already in use by another account.","emulator-config-failed":'Auth instance has already been used to make a network call. Auth can no longer be configured to use the emulator. Try calling "connectAuthEmulator()" sooner.',"expired-action-code":"The action code has expired.","cancelled-popup-request":"This operation has been cancelled due to another conflicting popup being opened.","internal-error":"An internal AuthError has occurred.","invalid-app-credential":"The phone verification request contains an invalid application verifier. The reCAPTCHA token response is either invalid or expired.","invalid-app-id":"The mobile app identifier is not registered for the current project.","invalid-user-token":"This user's credential isn't valid for this project. This can happen if the user's token has been tampered with, or if the user isn't for the project associated with this API key.","invalid-auth-event":"An internal AuthError has occurred.","invalid-verification-code":"The SMS verification code used to create the phone auth credential is invalid. Please resend the verification code sms and be sure to use the verification code provided by the user.","invalid-continue-uri":"The continue URL provided in the request is invalid.","invalid-cordova-configuration":"The following Cordova plugins must be installed to enable OAuth sign-in: cordova-plugin-buildinfo, cordova-universal-links-plugin, cordova-plugin-browsertab, cordova-plugin-inappbrowser and cordova-plugin-customurlscheme.","invalid-custom-token":"The custom token format is incorrect. Please check the documentation.","invalid-dynamic-link-domain":"The provided dynamic link domain is not configured or authorized for the current project.","invalid-email":"The email address is badly formatted.","invalid-emulator-scheme":"Emulator URL must start with a valid scheme (http:// or https://).","invalid-api-key":"Your API key is invalid, please check you have copied it correctly.","invalid-cert-hash":"The SHA-1 certificate hash provided is invalid.","invalid-credential":"The supplied auth credential is incorrect, malformed or has expired.","invalid-message-payload":"The email template corresponding to this action contains invalid characters in its message. Please fix by going to the Auth email templates section in the Firebase Console.","invalid-multi-factor-session":"The request does not contain a valid proof of first factor successful sign-in.","invalid-oauth-provider":"EmailAuthProvider is not supported for this operation. This operation only supports OAuth providers.","invalid-oauth-client-id":"The OAuth client ID provided is either invalid or does not match the specified API key.","unauthorized-domain":"This domain is not authorized for OAuth operations for your Firebase project. Edit the list of authorized domains from the Firebase console.","invalid-action-code":"The action code is invalid. This can happen if the code is malformed, expired, or has already been used.","wrong-password":"The password is invalid or the user does not have a password.","invalid-persistence-type":"The specified persistence type is invalid. It can only be local, session or none.","invalid-phone-number":"The format of the phone number provided is incorrect. Please enter the phone number in a format that can be parsed into E.164 format. E.164 phone numbers are written in the format [+][country code][subscriber number including area code].","invalid-provider-id":"The specified provider ID is invalid.","invalid-recipient-email":"The email corresponding to this action failed to send as the provided recipient email address is invalid.","invalid-sender":"The email template corresponding to this action contains an invalid sender email or name. Please fix by going to the Auth email templates section in the Firebase Console.","invalid-verification-id":"The verification ID used to create the phone auth credential is invalid.","invalid-tenant-id":"The Auth instance's tenant ID is invalid.","login-blocked":"Login blocked by user-provided method: {$originalMessage}","missing-android-pkg-name":"An Android Package Name must be provided if the Android App is required to be installed.","auth-domain-config-required":"Be sure to include authDomain when calling firebase.initializeApp(), by following the instructions in the Firebase console.","missing-app-credential":"The phone verification request is missing an application verifier assertion. A reCAPTCHA response token needs to be provided.","missing-verification-code":"The phone auth credential was created with an empty SMS verification code.","missing-continue-uri":"A continue URL must be provided in the request.","missing-iframe-start":"An internal AuthError has occurred.","missing-ios-bundle-id":"An iOS Bundle ID must be provided if an App Store ID is provided.","missing-or-invalid-nonce":"The request does not contain a valid nonce. This can occur if the SHA-256 hash of the provided raw nonce does not match the hashed nonce in the ID token payload.","missing-password":"A non-empty password must be provided","missing-multi-factor-info":"No second factor identifier is provided.","missing-multi-factor-session":"The request is missing proof of first factor successful sign-in.","missing-phone-number":"To send verification codes, provide a phone number for the recipient.","missing-verification-id":"The phone auth credential was created with an empty verification ID.","app-deleted":"This instance of FirebaseApp has been deleted.","multi-factor-info-not-found":"The user does not have a second factor matching the identifier provided.","multi-factor-auth-required":"Proof of ownership of a second factor is required to complete sign-in.","account-exists-with-different-credential":"An account already exists with the same email address but different sign-in credentials. Sign in using a provider associated with this email address.","network-request-failed":"A network AuthError (such as timeout, interrupted connection or unreachable host) has occurred.","no-auth-event":"An internal AuthError has occurred.","no-such-provider":"User was not linked to an account with the given provider.","null-user":"A null user object was provided as the argument for an operation which requires a non-null user object.","operation-not-allowed":"The given sign-in provider is disabled for this Firebase project. Enable it in the Firebase console, under the sign-in method tab of the Auth section.","operation-not-supported-in-this-environment":'This operation is not supported in the environment this application is running on. "location.protocol" must be http, https or chrome-extension and web storage must be enabled.',"popup-blocked":"Unable to establish a connection with the popup. It may have been blocked by the browser.","popup-closed-by-user":"The popup has been closed by the user before finalizing the operation.","provider-already-linked":"User can only be linked to one identity for the given provider.","quota-exceeded":"The project's quota for this operation has been exceeded.","redirect-cancelled-by-user":"The redirect operation has been cancelled by the user before finalizing.","redirect-operation-pending":"A redirect sign-in operation is already pending.","rejected-credential":"The request contains malformed or mismatching credentials.","second-factor-already-in-use":"The second factor is already enrolled on this account.","maximum-second-factor-count-exceeded":"The maximum allowed number of second factors on a user has been exceeded.","tenant-id-mismatch":"The provided tenant ID does not match the Auth instance's tenant ID",timeout:"The operation has timed out.","user-token-expired":"The user's credential is no longer valid. The user must sign in again.","too-many-requests":"We have blocked all requests from this device due to unusual activity. Try again later.","unauthorized-continue-uri":"The domain of the continue URL is not whitelisted.  Please whitelist the domain in the Firebase console.","unsupported-first-factor":"Enrolling a second factor or signing in with a multi-factor account requires sign-in with a supported first factor.","unsupported-persistence-type":"The current environment does not support the specified persistence type.","unsupported-tenant-operation":"This operation is not supported in a multi-tenant context.","unverified-email":"The operation requires a verified email.","user-cancelled":"The user did not grant your application the permissions it requested.","user-not-found":"There is no user record corresponding to this identifier. The user may have been deleted.","user-disabled":"The user account has been disabled by an administrator.","user-mismatch":"The supplied credentials do not correspond to the previously signed in user.","user-signed-out":"","weak-password":"The password must be 6 characters long or more.","web-storage-unsupported":"This browser is not supported or 3rd party cookies and data may be disabled.","already-initialized":"initializeAuth() has already been called with different options. To avoid this error, call initializeAuth() with the same options as when it was originally called, or call getAuth() to return the already initialized instance.","missing-recaptcha-token":"The reCAPTCHA token is missing when sending request to the backend.","invalid-recaptcha-token":"The reCAPTCHA token is invalid when sending request to the backend.","invalid-recaptcha-action":"The reCAPTCHA action is invalid when sending request to the backend.","recaptcha-not-enabled":"reCAPTCHA Enterprise integration is not enabled for this project.","missing-client-type":"The reCAPTCHA client type is missing when sending request to the backend.","missing-recaptcha-version":"The reCAPTCHA version is missing when sending request to the backend.","invalid-req-type":"Invalid request parameters.","invalid-recaptcha-version":"The reCAPTCHA version is invalid when sending request to the backend.","unsupported-password-policy-schema-version":"The password policy received from the backend uses a schema version that is not supported by this version of the Firebase SDK.","password-does-not-meet-requirements":"The password does not meet the requirements.","invalid-hosting-link-domain":"The provided Hosting link domain is not configured in Firebase Hosting or is not owned by the current project. This cannot be a default Hosting domain (`web.app` or `firebaseapp.com`)."}}function Bf(){return{"dependent-sdk-initialized-before-auth":"Another Firebase SDK was initialized and is trying to use Auth before Auth is initialized. Please be sure to call `initializeAuth` or `getAuth` before starting any other Firebase SDK."}}const NE=kE,$f=Bf,qf=new Et("auth","Firebase",Bf()),DE={ADMIN_ONLY_OPERATION:"auth/admin-restricted-operation",ARGUMENT_ERROR:"auth/argument-error",APP_NOT_AUTHORIZED:"auth/app-not-authorized",APP_NOT_INSTALLED:"auth/app-not-installed",CAPTCHA_CHECK_FAILED:"auth/captcha-check-failed",CODE_EXPIRED:"auth/code-expired",CORDOVA_NOT_READY:"auth/cordova-not-ready",CORS_UNSUPPORTED:"auth/cors-unsupported",CREDENTIAL_ALREADY_IN_USE:"auth/credential-already-in-use",CREDENTIAL_MISMATCH:"auth/custom-token-mismatch",CREDENTIAL_TOO_OLD_LOGIN_AGAIN:"auth/requires-recent-login",DEPENDENT_SDK_INIT_BEFORE_AUTH:"auth/dependent-sdk-initialized-before-auth",DYNAMIC_LINK_NOT_ACTIVATED:"auth/dynamic-link-not-activated",EMAIL_CHANGE_NEEDS_VERIFICATION:"auth/email-change-needs-verification",EMAIL_EXISTS:"auth/email-already-in-use",EMULATOR_CONFIG_FAILED:"auth/emulator-config-failed",EXPIRED_OOB_CODE:"auth/expired-action-code",EXPIRED_POPUP_REQUEST:"auth/cancelled-popup-request",INTERNAL_ERROR:"auth/internal-error",INVALID_API_KEY:"auth/invalid-api-key",INVALID_APP_CREDENTIAL:"auth/invalid-app-credential",INVALID_APP_ID:"auth/invalid-app-id",INVALID_AUTH:"auth/invalid-user-token",INVALID_AUTH_EVENT:"auth/invalid-auth-event",INVALID_CERT_HASH:"auth/invalid-cert-hash",INVALID_CODE:"auth/invalid-verification-code",INVALID_CONTINUE_URI:"auth/invalid-continue-uri",INVALID_CORDOVA_CONFIGURATION:"auth/invalid-cordova-configuration",INVALID_CUSTOM_TOKEN:"auth/invalid-custom-token",INVALID_DYNAMIC_LINK_DOMAIN:"auth/invalid-dynamic-link-domain",INVALID_EMAIL:"auth/invalid-email",INVALID_EMULATOR_SCHEME:"auth/invalid-emulator-scheme",INVALID_IDP_RESPONSE:"auth/invalid-credential",INVALID_LOGIN_CREDENTIALS:"auth/invalid-credential",INVALID_MESSAGE_PAYLOAD:"auth/invalid-message-payload",INVALID_MFA_SESSION:"auth/invalid-multi-factor-session",INVALID_OAUTH_CLIENT_ID:"auth/invalid-oauth-client-id",INVALID_OAUTH_PROVIDER:"auth/invalid-oauth-provider",INVALID_OOB_CODE:"auth/invalid-action-code",INVALID_ORIGIN:"auth/unauthorized-domain",INVALID_PASSWORD:"auth/wrong-password",INVALID_PERSISTENCE:"auth/invalid-persistence-type",INVALID_PHONE_NUMBER:"auth/invalid-phone-number",INVALID_PROVIDER_ID:"auth/invalid-provider-id",INVALID_RECIPIENT_EMAIL:"auth/invalid-recipient-email",INVALID_SENDER:"auth/invalid-sender",INVALID_SESSION_INFO:"auth/invalid-verification-id",INVALID_TENANT_ID:"auth/invalid-tenant-id",MFA_INFO_NOT_FOUND:"auth/multi-factor-info-not-found",MFA_REQUIRED:"auth/multi-factor-auth-required",MISSING_ANDROID_PACKAGE_NAME:"auth/missing-android-pkg-name",MISSING_APP_CREDENTIAL:"auth/missing-app-credential",MISSING_AUTH_DOMAIN:"auth/auth-domain-config-required",MISSING_CODE:"auth/missing-verification-code",MISSING_CONTINUE_URI:"auth/missing-continue-uri",MISSING_IFRAME_START:"auth/missing-iframe-start",MISSING_IOS_BUNDLE_ID:"auth/missing-ios-bundle-id",MISSING_OR_INVALID_NONCE:"auth/missing-or-invalid-nonce",MISSING_MFA_INFO:"auth/missing-multi-factor-info",MISSING_MFA_SESSION:"auth/missing-multi-factor-session",MISSING_PHONE_NUMBER:"auth/missing-phone-number",MISSING_PASSWORD:"auth/missing-password",MISSING_SESSION_INFO:"auth/missing-verification-id",MODULE_DESTROYED:"auth/app-deleted",NEED_CONFIRMATION:"auth/account-exists-with-different-credential",NETWORK_REQUEST_FAILED:"auth/network-request-failed",NULL_USER:"auth/null-user",NO_AUTH_EVENT:"auth/no-auth-event",NO_SUCH_PROVIDER:"auth/no-such-provider",OPERATION_NOT_ALLOWED:"auth/operation-not-allowed",OPERATION_NOT_SUPPORTED:"auth/operation-not-supported-in-this-environment",POPUP_BLOCKED:"auth/popup-blocked",POPUP_CLOSED_BY_USER:"auth/popup-closed-by-user",PROVIDER_ALREADY_LINKED:"auth/provider-already-linked",QUOTA_EXCEEDED:"auth/quota-exceeded",REDIRECT_CANCELLED_BY_USER:"auth/redirect-cancelled-by-user",REDIRECT_OPERATION_PENDING:"auth/redirect-operation-pending",REJECTED_CREDENTIAL:"auth/rejected-credential",SECOND_FACTOR_ALREADY_ENROLLED:"auth/second-factor-already-in-use",SECOND_FACTOR_LIMIT_EXCEEDED:"auth/maximum-second-factor-count-exceeded",TENANT_ID_MISMATCH:"auth/tenant-id-mismatch",TIMEOUT:"auth/timeout",TOKEN_EXPIRED:"auth/user-token-expired",TOO_MANY_ATTEMPTS_TRY_LATER:"auth/too-many-requests",UNAUTHORIZED_DOMAIN:"auth/unauthorized-continue-uri",UNSUPPORTED_FIRST_FACTOR:"auth/unsupported-first-factor",UNSUPPORTED_PERSISTENCE:"auth/unsupported-persistence-type",UNSUPPORTED_TENANT_OPERATION:"auth/unsupported-tenant-operation",UNVERIFIED_EMAIL:"auth/unverified-email",USER_CANCELLED:"auth/user-cancelled",USER_DELETED:"auth/user-not-found",USER_DISABLED:"auth/user-disabled",USER_MISMATCH:"auth/user-mismatch",USER_SIGNED_OUT:"auth/user-signed-out",WEAK_PASSWORD:"auth/weak-password",WEB_STORAGE_UNSUPPORTED:"auth/web-storage-unsupported",ALREADY_INITIALIZED:"auth/already-initialized",RECAPTCHA_NOT_ENABLED:"auth/recaptcha-not-enabled",MISSING_RECAPTCHA_TOKEN:"auth/missing-recaptcha-token",INVALID_RECAPTCHA_TOKEN:"auth/invalid-recaptcha-token",INVALID_RECAPTCHA_ACTION:"auth/invalid-recaptcha-action",MISSING_CLIENT_TYPE:"auth/missing-client-type",MISSING_RECAPTCHA_VERSION:"auth/missing-recaptcha-version",INVALID_RECAPTCHA_VERSION:"auth/invalid-recaptcha-version",INVALID_REQ_TYPE:"auth/invalid-req-type",INVALID_HOSTING_LINK_DOMAIN:"auth/invalid-hosting-link-domain"};/**
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
 */const Vs=new _r("@firebase/auth");function OE(n,...e){Vs.logLevel<=z.WARN&&Vs.warn(`Auth (${Vn}): ${n}`,...e)}function Es(n,...e){Vs.logLevel<=z.ERROR&&Vs.error(`Auth (${Vn}): ${n}`,...e)}/**
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
 */function Ge(n,...e){throw Nc(n,...e)}function $e(n,...e){return Nc(n,...e)}function kc(n,e,t){const r={...$f(),[e]:t};return new Et("auth","Firebase",r).create(e,{appName:n.name})}function Ae(n){return kc(n,"operation-not-supported-in-this-environment","Operations that alter the current user are not supported in conjunction with FirebaseServerApp")}function Tr(n,e,t){const r=t;if(!(e instanceof r))throw r.name!==e.constructor.name&&Ge(n,"argument-error"),kc(n,"argument-error",`Type of ${e.constructor.name} does not match expected instance.Did you pass a reference from a different Auth SDK?`)}function Nc(n,...e){if(typeof n!="string"){const t=e[0],r=[...e.slice(1)];return r[0]&&(r[0].appName=n.name),n._errorFactory.create(t,...r)}return qf.create(n,...e)}function C(n,e,...t){if(!n)throw Nc(e,...t)}function ft(n){const e="INTERNAL ASSERTION FAILED: "+n;throw Es(e),new Error(e)}function Vt(n,e){n||ft(e)}/**
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
 */function yi(){var n;return typeof self<"u"&&((n=self.location)==null?void 0:n.href)||""}function Dc(){return wh()==="http:"||wh()==="https:"}function wh(){var n;return typeof self<"u"&&((n=self.location)==null?void 0:n.protocol)||null}/**
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
 */function VE(){return typeof navigator<"u"&&navigator&&"onLine"in navigator&&typeof navigator.onLine=="boolean"&&(Dc()||Pc()||"connection"in navigator)?navigator.onLine:!0}function ME(){if(typeof navigator>"u")return null;const n=navigator;return n.languages&&n.languages[0]||n.language||null}/**
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
 */class Oi{constructor(e,t){this.shortDelay=e,this.longDelay=t,Vt(t>e,"Short delay should be less than long delay!"),this.isMobile=Qy()||Zy()}get(){return VE()?this.isMobile?this.longDelay:this.shortDelay:Math.min(5e3,this.shortDelay)}}/**
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
 */function Oc(n,e){Vt(n.emulator,"Emulator should always be set here");const{url:t}=n.emulator;return e?`${t}${e.startsWith("/")?e.slice(1):e}`:t}/**
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
 */class jf{static initialize(e,t,r){this.fetchImpl=e,t&&(this.headersImpl=t),r&&(this.responseImpl=r)}static fetch(){if(this.fetchImpl)return this.fetchImpl;if(typeof self<"u"&&"fetch"in self)return self.fetch;if(typeof globalThis<"u"&&globalThis.fetch)return globalThis.fetch;if(typeof fetch<"u")return fetch;ft("Could not find fetch implementation, make sure you call FetchProvider.initialize() with an appropriate polyfill")}static headers(){if(this.headersImpl)return this.headersImpl;if(typeof self<"u"&&"Headers"in self)return self.Headers;if(typeof globalThis<"u"&&globalThis.Headers)return globalThis.Headers;if(typeof Headers<"u")return Headers;ft("Could not find Headers implementation, make sure you call FetchProvider.initialize() with an appropriate polyfill")}static response(){if(this.responseImpl)return this.responseImpl;if(typeof self<"u"&&"Response"in self)return self.Response;if(typeof globalThis<"u"&&globalThis.Response)return globalThis.Response;if(typeof Response<"u")return Response;ft("Could not find Response implementation, make sure you call FetchProvider.initialize() with an appropriate polyfill")}}/**
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
 */const LE={CREDENTIAL_MISMATCH:"custom-token-mismatch",MISSING_CUSTOM_TOKEN:"internal-error",INVALID_IDENTIFIER:"invalid-email",MISSING_CONTINUE_URI:"internal-error",INVALID_PASSWORD:"wrong-password",MISSING_PASSWORD:"missing-password",INVALID_LOGIN_CREDENTIALS:"invalid-credential",EMAIL_EXISTS:"email-already-in-use",PASSWORD_LOGIN_DISABLED:"operation-not-allowed",INVALID_IDP_RESPONSE:"invalid-credential",INVALID_PENDING_TOKEN:"invalid-credential",FEDERATED_USER_ID_ALREADY_LINKED:"credential-already-in-use",MISSING_REQ_TYPE:"internal-error",EMAIL_NOT_FOUND:"user-not-found",RESET_PASSWORD_EXCEED_LIMIT:"too-many-requests",EXPIRED_OOB_CODE:"expired-action-code",INVALID_OOB_CODE:"invalid-action-code",MISSING_OOB_CODE:"internal-error",CREDENTIAL_TOO_OLD_LOGIN_AGAIN:"requires-recent-login",INVALID_ID_TOKEN:"invalid-user-token",TOKEN_EXPIRED:"user-token-expired",USER_NOT_FOUND:"user-token-expired",TOO_MANY_ATTEMPTS_TRY_LATER:"too-many-requests",PASSWORD_DOES_NOT_MEET_REQUIREMENTS:"password-does-not-meet-requirements",INVALID_CODE:"invalid-verification-code",INVALID_SESSION_INFO:"invalid-verification-id",INVALID_TEMPORARY_PROOF:"invalid-credential",MISSING_SESSION_INFO:"missing-verification-id",SESSION_EXPIRED:"code-expired",MISSING_ANDROID_PACKAGE_NAME:"missing-android-pkg-name",UNAUTHORIZED_DOMAIN:"unauthorized-continue-uri",INVALID_OAUTH_CLIENT_ID:"invalid-oauth-client-id",ADMIN_ONLY_OPERATION:"admin-restricted-operation",INVALID_MFA_PENDING_CREDENTIAL:"invalid-multi-factor-session",MFA_ENROLLMENT_NOT_FOUND:"multi-factor-info-not-found",MISSING_MFA_ENROLLMENT_ID:"missing-multi-factor-info",MISSING_MFA_PENDING_CREDENTIAL:"missing-multi-factor-session",SECOND_FACTOR_EXISTS:"second-factor-already-in-use",SECOND_FACTOR_LIMIT_EXCEEDED:"maximum-second-factor-count-exceeded",BLOCKING_FUNCTION_ERROR_RESPONSE:"internal-error",RECAPTCHA_NOT_ENABLED:"recaptcha-not-enabled",MISSING_RECAPTCHA_TOKEN:"missing-recaptcha-token",INVALID_RECAPTCHA_TOKEN:"invalid-recaptcha-token",INVALID_RECAPTCHA_ACTION:"invalid-recaptcha-action",MISSING_CLIENT_TYPE:"missing-client-type",MISSING_RECAPTCHA_VERSION:"missing-recaptcha-version",INVALID_RECAPTCHA_VERSION:"invalid-recaptcha-version",INVALID_REQ_TYPE:"invalid-req-type"};/**
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
 */const UE=["/v1/accounts:signInWithCustomToken","/v1/accounts:signInWithEmailLink","/v1/accounts:signInWithIdp","/v1/accounts:signInWithPassword","/v1/accounts:signInWithPhoneNumber","/v1/token"],xE=new Oi(3e4,6e4);function ne(n,e){return n.tenantId&&!e.tenantId?{...e,tenantId:n.tenantId}:e}async function re(n,e,t,r,i={}){return Hf(n,i,async()=>{let s={},a={};r&&(e==="GET"?a=r:s={body:JSON.stringify(r)});const c=gr({key:n.config.apiKey,...a}).slice(1),u=await n._getAdditionalHeaders();u["Content-Type"]="application/json",n.languageCode&&(u["X-Firebase-Locale"]=n.languageCode);const h={method:e,headers:u,...s};return Xy()||(h.referrerPolicy="no-referrer"),n.emulatorConfig&&fn(n.emulatorConfig.host)&&(h.credentials="include"),jf.fetch()(await zf(n,n.config.apiHost,t,c),h)})}async function Hf(n,e,t){n._canInitEmulator=!1;const r={...LE,...e};try{const i=new BE(n),s=await Promise.race([t(),i.promise]);i.clearNetworkTimeout();const a=await s.json();if("needConfirmation"in a)throw Xr(n,"account-exists-with-different-credential",a);if(s.ok&&!("errorMessage"in a))return a;{const c=s.ok?a.errorMessage:a.error.message,[u,h]=c.split(" : ");if(u==="FEDERATED_USER_ID_ALREADY_LINKED")throw Xr(n,"credential-already-in-use",a);if(u==="EMAIL_EXISTS")throw Xr(n,"email-already-in-use",a);if(u==="USER_DISABLED")throw Xr(n,"user-disabled",a);const f=r[u]||u.toLowerCase().replace(/[_\s]+/g,"-");if(h)throw kc(n,f,h);Ge(n,f)}}catch(i){if(i instanceof rt)throw i;Ge(n,"network-request-failed",{message:String(i)})}}async function Ft(n,e,t,r,i={}){const s=await re(n,e,t,r,i);return"mfaPendingCredential"in s&&Ge(n,"multi-factor-auth-required",{_serverResponse:s}),s}async function zf(n,e,t,r){const i=`${e}${t}?${r}`,s=n,a=s.config.emulator?Oc(n.config,i):`${n.config.apiScheme}://${i}`;return UE.includes(t)&&(await s._persistenceManagerAvailable,s._getPersistenceType()==="COOKIE")?s._getPersistence()._getFinalTarget(a).toString():a}function FE(n){switch(n){case"ENFORCE":return"ENFORCE";case"AUDIT":return"AUDIT";case"OFF":return"OFF";default:return"ENFORCEMENT_STATE_UNSPECIFIED"}}class BE{clearNetworkTimeout(){clearTimeout(this.timer)}constructor(e){this.auth=e,this.timer=null,this.promise=new Promise((t,r)=>{this.timer=setTimeout(()=>r($e(this.auth,"network-request-failed")),xE.get())})}}function Xr(n,e,t){const r={appName:n.name};t.email&&(r.email=t.email),t.phoneNumber&&(r.phoneNumber=t.phoneNumber);const i=$e(n,e,r);return i.customData._tokenResponse=t,i}/**
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
 */function vh(n){return n!==void 0&&n.getResponse!==void 0}function Ah(n){return n!==void 0&&n.enterprise!==void 0}class Wf{constructor(e){if(this.siteKey="",this.recaptchaEnforcementState=[],e.recaptchaKey===void 0)throw new Error("recaptchaKey undefined");this.siteKey=e.recaptchaKey.split("/")[3],this.recaptchaEnforcementState=e.recaptchaEnforcementState}getProviderEnforcementState(e){if(!this.recaptchaEnforcementState||this.recaptchaEnforcementState.length===0)return null;for(const t of this.recaptchaEnforcementState)if(t.provider&&t.provider===e)return FE(t.enforcementState);return null}isProviderEnabled(e){return this.getProviderEnforcementState(e)==="ENFORCE"||this.getProviderEnforcementState(e)==="AUDIT"}isAnyProviderEnabled(){return this.isProviderEnabled("EMAIL_PASSWORD_PROVIDER")||this.isProviderEnabled("PHONE_PROVIDER")}}/**
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
 */async function $E(n){return(await re(n,"GET","/v1/recaptchaParams")).recaptchaSiteKey||""}async function Gf(n,e){return re(n,"GET","/v2/recaptchaConfig",ne(n,e))}/**
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
 */async function qE(n,e){return re(n,"POST","/v1/accounts:delete",e)}async function jE(n,e){return re(n,"POST","/v1/accounts:update",e)}async function Ms(n,e){return re(n,"POST","/v1/accounts:lookup",e)}/**
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
 */function ii(n){if(n)try{const e=new Date(Number(n));if(!isNaN(e.getTime()))return e.toUTCString()}catch{}}/**
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
 */function HE(n,e=!1){return L(n).getIdToken(e)}async function Kf(n,e=!1){const t=L(n),r=await t.getIdToken(e),i=ao(r);C(i&&i.exp&&i.auth_time&&i.iat,t.auth,"internal-error");const s=typeof i.firebase=="object"?i.firebase:void 0,a=s==null?void 0:s.sign_in_provider;return{claims:i,token:r,authTime:ii(pa(i.auth_time)),issuedAtTime:ii(pa(i.iat)),expirationTime:ii(pa(i.exp)),signInProvider:a||null,signInSecondFactor:(s==null?void 0:s.sign_in_second_factor)||null}}function pa(n){return Number(n)*1e3}function ao(n){const[e,t,r]=n.split(".");if(e===void 0||t===void 0||r===void 0)return Es("JWT malformed, contained fewer than 3 sections"),null;try{const i=Os(t);return i?JSON.parse(i):(Es("Failed to decode base64 JWT payload"),null)}catch(i){return Es("Caught error parsing JWT payload as JSON",i==null?void 0:i.toString()),null}}function Rh(n){const e=ao(n);return C(e,"internal-error"),C(typeof e.exp<"u","internal-error"),C(typeof e.iat<"u","internal-error"),Number(e.exp)-Number(e.iat)}/**
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
 */async function Mt(n,e,t=!1){if(t)return e;try{return await e}catch(r){throw r instanceof rt&&zE(r)&&n.auth.currentUser===n&&await n.auth.signOut(),r}}function zE({code:n}){return n==="auth/user-disabled"||n==="auth/user-token-expired"}/**
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
 */class WE{constructor(e){this.user=e,this.isRunning=!1,this.timerId=null,this.errorBackoff=3e4}_start(){this.isRunning||(this.isRunning=!0,this.schedule())}_stop(){this.isRunning&&(this.isRunning=!1,this.timerId!==null&&clearTimeout(this.timerId))}getInterval(e){if(e){const t=this.errorBackoff;return this.errorBackoff=Math.min(this.errorBackoff*2,96e4),t}else{this.errorBackoff=3e4;const r=(this.user.stsTokenManager.expirationTime??0)-Date.now()-3e5;return Math.max(0,r)}}schedule(e=!1){if(!this.isRunning)return;const t=this.getInterval(e);this.timerId=setTimeout(async()=>{await this.iteration()},t)}async iteration(){try{await this.user.getIdToken(!0)}catch(e){(e==null?void 0:e.code)==="auth/network-request-failed"&&this.schedule(!0);return}this.schedule()}}/**
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
 */class Qa{constructor(e,t){this.createdAt=e,this.lastLoginAt=t,this._initializeTime()}_initializeTime(){this.lastSignInTime=ii(this.lastLoginAt),this.creationTime=ii(this.createdAt)}_copy(e){this.createdAt=e.createdAt,this.lastLoginAt=e.lastLoginAt,this._initializeTime()}toJSON(){return{createdAt:this.createdAt,lastLoginAt:this.lastLoginAt}}}/**
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
 */async function Ti(n){var m;const e=n.auth,t=await n.getIdToken(),r=await Mt(n,Ms(e,{idToken:t}));C(r==null?void 0:r.users.length,e,"internal-error");const i=r.users[0];n._notifyReloadListener(i);const s=(m=i.providerUserInfo)!=null&&m.length?Qf(i.providerUserInfo):[],a=GE(n.providerData,s),c=n.isAnonymous,u=!(n.email&&i.passwordHash)&&!(a!=null&&a.length),h=c?u:!1,f={uid:i.localId,displayName:i.displayName||null,photoURL:i.photoUrl||null,email:i.email||null,emailVerified:i.emailVerified||!1,phoneNumber:i.phoneNumber||null,tenantId:i.tenantId||null,providerData:a,metadata:new Qa(i.createdAt,i.lastLoginAt),isAnonymous:h};Object.assign(n,f)}async function Yf(n){const e=L(n);await Ti(e),await e.auth._persistUserIfCurrent(e),e.auth._notifyListenersIfCurrent(e)}function GE(n,e){return[...n.filter(r=>!e.some(i=>i.providerId===r.providerId)),...e]}function Qf(n){return n.map(({providerId:e,...t})=>({providerId:e,uid:t.rawId||"",displayName:t.displayName||null,email:t.email||null,phoneNumber:t.phoneNumber||null,photoURL:t.photoUrl||null}))}/**
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
 */async function KE(n,e){const t=await Hf(n,{},async()=>{const r=gr({grant_type:"refresh_token",refresh_token:e}).slice(1),{tokenApiHost:i,apiKey:s}=n.config,a=await zf(n,i,"/v1/token",`key=${s}`),c=await n._getAdditionalHeaders();c["Content-Type"]="application/x-www-form-urlencoded";const u={method:"POST",headers:c,body:r};return n.emulatorConfig&&fn(n.emulatorConfig.host)&&(u.credentials="include"),jf.fetch()(a,u)});return{accessToken:t.access_token,expiresIn:t.expires_in,refreshToken:t.refresh_token}}async function YE(n,e){return re(n,"POST","/v2/accounts:revokeToken",ne(n,e))}/**
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
 */class Xn{constructor(){this.refreshToken=null,this.accessToken=null,this.expirationTime=null}get isExpired(){return!this.expirationTime||Date.now()>this.expirationTime-3e4}updateFromServerResponse(e){C(e.idToken,"internal-error"),C(typeof e.idToken<"u","internal-error"),C(typeof e.refreshToken<"u","internal-error");const t="expiresIn"in e&&typeof e.expiresIn<"u"?Number(e.expiresIn):Rh(e.idToken);this.updateTokensAndExpiration(e.idToken,e.refreshToken,t)}updateFromIdToken(e){C(e.length!==0,"internal-error");const t=Rh(e);this.updateTokensAndExpiration(e,null,t)}async getToken(e,t=!1){return!t&&this.accessToken&&!this.isExpired?this.accessToken:(C(this.refreshToken,e,"user-token-expired"),this.refreshToken?(await this.refresh(e,this.refreshToken),this.accessToken):null)}clearRefreshToken(){this.refreshToken=null}async refresh(e,t){const{accessToken:r,refreshToken:i,expiresIn:s}=await KE(e,t);this.updateTokensAndExpiration(r,i,Number(s))}updateTokensAndExpiration(e,t,r){this.refreshToken=t||null,this.accessToken=e||null,this.expirationTime=Date.now()+r*1e3}static fromJSON(e,t){const{refreshToken:r,accessToken:i,expirationTime:s}=t,a=new Xn;return r&&(C(typeof r=="string","internal-error",{appName:e}),a.refreshToken=r),i&&(C(typeof i=="string","internal-error",{appName:e}),a.accessToken=i),s&&(C(typeof s=="number","internal-error",{appName:e}),a.expirationTime=s),a}toJSON(){return{refreshToken:this.refreshToken,accessToken:this.accessToken,expirationTime:this.expirationTime}}_assign(e){this.accessToken=e.accessToken,this.refreshToken=e.refreshToken,this.expirationTime=e.expirationTime}_clone(){return Object.assign(new Xn,this.toJSON())}_performRefresh(){return ft("not implemented")}}/**
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
 */function Gt(n,e){C(typeof n=="string"||typeof n>"u","internal-error",{appName:e})}class st{constructor({uid:e,auth:t,stsTokenManager:r,...i}){this.providerId="firebase",this.proactiveRefresh=new WE(this),this.reloadUserInfo=null,this.reloadListener=null,this.uid=e,this.auth=t,this.stsTokenManager=r,this.accessToken=r.accessToken,this.displayName=i.displayName||null,this.email=i.email||null,this.emailVerified=i.emailVerified||!1,this.phoneNumber=i.phoneNumber||null,this.photoURL=i.photoURL||null,this.isAnonymous=i.isAnonymous||!1,this.tenantId=i.tenantId||null,this.providerData=i.providerData?[...i.providerData]:[],this.metadata=new Qa(i.createdAt||void 0,i.lastLoginAt||void 0)}async getIdToken(e){const t=await Mt(this,this.stsTokenManager.getToken(this.auth,e));return C(t,this.auth,"internal-error"),this.accessToken!==t&&(this.accessToken=t,await this.auth._persistUserIfCurrent(this),this.auth._notifyListenersIfCurrent(this)),t}getIdTokenResult(e){return Kf(this,e)}reload(){return Yf(this)}_assign(e){this!==e&&(C(this.uid===e.uid,this.auth,"internal-error"),this.displayName=e.displayName,this.photoURL=e.photoURL,this.email=e.email,this.emailVerified=e.emailVerified,this.phoneNumber=e.phoneNumber,this.isAnonymous=e.isAnonymous,this.tenantId=e.tenantId,this.providerData=e.providerData.map(t=>({...t})),this.metadata._copy(e.metadata),this.stsTokenManager._assign(e.stsTokenManager))}_clone(e){const t=new st({...this,auth:e,stsTokenManager:this.stsTokenManager._clone()});return t.metadata._copy(this.metadata),t}_onReload(e){C(!this.reloadListener,this.auth,"internal-error"),this.reloadListener=e,this.reloadUserInfo&&(this._notifyReloadListener(this.reloadUserInfo),this.reloadUserInfo=null)}_notifyReloadListener(e){this.reloadListener?this.reloadListener(e):this.reloadUserInfo=e}_startProactiveRefresh(){this.proactiveRefresh._start()}_stopProactiveRefresh(){this.proactiveRefresh._stop()}async _updateTokensIfNecessary(e,t=!1){let r=!1;e.idToken&&e.idToken!==this.stsTokenManager.accessToken&&(this.stsTokenManager.updateFromServerResponse(e),r=!0),t&&await Ti(this),await this.auth._persistUserIfCurrent(this),r&&this.auth._notifyListenersIfCurrent(this)}async delete(){if(ie(this.auth.app))return Promise.reject(Ae(this.auth));const e=await this.getIdToken();return await Mt(this,qE(this.auth,{idToken:e})),this.stsTokenManager.clearRefreshToken(),this.auth.signOut()}toJSON(){return{uid:this.uid,email:this.email||void 0,emailVerified:this.emailVerified,displayName:this.displayName||void 0,isAnonymous:this.isAnonymous,photoURL:this.photoURL||void 0,phoneNumber:this.phoneNumber||void 0,tenantId:this.tenantId||void 0,providerData:this.providerData.map(e=>({...e})),stsTokenManager:this.stsTokenManager.toJSON(),_redirectEventId:this._redirectEventId,...this.metadata.toJSON(),apiKey:this.auth.config.apiKey,appName:this.auth.name}}get refreshToken(){return this.stsTokenManager.refreshToken||""}static _fromJSON(e,t){const r=t.displayName??void 0,i=t.email??void 0,s=t.phoneNumber??void 0,a=t.photoURL??void 0,c=t.tenantId??void 0,u=t._redirectEventId??void 0,h=t.createdAt??void 0,f=t.lastLoginAt??void 0,{uid:m,emailVerified:y,isAnonymous:b,providerData:k,stsTokenManager:V}=t;C(m&&V,e,"internal-error");const N=Xn.fromJSON(this.name,V);C(typeof m=="string",e,"internal-error"),Gt(r,e.name),Gt(i,e.name),C(typeof y=="boolean",e,"internal-error"),C(typeof b=="boolean",e,"internal-error"),Gt(s,e.name),Gt(a,e.name),Gt(c,e.name),Gt(u,e.name),Gt(h,e.name),Gt(f,e.name);const F=new st({uid:m,auth:e,email:i,emailVerified:y,displayName:r,isAnonymous:b,photoURL:a,phoneNumber:s,tenantId:c,stsTokenManager:N,createdAt:h,lastLoginAt:f});return k&&Array.isArray(k)&&(F.providerData=k.map($=>({...$}))),u&&(F._redirectEventId=u),F}static async _fromIdTokenResponse(e,t,r=!1){const i=new Xn;i.updateFromServerResponse(t);const s=new st({uid:t.localId,auth:e,stsTokenManager:i,isAnonymous:r});return await Ti(s),s}static async _fromGetAccountInfoResponse(e,t,r){const i=t.users[0];C(i.localId!==void 0,"internal-error");const s=i.providerUserInfo!==void 0?Qf(i.providerUserInfo):[],a=!(i.email&&i.passwordHash)&&!(s!=null&&s.length),c=new Xn;c.updateFromIdToken(r);const u=new st({uid:i.localId,auth:e,stsTokenManager:c,isAnonymous:a}),h={uid:i.localId,displayName:i.displayName||null,photoURL:i.photoUrl||null,email:i.email||null,emailVerified:i.emailVerified||!1,phoneNumber:i.phoneNumber||null,tenantId:i.tenantId||null,providerData:s,metadata:new Qa(i.createdAt,i.lastLoginAt),isAnonymous:!(i.email&&i.passwordHash)&&!(s!=null&&s.length)};return Object.assign(u,h),u}}/**
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
 */const bh=new Map;function bt(n){Vt(n instanceof Function,"Expected a class definition");let e=bh.get(n);return e?(Vt(e instanceof n,"Instance stored in cache mismatched with class"),e):(e=new n,bh.set(n,e),e)}/**
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
 */class Jf{constructor(){this.type="NONE",this.storage={}}async _isAvailable(){return!0}async _set(e,t){this.storage[e]=t}async _get(e){const t=this.storage[e];return t===void 0?null:t}async _remove(e){delete this.storage[e]}_addListener(e,t){}_removeListener(e,t){}}Jf.type="NONE";const Ja=Jf;/**
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
 */function Is(n,e,t){return`firebase:${n}:${e}:${t}`}class Zn{constructor(e,t,r){this.persistence=e,this.auth=t,this.userKey=r;const{config:i,name:s}=this.auth;this.fullUserKey=Is(this.userKey,i.apiKey,s),this.fullPersistenceKey=Is("persistence",i.apiKey,s),this.boundEventHandler=t._onStorageEvent.bind(t),this.persistence._addListener(this.fullUserKey,this.boundEventHandler)}setCurrentUser(e){return this.persistence._set(this.fullUserKey,e.toJSON())}async getCurrentUser(){const e=await this.persistence._get(this.fullUserKey);if(!e)return null;if(typeof e=="string"){const t=await Ms(this.auth,{idToken:e}).catch(()=>{});return t?st._fromGetAccountInfoResponse(this.auth,t,e):null}return st._fromJSON(this.auth,e)}removeCurrentUser(){return this.persistence._remove(this.fullUserKey)}savePersistenceForRedirect(){return this.persistence._set(this.fullPersistenceKey,this.persistence.type)}async setPersistence(e){if(this.persistence===e)return;const t=await this.getCurrentUser();if(await this.removeCurrentUser(),this.persistence=e,t)return this.setCurrentUser(t)}delete(){this.persistence._removeListener(this.fullUserKey,this.boundEventHandler)}static async create(e,t,r="authUser"){if(!t.length)return new Zn(bt(Ja),e,r);const i=(await Promise.all(t.map(async h=>{if(await h._isAvailable())return h}))).filter(h=>h);let s=i[0]||bt(Ja);const a=Is(r,e.config.apiKey,e.name);let c=null;for(const h of t)try{const f=await h._get(a);if(f){let m;if(typeof f=="string"){const y=await Ms(e,{idToken:f}).catch(()=>{});if(!y)break;m=await st._fromGetAccountInfoResponse(e,y,f)}else m=st._fromJSON(e,f);h!==s&&(c=m),s=h;break}}catch{}const u=i.filter(h=>h._shouldAllowMigration);return!s._shouldAllowMigration||!u.length?new Zn(s,e,r):(s=u[0],c&&await s._set(a,c.toJSON()),await Promise.all(t.map(async h=>{if(h!==s)try{await h._remove(a)}catch{}})),new Zn(s,e,r))}}/**
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
 */function Sh(n){const e=n.toLowerCase();if(e.includes("opera/")||e.includes("opr/")||e.includes("opios/"))return"Opera";if(tp(e))return"IEMobile";if(e.includes("msie")||e.includes("trident/"))return"IE";if(e.includes("edge/"))return"Edge";if(Xf(e))return"Firefox";if(e.includes("silk/"))return"Silk";if(rp(e))return"Blackberry";if(ip(e))return"Webos";if(Zf(e))return"Safari";if((e.includes("chrome/")||ep(e))&&!e.includes("edge/"))return"Chrome";if(np(e))return"Android";{const t=/([a-zA-Z\d\.]+)\/[a-zA-Z\d\.]*$/,r=n.match(t);if((r==null?void 0:r.length)===2)return r[1]}return"Other"}function Xf(n=Me()){return/firefox\//i.test(n)}function Zf(n=Me()){const e=n.toLowerCase();return e.includes("safari/")&&!e.includes("chrome/")&&!e.includes("crios/")&&!e.includes("android")}function ep(n=Me()){return/crios\//i.test(n)}function tp(n=Me()){return/iemobile/i.test(n)}function np(n=Me()){return/android/i.test(n)}function rp(n=Me()){return/blackberry/i.test(n)}function ip(n=Me()){return/webos/i.test(n)}function Vc(n=Me()){return/iphone|ipad|ipod/i.test(n)||/macintosh/i.test(n)&&/mobile/i.test(n)}function QE(n=Me()){var e;return Vc(n)&&!!((e=window.navigator)!=null&&e.standalone)}function JE(){return eT()&&document.documentMode===10}function sp(n=Me()){return Vc(n)||np(n)||ip(n)||rp(n)||/windows phone/i.test(n)||tp(n)}/**
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
 */function op(n,e=[]){let t;switch(n){case"Browser":t=Sh(Me());break;case"Worker":t=`${Sh(Me())}-${n}`;break;default:t=n}const r=e.length?e.join(","):"FirebaseCore-web";return`${t}/JsCore/${Vn}/${r}`}/**
 * @license
 * Copyright 2022 Google LLC
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
 */class XE{constructor(e){this.auth=e,this.queue=[]}pushCallback(e,t){const r=s=>new Promise((a,c)=>{try{const u=e(s);a(u)}catch(u){c(u)}});r.onAbort=t,this.queue.push(r);const i=this.queue.length-1;return()=>{this.queue[i]=()=>Promise.resolve()}}async runMiddleware(e){if(this.auth.currentUser===e)return;const t=[];try{for(const r of this.queue)await r(e),r.onAbort&&t.push(r.onAbort)}catch(r){t.reverse();for(const i of t)try{i()}catch{}throw this.auth._errorFactory.create("login-blocked",{originalMessage:r==null?void 0:r.message})}}}/**
 * @license
 * Copyright 2023 Google LLC
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
 */async function ZE(n,e={}){return re(n,"GET","/v2/passwordPolicy",ne(n,e))}/**
 * @license
 * Copyright 2023 Google LLC
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
 */const eI=6;class tI{constructor(e){var r;const t=e.customStrengthOptions;this.customStrengthOptions={},this.customStrengthOptions.minPasswordLength=t.minPasswordLength??eI,t.maxPasswordLength&&(this.customStrengthOptions.maxPasswordLength=t.maxPasswordLength),t.containsLowercaseCharacter!==void 0&&(this.customStrengthOptions.containsLowercaseLetter=t.containsLowercaseCharacter),t.containsUppercaseCharacter!==void 0&&(this.customStrengthOptions.containsUppercaseLetter=t.containsUppercaseCharacter),t.containsNumericCharacter!==void 0&&(this.customStrengthOptions.containsNumericCharacter=t.containsNumericCharacter),t.containsNonAlphanumericCharacter!==void 0&&(this.customStrengthOptions.containsNonAlphanumericCharacter=t.containsNonAlphanumericCharacter),this.enforcementState=e.enforcementState,this.enforcementState==="ENFORCEMENT_STATE_UNSPECIFIED"&&(this.enforcementState="OFF"),this.allowedNonAlphanumericCharacters=((r=e.allowedNonAlphanumericCharacters)==null?void 0:r.join(""))??"",this.forceUpgradeOnSignin=e.forceUpgradeOnSignin??!1,this.schemaVersion=e.schemaVersion}validatePassword(e){const t={isValid:!0,passwordPolicy:this};return this.validatePasswordLengthOptions(e,t),this.validatePasswordCharacterOptions(e,t),t.isValid&&(t.isValid=t.meetsMinPasswordLength??!0),t.isValid&&(t.isValid=t.meetsMaxPasswordLength??!0),t.isValid&&(t.isValid=t.containsLowercaseLetter??!0),t.isValid&&(t.isValid=t.containsUppercaseLetter??!0),t.isValid&&(t.isValid=t.containsNumericCharacter??!0),t.isValid&&(t.isValid=t.containsNonAlphanumericCharacter??!0),t}validatePasswordLengthOptions(e,t){const r=this.customStrengthOptions.minPasswordLength,i=this.customStrengthOptions.maxPasswordLength;r&&(t.meetsMinPasswordLength=e.length>=r),i&&(t.meetsMaxPasswordLength=e.length<=i)}validatePasswordCharacterOptions(e,t){this.updatePasswordCharacterOptionsStatuses(t,!1,!1,!1,!1);let r;for(let i=0;i<e.length;i++)r=e.charAt(i),this.updatePasswordCharacterOptionsStatuses(t,r>="a"&&r<="z",r>="A"&&r<="Z",r>="0"&&r<="9",this.allowedNonAlphanumericCharacters.includes(r))}updatePasswordCharacterOptionsStatuses(e,t,r,i,s){this.customStrengthOptions.containsLowercaseLetter&&(e.containsLowercaseLetter||(e.containsLowercaseLetter=t)),this.customStrengthOptions.containsUppercaseLetter&&(e.containsUppercaseLetter||(e.containsUppercaseLetter=r)),this.customStrengthOptions.containsNumericCharacter&&(e.containsNumericCharacter||(e.containsNumericCharacter=i)),this.customStrengthOptions.containsNonAlphanumericCharacter&&(e.containsNonAlphanumericCharacter||(e.containsNonAlphanumericCharacter=s))}}/**
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
 */class nI{constructor(e,t,r,i){this.app=e,this.heartbeatServiceProvider=t,this.appCheckServiceProvider=r,this.config=i,this.currentUser=null,this.emulatorConfig=null,this.operations=Promise.resolve(),this.authStateSubscription=new Ph(this),this.idTokenSubscription=new Ph(this),this.beforeStateQueue=new XE(this),this.redirectUser=null,this.isProactiveRefreshEnabled=!1,this.EXPECTED_PASSWORD_POLICY_SCHEMA_VERSION=1,this._canInitEmulator=!0,this._isInitialized=!1,this._deleted=!1,this._initializationPromise=null,this._popupRedirectResolver=null,this._errorFactory=qf,this._agentRecaptchaConfig=null,this._tenantRecaptchaConfigs={},this._projectPasswordPolicy=null,this._tenantPasswordPolicies={},this._resolvePersistenceManagerAvailable=void 0,this.lastNotifiedUid=void 0,this.languageCode=null,this.tenantId=null,this.settings={appVerificationDisabledForTesting:!1},this.frameworks=[],this.name=e.name,this.clientVersion=i.sdkClientVersion,this._persistenceManagerAvailable=new Promise(s=>this._resolvePersistenceManagerAvailable=s)}_initializeWithPersistence(e,t){return t&&(this._popupRedirectResolver=bt(t)),this._initializationPromise=this.queue(async()=>{var r,i,s;if(!this._deleted&&(this.persistenceManager=await Zn.create(this,e),(r=this._resolvePersistenceManagerAvailable)==null||r.call(this),!this._deleted)){if((i=this._popupRedirectResolver)!=null&&i._shouldInitProactively)try{await this._popupRedirectResolver._initialize(this)}catch{}await this.initializeCurrentUser(t),this.lastNotifiedUid=((s=this.currentUser)==null?void 0:s.uid)||null,!this._deleted&&(this._isInitialized=!0)}}),this._initializationPromise}async _onStorageEvent(){if(this._deleted)return;const e=await this.assertedPersistence.getCurrentUser();if(!(!this.currentUser&&!e)){if(this.currentUser&&e&&this.currentUser.uid===e.uid){this._currentUser._assign(e),await this.currentUser.getIdToken();return}await this._updateCurrentUser(e,!0)}}async initializeCurrentUserFromIdToken(e){try{const t=await Ms(this,{idToken:e}),r=await st._fromGetAccountInfoResponse(this,t,e);await this.directlySetCurrentUser(r)}catch(t){console.warn("FirebaseServerApp could not login user with provided authIdToken: ",t),await this.directlySetCurrentUser(null)}}async initializeCurrentUser(e){var s;if(ie(this.app)){const a=this.app.settings.authIdToken;return a?new Promise(c=>{setTimeout(()=>this.initializeCurrentUserFromIdToken(a).then(c,c))}):this.directlySetCurrentUser(null)}const t=await this.assertedPersistence.getCurrentUser();let r=t,i=!1;if(e&&this.config.authDomain){await this.getOrInitRedirectPersistenceManager();const a=(s=this.redirectUser)==null?void 0:s._redirectEventId,c=r==null?void 0:r._redirectEventId,u=await this.tryRedirectSignIn(e);(!a||a===c)&&(u!=null&&u.user)&&(r=u.user,i=!0)}if(!r)return this.directlySetCurrentUser(null);if(!r._redirectEventId){if(i)try{await this.beforeStateQueue.runMiddleware(r)}catch(a){r=t,this._popupRedirectResolver._overrideRedirectResult(this,()=>Promise.reject(a))}return r?this.reloadAndSetCurrentUserOrClear(r):this.directlySetCurrentUser(null)}return C(this._popupRedirectResolver,this,"argument-error"),await this.getOrInitRedirectPersistenceManager(),this.redirectUser&&this.redirectUser._redirectEventId===r._redirectEventId?this.directlySetCurrentUser(r):this.reloadAndSetCurrentUserOrClear(r)}async tryRedirectSignIn(e){let t=null;try{t=await this._popupRedirectResolver._completeRedirectFn(this,e,!0)}catch{await this._setRedirectUser(null)}return t}async reloadAndSetCurrentUserOrClear(e){try{await Ti(e)}catch(t){if((t==null?void 0:t.code)!=="auth/network-request-failed")return this.directlySetCurrentUser(null)}return this.directlySetCurrentUser(e)}useDeviceLanguage(){this.languageCode=ME()}async _delete(){this._deleted=!0}async updateCurrentUser(e){if(ie(this.app))return Promise.reject(Ae(this));const t=e?L(e):null;return t&&C(t.auth.config.apiKey===this.config.apiKey,this,"invalid-user-token"),this._updateCurrentUser(t&&t._clone(this))}async _updateCurrentUser(e,t=!1){if(!this._deleted)return e&&C(this.tenantId===e.tenantId,this,"tenant-id-mismatch"),t||await this.beforeStateQueue.runMiddleware(e),this.queue(async()=>{await this.directlySetCurrentUser(e),this.notifyAuthListeners()})}async signOut(){return ie(this.app)?Promise.reject(Ae(this)):(await this.beforeStateQueue.runMiddleware(null),(this.redirectPersistenceManager||this._popupRedirectResolver)&&await this._setRedirectUser(null),this._updateCurrentUser(null,!0))}setPersistence(e){return ie(this.app)?Promise.reject(Ae(this)):this.queue(async()=>{await this.assertedPersistence.setPersistence(bt(e))})}_getRecaptchaConfig(){return this.tenantId==null?this._agentRecaptchaConfig:this._tenantRecaptchaConfigs[this.tenantId]}async validatePassword(e){this._getPasswordPolicyInternal()||await this._updatePasswordPolicy();const t=this._getPasswordPolicyInternal();return t.schemaVersion!==this.EXPECTED_PASSWORD_POLICY_SCHEMA_VERSION?Promise.reject(this._errorFactory.create("unsupported-password-policy-schema-version",{})):t.validatePassword(e)}_getPasswordPolicyInternal(){return this.tenantId===null?this._projectPasswordPolicy:this._tenantPasswordPolicies[this.tenantId]}async _updatePasswordPolicy(){const e=await ZE(this),t=new tI(e);this.tenantId===null?this._projectPasswordPolicy=t:this._tenantPasswordPolicies[this.tenantId]=t}_getPersistenceType(){return this.assertedPersistence.persistence.type}_getPersistence(){return this.assertedPersistence.persistence}_updateErrorMap(e){this._errorFactory=new Et("auth","Firebase",e())}onAuthStateChanged(e,t,r){return this.registerStateListener(this.authStateSubscription,e,t,r)}beforeAuthStateChanged(e,t){return this.beforeStateQueue.pushCallback(e,t)}onIdTokenChanged(e,t,r){return this.registerStateListener(this.idTokenSubscription,e,t,r)}authStateReady(){return new Promise((e,t)=>{if(this.currentUser)e();else{const r=this.onAuthStateChanged(()=>{r(),e()},t)}})}async revokeAccessToken(e){if(this.currentUser){const t=await this.currentUser.getIdToken(),r={providerId:"apple.com",tokenType:"ACCESS_TOKEN",token:e,idToken:t};this.tenantId!=null&&(r.tenantId=this.tenantId),await YE(this,r)}}toJSON(){var e;return{apiKey:this.config.apiKey,authDomain:this.config.authDomain,appName:this.name,currentUser:(e=this._currentUser)==null?void 0:e.toJSON()}}async _setRedirectUser(e,t){const r=await this.getOrInitRedirectPersistenceManager(t);return e===null?r.removeCurrentUser():r.setCurrentUser(e)}async getOrInitRedirectPersistenceManager(e){if(!this.redirectPersistenceManager){const t=e&&bt(e)||this._popupRedirectResolver;C(t,this,"argument-error"),this.redirectPersistenceManager=await Zn.create(this,[bt(t._redirectPersistence)],"redirectUser"),this.redirectUser=await this.redirectPersistenceManager.getCurrentUser()}return this.redirectPersistenceManager}async _redirectUserForId(e){var t,r;return this._isInitialized&&await this.queue(async()=>{}),((t=this._currentUser)==null?void 0:t._redirectEventId)===e?this._currentUser:((r=this.redirectUser)==null?void 0:r._redirectEventId)===e?this.redirectUser:null}async _persistUserIfCurrent(e){if(e===this.currentUser)return this.queue(async()=>this.directlySetCurrentUser(e))}_notifyListenersIfCurrent(e){e===this.currentUser&&this.notifyAuthListeners()}_key(){return`${this.config.authDomain}:${this.config.apiKey}:${this.name}`}_startProactiveRefresh(){this.isProactiveRefreshEnabled=!0,this.currentUser&&this._currentUser._startProactiveRefresh()}_stopProactiveRefresh(){this.isProactiveRefreshEnabled=!1,this.currentUser&&this._currentUser._stopProactiveRefresh()}get _currentUser(){return this.currentUser}notifyAuthListeners(){var t;if(!this._isInitialized)return;this.idTokenSubscription.next(this.currentUser);const e=((t=this.currentUser)==null?void 0:t.uid)??null;this.lastNotifiedUid!==e&&(this.lastNotifiedUid=e,this.authStateSubscription.next(this.currentUser))}registerStateListener(e,t,r,i){if(this._deleted)return()=>{};const s=typeof t=="function"?t:t.next.bind(t);let a=!1;const c=this._isInitialized?Promise.resolve():this._initializationPromise;if(C(c,this,"internal-error"),c.then(()=>{a||s(this.currentUser)}),typeof t=="function"){const u=e.addObserver(t,r,i);return()=>{a=!0,u()}}else{const u=e.addObserver(t);return()=>{a=!0,u()}}}async directlySetCurrentUser(e){this.currentUser&&this.currentUser!==e&&this._currentUser._stopProactiveRefresh(),e&&this.isProactiveRefreshEnabled&&e._startProactiveRefresh(),this.currentUser=e,e?await this.assertedPersistence.setCurrentUser(e):await this.assertedPersistence.removeCurrentUser()}queue(e){return this.operations=this.operations.then(e,e),this.operations}get assertedPersistence(){return C(this.persistenceManager,this,"internal-error"),this.persistenceManager}_logFramework(e){!e||this.frameworks.includes(e)||(this.frameworks.push(e),this.frameworks.sort(),this.clientVersion=op(this.config.clientPlatform,this._getFrameworks()))}_getFrameworks(){return this.frameworks}async _getAdditionalHeaders(){var i;const e={"X-Client-Version":this.clientVersion};this.app.options.appId&&(e["X-Firebase-gmpid"]=this.app.options.appId);const t=await((i=this.heartbeatServiceProvider.getImmediate({optional:!0}))==null?void 0:i.getHeartbeatsHeader());t&&(e["X-Firebase-Client"]=t);const r=await this._getAppCheckToken();return r&&(e["X-Firebase-AppCheck"]=r),e}async _getAppCheckToken(){var t;if(ie(this.app)&&this.app.settings.appCheckToken)return this.app.settings.appCheckToken;const e=await((t=this.appCheckServiceProvider.getImmediate({optional:!0}))==null?void 0:t.getToken());return e!=null&&e.error&&OE(`Error while retrieving App Check token: ${e.error}`),e==null?void 0:e.token}}function he(n){return L(n)}class Ph{constructor(e){this.auth=e,this.observer=null,this.addObserver=cT(t=>this.observer=t)}get next(){return C(this.observer,this.auth,"internal-error"),this.observer.next.bind(this.observer)}}/**
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
 */let Vi={async loadJS(){throw new Error("Unable to load external scripts")},recaptchaV2Script:"",recaptchaEnterpriseScript:"",gapiScript:""};function rI(n){Vi=n}function Mc(n){return Vi.loadJS(n)}function iI(){return Vi.recaptchaV2Script}function sI(){return Vi.recaptchaEnterpriseScript}function oI(){return Vi.gapiScript}function ap(n){return`__${n}${Math.floor(Math.random()*1e6)}`}/**
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
 */const aI=500,cI=6e4,as=1e12;class uI{constructor(e){this.auth=e,this.counter=as,this._widgets=new Map}render(e,t){const r=this.counter;return this._widgets.set(r,new dI(e,this.auth.name,t||{})),this.counter++,r}reset(e){var r;const t=e||as;(r=this._widgets.get(t))==null||r.delete(),this._widgets.delete(t)}getResponse(e){var r;const t=e||as;return((r=this._widgets.get(t))==null?void 0:r.getResponse())||""}async execute(e){var r;const t=e||as;return(r=this._widgets.get(t))==null||r.execute(),""}}class lI{constructor(){this.enterprise=new hI}ready(e){e()}execute(e,t){return Promise.resolve("token")}render(e,t){return""}}class hI{ready(e){e()}execute(e,t){return Promise.resolve("token")}render(e,t){return""}}class dI{constructor(e,t,r){this.params=r,this.timerId=null,this.deleted=!1,this.responseToken=null,this.clickHandler=()=>{this.execute()};const i=typeof e=="string"?document.getElementById(e):e;C(i,"argument-error",{appName:t}),this.container=i,this.isVisible=this.params.size!=="invisible",this.isVisible?this.execute():this.container.addEventListener("click",this.clickHandler)}getResponse(){return this.checkIfDeleted(),this.responseToken}delete(){this.checkIfDeleted(),this.deleted=!0,this.timerId&&(clearTimeout(this.timerId),this.timerId=null),this.container.removeEventListener("click",this.clickHandler)}execute(){this.checkIfDeleted(),!this.timerId&&(this.timerId=window.setTimeout(()=>{this.responseToken=fI(50);const{callback:e,"expired-callback":t}=this.params;if(e)try{e(this.responseToken)}catch{}this.timerId=window.setTimeout(()=>{if(this.timerId=null,this.responseToken=null,t)try{t()}catch{}this.isVisible&&this.execute()},cI)},aI))}checkIfDeleted(){if(this.deleted)throw new Error("reCAPTCHA mock was already deleted!")}}function fI(n){const e=[],t="1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";for(let r=0;r<n;r++)e.push(t.charAt(Math.floor(Math.random()*t.length)));return e.join("")}const pI="recaptcha-enterprise",si="NO_RECAPTCHA";class cp{constructor(e){this.type=pI,this.auth=he(e)}async verify(e="verify",t=!1){async function r(s){if(!t){if(s.tenantId==null&&s._agentRecaptchaConfig!=null)return s._agentRecaptchaConfig.siteKey;if(s.tenantId!=null&&s._tenantRecaptchaConfigs[s.tenantId]!==void 0)return s._tenantRecaptchaConfigs[s.tenantId].siteKey}return new Promise(async(a,c)=>{Gf(s,{clientType:"CLIENT_TYPE_WEB",version:"RECAPTCHA_ENTERPRISE"}).then(u=>{if(u.recaptchaKey===void 0)c(new Error("recaptcha Enterprise site key undefined"));else{const h=new Wf(u);return s.tenantId==null?s._agentRecaptchaConfig=h:s._tenantRecaptchaConfigs[s.tenantId]=h,a(h.siteKey)}}).catch(u=>{c(u)})})}function i(s,a,c){const u=window.grecaptcha;Ah(u)?u.enterprise.ready(()=>{u.enterprise.execute(s,{action:e}).then(h=>{a(h)}).catch(()=>{a(si)})}):c(Error("No reCAPTCHA enterprise script loaded."))}return this.auth.settings.appVerificationDisabledForTesting?new lI().execute("siteKey",{action:"verify"}):new Promise((s,a)=>{r(this.auth).then(c=>{if(!t&&Ah(window.grecaptcha))i(c,s,a);else{if(typeof window>"u"){a(new Error("RecaptchaVerifier is only supported in browser"));return}let u=sI();u.length!==0&&(u+=c),Mc(u).then(()=>{i(c,s,a)}).catch(h=>{a(h)})}}).catch(c=>{a(c)})})}}async function Gr(n,e,t,r=!1,i=!1){const s=new cp(n);let a;if(i)a=si;else try{a=await s.verify(t)}catch{a=await s.verify(t,!0)}const c={...e};if(t==="mfaSmsEnrollment"||t==="mfaSmsSignIn"){if("phoneEnrollmentInfo"in c){const u=c.phoneEnrollmentInfo.phoneNumber,h=c.phoneEnrollmentInfo.recaptchaToken;Object.assign(c,{phoneEnrollmentInfo:{phoneNumber:u,recaptchaToken:h,captchaResponse:a,clientType:"CLIENT_TYPE_WEB",recaptchaVersion:"RECAPTCHA_ENTERPRISE"}})}else if("phoneSignInInfo"in c){const u=c.phoneSignInInfo.recaptchaToken;Object.assign(c,{phoneSignInInfo:{recaptchaToken:u,captchaResponse:a,clientType:"CLIENT_TYPE_WEB",recaptchaVersion:"RECAPTCHA_ENTERPRISE"}})}return c}return r?Object.assign(c,{captchaResp:a}):Object.assign(c,{captchaResponse:a}),Object.assign(c,{clientType:"CLIENT_TYPE_WEB"}),Object.assign(c,{recaptchaVersion:"RECAPTCHA_ENTERPRISE"}),c}async function Zt(n,e,t,r,i){var s,a;if(i==="EMAIL_PASSWORD_PROVIDER")if((s=n._getRecaptchaConfig())!=null&&s.isProviderEnabled("EMAIL_PASSWORD_PROVIDER")){const c=await Gr(n,e,t,t==="getOobCode");return r(n,c)}else return r(n,e).catch(async c=>{if(c.code==="auth/missing-recaptcha-token"){console.log(`${t} is protected by reCAPTCHA Enterprise for this project. Automatically triggering the reCAPTCHA flow and restarting the flow.`);const u=await Gr(n,e,t,t==="getOobCode");return r(n,u)}else return Promise.reject(c)});else if(i==="PHONE_PROVIDER")if((a=n._getRecaptchaConfig())!=null&&a.isProviderEnabled("PHONE_PROVIDER")){const c=await Gr(n,e,t);return r(n,c).catch(async u=>{var h;if(((h=n._getRecaptchaConfig())==null?void 0:h.getProviderEnforcementState("PHONE_PROVIDER"))==="AUDIT"&&(u.code==="auth/missing-recaptcha-token"||u.code==="auth/invalid-app-credential")){console.log(`Failed to verify with reCAPTCHA Enterprise. Automatically triggering the reCAPTCHA v2 flow to complete the ${t} flow.`);const f=await Gr(n,e,t,!1,!0);return r(n,f)}return Promise.reject(u)})}else{const c=await Gr(n,e,t,!1,!0);return r(n,c)}else return Promise.reject(i+" provider is not supported.")}async function up(n){const e=he(n),t=await Gf(e,{clientType:"CLIENT_TYPE_WEB",version:"RECAPTCHA_ENTERPRISE"}),r=new Wf(t);e.tenantId==null?e._agentRecaptchaConfig=r:e._tenantRecaptchaConfigs[e.tenantId]=r,r.isAnyProviderEnabled()&&new cp(e).verify()}/**
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
 */function lp(n,e){const t=Ke(n,"auth");if(t.isInitialized()){const i=t.getImmediate(),s=t.getOptions();if(Dt(s,e??{}))return i;Ge(i,"already-initialized")}return t.initialize({options:e})}function mI(n,e){const t=(e==null?void 0:e.persistence)||[],r=(Array.isArray(t)?t:[t]).map(bt);e!=null&&e.errorMap&&n._updateErrorMap(e.errorMap),n._initializeWithPersistence(r,e==null?void 0:e.popupRedirectResolver)}function hp(n,e,t){const r=he(n);C(/^https?:\/\//.test(e),r,"invalid-emulator-scheme");const i=!!(t!=null&&t.disableWarnings),s=dp(e),{host:a,port:c}=gI(e),u=c===null?"":`:${c}`,h={url:`${s}//${a}${u}/`},f=Object.freeze({host:a,port:c,protocol:s.replace(":",""),options:Object.freeze({disableWarnings:i})});if(!r._canInitEmulator){C(r.config.emulator&&r.emulatorConfig,r,"emulator-config-failed"),C(Dt(h,r.config.emulator)&&Dt(f,r.emulatorConfig),r,"emulator-config-failed");return}r.config.emulator=h,r.emulatorConfig=f,r.settings.appVerificationDisabledForTesting=!0,fn(a)?(Sc(`${s}//${a}${u}`),Mf("Auth",!0)):i||_I()}function dp(n){const e=n.indexOf(":");return e<0?"":n.substr(0,e+1)}function gI(n){const e=dp(n),t=/(\/\/)?([^?#/]+)/.exec(n.substr(e.length));if(!t)return{host:"",port:null};const r=t[2].split("@").pop()||"",i=/^(\[[^\]]+\])(:|$)/.exec(r);if(i){const s=i[1];return{host:s,port:Ch(r.substr(s.length+1))}}else{const[s,a]=r.split(":");return{host:s,port:Ch(a)}}}function Ch(n){if(!n)return null;const e=Number(n);return isNaN(e)?null:e}function _I(){function n(){const e=document.createElement("p"),t=e.style;e.innerText="Running in emulator mode. Do not use with production credentials.",t.position="fixed",t.width="100%",t.backgroundColor="#ffffff",t.border=".1em solid #000000",t.color="#b50000",t.bottom="0px",t.left="0px",t.margin="0px",t.zIndex="10000",t.textAlign="center",e.classList.add("firebase-emulator-warning"),document.body.appendChild(e)}typeof console<"u"&&typeof console.info=="function"&&console.info("WARNING: You are using the Auth Emulator, which is intended for local testing only.  Do not use with production credentials."),typeof window<"u"&&typeof document<"u"&&(document.readyState==="loading"?window.addEventListener("DOMContentLoaded",n):n())}/**
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
 */class Er{constructor(e,t){this.providerId=e,this.signInMethod=t}toJSON(){return ft("not implemented")}_getIdTokenResponse(e){return ft("not implemented")}_linkToIdToken(e,t){return ft("not implemented")}_getReauthenticationResolver(e){return ft("not implemented")}}/**
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
 */async function fp(n,e){return re(n,"POST","/v1/accounts:resetPassword",ne(n,e))}async function yI(n,e){return re(n,"POST","/v1/accounts:update",e)}async function TI(n,e){return re(n,"POST","/v1/accounts:signUp",e)}async function EI(n,e){return re(n,"POST","/v1/accounts:update",ne(n,e))}/**
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
 */async function II(n,e){return Ft(n,"POST","/v1/accounts:signInWithPassword",ne(n,e))}async function co(n,e){return re(n,"POST","/v1/accounts:sendOobCode",ne(n,e))}async function wI(n,e){return co(n,e)}async function vI(n,e){return co(n,e)}async function AI(n,e){return co(n,e)}async function RI(n,e){return co(n,e)}/**
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
 */async function bI(n,e){return Ft(n,"POST","/v1/accounts:signInWithEmailLink",ne(n,e))}async function SI(n,e){return Ft(n,"POST","/v1/accounts:signInWithEmailLink",ne(n,e))}/**
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
 */class cr extends Er{constructor(e,t,r,i=null){super("password",r),this._email=e,this._password=t,this._tenantId=i}static _fromEmailAndPassword(e,t){return new cr(e,t,"password")}static _fromEmailAndCode(e,t,r=null){return new cr(e,t,"emailLink",r)}toJSON(){return{email:this._email,password:this._password,signInMethod:this.signInMethod,tenantId:this._tenantId}}static fromJSON(e){const t=typeof e=="string"?JSON.parse(e):e;if(t!=null&&t.email&&(t!=null&&t.password)){if(t.signInMethod==="password")return this._fromEmailAndPassword(t.email,t.password);if(t.signInMethod==="emailLink")return this._fromEmailAndCode(t.email,t.password,t.tenantId)}return null}async _getIdTokenResponse(e){switch(this.signInMethod){case"password":const t={returnSecureToken:!0,email:this._email,password:this._password,clientType:"CLIENT_TYPE_WEB"};return Zt(e,t,"signInWithPassword",II,"EMAIL_PASSWORD_PROVIDER");case"emailLink":return bI(e,{email:this._email,oobCode:this._password});default:Ge(e,"internal-error")}}async _linkToIdToken(e,t){switch(this.signInMethod){case"password":const r={idToken:t,returnSecureToken:!0,email:this._email,password:this._password,clientType:"CLIENT_TYPE_WEB"};return Zt(e,r,"signUpPassword",TI,"EMAIL_PASSWORD_PROVIDER");case"emailLink":return SI(e,{idToken:t,email:this._email,oobCode:this._password});default:Ge(e,"internal-error")}}_getReauthenticationResolver(e){return this._getIdTokenResponse(e)}}/**
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
 */async function Ct(n,e){return Ft(n,"POST","/v1/accounts:signInWithIdp",ne(n,e))}/**
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
 */const PI="http://localhost";class yt extends Er{constructor(){super(...arguments),this.pendingToken=null}static _fromParams(e){const t=new yt(e.providerId,e.signInMethod);return e.idToken||e.accessToken?(e.idToken&&(t.idToken=e.idToken),e.accessToken&&(t.accessToken=e.accessToken),e.nonce&&!e.pendingToken&&(t.nonce=e.nonce),e.pendingToken&&(t.pendingToken=e.pendingToken)):e.oauthToken&&e.oauthTokenSecret?(t.accessToken=e.oauthToken,t.secret=e.oauthTokenSecret):Ge("argument-error"),t}toJSON(){return{idToken:this.idToken,accessToken:this.accessToken,secret:this.secret,nonce:this.nonce,pendingToken:this.pendingToken,providerId:this.providerId,signInMethod:this.signInMethod}}static fromJSON(e){const t=typeof e=="string"?JSON.parse(e):e,{providerId:r,signInMethod:i,...s}=t;if(!r||!i)return null;const a=new yt(r,i);return a.idToken=s.idToken||void 0,a.accessToken=s.accessToken||void 0,a.secret=s.secret,a.nonce=s.nonce,a.pendingToken=s.pendingToken||null,a}_getIdTokenResponse(e){const t=this.buildRequest();return Ct(e,t)}_linkToIdToken(e,t){const r=this.buildRequest();return r.idToken=t,Ct(e,r)}_getReauthenticationResolver(e){const t=this.buildRequest();return t.autoCreate=!1,Ct(e,t)}buildRequest(){const e={requestUri:PI,returnSecureToken:!0};if(this.pendingToken)e.pendingToken=this.pendingToken;else{const t={};this.idToken&&(t.id_token=this.idToken),this.accessToken&&(t.access_token=this.accessToken),this.secret&&(t.oauth_token_secret=this.secret),t.providerId=this.providerId,this.nonce&&!this.pendingToken&&(t.nonce=this.nonce),e.postBody=gr(t)}return e}}/**
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
 */async function kh(n,e){return re(n,"POST","/v1/accounts:sendVerificationCode",ne(n,e))}async function CI(n,e){return Ft(n,"POST","/v1/accounts:signInWithPhoneNumber",ne(n,e))}async function kI(n,e){const t=await Ft(n,"POST","/v1/accounts:signInWithPhoneNumber",ne(n,e));if(t.temporaryProof)throw Xr(n,"account-exists-with-different-credential",t);return t}const NI={USER_NOT_FOUND:"user-not-found"};async function DI(n,e){const t={...e,operation:"REAUTH"};return Ft(n,"POST","/v1/accounts:signInWithPhoneNumber",ne(n,t),NI)}/**
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
 */class en extends Er{constructor(e){super("phone","phone"),this.params=e}static _fromVerification(e,t){return new en({verificationId:e,verificationCode:t})}static _fromTokenResponse(e,t){return new en({phoneNumber:e,temporaryProof:t})}_getIdTokenResponse(e){return CI(e,this._makeVerificationRequest())}_linkToIdToken(e,t){return kI(e,{idToken:t,...this._makeVerificationRequest()})}_getReauthenticationResolver(e){return DI(e,this._makeVerificationRequest())}_makeVerificationRequest(){const{temporaryProof:e,phoneNumber:t,verificationId:r,verificationCode:i}=this.params;return e&&t?{temporaryProof:e,phoneNumber:t}:{sessionInfo:r,code:i}}toJSON(){const e={providerId:this.providerId};return this.params.phoneNumber&&(e.phoneNumber=this.params.phoneNumber),this.params.temporaryProof&&(e.temporaryProof=this.params.temporaryProof),this.params.verificationCode&&(e.verificationCode=this.params.verificationCode),this.params.verificationId&&(e.verificationId=this.params.verificationId),e}static fromJSON(e){typeof e=="string"&&(e=JSON.parse(e));const{verificationId:t,verificationCode:r,phoneNumber:i,temporaryProof:s}=e;return!r&&!t&&!i&&!s?null:new en({verificationId:t,verificationCode:r,phoneNumber:i,temporaryProof:s})}}/**
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
 */function OI(n){switch(n){case"recoverEmail":return"RECOVER_EMAIL";case"resetPassword":return"PASSWORD_RESET";case"signIn":return"EMAIL_SIGNIN";case"verifyEmail":return"VERIFY_EMAIL";case"verifyAndChangeEmail":return"VERIFY_AND_CHANGE_EMAIL";case"revertSecondFactorAddition":return"REVERT_SECOND_FACTOR_ADDITION";default:return null}}function VI(n){const e=Qr(Jr(n)).link,t=e?Qr(Jr(e)).deep_link_id:null,r=Qr(Jr(n)).deep_link_id;return(r?Qr(Jr(r)).link:null)||r||t||e||n}class Ir{constructor(e){const t=Qr(Jr(e)),r=t.apiKey??null,i=t.oobCode??null,s=OI(t.mode??null);C(r&&i&&s,"argument-error"),this.apiKey=r,this.operation=s,this.code=i,this.continueUrl=t.continueUrl??null,this.languageCode=t.lang??null,this.tenantId=t.tenantId??null}static parseLink(e){const t=VI(e);try{return new Ir(t)}catch{return null}}}function MI(n){return Ir.parseLink(n)}/**
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
 */class pn{constructor(){this.providerId=pn.PROVIDER_ID}static credential(e,t){return cr._fromEmailAndPassword(e,t)}static credentialWithLink(e,t){const r=Ir.parseLink(t);return C(r,"argument-error"),cr._fromEmailAndCode(e,r.code,r.tenantId)}}pn.PROVIDER_ID="password";pn.EMAIL_PASSWORD_SIGN_IN_METHOD="password";pn.EMAIL_LINK_SIGN_IN_METHOD="emailLink";/**
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
 */class Bt{constructor(e){this.providerId=e,this.defaultLanguageCode=null,this.customParameters={}}setDefaultLanguage(e){this.defaultLanguageCode=e}setCustomParameters(e){return this.customParameters=e,this}getCustomParameters(){return this.customParameters}}/**
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
 */class wr extends Bt{constructor(){super(...arguments),this.scopes=[]}addScope(e){return this.scopes.includes(e)||this.scopes.push(e),this}getScopes(){return[...this.scopes]}}class oi extends wr{static credentialFromJSON(e){const t=typeof e=="string"?JSON.parse(e):e;return C("providerId"in t&&"signInMethod"in t,"argument-error"),yt._fromParams(t)}credential(e){return this._credential({...e,nonce:e.rawNonce})}_credential(e){return C(e.idToken||e.accessToken,"argument-error"),yt._fromParams({...e,providerId:this.providerId,signInMethod:this.providerId})}static credentialFromResult(e){return oi.oauthCredentialFromTaggedObject(e)}static credentialFromError(e){return oi.oauthCredentialFromTaggedObject(e.customData||{})}static oauthCredentialFromTaggedObject({_tokenResponse:e}){if(!e)return null;const{oauthIdToken:t,oauthAccessToken:r,oauthTokenSecret:i,pendingToken:s,nonce:a,providerId:c}=e;if(!r&&!i&&!t&&!s||!c)return null;try{return new oi(c)._credential({idToken:t,accessToken:r,nonce:a,pendingToken:s})}catch{return null}}}/**
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
 */class wt extends wr{constructor(){super("facebook.com")}static credential(e){return yt._fromParams({providerId:wt.PROVIDER_ID,signInMethod:wt.FACEBOOK_SIGN_IN_METHOD,accessToken:e})}static credentialFromResult(e){return wt.credentialFromTaggedObject(e)}static credentialFromError(e){return wt.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e||!("oauthAccessToken"in e)||!e.oauthAccessToken)return null;try{return wt.credential(e.oauthAccessToken)}catch{return null}}}wt.FACEBOOK_SIGN_IN_METHOD="facebook.com";wt.PROVIDER_ID="facebook.com";/**
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
 */class vt extends wr{constructor(){super("google.com"),this.addScope("profile")}static credential(e,t){return yt._fromParams({providerId:vt.PROVIDER_ID,signInMethod:vt.GOOGLE_SIGN_IN_METHOD,idToken:e,accessToken:t})}static credentialFromResult(e){return vt.credentialFromTaggedObject(e)}static credentialFromError(e){return vt.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e)return null;const{oauthIdToken:t,oauthAccessToken:r}=e;if(!t&&!r)return null;try{return vt.credential(t,r)}catch{return null}}}vt.GOOGLE_SIGN_IN_METHOD="google.com";vt.PROVIDER_ID="google.com";/**
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
 */class At extends wr{constructor(){super("github.com")}static credential(e){return yt._fromParams({providerId:At.PROVIDER_ID,signInMethod:At.GITHUB_SIGN_IN_METHOD,accessToken:e})}static credentialFromResult(e){return At.credentialFromTaggedObject(e)}static credentialFromError(e){return At.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e||!("oauthAccessToken"in e)||!e.oauthAccessToken)return null;try{return At.credential(e.oauthAccessToken)}catch{return null}}}At.GITHUB_SIGN_IN_METHOD="github.com";At.PROVIDER_ID="github.com";/**
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
 */const LI="http://localhost";class Ei extends Er{constructor(e,t){super(e,e),this.pendingToken=t}_getIdTokenResponse(e){const t=this.buildRequest();return Ct(e,t)}_linkToIdToken(e,t){const r=this.buildRequest();return r.idToken=t,Ct(e,r)}_getReauthenticationResolver(e){const t=this.buildRequest();return t.autoCreate=!1,Ct(e,t)}toJSON(){return{signInMethod:this.signInMethod,providerId:this.providerId,pendingToken:this.pendingToken}}static fromJSON(e){const t=typeof e=="string"?JSON.parse(e):e,{providerId:r,signInMethod:i,pendingToken:s}=t;return!r||!i||!s||r!==i?null:new Ei(r,s)}static _create(e,t){return new Ei(e,t)}buildRequest(){return{requestUri:LI,returnSecureToken:!0,pendingToken:this.pendingToken}}}/**
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
 */const UI="saml.";class Ls extends Bt{constructor(e){C(e.startsWith(UI),"argument-error"),super(e)}static credentialFromResult(e){return Ls.samlCredentialFromTaggedObject(e)}static credentialFromError(e){return Ls.samlCredentialFromTaggedObject(e.customData||{})}static credentialFromJSON(e){const t=Ei.fromJSON(e);return C(t,"argument-error"),t}static samlCredentialFromTaggedObject({_tokenResponse:e}){if(!e)return null;const{pendingToken:t,providerId:r}=e;if(!t||!r)return null;try{return Ei._create(r,t)}catch{return null}}}/**
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
 */class Rt extends wr{constructor(){super("twitter.com")}static credential(e,t){return yt._fromParams({providerId:Rt.PROVIDER_ID,signInMethod:Rt.TWITTER_SIGN_IN_METHOD,oauthToken:e,oauthTokenSecret:t})}static credentialFromResult(e){return Rt.credentialFromTaggedObject(e)}static credentialFromError(e){return Rt.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e)return null;const{oauthAccessToken:t,oauthTokenSecret:r}=e;if(!t||!r)return null;try{return Rt.credential(t,r)}catch{return null}}}Rt.TWITTER_SIGN_IN_METHOD="twitter.com";Rt.PROVIDER_ID="twitter.com";/**
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
 */async function pp(n,e){return Ft(n,"POST","/v1/accounts:signUp",ne(n,e))}/**
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
 */class nt{constructor(e){this.user=e.user,this.providerId=e.providerId,this._tokenResponse=e._tokenResponse,this.operationType=e.operationType}static async _fromIdTokenResponse(e,t,r,i=!1){const s=await st._fromIdTokenResponse(e,r,i),a=Nh(r);return new nt({user:s,providerId:a,_tokenResponse:r,operationType:t})}static async _forOperation(e,t,r){await e._updateTokensIfNecessary(r,!0);const i=Nh(r);return new nt({user:e,providerId:i,_tokenResponse:r,operationType:t})}}function Nh(n){return n.providerId?n.providerId:"phoneNumber"in n?"phone":null}/**
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
 */async function xI(n){var i;if(ie(n.app))return Promise.reject(Ae(n));const e=he(n);if(await e._initializationPromise,(i=e.currentUser)!=null&&i.isAnonymous)return new nt({user:e.currentUser,providerId:null,operationType:"signIn"});const t=await pp(e,{returnSecureToken:!0}),r=await nt._fromIdTokenResponse(e,"signIn",t,!0);return await e._updateCurrentUser(r.user),r}/**
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
 */class Us extends rt{constructor(e,t,r,i){super(t.code,t.message),this.operationType=r,this.user=i,Object.setPrototypeOf(this,Us.prototype),this.customData={appName:e.name,tenantId:e.tenantId??void 0,_serverResponse:t.customData._serverResponse,operationType:r}}static _fromErrorAndOperation(e,t,r,i){return new Us(e,t,r,i)}}function mp(n,e,t,r){return(e==="reauthenticate"?t._getReauthenticationResolver(n):t._getIdTokenResponse(n)).catch(s=>{throw s.code==="auth/multi-factor-auth-required"?Us._fromErrorAndOperation(n,s,e,r):s})}/**
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
 */function gp(n){return new Set(n.map(({providerId:e})=>e).filter(e=>!!e))}/**
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
 */async function FI(n,e){const t=L(n);await uo(!0,t,e);const{providerUserInfo:r}=await jE(t.auth,{idToken:await t.getIdToken(),deleteProvider:[e]}),i=gp(r||[]);return t.providerData=t.providerData.filter(s=>i.has(s.providerId)),i.has("phone")||(t.phoneNumber=null),await t.auth._persistUserIfCurrent(t),t}async function Lc(n,e,t=!1){const r=await Mt(n,e._linkToIdToken(n.auth,await n.getIdToken()),t);return nt._forOperation(n,"link",r)}async function uo(n,e,t){await Ti(e);const r=gp(e.providerData),i=n===!1?"provider-already-linked":"no-such-provider";C(r.has(t)===n,e.auth,i)}/**
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
 */async function _p(n,e,t=!1){const{auth:r}=n;if(ie(r.app))return Promise.reject(Ae(r));const i="reauthenticate";try{const s=await Mt(n,mp(r,i,e,n),t);C(s.idToken,r,"internal-error");const a=ao(s.idToken);C(a,r,"internal-error");const{sub:c}=a;return C(n.uid===c,r,"user-mismatch"),nt._forOperation(n,i,s)}catch(s){throw(s==null?void 0:s.code)==="auth/user-not-found"&&Ge(r,"user-mismatch"),s}}/**
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
 */async function yp(n,e,t=!1){if(ie(n.app))return Promise.reject(Ae(n));const r="signIn",i=await mp(n,r,e),s=await nt._fromIdTokenResponse(n,r,i);return t||await n._updateCurrentUser(s.user),s}async function lo(n,e){return yp(he(n),e)}async function Tp(n,e){const t=L(n);return await uo(!1,t,e.providerId),Lc(t,e)}async function Ep(n,e){return _p(L(n),e)}/**
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
 */async function BI(n,e){return Ft(n,"POST","/v1/accounts:signInWithCustomToken",ne(n,e))}/**
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
 */async function $I(n,e){if(ie(n.app))return Promise.reject(Ae(n));const t=he(n),r=await BI(t,{token:e,returnSecureToken:!0}),i=await nt._fromIdTokenResponse(t,"signIn",r);return await t._updateCurrentUser(i.user),i}/**
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
 */class Mi{constructor(e,t){this.factorId=e,this.uid=t.mfaEnrollmentId,this.enrollmentTime=new Date(t.enrolledAt).toUTCString(),this.displayName=t.displayName}static _fromServerResponse(e,t){return"phoneInfo"in t?Uc._fromServerResponse(e,t):"totpInfo"in t?xc._fromServerResponse(e,t):Ge(e,"internal-error")}}class Uc extends Mi{constructor(e){super("phone",e),this.phoneNumber=e.phoneInfo}static _fromServerResponse(e,t){return new Uc(t)}}class xc extends Mi{constructor(e){super("totp",e)}static _fromServerResponse(e,t){return new xc(t)}}/**
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
 */function ho(n,e,t){var r;C(((r=t.url)==null?void 0:r.length)>0,n,"invalid-continue-uri"),C(typeof t.dynamicLinkDomain>"u"||t.dynamicLinkDomain.length>0,n,"invalid-dynamic-link-domain"),C(typeof t.linkDomain>"u"||t.linkDomain.length>0,n,"invalid-hosting-link-domain"),e.continueUrl=t.url,e.dynamicLinkDomain=t.dynamicLinkDomain,e.linkDomain=t.linkDomain,e.canHandleCodeInApp=t.handleCodeInApp,t.iOS&&(C(t.iOS.bundleId.length>0,n,"missing-ios-bundle-id"),e.iOSBundleId=t.iOS.bundleId),t.android&&(C(t.android.packageName.length>0,n,"missing-android-pkg-name"),e.androidInstallApp=t.android.installApp,e.androidMinimumVersionCode=t.android.minimumVersion,e.androidPackageName=t.android.packageName)}/**
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
 */async function Fc(n){const e=he(n);e._getPasswordPolicyInternal()&&await e._updatePasswordPolicy()}async function qI(n,e,t){const r=he(n),i={requestType:"PASSWORD_RESET",email:e,clientType:"CLIENT_TYPE_WEB"};t&&ho(r,i,t),await Zt(r,i,"getOobCode",vI,"EMAIL_PASSWORD_PROVIDER")}async function jI(n,e,t){await fp(L(n),{oobCode:e,newPassword:t}).catch(async r=>{throw r.code==="auth/password-does-not-meet-requirements"&&Fc(n),r})}async function HI(n,e){await EI(L(n),{oobCode:e})}async function Ip(n,e){const t=L(n),r=await fp(t,{oobCode:e}),i=r.requestType;switch(C(i,t,"internal-error"),i){case"EMAIL_SIGNIN":break;case"VERIFY_AND_CHANGE_EMAIL":C(r.newEmail,t,"internal-error");break;case"REVERT_SECOND_FACTOR_ADDITION":C(r.mfaInfo,t,"internal-error");default:C(r.email,t,"internal-error")}let s=null;return r.mfaInfo&&(s=Mi._fromServerResponse(he(t),r.mfaInfo)),{data:{email:(r.requestType==="VERIFY_AND_CHANGE_EMAIL"?r.newEmail:r.email)||null,previousEmail:(r.requestType==="VERIFY_AND_CHANGE_EMAIL"?r.email:r.newEmail)||null,multiFactorInfo:s},operation:i}}async function zI(n,e){const{data:t}=await Ip(L(n),e);return t.email}async function WI(n,e,t){if(ie(n.app))return Promise.reject(Ae(n));const r=he(n),a=await Zt(r,{returnSecureToken:!0,email:e,password:t,clientType:"CLIENT_TYPE_WEB"},"signUpPassword",pp,"EMAIL_PASSWORD_PROVIDER").catch(u=>{throw u.code==="auth/password-does-not-meet-requirements"&&Fc(n),u}),c=await nt._fromIdTokenResponse(r,"signIn",a);return await r._updateCurrentUser(c.user),c}function GI(n,e,t){return ie(n.app)?Promise.reject(Ae(n)):lo(L(n),pn.credential(e,t)).catch(async r=>{throw r.code==="auth/password-does-not-meet-requirements"&&Fc(n),r})}/**
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
 */async function KI(n,e,t){const r=he(n),i={requestType:"EMAIL_SIGNIN",email:e,clientType:"CLIENT_TYPE_WEB"};function s(a,c){C(c.handleCodeInApp,r,"argument-error"),c&&ho(r,a,c)}s(i,t),await Zt(r,i,"getOobCode",AI,"EMAIL_PASSWORD_PROVIDER")}function YI(n,e){const t=Ir.parseLink(e);return(t==null?void 0:t.operation)==="EMAIL_SIGNIN"}async function QI(n,e,t){if(ie(n.app))return Promise.reject(Ae(n));const r=L(n),i=pn.credentialWithLink(e,t||yi());return C(i._tenantId===(r.tenantId||null),r,"tenant-id-mismatch"),lo(r,i)}/**
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
 */async function JI(n,e){return re(n,"POST","/v1/accounts:createAuthUri",ne(n,e))}/**
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
 */async function XI(n,e){const t=Dc()?yi():"http://localhost",r={identifier:e,continueUri:t},{signinMethods:i}=await JI(L(n),r);return i||[]}async function ZI(n,e){const t=L(n),i={requestType:"VERIFY_EMAIL",idToken:await n.getIdToken()};e&&ho(t.auth,i,e);const{email:s}=await wI(t.auth,i);s!==n.email&&await n.reload()}async function ew(n,e,t){const r=L(n),s={requestType:"VERIFY_AND_CHANGE_EMAIL",idToken:await n.getIdToken(),newEmail:e};t&&ho(r.auth,s,t);const{email:a}=await RI(r.auth,s);a!==n.email&&await n.reload()}/**
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
 */async function tw(n,e){return re(n,"POST","/v1/accounts:update",e)}/**
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
 */async function nw(n,{displayName:e,photoURL:t}){if(e===void 0&&t===void 0)return;const r=L(n),s={idToken:await r.getIdToken(),displayName:e,photoUrl:t,returnSecureToken:!0},a=await Mt(r,tw(r.auth,s));r.displayName=a.displayName||null,r.photoURL=a.photoUrl||null;const c=r.providerData.find(({providerId:u})=>u==="password");c&&(c.displayName=r.displayName,c.photoURL=r.photoURL),await r._updateTokensIfNecessary(a)}function rw(n,e){const t=L(n);return ie(t.auth.app)?Promise.reject(Ae(t.auth)):wp(t,e,null)}function iw(n,e){return wp(L(n),null,e)}async function wp(n,e,t){const{auth:r}=n,s={idToken:await n.getIdToken(),returnSecureToken:!0};e&&(s.email=e),t&&(s.password=t);const a=await Mt(n,yI(r,s));await n._updateTokensIfNecessary(a,!0)}/**
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
 */function sw(n){var i,s;if(!n)return null;const{providerId:e}=n,t=n.rawUserInfo?JSON.parse(n.rawUserInfo):{},r=n.isNewUser||n.kind==="identitytoolkit#SignupNewUserResponse";if(!e&&(n!=null&&n.idToken)){const a=(s=(i=ao(n.idToken))==null?void 0:i.firebase)==null?void 0:s.sign_in_provider;if(a){const c=a!=="anonymous"&&a!=="custom"?a:null;return new er(r,c)}}if(!e)return null;switch(e){case"facebook.com":return new ow(r,t);case"github.com":return new aw(r,t);case"google.com":return new cw(r,t);case"twitter.com":return new uw(r,t,n.screenName||null);case"custom":case"anonymous":return new er(r,null);default:return new er(r,e,t)}}class er{constructor(e,t,r={}){this.isNewUser=e,this.providerId=t,this.profile=r}}class vp extends er{constructor(e,t,r,i){super(e,t,r),this.username=i}}class ow extends er{constructor(e,t){super(e,"facebook.com",t)}}class aw extends vp{constructor(e,t){super(e,"github.com",t,typeof(t==null?void 0:t.login)=="string"?t==null?void 0:t.login:null)}}class cw extends er{constructor(e,t){super(e,"google.com",t)}}class uw extends vp{constructor(e,t,r){super(e,"twitter.com",t,r)}}function lw(n){const{user:e,_tokenResponse:t}=n;return e.isAnonymous&&!t?{providerId:null,isNewUser:!1,profile:null}:sw(t)}/**
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
 */function hw(n,e){return L(n).setPersistence(e)}function dw(n){return up(n)}async function fw(n,e){return he(n).validatePassword(e)}function Ap(n,e,t,r){return L(n).onIdTokenChanged(e,t,r)}function Rp(n,e,t){return L(n).beforeAuthStateChanged(e,t)}function pw(n,e,t,r){return L(n).onAuthStateChanged(e,t,r)}function mw(n){L(n).useDeviceLanguage()}function gw(n,e){return L(n).updateCurrentUser(e)}function _w(n){return L(n).signOut()}function yw(n,e){return he(n).revokeAccessToken(e)}async function Tw(n){return L(n).delete()}/**
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
 */class wn{constructor(e,t,r){this.type=e,this.credential=t,this.user=r}static _fromIdtoken(e,t){return new wn("enroll",e,t)}static _fromMfaPendingCredential(e){return new wn("signin",e)}toJSON(){return{multiFactorSession:{[this.type==="enroll"?"idToken":"pendingCredential"]:this.credential}}}static fromJSON(e){var t,r;if(e!=null&&e.multiFactorSession){if((t=e.multiFactorSession)!=null&&t.pendingCredential)return wn._fromMfaPendingCredential(e.multiFactorSession.pendingCredential);if((r=e.multiFactorSession)!=null&&r.idToken)return wn._fromIdtoken(e.multiFactorSession.idToken)}return null}}/**
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
 */class Bc{constructor(e,t,r){this.session=e,this.hints=t,this.signInResolver=r}static _fromError(e,t){const r=he(e),i=t.customData._serverResponse,s=(i.mfaInfo||[]).map(c=>Mi._fromServerResponse(r,c));C(i.mfaPendingCredential,r,"internal-error");const a=wn._fromMfaPendingCredential(i.mfaPendingCredential);return new Bc(a,s,async c=>{const u=await c._process(r,a);delete i.mfaInfo,delete i.mfaPendingCredential;const h={...i,idToken:u.idToken,refreshToken:u.refreshToken};switch(t.operationType){case"signIn":const f=await nt._fromIdTokenResponse(r,t.operationType,h);return await r._updateCurrentUser(f.user),f;case"reauthenticate":return C(t.user,r,"internal-error"),nt._forOperation(t.user,t.operationType,h);default:Ge(r,"internal-error")}})}async resolveSignIn(e){const t=e;return this.signInResolver(t)}}function Ew(n,e){var i;const t=L(n),r=e;return C(e.customData.operationType,t,"argument-error"),C((i=r.customData._serverResponse)==null?void 0:i.mfaPendingCredential,t,"argument-error"),Bc._fromError(t,r)}/**
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
 */function Dh(n,e){return re(n,"POST","/v2/accounts/mfaEnrollment:start",ne(n,e))}function Iw(n,e){return re(n,"POST","/v2/accounts/mfaEnrollment:finalize",ne(n,e))}function ww(n,e){return re(n,"POST","/v2/accounts/mfaEnrollment:start",ne(n,e))}function vw(n,e){return re(n,"POST","/v2/accounts/mfaEnrollment:finalize",ne(n,e))}function Aw(n,e){return re(n,"POST","/v2/accounts/mfaEnrollment:withdraw",ne(n,e))}class $c{constructor(e){this.user=e,this.enrolledFactors=[],e._onReload(t=>{t.mfaInfo&&(this.enrolledFactors=t.mfaInfo.map(r=>Mi._fromServerResponse(e.auth,r)))})}static _fromUser(e){return new $c(e)}async getSession(){return wn._fromIdtoken(await this.user.getIdToken(),this.user)}async enroll(e,t){const r=e,i=await this.getSession(),s=await Mt(this.user,r._process(this.user.auth,i,t));return await this.user._updateTokensIfNecessary(s),this.user.reload()}async unenroll(e){const t=typeof e=="string"?e:e.uid,r=await this.user.getIdToken();try{const i=await Mt(this.user,Aw(this.user.auth,{idToken:r,mfaEnrollmentId:t}));this.enrolledFactors=this.enrolledFactors.filter(({uid:s})=>s!==t),await this.user._updateTokensIfNecessary(i),await this.user.reload()}catch(i){throw i}}}const ma=new WeakMap;function Rw(n){const e=L(n);return ma.has(e)||ma.set(e,$c._fromUser(e)),ma.get(e)}const xs="__sak";/**
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
 */class bp{constructor(e,t){this.storageRetriever=e,this.type=t}_isAvailable(){try{return this.storage?(this.storage.setItem(xs,"1"),this.storage.removeItem(xs),Promise.resolve(!0)):Promise.resolve(!1)}catch{return Promise.resolve(!1)}}_set(e,t){return this.storage.setItem(e,JSON.stringify(t)),Promise.resolve()}_get(e){const t=this.storage.getItem(e);return Promise.resolve(t?JSON.parse(t):null)}_remove(e){return this.storage.removeItem(e),Promise.resolve()}get storage(){return this.storageRetriever()}}/**
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
 */const bw=1e3,Sw=10;class Sp extends bp{constructor(){super(()=>window.localStorage,"LOCAL"),this.boundEventHandler=(e,t)=>this.onStorageEvent(e,t),this.listeners={},this.localCache={},this.pollTimer=null,this.fallbackToPolling=sp(),this._shouldAllowMigration=!0}forAllChangedKeys(e){for(const t of Object.keys(this.listeners)){const r=this.storage.getItem(t),i=this.localCache[t];r!==i&&e(t,i,r)}}onStorageEvent(e,t=!1){if(!e.key){this.forAllChangedKeys((a,c,u)=>{this.notifyListeners(a,u)});return}const r=e.key;t?this.detachListener():this.stopPolling();const i=()=>{const a=this.storage.getItem(r);!t&&this.localCache[r]===a||this.notifyListeners(r,a)},s=this.storage.getItem(r);JE()&&s!==e.newValue&&e.newValue!==e.oldValue?setTimeout(i,Sw):i()}notifyListeners(e,t){this.localCache[e]=t;const r=this.listeners[e];if(r)for(const i of Array.from(r))i(t&&JSON.parse(t))}startPolling(){this.stopPolling(),this.pollTimer=setInterval(()=>{this.forAllChangedKeys((e,t,r)=>{this.onStorageEvent(new StorageEvent("storage",{key:e,oldValue:t,newValue:r}),!0)})},bw)}stopPolling(){this.pollTimer&&(clearInterval(this.pollTimer),this.pollTimer=null)}attachListener(){window.addEventListener("storage",this.boundEventHandler)}detachListener(){window.removeEventListener("storage",this.boundEventHandler)}_addListener(e,t){Object.keys(this.listeners).length===0&&(this.fallbackToPolling?this.startPolling():this.attachListener()),this.listeners[e]||(this.listeners[e]=new Set,this.localCache[e]=this.storage.getItem(e)),this.listeners[e].add(t)}_removeListener(e,t){this.listeners[e]&&(this.listeners[e].delete(t),this.listeners[e].size===0&&delete this.listeners[e]),Object.keys(this.listeners).length===0&&(this.detachListener(),this.stopPolling())}async _set(e,t){await super._set(e,t),this.localCache[e]=JSON.stringify(t)}async _get(e){const t=await super._get(e);return this.localCache[e]=JSON.stringify(t),t}async _remove(e){await super._remove(e),delete this.localCache[e]}}Sp.type="LOCAL";const Pp=Sp;/**
 * @license
 * Copyright 2025 Google LLC
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
 */const Pw=1e3;function ga(n){var r;const e=n.replace(/[\\^$.*+?()[\]{}|]/g,"\\$&"),t=RegExp(`${e}=([^;]+)`);return((r=document.cookie.match(t))==null?void 0:r[1])??null}function _a(n){return`${window.location.protocol==="http:"?"__dev_":"__HOST-"}FIREBASE_${n.split(":")[3]}`}class Cp{constructor(){this.type="COOKIE",this.listenerUnsubscribes=new Map}_getFinalTarget(e){if(typeof window===void 0)return e;const t=new URL(`${window.location.origin}/__cookies__`);return t.searchParams.set("finalTarget",e),t}async _isAvailable(){return typeof isSecureContext=="boolean"&&!isSecureContext||typeof navigator>"u"||typeof document>"u"?!1:navigator.cookieEnabled??!0}async _set(e,t){}async _get(e){if(!this._isAvailable())return null;const t=_a(e);if(window.cookieStore){const r=await window.cookieStore.get(t);return r==null?void 0:r.value}return ga(t)}async _remove(e){if(!this._isAvailable()||!await this._get(e))return;const r=_a(e);document.cookie=`${r}=;Max-Age=34560000;Partitioned;Secure;SameSite=Strict;Path=/;Priority=High`,await fetch("/__cookies__",{method:"DELETE"}).catch(()=>{})}_addListener(e,t){if(!this._isAvailable())return;const r=_a(e);if(window.cookieStore){const c=h=>{const f=h.changed.find(y=>y.name===r);f&&t(f.value),h.deleted.find(y=>y.name===r)&&t(null)},u=()=>window.cookieStore.removeEventListener("change",c);return this.listenerUnsubscribes.set(t,u),window.cookieStore.addEventListener("change",c)}let i=ga(r);const s=setInterval(()=>{const c=ga(r);c!==i&&(t(c),i=c)},Pw),a=()=>clearInterval(s);this.listenerUnsubscribes.set(t,a)}_removeListener(e,t){const r=this.listenerUnsubscribes.get(t);r&&(r(),this.listenerUnsubscribes.delete(t))}}Cp.type="COOKIE";const Cw=Cp;/**
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
 */class kp extends bp{constructor(){super(()=>window.sessionStorage,"SESSION")}_addListener(e,t){}_removeListener(e,t){}}kp.type="SESSION";const qc=kp;/**
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
 */function kw(n){return Promise.all(n.map(async e=>{try{return{fulfilled:!0,value:await e}}catch(t){return{fulfilled:!1,reason:t}}}))}/**
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
 */class fo{constructor(e){this.eventTarget=e,this.handlersMap={},this.boundEventHandler=this.handleEvent.bind(this)}static _getInstance(e){const t=this.receivers.find(i=>i.isListeningto(e));if(t)return t;const r=new fo(e);return this.receivers.push(r),r}isListeningto(e){return this.eventTarget===e}async handleEvent(e){const t=e,{eventId:r,eventType:i,data:s}=t.data,a=this.handlersMap[i];if(!(a!=null&&a.size))return;t.ports[0].postMessage({status:"ack",eventId:r,eventType:i});const c=Array.from(a).map(async h=>h(t.origin,s)),u=await kw(c);t.ports[0].postMessage({status:"done",eventId:r,eventType:i,response:u})}_subscribe(e,t){Object.keys(this.handlersMap).length===0&&this.eventTarget.addEventListener("message",this.boundEventHandler),this.handlersMap[e]||(this.handlersMap[e]=new Set),this.handlersMap[e].add(t)}_unsubscribe(e,t){this.handlersMap[e]&&t&&this.handlersMap[e].delete(t),(!t||this.handlersMap[e].size===0)&&delete this.handlersMap[e],Object.keys(this.handlersMap).length===0&&this.eventTarget.removeEventListener("message",this.boundEventHandler)}}fo.receivers=[];/**
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
 */function po(n="",e=10){let t="";for(let r=0;r<e;r++)t+=Math.floor(Math.random()*10);return n+t}/**
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
 */class Nw{constructor(e){this.target=e,this.handlers=new Set}removeMessageHandler(e){e.messageChannel&&(e.messageChannel.port1.removeEventListener("message",e.onMessage),e.messageChannel.port1.close()),this.handlers.delete(e)}async _send(e,t,r=50){const i=typeof MessageChannel<"u"?new MessageChannel:null;if(!i)throw new Error("connection_unavailable");let s,a;return new Promise((c,u)=>{const h=po("",20);i.port1.start();const f=setTimeout(()=>{u(new Error("unsupported_event"))},r);a={messageChannel:i,onMessage(m){const y=m;if(y.data.eventId===h)switch(y.data.status){case"ack":clearTimeout(f),s=setTimeout(()=>{u(new Error("timeout"))},3e3);break;case"done":clearTimeout(s),c(y.data.response);break;default:clearTimeout(f),clearTimeout(s),u(new Error("invalid_response"));break}}},this.handlers.add(a),i.port1.addEventListener("message",a.onMessage),this.target.postMessage({eventType:e,eventId:h,data:t},[i.port2])}).finally(()=>{a&&this.removeMessageHandler(a)})}}/**
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
 */function pe(){return window}function Dw(n){pe().location.href=n}/**
 * @license
 * Copyright 2020 Google LLC.
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
 */function jc(){return typeof pe().WorkerGlobalScope<"u"&&typeof pe().importScripts=="function"}async function Ow(){if(!(navigator!=null&&navigator.serviceWorker))return null;try{return(await navigator.serviceWorker.ready).active}catch{return null}}function Vw(){var n;return((n=navigator==null?void 0:navigator.serviceWorker)==null?void 0:n.controller)||null}function Mw(){return jc()?self:null}/**
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
 */const Np="firebaseLocalStorageDb",Lw=1,Fs="firebaseLocalStorage",Dp="fbase_key";class Li{constructor(e){this.request=e}toPromise(){return new Promise((e,t)=>{this.request.addEventListener("success",()=>{e(this.request.result)}),this.request.addEventListener("error",()=>{t(this.request.error)})})}}function mo(n,e){return n.transaction([Fs],e?"readwrite":"readonly").objectStore(Fs)}function Uw(){const n=indexedDB.deleteDatabase(Np);return new Li(n).toPromise()}function Xa(){const n=indexedDB.open(Np,Lw);return new Promise((e,t)=>{n.addEventListener("error",()=>{t(n.error)}),n.addEventListener("upgradeneeded",()=>{const r=n.result;try{r.createObjectStore(Fs,{keyPath:Dp})}catch(i){t(i)}}),n.addEventListener("success",async()=>{const r=n.result;r.objectStoreNames.contains(Fs)?e(r):(r.close(),await Uw(),e(await Xa()))})})}async function Oh(n,e,t){const r=mo(n,!0).put({[Dp]:e,value:t});return new Li(r).toPromise()}async function xw(n,e){const t=mo(n,!1).get(e),r=await new Li(t).toPromise();return r===void 0?null:r.value}function Vh(n,e){const t=mo(n,!0).delete(e);return new Li(t).toPromise()}const Fw=800,Bw=3;class Op{constructor(){this.type="LOCAL",this._shouldAllowMigration=!0,this.listeners={},this.localCache={},this.pollTimer=null,this.pendingWrites=0,this.receiver=null,this.sender=null,this.serviceWorkerReceiverAvailable=!1,this.activeServiceWorker=null,this._workerInitializationPromise=this.initializeServiceWorkerMessaging().then(()=>{},()=>{})}async _openDb(){return this.db?this.db:(this.db=await Xa(),this.db)}async _withRetries(e){let t=0;for(;;)try{const r=await this._openDb();return await e(r)}catch(r){if(t++>Bw)throw r;this.db&&(this.db.close(),this.db=void 0)}}async initializeServiceWorkerMessaging(){return jc()?this.initializeReceiver():this.initializeSender()}async initializeReceiver(){this.receiver=fo._getInstance(Mw()),this.receiver._subscribe("keyChanged",async(e,t)=>({keyProcessed:(await this._poll()).includes(t.key)})),this.receiver._subscribe("ping",async(e,t)=>["keyChanged"])}async initializeSender(){var t,r;if(this.activeServiceWorker=await Ow(),!this.activeServiceWorker)return;this.sender=new Nw(this.activeServiceWorker);const e=await this.sender._send("ping",{},800);e&&(t=e[0])!=null&&t.fulfilled&&(r=e[0])!=null&&r.value.includes("keyChanged")&&(this.serviceWorkerReceiverAvailable=!0)}async notifyServiceWorker(e){if(!(!this.sender||!this.activeServiceWorker||Vw()!==this.activeServiceWorker))try{await this.sender._send("keyChanged",{key:e},this.serviceWorkerReceiverAvailable?800:50)}catch{}}async _isAvailable(){try{if(!indexedDB)return!1;const e=await Xa();return await Oh(e,xs,"1"),await Vh(e,xs),!0}catch{}return!1}async _withPendingWrite(e){this.pendingWrites++;try{await e()}finally{this.pendingWrites--}}async _set(e,t){return this._withPendingWrite(async()=>(await this._withRetries(r=>Oh(r,e,t)),this.localCache[e]=t,this.notifyServiceWorker(e)))}async _get(e){const t=await this._withRetries(r=>xw(r,e));return this.localCache[e]=t,t}async _remove(e){return this._withPendingWrite(async()=>(await this._withRetries(t=>Vh(t,e)),delete this.localCache[e],this.notifyServiceWorker(e)))}async _poll(){const e=await this._withRetries(i=>{const s=mo(i,!1).getAll();return new Li(s).toPromise()});if(!e)return[];if(this.pendingWrites!==0)return[];const t=[],r=new Set;if(e.length!==0)for(const{fbase_key:i,value:s}of e)r.add(i),JSON.stringify(this.localCache[i])!==JSON.stringify(s)&&(this.notifyListeners(i,s),t.push(i));for(const i of Object.keys(this.localCache))this.localCache[i]&&!r.has(i)&&(this.notifyListeners(i,null),t.push(i));return t}notifyListeners(e,t){this.localCache[e]=t;const r=this.listeners[e];if(r)for(const i of Array.from(r))i(t)}startPolling(){this.stopPolling(),this.pollTimer=setInterval(async()=>this._poll(),Fw)}stopPolling(){this.pollTimer&&(clearInterval(this.pollTimer),this.pollTimer=null)}_addListener(e,t){Object.keys(this.listeners).length===0&&this.startPolling(),this.listeners[e]||(this.listeners[e]=new Set,this._get(e)),this.listeners[e].add(t)}_removeListener(e,t){this.listeners[e]&&(this.listeners[e].delete(t),this.listeners[e].size===0&&delete this.listeners[e]),Object.keys(this.listeners).length===0&&this.stopPolling()}}Op.type="LOCAL";const Vp=Op;/**
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
 */function Mh(n,e){return re(n,"POST","/v2/accounts/mfaSignIn:start",ne(n,e))}function $w(n,e){return re(n,"POST","/v2/accounts/mfaSignIn:finalize",ne(n,e))}function qw(n,e){return re(n,"POST","/v2/accounts/mfaSignIn:finalize",ne(n,e))}/**
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
 */const ya=ap("rcb"),jw=new Oi(3e4,6e4);class Hw{constructor(){var e;this.hostLanguage="",this.counter=0,this.librarySeparatelyLoaded=!!((e=pe().grecaptcha)!=null&&e.render)}load(e,t=""){return C(zw(t),e,"argument-error"),this.shouldResolveImmediately(t)&&vh(pe().grecaptcha)?Promise.resolve(pe().grecaptcha):new Promise((r,i)=>{const s=pe().setTimeout(()=>{i($e(e,"network-request-failed"))},jw.get());pe()[ya]=()=>{pe().clearTimeout(s),delete pe()[ya];const c=pe().grecaptcha;if(!c||!vh(c)){i($e(e,"internal-error"));return}const u=c.render;c.render=(h,f)=>{const m=u(h,f);return this.counter++,m},this.hostLanguage=t,r(c)};const a=`${iI()}?${gr({onload:ya,render:"explicit",hl:t})}`;Mc(a).catch(()=>{clearTimeout(s),i($e(e,"internal-error"))})})}clearedOneInstance(){this.counter--}shouldResolveImmediately(e){var t;return!!((t=pe().grecaptcha)!=null&&t.render)&&(e===this.hostLanguage||this.counter>0||this.librarySeparatelyLoaded)}}function zw(n){return n.length<=6&&/^\s*[a-zA-Z0-9\-]*\s*$/.test(n)}class Ww{async load(e){return new uI(e)}clearedOneInstance(){}}/**
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
 */const ai="recaptcha",Gw={theme:"light",type:"image"};class Kw{constructor(e,t,r={...Gw}){this.parameters=r,this.type=ai,this.destroyed=!1,this.widgetId=null,this.tokenChangeListeners=new Set,this.renderPromise=null,this.recaptcha=null,this.auth=he(e),this.isInvisible=this.parameters.size==="invisible",C(typeof document<"u",this.auth,"operation-not-supported-in-this-environment");const i=typeof t=="string"?document.getElementById(t):t;C(i,this.auth,"argument-error"),this.container=i,this.parameters.callback=this.makeTokenCallback(this.parameters.callback),this._recaptchaLoader=this.auth.settings.appVerificationDisabledForTesting?new Ww:new Hw,this.validateStartingState()}async verify(){this.assertNotDestroyed();const e=await this.render(),t=this.getAssertedRecaptcha(),r=t.getResponse(e);return r||new Promise(i=>{const s=a=>{a&&(this.tokenChangeListeners.delete(s),i(a))};this.tokenChangeListeners.add(s),this.isInvisible&&t.execute(e)})}render(){try{this.assertNotDestroyed()}catch(e){return Promise.reject(e)}return this.renderPromise?this.renderPromise:(this.renderPromise=this.makeRenderPromise().catch(e=>{throw this.renderPromise=null,e}),this.renderPromise)}_reset(){this.assertNotDestroyed(),this.widgetId!==null&&this.getAssertedRecaptcha().reset(this.widgetId)}clear(){this.assertNotDestroyed(),this.destroyed=!0,this._recaptchaLoader.clearedOneInstance(),this.isInvisible||this.container.childNodes.forEach(e=>{this.container.removeChild(e)})}validateStartingState(){C(!this.parameters.sitekey,this.auth,"argument-error"),C(this.isInvisible||!this.container.hasChildNodes(),this.auth,"argument-error"),C(typeof document<"u",this.auth,"operation-not-supported-in-this-environment")}makeTokenCallback(e){return t=>{if(this.tokenChangeListeners.forEach(r=>r(t)),typeof e=="function")e(t);else if(typeof e=="string"){const r=pe()[e];typeof r=="function"&&r(t)}}}assertNotDestroyed(){C(!this.destroyed,this.auth,"internal-error")}async makeRenderPromise(){if(await this.init(),!this.widgetId){let e=this.container;if(!this.isInvisible){const t=document.createElement("div");e.appendChild(t),e=t}this.widgetId=this.getAssertedRecaptcha().render(e,this.parameters)}return this.widgetId}async init(){C(Dc()&&!jc(),this.auth,"internal-error"),await Yw(),this.recaptcha=await this._recaptchaLoader.load(this.auth,this.auth.languageCode||void 0);const e=await $E(this.auth);C(e,this.auth,"internal-error"),this.parameters.sitekey=e}getAssertedRecaptcha(){return C(this.recaptcha,this.auth,"internal-error"),this.recaptcha}}function Yw(){let n=null;return new Promise(e=>{if(document.readyState==="complete"){e();return}n=()=>e(),window.addEventListener("load",n)}).catch(e=>{throw n&&window.removeEventListener("load",n),e})}/**
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
 */class Hc{constructor(e,t){this.verificationId=e,this.onConfirmation=t}confirm(e){const t=en._fromVerification(this.verificationId,e);return this.onConfirmation(t)}}async function Qw(n,e,t){if(ie(n.app))return Promise.reject(Ae(n));const r=he(n),i=await go(r,e,L(t));return new Hc(i,s=>lo(r,s))}async function Jw(n,e,t){const r=L(n);await uo(!1,r,"phone");const i=await go(r.auth,e,L(t));return new Hc(i,s=>Tp(r,s))}async function Xw(n,e,t){const r=L(n);if(ie(r.auth.app))return Promise.reject(Ae(r.auth));const i=await go(r.auth,e,L(t));return new Hc(i,s=>Ep(r,s))}async function go(n,e,t){var r;if(!n._getRecaptchaConfig())try{await up(n)}catch{console.log("Failed to initialize reCAPTCHA Enterprise config. Triggering the reCAPTCHA v2 verification.")}try{let i;if(typeof e=="string"?i={phoneNumber:e}:i=e,"session"in i){const s=i.session;if("phoneNumber"in i){C(s.type==="enroll",n,"internal-error");const a={idToken:s.credential,phoneEnrollmentInfo:{phoneNumber:i.phoneNumber,clientType:"CLIENT_TYPE_WEB"}};return(await Zt(n,a,"mfaSmsEnrollment",async(f,m)=>{if(m.phoneEnrollmentInfo.captchaResponse===si){C((t==null?void 0:t.type)===ai,f,"argument-error");const y=await Ta(f,m,t);return Dh(f,y)}return Dh(f,m)},"PHONE_PROVIDER").catch(f=>Promise.reject(f))).phoneSessionInfo.sessionInfo}else{C(s.type==="signin",n,"internal-error");const a=((r=i.multiFactorHint)==null?void 0:r.uid)||i.multiFactorUid;C(a,n,"missing-multi-factor-info");const c={mfaPendingCredential:s.credential,mfaEnrollmentId:a,phoneSignInInfo:{clientType:"CLIENT_TYPE_WEB"}};return(await Zt(n,c,"mfaSmsSignIn",async(m,y)=>{if(y.phoneSignInInfo.captchaResponse===si){C((t==null?void 0:t.type)===ai,m,"argument-error");const b=await Ta(m,y,t);return Mh(m,b)}return Mh(m,y)},"PHONE_PROVIDER").catch(m=>Promise.reject(m))).phoneResponseInfo.sessionInfo}}else{const s={phoneNumber:i.phoneNumber,clientType:"CLIENT_TYPE_WEB"};return(await Zt(n,s,"sendVerificationCode",async(h,f)=>{if(f.captchaResponse===si){C((t==null?void 0:t.type)===ai,h,"argument-error");const m=await Ta(h,f,t);return kh(h,m)}return kh(h,f)},"PHONE_PROVIDER").catch(h=>Promise.reject(h))).sessionInfo}}finally{t==null||t._reset()}}async function Zw(n,e){const t=L(n);if(ie(t.auth.app))return Promise.reject(Ae(t.auth));await Lc(t,e)}async function Ta(n,e,t){C(t.type===ai,n,"argument-error");const r=await t.verify();C(typeof r=="string",n,"argument-error");const i={...e};if("phoneEnrollmentInfo"in i){const s=i.phoneEnrollmentInfo.phoneNumber,a=i.phoneEnrollmentInfo.captchaResponse,c=i.phoneEnrollmentInfo.clientType,u=i.phoneEnrollmentInfo.recaptchaVersion;return Object.assign(i,{phoneEnrollmentInfo:{phoneNumber:s,recaptchaToken:r,captchaResponse:a,clientType:c,recaptchaVersion:u}}),i}else if("phoneSignInInfo"in i){const s=i.phoneSignInInfo.captchaResponse,a=i.phoneSignInInfo.clientType,c=i.phoneSignInInfo.recaptchaVersion;return Object.assign(i,{phoneSignInInfo:{recaptchaToken:r,captchaResponse:s,clientType:a,recaptchaVersion:c}}),i}else return Object.assign(i,{recaptchaToken:r}),i}/**
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
 */class Rn{constructor(e){this.providerId=Rn.PROVIDER_ID,this.auth=he(e)}verifyPhoneNumber(e,t){return go(this.auth,e,L(t))}static credential(e,t){return en._fromVerification(e,t)}static credentialFromResult(e){const t=e;return Rn.credentialFromTaggedObject(t)}static credentialFromError(e){return Rn.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e)return null;const{phoneNumber:t,temporaryProof:r}=e;return t&&r?en._fromTokenResponse(t,r):null}}Rn.PROVIDER_ID="phone";Rn.PHONE_SIGN_IN_METHOD="phone";/**
 * @license
 * Copyright 2021 Google LLC
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
 */function Mn(n,e){return e?bt(e):(C(n._popupRedirectResolver,n,"argument-error"),n._popupRedirectResolver)}/**
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
 */class zc extends Er{constructor(e){super("custom","custom"),this.params=e}_getIdTokenResponse(e){return Ct(e,this._buildIdpRequest())}_linkToIdToken(e,t){return Ct(e,this._buildIdpRequest(t))}_getReauthenticationResolver(e){return Ct(e,this._buildIdpRequest())}_buildIdpRequest(e){const t={requestUri:this.params.requestUri,sessionId:this.params.sessionId,postBody:this.params.postBody,tenantId:this.params.tenantId,pendingToken:this.params.pendingToken,returnSecureToken:!0,returnIdpCredential:!0};return e&&(t.idToken=e),t}}function ev(n){return yp(n.auth,new zc(n),n.bypassAuthState)}function tv(n){const{auth:e,user:t}=n;return C(t,e,"internal-error"),_p(t,new zc(n),n.bypassAuthState)}async function nv(n){const{auth:e,user:t}=n;return C(t,e,"internal-error"),Lc(t,new zc(n),n.bypassAuthState)}/**
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
 */class Mp{constructor(e,t,r,i,s=!1){this.auth=e,this.resolver=r,this.user=i,this.bypassAuthState=s,this.pendingPromise=null,this.eventManager=null,this.filter=Array.isArray(t)?t:[t]}execute(){return new Promise(async(e,t)=>{this.pendingPromise={resolve:e,reject:t};try{this.eventManager=await this.resolver._initialize(this.auth),await this.onExecution(),this.eventManager.registerConsumer(this)}catch(r){this.reject(r)}})}async onAuthEvent(e){const{urlResponse:t,sessionId:r,postBody:i,tenantId:s,error:a,type:c}=e;if(a){this.reject(a);return}const u={auth:this.auth,requestUri:t,sessionId:r,tenantId:s||void 0,postBody:i||void 0,user:this.user,bypassAuthState:this.bypassAuthState};try{this.resolve(await this.getIdpTask(c)(u))}catch(h){this.reject(h)}}onError(e){this.reject(e)}getIdpTask(e){switch(e){case"signInViaPopup":case"signInViaRedirect":return ev;case"linkViaPopup":case"linkViaRedirect":return nv;case"reauthViaPopup":case"reauthViaRedirect":return tv;default:Ge(this.auth,"internal-error")}}resolve(e){Vt(this.pendingPromise,"Pending promise was never set"),this.pendingPromise.resolve(e),this.unregisterAndCleanUp()}reject(e){Vt(this.pendingPromise,"Pending promise was never set"),this.pendingPromise.reject(e),this.unregisterAndCleanUp()}unregisterAndCleanUp(){this.eventManager&&this.eventManager.unregisterConsumer(this),this.pendingPromise=null,this.cleanUp()}}/**
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
 */const rv=new Oi(2e3,1e4);async function iv(n,e,t){if(ie(n.app))return Promise.reject($e(n,"operation-not-supported-in-this-environment"));const r=he(n);Tr(n,e,Bt);const i=Mn(r,t);return new St(r,"signInViaPopup",e,i).executeNotNull()}async function sv(n,e,t){const r=L(n);if(ie(r.auth.app))return Promise.reject($e(r.auth,"operation-not-supported-in-this-environment"));Tr(r.auth,e,Bt);const i=Mn(r.auth,t);return new St(r.auth,"reauthViaPopup",e,i,r).executeNotNull()}async function ov(n,e,t){const r=L(n);Tr(r.auth,e,Bt);const i=Mn(r.auth,t);return new St(r.auth,"linkViaPopup",e,i,r).executeNotNull()}class St extends Mp{constructor(e,t,r,i,s){super(e,t,i,s),this.provider=r,this.authWindow=null,this.pollId=null,St.currentPopupAction&&St.currentPopupAction.cancel(),St.currentPopupAction=this}async executeNotNull(){const e=await this.execute();return C(e,this.auth,"internal-error"),e}async onExecution(){Vt(this.filter.length===1,"Popup operations only handle one event");const e=po();this.authWindow=await this.resolver._openPopup(this.auth,this.provider,this.filter[0],e),this.authWindow.associatedEvent=e,this.resolver._originValidation(this.auth).catch(t=>{this.reject(t)}),this.resolver._isIframeWebStorageSupported(this.auth,t=>{t||this.reject($e(this.auth,"web-storage-unsupported"))}),this.pollUserCancellation()}get eventId(){var e;return((e=this.authWindow)==null?void 0:e.associatedEvent)||null}cancel(){this.reject($e(this.auth,"cancelled-popup-request"))}cleanUp(){this.authWindow&&this.authWindow.close(),this.pollId&&window.clearTimeout(this.pollId),this.authWindow=null,this.pollId=null,St.currentPopupAction=null}pollUserCancellation(){const e=()=>{var t,r;if((r=(t=this.authWindow)==null?void 0:t.window)!=null&&r.closed){this.pollId=window.setTimeout(()=>{this.pollId=null,this.reject($e(this.auth,"popup-closed-by-user"))},8e3);return}this.pollId=window.setTimeout(e,rv.get())};e()}}St.currentPopupAction=null;/**
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
 */const av="pendingRedirect",ws=new Map;class cv extends Mp{constructor(e,t,r=!1){super(e,["signInViaRedirect","linkViaRedirect","reauthViaRedirect","unknown"],t,void 0,r),this.eventId=null}async execute(){let e=ws.get(this.auth._key());if(!e){try{const r=await uv(this.resolver,this.auth)?await super.execute():null;e=()=>Promise.resolve(r)}catch(t){e=()=>Promise.reject(t)}ws.set(this.auth._key(),e)}return this.bypassAuthState||ws.set(this.auth._key(),()=>Promise.resolve(null)),e()}async onAuthEvent(e){if(e.type==="signInViaRedirect")return super.onAuthEvent(e);if(e.type==="unknown"){this.resolve(null);return}if(e.eventId){const t=await this.auth._redirectUserForId(e.eventId);if(t)return this.user=t,super.onAuthEvent(e);this.resolve(null)}}async onExecution(){}cleanUp(){}}async function uv(n,e){const t=Up(e),r=Lp(n);if(!await r._isAvailable())return!1;const i=await r._get(t)==="true";return await r._remove(t),i}async function Wc(n,e){return Lp(n)._set(Up(e),"true")}function lv(n,e){ws.set(n._key(),e)}function Lp(n){return bt(n._redirectPersistence)}function Up(n){return Is(av,n.config.apiKey,n.name)}/**
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
 */function hv(n,e,t){return dv(n,e,t)}async function dv(n,e,t){if(ie(n.app))return Promise.reject(Ae(n));const r=he(n);Tr(n,e,Bt),await r._initializationPromise;const i=Mn(r,t);return await Wc(i,r),i._openRedirect(r,e,"signInViaRedirect")}function fv(n,e,t){return pv(n,e,t)}async function pv(n,e,t){const r=L(n);if(Tr(r.auth,e,Bt),ie(r.auth.app))return Promise.reject(Ae(r.auth));await r.auth._initializationPromise;const i=Mn(r.auth,t);await Wc(i,r.auth);const s=await Fp(r);return i._openRedirect(r.auth,e,"reauthViaRedirect",s)}function mv(n,e,t){return gv(n,e,t)}async function gv(n,e,t){const r=L(n);Tr(r.auth,e,Bt),await r.auth._initializationPromise;const i=Mn(r.auth,t);await uo(!1,r,e.providerId),await Wc(i,r.auth);const s=await Fp(r);return i._openRedirect(r.auth,e,"linkViaRedirect",s)}async function _v(n,e){return await he(n)._initializationPromise,xp(n,e,!1)}async function xp(n,e,t=!1){if(ie(n.app))return Promise.reject(Ae(n));const r=he(n),i=Mn(r,e),a=await new cv(r,i,t).execute();return a&&!t&&(delete a.user._redirectEventId,await r._persistUserIfCurrent(a.user),await r._setRedirectUser(null,e)),a}async function Fp(n){const e=po(`${n.uid}:::`);return n._redirectEventId=e,await n.auth._setRedirectUser(n),await n.auth._persistUserIfCurrent(n),e}/**
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
 */const yv=10*60*1e3;class Tv{constructor(e){this.auth=e,this.cachedEventUids=new Set,this.consumers=new Set,this.queuedRedirectEvent=null,this.hasHandledPotentialRedirect=!1,this.lastProcessedEventTime=Date.now()}registerConsumer(e){this.consumers.add(e),this.queuedRedirectEvent&&this.isEventForConsumer(this.queuedRedirectEvent,e)&&(this.sendToConsumer(this.queuedRedirectEvent,e),this.saveEventToCache(this.queuedRedirectEvent),this.queuedRedirectEvent=null)}unregisterConsumer(e){this.consumers.delete(e)}onEvent(e){if(this.hasEventBeenHandled(e))return!1;let t=!1;return this.consumers.forEach(r=>{this.isEventForConsumer(e,r)&&(t=!0,this.sendToConsumer(e,r),this.saveEventToCache(e))}),this.hasHandledPotentialRedirect||!Ev(e)||(this.hasHandledPotentialRedirect=!0,t||(this.queuedRedirectEvent=e,t=!0)),t}sendToConsumer(e,t){var r;if(e.error&&!Bp(e)){const i=((r=e.error.code)==null?void 0:r.split("auth/")[1])||"internal-error";t.onError($e(this.auth,i))}else t.onAuthEvent(e)}isEventForConsumer(e,t){const r=t.eventId===null||!!e.eventId&&e.eventId===t.eventId;return t.filter.includes(e.type)&&r}hasEventBeenHandled(e){return Date.now()-this.lastProcessedEventTime>=yv&&this.cachedEventUids.clear(),this.cachedEventUids.has(Lh(e))}saveEventToCache(e){this.cachedEventUids.add(Lh(e)),this.lastProcessedEventTime=Date.now()}}function Lh(n){return[n.type,n.eventId,n.sessionId,n.tenantId].filter(e=>e).join("-")}function Bp({type:n,error:e}){return n==="unknown"&&(e==null?void 0:e.code)==="auth/no-auth-event"}function Ev(n){switch(n.type){case"signInViaRedirect":case"linkViaRedirect":case"reauthViaRedirect":return!0;case"unknown":return Bp(n);default:return!1}}/**
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
 */async function Iv(n,e={}){return re(n,"GET","/v1/projects",e)}/**
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
 */const wv=/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,vv=/^https?/;async function Av(n){if(n.config.emulator)return;const{authorizedDomains:e}=await Iv(n);for(const t of e)try{if(Rv(t))return}catch{}Ge(n,"unauthorized-domain")}function Rv(n){const e=yi(),{protocol:t,hostname:r}=new URL(e);if(n.startsWith("chrome-extension://")){const a=new URL(n);return a.hostname===""&&r===""?t==="chrome-extension:"&&n.replace("chrome-extension://","")===e.replace("chrome-extension://",""):t==="chrome-extension:"&&a.hostname===r}if(!vv.test(t))return!1;if(wv.test(n))return r===n;const i=n.replace(/\./g,"\\.");return new RegExp("^(.+\\."+i+"|"+i+")$","i").test(r)}/**
 * @license
 * Copyright 2020 Google LLC.
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
 */const bv=new Oi(3e4,6e4);function Uh(){const n=pe().___jsl;if(n!=null&&n.H){for(const e of Object.keys(n.H))if(n.H[e].r=n.H[e].r||[],n.H[e].L=n.H[e].L||[],n.H[e].r=[...n.H[e].L],n.CP)for(let t=0;t<n.CP.length;t++)n.CP[t]=null}}function Sv(n){return new Promise((e,t)=>{var i,s,a;function r(){Uh(),gapi.load("gapi.iframes",{callback:()=>{e(gapi.iframes.getContext())},ontimeout:()=>{Uh(),t($e(n,"network-request-failed"))},timeout:bv.get()})}if((s=(i=pe().gapi)==null?void 0:i.iframes)!=null&&s.Iframe)e(gapi.iframes.getContext());else if((a=pe().gapi)!=null&&a.load)r();else{const c=ap("iframefcb");return pe()[c]=()=>{gapi.load?r():t($e(n,"network-request-failed"))},Mc(`${oI()}?onload=${c}`).catch(u=>t(u))}}).catch(e=>{throw vs=null,e})}let vs=null;function Pv(n){return vs=vs||Sv(n),vs}/**
 * @license
 * Copyright 2020 Google LLC.
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
 */const Cv=new Oi(5e3,15e3),kv="__/auth/iframe",Nv="emulator/auth/iframe",Dv={style:{position:"absolute",top:"-100px",width:"1px",height:"1px"},"aria-hidden":"true",tabindex:"-1"},Ov=new Map([["identitytoolkit.googleapis.com","p"],["staging-identitytoolkit.sandbox.googleapis.com","s"],["test-identitytoolkit.sandbox.googleapis.com","t"]]);function Vv(n){const e=n.config;C(e.authDomain,n,"auth-domain-config-required");const t=e.emulator?Oc(e,Nv):`https://${n.config.authDomain}/${kv}`,r={apiKey:e.apiKey,appName:n.name,v:Vn},i=Ov.get(n.config.apiHost);i&&(r.eid=i);const s=n._getFrameworks();return s.length&&(r.fw=s.join(",")),`${t}?${gr(r).slice(1)}`}async function Mv(n){const e=await Pv(n),t=pe().gapi;return C(t,n,"internal-error"),e.open({where:document.body,url:Vv(n),messageHandlersFilter:t.iframes.CROSS_ORIGIN_IFRAMES_FILTER,attributes:Dv,dontclear:!0},r=>new Promise(async(i,s)=>{await r.restyle({setHideOnLeave:!1});const a=$e(n,"network-request-failed"),c=pe().setTimeout(()=>{s(a)},Cv.get());function u(){pe().clearTimeout(c),i(r)}r.ping(u).then(u,()=>{s(a)})}))}/**
 * @license
 * Copyright 2020 Google LLC.
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
 */const Lv={location:"yes",resizable:"yes",statusbar:"yes",toolbar:"no"},Uv=500,xv=600,Fv="_blank",Bv="http://localhost";class xh{constructor(e){this.window=e,this.associatedEvent=null}close(){if(this.window)try{this.window.close()}catch{}}}function $v(n,e,t,r=Uv,i=xv){const s=Math.max((window.screen.availHeight-i)/2,0).toString(),a=Math.max((window.screen.availWidth-r)/2,0).toString();let c="";const u={...Lv,width:r.toString(),height:i.toString(),top:s,left:a},h=Me().toLowerCase();t&&(c=ep(h)?Fv:t),Xf(h)&&(e=e||Bv,u.scrollbars="yes");const f=Object.entries(u).reduce((y,[b,k])=>`${y}${b}=${k},`,"");if(QE(h)&&c!=="_self")return qv(e||"",c),new xh(null);const m=window.open(e||"",c,f);C(m,n,"popup-blocked");try{m.focus()}catch{}return new xh(m)}function qv(n,e){const t=document.createElement("a");t.href=n,t.target=e;const r=document.createEvent("MouseEvent");r.initMouseEvent("click",!0,!0,window,1,0,0,0,0,!1,!1,!1,!1,1,null),t.dispatchEvent(r)}/**
 * @license
 * Copyright 2021 Google LLC
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
 */const jv="__/auth/handler",Hv="emulator/auth/handler",zv=encodeURIComponent("fac");async function Fh(n,e,t,r,i,s){C(n.config.authDomain,n,"auth-domain-config-required"),C(n.config.apiKey,n,"invalid-api-key");const a={apiKey:n.config.apiKey,appName:n.name,authType:t,redirectUrl:r,v:Vn,eventId:i};if(e instanceof Bt){e.setDefaultLanguage(n.languageCode),a.providerId=e.providerId||"",aT(e.getCustomParameters())||(a.customParameters=JSON.stringify(e.getCustomParameters()));for(const[f,m]of Object.entries({}))a[f]=m}if(e instanceof wr){const f=e.getScopes().filter(m=>m!=="");f.length>0&&(a.scopes=f.join(","))}n.tenantId&&(a.tid=n.tenantId);const c=a;for(const f of Object.keys(c))c[f]===void 0&&delete c[f];const u=await n._getAppCheckToken(),h=u?`#${zv}=${encodeURIComponent(u)}`:"";return`${Wv(n)}?${gr(c).slice(1)}${h}`}function Wv({config:n}){return n.emulator?Oc(n,Hv):`https://${n.authDomain}/${jv}`}/**
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
 */const Ea="webStorageSupport";class Gv{constructor(){this.eventManagers={},this.iframes={},this.originValidationPromises={},this._redirectPersistence=qc,this._completeRedirectFn=xp,this._overrideRedirectResult=lv}async _openPopup(e,t,r,i){var a;Vt((a=this.eventManagers[e._key()])==null?void 0:a.manager,"_initialize() not called before _openPopup()");const s=await Fh(e,t,r,yi(),i);return $v(e,s,po())}async _openRedirect(e,t,r,i){await this._originValidation(e);const s=await Fh(e,t,r,yi(),i);return Dw(s),new Promise(()=>{})}_initialize(e){const t=e._key();if(this.eventManagers[t]){const{manager:i,promise:s}=this.eventManagers[t];return i?Promise.resolve(i):(Vt(s,"If manager is not set, promise should be"),s)}const r=this.initAndGetManager(e);return this.eventManagers[t]={promise:r},r.catch(()=>{delete this.eventManagers[t]}),r}async initAndGetManager(e){const t=await Mv(e),r=new Tv(e);return t.register("authEvent",i=>(C(i==null?void 0:i.authEvent,e,"invalid-auth-event"),{status:r.onEvent(i.authEvent)?"ACK":"ERROR"}),gapi.iframes.CROSS_ORIGIN_IFRAMES_FILTER),this.eventManagers[e._key()]={manager:r},this.iframes[e._key()]=t,r}_isIframeWebStorageSupported(e,t){this.iframes[e._key()].send(Ea,{type:Ea},i=>{var a;const s=(a=i==null?void 0:i[0])==null?void 0:a[Ea];s!==void 0&&t(!!s),Ge(e,"internal-error")},gapi.iframes.CROSS_ORIGIN_IFRAMES_FILTER)}_originValidation(e){const t=e._key();return this.originValidationPromises[t]||(this.originValidationPromises[t]=Av(e)),this.originValidationPromises[t]}get _shouldInitProactively(){return sp()||Zf()||Vc()}}const $p=Gv;class qp{constructor(e){this.factorId=e}_process(e,t,r){switch(t.type){case"enroll":return this._finalizeEnroll(e,t.credential,r);case"signin":return this._finalizeSignIn(e,t.credential);default:return ft("unexpected MultiFactorSessionType")}}}class Gc extends qp{constructor(e){super("phone"),this.credential=e}static _fromCredential(e){return new Gc(e)}_finalizeEnroll(e,t,r){return Iw(e,{idToken:t,displayName:r,phoneVerificationInfo:this.credential._makeVerificationRequest()})}_finalizeSignIn(e,t){return $w(e,{mfaPendingCredential:t,phoneVerificationInfo:this.credential._makeVerificationRequest()})}}class jp{constructor(){}static assertion(e){return Gc._fromCredential(e)}}jp.FACTOR_ID="phone";class Hp{static assertionForEnrollment(e,t){return Ii._fromSecret(e,t)}static assertionForSignIn(e,t){return Ii._fromEnrollmentId(e,t)}static async generateSecret(e){var i;const t=e;C(typeof((i=t.user)==null?void 0:i.auth)<"u","internal-error");const r=await ww(t.user.auth,{idToken:t.credential,totpEnrollmentInfo:{}});return _o._fromStartTotpMfaEnrollmentResponse(r,t.user.auth)}}Hp.FACTOR_ID="totp";class Ii extends qp{constructor(e,t,r){super("totp"),this.otp=e,this.enrollmentId=t,this.secret=r}static _fromSecret(e,t){return new Ii(t,void 0,e)}static _fromEnrollmentId(e,t){return new Ii(t,e)}async _finalizeEnroll(e,t,r){return C(typeof this.secret<"u",e,"argument-error"),vw(e,{idToken:t,displayName:r,totpVerificationInfo:this.secret._makeTotpVerificationInfo(this.otp)})}async _finalizeSignIn(e,t){C(this.enrollmentId!==void 0&&this.otp!==void 0,e,"argument-error");const r={verificationCode:this.otp};return qw(e,{mfaPendingCredential:t,mfaEnrollmentId:this.enrollmentId,totpVerificationInfo:r})}}class _o{constructor(e,t,r,i,s,a,c){this.sessionInfo=a,this.auth=c,this.secretKey=e,this.hashingAlgorithm=t,this.codeLength=r,this.codeIntervalSeconds=i,this.enrollmentCompletionDeadline=s}static _fromStartTotpMfaEnrollmentResponse(e,t){return new _o(e.totpSessionInfo.sharedSecretKey,e.totpSessionInfo.hashingAlgorithm,e.totpSessionInfo.verificationCodeLength,e.totpSessionInfo.periodSec,new Date(e.totpSessionInfo.finalizeEnrollmentTime).toUTCString(),e.totpSessionInfo.sessionInfo,t)}_makeTotpVerificationInfo(e){return{sessionInfo:this.sessionInfo,verificationCode:e}}generateQrCodeUrl(e,t){var i;let r=!1;return(cs(e)||cs(t))&&(r=!0),r&&(cs(e)&&(e=((i=this.auth.currentUser)==null?void 0:i.email)||"unknownuser"),cs(t)&&(t=this.auth.name)),`otpauth://totp/${t}:${e}?secret=${this.secretKey}&issuer=${t}&algorithm=${this.hashingAlgorithm}&digits=${this.codeLength}`}}function cs(n){return typeof n>"u"||(n==null?void 0:n.length)===0}var Bh="@firebase/auth",$h="1.12.1";/**
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
 */class Kv{constructor(e){this.auth=e,this.internalListeners=new Map}getUid(){var e;return this.assertAuthConfigured(),((e=this.auth.currentUser)==null?void 0:e.uid)||null}async getToken(e){return this.assertAuthConfigured(),await this.auth._initializationPromise,this.auth.currentUser?{accessToken:await this.auth.currentUser.getIdToken(e)}:null}addAuthTokenListener(e){if(this.assertAuthConfigured(),this.internalListeners.has(e))return;const t=this.auth.onIdTokenChanged(r=>{e((r==null?void 0:r.stsTokenManager.accessToken)||null)});this.internalListeners.set(e,t),this.updateProactiveRefresh()}removeAuthTokenListener(e){this.assertAuthConfigured();const t=this.internalListeners.get(e);t&&(this.internalListeners.delete(e),t(),this.updateProactiveRefresh())}assertAuthConfigured(){C(this.auth._initializationPromise,"dependent-sdk-initialized-before-auth")}updateProactiveRefresh(){this.internalListeners.size>0?this.auth._startProactiveRefresh():this.auth._stopProactiveRefresh()}}/**
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
 */function Yv(n){switch(n){case"Node":return"node";case"ReactNative":return"rn";case"Worker":return"webworker";case"Cordova":return"cordova";case"WebExtension":return"web-extension";default:return}}function Qv(n){Le(new Ce("auth",(e,{options:t})=>{const r=e.getProvider("app").getImmediate(),i=e.getProvider("heartbeat"),s=e.getProvider("app-check-internal"),{apiKey:a,authDomain:c}=r.options;C(a&&!a.includes(":"),"invalid-api-key",{appName:r.name});const u={apiKey:a,authDomain:c,clientPlatform:n,apiHost:"identitytoolkit.googleapis.com",tokenApiHost:"securetoken.googleapis.com",apiScheme:"https",sdkClientVersion:op(n)},h=new nI(r,i,s,u);return mI(h,t),h},"PUBLIC").setInstantiationMode("EXPLICIT").setInstanceCreatedCallback((e,t,r)=>{e.getProvider("auth-internal").initialize()})),Le(new Ce("auth-internal",e=>{const t=he(e.getProvider("auth").getImmediate());return(r=>new Kv(r))(t)},"PRIVATE").setInstantiationMode("EXPLICIT")),Te(Bh,$h,Yv(n)),Te(Bh,$h,"esm2020")}/**
 * @license
 * Copyright 2021 Google LLC
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
 */const Jv=5*60,Xv=Vf("authIdTokenMaxAge")||Jv;let qh=null;const Zv=n=>async e=>{const t=e&&await e.getIdTokenResult(),r=t&&(new Date().getTime()-Date.parse(t.issuedAtTime))/1e3;if(r&&r>Xv)return;const i=t==null?void 0:t.token;qh!==i&&(qh=i,await fetch(n,{method:i?"POST":"DELETE",headers:i?{Authorization:`Bearer ${i}`}:{}}))};function eA(n=yr()){const e=Ke(n,"auth");if(e.isInitialized())return e.getImmediate();const t=lp(n,{popupRedirectResolver:$p,persistence:[Vp,Pp,qc]}),r=Vf("authTokenSyncURL");if(r&&typeof isSecureContext=="boolean"&&isSecureContext){const s=new URL(r,location.origin);if(location.origin===s.origin){const a=Zv(s.toString());Rp(t,a,()=>a(t.currentUser)),Ap(t,c=>a(c))}}const i=Df("auth");return i&&hp(t,`http://${i}`),t}function tA(){var n;return((n=document.getElementsByTagName("head"))==null?void 0:n[0])??document}rI({loadJS(n){return new Promise((e,t)=>{const r=document.createElement("script");r.setAttribute("src",n),r.onload=e,r.onerror=i=>{const s=$e("internal-error");s.customData=i,t(s)},r.type="text/javascript",r.charset="UTF-8",tA().appendChild(r)})},gapiScript:"https://apis.google.com/js/api.js",recaptchaV2Script:"https://www.google.com/recaptcha/api.js",recaptchaEnterpriseScript:"https://www.google.com/recaptcha/enterprise.js?render="});Qv("Browser");const G0=Object.freeze(Object.defineProperty({__proto__:null,ActionCodeOperation:CE,ActionCodeURL:Ir,AuthCredential:Er,AuthErrorCodes:DE,EmailAuthCredential:cr,EmailAuthProvider:pn,FacebookAuthProvider:wt,FactorId:RE,GithubAuthProvider:At,GoogleAuthProvider:vt,OAuthCredential:yt,OAuthProvider:oi,OperationType:PE,PhoneAuthCredential:en,PhoneAuthProvider:Rn,PhoneMultiFactorGenerator:jp,ProviderId:bE,RecaptchaVerifier:Kw,SAMLAuthProvider:Ls,SignInMethod:SE,TotpMultiFactorGenerator:Hp,TotpSecret:_o,TwitterAuthProvider:Rt,applyActionCode:HI,beforeAuthStateChanged:Rp,browserCookiePersistence:Cw,browserLocalPersistence:Pp,browserPopupRedirectResolver:$p,browserSessionPersistence:qc,checkActionCode:Ip,confirmPasswordReset:jI,connectAuthEmulator:hp,createUserWithEmailAndPassword:WI,debugErrorMap:NE,deleteUser:Tw,fetchSignInMethodsForEmail:XI,getAdditionalUserInfo:lw,getAuth:eA,getIdToken:HE,getIdTokenResult:Kf,getMultiFactorResolver:Ew,getRedirectResult:_v,inMemoryPersistence:Ja,indexedDBLocalPersistence:Vp,initializeAuth:lp,initializeRecaptchaConfig:dw,isSignInWithEmailLink:YI,linkWithCredential:Tp,linkWithPhoneNumber:Jw,linkWithPopup:ov,linkWithRedirect:mv,multiFactor:Rw,onAuthStateChanged:pw,onIdTokenChanged:Ap,parseActionCodeURL:MI,prodErrorMap:$f,reauthenticateWithCredential:Ep,reauthenticateWithPhoneNumber:Xw,reauthenticateWithPopup:sv,reauthenticateWithRedirect:fv,reload:Yf,revokeAccessToken:yw,sendEmailVerification:ZI,sendPasswordResetEmail:qI,sendSignInLinkToEmail:KI,setPersistence:hw,signInAnonymously:xI,signInWithCredential:lo,signInWithCustomToken:$I,signInWithEmailAndPassword:GI,signInWithEmailLink:QI,signInWithPhoneNumber:Qw,signInWithPopup:iv,signInWithRedirect:hv,signOut:_w,unlink:FI,updateCurrentUser:gw,updateEmail:rw,updatePassword:iw,updatePhoneNumber:Zw,updateProfile:nw,useDeviceLanguage:mw,validatePassword:fw,verifyBeforeUpdateEmail:ew,verifyPasswordResetCode:zI},Symbol.toStringTag,{value:"Module"}));var jh=typeof globalThis<"u"?globalThis:typeof window<"u"?window:typeof global<"u"?global:typeof self<"u"?self:{};/** @license
Copyright The Closure Library Authors.
SPDX-License-Identifier: Apache-2.0
*/var tn,zp;(function(){var n;/** @license

 Copyright The Closure Library Authors.
 SPDX-License-Identifier: Apache-2.0
*/function e(I,g){function T(){}T.prototype=g.prototype,I.F=g.prototype,I.prototype=new T,I.prototype.constructor=I,I.D=function(w,E,A){for(var _=Array(arguments.length-2),je=2;je<arguments.length;je++)_[je-2]=arguments[je];return g.prototype[E].apply(w,_)}}function t(){this.blockSize=-1}function r(){this.blockSize=-1,this.blockSize=64,this.g=Array(4),this.C=Array(this.blockSize),this.o=this.h=0,this.u()}e(r,t),r.prototype.u=function(){this.g[0]=1732584193,this.g[1]=4023233417,this.g[2]=2562383102,this.g[3]=271733878,this.o=this.h=0};function i(I,g,T){T||(T=0);const w=Array(16);if(typeof g=="string")for(var E=0;E<16;++E)w[E]=g.charCodeAt(T++)|g.charCodeAt(T++)<<8|g.charCodeAt(T++)<<16|g.charCodeAt(T++)<<24;else for(E=0;E<16;++E)w[E]=g[T++]|g[T++]<<8|g[T++]<<16|g[T++]<<24;g=I.g[0],T=I.g[1],E=I.g[2];let A=I.g[3],_;_=g+(A^T&(E^A))+w[0]+3614090360&4294967295,g=T+(_<<7&4294967295|_>>>25),_=A+(E^g&(T^E))+w[1]+3905402710&4294967295,A=g+(_<<12&4294967295|_>>>20),_=E+(T^A&(g^T))+w[2]+606105819&4294967295,E=A+(_<<17&4294967295|_>>>15),_=T+(g^E&(A^g))+w[3]+3250441966&4294967295,T=E+(_<<22&4294967295|_>>>10),_=g+(A^T&(E^A))+w[4]+4118548399&4294967295,g=T+(_<<7&4294967295|_>>>25),_=A+(E^g&(T^E))+w[5]+1200080426&4294967295,A=g+(_<<12&4294967295|_>>>20),_=E+(T^A&(g^T))+w[6]+2821735955&4294967295,E=A+(_<<17&4294967295|_>>>15),_=T+(g^E&(A^g))+w[7]+4249261313&4294967295,T=E+(_<<22&4294967295|_>>>10),_=g+(A^T&(E^A))+w[8]+1770035416&4294967295,g=T+(_<<7&4294967295|_>>>25),_=A+(E^g&(T^E))+w[9]+2336552879&4294967295,A=g+(_<<12&4294967295|_>>>20),_=E+(T^A&(g^T))+w[10]+4294925233&4294967295,E=A+(_<<17&4294967295|_>>>15),_=T+(g^E&(A^g))+w[11]+2304563134&4294967295,T=E+(_<<22&4294967295|_>>>10),_=g+(A^T&(E^A))+w[12]+1804603682&4294967295,g=T+(_<<7&4294967295|_>>>25),_=A+(E^g&(T^E))+w[13]+4254626195&4294967295,A=g+(_<<12&4294967295|_>>>20),_=E+(T^A&(g^T))+w[14]+2792965006&4294967295,E=A+(_<<17&4294967295|_>>>15),_=T+(g^E&(A^g))+w[15]+1236535329&4294967295,T=E+(_<<22&4294967295|_>>>10),_=g+(E^A&(T^E))+w[1]+4129170786&4294967295,g=T+(_<<5&4294967295|_>>>27),_=A+(T^E&(g^T))+w[6]+3225465664&4294967295,A=g+(_<<9&4294967295|_>>>23),_=E+(g^T&(A^g))+w[11]+643717713&4294967295,E=A+(_<<14&4294967295|_>>>18),_=T+(A^g&(E^A))+w[0]+3921069994&4294967295,T=E+(_<<20&4294967295|_>>>12),_=g+(E^A&(T^E))+w[5]+3593408605&4294967295,g=T+(_<<5&4294967295|_>>>27),_=A+(T^E&(g^T))+w[10]+38016083&4294967295,A=g+(_<<9&4294967295|_>>>23),_=E+(g^T&(A^g))+w[15]+3634488961&4294967295,E=A+(_<<14&4294967295|_>>>18),_=T+(A^g&(E^A))+w[4]+3889429448&4294967295,T=E+(_<<20&4294967295|_>>>12),_=g+(E^A&(T^E))+w[9]+568446438&4294967295,g=T+(_<<5&4294967295|_>>>27),_=A+(T^E&(g^T))+w[14]+3275163606&4294967295,A=g+(_<<9&4294967295|_>>>23),_=E+(g^T&(A^g))+w[3]+4107603335&4294967295,E=A+(_<<14&4294967295|_>>>18),_=T+(A^g&(E^A))+w[8]+1163531501&4294967295,T=E+(_<<20&4294967295|_>>>12),_=g+(E^A&(T^E))+w[13]+2850285829&4294967295,g=T+(_<<5&4294967295|_>>>27),_=A+(T^E&(g^T))+w[2]+4243563512&4294967295,A=g+(_<<9&4294967295|_>>>23),_=E+(g^T&(A^g))+w[7]+1735328473&4294967295,E=A+(_<<14&4294967295|_>>>18),_=T+(A^g&(E^A))+w[12]+2368359562&4294967295,T=E+(_<<20&4294967295|_>>>12),_=g+(T^E^A)+w[5]+4294588738&4294967295,g=T+(_<<4&4294967295|_>>>28),_=A+(g^T^E)+w[8]+2272392833&4294967295,A=g+(_<<11&4294967295|_>>>21),_=E+(A^g^T)+w[11]+1839030562&4294967295,E=A+(_<<16&4294967295|_>>>16),_=T+(E^A^g)+w[14]+4259657740&4294967295,T=E+(_<<23&4294967295|_>>>9),_=g+(T^E^A)+w[1]+2763975236&4294967295,g=T+(_<<4&4294967295|_>>>28),_=A+(g^T^E)+w[4]+1272893353&4294967295,A=g+(_<<11&4294967295|_>>>21),_=E+(A^g^T)+w[7]+4139469664&4294967295,E=A+(_<<16&4294967295|_>>>16),_=T+(E^A^g)+w[10]+3200236656&4294967295,T=E+(_<<23&4294967295|_>>>9),_=g+(T^E^A)+w[13]+681279174&4294967295,g=T+(_<<4&4294967295|_>>>28),_=A+(g^T^E)+w[0]+3936430074&4294967295,A=g+(_<<11&4294967295|_>>>21),_=E+(A^g^T)+w[3]+3572445317&4294967295,E=A+(_<<16&4294967295|_>>>16),_=T+(E^A^g)+w[6]+76029189&4294967295,T=E+(_<<23&4294967295|_>>>9),_=g+(T^E^A)+w[9]+3654602809&4294967295,g=T+(_<<4&4294967295|_>>>28),_=A+(g^T^E)+w[12]+3873151461&4294967295,A=g+(_<<11&4294967295|_>>>21),_=E+(A^g^T)+w[15]+530742520&4294967295,E=A+(_<<16&4294967295|_>>>16),_=T+(E^A^g)+w[2]+3299628645&4294967295,T=E+(_<<23&4294967295|_>>>9),_=g+(E^(T|~A))+w[0]+4096336452&4294967295,g=T+(_<<6&4294967295|_>>>26),_=A+(T^(g|~E))+w[7]+1126891415&4294967295,A=g+(_<<10&4294967295|_>>>22),_=E+(g^(A|~T))+w[14]+2878612391&4294967295,E=A+(_<<15&4294967295|_>>>17),_=T+(A^(E|~g))+w[5]+4237533241&4294967295,T=E+(_<<21&4294967295|_>>>11),_=g+(E^(T|~A))+w[12]+1700485571&4294967295,g=T+(_<<6&4294967295|_>>>26),_=A+(T^(g|~E))+w[3]+2399980690&4294967295,A=g+(_<<10&4294967295|_>>>22),_=E+(g^(A|~T))+w[10]+4293915773&4294967295,E=A+(_<<15&4294967295|_>>>17),_=T+(A^(E|~g))+w[1]+2240044497&4294967295,T=E+(_<<21&4294967295|_>>>11),_=g+(E^(T|~A))+w[8]+1873313359&4294967295,g=T+(_<<6&4294967295|_>>>26),_=A+(T^(g|~E))+w[15]+4264355552&4294967295,A=g+(_<<10&4294967295|_>>>22),_=E+(g^(A|~T))+w[6]+2734768916&4294967295,E=A+(_<<15&4294967295|_>>>17),_=T+(A^(E|~g))+w[13]+1309151649&4294967295,T=E+(_<<21&4294967295|_>>>11),_=g+(E^(T|~A))+w[4]+4149444226&4294967295,g=T+(_<<6&4294967295|_>>>26),_=A+(T^(g|~E))+w[11]+3174756917&4294967295,A=g+(_<<10&4294967295|_>>>22),_=E+(g^(A|~T))+w[2]+718787259&4294967295,E=A+(_<<15&4294967295|_>>>17),_=T+(A^(E|~g))+w[9]+3951481745&4294967295,I.g[0]=I.g[0]+g&4294967295,I.g[1]=I.g[1]+(E+(_<<21&4294967295|_>>>11))&4294967295,I.g[2]=I.g[2]+E&4294967295,I.g[3]=I.g[3]+A&4294967295}r.prototype.v=function(I,g){g===void 0&&(g=I.length);const T=g-this.blockSize,w=this.C;let E=this.h,A=0;for(;A<g;){if(E==0)for(;A<=T;)i(this,I,A),A+=this.blockSize;if(typeof I=="string"){for(;A<g;)if(w[E++]=I.charCodeAt(A++),E==this.blockSize){i(this,w),E=0;break}}else for(;A<g;)if(w[E++]=I[A++],E==this.blockSize){i(this,w),E=0;break}}this.h=E,this.o+=g},r.prototype.A=function(){var I=Array((this.h<56?this.blockSize:this.blockSize*2)-this.h);I[0]=128;for(var g=1;g<I.length-8;++g)I[g]=0;g=this.o*8;for(var T=I.length-8;T<I.length;++T)I[T]=g&255,g/=256;for(this.v(I),I=Array(16),g=0,T=0;T<4;++T)for(let w=0;w<32;w+=8)I[g++]=this.g[T]>>>w&255;return I};function s(I,g){var T=c;return Object.prototype.hasOwnProperty.call(T,I)?T[I]:T[I]=g(I)}function a(I,g){this.h=g;const T=[];let w=!0;for(let E=I.length-1;E>=0;E--){const A=I[E]|0;w&&A==g||(T[E]=A,w=!1)}this.g=T}var c={};function u(I){return-128<=I&&I<128?s(I,function(g){return new a([g|0],g<0?-1:0)}):new a([I|0],I<0?-1:0)}function h(I){if(isNaN(I)||!isFinite(I))return m;if(I<0)return N(h(-I));const g=[];let T=1;for(let w=0;I>=T;w++)g[w]=I/T|0,T*=4294967296;return new a(g,0)}function f(I,g){if(I.length==0)throw Error("number format error: empty string");if(g=g||10,g<2||36<g)throw Error("radix out of range: "+g);if(I.charAt(0)=="-")return N(f(I.substring(1),g));if(I.indexOf("-")>=0)throw Error('number format error: interior "-" character');const T=h(Math.pow(g,8));let w=m;for(let A=0;A<I.length;A+=8){var E=Math.min(8,I.length-A);const _=parseInt(I.substring(A,A+E),g);E<8?(E=h(Math.pow(g,E)),w=w.j(E).add(h(_))):(w=w.j(T),w=w.add(h(_)))}return w}var m=u(0),y=u(1),b=u(16777216);n=a.prototype,n.m=function(){if(V(this))return-N(this).m();let I=0,g=1;for(let T=0;T<this.g.length;T++){const w=this.i(T);I+=(w>=0?w:4294967296+w)*g,g*=4294967296}return I},n.toString=function(I){if(I=I||10,I<2||36<I)throw Error("radix out of range: "+I);if(k(this))return"0";if(V(this))return"-"+N(this).toString(I);const g=h(Math.pow(I,6));var T=this;let w="";for(;;){const E=Y(T,g).g;T=F(T,E.j(g));let A=((T.g.length>0?T.g[0]:T.h)>>>0).toString(I);if(T=E,k(T))return A+w;for(;A.length<6;)A="0"+A;w=A+w}},n.i=function(I){return I<0?0:I<this.g.length?this.g[I]:this.h};function k(I){if(I.h!=0)return!1;for(let g=0;g<I.g.length;g++)if(I.g[g]!=0)return!1;return!0}function V(I){return I.h==-1}n.l=function(I){return I=F(this,I),V(I)?-1:k(I)?0:1};function N(I){const g=I.g.length,T=[];for(let w=0;w<g;w++)T[w]=~I.g[w];return new a(T,~I.h).add(y)}n.abs=function(){return V(this)?N(this):this},n.add=function(I){const g=Math.max(this.g.length,I.g.length),T=[];let w=0;for(let E=0;E<=g;E++){let A=w+(this.i(E)&65535)+(I.i(E)&65535),_=(A>>>16)+(this.i(E)>>>16)+(I.i(E)>>>16);w=_>>>16,A&=65535,_&=65535,T[E]=_<<16|A}return new a(T,T[T.length-1]&-2147483648?-1:0)};function F(I,g){return I.add(N(g))}n.j=function(I){if(k(this)||k(I))return m;if(V(this))return V(I)?N(this).j(N(I)):N(N(this).j(I));if(V(I))return N(this.j(N(I)));if(this.l(b)<0&&I.l(b)<0)return h(this.m()*I.m());const g=this.g.length+I.g.length,T=[];for(var w=0;w<2*g;w++)T[w]=0;for(w=0;w<this.g.length;w++)for(let E=0;E<I.g.length;E++){const A=this.i(w)>>>16,_=this.i(w)&65535,je=I.i(E)>>>16,mn=I.i(E)&65535;T[2*w+2*E]+=_*mn,$(T,2*w+2*E),T[2*w+2*E+1]+=A*mn,$(T,2*w+2*E+1),T[2*w+2*E+1]+=_*je,$(T,2*w+2*E+1),T[2*w+2*E+2]+=A*je,$(T,2*w+2*E+2)}for(I=0;I<g;I++)T[I]=T[2*I+1]<<16|T[2*I];for(I=g;I<2*g;I++)T[I]=0;return new a(T,0)};function $(I,g){for(;(I[g]&65535)!=I[g];)I[g+1]+=I[g]>>>16,I[g]&=65535,g++}function j(I,g){this.g=I,this.h=g}function Y(I,g){if(k(g))throw Error("division by zero");if(k(I))return new j(m,m);if(V(I))return g=Y(N(I),g),new j(N(g.g),N(g.h));if(V(g))return g=Y(I,N(g)),new j(N(g.g),g.h);if(I.g.length>30){if(V(I)||V(g))throw Error("slowDivide_ only works with positive integers.");for(var T=y,w=g;w.l(I)<=0;)T=se(T),w=se(w);var E=oe(T,1),A=oe(w,1);for(w=oe(w,2),T=oe(T,2);!k(w);){var _=A.add(w);_.l(I)<=0&&(E=E.add(T),A=_),w=oe(w,1),T=oe(T,1)}return g=F(I,E.j(g)),new j(E,g)}for(E=m;I.l(g)>=0;){for(T=Math.max(1,Math.floor(I.m()/g.m())),w=Math.ceil(Math.log(T)/Math.LN2),w=w<=48?1:Math.pow(2,w-48),A=h(T),_=A.j(g);V(_)||_.l(I)>0;)T-=w,A=h(T),_=A.j(g);k(A)&&(A=y),E=E.add(A),I=F(I,_)}return new j(E,I)}n.B=function(I){return Y(this,I).h},n.and=function(I){const g=Math.max(this.g.length,I.g.length),T=[];for(let w=0;w<g;w++)T[w]=this.i(w)&I.i(w);return new a(T,this.h&I.h)},n.or=function(I){const g=Math.max(this.g.length,I.g.length),T=[];for(let w=0;w<g;w++)T[w]=this.i(w)|I.i(w);return new a(T,this.h|I.h)},n.xor=function(I){const g=Math.max(this.g.length,I.g.length),T=[];for(let w=0;w<g;w++)T[w]=this.i(w)^I.i(w);return new a(T,this.h^I.h)};function se(I){const g=I.g.length+1,T=[];for(let w=0;w<g;w++)T[w]=I.i(w)<<1|I.i(w-1)>>>31;return new a(T,I.h)}function oe(I,g){const T=g>>5;g%=32;const w=I.g.length-T,E=[];for(let A=0;A<w;A++)E[A]=g>0?I.i(A+T)>>>g|I.i(A+T+1)<<32-g:I.i(A+T);return new a(E,I.h)}r.prototype.digest=r.prototype.A,r.prototype.reset=r.prototype.u,r.prototype.update=r.prototype.v,zp=r,a.prototype.add=a.prototype.add,a.prototype.multiply=a.prototype.j,a.prototype.modulo=a.prototype.B,a.prototype.compare=a.prototype.l,a.prototype.toNumber=a.prototype.m,a.prototype.toString=a.prototype.toString,a.prototype.getBits=a.prototype.i,a.fromNumber=h,a.fromString=f,tn=a}).apply(typeof jh<"u"?jh:typeof self<"u"?self:typeof window<"u"?window:{});var us=typeof globalThis<"u"?globalThis:typeof window<"u"?window:typeof global<"u"?global:typeof self<"u"?self:{};/** @license
Copyright The Closure Library Authors.
SPDX-License-Identifier: Apache-2.0
*/var Wp,Zr,Gp,As,Za,Kp,Yp,Qp;(function(){var n,e=Object.defineProperty;function t(o){o=[typeof globalThis=="object"&&globalThis,o,typeof window=="object"&&window,typeof self=="object"&&self,typeof us=="object"&&us];for(var l=0;l<o.length;++l){var d=o[l];if(d&&d.Math==Math)return d}throw Error("Cannot find global object")}var r=t(this);function i(o,l){if(l)e:{var d=r;o=o.split(".");for(var p=0;p<o.length-1;p++){var v=o[p];if(!(v in d))break e;d=d[v]}o=o[o.length-1],p=d[o],l=l(p),l!=p&&l!=null&&e(d,o,{configurable:!0,writable:!0,value:l})}}i("Symbol.dispose",function(o){return o||Symbol("Symbol.dispose")}),i("Array.prototype.values",function(o){return o||function(){return this[Symbol.iterator]()}}),i("Object.entries",function(o){return o||function(l){var d=[],p;for(p in l)Object.prototype.hasOwnProperty.call(l,p)&&d.push([p,l[p]]);return d}});/** @license

 Copyright The Closure Library Authors.
 SPDX-License-Identifier: Apache-2.0
*/var s=s||{},a=this||self;function c(o){var l=typeof o;return l=="object"&&o!=null||l=="function"}function u(o,l,d){return o.call.apply(o.bind,arguments)}function h(o,l,d){return h=u,h.apply(null,arguments)}function f(o,l){var d=Array.prototype.slice.call(arguments,1);return function(){var p=d.slice();return p.push.apply(p,arguments),o.apply(this,p)}}function m(o,l){function d(){}d.prototype=l.prototype,o.Z=l.prototype,o.prototype=new d,o.prototype.constructor=o,o.Ob=function(p,v,R){for(var D=Array(arguments.length-2),H=2;H<arguments.length;H++)D[H-2]=arguments[H];return l.prototype[v].apply(p,D)}}var y=typeof AsyncContext<"u"&&typeof AsyncContext.Snapshot=="function"?o=>o&&AsyncContext.Snapshot.wrap(o):o=>o;function b(o){const l=o.length;if(l>0){const d=Array(l);for(let p=0;p<l;p++)d[p]=o[p];return d}return[]}function k(o,l){for(let p=1;p<arguments.length;p++){const v=arguments[p];var d=typeof v;if(d=d!="object"?d:v?Array.isArray(v)?"array":d:"null",d=="array"||d=="object"&&typeof v.length=="number"){d=o.length||0;const R=v.length||0;o.length=d+R;for(let D=0;D<R;D++)o[d+D]=v[D]}else o.push(v)}}class V{constructor(l,d){this.i=l,this.j=d,this.h=0,this.g=null}get(){let l;return this.h>0?(this.h--,l=this.g,this.g=l.next,l.next=null):l=this.i(),l}}function N(o){a.setTimeout(()=>{throw o},0)}function F(){var o=I;let l=null;return o.g&&(l=o.g,o.g=o.g.next,o.g||(o.h=null),l.next=null),l}class ${constructor(){this.h=this.g=null}add(l,d){const p=j.get();p.set(l,d),this.h?this.h.next=p:this.g=p,this.h=p}}var j=new V(()=>new Y,o=>o.reset());class Y{constructor(){this.next=this.g=this.h=null}set(l,d){this.h=l,this.g=d,this.next=null}reset(){this.next=this.g=this.h=null}}let se,oe=!1,I=new $,g=()=>{const o=Promise.resolve(void 0);se=()=>{o.then(T)}};function T(){for(var o;o=F();){try{o.h.call(o.g)}catch(d){N(d)}var l=j;l.j(o),l.h<100&&(l.h++,o.next=l.g,l.g=o)}oe=!1}function w(){this.u=this.u,this.C=this.C}w.prototype.u=!1,w.prototype.dispose=function(){this.u||(this.u=!0,this.N())},w.prototype[Symbol.dispose]=function(){this.dispose()},w.prototype.N=function(){if(this.C)for(;this.C.length;)this.C.shift()()};function E(o,l){this.type=o,this.g=this.target=l,this.defaultPrevented=!1}E.prototype.h=function(){this.defaultPrevented=!0};var A=function(){if(!a.addEventListener||!Object.defineProperty)return!1;var o=!1,l=Object.defineProperty({},"passive",{get:function(){o=!0}});try{const d=()=>{};a.addEventListener("test",d,l),a.removeEventListener("test",d,l)}catch{}return o}();function _(o){return/^[\s\xa0]*$/.test(o)}function je(o,l){E.call(this,o?o.type:""),this.relatedTarget=this.g=this.target=null,this.button=this.screenY=this.screenX=this.clientY=this.clientX=0,this.key="",this.metaKey=this.shiftKey=this.altKey=this.ctrlKey=!1,this.state=null,this.pointerId=0,this.pointerType="",this.i=null,o&&this.init(o,l)}m(je,E),je.prototype.init=function(o,l){const d=this.type=o.type,p=o.changedTouches&&o.changedTouches.length?o.changedTouches[0]:null;this.target=o.target||o.srcElement,this.g=l,l=o.relatedTarget,l||(d=="mouseover"?l=o.fromElement:d=="mouseout"&&(l=o.toElement)),this.relatedTarget=l,p?(this.clientX=p.clientX!==void 0?p.clientX:p.pageX,this.clientY=p.clientY!==void 0?p.clientY:p.pageY,this.screenX=p.screenX||0,this.screenY=p.screenY||0):(this.clientX=o.clientX!==void 0?o.clientX:o.pageX,this.clientY=o.clientY!==void 0?o.clientY:o.pageY,this.screenX=o.screenX||0,this.screenY=o.screenY||0),this.button=o.button,this.key=o.key||"",this.ctrlKey=o.ctrlKey,this.altKey=o.altKey,this.shiftKey=o.shiftKey,this.metaKey=o.metaKey,this.pointerId=o.pointerId||0,this.pointerType=o.pointerType,this.state=o.state,this.i=o,o.defaultPrevented&&je.Z.h.call(this)},je.prototype.h=function(){je.Z.h.call(this);const o=this.i;o.preventDefault?o.preventDefault():o.returnValue=!1};var mn="closure_listenable_"+(Math.random()*1e6|0),ay=0;function cy(o,l,d,p,v){this.listener=o,this.proxy=null,this.src=l,this.type=d,this.capture=!!p,this.ha=v,this.key=++ay,this.da=this.fa=!1}function Wi(o){o.da=!0,o.listener=null,o.proxy=null,o.src=null,o.ha=null}function Gi(o,l,d){for(const p in o)l.call(d,o[p],p,o)}function uy(o,l){for(const d in o)l.call(void 0,o[d],d,o)}function ul(o){const l={};for(const d in o)l[d]=o[d];return l}const ll="constructor hasOwnProperty isPrototypeOf propertyIsEnumerable toLocaleString toString valueOf".split(" ");function hl(o,l){let d,p;for(let v=1;v<arguments.length;v++){p=arguments[v];for(d in p)o[d]=p[d];for(let R=0;R<ll.length;R++)d=ll[R],Object.prototype.hasOwnProperty.call(p,d)&&(o[d]=p[d])}}function Ki(o){this.src=o,this.g={},this.h=0}Ki.prototype.add=function(o,l,d,p,v){const R=o.toString();o=this.g[R],o||(o=this.g[R]=[],this.h++);const D=Fo(o,l,p,v);return D>-1?(l=o[D],d||(l.fa=!1)):(l=new cy(l,this.src,R,!!p,v),l.fa=d,o.push(l)),l};function xo(o,l){const d=l.type;if(d in o.g){var p=o.g[d],v=Array.prototype.indexOf.call(p,l,void 0),R;(R=v>=0)&&Array.prototype.splice.call(p,v,1),R&&(Wi(l),o.g[d].length==0&&(delete o.g[d],o.h--))}}function Fo(o,l,d,p){for(let v=0;v<o.length;++v){const R=o[v];if(!R.da&&R.listener==l&&R.capture==!!d&&R.ha==p)return v}return-1}var Bo="closure_lm_"+(Math.random()*1e6|0),$o={};function dl(o,l,d,p,v){if(Array.isArray(l)){for(let R=0;R<l.length;R++)dl(o,l[R],d,p,v);return null}return d=ml(d),o&&o[mn]?o.J(l,d,c(p)?!!p.capture:!1,v):ly(o,l,d,!1,p,v)}function ly(o,l,d,p,v,R){if(!l)throw Error("Invalid event type");const D=c(v)?!!v.capture:!!v;let H=jo(o);if(H||(o[Bo]=H=new Ki(o)),d=H.add(l,d,p,D,R),d.proxy)return d;if(p=hy(),d.proxy=p,p.src=o,p.listener=d,o.addEventListener)A||(v=D),v===void 0&&(v=!1),o.addEventListener(l.toString(),p,v);else if(o.attachEvent)o.attachEvent(pl(l.toString()),p);else if(o.addListener&&o.removeListener)o.addListener(p);else throw Error("addEventListener and attachEvent are unavailable.");return d}function hy(){function o(d){return l.call(o.src,o.listener,d)}const l=dy;return o}function fl(o,l,d,p,v){if(Array.isArray(l))for(var R=0;R<l.length;R++)fl(o,l[R],d,p,v);else p=c(p)?!!p.capture:!!p,d=ml(d),o&&o[mn]?(o=o.i,R=String(l).toString(),R in o.g&&(l=o.g[R],d=Fo(l,d,p,v),d>-1&&(Wi(l[d]),Array.prototype.splice.call(l,d,1),l.length==0&&(delete o.g[R],o.h--)))):o&&(o=jo(o))&&(l=o.g[l.toString()],o=-1,l&&(o=Fo(l,d,p,v)),(d=o>-1?l[o]:null)&&qo(d))}function qo(o){if(typeof o!="number"&&o&&!o.da){var l=o.src;if(l&&l[mn])xo(l.i,o);else{var d=o.type,p=o.proxy;l.removeEventListener?l.removeEventListener(d,p,o.capture):l.detachEvent?l.detachEvent(pl(d),p):l.addListener&&l.removeListener&&l.removeListener(p),(d=jo(l))?(xo(d,o),d.h==0&&(d.src=null,l[Bo]=null)):Wi(o)}}}function pl(o){return o in $o?$o[o]:$o[o]="on"+o}function dy(o,l){if(o.da)o=!0;else{l=new je(l,this);const d=o.listener,p=o.ha||o.src;o.fa&&qo(o),o=d.call(p,l)}return o}function jo(o){return o=o[Bo],o instanceof Ki?o:null}var Ho="__closure_events_fn_"+(Math.random()*1e9>>>0);function ml(o){return typeof o=="function"?o:(o[Ho]||(o[Ho]=function(l){return o.handleEvent(l)}),o[Ho])}function Ne(){w.call(this),this.i=new Ki(this),this.M=this,this.G=null}m(Ne,w),Ne.prototype[mn]=!0,Ne.prototype.removeEventListener=function(o,l,d,p){fl(this,o,l,d,p)};function Ue(o,l){var d,p=o.G;if(p)for(d=[];p;p=p.G)d.push(p);if(o=o.M,p=l.type||l,typeof l=="string")l=new E(l,o);else if(l instanceof E)l.target=l.target||o;else{var v=l;l=new E(p,o),hl(l,v)}v=!0;let R,D;if(d)for(D=d.length-1;D>=0;D--)R=l.g=d[D],v=Yi(R,p,!0,l)&&v;if(R=l.g=o,v=Yi(R,p,!0,l)&&v,v=Yi(R,p,!1,l)&&v,d)for(D=0;D<d.length;D++)R=l.g=d[D],v=Yi(R,p,!1,l)&&v}Ne.prototype.N=function(){if(Ne.Z.N.call(this),this.i){var o=this.i;for(const l in o.g){const d=o.g[l];for(let p=0;p<d.length;p++)Wi(d[p]);delete o.g[l],o.h--}}this.G=null},Ne.prototype.J=function(o,l,d,p){return this.i.add(String(o),l,!1,d,p)},Ne.prototype.K=function(o,l,d,p){return this.i.add(String(o),l,!0,d,p)};function Yi(o,l,d,p){if(l=o.i.g[String(l)],!l)return!0;l=l.concat();let v=!0;for(let R=0;R<l.length;++R){const D=l[R];if(D&&!D.da&&D.capture==d){const H=D.listener,ye=D.ha||D.src;D.fa&&xo(o.i,D),v=H.call(ye,p)!==!1&&v}}return v&&!p.defaultPrevented}function fy(o,l){if(typeof o!="function")if(o&&typeof o.handleEvent=="function")o=h(o.handleEvent,o);else throw Error("Invalid listener argument");return Number(l)>2147483647?-1:a.setTimeout(o,l||0)}function gl(o){o.g=fy(()=>{o.g=null,o.i&&(o.i=!1,gl(o))},o.l);const l=o.h;o.h=null,o.m.apply(null,l)}class py extends w{constructor(l,d){super(),this.m=l,this.l=d,this.h=null,this.i=!1,this.g=null}j(l){this.h=arguments,this.g?this.i=!0:gl(this)}N(){super.N(),this.g&&(a.clearTimeout(this.g),this.g=null,this.i=!1,this.h=null)}}function Nr(o){w.call(this),this.h=o,this.g={}}m(Nr,w);var _l=[];function yl(o){Gi(o.g,function(l,d){this.g.hasOwnProperty(d)&&qo(l)},o),o.g={}}Nr.prototype.N=function(){Nr.Z.N.call(this),yl(this)},Nr.prototype.handleEvent=function(){throw Error("EventHandler.handleEvent not implemented")};var zo=a.JSON.stringify,my=a.JSON.parse,gy=class{stringify(o){return a.JSON.stringify(o,void 0)}parse(o){return a.JSON.parse(o,void 0)}};function Tl(){}function El(){}var Dr={OPEN:"a",hb:"b",ERROR:"c",tb:"d"};function Wo(){E.call(this,"d")}m(Wo,E);function Go(){E.call(this,"c")}m(Go,E);var gn={},Il=null;function Qi(){return Il=Il||new Ne}gn.Ia="serverreachability";function wl(o){E.call(this,gn.Ia,o)}m(wl,E);function Or(o){const l=Qi();Ue(l,new wl(l))}gn.STAT_EVENT="statevent";function vl(o,l){E.call(this,gn.STAT_EVENT,o),this.stat=l}m(vl,E);function xe(o){const l=Qi();Ue(l,new vl(l,o))}gn.Ja="timingevent";function Al(o,l){E.call(this,gn.Ja,o),this.size=l}m(Al,E);function Vr(o,l){if(typeof o!="function")throw Error("Fn must not be null and must be a function");return a.setTimeout(function(){o()},l)}function Mr(){this.g=!0}Mr.prototype.ua=function(){this.g=!1};function _y(o,l,d,p,v,R){o.info(function(){if(o.g)if(R){var D="",H=R.split("&");for(let J=0;J<H.length;J++){var ye=H[J].split("=");if(ye.length>1){const we=ye[0];ye=ye[1];const ht=we.split("_");D=ht.length>=2&&ht[1]=="type"?D+(we+"="+ye+"&"):D+(we+"=redacted&")}}}else D=null;else D=R;return"XMLHTTP REQ ("+p+") [attempt "+v+"]: "+l+`
`+d+`
`+D})}function yy(o,l,d,p,v,R,D){o.info(function(){return"XMLHTTP RESP ("+p+") [ attempt "+v+"]: "+l+`
`+d+`
`+R+" "+D})}function $n(o,l,d,p){o.info(function(){return"XMLHTTP TEXT ("+l+"): "+Ey(o,d)+(p?" "+p:"")})}function Ty(o,l){o.info(function(){return"TIMEOUT: "+l})}Mr.prototype.info=function(){};function Ey(o,l){if(!o.g)return l;if(!l)return null;try{const R=JSON.parse(l);if(R){for(o=0;o<R.length;o++)if(Array.isArray(R[o])){var d=R[o];if(!(d.length<2)){var p=d[1];if(Array.isArray(p)&&!(p.length<1)){var v=p[0];if(v!="noop"&&v!="stop"&&v!="close")for(let D=1;D<p.length;D++)p[D]=""}}}}return zo(R)}catch{return l}}var Ji={NO_ERROR:0,cb:1,qb:2,pb:3,kb:4,ob:5,rb:6,Ga:7,TIMEOUT:8,ub:9},Rl={ib:"complete",Fb:"success",ERROR:"error",Ga:"abort",xb:"ready",yb:"readystatechange",TIMEOUT:"timeout",sb:"incrementaldata",wb:"progress",lb:"downloadprogress",Nb:"uploadprogress"},bl;function Ko(){}m(Ko,Tl),Ko.prototype.g=function(){return new XMLHttpRequest},bl=new Ko;function Lr(o){return encodeURIComponent(String(o))}function Iy(o){var l=1;o=o.split(":");const d=[];for(;l>0&&o.length;)d.push(o.shift()),l--;return o.length&&d.push(o.join(":")),d}function $t(o,l,d,p){this.j=o,this.i=l,this.l=d,this.S=p||1,this.V=new Nr(this),this.H=45e3,this.J=null,this.o=!1,this.u=this.B=this.A=this.M=this.F=this.T=this.D=null,this.G=[],this.g=null,this.C=0,this.m=this.v=null,this.X=-1,this.K=!1,this.P=0,this.O=null,this.W=this.L=this.U=this.R=!1,this.h=new Sl}function Sl(){this.i=null,this.g="",this.h=!1}var Pl={},Yo={};function Qo(o,l,d){o.M=1,o.A=Zi(lt(l)),o.u=d,o.R=!0,Cl(o,null)}function Cl(o,l){o.F=Date.now(),Xi(o),o.B=lt(o.A);var d=o.B,p=o.S;Array.isArray(p)||(p=[String(p)]),ql(d.i,"t",p),o.C=0,d=o.j.L,o.h=new Sl,o.g=oh(o.j,d?l:null,!o.u),o.P>0&&(o.O=new py(h(o.Y,o,o.g),o.P)),l=o.V,d=o.g,p=o.ba;var v="readystatechange";Array.isArray(v)||(v&&(_l[0]=v.toString()),v=_l);for(let R=0;R<v.length;R++){const D=dl(d,v[R],p||l.handleEvent,!1,l.h||l);if(!D)break;l.g[D.key]=D}l=o.J?ul(o.J):{},o.u?(o.v||(o.v="POST"),l["Content-Type"]="application/x-www-form-urlencoded",o.g.ea(o.B,o.v,o.u,l)):(o.v="GET",o.g.ea(o.B,o.v,null,l)),Or(),_y(o.i,o.v,o.B,o.l,o.S,o.u)}$t.prototype.ba=function(o){o=o.target;const l=this.O;l&&Ht(o)==3?l.j():this.Y(o)},$t.prototype.Y=function(o){try{if(o==this.g)e:{const H=Ht(this.g),ye=this.g.ya(),J=this.g.ca();if(!(H<3)&&(H!=3||this.g&&(this.h.h||this.g.la()||Yl(this.g)))){this.K||H!=4||ye==7||(ye==8||J<=0?Or(3):Or(2)),Jo(this);var l=this.g.ca();this.X=l;var d=wy(this);if(this.o=l==200,yy(this.i,this.v,this.B,this.l,this.S,H,l),this.o){if(this.U&&!this.L){t:{if(this.g){var p,v=this.g;if((p=v.g?v.g.getResponseHeader("X-HTTP-Initial-Response"):null)&&!_(p)){var R=p;break t}}R=null}if(o=R)$n(this.i,this.l,o,"Initial handshake response via X-HTTP-Initial-Response"),this.L=!0,Xo(this,o);else{this.o=!1,this.m=3,xe(12),_n(this),Ur(this);break e}}if(this.R){o=!0;let we;for(;!this.K&&this.C<d.length;)if(we=vy(this,d),we==Yo){H==4&&(this.m=4,xe(14),o=!1),$n(this.i,this.l,null,"[Incomplete Response]");break}else if(we==Pl){this.m=4,xe(15),$n(this.i,this.l,d,"[Invalid Chunk]"),o=!1;break}else $n(this.i,this.l,we,null),Xo(this,we);if(kl(this)&&this.C!=0&&(this.h.g=this.h.g.slice(this.C),this.C=0),H!=4||d.length!=0||this.h.h||(this.m=1,xe(16),o=!1),this.o=this.o&&o,!o)$n(this.i,this.l,d,"[Invalid Chunked Response]"),_n(this),Ur(this);else if(d.length>0&&!this.W){this.W=!0;var D=this.j;D.g==this&&D.aa&&!D.P&&(D.j.info("Great, no buffering proxy detected. Bytes received: "+d.length),oa(D),D.P=!0,xe(11))}}else $n(this.i,this.l,d,null),Xo(this,d);H==4&&_n(this),this.o&&!this.K&&(H==4?nh(this.j,this):(this.o=!1,Xi(this)))}else Uy(this.g),l==400&&d.indexOf("Unknown SID")>0?(this.m=3,xe(12)):(this.m=0,xe(13)),_n(this),Ur(this)}}}catch{}finally{}};function wy(o){if(!kl(o))return o.g.la();const l=Yl(o.g);if(l==="")return"";let d="";const p=l.length,v=Ht(o.g)==4;if(!o.h.i){if(typeof TextDecoder>"u")return _n(o),Ur(o),"";o.h.i=new a.TextDecoder}for(let R=0;R<p;R++)o.h.h=!0,d+=o.h.i.decode(l[R],{stream:!(v&&R==p-1)});return l.length=0,o.h.g+=d,o.C=0,o.h.g}function kl(o){return o.g?o.v=="GET"&&o.M!=2&&o.j.Aa:!1}function vy(o,l){var d=o.C,p=l.indexOf(`
`,d);return p==-1?Yo:(d=Number(l.substring(d,p)),isNaN(d)?Pl:(p+=1,p+d>l.length?Yo:(l=l.slice(p,p+d),o.C=p+d,l)))}$t.prototype.cancel=function(){this.K=!0,_n(this)};function Xi(o){o.T=Date.now()+o.H,Nl(o,o.H)}function Nl(o,l){if(o.D!=null)throw Error("WatchDog timer not null");o.D=Vr(h(o.aa,o),l)}function Jo(o){o.D&&(a.clearTimeout(o.D),o.D=null)}$t.prototype.aa=function(){this.D=null;const o=Date.now();o-this.T>=0?(Ty(this.i,this.B),this.M!=2&&(Or(),xe(17)),_n(this),this.m=2,Ur(this)):Nl(this,this.T-o)};function Ur(o){o.j.I==0||o.K||nh(o.j,o)}function _n(o){Jo(o);var l=o.O;l&&typeof l.dispose=="function"&&l.dispose(),o.O=null,yl(o.V),o.g&&(l=o.g,o.g=null,l.abort(),l.dispose())}function Xo(o,l){try{var d=o.j;if(d.I!=0&&(d.g==o||Zo(d.h,o))){if(!o.L&&Zo(d.h,o)&&d.I==3){try{var p=d.Ba.g.parse(l)}catch{p=null}if(Array.isArray(p)&&p.length==3){var v=p;if(v[0]==0){e:if(!d.v){if(d.g)if(d.g.F+3e3<o.F)is(d),ns(d);else break e;sa(d),xe(18)}}else d.xa=v[1],0<d.xa-d.K&&v[2]<37500&&d.F&&d.A==0&&!d.C&&(d.C=Vr(h(d.Va,d),6e3));Vl(d.h)<=1&&d.ta&&(d.ta=void 0)}else Tn(d,11)}else if((o.L||d.g==o)&&is(d),!_(l))for(v=d.Ba.g.parse(l),l=0;l<v.length;l++){let J=v[l];const we=J[0];if(!(we<=d.K))if(d.K=we,J=J[1],d.I==2)if(J[0]=="c"){d.M=J[1],d.ba=J[2];const ht=J[3];ht!=null&&(d.ka=ht,d.j.info("VER="+d.ka));const En=J[4];En!=null&&(d.za=En,d.j.info("SVER="+d.za));const zt=J[5];zt!=null&&typeof zt=="number"&&zt>0&&(p=1.5*zt,d.O=p,d.j.info("backChannelRequestTimeoutMs_="+p)),p=d;const Wt=o.g;if(Wt){const os=Wt.g?Wt.g.getResponseHeader("X-Client-Wire-Protocol"):null;if(os){var R=p.h;R.g||os.indexOf("spdy")==-1&&os.indexOf("quic")==-1&&os.indexOf("h2")==-1||(R.j=R.l,R.g=new Set,R.h&&(ea(R,R.h),R.h=null))}if(p.G){const aa=Wt.g?Wt.g.getResponseHeader("X-HTTP-Session-Id"):null;aa&&(p.wa=aa,Z(p.J,p.G,aa))}}d.I=3,d.l&&d.l.ra(),d.aa&&(d.T=Date.now()-o.F,d.j.info("Handshake RTT: "+d.T+"ms")),p=d;var D=o;if(p.na=sh(p,p.L?p.ba:null,p.W),D.L){Ml(p.h,D);var H=D,ye=p.O;ye&&(H.H=ye),H.D&&(Jo(H),Xi(H)),p.g=D}else eh(p);d.i.length>0&&rs(d)}else J[0]!="stop"&&J[0]!="close"||Tn(d,7);else d.I==3&&(J[0]=="stop"||J[0]=="close"?J[0]=="stop"?Tn(d,7):ia(d):J[0]!="noop"&&d.l&&d.l.qa(J),d.A=0)}}Or(4)}catch{}}var Ay=class{constructor(o,l){this.g=o,this.map=l}};function Dl(o){this.l=o||10,a.PerformanceNavigationTiming?(o=a.performance.getEntriesByType("navigation"),o=o.length>0&&(o[0].nextHopProtocol=="hq"||o[0].nextHopProtocol=="h2")):o=!!(a.chrome&&a.chrome.loadTimes&&a.chrome.loadTimes()&&a.chrome.loadTimes().wasFetchedViaSpdy),this.j=o?this.l:1,this.g=null,this.j>1&&(this.g=new Set),this.h=null,this.i=[]}function Ol(o){return o.h?!0:o.g?o.g.size>=o.j:!1}function Vl(o){return o.h?1:o.g?o.g.size:0}function Zo(o,l){return o.h?o.h==l:o.g?o.g.has(l):!1}function ea(o,l){o.g?o.g.add(l):o.h=l}function Ml(o,l){o.h&&o.h==l?o.h=null:o.g&&o.g.has(l)&&o.g.delete(l)}Dl.prototype.cancel=function(){if(this.i=Ll(this),this.h)this.h.cancel(),this.h=null;else if(this.g&&this.g.size!==0){for(const o of this.g.values())o.cancel();this.g.clear()}};function Ll(o){if(o.h!=null)return o.i.concat(o.h.G);if(o.g!=null&&o.g.size!==0){let l=o.i;for(const d of o.g.values())l=l.concat(d.G);return l}return b(o.i)}var Ul=RegExp("^(?:([^:/?#.]+):)?(?://(?:([^\\\\/?#]*)@)?([^\\\\/?#]*?)(?::([0-9]+))?(?=[\\\\/?#]|$))?([^?#]+)?(?:\\?([^#]*))?(?:#([\\s\\S]*))?$");function Ry(o,l){if(o){o=o.split("&");for(let d=0;d<o.length;d++){const p=o[d].indexOf("=");let v,R=null;p>=0?(v=o[d].substring(0,p),R=o[d].substring(p+1)):v=o[d],l(v,R?decodeURIComponent(R.replace(/\+/g," ")):"")}}}function qt(o){this.g=this.o=this.j="",this.u=null,this.m=this.h="",this.l=!1;let l;o instanceof qt?(this.l=o.l,xr(this,o.j),this.o=o.o,this.g=o.g,Fr(this,o.u),this.h=o.h,ta(this,jl(o.i)),this.m=o.m):o&&(l=String(o).match(Ul))?(this.l=!1,xr(this,l[1]||"",!0),this.o=Br(l[2]||""),this.g=Br(l[3]||"",!0),Fr(this,l[4]),this.h=Br(l[5]||"",!0),ta(this,l[6]||"",!0),this.m=Br(l[7]||"")):(this.l=!1,this.i=new qr(null,this.l))}qt.prototype.toString=function(){const o=[];var l=this.j;l&&o.push($r(l,xl,!0),":");var d=this.g;return(d||l=="file")&&(o.push("//"),(l=this.o)&&o.push($r(l,xl,!0),"@"),o.push(Lr(d).replace(/%25([0-9a-fA-F]{2})/g,"%$1")),d=this.u,d!=null&&o.push(":",String(d))),(d=this.h)&&(this.g&&d.charAt(0)!="/"&&o.push("/"),o.push($r(d,d.charAt(0)=="/"?Py:Sy,!0))),(d=this.i.toString())&&o.push("?",d),(d=this.m)&&o.push("#",$r(d,ky)),o.join("")},qt.prototype.resolve=function(o){const l=lt(this);let d=!!o.j;d?xr(l,o.j):d=!!o.o,d?l.o=o.o:d=!!o.g,d?l.g=o.g:d=o.u!=null;var p=o.h;if(d)Fr(l,o.u);else if(d=!!o.h){if(p.charAt(0)!="/")if(this.g&&!this.h)p="/"+p;else{var v=l.h.lastIndexOf("/");v!=-1&&(p=l.h.slice(0,v+1)+p)}if(v=p,v==".."||v==".")p="";else if(v.indexOf("./")!=-1||v.indexOf("/.")!=-1){p=v.lastIndexOf("/",0)==0,v=v.split("/");const R=[];for(let D=0;D<v.length;){const H=v[D++];H=="."?p&&D==v.length&&R.push(""):H==".."?((R.length>1||R.length==1&&R[0]!="")&&R.pop(),p&&D==v.length&&R.push("")):(R.push(H),p=!0)}p=R.join("/")}else p=v}return d?l.h=p:d=o.i.toString()!=="",d?ta(l,jl(o.i)):d=!!o.m,d&&(l.m=o.m),l};function lt(o){return new qt(o)}function xr(o,l,d){o.j=d?Br(l,!0):l,o.j&&(o.j=o.j.replace(/:$/,""))}function Fr(o,l){if(l){if(l=Number(l),isNaN(l)||l<0)throw Error("Bad port number "+l);o.u=l}else o.u=null}function ta(o,l,d){l instanceof qr?(o.i=l,Ny(o.i,o.l)):(d||(l=$r(l,Cy)),o.i=new qr(l,o.l))}function Z(o,l,d){o.i.set(l,d)}function Zi(o){return Z(o,"zx",Math.floor(Math.random()*2147483648).toString(36)+Math.abs(Math.floor(Math.random()*2147483648)^Date.now()).toString(36)),o}function Br(o,l){return o?l?decodeURI(o.replace(/%25/g,"%2525")):decodeURIComponent(o):""}function $r(o,l,d){return typeof o=="string"?(o=encodeURI(o).replace(l,by),d&&(o=o.replace(/%25([0-9a-fA-F]{2})/g,"%$1")),o):null}function by(o){return o=o.charCodeAt(0),"%"+(o>>4&15).toString(16)+(o&15).toString(16)}var xl=/[#\/\?@]/g,Sy=/[#\?:]/g,Py=/[#\?]/g,Cy=/[#\?@]/g,ky=/#/g;function qr(o,l){this.h=this.g=null,this.i=o||null,this.j=!!l}function yn(o){o.g||(o.g=new Map,o.h=0,o.i&&Ry(o.i,function(l,d){o.add(decodeURIComponent(l.replace(/\+/g," ")),d)}))}n=qr.prototype,n.add=function(o,l){yn(this),this.i=null,o=qn(this,o);let d=this.g.get(o);return d||this.g.set(o,d=[]),d.push(l),this.h+=1,this};function Fl(o,l){yn(o),l=qn(o,l),o.g.has(l)&&(o.i=null,o.h-=o.g.get(l).length,o.g.delete(l))}function Bl(o,l){return yn(o),l=qn(o,l),o.g.has(l)}n.forEach=function(o,l){yn(this),this.g.forEach(function(d,p){d.forEach(function(v){o.call(l,v,p,this)},this)},this)};function $l(o,l){yn(o);let d=[];if(typeof l=="string")Bl(o,l)&&(d=d.concat(o.g.get(qn(o,l))));else for(o=Array.from(o.g.values()),l=0;l<o.length;l++)d=d.concat(o[l]);return d}n.set=function(o,l){return yn(this),this.i=null,o=qn(this,o),Bl(this,o)&&(this.h-=this.g.get(o).length),this.g.set(o,[l]),this.h+=1,this},n.get=function(o,l){return o?(o=$l(this,o),o.length>0?String(o[0]):l):l};function ql(o,l,d){Fl(o,l),d.length>0&&(o.i=null,o.g.set(qn(o,l),b(d)),o.h+=d.length)}n.toString=function(){if(this.i)return this.i;if(!this.g)return"";const o=[],l=Array.from(this.g.keys());for(let p=0;p<l.length;p++){var d=l[p];const v=Lr(d);d=$l(this,d);for(let R=0;R<d.length;R++){let D=v;d[R]!==""&&(D+="="+Lr(d[R])),o.push(D)}}return this.i=o.join("&")};function jl(o){const l=new qr;return l.i=o.i,o.g&&(l.g=new Map(o.g),l.h=o.h),l}function qn(o,l){return l=String(l),o.j&&(l=l.toLowerCase()),l}function Ny(o,l){l&&!o.j&&(yn(o),o.i=null,o.g.forEach(function(d,p){const v=p.toLowerCase();p!=v&&(Fl(this,p),ql(this,v,d))},o)),o.j=l}function Dy(o,l){const d=new Mr;if(a.Image){const p=new Image;p.onload=f(jt,d,"TestLoadImage: loaded",!0,l,p),p.onerror=f(jt,d,"TestLoadImage: error",!1,l,p),p.onabort=f(jt,d,"TestLoadImage: abort",!1,l,p),p.ontimeout=f(jt,d,"TestLoadImage: timeout",!1,l,p),a.setTimeout(function(){p.ontimeout&&p.ontimeout()},1e4),p.src=o}else l(!1)}function Oy(o,l){const d=new Mr,p=new AbortController,v=setTimeout(()=>{p.abort(),jt(d,"TestPingServer: timeout",!1,l)},1e4);fetch(o,{signal:p.signal}).then(R=>{clearTimeout(v),R.ok?jt(d,"TestPingServer: ok",!0,l):jt(d,"TestPingServer: server error",!1,l)}).catch(()=>{clearTimeout(v),jt(d,"TestPingServer: error",!1,l)})}function jt(o,l,d,p,v){try{v&&(v.onload=null,v.onerror=null,v.onabort=null,v.ontimeout=null),p(d)}catch{}}function Vy(){this.g=new gy}function na(o){this.i=o.Sb||null,this.h=o.ab||!1}m(na,Tl),na.prototype.g=function(){return new es(this.i,this.h)};function es(o,l){Ne.call(this),this.H=o,this.o=l,this.m=void 0,this.status=this.readyState=0,this.responseType=this.responseText=this.response=this.statusText="",this.onreadystatechange=null,this.A=new Headers,this.h=null,this.F="GET",this.D="",this.g=!1,this.B=this.j=this.l=null,this.v=new AbortController}m(es,Ne),n=es.prototype,n.open=function(o,l){if(this.readyState!=0)throw this.abort(),Error("Error reopening a connection");this.F=o,this.D=l,this.readyState=1,Hr(this)},n.send=function(o){if(this.readyState!=1)throw this.abort(),Error("need to call open() first. ");if(this.v.signal.aborted)throw this.abort(),Error("Request was aborted.");this.g=!0;const l={headers:this.A,method:this.F,credentials:this.m,cache:void 0,signal:this.v.signal};o&&(l.body=o),(this.H||a).fetch(new Request(this.D,l)).then(this.Pa.bind(this),this.ga.bind(this))},n.abort=function(){this.response=this.responseText="",this.A=new Headers,this.status=0,this.v.abort(),this.j&&this.j.cancel("Request was aborted.").catch(()=>{}),this.readyState>=1&&this.g&&this.readyState!=4&&(this.g=!1,jr(this)),this.readyState=0},n.Pa=function(o){if(this.g&&(this.l=o,this.h||(this.status=this.l.status,this.statusText=this.l.statusText,this.h=o.headers,this.readyState=2,Hr(this)),this.g&&(this.readyState=3,Hr(this),this.g)))if(this.responseType==="arraybuffer")o.arrayBuffer().then(this.Na.bind(this),this.ga.bind(this));else if(typeof a.ReadableStream<"u"&&"body"in o){if(this.j=o.body.getReader(),this.o){if(this.responseType)throw Error('responseType must be empty for "streamBinaryChunks" mode responses.');this.response=[]}else this.response=this.responseText="",this.B=new TextDecoder;Hl(this)}else o.text().then(this.Oa.bind(this),this.ga.bind(this))};function Hl(o){o.j.read().then(o.Ma.bind(o)).catch(o.ga.bind(o))}n.Ma=function(o){if(this.g){if(this.o&&o.value)this.response.push(o.value);else if(!this.o){var l=o.value?o.value:new Uint8Array(0);(l=this.B.decode(l,{stream:!o.done}))&&(this.response=this.responseText+=l)}o.done?jr(this):Hr(this),this.readyState==3&&Hl(this)}},n.Oa=function(o){this.g&&(this.response=this.responseText=o,jr(this))},n.Na=function(o){this.g&&(this.response=o,jr(this))},n.ga=function(){this.g&&jr(this)};function jr(o){o.readyState=4,o.l=null,o.j=null,o.B=null,Hr(o)}n.setRequestHeader=function(o,l){this.A.append(o,l)},n.getResponseHeader=function(o){return this.h&&this.h.get(o.toLowerCase())||""},n.getAllResponseHeaders=function(){if(!this.h)return"";const o=[],l=this.h.entries();for(var d=l.next();!d.done;)d=d.value,o.push(d[0]+": "+d[1]),d=l.next();return o.join(`\r
`)};function Hr(o){o.onreadystatechange&&o.onreadystatechange.call(o)}Object.defineProperty(es.prototype,"withCredentials",{get:function(){return this.m==="include"},set:function(o){this.m=o?"include":"same-origin"}});function zl(o){let l="";return Gi(o,function(d,p){l+=p,l+=":",l+=d,l+=`\r
`}),l}function ra(o,l,d){e:{for(p in d){var p=!1;break e}p=!0}p||(d=zl(d),typeof o=="string"?d!=null&&Lr(d):Z(o,l,d))}function ue(o){Ne.call(this),this.headers=new Map,this.L=o||null,this.h=!1,this.g=null,this.D="",this.o=0,this.l="",this.j=this.B=this.v=this.A=!1,this.m=null,this.F="",this.H=!1}m(ue,Ne);var My=/^https?$/i,Ly=["POST","PUT"];n=ue.prototype,n.Fa=function(o){this.H=o},n.ea=function(o,l,d,p){if(this.g)throw Error("[goog.net.XhrIo] Object is active with another request="+this.D+"; newUri="+o);l=l?l.toUpperCase():"GET",this.D=o,this.l="",this.o=0,this.A=!1,this.h=!0,this.g=this.L?this.L.g():bl.g(),this.g.onreadystatechange=y(h(this.Ca,this));try{this.B=!0,this.g.open(l,String(o),!0),this.B=!1}catch(R){Wl(this,R);return}if(o=d||"",d=new Map(this.headers),p)if(Object.getPrototypeOf(p)===Object.prototype)for(var v in p)d.set(v,p[v]);else if(typeof p.keys=="function"&&typeof p.get=="function")for(const R of p.keys())d.set(R,p.get(R));else throw Error("Unknown input type for opt_headers: "+String(p));p=Array.from(d.keys()).find(R=>R.toLowerCase()=="content-type"),v=a.FormData&&o instanceof a.FormData,!(Array.prototype.indexOf.call(Ly,l,void 0)>=0)||p||v||d.set("Content-Type","application/x-www-form-urlencoded;charset=utf-8");for(const[R,D]of d)this.g.setRequestHeader(R,D);this.F&&(this.g.responseType=this.F),"withCredentials"in this.g&&this.g.withCredentials!==this.H&&(this.g.withCredentials=this.H);try{this.m&&(clearTimeout(this.m),this.m=null),this.v=!0,this.g.send(o),this.v=!1}catch(R){Wl(this,R)}};function Wl(o,l){o.h=!1,o.g&&(o.j=!0,o.g.abort(),o.j=!1),o.l=l,o.o=5,Gl(o),ts(o)}function Gl(o){o.A||(o.A=!0,Ue(o,"complete"),Ue(o,"error"))}n.abort=function(o){this.g&&this.h&&(this.h=!1,this.j=!0,this.g.abort(),this.j=!1,this.o=o||7,Ue(this,"complete"),Ue(this,"abort"),ts(this))},n.N=function(){this.g&&(this.h&&(this.h=!1,this.j=!0,this.g.abort(),this.j=!1),ts(this,!0)),ue.Z.N.call(this)},n.Ca=function(){this.u||(this.B||this.v||this.j?Kl(this):this.Xa())},n.Xa=function(){Kl(this)};function Kl(o){if(o.h&&typeof s<"u"){if(o.v&&Ht(o)==4)setTimeout(o.Ca.bind(o),0);else if(Ue(o,"readystatechange"),Ht(o)==4){o.h=!1;try{const R=o.ca();e:switch(R){case 200:case 201:case 202:case 204:case 206:case 304:case 1223:var l=!0;break e;default:l=!1}var d;if(!(d=l)){var p;if(p=R===0){let D=String(o.D).match(Ul)[1]||null;!D&&a.self&&a.self.location&&(D=a.self.location.protocol.slice(0,-1)),p=!My.test(D?D.toLowerCase():"")}d=p}if(d)Ue(o,"complete"),Ue(o,"success");else{o.o=6;try{var v=Ht(o)>2?o.g.statusText:""}catch{v=""}o.l=v+" ["+o.ca()+"]",Gl(o)}}finally{ts(o)}}}}function ts(o,l){if(o.g){o.m&&(clearTimeout(o.m),o.m=null);const d=o.g;o.g=null,l||Ue(o,"ready");try{d.onreadystatechange=null}catch{}}}n.isActive=function(){return!!this.g};function Ht(o){return o.g?o.g.readyState:0}n.ca=function(){try{return Ht(this)>2?this.g.status:-1}catch{return-1}},n.la=function(){try{return this.g?this.g.responseText:""}catch{return""}},n.La=function(o){if(this.g){var l=this.g.responseText;return o&&l.indexOf(o)==0&&(l=l.substring(o.length)),my(l)}};function Yl(o){try{if(!o.g)return null;if("response"in o.g)return o.g.response;switch(o.F){case"":case"text":return o.g.responseText;case"arraybuffer":if("mozResponseArrayBuffer"in o.g)return o.g.mozResponseArrayBuffer}return null}catch{return null}}function Uy(o){const l={};o=(o.g&&Ht(o)>=2&&o.g.getAllResponseHeaders()||"").split(`\r
`);for(let p=0;p<o.length;p++){if(_(o[p]))continue;var d=Iy(o[p]);const v=d[0];if(d=d[1],typeof d!="string")continue;d=d.trim();const R=l[v]||[];l[v]=R,R.push(d)}uy(l,function(p){return p.join(", ")})}n.ya=function(){return this.o},n.Ha=function(){return typeof this.l=="string"?this.l:String(this.l)};function zr(o,l,d){return d&&d.internalChannelParams&&d.internalChannelParams[o]||l}function Ql(o){this.za=0,this.i=[],this.j=new Mr,this.ba=this.na=this.J=this.W=this.g=this.wa=this.G=this.H=this.u=this.U=this.o=null,this.Ya=this.V=0,this.Sa=zr("failFast",!1,o),this.F=this.C=this.v=this.m=this.l=null,this.X=!0,this.xa=this.K=-1,this.Y=this.A=this.D=0,this.Qa=zr("baseRetryDelayMs",5e3,o),this.Za=zr("retryDelaySeedMs",1e4,o),this.Ta=zr("forwardChannelMaxRetries",2,o),this.va=zr("forwardChannelRequestTimeoutMs",2e4,o),this.ma=o&&o.xmlHttpFactory||void 0,this.Ua=o&&o.Rb||void 0,this.Aa=o&&o.useFetchStreams||!1,this.O=void 0,this.L=o&&o.supportsCrossDomainXhr||!1,this.M="",this.h=new Dl(o&&o.concurrentRequestLimit),this.Ba=new Vy,this.S=o&&o.fastHandshake||!1,this.R=o&&o.encodeInitMessageHeaders||!1,this.S&&this.R&&(this.R=!1),this.Ra=o&&o.Pb||!1,o&&o.ua&&this.j.ua(),o&&o.forceLongPolling&&(this.X=!1),this.aa=!this.S&&this.X&&o&&o.detectBufferingProxy||!1,this.ia=void 0,o&&o.longPollingTimeout&&o.longPollingTimeout>0&&(this.ia=o.longPollingTimeout),this.ta=void 0,this.T=0,this.P=!1,this.ja=this.B=null}n=Ql.prototype,n.ka=8,n.I=1,n.connect=function(o,l,d,p){xe(0),this.W=o,this.H=l||{},d&&p!==void 0&&(this.H.OSID=d,this.H.OAID=p),this.F=this.X,this.J=sh(this,null,this.W),rs(this)};function ia(o){if(Jl(o),o.I==3){var l=o.V++,d=lt(o.J);if(Z(d,"SID",o.M),Z(d,"RID",l),Z(d,"TYPE","terminate"),Wr(o,d),l=new $t(o,o.j,l),l.M=2,l.A=Zi(lt(d)),d=!1,a.navigator&&a.navigator.sendBeacon)try{d=a.navigator.sendBeacon(l.A.toString(),"")}catch{}!d&&a.Image&&(new Image().src=l.A,d=!0),d||(l.g=oh(l.j,null),l.g.ea(l.A)),l.F=Date.now(),Xi(l)}ih(o)}function ns(o){o.g&&(oa(o),o.g.cancel(),o.g=null)}function Jl(o){ns(o),o.v&&(a.clearTimeout(o.v),o.v=null),is(o),o.h.cancel(),o.m&&(typeof o.m=="number"&&a.clearTimeout(o.m),o.m=null)}function rs(o){if(!Ol(o.h)&&!o.m){o.m=!0;var l=o.Ea;se||g(),oe||(se(),oe=!0),I.add(l,o),o.D=0}}function xy(o,l){return Vl(o.h)>=o.h.j-(o.m?1:0)?!1:o.m?(o.i=l.G.concat(o.i),!0):o.I==1||o.I==2||o.D>=(o.Sa?0:o.Ta)?!1:(o.m=Vr(h(o.Ea,o,l),rh(o,o.D)),o.D++,!0)}n.Ea=function(o){if(this.m)if(this.m=null,this.I==1){if(!o){this.V=Math.floor(Math.random()*1e5),o=this.V++;const v=new $t(this,this.j,o);let R=this.o;if(this.U&&(R?(R=ul(R),hl(R,this.U)):R=this.U),this.u!==null||this.R||(v.J=R,R=null),this.S)e:{for(var l=0,d=0;d<this.i.length;d++){t:{var p=this.i[d];if("__data__"in p.map&&(p=p.map.__data__,typeof p=="string")){p=p.length;break t}p=void 0}if(p===void 0)break;if(l+=p,l>4096){l=d;break e}if(l===4096||d===this.i.length-1){l=d+1;break e}}l=1e3}else l=1e3;l=Zl(this,v,l),d=lt(this.J),Z(d,"RID",o),Z(d,"CVER",22),this.G&&Z(d,"X-HTTP-Session-Id",this.G),Wr(this,d),R&&(this.R?l="headers="+Lr(zl(R))+"&"+l:this.u&&ra(d,this.u,R)),ea(this.h,v),this.Ra&&Z(d,"TYPE","init"),this.S?(Z(d,"$req",l),Z(d,"SID","null"),v.U=!0,Qo(v,d,null)):Qo(v,d,l),this.I=2}}else this.I==3&&(o?Xl(this,o):this.i.length==0||Ol(this.h)||Xl(this))};function Xl(o,l){var d;l?d=l.l:d=o.V++;const p=lt(o.J);Z(p,"SID",o.M),Z(p,"RID",d),Z(p,"AID",o.K),Wr(o,p),o.u&&o.o&&ra(p,o.u,o.o),d=new $t(o,o.j,d,o.D+1),o.u===null&&(d.J=o.o),l&&(o.i=l.G.concat(o.i)),l=Zl(o,d,1e3),d.H=Math.round(o.va*.5)+Math.round(o.va*.5*Math.random()),ea(o.h,d),Qo(d,p,l)}function Wr(o,l){o.H&&Gi(o.H,function(d,p){Z(l,p,d)}),o.l&&Gi({},function(d,p){Z(l,p,d)})}function Zl(o,l,d){d=Math.min(o.i.length,d);const p=o.l?h(o.l.Ka,o.l,o):null;e:{var v=o.i;let H=-1;for(;;){const ye=["count="+d];H==-1?d>0?(H=v[0].g,ye.push("ofs="+H)):H=0:ye.push("ofs="+H);let J=!0;for(let we=0;we<d;we++){var R=v[we].g;const ht=v[we].map;if(R-=H,R<0)H=Math.max(0,v[we].g-100),J=!1;else try{R="req"+R+"_"||"";try{var D=ht instanceof Map?ht:Object.entries(ht);for(const[En,zt]of D){let Wt=zt;c(zt)&&(Wt=zo(zt)),ye.push(R+En+"="+encodeURIComponent(Wt))}}catch(En){throw ye.push(R+"type="+encodeURIComponent("_badmap")),En}}catch{p&&p(ht)}}if(J){D=ye.join("&");break e}}D=void 0}return o=o.i.splice(0,d),l.G=o,D}function eh(o){if(!o.g&&!o.v){o.Y=1;var l=o.Da;se||g(),oe||(se(),oe=!0),I.add(l,o),o.A=0}}function sa(o){return o.g||o.v||o.A>=3?!1:(o.Y++,o.v=Vr(h(o.Da,o),rh(o,o.A)),o.A++,!0)}n.Da=function(){if(this.v=null,th(this),this.aa&&!(this.P||this.g==null||this.T<=0)){var o=4*this.T;this.j.info("BP detection timer enabled: "+o),this.B=Vr(h(this.Wa,this),o)}},n.Wa=function(){this.B&&(this.B=null,this.j.info("BP detection timeout reached."),this.j.info("Buffering proxy detected and switch to long-polling!"),this.F=!1,this.P=!0,xe(10),ns(this),th(this))};function oa(o){o.B!=null&&(a.clearTimeout(o.B),o.B=null)}function th(o){o.g=new $t(o,o.j,"rpc",o.Y),o.u===null&&(o.g.J=o.o),o.g.P=0;var l=lt(o.na);Z(l,"RID","rpc"),Z(l,"SID",o.M),Z(l,"AID",o.K),Z(l,"CI",o.F?"0":"1"),!o.F&&o.ia&&Z(l,"TO",o.ia),Z(l,"TYPE","xmlhttp"),Wr(o,l),o.u&&o.o&&ra(l,o.u,o.o),o.O&&(o.g.H=o.O);var d=o.g;o=o.ba,d.M=1,d.A=Zi(lt(l)),d.u=null,d.R=!0,Cl(d,o)}n.Va=function(){this.C!=null&&(this.C=null,ns(this),sa(this),xe(19))};function is(o){o.C!=null&&(a.clearTimeout(o.C),o.C=null)}function nh(o,l){var d=null;if(o.g==l){is(o),oa(o),o.g=null;var p=2}else if(Zo(o.h,l))d=l.G,Ml(o.h,l),p=1;else return;if(o.I!=0){if(l.o)if(p==1){d=l.u?l.u.length:0,l=Date.now()-l.F;var v=o.D;p=Qi(),Ue(p,new Al(p,d)),rs(o)}else eh(o);else if(v=l.m,v==3||v==0&&l.X>0||!(p==1&&xy(o,l)||p==2&&sa(o)))switch(d&&d.length>0&&(l=o.h,l.i=l.i.concat(d)),v){case 1:Tn(o,5);break;case 4:Tn(o,10);break;case 3:Tn(o,6);break;default:Tn(o,2)}}}function rh(o,l){let d=o.Qa+Math.floor(Math.random()*o.Za);return o.isActive()||(d*=2),d*l}function Tn(o,l){if(o.j.info("Error code "+l),l==2){var d=h(o.bb,o),p=o.Ua;const v=!p;p=new qt(p||"//www.google.com/images/cleardot.gif"),a.location&&a.location.protocol=="http"||xr(p,"https"),Zi(p),v?Dy(p.toString(),d):Oy(p.toString(),d)}else xe(2);o.I=0,o.l&&o.l.pa(l),ih(o),Jl(o)}n.bb=function(o){o?(this.j.info("Successfully pinged google.com"),xe(2)):(this.j.info("Failed to ping google.com"),xe(1))};function ih(o){if(o.I=0,o.ja=[],o.l){const l=Ll(o.h);(l.length!=0||o.i.length!=0)&&(k(o.ja,l),k(o.ja,o.i),o.h.i.length=0,b(o.i),o.i.length=0),o.l.oa()}}function sh(o,l,d){var p=d instanceof qt?lt(d):new qt(d);if(p.g!="")l&&(p.g=l+"."+p.g),Fr(p,p.u);else{var v=a.location;p=v.protocol,l=l?l+"."+v.hostname:v.hostname,v=+v.port;const R=new qt(null);p&&xr(R,p),l&&(R.g=l),v&&Fr(R,v),d&&(R.h=d),p=R}return d=o.G,l=o.wa,d&&l&&Z(p,d,l),Z(p,"VER",o.ka),Wr(o,p),p}function oh(o,l,d){if(l&&!o.L)throw Error("Can't create secondary domain capable XhrIo object.");return l=o.Aa&&!o.ma?new ue(new na({ab:d})):new ue(o.ma),l.Fa(o.L),l}n.isActive=function(){return!!this.l&&this.l.isActive(this)};function ah(){}n=ah.prototype,n.ra=function(){},n.qa=function(){},n.pa=function(){},n.oa=function(){},n.isActive=function(){return!0},n.Ka=function(){};function ss(){}ss.prototype.g=function(o,l){return new Ye(o,l)};function Ye(o,l){Ne.call(this),this.g=new Ql(l),this.l=o,this.h=l&&l.messageUrlParams||null,o=l&&l.messageHeaders||null,l&&l.clientProtocolHeaderRequired&&(o?o["X-Client-Protocol"]="webchannel":o={"X-Client-Protocol":"webchannel"}),this.g.o=o,o=l&&l.initMessageHeaders||null,l&&l.messageContentType&&(o?o["X-WebChannel-Content-Type"]=l.messageContentType:o={"X-WebChannel-Content-Type":l.messageContentType}),l&&l.sa&&(o?o["X-WebChannel-Client-Profile"]=l.sa:o={"X-WebChannel-Client-Profile":l.sa}),this.g.U=o,(o=l&&l.Qb)&&!_(o)&&(this.g.u=o),this.A=l&&l.supportsCrossDomainXhr||!1,this.v=l&&l.sendRawJson||!1,(l=l&&l.httpSessionIdParam)&&!_(l)&&(this.g.G=l,o=this.h,o!==null&&l in o&&(o=this.h,l in o&&delete o[l])),this.j=new jn(this)}m(Ye,Ne),Ye.prototype.m=function(){this.g.l=this.j,this.A&&(this.g.L=!0),this.g.connect(this.l,this.h||void 0)},Ye.prototype.close=function(){ia(this.g)},Ye.prototype.o=function(o){var l=this.g;if(typeof o=="string"){var d={};d.__data__=o,o=d}else this.v&&(d={},d.__data__=zo(o),o=d);l.i.push(new Ay(l.Ya++,o)),l.I==3&&rs(l)},Ye.prototype.N=function(){this.g.l=null,delete this.j,ia(this.g),delete this.g,Ye.Z.N.call(this)};function ch(o){Wo.call(this),o.__headers__&&(this.headers=o.__headers__,this.statusCode=o.__status__,delete o.__headers__,delete o.__status__);var l=o.__sm__;if(l){e:{for(const d in l){o=d;break e}o=void 0}(this.i=o)&&(o=this.i,l=l!==null&&o in l?l[o]:void 0),this.data=l}else this.data=o}m(ch,Wo);function uh(){Go.call(this),this.status=1}m(uh,Go);function jn(o){this.g=o}m(jn,ah),jn.prototype.ra=function(){Ue(this.g,"a")},jn.prototype.qa=function(o){Ue(this.g,new ch(o))},jn.prototype.pa=function(o){Ue(this.g,new uh)},jn.prototype.oa=function(){Ue(this.g,"b")},ss.prototype.createWebChannel=ss.prototype.g,Ye.prototype.send=Ye.prototype.o,Ye.prototype.open=Ye.prototype.m,Ye.prototype.close=Ye.prototype.close,Qp=function(){return new ss},Yp=function(){return Qi()},Kp=gn,Za={jb:0,mb:1,nb:2,Hb:3,Mb:4,Jb:5,Kb:6,Ib:7,Gb:8,Lb:9,PROXY:10,NOPROXY:11,Eb:12,Ab:13,Bb:14,zb:15,Cb:16,Db:17,fb:18,eb:19,gb:20},Ji.NO_ERROR=0,Ji.TIMEOUT=8,Ji.HTTP_ERROR=6,As=Ji,Rl.COMPLETE="complete",Gp=Rl,El.EventType=Dr,Dr.OPEN="a",Dr.CLOSE="b",Dr.ERROR="c",Dr.MESSAGE="d",Ne.prototype.listen=Ne.prototype.J,Zr=El,ue.prototype.listenOnce=ue.prototype.K,ue.prototype.getLastError=ue.prototype.Ha,ue.prototype.getLastErrorCode=ue.prototype.ya,ue.prototype.getStatus=ue.prototype.ca,ue.prototype.getResponseJson=ue.prototype.La,ue.prototype.getResponseText=ue.prototype.la,ue.prototype.send=ue.prototype.ea,ue.prototype.setWithCredentials=ue.prototype.Fa,Wp=ue}).apply(typeof us<"u"?us:typeof self<"u"?self:typeof window<"u"?window:{});/**
 * @license
 * Copyright 2017 Google LLC
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
 */class He{constructor(e){this.uid=e}isAuthenticated(){return this.uid!=null}toKey(){return this.isAuthenticated()?"uid:"+this.uid:"anonymous-user"}isEqual(e){return e.uid===this.uid}}He.UNAUTHENTICATED=new He(null),He.GOOGLE_CREDENTIALS=new He("google-credentials-uid"),He.FIRST_PARTY=new He("first-party-uid"),He.MOCK_USER=new He("mock-user");/**
 * @license
 * Copyright 2017 Google LLC
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
 */let vr="12.10.0";function nA(n){vr=n}/**
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
 *//**
 * @license
 * Copyright 2017 Google LLC
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
 */const Pn=new _r("@firebase/firestore");function zn(){return Pn.logLevel}function M(n,...e){if(Pn.logLevel<=z.DEBUG){const t=e.map(Kc);Pn.debug(`Firestore (${vr}): ${n}`,...t)}}function Lt(n,...e){if(Pn.logLevel<=z.ERROR){const t=e.map(Kc);Pn.error(`Firestore (${vr}): ${n}`,...t)}}function ur(n,...e){if(Pn.logLevel<=z.WARN){const t=e.map(Kc);Pn.warn(`Firestore (${vr}): ${n}`,...t)}}function Kc(n){if(typeof n=="string")return n;try{return function(t){return JSON.stringify(t)}(n)}catch{return n}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */function x(n,e,t){let r="Unexpected state";typeof e=="string"?r=e:t=e,Jp(n,r,t)}function Jp(n,e,t){let r=`FIRESTORE (${vr}) INTERNAL ASSERTION FAILED: ${e} (ID: ${n.toString(16)})`;if(t!==void 0)try{r+=" CONTEXT: "+JSON.stringify(t)}catch{r+=" CONTEXT: "+t}throw Lt(r),new Error(r)}function Q(n,e,t,r){let i="Unexpected state";typeof t=="string"?i=t:r=t,n||Jp(e,i,r)}function q(n,e){return n}/**
 * @license
 * Copyright 2017 Google LLC
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
 */const S={OK:"ok",CANCELLED:"cancelled",UNKNOWN:"unknown",INVALID_ARGUMENT:"invalid-argument",DEADLINE_EXCEEDED:"deadline-exceeded",NOT_FOUND:"not-found",ALREADY_EXISTS:"already-exists",PERMISSION_DENIED:"permission-denied",UNAUTHENTICATED:"unauthenticated",RESOURCE_EXHAUSTED:"resource-exhausted",FAILED_PRECONDITION:"failed-precondition",ABORTED:"aborted",OUT_OF_RANGE:"out-of-range",UNIMPLEMENTED:"unimplemented",INTERNAL:"internal",UNAVAILABLE:"unavailable",DATA_LOSS:"data-loss"};class O extends rt{constructor(e,t){super(e,t),this.code=e,this.message=t,this.toString=()=>`${this.name}: [code=${this.code}]: ${this.message}`}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class kt{constructor(){this.promise=new Promise((e,t)=>{this.resolve=e,this.reject=t})}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class rA{constructor(e,t){this.user=t,this.type="OAuth",this.headers=new Map,this.headers.set("Authorization",`Bearer ${e}`)}}class iA{getToken(){return Promise.resolve(null)}invalidateToken(){}start(e,t){e.enqueueRetryable(()=>t(He.UNAUTHENTICATED))}shutdown(){}}class sA{constructor(e){this.t=e,this.currentUser=He.UNAUTHENTICATED,this.i=0,this.forceRefresh=!1,this.auth=null}start(e,t){Q(this.o===void 0,42304);let r=this.i;const i=u=>this.i!==r?(r=this.i,t(u)):Promise.resolve();let s=new kt;this.o=()=>{this.i++,this.currentUser=this.u(),s.resolve(),s=new kt,e.enqueueRetryable(()=>i(this.currentUser))};const a=()=>{const u=s;e.enqueueRetryable(async()=>{await u.promise,await i(this.currentUser)})},c=u=>{M("FirebaseAuthCredentialsProvider","Auth detected"),this.auth=u,this.o&&(this.auth.addAuthTokenListener(this.o),a())};this.t.onInit(u=>c(u)),setTimeout(()=>{if(!this.auth){const u=this.t.getImmediate({optional:!0});u?c(u):(M("FirebaseAuthCredentialsProvider","Auth not yet detected"),s.resolve(),s=new kt)}},0),a()}getToken(){const e=this.i,t=this.forceRefresh;return this.forceRefresh=!1,this.auth?this.auth.getToken(t).then(r=>this.i!==e?(M("FirebaseAuthCredentialsProvider","getToken aborted due to token change."),this.getToken()):r?(Q(typeof r.accessToken=="string",31837,{l:r}),new rA(r.accessToken,this.currentUser)):null):Promise.resolve(null)}invalidateToken(){this.forceRefresh=!0}shutdown(){this.auth&&this.o&&this.auth.removeAuthTokenListener(this.o),this.o=void 0}u(){const e=this.auth&&this.auth.getUid();return Q(e===null||typeof e=="string",2055,{h:e}),new He(e)}}class oA{constructor(e,t,r){this.P=e,this.T=t,this.I=r,this.type="FirstParty",this.user=He.FIRST_PARTY,this.R=new Map}A(){return this.I?this.I():null}get headers(){this.R.set("X-Goog-AuthUser",this.P);const e=this.A();return e&&this.R.set("Authorization",e),this.T&&this.R.set("X-Goog-Iam-Authorization-Token",this.T),this.R}}class aA{constructor(e,t,r){this.P=e,this.T=t,this.I=r}getToken(){return Promise.resolve(new oA(this.P,this.T,this.I))}start(e,t){e.enqueueRetryable(()=>t(He.FIRST_PARTY))}shutdown(){}invalidateToken(){}}class Hh{constructor(e){this.value=e,this.type="AppCheck",this.headers=new Map,e&&e.length>0&&this.headers.set("x-firebase-appcheck",this.value)}}class cA{constructor(e,t){this.V=t,this.forceRefresh=!1,this.appCheck=null,this.m=null,this.p=null,ie(e)&&e.settings.appCheckToken&&(this.p=e.settings.appCheckToken)}start(e,t){Q(this.o===void 0,3512);const r=s=>{s.error!=null&&M("FirebaseAppCheckTokenProvider",`Error getting App Check token; using placeholder token instead. Error: ${s.error.message}`);const a=s.token!==this.m;return this.m=s.token,M("FirebaseAppCheckTokenProvider",`Received ${a?"new":"existing"} token.`),a?t(s.token):Promise.resolve()};this.o=s=>{e.enqueueRetryable(()=>r(s))};const i=s=>{M("FirebaseAppCheckTokenProvider","AppCheck detected"),this.appCheck=s,this.o&&this.appCheck.addTokenListener(this.o)};this.V.onInit(s=>i(s)),setTimeout(()=>{if(!this.appCheck){const s=this.V.getImmediate({optional:!0});s?i(s):M("FirebaseAppCheckTokenProvider","AppCheck not yet detected")}},0)}getToken(){if(this.p)return Promise.resolve(new Hh(this.p));const e=this.forceRefresh;return this.forceRefresh=!1,this.appCheck?this.appCheck.getToken(e).then(t=>t?(Q(typeof t.token=="string",44558,{tokenResult:t}),this.m=t.token,new Hh(t.token)):null):Promise.resolve(null)}invalidateToken(){this.forceRefresh=!0}shutdown(){this.appCheck&&this.o&&this.appCheck.removeTokenListener(this.o),this.o=void 0}}/**
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
 */function uA(n){const e=typeof self<"u"&&(self.crypto||self.msCrypto),t=new Uint8Array(n);if(e&&typeof e.getRandomValues=="function")e.getRandomValues(t);else for(let r=0;r<n;r++)t[r]=Math.floor(256*Math.random());return t}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class Yc{static newId(){const e="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",t=62*Math.floor(4.129032258064516);let r="";for(;r.length<20;){const i=uA(40);for(let s=0;s<i.length;++s)r.length<20&&i[s]<t&&(r+=e.charAt(i[s]%62))}return r}}function W(n,e){return n<e?-1:n>e?1:0}function ec(n,e){const t=Math.min(n.length,e.length);for(let r=0;r<t;r++){const i=n.charAt(r),s=e.charAt(r);if(i!==s)return Ia(i)===Ia(s)?W(i,s):Ia(i)?1:-1}return W(n.length,e.length)}const lA=55296,hA=57343;function Ia(n){const e=n.charCodeAt(0);return e>=lA&&e<=hA}function lr(n,e,t){return n.length===e.length&&n.every((r,i)=>t(r,e[i]))}/**
 * @license
 * Copyright 2017 Google LLC
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
 */const zh="__name__";class dt{constructor(e,t,r){t===void 0?t=0:t>e.length&&x(637,{offset:t,range:e.length}),r===void 0?r=e.length-t:r>e.length-t&&x(1746,{length:r,range:e.length-t}),this.segments=e,this.offset=t,this.len=r}get length(){return this.len}isEqual(e){return dt.comparator(this,e)===0}child(e){const t=this.segments.slice(this.offset,this.limit());return e instanceof dt?e.forEach(r=>{t.push(r)}):t.push(e),this.construct(t)}limit(){return this.offset+this.length}popFirst(e){return e=e===void 0?1:e,this.construct(this.segments,this.offset+e,this.length-e)}popLast(){return this.construct(this.segments,this.offset,this.length-1)}firstSegment(){return this.segments[this.offset]}lastSegment(){return this.get(this.length-1)}get(e){return this.segments[this.offset+e]}isEmpty(){return this.length===0}isPrefixOf(e){if(e.length<this.length)return!1;for(let t=0;t<this.length;t++)if(this.get(t)!==e.get(t))return!1;return!0}isImmediateParentOf(e){if(this.length+1!==e.length)return!1;for(let t=0;t<this.length;t++)if(this.get(t)!==e.get(t))return!1;return!0}forEach(e){for(let t=this.offset,r=this.limit();t<r;t++)e(this.segments[t])}toArray(){return this.segments.slice(this.offset,this.limit())}static comparator(e,t){const r=Math.min(e.length,t.length);for(let i=0;i<r;i++){const s=dt.compareSegments(e.get(i),t.get(i));if(s!==0)return s}return W(e.length,t.length)}static compareSegments(e,t){const r=dt.isNumericId(e),i=dt.isNumericId(t);return r&&!i?-1:!r&&i?1:r&&i?dt.extractNumericId(e).compare(dt.extractNumericId(t)):ec(e,t)}static isNumericId(e){return e.startsWith("__id")&&e.endsWith("__")}static extractNumericId(e){return tn.fromString(e.substring(4,e.length-2))}}class X extends dt{construct(e,t,r){return new X(e,t,r)}canonicalString(){return this.toArray().join("/")}toString(){return this.canonicalString()}toUriEncodedString(){return this.toArray().map(encodeURIComponent).join("/")}static fromString(...e){const t=[];for(const r of e){if(r.indexOf("//")>=0)throw new O(S.INVALID_ARGUMENT,`Invalid segment (${r}). Paths must not contain // in them.`);t.push(...r.split("/").filter(i=>i.length>0))}return new X(t)}static emptyPath(){return new X([])}}const dA=/^[_a-zA-Z][_a-zA-Z0-9]*$/;class Se extends dt{construct(e,t,r){return new Se(e,t,r)}static isValidIdentifier(e){return dA.test(e)}canonicalString(){return this.toArray().map(e=>(e=e.replace(/\\/g,"\\\\").replace(/`/g,"\\`"),Se.isValidIdentifier(e)||(e="`"+e+"`"),e)).join(".")}toString(){return this.canonicalString()}isKeyField(){return this.length===1&&this.get(0)===zh}static keyField(){return new Se([zh])}static fromServerFormat(e){const t=[];let r="",i=0;const s=()=>{if(r.length===0)throw new O(S.INVALID_ARGUMENT,`Invalid field path (${e}). Paths must not be empty, begin with '.', end with '.', or contain '..'`);t.push(r),r=""};let a=!1;for(;i<e.length;){const c=e[i];if(c==="\\"){if(i+1===e.length)throw new O(S.INVALID_ARGUMENT,"Path has trailing escape character: "+e);const u=e[i+1];if(u!=="\\"&&u!=="."&&u!=="`")throw new O(S.INVALID_ARGUMENT,"Path has invalid escape sequence: "+e);r+=u,i+=2}else c==="`"?(a=!a,i++):c!=="."||a?(r+=c,i++):(s(),i++)}if(s(),a)throw new O(S.INVALID_ARGUMENT,"Unterminated ` in path: "+e);return new Se(t)}static emptyPath(){return new Se([])}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class U{constructor(e){this.path=e}static fromPath(e){return new U(X.fromString(e))}static fromName(e){return new U(X.fromString(e).popFirst(5))}static empty(){return new U(X.emptyPath())}get collectionGroup(){return this.path.popLast().lastSegment()}hasCollectionId(e){return this.path.length>=2&&this.path.get(this.path.length-2)===e}getCollectionGroup(){return this.path.get(this.path.length-2)}getCollectionPath(){return this.path.popLast()}isEqual(e){return e!==null&&X.comparator(this.path,e.path)===0}toString(){return this.path.toString()}static comparator(e,t){return X.comparator(e.path,t.path)}static isDocumentKey(e){return e.length%2==0}static fromSegments(e){return new U(new X(e.slice()))}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */function Xp(n,e,t){if(!t)throw new O(S.INVALID_ARGUMENT,`Function ${n}() cannot be called with an empty ${e}.`)}function fA(n,e,t,r){if(e===!0&&r===!0)throw new O(S.INVALID_ARGUMENT,`${n} and ${t} cannot be used together.`)}function Wh(n){if(!U.isDocumentKey(n))throw new O(S.INVALID_ARGUMENT,`Invalid document reference. Document references must have an even number of segments, but ${n} has ${n.length}.`)}function Gh(n){if(U.isDocumentKey(n))throw new O(S.INVALID_ARGUMENT,`Invalid collection reference. Collection references must have an odd number of segments, but ${n} has ${n.length}.`)}function Zp(n){return typeof n=="object"&&n!==null&&(Object.getPrototypeOf(n)===Object.prototype||Object.getPrototypeOf(n)===null)}function yo(n){if(n===void 0)return"undefined";if(n===null)return"null";if(typeof n=="string")return n.length>20&&(n=`${n.substring(0,20)}...`),JSON.stringify(n);if(typeof n=="number"||typeof n=="boolean")return""+n;if(typeof n=="object"){if(n instanceof Array)return"an array";{const e=function(r){return r.constructor?r.constructor.name:null}(n);return e?`a custom ${e} object`:"an object"}}return typeof n=="function"?"a function":x(12329,{type:typeof n})}function rn(n,e){if("_delegate"in n&&(n=n._delegate),!(n instanceof e)){if(e.name===n.constructor.name)throw new O(S.INVALID_ARGUMENT,"Type does not match the expected instance. Did you pass a reference from a different Firestore SDK?");{const t=yo(n);throw new O(S.INVALID_ARGUMENT,`Expected type '${e.name}', but it was: ${t}`)}}return n}/**
 * @license
 * Copyright 2025 Google LLC
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
 */function ge(n,e){const t={typeString:n};return e&&(t.value=e),t}function Ui(n,e){if(!Zp(n))throw new O(S.INVALID_ARGUMENT,"JSON must be an object");let t;for(const r in e)if(e[r]){const i=e[r].typeString,s="value"in e[r]?{value:e[r].value}:void 0;if(!(r in n)){t=`JSON missing required field: '${r}'`;break}const a=n[r];if(i&&typeof a!==i){t=`JSON field '${r}' must be a ${i}.`;break}if(s!==void 0&&a!==s.value){t=`Expected '${r}' field to equal '${s.value}'`;break}}if(t)throw new O(S.INVALID_ARGUMENT,t);return!0}/**
 * @license
 * Copyright 2017 Google LLC
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
 */const Kh=-62135596800,Yh=1e6;class ee{static now(){return ee.fromMillis(Date.now())}static fromDate(e){return ee.fromMillis(e.getTime())}static fromMillis(e){const t=Math.floor(e/1e3),r=Math.floor((e-1e3*t)*Yh);return new ee(t,r)}constructor(e,t){if(this.seconds=e,this.nanoseconds=t,t<0)throw new O(S.INVALID_ARGUMENT,"Timestamp nanoseconds out of range: "+t);if(t>=1e9)throw new O(S.INVALID_ARGUMENT,"Timestamp nanoseconds out of range: "+t);if(e<Kh)throw new O(S.INVALID_ARGUMENT,"Timestamp seconds out of range: "+e);if(e>=253402300800)throw new O(S.INVALID_ARGUMENT,"Timestamp seconds out of range: "+e)}toDate(){return new Date(this.toMillis())}toMillis(){return 1e3*this.seconds+this.nanoseconds/Yh}_compareTo(e){return this.seconds===e.seconds?W(this.nanoseconds,e.nanoseconds):W(this.seconds,e.seconds)}isEqual(e){return e.seconds===this.seconds&&e.nanoseconds===this.nanoseconds}toString(){return"Timestamp(seconds="+this.seconds+", nanoseconds="+this.nanoseconds+")"}toJSON(){return{type:ee._jsonSchemaVersion,seconds:this.seconds,nanoseconds:this.nanoseconds}}static fromJSON(e){if(Ui(e,ee._jsonSchema))return new ee(e.seconds,e.nanoseconds)}valueOf(){const e=this.seconds-Kh;return String(e).padStart(12,"0")+"."+String(this.nanoseconds).padStart(9,"0")}}ee._jsonSchemaVersion="firestore/timestamp/1.0",ee._jsonSchema={type:ge("string",ee._jsonSchemaVersion),seconds:ge("number"),nanoseconds:ge("number")};/**
 * @license
 * Copyright 2017 Google LLC
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
 */class B{static fromTimestamp(e){return new B(e)}static min(){return new B(new ee(0,0))}static max(){return new B(new ee(253402300799,999999999))}constructor(e){this.timestamp=e}compareTo(e){return this.timestamp._compareTo(e.timestamp)}isEqual(e){return this.timestamp.isEqual(e.timestamp)}toMicroseconds(){return 1e6*this.timestamp.seconds+this.timestamp.nanoseconds/1e3}toString(){return"SnapshotVersion("+this.timestamp.toString()+")"}toTimestamp(){return this.timestamp}}/**
 * @license
 * Copyright 2021 Google LLC
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
 */const wi=-1;function pA(n,e){const t=n.toTimestamp().seconds,r=n.toTimestamp().nanoseconds+1,i=B.fromTimestamp(r===1e9?new ee(t+1,0):new ee(t,r));return new sn(i,U.empty(),e)}function mA(n){return new sn(n.readTime,n.key,wi)}class sn{constructor(e,t,r){this.readTime=e,this.documentKey=t,this.largestBatchId=r}static min(){return new sn(B.min(),U.empty(),wi)}static max(){return new sn(B.max(),U.empty(),wi)}}function gA(n,e){let t=n.readTime.compareTo(e.readTime);return t!==0?t:(t=U.comparator(n.documentKey,e.documentKey),t!==0?t:W(n.largestBatchId,e.largestBatchId))}/**
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
 */const _A="The current tab is not in the required state to perform this operation. It might be necessary to refresh the browser tab.";class yA{constructor(){this.onCommittedListeners=[]}addOnCommittedListener(e){this.onCommittedListeners.push(e)}raiseOnCommittedEvent(){this.onCommittedListeners.forEach(e=>e())}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */async function Ar(n){if(n.code!==S.FAILED_PRECONDITION||n.message!==_A)throw n;M("LocalStore","Unexpectedly lost primary lease")}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class P{constructor(e){this.nextCallback=null,this.catchCallback=null,this.result=void 0,this.error=void 0,this.isDone=!1,this.callbackAttached=!1,e(t=>{this.isDone=!0,this.result=t,this.nextCallback&&this.nextCallback(t)},t=>{this.isDone=!0,this.error=t,this.catchCallback&&this.catchCallback(t)})}catch(e){return this.next(void 0,e)}next(e,t){return this.callbackAttached&&x(59440),this.callbackAttached=!0,this.isDone?this.error?this.wrapFailure(t,this.error):this.wrapSuccess(e,this.result):new P((r,i)=>{this.nextCallback=s=>{this.wrapSuccess(e,s).next(r,i)},this.catchCallback=s=>{this.wrapFailure(t,s).next(r,i)}})}toPromise(){return new Promise((e,t)=>{this.next(e,t)})}wrapUserFunction(e){try{const t=e();return t instanceof P?t:P.resolve(t)}catch(t){return P.reject(t)}}wrapSuccess(e,t){return e?this.wrapUserFunction(()=>e(t)):P.resolve(t)}wrapFailure(e,t){return e?this.wrapUserFunction(()=>e(t)):P.reject(t)}static resolve(e){return new P((t,r)=>{t(e)})}static reject(e){return new P((t,r)=>{r(e)})}static waitFor(e){return new P((t,r)=>{let i=0,s=0,a=!1;e.forEach(c=>{++i,c.next(()=>{++s,a&&s===i&&t()},u=>r(u))}),a=!0,s===i&&t()})}static or(e){let t=P.resolve(!1);for(const r of e)t=t.next(i=>i?P.resolve(i):r());return t}static forEach(e,t){const r=[];return e.forEach((i,s)=>{r.push(t.call(this,i,s))}),this.waitFor(r)}static mapArray(e,t){return new P((r,i)=>{const s=e.length,a=new Array(s);let c=0;for(let u=0;u<s;u++){const h=u;t(e[h]).next(f=>{a[h]=f,++c,c===s&&r(a)},f=>i(f))}})}static doWhile(e,t){return new P((r,i)=>{const s=()=>{e()===!0?t().next(()=>{s()},i):r()};s()})}}function TA(n){const e=n.match(/Android ([\d.]+)/i),t=e?e[1].split(".").slice(0,2).join("."):"-1";return Number(t)}function Rr(n){return n.name==="IndexedDbTransactionError"}/**
 * @license
 * Copyright 2018 Google LLC
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
 */class To{constructor(e,t){this.previousValue=e,t&&(t.sequenceNumberHandler=r=>this.ae(r),this.ue=r=>t.writeSequenceNumber(r))}ae(e){return this.previousValue=Math.max(e,this.previousValue),this.previousValue}next(){const e=++this.previousValue;return this.ue&&this.ue(e),e}}To.ce=-1;/**
 * @license
 * Copyright 2017 Google LLC
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
 */const Qc=-1;function Eo(n){return n==null}function Bs(n){return n===0&&1/n==-1/0}function EA(n){return typeof n=="number"&&Number.isInteger(n)&&!Bs(n)&&n<=Number.MAX_SAFE_INTEGER&&n>=Number.MIN_SAFE_INTEGER}/**
 * @license
 * Copyright 2017 Google LLC
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
 */const em="";function IA(n){let e="";for(let t=0;t<n.length;t++)e.length>0&&(e=Qh(e)),e=wA(n.get(t),e);return Qh(e)}function wA(n,e){let t=e;const r=n.length;for(let i=0;i<r;i++){const s=n.charAt(i);switch(s){case"\0":t+="";break;case em:t+="";break;default:t+=s}}return t}function Qh(n){return n+em+""}/**
 * @license
 * Copyright 2017 Google LLC
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
 */function Jh(n){let e=0;for(const t in n)Object.prototype.hasOwnProperty.call(n,t)&&e++;return e}function Ln(n,e){for(const t in n)Object.prototype.hasOwnProperty.call(n,t)&&e(t,n[t])}function tm(n){for(const e in n)if(Object.prototype.hasOwnProperty.call(n,e))return!1;return!0}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class ae{constructor(e,t){this.comparator=e,this.root=t||Re.EMPTY}insert(e,t){return new ae(this.comparator,this.root.insert(e,t,this.comparator).copy(null,null,Re.BLACK,null,null))}remove(e){return new ae(this.comparator,this.root.remove(e,this.comparator).copy(null,null,Re.BLACK,null,null))}get(e){let t=this.root;for(;!t.isEmpty();){const r=this.comparator(e,t.key);if(r===0)return t.value;r<0?t=t.left:r>0&&(t=t.right)}return null}indexOf(e){let t=0,r=this.root;for(;!r.isEmpty();){const i=this.comparator(e,r.key);if(i===0)return t+r.left.size;i<0?r=r.left:(t+=r.left.size+1,r=r.right)}return-1}isEmpty(){return this.root.isEmpty()}get size(){return this.root.size}minKey(){return this.root.minKey()}maxKey(){return this.root.maxKey()}inorderTraversal(e){return this.root.inorderTraversal(e)}forEach(e){this.inorderTraversal((t,r)=>(e(t,r),!1))}toString(){const e=[];return this.inorderTraversal((t,r)=>(e.push(`${t}:${r}`),!1)),`{${e.join(", ")}}`}reverseTraversal(e){return this.root.reverseTraversal(e)}getIterator(){return new ls(this.root,null,this.comparator,!1)}getIteratorFrom(e){return new ls(this.root,e,this.comparator,!1)}getReverseIterator(){return new ls(this.root,null,this.comparator,!0)}getReverseIteratorFrom(e){return new ls(this.root,e,this.comparator,!0)}}class ls{constructor(e,t,r,i){this.isReverse=i,this.nodeStack=[];let s=1;for(;!e.isEmpty();)if(s=t?r(e.key,t):1,t&&i&&(s*=-1),s<0)e=this.isReverse?e.left:e.right;else{if(s===0){this.nodeStack.push(e);break}this.nodeStack.push(e),e=this.isReverse?e.right:e.left}}getNext(){let e=this.nodeStack.pop();const t={key:e.key,value:e.value};if(this.isReverse)for(e=e.left;!e.isEmpty();)this.nodeStack.push(e),e=e.right;else for(e=e.right;!e.isEmpty();)this.nodeStack.push(e),e=e.left;return t}hasNext(){return this.nodeStack.length>0}peek(){if(this.nodeStack.length===0)return null;const e=this.nodeStack[this.nodeStack.length-1];return{key:e.key,value:e.value}}}class Re{constructor(e,t,r,i,s){this.key=e,this.value=t,this.color=r??Re.RED,this.left=i??Re.EMPTY,this.right=s??Re.EMPTY,this.size=this.left.size+1+this.right.size}copy(e,t,r,i,s){return new Re(e??this.key,t??this.value,r??this.color,i??this.left,s??this.right)}isEmpty(){return!1}inorderTraversal(e){return this.left.inorderTraversal(e)||e(this.key,this.value)||this.right.inorderTraversal(e)}reverseTraversal(e){return this.right.reverseTraversal(e)||e(this.key,this.value)||this.left.reverseTraversal(e)}min(){return this.left.isEmpty()?this:this.left.min()}minKey(){return this.min().key}maxKey(){return this.right.isEmpty()?this.key:this.right.maxKey()}insert(e,t,r){let i=this;const s=r(e,i.key);return i=s<0?i.copy(null,null,null,i.left.insert(e,t,r),null):s===0?i.copy(null,t,null,null,null):i.copy(null,null,null,null,i.right.insert(e,t,r)),i.fixUp()}removeMin(){if(this.left.isEmpty())return Re.EMPTY;let e=this;return e.left.isRed()||e.left.left.isRed()||(e=e.moveRedLeft()),e=e.copy(null,null,null,e.left.removeMin(),null),e.fixUp()}remove(e,t){let r,i=this;if(t(e,i.key)<0)i.left.isEmpty()||i.left.isRed()||i.left.left.isRed()||(i=i.moveRedLeft()),i=i.copy(null,null,null,i.left.remove(e,t),null);else{if(i.left.isRed()&&(i=i.rotateRight()),i.right.isEmpty()||i.right.isRed()||i.right.left.isRed()||(i=i.moveRedRight()),t(e,i.key)===0){if(i.right.isEmpty())return Re.EMPTY;r=i.right.min(),i=i.copy(r.key,r.value,null,null,i.right.removeMin())}i=i.copy(null,null,null,null,i.right.remove(e,t))}return i.fixUp()}isRed(){return this.color}fixUp(){let e=this;return e.right.isRed()&&!e.left.isRed()&&(e=e.rotateLeft()),e.left.isRed()&&e.left.left.isRed()&&(e=e.rotateRight()),e.left.isRed()&&e.right.isRed()&&(e=e.colorFlip()),e}moveRedLeft(){let e=this.colorFlip();return e.right.left.isRed()&&(e=e.copy(null,null,null,null,e.right.rotateRight()),e=e.rotateLeft(),e=e.colorFlip()),e}moveRedRight(){let e=this.colorFlip();return e.left.left.isRed()&&(e=e.rotateRight(),e=e.colorFlip()),e}rotateLeft(){const e=this.copy(null,null,Re.RED,null,this.right.left);return this.right.copy(null,null,this.color,e,null)}rotateRight(){const e=this.copy(null,null,Re.RED,this.left.right,null);return this.left.copy(null,null,this.color,null,e)}colorFlip(){const e=this.left.copy(null,null,!this.left.color,null,null),t=this.right.copy(null,null,!this.right.color,null,null);return this.copy(null,null,!this.color,e,t)}checkMaxDepth(){const e=this.check();return Math.pow(2,e)<=this.size+1}check(){if(this.isRed()&&this.left.isRed())throw x(43730,{key:this.key,value:this.value});if(this.right.isRed())throw x(14113,{key:this.key,value:this.value});const e=this.left.check();if(e!==this.right.check())throw x(27949);return e+(this.isRed()?0:1)}}Re.EMPTY=null,Re.RED=!0,Re.BLACK=!1;Re.EMPTY=new class{constructor(){this.size=0}get key(){throw x(57766)}get value(){throw x(16141)}get color(){throw x(16727)}get left(){throw x(29726)}get right(){throw x(36894)}copy(e,t,r,i,s){return this}insert(e,t,r){return new Re(e,t)}remove(e,t){return this}isEmpty(){return!0}inorderTraversal(e){return!1}reverseTraversal(e){return!1}minKey(){return null}maxKey(){return null}isRed(){return!1}checkMaxDepth(){return!0}check(){return 0}};/**
 * @license
 * Copyright 2017 Google LLC
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
 */class Ee{constructor(e){this.comparator=e,this.data=new ae(this.comparator)}has(e){return this.data.get(e)!==null}first(){return this.data.minKey()}last(){return this.data.maxKey()}get size(){return this.data.size}indexOf(e){return this.data.indexOf(e)}forEach(e){this.data.inorderTraversal((t,r)=>(e(t),!1))}forEachInRange(e,t){const r=this.data.getIteratorFrom(e[0]);for(;r.hasNext();){const i=r.getNext();if(this.comparator(i.key,e[1])>=0)return;t(i.key)}}forEachWhile(e,t){let r;for(r=t!==void 0?this.data.getIteratorFrom(t):this.data.getIterator();r.hasNext();)if(!e(r.getNext().key))return}firstAfterOrEqual(e){const t=this.data.getIteratorFrom(e);return t.hasNext()?t.getNext().key:null}getIterator(){return new Xh(this.data.getIterator())}getIteratorFrom(e){return new Xh(this.data.getIteratorFrom(e))}add(e){return this.copy(this.data.remove(e).insert(e,!0))}delete(e){return this.has(e)?this.copy(this.data.remove(e)):this}isEmpty(){return this.data.isEmpty()}unionWith(e){let t=this;return t.size<e.size&&(t=e,e=this),e.forEach(r=>{t=t.add(r)}),t}isEqual(e){if(!(e instanceof Ee)||this.size!==e.size)return!1;const t=this.data.getIterator(),r=e.data.getIterator();for(;t.hasNext();){const i=t.getNext().key,s=r.getNext().key;if(this.comparator(i,s)!==0)return!1}return!0}toArray(){const e=[];return this.forEach(t=>{e.push(t)}),e}toString(){const e=[];return this.forEach(t=>e.push(t)),"SortedSet("+e.toString()+")"}copy(e){const t=new Ee(this.comparator);return t.data=e,t}}class Xh{constructor(e){this.iter=e}getNext(){return this.iter.getNext().key}hasNext(){return this.iter.hasNext()}}/**
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
 */class ot{constructor(e){this.fields=e,e.sort(Se.comparator)}static empty(){return new ot([])}unionWith(e){let t=new Ee(Se.comparator);for(const r of this.fields)t=t.add(r);for(const r of e)t=t.add(r);return new ot(t.toArray())}covers(e){for(const t of this.fields)if(t.isPrefixOf(e))return!0;return!1}isEqual(e){return lr(this.fields,e.fields,(t,r)=>t.isEqual(r))}}/**
 * @license
 * Copyright 2023 Google LLC
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
 */class nm extends Error{constructor(){super(...arguments),this.name="Base64DecodeError"}}/**
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
 */class ke{constructor(e){this.binaryString=e}static fromBase64String(e){const t=function(i){try{return atob(i)}catch(s){throw typeof DOMException<"u"&&s instanceof DOMException?new nm("Invalid base64 string: "+s):s}}(e);return new ke(t)}static fromUint8Array(e){const t=function(i){let s="";for(let a=0;a<i.length;++a)s+=String.fromCharCode(i[a]);return s}(e);return new ke(t)}[Symbol.iterator](){let e=0;return{next:()=>e<this.binaryString.length?{value:this.binaryString.charCodeAt(e++),done:!1}:{value:void 0,done:!0}}}toBase64(){return function(t){return btoa(t)}(this.binaryString)}toUint8Array(){return function(t){const r=new Uint8Array(t.length);for(let i=0;i<t.length;i++)r[i]=t.charCodeAt(i);return r}(this.binaryString)}approximateByteSize(){return 2*this.binaryString.length}compareTo(e){return W(this.binaryString,e.binaryString)}isEqual(e){return this.binaryString===e.binaryString}}ke.EMPTY_BYTE_STRING=new ke("");const vA=new RegExp(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.(\d+))?Z$/);function on(n){if(Q(!!n,39018),typeof n=="string"){let e=0;const t=vA.exec(n);if(Q(!!t,46558,{timestamp:n}),t[1]){let i=t[1];i=(i+"000000000").substr(0,9),e=Number(i)}const r=new Date(n);return{seconds:Math.floor(r.getTime()/1e3),nanos:e}}return{seconds:de(n.seconds),nanos:de(n.nanos)}}function de(n){return typeof n=="number"?n:typeof n=="string"?Number(n):0}function an(n){return typeof n=="string"?ke.fromBase64String(n):ke.fromUint8Array(n)}/**
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
 */const rm="server_timestamp",im="__type__",sm="__previous_value__",om="__local_write_time__";function Jc(n){var t,r;return((r=(((t=n==null?void 0:n.mapValue)==null?void 0:t.fields)||{})[im])==null?void 0:r.stringValue)===rm}function Io(n){const e=n.mapValue.fields[sm];return Jc(e)?Io(e):e}function vi(n){const e=on(n.mapValue.fields[om].timestampValue);return new ee(e.seconds,e.nanos)}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class AA{constructor(e,t,r,i,s,a,c,u,h,f,m){this.databaseId=e,this.appId=t,this.persistenceKey=r,this.host=i,this.ssl=s,this.forceLongPolling=a,this.autoDetectLongPolling=c,this.longPollingOptions=u,this.useFetchStreams=h,this.isUsingEmulator=f,this.apiKey=m}}const $s="(default)";class Ai{constructor(e,t){this.projectId=e,this.database=t||$s}static empty(){return new Ai("","")}get isDefaultDatabase(){return this.database===$s}isEqual(e){return e instanceof Ai&&e.projectId===this.projectId&&e.database===this.database}}function RA(n,e){if(!Object.prototype.hasOwnProperty.apply(n.options,["projectId"]))throw new O(S.INVALID_ARGUMENT,'"projectId" not provided in firebase.initializeApp.');return new Ai(n.options.projectId,e)}/**
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
 */const am="__type__",bA="__max__",hs={mapValue:{}},cm="__vector__",qs="value";function cn(n){return"nullValue"in n?0:"booleanValue"in n?1:"integerValue"in n||"doubleValue"in n?2:"timestampValue"in n?3:"stringValue"in n?5:"bytesValue"in n?6:"referenceValue"in n?7:"geoPointValue"in n?8:"arrayValue"in n?9:"mapValue"in n?Jc(n)?4:PA(n)?9007199254740991:SA(n)?10:11:x(28295,{value:n})}function Tt(n,e){if(n===e)return!0;const t=cn(n);if(t!==cn(e))return!1;switch(t){case 0:case 9007199254740991:return!0;case 1:return n.booleanValue===e.booleanValue;case 4:return vi(n).isEqual(vi(e));case 3:return function(i,s){if(typeof i.timestampValue=="string"&&typeof s.timestampValue=="string"&&i.timestampValue.length===s.timestampValue.length)return i.timestampValue===s.timestampValue;const a=on(i.timestampValue),c=on(s.timestampValue);return a.seconds===c.seconds&&a.nanos===c.nanos}(n,e);case 5:return n.stringValue===e.stringValue;case 6:return function(i,s){return an(i.bytesValue).isEqual(an(s.bytesValue))}(n,e);case 7:return n.referenceValue===e.referenceValue;case 8:return function(i,s){return de(i.geoPointValue.latitude)===de(s.geoPointValue.latitude)&&de(i.geoPointValue.longitude)===de(s.geoPointValue.longitude)}(n,e);case 2:return function(i,s){if("integerValue"in i&&"integerValue"in s)return de(i.integerValue)===de(s.integerValue);if("doubleValue"in i&&"doubleValue"in s){const a=de(i.doubleValue),c=de(s.doubleValue);return a===c?Bs(a)===Bs(c):isNaN(a)&&isNaN(c)}return!1}(n,e);case 9:return lr(n.arrayValue.values||[],e.arrayValue.values||[],Tt);case 10:case 11:return function(i,s){const a=i.mapValue.fields||{},c=s.mapValue.fields||{};if(Jh(a)!==Jh(c))return!1;for(const u in a)if(a.hasOwnProperty(u)&&(c[u]===void 0||!Tt(a[u],c[u])))return!1;return!0}(n,e);default:return x(52216,{left:n})}}function Ri(n,e){return(n.values||[]).find(t=>Tt(t,e))!==void 0}function hr(n,e){if(n===e)return 0;const t=cn(n),r=cn(e);if(t!==r)return W(t,r);switch(t){case 0:case 9007199254740991:return 0;case 1:return W(n.booleanValue,e.booleanValue);case 2:return function(s,a){const c=de(s.integerValue||s.doubleValue),u=de(a.integerValue||a.doubleValue);return c<u?-1:c>u?1:c===u?0:isNaN(c)?isNaN(u)?0:-1:1}(n,e);case 3:return Zh(n.timestampValue,e.timestampValue);case 4:return Zh(vi(n),vi(e));case 5:return ec(n.stringValue,e.stringValue);case 6:return function(s,a){const c=an(s),u=an(a);return c.compareTo(u)}(n.bytesValue,e.bytesValue);case 7:return function(s,a){const c=s.split("/"),u=a.split("/");for(let h=0;h<c.length&&h<u.length;h++){const f=W(c[h],u[h]);if(f!==0)return f}return W(c.length,u.length)}(n.referenceValue,e.referenceValue);case 8:return function(s,a){const c=W(de(s.latitude),de(a.latitude));return c!==0?c:W(de(s.longitude),de(a.longitude))}(n.geoPointValue,e.geoPointValue);case 9:return ed(n.arrayValue,e.arrayValue);case 10:return function(s,a){var y,b,k,V;const c=s.fields||{},u=a.fields||{},h=(y=c[qs])==null?void 0:y.arrayValue,f=(b=u[qs])==null?void 0:b.arrayValue,m=W(((k=h==null?void 0:h.values)==null?void 0:k.length)||0,((V=f==null?void 0:f.values)==null?void 0:V.length)||0);return m!==0?m:ed(h,f)}(n.mapValue,e.mapValue);case 11:return function(s,a){if(s===hs.mapValue&&a===hs.mapValue)return 0;if(s===hs.mapValue)return 1;if(a===hs.mapValue)return-1;const c=s.fields||{},u=Object.keys(c),h=a.fields||{},f=Object.keys(h);u.sort(),f.sort();for(let m=0;m<u.length&&m<f.length;++m){const y=ec(u[m],f[m]);if(y!==0)return y;const b=hr(c[u[m]],h[f[m]]);if(b!==0)return b}return W(u.length,f.length)}(n.mapValue,e.mapValue);default:throw x(23264,{he:t})}}function Zh(n,e){if(typeof n=="string"&&typeof e=="string"&&n.length===e.length)return W(n,e);const t=on(n),r=on(e),i=W(t.seconds,r.seconds);return i!==0?i:W(t.nanos,r.nanos)}function ed(n,e){const t=n.values||[],r=e.values||[];for(let i=0;i<t.length&&i<r.length;++i){const s=hr(t[i],r[i]);if(s)return s}return W(t.length,r.length)}function dr(n){return tc(n)}function tc(n){return"nullValue"in n?"null":"booleanValue"in n?""+n.booleanValue:"integerValue"in n?""+n.integerValue:"doubleValue"in n?""+n.doubleValue:"timestampValue"in n?function(t){const r=on(t);return`time(${r.seconds},${r.nanos})`}(n.timestampValue):"stringValue"in n?n.stringValue:"bytesValue"in n?function(t){return an(t).toBase64()}(n.bytesValue):"referenceValue"in n?function(t){return U.fromName(t).toString()}(n.referenceValue):"geoPointValue"in n?function(t){return`geo(${t.latitude},${t.longitude})`}(n.geoPointValue):"arrayValue"in n?function(t){let r="[",i=!0;for(const s of t.values||[])i?i=!1:r+=",",r+=tc(s);return r+"]"}(n.arrayValue):"mapValue"in n?function(t){const r=Object.keys(t.fields||{}).sort();let i="{",s=!0;for(const a of r)s?s=!1:i+=",",i+=`${a}:${tc(t.fields[a])}`;return i+"}"}(n.mapValue):x(61005,{value:n})}function Rs(n){switch(cn(n)){case 0:case 1:return 4;case 2:return 8;case 3:case 8:return 16;case 4:const e=Io(n);return e?16+Rs(e):16;case 5:return 2*n.stringValue.length;case 6:return an(n.bytesValue).approximateByteSize();case 7:return n.referenceValue.length;case 9:return function(r){return(r.values||[]).reduce((i,s)=>i+Rs(s),0)}(n.arrayValue);case 10:case 11:return function(r){let i=0;return Ln(r.fields,(s,a)=>{i+=s.length+Rs(a)}),i}(n.mapValue);default:throw x(13486,{value:n})}}function td(n,e){return{referenceValue:`projects/${n.projectId}/databases/${n.database}/documents/${e.path.canonicalString()}`}}function nc(n){return!!n&&"integerValue"in n}function Xc(n){return!!n&&"arrayValue"in n}function nd(n){return!!n&&"nullValue"in n}function rd(n){return!!n&&"doubleValue"in n&&isNaN(Number(n.doubleValue))}function bs(n){return!!n&&"mapValue"in n}function SA(n){var t,r;return((r=(((t=n==null?void 0:n.mapValue)==null?void 0:t.fields)||{})[am])==null?void 0:r.stringValue)===cm}function ci(n){if(n.geoPointValue)return{geoPointValue:{...n.geoPointValue}};if(n.timestampValue&&typeof n.timestampValue=="object")return{timestampValue:{...n.timestampValue}};if(n.mapValue){const e={mapValue:{fields:{}}};return Ln(n.mapValue.fields,(t,r)=>e.mapValue.fields[t]=ci(r)),e}if(n.arrayValue){const e={arrayValue:{values:[]}};for(let t=0;t<(n.arrayValue.values||[]).length;++t)e.arrayValue.values[t]=ci(n.arrayValue.values[t]);return e}return{...n}}function PA(n){return(((n.mapValue||{}).fields||{}).__type__||{}).stringValue===bA}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class et{constructor(e){this.value=e}static empty(){return new et({mapValue:{}})}field(e){if(e.isEmpty())return this.value;{let t=this.value;for(let r=0;r<e.length-1;++r)if(t=(t.mapValue.fields||{})[e.get(r)],!bs(t))return null;return t=(t.mapValue.fields||{})[e.lastSegment()],t||null}}set(e,t){this.getFieldsMap(e.popLast())[e.lastSegment()]=ci(t)}setAll(e){let t=Se.emptyPath(),r={},i=[];e.forEach((a,c)=>{if(!t.isImmediateParentOf(c)){const u=this.getFieldsMap(t);this.applyChanges(u,r,i),r={},i=[],t=c.popLast()}a?r[c.lastSegment()]=ci(a):i.push(c.lastSegment())});const s=this.getFieldsMap(t);this.applyChanges(s,r,i)}delete(e){const t=this.field(e.popLast());bs(t)&&t.mapValue.fields&&delete t.mapValue.fields[e.lastSegment()]}isEqual(e){return Tt(this.value,e.value)}getFieldsMap(e){let t=this.value;t.mapValue.fields||(t.mapValue={fields:{}});for(let r=0;r<e.length;++r){let i=t.mapValue.fields[e.get(r)];bs(i)&&i.mapValue.fields||(i={mapValue:{fields:{}}},t.mapValue.fields[e.get(r)]=i),t=i}return t.mapValue.fields}applyChanges(e,t,r){Ln(t,(i,s)=>e[i]=s);for(const i of r)delete e[i]}clone(){return new et(ci(this.value))}}function um(n){const e=[];return Ln(n.fields,(t,r)=>{const i=new Se([t]);if(bs(r)){const s=um(r.mapValue).fields;if(s.length===0)e.push(i);else for(const a of s)e.push(i.child(a))}else e.push(i)}),new ot(e)}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class Oe{constructor(e,t,r,i,s,a,c){this.key=e,this.documentType=t,this.version=r,this.readTime=i,this.createTime=s,this.data=a,this.documentState=c}static newInvalidDocument(e){return new Oe(e,0,B.min(),B.min(),B.min(),et.empty(),0)}static newFoundDocument(e,t,r,i){return new Oe(e,1,t,B.min(),r,i,0)}static newNoDocument(e,t){return new Oe(e,2,t,B.min(),B.min(),et.empty(),0)}static newUnknownDocument(e,t){return new Oe(e,3,t,B.min(),B.min(),et.empty(),2)}convertToFoundDocument(e,t){return!this.createTime.isEqual(B.min())||this.documentType!==2&&this.documentType!==0||(this.createTime=e),this.version=e,this.documentType=1,this.data=t,this.documentState=0,this}convertToNoDocument(e){return this.version=e,this.documentType=2,this.data=et.empty(),this.documentState=0,this}convertToUnknownDocument(e){return this.version=e,this.documentType=3,this.data=et.empty(),this.documentState=2,this}setHasCommittedMutations(){return this.documentState=2,this}setHasLocalMutations(){return this.documentState=1,this.version=B.min(),this}setReadTime(e){return this.readTime=e,this}get hasLocalMutations(){return this.documentState===1}get hasCommittedMutations(){return this.documentState===2}get hasPendingWrites(){return this.hasLocalMutations||this.hasCommittedMutations}isValidDocument(){return this.documentType!==0}isFoundDocument(){return this.documentType===1}isNoDocument(){return this.documentType===2}isUnknownDocument(){return this.documentType===3}isEqual(e){return e instanceof Oe&&this.key.isEqual(e.key)&&this.version.isEqual(e.version)&&this.documentType===e.documentType&&this.documentState===e.documentState&&this.data.isEqual(e.data)}mutableCopy(){return new Oe(this.key,this.documentType,this.version,this.readTime,this.createTime,this.data.clone(),this.documentState)}toString(){return`Document(${this.key}, ${this.version}, ${JSON.stringify(this.data.value)}, {createTime: ${this.createTime}}), {documentType: ${this.documentType}}), {documentState: ${this.documentState}})`}}/**
 * @license
 * Copyright 2022 Google LLC
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
 */class js{constructor(e,t){this.position=e,this.inclusive=t}}function id(n,e,t){let r=0;for(let i=0;i<n.position.length;i++){const s=e[i],a=n.position[i];if(s.field.isKeyField()?r=U.comparator(U.fromName(a.referenceValue),t.key):r=hr(a,t.data.field(s.field)),s.dir==="desc"&&(r*=-1),r!==0)break}return r}function sd(n,e){if(n===null)return e===null;if(e===null||n.inclusive!==e.inclusive||n.position.length!==e.position.length)return!1;for(let t=0;t<n.position.length;t++)if(!Tt(n.position[t],e.position[t]))return!1;return!0}/**
 * @license
 * Copyright 2022 Google LLC
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
 */class bi{constructor(e,t="asc"){this.field=e,this.dir=t}}function CA(n,e){return n.dir===e.dir&&n.field.isEqual(e.field)}/**
 * @license
 * Copyright 2022 Google LLC
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
 */class lm{}class me extends lm{constructor(e,t,r){super(),this.field=e,this.op=t,this.value=r}static create(e,t,r){return e.isKeyField()?t==="in"||t==="not-in"?this.createKeyFieldInFilter(e,t,r):new NA(e,t,r):t==="array-contains"?new VA(e,r):t==="in"?new MA(e,r):t==="not-in"?new LA(e,r):t==="array-contains-any"?new UA(e,r):new me(e,t,r)}static createKeyFieldInFilter(e,t,r){return t==="in"?new DA(e,r):new OA(e,r)}matches(e){const t=e.data.field(this.field);return this.op==="!="?t!==null&&t.nullValue===void 0&&this.matchesComparison(hr(t,this.value)):t!==null&&cn(this.value)===cn(t)&&this.matchesComparison(hr(t,this.value))}matchesComparison(e){switch(this.op){case"<":return e<0;case"<=":return e<=0;case"==":return e===0;case"!=":return e!==0;case">":return e>0;case">=":return e>=0;default:return x(47266,{operator:this.op})}}isInequality(){return["<","<=",">",">=","!=","not-in"].indexOf(this.op)>=0}getFlattenedFilters(){return[this]}getFilters(){return[this]}}class ut extends lm{constructor(e,t){super(),this.filters=e,this.op=t,this.Pe=null}static create(e,t){return new ut(e,t)}matches(e){return hm(this)?this.filters.find(t=>!t.matches(e))===void 0:this.filters.find(t=>t.matches(e))!==void 0}getFlattenedFilters(){return this.Pe!==null||(this.Pe=this.filters.reduce((e,t)=>e.concat(t.getFlattenedFilters()),[])),this.Pe}getFilters(){return Object.assign([],this.filters)}}function hm(n){return n.op==="and"}function dm(n){return kA(n)&&hm(n)}function kA(n){for(const e of n.filters)if(e instanceof ut)return!1;return!0}function rc(n){if(n instanceof me)return n.field.canonicalString()+n.op.toString()+dr(n.value);if(dm(n))return n.filters.map(e=>rc(e)).join(",");{const e=n.filters.map(t=>rc(t)).join(",");return`${n.op}(${e})`}}function fm(n,e){return n instanceof me?function(r,i){return i instanceof me&&r.op===i.op&&r.field.isEqual(i.field)&&Tt(r.value,i.value)}(n,e):n instanceof ut?function(r,i){return i instanceof ut&&r.op===i.op&&r.filters.length===i.filters.length?r.filters.reduce((s,a,c)=>s&&fm(a,i.filters[c]),!0):!1}(n,e):void x(19439)}function pm(n){return n instanceof me?function(t){return`${t.field.canonicalString()} ${t.op} ${dr(t.value)}`}(n):n instanceof ut?function(t){return t.op.toString()+" {"+t.getFilters().map(pm).join(" ,")+"}"}(n):"Filter"}class NA extends me{constructor(e,t,r){super(e,t,r),this.key=U.fromName(r.referenceValue)}matches(e){const t=U.comparator(e.key,this.key);return this.matchesComparison(t)}}class DA extends me{constructor(e,t){super(e,"in",t),this.keys=mm("in",t)}matches(e){return this.keys.some(t=>t.isEqual(e.key))}}class OA extends me{constructor(e,t){super(e,"not-in",t),this.keys=mm("not-in",t)}matches(e){return!this.keys.some(t=>t.isEqual(e.key))}}function mm(n,e){var t;return(((t=e.arrayValue)==null?void 0:t.values)||[]).map(r=>U.fromName(r.referenceValue))}class VA extends me{constructor(e,t){super(e,"array-contains",t)}matches(e){const t=e.data.field(this.field);return Xc(t)&&Ri(t.arrayValue,this.value)}}class MA extends me{constructor(e,t){super(e,"in",t)}matches(e){const t=e.data.field(this.field);return t!==null&&Ri(this.value.arrayValue,t)}}class LA extends me{constructor(e,t){super(e,"not-in",t)}matches(e){if(Ri(this.value.arrayValue,{nullValue:"NULL_VALUE"}))return!1;const t=e.data.field(this.field);return t!==null&&t.nullValue===void 0&&!Ri(this.value.arrayValue,t)}}class UA extends me{constructor(e,t){super(e,"array-contains-any",t)}matches(e){const t=e.data.field(this.field);return!(!Xc(t)||!t.arrayValue.values)&&t.arrayValue.values.some(r=>Ri(this.value.arrayValue,r))}}/**
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
 */class xA{constructor(e,t=null,r=[],i=[],s=null,a=null,c=null){this.path=e,this.collectionGroup=t,this.orderBy=r,this.filters=i,this.limit=s,this.startAt=a,this.endAt=c,this.Te=null}}function od(n,e=null,t=[],r=[],i=null,s=null,a=null){return new xA(n,e,t,r,i,s,a)}function Zc(n){const e=q(n);if(e.Te===null){let t=e.path.canonicalString();e.collectionGroup!==null&&(t+="|cg:"+e.collectionGroup),t+="|f:",t+=e.filters.map(r=>rc(r)).join(","),t+="|ob:",t+=e.orderBy.map(r=>function(s){return s.field.canonicalString()+s.dir}(r)).join(","),Eo(e.limit)||(t+="|l:",t+=e.limit),e.startAt&&(t+="|lb:",t+=e.startAt.inclusive?"b:":"a:",t+=e.startAt.position.map(r=>dr(r)).join(",")),e.endAt&&(t+="|ub:",t+=e.endAt.inclusive?"a:":"b:",t+=e.endAt.position.map(r=>dr(r)).join(",")),e.Te=t}return e.Te}function eu(n,e){if(n.limit!==e.limit||n.orderBy.length!==e.orderBy.length)return!1;for(let t=0;t<n.orderBy.length;t++)if(!CA(n.orderBy[t],e.orderBy[t]))return!1;if(n.filters.length!==e.filters.length)return!1;for(let t=0;t<n.filters.length;t++)if(!fm(n.filters[t],e.filters[t]))return!1;return n.collectionGroup===e.collectionGroup&&!!n.path.isEqual(e.path)&&!!sd(n.startAt,e.startAt)&&sd(n.endAt,e.endAt)}function ic(n){return U.isDocumentKey(n.path)&&n.collectionGroup===null&&n.filters.length===0}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class br{constructor(e,t=null,r=[],i=[],s=null,a="F",c=null,u=null){this.path=e,this.collectionGroup=t,this.explicitOrderBy=r,this.filters=i,this.limit=s,this.limitType=a,this.startAt=c,this.endAt=u,this.Ie=null,this.Ee=null,this.Re=null,this.startAt,this.endAt}}function FA(n,e,t,r,i,s,a,c){return new br(n,e,t,r,i,s,a,c)}function tu(n){return new br(n)}function ad(n){return n.filters.length===0&&n.limit===null&&n.startAt==null&&n.endAt==null&&(n.explicitOrderBy.length===0||n.explicitOrderBy.length===1&&n.explicitOrderBy[0].field.isKeyField())}function BA(n){return U.isDocumentKey(n.path)&&n.collectionGroup===null&&n.filters.length===0}function gm(n){return n.collectionGroup!==null}function ui(n){const e=q(n);if(e.Ie===null){e.Ie=[];const t=new Set;for(const s of e.explicitOrderBy)e.Ie.push(s),t.add(s.field.canonicalString());const r=e.explicitOrderBy.length>0?e.explicitOrderBy[e.explicitOrderBy.length-1].dir:"asc";(function(a){let c=new Ee(Se.comparator);return a.filters.forEach(u=>{u.getFlattenedFilters().forEach(h=>{h.isInequality()&&(c=c.add(h.field))})}),c})(e).forEach(s=>{t.has(s.canonicalString())||s.isKeyField()||e.Ie.push(new bi(s,r))}),t.has(Se.keyField().canonicalString())||e.Ie.push(new bi(Se.keyField(),r))}return e.Ie}function mt(n){const e=q(n);return e.Ee||(e.Ee=$A(e,ui(n))),e.Ee}function $A(n,e){if(n.limitType==="F")return od(n.path,n.collectionGroup,e,n.filters,n.limit,n.startAt,n.endAt);{e=e.map(i=>{const s=i.dir==="desc"?"asc":"desc";return new bi(i.field,s)});const t=n.endAt?new js(n.endAt.position,n.endAt.inclusive):null,r=n.startAt?new js(n.startAt.position,n.startAt.inclusive):null;return od(n.path,n.collectionGroup,e,n.filters,n.limit,t,r)}}function sc(n,e){const t=n.filters.concat([e]);return new br(n.path,n.collectionGroup,n.explicitOrderBy.slice(),t,n.limit,n.limitType,n.startAt,n.endAt)}function qA(n,e){const t=n.explicitOrderBy.concat([e]);return new br(n.path,n.collectionGroup,t,n.filters.slice(),n.limit,n.limitType,n.startAt,n.endAt)}function oc(n,e,t){return new br(n.path,n.collectionGroup,n.explicitOrderBy.slice(),n.filters.slice(),e,t,n.startAt,n.endAt)}function wo(n,e){return eu(mt(n),mt(e))&&n.limitType===e.limitType}function _m(n){return`${Zc(mt(n))}|lt:${n.limitType}`}function Wn(n){return`Query(target=${function(t){let r=t.path.canonicalString();return t.collectionGroup!==null&&(r+=" collectionGroup="+t.collectionGroup),t.filters.length>0&&(r+=`, filters: [${t.filters.map(i=>pm(i)).join(", ")}]`),Eo(t.limit)||(r+=", limit: "+t.limit),t.orderBy.length>0&&(r+=`, orderBy: [${t.orderBy.map(i=>function(a){return`${a.field.canonicalString()} (${a.dir})`}(i)).join(", ")}]`),t.startAt&&(r+=", startAt: ",r+=t.startAt.inclusive?"b:":"a:",r+=t.startAt.position.map(i=>dr(i)).join(",")),t.endAt&&(r+=", endAt: ",r+=t.endAt.inclusive?"a:":"b:",r+=t.endAt.position.map(i=>dr(i)).join(",")),`Target(${r})`}(mt(n))}; limitType=${n.limitType})`}function vo(n,e){return e.isFoundDocument()&&function(r,i){const s=i.key.path;return r.collectionGroup!==null?i.key.hasCollectionId(r.collectionGroup)&&r.path.isPrefixOf(s):U.isDocumentKey(r.path)?r.path.isEqual(s):r.path.isImmediateParentOf(s)}(n,e)&&function(r,i){for(const s of ui(r))if(!s.field.isKeyField()&&i.data.field(s.field)===null)return!1;return!0}(n,e)&&function(r,i){for(const s of r.filters)if(!s.matches(i))return!1;return!0}(n,e)&&function(r,i){return!(r.startAt&&!function(a,c,u){const h=id(a,c,u);return a.inclusive?h<=0:h<0}(r.startAt,ui(r),i)||r.endAt&&!function(a,c,u){const h=id(a,c,u);return a.inclusive?h>=0:h>0}(r.endAt,ui(r),i))}(n,e)}function jA(n){return n.collectionGroup||(n.path.length%2==1?n.path.lastSegment():n.path.get(n.path.length-2))}function ym(n){return(e,t)=>{let r=!1;for(const i of ui(n)){const s=HA(i,e,t);if(s!==0)return s;r=r||i.field.isKeyField()}return 0}}function HA(n,e,t){const r=n.field.isKeyField()?U.comparator(e.key,t.key):function(s,a,c){const u=a.data.field(s),h=c.data.field(s);return u!==null&&h!==null?hr(u,h):x(42886)}(n.field,e,t);switch(n.dir){case"asc":return r;case"desc":return-1*r;default:return x(19790,{direction:n.dir})}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class Un{constructor(e,t){this.mapKeyFn=e,this.equalsFn=t,this.inner={},this.innerSize=0}get(e){const t=this.mapKeyFn(e),r=this.inner[t];if(r!==void 0){for(const[i,s]of r)if(this.equalsFn(i,e))return s}}has(e){return this.get(e)!==void 0}set(e,t){const r=this.mapKeyFn(e),i=this.inner[r];if(i===void 0)return this.inner[r]=[[e,t]],void this.innerSize++;for(let s=0;s<i.length;s++)if(this.equalsFn(i[s][0],e))return void(i[s]=[e,t]);i.push([e,t]),this.innerSize++}delete(e){const t=this.mapKeyFn(e),r=this.inner[t];if(r===void 0)return!1;for(let i=0;i<r.length;i++)if(this.equalsFn(r[i][0],e))return r.length===1?delete this.inner[t]:r.splice(i,1),this.innerSize--,!0;return!1}forEach(e){Ln(this.inner,(t,r)=>{for(const[i,s]of r)e(i,s)})}isEmpty(){return tm(this.inner)}size(){return this.innerSize}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */const zA=new ae(U.comparator);function Ut(){return zA}const Tm=new ae(U.comparator);function ei(...n){let e=Tm;for(const t of n)e=e.insert(t.key,t);return e}function Em(n){let e=Tm;return n.forEach((t,r)=>e=e.insert(t,r.overlayedDocument)),e}function vn(){return li()}function Im(){return li()}function li(){return new Un(n=>n.toString(),(n,e)=>n.isEqual(e))}const WA=new ae(U.comparator),GA=new Ee(U.comparator);function G(...n){let e=GA;for(const t of n)e=e.add(t);return e}const KA=new Ee(W);function YA(){return KA}/**
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
 */function nu(n,e){if(n.useProto3Json){if(isNaN(e))return{doubleValue:"NaN"};if(e===1/0)return{doubleValue:"Infinity"};if(e===-1/0)return{doubleValue:"-Infinity"}}return{doubleValue:Bs(e)?"-0":e}}function wm(n){return{integerValue:""+n}}function QA(n,e){return EA(e)?wm(e):nu(n,e)}/**
 * @license
 * Copyright 2018 Google LLC
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
 */class Ao{constructor(){this._=void 0}}function JA(n,e,t){return n instanceof Hs?function(i,s){const a={fields:{[im]:{stringValue:rm},[om]:{timestampValue:{seconds:i.seconds,nanos:i.nanoseconds}}}};return s&&Jc(s)&&(s=Io(s)),s&&(a.fields[sm]=s),{mapValue:a}}(t,e):n instanceof Si?Am(n,e):n instanceof Pi?Rm(n,e):function(i,s){const a=vm(i,s),c=cd(a)+cd(i.Ae);return nc(a)&&nc(i.Ae)?wm(c):nu(i.serializer,c)}(n,e)}function XA(n,e,t){return n instanceof Si?Am(n,e):n instanceof Pi?Rm(n,e):t}function vm(n,e){return n instanceof zs?function(r){return nc(r)||function(s){return!!s&&"doubleValue"in s}(r)}(e)?e:{integerValue:0}:null}class Hs extends Ao{}class Si extends Ao{constructor(e){super(),this.elements=e}}function Am(n,e){const t=bm(e);for(const r of n.elements)t.some(i=>Tt(i,r))||t.push(r);return{arrayValue:{values:t}}}class Pi extends Ao{constructor(e){super(),this.elements=e}}function Rm(n,e){let t=bm(e);for(const r of n.elements)t=t.filter(i=>!Tt(i,r));return{arrayValue:{values:t}}}class zs extends Ao{constructor(e,t){super(),this.serializer=e,this.Ae=t}}function cd(n){return de(n.integerValue||n.doubleValue)}function bm(n){return Xc(n)&&n.arrayValue.values?n.arrayValue.values.slice():[]}function ZA(n,e){return n.field.isEqual(e.field)&&function(r,i){return r instanceof Si&&i instanceof Si||r instanceof Pi&&i instanceof Pi?lr(r.elements,i.elements,Tt):r instanceof zs&&i instanceof zs?Tt(r.Ae,i.Ae):r instanceof Hs&&i instanceof Hs}(n.transform,e.transform)}class eR{constructor(e,t){this.version=e,this.transformResults=t}}class at{constructor(e,t){this.updateTime=e,this.exists=t}static none(){return new at}static exists(e){return new at(void 0,e)}static updateTime(e){return new at(e)}get isNone(){return this.updateTime===void 0&&this.exists===void 0}isEqual(e){return this.exists===e.exists&&(this.updateTime?!!e.updateTime&&this.updateTime.isEqual(e.updateTime):!e.updateTime)}}function Ss(n,e){return n.updateTime!==void 0?e.isFoundDocument()&&e.version.isEqual(n.updateTime):n.exists===void 0||n.exists===e.isFoundDocument()}class Ro{}function Sm(n,e){if(!n.hasLocalMutations||e&&e.fields.length===0)return null;if(e===null)return n.isNoDocument()?new ru(n.key,at.none()):new xi(n.key,n.data,at.none());{const t=n.data,r=et.empty();let i=new Ee(Se.comparator);for(let s of e.fields)if(!i.has(s)){let a=t.field(s);a===null&&s.length>1&&(s=s.popLast(),a=t.field(s)),a===null?r.delete(s):r.set(s,a),i=i.add(s)}return new xn(n.key,r,new ot(i.toArray()),at.none())}}function tR(n,e,t){n instanceof xi?function(i,s,a){const c=i.value.clone(),u=ld(i.fieldTransforms,s,a.transformResults);c.setAll(u),s.convertToFoundDocument(a.version,c).setHasCommittedMutations()}(n,e,t):n instanceof xn?function(i,s,a){if(!Ss(i.precondition,s))return void s.convertToUnknownDocument(a.version);const c=ld(i.fieldTransforms,s,a.transformResults),u=s.data;u.setAll(Pm(i)),u.setAll(c),s.convertToFoundDocument(a.version,u).setHasCommittedMutations()}(n,e,t):function(i,s,a){s.convertToNoDocument(a.version).setHasCommittedMutations()}(0,e,t)}function hi(n,e,t,r){return n instanceof xi?function(s,a,c,u){if(!Ss(s.precondition,a))return c;const h=s.value.clone(),f=hd(s.fieldTransforms,u,a);return h.setAll(f),a.convertToFoundDocument(a.version,h).setHasLocalMutations(),null}(n,e,t,r):n instanceof xn?function(s,a,c,u){if(!Ss(s.precondition,a))return c;const h=hd(s.fieldTransforms,u,a),f=a.data;return f.setAll(Pm(s)),f.setAll(h),a.convertToFoundDocument(a.version,f).setHasLocalMutations(),c===null?null:c.unionWith(s.fieldMask.fields).unionWith(s.fieldTransforms.map(m=>m.field))}(n,e,t,r):function(s,a,c){return Ss(s.precondition,a)?(a.convertToNoDocument(a.version).setHasLocalMutations(),null):c}(n,e,t)}function nR(n,e){let t=null;for(const r of n.fieldTransforms){const i=e.data.field(r.field),s=vm(r.transform,i||null);s!=null&&(t===null&&(t=et.empty()),t.set(r.field,s))}return t||null}function ud(n,e){return n.type===e.type&&!!n.key.isEqual(e.key)&&!!n.precondition.isEqual(e.precondition)&&!!function(r,i){return r===void 0&&i===void 0||!(!r||!i)&&lr(r,i,(s,a)=>ZA(s,a))}(n.fieldTransforms,e.fieldTransforms)&&(n.type===0?n.value.isEqual(e.value):n.type!==1||n.data.isEqual(e.data)&&n.fieldMask.isEqual(e.fieldMask))}class xi extends Ro{constructor(e,t,r,i=[]){super(),this.key=e,this.value=t,this.precondition=r,this.fieldTransforms=i,this.type=0}getFieldMask(){return null}}class xn extends Ro{constructor(e,t,r,i,s=[]){super(),this.key=e,this.data=t,this.fieldMask=r,this.precondition=i,this.fieldTransforms=s,this.type=1}getFieldMask(){return this.fieldMask}}function Pm(n){const e=new Map;return n.fieldMask.fields.forEach(t=>{if(!t.isEmpty()){const r=n.data.field(t);e.set(t,r)}}),e}function ld(n,e,t){const r=new Map;Q(n.length===t.length,32656,{Ve:t.length,de:n.length});for(let i=0;i<t.length;i++){const s=n[i],a=s.transform,c=e.data.field(s.field);r.set(s.field,XA(a,c,t[i]))}return r}function hd(n,e,t){const r=new Map;for(const i of n){const s=i.transform,a=t.data.field(i.field);r.set(i.field,JA(s,a,e))}return r}class ru extends Ro{constructor(e,t){super(),this.key=e,this.precondition=t,this.type=2,this.fieldTransforms=[]}getFieldMask(){return null}}class rR extends Ro{constructor(e,t){super(),this.key=e,this.precondition=t,this.type=3,this.fieldTransforms=[]}getFieldMask(){return null}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class iR{constructor(e,t,r,i){this.batchId=e,this.localWriteTime=t,this.baseMutations=r,this.mutations=i}applyToRemoteDocument(e,t){const r=t.mutationResults;for(let i=0;i<this.mutations.length;i++){const s=this.mutations[i];s.key.isEqual(e.key)&&tR(s,e,r[i])}}applyToLocalView(e,t){for(const r of this.baseMutations)r.key.isEqual(e.key)&&(t=hi(r,e,t,this.localWriteTime));for(const r of this.mutations)r.key.isEqual(e.key)&&(t=hi(r,e,t,this.localWriteTime));return t}applyToLocalDocumentSet(e,t){const r=Im();return this.mutations.forEach(i=>{const s=e.get(i.key),a=s.overlayedDocument;let c=this.applyToLocalView(a,s.mutatedFields);c=t.has(i.key)?null:c;const u=Sm(a,c);u!==null&&r.set(i.key,u),a.isValidDocument()||a.convertToNoDocument(B.min())}),r}keys(){return this.mutations.reduce((e,t)=>e.add(t.key),G())}isEqual(e){return this.batchId===e.batchId&&lr(this.mutations,e.mutations,(t,r)=>ud(t,r))&&lr(this.baseMutations,e.baseMutations,(t,r)=>ud(t,r))}}class iu{constructor(e,t,r,i){this.batch=e,this.commitVersion=t,this.mutationResults=r,this.docVersions=i}static from(e,t,r){Q(e.mutations.length===r.length,58842,{me:e.mutations.length,fe:r.length});let i=function(){return WA}();const s=e.mutations;for(let a=0;a<s.length;a++)i=i.insert(s[a].key,r[a].version);return new iu(e,t,r,i)}}/**
 * @license
 * Copyright 2022 Google LLC
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
 */class sR{constructor(e,t){this.largestBatchId=e,this.mutation=t}getKey(){return this.mutation.key}isEqual(e){return e!==null&&this.mutation===e.mutation}toString(){return`Overlay{
      largestBatchId: ${this.largestBatchId},
      mutation: ${this.mutation.toString()}
    }`}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class oR{constructor(e,t){this.count=e,this.unchangedNames=t}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */var fe,K;function aR(n){switch(n){case S.OK:return x(64938);case S.CANCELLED:case S.UNKNOWN:case S.DEADLINE_EXCEEDED:case S.RESOURCE_EXHAUSTED:case S.INTERNAL:case S.UNAVAILABLE:case S.UNAUTHENTICATED:return!1;case S.INVALID_ARGUMENT:case S.NOT_FOUND:case S.ALREADY_EXISTS:case S.PERMISSION_DENIED:case S.FAILED_PRECONDITION:case S.ABORTED:case S.OUT_OF_RANGE:case S.UNIMPLEMENTED:case S.DATA_LOSS:return!0;default:return x(15467,{code:n})}}function Cm(n){if(n===void 0)return Lt("GRPC error has no .code"),S.UNKNOWN;switch(n){case fe.OK:return S.OK;case fe.CANCELLED:return S.CANCELLED;case fe.UNKNOWN:return S.UNKNOWN;case fe.DEADLINE_EXCEEDED:return S.DEADLINE_EXCEEDED;case fe.RESOURCE_EXHAUSTED:return S.RESOURCE_EXHAUSTED;case fe.INTERNAL:return S.INTERNAL;case fe.UNAVAILABLE:return S.UNAVAILABLE;case fe.UNAUTHENTICATED:return S.UNAUTHENTICATED;case fe.INVALID_ARGUMENT:return S.INVALID_ARGUMENT;case fe.NOT_FOUND:return S.NOT_FOUND;case fe.ALREADY_EXISTS:return S.ALREADY_EXISTS;case fe.PERMISSION_DENIED:return S.PERMISSION_DENIED;case fe.FAILED_PRECONDITION:return S.FAILED_PRECONDITION;case fe.ABORTED:return S.ABORTED;case fe.OUT_OF_RANGE:return S.OUT_OF_RANGE;case fe.UNIMPLEMENTED:return S.UNIMPLEMENTED;case fe.DATA_LOSS:return S.DATA_LOSS;default:return x(39323,{code:n})}}(K=fe||(fe={}))[K.OK=0]="OK",K[K.CANCELLED=1]="CANCELLED",K[K.UNKNOWN=2]="UNKNOWN",K[K.INVALID_ARGUMENT=3]="INVALID_ARGUMENT",K[K.DEADLINE_EXCEEDED=4]="DEADLINE_EXCEEDED",K[K.NOT_FOUND=5]="NOT_FOUND",K[K.ALREADY_EXISTS=6]="ALREADY_EXISTS",K[K.PERMISSION_DENIED=7]="PERMISSION_DENIED",K[K.UNAUTHENTICATED=16]="UNAUTHENTICATED",K[K.RESOURCE_EXHAUSTED=8]="RESOURCE_EXHAUSTED",K[K.FAILED_PRECONDITION=9]="FAILED_PRECONDITION",K[K.ABORTED=10]="ABORTED",K[K.OUT_OF_RANGE=11]="OUT_OF_RANGE",K[K.UNIMPLEMENTED=12]="UNIMPLEMENTED",K[K.INTERNAL=13]="INTERNAL",K[K.UNAVAILABLE=14]="UNAVAILABLE",K[K.DATA_LOSS=15]="DATA_LOSS";/**
 * @license
 * Copyright 2023 Google LLC
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
 */function cR(){return new TextEncoder}/**
 * @license
 * Copyright 2022 Google LLC
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
 */const uR=new tn([4294967295,4294967295],0);function dd(n){const e=cR().encode(n),t=new zp;return t.update(e),new Uint8Array(t.digest())}function fd(n){const e=new DataView(n.buffer),t=e.getUint32(0,!0),r=e.getUint32(4,!0),i=e.getUint32(8,!0),s=e.getUint32(12,!0);return[new tn([t,r],0),new tn([i,s],0)]}class su{constructor(e,t,r){if(this.bitmap=e,this.padding=t,this.hashCount=r,t<0||t>=8)throw new ti(`Invalid padding: ${t}`);if(r<0)throw new ti(`Invalid hash count: ${r}`);if(e.length>0&&this.hashCount===0)throw new ti(`Invalid hash count: ${r}`);if(e.length===0&&t!==0)throw new ti(`Invalid padding when bitmap length is 0: ${t}`);this.ge=8*e.length-t,this.pe=tn.fromNumber(this.ge)}ye(e,t,r){let i=e.add(t.multiply(tn.fromNumber(r)));return i.compare(uR)===1&&(i=new tn([i.getBits(0),i.getBits(1)],0)),i.modulo(this.pe).toNumber()}we(e){return!!(this.bitmap[Math.floor(e/8)]&1<<e%8)}mightContain(e){if(this.ge===0)return!1;const t=dd(e),[r,i]=fd(t);for(let s=0;s<this.hashCount;s++){const a=this.ye(r,i,s);if(!this.we(a))return!1}return!0}static create(e,t,r){const i=e%8==0?0:8-e%8,s=new Uint8Array(Math.ceil(e/8)),a=new su(s,i,t);return r.forEach(c=>a.insert(c)),a}insert(e){if(this.ge===0)return;const t=dd(e),[r,i]=fd(t);for(let s=0;s<this.hashCount;s++){const a=this.ye(r,i,s);this.be(a)}}be(e){const t=Math.floor(e/8),r=e%8;this.bitmap[t]|=1<<r}}class ti extends Error{constructor(){super(...arguments),this.name="BloomFilterError"}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class bo{constructor(e,t,r,i,s){this.snapshotVersion=e,this.targetChanges=t,this.targetMismatches=r,this.documentUpdates=i,this.resolvedLimboDocuments=s}static createSynthesizedRemoteEventForCurrentChange(e,t,r){const i=new Map;return i.set(e,Fi.createSynthesizedTargetChangeForCurrentChange(e,t,r)),new bo(B.min(),i,new ae(W),Ut(),G())}}class Fi{constructor(e,t,r,i,s){this.resumeToken=e,this.current=t,this.addedDocuments=r,this.modifiedDocuments=i,this.removedDocuments=s}static createSynthesizedTargetChangeForCurrentChange(e,t,r){return new Fi(r,t,G(),G(),G())}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class Ps{constructor(e,t,r,i){this.Se=e,this.removedTargetIds=t,this.key=r,this.De=i}}class km{constructor(e,t){this.targetId=e,this.Ce=t}}class Nm{constructor(e,t,r=ke.EMPTY_BYTE_STRING,i=null){this.state=e,this.targetIds=t,this.resumeToken=r,this.cause=i}}class pd{constructor(){this.ve=0,this.Fe=md(),this.Me=ke.EMPTY_BYTE_STRING,this.xe=!1,this.Oe=!0}get current(){return this.xe}get resumeToken(){return this.Me}get Ne(){return this.ve!==0}get Be(){return this.Oe}Le(e){e.approximateByteSize()>0&&(this.Oe=!0,this.Me=e)}ke(){let e=G(),t=G(),r=G();return this.Fe.forEach((i,s)=>{switch(s){case 0:e=e.add(i);break;case 2:t=t.add(i);break;case 1:r=r.add(i);break;default:x(38017,{changeType:s})}}),new Fi(this.Me,this.xe,e,t,r)}Ke(){this.Oe=!1,this.Fe=md()}qe(e,t){this.Oe=!0,this.Fe=this.Fe.insert(e,t)}Ue(e){this.Oe=!0,this.Fe=this.Fe.remove(e)}$e(){this.ve+=1}We(){this.ve-=1,Q(this.ve>=0,3241,{ve:this.ve})}Qe(){this.Oe=!0,this.xe=!0}}class lR{constructor(e){this.Ge=e,this.ze=new Map,this.je=Ut(),this.He=ds(),this.Je=ds(),this.Ze=new ae(W)}Xe(e){for(const t of e.Se)e.De&&e.De.isFoundDocument()?this.Ye(t,e.De):this.et(t,e.key,e.De);for(const t of e.removedTargetIds)this.et(t,e.key,e.De)}tt(e){this.forEachTarget(e,t=>{const r=this.nt(t);switch(e.state){case 0:this.rt(t)&&r.Le(e.resumeToken);break;case 1:r.We(),r.Ne||r.Ke(),r.Le(e.resumeToken);break;case 2:r.We(),r.Ne||this.removeTarget(t);break;case 3:this.rt(t)&&(r.Qe(),r.Le(e.resumeToken));break;case 4:this.rt(t)&&(this.it(t),r.Le(e.resumeToken));break;default:x(56790,{state:e.state})}})}forEachTarget(e,t){e.targetIds.length>0?e.targetIds.forEach(t):this.ze.forEach((r,i)=>{this.rt(i)&&t(i)})}st(e){const t=e.targetId,r=e.Ce.count,i=this.ot(t);if(i){const s=i.target;if(ic(s))if(r===0){const a=new U(s.path);this.et(t,a,Oe.newNoDocument(a,B.min()))}else Q(r===1,20013,{expectedCount:r});else{const a=this._t(t);if(a!==r){const c=this.ut(e),u=c?this.ct(c,e,a):1;if(u!==0){this.it(t);const h=u===2?"TargetPurposeExistenceFilterMismatchBloom":"TargetPurposeExistenceFilterMismatch";this.Ze=this.Ze.insert(t,h)}}}}}ut(e){const t=e.Ce.unchangedNames;if(!t||!t.bits)return null;const{bits:{bitmap:r="",padding:i=0},hashCount:s=0}=t;let a,c;try{a=an(r).toUint8Array()}catch(u){if(u instanceof nm)return ur("Decoding the base64 bloom filter in existence filter failed ("+u.message+"); ignoring the bloom filter and falling back to full re-query."),null;throw u}try{c=new su(a,i,s)}catch(u){return ur(u instanceof ti?"BloomFilter error: ":"Applying bloom filter failed: ",u),null}return c.ge===0?null:c}ct(e,t,r){return t.Ce.count===r-this.Pt(e,t.targetId)?0:2}Pt(e,t){const r=this.Ge.getRemoteKeysForTarget(t);let i=0;return r.forEach(s=>{const a=this.Ge.ht(),c=`projects/${a.projectId}/databases/${a.database}/documents/${s.path.canonicalString()}`;e.mightContain(c)||(this.et(t,s,null),i++)}),i}Tt(e){const t=new Map;this.ze.forEach((s,a)=>{const c=this.ot(a);if(c){if(s.current&&ic(c.target)){const u=new U(c.target.path);this.It(u).has(a)||this.Et(a,u)||this.et(a,u,Oe.newNoDocument(u,e))}s.Be&&(t.set(a,s.ke()),s.Ke())}});let r=G();this.Je.forEach((s,a)=>{let c=!0;a.forEachWhile(u=>{const h=this.ot(u);return!h||h.purpose==="TargetPurposeLimboResolution"||(c=!1,!1)}),c&&(r=r.add(s))}),this.je.forEach((s,a)=>a.setReadTime(e));const i=new bo(e,t,this.Ze,this.je,r);return this.je=Ut(),this.He=ds(),this.Je=ds(),this.Ze=new ae(W),i}Ye(e,t){if(!this.rt(e))return;const r=this.Et(e,t.key)?2:0;this.nt(e).qe(t.key,r),this.je=this.je.insert(t.key,t),this.He=this.He.insert(t.key,this.It(t.key).add(e)),this.Je=this.Je.insert(t.key,this.Rt(t.key).add(e))}et(e,t,r){if(!this.rt(e))return;const i=this.nt(e);this.Et(e,t)?i.qe(t,1):i.Ue(t),this.Je=this.Je.insert(t,this.Rt(t).delete(e)),this.Je=this.Je.insert(t,this.Rt(t).add(e)),r&&(this.je=this.je.insert(t,r))}removeTarget(e){this.ze.delete(e)}_t(e){const t=this.nt(e).ke();return this.Ge.getRemoteKeysForTarget(e).size+t.addedDocuments.size-t.removedDocuments.size}$e(e){this.nt(e).$e()}nt(e){let t=this.ze.get(e);return t||(t=new pd,this.ze.set(e,t)),t}Rt(e){let t=this.Je.get(e);return t||(t=new Ee(W),this.Je=this.Je.insert(e,t)),t}It(e){let t=this.He.get(e);return t||(t=new Ee(W),this.He=this.He.insert(e,t)),t}rt(e){const t=this.ot(e)!==null;return t||M("WatchChangeAggregator","Detected inactive target",e),t}ot(e){const t=this.ze.get(e);return t&&t.Ne?null:this.Ge.At(e)}it(e){this.ze.set(e,new pd),this.Ge.getRemoteKeysForTarget(e).forEach(t=>{this.et(e,t,null)})}Et(e,t){return this.Ge.getRemoteKeysForTarget(e).has(t)}}function ds(){return new ae(U.comparator)}function md(){return new ae(U.comparator)}const hR={asc:"ASCENDING",desc:"DESCENDING"},dR={"<":"LESS_THAN","<=":"LESS_THAN_OR_EQUAL",">":"GREATER_THAN",">=":"GREATER_THAN_OR_EQUAL","==":"EQUAL","!=":"NOT_EQUAL","array-contains":"ARRAY_CONTAINS",in:"IN","not-in":"NOT_IN","array-contains-any":"ARRAY_CONTAINS_ANY"},fR={and:"AND",or:"OR"};class pR{constructor(e,t){this.databaseId=e,this.useProto3Json=t}}function ac(n,e){return n.useProto3Json||Eo(e)?e:{value:e}}function Ws(n,e){return n.useProto3Json?`${new Date(1e3*e.seconds).toISOString().replace(/\.\d*/,"").replace("Z","")}.${("000000000"+e.nanoseconds).slice(-9)}Z`:{seconds:""+e.seconds,nanos:e.nanoseconds}}function Dm(n,e){return n.useProto3Json?e.toBase64():e.toUint8Array()}function mR(n,e){return Ws(n,e.toTimestamp())}function gt(n){return Q(!!n,49232),B.fromTimestamp(function(t){const r=on(t);return new ee(r.seconds,r.nanos)}(n))}function ou(n,e){return cc(n,e).canonicalString()}function cc(n,e){const t=function(i){return new X(["projects",i.projectId,"databases",i.database])}(n).child("documents");return e===void 0?t:t.child(e)}function Om(n){const e=X.fromString(n);return Q(xm(e),10190,{key:e.toString()}),e}function uc(n,e){return ou(n.databaseId,e.path)}function wa(n,e){const t=Om(e);if(t.get(1)!==n.databaseId.projectId)throw new O(S.INVALID_ARGUMENT,"Tried to deserialize key from different project: "+t.get(1)+" vs "+n.databaseId.projectId);if(t.get(3)!==n.databaseId.database)throw new O(S.INVALID_ARGUMENT,"Tried to deserialize key from different database: "+t.get(3)+" vs "+n.databaseId.database);return new U(Mm(t))}function Vm(n,e){return ou(n.databaseId,e)}function gR(n){const e=Om(n);return e.length===4?X.emptyPath():Mm(e)}function lc(n){return new X(["projects",n.databaseId.projectId,"databases",n.databaseId.database]).canonicalString()}function Mm(n){return Q(n.length>4&&n.get(4)==="documents",29091,{key:n.toString()}),n.popFirst(5)}function gd(n,e,t){return{name:uc(n,e),fields:t.value.mapValue.fields}}function _R(n,e){let t;if("targetChange"in e){e.targetChange;const r=function(h){return h==="NO_CHANGE"?0:h==="ADD"?1:h==="REMOVE"?2:h==="CURRENT"?3:h==="RESET"?4:x(39313,{state:h})}(e.targetChange.targetChangeType||"NO_CHANGE"),i=e.targetChange.targetIds||[],s=function(h,f){return h.useProto3Json?(Q(f===void 0||typeof f=="string",58123),ke.fromBase64String(f||"")):(Q(f===void 0||f instanceof Buffer||f instanceof Uint8Array,16193),ke.fromUint8Array(f||new Uint8Array))}(n,e.targetChange.resumeToken),a=e.targetChange.cause,c=a&&function(h){const f=h.code===void 0?S.UNKNOWN:Cm(h.code);return new O(f,h.message||"")}(a);t=new Nm(r,i,s,c||null)}else if("documentChange"in e){e.documentChange;const r=e.documentChange;r.document,r.document.name,r.document.updateTime;const i=wa(n,r.document.name),s=gt(r.document.updateTime),a=r.document.createTime?gt(r.document.createTime):B.min(),c=new et({mapValue:{fields:r.document.fields}}),u=Oe.newFoundDocument(i,s,a,c),h=r.targetIds||[],f=r.removedTargetIds||[];t=new Ps(h,f,u.key,u)}else if("documentDelete"in e){e.documentDelete;const r=e.documentDelete;r.document;const i=wa(n,r.document),s=r.readTime?gt(r.readTime):B.min(),a=Oe.newNoDocument(i,s),c=r.removedTargetIds||[];t=new Ps([],c,a.key,a)}else if("documentRemove"in e){e.documentRemove;const r=e.documentRemove;r.document;const i=wa(n,r.document),s=r.removedTargetIds||[];t=new Ps([],s,i,null)}else{if(!("filter"in e))return x(11601,{Vt:e});{e.filter;const r=e.filter;r.targetId;const{count:i=0,unchangedNames:s}=r,a=new oR(i,s),c=r.targetId;t=new km(c,a)}}return t}function yR(n,e){let t;if(e instanceof xi)t={update:gd(n,e.key,e.value)};else if(e instanceof ru)t={delete:uc(n,e.key)};else if(e instanceof xn)t={update:gd(n,e.key,e.data),updateMask:SR(e.fieldMask)};else{if(!(e instanceof rR))return x(16599,{dt:e.type});t={verify:uc(n,e.key)}}return e.fieldTransforms.length>0&&(t.updateTransforms=e.fieldTransforms.map(r=>function(s,a){const c=a.transform;if(c instanceof Hs)return{fieldPath:a.field.canonicalString(),setToServerValue:"REQUEST_TIME"};if(c instanceof Si)return{fieldPath:a.field.canonicalString(),appendMissingElements:{values:c.elements}};if(c instanceof Pi)return{fieldPath:a.field.canonicalString(),removeAllFromArray:{values:c.elements}};if(c instanceof zs)return{fieldPath:a.field.canonicalString(),increment:c.Ae};throw x(20930,{transform:a.transform})}(0,r))),e.precondition.isNone||(t.currentDocument=function(i,s){return s.updateTime!==void 0?{updateTime:mR(i,s.updateTime)}:s.exists!==void 0?{exists:s.exists}:x(27497)}(n,e.precondition)),t}function TR(n,e){return n&&n.length>0?(Q(e!==void 0,14353),n.map(t=>function(i,s){let a=i.updateTime?gt(i.updateTime):gt(s);return a.isEqual(B.min())&&(a=gt(s)),new eR(a,i.transformResults||[])}(t,e))):[]}function ER(n,e){return{documents:[Vm(n,e.path)]}}function IR(n,e){const t={structuredQuery:{}},r=e.path;let i;e.collectionGroup!==null?(i=r,t.structuredQuery.from=[{collectionId:e.collectionGroup,allDescendants:!0}]):(i=r.popLast(),t.structuredQuery.from=[{collectionId:r.lastSegment()}]),t.parent=Vm(n,i);const s=function(h){if(h.length!==0)return Um(ut.create(h,"and"))}(e.filters);s&&(t.structuredQuery.where=s);const a=function(h){if(h.length!==0)return h.map(f=>function(y){return{field:Gn(y.field),direction:AR(y.dir)}}(f))}(e.orderBy);a&&(t.structuredQuery.orderBy=a);const c=ac(n,e.limit);return c!==null&&(t.structuredQuery.limit=c),e.startAt&&(t.structuredQuery.startAt=function(h){return{before:h.inclusive,values:h.position}}(e.startAt)),e.endAt&&(t.structuredQuery.endAt=function(h){return{before:!h.inclusive,values:h.position}}(e.endAt)),{ft:t,parent:i}}function wR(n){let e=gR(n.parent);const t=n.structuredQuery,r=t.from?t.from.length:0;let i=null;if(r>0){Q(r===1,65062);const f=t.from[0];f.allDescendants?i=f.collectionId:e=e.child(f.collectionId)}let s=[];t.where&&(s=function(m){const y=Lm(m);return y instanceof ut&&dm(y)?y.getFilters():[y]}(t.where));let a=[];t.orderBy&&(a=function(m){return m.map(y=>function(k){return new bi(Kn(k.field),function(N){switch(N){case"ASCENDING":return"asc";case"DESCENDING":return"desc";default:return}}(k.direction))}(y))}(t.orderBy));let c=null;t.limit&&(c=function(m){let y;return y=typeof m=="object"?m.value:m,Eo(y)?null:y}(t.limit));let u=null;t.startAt&&(u=function(m){const y=!!m.before,b=m.values||[];return new js(b,y)}(t.startAt));let h=null;return t.endAt&&(h=function(m){const y=!m.before,b=m.values||[];return new js(b,y)}(t.endAt)),FA(e,i,a,s,c,"F",u,h)}function vR(n,e){const t=function(i){switch(i){case"TargetPurposeListen":return null;case"TargetPurposeExistenceFilterMismatch":return"existence-filter-mismatch";case"TargetPurposeExistenceFilterMismatchBloom":return"existence-filter-mismatch-bloom";case"TargetPurposeLimboResolution":return"limbo-document";default:return x(28987,{purpose:i})}}(e.purpose);return t==null?null:{"goog-listen-tags":t}}function Lm(n){return n.unaryFilter!==void 0?function(t){switch(t.unaryFilter.op){case"IS_NAN":const r=Kn(t.unaryFilter.field);return me.create(r,"==",{doubleValue:NaN});case"IS_NULL":const i=Kn(t.unaryFilter.field);return me.create(i,"==",{nullValue:"NULL_VALUE"});case"IS_NOT_NAN":const s=Kn(t.unaryFilter.field);return me.create(s,"!=",{doubleValue:NaN});case"IS_NOT_NULL":const a=Kn(t.unaryFilter.field);return me.create(a,"!=",{nullValue:"NULL_VALUE"});case"OPERATOR_UNSPECIFIED":return x(61313);default:return x(60726)}}(n):n.fieldFilter!==void 0?function(t){return me.create(Kn(t.fieldFilter.field),function(i){switch(i){case"EQUAL":return"==";case"NOT_EQUAL":return"!=";case"GREATER_THAN":return">";case"GREATER_THAN_OR_EQUAL":return">=";case"LESS_THAN":return"<";case"LESS_THAN_OR_EQUAL":return"<=";case"ARRAY_CONTAINS":return"array-contains";case"IN":return"in";case"NOT_IN":return"not-in";case"ARRAY_CONTAINS_ANY":return"array-contains-any";case"OPERATOR_UNSPECIFIED":return x(58110);default:return x(50506)}}(t.fieldFilter.op),t.fieldFilter.value)}(n):n.compositeFilter!==void 0?function(t){return ut.create(t.compositeFilter.filters.map(r=>Lm(r)),function(i){switch(i){case"AND":return"and";case"OR":return"or";default:return x(1026)}}(t.compositeFilter.op))}(n):x(30097,{filter:n})}function AR(n){return hR[n]}function RR(n){return dR[n]}function bR(n){return fR[n]}function Gn(n){return{fieldPath:n.canonicalString()}}function Kn(n){return Se.fromServerFormat(n.fieldPath)}function Um(n){return n instanceof me?function(t){if(t.op==="=="){if(rd(t.value))return{unaryFilter:{field:Gn(t.field),op:"IS_NAN"}};if(nd(t.value))return{unaryFilter:{field:Gn(t.field),op:"IS_NULL"}}}else if(t.op==="!="){if(rd(t.value))return{unaryFilter:{field:Gn(t.field),op:"IS_NOT_NAN"}};if(nd(t.value))return{unaryFilter:{field:Gn(t.field),op:"IS_NOT_NULL"}}}return{fieldFilter:{field:Gn(t.field),op:RR(t.op),value:t.value}}}(n):n instanceof ut?function(t){const r=t.getFilters().map(i=>Um(i));return r.length===1?r[0]:{compositeFilter:{op:bR(t.op),filters:r}}}(n):x(54877,{filter:n})}function SR(n){const e=[];return n.fields.forEach(t=>e.push(t.canonicalString())),{fieldPaths:e}}function xm(n){return n.length>=4&&n.get(0)==="projects"&&n.get(2)==="databases"}function Fm(n){return!!n&&typeof n._toProto=="function"&&n._protoValueType==="ProtoValue"}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class Qt{constructor(e,t,r,i,s=B.min(),a=B.min(),c=ke.EMPTY_BYTE_STRING,u=null){this.target=e,this.targetId=t,this.purpose=r,this.sequenceNumber=i,this.snapshotVersion=s,this.lastLimboFreeSnapshotVersion=a,this.resumeToken=c,this.expectedCount=u}withSequenceNumber(e){return new Qt(this.target,this.targetId,this.purpose,e,this.snapshotVersion,this.lastLimboFreeSnapshotVersion,this.resumeToken,this.expectedCount)}withResumeToken(e,t){return new Qt(this.target,this.targetId,this.purpose,this.sequenceNumber,t,this.lastLimboFreeSnapshotVersion,e,null)}withExpectedCount(e){return new Qt(this.target,this.targetId,this.purpose,this.sequenceNumber,this.snapshotVersion,this.lastLimboFreeSnapshotVersion,this.resumeToken,e)}withLastLimboFreeSnapshotVersion(e){return new Qt(this.target,this.targetId,this.purpose,this.sequenceNumber,this.snapshotVersion,e,this.resumeToken,this.expectedCount)}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class PR{constructor(e){this.yt=e}}function CR(n){const e=wR({parent:n.parent,structuredQuery:n.structuredQuery});return n.limitType==="LAST"?oc(e,e.limit,"L"):e}/**
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
 */class kR{constructor(){this.Sn=new NR}addToCollectionParentIndex(e,t){return this.Sn.add(t),P.resolve()}getCollectionParents(e,t){return P.resolve(this.Sn.getEntries(t))}addFieldIndex(e,t){return P.resolve()}deleteFieldIndex(e,t){return P.resolve()}deleteAllFieldIndexes(e){return P.resolve()}createTargetIndexes(e,t){return P.resolve()}getDocumentsMatchingTarget(e,t){return P.resolve(null)}getIndexType(e,t){return P.resolve(0)}getFieldIndexes(e,t){return P.resolve([])}getNextCollectionGroupToUpdate(e){return P.resolve(null)}getMinOffset(e,t){return P.resolve(sn.min())}getMinOffsetFromCollectionGroup(e,t){return P.resolve(sn.min())}updateCollectionGroup(e,t,r){return P.resolve()}updateIndexEntries(e,t){return P.resolve()}}class NR{constructor(){this.index={}}add(e){const t=e.lastSegment(),r=e.popLast(),i=this.index[t]||new Ee(X.comparator),s=!i.has(r);return this.index[t]=i.add(r),s}has(e){const t=e.lastSegment(),r=e.popLast(),i=this.index[t];return i&&i.has(r)}getEntries(e){return(this.index[e]||new Ee(X.comparator)).toArray()}}/**
 * @license
 * Copyright 2018 Google LLC
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
 */const _d={didRun:!1,sequenceNumbersCollected:0,targetsRemoved:0,documentsRemoved:0},Bm=41943040;class ze{static withCacheSize(e){return new ze(e,ze.DEFAULT_COLLECTION_PERCENTILE,ze.DEFAULT_MAX_SEQUENCE_NUMBERS_TO_COLLECT)}constructor(e,t,r){this.cacheSizeCollectionThreshold=e,this.percentileToCollect=t,this.maximumSequenceNumbersToCollect=r}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */ze.DEFAULT_COLLECTION_PERCENTILE=10,ze.DEFAULT_MAX_SEQUENCE_NUMBERS_TO_COLLECT=1e3,ze.DEFAULT=new ze(Bm,ze.DEFAULT_COLLECTION_PERCENTILE,ze.DEFAULT_MAX_SEQUENCE_NUMBERS_TO_COLLECT),ze.DISABLED=new ze(-1,0,0);/**
 * @license
 * Copyright 2017 Google LLC
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
 */class fr{constructor(e){this.sr=e}next(){return this.sr+=2,this.sr}static _r(){return new fr(0)}static ar(){return new fr(-1)}}/**
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
 */const yd="LruGarbageCollector",$m=1048576;function Td([n,e],[t,r]){const i=W(n,t);return i===0?W(e,r):i}class DR{constructor(e){this.Pr=e,this.buffer=new Ee(Td),this.Tr=0}Ir(){return++this.Tr}Er(e){const t=[e,this.Ir()];if(this.buffer.size<this.Pr)this.buffer=this.buffer.add(t);else{const r=this.buffer.last();Td(t,r)<0&&(this.buffer=this.buffer.delete(r).add(t))}}get maxValue(){return this.buffer.last()[0]}}class OR{constructor(e,t,r){this.garbageCollector=e,this.asyncQueue=t,this.localStore=r,this.Rr=null}start(){this.garbageCollector.params.cacheSizeCollectionThreshold!==-1&&this.Ar(6e4)}stop(){this.Rr&&(this.Rr.cancel(),this.Rr=null)}get started(){return this.Rr!==null}Ar(e){M(yd,`Garbage collection scheduled in ${e}ms`),this.Rr=this.asyncQueue.enqueueAfterDelay("lru_garbage_collection",e,async()=>{this.Rr=null;try{await this.localStore.collectGarbage(this.garbageCollector)}catch(t){Rr(t)?M(yd,"Ignoring IndexedDB error during garbage collection: ",t):await Ar(t)}await this.Ar(3e5)})}}class VR{constructor(e,t){this.Vr=e,this.params=t}calculateTargetCount(e,t){return this.Vr.dr(e).next(r=>Math.floor(t/100*r))}nthSequenceNumber(e,t){if(t===0)return P.resolve(To.ce);const r=new DR(t);return this.Vr.forEachTarget(e,i=>r.Er(i.sequenceNumber)).next(()=>this.Vr.mr(e,i=>r.Er(i))).next(()=>r.maxValue)}removeTargets(e,t,r){return this.Vr.removeTargets(e,t,r)}removeOrphanedDocuments(e,t){return this.Vr.removeOrphanedDocuments(e,t)}collect(e,t){return this.params.cacheSizeCollectionThreshold===-1?(M("LruGarbageCollector","Garbage collection skipped; disabled"),P.resolve(_d)):this.getCacheSize(e).next(r=>r<this.params.cacheSizeCollectionThreshold?(M("LruGarbageCollector",`Garbage collection skipped; Cache size ${r} is lower than threshold ${this.params.cacheSizeCollectionThreshold}`),_d):this.gr(e,t))}getCacheSize(e){return this.Vr.getCacheSize(e)}gr(e,t){let r,i,s,a,c,u,h;const f=Date.now();return this.calculateTargetCount(e,this.params.percentileToCollect).next(m=>(m>this.params.maximumSequenceNumbersToCollect?(M("LruGarbageCollector",`Capping sequence numbers to collect down to the maximum of ${this.params.maximumSequenceNumbersToCollect} from ${m}`),i=this.params.maximumSequenceNumbersToCollect):i=m,a=Date.now(),this.nthSequenceNumber(e,i))).next(m=>(r=m,c=Date.now(),this.removeTargets(e,r,t))).next(m=>(s=m,u=Date.now(),this.removeOrphanedDocuments(e,r))).next(m=>(h=Date.now(),zn()<=z.DEBUG&&M("LruGarbageCollector",`LRU Garbage Collection
	Counted targets in ${a-f}ms
	Determined least recently used ${i} in `+(c-a)+`ms
	Removed ${s} targets in `+(u-c)+`ms
	Removed ${m} documents in `+(h-u)+`ms
Total Duration: ${h-f}ms`),P.resolve({didRun:!0,sequenceNumbersCollected:i,targetsRemoved:s,documentsRemoved:m})))}}function MR(n,e){return new VR(n,e)}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class LR{constructor(){this.changes=new Un(e=>e.toString(),(e,t)=>e.isEqual(t)),this.changesApplied=!1}addEntry(e){this.assertNotApplied(),this.changes.set(e.key,e)}removeEntry(e,t){this.assertNotApplied(),this.changes.set(e,Oe.newInvalidDocument(e).setReadTime(t))}getEntry(e,t){this.assertNotApplied();const r=this.changes.get(t);return r!==void 0?P.resolve(r):this.getFromCache(e,t)}getEntries(e,t){return this.getAllFromCache(e,t)}apply(e){return this.assertNotApplied(),this.changesApplied=!0,this.applyChanges(e)}assertNotApplied(){}}/**
 * @license
 * Copyright 2017 Google LLC
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
 *//**
 * @license
 * Copyright 2022 Google LLC
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
 */class UR{constructor(e,t){this.overlayedDocument=e,this.mutatedFields=t}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class xR{constructor(e,t,r,i){this.remoteDocumentCache=e,this.mutationQueue=t,this.documentOverlayCache=r,this.indexManager=i}getDocument(e,t){let r=null;return this.documentOverlayCache.getOverlay(e,t).next(i=>(r=i,this.remoteDocumentCache.getEntry(e,t))).next(i=>(r!==null&&hi(r.mutation,i,ot.empty(),ee.now()),i))}getDocuments(e,t){return this.remoteDocumentCache.getEntries(e,t).next(r=>this.getLocalViewOfDocuments(e,r,G()).next(()=>r))}getLocalViewOfDocuments(e,t,r=G()){const i=vn();return this.populateOverlays(e,i,t).next(()=>this.computeViews(e,t,i,r).next(s=>{let a=ei();return s.forEach((c,u)=>{a=a.insert(c,u.overlayedDocument)}),a}))}getOverlayedDocuments(e,t){const r=vn();return this.populateOverlays(e,r,t).next(()=>this.computeViews(e,t,r,G()))}populateOverlays(e,t,r){const i=[];return r.forEach(s=>{t.has(s)||i.push(s)}),this.documentOverlayCache.getOverlays(e,i).next(s=>{s.forEach((a,c)=>{t.set(a,c)})})}computeViews(e,t,r,i){let s=Ut();const a=li(),c=function(){return li()}();return t.forEach((u,h)=>{const f=r.get(h.key);i.has(h.key)&&(f===void 0||f.mutation instanceof xn)?s=s.insert(h.key,h):f!==void 0?(a.set(h.key,f.mutation.getFieldMask()),hi(f.mutation,h,f.mutation.getFieldMask(),ee.now())):a.set(h.key,ot.empty())}),this.recalculateAndSaveOverlays(e,s).next(u=>(u.forEach((h,f)=>a.set(h,f)),t.forEach((h,f)=>c.set(h,new UR(f,a.get(h)??null))),c))}recalculateAndSaveOverlays(e,t){const r=li();let i=new ae((a,c)=>a-c),s=G();return this.mutationQueue.getAllMutationBatchesAffectingDocumentKeys(e,t).next(a=>{for(const c of a)c.keys().forEach(u=>{const h=t.get(u);if(h===null)return;let f=r.get(u)||ot.empty();f=c.applyToLocalView(h,f),r.set(u,f);const m=(i.get(c.batchId)||G()).add(u);i=i.insert(c.batchId,m)})}).next(()=>{const a=[],c=i.getReverseIterator();for(;c.hasNext();){const u=c.getNext(),h=u.key,f=u.value,m=Im();f.forEach(y=>{if(!s.has(y)){const b=Sm(t.get(y),r.get(y));b!==null&&m.set(y,b),s=s.add(y)}}),a.push(this.documentOverlayCache.saveOverlays(e,h,m))}return P.waitFor(a)}).next(()=>r)}recalculateAndSaveOverlaysForDocumentKeys(e,t){return this.remoteDocumentCache.getEntries(e,t).next(r=>this.recalculateAndSaveOverlays(e,r))}getDocumentsMatchingQuery(e,t,r,i){return BA(t)?this.getDocumentsMatchingDocumentQuery(e,t.path):gm(t)?this.getDocumentsMatchingCollectionGroupQuery(e,t,r,i):this.getDocumentsMatchingCollectionQuery(e,t,r,i)}getNextDocuments(e,t,r,i){return this.remoteDocumentCache.getAllFromCollectionGroup(e,t,r,i).next(s=>{const a=i-s.size>0?this.documentOverlayCache.getOverlaysForCollectionGroup(e,t,r.largestBatchId,i-s.size):P.resolve(vn());let c=wi,u=s;return a.next(h=>P.forEach(h,(f,m)=>(c<m.largestBatchId&&(c=m.largestBatchId),s.get(f)?P.resolve():this.remoteDocumentCache.getEntry(e,f).next(y=>{u=u.insert(f,y)}))).next(()=>this.populateOverlays(e,h,s)).next(()=>this.computeViews(e,u,h,G())).next(f=>({batchId:c,changes:Em(f)})))})}getDocumentsMatchingDocumentQuery(e,t){return this.getDocument(e,new U(t)).next(r=>{let i=ei();return r.isFoundDocument()&&(i=i.insert(r.key,r)),i})}getDocumentsMatchingCollectionGroupQuery(e,t,r,i){const s=t.collectionGroup;let a=ei();return this.indexManager.getCollectionParents(e,s).next(c=>P.forEach(c,u=>{const h=function(m,y){return new br(y,null,m.explicitOrderBy.slice(),m.filters.slice(),m.limit,m.limitType,m.startAt,m.endAt)}(t,u.child(s));return this.getDocumentsMatchingCollectionQuery(e,h,r,i).next(f=>{f.forEach((m,y)=>{a=a.insert(m,y)})})}).next(()=>a))}getDocumentsMatchingCollectionQuery(e,t,r,i){let s;return this.documentOverlayCache.getOverlaysForCollection(e,t.path,r.largestBatchId).next(a=>(s=a,this.remoteDocumentCache.getDocumentsMatchingQuery(e,t,r,s,i))).next(a=>{s.forEach((u,h)=>{const f=h.getKey();a.get(f)===null&&(a=a.insert(f,Oe.newInvalidDocument(f)))});let c=ei();return a.forEach((u,h)=>{const f=s.get(u);f!==void 0&&hi(f.mutation,h,ot.empty(),ee.now()),vo(t,h)&&(c=c.insert(u,h))}),c})}}/**
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
 */class FR{constructor(e){this.serializer=e,this.Nr=new Map,this.Br=new Map}getBundleMetadata(e,t){return P.resolve(this.Nr.get(t))}saveBundleMetadata(e,t){return this.Nr.set(t.id,function(i){return{id:i.id,version:i.version,createTime:gt(i.createTime)}}(t)),P.resolve()}getNamedQuery(e,t){return P.resolve(this.Br.get(t))}saveNamedQuery(e,t){return this.Br.set(t.name,function(i){return{name:i.name,query:CR(i.bundledQuery),readTime:gt(i.readTime)}}(t)),P.resolve()}}/**
 * @license
 * Copyright 2022 Google LLC
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
 */class BR{constructor(){this.overlays=new ae(U.comparator),this.Lr=new Map}getOverlay(e,t){return P.resolve(this.overlays.get(t))}getOverlays(e,t){const r=vn();return P.forEach(t,i=>this.getOverlay(e,i).next(s=>{s!==null&&r.set(i,s)})).next(()=>r)}saveOverlays(e,t,r){return r.forEach((i,s)=>{this.bt(e,t,s)}),P.resolve()}removeOverlaysForBatchId(e,t,r){const i=this.Lr.get(r);return i!==void 0&&(i.forEach(s=>this.overlays=this.overlays.remove(s)),this.Lr.delete(r)),P.resolve()}getOverlaysForCollection(e,t,r){const i=vn(),s=t.length+1,a=new U(t.child("")),c=this.overlays.getIteratorFrom(a);for(;c.hasNext();){const u=c.getNext().value,h=u.getKey();if(!t.isPrefixOf(h.path))break;h.path.length===s&&u.largestBatchId>r&&i.set(u.getKey(),u)}return P.resolve(i)}getOverlaysForCollectionGroup(e,t,r,i){let s=new ae((h,f)=>h-f);const a=this.overlays.getIterator();for(;a.hasNext();){const h=a.getNext().value;if(h.getKey().getCollectionGroup()===t&&h.largestBatchId>r){let f=s.get(h.largestBatchId);f===null&&(f=vn(),s=s.insert(h.largestBatchId,f)),f.set(h.getKey(),h)}}const c=vn(),u=s.getIterator();for(;u.hasNext()&&(u.getNext().value.forEach((h,f)=>c.set(h,f)),!(c.size()>=i)););return P.resolve(c)}bt(e,t,r){const i=this.overlays.get(r.key);if(i!==null){const a=this.Lr.get(i.largestBatchId).delete(r.key);this.Lr.set(i.largestBatchId,a)}this.overlays=this.overlays.insert(r.key,new sR(t,r));let s=this.Lr.get(t);s===void 0&&(s=G(),this.Lr.set(t,s)),this.Lr.set(t,s.add(r.key))}}/**
 * @license
 * Copyright 2024 Google LLC
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
 */class $R{constructor(){this.sessionToken=ke.EMPTY_BYTE_STRING}getSessionToken(e){return P.resolve(this.sessionToken)}setSessionToken(e,t){return this.sessionToken=t,P.resolve()}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class au{constructor(){this.kr=new Ee(ve.Kr),this.qr=new Ee(ve.Ur)}isEmpty(){return this.kr.isEmpty()}addReference(e,t){const r=new ve(e,t);this.kr=this.kr.add(r),this.qr=this.qr.add(r)}$r(e,t){e.forEach(r=>this.addReference(r,t))}removeReference(e,t){this.Wr(new ve(e,t))}Qr(e,t){e.forEach(r=>this.removeReference(r,t))}Gr(e){const t=new U(new X([])),r=new ve(t,e),i=new ve(t,e+1),s=[];return this.qr.forEachInRange([r,i],a=>{this.Wr(a),s.push(a.key)}),s}zr(){this.kr.forEach(e=>this.Wr(e))}Wr(e){this.kr=this.kr.delete(e),this.qr=this.qr.delete(e)}jr(e){const t=new U(new X([])),r=new ve(t,e),i=new ve(t,e+1);let s=G();return this.qr.forEachInRange([r,i],a=>{s=s.add(a.key)}),s}containsKey(e){const t=new ve(e,0),r=this.kr.firstAfterOrEqual(t);return r!==null&&e.isEqual(r.key)}}class ve{constructor(e,t){this.key=e,this.Hr=t}static Kr(e,t){return U.comparator(e.key,t.key)||W(e.Hr,t.Hr)}static Ur(e,t){return W(e.Hr,t.Hr)||U.comparator(e.key,t.key)}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class qR{constructor(e,t){this.indexManager=e,this.referenceDelegate=t,this.mutationQueue=[],this.Yn=1,this.Jr=new Ee(ve.Kr)}checkEmpty(e){return P.resolve(this.mutationQueue.length===0)}addMutationBatch(e,t,r,i){const s=this.Yn;this.Yn++,this.mutationQueue.length>0&&this.mutationQueue[this.mutationQueue.length-1];const a=new iR(s,t,r,i);this.mutationQueue.push(a);for(const c of i)this.Jr=this.Jr.add(new ve(c.key,s)),this.indexManager.addToCollectionParentIndex(e,c.key.path.popLast());return P.resolve(a)}lookupMutationBatch(e,t){return P.resolve(this.Zr(t))}getNextMutationBatchAfterBatchId(e,t){const r=t+1,i=this.Xr(r),s=i<0?0:i;return P.resolve(this.mutationQueue.length>s?this.mutationQueue[s]:null)}getHighestUnacknowledgedBatchId(){return P.resolve(this.mutationQueue.length===0?Qc:this.Yn-1)}getAllMutationBatches(e){return P.resolve(this.mutationQueue.slice())}getAllMutationBatchesAffectingDocumentKey(e,t){const r=new ve(t,0),i=new ve(t,Number.POSITIVE_INFINITY),s=[];return this.Jr.forEachInRange([r,i],a=>{const c=this.Zr(a.Hr);s.push(c)}),P.resolve(s)}getAllMutationBatchesAffectingDocumentKeys(e,t){let r=new Ee(W);return t.forEach(i=>{const s=new ve(i,0),a=new ve(i,Number.POSITIVE_INFINITY);this.Jr.forEachInRange([s,a],c=>{r=r.add(c.Hr)})}),P.resolve(this.Yr(r))}getAllMutationBatchesAffectingQuery(e,t){const r=t.path,i=r.length+1;let s=r;U.isDocumentKey(s)||(s=s.child(""));const a=new ve(new U(s),0);let c=new Ee(W);return this.Jr.forEachWhile(u=>{const h=u.key.path;return!!r.isPrefixOf(h)&&(h.length===i&&(c=c.add(u.Hr)),!0)},a),P.resolve(this.Yr(c))}Yr(e){const t=[];return e.forEach(r=>{const i=this.Zr(r);i!==null&&t.push(i)}),t}removeMutationBatch(e,t){Q(this.ei(t.batchId,"removed")===0,55003),this.mutationQueue.shift();let r=this.Jr;return P.forEach(t.mutations,i=>{const s=new ve(i.key,t.batchId);return r=r.delete(s),this.referenceDelegate.markPotentiallyOrphaned(e,i.key)}).next(()=>{this.Jr=r})}nr(e){}containsKey(e,t){const r=new ve(t,0),i=this.Jr.firstAfterOrEqual(r);return P.resolve(t.isEqual(i&&i.key))}performConsistencyCheck(e){return this.mutationQueue.length,P.resolve()}ei(e,t){return this.Xr(e)}Xr(e){return this.mutationQueue.length===0?0:e-this.mutationQueue[0].batchId}Zr(e){const t=this.Xr(e);return t<0||t>=this.mutationQueue.length?null:this.mutationQueue[t]}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class jR{constructor(e){this.ti=e,this.docs=function(){return new ae(U.comparator)}(),this.size=0}setIndexManager(e){this.indexManager=e}addEntry(e,t){const r=t.key,i=this.docs.get(r),s=i?i.size:0,a=this.ti(t);return this.docs=this.docs.insert(r,{document:t.mutableCopy(),size:a}),this.size+=a-s,this.indexManager.addToCollectionParentIndex(e,r.path.popLast())}removeEntry(e){const t=this.docs.get(e);t&&(this.docs=this.docs.remove(e),this.size-=t.size)}getEntry(e,t){const r=this.docs.get(t);return P.resolve(r?r.document.mutableCopy():Oe.newInvalidDocument(t))}getEntries(e,t){let r=Ut();return t.forEach(i=>{const s=this.docs.get(i);r=r.insert(i,s?s.document.mutableCopy():Oe.newInvalidDocument(i))}),P.resolve(r)}getDocumentsMatchingQuery(e,t,r,i){let s=Ut();const a=t.path,c=new U(a.child("__id-9223372036854775808__")),u=this.docs.getIteratorFrom(c);for(;u.hasNext();){const{key:h,value:{document:f}}=u.getNext();if(!a.isPrefixOf(h.path))break;h.path.length>a.length+1||gA(mA(f),r)<=0||(i.has(f.key)||vo(t,f))&&(s=s.insert(f.key,f.mutableCopy()))}return P.resolve(s)}getAllFromCollectionGroup(e,t,r,i){x(9500)}ni(e,t){return P.forEach(this.docs,r=>t(r))}newChangeBuffer(e){return new HR(this)}getSize(e){return P.resolve(this.size)}}class HR extends LR{constructor(e){super(),this.Mr=e}applyChanges(e){const t=[];return this.changes.forEach((r,i)=>{i.isValidDocument()?t.push(this.Mr.addEntry(e,i)):this.Mr.removeEntry(r)}),P.waitFor(t)}getFromCache(e,t){return this.Mr.getEntry(e,t)}getAllFromCache(e,t){return this.Mr.getEntries(e,t)}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class zR{constructor(e){this.persistence=e,this.ri=new Un(t=>Zc(t),eu),this.lastRemoteSnapshotVersion=B.min(),this.highestTargetId=0,this.ii=0,this.si=new au,this.targetCount=0,this.oi=fr._r()}forEachTarget(e,t){return this.ri.forEach((r,i)=>t(i)),P.resolve()}getLastRemoteSnapshotVersion(e){return P.resolve(this.lastRemoteSnapshotVersion)}getHighestSequenceNumber(e){return P.resolve(this.ii)}allocateTargetId(e){return this.highestTargetId=this.oi.next(),P.resolve(this.highestTargetId)}setTargetsMetadata(e,t,r){return r&&(this.lastRemoteSnapshotVersion=r),t>this.ii&&(this.ii=t),P.resolve()}lr(e){this.ri.set(e.target,e);const t=e.targetId;t>this.highestTargetId&&(this.oi=new fr(t),this.highestTargetId=t),e.sequenceNumber>this.ii&&(this.ii=e.sequenceNumber)}addTargetData(e,t){return this.lr(t),this.targetCount+=1,P.resolve()}updateTargetData(e,t){return this.lr(t),P.resolve()}removeTargetData(e,t){return this.ri.delete(t.target),this.si.Gr(t.targetId),this.targetCount-=1,P.resolve()}removeTargets(e,t,r){let i=0;const s=[];return this.ri.forEach((a,c)=>{c.sequenceNumber<=t&&r.get(c.targetId)===null&&(this.ri.delete(a),s.push(this.removeMatchingKeysForTargetId(e,c.targetId)),i++)}),P.waitFor(s).next(()=>i)}getTargetCount(e){return P.resolve(this.targetCount)}getTargetData(e,t){const r=this.ri.get(t)||null;return P.resolve(r)}addMatchingKeys(e,t,r){return this.si.$r(t,r),P.resolve()}removeMatchingKeys(e,t,r){this.si.Qr(t,r);const i=this.persistence.referenceDelegate,s=[];return i&&t.forEach(a=>{s.push(i.markPotentiallyOrphaned(e,a))}),P.waitFor(s)}removeMatchingKeysForTargetId(e,t){return this.si.Gr(t),P.resolve()}getMatchingKeysForTargetId(e,t){const r=this.si.jr(t);return P.resolve(r)}containsKey(e,t){return P.resolve(this.si.containsKey(t))}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class qm{constructor(e,t){this._i={},this.overlays={},this.ai=new To(0),this.ui=!1,this.ui=!0,this.ci=new $R,this.referenceDelegate=e(this),this.li=new zR(this),this.indexManager=new kR,this.remoteDocumentCache=function(i){return new jR(i)}(r=>this.referenceDelegate.hi(r)),this.serializer=new PR(t),this.Pi=new FR(this.serializer)}start(){return Promise.resolve()}shutdown(){return this.ui=!1,Promise.resolve()}get started(){return this.ui}setDatabaseDeletedListener(){}setNetworkEnabled(){}getIndexManager(e){return this.indexManager}getDocumentOverlayCache(e){let t=this.overlays[e.toKey()];return t||(t=new BR,this.overlays[e.toKey()]=t),t}getMutationQueue(e,t){let r=this._i[e.toKey()];return r||(r=new qR(t,this.referenceDelegate),this._i[e.toKey()]=r),r}getGlobalsCache(){return this.ci}getTargetCache(){return this.li}getRemoteDocumentCache(){return this.remoteDocumentCache}getBundleCache(){return this.Pi}runTransaction(e,t,r){M("MemoryPersistence","Starting transaction:",e);const i=new WR(this.ai.next());return this.referenceDelegate.Ti(),r(i).next(s=>this.referenceDelegate.Ii(i).next(()=>s)).toPromise().then(s=>(i.raiseOnCommittedEvent(),s))}Ei(e,t){return P.or(Object.values(this._i).map(r=>()=>r.containsKey(e,t)))}}class WR extends yA{constructor(e){super(),this.currentSequenceNumber=e}}class cu{constructor(e){this.persistence=e,this.Ri=new au,this.Ai=null}static Vi(e){return new cu(e)}get di(){if(this.Ai)return this.Ai;throw x(60996)}addReference(e,t,r){return this.Ri.addReference(r,t),this.di.delete(r.toString()),P.resolve()}removeReference(e,t,r){return this.Ri.removeReference(r,t),this.di.add(r.toString()),P.resolve()}markPotentiallyOrphaned(e,t){return this.di.add(t.toString()),P.resolve()}removeTarget(e,t){this.Ri.Gr(t.targetId).forEach(i=>this.di.add(i.toString()));const r=this.persistence.getTargetCache();return r.getMatchingKeysForTargetId(e,t.targetId).next(i=>{i.forEach(s=>this.di.add(s.toString()))}).next(()=>r.removeTargetData(e,t))}Ti(){this.Ai=new Set}Ii(e){const t=this.persistence.getRemoteDocumentCache().newChangeBuffer();return P.forEach(this.di,r=>{const i=U.fromPath(r);return this.mi(e,i).next(s=>{s||t.removeEntry(i,B.min())})}).next(()=>(this.Ai=null,t.apply(e)))}updateLimboDocument(e,t){return this.mi(e,t).next(r=>{r?this.di.delete(t.toString()):this.di.add(t.toString())})}hi(e){return 0}mi(e,t){return P.or([()=>P.resolve(this.Ri.containsKey(t)),()=>this.persistence.getTargetCache().containsKey(e,t),()=>this.persistence.Ei(e,t)])}}class Gs{constructor(e,t){this.persistence=e,this.fi=new Un(r=>IA(r.path),(r,i)=>r.isEqual(i)),this.garbageCollector=MR(this,t)}static Vi(e,t){return new Gs(e,t)}Ti(){}Ii(e){return P.resolve()}forEachTarget(e,t){return this.persistence.getTargetCache().forEachTarget(e,t)}dr(e){const t=this.pr(e);return this.persistence.getTargetCache().getTargetCount(e).next(r=>t.next(i=>r+i))}pr(e){let t=0;return this.mr(e,r=>{t++}).next(()=>t)}mr(e,t){return P.forEach(this.fi,(r,i)=>this.wr(e,r,i).next(s=>s?P.resolve():t(i)))}removeTargets(e,t,r){return this.persistence.getTargetCache().removeTargets(e,t,r)}removeOrphanedDocuments(e,t){let r=0;const i=this.persistence.getRemoteDocumentCache(),s=i.newChangeBuffer();return i.ni(e,a=>this.wr(e,a,t).next(c=>{c||(r++,s.removeEntry(a,B.min()))})).next(()=>s.apply(e)).next(()=>r)}markPotentiallyOrphaned(e,t){return this.fi.set(t,e.currentSequenceNumber),P.resolve()}removeTarget(e,t){const r=t.withSequenceNumber(e.currentSequenceNumber);return this.persistence.getTargetCache().updateTargetData(e,r)}addReference(e,t,r){return this.fi.set(r,e.currentSequenceNumber),P.resolve()}removeReference(e,t,r){return this.fi.set(r,e.currentSequenceNumber),P.resolve()}updateLimboDocument(e,t){return this.fi.set(t,e.currentSequenceNumber),P.resolve()}hi(e){let t=e.key.toString().length;return e.isFoundDocument()&&(t+=Rs(e.data.value)),t}wr(e,t,r){return P.or([()=>this.persistence.Ei(e,t),()=>this.persistence.getTargetCache().containsKey(e,t),()=>{const i=this.fi.get(t);return P.resolve(i!==void 0&&i>r)}])}getCacheSize(e){return this.persistence.getRemoteDocumentCache().getSize(e)}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class uu{constructor(e,t,r,i){this.targetId=e,this.fromCache=t,this.Ts=r,this.Is=i}static Es(e,t){let r=G(),i=G();for(const s of t.docChanges)switch(s.type){case 0:r=r.add(s.doc.key);break;case 1:i=i.add(s.doc.key)}return new uu(e,t.fromCache,r,i)}}/**
 * @license
 * Copyright 2023 Google LLC
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
 */class GR{constructor(){this._documentReadCount=0}get documentReadCount(){return this._documentReadCount}incrementDocumentReadCount(e){this._documentReadCount+=e}}/**
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
 */class KR{constructor(){this.Rs=!1,this.As=!1,this.Vs=100,this.ds=function(){return tT()?8:TA(Me())>0?6:4}()}initialize(e,t){this.fs=e,this.indexManager=t,this.Rs=!0}getDocumentsMatchingQuery(e,t,r,i){const s={result:null};return this.gs(e,t).next(a=>{s.result=a}).next(()=>{if(!s.result)return this.ps(e,t,i,r).next(a=>{s.result=a})}).next(()=>{if(s.result)return;const a=new GR;return this.ys(e,t,a).next(c=>{if(s.result=c,this.As)return this.ws(e,t,a,c.size)})}).next(()=>s.result)}ws(e,t,r,i){return r.documentReadCount<this.Vs?(zn()<=z.DEBUG&&M("QueryEngine","SDK will not create cache indexes for query:",Wn(t),"since it only creates cache indexes for collection contains","more than or equal to",this.Vs,"documents"),P.resolve()):(zn()<=z.DEBUG&&M("QueryEngine","Query:",Wn(t),"scans",r.documentReadCount,"local documents and returns",i,"documents as results."),r.documentReadCount>this.ds*i?(zn()<=z.DEBUG&&M("QueryEngine","The SDK decides to create cache indexes for query:",Wn(t),"as using cache indexes may help improve performance."),this.indexManager.createTargetIndexes(e,mt(t))):P.resolve())}gs(e,t){if(ad(t))return P.resolve(null);let r=mt(t);return this.indexManager.getIndexType(e,r).next(i=>i===0?null:(t.limit!==null&&i===1&&(t=oc(t,null,"F"),r=mt(t)),this.indexManager.getDocumentsMatchingTarget(e,r).next(s=>{const a=G(...s);return this.fs.getDocuments(e,a).next(c=>this.indexManager.getMinOffset(e,r).next(u=>{const h=this.bs(t,c);return this.Ss(t,h,a,u.readTime)?this.gs(e,oc(t,null,"F")):this.Ds(e,h,t,u)}))})))}ps(e,t,r,i){return ad(t)||i.isEqual(B.min())?P.resolve(null):this.fs.getDocuments(e,r).next(s=>{const a=this.bs(t,s);return this.Ss(t,a,r,i)?P.resolve(null):(zn()<=z.DEBUG&&M("QueryEngine","Re-using previous result from %s to execute query: %s",i.toString(),Wn(t)),this.Ds(e,a,t,pA(i,wi)).next(c=>c))})}bs(e,t){let r=new Ee(ym(e));return t.forEach((i,s)=>{vo(e,s)&&(r=r.add(s))}),r}Ss(e,t,r,i){if(e.limit===null)return!1;if(r.size!==t.size)return!0;const s=e.limitType==="F"?t.last():t.first();return!!s&&(s.hasPendingWrites||s.version.compareTo(i)>0)}ys(e,t,r){return zn()<=z.DEBUG&&M("QueryEngine","Using full collection scan to execute query:",Wn(t)),this.fs.getDocumentsMatchingQuery(e,t,sn.min(),r)}Ds(e,t,r,i){return this.fs.getDocumentsMatchingQuery(e,r,i).next(s=>(t.forEach(a=>{s=s.insert(a.key,a)}),s))}}/**
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
 */const lu="LocalStore",YR=3e8;class QR{constructor(e,t,r,i){this.persistence=e,this.Cs=t,this.serializer=i,this.vs=new ae(W),this.Fs=new Un(s=>Zc(s),eu),this.Ms=new Map,this.xs=e.getRemoteDocumentCache(),this.li=e.getTargetCache(),this.Pi=e.getBundleCache(),this.Os(r)}Os(e){this.documentOverlayCache=this.persistence.getDocumentOverlayCache(e),this.indexManager=this.persistence.getIndexManager(e),this.mutationQueue=this.persistence.getMutationQueue(e,this.indexManager),this.localDocuments=new xR(this.xs,this.mutationQueue,this.documentOverlayCache,this.indexManager),this.xs.setIndexManager(this.indexManager),this.Cs.initialize(this.localDocuments,this.indexManager)}collectGarbage(e){return this.persistence.runTransaction("Collect garbage","readwrite-primary",t=>e.collect(t,this.vs))}}function JR(n,e,t,r){return new QR(n,e,t,r)}async function jm(n,e){const t=q(n);return await t.persistence.runTransaction("Handle user change","readonly",r=>{let i;return t.mutationQueue.getAllMutationBatches(r).next(s=>(i=s,t.Os(e),t.mutationQueue.getAllMutationBatches(r))).next(s=>{const a=[],c=[];let u=G();for(const h of i){a.push(h.batchId);for(const f of h.mutations)u=u.add(f.key)}for(const h of s){c.push(h.batchId);for(const f of h.mutations)u=u.add(f.key)}return t.localDocuments.getDocuments(r,u).next(h=>({Ns:h,removedBatchIds:a,addedBatchIds:c}))})})}function XR(n,e){const t=q(n);return t.persistence.runTransaction("Acknowledge batch","readwrite-primary",r=>{const i=e.batch.keys(),s=t.xs.newChangeBuffer({trackRemovals:!0});return function(c,u,h,f){const m=h.batch,y=m.keys();let b=P.resolve();return y.forEach(k=>{b=b.next(()=>f.getEntry(u,k)).next(V=>{const N=h.docVersions.get(k);Q(N!==null,48541),V.version.compareTo(N)<0&&(m.applyToRemoteDocument(V,h),V.isValidDocument()&&(V.setReadTime(h.commitVersion),f.addEntry(V)))})}),b.next(()=>c.mutationQueue.removeMutationBatch(u,m))}(t,r,e,s).next(()=>s.apply(r)).next(()=>t.mutationQueue.performConsistencyCheck(r)).next(()=>t.documentOverlayCache.removeOverlaysForBatchId(r,i,e.batch.batchId)).next(()=>t.localDocuments.recalculateAndSaveOverlaysForDocumentKeys(r,function(c){let u=G();for(let h=0;h<c.mutationResults.length;++h)c.mutationResults[h].transformResults.length>0&&(u=u.add(c.batch.mutations[h].key));return u}(e))).next(()=>t.localDocuments.getDocuments(r,i))})}function Hm(n){const e=q(n);return e.persistence.runTransaction("Get last remote snapshot version","readonly",t=>e.li.getLastRemoteSnapshotVersion(t))}function ZR(n,e){const t=q(n),r=e.snapshotVersion;let i=t.vs;return t.persistence.runTransaction("Apply remote event","readwrite-primary",s=>{const a=t.xs.newChangeBuffer({trackRemovals:!0});i=t.vs;const c=[];e.targetChanges.forEach((f,m)=>{const y=i.get(m);if(!y)return;c.push(t.li.removeMatchingKeys(s,f.removedDocuments,m).next(()=>t.li.addMatchingKeys(s,f.addedDocuments,m)));let b=y.withSequenceNumber(s.currentSequenceNumber);e.targetMismatches.get(m)!==null?b=b.withResumeToken(ke.EMPTY_BYTE_STRING,B.min()).withLastLimboFreeSnapshotVersion(B.min()):f.resumeToken.approximateByteSize()>0&&(b=b.withResumeToken(f.resumeToken,r)),i=i.insert(m,b),function(V,N,F){return V.resumeToken.approximateByteSize()===0||N.snapshotVersion.toMicroseconds()-V.snapshotVersion.toMicroseconds()>=YR?!0:F.addedDocuments.size+F.modifiedDocuments.size+F.removedDocuments.size>0}(y,b,f)&&c.push(t.li.updateTargetData(s,b))});let u=Ut(),h=G();if(e.documentUpdates.forEach(f=>{e.resolvedLimboDocuments.has(f)&&c.push(t.persistence.referenceDelegate.updateLimboDocument(s,f))}),c.push(eb(s,a,e.documentUpdates).next(f=>{u=f.Bs,h=f.Ls})),!r.isEqual(B.min())){const f=t.li.getLastRemoteSnapshotVersion(s).next(m=>t.li.setTargetsMetadata(s,s.currentSequenceNumber,r));c.push(f)}return P.waitFor(c).next(()=>a.apply(s)).next(()=>t.localDocuments.getLocalViewOfDocuments(s,u,h)).next(()=>u)}).then(s=>(t.vs=i,s))}function eb(n,e,t){let r=G(),i=G();return t.forEach(s=>r=r.add(s)),e.getEntries(n,r).next(s=>{let a=Ut();return t.forEach((c,u)=>{const h=s.get(c);u.isFoundDocument()!==h.isFoundDocument()&&(i=i.add(c)),u.isNoDocument()&&u.version.isEqual(B.min())?(e.removeEntry(c,u.readTime),a=a.insert(c,u)):!h.isValidDocument()||u.version.compareTo(h.version)>0||u.version.compareTo(h.version)===0&&h.hasPendingWrites?(e.addEntry(u),a=a.insert(c,u)):M(lu,"Ignoring outdated watch update for ",c,". Current version:",h.version," Watch version:",u.version)}),{Bs:a,Ls:i}})}function tb(n,e){const t=q(n);return t.persistence.runTransaction("Get next mutation batch","readonly",r=>(e===void 0&&(e=Qc),t.mutationQueue.getNextMutationBatchAfterBatchId(r,e)))}function nb(n,e){const t=q(n);return t.persistence.runTransaction("Allocate target","readwrite",r=>{let i;return t.li.getTargetData(r,e).next(s=>s?(i=s,P.resolve(i)):t.li.allocateTargetId(r).next(a=>(i=new Qt(e,a,"TargetPurposeListen",r.currentSequenceNumber),t.li.addTargetData(r,i).next(()=>i))))}).then(r=>{const i=t.vs.get(r.targetId);return(i===null||r.snapshotVersion.compareTo(i.snapshotVersion)>0)&&(t.vs=t.vs.insert(r.targetId,r),t.Fs.set(e,r.targetId)),r})}async function hc(n,e,t){const r=q(n),i=r.vs.get(e),s=t?"readwrite":"readwrite-primary";try{t||await r.persistence.runTransaction("Release target",s,a=>r.persistence.referenceDelegate.removeTarget(a,i))}catch(a){if(!Rr(a))throw a;M(lu,`Failed to update sequence numbers for target ${e}: ${a}`)}r.vs=r.vs.remove(e),r.Fs.delete(i.target)}function Ed(n,e,t){const r=q(n);let i=B.min(),s=G();return r.persistence.runTransaction("Execute query","readwrite",a=>function(u,h,f){const m=q(u),y=m.Fs.get(f);return y!==void 0?P.resolve(m.vs.get(y)):m.li.getTargetData(h,f)}(r,a,mt(e)).next(c=>{if(c)return i=c.lastLimboFreeSnapshotVersion,r.li.getMatchingKeysForTargetId(a,c.targetId).next(u=>{s=u})}).next(()=>r.Cs.getDocumentsMatchingQuery(a,e,t?i:B.min(),t?s:G())).next(c=>(rb(r,jA(e),c),{documents:c,ks:s})))}function rb(n,e,t){let r=n.Ms.get(e)||B.min();t.forEach((i,s)=>{s.readTime.compareTo(r)>0&&(r=s.readTime)}),n.Ms.set(e,r)}class Id{constructor(){this.activeTargetIds=YA()}Qs(e){this.activeTargetIds=this.activeTargetIds.add(e)}Gs(e){this.activeTargetIds=this.activeTargetIds.delete(e)}Ws(){const e={activeTargetIds:this.activeTargetIds.toArray(),updateTimeMs:Date.now()};return JSON.stringify(e)}}class ib{constructor(){this.vo=new Id,this.Fo={},this.onlineStateHandler=null,this.sequenceNumberHandler=null}addPendingMutation(e){}updateMutationState(e,t,r){}addLocalQueryTarget(e,t=!0){return t&&this.vo.Qs(e),this.Fo[e]||"not-current"}updateQueryState(e,t,r){this.Fo[e]=t}removeLocalQueryTarget(e){this.vo.Gs(e)}isLocalQueryTarget(e){return this.vo.activeTargetIds.has(e)}clearQueryState(e){delete this.Fo[e]}getAllActiveQueryTargets(){return this.vo.activeTargetIds}isActiveQueryTarget(e){return this.vo.activeTargetIds.has(e)}start(){return this.vo=new Id,Promise.resolve()}handleUserChange(e,t,r){}setOnlineState(e){}shutdown(){}writeSequenceNumber(e){}notifyBundleLoaded(e){}}/**
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
 */class sb{Mo(e){}shutdown(){}}/**
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
 */const wd="ConnectivityMonitor";class vd{constructor(){this.xo=()=>this.Oo(),this.No=()=>this.Bo(),this.Lo=[],this.ko()}Mo(e){this.Lo.push(e)}shutdown(){window.removeEventListener("online",this.xo),window.removeEventListener("offline",this.No)}ko(){window.addEventListener("online",this.xo),window.addEventListener("offline",this.No)}Oo(){M(wd,"Network connectivity changed: AVAILABLE");for(const e of this.Lo)e(0)}Bo(){M(wd,"Network connectivity changed: UNAVAILABLE");for(const e of this.Lo)e(1)}static v(){return typeof window<"u"&&window.addEventListener!==void 0&&window.removeEventListener!==void 0}}/**
 * @license
 * Copyright 2023 Google LLC
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
 */let fs=null;function dc(){return fs===null?fs=function(){return 268435456+Math.round(2147483648*Math.random())}():fs++,"0x"+fs.toString(16)}/**
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
 */const va="RestConnection",ob={BatchGetDocuments:"batchGet",Commit:"commit",RunQuery:"runQuery",RunAggregationQuery:"runAggregationQuery",ExecutePipeline:"executePipeline"};class ab{get Ko(){return!1}constructor(e){this.databaseInfo=e,this.databaseId=e.databaseId;const t=e.ssl?"https":"http",r=encodeURIComponent(this.databaseId.projectId),i=encodeURIComponent(this.databaseId.database);this.qo=t+"://"+e.host,this.Uo=`projects/${r}/databases/${i}`,this.$o=this.databaseId.database===$s?`project_id=${r}`:`project_id=${r}&database_id=${i}`}Wo(e,t,r,i,s){const a=dc(),c=this.Qo(e,t.toUriEncodedString());M(va,`Sending RPC '${e}' ${a}:`,c,r);const u={"google-cloud-resource-prefix":this.Uo,"x-goog-request-params":this.$o};this.Go(u,i,s);const{host:h}=new URL(c),f=fn(h);return this.zo(e,c,u,r,f).then(m=>(M(va,`Received RPC '${e}' ${a}: `,m),m),m=>{throw ur(va,`RPC '${e}' ${a} failed with error: `,m,"url: ",c,"request:",r),m})}jo(e,t,r,i,s,a){return this.Wo(e,t,r,i,s)}Go(e,t,r){e["X-Goog-Api-Client"]=function(){return"gl-js/ fire/"+vr}(),e["Content-Type"]="text/plain",this.databaseInfo.appId&&(e["X-Firebase-GMPID"]=this.databaseInfo.appId),t&&t.headers.forEach((i,s)=>e[s]=i),r&&r.headers.forEach((i,s)=>e[s]=i)}Qo(e,t){const r=ob[e];let i=`${this.qo}/v1/${t}:${r}`;return this.databaseInfo.apiKey&&(i=`${i}?key=${encodeURIComponent(this.databaseInfo.apiKey)}`),i}terminate(){}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class cb{constructor(e){this.Ho=e.Ho,this.Jo=e.Jo}Zo(e){this.Xo=e}Yo(e){this.e_=e}t_(e){this.n_=e}onMessage(e){this.r_=e}close(){this.Jo()}send(e){this.Ho(e)}i_(){this.Xo()}s_(){this.e_()}o_(e){this.n_(e)}__(e){this.r_(e)}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */const De="WebChannelConnection",Kr=(n,e,t)=>{n.listen(e,r=>{try{t(r)}catch(i){setTimeout(()=>{throw i},0)}})};class tr extends ab{constructor(e){super(e),this.a_=[],this.forceLongPolling=e.forceLongPolling,this.autoDetectLongPolling=e.autoDetectLongPolling,this.useFetchStreams=e.useFetchStreams,this.longPollingOptions=e.longPollingOptions}static u_(){if(!tr.c_){const e=Yp();Kr(e,Kp.STAT_EVENT,t=>{t.stat===Za.PROXY?M(De,"STAT_EVENT: detected buffering proxy"):t.stat===Za.NOPROXY&&M(De,"STAT_EVENT: detected no buffering proxy")}),tr.c_=!0}}zo(e,t,r,i,s){const a=dc();return new Promise((c,u)=>{const h=new Wp;h.setWithCredentials(!0),h.listenOnce(Gp.COMPLETE,()=>{try{switch(h.getLastErrorCode()){case As.NO_ERROR:const m=h.getResponseJson();M(De,`XHR for RPC '${e}' ${a} received:`,JSON.stringify(m)),c(m);break;case As.TIMEOUT:M(De,`RPC '${e}' ${a} timed out`),u(new O(S.DEADLINE_EXCEEDED,"Request time out"));break;case As.HTTP_ERROR:const y=h.getStatus();if(M(De,`RPC '${e}' ${a} failed with status:`,y,"response text:",h.getResponseText()),y>0){let b=h.getResponseJson();Array.isArray(b)&&(b=b[0]);const k=b==null?void 0:b.error;if(k&&k.status&&k.message){const V=function(F){const $=F.toLowerCase().replace(/_/g,"-");return Object.values(S).indexOf($)>=0?$:S.UNKNOWN}(k.status);u(new O(V,k.message))}else u(new O(S.UNKNOWN,"Server responded with status "+h.getStatus()))}else u(new O(S.UNAVAILABLE,"Connection failed."));break;default:x(9055,{l_:e,streamId:a,h_:h.getLastErrorCode(),P_:h.getLastError()})}}finally{M(De,`RPC '${e}' ${a} completed.`)}});const f=JSON.stringify(i);M(De,`RPC '${e}' ${a} sending request:`,i),h.send(t,"POST",f,r,15)})}T_(e,t,r){const i=dc(),s=[this.qo,"/","google.firestore.v1.Firestore","/",e,"/channel"],a=this.createWebChannelTransport(),c={httpSessionIdParam:"gsessionid",initMessageHeaders:{},messageUrlParams:{database:`projects/${this.databaseId.projectId}/databases/${this.databaseId.database}`},sendRawJson:!0,supportsCrossDomainXhr:!0,internalChannelParams:{forwardChannelRequestTimeoutMs:6e5},forceLongPolling:this.forceLongPolling,detectBufferingProxy:this.autoDetectLongPolling},u=this.longPollingOptions.timeoutSeconds;u!==void 0&&(c.longPollingTimeout=Math.round(1e3*u)),this.useFetchStreams&&(c.useFetchStreams=!0),this.Go(c.initMessageHeaders,t,r),c.encodeInitMessageHeaders=!0;const h=s.join("");M(De,`Creating RPC '${e}' stream ${i}: ${h}`,c);const f=a.createWebChannel(h,c);this.I_(f);let m=!1,y=!1;const b=new cb({Ho:k=>{y?M(De,`Not sending because RPC '${e}' stream ${i} is closed:`,k):(m||(M(De,`Opening RPC '${e}' stream ${i} transport.`),f.open(),m=!0),M(De,`RPC '${e}' stream ${i} sending:`,k),f.send(k))},Jo:()=>f.close()});return Kr(f,Zr.EventType.OPEN,()=>{y||(M(De,`RPC '${e}' stream ${i} transport opened.`),b.i_())}),Kr(f,Zr.EventType.CLOSE,()=>{y||(y=!0,M(De,`RPC '${e}' stream ${i} transport closed`),b.o_(),this.E_(f))}),Kr(f,Zr.EventType.ERROR,k=>{y||(y=!0,ur(De,`RPC '${e}' stream ${i} transport errored. Name:`,k.name,"Message:",k.message),b.o_(new O(S.UNAVAILABLE,"The operation could not be completed")))}),Kr(f,Zr.EventType.MESSAGE,k=>{var V;if(!y){const N=k.data[0];Q(!!N,16349);const F=N,$=(F==null?void 0:F.error)||((V=F[0])==null?void 0:V.error);if($){M(De,`RPC '${e}' stream ${i} received error:`,$);const j=$.status;let Y=function(I){const g=fe[I];if(g!==void 0)return Cm(g)}(j),se=$.message;j==="NOT_FOUND"&&se.includes("database")&&se.includes("does not exist")&&se.includes(this.databaseId.database)&&ur(`Database '${this.databaseId.database}' not found. Please check your project configuration.`),Y===void 0&&(Y=S.INTERNAL,se="Unknown error status: "+j+" with message "+$.message),y=!0,b.o_(new O(Y,se)),f.close()}else M(De,`RPC '${e}' stream ${i} received:`,N),b.__(N)}}),tr.u_(),setTimeout(()=>{b.s_()},0),b}terminate(){this.a_.forEach(e=>e.close()),this.a_=[]}I_(e){this.a_.push(e)}E_(e){this.a_=this.a_.filter(t=>t===e)}Go(e,t,r){super.Go(e,t,r),this.databaseInfo.apiKey&&(e["x-goog-api-key"]=this.databaseInfo.apiKey)}createWebChannelTransport(){return Qp()}}/**
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
 */function ub(n){return new tr(n)}function Aa(){return typeof document<"u"?document:null}/**
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
 */function So(n){return new pR(n,!0)}/**
 * @license
 * Copyright 2017 Google LLC
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
 */tr.c_=!1;class zm{constructor(e,t,r=1e3,i=1.5,s=6e4){this.Ci=e,this.timerId=t,this.R_=r,this.A_=i,this.V_=s,this.d_=0,this.m_=null,this.f_=Date.now(),this.reset()}reset(){this.d_=0}g_(){this.d_=this.V_}p_(e){this.cancel();const t=Math.floor(this.d_+this.y_()),r=Math.max(0,Date.now()-this.f_),i=Math.max(0,t-r);i>0&&M("ExponentialBackoff",`Backing off for ${i} ms (base delay: ${this.d_} ms, delay with jitter: ${t} ms, last attempt: ${r} ms ago)`),this.m_=this.Ci.enqueueAfterDelay(this.timerId,i,()=>(this.f_=Date.now(),e())),this.d_*=this.A_,this.d_<this.R_&&(this.d_=this.R_),this.d_>this.V_&&(this.d_=this.V_)}w_(){this.m_!==null&&(this.m_.skipDelay(),this.m_=null)}cancel(){this.m_!==null&&(this.m_.cancel(),this.m_=null)}y_(){return(Math.random()-.5)*this.d_}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */const Ad="PersistentStream";class Wm{constructor(e,t,r,i,s,a,c,u){this.Ci=e,this.b_=r,this.S_=i,this.connection=s,this.authCredentialsProvider=a,this.appCheckCredentialsProvider=c,this.listener=u,this.state=0,this.D_=0,this.C_=null,this.v_=null,this.stream=null,this.F_=0,this.M_=new zm(e,t)}x_(){return this.state===1||this.state===5||this.O_()}O_(){return this.state===2||this.state===3}start(){this.F_=0,this.state!==4?this.auth():this.N_()}async stop(){this.x_()&&await this.close(0)}B_(){this.state=0,this.M_.reset()}L_(){this.O_()&&this.C_===null&&(this.C_=this.Ci.enqueueAfterDelay(this.b_,6e4,()=>this.k_()))}K_(e){this.q_(),this.stream.send(e)}async k_(){if(this.O_())return this.close(0)}q_(){this.C_&&(this.C_.cancel(),this.C_=null)}U_(){this.v_&&(this.v_.cancel(),this.v_=null)}async close(e,t){this.q_(),this.U_(),this.M_.cancel(),this.D_++,e!==4?this.M_.reset():t&&t.code===S.RESOURCE_EXHAUSTED?(Lt(t.toString()),Lt("Using maximum backoff delay to prevent overloading the backend."),this.M_.g_()):t&&t.code===S.UNAUTHENTICATED&&this.state!==3&&(this.authCredentialsProvider.invalidateToken(),this.appCheckCredentialsProvider.invalidateToken()),this.stream!==null&&(this.W_(),this.stream.close(),this.stream=null),this.state=e,await this.listener.t_(t)}W_(){}auth(){this.state=1;const e=this.Q_(this.D_),t=this.D_;Promise.all([this.authCredentialsProvider.getToken(),this.appCheckCredentialsProvider.getToken()]).then(([r,i])=>{this.D_===t&&this.G_(r,i)},r=>{e(()=>{const i=new O(S.UNKNOWN,"Fetching auth token failed: "+r.message);return this.z_(i)})})}G_(e,t){const r=this.Q_(this.D_);this.stream=this.j_(e,t),this.stream.Zo(()=>{r(()=>this.listener.Zo())}),this.stream.Yo(()=>{r(()=>(this.state=2,this.v_=this.Ci.enqueueAfterDelay(this.S_,1e4,()=>(this.O_()&&(this.state=3),Promise.resolve())),this.listener.Yo()))}),this.stream.t_(i=>{r(()=>this.z_(i))}),this.stream.onMessage(i=>{r(()=>++this.F_==1?this.H_(i):this.onNext(i))})}N_(){this.state=5,this.M_.p_(async()=>{this.state=0,this.start()})}z_(e){return M(Ad,`close with error: ${e}`),this.stream=null,this.close(4,e)}Q_(e){return t=>{this.Ci.enqueueAndForget(()=>this.D_===e?t():(M(Ad,"stream callback skipped by getCloseGuardedDispatcher."),Promise.resolve()))}}}class lb extends Wm{constructor(e,t,r,i,s,a){super(e,"listen_stream_connection_backoff","listen_stream_idle","health_check_timeout",t,r,i,a),this.serializer=s}j_(e,t){return this.connection.T_("Listen",e,t)}H_(e){return this.onNext(e)}onNext(e){this.M_.reset();const t=_R(this.serializer,e),r=function(s){if(!("targetChange"in s))return B.min();const a=s.targetChange;return a.targetIds&&a.targetIds.length?B.min():a.readTime?gt(a.readTime):B.min()}(e);return this.listener.J_(t,r)}Z_(e){const t={};t.database=lc(this.serializer),t.addTarget=function(s,a){let c;const u=a.target;if(c=ic(u)?{documents:ER(s,u)}:{query:IR(s,u).ft},c.targetId=a.targetId,a.resumeToken.approximateByteSize()>0){c.resumeToken=Dm(s,a.resumeToken);const h=ac(s,a.expectedCount);h!==null&&(c.expectedCount=h)}else if(a.snapshotVersion.compareTo(B.min())>0){c.readTime=Ws(s,a.snapshotVersion.toTimestamp());const h=ac(s,a.expectedCount);h!==null&&(c.expectedCount=h)}return c}(this.serializer,e);const r=vR(this.serializer,e);r&&(t.labels=r),this.K_(t)}X_(e){const t={};t.database=lc(this.serializer),t.removeTarget=e,this.K_(t)}}class hb extends Wm{constructor(e,t,r,i,s,a){super(e,"write_stream_connection_backoff","write_stream_idle","health_check_timeout",t,r,i,a),this.serializer=s}get Y_(){return this.F_>0}start(){this.lastStreamToken=void 0,super.start()}W_(){this.Y_&&this.ea([])}j_(e,t){return this.connection.T_("Write",e,t)}H_(e){return Q(!!e.streamToken,31322),this.lastStreamToken=e.streamToken,Q(!e.writeResults||e.writeResults.length===0,55816),this.listener.ta()}onNext(e){Q(!!e.streamToken,12678),this.lastStreamToken=e.streamToken,this.M_.reset();const t=TR(e.writeResults,e.commitTime),r=gt(e.commitTime);return this.listener.na(r,t)}ra(){const e={};e.database=lc(this.serializer),this.K_(e)}ea(e){const t={streamToken:this.lastStreamToken,writes:e.map(r=>yR(this.serializer,r))};this.K_(t)}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class db{}class fb extends db{constructor(e,t,r,i){super(),this.authCredentials=e,this.appCheckCredentials=t,this.connection=r,this.serializer=i,this.ia=!1}sa(){if(this.ia)throw new O(S.FAILED_PRECONDITION,"The client has already been terminated.")}Wo(e,t,r,i){return this.sa(),Promise.all([this.authCredentials.getToken(),this.appCheckCredentials.getToken()]).then(([s,a])=>this.connection.Wo(e,cc(t,r),i,s,a)).catch(s=>{throw s.name==="FirebaseError"?(s.code===S.UNAUTHENTICATED&&(this.authCredentials.invalidateToken(),this.appCheckCredentials.invalidateToken()),s):new O(S.UNKNOWN,s.toString())})}jo(e,t,r,i,s){return this.sa(),Promise.all([this.authCredentials.getToken(),this.appCheckCredentials.getToken()]).then(([a,c])=>this.connection.jo(e,cc(t,r),i,a,c,s)).catch(a=>{throw a.name==="FirebaseError"?(a.code===S.UNAUTHENTICATED&&(this.authCredentials.invalidateToken(),this.appCheckCredentials.invalidateToken()),a):new O(S.UNKNOWN,a.toString())})}terminate(){this.ia=!0,this.connection.terminate()}}function pb(n,e,t,r){return new fb(n,e,t,r)}class mb{constructor(e,t){this.asyncQueue=e,this.onlineStateHandler=t,this.state="Unknown",this.oa=0,this._a=null,this.aa=!0}ua(){this.oa===0&&(this.ca("Unknown"),this._a=this.asyncQueue.enqueueAfterDelay("online_state_timeout",1e4,()=>(this._a=null,this.la("Backend didn't respond within 10 seconds."),this.ca("Offline"),Promise.resolve())))}ha(e){this.state==="Online"?this.ca("Unknown"):(this.oa++,this.oa>=1&&(this.Pa(),this.la(`Connection failed 1 times. Most recent error: ${e.toString()}`),this.ca("Offline")))}set(e){this.Pa(),this.oa=0,e==="Online"&&(this.aa=!1),this.ca(e)}ca(e){e!==this.state&&(this.state=e,this.onlineStateHandler(e))}la(e){const t=`Could not reach Cloud Firestore backend. ${e}
This typically indicates that your device does not have a healthy Internet connection at the moment. The client will operate in offline mode until it is able to successfully connect to the backend.`;this.aa?(Lt(t),this.aa=!1):M("OnlineStateTracker",t)}Pa(){this._a!==null&&(this._a.cancel(),this._a=null)}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */const Cn="RemoteStore";class gb{constructor(e,t,r,i,s){this.localStore=e,this.datastore=t,this.asyncQueue=r,this.remoteSyncer={},this.Ta=[],this.Ia=new Map,this.Ea=new Set,this.Ra=[],this.Aa=s,this.Aa.Mo(a=>{r.enqueueAndForget(async()=>{Fn(this)&&(M(Cn,"Restarting streams for network reachability change."),await async function(u){const h=q(u);h.Ea.add(4),await Bi(h),h.Va.set("Unknown"),h.Ea.delete(4),await Po(h)}(this))})}),this.Va=new mb(r,i)}}async function Po(n){if(Fn(n))for(const e of n.Ra)await e(!0)}async function Bi(n){for(const e of n.Ra)await e(!1)}function Gm(n,e){const t=q(n);t.Ia.has(e.targetId)||(t.Ia.set(e.targetId,e),pu(t)?fu(t):Sr(t).O_()&&du(t,e))}function hu(n,e){const t=q(n),r=Sr(t);t.Ia.delete(e),r.O_()&&Km(t,e),t.Ia.size===0&&(r.O_()?r.L_():Fn(t)&&t.Va.set("Unknown"))}function du(n,e){if(n.da.$e(e.targetId),e.resumeToken.approximateByteSize()>0||e.snapshotVersion.compareTo(B.min())>0){const t=n.remoteSyncer.getRemoteKeysForTarget(e.targetId).size;e=e.withExpectedCount(t)}Sr(n).Z_(e)}function Km(n,e){n.da.$e(e),Sr(n).X_(e)}function fu(n){n.da=new lR({getRemoteKeysForTarget:e=>n.remoteSyncer.getRemoteKeysForTarget(e),At:e=>n.Ia.get(e)||null,ht:()=>n.datastore.serializer.databaseId}),Sr(n).start(),n.Va.ua()}function pu(n){return Fn(n)&&!Sr(n).x_()&&n.Ia.size>0}function Fn(n){return q(n).Ea.size===0}function Ym(n){n.da=void 0}async function _b(n){n.Va.set("Online")}async function yb(n){n.Ia.forEach((e,t)=>{du(n,e)})}async function Tb(n,e){Ym(n),pu(n)?(n.Va.ha(e),fu(n)):n.Va.set("Unknown")}async function Eb(n,e,t){if(n.Va.set("Online"),e instanceof Nm&&e.state===2&&e.cause)try{await async function(i,s){const a=s.cause;for(const c of s.targetIds)i.Ia.has(c)&&(await i.remoteSyncer.rejectListen(c,a),i.Ia.delete(c),i.da.removeTarget(c))}(n,e)}catch(r){M(Cn,"Failed to remove targets %s: %s ",e.targetIds.join(","),r),await Ks(n,r)}else if(e instanceof Ps?n.da.Xe(e):e instanceof km?n.da.st(e):n.da.tt(e),!t.isEqual(B.min()))try{const r=await Hm(n.localStore);t.compareTo(r)>=0&&await function(s,a){const c=s.da.Tt(a);return c.targetChanges.forEach((u,h)=>{if(u.resumeToken.approximateByteSize()>0){const f=s.Ia.get(h);f&&s.Ia.set(h,f.withResumeToken(u.resumeToken,a))}}),c.targetMismatches.forEach((u,h)=>{const f=s.Ia.get(u);if(!f)return;s.Ia.set(u,f.withResumeToken(ke.EMPTY_BYTE_STRING,f.snapshotVersion)),Km(s,u);const m=new Qt(f.target,u,h,f.sequenceNumber);du(s,m)}),s.remoteSyncer.applyRemoteEvent(c)}(n,t)}catch(r){M(Cn,"Failed to raise snapshot:",r),await Ks(n,r)}}async function Ks(n,e,t){if(!Rr(e))throw e;n.Ea.add(1),await Bi(n),n.Va.set("Offline"),t||(t=()=>Hm(n.localStore)),n.asyncQueue.enqueueRetryable(async()=>{M(Cn,"Retrying IndexedDB access"),await t(),n.Ea.delete(1),await Po(n)})}function Qm(n,e){return e().catch(t=>Ks(n,t,e))}async function Co(n){const e=q(n),t=un(e);let r=e.Ta.length>0?e.Ta[e.Ta.length-1].batchId:Qc;for(;Ib(e);)try{const i=await tb(e.localStore,r);if(i===null){e.Ta.length===0&&t.L_();break}r=i.batchId,wb(e,i)}catch(i){await Ks(e,i)}Jm(e)&&Xm(e)}function Ib(n){return Fn(n)&&n.Ta.length<10}function wb(n,e){n.Ta.push(e);const t=un(n);t.O_()&&t.Y_&&t.ea(e.mutations)}function Jm(n){return Fn(n)&&!un(n).x_()&&n.Ta.length>0}function Xm(n){un(n).start()}async function vb(n){un(n).ra()}async function Ab(n){const e=un(n);for(const t of n.Ta)e.ea(t.mutations)}async function Rb(n,e,t){const r=n.Ta.shift(),i=iu.from(r,e,t);await Qm(n,()=>n.remoteSyncer.applySuccessfulWrite(i)),await Co(n)}async function bb(n,e){e&&un(n).Y_&&await async function(r,i){if(function(a){return aR(a)&&a!==S.ABORTED}(i.code)){const s=r.Ta.shift();un(r).B_(),await Qm(r,()=>r.remoteSyncer.rejectFailedWrite(s.batchId,i)),await Co(r)}}(n,e),Jm(n)&&Xm(n)}async function Rd(n,e){const t=q(n);t.asyncQueue.verifyOperationInProgress(),M(Cn,"RemoteStore received new credentials");const r=Fn(t);t.Ea.add(3),await Bi(t),r&&t.Va.set("Unknown"),await t.remoteSyncer.handleCredentialChange(e),t.Ea.delete(3),await Po(t)}async function Sb(n,e){const t=q(n);e?(t.Ea.delete(2),await Po(t)):e||(t.Ea.add(2),await Bi(t),t.Va.set("Unknown"))}function Sr(n){return n.ma||(n.ma=function(t,r,i){const s=q(t);return s.sa(),new lb(r,s.connection,s.authCredentials,s.appCheckCredentials,s.serializer,i)}(n.datastore,n.asyncQueue,{Zo:_b.bind(null,n),Yo:yb.bind(null,n),t_:Tb.bind(null,n),J_:Eb.bind(null,n)}),n.Ra.push(async e=>{e?(n.ma.B_(),pu(n)?fu(n):n.Va.set("Unknown")):(await n.ma.stop(),Ym(n))})),n.ma}function un(n){return n.fa||(n.fa=function(t,r,i){const s=q(t);return s.sa(),new hb(r,s.connection,s.authCredentials,s.appCheckCredentials,s.serializer,i)}(n.datastore,n.asyncQueue,{Zo:()=>Promise.resolve(),Yo:vb.bind(null,n),t_:bb.bind(null,n),ta:Ab.bind(null,n),na:Rb.bind(null,n)}),n.Ra.push(async e=>{e?(n.fa.B_(),await Co(n)):(await n.fa.stop(),n.Ta.length>0&&(M(Cn,`Stopping write stream with ${n.Ta.length} pending writes`),n.Ta=[]))})),n.fa}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class mu{constructor(e,t,r,i,s){this.asyncQueue=e,this.timerId=t,this.targetTimeMs=r,this.op=i,this.removalCallback=s,this.deferred=new kt,this.then=this.deferred.promise.then.bind(this.deferred.promise),this.deferred.promise.catch(a=>{})}get promise(){return this.deferred.promise}static createAndSchedule(e,t,r,i,s){const a=Date.now()+r,c=new mu(e,t,a,i,s);return c.start(r),c}start(e){this.timerHandle=setTimeout(()=>this.handleDelayElapsed(),e)}skipDelay(){return this.handleDelayElapsed()}cancel(e){this.timerHandle!==null&&(this.clearTimeout(),this.deferred.reject(new O(S.CANCELLED,"Operation cancelled"+(e?": "+e:""))))}handleDelayElapsed(){this.asyncQueue.enqueueAndForget(()=>this.timerHandle!==null?(this.clearTimeout(),this.op().then(e=>this.deferred.resolve(e))):Promise.resolve())}clearTimeout(){this.timerHandle!==null&&(this.removalCallback(this),clearTimeout(this.timerHandle),this.timerHandle=null)}}function gu(n,e){if(Lt("AsyncQueue",`${e}: ${n}`),Rr(n))return new O(S.UNAVAILABLE,`${e}: ${n}`);throw n}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class nr{static emptySet(e){return new nr(e.comparator)}constructor(e){this.comparator=e?(t,r)=>e(t,r)||U.comparator(t.key,r.key):(t,r)=>U.comparator(t.key,r.key),this.keyedMap=ei(),this.sortedSet=new ae(this.comparator)}has(e){return this.keyedMap.get(e)!=null}get(e){return this.keyedMap.get(e)}first(){return this.sortedSet.minKey()}last(){return this.sortedSet.maxKey()}isEmpty(){return this.sortedSet.isEmpty()}indexOf(e){const t=this.keyedMap.get(e);return t?this.sortedSet.indexOf(t):-1}get size(){return this.sortedSet.size}forEach(e){this.sortedSet.inorderTraversal((t,r)=>(e(t),!1))}add(e){const t=this.delete(e.key);return t.copy(t.keyedMap.insert(e.key,e),t.sortedSet.insert(e,null))}delete(e){const t=this.get(e);return t?this.copy(this.keyedMap.remove(e),this.sortedSet.remove(t)):this}isEqual(e){if(!(e instanceof nr)||this.size!==e.size)return!1;const t=this.sortedSet.getIterator(),r=e.sortedSet.getIterator();for(;t.hasNext();){const i=t.getNext().key,s=r.getNext().key;if(!i.isEqual(s))return!1}return!0}toString(){const e=[];return this.forEach(t=>{e.push(t.toString())}),e.length===0?"DocumentSet ()":`DocumentSet (
  `+e.join(`  
`)+`
)`}copy(e,t){const r=new nr;return r.comparator=this.comparator,r.keyedMap=e,r.sortedSet=t,r}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class bd{constructor(){this.ga=new ae(U.comparator)}track(e){const t=e.doc.key,r=this.ga.get(t);r?e.type!==0&&r.type===3?this.ga=this.ga.insert(t,e):e.type===3&&r.type!==1?this.ga=this.ga.insert(t,{type:r.type,doc:e.doc}):e.type===2&&r.type===2?this.ga=this.ga.insert(t,{type:2,doc:e.doc}):e.type===2&&r.type===0?this.ga=this.ga.insert(t,{type:0,doc:e.doc}):e.type===1&&r.type===0?this.ga=this.ga.remove(t):e.type===1&&r.type===2?this.ga=this.ga.insert(t,{type:1,doc:r.doc}):e.type===0&&r.type===1?this.ga=this.ga.insert(t,{type:2,doc:e.doc}):x(63341,{Vt:e,pa:r}):this.ga=this.ga.insert(t,e)}ya(){const e=[];return this.ga.inorderTraversal((t,r)=>{e.push(r)}),e}}class pr{constructor(e,t,r,i,s,a,c,u,h){this.query=e,this.docs=t,this.oldDocs=r,this.docChanges=i,this.mutatedKeys=s,this.fromCache=a,this.syncStateChanged=c,this.excludesMetadataChanges=u,this.hasCachedResults=h}static fromInitialDocuments(e,t,r,i,s){const a=[];return t.forEach(c=>{a.push({type:0,doc:c})}),new pr(e,t,nr.emptySet(t),a,r,i,!0,!1,s)}get hasPendingWrites(){return!this.mutatedKeys.isEmpty()}isEqual(e){if(!(this.fromCache===e.fromCache&&this.hasCachedResults===e.hasCachedResults&&this.syncStateChanged===e.syncStateChanged&&this.mutatedKeys.isEqual(e.mutatedKeys)&&wo(this.query,e.query)&&this.docs.isEqual(e.docs)&&this.oldDocs.isEqual(e.oldDocs)))return!1;const t=this.docChanges,r=e.docChanges;if(t.length!==r.length)return!1;for(let i=0;i<t.length;i++)if(t[i].type!==r[i].type||!t[i].doc.isEqual(r[i].doc))return!1;return!0}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class Pb{constructor(){this.wa=void 0,this.ba=[]}Sa(){return this.ba.some(e=>e.Da())}}class Cb{constructor(){this.queries=Sd(),this.onlineState="Unknown",this.Ca=new Set}terminate(){(function(t,r){const i=q(t),s=i.queries;i.queries=Sd(),s.forEach((a,c)=>{for(const u of c.ba)u.onError(r)})})(this,new O(S.ABORTED,"Firestore shutting down"))}}function Sd(){return new Un(n=>_m(n),wo)}async function Zm(n,e){const t=q(n);let r=3;const i=e.query;let s=t.queries.get(i);s?!s.Sa()&&e.Da()&&(r=2):(s=new Pb,r=e.Da()?0:1);try{switch(r){case 0:s.wa=await t.onListen(i,!0);break;case 1:s.wa=await t.onListen(i,!1);break;case 2:await t.onFirstRemoteStoreListen(i)}}catch(a){const c=gu(a,`Initialization of query '${Wn(e.query)}' failed`);return void e.onError(c)}t.queries.set(i,s),s.ba.push(e),e.va(t.onlineState),s.wa&&e.Fa(s.wa)&&_u(t)}async function eg(n,e){const t=q(n),r=e.query;let i=3;const s=t.queries.get(r);if(s){const a=s.ba.indexOf(e);a>=0&&(s.ba.splice(a,1),s.ba.length===0?i=e.Da()?0:1:!s.Sa()&&e.Da()&&(i=2))}switch(i){case 0:return t.queries.delete(r),t.onUnlisten(r,!0);case 1:return t.queries.delete(r),t.onUnlisten(r,!1);case 2:return t.onLastRemoteStoreUnlisten(r);default:return}}function kb(n,e){const t=q(n);let r=!1;for(const i of e){const s=i.query,a=t.queries.get(s);if(a){for(const c of a.ba)c.Fa(i)&&(r=!0);a.wa=i}}r&&_u(t)}function Nb(n,e,t){const r=q(n),i=r.queries.get(e);if(i)for(const s of i.ba)s.onError(t);r.queries.delete(e)}function _u(n){n.Ca.forEach(e=>{e.next()})}var fc,Pd;(Pd=fc||(fc={})).Ma="default",Pd.Cache="cache";class tg{constructor(e,t,r){this.query=e,this.xa=t,this.Oa=!1,this.Na=null,this.onlineState="Unknown",this.options=r||{}}Fa(e){if(!this.options.includeMetadataChanges){const r=[];for(const i of e.docChanges)i.type!==3&&r.push(i);e=new pr(e.query,e.docs,e.oldDocs,r,e.mutatedKeys,e.fromCache,e.syncStateChanged,!0,e.hasCachedResults)}let t=!1;return this.Oa?this.Ba(e)&&(this.xa.next(e),t=!0):this.La(e,this.onlineState)&&(this.ka(e),t=!0),this.Na=e,t}onError(e){this.xa.error(e)}va(e){this.onlineState=e;let t=!1;return this.Na&&!this.Oa&&this.La(this.Na,e)&&(this.ka(this.Na),t=!0),t}La(e,t){if(!e.fromCache||!this.Da())return!0;const r=t!=="Offline";return(!this.options.Ka||!r)&&(!e.docs.isEmpty()||e.hasCachedResults||t==="Offline")}Ba(e){if(e.docChanges.length>0)return!0;const t=this.Na&&this.Na.hasPendingWrites!==e.hasPendingWrites;return!(!e.syncStateChanged&&!t)&&this.options.includeMetadataChanges===!0}ka(e){e=pr.fromInitialDocuments(e.query,e.docs,e.mutatedKeys,e.fromCache,e.hasCachedResults),this.Oa=!0,this.xa.next(e)}Da(){return this.options.source!==fc.Cache}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class ng{constructor(e){this.key=e}}class rg{constructor(e){this.key=e}}class Db{constructor(e,t){this.query=e,this.Za=t,this.Xa=null,this.hasCachedResults=!1,this.current=!1,this.Ya=G(),this.mutatedKeys=G(),this.eu=ym(e),this.tu=new nr(this.eu)}get nu(){return this.Za}ru(e,t){const r=t?t.iu:new bd,i=t?t.tu:this.tu;let s=t?t.mutatedKeys:this.mutatedKeys,a=i,c=!1;const u=this.query.limitType==="F"&&i.size===this.query.limit?i.last():null,h=this.query.limitType==="L"&&i.size===this.query.limit?i.first():null;if(e.inorderTraversal((f,m)=>{const y=i.get(f),b=vo(this.query,m)?m:null,k=!!y&&this.mutatedKeys.has(y.key),V=!!b&&(b.hasLocalMutations||this.mutatedKeys.has(b.key)&&b.hasCommittedMutations);let N=!1;y&&b?y.data.isEqual(b.data)?k!==V&&(r.track({type:3,doc:b}),N=!0):this.su(y,b)||(r.track({type:2,doc:b}),N=!0,(u&&this.eu(b,u)>0||h&&this.eu(b,h)<0)&&(c=!0)):!y&&b?(r.track({type:0,doc:b}),N=!0):y&&!b&&(r.track({type:1,doc:y}),N=!0,(u||h)&&(c=!0)),N&&(b?(a=a.add(b),s=V?s.add(f):s.delete(f)):(a=a.delete(f),s=s.delete(f)))}),this.query.limit!==null)for(;a.size>this.query.limit;){const f=this.query.limitType==="F"?a.last():a.first();a=a.delete(f.key),s=s.delete(f.key),r.track({type:1,doc:f})}return{tu:a,iu:r,Ss:c,mutatedKeys:s}}su(e,t){return e.hasLocalMutations&&t.hasCommittedMutations&&!t.hasLocalMutations}applyChanges(e,t,r,i){const s=this.tu;this.tu=e.tu,this.mutatedKeys=e.mutatedKeys;const a=e.iu.ya();a.sort((f,m)=>function(b,k){const V=N=>{switch(N){case 0:return 1;case 2:case 3:return 2;case 1:return 0;default:return x(20277,{Vt:N})}};return V(b)-V(k)}(f.type,m.type)||this.eu(f.doc,m.doc)),this.ou(r),i=i??!1;const c=t&&!i?this._u():[],u=this.Ya.size===0&&this.current&&!i?1:0,h=u!==this.Xa;return this.Xa=u,a.length!==0||h?{snapshot:new pr(this.query,e.tu,s,a,e.mutatedKeys,u===0,h,!1,!!r&&r.resumeToken.approximateByteSize()>0),au:c}:{au:c}}va(e){return this.current&&e==="Offline"?(this.current=!1,this.applyChanges({tu:this.tu,iu:new bd,mutatedKeys:this.mutatedKeys,Ss:!1},!1)):{au:[]}}uu(e){return!this.Za.has(e)&&!!this.tu.has(e)&&!this.tu.get(e).hasLocalMutations}ou(e){e&&(e.addedDocuments.forEach(t=>this.Za=this.Za.add(t)),e.modifiedDocuments.forEach(t=>{}),e.removedDocuments.forEach(t=>this.Za=this.Za.delete(t)),this.current=e.current)}_u(){if(!this.current)return[];const e=this.Ya;this.Ya=G(),this.tu.forEach(r=>{this.uu(r.key)&&(this.Ya=this.Ya.add(r.key))});const t=[];return e.forEach(r=>{this.Ya.has(r)||t.push(new rg(r))}),this.Ya.forEach(r=>{e.has(r)||t.push(new ng(r))}),t}cu(e){this.Za=e.ks,this.Ya=G();const t=this.ru(e.documents);return this.applyChanges(t,!0)}lu(){return pr.fromInitialDocuments(this.query,this.tu,this.mutatedKeys,this.Xa===0,this.hasCachedResults)}}const yu="SyncEngine";class Ob{constructor(e,t,r){this.query=e,this.targetId=t,this.view=r}}class Vb{constructor(e){this.key=e,this.hu=!1}}class Mb{constructor(e,t,r,i,s,a){this.localStore=e,this.remoteStore=t,this.eventManager=r,this.sharedClientState=i,this.currentUser=s,this.maxConcurrentLimboResolutions=a,this.Pu={},this.Tu=new Un(c=>_m(c),wo),this.Iu=new Map,this.Eu=new Set,this.Ru=new ae(U.comparator),this.Au=new Map,this.Vu=new au,this.du={},this.mu=new Map,this.fu=fr.ar(),this.onlineState="Unknown",this.gu=void 0}get isPrimaryClient(){return this.gu===!0}}async function Lb(n,e,t=!0){const r=ug(n);let i;const s=r.Tu.get(e);return s?(r.sharedClientState.addLocalQueryTarget(s.targetId),i=s.view.lu()):i=await ig(r,e,t,!0),i}async function Ub(n,e){const t=ug(n);await ig(t,e,!0,!1)}async function ig(n,e,t,r){const i=await nb(n.localStore,mt(e)),s=i.targetId,a=n.sharedClientState.addLocalQueryTarget(s,t);let c;return r&&(c=await xb(n,e,s,a==="current",i.resumeToken)),n.isPrimaryClient&&t&&Gm(n.remoteStore,i),c}async function xb(n,e,t,r,i){n.pu=(m,y,b)=>async function(V,N,F,$){let j=N.view.ru(F);j.Ss&&(j=await Ed(V.localStore,N.query,!1).then(({documents:I})=>N.view.ru(I,j)));const Y=$&&$.targetChanges.get(N.targetId),se=$&&$.targetMismatches.get(N.targetId)!=null,oe=N.view.applyChanges(j,V.isPrimaryClient,Y,se);return kd(V,N.targetId,oe.au),oe.snapshot}(n,m,y,b);const s=await Ed(n.localStore,e,!0),a=new Db(e,s.ks),c=a.ru(s.documents),u=Fi.createSynthesizedTargetChangeForCurrentChange(t,r&&n.onlineState!=="Offline",i),h=a.applyChanges(c,n.isPrimaryClient,u);kd(n,t,h.au);const f=new Ob(e,t,a);return n.Tu.set(e,f),n.Iu.has(t)?n.Iu.get(t).push(e):n.Iu.set(t,[e]),h.snapshot}async function Fb(n,e,t){const r=q(n),i=r.Tu.get(e),s=r.Iu.get(i.targetId);if(s.length>1)return r.Iu.set(i.targetId,s.filter(a=>!wo(a,e))),void r.Tu.delete(e);r.isPrimaryClient?(r.sharedClientState.removeLocalQueryTarget(i.targetId),r.sharedClientState.isActiveQueryTarget(i.targetId)||await hc(r.localStore,i.targetId,!1).then(()=>{r.sharedClientState.clearQueryState(i.targetId),t&&hu(r.remoteStore,i.targetId),pc(r,i.targetId)}).catch(Ar)):(pc(r,i.targetId),await hc(r.localStore,i.targetId,!0))}async function Bb(n,e){const t=q(n),r=t.Tu.get(e),i=t.Iu.get(r.targetId);t.isPrimaryClient&&i.length===1&&(t.sharedClientState.removeLocalQueryTarget(r.targetId),hu(t.remoteStore,r.targetId))}async function $b(n,e,t){const r=Kb(n);try{const i=await function(a,c){const u=q(a),h=ee.now(),f=c.reduce((b,k)=>b.add(k.key),G());let m,y;return u.persistence.runTransaction("Locally write mutations","readwrite",b=>{let k=Ut(),V=G();return u.xs.getEntries(b,f).next(N=>{k=N,k.forEach((F,$)=>{$.isValidDocument()||(V=V.add(F))})}).next(()=>u.localDocuments.getOverlayedDocuments(b,k)).next(N=>{m=N;const F=[];for(const $ of c){const j=nR($,m.get($.key).overlayedDocument);j!=null&&F.push(new xn($.key,j,um(j.value.mapValue),at.exists(!0)))}return u.mutationQueue.addMutationBatch(b,h,F,c)}).next(N=>{y=N;const F=N.applyToLocalDocumentSet(m,V);return u.documentOverlayCache.saveOverlays(b,N.batchId,F)})}).then(()=>({batchId:y.batchId,changes:Em(m)}))}(r.localStore,e);r.sharedClientState.addPendingMutation(i.batchId),function(a,c,u){let h=a.du[a.currentUser.toKey()];h||(h=new ae(W)),h=h.insert(c,u),a.du[a.currentUser.toKey()]=h}(r,i.batchId,t),await $i(r,i.changes),await Co(r.remoteStore)}catch(i){const s=gu(i,"Failed to persist write");t.reject(s)}}async function sg(n,e){const t=q(n);try{const r=await ZR(t.localStore,e);e.targetChanges.forEach((i,s)=>{const a=t.Au.get(s);a&&(Q(i.addedDocuments.size+i.modifiedDocuments.size+i.removedDocuments.size<=1,22616),i.addedDocuments.size>0?a.hu=!0:i.modifiedDocuments.size>0?Q(a.hu,14607):i.removedDocuments.size>0&&(Q(a.hu,42227),a.hu=!1))}),await $i(t,r,e)}catch(r){await Ar(r)}}function Cd(n,e,t){const r=q(n);if(r.isPrimaryClient&&t===0||!r.isPrimaryClient&&t===1){const i=[];r.Tu.forEach((s,a)=>{const c=a.view.va(e);c.snapshot&&i.push(c.snapshot)}),function(a,c){const u=q(a);u.onlineState=c;let h=!1;u.queries.forEach((f,m)=>{for(const y of m.ba)y.va(c)&&(h=!0)}),h&&_u(u)}(r.eventManager,e),i.length&&r.Pu.J_(i),r.onlineState=e,r.isPrimaryClient&&r.sharedClientState.setOnlineState(e)}}async function qb(n,e,t){const r=q(n);r.sharedClientState.updateQueryState(e,"rejected",t);const i=r.Au.get(e),s=i&&i.key;if(s){let a=new ae(U.comparator);a=a.insert(s,Oe.newNoDocument(s,B.min()));const c=G().add(s),u=new bo(B.min(),new Map,new ae(W),a,c);await sg(r,u),r.Ru=r.Ru.remove(s),r.Au.delete(e),Tu(r)}else await hc(r.localStore,e,!1).then(()=>pc(r,e,t)).catch(Ar)}async function jb(n,e){const t=q(n),r=e.batch.batchId;try{const i=await XR(t.localStore,e);ag(t,r,null),og(t,r),t.sharedClientState.updateMutationState(r,"acknowledged"),await $i(t,i)}catch(i){await Ar(i)}}async function Hb(n,e,t){const r=q(n);try{const i=await function(a,c){const u=q(a);return u.persistence.runTransaction("Reject batch","readwrite-primary",h=>{let f;return u.mutationQueue.lookupMutationBatch(h,c).next(m=>(Q(m!==null,37113),f=m.keys(),u.mutationQueue.removeMutationBatch(h,m))).next(()=>u.mutationQueue.performConsistencyCheck(h)).next(()=>u.documentOverlayCache.removeOverlaysForBatchId(h,f,c)).next(()=>u.localDocuments.recalculateAndSaveOverlaysForDocumentKeys(h,f)).next(()=>u.localDocuments.getDocuments(h,f))})}(r.localStore,e);ag(r,e,t),og(r,e),r.sharedClientState.updateMutationState(e,"rejected",t),await $i(r,i)}catch(i){await Ar(i)}}function og(n,e){(n.mu.get(e)||[]).forEach(t=>{t.resolve()}),n.mu.delete(e)}function ag(n,e,t){const r=q(n);let i=r.du[r.currentUser.toKey()];if(i){const s=i.get(e);s&&(t?s.reject(t):s.resolve(),i=i.remove(e)),r.du[r.currentUser.toKey()]=i}}function pc(n,e,t=null){n.sharedClientState.removeLocalQueryTarget(e);for(const r of n.Iu.get(e))n.Tu.delete(r),t&&n.Pu.yu(r,t);n.Iu.delete(e),n.isPrimaryClient&&n.Vu.Gr(e).forEach(r=>{n.Vu.containsKey(r)||cg(n,r)})}function cg(n,e){n.Eu.delete(e.path.canonicalString());const t=n.Ru.get(e);t!==null&&(hu(n.remoteStore,t),n.Ru=n.Ru.remove(e),n.Au.delete(t),Tu(n))}function kd(n,e,t){for(const r of t)r instanceof ng?(n.Vu.addReference(r.key,e),zb(n,r)):r instanceof rg?(M(yu,"Document no longer in limbo: "+r.key),n.Vu.removeReference(r.key,e),n.Vu.containsKey(r.key)||cg(n,r.key)):x(19791,{wu:r})}function zb(n,e){const t=e.key,r=t.path.canonicalString();n.Ru.get(t)||n.Eu.has(r)||(M(yu,"New document in limbo: "+t),n.Eu.add(r),Tu(n))}function Tu(n){for(;n.Eu.size>0&&n.Ru.size<n.maxConcurrentLimboResolutions;){const e=n.Eu.values().next().value;n.Eu.delete(e);const t=new U(X.fromString(e)),r=n.fu.next();n.Au.set(r,new Vb(t)),n.Ru=n.Ru.insert(t,r),Gm(n.remoteStore,new Qt(mt(tu(t.path)),r,"TargetPurposeLimboResolution",To.ce))}}async function $i(n,e,t){const r=q(n),i=[],s=[],a=[];r.Tu.isEmpty()||(r.Tu.forEach((c,u)=>{a.push(r.pu(u,e,t).then(h=>{var f;if((h||t)&&r.isPrimaryClient){const m=h?!h.fromCache:(f=t==null?void 0:t.targetChanges.get(u.targetId))==null?void 0:f.current;r.sharedClientState.updateQueryState(u.targetId,m?"current":"not-current")}if(h){i.push(h);const m=uu.Es(u.targetId,h);s.push(m)}}))}),await Promise.all(a),r.Pu.J_(i),await async function(u,h){const f=q(u);try{await f.persistence.runTransaction("notifyLocalViewChanges","readwrite",m=>P.forEach(h,y=>P.forEach(y.Ts,b=>f.persistence.referenceDelegate.addReference(m,y.targetId,b)).next(()=>P.forEach(y.Is,b=>f.persistence.referenceDelegate.removeReference(m,y.targetId,b)))))}catch(m){if(!Rr(m))throw m;M(lu,"Failed to update sequence numbers: "+m)}for(const m of h){const y=m.targetId;if(!m.fromCache){const b=f.vs.get(y),k=b.snapshotVersion,V=b.withLastLimboFreeSnapshotVersion(k);f.vs=f.vs.insert(y,V)}}}(r.localStore,s))}async function Wb(n,e){const t=q(n);if(!t.currentUser.isEqual(e)){M(yu,"User change. New user:",e.toKey());const r=await jm(t.localStore,e);t.currentUser=e,function(s,a){s.mu.forEach(c=>{c.forEach(u=>{u.reject(new O(S.CANCELLED,a))})}),s.mu.clear()}(t,"'waitForPendingWrites' promise is rejected due to a user change."),t.sharedClientState.handleUserChange(e,r.removedBatchIds,r.addedBatchIds),await $i(t,r.Ns)}}function Gb(n,e){const t=q(n),r=t.Au.get(e);if(r&&r.hu)return G().add(r.key);{let i=G();const s=t.Iu.get(e);if(!s)return i;for(const a of s){const c=t.Tu.get(a);i=i.unionWith(c.view.nu)}return i}}function ug(n){const e=q(n);return e.remoteStore.remoteSyncer.applyRemoteEvent=sg.bind(null,e),e.remoteStore.remoteSyncer.getRemoteKeysForTarget=Gb.bind(null,e),e.remoteStore.remoteSyncer.rejectListen=qb.bind(null,e),e.Pu.J_=kb.bind(null,e.eventManager),e.Pu.yu=Nb.bind(null,e.eventManager),e}function Kb(n){const e=q(n);return e.remoteStore.remoteSyncer.applySuccessfulWrite=jb.bind(null,e),e.remoteStore.remoteSyncer.rejectFailedWrite=Hb.bind(null,e),e}class Ys{constructor(){this.kind="memory",this.synchronizeTabs=!1}async initialize(e){this.serializer=So(e.databaseInfo.databaseId),this.sharedClientState=this.Du(e),this.persistence=this.Cu(e),await this.persistence.start(),this.localStore=this.vu(e),this.gcScheduler=this.Fu(e,this.localStore),this.indexBackfillerScheduler=this.Mu(e,this.localStore)}Fu(e,t){return null}Mu(e,t){return null}vu(e){return JR(this.persistence,new KR,e.initialUser,this.serializer)}Cu(e){return new qm(cu.Vi,this.serializer)}Du(e){return new ib}async terminate(){var e,t;(e=this.gcScheduler)==null||e.stop(),(t=this.indexBackfillerScheduler)==null||t.stop(),this.sharedClientState.shutdown(),await this.persistence.shutdown()}}Ys.provider={build:()=>new Ys};class Yb extends Ys{constructor(e){super(),this.cacheSizeBytes=e}Fu(e,t){Q(this.persistence.referenceDelegate instanceof Gs,46915);const r=this.persistence.referenceDelegate.garbageCollector;return new OR(r,e.asyncQueue,t)}Cu(e){const t=this.cacheSizeBytes!==void 0?ze.withCacheSize(this.cacheSizeBytes):ze.DEFAULT;return new qm(r=>Gs.Vi(r,t),this.serializer)}}class mc{async initialize(e,t){this.localStore||(this.localStore=e.localStore,this.sharedClientState=e.sharedClientState,this.datastore=this.createDatastore(t),this.remoteStore=this.createRemoteStore(t),this.eventManager=this.createEventManager(t),this.syncEngine=this.createSyncEngine(t,!e.synchronizeTabs),this.sharedClientState.onlineStateHandler=r=>Cd(this.syncEngine,r,1),this.remoteStore.remoteSyncer.handleCredentialChange=Wb.bind(null,this.syncEngine),await Sb(this.remoteStore,this.syncEngine.isPrimaryClient))}createEventManager(e){return function(){return new Cb}()}createDatastore(e){const t=So(e.databaseInfo.databaseId),r=ub(e.databaseInfo);return pb(e.authCredentials,e.appCheckCredentials,r,t)}createRemoteStore(e){return function(r,i,s,a,c){return new gb(r,i,s,a,c)}(this.localStore,this.datastore,e.asyncQueue,t=>Cd(this.syncEngine,t,0),function(){return vd.v()?new vd:new sb}())}createSyncEngine(e,t){return function(i,s,a,c,u,h,f){const m=new Mb(i,s,a,c,u,h);return f&&(m.gu=!0),m}(this.localStore,this.remoteStore,this.eventManager,this.sharedClientState,e.initialUser,e.maxConcurrentLimboResolutions,t)}async terminate(){var e,t;await async function(i){const s=q(i);M(Cn,"RemoteStore shutting down."),s.Ea.add(5),await Bi(s),s.Aa.shutdown(),s.Va.set("Unknown")}(this.remoteStore),(e=this.datastore)==null||e.terminate(),(t=this.eventManager)==null||t.terminate()}}mc.provider={build:()=>new mc};/**
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
 *//**
 * @license
 * Copyright 2017 Google LLC
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
 */class lg{constructor(e){this.observer=e,this.muted=!1}next(e){this.muted||this.observer.next&&this.Ou(this.observer.next,e)}error(e){this.muted||(this.observer.error?this.Ou(this.observer.error,e):Lt("Uncaught Error in snapshot listener:",e.toString()))}Nu(){this.muted=!0}Ou(e,t){setTimeout(()=>{this.muted||e(t)},0)}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */const ln="FirestoreClient";class Qb{constructor(e,t,r,i,s){this.authCredentials=e,this.appCheckCredentials=t,this.asyncQueue=r,this._databaseInfo=i,this.user=He.UNAUTHENTICATED,this.clientId=Yc.newId(),this.authCredentialListener=()=>Promise.resolve(),this.appCheckCredentialListener=()=>Promise.resolve(),this._uninitializedComponentsProvider=s,this.authCredentials.start(r,async a=>{M(ln,"Received user=",a.uid),await this.authCredentialListener(a),this.user=a}),this.appCheckCredentials.start(r,a=>(M(ln,"Received new app check token=",a),this.appCheckCredentialListener(a,this.user)))}get configuration(){return{asyncQueue:this.asyncQueue,databaseInfo:this._databaseInfo,clientId:this.clientId,authCredentials:this.authCredentials,appCheckCredentials:this.appCheckCredentials,initialUser:this.user,maxConcurrentLimboResolutions:100}}setCredentialChangeListener(e){this.authCredentialListener=e}setAppCheckTokenChangeListener(e){this.appCheckCredentialListener=e}terminate(){this.asyncQueue.enterRestrictedMode();const e=new kt;return this.asyncQueue.enqueueAndForgetEvenWhileRestricted(async()=>{try{this._onlineComponents&&await this._onlineComponents.terminate(),this._offlineComponents&&await this._offlineComponents.terminate(),this.authCredentials.shutdown(),this.appCheckCredentials.shutdown(),e.resolve()}catch(t){const r=gu(t,"Failed to shutdown persistence");e.reject(r)}}),e.promise}}async function Ra(n,e){n.asyncQueue.verifyOperationInProgress(),M(ln,"Initializing OfflineComponentProvider");const t=n.configuration;await e.initialize(t);let r=t.initialUser;n.setCredentialChangeListener(async i=>{r.isEqual(i)||(await jm(e.localStore,i),r=i)}),e.persistence.setDatabaseDeletedListener(()=>n.terminate()),n._offlineComponents=e}async function Nd(n,e){n.asyncQueue.verifyOperationInProgress();const t=await Jb(n);M(ln,"Initializing OnlineComponentProvider"),await e.initialize(t,n.configuration),n.setCredentialChangeListener(r=>Rd(e.remoteStore,r)),n.setAppCheckTokenChangeListener((r,i)=>Rd(e.remoteStore,i)),n._onlineComponents=e}async function Jb(n){if(!n._offlineComponents)if(n._uninitializedComponentsProvider){M(ln,"Using user provided OfflineComponentProvider");try{await Ra(n,n._uninitializedComponentsProvider._offline)}catch(e){const t=e;if(!function(i){return i.name==="FirebaseError"?i.code===S.FAILED_PRECONDITION||i.code===S.UNIMPLEMENTED:!(typeof DOMException<"u"&&i instanceof DOMException)||i.code===22||i.code===20||i.code===11}(t))throw t;ur("Error using user provided cache. Falling back to memory cache: "+t),await Ra(n,new Ys)}}else M(ln,"Using default OfflineComponentProvider"),await Ra(n,new Yb(void 0));return n._offlineComponents}async function hg(n){return n._onlineComponents||(n._uninitializedComponentsProvider?(M(ln,"Using user provided OnlineComponentProvider"),await Nd(n,n._uninitializedComponentsProvider._online)):(M(ln,"Using default OnlineComponentProvider"),await Nd(n,new mc))),n._onlineComponents}function Xb(n){return hg(n).then(e=>e.syncEngine)}async function dg(n){const e=await hg(n),t=e.eventManager;return t.onListen=Lb.bind(null,e.syncEngine),t.onUnlisten=Fb.bind(null,e.syncEngine),t.onFirstRemoteStoreListen=Ub.bind(null,e.syncEngine),t.onLastRemoteStoreUnlisten=Bb.bind(null,e.syncEngine),t}function Zb(n,e,t={}){const r=new kt;return n.asyncQueue.enqueueAndForget(async()=>function(s,a,c,u,h){const f=new lg({next:y=>{f.Nu(),a.enqueueAndForget(()=>eg(s,m));const b=y.docs.has(c);!b&&y.fromCache?h.reject(new O(S.UNAVAILABLE,"Failed to get document because the client is offline.")):b&&y.fromCache&&u&&u.source==="server"?h.reject(new O(S.UNAVAILABLE,'Failed to get document from server. (However, this document does exist in the local cache. Run again without setting source to "server" to retrieve the cached document.)')):h.resolve(y)},error:y=>h.reject(y)}),m=new tg(tu(c.path),f,{includeMetadataChanges:!0,Ka:!0});return Zm(s,m)}(await dg(n),n.asyncQueue,e,t,r)),r.promise}function eS(n,e,t={}){const r=new kt;return n.asyncQueue.enqueueAndForget(async()=>function(s,a,c,u,h){const f=new lg({next:y=>{f.Nu(),a.enqueueAndForget(()=>eg(s,m)),y.fromCache&&u.source==="server"?h.reject(new O(S.UNAVAILABLE,'Failed to get documents from server. (However, these documents may exist in the local cache. Run again without setting source to "server" to retrieve the cached documents.)')):h.resolve(y)},error:y=>h.reject(y)}),m=new tg(c,f,{includeMetadataChanges:!0,Ka:!0});return Zm(s,m)}(await dg(n),n.asyncQueue,e,t,r)),r.promise}function tS(n,e){const t=new kt;return n.asyncQueue.enqueueAndForget(async()=>$b(await Xb(n),e,t)),t.promise}/**
 * @license
 * Copyright 2023 Google LLC
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
 */function fg(n){const e={};return n.timeoutSeconds!==void 0&&(e.timeoutSeconds=n.timeoutSeconds),e}/**
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
 */const nS="ComponentProvider",Dd=new Map;function rS(n,e,t,r,i){return new AA(n,e,t,i.host,i.ssl,i.experimentalForceLongPolling,i.experimentalAutoDetectLongPolling,fg(i.experimentalLongPollingOptions),i.useFetchStreams,i.isUsingEmulator,r)}/**
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
 */const iS="firestore.googleapis.com",Od=!0;class Vd{constructor(e){if(e.host===void 0){if(e.ssl!==void 0)throw new O(S.INVALID_ARGUMENT,"Can't provide ssl option if host option is not set");this.host=iS,this.ssl=Od}else this.host=e.host,this.ssl=e.ssl??Od;if(this.isUsingEmulator=e.emulatorOptions!==void 0,this.credentials=e.credentials,this.ignoreUndefinedProperties=!!e.ignoreUndefinedProperties,this.localCache=e.localCache,e.cacheSizeBytes===void 0)this.cacheSizeBytes=Bm;else{if(e.cacheSizeBytes!==-1&&e.cacheSizeBytes<$m)throw new O(S.INVALID_ARGUMENT,"cacheSizeBytes must be at least 1048576");this.cacheSizeBytes=e.cacheSizeBytes}fA("experimentalForceLongPolling",e.experimentalForceLongPolling,"experimentalAutoDetectLongPolling",e.experimentalAutoDetectLongPolling),this.experimentalForceLongPolling=!!e.experimentalForceLongPolling,this.experimentalForceLongPolling?this.experimentalAutoDetectLongPolling=!1:e.experimentalAutoDetectLongPolling===void 0?this.experimentalAutoDetectLongPolling=!0:this.experimentalAutoDetectLongPolling=!!e.experimentalAutoDetectLongPolling,this.experimentalLongPollingOptions=fg(e.experimentalLongPollingOptions??{}),function(r){if(r.timeoutSeconds!==void 0){if(isNaN(r.timeoutSeconds))throw new O(S.INVALID_ARGUMENT,`invalid long polling timeout: ${r.timeoutSeconds} (must not be NaN)`);if(r.timeoutSeconds<5)throw new O(S.INVALID_ARGUMENT,`invalid long polling timeout: ${r.timeoutSeconds} (minimum allowed value is 5)`);if(r.timeoutSeconds>30)throw new O(S.INVALID_ARGUMENT,`invalid long polling timeout: ${r.timeoutSeconds} (maximum allowed value is 30)`)}}(this.experimentalLongPollingOptions),this.useFetchStreams=!!e.useFetchStreams}isEqual(e){return this.host===e.host&&this.ssl===e.ssl&&this.credentials===e.credentials&&this.cacheSizeBytes===e.cacheSizeBytes&&this.experimentalForceLongPolling===e.experimentalForceLongPolling&&this.experimentalAutoDetectLongPolling===e.experimentalAutoDetectLongPolling&&function(r,i){return r.timeoutSeconds===i.timeoutSeconds}(this.experimentalLongPollingOptions,e.experimentalLongPollingOptions)&&this.ignoreUndefinedProperties===e.ignoreUndefinedProperties&&this.useFetchStreams===e.useFetchStreams}}class Eu{constructor(e,t,r,i){this._authCredentials=e,this._appCheckCredentials=t,this._databaseId=r,this._app=i,this.type="firestore-lite",this._persistenceKey="(lite)",this._settings=new Vd({}),this._settingsFrozen=!1,this._emulatorOptions={},this._terminateTask="notTerminated"}get app(){if(!this._app)throw new O(S.FAILED_PRECONDITION,"Firestore was not initialized using the Firebase SDK. 'app' is not available");return this._app}get _initialized(){return this._settingsFrozen}get _terminated(){return this._terminateTask!=="notTerminated"}_setSettings(e){if(this._settingsFrozen)throw new O(S.FAILED_PRECONDITION,"Firestore has already been started and its settings can no longer be changed. You can only modify settings before calling any other methods on a Firestore object.");this._settings=new Vd(e),this._emulatorOptions=e.emulatorOptions||{},e.credentials!==void 0&&(this._authCredentials=function(r){if(!r)return new iA;switch(r.type){case"firstParty":return new aA(r.sessionIndex||"0",r.iamToken||null,r.authTokenFactory||null);case"provider":return r.client;default:throw new O(S.INVALID_ARGUMENT,"makeAuthCredentialsProvider failed due to invalid credential type")}}(e.credentials))}_getSettings(){return this._settings}_getEmulatorOptions(){return this._emulatorOptions}_freezeSettings(){return this._settingsFrozen=!0,this._settings}_delete(){return this._terminateTask==="notTerminated"&&(this._terminateTask=this._terminate()),this._terminateTask}async _restart(){this._terminateTask==="notTerminated"?await this._terminate():this._terminateTask="notTerminated"}toJSON(){return{app:this._app,databaseId:this._databaseId,settings:this._settings}}_terminate(){return function(t){const r=Dd.get(t);r&&(M(nS,"Removing Datastore"),Dd.delete(t),r.terminate())}(this),Promise.resolve()}}/**
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
 */class Bn{constructor(e,t,r){this.converter=t,this._query=r,this.type="query",this.firestore=e}withConverter(e){return new Bn(this.firestore,e,this._query)}}class _e{constructor(e,t,r){this.converter=t,this._key=r,this.type="document",this.firestore=e}get _path(){return this._key.path}get id(){return this._key.path.lastSegment()}get path(){return this._key.path.canonicalString()}get parent(){return new nn(this.firestore,this.converter,this._key.path.popLast())}withConverter(e){return new _e(this.firestore,e,this._key)}toJSON(){return{type:_e._jsonSchemaVersion,referencePath:this._key.toString()}}static fromJSON(e,t,r){if(Ui(t,_e._jsonSchema))return new _e(e,r||null,new U(X.fromString(t.referencePath)))}}_e._jsonSchemaVersion="firestore/documentReference/1.0",_e._jsonSchema={type:ge("string",_e._jsonSchemaVersion),referencePath:ge("string")};class nn extends Bn{constructor(e,t,r){super(e,t,tu(r)),this._path=r,this.type="collection"}get id(){return this._query.path.lastSegment()}get path(){return this._query.path.canonicalString()}get parent(){const e=this._path.popLast();return e.isEmpty()?null:new _e(this.firestore,null,new U(e))}withConverter(e){return new nn(this.firestore,e,this._path)}}function Y0(n,e,...t){if(n=L(n),Xp("collection","path",e),n instanceof Eu){const r=X.fromString(e,...t);return Gh(r),new nn(n,null,r)}{if(!(n instanceof _e||n instanceof nn))throw new O(S.INVALID_ARGUMENT,"Expected first argument to collection() to be a CollectionReference, a DocumentReference or FirebaseFirestore");const r=n._path.child(X.fromString(e,...t));return Gh(r),new nn(n.firestore,null,r)}}function sS(n,e,...t){if(n=L(n),arguments.length===1&&(e=Yc.newId()),Xp("doc","path",e),n instanceof Eu){const r=X.fromString(e,...t);return Wh(r),new _e(n,null,new U(r))}{if(!(n instanceof _e||n instanceof nn))throw new O(S.INVALID_ARGUMENT,"Expected first argument to doc() to be a CollectionReference, a DocumentReference or FirebaseFirestore");const r=n._path.child(X.fromString(e,...t));return Wh(r),new _e(n.firestore,n instanceof nn?n.converter:null,new U(r))}}/**
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
 */const Md="AsyncQueue";class Ld{constructor(e=Promise.resolve()){this.Yu=[],this.ec=!1,this.tc=[],this.nc=null,this.rc=!1,this.sc=!1,this.oc=[],this.M_=new zm(this,"async_queue_retry"),this._c=()=>{const r=Aa();r&&M(Md,"Visibility state changed to "+r.visibilityState),this.M_.w_()},this.ac=e;const t=Aa();t&&typeof t.addEventListener=="function"&&t.addEventListener("visibilitychange",this._c)}get isShuttingDown(){return this.ec}enqueueAndForget(e){this.enqueue(e)}enqueueAndForgetEvenWhileRestricted(e){this.uc(),this.cc(e)}enterRestrictedMode(e){if(!this.ec){this.ec=!0,this.sc=e||!1;const t=Aa();t&&typeof t.removeEventListener=="function"&&t.removeEventListener("visibilitychange",this._c)}}enqueue(e){if(this.uc(),this.ec)return new Promise(()=>{});const t=new kt;return this.cc(()=>this.ec&&this.sc?Promise.resolve():(e().then(t.resolve,t.reject),t.promise)).then(()=>t.promise)}enqueueRetryable(e){this.enqueueAndForget(()=>(this.Yu.push(e),this.lc()))}async lc(){if(this.Yu.length!==0){try{await this.Yu[0](),this.Yu.shift(),this.M_.reset()}catch(e){if(!Rr(e))throw e;M(Md,"Operation failed with retryable error: "+e)}this.Yu.length>0&&this.M_.p_(()=>this.lc())}}cc(e){const t=this.ac.then(()=>(this.rc=!0,e().catch(r=>{throw this.nc=r,this.rc=!1,Lt("INTERNAL UNHANDLED ERROR: ",Ud(r)),r}).then(r=>(this.rc=!1,r))));return this.ac=t,t}enqueueAfterDelay(e,t,r){this.uc(),this.oc.indexOf(e)>-1&&(t=0);const i=mu.createAndSchedule(this,e,t,r,s=>this.hc(s));return this.tc.push(i),i}uc(){this.nc&&x(47125,{Pc:Ud(this.nc)})}verifyOperationInProgress(){}async Tc(){let e;do e=this.ac,await e;while(e!==this.ac)}Ic(e){for(const t of this.tc)if(t.timerId===e)return!0;return!1}Ec(e){return this.Tc().then(()=>{this.tc.sort((t,r)=>t.targetTimeMs-r.targetTimeMs);for(const t of this.tc)if(t.skipDelay(),e!=="all"&&t.timerId===e)break;return this.Tc()})}Rc(e){this.oc.push(e)}hc(e){const t=this.tc.indexOf(e);this.tc.splice(t,1)}}function Ud(n){let e=n.message||"";return n.stack&&(e=n.stack.includes(n.message)?n.stack:n.message+`
`+n.stack),e}class Pr extends Eu{constructor(e,t,r,i){super(e,t,r,i),this.type="firestore",this._queue=new Ld,this._persistenceKey=(i==null?void 0:i.name)||"[DEFAULT]"}async _terminate(){if(this._firestoreClient){const e=this._firestoreClient.terminate();this._queue=new Ld(e),this._firestoreClient=void 0,await e}}}function Q0(n,e,t){t||(t=$s);const r=Ke(n,"firestore");if(r.isInitialized(t)){const i=r.getImmediate({identifier:t}),s=r.getOptions(t);if(Dt(s,e))return i;throw new O(S.FAILED_PRECONDITION,"initializeFirestore() has already been called with different options. To avoid this error, call initializeFirestore() with the same options as when it was originally called, or call getFirestore() to return the already initialized instance.")}if(e.cacheSizeBytes!==void 0&&e.localCache!==void 0)throw new O(S.INVALID_ARGUMENT,"cache and cacheSizeBytes cannot be specified at the same time as cacheSizeBytes willbe deprecated. Instead, specify the cache size in the cache object");if(e.cacheSizeBytes!==void 0&&e.cacheSizeBytes!==-1&&e.cacheSizeBytes<$m)throw new O(S.INVALID_ARGUMENT,"cacheSizeBytes must be at least 1048576");return e.host&&fn(e.host)&&Sc(e.host),r.initialize({options:e,instanceIdentifier:t})}function Iu(n){if(n._terminated)throw new O(S.FAILED_PRECONDITION,"The client has already been terminated.");return n._firestoreClient||oS(n),n._firestoreClient}function oS(n){var r,i,s,a;const e=n._freezeSettings(),t=rS(n._databaseId,((r=n._app)==null?void 0:r.options.appId)||"",n._persistenceKey,(i=n._app)==null?void 0:i.options.apiKey,e);n._componentsProvider||(s=e.localCache)!=null&&s._offlineComponentProvider&&((a=e.localCache)!=null&&a._onlineComponentProvider)&&(n._componentsProvider={_offline:e.localCache._offlineComponentProvider,_online:e.localCache._onlineComponentProvider}),n._firestoreClient=new Qb(n._authCredentials,n._appCheckCredentials,n._queue,t,n._componentsProvider&&function(u){const h=u==null?void 0:u._online.build();return{_offline:u==null?void 0:u._offline.build(h),_online:h}}(n._componentsProvider))}/**
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
 */class tt{constructor(e){this._byteString=e}static fromBase64String(e){try{return new tt(ke.fromBase64String(e))}catch(t){throw new O(S.INVALID_ARGUMENT,"Failed to construct data from Base64 string: "+t)}}static fromUint8Array(e){return new tt(ke.fromUint8Array(e))}toBase64(){return this._byteString.toBase64()}toUint8Array(){return this._byteString.toUint8Array()}toString(){return"Bytes(base64: "+this.toBase64()+")"}isEqual(e){return this._byteString.isEqual(e._byteString)}toJSON(){return{type:tt._jsonSchemaVersion,bytes:this.toBase64()}}static fromJSON(e){if(Ui(e,tt._jsonSchema))return tt.fromBase64String(e.bytes)}}tt._jsonSchemaVersion="firestore/bytes/1.0",tt._jsonSchema={type:ge("string",tt._jsonSchemaVersion),bytes:ge("string")};/**
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
 */class pg{constructor(...e){for(let t=0;t<e.length;++t)if(e[t].length===0)throw new O(S.INVALID_ARGUMENT,"Invalid field name at argument $(i + 1). Field names must not be empty.");this._internalPath=new Se(e)}isEqual(e){return this._internalPath.isEqual(e._internalPath)}}/**
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
 */class mg{constructor(e){this._methodName=e}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class _t{constructor(e,t){if(!isFinite(e)||e<-90||e>90)throw new O(S.INVALID_ARGUMENT,"Latitude must be a number between -90 and 90, but was: "+e);if(!isFinite(t)||t<-180||t>180)throw new O(S.INVALID_ARGUMENT,"Longitude must be a number between -180 and 180, but was: "+t);this._lat=e,this._long=t}get latitude(){return this._lat}get longitude(){return this._long}isEqual(e){return this._lat===e._lat&&this._long===e._long}_compareTo(e){return W(this._lat,e._lat)||W(this._long,e._long)}toJSON(){return{latitude:this._lat,longitude:this._long,type:_t._jsonSchemaVersion}}static fromJSON(e){if(Ui(e,_t._jsonSchema))return new _t(e.latitude,e.longitude)}}_t._jsonSchemaVersion="firestore/geoPoint/1.0",_t._jsonSchema={type:ge("string",_t._jsonSchemaVersion),latitude:ge("number"),longitude:ge("number")};/**
 * @license
 * Copyright 2024 Google LLC
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
 */class ct{constructor(e){this._values=(e||[]).map(t=>t)}toArray(){return this._values.map(e=>e)}isEqual(e){return function(r,i){if(r.length!==i.length)return!1;for(let s=0;s<r.length;++s)if(r[s]!==i[s])return!1;return!0}(this._values,e._values)}toJSON(){return{type:ct._jsonSchemaVersion,vectorValues:this._values}}static fromJSON(e){if(Ui(e,ct._jsonSchema)){if(Array.isArray(e.vectorValues)&&e.vectorValues.every(t=>typeof t=="number"))return new ct(e.vectorValues);throw new O(S.INVALID_ARGUMENT,"Expected 'vectorValues' field to be a number array")}}}ct._jsonSchemaVersion="firestore/vectorValue/1.0",ct._jsonSchema={type:ge("string",ct._jsonSchemaVersion),vectorValues:ge("object")};/**
 * @license
 * Copyright 2017 Google LLC
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
 */const aS=/^__.*__$/;class cS{constructor(e,t,r){this.data=e,this.fieldMask=t,this.fieldTransforms=r}toMutation(e,t){return this.fieldMask!==null?new xn(e,this.data,this.fieldMask,t,this.fieldTransforms):new xi(e,this.data,t,this.fieldTransforms)}}function gg(n){switch(n){case 0:case 2:case 1:return!0;case 3:case 4:return!1;default:throw x(40011,{dataSource:n})}}class wu{constructor(e,t,r,i,s,a){this.settings=e,this.databaseId=t,this.serializer=r,this.ignoreUndefinedProperties=i,s===void 0&&this.validatePath(),this.fieldTransforms=s||[],this.fieldMask=a||[]}get path(){return this.settings.path}get dataSource(){return this.settings.dataSource}contextWith(e){return new wu({...this.settings,...e},this.databaseId,this.serializer,this.ignoreUndefinedProperties,this.fieldTransforms,this.fieldMask)}childContextForField(e){var i;const t=(i=this.path)==null?void 0:i.child(e),r=this.contextWith({path:t,arrayElement:!1});return r.validatePathSegment(e),r}childContextForFieldPath(e){var i;const t=(i=this.path)==null?void 0:i.child(e),r=this.contextWith({path:t,arrayElement:!1});return r.validatePath(),r}childContextForArray(e){return this.contextWith({path:void 0,arrayElement:!0})}createError(e){return Qs(e,this.settings.methodName,this.settings.hasConverter||!1,this.path,this.settings.targetDoc)}contains(e){return this.fieldMask.find(t=>e.isPrefixOf(t))!==void 0||this.fieldTransforms.find(t=>e.isPrefixOf(t.field))!==void 0}validatePath(){if(this.path)for(let e=0;e<this.path.length;e++)this.validatePathSegment(this.path.get(e))}validatePathSegment(e){if(e.length===0)throw this.createError("Document fields must not be empty");if(gg(this.dataSource)&&aS.test(e))throw this.createError('Document fields cannot begin and end with "__"')}}class uS{constructor(e,t,r){this.databaseId=e,this.ignoreUndefinedProperties=t,this.serializer=r||So(e)}createContext(e,t,r,i=!1){return new wu({dataSource:e,methodName:t,targetDoc:r,path:Se.emptyPath(),arrayElement:!1,hasConverter:i},this.databaseId,this.serializer,this.ignoreUndefinedProperties)}}function vu(n){const e=n._freezeSettings(),t=So(n._databaseId);return new uS(n._databaseId,!!e.ignoreUndefinedProperties,t)}function _g(n,e,t,r,i,s={}){const a=n.createContext(s.merge||s.mergeFields?2:0,e,t,i);Eg("Data must be an object, but it was:",a,r);const c=yg(r,a);let u,h;if(s.merge)u=new ot(a.fieldMask),h=a.fieldTransforms;else if(s.mergeFields){const f=[];for(const m of s.mergeFields){const y=qi(e,m,t);if(!a.contains(y))throw new O(S.INVALID_ARGUMENT,`Field '${y}' is specified in your field mask but missing from your input data.`);fS(f,y)||f.push(y)}u=new ot(f),h=a.fieldTransforms.filter(m=>u.covers(m.field))}else u=null,h=a.fieldTransforms;return new cS(new et(c),u,h)}function lS(n,e,t,r=!1){return Au(t,n.createContext(r?4:3,e))}function Au(n,e){if(Tg(n=L(n)))return Eg("Unsupported field value:",e,n),yg(n,e);if(n instanceof mg)return function(r,i){if(!gg(i.dataSource))throw i.createError(`${r._methodName}() can only be used with update() and set()`);if(!i.path)throw i.createError(`${r._methodName}() is not currently supported inside arrays`);const s=r._toFieldTransform(i);s&&i.fieldTransforms.push(s)}(n,e),null;if(n===void 0&&e.ignoreUndefinedProperties)return null;if(e.path&&e.fieldMask.push(e.path),n instanceof Array){if(e.settings.arrayElement&&e.dataSource!==4)throw e.createError("Nested arrays are not supported");return function(r,i){const s=[];let a=0;for(const c of r){let u=Au(c,i.childContextForArray(a));u==null&&(u={nullValue:"NULL_VALUE"}),s.push(u),a++}return{arrayValue:{values:s}}}(n,e)}return function(r,i){if((r=L(r))===null)return{nullValue:"NULL_VALUE"};if(typeof r=="number")return QA(i.serializer,r);if(typeof r=="boolean")return{booleanValue:r};if(typeof r=="string")return{stringValue:r};if(r instanceof Date){const s=ee.fromDate(r);return{timestampValue:Ws(i.serializer,s)}}if(r instanceof ee){const s=new ee(r.seconds,1e3*Math.floor(r.nanoseconds/1e3));return{timestampValue:Ws(i.serializer,s)}}if(r instanceof _t)return{geoPointValue:{latitude:r.latitude,longitude:r.longitude}};if(r instanceof tt)return{bytesValue:Dm(i.serializer,r._byteString)};if(r instanceof _e){const s=i.databaseId,a=r.firestore._databaseId;if(!a.isEqual(s))throw i.createError(`Document reference is for database ${a.projectId}/${a.database} but should be for database ${s.projectId}/${s.database}`);return{referenceValue:ou(r.firestore._databaseId||i.databaseId,r._key.path)}}if(r instanceof ct)return function(a,c){const u=a instanceof ct?a.toArray():a;return{mapValue:{fields:{[am]:{stringValue:cm},[qs]:{arrayValue:{values:u.map(f=>{if(typeof f!="number")throw c.createError("VectorValues must only contain numeric values.");return nu(c.serializer,f)})}}}}}}(r,i);if(Fm(r))return r._toProto(i.serializer);throw i.createError(`Unsupported field value: ${yo(r)}`)}(n,e)}function yg(n,e){const t={};return tm(n)?e.path&&e.path.length>0&&e.fieldMask.push(e.path):Ln(n,(r,i)=>{const s=Au(i,e.childContextForField(r));s!=null&&(t[r]=s)}),{mapValue:{fields:t}}}function Tg(n){return!(typeof n!="object"||n===null||n instanceof Array||n instanceof Date||n instanceof ee||n instanceof _t||n instanceof tt||n instanceof _e||n instanceof mg||n instanceof ct||Fm(n))}function Eg(n,e,t){if(!Tg(t)||!Zp(t)){const r=yo(t);throw r==="an object"?e.createError(n+" a custom object"):e.createError(n+" "+r)}}function qi(n,e,t){if((e=L(e))instanceof pg)return e._internalPath;if(typeof e=="string")return dS(n,e);throw Qs("Field path arguments must be of type string or ",n,!1,void 0,t)}const hS=new RegExp("[~\\*/\\[\\]]");function dS(n,e,t){if(e.search(hS)>=0)throw Qs(`Invalid field path (${e}). Paths must not contain '~', '*', '/', '[', or ']'`,n,!1,void 0,t);try{return new pg(...e.split("."))._internalPath}catch{throw Qs(`Invalid field path (${e}). Paths must not be empty, begin with '.', end with '.', or contain '..'`,n,!1,void 0,t)}}function Qs(n,e,t,r,i){const s=r&&!r.isEmpty(),a=i!==void 0;let c=`Function ${e}() called with invalid data`;t&&(c+=" (via `toFirestore()`)"),c+=". ";let u="";return(s||a)&&(u+=" (found",s&&(u+=` in field ${r}`),a&&(u+=` in document ${i}`),u+=")"),new O(S.INVALID_ARGUMENT,c+n+u)}function fS(n,e){return n.some(t=>t.isEqual(e))}/**
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
 */class pS{convertValue(e,t="none"){switch(cn(e)){case 0:return null;case 1:return e.booleanValue;case 2:return de(e.integerValue||e.doubleValue);case 3:return this.convertTimestamp(e.timestampValue);case 4:return this.convertServerTimestamp(e,t);case 5:return e.stringValue;case 6:return this.convertBytes(an(e.bytesValue));case 7:return this.convertReference(e.referenceValue);case 8:return this.convertGeoPoint(e.geoPointValue);case 9:return this.convertArray(e.arrayValue,t);case 11:return this.convertObject(e.mapValue,t);case 10:return this.convertVectorValue(e.mapValue);default:throw x(62114,{value:e})}}convertObject(e,t){return this.convertObjectMap(e.fields,t)}convertObjectMap(e,t="none"){const r={};return Ln(e,(i,s)=>{r[i]=this.convertValue(s,t)}),r}convertVectorValue(e){var r,i,s;const t=(s=(i=(r=e.fields)==null?void 0:r[qs].arrayValue)==null?void 0:i.values)==null?void 0:s.map(a=>de(a.doubleValue));return new ct(t)}convertGeoPoint(e){return new _t(de(e.latitude),de(e.longitude))}convertArray(e,t){return(e.values||[]).map(r=>this.convertValue(r,t))}convertServerTimestamp(e,t){switch(t){case"previous":const r=Io(e);return r==null?null:this.convertValue(r,t);case"estimate":return this.convertTimestamp(vi(e));default:return null}}convertTimestamp(e){const t=on(e);return new ee(t.seconds,t.nanos)}convertDocumentKey(e,t){const r=X.fromString(e);Q(xm(r),9688,{name:e});const i=new Ai(r.get(1),r.get(3)),s=new U(r.popFirst(5));return i.isEqual(t)||Lt(`Document ${s} contains a document reference within a different database (${i.projectId}/${i.database}) which is not supported. It will be treated as a reference in the current database (${t.projectId}/${t.database}) instead.`),s}}/**
 * @license
 * Copyright 2024 Google LLC
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
 */class Ig extends pS{constructor(e){super(),this.firestore=e}convertBytes(e){return new tt(e)}convertReference(e){const t=this.convertDocumentKey(e,this.firestore._databaseId);return new _e(this.firestore,null,t)}}const xd="@firebase/firestore",Fd="4.12.0";/**
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
 */class wg{constructor(e,t,r,i,s){this._firestore=e,this._userDataWriter=t,this._key=r,this._document=i,this._converter=s}get id(){return this._key.path.lastSegment()}get ref(){return new _e(this._firestore,this._converter,this._key)}exists(){return this._document!==null}data(){if(this._document){if(this._converter){const e=new mS(this._firestore,this._userDataWriter,this._key,this._document,null);return this._converter.fromFirestore(e)}return this._userDataWriter.convertValue(this._document.data.value)}}_fieldsProto(){var e;return((e=this._document)==null?void 0:e.data.clone().value.mapValue.fields)??void 0}get(e){if(this._document){const t=this._document.data.field(qi("DocumentSnapshot.get",e));if(t!==null)return this._userDataWriter.convertValue(t)}}}class mS extends wg{data(){return super.data()}}/**
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
 */function gS(n){if(n.limitType==="L"&&n.explicitOrderBy.length===0)throw new O(S.UNIMPLEMENTED,"limitToLast() queries require specifying at least one orderBy() clause")}class Ru{}class vg extends Ru{}function J0(n,e,...t){let r=[];e instanceof Ru&&r.push(e),r=r.concat(t),function(s){const a=s.filter(u=>u instanceof bu).length,c=s.filter(u=>u instanceof ko).length;if(a>1||a>0&&c>0)throw new O(S.INVALID_ARGUMENT,"InvalidQuery. When using composite filters, you cannot use more than one filter at the top level. Consider nesting the multiple filters within an `and(...)` statement. For example: change `query(query, where(...), or(...))` to `query(query, and(where(...), or(...)))`.")}(r);for(const i of r)n=i._apply(n);return n}class ko extends vg{constructor(e,t,r){super(),this._field=e,this._op=t,this._value=r,this.type="where"}static _create(e,t,r){return new ko(e,t,r)}_apply(e){const t=this._parse(e);return Ag(e._query,t),new Bn(e.firestore,e.converter,sc(e._query,t))}_parse(e){const t=vu(e.firestore);return function(s,a,c,u,h,f,m){let y;if(h.isKeyField()){if(f==="array-contains"||f==="array-contains-any")throw new O(S.INVALID_ARGUMENT,`Invalid Query. You can't perform '${f}' queries on documentId().`);if(f==="in"||f==="not-in"){$d(m,f);const k=[];for(const V of m)k.push(Bd(u,s,V));y={arrayValue:{values:k}}}else y=Bd(u,s,m)}else f!=="in"&&f!=="not-in"&&f!=="array-contains-any"||$d(m,f),y=lS(c,a,m,f==="in"||f==="not-in");return me.create(h,f,y)}(e._query,"where",t,e.firestore._databaseId,this._field,this._op,this._value)}}function X0(n,e,t){const r=e,i=qi("where",n);return ko._create(i,r,t)}class bu extends Ru{constructor(e,t){super(),this.type=e,this._queryConstraints=t}static _create(e,t){return new bu(e,t)}_parse(e){const t=this._queryConstraints.map(r=>r._parse(e)).filter(r=>r.getFilters().length>0);return t.length===1?t[0]:ut.create(t,this._getOperator())}_apply(e){const t=this._parse(e);return t.getFilters().length===0?e:(function(i,s){let a=i;const c=s.getFlattenedFilters();for(const u of c)Ag(a,u),a=sc(a,u)}(e._query,t),new Bn(e.firestore,e.converter,sc(e._query,t)))}_getQueryConstraints(){return this._queryConstraints}_getOperator(){return this.type==="and"?"and":"or"}}class Su extends vg{constructor(e,t){super(),this._field=e,this._direction=t,this.type="orderBy"}static _create(e,t){return new Su(e,t)}_apply(e){const t=function(i,s,a){if(i.startAt!==null)throw new O(S.INVALID_ARGUMENT,"Invalid query. You must not call startAt() or startAfter() before calling orderBy().");if(i.endAt!==null)throw new O(S.INVALID_ARGUMENT,"Invalid query. You must not call endAt() or endBefore() before calling orderBy().");return new bi(s,a)}(e._query,this._field,this._direction);return new Bn(e.firestore,e.converter,qA(e._query,t))}}function Z0(n,e="asc"){const t=e,r=qi("orderBy",n);return Su._create(r,t)}function Bd(n,e,t){if(typeof(t=L(t))=="string"){if(t==="")throw new O(S.INVALID_ARGUMENT,"Invalid query. When querying with documentId(), you must provide a valid document ID, but it was an empty string.");if(!gm(e)&&t.indexOf("/")!==-1)throw new O(S.INVALID_ARGUMENT,`Invalid query. When querying a collection by documentId(), you must provide a plain document ID, but '${t}' contains a '/' character.`);const r=e.path.child(X.fromString(t));if(!U.isDocumentKey(r))throw new O(S.INVALID_ARGUMENT,`Invalid query. When querying a collection group by documentId(), the value provided must result in a valid document path, but '${r}' is not because it has an odd number of segments (${r.length}).`);return td(n,new U(r))}if(t instanceof _e)return td(n,t._key);throw new O(S.INVALID_ARGUMENT,`Invalid query. When querying with documentId(), you must provide a valid string or a DocumentReference, but it was: ${yo(t)}.`)}function $d(n,e){if(!Array.isArray(n)||n.length===0)throw new O(S.INVALID_ARGUMENT,`Invalid Query. A non-empty array is required for '${e.toString()}' filters.`)}function Ag(n,e){const t=function(i,s){for(const a of i)for(const c of a.getFlattenedFilters())if(s.indexOf(c.op)>=0)return c.op;return null}(n.filters,function(i){switch(i){case"!=":return["!=","not-in"];case"array-contains-any":case"in":return["not-in"];case"not-in":return["array-contains-any","in","not-in","!="];default:return[]}}(e.op));if(t!==null)throw t===e.op?new O(S.INVALID_ARGUMENT,`Invalid query. You cannot use more than one '${e.op.toString()}' filter.`):new O(S.INVALID_ARGUMENT,`Invalid query. You cannot use '${e.op.toString()}' filters with '${t.toString()}' filters.`)}function Rg(n,e,t){let r;return r=n?t&&(t.merge||t.mergeFields)?n.toFirestore(e,t):n.toFirestore(e):e,r}class ni{constructor(e,t){this.hasPendingWrites=e,this.fromCache=t}isEqual(e){return this.hasPendingWrites===e.hasPendingWrites&&this.fromCache===e.fromCache}}class bn extends wg{constructor(e,t,r,i,s,a){super(e,t,r,i,a),this._firestore=e,this._firestoreImpl=e,this.metadata=s}exists(){return super.exists()}data(e={}){if(this._document){if(this._converter){const t=new Cs(this._firestore,this._userDataWriter,this._key,this._document,this.metadata,null);return this._converter.fromFirestore(t,e)}return this._userDataWriter.convertValue(this._document.data.value,e.serverTimestamps)}}get(e,t={}){if(this._document){const r=this._document.data.field(qi("DocumentSnapshot.get",e));if(r!==null)return this._userDataWriter.convertValue(r,t.serverTimestamps)}}toJSON(){if(this.metadata.hasPendingWrites)throw new O(S.FAILED_PRECONDITION,"DocumentSnapshot.toJSON() attempted to serialize a document with pending writes. Await waitForPendingWrites() before invoking toJSON().");const e=this._document,t={};return t.type=bn._jsonSchemaVersion,t.bundle="",t.bundleSource="DocumentSnapshot",t.bundleName=this._key.toString(),!e||!e.isValidDocument()||!e.isFoundDocument()?t:(this._userDataWriter.convertObjectMap(e.data.value.mapValue.fields,"previous"),t.bundle=(this._firestore,this.ref.path,"NOT SUPPORTED"),t)}}bn._jsonSchemaVersion="firestore/documentSnapshot/1.0",bn._jsonSchema={type:ge("string",bn._jsonSchemaVersion),bundleSource:ge("string","DocumentSnapshot"),bundleName:ge("string"),bundle:ge("string")};class Cs extends bn{data(e={}){return super.data(e)}}class rr{constructor(e,t,r,i){this._firestore=e,this._userDataWriter=t,this._snapshot=i,this.metadata=new ni(i.hasPendingWrites,i.fromCache),this.query=r}get docs(){const e=[];return this.forEach(t=>e.push(t)),e}get size(){return this._snapshot.docs.size}get empty(){return this.size===0}forEach(e,t){this._snapshot.docs.forEach(r=>{e.call(t,new Cs(this._firestore,this._userDataWriter,r.key,r,new ni(this._snapshot.mutatedKeys.has(r.key),this._snapshot.fromCache),this.query.converter))})}docChanges(e={}){const t=!!e.includeMetadataChanges;if(t&&this._snapshot.excludesMetadataChanges)throw new O(S.INVALID_ARGUMENT,"To include metadata changes with your document changes, you must also pass { includeMetadataChanges:true } to onSnapshot().");return this._cachedChanges&&this._cachedChangesIncludeMetadataChanges===t||(this._cachedChanges=function(i,s){if(i._snapshot.oldDocs.isEmpty()){let a=0;return i._snapshot.docChanges.map(c=>{const u=new Cs(i._firestore,i._userDataWriter,c.doc.key,c.doc,new ni(i._snapshot.mutatedKeys.has(c.doc.key),i._snapshot.fromCache),i.query.converter);return c.doc,{type:"added",doc:u,oldIndex:-1,newIndex:a++}})}{let a=i._snapshot.oldDocs;return i._snapshot.docChanges.filter(c=>s||c.type!==3).map(c=>{const u=new Cs(i._firestore,i._userDataWriter,c.doc.key,c.doc,new ni(i._snapshot.mutatedKeys.has(c.doc.key),i._snapshot.fromCache),i.query.converter);let h=-1,f=-1;return c.type!==0&&(h=a.indexOf(c.doc.key),a=a.delete(c.doc.key)),c.type!==1&&(a=a.add(c.doc),f=a.indexOf(c.doc.key)),{type:_S(c.type),doc:u,oldIndex:h,newIndex:f}})}}(this,t),this._cachedChangesIncludeMetadataChanges=t),this._cachedChanges}toJSON(){if(this.metadata.hasPendingWrites)throw new O(S.FAILED_PRECONDITION,"QuerySnapshot.toJSON() attempted to serialize a document with pending writes. Await waitForPendingWrites() before invoking toJSON().");const e={};e.type=rr._jsonSchemaVersion,e.bundleSource="QuerySnapshot",e.bundleName=Yc.newId(),this._firestore._databaseId.database,this._firestore._databaseId.projectId;const t=[],r=[],i=[];return this.docs.forEach(s=>{s._document!==null&&(t.push(s._document),r.push(this._userDataWriter.convertObjectMap(s._document.data.value.mapValue.fields,"previous")),i.push(s.ref.path))}),e.bundle=(this._firestore,this.query._query,e.bundleName,"NOT SUPPORTED"),e}}function _S(n){switch(n){case 0:return"added";case 2:case 3:return"modified";case 1:return"removed";default:return x(61501,{type:n})}}/**
 * @license
 * Copyright 2022 Google LLC
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
 */rr._jsonSchemaVersion="firestore/querySnapshot/1.0",rr._jsonSchema={type:ge("string",rr._jsonSchemaVersion),bundleSource:ge("string","QuerySnapshot"),bundleName:ge("string"),bundle:ge("string")};/**
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
 */function eD(n){n=rn(n,_e);const e=rn(n.firestore,Pr),t=Iu(e);return Zb(t,n._key).then(r=>yS(e,n,r))}function tD(n){n=rn(n,Bn);const e=rn(n.firestore,Pr),t=Iu(e),r=new Ig(e);return gS(n._query),eS(t,n._query).then(i=>new rr(e,r,n,i))}function nD(n,e,t){n=rn(n,_e);const r=rn(n.firestore,Pr),i=Rg(n.converter,e,t),s=vu(r);return Pu(r,[_g(s,"setDoc",n._key,i,n.converter!==null,t).toMutation(n._key,at.none())])}function rD(n){return Pu(rn(n.firestore,Pr),[new ru(n._key,at.none())])}function iD(n,e){const t=rn(n.firestore,Pr),r=sS(n),i=Rg(n.converter,e),s=vu(n.firestore);return Pu(t,[_g(s,"addDoc",r._key,i,n.converter!==null,{}).toMutation(r._key,at.exists(!1))]).then(()=>r)}function Pu(n,e){const t=Iu(n);return tS(t,e)}function yS(n,e,t){const r=t.docs.get(e._key),i=new Ig(n);return new bn(n,i,e._key,r,new ni(t.hasPendingWrites,t.fromCache),e.converter)}(function(e,t=!0){nA(Vn),Le(new Ce("firestore",(r,{instanceIdentifier:i,options:s})=>{const a=r.getProvider("app").getImmediate(),c=new Pr(new sA(r.getProvider("auth-internal")),new cA(a,r.getProvider("app-check-internal")),RA(a,i),a);return s={useFetchStreams:t,...s},c._setSettings(s),c},"PUBLIC").setMultipleInstances(!0)),Te(xd,Fd,e),Te(xd,Fd,"esm2020")})();/**
 * @license
 * Copyright 2017 Google LLC
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
 */const bg="firebasestorage.googleapis.com",Sg="storageBucket",TS=2*60*1e3,ES=10*60*1e3,IS=1e3;/**
 * @license
 * Copyright 2017 Google LLC
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
 */class ce extends rt{constructor(e,t,r=0){super(ba(e),`Firebase Storage: ${t} (${ba(e)})`),this.status_=r,this.customData={serverResponse:null},this._baseMessage=this.message,Object.setPrototypeOf(this,ce.prototype)}get status(){return this.status_}set status(e){this.status_=e}_codeEquals(e){return ba(e)===this.code}get serverResponse(){return this.customData.serverResponse}set serverResponse(e){this.customData.serverResponse=e,this.customData.serverResponse?this.message=`${this._baseMessage}
${this.customData.serverResponse}`:this.message=this._baseMessage}}var te;(function(n){n.UNKNOWN="unknown",n.OBJECT_NOT_FOUND="object-not-found",n.BUCKET_NOT_FOUND="bucket-not-found",n.PROJECT_NOT_FOUND="project-not-found",n.QUOTA_EXCEEDED="quota-exceeded",n.UNAUTHENTICATED="unauthenticated",n.UNAUTHORIZED="unauthorized",n.UNAUTHORIZED_APP="unauthorized-app",n.RETRY_LIMIT_EXCEEDED="retry-limit-exceeded",n.INVALID_CHECKSUM="invalid-checksum",n.CANCELED="canceled",n.INVALID_EVENT_NAME="invalid-event-name",n.INVALID_URL="invalid-url",n.INVALID_DEFAULT_BUCKET="invalid-default-bucket",n.NO_DEFAULT_BUCKET="no-default-bucket",n.CANNOT_SLICE_BLOB="cannot-slice-blob",n.SERVER_FILE_WRONG_SIZE="server-file-wrong-size",n.NO_DOWNLOAD_URL="no-download-url",n.INVALID_ARGUMENT="invalid-argument",n.INVALID_ARGUMENT_COUNT="invalid-argument-count",n.APP_DELETED="app-deleted",n.INVALID_ROOT_OPERATION="invalid-root-operation",n.INVALID_FORMAT="invalid-format",n.INTERNAL_ERROR="internal-error",n.UNSUPPORTED_ENVIRONMENT="unsupported-environment"})(te||(te={}));function ba(n){return"storage/"+n}function Cu(){const n="An unknown error occurred, please check the error payload for server response.";return new ce(te.UNKNOWN,n)}function wS(n){return new ce(te.OBJECT_NOT_FOUND,"Object '"+n+"' does not exist.")}function vS(n){return new ce(te.QUOTA_EXCEEDED,"Quota for bucket '"+n+"' exceeded, please view quota on https://firebase.google.com/pricing/.")}function AS(){const n="User is not authenticated, please authenticate using Firebase Authentication and try again.";return new ce(te.UNAUTHENTICATED,n)}function RS(){return new ce(te.UNAUTHORIZED_APP,"This app does not have permission to access Firebase Storage on this project.")}function bS(n){return new ce(te.UNAUTHORIZED,"User does not have permission to access '"+n+"'.")}function Pg(){return new ce(te.RETRY_LIMIT_EXCEEDED,"Max retry time for operation exceeded, please try again.")}function Cg(){return new ce(te.CANCELED,"User canceled the upload/download.")}function SS(n){return new ce(te.INVALID_URL,"Invalid URL '"+n+"'.")}function PS(n){return new ce(te.INVALID_DEFAULT_BUCKET,"Invalid default bucket '"+n+"'.")}function CS(){return new ce(te.NO_DEFAULT_BUCKET,"No default bucket found. Did you set the '"+Sg+"' property when initializing the app?")}function kg(){return new ce(te.CANNOT_SLICE_BLOB,"Cannot slice blob for upload. Please retry the upload.")}function kS(){return new ce(te.SERVER_FILE_WRONG_SIZE,"Server recorded incorrect upload file size, please retry the upload.")}function NS(){return new ce(te.NO_DOWNLOAD_URL,"The given file does not have any download URLs.")}function DS(n){return new ce(te.UNSUPPORTED_ENVIRONMENT,`${n} is missing. Make sure to install the required polyfills. See https://firebase.google.com/docs/web/environments-js-sdk#polyfills for more information.`)}function gc(n){return new ce(te.INVALID_ARGUMENT,n)}function Ng(){return new ce(te.APP_DELETED,"The Firebase app was deleted.")}function OS(n){return new ce(te.INVALID_ROOT_OPERATION,"The operation '"+n+"' cannot be performed on a root reference, create a non-root reference using child, such as .child('file.png').")}function di(n,e){return new ce(te.INVALID_FORMAT,"String does not match format '"+n+"': "+e)}function Yr(n){throw new ce(te.INTERNAL_ERROR,"Internal error: "+n)}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class Je{constructor(e,t){this.bucket=e,this.path_=t}get path(){return this.path_}get isRoot(){return this.path.length===0}fullServerUrl(){const e=encodeURIComponent;return"/b/"+e(this.bucket)+"/o/"+e(this.path)}bucketOnlyServerUrl(){return"/b/"+encodeURIComponent(this.bucket)+"/o"}static makeFromBucketSpec(e,t){let r;try{r=Je.makeFromUrl(e,t)}catch{return new Je(e,"")}if(r.path==="")return r;throw PS(e)}static makeFromUrl(e,t){let r=null;const i="([A-Za-z0-9.\\-_]+)";function s(Y){Y.path.charAt(Y.path.length-1)==="/"&&(Y.path_=Y.path_.slice(0,-1))}const a="(/(.*))?$",c=new RegExp("^gs://"+i+a,"i"),u={bucket:1,path:3};function h(Y){Y.path_=decodeURIComponent(Y.path)}const f="v[A-Za-z0-9_]+",m=t.replace(/[.]/g,"\\."),y="(/([^?#]*).*)?$",b=new RegExp(`^https?://${m}/${f}/b/${i}/o${y}`,"i"),k={bucket:1,path:3},V=t===bg?"(?:storage.googleapis.com|storage.cloud.google.com)":t,N="([^?#]*)",F=new RegExp(`^https?://${V}/${i}/${N}`,"i"),j=[{regex:c,indices:u,postModify:s},{regex:b,indices:k,postModify:h},{regex:F,indices:{bucket:1,path:2},postModify:h}];for(let Y=0;Y<j.length;Y++){const se=j[Y],oe=se.regex.exec(e);if(oe){const I=oe[se.indices.bucket];let g=oe[se.indices.path];g||(g=""),r=new Je(I,g),se.postModify(r);break}}if(r==null)throw SS(e);return r}}class VS{constructor(e){this.promise_=Promise.reject(e)}getPromise(){return this.promise_}cancel(e=!1){}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */function MS(n,e,t){let r=1,i=null,s=null,a=!1,c=0;function u(){return c===2}let h=!1;function f(...N){h||(h=!0,e.apply(null,N))}function m(N){i=setTimeout(()=>{i=null,n(b,u())},N)}function y(){s&&clearTimeout(s)}function b(N,...F){if(h){y();return}if(N){y(),f.call(null,N,...F);return}if(u()||a){y(),f.call(null,N,...F);return}r<64&&(r*=2);let j;c===1?(c=2,j=0):j=(r+Math.random())*1e3,m(j)}let k=!1;function V(N){k||(k=!0,y(),!h&&(i!==null?(N||(c=2),clearTimeout(i),m(0)):N||(c=1)))}return m(0),s=setTimeout(()=>{a=!0,V(!0)},t),V}function LS(n){n(!1)}/**
 * @license
 * Copyright 2017 Google LLC
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
 */function US(n){return n!==void 0}function xS(n){return typeof n=="function"}function FS(n){return typeof n=="object"&&!Array.isArray(n)}function No(n){return typeof n=="string"||n instanceof String}function qd(n){return ku()&&n instanceof Blob}function ku(){return typeof Blob<"u"}function jd(n,e,t,r){if(r<e)throw gc(`Invalid value for '${n}'. Expected ${e} or greater.`);if(r>t)throw gc(`Invalid value for '${n}'. Expected ${t} or less.`)}/**
 * @license
 * Copyright 2017 Google LLC
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
 */function ji(n,e,t){let r=e;return t==null&&(r=`https://${e}`),`${t}://${r}/v0${n}`}function Dg(n){const e=encodeURIComponent;let t="?";for(const r in n)if(n.hasOwnProperty(r)){const i=e(r)+"="+e(n[r]);t=t+i+"&"}return t=t.slice(0,-1),t}var Sn;(function(n){n[n.NO_ERROR=0]="NO_ERROR",n[n.NETWORK_ERROR=1]="NETWORK_ERROR",n[n.ABORT=2]="ABORT"})(Sn||(Sn={}));/**
 * @license
 * Copyright 2022 Google LLC
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
 */function Og(n,e){const t=n>=500&&n<600,i=[408,429].indexOf(n)!==-1,s=e.indexOf(n)!==-1;return t||i||s}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class BS{constructor(e,t,r,i,s,a,c,u,h,f,m,y=!0,b=!1){this.url_=e,this.method_=t,this.headers_=r,this.body_=i,this.successCodes_=s,this.additionalRetryCodes_=a,this.callback_=c,this.errorCallback_=u,this.timeout_=h,this.progressCallback_=f,this.connectionFactory_=m,this.retry=y,this.isUsingEmulator=b,this.pendingConnection_=null,this.backoffId_=null,this.canceled_=!1,this.appDelete_=!1,this.promise_=new Promise((k,V)=>{this.resolve_=k,this.reject_=V,this.start_()})}start_(){const e=(r,i)=>{if(i){r(!1,new ps(!1,null,!0));return}const s=this.connectionFactory_();this.pendingConnection_=s;const a=c=>{const u=c.loaded,h=c.lengthComputable?c.total:-1;this.progressCallback_!==null&&this.progressCallback_(u,h)};this.progressCallback_!==null&&s.addUploadProgressListener(a),s.send(this.url_,this.method_,this.isUsingEmulator,this.body_,this.headers_).then(()=>{this.progressCallback_!==null&&s.removeUploadProgressListener(a),this.pendingConnection_=null;const c=s.getErrorCode()===Sn.NO_ERROR,u=s.getStatus();if(!c||Og(u,this.additionalRetryCodes_)&&this.retry){const f=s.getErrorCode()===Sn.ABORT;r(!1,new ps(!1,null,f));return}const h=this.successCodes_.indexOf(u)!==-1;r(!0,new ps(h,s))})},t=(r,i)=>{const s=this.resolve_,a=this.reject_,c=i.connection;if(i.wasSuccessCode)try{const u=this.callback_(c,c.getResponse());US(u)?s(u):s()}catch(u){a(u)}else if(c!==null){const u=Cu();u.serverResponse=c.getErrorText(),this.errorCallback_?a(this.errorCallback_(c,u)):a(u)}else if(i.canceled){const u=this.appDelete_?Ng():Cg();a(u)}else{const u=Pg();a(u)}};this.canceled_?t(!1,new ps(!1,null,!0)):this.backoffId_=MS(e,t,this.timeout_)}getPromise(){return this.promise_}cancel(e){this.canceled_=!0,this.appDelete_=e||!1,this.backoffId_!==null&&LS(this.backoffId_),this.pendingConnection_!==null&&this.pendingConnection_.abort()}}class ps{constructor(e,t,r){this.wasSuccessCode=e,this.connection=t,this.canceled=!!r}}function $S(n,e){e!==null&&e.length>0&&(n.Authorization="Firebase "+e)}function qS(n,e){n["X-Firebase-Storage-Version"]="webjs/"+(e??"AppManager")}function jS(n,e){e&&(n["X-Firebase-GMPID"]=e)}function HS(n,e){e!==null&&(n["X-Firebase-AppCheck"]=e)}function zS(n,e,t,r,i,s,a=!0,c=!1){const u=Dg(n.urlParams),h=n.url+u,f=Object.assign({},n.headers);return jS(f,e),$S(f,t),qS(f,s),HS(f,r),new BS(h,n.method,f,n.body,n.successCodes,n.additionalRetryCodes,n.handler,n.errorHandler,n.timeout,n.progressCallback,i,a,c)}/**
 * @license
 * Copyright 2017 Google LLC
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
 */function WS(){return typeof BlobBuilder<"u"?BlobBuilder:typeof WebKitBlobBuilder<"u"?WebKitBlobBuilder:void 0}function GS(...n){const e=WS();if(e!==void 0){const t=new e;for(let r=0;r<n.length;r++)t.append(n[r]);return t.getBlob()}else{if(ku())return new Blob(n);throw new ce(te.UNSUPPORTED_ENVIRONMENT,"This browser doesn't seem to support creating Blobs")}}function KS(n,e,t){return n.webkitSlice?n.webkitSlice(e,t):n.mozSlice?n.mozSlice(e,t):n.slice?n.slice(e,t):null}/**
 * @license
 * Copyright 2021 Google LLC
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
 */function YS(n){if(typeof atob>"u")throw DS("base-64");return atob(n)}/**
 * @license
 * Copyright 2017 Google LLC
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
 */const pt={RAW:"raw",BASE64:"base64",BASE64URL:"base64url",DATA_URL:"data_url"};class Sa{constructor(e,t){this.data=e,this.contentType=t||null}}function QS(n,e){switch(n){case pt.RAW:return new Sa(Vg(e));case pt.BASE64:case pt.BASE64URL:return new Sa(Mg(n,e));case pt.DATA_URL:return new Sa(XS(e),ZS(e))}throw Cu()}function Vg(n){const e=[];for(let t=0;t<n.length;t++){let r=n.charCodeAt(t);if(r<=127)e.push(r);else if(r<=2047)e.push(192|r>>6,128|r&63);else if((r&64512)===55296)if(!(t<n.length-1&&(n.charCodeAt(t+1)&64512)===56320))e.push(239,191,189);else{const s=r,a=n.charCodeAt(++t);r=65536|(s&1023)<<10|a&1023,e.push(240|r>>18,128|r>>12&63,128|r>>6&63,128|r&63)}else(r&64512)===56320?e.push(239,191,189):e.push(224|r>>12,128|r>>6&63,128|r&63)}return new Uint8Array(e)}function JS(n){let e;try{e=decodeURIComponent(n)}catch{throw di(pt.DATA_URL,"Malformed data URL.")}return Vg(e)}function Mg(n,e){switch(n){case pt.BASE64:{const i=e.indexOf("-")!==-1,s=e.indexOf("_")!==-1;if(i||s)throw di(n,"Invalid character '"+(i?"-":"_")+"' found: is it base64url encoded?");break}case pt.BASE64URL:{const i=e.indexOf("+")!==-1,s=e.indexOf("/")!==-1;if(i||s)throw di(n,"Invalid character '"+(i?"+":"/")+"' found: is it base64 encoded?");e=e.replace(/-/g,"+").replace(/_/g,"/");break}}let t;try{t=YS(e)}catch(i){throw i.message.includes("polyfill")?i:di(n,"Invalid character found")}const r=new Uint8Array(t.length);for(let i=0;i<t.length;i++)r[i]=t.charCodeAt(i);return r}class Lg{constructor(e){this.base64=!1,this.contentType=null;const t=e.match(/^data:([^,]+)?,/);if(t===null)throw di(pt.DATA_URL,"Must be formatted 'data:[<mediatype>][;base64],<data>");const r=t[1]||null;r!=null&&(this.base64=eP(r,";base64"),this.contentType=this.base64?r.substring(0,r.length-7):r),this.rest=e.substring(e.indexOf(",")+1)}}function XS(n){const e=new Lg(n);return e.base64?Mg(pt.BASE64,e.rest):JS(e.rest)}function ZS(n){return new Lg(n).contentType}function eP(n,e){return n.length>=e.length?n.substring(n.length-e.length)===e:!1}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class Kt{constructor(e,t){let r=0,i="";qd(e)?(this.data_=e,r=e.size,i=e.type):e instanceof ArrayBuffer?(t?this.data_=new Uint8Array(e):(this.data_=new Uint8Array(e.byteLength),this.data_.set(new Uint8Array(e))),r=this.data_.length):e instanceof Uint8Array&&(t?this.data_=e:(this.data_=new Uint8Array(e.length),this.data_.set(e)),r=e.length),this.size_=r,this.type_=i}size(){return this.size_}type(){return this.type_}slice(e,t){if(qd(this.data_)){const r=this.data_,i=KS(r,e,t);return i===null?null:new Kt(i)}else{const r=new Uint8Array(this.data_.buffer,e,t-e);return new Kt(r,!0)}}static getBlob(...e){if(ku()){const t=e.map(r=>r instanceof Kt?r.data_:r);return new Kt(GS.apply(null,t))}else{const t=e.map(a=>No(a)?QS(pt.RAW,a).data:a.data_);let r=0;t.forEach(a=>{r+=a.byteLength});const i=new Uint8Array(r);let s=0;return t.forEach(a=>{for(let c=0;c<a.length;c++)i[s++]=a[c]}),new Kt(i,!0)}}uploadData(){return this.data_}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */function Ug(n){let e;try{e=JSON.parse(n)}catch{return null}return FS(e)?e:null}/**
 * @license
 * Copyright 2017 Google LLC
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
 */function tP(n){if(n.length===0)return null;const e=n.lastIndexOf("/");return e===-1?"":n.slice(0,e)}function nP(n,e){const t=e.split("/").filter(r=>r.length>0).join("/");return n.length===0?t:n+"/"+t}function xg(n){const e=n.lastIndexOf("/",n.length-2);return e===-1?n:n.slice(e+1)}/**
 * @license
 * Copyright 2017 Google LLC
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
 */function rP(n,e){return e}class Fe{constructor(e,t,r,i){this.server=e,this.local=t||e,this.writable=!!r,this.xform=i||rP}}let ms=null;function iP(n){return!No(n)||n.length<2?n:xg(n)}function Fg(){if(ms)return ms;const n=[];n.push(new Fe("bucket")),n.push(new Fe("generation")),n.push(new Fe("metageneration")),n.push(new Fe("name","fullPath",!0));function e(s,a){return iP(a)}const t=new Fe("name");t.xform=e,n.push(t);function r(s,a){return a!==void 0?Number(a):a}const i=new Fe("size");return i.xform=r,n.push(i),n.push(new Fe("timeCreated")),n.push(new Fe("updated")),n.push(new Fe("md5Hash",null,!0)),n.push(new Fe("cacheControl",null,!0)),n.push(new Fe("contentDisposition",null,!0)),n.push(new Fe("contentEncoding",null,!0)),n.push(new Fe("contentLanguage",null,!0)),n.push(new Fe("contentType",null,!0)),n.push(new Fe("metadata","customMetadata",!0)),ms=n,ms}function sP(n,e){function t(){const r=n.bucket,i=n.fullPath,s=new Je(r,i);return e._makeStorageReference(s)}Object.defineProperty(n,"ref",{get:t})}function oP(n,e,t){const r={};r.type="file";const i=t.length;for(let s=0;s<i;s++){const a=t[s];r[a.local]=a.xform(r,e[a.server])}return sP(r,n),r}function Bg(n,e,t){const r=Ug(e);return r===null?null:oP(n,r,t)}function aP(n,e,t,r){const i=Ug(e);if(i===null||!No(i.downloadTokens))return null;const s=i.downloadTokens;if(s.length===0)return null;const a=encodeURIComponent;return s.split(",").map(h=>{const f=n.bucket,m=n.fullPath,y="/b/"+a(f)+"/o/"+a(m),b=ji(y,t,r),k=Dg({alt:"media",token:h});return b+k})[0]}function $g(n,e){const t={},r=e.length;for(let i=0;i<r;i++){const s=e[i];s.writable&&(t[s.server]=n[s.local])}return JSON.stringify(t)}class Cr{constructor(e,t,r,i){this.url=e,this.method=t,this.handler=r,this.timeout=i,this.urlParams={},this.headers={},this.body=null,this.errorHandler=null,this.progressCallback=null,this.successCodes=[200],this.additionalRetryCodes=[]}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */function Nt(n){if(!n)throw Cu()}function Nu(n,e){function t(r,i){const s=Bg(n,i,e);return Nt(s!==null),s}return t}function cP(n,e){function t(r,i){const s=Bg(n,i,e);return Nt(s!==null),aP(s,i,n.host,n._protocol)}return t}function Hi(n){function e(t,r){let i;return t.getStatus()===401?t.getErrorText().includes("Firebase App Check token is invalid")?i=RS():i=AS():t.getStatus()===402?i=vS(n.bucket):t.getStatus()===403?i=bS(n.path):i=r,i.status=t.getStatus(),i.serverResponse=r.serverResponse,i}return e}function qg(n){const e=Hi(n);function t(r,i){let s=e(r,i);return r.getStatus()===404&&(s=wS(n.path)),s.serverResponse=i.serverResponse,s}return t}function uP(n,e,t){const r=e.fullServerUrl(),i=ji(r,n.host,n._protocol),s="GET",a=n.maxOperationRetryTime,c=new Cr(i,s,Nu(n,t),a);return c.errorHandler=qg(e),c}function lP(n,e,t){const r=e.fullServerUrl(),i=ji(r,n.host,n._protocol),s="GET",a=n.maxOperationRetryTime,c=new Cr(i,s,cP(n,t),a);return c.errorHandler=qg(e),c}function hP(n,e){return n&&n.contentType||e&&e.type()||"application/octet-stream"}function jg(n,e,t){const r=Object.assign({},t);return r.fullPath=n.path,r.size=e.size(),r.contentType||(r.contentType=hP(null,e)),r}function dP(n,e,t,r,i){const s=e.bucketOnlyServerUrl(),a={"X-Goog-Upload-Protocol":"multipart"};function c(){let j="";for(let Y=0;Y<2;Y++)j=j+Math.random().toString().slice(2);return j}const u=c();a["Content-Type"]="multipart/related; boundary="+u;const h=jg(e,r,i),f=$g(h,t),m="--"+u+`\r
Content-Type: application/json; charset=utf-8\r
\r
`+f+`\r
--`+u+`\r
Content-Type: `+h.contentType+`\r
\r
`,y=`\r
--`+u+"--",b=Kt.getBlob(m,r,y);if(b===null)throw kg();const k={name:h.fullPath},V=ji(s,n.host,n._protocol),N="POST",F=n.maxUploadRetryTime,$=new Cr(V,N,Nu(n,t),F);return $.urlParams=k,$.headers=a,$.body=b.uploadData(),$.errorHandler=Hi(e),$}class Js{constructor(e,t,r,i){this.current=e,this.total=t,this.finalized=!!r,this.metadata=i||null}}function Du(n,e){let t=null;try{t=n.getResponseHeader("X-Goog-Upload-Status")}catch{Nt(!1)}return Nt(!!t&&(e||["active"]).indexOf(t)!==-1),t}function fP(n,e,t,r,i){const s=e.bucketOnlyServerUrl(),a=jg(e,r,i),c={name:a.fullPath},u=ji(s,n.host,n._protocol),h="POST",f={"X-Goog-Upload-Protocol":"resumable","X-Goog-Upload-Command":"start","X-Goog-Upload-Header-Content-Length":`${r.size()}`,"X-Goog-Upload-Header-Content-Type":a.contentType,"Content-Type":"application/json; charset=utf-8"},m=$g(a,t),y=n.maxUploadRetryTime;function b(V){Du(V);let N;try{N=V.getResponseHeader("X-Goog-Upload-URL")}catch{Nt(!1)}return Nt(No(N)),N}const k=new Cr(u,h,b,y);return k.urlParams=c,k.headers=f,k.body=m,k.errorHandler=Hi(e),k}function pP(n,e,t,r){const i={"X-Goog-Upload-Command":"query"};function s(h){const f=Du(h,["active","final"]);let m=null;try{m=h.getResponseHeader("X-Goog-Upload-Size-Received")}catch{Nt(!1)}m||Nt(!1);const y=Number(m);return Nt(!isNaN(y)),new Js(y,r.size(),f==="final")}const a="POST",c=n.maxUploadRetryTime,u=new Cr(t,a,s,c);return u.headers=i,u.errorHandler=Hi(e),u}const Hd=256*1024;function mP(n,e,t,r,i,s,a,c){const u=new Js(0,0);if(a?(u.current=a.current,u.total=a.total):(u.current=0,u.total=r.size()),r.size()!==u.total)throw kS();const h=u.total-u.current;let f=h;i>0&&(f=Math.min(f,i));const m=u.current,y=m+f;let b="";f===0?b="finalize":h===f?b="upload, finalize":b="upload";const k={"X-Goog-Upload-Command":b,"X-Goog-Upload-Offset":`${u.current}`},V=r.slice(m,y);if(V===null)throw kg();function N(Y,se){const oe=Du(Y,["active","final"]),I=u.current+f,g=r.size();let T;return oe==="final"?T=Nu(e,s)(Y,se):T=null,new Js(I,g,oe==="final",T)}const F="POST",$=e.maxUploadRetryTime,j=new Cr(t,F,N,$);return j.headers=k,j.body=V.uploadData(),j.progressCallback=c||null,j.errorHandler=Hi(n),j}const We={RUNNING:"running",PAUSED:"paused",SUCCESS:"success",CANCELED:"canceled",ERROR:"error"};function Pa(n){switch(n){case"running":case"pausing":case"canceling":return We.RUNNING;case"paused":return We.PAUSED;case"success":return We.SUCCESS;case"canceled":return We.CANCELED;case"error":return We.ERROR;default:return We.ERROR}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class gP{constructor(e,t,r){if(xS(e)||t!=null||r!=null)this.next=e,this.error=t??void 0,this.complete=r??void 0;else{const s=e;this.next=s.next,this.error=s.error,this.complete=s.complete}}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */function Hn(n){return(...e)=>{Promise.resolve().then(()=>n(...e))}}class _P{constructor(){this.sent_=!1,this.xhr_=new XMLHttpRequest,this.initXhr(),this.errorCode_=Sn.NO_ERROR,this.sendPromise_=new Promise(e=>{this.xhr_.addEventListener("abort",()=>{this.errorCode_=Sn.ABORT,e()}),this.xhr_.addEventListener("error",()=>{this.errorCode_=Sn.NETWORK_ERROR,e()}),this.xhr_.addEventListener("load",()=>{e()})})}send(e,t,r,i,s){if(this.sent_)throw Yr("cannot .send() more than once");if(fn(e)&&r&&(this.xhr_.withCredentials=!0),this.sent_=!0,this.xhr_.open(t,e,!0),s!==void 0)for(const a in s)s.hasOwnProperty(a)&&this.xhr_.setRequestHeader(a,s[a].toString());return i!==void 0?this.xhr_.send(i):this.xhr_.send(),this.sendPromise_}getErrorCode(){if(!this.sent_)throw Yr("cannot .getErrorCode() before sending");return this.errorCode_}getStatus(){if(!this.sent_)throw Yr("cannot .getStatus() before sending");try{return this.xhr_.status}catch{return-1}}getResponse(){if(!this.sent_)throw Yr("cannot .getResponse() before sending");return this.xhr_.response}getErrorText(){if(!this.sent_)throw Yr("cannot .getErrorText() before sending");return this.xhr_.statusText}abort(){this.xhr_.abort()}getResponseHeader(e){return this.xhr_.getResponseHeader(e)}addUploadProgressListener(e){this.xhr_.upload!=null&&this.xhr_.upload.addEventListener("progress",e)}removeUploadProgressListener(e){this.xhr_.upload!=null&&this.xhr_.upload.removeEventListener("progress",e)}}class yP extends _P{initXhr(){this.xhr_.responseType="text"}}function Yn(){return new yP}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class TP{isExponentialBackoffExpired(){return this.sleepTime>this.maxSleepTime}constructor(e,t,r=null){this._transferred=0,this._needToFetchStatus=!1,this._needToFetchMetadata=!1,this._observers=[],this._error=void 0,this._uploadUrl=void 0,this._request=void 0,this._chunkMultiplier=1,this._resolve=void 0,this._reject=void 0,this._ref=e,this._blob=t,this._metadata=r,this._mappings=Fg(),this._resumable=this._shouldDoResumable(this._blob),this._state="running",this._errorHandler=i=>{if(this._request=void 0,this._chunkMultiplier=1,i._codeEquals(te.CANCELED))this._needToFetchStatus=!0,this.completeTransitions_();else{const s=this.isExponentialBackoffExpired();if(Og(i.status,[]))if(s)i=Pg();else{this.sleepTime=Math.max(this.sleepTime*2,IS),this._needToFetchStatus=!0,this.completeTransitions_();return}this._error=i,this._transition("error")}},this._metadataErrorHandler=i=>{this._request=void 0,i._codeEquals(te.CANCELED)?this.completeTransitions_():(this._error=i,this._transition("error"))},this.sleepTime=0,this.maxSleepTime=this._ref.storage.maxUploadRetryTime,this._promise=new Promise((i,s)=>{this._resolve=i,this._reject=s,this._start()}),this._promise.then(null,()=>{})}_makeProgressCallback(){const e=this._transferred;return t=>this._updateProgress(e+t)}_shouldDoResumable(e){return e.size()>256*1024}_start(){this._state==="running"&&this._request===void 0&&(this._resumable?this._uploadUrl===void 0?this._createResumable():this._needToFetchStatus?this._fetchStatus():this._needToFetchMetadata?this._fetchMetadata():this.pendingTimeout=setTimeout(()=>{this.pendingTimeout=void 0,this._continueUpload()},this.sleepTime):this._oneShotUpload())}_resolveToken(e){Promise.all([this._ref.storage._getAuthToken(),this._ref.storage._getAppCheckToken()]).then(([t,r])=>{switch(this._state){case"running":e(t,r);break;case"canceling":this._transition("canceled");break;case"pausing":this._transition("paused");break}})}_createResumable(){this._resolveToken((e,t)=>{const r=fP(this._ref.storage,this._ref._location,this._mappings,this._blob,this._metadata),i=this._ref.storage._makeRequest(r,Yn,e,t);this._request=i,i.getPromise().then(s=>{this._request=void 0,this._uploadUrl=s,this._needToFetchStatus=!1,this.completeTransitions_()},this._errorHandler)})}_fetchStatus(){const e=this._uploadUrl;this._resolveToken((t,r)=>{const i=pP(this._ref.storage,this._ref._location,e,this._blob),s=this._ref.storage._makeRequest(i,Yn,t,r);this._request=s,s.getPromise().then(a=>{a=a,this._request=void 0,this._updateProgress(a.current),this._needToFetchStatus=!1,a.finalized&&(this._needToFetchMetadata=!0),this.completeTransitions_()},this._errorHandler)})}_continueUpload(){const e=Hd*this._chunkMultiplier,t=new Js(this._transferred,this._blob.size()),r=this._uploadUrl;this._resolveToken((i,s)=>{let a;try{a=mP(this._ref._location,this._ref.storage,r,this._blob,e,this._mappings,t,this._makeProgressCallback())}catch(u){this._error=u,this._transition("error");return}const c=this._ref.storage._makeRequest(a,Yn,i,s,!1);this._request=c,c.getPromise().then(u=>{this._increaseMultiplier(),this._request=void 0,this._updateProgress(u.current),u.finalized?(this._metadata=u.metadata,this._transition("success")):this.completeTransitions_()},this._errorHandler)})}_increaseMultiplier(){Hd*this._chunkMultiplier*2<32*1024*1024&&(this._chunkMultiplier*=2)}_fetchMetadata(){this._resolveToken((e,t)=>{const r=uP(this._ref.storage,this._ref._location,this._mappings),i=this._ref.storage._makeRequest(r,Yn,e,t);this._request=i,i.getPromise().then(s=>{this._request=void 0,this._metadata=s,this._transition("success")},this._metadataErrorHandler)})}_oneShotUpload(){this._resolveToken((e,t)=>{const r=dP(this._ref.storage,this._ref._location,this._mappings,this._blob,this._metadata),i=this._ref.storage._makeRequest(r,Yn,e,t);this._request=i,i.getPromise().then(s=>{this._request=void 0,this._metadata=s,this._updateProgress(this._blob.size()),this._transition("success")},this._errorHandler)})}_updateProgress(e){const t=this._transferred;this._transferred=e,this._transferred!==t&&this._notifyObservers()}_transition(e){if(this._state!==e)switch(e){case"canceling":case"pausing":this._state=e,this._request!==void 0?this._request.cancel():this.pendingTimeout&&(clearTimeout(this.pendingTimeout),this.pendingTimeout=void 0,this.completeTransitions_());break;case"running":const t=this._state==="paused";this._state=e,t&&(this._notifyObservers(),this._start());break;case"paused":this._state=e,this._notifyObservers();break;case"canceled":this._error=Cg(),this._state=e,this._notifyObservers();break;case"error":this._state=e,this._notifyObservers();break;case"success":this._state=e,this._notifyObservers();break}}completeTransitions_(){switch(this._state){case"pausing":this._transition("paused");break;case"canceling":this._transition("canceled");break;case"running":this._start();break}}get snapshot(){const e=Pa(this._state);return{bytesTransferred:this._transferred,totalBytes:this._blob.size(),state:e,metadata:this._metadata,task:this,ref:this._ref}}on(e,t,r,i){const s=new gP(t||void 0,r||void 0,i||void 0);return this._addObserver(s),()=>{this._removeObserver(s)}}then(e,t){return this._promise.then(e,t)}catch(e){return this.then(null,e)}_addObserver(e){this._observers.push(e),this._notifyObserver(e)}_removeObserver(e){const t=this._observers.indexOf(e);t!==-1&&this._observers.splice(t,1)}_notifyObservers(){this._finishPromise(),this._observers.slice().forEach(t=>{this._notifyObserver(t)})}_finishPromise(){if(this._resolve!==void 0){let e=!0;switch(Pa(this._state)){case We.SUCCESS:Hn(this._resolve.bind(null,this.snapshot))();break;case We.CANCELED:case We.ERROR:const t=this._reject;Hn(t.bind(null,this._error))();break;default:e=!1;break}e&&(this._resolve=void 0,this._reject=void 0)}}_notifyObserver(e){switch(Pa(this._state)){case We.RUNNING:case We.PAUSED:e.next&&Hn(e.next.bind(e,this.snapshot))();break;case We.SUCCESS:e.complete&&Hn(e.complete.bind(e))();break;case We.CANCELED:case We.ERROR:e.error&&Hn(e.error.bind(e,this._error))();break;default:e.error&&Hn(e.error.bind(e,this._error))()}}resume(){const e=this._state==="paused"||this._state==="pausing";return e&&this._transition("running"),e}pause(){const e=this._state==="running";return e&&this._transition("pausing"),e}cancel(){const e=this._state==="running"||this._state==="pausing";return e&&this._transition("canceling"),e}}/**
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
 */class kn{constructor(e,t){this._service=e,t instanceof Je?this._location=t:this._location=Je.makeFromUrl(t,e.host)}toString(){return"gs://"+this._location.bucket+"/"+this._location.path}_newRef(e,t){return new kn(e,t)}get root(){const e=new Je(this._location.bucket,"");return this._newRef(this._service,e)}get bucket(){return this._location.bucket}get fullPath(){return this._location.path}get name(){return xg(this._location.path)}get storage(){return this._service}get parent(){const e=tP(this._location.path);if(e===null)return null;const t=new Je(this._location.bucket,e);return new kn(this._service,t)}_throwIfRoot(e){if(this._location.path==="")throw OS(e)}}function EP(n,e,t){return n._throwIfRoot("uploadBytesResumable"),new TP(n,new Kt(e),t)}function IP(n){n._throwIfRoot("getDownloadURL");const e=lP(n.storage,n._location,Fg());return n.storage.makeRequestWithTokens(e,Yn).then(t=>{if(t===null)throw NS();return t})}function wP(n,e){const t=nP(n._location.path,e),r=new Je(n._location.bucket,t);return new kn(n.storage,r)}/**
 * @license
 * Copyright 2017 Google LLC
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
 */function vP(n){return/^[A-Za-z]+:\/\//.test(n)}function AP(n,e){return new kn(n,e)}function Hg(n,e){if(n instanceof Ou){const t=n;if(t._bucket==null)throw CS();const r=new kn(t,t._bucket);return e!=null?Hg(r,e):r}else return e!==void 0?wP(n,e):n}function RP(n,e){if(e&&vP(e)){if(n instanceof Ou)return AP(n,e);throw gc("To use ref(service, url), the first argument must be a Storage instance.")}else return Hg(n,e)}function zd(n,e){const t=e==null?void 0:e[Sg];return t==null?null:Je.makeFromBucketSpec(t,n)}function bP(n,e,t,r={}){n.host=`${e}:${t}`;const i=fn(e);i&&(Sc(`https://${n.host}/b`),Mf("Storage",!0)),n._isUsingEmulator=!0,n._protocol=i?"https":"http";const{mockUserToken:s}=r;s&&(n._overrideAuthToken=typeof s=="string"?s:Gy(s,n.app.options.projectId))}class Ou{constructor(e,t,r,i,s,a=!1){this.app=e,this._authProvider=t,this._appCheckProvider=r,this._url=i,this._firebaseVersion=s,this._isUsingEmulator=a,this._bucket=null,this._host=bg,this._protocol="https",this._appId=null,this._deleted=!1,this._maxOperationRetryTime=TS,this._maxUploadRetryTime=ES,this._requests=new Set,i!=null?this._bucket=Je.makeFromBucketSpec(i,this._host):this._bucket=zd(this._host,this.app.options)}get host(){return this._host}set host(e){this._host=e,this._url!=null?this._bucket=Je.makeFromBucketSpec(this._url,e):this._bucket=zd(e,this.app.options)}get maxUploadRetryTime(){return this._maxUploadRetryTime}set maxUploadRetryTime(e){jd("time",0,Number.POSITIVE_INFINITY,e),this._maxUploadRetryTime=e}get maxOperationRetryTime(){return this._maxOperationRetryTime}set maxOperationRetryTime(e){jd("time",0,Number.POSITIVE_INFINITY,e),this._maxOperationRetryTime=e}async _getAuthToken(){if(this._overrideAuthToken)return this._overrideAuthToken;const e=this._authProvider.getImmediate({optional:!0});if(e){const t=await e.getToken();if(t!==null)return t.accessToken}return null}async _getAppCheckToken(){if(ie(this.app)&&this.app.settings.appCheckToken)return this.app.settings.appCheckToken;const e=this._appCheckProvider.getImmediate({optional:!0});return e?(await e.getToken()).token:null}_delete(){return this._deleted||(this._deleted=!0,this._requests.forEach(e=>e.cancel()),this._requests.clear()),Promise.resolve()}_makeStorageReference(e){return new kn(this,e)}_makeRequest(e,t,r,i,s=!0){if(this._deleted)return new VS(Ng());{const a=zS(e,this._appId,r,i,t,this._firebaseVersion,s,this._isUsingEmulator);return this._requests.add(a),a.getPromise().then(()=>this._requests.delete(a),()=>this._requests.delete(a)),a}}async makeRequestWithTokens(e,t){const[r,i]=await Promise.all([this._getAuthToken(),this._getAppCheckToken()]);return this._makeRequest(e,t,r,i).getPromise()}}const Wd="@firebase/storage",Gd="0.14.1";/**
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
 */const zg="storage";function sD(n,e,t){return n=L(n),EP(n,e,t)}function oD(n){return n=L(n),IP(n)}function aD(n,e){return n=L(n),RP(n,e)}function cD(n=yr(),e){n=L(n);const r=Ke(n,zg).getImmediate({identifier:e}),i=Wy("storage");return i&&SP(r,...i),r}function SP(n,e,t,r={}){bP(n,e,t,r)}function PP(n,{instanceIdentifier:e}){const t=n.getProvider("app").getImmediate(),r=n.getProvider("auth-internal"),i=n.getProvider("app-check-internal");return new Ou(t,r,i,e,Vn)}function CP(){Le(new Ce(zg,PP,"PUBLIC").setMultipleInstances(!0)),Te(Wd,Gd,""),Te(Wd,Gd,"esm2020")}CP();/**
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
 */const _c=new Map,Wg={activated:!1,tokenObservers:[]},kP={initialized:!1,enabled:!1};function le(n){return _c.get(n)||{...Wg}}function NP(n,e){return _c.set(n,e),_c.get(n)}function Do(){return kP}/**
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
 */const Vu="https://content-firebaseappcheck.googleapis.com/v1",DP="exchangeRecaptchaV3Token",OP="exchangeRecaptchaEnterpriseToken",VP="exchangeDebugToken",Kd={RETRIAL_MIN_WAIT:30*1e3,RETRIAL_MAX_WAIT:16*60*1e3},MP=24*60*60*1e3;/**
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
 */class LP{constructor(e,t,r,i,s){if(this.operation=e,this.retryPolicy=t,this.getWaitDuration=r,this.lowerBound=i,this.upperBound=s,this.pending=null,this.nextErrorWaitInterval=i,i>s)throw new Error("Proactive refresh lower bound greater than upper bound!")}start(){this.nextErrorWaitInterval=this.lowerBound,this.process(!0).catch(()=>{})}stop(){this.pending&&(this.pending.reject("cancelled"),this.pending=null)}isRunning(){return!!this.pending}async process(e){this.stop();try{this.pending=new ar,this.pending.promise.catch(t=>{}),await UP(this.getNextRun(e)),this.pending.resolve(),await this.pending.promise,this.pending=new ar,this.pending.promise.catch(t=>{}),await this.operation(),this.pending.resolve(),await this.pending.promise,this.process(!0).catch(()=>{})}catch(t){this.retryPolicy(t)?this.process(!1).catch(()=>{}):this.stop()}}getNextRun(e){if(e)return this.nextErrorWaitInterval=this.lowerBound,this.getWaitDuration();{const t=this.nextErrorWaitInterval;return this.nextErrorWaitInterval*=2,this.nextErrorWaitInterval>this.upperBound&&(this.nextErrorWaitInterval=this.upperBound),t}}}function UP(n){return new Promise(e=>{setTimeout(e,n)})}/**
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
 */const xP={"already-initialized":"You have already called initializeAppCheck() for FirebaseApp {$appName} with different options. To avoid this error, call initializeAppCheck() with the same options as when it was originally called. This will return the already initialized instance.","use-before-activation":"App Check is being used before initializeAppCheck() is called for FirebaseApp {$appName}. Call initializeAppCheck() before instantiating other Firebase services.","fetch-network-error":"Fetch failed to connect to a network. Check Internet connection. Original error: {$originalErrorMessage}.","fetch-parse-error":"Fetch client could not parse response. Original error: {$originalErrorMessage}.","fetch-status-error":"Fetch server returned an HTTP error status. HTTP status: {$httpStatus}.","storage-open":"Error thrown when opening storage. Original error: {$originalErrorMessage}.","storage-get":"Error thrown when reading from storage. Original error: {$originalErrorMessage}.","storage-set":"Error thrown when writing to storage. Original error: {$originalErrorMessage}.","recaptcha-error":"ReCAPTCHA error.","initial-throttle":"{$httpStatus} error. Attempts allowed again after {$time}",throttled:"Requests throttled due to previous {$httpStatus} error. Attempts allowed again after {$time}"},Pe=new Et("appCheck","AppCheck",xP);/**
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
 */function Xs(n=!1){var e;return n?(e=self.grecaptcha)==null?void 0:e.enterprise:self.grecaptcha}function Mu(n){if(!le(n).activated)throw Pe.create("use-before-activation",{appName:n.name})}function Lu(n){const e=Math.round(n/1e3),t=Math.floor(e/(3600*24)),r=Math.floor((e-t*3600*24)/3600),i=Math.floor((e-t*3600*24-r*3600)/60),s=e-t*3600*24-r*3600-i*60;let a="";return t&&(a+=gs(t)+"d:"),r&&(a+=gs(r)+"h:"),a+=gs(i)+"m:"+gs(s)+"s",a}function gs(n){return n===0?"00":n>=10?n.toString():"0"+n}/**
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
 */async function Oo({url:n,body:e},t){const r={"Content-Type":"application/json"},i=t.getImmediate({optional:!0});if(i){const m=await i.getHeartbeatsHeader();m&&(r["X-Firebase-Client"]=m)}const s={method:"POST",body:JSON.stringify(e),headers:r};let a;try{a=await fetch(n,s)}catch(m){throw Pe.create("fetch-network-error",{originalErrorMessage:m==null?void 0:m.message})}if(a.status!==200)throw Pe.create("fetch-status-error",{httpStatus:a.status});let c;try{c=await a.json()}catch(m){throw Pe.create("fetch-parse-error",{originalErrorMessage:m==null?void 0:m.message})}const u=c.ttl.match(/^([\d.]+)(s)$/);if(!u||!u[2]||isNaN(Number(u[1])))throw Pe.create("fetch-parse-error",{originalErrorMessage:`ttl field (timeToLive) is not in standard Protobuf Duration format: ${c.ttl}`});const h=Number(u[1])*1e3,f=Date.now();return{token:c.token,expireTimeMillis:f+h,issuedAtTimeMillis:f}}function FP(n,e){const{projectId:t,appId:r,apiKey:i}=n.options;return{url:`${Vu}/projects/${t}/apps/${r}:${DP}?key=${i}`,body:{recaptcha_v3_token:e}}}function BP(n,e){const{projectId:t,appId:r,apiKey:i}=n.options;return{url:`${Vu}/projects/${t}/apps/${r}:${OP}?key=${i}`,body:{recaptcha_enterprise_token:e}}}function Gg(n,e){const{projectId:t,appId:r,apiKey:i}=n.options;return{url:`${Vu}/projects/${t}/apps/${r}:${VP}?key=${i}`,body:{debug_token:e}}}/**
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
 */const $P="firebase-app-check-database",qP=1,Ci="firebase-app-check-store",Kg="debug-token";let _s=null;function Yg(){return _s||(_s=new Promise((n,e)=>{try{const t=indexedDB.open($P,qP);t.onsuccess=r=>{n(r.target.result)},t.onerror=r=>{var i;e(Pe.create("storage-open",{originalErrorMessage:(i=r.target.error)==null?void 0:i.message}))},t.onupgradeneeded=r=>{const i=r.target.result;switch(r.oldVersion){case 0:i.createObjectStore(Ci,{keyPath:"compositeKey"})}}}catch(t){e(Pe.create("storage-open",{originalErrorMessage:t==null?void 0:t.message}))}}),_s)}function jP(n){return Jg(Xg(n))}function HP(n,e){return Qg(Xg(n),e)}function zP(n){return Qg(Kg,n)}function WP(){return Jg(Kg)}async function Qg(n,e){const r=(await Yg()).transaction(Ci,"readwrite"),s=r.objectStore(Ci).put({compositeKey:n,value:e});return new Promise((a,c)=>{s.onsuccess=u=>{a()},r.onerror=u=>{var h;c(Pe.create("storage-set",{originalErrorMessage:(h=u.target.error)==null?void 0:h.message}))}})}async function Jg(n){const t=(await Yg()).transaction(Ci,"readonly"),i=t.objectStore(Ci).get(n);return new Promise((s,a)=>{i.onsuccess=c=>{const u=c.target.result;s(u?u.value:void 0)},t.onerror=c=>{var u;a(Pe.create("storage-get",{originalErrorMessage:(u=c.target.error)==null?void 0:u.message}))}})}function Xg(n){return`${n.options.appId}-${n.name}`}/**
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
 */const Jt=new _r("@firebase/app-check");/**
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
 */async function GP(n){if(On()){let e;try{e=await jP(n)}catch(t){Jt.warn(`Failed to read token from IndexedDB. Error: ${t}`)}return e}}function Ca(n,e){return On()?HP(n,e).catch(t=>{Jt.warn(`Failed to write token to IndexedDB. Error: ${t}`)}):Promise.resolve()}async function KP(){let n;try{n=await WP()}catch{}if(n)return n;{const e=crypto.randomUUID();return zP(e).catch(t=>Jt.warn(`Failed to persist debug token to IndexedDB. Error: ${t}`)),e}}/**
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
 */function Uu(){return Do().enabled}async function xu(){const n=Do();if(n.enabled&&n.token)return n.token.promise;throw Error(`
            Can't get debug token in production mode.
        `)}function YP(){const n=Nf(),e=Do();if(e.initialized=!0,typeof n.FIREBASE_APPCHECK_DEBUG_TOKEN!="string"&&n.FIREBASE_APPCHECK_DEBUG_TOKEN!==!0)return;e.enabled=!0;const t=new ar;e.token=t,typeof n.FIREBASE_APPCHECK_DEBUG_TOKEN=="string"?t.resolve(n.FIREBASE_APPCHECK_DEBUG_TOKEN):t.resolve(KP())}/**
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
 */const QP={error:"UNKNOWN_ERROR"};function JP(n){return bc.encodeString(JSON.stringify(n),!1)}async function Zs(n,e=!1,t=!1){const r=n.app;Mu(r);const i=le(r);let s=i.token,a;if(s&&!Qn(s)&&(i.token=void 0,s=void 0),!s){const h=await i.cachedTokenPromise;h&&(Qn(h)?s=h:await Ca(r,void 0))}if(!e&&s&&Qn(s))return{token:s.token};let c=!1;if(Uu())try{const h=await xu();i.exchangeTokenPromise||(i.exchangeTokenPromise=Oo(Gg(r,h),n.heartbeatServiceProvider).finally(()=>{i.exchangeTokenPromise=void 0}),c=!0);const f=await i.exchangeTokenPromise;return await Ca(r,f),i.token=f,{token:f.token}}catch(h){return h.code==="appCheck/throttled"||h.code==="appCheck/initial-throttle"?Jt.warn(h.message):t&&Jt.error(h),ka(h)}try{i.exchangeTokenPromise||(i.exchangeTokenPromise=i.provider.getToken().finally(()=>{i.exchangeTokenPromise=void 0}),c=!0),s=await le(r).exchangeTokenPromise}catch(h){h.code==="appCheck/throttled"||h.code==="appCheck/initial-throttle"?Jt.warn(h.message):t&&Jt.error(h),a=h}let u;return s?a?Qn(s)?u={token:s.token,internalError:a}:u=ka(a):(u={token:s.token},i.token=s,await Ca(r,s)):u=ka(a),c&&e_(r,u),u}async function Zg(n){const e=n.app;Mu(e);const{provider:t}=le(e);if(Uu()){const r=await xu(),{token:i}=await Oo(Gg(e,r),n.heartbeatServiceProvider);return{token:i}}else{const{token:r}=await t.getToken();return{token:r}}}function Fu(n,e,t,r){const{app:i}=n,s=le(i),a={next:t,error:r,type:e};if(s.tokenObservers=[...s.tokenObservers,a],s.token&&Qn(s.token)){const c=s.token;Promise.resolve().then(()=>{t({token:c.token}),Yd(n)}).catch(()=>{})}s.cachedTokenPromise.then(()=>Yd(n))}function Bu(n,e){const t=le(n),r=t.tokenObservers.filter(i=>i.next!==e);r.length===0&&t.tokenRefresher&&t.tokenRefresher.isRunning()&&t.tokenRefresher.stop(),t.tokenObservers=r}function Yd(n){const{app:e}=n,t=le(e);let r=t.tokenRefresher;r||(r=XP(n),t.tokenRefresher=r),!r.isRunning()&&t.isTokenAutoRefreshEnabled&&r.start()}function XP(n){const{app:e}=n;return new LP(async()=>{const t=le(e);let r;if(t.token?r=await Zs(n,!0):r=await Zs(n),r.error)throw r.error;if(r.internalError)throw r.internalError},()=>!0,()=>{const t=le(e);if(t.token){let r=t.token.issuedAtTimeMillis+(t.token.expireTimeMillis-t.token.issuedAtTimeMillis)*.5+3e5;const i=t.token.expireTimeMillis-5*60*1e3;return r=Math.min(r,i),Math.max(0,r-Date.now())}else return 0},Kd.RETRIAL_MIN_WAIT,Kd.RETRIAL_MAX_WAIT)}function e_(n,e){const t=le(n).tokenObservers;for(const r of t)try{r.type==="EXTERNAL"&&e.error!=null?r.error(e.error):r.next(e)}catch{}}function Qn(n){return n.expireTimeMillis-Date.now()>0}function ka(n){return{token:JP(QP),error:n}}/**
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
 */class ZP{constructor(e,t){this.app=e,this.heartbeatServiceProvider=t}_delete(){const{tokenObservers:e}=le(this.app);for(const t of e)Bu(this.app,t.next);return Promise.resolve()}}function eC(n,e){return new ZP(n,e)}function tC(n){return{getToken:e=>Zs(n,e),getLimitedUseToken:()=>Zg(n),addTokenListener:e=>Fu(n,"INTERNAL",e),removeTokenListener:e=>Bu(n.app,e)}}const nC="@firebase/app-check",rC="0.11.1";/**
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
 */const iC="https://www.google.com/recaptcha/api.js",sC="https://www.google.com/recaptcha/enterprise.js";function oC(n,e){const t=new ar,r=le(n);r.reCAPTCHAState={initialized:t};const i=t_(n),s=Xs(!1);return s?eo(n,e,s,i,t):uC(()=>{const a=Xs(!1);if(!a)throw new Error("no recaptcha");eo(n,e,a,i,t)}),t.promise}function aC(n,e){const t=new ar,r=le(n);r.reCAPTCHAState={initialized:t};const i=t_(n),s=Xs(!0);return s?eo(n,e,s,i,t):lC(()=>{const a=Xs(!0);if(!a)throw new Error("no recaptcha");eo(n,e,a,i,t)}),t.promise}function eo(n,e,t,r,i){t.ready(()=>{cC(n,e,t,r),i.resolve(t)})}function t_(n){const e=`fire_app_check_${n.name}`,t=document.createElement("div");return t.id=e,t.style.display="none",document.body.appendChild(t),e}async function n_(n){Mu(n);const t=await le(n).reCAPTCHAState.initialized.promise;return new Promise((r,i)=>{const s=le(n).reCAPTCHAState;t.ready(()=>{r(t.execute(s.widgetId,{action:"fire_app_check"}))})})}function cC(n,e,t,r){const i=t.render(r,{sitekey:e,size:"invisible",callback:()=>{le(n).reCAPTCHAState.succeeded=!0},"error-callback":()=>{le(n).reCAPTCHAState.succeeded=!1}}),s=le(n);s.reCAPTCHAState={...s.reCAPTCHAState,widgetId:i}}function uC(n){const e=document.createElement("script");e.src=iC,e.onload=n,document.head.appendChild(e)}function lC(n){const e=document.createElement("script");e.src=sC,e.onload=n,document.head.appendChild(e)}/**
 * @license
 * Copyright 2021 Google LLC
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
 */class $u{constructor(e){this._siteKey=e,this._throttleData=null}async getToken(){var r,i,s;i_(this._throttleData);const e=await n_(this._app).catch(a=>{throw Pe.create("recaptcha-error")});if(!((r=le(this._app).reCAPTCHAState)!=null&&r.succeeded))throw Pe.create("recaptcha-error");let t;try{t=await Oo(FP(this._app,e),this._heartbeatServiceProvider)}catch(a){throw(i=a.code)!=null&&i.includes("fetch-status-error")?(this._throttleData=r_(Number((s=a.customData)==null?void 0:s.httpStatus),this._throttleData),Pe.create("initial-throttle",{time:Lu(this._throttleData.allowRequestsAfter-Date.now()),httpStatus:this._throttleData.httpStatus})):a}return this._throttleData=null,t}initialize(e){this._app=e,this._heartbeatServiceProvider=Ke(e,"heartbeat"),oC(e,this._siteKey).catch(()=>{})}isEqual(e){return e instanceof $u?this._siteKey===e._siteKey:!1}}class qu{constructor(e){this._siteKey=e,this._throttleData=null}async getToken(){var r,i,s;i_(this._throttleData);const e=await n_(this._app).catch(a=>{throw Pe.create("recaptcha-error")});if(!((r=le(this._app).reCAPTCHAState)!=null&&r.succeeded))throw Pe.create("recaptcha-error");let t;try{t=await Oo(BP(this._app,e),this._heartbeatServiceProvider)}catch(a){throw(i=a.code)!=null&&i.includes("fetch-status-error")?(this._throttleData=r_(Number((s=a.customData)==null?void 0:s.httpStatus),this._throttleData),Pe.create("initial-throttle",{time:Lu(this._throttleData.allowRequestsAfter-Date.now()),httpStatus:this._throttleData.httpStatus})):a}return this._throttleData=null,t}initialize(e){this._app=e,this._heartbeatServiceProvider=Ke(e,"heartbeat"),aC(e,this._siteKey).catch(()=>{})}isEqual(e){return e instanceof qu?this._siteKey===e._siteKey:!1}}class ju{constructor(e){this._customProviderOptions=e}async getToken(){const e=await this._customProviderOptions.getToken(),t=oT(e.token),r=t!==null&&t<Date.now()&&t>0?t*1e3:Date.now();return{...e,issuedAtTimeMillis:r}}initialize(e){this._app=e}isEqual(e){return e instanceof ju?this._customProviderOptions.getToken.toString()===e._customProviderOptions.getToken.toString():!1}}function r_(n,e){if(n===404||n===403)return{backoffCount:1,allowRequestsAfter:Date.now()+MP,httpStatus:n};{const t=e?e.backoffCount:0,r=Ha(t,1e3,2);return{backoffCount:t+1,allowRequestsAfter:Date.now()+r,httpStatus:n}}}function i_(n){if(n&&Date.now()-n.allowRequestsAfter<=0)throw Pe.create("throttled",{time:Lu(n.allowRequestsAfter-Date.now()),httpStatus:n.httpStatus})}/**
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
 */function hC(n=yr(),e){n=L(n);const t=Ke(n,"app-check");if(Do().initialized||YP(),Uu()&&xu().then(i=>console.log(`App Check debug token: ${i}. You will need to add it to your app's App Check settings in the Firebase console for it to work.`)),t.isInitialized()){const i=t.getImmediate(),s=t.getOptions();if(s.isTokenAutoRefreshEnabled===e.isTokenAutoRefreshEnabled&&s.provider.isEqual(e.provider))return i;throw Pe.create("already-initialized",{appName:n.name})}const r=t.initialize({options:e});return dC(n,e.provider,e.isTokenAutoRefreshEnabled),le(n).isTokenAutoRefreshEnabled&&Fu(r,"INTERNAL",()=>{}),r}function dC(n,e,t=!1){const r=NP(n,{...Wg});r.activated=!0,r.provider=e,r.cachedTokenPromise=GP(n).then(i=>(i&&Qn(i)&&(r.token=i,e_(n,{token:i.token})),i)),r.isTokenAutoRefreshEnabled=t&&n.automaticDataCollectionEnabled,!n.automaticDataCollectionEnabled&&t&&Jt.warn("`isTokenAutoRefreshEnabled` is true but `automaticDataCollectionEnabled` was set to false during `initializeApp()`. This blocks automatic token refresh."),r.provider.initialize(n)}function fC(n,e){const t=n.app,r=le(t);r.tokenRefresher&&(e===!0?r.tokenRefresher.start():r.tokenRefresher.stop()),r.isTokenAutoRefreshEnabled=e}async function pC(n,e){const t=await Zs(n,e);if(t.error)throw t.error;if(t.internalError)throw t.internalError;return{token:t.token}}function mC(n){return Zg(n)}function gC(n,e,t,r){let i=()=>{},s=()=>{};return e.next!=null?i=e.next.bind(e):i=e,e.error!=null?s=e.error.bind(e):t&&(s=t),Fu(n,"EXTERNAL",i,s),()=>Bu(n.app,i)}const _C="app-check",Qd="app-check-internal";function yC(){Le(new Ce(_C,n=>{const e=n.getProvider("app").getImmediate(),t=n.getProvider("heartbeat");return eC(e,t)},"PUBLIC").setInstantiationMode("EXPLICIT").setInstanceCreatedCallback((n,e,t)=>{n.getProvider(Qd).initialize()})),Le(new Ce(Qd,n=>{const e=n.getProvider("app-check").getImmediate();return tC(e)},"PUBLIC").setInstantiationMode("EXPLICIT")),Te(nC,rC)}yC();const uD=Object.freeze(Object.defineProperty({__proto__:null,CustomProvider:ju,ReCaptchaEnterpriseProvider:qu,ReCaptchaV3Provider:$u,getLimitedUseToken:mC,getToken:pC,initializeAppCheck:hC,onTokenChanged:gC,setTokenAutoRefreshEnabled:fC},Symbol.toStringTag,{value:"Module"})),s_="@firebase/installations",Hu="0.6.20";/**
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
 */const o_=1e4,a_=`w:${Hu}`,c_="FIS_v2",TC="https://firebaseinstallations.googleapis.com/v1",EC=60*60*1e3,IC="installations",wC="Installations";/**
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
 */const vC={"missing-app-config-values":'Missing App configuration value: "{$valueName}"',"not-registered":"Firebase Installation is not registered.","installation-not-found":"Firebase Installation not found.","request-failed":'{$requestName} request failed with error "{$serverCode} {$serverStatus}: {$serverMessage}"',"app-offline":"Could not process request. Application offline.","delete-pending-registration":"Can't delete installation while there is a pending registration request."},Nn=new Et(IC,wC,vC);function u_(n){return n instanceof rt&&n.code.includes("request-failed")}/**
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
 */function l_({projectId:n}){return`${TC}/projects/${n}/installations`}function h_(n){return{token:n.token,requestStatus:2,expiresIn:RC(n.expiresIn),creationTime:Date.now()}}async function d_(n,e){const r=(await e.json()).error;return Nn.create("request-failed",{requestName:n,serverCode:r.code,serverMessage:r.message,serverStatus:r.status})}function f_({apiKey:n}){return new Headers({"Content-Type":"application/json",Accept:"application/json","x-goog-api-key":n})}function AC(n,{refreshToken:e}){const t=f_(n);return t.append("Authorization",bC(e)),t}async function p_(n){const e=await n();return e.status>=500&&e.status<600?n():e}function RC(n){return Number(n.replace("s","000"))}function bC(n){return`${c_} ${n}`}/**
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
 */async function SC({appConfig:n,heartbeatServiceProvider:e},{fid:t}){const r=l_(n),i=f_(n),s=e.getImmediate({optional:!0});if(s){const h=await s.getHeartbeatsHeader();h&&i.append("x-firebase-client",h)}const a={fid:t,authVersion:c_,appId:n.appId,sdkVersion:a_},c={method:"POST",headers:i,body:JSON.stringify(a)},u=await p_(()=>fetch(r,c));if(u.ok){const h=await u.json();return{fid:h.fid||t,registrationStatus:2,refreshToken:h.refreshToken,authToken:h_(h.authToken)}}else throw await d_("Create Installation",u)}/**
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
 */function m_(n){return new Promise(e=>{setTimeout(e,n)})}/**
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
 */function PC(n){return btoa(String.fromCharCode(...n)).replace(/\+/g,"-").replace(/\//g,"_")}/**
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
 */const CC=/^[cdef][\w-]{21}$/,yc="";function kC(){try{const n=new Uint8Array(17);(self.crypto||self.msCrypto).getRandomValues(n),n[0]=112+n[0]%16;const t=NC(n);return CC.test(t)?t:yc}catch{return yc}}function NC(n){return PC(n).substr(0,22)}/**
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
 */function Vo(n){return`${n.appName}!${n.appId}`}/**
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
 */const g_=new Map;function __(n,e){const t=Vo(n);y_(t,e),DC(t,e)}function y_(n,e){const t=g_.get(n);if(t)for(const r of t)r(e)}function DC(n,e){const t=OC();t&&t.postMessage({key:n,fid:e}),VC()}let An=null;function OC(){return!An&&"BroadcastChannel"in self&&(An=new BroadcastChannel("[Firebase] FID Change"),An.onmessage=n=>{y_(n.data.key,n.data.fid)}),An}function VC(){g_.size===0&&An&&(An.close(),An=null)}/**
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
 */const MC="firebase-installations-database",LC=1,Dn="firebase-installations-store";let Na=null;function zu(){return Na||(Na=oo(MC,LC,{upgrade:(n,e)=>{switch(e){case 0:n.createObjectStore(Dn)}}})),Na}async function to(n,e){const t=Vo(n),i=(await zu()).transaction(Dn,"readwrite"),s=i.objectStore(Dn),a=await s.get(t);return await s.put(e,t),await i.done,(!a||a.fid!==e.fid)&&__(n,e.fid),e}async function T_(n){const e=Vo(n),r=(await zu()).transaction(Dn,"readwrite");await r.objectStore(Dn).delete(e),await r.done}async function Mo(n,e){const t=Vo(n),i=(await zu()).transaction(Dn,"readwrite"),s=i.objectStore(Dn),a=await s.get(t),c=e(a);return c===void 0?await s.delete(t):await s.put(c,t),await i.done,c&&(!a||a.fid!==c.fid)&&__(n,c.fid),c}/**
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
 */async function Wu(n){let e;const t=await Mo(n.appConfig,r=>{const i=UC(r),s=xC(n,i);return e=s.registrationPromise,s.installationEntry});return t.fid===yc?{installationEntry:await e}:{installationEntry:t,registrationPromise:e}}function UC(n){const e=n||{fid:kC(),registrationStatus:0};return E_(e)}function xC(n,e){if(e.registrationStatus===0){if(!navigator.onLine){const i=Promise.reject(Nn.create("app-offline"));return{installationEntry:e,registrationPromise:i}}const t={fid:e.fid,registrationStatus:1,registrationTime:Date.now()},r=FC(n,t);return{installationEntry:t,registrationPromise:r}}else return e.registrationStatus===1?{installationEntry:e,registrationPromise:BC(n)}:{installationEntry:e}}async function FC(n,e){try{const t=await SC(n,e);return to(n.appConfig,t)}catch(t){throw u_(t)&&t.customData.serverCode===409?await T_(n.appConfig):await to(n.appConfig,{fid:e.fid,registrationStatus:0}),t}}async function BC(n){let e=await Jd(n.appConfig);for(;e.registrationStatus===1;)await m_(100),e=await Jd(n.appConfig);if(e.registrationStatus===0){const{installationEntry:t,registrationPromise:r}=await Wu(n);return r||t}return e}function Jd(n){return Mo(n,e=>{if(!e)throw Nn.create("installation-not-found");return E_(e)})}function E_(n){return $C(n)?{fid:n.fid,registrationStatus:0}:n}function $C(n){return n.registrationStatus===1&&n.registrationTime+o_<Date.now()}/**
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
 */async function qC({appConfig:n,heartbeatServiceProvider:e},t){const r=jC(n,t),i=AC(n,t),s=e.getImmediate({optional:!0});if(s){const h=await s.getHeartbeatsHeader();h&&i.append("x-firebase-client",h)}const a={installation:{sdkVersion:a_,appId:n.appId}},c={method:"POST",headers:i,body:JSON.stringify(a)},u=await p_(()=>fetch(r,c));if(u.ok){const h=await u.json();return h_(h)}else throw await d_("Generate Auth Token",u)}function jC(n,{fid:e}){return`${l_(n)}/${e}/authTokens:generate`}/**
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
 */async function Gu(n,e=!1){let t;const r=await Mo(n.appConfig,s=>{if(!I_(s))throw Nn.create("not-registered");const a=s.authToken;if(!e&&WC(a))return s;if(a.requestStatus===1)return t=HC(n,e),s;{if(!navigator.onLine)throw Nn.create("app-offline");const c=KC(s);return t=zC(n,c),c}});return t?await t:r.authToken}async function HC(n,e){let t=await Xd(n.appConfig);for(;t.authToken.requestStatus===1;)await m_(100),t=await Xd(n.appConfig);const r=t.authToken;return r.requestStatus===0?Gu(n,e):r}function Xd(n){return Mo(n,e=>{if(!I_(e))throw Nn.create("not-registered");const t=e.authToken;return YC(t)?{...e,authToken:{requestStatus:0}}:e})}async function zC(n,e){try{const t=await qC(n,e),r={...e,authToken:t};return await to(n.appConfig,r),t}catch(t){if(u_(t)&&(t.customData.serverCode===401||t.customData.serverCode===404))await T_(n.appConfig);else{const r={...e,authToken:{requestStatus:0}};await to(n.appConfig,r)}throw t}}function I_(n){return n!==void 0&&n.registrationStatus===2}function WC(n){return n.requestStatus===2&&!GC(n)}function GC(n){const e=Date.now();return e<n.creationTime||n.creationTime+n.expiresIn<e+EC}function KC(n){const e={requestStatus:1,requestTime:Date.now()};return{...n,authToken:e}}function YC(n){return n.requestStatus===1&&n.requestTime+o_<Date.now()}/**
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
 */async function QC(n){const e=n,{installationEntry:t,registrationPromise:r}=await Wu(e);return r?r.catch(console.error):Gu(e).catch(console.error),t.fid}/**
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
 */async function JC(n,e=!1){const t=n;return await XC(t),(await Gu(t,e)).token}async function XC(n){const{registrationPromise:e}=await Wu(n);e&&await e}/**
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
 */function ZC(n){if(!n||!n.options)throw Da("App Configuration");if(!n.name)throw Da("App Name");const e=["projectId","apiKey","appId"];for(const t of e)if(!n.options[t])throw Da(t);return{appName:n.name,projectId:n.options.projectId,apiKey:n.options.apiKey,appId:n.options.appId}}function Da(n){return Nn.create("missing-app-config-values",{valueName:n})}/**
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
 */const w_="installations",ek="installations-internal",tk=n=>{const e=n.getProvider("app").getImmediate(),t=ZC(e),r=Ke(e,"heartbeat");return{app:e,appConfig:t,heartbeatServiceProvider:r,_delete:()=>Promise.resolve()}},nk=n=>{const e=n.getProvider("app").getImmediate(),t=Ke(e,w_).getImmediate();return{getId:()=>QC(t),getToken:i=>JC(t,i)}};function rk(){Le(new Ce(w_,tk,"PUBLIC")),Le(new Ce(ek,nk,"PRIVATE"))}rk();Te(s_,Hu);Te(s_,Hu,"esm2020");/**
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
 */const no="analytics",ik="firebase_id",sk="origin",ok=60*1e3,ak="https://firebase.googleapis.com/v1alpha/projects/-/apps/{app-id}/webConfig",Ku="https://www.googletagmanager.com/gtag/js";/**
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
 */const qe=new _r("@firebase/analytics");/**
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
 */const ck={"already-exists":"A Firebase Analytics instance with the appId {$id}  already exists. Only one Firebase Analytics instance can be created for each appId.","already-initialized":"initializeAnalytics() cannot be called again with different options than those it was initially called with. It can be called again with the same options to return the existing instance, or getAnalytics() can be used to get a reference to the already-initialized instance.","already-initialized-settings":"Firebase Analytics has already been initialized.settings() must be called before initializing any Analytics instanceor it will have no effect.","interop-component-reg-failed":"Firebase Analytics Interop Component failed to instantiate: {$reason}","invalid-analytics-context":"Firebase Analytics is not supported in this environment. Wrap initialization of analytics in analytics.isSupported() to prevent initialization in unsupported environments. Details: {$errorInfo}","indexeddb-unavailable":"IndexedDB unavailable or restricted in this environment. Wrap initialization of analytics in analytics.isSupported() to prevent initialization in unsupported environments. Details: {$errorInfo}","fetch-throttle":"The config fetch request timed out while in an exponential backoff state. Unix timestamp in milliseconds when fetch request throttling ends: {$throttleEndTimeMillis}.","config-fetch-failed":"Dynamic config fetch failed: [{$httpStatus}] {$responseMessage}","no-api-key":'The "apiKey" field is empty in the local Firebase config. Firebase Analytics requires this field tocontain a valid API key.',"no-app-id":'The "appId" field is empty in the local Firebase config. Firebase Analytics requires this field tocontain a valid app ID.',"no-client-id":'The "client_id" field is empty.',"invalid-gtag-resource":"Trusted Types detected an invalid gtag resource: {$gtagURL}."},Xe=new Et("analytics","Analytics",ck);/**
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
 */function uk(n){if(!n.startsWith(Ku)){const e=Xe.create("invalid-gtag-resource",{gtagURL:n});return qe.warn(e.message),""}return n}function v_(n){return Promise.all(n.map(e=>e.catch(t=>t)))}function lk(n,e){let t;return window.trustedTypes&&(t=window.trustedTypes.createPolicy(n,e)),t}function hk(n,e){const t=lk("firebase-js-sdk-policy",{createScriptURL:uk}),r=document.createElement("script"),i=`${Ku}?l=${n}&id=${e}`;r.src=t?t==null?void 0:t.createScriptURL(i):i,r.async=!0,document.head.appendChild(r)}function dk(n){let e=[];return Array.isArray(window[n])?e=window[n]:window[n]=e,e}async function fk(n,e,t,r,i,s){const a=r[i];try{if(a)await e[a];else{const u=(await v_(t)).find(h=>h.measurementId===i);u&&await e[u.appId]}}catch(c){qe.error(c)}n("config",i,s)}async function pk(n,e,t,r,i){try{let s=[];if(i&&i.send_to){let a=i.send_to;Array.isArray(a)||(a=[a]);const c=await v_(t);for(const u of a){const h=c.find(m=>m.measurementId===u),f=h&&e[h.appId];if(f)s.push(f);else{s=[];break}}}s.length===0&&(s=Object.values(e)),await Promise.all(s),n("event",r,i||{})}catch(s){qe.error(s)}}function mk(n,e,t,r){async function i(s,...a){try{if(s==="event"){const[c,u]=a;await pk(n,e,t,c,u)}else if(s==="config"){const[c,u]=a;await fk(n,e,t,r,c,u)}else if(s==="consent"){const[c,u]=a;n("consent",c,u)}else if(s==="get"){const[c,u,h]=a;n("get",c,u,h)}else if(s==="set"){const[c]=a;n("set",c)}else n(s,...a)}catch(c){qe.error(c)}}return i}function gk(n,e,t,r,i){let s=function(...a){window[r].push(arguments)};return window[i]&&typeof window[i]=="function"&&(s=window[i]),window[i]=mk(s,n,e,t),{gtagCore:s,wrappedGtag:window[i]}}function _k(n){const e=window.document.getElementsByTagName("script");for(const t of Object.values(e))if(t.src&&t.src.includes(Ku)&&t.src.includes(n))return t;return null}/**
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
 */const yk=30,Tk=1e3;class Ek{constructor(e={},t=Tk){this.throttleMetadata=e,this.intervalMillis=t}getThrottleMetadata(e){return this.throttleMetadata[e]}setThrottleMetadata(e,t){this.throttleMetadata[e]=t}deleteThrottleMetadata(e){delete this.throttleMetadata[e]}}const A_=new Ek;function Ik(n){return new Headers({Accept:"application/json","x-goog-api-key":n})}async function wk(n){var a;const{appId:e,apiKey:t}=n,r={method:"GET",headers:Ik(t)},i=ak.replace("{app-id}",e),s=await fetch(i,r);if(s.status!==200&&s.status!==304){let c="";try{const u=await s.json();(a=u.error)!=null&&a.message&&(c=u.error.message)}catch{}throw Xe.create("config-fetch-failed",{httpStatus:s.status,responseMessage:c})}return s.json()}async function vk(n,e=A_,t){const{appId:r,apiKey:i,measurementId:s}=n.options;if(!r)throw Xe.create("no-app-id");if(!i){if(s)return{measurementId:s,appId:r};throw Xe.create("no-api-key")}const a=e.getThrottleMetadata(r)||{backoffCount:0,throttleEndTimeMillis:Date.now()},c=new bk;return setTimeout(async()=>{c.abort()},ok),R_({appId:r,apiKey:i,measurementId:s},a,c,e)}async function R_(n,{throttleEndTimeMillis:e,backoffCount:t},r,i=A_){var c;const{appId:s,measurementId:a}=n;try{await Ak(r,e)}catch(u){if(a)return qe.warn(`Timed out fetching this Firebase app's measurement ID from the server. Falling back to the measurement ID ${a} provided in the "measurementId" field in the local Firebase config. [${u==null?void 0:u.message}]`),{appId:s,measurementId:a};throw u}try{const u=await wk(n);return i.deleteThrottleMetadata(s),u}catch(u){const h=u;if(!Rk(h)){if(i.deleteThrottleMetadata(s),a)return qe.warn(`Failed to fetch this Firebase app's measurement ID from the server. Falling back to the measurement ID ${a} provided in the "measurementId" field in the local Firebase config. [${h==null?void 0:h.message}]`),{appId:s,measurementId:a};throw u}const f=Number((c=h==null?void 0:h.customData)==null?void 0:c.httpStatus)===503?Ha(t,i.intervalMillis,yk):Ha(t,i.intervalMillis),m={throttleEndTimeMillis:Date.now()+f,backoffCount:t+1};return i.setThrottleMetadata(s,m),qe.debug(`Calling attemptFetch again in ${f} millis`),R_(n,m,r,i)}}function Ak(n,e){return new Promise((t,r)=>{const i=Math.max(e-Date.now(),0),s=setTimeout(t,i);n.addEventListener(()=>{clearTimeout(s),r(Xe.create("fetch-throttle",{throttleEndTimeMillis:e}))})})}function Rk(n){if(!(n instanceof rt)||!n.customData)return!1;const e=Number(n.customData.httpStatus);return e===429||e===500||e===503||e===504}class bk{constructor(){this.listeners=[]}addEventListener(e){this.listeners.push(e)}abort(){this.listeners.forEach(e=>e())}}async function Sk(n,e,t,r,i){if(i&&i.global){n("event",t,r);return}else{const s=await e,a={...r,send_to:s};n("event",t,a)}}async function Pk(n,e,t,r){if(r&&r.global){const i={};for(const s of Object.keys(t))i[`user_properties.${s}`]=t[s];return n("set",i),Promise.resolve()}else{const i=await e;n("config",i,{update:!0,user_properties:t})}}/**
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
 */async function Ck(){if(On())try{await Di()}catch(n){return qe.warn(Xe.create("indexeddb-unavailable",{errorInfo:n==null?void 0:n.toString()}).message),!1}else return qe.warn(Xe.create("indexeddb-unavailable",{errorInfo:"IndexedDB is not available in this environment."}).message),!1;return!0}async function kk(n,e,t,r,i,s,a){const c=vk(n);c.then(y=>{t[y.measurementId]=y.appId,n.options.measurementId&&y.measurementId!==n.options.measurementId&&qe.warn(`The measurement ID in the local Firebase config (${n.options.measurementId}) does not match the measurement ID fetched from the server (${y.measurementId}). To ensure analytics events are always sent to the correct Analytics property, update the measurement ID field in the local config or remove it from the local config.`)}).catch(y=>qe.error(y)),e.push(c);const u=Ck().then(y=>{if(y)return r.getId()}),[h,f]=await Promise.all([c,u]);_k(s)||hk(s,h.measurementId),i("js",new Date);const m=(a==null?void 0:a.config)??{};return m[sk]="firebase",m.update=!0,f!=null&&(m[ik]=f),i("config",h.measurementId,m),h.measurementId}/**
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
 */class Nk{constructor(e){this.app=e}_delete(){return delete ir[this.app.options.appId],Promise.resolve()}}let ir={},Zd=[];const ef={};let Oa="dataLayer",Dk="gtag",tf,Yu,nf=!1;function Ok(){const n=[];if(Pc()&&n.push("This is a browser extension environment."),so()||n.push("Cookies are not available."),n.length>0){const e=n.map((r,i)=>`(${i+1}) ${r}`).join(" "),t=Xe.create("invalid-analytics-context",{errorInfo:e});qe.warn(t.message)}}function Vk(n,e,t){Ok();const r=n.options.appId;if(!r)throw Xe.create("no-app-id");if(!n.options.apiKey)if(n.options.measurementId)qe.warn(`The "apiKey" field is empty in the local Firebase config. This is needed to fetch the latest measurement ID for this Firebase app. Falling back to the measurement ID ${n.options.measurementId} provided in the "measurementId" field in the local Firebase config.`);else throw Xe.create("no-api-key");if(ir[r]!=null)throw Xe.create("already-exists",{id:r});if(!nf){dk(Oa);const{wrappedGtag:s,gtagCore:a}=gk(ir,Zd,ef,Oa,Dk);Yu=s,tf=a,nf=!0}return ir[r]=kk(n,Zd,ef,e,tf,Oa,t),new Nk(n)}function lD(n=yr()){n=L(n);const e=Ke(n,no);return e.isInitialized()?e.getImmediate():Mk(n)}function Mk(n,e={}){const t=Ke(n,no);if(t.isInitialized()){const i=t.getImmediate();if(Dt(e,t.getOptions()))return i;throw Xe.create("already-initialized")}return t.initialize({options:e})}async function hD(){if(Pc()||!so()||!On())return!1;try{return await Di()}catch{return!1}}function Lk(n,e,t){n=L(n),Pk(Yu,ir[n.app.options.appId],e,t).catch(r=>qe.error(r))}function Uk(n,e,t,r){n=L(n),Sk(Yu,ir[n.app.options.appId],e,t,r).catch(i=>qe.error(i))}const rf="@firebase/analytics",sf="0.10.20";function xk(){Le(new Ce(no,(e,{options:t})=>{const r=e.getProvider("app").getImmediate(),i=e.getProvider("installations-internal").getImmediate();return Vk(r,i,t)},"PUBLIC")),Le(new Ce("analytics-internal",n,"PRIVATE")),Te(rf,sf),Te(rf,sf,"esm2020");function n(e){try{const t=e.getProvider(no).getImmediate();return{logEvent:(r,i,s)=>Uk(t,r,i,s),setUserProperties:(r,i)=>Lk(t,r,i)}}catch(t){throw Xe.create("interop-component-reg-failed",{reason:t})}}}xk();/**
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
 */const Fk="/firebase-messaging-sw.js",Bk="/firebase-cloud-messaging-push-scope",b_="BDOU99-h67HcA6JeFXHbSNMu7e2yNNu3RzoMj8TM4W88jITfq7ZmPvIM1Iv-4_l2LxQcYwhqby2xGpWwzjfAnG4",$k="https://fcmregistrations.googleapis.com/v1",S_="google.c.a.c_id",qk="google.c.a.c_l",jk="google.c.a.ts",Hk="google.c.a.e",of=1e4;var af;(function(n){n[n.DATA_MESSAGE=1]="DATA_MESSAGE",n[n.DISPLAY_NOTIFICATION=3]="DISPLAY_NOTIFICATION"})(af||(af={}));/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License
 * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing permissions and limitations under
 * the License.
 */var ki;(function(n){n.PUSH_RECEIVED="push-received",n.NOTIFICATION_CLICKED="notification-clicked"})(ki||(ki={}));/**
 * @license
 * Copyright 2017 Google LLC
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
 */function It(n){const e=new Uint8Array(n);return btoa(String.fromCharCode(...e)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_")}function zk(n){const e="=".repeat((4-n.length%4)%4),t=(n+e).replace(/\-/g,"+").replace(/_/g,"/"),r=atob(t),i=new Uint8Array(r.length);for(let s=0;s<r.length;++s)i[s]=r.charCodeAt(s);return i}/**
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
 */const Va="fcm_token_details_db",Wk=5,cf="fcm_token_object_Store";async function Gk(n){if("databases"in indexedDB&&!(await indexedDB.databases()).map(s=>s.name).includes(Va))return null;let e=null;return(await oo(Va,Wk,{upgrade:async(r,i,s,a)=>{if(i<2||!r.objectStoreNames.contains(cf))return;const c=a.objectStore(cf),u=await c.index("fcmSenderId").get(n);if(await c.clear(),!!u){if(i===2){const h=u;if(!h.auth||!h.p256dh||!h.endpoint)return;e={token:h.fcmToken,createTime:h.createTime??Date.now(),subscriptionOptions:{auth:h.auth,p256dh:h.p256dh,endpoint:h.endpoint,swScope:h.swScope,vapidKey:typeof h.vapidKey=="string"?h.vapidKey:It(h.vapidKey)}}}else if(i===3){const h=u;e={token:h.fcmToken,createTime:h.createTime,subscriptionOptions:{auth:It(h.auth),p256dh:It(h.p256dh),endpoint:h.endpoint,swScope:h.swScope,vapidKey:It(h.vapidKey)}}}else if(i===4){const h=u;e={token:h.fcmToken,createTime:h.createTime,subscriptionOptions:{auth:It(h.auth),p256dh:It(h.p256dh),endpoint:h.endpoint,swScope:h.swScope,vapidKey:It(h.vapidKey)}}}}}})).close(),await ha(Va),await ha("fcm_vapid_details_db"),await ha("undefined"),Kk(e)?e:null}function Kk(n){if(!n||!n.subscriptionOptions)return!1;const{subscriptionOptions:e}=n;return typeof n.createTime=="number"&&n.createTime>0&&typeof n.token=="string"&&n.token.length>0&&typeof e.auth=="string"&&e.auth.length>0&&typeof e.p256dh=="string"&&e.p256dh.length>0&&typeof e.endpoint=="string"&&e.endpoint.length>0&&typeof e.swScope=="string"&&e.swScope.length>0&&typeof e.vapidKey=="string"&&e.vapidKey.length>0}/**
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
 */const Yk="firebase-messaging-database",Qk=1,Ni="firebase-messaging-store";let Ma=null;function P_(){return Ma||(Ma=oo(Yk,Qk,{upgrade:(n,e)=>{switch(e){case 0:n.createObjectStore(Ni)}}})),Ma}async function Jk(n){const e=C_(n),r=await(await P_()).transaction(Ni).objectStore(Ni).get(e);if(r)return r;{const i=await Gk(n.appConfig.senderId);if(i)return await Qu(n,i),i}}async function Qu(n,e){const t=C_(n),i=(await P_()).transaction(Ni,"readwrite");return await i.objectStore(Ni).put(e,t),await i.done,e}function C_({appConfig:n}){return n.appId}/**
 * @license
 * Copyright 2017 Google LLC
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
 */const Xk={"missing-app-config-values":'Missing App configuration value: "{$valueName}"',"only-available-in-window":"This method is available in a Window context.","only-available-in-sw":"This method is available in a service worker context.","permission-default":"The notification permission was not granted and dismissed instead.","permission-blocked":"The notification permission was not granted and blocked instead.","unsupported-browser":"This browser doesn't support the API's required to use the Firebase SDK.","indexed-db-unsupported":"This browser doesn't support indexedDb.open() (ex. Safari iFrame, Firefox Private Browsing, etc)","failed-service-worker-registration":"We are unable to register the default service worker. {$browserErrorMessage}","token-subscribe-failed":"A problem occurred while subscribing the user to FCM: {$errorInfo}","token-subscribe-no-token":"FCM returned no token when subscribing the user to push.","token-unsubscribe-failed":"A problem occurred while unsubscribing the user from FCM: {$errorInfo}","token-update-failed":"A problem occurred while updating the user from FCM: {$errorInfo}","token-update-no-token":"FCM returned no token when updating the user to push.","use-sw-after-get-token":"The useServiceWorker() method may only be called once and must be called before calling getToken() to ensure your service worker is used.","invalid-sw-registration":"The input to useServiceWorker() must be a ServiceWorkerRegistration.","invalid-bg-handler":"The input to setBackgroundMessageHandler() must be a function.","invalid-vapid-key":"The public VAPID key must be a string.","use-vapid-key-after-get-token":"The usePublicVapidKey() method may only be called once and must be called before calling getToken() to ensure your VAPID key is used."},Ve=new Et("messaging","Messaging",Xk);/**
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
 */async function Zk(n,e){const t=await Xu(n),r=k_(e),i={method:"POST",headers:t,body:JSON.stringify(r)};let s;try{s=await(await fetch(Ju(n.appConfig),i)).json()}catch(a){throw Ve.create("token-subscribe-failed",{errorInfo:a==null?void 0:a.toString()})}if(s.error){const a=s.error.message;throw Ve.create("token-subscribe-failed",{errorInfo:a})}if(!s.token)throw Ve.create("token-subscribe-no-token");return s.token}async function eN(n,e){const t=await Xu(n),r=k_(e.subscriptionOptions),i={method:"PATCH",headers:t,body:JSON.stringify(r)};let s;try{s=await(await fetch(`${Ju(n.appConfig)}/${e.token}`,i)).json()}catch(a){throw Ve.create("token-update-failed",{errorInfo:a==null?void 0:a.toString()})}if(s.error){const a=s.error.message;throw Ve.create("token-update-failed",{errorInfo:a})}if(!s.token)throw Ve.create("token-update-no-token");return s.token}async function tN(n,e){const r={method:"DELETE",headers:await Xu(n)};try{const s=await(await fetch(`${Ju(n.appConfig)}/${e}`,r)).json();if(s.error){const a=s.error.message;throw Ve.create("token-unsubscribe-failed",{errorInfo:a})}}catch(i){throw Ve.create("token-unsubscribe-failed",{errorInfo:i==null?void 0:i.toString()})}}function Ju({projectId:n}){return`${$k}/projects/${n}/registrations`}async function Xu({appConfig:n,installations:e}){const t=await e.getToken();return new Headers({"Content-Type":"application/json",Accept:"application/json","x-goog-api-key":n.apiKey,"x-goog-firebase-installations-auth":`FIS ${t}`})}function k_({p256dh:n,auth:e,endpoint:t,vapidKey:r}){const i={web:{endpoint:t,auth:e,p256dh:n}};return r!==b_&&(i.web.applicationPubKey=r),i}/**
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
 */const nN=7*24*60*60*1e3;async function rN(n){const e=await sN(n.swRegistration,n.vapidKey),t={vapidKey:n.vapidKey,swScope:n.swRegistration.scope,endpoint:e.endpoint,auth:It(e.getKey("auth")),p256dh:It(e.getKey("p256dh"))},r=await Jk(n.firebaseDependencies);if(r){if(oN(r.subscriptionOptions,t))return Date.now()>=r.createTime+nN?iN(n,{token:r.token,createTime:Date.now(),subscriptionOptions:t}):r.token;try{await tN(n.firebaseDependencies,r.token)}catch(i){console.warn(i)}return uf(n.firebaseDependencies,t)}else return uf(n.firebaseDependencies,t)}async function iN(n,e){try{const t=await eN(n.firebaseDependencies,e),r={...e,token:t,createTime:Date.now()};return await Qu(n.firebaseDependencies,r),t}catch(t){throw t}}async function uf(n,e){const r={token:await Zk(n,e),createTime:Date.now(),subscriptionOptions:e};return await Qu(n,r),r.token}async function sN(n,e){const t=await n.pushManager.getSubscription();return t||n.pushManager.subscribe({userVisibleOnly:!0,applicationServerKey:zk(e)})}function oN(n,e){const t=e.vapidKey===n.vapidKey,r=e.endpoint===n.endpoint,i=e.auth===n.auth,s=e.p256dh===n.p256dh;return t&&r&&i&&s}/**
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
 */function lf(n){const e={from:n.from,collapseKey:n.collapse_key,messageId:n.fcmMessageId};return aN(e,n),cN(e,n),uN(e,n),e}function aN(n,e){if(!e.notification)return;n.notification={};const t=e.notification.title;t&&(n.notification.title=t);const r=e.notification.body;r&&(n.notification.body=r);const i=e.notification.image;i&&(n.notification.image=i);const s=e.notification.icon;s&&(n.notification.icon=s)}function cN(n,e){e.data&&(n.data=e.data)}function uN(n,e){var i,s,a,c;if(!e.fcmOptions&&!((i=e.notification)!=null&&i.click_action))return;n.fcmOptions={};const t=((s=e.fcmOptions)==null?void 0:s.link)??((a=e.notification)==null?void 0:a.click_action);t&&(n.fcmOptions.link=t);const r=(c=e.fcmOptions)==null?void 0:c.analytics_label;r&&(n.fcmOptions.analyticsLabel=r)}/**
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
 */function lN(n){return typeof n=="object"&&!!n&&S_ in n}/**
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
 */function hN(n){if(!n||!n.options)throw La("App Configuration Object");if(!n.name)throw La("App Name");const e=["projectId","apiKey","appId","messagingSenderId"],{options:t}=n;for(const r of e)if(!t[r])throw La(r);return{appName:n.name,projectId:t.projectId,apiKey:t.apiKey,appId:t.appId,senderId:t.messagingSenderId}}function La(n){return Ve.create("missing-app-config-values",{valueName:n})}/**
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
 */class dN{constructor(e,t,r){this.deliveryMetricsExportedToBigQueryEnabled=!1,this.onBackgroundMessageHandler=null,this.onMessageHandler=null,this.logEvents=[],this.isLogServiceStarted=!1;const i=hN(e);this.firebaseDependencies={app:e,appConfig:i,installations:t,analyticsProvider:r}}_delete(){return Promise.resolve()}}/**
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
 */async function fN(n){try{n.swRegistration=await navigator.serviceWorker.register(Fk,{scope:Bk}),n.swRegistration.update().catch(()=>{}),await pN(n.swRegistration)}catch(e){throw Ve.create("failed-service-worker-registration",{browserErrorMessage:e==null?void 0:e.message})}}async function pN(n){return new Promise((e,t)=>{const r=setTimeout(()=>t(new Error(`Service worker not registered after ${of} ms`)),of),i=n.installing||n.waiting;n.active?(clearTimeout(r),e()):i?i.onstatechange=s=>{var a;((a=s.target)==null?void 0:a.state)==="activated"&&(i.onstatechange=null,clearTimeout(r),e())}:(clearTimeout(r),t(new Error("No incoming service worker found.")))})}/**
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
 */async function mN(n,e){if(!e&&!n.swRegistration&&await fN(n),!(!e&&n.swRegistration)){if(!(e instanceof ServiceWorkerRegistration))throw Ve.create("invalid-sw-registration");n.swRegistration=e}}/**
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
 */async function gN(n,e){e?n.vapidKey=e:n.vapidKey||(n.vapidKey=b_)}/**
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
 */async function N_(n,e){if(!navigator)throw Ve.create("only-available-in-window");if(Notification.permission==="default"&&await Notification.requestPermission(),Notification.permission!=="granted")throw Ve.create("permission-blocked");return await gN(n,e==null?void 0:e.vapidKey),await mN(n,e==null?void 0:e.serviceWorkerRegistration),rN(n)}/**
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
 */async function _N(n,e,t){const r=yN(e);(await n.firebaseDependencies.analyticsProvider.get()).logEvent(r,{message_id:t[S_],message_name:t[qk],message_time:t[jk],message_device_time:Math.floor(Date.now()/1e3)})}function yN(n){switch(n){case ki.NOTIFICATION_CLICKED:return"notification_open";case ki.PUSH_RECEIVED:return"notification_foreground";default:throw new Error}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */async function TN(n,e){const t=e.data;if(!t.isFirebaseMessaging)return;n.onMessageHandler&&t.messageType===ki.PUSH_RECEIVED&&(typeof n.onMessageHandler=="function"?n.onMessageHandler(lf(t)):n.onMessageHandler.next(lf(t)));const r=t.data;lN(r)&&r[Hk]==="1"&&await _N(n,t.messageType,r)}const hf="@firebase/messaging",df="0.12.24";/**
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
 */const EN=n=>{const e=new dN(n.getProvider("app").getImmediate(),n.getProvider("installations-internal").getImmediate(),n.getProvider("analytics-internal"));return navigator.serviceWorker.addEventListener("message",t=>TN(e,t)),e},IN=n=>{const e=n.getProvider("messaging").getImmediate();return{getToken:r=>N_(e,r)}};function wN(){Le(new Ce("messaging",EN,"PUBLIC")),Le(new Ce("messaging-internal",IN,"PRIVATE")),Te(hf,df),Te(hf,df,"esm2020")}/**
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
 */async function vN(){try{await Di()}catch{return!1}return typeof window<"u"&&On()&&so()&&"serviceWorker"in navigator&&"PushManager"in window&&"Notification"in window&&"fetch"in window&&ServiceWorkerRegistration.prototype.hasOwnProperty("showNotification")&&PushSubscription.prototype.hasOwnProperty("getKey")}/**
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
 */function AN(n,e){if(!navigator)throw Ve.create("only-available-in-window");return n.onMessageHandler=e,()=>{n.onMessageHandler=null}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */function dD(n=yr()){return vN().then(e=>{if(!e)throw Ve.create("unsupported-browser")},e=>{throw Ve.create("indexed-db-unsupported")}),Ke(L(n),"messaging").getImmediate()}async function fD(n,e){return n=L(n),N_(n,e)}function pD(n,e){return n=L(n),AN(n,e)}wN();var Tc,ff,Lo=function(){var n=self.performance&&performance.getEntriesByType&&performance.getEntriesByType("navigation")[0];if(n&&n.responseStart>0&&n.responseStart<performance.now())return n},D_=function(n){if(document.readyState==="loading")return"loading";var e=Lo();if(e){if(n<e.domInteractive)return"loading";if(e.domContentLoadedEventStart===0||n<e.domContentLoadedEventStart)return"dom-interactive";if(e.domComplete===0||n<e.domComplete)return"dom-content-loaded"}return"complete"},RN=function(n){var e=n.nodeName;return n.nodeType===1?e.toLowerCase():e.toUpperCase().replace(/^#/,"")},Zu=function(n,e){var t="";try{for(;n&&n.nodeType!==9;){var r=n,i=r.id?"#"+r.id:RN(r)+(r.classList&&r.classList.value&&r.classList.value.trim()&&r.classList.value.trim().length?"."+r.classList.value.trim().replace(/\s+/g,"."):"");if(t.length+i.length>(e||100)-1)return t||i;if(t=t?i+">"+t:i,r.id)break;n=r.parentNode}}catch{}return t},O_=-1,bN=function(){return O_},zi=function(n){addEventListener("pageshow",function(e){e.persisted&&(O_=e.timeStamp,n(e))},!0)},el=function(){var n=Lo();return n&&n.activationStart||0},hn=function(n,e){var t=Lo(),r="navigate";return bN()>=0?r="back-forward-cache":t&&(document.prerendering||el()>0?r="prerender":document.wasDiscarded?r="restore":t.type&&(r=t.type.replace(/_/g,"-"))),{name:n,value:e===void 0?-1:e,rating:"good",delta:0,entries:[],id:"v4-".concat(Date.now(),"-").concat(Math.floor(8999999999999*Math.random())+1e12),navigationType:r}},kr=function(n,e,t){try{if(PerformanceObserver.supportedEntryTypes.includes(n)){var r=new PerformanceObserver(function(i){Promise.resolve().then(function(){e(i.getEntries())})});return r.observe(Object.assign({type:n,buffered:!0},t||{})),r}}catch{}},dn=function(n,e,t,r){var i,s;return function(a){e.value>=0&&(a||r)&&((s=e.value-(i||0))||i===void 0)&&(i=e.value,e.delta=s,e.rating=function(c,u){return c>u[1]?"poor":c>u[0]?"needs-improvement":"good"}(e.value,t),n(e))}},tl=function(n){requestAnimationFrame(function(){return requestAnimationFrame(function(){return n()})})},Uo=function(n){document.addEventListener("visibilitychange",function(){document.visibilityState==="hidden"&&n()})},nl=function(n){var e=!1;return function(){e||(n(),e=!0)}},Jn=-1,pf=function(){return document.visibilityState!=="hidden"||document.prerendering?1/0:0},ro=function(n){document.visibilityState==="hidden"&&Jn>-1&&(Jn=n.type==="visibilitychange"?n.timeStamp:0,SN())},mf=function(){addEventListener("visibilitychange",ro,!0),addEventListener("prerenderingchange",ro,!0)},SN=function(){removeEventListener("visibilitychange",ro,!0),removeEventListener("prerenderingchange",ro,!0)},V_=function(){return Jn<0&&(Jn=pf(),mf(),zi(function(){setTimeout(function(){Jn=pf(),mf()},0)})),{get firstHiddenTime(){return Jn}}},rl=function(n){document.prerendering?addEventListener("prerenderingchange",function(){return n()},!0):n()},gf=[1800,3e3],PN=function(n,e){e=e||{},rl(function(){var t,r=V_(),i=hn("FCP"),s=kr("paint",function(a){a.forEach(function(c){c.name==="first-contentful-paint"&&(s.disconnect(),c.startTime<r.firstHiddenTime&&(i.value=Math.max(c.startTime-el(),0),i.entries.push(c),t(!0)))})});s&&(t=dn(n,i,gf,e.reportAllChanges),zi(function(a){i=hn("FCP"),t=dn(n,i,gf,e.reportAllChanges),tl(function(){i.value=performance.now()-a.timeStamp,t(!0)})}))})},_f=[.1,.25],CN=function(n,e){(function(t,r){r=r||{},PN(nl(function(){var i,s=hn("CLS",0),a=0,c=[],u=function(f){f.forEach(function(m){if(!m.hadRecentInput){var y=c[0],b=c[c.length-1];a&&m.startTime-b.startTime<1e3&&m.startTime-y.startTime<5e3?(a+=m.value,c.push(m)):(a=m.value,c=[m])}}),a>s.value&&(s.value=a,s.entries=c,i())},h=kr("layout-shift",u);h&&(i=dn(t,s,_f,r.reportAllChanges),Uo(function(){u(h.takeRecords()),i(!0)}),zi(function(){a=0,s=hn("CLS",0),i=dn(t,s,_f,r.reportAllChanges),tl(function(){return i()})}),setTimeout(i,0))}))})(function(t){var r=function(i){var s,a={};if(i.entries.length){var c=i.entries.reduce(function(h,f){return h&&h.value>f.value?h:f});if(c&&c.sources&&c.sources.length){var u=(s=c.sources).find(function(h){return h.node&&h.node.nodeType===1})||s[0];u&&(a={largestShiftTarget:Zu(u.node),largestShiftTime:c.startTime,largestShiftValue:c.value,largestShiftSource:u,largestShiftEntry:c,loadState:D_(c.startTime)})}}return Object.assign(i,{attribution:a})}(t);n(r)},e)},M_=0,Ua=1/0,ys=0,kN=function(n){n.forEach(function(e){e.interactionId&&(Ua=Math.min(Ua,e.interactionId),ys=Math.max(ys,e.interactionId),M_=ys?(ys-Ua)/7+1:0)})},L_=function(){return Tc?M_:performance.interactionCount||0},NN=function(){"interactionCount"in performance||Tc||(Tc=kr("event",kN,{type:"event",buffered:!0,durationThreshold:0}))},it=[],fi=new Map,U_=0,DN=function(){var n=Math.min(it.length-1,Math.floor((L_()-U_)/50));return it[n]},x_=[],ON=function(n){if(x_.forEach(function(i){return i(n)}),n.interactionId||n.entryType==="first-input"){var e=it[it.length-1],t=fi.get(n.interactionId);if(t||it.length<10||n.duration>e.latency){if(t)n.duration>t.latency?(t.entries=[n],t.latency=n.duration):n.duration===t.latency&&n.startTime===t.entries[0].startTime&&t.entries.push(n);else{var r={id:n.interactionId,latency:n.duration,entries:[n]};fi.set(r.id,r),it.push(r)}it.sort(function(i,s){return s.latency-i.latency}),it.length>10&&it.splice(10).forEach(function(i){return fi.delete(i.id)})}}},il=function(n){var e=self.requestIdleCallback||self.setTimeout,t=-1;return n=nl(n),document.visibilityState==="hidden"?n():(t=e(n),Uo(n)),t},yf=[200,500],VN=function(n,e){"PerformanceEventTiming"in self&&"interactionId"in PerformanceEventTiming.prototype&&(e=e||{},rl(function(){var t;NN();var r,i=hn("INP"),s=function(c){il(function(){c.forEach(ON);var u=DN();u&&u.latency!==i.value&&(i.value=u.latency,i.entries=u.entries,r())})},a=kr("event",s,{durationThreshold:(t=e.durationThreshold)!==null&&t!==void 0?t:40});r=dn(n,i,yf,e.reportAllChanges),a&&(a.observe({type:"first-input",buffered:!0}),Uo(function(){s(a.takeRecords()),r(!0)}),zi(function(){U_=L_(),it.length=0,fi.clear(),i=hn("INP"),r=dn(n,i,yf,e.reportAllChanges)}))}))},sr=[],Yt=[],Ec=0,sl=new WeakMap,or=new Map,Ic=-1,MN=function(n){sr=sr.concat(n),F_()},F_=function(){Ic<0&&(Ic=il(LN))},LN=function(){or.size>10&&or.forEach(function(a,c){fi.has(c)||or.delete(c)});var n=it.map(function(a){return sl.get(a.entries[0])}),e=Yt.length-50;Yt=Yt.filter(function(a,c){return c>=e||n.includes(a)});for(var t=new Set,r=0;r<Yt.length;r++){var i=Yt[r];B_(i.startTime,i.processingEnd).forEach(function(a){t.add(a)})}var s=sr.length-1-50;sr=sr.filter(function(a,c){return a.startTime>Ec&&c>s||t.has(a)}),Ic=-1};x_.push(function(n){n.interactionId&&n.target&&!or.has(n.interactionId)&&or.set(n.interactionId,n.target)},function(n){var e,t=n.startTime+n.duration;Ec=Math.max(Ec,n.processingEnd);for(var r=Yt.length-1;r>=0;r--){var i=Yt[r];if(Math.abs(t-i.renderTime)<=8){(e=i).startTime=Math.min(n.startTime,e.startTime),e.processingStart=Math.min(n.processingStart,e.processingStart),e.processingEnd=Math.max(n.processingEnd,e.processingEnd),e.entries.push(n);break}}e||(e={startTime:n.startTime,processingStart:n.processingStart,processingEnd:n.processingEnd,renderTime:t,entries:[n]},Yt.push(e)),(n.interactionId||n.entryType==="first-input")&&sl.set(n,e),F_()});var B_=function(n,e){for(var t,r=[],i=0;t=sr[i];i++)if(!(t.startTime+t.duration<n)){if(t.startTime>e)break;r.push(t)}return r},UN=function(n,e){ff||(ff=kr("long-animation-frame",MN)),VN(function(t){var r=function(i){var s=i.entries[0],a=sl.get(s),c=s.processingStart,u=a.processingEnd,h=a.entries.sort(function(N,F){return N.processingStart-F.processingStart}),f=B_(s.startTime,u),m=i.entries.find(function(N){return N.target}),y=m&&m.target||or.get(s.interactionId),b=[s.startTime+s.duration,u].concat(f.map(function(N){return N.startTime+N.duration})),k=Math.max.apply(Math,b),V={interactionTarget:Zu(y),interactionTargetElement:y,interactionType:s.name.startsWith("key")?"keyboard":"pointer",interactionTime:s.startTime,nextPaintTime:k,processedEventEntries:h,longAnimationFrameEntries:f,inputDelay:c-s.startTime,processingDuration:u-c,presentationDelay:Math.max(k-u,0),loadState:D_(s.startTime)};return Object.assign(i,{attribution:V})}(t);n(r)},e)},Tf=[2500,4e3],xa={},xN=function(n,e){(function(t,r){r=r||{},rl(function(){var i,s=V_(),a=hn("LCP"),c=function(f){r.reportAllChanges||(f=f.slice(-1)),f.forEach(function(m){m.startTime<s.firstHiddenTime&&(a.value=Math.max(m.startTime-el(),0),a.entries=[m],i())})},u=kr("largest-contentful-paint",c);if(u){i=dn(t,a,Tf,r.reportAllChanges);var h=nl(function(){xa[a.id]||(c(u.takeRecords()),u.disconnect(),xa[a.id]=!0,i(!0))});["keydown","click"].forEach(function(f){addEventListener(f,function(){return il(h)},{once:!0,capture:!0})}),Uo(h),zi(function(f){a=hn("LCP"),i=dn(t,a,Tf,r.reportAllChanges),tl(function(){a.value=performance.now()-f.timeStamp,xa[a.id]=!0,i(!0)})})}})})(function(t){var r=function(i){var s={timeToFirstByte:0,resourceLoadDelay:0,resourceLoadDuration:0,elementRenderDelay:i.value};if(i.entries.length){var a=Lo();if(a){var c=a.activationStart||0,u=i.entries[i.entries.length-1],h=u.url&&performance.getEntriesByType("resource").filter(function(k){return k.name===u.url})[0],f=Math.max(0,a.responseStart-c),m=Math.max(f,h?(h.requestStart||h.startTime)-c:0),y=Math.max(m,h?h.responseEnd-c:0),b=Math.max(y,u.startTime-c);s={element:Zu(u.element),timeToFirstByte:f,resourceLoadDelay:m-f,resourceLoadDuration:y-m,elementRenderDelay:b-y,navigationEntry:a,lcpEntry:u},u.url&&(s.url=u.url),h&&(s.lcpResourceEntry=h)}}return Object.assign(i,{attribution:s})}(t);n(r)},e)};const Ef="@firebase/performance",wc="0.7.10";/**
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
 */const $_=wc,FN="FB-PERF-TRACE-START",BN="FB-PERF-TRACE-STOP",vc="FB-PERF-TRACE-MEASURE",q_="_wt_",j_="_fp",H_="_fcp",z_="_fid",W_="_lcp",$N="lcp_element",G_="_inp",qN="inp_interactionTarget",K_="_cls",jN="cls_largestShiftTarget",Y_="@firebase/performance/config",Q_="@firebase/performance/configexpire",HN="performance",J_="Performance";/**
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
 */const zN={"trace started":"Trace {$traceName} was started before.","trace stopped":"Trace {$traceName} is not running.","nonpositive trace startTime":"Trace {$traceName} startTime should be positive.","nonpositive trace duration":"Trace {$traceName} duration should be positive.","no window":"Window is not available.","no app id":"App id is not available.","no project id":"Project id is not available.","no api key":"Api key is not available.","invalid cc log":"Attempted to queue invalid cc event","FB not default":"Performance can only start when Firebase app instance is the default one.","RC response not ok":"RC response is not ok","invalid attribute name":"Attribute name {$attributeName} is invalid.","invalid attribute value":"Attribute value {$attributeValue} is invalid.","invalid custom metric name":"Custom metric name {$customMetricName} is invalid","invalid String merger input":"Input for String merger is invalid, contact support team to resolve.","already initialized":"initializePerformance() has already been called with different options. To avoid this error, call initializePerformance() with the same options as when it was originally called, or call getPerformance() to return the already initialized instance."},be=new Et(HN,J_,zN);/**
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
 */const xt=new _r(J_);xt.logLevel=z.INFO;/**
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
 */let Fa,X_;class Ie{constructor(e){if(this.window=e,!e)throw be.create("no window");this.performance=e.performance,this.PerformanceObserver=e.PerformanceObserver,this.windowLocation=e.location,this.navigator=e.navigator,this.document=e.document,this.navigator&&this.navigator.cookieEnabled&&(this.localStorage=e.localStorage),e.perfMetrics&&e.perfMetrics.onFirstInputDelay&&(this.onFirstInputDelay=e.perfMetrics.onFirstInputDelay),this.onLCP=xN,this.onINP=UN,this.onCLS=CN}getUrl(){return this.windowLocation.href.split("?")[0]}mark(e){!this.performance||!this.performance.mark||this.performance.mark(e)}measure(e,t,r){!this.performance||!this.performance.measure||this.performance.measure(e,t,r)}getEntriesByType(e){return!this.performance||!this.performance.getEntriesByType?[]:this.performance.getEntriesByType(e)}getEntriesByName(e){return!this.performance||!this.performance.getEntriesByName?[]:this.performance.getEntriesByName(e)}getTimeOrigin(){return this.performance&&(this.performance.timeOrigin||this.performance.timing.navigationStart)}requiredApisAvailable(){return!fetch||!Promise||!so()?(xt.info("Firebase Performance cannot start if browser does not support fetch and Promise or cookie is disabled."),!1):On()?!0:(xt.info("IndexedDB is not supported by current browser"),!1)}setupObserver(e,t){if(!this.PerformanceObserver)return;new this.PerformanceObserver(i=>{for(const s of i.getEntries())t(s)}).observe({entryTypes:[e]})}static getInstance(){return Fa===void 0&&(Fa=new Ie(X_)),Fa}}function WN(n){X_=n}/**
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
 */let Z_;function GN(n){const e=n.getId();return e.then(t=>{Z_=t}),e}function ol(){return Z_}function KN(n){const e=n.getToken();return e.then(t=>{}),e}/**
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
 */function If(n,e){const t=n.length-e.length;if(t<0||t>1)throw be.create("invalid String merger input");const r=[];for(let i=0;i<n.length;i++)r.push(n.charAt(i)),e.length>i&&r.push(e.charAt(i));return r.join("")}/**
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
 */let Ba;class Be{constructor(){this.instrumentationEnabled=!0,this.dataCollectionEnabled=!0,this.loggingEnabled=!1,this.tracesSamplingRate=1,this.networkRequestsSamplingRate=1,this.logEndPointUrl="https://firebaselogging.googleapis.com/v0cc/log?format=json_proto",this.flTransportEndpointUrl=If("hts/frbslgigp.ogepscmv/ieo/eaylg","tp:/ieaeogn-agolai.o/1frlglgc/o"),this.transportKey=If("AzSC8r6ReiGqFMyfvgow","Iayx0u-XT3vksVM-pIV"),this.logSource=462,this.logTraceAfterSampling=!1,this.logNetworkAfterSampling=!1,this.configTimeToLive=12,this.logMaxFlushSize=40}getFlTransportFullUrl(){return this.flTransportEndpointUrl.concat("?key=",this.transportKey)}static getInstance(){return Ba===void 0&&(Ba=new Be),Ba}}/**
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
 */var pi;(function(n){n[n.UNKNOWN=0]="UNKNOWN",n[n.VISIBLE=1]="VISIBLE",n[n.HIDDEN=2]="HIDDEN"})(pi||(pi={}));const YN=["firebase_","google_","ga_"],QN=new RegExp("^[a-zA-Z]\\w*$"),JN=40,Ac=100;function XN(){const n=Ie.getInstance().navigator;return n!=null&&n.serviceWorker?n.serviceWorker.controller?2:3:1}function ZN(){switch(Ie.getInstance().document.visibilityState){case"visible":return pi.VISIBLE;case"hidden":return pi.HIDDEN;default:return pi.UNKNOWN}}function e0(){const e=Ie.getInstance().navigator.connection;switch(e&&e.effectiveType){case"slow-2g":return 1;case"2g":return 2;case"3g":return 3;case"4g":return 4;default:return 0}}function t0(n){return n.length===0||n.length>JN?!1:!YN.some(t=>n.startsWith(t))&&!!n.match(QN)}function n0(n){return n.length!==0&&n.length<=Ac}/**
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
 */function ey(n){var t;const e=(t=n.options)==null?void 0:t.appId;if(!e)throw be.create("no app id");return e}function r0(n){var t;const e=(t=n.options)==null?void 0:t.projectId;if(!e)throw be.create("no project id");return e}function i0(n){var t;const e=(t=n.options)==null?void 0:t.apiKey;if(!e)throw be.create("no api key");return e}/**
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
 */const s0="0.0.1",Qe={loggingEnabled:!0},o0="FIREBASE_INSTALLATIONS_AUTH";function a0(n,e){const t=c0();return t?(wf(t),Promise.resolve()):h0(n,e).then(wf).then(r=>u0(r),()=>{})}function c0(){const n=Ie.getInstance().localStorage;if(!n)return;const e=n.getItem(Q_);if(!e||!d0(e))return;const t=n.getItem(Y_);if(t)try{return JSON.parse(t)}catch{return}}function u0(n){const e=Ie.getInstance().localStorage;!n||!e||(e.setItem(Y_,JSON.stringify(n)),e.setItem(Q_,String(Date.now()+Be.getInstance().configTimeToLive*60*60*1e3)))}const l0="Could not fetch config, will use default configs";function h0(n,e){return KN(n.installations).then(t=>{const r=r0(n.app),i=i0(n.app),s=`https://firebaseremoteconfig.googleapis.com/v1/projects/${r}/namespaces/fireperf:fetch?key=${i}`,a=new Request(s,{method:"POST",headers:{Authorization:`${o0} ${t}`},body:JSON.stringify({app_instance_id:e,app_instance_id_token:t,app_id:ey(n.app),app_version:$_,sdk_version:s0})});return fetch(a).then(c=>{if(c.ok)return c.json();throw be.create("RC response not ok")})}).catch(()=>{xt.info(l0)})}function wf(n){if(!n)return n;const e=Be.getInstance(),t=n.entries||{};return t.fpr_enabled!==void 0?e.loggingEnabled=String(t.fpr_enabled)==="true":e.loggingEnabled=Qe.loggingEnabled,t.fpr_log_source?e.logSource=Number(t.fpr_log_source):Qe.logSource&&(e.logSource=Qe.logSource),t.fpr_log_endpoint_url?e.logEndPointUrl=t.fpr_log_endpoint_url:Qe.logEndPointUrl&&(e.logEndPointUrl=Qe.logEndPointUrl),t.fpr_log_transport_key?e.transportKey=t.fpr_log_transport_key:Qe.transportKey&&(e.transportKey=Qe.transportKey),t.fpr_vc_network_request_sampling_rate!==void 0?e.networkRequestsSamplingRate=Number(t.fpr_vc_network_request_sampling_rate):Qe.networkRequestsSamplingRate!==void 0&&(e.networkRequestsSamplingRate=Qe.networkRequestsSamplingRate),t.fpr_vc_trace_sampling_rate!==void 0?e.tracesSamplingRate=Number(t.fpr_vc_trace_sampling_rate):Qe.tracesSamplingRate!==void 0&&(e.tracesSamplingRate=Qe.tracesSamplingRate),t.fpr_log_max_flush_size?e.logMaxFlushSize=Number(t.fpr_log_max_flush_size):Qe.logMaxFlushSize&&(e.logMaxFlushSize=Qe.logMaxFlushSize),e.logTraceAfterSampling=vf(e.tracesSamplingRate),e.logNetworkAfterSampling=vf(e.networkRequestsSamplingRate),n}function d0(n){return Number(n)>Date.now()}function vf(n){return Math.random()<=n}/**
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
 */let al=1,$a;function ty(n){return al=2,$a=$a||p0(n),$a}function f0(){return al===3}function p0(n){return m0().then(()=>GN(n.installations)).then(e=>a0(n,e)).then(()=>Af(),()=>Af())}function m0(){const n=Ie.getInstance().document;return new Promise(e=>{if(n&&n.readyState!=="complete"){const t=()=>{n.readyState==="complete"&&(n.removeEventListener("readystatechange",t),e())};n.addEventListener("readystatechange",t)}else e()})}function Af(){al=3}/**
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
 */const ny=10*1e3,g0=5.5*1e3,_0=1e3,ry=3,y0=65536,T0=new TextEncoder;let ks=ry,Ze=[],Rf=!1;function E0(){Rf||(cl(g0),Rf=!0)}function cl(n){setTimeout(()=>{ks<=0||(Ze.length>0&&I0(),cl(ny))},n)}function I0(){const n=Ze.splice(0,_0),e=Rc(n);w0(e).then(()=>{ks=ry}).catch(()=>{Ze=[...n,...Ze],ks--,xt.info(`Tries left: ${ks}.`),cl(ny)})}function Rc(n){const e=n.map(r=>({source_extension_json_proto3:r.message,event_time_ms:String(r.eventTime)})),t={request_time_ms:String(Date.now()),client_info:{client_type:1,js_client_info:{}},log_source:Be.getInstance().logSource,log_event:e};return JSON.stringify(t)}function w0(n){const e=Be.getInstance().getFlTransportFullUrl();return T0.encode(n).length<=y0&&navigator.sendBeacon&&navigator.sendBeacon(e,n)?Promise.resolve():fetch(e,{method:"POST",body:n})}function v0(n){if(!n.eventTime||!n.message)throw be.create("invalid cc log");Ze=[...Ze,n]}function A0(n){return(...e)=>{const t=n(...e);v0({message:t,eventTime:Date.now()})}}function R0(){const n=Be.getInstance().getFlTransportFullUrl();for(;Ze.length>0;){const e=Ze.splice(-Be.getInstance().logMaxFlushSize),t=Rc(e);if(!(navigator.sendBeacon&&navigator.sendBeacon(n,t))){Ze=[...Ze,...e];break}}if(Ze.length>0){const e=Rc(Ze);fetch(n,{method:"POST",body:e}).catch(()=>{xt.info("Failed flushing queued events.")})}}/**
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
 */let mi;function iy(n,e){mi||(mi={send:A0(P0),flush:R0}),mi.send(n,e)}function Ts(n){const e=Be.getInstance();!e.instrumentationEnabled&&n.isAuto||!e.dataCollectionEnabled&&!n.isAuto||Ie.getInstance().requiredApisAvailable()&&(f0()?qa(n):ty(n.performanceController).then(()=>qa(n),()=>qa(n)))}function b0(){mi&&mi.flush()}function qa(n){if(!ol())return;const e=Be.getInstance();!e.loggingEnabled||!e.logTraceAfterSampling||iy(n,1)}function S0(n){const e=Be.getInstance();if(!e.instrumentationEnabled)return;const t=n.url,r=e.logEndPointUrl.split("?")[0],i=e.flTransportEndpointUrl.split("?")[0];t===r||t===i||!e.loggingEnabled||!e.logNetworkAfterSampling||iy(n,0)}function P0(n,e){return e===0?C0(n):k0(n)}function C0(n){const e={url:n.url,http_method:n.httpMethod||0,http_response_code:200,response_payload_bytes:n.responsePayloadBytes,client_start_time_us:n.startTimeUs,time_to_response_initiated_us:n.timeToResponseInitiatedUs,time_to_response_completed_us:n.timeToResponseCompletedUs},t={application_info:sy(n.performanceController.app),network_request_metric:e};return JSON.stringify(t)}function k0(n){const e={name:n.name,is_auto:n.isAuto,client_start_time_us:n.startTimeUs,duration_us:n.durationUs};Object.keys(n.counters).length!==0&&(e.counters=n.counters);const t=n.getAttributes();Object.keys(t).length!==0&&(e.custom_attributes=t);const r={application_info:sy(n.performanceController.app),trace_metric:e};return JSON.stringify(r)}function sy(n){return{google_app_id:ey(n),app_instance_id:ol(),web_app_info:{sdk_version:$_,page_url:Ie.getInstance().getUrl(),service_worker_status:XN(),visibility_state:ZN(),effective_connection_type:e0()},application_process_state:0}}/**
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
 */function bf(n,e){const t=e;if(!t||t.responseStart===void 0)return;const r=Ie.getInstance().getTimeOrigin(),i=Math.floor((t.startTime+r)*1e3),s=t.responseStart?Math.floor((t.responseStart-t.startTime)*1e3):void 0,a=Math.floor((t.responseEnd-t.startTime)*1e3),c=t.name&&t.name.split("?")[0],u={performanceController:n,url:c,responsePayloadBytes:t.transferSize,startTimeUs:i,timeToResponseInitiatedUs:s,timeToResponseCompletedUs:a};S0(u)}/**
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
 */const N0=100,D0="_",O0=[j_,H_,z_,W_,K_,G_];function V0(n,e){return n.length===0||n.length>N0?!1:e&&e.startsWith(q_)&&O0.indexOf(n)>-1||!n.startsWith(D0)}function M0(n){const e=Math.floor(n);return e<n&&xt.info(`Metric value should be an Integer, setting the value as : ${e}.`),e}/**
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
 */class mr{constructor(e,t,r=!1,i){this.performanceController=e,this.name=t,this.isAuto=r,this.state=1,this.customAttributes={},this.counters={},this.api=Ie.getInstance(),this.randomId=Math.floor(Math.random()*1e6),this.isAuto||(this.traceStartMark=`${FN}-${this.randomId}-${this.name}`,this.traceStopMark=`${BN}-${this.randomId}-${this.name}`,this.traceMeasure=i||`${vc}-${this.randomId}-${this.name}`,i&&this.calculateTraceMetrics())}start(){if(this.state!==1)throw be.create("trace started",{traceName:this.name});this.api.mark(this.traceStartMark),this.state=2}stop(){if(this.state!==2)throw be.create("trace stopped",{traceName:this.name});this.state=3,this.api.mark(this.traceStopMark),this.api.measure(this.traceMeasure,this.traceStartMark,this.traceStopMark),this.calculateTraceMetrics(),Ts(this)}record(e,t,r){if(e<=0)throw be.create("nonpositive trace startTime",{traceName:this.name});if(t<=0)throw be.create("nonpositive trace duration",{traceName:this.name});if(this.durationUs=Math.floor(t*1e3),this.startTimeUs=Math.floor(e*1e3),r&&r.attributes&&(this.customAttributes={...r.attributes}),r&&r.metrics)for(const i of Object.keys(r.metrics))isNaN(Number(r.metrics[i]))||(this.counters[i]=Math.floor(Number(r.metrics[i])));Ts(this)}incrementMetric(e,t=1){this.counters[e]===void 0?this.putMetric(e,t):this.putMetric(e,this.counters[e]+t)}putMetric(e,t){if(V0(e,this.name))this.counters[e]=M0(t??0);else throw be.create("invalid custom metric name",{customMetricName:e})}getMetric(e){return this.counters[e]||0}putAttribute(e,t){const r=t0(e),i=n0(t);if(r&&i){this.customAttributes[e]=t;return}if(!r)throw be.create("invalid attribute name",{attributeName:e});if(!i)throw be.create("invalid attribute value",{attributeValue:t})}getAttribute(e){return this.customAttributes[e]}removeAttribute(e){this.customAttributes[e]!==void 0&&delete this.customAttributes[e]}getAttributes(){return{...this.customAttributes}}setStartTime(e){this.startTimeUs=e}setDuration(e){this.durationUs=e}calculateTraceMetrics(){const e=this.api.getEntriesByName(this.traceMeasure),t=e&&e[0];t&&(this.durationUs=Math.floor(t.duration*1e3),this.startTimeUs=Math.floor((t.startTime+this.api.getTimeOrigin())*1e3))}static createOobTrace(e,t,r,i,s){const a=Ie.getInstance().getUrl();if(!a)return;const c=new mr(e,q_+a,!0),u=Math.floor(Ie.getInstance().getTimeOrigin()*1e3);c.setStartTime(u),t&&t[0]&&(c.setDuration(Math.floor(t[0].duration*1e3)),c.putMetric("domInteractive",Math.floor(t[0].domInteractive*1e3)),c.putMetric("domContentLoadedEventEnd",Math.floor(t[0].domContentLoadedEventEnd*1e3)),c.putMetric("loadEventEnd",Math.floor(t[0].loadEventEnd*1e3)));const h="first-paint",f="first-contentful-paint";if(r){const m=r.find(b=>b.name===h);m&&m.startTime&&c.putMetric(j_,Math.floor(m.startTime*1e3));const y=r.find(b=>b.name===f);y&&y.startTime&&c.putMetric(H_,Math.floor(y.startTime*1e3)),s&&c.putMetric(z_,Math.floor(s*1e3))}this.addWebVitalMetric(c,W_,$N,i.lcp),this.addWebVitalMetric(c,K_,jN,i.cls),this.addWebVitalMetric(c,G_,qN,i.inp),Ts(c),b0()}static addWebVitalMetric(e,t,r,i){i&&(e.putMetric(t,Math.floor(i.value*1e3)),i.elementAttribution&&(i.elementAttribution.length>Ac?e.putAttribute(r,i.elementAttribution.substring(0,Ac)):e.putAttribute(r,i.elementAttribution)))}static createUserTimingTrace(e,t){const r=new mr(e,t,!1,t);Ts(r)}}/**
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
 */let Ns={},Sf=!1,oy;function Pf(n){ol()&&(setTimeout(()=>U0(n),0),setTimeout(()=>L0(n),0),setTimeout(()=>x0(n),0))}function L0(n){const e=Ie.getInstance(),t=e.getEntriesByType("resource");for(const r of t)bf(n,r);e.setupObserver("resource",r=>bf(n,r))}function U0(n){const e=Ie.getInstance();"onpagehide"in window?e.document.addEventListener("pagehide",()=>ja(n)):e.document.addEventListener("unload",()=>ja(n)),e.document.addEventListener("visibilitychange",()=>{e.document.visibilityState==="hidden"&&ja(n)}),e.onFirstInputDelay&&e.onFirstInputDelay(t=>{oy=t}),e.onLCP(t=>{var r;Ns.lcp={value:t.value,elementAttribution:(r=t.attribution)==null?void 0:r.element}}),e.onCLS(t=>{var r;Ns.cls={value:t.value,elementAttribution:(r=t.attribution)==null?void 0:r.largestShiftTarget}}),e.onINP(t=>{var r;Ns.inp={value:t.value,elementAttribution:(r=t.attribution)==null?void 0:r.interactionTarget}})}function x0(n){const e=Ie.getInstance(),t=e.getEntriesByType("measure");for(const r of t)Cf(n,r);e.setupObserver("measure",r=>Cf(n,r))}function Cf(n,e){const t=e.name;t.substring(0,vc.length)!==vc&&mr.createUserTimingTrace(n,t)}function ja(n){if(!Sf){Sf=!0;const e=Ie.getInstance(),t=e.getEntriesByType("navigation"),r=e.getEntriesByType("paint");setTimeout(()=>{mr.createOobTrace(n,t,r,Ns,oy)},0)}}/**
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
 */class F0{constructor(e,t){this.app=e,this.installations=t,this.initialized=!1}_init(e){this.initialized||((e==null?void 0:e.dataCollectionEnabled)!==void 0&&(this.dataCollectionEnabled=e.dataCollectionEnabled),(e==null?void 0:e.instrumentationEnabled)!==void 0&&(this.instrumentationEnabled=e.instrumentationEnabled),Ie.getInstance().requiredApisAvailable()?Di().then(t=>{t&&(E0(),ty(this).then(()=>Pf(this),()=>Pf(this)),this.initialized=!0)}).catch(t=>{xt.info(`Environment doesn't support IndexedDB: ${t}`)}):xt.info('Firebase Performance cannot start if the browser does not support "Fetch" and "Promise", or cookies are disabled.'))}set instrumentationEnabled(e){Be.getInstance().instrumentationEnabled=e}get instrumentationEnabled(){return Be.getInstance().instrumentationEnabled}set dataCollectionEnabled(e){Be.getInstance().dataCollectionEnabled=e}get dataCollectionEnabled(){return Be.getInstance().dataCollectionEnabled}}const B0="[DEFAULT]";function $0(n=yr()){return n=L(n),Ke(n,"performance").getImmediate()}function q0(n,e){n=L(n);const t=Ke(n,"performance");if(t.isInitialized()){const i=t.getImmediate(),s=t.getOptions();if(Dt(s,e??{}))return i;throw be.create("already initialized")}return t.initialize({options:e})}function j0(n,e){return n=L(n),new mr(n,e)}const H0=(n,{options:e})=>{const t=n.getProvider("app").getImmediate(),r=n.getProvider("installations-internal").getImmediate();if(t.name!==B0)throw be.create("FB not default");if(typeof window>"u")throw be.create("no window");WN(window);const i=new F0(t,r);return i._init(e),i};function z0(){Le(new Ce("performance",H0,"PUBLIC")),Te(Ef,wc),Te(Ef,wc,"esm2020")}z0();const mD=Object.freeze(Object.defineProperty({__proto__:null,getPerformance:$0,initializePerformance:q0,trace:j0},Symbol.toStringTag,{value:"Module"}));export{hw as $,Q0 as A,cD as B,hC as C,$p as D,Vp as E,wt as F,vt as G,Pp as H,lw as I,qI as J,YI as K,QI as L,_v as M,KI as N,oi as O,_w as P,Kw as Q,$u as R,Rn as S,ee as T,Zw as U,hD as V,lD as W,Uk as X,Lk as Y,pw as Z,qc as _,iD as a,dD as a0,rD as a1,fD as a2,pD as a3,nD as a4,G0 as a5,uD as a6,mD as a7,hv as b,Y0 as c,iv as d,$I as e,oD as f,tD as g,sS as h,eD as i,eA as j,HI as k,jI as l,WI as m,GI as n,Z0 as o,nw as p,J0 as q,aD as r,ZI as s,lp as t,sD as u,zI as v,X0 as w,W0 as x,dE as y,yr as z};
