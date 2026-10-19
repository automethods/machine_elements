import earcut,{deviation} from './vendor/Earcut/src/earcut.js';
export function extrudeRegion(regionsM,widthM){
 const area=r=>r.reduce((s,a,i)=>{const b=r[(i+1)%r.length];return s+a[0]*b[1]-b[0]*a[1];},0)/2;
 const regions=regionsM.map((region,i)=>{if(region.length<3||!region.every(p=>p.length===2&&p.every(Number.isFinite)))throw Error('Invalid BOSL2 region.');return (area(region)>0)===(i===0)?region:[...region].reverse();});
 const points=regions.flat(),offsets=[];let count=regions[0].length;for(const region of regions.slice(1)){offsets.push(count);count+=region.length;}
 const flat=points.flat(),cap=earcut(flat,offsets,2);
 if(deviation(flat,offsets,2,cap)>1e-6)throw Error('Ring triangulation does not preserve polygon area.');
 const n=points.length,verticesM=[...points.map(([x,y])=>[x,y,-widthM/2]),...points.map(([x,y])=>[x,y,widthM/2])],triangles=[];
 for(let i=0;i<cap.length;i+=3){const [a,b,c]=cap.slice(i,i+3);triangles.push([c,b,a],[a+n,b+n,c+n]);}
 let offset=0;for(const region of regions){for(let i=0;i<region.length;i++){const a=offset+i,b=offset+(i+1)%region.length;triangles.push([a,b,b+n],[a,b+n,a+n]);}offset+=region.length;}
 return {verticesM,triangles};
}
