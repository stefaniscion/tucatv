<script>
import {t,locale,languagePreference,setLocale,refreshDeviceLocale,message as messageText} from './i18n.js';
import EpgSettings from './EpgSettings.svelte';
import {epgState,startEpg,disposeEpg,lookupGuide,enabledSources} from './epg/service.js';
import {settings,changeSetting} from './settings.js';
import LoadMore from './LoadMore.svelte';import CategoryManager from './CategoryManager.svelte';import {visibleChannels,lastOpenedChannel} from './playlist-preferences.js';import TVCatalog from './TVCatalog.svelte';import {moveFocus,focusControl} from './tv-navigation.js';import {refreshAtStartup} from './startup-refresh.js';import {readTextStream,parsePlaylistStream,formatBytes,yieldUI} from './playlist-import.js';import Player from './Player.svelte';import Intro from './Intro.svelte';import Catalog from './Catalog.svelte';import {separator,kind,indexCatalogue,filterCatalogue,currentGuide} from './catalog.js';import Hls from 'hls.js';import {isAndroid,isDesktop,isNative,NativePlayer,nativeText,nativePlaylist,playbackState,resumePlayback,stopPlayback,exitToHome,watchPlayback,setNativeLanguage} from './native.js';import {playlistResponse,browserNetworkError} from './playlist-network.js';import {get,set,update,del} from 'idb-keyval';import {tick,onDestroy,onMount,untrack} from 'svelte';
let lists=$state.raw([]),active=$state(''),page=$state('playlists'),query=$state(''),group=$state('__all'),favorites=$state([]),name=$state(''),url=$state(''),message=$state(''),epgMessage=$state(''),playbackMode=$state('auto'),busy=$state(false),selected=$state(null),video=$state(),hls,programs=$state.raw([]),clock=$state(Date.now());
let loading=$state(null),failedSource=$state(''),tvMode=true,currentPlayback=$state(null),startupRefreshing=$state(false),refreshLabel=$state(''),searchQuery=$state('');
let categoryEditor=$state(null),lastOpened=$state.raw({});
let playbackPoll,playbackSubscription,destroyed=false;
$effect(()=>{const value=query;const timeout=setTimeout(()=>searchQuery=value,180);return()=>clearTimeout(timeout);});
let collectionLimit=$state(12),opening=$state(false),selectedOwner='',intro=$state(true),catalogMode=$state($settings.initialSection),view=$state($settings.initialView),playbackError=$state('');let playbackTimer;

