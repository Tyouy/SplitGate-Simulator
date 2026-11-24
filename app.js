/* Offline GUI. All numerical computation is performed by solver-worker.js. */
'use strict';
const $=s=>document.querySelector(s);
const defaults={L:2000,D:40,d:40,Vg:10,back:true,H:285,cap:0,T:4,Eg:2,mu0:0,quality:1,box:2,gap:0};
const form=$('#params'),fields=[...form.querySelectorAll('[name]')];
let result=window.SG_BASELINE,sweep={params:defaults,data:window.SG_DEFAULT_SWEEPS.filter(r=>r.params.back&&r.params.Vg>=0&&r.params.Vg<=20).map(r=>({Vg:r.params.Vg,center:r.center,gate:r.gate}))};
let profileMode='mu',sweepMode='mu',profileView='single',stack=null,worker=null,job=0,busy=false;
const storageKey='split-gate-lab-semi-infinite-v2';
function readParams(){return Object.fromEntries(fields.map(f=>[f.name,f.name==='back'?f.value==='true':Number(f.value)]));}
function writeParams(p){for(const f of fields)f.value=String(p[f.name]??defaults[f.name]);}
function same(a,b,ignoreVg=false){return Object.keys(defaults).filter(k=>!ignoreVg||k!=='Vg').every(k=>a[k]===b[k]);}
function validateParams(p){
 if(!form.reportValidity())return false;
 if(Object.keys(defaults).some(k=>k!=='back'&&!Number.isFinite(p[k])))throw Error('All parameters must be finite numbers.');
 if(Math.abs(p.mu0)>p.Eg/2+.2)throw Error('Keep μ₀ within the gap or at most 0.2 eV beyond a band edge.');
 return true;
}
function setStatus(text,error=false){$('#status').textContent=text;$('#status').className='status'+(busy?' busy':'')+(error?' error':'');$('#status').setAttribute('role',error?'alert':'status');}
function lock(value){busy=value;for(const f of fields)f.disabled=value;for(const id of ['calculate','scan','reset','load-params','save-params','sweep-min','sweep-max','sweep-count','stack-run','stack-voltages'])$('#'+id).disabled=value;$('#cancel').hidden=!value;}
function markDirty(){const p=readParams();$('#dirty').hidden=same(p,result.params);const h=fields.find(f=>f.name==='H');h.disabled=busy||!p.back;}
function carrierText(n){return n<1?'＜1':n.toExponential(3).replace('e+',' × 10^').replace('e-',' × 10^-');}
function concise(n){if(Math.abs(n)<1e-12)return '0';return Number(n.toPrecision(5)).toString();}
function remember(){try{localStorage.setItem(storageKey,JSON.stringify({version:2,result,sweep,stack,profileView,stackVoltages:$('#stack-voltages').value}));}catch{}}
function themeColors(){const s=getComputedStyle(document.documentElement);return Object.fromEntries(['panel','text','muted','line','accent','gap','plot-grid','orange','series-2','series-3','series-4','series-5','series-6'].map(k=>[k,s.getPropertyValue('--'+k).trim()]));}
function lineColor(col,index=0){return [col.accent,col['series-2'],col['series-3'],col['series-4'],col['series-5'],col['series-6']][index%6];}
function lineDash(index=0){return [[],[7,3],[2,3],[8,3,2,3],[10,3,2,3,2,3],[3,2,3,5],[12,4]][Math.floor(index/6)%7];}
function nearest(data,x){let best=data[0];for(const point of data)if(Math.abs(point.x-x)<Math.abs(best.x-x))best=point;return best;}

