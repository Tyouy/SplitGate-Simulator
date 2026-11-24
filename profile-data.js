/* Shared, dependency-free profile transforms used by the GUI and tests. */
(function(global){
 'use strict';
 function parseVoltages(value){
  const parts=String(value).trim().split(/[,;\s，；]+/).filter(Boolean),values=parts.map(Number);
  if(!parts.length||!values.every(Number.isFinite))throw Error('Enter comma-separated finite gate voltages, for example 0, 10, 20, 50.');
  const unique=Array.from(new Set(values)).sort((a,b)=>a-b);
  if(unique.length<2||unique.length>41)throw Error('Provide 2–41 distinct gate voltages.');
  return unique;
 }
 function fullProfile(r,crop=true){
  const limit=r.params.L/2+Math.max(r.params.L*.8,r.params.D*8),a=crop?r.profile.filter(v=>v.x<=limit):r.profile;
  return [...a.slice(1).reverse().map(v=>({...v,x:-v.x})),...a];
 }
 function series(results,mode){return [...results].sort((a,b)=>a.params.Vg-b.params.Vg).map((r,index)=>({label:'Vg = '+r.params.Vg+' V',colorIndex:index,data:fullProfile(r).map(v=>({x:v.x/1000,y:mode==='density'?v.total/1e12:mode==='eta'?v.eta:v.mu,raw:v,Vg:r.params.Vg}))}));}
 function profileCSV(results){
  const rows=['Vg_V,x_nm,phi_V,mu_relative_midgap_eV,EF_minus_EC_eV,n_cm-2,p_cm-2,n_plus_p_cm-2'];
  for(const r of [...results].sort((a,b)=>a.params.Vg-b.params.Vg))for(const v of fullProfile(r,false))rows.push([r.params.Vg,v.x,v.phi,v.mu,v.eta,v.n,v.p,v.total].join(','));
  return '\uFEFF'+rows.join('\r\n');
 }
 global.ProfileData={parseVoltages,fullProfile,series,profileCSV};
 if(typeof module!=='undefined')module.exports=global.ProfileData;
})(typeof globalThis!=='undefined'?globalThis:window);
