import {Capacitor,registerPlugin} from '@capacitor/core';
export const isAndroid=Capacitor.getPlatform()==='android';
export const isDesktop=location.protocol==='tucatv:';
export const isNative=isAndroid||isDesktop;
const androidPlayer=registerPlugin('NativePlayer');
let bridgePromise;
function desktopCall(method,payload,onProgress){
 bridgePromise ||= new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Collegamento desktop non disponibile')),10000);const connect=()=>{if(window.QWebChannel&&window.qt?.webChannelTransport){new window.QWebChannel(window.qt.webChannelTransport,ch=>{clearTimeout(timer);resolve(ch.objects.native);});}else setTimeout(connect,40);};connect();});
 return bridgePromise.then(bridge=>new Promise((resolve,reject)=>{const id=crypto.randomUUID();function progress(requestId,received,total){if(requestId===id)onProgress?.({received,total,percent:total>0&&received<=total?Math.floor(received/total*100):null});}function clean(){bridge.completed.disconnect(done);if(onProgress)bridge.progress?.disconnect(progress);}const timer=setTimeout(()=>{clean();reject(Error('Tempo di attesa scaduto'));},180000);function done(requestId,json){if(requestId!==id)return;clearTimeout(timer);clean();let result;try{result=JSON.parse(json);}catch{return reject(Error('Risposta desktop non valida'));}result.error?reject(Error(result.error)):resolve(result);};bridge.completed.connect(done);if(onProgress)bridge.progress?.connect(progress);bridge.request(id,method,JSON.stringify(payload));}));
}
export const NativePlayer={play:payload=>isDesktop?desktopCall('play',payload):androidPlayer.play(payload)};
export async function nativeImage(url){if(isDesktop)return (await desktopCall('image',{url})).data;return (await androidPlayer.image({url})).data;}
export async function nativeText(url,onProgress){if(isDesktop)return (await desktopCall('text',{url},onProgress)).data;const requestId=crypto.randomUUID();let listener;try{if(onProgress)listener=await androidPlayer.addListener('downloadProgress',p=>{if(p.requestId===requestId)onProgress({received:p.received,total:p.total,percent:p.total>0&&p.received<=p.total?Math.floor(p.received/p.total*100):null});});return (await androidPlayer.text({url,requestId})).data;}finally{await listener?.remove();}}
// The playlist stays in private cache. Only bounded chunks cross the WebView bridge.
export async function nativePlaylist(url,onProgress){
 const requestId=crypto.randomUUID();let listener;
 try{
  listener=await androidPlayer.addListener('downloadProgress',p=>{if(p.requestId===requestId)onProgress?.({received:p.received,total:p.total,percent:p.total>0&&p.received<=p.total?Math.floor(p.received/p.total*100):null});});
  const {handle,size}=await androidPlayer.downloadPlaylist({url,requestId});let closed=false;
  const dispose=async()=>{if(!closed){closed=true;await androidPlayer.closePlaylist({handle});}};
  const stream=new ReadableStream({async pull(controller){try{const part=await androidPlayer.readPlaylistChunk({handle});if(part.done){controller.close();await dispose();}else{const raw=atob(part.data);controller.enqueue(Uint8Array.from(raw,c=>c.charCodeAt(0)));}}catch(error){controller.error(error);await dispose();}},cancel:dispose},{highWaterMark:0});
  return {stream,total:size,dispose};
 }finally{await listener?.remove();}
}
