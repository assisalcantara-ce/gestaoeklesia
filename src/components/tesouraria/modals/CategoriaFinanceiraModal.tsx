'use client';

import { X } from 'lucide-react';

export interface CategoriaFinanceiraModalProps {
  isOpen: boolean;
  onClose: () => void;
  formCat: any;
  setFormCat: React.Dispatch<React.SetStateAction<any>>;
  catEditId: string | null;
  savingCat: boolean;
  handleSaveCat: () => void;
  categoriasFull: any[];
}

export default function CategoriaFinanceiraModal({
  isOpen,
  onClose,
  formCat,
  setFormCat,
  catEditId,
  savingCat,
  handleSaveCat,
  categoriasFull,
}: CategoriaFinanceiraModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 w-full max-w-md space-y-4 overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-bold text-[#123b63]">
            {catEditId ? 'Editar Categoria' : 'Nova Categoria'}
          </h3>
          <button onClick={onClose}>
            <X className="h-5 w-5 text-gray-400 hover:text-gray-700" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Nome <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ex: Fundo Social, Construção..."
              value={formCat.nome}
              onChange={(e) => setFormCat((p: any) => ({ ...p, nome: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo de movimento</label>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {[
                { v: 'entrada' as const, label: '↑ Entrada' },
                { v: 'saida' as const, label: '↓ Saída' },
                { v: 'ambos' as const, label: '⇅ Ambos' },
              ].map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setFormCat((p: any) => ({ ...p, tipo_movimento: opt.v }))}
                  className={`flex-1 py-2 text-sm font-medium transition ${
                    formCat.tipo_movimento === opt.v
                      ? 'bg-[#123b63] text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Código (opcional)</label>
              <input
                type="text"
                placeholder="Ex: 3.1"
                value={formCat.codigo}
                onChange={(e) => setFormCat((p: any) => ({ ...p, codigo: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Ícone (emoji)</label>
              <input
                type="text"
                placeholder="Ex: 🏠"
                value={formCat.icone}
                onChange={(e) => setFormCat((p: any) => ({ ...p, icone: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Cor</label>
              <input
                type="color"
                value={formCat.cor}
                onChange={(e) => setFormCat((p: any) => ({ ...p, cor: e.target.value }))}
                className="w-full h-9 border border-gray-200 rounded-lg px-1 py-1 cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Categoria pai (opcional)</label>
              <select
                value={formCat.categoria_pai_id}
                onChange={(e) => setFormCat((p: any) => ({ ...p, categoria_pai_id: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Nenhuma</option>
                {categoriasFull
                  .filter((c) => c.id !== catEditId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icone ? `${c.icone} ` : ''}
                      {c.nome}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
            <input
              type="checkbox"
              checked={formCat.is_ativa}
              onChange={(e) => setFormCat((p: any) => ({ ...p, is_ativa: e.target.checked }))}
              className="w-4 h-4 accent-[#123b63]"
            />
            <span className="text-sm text-gray-700">Categoria ativa</span>
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSaveCat}
            disabled={savingCat}
            className="flex-1 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition disabled:opacity-50"
          >
            {savingCat ? 'Salvando...' : catEditId ? 'Atualizar' : 'Criar Categoria'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
