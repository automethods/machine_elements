export function parseCSV(text){
 const rows=[],row=[];let field='',quoted=false;
 for(let i=0;i<=text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"')quoted=false;else if(c===undefined)throw new Error('Незакрите поле CSV.');else field+=c;}
  else if(c==='"'){if(field)throw new Error('Некоректні лапки CSV.');quoted=true;}
  else if(c===','){row.push(field);field='';}
  else if(c==='\n'||c===undefined){row.push(field.replace(/\r$/,''));field='';if(row.some(x=>x!==''))rows.push([...row]);row.length=0;}
  else field+=c;
 }
 const header=rows.shift();if(!header||new Set(header).size!==header.length)throw new Error('Некоректний заголовок CSV.');
 return rows.map(cells=>{if(cells.length!==header.length)throw new Error('Кількість полів CSV не збігається з заголовком.');return Object.fromEntries(header.map((key,i)=>[key,cells[i]]));});
}
