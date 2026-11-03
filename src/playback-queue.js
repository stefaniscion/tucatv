import {LocalizedError} from './i18n.js';
// Bound each bridge message independently of the size of the catalogue.
export function* queueChunks(channels){
 let items=[],bytes=0;const encoder=new TextEncoder();
 for(const channel of channels){
  const item={url:channel.url,title:(channel.title||channel.name||'TucaTV').slice(0,300)};
  const size=encoder.encode(JSON.stringify(item)).length+1;
  if(size>65536)throw new LocalizedError('Indirizzo del canale troppo lungo.');
  if(items.length&&(items.length===100||bytes+size>131072)){yield items;items=[];bytes=0;}
  items.push(item);bytes+=size;
 }
 if(items.length)yield items;
}
export async function playNativeQueue(call,{queue,...payload}){
 const {handle}=await call('beginQueue',{});
 try{
  for(const items of queueChunks(queue))await call('appendQueue',{handle,items});
  return await call('play',{...payload,queueHandle:handle});
 }finally{await call('closeQueue',{handle}).catch(()=>{});}
}
