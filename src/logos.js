import { isNative, nativeImage } from './native.js';
const cache = new Map(),
    inflight = new Map(),
    queue = [];
let running = 0,
    bytes = 0;
const MAX_BYTES = 8 * 1024 * 1024,
    MAX_ENTRIES = 160;
function schedule(task) {
    return new Promise((resolve, reject) => {
        queue.push({ task, resolve, reject });
        pump();
    });
}
function pump() {
    while (running < 4 && queue.length) {
        const job = queue.shift();
        running++;
        Promise.resolve()
            .then(job.task)
            .then(job.resolve, job.reject)
            .finally(() => {
                running--;
                pump();
            });
    }
}
export async function loadLogo(url) {
    if (!/^https?:\/\//i.test(url)) return '';
    if (!isNative) return url;
    if (cache.has(url)) {
        const v = cache.get(url);
        cache.delete(url);
        cache.set(url, v);
        return v;
    }
    if (inflight.has(url)) return inflight.get(url);
    const result = schedule(() => nativeImage(url))
        .then((data) => {
            const value = data || '';
            cache.set(url, value);
            bytes += value.length;
            while (bytes > MAX_BYTES || cache.size > MAX_ENTRIES) {
                const key = cache.keys().next().value;
                bytes -= cache.get(key).length;
                cache.delete(key);
            }
            return value;
        })
        .catch(() => {
            return '';
        })
        .finally(() => inflight.delete(url));
    inflight.set(url, result);
    return result;
}
