<script>
    import { t, locale } from './i18n.js';
    import { categoryCounts } from './playlist-preferences.js';
    import LoadMore from './LoadMore.svelte';
    import { focusControl } from './tv-navigation.js';
    import { tick, untrack } from 'svelte';
    let { playlist, onsave, onclose } = $props();
    let hidden = $state(untrack(() => [...(playlist.hiddenGroups || [])])),
        query = $state(''),
        limit = $state(24),
        saving = $state(false),
        error = $state('');
    let categories = $derived(categoryCounts(playlist.channels, $locale));
    let matches = $derived(
        categories.filter((c) => c.name.toLocaleLowerCase('it').includes(query.trim().toLocaleLowerCase('it'))),
    );
    let shown = $derived(matches.slice(0, limit));
    $effect(() => {
        query;
        limit = 24;
    });
    function toggle(name) {
        hidden = hidden.includes(name) ? hidden.filter((x) => x !== name) : [...hidden, name];
    }
    async function save() {
        saving = true;
        error = '';
        try {
            await onsave(hidden);
            onclose();
        } catch {
            error = 'Unable to save categories. Please try again.';
        } finally {
            saving = false;
        }
    }
    async function more(focus = false) {
        const first = shown.length;
        limit += 24;
        await tick();
        if (focus) focusControl(document.querySelectorAll('.category-check')[first]);
    }
</script>

<div class="category-manager">
    <div class="sectionrow">
        <div>
            <h2>{$t('Categories ·')} {playlist.name}</h2>
            <p>
                {$t(
                    'Hidden categories do not appear in the catalogue, search or favorites. You can show them again here.',
                )}
            </p>
        </div>
        <button onclick={onclose} disabled={saving}>{$t('← Playlists')}</button>
    </div>
    <input
        class="search"
        bind:value={query}
        placeholder={$t('Search categories…')}
        aria-label={$t('Search categories')}
    />
    <div class="category-tools">
        <span>{hidden.length} {$t('hidden categories')}</span><button onclick={() => (hidden = [])} disabled={saving}
            >{$t('Show all')}</button
        ><button onclick={() => (hidden = categories.map((c) => c.name))} disabled={saving}>{$t('Hide all')}</button>
    </div>
    <div class="category-grid">
        {#each shown as c}<button
                class="category-check"
                disabled={saving}
                aria-pressed={!hidden.includes(c.name)}
                onclick={() => toggle(c.name)}
                ><span>{hidden.includes(c.name) ? '○' : '✓'}</span><strong>{c.name}</strong><small
                    >{c.count.toLocaleString($locale)}
                    {$t('items ·')}
                    {hidden.includes(c.name) ? $t('Hidden') : $t('Visible')}</small
                ></button
            >{/each}
    </div>
    {#if !shown.length}<p>{$t('No categories found.')}</p>{/if}
    {#if shown.length < matches.length && !saving}{#key shown.length}<LoadMore
                remaining={matches.length - shown.length}
                onmore={more}
                label={$t('Load more categories')}
            />{/key}{/if}
    {#if error}<p role="alert">{$t(error)}</p>{/if}
    <div class="category-save">
        <button onclick={onclose} disabled={saving}>{$t('Cancel')}</button><button
            class="primary"
            onclick={save}
            disabled={saving}>{saving ? $t('Saving…') : $t('Save categories')}</button
        >
    </div>
</div>
