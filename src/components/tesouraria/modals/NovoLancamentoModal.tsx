'use client';

import React from 'react';
import { X, Plus } from 'lucide-react';
import DizimistaSearchInput from '@/components/tesouraria/DizimistaSearchInput';
import type { FormLanc, UserScope, FinConta, FinCategoria, Aba } from '@/hooks/tesouraria/useTesouraria';

export interface NovoLancamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: FormLanc;
  setForm: React.Dispatch<React.SetStateAction<FormLanc>>;
  editId: string | null;
  saving: boolean;
  handleSave: () => void;
  resetDizForm: () => void;
  emptyForm: () => FormLanc;
  setShowForm: (show: boolean) => void;
  setEditId: (id: string | null) => void;
  setAba: (aba: Aba) => void;
  scope: UserScope;
  congNome: (id?: string | null) => string;
  nomenclaturas: any;
  congregacoes: Array<{ id: string; nome: string }>;
  departamentos: Array<{ id: string; nome: string; sigla?: string }>;
  finContas: FinConta[];
  finCategorias: FinCategoria[];
  dizimistasFormulario: any[];
  dizimistasCompletos: any[];
  TIPOS: Array<{ value: string; label: string }>;
  TIPOS_SAIDA: Array<{ value: string; label: string; cor?: string }>;
}

