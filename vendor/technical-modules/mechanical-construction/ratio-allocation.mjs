export function allocateReduction({totalRatio,externalRatio=1,firstRatio,stages,flex,gearStages}){
 if(!(totalRatio>0&&externalRatio>0&&firstRatio>0)||![1,2].includes(stages)||gearStages.length!==stages)throw Error('Invalid ratio allocation.');
 const patch={},targets=[stages===1?totalRatio/externalRatio:firstRatio,totalRatio/(externalRatio*firstRatio)],notes=[];
 let actualExternal=1;
 if(flex){if(flex.kind==='belt'){patch.beltD2=flex.driverDiameterM*externalRatio*(1-flex.slip);actualExternal=externalRatio;}else{const z=Math.max(flex.minTeeth,Math.min(flex.maxTeeth,Math.round(flex.driverTeeth*externalRatio)));patch[flex.kind==='chain'?'chainZ2':'timingZ2']=z;actualExternal=z/flex.driverTeeth;}}
 targets[stages-1]=totalRatio/actualExternal/(stages===1?1:firstRatio);
 const actual=[];
 for(let i=0;i<stages;i++){const g=gearStages[i],j=i+1,target=i===stages-1?totalRatio/actualExternal/(actual[0]||1):targets[i];
  if(g.kind==='planetary'){let best=null;for(let z=18;z<=150;z++){const ring=g.driverTeeth+2*z,ratio=1+ring/g.driverTeeth;if((ring+g.driverTeeth)%g.planetCount!==0||Math.sin(Math.PI/g.planetCount)*(g.driverTeeth+z)<=z+2)continue;const error=Math.abs(ratio-target);if(!best||error<best.error)best={z,ratio,error};}if(!best)throw Error('No assemblable planetary tooth count.');patch['planetTeeth'+j]=best.z;actual.push(best.ratio);
  }else{const driver=g.kind==='worm'?g.starts:g.driverTeeth,z=Math.max(18,Math.min(400,Math.round(target*driver)));patch['z2_'+j]=z;actual.push(z/driver);}
 }
 const ratio=actualExternal*actual.reduce((a,b)=>a*b,1);
 if(actual.some((u,i)=>Math.abs(u-targets[i])>1e-9))notes.push('Integer teeth and limits change the requested split.');
 return {patch,requested:{externalRatio,stageRatios:targets},actual:{externalRatio:actualExternal,stageRatios:actual,totalRatio:ratio,speedErrorFraction:totalRatio/ratio-1},notes};
}

// Sourced starting guidance, not physical limits. KNUBA (Mishchuk/Rashkivskyi,
// 2016), p.14 table 4: enclosed gears 3..6, chain 2..6, normal belt <=4,
// one-start worm 28..80, two-start worm 14..40. The wider cylindrical 2..8,
// synchronous belt 2..6 and four-start worm 8..20 are teaching search spans.
export function recommendedRatioSpans({gearStages,flex}){
 return {external:flex?flex.kind==='belt'?[2,4]:[2,6]:[1,1],stages:gearStages.map(g=>g.kind==='worm'?(g.starts===1?[28,80]:g.starts===2?[14,40]:[8,20]):g.kind==='bevel'?[2,5]:g.kind==='planetary'?[3,8]:[2,8])};
}

// Original teaching objective: compact pitch envelopes and recommended spans.
// Worm stages retain their higher reductions; unlike cylindrical stages their
// wheel diameters are not driven toward equality. Strength is checked by host.
function stageEnvelope(g,ratio){
 const m=g.moduleM,z=g.driverTeeth;
 if(!(m>0&&g.widthM>0))throw Error('Stage dimensions are required for balanced allocation.');
 let d1,d2,centre;
 if(g.kind==='planetary'){d1=m*z;d2=m*z*(ratio-1);centre=m*z*ratio/4;}
 else if(g.kind==='worm'){const gamma=Math.asin(g.starts/g.diameterFactor);d1=m*g.diameterFactor;d2=m*g.starts*ratio/Math.cos(gamma);centre=(d1+d2)/2;}
 else if(g.kind==='bevel'){const angle=g.shaftAngleRad||Math.PI/2,delta=Math.atan2(Math.sin(angle),ratio+Math.cos(angle)),R=m*z/(2*Math.sin(delta));if(delta<=0||angle-delta>=Math.PI/2||g.widthM>=R)return null;d1=m*z;d2=d1*ratio;centre=R;}
 else {d1=m*z/Math.cos(g.helixAngleRad||0);d2=d1*ratio;centre=(d1+d2)/2;}
 if(![d1,d2,centre].every(x=>Number.isFinite(x)&&x>0))return null;
 return {pinionPitchM:d1,wheelPitchM:d2,centreM:centre,envelopeDiameterM:g.kind==='planetary'?d2+2.5*m+2*(g.rimThicknessM||0):d2};
}

