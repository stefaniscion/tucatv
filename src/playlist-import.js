export const MAX_PLAYLIST_BYTES=64*1024*1024;
export const yieldUI=()=>new Promise(resolve=>setTimeout(resolve,0));
export function byteProgress(received,total){return {received,total:total>0&&received<=total?total:0,percent:total>0&&received<=total?Math.min(100,Math.floor(received/total*100)):null};}
export function formatBytes(bytes){return bytes<1024*1024?(bytes/1024).toFixed(0)+' KB':(bytes/1024/1024).toFixed(1)+' MB';}
export async function readTextStream(stream,{total=0,onProgress=()=>{},limit=MAX_PLAYLIST_BYTES}={}){
 if(total>limit)throw Error('La playlist supera il limite di 64 MB.');
 const reader=stream.getReader(),decoder=new TextDecoder();let received=0,parts=[],last=0;
 onProgress(byteProgress(0,total));
 try{while(true){const {done,value}=await reader.read();if(done)break;received+=value.byteLength;if(received>limit)throw Error('La playlist supera il limite di 64 MB.');parts.push(decoder.decode(value,{stream:true}));if(Date.now()-last>80){onProgress(byteProgress(received,total));last=Date.now();}}
 parts.push(decoder.decode());onProgress(byteProgress(received,total));return parts.join('');
 }catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
}
function safe(value,base){if(typeof value!=='string'||!value.trim())return '';try{const url=new URL(value,base);return ['http:','https:'].includes(url.protocol)?url.href:'';}catch{return '';}}
// Incremental parser: retain only the current chunk/line, never a full line array.
export async function parsePlaylistStream(stream,base,{total=0,onProgress=()=>{},limit=MAX_PLAYLIST_BYTES}={}){
 const reader=stream.getReader(),decoder=new TextDecoder();let received=0,pending='',header=false,channels=[],meta={},epg='',finished=false;
 function line(raw){
  const value=raw.trim();if(!value)return;
  if(value.length>65536)throw Error('La playlist contiene una riga troppo lunga.');
  if(!header){if(!value.startsWith('#EXTM3U'))throw Error('Il file non è una playlist M3U valida.');header=true;}
  if(value.startsWith('#EXTM3U'))epg=safe(value.match(/(?:x-tvg-url|url-tvg)="([^"]+)"/i)?.[1],base);
  else if(value.startsWith('#EXTINF:')){const attrs={};for(const match of value.matchAll(/([\w-]+)="([^"]*)"/g))attrs[match[1]]=match[2];let quoted=false,comma=-1;for(let j=0;j<value.length;j++){if(value[j]==='"')quoted=!quoted;else if(value[j]===','&&!quoted){comma=j;break;}}meta={name:(comma>=0?value.slice(comma+1):'Canale')||'Canale',group:attrs['group-title']||'Altri',tvg:attrs['tvg-id']||'',logo:safe(attrs['tvg-logo'],base)};}
  else if(!value.startsWith('#')){const url=safe(value,base);if(url)channels.push({...meta,name:meta.name||'Canale',group:meta.group||'Altri',url});meta={};}
 }
 function consume(text){pending+=text;let start=0,end;while((end=pending.indexOf('\n',start))!==-1){line(pending.slice(start,end));start=end+1;}pending=pending.slice(start);if(pending.length>65536)throw Error('La playlist contiene una riga troppo lunga.');}
 try{
  if(total>limit)throw Error('La playlist supera il limite di 64 MB.');
  onProgress({...byteProgress(0,total),count:0});await yieldUI();
  while(true){const {done,value}=await reader.read();if(done)break;received+=value.byteLength;if(received>limit)throw Error('La playlist supera il limite di 64 MB.');
   // Bound synchronous work even when a source supplies unusually large chunks.
   for(let offset=0;offset<value.byteLength;offset+=65536){consume(decoder.decode(value.subarray(offset,offset+65536),{stream:true}));onProgress({...byteProgress(received-value.byteLength+Math.min(offset+65536,value.byteLength),total),count:channels.length});await yieldUI();}
  }
  consume(decoder.decode());line(pending);
  if(!header)throw Error('Il file non è una playlist M3U valida.');
  if(!channels.length)throw Error('Nessun canale HTTP/HTTPS trovato.');
  finished=true;onProgress({received,total:received,percent:100,count:channels.length});return {channels,epg};
 }finally{if(!finished)await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export function parsePlaylist(text,base,onProgress=()=>{}){const blob=new Blob([text]);return parsePlaylistStream(blob.stream(),base,{total:blob.size,onProgress});}
