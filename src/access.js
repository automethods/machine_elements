import {i18n} from './i18n.js';
const mutable='input,select,textarea';
const protectedButtons='[data-save],[data-native],[data-baseline],[data-clear-baseline],[data-design],[data-apply-design],[data-export-pdf],[data-export-drawing],[data-export-parts],[data-print],[data-report-html],[data-shaft-size],[data-open-shaft-sizing],[data-shaft-size-adopt],[data-adopt-shaft-summary],[data-ratio-adopt],[data-ratio-recommend],[data-bearing-adopt],[data-standard-key],[data-example],[data-start-example],a[download]';
let user=null,checked=0,pending;
const originalDisabled=new WeakMap(),originalTitles=new WeakMap();
function apply(){
 document.body.dataset.access=user?'member':'readonly';
 for(const node of document.querySelectorAll(mutable+','+protectedButtons)){
  if(!originalDisabled.has(node))originalDisabled.set(node,node.disabled||false);
  if('disabled' in node)node.disabled=!user||originalDisabled.get(node);
  node.setAttribute('aria-disabled',String(!user||originalDisabled.get(node)));
  if(!originalTitles.has(node))originalTitles.set(node,node.getAttribute('title'));
  if(!user)node.title=i18n.t('Будь ласка, увійдіть, щоб змінювати дані та експортувати PDF.');
  else if(originalTitles.get(node)===null)node.removeAttribute('title');else node.title=originalTitles.get(node);
  const described=(node.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!=='accessNotice');
  if(!user)described.push('accessNotice');
  if(described.length)node.setAttribute('aria-describedby',described.join(' '));else node.removeAttribute('aria-describedby');
 }
 const notice=document.querySelector('#accessNotice'),link=document.querySelector('[data-account-link]');
 if(notice)notice.textContent=i18n.t(user?'Ви увійшли. Редагування та експорт доступні.':'Режим перегляду. Будь ласка, увійдіть, щоб змінювати дані та створювати або завантажувати PDF.');
 if(link){link.textContent=i18n.t(user?'Обліковий запис':'Увійти');link.href=new URL(user?'/':'/?account=signin',location.hostname==='automethods.com'||location.pathname.startsWith('/projects/')?location.origin:'https://automethods.com').href;link.target='_blank';link.rel='noopener';link.title=i18n.t(user?'Обліковий запис на головній сторінці':'Увійти на головній сторінці');}
}
async function refresh(){
 if(pending)return pending;
 const wasMember=Boolean(user);
 pending=(async()=>{try{const response=await fetch('/api/session',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000)});const data=response.ok?await response.json():null;user=data?.configured===true&&typeof data.user?.id==='string'?data.user:null;}catch{user=null;}finally{checked=Date.now();apply();pending=null;if(wasMember!==Boolean(user))document.dispatchEvent(new CustomEvent('mechanicsaccesschange',{detail:{member:Boolean(user)}}));}return Boolean(user);})();return pending;
}
export const access={get canEdit(){return Boolean(user);},apply,protectedAction:node=>node.matches(protectedButtons),refresh,async requireSession(){if(Date.now()-checked>60000)await refresh();return Boolean(user);},ready:null};
access.ready=refresh();
document.addEventListener('click',event=>{const link=event.target.closest('a[download]');if(link&&!user){event.preventDefault();apply();}},true);
window.addEventListener('focus',()=>{void refresh();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
document.addEventListener('languagechange',apply);
