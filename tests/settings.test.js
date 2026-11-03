import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSettings, defaults } from '../src/settings.js';
test('settings validate saved values and retain existing startup defaults', () => {
    assert.deepEqual(normalizeSettings(null), defaults);
    assert.deepEqual(
        normalizeSettings({ initialView: 'invalid', initialSection: 'invalid', refreshOnStartup: 'false' }),
        defaults,
    );
    assert.deepEqual(normalizeSettings({ initialView: 'list', initialSection: 'vod', refreshOnStartup: false }), {
        initialView: 'list',
        initialSection: 'vod',
        refreshOnStartup: false,
    });
});
