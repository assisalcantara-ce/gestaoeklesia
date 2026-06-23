'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import PageLayout from '@/components/PageLayout';
import { createClient } from '@/lib/supabase-client';
import { ArrowLeft, Download, UploadCloud, AlertTriangle, CheckCircle2, FileText, AlertCircle, Info, Settings, Image, FileImage, ShieldAlert, Play, RefreshCw } from 'lucide-react';

interface RowError {
  line: number;
  message: string;
  field: string;
}

interface ParsedRow {
  line: number;
  data: Record<string, string>;
  metadata: Record<string, string>;
  errors: RowError[];
  isValid: boolean;
  foto_url_origem?: string;
  status_foto?: 'sem_foto' | 'url_valida' | 'url_invalida' | 'bubble_url_detectada';
}

export default function ImportarMembrosPage() {
  const supabase = createClient();
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [mappedColumns, setMappedColumns] = useState<string[]>([]);
  const [unmappedColumns, setUnmappedColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    valid: 0,
    errors: 0,
    duplicates: 0,
    comFoto: 0,
    semFoto: 0,
    urlsBubble: 0,
    urlsInvalidasFoto: 0,
  });
  const [errorStats, setErrorStats] = useState({
    nomeVazio: 0,
    cpfInvalido: 0,
    congregacaoVazia: 0,
    campoVazio: 0,
    supervisaoVazia: 0,
    duplicado: 0,
  });
  const [importSummary, setImportSummary] = useState<{
    imported: number;
    ignored: number;
    errorsPlanilha: number;
    errorsBanco: number;
    duplicates: number;
  } | null>(null);
  const [dbError, setDbError] = useState<{ message: string; code?: string; details?: string } | null>(null);
  const [missingRequired, setMissingRequired] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [migrating, setMigrating] = useState(false);
  const [pendingPhotosCount, setPendingPhotosCount] = useState<number | null>(null);
  const [migrationSummary, setMigrationSummary] = useState<{
    migradas: number;
    ignoradas: number;
    erro: number;
    restantes: number;
  } | null>(null);
  const [migrationError, setMigrationError] = useState('');

  const fetchPendingPhotosCount = async () => {
    try {
      const ministryId = await resolveMinistryId();
      if (!ministryId) return;
      const { count } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('ministry_id', ministryId)
        .is('foto_url', null)
        .not('custom_fields->>foto_origem_bubble', 'is', null)
        .neq('custom_fields->>foto_origem_bubble', '');
      setPendingPhotosCount(count || 0);
    } catch (err) {
      console.error('Error fetching pending photos count:', err);
    }
  };

  useEffect(() => {
    fetchPendingPhotosCount();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (session) {
        fetchPendingPhotosCount();
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // 5 colunas obrigatórias conforme especificação
  const requiredFields = ['NOME', 'CPF', 'CONGREGACAO', 'CAMPO', 'SUPERVISAO'];

  // Mapeamento das 59 colunas para campos internos em formato snake_case
  const columnMappings: Record<string, string> = {
    'NOME': 'nome',
    'CPF': 'cpf',
    'CONGREGACAO': 'congregacao_nome',
    'CAMPO': 'campo',
    'SUPERVISAO': 'supervisao',
    'BAIRRO': 'bairro',
    'CARGO': 'cargo_ministerial',
    'CELULAR': 'celular',
    'CEP': 'cep',
    'CIDADE': 'cidade',
    'COMPLEMENTO': 'complemento',
    'CONJUJE CPF': 'cpf_conjuge',
    'CONJUJE DNASCIMENTO': 'data_nascimento_conjuge',
    'CURSO TEOLOGICO': 'curso_teologico',
    'DBATISMO AGUAS': 'data_batismo_aguas',
    'DBATISMO ES': 'data_batismo_espirito_santo',
    'DEPARTAMENTO': 'setor_departamento',
    'DIZIMISTA?': 'is_dizimista',
    'DNASCIMENTO': 'data_nascimento',
    'EMAIL01': 'email',
    'ENDERECO': 'logradouro',
    'ESCOLARIDADE': 'escolaridade',
    'ESTADO CIVIL': 'estado_civil',
    'FOTO 3X4': 'fotoUrl',
    'FUNCAO IGREJA': 'qual_funcao',
    'MAE': 'nome_mae',
    'MATRICULA': 'matricula',
    'MUNICIPIO': 'cidade',
    'NACIONALIDADE': 'nacionalidade',
    'NATURALIDADE': 'naturalidade',
    'NOME CONJUGE': 'nome_conjuge',
    'NUMERO': 'numero',
    'OBS MEMBRO': 'observacoes',
    'PAI': 'nome_pai',
    'PROCEDENCIA': 'procedencia',
    'PROCEDENCIA LOCAL': 'procedencia_local',
    'PROFISSAO': 'profissao',
    'RG': 'rg',
    'SEXO': 'sexo',
    'STATUS': 'status',
    'TITULO ELEITOR': 'titulo_eleitoral',
    'TSANGUE': 'tipo_sanguineo',
    'UF ENDERECO': 'estado',
    'WHATSAPP': 'whatsapp',
    'ZONA': 'zona_eleitoral',
    'SECAO': 'secao_eleitoral',
    'CONVERSAO': 'data_conversao',
  };

  const resolveMinistryId = async (): Promise<string | null> => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const mu = await supabase
        .from('ministry_users')
        .select('ministry_id')
        .eq('user_id', user.id)
        .limit(1);

      const ministryIdFromMu = (mu.data as any)?.[0]?.ministry_id as string | undefined;
      if (ministryIdFromMu) return ministryIdFromMu;

      const m = await supabase.from('ministries').select('id').eq('user_id', user.id).limit(1);
      const ministryIdFromOwner = (m.data as any)?.[0]?.id as string | undefined;
      return ministryIdFromOwner || null;
    } catch {
      return null;
    }
  };

  const normalizeHeaderName = (h: string): string => {
    return (h || '')
      .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim()
      .replace(/\s+/g, ' ');
  };

  const getFotoStatus = (url: string): 'sem_foto' | 'bubble_url_detectada' | 'url_valida' | 'url_invalida' => {
    const trimmed = (url || '').trim();
    if (!trimmed) return 'sem_foto';

    if (trimmed.includes('bubble.io')) {
      return 'bubble_url_detectada';
    }

    try {
      const absoluteUrl = trimmed.startsWith('//') ? 'https:' + trimmed : trimmed;
      const u = new URL(absoluteUrl);
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        return 'url_valida';
      }
    } catch {
      // Ignora erro
    }
    return 'url_invalida';
  };

  const parseLegacyDate = (val: string): string | null => {
    const trimmed = (val || '').trim();
    if (!trimmed) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      const [d, m, y] = trimmed.split('/');
      return `${y}-${m}-${d}`;
    }

    try {
      const parsed = Date.parse(trimmed);
      if (!isNaN(parsed)) {
        return new Date(parsed).toISOString().split('T')[0];
      }
    } catch {
      // Ignora erro
    }
    return null;
  };

  const isValidCPF = (cpfStr: string): boolean => {
    const cpf = cpfStr.replace(/\D/g, '');
    if (cpf.length !== 11) return false;
    if (/^(\d)\1+$/.test(cpf)) return false;

    let sum = 0;
    let remainder;

    for (let i = 1; i <= 9; i++) {
      sum += parseInt(cpf.substring(i - 1, i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.substring(9, 10))) return false;

    sum = 0;
    for (let i = 1; i <= 10; i++) {
      sum += parseInt(cpf.substring(i - 1, i)) * (12 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.substring(10, 11))) return false;

    return true;
  };

  const parseCSV = (text: string): string[][] => {
    const lines: string[][] = [];
    let row: string[] = [];
    let inQuotes = false;
    let entry = '';

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];

      if (c === '"') {
        if (inQuotes && next === '"') {
          entry += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ';' && !inQuotes) {
        row.push(entry.trim());
        entry = '';
      } else if ((c === '\r' || c === '\n') && !inQuotes) {
        if (c === '\r' && next === '\n') {
          i++;
        }
        row.push(entry.trim());
        lines.push(row);
        row = [];
        entry = '';
      } else {
        entry += c;
      }
    }
    if (row.length > 0 || entry) {
      row.push(entry.trim());
      lines.push(row);
    }
    return lines.filter(l => l.length > 0 && l.some(cell => cell !== ''));
  };

  const handleDownloadTemplate = () => {
    const headersList = [
      'BAIRRO', 'CAMPO', 'CARGO', 'CELULAR', 'CEP', 'CIDADE', 'COMIEADEPA REG', 'COMPLEMENTO',
      'CONGREGAÇÃO', 'CONJUJE CPF', 'CONJUJE DNASCIMENTO', 'CONVERSÃO', 'CPF', 'CURSO TEOLOGICO',
      'DBATISMO AGUAS', 'DBATISMO ES', 'DEPARTAMENTO', 'DIRETORIA?', 'DIRIGENTE?', 'DIZIMISTA?',
      'DNASCIMENTO', 'EMAIL01', 'ENDEREÇO', 'ESCOLARIDADE', 'ESTADO CIVIL', 'FOTO 3X4',
      'FUNÇÃO IGREJA', 'GRUPO', 'INSTITUIÇÃO', 'LOCAL BATISMO', 'MAE', 'MATRICULA', 'MINISTERIAL?',
      'MUNICIOPIO ELEITOR', 'MUNICIPIO', 'NACIONALIDADE', 'NATURALIDADE', 'NOME', 'NOME CONJUGE',
      'NUMERO', 'OBS MEMBRO', 'PAI', 'PROCEDENCIA', 'PROCEDENCIA LOCAL', 'PROFISSÃO', 'QTD FILHOS',
      'REG NASCIMENTO', 'RG', 'SEXO', 'SEÇÃO', 'STATUS', 'SUPERVISAO', 'TIPO MEMBRO', 'TITULO ELEITOR',
      'TSANGUE', 'UF ENDEREÇO', 'UF RG', 'WHATSAPP', 'ZONA'
    ];
    const sampleRow = Array(59).fill('');
    sampleRow[headersList.indexOf('NOME')] = 'José da Rocha';
    sampleRow[headersList.indexOf('CPF')] = '01037113250';
    sampleRow[headersList.indexOf('CONGREGAÇÃO')] = 'Templo Central';
    sampleRow[headersList.indexOf('CAMPO')] = 'ROCHA ETERNA DE MARITUBA';
    sampleRow[headersList.indexOf('SUPERVISAO')] = 'COMIEADEPA';
    sampleRow[headersList.indexOf('SEXO')] = 'MASCULINO';
    sampleRow[headersList.indexOf('STATUS')] = 'ATIVO';
    sampleRow[headersList.indexOf('FOTO 3X4')] = '//3edb25f4485125198951bb914b00eb7d.cdn.bubble.io/f1736978893722x748753810295790100/1-01037113250.jpg';

    const csvContent = '\uFEFF' + [headersList.join(';'), sampleRow.join(';')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'membros_adrocha_modelo.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage('');
    setImportSummary(null);
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv') && selectedFile.type !== 'text/csv') {
      setErrorMessage('Formato inválido. Por favor, envie apenas arquivos com extensão .csv.');
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setErrorMessage('O tamanho do arquivo excede o limite de 5MB.');
      return;
    }

    setFile(selectedFile);
    processFile(selectedFile);
  };

  const processFile = (file: File) => {
    setParsing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        let text = event.target?.result as string;

        if (text.startsWith('\uFEFF')) {
          text = text.slice(1);
        }

        const rawLines = parseCSV(text);
        if (rawLines.length < 2) {
          setErrorMessage('O arquivo CSV deve conter no mínimo o cabeçalho e uma linha de dados.');
          setParsing(false);
          return;
        }

        const rawHeaders = rawLines[0];
        const normalizedHeaders = rawHeaders.map(h => normalizeHeaderName(h));
        console.log("Cabeçalhos encontrados:", normalizedHeaders);

        const mapped: string[] = [];
        const unmapped: string[] = [];

        rawHeaders.forEach(h => {
          const norm = normalizeHeaderName(h);
          if (columnMappings[norm]) {
            mapped.push(h);
          } else {
            unmapped.push(h);
          }
        });
        setMappedColumns(mapped);
        setUnmappedColumns(unmapped);

        const missing = requiredFields.filter(req => {
          return !normalizedHeaders.some(h => h === req);
        });
        setMissingRequired(missing);

        if (missing.length > 0) {
          setParsing(false);
          return;
        }

        const dataRows = rawLines.slice(1);
        const parsed: ParsedRow[] = [];
        const cpfCounts: Record<string, number[]> = {};

        dataRows.forEach((rawRow, idx) => {
          const lineNum = idx + 2;
          const data: Record<string, string> = {};
          const metadata: Record<string, string> = {};

          rawHeaders.forEach((h, hIdx) => {
            const norm = normalizeHeaderName(h);
            const val = rawRow[hIdx] || '';
            const mappedField = columnMappings[norm];

            if (mappedField) {
              data[mappedField] = val;
              if (mappedField === 'nome') {
                console.log(`[Audit NOME] Header usado: "${h}" | Valor bruto: "${val}" | Atribuído a data['nome']: "${data['nome']}"`);
              }
            } else {
              metadata[h] = val;
            }
          });

          const cpfRaw = (data['cpf'] || '').replace(/\D/g, '');
          if (cpfRaw) {
            if (!cpfCounts[cpfRaw]) {
              cpfCounts[cpfRaw] = [];
            }
            cpfCounts[cpfRaw].push(lineNum);
          }

          parsed.push({
            line: lineNum,
            data,
            metadata,
            errors: [],
            isValid: true,
          });
        });

        let validCount = 0;
        let errorCount = 0;
        let duplicateCount = 0;
        let comFoto = 0;
        let semFoto = 0;
        let urlsBubble = 0;
        let urlsInvalidasFoto = 0;

        let nomeVazioCount = 0;
        let cpfInvalidoCount = 0;
        let congregacaoVaziaCount = 0;
        let campoVazioCount = 0;
        let supervisaoVaziaCount = 0;
        let duplCount = 0;

        parsed.forEach(row => {
          const errors: RowError[] = [];

          const nomeVal = (row.data['nome'] || '').trim();
          if (!nomeVal) {
            errors.push({ line: row.line, field: 'nome', message: 'O NOME é obrigatório e está vazio.' });
            nomeVazioCount++;
          }

          const congVal = (row.metadata['CONGREGAÇÃO'] || row.data['congregacao_nome'] || '').trim();
          if (!congVal) {
            errors.push({ line: row.line, field: 'congregacao', message: 'A CONGREGAÇÃO é obrigatória e está vazia.' });
            congregacaoVaziaCount++;
          }

          const campoVal = (row.metadata['CAMPO'] || row.data['campo'] || '').trim();
          if (!campoVal) {
            errors.push({ line: row.line, field: 'campo', message: 'O CAMPO é obrigatório e está vazio.' });
            campoVazioCount++;
          }

          const supVal = (row.metadata['SUPERVISAO'] || row.data['supervisao'] || '').trim();
          if (!supVal) {
            errors.push({ line: row.line, field: 'supervisao', message: 'A SUPERVISAO é obrigatória e está vazia.' });
            supervisaoVaziaCount++;
          }

          const cpfRaw = (row.data['cpf'] || '').replace(/\D/g, '');
          if (!cpfRaw) {
            errors.push({ line: row.line, field: 'cpf', message: 'O CPF é obrigatório e está vazio.' });
            cpfInvalidoCount++;
          } else if (!isValidCPF(cpfRaw)) {
            errors.push({ line: row.line, field: 'cpf', message: `CPF inválido: ${row.data['cpf']}` });
            cpfInvalidoCount++;
          } else {
            const linesWithCpf = cpfCounts[cpfRaw] || [];
            if (linesWithCpf.length > 1) {
              errors.push({
                line: row.line,
                field: 'cpf',
                message: `CPF duplicado no arquivo (linhas: ${linesWithCpf.join(', ')})`,
              });
              duplicateCount++;
              duplCount++;
            }
          }

          const fotoUrl = row.data['fotoUrl'] || '';
          const fotoStatus = getFotoStatus(fotoUrl);
          row.foto_url_origem = fotoUrl;
          row.status_foto = fotoStatus;

          if (fotoStatus === 'sem_foto') {
            semFoto++;
          } else {
            comFoto++;
            if (fotoStatus === 'bubble_url_detectada') {
              urlsBubble++;
            } else if (fotoStatus === 'url_invalida') {
              urlsInvalidasFoto++;
            }
          }

          row.errors = errors;
          row.isValid = errors.length === 0;

          if (row.isValid) {
            validCount++;
          } else {
            errorCount++;
            if (errorCount <= 5) {
              console.log(`[Audit Validate] Linha ${row.line} falhou com erros:`, errors.map(e => `${e.field}: ${e.message}`));
            }
          }
        });

        setErrorStats({
          nomeVazio: nomeVazioCount,
          cpfInvalido: cpfInvalidoCount,
          congregacaoVazia: congregacaoVaziaCount,
          campoVazio: campoVazioCount,
          supervisaoVazia: supervisaoVaziaCount,
          duplicado: duplCount,
        });

        setRows(parsed);
        setSummary({
          total: parsed.length,
          valid: validCount,
          errors: errorCount,
          duplicates: Math.ceil(duplicateCount / 2),
          comFoto,
          semFoto,
          urlsBubble,
          urlsInvalidasFoto,
        });

      } catch (err) {
        setErrorMessage('Erro ao ler ou processar o arquivo CSV.');
      } finally {
        setParsing(false);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    setErrorMessage('');
    setImportSummary(null);

    try {
      const ministryId = await resolveMinistryId();
      if (!ministryId) {
        setErrorMessage('Não foi possível identificar o ministério do usuário logado.');
        setImporting(false);
        return;
      }

      // 1. Carregar congregações existentes
      const { data: congregacoes } = await supabase
        .from('congregacoes')
        .select('id, nome')
        .eq('ministry_id', ministryId);
      const congregacaoMap = new Map(
        (congregacoes || []).map((c: any) => [c.nome.toUpperCase().trim(), c.id])
      );

      // 2. Carregar CPFs existentes
      const { data: existingMembers } = await supabase
        .from('members')
        .select('cpf')
        .eq('ministry_id', ministryId);
      const existingCpfs = new Set(
        (existingMembers || [])
          .map((m: any) => (m.cpf || '').replace(/\D/g, ''))
          .filter(Boolean)
      );

      // 3. Processar linhas válidas
      let importedCount = 0;
      let ignoredCount = 0;
      let dbErrorCount = 0;
      let duplicateDbCount = 0;
      setDbError(null);
      const validRows = rows.filter(r => r.isValid);
      const insertPayloads = [];

      for (const row of validRows) {
        const cpfClean = (row.data['cpf'] || '').replace(/\D/g, '') || null;

        if (cpfClean && existingCpfs.has(cpfClean)) {
          duplicateDbCount++;
          continue;
        }

        const congNome = (row.metadata['CONGREGAÇÃO'] || row.data['congregacao_nome'] || '').toUpperCase().trim();
        const congregacaoId = congregacaoMap.get(congNome) || null;

        // Construir custom_fields
        const importacaoCsv: Record<string, string> = {};
        Object.entries(row.metadata).forEach(([k, v]) => {
          if (v) {
            importacaoCsv[k] = v;
          }
        });

        // Adicionar campos extras (CAMPO e SUPERVISAO) que vão para custom_fields
        if (row.data['campo']) importacaoCsv['CAMPO'] = row.data['campo'];
        if (row.data['supervisao']) importacaoCsv['SUPERVISAO'] = row.data['supervisao'];

        const customFields = {
          importacao_csv: importacaoCsv,
          foto_origem_bubble: row.foto_url_origem || '',
        };

        const formattedBirth = parseLegacyDate(row.data['data_nascimento']);
        const formattedBirthConj = parseLegacyDate(row.data['data_nascimento_conjuge']);
        const formattedBaptism = parseLegacyDate(row.data['data_batismo_aguas']);
        const formattedBaptismEs = parseLegacyDate(row.data['data_batismo_espirito_santo']);
        const formattedCons = parseLegacyDate(row.data['data_consagracao']);
        const formattedEmissao = parseLegacyDate(row.data['data_emissao']);
        const formattedValidade = parseLegacyDate(row.data['data_validade_credencial']);

        let status = 'active';
        const rawStatus = (row.data['status'] || '').toLowerCase();
        if (rawStatus.includes('inativ')) status = 'inactive';
        else if (rawStatus.includes('exclui')) status = 'inactive';

        const matricula = (row.data['matricula'] || '').trim() || null;
        const uniqueId = (row.data['unique_id'] || '').trim() || null;

        const payload: Record<string, any> = {
          ministry_id: ministryId,
          name: (row.data['nome'] || '').trim() || null,
          cpf: cpfClean,
          email: (row.data['email'] || '').trim().toLowerCase() || null,
          phone: (row.data['celular'] || row.data['whatsapp'] || '').trim() || null,
          celular: (row.data['celular'] || '').trim() || null,
          whatsapp: (row.data['whatsapp'] || '').trim() || null,
          matricula,
          unique_id: uniqueId,
          tipo_cadastro: 'membro',
          rg: (row.data['rg'] || '').trim() || null,
          orgao_emissor: (row.data['orgao_emissor'] || '').trim() || null,
          nacionalidade: (row.data['nacionalidade'] || '').trim() || 'BRASILEIRA',
          naturalidade: (row.data['naturalidade'] || '').trim() || null,
          uf_naturalidade: (row.data['uf_naturalidade'] || '').trim() || null,
          titulo_eleitoral: (row.data['titulo_eleitoral'] || '').trim() || null,
          zona_eleitoral: (row.data['zona_eleitoral'] || '').trim() || null,
          secao_eleitoral: (row.data['secao_eleitoral'] || '').trim() || null,
          profissao: (row.data['profissao'] || '').trim() || null,
          cep: (row.data['cep'] || '').trim() || null,
          logradouro: (row.data['logradouro'] || '').trim() || null,
          numero: (row.data['numero'] || '').trim() || null,
          bairro: (row.data['bairro'] || '').trim() || null,
          complemento: (row.data['complemento'] || '').trim() || null,
          cidade: (row.data['cidade'] || '').trim() || null,
          estado: (row.data['estado'] || '').trim() || null,
          curso_teologico: (row.data['curso_teologico'] || '').trim() || null,
          instituicao_teologica: (row.data['instituicao_teologica'] || '').trim() || null,
          procedencia: (row.data['procedencia'] || '').trim() || null,
          procedencia_local: (row.data['procedencia_local'] || '').trim() || null,
          cargo_ministerial: (row.data['cargo_ministerial'] || '').trim() || null,
          qual_funcao: (row.data['qual_funcao'] || '').trim() || null,
          setor_departamento: (row.data['setor_departamento'] || '').trim() || null,
          observacoes_ministeriais: (row.data['observacoes_ministeriais'] || '').trim() || null,
          observacoes: (row.data['observacoes'] || '').trim() || null,
          sexo: (row.data['sexo'] || '').trim() || null,
          tipo_sanguineo: (row.data['tipo_sanguineo'] || '').trim() || null,
          estado_civil: (row.data['estado_civil'] || '').trim() || null,
          nome_conjuge: (row.data['nome_conjuge'] || '').trim() || null,
          cpf_conjuge: (row.data['cpf_conjuge'] || '').replace(/\D/g, '') || null,
          nome_pai: (row.data['nome_pai'] || '').trim() || null,
          nome_mae: (row.data['nome_mae'] || '').trim() || null,
          pastor_auxiliar: ['sim', 's', '1', 'true'].includes((row.data['pastor_auxiliar'] || '').toLowerCase()),
          tem_funcao_igreja: ['sim', 's', '1', 'true'].includes((row.data['tem_funcao_igreja'] || '').toLowerCase()),
          is_dizimista: ['sim', 's', '1', 'true'].includes((row.data['is_dizimista'] || '').toLowerCase()),
          data_nascimento: formattedBirth,
          data_nascimento_conjuge: formattedBirthConj,
          data_batismo_aguas: formattedBaptism,
          data_batismo_espirito_santo: formattedBaptismEs,
          data_consagracao: formattedCons,
          data_emissao: formattedEmissao,
          data_validade_credencial: formattedValidade,
          status,
          custom_fields: customFields,
          foto_url: null,
          congregacao_id: congregacaoId,
        };

        // Remover propriedades undefined
        const cleanPayload = Object.fromEntries(
          Object.entries(payload).filter(([_, v]) => v !== undefined)
        );

        insertPayloads.push(cleanPayload);
      }

      // Log temporário solicitado
      console.log("[Audit Import] totalRows:", rows.length);
      console.log("[Audit Import] validRows.length:", validRows.length);
      console.log("[Audit Import] invalidRows.length:", rows.filter(r => !r.isValid).length);
      console.log("[Audit Import] Registros enviados ao insert (payloads):", insertPayloads);

      // Inserir registros em batches de 50
      const batchSize = 50;
      for (let i = 0; i < insertPayloads.length; i += batchSize) {
        const batch = insertPayloads.slice(i, i + batchSize);
        const { error } = await supabase.from('members').insert(batch);
        if (error) {
          console.error("[Audit Import] Erro retornado pelo Supabase:", error);
          setDbError({
            message: error.message,
            code: error.code,
            details: error.details || '',
          });
          dbErrorCount += batch.length;
        } else {
          importedCount += batch.length;
        }
      }

      setImportSummary({
        imported: importedCount,
        ignored: ignoredCount,
        errorsPlanilha: rows.filter(r => !r.isValid).length,
        errorsBanco: dbErrorCount,
        duplicates: duplicateDbCount,
      });

      await fetchPendingPhotosCount();

    } catch (err: any) {
      console.error("[Audit Import] Erro capturado no catch:", err);
      setErrorMessage(err.message || 'Ocorreu um erro durante a importação.');
    } finally {
      setImporting(false);
    }
  };

  const handleMigratePhotos = async () => {
    console.log("MIGRATE_PHOTOS_CLICKED");
    setMigrating(true);
    setErrorMessage('');
    setMigrationError('');
    setMigrationSummary(null);
    let totalMigradas = 0;
    let totalIgnoradas = 0;
    let totalErro = 0;
    let finalRemaining = 0;

    try {
      let hasMore = true;
      while (hasMore) {
        const res = await fetch('/api/v1/secretaria/membros/migrate-photos', {
          method: 'POST',
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Erro na migração');
        }
        const data = await res.json();
        console.log("MIGRATE_PHOTOS_RESPONSE", data);
        totalMigradas += data.migradas || 0;
        totalIgnoradas += data.ignoradas || 0;
        totalErro += data.erro || 0;
        finalRemaining = data.remaining || 0;

        if ((data.migradas || 0) === 0 && (data.erro || 0) === 0) {
          hasMore = false;
        }
        if ((data.remaining || 0) === 0) {
          hasMore = false;
        }
      }
      setMigrationSummary({
        migradas: totalMigradas,
        ignoradas: totalIgnoradas,
        erro: totalErro,
        restantes: finalRemaining,
      });
      await fetchPendingPhotosCount();
    } catch (err: any) {
      console.error("[Migration Error] failed:", err);
      setMigrationError(err.message || 'Erro ao migrar fotos.');
    } finally {
      setMigrating(false);
    }
  };

  return (
    <PageLayout
      title="Importador Planilha Legada — AD Rocha"
      description="Tratamento e importação de membros do arquivo CSV no padrão AD Rocha Eterna."
      headerExtra={
        <Link
          href="/secretaria/membros"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg text-sm transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Listagem
        </Link>
      }
    >
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Instruções */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
          <h2 className="text-lg font-bold text-teal-800 mb-4 flex items-center gap-2">
            <Info className="h-5 w-5" /> Importador de Planilha Ad Rocha
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                O arquivo de importação deve utilizar delimitador ponto-e-vírgula (<strong>;</strong>) e codificação <strong>UTF-8-SIG</strong>.
              </p>
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 text-xs text-teal-800 space-y-2">
                <p><strong>Colunas obrigatórias:</strong> NOME, CPF, CONGREGAÇÃO, CAMPO, SUPERVISAO</p>
                <p>Mapeia até 59 colunas legadas e direciona dados desconhecidos para campos customizados.</p>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg text-sm transition cursor-pointer"
              >
                <Download className="h-4 w-4" />
                Baixar Modelo CSV (59 colunas)
              </button>
            </div>

            {/* Upload Area */}
            <div className="border-2 border-dashed border-teal-300 rounded-xl p-8 flex flex-col items-center justify-center bg-teal-50/20 hover:bg-teal-50/50 transition">
              <input
                type="file"
                id="legacy-csv-input"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />
              <label
                htmlFor="legacy-csv-input"
                className="flex flex-col items-center justify-center cursor-pointer space-y-3"
              >
                <div className="p-3 bg-teal-100 rounded-full text-teal-700">
                  <UploadCloud className="h-8 w-8 animate-bounce" />
                </div>
                <div className="text-center">
                  <span className="text-sm font-semibold text-teal-700 block">
                    {file ? file.name : 'Selecionar Planilha Legada'}
                  </span>
                  <span className="text-xs text-gray-500 block mt-1">
                    Delimitador: Ponto e Vírgula (;). Máx 5MB.
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Mensagens de Erro Crítico */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm">Erro Crítico</h3>
              <p className="text-xs text-red-700 mt-1">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Colunas Obrigatórias Ausentes */}
        {missingRequired.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm">Colunas Requeridas não Encontradas</h3>
              <p className="text-xs text-amber-800 mt-1">
                O cabeçalho do seu arquivo não contém as seguintes colunas obrigatórias:
              </p>
              <div className="flex gap-2 mt-2">
                {missingRequired.map(field => (
                  <span key={field} className="px-2.5 py-1 bg-amber-200/60 rounded text-xs font-bold font-mono">
                    {field}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Resumo Geral */}
        {file && !parsing && missingRequired.length === 0 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm text-center">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Total de Linhas</span>
                <span className="text-2xl font-extrabold text-gray-800 block mt-1">{summary.total}</span>
              </div>
              <div className="bg-white border border-green-100 rounded-xl p-4 shadow-sm text-center">
                <span className="text-xs font-bold text-green-600 uppercase tracking-wider block">Linhas Válidas</span>
                <span className="text-2xl font-extrabold text-green-700 block mt-1">{summary.valid}</span>
              </div>
              <div className="bg-white border border-red-100 rounded-xl p-4 shadow-sm text-center">
                <span className="text-xs font-bold text-red-500 uppercase tracking-wider block">Com Erro</span>
                <span className="text-2xl font-extrabold text-red-600 block mt-1">{summary.errors}</span>
              </div>
              <div className="bg-white border border-amber-100 rounded-xl p-4 shadow-sm text-center">
                <span className="text-xs font-bold text-amber-500 uppercase tracking-wider block">Planilha Duplicados</span>
                <span className="text-2xl font-extrabold text-amber-600 block mt-1">{summary.duplicates}</span>
              </div>
            </div>

            {/* Resumo de Fotos */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white border border-teal-100 rounded-xl p-4 shadow-sm text-center">
                <span className="text-xs font-bold text-teal-600 uppercase tracking-wider block flex items-center justify-center gap-1">
                  <Image className="h-3.5 w-3.5" /> Total Com Foto
                </span>
                <span className="text-2xl font-extrabold text-teal-700 block mt-1">{summary.comFoto}</span>
              </div>
              <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm text-center">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block flex items-center justify-center gap-1">
                  <FileImage className="h-3.5 w-3.5" /> Total Sem Foto
                </span>
                <span className="text-2xl font-extrabold text-gray-500 block mt-1">{summary.semFoto}</span>
              </div>
              <div className="bg-white border border-purple-100 rounded-xl p-4 shadow-sm text-center font-semibold">
                <span className="text-xs font-bold text-purple-600 uppercase tracking-wider block">Fotos no Bubble.io</span>
                <span className="text-2xl font-extrabold text-purple-700 block mt-1">{summary.urlsBubble}</span>
              </div>
              <div className="bg-white border border-red-100 rounded-xl p-4 shadow-sm text-center">
                <span className="text-xs font-bold text-red-500 uppercase tracking-wider block flex items-center justify-center gap-1">
                  <ShieldAlert className="h-3.5 w-3.5" /> URLs Inválidas
                </span>
                <span className="text-2xl font-extrabold text-red-600 block mt-1">{summary.urlsInvalidasFoto}</span>
              </div>
            </div>

            {/* Resumo de Erros por Tipo */}
            {summary.errors > 0 && (
              <div className="bg-red-50/50 border border-red-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-sm font-bold text-red-800 mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" /> Resumo dos Motivos dos Erros na Planilha
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                  <div className="bg-white border border-red-100 rounded-lg p-3 text-center">
                    <span className="text-[10px] font-bold text-red-600 block">NOME Vazio</span>
                    <span className="text-xl font-extrabold text-red-700 block mt-1">{errorStats.nomeVazio}</span>
                  </div>
                  <div className="bg-white border border-red-100 rounded-lg p-3 text-center">
                    <span className="text-[10px] font-bold text-red-600 block">CPF Inválido/Vazio</span>
                    <span className="text-xl font-extrabold text-red-700 block mt-1">{errorStats.cpfInvalido}</span>
                  </div>
                  <div className="bg-white border border-red-100 rounded-lg p-3 text-center">
                    <span className="text-[10px] font-bold text-red-600 block">CONGREGAÇÃO Vazia</span>
                    <span className="text-xl font-extrabold text-red-700 block mt-1">{errorStats.congregacaoVazia}</span>
                  </div>
                  <div className="bg-white border border-red-100 rounded-lg p-3 text-center">
                    <span className="text-[10px] font-bold text-red-600 block">CAMPO Vazio</span>
                    <span className="text-xl font-extrabold text-red-700 block mt-1">{errorStats.campoVazio}</span>
                  </div>
                  <div className="bg-white border border-red-100 rounded-lg p-3 text-center">
                    <span className="text-[10px] font-bold text-red-600 block">SUPERVISÃO Vazia</span>
                    <span className="text-xl font-extrabold text-red-700 block mt-1">{errorStats.supervisaoVazia}</span>
                  </div>
                  <div className="bg-white border border-red-100 rounded-lg p-3 text-center">
                    <span className="text-[10px] font-bold text-red-600 block">CPF Duplicado</span>
                    <span className="text-xl font-extrabold text-red-700 block mt-1">{errorStats.duplicado}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Mapeamento de Colunas */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-bold text-green-700 mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" /> Colunas Mapeadas ({mappedColumns.length})
                </h3>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-2">
                  {mappedColumns.map(col => (
                    <span key={col} className="px-2 py-1 bg-green-50 text-green-800 border border-green-200 rounded text-[10px] font-mono">
                      {col}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-600 mb-3 flex items-center gap-2">
                  <Settings className="h-4 w-4 text-gray-500" /> Colunas de Metadados / Customizadas ({unmappedColumns.length})
                </h3>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-2">
                  {unmappedColumns.map(col => (
                    <span key={col} className="px-2 py-1 bg-gray-50 text-gray-600 border border-gray-200 rounded text-[10px] font-mono">
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Botão de Importar Real (Novidade) */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-gray-800">Gravar Registros no Banco de Dados</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Gravar apenas os registros de membros válidos da planilha. Evita duplicações de CPF no banco de dados. Fotos serão gravadas como referências nulas.
                </p>
                <div className="flex gap-4 mt-2 text-xs font-semibold">
                  <span className="text-green-600">✓ Linhas válidas para importação: {summary.valid}</span>
                  <span className="text-red-500">✗ Linhas inválidas: {summary.errors}</span>
                </div>
              </div>
              <button
                onClick={handleImport}
                disabled={importing || summary.valid === 0}
                className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-sm transition shadow-md disabled:opacity-50 cursor-pointer"
              >
                {importing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Iniciar Importação Real
                  </>
                )}
              </button>
            </div>

            {/* Resultado da Importação Real */}
            {importSummary && (
              <div className="space-y-4">
                {importSummary.imported > 0 ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-green-900 space-y-3">
                    <h3 className="font-bold text-sm flex items-center gap-2 text-green-800">
                      <CheckCircle2 className="h-5 w-5 text-green-600" /> Importação Real Concluída com Sucesso!
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-2">
                      <div className="bg-white border border-green-100 rounded-lg p-3 text-center">
                        <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider block">Importados</span>
                        <span className="text-xl font-extrabold text-green-700 block mt-1">{importSummary.imported}</span>
                      </div>
                      <div className="bg-white border border-gray-100 rounded-lg p-3 text-center">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Ignorados / Já Existem</span>
                        <span className="text-xl font-extrabold text-gray-700 block mt-1">{importSummary.duplicates}</span>
                      </div>
                      <div className="bg-white border border-red-100 rounded-lg p-3 text-center">
                        <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider block">Erros Planilha</span>
                        <span className="text-xl font-extrabold text-red-600 block mt-1">{importSummary.errorsPlanilha}</span>
                      </div>
                      <div className="bg-white border border-red-100 rounded-lg p-3 text-center">
                        <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider block">Erros Banco</span>
                        <span className="text-xl font-extrabold text-red-600 block mt-1">{importSummary.errorsBanco}</span>
                      </div>
                      <div className="bg-white border border-amber-100 rounded-lg p-3 text-center">
                        <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">Total Processado</span>
                        <span className="text-xl font-extrabold text-amber-700 block mt-1">{importSummary.imported + importSummary.duplicates}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-900 space-y-3">
                    <h3 className="font-bold text-sm flex items-center gap-2 text-red-800">
                      <AlertCircle className="h-5 w-5 text-red-600" /> Nenhum membro foi importado. Corrija os erros da planilha.
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-2">
                      <div className="bg-white border border-green-100 rounded-lg p-3 text-center">
                        <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider block">Importados</span>
                        <span className="text-xl font-extrabold text-green-700 block mt-1">{importSummary.imported}</span>
                      </div>
                      <div className="bg-white border border-gray-100 rounded-lg p-3 text-center">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Ignorados / Já Existem</span>
                        <span className="text-xl font-extrabold text-gray-700 block mt-1">{importSummary.duplicates}</span>
                      </div>
                      <div className="bg-white border border-red-100 rounded-lg p-3 text-center">
                        <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider block">Erros Planilha</span>
                        <span className="text-xl font-extrabold text-red-600 block mt-1">{importSummary.errorsPlanilha}</span>
                      </div>
                      <div className="bg-white border border-red-100 rounded-lg p-3 text-center">
                        <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider block">Erros Banco</span>
                        <span className="text-xl font-extrabold text-red-600 block mt-1">{importSummary.errorsBanco}</span>
                      </div>
                      <div className="bg-white border border-amber-100 rounded-lg p-3 text-center">
                        <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">Total Processado</span>
                        <span className="text-xl font-extrabold text-amber-700 block mt-1">{importSummary.imported + importSummary.duplicates}</span>
                      </div>
                    </div>
                  </div>
                )}

                {dbError && (
                  <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-6 space-y-3 shadow-md">
                    <h3 className="font-bold text-sm flex items-center gap-2 text-red-800">
                      <AlertCircle className="h-5 w-5 text-red-600" /> Existem {summary.valid} linhas válidas, mas o banco recusou a gravação.
                    </h3>
                    <div className="bg-white border border-red-100 rounded-lg p-4 font-mono text-xs text-red-700 space-y-1">
                      <p><strong>Erro:</strong> {dbError.message}</p>
                      {dbError.code && <p><strong>Código de Erro Supabase:</strong> {dbError.code}</p>}
                      {dbError.details && <p><strong>Detalhes:</strong> {dbError.details}</p>}
                    </div>
                  </div>
                )}

                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-800">Migrar Fotos das URLs Bubble.io</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Baixa as fotos de membros que vieram do Bubble e armazena de forma segura no Supabase Storage.
                      {pendingPhotosCount !== null && (
                        <span className="block font-semibold text-purple-700 mt-1">
                          Fotos pendentes no banco de dados: {pendingPhotosCount}
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handleMigratePhotos();
                    }}
                    disabled={migrating || pendingPhotosCount === null || pendingPhotosCount === 0}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-sm transition shadow-md disabled:opacity-50 cursor-pointer"
                  >
                    {migrating ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Migrando Fotos...
                      </>
                    ) : (
                      <>
                        <Image className="h-4 w-4" />
                        Migrar fotos
                      </>
                    )}
                  </button>
                </div>

                {migrationError && (
                  <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-sm">Erro na Migração de Fotos</h3>
                      <p className="text-xs text-red-700 mt-1">{migrationError}</p>
                    </div>
                  </div>
                )}

                {migrationSummary && (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-6 text-purple-900 space-y-3">
                    <h3 className="font-bold text-sm flex items-center gap-2 text-purple-800">
                      <CheckCircle2 className="h-5 w-5 text-purple-600" /> Migração de Fotos Concluída!
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
                      <div className="bg-white border border-purple-100 rounded-lg p-3 text-center">
                        <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">Migradas</span>
                        <span className="text-xl font-extrabold text-purple-700 block mt-1">{migrationSummary.migradas}</span>
                      </div>
                      <div className="bg-white border border-gray-100 rounded-lg p-3 text-center">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Ignoradas</span>
                        <span className="text-xl font-extrabold text-gray-700 block mt-1">{migrationSummary.ignoradas}</span>
                      </div>
                      <div className="bg-white border border-red-100 rounded-lg p-3 text-center">
                        <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider block">Erro</span>
                        <span className="text-xl font-extrabold text-red-600 block mt-1">{migrationSummary.erro}</span>
                      </div>
                      <div className="bg-white border border-blue-100 rounded-lg p-3 text-center">
                        <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Restantes</span>
                        <span className="text-xl font-extrabold text-blue-700 block mt-1">{migrationSummary.restantes}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Detalhes dos erros */}
            {summary.errors > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
                <h3 className="text-md font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <AlertTriangle className="text-red-500 h-5 w-5" /> Erros de Validação por Linha
                </h3>
                <div className="max-h-60 overflow-y-auto divide-y divide-gray-100 pr-2">
                  {rows.filter(r => !r.isValid).map(row => (
                    <div key={row.line} className="py-2.5 flex items-start gap-4 text-xs">
                      <span className="px-2 py-0.5 bg-red-100 text-red-800 font-bold rounded">Linha {row.line}</span>
                      <div className="flex-1 space-y-1">
                        <p className="font-medium text-gray-700">Membro: {row.data['nome'] || 'Sem Nome'}</p>
                        <ul className="list-disc list-inside text-red-600 space-y-0.5">
                          {row.errors.map((err, errIdx) => (
                            <li key={errIdx}>{err.message}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preview das primeiras 20 linhas */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="text-md font-bold text-gray-800 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-teal-600" /> Preview dos Dados com Validação de Fotos (Primeiras 20 linhas)
                </h3>
                <span className="text-xs font-semibold text-gray-500">Exibindo no máximo 20 registros</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-100 text-gray-600 uppercase font-semibold border-b border-gray-200">
                      <th className="px-4 py-3 text-center w-12">Linha</th>
                      <th className="px-4 py-3">Nome</th>
                      <th className="px-4 py-3">CPF</th>
                      <th className="px-4 py-3">Congregação</th>
                      <th className="px-4 py-3">Erro Principal</th>
                      <th className="px-4 py-3 text-center">Status Linha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.slice(0, 20).map(row => {
                      const hasNameError = row.errors.some(e => e.field === 'nome');
                      const hasCpfError = row.errors.some(e => e.field === 'cpf');
                      const hasCongError = row.errors.some(e => e.field === 'congregacao');
                      const firstError = row.errors[0]?.message || '-';

                      return (
                        <tr key={row.line} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 text-center font-bold text-gray-400 border-r border-gray-100">{row.line}</td>
                          <td className={`px-4 py-3 ${hasNameError ? 'bg-red-50 text-red-900 font-semibold' : 'text-gray-700'}`}>
                            {row.data['nome'] || <span className="text-red-500 italic font-normal">Ausente</span>}
                          </td>
                          <td className={`px-4 py-3 ${hasCpfError ? 'bg-red-50 text-red-900 font-semibold' : 'text-gray-700'}`}>
                            {row.data['cpf'] || <span className="text-red-500 italic font-normal">Ausente</span>}
                          </td>
                          <td className={`px-4 py-3 ${hasCongError ? 'bg-red-50 text-red-900 font-semibold' : 'text-gray-700'}`}>
                            {row.metadata['CONGREGAÇÃO'] || row.data['congregacao_nome'] || <span className="text-red-500 italic font-normal">Ausente</span>}
                          </td>
                          <td className={`px-4 py-3 font-mono text-[11px] ${row.isValid ? 'text-gray-400' : 'text-red-600 font-semibold'}`}>
                            {firstError}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {row.isValid ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 border border-green-200">
                                Válido
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                                Inválido
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

      </div>
    </PageLayout>
  );
}
