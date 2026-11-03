<script>
 import {t,locale} from './i18n.js';
 import {sources,epgPreferences,epgState,configureEpg,refreshEpg,cancelEpg,clearEpg} from './epg/service.js';
 import LoadMore from './LoadMore.svelte';
 import {tick} from 'svelte';
 import {focusControl} from './tv-navigation.js';
 let {lists,active,onactive,onurl,onfile,epgMessage,onback}=$props();
 let query=$state(''),limit=$state(24),error=$state(''),customUrl=$state(''),customBusy=$state(false),host;
 let playlist=$derived(lists.find(p=>p.id===active));
 $effect(()=>{customUrl=playlist?.epg||'';});
 $effect(()=>{query;limit=24;});
 let filtered=$derived(sources.filter(s=>(s.name+' '+s.group).toLowerCase().includes(query.trim().toLowerCase())));
 function configure(values){if(!configureEpg(values))error='Impossibile salvare le impostazioni.';}
 function toggle(id){const disabled=$epgPreferences.disabled;configure({disabled:disabled.includes(id)?disabled.filter(v=>v!==id):[...disabled,id]});}
 async function more(focus){const first=limit;limit+=24;await tick();if(focus)focusControl(host.querySelectorAll('.epg-source input')[first]);}
 async function clear(){try{await clearEpg();}catch{error='EPG_STORAGE';}}
 async function saveUrl(){customBusy=true;try{await onurl(customUrl);}finally{customBusy=false;}}
 async function file(event){const file=event.currentTarget.files[0];event.currentTarget.value='';if(!file)return;customBusy=true;try{await onfile(file);}finally{customBusy=false;}}
</script>
<div class="heading"><div><button class="textbutton" onclick={onback}>{$t('← Impostazioni')}</button><h1>{$t('Guide TV (EPG)')}<span>.</span></h1><p>{$t('Tutte le sorgenti Rytec sono abilitate inizialmente. Gli aggiornamenti avvengono sul dispositivo.')}</p></div></div>
<section class="panel epg-settings" aria-label={$t('Gestione EPG')} bind:this={host}>
 <label>{$t('Aggiornamento automatico EPG')}<select value={String($epgPreferences.automatic)} onchange={e=>configure({automatic:e.currentTarget.value==='true'})}><option value="true">{$t('Attivo')}</option><option value="false">{$t('Disattivato')}</option></select></label>
 <p>{$t('Le guide vengono aggiornate ogni 24 ore mentre l’app è aperta. Una copia salvata rimane disponibile se una sorgente non risponde.')}</p>
 <div class="actions"><button class="primary" disabled={$epgState.running} onclick={()=>refreshEpg()}>{$t('Aggiorna EPG ora')}</button><button disabled={!$epgState.running} onclick={cancelEpg}>{$t('Interrompi aggiornamento')}</button><button disabled={$epgState.running} onclick={clear}>{$t('Svuota cache Rytec')}</button></div>
 {#if $epgState.phase}<div class="notice" role="status"><p>{$t($epgState.phase)} {$epgState.source}</p>{#if $epgState.total}<p>{$t('Sorgenti elaborate: {count} / {total}',{count:$epgState.completed,total:$epgState.total})}</p>{/if}{#if $epgState.running}<progress max={$epgState.total||1} value={$epgState.completed}></progress><small>{$t('Programmi salvati nella sorgente: {count}',{count:$epgState.count})}</small>{/if}</div>{/if}
 {#if error}<p role="alert">{$t(error)}</p>{/if}
 <div class="actions"><button disabled={$epgState.running} onclick={()=>configure({disabled:[]})}>{$t('Abilita tutte')}</button><button disabled={$epgState.running} onclick={()=>configure({disabled:sources.map(s=>s.id)})}>{$t('Disabilita tutte')}</button></div>
 <label>{$t('Cerca sorgenti EPG')}<input type="search" bind:value={query}/></label>
 <p>{$t('Sorgenti abilitate: {count} / {total}',{count:sources.length-$epgPreferences.disabled.length,total:sources.length})}</p>
 <div class="epg-sources">{#each filtered.slice(0,limit) as source (source.id)}
  {@const saved=$epgState.records[source.id]}
  <article class="epg-source"><label><input type="checkbox" checked={!$epgPreferences.disabled.includes(source.id)} disabled={$epgState.running} onchange={()=>toggle(source.id)}/><span>{source.name}</span></label><small>{saved?$t('Aggiornata')+' '+new Date(saved.updated).toLocaleString($locale)+' · '+$t('{count} programmi',{count:saved.count}):$t('Non ancora scaricata')}</small>{#if $epgState.errors[source.id]}<p class="epg-error">{$t($epgState.errors[source.id])}</p>{/if}</article>
 {/each}</div>
 {#if filtered.length>limit}{#key limit}<LoadMore remaining={filtered.length-limit} onmore={more} label={$t('Carica altre sorgenti')}/>{/key}{/if}
</section>
<section class="panel epg-settings custom-epg" aria-label={$t('EPG della playlist')}>
 <h2>{$t('EPG della playlist')}</h2><p>{$t('Una guida personalizzata ha precedenza su Rytec per i canali della playlist selezionata.')}</p>
 {#if lists.length}
 <label>{$t('Playlist')}<select value={active} disabled={customBusy} onchange={e=>onactive(e.currentTarget.value)}>{#each lists as p}<option value={p.id}>{p.name}</option>{/each}</select></label>
 <label>{$t('URL della guida XMLTV')}<input type="url" bind:value={customUrl} disabled={customBusy}/></label>
 <button disabled={customBusy} onclick={saveUrl}>{$t('Salva sorgente EPG')}</button>
 <label class="epg-upload">{$t('Importa file XMLTV')}<input type="file" accept=".xml" disabled={customBusy} onchange={file}/></label>
 {#if epgMessage}<p role="status">{$t(epgMessage)}</p>{/if}
 {:else}<p>{$t('Aggiungi una playlist per configurare una guida personalizzata.')}</p>{/if}
</section>
