<script>
 import {t,locale} from './i18n.js';
 import Logo from './Logo.svelte';
 import LoadMore from './LoadMore.svelte';
 import Shelf from './Shelf.svelte';
 import {tick} from 'svelte';
 import {focusControl} from './tv-navigation.js';
 import {kind,shelves} from './catalog.js';
 let {items,lastChannel,mode,play,favorite,favorites,now,oncategory}= $props();
 let limit=$state(6),host=$state();
 let allRows=$derived(shelves(items,Infinity,Infinity)),rows=$derived(allRows.slice(0,limit)),hero=$derived(lastChannel||items[0]);
 $effect(()=>{items;limit=6;});
 async function more(focus=false){const first=rows.length;limit+=6;await tick();if(focus)focusControl(host?.querySelectorAll('.shelf')[first]?.querySelector('button'));}
</script>
{#if hero}
<section class="catalog-hero">
 <div class="hero-art" aria-hidden="true"><Logo src={hero.logo} name={hero.name} hero/></div>
 <div class="hero-content"><p class="eyebrow">{lastChannel?$t("ULTIMO CANALE APERTO"):mode==='vod'?$t("IL TUO CINEMA"):$t("DA GUARDARE ORA")} · TUCA TV</p><h1>{hero.name}</h1><p>{now(hero)?.title||hero.group}</p><div class="actions"><button class="primary" onclick={()=>play(hero)}>▶ {lastChannel?$t("Riapri canale"):$t("Guarda ora")}</button><button onclick={()=>favorite(hero)} aria-pressed={favorites.includes(hero.url)}>{favorites.includes(hero.url)?$t("♥ Nei preferiti"):$t("＋ La mia lista")}</button></div><small>{kind(hero)==='live'?$t("LIVE · Canale della tua playlist"):$t("ON DEMAND · Dalla tua playlist")}</small></div>
</section>
<div bind:this={host}>
{#each rows as row (row.name)}<Shelf {row} {play} {favorite} {favorites} {now} {oncategory}/>{/each}
{#if rows.length<allRows.length}{#key rows.length}<LoadMore remaining={allRows.length-rows.length} onmore={more} label={$t("Carica altre categorie")}/>{/key}{/if}
</div>
{:else}<div class="empty"><h2>{$t("Nessun titolo trovato.")}</h2><p>{$t("Prova un'altra categoria o modifica la ricerca.")}</p></div>{/if}
