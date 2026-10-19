// Orthographic, vector hidden-line removal. Each point is [x,y,depth], with
// depth increasing towards the viewer. Clip edges against triangle interiors
// and their depth planes; no raster image, CAD runtime or model edits needed.
export function hiddenLinePaths(parts){
 const triangles=[];
 for(const part of parts)if(!part.context)for(const ids of part.triangles){
  const [a,b,c]=ids.map(i=>part.points[i]),area=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  if(Math.abs(area)<1e-10)continue;
  const sign=Math.sign(area),dx=((b[2]-a[2])*(c[1]-a[1])-(c[2]-a[2])*(b[1]-a[1]))/area,dy=((b[0]-a[0])*(c[2]-a[2])-(c[0]-a[0])*(b[2]-a[2]))/area;
  triangles.push({a,b,c,sign,dx,dy,z:a[2]-dx*a[0]-dy*a[1],minX:Math.min(a[0],b[0],c[0]),maxX:Math.max(a[0],b[0],c[0]),minY:Math.min(a[1],b[1],c[1]),maxY:Math.max(a[1],b[1],c[1]),maxZ:Math.max(a[2],b[2],c[2])});
 }
 if(!triangles.length)return parts.map(p=>p.edges.map(([u,v])=>'M'+p.points[u].slice(0,2).join(' ')+'L'+p.points[v].slice(0,2).join(' ')).join(''));
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(const t of triangles){minX=Math.min(minX,t.minX);maxX=Math.max(maxX,t.maxX);minY=Math.min(minY,t.minY);maxY=Math.max(maxY,t.maxY);}
 const cells=32,sx=cells/(maxX-minX||1),sy=cells/(maxY-minY||1),cellX=x=>Math.max(0,Math.min(cells-1,Math.floor((x-minX)*sx))),cellY=y=>Math.max(0,Math.min(cells-1,Math.floor((y-minY)*sy))),grid=Array.from({length:cells*cells},()=>[]),seen=new Uint32Array(triangles.length);
 triangles.forEach((t,i)=>{for(let y=cellY(t.minY);y<=cellY(t.maxY);y++)for(let x=cellX(t.minX);x<=cellX(t.maxX);x++)grid[y*cells+x].push(i);});
 let serial=0;
 return parts.map(part=>{
  if(part.context)return part.edges.map(([u,v])=>'M'+part.points[u].slice(0,2).map(n=>n.toFixed(3)).join(' ')+'L'+part.points[v].slice(0,2).map(n=>n.toFixed(3)).join(' ')).join('');
  let path='';
  for(const [u,v] of part.edges){
   const a=part.points[u],b=part.points[v],dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2];if(Math.hypot(dx,dy)<1e-7)continue;
   const loX=Math.min(a[0],b[0]),hiX=Math.max(a[0],b[0]),loY=Math.min(a[1],b[1]),hiY=Math.max(a[1],b[1]),loZ=Math.min(a[2],b[2]),hidden=[];serial++;
   for(let y=cellY(loY);y<=cellY(hiY);y++)for(let x=cellX(loX);x<=cellX(hiX);x++)for(const index of grid[y*cells+x]){
    if(seen[index]===serial)continue;seen[index]=serial;const t=triangles[index];
    if(t.maxZ<=loZ+1e-5||t.maxX<loX||t.minX>hiX||t.maxY<loY||t.minY>hiY)continue;
    let lo=0,hi=1;
    // Positive half planes describe the projected triangle. The depth
    // tolerance retains coplanar shared edges and avoids self-occlusion.
    for(const [p,q] of [[t.a,t.b],[t.b,t.c],[t.c,t.a]]){
     const ex=q[0]-p[0],ey=q[1]-p[1],value=t.sign*(ex*(a[1]-p[1])-ey*(a[0]-p[0]))+1e-9,slope=t.sign*(ex*dy-ey*dx);
     if(Math.abs(slope)<1e-12){if(value<0){hi=-1;break;}}else if(slope>0)lo=Math.max(lo,-value/slope);else hi=Math.min(hi,-value/slope);
     if(lo>=hi)break;
    }
    if(lo>=hi)continue;
    const depth=t.dx*a[0]+t.dy*a[1]+t.z-a[2]-1e-5,slope=t.dx*dx+t.dy*dy-dz;
    if(Math.abs(slope)<1e-12){if(depth<=0)continue;}else if(slope>0)lo=Math.max(lo,-depth/slope);else hi=Math.min(hi,-depth/slope);
    if(lo<hi)hidden.push([lo,hi]);
   }
   hidden.sort((a,b)=>a[0]-b[0]);let cursor=0;
   const segment=(lo,hi)=>{if((hi-lo)*Math.hypot(dx,dy)<.005)return;const point=t=>(a[0]+t*dx).toFixed(3)+' '+(a[1]+t*dy).toFixed(3);path+='M'+point(lo)+'L'+point(hi);};
   for(const [lo,hi] of hidden){if(lo>cursor)segment(cursor,lo);cursor=Math.max(cursor,hi);if(cursor>=1)break;}
   if(cursor<1)segment(cursor,1);
  }
  return path;
 });
}
