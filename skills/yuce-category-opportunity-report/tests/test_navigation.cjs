// Pure unit test: evaluate report logic against synthetic DOM objects, no browser.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
function element(dataset = {}) {
  const classes = new Set(), listeners = {}, attributes = {};
  return {dataset, hidden: false, value: '', listeners, attributes,
    classList: {contains: x => classes.has(x), remove: x => classes.delete(x),
      toggle(x, force) {const on = force === undefined ? !classes.has(x) : force; if(on) classes.add(x); else classes.delete(x); return on;}},
    setAttribute(k,v) {attributes[k]=v;}, removeAttribute(k) {delete attributes[k];},
    addEventListener(k, fn) {listeners[k]=fn;}, click() {listeners.click?.({target:this});}};
}
const ids = Object.fromEntries(['candidateNavGroup','candidateSubmenu','candidateToggle','menuToggle','sidebar',
  'allCategoryTable','allSecondFilter','allStatusFilter','allTextFilter','allRouteFilter','allTableCount','search'].map(x=>[x,element()]));
ids.allCategoryTable.tBodies=[{rows:[]}]; ids.allCategoryTable.querySelectorAll=()=>[];
ids.candidateSubmenu.hidden=true;
const views=['overview','candidates','candidate-1','all'].map(view=>element({view}));
const buttons=views.map(v=>element({viewTarget:v.dataset.view}));
const body=element(), documentListeners={}, windowListeners={}; let mobile=false;
const document={body,getElementById:id=>ids[id],addEventListener:(k,fn)=>documentListeners[k]=fn,
  querySelectorAll:sel=>sel==='[data-view]'?views:sel==='[data-view-target]'?buttons:[]};
const location={hash:''},history={pushState:(_,__,hash)=>location.hash=hash};
const window={matchMedia:()=>({matches:mobile}),scrollTo:()=>{},addEventListener:(k,fn)=>windowListeners[k]=fn};
const html=fs.readFileSync(path.join(__dirname,'../assets/report-template.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
vm.runInNewContext(script,{document,window,location,history});
assert.equal(ids.candidateSubmenu.hidden,true);
buttons[1].click();
assert.equal(ids.candidateToggle.attributes['aria-expanded'],'true');
const hash=location.hash;
ids.candidateToggle.click();
assert.equal(ids.candidateSubmenu.hidden,true);
assert.equal(location.hash,hash); // folding does not navigate or replace the active view
ids.candidateToggle.click(); assert.equal(ids.candidateSubmenu.hidden,false);
buttons[2].click(); ids.candidateToggle.click();
assert.equal(window.yuceReport.visibleViews()[0],'candidate-1');
assert.equal(ids.candidateSubmenu.hidden,true);
buttons[2].click(); assert.equal(ids.candidateSubmenu.hidden,false);
ids.menuToggle.click(); assert(body.classList.contains('sidebar-hidden'));
ids.menuToggle.click(); assert(!body.classList.contains('sidebar-hidden'));
mobile=true; windowListeners.resize();
ids.menuToggle.click(); assert(ids.sidebar.classList.contains('open'));
buttons[3].click(); assert(!ids.sidebar.classList.contains('open'));
assert.equal(ids.menuToggle.attributes['aria-expanded'],'false');
ids.menuToggle.click(); documentListeners.keydown({key:'Escape'});
assert(!ids.sidebar.classList.contains('open'));
assert.match(html,/\.nav\{[^}]*min-height:0;[^}]*overflow-y:auto/);
assert.match(html,/\[hidden\]\{display:none!important\}/);
console.log('Navigation unit checks passed: disclosure, preserved view, reopening, desktop/sidebar, mobile, Escape, scroll CSS. Visual layout not tested.');
