const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const file=path.join(__dirname,'../assets/chart-views.js'),api=require(file);
const spec={kind:'bar',labels:Array.from({length:25},(_,i)=>`类目${i}`),groups:[
  {label:'成交额',unit:'元',series:[{name:'前期',values:Array.from({length:25},(_,i)=>i===2?null:i-5)},{name:'近期',values:Array.from({length:25},(_,i)=>i+0.123456789)}]},
  {label:'增速',unit:'%',series:[{name:'同比',values:Array.from({length:25},()=>.25)}]}]};
assert.deepEqual(api.bounds([null,undefined,NaN,0,-4,6]),{min:-4,max:6});
assert.equal(api.bounds([null]),null);
assert.deepEqual(api.bounds([0,0]),{min:0,max:1});
const indices=spec.labels.map((_,i)=>i);
let data=api.project(spec,indices,0,[true,true],1);
assert.equal(data.start,21);assert.equal(data.end,25);assert.equal(data.pages,2);
assert(api.svgChart('bar',data).includes('20.123456789元'));
assert(api.svgChart('bar',api.project(spec,[2],0,[true,false])).includes('没有可用数值'));
assert(api.svgChart('bar',api.project(spec,[],0,[true,true])).includes('没有数据'));
assert(api.svgChart('bar',api.project(spec,[0],0,[false,false])).includes('勾选'));
const gap={kind:'line',labels:['1','2','3','4','5'],groups:[{label:'测试',unit:'元',series:[{name:'A',values:[1,2,null,4,5]}]}]};
const svg=api.svgChart('line',api.project(gap,[0,1,2,3,4],0,[true]));
assert.equal((svg.match(/<polyline/g)||[]).length,2);assert.equal((svg.match(/<circle/g)||[]).length,4);
const unsafe=structuredClone(gap);unsafe.labels[0]='<img src=x onerror=alert(1)>';
assert(!api.svgChart('line',api.project(unsafe,[0],0,[true])).includes('<img'));

// Synthetic DOM execution tests the actual event handlers without opening a browser.
class El{
  constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.attributes={};this.style={};this.hidden=false;this.listeners={};this.classes=new Set();this.classList={add:c=>this.classes.add(c)};}
  append(...xs){for(const x of xs){x.parentElement=this;this.children.push(x);}}
  insertBefore(x,ref){x.parentElement=this;this.children.splice(this.children.indexOf(ref),0,x);}
  replaceChildren(...xs){this.children=[];this.append(...xs);}
  setAttribute(k,v){this.attributes[k]=v;}
  addEventListener(k,fn){this.listeners[k]=fn;}
  fire(k){this.listeners[k]?.({target:this});}
}
const root=new El('main'),wrap=new El('div'),table=new El('table');root.append(wrap);wrap.append(table);
const rows=indices.map(()=>new El('tr'));table.tBodies=[{rows}];table.dataset.chartSpec=JSON.stringify(spec);
const document={querySelectorAll:()=>[table],createElement:tag=>new El(tag),createTextNode:text=>({textContent:text})};
const window={document};vm.runInNewContext(fs.readFileSync(file,'utf8'),{window});
const dual=root.children[0],toolbar=dual.children[0],chart=dual.children[2],select=chart.children[0].children[0].children[0];
const legend=chart.children[1],note=chart.children[2],canvas=chart.children[3],pager=chart.children[4];
assert.equal(window.yuceCharts.count,1);assert.equal(chart.hidden,true);
toolbar.children[1].fire('click');assert.equal(chart.hidden,false);assert.equal(wrap.hidden,true);assert(note.textContent.includes('1—20'));
pager.children[1].fire('click');assert(note.textContent.includes('21—25'));
rows.forEach((r,i)=>r.hidden=i!==3&&i!==7);window.yuceCharts.refresh();assert(note.textContent.includes('共 2 行'));assert(note.textContent.includes('1—2'));assert(canvas.innerHTML.includes('3.123456789元'));
table.tBodies[0].rows=[...rows].reverse();window.yuceCharts.refresh();assert(canvas.innerHTML.indexOf('类目7')<canvas.innerHTML.indexOf('类目3'));
select.value='1';select.fire('change');assert(canvas.innerHTML.includes('25%；原始比率 0.25'));
legend.children[0].children[0].checked=false;legend.children[0].children[0].fire('change');assert(canvas.innerHTML.includes('至少勾选'));
rows.forEach(r=>r.hidden=true);window.yuceCharts.refresh();assert(canvas.innerHTML.includes('没有数据'));
toolbar.children[0].fire('click');assert.equal(wrap.hidden,false);assert.equal(chart.hidden,true);
console.log('Chart unit checks passed: zero/negative/missing, gap lines, exact precision, escaping, both views, group/series controls, pagination, filtering, sorting and empty results. No browser layout assertion.');