class Chart {
 constructor(canvas,readout){this.canvas=canvas;this.readout=readout;this.index=-1;this.data=[];this.options={};this.ro=new ResizeObserver(()=>this.draw());this.ro.observe(canvas);canvas.addEventListener('pointermove',e=>this.point(e));canvas.addEventListener('pointerleave',()=>{this.index=-1;this.draw();});canvas.addEventListener('pointerdown',e=>this.point(e));}
 set(data,options){this.series=options.series||[{data,colorIndex:0}];this.data=this.series.flatMap(s=>s.data);this.options=options;this.index=-1;this.readout.textContent=options.caption||'Move the pointer to inspect values';this.canvas.setAttribute('aria-label',options.title+'; '+this.readout.textContent);this.draw();}
 point(e){if(!this.scale||!this.data.length)return;const first=this.series[0].data,rect=this.canvas.getBoundingClientRect(),xp=e.clientX-rect.left,v=this.scale.xmin+(xp-this.scale.left)/this.scale.width*(this.scale.xmax-this.scale.xmin);let best=0;for(let i=1;i<first.length;i++)if(Math.abs(first[i].x-v)<Math.abs(first[best].x-v))best=i;this.index=best;this.readout.textContent=this.options.describeAt?this.options.describeAt(first[best].x):this.options.describe(first[best]);this.draw();}
 draw(){
  const can=this.canvas,rect=can.getBoundingClientRect(),w=Math.max(250,rect.width),dpr=window.devicePixelRatio||1,col=themeColors(),c=can.getContext('2d');
  const left=w<430?59:72,right=18,pw=w-left-right,legend=[],showLegend=(this.series?.length||0)>1;
  c.font='12px "Segoe UI","Microsoft YaHei",sans-serif';
  let lx=left,ly=0;
  if(showLegend)for(const s of this.series){const size=c.measureText(s.label).width+47;if(lx>left&&lx+size>w-right){lx=left;ly++;}legend.push({s,x:lx,row:ly});lx+=size;}
  const legendHeight=showLegend?(ly+1)*21+7:0,viewWidth=document.documentElement.clientWidth,baseHeight=viewWidth>=1600?370:viewWidth<=720?300:330,h=baseHeight+legendHeight;
  if(Math.abs(rect.height-h)>1)can.style.height=h+'px';
  can.width=Math.round(w*dpr);can.height=Math.round(h*dpr);c.setTransform(dpr,0,0,dpr,0,0);c.fillStyle=col.panel;c.fillRect(0,0,w,h);
  const top=36+legendHeight,bottom=49,ph=h-top-bottom;
  c.font='12px "Segoe UI","Microsoft YaHei",sans-serif';c.fillStyle=col.muted;c.textAlign='left';c.fillText(this.options.yLabel||'',left,18);
  for(const item of legend){const {s,x,row}=item,y=39+row*21;c.strokeStyle=lineColor(col,s.colorIndex);c.lineWidth=2.4;c.setLineDash(lineDash(s.colorIndex));c.beginPath();c.moveTo(x,y);c.lineTo(x+21,y);c.stroke();c.setLineDash([]);c.fillStyle=col.text;c.fillText(s.label,x+28,y+4);}
  if(!this.data.length){c.textAlign='center';c.fillText('Select Run sweep to calculate a curve',w/2,h/2);this.scale=null;return;}
  let xmin=Math.min(...this.data.map(d=>d.x)),xmax=Math.max(...this.data.map(d=>d.x));if(xmax===xmin){xmin-=1;xmax+=1;}
  const ys=this.data.map(d=>d.y);let ymin=Math.min(...ys),ymax=Math.max(...ys);
  if(this.options.zero){ymin=Math.min(0,ymin);ymax=Math.max(0,ymax);}
  for(const ref of this.options.refs||[]){ymin=Math.min(ymin,ref.value);ymax=Math.max(ymax,ref.value);}
  if(ymin===ymax){const d=Math.max(Math.abs(ymin)*.1,.05);ymin-=d;ymax+=d;}
  const dy=ymax-ymin;ymin-=this.options.zero&&ymin===0?0:dy*.08;ymax+=dy*.10;
  const X=x=>left+(x-xmin)/(xmax-xmin)*pw,Y=y=>top+ph-(y-ymin)/(ymax-ymin)*ph;this.scale={left,width:pw,xmin,xmax};
  if(this.options.gap){c.fillStyle=col.gap;c.fillRect(X(Math.max(xmin,-this.options.gap)),top,X(Math.min(xmax,this.options.gap))-X(Math.max(xmin,-this.options.gap)),ph);}
  c.lineWidth=1;c.strokeStyle=col['plot-grid'];const nt=w<430?4:6;
  for(let i=0;i<=4;i++){const yy=top+ph*i/4,val=ymax-(ymax-ymin)*i/4;c.beginPath();c.moveTo(left,yy);c.lineTo(w-right,yy);c.stroke();c.fillStyle=col.muted;c.textAlign='right';c.fillText(this.tick(val),left-9,yy+4);}
  for(let i=0;i<=nt;i++){const xx=left+pw*i/nt,val=xmin+(xmax-xmin)*i/nt;c.strokeStyle=col['plot-grid'];c.beginPath();c.moveTo(xx,top);c.lineTo(xx,top+ph);c.stroke();c.fillStyle=col.muted;c.textAlign='center';c.fillText(this.tick(val),xx,top+ph+22);}
  c.textAlign='center';c.fillStyle=col.muted;c.fillText(this.options.xLabel,w/2,h-6);
  c.save();c.beginPath();c.rect(left,top,pw,ph);c.clip();
  for(const ref of this.options.refs||[]){c.setLineDash([5,5]);c.strokeStyle=col.orange;c.lineWidth=1;c.beginPath();c.moveTo(left,Y(ref.value));c.lineTo(w-right,Y(ref.value));c.stroke();c.setLineDash([]);c.fillStyle=col.orange;c.textAlign='right';c.fillText(ref.label,w-right-7,Math.max(top+12,Y(ref.value)-6));}
  for(const s of this.series||[]){c.strokeStyle=lineColor(col,s.colorIndex);c.lineWidth=2.4;c.lineJoin='round';c.setLineDash(lineDash(s.colorIndex));c.beginPath();s.data.forEach((d,i)=>i?c.lineTo(X(d.x),Y(d.y)):c.moveTo(X(d.x),Y(d.y)));c.stroke();c.setLineDash([]);
   if(this.options.dots){c.fillStyle=lineColor(col,s.colorIndex);for(const d of s.data){c.beginPath();c.arc(X(d.x),Y(d.y),3.2,0,Math.PI*2);c.fill();}}
  }
  if(this.index>=0){const x=this.series[0].data[this.index].x;c.strokeStyle=col.muted;c.setLineDash([3,4]);c.lineWidth=1;c.beginPath();c.moveTo(X(x),top);c.lineTo(X(x),top+ph);c.stroke();c.setLineDash([]);for(const s of this.series){const d=nearest(s.data,x);c.fillStyle=lineColor(col,s.colorIndex);c.beginPath();c.arc(X(d.x),Y(d.y),4,0,Math.PI*2);c.fill();}}
  c.restore();
 }
 tick(v){if(Math.abs(v)<1e-10)return '0';if(Math.abs(v)>=10000||Math.abs(v)<.001)return v.toExponential(1);return Number(v.toPrecision(4)).toString();}
}
const profileChart=new Chart($('#profile-chart'),$('#profile-readout')),sweepChart=new Chart($('#sweep-chart'),$('#sweep-readout'));
function validStack(){return stack?.profiles?.length>1&&same(stack.params,result.params,true);}
function displayedProfiles(){return profileView==='stack'&&validStack()?stack.profiles:[result];}
function drawProfile(){
 if(!validStack())profileView='single';
 $('#profile-stack').disabled=!validStack();document.querySelectorAll('[data-profile-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.profileView===profileView)));
 const p=result.params,mode=profileMode,density=mode==='density',stacked=profileView==='stack',series=ProfileData.series(displayedProfiles(),mode);
 $('#export-profile').textContent=stacked?'Export stack CSV':'Export profile CSV';
 const value=d=>density?carrierText(d.raw.total)+' cm⁻²':mode==='eta'?(d.raw.eta*1000).toFixed(3)+' meV':d.raw.mu.toFixed(5)+' eV';
 profileChart.set(series[0].data,{series,title:(stacked?'Stacked ':'Lateral ')+(density?'free-carrier density':mode==='eta'?'EF − EC':'chemical potential μ'),xLabel:'Lateral position x (μm)',yLabel:density?'n + p (10¹² cm⁻²)':mode==='eta'?'EF − EC (eV)':'μ (eV, relative to midgap)',gap:p.L/2000,zero:density,refs:density?[]:mode==='eta'?[{value:0,label:'Conduction edge'}]:[{value:p.Eg/2,label:'Conduction edge EC'}],caption:stacked?series.length+' overlaid profiles · Vg = '+displayedProfiles().map(r=>r.params.Vg).join(', ')+' V · Same geometry and materials':'Vg = '+p.Vg+' V · Inspect μ, electron and hole densities',...(stacked?{describeAt:x=>'x = '+concise(x)+' μm | '+series.map(s=>s.label+': '+value(nearest(s.data,x))).join(' | ')}:{}),describe:d=>{const v=d.raw;return `x = ${concise(d.x)} μm　μ = ${v.mu.toFixed(5)} eV　EF − EC = ${(v.eta*1000).toFixed(3)} meV　n = ${carrierText(v.n)} cm⁻²　p = ${carrierText(v.p)} cm⁻²`;}});
}
function drawSweep(){
 const valid=sweep&&same(sweep.params,result.params,true),all=valid?sweep.data:[],density=sweepMode==='density';
 sweepChart.set(all.map(v=>({x:v.Vg,y:density?v.center.total/1e11:v.center.mu,raw:v})),{title:'Center '+(density?'free-carrier density':'chemical potential')+' versus gate bias',xLabel:'Common gate bias Vg − VFB (V)',yLabel:density?'Center n + p (10¹¹ cm⁻²)':'Center μ (eV)',dots:true,zero:true,refs:density?[]:[{value:result.params.Eg/2,label:'Conduction edge EC'}],caption:all.length?`${all.length} self-consistent points · Computed Vg: ${Math.min(...all.map(v=>v.Vg))} to ${Math.max(...all.map(v=>v.Vg))} V`:'Geometry or materials changed; select Run sweep to update',describe:d=>`Vg = ${concise(d.x)} V　Center μ = ${d.raw.center.mu.toFixed(6)} eV　Center n + p = ${carrierText(d.raw.center.total)} cm⁻²`});
 $('#export-sweep').disabled=!all.length;$('#export-sweep-png').disabled=!all.length;
}
function geometry(){
 const svg=$('#geometry'),w=svg.clientWidth||700,p=result.params,l=18,r=w-18,view=p.L/2+Math.max(p.L*.8,p.D*8),scale=(r-l)/(2*view),a=w/2-p.L/2*scale,b=w/2+p.L/2*scale,col=themeColors();
 const text=(x,y,t,anchor='middle')=>`<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${col.text}" font-size="12">${t}</text>`;
 svg.setAttribute('viewBox',`0 0 ${w} 146`);
 svg.innerHTML=`<rect x="${l}" y="37" width="${r-l}" height="27" fill="${col.gap}"/><line x1="${l}" y1="35" x2="${r}" y2="35" stroke="${col.accent}" stroke-width="2.5"/><rect x="${l}" y="64" width="${a-l}" height="21" fill="${col.muted}"/><rect x="${b}" y="64" width="${r-b}" height="21" fill="${col.muted}"/>${text(l,18,'WSe₂ · Fixed electrochemical potential','start')}${text(w/2,55,'hBN · D = '+p.D+' nm')}${text((l+a)/2,101,'← −∞   x &lt; −L/2')}${text((b+r)/2,101,'x &gt; L/2   +∞ →')}${b-a>60?text(w/2,79,['Air','hBN','SiO₂'][p.gap]):''}${text(w/2,115,'L = '+p.L+' nm')}${text(w/2,140,p.back?'SiO₂ (H = '+p.H+' nm) / Grounded Si':'SiO₂ half-space · No backgate')}`;
}
function update(){
 const p=result.params;$('#metric-mu').innerHTML=result.center.mu.toFixed(4)+'<span class="unit">eV</span>';$('#metric-eta').innerHTML=(result.center.eta*1000).toFixed(2)+'<span class="unit">meV</span>';
 $('#metric-n').innerHTML=(result.center.total<1?'＜1':result.center.total.toExponential(2))+'<span class="unit">cm⁻²</span>';
 const ratio=result.gate.total>0?result.center.total/result.gate.total*100:0;$('#metric-ratio').textContent=result.gate.total>1?'Relative to the far-gate density: '+(ratio<.001?'＜0.001':ratio.toFixed(3))+'%':'Zero-bias reference state';
 $('#result-params').textContent=`Result: L = ${p.L} nm, D = ${p.D} nm, d = ${p.d} nm, Vg = ${p.Vg} V, Eg = ${p.Eg} eV, T = ${p.T} K`;
 $('#convergence').textContent=`Current bias: ${p.Vg} V · ${result.nodes.toLocaleString()} nodes · ${result.iterations} Newton iterations · Max normalized residual ${result.residual.toExponential(1)} V · Far-gate n + p = ${carrierText(result.gate.total)} cm⁻²`;
 geometry();drawProfile();drawSweep();markDirty();
}
function getWorker(){if(!worker){worker=new Worker('solver-worker.js');worker.onmessage=e=>{
 const m=e.data;if(m.id!==job)return;
 if(m.type==='progress')setStatus(m.finishing?'Calculating the profile at the current bias…':`${m.jobType==='stack'?'Stack':'Sweep'} ${m.done+1}/${m.total}: Vg = ${concise(m.Vg)} V`);
 else if(m.type==='result'){result=m.result;if(m.sweep)sweep=m.sweep;if(m.stack){stack=m.stack;profileView='stack';}else if(m.jobType==='profile')profileView='single';lock(false);update();remember();setStatus(`Converged · ${(m.elapsed/1000).toFixed(1)} s`);}
 else if(m.type==='error'){lock(false);markDirty();setStatus('Calculation failed: '+m.message,true);}
 };worker.onerror=e=>{lock(false);markDirty();setStatus('Calculation failed: '+(e.message||'Could not start the solver worker'),true);worker.terminate();worker=null;};}return worker;}
function start(type){
 try{
  const params=readParams();if(!validateParams(params))return;let scan,voltages;
  if(type==='stack')voltages=ProfileData.parseVoltages($('#stack-voltages').value);
  if(type==='sweep'){if(['sweep-min','sweep-max','sweep-count'].some(id=>!$('#'+id).value.trim()))throw Error('Enter both voltage endpoints and the number of points.');scan={min:Number($('#sweep-min').value),max:Number($('#sweep-max').value),count:Number($('#sweep-count').value)};if(!Number.isFinite(scan.min)||!Number.isFinite(scan.max)||scan.min>=scan.max||!Number.isInteger(scan.count)||scan.count<3||scan.count>41)throw Error('Enter finite start and end voltages with start < end, and an integer point count from 3 to 41.');}
  lock(true);setStatus(type==='sweep'?'Preparing voltage sweep…':type==='stack'?'Preparing stacked profiles…':'Solving the self-consistent lateral profile…');job++;getWorker().postMessage({id:job,type,params,scan,voltages});
 }catch(e){lock(false);markDirty();setStatus(e.message,true);}
}
function download(name,data,type){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function savePNG(chart,name){chart.canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},'image/png');}
form.addEventListener('submit',e=>{e.preventDefault();if(!busy)start('profile');});$('#scan').addEventListener('click',()=>{if(!busy)start('sweep');});
$('#stack-run').addEventListener('click',()=>{if(!busy)start('stack');});
$('#cancel').addEventListener('click',()=>{job++;worker?.terminate();worker=null;lock(false);markDirty();setStatus('Calculation canceled. The last completed result is retained.');});
for(const f of fields)f.addEventListener('input',()=>{markDirty();setStatus('Parameters changed. Select Calculate profile to update.');});
$('#reset').addEventListener('click',()=>{writeParams(defaults);markDirty();setStatus('Default parameters restored. Select Calculate profile to update.');});
$('#save-params').addEventListener('click',()=>{const p=readParams();try{if(validateParams(p))download('split-gate-params.json',JSON.stringify(p,null,2),'application/json');}catch(e){setStatus(e.message,true);}});
$('#load-params').addEventListener('click',()=>$('#param-file').click());
$('#param-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{const p=JSON.parse((await file.text()).replace(/^\uFEFF/,''));if(!p||Array.isArray(p)||typeof p!=='object')throw Error('Invalid parameter JSON.');for(const k of Object.keys(defaults))if(p[k]!==undefined&&(k==='back'?typeof p[k]!=='boolean':typeof p[k]!=='number'||!Number.isFinite(p[k])))throw Error('Parameter '+k+' has an invalid type.');writeParams({...defaults,...p});validateParams(readParams());markDirty();setStatus('Parameters loaded. Select Calculate profile to update.');}catch(err){setStatus('Import failed: '+err.message,true);}e.target.value='';});
document.querySelectorAll('[data-profile]').forEach(b=>b.addEventListener('click',()=>{profileMode=b.dataset.profile;document.querySelectorAll('[data-profile]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));drawProfile();}));
document.querySelectorAll('[data-profile-view]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.profileView==='stack'&&!validStack())return;profileView=b.dataset.profileView;drawProfile();remember();}));
document.querySelectorAll('[data-sweep]').forEach(b=>b.addEventListener('click',()=>{sweepMode=b.dataset.sweep;document.querySelectorAll('[data-sweep]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));drawSweep();}));
$('#export-profile').addEventListener('click',()=>download(profileView==='stack'?'split-gate-stacked-profiles.csv':'split-gate-profile.csv',ProfileData.profileCSV(displayedProfiles()),'text/csv;charset=utf-8'));
$('#export-sweep').addEventListener('click',()=>{if(!sweep)return;download('split-gate-voltage-sweep.csv','\uFEFFVg_V,center_mu_eV,center_EF_minus_EC_eV,center_n_cm-2,center_p_cm-2,gate_n_cm-2,gate_p_cm-2\r\n'+sweep.data.map(v=>[v.Vg,v.center.mu,v.center.eta,v.center.n,v.center.p,v.gate.n,v.gate.p].join(',')).join('\r\n'),'text/csv;charset=utf-8');});
$('#export-profile-png').addEventListener('click',()=>savePNG(profileChart,'split-gate-'+(profileView==='stack'?'stack-':'')+profileMode+'.png'));$('#export-sweep-png').addEventListener('click',()=>savePNG(sweepChart,'split-gate-voltage-'+sweepMode+'.png'));
function applyTheme(t){document.documentElement.dataset.theme=t;$('#theme').textContent=t==='dark'?'Light mode':'Dark mode';profileChart.draw();sweepChart.draw();geometry();}
$('#theme').addEventListener('click',()=>{const t=document.documentElement.dataset.theme==='dark'?'light':'dark';applyTheme(t);try{localStorage.setItem('split-gate-theme',t);}catch{}});
try{const old=JSON.parse(localStorage.getItem(storageKey));if(old?.version===2&&old.result?.params?.geometry==='semi-infinite'&&old.result?.profile?.length&&Object.keys(defaults).every(k=>old.result.params[k]!==undefined)&&Number.isFinite(old.result.center.mu)){result=old.result;sweep=old.sweep;if(old.stack?.profiles?.every(r=>r.params?.geometry==='semi-infinite'&&r.profile?.length)){stack=old.stack;profileView=old.profileView==='stack'?'stack':'single';}if(typeof old.stackVoltages==='string')$('#stack-voltages').value=old.stackVoltages;setStatus('Restored the last completed semi-infinite-gate result');}}catch{}
writeParams(result.params);update();try{applyTheme(localStorage.getItem('split-gate-theme')||'light');}catch{}
new ResizeObserver(()=>geometry()).observe($('#geometry'));
