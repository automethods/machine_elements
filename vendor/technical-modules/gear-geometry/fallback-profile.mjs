// Standard, unshifted external spur gears, alpha = 20 degrees.
// Flanks follow the involute of the base circle. Root transitions below the
// base circle are radial segments, not a generated cutter trochoid/fillet.
// KHK: calculation_gear_dimensions.html; AKGears: direct_gear_design.htm.
// Coordinates are metres and may be used as an extrusion profile.
const tau=2*Math.PI;
const polar=(r,a)=>({x:r*Math.cos(a),y:r*Math.sin(a)});
export const involuteAngle=angle=>Math.tan(angle)-angle;
export function involuteGear({teeth,pitchRadiusM,tipRadiusM,rootRadiusM,pressureAngleRad=Math.PI/9}){
 if(!Number.isInteger(teeth)||teeth<18||teeth>400||!(rootRadiusM>0&&rootRadiusM<pitchRadiusM&&pitchRadiusM<tipRadiusM)||!(pressureAngleRad>0&&pressureAngleRad<Math.PI/4))throw new Error('Некоректні параметри евольвентного профілю.');
 const baseRadiusM=pitchRadiusM*Math.cos(pressureAngleRad),start=Math.max(rootRadiusM,baseRadiusM),step=tau/teeth;
 const halfThickness=r=>Math.PI/(2*teeth)+involuteAngle(pressureAngleRad)-involuteAngle(Math.acos(Math.min(1,baseRadiusM/r)));
 if(halfThickness(tipRadiusM)<=0)throw new Error('Загострена вершина зубця поза моделлю профілю.');
 const points=[],radii=[...new Set([...Array.from({length:15},(_,i)=>start+(tipRadiusM-start)*i/14),pitchRadiusM])].sort((a,b)=>a-b);
 for(let tooth=0;tooth<teeth;tooth++){
  const center=tooth*step,baseHalf=halfThickness(start),tipHalf=halfThickness(tipRadiusM);
  points.push(polar(rootRadiusM,center-baseHalf));
  for(const radius of radii)points.push(polar(radius,center-halfThickness(radius)));
  for(let i=1;i<=4;i++)points.push(polar(tipRadiusM,center-tipHalf+2*tipHalf*i/4));
  for(const radius of radii.slice(0,-1).reverse())points.push(polar(radius,center+halfThickness(radius)));
  points.push(polar(rootRadiusM,center+baseHalf));
  for(let i=1;i<=4;i++)points.push(polar(rootRadiusM,center+baseHalf+(step-2*baseHalf)*i/4));
 }
 return {teeth,pitchRadiusM,tipRadiusM,rootRadiusM,baseRadiusM,pressureAngleRad,points,rootTransition:'radial approximation; cutter fillet not generated'};
}
export function profilePath(profile,scale=1){return profile.points.map((point,i)=>(i?'L':'M')+(point.x*scale).toFixed(4)+' '+(point.y*scale).toFixed(4)).join(' ')+' Z';}
