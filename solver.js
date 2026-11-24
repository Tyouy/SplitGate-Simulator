/* 2D finite-volume Poisson--Thomas--Fermi solver. Length unit: nm.
   Half-domain x>=0, equal split-gate biases; epsilon divided by epsilon0.
   Sheet residual = e/epsilon0 * dualWidth_m * (n-p-Nfixed).
   Ground pins the electrochemical potential, not the sheet potential. */
(function(global){
'use strict';
const E0=8.8541878128e-12,Q=1.602176634e-19,HB=1.054571817e-34,M0=9.1093837015e-31;
const defaults={L:2000,D:40,d:40,Vg:10,back:true,H:285,cap:0,T:4,Eg:2,mu0:0,quality:1,box:2,gap:0};
const soft=x=>x>35?x:x< -35?Math.exp(x):Math.log1p(Math.exp(x));
const sig=x=>x>35?1:x< -35?Math.exp(x):1/(1+Math.exp(-x));
function carriers(mu,p){
 const kt=8.617333262e-5*Math.max(p.T,0.1),ec=p.Eg/2;
 const dos=m=>2*m*M0/(2*Math.PI*HB*HB)*Q;
 const c=dos(.40),c2=dos(.29),v=dos(.36);
 const a=(mu-ec)/kt,b=(mu-ec-.030)/kt,h=(-mu-ec)/kt;
 return {n:kt*(c*soft(a)+c2*soft(b)),p:kt*v*soft(h),der:c*sig(a)+c2*sig(b)+v*sig(h)};
}
function segment(a,b,h,maxstep){
 const out=[a]; if(b-a<1e-9)return out;
 let t=a;
 while(t<b-1e-8){const edge=Math.min(t-a,b-t);const step=Math.min(maxstep,h+edge*.20,(b-a)/2); t=Math.min(b,t+Math.max(step,1e-5));out.push(t);}
 // Mirror to remove an asymmetric short cell at the far endpoint.
 const pts=[...out,...out.map(v=>a+b-v)].sort((x,y)=>x-y),keep=[];
 for(const v of pts){if(!keep.length||v-keep[keep.length-1]>h*.30)keep.push(v);}
 if(b-keep[keep.length-1]<h*.30)keep[keep.length-1]=b;else keep.push(b);
 return keep;
}
function axis(parts,h){let out=[]; for(const [a,b,max] of parts){const s=segment(a,b,h,max);out.push(...s.slice(out.length?1:0));}return Float64Array.from(out);}
function make(p0){
 const p={...defaults,...p0};delete p.W;p.geometry='semi-infinite';
 for(const k of Object.keys(defaults))if(k!=='back'&&!Number.isFinite(p[k]))throw Error('Parameter '+k+' must be finite.');
 for(const k of ['L','D','d','H','T','Eg','quality','box'])if(!(p[k]>0))throw Error('Parameter '+k+' must be positive.');
 if(p.cap<0)throw Error('Top hBN thickness must be nonnegative.');
 const a=p.L/2;
 const h=Math.min(p.D/5,p.d/4,8)/p.quality;
 const margin=p.box*Math.max(p.L,500),X=a+margin;
 const bottom=-p.d-(p.back?p.H:margin),top=p.D+p.cap+margin;
 // The gate reaches the outer boundary: there is no physical outer metal edge.
 // Zero x flux there approximates the translationally invariant far-field MOS stack.
 const x=axis([[0,a,Math.max(h,p.L/30/p.quality)],[a,X,margin/20/p.quality]],h);
 const z=axis([[bottom,-p.d,Math.max(h,(p.back?p.H:margin)/15/p.quality)],[-p.d,0,Math.max(h,p.d/4/p.quality)],[0,p.D,Math.max(h,p.D/5/p.quality)],...(p.cap>0?[[p.D,p.D+p.cap,Math.max(h,p.cap/4/p.quality)]]:[]),[p.D+p.cap,top,margin/12/p.quality]],h);
 const nx=x.length,nz=z.length,N=nx*nz,dx=new Float64Array(nx),dz=new Float64Array(nz);
 for(let i=0;i<nx;i++)dx[i]=((i?x[i]-x[i-1]:0)+(i<nx-1?x[i+1]-x[i]:0))/2;
 for(let j=0;j<nz;j++)dz[j]=((j?z[j]-z[j-1]:0)+(j<nz-1?z[j+1]-z[j]:0))/2;
 const fixed=new Uint8Array(N),fixedV=new Float64Array(N),diag=new Float64Array(N),right=new Float64Array(N),up=new Float64Array(N),rhs=new Float64Array(N),sheet=[];
 const epsAt=(zz,comp)=>zz>0&&zz<p.D+p.cap?(comp==='x'?6.9:3.4):zz>=-p.d&&zz<=0?(p.gap===0?1:p.gap===1?(comp==='x'?6.9:3.4):3.9):zz< -p.d?3.9:1;
 // Integrate epsilon over the dual cell for links parallel to interfaces.
 function exInt(lo,hi){const cuts=[lo,...[-p.d,0,p.D+p.cap].filter(t=>t>lo&&t<hi),hi];let s=0;for(let k=1;k<cuts.length;k++)s+=(cuts[k]-cuts[k-1])*epsAt((cuts[k]+cuts[k-1])/2,'x');return s;}
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
  const k=j*nx+i,metal=x[i]>=a-1e-7&&z[j]>=-p.d-1e-7&&z[j]<=1e-7;
  if(metal||(p.back&&j===0)){fixed[k]=1;fixedV[k]=metal?p.Vg:0;}
  if(Math.abs(z[j]-p.D)<1e-7)sheet.push({k,i,w:dx[i]*1e-9});
 }
 function link(k,l,c,arr){if(fixed[k]&&fixed[l])return;if(!fixed[k])diag[k]+=c;if(!fixed[l])diag[l]+=c;
  if(fixed[k])rhs[l]+=c*fixedV[k];else if(fixed[l])rhs[k]+=c*fixedV[l];else arr[k]=c;
 }
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
  const k=j*nx+i;
  if(i<nx-1){const lo=j?(z[j]+z[j-1])/2:z[0],hi=j<nz-1?(z[j]+z[j+1])/2:z[nz-1];link(k,k+1,exInt(lo,hi)/(x[i+1]-x[i]),right);}
  if(j<nz-1)link(k,k+nx,epsAt((z[j]+z[j+1])/2,'z')*dx[i]/(z[j+1]-z[j]),up);
 }
 for(let k=0;k<N;k++)if(fixed[k]){diag[k]=1;rhs[k]=fixedV[k];}
 return {p,x,z,nx,nz,N,diag,right,up,rhs,sheet,fixed,fixedV};
}
function matvec(g,dd,v,out){const {N,nx,right,up}=g;for(let k=0;k<N;k++)out[k]=dd[k]*v[k];for(let k=0;k<N;k++){if(right[k]){out[k]-=right[k]*v[k+1];out[k+1]-=right[k]*v[k];}if(up[k]){out[k]-=up[k]*v[k+nx];out[k+nx]-=up[k]*v[k];}}}
function pcg(g,dd,b,tol=1e-10,maxit=1600){
 const {N,nx,right,up}=g,ic=new Float64Array(N),r=Float64Array.from(b),y=new Float64Array(N),z=new Float64Array(N),v=new Float64Array(N),av=new Float64Array(N),out=new Float64Array(N);
 for(let k=0;k<N;k++){let d=dd[k];if(k>0&&right[k-1])d-=right[k-1]**2/ic[k-1];if(k>=nx&&up[k-nx])d-=up[k-nx]**2/ic[k-nx];ic[k]=Math.max(d,dd[k]*1e-9);}
 function pre(){for(let k=0;k<N;k++)y[k]=r[k]+(k>0?right[k-1]*y[k-1]/ic[k-1]:0)+(k>=nx?up[k-nx]*y[k-nx]/ic[k-nx]:0);for(let k=N-1;k>=0;k--)z[k]=(y[k]+right[k]*(k+1<N?z[k+1]:0)+up[k]*(k+nx<N?z[k+nx]:0))/ic[k];}
 let norm=0;for(const v of b)norm+=v*v;if(norm<1e-50)return {out,it:0,rel:0};
 pre();let rz=0;for(let k=0;k<N;k++){v[k]=z[k];rz+=r[k]*z[k];}
 let it=0,rel=1;
 for(;it<maxit;it++){
  matvec(g,dd,v,av);let va=0;for(let k=0;k<N;k++)va+=v[k]*av[k];if(!(va>0))throw Error('PCG matrix lost positive definiteness');
  const alpha=rz/va;let err=0;for(let k=0;k<N;k++){out[k]+=alpha*v[k];r[k]-=alpha*av[k];err+=r[k]*r[k];}rel=Math.sqrt(err/norm);if(rel<tol)break;
  pre();let next=0;for(let k=0;k<N;k++)next+=r[k]*z[k];const beta=next/rz;for(let k=0;k<N;k++)v[k]=z[k]+beta*v[k];rz=next;
 }
 if(rel>tol*10)throw Error('PCG did not converge: '+rel);
 return {out,it,rel};
}
function residual(g,phi,jac){const r=new Float64Array(g.N);matvec(g,g.diag,phi,r);for(let k=0;k<g.N;k++)r[k]-=g.rhs[k];let err=0;
 for(const s of g.sheet){const c=carriers(g.p.mu0+phi[s.k],g.p),base=carriers(g.p.mu0,g.p),f=Q/E0*s.w;r[s.k]+=f*(c.n-c.p-base.n+base.p);if(jac)jac[s.k]+=f*c.der;}
 for(let k=0;k<g.N;k++)err+=r[k]*r[k];return {r,err};}
