class Litewire{constructor(options={}){const metaBaseUrl=document.querySelector('meta[name="base-url"]')?.getAttribute('content');const rawBaseUrl=options.baseUrl||metaBaseUrl||window.AppConfig?.baseUrl||window.location.origin;this.baseUrl=rawBaseUrl.replace(/\/+$/,'');this.loadingClass=options.loadingClass||'litewire-request';this.models={};this.init()}
init(){this.scan(document);this.loadComponents(document);this.observe();this.listenToHistory()}
async loadComponents(root){const selector='[lw-component]';const elements=root.querySelectorAll?root.querySelectorAll(selector):[];if(root.nodeType===Node.ELEMENT_NODE&&root.matches(selector)){this.registerComponent(root)}
elements.forEach(el=>this.registerComponent(el))}
registerComponent(el){const trigger=el.getAttribute('lw-trigger');if(trigger&&trigger!=='load'){if(el._litewireComponentTriggerBound)return;el._litewireComponentTriggerBound=!0;el.addEventListener(trigger,e=>{if(trigger==='click')e.preventDefault();this.mountTriggeredComponent(el)});return}
this.mountComponent(el)}
async mountTriggeredComponent(source){const targetSelector=source.getAttribute('lw-target');let target=source;if(targetSelector){try{target=document.querySelector(targetSelector)}catch(err){console.error(`[Litewire Error] Invalid lw-target selector "${targetSelector}":`,err);return}}
if(!target){console.error(`[Litewire Error] No element matches lw-target selector "${targetSelector}".`);return}
await this.mountComponent(target,source)}
async mountComponent(el,source=el){if(source._litewireComponentMounted||source._litewireComponentLoading)return;const rawPath=source.getAttribute('lw-component');if(!rawPath)return;source._litewireComponentLoading=!0;const cleanPath=rawPath.replace(/^\/+/,'');const fullPath=`${this.baseUrl}/${cleanPath}`;try{const module=await import(fullPath);const params={...source.dataset};const componentFn=module.default||module.imageUploader||Object.values(module)[0];if(typeof componentFn==='function'){let isConstructor=!0;try{Reflect.construct(String,[],componentFn)}catch{isConstructor=!1}if(isConstructor){new componentFn(el,params)}else{componentFn(el,params)}source._litewireComponentMounted=!0}else{console.error(`[Litewire Error] No valid export found in module: ${fullPath}`)}}catch(err){console.error(`[Litewire Error] Failed to mount component from ${fullPath}:`,err)}finally{source._litewireComponentLoading=!1}}
scan(root){const requestSelector='[lw-get], [lw-post], [lw-put], [lw-delete], [lw-trigger="load"]';const modelSelector=['[lw\\:model]','[lw\\:model\\.live]','[lw\\:model\\.change]','[lw\\:model\\.blur]'].join(', ');const expressionSelector=['[lw\\:click]','[lw\\:input]','[lw\\:change]','[lw\\:submit]','[lw\\:keydown]','[lw\\:keyup]','[lw\\:focus]','[lw\\:blur]'].join(', ');const stateSelector='[lw\\:state]';const textSelector='[lw\\:text]';const showSelector='[lw\\:show]';const classSelector='[lw\\:class]';const forSelector='template[lw\\:for]';const requestElements=root.querySelectorAll?root.querySelectorAll(requestSelector):[];if(root.nodeType===Node.ELEMENT_NODE&&root.matches(requestSelector)){this.bindElement(root)}
requestElements.forEach(el=>{this.bindElement(el)});const stateElements=root.querySelectorAll?root.querySelectorAll(stateSelector):[];if(root.nodeType===Node.ELEMENT_NODE&&root.matches(stateSelector)){this.bindState(root)}
stateElements.forEach(el=>{this.bindState(el)});const forElements=root.querySelectorAll?root.querySelectorAll(forSelector):[];if(root.nodeType===Node.ELEMENT_NODE&&root.matches(forSelector)){this.bindFor(root)}
forElements.forEach(el=>{this.bindFor(el)});const modelElements=root.querySelectorAll?root.querySelectorAll(modelSelector):[];if(root.nodeType===Node.ELEMENT_NODE&&root.matches(modelSelector)){this.bindModel(root)}
modelElements.forEach(el=>{this.bindModel(el)});const expressionElements=root.querySelectorAll?root.querySelectorAll(expressionSelector):[];if(root.nodeType===Node.ELEMENT_NODE&&root.matches(expressionSelector)){this.bindExpression(root)}
expressionElements.forEach(el=>{this.bindExpression(el)});const textElements=root.querySelectorAll?root.querySelectorAll(textSelector):[];if(root.nodeType===Node.ELEMENT_NODE&&root.matches(textSelector)){this.bindText(root)}
textElements.forEach(el=>{this.bindText(el)});const showElements=root.querySelectorAll?root.querySelectorAll(showSelector):[];if(root.nodeType===Node.ELEMENT_NODE&&root.matches(showSelector)){this.bindShow(root)}
showElements.forEach(el=>{this.bindShow(el)});const classElements=root.querySelectorAll?root.querySelectorAll(classSelector):[];if(root.nodeType===Node.ELEMENT_NODE&&root.matches(classSelector)){this.bindClass(root)}
classElements.forEach(el=>{this.bindClass(el)})}
bindElement(el){if(el._litewireBound)return;el._litewireBound=!0;const trigger=el.getAttribute('lw-trigger')||(el.tagName==='FORM'?'submit':'click');if(trigger==='load'){this.executeRequest(el);return}
el.addEventListener(trigger,e=>{if(el.tagName==='FORM'||trigger==='click'){e.preventDefault()}
this.executeRequest(el)})}
bindState(el){if(el._litewireStateBound)return;el._litewireStateBound=!0;const expression=el.getAttribute('lw:state');if(!expression){el._litewireState=this.createReactiveState({},el);return}
try{const initialState=this.evaluateState(expression);if(initialState===null||typeof initialState!=='object'){throw new Error('lw:state must evaluate to an object')}
el._litewireState=this.createReactiveState(initialState,el);this.renderState(el)}catch(err){console.error('[Litewire Error] Failed to initialize lw:state:',expression,err)}}
evaluateState(expression){return Function(`"use strict"; return (${expression});`)()}
createReactiveState(initialState,root){const litewire=this;return new Proxy(initialState,{set(target,property,value){const result=Reflect.set(target,property,value);litewire.renderState(root);return result},deleteProperty(target,property){const result=Reflect.deleteProperty(target,property);litewire.renderState(root);return result}})}
getStateRoot(el){let current=el;while(current&&current!==document){if(current.nodeType===Node.ELEMENT_NODE){if(current._litewireState){return current}}
current=current.parentElement}
return null}
getState(el){const root=this.getStateRoot(el);if(root){return root._litewireState}
return this.models}
evaluateExpression(expression,el,event=null){if(!expression)return undefined;const state=this.getState(el);const litewire=this;const scope=new Proxy(state,{has(target,property){if(property==='$event'||property==='$el'||property==='$value'||property==='$state'||property==='$wire'||property==='$index'&&el._litewireLoopScope){return!0}
if(el._litewireLoopScope&&Object.prototype.hasOwnProperty.call(el._litewireLoopScope,property)){return!0}
return Reflect.has(target,property)},get(target,property,receiver){if(property==='$event'){return event}
if(property==='$el'){return el}
if(property==='$value'){return litewire.getModelValue(el)}
if(property==='$state'){return target}
if(property==='$wire'){return litewire}
if(property==='$index'&&el._litewireLoopScope){return el._litewireLoopScope.$index}
if(el._litewireLoopScope&&Object.prototype.hasOwnProperty.call(el._litewireLoopScope,property)){return el._litewireLoopScope[property]}
return Reflect.get(target,property,receiver)},set(target,property,value,receiver){if(el._litewireLoopScope&&Object.prototype.hasOwnProperty.call(el._litewireLoopScope,property)){el._litewireLoopScope[property]=value;return!0}
return Reflect.set(target,property,value,receiver)},deleteProperty(target,property){return Reflect.deleteProperty(target,property)}});try{return Function('$scope',`
                    with ($scope) {
                        return (${expression});
                    }
                `)(scope)}catch(err){console.error(`[Litewire Expression Error] ${expression}`,err);return undefined}}
bindExpression(el){if(el._litewireExpressionBound)return;el._litewireExpressionBound=!0;const eventNames=new Set(['click','input','change','submit','keydown','keyup','focus','blur']);const attributes=Array.from(el.attributes);const expressionAttributes=attributes.filter(attr=>attr.name.startsWith('lw:'));expressionAttributes.forEach(attr=>{const rawName=attr.name;const parts=rawName.split('.');const directive=parts.shift();if(!directive.startsWith('lw:')){return}
const eventName=directive.substring(3);if(!eventNames.has(eventName)){return}
const modifiers=parts;const expression=attr.value;if(!expression)return;this.bindExpressionEvent(el,eventName,expression,modifiers)})}
bindExpressionEvent(el,eventName,expression,modifiers){let target=modifiers.includes('outside')?document:el;if(modifiers.includes('window')){target=window}
if(modifiers.includes('document')){target=document}
const debounceIndex=modifiers.indexOf('debounce');const throttleIndex=modifiers.indexOf('throttle');const modifierDelay=index=>{const match=modifiers[index+1]?.match(/^(\d+)ms$/);return match?Number(match[1]):250};const debounceDelay=debounceIndex>=0?modifierDelay(debounceIndex):null;const throttleDelay=throttleIndex>=0?modifierDelay(throttleIndex):null;let timeout;let lastRun=0;let handler=event=>{if(modifiers.includes('self')&&event.target!==el){return}
if(modifiers.includes('outside')&&el.contains(event.target)){return}
if(modifiers.includes('prevent')){event.preventDefault()}
if(modifiers.includes('stop')){event.stopPropagation()}
if(debounceDelay!==null){clearTimeout(timeout);timeout=setTimeout(()=>this.evaluateExpression(expression,el,event),debounceDelay);return}
if(throttleDelay!==null){const now=Date.now();if(now-lastRun<throttleDelay){return}
lastRun=now}
this.evaluateExpression(expression,el,event)};if(modifiers.includes('once')){handler=this.once(handler)}
const options={capture:modifiers.includes('capture'),passive:modifiers.includes('passive'),once:!1};target.addEventListener(eventName,handler,options)}
once(handler){let executed=!1;return event=>{if(executed)return;executed=!0;handler(event)}}
bindText(el){if(el._litewireTextBound)return;el._litewireTextBound=!0;this.updateText(el)}
updateText(el){const expression=el.getAttribute('lw:text');if(!expression)return;const value=this.evaluateExpression(expression,el);el.textContent=value===null||value===undefined?'':String(value)}
bindShow(el){if(el._litewireShowBound)return;el._litewireShowBound=!0;this.updateShow(el)}
updateShow(el){const expression=el.getAttribute('lw:show');if(!expression)return;const value=this.evaluateExpression(expression,el);el.hidden=!Boolean(value)}
bindClass(el){if(el._litewireClassBound)return;el._litewireClassBound=!0;if(!el._litewireClassTokens){el._litewireClassTokens=new Set}this.updateClass(el)}
updateClass(el){if(!el._litewireClassTokens){el._litewireClassTokens=new Set}const expression=el.getAttribute('lw:class');if(!expression)return;const value=this.evaluateExpression(expression,el);if(!value||typeof value!=='object'||Array.isArray(value)){console.error('[Litewire Error] lw:class must evaluate to an object:',expression);return}
const nextTokens=new Set;Object.entries(value).forEach(([classNames,enabled])=>{if(!enabled)return;classNames.split(/\s+/).filter(Boolean).forEach(token=>nextTokens.add(token))});el._litewireClassTokens.forEach(token=>{if(!nextTokens.has(token)){el.classList.remove(token)}});nextTokens.forEach(token=>el.classList.add(token));el._litewireClassTokens=nextTokens}
getLoopScope(el){let current=el;while(current&&current!==document){if(current._litewireLoopScope)return current._litewireLoopScope;current=current.parentElement}
return null}
bindFor(el){if(el._litewireForBound)return;el._litewireForBound=!0;this.updateFor(el)}
updateFor(el){if(el._litewireForUpdating||!el.isConnected||!el.content||!el.parentNode)return;el._litewireForBound=!0;const expression=el.getAttribute('lw:for')||'';const match=expression.match(/^\s*(?:\(\s*([$\w]+)\s*,\s*([$\w]+)\s*\)|([$\w]+))\s+(?:of|in)\s+([\s\S]+?)\s*$/);if(!match){console.error('[Litewire Error] Invalid lw:for expression:',expression);return}
const itemName=match[1]||match[3];const indexName=match[2];const iterable=this.evaluateExpression(match[4],el);let items;if(iterable==null){items=[]}else{try{if(typeof iterable[Symbol.iterator]!=='function'){console.error('[Litewire Error] lw:for value must be iterable:',expression);return}
items=Array.from(iterable)}catch(err){console.error('[Litewire Error] Failed to read lw:for iterable:',expression,err);return}}
el._litewireForUpdating=!0;try{const inheritedScope=this.getLoopScope(el);const nextNodes=[];const output=el.ownerDocument.createDocumentFragment();items.forEach((item,index)=>{const scope={...(inheritedScope||{}),[itemName]:item,$index:index};if(indexName){scope[indexName]=index}
const fragment=el.content.cloneNode(!0);const nodes=Array.from(fragment.childNodes);nodes.filter(node=>node.nodeType===Node.ELEMENT_NODE).forEach(node=>{node._litewireLoopScope=scope;node.querySelectorAll('*').forEach(child=>{child._litewireLoopScope=scope})});nextNodes.push(...nodes);output.append(fragment)});(el._litewireForNodes||[]).forEach(node=>{if(node.parentNode){node.parentNode.removeChild(node)}});el._litewireForNodes=nextNodes;if(nextNodes.length){el.parentNode.insertBefore(output,el.nextSibling);this.scan(el.parentNode);this.loadComponents(el.parentNode)}}finally{el._litewireForUpdating=!1}}
renderState(root){if(!root)return;const textElements=[...(root.matches?.('[lw\\:text]')?[root]:[]),...(root.querySelectorAll?root.querySelectorAll('[lw\\:text]'):[])];const showElements=[...(root.matches?.('[lw\\:show]')?[root]:[]),...(root.querySelectorAll?root.querySelectorAll('[lw\\:show]'):[])];const classElements=[...(root.matches?.('[lw\\:class]')?[root]:[]),...(root.querySelectorAll?root.querySelectorAll('[lw\\:class]'):[])];const forElements=[...(root.matches?.('template[lw\\:for]')?[root]:[]),...(root.querySelectorAll?root.querySelectorAll('template[lw\\:for]'):[])];forElements.forEach(el=>{if(this.getStateRoot(el)===root){this.updateFor(el)}});textElements.forEach(el=>{if(this.getStateRoot(el)!==root){return}
this.updateText(el)});showElements.forEach(el=>{if(this.getStateRoot(el)!==root){return}
this.updateShow(el)});classElements.forEach(el=>{if(this.getStateRoot(el)!==root){return}
this.updateClass(el)});root.dispatchEvent(new CustomEvent('litewire:render',{bubbles:!0,detail:{state:root._litewireState}}))}
bindModel(el){if(el._litewireModelBound)return;el._litewireModelBound=!0;const model=el.getAttribute('lw:model')||el.getAttribute('lw:model.live')||el.getAttribute('lw:model.change')||el.getAttribute('lw:model.blur');if(!model)return;let event='input';if(el.hasAttribute('lw:model.change')){event='change'}
if(el.hasAttribute('lw:model.blur')){event='blur'}
el.addEventListener(event,()=>{if(el.type==='radio'&&!el.checked){return}
const value=this.getModelValue(el);if(model.startsWith('#')||model.startsWith('.')){this.updateModelTarget(model,value);return}
const stateRoot=this.getStateRoot(el);if(stateRoot){stateRoot._litewireState[model]=value;return}
this.setModel(model,value)});if(el.type==='radio'&&!el.checked){return}
const initialValue=this.getModelValue(el);if(model.startsWith('#')||model.startsWith('.')){this.updateModelTarget(model,initialValue);return}
const stateRoot=this.getStateRoot(el);if(stateRoot){if(!Object.prototype.hasOwnProperty.call(stateRoot._litewireState,model)){stateRoot._litewireState[model]=initialValue}
return}
this.setModel(model,initialValue)}
getModelValue(el){if(el.type==='checkbox'){return el.checked}
if(el.type==='radio'){return el.checked?el.value:null}
return el.value??''}
updateModelTarget(selector,value){const targets=document.querySelectorAll(selector);targets.forEach(target=>{if(target instanceof HTMLInputElement||target instanceof HTMLTextAreaElement||target instanceof HTMLSelectElement){if(target.type==='checkbox'){target.checked=Boolean(value)}else{target.value=value??''}}else{target.textContent=value??''}
target.dispatchEvent(new CustomEvent('litewire:model',{bubbles:!0,detail:{value}}))})}
setModel(name,value){this.models[name]=value;this.updateModelText(name,value);this.renderGlobalBindings();document.dispatchEvent(new CustomEvent('litewire:model',{bubbles:!0,detail:{name,value}}))}
renderGlobalBindings(){document.querySelectorAll('[lw\\:class]').forEach(el=>{if(!this.getStateRoot(el)){this.updateClass(el)}});document.querySelectorAll('template[lw\\:for]').forEach(el=>{if(!this.getStateRoot(el)){this.updateFor(el)}})}
getModel(name){return this.models[name]}
updateModelText(name,value){const elements=document.querySelectorAll(`[lw\\:text="${CSS.escape(name)}"]`);elements.forEach(el=>{el.textContent=value??''})}
getIndicators(el){const indicatorAttr=el.getAttribute('lw-indicator');if(!indicatorAttr){return Array.from(el.querySelectorAll('.litewire-indicator'))}
return Array.from(document.querySelectorAll(indicatorAttr))}
async executeRequest(el,isPopState=!1){const method=['post','put','delete','get'].find(m=>el.hasAttribute(`lw-${m}`))||'get';const path=el.getAttribute(`lw-${method}`);if(!path)return;const cleanPath=path.replace(/^\/+/,'');let url=`${this.baseUrl}/${cleanPath}`;const options={method:method.toUpperCase(),headers:{}};const csrfToken=document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');if(csrfToken){options.headers['X-CSRF-TOKEN']=csrfToken}
if(method==='get'){const form=el.tagName==='FORM'?el:el.closest('form');let params=new URLSearchParams();if(form){params=new URLSearchParams(new FormData(form))}else if(el.name&&el.value!==undefined){params.append(el.name,el.value)}
const queryString=params.toString();if(queryString){url+=(url.includes('?')?'&':'?')+queryString}}else{const form=el.tagName==='FORM'?el:el.closest('form');if(form){options.body=new FormData(form)}}
let indicators=[];try{indicators=this.getIndicators(el);el.classList.add(this.loadingClass);indicators.forEach(ind=>{ind.classList.add(this.loadingClass)});el.dispatchEvent(new CustomEvent('litewire:beforeRequest',{bubbles:!0}));const response=await fetch(url,options);if(!response.ok){throw new Error(`HTTP ${response.status}`)}
const html=await response.text();const targetSelector=el.getAttribute('lw-target')||'';const historyTarget=targetSelector?document.querySelector(targetSelector):el;const previousHtml=historyTarget?((el.getAttribute('lw-swap')||'innerHTML')==='outerHTML'?historyTarget.outerHTML:historyTarget.innerHTML):'';const swapType=el.getAttribute('lw-swap')||'innerHTML';const target=this.swapHTML(el,html);if(!isPopState){this.handleHistoryPush(el,url,target,previousHtml,swapType)}
el.dispatchEvent(new CustomEvent('litewire:afterRequest',{bubbles:!0}))}catch(err){console.error(`[Litewire Error] ${method.toUpperCase()} ${url} failed:`,err);el.dispatchEvent(new CustomEvent('litewire:error',{bubbles:!0,detail:{error:err}}))}finally{el.classList.remove(this.loadingClass);indicators.forEach(ind=>{ind.classList.remove(this.loadingClass)})}}
swapHTML(el,html){const targetSelector=el.getAttribute('lw-target');const target=targetSelector?document.querySelector(targetSelector):el;const swapType=el.getAttribute('lw-swap')||'innerHTML';if(!target)return target;if(swapType==='outerHTML'){const parent=target.parentElement;target.outerHTML=html;if(parent){this.scan(parent);this.loadComponents(parent)}return targetSelector?document.querySelector(targetSelector):null}else if(swapType==='prepend'){target.insertAdjacentHTML('afterbegin',html);this.scan(target);this.loadComponents(target)}else if(swapType==='append'){target.insertAdjacentHTML('beforeend',html);this.scan(target);this.loadComponents(target)}else{target.innerHTML=html;this.scan(target);this.loadComponents(target)}
return target}
handleHistoryPush(el,requestUrl,target,previousHtml,swapType){const pushAttr=el.getAttribute('lw-push-url');if(!pushAttr||pushAttr==='false'){return}
const newUrl=pushAttr==='true'?requestUrl:pushAttr;const targetSelector=el.getAttribute('lw-target')||'';const currentHtml=target?(swapType==='outerHTML'?target.outerHTML:target.innerHTML):'';if(!history.state){history.replaceState({litewireUrl:window.location.href,targetSelector,swapType,html:previousHtml},'',window.location.href)}
history.pushState({litewireUrl:newUrl,targetSelector,swapType,html:currentHtml},'',newUrl)}
listenToHistory(){window.addEventListener('popstate',e=>{if(!e.state)return;const{targetSelector,html,litewireUrl,swapType}=e.state;if(targetSelector&&html!==undefined){const target=document.querySelector(targetSelector);if(target){if(swapType==='outerHTML'){const parent=target.parentElement;target.outerHTML=html;if(parent){this.scan(parent);this.loadComponents(parent)}}else{target.innerHTML=html;this.scan(target);this.loadComponents(target)}return}}
const fallbackEl=document.createElement('div');fallbackEl.setAttribute('lw-get',litewireUrl||window.location.href);if(targetSelector){fallbackEl.setAttribute('lw-target',targetSelector)}
if(swapType){fallbackEl.setAttribute('lw-swap',swapType)}
this.executeRequest(fallbackEl,!0)})}
observe(){const observer=new MutationObserver(mutations=>{for(const mutation of mutations){mutation.addedNodes.forEach(node=>{if(node.nodeType===Node.ELEMENT_NODE){this.scan(node);this.loadComponents(node)}})}});observer.observe(document.body,{childList:!0,subtree:!0})}}
if(typeof window!=='undefined'&&typeof document!=='undefined'){if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',()=>{if(!window.litewire){window.litewire=new Litewire()}})}else{if(!window.litewire){window.litewire=new Litewire()}}}
export default Litewire