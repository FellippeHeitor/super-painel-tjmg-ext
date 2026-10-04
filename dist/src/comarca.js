import { ehErro } from './tipos.js';
export const normalizar = (s) => String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim();
// valores = textos reais do campo no app. Devolve {valor} ou {erro}.
export function resolver(comarca, valores) {
    const alvo = normalizar(comarca);
    const iguais = [...new Set(valores.filter((v) => normalizar(v) === alvo))];
    if (iguais.length === 1)
        return { valor: iguais[0] };
    if (!iguais.length)
        return { erro: 'comarca não encontrada neste painel' };
    return { erro: 'mais de um valor equivalente: ' + iguais.join(' | ') };
}
// Lê os valores reais do campo no app (job 'campo' do engine).
export async function valoresDoCampo(nav, painel, campo) {
    const { resultado: r } = await nav.executar(painel, { itens: [{ nome: 'valores', tipo: 'campo', campo }] });
    if ('erro' in r)
        throw new Error(r.erro);
    const it = r.itens.valores;
    if (ehErro(it))
        throw new Error(it.erro);
    return it.valores.map((v) => v.txt).filter(Boolean);
}
// Grafia da comarca no app (com cache por comarca/app/campo em chrome.storage.local).
export async function grafia(nav, painel, comarca, campo = painel.campoComarca, { renovar = false } = {}) {
    const chave = `grafia|${normalizar(comarca)}|${painel.appid}|${campo}`;
    if (!renovar) {
        const g = (await chrome.storage.local.get(chave))[chave];
        if (g)
            return g;
    }
    const res = resolver(comarca, await valoresDoCampo(nav, painel, campo));
    if ('erro' in res)
        throw new Error(`${comarca}: ${res.erro} (${campo})`);
    await chrome.storage.local.set({ [chave]: res.valor });
    return res.valor;
}
