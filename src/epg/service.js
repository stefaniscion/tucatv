import { writable, get as storeValue } from 'svelte/store';
import sources from './rytec.json' with { type: 'json' };
import { isNative, nativePlaylist } from '../native.js';
import {
    metadata,
    commitSource,
    deleteGeneration,
    cleanOrphans,
    clearGuides,
    lookupGuide,
    lookupSchedule,
} from './database.js';
export { sources, lookupGuide, lookupSchedule };
const DAY = 86400000,
    MAX_BYTES = 256 * 1024 * 1024,
    MIRROR_BACKOFF = 6 * 3600000,
    IMPORT_CONCURRENCY = 2;
const EPG_ERRORS = new Set([
    'Invalid or unsupported XMLTV/XZ file.',
    'The guide contains no valid programmes.',
    'The guide contains no recent programmes.',
    'Unable to save EPG data. Check available storage.',
    'The guide exceeds the 256 MiB limit or contains an oversized field.',
    'EPG update stopped.',
    'This HTTP source cannot be loaded from an HTTPS page. Use the installed app.',
    'The source returned an HTTP error.',
    'Download failed. Check the connection and, in the browser, CORS permissions.',
    'Native download failed. Check the connection or try another mirror.',
    'The download is incomplete.',
]);
function preferences() {
    try {
        const value = JSON.parse(localStorage.getItem('tucatv-epg-settings'));
        return {
            automatic: value?.automatic !== false,
            disabled: Array.isArray(value?.disabled)
                ? value.disabled.filter((id) => sources.some((s) => s.id === id))
                : [],
        };
    } catch {
        return { automatic: true, disabled: [] };
    }
}
export const epgPreferences = writable(preferences());
export const epgState = writable({
    running: false,
    source: '',
    completed: 0,
    total: 0,
    received: 0,
    bytes: 0,
    count: 0,
    phase: '',
    records: {},
    errors: {},
    revision: 0,
});
const patch = (values) => epgState.update((state) => ({ ...state, ...values }));
let task,
    controller,
    initialized = false,
    autoTimer,
    ready,
    rerun = false,
    channelIds = [],
    channelSignature = '0:0';

function signature(ids) {
    let hash = 2166136261;
    for (const id of ids) {
        for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
        hash = Math.imul(hash ^ 0, 16777619);
    }
    return `${ids.length}:${(hash >>> 0).toString(16)}`;
}

export function setEpgPlaylists(playlists = []) {
    const next = [
            ...new Set(
                playlists.flatMap((playlist) =>
                    (playlist.channels || [])
                        .map((channel) => channel.tvg?.trim())
                        .filter((id) => id && id.length <= 512),
                ),
            ),
        ].sort(),
        nextSignature = signature(next);
    if (nextSignature === channelSignature) return;
    channelIds = next;
    channelSignature = nextSignature;
    if (initialized && storeValue(epgPreferences).automatic) {
        if (task) rerun = true;
        else void refreshEpg(false);
    }
}

function loadMirrorHealth() {
    try {
        return JSON.parse(localStorage.getItem('tucatv-epg-mirrors')) || {};
    } catch {
        return {};
    }
}

