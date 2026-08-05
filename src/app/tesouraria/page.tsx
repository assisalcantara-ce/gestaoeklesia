'use client';

export const dynamic = 'force-dynamic';

import PageLayout from '@/components/PageLayout';
import NotificationModal from '@/components/NotificationModal';
import { Plus, X, TrendingUp, Building2, Tag, Users, Lock, List, Printer, QrCode } from 'lucide-react';
import TesourariaTable from '@/components/tesouraria/TesourariaTable';
import TesourariaToolbar from '@/components/tesouraria/TesourariaToolbar';
import FechamentoCaixaModal from '@/components/tesouraria/modals/FechamentoCaixaModal';
import ContaBancariaModal from '@/components/tesouraria/modals/ContaBancariaModal';
import CategoriaFinanceiraModal from '@/components/tesouraria/modals/CategoriaFinanceiraModal';
import ConfirmDeleteModal from '@/components/tesouraria/modals/ConfirmDeleteModal';
import TesourariaCharts from '@/components/tesouraria/TesourariaCharts';
import FechamentoCaixaTable from '@/components/tesouraria/FechamentoCaixaTable';
import DizimistasTable from '@/components/tesouraria/DizimistasTable';
import DizimistaSearchInput from '@/components/tesouraria/DizimistaSearchInput';
import { useTesouraria } from '@/hooks/tesouraria/useTesouraria';

