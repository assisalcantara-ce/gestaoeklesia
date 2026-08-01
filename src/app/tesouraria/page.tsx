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
import { useTesouraria } from '@/hooks/tesouraria/useTesouraria';

// Componente simples para picker de mês
function MonthPicker({ value, onChange, className = '' }: { value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <input
      type="month"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#123b63] ${className}`}
    />
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
                          tipo_recebimento: '',
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
                        <option value="">Selecione a congregação *</option>
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
                        onChange={(e) => t.setForm((p) => ({ ...p, tipo_recebimento: e.target.value as any }))}
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
              title="Excluir Lançamento"
              description="Tem certeza que deseja remover este lançamento financeiro?"
              confirmText="Excluir"
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
          </div>
        )}

        {/* ─── ABA: FECHAMENTO DE CAIXA ─── */}
        {t.aba === 'fechamento' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-[#123b63]">Fechamento de Caixa</h2>
                <p className="text-sm text-gray-500">
                  Encerramento de períodos financeiros por congregação
                </p>
              </div>
            </div>

            <FechamentoCaixaModal
              isOpen={t.showFechaModal}
              onClose={() => {
                t.setShowFechaModal(false);
                t.setFechaCongId(null);
              }}
              cxModal={t.statusMes.find((cx) => cx.id === t.fechaCongId) ?? t.statusMes[0]}
              fechaDataInicio={t.fechaDataInicio}
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
              saldoFinalModal={t.entradasFiltradas - t.saidasFiltradas}
              fmtBRL={t.fmtBRL}
            />
          </div>
        )}

        {/* ─── ABA: CONTAS / CAIXAS ─── */}
        {t.aba === 'contas' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
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
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-[#123b63]">Categorias Financeiras</h2>
                <p className="text-sm text-gray-500">Categorias de plano de contas</p>
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
      </div>
    </PageLayout>
  );
}
