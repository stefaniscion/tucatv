import {XzReadableStream} from 'xz-decompress';
import {xmltvParser} from './xmltv.js';
import {writeBatch} from './database.js';
let receive;
self.onmessage=async({data})=>{
 if(data.type==='chunk'){receive?.(data);receive=null;return;}
 if(data.type!=='start')return;
 let reader;
 try{
  const raw=new ReadableStream({async pull(controller){const chunk=await new Promise(resolve=>{receive=resolve;self.postMessage({type:'pull'});});if(chunk.error)controller.error(Error(chunk.error));else if(chunk.done)controller.close();else controller.enqueue(new Uint8Array(chunk.buffer));}},{highWaterMark:0});
  // The main thread detects compression by magic bytes, not URL suffixes.
  const stream=data.format==='xz'?new XzReadableStream(raw):data.format==='gzip'?raw.pipeThrough(new DecompressionStream('gzip')):raw;
  reader=stream.getReader();const decoder=new TextDecoder('utf-8',{fatal:true});let bytes=0,batch=[],retained=0;
  const parser=xmltvParser(p=>batch.push(p),{now:data.now});
  const flush=async()=>{if(batch.length){retained+=batch.length;await writeBatch(data.generation,batch);batch=[];}self.postMessage({type:'progress',bytes,count:retained});};
  while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>256*1024*1024)throw Error('EPG_LIMIT');
   for(let i=0;i<value.length;i+=65536){parser.write(decoder.decode(value.subarray(i,i+65536),{stream:true}));if(batch.length>=500)await flush();}
  }
  parser.write(decoder.decode());const parsed=parser.close();await flush();if(!retained)throw Error('EPG_STALE');
  self.postMessage({type:'done',count:retained,parsed,bytes});
 }catch(error){self.postMessage({type:'error',error:error.name==='QuotaExceededError'?'EPG_STORAGE':/^EPG_/.test(error.message)?error.message:'EPG_XML'});}
 finally{reader?.releaseLock();}
};
