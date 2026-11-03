let connection;
export function database() {
    return (connection ||= new Promise((resolve, reject) => {
        const request = indexedDB.open('tucatv-epg', 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            const programmes = db.createObjectStore('programmes', {
                keyPath: ['generation', 'channel', 'start', 'end'],
            });
            programmes.createIndex('generation', 'generation');
            programmes.createIndex('channelStart', ['channel', 'start']);
            db.createObjectStore('sources', { keyPath: 'id' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
            connection = null;
            reject(request.error);
        };
    }));
}
const complete = (tx) =>
    new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onabort = () => reject(tx.error || Error('Unable to save EPG data. Check available storage.'));
        tx.onerror = () => {};
    });
export async function metadata() {
    const db = await database();
    return new Promise((resolve, reject) => {
        const r = db.transaction('sources').objectStore('sources').getAll();
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
    });
}
export async function writeBatch(generation, items) {
    const db = await database(),
        tx = db.transaction('programmes', 'readwrite');
    const done = complete(tx);
    for (const p of items) tx.objectStore('programmes').put({ ...p, generation });
    await done;
}
export async function commitSource(source) {
    const db = await database(),
        tx = db.transaction('sources', 'readwrite');
    const done = complete(tx);
    tx.objectStore('sources').put(source);
    await done;
}
export async function deleteGeneration(generation) {
    const db = await database(),
        tx = db.transaction('programmes', 'readwrite');
    const done = complete(tx);
    const r = tx.objectStore('programmes').index('generation').openKeyCursor(IDBKeyRange.only(generation));
    r.onsuccess = () => {
        const c = r.result;
        if (c) {
            tx.objectStore('programmes').delete(c.primaryKey);
            c.continue();
        }
    };
    await done;
}
export async function cleanOrphans() {
    const active = new Set((await metadata()).map((s) => s.generation)),
        db = await database();
    const generations = await new Promise((resolve, reject) => {
        const found = [],
            r = db
                .transaction('programmes')
                .objectStore('programmes')
                .index('generation')
                .openKeyCursor(null, 'nextunique');
        r.onsuccess = () => {
            const c = r.result;
            if (c) {
                found.push(c.key);
                c.continue();
            } else resolve(found);
        };
        r.onerror = () => reject(r.error);
    });
    for (const generation of generations) if (!active.has(generation)) await deleteGeneration(generation);
}
export async function clearGuides() {
    const db = await database(),
        tx = db.transaction(['programmes', 'sources'], 'readwrite');
    const done = complete(tx);
    tx.objectStore('programmes').clear();
    tx.objectStore('sources').clear();
    await done;
}
// Only current/next programmes for requested channel IDs reach the UI.
export async function lookupGuide(ids, enabled, now = Date.now()) {
    const meta = await metadata(),
        rank = new Map(enabled.map((id, i) => [id, i]));
    const generations = new Map(meta.filter((s) => rank.has(s.id)).map((s) => [s.generation, rank.get(s.id)]));
    if (!generations.size) return [];
    const db = await database(),
        result = [];
    const unique = [...new Set(ids.filter(Boolean))];
    for (let offset = 0; offset < unique.length; offset += 100) {
        const tx = db.transaction('programmes'),
            index = tx.objectStore('programmes').index('channelStart');
        await Promise.all(
            unique.slice(offset, offset + 100).map(
                (id) =>
                    new Promise((resolve, reject) => {
                        let current,
                            next,
                            currentRank = Infinity,
                            nextRank = Infinity;
                        const r = index.openCursor(IDBKeyRange.bound([id, now - 86400000], [id, now + 14 * 86400000]));
                        r.onsuccess = () => {
                            const cursor = r.result;
                            if (!cursor) {
                                if (current) result.push(current);
                                if (next) result.push(next);
                                resolve();
                                return;
                            }
                            const p = cursor.value,
                                priority = generations.get(p.generation);
                            if (priority !== undefined) {
                                if (p.start <= now && p.end > now && priority < currentRank) {
                                    current = p;
                                    currentRank = priority;
                                }
                                if (
                                    p.start > now &&
                                    (priority < nextRank || (priority === nextRank && p.start < next.start))
                                ) {
                                    next = p;
                                    nextRank = priority;
                                }
                            }
                            cursor.continue();
                        };
                        r.onerror = () => reject(r.error);
                    }),
            ),
        );
    }
    return result;
}

// Return one bounded schedule per channel, using the first enabled source that
// contains programmes in the requested window. The UI controls both the channel
// batch and the time range, so a complete multi-day guide is never materialised.
export async function lookupSchedule(ids, enabled, from, to) {
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return [];
    const meta = await metadata(),
        rank = new Map(enabled.map((id, i) => [id, i]));
    const generations = new Map(meta.filter((s) => rank.has(s.id)).map((s) => [s.generation, rank.get(s.id)]));
    if (!generations.size) return [];
    const unique = [...new Set(ids.filter(Boolean))],
        db = await database(),
        result = [];
    for (let offset = 0; offset < unique.length; offset += 100) {
        const tx = db.transaction('programmes'),
            index = tx.objectStore('programmes').index('channelStart');
        await Promise.all(
            unique.slice(offset, offset + 100).map(
                (id) =>
                    new Promise((resolve, reject) => {
                        let selectedRank = Infinity,
                            items = [];
                        const request = index.openCursor(
                            IDBKeyRange.bound([id, from - 86400000], [id, to], false, true),
                        );
                        request.onsuccess = () => {
                            const cursor = request.result;
                            if (!cursor) {
                                result.push(...items);
                                resolve();
                                return;
                            }
                            const programme = cursor.value,
                                priority = generations.get(programme.generation);
                            if (priority !== undefined && programme.end > from && programme.start < to) {
                                if (priority < selectedRank) {
                                    selectedRank = priority;
                                    items = [programme];
                                } else if (priority === selectedRank) items.push(programme);
                            }
                            cursor.continue();
                        };
                        request.onerror = () => reject(request.error);
                    }),
            ),
        );
    }
    const order = new Map(unique.map((id, index) => [id, index]));
    return result.sort((a, b) => order.get(a.channel) - order.get(b.channel) || a.start - b.start);
}
