import {PlanetaryGear} from './upstream-planetary.mjs';
export const MODULE_ID='module.mechanics.gear-geometry';
export const MODULE_VERSION='0.2.1';
const invalid=message=>({status:'invalid-input',moduleId:MODULE_ID,moduleVersion:MODULE_VERSION,outputs:null,diagnostics:[message]});
export function evaluatePlanetary(inputs){
 const p=inputs||{},z=p.gearSunTeeth,zp=p.gearPlanetTeeth,N=p.gearPlanetCount;
 if(![z,zp,N].every(Number.isInteger)||z<18||zp<18||z>200||zp>200||N<2||N>8)return invalid('Integer sun/planet teeth ≥18 and 2…8 planets required.');
 if(![p.gearModuleM,p.gearSunAngularSpeedRadPerS,p.gearRingAngularSpeedRadPerS,p.gearViewTimeS??0].every(Number.isFinite)||p.gearModuleM<=0||p.gearModuleM>.025||Math.abs(p.gearSunAngularSpeedRadPerS)>10000||Math.abs(p.gearRingAngularSpeedRadPerS)>10000)return invalid('Finite SI module, angular speeds and view time required.');
 // Upstream size mode 1 owns the derived ring count; speed mode 2 owns Willis.
 const m=new PlanetaryGear(1,z,zp,2,p.gearSunAngularSpeedRadPerS,p.gearRingAngularSpeedRadPerS,Math.PI*p.gearModuleM,N);
 const zr=m.ring.gear_size;
 if(p.gearRingTeeth!==undefined&&p.gearRingTeeth!==zr)return invalid('Ring tooth count does not match sun + 2 planets.');
 if(zr>400||(z+zr)%N!==0)return invalid('Equally spaced assembly requires (sun + ring)/planet count to be an integer.');
 const center=m.carrier_pitch/2,clearance=2*center*Math.sin(Math.PI/N)-p.gearModuleM*(zp+2);
 if(clearance<=0)return invalid('Adjacent planet tip circles overlap.');
 m.fixed_speed_update((p.gearViewTimeS??0)*1000);
 return {status:'ok',moduleId:MODULE_ID,moduleVersion:MODULE_VERSION,modelId:'planetary-willis-mccracken/1',outputs:{gearRingTeeth:zr,gearCarrierAngularSpeedRadPerS:m.carrier_speed,gearPlanetAngularSpeedRadPerS:m.planets[0].gear_speed,gearCenterDistanceM:center,planetTipClearanceM:clearance,sunAngleRad:m.sun.position,ringAngleRad:m.ring.position,carrierAngleRad:m.carrier_position,planets:m.planets.map((planet,i)=>({angleRad:planet.position,orbitAngleRad:m.carrier_position+i*2*Math.PI/N,phaseRad:planet.mesh_correcction}))},diagnostics:[],basis:'Circular pitch converted once from normal spur module; angular speeds rad/s; view time s → upstream ms. No strength calculation.'};
}
