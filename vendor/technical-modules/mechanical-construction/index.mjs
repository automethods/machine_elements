export {analyseShaft} from './shaft-analysis.mjs';
export {allocateReduction,balancedReductionCandidates,recommendedRatioSpans} from './ratio-allocation.mjs';

export function screenRetention({axialForceN,shaftYieldPa,shaftSafety,plateThicknessM,contactDiameterM}){
 if(![axialForceN,shaftYieldPa,shaftSafety,plateThicknessM,contactDiameterM].every(Number.isFinite)||shaftYieldPa<=0||shaftSafety<=1||plateThicknessM<=0||contactDiameterM<=.02)throw Error('Invalid retention screen.');
 const boltAreaM2=Math.PI/4*(.01-.9382*.0015)**2,boltCapacityN=580e6*boltAreaM2/2,threadCapacityN=Math.PI*.00816*.02*.5*shaftYieldPa/(Math.sqrt(3)*shaftSafety),leverM=Math.max(.001,(contactDiameterM-.02)/2),plateCapacityN=(shaftYieldPa/shaftSafety)*Math.PI*contactDiameterM*plateThicknessM**2/(6*leverM),capacityN=Math.min(boltCapacityN,threadCapacityN,plateCapacityN);
 return {axialDesignN:Math.abs(axialForceN),capacityN,boltAreaM2,boltCapacityN,threadCapacityN,plateCapacityN,threadEngagementM:.02,ok:Math.abs(axialForceN)<=capacityN,basis:'M10 coarse 8.8 proof/2; approximate tapped-thread shear and annular radial-cantilever plate screen. Preload, prying, locking and fatigue separate.'};
}

export function constructHub({enabled=true,boreDiameterM,bodyStartM,bodyEndM,faceWidthM,diameterRatio=1.5,extensionRatio=.5,side='front'}){
 if(!(boreDiameterM>=0&&bodyEndM>bodyStartM&&faceWidthM>0&&diameterRatio>1&&extensionRatio>=0)||!['front','back'].includes(side))throw Error('Invalid hub dimensions.');
 const diameterM=enabled?boreDiameterM*diameterRatio:0,extensionM=enabled?faceWidthM*extensionRatio:0,centerM=side==='back'?bodyStartM-extensionM/2:bodyEndM+extensionM/2;
 return {diameterM,extensionM,centerM,startM:Math.min(bodyStartM,centerM-extensionM/2),endM:Math.max(bodyEndM,centerM+extensionM/2),boreDiameterM,side};
}

// Nominal force components in each member's shaft coordinates. Bevel loads
// act at the mean cone diameter. Worm force uses the frictionless contact
// relation as a conservative screen; it is not an efficiency/thermal model.
export function meshForces({kind,inputTorqueNm,pinionDiameterM,wheelDiameterM,pressureAngleRad=Math.PI/9,helixAngleRad=0,conePinionRad,coneWheelRad,coneDistanceM,faceWidthM,wormLeadRad}){
 let ft=2*inputTorqueNm/pinionDiameterM,rin=pinionDiameterM/2,rout=wheelDiameterM/2,fr1,fr2,fa1,fa2,ft2=ft;
 if(kind===1){const mean=1-faceWidthM/(2*coneDistanceM);ft/=mean;ft2=ft;rin*=mean;rout*=mean;fr1=ft*Math.tan(pressureAngleRad)*Math.cos(conePinionRad);fr2=ft*Math.tan(pressureAngleRad)*Math.cos(coneWheelRad);fa1=ft*Math.tan(pressureAngleRad)*Math.sin(conePinionRad);fa2=ft*Math.tan(pressureAngleRad)*Math.sin(coneWheelRad);}
 else if(kind===2){ft2=ft/Math.tan(wormLeadRad);fr1=fr2=ft2*Math.tan(pressureAngleRad)/Math.cos(wormLeadRad);fa1=ft2;fa2=ft;}
 else {fr1=fr2=ft*Math.tan(pressureAngleRad)/Math.cos(helixAngleRad);fa1=fa2=ft*Math.tan(helixAngleRad);}
 if(![ft,ft2,fr1,fr2,fa1,fa2,rin,rout].every(Number.isFinite)||rin<=0||rout<=0)throw Error('Invalid mesh force geometry.');
 return {input:{fyN:ft,fzN:-fr1,axialN:fa1,myNm:-fa1*rin,radiusM:rin},output:{fyN:-ft2,fzN:fr2,axialN:-fa2,myNm:-fa2*rout,radiusM:rout},assumption:kind===2?'Frictionless worm contact screen; efficiency and thermal rating separate.':'Nominal external mesh; prescribed hand and direction; reversal/fatigue separate.'};
}

