/**
 * Script de build: Download e estruturação da Bíblia Livre (BLIVRE)
 *
 * Fontes oficiais:
 * - Repositório Oficial: https://github.com/blivre/BibliaLivre
 * - Arquivos-fonte: textos/f4/tr/ (66 livros completos)
 * - Licença: Creative Commons Atribuição 3.0 Brasil (CC BY 3.0 BR)
 *
 * Estrutura gerada:
 * - public/data/biblia/livros.json  (Metadados dos 66 livros: id, nome, abrev, testamento, capitulos)
 * - public/data/biblia/[livroId].json (Capítulos e versículos do livro específico, carregado sob demanda)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_URL = 'https://raw.githubusercontent.com/blivre/BibliaLivre/master/textos/f4/tr/';

// Ordem canônica dos 66 livros da Bíblia Sagrada
const LIVROS_ORDEM = [
  // Antigo Testamento (39 livros)
  { id: 'gn', file: 'gen.txt', testamento: 'AT', grupo: 'Pentateuco', nomePadrao: 'Gênesis', abrevPadrao: 'Gn' },
  { id: 'ex', file: 'exod.txt', testamento: 'AT', grupo: 'Pentateuco', nomePadrao: 'Êxodo', abrevPadrao: 'Êx' },
  { id: 'lv', file: 'lev.txt', testamento: 'AT', grupo: 'Pentateuco', nomePadrao: 'Levítico', abrevPadrao: 'Lv' },
  { id: 'nm', file: 'num.txt', testamento: 'AT', grupo: 'Pentateuco', nomePadrao: 'Números', abrevPadrao: 'Nm' },
  { id: 'dt', file: 'deut.txt', testamento: 'AT', grupo: 'Pentateuco', nomePadrao: 'Deuteronômio', abrevPadrao: 'Dt' },
  { id: 'js', file: 'jos.txt', testamento: 'AT', grupo: 'Históricos', nomePadrao: 'Josué', abrevPadrao: 'Js' },
  { id: 'jz', file: 'juiz.txt', testamento: 'AT', grupo: 'Históricos', nomePadrao: 'Juízes', abrevPadrao: 'Jz' },
  { id: 'rt', file: 'rute.txt', testamento: 'AT', grupo: 'Históricos', nomePadrao: 'Rute', abrevPadrao: 'Rt' },
  { id: '1sm', file: '1sa.txt', testamento: 'AT', grupo: 'Históricos', nomePadrao: '1 Samuel', abrevPadrao: '1Sm' },
  { id: '2sm', file: '2sa.txt', testamento: 'AT', grupo: 'Históricos', nomePadrao: '2 Samuel', abrevPadrao: '2Sm' },
  { id: '1rs', file: '1rs.txt', testamento: 'AT', grupo: 'Históricos', nomePadrao: '1 Reis', abrevPadrao: '1Rs' },
  { id: '2rs', file: '2rs.txt', testamento: 'AT', grupo: 'Históricos', nomePadrao: '2 Reis', abrevPadrao: '2Rs' },
  { id: '1cr', file: '1crn.txt', testamento: 'AT', grupo: 'Históricos', nomePadrao: '1 Crônicas', abrevPadrao: '1Cr' },
  { id: '2cr', file: '2crn.txt', testamento: 'AT', grupo: 'Históricos', nomePadrao: '2 Crônicas', abrevPadrao: '2Cr' },
  { id: 'ed', file: 'esd.txt', testamento: 'AT', grupo: 'Históricos', nomePadrao: 'Esdras', abrevPadrao: 'Ed' },
  { id: 'ne', file: 'nee.txt', testamento: 'AT', grupo: 'Históricos', nomePadrao: 'Neemias', abrevPadrao: 'Ne' },
  { id: 'et', file: 'est.txt', testamento: 'AT', grupo: 'Históricos', nomePadrao: 'Ester', abrevPadrao: 'Et' },
  { id: 'job', file: 'jo.txt', testamento: 'AT', grupo: 'Poéticos', nomePadrao: 'Jó', abrevPadrao: 'Jó' },
  { id: 'sl', file: 'sal.txt', testamento: 'AT', grupo: 'Poéticos', nomePadrao: 'Salmos', abrevPadrao: 'Sl' },
  { id: 'pv', file: 'prov.txt', testamento: 'AT', grupo: 'Poéticos', nomePadrao: 'Provérbios', abrevPadrao: 'Pv' },
  { id: 'ec', file: 'ecl.txt', testamento: 'AT', grupo: 'Poéticos', nomePadrao: 'Eclesiastes', abrevPadrao: 'Ec' },
  { id: 'ct', file: 'cant.txt', testamento: 'AT', grupo: 'Poéticos', nomePadrao: 'Cânticos', abrevPadrao: 'Ct' },
  { id: 'is', file: 'isa.txt', testamento: 'AT', grupo: 'Profetas Maiores', nomePadrao: 'Isaías', abrevPadrao: 'Is' },
  { id: 'jr', file: 'jer.txt', testamento: 'AT', grupo: 'Profetas Maiores', nomePadrao: 'Jeremias', abrevPadrao: 'Jr' },
  { id: 'lm', file: 'lam.txt', testamento: 'AT', grupo: 'Profetas Maiores', nomePadrao: 'Lamentações', abrevPadrao: 'Lm' },
  { id: 'ez', file: 'eze.txt', testamento: 'AT', grupo: 'Profetas Maiores', nomePadrao: 'Ezequiel', abrevPadrao: 'Ez' },
  { id: 'dn', file: 'dan.txt', testamento: 'AT', grupo: 'Profetas Maiores', nomePadrao: 'Daniel', abrevPadrao: 'Dn' },
  { id: 'os', file: 'ose.txt', testamento: 'AT', grupo: 'Profetas Menores', nomePadrao: 'Oseias', abrevPadrao: 'Os' },
  { id: 'jl', file: 'joel.txt', testamento: 'AT', grupo: 'Profetas Menores', nomePadrao: 'Joel', abrevPadrao: 'Jl' },
  { id: 'am', file: 'amos.txt', testamento: 'AT', grupo: 'Profetas Menores', nomePadrao: 'Amós', abrevPadrao: 'Am' },
  { id: 'ob', file: 'oba.txt', testamento: 'AT', grupo: 'Profetas Menores', nomePadrao: 'Obadias', abrevPadrao: 'Ob' },
  { id: 'jn', file: 'jon.txt', testamento: 'AT', grupo: 'Profetas Menores', nomePadrao: 'Jonas', abrevPadrao: 'Jn' },
  { id: 'mq', file: 'miq.txt', testamento: 'AT', grupo: 'Profetas Menores', nomePadrao: 'Miqueias', abrevPadrao: 'Mq' },
  { id: 'na', file: 'naum.txt', testamento: 'AT', grupo: 'Profetas Menores', nomePadrao: 'Naum', abrevPadrao: 'Na' },
  { id: 'hc', file: 'hab.txt', testamento: 'AT', grupo: 'Profetas Menores', nomePadrao: 'Habacuque', abrevPadrao: 'Hc' },
  { id: 'sf', file: 'sof.txt', testamento: 'AT', grupo: 'Profetas Menores', nomePadrao: 'Sofonias', abrevPadrao: 'Sf' },
  { id: 'ag', file: 'ageu.txt', testamento: 'AT', grupo: 'Profetas Menores', nomePadrao: 'Ageu', abrevPadrao: 'Ag' },
  { id: 'zc', file: 'zac.txt', testamento: 'AT', grupo: 'Profetas Menores', nomePadrao: 'Zacarias', abrevPadrao: 'Zc' },
  { id: 'ml', file: 'mal.txt', testamento: 'AT', grupo: 'Profetas Menores', nomePadrao: 'Malaquias', abrevPadrao: 'Ml' },

  // Novo Testamento (27 livros)
  { id: 'mt', file: 'mat.txt', testamento: 'NT', grupo: 'Evangelhos', nomePadrao: 'Mateus', abrevPadrao: 'Mt' },
  { id: 'mc', file: 'mar.txt', testamento: 'NT', grupo: 'Evangelhos', nomePadrao: 'Marcos', abrevPadrao: 'Mc' },
  { id: 'lc', file: 'luc.txt', testamento: 'NT', grupo: 'Evangelhos', nomePadrao: 'Lucas', abrevPadrao: 'Lc' },
  { id: 'jo', file: 'joao.txt', testamento: 'NT', grupo: 'Evangelhos', nomePadrao: 'João', abrevPadrao: 'Jo' },
  { id: 'at', file: 'atos.txt', testamento: 'NT', grupo: 'Histórico', nomePadrao: 'Atos', abrevPadrao: 'At' },
  { id: 'rm', file: 'rom.txt', testamento: 'NT', grupo: 'Epístolas Paulinas', nomePadrao: 'Romanos', abrevPadrao: 'Rm' },
  { id: '1co', file: '1cor.txt', testamento: 'NT', grupo: 'Epístolas Paulinas', nomePadrao: '1 Coríntios', abrevPadrao: '1Co' },
  { id: '2co', file: '2cor.txt', testamento: 'NT', grupo: 'Epístolas Paulinas', nomePadrao: '2 Coríntios', abrevPadrao: '2Co' },
  { id: 'gl', file: 'gal.txt', testamento: 'NT', grupo: 'Epístolas Paulinas', nomePadrao: 'Gálatas', abrevPadrao: 'Gl' },
  { id: 'ef', file: 'efes.txt', testamento: 'NT', grupo: 'Epístolas Paulinas', nomePadrao: 'Efésios', abrevPadrao: 'Ef' },
  { id: 'fp', file: 'fil.txt', testamento: 'NT', grupo: 'Epístolas Paulinas', nomePadrao: 'Filipenses', abrevPadrao: 'Fp' },
  { id: 'cl', file: 'col.txt', testamento: 'NT', grupo: 'Epístolas Paulinas', nomePadrao: 'Colossenses', abrevPadrao: 'Cl' },
  { id: '1ts', file: '1tes.txt', testamento: 'NT', grupo: 'Epístolas Paulinas', nomePadrao: '1 Tessalonicenses', abrevPadrao: '1Ts' },
  { id: '2ts', file: '2tes.txt', testamento: 'NT', grupo: 'Epístolas Paulinas', nomePadrao: '2 Tessalonicenses', abrevPadrao: '2Ts' },
  { id: '1tm', file: '1tim.txt', testamento: 'NT', grupo: 'Epístolas Paulinas', nomePadrao: '1 Timóteo', abrevPadrao: '1Tm' },
  { id: '2tm', file: '2tim.txt', testamento: 'NT', grupo: 'Epístolas Paulinas', nomePadrao: '2 Timóteo', abrevPadrao: '2Tm' },
  { id: 'tt', file: 'tito.txt', testamento: 'NT', grupo: 'Epístolas Paulinas', nomePadrao: 'Tito', abrevPadrao: 'Tt' },
  { id: 'fm', file: 'flm.txt', testamento: 'NT', grupo: 'Epístolas Paulinas', nomePadrao: 'Filemom', abrevPadrao: 'Fm' },
  { id: 'hb', file: 'heb.txt', testamento: 'NT', grupo: 'Epístolas Gerais', nomePadrao: 'Hebreus', abrevPadrao: 'Hb' },
  { id: 'tg', file: 'tiag.txt', testamento: 'NT', grupo: 'Epístolas Gerais', nomePadrao: 'Tiago', abrevPadrao: 'Tg' },
  { id: '1pe', file: '1ped.txt', testamento: 'NT', grupo: 'Epístolas Gerais', nomePadrao: '1 Pedro', abrevPadrao: '1Pe' },
  { id: '2pe', file: '2ped.txt', testamento: 'NT', grupo: 'Epístolas Gerais', nomePadrao: '2 Pedro', abrevPadrao: '2Pe' },
  { id: '1jo', file: '1joao.txt', testamento: 'NT', grupo: 'Epístolas Gerais', nomePadrao: '1 João', abrevPadrao: '1Jo' },
  { id: '2jo', file: '2joao.txt', testamento: 'NT', grupo: 'Epístolas Gerais', nomePadrao: '2 João', abrevPadrao: '2Jo' },
  { id: '3jo', file: '3joao.txt', testamento: 'NT', grupo: 'Epístolas Gerais', nomePadrao: '3 João', abrevPadrao: '3Jo' },
  { id: 'jd', file: 'jud.txt', testamento: 'NT', grupo: 'Epístolas Gerais', nomePadrao: 'Judas', abrevPadrao: 'Jd' },
  { id: 'ap', file: 'apo.txt', testamento: 'NT', grupo: 'Revelação', nomePadrao: 'Apocalipse', abrevPadrao: 'Ap' }
];

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Falha HTTP ${res.statusCode} para ${url}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseF4(text, defaultInfo) {
  const lines = text.split('\n');
  let nameLong = '';
  let nameShort = '';
  let abbrev = '';
  let ubsCode = '';
  let currentTag = '';
  const chapters = {};
  let currentCap = 0;
  let currentVer = 0;
  let inFn = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].replace(/\r/g, '');
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('\\name-long')) { currentTag = 'name-long'; continue; }
    if (trimmed.startsWith('\\*name-long')) { currentTag = ''; continue; }
    if (trimmed.startsWith('\\name-short')) { currentTag = 'name-short'; continue; }
    if (trimmed.startsWith('\\*name-short')) { currentTag = ''; continue; }
    if (trimmed.startsWith('\\abbreviation')) { currentTag = 'abbrev'; continue; }
    if (trimmed.startsWith('\\*abbreviation')) { currentTag = ''; continue; }
    if (trimmed.startsWith('\\ubs-code')) { currentTag = 'ubs'; continue; }
    if (trimmed.startsWith('\\*ubs-code')) { currentTag = ''; continue; }

    if (currentTag === 'name-long') { nameLong = trimmed; continue; }
    if (currentTag === 'name-short') { nameShort = trimmed; continue; }
    if (currentTag === 'abbrev') { abbrev = trimmed; continue; }
    if (currentTag === 'ubs') { ubsCode = trimmed; continue; }

    if (trimmed.startsWith('\\v ')) {
      const parts = trimmed.substring(3).trim().split('.');
      currentCap = parseInt(parts[1], 10);
      currentVer = parseInt(parts[2], 10);
      if (!chapters[currentCap]) chapters[currentCap] = {};
      chapters[currentCap][currentVer] = '';
      continue;
    }

    if (trimmed.startsWith('\\fn')) { inFn = true; continue; }
    if (trimmed.startsWith('\\*fn')) { inFn = false; continue; }
    if (inFn) continue;

    if (
      trimmed.startsWith('\\added') ||
      trimmed.startsWith('\\*added') ||
      trimmed.startsWith('\\key') ||
      trimmed.startsWith('\\*key')
    ) {
      continue;
    }

    if (currentCap && currentVer) {
      const cleaned = rawLine.replace(/\\\*?[a-zA-Z0-9_\-]+/g, '');
      chapters[currentCap][currentVer] = (chapters[currentCap][currentVer] + cleaned);
    }
  }

  // Sanitização de espaços em cada versículo
  const cleanChapters = {};
  const sortedCaps = Object.keys(chapters).map(Number).sort((a, b) => a - b);
  for (const c of sortedCaps) {
    cleanChapters[c] = {};
    const sortedVers = Object.keys(chapters[c]).map(Number).sort((a, b) => a - b);
    for (const v of sortedVers) {
      cleanChapters[c][v] = chapters[c][v].replace(/\s+/g, ' ').trim();
    }
  }

  return {
    id: defaultInfo.id,
    nome: nameShort || defaultInfo.nomePadrao,
    nomeLongo: nameLong || defaultInfo.nomePadrao,
    abrev: abbrev || defaultInfo.abrevPadrao,
    testamento: defaultInfo.testamento,
    grupo: defaultInfo.grupo,
    totalCapitulos: sortedCaps.length,
    capitulos: cleanChapters
  };
}

async function main() {
  const outDir = path.join(process.cwd(), 'public', 'data', 'biblia');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log(`[BIBLIA_BUILD] Processando ${LIVROS_ORDEM.length} livros oficiais da Bíblia Livre...`);
  const indiceLivros = [];

  for (let i = 0; i < LIVROS_ORDEM.length; i++) {
    const livroInfo = LIVROS_ORDEM[i];
    const fileUrl = `${BASE_URL}${livroInfo.file}`;
    process.stdout.write(`(${i + 1}/${LIVROS_ORDEM.length}) Baixando ${livroInfo.nomePadrao} (${livroInfo.file})... `);

    try {
      const rawText = await fetchText(fileUrl);
      const parsed = parseF4(rawText, livroInfo);

      // 1. Salvar arquivo do livro completo particionado
      const bookFile = path.join(outDir, `${livroInfo.id}.json`);
      fs.writeFileSync(bookFile, JSON.stringify({
        id: parsed.id,
        nome: parsed.nome,
        nomeLongo: parsed.nomeLongo,
        abrev: parsed.abrev,
        testamento: parsed.testamento,
        grupo: parsed.grupo,
        totalCapitulos: parsed.totalCapitulos,
        capitulos: parsed.capitulos
      }), 'utf8');

      // 2. Adicionar ao índice leve
      indiceLivros.push({
        id: parsed.id,
        posicao: i + 1,
        nome: parsed.nome,
        nomeLongo: parsed.nomeLongo,
        abrev: parsed.abrev,
        testamento: parsed.testamento,
        grupo: parsed.grupo,
        totalCapitulos: parsed.totalCapitulos
      });

      console.log(`OK (${parsed.totalCapitulos} caps)`);
    } catch (err) {
      console.error(`ERRO: ${err.message}`);
      process.exit(1);
    }
  }

  // 3. Salvar metadados gerais e índice de livros
  const metaFile = path.join(outDir, 'livros.json');
  fs.writeFileSync(metaFile, JSON.stringify({
    versao: 'BLIVRE',
    nomeVersao: 'Bíblia Livre',
    licenca: 'Creative Commons Atribuição 3.0 Brasil (CC BY 3.0 BR)',
    autores: 'Diego Santos, Mario Sérgio, e Marco Teles',
    fonte: 'https://github.com/blivre/BibliaLivre',
    creditos: 'Todas as Escrituras em português citadas são da Bíblia Livre (BLIVRE), Copyright © Diego Santos, Mario Sérgio, e Marco Teles, http://sites.google.com/site/biblialivre/ - Licença Creative Commons Atribuição 3.0 Brasil (http://creativecommons.org/licenses/by/3.0/br/). Reprodução permitida desde que devidamente mencionados fonte e autores.',
    totalLivros: indiceLivros.length,
    livros: indiceLivros
  }, null, 2), 'utf8');

  console.log(`[BIBLIA_BUILD] ✅ Concluído com sucesso! 66 livros processados em ${outDir}`);
}

main().catch(err => {
  console.error('[BIBLIA_BUILD] Erro fatal:', err);
  process.exit(1);
});
