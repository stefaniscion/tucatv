<script>
 import Logo from './Logo.svelte';
 import {tick} from 'svelte';
 import {pageWindow,focusControl} from './tv-navigation.js';
 let {items,play,favorite,favorites,now}= $props();
 let page=$state(0),host,selection=$state(0);
 let window=$derived(pageWindow(items.length,page)),shown=$derived(items.slice(window.start,window.end));
 let chosen=$derived(shown[Math.min(selection,Math.max(0,shown.length-1))]);
 $effect(()=>{items;page=0;selection=0;});
 async function change(step){const next=window.index+step;if(next<0||next>=window.pages)return;page=next;selection=0;await tick();focusControl(host?.querySelector('.tv-tile'));}
 function key(event){if(!host?.contains(document.activeElement))return;if(event.key==='PageDown'||event.key==='PageUp'){event.preventDefault();event.stopPropagation();change(event.key==='PageDown'?1:-1);}}
</script>
<svelte:window onkeydown={key}/><section class="tv-catalog" bind:this={host} aria-label="Catalogo per telecomando">
 <div class="tv-pagination"><button disabled={window.index===0} onclick={()=>change(-1)}>← Pagina precedente</button><span role="status">{items.length?window.start+1:0}–{window.end} di {items.length.toLocaleString('it')} · Pagina {window.index+1}/{window.pages}</span><button disabled={window.index+1===window.pages} onclick={()=>change(1)}>Pagina successiva →</button></div>
 <div class="tv-grid">
 {#each shown as c,i}
  <button class="tv-tile" data-tv-tile={i} onfocus={()=>selection=i} onclick={()=>play(c)} aria-label={'Riproduci '+c.name}>
   <span class="tv-logo"><Logo src={c.logo} name={c.name}/></span><span class="tv-title"><strong>{c.name}</strong><small>{now(c)?.title||c.group}</small></span>{#if favorites.includes(c.url)}<span aria-label="Preferito">♥</span>{/if}
  </button>
 {/each}
 </div>
 {#if chosen}<div class="tv-selection"><span>{chosen.name}</span><button onclick={()=>favorite(chosen)} aria-pressed={favorites.includes(chosen.url)}>{favorites.includes(chosen.url)?'♥ Rimuovi dai preferiti':'♡ Aggiungi ai preferiti'}</button></div>{/if}
 {#if !items.length}<p class="empty">Nessun titolo trovato. Cambia categoria o ricerca.</p>{/if}
 <p class="tv-help">Frecce: sposta la selezione · OK: apri · Indietro: torna al menu</p>
</section>
