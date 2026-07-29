'use client';

import { X } from 'lucide-react';

export interface ContaBancariaModalProps {
  isOpen: boolean;
  onClose: () => void;
  formConta: any;
  setFormConta: React.Dispatch<React.SetStateAction<any>>;
  contaEditId: string | null;
  savingConta: boolean;
  handleSaveConta: () => void;
  TIPOS_CONTA: Array<{ value: string; label: string }>;
}

export default function ContaBancariaModal({
  isOpen,
  onClose,
  formConta,
  setFormConta,
  contaEditId,
  savingConta,
  handleSaveConta,
  TIPOS_CONTA,
}: ContaBancariaModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 w-full max-w-md space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-bold text-[#123b63]">
            {contaEditId ? 'Editar Conta' : 'Nova Conta / Caixa'}
          </h3>
          <button onClick={onClose}>
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Nome da conta <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ex: Itaú Principal, Caixa Tesouraria"
              value={formConta.nome}
              onChange={(e) => setFormConta((p: any) => ({ ...p, nome: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo</label>
              <select
                value={formConta.tipo}
                onChange={(e) => setFormConta((p: any) => ({ ...p, tipo: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                {TIPOS_CONTA.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Banco / Instituição</label>
              <input
                type="text"
                placeholder="Ex: Itaú, Bradesco"
                value={formConta.banco}
                onChange={(e) => setFormConta((p: any) => ({ ...p, banco: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Agência</label>
              <input
                type="text"
                placeholder="0000"
                value={formConta.agencia}
                onChange={(e) => setFormConta((p: any) => ({ ...p, agencia: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Conta com dígito</label>
              <input
                type="text"
                placeholder="00000-0"
                value={formConta.conta}
                onChange={(e) => setFormConta((p: any) => ({ ...p, conta: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formConta.is_padrao}
                onChange={(e) => setFormConta((p: any) => ({ ...p, is_padrao: e.target.checked }))}
                className="w-4 h-4 accent-[#123b63]"
              />
              <span className="text-sm text-gray-700">
                Conta padrão do ministério <span className="text-amber-500">★</span>
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formConta.is_ativa}
                onChange={(e) => setFormConta((p: any) => ({ ...p, is_ativa: e.target.checked }))}
                className="w-4 h-4 accent-[#123b63]"
              />
              <span className="text-sm text-gray-700">Conta ativa</span>
            </label>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSaveConta}
            disabled={savingConta}
            className="flex-1 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition disabled:opacity-50"
          >
            {savingConta ? 'Salvando...' : contaEditId ? 'Atualizar' : 'Criar Conta'}
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
