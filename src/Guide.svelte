<script>
    import { onMount, tick } from 'svelte';
    import { t, locale } from './i18n.js';
    import Logo from './Logo.svelte';
    import LoadMore from './LoadMore.svelte';
    import { focusControl } from './tv-navigation.js';
    import { epgState, enabledSources, lookupSchedule } from './epg/service.js';
    import { GUIDE_SLOT, GUIDE_WINDOW, guideWindowStart, programmePosition, schedulesByChannel } from './guide.js';

    const DAY = 24 * 60 * 60 * 1000;

    let { channels, customPrograms, playlists, active, onactive, play, clock } = $props();
    let anchor = $state(guideWindowStart(Date.now())),
        limit = $state(18),
        compact = $state(false),
        selectedChannel = $state(''),
        selected = $state(null),
        schedules = $state.raw(new Map()),
        loading = $state(false),
        failure = $state(''),
        host,
        request = 0;
    let visibleChannels = $derived(channels.slice(0, limit)),
        queryChannels = $derived(
            compact ? channels.filter((channel) => channel.tvg === selectedChannel).slice(0, 1) : visibleChannels,
        ),
        slots = $derived(
            Array.from({ length: GUIDE_WINDOW / GUIDE_SLOT + 1 }, (_, index) => anchor + index * GUIDE_SLOT),
        ),
        selectedSchedule = $derived(schedules.get(selectedChannel) || []),
        currentPosition = $derived(((clock - anchor) / GUIDE_WINDOW) * 100);

    $effect(() => {
        const ids = channels.map((channel) => channel.tvg);
        if (!ids.includes(selectedChannel)) selectedChannel = ids[0] || '';
        limit = 18;
        selected = null;
    });

    $effect(() => {
        const ids = queryChannels.map((channel) => channel.tvg).filter(Boolean),
            revision = $epgState.revision,
            from = anchor,
            to = from + GUIDE_WINDOW,
            local = customPrograms;
        revision;
        const current = ++request;
        failure = '';
        if (!ids.length) {
            schedules = new Map();
            loading = false;
            return;
        }
        loading = true;
        lookupSchedule(
            ids,
            enabledSources().map((source) => source.id),
            from,
            to,
        )
            .then((remote) => {
                if (current === request) schedules = schedulesByChannel(ids, local, remote, from, to);
            })
            .catch(() => {
                if (current === request) {
                    schedules = schedulesByChannel(ids, local, [], from, to);
                    failure = 'Unable to read the saved TV guide.';
                }
            })
            .finally(() => {
                if (current === request) loading = false;
            });
    });

    onMount(() => {
        const media = matchMedia('(max-width: 700px)'),
            update = () => (compact = media.matches);
        update();
        media.addEventListener('change', update);
        return () => media.removeEventListener('change', update);
    });

    function time(value) {
        return new Date(value).toLocaleTimeString($locale, { hour: '2-digit', minute: '2-digit' });
    }

    function day(value) {
        return new Date(value).toLocaleDateString($locale, { weekday: 'short', day: 'numeric', month: 'short' });
    }

    function style(programme) {
        const position = programmePosition(programme, anchor);
        return `left: ${position.left}%; width: ${Math.max(position.width, 3)}%`;
    }

    function choose(channel, programme) {
        selected = { channel, programme };
    }

    function shift(amount) {
        anchor += amount;
        selected = null;
    }

    async function more(focus = false) {
        const first = visibleChannels.length;
        limit += 18;
        await tick();
        if (focus) focusControl(host?.querySelectorAll('.guide-channel-button')[first]);
    }
</script>

