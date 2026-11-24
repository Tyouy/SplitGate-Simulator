/* The finite-volume solve runs here so the GUI remains responsive. */
importScripts('solver.js');
function slim(r){return {params:r.params,profile:r.profile,center:r.center,gate:r.gate,iterations:r.iterations,linear:r.linear,residual:r.residual,nodes:r.nodes};}
self.onmessage=e=>{
 const {id,type,params,scan,voltages}=e.data;
 try{
  if(type==='profile'){
   const start=performance.now(),r=SplitGate.solve(params);self.postMessage({id,type:'result',jobType:type,result:slim(r),elapsed:performance.now()-start});
  }else if(type==='sweep'||type==='stack'){
   const biases=type==='sweep'?Array.from({length:scan.count},(_,i)=>scan.min+(scan.max-scan.min)*i/(scan.count-1)):Array.from(new Set(voltages)).sort((a,b)=>a-b);
   if(biases.length<2||biases.length>41||!biases.every(Number.isFinite))throw Error('Provide 2–41 distinct finite gate voltages.');
   const start=performance.now(),data=[],profiles=[];let previous,current;
   for(let i=0;i<biases.length;i++){
    const Vg=biases[i];
    self.postMessage({id,type:'progress',jobType:type,done:i,total:biases.length,Vg});
    const r=SplitGate.solve({...params,Vg},previous);previous=r.phi;
    data.push({Vg,center:r.center,gate:r.gate});
    const profile=slim(r);profiles.push(profile);
    if(Math.abs(Vg-params.Vg)<1e-9)current=profile;
   }
   if(!current){self.postMessage({id,type:'progress',jobType:type,done:biases.length,total:biases.length,Vg:params.Vg,finishing:true});current=slim(SplitGate.solve(params,previous));}
   self.postMessage({id,type:'result',jobType:type,result:current,stack:{params,profiles},...(type==='sweep'?{sweep:{params,data}}:{}),elapsed:performance.now()-start});
  }else throw Error('Unknown job type');
 }catch(error){self.postMessage({id,type:'error',message:error.message||String(error)});}
};
