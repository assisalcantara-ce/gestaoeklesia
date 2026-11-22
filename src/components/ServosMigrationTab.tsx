'use client';

import { useState } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  FileText,
  Image as ImageIcon,
  ShieldAlert,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { TARGET_IEADMIM_MINISTRY_ID, ServosPreviewReport } from '@/lib/servos-migration/types';

interface ServosMigrationTabProps {
  currentMinistryId?: string | null;
  onSuccess?: () => void;
}

export default function ServosMigrationTab({ currentMinistryId, onSuccess }: ServosMigrationTabProps) {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [dryRunReport, setDryRunReport] = useState<ServosPreviewReport | null>(null);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [, setTemplateResult] = useState<any | null>(null);
  const [resolucaoMatriculas, setResolucaoMatriculas] = useState<boolean>(false);

  const isIeadmim = currentMinistryId === TARGET_IEADMIM_MINISTRY_ID;

  const handleCsvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage('');
    setSuccessMessage('');
    setDryRunReport(null);
    setImportResult(null);
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.name.endsWith('.csv')) {
      setErrorMessage('Por favor, selecione um arquivo .csv de exportação do Gestão Servos.');
      return;
    }
    setCsvFile(selected);
  };

  const handleTemplateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage('');
    setSuccessMessage('');
    setTemplateResult(null);
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.name.endsWith('.json')) {
      setErrorMessage('Por favor, selecione o arquivo .json do template de carteirinha.');
      return;
    }
    setTemplateFile(selected);
  };

  const handleRunDryRun = async () => {
    if (!csvFile && !templateFile) {
      setErrorMessage('Selecione ao menos o arquivo CSV de membros ou o JSON da carteirinha.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('mode', 'dry-run');
      if (csvFile) formData.append('file', csvFile);
      if (templateFile) formData.append('template_file', templateFile);

      const res = await fetch('/api/v1/secretaria/membros/servos-migration', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao processar prévia.');
      }

      setDryRunReport(data.report);
      setSuccessMessage('Prévia Dry-Run executada com sucesso! Nenhum dado foi alterado no banco de dados.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao executar Dry-Run.');
    } finally {
      setLoading(false);
    }
  };

  const handleImportOnlyTemplate = async () => {
    if (!templateFile) return;
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const formData = new FormData();
      formData.append('template_file', templateFile);

      const res = await fetch('/api/v1/secretaria/membros/servos-migration', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao importar template de carteirinha.');
      }

      setTemplateResult(data);
      setSuccessMessage(`Template de carteirinha importado com sucesso (${data.action})!`);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao importar carteirinha.');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!csvFile) {
      setErrorMessage('Arquivo CSV de membros é obrigatório para importação.');
      return;
    }

    if (!dryRunReport) {
      setErrorMessage('É obrigatório rodar a prévia Dry-Run antes de confirmar a importação.');
      return;
    }

    if (dryRunReport.matriculas_duplicadas_legado.length > 0 && !resolucaoMatriculas) {
      setErrorMessage(
        'Foram detectadas matrículas duplicadas no legado da origem. Marque a ciência e resolução explícita para prosseguir preservando as matrículas originais.'
      );
      return;
    }

    const confirmPrompt = window.confirm(
      `ATENÇÃO: Você está prestes a importar ${dryRunReport.aptas_para_insercao} ministros no tenant IEADMIM. Deseja prosseguir com a gravação?`
    );
    if (!confirmPrompt) return;

    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const formData = new FormData();
      formData.append('mode', 'import');
      formData.append('file', csvFile);
      if (templateFile) formData.append('template_file', templateFile);

      const res = await fetch('/api/v1/secretaria/membros/servos-migration', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao executar importação real.');
      }

      setImportResult(data.importResult);
      if (data.templateResult) setTemplateResult(data.templateResult);
      setSuccessMessage(
        `Importação concluída com sucesso: ${data.importResult?.inseridos} ministros importados e ${data.importResult?.fotos_enviadas} fotos migradas!`
      );
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao executar importação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Alerta de Segurança e Isolamento */}
      <div className={`rounded-xl p-5 border flex items-start gap-3 ${
        isIeadmim
          ? 'bg-blue-50 border-blue-200 text-blue-900'
          : 'bg-amber-50 border-amber-200 text-amber-900'
      }`}>
        <ShieldAlert className="h-6 w-6 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm space-y-1">
          <p className="font-bold">Módulo Assistido de Migração Gestão Servos → Gestão Eklésia</p>
          <p className="text-xs text-gray-700">
            Tenant Autorizado: <strong>IEADMIM</strong> (<code>{TARGET_IEADMIM_MINISTRY_ID}</code>).
            O <code>ministry_id</code> de origem é sumariamente descartado e todos os cadastros são vinculados exclusivamente ao seu tenant autenticado.
          </p>
          {!isIeadmim && (
            <p className="text-xs font-semibold text-amber-800 mt-2">
              Aviso: Seu tenant atual (<code>{currentMinistryId || 'desconhecido'}</code>) não corresponde ao IEADMIM. A importação será bloqueada pelo backend.
            </p>
          )}
        </div>
      </div>

      {/* Seleção de Arquivos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CSV de Membros */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
          <div className="flex items-center gap-2 text-gray-800 font-semibold">
            <FileText className="h-5 w-5 text-teal-600" />
            <h3>1. CSV de Membros / Ministros (64 Colunas)</h3>
          </div>
          <p className="text-xs text-gray-500">
            Arquivo <code>members_export_4821c293.csv</code> com 226 ministros, delimitador vírgula e 63 fotos base64.
          </p>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition">
            <input
              type="file"
              id="servos-csv-input"
              accept=".csv"
              className="hidden"
              onChange={handleCsvChange}
            />
            <label htmlFor="servos-csv-input" className="cursor-pointer block space-y-2">
              <UploadCloud className="h-8 w-8 text-teal-600 mx-auto" />
              <span className="text-sm font-semibold text-gray-700 block">
                {csvFile ? csvFile.name : 'Selecionar CSV do Servos'}
              </span>
              <span className="text-xs text-gray-400 block">Formato original com 64 colunas</span>
            </label>
          </div>
        </div>

        {/* JSON Carteirinha */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
          <div className="flex items-center gap-2 text-gray-800 font-semibold">
            <ImageIcon className="h-5 w-5 text-indigo-600" />
            <h3>2. Template de Carteirinha (JSON)</h3>
          </div>
          <p className="text-xs text-gray-500">
            Arquivo <code>template_ministro_ativo.json</code> com Ministro Modelo 01 (Frente, Verso e 14 elementos).
          </p>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition">
            <input
              type="file"
              id="servos-template-input"
              accept=".json"
              className="hidden"
              onChange={handleTemplateChange}
            />
            <label htmlFor="servos-template-input" className="cursor-pointer block space-y-2">
              <UploadCloud className="h-8 w-8 text-indigo-600 mx-auto" />
              <span className="text-sm font-semibold text-gray-700 block">
                {templateFile ? templateFile.name : 'Selecionar JSON de Carteirinha'}
              </span>
              <span className="text-xs text-gray-400 block">Template independente por tenant</span>
            </label>
          </div>
          {templateFile && (
            <button
              type="button"
              onClick={handleImportOnlyTemplate}
              disabled={loading}
              className="w-full py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg border border-indigo-200 transition"
            >
              Importar Apenas Template de Carteirinha
            </button>
          )}
        </div>
      </div>

      {/* Mensagens */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Erro no Processamento</p>
            <p className="text-xs text-red-700 mt-1">{errorMessage}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Sucesso</p>
            <p className="text-xs text-emerald-700 mt-1">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Ações de Prévia */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleRunDryRun}
          disabled={loading || (!csvFile && !templateFile)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition shadow-sm cursor-pointer"
        >
          <Sparkles className="h-4 w-4" />
          {loading ? 'Analisando Arquivo...' : '1. Executar Prévia Obrigatória (Dry-Run)'}
        </button>

        {dryRunReport && (
          <button
            type="button"
            onClick={() => {
              setDryRunReport(null);
              setImportResult(null);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-gray-600 hover:text-gray-800 text-xs font-medium"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Limpar Prévia
          </button>
        )}
      </div>

      {/* Relatório Detalhado de Prévia */}
      {dryRunReport && (
        <div className="space-y-4 bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">Relatório de Validação da Prévia (Dry-Run)</h3>
              <p className="text-xs text-gray-500">
                Verificação completa de integridade sem persistência no banco de dados.
              </p>
            </div>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">
              Modo Somente Leitura
            </span>
          </div>

          {/* Cards de Métricas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 border rounded-lg text-center">
              <span className="text-xs font-semibold text-gray-500 uppercase block">Total de Linhas</span>
              <span className="text-2xl font-extrabold text-gray-900 block mt-1">{dryRunReport.total_lidas}</span>
            </div>
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
              <span className="text-xs font-semibold text-emerald-700 uppercase block">Aptas para Inserção</span>
              <span className="text-2xl font-extrabold text-emerald-800 block mt-1">
                {dryRunReport.aptas_para_insercao}
              </span>
            </div>
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg text-center">
              <span className="text-xs font-semibold text-indigo-700 uppercase block">Fotos Base64 Prontas</span>
              <span className="text-2xl font-extrabold text-indigo-800 block mt-1">
                {dryRunReport.fotos_base64_detectadas}
              </span>
            </div>
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-center">
              <span className="text-xs font-semibold text-amber-700 uppercase block">CPFs Ausentes (NULL)</span>
              <span className="text-2xl font-extrabold text-amber-800 block mt-1">
                {dryRunReport.cpfs_ausentes}
              </span>
            </div>
          </div>

          {/* Detalhes de Matrículas e Duplicidades Legadas */}
          {dryRunReport.matriculas_duplicadas_legado.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-amber-900 font-semibold text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span>Matrículas Repetidas no Legado de Origem (Preservação sem Renumeração)</span>
              </div>
              <p className="text-xs text-amber-800">
                O arquivo de origem contém matrículas idênticas atribuídas a ministros distintos no Gestão Servos:
              </p>
              <ul className="text-xs text-amber-900 list-disc pl-5 space-y-1">
                {dryRunReport.matriculas_duplicadas_legado.map((dm) => (
                  <li key={dm.matricula}>
                    Matrícula <strong>{dm.matricula}</strong> presente nas linhas: {dm.linhas.join(', ')}.
                  </li>
                ))}
              </ul>
              <div className="pt-2">
                <label className="flex items-center gap-2 text-xs font-medium text-amber-950 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={resolucaoMatriculas}
                    onChange={(e) => setResolucaoMatriculas(e.target.checked)}
                    className="rounded border-amber-400 text-teal-600 focus:ring-teal-500"
                  />
                  <span>
                    Estou ciente dessas repetições legadas e autorizo a importação mantendo as matrículas originais sem renumeração automática.
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Tabela de Amostra dos Registros */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Amostra de Validação (Primeiros {dryRunReport.preview_amostra.length} registros)
            </h4>
            <div className="overflow-x-auto border rounded-lg max-h-72">
              <table className="w-full text-xs text-left text-gray-600">
                <thead className="bg-gray-100 text-gray-700 font-semibold sticky top-0">
                  <tr>
                    <th className="p-2">Linha</th>
                    <th className="p-2">Nome</th>
                    <th className="p-2">Cargo</th>
                    <th className="p-2">CPF</th>
                    <th className="p-2">Matrícula</th>
                    <th className="p-2">Foto</th>
                    <th className="p-2">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {dryRunReport.preview_amostra.map((row) => (
                    <tr key={row.index} className={row.will_insert ? 'hover:bg-gray-50' : 'bg-red-50/50'}>
                      <td className="p-2 font-mono">{row.index}</td>
                      <td className="p-2 font-medium text-gray-900">{row.name}</td>
                      <td className="p-2">{row.cargo || '-'}</td>
                      <td className="p-2 font-mono">{row.cpf || <span className="text-amber-600 font-bold">NULL</span>}</td>
                      <td className="p-2 font-mono">{row.matricula || '-'}</td>
                      <td className="p-2">
                        {row.has_foto_base64 ? (
                          <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold">
                            Base64 (~{Math.round(row.foto_bytes_approx / 1024)}KB)
                          </span>
                        ) : (
                          <span className="text-gray-400">Sem foto</span>
                        )}
                      </td>
                      <td className="p-2">
                        {row.will_insert ? (
                          <span className="text-emerald-700 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Apto
                          </span>
                        ) : (
                          <span className="text-red-700 font-semibold flex items-center gap-1" title={row.notes.join('; ')}>
                            <AlertCircle className="h-3 w-3" /> Ignorado
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Botão de Confirmação da Gravação Real */}
          <div className="pt-4 border-t flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Pronto para homologação. Os cadastros serão inseridos exclusivamente no tenant IEADMIM.
            </p>
            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={loading || (dryRunReport.matriculas_duplicadas_legado.length > 0 && !resolucaoMatriculas)}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg text-sm transition shadow cursor-pointer"
            >
              <Play className="h-4 w-4" />
              {loading ? 'Importando Ministros...' : 'Confirmar e Importar Registros no IEADMIM'}
            </button>
          </div>
        </div>
      )}

      {/* Relatório Final de Importação */}
      {importResult && (
        <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl space-y-4">
          <div className="flex items-center gap-2 text-emerald-900 font-bold text-base">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span>Relatório Final de Importação de Ministros</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="bg-white p-3 rounded-lg border border-emerald-100">
              <span className="text-xs text-gray-500 block">Total Lidas</span>
              <span className="text-xl font-bold text-gray-800">{importResult.total_lidas}</span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-emerald-100">
              <span className="text-xs text-emerald-700 block">Inseridos</span>
              <span className="text-xl font-bold text-emerald-800">{importResult.inseridos}</span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-emerald-100">
              <span className="text-xs text-indigo-700 block">Fotos Migradas</span>
              <span className="text-xl font-bold text-indigo-800">{importResult.fotos_enviadas}</span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-emerald-100">
              <span className="text-xs text-gray-500 block">Ignorados / Já Existentes</span>
              <span className="text-xl font-bold text-gray-600">{importResult.ignorados}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