function saveMirrorHealth(value) {
    try {
        localStorage.setItem('tucatv-epg-mirrors', JSON.stringify(value));
    } catch {}
}
export function configureEpg(values) {
    const next = { ...storeValue(epgPreferences), ...values };
    try {
        localStorage.setItem('tucatv-epg-settings', JSON.stringify(next));
    } catch {
        return false;
    }
    epgPreferences.set(next);
    epgState.update((s) => ({ ...s, revision: s.revision + 1 }));
    return true;
}
export function enabledSources() {
    const disabled = new Set(storeValue(epgPreferences).disabled);
    return sources.filter((s) => !disabled.has(s.id));
}
async function loadMetadata() {
    const records = Object.fromEntries((await metadata()).map((s) => [s.id, s]));
    epgState.update((s) => ({ ...s, records, revision: s.revision + 1 }));
}
export async function startEpg(playlists = []) {
    if (initialized) return;
    setEpgPlaylists(playlists);
    initialized = true;
    ready = (async () => {
        await cleanOrphans();
        await loadMetadata();
    })();
    try {
        await ready;
    } catch {
        patch({ phase: 'Unable to save EPG data. Check available storage.' });
        return;
    }
    if (storeValue(epgPreferences).automatic) void refreshEpg(false);
    autoTimer = setInterval(() => {
        if (!document.hidden && storeValue(epgPreferences).automatic) void refreshEpg(false);
    }, 3600000);
}
export function disposeEpg() {
    clearInterval(autoTimer);
    controller?.abort();
}
export function cancelEpg() {
    controller?.abort();
    patch({ phase: 'Stopping the update… The current download may need to finish.' });
}
export async function clearEpg() {
    if (task) return;
    await clearGuides();
    patch({ records: {}, errors: {} });
    await loadMetadata();
}
async function openStream(url, signal, cache, onProgress) {
    if (signal.aborted) throw Error('EPG update stopped.');
    if (isNative) {
        try {
            const download = await nativePlaylist(url, onProgress, cache);
            if (signal.aborted) {
                await download.dispose();
                throw Error('EPG update stopped.');
            }
            return download;
        } catch (error) {
            if (signal.aborted || error?.message === 'EPG update stopped.') throw Error('EPG update stopped.');
            throw Error('Native download failed. Check the connection or try another mirror.');
        }
    }
    if (location.protocol === 'https:' && new URL(url).protocol === 'http:')
        throw Error('This HTTP source cannot be loaded from an HTTPS page. Use the installed app.');
    try {
        const response = await fetch(url, { signal });
        if (!response.ok) throw Error('The source returned an HTTP error.');
        if (!response.body) throw Error('Download failed. Check the connection and, in the browser, CORS permissions.');
        return {
            stream: response.body,
            total: response.headers.get('content-encoding') ? 0 : Number(response.headers.get('content-length')) || 0,
            etag: response.headers.get('etag') || '',
            lastModified: response.headers.get('last-modified') || '',
            dispose: async () => {},
        };
    } catch (error) {
        if (signal.aborted) throw Error('EPG update stopped.');
        throw EPG_ERRORS.has(error.message)
            ? error
            : Error('Download failed. Check the connection and, in the browser, CORS permissions.');
    }
}
async function importStream(download, generation, signal, channels, onProgress) {
    const reader = download.stream.getReader();
    let worker,
        total = download.total,
        received = 0;
    const read = async () => {
        const part = await reader.read();
        if (!part.done) {
            received += part.value.byteLength;
            onProgress({ received });
            if (received > MAX_BYTES)
                throw Error('The guide exceeds the 256 MiB limit or contains an oversized field.');
        } else if (total && received !== total) throw Error('The download is incomplete.');
        return part;
    };
    try {
        if (total > MAX_BYTES) throw Error('The guide exceeds the 256 MiB limit or contains an oversized field.');
        // A stream may split its signature across multiple chunks.
        let prefix = new Uint8Array();
        while (prefix.length < 6) {
            const part = await read();
            if (part.done) break;
            const next = new Uint8Array(prefix.length + part.value.length);
            next.set(prefix);
            next.set(part.value, prefix.length);
            prefix = next;
        }
        const format =
            prefix[0] === 0xfd &&
            prefix[1] === 0x37 &&
            prefix[2] === 0x7a &&
            prefix[3] === 0x58 &&
            prefix[4] === 0x5a &&
            prefix[5] === 0
                ? 'xz'
                : prefix[0] === 0x1f && prefix[1] === 0x8b
                  ? 'gzip'
                  : 'xml';
        if (signal.aborted) throw Error('EPG update stopped.');
        worker = new Worker(new URL('./import.worker.js', import.meta.url), { type: 'module' });
        const result = await new Promise((resolve, reject) => {
            let first = true,
                settled = false;
            const abort = () => finish(Error('EPG update stopped.'));
            function finish(error, result) {
                if (settled) return;
                settled = true;
                signal.removeEventListener('abort', abort);
                error ? reject(error) : resolve(result);
            }
            signal.addEventListener('abort', abort, { once: true });
            worker.onerror = () => finish(Error('Invalid or unsupported XMLTV/XZ file.'));
            worker.onmessage = async ({ data }) => {
                if (settled) return;
                if (data.type === 'pull') {
                    try {
                        const part = first ? { value: prefix, done: false } : await read();
                        first = false;
                        if (settled) return;
                        if (part.done) worker.postMessage({ type: 'chunk', done: true });
                        else {
                            const bytes = part.value.slice();
                            worker.postMessage({ type: 'chunk', buffer: bytes.buffer }, [bytes.buffer]);
                        }
                    } catch (error) {
                        finish(error);
                    }
                } else if (data.type === 'progress')
                    onProgress({ bytes: data.bytes, count: data.count, phase: 'Reading and saving the guide…' });
                else if (data.type === 'done') finish(null, data);
                else if (data.type === 'error') finish(Error(data.error));
            };
            worker.postMessage({ type: 'start', generation, format, now: Date.now(), channels });
        });
        // XZ may finish before requesting EOF; validate the underlying transfer too.
        const tail = await read();
        if (!tail.done) throw Error('Invalid or unsupported XMLTV/XZ file.');
        return result;
    } finally {
        worker?.terminate();
        await reader.cancel().catch(() => {});
        reader.releaseLock();
        await download.dispose();
    }
}
function orderedMirrors(source, record, health) {
    const state = health[source.id] || {},
        preferred = record?.url || state.preferred,
        recentFailure = (url) => Date.now() - (state.failures?.[url] || 0) < MIRROR_BACKOFF;
    return [...source.urls].sort((a, b) => {
        const delayed = Number(recentFailure(a)) - Number(recentFailure(b));
        if (delayed) return delayed;
        return Number(b === preferred) - Number(a === preferred);
    });
}