let storageReady=$state(false),rytecPrograms=$state.raw([]),guideRequest=0;
$effect(()=>{const ids=channels.map(c=>c.tvg),revision=$epgState.revision,now=clock;if(!storageReady)return;const request=++guideRequest;const timer=setTimeout(()=>{lookupGuide(ids,enabledSources().map(s=>s.id),now).then(items=>{if(request===guideRequest&&!destroyed)rytecPrograms=items;}).catch(()=>{});},150);return()=>clearTimeout(timer);});
$effect(()=>{const language=$locale;document.documentElement.lang=language;document.title=$t('TucaTV · La tua TV, prende il volo');if(isNative)setNativeLanguage(language).catch(()=>{message='Impossibile sincronizzare la lingua del player. Riprova.';});});
onMount(()=>{void boot();window.addEventListener('tuca-back',back);return()=>{destroyed=true;window.removeEventListener('tuca-back',back);clearInterval(playbackPoll);playbackSubscription?.remove();};});
async function boot(){
 try{let saved=await get('tucatv');if(!saved){saved=JSON.parse(localStorage.getItem('tucatv')||'{}');await set('tucatv',saved);localStorage.removeItem('tucatv');}lists=(saved.lists||[]).map(p=>({...p,epg:p.epg===p.source?'':p.epg}));favorites=saved.favorites||[];active=lists[0]?.id||'';if(lists.length)page='channels';}catch{message='Impossibile leggere i dati locali.';}
 try{lastOpened=await get('tuca-last-opened')||{};}catch{}
 storageReady=true;void startEpg();await tick();ensureFocus();
 if(isNative){try{playbackSubscription=await watchPlayback(state=>{acceptPlayback(state);ensureFocus();});if(destroyed){await playbackSubscription.remove();return;}await syncPlayback();playbackPoll=setInterval(()=>{if(!document.hidden)syncPlayback();},4000);}catch{}}
 if($settings.refreshOnStartup)await autoRefresh();
}
function acceptPlayback(state){currentPlayback=isAndroid&&state.available?state:null;if(state.lastPlayed)rememberOpened({url:state.lastPlayed.url},state.lastPlayed.playlistId,state.lastPlayed.at);}
async function syncPlayback(){try{acceptPlayback(await playbackState());}catch{}}
async function returnToPlayer(){try{await resumePlayback();}catch{await syncPlayback();message='La riproduzione è terminata. Seleziona nuovamente un canale.';}}
async function stopCurrent(){try{await stopPlayback();currentPlayback=null;await tick();ensureFocus();}catch{message='Impossibile interrompere la riproduzione.';}}
function ensureFocus(){if(!tvMode||intro||!storageReady)return;const focused=document.activeElement;if(!focused||focused===document.body||!focused.isConnected)focusControl(document.querySelector('.tv-tile,aside button.chosen,aside button'));}
$effect(()=>{tvMode;intro;storageReady;page;tick().then(ensureFocus);});
async function autoRefresh(){
 if(busy||!lists.some(p=>p.source)||destroyed)return;busy=true;startupRefreshing=true;message='';failedSource='';
 const result=await refreshAtStartup(lists,active,async(p,position)=>{refreshLabel=p.name+' · '+position.index+'/'+position.total;await refreshOne(p);});
 startupRefreshing=false;busy=false;refreshLabel='';loading={phase:result.failed?'error':'done',title:result.failed?'Aggiornamento parziale':'Playlist aggiornate',detail:result.failed?messageText('Aggiornate: {count} · Non raggiungibili: {failed}. Uso le copie salvate.',{count:result.updated,failed:result.failed}):messageText('Aggiornate: {count}. La raccolta è pronta.',{count:result.updated}),percent:result.failed?null:100};await tick();ensureFocus();
}
const timer=setInterval(()=>clock=Date.now(),30000);onDestroy(()=>{clearInterval(timer);disposeEpg();stop();});
let playlist=$derived(lists.find(p=>p.id===active)),channels=$derived(visibleChannels(playlist?.channels||[],playlist?.hiddenGroups||[])),catalogIndex=$derived(indexCatalogue(channels)),groups=$derived(['__all','__favorites',...catalogIndex[catalogMode+'Groups']]),filtered=$derived(filterCatalogue(catalogIndex[catalogMode],searchQuery,group,favorites)),guideIndex=$derived(currentGuide([...programs,...rytecPrograms],clock)),lastChannel=$derived(lastOpenedChannel(catalogIndex[catalogMode],lastOpened[active]));
async function save(){try{await set('tucatv',{lists,favorites:$state.snapshot(favorites)});}catch{message='Impossibile salvare: controlla lo spazio disponibile sul dispositivo.';}}
function safe(s,base){if(typeof s!=='string'||!s.trim())return '';try{let u=new URL(s,base);return ['https:','http:'].includes(u.protocol)?u.href:''}catch{return ''}}
async function fetchText(u,onProgress){if(!safe(u))throw Error('Inserisci un URL HTTP o HTTPS valido.');if(isNative)return nativeText(u,onProgress);const r=await playlistResponse(u);const total=r.headers.get('content-encoding')?0:Number(r.headers.get('content-length'))||0;try{if(r.body)return await readTextStream(r.body,{total,onProgress,limit:64*1024*1024});return await r.text();}catch(error){throw browserNetworkError(error);}}
async function importPlaylist(source,file){
 if(file)return parsePlaylistStream(file.stream(),undefined,{total:file.size,onProgress:parseProgress});
 if(!safe(source))throw Error('Inserisci un URL HTTP o HTTPS valido.');
 if(isNative){const download=await nativePlaylist(source,downloadProgress);try{return await parsePlaylistStream(download.stream,source,{total:download.total,onProgress:parseProgress});}finally{await download.dispose();}}
 try{const response=await playlistResponse(source);const total=response.headers.get('content-encoding')?0:Number(response.headers.get('content-length'))||0;
  if(!response.body)throw Error('Questo browser non supporta l’importazione a blocchi. Salva il file M3U e usa «Carica file».');
  return await parsePlaylistStream(response.body,source,{total,onProgress:p=>{loading={phase:'download',title:'Download e lettura della playlist',detail:messageText('{bytes} · {count} canali trovati',{bytes:messageText(p.total?'{received} di {total}':'{received} ricevuti',{received:formatBytes(p.received),total:formatBytes(p.total)}),count:p.count}),percent:p.percent};}});
 }catch(error){if(!startupRefreshing)failedSource=source;throw browserNetworkError(error);}
}
function downloadProgress(p){loading={phase:'download',title:'Download della playlist',detail:messageText(p.total?'{received} di {total}':'{received} ricevuti · dimensione totale non disponibile',{received:formatBytes(p.received),total:formatBytes(p.total)}),percent:p.percent};}
function parseProgress(p){loading={phase:'parse',title:'Lettura dei canali',detail:messageText('{count} canali trovati',{count:p.count}),percent:p.percent};}
async function persistImport(nextLists){loading={phase:'save',title:'Salvataggio sul dispositivo',detail:'La playlist sarà pronta al termine del salvataggio.',percent:null};await tick();await yieldUI();try{await set('tucatv',{lists:nextLists,favorites:$state.snapshot(favorites)});}catch{throw Error('Impossibile salvare: controlla lo spazio disponibile sul dispositivo.');}lists=nextLists;}
async function add(file){if(busy)return;busy=true;message='';failedSource='';const source=url,label=name.trim()||file?.name||$t('La mia playlist');loading={phase:'download',title:file?'Lettura del file':'Connessione alla sorgente',detail:file?file.name:'In attesa della risposta del server…',percent:null};await tick();await yieldUI();try{const parsed=await importPlaylist(source,file);const p={id:Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join(''),name:label,source:file?'':source,...parsed,epg:parsed.epg,updated:Date.now()};await persistImport([...lists,p]);active=p.id;name='';url='';page='channels';loading={phase:'done',title:'Playlist pronta',detail:messageText('{count} canali caricati e salvati',{count:parsed.channels.length}),percent:100};}catch(e){message=e.i18n||e.message;loading={phase:'error',title:'Caricamento non completato',detail:'Controlla il messaggio di errore e riprova.',percent:null};}finally{busy=false;}}
async function refreshOne(p){loading={phase:'download',title:'Aggiornamento playlist',detail:'Connessione alla sorgente…',percent:null};await tick();const parsed=await importPlaylist(p.source);await persistImport(lists.map(x=>x.id===p.id?{...x,...parsed,epg:x.epg||parsed.epg,updated:Date.now()}:x));if(active===p.id)loadEpg();}
async function refresh(p){if(busy)return;busy=true;message='';failedSource='';try{await refreshOne(p);loading={phase:'done',title:'Playlist aggiornata',detail:'La raccolta è stata aggiornata e salvata.',percent:100};}catch(e){message=messageText('Aggiornamento fallito: {error}',{error:e.i18n||messageText(e.message)});loading={phase:'error',title:'Aggiornamento non completato',detail:'La playlist precedente è stata conservata.',percent:null};}finally{busy=false;}}
function remove(id){if(busy)return;lists=lists.filter(p=>p.id!==id);if(active===id)active=lists[0]?.id||'';del('tuca-epg-'+id).catch(()=>{});save();}
function favorite(c){favorites=favorites.includes(c.url)?favorites.filter(u=>u!==c.url):[...favorites,c.url];const snapshot=$state.snapshot(favorites);update('tucatv',saved=>({...saved,favorites:snapshot})).catch(()=>message='Impossibile salvare i preferiti.');}
function date(s){let m=s?.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4})?/);return m?Date.parse(m[1]+'-'+m[2]+'-'+m[3]+'T'+m[4]+':'+m[5]+':'+(m[6]||'00')+(m[7]?m[7].slice(0,3)+':'+m[7].slice(3):'Z')):NaN;}
let epgRequest=0;
$effect(()=>{const owner=playlist?.id,source=playlist?.epg;if(storageReady)untrack(()=>loadEpg());});
async function loadEpg(file){
 const request=++epgRequest,owner=active,source=playlist?.epg;
 const current=()=>request===epgRequest&&owner===active&&!destroyed;
 epgMessage='';programs=[];if(!owner)return;
 try{
  const cached=await get('tuca-epg-'+owner);if(!current())return;
  if(cached&&(cached.source===source||cached.local)){programs=cached.programs;epgMessage='Guida TV salvata sul dispositivo.';}
  if(!file&&!source)return;
  const text=file?await readTextStream(file.stream(),{total:file.size,limit:64*1024*1024}):await fetchText(source);
  if(!current())return;
  const doc=new DOMParser().parseFromString(text,'text/xml');
  if(doc.querySelector('parsererror')||!doc.querySelector('tv'))throw Error('XML non valido');
  const parsed=[...doc.querySelectorAll('programme')].map(p=>({channel:p.getAttribute('channel'),start:date(p.getAttribute('start')),end:date(p.getAttribute('stop')),title:p.querySelector('title')?.textContent||'',description:p.querySelector('desc')?.textContent||''}));
  programs=parsed;epgMessage='Guida TV caricata.';
  try{await set('tuca-epg-'+owner,{source,local:!!file,programs:parsed});}catch{if(current())epgMessage='Guida caricata, ma non salvata: controlla lo spazio disponibile.';}
 }catch{if(current())epgMessage=programs.length?'Aggiornamento guida non riuscito: uso la copia salvata.':'Guida TV non disponibile: verifica la sorgente XMLTV. Questo non impedisce la riproduzione dei canali.';}
}