// Componente customizado e elegante para seleção de Mês e Ano de referência
function MonthPicker({ value, onChange, className = '' }: { value: string; onChange: (v: string) => void; className?: string }) {
  const [anoStr, mesStr] = value.split('-');
  const ano = parseInt(anoStr || String(new Date().getFullYear()));
  const mes = parseInt(mesStr || String(new Date().getMonth() + 1));

  const meses = [
    { value: 1, label: 'Janeiro' },
    { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' },
    { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' },
    { value: 12, label: 'Dezembro' }
  ];

  // Gera uma lista dinâmica de anos ao redor do ano atual
  const anoAtual = new Date().getFullYear();
  const anos = Array.from({ length: 8 }, (_, i) => anoAtual - 5 + i); // 5 anos anteriores, ano atual, e mais 2 à frente

  const handleMesChange = (novoMes: number) => {
    onChange(`${anoStr}-${String(novoMes).padStart(2, '0')}`);
  };

  const handleAnoChange = (novoAno: number) => {
    onChange(`${novoAno}-${String(mes).padStart(2, '0')}`);
  };

  return (
    <div className={`flex gap-1.5 ${className}`}>
      <select
        value={mes}
        onChange={(e) => handleMesChange(Number(e.target.value))}
        className="flex-1 min-w-[105px] border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-[#123b63] bg-white"
      >
        {meses.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      <select
        value={ano}
        onChange={(e) => handleAnoChange(Number(e.target.value))}
        className="w-[72px] border border-gray-200 rounded-lg px-1.5 py-2 text-sm focus:outline-none focus:border-[#123b63] bg-white"
      >
        {anos.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function TesourariaPage() {
  const t = useTesouraria();

  if (t.authLoading || t.loadingData) {
    return (
      <PageLayout title="Tesouraria" description="Gestão de lançamentos e fluxo financeiro do ministério">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#123b63]" />
        </div>
      </PageLayout>
    );
  }

  if (t.bloqueado) {
    return (
      <PageLayout title="Tesouraria" description="Gestão de lançamentos e fluxo financeiro do ministério">
        <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm text-center max-w-md mx-auto my-12 space-y-4">
          <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
            <Lock className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-gray-800">Acesso Restrito</h2>
          <p className="text-sm text-gray-500">
            Você não possui permissão para acessar o módulo de Tesouraria.
          </p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Tesouraria" description="Gestão de lançamentos e fluxo financeiro do ministério">
      <div className="space-y-6">
        {/* Modal de Notificação */}
        <NotificationModal
          isOpen={t.modal.open}
          onClose={() => t.setModal((p) => ({ ...p, open: false }))}
          title={t.modal.title}
          message={t.modal.message}
          type={t.modal.type}
        />

        {/* Abas Superiores */}
        <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
          {[
            { id: 'dashboard' as const, label: 'Visão Geral', icon: TrendingUp },
            { id: 'lancamentos' as const, label: 'Lançamentos', icon: List },
            { id: 'relatorios' as const, label: 'Relatórios', icon: Printer },
            { id: 'fechamento' as const, label: 'Fechamento de Caixa', icon: Lock },
            { id: 'dizimistas' as const, label: 'Dizimistas', icon: Users },
            { id: 'contas' as const, label: 'Contas / Caixas', icon: Building2 },
            { id: 'categorias' as const, label: 'Categorias', icon: Tag },
            { id: 'arrecadacao' as const, label: 'Arrecadação Digital', icon: QrCode },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = t.aba === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => t.setAba(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
                  active
                    ? 'bg-[#123b63] text-white shadow-md'
                    : 'bg-white text-gray-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ─── ABA: LANÇAMENTOS ─── */}
        {t.aba === 'lancamentos' && (
          <div className="space-y-4">
            <TesourariaToolbar
              filtroMes={t.filtroMes}
              setFiltroMes={t.setFiltroMes}
              filtroMovimento={t.filtroMovimento}
              setFiltroMovimento={t.setFiltroMovimento}
              filtroTipo={t.filtroTipo}
              setFiltroTipo={t.setFiltroTipo}
              filtroCong={t.filtroCong}
              setFiltroCong={t.setFiltroCong}
              filtroDept={t.filtroDept}
              setFiltroDept={t.setFiltroDept}
              scope={t.scope}
              congregacoes={t.congregacoes}
              departamentos={t.departamentos}
              TIPOS={t.TIPOS}
              TIPOS_SAIDA={t.TIPOS_SAIDA}
              MonthPicker={MonthPicker}
              onNovoClick={() => {
                t.setForm(t.emptyForm());
                t.setEditId(null);
                t.setShowForm(true);
              }}
              lancamentosMesCount={t.lancamentosMes.length}
              onExportarCSV={() => t.exportarCSV(t.lancsFiltrados, `lancamentos-${t.filtroMes}`)}
              lancsFiltradosCount={t.lancsFiltrados.length}
              entradasFiltradas={t.entradasFiltradas}
              saidasFiltradas={t.saidasFiltradas}
              fmtBRL={t.fmtBRL}
              loadingMes={t.loadingMes}
            />

            {/* Formulário inline */}
            {t.showForm && (
              <div className="bg-white rounded-2xl border-2 border-[#123b63] p-5 shadow-lg space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-base font-bold text-[#123b63]">
                    {t.editId ? 'Editar Lançamento' : 'Novo Lançamento'}
                  </h3>
                  <button
                    onClick={() => {
                      t.setShowForm(false);
                      t.setEditId(null);
                      t.setForm(t.emptyForm());
                      t.resetDizForm();
                    }}
                  >
                    <X className="h-5 w-5 text-gray-400 hover:text-gray-700" />
                  </button>
                </div>

                <div className="flex gap-2">
                  {(['entrada', 'saida'] as const).map((mv) => (
                    <button
                      key={mv}
                      type="button"
                      onClick={() =>
                        t.setForm((p) => ({
                          ...p,
                          tipo_movimento: mv,
                          tipo_recebimento: mv === 'entrada' ? 'oferta' : '',
                          categoria_saida: '',
                        }))
                      }
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition ${
                        t.form.tipo_movimento === mv
                          ? mv === 'entrada'
                            ? 'bg-green-600 text-white border-green-600'
                            : 'bg-red-500 text-white border-red-500'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {mv === 'entrada' ? '↑ Entrada (Receita)' : '↓ Saída (Despesa)'}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Caixa / Congregação */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Caixa</label>
                    {t.scope.isFinanceiroLocal ? (
                      <input
                        readOnly
                        value={t.congNome(t.scope.congregacaoId)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500"
                      />
                    ) : (
                      <select
                        value={t.form.congregacao_id}
                        onChange={(e) => t.setForm((p) => ({ ...p, congregacao_id: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="">Selecione o(a) {t.nomenclaturas?.divisao1 || 'congregação'} *</option>
                        {t.congregacoes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nome}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Tipo de Entrada ou Categoria de Saída */}
                  {t.form.tipo_movimento === 'entrada' ? (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Tipo de recebimento <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={t.form.tipo_recebimento}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          t.setForm((p) => {
                            let autoCatId = p.categoria_id;
                            if (val === 'dizimo') {
                              const catDiz = t.finCategorias.find((c) =>
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
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="">Selecione</option>
                        {t.TIPOS.map((tr) => (
                          <option key={tr.value} value={tr.value}>
                            {tr.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Categoria da despesa</label>
                      <select
                        value={t.form.categoria_saida}
                        onChange={(e) => t.setForm((p) => ({ ...p, categoria_saida: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="">Selecione</option>
                        {t.TIPOS_SAIDA.map((ts) => (
                          <option key={ts.value} value={ts.value}>
                            {ts.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Departamento */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Departamento</label>
                    <select
                      value={t.form.departamento_id}
                      onChange={(e) => t.setForm((p) => ({ ...p, departamento_id: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">Caixa da Igreja</option>
                      {t.departamentos.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.sigla} – {d.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* LINHA INTEIRA: Bloco de Identificação do Dizimista (se Tipo === 'dizimo') */}
                  {t.form.tipo_movimento === 'entrada' && t.form.tipo_recebimento === 'dizimo' && (
                    <div className="col-span-full p-4 bg-slate-50/80 border border-slate-200 rounded-xl space-y-3 shadow-xs">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        {/* Coluna 1: Identificação do Dizimista + Checkbox Avulso */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <label className="block text-xs font-bold text-[#123b63]">
                              Identificação do Dizimista
                            </label>
                            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={!!t.form.is_dizimo_avulso}
                                onChange={(e) =>
                                  t.setForm((p) => ({
                                    ...p,
                                    is_dizimo_avulso: e.target.checked,
                                    dizimista_id: e.target.checked ? '' : p.dizimista_id,
                                    dizimista_nome: e.target.checked ? '' : p.dizimista_nome,
                                  }))
                                }
                                className="w-4 h-4 text-[#123b63] rounded border-gray-300 focus:ring-[#123b63]"
                              />
                              <span className="font-semibold text-gray-700">Dízimo Avulso</span>
                              <span className="text-[10px] text-gray-400">(dispensar nome)</span>
                            </label>
                          </div>

                          {!t.form.is_dizimo_avulso ? (
                            <DizimistaSearchInput
                              dizimistas={t.dizimistasFiltrados}
                              selectedNome={t.form.dizimista_nome || ''}
                              onSelectDizimista={(diz) => {
                                const dizCompleto = t.dizimistasFiltrados.find((item) => item.id === diz?.id);
                                t.setForm((p) => ({
                                  ...p,
                                  dizimista_id: diz?.id || '',
                                  dizimista_nome: diz?.nome || '',
                                  congregacao_id: dizCompleto?.congregacaoId || p.congregacao_id,
                                  observacoes: diz?.nome ? `Dízimo de ${diz.nome}` : p.observacoes,
                                }));
                              }}
                            />
                          ) : (
                            <div className="text-xs text-gray-500 italic bg-gray-100 px-3 py-2 rounded-lg border border-gray-200">
                              Lançamento marcado como Dízimo Avulso.
                            </div>
                          )}
                        </div>

                        {/* Coluna 2: Congregação do Dizimista */}
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-gray-600">Congregação do Dizimista</label>
                          <input
                            type="text"
                            readOnly
                            value={
                              t.form.is_dizimo_avulso
                                ? '— (Dízimo Avulso)'
                                : t.dizimistasFiltrados.find((d) => d.id === t.form.dizimista_id)?.congregacaoNome ||
                                  (t.form.congregacao_id ? t.congNome(t.form.congregacao_id) : 'Selecione o dizimista')
                            }
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 font-medium h-[38px]"
                          />
                        </div>

                        {/* Coluna 3: Cargo / Vínculo do Dizimista */}
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-gray-600">Cargo / Vínculo</label>
                          <input
                            type="text"
                            readOnly
                            value={
                              t.form.is_dizimo_avulso
                                ? 'Dízimo Avulso'
                                : t.dizimistasFiltrados.find((d) => d.id === t.form.dizimista_id)?.tipoCadastro
                                ? t.dizimistasFiltrados.find((d) => d.id === t.form.dizimista_id)?.tipoCadastro?.toUpperCase()
                                : '—'
                            }
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 font-medium h-[38px]"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Valor */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Valor (R$) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0,00"
                      value={t.form.valor}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^\d,]/g, '');
                        t.setForm((p) => ({ ...p, valor: raw }));
                      }}
                      onBlur={(e) => {
                        const raw = e.target.value.replace(/\./g, '').replace(',', '.');
                        const num = parseFloat(raw);
                        if (!isNaN(num) && num > 0) {
                          t.setForm((p) => ({
                            ...p,
                            valor: num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                          }));
                        }
                      }}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>

                  {/* Data */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Data <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={t.form.data_lancamento}
                      onChange={(e) => t.setForm((p) => ({ ...p, data_lancamento: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>



                  {/* Conta / Caixa */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Conta / Caixa</label>
                    {t.finContas.length === 0 ? (
                      <div className="w-full border border-dashed border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-400 flex items-center justify-between gap-2">
                        <span>Nenhuma conta cadastrada.</span>
                        <button
                          type="button"
                          onClick={() => {
                            t.setShowForm(false);
                            t.setAba('contas');
                          }}
                          className="text-[#123b63] font-semibold hover:underline whitespace-nowrap"
                        >
                          + Cadastrar
                        </button>
                      </div>
                    ) : (
                      <select
                        value={t.form.conta_id}
                        onChange={(e) => t.setForm((p) => ({ ...p, conta_id: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="">Padrão do ministério</option>
                        {t.finContas.map((c) => (
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
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      {t.form.tipo_movimento === 'saida' ? 'Forma de Saída' : 'Forma de Entrada'}
                    </label>
                    <select
                      value={t.form.forma_pagamento}
                      onChange={(e) => t.setForm((p) => ({ ...p, forma_pagamento: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="EM ESPÉCIE">EM ESPÉCIE</option>
                      <option value="PIX">PIX</option>
                      <option value="CARTÃO DE CRÉDITO">CARTÃO DE CRÉDITO</option>
                      <option value="DEPÓSITO BANCÁRIO">DEPÓSITO BANCÁRIO</option>
                      <option value="BOLETO">BOLETO</option>
                    </select>
                  </div>

                  {/* Categoria financeira */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Categoria financeira</label>
                    {t.finCategorias.length === 0 ? (
                      <div className="w-full border border-dashed border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-400 flex items-center justify-between gap-2">
                        <span>Sem categorias disponíveis.</span>
                        <button
                          type="button"
                          onClick={() => {
                            t.setShowForm(false);
                            t.setAba('categorias');
                          }}
                          className="text-[#123b63] font-semibold hover:underline whitespace-nowrap"
                        >
                          Configurar
                        </button>
                      </div>
                    ) : (
                      <select
                        value={t.form.categoria_id}
                        onChange={(e) => t.setForm((p) => ({ ...p, categoria_id: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="">Sem categoria</option>
                        {t.finCategorias
                          .filter((c) => c.tipo_movimento === t.form.tipo_movimento || c.tipo_movimento === 'ambos')
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.icone ? `${c.icone} ` : ''}
                              {c.nome}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>

                  {/* Referência */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Referência (evento/campanha)</label>
                    <input
                      type="text"
                      placeholder="Ex: Festa das Nações"
                      value={t.form.referencia}
                      onChange={(e) => t.setForm((p) => ({ ...p, referencia: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>

                  {/* Observações */}
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Observações</label>
                    <textarea
                      rows={2}
                      placeholder="Observações do lançamento..."
                      value={t.form.observacoes}
                      onChange={(e) => {
                        const val = e.target.value;
                        t.setForm((p) => ({ ...p, observacoes: val, descricao: val }));
                      }}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#123b63]"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={t.handleSave}
                    disabled={t.saving}
                    className="px-6 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition disabled:opacity-50"
                  >
                    {t.saving ? 'Salvando...' : t.editId ? 'Atualizar' : 'Registrar'}
                  </button>
                  <button
                    onClick={() => {
                      t.setShowForm(false);
                      t.setEditId(null);
                      t.setForm(t.emptyForm());
                      t.resetDizForm();
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Tabela de Lançamentos */}
            <TesourariaTable
              lancsFiltrados={t.lancsFiltrados}
              fmtDate={t.fmtDate}
              fmtBRL={t.fmtBRL}
              TIPOS_SAIDA={t.TIPOS_SAIDA}
              tipoCor={t.tipoCor}
              tipoLabel={t.tipoLabel}
              totalFiltrado={t.entradasFiltradas - t.saidasFiltradas}
              scope={t.scope}
              handleEdit={t.handleEdit}
              setConfirmDel={t.setConfirmDel}
            />

            {/* Confirm delete lançamento */}
            <ConfirmDeleteModal
              isOpen={!!t.confirmDel}
              onClose={() => t.setConfirmDel(null)}
              onConfirm={() => t.handleDelete(t.confirmDel!)}
              title="⚠️ Excluir Lançamento Financeiro"
              description="Esta é uma ação sensível. O lançamento será removido do saldo do período e os dados anteriores serão salvos permanentemente no histórico de auditoria do sistema."
              confirmText="Sim, Excluir Lançamento"
            />
          </div>
        )}

        {/* ─── ABA: VISÃO GERAL / DASHBOARD ─── */}
        {t.aba === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-1">
                <p className="text-xs font-semibold text-gray-400 uppercase">Entradas no Mês</p>
                <p className="text-2xl font-bold text-green-600">{t.fmtBRL(t.entradasFiltradas)}</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-1">
                <p className="text-xs font-semibold text-gray-400 uppercase">Saídas no Mês</p>
                <p className="text-2xl font-bold text-red-500">{t.fmtBRL(t.saidasFiltradas)}</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-1">
                <p className="text-xs font-semibold text-gray-400 uppercase">Saldo do Período</p>
                <p
                  className={`text-2xl font-bold ${
                    t.entradasFiltradas - t.saidasFiltradas >= 0 ? 'text-[#123b63]' : 'text-red-600'
                  }`}
                >
                  {t.fmtBRL(t.entradasFiltradas - t.saidasFiltradas)}
                </p>
              </div>
            </div>

            {/* Gráficos de Evolução Mensal */}
            <TesourariaCharts
              lancamentos={t.lancamentosMes}
              fmtBRL={t.fmtBRL}
              filtroMes={t.filtroMes}
            />
          </div>
        )}

        {/* ─── ABA: RELATÓRIOS ─── */}
        {t.aba === 'relatorios' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-gray-200">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Mês de Referência</label>
                  <MonthPicker
                    value={t.relMes}
                    onChange={t.setRelMes}
                    className="h-[36px]"
                  />
                </div>
                {t.congregacoes.length > 0 && !t.scope.isFinanceiroLocal && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">{t.nomenclaturas.divisao1}</label>
                    <select
                      value={t.relCong}
                      onChange={(e) => t.setRelCong(e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#123b63]"
                    >
                      <option value="">Todas as unidades</option>
                      {t.congregacoes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo de Movimento</label>
                  <select
                    value={t.relTipoRel}
                    onChange={(e) => t.setRelTipoRel(e.target.value as any)}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#123b63]"
                  >
                    <option value="ambos">Entradas e Saídas</option>
                    <option value="entradas">Apenas Entradas</option>
                    <option value="saidas">Apenas Saídas</option>
                  </select>
                </div>
                <div className="self-end">
                  <button
                    onClick={() => {
                      t.setRelCong('');
                      t.setRelTipoRel('ambos');
                    }}
                    disabled={t.relCong === '' && t.relTipoRel === 'ambos'}
                    className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm transition h-[36px] ${
                      t.relCong === '' && t.relTipoRel === 'ambos'
                        ? 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'
                        : 'border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300'
                    }`}
                  >
                    Limpar Filtros
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => t.exportarCSV(t.lancsRelatorioFiltrados, `relatorio_tesouraria_${t.relMes}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 font-medium transition"
                >
                  Exportar CSV
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#123b63] text-white rounded-lg text-sm hover:bg-[#0f2a45] font-medium transition"
                >
                  <Printer className="h-4 w-4" /> Imprimir
                </button>
              </div>
            </div>

            {/* Relatório Resumo */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <h3 className="font-bold text-[#123b63] text-sm">Resumo Financeiro — {t.relMes}</h3>
                <span className="text-xs text-gray-500">{t.lancsRelatorioFiltrados.length} lançamentos encontrados</span>
              </div>
              <div className="p-4">
                <TesourariaTable
                  lancsFiltrados={t.lancsRelatorioFiltrados}
                  fmtDate={t.fmtDate}
                  fmtBRL={t.fmtBRL}
                  TIPOS_SAIDA={t.TIPOS_SAIDA}
                  tipoCor={t.tipoCor}
                  tipoLabel={t.tipoLabel}
                  totalFiltrado={t.entradasRelatorio - t.saidasRelatorio}
                  scope={t.scope}
                  handleEdit={t.handleEdit}
                  setConfirmDel={t.setConfirmDel}
                />
              </div>
            </div>
          </div>
        )}

        {/* ─── ABA: FECHAMENTO DE CAIXA ─── */}
        {t.aba === 'fechamento' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <div>
                <h2 className="text-base font-bold text-[#123b63]">Fechamento de Caixa</h2>
                <p className="text-sm text-gray-500">
                  Gestão e encerramento de períodos financeiros por congregação / unidade
                </p>
              </div>
            </div>

            <FechamentoCaixaTable
              congregacoes={t.congregacoes}
              fechamentos={t.fechamentos}
              filtroMes={t.filtroMes}
              fmtBRL={t.fmtBRL}
              onAbrirModalFechamento={(congId) => {
                const [ano, mes] = t.filtroMes.split('-');
                const ultDiaObj = new Date(Number(ano), Number(mes), 0);
                const ultDiaDefault = `${ano}-${mes}-${String(ultDiaObj.getDate()).padStart(2, '0')}`;

                const fechamentoAnterior = t.fechamentos.find(
                  (f) => (f.congregacao_id === congId || (f as any).cong_id === congId)
                );

                if (fechamentoAnterior && (fechamentoAnterior as any).data_fim) {
                  const dataFimAnt = new Date((fechamentoAnterior as any).data_fim + 'T00:00:00');
                  dataFimAnt.setDate(dataFimAnt.getDate() + 1);
                  const proxDiaStr = dataFimAnt.toISOString().split('T')[0];
                  t.setFechaDataInicio(proxDiaStr);

                  if (fechamentoAnterior.saldo_final !== undefined) {
                    t.setFechaSaldoInicial(String(fechamentoAnterior.saldo_final));
                  }
                } else {
                  t.setFechaDataInicio(`${ano}-${mes}-01`);
                  t.setFechaSaldoInicial('0,00');
                }

                t.setFechaDataFim(ultDiaDefault);
                t.setFechaCongId(congId);
                t.setShowFechaModal(true);
              }}
              onImprimirFechamento={() => {
                window.print();
              }}
            />

            <FechamentoCaixaModal
              isOpen={t.showFechaModal}
              onClose={() => {
                t.setShowFechaModal(false);
                t.setFechaCongId(null);
              }}
              cxModal={t.statusMes.find((cx) => cx.id === t.fechaCongId) ?? t.statusMes[0]}
              fechaDataInicio={t.fechaDataInicio}
              setFechaDataInicio={t.setFechaDataInicio}
              fechaDataFim={t.fechaDataFim}
              setFechaDataFim={t.setFechaDataFim}
              fechaSaldoInicial={t.fechaSaldoInicial}
              setFechaSaldoInicial={t.setFechaSaldoInicial}
              fechaObs={t.fechaObs}
              setFechaObs={t.setFechaObs}
              salvandoFecha={t.salvandoFecha}
              handleFecharMes={t.handleFecharMes}
              entLivePeriodo={t.entradasFiltradas}
              saiLivePeriodo={t.saidasFiltradas}
              saldoFinalModal={(parseFloat(t.fechaSaldoInicial.replace(',', '.')) || 0) + t.entradasFiltradas - t.saidasFiltradas}
              fmtBRL={t.fmtBRL}
            />
          </div>
        )}

        {/* ─── ABA: DIZIMISTAS ─── */}
        {t.aba === 'dizimistas' && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Mês de Referência</label>
                  <MonthPicker
                    value={t.abaDizimistaMes}
                    onChange={(val) => t.setAbaDizimistaMes(val)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Buscar por Nome</label>
                  <input
                    type="text"
                    placeholder="Nome do dizimista..."
                    value={t.filtroNomeDiz}
                    onChange={(e) => t.setFiltroNomeDiz(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#123b63] h-[36px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Congregação</label>
                  <select
                    value={t.filtroCongDiz}
                    onChange={(e) => t.setFiltroCongDiz(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#123b63] h-[36px] max-w-[180px]"
                  >
                    <option value="">Todas as Congregações</option>
                    {t.congregacoes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Status de Adimplência</label>
                  <select
                    value={t.filtroStatusDiz}
                    onChange={(e) => t.setFiltroStatusDiz(e.target.value as any)}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#123b63] h-[36px]"
                  >
                    <option value="">Todos os Status</option>
                    <option value="pago">Adimplentes (Pago)</option>
                    <option value="pendente">Inadimplentes (Pendente)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                <button
                  onClick={() =>
                    t.exportarCSV(
                      t.dizimistasFiltrados.map((d) => ({
                        Nome: d.nome,
                        Tipo: d.tipoCadastro,
                        Congregacao: d.congregacaoNome,
                        Status: d.pagoNoMes ? 'Pago' : 'Pendente',
                        Valor: d.valorPago,
                        DataPagamento: d.dataPagamento || '—',
                      })),
                      `relatorio_dizimistas_${t.abaDizimistaMes}`
                    )
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 font-medium transition h-[36px]"
                >
                  Exportar CSV
                </button>

                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 font-medium transition h-[36px]"
                >
                  <Printer className="h-4 w-4" /> Relatório
                </button>

                {t.scope.canWrite && (
                  <button
                    onClick={() => {
                      const catDiz = t.finCategorias.find((c) =>
                        (c.tipo_movimento === 'entrada' || c.tipo_movimento === 'ambos') &&
                        (c.nome.toLowerCase().includes('dízimo') || c.nome.toLowerCase().includes('dizimo'))
                      );
                      t.setAba('lancamentos');
                      t.setShowForm(true);
                      t.setForm((p) => ({
                        ...p,
                        tipo_movimento: 'entrada',
                        tipo_recebimento: 'dizimo',
                        categoria_id: catDiz?.id || p.categoria_id,
                      }));
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition h-[36px]"
                  >
                    <Plus className="h-4 w-4" /> Registrar Dízimo
                  </button>
                )}
              </div>
            </div>

            <DizimistasTable
              dizimistas={t.dizimistasFiltrados}
              fmtBRL={t.fmtBRL}
              onRegistrarDizimo={(dizimista) => {
                const catDiz = t.finCategorias.find((c) =>
                  (c.tipo_movimento === 'entrada' || c.tipo_movimento === 'ambos') &&
                  (c.nome.toLowerCase().includes('dízimo') || c.nome.toLowerCase().includes('dizimo'))
                );
                t.setAba('lancamentos');
                t.setShowForm(true);
                t.setForm((p) => ({
                  ...p,
                  tipo_movimento: 'entrada',
                  tipo_recebimento: 'dizimo',
                  categoria_id: catDiz?.id || p.categoria_id,
                  dizimista_id: dizimista.id,
                  dizimista_nome: dizimista.nome,
                  is_dizimo_avulso: false,
                  observacoes: `Dízimo de ${dizimista.nome}`,
                  congregacao_id: dizimista.congregacaoId || p.congregacao_id,
                }));
              }}
            />
          </div>
        )}

        {/* ─── ABA: CONTAS / CAIXAS ─── */}
        {t.aba === 'contas' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200">
              <div>
                <h2 className="text-base font-bold text-[#123b63]">Contas e Caixas</h2>
                <p className="text-sm text-gray-500">Contas bancárias e caixas do ministério</p>
              </div>
              {t.scope.canWrite && (
                <button
                  onClick={() => {
                    t.setFormConta(t.emptyFormConta());
                    t.setContaEditId(null);
                    t.setShowContaModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition"
                >
                  <Plus className="h-4 w-4" /> Nova Conta
                </button>
              )}
            </div>

            {/* Listagem de Contas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {t.finContas.length === 0 ? (
                <div className="col-span-full bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-400 text-sm">
                  Nenhuma conta cadastrada. Clique no botão acima para adicionar.
                </div>
              ) : (
                t.finContas.map((c) => (
                  <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                          <Building2 className="h-4 w-4 text-[#123b63]" />
                          {c.nome}
                          {c.is_padrao && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-semibold">Padrão</span>}
                        </h3>
                      </div>
                    </div>

                    {t.scope.canWrite && (
                      <div className="pt-3 mt-3 border-t border-gray-100 flex justify-end gap-2">
                        <button
                          onClick={() => {
                            t.setContaEditId(c.id);
                            t.setShowContaModal(true);
                          }}
                          className="text-xs text-[#123b63] font-semibold hover:underline"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => t.setConfirmDelConta(c.id)}
                          className="text-xs text-red-600 font-semibold hover:underline"
                        >
                          Excluir
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <ContaBancariaModal
              isOpen={t.showContaModal}
              onClose={() => {
                t.setShowContaModal(false);
                t.setContaEditId(null);
                t.setFormConta(t.emptyFormConta());
              }}
              formConta={t.formConta}
              setFormConta={t.setFormConta}
              contaEditId={t.contaEditId}
              savingConta={t.savingConta}
              handleSaveConta={t.handleSaveConta}
              TIPOS_CONTA={t.TIPOS_CONTA}
            />

            <ConfirmDeleteModal
              isOpen={!!t.confirmDelConta}
              onClose={() => t.setConfirmDelConta(null)}
              onConfirm={() => t.handleDeleteConta(t.confirmDelConta!)}
              title="Excluir Conta"
              description="Esta ação não pode ser desfeita."
              warningText="Lançamentos vinculados perderão a referência de conta."
              confirmText="Excluir"
            />
          </div>
        )}

        {/* ─── ABA: CATEGORIAS ─── */}
        {t.aba === 'categorias' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200">
              <div>
                <h2 className="text-base font-bold text-[#123b63]">Categorias Financeiras</h2>
                <p className="text-sm text-gray-500">Categorias de plano de contas para entradas e saídas</p>
              </div>
              {t.scope.canDelete && (
                <button
                  onClick={() => {
                    t.setFormCat(t.emptyFormCat());
                    t.setCatEditId(null);
                    t.setShowCatModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition"
                >
                  <Plus className="h-4 w-4" /> Nova Categoria
                </button>
              )}
            </div>

            {/* Listagem de Categorias */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {t.finCategorias.length === 0 ? (
                <div className="col-span-full bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-400 text-sm">
                  Nenhuma categoria cadastrada.
                </div>
              ) : (
                t.finCategorias.map((cat) => (
                  <div key={cat.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-base">
                        {cat.icone || <Tag className="h-4 w-4 text-gray-500" />}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800 text-sm">{cat.nome}</h4>
                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          cat.tipo_movimento === 'entrada' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {cat.tipo_movimento}
                        </span>
                      </div>
                    </div>

                    {t.scope.canDelete && (
                      <button
                        onClick={() => t.setConfirmDelCat(cat.id)}
                        className="text-xs text-red-600 font-semibold hover:underline"
                      >
                        Excluir
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <CategoriaFinanceiraModal
              isOpen={t.showCatModal}
              onClose={() => {
                t.setShowCatModal(false);
                t.setCatEditId(null);
                t.setFormCat(t.emptyFormCat());
              }}
              formCat={t.formCat}
              setFormCat={t.setFormCat}
              catEditId={t.catEditId}
              savingCat={t.savingCat}
              handleSaveCat={t.handleSaveCat}
              categoriasFull={t.categoriasFull}
            />

            <ConfirmDeleteModal
              isOpen={!!t.confirmDelCat}
              onClose={() => t.setConfirmDelCat(null)}
              onConfirm={() => t.handleDeleteCat(t.confirmDelCat!)}
              title="Excluir Categoria"
              description="Esta ação não pode ser desfeita."
              warningText="Lançamentos vinculados perderão a referência de categoria."
              confirmText="Excluir"
            />
          </div>
        )}

        {/* ─── ABA: ARRECADAÇÃO DIGITAL ─── */}
        {t.aba === 'arrecadacao' && (
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-xl border border-gray-200 space-y-3 text-center max-w-lg mx-auto my-8">
              <QrCode className="h-12 w-12 text-[#123b63] mx-auto" />
              <h3 className="text-base font-bold text-gray-800">Arrecadação Digital PIX</h3>
              <p className="text-sm text-gray-500">
                Gerencie os links de doação digital, ofertas e QR Codes cadastrados no seu plano.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bloco Exclusivo de Impressão (Oculto em visualização normal e exibido no @media print) */}
      <div className="print-only hidden p-8 bg-white text-black space-y-6">
        {/* Timbre da Igreja */}
        <div className="flex items-center gap-5 border-b pb-4 border-gray-300">
          {t.ministerio?.logo ? (
            <img
              src={t.ministerio.logo}
              alt="Logo da Igreja"
              className="max-h-20 max-w-[120px] object-contain"
            />
          ) : (
            <div className="w-[100px] h-[100px] bg-gray-100 flex items-center justify-center text-xs text-gray-400 border border-gray-200">
              Sem Logo
            </div>
          )}
          <div className="space-y-1">
            <h1 className="text-lg font-bold uppercase text-gray-800">
              {t.ministerio?.nome || 'Gestão Eklesia — Igreja Registrada'}
            </h1>
            <p className="text-xs text-gray-500 font-medium">
              {t.ministerio?.endereco && `Endereço: ${t.ministerio.endereco}`}
            </p>
            <div className="flex gap-4 text-xs text-gray-500 font-medium">
              {t.ministerio?.cnpj && <span>CNPJ: {t.ministerio.cnpj}</span>}
              {t.ministerio?.telefone && <span>Telefone: {t.ministerio.telefone}</span>}
              {t.ministerio?.email && <span>E-mail: {t.ministerio.email}</span>}
            </div>
          </div>
        </div>

        {/* Título do Relatório */}
        <div className="space-y-1">
          <h2 className="text-base font-bold uppercase tracking-wider text-gray-700">
            Relatório de Movimentação Financeira — Tesouraria
          </h2>
          <p className="text-xs text-gray-400">
            Período de Referência: <span className="font-semibold text-gray-600">{t.relMes}</span>
          </p>
        </div>

        {/* Tabela do Relatório Formato A4 */}
        <table className="w-full border-collapse text-xs text-left">
          <thead>
            <tr className="border-b border-gray-300 bg-gray-50">
              <th className="py-2.5 px-2 font-bold text-gray-600">Data</th>
              <th className="py-2.5 px-2 font-bold text-gray-600">Caixa</th>
              <th className="py-2.5 px-2 font-bold text-gray-600">Departamento</th>
              <th className="py-2.5 px-2 font-bold text-gray-600">Tipo</th>
              <th className="py-2.5 px-2 font-bold text-gray-600">Descrição / Ref.</th>
              <th className="py-2.5 px-2 font-bold text-gray-600 text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {t.lancsRelatorioFiltrados.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-4 text-center text-gray-400">
                  Nenhum lançamento encontrado no período selecionado.
                </td>
              </tr>
            ) : (
              t.lancsRelatorioFiltrados.map((l) => (
                <tr key={l.id} className="border-b border-gray-100">
                  <td className="py-2 px-2">{t.fmtDate(l.data_lancamento)}</td>
                  <td className="py-2 px-2 uppercase font-medium">{t.congNome(l.congregacao_id)}</td>
                  <td className="py-2 px-2">{l.departamento_nome || 'Caixa Geral'}</td>
                  <td className="py-2 px-2 font-medium capitalize">
                    {t.tipoLabel(l.tipo_recebimento || l.tipo_movimento)}
                  </td>
                  <td className="py-2 px-2 text-gray-500">{l.referencia || l.observacoes || '—'}</td>
                  <td
                    className={`py-2 px-2 text-right font-bold ${
                      l.tipo_movimento === 'entrada' ? 'text-green-600' : 'text-red-500'
                    }`}
                  >
                    {l.tipo_movimento === 'entrada' ? '+' : '-'} {t.fmtBRL(l.valor)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 font-bold bg-gray-50">
              <td colSpan={5} className="py-2.5 px-2 text-right text-gray-700">Totalizadores:</td>
              <td className="py-2.5 px-2 text-right text-[#123b63]">
                {t.fmtBRL(t.entradasRelatorio - t.saidasRelatorio)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Assinatura Responsável */}
        <div className="pt-12 flex justify-around text-center text-xs">
          <div className="space-y-1">
            <div className="w-48 border-b border-gray-400 mx-auto"></div>
            <p className="font-semibold text-gray-700">Assinatura do Tesoureiro</p>
          </div>
          <div className="space-y-1">
            <div className="w-48 border-b border-gray-400 mx-auto"></div>
            <p className="font-semibold text-gray-700">Assinatura do Pastor / Dirigente</p>
          </div>
        </div>
      </div>

      {/* Regras CSS globais injetadas para gerenciar visualização no print */}
      <style jsx global>{`
        @media print {
          /* Oculta tudo que não for o bloco exclusivo de impressão */
          body * {
            visibility: hidden !important;
          }
          .print-only, .print-only * {
            visibility: visible !important;
          }
          .print-only {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          /* Oculta elementos do sistema Next.js e menus */
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </PageLayout>
  );
}
