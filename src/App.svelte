<script>
    import { t, locale, languagePreference, setLocale, refreshDeviceLocale, message as messageText } from './i18n.js';
    import EpgSettings from './EpgSettings.svelte';
    import Guide from './Guide.svelte';
    import { epgState, startEpg, disposeEpg, lookupGuide, enabledSources, setEpgPlaylists } from './epg/service.js';
    import { settings, changeSetting } from './settings.js';
    import LoadMore from './LoadMore.svelte';
    import CategoryManager from './CategoryManager.svelte';
    import { visibleChannels, lastOpenedChannel } from './playlist-preferences.js';
    import TVCatalog from './TVCatalog.svelte';
    import { moveFocus, focusControl } from './tv-navigation.js';
    import { refreshAtStartup } from './startup-refresh.js';
    import { readTextStream, parsePlaylistStream, formatBytes, yieldUI } from './playlist-import.js';
    import Player from './Player.svelte';
    import Intro from './Intro.svelte';
    import Catalog from './Catalog.svelte';
    import { separator, kind, indexCatalogue, filterCatalogue, currentGuide } from './catalog.js';
    import Hls from 'hls.js';
    import {
        isAndroid,
        isDesktop,
        isNative,
        NativePlayer,
        nativeText,
        nativePlaylist,
        playbackState,
        resumePlayback,
        stopPlayback,
        exitToHome,
        watchPlayback,
        setNativeLanguage,
    } from './native.js';
    import { playlistResponse, browserNetworkError } from './playlist-network.js';
    import { get, set, update, del } from 'idb-keyval';
    import { tick, onDestroy, onMount, untrack } from 'svelte';
    let lists = $state.raw([]),
        active = $state(''),
        page = $state('playlists'),
        query = $state(''),
        group = $state('__all'),
        favorites = $state([]),
        name = $state(''),
        url = $state(''),
        message = $state(''),
        epgMessage = $state(''),
        playbackMode = $state('auto'),
        busy = $state(false),
        selected = $state(null),
        video = $state(),
        hls,
        programs = $state.raw([]),
        clock = $state(Date.now());
    let loading = $state(null),
        failedSource = $state(''),
        tvMode = true,
        currentPlayback = $state(null),
        startupRefreshing = $state(false),
        refreshLabel = $state(''),
        searchQuery = $state('');
    let categoryEditor = $state(null),
        lastOpened = $state.raw({}),
        guideChannel = $state('');
    let playbackPoll,
        playbackSubscription,
        destroyed = false;
    $effect(() => {
        const value = query;
        const timeout = setTimeout(() => (searchQuery = value), 180);
        return () => clearTimeout(timeout);
    });
    let collectionLimit = $state(12),
        opening = $state(false),
        selectedOwner = '',
        intro = $state(true),
        catalogMode = $state($settings.initialSection),
        view = $state($settings.initialView),
        playbackError = $state('');
    let playbackTimer;

    let storageReady = $state(false),
        rytecPrograms = $state.raw([]),
        guideRequest = 0;
    $effect(() => {
        const ids = channels.map((c) => c.tvg),
            revision = $epgState.revision,
            now = clock;
        if (!storageReady) return;
        const request = ++guideRequest;
        const timer = setTimeout(() => {
            lookupGuide(
                ids,
                enabledSources().map((s) => s.id),
                now,
            )
                .then((items) => {
                    if (request === guideRequest && !destroyed) rytecPrograms = items;
                })
                .catch(() => {});
        }, 150);
        return () => clearTimeout(timer);
    });
    $effect(() => {
        const language = $locale;
        document.documentElement.lang = language;
        document.title = $t('TucaTV · Your TV takes flight');
        if (isNative)
            setNativeLanguage(language).catch(() => {
                message = 'Unable to synchronize the player language. Please try again.';
            });
    });
    $effect(() => {
        if (storageReady) setEpgPlaylists(lists);
    });
    onMount(() => {
        void boot();
        window.addEventListener('tuca-back', back);
        return () => {
            destroyed = true;
            window.removeEventListener('tuca-back', back);
            clearInterval(playbackPoll);
            playbackSubscription?.remove();
        };
    });
    async function boot() {
        try {
            let saved = await get('tucatv');
            if (!saved) {
                saved = JSON.parse(localStorage.getItem('tucatv') || '{}');
                await set('tucatv', saved);
                localStorage.removeItem('tucatv');
            }
            lists = (saved.lists || []).map((p) => ({ ...p, epg: p.epg === p.source ? '' : p.epg }));
            favorites = saved.favorites || [];
            active = lists[0]?.id || '';
            if (lists.length) page = 'channels';
        } catch {
            message = 'Unable to read local data.';
        }
        try {
            lastOpened = (await get('tuca-last-opened')) || {};
        } catch {}
        storageReady = true;
        void startEpg(lists);
        await tick();
        ensureFocus();
        if (isNative) {
            try {
                playbackSubscription = await watchPlayback((state) => {
                    acceptPlayback(state);
                    ensureFocus();
                });
                if (destroyed) {
                    await playbackSubscription.remove();
                    return;
                }
                await syncPlayback();
                playbackPoll = setInterval(() => {
                    if (!document.hidden) syncPlayback();
                }, 4000);
            } catch {}
        }
        if ($settings.refreshOnStartup) await autoRefresh();
    }
    function acceptPlayback(state) {
        currentPlayback = isAndroid && state.available ? state : null;
        if (state.lastPlayed)
            rememberOpened({ url: state.lastPlayed.url }, state.lastPlayed.playlistId, state.lastPlayed.at);
    }
    async function syncPlayback() {
        try {
            acceptPlayback(await playbackState());
        } catch {}
    }
    async function returnToPlayer() {
        try {
            await resumePlayback();
        } catch {
            await syncPlayback();
            message = 'Playback has ended. Select a channel again.';
        }
    }
    async function stopCurrent() {
        try {
            await stopPlayback();
            currentPlayback = null;
            await tick();
            ensureFocus();
        } catch {
            message = 'Unable to stop playback.';
        }
    }
    function ensureFocus() {
        if (!tvMode || intro || !storageReady) return;
        const focused = document.activeElement;
        if (!focused || focused === document.body || !focused.isConnected)
            focusControl(document.querySelector('.tv-tile,aside button.chosen,aside button'));
    }
    $effect(() => {
        tvMode;
        intro;
        storageReady;
        page;
        tick().then(ensureFocus);
    });
    async function autoRefresh() {
        if (busy || !lists.some((p) => p.source) || destroyed) return;
        busy = true;
        startupRefreshing = true;
        message = '';
        failedSource = '';
        const result = await refreshAtStartup(lists, active, async (p, position) => {
            refreshLabel = p.name + ' · ' + position.index + '/' + position.total;
            await refreshOne(p);
        });
        startupRefreshing = false;
        busy = false;
        refreshLabel = '';
        loading = {
            phase: result.failed ? 'error' : 'done',
            title: result.failed ? 'Partial refresh' : 'Playlists refreshed',
            detail: result.failed
                ? messageText('Refreshed: {count} · Unavailable: {failed}. Using the saved copies.', {
                      count: result.updated,
                      failed: result.failed,
                  })
                : messageText('Refreshed: {count}. Your library is ready.', { count: result.updated }),
            percent: result.failed ? null : 100,
        };
        await tick();
        ensureFocus();
    }
    const timer = setInterval(() => (clock = Date.now()), 30000);
    onDestroy(() => {
        clearInterval(timer);
        disposeEpg();
        stop();
    });
    let playlist = $derived(lists.find((p) => p.id === active)),
        channels = $derived(visibleChannels(playlist?.channels || [], playlist?.hiddenGroups || [])),
        catalogIndex = $derived(indexCatalogue(channels)),
        groups = $derived(['__all', '__favorites', ...catalogIndex[catalogMode + 'Groups']]),
        filtered = $derived(filterCatalogue(catalogIndex[catalogMode], searchQuery, group, favorites)),
        guideChannels = $derived(catalogIndex.live.filter((channel) => channel.tvg)),
        guideIndex = $derived(currentGuide([...programs, ...rytecPrograms], clock)),
        lastChannel = $derived(lastOpenedChannel(catalogIndex[catalogMode], lastOpened[active]));
    async function save() {
        try {
            await set('tucatv', { lists, favorites: $state.snapshot(favorites) });
        } catch {
            message = 'Unable to save: check the available space on your device.';
        }
    }
    function safe(s, base) {
        if (typeof s !== 'string' || !s.trim()) return '';
        try {
            let u = new URL(s, base);
            return ['https:', 'http:'].includes(u.protocol) ? u.href : '';
        } catch {
            return '';
        }
    }
    async function fetchText(u, onProgress) {
        if (!safe(u)) throw Error('Enter a valid HTTP or HTTPS URL.');
        if (isNative) return nativeText(u, onProgress);
        const r = await playlistResponse(u);
        const total = r.headers.get('content-encoding') ? 0 : Number(r.headers.get('content-length')) || 0;
        try {
            if (r.body) return await readTextStream(r.body, { total, onProgress, limit: 64 * 1024 * 1024 });
            return await r.text();
        } catch (error) {
            throw browserNetworkError(error);
        }
    }
    async function importPlaylist(source, file) {
        if (file) return parsePlaylistStream(file.stream(), undefined, { total: file.size, onProgress: parseProgress });
        if (!safe(source)) throw Error('Enter a valid HTTP or HTTPS URL.');
        if (isNative) {
            const download = await nativePlaylist(source, downloadProgress);
            try {
                return await parsePlaylistStream(download.stream, source, {
                    total: download.total,
                    onProgress: parseProgress,
                });
            } finally {
                await download.dispose();
            }
        }
        try {
            const response = await playlistResponse(source);
            const total = response.headers.get('content-encoding')
                ? 0
                : Number(response.headers.get('content-length')) || 0;
            if (!response.body)
                throw Error(
                    'This browser does not support streaming imports. Save the M3U file and use “Upload file”.',
                );
            return await parsePlaylistStream(response.body, source, {
                total,
                onProgress: (p) => {
                    loading = {
                        phase: 'download',
                        title: 'Downloading and parsing playlist',
                        detail: messageText('{bytes} · Channels found: {count}', {
                            bytes: messageText(p.total ? '{received} of {total}' : '{received} received', {
                                received: formatBytes(p.received),
                                total: formatBytes(p.total),
                            }),
                            count: p.count,
                        }),
                        percent: p.percent,
                    };
                },
            });
        } catch (error) {
            if (!startupRefreshing) failedSource = source;
            throw browserNetworkError(error);
        }
    }
    function downloadProgress(p) {
        loading = {
            phase: 'download',
            title: 'Downloading playlist',
            detail: messageText(p.total ? '{received} of {total}' : '{received} received · total size unavailable', {
                received: formatBytes(p.received),
                total: formatBytes(p.total),
            }),
            percent: p.percent,
        };
    }
    function parseProgress(p) {
        loading = {
            phase: 'parse',
            title: 'Reading channels',
            detail: messageText('Channels found: {count}', { count: p.count }),
            percent: p.percent,
        };
    }
    async function persistImport(nextLists) {
        loading = {
            phase: 'save',
            title: 'Saving to your device',
            detail: 'Your playlist will be ready once it has been saved.',
            percent: null,
        };
        await tick();
        await yieldUI();
        try {
            await set('tucatv', { lists: nextLists, favorites: $state.snapshot(favorites) });
        } catch {
            throw Error('Unable to save: check the available space on your device.');
        }
        lists = nextLists;
    }
    async function add(file) {
        if (busy) return;
        busy = true;
        message = '';
        failedSource = '';
        const source = url,
            label = name.trim() || file?.name || $t('My playlist');
        loading = {
            phase: 'download',
            title: file ? 'Reading file' : 'Connecting to source',
            detail: file ? file.name : 'Waiting for the source server…',
            percent: null,
        };
        await tick();
        await yieldUI();
        try {
            const parsed = await importPlaylist(source, file);
            const p = {
                id: Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join(
                    '',
                ),
                name: label,
                source: file ? '' : source,
                ...parsed,
                epg: parsed.epg,
                updated: Date.now(),
            };
            await persistImport([...lists, p]);
            active = p.id;
            name = '';
            url = '';
            page = 'channels';
            loading = {
                phase: 'done',
                title: 'Playlist ready',
                detail: messageText('Channels loaded and saved: {count}', { count: parsed.channels.length }),
                percent: 100,
            };
        } catch (e) {
            message = e.i18n || e.message;
            loading = {
                phase: 'error',
                title: 'Import not completed',
                detail: 'Check the error message and try again.',
                percent: null,
            };
        } finally {
            busy = false;
        }
    }
    async function refreshOne(p) {
        loading = { phase: 'download', title: 'Refreshing playlist', detail: 'Connecting to source…', percent: null };
        await tick();
        const parsed = await importPlaylist(p.source);
        await persistImport(
            lists.map((x) => (x.id === p.id ? { ...x, ...parsed, epg: x.epg || parsed.epg, updated: Date.now() } : x)),
        );
        if (active === p.id) loadEpg();
    }
    async function refresh(p) {
        if (busy) return;
        busy = true;
        message = '';
        failedSource = '';
        try {
            await refreshOne(p);
            loading = {
                phase: 'done',
                title: 'Playlist refreshed',
                detail: 'Your library has been refreshed and saved.',
                percent: 100,
            };
        } catch (e) {
            message = messageText('Refresh failed: {error}', { error: e.i18n || messageText(e.message) });
            loading = {
                phase: 'error',
                title: 'Refresh not completed',
                detail: 'The previous playlist has been kept.',
                percent: null,
            };
        } finally {
            busy = false;
        }
    }
    function remove(id) {
        if (busy) return;
        lists = lists.filter((p) => p.id !== id);
        if (active === id) active = lists[0]?.id || '';
        del('tuca-epg-' + id).catch(() => {});
        save();
    }
    function favorite(c) {
        favorites = favorites.includes(c.url) ? favorites.filter((u) => u !== c.url) : [...favorites, c.url];
        const snapshot = $state.snapshot(favorites);
        update('tucatv', (saved) => ({ ...saved, favorites: snapshot })).catch(
            () => (message = 'Unable to save favorites.'),
        );
    }
    function date(s) {
        let m = s?.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4})?/);
        return m
            ? Date.parse(
                  m[1] +
                      '-' +
                      m[2] +
                      '-' +
                      m[3] +
                      'T' +
                      m[4] +
                      ':' +
                      m[5] +
                      ':' +
                      (m[6] || '00') +
                      (m[7] ? m[7].slice(0, 3) + ':' + m[7].slice(3) : 'Z'),
              )
            : NaN;
    }
    let epgRequest = 0;
    $effect(() => {
        const owner = playlist?.id,
            source = playlist?.epg;
        if (storageReady) untrack(() => loadEpg());
    });
    async function loadEpg(file) {
        const request = ++epgRequest,
            owner = active,
            source = playlist?.epg;
        const current = () => request === epgRequest && owner === active && !destroyed;
        epgMessage = '';
        programs = [];
        if (!owner) return;
        try {
            const cached = await get('tuca-epg-' + owner);
            if (!current()) return;
            if (cached && (cached.source === source || cached.local)) {
                programs = cached.programs;
                epgMessage = 'TV guide saved on your device.';
            }
            if (!file && !source) return;
            const text = file
                ? await readTextStream(file.stream(), { total: file.size, limit: 64 * 1024 * 1024 })
                : await fetchText(source);
            if (!current()) return;
            const doc = new DOMParser().parseFromString(text, 'text/xml');
            if (doc.querySelector('parsererror') || !doc.querySelector('tv')) throw Error('Invalid XML');
            const parsed = [...doc.querySelectorAll('programme')].map((p) => ({
                channel: p.getAttribute('channel'),
                start: date(p.getAttribute('start')),
                end: date(p.getAttribute('stop')),
                title: p.querySelector('title')?.textContent || '',
                description: p.querySelector('desc')?.textContent || '',
            }));
            programs = parsed;
            epgMessage = 'TV guide loaded.';
            try {
                await set('tuca-epg-' + owner, { source, local: !!file, programs: parsed });
            } catch {
                if (current()) epgMessage = 'Guide loaded but not saved: check the available space.';
            }
        } catch {
            if (current())
                epgMessage = programs.length
                    ? 'Guide refresh failed: using the saved copy.'
                    : 'TV guide unavailable: check the XMLTV source. You can still play channels.';
        }
    }

    function now(c) {
        return guideIndex.now.get(c?.tvg);
    }
    function next(c) {
        return guideIndex.next.get(c?.tvg);
    }
    function time(t) {
        return new Date(t).toLocaleTimeString($locale, { hour: '2-digit', minute: '2-digit' });
    }
    function stop() {
        clearTimeout(playbackTimer);
        hls?.destroy();
        hls = null;
        if (video) {
            video.pause();
            video.removeAttribute('src');
            video.load();
        }
    }
    let playRequest = 0,
        fallbackUsed = false;
    function fail(text) {
        clearTimeout(playbackTimer);
        playbackError = text;
        hls?.destroy();
        hls = null;
        if (video) {
            video.pause();
            video.removeAttribute('src');
            video.load();
        }
    }
    function startHls(c, request) {
        fallbackUsed = true;
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = c.url;
            video.play().catch(() => {});
            return;
        }
        if (!Hls.isSupported()) {
            fail('This browser does not support HLS. Open the source in an external player.');
            return;
        }
        hls = new Hls();
        hls.on(Hls.Events.ERROR, (_, d) => {
            if (request !== playRequest || !d.fatal) return;
            const status = d.response?.code;
            fail(
                status
                    ? messageText('The source returned HTTP {status}. Check access and link validity.', { status })
                    : d.type === Hls.ErrorTypes.NETWORK_ERROR
                      ? 'The browser cannot read the stream: possible CORS restrictions, network error or access denied. The browser cannot always distinguish these causes.'
                      : 'The content is not valid HLS or uses codecs unsupported by this browser.',
            );
        });
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (request === playRequest) video?.play().catch(() => {});
        });
        hls.loadSource(c.url);
        hls.attachMedia(video);
    }
    function mediaError() {
        if (!video?.getAttribute('src') || page !== 'player' || playbackError) return;
        if (
            playbackMode === 'auto' &&
            !fallbackUsed &&
            !/\.(mp4|mkv|avi|mov|webm|m4v)(?:[?#]|$)/i.test(selected.url) &&
            Hls.isSupported()
        ) {
            video.removeAttribute('src');
            video.load();
            startHls(selected, playRequest);
            return;
        }
        fail(
            video.error?.code === 2
                ? 'Stream download failed. Check the connection and source permissions.'
                : 'This browser cannot play the format or codec, or access to the source was denied. VLC supports different formats from the browser.',
        );
    }
    function exportSelected() {
        const blob = new Blob(
            ['#EXTM3U\n#EXTINF:-1,' + selected.name.replace(/[\r\n]/g, ' ') + '\n' + selected.url + '\n'],
            { type: 'audio/x-mpegurl' },
        );
        const u = URL.createObjectURL(blob),
            a = document.createElement('a');
        a.href = u;
        a.download = 'TucaTV-stream.m3u';
        a.click();
        setTimeout(() => URL.revokeObjectURL(u), 1000);
    }
    function rememberOpened(c, owner = selectedOwner, at = Date.now()) {
        if (!owner || !c?.url || !lists.some((p) => p.id === owner) || lastOpened[owner]?.at >= at) return;
        lastOpened = { ...lastOpened, [owner]: { url: c.url, at } };
        set('tuca-last-opened', lastOpened).catch(() => {});
    }
    async function editCategories(p) {
        categoryEditor = p.id;
        await tick();
        focusControl(document.querySelector('.category-manager input'));
    }
    async function saveCategories(value) {
        const hidden = $state.snapshot(value);
        const id = categoryEditor;
        await update('tucatv', (saved) => ({
            ...saved,
            lists: (saved?.lists || lists).map((p) => (p.id === id ? { ...p, hiddenGroups: hidden } : p)),
        }));
        lists = lists.map((p) => (p.id === id ? { ...p, hiddenGroups: hidden } : p));
        group = '__all';
    }
    async function play(c) {
        if (separator(c)) {
            message = 'This entry is a separator: select an actual channel.';
            return;
        }
        if (opening) return;
        selectedOwner = active;
        if (isNative) {
            opening = true;
            message = 'Preparing playback…';
            try {
                const pool = filtered.some((x) => x.url === c.url) ? filtered : [c, ...filtered];
                const index = pool.findIndex((x) => x.url === c.url);
                await NativePlayer.play({ url: c.url, title: c.name, playlistId: active, queue: pool, index });
                message = '';
            } catch {
                message = 'Unable to open the native player.';
            } finally {
                opening = false;
            }
            return;
        }
        const request = ++playRequest;
        stop();
        selected = c;
        page = 'player';
        message = '';
        playbackError = '';
        fallbackUsed = false;
        await tick();
        if (request !== playRequest || page !== 'player') return;
        if (location.protocol === 'https:' && new URL(c.url).protocol === 'http:') {
            fail(
                'TucaTV did not start this HTTP source from an HTTPS page, to avoid browser blocking or automatic URL upgrades. Use the Android app or VLC; for browser playback, ask your provider for a compatible HTTPS source.',
            );
            return;
        }
        playbackTimer = setTimeout(() => {
            if (request === playRequest && video.readyState < 2)
                fail(
                    'The source did not provide video within 20 seconds. Check the link and CORS permissions, or open it in VLC.',
                );
        }, 20000);
        const isHls = /\.m3u8(?:[?#]|$)|[?&]output=m3u8(?:&|$)/i.test(c.url);
        if (playbackMode === 'hls' || (playbackMode === 'auto' && isHls)) startHls(c, request);
        else {
            video.src = c.url;
            video.play().catch(() => {});
        }
    }
    async function saveEpgUrl(value) {
        const url = value.trim();
        if (url && !safe(url)) {
            epgMessage = 'Enter a valid HTTP or HTTPS URL.';
            return;
        }
        const previous = lists;
        lists = lists.map((p) => (p.id === active ? { ...p, epg: url } : p));
        try {
            await set('tucatv', { lists, favorites: $state.snapshot(favorites) });
        } catch {
            lists = previous;
            epgMessage = 'Unable to save settings.';
        }
    }
    function configure(key, value) {
        if (!changeSetting(key, value)) message = 'Unable to save settings.';
    }
    function chooseLanguage(value) {
        if (!setLocale(value)) message = 'Unable to save settings.';
    }
    function nav(p) {
        ++playRequest;
        stop();
        categoryEditor = null;
        page = p;
        message = '';
    }
    function openGuide(channel) {
        guideChannel = channel?.tvg || '';
        nav('guide');
    }
    function progressKey(event, destination) {
        if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return;
        event.preventDefault();
        nav(destination);
    }
    function demo() {
        if (busy) return;
        let p = {
            id: Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join(''),
            name: $t('Sample playlist'),
            channels: [
                {
                    name: 'Big Buck Bunny',
                    kind: 'vod',
                    group: 'Demo',
                    tvg: '',
                    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
                },
                {
                    name: 'Sintel',
                    group: 'Demo',
                    tvg: '',
                    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
                },
            ],
            updated: Date.now(),
            source: '',
            epg: '',
        };
        lists = [...lists, p];
        active = p.id;
        save();
        page = 'channels';
        catalogMode = 'vod';
        programs = [];
    }
    function changeChannel(step) {
        const pool = filtered;
        const i = pool.findIndex((c) => c.url === selected?.url);
        if (pool.length) play(pool[(i + step + pool.length) % pool.length]);
    }
    function back() {
        if (categoryEditor) {
            categoryEditor = null;
            tick().then(ensureFocus);
            return;
        }
        if (intro) {
            intro = false;
            return;
        }
        if (page === 'epg') {
            nav('settings');
            return;
        }
        if (page === 'guide') {
            nav('channels');
            return;
        }
        if (page === 'player') {
            nav('channels');
            return;
        }
        if (tvMode && !document.activeElement?.closest('aside')) {
            focusControl(document.querySelector('aside button.chosen,aside button'));
            return;
        }
        if (page !== 'channels' && lists.length) {
            nav('channels');
            return;
        }
        if (isAndroid) exitToHome();
        else if (page !== 'playlists') nav('playlists');
    }
    let lastDirection = 0;
    function keys(e) {
        if (e.defaultPrevented) return;
        if (e.key === 'Escape' || e.key === 'BrowserBack') {
            e.preventDefault();
            back();
            return;
        }
        if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
        const element = document.activeElement;
        if (element?.tagName === 'SELECT' || element?.tagName === 'VIDEO') return;
        if (element?.tagName === 'INPUT' && (!tvMode || ['ArrowLeft', 'ArrowRight'].includes(e.key))) return;
        e.preventDefault();
        if (e.repeat && performance.now() - lastDirection < 90) return;
        lastDirection = performance.now();
        moveFocus(e.key, intro ? document.querySelector('.startup') : document);
    }
</script>

<svelte:window onkeydown={keys} onlanguagechange={refreshDeviceLocale} onfocus={refreshDeviceLocale} />
{#if intro}<Intro ondone={() => (intro = false)} />{/if}
<div class="shell tv-mode tv-first" class:android-shell={isAndroid} inert={intro}>
    <aside>
        <a class="brand" href="#home" onclick={() => nav('playlists')}
            ><img class="brand-mark" src="/tucatv-mark.svg" alt={$t('Toucan beak')} /> TucaTV<span class="beta"
                >BETA</span
            ></a
        >
        <div class="navlabel">{$t('YOUR TV SPACE')}</div>
        <button aria-label={$t('Catalogue')} class:chosen={page === 'channels'} onclick={() => nav('channels')}
            >▦ <span>{$t('Catalogue')}</span></button
        ><button aria-label={$t('TV Guide')} class:chosen={page === 'guide'} onclick={() => openGuide()}
            >▥ <span>{$t('TV Guide')}</span></button
        ><button aria-label={$t('My playlists')} class:chosen={page === 'playlists'} onclick={() => nav('playlists')}
            >▤ <span>{$t('My playlists')}</span></button
        ><button
            aria-label={$t('Favorites')}
            onclick={() => {
                nav('channels');
                group = '__favorites';
            }}>♡ <span>{$t('Favorites')}</span><small>{favorites.length}</small></button
        ><button
            aria-label={$t('Settings')}
            class:chosen={page === 'settings' || page === 'epg'}
            onclick={() => nav('settings')}>⚙ <span>{$t('Settings')}</span></button
        >{#if currentPlayback}<div class="current-playback">
                <button
                    class="resume-player"
                    onclick={returnToPlayer}
                    aria-label={$t('Return to player: ') + currentPlayback.title}
                    >▶ <span>{$t('Return to player')}<small>{currentPlayback.title}</small></span></button
                ><button class="stop-current" onclick={stopCurrent} aria-label={$t('Stop playback')}
                    >■ <span>{$t('Stop')}</span></button
                >
            </div>{/if}
        <div class="asidebottom">
            <span class="dot"></span>
            {$t('Everything on your device')}
            <p>{$t('No account. Just your TV.')}</p>
            <small>{$t('TucaTV / VERSION 0.13.3')}</small>
        </div>
    </aside>
    <main>
        <header>
            <span
                >{page === 'epg'
                    ? $t('TV guides (EPG)')
                    : page === 'guide'
                      ? $t('TV Guide')
                      : page === 'settings'
                        ? $t('Settings')
                        : page === 'playlists'
                          ? $t('LIBRARY')
                          : page === 'player'
                            ? $t('NOW PLAYING')
                            : $t('YOUR CATALOGUE')}</span
            >
            <div>
                <span class="dot"></span>
                {isDesktop ? 'Desktop · VLC' : isAndroid ? 'Android · VLC' : 'Browser'}
                <span class="clock">{time(clock)}</span>
            </div>
        </header>
        {#if loading}<div
                class="import-progress progress-link"
                class:complete={loading.phase === 'done'}
                class:background-refresh={startupRefreshing}
                role="link"
                tabindex="0"
                aria-label={$t('Playlist import progress')}
                aria-busy={busy}
                onclick={() => nav('playlists')}
                onkeydown={(event) => progressKey(event, 'playlists')}
            >
                <div class="import-progress-top">
                    <strong role="status">{$t(loading.title)}</strong>{#if loading.percent !== null}<b
                            >{loading.percent}%</b
                        >{/if}{#if !busy}<button
                            aria-label={$t('Close progress')}
                            onclick={(event) => {
                                event.stopPropagation();
                                loading = null;
                            }}>×</button
                        >{/if}
                </div>
                {#if loading.phase !== 'error'}<progress
                        class:indeterminate={loading.percent === null}
                        max="100"
                        value={loading.percent ?? undefined}
                        aria-label={$t(loading.title)}
                    ></progress>{/if}
                <p>{refreshLabel ? refreshLabel + ' · ' : ''}{$t(loading.detail)}</p>
                <small
                    >{loading.phase === 'download'
                        ? $t('1 / 3 · Download')
                        : loading.phase === 'parse'
                          ? $t('2 / 3 · Parsing')
                          : loading.phase === 'save'
                            ? $t('3 / 3 · Saving')
                            : loading.phase === 'done'
                              ? $t('Completed')
                              : ''}</small
                >
            </div>{/if}
        {#if $epgState.running}<div
                class="import-progress epg-progress background-refresh progress-link"
                role="link"
                tabindex="0"
                aria-label={$t('EPG update progress')}
                aria-busy="true"
                onclick={() => nav('epg')}
                onkeydown={(event) => progressKey(event, 'epg')}
            >
                <div class="import-progress-top">
                    <strong role="status">{$t('Updating TV guides')}</strong><b
                        >{$epgState.completed} / {$epgState.total}</b
                    >
                </div>
                <progress
                    max={$epgState.total || 1}
                    value={$epgState.completed}
                    aria-label={$t('Sources processed: {count} / {total}', {
                        count: $epgState.completed,
                        total: $epgState.total,
                    })}
                ></progress>
                <p>{$epgState.source || $t('Preparing EPG sources…')}</p>
                <small
                    >{$t($epgState.phase)}{#if $epgState.phase === 'Reading and saving the guide…'}
                        · {$t('Programmes processed: {count}', { count: $epgState.count })}{/if}</small
                >
            </div>{/if}
        {#if failedSource && !isNative}<div class="notice">
                <p>
                    {$t(
                        'You can download the playlist separately and import the file. This resolves importing, but does not change browser stream compatibility.',
                    )}
                </p>
                <a href={safe(failedSource)} target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer"
                    >{$t('Open playlist link ↗')}</a
                >
            </div>{/if}
        {#if message}<div class="notice" role="status">
                {$t(message)}<button onclick={() => (message = '')} aria-label={$t('Dismiss message')}>×</button>
            </div>{/if}
        {#if !storageReady}<div class="empty">{$t('Loading your library…')}</div>{:else if page === 'guide'}
            <Guide
                channels={guideChannels}
                customPrograms={programs}
                playlists={lists}
                {active}
                onactive={(value) => {
                    active = value;
                    group = '__all';
                }}
                {play}
                {clock}
                requestedChannel={guideChannel}
            />
        {:else if page === 'epg'}
            <EpgSettings
                {lists}
                {active}
                onactive={(value) => (active = value)}
                onurl={saveEpgUrl}
                onfile={loadEpg}
                {epgMessage}
                onback={() => nav('settings')}
            />
        {:else if page === 'settings'}
            <div class="heading">
                <div>
                    <h1>{$t('Settings')}<span>.</span></h1>
                    <p>{$t('Preferences saved on this device.')}</p>
                </div>
            </div>
            <section class="panel settings-panel" aria-label={$t('Settings')}>
                <button class="primary" onclick={() => nav('epg')}>{$t('Manage EPG')} →</button>
                <label
                    >{$t('Language')}<select
                        value={$languagePreference}
                        onchange={(e) => chooseLanguage(e.currentTarget.value)}
                        ><option value="device">{$t('Device language')}</option><option value="it">Italiano</option
                        ><option value="en">English</option></select
                    ></label
                >
                <p>{$t('Language changes immediately. Startup options apply the next time you open the app.')}</p>
                <label
                    >{$t('Refresh playlists at startup')}<select
                        value={String($settings.refreshOnStartup)}
                        onchange={(e) => configure('refreshOnStartup', e.currentTarget.value === 'true')}
                        ><option value="true">{$t('On')}</option><option value="false">{$t('Off')}</option></select
                    ></label
                >
                <label
                    >{$t('Initial view')}<select
                        value={$settings.initialView}
                        onchange={(e) => configure('initialView', e.currentTarget.value)}
                        ><option value="catalog">{$t('Catalogue view')}</option><option value="list"
                            >{$t('Grid view')}</option
                        ></select
                    ></label
                >
                <label
                    >{$t('Initial section')}<select
                        value={$settings.initialSection}
                        onchange={(e) => configure('initialSection', e.currentTarget.value)}
                        ><option value="live">Live TV</option><option value="vod">{$t('▶ Movies and series')}</option
                        ></select
                    ></label
                >
            </section>
        {:else if page === 'playlists'}
            {#if categoryEditor}{#each lists.filter((p) => p.id === categoryEditor) as p (p.id)}<CategoryManager
                        playlist={p}
                        onsave={saveCategories}
                        onclose={() => {
                            categoryEditor = null;
                            tick().then(ensureFocus);
                        }}
                    />{/each}{:else}
                <div class="heading">
                    <div>
                        <p class="eyebrow">{$t('TV, YOUR WAY')}</p>
                        <h1>{$t('My playlists')}<span>.</span></h1>
                        <p>{$t('A place for all your channels. Nothing else gets in the way.')}</p>
                    </div>
                    <span class="counter">{lists.length} playlist</span>
                </div>
                <div class="importgrid">
                    <section class="panel">
                        <div class="sectiontitle">
                            <span class="iconbox">＋</span>
                            <div>
                                <h2>{$t('Add a playlist')}</h2>
                                <p>{$t('Connect a source and start watching.')}</p>
                            </div>
                        </div>
                        <label>{$t('Playlist name')}<input bind:value={name} placeholder={$t('E.g. Home TV')} /></label
                        ><label
                            >{$t('M3U link')}<input
                                bind:value={url}
                                type="url"
                                placeholder="https://esempio.it/playlist.m3u"
                            /></label
                        ><button class="primary full" disabled={busy || !url} onclick={() => add()}
                            >{busy ? $t('Loading…') : $t('Add playlist')} <span>↗</span></button
                        >
                        <div class="divider">{$t('or')}</div>
                        <label class="upload"
                            >↥ <b>{$t('Upload an M3U file')}</b><span>{$t('Choose a file from your device')}</span
                            ><input
                                type="file"
                                accept=".m3u,.m3u8"
                                disabled={busy}
                                onchange={(e) => {
                                    if (e.target.files[0]) add(e.target.files[0]);
                                    e.target.value = '';
                                }}
                            /></label
                        >
                    </section>
                    <section class="intro">
                        <div class="orbit"><img src="/tucatv-mark.svg" alt="" /></div>
                        <p class="eyebrow">{$t('FEWER DISTRACTIONS. MORE TV.')}</p>
                        <h2>{$t('Press play.')}<br />{$t('Feel at home.')}</h2>
                        <p>
                            {$t(
                                'Your playlists, your favorites and a simple TV guide. An interface that makes room for what you watch.',
                            )}
                        </p>
                        <button class="textbutton" disabled={busy} onclick={demo}
                            >{$t('Explore a demo playlist ↗')}</button
                        ><small>{$t('Two sample videos · no channels included')}</small>
                    </section>
                </div>
                <div class="sectionrow">
                    <h2>{$t('Your library')}</h2>
                    <span>{$t('Saved on your device')}</span>
                </div>
                {#if !lists.length}<div class="empty compact">
                        {$t('Add your first playlist.')}<button onclick={demo} disabled={busy}
                            >{$t('Explore the demo')}</button
                        >
                    </div>{/if}
                <div class="collection">
                    {#each lists.slice(0, collectionLimit) as p}<article class="playlistcard">
                            <span class="iconbox">▤</span>
                            <h3>{p.name}</h3>
                            <p>
                                {p.channels.length}
                                {$t('channels ·')}
                                {p.source ? $t('Online source') : $t('Local file')}
                            </p>
                            <small>{$t('Updated')} {new Date(p.updated).toLocaleDateString($locale)}</small>
                            <div class="actions">
                                <button
                                    class="primary"
                                    onclick={() => {
                                        active = p.id;
                                        group = '__all';
                                        page = 'channels';
                                    }}>{$t('Open →')}</button
                                >{#if p.source}<button disabled={busy} onclick={() => refresh(p)}
                                        >{$t('Refresh')}</button
                                    >{/if}<button disabled={busy} onclick={() => editCategories(p)}
                                    >{$t('Categories')}{p.hiddenGroups?.length
                                        ? ' · ' + p.hiddenGroups.length + $t(' hidden')
                                        : ''}</button
                                ><button
                                    disabled={busy}
                                    onclick={() => remove(p.id)}
                                    aria-label={$t('Delete ') + p.name}>{$t('Delete')}</button
                                >
                            </div>
                        </article>{/each}
                </div>
                {#if collectionLimit < lists.length}{#key collectionLimit}<LoadMore
                            remaining={lists.length - collectionLimit}
                            onmore={async (focus) => {
                                const first = collectionLimit;
                                collectionLimit += 12;
                                await tick();
                                if (focus)
                                    focusControl(
                                        document.querySelectorAll('.playlistcard')[first]?.querySelector('button'),
                                    );
                            }}
                            label={$t('Load more playlists')}
                        />{/key}{/if}
            {/if}
        {:else if page === 'channels'}
            <div class="heading">
                <div>
                    <p class="eyebrow">{$t('CHOOSE WHAT TO WATCH')}</p>
                    <h1>{catalogMode === 'live' ? 'Live TV' : 'On demand'}<span>.</span></h1>
                    <p>{catalogMode === 'live' ? $t('The world, live.') : $t('Choose a story. Press play.')}</p>
                </div>
                <select
                    bind:value={active}
                    onchange={() => {
                        group = '__all';
                    }}
                    aria-label="Playlist"
                    >{#each lists as p}<option value={p.id}>{p.name}</option>{/each}</select
                >
            </div>
            {#if playlist?.channels.length}<div class="catalog-tabs">
                    <button
                        class:active={catalogMode === 'live'}
                        aria-pressed={catalogMode === 'live'}
                        onclick={() => {
                            catalogMode = 'live';
                            group = '__all';
                        }}>● Live TV</button
                    ><button
                        class:active={catalogMode === 'vod'}
                        aria-pressed={catalogMode === 'vod'}
                        onclick={() => {
                            catalogMode = 'vod';
                            group = '__all';
                        }}>{$t('▶ Movies and series')}</button
                    >
                    <div class="top-spacer"></div>
                    <button
                        class:active={view === 'catalog'}
                        onclick={() => (view = 'catalog')}
                        aria-label={$t('Catalogue view')}>▦</button
                    ><button class:active={view === 'list'} onclick={() => (view = 'list')} aria-label={$t('Grid view')}
                        >☷</button
                    >
                </div>
                {#if epgMessage}<div class="notice" role="status">{$t(epgMessage)}</div>{/if}
                <div class="toolbar">
                    <input
                        class="search"
                        bind:value={query}
                        placeholder={$t('Search the catalogue…')}
                        aria-label={$t('Search the catalogue')}
                    />
                </div>
                <div class="catalog-filters">
                    <label
                        >{$t('Category')}<select bind:value={group}
                            >{#each groups as g}<option value={g}
                                    >{g === '__all' ? $t('All') : g === '__favorites' ? $t('Favorites') : g}</option
                                >{/each}</select
                        ></label
                    ><span>{filtered.length.toLocaleString($locale)} {$t('items')}</span>
                </div>
                {#if view === 'catalog' && group === '__all' && !query}<Catalog
                        items={filtered}
                        {lastChannel}
                        mode={catalogMode}
                        {play}
                        {favorite}
                        {favorites}
                        {now}
                        oncategory={(g) => {
                            group = g;
                            view = 'list';
                        }}
                    />{:else}<TVCatalog
                        items={filtered}
                        {play}
                        {favorite}
                        {favorites}
                        {now}
                        guide={catalogMode === 'live' ? openGuide : null}
                    />{/if}{:else}<div class="empty">
                    <h2>{$t('Your screen is waiting.')}</h2>
                    <p>{$t('Add a playlist to find all your channels here.')}</p>
                    <button class="primary" onclick={() => nav('playlists')}>{$t('Add playlist ↗')}</button>
                </div>{/if}
        {:else}
            <div class="watch-heading">
                <button class="textbutton" onclick={() => nav('channels')}>{$t('← Your TV')}</button><span
                    >TUCA PLAYER</span
                >
            </div>
            <Player
                error={playbackError}
                onexternal={exportSelected}
                {video}
                channel={selected}
                programme={now(selected)}
                favorite={favorites.includes(selected.url)}
                mode={playbackMode}
                onback={() => nav('channels')}
                onprevious={() => changeChannel(-1)}
                onnext={() => changeChannel(1)}
                onretry={() => play(selected)}
                onfavorite={() => favorite(selected)}
                onmode={(m) => {
                    playbackMode = m;
                    play(selected);
                }}
            >
                <video
                    bind:this={video}
                    autoplay
                    playsinline
                    onloadeddata={() => clearTimeout(playbackTimer)}
                    onplaying={() => rememberOpened(selected)}
                    onerror={mediaError}><track kind="captions" /></video
                >
            </Player>
            <div class="watch-info">
                <div>
                    <p class="eyebrow">{kind(selected) === 'vod' ? 'ON DEMAND' : $t('UP NEXT')}</p>
                    <h2>
                        {kind(selected) === 'vod'
                            ? selected.name
                            : next(selected)?.title || $t('The next programme, when available.')}
                    </h2>
                    <p>
                        {kind(selected) === 'vod'
                            ? 'On demand · ' + selected.group
                            : next(selected)
                              ? time(next(selected).start)
                              : $t('Connect an XMLTV guide to your playlist.')}
                    </p>
                </div>
                <div class="keyboard-hint">{$t('Space · Play / pause')}<br />{$t('F · Full screen')}</div>
            </div>
        {/if}
        <footer>
            TucaTV <span>{$t('Your TV. Your pace.')}</span><span
                >{$t('Playlists and favorites stay on this device.')}</span
            >
        </footer>
    </main>
</div>
