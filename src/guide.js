export const GUIDE_SLOT = 30 * 60 * 1000;
export const GUIDE_WINDOW = 3 * 60 * 60 * 1000;

export function guideWindowStart(now) {
    return Math.floor(now / GUIDE_SLOT) * GUIDE_SLOT - GUIDE_SLOT;
}

function inWindow(programme, from, to) {
    return programme?.end > from && programme.start < to;
}

export function schedulesByChannel(ids, custom, remote, from, to) {
    const requested = new Set(ids),
        local = new Map(),
        fallback = new Map();
    for (const programme of custom || []) {
        if (!requested.has(programme.channel) || !inWindow(programme, from, to)) continue;
        if (!local.has(programme.channel)) local.set(programme.channel, []);
        local.get(programme.channel).push(programme);
    }
    for (const programme of remote || []) {
        if (!requested.has(programme.channel) || !inWindow(programme, from, to)) continue;
        if (!fallback.has(programme.channel)) fallback.set(programme.channel, []);
        fallback.get(programme.channel).push(programme);
    }
    return new Map(
        ids.map((id) => {
            const items = local.get(id) || fallback.get(id) || [];
            return [id, items.sort((a, b) => a.start - b.start || a.end - b.end)];
        }),
    );
}

export function programmePosition(programme, from, duration = GUIDE_WINDOW) {
    const start = Math.max(programme.start, from),
        end = Math.min(programme.end, from + duration);
    return {
        left: Math.max(0, ((start - from) / duration) * 100),
        width: Math.max(0, ((end - start) / duration) * 100),
    };
}
