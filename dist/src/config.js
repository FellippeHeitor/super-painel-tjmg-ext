let cache = null;
export async function paineis() {
    if (!cache) {
        const r = await fetch(chrome.runtime.getURL('config/paineis.json'));
        cache = (await r.json()).paineis;
    }
    return cache;
}
export const PREF_PADRAO = { comarca: null, comarcas: [], automatico: true, horarios: ['07:00', '09:00'] };
export async function prefs() {
    const p = await chrome.storage.local.get(Object.keys(PREF_PADRAO));
    return { ...PREF_PADRAO, ...p };
}
export const salvarPrefs = (p) => chrome.storage.local.set(p);
