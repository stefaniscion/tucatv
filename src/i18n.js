import {writable,derived,get} from 'svelte/store';
import it from './locales/it.json' with {type:'json'};
import en from './locales/en.json' with {type:'json'};

export const languages=Object.freeze({it:'Italiano',en:'English'});
export const dictionaries={it,en};
export function resolveLocale(saved,preferred=[]){
 if(Object.hasOwn(languages,saved))return saved;
 for(const value of preferred){const code=String(value).toLowerCase().split(/[-_]/)[0];if(Object.hasOwn(languages,code))return code;}
 return 'en';
}
function initialPreference(){
 try{const saved=localStorage.getItem('tucatv-language');return Object.hasOwn(languages,saved)?saved:'device';}catch{return 'device';}
}
function deviceLanguages(){return typeof document==='undefined'?['it']:globalThis.navigator?.languages||[globalThis.navigator?.language];}
export const languagePreference=writable(initialPreference());
export const locale=writable(resolveLocale(get(languagePreference),deviceLanguages()));
export const currentLocale=()=>get(locale);
export function refreshDeviceLocale(){locale.set(resolveLocale(get(languagePreference),deviceLanguages()));}
export function setLocale(value){
 const preference=Object.hasOwn(languages,value)?value:'device';
 try{localStorage.setItem('tucatv-language',preference);}catch{return false;}
 languagePreference.set(preference);refreshDeviceLocale();return true;
}
export const message=(key,params={})=>({key,params});
// Source-language keys are stable identifiers, not provider-supplied content.
const reverse=new Map(Object.entries(en).filter(([,v])=>typeof v==='string').map(([k,v])=>[v,k]));
export function translate(value,params={},language=currentLocale()){
 if(value==null)return '';
 if(typeof value==='object'){params=value.params||{};value=value.key;}
 const key=Object.hasOwn(it,value)?value:reverse.get(value)||value;
 const lookup=dict=>dict&&Object.hasOwn(dict,key)?dict[key]:undefined;
 const text=lookup(dictionaries[language])??lookup(en)??lookup(it)??String(value);
 return text.replace(/\{(\w+)\}/g,(match,name)=>Object.hasOwn(params,name)?String(typeof params[name]==='object'?translate(params[name],{},language):typeof params[name]==='number'?new Intl.NumberFormat(language).format(params[name]):params[name]):match);
}
export const t=derived(locale,language=>(value,params)=>translate(value,params,language));
export class LocalizedError extends Error{
 constructor(key,params={}){super(translate(key,params));this.i18n=message(key,params);}
}