function updateMirror(health, source, url, success) {
    const state = (health[source.id] ||= { failures: {} });
    state.failures ||= {};
    if (success) {
        state.preferred = url;
        delete state.failures[url];
    } else state.failures[url] = Date.now();
}

function publishRecord(source, record) {
    epgState.update((state) => ({
        ...state,
        records: { ...state.records, [source.id]: record },
        revision: state.revision + 1,
    }));
}

function prioritizeSources(items, records, signature) {
    const language = (document.documentElement.lang || navigator.language || 'en').toLowerCase().split('-')[0],
        keywords =
            {
                bg: ['bulgaria'],
                cs: ['ceska'],
                da: ['danmark'],
                de: ['deutschland'],
                el: ['ellada'],
                en: ['uk xmltv'],
                fi: ['suomi'],
                fr: ['france'],
                hr: ['croatia'],
                it: ['italia'],
                nl: ['nederland'],
                no: ['norge'],
                pt: ['portugal'],
                ro: ['romania'],
                sk: ['slovensko'],
                sl: ['slovenia'],
                sr: ['serbia'],
                sv: ['sverige'],
            }[language] || [],
        score = (source) => {
            const record = records[source.id],
                label = `${source.group} ${source.name}`.toLowerCase();
            if (record?.channels === signature && record.count > 0) return 0;
            if (keywords.some((keyword) => label.includes(keyword))) return 1;
            if (record?.channels === signature) return 2;
            if (label.includes('general xmltv')) return 3;
            return 4;
        };
    return [...items].sort((a, b) => score(a) - score(b));
}

function usefulFailure(previous, candidate) {
    const rank = (message) => {
        if (message === 'Unable to save EPG data. Check available storage.') return 4;
        if (message === 'Invalid or unsupported XMLTV/XZ file.') return 3;
        if (message === 'The source timed out.') return 2;
        return 1;
    };
    return !previous || rank(candidate) > rank(previous) ? candidate : previous;
}

