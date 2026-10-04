// Gera um .xlsx (uma aba) no próprio navegador, sem biblioteca externa (CSP do MV3) e sem enviar nada a servidor.
// ZIP sem compressão (método "stored") + o mínimo do OOXML: cabeçalho em negrito, congelado e com autofiltro.
// Textos vão como inlineStr (sem sharedStrings); números como número (ex.: "Dias" ordena e soma no Excel/Planilhas).
// ---------- ZIP ----------
const TABELA_CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++)
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();
function crc32(dados) {
    let c = 0xffffffff;
    for (let i = 0; i < dados.length; i++)
        c = TABELA_CRC[(c ^ dados[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}
function zip(arquivos) {
    const enc = new TextEncoder();
    const partes = [], central = [];
    let pos = 0;
    for (const [nome, conteudo] of arquivos) {
        const n = enc.encode(nome), d = enc.encode(conteudo), crc = crc32(d);
        const local = new DataView(new ArrayBuffer(30));
        local.setUint32(0, 0x04034b50, true);
        local.setUint16(4, 20, true);
        local.setUint16(6, 0x0800, true); // versão 2.0; nomes em UTF-8
        local.setUint16(8, 0, true);
        local.setUint16(10, 0, true);
        local.setUint16(12, 0x21, true); // stored; data/hora DOS 01/01/1980
        local.setUint32(14, crc, true);
        local.setUint32(18, d.length, true);
        local.setUint32(22, d.length, true);
        local.setUint16(26, n.length, true);
        local.setUint16(28, 0, true);
        const cd = new DataView(new ArrayBuffer(46));
        cd.setUint32(0, 0x02014b50, true);
        cd.setUint16(4, 20, true);
        cd.setUint16(6, 20, true);
        cd.setUint16(8, 0x0800, true);
        cd.setUint16(10, 0, true);
        cd.setUint16(12, 0, true);
        cd.setUint16(14, 0x21, true);
        cd.setUint32(16, crc, true);
        cd.setUint32(20, d.length, true);
        cd.setUint32(24, d.length, true);
        cd.setUint16(28, n.length, true);
        cd.setUint32(42, pos, true);
        partes.push(new Uint8Array(local.buffer), n, d);
        central.push(new Uint8Array(cd.buffer), n);
        pos += 30 + n.length + d.length;
    }
    const tamCentral = central.reduce((a, p) => a + p.length, 0);
    const fim = new DataView(new ArrayBuffer(22));
    fim.setUint32(0, 0x06054b50, true);
    fim.setUint16(8, arquivos.length, true);
    fim.setUint16(10, arquivos.length, true);
    fim.setUint32(12, tamCentral, true);
    fim.setUint32(16, pos, true);
    return new Blob([...partes, ...central, new Uint8Array(fim.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
// ---------- planilha ----------
// escapa XML e remove caracteres de controle que o XML não aceita
const xml = (s) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// 0 -> A, 25 -> Z, 26 -> AA
function coluna(i) {
    let s = '';
    for (i++; i > 0; i = Math.floor((i - 1) / 26))
        s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
    return s;
}
function celula(v, ref, estilo) {
    const s = estilo ? ` s="${estilo}"` : '';
    if (typeof v === 'number' && isFinite(v))
        return `<c r="${ref}"${s}><v>${v}</v></c>`;
    if (v == null || v === '')
        return '';
    return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xml(String(v))}</t></is></c>`;
}
// nome de aba: até 31 caracteres, sem []:*?/\
const nomeAba = (s) => (s.replace(/[[\]:*?/\\]/g, ' ').trim() || 'Processos').slice(0, 31);
export function xlsx(colunas, linhas, aba = 'Processos') {
    const ultima = coluna(Math.max(colunas.length, 1) - 1), total = linhas.length + 1;
    // largura aproximada pelo maior texto da coluna (amostra das primeiras 500 linhas), entre 8 e 60
    const larguras = colunas.map((c, i) => Math.min(60, Math.max(8, c.length + 2, ...linhas.slice(0, 500).map((l) => String(l[i] ?? '').length + 2))));
    const linhasXml = [
        `<row r="1">${colunas.map((c, i) => celula(c, coluna(i) + 1, 1)).join('')}</row>`,
        ...linhas.map((l, k) => `<row r="${k + 2}">${colunas.map((_, i) => celula(l[i], coluna(i) + (k + 2), 0)).join('')}</row>`),
    ].join('');
    const planilha = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        + '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
        + `<cols>${larguras.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
        + `<sheetData>${linhasXml}</sheetData>`
        + `<autoFilter ref="A1:${ultima}${total}"/>`
        + '</worksheet>';
    const abaNome = nomeAba(aba);
    return zip([
        ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                + '<Default Extension="xml" ContentType="application/xml"/>'
                + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
                + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
                + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
                + '</Types>'],
        ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
                + '</Relationships>'],
        ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
                + `<sheets><sheet name="${xml(abaNome)}" sheetId="1" r:id="rId1"/></sheets>`
                + `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${xml(abaNome.replace(/'/g, "''"))}'!$A$1:$${ultima}$${total}</definedName></definedNames>`
                + '</workbook>'],
        ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
                + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
                + '</Relationships>'],
        ['xl/worksheets/sheet1.xml', planilha],
        ['xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
                + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
                + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
                + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
                + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
                + '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>'
                + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
                + '</styleSheet>'],
    ]);
}
