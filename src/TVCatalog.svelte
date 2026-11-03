<script>
    import { t, locale } from './i18n.js';
    import Logo from './Logo.svelte';
    import { tick } from 'svelte';
    let { items, play, favorite, favorites, now } = $props();
    import LoadMore from './LoadMore.svelte';
    import { focusControl } from './tv-navigation.js';
    let limit = $state(24),
        host;
    let shown = $derived(items.slice(0, limit));
    $effect(() => {
        items;
        limit = 24;
    });
    async function more(focus = false) {
        const first = shown.length;
        limit += 24;
        await tick();
        if (focus) focusControl(host?.querySelectorAll('.tv-tile')[first]);
    }
</script>

<section class="tv-catalog" bind:this={host} aria-label={$t('Remote control catalogue')}>
    <p class="catalog-count" role="status">
        {shown.length}
        {$t('of')}
        {items.length.toLocaleString($locale)}
        {$t('items')}
    </p>
    <div class="tv-grid">
        {#each shown as c, i}
            <article class="tv-card">
                <button class="tv-tile" data-tv-tile={i} onclick={() => play(c)} aria-label={$t('Play ') + c.name}>
                    <span class="tv-logo"><Logo src={c.logo} name={c.name} /></span><span class="tv-title"
                        ><strong>{c.name}</strong><small>{now(c)?.title || c.group}</small></span
                    >
                </button><button
                    class="tv-favorite"
                    aria-label={(favorites.includes(c.url) ? $t('Remove from favorites: ') : $t('Add to favorites: ')) +
                        c.name}
                    aria-pressed={favorites.includes(c.url)}
                    onclick={() => favorite(c)}>{favorites.includes(c.url) ? '♥' : '♡'}</button
                >
            </article>
        {/each}
    </div>
    {#if shown.length < items.length}{#key shown.length}<LoadMore
                remaining={items.length - shown.length}
                onmore={more}
            />{/key}{/if}
    {#if !items.length}<p class="empty">{$t('No items found. Change the category or search.')}</p>{/if}
    <p class="tv-help">{$t('Arrows: move selection · OK: open · Back: return to menu')}</p>
</section>
