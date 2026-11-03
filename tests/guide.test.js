import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GUIDE_SLOT, guideWindowStart, schedulesByChannel, programmePosition } from '../src/guide.js';

test('guide windows align to half hours and include the previous slot', () => {
    const now = Date.parse('2026-11-03T13:17:00Z');
    assert.equal(guideWindowStart(now), Date.parse('2026-11-03T12:30:00Z'));
    assert.equal(GUIDE_SLOT, 1800000);
});

test('custom schedules take priority over remote schedules per channel', () => {
    const from = 1000,
        to = 5000,
        custom = [{ channel: 'a', start: 1000, end: 2000, title: 'Custom' }],
        remote = [
            { channel: 'a', start: 1000, end: 2000, title: 'Remote' },
            { channel: 'b', start: 2000, end: 3000, title: 'Fallback' },
        ],
        schedules = schedulesByChannel(['a', 'b'], custom, remote, from, to);
    assert.deepEqual(
        schedules.get('a').map((programme) => programme.title),
        ['Custom'],
    );
    assert.deepEqual(
        schedules.get('b').map((programme) => programme.title),
        ['Fallback'],
    );
});

test('programme positions are clipped to the visible guide window', () => {
    assert.deepEqual(programmePosition({ start: 0, end: 2000 }, 1000, 4000), { left: 0, width: 25 });
    assert.deepEqual(programmePosition({ start: 3000, end: 6000 }, 1000, 4000), { left: 50, width: 50 });
});