function now(c){return guideIndex.now.get(c?.tvg)}
function next(c){return guideIndex.next.get(c?.tvg)}
function time(t){return new Date(t).toLocaleTimeString($locale,{hour:'2-digit',minute:'2-digit'})}
function stop(){clearTimeout(playbackTimer);hls?.destroy();hls=null;if(video){video.pause();video.removeAttribute('src');video.load();}}
let playRequest=0, fallbackUsed=false;
function fail(text){clearTimeout(playbackTimer);playbackError=text;hls?.destroy();hls=null;if(video){video.pause();video.removeAttribute('src');video.load();}}
function startHls(c,request){
 fallbackUsed=true;
 if(video.canPlayType('application/vnd.apple.mpegurl')){video.src=c.url;video.play().catch(()=>{});return;}
 if(!Hls.isSupported()){fail('Questo browser non supporta HLS. Apri la sorgente con un player esterno.');return;}
 hls=new Hls();hls.on(Hls.Events.ERROR,(_,d)=>{if(request!==playRequest||!d.fatal)return;const status=d.response?.code;fail(status?messageText('La sorgente ha risposto con HTTP {status}. Verifica accesso e validità del link.',{status}):d.type===Hls.ErrorTypes.NETWORK_ERROR?'Il browser non riesce a leggere lo stream: possibili permessi CORS, errore di rete o accesso negato. Il browser non permette di distinguere sempre queste cause.':'Il contenuto non è HLS valido oppure usa codec non supportati dal browser.');});
 hls.on(Hls.Events.MANIFEST_PARSED,()=>{if(request===playRequest)video?.play().catch(()=>{});});hls.loadSource(c.url);hls.attachMedia(video);
}
function mediaError(){if(!video?.getAttribute('src')||page!=='player'||playbackError)return;
 if(playbackMode==='auto'&&!fallbackUsed&&!/\.(mp4|mkv|avi|mov|webm|m4v)(?:[?#]|$)/i.test(selected.url)&&Hls.isSupported()){video.removeAttribute('src');video.load();startHls(selected,playRequest);return;}
 fail(video.error?.code===2?'Download dello stream fallito. Verifica la connessione e i permessi della sorgente.':'Formato o codec non riproducibile in questo browser, oppure accesso alla sorgente negato. Il supporto di VLC è diverso da quello del browser.');
}
function exportSelected(){const blob=new Blob(['#EXTM3U\n#EXTINF:-1,'+selected.name.replace(/[\r\n]/g,' ')+'\n'+selected.url+'\n'],{type:'audio/x-mpegurl'});const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='TucaTV-stream.m3u';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
function rememberOpened(c,owner=selectedOwner,at=Date.now()){if(!owner||!c?.url||!lists.some(p=>p.id===owner)||lastOpened[owner]?.at>=at)return;lastOpened={...lastOpened,[owner]:{url:c.url,at}};set('tuca-last-opened',lastOpened).catch(()=>{});}
async function editCategories(p){categoryEditor=p.id;await tick();focusControl(document.querySelector('.category-manager input'));}
async function saveCategories(value){const hidden=$state.snapshot(value);const id=categoryEditor;await update('tucatv',saved=>({...saved,lists:(saved?.lists||lists).map(p=>p.id===id?{...p,hiddenGroups:hidden}:p)}));lists=lists.map(p=>p.id===id?{...p,hiddenGroups:hidden}:p);group='__all';}
async function play(c){
 if(separator(c)){message='Questa voce è un separatore: seleziona un canale reale.';return;}
 if(opening)return;
 selectedOwner=active;
 if(isNative){opening=true;message='Preparazione riproduzione…';try{const pool=filtered.some(x=>x.url===c.url)?filtered:[c,...filtered];const index=pool.findIndex(x=>x.url===c.url);await NativePlayer.play({url:c.url,title:c.name,playlistId:active,queue:pool,index});message='';}catch{message='Impossibile aprire il player nativo.';}finally{opening=false;}return;}
 const request=++playRequest;stop();selected=c;page='player';message='';playbackError='';fallbackUsed=false;await tick();if(request!==playRequest||page!=='player')return;
 if(location.protocol==='https:'&&new URL(c.url).protocol==='http:'){fail('TucaTV non ha avviato questa sorgente HTTP dalla pagina HTTPS, per evitare blocchi o aggiornamenti automatici del link da parte del browser. Usa l’app Android o VLC; per il player web richiedi al gestore una sorgente HTTPS compatibile.');return;}
 playbackTimer=setTimeout(()=>{if(request===playRequest&&video.readyState<2)fail('La sorgente non ha fornito video entro 20 secondi. Verifica il link e i permessi CORS oppure aprila in VLC.');},20000);
 const isHls=/\.m3u8(?:[?#]|$)|[?&]output=m3u8(?:&|$)/i.test(c.url);
 if(playbackMode==='hls'||(playbackMode==='auto'&&isHls))startHls(c,request);else{video.src=c.url;video.play().catch(()=>{});}
}
async function saveEpgUrl(value){const url=value.trim();if(url&&!safe(url)){epgMessage='Inserisci un URL HTTP o HTTPS valido.';return;}const previous=lists;lists=lists.map(p=>p.id===active?{...p,epg:url}:p);try{await set('tucatv',{lists,favorites:$state.snapshot(favorites)});}catch{lists=previous;epgMessage='Impossibile salvare le impostazioni.';}}
function configure(key,value){if(!changeSetting(key,value))message='Impossibile salvare le impostazioni.';}
function chooseLanguage(value){if(!setLocale(value))message='Impossibile salvare le impostazioni.';}
function nav(p){++playRequest;stop();categoryEditor=null;page=p;message='';}
function demo(){if(busy)return;let p={id:Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join(''),name:$t('Playlist di esempio'),channels:[{name:'Big Buck Bunny',kind:'vod',group:'Demo',tvg:'',url:'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'},{name:'Sintel',group:'Demo',tvg:'',url:'https://storage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4'}],updated:Date.now(),source:'',epg:''};lists=[...lists,p];active=p.id;save();page='channels';catalogMode='vod';programs=[];}
function changeChannel(step){const pool=filtered;const i=pool.findIndex(c=>c.url===selected?.url);if(pool.length)play(pool[(i+step+pool.length)%pool.length]);}
function back(){if(categoryEditor){categoryEditor=null;tick().then(ensureFocus);return;}if(intro){intro=false;return;}if(page==='epg'){nav('settings');return;}if(page==='player'){nav('channels');return;}if(tvMode&&!document.activeElement?.closest('aside')){focusControl(document.querySelector('aside button.chosen,aside button'));return;}if(page!=='channels'&&lists.length){nav('channels');return;}if(isAndroid)exitToHome();else if(page!=='playlists')nav('playlists');}
let lastDirection=0;
function keys(e){
 if(e.defaultPrevented)return;
 if(e.key==='Escape'||e.key==='BrowserBack'){e.preventDefault();back();return;}
 if(!['ArrowDown','ArrowUp','ArrowLeft','ArrowRight'].includes(e.key))return;
 const element=document.activeElement;
 if(element?.tagName==='SELECT'||element?.tagName==='VIDEO')return;
 if(element?.tagName==='INPUT'&&(!tvMode||['ArrowLeft','ArrowRight'].includes(e.key)))return;
 e.preventDefault();if(e.repeat&&performance.now()-lastDirection<90)return;lastDirection=performance.now();moveFocus(e.key,intro?document.querySelector('.startup'):document);
}

</script>
<svelte:window onkeydown={keys} onlanguagechange={refreshDeviceLocale} onfocus={refreshDeviceLocale}/>
{#if intro}<Intro ondone={()=>intro=false}/>{/if}
<div class="shell tv-mode tv-first" class:android-shell={isAndroid} inert={intro}>
<aside><a class="brand" href="#home" onclick={()=>nav('playlists')}><img class="brand-mark" src="/tucatv-mark.svg" alt={$t("Becco di tucano")}/> TucaTV<span class="beta">BETA</span></a><div class="navlabel">{$t("IL TUO SPAZIO TV")}</div><button aria-label={$t("Catalogo")} class:chosen={page==='channels'} onclick={()=>nav('channels')}>▦ <span>{$t("Catalogo")}</span></button><button aria-label={$t("Le mie playlist")} class:chosen={page==='playlists'} onclick={()=>nav('playlists')}>▤ <span>{$t("Le mie playlist")}</span></button><button aria-label={$t("Preferiti")} onclick={()=>{nav('channels');group='__favorites'}}>♡ <span>{$t("Preferiti")}</span><small>{favorites.length}</small></button><button aria-label={$t("Impostazioni")} class:chosen={page==='settings'||page==='epg'} onclick={()=>nav('settings')}>⚙ <span>{$t("Impostazioni")}</span></button>{#if currentPlayback}<div class="current-playback"><button class="resume-player" onclick={returnToPlayer} aria-label={$t("Torna al player: ")+currentPlayback.title}>▶ <span>{$t("Torna al player")}<small>{currentPlayback.title}</small></span></button><button class="stop-current" onclick={stopCurrent} aria-label={$t("Interrompi riproduzione")}>■ <span>{$t("Interrompi")}</span></button></div>{/if}<div class="asidebottom"><span class="dot"></span> {$t("Tutto sul tuo dispositivo")}<p>{$t("Nessun account. Solo la tua TV.")}</p><small>{$t("TucaTV / VERSIONE 0.12.0")}</small></div></aside>
<main><header><span>{page==='epg'?$t('Guide TV (EPG)'):page==='settings'?$t('Impostazioni'):page==='playlists'?$t("LIBRERIA"):page==='player'?$t("IN RIPRODUZIONE"):$t("IL TUO CATALOGO")}</span><div><span class="dot"></span> {isDesktop?'Desktop · VLC':isAndroid?'Android · VLC':'Browser'} <span class="clock">{time(clock)}</span></div></header>
{#if loading}<section class="import-progress" class:complete={loading.phase==='done'} class:background-refresh={startupRefreshing} aria-label={$t("Avanzamento caricamento playlist")} aria-busy={busy}><div class="import-progress-top"><strong role="status">{$t(loading.title)}</strong>{#if loading.percent!==null}<b>{loading.percent}%</b>{/if}{#if !busy}<button aria-label={$t("Chiudi avanzamento")} onclick={()=>loading=null}>×</button>{/if}</div>{#if loading.phase!=='error'}<progress class:indeterminate={loading.percent===null} max="100" value={loading.percent??undefined} aria-label={$t(loading.title)}></progress>{/if}<p>{refreshLabel?refreshLabel+' · ':''}{$t(loading.detail)}</p><small>{loading.phase==='download'?$t("1 / 3 · Trasferimento"):loading.phase==='parse'?$t("2 / 3 · Lettura"):loading.phase==='save'?$t("3 / 3 · Salvataggio"):loading.phase==='done'?$t("Completato"):''}</small></section>{/if}
{#if failedSource&&!isNative}<div class="notice"><p>{$t("Puoi scaricare la playlist separatamente e importare il file. Questo risolve l’importazione, ma non cambia la compatibilità degli stream nel browser.")}</p><a href={safe(failedSource)} target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">{$t("Apri link playlist ↗")}</a></div>{/if}
{#if message}<div class="notice" role="status">{$t(message)}<button onclick={()=>message=''} aria-label={$t("Chiudi messaggio")}>×</button></div>{/if}
{#if !storageReady}<div class="empty">{$t("Caricamento della raccolta…")}</div>{:else if page==='epg'}
<EpgSettings {lists} {active} onactive={value=>active=value} onurl={saveEpgUrl} onfile={loadEpg} {epgMessage} onback={()=>nav('settings')}/>
{:else if page==='settings'}
<div class="heading"><div><h1>{$t('Impostazioni')}<span>.</span></h1><p>{$t('Preferenze salvate su questo dispositivo.')}</p></div></div>
<section class="panel settings-panel" aria-label={$t('Impostazioni')}>
<button class="primary" onclick={()=>nav('epg')}>{$t('Gestione EPG')} →</button>
<label>{$t('Lingua')}<select value={$languagePreference} onchange={e=>chooseLanguage(e.currentTarget.value)}><option value="device">{$t('Lingua del dispositivo')}</option><option value="it">Italiano</option><option value="en">English</option></select></label>
<p>{$t('La lingua cambia subito. Le opzioni iniziali si applicano al prossimo avvio.')}</p>
<label>{$t('Aggiorna playlist all’avvio')}<select value={String($settings.refreshOnStartup)} onchange={e=>configure('refreshOnStartup',e.currentTarget.value==='true')}><option value="true">{$t('Attivo')}</option><option value="false">{$t('Disattivato')}</option></select></label>
<label>{$t('Vista iniziale')}<select value={$settings.initialView} onchange={e=>configure('initialView',e.currentTarget.value)}><option value="catalog">{$t('Vista catalogo')}</option><option value="list">{$t('Vista griglia')}</option></select></label>
<label>{$t('Sezione iniziale')}<select value={$settings.initialSection} onchange={e=>configure('initialSection',e.currentTarget.value)}><option value="live">Live TV</option><option value="vod">{$t('▶ Film e serie')}</option></select></label>
</section>
{:else if page==='playlists'}
{#if categoryEditor}{#each lists.filter(p=>p.id===categoryEditor) as p (p.id)}<CategoryManager playlist={p} onsave={saveCategories} onclose={()=>{categoryEditor=null;tick().then(ensureFocus);}}/>{/each}{:else}
<div class="heading"><div><p class="eyebrow">{$t("LA TV, A MODO TUO")}</p><h1>{$t("Le mie playlist")}<span>.</span></h1><p>{$t("Un posto per tutti i tuoi canali. Il resto rimane fuori.")}</p></div><span class="counter">{lists.length} playlist</span></div>
<div class="importgrid"><section class="panel"><div class="sectiontitle"><span class="iconbox">＋</span><div><h2>{$t("Aggiungi una playlist")}</h2><p>{$t("Collega una sorgente e inizia a guardare.")}</p></div></div><label>{$t("Nome della playlist")}<input bind:value={name} placeholder={$t("Es. TV di casa")}/></label><label>{$t("Link M3U")}<input bind:value={url} type="url" placeholder="https://esempio.it/playlist.m3u"/></label><button class="primary full" disabled={busy||!url} onclick={()=>add() }>{busy?$t("Caricamento…"):$t("Aggiungi playlist")} <span>↗</span></button><div class="divider">{$t("oppure")}</div><label class="upload">↥ <b>{$t("Carica un file M3U")}</b><span>{$t("Scegli un file dal dispositivo")}</span><input type="file" accept=".m3u,.m3u8" disabled={busy} onchange={e=>{if(e.target.files[0])add(e.target.files[0]);e.target.value=''}}/></label></section><section class="intro"><div class="orbit"><img src="/tucatv-mark.svg" alt=""/></div><p class="eyebrow">{$t("MENO DISTRAZIONI. PIÙ TV.")}</p><h2>{$t("Premi play.")}<br/>{$t("Sentiti a casa.")}</h2><p>{$t("Le tue playlist, i tuoi preferiti e una guida essenziale. Tutto in un’interfaccia che lascia spazio a ciò che guardi.")}</p><button class="textbutton" disabled={busy} onclick={demo}>{$t("Esplora con una playlist demo ↗")}</button><small>{$t("Due video di esempio · nessun canale incluso")}</small></section></div>
<div class="sectionrow"><h2>{$t("La tua raccolta")}</h2><span>{$t("Salvata sul dispositivo")}</span></div>{#if !lists.length}<div class="empty compact">{$t("Aggiungi la prima playlist.")}<button onclick={demo} disabled={busy}>{$t("Esplora la demo")}</button></div>{/if}<div class="collection">{#each lists.slice(0,collectionLimit) as p}<article class="playlistcard"><span class="iconbox">▤</span><h3>{p.name}</h3><p>{p.channels.length} {$t("canali ·")} {p.source?$t("Sorgente online"):$t("File locale")}</p><small>{$t("Aggiornata")} {new Date(p.updated).toLocaleDateString($locale)}</small><div class="actions"><button class="primary" onclick={()=>{active=p.id;group='__all';page='channels'}}>{$t("Apri →")}</button>{#if p.source}<button disabled={busy} onclick={()=>refresh(p)}>{$t("Aggiorna")}</button>{/if}<button disabled={busy} onclick={()=>editCategories(p)}>{$t("Categorie")}{p.hiddenGroups?.length?' · '+p.hiddenGroups.length+$t(" nascoste"):''}</button><button disabled={busy} onclick={()=>remove(p.id)} aria-label={$t("Elimina ")+p.name}>{$t("Elimina")}</button></div></article>{/each}</div>{#if collectionLimit<lists.length}{#key collectionLimit}<LoadMore remaining={lists.length-collectionLimit} onmore={async focus=>{const first=collectionLimit;collectionLimit+=12;await tick();if(focus)focusControl(document.querySelectorAll('.playlistcard')[first]?.querySelector('button'));}} label={$t("Carica altre playlist")}/>{/key}{/if}
{/if}
{:else if page==='channels'}
<div class="heading"><div><p class="eyebrow">{$t("SCEGLI COSA GUARDARE")}</p><h1>{catalogMode==='live'?'Live TV':'On demand'}<span>.</span></h1><p>{catalogMode==='live'?$t("Il mondo, in diretta."):$t("Scegli una storia. Premi play.")}</p></div><select bind:value={active} onchange={()=>{group='__all'}} aria-label="Playlist">{#each lists as p}<option value={p.id}>{p.name}</option>{/each}</select></div>
{#if playlist?.channels.length}<div class="catalog-tabs"><button class:active={catalogMode==='live'} aria-pressed={catalogMode==='live'} onclick={()=>{catalogMode='live';group='__all'}}>● Live TV</button><button class:active={catalogMode==='vod'} aria-pressed={catalogMode==='vod'} onclick={()=>{catalogMode='vod';group='__all'}}>{$t("▶ Film e serie")}</button><div class="top-spacer"></div><button class:active={view==='catalog'} onclick={()=>view='catalog'} aria-label={$t("Vista catalogo")}>▦</button><button class:active={view==='list'} onclick={()=>view='list'} aria-label={$t("Vista griglia")}>☷</button></div>{#if epgMessage}<div class="notice" role="status">{$t(epgMessage)}</div>{/if}<div class="toolbar"><input class="search" bind:value={query} placeholder={$t("Cerca nel catalogo…")} aria-label={$t("Cerca nel catalogo")}/></div><div class="catalog-filters"><label>{$t("Categoria")}<select bind:value={group}>{#each groups as g}<option value={g}>{g==='__all'?$t('Tutti'):g==='__favorites'?$t('Preferiti'):g}</option>{/each}</select></label><span>{filtered.length.toLocaleString($locale)} {$t("titoli")}</span></div>{#if view==='catalog'&&group==='__all'&&!query}<Catalog items={filtered} lastChannel={lastChannel} mode={catalogMode} {play} {favorite} {favorites} {now} oncategory={g=>{group=g;view='list'}}/>{:else}<TVCatalog items={filtered} {play} {favorite} {favorites} {now}/>{/if}{:else}<div class="empty"><h2>{$t("Il tuo schermo ti aspetta.")}</h2><p>{$t("Aggiungi una playlist per trovare qui tutti i tuoi canali.")}</p><button class="primary" onclick={()=>nav('playlists')}>{$t("Aggiungi playlist ↗")}</button></div>{/if}
{:else}
<div class="watch-heading"><button class="textbutton" onclick={()=>nav('channels')}>{$t("← La tua TV")}</button><span>TUCA PLAYER</span></div>
<Player error={playbackError} onexternal={exportSelected} {video} channel={selected} programme={now(selected)} favorite={favorites.includes(selected.url)} mode={playbackMode} onback={()=>nav('channels')} onprevious={()=>changeChannel(-1)} onnext={()=>changeChannel(1)} onretry={()=>play(selected)} onfavorite={()=>favorite(selected)} onmode={m=>{playbackMode=m;play(selected)}}>
<video bind:this={video} autoplay playsinline onloadeddata={()=>clearTimeout(playbackTimer)} onplaying={()=>rememberOpened(selected)} onerror={mediaError}><track kind="captions"/></video>
</Player><div class="watch-info"><div><p class="eyebrow">{kind(selected)==='vod'?'ON DEMAND':$t("A SEGUIRE")}</p><h2>{kind(selected)==='vod'?selected.name:next(selected)?.title||$t("Il prossimo programma, quando disponibile.")}</h2><p>{kind(selected)==='vod'?'On demand · '+selected.group:next(selected)?time(next(selected).start):$t("Collega una guida XMLTV alla tua playlist.")}</p></div><div class="keyboard-hint">{$t("Spazio · Play / pausa")}<br/>{$t("F · Schermo intero")}</div></div>

{/if}<footer>TucaTV <span>{$t("La tua TV. Il tuo ritmo.")}</span><span>{$t("Playlist e preferiti restano su questo dispositivo.")}</span></footer></main></div>
