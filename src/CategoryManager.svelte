<script>
 import {t,locale} from './i18n.js';
 import {categoryCounts} from './playlist-preferences.js';
 import LoadMore from './LoadMore.svelte';
 import {focusControl} from './tv-navigation.js';
 import {tick,untrack} from 'svelte';
 let {playlist,onsave,onclose}=$props();
 let hidden=$state(untrack(()=>[...(playlist.hiddenGroups||[])])),query=$state(''),limit=$state(24),saving=$state(false),error=$state('');
 let categories=$derived(categoryCounts(playlist.channels,$locale));
 let matches=$derived(categories.filter(c=>c.name.toLocaleLowerCase('it').includes(query.trim().toLocaleLowerCase('it'))));
 let shown=$derived(matches.slice(0,limit));
 $effect(()=>{query;limit=24;});
 function toggle(name){hidden=hidden.includes(name)?hidden.filter(x=>x!==name):[...hidden,name];}
 async function save(){saving=true;error='';try{await onsave(hidden);onclose();}catch{error='Impossibile salvare le categorie. Riprova.';}finally{saving=false;}}
 async function more(focus=false){const first=shown.length;limit+=24;await tick();if(focus)focusControl(document.querySelectorAll('.category-check')[first]);}
</script>
<div class="category-manager">
 <div class="sectionrow"><div><h2>{$t("Categorie ·")} {playlist.name}</h2><p>{$t("Le categorie nascoste non compaiono nel catalogo, nella ricerca o nei preferiti. Puoi riattivarle qui.")}</p></div><button onclick={onclose} disabled={saving}>{$t("← Playlist")}</button></div>
 <input class="search" bind:value={query} placeholder={$t("Cerca una categoria…")} aria-label={$t("Cerca una categoria")}/>
 <div class="category-tools"><span>{hidden.length} {$t("categorie nascoste")}</span><button onclick={()=>hidden=[]} disabled={saving}>{$t("Mostra tutte")}</button><button onclick={()=>hidden=categories.map(c=>c.name)} disabled={saving}>{$t("Nascondi tutte")}</button></div>
 <div class="category-grid">{#each shown as c}<button class="category-check" disabled={saving} aria-pressed={!hidden.includes(c.name)} onclick={()=>toggle(c.name)}><span>{hidden.includes(c.name)?'○':'✓'}</span><strong>{c.name}</strong><small>{c.count.toLocaleString($locale)} {$t("titoli ·")} {hidden.includes(c.name)?$t("Nascosta"):$t("Visibile")}</small></button>{/each}</div>
 {#if !shown.length}<p>{$t("Nessuna categoria trovata.")}</p>{/if}
 {#if shown.length<matches.length&&!saving}{#key shown.length}<LoadMore remaining={matches.length-shown.length} onmore={more} label={$t("Carica altre categorie")}/>{/key}{/if}
 {#if error}<p role="alert">{$t(error)}</p>{/if}<div class="category-save"><button onclick={onclose} disabled={saving}>{$t("Annulla")}</button><button class="primary" onclick={save} disabled={saving}>{saving?$t("Salvataggio…"):$t("Salva categorie")}</button></div>
</div>
