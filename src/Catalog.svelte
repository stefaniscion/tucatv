<script>
    import { t, locale } from './i18n.js';
    import Logo from './Logo.svelte';
    import LoadMore from './LoadMore.svelte';
    import Shelf from './Shelf.svelte';
    import { tick } from 'svelte';
    import { focusControl } from './tv-navigation.js';
    import { kind, shelves } from './catalog.js';
    let { items, lastChannel, mode, play, favorite, favorites, now, oncategory } = $props();
    let limit = $state(6),
        host = $state();
    let allRows = $derived(shelves(items, Infinity, Infinity)),
        rows = $derived(allRows.slice(0, limit)),
        hero = $derived(lastChannel || items[0]);
    let favoriteItems = $derived(items.filter((item) => favorites.includes(item.url))),
        favoriteRow = $derived({ name: $t('Favorites'), category: '__favorites', items: favoriteItems });
    $effect(() => {
        items;
        limit = 6;
    });
    async function more(focus = false) {
        const first = rows.length;
        limit += 6;
        await tick();
        if (focus) focusControl(host?.querySelectorAll('.shelf')[first]?.querySelector('button'));
    }
</script>

{#if hero}
    <section class="catalog-hero">
        <div class="hero-art" aria-hidden="true"><Logo src={hero.logo} name={hero.name} hero /></div>
        <div class="hero-content">
            <p class="eyebrow">
                {lastChannel ? $t('LAST CHANNEL PLAYED') : mode === 'vod' ? $t('YOUR CINEMA') : $t('WATCH NOW')} · TUCA TV
            </p>
            <h1>{hero.name}</h1>
            <p>{now(hero)?.title || hero.group}</p>
            <div class="actions">
                <button class="primary" onclick={() => play(hero)}
                    >▶ {lastChannel ? $t('Reopen channel') : $t('Watch now')}</button
                ><button onclick={() => favorite(hero)} aria-pressed={favorites.includes(hero.url)}
                    >{favorites.includes(hero.url) ? $t('♥ In favorites') : $t('＋ My list')}</button
                >
            </div>
            <small
                >{kind(hero) === 'live'
                    ? $t('LIVE · Channel from your playlist')
                    : $t('ON DEMAND · From your playlist')}</small
            >
        </div>
    </section>
    <div bind:this={host}>
        {#if favoriteItems.length}<Shelf row={favoriteRow} {play} {favorite} {favorites} {now} {oncategory} />{/if}
        {#each rows as row (row.name)}<Shelf {row} {play} {favorite} {favorites} {now} {oncategory} />{/each}
        {#if rows.length < allRows.length}{#key rows.length}<LoadMore
                    remaining={allRows.length - rows.length}
                    onmore={more}
                    label={$t('Load more categories')}
                />{/key}{/if}
    </div>
{:else}<div class="empty">
        <h2>{$t('No items found.')}</h2>
        <p>{$t('Try another category or change your search.')}</p>
    </div>{/if}
