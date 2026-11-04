export function skillName(text) {
 const lines=text.replace(/\r\n?/g,'\n').split('\n');
 if(lines[0]!=='---')return null;
 const end=lines.indexOf('---',1);if(end<0)return null;
 const names=lines.slice(1,end).filter(line=>line.startsWith('name:'));
 return names.length===1?names[0].slice(5).trim():null;
}
