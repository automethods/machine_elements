// Catch module-graph loading failures before app.js can initialize its own UI.
import('./app.js').catch(error=>{
 document.body.dataset.ready='error';
 document.querySelector('#saveStatus').textContent='Модулі розрахунку не завантажено';
 const message=document.createElement('p');message.className='note warning';
 message.textContent='Не вдалося завантажити розрахунок. Перезапустіть сервер через ./run.sh та оновіть сторінку.';
 document.querySelector('#chapters').replaceChildren(message);
 console.error(error);
});
