import { XzReadableStream } from 'xz-decompress';
import { xmltvParser } from './xmltv.js';
import { writeBatch } from './database.js';
let receive;
const IMPORT_ERRORS = new Set([
    'Invalid or unsupported XMLTV/XZ file.',
    'The guide contains no valid programmes.',
    'The guide contains no recent programmes.',
    'Unable to save EPG data. Check available storage.',
    'The guide exceeds the 256 MiB limit or contains an oversized field.',
]);
self.onmessage = async ({ data }) => {
    if (data.type === 'chunk') {
        receive?.(data);
        receive = null;
        return;
    }
    if (data.type !== 'start') return;
    let reader;
    try {
        const raw = new ReadableStream(
            {
                async pull(controller) {
                    const chunk = await new Promise((resolve) => {
                        receive = resolve;
                        self.postMessage({ type: 'pull' });
                    });
                    if (chunk.error) controller.error(Error(chunk.error));
                    else if (chunk.done) controller.close();
                    else controller.enqueue(new Uint8Array(chunk.buffer));
                },
            },
            { highWaterMark: 0 },
        );
        // The main thread detects compression by magic bytes, not URL suffixes.
        const stream =
            data.format === 'xz'
                ? new XzReadableStream(raw)
                : data.format === 'gzip'
                  ? raw.pipeThrough(new DecompressionStream('gzip'))
                  : raw;
        reader = stream.getReader();
        const decoder = new TextDecoder('utf-8', { fatal: true });
        let bytes = 0,
            batch = [],
            retained = 0;
        const parser = xmltvParser((p) => batch.push(p), {
            now: data.now,
            channels: new Set(data.channels),
        });
        const flush = async () => {
            if (batch.length) {
                retained += batch.length;
                await writeBatch(data.generation, batch);
                batch = [];
            }
            self.postMessage({ type: 'progress', bytes, count: retained });
        };
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            if (bytes > 256 * 1024 * 1024)
                throw Error('The guide exceeds the 256 MiB limit or contains an oversized field.');
            for (let i = 0; i < value.length; i += 65536) {
                parser.write(decoder.decode(value.subarray(i, i + 65536), { stream: true }));
                if (batch.length >= 2000) await flush();
            }
        }
        parser.write(decoder.decode());
        const parsed = parser.close();
        await flush();
        // A valid source with no matching tvg-id is still a successful import.
        // Recording it prevents downloading the same irrelevant source every hour.
        self.postMessage({ type: 'done', count: retained, parsed, bytes });
    } catch (error) {
        self.postMessage({
            type: 'error',
            error:
                error.name === 'QuotaExceededError'
                    ? 'Unable to save EPG data. Check available storage.'
                    : IMPORT_ERRORS.has(error.message)
                      ? error.message
                      : 'Invalid or unsupported XMLTV/XZ file.',
        });
    } finally {
        reader?.releaseLock();
    }
};
