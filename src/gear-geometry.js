import {involuteGear} from '../vendor/technical-modules/gear-geometry/index.mjs';
import {stageType,cadFamily} from './gearbox.js';
export {involuteGear,involuteAngle,profilePath} from '../vendor/technical-modules/gear-geometry/index.mjs';
export function gearAssembly(model){
 const p=model.inputs,r=model.result.numbers;
 return Array.from({length:p.stages},(_,i)=>{
  const stage=i+1,type=stageType(p,stage);
  const gear=number=>{
   const teeth=number===1?(type===2?p['wormStarts'+stage]:p['z1_'+stage]):type===3?r['ringZ_'+stage]:p['z2_'+stage];
   const data={teeth,pitchRadiusM:r[`d${number}_${stage}`]/2,tipRadiusM:r[`da${number}_${stage}`]/2,rootRadiusM:r[`df${number}_${stage}`]/2,pressureAngleRad:type===0?r['alphaT_'+stage]:Math.PI/9};
   return type===0?involuteGear(data):data;
  };
  return {stage,type,family:cadFamily(p,stage),centerDistanceM:r['aw_'+stage],widthM:p['width'+stage],ratio:r['u_'+stage],pinion:gear(1),wheel:gear(2),betaRad:type===0?p['beta'+stage]:0,shaftAngleRad:p['shaftAngle'+stage],planetTeeth:p['planetTeeth'+stage],planetCount:p['planetCount'+stage]};
 });
}