export function balancedReductionCandidates(request){
 const {totalRatio,stages,gearStages,flex,speedTolerance=.05,limit=16}=request;
 if(!(speedTolerance>0&&limit>=1))throw Error('Invalid balancing limits.');
 const external=flex?Array.from({length:141},(_,i)=>1+i*.05):[1];
 if(flex&&request.externalRatio>0)external.push(request.externalRatio);
 const spans=recommendedRatioSpans(request),first=gearStages[0],targets=stages===1?[1]:first.kind==='planetary'?Array.from({length:133},(_,i)=>1+(first.driverTeeth+2*(i+18))/first.driverTeeth):Array.from({length:383},(_,i)=>(i+18)/(first.kind==='worm'?first.starts:first.driverTeeth));
 const seen=new Set(),bestByExternal=new Map(),scale=Math.max(...gearStages.map(g=>g.moduleM*g.driverTeeth),flex?.driverDiameterM||0)*Math.sqrt(totalRatio);
 const compare=(a,b)=>Number(a.rangePenalty>1e-12)-Number(b.rangePenalty>1e-12)||a.score-b.score||Math.abs(a.actual.speedErrorFraction)-Math.abs(b.actual.speedErrorFraction);
 for(const ext of external)for(const target of targets){
  const q=allocateReduction({...request,externalRatio:ext,firstRatio:target});
  if(q.actual.stageRatios.some(u=>u<1)||Math.abs(q.actual.speedErrorFraction)>speedTolerance)continue;
  const key=JSON.stringify(q.patch);if(seen.has(key))continue;seen.add(key);
  const envelope=gearStages.map((g,i)=>stageEnvelope(g,q.actual.stageRatios[i]));if(envelope.some(e=>!e))continue;
  const driver=flex?flex.kind==='belt'?flex.driverDiameterM:flex.kind==='chain'?flex.pitchM/Math.sin(Math.PI/flex.driverTeeth):flex.pitchM*flex.driverTeeth/Math.PI:0;
  const driven=flex?flex.kind==='belt'?q.patch.beltD2:flex.kind==='chain'?flex.pitchM/Math.sin(Math.PI/q.patch.chainZ2):driver*q.actual.externalRatio:0;
  if(flex&&(q.patch.beltD2>flex.maxDrivenDiameterM||flex.minPulleyM&&Math.min(driver,driven)<flex.minPulleyM))continue;
  const diameters=envelope.map(e=>e.envelopeDiameterM),centres=envelope.map(e=>e.centreM),spread=Math.max(...diameters)/Math.min(...diameters),centreSpread=Math.max(...centres)/Math.min(...centres),largest=Math.max(...diameters,driven);
  const outside=(u,[lo,hi])=>Math.log(u<lo?lo/u:u>hi?u/hi:1),rangeDeviations=q.actual.stageRatios.map((u,i)=>outside(u,spans.stages[i])),externalDeviation=outside(q.actual.externalRatio,spans.external),rangePenalty=externalDeviation**2+rangeDeviations.reduce((sum,v)=>sum+v*v,0),sameCylinders=gearStages.every(g=>g.kind==='cylindrical');
  const score=largest/scale+(sameCylinders?.4:.05)*Math.log(spread)**2+.1*Math.log(centreSpread)**2+8*rangePenalty+.03*Math.abs(Math.log(q.actual.externalRatio/(request.externalRatio||1)));
  const candidate={...q,envelope,diameterSpread:spread,spans,rangePenalty,outsideRecommended:rangeDeviations.map(v=>v>1e-9),externalOutsideRecommended:externalDeviation>1e-9,score};
  const previous=bestByExternal.get(q.actual.externalRatio);if(!previous||compare(candidate,previous)<0)bestByExternal.set(q.actual.externalRatio,candidate);
 }
 // Keep alternatives across external ratios for the consumer's strength check.
 return [...bestByExternal.values()].sort(compare).slice(0,limit);
}
