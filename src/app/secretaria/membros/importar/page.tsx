'use client';

import { useState } from 'react';
import Link from 'next/link';
import PageLayout from '@/components/PageLayout';
import { ArrowLeft, Download, UploadCloud, AlertTriangle, CheckCircle2, FileText, AlertCircle, Info, Settings } from 'lucide-react';

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
}

export default function ImportarMembrosPage() {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [mappedColumns, setMappedColumns] = useState<string[]>([]);
  const [unmappedColumns, setUnmappedColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    valid: 0,
    errors: 0,
    duplicates: 0,
  });
  const [missingRequired, setMissingRequired] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  // 5 colunas obrigatórias conforme especificação
  const requiredFields = ['NOME', 'CPF', 'CONGREGAÇÃO', 'CAMPO', 'SUPERVISAO'];

  // Mapeamento das 59 colunas para campos internos
  const columnMappings: Record<string, string> = {
    'NOME': 'nome',
    'CPF': 'cpf',
    'CONGREGAÇÃO': 'congregacao',
    'CAMPO': 'campo',
    'SUPERVISAO': 'supervisao',
    'BAIRRO': 'bairro',
    'CARGO': 'cargoMinisterial',
    'CELULAR': 'celular',
    'CEP': 'cep',
    'CIDADE': 'cidade',
    'COMPLEMENTO': 'complemento',
    'CONJUJE CPF': 'cpfConjuge',
    'CONJUJE DNASCIMENTO': 'dataNascimentoConjuge',
    'CURSO TEOLOGICO': 'cursoTeologico',
    'DBATISMO AGUAS': 'dataBatismoAguas',
    'DBATISMO ES': 'dataBatismoEspiritoSanto',
    'DEPARTAMENTO': 'setorDepartamento',
    'DIZIMISTA?': 'isDizimista',
    'DNASCIMENTO': 'dataNascimento',
    'EMAIL01': 'email',
    'ENDEREÇO': 'endereco',
    'ESCOLARIDADE': 'escolaridade',
    'ESTADO CIVIL': 'estadoCivil',
    'FOTO 3X4': 'fotoUrl',
    'FUNÇÃO IGREJA': 'qualFuncao',
    'MAE': 'nomeMae',
    'MATRICULA': 'matricula',
    'MUNICIPIO': 'cidade',
    'NACIONALIDADE': 'nacionalidade',
    'NATURALIDADE': 'naturalidade',
    'NOME CONJUGE': 'nomeConjuge',
    'NUMERO': 'numero',
    'OBS MEMBRO': 'observacoes',
    'PAI': 'nomePai',
    'PROCEDENCIA': 'procedencia',
    'PROCEDENCIA LOCAL': 'procedenciaLocal',
    'PROFISSÃO': 'profissao',
    'RG': 'rg',
    'SEXO': 'sexo',
    'STATUS': 'status',
    'TITULO ELEITOR': 'tituloEleitoral',
    'TSANGUE': 'tipoSanguineo',
    'UF ENDEREÇO': 'uf',
    'WHATSAPP': 'whatsapp',
    'ZONA': 'zonaEleitoral',
    'SEÇÃO': 'secaoEleitoral',
    'CONVERSÃO': 'dataConversao',
  };

  // Normalização de cabeçalho mantendo maiúsculas para correspondência exata das especificadas
  const normalizeHeaderName = (h: string): string => {
    return h
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove acentos
      .trim();
  };

  // Validador de CPF
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

  // Parser robusto de CSV para delimitador ";"
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
    // Cabeçalhos de 59 colunas simulados
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

        // Tratar UTF-8-SIG (remover BOM)
        if (text.startsWith('\uFEFF')) {
          text = text.slice(1);
        }

        const rawLines = parseCSV(text);
        if (rawLines.length < 2) {
          setErrorMessage('O arquivo CSV deve conter no mínimo o cabeçalho e uma linha de dados.');
          setParsing(false);
          return;
        }

        // 1. Extrair e normalizar headers
        const rawHeaders = rawLines[0];
        const normalizedHeaders = rawHeaders.map(h => normalizeHeaderName(h));

        // Identificar colunas mapeadas e não mapeadas
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

        // Validar colunas obrigatórias ausentes
        const missing = requiredFields.filter(req => {
          return !normalizedHeaders.some(h => h === req);
        });
        setMissingRequired(missing);

        if (missing.length > 0) {
          setParsing(false);
          return;
        }

        // 2. Processar linhas
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
            } else {
              metadata[h] = val;
            }
          });

          // Rastrear CPFs
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

        // 3. Validar linhas individualmente
        let validCount = 0;
        let errorCount = 0;
        let duplicateCount = 0;

        parsed.forEach(row => {
          const errors: RowError[] = [];

          // NOME vazio
          const nomeVal = (row.data['nome'] || '').trim();
          if (!nomeVal) {
            errors.push({ line: row.line, field: 'nome', message: 'O NOME é obrigatório e está vazio.' });
          }

          // CONGREGAÇÃO vazia
          const congVal = (row.data['congregacao'] || '').trim();
          if (!congVal) {
            errors.push({ line: row.line, field: 'congregacao', message: 'A CONGREGAÇÃO é obrigatória e está vazia.' });
          }

          // CAMPO vazio
          const campoVal = (row.data['campo'] || '').trim();
          if (!campoVal) {
            errors.push({ line: row.line, field: 'campo', message: 'O CAMPO é obrigatório e está vazio.' });
          }

          // SUPERVISAO vazia
          const supVal = (row.data['supervisao'] || '').trim();
          if (!supVal) {
            errors.push({ line: row.line, field: 'supervisao', message: 'A SUPERVISAO é obrigatória e está vazia.' });
          }

          // CPF vazio, inválido ou duplicado
          const cpfRaw = (row.data['cpf'] || '').replace(/\D/g, '');
          if (!cpfRaw) {
            errors.push({ line: row.line, field: 'cpf', message: 'O CPF é obrigatório e está vazio.' });
          } else if (!isValidCPF(cpfRaw)) {
            errors.push({ line: row.line, field: 'cpf', message: `CPF inválido: ${row.data['cpf']}` });
          } else {
            const linesWithCpf = cpfCounts[cpfRaw] || [];
            if (linesWithCpf.length > 1) {
              errors.push({
                line: row.line,
                field: 'cpf',
                message: `CPF duplicado no arquivo (linhas: ${linesWithCpf.join(', ')})`,
              });
              duplicateCount++;
            }
          }

          row.errors = errors;
          row.isValid = errors.length === 0;

          if (row.isValid) {
            validCount++;
          } else {
            errorCount++;
          }
        });

        // Atualizar estados
        setRows(parsed);
        setSummary({
          total: parsed.length,
          valid: validCount,
          errors: errorCount,
          duplicates: Math.ceil(duplicateCount / 2),
        });

      } catch (err) {
        setErrorMessage('Erro ao ler ou processar o arquivo CSV.');
      } finally {
        setParsing(false);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  return (
    <PageLayout
      title="Importador Planilha Legada (59 Colunas)"
      description="Processamento e visualização de arquivos de dados legados no padrão AD Rocha."
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

        {/* Resumo da Validação */}
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
                <span className="text-xs font-bold text-amber-500 uppercase tracking-wider block">CPFs Duplicados</span>
                <span className="text-2xl font-extrabold text-amber-600 block mt-1">{summary.duplicates}</span>
              </div>
            </div>

            {/* Mapeamento de Colunas */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-bold text-green-700 mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" /> Colunas Reconhecidas ({mappedColumns.length})
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
                  <Settings className="h-4 w-4 text-gray-500" /> Colunas Customizadas / Metadata ({unmappedColumns.length})
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

            {/* Aviso de que não grava no banco */}
            <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl p-4 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-sm">Visualização e Validação Estática</h3>
                <p className="text-xs text-blue-700 mt-1">
                  Nenhum registro foi salvo no banco de dados. Os campos legados foram mapeados temporariamente para validação prévia.
                </p>
              </div>
            </div>

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
                  <FileText className="h-5 w-5 text-teal-600" /> Preview dos Dados (Primeiras 20 linhas)
                </h3>
                <span className="text-xs font-semibold text-gray-500">Separador: Semicolon (;)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-100 text-gray-600 uppercase font-semibold border-b border-gray-200">
                      <th className="px-4 py-3 text-center w-12">Linha</th>
                      <th className="px-4 py-3">Nome</th>
                      <th className="px-4 py-3">CPF</th>
                      <th className="px-4 py-3">Telefone</th>
                      <th className="px-4 py-3">Congregação</th>
                      <th className="px-4 py-3">Campo</th>
                      <th className="px-4 py-3">Supervisão</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.slice(0, 20).map(row => {
                      const hasNameError = row.errors.some(e => e.field === 'nome');
                      const hasCpfError = row.errors.some(e => e.field === 'cpf');
                      const hasCongError = row.errors.some(e => e.field === 'congregacao');
                      const hasCampoError = row.errors.some(e => e.field === 'campo');
                      const hasSupError = row.errors.some(e => e.field === 'supervisao');

                      return (
                        <tr key={row.line} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 text-center font-bold text-gray-400 border-r border-gray-100">{row.line}</td>
                          <td className={`px-4 py-3 ${hasNameError ? 'bg-red-50 text-red-900 font-semibold' : 'text-gray-700'}`}>
                            {row.data['nome'] || <span className="text-red-500 italic font-normal">Ausente</span>}
                          </td>
                          <td className={`px-4 py-3 ${hasCpfError ? 'bg-red-50 text-red-900 font-semibold' : 'text-gray-700'}`}>
                            {row.data['cpf'] || <span className="text-red-500 italic font-normal">Ausente</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-700">{row.data['celular'] || row.data['whatsapp'] || '-'}</td>
                          <td className={`px-4 py-3 ${hasCongError ? 'bg-red-50 text-red-900 font-semibold' : 'text-gray-700'}`}>
                            {row.data['congregacao'] || <span className="text-red-500 italic font-normal">Ausente</span>}
                          </td>
                          <td className={`px-4 py-3 ${hasCampoError ? 'bg-red-50 text-red-900 font-semibold' : 'text-gray-700'}`}>
                            {row.data['campo'] || <span className="text-red-500 italic font-normal">Ausente</span>}
                          </td>
                          <td className={`px-4 py-3 ${hasSupError ? 'bg-red-50 text-red-900 font-semibold' : 'text-gray-700'}`}>
                            {row.data['supervisao'] || <span className="text-red-500 italic font-normal">Ausente</span>}
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
