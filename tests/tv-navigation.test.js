import { test } from 'node:test';
import assert from 'node:assert/strict';
import { directionalTarget, pageWindow } from '../src/tv-navigation.js';
const rect = (x, y, width = 100, height = 50) => ({ x, y, width, height });
test('directional focus follows aligned rows and columns and stops at edges', () => {
    const current = rect(100, 100),
        candidates = [
            { id: 'up', rect: rect(100, 0) },
            { id: 'right', rect: rect(220, 100) },
            { id: 'diagonal', rect: rect(210, 140) },
            { id: 'down', rect: rect(100, 230) },
        ];
    assert.equal(directionalTarget(current, candidates, 'ArrowRight').id, 'right');
    assert.equal(directionalTarget(current, candidates, 'ArrowDown').id, 'down');
    assert.equal(directionalTarget(current, candidates, 'ArrowUp').id, 'up');
    assert.equal(directionalTarget(current, candidates, 'ArrowLeft'), null);
});
test('TV pages remain bounded and recover from shrinking playlist', () => {
    assert.deepEqual(pageWindow(140000, 0), { index: 0, pages: 5834, start: 0, end: 24 });
    assert.deepEqual(pageWindow(25, 9), { index: 1, pages: 2, start: 24, end: 25 });
    assert.deepEqual(pageWindow(0, 99), { index: 0, pages: 1, start: 0, end: 0 });
});