<section class="guide" bind:this={host} aria-label={$t('TV Guide')}>
    <div class="heading guide-heading">
        <div>
            <p class="eyebrow">{$t('FULL PROGRAMME SCHEDULE')}</p>
            <h1>{$t('TV Guide')}<span>.</span></h1>
            <p>{$t('Browse what is on now and what comes next.')}</p>
        </div>
        <select value={active} onchange={(event) => onactive(event.currentTarget.value)} aria-label={$t('Playlist')}>
            {#each playlists as playlist}<option value={playlist.id}>{playlist.name}</option>{/each}
        </select>
    </div>

    <div class="guide-controls" aria-label={$t('Guide time controls')}>
        <button onclick={() => shift(-DAY)} aria-label={$t('Previous day')}>−24h</button>
        <button onclick={() => shift(-GUIDE_WINDOW)} aria-label={$t('Earlier programmes')}>← {$t('Earlier')}</button>
        <button class="primary" onclick={() => (anchor = guideWindowStart(clock))}>{$t('Now')}</button>
        <button onclick={() => shift(GUIDE_WINDOW)} aria-label={$t('Later programmes')}>{$t('Later')} →</button>
        <button onclick={() => shift(DAY)} aria-label={$t('Next day')}>+24h</button>
        <strong>{day(anchor)} · {time(anchor)}–{time(anchor + GUIDE_WINDOW)}</strong>
    </div>

    {#if failure}<div class="notice" role="status">{$t(failure)}</div>{/if}
    {#if loading}<p class="guide-loading" role="status">{$t('Loading programme schedule…')}</p>{/if}

    {#if channels.length}
        <div class="guide-wide">
            <div class="guide-timeline">
                <div class="guide-time-row">
                    <div class="guide-channel-heading">{$t('Channels')}</div>
                    <div class="guide-scale">
                        {#each slots as slot}<span style={`left: ${((slot - anchor) / GUIDE_WINDOW) * 100}%`}
                                >{time(slot)}</span
                            >{/each}
                    </div>
                </div>
                {#each visibleChannels as channel}
                    {@const items = schedules.get(channel.tvg) || []}
                    <div class="guide-row">
                        <button
                            class="guide-channel-button"
                            onclick={() => play(channel)}
                            aria-label={$t('Play ') + channel.name}
                        >
                            <span class="guide-channel-logo"><Logo src={channel.logo} name={channel.name} /></span>
                            <strong>{channel.name}</strong>
                        </button>
                        <div class="guide-track">
                            {#if currentPosition >= 0 && currentPosition <= 100}<i
                                    class="guide-now-line"
                                    style={`left: ${currentPosition}%`}
                                    aria-hidden="true"
                                ></i>{/if}
                            {#each items as programme}
                                <button
                                    class:current={programme.start <= clock && programme.end > clock}
                                    class="guide-programme"
                                    style={style(programme)}
                                    onclick={() => choose(channel, programme)}
                                    onfocus={() => choose(channel, programme)}
                                    aria-label={`${programme.title}, ${time(programme.start)}–${time(programme.end)}`}
                                >
                                    <strong>{programme.title || $t('Untitled programme')}</strong>
                                    <small>{time(programme.start)}–{time(programme.end)}</small>
                                </button>
                            {/each}
                            {#if !items.length && !loading}<span class="guide-empty-row"
                                    >{$t('No programme information')}</span
                                >{/if}
                        </div>
                    </div>
                {/each}
            </div>
            {#if visibleChannels.length < channels.length}{#key visibleChannels.length}<LoadMore
                        remaining={channels.length - visibleChannels.length}
                        onmore={more}
                        label={$t('Load more channels')}
                    />{/key}{/if}
        </div>

        <div class="guide-compact">
            <label
                >{$t('Channel')}<select bind:value={selectedChannel} aria-label={$t('Channel')}>
                    {#each channels as channel}<option value={channel.tvg}>{channel.name}</option>{/each}
                </select></label
            >
            <div class="guide-agenda">
                {#each selectedSchedule as programme}
                    {@const channel = channels.find((item) => item.tvg === selectedChannel)}
                    <button
                        class:current={programme.start <= clock && programme.end > clock}
                        onclick={() => choose(channel, programme)}
                        onfocus={() => choose(channel, programme)}
                    >
                        <time>{time(programme.start)}–{time(programme.end)}</time>
                        <span
                            ><strong>{programme.title || $t('Untitled programme')}</strong
                            >{#if programme.description}<small>{programme.description}</small>{/if}</span
                        >
                    </button>
                {:else}
                    {#if !loading}<p class="empty compact">
                            {$t('No programme information in this time window.')}
                        </p>{/if}
                {/each}
            </div>
        </div>

        {#if selected}<div class="guide-details" role="region" aria-label={$t('Programme details')}>
                <div>
                    <p>{selected.channel.name} · {time(selected.programme.start)}–{time(selected.programme.end)}</p>
                    <h2>{selected.programme.title || $t('Untitled programme')}</h2>
                    {#if selected.programme.description}<p>{selected.programme.description}</p>{/if}
                </div>
                <button class="primary" onclick={() => play(selected.channel)}>{$t('Watch channel')}</button>
            </div>{/if}
    {:else}
        <div class="empty">
            <h2>{$t('No channels with guide identifiers')}</h2>
            <p>{$t('The playlist needs tvg-id values to match channels with EPG programmes.')}</p>
        </div>
    {/if}
</section>
