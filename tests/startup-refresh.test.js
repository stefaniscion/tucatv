import { test } from 'node:test';
import assert from 'node:assert/strict';
import { refreshAtStartup } from '../src/startup-refresh.js';
test('startup refresh prioritizes active URL, excludes files, serializes and continues after failure', async () => {
    const lists = [
            { id: 'a', source: 'url-a' },
            { id: 'file', source: '' },
            { id: 'b', source: 'url-b' },
            { id: 'c', source: 'url-c' },
        ],
        seen = [];
    let inFlight = 0;
    const result = await refreshAtStartup(lists, 'b', async (p, position) => {
        assert.equal(inFlight++, 0);
        seen.push([p.id, position.index, position.total]);
        await Promise.resolve();
        inFlight--;
        if (p.id === 'b') throw Error('offline');
    });
    assert.deepEqual(seen, [
        ['b', 1, 3],
        ['a', 2, 3],
        ['c', 3, 3],
    ]);
    assert.deepEqual(result, { updated: 2, failed: 1 });
});
test('offline/local-only startup has no network refreshes', async () => {
    let calls = 0;
    assert.deepEqual(await refreshAtStartup([{ source: '' }], '', () => calls++), { updated: 0, failed: 0 });
    assert.equal(calls, 0);
});
