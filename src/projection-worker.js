import {hiddenLinePaths} from './hidden-lines.js';
self.onmessage=({data})=>{
 try{self.postMessage({paths:data.map(parts=>hiddenLinePaths(parts))});}
 catch(error){self.postMessage({error:error.message});}
};
