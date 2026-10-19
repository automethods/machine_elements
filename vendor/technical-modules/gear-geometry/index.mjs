export {involuteGear,involuteAngle,profilePath} from './fallback-profile.mjs';
export {evaluatePlanetary,MODULE_ID,MODULE_VERSION} from './planetary.mjs';
export {generateBrowserGearGeometry} from './browser.mjs';
import {evaluatePlanetary} from './planetary.mjs';
export const GEAR_FAMILIES=['spur','helical','bevel','worm','planetary'];
const common=['family','gearModuleM','gearPinionTeeth','gearWheelTeeth','gearFaceWidthM','gearPressureAngleRad','gearHelixAngleRad','gearBacklashM','gearShaftBoreM','gearMateShaftBoreM','gearShaftAngleRad','gearWormDiameterM','gearWormLengthM','gearWormStarts','gearPlanetCount','gearSunTeeth','gearPlanetTeeth','gearRingTeeth','gearRingRimThicknessM','gearSunAngularSpeedRadPerS','gearRingAngularSpeedRadPerS','gearViewTimeS'];
export function validateGearRequest(p){
 if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!common.includes(k))||!GEAR_FAMILIES.includes(p.family))throw Error('Unknown gear family or parameter.');
 const number=(key,lo,hi)=>{if(!Number.isFinite(p[key])||p[key]<lo||p[key]>hi)throw Error(key+': value outside supported range.');};
 number('gearModuleM',.0005,.025);number('gearFaceWidthM',.001,.3);number('gearPressureAngleRad',Math.PI/12,Math.PI/6);number('gearBacklashM',0,p.gearModuleM*.2);
 if(p.family==='planetary'){number('gearRingRimThicknessM',p.gearModuleM,.1);const result=evaluatePlanetary(p);if(result.status!=='ok')throw Error(result.diagnostics[0]);return {...p,gearRingTeeth:result.outputs.gearRingTeeth};}
 const teeth=key=>{number(key,18,400);if(!Number.isInteger(p[key]))throw Error(key+': integer teeth required.');};
 teeth('gearWheelTeeth');
 if(p.family!=='worm'){teeth('gearPinionTeeth');if(p.family!=='bevel')for(const [key,z] of [['gearShaftBoreM',p.gearPinionTeeth],['gearMateShaftBoreM',p.gearWheelTeeth]])number(key,0,p.gearModuleM*(z-2.5)*.8);}
 if(p.family==='helical')number('gearHelixAngleRad',-Math.PI/6,Math.PI/6);
 if(p.family==='bevel')number('gearShaftAngleRad',Math.PI/6,5*Math.PI/6);
 if(p.family==='worm'){number('gearWormDiameterM',4*p.gearModuleM,.5);number('gearWormLengthM',4*p.gearModuleM,.5);number('gearWormStarts',1,4);if(!Number.isInteger(p.gearWormStarts))throw Error('Integer worm starts required.');}
 return {...p};
}
export function exampleGearRequest(family='spur'){
 const common={family,gearModuleM:.002,gearFaceWidthM:.012,gearPressureAngleRad:Math.PI/9,gearBacklashM:0};
 if(family==='planetary')return {...common,gearSunTeeth:24,gearPlanetTeeth:24,gearPlanetCount:3,gearRingRimThicknessM:.006,gearSunAngularSpeedRadPerS:Math.PI/4,gearRingAngularSpeedRadPerS:0,gearViewTimeS:0};
 if(family==='worm')return {...common,gearWheelTeeth:36,gearWormStarts:2,gearWormDiameterM:.03,gearWormLengthM:.08};
 return {...common,gearPinionTeeth:20,gearWheelTeeth:40,...(family!=='bevel'?{gearShaftBoreM:.008,gearMateShaftBoreM:.012}:{}),...(family==='helical'?{gearHelixAngleRad:Math.PI/9}:{}),...(family==='bevel'?{gearShaftAngleRad:Math.PI/2}:{} )};
}
