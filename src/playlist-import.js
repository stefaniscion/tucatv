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
export async function parsePlaylist(text,base,onProgress=()=>{}){
 if(!text.trimStart().startsWith('#EXTM3U'))throw Error('Il file non è una playlist M3U valida.');
 onProgress({percent:0,count:0});await yieldUI();
 const lines=text.split(/\r?\n/);let channels=[],meta={},epg='';
 for(let i=0;i<lines.length;i++){
  const line=lines[i].trim();
  if(line.startsWith('#EXTM3U'))epg=safe(line.match(/(?:x-tvg-url|url-tvg)="([^"]+)"/i)?.[1],base);
  else if(line.startsWith('#EXTINF:')){const attrs={};for(const match of line.matchAll(/([\w-]+)="([^"]*)"/g))attrs[match[1]]=match[2];let quoted=false,comma=-1;for(let j=0;j<line.length;j++){if(line[j]==='"')quoted=!quoted;else if(line[j]===','&&!quoted){comma=j;break;}}const name=comma>=0?line.slice(comma+1):'Canale';meta={name:name||'Canale',group:attrs['group-title']||'Altri',tvg:attrs['tvg-id']||'',logo:safe(attrs['tvg-logo'],base)};}
  else if(line&&!line.startsWith('#')){const url=safe(line,base);if(url)channels.push({...meta,name:meta.name||'Canale',group:meta.group||'Altri',url});meta={};}
  if((i+1)%1000===0){onProgress({percent:Math.floor((i+1)/lines.length*100),count:channels.length});await yieldUI();}
 }
 if(!channels.length)throw Error('Nessun canale HTTP/HTTPS trovato.');onProgress({percent:100,count:channels.length});await yieldUI();return {channels,epg};
}
