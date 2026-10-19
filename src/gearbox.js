export const GEARBOX_TYPES={0:'Циліндричний',1:'Конічний',2:'Черв’ячний',3:'Планетарний',4:'Комбінований'};
export const STAGE_TYPES={0:'Циліндричний',1:'Конічний',2:'Черв’ячний',3:'Планетарний'};
export const stageType=(p,j)=>p.gearboxType===4?p['stageType'+j]:p.gearboxType;
export const stageFamily=(p,j)=>['cylindrical','bevel','worm','planetary'][stageType(p,j)];
export const cadFamily=(p,j)=>stageType(p,j)===0?(p['beta'+j]===0?'spur':'helical'):['','bevel','worm','planetary'][stageType(p,j)];
export const gearboxLabel=p=>GEARBOX_TYPES[p.gearboxType]+(p.gearboxType===4?' ('+Array.from({length:p.stages},(_,i)=>STAGE_TYPES[stageType(p,i+1)]).join(' → ')+')':'');
export function gearboxPreset(p,type,stage){
 const patch=stage?{['stageType'+stage]:type}:{gearboxType:type};
 const stages=stage?[stage]:Array.from({length:type===2?1:p.stages},(_,i)=>i+1);
 if(!stage&&type===2)patch.stages=1;
 if(!stage&&type===4)patch.stages=2;
 for(const j of stages){
  if(type===2)Object.assign(patch,{['wormStarts'+j]:2,['z2_'+j]:38,['wormDiameterFactor'+j]:12,['wormLength'+j]:.08,['width'+j]:.012,['eta'+j]:.85});
  if(type===3)Object.assign(patch,{['z1_'+j]:24,['planetTeeth'+j]:27,['planetCount'+j]:3,['planetRimThickness'+j]:Math.max(.006,p['module'+j]),['eta'+j]:.98,outputRadialForce:1000});
 }
 return patch;
}
// All engineering expressions are evaluated by the native document engine.
export function gearboxExpressions(p){
 const result={};
 for(const j of [1,2]){
  const type=stageType(p,j),z1=`z1_${j}`,z2=`z2_${j}`,m=`m_${j}`,b=`b_${j}`,beta=`beta_${j}`,gamma=`gamma_${j}`,delta=`cone1_${j}`,R=`coneR_${j}`;
  result[`u_${j}`]=type===2?`${z2}/starts_${j}`:type===3?`1+ringZ_${j}/${z1}`:`${z2}/${z1}`;
  result[`d1_${j}`]=type===2?`${m}*q_w${j}`:type===0?`${m}*${z1}/cos(${beta})`:`${m}*${z1}`;
  result[`d2_${j}`]=type===2?`${m}*${z2}/cos(${gamma})`:type===3?`${m}*ringZ_${j}`:type===0?`${m}*${z2}/cos(${beta})`:`${m}*${z2}`;
  result[`aw_${j}`]=type===1?'zero_L':type===3?`${m}*(${z1}+zp_${j})/2`:`(d1_${j}+d2_${j})/2`;
  result[`da1_${j}`]=type===1?`d1_${j}+2*${m}*cos(${delta})`:`d1_${j}+2*${m}`;
  result[`df1_${j}`]=type===1?`d1_${j}-2.5*${m}*cos(${delta})`:`d1_${j}-2.5*${m}`;
  result[`da2_${j}`]=type===1?`d2_${j}+2*${m}*cos(cone2_${j})`:type===3?`d2_${j}-2*${m}`:`d2_${j}+2*${m}`;
  result[`df2_${j}`]=type===1?`d2_${j}-2.5*${m}*cos(cone2_${j})`:type===3?`d2_${j}+2.5*${m}`:`d2_${j}-2.5*${m}`;
  result[`Ft_${j}`]=type===2?`2*T_${j}/d2_${j}`:type===3?`2*T_${j-1}/(d1_${j}*Np_${j})`:type===1?`2*T_${j}/(d2_${j}*(1-${b}/(2*${R})))`:`2*T_${j-1}/d1_${j}`;
  result[`Fr_${j}`]=type===0?`Ft_${j}*tan(alpha)/cos(${beta})`:type===1?`Ft_${j}*tan(alpha)*cos(cone2_${j})`:type===2?`Ft_${j}*tan(alpha)/cos(${gamma})`:`Ft_${j}*tan(alpha)`;
  result[`Fa_${j}`]=type===0?`Ft_${j}*tan(${beta})`:type===1?`Ft_${j}*tan(alpha)*sin(cone2_${j})`:type===2?`Ft_${j}*tan(${gamma})`:'zero_F';
  result[`pH_${j}`]=`sqrt(Ft_${j}*K*E/(2*(1-nu^2)*pi*b_${j}*rho_${j}*cos(alphaT_${j})))`;
  result[`rho_${j}`]=`sin(alphaT_${j})*d1_${j}*d2_${j}/(2*(d1_${j}+d2_${j}))`;
 }
 const j=p.stages,type=stageType(p,j);
 result.Ft_out=`K*Ft_${j}`;result.Fr_out=`K*Fr_${j}`;result.Fa_out=`K*Fa_${j}`;
 result.F_out=type===3?'F_external':'sqrt(Ft_out^2+Fr_out^2)+F_external';
 const multiplier=type===2?`starts_${j}`:type===3?`z1_${j}/2`:`z1_${j}`;
 const ratio='u_req/(u_ext*'+(j===2?'u_1':'1')+')';
 result.z2_req=type===3?`(${ratio}-2)*${multiplier}`:`${ratio}*${multiplier}`;
 return result;
}
