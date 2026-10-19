import {MechanicsModel} from './model.js';
import {proposeShaftBearings} from './design-iterations.js';

// Read-only snapshot search. Only the main-thread adoption command can edit
// the accepted project; its revision is checked again when this reply arrives.
self.onmessage=({data})=>{
 try{const model=new MechanicsModel(data.inputs,data.mode),proposal=proposeShaftBearings(model);self.postMessage({proposal:{...proposal,baseRevision:data.revision}});}
 catch(error){self.postMessage({error:error.message});}
};