export default function NovoLancamentoModal({
  isOpen,
  onClose,
  form,
  setForm,
  editId,
  saving,
  handleSave,
  resetDizForm,
  emptyForm,
  setShowForm,
  setEditId,
  setAba,
  scope,
  congNome,
  nomenclaturas,
  congregacoes,
  departamentos,
  finContas,
  finCategorias,
  dizimistasFormulario,
  dizimistasCompletos,
  TIPOS,
  TIPOS_SAIDA,
}: NovoLancamentoModalProps) {
  if (!isOpen) return null;

  const handleClose = () => {
    onClose();
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm());
    resetDizForm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Cabeçalho */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#123b63]/10 border border-[#123b63]/20 flex items-center justify-center text-[#123b63]">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                {editId ? 'Editar Lançamento' : 'Novo Lançamento Financeiro'}
              </h2>
              <p className="text-xs text-slate-500">
                {editId
                  ? 'Atualize as informações do lançamento financeiro'
                  : 'Registre receitas ou despesas da tesouraria com validação e auditoria'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Seletor de Tipo de Movimento: Entrada / Saída */}
          <div className="flex gap-2.5">
            {(['entrada', 'saida'] as const).map((mv) => (
              <button
                key={mv}
                type="button"
                onClick={() =>
                  setForm((p) => ({
                    ...p,
                    tipo_movimento: mv,
                    tipo_recebimento: mv === 'entrada' ? 'oferta' : '',
                    categoria_saida: '',
                    categoria_id: '',
                  }))
                }
                className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition flex items-center justify-center gap-2 shadow-xs cursor-pointer ${
                  form.tipo_movimento === mv
                    ? mv === 'entrada'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-emerald-600/20'
                      : 'bg-rose-600 text-white border-rose-600 shadow-rose-600/20'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                {mv === 'entrada' ? '↑ Entrada (Receita)' : '↓ Saída (Despesa)'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Código / ID do Registro */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Código / ID do Registro
                </label>
                <span className="text-[10px] text-slate-400">Automático / Editável</span>
              </div>
              <input
                type="text"
                placeholder="Ex: REG-2026-000001"
                value={form.codigo_registro}
                onChange={(e) => setForm((p) => ({ ...p, codigo_registro: e.target.value }))}
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-mono uppercase focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 focus:outline-none transition"
              />
            </div>

            {/* Caixa / Congregação */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Caixa / {nomenclaturas?.divisao1 || 'Congregação'} <span className="text-rose-500">*</span>
              </label>
              {scope.isFinanceiroLocal ? (
                <input
                  readOnly
                  value={congNome(scope.congregacaoId)}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm bg-slate-100 text-slate-600 cursor-not-allowed"
                />
              ) : (
                <select
                  value={form.congregacao_id}
                  onChange={(e) => {
                    const novaCongId = e.target.value;
                    setForm((p) => {
                      const dizimistaPertence = dizimistasCompletos.some(
                        (d) => d.id === p.dizimista_id && (!novaCongId || d.congregacaoId === novaCongId)
                      );
                      return {
                        ...p,
                        congregacao_id: novaCongId,
                        dizimista_id: dizimistaPertence ? p.dizimista_id : '',
                        dizimista_nome: dizimistaPertence ? p.dizimista_nome : '',
                      };
                    });
                  }}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 focus:outline-none transition"
                >
                  <option value="">Selecione o(a) {nomenclaturas?.divisao1 || 'congregação'} *</option>
                  {congregacoes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Tipo de Entrada ou Categoria de Saída */}
            {form.tipo_movimento === 'entrada' ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tipo de recebimento <span className="text-rose-500">*</span>
                </label>
                <select
                  value={form.tipo_recebimento}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setForm((p) => {
                      let autoCatId = p.categoria_id;
                      if (val === 'dizimo') {
                        const catDiz = finCategorias.find((c) =>
                          (c.tipo_movimento === 'entrada' || c.tipo_movimento === 'ambos') &&
                          (c.nome.toLowerCase().includes('dízimo') || c.nome.toLowerCase().includes('dizimo'))
                        );
                        if (catDiz) autoCatId = catDiz.id;
                      }
                      return {
                        ...p,
                        tipo_recebimento: val,
                        categoria_id: autoCatId,
                        is_dizimo_avulso: false,
                        dizimista_id: '',
                        dizimista_nome: '',
                      };
                    });
                  }}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 focus:outline-none transition"
                >
                  <option value="">Selecione o tipo</option>
                  {TIPOS.map((tr) => (
                    <option key={tr.value} value={tr.value}>
                      {tr.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Categoria da despesa <span className="text-rose-500">*</span>
                </label>
                <select
                  value={form.categoria_id || form.categoria_saida}
                  onChange={(e) => {
                    const val = e.target.value;
                    const found = finCategorias.find((c) => c.id === val);
                    setForm((p) => ({
                      ...p,
                      categoria_id: found ? found.id : '',
                      categoria_saida: found ? (found.codigo || found.nome) : val,
                    }));
                  }}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 focus:outline-none transition"
                >
                  <option value="">Selecione a categoria</option>
                  {finCategorias
                    .filter((c) => c.tipo_movimento === 'saida' || c.tipo_movimento === 'ambos')
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icone ? `${c.icone} ` : ''}{c.nome} {c.codigo ? `(${c.codigo})` : ''}
                      </option>
                    ))}
                  {finCategorias.filter((c) => c.tipo_movimento === 'saida' || c.tipo_movimento === 'ambos').length === 0 &&
                    TIPOS_SAIDA.map((ts) => (
                      <option key={ts.value} value={ts.value}>
                        {ts.label}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* Departamento */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Departamento</label>
              <select
                value={form.departamento_id}
                onChange={(e) => setForm((p) => ({ ...p, departamento_id: e.target.value }))}
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 focus:outline-none transition"
              >
                <option value="">Caixa Geral da Igreja</option>
                {departamentos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.sigla ? `${d.sigla} – ` : ''}{d.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* LINHA INTEIRA: Bloco de Identificação do Dizimista (se Tipo === 'dizimo') */}
            {form.tipo_movimento === 'entrada' && form.tipo_recebimento === 'dizimo' && (
              <div className="col-span-full p-4 sm:p-5 bg-slate-50/70 border-2 border-slate-300 rounded-2xl space-y-3.5 shadow-xs">
                {/* Linha 1: Identificação do Dizimista + Checkbox Dízimo Avulso */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#123b63]">
                    Identificação do Dizimista
                  </label>
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="flex-1">
                      {!form.is_dizimo_avulso ? (
                        <DizimistaSearchInput
                          dizimistas={dizimistasFormulario}
                          selectedNome={form.dizimista_nome || ''}
                          onSelectDizimista={(diz) => {
                            const dizCompleto = dizimistasFormulario.find((item) => item.id === diz?.id);
                            setForm((p) => ({
                              ...p,
                              dizimista_id: diz?.id || '',
                              dizimista_nome: diz?.nome || '',
                              congregacao_id: dizCompleto?.congregacaoId || p.congregacao_id,
                              observacoes: diz?.nome ? `Dízimo de ${diz.nome}` : p.observacoes,
                            }));
                          }}
                        />
                      ) : (
                        <div className="w-full text-xs text-slate-500 italic bg-slate-100 px-3.5 py-2.5 rounded-xl border border-slate-200 flex items-center h-[42px]">
                          Lançamento marcado como Dízimo Avulso (sem identificação nominal).
                        </div>
                      )}
                    </div>
                    <label className="shrink-0 flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-700 cursor-pointer select-none py-2 px-1">
                      <input
                        type="checkbox"
                        checked={!!form.is_dizimo_avulso}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            is_dizimo_avulso: e.target.checked,
                            dizimista_id: e.target.checked ? '' : p.dizimista_id,
                            dizimista_nome: e.target.checked ? '' : p.dizimista_nome,
                          }))
                        }
                        className="w-4 h-4 text-[#123b63] rounded border-slate-300 focus:ring-[#123b63]"
                      />
                      <span>Dízimo Avulso</span>
                    </label>
                  </div>
                </div>

                {/* Linha 2: Congregação do Dizimista e Cargo / Vínculo (2 colunas) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">Congregação do Dizimista</label>
                    <input
                      type="text"
                      readOnly
                      value={
                        form.is_dizimo_avulso
                          ? '— (Dízimo Avulso)'
                          : dizimistasFormulario.find((d) => d.id === form.dizimista_id)?.congregacaoNome ||
                            (form.congregacao_id ? congNome(form.congregacao_id) : 'Selecione o dizimista')
                      }
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm bg-white text-slate-700 font-medium h-[42px]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">Cargo / Vínculo</label>
                    <input
                      type="text"
                      readOnly
                      value={
                        form.is_dizimo_avulso
                          ? 'Dízimo Avulso'
                          : dizimistasFormulario.find((d) => d.id === form.dizimista_id)?.tipoCadastro
                          ? String(dizimistasFormulario.find((d) => d.id === form.dizimista_id)?.tipoCadastro).toUpperCase()
                          : '—'
                      }
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm bg-white text-slate-700 font-medium h-[42px]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Valor */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Valor (R$) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="0,00"
                value={form.valor}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^\d,]/g, '');
                  setForm((p) => ({ ...p, valor: raw }));
                }}
                onBlur={(e) => {
                  const raw = e.target.value.replace(/\./g, '').replace(',', '.');
                  const num = parseFloat(raw);
                  if (!isNaN(num) && num > 0) {
                    setForm((p) => ({
                      ...p,
                      valor: num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                    }));
                  }
                }}
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 font-bold focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 focus:outline-none transition"
              />
            </div>

            {/* Data */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Data <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={form.data_lancamento}
                onChange={(e) => setForm((p) => ({ ...p, data_lancamento: e.target.value }))}
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 focus:outline-none transition"
              />
            </div>

            {/* Conta / Caixa */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Conta / Caixa</label>
              {finContas.length === 0 ? (
                <div className="w-full border border-dashed border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-400 flex items-center justify-between gap-2">
                  <span>Nenhuma conta cadastrada.</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setAba('contas');
                    }}
                    className="text-[#123b63] font-semibold hover:underline whitespace-nowrap cursor-pointer"
                  >
                    + Cadastrar
                  </button>
                </div>
              ) : (
                <select
                  value={form.conta_id}
                  onChange={(e) => setForm((p) => ({ ...p, conta_id: e.target.value }))}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 focus:outline-none transition"
                >
                  <option value="">Padrão do ministério</option>
                  {finContas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                      {c.is_padrao ? ' ★' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Forma de entrada / Forma de saída */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {form.tipo_movimento === 'saida' ? 'Forma de Saída' : 'Forma de Entrada'}
              </label>
              <select
                value={form.forma_pagamento}
                onChange={(e) => setForm((p) => ({ ...p, forma_pagamento: e.target.value }))}
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 focus:outline-none transition"
              >
                <option value="EM ESPÉCIE">EM ESPÉCIE</option>
                <option value="PIX">PIX</option>
                <option value="CARTÃO DE CRÉDITO">CARTÃO DE CRÉDITO</option>
                <option value="DEPÓSITO BANCÁRIO">DEPÓSITO BANCÁRIO</option>
                <option value="BOLETO">BOLETO</option>
              </select>
            </div>

            {/* Categoria financeira (apenas para Entrada) */}
            {form.tipo_movimento === 'entrada' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Categoria financeira (opcional)
                </label>
                {finCategorias.filter((c) => c.tipo_movimento === 'entrada' || c.tipo_movimento === 'ambos').length === 0 ? (
                  <div className="w-full border border-dashed border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-400 flex items-center justify-between gap-2">
                    <span>Sem categorias disponíveis.</span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        setAba('categorias');
                      }}
                      className="text-[#123b63] font-semibold hover:underline whitespace-nowrap cursor-pointer"
                    >
                      Configurar
                    </button>
                  </div>
                ) : (
                  <select
                    value={form.categoria_id}
                    onChange={(e) => setForm((p) => ({ ...p, categoria_id: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 focus:outline-none transition"
                  >
                    <option value="">Sem categoria (Geral)</option>
                    {finCategorias
                      .filter((c) => c.tipo_movimento === 'entrada' || c.tipo_movimento === 'ambos')
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.icone ? `${c.icone} ` : ''}
                          {c.nome} {c.codigo ? `(${c.codigo})` : ''}
                        </option>
                      ))}
                  </select>
                )}
              </div>
            )}

            {/* Referência */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Referência (evento/campanha)
              </label>
              <input
                type="text"
                placeholder="Ex: Festa das Nações"
                value={form.referencia}
                onChange={(e) => setForm((p) => ({ ...p, referencia: e.target.value }))}
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 focus:outline-none transition"
              />
            </div>

            {/* Observações */}
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Observações</label>
              <textarea
                rows={2}
                placeholder="Observações adicionais do lançamento..."
                value={form.observacoes}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm((p) => ({ ...p, observacoes: val, descricao: val }));
                }}
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm resize-none focus:outline-none focus:border-[#123b63] focus:ring-2 focus:ring-[#123b63]/20 transition"
              />
            </div>
          </div>
        </div>

        {/* Rodapé / Ações */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => handleSave()}
            disabled={saving}
            className="px-6 py-2.5 bg-[#123b63] text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-[#0f2a45] active:bg-[#0b243d] transition disabled:opacity-50 shadow-md shadow-[#123b63]/20 cursor-pointer"
          >
            {saving ? 'Salvando...' : editId ? 'Atualizar Lançamento' : 'Registrar Lançamento'}
          </button>
        </div>
      </div>
    </div>
  );
}
