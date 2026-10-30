import {Capacitor,registerPlugin,CapacitorHttp} from '@capacitor/core';
export const isAndroid=Capacitor.getPlatform()==='android';
export const isDesktop=location.protocol==='tucatv:';
export const isNative=isAndroid||isDesktop;
const androidPlayer=registerPlugin('NativePlayer');
let bridgePromise;
function desktopCall(method,payload){
 bridgePromise ||= new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Collegamento desktop non disponibile')),10000);const connect=()=>{if(window.QWebChannel&&window.qt?.webChannelTransport){new window.QWebChannel(window.qt.webChannelTransport,ch=>{clearTimeout(timer);resolve(ch.objects.native);});}else setTimeout(connect,40);};connect();});
 return bridgePromise.then(bridge=>new Promise((resolve,reject)=>{const id=crypto.randomUUID();const timer=setTimeout(()=>{bridge.completed.disconnect(done);reject(Error('Tempo di attesa scaduto'));},45000);function done(requestId,json){if(requestId!==id)return;clearTimeout(timer);bridge.completed.disconnect(done);let result;try{result=JSON.parse(json);}catch{return reject(Error('Risposta desktop non valida'));}result.error?reject(Error(result.error)):resolve(result);};bridge.completed.connect(done);bridge.request(id,method,JSON.stringify(payload));}));
}
export const NativePlayer={play:payload=>isDesktop?desktopCall('play',payload):androidPlayer.play(payload)};
export async function nativeImage(url){if(isDesktop)return (await desktopCall('image',{url})).data;return (await androidPlayer.image({url})).data;}
export async function nativeText(url){if(isDesktop)return (await desktopCall('text',{url})).data;const r=await CapacitorHttp.get({url,responseType:'text',connectTimeout:20000,readTimeout:20000});if(r.status<200||r.status>=300)throw Error('Errore HTTP '+r.status);return typeof r.data==='string'?r.data:JSON.stringify(r.data);}
