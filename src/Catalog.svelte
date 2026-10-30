<script>
 import {kind,shelves} from './catalog.js';
 let {items,mode,play,favorite,favorites,now,oncategory}= $props();
 let rows=$derived(shelves(items)),hero=$derived(items[0]);
</script>
{#if hero}
<section class="catalog-hero">
 <div class="hero-art" aria-hidden="true">{#if hero.logo}<img src={hero.logo} alt="" onerror={e=>e.target.style.display='none'}/>{:else}<img src="/tucatv-mark.svg" alt=""/>{/if}</div>
 <div class="hero-content"><p class="eyebrow">{mode==='vod'?'IL TUO CINEMA':'DA GUARDARE ORA'} · TUCA TV</p><h1>{hero.name}</h1><p>{now(hero)?.title||hero.group}</p><div class="actions"><button class="primary" onclick={()=>play(hero)}>▶ Guarda ora</button><button onclick={()=>favorite(hero)} aria-pressed={favorites.includes(hero.url)}>{favorites.includes(hero.url)?'♥ Nei preferiti':'＋ La mia lista'}</button></div><small>{kind(hero)==='live'?'LIVE · Canale della tua playlist':'ON DEMAND · Dalla tua playlist'}</small></div>
</section>
{#each rows as row}
<section class="shelf"><div class="sectionrow"><h2>{row.name}</h2><button class="textbutton" onclick={()=>oncategory(row.name)}>Vedi tutti →</button></div><div class="shelf-track">
{#each row.items as c}
<article class="media-card" class:poster={kind(c)==='vod'}><button class="media-open" onclick={()=>play(c)} aria-label={'Riproduci '+c.name}><div class="media-art"><span class="media-type">{kind(c)==='live'?'LIVE':'VOD'}</span>{#if c.logo}<img src={c.logo} alt="" loading="lazy" onerror={e=>e.target.style.display='none'}/>{:else}<span class="media-monogram">{c.name.replace(/[^\p{L}\p{N}]/gu,'').slice(0,2)}</span>{/if}<span class="media-play">▶</span></div><h3>{c.name}</h3><p>{kind(c)==='live'?now(c)?.title||'Guida non disponibile':c.group}</p></button><button class="card-favorite" aria-label={'Preferito: '+c.name} aria-pressed={favorites.includes(c.url)} onclick={()=>favorite(c)}>{favorites.includes(c.url)?'♥':'＋'}</button></article>
{/each}
</div></section>
{/each}
{#if new Set(items.map(c=>c.group)).size>12}<p class="catalog-note">Prime 12 categorie. Usa il filtro categoria o la ricerca per esplorare tutto il catalogo.</p>{/if}
{:else}<div class="empty"><h2>Nessun titolo trovato.</h2><p>Prova un'altra categoria o modifica la ricerca.</p></div>{/if}
