"use strict";(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[413],{82246:function(e,t,r){r.d(t,{CY:function(){return o$},Cl:function(){return oM},Ni:function(){return C},TP:function(){return b},Yu:function(){return p},dB:function(){return M},iU:function(){return w},is:function(){return ox}});var n,i,o,l=r(64220),a=!l.sk&&!!l.Rk,s=()=>void 0,d=e=>null!=e,u=e=>e.filter(d),c=e=>"function"!=typeof e||e.length?e:e(),g=e=>Array.isArray(e)?e:e?[e]:[],f=a?e=>(0,l.ei)()?(0,l.$W)(e):e:l.$W,p=function(e){let[t,r]=(0,l.gQ)(),n=e?.throw?(e,t)=>{throw r(e instanceof Error?e:Error(t)),e}:(e,t)=>{r(e instanceof Error?e:Error(t))},i=e?.api?Array.isArray(e.api)?e.api:[e.api]:[globalThis.localStorage].filter(Boolean),o=e?.prefix?`${e.prefix}.`:"",a=new Map,s=new Proxy({},{get(t,r){let s=a.get(r);s||(s=(0,l.gQ)(void 0,{equals:!1}),a.set(r,s)),s[0]();let d=i.reduce((e,t)=>{if(null!==e||!t)return e;try{return t.getItem(`${o}${r}`)}catch(e){return n(e,`Error reading ${o}${r} from ${t.name}`),null}},null);return null!==d&&e?.deserializer?e.deserializer(d,r,e.options):d}});return e?.sync!==!1&&(0,l.H3)(()=>{let e=e=>{let t=!1;i.forEach(r=>{try{r!==e.storageArea&&e.key&&e.newValue!==r.getItem(e.key)&&(e.newValue?r.setItem(e.key,e.newValue):r.removeItem(e.key),t=!0)}catch(t){n(t,`Error synching api ${r.name} from storage event (${e.key}=${e.newValue})`)}}),t&&e.key&&a.get(e.key)?.[1]()};"addEventListener"in globalThis?(globalThis.addEventListener("storage",e),(0,l.$W)(()=>globalThis.removeEventListener("storage",e))):(i.forEach(t=>t.addEventListener?.("storage",e)),(0,l.$W)(()=>i.forEach(t=>t.removeEventListener?.("storage",e))))}),[s,(t,r,l)=>{let s=e?.serializer?e.serializer(r,t,l??e.options):r,d=`${o}${t}`;i.forEach(e=>{try{e.getItem(d)!==s&&e.setItem(d,s)}catch(r){n(r,`Error setting ${o}${t} to ${s} in ${e.name}`)}});let u=a.get(t);u&&u[1]()},{clear:()=>i.forEach(e=>{try{e.clear()}catch(t){n(t,`Error clearing ${e.name}`)}}),error:t,remove:e=>i.forEach(t=>{try{t.removeItem(`${o}${e}`)}catch(r){n(r,`Error removing ${o}${e} from ${t.name}`)}}),toJSON:()=>{let t={},r=(r,n)=>{if(!t.hasOwnProperty(r)){let i=n&&e?.deserializer?e.deserializer(n,r,e.options):n;i&&(t[r]=i)}};return i.forEach(e=>{if("function"==typeof e.getAll){let t;try{t=e.getAll()}catch(t){n(t,`Error getting all values from in ${e.name}`)}for(let e of t)r(e,t[e])}else{let i=0,o;try{for(;o=e.key(i++);)t.hasOwnProperty(o)||r(o,e.getItem(o))}catch(t){n(t,`Error getting all values from ${e.name}`)}}}),t}}]},h=e=>{if(!e)return"";let t="";for(let r in e){if(!e.hasOwnProperty(r))continue;let n=e[r];t+=n instanceof Date?`; ${r}=${n.toUTCString()}`:"boolean"==typeof n?`; ${r}`:`; ${r}=${n}`}return t},y=("function"==typeof(n={_cookies:[globalThis.document,"cookie"],getItem:e=>y._cookies[0][y._cookies[1]].match("(^|;)\\s*"+e+"\\s*=\\s*([^;]+)")?.pop()??null,setItem:(e,t,r)=>{let n=y.getItem(e);y._cookies[0][y._cookies[1]]=`${e}=${t}${h(r)}`;let i=Object.assign(new Event("storage"),{key:e,oldValue:n,newValue:t,url:globalThis.document.URL,storageArea:y});window.dispatchEvent(i)},removeItem:e=>{y._cookies[0][y._cookies[1]]=`${e}=deleted${h({expires:new Date(0)})}`},key:e=>{let t=null,r=0;return y._cookies[0][y._cookies[1]].replace(/(?:^|;)\s*(.+?)\s*=\s*[^;]+/g,(n,i)=>(!t&&i&&r++===e&&(t=i),"")),t},get length(){let e=0;return y._cookies[0][y._cookies[1]].replace(/(?:^|;)\s*.+?\s*=\s*[^;]+/g,t=>(e+=t?1:0,"")),e}}).clear||(n.clear=()=>{let e;for(;e=n.key(0);)n.removeItem(e)}),n),v="bottom",b="system",m=Object.keys(l.QR)[0],x=Object.keys(l.kw)[0],w=(0,l.kr)({client:void 0,onlineManager:void 0,queryFlavor:"",version:"",shadowDOMTarget:void 0});function $(){return(0,l.qp)(w)}var k=(0,l.kr)(void 0),M=e=>{let[t,r]=(0,l.gQ)(null),n=()=>{let e=t();null!=e&&(e.close(),r(null))},i=(n,i)=>{if(null!=t())return;let o=window.open("","TSQD-Devtools-Panel",`width=${n},height=${i},popup`);if(!o)throw Error("Failed to open popup. Please allow popups for this site to view the devtools in picture-in-picture mode.");o.document.head.innerHTML="",o.document.body.innerHTML="",(0,l.FW)(o.document),o.document.title="TanStack Query Devtools",o.document.body.style.margin="0",o.addEventListener("pagehide",()=>{e.setLocalStore("pip_open","false"),r(null)}),[...($().shadowDOMTarget||document).styleSheets].forEach(e=>{try{let t=[...e.cssRules].map(e=>e.cssText).join(""),r=document.createElement("style"),n=e.ownerNode,i="";n&&"id"in n&&(i=n.id),i&&r.setAttribute("id",i),r.textContent=t,o.document.head.appendChild(r)}catch(r){let t=document.createElement("link");if(null==e.href)return;t.rel="stylesheet",t.type=e.type,t.media=e.media.toString(),t.href=e.href,o.document.head.appendChild(t)}}),(0,l.Qj)(["focusin","focusout","pointermove","keydown","pointerdown","pointerup","click","mousedown","input"],o.document),e.setLocalStore("pip_open","true"),r(o)};(0,l.GW)(()=>{"true"!==(e.localStore.pip_open??"false")||e.disabled||i(Number(window.innerWidth),Number(e.localStore.height||500))}),(0,l.GW)(()=>{let e=($().shadowDOMTarget||document).querySelector("#_goober"),r=t();if(e&&r){let t=new MutationObserver(()=>{let t=($().shadowDOMTarget||r.document).querySelector("#_goober");t&&(t.textContent=e.textContent)});t.observe(e,{childList:!0,subtree:!0,characterDataOldValue:!0}),(0,l.$W)(()=>{t.disconnect()})}});let o=(0,l.dD)(()=>({pipWindow:t(),requestPipWindow:i,closePipWindow:n,disabled:e.disabled??!1}));return(0,l.LM)(k.Provider,{value:o,get children(){return e.children}})},S=()=>(0,l.dD)(()=>{let e=(0,l.qp)(k);if(!e)throw Error("usePiPWindow must be used within a PiPProvider");return e()}),C=(0,l.kr)(()=>"dark");function L(){return(0,l.qp)(C)}var q={À:"A",Á:"A",Â:"A",Ã:"A",Ä:"A",Å:"A",Ấ:"A",Ắ:"A",Ẳ:"A",Ẵ:"A",Ặ:"A",Æ:"AE",Ầ:"A",Ằ:"A",Ȃ:"A",Ç:"C",Ḉ:"C",È:"E",É:"E",Ê:"E",Ë:"E",Ế:"E",Ḗ:"E",Ề:"E",Ḕ:"E",Ḝ:"E",Ȇ:"E",Ì:"I",Í:"I",Î:"I",Ï:"I",Ḯ:"I",Ȋ:"I",Ð:"D",Ñ:"N",Ò:"O",Ó:"O",Ô:"O",Õ:"O",Ö:"O",Ø:"O",Ố:"O",Ṍ:"O",Ṓ:"O",Ȏ:"O",Ù:"U",Ú:"U",Û:"U",Ü:"U",Ý:"Y",à:"a",á:"a",â:"a",ã:"a",ä:"a",å:"a",ấ:"a",ắ:"a",ẳ:"a",ẵ:"a",ặ:"a",æ:"ae",ầ:"a",ằ:"a",ȃ:"a",ç:"c",ḉ:"c",è:"e",é:"e",ê:"e",ë:"e",ế:"e",ḗ:"e",ề:"e",ḕ:"e",ḝ:"e",ȇ:"e",ì:"i",í:"i",î:"i",ï:"i",ḯ:"i",ȋ:"i",ð:"d",ñ:"n",ò:"o",ó:"o",ô:"o",õ:"o",ö:"o",ø:"o",ố:"o",ṍ:"o",ṓ:"o",ȏ:"o",ù:"u",ú:"u",û:"u",ü:"u",ý:"y",ÿ:"y",Ā:"A",ā:"a",Ă:"A",ă:"a",Ą:"A",ą:"a",Ć:"C",ć:"c",Ĉ:"C",ĉ:"c",Ċ:"C",ċ:"c",Č:"C",č:"c",C̆:"C",c̆:"c",Ď:"D",ď:"d",Đ:"D",đ:"d",Ē:"E",ē:"e",Ĕ:"E",ĕ:"e",Ė:"E",ė:"e",Ę:"E",ę:"e",Ě:"E",ě:"e",Ĝ:"G",Ǵ:"G",ĝ:"g",ǵ:"g",Ğ:"G",ğ:"g",Ġ:"G",ġ:"g",Ģ:"G",ģ:"g",Ĥ:"H",ĥ:"h",Ħ:"H",ħ:"h",Ḫ:"H",ḫ:"h",Ĩ:"I",ĩ:"i",Ī:"I",ī:"i",Ĭ:"I",ĭ:"i",Į:"I",į:"i",İ:"I",ı:"i",Ĳ:"IJ",ĳ:"ij",Ĵ:"J",ĵ:"j",Ķ:"K",ķ:"k",Ḱ:"K",ḱ:"k",K̆:"K",k̆:"k",Ĺ:"L",ĺ:"l",Ļ:"L",ļ:"l",Ľ:"L",ľ:"l",Ŀ:"L",ŀ:"l",Ł:"l",ł:"l",Ḿ:"M",ḿ:"m",M̆:"M",m̆:"m",Ń:"N",ń:"n",Ņ:"N",ņ:"n",Ň:"N",ň:"n",ŉ:"n",N̆:"N",n̆:"n",Ō:"O",ō:"o",Ŏ:"O",ŏ:"o",Ő:"O",ő:"o",Œ:"OE",œ:"oe",P̆:"P",p̆:"p",Ŕ:"R",ŕ:"r",Ŗ:"R",ŗ:"r",Ř:"R",ř:"r",R̆:"R",r̆:"r",Ȓ:"R",ȓ:"r",Ś:"S",ś:"s",Ŝ:"S",ŝ:"s",Ş:"S",Ș:"S",ș:"s",ş:"s",Š:"S",š:"s",Ţ:"T",ţ:"t",ț:"t",Ț:"T",Ť:"T",ť:"t",Ŧ:"T",ŧ:"t",T̆:"T",t̆:"t",Ũ:"U",ũ:"u",Ū:"U",ū:"u",Ŭ:"U",ŭ:"u",Ů:"U",ů:"u",Ű:"U",ű:"u",Ų:"U",ų:"u",Ȗ:"U",ȗ:"u",V̆:"V",v̆:"v",Ŵ:"W",ŵ:"w",Ẃ:"W",ẃ:"w",X̆:"X",x̆:"x",Ŷ:"Y",ŷ:"y",Ÿ:"Y",Y̆:"Y",y̆:"y",Ź:"Z",ź:"z",Ż:"Z",ż:"z",Ž:"Z",ž:"z",ſ:"s",ƒ:"f",Ơ:"O",ơ:"o",Ư:"U",ư:"u",Ǎ:"A",ǎ:"a",Ǐ:"I",ǐ:"i",Ǒ:"O",ǒ:"o",Ǔ:"U",ǔ:"u",Ǖ:"U",ǖ:"u",Ǘ:"U",ǘ:"u",Ǚ:"U",ǚ:"u",Ǜ:"U",ǜ:"u",Ứ:"U",ứ:"u",Ṹ:"U",ṹ:"u",Ǻ:"A",ǻ:"a",Ǽ:"AE",ǽ:"ae",Ǿ:"O",ǿ:"o",Þ:"TH",þ:"th",Ṕ:"P",ṕ:"p",Ṥ:"S",ṥ:"s",X́:"X",x́:"x",Ѓ:"Г",ѓ:"г",Ќ:"К",ќ:"к",A̋:"A",a̋:"a",E̋:"E",e̋:"e",I̋:"I",i̋:"i",Ǹ:"N",ǹ:"n",Ồ:"O",ồ:"o",Ṑ:"O",ṑ:"o",Ừ:"U",ừ:"u",Ẁ:"W",ẁ:"w",Ỳ:"Y",ỳ:"y",Ȁ:"A",ȁ:"a",Ȅ:"E",ȅ:"e",Ȉ:"I",ȉ:"i",Ȍ:"O",ȍ:"o",Ȑ:"R",ȑ:"r",Ȕ:"U",ȕ:"u",B̌:"B",b̌:"b",Č̣:"C",č̣:"c",Ê̌:"E",ê̌:"e",F̌:"F",f̌:"f",Ǧ:"G",ǧ:"g",Ȟ:"H",ȟ:"h",J̌:"J",ǰ:"j",Ǩ:"K",ǩ:"k",M̌:"M",m̌:"m",P̌:"P",p̌:"p",Q̌:"Q",q̌:"q",Ř̩:"R",ř̩:"r",Ṧ:"S",ṧ:"s",V̌:"V",v̌:"v",W̌:"W",w̌:"w",X̌:"X",x̌:"x",Y̌:"Y",y̌:"y",A̧:"A",a̧:"a",B̧:"B",b̧:"b",Ḑ:"D",ḑ:"d",Ȩ:"E",ȩ:"e",Ɛ̧:"E",ɛ̧:"e",Ḩ:"H",ḩ:"h",I̧:"I",i̧:"i",Ɨ̧:"I",ɨ̧:"i",M̧:"M",m̧:"m",O̧:"O",o̧:"o",Q̧:"Q",q̧:"q",U̧:"U",u̧:"u",X̧:"X",x̧:"x",Z̧:"Z",z̧:"z"},T=RegExp(Object.keys(q).join("|"),"g"),E={CASE_SENSITIVE_EQUAL:7,EQUAL:6,STARTS_WITH:5,WORD_STARTS_WITH:4,CONTAINS:3,ACRONYM:2,MATCHES:1,NO_MATCH:0};function D(e,t,r){var n;if((r=r||{}).threshold=null!=(n=r.threshold)?n:E.MATCHES,!r.accessors){let n=F(e,t,r);return{rankedValue:e,rank:n,accessorIndex:-1,accessorThreshold:r.threshold,passed:n>=r.threshold}}let i=function(e,t){let r=[];for(let n=0,i=t.length;n<i;n++){let i=t[n],o="function"==typeof i?A:{...A,...i},l=function(e,t){let r=t;"object"==typeof t&&(r=t.accessor);let n=r(e);return null==n?[]:Array.isArray(n)?n:[String(n)]}(e,i);for(let e=0,t=l.length;e<t;e++)r.push({itemValue:l[e],attributes:o})}return r}(e,r.accessors),o={rankedValue:e,rank:E.NO_MATCH,accessorIndex:-1,accessorThreshold:r.threshold,passed:!1};for(let e=0;e<i.length;e++){let n=i[e],l=F(n.itemValue,t,r),{minRanking:a,maxRanking:s,threshold:d=r.threshold}=n.attributes;l<a&&l>=E.MATCHES?l=a:l>s&&(l=s),(l=Math.min(l,s))>=d&&l>o.rank&&(o.rank=l,o.passed=!0,o.accessorIndex=e,o.accessorThreshold=d,o.rankedValue=n.itemValue)}return o}function F(e,t,r){let n;return(e=P(e,r),(t=P(t,r)).length>e.length)?E.NO_MATCH:e===t?E.CASE_SENSITIVE_EQUAL:(e=e.toLowerCase())===(t=t.toLowerCase())?E.EQUAL:e.startsWith(t)?E.STARTS_WITH:e.includes(` ${t}`)?E.WORD_STARTS_WITH:e.includes(t)?E.CONTAINS:1===t.length?E.NO_MATCH:(n="",e.split(" ").forEach(e=>{e.split("-").forEach(e=>{n+=e.substr(0,1)})}),n).includes(t)?E.ACRONYM:function(e,t){let r=0,n=0;function i(e,t,n){for(let i=n,o=t.length;i<o;i++)if(t[i]===e)return r+=1,i+1;return -1}let o=i(t[0],e,0);if(o<0)return E.NO_MATCH;n=o;for(let r=1,o=t.length;r<o;r++)if(!((n=i(t[r],e,n))>-1))return E.NO_MATCH;return function(e){let n=r/t.length;return E.MATCHES+1/e*n}(n-o)}(e,t)}function P(e,t){let{keepDiacritics:r}=t;return e=`${e}`,r||(e=e.replace(T,e=>q[e])),e}var A={maxRanking:1/0,minRanking:-1/0},z={data:""},O=e=>"object"==typeof window?((e?e.querySelector("#_goober"):window._goober)||Object.assign((e||document.head).appendChild(document.createElement("style")),{innerHTML:" ",id:"_goober"})).firstChild:e||z,I=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,K=/\/\*[^]*?\*\/|  +/g,G=/\n+/g,R=(e,t)=>{let r="",n="",i="";for(let o in e){let l=e[o];"@"==o[0]?"i"==o[1]?r=o+" "+l+";":n+="f"==o[1]?R(l,o):o+"{"+R(l,"k"==o[1]?"":t)+"}":"object"==typeof l?n+=R(l,t?t.replace(/([^,])+/g,e=>o.replace(/([^,]*:\S+\([^)]*\))|([^,])+/g,t=>/&/.test(t)?t.replace(/&/g,e):e?e+" "+t:t)):o):null!=l&&(o=/^--/.test(o)?o:o.replace(/[A-Z]/g,"-$&").toLowerCase(),i+=R.p?R.p(o,l):o+":"+l+";")}return r+(t&&i?t+"{"+i+"}":i)+n},B={},H=e=>{if("object"==typeof e){let t="";for(let r in e)t+=r+H(e[r]);return t}return e},W=(e,t,r,n,i)=>{var o;let l=H(e),a=B[l]||(B[l]=(e=>{let t=0,r=11;for(;t<e.length;)r=101*r+e.charCodeAt(t++)>>>0;return"go"+r})(l));if(!B[a]){let t=l!==e?e:(e=>{let t,r,n=[{}];for(;t=I.exec(e.replace(K,""));)t[4]?n.shift():t[3]?(r=t[3].replace(G," ").trim(),n.unshift(n[0][r]=n[0][r]||{})):n[0][t[1]]=t[2].replace(G," ").trim();return n[0]})(e);B[a]=R(i?{["@keyframes "+a]:t}:t,r?"":"."+a)}let s=r&&B.g?B.g:null;return r&&(B.g=B[a]),o=B[a],s?t.data=t.data.replace(s,o):-1===t.data.indexOf(o)&&(t.data=n?o+t.data:t.data+o),a},U=(e,t,r)=>e.reduce((e,n,i)=>{let o=t[i];if(o&&o.call){let e=o(r),t=e&&e.props&&e.props.className||/^go/.test(e)&&e;o=t?"."+t:e&&"object"==typeof e?e.props?"":R(e,""):!1===e?"":e}return e+n+(null==o?"":o)},"");function V(e){let t=this||{},r=e.call?e(t.p):e;return W(r.unshift?r.raw?U(r,[].slice.call(arguments,1),t.p):r.reduce((e,r)=>Object.assign(e,r&&r.call?r(t.p):r),{}):r,O(t.target),t.g,t.o,t.k)}function Q(){for(var e,t,r=0,n="",i=arguments.length;r<i;r++)(e=arguments[r])&&(t=function e(t){var r,n,i="";if("string"==typeof t||"number"==typeof t)i+=t;else if("object"==typeof t){if(Array.isArray(t)){var o=t.length;for(r=0;r<o;r++)t[r]&&(n=e(t[r]))&&(i&&(i+=" "),i+=n)}else for(n in t)t[n]&&(i&&(i+=" "),i+=n)}return i}(e))&&(n&&(n+=" "),n+=t);return n}function N(...e){return(...t)=>{for(let r of e)r&&r(...t)}}V.bind({g:1}),V.bind({k:1});var j=l.sk?e=>null!=e&&"object"==typeof e&&"t"in e:e=>e instanceof Element;function X(e){requestAnimationFrame(()=>requestAnimationFrame(e))}var _=e=>{let t=(0,l.dD)(()=>{let t=e.name||"s";return{enterActive:(e.enterActiveClass||t+"-enter-active").split(" "),enter:(e.enterClass||t+"-enter").split(" "),enterTo:(e.enterToClass||t+"-enter-to").split(" "),exitActive:(e.exitActiveClass||t+"-exit-active").split(" "),exit:(e.exitClass||t+"-exit").split(" "),exitTo:(e.exitToClass||t+"-exit-to").split(" "),move:(e.moveClass||t+"-move").split(" ")}});return function(e,t){let r=(0,l.Zw)(e);if(l.sk){let e=r.slice();return()=>e}let{onChange:n}=t,i=new Set(t.appear?void 0:r),o=new WeakSet,[a,s]=(0,l.gQ)([],{equals:!1}),[d]=(0,l.Yz)(),u=e=>{for(let t of(s(t=>(t.push.apply(t,e),t)),e))o.delete(t)},c=(e,t,r)=>e.splice(r,0,t);return(0,l.dD)(t=>{let r=a(),s=e();if(s[l.jt],(0,l.Zw)(d))return d(),t;if(r.length){let e=t.filter(e=>!r.includes(e));return r.length=0,n({list:e,added:[],removed:[],unchanged:e,finishRemoved:u}),e}return(0,l.Zw)(()=>{let e=new Set(s),r=s.slice(),l=[],a=[],d=[];for(let e of s)(i.has(e)?d:l).push(e);let g=!l.length;for(let n=0;n<t.length;n++){let i=t[n];e.has(i)||(o.has(i)||(a.push(i),o.add(i)),c(r,i,n)),g&&i!==r[n]&&(g=!1)}return!a.length&&g?t:(n({list:r,added:l,removed:a,unchanged:d,finishRemoved:u}),i=e,r)})},t.appear?[]:r.slice())}(function(e,t=j,r=j){let n=(0,l.dD)(e),i=(0,l.dD)(()=>(function e(t,r){if(r(t))return t;if("function"==typeof t&&!t.length)return e(t(),r);if(Array.isArray(t)){let n=[];for(let i of t){let t=e(i,r);t&&(Array.isArray(t)?n.push.apply(n,t):n.push(t))}return n.length?n:null}return null})(n(),l.sk?r:t));return i.toArray=()=>{let e=i();return Array.isArray(e)?e:e?[e]:[]},i}(()=>e.children).toArray,{appear:e.appear,onChange({added:r,removed:n,finishRemoved:i,list:o}){let l=t();for(let t of r)!function(e,t,r,n){let{onBeforeEnter:i,onEnter:o,onAfterEnter:l}=t;function a(t){t&&t.target!==r||(r.removeEventListener("transitionend",a),r.removeEventListener("animationend",a),r.classList.remove(...e.enterActive),r.classList.remove(...e.enterTo),l?.(r))}i?.(r),r.classList.add(...e.enter),r.classList.add(...e.enterActive),queueMicrotask(()=>{r.parentNode&&o?.(r,()=>a())}),X(()=>{r.classList.remove(...e.enter),r.classList.add(...e.enterTo),(!o||o.length<2)&&(r.addEventListener("transitionend",a),r.addEventListener("animationend",a))})}(l,e,t);let a=[];for(let e of o)e.isConnected&&(e instanceof HTMLElement||e instanceof SVGElement)&&a.push({el:e,rect:e.getBoundingClientRect()});for(let t of(queueMicrotask(()=>{let e=[];for(let{el:t,rect:r}of a)if(t.isConnected){let n=t.getBoundingClientRect(),i=r.left-n.left,o=r.top-n.top;(i||o)&&(t.style.transform=`translate(${i}px, ${o}px)`,t.style.transitionDuration="0s",e.push(t))}for(let t of(document.body.offsetHeight,e)){let e=function(r){(r.target===t||/transform$/.test(r.propertyName))&&(t.removeEventListener("transitionend",e),t.classList.remove(...l.move))};t.classList.add(...l.move),t.style.transform=t.style.transitionDuration="",t.addEventListener("transitionend",e)}}),n))!function(e,t,r,n){let{onBeforeExit:i,onExit:o,onAfterExit:l}=t;if(!r.parentNode)return n?.();function a(t){t&&t.target!==r||(n?.(),r.removeEventListener("transitionend",a),r.removeEventListener("animationend",a),r.classList.remove(...e.exitActive),r.classList.remove(...e.exitTo),l?.(r))}i?.(r),r.classList.add(...e.exit),r.classList.add(...e.exitActive),o?.(r,()=>a()),X(()=>{r.classList.remove(...e.exit),r.classList.add(...e.exitTo),(!o||o.length<2)&&(r.addEventListener("transitionend",a),r.addEventListener("animationend",a))})}(l,e,t,()=>i([t]))}})},Y=Symbol("fallback");function Z(e){for(let t of e)t.dispose()}function J(e){let{by:t}=e;return(0,l.dD)(function(e,t,r,n={}){if(l.sk){let t=e(),i=[];if(t&&t.length)for(let e=0,n=t.length;e<n;e++)i.push(r(()=>t[e],()=>e));else n.fallback&&(i=[n.fallback()]);return()=>i}let i=new Map;return(0,l.$W)(()=>Z(i.values())),()=>{let r=e()||[];return r[l.jt],(0,l.Zw)(()=>{if(!r.length)return(Z(i.values()),i.clear(),n.fallback)?[(0,l.so)(e=>(i.set(Y,{dispose:e}),n.fallback()))]:[];let e=Array(r.length),a=i.get(Y);if(!i.size||a){a?.dispose(),i.delete(Y);for(let n=0;n<r.length;n++){let i=r[n],l=t(i,n);o(e,i,n,l)}return e}let s=new Set(i.keys());for(let n=0;n<r.length;n++){let l=r[n],a=t(l,n);s.delete(a);let d=i.get(a);d?(e[n]=d.mapped,d.setIndex?.(n),d.setItem(()=>l)):o(e,l,n,a)}for(let e of s)i.get(e)?.dispose(),i.delete(e);return e})};function o(e,t,n,o){(0,l.so)(a=>{let[s,d]=(0,l.gQ)(t),u={setItem:d,dispose:a};if(r.length>1){let[e,t]=(0,l.gQ)(n);u.setIndex=t,u.mapped=r(s,e)}else u.mapped=r(s);i.set(o,u),e[n]=u.mapped})}}(()=>e.each,"function"==typeof t?t:e=>e[t],e.children,"fallback"in e?{fallback:()=>e.fallback}:void 0))}function ee(e,t,r){if(l.sk)return;let n=new WeakMap,{observe:i,unobserve:o}=function(e,t){if(l.sk)return{observe:s,unobserve:s};let r=new ResizeObserver(e);return(0,l.$W)(r.disconnect.bind(r)),{observe:e=>r.observe(e,t),unobserve:r.unobserve.bind(r)}}(e=>{for(let r of e){let{contentRect:e,target:i}=r,o=Math.round(e.width),l=Math.round(e.height),a=n.get(i);a&&a.width===o&&a.height===l||(t(e,i,r),n.set(i,{width:o,height:l}))}},r);(0,l.GW)(t=>{let r=u(g(c(e)));return!function(e,t,r,n){let i,o;let l=e.length,a=t.length,s=0;if(!a){for(;s<l;s++)r(e[s]);return}if(!l){for(;s<a;s++)n(t[s]);return}for(;s<a&&t[s]===e[s];s++);for(i of(t=t.slice(s),e=e.slice(s),t))e.includes(i)||n(i);for(o of e)t.includes(o)||r(o)}(r,t,i,o),r},[])}var et=/((?:--)?(?:\w+-?)+)\s*:\s*([^;]*)/g;function er(e){let t;let r={};for(;t=et.exec(e);)r[t[1]]=t[2];return r}function en(e,t){if("string"==typeof e){if("string"==typeof t)return`${e};${t}`;e=er(e)}else"string"==typeof t&&(t=er(t));return{...e,...t}}function ei(e,t){let r=[...e],n=r.indexOf(t);return -1!==n&&r.splice(n,1),r}function eo(e){return"[object String]"===Object.prototype.toString.call(e)}function el(e){return t=>`${e()}-${t}`}function ea(e,t){return!!e&&(e===t||e.contains(t))}function es(e,t=!1){let{activeElement:r}=ed(e);if(!r?.nodeName)return null;if(eu(r)&&r.contentDocument)return es(r.contentDocument.body,t);if(t){let e=r.getAttribute("aria-activedescendant");if(e){let t=ed(r).getElementById(e);if(t)return t}}return r}function ed(e){return e?e.ownerDocument||e:document}function eu(e){return"IFRAME"===e.tagName}var ec=((i=ec||{}).Escape="Escape",i.Enter="Enter",i.Tab="Tab",i.Space=" ",i.ArrowDown="ArrowDown",i.ArrowLeft="ArrowLeft",i.ArrowRight="ArrowRight",i.ArrowUp="ArrowUp",i.End="End",i.Home="Home",i.PageDown="PageDown",i.PageUp="PageUp",i);function eg(e){return"undefined"!=typeof window&&null!=window.navigator&&e.test(window.navigator.userAgentData?.platform||window.navigator.platform)}function ef(){return eg(/^Mac/i)}function ep(e,t){return t&&("function"==typeof t?t(e):t[0](t[1],e)),e?.defaultPrevented}function eh(e){return t=>{for(let r of e)ep(t,r)}}function ey(e){if(e){if(function(){if(null==ev){ev=!1;try{document.createElement("div").focus({get preventScroll(){return ev=!0,!0}})}catch(e){}}return ev}())e.focus({preventScroll:!0});else{let t=function(e){let t=e.parentNode,r=[],n=document.scrollingElement||document.documentElement;for(;t instanceof HTMLElement&&t!==n;)(t.offsetHeight<t.scrollHeight||t.offsetWidth<t.scrollWidth)&&r.push({element:t,scrollTop:t.scrollTop,scrollLeft:t.scrollLeft}),t=t.parentNode;return n instanceof HTMLElement&&r.push({element:n,scrollTop:n.scrollTop,scrollLeft:n.scrollLeft}),r}(e);e.focus(),function(e){for(let{element:t,scrollTop:r,scrollLeft:n}of e)t.scrollTop=r,t.scrollLeft=n}(t)}}}var ev=null,eb=["input:not([type='hidden']):not([disabled])","select:not([disabled])","textarea:not([disabled])","button:not([disabled])","a[href]","area[href]","[tabindex]","iframe","object","embed","audio[controls]","video[controls]","[contenteditable]:not([contenteditable='false'])"],em=[...eb,'[tabindex]:not([tabindex="-1"]):not([disabled])'],ex=eb.join(":not([hidden]),")+",[tabindex]:not([disabled]):not([hidden])",ew=em.join(':not([hidden]):not([tabindex="-1"]),');function e$(e){return ek(e)&&!(0>parseInt(e.getAttribute("tabindex")||"0",10))}function ek(e){return e.matches(ex)&&eM(e)}function eM(e,t){return"#comment"!==e.nodeName&&function(e){if(!(e instanceof HTMLElement)&&!(e instanceof SVGElement))return!1;let{display:t,visibility:r}=e.style,n="none"!==t&&"hidden"!==r&&"collapse"!==r;if(n){if(!e.ownerDocument.defaultView)return n;let{getComputedStyle:t}=e.ownerDocument.defaultView,{display:r,visibility:i}=t(e);n="none"!==r&&"hidden"!==i&&"collapse"!==i}return n}(e)&&!e.hasAttribute("hidden")&&("DETAILS"!==e.nodeName||!t||"SUMMARY"===t.nodeName||e.hasAttribute("open"))&&(!e.parentElement||eM(e.parentElement,e))}function eS(e){for(;e&&!function(e){let t=window.getComputedStyle(e);return/(auto|scroll)/.test(t.overflow+t.overflowX+t.overflowY)}(e);)e=e.parentElement;return e||document.scrollingElement||document.documentElement}function eC(){}function eL(e,t){return(0,l.dG)(e,t)}var eq=new Map,eT=new Set;function eE(){if("undefined"==typeof window)return;let e=t=>{if(!t.target)return;let r=eq.get(t.target);if(r&&(r.delete(t.propertyName),0===r.size&&(t.target.removeEventListener("transitioncancel",e),eq.delete(t.target)),0===eq.size)){for(let e of eT)e();eT.clear()}};document.body.addEventListener("transitionrun",t=>{if(!t.target)return;let r=eq.get(t.target);r||(r=new Set,eq.set(t.target,r),t.target.addEventListener("transitioncancel",e)),r.add(t.propertyName)}),document.body.addEventListener("transitionend",e)}function eD(e,t){let r=eF(e,t,"left"),n=eF(e,t,"top"),i=t.offsetWidth,o=t.offsetHeight,l=e.scrollLeft,a=e.scrollTop,s=l+e.offsetWidth,d=a+e.offsetHeight;r<=l?l=r:r+i>s&&(l+=r+i-s),n<=a?a=n:n+o>d&&(a+=n+o-d),e.scrollLeft=l,e.scrollTop=a}function eF(e,t,r){let n="left"===r?"offsetLeft":"offsetTop",i=0;for(;t.offsetParent&&(i+=t[n],t.offsetParent!==e);){if(t.offsetParent.contains(e)){i-=e[n];break}t=t.offsetParent}return i}"undefined"!=typeof document&&("loading"!==document.readyState?eE():document.addEventListener("DOMContentLoaded",eE));var eP={border:"0",clip:"rect(0 0 0 0)","clip-path":"inset(50%)",height:"1px",margin:"0 -1px -1px 0",overflow:"hidden",padding:"0",position:"absolute",width:"1px","white-space":"nowrap"};function eA(e){return t=>(e(t),()=>e(void 0))}function ez(e,t){let[r,n]=(0,l.gQ)(eO(t?.()));return(0,l.GW)(()=>{n(e()?.tagName.toLowerCase()||eO(t?.()))}),r}function eO(e){return eo(e)?e:void 0}function eI(e){let[t,r]=(0,l.eY)(e,["as"]);if(!t.as)throw Error("[kobalte]: Polymorphic is missing the required `as` prop.");return(0,l.LM)(l.m5,(0,l.dG)(r,{get component(){return t.as}}))}var eK=["id","name","validationState","required","disabled","readOnly"],eG=(0,l.kr)();function eR(){let e=(0,l.qp)(eG);if(void 0===e)throw Error("[kobalte]: `useFormControlContext` must be used within a `FormControlContext.Provider` component");return e}function eB(e){let t=eR(),r=eL({id:t.generateId("description")},e);return(0,l.GW)(()=>(0,l.$W)(t.registerDescription(r.id))),(0,l.LM)(eI,(0,l.dG)({as:"div"},()=>t.dataset(),r))}function eH(e){let t=eR(),r=eL({id:t.generateId("error-message")},e),[n,i]=(0,l.eY)(r,["forceMount"]),o=()=>"invalid"===t.validationState();return(0,l.GW)(()=>{o()&&(0,l.$W)(t.registerErrorMessage(i.id))}),(0,l.LM)(l.di,{get when(){return n.forceMount||o()},get children(){return(0,l.LM)(eI,(0,l.dG)({as:"div"},()=>t.dataset(),i))}})}function eW(e){let t;let r=eR(),n=eL({id:r.generateId("label")},e),[i,o]=(0,l.eY)(n,["ref"]),a=ez(()=>t,()=>"label");return(0,l.GW)(()=>(0,l.$W)(r.registerLabel(o.id))),(0,l.LM)(eI,(0,l.dG)({as:"label",ref(e){let r=N(e=>t=e,i.ref);"function"==typeof r&&r(e)},get for(){return(0,l.dD)(()=>"label"===a())()?r.fieldId():void 0}},()=>r.dataset(),o))}function eU(e){let[t,r]=(0,l.gQ)(e.defaultValue?.()),n=(0,l.dD)(()=>e.value?.()!==void 0),i=(0,l.dD)(()=>n()?e.value?.():t());return[i,t=>{(0,l.Zw)(()=>{let o=function(e,...t){return"function"==typeof e?e(...t):e}(t,i());return Object.is(o,i())||(n()||r(o),e.onChange?.(o)),o})}]}function eV(e){let[t,r]=eU(e);return[()=>t()??!1,r]}var eQ=Object.defineProperty,eN=(e,t)=>{for(var r in t)eQ(e,r,{get:t[r],enumerable:!0})},ej=(0,l.kr)();function eX(e,t){return!!(t.compareDocumentPosition(e)&Node.DOCUMENT_POSITION_PRECEDING)}function e_(e,t){let r=function(e){let t=e.map((e,t)=>[t,e]),r=!1;return(t.sort(([e,t],[n,i])=>{let o=t.ref(),l=i.ref();return o!==l&&o&&l?eX(o,l)?(e>n&&(r=!0),-1):(e<n&&(r=!0),1):0}),r)?t.map(([e,t])=>t):e}(e);e!==r&&t(r)}var eY=new Set(["Avst","Arab","Armi","Syrc","Samr","Mand","Thaa","Mend","Nkoo","Adlm","Rohg","Hebr"]),eZ=new Set(["ae","ar","arc","bcc","bqi","ckb","dv","fa","glk","he","ku","mzn","nqo","pnb","ps","sd","ug","ur","yi"]);function eJ(){let e="undefined"!=typeof navigator&&(navigator.language||navigator.userLanguage)||"en-US";return{locale:e,direction:!function(e){if(Intl.Locale){let t=new Intl.Locale(e).maximize().script??"";return eY.has(t)}let t=e.split("-")[0];return eZ.has(t)}(e)?"ltr":"rtl"}}var e0=eJ(),e1=new Set;function e2(){for(let e of(e0=eJ(),e1))e(e0)}var e3=(0,l.kr)();function e5(){let e=function(){let e={locale:"en-US",direction:"ltr"},[t,r]=(0,l.gQ)(e0),n=(0,l.dD)(()=>l.sk?e:t());return(0,l.H3)(()=>{0===e1.size&&window.addEventListener("languagechange",e2),e1.add(r),(0,l.$W)(()=>{e1.delete(r),0===e1.size&&window.removeEventListener("languagechange",e2)})}),{locale:()=>n().locale,direction:()=>n().direction}}();return(0,l.qp)(e3)||e}var e4=new Map,e6=class e extends Set{anchorKey;currentKey;constructor(t,r,n){super(t),t instanceof e?(this.anchorKey=r||t.anchorKey,this.currentKey=n||t.currentKey):(this.anchorKey=r,this.currentKey=n)}};function e9(e){return ef()||eg(/^iPhone/i)||eg(/^iPad/i)||ef()&&navigator.maxTouchPoints>1?e.altKey:e.ctrlKey}function e8(e){return ef()?e.metaKey:e.ctrlKey}function e7(e,t){let r=()=>c(e.selectionManager),n=()=>c(e.key),i=()=>c(e.shouldUseVirtualFocus),o=e=>{"none"!==r().selectionMode()&&("single"===r().selectionMode()?r().isSelected(n())&&!r().disallowEmptySelection()?r().toggleSelection(n()):r().replaceSelection(n()):e?.shiftKey?r().extendSelection(n()):"toggle"===r().selectionBehavior()||e8(e)||"pointerType"in e&&"touch"===e.pointerType?r().toggleSelection(n()):r().replaceSelection(n()))},a=()=>c(e.disabled)||r().isDisabled(n()),s=()=>!a()&&r().canSelectItem(n()),d=null,u=(0,l.dD)(()=>{if(!(i()||a()))return n()===r().focusedKey()?0:-1}),g=(0,l.dD)(()=>c(e.virtualized)?void 0:n());return(0,l.GW)((0,l.on)([t,n,i,()=>r().focusedKey(),()=>r().isFocused()],([t,r,n,i,o])=>{t&&r===i&&o&&!n&&document.activeElement!==t&&(e.focus?e.focus():ey(t))})),{isSelected:()=>r().isSelected(n()),isDisabled:a,allowsSelection:s,tabIndex:u,dataKey:g,onPointerDown:t=>{s()&&(d=t.pointerType,"mouse"!==t.pointerType||0!==t.button||c(e.shouldSelectOnPressUp)||o(t))},onPointerUp:t=>{s()&&"mouse"===t.pointerType&&0===t.button&&c(e.shouldSelectOnPressUp)&&c(e.allowsDifferentPressOrigin)&&o(t)},onClick:t=>{s()&&(c(e.shouldSelectOnPressUp)&&!c(e.allowsDifferentPressOrigin)||"mouse"!==d)&&o(t)},onKeyDown:e=>{s()&&["Enter"," "].includes(e.key)&&(e9(e)?r().toggleSelection(n()):o(e))},onMouseDown:e=>{a()&&e.preventDefault()},onFocus:e=>{let o=t();!(i()||a())&&o&&e.target===o&&r().setFocusedKey(n())}}}var te=class{collection;state;constructor(e,t){this.collection=e,this.state=t}selectionMode(){return this.state.selectionMode()}disallowEmptySelection(){return this.state.disallowEmptySelection()}selectionBehavior(){return this.state.selectionBehavior()}setSelectionBehavior(e){this.state.setSelectionBehavior(e)}isFocused(){return this.state.isFocused()}setFocused(e){this.state.setFocused(e)}focusedKey(){return this.state.focusedKey()}setFocusedKey(e){(null==e||this.collection().getItem(e))&&this.state.setFocusedKey(e)}selectedKeys(){return this.state.selectedKeys()}isSelected(e){if("none"===this.state.selectionMode())return!1;let t=this.getKey(e);return null!=t&&this.state.selectedKeys().has(t)}isEmpty(){return 0===this.state.selectedKeys().size}isSelectAll(){if(this.isEmpty())return!1;let e=this.state.selectedKeys();return this.getAllSelectableKeys().every(t=>e.has(t))}firstSelectedKey(){let e;for(let t of this.state.selectedKeys()){let r=this.collection().getItem(t),n=r?.index!=null&&e?.index!=null&&r.index<e.index;(!e||n)&&(e=r)}return e?.key}lastSelectedKey(){let e;for(let t of this.state.selectedKeys()){let r=this.collection().getItem(t),n=r?.index!=null&&e?.index!=null&&r.index>e.index;(!e||n)&&(e=r)}return e?.key}extendSelection(e){if("none"===this.selectionMode())return;if("single"===this.selectionMode()){this.replaceSelection(e);return}let t=this.getKey(e);if(null==t)return;let r=this.state.selectedKeys(),n=r.anchorKey||t,i=new e6(r,n,t);for(let e of this.getKeyRange(n,r.currentKey||t))i.delete(e);for(let e of this.getKeyRange(t,n))this.canSelectItem(e)&&i.add(e);this.state.setSelectedKeys(i)}getKeyRange(e,t){let r=this.collection().getItem(e),n=this.collection().getItem(t);return r&&n?null!=r.index&&null!=n.index&&r.index<=n.index?this.getKeyRangeInternal(e,t):this.getKeyRangeInternal(t,e):[]}getKeyRangeInternal(e,t){let r=[],n=e;for(;null!=n;){let e=this.collection().getItem(n);if(e&&"item"===e.type&&r.push(n),n===t)return r;n=this.collection().getKeyAfter(n)}return[]}getKey(e){let t=this.collection().getItem(e);return t?t&&"item"===t.type?t.key:null:e}toggleSelection(e){if("none"===this.selectionMode())return;if("single"===this.selectionMode()&&!this.isSelected(e)){this.replaceSelection(e);return}let t=this.getKey(e);if(null==t)return;let r=new e6(this.state.selectedKeys());r.has(t)?r.delete(t):this.canSelectItem(t)&&(r.add(t),r.anchorKey=t,r.currentKey=t),this.disallowEmptySelection()&&0===r.size||this.state.setSelectedKeys(r)}replaceSelection(e){if("none"===this.selectionMode())return;let t=this.getKey(e);if(null==t)return;let r=this.canSelectItem(t)?new e6([t],t,t):new e6;this.state.setSelectedKeys(r)}setSelectedKeys(e){if("none"===this.selectionMode())return;let t=new e6;for(let r of e){let e=this.getKey(r);if(null!=e&&(t.add(e),"single"===this.selectionMode()))break}this.state.setSelectedKeys(t)}selectAll(){"multiple"===this.selectionMode()&&this.state.setSelectedKeys(new Set(this.getAllSelectableKeys()))}clearSelection(){let e=this.state.selectedKeys();!this.disallowEmptySelection()&&e.size>0&&this.state.setSelectedKeys(new e6)}toggleSelectAll(){this.isSelectAll()?this.clearSelection():this.selectAll()}select(e,t){"none"!==this.selectionMode()&&("single"===this.selectionMode()?this.isSelected(e)&&!this.disallowEmptySelection()?this.toggleSelection(e):this.replaceSelection(e):"toggle"===this.selectionBehavior()||t&&"touch"===t.pointerType?this.toggleSelection(e):this.replaceSelection(e))}isSelectionEqual(e){if(e===this.state.selectedKeys())return!0;let t=this.selectedKeys();if(e.size!==t.size)return!1;for(let r of e)if(!t.has(r))return!1;for(let r of t)if(!e.has(r))return!1;return!0}canSelectItem(e){if("none"===this.state.selectionMode())return!1;let t=this.collection().getItem(e);return null!=t&&!t.disabled}isDisabled(e){let t=this.collection().getItem(e);return!t||t.disabled}getAllSelectableKeys(){let e=[];return(t=>{for(;null!=t;){if(this.canSelectItem(t)){let r=this.collection().getItem(t);if(!r)continue;"item"===r.type&&e.push(t)}t=this.collection().getKeyAfter(t)}})(this.collection().getFirstKey()),e}},tt=class{keyMap=new Map;iterable;firstKey;lastKey;constructor(e){let t;for(let t of(this.iterable=e,e))this.keyMap.set(t.key,t);if(0===this.keyMap.size)return;let r=0;for(let[e,n]of this.keyMap)t?(t.nextKey=e,n.prevKey=t.key):(this.firstKey=e,n.prevKey=void 0),"item"===n.type&&(n.index=r++),(t=n).nextKey=void 0;this.lastKey=t.key}*[Symbol.iterator](){yield*this.iterable}getSize(){return this.keyMap.size}getKeys(){return this.keyMap.keys()}getKeyBefore(e){return this.keyMap.get(e)?.prevKey}getKeyAfter(e){return this.keyMap.get(e)?.nextKey}getFirstKey(){return this.firstKey}getLastKey(){return this.lastKey}getItem(e){return this.keyMap.get(e)}at(e){let t=[...this.getKeys()];return this.getItem(t[e])}},tr=e=>"function"==typeof e?e():e,tn=e=>{let t=(0,l.dD)(()=>{let t=tr(e.element);if(t)return getComputedStyle(t)}),r=()=>t()?.animationName??"none",[n,i]=(0,l.gQ)(tr(e.show)?"present":"hidden"),o="none";return(0,l.GW)(n=>{let a=tr(e.show);return(0,l.Zw)(()=>{if(n===a)return a;let e=o,l=r();a?i("present"):"none"===l||t()?.display==="none"?i("hidden"):!0===n&&e!==l?i("hiding"):i("hidden")}),a}),(0,l.GW)(()=>{let t=tr(e.element);if(!t)return;let a=e=>{e.target===t&&(o=r())},s=e=>{let o=r().includes(e.animationName);e.target===t&&o&&"hiding"===n()&&i("hidden")};t.addEventListener("animationstart",a),t.addEventListener("animationcancel",s),t.addEventListener("animationend",s),(0,l.$W)(()=>{t.removeEventListener("animationstart",a),t.removeEventListener("animationcancel",s),t.removeEventListener("animationend",s)})}),{present:()=>"present"===n()||"hiding"===n(),state:n}},ti="data-kb-top-layer",to=!1,tl=[];function ta(e){return tl.findIndex(t=>t.node===e)}function ts(){return tl.filter(e=>e.isPointerBlocking)}function td(){return ts().length>0}function tu(e){let t=ta([...ts()].slice(-1)[0]?.node);return ta(e)<t}var tc={isTopMostLayer:function(e){return tl[tl.length-1].node===e},isBelowPointerBlockingLayer:tu,addLayer:function(e){tl.push(e)},removeLayer:function(e){let t=ta(e);t<0||tl.splice(t,1)},find:function(e){return tl[ta(e)]},assignPointerEventToLayers:function(){for(let{node:e}of tl)e.style.pointerEvents=tu(e)?"none":"auto"},disableBodyPointerEvents:function(e){if(td()&&!to){let t=ed(e);o=document.body.style.pointerEvents,t.body.style.pointerEvents="none",to=!0}},restoreBodyPointerEvents:function(e){if(td())return;let t=ed(e);t.body.style.pointerEvents=o,0===t.body.style.length&&t.body.removeAttribute("style"),to=!1}};eN({},{Button:()=>tp,Root:()=>tf});var tg=["button","color","file","image","reset","submit"];function tf(e){let t;let r=eL({type:"button"},e),[n,i]=(0,l.eY)(r,["ref","type","disabled"]),o=ez(()=>t,()=>"button"),a=(0,l.dD)(()=>{let e=o();return null!=e&&function(e){let t=e.tagName.toLowerCase();return"button"===t||"input"===t&&!!e.type&&-1!==tg.indexOf(e.type)}({tagName:e,type:n.type})}),s=(0,l.dD)(()=>"input"===o()),d=(0,l.dD)(()=>"a"===o()&&t?.getAttribute("href")!=null);return(0,l.LM)(eI,(0,l.dG)({as:"button",ref(e){let r=N(e=>t=e,n.ref);"function"==typeof r&&r(e)},get type(){return a()||s()?n.type:void 0},get role(){return a()||d()?void 0:"button"},get tabIndex(){return a()||d()||n.disabled?void 0:0},get disabled(){return a()||s()?n.disabled:void 0},get"aria-disabled"(){return!(a()||s())&&!!n.disabled||void 0},get"data-disabled"(){return n.disabled?"":void 0}},i))}var tp=tf,th=["top","right","bottom","left"],ty=Math.min,tv=Math.max,tb=Math.round,tm=Math.floor,tx=e=>({x:e,y:e}),tw={left:"right",right:"left",bottom:"top",top:"bottom"},t$={start:"end",end:"start"};function tk(e,t){return"function"==typeof e?e(t):e}function tM(e){return e.split("-")[0]}function tS(e){return e.split("-")[1]}function tC(e){return"x"===e?"y":"x"}function tL(e){return"y"===e?"height":"width"}function tq(e){return["top","bottom"].includes(tM(e))?"y":"x"}function tT(e){return e.replace(/start|end/g,e=>t$[e])}function tE(e){return e.replace(/left|right|bottom|top/g,e=>tw[e])}function tD(e){return"number"!=typeof e?{top:0,right:0,bottom:0,left:0,...e}:{top:e,right:e,bottom:e,left:e}}function tF(e){let{x:t,y:r,width:n,height:i}=e;return{width:n,height:i,top:r,left:t,right:t+n,bottom:r+i,x:t,y:r}}function tP(e,t,r){let n,{reference:i,floating:o}=e,l=tq(t),a=tC(tq(t)),s=tL(a),d=tM(t),u="y"===l,c=i.x+i.width/2-o.width/2,g=i.y+i.height/2-o.height/2,f=i[s]/2-o[s]/2;switch(d){case"top":n={x:c,y:i.y-o.height};break;case"bottom":n={x:c,y:i.y+i.height};break;case"right":n={x:i.x+i.width,y:g};break;case"left":n={x:i.x-o.width,y:g};break;default:n={x:i.x,y:i.y}}switch(tS(t)){case"start":n[a]-=f*(r&&u?-1:1);break;case"end":n[a]+=f*(r&&u?-1:1)}return n}var tA=async(e,t,r)=>{let{placement:n="bottom",strategy:i="absolute",middleware:o=[],platform:l}=r,a=o.filter(Boolean),s=await (null==l.isRTL?void 0:l.isRTL(t)),d=await l.getElementRects({reference:e,floating:t,strategy:i}),{x:u,y:c}=tP(d,n,s),g=n,f={},p=0;for(let r=0;r<a.length;r++){let{name:o,fn:h}=a[r],{x:y,y:v,data:b,reset:m}=await h({x:u,y:c,initialPlacement:n,placement:g,strategy:i,middlewareData:f,rects:d,platform:l,elements:{reference:e,floating:t}});u=null!=y?y:u,c=null!=v?v:c,f={...f,[o]:{...f[o],...b}},m&&p<=50&&(p++,"object"==typeof m&&(m.placement&&(g=m.placement),m.rects&&(d=!0===m.rects?await l.getElementRects({reference:e,floating:t,strategy:i}):m.rects),{x:u,y:c}=tP(d,g,s)),r=-1)}return{x:u,y:c,placement:g,strategy:i,middlewareData:f}};async function tz(e,t){var r;void 0===t&&(t={});let{x:n,y:i,platform:o,rects:l,elements:a,strategy:s}=e,{boundary:d="clippingAncestors",rootBoundary:u="viewport",elementContext:c="floating",altBoundary:g=!1,padding:f=0}=tk(t,e),p=tD(f),h=a[g?"floating"===c?"reference":"floating":c],y=tF(await o.getClippingRect({element:null==(r=await (null==o.isElement?void 0:o.isElement(h)))||r?h:h.contextElement||await (null==o.getDocumentElement?void 0:o.getDocumentElement(a.floating)),boundary:d,rootBoundary:u,strategy:s})),v="floating"===c?{x:n,y:i,width:l.floating.width,height:l.floating.height}:l.reference,b=await (null==o.getOffsetParent?void 0:o.getOffsetParent(a.floating)),m=await (null==o.isElement?void 0:o.isElement(b))&&await (null==o.getScale?void 0:o.getScale(b))||{x:1,y:1},x=tF(o.convertOffsetParentRelativeRectToViewportRelativeRect?await o.convertOffsetParentRelativeRectToViewportRelativeRect({elements:a,rect:v,offsetParent:b,strategy:s}):v);return{top:(y.top-x.top+p.top)/m.y,bottom:(x.bottom-y.bottom+p.bottom)/m.y,left:(y.left-x.left+p.left)/m.x,right:(x.right-y.right+p.right)/m.x}}function tO(e,t){return{top:e.top-t.height,right:e.right-t.width,bottom:e.bottom-t.height,left:e.left-t.width}}function tI(e){return th.some(t=>e[t]>=0)}async function tK(e,t){let{placement:r,platform:n,elements:i}=e,o=await (null==n.isRTL?void 0:n.isRTL(i.floating)),l=tM(r),a=tS(r),s="y"===tq(r),d=["left","top"].includes(l)?-1:1,u=o&&s?-1:1,c=tk(t,e),{mainAxis:g,crossAxis:f,alignmentAxis:p}="number"==typeof c?{mainAxis:c,crossAxis:0,alignmentAxis:null}:{mainAxis:0,crossAxis:0,alignmentAxis:null,...c};return a&&"number"==typeof p&&(f="end"===a?-1*p:p),s?{x:f*u,y:g*d}:{x:g*d,y:f*u}}function tG(e){return tH(e)?(e.nodeName||"").toLowerCase():"#document"}function tR(e){var t;return(null==e||null==(t=e.ownerDocument)?void 0:t.defaultView)||window}function tB(e){var t;return null==(t=(tH(e)?e.ownerDocument:e.document)||window.document)?void 0:t.documentElement}function tH(e){return e instanceof Node||e instanceof tR(e).Node}function tW(e){return e instanceof Element||e instanceof tR(e).Element}function tU(e){return e instanceof HTMLElement||e instanceof tR(e).HTMLElement}function tV(e){return"undefined"!=typeof ShadowRoot&&(e instanceof ShadowRoot||e instanceof tR(e).ShadowRoot)}function tQ(e){let{overflow:t,overflowX:r,overflowY:n,display:i}=tY(e);return/auto|scroll|overlay|hidden|clip/.test(t+n+r)&&!["inline","contents"].includes(i)}function tN(e){return[":popover-open",":modal"].some(t=>{try{return e.matches(t)}catch(e){return!1}})}function tj(e){let t=tX(),r=tW(e)?tY(e):e;return"none"!==r.transform||"none"!==r.perspective||!!r.containerType&&"normal"!==r.containerType||!t&&!!r.backdropFilter&&"none"!==r.backdropFilter||!t&&!!r.filter&&"none"!==r.filter||["transform","perspective","filter"].some(e=>(r.willChange||"").includes(e))||["paint","layout","strict","content"].some(e=>(r.contain||"").includes(e))}function tX(){return"undefined"!=typeof CSS&&!!CSS.supports&&CSS.supports("-webkit-backdrop-filter","none")}function t_(e){return["html","body","#document"].includes(tG(e))}function tY(e){return tR(e).getComputedStyle(e)}function tZ(e){return tW(e)?{scrollLeft:e.scrollLeft,scrollTop:e.scrollTop}:{scrollLeft:e.scrollX,scrollTop:e.scrollY}}function tJ(e){if("html"===tG(e))return e;let t=e.assignedSlot||e.parentNode||tV(e)&&e.host||tB(e);return tV(t)?t.host:t}function t0(e,t,r){var n;void 0===t&&(t=[]),void 0===r&&(r=!0);let i=function e(t){let r=tJ(t);return t_(r)?t.ownerDocument?t.ownerDocument.body:t.body:tU(r)&&tQ(r)?r:e(r)}(e),o=i===(null==(n=e.ownerDocument)?void 0:n.body),l=tR(i);return o?t.concat(l,l.visualViewport||[],tQ(i)?i:[],l.frameElement&&r?t0(l.frameElement):[]):t.concat(i,t0(i,[],r))}function t1(e){let t=tY(e),r=parseFloat(t.width)||0,n=parseFloat(t.height)||0,i=tU(e),o=i?e.offsetWidth:r,l=i?e.offsetHeight:n,a=tb(r)!==o||tb(n)!==l;return a&&(r=o,n=l),{width:r,height:n,$:a}}function t2(e){return tW(e)?e:e.contextElement}function t3(e){let t=t2(e);if(!tU(t))return tx(1);let r=t.getBoundingClientRect(),{width:n,height:i,$:o}=t1(t),l=(o?tb(r.width):r.width)/n,a=(o?tb(r.height):r.height)/i;return l&&Number.isFinite(l)||(l=1),a&&Number.isFinite(a)||(a=1),{x:l,y:a}}var t5=tx(0);function t4(e){let t=tR(e);return tX()&&t.visualViewport?{x:t.visualViewport.offsetLeft,y:t.visualViewport.offsetTop}:t5}function t6(e,t,r,n){var i;void 0===t&&(t=!1),void 0===r&&(r=!1);let o=e.getBoundingClientRect(),l=t2(e),a=tx(1);t&&(n?tW(n)&&(a=t3(n)):a=t3(e));let s=(void 0===(i=r)&&(i=!1),n&&(!i||n===tR(l))&&i)?t4(l):tx(0),d=(o.left+s.x)/a.x,u=(o.top+s.y)/a.y,c=o.width/a.x,g=o.height/a.y;if(l){let e=tR(l),t=n&&tW(n)?tR(n):n,r=e,i=r.frameElement;for(;i&&n&&t!==r;){let e=t3(i),t=i.getBoundingClientRect(),n=tY(i),o=t.left+(i.clientLeft+parseFloat(n.paddingLeft))*e.x,l=t.top+(i.clientTop+parseFloat(n.paddingTop))*e.y;d*=e.x,u*=e.y,c*=e.x,g*=e.y,d+=o,u+=l,i=(r=tR(i)).frameElement}}return tF({width:c,height:g,x:d,y:u})}function t9(e){return t6(tB(e)).left+tZ(e).scrollLeft}function t8(e,t,r){let n;if("viewport"===t)n=function(e,t){let r=tR(e),n=tB(e),i=r.visualViewport,o=n.clientWidth,l=n.clientHeight,a=0,s=0;if(i){o=i.width,l=i.height;let e=tX();(!e||e&&"fixed"===t)&&(a=i.offsetLeft,s=i.offsetTop)}return{width:o,height:l,x:a,y:s}}(e,r);else if("document"===t)n=function(e){let t=tB(e),r=tZ(e),n=e.ownerDocument.body,i=tv(t.scrollWidth,t.clientWidth,n.scrollWidth,n.clientWidth),o=tv(t.scrollHeight,t.clientHeight,n.scrollHeight,n.clientHeight),l=-r.scrollLeft+t9(e),a=-r.scrollTop;return"rtl"===tY(n).direction&&(l+=tv(t.clientWidth,n.clientWidth)-i),{width:i,height:o,x:l,y:a}}(tB(e));else if(tW(t))n=function(e,t){let r=t6(e,!0,"fixed"===t),n=r.top+e.clientTop,i=r.left+e.clientLeft,o=tU(e)?t3(e):tx(1),l=e.clientWidth*o.x;return{width:l,height:e.clientHeight*o.y,x:i*o.x,y:n*o.y}}(t,r);else{let r=t4(e);n={...t,x:t.x-r.x,y:t.y-r.y}}return tF(n)}function t7(e){return"static"===tY(e).position}function re(e,t){return tU(e)&&"fixed"!==tY(e).position?t?t(e):e.offsetParent:null}function rt(e,t){let r=tR(e);if(tN(e))return r;if(!tU(e)){let t=tJ(e);for(;t&&!t_(t);){if(tW(t)&&!t7(t))return t;t=tJ(t)}return r}let n=re(e,t);for(;n&&["table","td","th"].includes(tG(n))&&t7(n);)n=re(n,t);return n&&t_(n)&&t7(n)&&!tj(n)?r:n||function(e){let t=tJ(e);for(;tU(t)&&!t_(t);){if(tj(t))return t;if(tN(t))break;t=tJ(t)}return null}(e)||r}var rr=async function(e){let t=this.getOffsetParent||rt,r=this.getDimensions,n=await r(e.floating);return{reference:function(e,t,r){let n=tU(t),i=tB(t),o="fixed"===r,l=t6(e,!0,o,t),a={scrollLeft:0,scrollTop:0},s=tx(0);if(n||!n&&!o){if(("body"!==tG(t)||tQ(i))&&(a=tZ(t)),n){let e=t6(t,!0,o,t);s.x=e.x+t.clientLeft,s.y=e.y+t.clientTop}else i&&(s.x=t9(i))}return{x:l.left+a.scrollLeft-s.x,y:l.top+a.scrollTop-s.y,width:l.width,height:l.height}}(e.reference,await t(e.floating),e.strategy),floating:{x:0,y:0,width:n.width,height:n.height}}},rn={convertOffsetParentRelativeRectToViewportRelativeRect:function(e){let{elements:t,rect:r,offsetParent:n,strategy:i}=e,o="fixed"===i,l=tB(n),a=!!t&&tN(t.floating);if(n===l||a&&o)return r;let s={scrollLeft:0,scrollTop:0},d=tx(1),u=tx(0),c=tU(n);if((c||!c&&!o)&&(("body"!==tG(n)||tQ(l))&&(s=tZ(n)),tU(n))){let e=t6(n);d=t3(n),u.x=e.x+n.clientLeft,u.y=e.y+n.clientTop}return{width:r.width*d.x,height:r.height*d.y,x:r.x*d.x-s.scrollLeft*d.x+u.x,y:r.y*d.y-s.scrollTop*d.y+u.y}},getDocumentElement:tB,getClippingRect:function(e){let{element:t,boundary:r,rootBoundary:n,strategy:i}=e,o=[..."clippingAncestors"===r?tN(t)?[]:function(e,t){let r=t.get(e);if(r)return r;let n=t0(e,[],!1).filter(e=>tW(e)&&"body"!==tG(e)),i=null,o="fixed"===tY(e).position,l=o?tJ(e):e;for(;tW(l)&&!t_(l);){let t=tY(l),r=tj(l);r||"fixed"!==t.position||(i=null),(o?!r&&!i:!r&&"static"===t.position&&!!i&&["absolute","fixed"].includes(i.position)||tQ(l)&&!r&&function e(t,r){let n=tJ(t);return!(n===r||!tW(n)||t_(n))&&("fixed"===tY(n).position||e(n,r))}(e,l))?n=n.filter(e=>e!==l):i=t,l=tJ(l)}return t.set(e,n),n}(t,this._c):[].concat(r),n],l=o[0],a=o.reduce((e,r)=>{let n=t8(t,r,i);return e.top=tv(n.top,e.top),e.right=ty(n.right,e.right),e.bottom=ty(n.bottom,e.bottom),e.left=tv(n.left,e.left),e},t8(t,l,i));return{width:a.right-a.left,height:a.bottom-a.top,x:a.left,y:a.top}},getOffsetParent:rt,getElementRects:rr,getClientRects:function(e){return Array.from(e.getClientRects())},getDimensions:function(e){let{width:t,height:r}=t1(e);return{width:t,height:r}},getScale:t3,isElement:tW,isRTL:function(e){return"rtl"===tY(e).direction}},ri=e=>({name:"arrow",options:e,async fn(t){let{x:r,y:n,placement:i,rects:o,platform:l,elements:a,middlewareData:s}=t,{element:d,padding:u=0}=tk(e,t)||{};if(null==d)return{};let c=tD(u),g={x:r,y:n},f=tC(tq(i)),p=tL(f),h=await l.getDimensions(d),y="y"===f,v=y?"clientHeight":"clientWidth",b=o.reference[p]+o.reference[f]-g[f]-o.floating[p],m=g[f]-o.reference[f],x=await (null==l.getOffsetParent?void 0:l.getOffsetParent(d)),w=x?x[v]:0;w&&await (null==l.isElement?void 0:l.isElement(x))||(w=a.floating[v]||o.floating[p]);let $=w/2-h[p]/2-1,k=ty(c[y?"top":"left"],$),M=ty(c[y?"bottom":"right"],$),S=w-h[p]-M,C=w/2-h[p]/2+(b/2-m/2),L=tv(k,ty(C,S)),q=!s.arrow&&null!=tS(i)&&C!==L&&o.reference[p]/2-(C<k?k:M)-h[p]/2<0,T=q?C<k?C-k:C-S:0;return{[f]:g[f]+T,data:{[f]:L,centerOffset:C-L-T,...q&&{alignmentOffset:T}},reset:q}}}),ro=(e,t,r)=>{let n=new Map,i={platform:rn,...r},o={...i.platform,_c:n};return tA(e,t,{...i,platform:o})},rl=(0,l.kr)();function ra(){let e=(0,l.qp)(rl);if(void 0===e)throw Error("[kobalte]: `usePopperContext` must be used within a `Popper` component");return e}var rs=(0,l.XK)('<svg display="block" viewBox="0 0 30 30" style="transform:scale(1.02)"><g><path fill="none" d="M23,27.8c1.1,1.2,3.4,2.2,5,2.2h2H0h2c1.7,0,3.9-1,5-2.2l6.6-7.2c0.7-0.8,2-0.8,2.7,0L23,27.8L23,27.8z"></path><path stroke="none" d="M23,27.8c1.1,1.2,3.4,2.2,5,2.2h2H0h2c1.7,0,3.9-1,5-2.2l6.6-7.2c0.7-0.8,2-0.8,2.7,0L23,27.8L23,27.8z">'),rd={top:180,right:-90,bottom:0,left:90};function ru(e){let t=ra(),r=eL({size:30},e),[n,i]=(0,l.eY)(r,["ref","style","size"]),o=()=>t.currentPlacement().split("-")[0],a=function(e){let[t,r]=(0,l.gQ)();return(0,l.GW)(()=>{let t=e();t&&r((ed(t).defaultView||window).getComputedStyle(t))}),t}(t.contentRef),s=()=>a()?.getPropertyValue("background-color")||"none",d=()=>a()?.getPropertyValue(`border-${o()}-color`)||"none",u=()=>a()?.getPropertyValue(`border-${o()}-width`)||"0px",c=()=>2*Number.parseInt(u())*(30/n.size),g=()=>`rotate(${rd[o()]} 15 15) translate(0 2)`;return(0,l.LM)(eI,(0,l.dG)({as:"div",ref(e){let r=N(t.setArrowRef,n.ref);"function"==typeof r&&r(e)},"aria-hidden":"true",get style(){return en({position:"absolute","font-size":`${n.size}px`,width:"1em",height:"1em","pointer-events":"none",fill:s(),stroke:d(),"stroke-width":c()},n.style)}},i,{get children(){let e=rs(),t=e.firstChild;return(0,l.F3)(()=>(0,l.P$)(t,"transform",g())),e}}))}function rc(e){let{x:t=0,y:r=0,width:n=0,height:i=0}=e??{};if("function"==typeof DOMRect)return new DOMRect(t,r,n,i);let o={x:t,y:r,width:n,height:i,top:r,right:t+n,bottom:r+i,left:t};return{...o,toJSON:()=>o}}function rg(e){return/^(?:top|bottom|left|right)(?:-(?:start|end))?$/.test(e)}var rf={top:"bottom",right:"left",bottom:"top",left:"right"},rp=Object.assign(function(e){let t=eL({getAnchorRect:e=>e?.getBoundingClientRect(),placement:"bottom",gutter:0,shift:0,flip:!0,slide:!0,overlap:!1,sameWidth:!1,fitViewport:!1,hideWhenDetached:!1,detachedPadding:0,arrowPadding:4,overflowPadding:8},e),[r,n]=(0,l.gQ)(),[i,o]=(0,l.gQ)(),[a,s]=(0,l.gQ)(t.placement),d=()=>{var e,r;return e=t.anchorRef?.(),r=t.getAnchorRect,{contextElement:e,getBoundingClientRect:()=>{let t=r(e);return t?rc(t):e?e.getBoundingClientRect():rc()}}},{direction:u}=e5();async function c(){var e,n,o,l,a;let c;let g=d(),f=r(),p=i();if(!g||!f)return;let h=(p?.clientHeight||0)/2,y="number"==typeof t.gutter?t.gutter+h:t.gutter??h;f.style.setProperty("--kb-popper-content-overflow-padding",`${t.overflowPadding}px`),g.getBoundingClientRect();let v=[(void 0===(e=({placement:e})=>({mainAxis:y,crossAxis:e.split("-")[1]?void 0:t.shift,alignmentAxis:t.shift}))&&(e=0),{name:"offset",options:e,async fn(t){var r,n;let{x:i,y:o,placement:l,middlewareData:a}=t,s=await tK(t,e);return l===(null==(r=a.offset)?void 0:r.placement)&&null!=(n=a.arrow)&&n.alignmentOffset?{}:{x:i+s.x,y:o+s.y,data:{...s,placement:l}}}})];if(!1!==t.flip){let e="string"==typeof t.flip?t.flip.split(" "):void 0;if(void 0!==e&&!e.every(rg))throw Error("`flip` expects a spaced-delimited list of placements");v.push({name:"flip",options:n={padding:t.overflowPadding,fallbackPlacements:e},async fn(e){var t,r,i,o,l;let{placement:a,middlewareData:s,rects:d,initialPlacement:u,platform:c,elements:g}=e,{mainAxis:f=!0,crossAxis:p=!0,fallbackPlacements:h,fallbackStrategy:y="bestFit",fallbackAxisSideDirection:v="none",flipAlignment:b=!0,...m}=tk(n,e);if(null!=(t=s.arrow)&&t.alignmentOffset)return{};let x=tM(a),w=tq(u),$=tM(u)===u,k=await (null==c.isRTL?void 0:c.isRTL(g.floating)),M=h||($||!b?[tE(u)]:function(e){let t=tE(e);return[tT(e),t,tT(t)]}(u)),S="none"!==v;!h&&S&&M.push(...function(e,t,r,n){let i=tS(e),o=function(e,t,r){let n=["left","right"],i=["right","left"];switch(e){case"top":case"bottom":if(r)return t?i:n;return t?n:i;case"left":case"right":return t?["top","bottom"]:["bottom","top"];default:return[]}}(tM(e),"start"===r,n);return i&&(o=o.map(e=>e+"-"+i),t&&(o=o.concat(o.map(tT)))),o}(u,b,v,k));let C=[u,...M],L=await tz(e,m),q=[],T=(null==(r=s.flip)?void 0:r.overflows)||[];if(f&&q.push(L[x]),p){let e=function(e,t,r){void 0===r&&(r=!1);let n=tS(e),i=tC(tq(e)),o=tL(i),l="x"===i?n===(r?"end":"start")?"right":"left":"start"===n?"bottom":"top";return t.reference[o]>t.floating[o]&&(l=tE(l)),[l,tE(l)]}(a,d,k);q.push(L[e[0]],L[e[1]])}if(T=[...T,{placement:a,overflows:q}],!q.every(e=>e<=0)){let e=((null==(i=s.flip)?void 0:i.index)||0)+1,t=C[e];if(t)return{data:{index:e,overflows:T},reset:{placement:t}};let r=null==(o=T.filter(e=>e.overflows[0]<=0).sort((e,t)=>e.overflows[1]-t.overflows[1])[0])?void 0:o.placement;if(!r)switch(y){case"bestFit":{let e=null==(l=T.filter(e=>{if(S){let t=tq(e.placement);return t===w||"y"===t}return!0}).map(e=>[e.placement,e.overflows.filter(e=>e>0).reduce((e,t)=>e+t,0)]).sort((e,t)=>e[1]-t[1])[0])?void 0:l[0];e&&(r=e);break}case"initialPlacement":r=u}if(a!==r)return{reset:{placement:r}}}return{}}})}(t.slide||t.overlap)&&v.push({name:"shift",options:o={mainAxis:t.slide,crossAxis:t.overlap,padding:t.overflowPadding},async fn(e){let{x:t,y:r,placement:n}=e,{mainAxis:i=!0,crossAxis:l=!1,limiter:a={fn:e=>{let{x:t,y:r}=e;return{x:t,y:r}}},...s}=tk(o,e),d={x:t,y:r},u=await tz(e,s),c=tq(tM(n)),g=tC(c),f=d[g],p=d[c];if(i){let e="y"===g?"top":"left",t="y"===g?"bottom":"right",r=f+u[e],n=f-u[t];f=tv(r,ty(f,n))}if(l){let e="y"===c?"top":"left",t="y"===c?"bottom":"right",r=p+u[e],n=p-u[t];p=tv(r,ty(p,n))}let h=a.fn({...e,[g]:f,[c]:p});return{...h,data:{x:h.x-t,y:h.y-r}}}}),v.push({name:"size",options:l={padding:t.overflowPadding,apply({availableWidth:e,availableHeight:r,rects:n}){let i=Math.round(n.reference.width);e=Math.floor(e),r=Math.floor(r),f.style.setProperty("--kb-popper-anchor-width",`${i}px`),f.style.setProperty("--kb-popper-content-available-width",`${e}px`),f.style.setProperty("--kb-popper-content-available-height",`${r}px`),t.sameWidth&&(f.style.width=`${i}px`),t.fitViewport&&(f.style.maxWidth=`${e}px`,f.style.maxHeight=`${r}px`)}},async fn(e){let t,r;let{placement:n,rects:i,platform:o,elements:a}=e,{apply:s=()=>{},...d}=tk(l,e),u=await tz(e,d),c=tM(n),g=tS(n),f="y"===tq(n),{width:p,height:h}=i.floating;"top"===c||"bottom"===c?(t=c,r=g===(await (null==o.isRTL?void 0:o.isRTL(a.floating))?"start":"end")?"left":"right"):(r=c,t="end"===g?"top":"bottom");let y=h-u.top-u.bottom,v=p-u.left-u.right,b=ty(h-u[t],y),m=ty(p-u[r],v),x=!e.middlewareData.shift,w=b,$=m;if(f?$=g||x?ty(m,v):v:w=g||x?ty(b,y):y,x&&!g){let e=tv(u.left,0),t=tv(u.right,0),r=tv(u.top,0),n=tv(u.bottom,0);f?$=p-2*(0!==e||0!==t?e+t:tv(u.left,u.right)):w=h-2*(0!==r||0!==n?r+n:tv(u.top,u.bottom))}await s({...e,availableWidth:$,availableHeight:w});let k=await o.getDimensions(a.floating);return p!==k.width||h!==k.height?{reset:{rects:!0}}:{}}}),t.hideWhenDetached&&v.push({name:"hide",options:a={padding:t.detachedPadding},async fn(e){let{rects:t}=e,{strategy:r="referenceHidden",...n}=tk(a,e);switch(r){case"referenceHidden":{let r=tO(await tz(e,{...n,elementContext:"reference"}),t.reference);return{data:{referenceHiddenOffsets:r,referenceHidden:tI(r)}}}case"escaped":{let r=tO(await tz(e,{...n,altBoundary:!0}),t.floating);return{data:{escapedOffsets:r,escaped:tI(r)}}}default:return{}}}}),p&&v.push(ri({element:p,padding:t.arrowPadding}));let b=await ro(g,f,{placement:t.placement,strategy:"absolute",middleware:v,platform:{...rn,isRTL:()=>"rtl"===u()}});if(s(b.placement),t.onCurrentPlacementChange?.(b.placement),!f)return;f.style.setProperty("--kb-popper-content-transform-origin",function(e,t){let[r,n]=e.split("-"),i=rf[r];return n?"left"===r||"right"===r?`${i} ${"start"===n?"top":"bottom"}`:"start"===n?`${i} ${"rtl"===t?"right":"left"}`:`${i} ${"rtl"===t?"left":"right"}`:`${i} center`}(b.placement,u()));let m=Math.round(b.x),x=Math.round(b.y);if(t.hideWhenDetached&&(c=b.middlewareData.hide?.referenceHidden?"hidden":"visible"),Object.assign(f.style,{top:"0",left:"0",transform:`translate3d(${m}px, ${x}px, 0)`,visibility:c}),p&&b.middlewareData.arrow){let{x:e,y:t}=b.middlewareData.arrow,r=b.placement.split("-")[0];Object.assign(p.style,{left:null!=e?`${e}px`:"",top:null!=t?`${t}px`:"",[r]:"100%"})}}return(0,l.GW)(()=>{let e=d(),t=r();if(!e||!t)return;let n=function(e,t,r,n){let i;void 0===n&&(n={});let{ancestorScroll:o=!0,ancestorResize:l=!0,elementResize:a="function"==typeof ResizeObserver,layoutShift:s="function"==typeof IntersectionObserver,animationFrame:d=!1}=n,u=t2(e),c=o||l?[...u?t0(u):[],...t0(t)]:[];c.forEach(e=>{o&&e.addEventListener("scroll",r,{passive:!0}),l&&e.addEventListener("resize",r)});let g=u&&s?function(e,t){let r,n=null,i=tB(e);function o(){var e;clearTimeout(r),null==(e=n)||e.disconnect(),n=null}return function l(a,s){void 0===a&&(a=!1),void 0===s&&(s=1),o();let{left:d,top:u,width:c,height:g}=e.getBoundingClientRect();if(a||t(),!c||!g)return;let f=tm(u),p=tm(i.clientWidth-(d+c)),h={rootMargin:-f+"px "+-p+"px "+-tm(i.clientHeight-(u+g))+"px "+-tm(d)+"px",threshold:tv(0,ty(1,s))||1},y=!0;function v(e){let t=e[0].intersectionRatio;if(t!==s){if(!y)return l();t?l(!1,t):r=setTimeout(()=>{l(!1,1e-7)},1e3)}y=!1}try{n=new IntersectionObserver(v,{...h,root:i.ownerDocument})}catch(e){n=new IntersectionObserver(v,h)}n.observe(e)}(!0),o}(u,r):null,f=-1,p=null;a&&(p=new ResizeObserver(e=>{let[n]=e;n&&n.target===u&&p&&(p.unobserve(t),cancelAnimationFrame(f),f=requestAnimationFrame(()=>{var e;null==(e=p)||e.observe(t)})),r()}),u&&!d&&p.observe(u),p.observe(t));let h=d?t6(e):null;return d&&function t(){let n=t6(e);h&&(n.x!==h.x||n.y!==h.y||n.width!==h.width||n.height!==h.height)&&r(),h=n,i=requestAnimationFrame(t)}(),r(),()=>{var e;c.forEach(e=>{o&&e.removeEventListener("scroll",r),l&&e.removeEventListener("resize",r)}),null==g||g(),null==(e=p)||e.disconnect(),p=null,d&&cancelAnimationFrame(i)}}(e,t,c,{elementResize:"function"==typeof ResizeObserver});(0,l.$W)(n)}),(0,l.GW)(()=>{let e=r(),n=t.contentRef?.();e&&n&&queueMicrotask(()=>{e.style.zIndex=getComputedStyle(n).zIndex})}),(0,l.LM)(rl.Provider,{value:{currentPlacement:a,contentRef:()=>t.contentRef?.(),setPositionerRef:n,setArrowRef:o},get children(){return t.children}})},{Arrow:ru,Context:rl,usePopperContext:ra,Positioner:function(e){let t=ra(),[r,n]=(0,l.eY)(e,["ref","style"]);return(0,l.LM)(eI,(0,l.dG)({as:"div",ref(e){let n=N(t.setPositionerRef,r.ref);"function"==typeof n&&n(e)},"data-popper-positioner":"",get style(){return en({position:"absolute",top:0,left:0,"min-width":"max-content"},r.style)}},n))}}),rh="interactOutside.pointerDownOutside",ry="interactOutside.focusOutside",rv=(0,l.kr)();function rb(e){let t;let r=(0,l.qp)(rv),[n,i]=(0,l.eY)(e,["ref","disableOutsidePointerEvents","excludedElements","onEscapeKeyDown","onPointerDownOutside","onFocusOutside","onInteractOutside","onDismiss","bypassTopMostLayerCheck"]),o=new Set([]);return!function(e,t){let r;let n=eC,i=()=>ed(t()),o=t=>e.onPointerDownOutside?.(t),a=t=>e.onFocusOutside?.(t),s=t=>e.onInteractOutside?.(t),d=r=>{let n=r.target;return!(!(n instanceof HTMLElement)||n.closest(`[${ti}]`)||!ea(i(),n)||ea(t(),n))&&!e.shouldExcludeElement?.(n)},u=e=>{function r(){let r=t(),n=e.target;if(!r||!n||!d(e))return;let i=eh([o,s]);n.addEventListener(rh,i,{once:!0});let l=new CustomEvent(rh,{bubbles:!1,cancelable:!0,detail:{originalEvent:e,isContextMenu:2===e.button||(ef()?e.metaKey&&!e.ctrlKey:e.ctrlKey&&!e.metaKey)&&0===e.button}});n.dispatchEvent(l)}"touch"===e.pointerType?(i().removeEventListener("click",r),n=r,i().addEventListener("click",r,{once:!0})):r()},g=e=>{let r=t(),n=e.target;if(!r||!n||!d(e))return;let i=eh([a,s]);n.addEventListener(ry,i,{once:!0});let o=new CustomEvent(ry,{bubbles:!1,cancelable:!0,detail:{originalEvent:e,isContextMenu:!1}});n.dispatchEvent(o)};(0,l.GW)(()=>{l.sk||c(e.isDisabled)||(r=window.setTimeout(()=>{i().addEventListener("pointerdown",u,!0)},0),i().addEventListener("focusin",g,!0),(0,l.$W)(()=>{window.clearTimeout(r),i().removeEventListener("click",n),i().removeEventListener("pointerdown",u,!0),i().removeEventListener("focusin",g,!0)}))})}({shouldExcludeElement:e=>!!t&&(n.excludedElements?.some(t=>ea(t(),e))||[...o].some(t=>ea(t,e))),onPointerDownOutside:e=>{!(!t||tc.isBelowPointerBlockingLayer(t))&&(n.bypassTopMostLayerCheck||tc.isTopMostLayer(t))&&(n.onPointerDownOutside?.(e),n.onInteractOutside?.(e),e.defaultPrevented||n.onDismiss?.())},onFocusOutside:e=>{n.onFocusOutside?.(e),n.onInteractOutside?.(e),e.defaultPrevented||n.onDismiss?.()}},()=>t),!function(e){let t=t=>{t.key===ec.Escape&&e.onEscapeKeyDown?.(t)};(0,l.GW)(()=>{if(l.sk||c(e.isDisabled))return;let r=e.ownerDocument?.()??ed();r.addEventListener("keydown",t),(0,l.$W)(()=>{r.removeEventListener("keydown",t)})})}({ownerDocument:()=>ed(t),onEscapeKeyDown:e=>{t&&tc.isTopMostLayer(t)&&(n.onEscapeKeyDown?.(e),!e.defaultPrevented&&n.onDismiss&&(e.preventDefault(),n.onDismiss()))}}),(0,l.H3)(()=>{if(!t)return;tc.addLayer({node:t,isPointerBlocking:n.disableOutsidePointerEvents,dismiss:n.onDismiss});let e=r?.registerNestedLayer(t);tc.assignPointerEventToLayers(),tc.disableBodyPointerEvents(t),(0,l.$W)(()=>{t&&(tc.removeLayer(t),e?.(),tc.assignPointerEventToLayers(),tc.restoreBodyPointerEvents(t))})}),(0,l.GW)((0,l.on)([()=>t,()=>n.disableOutsidePointerEvents],([e,t])=>{if(!e)return;let r=tc.find(e);r&&r.isPointerBlocking!==t&&(r.isPointerBlocking=t,tc.assignPointerEventToLayers()),t&&tc.disableBodyPointerEvents(e),(0,l.$W)(()=>{tc.restoreBodyPointerEvents(e)})},{defer:!0})),(0,l.LM)(rv.Provider,{value:{registerNestedLayer:e=>{o.add(e);let t=r?.registerNestedLayer(e);return()=>{o.delete(e),t?.()}}},get children(){return(0,l.LM)(eI,(0,l.dG)({as:"div",ref(e){let r=N(e=>t=e,n.ref);"function"==typeof r&&r(e)}},i))}})}function rm(e={}){let[t,r]=eV({value:()=>c(e.open),defaultValue:()=>!!c(e.defaultOpen),onChange:t=>e.onOpenChange?.(t)}),n=()=>{r(!0)},i=()=>{r(!1)};return{isOpen:t,setIsOpen:r,open:n,close:i,toggle:()=>{t()?i():n()}}}var rx={};eN(rx,{Description:()=>eB,ErrorMessage:()=>eH,Item:()=>rS,ItemControl:()=>rC,ItemDescription:()=>rL,ItemIndicator:()=>rq,ItemInput:()=>rT,ItemLabel:()=>rE,Label:()=>rD,RadioGroup:()=>rP,Root:()=>rF});var rw=(0,l.kr)();function r$(){let e=(0,l.qp)(rw);if(void 0===e)throw Error("[kobalte]: `useRadioGroupContext` must be used within a `RadioGroup` component");return e}var rk=(0,l.kr)();function rM(){let e=(0,l.qp)(rk);if(void 0===e)throw Error("[kobalte]: `useRadioGroupItemContext` must be used within a `RadioGroup.Item` component");return e}function rS(e){let t=eR(),r=r$(),n=eL({id:`${t.generateId("item")}-${(0,l.g4)()}`},e),[i,o]=(0,l.eY)(n,["value","disabled","onPointerDown"]),[a,s]=(0,l.gQ)(),[d,u]=(0,l.gQ)(),[c,g]=(0,l.gQ)(),[f,p]=(0,l.gQ)(),[h,y]=(0,l.gQ)(!1),v=(0,l.dD)(()=>r.isSelectedValue(i.value)),b=(0,l.dD)(()=>i.disabled||t.isDisabled()||!1),m=e=>{ep(e,i.onPointerDown),h()&&e.preventDefault()},x=(0,l.dD)(()=>({...t.dataset(),"data-disabled":b()?"":void 0,"data-checked":v()?"":void 0})),w={value:()=>i.value,dataset:x,isSelected:v,isDisabled:b,inputId:a,labelId:d,descriptionId:c,inputRef:f,select:()=>r.setSelectedValue(i.value),generateId:el(()=>o.id),registerInput:eA(s),registerLabel:eA(u),registerDescription:eA(g),setIsFocused:y,setInputRef:p};return(0,l.LM)(rk.Provider,{value:w,get children(){return(0,l.LM)(eI,(0,l.dG)({as:"div",role:"group",onPointerDown:m},x,o))}})}function rC(e){let t=rM(),r=eL({id:t.generateId("control")},e),[n,i]=(0,l.eY)(r,["onClick","onKeyDown"]);return(0,l.LM)(eI,(0,l.dG)({as:"div",onClick:e=>{ep(e,n.onClick),t.select(),t.inputRef()?.focus()},onKeyDown:e=>{ep(e,n.onKeyDown),e.key===ec.Space&&(t.select(),t.inputRef()?.focus())}},()=>t.dataset(),i))}function rL(e){let t=rM(),r=eL({id:t.generateId("description")},e);return(0,l.GW)(()=>(0,l.$W)(t.registerDescription(r.id))),(0,l.LM)(eI,(0,l.dG)({as:"div"},()=>t.dataset(),r))}function rq(e){let t=rM(),r=eL({id:t.generateId("indicator")},e),[n,i]=(0,l.eY)(r,["ref","forceMount"]),[o,a]=(0,l.gQ)(),{present:s}=tn({show:()=>n.forceMount||t.isSelected(),element:()=>o()??null});return(0,l.LM)(l.di,{get when(){return s()},get children(){return(0,l.LM)(eI,(0,l.dG)({as:"div",ref(e){let t=N(a,n.ref);"function"==typeof t&&t(e)}},()=>t.dataset(),i))}})}function rT(e){let t=eR(),r=r$(),n=rM(),i=eL({id:n.generateId("input")},e),[o,a]=(0,l.eY)(i,["ref","style","aria-labelledby","aria-describedby","onChange","onFocus","onBlur"]),s=()=>[o["aria-labelledby"],n.labelId(),null!=o["aria-labelledby"]&&null!=a["aria-label"]?a.id:void 0].filter(Boolean).join(" ")||void 0,d=()=>[o["aria-describedby"],n.descriptionId(),r.ariaDescribedBy()].filter(Boolean).join(" ")||void 0,[u,c]=(0,l.gQ)(!1);return(0,l.GW)((0,l.on)([()=>n.isSelected(),()=>n.value()],e=>{if(!e[0]&&e[1]===n.value())return;c(!0);let t=n.inputRef();t?.dispatchEvent(new Event("input",{bubbles:!0,cancelable:!0})),t?.dispatchEvent(new Event("change",{bubbles:!0,cancelable:!0}))},{defer:!0})),(0,l.GW)(()=>(0,l.$W)(n.registerInput(a.id))),(0,l.LM)(eI,(0,l.dG)({as:"input",ref(e){let t=N(n.setInputRef,o.ref);"function"==typeof t&&t(e)},type:"radio",get name(){return t.name()},get value(){return n.value()},get checked(){return n.isSelected()},get required(){return t.isRequired()},get disabled(){return n.isDisabled()},get readonly(){return t.isReadOnly()},get style(){return en({...eP},o.style)},get"aria-labelledby"(){return s()},get"aria-describedby"(){return d()},onChange:e=>{ep(e,o.onChange),e.stopPropagation(),u()||(r.setSelectedValue(n.value()),e.target.checked=n.isSelected()),c(!1)},onFocus:e=>{ep(e,o.onFocus),n.setIsFocused(!0)},onBlur:e=>{ep(e,o.onBlur),n.setIsFocused(!1)}},()=>n.dataset(),a))}function rE(e){let t=rM(),r=eL({id:t.generateId("label")},e);return(0,l.GW)(()=>(0,l.$W)(t.registerLabel(r.id))),(0,l.LM)(eI,(0,l.dG)({as:"label",get for(){return t.inputId()}},()=>t.dataset(),r))}function rD(e){return(0,l.LM)(eW,(0,l.dG)({as:"span"},e))}function rF(e){var t,r;let n;let i=eL({id:`radiogroup-${(0,l.g4)()}`,orientation:"vertical"},e),[o,a,s]=(0,l.eY)(i,["ref","value","defaultValue","onChange","orientation","aria-labelledby","aria-describedby"],eK),[d,u]=eU({value:()=>o.value,defaultValue:()=>o.defaultValue,onChange:e=>o.onChange?.(e)}),{formControlContext:g}=function(e){let t=eL({id:`form-control-${(0,l.g4)()}`},e),[r,n]=(0,l.gQ)(),[i,o]=(0,l.gQ)(),[a,s]=(0,l.gQ)(),[d,u]=(0,l.gQ)();return{formControlContext:{name:()=>c(t.name)??c(t.id),dataset:(0,l.dD)(()=>({"data-valid":"valid"===c(t.validationState)?"":void 0,"data-invalid":"invalid"===c(t.validationState)?"":void 0,"data-required":c(t.required)?"":void 0,"data-disabled":c(t.disabled)?"":void 0,"data-readonly":c(t.readOnly)?"":void 0})),validationState:()=>c(t.validationState),isRequired:()=>c(t.required),isDisabled:()=>c(t.disabled),isReadOnly:()=>c(t.readOnly),labelId:r,fieldId:i,descriptionId:a,errorMessageId:d,getAriaLabelledBy:(e,t,n)=>{let i=null!=n||null!=r();return[n,r(),i&&null!=t?e:void 0].filter(Boolean).join(" ")||void 0},getAriaDescribedBy:e=>[a(),d(),e].filter(Boolean).join(" ")||void 0,generateId:el(()=>c(t.id)),registerLabel:eA(n),registerField:eA(o),registerDescription:eA(s),registerErrorMessage:eA(u)}}}(a);t=()=>n,r=()=>u(o.defaultValue??""),(0,l.GW)((0,l.on)(t,e=>{if(null==e)return;let t=e.matches("textarea, input, select, button")?e.form:e.closest("form");null!=t&&(t.addEventListener("reset",r,{passive:!0}),(0,l.$W)(()=>{t.removeEventListener("reset",r)}))}));let f=()=>g.getAriaLabelledBy(c(a.id),s["aria-label"],o["aria-labelledby"]),p=()=>g.getAriaDescribedBy(o["aria-describedby"]),h=e=>e===d(),y={ariaDescribedBy:p,isSelectedValue:h,setSelectedValue:e=>{if(!(g.isReadOnly()||g.isDisabled())&&(u(e),n))for(let e of n.querySelectorAll("[type='radio']"))e.checked=h(e.value)}};return(0,l.LM)(eG.Provider,{value:g,get children(){return(0,l.LM)(rw.Provider,{value:y,get children(){return(0,l.LM)(eI,(0,l.dG)({as:"div",ref(e){let t=N(e=>n=e,o.ref);"function"==typeof t&&t(e)},role:"radiogroup",get id(){return c(a.id)},get"aria-invalid"(){return"invalid"===g.validationState()||void 0},get"aria-required"(){return g.isRequired()||void 0},get"aria-disabled"(){return g.isDisabled()||void 0},get"aria-readonly"(){return g.isReadOnly()||void 0},get"aria-orientation"(){return o.orientation},get"aria-labelledby"(){return f()},get"aria-describedby"(){return p()}},()=>g.dataset(),s))}})}})}var rP=Object.assign(rF,{Description:eB,ErrorMessage:eH,Item:rS,ItemControl:rC,ItemDescription:rL,ItemIndicator:rq,ItemInput:rT,ItemLabel:rE,Label:rD}),rA=class{collection;ref;collator;constructor(e,t,r){this.collection=e,this.ref=t,this.collator=r}getKeyBelow(e){let t=this.collection().getKeyAfter(e);for(;null!=t;){let e=this.collection().getItem(t);if(e&&"item"===e.type&&!e.disabled)return t;t=this.collection().getKeyAfter(t)}}getKeyAbove(e){let t=this.collection().getKeyBefore(e);for(;null!=t;){let e=this.collection().getItem(t);if(e&&"item"===e.type&&!e.disabled)return t;t=this.collection().getKeyBefore(t)}}getFirstKey(){let e=this.collection().getFirstKey();for(;null!=e;){let t=this.collection().getItem(e);if(t&&"item"===t.type&&!t.disabled)return e;e=this.collection().getKeyAfter(e)}}getLastKey(){let e=this.collection().getLastKey();for(;null!=e;){let t=this.collection().getItem(e);if(t&&"item"===t.type&&!t.disabled)return e;e=this.collection().getKeyBefore(e)}}getItem(e){return this.ref?.()?.querySelector(`[data-key="${e}"]`)??null}getKeyPageAbove(e){let t=this.ref?.(),r=this.getItem(e);if(!t||!r)return;let n=Math.max(0,r.offsetTop+r.offsetHeight-t.offsetHeight),i=e;for(;i&&r&&r.offsetTop>n;)r=null!=(i=this.getKeyAbove(i))?this.getItem(i):null;return i}getKeyPageBelow(e){let t=this.ref?.(),r=this.getItem(e);if(!t||!r)return;let n=Math.min(t.scrollHeight,r.offsetTop-r.offsetHeight+t.offsetHeight),i=e;for(;i&&r&&r.offsetTop<n;)r=null!=(i=this.getKeyBelow(i))?this.getItem(i):null;return i}getKeyForSearch(e,t){let r=this.collator?.();if(!r)return;let n=null!=t?this.getKeyBelow(t):this.getFirstKey();for(;null!=n;){let t=this.collection().getItem(n);if(t){let i=t.textValue.slice(0,e.length);if(t.textValue&&0===r.compare(i,e))return n}n=this.getKeyBelow(n)}}},rz="focusScope.autoFocusOnMount",rO="focusScope.autoFocusOnUnmount",rI={bubbles:!1,cancelable:!0},rK={stack:[],active(){return this.stack[0]},add(e){e!==this.active()&&this.active()?.pause(),this.stack=ei(this.stack,e),this.stack.unshift(e)},remove(e){this.stack=ei(this.stack,e),this.active()?.resume()}},rG=new WeakMap,rR=[],rB=new Map,rH=e=>{(0,l.GW)(()=>{let t=tr(e.style)??{},r=tr(e.properties)??[],n={};for(let r in t)n[r]=e.element.style[r];let i=rB.get(e.key);for(let t of(i?i.activeCount++:rB.set(e.key,{activeCount:1,originalStyles:n,properties:r.map(e=>e.key)}),Object.assign(e.element.style,e.style),r))e.element.style.setProperty(t.key,t.value);(0,l.$W)(()=>{let t=rB.get(e.key);if(t){if(1!==t.activeCount){t.activeCount--;return}for(let[r,n]of(rB.delete(e.key),Object.entries(t.originalStyles)))e.element.style[r]=n;for(let r of t.properties)e.element.style.removeProperty(r);0===e.element.style.length&&e.element.removeAttribute("style"),e.cleanup?.()}})})},rW=(e,t)=>{switch(t){case"x":return[e.clientWidth,e.scrollLeft,e.scrollWidth];case"y":return[e.clientHeight,e.scrollTop,e.scrollHeight]}},rU=(e,t)=>{let r=getComputedStyle(e),n="x"===t?r.overflowX:r.overflowY;return"auto"===n||"scroll"===n||"HTML"===e.tagName&&"visible"===n},rV=(e,t,r)=>{let n="x"===t&&"rtl"===window.getComputedStyle(e).direction?-1:1,i=e,o=0,l=0,a=!1;do{let[e,s,d]=rW(i,t),u=d-e-n*s;(0!==s||0!==u)&&rU(i,t)&&(o+=u,l+=s),i===(r??document.documentElement)?a=!0:i=i._$host??i.parentElement}while(i&&!a);return[o,l]},[rQ,rN]=(0,l.gQ)([]),rj=e=>rQ().indexOf(e)===rQ().length-1,rX=e=>[e.deltaX,e.deltaY],r_=e=>e.changedTouches[0]?[e.changedTouches[0].clientX,e.changedTouches[0].clientY]:[0,0],rY=(e,t,r,n)=>{let i=null!==n&&rZ(n,e),[o,l]=rV(e,t,i?n:void 0);return!(r>0&&1>=Math.abs(o)||r<0&&1>Math.abs(l))},rZ=(e,t)=>{if(e.contains(t))return!0;let r=t;for(;r;){if(r===e)return!0;r=r._$host??r.parentElement}return!1},rJ=e=>{let t=(0,l.dG)({element:null,enabled:!0,hideScrollbar:!0,preventScrollbarShift:!0,preventScrollbarShiftMode:"padding",restoreScrollPosition:!0,allowPinchZoom:!1},e),r=(0,l.g4)(),n=[0,0],i=null,o=null;(0,l.GW)(()=>{tr(t.enabled)&&(rN(e=>[...e,r]),(0,l.$W)(()=>{rN(e=>e.filter(e=>e!==r))}))}),(0,l.GW)(()=>{if(!tr(t.enabled)||!tr(t.hideScrollbar))return;let{body:e}=document,r=window.innerWidth-e.offsetWidth;if(tr(t.preventScrollbarShift)){let n={overflow:"hidden"},i=[];r>0&&("padding"===tr(t.preventScrollbarShiftMode)?n.paddingRight=`calc(${window.getComputedStyle(e).paddingRight} + ${r}px)`:n.marginRight=`calc(${window.getComputedStyle(e).marginRight} + ${r}px)`,i.push({key:"--scrollbar-width",value:`${r}px`}));let o=window.scrollY,l=window.scrollX;rH({key:"prevent-scroll",element:e,style:n,properties:i,cleanup:()=>{tr(t.restoreScrollPosition)&&r>0&&window.scrollTo(l,o)}})}else rH({key:"prevent-scroll",element:e,style:{overflow:"hidden"}})}),(0,l.GW)(()=>{rj(r)&&tr(t.enabled)&&(document.addEventListener("wheel",s,{passive:!1}),document.addEventListener("touchstart",a,{passive:!1}),document.addEventListener("touchmove",d,{passive:!1}),(0,l.$W)(()=>{document.removeEventListener("wheel",s),document.removeEventListener("touchstart",a),document.removeEventListener("touchmove",d)}))});let a=e=>{n=r_(e),i=null,o=null},s=e=>{let r=e.target,n=tr(t.element),i=rX(e),o=Math.abs(i[0])>Math.abs(i[1])?"x":"y",l="x"===o?i[0]:i[1],a=rY(r,o,l,n);n&&rZ(n,r)&&a||!e.cancelable||e.preventDefault()},d=e=>{let r;let l=tr(t.element),a=e.target;if(2===e.touches.length)r=!tr(t.allowPinchZoom);else{if(null==i||null===o){let t=r_(e).map((e,t)=>n[t]-e),r=Math.abs(t[0])>Math.abs(t[1])?"x":"y";i=r,o="x"===r?t[0]:t[1]}if("range"===a.type)r=!1;else{let e=rY(a,i,o,l);r=!(l&&rZ(l,a))||!e}}r&&e.cancelable&&e.preventDefault()}},r0=(0,l.kr)();function r1(){let e=(0,l.qp)(r0);if(void 0===e)throw Error("[kobalte]: `useMenuContext` must be used within a `Menu` component");return e}var r2=(0,l.kr)();function r3(){let e=(0,l.qp)(r2);if(void 0===e)throw Error("[kobalte]: `useMenuItemContext` must be used within a `Menu.Item` component");return e}var r5=(0,l.kr)();function r4(){let e=(0,l.qp)(r5);if(void 0===e)throw Error("[kobalte]: `useMenuRootContext` must be used within a `MenuRoot` component");return e}function r6(e){let t;let r=r4(),n=r1(),i=eL({id:r.generateId(`item-${(0,l.g4)()}`)},e),[o,a]=(0,l.eY)(i,["ref","textValue","disabled","closeOnSelect","checked","indeterminate","onSelect","onPointerMove","onPointerLeave","onPointerDown","onPointerUp","onClick","onKeyDown","onMouseDown","onFocus"]),[s,d]=(0,l.gQ)(),[u,c]=(0,l.gQ)(),[g,f]=(0,l.gQ)(),p=()=>n.listState().selectionManager(),h=()=>a.id,y=()=>p().focusedKey()===h(),v=()=>{o.onSelect?.(),o.closeOnSelect&&setTimeout(()=>{n.close(!0)})};!function(e){let t=function(){let e=(0,l.qp)(ej);if(void 0===e)throw Error("[kobalte]: `useDomCollectionContext` must be used within a `DomCollectionProvider` component");return e}(),r=eL({shouldRegisterItem:!0},e);(0,l.GW)(()=>{if(!r.shouldRegisterItem)return;let e=t.registerItem(r.getItem());(0,l.$W)(e)})}({getItem:()=>({ref:()=>t,type:"item",key:h(),textValue:o.textValue??g()?.textContent??t?.textContent??"",disabled:o.disabled??!1})});let b=e7({key:h,selectionManager:p,shouldSelectOnPressUp:!0,allowsDifferentPressOrigin:!0,disabled:()=>o.disabled},()=>t),m=e=>{ep(e,o.onPointerMove),"mouse"===e.pointerType&&(o.disabled?n.onItemLeave(e):(n.onItemEnter(e),e.defaultPrevented||(ey(e.currentTarget),n.listState().selectionManager().setFocused(!0),n.listState().selectionManager().setFocusedKey(h()))))},x=e=>{ep(e,o.onPointerLeave),"mouse"===e.pointerType&&n.onItemLeave(e)},w=e=>{ep(e,o.onPointerUp),o.disabled||0!==e.button||v()},$=e=>{if(ep(e,o.onKeyDown),!e.repeat&&!o.disabled)switch(e.key){case"Enter":case" ":v()}},k=(0,l.dD)(()=>o.indeterminate?"mixed":null!=o.checked?o.checked:void 0),M=(0,l.dD)(()=>({"data-indeterminate":o.indeterminate?"":void 0,"data-checked":o.checked&&!o.indeterminate?"":void 0,"data-disabled":o.disabled?"":void 0,"data-highlighted":y()?"":void 0})),S={isChecked:()=>o.checked,dataset:M,setLabelRef:f,generateId:el(()=>a.id),registerLabel:eA(d),registerDescription:eA(c)};return(0,l.LM)(r2.Provider,{value:S,get children(){return(0,l.LM)(eI,(0,l.dG)({as:"div",ref(e){let r=N(e=>t=e,o.ref);"function"==typeof r&&r(e)},get tabIndex(){return b.tabIndex()},get"aria-checked"(){return k()},get"aria-disabled"(){return o.disabled},get"aria-labelledby"(){return s()},get"aria-describedby"(){return u()},get"data-key"(){return b.dataKey()},get onPointerDown(){return eh([o.onPointerDown,b.onPointerDown])},get onPointerUp(){return eh([w,b.onPointerUp])},get onClick(){return eh([o.onClick,b.onClick])},get onKeyDown(){return eh([$,b.onKeyDown])},get onMouseDown(){return eh([o.onMouseDown,b.onMouseDown])},get onFocus(){return eh([o.onFocus,b.onFocus])},onPointerMove:m,onPointerLeave:x},M,a))}})}function r9(e){let t=eL({closeOnSelect:!1},e),[r,n]=(0,l.eY)(t,["checked","defaultChecked","onChange","onSelect"]),i=function(e={}){let[t,r]=eV({value:()=>c(e.isSelected),defaultValue:()=>!!c(e.defaultIsSelected),onChange:t=>e.onSelectedChange?.(t)});return{isSelected:t,setIsSelected:t=>{c(e.isReadOnly)||c(e.isDisabled)||r(t)},toggle:()=>{c(e.isReadOnly)||c(e.isDisabled)||r(!t())}}}({isSelected:()=>r.checked,defaultIsSelected:()=>r.defaultChecked,onSelectedChange:e=>r.onChange?.(e),isDisabled:()=>n.disabled});return(0,l.LM)(r6,(0,l.dG)({role:"menuitemcheckbox",get checked(){return i.isSelected()},onSelect:()=>{r.onSelect?.(),i.toggle()}},n))}var r8=(0,l.kr)();function r7(){return(0,l.qp)(r8)}var ne={next:(e,t)=>"ltr"===e?"horizontal"===t?"ArrowRight":"ArrowDown":"horizontal"===t?"ArrowLeft":"ArrowUp",previous:(e,t)=>ne.next("ltr"===e?"rtl":"ltr",t)},nt={first:e=>"horizontal"===e?"ArrowDown":"ArrowRight",last:e=>"horizontal"===e?"ArrowUp":"ArrowLeft"};function nr(e){let t=r4(),r=r1(),n=r7(),{direction:i}=e5(),o=eL({id:t.generateId("trigger")},e),[a,s]=(0,l.eY)(o,["ref","id","disabled","onPointerDown","onClick","onKeyDown","onMouseOver","onFocus"]),d=()=>t.value();void 0!==n&&(d=()=>t.value()??a.id,void 0===n.lastValue()&&n.setLastValue(d));let u=ez(()=>r.triggerRef(),()=>"button"),c=(0,l.dD)(()=>"a"===u()&&r.triggerRef()?.getAttribute("href")!=null);(0,l.GW)((0,l.on)(()=>n?.value(),e=>{c()&&e===d()&&r.triggerRef()?.focus()}));let g=()=>{void 0!==n?r.isOpen()?n.value()===d()&&n.closeMenu():(n.autoFocusMenu()||n.setAutoFocusMenu(!0),r.open(!1)):r.toggle(!0)};return(0,l.GW)(()=>(0,l.$W)(r.registerTriggerId(a.id))),(0,l.LM)(tf,(0,l.dG)({ref(e){let t=N(r.setTriggerRef,a.ref);"function"==typeof t&&t(e)},get"data-kb-menu-value-trigger"(){return t.value()},get id(){return a.id},get disabled(){return a.disabled},"aria-haspopup":"true",get"aria-expanded"(){return r.isOpen()},get"aria-controls"(){return(0,l.dD)(()=>!!r.isOpen())()?r.contentId():void 0},get"data-highlighted"(){return void 0!==d()&&n?.value()===d()||void 0},get tabIndex(){return void 0!==n?n.value()===d()||n.lastValue()===d()?0:-1:void 0},onPointerDown:e=>{ep(e,a.onPointerDown),e.currentTarget.dataset.pointerType=e.pointerType,a.disabled||"touch"===e.pointerType||0!==e.button||g()},onMouseOver:e=>{ep(e,a.onMouseOver),r.triggerRef()?.dataset.pointerType==="touch"||a.disabled||void 0===n||void 0===n.value()||n.setValue(d)},onClick:e=>{ep(e,a.onClick),a.disabled||"touch"!==e.currentTarget.dataset.pointerType||g()},onKeyDown:e=>{if(ep(e,a.onKeyDown),!a.disabled){if(c())switch(e.key){case"Enter":case" ":return}switch(e.key){case"Enter":case" ":case nt.first(t.orientation()):e.stopPropagation(),e.preventDefault(),function(e,t){if(document.contains(e)){let t=document.scrollingElement||document.documentElement;if("hidden"===window.getComputedStyle(t).overflow){let r=eS(e);for(;e&&r&&e!==t&&r!==t;)eD(r,e),r=eS(e=r)}else{let{left:t,top:r}=e.getBoundingClientRect();e?.scrollIntoView?.({block:"nearest"});let{left:n,top:i}=e.getBoundingClientRect();(Math.abs(t-n)>1||Math.abs(r-i)>1)&&e.scrollIntoView?.({block:"nearest"})}}}(e.currentTarget),r.open("first"),n?.setAutoFocusMenu(!0),n?.setValue(d);break;case nt.last(t.orientation()):e.stopPropagation(),e.preventDefault(),r.open("last");break;case ne.next(i(),t.orientation()):if(void 0===n)break;e.stopPropagation(),e.preventDefault(),n.nextMenu();break;case ne.previous(i(),t.orientation()):if(void 0===n)break;e.stopPropagation(),e.preventDefault(),n.previousMenu()}}},onFocus:e=>{ep(e,a.onFocus),void 0!==n&&"touch"!==e.currentTarget.dataset.pointerType&&n.setValue(d)},role:void 0!==n?"menuitem":void 0},()=>r.dataset(),s))}var nn=(0,l.kr)();function ni(e){let t;let r=r4(),n=r1(),i=r7(),o=(0,l.qp)(nn),{direction:a}=e5(),s=eL({id:r.generateId(`content-${(0,l.g4)()}`)},e),[d,u]=(0,l.eY)(s,["ref","id","style","onOpenAutoFocus","onCloseAutoFocus","onEscapeKeyDown","onFocusOutside","onPointerEnter","onPointerMove","onKeyDown","onMouseDown","onFocusIn","onFocusOut"]),p=0,h=()=>null==n.parentMenuContext()&&void 0===i&&r.isModal(),y=function(e,t,r){let n=function(e){let{locale:t}=e5(),r=(0,l.dD)(()=>t()+(e?Object.entries(e).sort((e,t)=>e[0]<t[0]?-1:1).join():""));return(0,l.dD)(()=>{let n;let i=r();return e4.has(i)&&(n=e4.get(i)),n||(n=new Intl.Collator(t(),e),e4.set(i,n)),n})}({usage:"search",sensitivity:"base"});return function(e,t,r){let n=(0,l.dG)({selectOnFocus:()=>"replace"===c(e.selectionManager).selectionBehavior()},e),i=()=>t(),{direction:o}=e5(),a={top:0,left:0};!function(e,t,r,n){if(l.sk)return;let i=()=>{g(c(e)).forEach(e=>{e&&g(c(t)).forEach(t=>{var n;return n=void 0,e.addEventListener(t,r,n),f(e.removeEventListener.bind(e,t,r,n))})})};"function"==typeof e?(0,l.GW)(i):(0,l.F3)(i)}(()=>c(n.isVirtualized)?void 0:i(),"scroll",()=>{let e=i();e&&(a={top:e.scrollTop,left:e.scrollLeft})});let{typeSelectHandlers:s}=function(e){let[t,r]=(0,l.gQ)(""),[n,i]=(0,l.gQ)(-1);return{typeSelectHandlers:{onKeyDown:o=>{var l,a;if(c(e.isDisabled))return;let s=c(e.keyboardDelegate),d=c(e.selectionManager);if(!s.getKeyForSearch)return;let u=1!==(l=o.key).length&&/^[A-Z]/i.test(l)?"":l;if(!u||o.ctrlKey||o.metaKey)return;" "===u&&t().trim().length>0&&(o.preventDefault(),o.stopPropagation());let g=r(e=>e+u),f=s.getKeyForSearch(g,d.focusedKey())??s.getKeyForSearch(g);null==f&&(a=g).split("").every(e=>e===a[0])&&(g=g[0],f=s.getKeyForSearch(g,d.focusedKey())??s.getKeyForSearch(g)),null!=f&&(d.setFocusedKey(f),e.onTypeSelect?.(f)),clearTimeout(n()),i(window.setTimeout(()=>r(""),500))}}}}({isDisabled:()=>c(n.disallowTypeAhead),keyboardDelegate:()=>c(n.keyboardDelegate),selectionManager:()=>c(n.selectionManager)}),d=()=>c(n.orientation)??"vertical",u=()=>{let e;let r=c(n.autoFocus);if(!r)return;let i=c(n.selectionManager),o=c(n.keyboardDelegate);"first"===r&&(e=o.getFirstKey?.()),"last"===r&&(e=o.getLastKey?.());let l=i.selectedKeys();l.size&&(e=l.values().next().value),i.setFocused(!0),i.setFocusedKey(e);let a=t();a&&null==e&&!c(n.shouldUseVirtualFocus)&&ey(a)};return(0,l.H3)(()=>{n.deferAutoFocus?setTimeout(u,0):u()}),(0,l.GW)((0,l.on)([i,()=>c(n.isVirtualized),()=>c(n.selectionManager).focusedKey()],e=>{let[t,r,i]=e;if(r)i&&n.scrollToKey?.(i);else if(i&&t){let e=t.querySelector(`[data-key="${i}"]`);e&&eD(t,e)}})),{tabIndex:(0,l.dD)(()=>{if(!c(n.shouldUseVirtualFocus))return null==c(n.selectionManager).focusedKey()?0:-1}),onKeyDown:e=>{ep(e,s.onKeyDown),e.altKey&&"Tab"===e.key&&e.preventDefault();let r=t();if(!r?.contains(e.target))return;let i=c(n.selectionManager),l=c(n.selectOnFocus),a=t=>{null!=t&&(i.setFocusedKey(t),e.shiftKey&&"multiple"===i.selectionMode()?i.extendSelection(t):l&&!e9(e)&&i.replaceSelection(t))},u=c(n.keyboardDelegate),g=c(n.shouldFocusWrap),f=i.focusedKey();switch(e.key){case"vertical"===d()?"ArrowDown":"ArrowRight":if(u.getKeyBelow){let t;e.preventDefault(),null==(t=null!=f?u.getKeyBelow(f):u.getFirstKey?.())&&g&&(t=u.getFirstKey?.(f)),a(t)}break;case"vertical"===d()?"ArrowUp":"ArrowLeft":if(u.getKeyAbove){let t;e.preventDefault(),null==(t=null!=f?u.getKeyAbove(f):u.getLastKey?.())&&g&&(t=u.getLastKey?.(f)),a(t)}break;case"vertical"===d()?"ArrowLeft":"ArrowUp":if(u.getKeyLeftOf){e.preventDefault();let t="rtl"===o();a(null!=f?u.getKeyLeftOf(f):t?u.getFirstKey?.():u.getLastKey?.())}break;case"vertical"===d()?"ArrowRight":"ArrowDown":if(u.getKeyRightOf){e.preventDefault();let t="rtl"===o();a(null!=f?u.getKeyRightOf(f):t?u.getLastKey?.():u.getFirstKey?.())}break;case"Home":if(u.getFirstKey){e.preventDefault();let t=u.getFirstKey(f,e8(e));null!=t&&(i.setFocusedKey(t),e8(e)&&e.shiftKey&&"multiple"===i.selectionMode()?i.extendSelection(t):l&&i.replaceSelection(t))}break;case"End":if(u.getLastKey){e.preventDefault();let t=u.getLastKey(f,e8(e));null!=t&&(i.setFocusedKey(t),e8(e)&&e.shiftKey&&"multiple"===i.selectionMode()?i.extendSelection(t):l&&i.replaceSelection(t))}break;case"PageDown":u.getKeyPageBelow&&null!=f&&(e.preventDefault(),a(u.getKeyPageBelow(f)));break;case"PageUp":u.getKeyPageAbove&&null!=f&&(e.preventDefault(),a(u.getKeyPageAbove(f)));break;case"a":e8(e)&&"multiple"===i.selectionMode()&&!0!==c(n.disallowSelectAll)&&(e.preventDefault(),i.selectAll());break;case"Escape":e.defaultPrevented||(e.preventDefault(),c(n.disallowEmptySelection)||i.clearSelection());break;case"Tab":if(!c(n.allowsTabNavigation)){if(e.shiftKey)r.focus();else{let e,t;let n=function(e,t,r){let n=t?.tabbable?ew:ex,i=document.createTreeWalker(e,NodeFilter.SHOW_ELEMENT,{acceptNode:e=>t?.from?.contains(e)?NodeFilter.FILTER_REJECT:e.matches(n)&&eM(e)&&(!t?.accept||t.accept(e))?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_SKIP});return t?.from&&(i.currentNode=t.from),i}(r,{tabbable:!0});do(t=n.lastChild())&&(e=t);while(t);e&&!e.contains(document.activeElement)&&ey(e)}}}},onMouseDown:e=>{i()===e.target&&e.preventDefault()},onFocusIn:e=>{let t=c(n.selectionManager),r=c(n.keyboardDelegate),o=c(n.selectOnFocus);if(t.isFocused()){e.currentTarget.contains(e.target)||t.setFocused(!1);return}if(e.currentTarget.contains(e.target)){if(t.setFocused(!0),null==t.focusedKey()){let n=e=>{null!=e&&(t.setFocusedKey(e),o&&t.replaceSelection(e))},i=e.relatedTarget;i&&e.currentTarget.compareDocumentPosition(i)&Node.DOCUMENT_POSITION_FOLLOWING?n(t.lastSelectedKey()??r.getLastKey?.()):n(t.firstSelectedKey()??r.getFirstKey?.())}else if(!c(n.isVirtualized)){let e=i();if(e){e.scrollTop=a.top,e.scrollLeft=a.left;let r=e.querySelector(`[data-key="${t.focusedKey()}"]`);r&&(ey(r),eD(e,r))}}}},onFocusOut:e=>{let t=c(n.selectionManager);e.currentTarget.contains(e.relatedTarget)||t.setFocused(!1)}}}({selectionManager:()=>c(e.selectionManager),keyboardDelegate:(0,l.dD)(()=>c(e.keyboardDelegate)||new rA(e.collection,t,n)),autoFocus:()=>c(e.autoFocus),deferAutoFocus:()=>c(e.deferAutoFocus),shouldFocusWrap:()=>c(e.shouldFocusWrap),disallowEmptySelection:()=>c(e.disallowEmptySelection),selectOnFocus:()=>c(e.selectOnFocus),disallowTypeAhead:()=>c(e.disallowTypeAhead),shouldUseVirtualFocus:()=>c(e.shouldUseVirtualFocus),allowsTabNavigation:()=>c(e.allowsTabNavigation),isVirtualized:()=>c(e.isVirtualized),scrollToKey:t=>c(e.scrollToKey)?.(t),orientation:()=>c(e.orientation)},t)}({selectionManager:n.listState().selectionManager,collection:n.listState().collection,autoFocus:n.autoFocus,deferAutoFocus:!0,shouldFocusWrap:!0,disallowTypeAhead:()=>!n.listState().selectionManager().isFocused(),orientation:()=>"horizontal"===r.orientation()?"vertical":"horizontal"},()=>t);!function(e,t){let[r,n]=(0,l.gQ)(!1),i={pause(){n(!0)},resume(){n(!1)}},o=null,a=t=>e.onMountAutoFocus?.(t),s=t=>e.onUnmountAutoFocus?.(t),d=()=>ed(t()),u=()=>{let e=d().createElement("span");return e.setAttribute("data-focus-trap",""),e.tabIndex=0,Object.assign(e.style,eP),e},g=()=>{let e=t();return e?(function e(t,r){let n=Array.from(t.querySelectorAll(ex)).filter(e$);return r&&e$(t)&&n.unshift(t),n.forEach((t,r)=>{if(eu(t)&&t.contentDocument){let i=e(t.contentDocument.body,!1);n.splice(r,1,...i)}}),n})(e,!0).filter(e=>!e.hasAttribute("data-focus-trap")):[]},f=()=>{let e=g();return e.length>0?e[0]:null},p=()=>{let e=g();return e.length>0?e[e.length-1]:null},h=()=>{let e=t();if(!e)return!1;let r=es(e);return!(!r||ea(e,r))&&ek(r)};(0,l.GW)(()=>{if(l.sk)return;let e=t();if(!e)return;rK.add(i);let r=es(e);if(!ea(e,r)){let t=new CustomEvent(rz,rI);e.addEventListener(rz,a),e.dispatchEvent(t),t.defaultPrevented||setTimeout(()=>{ey(f()),es(e)===r&&ey(e)},0)}(0,l.$W)(()=>{e.removeEventListener(rz,a),setTimeout(()=>{let t=new CustomEvent(rO,rI);h()&&t.preventDefault(),e.addEventListener(rO,s),e.dispatchEvent(t),t.defaultPrevented||ey(r??d().body),e.removeEventListener(rO,s),rK.remove(i)},0)})}),(0,l.GW)(()=>{if(l.sk)return;let n=t();if(!n||!c(e.trapFocus)||r())return;let i=e=>{let t=e.target;t?.closest(`[${ti}]`)||(ea(n,t)?o=t:ey(o))},a=e=>{let t=e.relatedTarget??es(n);!t?.closest(`[${ti}]`)&&(ea(n,t)||ey(o))};d().addEventListener("focusin",i),d().addEventListener("focusout",a),(0,l.$W)(()=>{d().removeEventListener("focusin",i),d().removeEventListener("focusout",a)})}),(0,l.GW)(()=>{if(l.sk)return;let n=t();if(!n||!c(e.trapFocus)||r())return;let i=u();n.insertAdjacentElement("afterbegin",i);let o=u();function a(e){let t=f(),r=p();e.relatedTarget===t?ey(r):ey(t)}n.insertAdjacentElement("beforeend",o),i.addEventListener("focusin",a),o.addEventListener("focusin",a);let s=new MutationObserver(e=>{for(let t of e)t.previousSibling===o&&(o.remove(),n.insertAdjacentElement("beforeend",o)),t.nextSibling===i&&(i.remove(),n.insertAdjacentElement("afterbegin",i))});s.observe(n,{childList:!0,subtree:!1}),(0,l.$W)(()=>{i.removeEventListener("focusin",a),o.removeEventListener("focusin",a),i.remove(),o.remove(),s.disconnect()})})}({trapFocus:()=>h()&&n.isOpen(),onMountAutoFocus:e=>{void 0===i&&d.onOpenAutoFocus?.(e)},onUnmountAutoFocus:d.onCloseAutoFocus},()=>t);let v=e=>{d.onEscapeKeyDown?.(e),i?.setAutoFocusMenu(!1),n.close(!0)},b=e=>{d.onFocusOutside?.(e),r.isModal()&&e.preventDefault()};(0,l.GW)(()=>(0,l.$W)(n.registerContentId(d.id)));let m={ref:N(e=>{n.setContentRef(e),t=e},d.ref),role:"menu",get id(){return d.id},get tabIndex(){return y.tabIndex()},get"aria-labelledby"(){return n.triggerId()},onKeyDown:eh([d.onKeyDown,y.onKeyDown,e=>{if(ea(e.currentTarget,e.target)&&("Tab"===e.key&&n.isOpen()&&e.preventDefault(),void 0!==i&&"true"!==e.currentTarget.getAttribute("aria-haspopup")))switch(e.key){case ne.next(a(),r.orientation()):e.stopPropagation(),e.preventDefault(),n.close(!0),i.setAutoFocusMenu(!0),i.nextMenu();break;case ne.previous(a(),r.orientation()):if(e.currentTarget.hasAttribute("data-closed"))break;e.stopPropagation(),e.preventDefault(),n.close(!0),i.setAutoFocusMenu(!0),i.previousMenu()}}]),onMouseDown:eh([d.onMouseDown,y.onMouseDown]),onFocusIn:eh([d.onFocusIn,y.onFocusIn]),onFocusOut:eh([d.onFocusOut,y.onFocusOut]),onPointerEnter:e=>{ep(e,d.onPointerEnter),n.isOpen()&&(n.parentMenuContext()?.listState().selectionManager().setFocused(!1),n.parentMenuContext()?.listState().selectionManager().setFocusedKey(void 0))},onPointerMove:e=>{if(ep(e,d.onPointerMove),"mouse"!==e.pointerType)return;let t=e.target,r=p!==e.clientX;ea(e.currentTarget,t)&&r&&(n.setPointerDir(e.clientX>p?"right":"left"),p=e.clientX)},get"data-orientation"(){return r.orientation()}};return(0,l.LM)(l.di,{get when(){return n.contentPresent()},get children(){return(0,l.LM)(l.di,{get when(){return void 0===o||null!=n.parentMenuContext()},get fallback(){return(0,l.LM)(eI,(0,l.dG)({as:"div"},()=>n.dataset(),m,u))},get children(){return(0,l.LM)(rp.Positioner,{get children(){return(0,l.LM)(rb,(0,l.dG)({get disableOutsidePointerEvents(){return(0,l.dD)(()=>!!h())()&&n.isOpen()},get excludedElements(){return[n.triggerRef]},bypassTopMostLayerCheck:!0,get style(){return en({"--kb-menu-content-transform-origin":"var(--kb-popper-content-transform-origin)",position:"relative"},d.style)},onEscapeKeyDown:v,onFocusOutside:b,get onDismiss(){return n.close}},()=>n.dataset(),m,u))}})}})}})}function no(e){let t;let r=r4(),n=r1(),[i,o]=(0,l.eY)(e,["ref"]);return rJ({element:()=>t??null,enabled:()=>n.contentPresent()&&r.preventScroll()}),(0,l.LM)(ni,(0,l.dG)({ref(e){let r=N(e=>{t=e},i.ref);"function"==typeof r&&r(e)}},o))}var nl=(0,l.kr)();function na(e){let t=eL({id:r4().generateId(`group-${(0,l.g4)()}`)},e),[r,n]=(0,l.gQ)(),i={generateId:el(()=>t.id),registerLabelId:eA(n)};return(0,l.LM)(nl.Provider,{value:i,get children(){return(0,l.LM)(eI,(0,l.dG)({as:"div",role:"group",get"aria-labelledby"(){return r()}},t))}})}function ns(e){let t=function(){let e=(0,l.qp)(nl);if(void 0===e)throw Error("[kobalte]: `useMenuGroupContext` must be used within a `Menu.Group` component");return e}(),r=eL({id:t.generateId("label")},e),[n,i]=(0,l.eY)(r,["id"]);return(0,l.GW)(()=>(0,l.$W)(t.registerLabelId(n.id))),(0,l.LM)(eI,(0,l.dG)({as:"span",get id(){return n.id},"aria-hidden":"true"},i))}function nd(e){let t=r1(),r=eL({children:"▼"},e);return(0,l.LM)(eI,(0,l.dG)({as:"span","aria-hidden":"true"},()=>t.dataset(),r))}function nu(e){return(0,l.LM)(r6,(0,l.dG)({role:"menuitem",closeOnSelect:!0},e))}function nc(e){let t=r3(),r=eL({id:t.generateId("description")},e),[n,i]=(0,l.eY)(r,["id"]);return(0,l.GW)(()=>(0,l.$W)(t.registerDescription(n.id))),(0,l.LM)(eI,(0,l.dG)({as:"div",get id(){return n.id}},()=>t.dataset(),i))}function ng(e){let t=r3(),r=eL({id:t.generateId("indicator")},e),[n,i]=(0,l.eY)(r,["forceMount"]);return(0,l.LM)(l.di,{get when(){return n.forceMount||t.isChecked()},get children(){return(0,l.LM)(eI,(0,l.dG)({as:"div"},()=>t.dataset(),i))}})}function nf(e){let t=r3(),r=eL({id:t.generateId("label")},e),[n,i]=(0,l.eY)(r,["ref","id"]);return(0,l.GW)(()=>(0,l.$W)(t.registerLabel(n.id))),(0,l.LM)(eI,(0,l.dG)({as:"div",ref(e){let r=N(t.setLabelRef,n.ref);"function"==typeof r&&r(e)},get id(){return n.id}},()=>t.dataset(),i))}function np(e){let t=r1();return(0,l.LM)(l.di,{get when(){return t.contentPresent()},get children(){return(0,l.LM)(l.h_,e)}})}var nh=(0,l.kr)();function ny(e){let t=eL({id:r4().generateId(`radiogroup-${(0,l.g4)()}`)},e),[r,n]=(0,l.eY)(t,["value","defaultValue","onChange","disabled"]),[i,o]=eU({value:()=>r.value,defaultValue:()=>r.defaultValue,onChange:e=>r.onChange?.(e)});return(0,l.LM)(nh.Provider,{value:{isDisabled:()=>r.disabled,isSelectedValue:e=>e===i(),setSelectedValue:o},get children(){return(0,l.LM)(na,n)}})}function nv(e){let t=function(){let e=(0,l.qp)(nh);if(void 0===e)throw Error("[kobalte]: `useMenuRadioGroupContext` must be used within a `Menu.RadioGroup` component");return e}(),r=eL({closeOnSelect:!1},e),[n,i]=(0,l.eY)(r,["value","onSelect"]);return(0,l.LM)(r6,(0,l.dG)({role:"menuitemradio",get checked(){return t.isSelectedValue(n.value)},onSelect:()=>{n.onSelect?.(),t.setSelectedValue(n.value)}},i))}function nb(e){var t;let r=r4(),n=(0,l.qp)(ej),i=(0,l.qp)(r0),o=r7(),a=(0,l.qp)(nn),s=eL({placement:"horizontal"===r.orientation()?"bottom-start":"right-start"},e),[d,u]=(0,l.eY)(s,["open","defaultOpen","onOpenChange"]),g=0,f=null,p="right",[h,y]=(0,l.gQ)(),[v,b]=(0,l.gQ)(),[m,x]=(0,l.gQ)(),[w,$]=(0,l.gQ)(),[k,M]=(0,l.gQ)(!0),[S,C]=(0,l.gQ)(u.placement),[L,q]=(0,l.gQ)([]),[T,E]=(0,l.gQ)([]),{DomCollectionProvider:D}=function(e={}){let[t,r]=function(e){let[t,r]=eU(e);return[()=>t()??[],r]}({value:()=>c(e.items),onChange:t=>e.onItemsChange?.(t)});!function(e,t){if("function"!=typeof IntersectionObserver){(0,l.GW)(()=>{let r=setTimeout(()=>{e_(e(),t)});(0,l.$W)(()=>clearTimeout(r))});return}let r=[];(0,l.GW)(()=>{let n=new IntersectionObserver(()=>{let n=!!r.length;r=e(),n&&e_(e(),t)},{root:function(e){let t=e[0],r=e[e.length-1]?.ref(),n=t?.ref()?.parentElement;for(;n;){if(r&&n.contains(r))return n;n=n.parentElement}return ed(n).body}(e())});for(let t of e()){let e=t.ref();e&&n.observe(e)}(0,l.$W)(()=>n.disconnect())})}(t,r);let n=e=>(r(t=>{let r=function(e,t){let r=t.ref();if(!r)return -1;let n=e.length;if(!n)return -1;for(;n--;){let t=e[n]?.ref();if(t&&eX(t,r))return n+1}return 0}(t,e);return function(e,t,r=-1){return r in e?[...e.slice(0,r),t,...e.slice(r)]:[...e,t]}(t,e,r)}),()=>{r(t=>{let r=t.filter(t=>t.ref()!==e.ref());return t.length===r.length?t:r})});return{DomCollectionProvider:e=>(0,l.LM)(ej.Provider,{value:{registerItem:n},get children(){return e.children}})}}({items:T,onItemsChange:E}),F=rm({open:()=>d.open,defaultOpen:()=>d.defaultOpen,onOpenChange:e=>d.onOpenChange?.(e)}),{present:P}=tn({show:()=>r.forceMount()||F.isOpen(),element:()=>w()??null}),A=function(e){let t=function(e){let t=eL({selectionMode:"none",selectionBehavior:"toggle"},e),[r,n]=(0,l.gQ)(!1),[i,o]=(0,l.gQ)(),[a,s]=function(e){let[t,r]=eU(e);return[()=>t()??new e6,r]}({value:(0,l.dD)(()=>{let e=c(t.selectedKeys);return null!=e?new e6(e):e}),defaultValue:(0,l.dD)(()=>{let e=c(t.defaultSelectedKeys);return null!=e?new e6(e):new e6}),onChange:e=>t.onSelectionChange?.(e)}),[d,u]=(0,l.gQ)(c(t.selectionBehavior));return(0,l.GW)(()=>{let e=a();"replace"===c(t.selectionBehavior)&&"toggle"===d()&&"object"==typeof e&&0===e.size&&u("replace")}),(0,l.GW)(()=>{u(c(t.selectionBehavior)??"toggle")}),{selectionMode:()=>c(t.selectionMode),disallowEmptySelection:()=>c(t.disallowEmptySelection)??!1,selectionBehavior:d,setSelectionBehavior:u,isFocused:r,setFocused:n,focusedKey:i,setFocusedKey:o,selectedKeys:a,setSelectedKeys:e=>{(c(t.allowDuplicateSelectionEvents)||!function(e,t){if(e.size!==t.size)return!1;for(let r of e)if(!t.has(r))return!1;return!0}(e,a()))&&s(e)}}}(e),r=function(e,t=[]){return(0,l.dD)(()=>{let r=function e(t){let r=t.startIndex??0,n=t.startLevel??0,i=[],o=e=>{if(null==e)return"";let r=t.getKey??"key",n=eo(r)?e[r]:r(e);return null!=n?String(n):""},l=e=>{if(null==e)return"";let r=t.getTextValue??"textValue",n=eo(r)?e[r]:r(e);return null!=n?String(n):""},a=e=>{if(null==e)return!1;let r=t.getDisabled??"disabled";return(eo(r)?e[r]:r(e))??!1},s=e=>null==e?void 0:eo(t.getSectionChildren)?e[t.getSectionChildren]:t.getSectionChildren?.(e);for(let d of t.dataSource){if(eo(d)||"number"==typeof d){i.push({type:"item",rawValue:d,key:String(d),textValue:String(d),disabled:a(d),level:n,index:r}),r++;continue}if(null!=s(d)){i.push({type:"section",rawValue:d,key:"",textValue:"",disabled:!1,level:n,index:r}),r++;let o=s(d)??[];if(o.length>0){let l=e({dataSource:o,getKey:t.getKey,getTextValue:t.getTextValue,getDisabled:t.getDisabled,getSectionChildren:t.getSectionChildren,startIndex:r,startLevel:n+1});i.push(...l),r+=l.length}}else i.push({type:"item",rawValue:d,key:o(d),textValue:l(d),disabled:a(d),level:n,index:r}),r++}return i}({dataSource:c(e.dataSource),getKey:c(e.getKey),getTextValue:c(e.getTextValue),getDisabled:c(e.getDisabled),getSectionChildren:c(e.getSectionChildren)});for(let e=0;e<t.length;e++)t[e]();return e.factory(r)})}({dataSource:()=>c(e.dataSource),getKey:()=>c(e.getKey),getTextValue:()=>c(e.getTextValue),getDisabled:()=>c(e.getDisabled),getSectionChildren:()=>c(e.getSectionChildren),factory:t=>new tt(e.filter?e.filter(t):t)},[()=>e.filter]),n=new te(r,t);return(0,l.Df)(()=>{let e=t.focusedKey();null==e||r().getItem(e)||t.setFocusedKey(void 0)}),{collection:r,selectionManager:()=>n}}({selectionMode:"none",dataSource:T}),z=e=>{M(e),F.open()},O=(e=!1)=>{F.close(),e&&i&&i.close(!0)},I=()=>{let e=w();e&&(ey(e),A.selectionManager().setFocused(!0),A.selectionManager().setFocusedKey(void 0))},K=()=>{null!=a?setTimeout(()=>I()):I()},G=e=>{var t;return p===f?.side&&!!(t=f?.area)&&function(e,t){let[r,n]=e,i=!1,o=t.length;for(let e=0,l=o-1;e<o;l=e++){let[a,s]=t[e],[d,u]=t[l],[,c]=t[0===l?o-1:l-1]||[0,0],g=(s-u)*(r-a)-(a-d)*(n-s);if(u<s){if(n>=u&&n<s){if(0===g)return!0;g>0&&(n===u?n>c&&(i=!i):i=!i)}}else if(s<u){if(n>s&&n<=u){if(0===g)return!0;g<0&&(n===u?n<c&&(i=!i):i=!i)}}else if(n==s&&(r>=d&&r<=a||r>=a&&r<=d))return!0}return i}([e.clientX,e.clientY],t)};t={isDisabled:()=>!(null==i&&F.isOpen()&&r.isModal()),targets:()=>[w(),...L()].filter(Boolean)},(0,l.GW)(()=>{c(t.isDisabled)||(0,l.$W)(function(e,t=document.body){let r=new Set(e),n=new Set,i=e=>{for(let t of e.querySelectorAll(`[data-live-announcer], [${ti}]`))r.add(t);let t=e=>{if(r.has(e)||e.parentElement&&n.has(e.parentElement)&&"row"!==e.parentElement.getAttribute("role"))return NodeFilter.FILTER_REJECT;for(let t of r)if(e.contains(t))return NodeFilter.FILTER_SKIP;return NodeFilter.FILTER_ACCEPT},i=document.createTreeWalker(e,NodeFilter.SHOW_ELEMENT,{acceptNode:t}),l=t(e);if(l===NodeFilter.FILTER_ACCEPT&&o(e),l!==NodeFilter.FILTER_REJECT){let e=i.nextNode();for(;null!=e;)o(e),e=i.nextNode()}},o=e=>{let t=rG.get(e)??0;("true"!==e.getAttribute("aria-hidden")||0!==t)&&(0===t&&e.setAttribute("aria-hidden","true"),n.add(e),rG.set(e,t+1))};rR.length&&rR[rR.length-1].disconnect(),i(t);let l=new MutationObserver(e=>{for(let t of e)if("childList"===t.type&&0!==t.addedNodes.length&&![...r,...n].some(e=>e.contains(t.target))){for(let e of t.removedNodes)e instanceof Element&&(r.delete(e),n.delete(e));for(let e of t.addedNodes)(e instanceof HTMLElement||e instanceof SVGElement)&&("true"===e.dataset.liveAnnouncer||"true"===e.dataset.reactAriaTopLayer)?r.add(e):e instanceof Element&&i(e)}});l.observe(t,{childList:!0,subtree:!0});let a={observe(){l.observe(t,{childList:!0,subtree:!0})},disconnect(){l.disconnect()}};return rR.push(a),()=>{for(let e of(l.disconnect(),n)){let t=rG.get(e);if(null==t)return;1===t?(e.removeAttribute("aria-hidden"),rG.delete(e)):rG.set(e,t-1)}a===rR[rR.length-1]?(rR.pop(),rR.length&&rR[rR.length-1].observe()):rR.splice(rR.indexOf(a),1)}}(c(t.targets),c(t.root)))}),(0,l.GW)(()=>{let e=w();if(!e||!i)return;let t=i.registerNestedMenu(e);(0,l.$W)(()=>{t()})}),(0,l.GW)(()=>{void 0===i&&o?.registerMenu(r.value(),[w(),...L()])}),(0,l.GW)(()=>{void 0===i&&void 0!==o&&(o.value()===r.value()?(m()?.focus(),o.autoFocusMenu()&&z(!0)):O())}),(0,l.GW)(()=>{void 0===i&&void 0!==o&&F.isOpen()&&o.setValue(r.value())}),(0,l.$W)(()=>{void 0===i&&o?.unregisterMenu(r.value())});let R={dataset:(0,l.dD)(()=>({"data-expanded":F.isOpen()?"":void 0,"data-closed":F.isOpen()?void 0:""})),isOpen:F.isOpen,contentPresent:P,nestedMenus:L,currentPlacement:S,pointerGraceTimeoutId:()=>g,autoFocus:k,listState:()=>A,parentMenuContext:()=>i,triggerRef:m,contentRef:w,triggerId:h,contentId:v,setTriggerRef:x,setContentRef:$,open:z,close:O,toggle:e=>{M(e),F.toggle()},focusContent:K,onItemEnter:e=>{G(e)&&e.preventDefault()},onItemLeave:e=>{G(e)||K()},onTriggerLeave:e=>{G(e)&&e.preventDefault()},setPointerDir:e=>p=e,setPointerGraceTimeoutId:e=>g=e,setPointerGraceIntent:e=>f=e,registerNestedMenu:e=>{q(t=>[...t,e]);let t=i?.registerNestedMenu(e);return()=>{q(t=>ei(t,e)),t?.()}},registerItemToParentDomCollection:n?.registerItem,registerTriggerId:eA(y),registerContentId:eA(b)};return(0,l.LM)(D,{get children(){return(0,l.LM)(r0.Provider,{value:R,get children(){return(0,l.LM)(l.di,{when:void 0===a,get fallback(){return u.children},get children(){return(0,l.LM)(rp,(0,l.dG)({anchorRef:m,contentRef:w,onCurrentPlacementChange:C},u))}})}})}})}function nm(e){let{direction:t}=e5();return(0,l.LM)(nb,(0,l.dG)({get placement(){return"rtl"===t()?"left-start":"right-start"},flip:!0},e))}var nx=(e,t)=>"ltr"===e?["horizontal"===t?"ArrowLeft":"ArrowUp"]:["horizontal"===t?"ArrowRight":"ArrowDown"];function nw(e){let t=r1(),r=r4(),[n,i]=(0,l.eY)(e,["onFocusOutside","onKeyDown"]),{direction:o}=e5();return(0,l.LM)(ni,(0,l.dG)({onOpenAutoFocus:e=>{e.preventDefault()},onCloseAutoFocus:e=>{e.preventDefault()},onFocusOutside:e=>{n.onFocusOutside?.(e);let r=e.target;ea(t.triggerRef(),r)||t.close()},onKeyDown:e=>{ep(e,n.onKeyDown);let i=ea(e.currentTarget,e.target),l=nx(o(),r.orientation()).includes(e.key),a=null!=t.parentMenuContext();i&&l&&a&&(t.close(),ey(t.triggerRef()))}},i))}var n$=["Enter"," "],nk=(e,t)=>"ltr"===e?[...n$,"horizontal"===t?"ArrowRight":"ArrowDown"]:[...n$,"horizontal"===t?"ArrowLeft":"ArrowUp"];function nM(e){let t;let r=r4(),n=r1(),i=eL({id:r.generateId(`sub-trigger-${(0,l.g4)()}`)},e),[o,a]=(0,l.eY)(i,["ref","id","textValue","disabled","onPointerMove","onPointerLeave","onPointerDown","onPointerUp","onClick","onKeyDown","onMouseDown","onFocus"]),s=null,d=()=>{l.sk||(s&&window.clearTimeout(s),s=null)},{direction:u}=e5(),c=()=>o.id,g=()=>{let e=n.parentMenuContext();if(null==e)throw Error("[kobalte]: `Menu.SubTrigger` must be used within a `Menu.Sub` component");return e.listState().selectionManager()},f=()=>n.listState().collection(),p=()=>g().focusedKey()===c(),h=e7({key:c,selectionManager:g,shouldSelectOnPressUp:!0,allowsDifferentPressOrigin:!0,disabled:()=>o.disabled},()=>t),y=e=>{ep(e,o.onClick),n.isOpen()||o.disabled||n.open(!0)},v=e=>{ep(e,o.onKeyDown),!e.repeat&&!o.disabled&&nk(u(),r.orientation()).includes(e.key)&&(e.stopPropagation(),e.preventDefault(),g().setFocused(!1),g().setFocusedKey(void 0),n.isOpen()||n.open("first"),n.focusContent(),n.listState().selectionManager().setFocused(!0),n.listState().selectionManager().setFocusedKey(f().getFirstKey()))};return(0,l.GW)(()=>{if(null==n.registerItemToParentDomCollection)throw Error("[kobalte]: `Menu.SubTrigger` must be used within a `Menu.Sub` component");let e=n.registerItemToParentDomCollection({ref:()=>t,type:"item",key:c(),textValue:o.textValue??t?.textContent??"",disabled:o.disabled??!1});(0,l.$W)(e)}),(0,l.GW)((0,l.on)(()=>n.parentMenuContext()?.pointerGraceTimeoutId(),e=>{(0,l.$W)(()=>{window.clearTimeout(e),n.parentMenuContext()?.setPointerGraceIntent(null)})})),(0,l.GW)(()=>(0,l.$W)(n.registerTriggerId(o.id))),(0,l.$W)(()=>{d()}),(0,l.LM)(eI,(0,l.dG)({as:"div",ref(e){let r=N(e=>{n.setTriggerRef(e),t=e},o.ref);"function"==typeof r&&r(e)},get id(){return o.id},role:"menuitem",get tabIndex(){return h.tabIndex()},"aria-haspopup":"true",get"aria-expanded"(){return n.isOpen()},get"aria-controls"(){return(0,l.dD)(()=>!!n.isOpen())()?n.contentId():void 0},get"aria-disabled"(){return o.disabled},get"data-key"(){return h.dataKey()},get"data-highlighted"(){return p()?"":void 0},get"data-disabled"(){return o.disabled?"":void 0},get onPointerDown(){return eh([o.onPointerDown,h.onPointerDown])},get onPointerUp(){return eh([o.onPointerUp,h.onPointerUp])},get onClick(){return eh([y,h.onClick])},get onKeyDown(){return eh([v,h.onKeyDown])},get onMouseDown(){return eh([o.onMouseDown,h.onMouseDown])},get onFocus(){return eh([o.onFocus,h.onFocus])},onPointerMove:e=>{if(ep(e,o.onPointerMove),"mouse"!==e.pointerType)return;let t=n.parentMenuContext();if(t?.onItemEnter(e),!e.defaultPrevented){if(o.disabled){t?.onItemLeave(e);return}n.isOpen()||s||(n.parentMenuContext()?.setPointerGraceIntent(null),s=window.setTimeout(()=>{n.open(!1),d()},100)),t?.onItemEnter(e),e.defaultPrevented||(n.listState().selectionManager().isFocused()&&(n.listState().selectionManager().setFocused(!1),n.listState().selectionManager().setFocusedKey(void 0)),ey(e.currentTarget),t?.listState().selectionManager().setFocused(!0),t?.listState().selectionManager().setFocusedKey(c()))}},onPointerLeave:e=>{if(ep(e,o.onPointerLeave),"mouse"!==e.pointerType)return;d();let t=n.parentMenuContext(),r=n.contentRef();if(r){t?.setPointerGraceIntent({area:function(e,t,r){let n=e.split("-")[0],i=r.getBoundingClientRect(),o=[],l=t.clientX,a=t.clientY;switch(n){case"top":o.push([l,a+5]),o.push([i.left,i.bottom]),o.push([i.left,i.top]),o.push([i.right,i.top]),o.push([i.right,i.bottom]);break;case"right":o.push([l-5,a]),o.push([i.left,i.top]),o.push([i.right,i.top]),o.push([i.right,i.bottom]),o.push([i.left,i.bottom]);break;case"bottom":o.push([l,a-5]),o.push([i.right,i.top]),o.push([i.right,i.bottom]),o.push([i.left,i.bottom]),o.push([i.left,i.top]);break;case"left":o.push([l+5,a]),o.push([i.right,i.bottom]),o.push([i.left,i.bottom]),o.push([i.left,i.top]),o.push([i.right,i.top])}return o}(n.currentPlacement(),e,r),side:n.currentPlacement().split("-")[0]}),window.clearTimeout(t?.pointerGraceTimeoutId());let i=window.setTimeout(()=>{t?.setPointerGraceIntent(null)},300);t?.setPointerGraceTimeoutId(i)}else{if(t?.onTriggerLeave(e),e.defaultPrevented)return;t?.setPointerGraceIntent(null)}t?.onItemLeave(e)}},()=>n.dataset(),a))}function nS(e){let t=r7(),r=eL({id:`menu-${(0,l.g4)()}`,modal:!0},e),[n,i]=(0,l.eY)(r,["id","modal","preventScroll","forceMount","open","defaultOpen","onOpenChange","value","orientation"]),o=rm({open:()=>n.open,defaultOpen:()=>n.defaultOpen,onOpenChange:e=>n.onOpenChange?.(e)}),a={isModal:()=>n.modal??!0,preventScroll:()=>n.preventScroll??a.isModal(),forceMount:()=>n.forceMount??!1,generateId:el(()=>n.id),value:()=>n.value,orientation:()=>n.orientation??t?.orientation()??"horizontal"};return(0,l.LM)(r5.Provider,{value:a,get children(){return(0,l.LM)(nb,(0,l.dG)({get open(){return o.isOpen()},get onOpenChange(){return o.setIsOpen}},i))}})}function nC(e){let t;let r=eL({orientation:"horizontal"},e),[n,i]=(0,l.eY)(r,["ref","orientation"]),o=ez(()=>t,()=>"hr");return(0,l.LM)(eI,(0,l.dG)({as:"hr",ref(e){let r=N(e=>t=e,n.ref);"function"==typeof r&&r(e)},get role(){return"hr"!==o()?"separator":void 0},get"aria-orientation"(){return"vertical"===n.orientation?"vertical":void 0},get"data-orientation"(){return n.orientation}},i))}eN({},{Root:()=>nC,Separator:()=>nL});var nL=nC,nq={};function nT(e){let t=r4(),r=r1(),[n,i]=(0,l.eY)(e,["onCloseAutoFocus","onInteractOutside"]),o=!1;return(0,l.LM)(no,(0,l.dG)({onCloseAutoFocus:e=>{n.onCloseAutoFocus?.(e),o||ey(r.triggerRef()),o=!1,e.preventDefault()},onInteractOutside:e=>{n.onInteractOutside?.(e),(!t.isModal()||e.detail.isContextMenu)&&(o=!0)}},i))}function nE(e){let t=eL({id:`dropdownmenu-${(0,l.g4)()}`},e);return(0,l.LM)(nS,t)}eN(nq,{Arrow:()=>ru,CheckboxItem:()=>r9,Content:()=>nT,DropdownMenu:()=>nD,Group:()=>na,GroupLabel:()=>ns,Icon:()=>nd,Item:()=>nu,ItemDescription:()=>nc,ItemIndicator:()=>ng,ItemLabel:()=>nf,Portal:()=>np,RadioGroup:()=>ny,RadioItem:()=>nv,Root:()=>nE,Separator:()=>nC,Sub:()=>nm,SubContent:()=>nw,SubTrigger:()=>nM,Trigger:()=>nr});var nD=Object.assign(nE,{Arrow:ru,CheckboxItem:r9,Content:nT,Group:na,GroupLabel:ns,Icon:nd,Item:nu,ItemDescription:nc,ItemIndicator:ng,ItemLabel:nf,Portal:np,RadioGroup:ny,RadioItem:nv,Separator:nC,Sub:nm,SubContent:nw,SubTrigger:nM,Trigger:nr}),nF={colors:{inherit:"inherit",current:"currentColor",transparent:"transparent",black:"#000000",white:"#ffffff",neutral:{50:"#f9fafb",100:"#f2f4f7",200:"#eaecf0",300:"#d0d5dd",400:"#98a2b3",500:"#667085",600:"#475467",700:"#344054",800:"#1d2939",900:"#101828"},darkGray:{50:"#525c7a",100:"#49536e",200:"#414962",300:"#394056",400:"#313749",500:"#292e3d",600:"#212530",700:"#191c24",800:"#111318",900:"#0b0d10"},gray:{50:"#f9fafb",100:"#f2f4f7",200:"#eaecf0",300:"#d0d5dd",400:"#98a2b3",500:"#667085",600:"#475467",700:"#344054",800:"#1d2939",900:"#101828"},blue:{25:"#F5FAFF",50:"#EFF8FF",100:"#D1E9FF",200:"#B2DDFF",300:"#84CAFF",400:"#53B1FD",500:"#2E90FA",600:"#1570EF",700:"#175CD3",800:"#1849A9",900:"#194185"},green:{25:"#F6FEF9",50:"#ECFDF3",100:"#D1FADF",200:"#A6F4C5",300:"#6CE9A6",400:"#32D583",500:"#12B76A",600:"#039855",700:"#027A48",800:"#05603A",900:"#054F31"},red:{50:"#fef2f2",100:"#fee2e2",200:"#fecaca",300:"#fca5a5",400:"#f87171",500:"#ef4444",600:"#dc2626",700:"#b91c1c",800:"#991b1b",900:"#7f1d1d",950:"#450a0a"},yellow:{25:"#FFFCF5",50:"#FFFAEB",100:"#FEF0C7",200:"#FEDF89",300:"#FEC84B",400:"#FDB022",500:"#F79009",600:"#DC6803",700:"#B54708",800:"#93370D",900:"#7A2E0E"},purple:{25:"#FAFAFF",50:"#F4F3FF",100:"#EBE9FE",200:"#D9D6FE",300:"#BDB4FE",400:"#9B8AFB",500:"#7A5AF8",600:"#6938EF",700:"#5925DC",800:"#4A1FB8",900:"#3E1C96"},teal:{25:"#F6FEFC",50:"#F0FDF9",100:"#CCFBEF",200:"#99F6E0",300:"#5FE9D0",400:"#2ED3B7",500:"#15B79E",600:"#0E9384",700:"#107569",800:"#125D56",900:"#134E48"},pink:{25:"#fdf2f8",50:"#fce7f3",100:"#fbcfe8",200:"#f9a8d4",300:"#f472b6",400:"#ec4899",500:"#db2777",600:"#be185d",700:"#9d174d",800:"#831843",900:"#500724"},cyan:{25:"#ecfeff",50:"#cffafe",100:"#a5f3fc",200:"#67e8f9",300:"#22d3ee",400:"#06b6d4",500:"#0891b2",600:"#0e7490",700:"#155e75",800:"#164e63",900:"#083344"}},alpha:{100:"ff",90:"e5",80:"cc",70:"b3",60:"99",50:"80",40:"66",30:"4d",20:"33",10:"1a",0:"00"},font:{size:{"2xs":"calc(var(--tsqd-font-size) * 0.625)",xs:"calc(var(--tsqd-font-size) * 0.75)",sm:"calc(var(--tsqd-font-size) * 0.875)",md:"var(--tsqd-font-size)",lg:"calc(var(--tsqd-font-size) * 1.125)",xl:"calc(var(--tsqd-font-size) * 1.25)","2xl":"calc(var(--tsqd-font-size) * 1.5)","3xl":"calc(var(--tsqd-font-size) * 1.875)","4xl":"calc(var(--tsqd-font-size) * 2.25)","5xl":"calc(var(--tsqd-font-size) * 3)","6xl":"calc(var(--tsqd-font-size) * 3.75)","7xl":"calc(var(--tsqd-font-size) * 4.5)","8xl":"calc(var(--tsqd-font-size) * 6)","9xl":"calc(var(--tsqd-font-size) * 8)"},lineHeight:{xs:"calc(var(--tsqd-font-size) * 1)",sm:"calc(var(--tsqd-font-size) * 1.25)",md:"calc(var(--tsqd-font-size) * 1.5)",lg:"calc(var(--tsqd-font-size) * 1.75)",xl:"calc(var(--tsqd-font-size) * 2)","2xl":"calc(var(--tsqd-font-size) * 2.25)","3xl":"calc(var(--tsqd-font-size) * 2.5)","4xl":"calc(var(--tsqd-font-size) * 2.75)","5xl":"calc(var(--tsqd-font-size) * 3)","6xl":"calc(var(--tsqd-font-size) * 3.25)","7xl":"calc(var(--tsqd-font-size) * 3.5)","8xl":"calc(var(--tsqd-font-size) * 3.75)","9xl":"calc(var(--tsqd-font-size) * 4)"},weight:{thin:"100",extralight:"200",light:"300",normal:"400",medium:"500",semibold:"600",bold:"700",extrabold:"800",black:"900"}},breakpoints:{xs:"320px",sm:"640px",md:"768px",lg:"1024px",xl:"1280px","2xl":"1536px"},border:{radius:{none:"0px",xs:"calc(var(--tsqd-font-size) * 0.125)",sm:"calc(var(--tsqd-font-size) * 0.25)",md:"calc(var(--tsqd-font-size) * 0.375)",lg:"calc(var(--tsqd-font-size) * 0.5)",xl:"calc(var(--tsqd-font-size) * 0.75)","2xl":"calc(var(--tsqd-font-size) * 1)","3xl":"calc(var(--tsqd-font-size) * 1.5)",full:"9999px"}},size:{0:"0px",.25:"calc(var(--tsqd-font-size) * 0.0625)",.5:"calc(var(--tsqd-font-size) * 0.125)",1:"calc(var(--tsqd-font-size) * 0.25)",1.5:"calc(var(--tsqd-font-size) * 0.375)",2:"calc(var(--tsqd-font-size) * 0.5)",2.5:"calc(var(--tsqd-font-size) * 0.625)",3:"calc(var(--tsqd-font-size) * 0.75)",3.5:"calc(var(--tsqd-font-size) * 0.875)",4:"calc(var(--tsqd-font-size) * 1)",4.5:"calc(var(--tsqd-font-size) * 1.125)",5:"calc(var(--tsqd-font-size) * 1.25)",5.5:"calc(var(--tsqd-font-size) * 1.375)",6:"calc(var(--tsqd-font-size) * 1.5)",6.5:"calc(var(--tsqd-font-size) * 1.625)",7:"calc(var(--tsqd-font-size) * 1.75)",8:"calc(var(--tsqd-font-size) * 2)",9:"calc(var(--tsqd-font-size) * 2.25)",10:"calc(var(--tsqd-font-size) * 2.5)",11:"calc(var(--tsqd-font-size) * 2.75)",12:"calc(var(--tsqd-font-size) * 3)",14:"calc(var(--tsqd-font-size) * 3.5)",16:"calc(var(--tsqd-font-size) * 4)",20:"calc(var(--tsqd-font-size) * 5)",24:"calc(var(--tsqd-font-size) * 6)",28:"calc(var(--tsqd-font-size) * 7)",32:"calc(var(--tsqd-font-size) * 8)",36:"calc(var(--tsqd-font-size) * 9)",40:"calc(var(--tsqd-font-size) * 10)",44:"calc(var(--tsqd-font-size) * 11)",48:"calc(var(--tsqd-font-size) * 12)",52:"calc(var(--tsqd-font-size) * 13)",56:"calc(var(--tsqd-font-size) * 14)",60:"calc(var(--tsqd-font-size) * 15)",64:"calc(var(--tsqd-font-size) * 16)",72:"calc(var(--tsqd-font-size) * 18)",80:"calc(var(--tsqd-font-size) * 20)",96:"calc(var(--tsqd-font-size) * 24)"},shadow:{xs:(e="rgb(0 0 0 / 0.1)")=>"0 1px 2px 0 rgb(0 0 0 / 0.05)",sm:(e="rgb(0 0 0 / 0.1)")=>`0 1px 3px 0 ${e}, 0 1px 2px -1px ${e}`,md:(e="rgb(0 0 0 / 0.1)")=>`0 4px 6px -1px ${e}, 0 2px 4px -2px ${e}`,lg:(e="rgb(0 0 0 / 0.1)")=>`0 10px 15px -3px ${e}, 0 4px 6px -4px ${e}`,xl:(e="rgb(0 0 0 / 0.1)")=>`0 20px 25px -5px ${e}, 0 8px 10px -6px ${e}`,"2xl":(e="rgb(0 0 0 / 0.25)")=>`0 25px 50px -12px ${e}`,inner:(e="rgb(0 0 0 / 0.05)")=>`inset 0 2px 4px 0 ${e}`,none:()=>"none"},zIndices:{hide:-1,auto:"auto",base:0,docked:10,dropdown:1e3,sticky:1100,banner:1200,overlay:1300,modal:1400,popover:1500,skipLink:1600,toast:1700,tooltip:1800}},nP=(0,l.XK)('<svg width=14 height=14 viewBox="0 0 14 14"fill=none xmlns=http://www.w3.org/2000/svg><path d="M13 13L9.00007 9M10.3333 5.66667C10.3333 8.244 8.244 10.3333 5.66667 10.3333C3.08934 10.3333 1 8.244 1 5.66667C1 3.08934 3.08934 1 5.66667 1C8.244 1 10.3333 3.08934 10.3333 5.66667Z"stroke=currentColor stroke-width=1.66667 stroke-linecap=round stroke-linejoin=round>'),nA=(0,l.XK)('<svg width=24 height=24 viewBox="0 0 24 24"fill=none xmlns=http://www.w3.org/2000/svg><path d="M9 3H15M3 6H21M19 6L18.2987 16.5193C18.1935 18.0975 18.1409 18.8867 17.8 19.485C17.4999 20.0118 17.0472 20.4353 16.5017 20.6997C15.882 21 15.0911 21 13.5093 21H10.4907C8.90891 21 8.11803 21 7.49834 20.6997C6.95276 20.4353 6.50009 20.0118 6.19998 19.485C5.85911 18.8867 5.8065 18.0975 5.70129 16.5193L5 6M10 10.5V15.5M14 10.5V15.5"stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round>'),nz=(0,l.XK)('<svg width=10 height=6 viewBox="0 0 10 6"fill=none xmlns=http://www.w3.org/2000/svg><path d="M1 1L5 5L9 1"stroke=currentColor stroke-width=1.66667 stroke-linecap=round stroke-linejoin=round>'),nO=(0,l.XK)('<svg width=12 height=12 viewBox="0 0 16 16"fill=none xmlns=http://www.w3.org/2000/svg><path d="M8 13.3333V2.66667M8 2.66667L4 6.66667M8 2.66667L12 6.66667"stroke=currentColor stroke-width=1.66667 stroke-linecap=round stroke-linejoin=round>'),nI=(0,l.XK)('<svg width=12 height=12 viewBox="0 0 16 16"fill=none xmlns=http://www.w3.org/2000/svg><path d="M8 2.66667V13.3333M8 13.3333L4 9.33333M8 13.3333L12 9.33333"stroke=currentColor stroke-width=1.66667 stroke-linecap=round stroke-linejoin=round>'),nK=(0,l.XK)('<svg viewBox="0 0 24 24"height=12 width=12 fill=none xmlns=http://www.w3.org/2000/svg><path d="M12 2v2m0 16v2M4 12H2m4.314-5.686L4.9 4.9m12.786 1.414L19.1 4.9M6.314 17.69 4.9 19.104m12.786-1.414 1.414 1.414M22 12h-2m-3 0a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z"stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round>'),nG=(0,l.XK)('<svg viewBox="0 0 24 24"height=12 width=12 fill=none xmlns=http://www.w3.org/2000/svg><path d="M22 15.844a10.424 10.424 0 0 1-4.306.925c-5.779 0-10.463-4.684-10.463-10.462 0-1.536.33-2.994.925-4.307A10.464 10.464 0 0 0 2 11.538C2 17.316 6.684 22 12.462 22c4.243 0 7.896-2.526 9.538-6.156Z"stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round>'),nR=(0,l.XK)('<svg viewBox="0 0 24 24"height=12 width=12 fill=none xmlns=http://www.w3.org/2000/svg><path d="M8 21h8m-4-4v4m-5.2-4h10.4c1.68 0 2.52 0 3.162-.327a3 3 0 0 0 1.311-1.311C22 14.72 22 13.88 22 12.2V7.8c0-1.68 0-2.52-.327-3.162a3 3 0 0 0-1.311-1.311C19.72 3 18.88 3 17.2 3H6.8c-1.68 0-2.52 0-3.162.327a3 3 0 0 0-1.311 1.311C2 5.28 2 6.12 2 7.8v4.4c0 1.68 0 2.52.327 3.162a3 3 0 0 0 1.311 1.311C4.28 17 5.12 17 6.8 17Z"stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round>'),nB=(0,l.XK)('<svg stroke=currentColor fill=currentColor stroke-width=0 viewBox="0 0 24 24"height=1em width=1em xmlns=http://www.w3.org/2000/svg><path fill=none d="M0 0h24v24H0z"></path><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3a4.237 4.237 0 00-6 0zm-4-4l2 2a7.074 7.074 0 0110 0l2-2C15.14 9.14 8.87 9.14 5 13z">'),nH=(0,l.XK)('<svg stroke-width=0 viewBox="0 0 24 24"height=1em width=1em xmlns=http://www.w3.org/2000/svg><path fill=none d="M24 .01c0-.01 0-.01 0 0L0 0v24h24V.01zM0 0h24v24H0V0zm0 0h24v24H0V0z"></path><path d="M22.99 9C19.15 5.16 13.8 3.76 8.84 4.78l2.52 2.52c3.47-.17 6.99 1.05 9.63 3.7l2-2zm-4 4a9.793 9.793 0 00-4.49-2.56l3.53 3.53.96-.97zM2 3.05L5.07 6.1C3.6 6.82 2.22 7.78 1 9l1.99 2c1.24-1.24 2.67-2.16 4.2-2.77l2.24 2.24A9.684 9.684 0 005 13v.01L6.99 15a7.042 7.042 0 014.92-2.06L18.98 20l1.27-1.26L3.29 1.79 2 3.05zM9 17l3 3 3-3a4.237 4.237 0 00-6 0z">'),nW=(0,l.XK)('<svg width=24 height=24 viewBox="0 0 24 24"fill=none xmlns=http://www.w3.org/2000/svg><path d="M9.3951 19.3711L9.97955 20.6856C10.1533 21.0768 10.4368 21.4093 10.7958 21.6426C11.1547 21.8759 11.5737 22.0001 12.0018 22C12.4299 22.0001 12.8488 21.8759 13.2078 21.6426C13.5667 21.4093 13.8503 21.0768 14.024 20.6856L14.6084 19.3711C14.8165 18.9047 15.1664 18.5159 15.6084 18.26C16.0532 18.0034 16.5678 17.8941 17.0784 17.9478L18.5084 18.1C18.9341 18.145 19.3637 18.0656 19.7451 17.8713C20.1265 17.6771 20.4434 17.3763 20.6573 17.0056C20.8715 16.635 20.9735 16.2103 20.9511 15.7829C20.9286 15.3555 20.7825 14.9438 20.5307 14.5978L19.684 13.4344C19.3825 13.0171 19.2214 12.5148 19.224 12C19.2239 11.4866 19.3865 10.9864 19.6884 10.5711L20.5351 9.40778C20.787 9.06175 20.933 8.65007 20.9555 8.22267C20.978 7.79528 20.8759 7.37054 20.6618 7C20.4479 6.62923 20.131 6.32849 19.7496 6.13423C19.3681 5.93997 18.9386 5.86053 18.5129 5.90556L17.0829 6.05778C16.5722 6.11141 16.0577 6.00212 15.6129 5.74556C15.17 5.48825 14.82 5.09736 14.6129 4.62889L14.024 3.31444C13.8503 2.92317 13.5667 2.59072 13.2078 2.3574C12.8488 2.12408 12.4299 1.99993 12.0018 2C11.5737 1.99993 11.1547 2.12408 10.7958 2.3574C10.4368 2.59072 10.1533 2.92317 9.97955 3.31444L9.3951 4.62889C9.18803 5.09736 8.83798 5.48825 8.3951 5.74556C7.95032 6.00212 7.43577 6.11141 6.9251 6.05778L5.49066 5.90556C5.06499 5.86053 4.6354 5.93997 4.25397 6.13423C3.87255 6.32849 3.55567 6.62923 3.34177 7C3.12759 7.37054 3.02555 7.79528 3.04804 8.22267C3.07052 8.65007 3.21656 9.06175 3.46844 9.40778L4.3151 10.5711C4.61704 10.9864 4.77964 11.4866 4.77955 12C4.77964 12.5134 4.61704 13.0137 4.3151 13.4289L3.46844 14.5922C3.21656 14.9382 3.07052 15.3499 3.04804 15.7773C3.02555 16.2047 3.12759 16.6295 3.34177 17C3.55589 17.3706 3.8728 17.6712 4.25417 17.8654C4.63554 18.0596 5.06502 18.1392 5.49066 18.0944L6.92066 17.9422C7.43133 17.8886 7.94587 17.9979 8.39066 18.2544C8.83519 18.511 9.18687 18.902 9.3951 19.3711Z"stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round></path><path d="M12 15C13.6568 15 15 13.6569 15 12C15 10.3431 13.6568 9 12 9C10.3431 9 8.99998 10.3431 8.99998 12C8.99998 13.6569 10.3431 15 12 15Z"stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round>'),nU=(0,l.XK)('<svg width=24 height=24 viewBox="0 0 24 24"fill=none xmlns=http://www.w3.org/2000/svg><path d="M16 21H16.2C17.8802 21 18.7202 21 19.362 20.673C19.9265 20.3854 20.3854 19.9265 20.673 19.362C21 18.7202 21 17.8802 21 16.2V7.8C21 6.11984 21 5.27976 20.673 4.63803C20.3854 4.07354 19.9265 3.6146 19.362 3.32698C18.7202 3 17.8802 3 16.2 3H7.8C6.11984 3 5.27976 3 4.63803 3.32698C4.07354 3.6146 3.6146 4.07354 3.32698 4.63803C3 5.27976 3 6.11984 3 7.8V8M11.5 12.5L17 7M17 7H12M17 7V12M6.2 21H8.8C9.9201 21 10.4802 21 10.908 20.782C11.2843 20.5903 11.5903 20.2843 11.782 19.908C12 19.4802 12 18.9201 12 17.8V15.2C12 14.0799 12 13.5198 11.782 13.092C11.5903 12.7157 11.2843 12.4097 10.908 12.218C10.4802 12 9.92011 12 8.8 12H6.2C5.0799 12 4.51984 12 4.09202 12.218C3.71569 12.4097 3.40973 12.7157 3.21799 13.092C3 13.5198 3 14.0799 3 15.2V17.8C3 18.9201 3 19.4802 3.21799 19.908C3.40973 20.2843 3.71569 20.5903 4.09202 20.782C4.51984 21 5.07989 21 6.2 21Z"stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round>'),nV=(0,l.XK)('<svg width=24 height=24 viewBox="0 0 24 24"fill=none xmlns=http://www.w3.org/2000/svg><path class=copier d="M8 8V5.2C8 4.0799 8 3.51984 8.21799 3.09202C8.40973 2.71569 8.71569 2.40973 9.09202 2.21799C9.51984 2 10.0799 2 11.2 2H18.8C19.9201 2 20.4802 2 20.908 2.21799C21.2843 2.40973 21.5903 2.71569 21.782 3.09202C22 3.51984 22 4.0799 22 5.2V12.8C22 13.9201 22 14.4802 21.782 14.908C21.5903 15.2843 21.2843 15.5903 20.908 15.782C20.4802 16 19.9201 16 18.8 16H16M5.2 22H12.8C13.9201 22 14.4802 22 14.908 21.782C15.2843 21.5903 15.5903 21.2843 15.782 20.908C16 20.4802 16 19.9201 16 18.8V11.2C16 10.0799 16 9.51984 15.782 9.09202C15.5903 8.71569 15.2843 8.40973 14.908 8.21799C14.4802 8 13.9201 8 12.8 8H5.2C4.0799 8 3.51984 8 3.09202 8.21799C2.71569 8.40973 2.40973 8.71569 2.21799 9.09202C2 9.51984 2 10.0799 2 11.2V18.8C2 19.9201 2 20.4802 2.21799 20.908C2.40973 21.2843 2.71569 21.5903 3.09202 21.782C3.51984 22 4.07989 22 5.2 22Z"stroke-width=2 stroke-linecap=round stroke-linejoin=round stroke=currentColor>'),nQ=(0,l.XK)('<svg width=24 height=24 viewBox="0 0 24 24"fill=none xmlns=http://www.w3.org/2000/svg><path d="M2.5 21.4998L8.04927 19.3655C8.40421 19.229 8.58168 19.1607 8.74772 19.0716C8.8952 18.9924 9.0358 18.901 9.16804 18.7984C9.31692 18.6829 9.45137 18.5484 9.72028 18.2795L21 6.99982C22.1046 5.89525 22.1046 4.10438 21 2.99981C19.8955 1.89525 18.1046 1.89524 17 2.99981L5.72028 14.2795C5.45138 14.5484 5.31692 14.6829 5.20139 14.8318C5.09877 14.964 5.0074 15.1046 4.92823 15.2521C4.83911 15.4181 4.77085 15.5956 4.63433 15.9506L2.5 21.4998ZM2.5 21.4998L4.55812 16.1488C4.7054 15.7659 4.77903 15.5744 4.90534 15.4867C5.01572 15.4101 5.1523 15.3811 5.2843 15.4063C5.43533 15.4351 5.58038 15.5802 5.87048 15.8703L8.12957 18.1294C8.41967 18.4195 8.56472 18.5645 8.59356 18.7155C8.61877 18.8475 8.58979 18.9841 8.51314 19.0945C8.42545 19.2208 8.23399 19.2944 7.85107 19.4417L2.5 21.4998Z"stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round>'),nN=(0,l.XK)('<svg width=24 height=24 viewBox="0 0 24 24"fill=none xmlns=http://www.w3.org/2000/svg><path d="M7.5 12L10.5 15L16.5 9M7.8 21H16.2C17.8802 21 18.7202 21 19.362 20.673C19.9265 20.3854 20.3854 19.9265 20.673 19.362C21 18.7202 21 17.8802 21 16.2V7.8C21 6.11984 21 5.27976 20.673 4.63803C20.3854 4.07354 19.9265 3.6146 19.362 3.32698C18.7202 3 17.8802 3 16.2 3H7.8C6.11984 3 5.27976 3 4.63803 3.32698C4.07354 3.6146 3.6146 4.07354 3.32698 4.63803C3 5.27976 3 6.11984 3 7.8V16.2C3 17.8802 3 18.7202 3.32698 19.362C3.6146 19.9265 4.07354 20.3854 4.63803 20.673C5.27976 21 6.11984 21 7.8 21Z"stroke-width=2 stroke-linecap=round stroke-linejoin=round>'),nj=(0,l.XK)('<svg width=24 height=24 viewBox="0 0 24 24"fill=none xmlns=http://www.w3.org/2000/svg><path d="M9 9L15 15M15 9L9 15M7.8 21H16.2C17.8802 21 18.7202 21 19.362 20.673C19.9265 20.3854 20.3854 19.9265 20.673 19.362C21 18.7202 21 17.8802 21 16.2V7.8C21 6.11984 21 5.27976 20.673 4.63803C20.3854 4.07354 19.9265 3.6146 19.362 3.32698C18.7202 3 17.8802 3 16.2 3H7.8C6.11984 3 5.27976 3 4.63803 3.32698C4.07354 3.6146 3.6146 4.07354 3.32698 4.63803C3 5.27976 3 6.11984 3 7.8V16.2C3 17.8802 3 18.7202 3.32698 19.362C3.6146 19.9265 4.07354 20.3854 4.63803 20.673C5.27976 21 6.11984 21 7.8 21Z"stroke=#F04438 stroke-width=2 stroke-linecap=round stroke-linejoin=round>'),nX=(0,l.XK)('<svg width=24 height=24 viewBox="0 0 24 24"fill=none stroke=currentColor stroke-width=2 xmlns=http://www.w3.org/2000/svg><rect class=list width=20 height=20 y=2 x=2 rx=2></rect><line class=list-item y1=7 y2=7 x1=6 x2=18></line><line class=list-item y2=12 y1=12 x1=6 x2=18></line><line class=list-item y1=17 y2=17 x1=6 x2=18>'),n_=(0,l.XK)('<svg viewBox="0 0 24 24"height=20 width=20 fill=none xmlns=http://www.w3.org/2000/svg><path d="M3 7.8c0-1.68 0-2.52.327-3.162a3 3 0 0 1 1.311-1.311C5.28 3 6.12 3 7.8 3h8.4c1.68 0 2.52 0 3.162.327a3 3 0 0 1 1.311 1.311C21 5.28 21 6.12 21 7.8v8.4c0 1.68 0 2.52-.327 3.162a3 3 0 0 1-1.311 1.311C18.72 21 17.88 21 16.2 21H7.8c-1.68 0-2.52 0-3.162-.327a3 3 0 0 1-1.311-1.311C3 18.72 3 17.88 3 16.2V7.8Z"stroke-width=2 stroke-linecap=round stroke-linejoin=round>'),nY=(0,l.XK)('<svg width=14 height=14 viewBox="0 0 24 24"fill=none xmlns=http://www.w3.org/2000/svg><path d="M7.5 12L10.5 15L16.5 9M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z"stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round>'),nZ=(0,l.XK)('<svg width=14 height=14 viewBox="0 0 24 24"fill=none xmlns=http://www.w3.org/2000/svg><path d="M12 2V6M12 18V22M6 12H2M22 12H18M19.0784 19.0784L16.25 16.25M19.0784 4.99994L16.25 7.82837M4.92157 19.0784L7.75 16.25M4.92157 4.99994L7.75 7.82837"stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round></path><animateTransform attributeName=transform attributeType=XML type=rotate from=0 to=360 dur=2s repeatCount=indefinite>'),nJ=(0,l.XK)('<svg width=14 height=14 viewBox="0 0 24 24"fill=none xmlns=http://www.w3.org/2000/svg><path d="M15 9L9 15M9 9L15 15M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z"stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round>'),n0=(0,l.XK)('<svg width=14 height=14 viewBox="0 0 24 24"fill=none xmlns=http://www.w3.org/2000/svg><path d="M9.5 15V9M14.5 15V9M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z"stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round>'),n1=(0,l.XK)('<svg version=1.0 viewBox="0 0 633 633"><linearGradient x1=-666.45 x2=-666.45 y1=163.28 y2=163.99 gradientTransform="matrix(633 0 0 633 422177 -103358)"gradientUnits=userSpaceOnUse><stop stop-color=#6BDAFF offset=0></stop><stop stop-color=#F9FFB5 offset=.32></stop><stop stop-color=#FFA770 offset=.71></stop><stop stop-color=#FF7373 offset=1></stop></linearGradient><circle cx=316.5 cy=316.5 r=316.5></circle><defs><filter x=-137.5 y=412 width=454 height=396.9 filterUnits=userSpaceOnUse><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"></feColorMatrix></filter></defs><mask x=-137.5 y=412 width=454 height=396.9 maskUnits=userSpaceOnUse><g><circle cx=316.5 cy=316.5 r=316.5 fill=#fff></circle></g></mask><g><ellipse cx=89.5 cy=610.5 rx=214.5 ry=186 fill=#015064 stroke=#00CFE2 stroke-width=25></ellipse></g><defs><filter x=316.5 y=412 width=454 height=396.9 filterUnits=userSpaceOnUse><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"></feColorMatrix></filter></defs><mask x=316.5 y=412 width=454 height=396.9 maskUnits=userSpaceOnUse><g><circle cx=316.5 cy=316.5 r=316.5 fill=#fff></circle></g></mask><g><ellipse cx=543.5 cy=610.5 rx=214.5 ry=186 fill=#015064 stroke=#00CFE2 stroke-width=25></ellipse></g><defs><filter x=-137.5 y=450 width=454 height=396.9 filterUnits=userSpaceOnUse><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"></feColorMatrix></filter></defs><mask x=-137.5 y=450 width=454 height=396.9 maskUnits=userSpaceOnUse><g><circle cx=316.5 cy=316.5 r=316.5 fill=#fff></circle></g></mask><g><ellipse cx=89.5 cy=648.5 rx=214.5 ry=186 fill=#015064 stroke=#00A8B8 stroke-width=25></ellipse></g><defs><filter x=316.5 y=450 width=454 height=396.9 filterUnits=userSpaceOnUse><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"></feColorMatrix></filter></defs><mask x=316.5 y=450 width=454 height=396.9 maskUnits=userSpaceOnUse><g><circle cx=316.5 cy=316.5 r=316.5 fill=#fff></circle></g></mask><g><ellipse cx=543.5 cy=648.5 rx=214.5 ry=186 fill=#015064 stroke=#00A8B8 stroke-width=25></ellipse></g><defs><filter x=-137.5 y=486 width=454 height=396.9 filterUnits=userSpaceOnUse><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"></feColorMatrix></filter></defs><mask x=-137.5 y=486 width=454 height=396.9 maskUnits=userSpaceOnUse><g><circle cx=316.5 cy=316.5 r=316.5 fill=#fff></circle></g></mask><g><ellipse cx=89.5 cy=684.5 rx=214.5 ry=186 fill=#015064 stroke=#007782 stroke-width=25></ellipse></g><defs><filter x=316.5 y=486 width=454 height=396.9 filterUnits=userSpaceOnUse><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"></feColorMatrix></filter></defs><mask x=316.5 y=486 width=454 height=396.9 maskUnits=userSpaceOnUse><g><circle cx=316.5 cy=316.5 r=316.5 fill=#fff></circle></g></mask><g><ellipse cx=543.5 cy=684.5 rx=214.5 ry=186 fill=#015064 stroke=#007782 stroke-width=25></ellipse></g><defs><filter x=272.2 y=308 width=176.9 height=129.3 filterUnits=userSpaceOnUse><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"></feColorMatrix></filter></defs><mask x=272.2 y=308 width=176.9 height=129.3 maskUnits=userSpaceOnUse><g><circle cx=316.5 cy=316.5 r=316.5 fill=#fff></circle></g></mask><g><line x1=436 x2=431 y1=403.2 y2=431.8 fill=none stroke=#000 stroke-linecap=round stroke-linejoin=bevel stroke-width=11></line><line x1=291 x2=280 y1=341.5 y2=403.5 fill=none stroke=#000 stroke-linecap=round stroke-linejoin=bevel stroke-width=11></line><line x1=332.9 x2=328.6 y1=384.1 y2=411.2 fill=none stroke=#000 stroke-linecap=round stroke-linejoin=bevel stroke-width=11></line><linearGradient x1=-670.75 x2=-671.59 y1=164.4 y2=164.49 gradientTransform="matrix(-184.16 -32.472 -11.461 64.997 -121359 -32126)"gradientUnits=userSpaceOnUse><stop stop-color=#EE2700 offset=0></stop><stop stop-color=#FF008E offset=1></stop></linearGradient><path d="m344.1 363 97.7 17.2c5.8 2.1 8.2 6.1 7.1 12.1s-4.7 9.2-11 9.9l-106-18.7-57.5-59.2c-3.2-4.8-2.9-9.1 0.8-12.8s8.3-4.4 13.7-2.1l55.2 53.6z"clip-rule=evenodd fill-rule=evenodd></path><line x1=428.2 x2=429.1 y1=384.5 y2=378 fill=none stroke=#fff stroke-linecap=round stroke-linejoin=bevel stroke-width=7></line><line x1=395.2 x2=396.1 y1=379.5 y2=373 fill=none stroke=#fff stroke-linecap=round stroke-linejoin=bevel stroke-width=7></line><line x1=362.2 x2=363.1 y1=373.5 y2=367.4 fill=none stroke=#fff stroke-linecap=round stroke-linejoin=bevel stroke-width=7></line><line x1=324.2 x2=328.4 y1=351.3 y2=347.4 fill=none stroke=#fff stroke-linecap=round stroke-linejoin=bevel stroke-width=7></line><line x1=303.2 x2=307.4 y1=331.3 y2=327.4 fill=none stroke=#fff stroke-linecap=round stroke-linejoin=bevel stroke-width=7></line></g><defs><filter x=73.2 y=113.8 width=280.6 height=317.4 filterUnits=userSpaceOnUse><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"></feColorMatrix></filter></defs><mask x=73.2 y=113.8 width=280.6 height=317.4 maskUnits=userSpaceOnUse><g><circle cx=316.5 cy=316.5 r=316.5 fill=#fff></circle></g></mask><g><linearGradient x1=-672.16 x2=-672.16 y1=165.03 y2=166.03 gradientTransform="matrix(-100.18 48.861 97.976 200.88 -83342 -93.059)"gradientUnits=userSpaceOnUse><stop stop-color=#A17500 offset=0></stop><stop stop-color=#5D2100 offset=1></stop></linearGradient><path d="m192.3 203c8.1 37.3 14 73.6 17.8 109.1 3.8 35.4 2.8 75.1-3 119.2l61.2-16.7c-15.6-59-25.2-97.9-28.6-116.6s-10.8-51.9-22.1-99.6l-25.3 4.6"clip-rule=evenodd fill-rule=evenodd></path><g stroke=#2F8A00><linearGradient x1=-660.23 x2=-660.23 y1=166.72 y2=167.72 gradientTransform="matrix(92.683 4.8573 -2.0259 38.657 61680 -3088.6)"gradientUnits=userSpaceOnUse><stop stop-color=#2F8A00 offset=0></stop><stop stop-color=#90FF57 offset=1></stop></linearGradient><path d="m195 183.9s-12.6-22.1-36.5-29.9c-15.9-5.2-34.4-1.5-55.5 11.1 15.9 14.3 29.5 22.6 40.7 24.9 16.8 3.6 51.3-6.1 51.3-6.1z"clip-rule=evenodd fill-rule=evenodd stroke-width=13></path><linearGradient x1=-661.36 x2=-661.36 y1=164.18 y2=165.18 gradientTransform="matrix(110 5.7648 -6.3599 121.35 73933 -15933)"gradientUnits=userSpaceOnUse><stop stop-color=#2F8A00 offset=0></stop><stop stop-color=#90FF57 offset=1></stop></linearGradient><path d="m194.9 184.5s-47.5-8.5-83.2 15.7c-23.8 16.2-34.3 49.3-31.6 99.4 30.3-27.8 52.1-48.5 65.2-61.9 19.8-20.2 49.6-53.2 49.6-53.2z"clip-rule=evenodd fill-rule=evenodd stroke-width=13></path><linearGradient x1=-656.79 x2=-656.79 y1=165.15 y2=166.15 gradientTransform="matrix(62.954 3.2993 -3.5023 66.828 42156 -8754.1)"gradientUnits=userSpaceOnUse><stop stop-color=#2F8A00 offset=0></stop><stop stop-color=#90FF57 offset=1></stop></linearGradient><path d="m195 183.9c-0.8-21.9 6-38 20.6-48.2s29.8-15.4 45.5-15.3c-6.1 21.4-14.5 35.8-25.2 43.4s-24.4 14.2-40.9 20.1z"clip-rule=evenodd fill-rule=evenodd stroke-width=13></path><linearGradient x1=-663.07 x2=-663.07 y1=165.44 y2=166.44 gradientTransform="matrix(152.47 7.9907 -3.0936 59.029 101884 -4318.7)"gradientUnits=userSpaceOnUse><stop stop-color=#2F8A00 offset=0></stop><stop stop-color=#90FF57 offset=1></stop></linearGradient><path d="m194.9 184.5c31.9-30 64.1-39.7 96.7-29s50.8 30.4 54.6 59.1c-35.2-5.5-60.4-9.6-75.8-12.1-15.3-2.6-40.5-8.6-75.5-18z"clip-rule=evenodd fill-rule=evenodd stroke-width=13></path><linearGradient x1=-662.57 x2=-662.57 y1=164.44 y2=165.44 gradientTransform="matrix(136.46 7.1517 -5.2163 99.533 91536 -11442)"gradientUnits=userSpaceOnUse><stop stop-color=#2F8A00 offset=0></stop><stop stop-color=#90FF57 offset=1></stop></linearGradient><path d="m194.9 184.5c35.8-7.6 65.6-0.2 89.2 22s37.7 49 42.3 80.3c-39.8-9.7-68.3-23.8-85.5-42.4s-32.5-38.5-46-59.9z"clip-rule=evenodd fill-rule=evenodd stroke-width=13></path><linearGradient x1=-656.43 x2=-656.43 y1=163.86 y2=164.86 gradientTransform="matrix(60.866 3.1899 -8.7773 167.48 41560 -25168)"gradientUnits=userSpaceOnUse><stop stop-color=#2F8A00 offset=0></stop><stop stop-color=#90FF57 offset=1></stop></linearGradient><path d="m194.9 184.5c-33.6 13.8-53.6 35.7-60.1 65.6s-3.6 63.1 8.7 99.6c27.4-40.3 43.2-69.6 47.4-88s5.6-44.1 4-77.2z"clip-rule=evenodd fill-rule=evenodd stroke-width=13></path><path d="m196.5 182.3c-14.8 21.6-25.1 41.4-30.8 59.4s-9.5 33-11.1 45.1"fill=none stroke-linecap=round stroke-width=8></path><path d="m194.9 185.7c-24.4 1.7-43.8 9-58.1 21.8s-24.7 25.4-31.3 37.8"fill=none stroke-linecap=round stroke-width=8></path><path d="m204.5 176.4c29.7-6.7 52-8.4 67-5.1s26.9 8.6 35.8 15.9"fill=none stroke-linecap=round stroke-width=8></path><path d="m196.5 181.4c20.3 9.9 38.2 20.5 53.9 31.9s27.4 22.1 35.1 32"fill=none stroke-linecap=round stroke-width=8></path></g></g><defs><filter x=50.5 y=399 width=532 height=633 filterUnits=userSpaceOnUse><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"></feColorMatrix></filter></defs><mask x=50.5 y=399 width=532 height=633 maskUnits=userSpaceOnUse><g><circle cx=316.5 cy=316.5 r=316.5 fill=#fff></circle></g></mask><g><linearGradient x1=-666.06 x2=-666.23 y1=163.36 y2=163.75 gradientTransform="matrix(532 0 0 633 354760 -102959)"gradientUnits=userSpaceOnUse><stop stop-color=#FFF400 offset=0></stop><stop stop-color=#3C8700 offset=1></stop></linearGradient><ellipse cx=316.5 cy=715.5 rx=266 ry=316.5></ellipse></g><defs><filter x=391 y=-24 width=288 height=283 filterUnits=userSpaceOnUse><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"></feColorMatrix></filter></defs><mask x=391 y=-24 width=288 height=283 maskUnits=userSpaceOnUse><g><circle cx=316.5 cy=316.5 r=316.5 fill=#fff></circle></g></mask><g><linearGradient x1=-664.56 x2=-664.56 y1=163.79 y2=164.79 gradientTransform="matrix(227 0 0 227 151421 -37204)"gradientUnits=userSpaceOnUse><stop stop-color=#FFDF00 offset=0></stop><stop stop-color=#FF9D00 offset=1></stop></linearGradient><circle cx=565.5 cy=89.5 r=113.5></circle><linearGradient x1=-644.5 x2=-645.77 y1=342 y2=342 gradientTransform="matrix(30 0 0 1 19770 -253)"gradientUnits=userSpaceOnUse><stop stop-color=#FFA400 offset=0></stop><stop stop-color=#FF5E00 offset=1></stop></linearGradient><line x1=427 x2=397 y1=89 y2=89 fill=none stroke-linecap=round stroke-linejoin=bevel stroke-width=12></line><linearGradient x1=-641.56 x2=-642.83 y1=196.02 y2=196.07 gradientTransform="matrix(26.5 0 0 5.5 17439 -1025.5)"gradientUnits=userSpaceOnUse><stop stop-color=#FFA400 offset=0></stop><stop stop-color=#FF5E00 offset=1></stop></linearGradient><line x1=430.5 x2=404 y1=55.5 y2=50 fill=none stroke-linecap=round stroke-linejoin=bevel stroke-width=12></line><linearGradient x1=-643.73 x2=-645 y1=185.83 y2=185.9 gradientTransform="matrix(29 0 0 8 19107 -1361)"gradientUnits=userSpaceOnUse><stop stop-color=#FFA400 offset=0></stop><stop stop-color=#FF5E00 offset=1></stop></linearGradient><line x1=431 x2=402 y1=122 y2=130 fill=none stroke-linecap=round stroke-linejoin=bevel stroke-width=12></line><linearGradient x1=-638.94 x2=-640.22 y1=177.09 y2=177.39 gradientTransform="matrix(24 0 0 13 15783 -2145)"gradientUnits=userSpaceOnUse><stop stop-color=#FFA400 offset=0></stop><stop stop-color=#FF5E00 offset=1></stop></linearGradient><line x1=442 x2=418 y1=153 y2=166 fill=none stroke-linecap=round stroke-linejoin=bevel stroke-width=12></line><linearGradient x1=-633.42 x2=-634.7 y1=172.41 y2=173.31 gradientTransform="matrix(20 0 0 19 13137 -3096)"gradientUnits=userSpaceOnUse><stop stop-color=#FFA400 offset=0></stop><stop stop-color=#FF5E00 offset=1></stop></linearGradient><line x1=464 x2=444 y1=180 y2=199 fill=none stroke-linecap=round stroke-linejoin=bevel stroke-width=12></line><linearGradient x1=-619.05 x2=-619.52 y1=170.82 y2=171.82 gradientTransform="matrix(13.83 0 0 22.85 9050 -3703.4)"gradientUnits=userSpaceOnUse><stop stop-color=#FFA400 offset=0></stop><stop stop-color=#FF5E00 offset=1></stop></linearGradient><line x1=491.4 x2=477.5 y1=203 y2=225.9 fill=none stroke-linecap=round stroke-linejoin=bevel stroke-width=12></line><linearGradient x1=-578.5 x2=-578.63 y1=170.31 y2=171.31 gradientTransform="matrix(7.5 0 0 24.5 4860 -3953)"gradientUnits=userSpaceOnUse><stop stop-color=#FFA400 offset=0></stop><stop stop-color=#FF5E00 offset=1></stop></linearGradient><line x1=524.5 x2=517 y1=219.5 y2=244 fill=none stroke-linecap=round stroke-linejoin=bevel stroke-width=12></line><linearGradient x1=666.5 x2=666.5 y1=170.31 y2=171.31 gradientTransform="matrix(.5 0 0 24.5 231.5 -3944)"gradientUnits=userSpaceOnUse><stop stop-color=#FFA400 offset=0></stop><stop stop-color=#FF5E00 offset=1></stop></linearGradient><line x1=564.5 x2=565 y1=228.5 y2=253 fill=none stroke-linecap=round stroke-linejoin=bevel stroke-width=12>');function n2(){return nP()}function n3(){return nA()}function n5(){return nz()}function n4(){return nO()}function n6(){return nI()}function n9(){var e;return(e=nI()).style.setProperty("transform","rotate(90deg)"),e}function n8(){var e;return(e=nI()).style.setProperty("transform","rotate(-90deg)"),e}function n7(){return nK()}function ie(){return nG()}function it(){return nR()}function ir(){return nB()}function ii(){return nH()}function io(){return nW()}function il(){return nU()}function ia(){return nV()}function is(){return nQ()}function id(e){var t,r;return r=(t=nN()).firstChild,(0,l.F3)(()=>(0,l.P$)(r,"stroke","dark"===e.theme?"#12B76A":"#027A48")),t}function iu(){return nj()}function ic(){return nX()}function ig(e){return[(0,l.LM)(l.di,{get when(){return e.checked},get children(){var t=nN(),r=t.firstChild;return(0,l.F3)(()=>(0,l.P$)(r,"stroke","dark"===e.theme?"#9B8AFB":"#6938EF")),t}}),(0,l.LM)(l.di,{get when(){return!e.checked},get children(){var n=n_(),i=n.firstChild;return(0,l.F3)(()=>(0,l.P$)(i,"stroke","dark"===e.theme?"#9B8AFB":"#6938EF")),n}})]}function ip(){return nY()}function ih(){return nZ()}function iy(){return nJ()}function iv(){return n0()}function ib(){var e,t,r,n,i,o,a,s,d,u,c,g,f,p,h,y,v,b,m,x,w,$,k,M,S,C,L,q,T,E,D,F,P,A,z,O,I,K,G,R,B,H,W,U,V,Q,N,j,X,_,Y,Z,J,ee,et,er,en,ei,eo,el,ea,es,ed,eu,ec,eg,ef,ep,eh,ey,ev,eb,em,ex,ew,e$,ek,eM,eS,eC,eL,eq,eT,eE,eD,eF,eP,eA,ez;let eO=(0,l.g4)();return i=(n=(r=(t=(e=n1()).firstChild).nextSibling).nextSibling).firstChild,a=(o=n.nextSibling).firstChild,u=(d=(s=o.nextSibling).nextSibling).firstChild,g=(c=d.nextSibling).firstChild,h=(p=(f=c.nextSibling).nextSibling).firstChild,v=(y=p.nextSibling).firstChild,x=(m=(b=y.nextSibling).nextSibling).firstChild,$=(w=m.nextSibling).firstChild,S=(M=(k=w.nextSibling).nextSibling).firstChild,L=(C=M.nextSibling).firstChild,E=(T=(q=C.nextSibling).nextSibling).firstChild,F=(D=T.nextSibling).firstChild,z=(A=(P=D.nextSibling).nextSibling).firstChild,I=(O=A.nextSibling).firstChild,R=(G=(K=O.nextSibling).firstChild.nextSibling.nextSibling.nextSibling).nextSibling,H=(B=K.nextSibling).firstChild,U=(W=B.nextSibling).firstChild,eo=(ei=(en=(er=(et=(ee=(J=(Z=(Y=(_=(X=(j=(N=(Q=(V=W.nextSibling).firstChild).nextSibling).nextSibling.firstChild).nextSibling).nextSibling).nextSibling).nextSibling).nextSibling).nextSibling).nextSibling).nextSibling).nextSibling).nextSibling).nextSibling,ea=(el=V.nextSibling).firstChild,ed=(es=el.nextSibling).firstChild,eg=(ec=(eu=es.nextSibling).firstChild).nextSibling,ep=(ef=eu.nextSibling).firstChild,ey=(eh=ef.nextSibling).firstChild,ez=(eA=(eP=(eF=(eD=(eE=(eT=(eq=(eL=(eC=(eS=(eM=(ek=(e$=(ew=(ex=(em=(eb=(ev=eh.nextSibling).firstChild).nextSibling).nextSibling).nextSibling).nextSibling).nextSibling).nextSibling).nextSibling).nextSibling).nextSibling).nextSibling).nextSibling).nextSibling).nextSibling).nextSibling).nextSibling).nextSibling).nextSibling,(0,l.P$)(t,"id",`a-${eO}`),(0,l.P$)(r,"fill",`url(#a-${eO})`),(0,l.P$)(i,"id",`am-${eO}`),(0,l.P$)(o,"id",`b-${eO}`),(0,l.P$)(a,"filter",`url(#am-${eO})`),(0,l.P$)(s,"mask",`url(#b-${eO})`),(0,l.P$)(u,"id",`ah-${eO}`),(0,l.P$)(c,"id",`k-${eO}`),(0,l.P$)(g,"filter",`url(#ah-${eO})`),(0,l.P$)(f,"mask",`url(#k-${eO})`),(0,l.P$)(h,"id",`ae-${eO}`),(0,l.P$)(y,"id",`j-${eO}`),(0,l.P$)(v,"filter",`url(#ae-${eO})`),(0,l.P$)(b,"mask",`url(#j-${eO})`),(0,l.P$)(x,"id",`ai-${eO}`),(0,l.P$)(w,"id",`i-${eO}`),(0,l.P$)($,"filter",`url(#ai-${eO})`),(0,l.P$)(k,"mask",`url(#i-${eO})`),(0,l.P$)(S,"id",`aj-${eO}`),(0,l.P$)(C,"id",`h-${eO}`),(0,l.P$)(L,"filter",`url(#aj-${eO})`),(0,l.P$)(q,"mask",`url(#h-${eO})`),(0,l.P$)(E,"id",`ag-${eO}`),(0,l.P$)(D,"id",`g-${eO}`),(0,l.P$)(F,"filter",`url(#ag-${eO})`),(0,l.P$)(P,"mask",`url(#g-${eO})`),(0,l.P$)(z,"id",`af-${eO}`),(0,l.P$)(O,"id",`f-${eO}`),(0,l.P$)(I,"filter",`url(#af-${eO})`),(0,l.P$)(K,"mask",`url(#f-${eO})`),(0,l.P$)(G,"id",`m-${eO}`),(0,l.P$)(R,"fill",`url(#m-${eO})`),(0,l.P$)(H,"id",`ak-${eO}`),(0,l.P$)(W,"id",`e-${eO}`),(0,l.P$)(U,"filter",`url(#ak-${eO})`),(0,l.P$)(V,"mask",`url(#e-${eO})`),(0,l.P$)(Q,"id",`n-${eO}`),(0,l.P$)(N,"fill",`url(#n-${eO})`),(0,l.P$)(j,"id",`r-${eO}`),(0,l.P$)(X,"fill",`url(#r-${eO})`),(0,l.P$)(_,"id",`s-${eO}`),(0,l.P$)(Y,"fill",`url(#s-${eO})`),(0,l.P$)(Z,"id",`q-${eO}`),(0,l.P$)(J,"fill",`url(#q-${eO})`),(0,l.P$)(ee,"id",`p-${eO}`),(0,l.P$)(et,"fill",`url(#p-${eO})`),(0,l.P$)(er,"id",`o-${eO}`),(0,l.P$)(en,"fill",`url(#o-${eO})`),(0,l.P$)(ei,"id",`l-${eO}`),(0,l.P$)(eo,"fill",`url(#l-${eO})`),(0,l.P$)(ea,"id",`al-${eO}`),(0,l.P$)(es,"id",`d-${eO}`),(0,l.P$)(ed,"filter",`url(#al-${eO})`),(0,l.P$)(eu,"mask",`url(#d-${eO})`),(0,l.P$)(ec,"id",`u-${eO}`),(0,l.P$)(eg,"fill",`url(#u-${eO})`),(0,l.P$)(ep,"id",`ad-${eO}`),(0,l.P$)(eh,"id",`c-${eO}`),(0,l.P$)(ey,"filter",`url(#ad-${eO})`),(0,l.P$)(ev,"mask",`url(#c-${eO})`),(0,l.P$)(eb,"id",`t-${eO}`),(0,l.P$)(em,"fill",`url(#t-${eO})`),(0,l.P$)(ex,"id",`v-${eO}`),(0,l.P$)(ew,"stroke",`url(#v-${eO})`),(0,l.P$)(e$,"id",`aa-${eO}`),(0,l.P$)(ek,"stroke",`url(#aa-${eO})`),(0,l.P$)(eM,"id",`w-${eO}`),(0,l.P$)(eS,"stroke",`url(#w-${eO})`),(0,l.P$)(eC,"id",`ac-${eO}`),(0,l.P$)(eL,"stroke",`url(#ac-${eO})`),(0,l.P$)(eq,"id",`ab-${eO}`),(0,l.P$)(eT,"stroke",`url(#ab-${eO})`),(0,l.P$)(eE,"id",`y-${eO}`),(0,l.P$)(eD,"stroke",`url(#y-${eO})`),(0,l.P$)(eF,"id",`x-${eO}`),(0,l.P$)(eP,"stroke",`url(#x-${eO})`),(0,l.P$)(eA,"id",`z-${eO}`),(0,l.P$)(ez,"stroke",`url(#z-${eO})`),e}var im=(0,l.XK)('<span><svg width=16 height=16 viewBox="0 0 16 16"fill=none xmlns=http://www.w3.org/2000/svg><path d="M6 12L10 8L6 4"stroke-width=2 stroke-linecap=round stroke-linejoin=round>'),ix=(0,l.XK)('<button title="Copy object to clipboard">'),iw=(0,l.XK)('<button title="Remove all items"aria-label="Remove all items">'),i$=(0,l.XK)('<button title="Delete item"aria-label="Delete item">'),ik=(0,l.XK)('<button title="Toggle value"aria-label="Toggle value">'),iM=(0,l.XK)('<button title="Bulk Edit Data"aria-label="Bulk Edit Data">'),iS=(0,l.XK)("<div>"),iC=(0,l.XK)("<div><button> <span></span> <span> "),iL=(0,l.XK)("<input>"),iq=(0,l.XK)("<span>"),iT=(0,l.XK)("<div><span>:"),iE=(0,l.XK)("<div><div><button> [<!>...<!>]"),iD=e=>{var t;let r=L(),n=$().shadowDOMTarget?V.bind({target:$().shadowDOMTarget}):V,i=(0,l.dD)(()=>"dark"===r()?iR(n):iG(n));return t=im(),(0,l.F3)(()=>(0,l.ok)(t,Q(i().expander,n`
          transform: rotate(${e.expanded?90:0}deg);
        `,e.expanded&&n`
            & svg {
              top: -1px;
            }
          `))),t},iF=e=>{var t;let r=L(),n=$().shadowDOMTarget?V.bind({target:$().shadowDOMTarget}):V,i=(0,l.dD)(()=>"dark"===r()?iR(n):iG(n)),[o,a]=(0,l.gQ)("NoCopy");return t=ix(),(0,l.Oo)(t,"click","NoCopy"===o()?()=>{navigator.clipboard.writeText((0,l.Pz)(e.value)).then(()=>{a("SuccessCopy"),setTimeout(()=>{a("NoCopy")},1500)},e=>{a("ErrorCopy"),setTimeout(()=>{a("NoCopy")},1500)})}:void 0,!0),(0,l.$T)(t,(0,l.LM)(l.rs,{get children(){return[(0,l.LM)(l.qE,{get when(){return"NoCopy"===o()},get children(){return(0,l.LM)(ia,{})}}),(0,l.LM)(l.qE,{get when(){return"SuccessCopy"===o()},get children(){return(0,l.LM)(id,{get theme(){return r()}})}}),(0,l.LM)(l.qE,{get when(){return"ErrorCopy"===o()},get children(){return(0,l.LM)(iu,{})}})]}})),(0,l.F3)(e=>{var r=i().actionButton,n=`${"NoCopy"===o()?"Copy object to clipboard":"SuccessCopy"===o()?"Object copied to clipboard":"Error copying object to clipboard"}`;return r!==e.e&&(0,l.ok)(t,e.e=r),n!==e.t&&(0,l.P$)(t,"aria-label",e.t=n),e},{e:void 0,t:void 0}),t},iP=e=>{var t;let r=L(),n=$().shadowDOMTarget?V.bind({target:$().shadowDOMTarget}):V,i=(0,l.dD)(()=>"dark"===r()?iR(n):iG(n)),o=$().client;return(t=iw()).$$click=()=>{let t=e.activeQuery.state.data,r=(0,l.nf)(t,e.dataPath,[]);o.setQueryData(e.activeQuery.queryKey,r)},(0,l.$T)(t,(0,l.LM)(ic,{})),(0,l.F3)(()=>(0,l.ok)(t,i().actionButton)),t},iA=e=>{var t;let r=L(),n=$().shadowDOMTarget?V.bind({target:$().shadowDOMTarget}):V,i=(0,l.dD)(()=>"dark"===r()?iR(n):iG(n)),o=$().client;return(t=i$()).$$click=()=>{let t=e.activeQuery.state.data,r=(0,l.K_)(t,e.dataPath);o.setQueryData(e.activeQuery.queryKey,r)},(0,l.$T)(t,(0,l.LM)(n3,{})),(0,l.F3)(()=>(0,l.ok)(t,Q(i().actionButton))),t},iz=e=>{var t;let r=L(),n=$().shadowDOMTarget?V.bind({target:$().shadowDOMTarget}):V,i=(0,l.dD)(()=>"dark"===r()?iR(n):iG(n)),o=$().client;return(t=ik()).$$click=()=>{let t=e.activeQuery.state.data,r=(0,l.nf)(t,e.dataPath,!e.value);o.setQueryData(e.activeQuery.queryKey,r)},(0,l.$T)(t,(0,l.LM)(ig,{get theme(){return r()},get checked(){return e.value}})),(0,l.F3)(()=>(0,l.ok)(t,Q(i().actionButton,n`
          width: ${nF.size[3.5]};
          height: ${nF.size[3.5]};
        `))),t};function iO(e){return Symbol.iterator in e}function iI(e){var t;let r=L(),n=$().shadowDOMTarget?V.bind({target:$().shadowDOMTarget}):V,i=(0,l.dD)(()=>"dark"===r()?iR(n):iG(n)),o=$().client,[a,s]=(0,l.gQ)((e.defaultExpanded||[]).includes(e.label)),d=()=>s(e=>!e),[u,c]=(0,l.gQ)([]),g=(0,l.dD)(()=>Array.isArray(e.value)?e.value.map((e,t)=>({label:t.toString(),value:e})):null!==e.value&&"object"==typeof e.value&&iO(e.value)&&"function"==typeof e.value[Symbol.iterator]?e.value instanceof Map?Array.from(e.value,([e,t])=>({label:e,value:t})):Array.from(e.value,(e,t)=>({label:t.toString(),value:e})):"object"==typeof e.value&&null!==e.value?Object.entries(e.value).map(([e,t])=>({label:e,value:t})):[]),f=(0,l.dD)(()=>Array.isArray(e.value)?"array":null!==e.value&&"object"==typeof e.value&&iO(e.value)&&"function"==typeof e.value[Symbol.iterator]?"Iterable":"object"==typeof e.value&&null!==e.value?"object":typeof e.value),p=(0,l.dD)(()=>(function(e,t){let r=0,n=[];for(;r<e.length;)n.push(e.slice(r,r+100)),r+=100;return n})(g(),0)),h=e.dataPath??[];return t=iS(),(0,l.$T)(t,(0,l.LM)(l.di,{get when(){return p().length},get children(){var y,v,b,m,x,w;return[(w=(x=(m=(b=(v=(y=iC()).firstChild).firstChild).nextSibling).nextSibling.nextSibling).firstChild,v.$$click=()=>d(),(0,l.$T)(v,(0,l.LM)(iD,{get expanded(){return a()}}),b),(0,l.$T)(m,()=>e.label),(0,l.$T)(x,()=>"iterable"===String(f()).toLowerCase()?"(Iterable) ":"",w),(0,l.$T)(x,()=>g().length,w),(0,l.$T)(x,()=>g().length>1?"items":"item",null),(0,l.$T)(y,(0,l.LM)(l.di,{get when(){return e.editable},get children(){var k=iS();return(0,l.$T)(k,(0,l.LM)(iF,{get value(){return e.value}}),null),(0,l.$T)(k,(0,l.LM)(l.di,{get when(){return e.itemsDeletable&&void 0!==e.activeQuery},get children(){return(0,l.LM)(iA,{get activeQuery(){return e.activeQuery},dataPath:h})}}),null),(0,l.$T)(k,(0,l.LM)(l.di,{get when(){return"array"===f()&&void 0!==e.activeQuery},get children(){return(0,l.LM)(iP,{get activeQuery(){return e.activeQuery},dataPath:h})}}),null),(0,l.$T)(k,(0,l.LM)(l.di,{get when(){return(0,l.dD)(()=>!!e.onEdit)()&&!(0,l.qC)(e.value).meta},get children(){var M=iM();return M.$$click=()=>{e.onEdit?.()},(0,l.$T)(M,(0,l.LM)(is,{})),(0,l.F3)(()=>(0,l.ok)(M,i().actionButton)),M}}),null),(0,l.F3)(()=>(0,l.ok)(k,i().actions)),k}}),null),(0,l.F3)(e=>{var t=i().expanderButtonContainer,r=i().expanderButton,n=i().info;return t!==e.e&&(0,l.ok)(y,e.e=t),r!==e.t&&(0,l.ok)(v,e.t=r),n!==e.a&&(0,l.ok)(x,e.a=n),e},{e:void 0,t:void 0,a:void 0}),y),(0,l.LM)(l.di,{get when(){return a()},get children(){return[(0,l.LM)(l.di,{get when(){return 1===p().length},get children(){var S=iS();return(0,l.$T)(S,(0,l.LM)(J,{get each(){return g()},by:e=>e.label,children:t=>(0,l.LM)(iI,{get defaultExpanded(){return e.defaultExpanded},get label(){return t().label},get value(){return t().value},get editable(){return e.editable},get dataPath(){return[...h,t().label]},get activeQuery(){return e.activeQuery},get itemsDeletable(){return"array"===f()||"Iterable"===f()||"object"===f()}})})),(0,l.F3)(()=>(0,l.ok)(S,i().subEntry)),S}}),(0,l.LM)(l.di,{get when(){return p().length>1},get children(){var C=iS();return(0,l.$T)(C,(0,l.LM)(l.gm,{get each(){return p()},children:(t,r)=>{var n,o,a,s,d,g;return(g=(d=(s=(a=(o=(n=iE()).firstChild).firstChild).firstChild).nextSibling).nextSibling.nextSibling).nextSibling,a.$$click=()=>c(e=>e.includes(r)?e.filter(e=>e!==r):[...e,r]),(0,l.$T)(a,(0,l.LM)(iD,{get expanded(){return u().includes(r)}}),s),(0,l.$T)(a,100*r,d),(0,l.$T)(a,100*r+100-1,g),(0,l.$T)(o,(0,l.LM)(l.di,{get when(){return u().includes(r)},get children(){var f=iS();return(0,l.$T)(f,(0,l.LM)(J,{get each(){return t()},by:e=>e.label,children:t=>(0,l.LM)(iI,{get defaultExpanded(){return e.defaultExpanded},get label(){return t().label},get value(){return t().value},get editable(){return e.editable},get dataPath(){return[...h,t().label]},get activeQuery(){return e.activeQuery}})})),(0,l.F3)(()=>(0,l.ok)(f,i().subEntry)),f}}),null),(0,l.F3)(e=>{var t=i().entry,r=i().expanderButton;return t!==e.e&&(0,l.ok)(o,e.e=t),r!==e.t&&(0,l.ok)(a,e.t=r),e},{e:void 0,t:void 0}),n}})),(0,l.F3)(()=>(0,l.ok)(C,i().subEntry)),C}})]}})]}}),null),(0,l.$T)(t,(0,l.LM)(l.di,{get when(){return 0===p().length},get children(){var q=iT(),T=q.firstChild,E=T.firstChild;return(0,l.$T)(T,()=>e.label,E),(0,l.$T)(q,(0,l.LM)(l.di,{get when(){return(0,l.dD)(()=>!!(e.editable&&void 0!==e.activeQuery))()&&("string"===f()||"number"===f()||"boolean"===f())},get fallback(){var D;return D=iq(),(0,l.$T)(D,()=>(0,l.AI)(e.value)),(0,l.F3)(()=>(0,l.ok)(D,i().value)),D},get children(){return[(0,l.LM)(l.di,{get when(){return(0,l.dD)(()=>!!(e.editable&&void 0!==e.activeQuery))()&&("string"===f()||"number"===f())},get children(){var F=iL();return F.addEventListener("change",t=>{let r=e.activeQuery.state.data,n=(0,l.nf)(r,h,"number"===f()?t.target.valueAsNumber:t.target.value);o.setQueryData(e.activeQuery.queryKey,n)}),(0,l.F3)(e=>{var t="number"===f()?"number":"text",r=Q(i().value,i().editableInput);return t!==e.e&&(0,l.P$)(F,"type",e.e=t),r!==e.t&&(0,l.ok)(F,e.t=r),e},{e:void 0,t:void 0}),(0,l.F3)(()=>F.value=e.value),F}}),(0,l.LM)(l.di,{get when(){return"boolean"===f()},get children(){var P=iq();return(0,l.$T)(P,(0,l.LM)(iz,{get activeQuery(){return e.activeQuery},dataPath:h,get value(){return e.value}}),null),(0,l.$T)(P,()=>(0,l.AI)(e.value),null),(0,l.F3)(()=>(0,l.ok)(P,Q(i().value,i().actions,i().editableInput))),P}})]}}),null),(0,l.$T)(q,(0,l.LM)(l.di,{get when(){return e.editable&&e.itemsDeletable&&void 0!==e.activeQuery},get children(){return(0,l.LM)(iA,{get activeQuery(){return e.activeQuery},dataPath:h})}}),null),(0,l.F3)(e=>{var t=i().row,r=i().label;return t!==e.e&&(0,l.ok)(q,e.e=t),r!==e.t&&(0,l.ok)(T,e.t=r),e},{e:void 0,t:void 0}),q}}),null),(0,l.F3)(()=>(0,l.ok)(t,i().entry)),t}var iK=(e,t)=>{let{colors:r,font:n,size:i,border:o}=nF,l=(t,r)=>"light"===e?t:r;return{entry:t`
      & * {
        font-size: ${n.size.xs};
        font-family:
          ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
          'Liberation Mono', 'Courier New', monospace;
      }
      position: relative;
      outline: none;
      word-break: break-word;
    `,subEntry:t`
      margin: 0 0 0 0.5em;
      padding-left: 0.75em;
      border-left: 2px solid ${l(r.gray[300],r.darkGray[400])};
      /* outline: 1px solid ${r.teal[400]}; */
    `,expander:t`
      & path {
        stroke: ${r.gray[400]};
      }
      & svg {
        width: ${i[3]};
        height: ${i[3]};
      }
      display: inline-flex;
      align-items: center;
      transition: all 0.1s ease;
      /* outline: 1px solid ${r.blue[400]}; */
    `,expanderButtonContainer:t`
      display: flex;
      align-items: center;
      line-height: ${i[4]};
      min-height: ${i[4]};
      gap: ${i[2]};
    `,expanderButton:t`
      cursor: pointer;
      color: inherit;
      font: inherit;
      outline: inherit;
      height: ${i[5]};
      background: transparent;
      border: none;
      padding: 0;
      display: inline-flex;
      align-items: center;
      gap: ${i[1]};
      position: relative;
      /* outline: 1px solid ${r.green[400]}; */

      &:focus-visible {
        border-radius: ${o.radius.xs};
        outline: 2px solid ${r.blue[800]};
      }

      & svg {
        position: relative;
        left: 1px;
      }
    `,info:t`
      color: ${l(r.gray[500],r.gray[500])};
      font-size: ${n.size.xs};
      margin-left: ${i[1]};
      /* outline: 1px solid ${r.yellow[400]}; */
    `,label:t`
      color: ${l(r.gray[700],r.gray[300])};
      white-space: nowrap;
    `,value:t`
      color: ${l(r.purple[600],r.purple[400])};
      flex-grow: 1;
    `,actions:t`
      display: inline-flex;
      gap: ${i[2]};
      align-items: center;
    `,row:t`
      display: inline-flex;
      gap: ${i[2]};
      width: 100%;
      margin: ${i[.25]} 0px;
      line-height: ${i[4.5]};
      align-items: center;
    `,editableInput:t`
      border: none;
      padding: ${i[.5]} ${i[1]} ${i[.5]} ${i[1.5]};
      flex-grow: 1;
      border-radius: ${o.radius.xs};
      background-color: ${l(r.gray[200],r.darkGray[500])};

      &:hover {
        background-color: ${l(r.gray[300],r.darkGray[600])};
      }
    `,actionButton:t`
      background-color: transparent;
      color: ${l(r.gray[500],r.gray[500])};
      border: none;
      display: inline-flex;
      padding: 0px;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      width: ${i[3]};
      height: ${i[3]};
      position: relative;
      z-index: 1;

      &:hover svg {
        color: ${l(r.gray[600],r.gray[400])};
      }

      &:focus-visible {
        border-radius: ${o.radius.xs};
        outline: 2px solid ${r.blue[800]};
        outline-offset: 2px;
      }
    `}},iG=e=>iK("light",e),iR=e=>iK("dark",e);(0,l.Qj)(["click"]);var iB=(0,l.XK)('<div><div aria-hidden=true></div><button type=button aria-label="Open Tanstack query devtools"class=tsqd-open-btn>'),iH=(0,l.XK)("<div>"),iW=(0,l.XK)('<aside aria-label="Tanstack query devtools"><div></div><button aria-label="Close tanstack query devtools">'),iU=(0,l.XK)("<select name=tsqd-queries-filter-sort>"),iV=(0,l.XK)("<select name=tsqd-mutations-filter-sort>"),iQ=(0,l.XK)("<span>Asc"),iN=(0,l.XK)("<span>Desc"),ij=(0,l.XK)('<button aria-label="Open in picture-in-picture mode"title="Open in picture-in-picture mode">'),iX=(0,l.XK)("<div>Settings"),i_=(0,l.XK)("<span>Position"),iY=(0,l.XK)("<span>Top"),iZ=(0,l.XK)("<span>Bottom"),iJ=(0,l.XK)("<span>Left"),i0=(0,l.XK)("<span>Right"),i1=(0,l.XK)("<span>Theme"),i2=(0,l.XK)("<span>Light"),i3=(0,l.XK)("<span>Dark"),i5=(0,l.XK)("<span>System"),i4=(0,l.XK)("<div><div class=tsqd-queries-container>"),i6=(0,l.XK)("<div><div class=tsqd-mutations-container>"),i9=(0,l.XK)('<div><div><div><button aria-label="Close Tanstack query devtools"><span>TANSTACK</span><span> v</span></button></div></div><div><div><div><input aria-label="Filter queries by query key"type=text placeholder=Filter name=tsqd-query-filter-input></div><div></div><button class=tsqd-query-filter-sort-order-btn></button></div><div><button aria-label="Clear query cache"></button><button>'),i8=(0,l.XK)("<option>Sort by "),i7=(0,l.XK)("<div class=tsqd-query-disabled-indicator>disabled"),oe=(0,l.XK)("<div class=tsqd-query-static-indicator>static"),ot=(0,l.XK)("<button><div></div><code class=tsqd-query-hash>"),or=(0,l.XK)("<div role=tooltip id=tsqd-status-tooltip>"),on=(0,l.XK)("<span>"),oi=(0,l.XK)("<button><span></span><span>"),oo=(0,l.XK)("<button><span></span> Error"),ol=(0,l.XK)('<div><span></span>Trigger Error<select><option value=""disabled selected>'),oa=(0,l.XK)('<div class="tsqd-query-details-explorer-container tsqd-query-details-data-explorer">'),os=(0,l.XK)("<form><textarea name=data></textarea><div><span></span><div><button type=button>Cancel</button><button>Save"),od=(0,l.XK)('<div><div>Query Details</div><div><div class=tsqd-query-details-summary><pre><code></code></pre><span></span></div><div class=tsqd-query-details-observers-count><span>Observers:</span><span></span></div><div class=tsqd-query-details-last-updated><span>Last Updated:</span><span></span></div></div><div>Actions</div><div><button><span></span>Refetch</button><button><span></span>Invalidate</button><button><span></span>Reset</button><button><span></span>Remove</button><button><span></span> Loading</button></div><div>Data </div><div>Query Explorer</div><div class="tsqd-query-details-explorer-container tsqd-query-details-query-explorer">'),ou=(0,l.XK)("<option>"),oc=(0,l.XK)('<div><div>Mutation Details</div><div><div class=tsqd-query-details-summary><pre><code></code></pre><span></span></div><div class=tsqd-query-details-last-updated><span>Submitted At:</span><span></span></div></div><div>Variables Details</div><div class="tsqd-query-details-explorer-container tsqd-query-details-query-explorer"></div><div>Context Details</div><div class="tsqd-query-details-explorer-container tsqd-query-details-query-explorer"></div><div>Data Explorer</div><div class="tsqd-query-details-explorer-container tsqd-query-details-query-explorer"></div><div>Mutations Explorer</div><div class="tsqd-query-details-explorer-container tsqd-query-details-query-explorer">'),[og,of]=(0,l.gQ)(null),[op,oh]=(0,l.gQ)(null),[oy,ov]=(0,l.gQ)(0),[ob,om]=(0,l.gQ)(!1),ox=e=>{var t,r;let n;let i=L(),o=$().shadowDOMTarget?V.bind({target:$().shadowDOMTarget}):V,a=(0,l.dD)(()=>"dark"===i()?oB(o):oR(o)),s=(0,l.dD)(()=>$().onlineManager);(0,l.H3)(()=>{let e=s().subscribe(e=>{om(!e)});(0,l.$W)(()=>{e()})});let d=S(),u=(0,l.dD)(()=>$().buttonPosition||"bottom-right"),c=(0,l.dD)(()=>"true"===e.localStore.open||"false"!==e.localStore.open&&($().initialIsOpen||!1)),g=(0,l.dD)(()=>e.localStore.position||$().position||v);(0,l.GW)(()=>{let t=n.parentElement,r=e.localStore.height||500,i=e.localStore.width||500,o=g();t.style.setProperty("--tsqd-panel-height",`${"top"===o?"-":""}${r}px`),t.style.setProperty("--tsqd-panel-width",`${"left"===o?"-":""}${i}px`)}),(0,l.H3)(()=>{let e=()=>{let e=n.parentElement,t=getComputedStyle(e).fontSize;e.style.setProperty("--tsqd-font-size",t)};e(),window.addEventListener("focus",e),(0,l.$W)(()=>{window.removeEventListener("focus",e)})});let f=(0,l.dD)(()=>e.localStore.pip_open??"false");return[(0,l.LM)(l.di,{get when(){return(0,l.dD)(()=>!!d().pipWindow)()&&"true"==f()},get children(){return(0,l.LM)(l.h_,{get mount(){return d().pipWindow?.document.body},get children(){return(0,l.LM)(ow,{get children(){return(0,l.LM)(oM,e)}})}})}}),(t=iH(),"function"==typeof(r=n)?(0,l.D$)(r,t):n=t,(0,l.$T)(t,(0,l.LM)(_,{name:"tsqd-panel-transition",get children(){return(0,l.LM)(l.di,{get when(){return(0,l.dD)(()=>!!(c()&&!d().pipWindow))()&&"false"==f()},get children(){return(0,l.LM)(ok,{get localStore(){return e.localStore},get setLocalStore(){return e.setLocalStore}})}})}}),null),(0,l.$T)(t,(0,l.LM)(_,{name:"tsqd-button-transition",get children(){return(0,l.LM)(l.di,{get when(){return!c()},get children(){var p=iB(),h=p.firstChild,y=h.nextSibling;return(0,l.$T)(h,(0,l.LM)(ib,{})),y.$$click=()=>e.setLocalStore("open","true"),(0,l.$T)(y,(0,l.LM)(ib,{})),(0,l.F3)(()=>(0,l.ok)(p,Q(a().devtoolsBtn,a()[`devtoolsBtn-position-${u()}`],"tsqd-open-btn-container"))),p}})}}),null),(0,l.F3)(()=>(0,l.ok)(t,Q(o`
            & .tsqd-panel-transition-exit-active,
            & .tsqd-panel-transition-enter-active {
              transition:
                opacity 0.3s,
                transform 0.3s;
            }

            & .tsqd-panel-transition-exit-to,
            & .tsqd-panel-transition-enter {
              ${"top"===g()||"bottom"===g()?"transform: translateY(var(--tsqd-panel-height));":"transform: translateX(var(--tsqd-panel-width));"}
            }

            & .tsqd-button-transition-exit-active,
            & .tsqd-button-transition-enter-active {
              transition:
                opacity 0.3s,
                transform 0.3s;
              opacity: 1;
            }

            & .tsqd-button-transition-exit-to,
            & .tsqd-button-transition-enter {
              transform: ${"relative"===u()?"none;":"top-left"===u()?"translateX(-72px);":"top-right"===u()?"translateX(72px);":"translateY(72px);"};
              opacity: 0;
            }
          `,"tsqd-transitions-container"))),t)]},ow=e=>{var t;let r=S(),n=L(),i=$().shadowDOMTarget?V.bind({target:$().shadowDOMTarget}):V,o=(0,l.dD)(()=>"dark"===n()?oB(i):oR(i)),a=()=>{let{colors:e}=nF,t=(e,t)=>"dark"===n()?t:e;return 796>oy()?i`
        flex-direction: column;
        background-color: ${t(e.gray[300],e.gray[600])};
      `:i`
      flex-direction: row;
      background-color: ${t(e.gray[200],e.darkGray[900])};
    `};return(0,l.GW)(()=>{let e=r().pipWindow,t=()=>{e&&ov(e.innerWidth)};e&&(e.addEventListener("resize",t),t()),(0,l.$W)(()=>{e&&e.removeEventListener("resize",t)})}),(t=iH()).style.setProperty("--tsqd-font-size","16px"),t.style.setProperty("max-height","100vh"),t.style.setProperty("height","100vh"),t.style.setProperty("width","100vw"),(0,l.$T)(t,()=>e.children),(0,l.F3)(()=>(0,l.ok)(t,Q(o().panel,a(),{[i`
            min-width: min-content;
          `]:700>oy()},"tsqd-main-panel"))),t},o$=e=>{var t,r;let n;let i=L(),o=$().shadowDOMTarget?V.bind({target:$().shadowDOMTarget}):V,a=(0,l.dD)(()=>"dark"===i()?oB(o):oR(o));(0,l.H3)(()=>{ee(n,({width:e},t)=>{t===n&&ov(e)})});let s=()=>{let{colors:e}=nF,t=(e,t)=>"dark"===i()?t:e;return 796>oy()?o`
        flex-direction: column;
        background-color: ${t(e.gray[300],e.gray[600])};
      `:o`
      flex-direction: row;
      background-color: ${t(e.gray[200],e.darkGray[900])};
    `};return t=iH(),"function"==typeof(r=n)?(0,l.D$)(r,t):n=t,t.style.setProperty("--tsqd-font-size","16px"),(0,l.$T)(t,()=>e.children),(0,l.F3)(()=>(0,l.ok)(t,Q(a().parentPanel,s(),{[o`
            min-width: min-content;
          `]:700>oy()},"tsqd-main-panel"))),t},ok=e=>{var t,r,n,i;let o;let a=L(),s=$().shadowDOMTarget?V.bind({target:$().shadowDOMTarget}):V,d=(0,l.dD)(()=>"dark"===a()?oB(s):oR(s)),[u,c]=(0,l.gQ)(!1),g=(0,l.dD)(()=>e.localStore.position||$().position||v);(0,l.H3)(()=>{ee(o,({width:e},t)=>{t===o&&ov(e)})}),(0,l.GW)(()=>{let t=o.parentElement?.parentElement?.parentElement;if(!t)return;let r=e.localStore.position||v,n=(0,l.jk)("padding",r),i="left"===e.localStore.position||"right"===e.localStore.position,a=(({padding:e,paddingTop:t,paddingBottom:r,paddingLeft:n,paddingRight:i})=>({padding:e,paddingTop:t,paddingBottom:r,paddingLeft:n,paddingRight:i}))(t.style);t.style[n]=`${i?e.localStore.width:e.localStore.height}px`,(0,l.$W)(()=>{Object.entries(a).forEach(([e,r])=>{t.style[e]=r})})});let f=()=>{let{colors:e}=nF,t=(e,t)=>"dark"===a()?t:e;return 796>oy()?s`
        flex-direction: column;
        background-color: ${t(e.gray[300],e.gray[600])};
      `:s`
      flex-direction: row;
      background-color: ${t(e.gray[200],e.darkGray[900])};
    `};return n=(r=(t=iW()).firstChild).nextSibling,"function"==typeof(i=o)?(0,l.D$)(i,t):o=t,r.$$mousedown=t=>{let r=t.currentTarget.parentElement;if(!r)return;c(!0);let{height:n,width:i}=r.getBoundingClientRect(),o=t.clientX,a=t.clientY,s=0,d=(0,l.H9)(3.5),f=(0,l.H9)(12),p=t=>{if(t.preventDefault(),"left"===g()||"right"===g()){(s=Math.round(i+("right"===g()?o-t.clientX:t.clientX-o)))<f&&(s=f),e.setLocalStore("width",String(Math.round(s)));let n=r.getBoundingClientRect().width;Number(e.localStore.width)<n&&e.setLocalStore("width",String(n))}else(s=Math.round(n+("bottom"===g()?a-t.clientY:t.clientY-a)))<d&&(s=d,of(null)),e.setLocalStore("height",String(Math.round(s)))},h=()=>{u()&&c(!1),document.removeEventListener("mousemove",p,!1),document.removeEventListener("mouseUp",h,!1)};document.addEventListener("mousemove",p,!1),document.addEventListener("mouseup",h,!1)},n.$$click=()=>e.setLocalStore("open","false"),(0,l.$T)(n,(0,l.LM)(n5,{})),(0,l.$T)(t,(0,l.LM)(oM,e),null),(0,l.F3)(i=>{var o=Q(d().panel,d()[`panel-position-${g()}`],f(),{[s`
            min-width: min-content;
          `]:700>oy()&&("right"===g()||"left"===g())},"tsqd-main-panel"),a="bottom"===g()||"top"===g()?`${e.localStore.height||500}px`:"auto",u="right"===g()||"left"===g()?`${e.localStore.width||500}px`:"auto",c=Q(d().dragHandle,d()[`dragHandle-position-${g()}`],"tsqd-drag-handle"),p=Q(d().closeBtn,d()[`closeBtn-position-${g()}`],"tsqd-minimize-btn");return o!==i.e&&(0,l.ok)(t,i.e=o),a!==i.t&&(null!=(i.t=a)?t.style.setProperty("height",a):t.style.removeProperty("height")),u!==i.a&&(null!=(i.a=u)?t.style.setProperty("width",u):t.style.removeProperty("width")),c!==i.o&&(0,l.ok)(r,i.o=c),p!==i.i&&(0,l.ok)(n,i.i=p),i},{e:void 0,t:void 0,a:void 0,o:void 0,i:void 0}),t},oM=e=>{var t,r,n,i,o,a,s,d,u,c,g,f,p,h,y,v,b,w;let k;oP(),oO();let M=L(),C=$().shadowDOMTarget?V.bind({target:$().shadowDOMTarget}):V,q=(0,l.dD)(()=>"dark"===M()?oB(C):oR(C)),T=S(),[E,F]=(0,l.gQ)("queries"),P=(0,l.dD)(()=>e.localStore.sort||m),A=(0,l.dD)(()=>Number(e.localStore.sortOrder)||1),z=(0,l.dD)(()=>e.localStore.mutationSort||x),O=(0,l.dD)(()=>Number(e.localStore.mutationSortOrder)||1),I=(0,l.dD)(()=>l.QR[P()]),K=(0,l.dD)(()=>l.kw[z()]),G=(0,l.dD)(()=>$().onlineManager),R=(0,l.dD)(()=>$().client.getQueryCache()),B=(0,l.dD)(()=>$().client.getMutationCache()),H=oA(e=>e().getAll().length,!1),W=(0,l.dD)((0,l.on)(()=>[H(),e.localStore.filter,P(),A()],()=>{let t=R().getAll(),r=e.localStore.filter?t.filter(t=>D(t.queryHash,e.localStore.filter||"").passed):[...t];return I()?r.sort((e,t)=>I()(e,t)*A()):r})),U=oI(e=>e().getAll().length,!1),N=(0,l.dD)((0,l.on)(()=>[U(),e.localStore.mutationFilter,z(),O()],()=>{let t=B().getAll(),r=e.localStore.mutationFilter?t.filter(t=>D(`${t.options.mutationKey?JSON.stringify(t.options.mutationKey)+" - ":""}${new Date(t.state.submittedAt).toLocaleString()}`,e.localStore.mutationFilter||"").passed):[...t];return K()?r.sort((e,t)=>K()(e,t)*O()):r})),j=t=>{e.setLocalStore("position",t)},X=e=>{let t=getComputedStyle(k).getPropertyValue("--tsqd-font-size");e.style.setProperty("--tsqd-font-size",t)};return[(s=(a=(o=(i=(n=(r=(t=i9()).firstChild).firstChild).firstChild).firstChild).nextSibling).firstChild,g=(c=(u=(d=r.nextSibling).firstChild).firstChild).firstChild,p=(f=c.nextSibling).nextSibling,v=(y=(h=u.nextSibling).firstChild).nextSibling,"function"==typeof(b=k)?(0,l.D$)(b,t):k=t,i.$$click=()=>{if(!T().pipWindow&&!e.showPanelViewOnly){e.setLocalStore("open","false");return}e.onClose&&e.onClose()},(0,l.$T)(a,()=>$().queryFlavor,s),(0,l.$T)(a,()=>$().version,null),(0,l.$T)(n,(0,l.LM)(rx.Root,{get class(){return Q(q().viewToggle)},get value(){return E()},onChange:e=>{F(e),of(null),oh(null)},get children(){return[(0,l.LM)(rx.Item,{value:"queries",class:"tsqd-radio-toggle",get children(){return[(0,l.LM)(rx.ItemInput,{}),(0,l.LM)(rx.ItemControl,{get children(){return(0,l.LM)(rx.ItemIndicator,{})}}),(0,l.LM)(rx.ItemLabel,{title:"Toggle Queries View",children:"Queries"})]}}),(0,l.LM)(rx.Item,{value:"mutations",class:"tsqd-radio-toggle",get children(){return[(0,l.LM)(rx.ItemInput,{}),(0,l.LM)(rx.ItemControl,{get children(){return(0,l.LM)(rx.ItemIndicator,{})}}),(0,l.LM)(rx.ItemLabel,{title:"Toggle Mutations View",children:"Mutations"})]}})]}}),null),(0,l.$T)(r,(0,l.LM)(l.di,{get when(){return"queries"===E()},get children(){return(0,l.LM)(oL,{})}}),null),(0,l.$T)(r,(0,l.LM)(l.di,{get when(){return"mutations"===E()},get children(){return(0,l.LM)(oq,{})}}),null),(0,l.$T)(c,(0,l.LM)(n2,{}),g),g.$$input=t=>{"queries"===E()?e.setLocalStore("filter",t.currentTarget.value):e.setLocalStore("mutationFilter",t.currentTarget.value)},(0,l.$T)(f,(0,l.LM)(l.di,{get when(){return"queries"===E()},get children(){var _=iU();return _.addEventListener("change",t=>{e.setLocalStore("sort",t.currentTarget.value)}),(0,l.$T)(_,()=>Object.keys(l.QR).map(e=>{var t;return(t=i8()).firstChild,t.value=e,(0,l.$T)(t,e,null),t})),(0,l.F3)(()=>_.value=P()),_}}),null),(0,l.$T)(f,(0,l.LM)(l.di,{get when(){return"mutations"===E()},get children(){var Y=iV();return Y.addEventListener("change",t=>{e.setLocalStore("mutationSort",t.currentTarget.value)}),(0,l.$T)(Y,()=>Object.keys(l.kw).map(e=>{var t;return(t=i8()).firstChild,t.value=e,(0,l.$T)(t,e,null),t})),(0,l.F3)(()=>Y.value=z()),Y}}),null),(0,l.$T)(f,(0,l.LM)(n5,{}),null),p.$$click=()=>{"queries"===E()?e.setLocalStore("sortOrder",String(-1*A())):e.setLocalStore("mutationSortOrder",String(-1*O()))},(0,l.$T)(p,(0,l.LM)(l.di,{get when(){return("queries"===E()?A():O())===1},get children(){return[iQ(),(0,l.LM)(n4,{})]}}),null),(0,l.$T)(p,(0,l.LM)(l.di,{get when(){return("queries"===E()?A():O())===-1},get children(){return[iN(),(0,l.LM)(n6,{})]}}),null),y.$$click=()=>{"queries"===E()?(oK({type:"CLEAR_QUERY_CACHE"}),R().clear()):(oK({type:"CLEAR_MUTATION_CACHE"}),B().clear())},(0,l.$T)(y,(0,l.LM)(n3,{})),v.$$click=()=>{G().setOnline(!G().isOnline())},(0,l.$T)(v,(w=(0,l.dD)(()=>!!ob()),()=>w()?(0,l.LM)(ii,{}):(0,l.LM)(ir,{}))),(0,l.$T)(h,(0,l.LM)(l.di,{get when(){return(0,l.dD)(()=>!T().pipWindow)()&&!T().disabled},get children(){var Z=ij();return Z.$$click=()=>{T().requestPipWindow(Number(window.innerWidth),Number(e.localStore.height??500))},(0,l.$T)(Z,(0,l.LM)(il,{})),(0,l.F3)(()=>(0,l.ok)(Z,Q(q().actionsBtn,"tsqd-actions-btn","tsqd-action-open-pip"))),Z}}),null),(0,l.$T)(h,(0,l.LM)(nq.Root,{gutter:4,get children(){return[(0,l.LM)(nq.Trigger,{get class(){return Q(q().actionsBtn,"tsqd-actions-btn","tsqd-action-settings")},get children(){return(0,l.LM)(io,{})}}),(0,l.LM)(nq.Portal,{ref:e=>X(e),get mount(){return(0,l.dD)(()=>!!T().pipWindow)()?T().pipWindow.document.body:document.body},get children(){return(0,l.LM)(nq.Content,{get class(){return Q(q().settingsMenu,"tsqd-settings-menu")},get children(){var ee;return[(ee=iX(),(0,l.F3)(()=>(0,l.ok)(ee,Q(q().settingsMenuHeader,"tsqd-settings-menu-header"))),ee),(0,l.LM)(l.di,{get when(){return!e.showPanelViewOnly},get children(){return(0,l.LM)(nq.Sub,{overlap:!0,gutter:8,shift:-4,get children(){return[(0,l.LM)(nq.SubTrigger,{get class(){return Q(q().settingsSubTrigger,"tsqd-settings-menu-sub-trigger","tsqd-settings-menu-sub-trigger-position")},get children(){return[i_(),(0,l.LM)(n5,{})]}}),(0,l.LM)(nq.Portal,{ref:e=>X(e),get mount(){return(0,l.dD)(()=>!!T().pipWindow)()?T().pipWindow.document.body:document.body},get children(){return(0,l.LM)(nq.SubContent,{get class(){return Q(q().settingsMenu,"tsqd-settings-submenu")},get children(){return[(0,l.LM)(nq.Item,{onSelect:()=>{j("top")},as:"button",get class(){return Q(q().settingsSubButton,"tsqd-settings-menu-position-btn","tsqd-settings-menu-position-btn-top")},get children(){return[iY(),(0,l.LM)(n4,{})]}}),(0,l.LM)(nq.Item,{onSelect:()=>{j("bottom")},as:"button",get class(){return Q(q().settingsSubButton,"tsqd-settings-menu-position-btn","tsqd-settings-menu-position-btn-bottom")},get children(){return[iZ(),(0,l.LM)(n6,{})]}}),(0,l.LM)(nq.Item,{onSelect:()=>{j("left")},as:"button",get class(){return Q(q().settingsSubButton,"tsqd-settings-menu-position-btn","tsqd-settings-menu-position-btn-left")},get children(){return[iJ(),(0,l.LM)(n9,{})]}}),(0,l.LM)(nq.Item,{onSelect:()=>{j("right")},as:"button",get class(){return Q(q().settingsSubButton,"tsqd-settings-menu-position-btn","tsqd-settings-menu-position-btn-right")},get children(){return[i0(),(0,l.LM)(n8,{})]}})]}})}})]}})}}),(0,l.LM)(nq.Sub,{overlap:!0,gutter:8,shift:-4,get children(){return[(0,l.LM)(nq.SubTrigger,{get class(){return Q(q().settingsSubTrigger,"tsqd-settings-menu-sub-trigger","tsqd-settings-menu-sub-trigger-position")},get children(){return[i1(),(0,l.LM)(n5,{})]}}),(0,l.LM)(nq.Portal,{ref:e=>X(e),get mount(){return(0,l.dD)(()=>!!T().pipWindow)()?T().pipWindow.document.body:document.body},get children(){return(0,l.LM)(nq.SubContent,{get class(){return Q(q().settingsMenu,"tsqd-settings-submenu")},get children(){return[(0,l.LM)(nq.Item,{onSelect:()=>{e.setLocalStore("theme_preference","light")},as:"button",get class(){return Q(q().settingsSubButton,"light"===e.localStore.theme_preference&&q().themeSelectedButton,"tsqd-settings-menu-position-btn","tsqd-settings-menu-position-btn-top")},get children(){return[i2(),(0,l.LM)(n7,{})]}}),(0,l.LM)(nq.Item,{onSelect:()=>{e.setLocalStore("theme_preference","dark")},as:"button",get class(){return Q(q().settingsSubButton,"dark"===e.localStore.theme_preference&&q().themeSelectedButton,"tsqd-settings-menu-position-btn","tsqd-settings-menu-position-btn-bottom")},get children(){return[i3(),(0,l.LM)(ie,{})]}}),(0,l.LM)(nq.Item,{onSelect:()=>{e.setLocalStore("theme_preference","system")},as:"button",get class(){return Q(q().settingsSubButton,"system"===e.localStore.theme_preference&&q().themeSelectedButton,"tsqd-settings-menu-position-btn","tsqd-settings-menu-position-btn-left")},get children(){return[i5(),(0,l.LM)(it,{})]}})]}})}})]}})]}})}})]}}),null),(0,l.$T)(t,(0,l.LM)(l.di,{get when(){return"queries"===E()},get children(){var et=i4(),er=et.firstChild;return(0,l.$T)(er,(0,l.LM)(J,{by:e=>e.queryHash,get each(){return W()},children:e=>(0,l.LM)(oS,{get query(){return e()}})})),(0,l.F3)(()=>(0,l.ok)(et,Q(q().overflowQueryContainer,"tsqd-queries-overflow-container"))),et}}),null),(0,l.$T)(t,(0,l.LM)(l.di,{get when(){return"mutations"===E()},get children(){var en=i6(),ei=en.firstChild;return(0,l.$T)(ei,(0,l.LM)(J,{by:e=>e.mutationId,get each(){return N()},children:e=>(0,l.LM)(oC,{get mutation(){return e()}})})),(0,l.F3)(()=>(0,l.ok)(en,Q(q().overflowQueryContainer,"tsqd-mutations-overflow-container"))),en}}),null),(0,l.F3)(e=>{var s=Q(q().queriesContainer,796>oy()&&(og()||op())&&C`
              height: 50%;
              max-height: 50%;
            `,796>oy()&&!(og()||op())&&C`
              height: 100%;
              max-height: 100%;
            `,"tsqd-queries-container"),b=Q(q().row,"tsqd-header"),m=q().logoAndToggleContainer,x=Q(q().logo,"tsqd-text-logo-container"),w=Q(q().tanstackLogo,"tsqd-text-logo-tanstack"),$=Q(q().queryFlavorLogo,"tsqd-text-logo-query-flavor"),k=Q(q().row,"tsqd-filters-actions-container"),M=Q(q().filtersContainer,"tsqd-filters-container"),S=Q(q().filterInput,"tsqd-query-filter-textfield-container"),L=Q("tsqd-query-filter-textfield"),T=Q(q().filterSelect,"tsqd-query-filter-sort-container"),D=`Sort order ${("queries"===E()?A():O())===-1?"descending":"ascending"}`,F=("queries"===E()?A():O())===-1,P=Q(q().actionsContainer,"tsqd-actions-container"),z=Q(q().actionsBtn,"tsqd-actions-btn","tsqd-action-clear-cache"),I=`Clear ${E()} cache`,K=Q(q().actionsBtn,ob()&&q().actionsBtnOffline,"tsqd-actions-btn","tsqd-action-mock-offline-behavior"),G=`${ob()?"Unset offline mocking behavior":"Mock offline behavior"}`,R=ob(),B=`${ob()?"Unset offline mocking behavior":"Mock offline behavior"}`;return s!==e.e&&(0,l.ok)(t,e.e=s),b!==e.t&&(0,l.ok)(r,e.t=b),m!==e.a&&(0,l.ok)(n,e.a=m),x!==e.o&&(0,l.ok)(i,e.o=x),w!==e.i&&(0,l.ok)(o,e.i=w),$!==e.n&&(0,l.ok)(a,e.n=$),k!==e.s&&(0,l.ok)(d,e.s=k),M!==e.h&&(0,l.ok)(u,e.h=M),S!==e.r&&(0,l.ok)(c,e.r=S),L!==e.d&&(0,l.ok)(g,e.d=L),T!==e.l&&(0,l.ok)(f,e.l=T),D!==e.u&&(0,l.P$)(p,"aria-label",e.u=D),F!==e.c&&(0,l.P$)(p,"aria-pressed",e.c=F),P!==e.w&&(0,l.ok)(h,e.w=P),z!==e.m&&(0,l.ok)(y,e.m=z),I!==e.f&&(0,l.P$)(y,"title",e.f=I),K!==e.y&&(0,l.ok)(v,e.y=K),G!==e.g&&(0,l.P$)(v,"aria-label",e.g=G),R!==e.p&&(0,l.P$)(v,"aria-pressed",e.p=R),B!==e.b&&(0,l.P$)(v,"title",e.b=B),e},{e:void 0,t:void 0,a:void 0,o:void 0,i:void 0,n:void 0,s:void 0,h:void 0,r:void 0,d:void 0,l:void 0,u:void 0,c:void 0,w:void 0,m:void 0,f:void 0,y:void 0,g:void 0,p:void 0,b:void 0}),(0,l.F3)(()=>g.value="queries"===E()?e.localStore.filter||"":e.localStore.mutationFilter||""),t),(0,l.LM)(l.di,{get when(){return(0,l.dD)(()=>"queries"===E())()&&og()},get children(){return(0,l.LM)(oE,{})}}),(0,l.LM)(l.di,{get when(){return(0,l.dD)(()=>"mutations"===E())()&&op()},get children(){return(0,l.LM)(oD,{})}})]},oS=e=>{let t=L(),r=$().shadowDOMTarget?V.bind({target:$().shadowDOMTarget}):V,n=(0,l.dD)(()=>"dark"===t()?oB(r):oR(r)),{colors:i,alpha:o}=nF,a=(e,r)=>"dark"===t()?r:e,s=oA(t=>t().find({queryKey:e.query.queryKey})?.state,!0,t=>t.query.queryHash===e.query.queryHash),d=oA(t=>t().find({queryKey:e.query.queryKey})?.isDisabled()??!1,!0,t=>t.query.queryHash===e.query.queryHash),u=oA(t=>t().find({queryKey:e.query.queryKey})?.isStatic()??!1,!0,t=>t.query.queryHash===e.query.queryHash),c=oA(t=>t().find({queryKey:e.query.queryKey})?.isStale()??!1,!0,t=>t.query.queryHash===e.query.queryHash),g=oA(t=>t().find({queryKey:e.query.queryKey})?.getObserversCount()??0,!0,t=>t.query.queryHash===e.query.queryHash),f=(0,l.dD)(()=>(0,l._y)({queryState:s(),observerCount:g(),isStale:c()})),p=()=>"gray"===f()?r`
        background-color: ${a(i[f()][200],i[f()][700])};
        color: ${a(i[f()][700],i[f()][300])};
      `:r`
      background-color: ${a(i[f()][200]+o[80],i[f()][900])};
      color: ${a(i[f()][800],i[f()][300])};
    `;return(0,l.LM)(l.di,{get when(){return s()},get children(){var h=ot(),y=h.firstChild,v=y.nextSibling;return h.$$click=()=>of(e.query.queryHash===og()?null:e.query.queryHash),(0,l.$T)(y,g),(0,l.$T)(v,()=>e.query.queryHash),(0,l.$T)(h,(0,l.LM)(l.di,{get when(){return d()},get children(){return i7()}}),null),(0,l.$T)(h,(0,l.LM)(l.di,{get when(){return u()},get children(){return oe()}}),null),(0,l.F3)(t=>{var r=Q(n().queryRow,og()===e.query.queryHash&&n().selectedQueryRow,"tsqd-query-row"),i=`Query key ${e.query.queryHash}`,o=Q(p(),"tsqd-query-observer-count");return r!==t.e&&(0,l.ok)(h,t.e=r),i!==t.t&&(0,l.P$)(h,"aria-label",t.t=i),o!==t.a&&(0,l.ok)(y,t.a=o),t},{e:void 0,t:void 0,a:void 0}),h}})},oC=e=>{let t=L(),r=$().shadowDOMTarget?V.bind({target:$().shadowDOMTarget}):V,n=(0,l.dD)(()=>"dark"===t()?oB(r):oR(r)),{colors:i,alpha:o}=nF,a=(e,r)=>"dark"===t()?r:e,s=oI(t=>{let r=t().getAll().find(t=>t.mutationId===e.mutation.mutationId);return r?.state}),d=oI(t=>{let r=t().getAll().find(t=>t.mutationId===e.mutation.mutationId);return!!r&&r.state.isPaused}),u=oI(t=>{let r=t().getAll().find(t=>t.mutationId===e.mutation.mutationId);return r?r.state.status:"idle"}),c=(0,l.dD)(()=>(0,l.IZ)({isPaused:d(),status:u()})),g=()=>"gray"===c()?r`
        background-color: ${a(i[c()][200],i[c()][700])};
        color: ${a(i[c()][700],i[c()][300])};
      `:r`
      background-color: ${a(i[c()][200]+o[80],i[c()][900])};
      color: ${a(i[c()][800],i[c()][300])};
    `;return(0,l.LM)(l.di,{get when(){return s()},get children(){var f=ot(),p=f.firstChild,h=p.nextSibling;return f.$$click=()=>{oh(e.mutation.mutationId===op()?null:e.mutation.mutationId)},(0,l.$T)(p,(0,l.LM)(l.di,{get when(){return"purple"===c()},get children(){return(0,l.LM)(iv,{})}}),null),(0,l.$T)(p,(0,l.LM)(l.di,{get when(){return"green"===c()},get children(){return(0,l.LM)(ip,{})}}),null),(0,l.$T)(p,(0,l.LM)(l.di,{get when(){return"red"===c()},get children(){return(0,l.LM)(iy,{})}}),null),(0,l.$T)(p,(0,l.LM)(l.di,{get when(){return"yellow"===c()},get children(){return(0,l.LM)(ih,{})}}),null),(0,l.$T)(h,(0,l.LM)(l.di,{get when(){return e.mutation.options.mutationKey},get children(){return[(0,l.dD)(()=>JSON.stringify(e.mutation.options.mutationKey))," -"," "]}}),null),(0,l.$T)(h,()=>new Date(e.mutation.state.submittedAt).toLocaleString(),null),(0,l.F3)(t=>{var r=Q(n().queryRow,op()===e.mutation.mutationId&&n().selectedQueryRow,"tsqd-query-row"),i=`Mutation submitted at ${new Date(e.mutation.state.submittedAt).toLocaleString()}`,o=Q(g(),"tsqd-query-observer-count");return r!==t.e&&(0,l.ok)(f,t.e=r),i!==t.t&&(0,l.P$)(f,"aria-label",t.t=i),o!==t.a&&(0,l.ok)(p,t.a=o),t},{e:void 0,t:void 0,a:void 0}),f}})},oL=()=>{var e;let t=oA(e=>e().getAll().filter(e=>"stale"===(0,l.V_)(e)).length),r=oA(e=>e().getAll().filter(e=>"fresh"===(0,l.V_)(e)).length),n=oA(e=>e().getAll().filter(e=>"fetching"===(0,l.V_)(e)).length),i=oA(e=>e().getAll().filter(e=>"paused"===(0,l.V_)(e)).length),o=oA(e=>e().getAll().filter(e=>"inactive"===(0,l.V_)(e)).length),a=L(),s=$().shadowDOMTarget?V.bind({target:$().shadowDOMTarget}):V,d=(0,l.dD)(()=>"dark"===a()?oB(s):oR(s));return e=iH(),(0,l.$T)(e,(0,l.LM)(oT,{label:"Fresh",color:"green",get count(){return r()}}),null),(0,l.$T)(e,(0,l.LM)(oT,{label:"Fetching",color:"blue",get count(){return n()}}),null),(0,l.$T)(e,(0,l.LM)(oT,{label:"Paused",color:"purple",get count(){return i()}}),null),(0,l.$T)(e,(0,l.LM)(oT,{label:"Stale",color:"yellow",get count(){return t()}}),null),(0,l.$T)(e,(0,l.LM)(oT,{label:"Inactive",color:"gray",get count(){return o()}}),null),(0,l.F3)(()=>(0,l.ok)(e,Q(d().queryStatusContainer,"tsqd-query-status-container"))),e},oq=()=>{var e;let t=oI(e=>e().getAll().filter(e=>"green"===(0,l.IZ)({isPaused:e.state.isPaused,status:e.state.status})).length),r=oI(e=>e().getAll().filter(e=>"yellow"===(0,l.IZ)({isPaused:e.state.isPaused,status:e.state.status})).length),n=oI(e=>e().getAll().filter(e=>"purple"===(0,l.IZ)({isPaused:e.state.isPaused,status:e.state.status})).length),i=oI(e=>e().getAll().filter(e=>"red"===(0,l.IZ)({isPaused:e.state.isPaused,status:e.state.status})).length),o=L(),a=$().shadowDOMTarget?V.bind({target:$().shadowDOMTarget}):V,s=(0,l.dD)(()=>"dark"===o()?oB(a):oR(a));return e=iH(),(0,l.$T)(e,(0,l.LM)(oT,{label:"Paused",color:"purple",get count(){return n()}}),null),(0,l.$T)(e,(0,l.LM)(oT,{label:"Pending",color:"yellow",get count(){return r()}}),null),(0,l.$T)(e,(0,l.LM)(oT,{label:"Success",color:"green",get count(){return t()}}),null),(0,l.$T)(e,(0,l.LM)(oT,{label:"Error",color:"red",get count(){return i()}}),null),(0,l.F3)(()=>(0,l.ok)(e,Q(s().queryStatusContainer,"tsqd-query-status-container"))),e},oT=e=>{var t,r,n,i;let o;let a=L(),s=$().shadowDOMTarget?V.bind({target:$().shadowDOMTarget}):V,d=(0,l.dD)(()=>"dark"===a()?oB(s):oR(s)),{colors:u,alpha:c}=nF,g=(e,t)=>"dark"===a()?t:e,[f,p]=(0,l.gQ)(!1),[h,y]=(0,l.gQ)(!1),v=(0,l.dD)(()=>!(og()&&1024>oy()&&oy()>796||796>oy()));return n=(r=(t=oi()).firstChild).nextSibling,"function"==typeof(i=o)?(0,l.D$)(i,t):o=t,t.addEventListener("mouseleave",()=>{p(!1),y(!1)}),t.addEventListener("mouseenter",()=>p(!0)),t.addEventListener("blur",()=>y(!1)),t.addEventListener("focus",()=>y(!0)),(0,l.hw)(t,(0,l.dG)({get disabled(){return v()},get class(){return Q(d().queryStatusTag,!v()&&s`
            cursor: pointer;
            &:hover {
              background: ${g(u.gray[200],u.darkGray[400])}${c[80]};
            }
          `,"tsqd-query-status-tag",`tsqd-query-status-tag-${e.label.toLowerCase()}`)}},()=>f()||h()?{"aria-describedby":"tsqd-status-tooltip"}:{}),!1,!0),(0,l.$T)(t,(0,l.LM)(l.di,{get when(){return(0,l.dD)(()=>!v())()&&(f()||h())},get children(){var b=or();return(0,l.$T)(b,()=>e.label),(0,l.F3)(()=>(0,l.ok)(b,Q(d().statusTooltip,"tsqd-query-status-tooltip"))),b}}),r),(0,l.$T)(t,(0,l.LM)(l.di,{get when(){return v()},get children(){var m=on();return(0,l.$T)(m,()=>e.label),(0,l.F3)(()=>(0,l.ok)(m,Q(d().queryStatusTagLabel,"tsqd-query-status-tag-label"))),m}}),n),(0,l.$T)(n,()=>e.count),(0,l.F3)(t=>{var i=Q(s`
            width: ${nF.size[1.5]};
            height: ${nF.size[1.5]};
            border-radius: ${nF.border.radius.full};
            background-color: ${nF.colors[e.color][500]};
          `,"tsqd-query-status-tag-dot"),o=Q(d().queryStatusCount,e.count>0&&"gray"!==e.color&&s`
              background-color: ${g(u[e.color][100],u[e.color][900])};
              color: ${g(u[e.color][700],u[e.color][300])};
            `,"tsqd-query-status-tag-count");return i!==t.e&&(0,l.ok)(r,t.e=i),o!==t.t&&(0,l.ok)(n,t.t=o),t},{e:void 0,t:void 0}),t},oE=()=>{let e=L(),t=$().shadowDOMTarget?V.bind({target:$().shadowDOMTarget}):V,r=(0,l.dD)(()=>"dark"===e()?oB(t):oR(t)),{colors:n}=nF,i=(t,r)=>"dark"===e()?r:t,o=$().client,[a,s]=(0,l.gQ)(!1),[d,u]=(0,l.gQ)("view"),[c,g]=(0,l.gQ)(!1),f=(0,l.dD)(()=>$().errorTypes||[]),p=oA(e=>e().getAll().find(e=>e.queryHash===og()),!1),h=oA(e=>e().getAll().find(e=>e.queryHash===og()),!1),y=oA(e=>e().getAll().find(e=>e.queryHash===og())?.state,!1),v=oA(e=>e().getAll().find(e=>e.queryHash===og())?.state.data,!1),b=oA(e=>{let t=e().getAll().find(e=>e.queryHash===og());return t?(0,l.V_)(t):"inactive"}),m=oA(e=>{let t=e().getAll().find(e=>e.queryHash===og());return t?t.state.status:"pending"}),x=oA(e=>e().getAll().find(e=>e.queryHash===og())?.getObserversCount()??0),w=(0,l.dD)(()=>(0,l.WU)(b())),k=()=>{oK({type:"REFETCH",queryHash:p()?.queryHash});let e=p()?.fetch();e?.catch(()=>{})},M=e=>{let t=p();if(!t)return;oK({type:"TRIGGER_ERROR",queryHash:t.queryHash,metadata:{error:e?.name}});let r=e?.initializer(t)??Error("Unknown error from devtools"),n=t.options;t.setState({status:"error",error:r,fetchMeta:{...t.state.fetchMeta,__previousQueryOptions:n}})},S=()=>{let e=p();if(!e)return;oK({type:"RESTORE_LOADING",queryHash:e.queryHash});let t=e.state,r=e.state.fetchMeta?e.state.fetchMeta.__previousQueryOptions:null;e.cancel({silent:!0}),e.setState({...t,fetchStatus:"idle",fetchMeta:null}),r&&e.fetch(r)};(0,l.GW)(()=>{"fetching"!==b()&&s(!1)});let C=()=>"gray"===w()?t`
        background-color: ${i(n[w()][200],n[w()][700])};
        color: ${i(n[w()][700],n[w()][300])};
        border-color: ${i(n[w()][400],n[w()][600])};
      `:t`
      background-color: ${i(n[w()][100],n[w()][900])};
      color: ${i(n[w()][700],n[w()][300])};
      border-color: ${i(n[w()][400],n[w()][600])};
    `;return(0,l.LM)(l.di,{get when(){return(0,l.dD)(()=>!!p())()&&y()},get children(){var q=od(),T=q.firstChild,E=T.nextSibling,D=E.firstChild,F=D.firstChild,P=F.firstChild,A=F.nextSibling,z=D.nextSibling,O=z.firstChild.nextSibling,I=z.nextSibling.firstChild.nextSibling,K=E.nextSibling,G=K.nextSibling,R=G.firstChild,B=R.firstChild,H=R.nextSibling,W=H.firstChild,U=H.nextSibling,N=U.firstChild,j=U.nextSibling,X=j.firstChild,_=j.nextSibling,Y=_.firstChild,Z=Y.nextSibling,J=G.nextSibling;J.firstChild;var ee=J.nextSibling,et=ee.nextSibling;return(0,l.$T)(P,()=>(0,l.AI)(p().queryKey,!0)),(0,l.$T)(A,b),(0,l.$T)(O,x),(0,l.$T)(I,()=>new Date(y().dataUpdatedAt).toLocaleTimeString()),R.$$click=k,H.$$click=()=>{oK({type:"INVALIDATE",queryHash:p()?.queryHash}),o.invalidateQueries(p())},U.$$click=()=>{oK({type:"RESET",queryHash:p()?.queryHash}),o.resetQueries(p())},j.$$click=()=>{oK({type:"REMOVE",queryHash:p()?.queryHash}),o.removeQueries(p()),of(null)},_.$$click=()=>{if(p()?.state.data===void 0)s(!0),S();else{let e=p();if(!e)return;oK({type:"TRIGGER_LOADING",queryHash:e.queryHash});let t=e.options;e.fetch({...t,queryFn:()=>new Promise(()=>{}),gcTime:-1}),e.setState({data:void 0,status:"pending",fetchMeta:{...e.state.fetchMeta,__previousQueryOptions:t}})}},(0,l.$T)(_,()=>"pending"===m()?"Restore":"Trigger",Z),(0,l.$T)(G,(0,l.LM)(l.di,{get when(){return 0===f().length||"error"===m()},get children(){var er=oo(),en=er.firstChild,ei=en.nextSibling;return er.$$click=()=>{p().state.error?(oK({type:"RESTORE_ERROR",queryHash:p()?.queryHash}),o.resetQueries(p())):M()},(0,l.$T)(er,()=>"error"===m()?"Restore":"Trigger",ei),(0,l.F3)(e=>{var r=Q(t`
                  color: ${i(n.red[500],n.red[400])};
                `,"tsqd-query-details-actions-btn","tsqd-query-details-action-error"),o="pending"===m(),a=t`
                  background-color: ${i(n.red[500],n.red[400])};
                `;return r!==e.e&&(0,l.ok)(er,e.e=r),o!==e.t&&(er.disabled=e.t=o),a!==e.a&&(0,l.ok)(en,e.a=a),e},{e:void 0,t:void 0,a:void 0}),er}}),null),(0,l.$T)(G,(0,l.LM)(l.di,{get when(){return!(0===f().length||"error"===m())},get children(){var eo=ol(),el=eo.firstChild,ea=el.nextSibling.nextSibling;return ea.firstChild,ea.addEventListener("change",e=>{M(f().find(t=>t.name===e.currentTarget.value))}),(0,l.$T)(ea,(0,l.LM)(l.U2,{get each(){return f()},children:e=>{var t;return t=ou(),(0,l.$T)(t,()=>e.name),(0,l.F3)(()=>t.value=e.name),t}}),null),(0,l.$T)(eo,(0,l.LM)(n5,{}),null),(0,l.F3)(e=>{var n=Q(r().actionsSelect,"tsqd-query-details-actions-btn","tsqd-query-details-action-error-multiple"),i=t`
                  background-color: ${nF.colors.red[400]};
                `,o="pending"===m();return n!==e.e&&(0,l.ok)(eo,e.e=n),i!==e.t&&(0,l.ok)(el,e.t=i),o!==e.a&&(ea.disabled=e.a=o),e},{e:void 0,t:void 0,a:void 0}),eo}}),null),(0,l.$T)(J,()=>"view"===d()?"Explorer":"Editor",null),(0,l.$T)(q,(0,l.LM)(l.di,{get when(){return"view"===d()},get children(){var es=oa();return(0,l.$T)(es,(0,l.LM)(iI,{label:"Data",defaultExpanded:["Data"],get value(){return v()},editable:!0,onEdit:()=>u("edit"),get activeQuery(){return p()}})),(0,l.F3)(e=>null!=(e=nF.size[2])?es.style.setProperty("padding",e):es.style.removeProperty("padding")),es}}),ee),(0,l.$T)(q,(0,l.LM)(l.di,{get when(){return"edit"===d()},get children(){var ed=os(),eu=ed.firstChild,ec=eu.nextSibling,eg=ec.firstChild,ef=eg.nextSibling,ep=ef.firstChild,eh=ep.nextSibling;return ed.addEventListener("submit",e=>{e.preventDefault();let t=new FormData(e.currentTarget).get("data");try{let e=JSON.parse(t);p().setState({...p().state,data:e}),u("view")}catch(e){g(!0)}}),eu.addEventListener("focus",()=>g(!1)),(0,l.$T)(eg,()=>c()?"Invalid Value":""),ep.$$click=()=>u("view"),(0,l.F3)(e=>{var o=Q(r().devtoolsEditForm,"tsqd-query-details-data-editor"),a=r().devtoolsEditTextarea,s=c(),d=r().devtoolsEditFormActions,u=r().devtoolsEditFormError,g=r().devtoolsEditFormActionContainer,f=Q(r().devtoolsEditFormAction,t`
                      color: ${i(n.gray[600],n.gray[300])};
                    `),p=Q(r().devtoolsEditFormAction,t`
                      color: ${i(n.blue[600],n.blue[400])};
                    `);return o!==e.e&&(0,l.ok)(ed,e.e=o),a!==e.t&&(0,l.ok)(eu,e.t=a),s!==e.a&&(0,l.P$)(eu,"data-error",e.a=s),d!==e.o&&(0,l.ok)(ec,e.o=d),u!==e.i&&(0,l.ok)(eg,e.i=u),g!==e.n&&(0,l.ok)(ef,e.n=g),f!==e.s&&(0,l.ok)(ep,e.s=f),p!==e.h&&(0,l.ok)(eh,e.h=p),e},{e:void 0,t:void 0,a:void 0,o:void 0,i:void 0,n:void 0,s:void 0,h:void 0}),(0,l.F3)(()=>eu.value=JSON.stringify(v(),null,2)),ed}}),ee),(0,l.$T)(et,(0,l.LM)(iI,{label:"Query",defaultExpanded:["Query","queryKey"],get value(){return h()}})),(0,l.F3)(e=>{var o=Q(r().detailsContainer,"tsqd-query-details-container"),s=Q(r().detailsHeader,"tsqd-query-details-header"),d=Q(r().detailsBody,"tsqd-query-details-summary-container"),u=Q(r().queryDetailsStatus,C()),c=Q(r().detailsHeader,"tsqd-query-details-header"),g=Q(r().actionsBody,"tsqd-query-details-actions-container"),f=Q(t`
                color: ${i(n.blue[600],n.blue[400])};
              `,"tsqd-query-details-actions-btn","tsqd-query-details-action-refetch"),p="fetching"===b(),h=t`
                background-color: ${i(n.blue[600],n.blue[400])};
              `,y=Q(t`
                color: ${i(n.yellow[600],n.yellow[400])};
              `,"tsqd-query-details-actions-btn","tsqd-query-details-action-invalidate"),v="pending"===m(),x=t`
                background-color: ${i(n.yellow[600],n.yellow[400])};
              `,w=Q(t`
                color: ${i(n.gray[600],n.gray[300])};
              `,"tsqd-query-details-actions-btn","tsqd-query-details-action-reset"),$="pending"===m(),k=t`
                background-color: ${i(n.gray[600],n.gray[400])};
              `,M=Q(t`
                color: ${i(n.pink[500],n.pink[400])};
              `,"tsqd-query-details-actions-btn","tsqd-query-details-action-remove"),S="fetching"===b(),L=t`
                background-color: ${i(n.pink[500],n.pink[400])};
              `,D=Q(t`
                color: ${i(n.cyan[500],n.cyan[400])};
              `,"tsqd-query-details-actions-btn","tsqd-query-details-action-loading"),F=a(),P=t`
                background-color: ${i(n.cyan[500],n.cyan[400])};
              `,z=Q(r().detailsHeader,"tsqd-query-details-header"),O=Q(r().detailsHeader,"tsqd-query-details-header"),I=nF.size[2];return o!==e.e&&(0,l.ok)(q,e.e=o),s!==e.t&&(0,l.ok)(T,e.t=s),d!==e.a&&(0,l.ok)(E,e.a=d),u!==e.o&&(0,l.ok)(A,e.o=u),c!==e.i&&(0,l.ok)(K,e.i=c),g!==e.n&&(0,l.ok)(G,e.n=g),f!==e.s&&(0,l.ok)(R,e.s=f),p!==e.h&&(R.disabled=e.h=p),h!==e.r&&(0,l.ok)(B,e.r=h),y!==e.d&&(0,l.ok)(H,e.d=y),v!==e.l&&(H.disabled=e.l=v),x!==e.u&&(0,l.ok)(W,e.u=x),w!==e.c&&(0,l.ok)(U,e.c=w),$!==e.w&&(U.disabled=e.w=$),k!==e.m&&(0,l.ok)(N,e.m=k),M!==e.f&&(0,l.ok)(j,e.f=M),S!==e.y&&(j.disabled=e.y=S),L!==e.g&&(0,l.ok)(X,e.g=L),D!==e.p&&(0,l.ok)(_,e.p=D),F!==e.b&&(_.disabled=e.b=F),P!==e.T&&(0,l.ok)(Y,e.T=P),z!==e.A&&(0,l.ok)(J,e.A=z),O!==e.O&&(0,l.ok)(ee,e.O=O),I!==e.I&&(null!=(e.I=I)?et.style.setProperty("padding",I):et.style.removeProperty("padding")),e},{e:void 0,t:void 0,a:void 0,o:void 0,i:void 0,n:void 0,s:void 0,h:void 0,r:void 0,d:void 0,l:void 0,u:void 0,c:void 0,w:void 0,m:void 0,f:void 0,y:void 0,g:void 0,p:void 0,b:void 0,T:void 0,A:void 0,O:void 0,I:void 0}),q}})},oD=()=>{let e=L(),t=$().shadowDOMTarget?V.bind({target:$().shadowDOMTarget}):V,r=(0,l.dD)(()=>"dark"===e()?oB(t):oR(t)),{colors:n}=nF,i=(t,r)=>"dark"===e()?r:t,o=oI(e=>{let t=e().getAll().find(e=>e.mutationId===op());return!!t&&t.state.isPaused}),a=oI(e=>{let t=e().getAll().find(e=>e.mutationId===op());return t?t.state.status:"idle"}),s=(0,l.dD)(()=>(0,l.IZ)({isPaused:o(),status:a()})),d=oI(e=>e().getAll().find(e=>e.mutationId===op()),!1),u=()=>"gray"===s()?t`
        background-color: ${i(n[s()][200],n[s()][700])};
        color: ${i(n[s()][700],n[s()][300])};
        border-color: ${i(n[s()][400],n[s()][600])};
      `:t`
      background-color: ${i(n[s()][100],n[s()][900])};
      color: ${i(n[s()][700],n[s()][300])};
      border-color: ${i(n[s()][400],n[s()][600])};
    `;return(0,l.LM)(l.di,{get when(){return d()},get children(){var c=oc(),g=c.firstChild,f=g.nextSibling,p=f.firstChild,h=p.firstChild,y=h.firstChild,v=h.nextSibling,b=p.nextSibling.firstChild.nextSibling,m=f.nextSibling,x=m.nextSibling,w=x.nextSibling,k=w.nextSibling,M=k.nextSibling,S=M.nextSibling,C=S.nextSibling,q=C.nextSibling;return(0,l.$T)(y,(0,l.LM)(l.di,{get when(){return d().options.mutationKey},fallback:"No mutationKey found",get children(){return(0,l.AI)(d().options.mutationKey,!0)}})),(0,l.$T)(v,(0,l.LM)(l.di,{get when(){return"purple"===s()},children:"pending"}),null),(0,l.$T)(v,(0,l.LM)(l.di,{get when(){return"purple"!==s()},get children(){return a()}}),null),(0,l.$T)(b,()=>new Date(d().state.submittedAt).toLocaleTimeString()),(0,l.$T)(x,(0,l.LM)(iI,{label:"Variables",defaultExpanded:["Variables"],get value(){return d().state.variables}})),(0,l.$T)(k,(0,l.LM)(iI,{label:"Context",defaultExpanded:["Context"],get value(){return d().state.context}})),(0,l.$T)(S,(0,l.LM)(iI,{label:"Data",defaultExpanded:["Data"],get value(){return d().state.data}})),(0,l.$T)(q,(0,l.LM)(iI,{label:"Mutation",defaultExpanded:["Mutation"],get value(){return d()}})),(0,l.F3)(e=>{var t=Q(r().detailsContainer,"tsqd-query-details-container"),n=Q(r().detailsHeader,"tsqd-query-details-header"),i=Q(r().detailsBody,"tsqd-query-details-summary-container"),o=Q(r().queryDetailsStatus,u()),a=Q(r().detailsHeader,"tsqd-query-details-header"),s=nF.size[2],d=Q(r().detailsHeader,"tsqd-query-details-header"),p=nF.size[2],h=Q(r().detailsHeader,"tsqd-query-details-header"),y=nF.size[2],b=Q(r().detailsHeader,"tsqd-query-details-header"),$=nF.size[2];return t!==e.e&&(0,l.ok)(c,e.e=t),n!==e.t&&(0,l.ok)(g,e.t=n),i!==e.a&&(0,l.ok)(f,e.a=i),o!==e.o&&(0,l.ok)(v,e.o=o),a!==e.i&&(0,l.ok)(m,e.i=a),s!==e.n&&(null!=(e.n=s)?x.style.setProperty("padding",s):x.style.removeProperty("padding")),d!==e.s&&(0,l.ok)(w,e.s=d),p!==e.h&&(null!=(e.h=p)?k.style.setProperty("padding",p):k.style.removeProperty("padding")),h!==e.r&&(0,l.ok)(M,e.r=h),y!==e.d&&(null!=(e.d=y)?S.style.setProperty("padding",y):S.style.removeProperty("padding")),b!==e.l&&(0,l.ok)(C,e.l=b),$!==e.u&&(null!=(e.u=$)?q.style.setProperty("padding",$):q.style.removeProperty("padding")),e},{e:void 0,t:void 0,a:void 0,o:void 0,i:void 0,n:void 0,s:void 0,h:void 0,r:void 0,d:void 0,l:void 0,u:void 0}),c}})},oF=new Map,oP=()=>{let e=(0,l.dD)(()=>$().client.getQueryCache()),t=e().subscribe(t=>{(0,l.dC)(()=>{for(let[r,n]of oF.entries())n.shouldUpdate(t)&&n.setter(r(e))})});return(0,l.$W)(()=>{oF.clear(),t()}),t},oA=(e,t=!0,r=()=>!0)=>{let n=(0,l.dD)(()=>$().client.getQueryCache()),[i,o]=(0,l.gQ)(e(n),t?void 0:{equals:!1});return(0,l.GW)(()=>{o(e(n))}),oF.set(e,{setter:o,shouldUpdate:r}),(0,l.$W)(()=>{oF.delete(e)}),i},oz=new Map,oO=()=>{let e=(0,l.dD)(()=>$().client.getMutationCache()),t=e().subscribe(()=>{for(let[t,r]of oz.entries())queueMicrotask(()=>{r(t(e))})});return(0,l.$W)(()=>{oz.clear(),t()}),t},oI=(e,t=!0)=>{let r=(0,l.dD)(()=>$().client.getMutationCache()),[n,i]=(0,l.gQ)(e(r),t?void 0:{equals:!1});return(0,l.GW)(()=>{i(e(r))}),oz.set(e,i),(0,l.$W)(()=>{oz.delete(e)}),n},oK=({type:e,queryHash:t,metadata:r})=>{let n=new CustomEvent("@tanstack/query-devtools-event",{detail:{type:e,queryHash:t,metadata:r},bubbles:!0,cancelable:!0});window.dispatchEvent(n)},oG=(e,t)=>{let{colors:r,font:n,size:i,alpha:o,shadow:l,border:a}=nF,s=(t,r)=>"light"===e?t:r;return{devtoolsBtn:t`
      z-index: 100000;
      position: fixed;
      padding: 4px;
      text-align: left;

      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 9999px;
      box-shadow: ${l.md()};
      overflow: hidden;

      & div {
        position: absolute;
        top: -8px;
        left: -8px;
        right: -8px;
        bottom: -8px;
        border-radius: 9999px;

        & svg {
          position: absolute;
          width: 100%;
          height: 100%;
        }
        filter: blur(6px) saturate(1.2) contrast(1.1);
      }

      &:focus-within {
        outline-offset: 2px;
        outline: 3px solid ${r.green[600]};
      }

      & button {
        position: relative;
        z-index: 1;
        padding: 0;
        border-radius: 9999px;
        background-color: transparent;
        border: none;
        height: 40px;
        display: flex;
        width: 40px;
        overflow: hidden;
        cursor: pointer;
        outline: none;
        & svg {
          position: absolute;
          width: 100%;
          height: 100%;
        }
      }
    `,panel:t`
      position: fixed;
      z-index: 9999;
      display: flex;
      gap: ${nF.size[.5]};
      & * {
        box-sizing: border-box;
        text-transform: none;
      }

      & *::-webkit-scrollbar {
        width: 7px;
      }

      & *::-webkit-scrollbar-track {
        background: transparent;
      }

      & *::-webkit-scrollbar-thumb {
        background: ${s(r.gray[300],r.darkGray[200])};
      }

      & *::-webkit-scrollbar-thumb:hover {
        background: ${s(r.gray[400],r.darkGray[300])};
      }
    `,parentPanel:t`
      z-index: 9999;
      display: flex;
      height: 100%;
      gap: ${nF.size[.5]};
      & * {
        box-sizing: border-box;
        text-transform: none;
      }

      & *::-webkit-scrollbar {
        width: 7px;
      }

      & *::-webkit-scrollbar-track {
        background: transparent;
      }

      & *::-webkit-scrollbar-thumb {
        background: ${s(r.gray[300],r.darkGray[200])};
      }

      & *::-webkit-scrollbar-thumb:hover {
        background: ${s(r.gray[400],r.darkGray[300])};
      }
    `,"devtoolsBtn-position-bottom-right":t`
      bottom: 12px;
      right: 12px;
    `,"devtoolsBtn-position-bottom-left":t`
      bottom: 12px;
      left: 12px;
    `,"devtoolsBtn-position-top-left":t`
      top: 12px;
      left: 12px;
    `,"devtoolsBtn-position-top-right":t`
      top: 12px;
      right: 12px;
    `,"devtoolsBtn-position-relative":t`
      position: relative;
    `,"panel-position-top":t`
      top: 0;
      right: 0;
      left: 0;
      max-height: 90%;
      min-height: ${i[14]};
      border-bottom: ${s(r.gray[400],r.darkGray[300])} 1px solid;
    `,"panel-position-bottom":t`
      bottom: 0;
      right: 0;
      left: 0;
      max-height: 90%;
      min-height: ${i[14]};
      border-top: ${s(r.gray[400],r.darkGray[300])} 1px solid;
    `,"panel-position-right":t`
      bottom: 0;
      right: 0;
      top: 0;
      border-left: ${s(r.gray[400],r.darkGray[300])} 1px solid;
      max-width: 90%;
    `,"panel-position-left":t`
      bottom: 0;
      left: 0;
      top: 0;
      border-right: ${s(r.gray[400],r.darkGray[300])} 1px solid;
      max-width: 90%;
    `,closeBtn:t`
      position: absolute;
      cursor: pointer;
      z-index: 5;
      display: flex;
      align-items: center;
      justify-content: center;
      outline: none;
      background-color: ${s(r.gray[50],r.darkGray[700])};
      &:hover {
        background-color: ${s(r.gray[200],r.darkGray[500])};
      }
      &:focus-visible {
        outline: 2px solid ${r.blue[600]};
      }
      & svg {
        color: ${s(r.gray[600],r.gray[400])};
        width: ${i[2]};
        height: ${i[2]};
      }
    `,"closeBtn-position-top":t`
      bottom: 0;
      right: ${i[2]};
      transform: translate(0, 100%);
      border-right: ${s(r.gray[400],r.darkGray[300])} 1px solid;
      border-left: ${s(r.gray[400],r.darkGray[300])} 1px solid;
      border-top: none;
      border-bottom: ${s(r.gray[400],r.darkGray[300])} 1px solid;
      border-radius: 0px 0px ${a.radius.sm} ${a.radius.sm};
      padding: ${i[.5]} ${i[1.5]} ${i[1]} ${i[1.5]};

      &::after {
        content: ' ';
        position: absolute;
        bottom: 100%;
        left: -${i[2.5]};
        height: ${i[1.5]};
        width: calc(100% + ${i[5]});
      }

      & svg {
        transform: rotate(180deg);
      }
    `,"closeBtn-position-bottom":t`
      top: 0;
      right: ${i[2]};
      transform: translate(0, -100%);
      border-right: ${s(r.gray[400],r.darkGray[300])} 1px solid;
      border-left: ${s(r.gray[400],r.darkGray[300])} 1px solid;
      border-top: ${s(r.gray[400],r.darkGray[300])} 1px solid;
      border-bottom: none;
      border-radius: ${a.radius.sm} ${a.radius.sm} 0px 0px;
      padding: ${i[1]} ${i[1.5]} ${i[.5]} ${i[1.5]};

      &::after {
        content: ' ';
        position: absolute;
        top: 100%;
        left: -${i[2.5]};
        height: ${i[1.5]};
        width: calc(100% + ${i[5]});
      }
    `,"closeBtn-position-right":t`
      bottom: ${i[2]};
      left: 0;
      transform: translate(-100%, 0);
      border-right: none;
      border-left: ${s(r.gray[400],r.darkGray[300])} 1px solid;
      border-top: ${s(r.gray[400],r.darkGray[300])} 1px solid;
      border-bottom: ${s(r.gray[400],r.darkGray[300])} 1px solid;
      border-radius: ${a.radius.sm} 0px 0px ${a.radius.sm};
      padding: ${i[1.5]} ${i[.5]} ${i[1.5]} ${i[1]};

      &::after {
        content: ' ';
        position: absolute;
        left: 100%;
        height: calc(100% + ${i[5]});
        width: ${i[1.5]};
      }

      & svg {
        transform: rotate(-90deg);
      }
    `,"closeBtn-position-left":t`
      bottom: ${i[2]};
      right: 0;
      transform: translate(100%, 0);
      border-left: none;
      border-right: ${s(r.gray[400],r.darkGray[300])} 1px solid;
      border-top: ${s(r.gray[400],r.darkGray[300])} 1px solid;
      border-bottom: ${s(r.gray[400],r.darkGray[300])} 1px solid;
      border-radius: 0px ${a.radius.sm} ${a.radius.sm} 0px;
      padding: ${i[1.5]} ${i[1]} ${i[1.5]} ${i[.5]};

      &::after {
        content: ' ';
        position: absolute;
        right: 100%;
        height: calc(100% + ${i[5]});
        width: ${i[1.5]};
      }

      & svg {
        transform: rotate(90deg);
      }
    `,queriesContainer:t`
      flex: 1 1 700px;
      background-color: ${s(r.gray[50],r.darkGray[700])};
      display: flex;
      flex-direction: column;
      & * {
        font-family: ui-sans-serif, Inter, system-ui, sans-serif, sans-serif;
      }
    `,dragHandle:t`
      position: absolute;
      transition: background-color 0.125s ease;
      &:hover {
        background-color: ${r.purple[400]}${s("",o[90])};
      }
      z-index: 4;
    `,"dragHandle-position-top":t`
      bottom: 0;
      width: 100%;
      height: 3px;
      cursor: ns-resize;
    `,"dragHandle-position-bottom":t`
      top: 0;
      width: 100%;
      height: 3px;
      cursor: ns-resize;
    `,"dragHandle-position-right":t`
      left: 0;
      width: 3px;
      height: 100%;
      cursor: ew-resize;
    `,"dragHandle-position-left":t`
      right: 0;
      width: 3px;
      height: 100%;
      cursor: ew-resize;
    `,row:t`
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: ${nF.size[2]} ${nF.size[2.5]};
      gap: ${nF.size[2.5]};
      border-bottom: ${s(r.gray[300],r.darkGray[500])} 1px solid;
      align-items: center;
      & > button {
        padding: 0;
        background: transparent;
        border: none;
        display: flex;
        gap: ${i[.5]};
        flex-direction: column;
      }
    `,logoAndToggleContainer:t`
      display: flex;
      gap: ${nF.size[3]};
      align-items: center;
    `,logo:t`
      cursor: pointer;
      display: flex;
      flex-direction: column;
      background-color: transparent;
      border: none;
      gap: ${nF.size[.5]};
      padding: 0px;
      &:hover {
        opacity: 0.7;
      }
      &:focus-visible {
        outline-offset: 4px;
        border-radius: ${a.radius.xs};
        outline: 2px solid ${r.blue[800]};
      }
    `,tanstackLogo:t`
      font-size: ${n.size.md};
      font-weight: ${n.weight.bold};
      line-height: ${n.lineHeight.xs};
      white-space: nowrap;
      color: ${s(r.gray[600],r.gray[300])};
    `,queryFlavorLogo:t`
      font-weight: ${n.weight.semibold};
      font-size: ${n.size.xs};
      background: linear-gradient(
        to right,
        ${s("#ea4037, #ff9b11","#dd524b, #e9a03b")}
      );
      background-clip: text;
      -webkit-background-clip: text;
      line-height: 1;
      -webkit-text-fill-color: transparent;
      white-space: nowrap;
    `,queryStatusContainer:t`
      display: flex;
      gap: ${nF.size[2]};
      height: min-content;
    `,queryStatusTag:t`
      display: flex;
      gap: ${nF.size[1.5]};
      box-sizing: border-box;
      height: ${nF.size[6.5]};
      background: ${s(r.gray[50],r.darkGray[500])};
      color: ${s(r.gray[700],r.gray[300])};
      border-radius: ${nF.border.radius.sm};
      font-size: ${n.size.sm};
      padding: ${nF.size[1]};
      padding-left: ${nF.size[1.5]};
      align-items: center;
      font-weight: ${n.weight.medium};
      border: ${s("1px solid "+r.gray[300],"1px solid transparent")};
      user-select: none;
      position: relative;
      &:focus-visible {
        outline-offset: 2px;
        outline: 2px solid ${r.blue[800]};
      }
    `,queryStatusTagLabel:t`
      font-size: ${n.size.xs};
    `,queryStatusCount:t`
      font-size: ${n.size.xs};
      padding: 0 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: ${s(r.gray[500],r.gray[400])};
      background-color: ${s(r.gray[200],r.darkGray[300])};
      border-radius: 2px;
      font-variant-numeric: tabular-nums;
      height: ${nF.size[4.5]};
    `,statusTooltip:t`
      position: absolute;
      z-index: 1;
      background-color: ${s(r.gray[50],r.darkGray[500])};
      top: 100%;
      left: 50%;
      transform: translate(-50%, calc(${nF.size[2]}));
      padding: ${nF.size[.5]} ${nF.size[2]};
      border-radius: ${nF.border.radius.sm};
      font-size: ${n.size.xs};
      border: 1px solid ${s(r.gray[400],r.gray[600])};
      color: ${s(r.gray[600],r.gray[300])};

      &::before {
        top: 0px;
        content: ' ';
        display: block;
        left: 50%;
        transform: translate(-50%, -100%);
        position: absolute;
        border-color: transparent transparent
          ${s(r.gray[400],r.gray[600])} transparent;
        border-style: solid;
        border-width: 7px;
        /* transform: rotate(180deg); */
      }

      &::after {
        top: 0px;
        content: ' ';
        display: block;
        left: 50%;
        transform: translate(-50%, calc(-100% + 2px));
        position: absolute;
        border-color: transparent transparent
          ${s(r.gray[100],r.darkGray[500])} transparent;
        border-style: solid;
        border-width: 7px;
      }
    `,filtersContainer:t`
      display: flex;
      gap: ${nF.size[2]};
      & > button {
        cursor: pointer;
        padding: ${nF.size[.5]} ${nF.size[1.5]} ${nF.size[.5]}
          ${nF.size[2]};
        border-radius: ${nF.border.radius.sm};
        background-color: ${s(r.gray[100],r.darkGray[400])};
        border: 1px solid ${s(r.gray[300],r.darkGray[200])};
        color: ${s(r.gray[700],r.gray[300])};
        font-size: ${n.size.xs};
        display: flex;
        align-items: center;
        line-height: ${n.lineHeight.sm};
        gap: ${nF.size[1.5]};
        max-width: 160px;
        &:focus-visible {
          outline-offset: 2px;
          border-radius: ${a.radius.xs};
          outline: 2px solid ${r.blue[800]};
        }
        & svg {
          width: ${nF.size[3]};
          height: ${nF.size[3]};
          color: ${s(r.gray[500],r.gray[400])};
        }
      }
    `,filterInput:t`
      padding: ${i[.5]} ${i[2]};
      border-radius: ${nF.border.radius.sm};
      background-color: ${s(r.gray[100],r.darkGray[400])};
      display: flex;
      box-sizing: content-box;
      align-items: center;
      gap: ${nF.size[1.5]};
      max-width: 160px;
      min-width: 100px;
      border: 1px solid ${s(r.gray[300],r.darkGray[200])};
      height: min-content;
      color: ${s(r.gray[600],r.gray[400])};
      & > svg {
        width: ${i[3]};
        height: ${i[3]};
      }
      & input {
        font-size: ${n.size.xs};
        width: 100%;
        background-color: ${s(r.gray[100],r.darkGray[400])};
        border: none;
        padding: 0;
        line-height: ${n.lineHeight.sm};
        color: ${s(r.gray[700],r.gray[300])};
        &::placeholder {
          color: ${s(r.gray[700],r.gray[300])};
        }
        &:focus {
          outline: none;
        }
      }

      &:focus-within {
        outline-offset: 2px;
        border-radius: ${a.radius.xs};
        outline: 2px solid ${r.blue[800]};
      }
    `,filterSelect:t`
      padding: ${nF.size[.5]} ${nF.size[2]};
      border-radius: ${nF.border.radius.sm};
      background-color: ${s(r.gray[100],r.darkGray[400])};
      display: flex;
      align-items: center;
      gap: ${nF.size[1.5]};
      box-sizing: content-box;
      max-width: 160px;
      border: 1px solid ${s(r.gray[300],r.darkGray[200])};
      height: min-content;
      & > svg {
        color: ${s(r.gray[600],r.gray[400])};
        width: ${nF.size[2]};
        height: ${nF.size[2]};
      }
      & > select {
        appearance: none;
        color: ${s(r.gray[700],r.gray[300])};
        min-width: 100px;
        line-height: ${n.lineHeight.sm};
        font-size: ${n.size.xs};
        background-color: ${s(r.gray[100],r.darkGray[400])};
        border: none;
        &:focus {
          outline: none;
        }
      }
      &:focus-within {
        outline-offset: 2px;
        border-radius: ${a.radius.xs};
        outline: 2px solid ${r.blue[800]};
      }
    `,actionsContainer:t`
      display: flex;
      gap: ${nF.size[2]};
    `,actionsBtn:t`
      border-radius: ${nF.border.radius.sm};
      background-color: ${s(r.gray[100],r.darkGray[400])};
      border: 1px solid ${s(r.gray[300],r.darkGray[200])};
      width: ${nF.size[6.5]};
      height: ${nF.size[6.5]};
      justify-content: center;
      display: flex;
      align-items: center;
      gap: ${nF.size[1.5]};
      max-width: 160px;
      cursor: pointer;
      padding: 0;
      &:hover {
        background-color: ${s(r.gray[200],r.darkGray[500])};
      }
      & svg {
        color: ${s(r.gray[700],r.gray[300])};
        width: ${nF.size[3]};
        height: ${nF.size[3]};
      }
      &:focus-visible {
        outline-offset: 2px;
        border-radius: ${a.radius.xs};
        outline: 2px solid ${r.blue[800]};
      }
    `,actionsBtnOffline:t`
      & svg {
        stroke: ${s(r.yellow[700],r.yellow[500])};
        fill: ${s(r.yellow[700],r.yellow[500])};
      }
    `,overflowQueryContainer:t`
      flex: 1;
      overflow-y: auto;
      & > div {
        display: flex;
        flex-direction: column;
      }
    `,queryRow:t`
      display: flex;
      align-items: center;
      padding: 0;
      border: none;
      cursor: pointer;
      color: ${s(r.gray[700],r.gray[300])};
      background-color: ${s(r.gray[50],r.darkGray[700])};
      line-height: 1;
      &:focus {
        outline: none;
      }
      &:focus-visible {
        outline-offset: -2px;
        border-radius: ${a.radius.xs};
        outline: 2px solid ${r.blue[800]};
      }
      &:hover .tsqd-query-hash {
        background-color: ${s(r.gray[200],r.darkGray[600])};
      }

      & .tsqd-query-observer-count {
        padding: 0 ${nF.size[1]};
        user-select: none;
        min-width: ${nF.size[6.5]};
        align-self: stretch;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${n.size.xs};
        font-weight: ${n.weight.medium};
        border-bottom-width: 1px;
        border-bottom-style: solid;
        border-bottom: 1px solid ${s(r.gray[300],r.darkGray[700])};
      }
      & .tsqd-query-hash {
        user-select: text;
        font-size: ${n.size.xs};
        display: flex;
        align-items: center;
        min-height: ${nF.size[6]};
        flex: 1;
        padding: ${nF.size[1]} ${nF.size[2]};
        font-family:
          ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
          'Liberation Mono', 'Courier New', monospace;
        border-bottom: 1px solid ${s(r.gray[300],r.darkGray[400])};
        text-align: left;
        text-overflow: clip;
        word-break: break-word;
      }

      & .tsqd-query-disabled-indicator {
        align-self: stretch;
        display: flex;
        align-items: center;
        padding: 0 ${nF.size[2]};
        color: ${s(r.gray[800],r.gray[300])};
        background-color: ${s(r.gray[300],r.darkGray[600])};
        border-bottom: 1px solid ${s(r.gray[300],r.darkGray[400])};
        font-size: ${n.size.xs};
      }

      & .tsqd-query-static-indicator {
        align-self: stretch;
        display: flex;
        align-items: center;
        padding: 0 ${nF.size[2]};
        color: ${s(r.teal[800],r.teal[300])};
        background-color: ${s(r.teal[100],r.teal[900])};
        border-bottom: 1px solid ${s(r.teal[300],r.teal[700])};
        font-size: ${n.size.xs};
      }
    `,selectedQueryRow:t`
      background-color: ${s(r.gray[200],r.darkGray[500])};
    `,detailsContainer:t`
      flex: 1 1 700px;
      background-color: ${s(r.gray[50],r.darkGray[700])};
      color: ${s(r.gray[700],r.gray[300])};
      font-family: ui-sans-serif, Inter, system-ui, sans-serif, sans-serif;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      display: flex;
      text-align: left;
    `,detailsHeader:t`
      font-family: ui-sans-serif, Inter, system-ui, sans-serif, sans-serif;
      position: sticky;
      top: 0;
      z-index: 2;
      background-color: ${s(r.gray[200],r.darkGray[600])};
      padding: ${nF.size[1.5]} ${nF.size[2]};
      font-weight: ${n.weight.medium};
      font-size: ${n.size.xs};
      line-height: ${n.lineHeight.xs};
      text-align: left;
    `,detailsBody:t`
      margin: ${nF.size[1.5]} 0px ${nF.size[2]} 0px;
      & > div {
        display: flex;
        align-items: stretch;
        padding: 0 ${nF.size[2]};
        line-height: ${n.lineHeight.sm};
        justify-content: space-between;
        & > span {
          font-size: ${n.size.xs};
        }
        & > span:nth-child(2) {
          font-variant-numeric: tabular-nums;
        }
      }

      & > div:first-child {
        margin-bottom: ${nF.size[1.5]};
      }

      & code {
        font-family:
          ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
          'Liberation Mono', 'Courier New', monospace;
        margin: 0;
        font-size: ${n.size.xs};
        line-height: ${n.lineHeight.xs};
      }

      & pre {
        margin: 0;
        display: flex;
        align-items: center;
      }
    `,queryDetailsStatus:t`
      border: 1px solid ${r.darkGray[200]};
      border-radius: ${nF.border.radius.sm};
      font-weight: ${n.weight.medium};
      padding: ${nF.size[1]} ${nF.size[2.5]};
    `,actionsBody:t`
      flex-wrap: wrap;
      margin: ${nF.size[2]} 0px ${nF.size[2]} 0px;
      display: flex;
      gap: ${nF.size[2]};
      padding: 0px ${nF.size[2]};
      & > button {
        font-family: ui-sans-serif, Inter, system-ui, sans-serif, sans-serif;
        font-size: ${n.size.xs};
        padding: ${nF.size[1]} ${nF.size[2]};
        display: flex;
        border-radius: ${nF.border.radius.sm};
        background-color: ${s(r.gray[100],r.darkGray[600])};
        border: 1px solid ${s(r.gray[300],r.darkGray[400])};
        align-items: center;
        gap: ${nF.size[2]};
        font-weight: ${n.weight.medium};
        line-height: ${n.lineHeight.xs};
        cursor: pointer;
        &:focus-visible {
          outline-offset: 2px;
          border-radius: ${a.radius.xs};
          outline: 2px solid ${r.blue[800]};
        }
        &:hover {
          background-color: ${s(r.gray[200],r.darkGray[500])};
        }

        &:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        & > span {
          width: ${i[1.5]};
          height: ${i[1.5]};
          border-radius: ${nF.border.radius.full};
        }
      }
    `,actionsSelect:t`
      font-size: ${n.size.xs};
      padding: ${nF.size[.5]} ${nF.size[2]};
      display: flex;
      border-radius: ${nF.border.radius.sm};
      overflow: hidden;
      background-color: ${s(r.gray[100],r.darkGray[600])};
      border: 1px solid ${s(r.gray[300],r.darkGray[400])};
      align-items: center;
      gap: ${nF.size[2]};
      font-weight: ${n.weight.medium};
      line-height: ${n.lineHeight.sm};
      color: ${s(r.red[500],r.red[400])};
      cursor: pointer;
      position: relative;
      &:hover {
        background-color: ${s(r.gray[200],r.darkGray[500])};
      }
      & > span {
        width: ${i[1.5]};
        height: ${i[1.5]};
        border-radius: ${nF.border.radius.full};
      }
      &:focus-within {
        outline-offset: 2px;
        border-radius: ${a.radius.xs};
        outline: 2px solid ${r.blue[800]};
      }
      & select {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        appearance: none;
        background-color: transparent;
        border: none;
        color: transparent;
        outline: none;
      }

      & svg path {
        stroke: ${nF.colors.red[400]};
      }
      & svg {
        width: ${nF.size[2]};
        height: ${nF.size[2]};
      }
    `,settingsMenu:t`
      display: flex;
      & * {
        font-family: ui-sans-serif, Inter, system-ui, sans-serif, sans-serif;
      }
      flex-direction: column;
      gap: ${i[.5]};
      border-radius: ${nF.border.radius.sm};
      border: 1px solid ${s(r.gray[300],r.gray[700])};
      background-color: ${s(r.gray[50],r.darkGray[600])};
      font-size: ${n.size.xs};
      color: ${s(r.gray[700],r.gray[300])};
      z-index: 99999;
      min-width: 120px;
      padding: ${i[.5]};
    `,settingsSubTrigger:t`
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-radius: ${nF.border.radius.xs};
      padding: ${nF.size[1]} ${nF.size[1]};
      cursor: pointer;
      background-color: transparent;
      border: none;
      color: ${s(r.gray[700],r.gray[300])};
      & svg {
        color: ${s(r.gray[600],r.gray[400])};
        transform: rotate(-90deg);
        width: ${nF.size[2]};
        height: ${nF.size[2]};
      }
      &:hover {
        background-color: ${s(r.gray[200],r.darkGray[500])};
      }
      &:focus-visible {
        outline-offset: 2px;
        outline: 2px solid ${r.blue[800]};
      }
      &.data-disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    `,settingsMenuHeader:t`
      padding: ${nF.size[1]} ${nF.size[1]};
      font-weight: ${n.weight.medium};
      border-bottom: 1px solid ${s(r.gray[300],r.darkGray[400])};
      color: ${s(r.gray[500],r.gray[400])};
      font-size: ${n.size.xs};
    `,settingsSubButton:t`
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: ${s(r.gray[700],r.gray[300])};
      font-size: ${n.size.xs};
      border-radius: ${nF.border.radius.xs};
      padding: ${nF.size[1]} ${nF.size[1]};
      cursor: pointer;
      background-color: transparent;
      border: none;
      & svg {
        color: ${s(r.gray[600],r.gray[400])};
      }
      &:hover {
        background-color: ${s(r.gray[200],r.darkGray[500])};
      }
      &:focus-visible {
        outline-offset: 2px;
        outline: 2px solid ${r.blue[800]};
      }
    `,themeSelectedButton:t`
      background-color: ${s(r.purple[100],r.purple[900])};
      color: ${s(r.purple[700],r.purple[300])};
      & svg {
        color: ${s(r.purple[700],r.purple[300])};
      }
      &:hover {
        background-color: ${s(r.purple[100],r.purple[900])};
      }
    `,viewToggle:t`
      border-radius: ${nF.border.radius.sm};
      background-color: ${s(r.gray[200],r.darkGray[600])};
      border: 1px solid ${s(r.gray[300],r.darkGray[200])};
      display: flex;
      padding: 0;
      font-size: ${n.size.xs};
      color: ${s(r.gray[700],r.gray[300])};
      overflow: hidden;

      &:has(:focus-visible) {
        outline: 2px solid ${r.blue[800]};
      }

      & .tsqd-radio-toggle {
        opacity: 0.5;
        display: flex;
        & label {
          display: flex;
          align-items: center;
          cursor: pointer;
          line-height: ${n.lineHeight.md};
        }

        & label:hover {
          background-color: ${s(r.gray[100],r.darkGray[500])};
        }
      }

      & > [data-checked] {
        opacity: 1;
        background-color: ${s(r.gray[100],r.darkGray[400])};
        & label:hover {
          background-color: ${s(r.gray[100],r.darkGray[400])};
        }
      }

      & .tsqd-radio-toggle:first-child {
        & label {
          padding: 0 ${nF.size[1.5]} 0 ${nF.size[2]};
        }
        border-right: 1px solid ${s(r.gray[300],r.darkGray[200])};
      }

      & .tsqd-radio-toggle:nth-child(2) {
        & label {
          padding: 0 ${nF.size[2]} 0 ${nF.size[1.5]};
        }
      }
    `,devtoolsEditForm:t`
      padding: ${i[2]};
      & > [data-error='true'] {
        outline: 2px solid ${s(r.red[200],r.red[800])};
        outline-offset: 2px;
        border-radius: ${a.radius.xs};
      }
    `,devtoolsEditTextarea:t`
      width: 100%;
      max-height: 500px;
      font-family: 'Fira Code', monospace;
      font-size: ${n.size.xs};
      border-radius: ${a.radius.sm};
      field-sizing: content;
      padding: ${i[2]};
      background-color: ${s(r.gray[100],r.darkGray[800])};
      color: ${s(r.gray[900],r.gray[100])};
      border: 1px solid ${s(r.gray[200],r.gray[700])};
      resize: none;
      &:focus {
        outline-offset: 2px;
        border-radius: ${a.radius.xs};
        outline: 2px solid ${s(r.blue[200],r.blue[800])};
      }
    `,devtoolsEditFormActions:t`
      display: flex;
      justify-content: space-between;
      gap: ${i[2]};
      align-items: center;
      padding-top: ${i[1]};
      font-size: ${n.size.xs};
    `,devtoolsEditFormError:t`
      color: ${s(r.red[700],r.red[500])};
    `,devtoolsEditFormActionContainer:t`
      display: flex;
      gap: ${i[2]};
    `,devtoolsEditFormAction:t`
      font-family: ui-sans-serif, Inter, system-ui, sans-serif, sans-serif;
      font-size: ${n.size.xs};
      padding: ${i[1]} ${nF.size[2]};
      display: flex;
      border-radius: ${a.radius.sm};
      background-color: ${s(r.gray[100],r.darkGray[600])};
      border: 1px solid ${s(r.gray[300],r.darkGray[400])};
      align-items: center;
      gap: ${i[2]};
      font-weight: ${n.weight.medium};
      line-height: ${n.lineHeight.xs};
      cursor: pointer;
      &:focus-visible {
        outline-offset: 2px;
        border-radius: ${a.radius.xs};
        outline: 2px solid ${r.blue[800]};
      }
      &:hover {
        background-color: ${s(r.gray[200],r.darkGray[500])};
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    `}},oR=e=>oG("light",e),oB=e=>oG("dark",e);(0,l.Qj)(["click","mousedown","input"])}}]);