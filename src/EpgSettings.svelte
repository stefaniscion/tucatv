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
 function configure(values){if(!configureEpg(values))error='Unable to save settings.';}
 function toggle(id){const disabled=$epgPreferences.disabled;configure({disabled:disabled.includes(id)?disabled.filter(v=>v!==id):[...disabled,id]});}
 async function more(focus){const first=limit;limit+=24;await tick();if(focus)focusControl(host.querySelectorAll('.epg-source input')[first]);}
 async function clear(){try{await clearEpg();}catch{error='Unable to save EPG data. Check available storage.';}}
 async function saveUrl(){customBusy=true;try{await onurl(customUrl);}finally{customBusy=false;}}
 async function file(event){const file=event.currentTarget.files[0];event.currentTarget.value='';if(!file)return;customBusy=true;try{await onfile(file);}finally{customBusy=false;}}
</script>
<div class="heading"><div><button class="textbutton" onclick={onback}>{$t('← Settings')}</button><h1>{$t('TV guides (EPG)')}<span>.</span></h1><p>{$t('All Rytec sources are enabled by default. Updates run on this device.')}</p></div></div>
<section class="panel epg-settings" aria-label={$t('Manage EPG')} bind:this={host}>
 <label>{$t('Automatic EPG updates')}<select value={String($epgPreferences.automatic)} onchange={e=>configure({automatic:e.currentTarget.value==='true'})}><option value="true">{$t('On')}</option><option value="false">{$t('Off')}</option></select></label>
 <p>{$t('Guides are refreshed every 24 hours while the app is open. A saved copy remains available if a source is unreachable.')}</p>
 <div class="actions"><button class="primary" disabled={$epgState.running} onclick={()=>refreshEpg()}>{$t('Update EPG now')}</button><button disabled={!$epgState.running} onclick={cancelEpg}>{$t('Stop update')}</button><button disabled={$epgState.running} onclick={clear}>{$t('Clear Rytec cache')}</button></div>
 {#if $epgState.phase}<div class="notice" role="status"><p>{$t($epgState.phase)} {$epgState.source}</p>{#if $epgState.total}<p>{$t('Sources processed: {count} / {total}',{count:$epgState.completed,total:$epgState.total})}</p>{/if}{#if $epgState.running}<progress max={$epgState.total||1} value={$epgState.completed}></progress><small>{$t('Programmes saved for this source: {count}',{count:$epgState.count})}</small>{/if}</div>{/if}
 {#if error}<p role="alert">{$t(error)}</p>{/if}
 <div class="actions"><button disabled={$epgState.running} onclick={()=>configure({disabled:[]})}>{$t('Enable all')}</button><button disabled={$epgState.running} onclick={()=>configure({disabled:sources.map(s=>s.id)})}>{$t('Disable all')}</button></div>
 <label>{$t('Search EPG sources')}<input type="search" bind:value={query}/></label>
 <p>{$t('Enabled sources: {count} / {total}',{count:sources.length-$epgPreferences.disabled.length,total:sources.length})}</p>
 <div class="epg-sources">{#each filtered.slice(0,limit) as source (source.id)}
  {@const saved=$epgState.records[source.id]}
  <article class="epg-source"><label><input type="checkbox" checked={!$epgPreferences.disabled.includes(source.id)} disabled={$epgState.running} onchange={()=>toggle(source.id)}/><span>{source.name}</span></label><small>{saved?$t('Updated')+' '+new Date(saved.updated).toLocaleString($locale)+' · '+$t('{count} programmes',{count:saved.count}):$t('Not downloaded yet')}</small>{#if $epgState.errors[source.id]}<p class="epg-error">{$t($epgState.errors[source.id])}</p>{/if}</article>
 {/each}</div>
 {#if filtered.length>limit}{#key limit}<LoadMore remaining={filtered.length-limit} onmore={more} label={$t('Load more sources')}/>{/key}{/if}
</section>
<section class="panel epg-settings custom-epg" aria-label={$t('Playlist EPG')}>
 <h2>{$t('Playlist EPG')}</h2><p>{$t('A custom guide takes priority over Rytec for channels in the selected playlist.')}</p>
 {#if lists.length}
 <label>{$t('Playlist')}<select value={active} disabled={customBusy} onchange={e=>onactive(e.currentTarget.value)}>{#each lists as p}<option value={p.id}>{p.name}</option>{/each}</select></label>
 <label>{$t('XMLTV guide URL')}<input type="url" bind:value={customUrl} disabled={customBusy}/></label>
 <button disabled={customBusy} onclick={saveUrl}>{$t('Save EPG source')}</button>
 <label class="epg-upload">{$t('Import XMLTV file')}<input type="file" accept=".xml" disabled={customBusy} onchange={file}/></label>
 {#if epgMessage}<p role="status">{$t(epgMessage)}</p>{/if}
 {:else}<p>{$t('Add a playlist to configure a custom guide.')}</p>{/if}
</section>
