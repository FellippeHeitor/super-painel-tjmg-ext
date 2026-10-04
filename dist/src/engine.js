"use strict";
// Content script da página do Qlik (world MAIN, todos os frames). Executa um "job" na Engine API (WebSocket próprio, só leitura).
// Portado de super-painel-tjmg/app/engine.js. A página da extensão que roda a coleta (src/qlik.ts) embute o Qlik num iframe
// invisível e conversa com este script por postMessage: {tipo:'ws'} (URL anotada por gancho-ws.ts), {tipo:'job'}, {tipo:'dialogo'}.
// Script clássico (não módulo): sem import/export; tipos só por import('./tipos.js').
// job = {sheet, selecoes:[[campo,valor,estado?]], dinamicos:[{campo,tipo:'ultimo'}],
//        itens:[{nome, tipo:'valor'|'serie'|'cubo'|'tabela'|'prop'|'exprs'|'campo', ...}], timeout_ms?}
// Resultado: {selecoes:[{campo,valor,ok}], itens:{nome: resultado | {erro}}} ou {erro}
(() => {
    const engine = (wsurl, job) => new Promise((res) => {
        let feito = false, id = 0;
        const p = {};
        const fim = (r) => { if (!feito) {
            feito = true;
            clearTimeout(lim);
            try {
                ws.close();
            }
            catch (e) { }
            res(r);
        } };
        const lim = setTimeout(() => fim({ erro: 'timeout' }), job.timeout_ms || 240000);
        const ws = new WebSocket(wsurl);
        const call = (h, m, pr) => new Promise((r) => {
            const i = ++id;
            p[i] = r;
            ws.send(JSON.stringify({ jsonrpc: '2.0', id: i, handle: h, method: m, params: pr }));
        });
        ws.onmessage = (e) => { const d = JSON.parse(e.data); if (d.id && p[d.id])
            p[d.id](d); };
        ws.onerror = () => fim({ erro: 'ws_erro' });
        ws.onclose = () => fim({ erro: 'ws_fechado' });
        const num = (c) => (c && typeof c.qNum === 'number' && isFinite(c.qNum)) ? c.qNum : null;
        const cel = (c) => ({ txt: c ? c.qText : null, num: num(c) });
        let H;
        const varAtual = {};
        const layout = async (h) => { const l = await call(h, 'GetLayout', []); if (!l.result)
            throw new Error('GetLayout: ' + JSON.stringify(l.error)); return l.result.qLayout; };
        const sessao = async (def) => { const o = await call(H, 'CreateSessionObject', [def]); if (!o.result)
            throw new Error('CreateSessionObject: ' + JSON.stringify(o.error)); return o.result.qReturn.qHandle; };
        // objetos de uma sheet (com layout)
        const cacheSheet = {};
        const objetos = async (sheetId) => {
            if (cacheSheet[sheetId])
                return cacheSheet[sheetId];
            const so = await call(H, 'GetObject', [sheetId]);
            if (!so.result || !so.result.qReturn.qHandle)
                throw new Error('sheet nao encontrada: ' + sheetId);
            const sl = await layout(so.result.qReturn.qHandle);
            const lista = [];
            for (const c of (sl.cells || [])) {
                const o = await call(H, 'GetObject', [c.name]);
                if (!o.result || !o.result.qReturn.qHandle)
                    continue;
                const h = o.result.qReturn.qHandle;
                let L;
                try {
                    L = await layout(h);
                }
                catch (e) {
                    continue;
                }
                const hc = L.qHyperCube || {};
                lista.push({ id: c.name, tipo: c.type, h, L, hc,
                    titulo: String(L.title || (L.qMeta && L.qMeta.title) || ''),
                    dims: (hc.qDimensionInfo || []).map((d) => d.qFallbackTitle),
                    meds: (hc.qMeasureInfo || []).map((m) => m.qFallbackTitle) });
            }
            return (cacheSheet[sheetId] = lista);
        };
        const tem = (lista, sub) => (lista || []).findIndex((x) => String(x).toLowerCase().includes(String(sub).toLowerCase()));
        const igual = (lista, v) => (lista || []).findIndex((x) => String(x).trim().toLowerCase() === String(v).trim().toLowerCase());
        const idxMedida = (o, m) => m.medida !== undefined ? igual(o.meds, m.medida) : (m.medida_contem !== undefined ? tem(o.meds, m.medida_contem) : -2);
        const acha = (lista, m) => {
            const c = lista.filter((o) => {
                if (m.objeto && o.tipo !== m.objeto)
                    return false;
                if (m.titulo_contem !== undefined && !o.titulo.toLowerCase().includes(m.titulo_contem.toLowerCase()))
                    return false;
                if (m.dimensao !== undefined && igual(o.dims, m.dimensao) < 0)
                    return false;
                if (m.dimensao_contem !== undefined && tem(o.dims, m.dimensao_contem) < 0)
                    return false;
                const im = idxMedida(o, m);
                if (im === -1)
                    return false;
                return true;
            });
            return { obj: c[m.n || 0], total: c.length };
        };
        // cubo próprio (modo reto) a partir das propriedades de um objeto existente
        const cuboDoObjeto = async (o, maxLinhas) => {
            const pr = await call(o.h, 'GetProperties', []);
            if (!pr.result.qProp.qHyperCubeDef) { // objeto sem definição de cubo nas propriedades: lê pelo próprio layout/dados do objeto
                const hc0 = o.hc || {}, w0 = (hc0.qSize && hc0.qSize.qcx) || 0, tot0 = (hc0.qSize && hc0.qSize.qcy) || 0, linhas0 = [];
                const colunas0 = (hc0.qDimensionInfo || []).map((d) => d.qFallbackTitle).concat((hc0.qMeasureInfo || []).map((m) => m.qFallbackTitle));
                for (let top = 0; top < Math.min(tot0, maxLinhas); top += 500) {
                    const d0 = await call(o.h, 'GetHyperCubeData', ['/qHyperCubeDef', [{ qTop: top, qLeft: 0, qHeight: Math.min(500, maxLinhas - top), qWidth: Math.max(w0, 1) }]]);
                    if (!d0.result)
                        throw new Error('sem qHyperCubeDef e sem dados no layout: ' + JSON.stringify(d0.error));
                    for (const r of d0.result.qDataPages[0].qMatrix)
                        linhas0.push(r);
                }
                return { colunas: colunas0, nd: (hc0.qDimensionInfo || []).length, total: tot0, linhas: linhas0 };
            }
            const def = JSON.parse(JSON.stringify(pr.result.qProp.qHyperCubeDef));
            def.qMode = 'S';
            delete def.qNoOfLeftDims;
            def.qAlwaysFullyExpanded = false;
            const nd = (def.qDimensions || []).length, nm = (def.qMeasures || []).length, w = nd + nm;
            const h = await sessao({ qInfo: { qId: 'c' + (++id), qType: 'c' }, qHyperCubeDef: def });
            const L = await layout(h);
            const hc = L.qHyperCube;
            // colunas ocultas por condição (qError / sem título) não vêm nos dados: não rotular, senão os cabeçalhos deslocam
            const visiveis = (l) => (l || []).filter((x) => !x.qError && x.qFallbackTitle);
            let colunas = visiveis(hc.qDimensionInfo).map((d) => d.qFallbackTitle).concat(visiveis(hc.qMeasureInfo).map((m) => m.qFallbackTitle));
            if (colunas.length !== hc.qSize.qcx)
                colunas = (hc.qDimensionInfo || []).map((d) => d.qFallbackTitle).concat((hc.qMeasureInfo || []).map((m) => m.qFallbackTitle));
            const total = hc.qSize.qcy, lw = hc.qSize.qcx || w;
            const linhas = [], passo = Math.max(1, Math.floor(9000 / Math.max(lw, 1)));
            for (let top = 0; top < Math.min(total, maxLinhas); top += passo) {
                const d = await call(h, 'GetHyperCubeData', ['/qHyperCubeDef', [{ qTop: top, qLeft: 0, qHeight: Math.min(passo, maxLinhas - top), qWidth: lw }]]);
                if (!d.result)
                    throw new Error('GetHyperCubeData: ' + JSON.stringify(d.error));
                for (const r of d.result.qDataPages[0].qMatrix)
                    linhas.push(r);
            }
            return { colunas, nd: visiveis(hc.qDimensionInfo).length === colunas.length - visiveis(hc.qMeasureInfo).length ? visiveis(hc.qDimensionInfo).length : nd, total, linhas };
        };
        // quantos valores do campo estão selecionados (0 => o filtro não pegou: números seriam do estado inteiro)
        const nSel = async (campo, estado) => {
            const h = await sessao({ qInfo: { qId: 's' + (++id), qType: 's' }, qHyperCubeDef: { qMeasures: [{ qDef: { qDef: estado ? ("GetSelectedCount([" + campo + "], False(), '" + estado + "')") : ('GetSelectedCount([' + campo + '])') } }],
                    qInitialDataFetch: [{ qTop: 0, qLeft: 0, qHeight: 1, qWidth: 1 }] } });
            const L = await layout(h);
            return L.qHyperCube.qDataPages[0].qMatrix[0][0].qNum;
        };
        const tratar = {
            valor: async (it, sheetId) => {
                const lista = await objetos(sheetId);
                const { obj, total } = acha(lista, it);
                if (!obj)
                    return { erro: 'objeto nao encontrado', candidatos: total };
                let mi = idxMedida(obj, it);
                if (mi < 0)
                    mi = 0;
                const nd = obj.dims.length;
                const gt = obj.hc.qGrandTotalRow && obj.hc.qGrandTotalRow[mi];
                if (gt && gt.qText !== undefined && gt.qText !== '')
                    return cel(gt);
                let m = obj.hc.qDataPages && obj.hc.qDataPages[0] ? obj.hc.qDataPages[0].qMatrix : null;
                if (!m || !m.length) {
                    if (!obj.hc.qSize || obj.hc.qSize.qcy < 1)
                        return { erro: 'sem dados (objeto vazio com os filtros atuais)' };
                    const d = await call(obj.h, 'GetHyperCubeData', ['/qHyperCubeDef', [{ qTop: 0, qLeft: 0, qHeight: 1, qWidth: Math.min(obj.hc.qSize.qcx, 20) }]]);
                    m = d.result.qDataPages[0].qMatrix;
                }
                return m[0] ? cel(m[0][nd + mi]) : { erro: 'sem linhas' };
            },
            serie: async (it, sheetId) => {
                const lista = await objetos(sheetId);
                const { obj, total } = acha(lista, it);
                if (!obj)
                    return { erro: 'objeto nao encontrado', candidatos: total };
                const c = await cuboDoObjeto(obj, it.max_linhas || 1000);
                let mi = idxMedida(obj, it);
                if (mi < 0)
                    mi = 0;
                return { dimensoes: c.colunas.slice(0, c.nd), medida: c.colunas[c.nd + mi], total: c.total,
                    linhas: c.linhas.map((r) => ({ r: r.slice(0, c.nd).map((x) => x.qText), v: cel(r[c.nd + mi]) })) };
            },
            cubo: async (it) => {
                const medidas = it.medidas || [];
                const nd = (it.dimensoes || []).length, w = nd + medidas.length;
                const h = await sessao({ qInfo: { qId: 'k' + (++id), qType: 'k' }, qHyperCubeDef: {
                        qDimensions: (it.dimensoes || []).map((d) => ({ qDef: { qFieldDefs: [d] } })),
                        qMeasures: medidas.map((m) => ({ qDef: { qDef: m } })),
                        qInitialDataFetch: [{ qTop: 0, qLeft: 0, qHeight: 1, qWidth: w }]
                    } });
                const L0 = await layout(h);
                const total = L0.qHyperCube.qSize.qcy, max = Math.min(total, it.max_linhas || 20000), passo = Math.max(1, Math.floor(9000 / w));
                const linhas = [];
                for (let top = 0; top < max; top += passo) {
                    const d = await call(h, 'GetHyperCubeData', ['/qHyperCubeDef', [{ qTop: top, qLeft: 0, qHeight: Math.min(passo, max - top), qWidth: w }]]);
                    if (!d.result)
                        throw new Error('GetHyperCubeData: ' + JSON.stringify(d.error));
                    for (const r of d.result.qDataPages[0].qMatrix)
                        linhas.push(r.map(cel));
                }
                return { total, linhas };
            },
            // texto de objetos (ex.: markdown de text-image); it.objeto = tipo, it.contem = trecho a procurar, it.prop = propriedade (padrão 'markdown')
            prop: async (it, sheetId) => {
                const lista = await objetos(it.sheet || sheetId), chave = it.prop || 'markdown';
                for (const o of lista.filter((x) => !it.objeto || x.tipo === it.objeto)) {
                    const pr = await call(o.h, 'GetProperties', []), v = pr.result && pr.result.qProp && pr.result.qProp[chave];
                    if (typeof v === 'string' && (!it.contem || v.toLowerCase().includes(String(it.contem).toLowerCase())))
                        return { txt: v };
                }
                return { erro: 'texto nao encontrado' };
            },
            // valores das expressões numéricas dos advanced-kpi de uma sheet (as mesmas que o painel exibe), com os filtros atuais
            exprs: async (it, sheetId) => {
                const lista = await objetos(it.sheet || sheetId), vistas = new Set(), saida = [];
                const achar = (o, acc) => { if (o == null)
                    return; if (typeof o === 'string') {
                    acc.push(o);
                    return;
                } if (typeof o === 'object')
                    for (const k of Object.keys(o))
                        achar(o[k], acc); };
                for (const o of lista.filter((x) => x.tipo === (it.objeto || 'advanced-kpi'))) {
                    const pr = await call(o.h, 'GetProperties', []), tudo = [];
                    achar(pr.result.qProp, tudo);
                    for (const e of tudo.filter((t) => /^\s*=/.test(t) && /sum\(|count\(|avg\(/i.test(t) && !/background-/i.test(t))) {
                        const expr = e.replace(/^\s*=/, '');
                        if (vistas.has(expr))
                            continue;
                        vistas.add(expr);
                        try {
                            const h = await sessao({ qInfo: { qId: 'e' + (++id), qType: 'e' }, qHyperCubeDef: { qMeasures: [{ qDef: { qDef: expr } }], qInitialDataFetch: [{ qTop: 0, qLeft: 0, qHeight: 1, qWidth: 1 }] } });
                            const c = (await layout(h)).qHyperCube.qDataPages[0].qMatrix[0][0];
                            saida.push({ expr, txt: c.qText, num: num(c), titulo: o.titulo });
                        }
                        catch (err) { /* expressão que não avalia neste contexto: ignora */ }
                    }
                }
                return { itens: saida };
            },
            // valores de um campo (ex.: lista de comarcas). it.campo; it.estado opcional. Campo inexistente => erro (nunca adivinhar).
            campo: async (it) => {
                const h = await sessao({ qInfo: { qId: 'f' + (++id), qType: 'f' }, qListObjectDef: { qStateName: it.estado || '', qDef: { qFieldDefs: [it.campo] },
                        qInitialDataFetch: [{ qTop: 0, qLeft: 0, qHeight: 0, qWidth: 0 }] } });
                const L = (await layout(h)).qListObject;
                if (L.qDimensionInfo && L.qDimensionInfo.qError)
                    throw new Error('campo nao existe no painel: ' + it.campo);
                const total = L.qSize.qcy, max = Math.min(total, it.max_linhas || 20000), valores = [];
                for (let top = 0; top < max; top += 5000) {
                    const d = await call(h, 'GetListObjectData', ['/qListObjectDef', [{ qTop: top, qLeft: 0, qHeight: Math.min(5000, max - top), qWidth: 1 }]]);
                    if (!d.result)
                        throw new Error('GetListObjectData: ' + JSON.stringify(d.error));
                    for (const r of d.result.qDataPages[0].qMatrix)
                        valores.push({ txt: r[0].qText, estado: r[0].qState });
                }
                return { total, valores };
            },
            tabela: async (it, sheetId) => {
                const lista = await objetos(it.sheet || sheetId);
                const { obj, total } = acha(lista, it);
                if (!obj)
                    return { erro: 'objeto nao encontrado', candidatos: total };
                const c = await cuboDoObjeto(obj, it.max_linhas || 200000);
                return { colunas: c.colunas, total: c.total, linhas: c.linhas.map((r) => r.map((x) => x.qText)) };
            },
        };
        ws.onopen = async () => {
            try {
                await new Promise((r) => setTimeout(r, 500));
                const od = await call(-1, 'OpenDoc', [wsurl.split('/app/')[1].split('?')[0]]);
                if (od.error)
                    return fim({ erro: 'OpenDoc: ' + JSON.stringify(od.error) });
                H = od.result.qReturn.qHandle;
                const out = { selecoes: [], itens: {} };
                for (const [campo, valor, estado] of (job.selecoes || [])) {
                    const f = await call(H, 'GetField', estado ? [campo, estado] : [campo]);
                    // valor em lista => seleção por valor exato (evita que '> 30 dias' seja lido como busca numérica)
                    const s = f.result ? (Array.isArray(valor)
                        ? await call(f.result.qReturn.qHandle, 'SelectValues', [valor.map((v) => ({ qText: v })), false, false])
                        : await call(f.result.qReturn.qHandle, 'Select', [valor, false, 0])) : null;
                    out.selecoes.push({ campo, valor, ok: !!(s && s.result && s.result.qReturn) && (await nSel(campo, estado)) >= 1 });
                }
                for (const d of (job.dinamicos || [])) {
                    // 'ultimo': maior valor numérico entre os possíveis (respeita seleções anteriores)
                    const lh = await sessao({ qInfo: { qId: 'd' + (++id), qType: 'd' }, qListObjectDef: { qStateName: d.estado || '', qDef: { qFieldDefs: [d.campo] },
                            qInitialDataFetch: [{ qTop: 0, qLeft: 0, qHeight: 1000, qWidth: 1 }] } });
                    const L = (await layout(lh)).qListObject;
                    // ordena por valor numérico; se o campo for texto dd/mm/aaaa, pela data
                    const chave = (c) => { if (num(c) !== null)
                        return c.qNum; const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(c.qText || ''); return m ? (+m[3]) * 10000 + (+m[2]) * 100 + (+m[1]) : null; };
                    const cands = ((L.qDataPages[0] || { qMatrix: [] }).qMatrix).map((r) => r[0]).filter((c) => c.qState !== 'X' && chave(c) !== null);
                    if (!cands.length) {
                        out.selecoes.push({ campo: d.campo, valor: null, ok: false, dinamico: true });
                        continue;
                    }
                    cands.sort((a, b) => chave(b) - chave(a));
                    await call(lh, 'SelectListObjectValues', ['/qListObjectDef', [cands[0].qElemNumber], false]);
                    out.selecoes.push({ campo: d.campo, valor: cands[0].qText, ok: (await nSel(d.campo, d.estado)) >= 1, dinamico: true });
                }
                for (const it of (job.itens || [])) {
                    try {
                        let mudou = false;
                        for (const [nome, valor] of Object.entries(it.variaveis || {})) { // variáveis do painel (ex.: vTipoMeta8 escolhe a sub-aba); só valem nesta sessão
                            if (varAtual[nome] === Number(valor))
                                continue; // só mexe quando o valor muda (cada mudança obriga a reler os objetos da aba)
                            const vv = await call(H, 'GetVariableByName', [nome]);
                            if (!vv.result)
                                throw new Error('variavel nao encontrada: ' + nome);
                            const sv = await call(vv.result.qReturn.qHandle, 'SetNumValue', [Number(valor)]);
                            if (sv.error)
                                throw new Error('variavel ' + nome + ': ' + JSON.stringify(sv.error));
                            varAtual[nome] = Number(valor);
                            mudou = true;
                        }
                        if (mudou)
                            for (const k of Object.keys(cacheSheet))
                                delete cacheSheet[k]; // layouts guardados ficam velhos depois de mudar a variável
                        out.itens[it.nome] = await tratar[it.tipo](it, (it.sheet || job.sheet));
                    }
                    catch (e) {
                        out.itens[it.nome] = { erro: String(e.message || e) };
                    }
                }
                fim(out);
            }
            catch (e) {
                fim({ erro: String(e.message || e) });
            }
        };
    });
    // Diálogo "Conexão perdida... atualizar para continuar": clica em "Atualizar". true se clicou.
    function tratarDialogo() {
        const texto = document.body ? document.body.innerText : '';
        if (!/conex[ãa]o perdida|connection lost|atualizar para continuar/i.test(texto))
            return false;
        const bt = [...document.querySelectorAll('button')].find((b) => /^\s*(atualizar|refresh)\s*$/i.test(b.textContent || ''));
        if (bt) {
            bt.click();
            return true;
        }
        return false;
    }
    // Só atende quando esta página é o iframe de uma página de extensão (nunca o Qlik aberto normalmente numa aba,
    // nem os iframes internos do próprio Qlik). O world MAIN não sabe o ID da extensão; a origem é conferida pelo prefixo.
    window.addEventListener('message', async (e) => {
        if (window === window.top || e.source !== window.parent || !/^chrome-extension:\/\//.test(e.origin))
            return;
        const m = e.data;
        if (!m || m.superPainel !== 1)
            return;
        let resposta;
        try {
            if (m.tipo === 'ws')
                resposta = (window.__superPainelWs || []).find((x) => x.includes('/app/' + m.appid)) || null;
            else if (m.tipo === 'dialogo')
                resposta = tratarDialogo();
            else if (m.tipo === 'job')
                resposta = await engine(m.ws, m.job);
            else
                return;
        }
        catch (err) {
            resposta = { erro: String(err.message || err) };
        }
        window.parent.postMessage({ superPainel: 1, id: m.id, resposta }, e.origin);
    });
})();
