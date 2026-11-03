<script>
 import {categoryCounts} from './playlist-preferences.js';
 import {tick,untrack} from 'svelte';
 let {playlist,onsave,onclose}=$props();
 let hidden=$state(untrack(()=>[...(playlist.hiddenGroups||[])])),query=$state(''),page=$state(0),saving=$state(false),error=$state('');
 let categories=$derived(categoryCounts(playlist.channels));
 let matches=$derived(categories.filter(c=>c.name.toLocaleLowerCase('it').includes(query.trim().toLocaleLowerCase('it'))));
 let shown=$derived(matches.slice(page*24,page*24+24));
 $effect(()=>{query;page=0;});
 function toggle(name){hidden=hidden.includes(name)?hidden.filter(x=>x!==name):[...hidden,name];}
 async function save(){saving=true;error='';try{await onsave(hidden);onclose();}catch{error='Impossibile salvare le categorie. Riprova.';}finally{saving=false;}}
 async function change(step){page+=step;await tick();document.querySelector('.category-check')?.focus();}
</script>
<div class="category-manager">
 <div class="sectionrow"><div><h2>Categorie · {playlist.name}</h2><p>Le categorie nascoste non compaiono nel catalogo, nella ricerca o nei preferiti. Puoi riattivarle qui.</p></div><button onclick={onclose} disabled={saving}>← Playlist</button></div>
 <input class="search" bind:value={query} placeholder="Cerca una categoria…" aria-label="Cerca una categoria"/>
 <div class="category-tools"><span>{hidden.length} categorie nascoste</span><button onclick={()=>hidden=[]} disabled={saving}>Mostra tutte</button><button onclick={()=>hidden=categories.map(c=>c.name)} disabled={saving}>Nascondi tutte</button></div>
 <div class="category-grid">{#each shown as c}<button class="category-check" disabled={saving} aria-pressed={!hidden.includes(c.name)} onclick={()=>toggle(c.name)}><span>{hidden.includes(c.name)?'○':'✓'}</span><strong>{c.name}</strong><small>{c.count.toLocaleString('it')} titoli · {hidden.includes(c.name)?'Nascosta':'Visibile'}</small></button>{/each}</div>
 {#if !shown.length}<p>Nessuna categoria trovata.</p>{/if}
 <div class="category-tools"><button disabled={page===0||saving} onclick={()=>change(-1)}>← Precedenti</button><span>{page+1} / {Math.max(1,Math.ceil(matches.length/24))}</span><button disabled={(page+1)*24>=matches.length||saving} onclick={()=>change(1)}>Successive →</button></div>
 {#if error}<p role="alert">{error}</p>{/if}<div class="category-save"><button onclick={onclose} disabled={saving}>Annulla</button><button class="primary" onclick={save} disabled={saving}>{saving?'Salvataggio…':'Salva categorie'}</button></div>
</div>
