(function(global) {
  'use strict';
  const colors=['#315bd6','#15936f','#cf7225','#8653c3','#bd466b','#378a9d'];
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const finite=value=>typeof value==='number'&&Number.isFinite(value);
  function bounds(values){const good=values.filter(finite);if(!good.length)return null;let min=Math.min(0,...good),max=Math.max(0,...good);if(min===max)max=1;return {min,max};}
  function project(spec,indices,groupIndex,enabled,page=0){
    const group=spec.groups[groupIndex],size=spec.kind==='line'?Math.max(indices.length,1):20;
    const pages=Math.max(1,Math.ceil(indices.length/size)),actual=Math.max(0,Math.min(page,pages-1));
    const selected=indices.slice(actual*size,(actual+1)*size);
    return {group,indices:selected,labels:selected.map(i=>spec.labels[i]),page:actual,pages,total:indices.length,
      start:indices.length?actual*size+1:0,end:Math.min((actual+1)*size,indices.length),
      series:group.series.map((s,i)=>({name:s.name,color:colors[i%colors.length],values:selected.map(row=>s.values[row])})).filter((_,i)=>enabled[i])};
  }
  function exact(value,unit){return finite(value)?value.toLocaleString('zh-CN',{maximumFractionDigits:20})+(unit==='%'?'（比率原值；乘100为百分数）':unit):'缺失';}
  function svgChart(kind,data){
    const {group,labels,series}=data,values=series.flatMap(s=>s.values),domain=bounds(values);
    if(!labels.length)return '<p class="dual-empty">当前筛选没有数据。</p>';
    if(!series.length)return '<p class="dual-empty">请至少勾选一个数据系列。</p>';
    if(!domain)return '<p class="dual-empty">所选指标在这些行中没有可用数值；缺失值未按零绘制。</p>';
    const magnitude=Math.max(Math.abs(domain.min),Math.abs(domain.max));
    const factor=group.unit==='元'?(magnitude>=1e8?1e8:magnitude>=1e4?1e4:1):group.unit==='%'?.01:1;
    const axisUnit=group.unit==='元'?(factor===1e8?'亿元':factor===1e4?'万元':'元'):group.unit;
    const tick=v=>(v/factor).toLocaleString('zh-CN',{maximumFractionDigits:2});
    const tip=(label,s,value)=>`${label} · ${s.name}：${group.unit==='%'&&finite(value)?(value*100).toLocaleString('zh-CN',{maximumFractionDigits:12})+'%；原始比率 '+value:exact(value,group.unit)}`;
    const width=kind==='line'?Math.max(800,labels.length*48):1020;
    const left=kind==='line'?85:250,right=35,top=42,bottom=kind==='line'?82:50;
    const rowHeight=Math.max(40,series.length*17+12),height=kind==='line'?380:top+bottom+labels.length*rowHeight;
    const plotW=width-left-right,plotH=height-top-bottom,span=domain.max-domain.min;
    let out=`<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escape(group.label)}${kind==='line'?'折线图':'柱状图'}" viewBox="0 0 ${width} ${height}" style="min-width:${kind==='line'?720:800}px;width:100%"><title>${escape(group.label)}，单位${escape(axisUnit)}；第${data.start}至${data.end}行，共${data.total}行</title><text x="12" y="22" class="dual-axis">${escape(group.label)}（${escape(axisUnit)}）</text>`;
    if(kind==='line'){
      const x=i=>left+(labels.length===1?plotW/2:i*plotW/(labels.length-1));
      const y=v=>top+(domain.max-v)/span*plotH;
      for(let k=0;k<=4;k++){const v=domain.min+span*k/4,py=y(v);out+=`<line x1="${left}" y1="${py}" x2="${width-right}" y2="${py}" class="dual-grid"/><text x="${left-9}" y="${py+4}" text-anchor="end" class="dual-axis">${tick(v)}</text>`;}
      labels.forEach((label,i)=>{out+=`<text x="${x(i)}" y="${height-bottom+22}" transform="rotate(40 ${x(i)} ${height-bottom+22})" class="dual-axis"><title>${escape(label)}</title>${escape(label)}</text>`;});
      for(const s of series){let points=[];const flush=()=>{if(points.length>1)out+=`<polyline fill="none" stroke="${s.color}" stroke-width="2.5" points="${points.join(' ')}"/>`;points=[];};
        s.values.forEach((v,i)=>{if(!finite(v)){flush();return;}points.push(`${x(i)},${y(v)}`);});flush();
        s.values.forEach((v,i)=>{if(finite(v))out+=`<circle tabindex="0" role="img" aria-label="${escape(tip(labels[i],s,v))}" cx="${x(i)}" cy="${y(v)}" r="4" fill="${s.color}"><title>${escape(tip(labels[i],s,v))}</title></circle>`;});}
    }else{
      const x=v=>left+(v-domain.min)/span*plotW,zero=x(0);
      for(let k=0;k<=4;k++){const v=domain.min+span*k/4,px=x(v);out+=`<line x1="${px}" y1="${top}" x2="${px}" y2="${height-bottom}" class="dual-grid"/><text x="${px}" y="${height-19}" text-anchor="middle" class="dual-axis">${tick(v)}</text>`;}
      out+=`<line x1="${zero}" y1="${top}" x2="${zero}" y2="${height-bottom}" stroke="#52627b"/>`;
      labels.forEach((label,i)=>{const cy=top+i*rowHeight+rowHeight/2,short=String(label).split(' > ').at(-1);out+=`<text x="12" y="${cy+4}" class="dual-axis"><title>${escape(label)}</title>${escape(short.length>23?short.slice(0,22)+'…':short)}</text>`;
        series.forEach((s,j)=>{const v=s.values[i],py=cy-series.length*8.5+j*17;if(!finite(v)){out+=`<text x="${zero+4}" y="${py+11}" class="dual-axis">缺失</text>`;return;}
          out+=`<rect tabindex="0" role="img" aria-label="${escape(tip(label,s,v))}" x="${Math.min(zero,x(v))}" y="${py}" width="${Math.max(Math.abs(x(v)-zero),1)}" height="13" rx="2" fill="${s.color}"><title>${escape(tip(label,s,v))}</title></rect>`;});});
    }
    return out+'</svg>';
  }
  const api={project,bounds,svgChart};
  if(typeof module!=='undefined'&&module.exports){module.exports=api;return;}
  const document=global.document,controllers=[];
  function node(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
  document.querySelectorAll('table[data-chart-spec]').forEach((table,number)=>{
    const spec=JSON.parse(table.dataset.chartSpec),originalRows=[...table.tBodies[0].rows];
    if(originalRows.length!==spec.labels.length)throw new Error('图表行数与表格不匹配');
    const rowIndex=new Map(originalRows.map((row,i)=>[row,i])),wrap=table.parentElement,root=node('div','dual-view'),toolbar=node('div','dual-toolbar');
    wrap.parentElement.insertBefore(root,wrap);root.append(toolbar,wrap);wrap.classList.add('dual-table');wrap.id=`dual-table-${number}`;
    const chart=node('div','dual-chart');chart.id=`dual-chart-${number}`;chart.hidden=true;root.append(chart);
    const tableButton=node('button','','表格'),chartButton=node('button','','图表');
    for(const [b,target] of [[tableButton,wrap],[chartButton,chart]]){b.type='button';b.setAttribute('aria-controls',target.id);toolbar.append(b);}
    tableButton.setAttribute('aria-pressed','true');chartButton.setAttribute('aria-pressed','false');
    const controls=node('div','dual-chart-controls'),label=node('label','','指标 '),select=node('select');select.setAttribute('aria-label','图表指标');
    spec.groups.forEach((g,i)=>{const option=node('option','',`${g.label}（${g.unit}）`);option.value=String(i);select.append(option);});label.append(select);controls.append(label);chart.append(controls);
    const legend=node('div','dual-legend'),note=node('p','dual-note'),canvas=node('div','dual-canvas'),pager=node('div','dual-pager');note.setAttribute('aria-live','polite');chart.append(legend,note,canvas,pager);
    const prev=node('button','','上一页'),next=node('button','','下一页');prev.type=next.type='button';pager.append(prev,next);
    let groupIndex=0,enabled=spec.groups[0].series.map(()=>true),page=0,signature='';
    function draw(){const indices=[...table.tBodies[0].rows].filter(row=>!row.hidden).map(row=>rowIndex.get(row));const sig=indices.join(',');if(sig!==signature){page=0;signature=sig;}
      const data=project(spec,indices,groupIndex,enabled,page);page=data.page;
      canvas.innerHTML=svgChart(spec.kind,data);note.textContent=`显示第 ${data.start}—${data.end} 行，共 ${data.total} 行；与表格筛选及顺序一致。悬停或聚焦图形查看精确数值，缺失值不作零。`;
      pager.hidden=data.pages===1;prev.disabled=page===0;next.disabled=page>=data.pages-1;
    }
    function buildLegend(){legend.replaceChildren();spec.groups[groupIndex].series.forEach((s,i)=>{const l=node('label'),input=node('input'),swatch=node('span','dual-swatch');input.type='checkbox';input.checked=enabled[i];swatch.style.background=colors[i%colors.length];l.append(input,swatch,document.createTextNode(s.name));legend.append(l);input.addEventListener('change',()=>{enabled[i]=input.checked;draw();});});}
    function setView(isChart){wrap.hidden=isChart;chart.hidden=!isChart;tableButton.setAttribute('aria-pressed',String(!isChart));chartButton.setAttribute('aria-pressed',String(isChart));if(isChart)draw();}
    tableButton.addEventListener('click',()=>setView(false));chartButton.addEventListener('click',()=>setView(true));
    select.addEventListener('change',()=>{groupIndex=Number(select.value);enabled=spec.groups[groupIndex].series.map(()=>true);page=0;buildLegend();draw();});
    prev.addEventListener('click',()=>{page--;draw();});next.addEventListener('click',()=>{page++;draw();});buildLegend();
    controllers.push({refresh:()=>{if(!chart.hidden)draw();},table,chart,setView});
  });
  global.yuceCharts={...api,refresh:()=>controllers.forEach(c=>c.refresh()),count:controllers.length};
})(typeof window!=='undefined'?window:globalThis);
