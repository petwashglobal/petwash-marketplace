import{r as c,j as f,R as Q,a as mt,b as tl,c as on,d as Gt,s as ol}from"./vendor-react-BqcpfMVt.js";function C(e,t,{checkForDefaultPrevented:o=!0}={}){return function(r){if(e==null||e(r),o===!1||!r.defaultPrevented)return t==null?void 0:t(r)}}function Gn(e,t){if(typeof e=="function")return e(t);e!=null&&(e.current=t)}function be(...e){return t=>{let o=!1;const n=e.map(r=>{const a=Gn(r,t);return!o&&typeof a=="function"&&(o=!0),a});if(o)return()=>{for(let r=0;r<n.length;r++){const a=n[r];typeof a=="function"?a():Gn(e[r],null)}}}}function j(...e){return c.useCallback(be(...e),e)}function nl(e,t){const o=c.createContext(t),n=a=>{const{children:s,...i}=a,l=c.useMemo(()=>i,Object.values(i));return f.jsx(o.Provider,{value:l,children:s})};n.displayName=e+"Provider";function r(a){const s=c.useContext(o);if(s)return s;if(t!==void 0)return t;throw new Error(`\`${a}\` must be used within \`${e}\``)}return[n,r]}function J(e,t=[]){let o=[];function n(a,s){const i=c.createContext(s),l=o.length;o=[...o,s];const d=u=>{var k;const{scope:h,children:m,...x}=u,v=((k=h==null?void 0:h[e])==null?void 0:k[l])||i,g=c.useMemo(()=>x,Object.values(x));return f.jsx(v.Provider,{value:g,children:m})};d.displayName=a+"Provider";function p(u,h){var v;const m=((v=h==null?void 0:h[e])==null?void 0:v[l])||i,x=c.useContext(m);if(x)return x;if(s!==void 0)return s;throw new Error(`\`${u}\` must be used within \`${a}\``)}return[d,p]}const r=()=>{const a=o.map(s=>c.createContext(s));return function(i){const l=(i==null?void 0:i[e])||a;return c.useMemo(()=>({[`__scope${e}`]:{...i,[e]:l}}),[i,l])}};return r.scopeName=e,[n,rl(r,...t)]}function rl(...e){const t=e[0];if(e.length===1)return t;const o=()=>{const n=e.map(r=>({useScope:r(),scopeName:r.scopeName}));return function(a){const s=n.reduce((i,{useScope:l,scopeName:d})=>{const u=l(a)[`__scope${d}`];return{...i,...u}},{});return c.useMemo(()=>({[`__scope${t.scopeName}`]:s}),[s])}};return o.scopeName=t.scopeName,o}function Yn(e){const t=al(e),o=c.forwardRef((n,r)=>{const{children:a,...s}=n,i=c.Children.toArray(a),l=i.find(cl);if(l){const d=l.props.children,p=i.map(u=>u===l?c.Children.count(d)>1?c.Children.only(null):c.isValidElement(d)?d.props.children:null:u);return f.jsx(t,{...s,ref:r,children:c.isValidElement(d)?c.cloneElement(d,void 0,p):null})}return f.jsx(t,{...s,ref:r,children:a})});return o.displayName=`${e}.Slot`,o}function al(e){const t=c.forwardRef((o,n)=>{const{children:r,...a}=o;if(c.isValidElement(r)){const s=ll(r),i=il(a,r.props);return r.type!==c.Fragment&&(i.ref=n?be(n,s):s),c.cloneElement(r,i)}return c.Children.count(r)>1?c.Children.only(null):null});return t.displayName=`${e}.SlotClone`,t}var sl=Symbol("radix.slottable");function cl(e){return c.isValidElement(e)&&typeof e.type=="function"&&"__radixId"in e.type&&e.type.__radixId===sl}function il(e,t){const o={...t};for(const n in t){const r=e[n],a=t[n];/^on[A-Z]/.test(n)?r&&a?o[n]=(...i)=>{const l=a(...i);return r(...i),l}:r&&(o[n]=r):n==="style"?o[n]={...r,...a}:n==="className"&&(o[n]=[r,a].filter(Boolean).join(" "))}return{...e,...o}}function ll(e){var n,r;let t=(n=Object.getOwnPropertyDescriptor(e.props,"ref"))==null?void 0:n.get,o=t&&"isReactWarning"in t&&t.isReactWarning;return o?e.ref:(t=(r=Object.getOwnPropertyDescriptor(e,"ref"))==null?void 0:r.get,o=t&&"isReactWarning"in t&&t.isReactWarning,o?e.props.ref:e.props.ref||e.ref)}function Qe(e){const t=e+"CollectionProvider",[o,n]=J(t),[r,a]=o(t,{collectionRef:{current:null},itemMap:new Map}),s=v=>{const{scope:g,children:k}=v,w=Q.useRef(null),b=Q.useRef(new Map).current;return f.jsx(r,{scope:g,itemMap:b,collectionRef:w,children:k})};s.displayName=t;const i=e+"CollectionSlot",l=Yn(i),d=Q.forwardRef((v,g)=>{const{scope:k,children:w}=v,b=a(i,k),_=j(g,b.collectionRef);return f.jsx(l,{ref:_,children:w})});d.displayName=i;const p=e+"CollectionItemSlot",u="data-radix-collection-item",h=Yn(p),m=Q.forwardRef((v,g)=>{const{scope:k,children:w,...b}=v,_=Q.useRef(null),M=j(g,_),E=a(p,k);return Q.useEffect(()=>(E.itemMap.set(_,{ref:_,...b}),()=>void E.itemMap.delete(_))),f.jsx(h,{[u]:"",ref:M,children:w})});m.displayName=p;function x(v){const g=a(e+"CollectionConsumer",v);return Q.useCallback(()=>{const w=g.collectionRef.current;if(!w)return[];const b=Array.from(w.querySelectorAll(`[${u}]`));return Array.from(g.itemMap.values()).sort((E,S)=>b.indexOf(E.ref.current)-b.indexOf(S.ref.current))},[g.collectionRef,g.itemMap])}return[{Provider:s,Slot:d,ItemSlot:m},x,n]}function dl(e){const t=ul(e),o=c.forwardRef((n,r)=>{const{children:a,...s}=n,i=c.Children.toArray(a),l=i.find(fl);if(l){const d=l.props.children,p=i.map(u=>u===l?c.Children.count(d)>1?c.Children.only(null):c.isValidElement(d)?d.props.children:null:u);return f.jsx(t,{...s,ref:r,children:c.isValidElement(d)?c.cloneElement(d,void 0,p):null})}return f.jsx(t,{...s,ref:r,children:a})});return o.displayName=`${e}.Slot`,o}function ul(e){const t=c.forwardRef((o,n)=>{const{children:r,...a}=o;if(c.isValidElement(r)){const s=yl(r),i=hl(a,r.props);return r.type!==c.Fragment&&(i.ref=n?be(n,s):s),c.cloneElement(r,i)}return c.Children.count(r)>1?c.Children.only(null):null});return t.displayName=`${e}.SlotClone`,t}var pl=Symbol("radix.slottable");function fl(e){return c.isValidElement(e)&&typeof e.type=="function"&&"__radixId"in e.type&&e.type.__radixId===pl}function hl(e,t){const o={...t};for(const n in t){const r=e[n],a=t[n];/^on[A-Z]/.test(n)?r&&a?o[n]=(...i)=>{const l=a(...i);return r(...i),l}:r&&(o[n]=r):n==="style"?o[n]={...r,...a}:n==="className"&&(o[n]=[r,a].filter(Boolean).join(" "))}return{...e,...o}}function yl(e){var n,r;let t=(n=Object.getOwnPropertyDescriptor(e.props,"ref"))==null?void 0:n.get,o=t&&"isReactWarning"in t&&t.isReactWarning;return o?e.ref:(t=(r=Object.getOwnPropertyDescriptor(e,"ref"))==null?void 0:r.get,o=t&&"isReactWarning"in t&&t.isReactWarning,o?e.props.ref:e.props.ref||e.ref)}var ml=["a","button","div","form","h2","h3","img","input","label","li","nav","ol","p","select","span","svg","ul"],A=ml.reduce((e,t)=>{const o=dl(`Primitive.${t}`),n=c.forwardRef((r,a)=>{const{asChild:s,...i}=r,l=s?o:t;return typeof window<"u"&&(window[Symbol.for("radix-ui")]=!0),f.jsx(l,{...i,ref:a})});return n.displayName=`Primitive.${t}`,{...e,[t]:n}},{});function nn(e,t){e&&mt.flushSync(()=>e.dispatchEvent(t))}function X(e){const t=c.useRef(e);return c.useEffect(()=>{t.current=e}),c.useMemo(()=>(...o)=>{var n;return(n=t.current)==null?void 0:n.call(t,...o)},[])}function vl(e,t=globalThis==null?void 0:globalThis.document){const o=X(e);c.useEffect(()=>{const n=r=>{r.key==="Escape"&&o(r)};return t.addEventListener("keydown",n,{capture:!0}),()=>t.removeEventListener("keydown",n,{capture:!0})},[o,t])}var gl="DismissableLayer",Oo="dismissableLayer.update",xl="dismissableLayer.pointerDownOutside",kl="dismissableLayer.focusOutside",Xn,br=c.createContext({layers:new Set,layersWithOutsidePointerEventsDisabled:new Set,branches:new Set}),He=c.forwardRef((e,t)=>{const{disableOutsidePointerEvents:o=!1,onEscapeKeyDown:n,onPointerDownOutside:r,onFocusOutside:a,onInteractOutside:s,onDismiss:i,...l}=e,d=c.useContext(br),[p,u]=c.useState(null),h=(p==null?void 0:p.ownerDocument)??(globalThis==null?void 0:globalThis.document),[,m]=c.useState({}),x=j(t,S=>u(S)),v=Array.from(d.layers),[g]=[...d.layersWithOutsidePointerEventsDisabled].slice(-1),k=v.indexOf(g),w=p?v.indexOf(p):-1,b=d.layersWithOutsidePointerEventsDisabled.size>0,_=w>=k,M=bl(S=>{const N=S.target,T=[...d.branches].some(I=>I.contains(N));!_||T||(r==null||r(S),s==null||s(S),S.defaultPrevented||i==null||i())},h),E=_l(S=>{const N=S.target;[...d.branches].some(I=>I.contains(N))||(a==null||a(S),s==null||s(S),S.defaultPrevented||i==null||i())},h);return vl(S=>{w===d.layers.size-1&&(n==null||n(S),!S.defaultPrevented&&i&&(S.preventDefault(),i()))},h),c.useEffect(()=>{if(p)return o&&(d.layersWithOutsidePointerEventsDisabled.size===0&&(Xn=h.body.style.pointerEvents,h.body.style.pointerEvents="none"),d.layersWithOutsidePointerEventsDisabled.add(p)),d.layers.add(p),Zn(),()=>{o&&d.layersWithOutsidePointerEventsDisabled.size===1&&(h.body.style.pointerEvents=Xn)}},[p,h,o,d]),c.useEffect(()=>()=>{p&&(d.layers.delete(p),d.layersWithOutsidePointerEventsDisabled.delete(p),Zn())},[p,d]),c.useEffect(()=>{const S=()=>m({});return document.addEventListener(Oo,S),()=>document.removeEventListener(Oo,S)},[]),f.jsx(A.div,{...l,ref:x,style:{pointerEvents:b?_?"auto":"none":void 0,...e.style},onFocusCapture:C(e.onFocusCapture,E.onFocusCapture),onBlurCapture:C(e.onBlurCapture,E.onBlurCapture),onPointerDownCapture:C(e.onPointerDownCapture,M.onPointerDownCapture)})});He.displayName=gl;var wl="DismissableLayerBranch",_r=c.forwardRef((e,t)=>{const o=c.useContext(br),n=c.useRef(null),r=j(t,n);return c.useEffect(()=>{const a=n.current;if(a)return o.branches.add(a),()=>{o.branches.delete(a)}},[o.branches]),f.jsx(A.div,{...e,ref:r})});_r.displayName=wl;function bl(e,t=globalThis==null?void 0:globalThis.document){const o=X(e),n=c.useRef(!1),r=c.useRef(()=>{});return c.useEffect(()=>{const a=i=>{if(i.target&&!n.current){let l=function(){Mr(xl,o,d,{discrete:!0})};const d={originalEvent:i};i.pointerType==="touch"?(t.removeEventListener("click",r.current),r.current=l,t.addEventListener("click",r.current,{once:!0})):l()}else t.removeEventListener("click",r.current);n.current=!1},s=window.setTimeout(()=>{t.addEventListener("pointerdown",a)},0);return()=>{window.clearTimeout(s),t.removeEventListener("pointerdown",a),t.removeEventListener("click",r.current)}},[t,o]),{onPointerDownCapture:()=>n.current=!0}}function _l(e,t=globalThis==null?void 0:globalThis.document){const o=X(e),n=c.useRef(!1);return c.useEffect(()=>{const r=a=>{a.target&&!n.current&&Mr(kl,o,{originalEvent:a},{discrete:!1})};return t.addEventListener("focusin",r),()=>t.removeEventListener("focusin",r)},[t,o]),{onFocusCapture:()=>n.current=!0,onBlurCapture:()=>n.current=!1}}function Zn(){const e=new CustomEvent(Oo);document.dispatchEvent(e)}function Mr(e,t,o,{discrete:n}){const r=o.originalEvent.target,a=new CustomEvent(e,{bubbles:!1,cancelable:!0,detail:o});t&&r.addEventListener(e,t,{once:!0}),n?nn(r,a):r.dispatchEvent(a)}var Ml=He,Cl=_r,Z=globalThis!=null&&globalThis.document?c.useLayoutEffect:()=>{},Sl="Portal",Je=c.forwardRef((e,t)=>{var i;const{container:o,...n}=e,[r,a]=c.useState(!1);Z(()=>a(!0),[]);const s=o||r&&((i=globalThis==null?void 0:globalThis.document)==null?void 0:i.body);return s?tl.createPortal(f.jsx(A.div,{...n,ref:t}),s):null});Je.displayName=Sl;function El(e,t){return c.useReducer((o,n)=>t[o][n]??o,e)}var ee=e=>{const{present:t,children:o}=e,n=Rl(t),r=typeof o=="function"?o({present:n.isPresent}):c.Children.only(o),a=j(n.ref,Pl(r));return typeof o=="function"||n.isPresent?c.cloneElement(r,{ref:a}):null};ee.displayName="Presence";function Rl(e){const[t,o]=c.useState(),n=c.useRef(null),r=c.useRef(e),a=c.useRef("none"),s=e?"mounted":"unmounted",[i,l]=El(s,{mounted:{UNMOUNT:"unmounted",ANIMATION_OUT:"unmountSuspended"},unmountSuspended:{MOUNT:"mounted",ANIMATION_END:"unmounted"},unmounted:{MOUNT:"mounted"}});return c.useEffect(()=>{const d=Pt(n.current);a.current=i==="mounted"?d:"none"},[i]),Z(()=>{const d=n.current,p=r.current;if(p!==e){const h=a.current,m=Pt(d);e?l("MOUNT"):m==="none"||(d==null?void 0:d.display)==="none"?l("UNMOUNT"):l(p&&h!==m?"ANIMATION_OUT":"UNMOUNT"),r.current=e}},[e,l]),Z(()=>{if(t){let d;const p=t.ownerDocument.defaultView??window,u=m=>{const v=Pt(n.current).includes(CSS.escape(m.animationName));if(m.target===t&&v&&(l("ANIMATION_END"),!r.current)){const g=t.style.animationFillMode;t.style.animationFillMode="forwards",d=p.setTimeout(()=>{t.style.animationFillMode==="forwards"&&(t.style.animationFillMode=g)})}},h=m=>{m.target===t&&(a.current=Pt(n.current))};return t.addEventListener("animationstart",h),t.addEventListener("animationcancel",u),t.addEventListener("animationend",u),()=>{p.clearTimeout(d),t.removeEventListener("animationstart",h),t.removeEventListener("animationcancel",u),t.removeEventListener("animationend",u)}}else l("ANIMATION_END")},[t,l]),{isPresent:["mounted","unmountSuspended"].includes(i),ref:c.useCallback(d=>{n.current=d?getComputedStyle(d):null,o(d)},[])}}function Pt(e){return(e==null?void 0:e.animationName)||"none"}function Pl(e){var n,r;let t=(n=Object.getOwnPropertyDescriptor(e.props,"ref"))==null?void 0:n.get,o=t&&"isReactWarning"in t&&t.isReactWarning;return o?e.ref:(t=(r=Object.getOwnPropertyDescriptor(e,"ref"))==null?void 0:r.get,o=t&&"isReactWarning"in t&&t.isReactWarning,o?e.props.ref:e.props.ref||e.ref)}var Al=on[" useInsertionEffect ".trim().toString()]||Z;function oe({prop:e,defaultProp:t,onChange:o=()=>{},caller:n}){const[r,a,s]=Nl({defaultProp:t,onChange:o}),i=e!==void 0,l=i?e:r;{const p=c.useRef(e!==void 0);c.useEffect(()=>{const u=p.current;u!==i&&console.warn(`${n} is changing from ${u?"controlled":"uncontrolled"} to ${i?"controlled":"uncontrolled"}. Components should not switch from controlled to uncontrolled (or vice versa). Decide between using a controlled or uncontrolled value for the lifetime of the component.`),p.current=i},[i,n])}const d=c.useCallback(p=>{var u;if(i){const h=Tl(p)?p(e):p;h!==e&&((u=s.current)==null||u.call(s,h))}else a(p)},[i,e,a,s]);return[l,d]}function Nl({defaultProp:e,onChange:t}){const[o,n]=c.useState(e),r=c.useRef(o),a=c.useRef(t);return Al(()=>{a.current=t},[t]),c.useEffect(()=>{var s;r.current!==o&&((s=a.current)==null||s.call(a,o),r.current=o)},[o,r]),[o,n,a]}function Tl(e){return typeof e=="function"}var Cr=Object.freeze({position:"absolute",border:0,width:1,height:1,padding:0,margin:-1,overflow:"hidden",clip:"rect(0, 0, 0, 0)",whiteSpace:"nowrap",wordWrap:"normal"}),$l="VisuallyHidden",Yt=c.forwardRef((e,t)=>f.jsx(A.span,{...e,ref:t,style:{...Cr,...e.style}}));Yt.displayName=$l;var Il=Yt,rn="ToastProvider",[an,Dl,Ol]=Qe("Toast"),[Sr]=J("Toast",[Ol]),[jl,Xt]=Sr(rn),Er=e=>{const{__scopeToast:t,label:o="Notification",duration:n=5e3,swipeDirection:r="right",swipeThreshold:a=50,children:s}=e,[i,l]=c.useState(null),[d,p]=c.useState(0),u=c.useRef(!1),h=c.useRef(!1);return o.trim()||console.error(`Invalid prop \`label\` supplied to \`${rn}\`. Expected non-empty \`string\`.`),f.jsx(an.Provider,{scope:t,children:f.jsx(jl,{scope:t,label:o,duration:n,swipeDirection:r,swipeThreshold:a,toastCount:d,viewport:i,onViewportChange:l,onToastAdd:c.useCallback(()=>p(m=>m+1),[]),onToastRemove:c.useCallback(()=>p(m=>m-1),[]),isFocusedToastEscapeKeyDownRef:u,isClosePausedRef:h,children:s})})};Er.displayName=rn;var Rr="ToastViewport",Ll=["F8"],jo="toast.viewportPause",Lo="toast.viewportResume",Pr=c.forwardRef((e,t)=>{const{__scopeToast:o,hotkey:n=Ll,label:r="Notifications ({hotkey})",...a}=e,s=Xt(Rr,o),i=Dl(o),l=c.useRef(null),d=c.useRef(null),p=c.useRef(null),u=c.useRef(null),h=j(t,u,s.onViewportChange),m=n.join("+").replace(/Key/g,"").replace(/Digit/g,""),x=s.toastCount>0;c.useEffect(()=>{const g=k=>{var b;n.length!==0&&n.every(_=>k[_]||k.code===_)&&((b=u.current)==null||b.focus())};return document.addEventListener("keydown",g),()=>document.removeEventListener("keydown",g)},[n]),c.useEffect(()=>{const g=l.current,k=u.current;if(x&&g&&k){const w=()=>{if(!s.isClosePausedRef.current){const E=new CustomEvent(jo);k.dispatchEvent(E),s.isClosePausedRef.current=!0}},b=()=>{if(s.isClosePausedRef.current){const E=new CustomEvent(Lo);k.dispatchEvent(E),s.isClosePausedRef.current=!1}},_=E=>{!g.contains(E.relatedTarget)&&b()},M=()=>{g.contains(document.activeElement)||b()};return g.addEventListener("focusin",w),g.addEventListener("focusout",_),g.addEventListener("pointermove",w),g.addEventListener("pointerleave",M),window.addEventListener("blur",w),window.addEventListener("focus",b),()=>{g.removeEventListener("focusin",w),g.removeEventListener("focusout",_),g.removeEventListener("pointermove",w),g.removeEventListener("pointerleave",M),window.removeEventListener("blur",w),window.removeEventListener("focus",b)}}},[x,s.isClosePausedRef]);const v=c.useCallback(({tabbingDirection:g})=>{const w=i().map(b=>{const _=b.ref.current,M=[_,...Zl(_)];return g==="forwards"?M:M.reverse()});return(g==="forwards"?w.reverse():w).flat()},[i]);return c.useEffect(()=>{const g=u.current;if(g){const k=w=>{var M,E,S;const b=w.altKey||w.ctrlKey||w.metaKey;if(w.key==="Tab"&&!b){const N=document.activeElement,T=w.shiftKey;if(w.target===g&&T){(M=d.current)==null||M.focus();return}const F=v({tabbingDirection:T?"backwards":"forwards"}),V=F.findIndex(R=>R===N);Ro(F.slice(V+1))?w.preventDefault():T?(E=d.current)==null||E.focus():(S=p.current)==null||S.focus()}};return g.addEventListener("keydown",k),()=>g.removeEventListener("keydown",k)}},[i,v]),f.jsxs(Cl,{ref:l,role:"region","aria-label":r.replace("{hotkey}",m),tabIndex:-1,style:{pointerEvents:x?void 0:"none"},children:[x&&f.jsx(Fo,{ref:d,onFocusFromOutsideViewport:()=>{const g=v({tabbingDirection:"forwards"});Ro(g)}}),f.jsx(an.Slot,{scope:o,children:f.jsx(A.ol,{tabIndex:-1,...a,ref:h})}),x&&f.jsx(Fo,{ref:p,onFocusFromOutsideViewport:()=>{const g=v({tabbingDirection:"backwards"});Ro(g)}})]})});Pr.displayName=Rr;var Ar="ToastFocusProxy",Fo=c.forwardRef((e,t)=>{const{__scopeToast:o,onFocusFromOutsideViewport:n,...r}=e,a=Xt(Ar,o);return f.jsx(Yt,{tabIndex:0,...r,ref:t,style:{position:"fixed"},onFocus:s=>{var d;const i=s.relatedTarget;!((d=a.viewport)!=null&&d.contains(i))&&n()}})});Fo.displayName=Ar;var vt="Toast",Fl="toast.swipeStart",Vl="toast.swipeMove",zl="toast.swipeCancel",Hl="toast.swipeEnd",Nr=c.forwardRef((e,t)=>{const{forceMount:o,open:n,defaultOpen:r,onOpenChange:a,...s}=e,[i,l]=oe({prop:n,defaultProp:r??!0,onChange:a,caller:vt});return f.jsx(ee,{present:o||i,children:f.jsx(Wl,{open:i,...s,ref:t,onClose:()=>l(!1),onPause:X(e.onPause),onResume:X(e.onResume),onSwipeStart:C(e.onSwipeStart,d=>{d.currentTarget.setAttribute("data-swipe","start")}),onSwipeMove:C(e.onSwipeMove,d=>{const{x:p,y:u}=d.detail.delta;d.currentTarget.setAttribute("data-swipe","move"),d.currentTarget.style.setProperty("--radix-toast-swipe-move-x",`${p}px`),d.currentTarget.style.setProperty("--radix-toast-swipe-move-y",`${u}px`)}),onSwipeCancel:C(e.onSwipeCancel,d=>{d.currentTarget.setAttribute("data-swipe","cancel"),d.currentTarget.style.removeProperty("--radix-toast-swipe-move-x"),d.currentTarget.style.removeProperty("--radix-toast-swipe-move-y"),d.currentTarget.style.removeProperty("--radix-toast-swipe-end-x"),d.currentTarget.style.removeProperty("--radix-toast-swipe-end-y")}),onSwipeEnd:C(e.onSwipeEnd,d=>{const{x:p,y:u}=d.detail.delta;d.currentTarget.setAttribute("data-swipe","end"),d.currentTarget.style.removeProperty("--radix-toast-swipe-move-x"),d.currentTarget.style.removeProperty("--radix-toast-swipe-move-y"),d.currentTarget.style.setProperty("--radix-toast-swipe-end-x",`${p}px`),d.currentTarget.style.setProperty("--radix-toast-swipe-end-y",`${u}px`),l(!1)})})})});Nr.displayName=vt;var[Bl,ql]=Sr(vt,{onClose(){}}),Wl=c.forwardRef((e,t)=>{const{__scopeToast:o,type:n="foreground",duration:r,open:a,onClose:s,onEscapeKeyDown:i,onPause:l,onResume:d,onSwipeStart:p,onSwipeMove:u,onSwipeCancel:h,onSwipeEnd:m,...x}=e,v=Xt(vt,o),[g,k]=c.useState(null),w=j(t,R=>k(R)),b=c.useRef(null),_=c.useRef(null),M=r||v.duration,E=c.useRef(0),S=c.useRef(M),N=c.useRef(0),{onToastAdd:T,onToastRemove:I}=v,D=X(()=>{var H;(g==null?void 0:g.contains(document.activeElement))&&((H=v.viewport)==null||H.focus()),s()}),F=c.useCallback(R=>{!R||R===1/0||(window.clearTimeout(N.current),E.current=new Date().getTime(),N.current=window.setTimeout(D,R))},[D]);c.useEffect(()=>{const R=v.viewport;if(R){const H=()=>{F(S.current),d==null||d()},O=()=>{const z=new Date().getTime()-E.current;S.current=S.current-z,window.clearTimeout(N.current),l==null||l()};return R.addEventListener(jo,O),R.addEventListener(Lo,H),()=>{R.removeEventListener(jo,O),R.removeEventListener(Lo,H)}}},[v.viewport,M,l,d,F]),c.useEffect(()=>{a&&!v.isClosePausedRef.current&&F(M)},[a,M,v.isClosePausedRef,F]),c.useEffect(()=>(T(),()=>I()),[T,I]);const V=c.useMemo(()=>g?Lr(g):null,[g]);return v.viewport?f.jsxs(f.Fragment,{children:[V&&f.jsx(Ul,{__scopeToast:o,role:"status","aria-live":n==="foreground"?"assertive":"polite",children:V}),f.jsx(Bl,{scope:o,onClose:D,children:mt.createPortal(f.jsx(an.ItemSlot,{scope:o,children:f.jsx(Ml,{asChild:!0,onEscapeKeyDown:C(i,()=>{v.isFocusedToastEscapeKeyDownRef.current||D(),v.isFocusedToastEscapeKeyDownRef.current=!1}),children:f.jsx(A.li,{tabIndex:0,"data-state":a?"open":"closed","data-swipe-direction":v.swipeDirection,...x,ref:w,style:{userSelect:"none",touchAction:"none",...e.style},onKeyDown:C(e.onKeyDown,R=>{R.key==="Escape"&&(i==null||i(R.nativeEvent),R.nativeEvent.defaultPrevented||(v.isFocusedToastEscapeKeyDownRef.current=!0,D()))}),onPointerDown:C(e.onPointerDown,R=>{R.button===0&&(b.current={x:R.clientX,y:R.clientY})}),onPointerMove:C(e.onPointerMove,R=>{if(!b.current)return;const H=R.clientX-b.current.x,O=R.clientY-b.current.y,z=!!_.current,$=["left","right"].includes(v.swipeDirection),P=["left","up"].includes(v.swipeDirection)?Math.min:Math.max,B=$?P(0,H):0,Y=$?0:P(0,O),te=R.pointerType==="touch"?10:2,ae={x:B,y:Y},ne={originalEvent:R,delta:ae};z?(_.current=ae,At(Vl,u,ne,{discrete:!1})):Qn(ae,v.swipeDirection,te)?(_.current=ae,At(Fl,p,ne,{discrete:!1}),R.target.setPointerCapture(R.pointerId)):(Math.abs(H)>te||Math.abs(O)>te)&&(b.current=null)}),onPointerUp:C(e.onPointerUp,R=>{const H=_.current,O=R.target;if(O.hasPointerCapture(R.pointerId)&&O.releasePointerCapture(R.pointerId),_.current=null,b.current=null,H){const z=R.currentTarget,$={originalEvent:R,delta:H};Qn(H,v.swipeDirection,v.swipeThreshold)?At(Hl,m,$,{discrete:!0}):At(zl,h,$,{discrete:!0}),z.addEventListener("click",P=>P.preventDefault(),{once:!0})}})})})}),v.viewport)})]}):null}),Ul=e=>{const{__scopeToast:t,children:o,...n}=e,r=Xt(vt,t),[a,s]=c.useState(!1),[i,l]=c.useState(!1);return Yl(()=>s(!0)),c.useEffect(()=>{const d=window.setTimeout(()=>l(!0),1e3);return()=>window.clearTimeout(d)},[]),i?null:f.jsx(Je,{asChild:!0,children:f.jsx(Yt,{...n,children:a&&f.jsxs(f.Fragment,{children:[r.label," ",o]})})})},Kl="ToastTitle",Tr=c.forwardRef((e,t)=>{const{__scopeToast:o,...n}=e;return f.jsx(A.div,{...n,ref:t})});Tr.displayName=Kl;var Gl="ToastDescription",$r=c.forwardRef((e,t)=>{const{__scopeToast:o,...n}=e;return f.jsx(A.div,{...n,ref:t})});$r.displayName=Gl;var Ir="ToastAction",Dr=c.forwardRef((e,t)=>{const{altText:o,...n}=e;return o.trim()?f.jsx(jr,{altText:o,asChild:!0,children:f.jsx(sn,{...n,ref:t})}):(console.error(`Invalid prop \`altText\` supplied to \`${Ir}\`. Expected non-empty \`string\`.`),null)});Dr.displayName=Ir;var Or="ToastClose",sn=c.forwardRef((e,t)=>{const{__scopeToast:o,...n}=e,r=ql(Or,o);return f.jsx(jr,{asChild:!0,children:f.jsx(A.button,{type:"button",...n,ref:t,onClick:C(e.onClick,r.onClose)})})});sn.displayName=Or;var jr=c.forwardRef((e,t)=>{const{__scopeToast:o,altText:n,...r}=e;return f.jsx(A.div,{"data-radix-toast-announce-exclude":"","data-radix-toast-announce-alt":n||void 0,...r,ref:t})});function Lr(e){const t=[];return Array.from(e.childNodes).forEach(n=>{if(n.nodeType===n.TEXT_NODE&&n.textContent&&t.push(n.textContent),Xl(n)){const r=n.ariaHidden||n.hidden||n.style.display==="none",a=n.dataset.radixToastAnnounceExclude==="";if(!r)if(a){const s=n.dataset.radixToastAnnounceAlt;s&&t.push(s)}else t.push(...Lr(n))}}),t}function At(e,t,o,{discrete:n}){const r=o.originalEvent.currentTarget,a=new CustomEvent(e,{bubbles:!0,cancelable:!0,detail:o});t&&r.addEventListener(e,t,{once:!0}),n?nn(r,a):r.dispatchEvent(a)}var Qn=(e,t,o=0)=>{const n=Math.abs(e.x),r=Math.abs(e.y),a=n>r;return t==="left"||t==="right"?a&&n>o:!a&&r>o};function Yl(e=()=>{}){const t=X(e);Z(()=>{let o=0,n=0;return o=window.requestAnimationFrame(()=>n=window.requestAnimationFrame(t)),()=>{window.cancelAnimationFrame(o),window.cancelAnimationFrame(n)}},[t])}function Xl(e){return e.nodeType===e.ELEMENT_NODE}function Zl(e){const t=[],o=document.createTreeWalker(e,NodeFilter.SHOW_ELEMENT,{acceptNode:n=>{const r=n.tagName==="INPUT"&&n.type==="hidden";return n.disabled||n.hidden||r?NodeFilter.FILTER_SKIP:n.tabIndex>=0?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_SKIP}});for(;o.nextNode();)t.push(o.currentNode);return t}function Ro(e){const t=document.activeElement;return e.some(o=>o===t?!0:(o.focus(),document.activeElement!==t))}var rx=Er,ax=Pr,sx=Nr,cx=Tr,ix=$r,lx=Dr,dx=sn;/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Fr=(...e)=>e.filter((t,o,n)=>!!t&&t.trim()!==""&&n.indexOf(t)===o).join(" ").trim();/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ql=e=>e.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase();/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Jl=e=>e.replace(/^([A-Z])|[\s-_]+(\w)/g,(t,o,n)=>n?n.toUpperCase():o.toLowerCase());/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Jn=e=>{const t=Jl(e);return t.charAt(0).toUpperCase()+t.slice(1)};/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */var ed={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const td=e=>{for(const t in e)if(t.startsWith("aria-")||t==="role"||t==="title")return!0;return!1};/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const od=c.forwardRef(({color:e="currentColor",size:t=24,strokeWidth:o=2,absoluteStrokeWidth:n,className:r="",children:a,iconNode:s,...i},l)=>c.createElement("svg",{ref:l,...ed,width:t,height:t,stroke:e,strokeWidth:n?Number(o)*24/Number(t):o,className:Fr("lucide",r),...!a&&!td(i)&&{"aria-hidden":"true"},...i},[...s.map(([d,p])=>c.createElement(d,p)),...Array.isArray(a)?a:[a]]));/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y=(e,t)=>{const o=c.forwardRef(({className:n,...r},a)=>c.createElement(od,{ref:a,iconNode:t,className:Fr(`lucide-${Ql(Jn(e))}`,`lucide-${e}`,n),...r}));return o.displayName=Jn(e),o};/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const nd=[["circle",{cx:"16",cy:"4",r:"1",key:"1grugj"}],["path",{d:"m18 19 1-7-6 1",key:"r0i19z"}],["path",{d:"m5 8 3-3 5.5 3-2.36 3.5",key:"9ptxx2"}],["path",{d:"M4.24 14.5a5 5 0 0 0 6.88 6",key:"10kmtu"}],["path",{d:"M13.76 17.5a5 5 0 0 0-6.88-6",key:"2qq6rc"}]],ux=y("accessibility",nd);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const rd=[["path",{d:"M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2",key:"169zse"}]],px=y("activity",rd);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ad=[["path",{d:"M12 6.528V3a1 1 0 0 1 1-1h0",key:"11qiee"}],["path",{d:"M18.237 21A15 15 0 0 0 22 11a6 6 0 0 0-10-4.472A6 6 0 0 0 2 11a15.1 15.1 0 0 0 3.763 10 3 3 0 0 0 3.648.648 5.5 5.5 0 0 1 5.178 0A3 3 0 0 0 18.237 21",key:"110c12"}]],fx=y("apple",ad);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const sd=[["rect",{width:"20",height:"5",x:"2",y:"3",rx:"1",key:"1wp1u1"}],["path",{d:"M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8",key:"1s80jp"}],["path",{d:"M10 12h4",key:"a56b0p"}]],hx=y("archive",sd);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const cd=[["path",{d:"M17 7 7 17",key:"15tmo1"}],["path",{d:"M17 17H7V7",key:"1org7z"}]],yx=y("arrow-down-left",cd);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const id=[["path",{d:"m7 7 10 10",key:"1fmybs"}],["path",{d:"M17 7v10H7",key:"6fjiku"}]],mx=y("arrow-down-right",id);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ld=[["path",{d:"M12 5v14",key:"s699le"}],["path",{d:"m19 12-7 7-7-7",key:"1idqje"}]],vx=y("arrow-down",ld);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const dd=[["path",{d:"m12 19-7-7 7-7",key:"1l729n"}],["path",{d:"M19 12H5",key:"x3x0zl"}]],gx=y("arrow-left",dd);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ud=[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"m12 5 7 7-7 7",key:"xquz4c"}]],xx=y("arrow-right",ud);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const pd=[["path",{d:"m21 16-4 4-4-4",key:"f6ql7i"}],["path",{d:"M17 20V4",key:"1ejh1v"}],["path",{d:"m3 8 4-4 4 4",key:"11wl7u"}],["path",{d:"M7 4v16",key:"1glfcx"}]],kx=y("arrow-up-down",pd);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const fd=[["path",{d:"M7 7h10v10",key:"1tivn9"}],["path",{d:"M7 17 17 7",key:"1vkiza"}]],wx=y("arrow-up-right",fd);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const hd=[["path",{d:"m5 12 7-7 7 7",key:"hav0vg"}],["path",{d:"M12 19V5",key:"x0mq9r"}]],bx=y("arrow-up",hd);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const yd=[["path",{d:"m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526",key:"1yiouv"}],["circle",{cx:"12",cy:"8",r:"6",key:"1vp47v"}]],_x=y("award",yd);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const md=[["path",{d:"M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z",key:"3c2336"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]],Mx=y("badge-check",md);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const vd=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M4.929 4.929 19.07 19.071",key:"196cmz"}]],Cx=y("ban",vd);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const gd=[["rect",{width:"20",height:"12",x:"2",y:"6",rx:"2",key:"9lu3g6"}],["circle",{cx:"12",cy:"12",r:"2",key:"1c9p78"}],["path",{d:"M6 12h.01M18 12h.01",key:"113zkx"}]],Sx=y("banknote",gd);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const xd=[["path",{d:"M10.268 21a2 2 0 0 0 3.464 0",key:"vwvbt9"}],["path",{d:"M11.68 2.009A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673c-.824-.85-1.678-1.731-2.21-3.348",key:"xaq59h"}],["circle",{cx:"18",cy:"5",r:"3",key:"gq8acd"}]],Ex=y("bell-dot",xd);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const kd=[["path",{d:"M10.268 21a2 2 0 0 0 3.464 0",key:"vwvbt9"}],["path",{d:"M17 17H4a1 1 0 0 1-.74-1.673C4.59 13.956 6 12.499 6 8a6 6 0 0 1 .258-1.742",key:"178tsu"}],["path",{d:"m2 2 20 20",key:"1ooewy"}],["path",{d:"M8.668 3.01A6 6 0 0 1 18 8c0 2.687.77 4.653 1.707 6.05",key:"1hqiys"}]],Rx=y("bell-off",kd);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const wd=[["path",{d:"M10.268 21a2 2 0 0 0 3.464 0",key:"vwvbt9"}],["path",{d:"M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326",key:"11g9vi"}]],Px=y("bell",wd);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const bd=[["path",{d:"M16 7h.01",key:"1kdx03"}],["path",{d:"M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20",key:"oj1oa8"}],["path",{d:"m20 7 2 .5-2 .5",key:"12nv4d"}],["path",{d:"M10 18v3",key:"1yea0a"}],["path",{d:"M14 17.75V21",key:"1pymcb"}],["path",{d:"M7 18a6 6 0 0 0 3.84-10.61",key:"1npnn0"}]],Ax=y("bird",bd);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _d=[["path",{d:"M12 7v14",key:"1akyts"}],["path",{d:"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",key:"ruj8y"}]],Nx=y("book-open",_d);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Md=[["path",{d:"M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20",key:"k3hazp"}]],Tx=y("book",Md);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Cd=[["path",{d:"M12 8V4H8",key:"hb8ula"}],["rect",{width:"16",height:"12",x:"4",y:"8",rx:"2",key:"enze0r"}],["path",{d:"M2 14h2",key:"vft8re"}],["path",{d:"M20 14h2",key:"4cs60a"}],["path",{d:"M15 13v2",key:"1xurst"}],["path",{d:"M9 13v2",key:"rq6x2g"}]],$x=y("bot",Cd);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Sd=[["path",{d:"M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z",key:"hh9hay"}],["path",{d:"m3.3 7 8.7 5 8.7-5",key:"g66t2b"}],["path",{d:"M12 22V12",key:"d0xqtd"}]],Ix=y("box",Sd);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ed=[["path",{d:"M12 18V5",key:"adv99a"}],["path",{d:"M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4",key:"1e3is1"}],["path",{d:"M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5",key:"1gqd8o"}],["path",{d:"M17.997 5.125a4 4 0 0 1 2.526 5.77",key:"iwvgf7"}],["path",{d:"M18 18a4 4 0 0 0 2-7.464",key:"efp6ie"}],["path",{d:"M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517",key:"1gq6am"}],["path",{d:"M6 18a4 4 0 0 1-2-7.464",key:"k1g0md"}],["path",{d:"M6.003 5.125a4 4 0 0 0-2.526 5.77",key:"q97ue3"}]],Dx=y("brain",Ed);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Rd=[["path",{d:"M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16",key:"jecpp"}],["rect",{width:"20",height:"14",x:"2",y:"6",rx:"2",key:"i6l2r4"}]],Ox=y("briefcase",Rd);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Pd=[["path",{d:"M12 20v-9",key:"1qisl0"}],["path",{d:"M14 7a4 4 0 0 1 4 4v3a6 6 0 0 1-12 0v-3a4 4 0 0 1 4-4z",key:"uouzyp"}],["path",{d:"M14.12 3.88 16 2",key:"qol33r"}],["path",{d:"M21 21a4 4 0 0 0-3.81-4",key:"1b0z45"}],["path",{d:"M21 5a4 4 0 0 1-3.55 3.97",key:"5cxbf6"}],["path",{d:"M22 13h-4",key:"1jl80f"}],["path",{d:"M3 21a4 4 0 0 1 3.81-4",key:"1fjd4g"}],["path",{d:"M3 5a4 4 0 0 0 3.55 3.97",key:"1d7oge"}],["path",{d:"M6 13H2",key:"82j7cp"}],["path",{d:"m8 2 1.88 1.88",key:"fmnt4t"}],["path",{d:"M9 7.13V6a3 3 0 1 1 6 0v1.13",key:"1vgav8"}]],jx=y("bug",Pd);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ad=[["path",{d:"M10 12h4",key:"a56b0p"}],["path",{d:"M10 8h4",key:"1sr2af"}],["path",{d:"M14 21v-3a2 2 0 0 0-4 0v3",key:"1rgiei"}],["path",{d:"M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2",key:"secmi2"}],["path",{d:"M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16",key:"16ra0t"}]],Lx=y("building-2",Ad);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Nd=[["path",{d:"M12 10h.01",key:"1nrarc"}],["path",{d:"M12 14h.01",key:"1etili"}],["path",{d:"M12 6h.01",key:"1vi96p"}],["path",{d:"M16 10h.01",key:"1m94wz"}],["path",{d:"M16 14h.01",key:"1gbofw"}],["path",{d:"M16 6h.01",key:"1x0f13"}],["path",{d:"M8 10h.01",key:"19clt8"}],["path",{d:"M8 14h.01",key:"6423bh"}],["path",{d:"M8 6h.01",key:"1dz90k"}],["path",{d:"M9 22v-3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3",key:"cabbwy"}],["rect",{x:"4",y:"2",width:"16",height:"20",rx:"2",key:"1uxh74"}]],Fx=y("building",Nd);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Td=[["path",{d:"M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8",key:"1w3rig"}],["path",{d:"M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1",key:"n2jgmb"}],["path",{d:"M2 21h20",key:"1nyx9w"}],["path",{d:"M7 8v3",key:"1qtyvj"}],["path",{d:"M12 8v3",key:"hwp4zt"}],["path",{d:"M17 8v3",key:"1i6e5u"}],["path",{d:"M7 4h.01",key:"1bh4kh"}],["path",{d:"M12 4h.01",key:"1ujb9j"}],["path",{d:"M17 4h.01",key:"1upcoc"}]],Vx=y("cake",Td);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $d=[["rect",{width:"16",height:"20",x:"4",y:"2",rx:"2",key:"1nb95v"}],["line",{x1:"8",x2:"16",y1:"6",y2:"6",key:"x4nwl0"}],["line",{x1:"16",x2:"16",y1:"14",y2:"18",key:"wjye3r"}],["path",{d:"M16 10h.01",key:"1m94wz"}],["path",{d:"M12 10h.01",key:"1nrarc"}],["path",{d:"M8 10h.01",key:"19clt8"}],["path",{d:"M12 14h.01",key:"1etili"}],["path",{d:"M8 14h.01",key:"6423bh"}],["path",{d:"M12 18h.01",key:"mhygvu"}],["path",{d:"M8 18h.01",key:"lrp35t"}]],zx=y("calculator",$d);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Id=[["path",{d:"M8 2v4",key:"1cmpym"}],["path",{d:"M16 2v4",key:"4m81vk"}],["rect",{width:"18",height:"18",x:"3",y:"4",rx:"2",key:"1hopcy"}],["path",{d:"M3 10h18",key:"8toen8"}],["path",{d:"m9 16 2 2 4-4",key:"19s6y9"}]],Hx=y("calendar-check",Id);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Dd=[["path",{d:"M16 14v2.2l1.6 1",key:"fo4ql5"}],["path",{d:"M16 2v4",key:"4m81vk"}],["path",{d:"M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5",key:"1osxxc"}],["path",{d:"M3 10h5",key:"r794hk"}],["path",{d:"M8 2v4",key:"1cmpym"}],["circle",{cx:"16",cy:"16",r:"6",key:"qoo3c4"}]],Bx=y("calendar-clock",Dd);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Od=[["path",{d:"M8 2v4",key:"1cmpym"}],["path",{d:"M16 2v4",key:"4m81vk"}],["rect",{width:"18",height:"18",x:"3",y:"4",rx:"2",key:"1hopcy"}],["path",{d:"M3 10h18",key:"8toen8"}],["path",{d:"M8 14h.01",key:"6423bh"}],["path",{d:"M12 14h.01",key:"1etili"}],["path",{d:"M16 14h.01",key:"1gbofw"}],["path",{d:"M8 18h.01",key:"lrp35t"}],["path",{d:"M12 18h.01",key:"mhygvu"}],["path",{d:"M16 18h.01",key:"kzsmim"}]],qx=y("calendar-days",Od);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const jd=[["path",{d:"M4.2 4.2A2 2 0 0 0 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 1.82-1.18",key:"16swn3"}],["path",{d:"M21 15.5V6a2 2 0 0 0-2-2H9.5",key:"yhw86o"}],["path",{d:"M16 2v4",key:"4m81vk"}],["path",{d:"M3 10h7",key:"1wap6i"}],["path",{d:"M21 10h-5.5",key:"quycpq"}],["path",{d:"m2 2 20 20",key:"1ooewy"}]],Wx=y("calendar-off",jd);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ld=[["path",{d:"M16 19h6",key:"xwg31i"}],["path",{d:"M16 2v4",key:"4m81vk"}],["path",{d:"M19 16v6",key:"tddt3s"}],["path",{d:"M21 12.598V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8.5",key:"1glfrc"}],["path",{d:"M3 10h18",key:"8toen8"}],["path",{d:"M8 2v4",key:"1cmpym"}]],Ux=y("calendar-plus",Ld);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Fd=[["rect",{width:"18",height:"18",x:"3",y:"4",rx:"2",key:"1hopcy"}],["path",{d:"M16 2v4",key:"4m81vk"}],["path",{d:"M3 10h18",key:"8toen8"}],["path",{d:"M8 2v4",key:"1cmpym"}],["path",{d:"M17 14h-6",key:"bkmgh3"}],["path",{d:"M13 18H7",key:"bb0bb7"}],["path",{d:"M7 14h.01",key:"1qa3f1"}],["path",{d:"M17 18h.01",key:"1bdyru"}]],Kx=y("calendar-range",Fd);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Vd=[["path",{d:"M8 2v4",key:"1cmpym"}],["path",{d:"M16 2v4",key:"4m81vk"}],["rect",{width:"18",height:"18",x:"3",y:"4",rx:"2",key:"1hopcy"}],["path",{d:"M3 10h18",key:"8toen8"}]],Gx=y("calendar",Vd);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const zd=[["path",{d:"M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z",key:"18u6gg"}],["circle",{cx:"12",cy:"13",r:"3",key:"1vg3eu"}]],Yx=y("camera",zd);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Hd=[["path",{d:"M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2",key:"5owen"}],["circle",{cx:"7",cy:"17",r:"2",key:"u2ysq9"}],["path",{d:"M9 17h6",key:"r8uit2"}],["circle",{cx:"17",cy:"17",r:"2",key:"axvx0g"}]],Xx=y("car",Hd);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Bd=[["path",{d:"M12 5c.67 0 1.35.09 2 .26 1.78-2 5.03-2.84 6.42-2.26 1.4.58-.42 7-.42 7 .57 1.07 1 2.24 1 3.44C21 17.9 16.97 21 12 21s-9-3-9-7.56c0-1.25.5-2.4 1-3.44 0 0-1.89-6.42-.5-7 1.39-.58 4.72.23 6.5 2.23A9.04 9.04 0 0 1 12 5Z",key:"x6xyqk"}],["path",{d:"M8 14v.5",key:"1nzgdb"}],["path",{d:"M16 14v.5",key:"1lajdz"}],["path",{d:"M11.25 16.25h1.5L12 17l-.75-.75Z",key:"12kq1m"}]],Zx=y("cat",Bd);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const qd=[["path",{d:"M3 3v16a2 2 0 0 0 2 2h16",key:"c24i48"}],["path",{d:"M18 17V9",key:"2bz60n"}],["path",{d:"M13 17V5",key:"1frdt8"}],["path",{d:"M8 17v-3",key:"17ska0"}]],Qx=y("chart-column",qd);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Wd=[["path",{d:"M5 21v-6",key:"1hz6c0"}],["path",{d:"M12 21V9",key:"uvy0l4"}],["path",{d:"M19 21V3",key:"11j9sm"}]],Jx=y("chart-no-axes-column-increasing",Wd);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ud=[["path",{d:"M5 21v-6",key:"1hz6c0"}],["path",{d:"M12 21V3",key:"1lcnhd"}],["path",{d:"M19 21V9",key:"unv183"}]],e4=y("chart-no-axes-column",Ud);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Kd=[["path",{d:"M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z",key:"pzmjnu"}],["path",{d:"M21.21 15.89A10 10 0 1 1 8 2.83",key:"k2fpak"}]],t4=y("chart-pie",Kd);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Gd=[["path",{d:"M18 6 7 17l-5-5",key:"116fxf"}],["path",{d:"m22 10-7.5 7.5L13 16",key:"ke71qq"}]],o4=y("check-check",Gd);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Yd=[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]],n4=y("check",Yd);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Xd=[["path",{d:"m6 9 6 6 6-6",key:"qrunsl"}]],r4=y("chevron-down",Xd);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Zd=[["path",{d:"m15 18-6-6 6-6",key:"1wnfg3"}]],a4=y("chevron-left",Zd);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Qd=[["path",{d:"m9 18 6-6-6-6",key:"mthhwq"}]],s4=y("chevron-right",Qd);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Jd=[["path",{d:"m18 15-6-6-6 6",key:"153udz"}]],c4=y("chevron-up",Jd);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const e1=[["path",{d:"m7 15 5 5 5-5",key:"1hf1tw"}],["path",{d:"m7 9 5-5 5 5",key:"sgt6xg"}]],i4=y("chevrons-up-down",e1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const t1=[["path",{d:"M10.88 21.94 15.46 14",key:"xkve6t"}],["path",{d:"M21.17 8H12",key:"19dcdn"}],["path",{d:"M3.95 6.06 8.54 14",key:"g8jz9m"}],["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["circle",{cx:"12",cy:"12",r:"4",key:"4exip2"}]],l4=y("chromium",t1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const o1=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["line",{x1:"12",x2:"12",y1:"8",y2:"12",key:"1pkeuh"}],["line",{x1:"12",x2:"12.01",y1:"16",y2:"16",key:"4dfq90"}]],d4=y("circle-alert",o1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const n1=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m16 12-4-4-4 4",key:"177agl"}],["path",{d:"M12 16V8",key:"1sbj14"}]],u4=y("circle-arrow-up",n1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const r1=[["path",{d:"M21.801 10A10 10 0 1 1 17 3.335",key:"yps3ct"}],["path",{d:"m9 11 3 3L22 4",key:"1pflzl"}]],p4=y("circle-check-big",r1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const a1=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]],f4=y("circle-check",a1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const s1=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["circle",{cx:"12",cy:"12",r:"1",key:"41hilf"}]],h4=y("circle-dot",s1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const c1=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["line",{x1:"10",x2:"10",y1:"15",y2:"9",key:"c1nkhi"}],["line",{x1:"14",x2:"14",y1:"15",y2:"9",key:"h65svq"}]],y4=y("circle-pause",c1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const i1=[["path",{d:"M9 9.003a1 1 0 0 1 1.517-.859l4.997 2.997a1 1 0 0 1 0 1.718l-4.997 2.997A1 1 0 0 1 9 14.996z",key:"kmsa83"}],["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}]],m4=y("circle-play",i1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const l1=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M8 12h8",key:"1wcyev"}],["path",{d:"M12 8v8",key:"napkw2"}]],v4=y("circle-plus",l1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const d1=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3",key:"1u773s"}],["path",{d:"M12 17h.01",key:"p32p05"}]],g4=y("circle-question-mark",d1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u1=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["rect",{x:"9",y:"9",width:"6",height:"6",rx:"1",key:"1ssd4o"}]],x4=y("circle-stop",u1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const p1=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["circle",{cx:"12",cy:"10",r:"3",key:"ilqhr7"}],["path",{d:"M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662",key:"154egf"}]],k4=y("circle-user",p1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const f1=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m15 9-6 6",key:"1uzhvr"}],["path",{d:"m9 9 6 6",key:"z0biqf"}]],w4=y("circle-x",f1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const h1=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}]],b4=y("circle",h1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y1=[["rect",{width:"8",height:"4",x:"8",y:"2",rx:"1",ry:"1",key:"tgr4d6"}],["path",{d:"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",key:"116196"}],["path",{d:"m9 14 2 2 4-4",key:"df797q"}]],_4=y("clipboard-check",y1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const m1=[["rect",{width:"8",height:"4",x:"8",y:"2",rx:"1",ry:"1",key:"tgr4d6"}],["path",{d:"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",key:"116196"}],["path",{d:"M12 11h4",key:"1jrz19"}],["path",{d:"M12 16h4",key:"n85exb"}],["path",{d:"M8 11h.01",key:"1dfujw"}],["path",{d:"M8 16h.01",key:"18s6g9"}]],M4=y("clipboard-list",m1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const v1=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 6v6l4 2",key:"mmk7yg"}]],C4=y("clock",v1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const g1=[["path",{d:"M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242",key:"1pljnt"}],["path",{d:"M16 14v6",key:"1j4efv"}],["path",{d:"M8 14v6",key:"17c4r9"}],["path",{d:"M12 16v6",key:"c8a4gj"}]],S4=y("cloud-rain",g1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const x1=[["path",{d:"M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242",key:"1pljnt"}],["path",{d:"M8 15h.01",key:"a7atzg"}],["path",{d:"M8 19h.01",key:"puxtts"}],["path",{d:"M12 17h.01",key:"p32p05"}],["path",{d:"M12 21h.01",key:"h35vbk"}],["path",{d:"M16 15h.01",key:"rnfrdf"}],["path",{d:"M16 19h.01",key:"1vcnzz"}]],E4=y("cloud-snow",x1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const k1=[["path",{d:"M12 2v2",key:"tus03m"}],["path",{d:"m4.93 4.93 1.41 1.41",key:"149t6j"}],["path",{d:"M20 12h2",key:"1q8mjw"}],["path",{d:"m19.07 4.93-1.41 1.41",key:"1shlcs"}],["path",{d:"M15.947 12.65a4 4 0 0 0-5.925-4.128",key:"dpwdj0"}],["path",{d:"M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z",key:"s09mg5"}]],R4=y("cloud-sun",k1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const w1=[["path",{d:"M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z",key:"p7xjir"}]],P4=y("cloud",w1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const b1=[["path",{d:"m18 16 4-4-4-4",key:"1inbqp"}],["path",{d:"m6 8-4 4 4 4",key:"15zrgr"}],["path",{d:"m14.5 4-5 16",key:"e7oirm"}]],A4=y("code-xml",b1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _1=[["path",{d:"m16 18 6-6-6-6",key:"eg8j8"}],["path",{d:"m8 6-6 6 6 6",key:"ppft3o"}]],N4=y("code",_1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const M1=[["path",{d:"M10 2v2",key:"7u0qdc"}],["path",{d:"M14 2v2",key:"6buw04"}],["path",{d:"M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1",key:"pwadti"}],["path",{d:"M6 2v2",key:"colzsn"}]],T4=y("coffee",M1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const C1=[["path",{d:"M11 10.27 7 3.34",key:"16pf9h"}],["path",{d:"m11 13.73-4 6.93",key:"794ttg"}],["path",{d:"M12 22v-2",key:"1osdcq"}],["path",{d:"M12 2v2",key:"tus03m"}],["path",{d:"M14 12h8",key:"4f43i9"}],["path",{d:"m17 20.66-1-1.73",key:"eq3orb"}],["path",{d:"m17 3.34-1 1.73",key:"2wel8s"}],["path",{d:"M2 12h2",key:"1t8f8n"}],["path",{d:"m20.66 17-1.73-1",key:"sg0v6f"}],["path",{d:"m20.66 7-1.73 1",key:"1ow05n"}],["path",{d:"m3.34 17 1.73-1",key:"nuk764"}],["path",{d:"m3.34 7 1.73 1",key:"1ulond"}],["circle",{cx:"12",cy:"12",r:"2",key:"1c9p78"}],["circle",{cx:"12",cy:"12",r:"8",key:"46899m"}]],$4=y("cog",C1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const S1=[["path",{d:"M13.744 17.736a6 6 0 1 1-7.48-7.48",key:"bq4yh3"}],["path",{d:"M15 6h1v4",key:"11y1tn"}],["path",{d:"m6.134 14.768.866-.5 2 3.464",key:"17snzx"}],["circle",{cx:"16",cy:"8",r:"6",key:"14bfc9"}]],I4=y("coins",S1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const E1=[["rect",{x:"2",y:"6",width:"20",height:"8",rx:"1",key:"1estib"}],["path",{d:"M17 14v7",key:"7m2elx"}],["path",{d:"M7 14v7",key:"1cm7wv"}],["path",{d:"M17 3v3",key:"1v4jwn"}],["path",{d:"M7 3v3",key:"7o6guu"}],["path",{d:"M10 14 2.3 6.3",key:"1023jk"}],["path",{d:"m14 6 7.7 7.7",key:"1s8pl2"}],["path",{d:"m8 6 8 8",key:"hl96qh"}]],D4=y("construction",E1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const R1=[["path",{d:"M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5",key:"laymnq"}],["path",{d:"M8.5 8.5v.01",key:"ue8clq"}],["path",{d:"M16 15.5v.01",key:"14dtrp"}],["path",{d:"M12 12v.01",key:"u5ubse"}],["path",{d:"M11 17v.01",key:"1hyl5a"}],["path",{d:"M7 14v.01",key:"uct60s"}]],O4=y("cookie",R1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const P1=[["rect",{width:"14",height:"14",x:"8",y:"8",rx:"2",ry:"2",key:"17jyea"}],["path",{d:"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",key:"zix9uf"}]],j4=y("copy",P1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const A1=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M14.83 14.83a4 4 0 1 1 0-5.66",key:"1i56pz"}]],L4=y("copyright",A1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const N1=[["path",{d:"M12 20v2",key:"1lh1kg"}],["path",{d:"M12 2v2",key:"tus03m"}],["path",{d:"M17 20v2",key:"1rnc9c"}],["path",{d:"M17 2v2",key:"11trls"}],["path",{d:"M2 12h2",key:"1t8f8n"}],["path",{d:"M2 17h2",key:"7oei6x"}],["path",{d:"M2 7h2",key:"asdhe0"}],["path",{d:"M20 12h2",key:"1q8mjw"}],["path",{d:"M20 17h2",key:"1fpfkl"}],["path",{d:"M20 7h2",key:"1o8tra"}],["path",{d:"M7 20v2",key:"4gnj0m"}],["path",{d:"M7 2v2",key:"1i4yhu"}],["rect",{x:"4",y:"4",width:"16",height:"16",rx:"2",key:"1vbyd7"}],["rect",{x:"8",y:"8",width:"8",height:"8",rx:"1",key:"z9xiuo"}]],F4=y("cpu",N1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const T1=[["rect",{width:"20",height:"14",x:"2",y:"5",rx:"2",key:"ynyp8z"}],["line",{x1:"2",x2:"22",y1:"10",y2:"10",key:"1b3vmo"}]],V4=y("credit-card",T1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $1=[["path",{d:"M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z",key:"1vdc57"}],["path",{d:"M5 21h14",key:"11awu3"}]],z4=y("crown",$1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const I1=[["ellipse",{cx:"12",cy:"5",rx:"9",ry:"3",key:"msslwz"}],["path",{d:"M3 5V19A9 3 0 0 0 21 19V5",key:"1wlel7"}],["path",{d:"M3 12A9 3 0 0 0 21 12",key:"mv7ke4"}]],H4=y("database",I1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const D1=[["path",{d:"M10 5a2 2 0 0 0-1.344.519l-6.328 5.74a1 1 0 0 0 0 1.481l6.328 5.741A2 2 0 0 0 10 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z",key:"1yo7s0"}],["path",{d:"m12 9 6 6",key:"anjzzh"}],["path",{d:"m18 9-6 6",key:"1fp51s"}]],B4=y("delete",D1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const O1=[["path",{d:"M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0Z",key:"1f1r0c"}]],q4=y("diamond",O1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const j1=[["path",{d:"M11.25 16.25h1.5L12 17z",key:"w7jh35"}],["path",{d:"M16 14v.5",key:"1lajdz"}],["path",{d:"M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444a11.702 11.702 0 0 0-.493-3.309",key:"u7s9ue"}],["path",{d:"M8 14v.5",key:"1nzgdb"}],["path",{d:"M8.5 8.5c-.384 1.05-1.083 2.028-2.344 2.5-1.931.722-3.576-.297-3.656-1-.113-.994 1.177-6.53 4-7 1.923-.321 3.651.845 3.651 2.235A7.497 7.497 0 0 1 14 5.277c0-1.39 1.844-2.598 3.767-2.277 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5",key:"v8hric"}]],W4=y("dog",j1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const L1=[["line",{x1:"12",x2:"12",y1:"2",y2:"22",key:"7eqyqh"}],["path",{d:"M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",key:"1b0p4s"}]],U4=y("dollar-sign",L1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const F1=[["path",{d:"M12 15V3",key:"m9g1x1"}],["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}],["path",{d:"m7 10 5 5 5-5",key:"brsn70"}]],K4=y("download",F1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const V1=[["path",{d:"M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z",key:"c7niix"}]],G4=y("droplet",V1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const z1=[["path",{d:"M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z",key:"1ptgy4"}],["path",{d:"M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97",key:"1sl1rz"}]],Y4=y("droplets",z1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const H1=[["circle",{cx:"12",cy:"12",r:"1",key:"41hilf"}],["circle",{cx:"12",cy:"5",r:"1",key:"gxeob9"}],["circle",{cx:"12",cy:"19",r:"1",key:"lyex9k"}]],X4=y("ellipsis-vertical",H1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const B1=[["circle",{cx:"12",cy:"12",r:"1",key:"41hilf"}],["circle",{cx:"19",cy:"12",r:"1",key:"1wjl8i"}],["circle",{cx:"5",cy:"12",r:"1",key:"1pcz8c"}]],Z4=y("ellipsis",B1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const q1=[["path",{d:"M15 3h6v6",key:"1q9fwt"}],["path",{d:"M10 14 21 3",key:"gplh6r"}],["path",{d:"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",key:"a6xqqp"}]],Q4=y("external-link",q1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const W1=[["path",{d:"M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49",key:"ct8e1f"}],["path",{d:"M14.084 14.158a3 3 0 0 1-4.242-4.242",key:"151rxh"}],["path",{d:"M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143",key:"13bj9a"}],["path",{d:"m2 2 20 20",key:"1ooewy"}]],J4=y("eye-off",W1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const U1=[["path",{d:"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0",key:"1nclc0"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]],ek=y("eye",U1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const K1=[["path",{d:"M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z",key:"1jg4f8"}]],tk=y("facebook",K1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const G1=[["path",{d:"M12 16h.01",key:"1drbdi"}],["path",{d:"M16 16h.01",key:"1f9h7w"}],["path",{d:"M3 19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5a.5.5 0 0 0-.769-.422l-4.462 2.844A.5.5 0 0 1 15 10.5v-2a.5.5 0 0 0-.769-.422L9.77 10.922A.5.5 0 0 1 9 10.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z",key:"1iv0i2"}],["path",{d:"M8 16h.01",key:"18s6g9"}]],ok=y("factory",G1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Y1=[["path",{d:"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",key:"1oefj6"}],["path",{d:"M14 2v5a1 1 0 0 0 1 1h5",key:"wfsgrz"}],["path",{d:"M8 18v-2",key:"qcmpov"}],["path",{d:"M12 18v-4",key:"q1q25u"}],["path",{d:"M16 18v-6",key:"15y0np"}]],nk=y("file-chart-column-increasing",Y1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const X1=[["path",{d:"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",key:"1oefj6"}],["path",{d:"M14 2v5a1 1 0 0 0 1 1h5",key:"wfsgrz"}],["path",{d:"m9 15 2 2 4-4",key:"1grp1n"}]],rk=y("file-check",X1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Z1=[["path",{d:"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",key:"1oefj6"}],["path",{d:"M14 2v5a1 1 0 0 0 1 1h5",key:"wfsgrz"}],["path",{d:"M10 12.5 8 15l2 2.5",key:"1tg20x"}],["path",{d:"m14 12.5 2 2.5-2 2.5",key:"yinavb"}]],ak=y("file-code",Z1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Q1=[["path",{d:"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",key:"1oefj6"}],["path",{d:"M14 2v5a1 1 0 0 0 1 1h5",key:"wfsgrz"}],["path",{d:"M12 18v-6",key:"17g6i2"}],["path",{d:"m9 15 3 3 3-3",key:"1npd3o"}]],sk=y("file-down",Q1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const J1=[["path",{d:"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",key:"1oefj6"}],["path",{d:"M12 9v4",key:"juzpu7"}],["path",{d:"M12 17h.01",key:"p32p05"}]],ck=y("file-exclamation-point",J1);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const eu=[["path",{d:"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",key:"1oefj6"}],["path",{d:"M14 2v5a1 1 0 0 0 1 1h5",key:"wfsgrz"}],["circle",{cx:"10",cy:"12",r:"2",key:"737tya"}],["path",{d:"m20 17-1.296-1.296a2.41 2.41 0 0 0-3.408 0L9 22",key:"wt3hpn"}]],ik=y("file-image",eu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const tu=[["path",{d:"M14.364 13.634a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506l4.013-4.009a1 1 0 0 0-3.004-3.004z",key:"ukzhwg"}],["path",{d:"M14.487 7.858A1 1 0 0 1 14 7V2",key:"1klhew"}],["path",{d:"M20 19.645V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l2.516 2.516",key:"rxaxab"}],["path",{d:"M8 18h1",key:"13wk12"}]],lk=y("file-pen-line",tu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ou=[["path",{d:"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",key:"1oefj6"}],["path",{d:"M14 2v5a1 1 0 0 0 1 1h5",key:"wfsgrz"}],["path",{d:"M15.033 13.44a.647.647 0 0 1 0 1.12l-4.065 2.352a.645.645 0 0 1-.968-.56v-4.704a.645.645 0 0 1 .967-.56z",key:"1tzo1f"}]],dk=y("file-play",ou);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const nu=[["path",{d:"M12.659 22H18a2 2 0 0 0 2-2V8a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v9.34",key:"o6klzx"}],["path",{d:"M14 2v5a1 1 0 0 0 1 1h5",key:"wfsgrz"}],["path",{d:"M10.378 12.622a1 1 0 0 1 3 3.003L8.36 20.637a2 2 0 0 1-.854.506l-2.867.837a.5.5 0 0 1-.62-.62l.836-2.869a2 2 0 0 1 .506-.853z",key:"zhnas1"}]],uk=y("file-pen",nu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ru=[["path",{d:"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",key:"1oefj6"}],["path",{d:"M12 17h.01",key:"p32p05"}],["path",{d:"M9.1 9a3 3 0 0 1 5.82 1c0 2-3 3-3 3",key:"mhlwft"}]],pk=y("file-question-mark",ru);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const au=[["path",{d:"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",key:"1oefj6"}],["path",{d:"M14 2v5a1 1 0 0 0 1 1h5",key:"wfsgrz"}],["circle",{cx:"11.5",cy:"14.5",r:"2.5",key:"1bq0ko"}],["path",{d:"M13.3 16.3 15 18",key:"2quom7"}]],fk=y("file-search",au);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const su=[["path",{d:"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",key:"1oefj6"}],["path",{d:"M14 2v5a1 1 0 0 0 1 1h5",key:"wfsgrz"}],["path",{d:"M8 13h2",key:"yr2amv"}],["path",{d:"M14 13h2",key:"un5t4a"}],["path",{d:"M8 17h2",key:"2yhykz"}],["path",{d:"M14 17h2",key:"10kma7"}]],hk=y("file-spreadsheet",su);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const cu=[["path",{d:"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",key:"1oefj6"}],["path",{d:"M14 2v5a1 1 0 0 0 1 1h5",key:"wfsgrz"}],["path",{d:"M10 9H8",key:"b1mrlr"}],["path",{d:"M16 13H8",key:"t4e002"}],["path",{d:"M16 17H8",key:"z1uh3a"}]],yk=y("file-text",cu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const iu=[["path",{d:"M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4",key:"1nerag"}],["path",{d:"M14 13.12c0 2.38 0 6.38-1 8.88",key:"o46ks0"}],["path",{d:"M17.29 21.02c.12-.6.43-2.3.5-3.02",key:"ptglia"}],["path",{d:"M2 12a10 10 0 0 1 18-6",key:"ydlgp0"}],["path",{d:"M2 16h.01",key:"1gqxmh"}],["path",{d:"M21.8 16c.2-2 .131-5.354 0-6",key:"drycrb"}],["path",{d:"M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2",key:"1tidbn"}],["path",{d:"M8.65 22c.21-.66.45-1.32.57-2",key:"13wd9y"}],["path",{d:"M9 6.8a6 6 0 0 1 9 5.2v2",key:"1fr1j5"}]],mk=y("fingerprint-pattern",iu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const lu=[["path",{d:"M16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528",key:"1q158e"}],["path",{d:"m2 2 20 20",key:"1ooewy"}],["path",{d:"M4 22V4",key:"1plyxx"}],["path",{d:"M7.656 2H8c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10.347",key:"xj1b71"}]],vk=y("flag-off",lu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const du=[["path",{d:"M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528",key:"1jaruq"}]],gk=y("flag",du);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const uu=[["path",{d:"M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2",key:"18mbvz"}],["path",{d:"M6.453 15h11.094",key:"3shlmq"}],["path",{d:"M8.5 2h7",key:"csnxdl"}]],xk=y("flask-conical",uu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const pu=[["path",{d:"m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2",key:"usdka0"}]],kk=y("folder-open",pu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const fu=[["path",{d:"M10.7 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v4.1",key:"1bw5m7"}],["path",{d:"m21 21-1.9-1.9",key:"1g2n9r"}],["circle",{cx:"17",cy:"17",r:"3",key:"18b49y"}]],wk=y("folder-search",fu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const hu=[["path",{d:"M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z",key:"1dudjm"}],["path",{d:"M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z",key:"l2t8xc"}],["path",{d:"M16 17h4",key:"1dejxt"}],["path",{d:"M4 13h4",key:"1bwh8b"}]],bk=y("footprints",hu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const yu=[["path",{d:"M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0v-6.998a2 2 0 0 0-.59-1.42L18 5",key:"1wtuz0"}],["path",{d:"M14 21V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16",key:"e09ifn"}],["path",{d:"M2 21h13",key:"1x0fut"}],["path",{d:"M3 9h11",key:"1p7c0w"}]],_k=y("fuel",yu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const mu=[["path",{d:"M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z",key:"sc7q7i"}]],Mk=y("funnel",mu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const vu=[["path",{d:"m14 13-8.381 8.38a1 1 0 0 1-3.001-3l8.384-8.381",key:"pgg06f"}],["path",{d:"m16 16 6-6",key:"vzrcl6"}],["path",{d:"m21.5 10.5-8-8",key:"a17d9x"}],["path",{d:"m8 8 6-6",key:"18bi4p"}],["path",{d:"m8.5 7.5 8 8",key:"1oyaui"}]],Ck=y("gavel",vu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const gu=[["path",{d:"M10.5 3 8 9l4 13 4-13-2.5-6",key:"b3dvk1"}],["path",{d:"M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z",key:"7w4byz"}],["path",{d:"M2 9h20",key:"16fsjt"}]],Sk=y("gem",gu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const xu=[["path",{d:"M12 7v14",key:"1akyts"}],["path",{d:"M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8",key:"1sqzm4"}],["path",{d:"M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5",key:"kc0143"}],["rect",{x:"3",y:"7",width:"18",height:"4",rx:"1",key:"1hberx"}]],Ek=y("gift",xu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ku=[["path",{d:"M15 6a9 9 0 0 0-9 9V3",key:"1cii5b"}],["circle",{cx:"18",cy:"6",r:"3",key:"1h7g24"}],["circle",{cx:"6",cy:"18",r:"3",key:"fqmcym"}]],Rk=y("git-branch",ku);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const wu=[["circle",{cx:"18",cy:"18",r:"3",key:"1xkwt0"}],["circle",{cx:"6",cy:"6",r:"3",key:"1lh9wr"}],["path",{d:"M13 6h3a2 2 0 0 1 2 2v7",key:"1yeb86"}],["path",{d:"M11 18H8a2 2 0 0 1-2-2V9",key:"19pyzm"}]],Pk=y("git-compare",wu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const bu=[["circle",{cx:"18",cy:"18",r:"3",key:"1xkwt0"}],["circle",{cx:"6",cy:"6",r:"3",key:"1lh9wr"}],["path",{d:"M6 21V9a9 9 0 0 0 9 9",key:"7kw0sc"}]],Ak=y("git-merge",bu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _u=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20",key:"13o1zl"}],["path",{d:"M2 12h20",key:"9i4pu4"}]],Nk=y("globe",_u);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Mu=[["path",{d:"M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z",key:"j76jl0"}],["path",{d:"M22 10v6",key:"1lu8f3"}],["path",{d:"M6 12.5V16a6 3 0 0 0 12 0v-3.5",key:"1r8lef"}]],Tk=y("graduation-cap",Mu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Cu=[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",key:"afitv7"}],["path",{d:"M3 9h18",key:"1pudct"}],["path",{d:"M3 15h18",key:"5xshup"}],["path",{d:"M9 3v18",key:"fh3hqa"}],["path",{d:"M15 3v18",key:"14nvp0"}]],$k=y("grid-3x3",Cu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Su=[["path",{d:"M11 14h2a2 2 0 0 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16",key:"1v1a37"}],["path",{d:"m14.45 13.39 5.05-4.694C20.196 8 21 6.85 21 5.75a2.75 2.75 0 0 0-4.797-1.837.276.276 0 0 1-.406 0A2.75 2.75 0 0 0 11 5.75c0 1.2.802 2.248 1.5 2.946L16 11.95",key:"fhfbnt"}],["path",{d:"m2 15 6 6",key:"10dquu"}],["path",{d:"m7 20 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a1 1 0 0 0-2.75-2.91",key:"1x6kdw"}]],Ik=y("hand-heart",Su);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Eu=[["path",{d:"m11 17 2 2a1 1 0 1 0 3-3",key:"efffak"}],["path",{d:"m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4",key:"9pr0kb"}],["path",{d:"m21 3 1 11h-2",key:"1tisrp"}],["path",{d:"M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3",key:"1uvwmv"}],["path",{d:"M3 4h8",key:"1ep09j"}]],Dk=y("handshake",Eu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ru=[["line",{x1:"4",x2:"20",y1:"9",y2:"9",key:"4lhtct"}],["line",{x1:"4",x2:"20",y1:"15",y2:"15",key:"vyu0kd"}],["line",{x1:"10",x2:"8",y1:"3",y2:"21",key:"1ggp8o"}],["line",{x1:"16",x2:"14",y1:"3",y2:"21",key:"weycgp"}]],Ok=y("hash",Ru);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Pu=[["path",{d:"M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3",key:"1xhozi"}]],jk=y("headphones",Pu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Au=[["path",{d:"M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3Z",key:"12oyoe"}],["path",{d:"M21 16v2a4 4 0 0 1-4 4h-5",key:"1x7m43"}]],Lk=y("headset",Au);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Nu=[["path",{d:"M19.414 14.414C21 12.828 22 11.5 22 9.5a5.5 5.5 0 0 0-9.591-3.676.6.6 0 0 1-.818.001A5.5 5.5 0 0 0 2 9.5c0 2.3 1.5 4 3 5.5l5.535 5.362a2 2 0 0 0 2.879.052 2.12 2.12 0 0 0-.004-3 2.124 2.124 0 1 0 3-3 2.124 2.124 0 0 0 3.004 0 2 2 0 0 0 0-2.828l-1.881-1.882a2.41 2.41 0 0 0-3.409 0l-1.71 1.71a2 2 0 0 1-2.828 0 2 2 0 0 1 0-2.828l2.823-2.762",key:"17lmqv"}]],Fk=y("heart-handshake",Nu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Tu=[["path",{d:"M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5",key:"mvr1a0"}]],Vk=y("heart",Tu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $u=[["path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",key:"1357e3"}],["path",{d:"M3 3v5h5",key:"1xhq8a"}],["path",{d:"M12 7v5l4 2",key:"1fdv2h"}]],zk=y("history",$u);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Iu=[["path",{d:"M5 22h14",key:"ehvnwv"}],["path",{d:"M5 2h14",key:"pdyrp9"}],["path",{d:"M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22",key:"1d314k"}],["path",{d:"M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2",key:"1vvvr6"}]],Hk=y("hourglass",Iu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Du=[["path",{d:"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8",key:"5wwlr5"}],["path",{d:"M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",key:"r6nss1"}]],Bk=y("house",Du);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ou=[["line",{x1:"2",x2:"22",y1:"2",y2:"22",key:"a6p6uj"}],["path",{d:"M10.41 10.41a2 2 0 1 1-2.83-2.83",key:"1bzlo9"}],["line",{x1:"13.5",x2:"6",y1:"13.5",y2:"21",key:"1q0aeu"}],["line",{x1:"18",x2:"21",y1:"12",y2:"15",key:"5mozeu"}],["path",{d:"M3.59 3.59A1.99 1.99 0 0 0 3 5v14a2 2 0 0 0 2 2h14c.55 0 1.052-.22 1.41-.59",key:"mmje98"}],["path",{d:"M21 15V5a2 2 0 0 0-2-2H9",key:"43el77"}]],qk=y("image-off",Ou);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ju=[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",ry:"2",key:"1m3agn"}],["circle",{cx:"9",cy:"9",r:"2",key:"af1f0g"}],["path",{d:"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21",key:"1xmnt7"}]],Wk=y("image",ju);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Lu=[["polyline",{points:"22 12 16 12 14 15 10 15 8 12 2 12",key:"o97t9d"}],["path",{d:"M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",key:"oot6mr"}]],Uk=y("inbox",Lu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Fu=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 16v-4",key:"1dtifu"}],["path",{d:"M12 8h.01",key:"e9boi3"}]],Kk=y("info",Fu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Vu=[["path",{d:"M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z",key:"1s6t7t"}],["circle",{cx:"16.5",cy:"7.5",r:".5",fill:"currentColor",key:"w0ekpg"}]],Gk=y("key-round",Vu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const zu=[["path",{d:"m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4",key:"g0fldk"}],["path",{d:"m21 2-9.6 9.6",key:"1j0ho8"}],["circle",{cx:"7.5",cy:"15.5",r:"5.5",key:"yqb3hr"}]],Yk=y("key",zu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Hu=[["path",{d:"M10 18v-7",key:"wt116b"}],["path",{d:"M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z",key:"1m329m"}],["path",{d:"M14 18v-7",key:"vav6t3"}],["path",{d:"M18 18v-7",key:"aexdmj"}],["path",{d:"M3 22h18",key:"8prr45"}],["path",{d:"M6 18v-7",key:"1ivflk"}]],Xk=y("landmark",Hu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Bu=[["path",{d:"M18 5a2 2 0 0 1 2 2v8.526a2 2 0 0 0 .212.897l1.068 2.127a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45l1.068-2.127A2 2 0 0 0 4 15.526V7a2 2 0 0 1 2-2z",key:"1pdavp"}],["path",{d:"M20.054 15.987H3.946",key:"14rxg9"}]],Zk=y("laptop",Bu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const qu=[["path",{d:"M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z",key:"zw3jo"}],["path",{d:"M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12",key:"1wduqc"}],["path",{d:"M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17",key:"kqbvx6"}]],Qk=y("layers",qu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Wu=[["rect",{width:"7",height:"9",x:"3",y:"3",rx:"1",key:"10lvy0"}],["rect",{width:"7",height:"5",x:"14",y:"3",rx:"1",key:"16une8"}],["rect",{width:"7",height:"9",x:"14",y:"12",rx:"1",key:"1hutg5"}],["rect",{width:"7",height:"5",x:"3",y:"16",rx:"1",key:"ldoo1y"}]],Jk=y("layout-dashboard",Wu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Uu=[["path",{d:"M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z",key:"nnexq3"}],["path",{d:"M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12",key:"mt58a7"}]],ew=y("leaf",Uu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ku=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m4.93 4.93 4.24 4.24",key:"1ymg45"}],["path",{d:"m14.83 9.17 4.24-4.24",key:"1cb5xl"}],["path",{d:"m14.83 14.83 4.24 4.24",key:"q42g0n"}],["path",{d:"m9.17 14.83-4.24 4.24",key:"bqpfvv"}],["circle",{cx:"12",cy:"12",r:"4",key:"4exip2"}]],tw=y("life-buoy",Ku);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Gu=[["path",{d:"M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5",key:"1gvzjb"}],["path",{d:"M9 18h6",key:"x1upvd"}],["path",{d:"M10 22h4",key:"ceow96"}]],ow=y("lightbulb",Gu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Yu=[["path",{d:"M9 17H7A5 5 0 0 1 7 7h2",key:"8i5ue5"}],["path",{d:"M15 7h2a5 5 0 1 1 0 10h-2",key:"1b9ql8"}],["line",{x1:"8",x2:"16",y1:"12",y2:"12",key:"1jonct"}]],nw=y("link-2",Yu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Xu=[["path",{d:"M13 5h8",key:"a7qcls"}],["path",{d:"M13 12h8",key:"h98zly"}],["path",{d:"M13 19h8",key:"c3s6r1"}],["path",{d:"m3 17 2 2 4-4",key:"1jhpwq"}],["path",{d:"m3 7 2 2 4-4",key:"1obspn"}]],rw=y("list-checks",Xu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Zu=[["path",{d:"M13 5h8",key:"a7qcls"}],["path",{d:"M13 12h8",key:"h98zly"}],["path",{d:"M13 19h8",key:"c3s6r1"}],["path",{d:"m3 17 2 2 4-4",key:"1jhpwq"}],["rect",{x:"3",y:"4",width:"6",height:"6",rx:"1",key:"cif1o7"}]],aw=y("list-todo",Zu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Qu=[["path",{d:"M3 5h.01",key:"18ugdj"}],["path",{d:"M3 12h.01",key:"nlz23k"}],["path",{d:"M3 19h.01",key:"noohij"}],["path",{d:"M8 5h13",key:"1pao27"}],["path",{d:"M8 12h13",key:"1za7za"}],["path",{d:"M8 19h13",key:"m83p4d"}]],sw=y("list",Qu);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ju=[["path",{d:"M21 12a9 9 0 1 1-6.219-8.56",key:"13zald"}]],cw=y("loader-circle",Ju);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ep=[["rect",{width:"18",height:"11",x:"3",y:"11",rx:"2",ry:"2",key:"1w4ew1"}],["path",{d:"M7 11V7a5 5 0 0 1 9.9-1",key:"1mm8w8"}]],iw=y("lock-open",ep);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const tp=[["rect",{width:"18",height:"11",x:"3",y:"11",rx:"2",ry:"2",key:"1w4ew1"}],["path",{d:"M7 11V7a5 5 0 0 1 10 0v4",key:"fwvmzm"}]],lw=y("lock",tp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const op=[["path",{d:"m16 17 5-5-5-5",key:"1bji2h"}],["path",{d:"M21 12H9",key:"dn1m92"}],["path",{d:"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4",key:"1uf3rs"}]],dw=y("log-out",op);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const np=[["path",{d:"M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8",key:"12jkf8"}],["path",{d:"m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7",key:"1ocrg3"}],["path",{d:"m16 19 2 2 4-4",key:"1b14m6"}]],uw=y("mail-check",np);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const rp=[["path",{d:"M21.2 8.4c.5.38.8.97.8 1.6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 .8-1.6l8-6a2 2 0 0 1 2.4 0l8 6Z",key:"1jhwl8"}],["path",{d:"m22 10-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 10",key:"1qfld7"}]],pw=y("mail-open",rp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ap=[["path",{d:"m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7",key:"132q7q"}],["rect",{x:"2",y:"4",width:"20",height:"16",rx:"2",key:"izxlao"}]],fw=y("mail",ap);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const sp=[["path",{d:"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0",key:"1r0f0z"}],["circle",{cx:"12",cy:"10",r:"3",key:"ilqhr7"}]],hw=y("map-pin",sp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const cp=[["path",{d:"M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z",key:"169xi5"}],["path",{d:"M15 5.764v15",key:"1pn4in"}],["path",{d:"M9 3.236v15",key:"1uimfh"}]],yw=y("map",cp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ip=[["path",{d:"M15 3h6v6",key:"1q9fwt"}],["path",{d:"m21 3-7 7",key:"1l2asr"}],["path",{d:"m3 21 7-7",key:"tjx5ai"}],["path",{d:"M9 21H3v-6",key:"wtvkvv"}]],mw=y("maximize-2",ip);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const lp=[["path",{d:"M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15",key:"143lza"}],["path",{d:"M11 12 5.12 2.2",key:"qhuxz6"}],["path",{d:"m13 12 5.88-9.8",key:"hbye0f"}],["path",{d:"M8 7h8",key:"i86dvs"}],["circle",{cx:"12",cy:"17",r:"5",key:"qbz8iq"}],["path",{d:"M12 18v-2h-.5",key:"fawc4q"}]],vw=y("medal",lp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const dp=[["path",{d:"M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z",key:"q8bfy3"}],["path",{d:"M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14",key:"1853fq"}],["path",{d:"M8 6v8",key:"15ugcq"}]],gw=y("megaphone",dp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const up=[["path",{d:"M4 5h16",key:"1tepv9"}],["path",{d:"M4 12h16",key:"1lakjw"}],["path",{d:"M4 19h16",key:"1djgab"}]],xw=y("menu",up);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const pp=[["path",{d:"M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719",key:"1sd12s"}]],kw=y("message-circle",pp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const fp=[["path",{d:"M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z",key:"18887p"}],["path",{d:"M12 15h.01",key:"q59x07"}],["path",{d:"M12 7v4",key:"xawao1"}]],ww=y("message-square-warning",fp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const hp=[["path",{d:"M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z",key:"18887p"}]],bw=y("message-square",hp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const yp=[["path",{d:"M12 19v3",key:"npa21l"}],["path",{d:"M19 10v2a7 7 0 0 1-14 0v-2",key:"1vc78b"}],["rect",{x:"9",y:"2",width:"6",height:"13",rx:"3",key:"s6n7sd"}]],_w=y("mic",yp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const mp=[["path",{d:"M5 12h14",key:"1ays0h"}]],Mw=y("minus",mp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const vp=[["rect",{width:"20",height:"14",x:"2",y:"3",rx:"2",key:"48i651"}],["line",{x1:"8",x2:"16",y1:"21",y2:"21",key:"1svkeh"}],["line",{x1:"12",x2:"12",y1:"17",y2:"21",key:"vw1qmm"}]],Cw=y("monitor",vp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const gp=[["path",{d:"M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401",key:"kfwtm"}]],Sw=y("moon",gp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const xp=[["path",{d:"M14 4.1 12 6",key:"ita8i4"}],["path",{d:"m5.1 8-2.9-.8",key:"1go3kf"}],["path",{d:"m6 12-1.9 2",key:"mnht97"}],["path",{d:"M7.2 2.2 8 5.1",key:"1cfko1"}],["path",{d:"M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z",key:"s0h3yz"}]],Ew=y("mouse-pointer-click",xp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const kp=[["path",{d:"M12.586 12.586 19 19",key:"ea5xo7"}],["path",{d:"M3.688 3.037a.497.497 0 0 0-.651.651l6.5 15.999a.501.501 0 0 0 .947-.062l1.569-6.083a2 2 0 0 1 1.448-1.479l6.124-1.579a.5.5 0 0 0 .063-.947z",key:"277e5u"}]],Rw=y("mouse-pointer",kp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const wp=[["polygon",{points:"12 2 19 21 12 17 5 21 12 2",key:"x8c0qg"}]],Pw=y("navigation-2",wp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const bp=[["polygon",{points:"3 11 22 2 13 21 11 13 3 11",key:"1ltx0t"}]],Aw=y("navigation",bp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _p=[["rect",{x:"16",y:"16",width:"6",height:"6",rx:"1",key:"4q2zg0"}],["rect",{x:"2",y:"16",width:"6",height:"6",rx:"1",key:"8cvhb9"}],["rect",{x:"9",y:"2",width:"6",height:"6",rx:"1",key:"1egb70"}],["path",{d:"M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3",key:"1jsf9p"}],["path",{d:"M12 12V8",key:"2874zd"}]],Nw=y("network",_p);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Mp=[["path",{d:"M12 16h.01",key:"1drbdi"}],["path",{d:"M12 8v4",key:"1got3b"}],["path",{d:"M15.312 2a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586l-4.688-4.688A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2z",key:"1fd625"}]],Tw=y("octagon-alert",Mp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Cp=[["path",{d:"M12 22V12",key:"d0xqtd"}],["path",{d:"m16 17 2 2 4-4",key:"uh5qu3"}],["path",{d:"M21 11.127V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.729l7 4a2 2 0 0 0 2 .001l1.32-.753",key:"kpkbpo"}],["path",{d:"M3.29 7 12 12l8.71-5",key:"19ckod"}],["path",{d:"m7.5 4.27 8.997 5.148",key:"9yrvtv"}]],$w=y("package-check",Cp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Sp=[["path",{d:"M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z",key:"1a0edw"}],["path",{d:"M12 22V12",key:"d0xqtd"}],["polyline",{points:"3.29 7 12 12 20.71 7",key:"ousv84"}],["path",{d:"m7.5 4.27 9 5.15",key:"1c824w"}]],Iw=y("package",Sp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ep=[["path",{d:"M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z",key:"e79jfc"}],["circle",{cx:"13.5",cy:"6.5",r:".5",fill:"currentColor",key:"1okk4w"}],["circle",{cx:"17.5",cy:"10.5",r:".5",fill:"currentColor",key:"f64h9f"}],["circle",{cx:"6.5",cy:"12.5",r:".5",fill:"currentColor",key:"qy21gx"}],["circle",{cx:"8.5",cy:"7.5",r:".5",fill:"currentColor",key:"fotxhn"}]],Dw=y("palette",Ep);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Rp=[["path",{d:"m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551",key:"1miecu"}]],Ow=y("paperclip",Rp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Pp=[["path",{d:"M5.8 11.3 2 22l10.7-3.79",key:"gwxi1d"}],["path",{d:"M4 3h.01",key:"1vcuye"}],["path",{d:"M22 8h.01",key:"1mrtc2"}],["path",{d:"M15 2h.01",key:"1cjtqr"}],["path",{d:"M22 20h.01",key:"1mrys2"}],["path",{d:"m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10",key:"hbicv8"}],["path",{d:"m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17",key:"1i94pl"}],["path",{d:"m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7",key:"1cofks"}],["path",{d:"M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z",key:"4kbmks"}]],jw=y("party-popper",Pp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ap=[["rect",{x:"14",y:"3",width:"5",height:"18",rx:"1",key:"kaeet6"}],["rect",{x:"5",y:"3",width:"5",height:"18",rx:"1",key:"1wsw3u"}]],Lw=y("pause",Ap);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Np=[["circle",{cx:"11",cy:"4",r:"2",key:"vol9p0"}],["circle",{cx:"18",cy:"8",r:"2",key:"17gozi"}],["circle",{cx:"20",cy:"16",r:"2",key:"1v9bxh"}],["path",{d:"M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z",key:"1ydw1z"}]],Fw=y("paw-print",Np);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Tp=[["path",{d:"M13 21h8",key:"1jsn5i"}],["path",{d:"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",key:"1a8usu"}]],Vw=y("pen-line",Tp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $p=[["path",{d:"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",key:"1a8usu"}]],zw=y("pen",$p);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ip=[["line",{x1:"19",x2:"5",y1:"5",y2:"19",key:"1x9vlm"}],["circle",{cx:"6.5",cy:"6.5",r:"2.5",key:"4mh3h7"}],["circle",{cx:"17.5",cy:"17.5",r:"2.5",key:"1mdrzq"}]],Hw=y("percent",Ip);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Dp=[["path",{d:"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",key:"1a8usu"}],["path",{d:"m15 5 4 4",key:"1mk7zo"}]],Bw=y("pencil",Dp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Op=[["path",{d:"M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384",key:"9njp5v"}]],qw=y("phone",Op);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const jp=[["path",{d:"m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z",key:"wa1lgi"}],["path",{d:"m8.5 8.5 7 7",key:"rvfmvr"}]],Ww=y("pill",jp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Lp=[["path",{d:"M12 17v5",key:"bb1du9"}],["path",{d:"M15 9.34V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H7.89",key:"znwnzq"}],["path",{d:"m2 2 20 20",key:"1ooewy"}],["path",{d:"M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h11",key:"c9qhm2"}]],Uw=y("pin-off",Lp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Fp=[["path",{d:"M12 17v5",key:"bb1du9"}],["path",{d:"M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z",key:"1nkz8b"}]],Kw=y("pin",Fp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Vp=[["path",{d:"M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z",key:"1v9wt8"}]],Gw=y("plane",Vp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const zp=[["path",{d:"M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z",key:"10ikf1"}]],Yw=y("play",zp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Hp=[["path",{d:"M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4Z",key:"goz73y"}],["path",{d:"m2 22 3-3",key:"19mgm9"}],["path",{d:"M7.5 13.5 10 11",key:"7xgeeb"}],["path",{d:"M10.5 16.5 13 14",key:"10btkg"}],["path",{d:"m18 3-4 4h6l-4 4",key:"16psg9"}]],Xw=y("plug-zap",Hp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Bp=[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"M12 5v14",key:"s699le"}]],Zw=y("plus",Bp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const qp=[["path",{d:"M12 2v10",key:"mnfbl"}],["path",{d:"M18.4 6.6a9 9 0 1 1-12.77.04",key:"obofu9"}]],Qw=y("power",qp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Wp=[["path",{d:"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2",key:"143wyd"}],["path",{d:"M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6",key:"1itne7"}],["rect",{x:"6",y:"14",width:"12",height:"8",rx:"1",key:"1ue0tg"}]],Jw=y("printer",Wp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Up=[["rect",{width:"5",height:"5",x:"3",y:"3",rx:"1",key:"1tu5fj"}],["rect",{width:"5",height:"5",x:"16",y:"3",rx:"1",key:"1v8r4q"}],["rect",{width:"5",height:"5",x:"3",y:"16",rx:"1",key:"1x03jg"}],["path",{d:"M21 16h-3a2 2 0 0 0-2 2v3",key:"177gqh"}],["path",{d:"M21 21v.01",key:"ents32"}],["path",{d:"M12 7v3a2 2 0 0 1-2 2H7",key:"8crl2c"}],["path",{d:"M3 12h.01",key:"nlz23k"}],["path",{d:"M12 3h.01",key:"n36tog"}],["path",{d:"M12 16v.01",key:"133mhm"}],["path",{d:"M16 12h1",key:"1slzba"}],["path",{d:"M21 12v.01",key:"1lwtk9"}],["path",{d:"M12 21v-1",key:"1880an"}]],e5=y("qr-code",Up);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Kp=[["path",{d:"M13 16a3 3 0 0 1 2.24 5",key:"1epib5"}],["path",{d:"M18 12h.01",key:"yjnet6"}],["path",{d:"M18 21h-8a4 4 0 0 1-4-4 7 7 0 0 1 7-7h.2L9.6 6.4a1 1 0 1 1 2.8-2.8L15.8 7h.2c3.3 0 6 2.7 6 6v1a2 2 0 0 1-2 2h-1a3 3 0 0 0-3 3",key:"ue9ozu"}],["path",{d:"M20 8.54V4a2 2 0 1 0-4 0v3",key:"49iql8"}],["path",{d:"M7.612 12.524a3 3 0 1 0-1.6 4.3",key:"1e33i0"}]],t5=y("rabbit",Kp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Gp=[["path",{d:"M16.247 7.761a6 6 0 0 1 0 8.478",key:"1fwjs5"}],["path",{d:"M19.075 4.933a10 10 0 0 1 0 14.134",key:"ehdyv1"}],["path",{d:"M4.925 19.067a10 10 0 0 1 0-14.134",key:"1q22gi"}],["path",{d:"M7.753 16.239a6 6 0 0 1 0-8.478",key:"r2q7qm"}],["circle",{cx:"12",cy:"12",r:"2",key:"1c9p78"}]],o5=y("radio",Gp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Yp=[["path",{d:"M13 16H8",key:"wsln4y"}],["path",{d:"M14 8H8",key:"1l3xfs"}],["path",{d:"M16 12H8",key:"1fr5h0"}],["path",{d:"M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z",key:"ycz6yz"}]],n5=y("receipt-text",Yp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Xp=[["path",{d:"M12 17V7",key:"pyj7ub"}],["path",{d:"M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8",key:"1elt7d"}],["path",{d:"M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z",key:"ycz6yz"}]],r5=y("receipt",Xp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Zp=[["path",{d:"M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",key:"14sxne"}],["path",{d:"M3 3v5h5",key:"1xhq8a"}],["path",{d:"M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16",key:"1hlbsb"}],["path",{d:"M16 16h5v5",key:"ccwih5"}]],a5=y("refresh-ccw",Zp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Qp=[["path",{d:"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8",key:"v9h5vc"}],["path",{d:"M21 3v5h-5",key:"1q7to0"}],["path",{d:"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16",key:"3uifl3"}],["path",{d:"M8 16H3v5",key:"1cv678"}]],s5=y("refresh-cw",Qp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Jp=[["path",{d:"m17 2 4 4-4 4",key:"nntrym"}],["path",{d:"M3 11v-1a4 4 0 0 1 4-4h14",key:"84bu3i"}],["path",{d:"m7 22-4-4 4-4",key:"1wqhfi"}],["path",{d:"M21 13v1a4 4 0 0 1-4 4H3",key:"1rx37r"}]],c5=y("repeat",Jp);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const e0=[["path",{d:"M20 18v-2a4 4 0 0 0-4-4H4",key:"5vmcpk"}],["path",{d:"m9 17-5-5 5-5",key:"nvlc11"}]],i5=y("reply",e0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const t0=[["path",{d:"M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5",key:"qeys4"}],["path",{d:"M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09",key:"u4xsad"}],["path",{d:"M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z",key:"676m9"}],["path",{d:"M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05",key:"92ym6u"}]],l5=y("rocket",t0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const o0=[["path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",key:"1357e3"}],["path",{d:"M3 3v5h5",key:"1xhq8a"}]],d5=y("rotate-ccw",o0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const n0=[["circle",{cx:"6",cy:"19",r:"3",key:"1kj8tv"}],["path",{d:"M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15",key:"1d8sl"}],["circle",{cx:"18",cy:"5",r:"3",key:"gq8acd"}]],u5=y("route",n0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const r0=[["path",{d:"M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",key:"1c8476"}],["path",{d:"M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7",key:"1ydtos"}],["path",{d:"M7 3v4a1 1 0 0 0 1 1h7",key:"t51u73"}]],p5=y("save",r0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const a0=[["path",{d:"M12 3v18",key:"108xh3"}],["path",{d:"m19 8 3 8a5 5 0 0 1-6 0zV7",key:"zcdpyk"}],["path",{d:"M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1",key:"1yorad"}],["path",{d:"m5 8 3 8a5 5 0 0 1-6 0zV7",key:"eua70x"}],["path",{d:"M7 21h10",key:"1b0cd5"}]],f5=y("scale",a0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const s0=[["path",{d:"M3 7V5a2 2 0 0 1 2-2h2",key:"aa7l1z"}],["path",{d:"M17 3h2a2 2 0 0 1 2 2v2",key:"4qcy5o"}],["path",{d:"M21 17v2a2 2 0 0 1-2 2h-2",key:"6vwrx8"}],["path",{d:"M7 21H5a2 2 0 0 1-2-2v-2",key:"ioqczr"}],["path",{d:"M8 14s1.5 2 4 2 4-2 4-2",key:"1y1vjs"}],["path",{d:"M9 9h.01",key:"1q5me6"}],["path",{d:"M15 9h.01",key:"x1ddxp"}]],h5=y("scan-face",s0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const c0=[["path",{d:"M3 7V5a2 2 0 0 1 2-2h2",key:"aa7l1z"}],["path",{d:"M17 3h2a2 2 0 0 1 2 2v2",key:"4qcy5o"}],["path",{d:"M21 17v2a2 2 0 0 1-2 2h-2",key:"6vwrx8"}],["path",{d:"M7 21H5a2 2 0 0 1-2-2v-2",key:"ioqczr"}],["path",{d:"M7 12h10",key:"b7w52i"}]],y5=y("scan-line",c0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const i0=[["path",{d:"M3 7V5a2 2 0 0 1 2-2h2",key:"aa7l1z"}],["path",{d:"M17 3h2a2 2 0 0 1 2 2v2",key:"4qcy5o"}],["path",{d:"M21 17v2a2 2 0 0 1-2 2h-2",key:"6vwrx8"}],["path",{d:"M7 21H5a2 2 0 0 1-2-2v-2",key:"ioqczr"}]],m5=y("scan",i0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const l0=[["circle",{cx:"6",cy:"6",r:"3",key:"1lh9wr"}],["path",{d:"M8.12 8.12 12 12",key:"1alkpv"}],["path",{d:"M20 4 8.12 15.88",key:"xgtan2"}],["circle",{cx:"6",cy:"18",r:"3",key:"fqmcym"}],["path",{d:"M14.8 14.8 20 20",key:"ptml3r"}]],v5=y("scissors",l0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const d0=[["path",{d:"M15 12h-5",key:"r7krc0"}],["path",{d:"M15 8h-5",key:"1khuty"}],["path",{d:"M19 17V5a2 2 0 0 0-2-2H4",key:"zz82l3"}],["path",{d:"M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3",key:"1ph1d7"}]],g5=y("scroll-text",d0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u0=[["path",{d:"m21 21-4.34-4.34",key:"14j7rj"}],["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}]],x5=y("search",u0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const p0=[["path",{d:"M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.627a.498.498 0 0 0 .682.627l18-8.5a.5.5 0 0 0 0-.904z",key:"117uat"}],["path",{d:"M6 12h16",key:"s4cdu5"}]],k5=y("send-horizontal",p0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const f0=[["path",{d:"M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z",key:"1ffxy3"}],["path",{d:"m21.854 2.147-10.94 10.939",key:"12cjpa"}]],w5=y("send",f0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const h0=[["rect",{width:"20",height:"8",x:"2",y:"2",rx:"2",ry:"2",key:"ngkwjq"}],["rect",{width:"20",height:"8",x:"2",y:"14",rx:"2",ry:"2",key:"iecqi9"}],["line",{x1:"6",x2:"6.01",y1:"6",y2:"6",key:"16zg32"}],["line",{x1:"6",x2:"6.01",y1:"18",y2:"18",key:"nzw8ys"}]],b5=y("server",h0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y0=[["path",{d:"M14 17H5",key:"gfn3mx"}],["path",{d:"M19 7h-9",key:"6i9tg"}],["circle",{cx:"17",cy:"17",r:"3",key:"18b49y"}],["circle",{cx:"7",cy:"7",r:"3",key:"dfmy0x"}]],_5=y("settings-2",y0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const m0=[["path",{d:"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915",key:"1i5ecw"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]],M5=y("settings",m0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const v0=[["circle",{cx:"18",cy:"5",r:"3",key:"gq8acd"}],["circle",{cx:"6",cy:"12",r:"3",key:"w7nqdw"}],["circle",{cx:"18",cy:"19",r:"3",key:"1xt0gg"}],["line",{x1:"8.59",x2:"15.42",y1:"13.51",y2:"17.49",key:"47mynk"}],["line",{x1:"15.41",x2:"8.59",y1:"6.51",y2:"10.49",key:"1n3mei"}]],C5=y("share-2",v0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const g0=[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}],["path",{d:"M12 8v4",key:"1got3b"}],["path",{d:"M12 16h.01",key:"1drbdi"}]],S5=y("shield-alert",g0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const x0=[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]],E5=y("shield-check",x0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const k0=[["path",{d:"m2 2 20 20",key:"1ooewy"}],["path",{d:"M5 5a1 1 0 0 0-1 1v7c0 5 3.5 7.5 7.67 8.94a1 1 0 0 0 .67.01c2.35-.82 4.48-1.97 5.9-3.71",key:"1jlk70"}],["path",{d:"M9.309 3.652A12.252 12.252 0 0 0 11.24 2.28a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1v7a9.784 9.784 0 0 1-.08 1.264",key:"18rp1v"}]],R5=y("shield-off",k0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const w0=[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}],["path",{d:"m14.5 9.5-5 5",key:"17q4r4"}],["path",{d:"m9.5 9.5 5 5",key:"18nt4w"}]],P5=y("shield-x",w0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const b0=[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}]],A5=y("shield",b0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _0=[["path",{d:"M16 10a4 4 0 0 1-8 0",key:"1ltviw"}],["path",{d:"M3.103 6.034h17.794",key:"awc11p"}],["path",{d:"M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z",key:"o988cm"}]],N5=y("shopping-bag",_0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const M0=[["path",{d:"m15 11-1 9",key:"5wnq3a"}],["path",{d:"m19 11-4-7",key:"cnml18"}],["path",{d:"M2 11h20",key:"3eubbj"}],["path",{d:"m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4",key:"yiazzp"}],["path",{d:"M4.5 15.5h15",key:"13mye1"}],["path",{d:"m5 11 4-7",key:"116ra9"}],["path",{d:"m9 11 1 9",key:"1ojof7"}]],T5=y("shopping-basket",M0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const C0=[["circle",{cx:"8",cy:"21",r:"1",key:"jimo8o"}],["circle",{cx:"19",cy:"21",r:"1",key:"13723u"}],["path",{d:"M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12",key:"9zh506"}]],$5=y("shopping-cart",C0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const S0=[["path",{d:"M7 18v-6a5 5 0 1 1 10 0v6",key:"pcx96s"}],["path",{d:"M5 21a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2z",key:"1b4s83"}],["path",{d:"M21 12h1",key:"jtio3y"}],["path",{d:"M18.5 4.5 18 5",key:"g5sp9y"}],["path",{d:"M2 12h1",key:"1uaihz"}],["path",{d:"M12 2v1",key:"11qlp1"}],["path",{d:"m4.929 4.929.707.707",key:"1i51kw"}],["path",{d:"M12 12v6",key:"3ahymv"}]],I5=y("siren",S0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const E0=[["path",{d:"M10 5H3",key:"1qgfaw"}],["path",{d:"M12 19H3",key:"yhmn1j"}],["path",{d:"M14 3v4",key:"1sua03"}],["path",{d:"M16 17v4",key:"1q0r14"}],["path",{d:"M21 12h-9",key:"1o4lsq"}],["path",{d:"M21 19h-5",key:"1rlt1p"}],["path",{d:"M21 5h-7",key:"1oszz2"}],["path",{d:"M8 10v4",key:"tgpxqk"}],["path",{d:"M8 12H3",key:"a7s4jb"}]],D5=y("sliders-horizontal",E0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const R0=[["rect",{width:"14",height:"20",x:"5",y:"2",rx:"2",ry:"2",key:"1yt0o3"}],["path",{d:"M12 18h.01",key:"mhygvu"}]],O5=y("smartphone",R0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const P0=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M8 14s1.5 2 4 2 4-2 4-2",key:"1y1vjs"}],["line",{x1:"9",x2:"9.01",y1:"9",y2:"9",key:"yxxnd0"}],["line",{x1:"15",x2:"15.01",y1:"9",y2:"9",key:"1p4y9e"}]],j5=y("smile",P0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const A0=[["path",{d:"m10 20-1.25-2.5L6 18",key:"18frcb"}],["path",{d:"M10 4 8.75 6.5 6 6",key:"7mghy3"}],["path",{d:"m14 20 1.25-2.5L18 18",key:"1chtki"}],["path",{d:"m14 4 1.25 2.5L18 6",key:"1b4wsy"}],["path",{d:"m17 21-3-6h-4",key:"15hhxa"}],["path",{d:"m17 3-3 6 1.5 3",key:"11697g"}],["path",{d:"M2 12h6.5L10 9",key:"kv9z4n"}],["path",{d:"m20 10-1.5 2 1.5 2",key:"1swlpi"}],["path",{d:"M22 12h-6.5L14 15",key:"1mxi28"}],["path",{d:"m4 10 1.5 2L4 14",key:"k9enpj"}],["path",{d:"m7 21 3-6-1.5-3",key:"j8hb9u"}],["path",{d:"m7 3 3 6h4",key:"1otusx"}]],L5=y("snowflake",A0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const N0=[["path",{d:"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z",key:"1s2grr"}],["path",{d:"M20 2v4",key:"1rf3ol"}],["path",{d:"M22 4h-4",key:"gwowj6"}],["circle",{cx:"4",cy:"20",r:"2",key:"6kqj1y"}]],F5=y("sparkles",N0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const T0=[["path",{d:"M21 10.656V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12.344",key:"2acyp4"}],["path",{d:"m9 11 3 3L22 4",key:"1pflzl"}]],V5=y("square-check-big",T0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $0=[["path",{d:"M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7",key:"1m0v6g"}],["path",{d:"M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z",key:"ohrbg2"}]],z5=y("square-pen",$0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const I0=[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",key:"afitv7"}]],H5=y("square",I0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const D0=[["path",{d:"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z",key:"r04s7s"}]],B5=y("star",D0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const O0=[["path",{d:"M11 2v2",key:"1539x4"}],["path",{d:"M5 2v2",key:"1yf1q8"}],["path",{d:"M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1",key:"rb5t3r"}],["path",{d:"M8 15a6 6 0 0 0 12 0v-3",key:"x18d4x"}],["circle",{cx:"20",cy:"10",r:"2",key:"ts1r5v"}]],q5=y("stethoscope",O0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const j0=[["path",{d:"M21 9a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z",key:"1dfntj"}],["path",{d:"M15 3v5a1 1 0 0 0 1 1h5",key:"6s6qgf"}]],W5=y("sticky-note",j0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const L0=[["circle",{cx:"12",cy:"12",r:"4",key:"4exip2"}],["path",{d:"M12 2v2",key:"tus03m"}],["path",{d:"M12 20v2",key:"1lh1kg"}],["path",{d:"m4.93 4.93 1.41 1.41",key:"149t6j"}],["path",{d:"m17.66 17.66 1.41 1.41",key:"ptbguv"}],["path",{d:"M2 12h2",key:"1t8f8n"}],["path",{d:"M20 12h2",key:"1q8mjw"}],["path",{d:"m6.34 17.66-1.41 1.41",key:"1m8zz5"}],["path",{d:"m19.07 4.93-1.41 1.41",key:"1shlcs"}]],U5=y("sun",L0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const F0=[["path",{d:"m18 2 4 4",key:"22kx64"}],["path",{d:"m17 7 3-3",key:"1w1zoj"}],["path",{d:"M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5",key:"1exhtz"}],["path",{d:"m9 11 4 4",key:"rovt3i"}],["path",{d:"m5 19-3 3",key:"59f2uf"}],["path",{d:"m14 4 6 6",key:"yqp9t2"}]],K5=y("syringe",F0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const V0=[["rect",{width:"16",height:"20",x:"4",y:"2",rx:"2",ry:"2",key:"76otgf"}],["line",{x1:"12",x2:"12.01",y1:"18",y2:"18",key:"1dp563"}]],G5=y("tablet",V0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const z0=[["path",{d:"M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z",key:"vktsd0"}],["circle",{cx:"7.5",cy:"7.5",r:".5",fill:"currentColor",key:"kqv944"}]],Y5=y("tag",z0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const H0=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["circle",{cx:"12",cy:"12",r:"6",key:"1vlfrh"}],["circle",{cx:"12",cy:"12",r:"2",key:"1c9p78"}]],X5=y("target",H0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const B0=[["path",{d:"M12 19h8",key:"baeox8"}],["path",{d:"m4 17 6-6-6-6",key:"1yngyt"}]],Z5=y("terminal",B0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const q0=[["path",{d:"M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z",key:"17jzev"}]],Q5=y("thermometer",q0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const W0=[["path",{d:"M12 2v2",key:"tus03m"}],["path",{d:"M12 8a4 4 0 0 0-1.645 7.647",key:"wz5p04"}],["path",{d:"M2 12h2",key:"1t8f8n"}],["path",{d:"M20 14.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z",key:"yu0u2z"}],["path",{d:"m4.93 4.93 1.41 1.41",key:"149t6j"}],["path",{d:"m6.34 17.66-1.41 1.41",key:"1m8zz5"}]],J5=y("thermometer-sun",W0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const U0=[["path",{d:"M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z",key:"m61m77"}],["path",{d:"M17 14V2",key:"8ymqnk"}]],e3=y("thumbs-down",U0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const K0=[["path",{d:"M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z",key:"emmmcr"}],["path",{d:"M7 10v12",key:"1qc93n"}]],t3=y("thumbs-up",K0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const G0=[["path",{d:"M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z",key:"qn84l0"}],["path",{d:"M13 5v2",key:"dyzc3o"}],["path",{d:"M13 17v2",key:"1ont0d"}],["path",{d:"M13 11v2",key:"1wjjxi"}]],o3=y("ticket",G0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Y0=[["line",{x1:"10",x2:"14",y1:"2",y2:"2",key:"14vaq8"}],["line",{x1:"12",x2:"15",y1:"14",y2:"11",key:"17fdiu"}],["circle",{cx:"12",cy:"14",r:"8",key:"1e1u0o"}]],n3=y("timer",Y0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const X0=[["circle",{cx:"9",cy:"12",r:"3",key:"u3jwor"}],["rect",{width:"20",height:"14",x:"2",y:"5",rx:"7",key:"g7kal2"}]],r3=y("toggle-left",X0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Z0=[["circle",{cx:"15",cy:"12",r:"3",key:"1afu0r"}],["rect",{width:"20",height:"14",x:"2",y:"5",rx:"7",key:"g7kal2"}]],a3=y("toggle-right",Z0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Q0=[["path",{d:"M10 11v6",key:"nco0om"}],["path",{d:"M14 11v6",key:"outv1u"}],["path",{d:"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",key:"miytrc"}],["path",{d:"M3 6h18",key:"d0wm0j"}],["path",{d:"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",key:"e791ji"}]],s3=y("trash-2",Q0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const J0=[["path",{d:"m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2A1 1 0 0 1 8 7.3L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7H17Z",key:"cpyugq"}],["path",{d:"M12 22v-3",key:"kmzjlo"}]],c3=y("tree-pine",J0);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const e2=[["path",{d:"M16 7h6v6",key:"box55l"}],["path",{d:"m22 7-8.5 8.5-5-5L2 17",key:"1t1m79"}]],i3=y("trending-up",e2);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const t2=[["path",{d:"M16 17h6v-6",key:"t6n2it"}],["path",{d:"m22 17-8.5-8.5-5 5L2 7",key:"x473p"}]],l3=y("trending-down",t2);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const o2=[["path",{d:"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",key:"wmoenq"}],["path",{d:"M12 9v4",key:"juzpu7"}],["path",{d:"M12 17h.01",key:"p32p05"}]],d3=y("triangle-alert",o2);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const n2=[["path",{d:"M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978",key:"1n3hpd"}],["path",{d:"M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978",key:"rfe1zi"}],["path",{d:"M18 9h1.5a1 1 0 0 0 0-5H18",key:"7xy6bh"}],["path",{d:"M4 22h16",key:"57wxv0"}],["path",{d:"M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z",key:"1mhfuq"}],["path",{d:"M6 9H4.5a1 1 0 0 1 0-5H6",key:"tex48p"}]],u3=y("trophy",n2);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const r2=[["path",{d:"M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2",key:"wrbu53"}],["path",{d:"M15 18H9",key:"1lyqi6"}],["path",{d:"M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14",key:"lysw3i"}],["circle",{cx:"17",cy:"18",r:"2",key:"332jqn"}],["circle",{cx:"7",cy:"18",r:"2",key:"19iecd"}]],p3=y("truck",r2);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const a2=[["path",{d:"M12 4v16",key:"1654pz"}],["path",{d:"M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2",key:"e0r10z"}],["path",{d:"M9 20h6",key:"s66wpe"}]],f3=y("type",a2);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const s2=[["path",{d:"M12 3v12",key:"1x0j5s"}],["path",{d:"m17 8-5-5-5 5",key:"7q97r8"}],["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}]],h3=y("upload",s2);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const c2=[["path",{d:"m16 11 2 2 4-4",key:"9rsbq5"}],["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",key:"1yyitq"}],["circle",{cx:"9",cy:"7",r:"4",key:"nufk8"}]],y3=y("user-check",c2);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const i2=[["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",key:"1yyitq"}],["circle",{cx:"9",cy:"7",r:"4",key:"nufk8"}],["line",{x1:"22",x2:"16",y1:"11",y2:"11",key:"1shjgl"}]],m3=y("user-minus",i2);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const l2=[["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",key:"1yyitq"}],["circle",{cx:"9",cy:"7",r:"4",key:"nufk8"}],["line",{x1:"19",x2:"19",y1:"8",y2:"14",key:"1bvyxn"}],["line",{x1:"22",x2:"16",y1:"11",y2:"11",key:"1shjgl"}]],v3=y("user-plus",l2);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const d2=[["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",key:"1yyitq"}],["circle",{cx:"9",cy:"7",r:"4",key:"nufk8"}],["line",{x1:"17",x2:"22",y1:"8",y2:"13",key:"3nzzx3"}],["line",{x1:"22",x2:"17",y1:"8",y2:"13",key:"1swrse"}]],g3=y("user-x",d2);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u2=[["path",{d:"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2",key:"975kel"}],["circle",{cx:"12",cy:"7",r:"4",key:"17ys0d"}]],x3=y("user",u2);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const p2=[["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",key:"1yyitq"}],["path",{d:"M16 3.128a4 4 0 0 1 0 7.744",key:"16gr8j"}],["path",{d:"M22 21v-2a4 4 0 0 0-3-3.87",key:"kshegd"}],["circle",{cx:"9",cy:"7",r:"4",key:"nufk8"}]],k3=y("users",p2);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const f2=[["path",{d:"M18 21a8 8 0 0 0-16 0",key:"3ypg7q"}],["circle",{cx:"10",cy:"8",r:"5",key:"o932ke"}],["path",{d:"M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3",key:"10s06x"}]],w3=y("users-round",f2);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const h2=[["path",{d:"m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8",key:"n7qcjb"}],["path",{d:"M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7",key:"d0u48b"}],["path",{d:"m2.1 21.8 6.4-6.3",key:"yn04lh"}],["path",{d:"m19 5-7 7",key:"194lzd"}]],b3=y("utensils-crossed",h2);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y2=[["path",{d:"m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5",key:"ftymec"}],["rect",{x:"2",y:"6",width:"14",height:"12",rx:"2",key:"158x01"}]],_3=y("video",y2);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const m2=[["path",{d:"M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1",key:"18etb6"}],["path",{d:"M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4",key:"xoc0q4"}]],M3=y("wallet",m2);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const v2=[["path",{d:"m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72",key:"ul74o6"}],["path",{d:"m14 7 3 3",key:"1r5n42"}],["path",{d:"M5 6v4",key:"ilb8ba"}],["path",{d:"M19 14v4",key:"blhpug"}],["path",{d:"M10 2v2",key:"7u0qdc"}],["path",{d:"M7 8H3",key:"zfb6yr"}],["path",{d:"M21 16h-4",key:"1cnmox"}],["path",{d:"M11 3H9",key:"1obp7u"}]],C3=y("wand-sparkles",v2);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const g2=[["path",{d:"M18 21V10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v11",key:"pb2vm6"}],["path",{d:"M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 1.132-1.803l7.95-3.974a2 2 0 0 1 1.837 0l7.948 3.974A2 2 0 0 1 22 8z",key:"doq5xv"}],["path",{d:"M6 13h12",key:"yf64js"}],["path",{d:"M6 17h12",key:"1jwigz"}]],S3=y("warehouse",g2);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const x2=[["path",{d:"M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1",key:"knzxuh"}],["path",{d:"M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1",key:"2jd2cc"}],["path",{d:"M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1",key:"rd2r6e"}]],E3=y("waves",x2);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const k2=[["path",{d:"M12 20h.01",key:"zekei9"}],["path",{d:"M8.5 16.429a5 5 0 0 1 7 0",key:"1bycff"}],["path",{d:"M5 12.859a10 10 0 0 1 5.17-2.69",key:"1dl1wf"}],["path",{d:"M19 12.859a10 10 0 0 0-2.007-1.523",key:"4k23kn"}],["path",{d:"M2 8.82a15 15 0 0 1 4.177-2.643",key:"1grhjp"}],["path",{d:"M22 8.82a15 15 0 0 0-11.288-3.764",key:"z3jwby"}],["path",{d:"m2 2 20 20",key:"1ooewy"}]],R3=y("wifi-off",k2);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const w2=[["path",{d:"M12 20h.01",key:"zekei9"}],["path",{d:"M2 8.82a15 15 0 0 1 20 0",key:"dnpr2z"}],["path",{d:"M5 12.859a10 10 0 0 1 14 0",key:"1x1e6c"}],["path",{d:"M8.5 16.429a5 5 0 0 1 7 0",key:"1bycff"}]],P3=y("wifi",w2);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const b2=[["path",{d:"M12.8 19.6A2 2 0 1 0 14 16H2",key:"148xed"}],["path",{d:"M17.5 8a2.5 2.5 0 1 1 2 4H2",key:"1u4tom"}],["path",{d:"M9.8 4.4A2 2 0 1 1 11 8H2",key:"75valh"}]],A3=y("wind",b2);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _2=[["path",{d:"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z",key:"1ngwbx"}]],N3=y("wrench",_2);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const M2=[["path",{d:"M18 6 6 18",key:"1bl5f8"}],["path",{d:"m6 6 12 12",key:"d8bk6v"}]],T3=y("x",M2);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const C2=[["path",{d:"M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z",key:"1xq2db"}]],$3=y("zap",C2);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const S2=[["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}],["line",{x1:"21",x2:"16.65",y1:"21",y2:"16.65",key:"13gj7c"}],["line",{x1:"11",x2:"11",y1:"8",y2:"14",key:"1vmskp"}],["line",{x1:"8",x2:"14",y1:"11",y2:"11",key:"durymu"}]],I3=y("zoom-in",S2);/**
 * @license lucide-react v0.576.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const E2=[["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}],["line",{x1:"21",x2:"16.65",y1:"21",y2:"16.65",key:"13gj7c"}],["line",{x1:"8",x2:"14",y1:"11",y2:"11",key:"durymu"}]],D3=y("zoom-out",E2);var R2=on[" useId ".trim().toString()]||(()=>{}),P2=0;function se(e){const[t,o]=c.useState(R2());return Z(()=>{o(n=>n??String(P2++))},[e]),e||(t?`radix-${t}`:"")}const A2=["top","right","bottom","left"],Ne=Math.min,le=Math.max,Dt=Math.round,Nt=Math.floor,ke=e=>({x:e,y:e}),N2={left:"right",right:"left",bottom:"top",top:"bottom"},T2={start:"end",end:"start"};function Vo(e,t,o){return le(e,Ne(t,o))}function Se(e,t){return typeof e=="function"?e(t):e}function Ee(e){return e.split("-")[0]}function et(e){return e.split("-")[1]}function cn(e){return e==="x"?"y":"x"}function ln(e){return e==="y"?"height":"width"}const $2=new Set(["top","bottom"]);function xe(e){return $2.has(Ee(e))?"y":"x"}function dn(e){return cn(xe(e))}function I2(e,t,o){o===void 0&&(o=!1);const n=et(e),r=dn(e),a=ln(r);let s=r==="x"?n===(o?"end":"start")?"right":"left":n==="start"?"bottom":"top";return t.reference[a]>t.floating[a]&&(s=Ot(s)),[s,Ot(s)]}function D2(e){const t=Ot(e);return[zo(e),t,zo(t)]}function zo(e){return e.replace(/start|end/g,t=>T2[t])}const er=["left","right"],tr=["right","left"],O2=["top","bottom"],j2=["bottom","top"];function L2(e,t,o){switch(e){case"top":case"bottom":return o?t?tr:er:t?er:tr;case"left":case"right":return t?O2:j2;default:return[]}}function F2(e,t,o,n){const r=et(e);let a=L2(Ee(e),o==="start",n);return r&&(a=a.map(s=>s+"-"+r),t&&(a=a.concat(a.map(zo)))),a}function Ot(e){return e.replace(/left|right|bottom|top/g,t=>N2[t])}function V2(e){return{top:0,right:0,bottom:0,left:0,...e}}function Vr(e){return typeof e!="number"?V2(e):{top:e,right:e,bottom:e,left:e}}function jt(e){const{x:t,y:o,width:n,height:r}=e;return{width:n,height:r,top:o,left:t,right:t+n,bottom:o+r,x:t,y:o}}function or(e,t,o){let{reference:n,floating:r}=e;const a=xe(t),s=dn(t),i=ln(s),l=Ee(t),d=a==="y",p=n.x+n.width/2-r.width/2,u=n.y+n.height/2-r.height/2,h=n[i]/2-r[i]/2;let m;switch(l){case"top":m={x:p,y:n.y-r.height};break;case"bottom":m={x:p,y:n.y+n.height};break;case"right":m={x:n.x+n.width,y:u};break;case"left":m={x:n.x-r.width,y:u};break;default:m={x:n.x,y:n.y}}switch(et(t)){case"start":m[s]-=h*(o&&d?-1:1);break;case"end":m[s]+=h*(o&&d?-1:1);break}return m}const z2=async(e,t,o)=>{const{placement:n="bottom",strategy:r="absolute",middleware:a=[],platform:s}=o,i=a.filter(Boolean),l=await(s.isRTL==null?void 0:s.isRTL(t));let d=await s.getElementRects({reference:e,floating:t,strategy:r}),{x:p,y:u}=or(d,n,l),h=n,m={},x=0;for(let v=0;v<i.length;v++){const{name:g,fn:k}=i[v],{x:w,y:b,data:_,reset:M}=await k({x:p,y:u,initialPlacement:n,placement:h,strategy:r,middlewareData:m,rects:d,platform:s,elements:{reference:e,floating:t}});p=w??p,u=b??u,m={...m,[g]:{...m[g],..._}},M&&x<=50&&(x++,typeof M=="object"&&(M.placement&&(h=M.placement),M.rects&&(d=M.rects===!0?await s.getElementRects({reference:e,floating:t,strategy:r}):M.rects),{x:p,y:u}=or(d,h,l)),v=-1)}return{x:p,y:u,placement:h,strategy:r,middlewareData:m}};async function dt(e,t){var o;t===void 0&&(t={});const{x:n,y:r,platform:a,rects:s,elements:i,strategy:l}=e,{boundary:d="clippingAncestors",rootBoundary:p="viewport",elementContext:u="floating",altBoundary:h=!1,padding:m=0}=Se(t,e),x=Vr(m),g=i[h?u==="floating"?"reference":"floating":u],k=jt(await a.getClippingRect({element:(o=await(a.isElement==null?void 0:a.isElement(g)))==null||o?g:g.contextElement||await(a.getDocumentElement==null?void 0:a.getDocumentElement(i.floating)),boundary:d,rootBoundary:p,strategy:l})),w=u==="floating"?{x:n,y:r,width:s.floating.width,height:s.floating.height}:s.reference,b=await(a.getOffsetParent==null?void 0:a.getOffsetParent(i.floating)),_=await(a.isElement==null?void 0:a.isElement(b))?await(a.getScale==null?void 0:a.getScale(b))||{x:1,y:1}:{x:1,y:1},M=jt(a.convertOffsetParentRelativeRectToViewportRelativeRect?await a.convertOffsetParentRelativeRectToViewportRelativeRect({elements:i,rect:w,offsetParent:b,strategy:l}):w);return{top:(k.top-M.top+x.top)/_.y,bottom:(M.bottom-k.bottom+x.bottom)/_.y,left:(k.left-M.left+x.left)/_.x,right:(M.right-k.right+x.right)/_.x}}const H2=e=>({name:"arrow",options:e,async fn(t){const{x:o,y:n,placement:r,rects:a,platform:s,elements:i,middlewareData:l}=t,{element:d,padding:p=0}=Se(e,t)||{};if(d==null)return{};const u=Vr(p),h={x:o,y:n},m=dn(r),x=ln(m),v=await s.getDimensions(d),g=m==="y",k=g?"top":"left",w=g?"bottom":"right",b=g?"clientHeight":"clientWidth",_=a.reference[x]+a.reference[m]-h[m]-a.floating[x],M=h[m]-a.reference[m],E=await(s.getOffsetParent==null?void 0:s.getOffsetParent(d));let S=E?E[b]:0;(!S||!await(s.isElement==null?void 0:s.isElement(E)))&&(S=i.floating[b]||a.floating[x]);const N=_/2-M/2,T=S/2-v[x]/2-1,I=Ne(u[k],T),D=Ne(u[w],T),F=I,V=S-v[x]-D,R=S/2-v[x]/2+N,H=Vo(F,R,V),O=!l.arrow&&et(r)!=null&&R!==H&&a.reference[x]/2-(R<F?I:D)-v[x]/2<0,z=O?R<F?R-F:R-V:0;return{[m]:h[m]+z,data:{[m]:H,centerOffset:R-H-z,...O&&{alignmentOffset:z}},reset:O}}}),B2=function(e){return e===void 0&&(e={}),{name:"flip",options:e,async fn(t){var o,n;const{placement:r,middlewareData:a,rects:s,initialPlacement:i,platform:l,elements:d}=t,{mainAxis:p=!0,crossAxis:u=!0,fallbackPlacements:h,fallbackStrategy:m="bestFit",fallbackAxisSideDirection:x="none",flipAlignment:v=!0,...g}=Se(e,t);if((o=a.arrow)!=null&&o.alignmentOffset)return{};const k=Ee(r),w=xe(i),b=Ee(i)===i,_=await(l.isRTL==null?void 0:l.isRTL(d.floating)),M=h||(b||!v?[Ot(i)]:D2(i)),E=x!=="none";!h&&E&&M.push(...F2(i,v,x,_));const S=[i,...M],N=await dt(t,g),T=[];let I=((n=a.flip)==null?void 0:n.overflows)||[];if(p&&T.push(N[k]),u){const R=I2(r,s,_);T.push(N[R[0]],N[R[1]])}if(I=[...I,{placement:r,overflows:T}],!T.every(R=>R<=0)){var D,F;const R=(((D=a.flip)==null?void 0:D.index)||0)+1,H=S[R];if(H&&(!(u==="alignment"?w!==xe(H):!1)||I.every($=>xe($.placement)===w?$.overflows[0]>0:!0)))return{data:{index:R,overflows:I},reset:{placement:H}};let O=(F=I.filter(z=>z.overflows[0]<=0).sort((z,$)=>z.overflows[1]-$.overflows[1])[0])==null?void 0:F.placement;if(!O)switch(m){case"bestFit":{var V;const z=(V=I.filter($=>{if(E){const P=xe($.placement);return P===w||P==="y"}return!0}).map($=>[$.placement,$.overflows.filter(P=>P>0).reduce((P,B)=>P+B,0)]).sort(($,P)=>$[1]-P[1])[0])==null?void 0:V[0];z&&(O=z);break}case"initialPlacement":O=i;break}if(r!==O)return{reset:{placement:O}}}return{}}}};function nr(e,t){return{top:e.top-t.height,right:e.right-t.width,bottom:e.bottom-t.height,left:e.left-t.width}}function rr(e){return A2.some(t=>e[t]>=0)}const q2=function(e){return e===void 0&&(e={}),{name:"hide",options:e,async fn(t){const{rects:o}=t,{strategy:n="referenceHidden",...r}=Se(e,t);switch(n){case"referenceHidden":{const a=await dt(t,{...r,elementContext:"reference"}),s=nr(a,o.reference);return{data:{referenceHiddenOffsets:s,referenceHidden:rr(s)}}}case"escaped":{const a=await dt(t,{...r,altBoundary:!0}),s=nr(a,o.floating);return{data:{escapedOffsets:s,escaped:rr(s)}}}default:return{}}}}},zr=new Set(["left","top"]);async function W2(e,t){const{placement:o,platform:n,elements:r}=e,a=await(n.isRTL==null?void 0:n.isRTL(r.floating)),s=Ee(o),i=et(o),l=xe(o)==="y",d=zr.has(s)?-1:1,p=a&&l?-1:1,u=Se(t,e);let{mainAxis:h,crossAxis:m,alignmentAxis:x}=typeof u=="number"?{mainAxis:u,crossAxis:0,alignmentAxis:null}:{mainAxis:u.mainAxis||0,crossAxis:u.crossAxis||0,alignmentAxis:u.alignmentAxis};return i&&typeof x=="number"&&(m=i==="end"?x*-1:x),l?{x:m*p,y:h*d}:{x:h*d,y:m*p}}const U2=function(e){return e===void 0&&(e=0),{name:"offset",options:e,async fn(t){var o,n;const{x:r,y:a,placement:s,middlewareData:i}=t,l=await W2(t,e);return s===((o=i.offset)==null?void 0:o.placement)&&(n=i.arrow)!=null&&n.alignmentOffset?{}:{x:r+l.x,y:a+l.y,data:{...l,placement:s}}}}},K2=function(e){return e===void 0&&(e={}),{name:"shift",options:e,async fn(t){const{x:o,y:n,placement:r}=t,{mainAxis:a=!0,crossAxis:s=!1,limiter:i={fn:g=>{let{x:k,y:w}=g;return{x:k,y:w}}},...l}=Se(e,t),d={x:o,y:n},p=await dt(t,l),u=xe(Ee(r)),h=cn(u);let m=d[h],x=d[u];if(a){const g=h==="y"?"top":"left",k=h==="y"?"bottom":"right",w=m+p[g],b=m-p[k];m=Vo(w,m,b)}if(s){const g=u==="y"?"top":"left",k=u==="y"?"bottom":"right",w=x+p[g],b=x-p[k];x=Vo(w,x,b)}const v=i.fn({...t,[h]:m,[u]:x});return{...v,data:{x:v.x-o,y:v.y-n,enabled:{[h]:a,[u]:s}}}}}},G2=function(e){return e===void 0&&(e={}),{options:e,fn(t){const{x:o,y:n,placement:r,rects:a,middlewareData:s}=t,{offset:i=0,mainAxis:l=!0,crossAxis:d=!0}=Se(e,t),p={x:o,y:n},u=xe(r),h=cn(u);let m=p[h],x=p[u];const v=Se(i,t),g=typeof v=="number"?{mainAxis:v,crossAxis:0}:{mainAxis:0,crossAxis:0,...v};if(l){const b=h==="y"?"height":"width",_=a.reference[h]-a.floating[b]+g.mainAxis,M=a.reference[h]+a.reference[b]-g.mainAxis;m<_?m=_:m>M&&(m=M)}if(d){var k,w;const b=h==="y"?"width":"height",_=zr.has(Ee(r)),M=a.reference[u]-a.floating[b]+(_&&((k=s.offset)==null?void 0:k[u])||0)+(_?0:g.crossAxis),E=a.reference[u]+a.reference[b]+(_?0:((w=s.offset)==null?void 0:w[u])||0)-(_?g.crossAxis:0);x<M?x=M:x>E&&(x=E)}return{[h]:m,[u]:x}}}},Y2=function(e){return e===void 0&&(e={}),{name:"size",options:e,async fn(t){var o,n;const{placement:r,rects:a,platform:s,elements:i}=t,{apply:l=()=>{},...d}=Se(e,t),p=await dt(t,d),u=Ee(r),h=et(r),m=xe(r)==="y",{width:x,height:v}=a.floating;let g,k;u==="top"||u==="bottom"?(g=u,k=h===(await(s.isRTL==null?void 0:s.isRTL(i.floating))?"start":"end")?"left":"right"):(k=u,g=h==="end"?"top":"bottom");const w=v-p.top-p.bottom,b=x-p.left-p.right,_=Ne(v-p[g],w),M=Ne(x-p[k],b),E=!t.middlewareData.shift;let S=_,N=M;if((o=t.middlewareData.shift)!=null&&o.enabled.x&&(N=b),(n=t.middlewareData.shift)!=null&&n.enabled.y&&(S=w),E&&!h){const I=le(p.left,0),D=le(p.right,0),F=le(p.top,0),V=le(p.bottom,0);m?N=x-2*(I!==0||D!==0?I+D:le(p.left,p.right)):S=v-2*(F!==0||V!==0?F+V:le(p.top,p.bottom))}await l({...t,availableWidth:N,availableHeight:S});const T=await s.getDimensions(i.floating);return x!==T.width||v!==T.height?{reset:{rects:!0}}:{}}}};function Zt(){return typeof window<"u"}function tt(e){return Hr(e)?(e.nodeName||"").toLowerCase():"#document"}function de(e){var t;return(e==null||(t=e.ownerDocument)==null?void 0:t.defaultView)||window}function _e(e){var t;return(t=(Hr(e)?e.ownerDocument:e.document)||window.document)==null?void 0:t.documentElement}function Hr(e){return Zt()?e instanceof Node||e instanceof de(e).Node:!1}function he(e){return Zt()?e instanceof Element||e instanceof de(e).Element:!1}function we(e){return Zt()?e instanceof HTMLElement||e instanceof de(e).HTMLElement:!1}function ar(e){return!Zt()||typeof ShadowRoot>"u"?!1:e instanceof ShadowRoot||e instanceof de(e).ShadowRoot}const X2=new Set(["inline","contents"]);function gt(e){const{overflow:t,overflowX:o,overflowY:n,display:r}=ye(e);return/auto|scroll|overlay|hidden|clip/.test(t+n+o)&&!X2.has(r)}const Z2=new Set(["table","td","th"]);function Q2(e){return Z2.has(tt(e))}const J2=[":popover-open",":modal"];function Qt(e){return J2.some(t=>{try{return e.matches(t)}catch{return!1}})}const ef=["transform","translate","scale","rotate","perspective"],tf=["transform","translate","scale","rotate","perspective","filter"],of=["paint","layout","strict","content"];function un(e){const t=pn(),o=he(e)?ye(e):e;return ef.some(n=>o[n]?o[n]!=="none":!1)||(o.containerType?o.containerType!=="normal":!1)||!t&&(o.backdropFilter?o.backdropFilter!=="none":!1)||!t&&(o.filter?o.filter!=="none":!1)||tf.some(n=>(o.willChange||"").includes(n))||of.some(n=>(o.contain||"").includes(n))}function nf(e){let t=Te(e);for(;we(t)&&!Ge(t);){if(un(t))return t;if(Qt(t))return null;t=Te(t)}return null}function pn(){return typeof CSS>"u"||!CSS.supports?!1:CSS.supports("-webkit-backdrop-filter","none")}const rf=new Set(["html","body","#document"]);function Ge(e){return rf.has(tt(e))}function ye(e){return de(e).getComputedStyle(e)}function Jt(e){return he(e)?{scrollLeft:e.scrollLeft,scrollTop:e.scrollTop}:{scrollLeft:e.scrollX,scrollTop:e.scrollY}}function Te(e){if(tt(e)==="html")return e;const t=e.assignedSlot||e.parentNode||ar(e)&&e.host||_e(e);return ar(t)?t.host:t}function Br(e){const t=Te(e);return Ge(t)?e.ownerDocument?e.ownerDocument.body:e.body:we(t)&&gt(t)?t:Br(t)}function ut(e,t,o){var n;t===void 0&&(t=[]),o===void 0&&(o=!0);const r=Br(e),a=r===((n=e.ownerDocument)==null?void 0:n.body),s=de(r);if(a){const i=Ho(s);return t.concat(s,s.visualViewport||[],gt(r)?r:[],i&&o?ut(i):[])}return t.concat(r,ut(r,[],o))}function Ho(e){return e.parent&&Object.getPrototypeOf(e.parent)?e.frameElement:null}function qr(e){const t=ye(e);let o=parseFloat(t.width)||0,n=parseFloat(t.height)||0;const r=we(e),a=r?e.offsetWidth:o,s=r?e.offsetHeight:n,i=Dt(o)!==a||Dt(n)!==s;return i&&(o=a,n=s),{width:o,height:n,$:i}}function fn(e){return he(e)?e:e.contextElement}function Ue(e){const t=fn(e);if(!we(t))return ke(1);const o=t.getBoundingClientRect(),{width:n,height:r,$:a}=qr(t);let s=(a?Dt(o.width):o.width)/n,i=(a?Dt(o.height):o.height)/r;return(!s||!Number.isFinite(s))&&(s=1),(!i||!Number.isFinite(i))&&(i=1),{x:s,y:i}}const af=ke(0);function Wr(e){const t=de(e);return!pn()||!t.visualViewport?af:{x:t.visualViewport.offsetLeft,y:t.visualViewport.offsetTop}}function sf(e,t,o){return t===void 0&&(t=!1),!o||t&&o!==de(e)?!1:t}function Le(e,t,o,n){t===void 0&&(t=!1),o===void 0&&(o=!1);const r=e.getBoundingClientRect(),a=fn(e);let s=ke(1);t&&(n?he(n)&&(s=Ue(n)):s=Ue(e));const i=sf(a,o,n)?Wr(a):ke(0);let l=(r.left+i.x)/s.x,d=(r.top+i.y)/s.y,p=r.width/s.x,u=r.height/s.y;if(a){const h=de(a),m=n&&he(n)?de(n):n;let x=h,v=Ho(x);for(;v&&n&&m!==x;){const g=Ue(v),k=v.getBoundingClientRect(),w=ye(v),b=k.left+(v.clientLeft+parseFloat(w.paddingLeft))*g.x,_=k.top+(v.clientTop+parseFloat(w.paddingTop))*g.y;l*=g.x,d*=g.y,p*=g.x,u*=g.y,l+=b,d+=_,x=de(v),v=Ho(x)}}return jt({width:p,height:u,x:l,y:d})}function eo(e,t){const o=Jt(e).scrollLeft;return t?t.left+o:Le(_e(e)).left+o}function Ur(e,t){const o=e.getBoundingClientRect(),n=o.left+t.scrollLeft-eo(e,o),r=o.top+t.scrollTop;return{x:n,y:r}}function cf(e){let{elements:t,rect:o,offsetParent:n,strategy:r}=e;const a=r==="fixed",s=_e(n),i=t?Qt(t.floating):!1;if(n===s||i&&a)return o;let l={scrollLeft:0,scrollTop:0},d=ke(1);const p=ke(0),u=we(n);if((u||!u&&!a)&&((tt(n)!=="body"||gt(s))&&(l=Jt(n)),we(n))){const m=Le(n);d=Ue(n),p.x=m.x+n.clientLeft,p.y=m.y+n.clientTop}const h=s&&!u&&!a?Ur(s,l):ke(0);return{width:o.width*d.x,height:o.height*d.y,x:o.x*d.x-l.scrollLeft*d.x+p.x+h.x,y:o.y*d.y-l.scrollTop*d.y+p.y+h.y}}function lf(e){return Array.from(e.getClientRects())}function df(e){const t=_e(e),o=Jt(e),n=e.ownerDocument.body,r=le(t.scrollWidth,t.clientWidth,n.scrollWidth,n.clientWidth),a=le(t.scrollHeight,t.clientHeight,n.scrollHeight,n.clientHeight);let s=-o.scrollLeft+eo(e);const i=-o.scrollTop;return ye(n).direction==="rtl"&&(s+=le(t.clientWidth,n.clientWidth)-r),{width:r,height:a,x:s,y:i}}const sr=25;function uf(e,t){const o=de(e),n=_e(e),r=o.visualViewport;let a=n.clientWidth,s=n.clientHeight,i=0,l=0;if(r){a=r.width,s=r.height;const p=pn();(!p||p&&t==="fixed")&&(i=r.offsetLeft,l=r.offsetTop)}const d=eo(n);if(d<=0){const p=n.ownerDocument,u=p.body,h=getComputedStyle(u),m=p.compatMode==="CSS1Compat"&&parseFloat(h.marginLeft)+parseFloat(h.marginRight)||0,x=Math.abs(n.clientWidth-u.clientWidth-m);x<=sr&&(a-=x)}else d<=sr&&(a+=d);return{width:a,height:s,x:i,y:l}}const pf=new Set(["absolute","fixed"]);function ff(e,t){const o=Le(e,!0,t==="fixed"),n=o.top+e.clientTop,r=o.left+e.clientLeft,a=we(e)?Ue(e):ke(1),s=e.clientWidth*a.x,i=e.clientHeight*a.y,l=r*a.x,d=n*a.y;return{width:s,height:i,x:l,y:d}}function cr(e,t,o){let n;if(t==="viewport")n=uf(e,o);else if(t==="document")n=df(_e(e));else if(he(t))n=ff(t,o);else{const r=Wr(e);n={x:t.x-r.x,y:t.y-r.y,width:t.width,height:t.height}}return jt(n)}function Kr(e,t){const o=Te(e);return o===t||!he(o)||Ge(o)?!1:ye(o).position==="fixed"||Kr(o,t)}function hf(e,t){const o=t.get(e);if(o)return o;let n=ut(e,[],!1).filter(i=>he(i)&&tt(i)!=="body"),r=null;const a=ye(e).position==="fixed";let s=a?Te(e):e;for(;he(s)&&!Ge(s);){const i=ye(s),l=un(s);!l&&i.position==="fixed"&&(r=null),(a?!l&&!r:!l&&i.position==="static"&&!!r&&pf.has(r.position)||gt(s)&&!l&&Kr(e,s))?n=n.filter(p=>p!==s):r=i,s=Te(s)}return t.set(e,n),n}function yf(e){let{element:t,boundary:o,rootBoundary:n,strategy:r}=e;const s=[...o==="clippingAncestors"?Qt(t)?[]:hf(t,this._c):[].concat(o),n],i=s[0],l=s.reduce((d,p)=>{const u=cr(t,p,r);return d.top=le(u.top,d.top),d.right=Ne(u.right,d.right),d.bottom=Ne(u.bottom,d.bottom),d.left=le(u.left,d.left),d},cr(t,i,r));return{width:l.right-l.left,height:l.bottom-l.top,x:l.left,y:l.top}}function mf(e){const{width:t,height:o}=qr(e);return{width:t,height:o}}function vf(e,t,o){const n=we(t),r=_e(t),a=o==="fixed",s=Le(e,!0,a,t);let i={scrollLeft:0,scrollTop:0};const l=ke(0);function d(){l.x=eo(r)}if(n||!n&&!a)if((tt(t)!=="body"||gt(r))&&(i=Jt(t)),n){const m=Le(t,!0,a,t);l.x=m.x+t.clientLeft,l.y=m.y+t.clientTop}else r&&d();a&&!n&&r&&d();const p=r&&!n&&!a?Ur(r,i):ke(0),u=s.left+i.scrollLeft-l.x-p.x,h=s.top+i.scrollTop-l.y-p.y;return{x:u,y:h,width:s.width,height:s.height}}function Po(e){return ye(e).position==="static"}function ir(e,t){if(!we(e)||ye(e).position==="fixed")return null;if(t)return t(e);let o=e.offsetParent;return _e(e)===o&&(o=o.ownerDocument.body),o}function Gr(e,t){const o=de(e);if(Qt(e))return o;if(!we(e)){let r=Te(e);for(;r&&!Ge(r);){if(he(r)&&!Po(r))return r;r=Te(r)}return o}let n=ir(e,t);for(;n&&Q2(n)&&Po(n);)n=ir(n,t);return n&&Ge(n)&&Po(n)&&!un(n)?o:n||nf(e)||o}const gf=async function(e){const t=this.getOffsetParent||Gr,o=this.getDimensions,n=await o(e.floating);return{reference:vf(e.reference,await t(e.floating),e.strategy),floating:{x:0,y:0,width:n.width,height:n.height}}};function xf(e){return ye(e).direction==="rtl"}const kf={convertOffsetParentRelativeRectToViewportRelativeRect:cf,getDocumentElement:_e,getClippingRect:yf,getOffsetParent:Gr,getElementRects:gf,getClientRects:lf,getDimensions:mf,getScale:Ue,isElement:he,isRTL:xf};function Yr(e,t){return e.x===t.x&&e.y===t.y&&e.width===t.width&&e.height===t.height}function wf(e,t){let o=null,n;const r=_e(e);function a(){var i;clearTimeout(n),(i=o)==null||i.disconnect(),o=null}function s(i,l){i===void 0&&(i=!1),l===void 0&&(l=1),a();const d=e.getBoundingClientRect(),{left:p,top:u,width:h,height:m}=d;if(i||t(),!h||!m)return;const x=Nt(u),v=Nt(r.clientWidth-(p+h)),g=Nt(r.clientHeight-(u+m)),k=Nt(p),b={rootMargin:-x+"px "+-v+"px "+-g+"px "+-k+"px",threshold:le(0,Ne(1,l))||1};let _=!0;function M(E){const S=E[0].intersectionRatio;if(S!==l){if(!_)return s();S?s(!1,S):n=setTimeout(()=>{s(!1,1e-7)},1e3)}S===1&&!Yr(d,e.getBoundingClientRect())&&s(),_=!1}try{o=new IntersectionObserver(M,{...b,root:r.ownerDocument})}catch{o=new IntersectionObserver(M,b)}o.observe(e)}return s(!0),a}function bf(e,t,o,n){n===void 0&&(n={});const{ancestorScroll:r=!0,ancestorResize:a=!0,elementResize:s=typeof ResizeObserver=="function",layoutShift:i=typeof IntersectionObserver=="function",animationFrame:l=!1}=n,d=fn(e),p=r||a?[...d?ut(d):[],...ut(t)]:[];p.forEach(k=>{r&&k.addEventListener("scroll",o,{passive:!0}),a&&k.addEventListener("resize",o)});const u=d&&i?wf(d,o):null;let h=-1,m=null;s&&(m=new ResizeObserver(k=>{let[w]=k;w&&w.target===d&&m&&(m.unobserve(t),cancelAnimationFrame(h),h=requestAnimationFrame(()=>{var b;(b=m)==null||b.observe(t)})),o()}),d&&!l&&m.observe(d),m.observe(t));let x,v=l?Le(e):null;l&&g();function g(){const k=Le(e);v&&!Yr(v,k)&&o(),v=k,x=requestAnimationFrame(g)}return o(),()=>{var k;p.forEach(w=>{r&&w.removeEventListener("scroll",o),a&&w.removeEventListener("resize",o)}),u==null||u(),(k=m)==null||k.disconnect(),m=null,l&&cancelAnimationFrame(x)}}const _f=U2,Mf=K2,Cf=B2,Sf=Y2,Ef=q2,lr=H2,Rf=G2,Pf=(e,t,o)=>{const n=new Map,r={platform:kf,...o},a={...r.platform,_c:n};return z2(e,t,{...r,platform:a})};var Af=typeof document<"u",Nf=function(){},It=Af?c.useLayoutEffect:Nf;function Lt(e,t){if(e===t)return!0;if(typeof e!=typeof t)return!1;if(typeof e=="function"&&e.toString()===t.toString())return!0;let o,n,r;if(e&&t&&typeof e=="object"){if(Array.isArray(e)){if(o=e.length,o!==t.length)return!1;for(n=o;n--!==0;)if(!Lt(e[n],t[n]))return!1;return!0}if(r=Object.keys(e),o=r.length,o!==Object.keys(t).length)return!1;for(n=o;n--!==0;)if(!{}.hasOwnProperty.call(t,r[n]))return!1;for(n=o;n--!==0;){const a=r[n];if(!(a==="_owner"&&e.$$typeof)&&!Lt(e[a],t[a]))return!1}return!0}return e!==e&&t!==t}function Xr(e){return typeof window>"u"?1:(e.ownerDocument.defaultView||window).devicePixelRatio||1}function dr(e,t){const o=Xr(e);return Math.round(t*o)/o}function Ao(e){const t=c.useRef(e);return It(()=>{t.current=e}),t}function Tf(e){e===void 0&&(e={});const{placement:t="bottom",strategy:o="absolute",middleware:n=[],platform:r,elements:{reference:a,floating:s}={},transform:i=!0,whileElementsMounted:l,open:d}=e,[p,u]=c.useState({x:0,y:0,strategy:o,placement:t,middlewareData:{},isPositioned:!1}),[h,m]=c.useState(n);Lt(h,n)||m(n);const[x,v]=c.useState(null),[g,k]=c.useState(null),w=c.useCallback($=>{$!==E.current&&(E.current=$,v($))},[]),b=c.useCallback($=>{$!==S.current&&(S.current=$,k($))},[]),_=a||x,M=s||g,E=c.useRef(null),S=c.useRef(null),N=c.useRef(p),T=l!=null,I=Ao(l),D=Ao(r),F=Ao(d),V=c.useCallback(()=>{if(!E.current||!S.current)return;const $={placement:t,strategy:o,middleware:h};D.current&&($.platform=D.current),Pf(E.current,S.current,$).then(P=>{const B={...P,isPositioned:F.current!==!1};R.current&&!Lt(N.current,B)&&(N.current=B,mt.flushSync(()=>{u(B)}))})},[h,t,o,D,F]);It(()=>{d===!1&&N.current.isPositioned&&(N.current.isPositioned=!1,u($=>({...$,isPositioned:!1})))},[d]);const R=c.useRef(!1);It(()=>(R.current=!0,()=>{R.current=!1}),[]),It(()=>{if(_&&(E.current=_),M&&(S.current=M),_&&M){if(I.current)return I.current(_,M,V);V()}},[_,M,V,I,T]);const H=c.useMemo(()=>({reference:E,floating:S,setReference:w,setFloating:b}),[w,b]),O=c.useMemo(()=>({reference:_,floating:M}),[_,M]),z=c.useMemo(()=>{const $={position:o,left:0,top:0};if(!O.floating)return $;const P=dr(O.floating,p.x),B=dr(O.floating,p.y);return i?{...$,transform:"translate("+P+"px, "+B+"px)",...Xr(O.floating)>=1.5&&{willChange:"transform"}}:{position:o,left:P,top:B}},[o,i,O.floating,p.x,p.y]);return c.useMemo(()=>({...p,update:V,refs:H,elements:O,floatingStyles:z}),[p,V,H,O,z])}const $f=e=>{function t(o){return{}.hasOwnProperty.call(o,"current")}return{name:"arrow",options:e,fn(o){const{element:n,padding:r}=typeof e=="function"?e(o):e;return n&&t(n)?n.current!=null?lr({element:n.current,padding:r}).fn(o):{}:n?lr({element:n,padding:r}).fn(o):{}}}},If=(e,t)=>({..._f(e),options:[e,t]}),Df=(e,t)=>({...Mf(e),options:[e,t]}),Of=(e,t)=>({...Rf(e),options:[e,t]}),jf=(e,t)=>({...Cf(e),options:[e,t]}),Lf=(e,t)=>({...Sf(e),options:[e,t]}),Ff=(e,t)=>({...Ef(e),options:[e,t]}),Vf=(e,t)=>({...$f(e),options:[e,t]});var zf="Arrow",Zr=c.forwardRef((e,t)=>{const{children:o,width:n=10,height:r=5,...a}=e;return f.jsx(A.svg,{...a,ref:t,width:n,height:r,viewBox:"0 0 30 10",preserveAspectRatio:"none",children:e.asChild?o:f.jsx("polygon",{points:"0,0 30,0 15,10"})})});Zr.displayName=zf;var Hf=Zr;function xt(e){const[t,o]=c.useState(void 0);return Z(()=>{if(e){o({width:e.offsetWidth,height:e.offsetHeight});const n=new ResizeObserver(r=>{if(!Array.isArray(r)||!r.length)return;const a=r[0];let s,i;if("borderBoxSize"in a){const l=a.borderBoxSize,d=Array.isArray(l)?l[0]:l;s=d.inlineSize,i=d.blockSize}else s=e.offsetWidth,i=e.offsetHeight;o({width:s,height:i})});return n.observe(e,{box:"border-box"}),()=>n.unobserve(e)}else o(void 0)},[e]),t}var hn="Popper",[Qr,$e]=J(hn),[Bf,Jr]=Qr(hn),ea=e=>{const{__scopePopper:t,children:o}=e,[n,r]=c.useState(null);return f.jsx(Bf,{scope:t,anchor:n,onAnchorChange:r,children:o})};ea.displayName=hn;var ta="PopperAnchor",oa=c.forwardRef((e,t)=>{const{__scopePopper:o,virtualRef:n,...r}=e,a=Jr(ta,o),s=c.useRef(null),i=j(t,s),l=c.useRef(null);return c.useEffect(()=>{const d=l.current;l.current=(n==null?void 0:n.current)||s.current,d!==l.current&&a.onAnchorChange(l.current)}),n?null:f.jsx(A.div,{...r,ref:i})});oa.displayName=ta;var yn="PopperContent",[qf,Wf]=Qr(yn),na=c.forwardRef((e,t)=>{var L,W,G,q,U,K;const{__scopePopper:o,side:n="bottom",sideOffset:r=0,align:a="center",alignOffset:s=0,arrowPadding:i=0,avoidCollisions:l=!0,collisionBoundary:d=[],collisionPadding:p=0,sticky:u="partial",hideWhenDetached:h=!1,updatePositionStrategy:m="optimized",onPlaced:x,...v}=e,g=Jr(yn,o),[k,w]=c.useState(null),b=j(t,ie=>w(ie)),[_,M]=c.useState(null),E=xt(_),S=(E==null?void 0:E.width)??0,N=(E==null?void 0:E.height)??0,T=n+(a!=="center"?"-"+a:""),I=typeof p=="number"?p:{top:0,right:0,bottom:0,left:0,...p},D=Array.isArray(d)?d:[d],F=D.length>0,V={padding:I,boundary:D.filter(Kf),altBoundary:F},{refs:R,floatingStyles:H,placement:O,isPositioned:z,middlewareData:$}=Tf({strategy:"fixed",placement:T,whileElementsMounted:(...ie)=>bf(...ie,{animationFrame:m==="always"}),elements:{reference:g.anchor},middleware:[If({mainAxis:r+N,alignmentAxis:s}),l&&Df({mainAxis:!0,crossAxis:!1,limiter:u==="partial"?Of():void 0,...V}),l&&jf({...V}),Lf({...V,apply:({elements:ie,rects:ge,availableWidth:at,availableHeight:st})=>{const{width:ct,height:el}=ge.reference,Rt=ie.floating.style;Rt.setProperty("--radix-popper-available-width",`${at}px`),Rt.setProperty("--radix-popper-available-height",`${st}px`),Rt.setProperty("--radix-popper-anchor-width",`${ct}px`),Rt.setProperty("--radix-popper-anchor-height",`${el}px`)}}),_&&Vf({element:_,padding:i}),Gf({arrowWidth:S,arrowHeight:N}),h&&Ff({strategy:"referenceHidden",...V})]}),[P,B]=sa(O),Y=X(x);Z(()=>{z&&(Y==null||Y())},[z,Y]);const te=(L=$.arrow)==null?void 0:L.x,ae=(W=$.arrow)==null?void 0:W.y,ne=((G=$.arrow)==null?void 0:G.centerOffset)!==0,[Ce,ce]=c.useState();return Z(()=>{k&&ce(window.getComputedStyle(k).zIndex)},[k]),f.jsx("div",{ref:R.setFloating,"data-radix-popper-content-wrapper":"",style:{...H,transform:z?H.transform:"translate(0, -200%)",minWidth:"max-content",zIndex:Ce,"--radix-popper-transform-origin":[(q=$.transformOrigin)==null?void 0:q.x,(U=$.transformOrigin)==null?void 0:U.y].join(" "),...((K=$.hide)==null?void 0:K.referenceHidden)&&{visibility:"hidden",pointerEvents:"none"}},dir:e.dir,children:f.jsx(qf,{scope:o,placedSide:P,onArrowChange:M,arrowX:te,arrowY:ae,shouldHideArrow:ne,children:f.jsx(A.div,{"data-side":P,"data-align":B,...v,ref:b,style:{...v.style,animation:z?void 0:"none"}})})})});na.displayName=yn;var ra="PopperArrow",Uf={top:"bottom",right:"left",bottom:"top",left:"right"},aa=c.forwardRef(function(t,o){const{__scopePopper:n,...r}=t,a=Wf(ra,n),s=Uf[a.placedSide];return f.jsx("span",{ref:a.onArrowChange,style:{position:"absolute",left:a.arrowX,top:a.arrowY,[s]:0,transformOrigin:{top:"",right:"0 0",bottom:"center 0",left:"100% 0"}[a.placedSide],transform:{top:"translateY(100%)",right:"translateY(50%) rotate(90deg) translateX(-50%)",bottom:"rotate(180deg)",left:"translateY(50%) rotate(-90deg) translateX(50%)"}[a.placedSide],visibility:a.shouldHideArrow?"hidden":void 0},children:f.jsx(Hf,{...r,ref:o,style:{...r.style,display:"block"}})})});aa.displayName=ra;function Kf(e){return e!==null}var Gf=e=>({name:"transformOrigin",options:e,fn(t){var g,k,w;const{placement:o,rects:n,middlewareData:r}=t,s=((g=r.arrow)==null?void 0:g.centerOffset)!==0,i=s?0:e.arrowWidth,l=s?0:e.arrowHeight,[d,p]=sa(o),u={start:"0%",center:"50%",end:"100%"}[p],h=(((k=r.arrow)==null?void 0:k.x)??0)+i/2,m=(((w=r.arrow)==null?void 0:w.y)??0)+l/2;let x="",v="";return d==="bottom"?(x=s?u:`${h}px`,v=`${-l}px`):d==="top"?(x=s?u:`${h}px`,v=`${n.floating.height+l}px`):d==="right"?(x=`${-l}px`,v=s?u:`${m}px`):d==="left"&&(x=`${n.floating.width+l}px`,v=s?u:`${m}px`),{data:{x,y:v}}}});function sa(e){const[t,o="center"]=e.split("-");return[t,o]}var to=ea,kt=oa,oo=na,no=aa,Yf=Symbol("radix.slottable");function Xf(e){const t=({children:o})=>f.jsx(f.Fragment,{children:o});return t.displayName=`${e}.Slottable`,t.__radixId=Yf,t}var[ro]=J("Tooltip",[$e]),ao=$e(),ca="TooltipProvider",Zf=700,Bo="tooltip.open",[Qf,mn]=ro(ca),ia=e=>{const{__scopeTooltip:t,delayDuration:o=Zf,skipDelayDuration:n=300,disableHoverableContent:r=!1,children:a}=e,s=c.useRef(!0),i=c.useRef(!1),l=c.useRef(0);return c.useEffect(()=>{const d=l.current;return()=>window.clearTimeout(d)},[]),f.jsx(Qf,{scope:t,isOpenDelayedRef:s,delayDuration:o,onOpen:c.useCallback(()=>{window.clearTimeout(l.current),s.current=!1},[]),onClose:c.useCallback(()=>{window.clearTimeout(l.current),l.current=window.setTimeout(()=>s.current=!0,n)},[n]),isPointerInTransitRef:i,onPointerInTransitChange:c.useCallback(d=>{i.current=d},[]),disableHoverableContent:r,children:a})};ia.displayName=ca;var pt="Tooltip",[Jf,so]=ro(pt),la=e=>{const{__scopeTooltip:t,children:o,open:n,defaultOpen:r,onOpenChange:a,disableHoverableContent:s,delayDuration:i}=e,l=mn(pt,e.__scopeTooltip),d=ao(t),[p,u]=c.useState(null),h=se(),m=c.useRef(0),x=s??l.disableHoverableContent,v=i??l.delayDuration,g=c.useRef(!1),[k,w]=oe({prop:n,defaultProp:r??!1,onChange:S=>{S?(l.onOpen(),document.dispatchEvent(new CustomEvent(Bo))):l.onClose(),a==null||a(S)},caller:pt}),b=c.useMemo(()=>k?g.current?"delayed-open":"instant-open":"closed",[k]),_=c.useCallback(()=>{window.clearTimeout(m.current),m.current=0,g.current=!1,w(!0)},[w]),M=c.useCallback(()=>{window.clearTimeout(m.current),m.current=0,w(!1)},[w]),E=c.useCallback(()=>{window.clearTimeout(m.current),m.current=window.setTimeout(()=>{g.current=!0,w(!0),m.current=0},v)},[v,w]);return c.useEffect(()=>()=>{m.current&&(window.clearTimeout(m.current),m.current=0)},[]),f.jsx(to,{...d,children:f.jsx(Jf,{scope:t,contentId:h,open:k,stateAttribute:b,trigger:p,onTriggerChange:u,onTriggerEnter:c.useCallback(()=>{l.isOpenDelayedRef.current?E():_()},[l.isOpenDelayedRef,E,_]),onTriggerLeave:c.useCallback(()=>{x?M():(window.clearTimeout(m.current),m.current=0)},[M,x]),onOpen:_,onClose:M,disableHoverableContent:x,children:o})})};la.displayName=pt;var qo="TooltipTrigger",da=c.forwardRef((e,t)=>{const{__scopeTooltip:o,...n}=e,r=so(qo,o),a=mn(qo,o),s=ao(o),i=c.useRef(null),l=j(t,i,r.onTriggerChange),d=c.useRef(!1),p=c.useRef(!1),u=c.useCallback(()=>d.current=!1,[]);return c.useEffect(()=>()=>document.removeEventListener("pointerup",u),[u]),f.jsx(kt,{asChild:!0,...s,children:f.jsx(A.button,{"aria-describedby":r.open?r.contentId:void 0,"data-state":r.stateAttribute,...n,ref:l,onPointerMove:C(e.onPointerMove,h=>{h.pointerType!=="touch"&&!p.current&&!a.isPointerInTransitRef.current&&(r.onTriggerEnter(),p.current=!0)}),onPointerLeave:C(e.onPointerLeave,()=>{r.onTriggerLeave(),p.current=!1}),onPointerDown:C(e.onPointerDown,()=>{r.open&&r.onClose(),d.current=!0,document.addEventListener("pointerup",u,{once:!0})}),onFocus:C(e.onFocus,()=>{d.current||r.onOpen()}),onBlur:C(e.onBlur,r.onClose),onClick:C(e.onClick,r.onClose)})})});da.displayName=qo;var eh="TooltipPortal",[O3,th]=ro(eh,{forceMount:void 0}),Ye="TooltipContent",ua=c.forwardRef((e,t)=>{const o=th(Ye,e.__scopeTooltip),{forceMount:n=o.forceMount,side:r="top",...a}=e,s=so(Ye,e.__scopeTooltip);return f.jsx(ee,{present:n||s.open,children:s.disableHoverableContent?f.jsx(pa,{side:r,...a,ref:t}):f.jsx(oh,{side:r,...a,ref:t})})}),oh=c.forwardRef((e,t)=>{const o=so(Ye,e.__scopeTooltip),n=mn(Ye,e.__scopeTooltip),r=c.useRef(null),a=j(t,r),[s,i]=c.useState(null),{trigger:l,onClose:d}=o,p=r.current,{onPointerInTransitChange:u}=n,h=c.useCallback(()=>{i(null),u(!1)},[u]),m=c.useCallback((x,v)=>{const g=x.currentTarget,k={x:x.clientX,y:x.clientY},w=ch(k,g.getBoundingClientRect()),b=ih(k,w),_=lh(v.getBoundingClientRect()),M=uh([...b,..._]);i(M),u(!0)},[u]);return c.useEffect(()=>()=>h(),[h]),c.useEffect(()=>{if(l&&p){const x=g=>m(g,p),v=g=>m(g,l);return l.addEventListener("pointerleave",x),p.addEventListener("pointerleave",v),()=>{l.removeEventListener("pointerleave",x),p.removeEventListener("pointerleave",v)}}},[l,p,m,h]),c.useEffect(()=>{if(s){const x=v=>{const g=v.target,k={x:v.clientX,y:v.clientY},w=(l==null?void 0:l.contains(g))||(p==null?void 0:p.contains(g)),b=!dh(k,s);w?h():b&&(h(),d())};return document.addEventListener("pointermove",x),()=>document.removeEventListener("pointermove",x)}},[l,p,s,d,h]),f.jsx(pa,{...e,ref:a})}),[nh,rh]=ro(pt,{isInside:!1}),ah=Xf("TooltipContent"),pa=c.forwardRef((e,t)=>{const{__scopeTooltip:o,children:n,"aria-label":r,onEscapeKeyDown:a,onPointerDownOutside:s,...i}=e,l=so(Ye,o),d=ao(o),{onClose:p}=l;return c.useEffect(()=>(document.addEventListener(Bo,p),()=>document.removeEventListener(Bo,p)),[p]),c.useEffect(()=>{if(l.trigger){const u=h=>{const m=h.target;m!=null&&m.contains(l.trigger)&&p()};return window.addEventListener("scroll",u,{capture:!0}),()=>window.removeEventListener("scroll",u,{capture:!0})}},[l.trigger,p]),f.jsx(He,{asChild:!0,disableOutsidePointerEvents:!1,onEscapeKeyDown:a,onPointerDownOutside:s,onFocusOutside:u=>u.preventDefault(),onDismiss:p,children:f.jsxs(oo,{"data-state":l.stateAttribute,...d,...i,ref:t,style:{...i.style,"--radix-tooltip-content-transform-origin":"var(--radix-popper-transform-origin)","--radix-tooltip-content-available-width":"var(--radix-popper-available-width)","--radix-tooltip-content-available-height":"var(--radix-popper-available-height)","--radix-tooltip-trigger-width":"var(--radix-popper-anchor-width)","--radix-tooltip-trigger-height":"var(--radix-popper-anchor-height)"},children:[f.jsx(ah,{children:n}),f.jsx(nh,{scope:o,isInside:!0,children:f.jsx(Il,{id:l.contentId,role:"tooltip",children:r||n})})]})})});ua.displayName=Ye;var fa="TooltipArrow",sh=c.forwardRef((e,t)=>{const{__scopeTooltip:o,...n}=e,r=ao(o);return rh(fa,o).isInside?null:f.jsx(no,{...r,...n,ref:t})});sh.displayName=fa;function ch(e,t){const o=Math.abs(t.top-e.y),n=Math.abs(t.bottom-e.y),r=Math.abs(t.right-e.x),a=Math.abs(t.left-e.x);switch(Math.min(o,n,r,a)){case a:return"left";case r:return"right";case o:return"top";case n:return"bottom";default:throw new Error("unreachable")}}function ih(e,t,o=5){const n=[];switch(t){case"top":n.push({x:e.x-o,y:e.y+o},{x:e.x+o,y:e.y+o});break;case"bottom":n.push({x:e.x-o,y:e.y-o},{x:e.x+o,y:e.y-o});break;case"left":n.push({x:e.x+o,y:e.y-o},{x:e.x+o,y:e.y+o});break;case"right":n.push({x:e.x-o,y:e.y-o},{x:e.x-o,y:e.y+o});break}return n}function lh(e){const{top:t,right:o,bottom:n,left:r}=e;return[{x:r,y:t},{x:o,y:t},{x:o,y:n},{x:r,y:n}]}function dh(e,t){const{x:o,y:n}=e;let r=!1;for(let a=0,s=t.length-1;a<t.length;s=a++){const i=t[a],l=t[s],d=i.x,p=i.y,u=l.x,h=l.y;p>n!=h>n&&o<(u-d)*(n-p)/(h-p)+d&&(r=!r)}return r}function uh(e){const t=e.slice();return t.sort((o,n)=>o.x<n.x?-1:o.x>n.x?1:o.y<n.y?-1:o.y>n.y?1:0),ph(t)}function ph(e){if(e.length<=1)return e.slice();const t=[];for(let n=0;n<e.length;n++){const r=e[n];for(;t.length>=2;){const a=t[t.length-1],s=t[t.length-2];if((a.x-s.x)*(r.y-s.y)>=(a.y-s.y)*(r.x-s.x))t.pop();else break}t.push(r)}t.pop();const o=[];for(let n=e.length-1;n>=0;n--){const r=e[n];for(;o.length>=2;){const a=o[o.length-1],s=o[o.length-2];if((a.x-s.x)*(r.y-s.y)>=(a.y-s.y)*(r.x-s.x))o.pop();else break}o.push(r)}return o.pop(),t.length===1&&o.length===1&&t[0].x===o[0].x&&t[0].y===o[0].y?t:t.concat(o)}var j3=ia,L3=la,F3=da,V3=ua,fh=Symbol.for("react.lazy"),Ft=on[" use ".trim().toString()];function hh(e){return typeof e=="object"&&e!==null&&"then"in e}function ha(e){return e!=null&&typeof e=="object"&&"$$typeof"in e&&e.$$typeof===fh&&"_payload"in e&&hh(e._payload)}function wt(e){const t=yh(e),o=c.forwardRef((n,r)=>{let{children:a,...s}=n;ha(a)&&typeof Ft=="function"&&(a=Ft(a._payload));const i=c.Children.toArray(a),l=i.find(vh);if(l){const d=l.props.children,p=i.map(u=>u===l?c.Children.count(d)>1?c.Children.only(null):c.isValidElement(d)?d.props.children:null:u);return f.jsx(t,{...s,ref:r,children:c.isValidElement(d)?c.cloneElement(d,void 0,p):null})}return f.jsx(t,{...s,ref:r,children:a})});return o.displayName=`${e}.Slot`,o}var z3=wt("Slot");function yh(e){const t=c.forwardRef((o,n)=>{let{children:r,...a}=o;if(ha(r)&&typeof Ft=="function"&&(r=Ft(r._payload)),c.isValidElement(r)){const s=xh(r),i=gh(a,r.props);return r.type!==c.Fragment&&(i.ref=n?be(n,s):s),c.cloneElement(r,i)}return c.Children.count(r)>1?c.Children.only(null):null});return t.displayName=`${e}.SlotClone`,t}var mh=Symbol("radix.slottable");function vh(e){return c.isValidElement(e)&&typeof e.type=="function"&&"__radixId"in e.type&&e.type.__radixId===mh}function gh(e,t){const o={...t};for(const n in t){const r=e[n],a=t[n];/^on[A-Z]/.test(n)?r&&a?o[n]=(...i)=>{const l=a(...i);return r(...i),l}:r&&(o[n]=r):n==="style"?o[n]={...r,...a}:n==="className"&&(o[n]=[r,a].filter(Boolean).join(" "))}return{...e,...o}}function xh(e){var n,r;let t=(n=Object.getOwnPropertyDescriptor(e.props,"ref"))==null?void 0:n.get,o=t&&"isReactWarning"in t&&t.isReactWarning;return o?e.ref:(t=(r=Object.getOwnPropertyDescriptor(e,"ref"))==null?void 0:r.get,o=t&&"isReactWarning"in t&&t.isReactWarning,o?e.props.ref:e.props.ref||e.ref)}function bt(e){const t=c.useRef({value:e,previous:e});return c.useMemo(()=>(t.current.value!==e&&(t.current.previous=t.current.value,t.current.value=e),t.current.previous),[e])}var co="Switch",[kh]=J(co),[wh,bh]=kh(co),ya=c.forwardRef((e,t)=>{const{__scopeSwitch:o,name:n,checked:r,defaultChecked:a,required:s,disabled:i,value:l="on",onCheckedChange:d,form:p,...u}=e,[h,m]=c.useState(null),x=j(t,b=>m(b)),v=c.useRef(!1),g=h?p||!!h.closest("form"):!0,[k,w]=oe({prop:r,defaultProp:a??!1,onChange:d,caller:co});return f.jsxs(wh,{scope:o,checked:k,disabled:i,children:[f.jsx(A.button,{type:"button",role:"switch","aria-checked":k,"aria-required":s,"data-state":xa(k),"data-disabled":i?"":void 0,disabled:i,value:l,...u,ref:x,onClick:C(e.onClick,b=>{w(_=>!_),g&&(v.current=b.isPropagationStopped(),v.current||b.stopPropagation())})}),g&&f.jsx(ga,{control:h,bubbles:!v.current,name:n,value:l,checked:k,required:s,disabled:i,form:p,style:{transform:"translateX(-100%)"}})]})});ya.displayName=co;var ma="SwitchThumb",va=c.forwardRef((e,t)=>{const{__scopeSwitch:o,...n}=e,r=bh(ma,o);return f.jsx(A.span,{"data-state":xa(r.checked),"data-disabled":r.disabled?"":void 0,...n,ref:t})});va.displayName=ma;var _h="SwitchBubbleInput",ga=c.forwardRef(({__scopeSwitch:e,control:t,checked:o,bubbles:n=!0,...r},a)=>{const s=c.useRef(null),i=j(s,a),l=bt(o),d=xt(t);return c.useEffect(()=>{const p=s.current;if(!p)return;const u=window.HTMLInputElement.prototype,m=Object.getOwnPropertyDescriptor(u,"checked").set;if(l!==o&&m){const x=new Event("click",{bubbles:n});m.call(p,o),p.dispatchEvent(x)}},[l,o,n]),f.jsx("input",{type:"checkbox","aria-hidden":!0,defaultChecked:o,...r,tabIndex:-1,ref:i,style:{...r.style,...d,position:"absolute",pointerEvents:"none",opacity:0,margin:0}})});ga.displayName=_h;function xa(e){return e?"checked":"unchecked"}var H3=ya,B3=va;function ft(e,[t,o]){return Math.min(o,Math.max(t,e))}var Mh=c.createContext(void 0);function Ie(e){const t=c.useContext(Mh);return e||t||"ltr"}var No=0;function io(){c.useEffect(()=>{const e=document.querySelectorAll("[data-radix-focus-guard]");return document.body.insertAdjacentElement("afterbegin",e[0]??ur()),document.body.insertAdjacentElement("beforeend",e[1]??ur()),No++,()=>{No===1&&document.querySelectorAll("[data-radix-focus-guard]").forEach(t=>t.remove()),No--}},[])}function ur(){const e=document.createElement("span");return e.setAttribute("data-radix-focus-guard",""),e.tabIndex=0,e.style.outline="none",e.style.opacity="0",e.style.position="fixed",e.style.pointerEvents="none",e}var To="focusScope.autoFocusOnMount",$o="focusScope.autoFocusOnUnmount",pr={bubbles:!1,cancelable:!0},Ch="FocusScope",_t=c.forwardRef((e,t)=>{const{loop:o=!1,trapped:n=!1,onMountAutoFocus:r,onUnmountAutoFocus:a,...s}=e,[i,l]=c.useState(null),d=X(r),p=X(a),u=c.useRef(null),h=j(t,v=>l(v)),m=c.useRef({paused:!1,pause(){this.paused=!0},resume(){this.paused=!1}}).current;c.useEffect(()=>{if(n){let v=function(b){if(m.paused||!i)return;const _=b.target;i.contains(_)?u.current=_:Pe(u.current,{select:!0})},g=function(b){if(m.paused||!i)return;const _=b.relatedTarget;_!==null&&(i.contains(_)||Pe(u.current,{select:!0}))},k=function(b){if(document.activeElement===document.body)for(const M of b)M.removedNodes.length>0&&Pe(i)};document.addEventListener("focusin",v),document.addEventListener("focusout",g);const w=new MutationObserver(k);return i&&w.observe(i,{childList:!0,subtree:!0}),()=>{document.removeEventListener("focusin",v),document.removeEventListener("focusout",g),w.disconnect()}}},[n,i,m.paused]),c.useEffect(()=>{if(i){hr.add(m);const v=document.activeElement;if(!i.contains(v)){const k=new CustomEvent(To,pr);i.addEventListener(To,d),i.dispatchEvent(k),k.defaultPrevented||(Sh(Nh(ka(i)),{select:!0}),document.activeElement===v&&Pe(i))}return()=>{i.removeEventListener(To,d),setTimeout(()=>{const k=new CustomEvent($o,pr);i.addEventListener($o,p),i.dispatchEvent(k),k.defaultPrevented||Pe(v??document.body,{select:!0}),i.removeEventListener($o,p),hr.remove(m)},0)}}},[i,d,p,m]);const x=c.useCallback(v=>{if(!o&&!n||m.paused)return;const g=v.key==="Tab"&&!v.altKey&&!v.ctrlKey&&!v.metaKey,k=document.activeElement;if(g&&k){const w=v.currentTarget,[b,_]=Eh(w);b&&_?!v.shiftKey&&k===_?(v.preventDefault(),o&&Pe(b,{select:!0})):v.shiftKey&&k===b&&(v.preventDefault(),o&&Pe(_,{select:!0})):k===w&&v.preventDefault()}},[o,n,m.paused]);return f.jsx(A.div,{tabIndex:-1,...s,ref:h,onKeyDown:x})});_t.displayName=Ch;function Sh(e,{select:t=!1}={}){const o=document.activeElement;for(const n of e)if(Pe(n,{select:t}),document.activeElement!==o)return}function Eh(e){const t=ka(e),o=fr(t,e),n=fr(t.reverse(),e);return[o,n]}function ka(e){const t=[],o=document.createTreeWalker(e,NodeFilter.SHOW_ELEMENT,{acceptNode:n=>{const r=n.tagName==="INPUT"&&n.type==="hidden";return n.disabled||n.hidden||r?NodeFilter.FILTER_SKIP:n.tabIndex>=0?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_SKIP}});for(;o.nextNode();)t.push(o.currentNode);return t}function fr(e,t){for(const o of e)if(!Rh(o,{upTo:t}))return o}function Rh(e,{upTo:t}){if(getComputedStyle(e).visibility==="hidden")return!0;for(;e;){if(t!==void 0&&e===t)return!1;if(getComputedStyle(e).display==="none")return!0;e=e.parentElement}return!1}function Ph(e){return e instanceof HTMLInputElement&&"select"in e}function Pe(e,{select:t=!1}={}){if(e&&e.focus){const o=document.activeElement;e.focus({preventScroll:!0}),e!==o&&Ph(e)&&t&&e.select()}}var hr=Ah();function Ah(){let e=[];return{add(t){const o=e[0];t!==o&&(o==null||o.pause()),e=yr(e,t),e.unshift(t)},remove(t){var o;e=yr(e,t),(o=e[0])==null||o.resume()}}}function yr(e,t){const o=[...e],n=o.indexOf(t);return n!==-1&&o.splice(n,1),o}function Nh(e){return e.filter(t=>t.tagName!=="A")}function Th(e){const t=$h(e),o=c.forwardRef((n,r)=>{const{children:a,...s}=n,i=c.Children.toArray(a),l=i.find(Dh);if(l){const d=l.props.children,p=i.map(u=>u===l?c.Children.count(d)>1?c.Children.only(null):c.isValidElement(d)?d.props.children:null:u);return f.jsx(t,{...s,ref:r,children:c.isValidElement(d)?c.cloneElement(d,void 0,p):null})}return f.jsx(t,{...s,ref:r,children:a})});return o.displayName=`${e}.Slot`,o}function $h(e){const t=c.forwardRef((o,n)=>{const{children:r,...a}=o;if(c.isValidElement(r)){const s=jh(r),i=Oh(a,r.props);return r.type!==c.Fragment&&(i.ref=n?be(n,s):s),c.cloneElement(r,i)}return c.Children.count(r)>1?c.Children.only(null):null});return t.displayName=`${e}.SlotClone`,t}var Ih=Symbol("radix.slottable");function Dh(e){return c.isValidElement(e)&&typeof e.type=="function"&&"__radixId"in e.type&&e.type.__radixId===Ih}function Oh(e,t){const o={...t};for(const n in t){const r=e[n],a=t[n];/^on[A-Z]/.test(n)?r&&a?o[n]=(...i)=>{const l=a(...i);return r(...i),l}:r&&(o[n]=r):n==="style"?o[n]={...r,...a}:n==="className"&&(o[n]=[r,a].filter(Boolean).join(" "))}return{...e,...o}}function jh(e){var n,r;let t=(n=Object.getOwnPropertyDescriptor(e.props,"ref"))==null?void 0:n.get,o=t&&"isReactWarning"in t&&t.isReactWarning;return o?e.ref:(t=(r=Object.getOwnPropertyDescriptor(e,"ref"))==null?void 0:r.get,o=t&&"isReactWarning"in t&&t.isReactWarning,o?e.props.ref:e.props.ref||e.ref)}var Lh=function(e){if(typeof document>"u")return null;var t=Array.isArray(e)?e[0]:e;return t.ownerDocument.body},We=new WeakMap,Tt=new WeakMap,$t={},Io=0,wa=function(e){return e&&(e.host||wa(e.parentNode))},Fh=function(e,t){return t.map(function(o){if(e.contains(o))return o;var n=wa(o);return n&&e.contains(n)?n:(console.error("aria-hidden",o,"in not contained inside",e,". Doing nothing"),null)}).filter(function(o){return!!o})},Vh=function(e,t,o,n){var r=Fh(t,Array.isArray(e)?e:[e]);$t[o]||($t[o]=new WeakMap);var a=$t[o],s=[],i=new Set,l=new Set(r),d=function(u){!u||i.has(u)||(i.add(u),d(u.parentNode))};r.forEach(d);var p=function(u){!u||l.has(u)||Array.prototype.forEach.call(u.children,function(h){if(i.has(h))p(h);else try{var m=h.getAttribute(n),x=m!==null&&m!=="false",v=(We.get(h)||0)+1,g=(a.get(h)||0)+1;We.set(h,v),a.set(h,g),s.push(h),v===1&&x&&Tt.set(h,!0),g===1&&h.setAttribute(o,"true"),x||h.setAttribute(n,"true")}catch(k){console.error("aria-hidden: cannot operate on ",h,k)}})};return p(t),i.clear(),Io++,function(){s.forEach(function(u){var h=We.get(u)-1,m=a.get(u)-1;We.set(u,h),a.set(u,m),h||(Tt.has(u)||u.removeAttribute(n),Tt.delete(u)),m||u.removeAttribute(o)}),Io--,Io||(We=new WeakMap,We=new WeakMap,Tt=new WeakMap,$t={})}},lo=function(e,t,o){o===void 0&&(o="data-aria-hidden");var n=Array.from(Array.isArray(e)?e:[e]),r=Lh(e);return r?(n.push.apply(n,Array.from(r.querySelectorAll("[aria-live], script"))),Vh(n,r,o,"aria-hidden")):function(){return null}},zh=[" ","Enter","ArrowUp","ArrowDown"],Hh=[" ","Enter"],Fe="Select",[uo,po,Bh]=Qe(Fe),[ot]=J(Fe,[Bh,$e]),fo=$e(),[qh,De]=ot(Fe),[Wh,Uh]=ot(Fe),ba=e=>{const{__scopeSelect:t,children:o,open:n,defaultOpen:r,onOpenChange:a,value:s,defaultValue:i,onValueChange:l,dir:d,name:p,autoComplete:u,disabled:h,required:m,form:x}=e,v=fo(t),[g,k]=c.useState(null),[w,b]=c.useState(null),[_,M]=c.useState(!1),E=Ie(d),[S,N]=oe({prop:n,defaultProp:r??!1,onChange:a,caller:Fe}),[T,I]=oe({prop:s,defaultProp:i,onChange:l,caller:Fe}),D=c.useRef(null),F=g?x||!!g.closest("form"):!0,[V,R]=c.useState(new Set),H=Array.from(V).map(O=>O.props.value).join(";");return f.jsx(to,{...v,children:f.jsxs(qh,{required:m,scope:t,trigger:g,onTriggerChange:k,valueNode:w,onValueNodeChange:b,valueNodeHasChildren:_,onValueNodeHasChildrenChange:M,contentId:se(),value:T,onValueChange:I,open:S,onOpenChange:N,dir:E,triggerPointerDownPosRef:D,disabled:h,children:[f.jsx(uo.Provider,{scope:t,children:f.jsx(Wh,{scope:e.__scopeSelect,onNativeOptionAdd:c.useCallback(O=>{R(z=>new Set(z).add(O))},[]),onNativeOptionRemove:c.useCallback(O=>{R(z=>{const $=new Set(z);return $.delete(O),$})},[]),children:o})}),F?f.jsxs(Ua,{"aria-hidden":!0,required:m,tabIndex:-1,name:p,autoComplete:u,value:T,onChange:O=>I(O.target.value),disabled:h,form:x,children:[T===void 0?f.jsx("option",{value:""}):null,Array.from(V)]},H):null]})})};ba.displayName=Fe;var _a="SelectTrigger",Ma=c.forwardRef((e,t)=>{const{__scopeSelect:o,disabled:n=!1,...r}=e,a=fo(o),s=De(_a,o),i=s.disabled||n,l=j(t,s.onTriggerChange),d=po(o),p=c.useRef("touch"),[u,h,m]=Ga(v=>{const g=d().filter(b=>!b.disabled),k=g.find(b=>b.value===s.value),w=Ya(g,v,k);w!==void 0&&s.onValueChange(w.value)}),x=v=>{i||(s.onOpenChange(!0),m()),v&&(s.triggerPointerDownPosRef.current={x:Math.round(v.pageX),y:Math.round(v.pageY)})};return f.jsx(kt,{asChild:!0,...a,children:f.jsx(A.button,{type:"button",role:"combobox","aria-controls":s.contentId,"aria-expanded":s.open,"aria-required":s.required,"aria-autocomplete":"none",dir:s.dir,"data-state":s.open?"open":"closed",disabled:i,"data-disabled":i?"":void 0,"data-placeholder":Ka(s.value)?"":void 0,...r,ref:l,onClick:C(r.onClick,v=>{v.currentTarget.focus(),p.current!=="mouse"&&x(v)}),onPointerDown:C(r.onPointerDown,v=>{p.current=v.pointerType;const g=v.target;g.hasPointerCapture(v.pointerId)&&g.releasePointerCapture(v.pointerId),v.button===0&&v.ctrlKey===!1&&v.pointerType==="mouse"&&(x(v),v.preventDefault())}),onKeyDown:C(r.onKeyDown,v=>{const g=u.current!=="";!(v.ctrlKey||v.altKey||v.metaKey)&&v.key.length===1&&h(v.key),!(g&&v.key===" ")&&zh.includes(v.key)&&(x(),v.preventDefault())})})})});Ma.displayName=_a;var Ca="SelectValue",Sa=c.forwardRef((e,t)=>{const{__scopeSelect:o,className:n,style:r,children:a,placeholder:s="",...i}=e,l=De(Ca,o),{onValueNodeHasChildrenChange:d}=l,p=a!==void 0,u=j(t,l.onValueNodeChange);return Z(()=>{d(p)},[d,p]),f.jsx(A.span,{...i,ref:u,style:{pointerEvents:"none"},children:Ka(l.value)?f.jsx(f.Fragment,{children:s}):a})});Sa.displayName=Ca;var Kh="SelectIcon",Ea=c.forwardRef((e,t)=>{const{__scopeSelect:o,children:n,...r}=e;return f.jsx(A.span,{"aria-hidden":!0,...r,ref:t,children:n||"▼"})});Ea.displayName=Kh;var Gh="SelectPortal",Ra=e=>f.jsx(Je,{asChild:!0,...e});Ra.displayName=Gh;var Ve="SelectContent",Pa=c.forwardRef((e,t)=>{const o=De(Ve,e.__scopeSelect),[n,r]=c.useState();if(Z(()=>{r(new DocumentFragment)},[]),!o.open){const a=n;return a?mt.createPortal(f.jsx(Aa,{scope:e.__scopeSelect,children:f.jsx(uo.Slot,{scope:e.__scopeSelect,children:f.jsx("div",{children:e.children})})}),a):null}return f.jsx(Na,{...e,ref:t})});Pa.displayName=Ve;var fe=10,[Aa,Oe]=ot(Ve),Yh="SelectContentImpl",Xh=Th("SelectContent.RemoveScroll"),Na=c.forwardRef((e,t)=>{const{__scopeSelect:o,position:n="item-aligned",onCloseAutoFocus:r,onEscapeKeyDown:a,onPointerDownOutside:s,side:i,sideOffset:l,align:d,alignOffset:p,arrowPadding:u,collisionBoundary:h,collisionPadding:m,sticky:x,hideWhenDetached:v,avoidCollisions:g,...k}=e,w=De(Ve,o),[b,_]=c.useState(null),[M,E]=c.useState(null),S=j(t,L=>_(L)),[N,T]=c.useState(null),[I,D]=c.useState(null),F=po(o),[V,R]=c.useState(!1),H=c.useRef(!1);c.useEffect(()=>{if(b)return lo(b)},[b]),io();const O=c.useCallback(L=>{const[W,...G]=F().map(K=>K.ref.current),[q]=G.slice(-1),U=document.activeElement;for(const K of L)if(K===U||(K==null||K.scrollIntoView({block:"nearest"}),K===W&&M&&(M.scrollTop=0),K===q&&M&&(M.scrollTop=M.scrollHeight),K==null||K.focus(),document.activeElement!==U))return},[F,M]),z=c.useCallback(()=>O([N,b]),[O,N,b]);c.useEffect(()=>{V&&z()},[V,z]);const{onOpenChange:$,triggerPointerDownPosRef:P}=w;c.useEffect(()=>{if(b){let L={x:0,y:0};const W=q=>{var U,K;L={x:Math.abs(Math.round(q.pageX)-(((U=P.current)==null?void 0:U.x)??0)),y:Math.abs(Math.round(q.pageY)-(((K=P.current)==null?void 0:K.y)??0))}},G=q=>{L.x<=10&&L.y<=10?q.preventDefault():b.contains(q.target)||$(!1),document.removeEventListener("pointermove",W),P.current=null};return P.current!==null&&(document.addEventListener("pointermove",W),document.addEventListener("pointerup",G,{capture:!0,once:!0})),()=>{document.removeEventListener("pointermove",W),document.removeEventListener("pointerup",G,{capture:!0})}}},[b,$,P]),c.useEffect(()=>{const L=()=>$(!1);return window.addEventListener("blur",L),window.addEventListener("resize",L),()=>{window.removeEventListener("blur",L),window.removeEventListener("resize",L)}},[$]);const[B,Y]=Ga(L=>{const W=F().filter(U=>!U.disabled),G=W.find(U=>U.ref.current===document.activeElement),q=Ya(W,L,G);q&&setTimeout(()=>q.ref.current.focus())}),te=c.useCallback((L,W,G)=>{const q=!H.current&&!G;(w.value!==void 0&&w.value===W||q)&&(T(L),q&&(H.current=!0))},[w.value]),ae=c.useCallback(()=>b==null?void 0:b.focus(),[b]),ne=c.useCallback((L,W,G)=>{const q=!H.current&&!G;(w.value!==void 0&&w.value===W||q)&&D(L)},[w.value]),Ce=n==="popper"?Wo:Ta,ce=Ce===Wo?{side:i,sideOffset:l,align:d,alignOffset:p,arrowPadding:u,collisionBoundary:h,collisionPadding:m,sticky:x,hideWhenDetached:v,avoidCollisions:g}:{};return f.jsx(Aa,{scope:o,content:b,viewport:M,onViewportChange:E,itemRefCallback:te,selectedItem:N,onItemLeave:ae,itemTextRefCallback:ne,focusSelectedItem:z,selectedItemText:I,position:n,isPositioned:V,searchRef:B,children:f.jsx(Gt,{as:Xh,allowPinchZoom:!0,children:f.jsx(_t,{asChild:!0,trapped:w.open,onMountAutoFocus:L=>{L.preventDefault()},onUnmountAutoFocus:C(r,L=>{var W;(W=w.trigger)==null||W.focus({preventScroll:!0}),L.preventDefault()}),children:f.jsx(He,{asChild:!0,disableOutsidePointerEvents:!0,onEscapeKeyDown:a,onPointerDownOutside:s,onFocusOutside:L=>L.preventDefault(),onDismiss:()=>w.onOpenChange(!1),children:f.jsx(Ce,{role:"listbox",id:w.contentId,"data-state":w.open?"open":"closed",dir:w.dir,onContextMenu:L=>L.preventDefault(),...k,...ce,onPlaced:()=>R(!0),ref:S,style:{display:"flex",flexDirection:"column",outline:"none",...k.style},onKeyDown:C(k.onKeyDown,L=>{const W=L.ctrlKey||L.altKey||L.metaKey;if(L.key==="Tab"&&L.preventDefault(),!W&&L.key.length===1&&Y(L.key),["ArrowUp","ArrowDown","Home","End"].includes(L.key)){let q=F().filter(U=>!U.disabled).map(U=>U.ref.current);if(["ArrowUp","End"].includes(L.key)&&(q=q.slice().reverse()),["ArrowUp","ArrowDown"].includes(L.key)){const U=L.target,K=q.indexOf(U);q=q.slice(K+1)}setTimeout(()=>O(q)),L.preventDefault()}})})})})})})});Na.displayName=Yh;var Zh="SelectItemAlignedPosition",Ta=c.forwardRef((e,t)=>{const{__scopeSelect:o,onPlaced:n,...r}=e,a=De(Ve,o),s=Oe(Ve,o),[i,l]=c.useState(null),[d,p]=c.useState(null),u=j(t,S=>p(S)),h=po(o),m=c.useRef(!1),x=c.useRef(!0),{viewport:v,selectedItem:g,selectedItemText:k,focusSelectedItem:w}=s,b=c.useCallback(()=>{if(a.trigger&&a.valueNode&&i&&d&&v&&g&&k){const S=a.trigger.getBoundingClientRect(),N=d.getBoundingClientRect(),T=a.valueNode.getBoundingClientRect(),I=k.getBoundingClientRect();if(a.dir!=="rtl"){const U=I.left-N.left,K=T.left-U,ie=S.left-K,ge=S.width+ie,at=Math.max(ge,N.width),st=window.innerWidth-fe,ct=ft(K,[fe,Math.max(fe,st-at)]);i.style.minWidth=ge+"px",i.style.left=ct+"px"}else{const U=N.right-I.right,K=window.innerWidth-T.right-U,ie=window.innerWidth-S.right-K,ge=S.width+ie,at=Math.max(ge,N.width),st=window.innerWidth-fe,ct=ft(K,[fe,Math.max(fe,st-at)]);i.style.minWidth=ge+"px",i.style.right=ct+"px"}const D=h(),F=window.innerHeight-fe*2,V=v.scrollHeight,R=window.getComputedStyle(d),H=parseInt(R.borderTopWidth,10),O=parseInt(R.paddingTop,10),z=parseInt(R.borderBottomWidth,10),$=parseInt(R.paddingBottom,10),P=H+O+V+$+z,B=Math.min(g.offsetHeight*5,P),Y=window.getComputedStyle(v),te=parseInt(Y.paddingTop,10),ae=parseInt(Y.paddingBottom,10),ne=S.top+S.height/2-fe,Ce=F-ne,ce=g.offsetHeight/2,L=g.offsetTop+ce,W=H+O+L,G=P-W;if(W<=ne){const U=D.length>0&&g===D[D.length-1].ref.current;i.style.bottom="0px";const K=d.clientHeight-v.offsetTop-v.offsetHeight,ie=Math.max(Ce,ce+(U?ae:0)+K+z),ge=W+ie;i.style.height=ge+"px"}else{const U=D.length>0&&g===D[0].ref.current;i.style.top="0px";const ie=Math.max(ne,H+v.offsetTop+(U?te:0)+ce)+G;i.style.height=ie+"px",v.scrollTop=W-ne+v.offsetTop}i.style.margin=`${fe}px 0`,i.style.minHeight=B+"px",i.style.maxHeight=F+"px",n==null||n(),requestAnimationFrame(()=>m.current=!0)}},[h,a.trigger,a.valueNode,i,d,v,g,k,a.dir,n]);Z(()=>b(),[b]);const[_,M]=c.useState();Z(()=>{d&&M(window.getComputedStyle(d).zIndex)},[d]);const E=c.useCallback(S=>{S&&x.current===!0&&(b(),w==null||w(),x.current=!1)},[b,w]);return f.jsx(Jh,{scope:o,contentWrapper:i,shouldExpandOnScrollRef:m,onScrollButtonChange:E,children:f.jsx("div",{ref:l,style:{display:"flex",flexDirection:"column",position:"fixed",zIndex:_},children:f.jsx(A.div,{...r,ref:u,style:{boxSizing:"border-box",maxHeight:"100%",...r.style}})})})});Ta.displayName=Zh;var Qh="SelectPopperPosition",Wo=c.forwardRef((e,t)=>{const{__scopeSelect:o,align:n="start",collisionPadding:r=fe,...a}=e,s=fo(o);return f.jsx(oo,{...s,...a,ref:t,align:n,collisionPadding:r,style:{boxSizing:"border-box",...a.style,"--radix-select-content-transform-origin":"var(--radix-popper-transform-origin)","--radix-select-content-available-width":"var(--radix-popper-available-width)","--radix-select-content-available-height":"var(--radix-popper-available-height)","--radix-select-trigger-width":"var(--radix-popper-anchor-width)","--radix-select-trigger-height":"var(--radix-popper-anchor-height)"}})});Wo.displayName=Qh;var[Jh,vn]=ot(Ve,{}),Uo="SelectViewport",$a=c.forwardRef((e,t)=>{const{__scopeSelect:o,nonce:n,...r}=e,a=Oe(Uo,o),s=vn(Uo,o),i=j(t,a.onViewportChange),l=c.useRef(0);return f.jsxs(f.Fragment,{children:[f.jsx("style",{dangerouslySetInnerHTML:{__html:"[data-radix-select-viewport]{scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch;}[data-radix-select-viewport]::-webkit-scrollbar{display:none}"},nonce:n}),f.jsx(uo.Slot,{scope:o,children:f.jsx(A.div,{"data-radix-select-viewport":"",role:"presentation",...r,ref:i,style:{position:"relative",flex:1,overflow:"hidden auto",...r.style},onScroll:C(r.onScroll,d=>{const p=d.currentTarget,{contentWrapper:u,shouldExpandOnScrollRef:h}=s;if(h!=null&&h.current&&u){const m=Math.abs(l.current-p.scrollTop);if(m>0){const x=window.innerHeight-fe*2,v=parseFloat(u.style.minHeight),g=parseFloat(u.style.height),k=Math.max(v,g);if(k<x){const w=k+m,b=Math.min(x,w),_=w-b;u.style.height=b+"px",u.style.bottom==="0px"&&(p.scrollTop=_>0?_:0,u.style.justifyContent="flex-end")}}}l.current=p.scrollTop})})})]})});$a.displayName=Uo;var Ia="SelectGroup",[ey,ty]=ot(Ia),oy=c.forwardRef((e,t)=>{const{__scopeSelect:o,...n}=e,r=se();return f.jsx(ey,{scope:o,id:r,children:f.jsx(A.div,{role:"group","aria-labelledby":r,...n,ref:t})})});oy.displayName=Ia;var Da="SelectLabel",Oa=c.forwardRef((e,t)=>{const{__scopeSelect:o,...n}=e,r=ty(Da,o);return f.jsx(A.div,{id:r.id,...n,ref:t})});Oa.displayName=Da;var Vt="SelectItem",[ny,ja]=ot(Vt),La=c.forwardRef((e,t)=>{const{__scopeSelect:o,value:n,disabled:r=!1,textValue:a,...s}=e,i=De(Vt,o),l=Oe(Vt,o),d=i.value===n,[p,u]=c.useState(a??""),[h,m]=c.useState(!1),x=j(t,w=>{var b;return(b=l.itemRefCallback)==null?void 0:b.call(l,w,n,r)}),v=se(),g=c.useRef("touch"),k=()=>{r||(i.onValueChange(n),i.onOpenChange(!1))};if(n==="")throw new Error("A <Select.Item /> must have a value prop that is not an empty string. This is because the Select value can be set to an empty string to clear the selection and show the placeholder.");return f.jsx(ny,{scope:o,value:n,disabled:r,textId:v,isSelected:d,onItemTextChange:c.useCallback(w=>{u(b=>b||((w==null?void 0:w.textContent)??"").trim())},[]),children:f.jsx(uo.ItemSlot,{scope:o,value:n,disabled:r,textValue:p,children:f.jsx(A.div,{role:"option","aria-labelledby":v,"data-highlighted":h?"":void 0,"aria-selected":d&&h,"data-state":d?"checked":"unchecked","aria-disabled":r||void 0,"data-disabled":r?"":void 0,tabIndex:r?void 0:-1,...s,ref:x,onFocus:C(s.onFocus,()=>m(!0)),onBlur:C(s.onBlur,()=>m(!1)),onClick:C(s.onClick,()=>{g.current!=="mouse"&&k()}),onPointerUp:C(s.onPointerUp,()=>{g.current==="mouse"&&k()}),onPointerDown:C(s.onPointerDown,w=>{g.current=w.pointerType}),onPointerMove:C(s.onPointerMove,w=>{var b;g.current=w.pointerType,r?(b=l.onItemLeave)==null||b.call(l):g.current==="mouse"&&w.currentTarget.focus({preventScroll:!0})}),onPointerLeave:C(s.onPointerLeave,w=>{var b;w.currentTarget===document.activeElement&&((b=l.onItemLeave)==null||b.call(l))}),onKeyDown:C(s.onKeyDown,w=>{var _;((_=l.searchRef)==null?void 0:_.current)!==""&&w.key===" "||(Hh.includes(w.key)&&k(),w.key===" "&&w.preventDefault())})})})})});La.displayName=Vt;var it="SelectItemText",Fa=c.forwardRef((e,t)=>{const{__scopeSelect:o,className:n,style:r,...a}=e,s=De(it,o),i=Oe(it,o),l=ja(it,o),d=Uh(it,o),[p,u]=c.useState(null),h=j(t,k=>u(k),l.onItemTextChange,k=>{var w;return(w=i.itemTextRefCallback)==null?void 0:w.call(i,k,l.value,l.disabled)}),m=p==null?void 0:p.textContent,x=c.useMemo(()=>f.jsx("option",{value:l.value,disabled:l.disabled,children:m},l.value),[l.disabled,l.value,m]),{onNativeOptionAdd:v,onNativeOptionRemove:g}=d;return Z(()=>(v(x),()=>g(x)),[v,g,x]),f.jsxs(f.Fragment,{children:[f.jsx(A.span,{id:l.textId,...a,ref:h}),l.isSelected&&s.valueNode&&!s.valueNodeHasChildren?mt.createPortal(a.children,s.valueNode):null]})});Fa.displayName=it;var Va="SelectItemIndicator",za=c.forwardRef((e,t)=>{const{__scopeSelect:o,...n}=e;return ja(Va,o).isSelected?f.jsx(A.span,{"aria-hidden":!0,...n,ref:t}):null});za.displayName=Va;var Ko="SelectScrollUpButton",Ha=c.forwardRef((e,t)=>{const o=Oe(Ko,e.__scopeSelect),n=vn(Ko,e.__scopeSelect),[r,a]=c.useState(!1),s=j(t,n.onScrollButtonChange);return Z(()=>{if(o.viewport&&o.isPositioned){let i=function(){const d=l.scrollTop>0;a(d)};const l=o.viewport;return i(),l.addEventListener("scroll",i),()=>l.removeEventListener("scroll",i)}},[o.viewport,o.isPositioned]),r?f.jsx(qa,{...e,ref:s,onAutoScroll:()=>{const{viewport:i,selectedItem:l}=o;i&&l&&(i.scrollTop=i.scrollTop-l.offsetHeight)}}):null});Ha.displayName=Ko;var Go="SelectScrollDownButton",Ba=c.forwardRef((e,t)=>{const o=Oe(Go,e.__scopeSelect),n=vn(Go,e.__scopeSelect),[r,a]=c.useState(!1),s=j(t,n.onScrollButtonChange);return Z(()=>{if(o.viewport&&o.isPositioned){let i=function(){const d=l.scrollHeight-l.clientHeight,p=Math.ceil(l.scrollTop)<d;a(p)};const l=o.viewport;return i(),l.addEventListener("scroll",i),()=>l.removeEventListener("scroll",i)}},[o.viewport,o.isPositioned]),r?f.jsx(qa,{...e,ref:s,onAutoScroll:()=>{const{viewport:i,selectedItem:l}=o;i&&l&&(i.scrollTop=i.scrollTop+l.offsetHeight)}}):null});Ba.displayName=Go;var qa=c.forwardRef((e,t)=>{const{__scopeSelect:o,onAutoScroll:n,...r}=e,a=Oe("SelectScrollButton",o),s=c.useRef(null),i=po(o),l=c.useCallback(()=>{s.current!==null&&(window.clearInterval(s.current),s.current=null)},[]);return c.useEffect(()=>()=>l(),[l]),Z(()=>{var p;const d=i().find(u=>u.ref.current===document.activeElement);(p=d==null?void 0:d.ref.current)==null||p.scrollIntoView({block:"nearest"})},[i]),f.jsx(A.div,{"aria-hidden":!0,...r,ref:t,style:{flexShrink:0,...r.style},onPointerDown:C(r.onPointerDown,()=>{s.current===null&&(s.current=window.setInterval(n,50))}),onPointerMove:C(r.onPointerMove,()=>{var d;(d=a.onItemLeave)==null||d.call(a),s.current===null&&(s.current=window.setInterval(n,50))}),onPointerLeave:C(r.onPointerLeave,()=>{l()})})}),ry="SelectSeparator",Wa=c.forwardRef((e,t)=>{const{__scopeSelect:o,...n}=e;return f.jsx(A.div,{"aria-hidden":!0,...n,ref:t})});Wa.displayName=ry;var Yo="SelectArrow",ay=c.forwardRef((e,t)=>{const{__scopeSelect:o,...n}=e,r=fo(o),a=De(Yo,o),s=Oe(Yo,o);return a.open&&s.position==="popper"?f.jsx(no,{...r,...n,ref:t}):null});ay.displayName=Yo;var sy="SelectBubbleInput",Ua=c.forwardRef(({__scopeSelect:e,value:t,...o},n)=>{const r=c.useRef(null),a=j(n,r),s=bt(t);return c.useEffect(()=>{const i=r.current;if(!i)return;const l=window.HTMLSelectElement.prototype,p=Object.getOwnPropertyDescriptor(l,"value").set;if(s!==t&&p){const u=new Event("change",{bubbles:!0});p.call(i,t),i.dispatchEvent(u)}},[s,t]),f.jsx(A.select,{...o,style:{...Cr,...o.style},ref:a,defaultValue:t})});Ua.displayName=sy;function Ka(e){return e===""||e===void 0}function Ga(e){const t=X(e),o=c.useRef(""),n=c.useRef(0),r=c.useCallback(s=>{const i=o.current+s;t(i),function l(d){o.current=d,window.clearTimeout(n.current),d!==""&&(n.current=window.setTimeout(()=>l(""),1e3))}(i)},[t]),a=c.useCallback(()=>{o.current="",window.clearTimeout(n.current)},[]);return c.useEffect(()=>()=>window.clearTimeout(n.current),[]),[o,r,a]}function Ya(e,t,o){const r=t.length>1&&Array.from(t).every(d=>d===t[0])?t[0]:t,a=o?e.indexOf(o):-1;let s=cy(e,Math.max(a,0));r.length===1&&(s=s.filter(d=>d!==o));const l=s.find(d=>d.textValue.toLowerCase().startsWith(r.toLowerCase()));return l!==o?l:void 0}function cy(e,t){return e.map((o,n)=>e[(t+n)%e.length])}var q3=ba,W3=Ma,U3=Sa,K3=Ea,G3=Ra,Y3=Pa,X3=$a,Z3=Oa,Q3=La,J3=Fa,eb=za,tb=Ha,ob=Ba,nb=Wa;function iy(e,t){return c.useReducer((o,n)=>t[o][n]??o,e)}var gn="ScrollArea",[Xa]=J(gn),[ly,pe]=Xa(gn),Za=c.forwardRef((e,t)=>{const{__scopeScrollArea:o,type:n="hover",dir:r,scrollHideDelay:a=600,...s}=e,[i,l]=c.useState(null),[d,p]=c.useState(null),[u,h]=c.useState(null),[m,x]=c.useState(null),[v,g]=c.useState(null),[k,w]=c.useState(0),[b,_]=c.useState(0),[M,E]=c.useState(!1),[S,N]=c.useState(!1),T=j(t,D=>l(D)),I=Ie(r);return f.jsx(ly,{scope:o,type:n,dir:I,scrollHideDelay:a,scrollArea:i,viewport:d,onViewportChange:p,content:u,onContentChange:h,scrollbarX:m,onScrollbarXChange:x,scrollbarXEnabled:M,onScrollbarXEnabledChange:E,scrollbarY:v,onScrollbarYChange:g,scrollbarYEnabled:S,onScrollbarYEnabledChange:N,onCornerWidthChange:w,onCornerHeightChange:_,children:f.jsx(A.div,{dir:I,...s,ref:T,style:{position:"relative","--radix-scroll-area-corner-width":k+"px","--radix-scroll-area-corner-height":b+"px",...e.style}})})});Za.displayName=gn;var Qa="ScrollAreaViewport",Ja=c.forwardRef((e,t)=>{const{__scopeScrollArea:o,children:n,nonce:r,...a}=e,s=pe(Qa,o),i=c.useRef(null),l=j(t,i,s.onViewportChange);return f.jsxs(f.Fragment,{children:[f.jsx("style",{dangerouslySetInnerHTML:{__html:"[data-radix-scroll-area-viewport]{scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch;}[data-radix-scroll-area-viewport]::-webkit-scrollbar{display:none}"},nonce:r}),f.jsx(A.div,{"data-radix-scroll-area-viewport":"",...a,ref:l,style:{overflowX:s.scrollbarXEnabled?"scroll":"hidden",overflowY:s.scrollbarYEnabled?"scroll":"hidden",...e.style},children:f.jsx("div",{ref:s.onContentChange,style:{minWidth:"100%",display:"table"},children:n})})]})});Ja.displayName=Qa;var Me="ScrollAreaScrollbar",dy=c.forwardRef((e,t)=>{const{forceMount:o,...n}=e,r=pe(Me,e.__scopeScrollArea),{onScrollbarXEnabledChange:a,onScrollbarYEnabledChange:s}=r,i=e.orientation==="horizontal";return c.useEffect(()=>(i?a(!0):s(!0),()=>{i?a(!1):s(!1)}),[i,a,s]),r.type==="hover"?f.jsx(uy,{...n,ref:t,forceMount:o}):r.type==="scroll"?f.jsx(py,{...n,ref:t,forceMount:o}):r.type==="auto"?f.jsx(es,{...n,ref:t,forceMount:o}):r.type==="always"?f.jsx(xn,{...n,ref:t}):null});dy.displayName=Me;var uy=c.forwardRef((e,t)=>{const{forceMount:o,...n}=e,r=pe(Me,e.__scopeScrollArea),[a,s]=c.useState(!1);return c.useEffect(()=>{const i=r.scrollArea;let l=0;if(i){const d=()=>{window.clearTimeout(l),s(!0)},p=()=>{l=window.setTimeout(()=>s(!1),r.scrollHideDelay)};return i.addEventListener("pointerenter",d),i.addEventListener("pointerleave",p),()=>{window.clearTimeout(l),i.removeEventListener("pointerenter",d),i.removeEventListener("pointerleave",p)}}},[r.scrollArea,r.scrollHideDelay]),f.jsx(ee,{present:o||a,children:f.jsx(es,{"data-state":a?"visible":"hidden",...n,ref:t})})}),py=c.forwardRef((e,t)=>{const{forceMount:o,...n}=e,r=pe(Me,e.__scopeScrollArea),a=e.orientation==="horizontal",s=yo(()=>l("SCROLL_END"),100),[i,l]=iy("hidden",{hidden:{SCROLL:"scrolling"},scrolling:{SCROLL_END:"idle",POINTER_ENTER:"interacting"},interacting:{SCROLL:"interacting",POINTER_LEAVE:"idle"},idle:{HIDE:"hidden",SCROLL:"scrolling",POINTER_ENTER:"interacting"}});return c.useEffect(()=>{if(i==="idle"){const d=window.setTimeout(()=>l("HIDE"),r.scrollHideDelay);return()=>window.clearTimeout(d)}},[i,r.scrollHideDelay,l]),c.useEffect(()=>{const d=r.viewport,p=a?"scrollLeft":"scrollTop";if(d){let u=d[p];const h=()=>{const m=d[p];u!==m&&(l("SCROLL"),s()),u=m};return d.addEventListener("scroll",h),()=>d.removeEventListener("scroll",h)}},[r.viewport,a,l,s]),f.jsx(ee,{present:o||i!=="hidden",children:f.jsx(xn,{"data-state":i==="hidden"?"hidden":"visible",...n,ref:t,onPointerEnter:C(e.onPointerEnter,()=>l("POINTER_ENTER")),onPointerLeave:C(e.onPointerLeave,()=>l("POINTER_LEAVE"))})})}),es=c.forwardRef((e,t)=>{const o=pe(Me,e.__scopeScrollArea),{forceMount:n,...r}=e,[a,s]=c.useState(!1),i=e.orientation==="horizontal",l=yo(()=>{if(o.viewport){const d=o.viewport.offsetWidth<o.viewport.scrollWidth,p=o.viewport.offsetHeight<o.viewport.scrollHeight;s(i?d:p)}},10);return Xe(o.viewport,l),Xe(o.content,l),f.jsx(ee,{present:n||a,children:f.jsx(xn,{"data-state":a?"visible":"hidden",...r,ref:t})})}),xn=c.forwardRef((e,t)=>{const{orientation:o="vertical",...n}=e,r=pe(Me,e.__scopeScrollArea),a=c.useRef(null),s=c.useRef(0),[i,l]=c.useState({content:0,viewport:0,scrollbar:{size:0,paddingStart:0,paddingEnd:0}}),d=rs(i.viewport,i.content),p={...n,sizes:i,onSizesChange:l,hasThumb:d>0&&d<1,onThumbChange:h=>a.current=h,onThumbPointerUp:()=>s.current=0,onThumbPointerDown:h=>s.current=h};function u(h,m){return xy(h,s.current,i,m)}return o==="horizontal"?f.jsx(fy,{...p,ref:t,onThumbPositionChange:()=>{if(r.viewport&&a.current){const h=r.viewport.scrollLeft,m=mr(h,i,r.dir);a.current.style.transform=`translate3d(${m}px, 0, 0)`}},onWheelScroll:h=>{r.viewport&&(r.viewport.scrollLeft=h)},onDragScroll:h=>{r.viewport&&(r.viewport.scrollLeft=u(h,r.dir))}}):o==="vertical"?f.jsx(hy,{...p,ref:t,onThumbPositionChange:()=>{if(r.viewport&&a.current){const h=r.viewport.scrollTop,m=mr(h,i);a.current.style.transform=`translate3d(0, ${m}px, 0)`}},onWheelScroll:h=>{r.viewport&&(r.viewport.scrollTop=h)},onDragScroll:h=>{r.viewport&&(r.viewport.scrollTop=u(h))}}):null}),fy=c.forwardRef((e,t)=>{const{sizes:o,onSizesChange:n,...r}=e,a=pe(Me,e.__scopeScrollArea),[s,i]=c.useState(),l=c.useRef(null),d=j(t,l,a.onScrollbarXChange);return c.useEffect(()=>{l.current&&i(getComputedStyle(l.current))},[l]),f.jsx(os,{"data-orientation":"horizontal",...r,ref:d,sizes:o,style:{bottom:0,left:a.dir==="rtl"?"var(--radix-scroll-area-corner-width)":0,right:a.dir==="ltr"?"var(--radix-scroll-area-corner-width)":0,"--radix-scroll-area-thumb-width":ho(o)+"px",...e.style},onThumbPointerDown:p=>e.onThumbPointerDown(p.x),onDragScroll:p=>e.onDragScroll(p.x),onWheelScroll:(p,u)=>{if(a.viewport){const h=a.viewport.scrollLeft+p.deltaX;e.onWheelScroll(h),ss(h,u)&&p.preventDefault()}},onResize:()=>{l.current&&a.viewport&&s&&n({content:a.viewport.scrollWidth,viewport:a.viewport.offsetWidth,scrollbar:{size:l.current.clientWidth,paddingStart:Ht(s.paddingLeft),paddingEnd:Ht(s.paddingRight)}})}})}),hy=c.forwardRef((e,t)=>{const{sizes:o,onSizesChange:n,...r}=e,a=pe(Me,e.__scopeScrollArea),[s,i]=c.useState(),l=c.useRef(null),d=j(t,l,a.onScrollbarYChange);return c.useEffect(()=>{l.current&&i(getComputedStyle(l.current))},[l]),f.jsx(os,{"data-orientation":"vertical",...r,ref:d,sizes:o,style:{top:0,right:a.dir==="ltr"?0:void 0,left:a.dir==="rtl"?0:void 0,bottom:"var(--radix-scroll-area-corner-height)","--radix-scroll-area-thumb-height":ho(o)+"px",...e.style},onThumbPointerDown:p=>e.onThumbPointerDown(p.y),onDragScroll:p=>e.onDragScroll(p.y),onWheelScroll:(p,u)=>{if(a.viewport){const h=a.viewport.scrollTop+p.deltaY;e.onWheelScroll(h),ss(h,u)&&p.preventDefault()}},onResize:()=>{l.current&&a.viewport&&s&&n({content:a.viewport.scrollHeight,viewport:a.viewport.offsetHeight,scrollbar:{size:l.current.clientHeight,paddingStart:Ht(s.paddingTop),paddingEnd:Ht(s.paddingBottom)}})}})}),[yy,ts]=Xa(Me),os=c.forwardRef((e,t)=>{const{__scopeScrollArea:o,sizes:n,hasThumb:r,onThumbChange:a,onThumbPointerUp:s,onThumbPointerDown:i,onThumbPositionChange:l,onDragScroll:d,onWheelScroll:p,onResize:u,...h}=e,m=pe(Me,o),[x,v]=c.useState(null),g=j(t,T=>v(T)),k=c.useRef(null),w=c.useRef(""),b=m.viewport,_=n.content-n.viewport,M=X(p),E=X(l),S=yo(u,10);function N(T){if(k.current){const I=T.clientX-k.current.left,D=T.clientY-k.current.top;d({x:I,y:D})}}return c.useEffect(()=>{const T=I=>{const D=I.target;(x==null?void 0:x.contains(D))&&M(I,_)};return document.addEventListener("wheel",T,{passive:!1}),()=>document.removeEventListener("wheel",T,{passive:!1})},[b,x,_,M]),c.useEffect(E,[n,E]),Xe(x,S),Xe(m.content,S),f.jsx(yy,{scope:o,scrollbar:x,hasThumb:r,onThumbChange:X(a),onThumbPointerUp:X(s),onThumbPositionChange:E,onThumbPointerDown:X(i),children:f.jsx(A.div,{...h,ref:g,style:{position:"absolute",...h.style},onPointerDown:C(e.onPointerDown,T=>{T.button===0&&(T.target.setPointerCapture(T.pointerId),k.current=x.getBoundingClientRect(),w.current=document.body.style.webkitUserSelect,document.body.style.webkitUserSelect="none",m.viewport&&(m.viewport.style.scrollBehavior="auto"),N(T))}),onPointerMove:C(e.onPointerMove,N),onPointerUp:C(e.onPointerUp,T=>{const I=T.target;I.hasPointerCapture(T.pointerId)&&I.releasePointerCapture(T.pointerId),document.body.style.webkitUserSelect=w.current,m.viewport&&(m.viewport.style.scrollBehavior=""),k.current=null})})})}),zt="ScrollAreaThumb",my=c.forwardRef((e,t)=>{const{forceMount:o,...n}=e,r=ts(zt,e.__scopeScrollArea);return f.jsx(ee,{present:o||r.hasThumb,children:f.jsx(vy,{ref:t,...n})})}),vy=c.forwardRef((e,t)=>{const{__scopeScrollArea:o,style:n,...r}=e,a=pe(zt,o),s=ts(zt,o),{onThumbPositionChange:i}=s,l=j(t,u=>s.onThumbChange(u)),d=c.useRef(void 0),p=yo(()=>{d.current&&(d.current(),d.current=void 0)},100);return c.useEffect(()=>{const u=a.viewport;if(u){const h=()=>{if(p(),!d.current){const m=ky(u,i);d.current=m,i()}};return i(),u.addEventListener("scroll",h),()=>u.removeEventListener("scroll",h)}},[a.viewport,p,i]),f.jsx(A.div,{"data-state":s.hasThumb?"visible":"hidden",...r,ref:l,style:{width:"var(--radix-scroll-area-thumb-width)",height:"var(--radix-scroll-area-thumb-height)",...n},onPointerDownCapture:C(e.onPointerDownCapture,u=>{const m=u.target.getBoundingClientRect(),x=u.clientX-m.left,v=u.clientY-m.top;s.onThumbPointerDown({x,y:v})}),onPointerUp:C(e.onPointerUp,s.onThumbPointerUp)})});my.displayName=zt;var kn="ScrollAreaCorner",ns=c.forwardRef((e,t)=>{const o=pe(kn,e.__scopeScrollArea),n=!!(o.scrollbarX&&o.scrollbarY);return o.type!=="scroll"&&n?f.jsx(gy,{...e,ref:t}):null});ns.displayName=kn;var gy=c.forwardRef((e,t)=>{const{__scopeScrollArea:o,...n}=e,r=pe(kn,o),[a,s]=c.useState(0),[i,l]=c.useState(0),d=!!(a&&i);return Xe(r.scrollbarX,()=>{var u;const p=((u=r.scrollbarX)==null?void 0:u.offsetHeight)||0;r.onCornerHeightChange(p),l(p)}),Xe(r.scrollbarY,()=>{var u;const p=((u=r.scrollbarY)==null?void 0:u.offsetWidth)||0;r.onCornerWidthChange(p),s(p)}),d?f.jsx(A.div,{...n,ref:t,style:{width:a,height:i,position:"absolute",right:r.dir==="ltr"?0:void 0,left:r.dir==="rtl"?0:void 0,bottom:0,...e.style}}):null});function Ht(e){return e?parseInt(e,10):0}function rs(e,t){const o=e/t;return isNaN(o)?0:o}function ho(e){const t=rs(e.viewport,e.content),o=e.scrollbar.paddingStart+e.scrollbar.paddingEnd,n=(e.scrollbar.size-o)*t;return Math.max(n,18)}function xy(e,t,o,n="ltr"){const r=ho(o),a=r/2,s=t||a,i=r-s,l=o.scrollbar.paddingStart+s,d=o.scrollbar.size-o.scrollbar.paddingEnd-i,p=o.content-o.viewport,u=n==="ltr"?[0,p]:[p*-1,0];return as([l,d],u)(e)}function mr(e,t,o="ltr"){const n=ho(t),r=t.scrollbar.paddingStart+t.scrollbar.paddingEnd,a=t.scrollbar.size-r,s=t.content-t.viewport,i=a-n,l=o==="ltr"?[0,s]:[s*-1,0],d=ft(e,l);return as([0,s],[0,i])(d)}function as(e,t){return o=>{if(e[0]===e[1]||t[0]===t[1])return t[0];const n=(t[1]-t[0])/(e[1]-e[0]);return t[0]+n*(o-e[0])}}function ss(e,t){return e>0&&e<t}var ky=(e,t=()=>{})=>{let o={left:e.scrollLeft,top:e.scrollTop},n=0;return function r(){const a={left:e.scrollLeft,top:e.scrollTop},s=o.left!==a.left,i=o.top!==a.top;(s||i)&&t(),o=a,n=window.requestAnimationFrame(r)}(),()=>window.cancelAnimationFrame(n)};function yo(e,t){const o=X(e),n=c.useRef(0);return c.useEffect(()=>()=>window.clearTimeout(n.current),[]),c.useCallback(()=>{window.clearTimeout(n.current),n.current=window.setTimeout(o,t)},[o,t])}function Xe(e,t){const o=X(t);Z(()=>{let n=0;if(e){const r=new ResizeObserver(()=>{cancelAnimationFrame(n),n=window.requestAnimationFrame(o)});return r.observe(e),()=>{window.cancelAnimationFrame(n),r.unobserve(e)}}},[e,o])}var rb=Za,ab=Ja,sb=ns,wy=["a","button","div","form","h2","h3","img","input","label","li","nav","ol","p","select","span","svg","ul"],by=wy.reduce((e,t)=>{const o=wt(`Primitive.${t}`),n=c.forwardRef((r,a)=>{const{asChild:s,...i}=r,l=s?o:t;return typeof window<"u"&&(window[Symbol.for("radix-ui")]=!0),f.jsx(l,{...i,ref:a})});return n.displayName=`Primitive.${t}`,{...e,[t]:n}},{}),_y="Label",cs=c.forwardRef((e,t)=>f.jsx(by.label,{...e,ref:t,onMouseDown:o=>{var r;o.target.closest("button, input, select, textarea")||((r=e.onMouseDown)==null||r.call(e,o),!o.defaultPrevented&&o.detail>1&&o.preventDefault())}}));cs.displayName=_y;var cb=cs,mo="Checkbox",[My]=J(mo),[Cy,wn]=My(mo);function Sy(e){const{__scopeCheckbox:t,checked:o,children:n,defaultChecked:r,disabled:a,form:s,name:i,onCheckedChange:l,required:d,value:p="on",internal_do_not_use_render:u}=e,[h,m]=oe({prop:o,defaultProp:r??!1,onChange:l,caller:mo}),[x,v]=c.useState(null),[g,k]=c.useState(null),w=c.useRef(!1),b=x?!!s||!!x.closest("form"):!0,_={checked:h,disabled:a,setChecked:m,control:x,setControl:v,name:i,form:s,value:p,hasConsumerStoppedPropagationRef:w,required:d,defaultChecked:Ae(r)?!1:r,isFormControl:b,bubbleInput:g,setBubbleInput:k};return f.jsx(Cy,{scope:t,..._,children:Py(u)?u(_):n})}var is="CheckboxTrigger",ls=c.forwardRef(({__scopeCheckbox:e,onKeyDown:t,onClick:o,...n},r)=>{const{control:a,value:s,disabled:i,checked:l,required:d,setControl:p,setChecked:u,hasConsumerStoppedPropagationRef:h,isFormControl:m,bubbleInput:x}=wn(is,e),v=j(r,p),g=c.useRef(l);return c.useEffect(()=>{const k=a==null?void 0:a.form;if(k){const w=()=>u(g.current);return k.addEventListener("reset",w),()=>k.removeEventListener("reset",w)}},[a,u]),f.jsx(A.button,{type:"button",role:"checkbox","aria-checked":Ae(l)?"mixed":l,"aria-required":d,"data-state":fs(l),"data-disabled":i?"":void 0,disabled:i,value:s,...n,ref:v,onKeyDown:C(t,k=>{k.key==="Enter"&&k.preventDefault()}),onClick:C(o,k=>{u(w=>Ae(w)?!0:!w),x&&m&&(h.current=k.isPropagationStopped(),h.current||k.stopPropagation())})})});ls.displayName=is;var Ey=c.forwardRef((e,t)=>{const{__scopeCheckbox:o,name:n,checked:r,defaultChecked:a,required:s,disabled:i,value:l,onCheckedChange:d,form:p,...u}=e;return f.jsx(Sy,{__scopeCheckbox:o,checked:r,defaultChecked:a,disabled:i,required:s,onCheckedChange:d,name:n,form:p,value:l,internal_do_not_use_render:({isFormControl:h})=>f.jsxs(f.Fragment,{children:[f.jsx(ls,{...u,ref:t,__scopeCheckbox:o}),h&&f.jsx(ps,{__scopeCheckbox:o})]})})});Ey.displayName=mo;var ds="CheckboxIndicator",Ry=c.forwardRef((e,t)=>{const{__scopeCheckbox:o,forceMount:n,...r}=e,a=wn(ds,o);return f.jsx(ee,{present:n||Ae(a.checked)||a.checked===!0,children:f.jsx(A.span,{"data-state":fs(a.checked),"data-disabled":a.disabled?"":void 0,...r,ref:t,style:{pointerEvents:"none",...e.style}})})});Ry.displayName=ds;var us="CheckboxBubbleInput",ps=c.forwardRef(({__scopeCheckbox:e,...t},o)=>{const{control:n,hasConsumerStoppedPropagationRef:r,checked:a,defaultChecked:s,required:i,disabled:l,name:d,value:p,form:u,bubbleInput:h,setBubbleInput:m}=wn(us,e),x=j(o,m),v=bt(a),g=xt(n);c.useEffect(()=>{const w=h;if(!w)return;const b=window.HTMLInputElement.prototype,M=Object.getOwnPropertyDescriptor(b,"checked").set,E=!r.current;if(v!==a&&M){const S=new Event("click",{bubbles:E});w.indeterminate=Ae(a),M.call(w,Ae(a)?!1:a),w.dispatchEvent(S)}},[h,v,a,r]);const k=c.useRef(Ae(a)?!1:a);return f.jsx(A.input,{type:"checkbox","aria-hidden":!0,defaultChecked:s??k.current,required:i,disabled:l,name:d,value:p,form:u,...t,tabIndex:-1,ref:x,style:{...t.style,...g,position:"absolute",pointerEvents:"none",opacity:0,margin:0,transform:"translateX(-100%)"}})});ps.displayName=us;function Py(e){return typeof e=="function"}function Ae(e){return e==="indeterminate"}function fs(e){return Ae(e)?"indeterminate":e?"checked":"unchecked"}function Ay(e){const t=Ny(e),o=c.forwardRef((n,r)=>{const{children:a,...s}=n,i=c.Children.toArray(a),l=i.find($y);if(l){const d=l.props.children,p=i.map(u=>u===l?c.Children.count(d)>1?c.Children.only(null):c.isValidElement(d)?d.props.children:null:u);return f.jsx(t,{...s,ref:r,children:c.isValidElement(d)?c.cloneElement(d,void 0,p):null})}return f.jsx(t,{...s,ref:r,children:a})});return o.displayName=`${e}.Slot`,o}function Ny(e){const t=c.forwardRef((o,n)=>{const{children:r,...a}=o;if(c.isValidElement(r)){const s=Dy(r),i=Iy(a,r.props);return r.type!==c.Fragment&&(i.ref=n?be(n,s):s),c.cloneElement(r,i)}return c.Children.count(r)>1?c.Children.only(null):null});return t.displayName=`${e}.SlotClone`,t}var Ty=Symbol("radix.slottable");function $y(e){return c.isValidElement(e)&&typeof e.type=="function"&&"__radixId"in e.type&&e.type.__radixId===Ty}function Iy(e,t){const o={...t};for(const n in t){const r=e[n],a=t[n];/^on[A-Z]/.test(n)?r&&a?o[n]=(...i)=>{const l=a(...i);return r(...i),l}:r&&(o[n]=r):n==="style"?o[n]={...r,...a}:n==="className"&&(o[n]=[r,a].filter(Boolean).join(" "))}return{...e,...o}}function Dy(e){var n,r;let t=(n=Object.getOwnPropertyDescriptor(e.props,"ref"))==null?void 0:n.get,o=t&&"isReactWarning"in t&&t.isReactWarning;return o?e.ref:(t=(r=Object.getOwnPropertyDescriptor(e,"ref"))==null?void 0:r.get,o=t&&"isReactWarning"in t&&t.isReactWarning,o?e.props.ref:e.props.ref||e.ref)}var vo="Dialog",[hs,ys]=J(vo),[Oy,me]=hs(vo),ms=e=>{const{__scopeDialog:t,children:o,open:n,defaultOpen:r,onOpenChange:a,modal:s=!0}=e,i=c.useRef(null),l=c.useRef(null),[d,p]=oe({prop:n,defaultProp:r??!1,onChange:a,caller:vo});return f.jsx(Oy,{scope:t,triggerRef:i,contentRef:l,contentId:se(),titleId:se(),descriptionId:se(),open:d,onOpenChange:p,onOpenToggle:c.useCallback(()=>p(u=>!u),[p]),modal:s,children:o})};ms.displayName=vo;var vs="DialogTrigger",gs=c.forwardRef((e,t)=>{const{__scopeDialog:o,...n}=e,r=me(vs,o),a=j(t,r.triggerRef);return f.jsx(A.button,{type:"button","aria-haspopup":"dialog","aria-expanded":r.open,"aria-controls":r.contentId,"data-state":Mn(r.open),...n,ref:a,onClick:C(e.onClick,r.onOpenToggle)})});gs.displayName=vs;var bn="DialogPortal",[jy,xs]=hs(bn,{forceMount:void 0}),ks=e=>{const{__scopeDialog:t,forceMount:o,children:n,container:r}=e,a=me(bn,t);return f.jsx(jy,{scope:t,forceMount:o,children:c.Children.map(n,s=>f.jsx(ee,{present:o||a.open,children:f.jsx(Je,{asChild:!0,container:r,children:s})}))})};ks.displayName=bn;var Bt="DialogOverlay",ws=c.forwardRef((e,t)=>{const o=xs(Bt,e.__scopeDialog),{forceMount:n=o.forceMount,...r}=e,a=me(Bt,e.__scopeDialog);return a.modal?f.jsx(ee,{present:n||a.open,children:f.jsx(Fy,{...r,ref:t})}):null});ws.displayName=Bt;var Ly=Ay("DialogOverlay.RemoveScroll"),Fy=c.forwardRef((e,t)=>{const{__scopeDialog:o,...n}=e,r=me(Bt,o);return f.jsx(Gt,{as:Ly,allowPinchZoom:!0,shards:[r.contentRef],children:f.jsx(A.div,{"data-state":Mn(r.open),...n,ref:t,style:{pointerEvents:"auto",...n.style}})})}),ze="DialogContent",bs=c.forwardRef((e,t)=>{const o=xs(ze,e.__scopeDialog),{forceMount:n=o.forceMount,...r}=e,a=me(ze,e.__scopeDialog);return f.jsx(ee,{present:n||a.open,children:a.modal?f.jsx(Vy,{...r,ref:t}):f.jsx(zy,{...r,ref:t})})});bs.displayName=ze;var Vy=c.forwardRef((e,t)=>{const o=me(ze,e.__scopeDialog),n=c.useRef(null),r=j(t,o.contentRef,n);return c.useEffect(()=>{const a=n.current;if(a)return lo(a)},[]),f.jsx(_s,{...e,ref:r,trapFocus:o.open,disableOutsidePointerEvents:!0,onCloseAutoFocus:C(e.onCloseAutoFocus,a=>{var s;a.preventDefault(),(s=o.triggerRef.current)==null||s.focus()}),onPointerDownOutside:C(e.onPointerDownOutside,a=>{const s=a.detail.originalEvent,i=s.button===0&&s.ctrlKey===!0;(s.button===2||i)&&a.preventDefault()}),onFocusOutside:C(e.onFocusOutside,a=>a.preventDefault())})}),zy=c.forwardRef((e,t)=>{const o=me(ze,e.__scopeDialog),n=c.useRef(!1),r=c.useRef(!1);return f.jsx(_s,{...e,ref:t,trapFocus:!1,disableOutsidePointerEvents:!1,onCloseAutoFocus:a=>{var s,i;(s=e.onCloseAutoFocus)==null||s.call(e,a),a.defaultPrevented||(n.current||(i=o.triggerRef.current)==null||i.focus(),a.preventDefault()),n.current=!1,r.current=!1},onInteractOutside:a=>{var l,d;(l=e.onInteractOutside)==null||l.call(e,a),a.defaultPrevented||(n.current=!0,a.detail.originalEvent.type==="pointerdown"&&(r.current=!0));const s=a.target;((d=o.triggerRef.current)==null?void 0:d.contains(s))&&a.preventDefault(),a.detail.originalEvent.type==="focusin"&&r.current&&a.preventDefault()}})}),_s=c.forwardRef((e,t)=>{const{__scopeDialog:o,trapFocus:n,onOpenAutoFocus:r,onCloseAutoFocus:a,...s}=e,i=me(ze,o),l=c.useRef(null),d=j(t,l);return io(),f.jsxs(f.Fragment,{children:[f.jsx(_t,{asChild:!0,loop:!0,trapped:n,onMountAutoFocus:r,onUnmountAutoFocus:a,children:f.jsx(He,{role:"dialog",id:i.contentId,"aria-describedby":i.descriptionId,"aria-labelledby":i.titleId,"data-state":Mn(i.open),...s,ref:d,onDismiss:()=>i.onOpenChange(!1)})}),f.jsxs(f.Fragment,{children:[f.jsx(By,{titleId:i.titleId}),f.jsx(Wy,{contentRef:l,descriptionId:i.descriptionId})]})]})}),_n="DialogTitle",Ms=c.forwardRef((e,t)=>{const{__scopeDialog:o,...n}=e,r=me(_n,o);return f.jsx(A.h2,{id:r.titleId,...n,ref:t})});Ms.displayName=_n;var Cs="DialogDescription",Ss=c.forwardRef((e,t)=>{const{__scopeDialog:o,...n}=e,r=me(Cs,o);return f.jsx(A.p,{id:r.descriptionId,...n,ref:t})});Ss.displayName=Cs;var Es="DialogClose",Rs=c.forwardRef((e,t)=>{const{__scopeDialog:o,...n}=e,r=me(Es,o);return f.jsx(A.button,{type:"button",...n,ref:t,onClick:C(e.onClick,()=>r.onOpenChange(!1))})});Rs.displayName=Es;function Mn(e){return e?"open":"closed"}var Ps="DialogTitleWarning",[Hy,As]=nl(Ps,{contentName:ze,titleName:_n,docsSlug:"dialog"}),By=({titleId:e})=>{const t=As(Ps),o=`\`${t.contentName}\` requires a \`${t.titleName}\` for the component to be accessible for screen reader users.

If you want to hide the \`${t.titleName}\`, you can wrap it with our VisuallyHidden component.

For more information, see https://radix-ui.com/primitives/docs/components/${t.docsSlug}`;return c.useEffect(()=>{e&&(document.getElementById(e)||console.error(o))},[o,e]),null},qy="DialogDescriptionWarning",Wy=({contentRef:e,descriptionId:t})=>{const n=`Warning: Missing \`Description\` or \`aria-describedby={undefined}\` for {${As(qy).contentName}}.`;return c.useEffect(()=>{var a;const r=(a=e.current)==null?void 0:a.getAttribute("aria-describedby");t&&r&&(document.getElementById(t)||console.warn(n))},[n,e,t]),null},Uy=ms,Ky=gs,Gy=ks,Yy=ws,Xy=bs,Zy=Ms,Qy=Ss,Ns=Rs,Do="rovingFocusGroup.onEntryFocus",Jy={bubbles:!1,cancelable:!0},Mt="RovingFocusGroup",[Xo,Ts,em]=Qe(Mt),[tm,nt]=J(Mt,[em]),[om,nm]=tm(Mt),$s=c.forwardRef((e,t)=>f.jsx(Xo.Provider,{scope:e.__scopeRovingFocusGroup,children:f.jsx(Xo.Slot,{scope:e.__scopeRovingFocusGroup,children:f.jsx(rm,{...e,ref:t})})}));$s.displayName=Mt;var rm=c.forwardRef((e,t)=>{const{__scopeRovingFocusGroup:o,orientation:n,loop:r=!1,dir:a,currentTabStopId:s,defaultCurrentTabStopId:i,onCurrentTabStopIdChange:l,onEntryFocus:d,preventScrollOnEntryFocus:p=!1,...u}=e,h=c.useRef(null),m=j(t,h),x=Ie(a),[v,g]=oe({prop:s,defaultProp:i??null,onChange:l,caller:Mt}),[k,w]=c.useState(!1),b=X(d),_=Ts(o),M=c.useRef(!1),[E,S]=c.useState(0);return c.useEffect(()=>{const N=h.current;if(N)return N.addEventListener(Do,b),()=>N.removeEventListener(Do,b)},[b]),f.jsx(om,{scope:o,orientation:n,dir:x,loop:r,currentTabStopId:v,onItemFocus:c.useCallback(N=>g(N),[g]),onItemShiftTab:c.useCallback(()=>w(!0),[]),onFocusableItemAdd:c.useCallback(()=>S(N=>N+1),[]),onFocusableItemRemove:c.useCallback(()=>S(N=>N-1),[]),children:f.jsx(A.div,{tabIndex:k||E===0?-1:0,"data-orientation":n,...u,ref:m,style:{outline:"none",...e.style},onMouseDown:C(e.onMouseDown,()=>{M.current=!0}),onFocus:C(e.onFocus,N=>{const T=!M.current;if(N.target===N.currentTarget&&T&&!k){const I=new CustomEvent(Do,Jy);if(N.currentTarget.dispatchEvent(I),!I.defaultPrevented){const D=_().filter(O=>O.focusable),F=D.find(O=>O.active),V=D.find(O=>O.id===v),H=[F,V,...D].filter(Boolean).map(O=>O.ref.current);Os(H,p)}}M.current=!1}),onBlur:C(e.onBlur,()=>w(!1))})})}),Is="RovingFocusGroupItem",Ds=c.forwardRef((e,t)=>{const{__scopeRovingFocusGroup:o,focusable:n=!0,active:r=!1,tabStopId:a,children:s,...i}=e,l=se(),d=a||l,p=nm(Is,o),u=p.currentTabStopId===d,h=Ts(o),{onFocusableItemAdd:m,onFocusableItemRemove:x,currentTabStopId:v}=p;return c.useEffect(()=>{if(n)return m(),()=>x()},[n,m,x]),f.jsx(Xo.ItemSlot,{scope:o,id:d,focusable:n,active:r,children:f.jsx(A.span,{tabIndex:u?0:-1,"data-orientation":p.orientation,...i,ref:t,onMouseDown:C(e.onMouseDown,g=>{n?p.onItemFocus(d):g.preventDefault()}),onFocus:C(e.onFocus,()=>p.onItemFocus(d)),onKeyDown:C(e.onKeyDown,g=>{if(g.key==="Tab"&&g.shiftKey){p.onItemShiftTab();return}if(g.target!==g.currentTarget)return;const k=cm(g,p.orientation,p.dir);if(k!==void 0){if(g.metaKey||g.ctrlKey||g.altKey||g.shiftKey)return;g.preventDefault();let b=h().filter(_=>_.focusable).map(_=>_.ref.current);if(k==="last")b.reverse();else if(k==="prev"||k==="next"){k==="prev"&&b.reverse();const _=b.indexOf(g.currentTarget);b=p.loop?im(b,_+1):b.slice(_+1)}setTimeout(()=>Os(b))}}),children:typeof s=="function"?s({isCurrentTabStop:u,hasTabStop:v!=null}):s})})});Ds.displayName=Is;var am={ArrowLeft:"prev",ArrowUp:"prev",ArrowRight:"next",ArrowDown:"next",PageUp:"first",Home:"first",PageDown:"last",End:"last"};function sm(e,t){return t!=="rtl"?e:e==="ArrowLeft"?"ArrowRight":e==="ArrowRight"?"ArrowLeft":e}function cm(e,t,o){const n=sm(e.key,o);if(!(t==="vertical"&&["ArrowLeft","ArrowRight"].includes(n))&&!(t==="horizontal"&&["ArrowUp","ArrowDown"].includes(n)))return am[n]}function Os(e,t=!1){const o=document.activeElement;for(const n of e)if(n===o||(n.focus({preventScroll:t}),document.activeElement!==o))return}function im(e,t){return e.map((o,n)=>e[(t+n)%e.length])}var Cn=$s,Sn=Ds,go="Tabs",[lm]=J(go,[nt]),js=nt(),[dm,En]=lm(go),Ls=c.forwardRef((e,t)=>{const{__scopeTabs:o,value:n,onValueChange:r,defaultValue:a,orientation:s="horizontal",dir:i,activationMode:l="automatic",...d}=e,p=Ie(i),[u,h]=oe({prop:n,onChange:r,defaultProp:a??"",caller:go});return f.jsx(dm,{scope:o,baseId:se(),value:u,onValueChange:h,orientation:s,dir:p,activationMode:l,children:f.jsx(A.div,{dir:p,"data-orientation":s,...d,ref:t})})});Ls.displayName=go;var Fs="TabsList",Vs=c.forwardRef((e,t)=>{const{__scopeTabs:o,loop:n=!0,...r}=e,a=En(Fs,o),s=js(o);return f.jsx(Cn,{asChild:!0,...s,orientation:a.orientation,dir:a.dir,loop:n,children:f.jsx(A.div,{role:"tablist","aria-orientation":a.orientation,...r,ref:t})})});Vs.displayName=Fs;var zs="TabsTrigger",Hs=c.forwardRef((e,t)=>{const{__scopeTabs:o,value:n,disabled:r=!1,...a}=e,s=En(zs,o),i=js(o),l=Ws(s.baseId,n),d=Us(s.baseId,n),p=n===s.value;return f.jsx(Sn,{asChild:!0,...i,focusable:!r,active:p,children:f.jsx(A.button,{type:"button",role:"tab","aria-selected":p,"aria-controls":d,"data-state":p?"active":"inactive","data-disabled":r?"":void 0,disabled:r,id:l,...a,ref:t,onMouseDown:C(e.onMouseDown,u=>{!r&&u.button===0&&u.ctrlKey===!1?s.onValueChange(n):u.preventDefault()}),onKeyDown:C(e.onKeyDown,u=>{[" ","Enter"].includes(u.key)&&s.onValueChange(n)}),onFocus:C(e.onFocus,()=>{const u=s.activationMode!=="manual";!p&&!r&&u&&s.onValueChange(n)})})})});Hs.displayName=zs;var Bs="TabsContent",qs=c.forwardRef((e,t)=>{const{__scopeTabs:o,value:n,forceMount:r,children:a,...s}=e,i=En(Bs,o),l=Ws(i.baseId,n),d=Us(i.baseId,n),p=n===i.value,u=c.useRef(p);return c.useEffect(()=>{const h=requestAnimationFrame(()=>u.current=!1);return()=>cancelAnimationFrame(h)},[]),f.jsx(ee,{present:r||p,children:({present:h})=>f.jsx(A.div,{"data-state":p?"active":"inactive","data-orientation":i.orientation,role:"tabpanel","aria-labelledby":l,hidden:!h,id:d,tabIndex:0,...s,ref:t,style:{...e.style,animationDuration:u.current?"0s":void 0},children:h&&a})})});qs.displayName=Bs;function Ws(e,t){return`${e}-trigger-${t}`}function Us(e,t){return`${e}-content-${t}`}var ib=Ls,lb=Vs,db=Hs,ub=qs,um=["a","button","div","form","h2","h3","img","input","label","li","nav","ol","p","select","span","svg","ul"],pm=um.reduce((e,t)=>{const o=wt(`Primitive.${t}`),n=c.forwardRef((r,a)=>{const{asChild:s,...i}=r,l=s?o:t;return typeof window<"u"&&(window[Symbol.for("radix-ui")]=!0),f.jsx(l,{...i,ref:a})});return n.displayName=`Primitive.${t}`,{...e,[t]:n}},{}),fm="Separator",vr="horizontal",hm=["horizontal","vertical"],Ks=c.forwardRef((e,t)=>{const{decorative:o,orientation:n=vr,...r}=e,a=ym(n)?n:vr,i=o?{role:"none"}:{"aria-orientation":a==="vertical"?a:void 0,role:"separator"};return f.jsx(pm.div,{"data-orientation":a,...i,...r,ref:t})});Ks.displayName=fm;function ym(e){return hm.includes(e)}var pb=Ks,mm=Symbol("radix.slottable");function vm(e){const t=({children:o})=>f.jsx(f.Fragment,{children:o});return t.displayName=`${e}.Slottable`,t.__radixId=mm,t}var Gs="AlertDialog",[gm]=J(Gs,[ys]),Re=ys(),Ys=e=>{const{__scopeAlertDialog:t,...o}=e,n=Re(t);return f.jsx(Uy,{...n,...o,modal:!0})};Ys.displayName=Gs;var xm="AlertDialogTrigger",Xs=c.forwardRef((e,t)=>{const{__scopeAlertDialog:o,...n}=e,r=Re(o);return f.jsx(Ky,{...r,...n,ref:t})});Xs.displayName=xm;var km="AlertDialogPortal",Zs=e=>{const{__scopeAlertDialog:t,...o}=e,n=Re(t);return f.jsx(Gy,{...n,...o})};Zs.displayName=km;var wm="AlertDialogOverlay",Qs=c.forwardRef((e,t)=>{const{__scopeAlertDialog:o,...n}=e,r=Re(o);return f.jsx(Yy,{...r,...n,ref:t})});Qs.displayName=wm;var Ke="AlertDialogContent",[bm,_m]=gm(Ke),Mm=vm("AlertDialogContent"),Js=c.forwardRef((e,t)=>{const{__scopeAlertDialog:o,children:n,...r}=e,a=Re(o),s=c.useRef(null),i=j(t,s),l=c.useRef(null);return f.jsx(Hy,{contentName:Ke,titleName:ec,docsSlug:"alert-dialog",children:f.jsx(bm,{scope:o,cancelRef:l,children:f.jsxs(Xy,{role:"alertdialog",...a,...r,ref:i,onOpenAutoFocus:C(r.onOpenAutoFocus,d=>{var p;d.preventDefault(),(p=l.current)==null||p.focus({preventScroll:!0})}),onPointerDownOutside:d=>d.preventDefault(),onInteractOutside:d=>d.preventDefault(),children:[f.jsx(Mm,{children:n}),f.jsx(Sm,{contentRef:s})]})})})});Js.displayName=Ke;var ec="AlertDialogTitle",tc=c.forwardRef((e,t)=>{const{__scopeAlertDialog:o,...n}=e,r=Re(o);return f.jsx(Zy,{...r,...n,ref:t})});tc.displayName=ec;var oc="AlertDialogDescription",nc=c.forwardRef((e,t)=>{const{__scopeAlertDialog:o,...n}=e,r=Re(o);return f.jsx(Qy,{...r,...n,ref:t})});nc.displayName=oc;var Cm="AlertDialogAction",rc=c.forwardRef((e,t)=>{const{__scopeAlertDialog:o,...n}=e,r=Re(o);return f.jsx(Ns,{...r,...n,ref:t})});rc.displayName=Cm;var ac="AlertDialogCancel",sc=c.forwardRef((e,t)=>{const{__scopeAlertDialog:o,...n}=e,{cancelRef:r}=_m(ac,o),a=Re(o),s=j(t,r);return f.jsx(Ns,{...a,...n,ref:s})});sc.displayName=ac;var Sm=({contentRef:e})=>{const t=`\`${Ke}\` requires a description for the component to be accessible for screen reader users.

You can add a description to the \`${Ke}\` by passing a \`${oc}\` component as a child, which also benefits sighted users by adding visible context to the dialog.

Alternatively, you can use your own component as a description by assigning it an \`id\` and passing the same value to the \`aria-describedby\` prop in \`${Ke}\`. If the description is confusing or duplicative for sighted users, you can use the \`@radix-ui/react-visually-hidden\` primitive as a wrapper around your description component.

For more information, see https://radix-ui.com/primitives/docs/components/alert-dialog`;return c.useEffect(()=>{var n;document.getElementById((n=e.current)==null?void 0:n.getAttribute("aria-describedby"))||console.warn(t)},[t,e]),null},fb=Ys,hb=Xs,yb=Zs,mb=Qs,vb=Js,gb=rc,xb=sc,kb=tc,wb=nc;function Em(e,t=[]){let o=[];function n(a,s){const i=c.createContext(s);i.displayName=a+"Context";const l=o.length;o=[...o,s];const d=u=>{var k;const{scope:h,children:m,...x}=u,v=((k=h==null?void 0:h[e])==null?void 0:k[l])||i,g=c.useMemo(()=>x,Object.values(x));return f.jsx(v.Provider,{value:g,children:m})};d.displayName=a+"Provider";function p(u,h){var v;const m=((v=h==null?void 0:h[e])==null?void 0:v[l])||i,x=c.useContext(m);if(x)return x;if(s!==void 0)return s;throw new Error(`\`${u}\` must be used within \`${a}\``)}return[d,p]}const r=()=>{const a=o.map(s=>c.createContext(s));return function(i){const l=(i==null?void 0:i[e])||a;return c.useMemo(()=>({[`__scope${e}`]:{...i,[e]:l}}),[i,l])}};return r.scopeName=e,[n,Rm(r,...t)]}function Rm(...e){const t=e[0];if(e.length===1)return t;const o=()=>{const n=e.map(r=>({useScope:r(),scopeName:r.scopeName}));return function(a){const s=n.reduce((i,{useScope:l,scopeName:d})=>{const u=l(a)[`__scope${d}`];return{...i,...u}},{});return c.useMemo(()=>({[`__scope${t.scopeName}`]:s}),[s])}};return o.scopeName=t.scopeName,o}var Pm=["a","button","div","form","h2","h3","img","input","label","li","nav","ol","p","select","span","svg","ul"],Rn=Pm.reduce((e,t)=>{const o=wt(`Primitive.${t}`),n=c.forwardRef((r,a)=>{const{asChild:s,...i}=r,l=s?o:t;return typeof window<"u"&&(window[Symbol.for("radix-ui")]=!0),f.jsx(l,{...i,ref:a})});return n.displayName=`Primitive.${t}`,{...e,[t]:n}},{});function Am(){return ol.useSyncExternalStore(Nm,()=>!0,()=>!1)}function Nm(){return()=>{}}var Pn="Avatar",[Tm]=Em(Pn),[$m,cc]=Tm(Pn),ic=c.forwardRef((e,t)=>{const{__scopeAvatar:o,...n}=e,[r,a]=c.useState("idle");return f.jsx($m,{scope:o,imageLoadingStatus:r,onImageLoadingStatusChange:a,children:f.jsx(Rn.span,{...n,ref:t})})});ic.displayName=Pn;var lc="AvatarImage",dc=c.forwardRef((e,t)=>{const{__scopeAvatar:o,src:n,onLoadingStatusChange:r=()=>{},...a}=e,s=cc(lc,o),i=Im(n,a),l=X(d=>{r(d),s.onImageLoadingStatusChange(d)});return Z(()=>{i!=="idle"&&l(i)},[i,l]),i==="loaded"?f.jsx(Rn.img,{...a,ref:t,src:n}):null});dc.displayName=lc;var uc="AvatarFallback",pc=c.forwardRef((e,t)=>{const{__scopeAvatar:o,delayMs:n,...r}=e,a=cc(uc,o),[s,i]=c.useState(n===void 0);return c.useEffect(()=>{if(n!==void 0){const l=window.setTimeout(()=>i(!0),n);return()=>window.clearTimeout(l)}},[n]),s&&a.imageLoadingStatus!=="loaded"?f.jsx(Rn.span,{...r,ref:t}):null});pc.displayName=uc;function gr(e,t){return e?t?(e.src!==t&&(e.src=t),e.complete&&e.naturalWidth>0?"loaded":"loading"):"error":"idle"}function Im(e,{referrerPolicy:t,crossOrigin:o}){const n=Am(),r=c.useRef(null),a=n?(r.current||(r.current=new window.Image),r.current):null,[s,i]=c.useState(()=>gr(a,e));return Z(()=>{i(gr(a,e))},[a,e]),Z(()=>{const l=u=>()=>{i(u)};if(!a)return;const d=l("loaded"),p=l("error");return a.addEventListener("load",d),a.addEventListener("error",p),t&&(a.referrerPolicy=t),typeof o=="string"&&(a.crossOrigin=o),()=>{a.removeEventListener("load",d),a.removeEventListener("error",p)}},[a,o,t]),s}var bb=ic,_b=dc,Mb=pc,fc=["PageUp","PageDown"],hc=["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"],yc={"from-left":["Home","PageDown","ArrowDown","ArrowLeft"],"from-right":["Home","PageDown","ArrowDown","ArrowRight"],"from-bottom":["Home","PageDown","ArrowDown","ArrowLeft"],"from-top":["Home","PageDown","ArrowUp","ArrowLeft"]},rt="Slider",[Zo,Dm,Om]=Qe(rt),[mc]=J(rt,[Om]),[jm,xo]=mc(rt),vc=c.forwardRef((e,t)=>{const{name:o,min:n=0,max:r=100,step:a=1,orientation:s="horizontal",disabled:i=!1,minStepsBetweenThumbs:l=0,defaultValue:d=[n],value:p,onValueChange:u=()=>{},onValueCommit:h=()=>{},inverted:m=!1,form:x,...v}=e,g=c.useRef(new Set),k=c.useRef(0),b=s==="horizontal"?Lm:Fm,[_=[],M]=oe({prop:p,defaultProp:d,onChange:D=>{var V;(V=[...g.current][k.current])==null||V.focus(),u(D)}}),E=c.useRef(_);function S(D){const F=qm(_,D);I(D,F)}function N(D){I(D,k.current)}function T(){const D=E.current[k.current];_[k.current]!==D&&h(_)}function I(D,F,{commit:V}={commit:!1}){const R=Gm(a),H=Ym(Math.round((D-n)/a)*a+n,R),O=ft(H,[n,r]);M((z=[])=>{const $=Hm(z,O,F);if(Km($,l*a)){k.current=$.indexOf(O);const P=String($)!==String(z);return P&&V&&h($),P?$:z}else return z})}return f.jsx(jm,{scope:e.__scopeSlider,name:o,disabled:i,min:n,max:r,valueIndexToChangeRef:k,thumbs:g.current,values:_,orientation:s,form:x,children:f.jsx(Zo.Provider,{scope:e.__scopeSlider,children:f.jsx(Zo.Slot,{scope:e.__scopeSlider,children:f.jsx(b,{"aria-disabled":i,"data-disabled":i?"":void 0,...v,ref:t,onPointerDown:C(v.onPointerDown,()=>{i||(E.current=_)}),min:n,max:r,inverted:m,onSlideStart:i?void 0:S,onSlideMove:i?void 0:N,onSlideEnd:i?void 0:T,onHomeKeyDown:()=>!i&&I(n,0,{commit:!0}),onEndKeyDown:()=>!i&&I(r,_.length-1,{commit:!0}),onStepKeyDown:({event:D,direction:F})=>{if(!i){const H=fc.includes(D.key)||D.shiftKey&&hc.includes(D.key)?10:1,O=k.current,z=_[O],$=a*H*F;I(z+$,O,{commit:!0})}}})})})})});vc.displayName=rt;var[gc,xc]=mc(rt,{startEdge:"left",endEdge:"right",size:"width",direction:1}),Lm=c.forwardRef((e,t)=>{const{min:o,max:n,dir:r,inverted:a,onSlideStart:s,onSlideMove:i,onSlideEnd:l,onStepKeyDown:d,...p}=e,[u,h]=c.useState(null),m=j(t,b=>h(b)),x=c.useRef(void 0),v=Ie(r),g=v==="ltr",k=g&&!a||!g&&a;function w(b){const _=x.current||u.getBoundingClientRect(),M=[0,_.width],S=An(M,k?[o,n]:[n,o]);return x.current=_,S(b-_.left)}return f.jsx(gc,{scope:e.__scopeSlider,startEdge:k?"left":"right",endEdge:k?"right":"left",direction:k?1:-1,size:"width",children:f.jsx(kc,{dir:v,"data-orientation":"horizontal",...p,ref:m,style:{...p.style,"--radix-slider-thumb-transform":"translateX(-50%)"},onSlideStart:b=>{const _=w(b.clientX);s==null||s(_)},onSlideMove:b=>{const _=w(b.clientX);i==null||i(_)},onSlideEnd:()=>{x.current=void 0,l==null||l()},onStepKeyDown:b=>{const M=yc[k?"from-left":"from-right"].includes(b.key);d==null||d({event:b,direction:M?-1:1})}})})}),Fm=c.forwardRef((e,t)=>{const{min:o,max:n,inverted:r,onSlideStart:a,onSlideMove:s,onSlideEnd:i,onStepKeyDown:l,...d}=e,p=c.useRef(null),u=j(t,p),h=c.useRef(void 0),m=!r;function x(v){const g=h.current||p.current.getBoundingClientRect(),k=[0,g.height],b=An(k,m?[n,o]:[o,n]);return h.current=g,b(v-g.top)}return f.jsx(gc,{scope:e.__scopeSlider,startEdge:m?"bottom":"top",endEdge:m?"top":"bottom",size:"height",direction:m?1:-1,children:f.jsx(kc,{"data-orientation":"vertical",...d,ref:u,style:{...d.style,"--radix-slider-thumb-transform":"translateY(50%)"},onSlideStart:v=>{const g=x(v.clientY);a==null||a(g)},onSlideMove:v=>{const g=x(v.clientY);s==null||s(g)},onSlideEnd:()=>{h.current=void 0,i==null||i()},onStepKeyDown:v=>{const k=yc[m?"from-bottom":"from-top"].includes(v.key);l==null||l({event:v,direction:k?-1:1})}})})}),kc=c.forwardRef((e,t)=>{const{__scopeSlider:o,onSlideStart:n,onSlideMove:r,onSlideEnd:a,onHomeKeyDown:s,onEndKeyDown:i,onStepKeyDown:l,...d}=e,p=xo(rt,o);return f.jsx(A.span,{...d,ref:t,onKeyDown:C(e.onKeyDown,u=>{u.key==="Home"?(s(u),u.preventDefault()):u.key==="End"?(i(u),u.preventDefault()):fc.concat(hc).includes(u.key)&&(l(u),u.preventDefault())}),onPointerDown:C(e.onPointerDown,u=>{const h=u.target;h.setPointerCapture(u.pointerId),u.preventDefault(),p.thumbs.has(h)?h.focus():n(u)}),onPointerMove:C(e.onPointerMove,u=>{u.target.hasPointerCapture(u.pointerId)&&r(u)}),onPointerUp:C(e.onPointerUp,u=>{const h=u.target;h.hasPointerCapture(u.pointerId)&&(h.releasePointerCapture(u.pointerId),a(u))})})}),wc="SliderTrack",bc=c.forwardRef((e,t)=>{const{__scopeSlider:o,...n}=e,r=xo(wc,o);return f.jsx(A.span,{"data-disabled":r.disabled?"":void 0,"data-orientation":r.orientation,...n,ref:t})});bc.displayName=wc;var Qo="SliderRange",_c=c.forwardRef((e,t)=>{const{__scopeSlider:o,...n}=e,r=xo(Qo,o),a=xc(Qo,o),s=c.useRef(null),i=j(t,s),l=r.values.length,d=r.values.map(h=>Sc(h,r.min,r.max)),p=l>1?Math.min(...d):0,u=100-Math.max(...d);return f.jsx(A.span,{"data-orientation":r.orientation,"data-disabled":r.disabled?"":void 0,...n,ref:i,style:{...e.style,[a.startEdge]:p+"%",[a.endEdge]:u+"%"}})});_c.displayName=Qo;var Jo="SliderThumb",Mc=c.forwardRef((e,t)=>{const o=Dm(e.__scopeSlider),[n,r]=c.useState(null),a=j(t,i=>r(i)),s=c.useMemo(()=>n?o().findIndex(i=>i.ref.current===n):-1,[o,n]);return f.jsx(Vm,{...e,ref:a,index:s})}),Vm=c.forwardRef((e,t)=>{const{__scopeSlider:o,index:n,name:r,...a}=e,s=xo(Jo,o),i=xc(Jo,o),[l,d]=c.useState(null),p=j(t,w=>d(w)),u=l?s.form||!!l.closest("form"):!0,h=xt(l),m=s.values[n],x=m===void 0?0:Sc(m,s.min,s.max),v=Bm(n,s.values.length),g=h==null?void 0:h[i.size],k=g?Wm(g,x,i.direction):0;return c.useEffect(()=>{if(l)return s.thumbs.add(l),()=>{s.thumbs.delete(l)}},[l,s.thumbs]),f.jsxs("span",{style:{transform:"var(--radix-slider-thumb-transform)",position:"absolute",[i.startEdge]:`calc(${x}% + ${k}px)`},children:[f.jsx(Zo.ItemSlot,{scope:e.__scopeSlider,children:f.jsx(A.span,{role:"slider","aria-label":e["aria-label"]||v,"aria-valuemin":s.min,"aria-valuenow":m,"aria-valuemax":s.max,"aria-orientation":s.orientation,"data-orientation":s.orientation,"data-disabled":s.disabled?"":void 0,tabIndex:s.disabled?void 0:0,...a,ref:p,style:m===void 0?{display:"none"}:e.style,onFocus:C(e.onFocus,()=>{s.valueIndexToChangeRef.current=n})})}),u&&f.jsx(Cc,{name:r??(s.name?s.name+(s.values.length>1?"[]":""):void 0),form:s.form,value:m},n)]})});Mc.displayName=Jo;var zm="RadioBubbleInput",Cc=c.forwardRef(({__scopeSlider:e,value:t,...o},n)=>{const r=c.useRef(null),a=j(r,n),s=bt(t);return c.useEffect(()=>{const i=r.current;if(!i)return;const l=window.HTMLInputElement.prototype,p=Object.getOwnPropertyDescriptor(l,"value").set;if(s!==t&&p){const u=new Event("input",{bubbles:!0});p.call(i,t),i.dispatchEvent(u)}},[s,t]),f.jsx(A.input,{style:{display:"none"},...o,ref:a,defaultValue:t})});Cc.displayName=zm;function Hm(e=[],t,o){const n=[...e];return n[o]=t,n.sort((r,a)=>r-a)}function Sc(e,t,o){const a=100/(o-t)*(e-t);return ft(a,[0,100])}function Bm(e,t){return t>2?`Value ${e+1} of ${t}`:t===2?["Minimum","Maximum"][e]:void 0}function qm(e,t){if(e.length===1)return 0;const o=e.map(r=>Math.abs(r-t)),n=Math.min(...o);return o.indexOf(n)}function Wm(e,t,o){const n=e/2,a=An([0,50],[0,n]);return(n-a(t)*o)*o}function Um(e){return e.slice(0,-1).map((t,o)=>e[o+1]-t)}function Km(e,t){if(t>0){const o=Um(e);return Math.min(...o)>=t}return!0}function An(e,t){return o=>{if(e[0]===e[1]||t[0]===t[1])return t[0];const n=(t[1]-t[0])/(e[1]-e[0]);return t[0]+n*(o-e[0])}}function Gm(e){return(String(e).split(".")[1]||"").length}function Ym(e,t){const o=Math.pow(10,t);return Math.round(e*o)/o}var Cb=vc,Sb=bc,Eb=_c,Rb=Mc;function Xm(e){const t=Zm(e),o=c.forwardRef((n,r)=>{const{children:a,...s}=n,i=c.Children.toArray(a),l=i.find(Jm);if(l){const d=l.props.children,p=i.map(u=>u===l?c.Children.count(d)>1?c.Children.only(null):c.isValidElement(d)?d.props.children:null:u);return f.jsx(t,{...s,ref:r,children:c.isValidElement(d)?c.cloneElement(d,void 0,p):null})}return f.jsx(t,{...s,ref:r,children:a})});return o.displayName=`${e}.Slot`,o}function Zm(e){const t=c.forwardRef((o,n)=>{const{children:r,...a}=o;if(c.isValidElement(r)){const s=tv(r),i=ev(a,r.props);return r.type!==c.Fragment&&(i.ref=n?be(n,s):s),c.cloneElement(r,i)}return c.Children.count(r)>1?c.Children.only(null):null});return t.displayName=`${e}.SlotClone`,t}var Qm=Symbol("radix.slottable");function Jm(e){return c.isValidElement(e)&&typeof e.type=="function"&&"__radixId"in e.type&&e.type.__radixId===Qm}function ev(e,t){const o={...t};for(const n in t){const r=e[n],a=t[n];/^on[A-Z]/.test(n)?r&&a?o[n]=(...i)=>{const l=a(...i);return r(...i),l}:r&&(o[n]=r):n==="style"?o[n]={...r,...a}:n==="className"&&(o[n]=[r,a].filter(Boolean).join(" "))}return{...e,...o}}function tv(e){var n,r;let t=(n=Object.getOwnPropertyDescriptor(e.props,"ref"))==null?void 0:n.get,o=t&&"isReactWarning"in t&&t.isReactWarning;return o?e.ref:(t=(r=Object.getOwnPropertyDescriptor(e,"ref"))==null?void 0:r.get,o=t&&"isReactWarning"in t&&t.isReactWarning,o?e.props.ref:e.props.ref||e.ref)}var ko="Popover",[Ec]=J(ko,[$e]),Ct=$e(),[ov,je]=Ec(ko),Rc=e=>{const{__scopePopover:t,children:o,open:n,defaultOpen:r,onOpenChange:a,modal:s=!1}=e,i=Ct(t),l=c.useRef(null),[d,p]=c.useState(!1),[u,h]=oe({prop:n,defaultProp:r??!1,onChange:a,caller:ko});return f.jsx(to,{...i,children:f.jsx(ov,{scope:t,contentId:se(),triggerRef:l,open:u,onOpenChange:h,onOpenToggle:c.useCallback(()=>h(m=>!m),[h]),hasCustomAnchor:d,onCustomAnchorAdd:c.useCallback(()=>p(!0),[]),onCustomAnchorRemove:c.useCallback(()=>p(!1),[]),modal:s,children:o})})};Rc.displayName=ko;var Pc="PopoverAnchor",nv=c.forwardRef((e,t)=>{const{__scopePopover:o,...n}=e,r=je(Pc,o),a=Ct(o),{onCustomAnchorAdd:s,onCustomAnchorRemove:i}=r;return c.useEffect(()=>(s(),()=>i()),[s,i]),f.jsx(kt,{...a,...n,ref:t})});nv.displayName=Pc;var Ac="PopoverTrigger",Nc=c.forwardRef((e,t)=>{const{__scopePopover:o,...n}=e,r=je(Ac,o),a=Ct(o),s=j(t,r.triggerRef),i=f.jsx(A.button,{type:"button","aria-haspopup":"dialog","aria-expanded":r.open,"aria-controls":r.contentId,"data-state":Oc(r.open),...n,ref:s,onClick:C(e.onClick,r.onOpenToggle)});return r.hasCustomAnchor?i:f.jsx(kt,{asChild:!0,...a,children:i})});Nc.displayName=Ac;var Nn="PopoverPortal",[rv,av]=Ec(Nn,{forceMount:void 0}),Tc=e=>{const{__scopePopover:t,forceMount:o,children:n,container:r}=e,a=je(Nn,t);return f.jsx(rv,{scope:t,forceMount:o,children:f.jsx(ee,{present:o||a.open,children:f.jsx(Je,{asChild:!0,container:r,children:n})})})};Tc.displayName=Nn;var Ze="PopoverContent",$c=c.forwardRef((e,t)=>{const o=av(Ze,e.__scopePopover),{forceMount:n=o.forceMount,...r}=e,a=je(Ze,e.__scopePopover);return f.jsx(ee,{present:n||a.open,children:a.modal?f.jsx(cv,{...r,ref:t}):f.jsx(iv,{...r,ref:t})})});$c.displayName=Ze;var sv=Xm("PopoverContent.RemoveScroll"),cv=c.forwardRef((e,t)=>{const o=je(Ze,e.__scopePopover),n=c.useRef(null),r=j(t,n),a=c.useRef(!1);return c.useEffect(()=>{const s=n.current;if(s)return lo(s)},[]),f.jsx(Gt,{as:sv,allowPinchZoom:!0,children:f.jsx(Ic,{...e,ref:r,trapFocus:o.open,disableOutsidePointerEvents:!0,onCloseAutoFocus:C(e.onCloseAutoFocus,s=>{var i;s.preventDefault(),a.current||(i=o.triggerRef.current)==null||i.focus()}),onPointerDownOutside:C(e.onPointerDownOutside,s=>{const i=s.detail.originalEvent,l=i.button===0&&i.ctrlKey===!0,d=i.button===2||l;a.current=d},{checkForDefaultPrevented:!1}),onFocusOutside:C(e.onFocusOutside,s=>s.preventDefault(),{checkForDefaultPrevented:!1})})})}),iv=c.forwardRef((e,t)=>{const o=je(Ze,e.__scopePopover),n=c.useRef(!1),r=c.useRef(!1);return f.jsx(Ic,{...e,ref:t,trapFocus:!1,disableOutsidePointerEvents:!1,onCloseAutoFocus:a=>{var s,i;(s=e.onCloseAutoFocus)==null||s.call(e,a),a.defaultPrevented||(n.current||(i=o.triggerRef.current)==null||i.focus(),a.preventDefault()),n.current=!1,r.current=!1},onInteractOutside:a=>{var l,d;(l=e.onInteractOutside)==null||l.call(e,a),a.defaultPrevented||(n.current=!0,a.detail.originalEvent.type==="pointerdown"&&(r.current=!0));const s=a.target;((d=o.triggerRef.current)==null?void 0:d.contains(s))&&a.preventDefault(),a.detail.originalEvent.type==="focusin"&&r.current&&a.preventDefault()}})}),Ic=c.forwardRef((e,t)=>{const{__scopePopover:o,trapFocus:n,onOpenAutoFocus:r,onCloseAutoFocus:a,disableOutsidePointerEvents:s,onEscapeKeyDown:i,onPointerDownOutside:l,onFocusOutside:d,onInteractOutside:p,...u}=e,h=je(Ze,o),m=Ct(o);return io(),f.jsx(_t,{asChild:!0,loop:!0,trapped:n,onMountAutoFocus:r,onUnmountAutoFocus:a,children:f.jsx(He,{asChild:!0,disableOutsidePointerEvents:s,onInteractOutside:p,onEscapeKeyDown:i,onPointerDownOutside:l,onFocusOutside:d,onDismiss:()=>h.onOpenChange(!1),children:f.jsx(oo,{"data-state":Oc(h.open),role:"dialog",id:h.contentId,...m,...u,ref:t,style:{...u.style,"--radix-popover-content-transform-origin":"var(--radix-popper-transform-origin)","--radix-popover-content-available-width":"var(--radix-popper-available-width)","--radix-popover-content-available-height":"var(--radix-popper-available-height)","--radix-popover-trigger-width":"var(--radix-popper-anchor-width)","--radix-popover-trigger-height":"var(--radix-popper-anchor-height)"}})})})}),Dc="PopoverClose",lv=c.forwardRef((e,t)=>{const{__scopePopover:o,...n}=e,r=je(Dc,o);return f.jsx(A.button,{type:"button",...n,ref:t,onClick:C(e.onClick,()=>r.onOpenChange(!1))})});lv.displayName=Dc;var dv="PopoverArrow",uv=c.forwardRef((e,t)=>{const{__scopePopover:o,...n}=e,r=Ct(o);return f.jsx(no,{...r,...n,ref:t})});uv.displayName=dv;function Oc(e){return e?"open":"closed"}var Pb=Rc,Ab=Nc,Nb=Tc,Tb=$c;function pv(e,t=[]){let o=[];function n(a,s){const i=c.createContext(s);i.displayName=a+"Context";const l=o.length;o=[...o,s];const d=u=>{var k;const{scope:h,children:m,...x}=u,v=((k=h==null?void 0:h[e])==null?void 0:k[l])||i,g=c.useMemo(()=>x,Object.values(x));return f.jsx(v.Provider,{value:g,children:m})};d.displayName=a+"Provider";function p(u,h){var v;const m=((v=h==null?void 0:h[e])==null?void 0:v[l])||i,x=c.useContext(m);if(x)return x;if(s!==void 0)return s;throw new Error(`\`${u}\` must be used within \`${a}\``)}return[d,p]}const r=()=>{const a=o.map(s=>c.createContext(s));return function(i){const l=(i==null?void 0:i[e])||a;return c.useMemo(()=>({[`__scope${e}`]:{...i,[e]:l}}),[i,l])}};return r.scopeName=e,[n,fv(r,...t)]}function fv(...e){const t=e[0];if(e.length===1)return t;const o=()=>{const n=e.map(r=>({useScope:r(),scopeName:r.scopeName}));return function(a){const s=n.reduce((i,{useScope:l,scopeName:d})=>{const u=l(a)[`__scope${d}`];return{...i,...u}},{});return c.useMemo(()=>({[`__scope${t.scopeName}`]:s}),[s])}};return o.scopeName=t.scopeName,o}var hv=["a","button","div","form","h2","h3","img","input","label","li","nav","ol","p","select","span","svg","ul"],jc=hv.reduce((e,t)=>{const o=wt(`Primitive.${t}`),n=c.forwardRef((r,a)=>{const{asChild:s,...i}=r,l=s?o:t;return typeof window<"u"&&(window[Symbol.for("radix-ui")]=!0),f.jsx(l,{...i,ref:a})});return n.displayName=`Primitive.${t}`,{...e,[t]:n}},{}),Tn="Progress",$n=100,[yv]=pv(Tn),[mv,vv]=yv(Tn),Lc=c.forwardRef((e,t)=>{const{__scopeProgress:o,value:n=null,max:r,getValueLabel:a=gv,...s}=e;(r||r===0)&&!xr(r)&&console.error(xv(`${r}`,"Progress"));const i=xr(r)?r:$n;n!==null&&!kr(n,i)&&console.error(kv(`${n}`,"Progress"));const l=kr(n,i)?n:null,d=qt(l)?a(l,i):void 0;return f.jsx(mv,{scope:o,value:l,max:i,children:f.jsx(jc.div,{"aria-valuemax":i,"aria-valuemin":0,"aria-valuenow":qt(l)?l:void 0,"aria-valuetext":d,role:"progressbar","data-state":zc(l,i),"data-value":l??void 0,"data-max":i,...s,ref:t})})});Lc.displayName=Tn;var Fc="ProgressIndicator",Vc=c.forwardRef((e,t)=>{const{__scopeProgress:o,...n}=e,r=vv(Fc,o);return f.jsx(jc.div,{"data-state":zc(r.value,r.max),"data-value":r.value??void 0,"data-max":r.max,...n,ref:t})});Vc.displayName=Fc;function gv(e,t){return`${Math.round(e/t*100)}%`}function zc(e,t){return e==null?"indeterminate":e===t?"complete":"loading"}function qt(e){return typeof e=="number"}function xr(e){return qt(e)&&!isNaN(e)&&e>0}function kr(e,t){return qt(e)&&!isNaN(e)&&e<=t&&e>=0}function xv(e,t){return`Invalid prop \`max\` of value \`${e}\` supplied to \`${t}\`. Only numbers greater than 0 are valid max values. Defaulting to \`${$n}\`.`}function kv(e,t){return`Invalid prop \`value\` of value \`${e}\` supplied to \`${t}\`. The \`value\` prop must be:
  - a positive number
  - less than the value passed to \`max\` (or ${$n} if no \`max\` prop is set)
  - \`null\` or \`undefined\` if the progress is indeterminate.

Defaulting to \`null\`.`}var $b=Lc,Ib=Vc,wo="Collapsible",[wv,Hc]=J(wo),[bv,In]=wv(wo),Bc=c.forwardRef((e,t)=>{const{__scopeCollapsible:o,open:n,defaultOpen:r,disabled:a,onOpenChange:s,...i}=e,[l,d]=oe({prop:n,defaultProp:r??!1,onChange:s,caller:wo});return f.jsx(bv,{scope:o,disabled:a,contentId:se(),open:l,onOpenToggle:c.useCallback(()=>d(p=>!p),[d]),children:f.jsx(A.div,{"data-state":On(l),"data-disabled":a?"":void 0,...i,ref:t})})});Bc.displayName=wo;var qc="CollapsibleTrigger",Wc=c.forwardRef((e,t)=>{const{__scopeCollapsible:o,...n}=e,r=In(qc,o);return f.jsx(A.button,{type:"button","aria-controls":r.contentId,"aria-expanded":r.open||!1,"data-state":On(r.open),"data-disabled":r.disabled?"":void 0,disabled:r.disabled,...n,ref:t,onClick:C(e.onClick,r.onOpenToggle)})});Wc.displayName=qc;var Dn="CollapsibleContent",Uc=c.forwardRef((e,t)=>{const{forceMount:o,...n}=e,r=In(Dn,e.__scopeCollapsible);return f.jsx(ee,{present:o||r.open,children:({present:a})=>f.jsx(_v,{...n,ref:t,present:a})})});Uc.displayName=Dn;var _v=c.forwardRef((e,t)=>{const{__scopeCollapsible:o,present:n,children:r,...a}=e,s=In(Dn,o),[i,l]=c.useState(n),d=c.useRef(null),p=j(t,d),u=c.useRef(0),h=u.current,m=c.useRef(0),x=m.current,v=s.open||i,g=c.useRef(v),k=c.useRef(void 0);return c.useEffect(()=>{const w=requestAnimationFrame(()=>g.current=!1);return()=>cancelAnimationFrame(w)},[]),Z(()=>{const w=d.current;if(w){k.current=k.current||{transitionDuration:w.style.transitionDuration,animationName:w.style.animationName},w.style.transitionDuration="0s",w.style.animationName="none";const b=w.getBoundingClientRect();u.current=b.height,m.current=b.width,g.current||(w.style.transitionDuration=k.current.transitionDuration,w.style.animationName=k.current.animationName),l(n)}},[s.open,n]),f.jsx(A.div,{"data-state":On(s.open),"data-disabled":s.disabled?"":void 0,id:s.contentId,hidden:!v,...a,ref:p,style:{"--radix-collapsible-content-height":h?`${h}px`:void 0,"--radix-collapsible-content-width":x?`${x}px`:void 0,...e.style},children:v&&r})});function On(e){return e?"open":"closed"}var Mv=Bc,Cv=Wc,Sv=Uc,jn="Radio",[Ev,Kc]=J(jn),[Rv,Pv]=Ev(jn),Gc=c.forwardRef((e,t)=>{const{__scopeRadio:o,name:n,checked:r=!1,required:a,disabled:s,value:i="on",onCheck:l,form:d,...p}=e,[u,h]=c.useState(null),m=j(t,g=>h(g)),x=c.useRef(!1),v=u?d||!!u.closest("form"):!0;return f.jsxs(Rv,{scope:o,checked:r,disabled:s,children:[f.jsx(A.button,{type:"button",role:"radio","aria-checked":r,"data-state":Qc(r),"data-disabled":s?"":void 0,disabled:s,value:i,...p,ref:m,onClick:C(e.onClick,g=>{r||l==null||l(),v&&(x.current=g.isPropagationStopped(),x.current||g.stopPropagation())})}),v&&f.jsx(Zc,{control:u,bubbles:!x.current,name:n,value:i,checked:r,required:a,disabled:s,form:d,style:{transform:"translateX(-100%)"}})]})});Gc.displayName=jn;var Yc="RadioIndicator",Xc=c.forwardRef((e,t)=>{const{__scopeRadio:o,forceMount:n,...r}=e,a=Pv(Yc,o);return f.jsx(ee,{present:n||a.checked,children:f.jsx(A.span,{"data-state":Qc(a.checked),"data-disabled":a.disabled?"":void 0,...r,ref:t})})});Xc.displayName=Yc;var Av="RadioBubbleInput",Zc=c.forwardRef(({__scopeRadio:e,control:t,checked:o,bubbles:n=!0,...r},a)=>{const s=c.useRef(null),i=j(s,a),l=bt(o),d=xt(t);return c.useEffect(()=>{const p=s.current;if(!p)return;const u=window.HTMLInputElement.prototype,m=Object.getOwnPropertyDescriptor(u,"checked").set;if(l!==o&&m){const x=new Event("click",{bubbles:n});m.call(p,o),p.dispatchEvent(x)}},[l,o,n]),f.jsx(A.input,{type:"radio","aria-hidden":!0,defaultChecked:o,...r,tabIndex:-1,ref:i,style:{...r.style,...d,position:"absolute",pointerEvents:"none",opacity:0,margin:0}})});Zc.displayName=Av;function Qc(e){return e?"checked":"unchecked"}var Nv=["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"],bo="RadioGroup",[Tv]=J(bo,[nt,Kc]),Jc=nt(),ei=Kc(),[$v,Iv]=Tv(bo),ti=c.forwardRef((e,t)=>{const{__scopeRadioGroup:o,name:n,defaultValue:r,value:a,required:s=!1,disabled:i=!1,orientation:l,dir:d,loop:p=!0,onValueChange:u,...h}=e,m=Jc(o),x=Ie(d),[v,g]=oe({prop:a,defaultProp:r??null,onChange:u,caller:bo});return f.jsx($v,{scope:o,name:n,required:s,disabled:i,value:v,onValueChange:g,children:f.jsx(Cn,{asChild:!0,...m,orientation:l,dir:x,loop:p,children:f.jsx(A.div,{role:"radiogroup","aria-required":s,"aria-orientation":l,"data-disabled":i?"":void 0,dir:x,...h,ref:t})})})});ti.displayName=bo;var oi="RadioGroupItem",ni=c.forwardRef((e,t)=>{const{__scopeRadioGroup:o,disabled:n,...r}=e,a=Iv(oi,o),s=a.disabled||n,i=Jc(o),l=ei(o),d=c.useRef(null),p=j(t,d),u=a.value===r.value,h=c.useRef(!1);return c.useEffect(()=>{const m=v=>{Nv.includes(v.key)&&(h.current=!0)},x=()=>h.current=!1;return document.addEventListener("keydown",m),document.addEventListener("keyup",x),()=>{document.removeEventListener("keydown",m),document.removeEventListener("keyup",x)}},[]),f.jsx(Sn,{asChild:!0,...i,focusable:!s,active:u,children:f.jsx(Gc,{disabled:s,required:a.required,checked:u,...l,...r,name:a.name,ref:p,onCheck:()=>a.onValueChange(r.value),onKeyDown:C(m=>{m.key==="Enter"&&m.preventDefault()}),onFocus:C(r.onFocus,()=>{var m;h.current&&((m=d.current)==null||m.click())})})})});ni.displayName=oi;var Dv="RadioGroupIndicator",ri=c.forwardRef((e,t)=>{const{__scopeRadioGroup:o,...n}=e,r=ei(o);return f.jsx(Xc,{...r,...n,ref:t})});ri.displayName=Dv;var Db=ti,Ob=ni,jb=ri;function Ov(e){const t=jv(e),o=c.forwardRef((n,r)=>{const{children:a,...s}=n,i=c.Children.toArray(a),l=i.find(Fv);if(l){const d=l.props.children,p=i.map(u=>u===l?c.Children.count(d)>1?c.Children.only(null):c.isValidElement(d)?d.props.children:null:u);return f.jsx(t,{...s,ref:r,children:c.isValidElement(d)?c.cloneElement(d,void 0,p):null})}return f.jsx(t,{...s,ref:r,children:a})});return o.displayName=`${e}.Slot`,o}function jv(e){const t=c.forwardRef((o,n)=>{const{children:r,...a}=o;if(c.isValidElement(r)){const s=zv(r),i=Vv(a,r.props);return r.type!==c.Fragment&&(i.ref=n?be(n,s):s),c.cloneElement(r,i)}return c.Children.count(r)>1?c.Children.only(null):null});return t.displayName=`${e}.SlotClone`,t}var Lv=Symbol("radix.slottable");function Fv(e){return c.isValidElement(e)&&typeof e.type=="function"&&"__radixId"in e.type&&e.type.__radixId===Lv}function Vv(e,t){const o={...t};for(const n in t){const r=e[n],a=t[n];/^on[A-Z]/.test(n)?r&&a?o[n]=(...i)=>{const l=a(...i);return r(...i),l}:r&&(o[n]=r):n==="style"?o[n]={...r,...a}:n==="className"&&(o[n]=[r,a].filter(Boolean).join(" "))}return{...e,...o}}function zv(e){var n,r;let t=(n=Object.getOwnPropertyDescriptor(e.props,"ref"))==null?void 0:n.get,o=t&&"isReactWarning"in t&&t.isReactWarning;return o?e.ref:(t=(r=Object.getOwnPropertyDescriptor(e,"ref"))==null?void 0:r.get,o=t&&"isReactWarning"in t&&t.isReactWarning,o?e.props.ref:e.props.ref||e.ref)}var en=["Enter"," "],Hv=["ArrowDown","PageUp","Home"],ai=["ArrowUp","PageDown","End"],Bv=[...Hv,...ai],qv={ltr:[...en,"ArrowRight"],rtl:[...en,"ArrowLeft"]},Wv={ltr:["ArrowLeft"],rtl:["ArrowRight"]},St="Menu",[ht,Uv,Kv]=Qe(St),[Be,si]=J(St,[Kv,$e,nt]),_o=$e(),ci=nt(),[Gv,qe]=Be(St),[Yv,Et]=Be(St),ii=e=>{const{__scopeMenu:t,open:o=!1,children:n,dir:r,onOpenChange:a,modal:s=!0}=e,i=_o(t),[l,d]=c.useState(null),p=c.useRef(!1),u=X(a),h=Ie(r);return c.useEffect(()=>{const m=()=>{p.current=!0,document.addEventListener("pointerdown",x,{capture:!0,once:!0}),document.addEventListener("pointermove",x,{capture:!0,once:!0})},x=()=>p.current=!1;return document.addEventListener("keydown",m,{capture:!0}),()=>{document.removeEventListener("keydown",m,{capture:!0}),document.removeEventListener("pointerdown",x,{capture:!0}),document.removeEventListener("pointermove",x,{capture:!0})}},[]),f.jsx(to,{...i,children:f.jsx(Gv,{scope:t,open:o,onOpenChange:u,content:l,onContentChange:d,children:f.jsx(Yv,{scope:t,onClose:c.useCallback(()=>u(!1),[u]),isUsingKeyboardRef:p,dir:h,modal:s,children:n})})})};ii.displayName=St;var Xv="MenuAnchor",Ln=c.forwardRef((e,t)=>{const{__scopeMenu:o,...n}=e,r=_o(o);return f.jsx(kt,{...r,...n,ref:t})});Ln.displayName=Xv;var Fn="MenuPortal",[Zv,li]=Be(Fn,{forceMount:void 0}),di=e=>{const{__scopeMenu:t,forceMount:o,children:n,container:r}=e,a=qe(Fn,t);return f.jsx(Zv,{scope:t,forceMount:o,children:f.jsx(ee,{present:o||a.open,children:f.jsx(Je,{asChild:!0,container:r,children:n})})})};di.displayName=Fn;var ue="MenuContent",[Qv,Vn]=Be(ue),ui=c.forwardRef((e,t)=>{const o=li(ue,e.__scopeMenu),{forceMount:n=o.forceMount,...r}=e,a=qe(ue,e.__scopeMenu),s=Et(ue,e.__scopeMenu);return f.jsx(ht.Provider,{scope:e.__scopeMenu,children:f.jsx(ee,{present:n||a.open,children:f.jsx(ht.Slot,{scope:e.__scopeMenu,children:s.modal?f.jsx(Jv,{...r,ref:t}):f.jsx(eg,{...r,ref:t})})})})}),Jv=c.forwardRef((e,t)=>{const o=qe(ue,e.__scopeMenu),n=c.useRef(null),r=j(t,n);return c.useEffect(()=>{const a=n.current;if(a)return lo(a)},[]),f.jsx(zn,{...e,ref:r,trapFocus:o.open,disableOutsidePointerEvents:o.open,disableOutsideScroll:!0,onFocusOutside:C(e.onFocusOutside,a=>a.preventDefault(),{checkForDefaultPrevented:!1}),onDismiss:()=>o.onOpenChange(!1)})}),eg=c.forwardRef((e,t)=>{const o=qe(ue,e.__scopeMenu);return f.jsx(zn,{...e,ref:t,trapFocus:!1,disableOutsidePointerEvents:!1,disableOutsideScroll:!1,onDismiss:()=>o.onOpenChange(!1)})}),tg=Ov("MenuContent.ScrollLock"),zn=c.forwardRef((e,t)=>{const{__scopeMenu:o,loop:n=!1,trapFocus:r,onOpenAutoFocus:a,onCloseAutoFocus:s,disableOutsidePointerEvents:i,onEntryFocus:l,onEscapeKeyDown:d,onPointerDownOutside:p,onFocusOutside:u,onInteractOutside:h,onDismiss:m,disableOutsideScroll:x,...v}=e,g=qe(ue,o),k=Et(ue,o),w=_o(o),b=ci(o),_=Uv(o),[M,E]=c.useState(null),S=c.useRef(null),N=j(t,S,g.onContentChange),T=c.useRef(0),I=c.useRef(""),D=c.useRef(0),F=c.useRef(null),V=c.useRef("right"),R=c.useRef(0),H=x?Gt:c.Fragment,O=x?{as:tg,allowPinchZoom:!0}:void 0,z=P=>{var L,W;const B=I.current+P,Y=_().filter(G=>!G.disabled),te=document.activeElement,ae=(L=Y.find(G=>G.ref.current===te))==null?void 0:L.textValue,ne=Y.map(G=>G.textValue),Ce=fg(ne,B,ae),ce=(W=Y.find(G=>G.textValue===Ce))==null?void 0:W.ref.current;(function G(q){I.current=q,window.clearTimeout(T.current),q!==""&&(T.current=window.setTimeout(()=>G(""),1e3))})(B),ce&&setTimeout(()=>ce.focus())};c.useEffect(()=>()=>window.clearTimeout(T.current),[]),io();const $=c.useCallback(P=>{var Y,te;return V.current===((Y=F.current)==null?void 0:Y.side)&&yg(P,(te=F.current)==null?void 0:te.area)},[]);return f.jsx(Qv,{scope:o,searchRef:I,onItemEnter:c.useCallback(P=>{$(P)&&P.preventDefault()},[$]),onItemLeave:c.useCallback(P=>{var B;$(P)||((B=S.current)==null||B.focus(),E(null))},[$]),onTriggerLeave:c.useCallback(P=>{$(P)&&P.preventDefault()},[$]),pointerGraceTimerRef:D,onPointerGraceIntentChange:c.useCallback(P=>{F.current=P},[]),children:f.jsx(H,{...O,children:f.jsx(_t,{asChild:!0,trapped:r,onMountAutoFocus:C(a,P=>{var B;P.preventDefault(),(B=S.current)==null||B.focus({preventScroll:!0})}),onUnmountAutoFocus:s,children:f.jsx(He,{asChild:!0,disableOutsidePointerEvents:i,onEscapeKeyDown:d,onPointerDownOutside:p,onFocusOutside:u,onInteractOutside:h,onDismiss:m,children:f.jsx(Cn,{asChild:!0,...b,dir:k.dir,orientation:"vertical",loop:n,currentTabStopId:M,onCurrentTabStopIdChange:E,onEntryFocus:C(l,P=>{k.isUsingKeyboardRef.current||P.preventDefault()}),preventScrollOnEntryFocus:!0,children:f.jsx(oo,{role:"menu","aria-orientation":"vertical","data-state":Ei(g.open),"data-radix-menu-content":"",dir:k.dir,...w,...v,ref:N,style:{outline:"none",...v.style},onKeyDown:C(v.onKeyDown,P=>{const Y=P.target.closest("[data-radix-menu-content]")===P.currentTarget,te=P.ctrlKey||P.altKey||P.metaKey,ae=P.key.length===1;Y&&(P.key==="Tab"&&P.preventDefault(),!te&&ae&&z(P.key));const ne=S.current;if(P.target!==ne||!Bv.includes(P.key))return;P.preventDefault();const ce=_().filter(L=>!L.disabled).map(L=>L.ref.current);ai.includes(P.key)&&ce.reverse(),ug(ce)}),onBlur:C(e.onBlur,P=>{P.currentTarget.contains(P.target)||(window.clearTimeout(T.current),I.current="")}),onPointerMove:C(e.onPointerMove,yt(P=>{const B=P.target,Y=R.current!==P.clientX;if(P.currentTarget.contains(B)&&Y){const te=P.clientX>R.current?"right":"left";V.current=te,R.current=P.clientX}}))})})})})})})});ui.displayName=ue;var og="MenuGroup",Hn=c.forwardRef((e,t)=>{const{__scopeMenu:o,...n}=e;return f.jsx(A.div,{role:"group",...n,ref:t})});Hn.displayName=og;var ng="MenuLabel",pi=c.forwardRef((e,t)=>{const{__scopeMenu:o,...n}=e;return f.jsx(A.div,{...n,ref:t})});pi.displayName=ng;var Wt="MenuItem",wr="menu.itemSelect",Mo=c.forwardRef((e,t)=>{const{disabled:o=!1,onSelect:n,...r}=e,a=c.useRef(null),s=Et(Wt,e.__scopeMenu),i=Vn(Wt,e.__scopeMenu),l=j(t,a),d=c.useRef(!1),p=()=>{const u=a.current;if(!o&&u){const h=new CustomEvent(wr,{bubbles:!0,cancelable:!0});u.addEventListener(wr,m=>n==null?void 0:n(m),{once:!0}),nn(u,h),h.defaultPrevented?d.current=!1:s.onClose()}};return f.jsx(fi,{...r,ref:l,disabled:o,onClick:C(e.onClick,p),onPointerDown:u=>{var h;(h=e.onPointerDown)==null||h.call(e,u),d.current=!0},onPointerUp:C(e.onPointerUp,u=>{var h;d.current||(h=u.currentTarget)==null||h.click()}),onKeyDown:C(e.onKeyDown,u=>{const h=i.searchRef.current!=="";o||h&&u.key===" "||en.includes(u.key)&&(u.currentTarget.click(),u.preventDefault())})})});Mo.displayName=Wt;var fi=c.forwardRef((e,t)=>{const{__scopeMenu:o,disabled:n=!1,textValue:r,...a}=e,s=Vn(Wt,o),i=ci(o),l=c.useRef(null),d=j(t,l),[p,u]=c.useState(!1),[h,m]=c.useState("");return c.useEffect(()=>{const x=l.current;x&&m((x.textContent??"").trim())},[a.children]),f.jsx(ht.ItemSlot,{scope:o,disabled:n,textValue:r??h,children:f.jsx(Sn,{asChild:!0,...i,focusable:!n,children:f.jsx(A.div,{role:"menuitem","data-highlighted":p?"":void 0,"aria-disabled":n||void 0,"data-disabled":n?"":void 0,...a,ref:d,onPointerMove:C(e.onPointerMove,yt(x=>{n?s.onItemLeave(x):(s.onItemEnter(x),x.defaultPrevented||x.currentTarget.focus({preventScroll:!0}))})),onPointerLeave:C(e.onPointerLeave,yt(x=>s.onItemLeave(x))),onFocus:C(e.onFocus,()=>u(!0)),onBlur:C(e.onBlur,()=>u(!1))})})})}),rg="MenuCheckboxItem",hi=c.forwardRef((e,t)=>{const{checked:o=!1,onCheckedChange:n,...r}=e;return f.jsx(xi,{scope:e.__scopeMenu,checked:o,children:f.jsx(Mo,{role:"menuitemcheckbox","aria-checked":Ut(o)?"mixed":o,...r,ref:t,"data-state":qn(o),onSelect:C(r.onSelect,()=>n==null?void 0:n(Ut(o)?!0:!o),{checkForDefaultPrevented:!1})})})});hi.displayName=rg;var yi="MenuRadioGroup",[ag,sg]=Be(yi,{value:void 0,onValueChange:()=>{}}),mi=c.forwardRef((e,t)=>{const{value:o,onValueChange:n,...r}=e,a=X(n);return f.jsx(ag,{scope:e.__scopeMenu,value:o,onValueChange:a,children:f.jsx(Hn,{...r,ref:t})})});mi.displayName=yi;var vi="MenuRadioItem",gi=c.forwardRef((e,t)=>{const{value:o,...n}=e,r=sg(vi,e.__scopeMenu),a=o===r.value;return f.jsx(xi,{scope:e.__scopeMenu,checked:a,children:f.jsx(Mo,{role:"menuitemradio","aria-checked":a,...n,ref:t,"data-state":qn(a),onSelect:C(n.onSelect,()=>{var s;return(s=r.onValueChange)==null?void 0:s.call(r,o)},{checkForDefaultPrevented:!1})})})});gi.displayName=vi;var Bn="MenuItemIndicator",[xi,cg]=Be(Bn,{checked:!1}),ki=c.forwardRef((e,t)=>{const{__scopeMenu:o,forceMount:n,...r}=e,a=cg(Bn,o);return f.jsx(ee,{present:n||Ut(a.checked)||a.checked===!0,children:f.jsx(A.span,{...r,ref:t,"data-state":qn(a.checked)})})});ki.displayName=Bn;var ig="MenuSeparator",wi=c.forwardRef((e,t)=>{const{__scopeMenu:o,...n}=e;return f.jsx(A.div,{role:"separator","aria-orientation":"horizontal",...n,ref:t})});wi.displayName=ig;var lg="MenuArrow",bi=c.forwardRef((e,t)=>{const{__scopeMenu:o,...n}=e,r=_o(o);return f.jsx(no,{...r,...n,ref:t})});bi.displayName=lg;var dg="MenuSub",[Lb,_i]=Be(dg),lt="MenuSubTrigger",Mi=c.forwardRef((e,t)=>{const o=qe(lt,e.__scopeMenu),n=Et(lt,e.__scopeMenu),r=_i(lt,e.__scopeMenu),a=Vn(lt,e.__scopeMenu),s=c.useRef(null),{pointerGraceTimerRef:i,onPointerGraceIntentChange:l}=a,d={__scopeMenu:e.__scopeMenu},p=c.useCallback(()=>{s.current&&window.clearTimeout(s.current),s.current=null},[]);return c.useEffect(()=>p,[p]),c.useEffect(()=>{const u=i.current;return()=>{window.clearTimeout(u),l(null)}},[i,l]),f.jsx(Ln,{asChild:!0,...d,children:f.jsx(fi,{id:r.triggerId,"aria-haspopup":"menu","aria-expanded":o.open,"aria-controls":r.contentId,"data-state":Ei(o.open),...e,ref:be(t,r.onTriggerChange),onClick:u=>{var h;(h=e.onClick)==null||h.call(e,u),!(e.disabled||u.defaultPrevented)&&(u.currentTarget.focus(),o.open||o.onOpenChange(!0))},onPointerMove:C(e.onPointerMove,yt(u=>{a.onItemEnter(u),!u.defaultPrevented&&!e.disabled&&!o.open&&!s.current&&(a.onPointerGraceIntentChange(null),s.current=window.setTimeout(()=>{o.onOpenChange(!0),p()},100))})),onPointerLeave:C(e.onPointerLeave,yt(u=>{var m,x;p();const h=(m=o.content)==null?void 0:m.getBoundingClientRect();if(h){const v=(x=o.content)==null?void 0:x.dataset.side,g=v==="right",k=g?-5:5,w=h[g?"left":"right"],b=h[g?"right":"left"];a.onPointerGraceIntentChange({area:[{x:u.clientX+k,y:u.clientY},{x:w,y:h.top},{x:b,y:h.top},{x:b,y:h.bottom},{x:w,y:h.bottom}],side:v}),window.clearTimeout(i.current),i.current=window.setTimeout(()=>a.onPointerGraceIntentChange(null),300)}else{if(a.onTriggerLeave(u),u.defaultPrevented)return;a.onPointerGraceIntentChange(null)}})),onKeyDown:C(e.onKeyDown,u=>{var m;const h=a.searchRef.current!=="";e.disabled||h&&u.key===" "||qv[n.dir].includes(u.key)&&(o.onOpenChange(!0),(m=o.content)==null||m.focus(),u.preventDefault())})})})});Mi.displayName=lt;var Ci="MenuSubContent",Si=c.forwardRef((e,t)=>{const o=li(ue,e.__scopeMenu),{forceMount:n=o.forceMount,...r}=e,a=qe(ue,e.__scopeMenu),s=Et(ue,e.__scopeMenu),i=_i(Ci,e.__scopeMenu),l=c.useRef(null),d=j(t,l);return f.jsx(ht.Provider,{scope:e.__scopeMenu,children:f.jsx(ee,{present:n||a.open,children:f.jsx(ht.Slot,{scope:e.__scopeMenu,children:f.jsx(zn,{id:i.contentId,"aria-labelledby":i.triggerId,...r,ref:d,align:"start",side:s.dir==="rtl"?"left":"right",disableOutsidePointerEvents:!1,disableOutsideScroll:!1,trapFocus:!1,onOpenAutoFocus:p=>{var u;s.isUsingKeyboardRef.current&&((u=l.current)==null||u.focus()),p.preventDefault()},onCloseAutoFocus:p=>p.preventDefault(),onFocusOutside:C(e.onFocusOutside,p=>{p.target!==i.trigger&&a.onOpenChange(!1)}),onEscapeKeyDown:C(e.onEscapeKeyDown,p=>{s.onClose(),p.preventDefault()}),onKeyDown:C(e.onKeyDown,p=>{var m;const u=p.currentTarget.contains(p.target),h=Wv[s.dir].includes(p.key);u&&h&&(a.onOpenChange(!1),(m=i.trigger)==null||m.focus(),p.preventDefault())})})})})})});Si.displayName=Ci;function Ei(e){return e?"open":"closed"}function Ut(e){return e==="indeterminate"}function qn(e){return Ut(e)?"indeterminate":e?"checked":"unchecked"}function ug(e){const t=document.activeElement;for(const o of e)if(o===t||(o.focus(),document.activeElement!==t))return}function pg(e,t){return e.map((o,n)=>e[(t+n)%e.length])}function fg(e,t,o){const r=t.length>1&&Array.from(t).every(d=>d===t[0])?t[0]:t,a=o?e.indexOf(o):-1;let s=pg(e,Math.max(a,0));r.length===1&&(s=s.filter(d=>d!==o));const l=s.find(d=>d.toLowerCase().startsWith(r.toLowerCase()));return l!==o?l:void 0}function hg(e,t){const{x:o,y:n}=e;let r=!1;for(let a=0,s=t.length-1;a<t.length;s=a++){const i=t[a],l=t[s],d=i.x,p=i.y,u=l.x,h=l.y;p>n!=h>n&&o<(u-d)*(n-p)/(h-p)+d&&(r=!r)}return r}function yg(e,t){if(!t)return!1;const o={x:e.clientX,y:e.clientY};return hg(o,t)}function yt(e){return t=>t.pointerType==="mouse"?e(t):void 0}var mg=ii,vg=Ln,gg=di,xg=ui,kg=Hn,wg=pi,bg=Mo,_g=hi,Mg=mi,Cg=gi,Sg=ki,Eg=wi,Rg=bi,Pg=Mi,Ag=Si,Co="DropdownMenu",[Ng]=J(Co,[si]),re=si(),[Tg,Ri]=Ng(Co),Pi=e=>{const{__scopeDropdownMenu:t,children:o,dir:n,open:r,defaultOpen:a,onOpenChange:s,modal:i=!0}=e,l=re(t),d=c.useRef(null),[p,u]=oe({prop:r,defaultProp:a??!1,onChange:s,caller:Co});return f.jsx(Tg,{scope:t,triggerId:se(),triggerRef:d,contentId:se(),open:p,onOpenChange:u,onOpenToggle:c.useCallback(()=>u(h=>!h),[u]),modal:i,children:f.jsx(mg,{...l,open:p,onOpenChange:u,dir:n,modal:i,children:o})})};Pi.displayName=Co;var Ai="DropdownMenuTrigger",Ni=c.forwardRef((e,t)=>{const{__scopeDropdownMenu:o,disabled:n=!1,...r}=e,a=Ri(Ai,o),s=re(o);return f.jsx(vg,{asChild:!0,...s,children:f.jsx(A.button,{type:"button",id:a.triggerId,"aria-haspopup":"menu","aria-expanded":a.open,"aria-controls":a.open?a.contentId:void 0,"data-state":a.open?"open":"closed","data-disabled":n?"":void 0,disabled:n,...r,ref:be(t,a.triggerRef),onPointerDown:C(e.onPointerDown,i=>{!n&&i.button===0&&i.ctrlKey===!1&&(a.onOpenToggle(),a.open||i.preventDefault())}),onKeyDown:C(e.onKeyDown,i=>{n||(["Enter"," "].includes(i.key)&&a.onOpenToggle(),i.key==="ArrowDown"&&a.onOpenChange(!0),["Enter"," ","ArrowDown"].includes(i.key)&&i.preventDefault())})})})});Ni.displayName=Ai;var $g="DropdownMenuPortal",Ti=e=>{const{__scopeDropdownMenu:t,...o}=e,n=re(t);return f.jsx(gg,{...n,...o})};Ti.displayName=$g;var $i="DropdownMenuContent",Ii=c.forwardRef((e,t)=>{const{__scopeDropdownMenu:o,...n}=e,r=Ri($i,o),a=re(o),s=c.useRef(!1);return f.jsx(xg,{id:r.contentId,"aria-labelledby":r.triggerId,...a,...n,ref:t,onCloseAutoFocus:C(e.onCloseAutoFocus,i=>{var l;s.current||(l=r.triggerRef.current)==null||l.focus(),s.current=!1,i.preventDefault()}),onInteractOutside:C(e.onInteractOutside,i=>{const l=i.detail.originalEvent,d=l.button===0&&l.ctrlKey===!0,p=l.button===2||d;(!r.modal||p)&&(s.current=!0)}),style:{...e.style,"--radix-dropdown-menu-content-transform-origin":"var(--radix-popper-transform-origin)","--radix-dropdown-menu-content-available-width":"var(--radix-popper-available-width)","--radix-dropdown-menu-content-available-height":"var(--radix-popper-available-height)","--radix-dropdown-menu-trigger-width":"var(--radix-popper-anchor-width)","--radix-dropdown-menu-trigger-height":"var(--radix-popper-anchor-height)"}})});Ii.displayName=$i;var Ig="DropdownMenuGroup",Dg=c.forwardRef((e,t)=>{const{__scopeDropdownMenu:o,...n}=e,r=re(o);return f.jsx(kg,{...r,...n,ref:t})});Dg.displayName=Ig;var Og="DropdownMenuLabel",Di=c.forwardRef((e,t)=>{const{__scopeDropdownMenu:o,...n}=e,r=re(o);return f.jsx(wg,{...r,...n,ref:t})});Di.displayName=Og;var jg="DropdownMenuItem",Oi=c.forwardRef((e,t)=>{const{__scopeDropdownMenu:o,...n}=e,r=re(o);return f.jsx(bg,{...r,...n,ref:t})});Oi.displayName=jg;var Lg="DropdownMenuCheckboxItem",ji=c.forwardRef((e,t)=>{const{__scopeDropdownMenu:o,...n}=e,r=re(o);return f.jsx(_g,{...r,...n,ref:t})});ji.displayName=Lg;var Fg="DropdownMenuRadioGroup",Vg=c.forwardRef((e,t)=>{const{__scopeDropdownMenu:o,...n}=e,r=re(o);return f.jsx(Mg,{...r,...n,ref:t})});Vg.displayName=Fg;var zg="DropdownMenuRadioItem",Li=c.forwardRef((e,t)=>{const{__scopeDropdownMenu:o,...n}=e,r=re(o);return f.jsx(Cg,{...r,...n,ref:t})});Li.displayName=zg;var Hg="DropdownMenuItemIndicator",Fi=c.forwardRef((e,t)=>{const{__scopeDropdownMenu:o,...n}=e,r=re(o);return f.jsx(Sg,{...r,...n,ref:t})});Fi.displayName=Hg;var Bg="DropdownMenuSeparator",Vi=c.forwardRef((e,t)=>{const{__scopeDropdownMenu:o,...n}=e,r=re(o);return f.jsx(Eg,{...r,...n,ref:t})});Vi.displayName=Bg;var qg="DropdownMenuArrow",Wg=c.forwardRef((e,t)=>{const{__scopeDropdownMenu:o,...n}=e,r=re(o);return f.jsx(Rg,{...r,...n,ref:t})});Wg.displayName=qg;var Ug="DropdownMenuSubTrigger",zi=c.forwardRef((e,t)=>{const{__scopeDropdownMenu:o,...n}=e,r=re(o);return f.jsx(Pg,{...r,...n,ref:t})});zi.displayName=Ug;var Kg="DropdownMenuSubContent",Hi=c.forwardRef((e,t)=>{const{__scopeDropdownMenu:o,...n}=e,r=re(o);return f.jsx(Ag,{...r,...n,ref:t,style:{...e.style,"--radix-dropdown-menu-content-transform-origin":"var(--radix-popper-transform-origin)","--radix-dropdown-menu-content-available-width":"var(--radix-popper-available-width)","--radix-dropdown-menu-content-available-height":"var(--radix-popper-available-height)","--radix-dropdown-menu-trigger-width":"var(--radix-popper-anchor-width)","--radix-dropdown-menu-trigger-height":"var(--radix-popper-anchor-height)"}})});Hi.displayName=Kg;var Fb=Pi,Vb=Ni,zb=Ti,Hb=Ii,Bb=Di,qb=Oi,Wb=ji,Ub=Li,Kb=Fi,Gb=Vi,Yb=zi,Xb=Hi,ve="Accordion",Gg=["Home","End","ArrowDown","ArrowUp","ArrowLeft","ArrowRight"],[Wn,Yg,Xg]=Qe(ve),[So]=J(ve,[Xg,Hc]),Un=Hc(),Bi=Q.forwardRef((e,t)=>{const{type:o,...n}=e,r=n,a=n;return f.jsx(Wn.Provider,{scope:e.__scopeAccordion,children:o==="multiple"?f.jsx(ex,{...a,ref:t}):f.jsx(Jg,{...r,ref:t})})});Bi.displayName=ve;var[qi,Zg]=So(ve),[Wi,Qg]=So(ve,{collapsible:!1}),Jg=Q.forwardRef((e,t)=>{const{value:o,defaultValue:n,onValueChange:r=()=>{},collapsible:a=!1,...s}=e,[i,l]=oe({prop:o,defaultProp:n??"",onChange:r,caller:ve});return f.jsx(qi,{scope:e.__scopeAccordion,value:Q.useMemo(()=>i?[i]:[],[i]),onItemOpen:l,onItemClose:Q.useCallback(()=>a&&l(""),[a,l]),children:f.jsx(Wi,{scope:e.__scopeAccordion,collapsible:a,children:f.jsx(Ui,{...s,ref:t})})})}),ex=Q.forwardRef((e,t)=>{const{value:o,defaultValue:n,onValueChange:r=()=>{},...a}=e,[s,i]=oe({prop:o,defaultProp:n??[],onChange:r,caller:ve}),l=Q.useCallback(p=>i((u=[])=>[...u,p]),[i]),d=Q.useCallback(p=>i((u=[])=>u.filter(h=>h!==p)),[i]);return f.jsx(qi,{scope:e.__scopeAccordion,value:s,onItemOpen:l,onItemClose:d,children:f.jsx(Wi,{scope:e.__scopeAccordion,collapsible:!0,children:f.jsx(Ui,{...a,ref:t})})})}),[tx,Eo]=So(ve),Ui=Q.forwardRef((e,t)=>{const{__scopeAccordion:o,disabled:n,dir:r,orientation:a="vertical",...s}=e,i=Q.useRef(null),l=j(i,t),d=Yg(o),u=Ie(r)==="ltr",h=C(e.onKeyDown,m=>{var N;if(!Gg.includes(m.key))return;const x=m.target,v=d().filter(T=>{var I;return!((I=T.ref.current)!=null&&I.disabled)}),g=v.findIndex(T=>T.ref.current===x),k=v.length;if(g===-1)return;m.preventDefault();let w=g;const b=0,_=k-1,M=()=>{w=g+1,w>_&&(w=b)},E=()=>{w=g-1,w<b&&(w=_)};switch(m.key){case"Home":w=b;break;case"End":w=_;break;case"ArrowRight":a==="horizontal"&&(u?M():E());break;case"ArrowDown":a==="vertical"&&M();break;case"ArrowLeft":a==="horizontal"&&(u?E():M());break;case"ArrowUp":a==="vertical"&&E();break}const S=w%k;(N=v[S].ref.current)==null||N.focus()});return f.jsx(tx,{scope:o,disabled:n,direction:r,orientation:a,children:f.jsx(Wn.Slot,{scope:o,children:f.jsx(A.div,{...s,"data-orientation":a,ref:l,onKeyDown:n?void 0:h})})})}),Kt="AccordionItem",[ox,Kn]=So(Kt),Ki=Q.forwardRef((e,t)=>{const{__scopeAccordion:o,value:n,...r}=e,a=Eo(Kt,o),s=Zg(Kt,o),i=Un(o),l=se(),d=n&&s.value.includes(n)||!1,p=a.disabled||e.disabled;return f.jsx(ox,{scope:o,open:d,disabled:p,triggerId:l,children:f.jsx(Mv,{"data-orientation":a.orientation,"data-state":Ji(d),...i,...r,ref:t,disabled:p,open:d,onOpenChange:u=>{u?s.onItemOpen(n):s.onItemClose(n)}})})});Ki.displayName=Kt;var Gi="AccordionHeader",Yi=Q.forwardRef((e,t)=>{const{__scopeAccordion:o,...n}=e,r=Eo(ve,o),a=Kn(Gi,o);return f.jsx(A.h3,{"data-orientation":r.orientation,"data-state":Ji(a.open),"data-disabled":a.disabled?"":void 0,...n,ref:t})});Yi.displayName=Gi;var tn="AccordionTrigger",Xi=Q.forwardRef((e,t)=>{const{__scopeAccordion:o,...n}=e,r=Eo(ve,o),a=Kn(tn,o),s=Qg(tn,o),i=Un(o);return f.jsx(Wn.ItemSlot,{scope:o,children:f.jsx(Cv,{"aria-disabled":a.open&&!s.collapsible||void 0,"data-orientation":r.orientation,id:a.triggerId,...i,...n,ref:t})})});Xi.displayName=tn;var Zi="AccordionContent",Qi=Q.forwardRef((e,t)=>{const{__scopeAccordion:o,...n}=e,r=Eo(ve,o),a=Kn(Zi,o),s=Un(o);return f.jsx(Sv,{role:"region","aria-labelledby":a.triggerId,"data-orientation":r.orientation,...s,...n,ref:t,style:{"--radix-accordion-content-height":"var(--radix-collapsible-content-height)","--radix-accordion-content-width":"var(--radix-collapsible-content-width)",...e.style}})});Qi.displayName=Zi;function Ji(e){return e?"open":"closed"}var Zb=Bi,Qb=Ki,Jb=Yi,e_=Xi,t_=Qi;export{kw as $,Fw as A,Ox as B,d4 as C,U4 as D,hw as E,yk as F,Tk as G,Bk as H,a4 as I,s4 as J,x3 as K,cw as L,fw as M,Vk as N,A5 as O,Zw as P,_x as Q,s5 as R,P5 as S,d3 as T,k3 as U,i3 as V,y3 as W,T3 as X,V5 as Y,$3 as Z,qw as _,n4 as a,lw as a$,_3 as a0,Gw as a1,z3 as a2,pb as a3,Px as a4,o4 as a5,Uk as a6,v5 as a7,Zx as a8,x5 as a9,F5 as aA,Yx as aB,p5 as aC,Yw as aD,bw as aE,T4 as aF,Pw as aG,Pb as aH,Ab as aI,Nb as aJ,Tb as aK,gx as aL,Iw as aM,M3 as aN,zx as aO,hk as aP,K4 as aQ,Dx as aR,$b as aS,Ib as aT,Sk as aU,e5 as aV,px as aW,Nk as aX,V4 as aY,q4 as aZ,xx as a_,Uy as aa,Ky as ab,Gy as ac,Xy as ad,Ns as ae,Zy as af,Qy as ag,Yy as ah,fb as ai,hb as aj,yb as ak,vb as al,kb as am,wb as an,xb as ao,gb as ap,mb as aq,bb as ar,_b as as,Mb as at,Cb as au,Sb as av,Eb as aw,Rb as ax,S5 as ay,E5 as az,w4 as b,hx as b$,U5 as b0,Sw as b1,u3 as b2,vw as b3,Hw as b4,Vx as b5,jw as b6,C5 as b7,j4 as b8,tk as b9,g5 as bA,Dw as bB,b5 as bC,lk as bD,M4 as bE,Bx as bF,Xw as bG,aw as bH,Mk as bI,Kk as bJ,jx as bK,Y5 as bL,N5 as bM,e4 as bN,k5 as bO,n5 as bP,wx as bQ,mx as bR,Rk as bS,r5 as bT,Qx as bU,t4 as bV,p3 as bW,Nx as bX,zk as bY,tw as bZ,Ak as b_,w5 as ba,l3 as bb,Wk as bc,d5 as bd,f5 as be,L4 as bf,uk as bg,Fx as bh,ux as bi,ek as bj,Cw as bk,ew as bl,w3 as bm,Lx as bn,X5 as bo,$x as bp,Lk as bq,ow as br,N3 as bs,l5 as bt,$5 as bu,P3 as bv,Q4 as bw,Aw as bx,Jk as by,s3 as bz,f4 as c,Hb as c$,a5 as c0,M5 as c1,xk as c2,iw as c3,sk as c4,Mw as c5,rw as c6,wk as c7,m4 as c8,Pk as c9,ik as cA,dk as cB,ok as cC,Hx as cD,i4 as cE,I5 as cF,v3 as cG,m3 as cH,t3 as cI,e3 as cJ,Ow as cK,X4 as cL,i5 as cM,fx as cN,o3 as cO,m5 as cP,Db as cQ,Ob as cR,jb as cS,b4 as cT,R5 as cU,Z5 as cV,R3 as cW,yx as cX,Fb as cY,Vb as cZ,zb as c_,Qk as ca,J4 as cb,u4 as cc,$w as cd,z5 as ce,K5 as cf,pw as cg,q5 as ch,Y4 as ci,S4 as cj,L5 as ck,Q5 as cl,P4 as cm,A3 as cn,J5 as co,yw as cp,bk as cq,C3 as cr,$4 as cs,nw as ct,Gk as cu,O5 as cv,zw as cw,G5 as cx,Zk as cy,Tx as cz,C4 as d,Tw as d$,qb as d0,Gb as d1,Yb as d2,Xb as d3,Wb as d4,Kb as d5,Ub as d6,Bb as d7,Rx as d8,H4 as d9,u5 as dA,T5 as dB,Ik as dC,F4 as dD,xw as dE,Fk as dF,mw as dG,I3 as dH,o5 as dI,Ax as dJ,Nw as dK,bx as dL,vx as dM,fk as dN,v4 as dO,y5 as dP,Mx as dQ,c3 as dR,D4 as dS,Bw as dT,Ux as dU,W5 as dV,Ww as dW,pk as dX,_k as dY,O4 as dZ,gk as d_,dw as da,ak as db,kk as dc,ck as dd,G4 as de,Ix as df,Lw as dg,A4 as dh,E3 as di,Jx as dj,nk as dk,gw as dl,N4 as dm,S3 as dn,Yk as dp,l4 as dq,E4 as dr,g4 as ds,kx as dt,Kx as du,Zb as dv,Qb as dw,Jb as dx,e_ as dy,t_ as dz,Gx as e,nb as e$,j5 as e0,x4 as e1,_w as e2,jk as e3,Wx as e4,vk as e5,ww as e6,B4 as e7,t5 as e8,mk as e9,Ew as eA,rx as eB,sx as eC,cx as eD,ix as eE,dx as eF,ax as eG,lx as eH,j3 as eI,L3 as eJ,F3 as eK,V3 as eL,H3 as eM,B3 as eN,q3 as eO,U3 as eP,W3 as eQ,K3 as eR,G3 as eS,Y3 as eT,X3 as eU,Q3 as eV,eb as eW,J3 as eX,tb as eY,ob as eZ,Z3 as e_,Xk as ea,Z4 as eb,Mv as ec,Wc as ed,Uc as ee,R4 as ef,$k as eg,sw as eh,_5 as ei,a3 as ej,r3 as ek,Qw as el,y4 as em,Ex as en,Kw as eo,Uw as ep,b3 as eq,_4 as er,g3 as es,Ck as et,h5 as eu,Jw as ev,Ok as ew,H5 as ex,c5 as ey,Vw as ez,p4 as f,f3 as f0,D3 as f1,qk as f2,Rw as f3,rb as f4,ab as f5,sb as f6,dy as f7,my as f8,cb as f9,Ey as fa,Ry as fb,ib as fc,lb as fd,db as fe,ub as ff,W4 as g,Xx as h,Ek as i,k4 as j,z4 as k,rk as l,c4 as m,r4 as n,h3 as o,uw as p,I4 as q,D5 as r,Cx as s,B5 as t,n3 as u,Sx as v,Dk as w,Hk as x,h4 as y,qx as z};
