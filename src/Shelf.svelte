<script>
    import { t, locale } from './i18n.js';
    import Logo from './Logo.svelte';
    import LoadMore from './LoadMore.svelte';
    import { kind } from './catalog.js';
    import { tick } from 'svelte';
    import { focusControl } from './tv-navigation.js';
    let { row, play, favorite, favorites, now, oncategory } = $props();
    let limit = $state(8),
        host;
    let shown = $derived(row.items.slice(0, limit));
    $effect(() => {
        row;
        limit = 8;
    });
    async function more(focus = false) {
        const first = shown.length;
        limit += 8;
        await tick();
        if (focus) focusControl(host?.querySelectorAll('.media-open')[first]);
    }
</script>

<section class="shelf">
    <div class="sectionrow">
        <h2>{row.name}</h2>
        <button class="textbutton" onclick={() => oncategory(row.category || row.name)}>{$t('View all →')}</button>
    </div>
    <div class="shelf-track" bind:this={host}>
        {#each shown as c}
            <article class="media-card" class:poster={kind(c) === 'vod'}>
                <button class="media-open" onclick={() => play(c)} aria-label={$t('Play ') + c.name}
                    ><div class="media-art">
                        <Logo src={c.logo} name={c.name} /><span class="media-type"
                            >{kind(c) === 'live' ? 'LIVE' : 'VOD'}</span
                        >
                    </div>
                    <h3>{c.name}</h3>
                    <p>{kind(c) === 'live' ? now(c)?.title || $t('Guide unavailable') : c.group}</p></button
                ><button
                    class="card-favorite"
                    aria-label={$t('Favorite: ') + c.name}
                    aria-pressed={favorites.includes(c.url)}
                    onclick={() => favorite(c)}>{favorites.includes(c.url) ? '♥' : '＋'}</button
                >
            </article>
        {/each}
        {#if shown.length < row.items.length}{#key shown.length}<LoadMore
                    remaining={row.items.length - shown.length}
                    onmore={more}
                />{/key}{/if}
    </div>
</section>
