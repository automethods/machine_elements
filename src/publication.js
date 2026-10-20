// Author names, qualifications and institutional details follow
// Automobile/new/project-credits.json, reviewed 2026-10-19.
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const publication={
 subject:'Деталі машин',
 title:'Методичні вказівки до виконання курсового проєкту з дисципліни «Деталі машин»',
 subtitle:'Проєктний розрахунок механічного привода: формули, варіанти, таблиці та приклади',
 ministry:'Міністерство освіти і науки України',
 institution:'Житомирський агротехнічний фаховий коледж',
 department:'Кафедра «Автомобільний транспорт»',
 country:'Україна',year:2026,
 authors:[
  {name:'Ломакін Володимир Олександрович',shortName:'Ломакін В. О.',qualification:'кандидат технічних наук',shortQualification:'к. т. н.'},
  {name:'Мельничук Сергій Володимирович',shortName:'Мельничук С. В.',qualification:'кандидат технічних наук, доцент',shortQualification:'к. т. н., доц.'},
  {name:'Ємець Богдан Володимирович',shortName:'Ємець Б. В.',qualification:'кандидат технічних наук, доцент',shortQualification:'к. т. н., доц.'},
  {name:'Рудзінський Володимир Васильович',shortName:'Рудзінський В. В.',qualification:'доктор технічних наук, професор',shortQualification:'д. т. н., проф.'},
  {name:'Рябчук Олександр Павлович',shortName:'Рябчук О. П.',qualification:'кандидат сільськогосподарських наук',shortQualification:'к. с.-г. н.'}
 ],
 contributorsNote:'Учасників програмування, верстання, тестування та підготовки даних зазначають із підтвердженим внеском. Методичного рецензента додають після проведеного рецензування.',
 aiNote:'Допомога ШІ: підготовка текстів, переклад, допомога з програмуванням і перевірки (моделі родини GPT-6).'
};
export const metadataAuthor=publication.authors.map(author=>author.shortName).join('; ');
export function projectCredits(profile='guide'){
 const full=profile==='guide',list=people=>`<ul class="project-credit-list credits-${full?'list':'inline'}" role="list">${people.map(person=>`<li><strong title="${esc(person.name)}">${esc(full?person.name:person.shortName)}</strong>${full?'':', '}<span class="project-credit-qualification" title="${esc(person.qualification)}">${esc(full?person.qualification:person.shortQualification)}</span></li>`).join('')}</ul>`;
 return (full?'':`<section class="project-credit-section" data-credit-role="founder"><h2>Засновник</h2>${list([publication.authors[0]])}</section>`)
  +`<section class="project-credit-section" data-credit-role="author"><h2>Автори</h2>${list(publication.authors)}</section><section class="project-credit-section" data-credit-role="contributor"><h2>Учасники розроблення (contributors)</h2><h3>Заклад освіти: ${esc(publication.institution)}</h3><p class="project-credit-placeholder">Список доповнюється.</p></section>`
  +(full?`<p class="project-credit-note">${esc(publication.contributorsNote)}</p>`:'')
  +`<p class="project-credit-note" data-credit-note="aiAssistance">${esc(publication.aiNote)}</p><p class="project-credit-copyright">© ${publication.year} Автори проєкту.</p>`;
}