async function updateSource(source, old, signal, channels, signature, health, progress, retired) {
    let failure;
    for (const url of orderedMirrors(source, old, health)) {
        if (signal.aborted) break;
        const generation = crypto.randomUUID(),
            attempt = new AbortController();
        let timedOut = false,
            stallTimer;
        const abort = () => attempt.abort(),
            timeout = () => {
                timedOut = true;
                attempt.abort();
            },
            touch = () => {
                clearTimeout(stallTimer);
                stallTimer = setTimeout(timeout, 45000);
            },
            report = (values) => {
                touch();
                progress(source, values);
            };
        signal.addEventListener('abort', abort, { once: true });
        touch();
        const hardTimer = setTimeout(timeout, 180000);
        try {
            const cache =
                    old?.url === url && old.channels === signature
                        ? { etag: old.etag, lastModified: old.lastModified }
                        : {},
                download = await openStream(url, attempt.signal, cache, report);
            if (download.notModified) {
                const record = { ...old, updated: Date.now(), url };
                await commitSource(record);
                publishRecord(source, record);
                updateMirror(health, source, url, true);
                return null;
            }
            const result = await importStream(download, generation, attempt.signal, channels, report);
            if (signal.aborted) throw Error('EPG update stopped.');
            const record = {
                id: source.id,
                generation,
                updated: Date.now(),
                count: result.count,
                channels: signature,
                url,
                etag: download.etag || '',
                lastModified: download.lastModified || '',
            };
            await commitSource(record);
            publishRecord(source, record);
            if (old?.generation && old.generation !== generation) retired.add(old.generation);
            updateMirror(health, source, url, true);
            return null;
        } catch (error) {
            await deleteGeneration(generation).catch(() => {});
            updateMirror(health, source, url, false);
            const candidate = signal.aborted
                ? 'EPG update stopped.'
                : timedOut
                  ? 'The source timed out.'
                  : EPG_ERRORS.has(error.message)
                    ? error.message
                    : error.name === 'QuotaExceededError'
                      ? 'Unable to save EPG data. Check available storage.'
                      : 'Download failed. Check the connection and, in the browser, CORS permissions.';
            failure = usefulFailure(failure, candidate);
        } finally {
            clearTimeout(stallTimer);
            clearTimeout(hardTimer);
            signal.removeEventListener('abort', abort);
        }
    }
    return failure;
}

async function run(force) {
    await ready;
    const enabled = enabledSources(),
        records = storeValue(epgState).records,
        channels = [...channelIds],
        signature = channelSignature,
        pending = prioritizeSources(
            enabled.filter(
                (source) =>
                    force ||
                    !records[source.id] ||
                    records[source.id].channels !== signature ||
                    Date.now() - records[source.id].updated >= DAY,
            ),
            records,
            signature,
        );
    if (!channels.length || !pending.length) return;
    controller = new AbortController();
    const signal = controller.signal,
        health = loadMirrorHealth(),
        active = new Map(),
        retired = new Set();
    patch({ running: true, completed: 0, total: pending.length, errors: {}, phase: 'Downloading the guide…' });
    let completed = 0,
        cursor = 0;
    const progress = (source, values = {}) => {
        active.set(source.id, { ...active.get(source.id), source: source.name, ...values });
        const jobs = [...active.values()];
        patch({
            source: jobs.map((job) => job.source).join(' · '),
            received: jobs.reduce((sum, job) => sum + (job.received || 0), 0),
            bytes: jobs.reduce((sum, job) => sum + (job.bytes || 0), 0),
            count: jobs.reduce((sum, job) => sum + (job.count || 0), 0),
            phase: jobs.some((job) => job.phase === 'Reading and saving the guide…')
                ? 'Reading and saving the guide…'
                : 'Downloading the guide…',
        });
    };
    async function worker() {
        while (!signal.aborted) {
            const position = cursor++;
            if (position >= pending.length) return;
            const source = pending[position];
            progress(source);
            const failure = await updateSource(
                source,
                records[source.id],
                signal,
                channels,
                signature,
                health,
                progress,
                retired,
            );
            active.delete(source.id);
            if (signal.aborted) return;
            completed++;
            epgState.update((state) => ({
                ...state,
                completed,
                errors: failure ? { ...state.errors, [source.id]: failure } : state.errors,
            }));
        }
    }
    try {
        await Promise.all(Array.from({ length: Math.min(IMPORT_CONCURRENCY, pending.length) }, () => worker()));
        if (!signal.aborted && retired.size) {
            patch({ source: '', phase: 'Cleaning outdated guide data…' });
            for (const generation of retired) await deleteGeneration(generation).catch(() => {});
        }
    } finally {
        saveMirrorHealth(health);
        patch({
            running: false,
            source: '',
            phase: signal.aborted ? 'EPG update stopped.' : 'EPG update finished. Check source statuses below.',
        });
        controller = null;
    }
}
export function refreshEpg(force = true) {
    if (task) return task;
    task = run(force)
        .catch(() => patch({ running: false, phase: 'Unable to save EPG data. Check available storage.' }))
        .finally(() => {
            task = null;
            if (rerun) {
                rerun = false;
                void refreshEpg(false);
            }
        });
    return task;
}
