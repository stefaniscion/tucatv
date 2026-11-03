import { writable, get } from 'svelte/store';
export const defaults = Object.freeze({ refreshOnStartup: true, initialView: 'catalog', initialSection: 'live' });
export function normalizeSettings(value) {
    return {
        refreshOnStartup: typeof value?.refreshOnStartup === 'boolean' ? value.refreshOnStartup : true,
        initialView: value?.initialView === 'list' ? 'list' : 'catalog',
        initialSection: value?.initialSection === 'vod' ? 'vod' : 'live',
    };
}
function read() {
    try {
        return normalizeSettings(JSON.parse(localStorage.getItem('tucatv-settings')));
    } catch {
        return { ...defaults };
    }
}
export const settings = writable(read());
export function changeSetting(key, value) {
    const next = normalizeSettings({ ...get(settings), [key]: value });
    try {
        localStorage.setItem('tucatv-settings', JSON.stringify(next));
    } catch {
        return false;
    }
    settings.set(next);
    return true;
}
