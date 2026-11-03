import { test } from 'node:test';
import assert from 'node:assert/strict';
import { queueChunks, playNativeQueue } from '../src/playback-queue.js';

test('large queues preserve all channels and bound bridge messages by bytes and count', () => {
    const channels = Array.from({ length: 12001 }, (_, i) => ({
        url: 'https://example.test/' + i,
        name: 'Canale ' + i,
    }));
    const chunks = [...queueChunks(channels)];
    assert.deepEqual(
        chunks.flat().map((c) => c.url),
        channels.map((c) => c.url),
    );
    for (const chunk of chunks) {
        assert.ok(chunk.length <= 100);
        assert.ok(Buffer.byteLength(JSON.stringify(chunk)) <= 131074);
    }
    const long = Array.from({ length: 100 }, () => ({
        url: 'https://example.test/' + 'x'.repeat(8000),
        name: 'Città',
    }));
    assert.ok([...queueChunks(long)].length > 1);
});

test('native play uploads the complete queue before play and releases the handle', async () => {
    const calls = [];
    const call = async (method, payload) => {
        calls.push([method, payload]);
        return { handle: 'test' };
    };
    await playNativeQueue(call, {
        queue: Array.from({ length: 205 }, (_, i) => ({ url: 'https://x/' + i, name: 'N' })),
        index: 204,
        playlistId: 'owner',
    });
    assert.deepEqual(
        calls.map((c) => c[0]),
        ['beginQueue', 'appendQueue', 'appendQueue', 'appendQueue', 'play', 'closeQueue'],
    );
    assert.equal(calls[4][1].index, 204);
    assert.equal(calls[4][1].queueHandle, 'test');
    assert.equal(calls[4][1].playlistId, 'owner');
});

test('upload failure disposes the queue and never starts playback', async () => {
    const calls = [];
    await assert.rejects(
        playNativeQueue(
            async (method) => {
                calls.push(method);
                if (method === 'appendQueue') throw Error('disk full');
                return { handle: 'test' };
            },
            { queue: [{ url: 'https://x/1' }] },
        ),
        /disk full/,
    );
    assert.deepEqual(calls, ['beginQueue', 'appendQueue', 'closeQueue']);
});
