'use client'

import type { Ministry as SupabaseMinistry } from '@/types/supabase'

interface CsvImportModalProps {
  showImport: boolean
  importMinistryId: string
  setImportMinistryId: (id: string) => void
  importFile: File | null
  importRows: Record<string, string>[]
  importHeaders: string[]
  importLoading: boolean
  importResult: {
    inserted: number
    skipped: number
    total_rows: number
    ministry_name: string
    errors: { row: number; name: string; reason: string }[]
  } | null
  ministerios: SupabaseMinistry[]
  onClose: () => void
  onDownloadTemplate: () => void
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onImport: () => void
  importFileRef: React.RefObject<HTMLInputElement | null>
}

export default function CsvImportModal({
  showImport,
  importMinistryId,
  setImportMinistryId,
  importFile,
  importRows,
  importHeaders,
  importLoading,
  importResult,
  ministerios,
  onClose,
  onDownloadTemplate,
  onFileChange,
  onImport,
  importFileRef,
}: CsvImportModalProps) {
  if (!showImport) return null

  return (
    <div className="fixed inset-0 bg-black/75 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-3xl my-8 text-gray-100">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-bold text-white">📥 Importar Membros via CSV</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Passo 1: Baixar modelo */}
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className="text-sm font-semibold text-gray-200 mb-1">Passo 1 — Baixe o modelo CSV</p>
            <p className="text-xs text-gray-400 mb-3">O modelo contém todas as colunas suportadas com um exemplo de linha. Use ponto-e-vírgula como separador no Excel se necessário.</p>
            <button
              onClick={onDownloadTemplate}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition font-medium"
            >
              📄 Baixar modelo CSV
            </button>
          </div>

          {/* Passo 2: Selecionar ministério */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Passo 2 — Selecione o ministério destino <span className="text-red-400">*</span>
            </label>
            <select
              value={importMinistryId}
              onChange={(e) => setImportMinistryId(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-gray-100 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">— Selecione o ministério —</option>
              {ministerios.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Passo 3: Selecionar arquivo */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Passo 3 — Selecione o arquivo CSV <span className="text-red-400">*</span>
            </label>
            <input
              ref={importFileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={onFileChange}
              className="block w-full text-sm text-gray-300 file:mr-3 file:px-4 file:py-2 file:rounded file:bg-gray-700 file:text-gray-100 file:border-0 hover:file:bg-gray-600 cursor-pointer"
            />
            {importFile && (
              <p className="mt-1 text-xs text-gray-400">{importFile.name} — {importRows.length} linha{importRows.length !== 1 ? 's' : ''} encontrada{importRows.length !== 1 ? 's' : ''}</p>
            )}
          </div>

          {/* Preview */}
          {importRows.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Pré-visualização (primeiras 5 linhas)</p>
              <div className="overflow-x-auto rounded border border-gray-700">
                <table className="text-xs w-full">
                  <thead className="bg-gray-800">
                    <tr>
                      <th className="px-2 py-1 text-gray-400 font-medium text-left">#</th>
                      {importHeaders.slice(0, 8).map(h => (
                        <th key={h} className="px-2 py-1 text-gray-300 font-medium text-left whitespace-nowrap">{h}</th>
                      ))}
                      {importHeaders.length > 8 && <th className="px-2 py-1 text-gray-500">+{importHeaders.length - 8} cols</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/50">
                    {importRows.slice(0, 5).map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-800/40">
                        <td className="px-2 py-1 text-gray-500">{idx + 2}</td>
                        {importHeaders.slice(0, 8).map(h => (
                          <td key={h} className="px-2 py-1 text-gray-300 max-w-[120px] truncate" title={row[h]}>{row[h] || <span className="text-gray-600">—</span>}</td>
                        ))}
                        {importHeaders.length > 8 && <td />}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Resultado */}
          {importResult && (
            <div className={`rounded-xl p-4 border ${importResult.inserted > 0 ? 'bg-green-950/40 border-green-800' : 'bg-red-950/40 border-red-800'}`}>
              {importResult.inserted > 0 && (
                <p className="text-green-300 font-semibold text-sm mb-1">
                  ✅ {importResult.inserted} membro{importResult.inserted !== 1 ? 's' : ''} importado{importResult.inserted !== 1 ? 's' : ''} com sucesso em <strong>{importResult.ministry_name}</strong>!
                </p>
              )}
              {importResult.skipped > 0 && (
                <p className="text-yellow-400 text-xs">⚠️ {importResult.skipped} linha{importResult.skipped !== 1 ? 's' : ''} ignorada{importResult.skipped !== 1 ? 's' : ''} (sem nome)</p>
              )}
              {importResult.errors.length > 0 && (
                <div className="mt-2">
                  <p className="text-red-400 text-xs font-semibold mb-1">Erros ({importResult.errors.length}):</p>
                  <ul className="space-y-1 max-h-40 overflow-y-auto">
                    {importResult.errors.map((e, i) => (
                      <li key={i} className="text-xs text-red-300">Linha {e.row} {e.name ? `"${e.name}"` : ''}: {e.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Botão importar */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onImport}
              disabled={!importFile || !importMinistryId || importLoading || importRows.length === 0}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {importLoading ? 'Importando...' : `📥 Importar ${importRows.length > 0 ? importRows.length + ' membro' + (importRows.length !== 1 ? 's' : '') : 'membros'}`}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition text-sm"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
