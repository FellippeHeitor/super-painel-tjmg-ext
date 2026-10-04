// Tipos compartilhados: configuração dos painéis (config/paineis.json, config/site.json), jobs/resultados do engine e registros do IndexedDB.
// Só descrevem o que o código já usa; nenhum campo do Qlik é inventado aqui.
export const ehErro = (r) => !!r && 'erro' in r && !!r.erro;