function solve(p0,previous){
 const g=make(p0),phi=previous&&previous.length===g.N?Float64Array.from(previous):new Float64Array(g.N);for(let k=0;k<g.N;k++)if(g.fixed[k])phi[k]=g.fixedV[k];
 let iterations=0,linear=0,lastErr=0;
 for(;iterations<200;iterations++){
  const dd=Float64Array.from(g.diag),r0=residual(g,phi,dd);lastErr=Math.sqrt(r0.err/g.N);
  if(lastErr<1e-10)break;
  const step=pcg(g,dd,Float64Array.from(r0.r,v=>-v));linear+=step.it;
  let maxsheet=0;for(const s of g.sheet)maxsheet=Math.max(maxsheet,Math.abs(step.out[s.k]));
  let alpha=Math.min(1,.20/Math.max(maxsheet,1e-12)),accepted=false;
  for(let ls=0;ls<30;ls++){
   const trial=Float64Array.from(phi,(v,k)=>v+alpha*step.out[k]),rt=residual(g,trial);
   if(rt.err<r0.err*(1-1e-5*alpha)||rt.err<1e-18){phi.set(trial);accepted=true;break;}alpha*=.5;
  }
  if(!accepted)throw Error('Nonlinear line search stalled');
 }
 const rr=residual(g,phi);let maxVolterr=0;for(let k=0;k<g.N;k++)maxVolterr=Math.max(maxVolterr,Math.abs(rr.r[k])/g.diag[k]);
 if(iterations>=200||maxVolterr>1e-7)throw Error('Poisson iteration did not converge: '+maxVolterr);
 const profile=g.sheet.map(s=>{const mu=g.p.mu0+phi[s.k],c=carriers(mu,g.p);return {x:g.x[s.i],phi:phi[s.k],mu,eta:mu-g.p.Eg/2,n:c.n/1e4,p:c.p/1e4,total:(c.n+c.p)/1e4};});
 const gate=profile[profile.length-1];
 return {params:g.p,profile,center:profile[0],gate,iterations,linear,residual:maxVolterr,nodes:g.N,phi,grid:g};
}
global.SplitGate={defaults,carriers,make,matvec,pcg,residual,solve};
if(typeof module!=='undefined')module.exports=global.SplitGate;
})(typeof globalThis!=='undefined'?globalThis:window);
