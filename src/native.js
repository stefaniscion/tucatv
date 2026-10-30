import {Capacitor,registerPlugin,CapacitorHttp} from '@capacitor/core';
export const isAndroid=Capacitor.getPlatform()==='android';
export const NativePlayer=registerPlugin('NativePlayer');
export async function nativeText(url){const r=await CapacitorHttp.get({url,responseType:'text',connectTimeout:20000,readTimeout:20000});if(r.status<200||r.status>=300)throw Error('Errore HTTP '+r.status);return typeof r.data==='string'?r.data:JSON.stringify(r.data);}
