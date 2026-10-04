// Comarca escolhida e sua grafia em cada app do Qlik ("MINAS NOVAS" x "Minas Novas").
// Regra: nunca adivinhar. Compara sem acento e sem diferenciar maiúsculas; se não houver exatamente
// um valor equivalente no app, o painel não é coletado.
import type { Navegador } from './qlik.js';
import type { Painel, ResultadoCampo } from './tipos.js';
import { ehErro } from './tipos.js';

export const normalizar = (s: string | null | undefined) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase().replace(/\s+/g, ' ').trim();

// valores = textos reais do campo no app. Devolve {valor} ou {erro}.
export function resolver(comarca: string, valores: string[]): { valor: string } | { erro: string } {
  const alvo = normalizar(comarca);
  const iguais = [...new Set(valores.filter((v) => normalizar(v) === alvo))];
  if (iguais.length === 1) return { valor: iguais[0] };
  if (!iguais.length) return { erro: 'comarca não encontrada neste painel' };
  return { erro: 'mais de um valor equivalente: ' + iguais.join(' | ') };
}

// Lê os valores reais do campo no app (job 'campo' do engine).
export async function valoresDoCampo(nav: Navegador, painel: Painel, campo: string): Promise<string[]> {
  const { resultado: r } = await nav.executar(painel, { itens: [{ nome: 'valores', tipo: 'campo', campo }] });
  if ('erro' in r) throw new Error(r.erro);
  const it = r.itens.valores;
  if (ehErro(it)) throw new Error(it.erro);
  return (it as ResultadoCampo).valores.map((v) => v.txt).filter(Boolean);
}

// Grafia da comarca no app (com cache por comarca/app/campo em chrome.storage.local).
export async function grafia(nav: Navegador, painel: Painel, comarca: string, campo = painel.campoComarca, { renovar = false } = {}): Promise<string> {
  const chave = `grafia|${normalizar(comarca)}|${painel.appid}|${campo}`;
  if (!renovar) {
    const g = (await chrome.storage.local.get(chave))[chave] as string | undefined;
    if (g) return g;
  }
  const res = resolver(comarca, await valoresDoCampo(nav, painel, campo));
  if ('erro' in res) throw new Error(`${comarca}: ${res.erro} (${campo})`);
  await chrome.storage.local.set({ [chave]: res.valor });
  return res.valor;
}