// Geometry is an SI construction query. Actual hub axial bounds are supplied
// by the geometry owner (essential for bevel gears anchored at their apex).
export function constructShaft(spec){
 const {id,supportsM:[A,B],bearing,seatDiameterM:d,journalDiameterM:dj,clearanceM:c,shoulderHeightM:sh,shoulderLengthM:sl,seats,driveEnd=null,driveDiameterM:dd=dj-c,driveLengthM:dl=0,sealLengthM:sealL=.02,plateThicknessM:pt=.006,coverThicknessM:ct=.008}=spec;
 if(!(A<B&&d>c&&dj>0&&c>0&&sh>0&&sl>0&&bearing.widthM>0)||!seats.length)throw Error('Invalid shaft construction.');
 const ordered=seats.toSorted((a,b)=>a.startM-b.startM),bw=bearing.widthM,jl=Math.max(spec.journalLengthM||bw,bw),left=A-jl/2,right=B+jl/2,web=d-c;
 const shoulder=ordered.length===1?{startM:ordered[0].startM-sl,endM:ordered[0].startM,diameterM:d+2*sh}:{startM:(ordered[0].endM+ordered.at(-1).startM-sl)/2,endM:(ordered[0].endM+ordered.at(-1).startM+sl)/2,diameterM:d+2*sh};
 const sections=[],hardware=[],checks=[],keyways=[];
 const check=(name,ok,detail)=>checks.push({id:id+'-'+name,ok,detail});
 const add=(key,kind,startM,endM,innerDiameterM,outerDiameterM,extra={})=>{if(endM-startM>1e-9)hardware.push({id:id+'-'+key,shaftId:id,kind,startM,endM,innerDiameterM,outerDiameterM,quantity:1,...extra});};
 const jA={id:id+'-journal-A',startM:left,endM:A+bw/2+.004,diameterM:dj,fit:'k6'},jB={id:id+'-journal-B',startM:B-bw/2-.004,endM:right,diameterM:dj,fit:'k6'};
 const core=[{...shoulder,id:id+'-shoulder',fit:null},...ordered.flatMap((s,i)=>s.integral&&s.threadStartM!==undefined?[{id:id+'-collar-left-'+i,startM:s.startM,endM:s.threadStartM,diameterM:d+2*sh,fit:null},{id:id+'-gear-seat-'+i,startM:s.threadStartM,endM:s.threadEndM,diameterM:s.rootDiameterM,fit:null,threaded:true},{id:id+'-collar-right-'+i,startM:s.threadEndM,endM:s.endM,diameterM:d+2*sh,fit:null}]:[{...s,id:id+'-gear-seat-'+i,diameterM:d,fit:spec.seatFit||'k6'}])].toSorted((a,b)=>a.startM-b.startM);
 let cursor=jA.endM;sections.push(jA);
 for(const s of core){if(s.startM>cursor)sections.push({id:id+'-web-'+sections.length,startM:cursor,endM:s.startM,diameterM:web,fit:'h6'});sections.push(s);cursor=s.endM;}
 if(cursor<jB.startM)sections.push({id:id+'-web-end',startM:cursor,endM:jB.startM,diameterM:web,fit:'h6'});sections.push(jB);
 check('axial-room',core[0].startM>=jA.endM&&core.at(-1).endM<=jB.startM&&core.every((s,i)=>!i||s.startM>=core[i-1].endM-1e-10),'Hubs and shoulder must fit between bearings without overlap.');
 check('gear-passage',dj+c<=d+1e-9,'Gear bore must pass journals and relieved shaft approaches.');
 check('bearing-passage',!driveEnd||dd+c<=dj+1e-9,'Drive seat must be smaller than the bearing seat.');
 check('shoulder-stock',Math.max(d+2*sh,...ordered.filter(s=>s.integral).map(s=>s.outerDiameterM||0))<=spec.stockDiameterM+1e-9,'Stock must contain the integral shoulder and any integral worm tooth tips.');
 const abutment=bearing.abutmentDiameterM||dj+.007,outer=Math.max(abutment+.001,d+.002);
 if(bearing.innerRingShoulderM)check('abutment-face',outer<=bearing.innerRingShoulderM,'Spacer contact face must remain inside the catalogue inner-ring shoulder envelope.');
 // Removable spacers bridge every gap between bearing inner rings, hubs and
 // the integral shoulder. A stepped counterbore clears each crossed step.
 const stops=[{startM:A-bw/2,endM:A+bw/2,id:id+'-bearing-A'},...core.map(s=>({startM:s.startM,endM:s.endM,id:s.id})),{startM:B-bw/2,endM:B+bw/2,id:id+'-bearing-B'}];
 for(let i=1;i<stops.length;i++){const prev=stops[i-1],next=stops[i],crossed=sections.filter(s=>s.endM>prev.endM+1e-10&&s.startM<next.startM-1e-10);add('spacer-'+i,'spacer',prev.endM,next.startM,dj+.0003,outer,{contacts:[prev.id,next.id],bores:crossed.map(s=>({startM:Math.max(s.startM,prev.endM),endM:Math.min(s.endM,next.startM),diameterM:s.diameterM+.0003}))});}
 for(const [i,s] of ordered.entries()){const k=s.key;if(k){const start=k.startM??s.startM+k.marginM,end=k.endM??s.endM-k.marginM;check('key-'+i,start>=s.startM&&end<=s.endM&&end-start>k.widthM,'Keyway must lie within its fitted hub seat and retain positive working length.');keyways.push({startM:start,endM:end,widthM:k.widthM,depthM:k.depthM});add('gear-key-'+i,'key',start,end,d,d+k.heightM,{widthM:k.widthM,heightM:k.heightM,contacts:[s.partId,id]});}}
 const driveSign=driveEnd==='left'?-1:1,driveStart=driveSign<0?left:right,driveTip=driveStart+driveSign*(sealL+dl),endPlateGapM=.001;
 if(driveEnd){sections.push({id:id+'-drive',startM:Math.min(driveStart,driveTip),endM:Math.max(driveStart,driveTip),diameterM:dd,fit:'h6'});
  const face=driveSign<0?A-bw/2:B+bw/2,sealEnd=driveStart+driveSign*sealL,hubEnd=driveTip+driveSign*endPlateGapM;
  add('seal-sleeve','seal-sleeve',Math.min(face,sealEnd),Math.max(face,sealEnd),dd+.00002,dj+.01,{bores:[{startM:Math.min(face,driveStart),endM:Math.max(face,driveStart),diameterM:dj+.0003},{startM:Math.min(driveStart,sealEnd),endM:Math.max(driveStart,sealEnd),diameterM:dd+.00002}],fit:'H7 / h6',surfaceRaUm:.4});
  add('drive-hub','drive-hub',Math.min(sealEnd,hubEnd),Math.max(sealEnd,hubEnd),dd,dd*1.6,{contacts:[id+'-seal-sleeve',id+'-plate-'+(driveSign<0?'A':'B')],fit:'H7'});
  const sealC=driveStart+driveSign*sealL/2;
  add('seal','seal',sealC-.0035,sealC+.0035,dj+.01,dj+.025,{designation:'Radial seal, NBR; ISO 6194',catalogueVerified:false,surfaceRaUm:.4});
 }
 for(const [end,sign,station] of [['A',-1,A],['B',1,B]]){
  const driving=(sign<0&&driveEnd==='left')||(sign>0&&driveEnd==='right'),face=station+sign*bw/2,tip=sign<0?left:right,plateFace=driving?driveTip+sign*endPlateGapM:face,plateOuter=driving?dd*1.45:outer,plateEnd=driving?plateFace+sign*pt:tip+sign*pt;
  add('plate-'+end,'retaining-plate',Math.min(plateFace,plateEnd),Math.max(plateFace,plateEnd),.011,plateOuter,{contact:driving?id+'-drive-hub':id+'-bearing-'+end,recessM:driving?0:Math.abs(tip-face)+.0005,bolt:'M10 × 1.5 — 8.8',tapDepthM:.02,threadEngagementM:.02,shaftTipM:driving?driveTip:tip});
  add('retaining-bolt-'+end,'bolt',Math.min(plateEnd,plateEnd-sign*.03),Math.max(plateEnd,plateEnd-sign*.03),0,.01,{designation:'ISO 4017 M10×30 — 8.8',contacts:[id+'-plate-'+end,id]});
  add('retaining-washer-'+end,'washer',Math.min(plateEnd,plateEnd+sign*.002),Math.max(plateEnd,plateEnd+sign*.002),.0105,.02,{designation:'ISO 7089 — 10 — 200 HV',contacts:[id+'-plate-'+end,id+'-retaining-bolt-'+end]});
  const coverC=driving?driveStart+sign*sealL/2:plateEnd+sign*(.003+ct/2),coverTip=driving?coverC+sign*ct/2:plateEnd+sign*(.003+ct),coverBase=face+sign*.001,coverStart=Math.min(coverBase,coverTip),coverEnd=Math.max(coverBase,coverTip),capStart=coverTip-sign*ct;
  const bores=driving?[{startM:coverStart,endM:coverEnd,diameterM:dj+.025}]:[{startM:Math.min(coverBase,capStart),endM:Math.max(coverBase,capStart),diameterM:bearing.outerDiameterM+.0001},{startM:Math.min(capStart,coverTip),endM:Math.max(capStart,coverTip),diameterM:0}];
  add('cover-'+end,'cover',coverStart,coverEnd,driving?dj+.025:bearing.outerDiameterM+.0001,bearing.outerDiameterM+.024,{end,bores,locating:end===(spec.locatingEnd||'A'),sealId:driving?id+'-seal':null,boltCircleM:bearing.outerDiameterM+.012,fastenerCount:4});
  add('cover-bolts-'+end,'cover-bolt',coverC-.008,coverC+.008,0,.006,{quantity:4,designation:'ISO 4762 M6×16 — 8.8',contacts:[id+'-cover-'+end,'housing']});
 }
 const sorted=sections.toSorted((a,b)=>a.startM-b.startM),tapLeft=sorted[0].startM+.02,tapRight=sorted.at(-1).endM-.02,sectionsSorted=[];
 for(const s of sorted){const knots=[s.startM,...[tapLeft,tapRight].filter(x=>x>s.startM&&x<s.endM),s.endM].sort((a,b)=>a-b);for(let i=1;i<knots.length;i++)sectionsSorted.push({...s,startM:knots[i-1],endM:knots[i],boreM:(knots[i]<=tapLeft+1e-10||knots[i-1]>=tapRight-1e-10)?.01:0});}
 check('continuous-profile',sectionsSorted.every((s,i)=>s.endM>s.startM&&(!i||Math.abs(sectionsSorted[i-1].endM-s.startM)<1e-9)),'No overlapping or disconnected shaft sections.');
 check('fillet',spec.filletM<=(bearing.maxFilletM||.001)&&spec.filletM<sh,'Fillet must clear bearing corner and abutment.');
 const instructions=[{action:'Mount gears from the accessible shaft ends; seat keys and hubs against the shoulder/spacers.',parts:[id,...ordered.map(s=>s.partId),...hardware.filter(h=>h.kind==='key'||h.kind==='spacer').map(h=>h.id)]},{action:'Press bearing inner rings using an inner-ring tool. Never transmit mounting force through the balls.',parts:[id+'-bearing-A',id+'-bearing-B']},{action:'Install sleeve and drive hub, then end plates and axial retaining bolts. Check end-plate contact and free rotation.',parts:hardware.filter(h=>['seal-sleeve','drive-hub','retaining-plate','bolt'].includes(h.kind)).map(h=>h.id)},{action:'Fit covers and seal on the finished sleeve; locate one outer ring and leave the other free to float axially.',parts:hardware.filter(h=>['cover','seal','cover-bolt'].includes(h.kind)).map(h=>h.id)}];
 return {id,sections:sectionsSorted,seats:ordered,shoulder,keyways,hardware,checks,bearing:{...bearing,supportsM:[A,B],locatingEnd:spec.locatingEnd||'A',floatingEnd:spec.locatingEnd==='B'?'A':'B',floatingClearanceM:spec.floatingClearanceM||.001},instructions,assumptions:['Editable teaching construction; cover/seal envelopes require a selected product before manufacture.','M10 end bolts: geometry and axial-force screening only; preload, loosening and fatigue require joint design.']};
}
