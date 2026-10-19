import {validateGearRequest,generateBrowserGearGeometry} from '../vendor/technical-modules/gear-geometry/index.mjs';
const canonical=request=>JSON.stringify(Object.fromEntries(Object.entries(validateGearRequest(request)).sort(([a],[b])=>a.localeCompare(b))));
const cache=new Map();let catalog;
export async function loadGearGeometry(request){
 const key=canonical(request);
 if(cache.has(key))return cache.get(key);
 const pending=load(request,key);cache.set(key,pending);
 try{return await pending;}catch(error){cache.delete(key);throw error;}
}
async function load(request,key){
 catalog ||=fetch('data/gears/index.json').then(r=>r.ok?r.json():{entries:[]}).catch(()=>({entries:[]}));
 const entry=(await catalog).entries.find(e=>e.canonicalRequest===key);
 if(!entry)return generateBrowserGearGeometry(request);
 const response=await fetch('data/gears/'+entry.file);
 if(!response.ok)return generateBrowserGearGeometry(request);
 const packet=await response.json();
 if(packet.status!=='ok'||canonical(packet.params)!==key)throw Error('Геометрія не відповідає запитаним параметрам.');
 return packet;
}
export function pairRequest(pair,model,index){
 const p=model.inputs,j=pair.stage,common={family:pair.family,gearModuleM:p['module'+j],gearFaceWidthM:pair.widthM,gearPressureAngleRad:Math.PI/9,gearBacklashM:0};
 if(pair.type===2)return {...common,gearWheelTeeth:pair.wheel.teeth,gearWormStarts:p['wormStarts'+j],gearWormDiameterM:model.result.numbers['d1_'+j],gearWormLengthM:p['wormLength'+j]};
 if(pair.type===3)return {...common,gearSunTeeth:pair.pinion.teeth,gearPlanetTeeth:p['planetTeeth'+j],gearPlanetCount:p['planetCount'+j],gearRingRimThicknessM:p['planetRimThickness'+j],gearSunAngularSpeedRadPerS:Math.PI/4,gearRingAngularSpeedRadPerS:0,gearViewTimeS:0};
 if(pair.type===1)return {...common,gearPinionTeeth:pair.pinion.teeth,gearWheelTeeth:pair.wheel.teeth,gearShaftAngleRad:p['shaftAngle'+j]};
 const pinionRadius=(index===0?p.inputShaftDiameter:p.intermediateShaftDiameter)/2,wheelRadius=(index===p.stages-1?p.shaftDiameter:p.intermediateShaftDiameter)/2;
 return {...common,gearPinionTeeth:pair.pinion.teeth,gearWheelTeeth:pair.wheel.teeth,gearShaftBoreM:2*pinionRadius,gearMateShaftBoreM:2*wheelRadius,...(pair.family==='helical'?{gearHelixAngleRad:p['beta'+j]}:{})};
}
