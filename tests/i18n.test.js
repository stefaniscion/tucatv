import { test } from 'node:test';
import assert from 'node:assert/strict';
import { get } from 'svelte/store';
import {
    dictionaries,
    resolveLocale,
    translate,
    message,
    LocalizedError,
    locale,
    languagePreference,
} from '../src/i18n.js';

test('locale uses a saved preference, then a supported device language, then English', () => {
    assert.equal(get(languagePreference), 'device');
    assert.equal(resolveLocale('it', ['en-US']), 'it');
    assert.equal(resolveLocale(null, ['fr-FR', 'it-IT']), 'it');
    assert.equal(resolveLocale('invalid', ['en_GB']), 'en');
    assert.equal(resolveLocale(null, ['ja-JP']), 'en');
});
test('catalogues have matching keys and interpolation parameters', () => {
    assert.deepEqual(Object.keys(dictionaries.it).sort(), Object.keys(dictionaries.en).sort());
    assert.ok(Object.entries(dictionaries.en).every(([key, value]) => key === value));
    for (const [key, value] of Object.entries(dictionaries.it)) {
        const params = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
        assert.ok(dictionaries.en[key].trim(), key);
        assert.deepEqual(params(value), params(dictionaries.en[key]), key);
    }
});
test('structured messages and errors translate at render time without changing parameters', () => {
    const source = message('Refresh failed: {error}', {
        error: message('Incomplete download: size differs from the declared size.'),
    });
    assert.match(translate(source, {}, 'en'), /^Refresh failed: Incomplete download/);
    assert.match(translate(source, {}, 'it'), /^Aggiornamento fallito: Download incompleto/);
    const error = new LocalizedError('The source exceeds the {limit} limit.', { limit: '256 MB' });
    locale.set('en');
    assert.equal(translate(error.i18n), 'The source exceeds the 256 MB limit.');
    locale.set('it');
    assert.equal(translate('A provider title', {}, 'en'), 'A provider title');
});

test('numeric parameters follow the selected locale and unknown keys are safe', () => {
    assert.equal(translate(message('Channels found: {count}', { count: 12345 }), {}, 'en'), 'Channels found: 12,345');
    assert.equal(translate(message('Channels found: {count}', { count: 12345 }), {}, 'it'), '12.345 canali trovati');
    assert.equal(translate('constructor', {}, 'en'), 'constructor');
});
