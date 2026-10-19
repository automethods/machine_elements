import {messages} from './locale/en.js';
globalThis.MechanicsEnglishMessages=messages;
await import('../vendor/language/i18n.js');
export const i18n=globalThis.MechanicsI18n;
export function localize(root,language=i18n.language){
 i18n.translateDocument(root,language);
 const doc=root.ownerDocument||root,walker=doc.createTreeWalker(root,4);let node;
 while((node=walker.nextNode()))if(!node.parentElement?.closest('script,style,textarea,code,pre,mjx-container,[translate="no"]'))node.nodeValue=i18n.texText(node.nodeValue,language);
 return root;
}

export function fitDrawingText(doc){
 for(const cell of doc.querySelectorAll('[data-cell]')){
  const width=Number(cell.dataset.cell.split(',')[2])-3;
  for(const text of cell.querySelectorAll('text'))if(text.getComputedTextLength()>width){text.setAttribute('textLength',String(width));text.setAttribute('lengthAdjust','spacingAndGlyphs');}
 }
}
