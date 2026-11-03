import {writable,get as storeValue} from 'svelte/store';
import sources from './rytec.json' with {type:'json'};
import {isNative,nativePlaylist} from '../native.js';
import {metadata,commitSource,deleteGeneration,cleanOrphans,clearGuides,lookupGuide} from './database.js';
export {sources,lookupGuide};
const DAY=86400000,MAX_BYTES=256*1024*1024;
function preferences(){try{const value=JSON.parse(localStorage.getItem('tucatv-epg-settings'));return {automatic:value?.automatic!==false,disabled:Array.isArray(value?.disabled)?value.disabled.filter(id=>sources.some(s=>s.id===id)):[]};}catch{return {automatic:true,disabled:[]};}}
export const epgPreferences=writable(preferences());
export const epgState=writable({running:false,source:'',completed:0,total:0,received:0,bytes:0,count:0,phase:'',records:{},errors:{},revision:0});
const patch=values=>epgState.update(state=>({...state,...values}));
let task,controller,initialized=false,autoTimer,ready;
export function configureEpg(values){
 const next={...storeValue(epgPreferences),...values};
 try{localStorage.setItem('tucatv-epg-settings',JSON.stringify(next));}catch{return false;}
 epgPreferences.set(next);epgState.update(s=>({...s,revision:s.revision+1}));return true;
}
export function enabledSources(){const disabled=new Set(storeValue(epgPreferences).disabled);return sources.filter(s=>!disabled.has(s.id));}
async function loadMetadata(){const records=Object.fromEntries((await metadata()).map(s=>[s.id,s]));epgState.update(s=>({...s,records,revision:s.revision+1}));}
export async function startEpg(){
 if(initialized)return;initialized=true;
 ready=(async()=>{await cleanOrphans();await loadMetadata();})();
 try{await ready;}catch{patch({phase:'EPG_STORAGE'});return;}
 if(storeValue(epgPreferences).automatic)void refreshEpg(false);
 autoTimer=setInterval(()=>{if(!document.hidden&&storeValue(epgPreferences).automatic)void refreshEpg(false);},3600000);
}
export function disposeEpg(){clearInterval(autoTimer);controller?.abort();}
export function cancelEpg(){controller?.abort();patch({phase:'EPG_STOPPING'});}
export async function clearEpg(){if(task)return;await clearGuides();patch({records:{},errors:{}});await loadMetadata();}
async function openStream(url,signal){
 if(signal.aborted)throw Error('EPG_CANCELLED');
 if(isNative){const download=await nativePlaylist(url,p=>patch({received:p.received}));if(signal.aborted){await download.dispose();throw Error('EPG_CANCELLED');}return download;}
 if(location.protocol==='https:'&&new URL(url).protocol==='http:')throw Error('EPG_MIXED');
 try{
  const response=await fetch(url,{signal});if(!response.ok)throw Error('EPG_HTTP');if(!response.body)throw Error('EPG_NETWORK');
  return {stream:response.body,total:response.headers.get('content-encoding')?0:Number(response.headers.get('content-length'))||0,dispose:async()=>{}};
 }catch(error){if(signal.aborted)throw Error('EPG_CANCELLED');throw /^EPG_/.test(error.message)?error:Error('EPG_NETWORK');}
}
async function importStream(download,generation,signal){
 const reader=download.stream.getReader();let worker,total=download.total,received=0;
 const read=async()=>{const part=await reader.read();if(!part.done){received+=part.value.byteLength;if(received>MAX_BYTES)throw Error('EPG_LIMIT');}else if(total&&received!==total)throw Error('EPG_TRUNCATED');return part;};
 try{
  if(total>MAX_BYTES)throw Error('EPG_LIMIT');
  // A stream may split its signature across multiple chunks.
  let prefix=new Uint8Array();
  while(prefix.length<6){const part=await read();if(part.done)break;const next=new Uint8Array(prefix.length+part.value.length);next.set(prefix);next.set(part.value,prefix.length);prefix=next;}
  const format=prefix[0]===0xfd&&prefix[1]===0x37&&prefix[2]===0x7a&&prefix[3]===0x58&&prefix[4]===0x5a&&prefix[5]===0?'xz':prefix[0]===0x1f&&prefix[1]===0x8b?'gzip':'xml';
  if(signal.aborted)throw Error('EPG_CANCELLED');
  worker=new Worker(new URL('./import.worker.js',import.meta.url),{type:'module'});
  const result=await new Promise((resolve,reject)=>{
   let first=true,settled=false;
   const abort=()=>finish(Error('EPG_CANCELLED'));
   function finish(error,result){if(settled)return;settled=true;signal.removeEventListener('abort',abort);error?reject(error):resolve(result);}
   signal.addEventListener('abort',abort,{once:true});
   worker.onerror=()=>finish(Error('EPG_XML'));
   worker.onmessage=async({data})=>{
    if(settled)return;
    if(data.type==='pull'){
     try{const part=first?{value:prefix,done:false}:await read();first=false;if(settled)return;
      if(part.done)worker.postMessage({type:'chunk',done:true});else{const bytes=part.value.slice();worker.postMessage({type:'chunk',buffer:bytes.buffer},[bytes.buffer]);}
     }catch(error){finish(error);}
    }else if(data.type==='progress')patch({bytes:data.bytes,count:data.count,phase:'EPG_PARSING'});
    else if(data.type==='done')finish(null,data);
    else if(data.type==='error')finish(Error(data.error));
   };
   worker.postMessage({type:'start',generation,format,now:Date.now()});
  });
  // XZ may finish before requesting EOF; validate the underlying transfer too.
  const tail=await read();if(!tail.done)throw Error('EPG_XML');
  return result;
 }finally{worker?.terminate();await reader.cancel().catch(()=>{});reader.releaseLock();await download.dispose();}
}
async function run(force){
 await ready;
 const enabled=enabledSources(),records=storeValue(epgState).records;
 const pending=enabled.filter(s=>force||!records[s.id]||Date.now()-records[s.id].updated>=DAY);
 if(!pending.length)return;
 controller=new AbortController();const signal=controller.signal;
 patch({running:true,completed:0,total:pending.length,errors:{},phase:'EPG_DOWNLOADING'});
 let completed=0;
 try{
  for(const source of pending){
   if(signal.aborted)break;
   patch({source:source.name,received:0,bytes:0,count:0,phase:'EPG_DOWNLOADING'});
   let failure;
   for(const url of source.urls){
    if(signal.aborted)break;
    const generation=crypto.randomUUID(),attempt=new AbortController();
    const abort=()=>attempt.abort();signal.addEventListener('abort',abort,{once:true});
    const timeout=setTimeout(abort,180000);
    try{
     const download=await openStream(url,attempt.signal);
     const result=await importStream(download,generation,attempt.signal);
     if(signal.aborted)throw Error('EPG_CANCELLED');
     const record={id:source.id,generation,updated:Date.now(),count:result.count};
     await commitSource(record);
     // Publish only a completely validated guide. Keep previous generations on errors.
     const old=storeValue(epgState).records[source.id];
     epgState.update(state=>({...state,records:{...state.records,[source.id]:record},revision:state.revision+1}));
     if(old)await deleteGeneration(old.generation).catch(()=>{});
     failure=null;break;
    }catch(error){
     await deleteGeneration(generation).catch(()=>{});
     failure=signal.aborted?'EPG_CANCELLED':attempt.signal.aborted?'EPG_TIMEOUT':/^EPG_/.test(error.message)?error.message:error.name==='QuotaExceededError'?'EPG_STORAGE':'EPG_NETWORK';
    }finally{clearTimeout(timeout);signal.removeEventListener('abort',abort);}
   }
   if(signal.aborted)break;
   completed++;epgState.update(s=>({...s,completed,errors:failure?{...s.errors,[source.id]:failure}:s.errors}));
  }
 }finally{patch({running:false,source:'',phase:signal.aborted?'EPG_CANCELLED':'EPG_FINISHED'});controller=null;}
}
export function refreshEpg(force=true){if(task)return task;task=run(force).catch(()=>patch({running:false,phase:'EPG_STORAGE'})).finally(()=>task=null);return task;}
