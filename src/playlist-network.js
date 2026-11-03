import { LocalizedError } from './i18n.js';
export function browserNetworkError(error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError')
        return new LocalizedError('The request timed out. Check your connection and try again.');
    if (error instanceof TypeError || error?.name === 'NetworkError')
        return new LocalizedError(
            'The browser cannot download the playlist. This may be caused by the connection, an invalid certificate or the source’s CORS permissions. Open the link in a new tab, save the M3U file and upload it, or use the installed app.',
        );
    return error;
}
export async function playlistResponse(url, { pageProtocol = location.protocol, fetcher = fetch } = {}) {
    if (pageProtocol === 'https:' && new URL(url).protocol === 'http:')
        throw new LocalizedError(
            'This link uses HTTP: the browser cannot download it from TucaTV’s HTTPS page. Open the link in a new tab, save the M3U file, then upload it. Alternatively, import the link in the installed app.',
        );
    try {
        const response = await fetcher(url, { signal: AbortSignal.timeout(120000) });
        if (!response.ok)
            throw new LocalizedError(
                'The source returned HTTP {status}. Check that the link is valid and access is authorized.',
                { status: response.status },
            );
        return response;
    } catch (error) {
        throw browserNetworkError(error);
    }
}
