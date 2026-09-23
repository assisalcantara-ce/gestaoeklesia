'use client';

export const dynamic = 'force-dynamic';

import PageLayout from '@/components/PageLayout';
import NotificationModal from '@/components/NotificationModal';
import { Plus, TrendingUp, Building2, Tag, Users, Lock, List, Printer, QrCode, UserPlus, FileText, Pencil, Trash2, Wallet, Landmark, Sparkles } from 'lucide-react';
import TesourariaTable from '@/components/tesouraria/TesourariaTable';
import TesourariaToolbar from '@/components/tesouraria/TesourariaToolbar';
import FechamentoCaixaModal from '@/components/tesouraria/modals/FechamentoCaixaModal';
import ContaBancariaModal from '@/components/tesouraria/modals/ContaBancariaModal';
import CategoriaFinanceiraModal from '@/components/tesouraria/modals/CategoriaFinanceiraModal';
import ConfirmDeleteModal from '@/components/tesouraria/modals/ConfirmDeleteModal';
import ConfirmDuplicidadeCodigoModal from '@/components/tesouraria/modals/ConfirmDuplicidadeCodigoModal';
import AdicionarDizimistaModal from '@/components/tesouraria/modals/AdicionarDizimistaModal';
import TesourariaCharts from '@/components/tesouraria/TesourariaCharts';
import FechamentoCaixaTable from '@/components/tesouraria/FechamentoCaixaTable';
import DizimistasTable from '@/components/tesouraria/DizimistasTable';
import NovoLancamentoModal from '@/components/tesouraria/modals/NovoLancamentoModal';
import DestinoQrModal from '@/components/tesouraria/modals/DestinoQrModal';
import DestinoModal from '@/components/tesouraria/modals/DestinoModal';
import EditarClassificacaoLancamentoModal from '@/components/tesouraria/modals/EditarClassificacaoLancamentoModal';
import ArrecadacaoDigitalContent from '@/components/tesouraria/ArrecadacaoDigitalContent';
import FaturasContent from '@/components/tesouraria/FaturasContent';
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
            { id: 'faturas' as const, label: 'Faturas', icon: FileText },
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
              filtroCategoria={t.filtroCategoria}
              setFiltroCategoria={t.setFiltroCategoria}
              filtroOrigem={t.filtroOrigem}
              setFiltroOrigem={t.setFiltroOrigem}
              filtroCong={t.filtroCong}
              setFiltroCong={t.setFiltroCong}
              filtroDept={t.filtroDept}
              setFiltroDept={t.setFiltroDept}
              scope={t.scope}
              congregacoes={t.congregacoes}
              departamentos={t.departamentos}
              finCategorias={t.finCategorias}
              TIPOS={t.TIPOS}
              TIPOS_SAIDA={t.TIPOS_SAIDA}
              MonthPicker={MonthPicker}
              onNovoClick={t.handleNovoLancamento}
              lancamentosMesCount={t.lancamentosMes.length}
              onExportarCSV={() => t.exportarCSV(t.lancsFiltrados, `lancamentos-${t.filtroMes}`)}
              lancsFiltradosCount={t.lancsFiltrados.length}
              entradasFiltradas={t.entradasFiltradas}
              saidasFiltradas={t.saidasFiltradas}
              fmtBRL={t.fmtBRL}
              loadingMes={t.loadingMes}
            />

            {/* Modal Novo Lançamento */}
            <NovoLancamentoModal
              isOpen={t.showForm}
              onClose={() => {
                t.setShowForm(false);
                t.setEditId(null);
                t.setForm(t.emptyForm());
                t.resetDizForm();
              }}
              form={t.form}
              setForm={t.setForm}
              editId={t.editId}
              saving={t.saving}
              handleSave={t.handleSave}
              resetDizForm={t.resetDizForm}
              emptyForm={t.emptyForm}
              setShowForm={t.setShowForm}
              setEditId={t.setEditId}
              setAba={t.setAba}
              scope={t.scope}
              congNome={t.congNome}
              nomenclaturas={t.nomenclaturas}
              congregacoes={t.congregacoes}
              departamentos={t.departamentos}
              finContas={t.finContas}
              finCategorias={t.finCategorias}
              dizimistasFormulario={t.dizimistasFormulario}
              dizimistasCompletos={t.dizimistasCompletos}
              TIPOS={t.TIPOS}
              TIPOS_SAIDA={t.TIPOS_SAIDA}
            />

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
              finContas={t.finContas}
              finCategorias={t.finCategorias}
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

            {/* Modal de Aviso de Código de Registro Duplicado */}
            <ConfirmDuplicidadeCodigoModal
              isOpen={Boolean(t.confirmDuplicidadeCodigo?.open)}
              codigo={t.confirmDuplicidadeCodigo?.codigo || t.form.codigo_registro || ''}
              saving={t.saving}
              onClose={t.handleCancelarDuplicado}
              onConfirm={t.handleConfirmarSalvarDuplicado}
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
                  finContas={t.finContas}
                  finCategorias={t.finCategorias}
                  mostrarCategoria={true}
                />
              </div>
            </div>

            {/* Confirm delete lançamento na aba Relatórios */}
            <ConfirmDeleteModal
              isOpen={Boolean(t.confirmDel)}
              onClose={() => t.setConfirmDel(null)}
              onConfirm={() => t.handleDelete(t.confirmDel!)}
              title="⚠️ Excluir Lançamento Financeiro"
              description="Esta é uma ação sensível. O lançamento será removido do saldo do período e os dados anteriores serão salvos permanentemente no histórico de auditoria do sistema."
              confirmText="Sim, Excluir Lançamento"
            />
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
                  <>
                    <button
                      onClick={() => t.setShowAddDizimistaModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-[#123b63] text-[#123b63] bg-[#123b63]/5 hover:bg-[#123b63]/10 rounded-lg text-sm font-semibold transition h-[36px]"
                    >
                      <UserPlus className="h-4 w-4" /> Adicionar Dizimista
                    </button>
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
                  </>
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
                t.finContas.map((c) => {
                  const isCaixa = c.tipo === 'caixa_fisico' || c.tipo === 'caixa' || !c.banco;
                  return (
                    <div
                      key={c.id}
                      className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between group relative overflow-hidden"
                    >
                      {/* Linha de acento no topo do card */}
                      <div className={`absolute top-0 left-0 right-0 h-1 ${c.is_padrao ? 'bg-gradient-to-r from-[#123b63] to-blue-500' : 'bg-transparent group-hover:bg-slate-200'} transition-all`} />

                      <div>
                        {/* Header do Card com Ícone estilizado e Badges */}
                        <div className="flex items-start justify-between gap-3 mb-3.5">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                              c.is_padrao 
                                ? 'bg-[#123b63] text-white' 
                                : isCaixa 
                                ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' 
                                : 'bg-blue-50 text-[#123b63] border border-blue-100'
                            }`}>
                              {isCaixa ? <Wallet className="h-5 w-5" /> : <Landmark className="h-5 w-5" />}
                            </div>
                            <div>
                              <h3 className="font-bold text-gray-900 text-sm leading-snug">
                                {c.nome}
                              </h3>
                              <p className="text-[11px] text-gray-600 font-medium capitalize mt-0.5">
                                {c.tipo?.replace('_', ' ') || 'Conta'}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            {c.is_padrao && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-50 text-[#123b63] border border-blue-200/70 px-2 py-0.5 rounded-full shadow-xs">
                                <Sparkles className="h-2.5 w-2.5 text-amber-500 fill-amber-500" /> Padrão
                              </span>
                            )}
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              c.is_ativa !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {c.is_ativa !== false ? 'Ativa' : 'Inativa'}
                            </span>
                          </div>
                        </div>

                        {/* Dados Detalhados da Conta */}
                        <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 space-y-1.5 text-xs">
                          {c.banco && (
                            <div className="flex items-center justify-between text-gray-600">
                              <span className="text-gray-600 font-medium">Banco / Instituição:</span>
                              <span className="font-semibold text-gray-800">{c.banco}</span>
                            </div>
                          )}
                          {(c.agencia || c.conta) && (
                            <div className="flex items-center justify-between text-gray-600">
                              <span className="text-gray-600 font-medium">Agência / Conta:</span>
                              <span className="font-semibold font-mono text-gray-800">
                                {c.agencia ? `Ag. ${c.agencia}` : ''} {c.conta ? `• CC ${c.conta}` : ''}
                              </span>
                            </div>
                          )}
                          {c.chave_pix && (
                            <div className="flex items-center justify-between text-gray-600 pt-0.5 border-t border-slate-200/50">
                              <span className="text-gray-600 font-medium">Chave PIX:</span>
                              <span className="font-semibold font-mono text-[#123b63] truncate max-w-[170px]" title={c.chave_pix}>
                                {c.chave_pix}
                              </span>
                            </div>
                          )}
                          {!c.banco && !c.agencia && !c.conta && !c.chave_pix && (
                            <div className="text-gray-600 italic text-[11px] py-1 text-center">
                              Caixa físico / controle interno
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Ações de Edição e Exclusão */}
                      {t.scope.canWrite && (
                        <div className="pt-3 mt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                          <button
                            onClick={() => t.handleEditConta(c)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#123b63] hover:bg-blue-50/80 transition active:scale-95"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span>Editar</span>
                          </button>
                          <button
                            onClick={() => t.setConfirmDelConta(c.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 transition active:scale-95"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Excluir</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-gray-200">
              <div>
                <h2 className="text-base font-bold text-[#123b63]">Categorias Financeiras</h2>
                <p className="text-sm text-gray-500">Gerencie as categorias de receitas e despesas da tesouraria</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                {/* Filtro por Tipo */}
                <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs font-medium">
                  {[
                    { id: '', label: 'Todas' },
                    { id: 'entrada', label: 'Entradas' },
                    { id: 'saida', label: 'Saídas' },
                    { id: 'ambos', label: 'Ambos' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => t.setFiltroCatTipo(tab.id as any)}
                      className={`px-3 py-1.5 rounded-md transition ${
                        t.filtroCatTipo === tab.id
                          ? 'bg-white text-[#123b63] font-bold shadow-xs'
                          : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
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
            </div>

            {/* Listagem de Categorias */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(() => {
                const catsFiltradas = t.finCategorias.filter((cat) => {
                  if (!t.filtroCatTipo) return true;
                  return cat.tipo_movimento === t.filtroCatTipo || cat.tipo_movimento === 'ambos';
                });

                if (catsFiltradas.length === 0) {
                  return (
                    <div className="col-span-full bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-400 text-sm">
                      Nenhuma categoria encontrada para este filtro.
                    </div>
                  );
                }

                return catsFiltradas.map((cat) => {
                  const isTenantCat = !cat.is_sistema && (cat.ministry_id === t.ministryId || (!!cat.ministry_id && !cat.is_sistema));
                  return (
                    <div
                      key={cat.id}
                      className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex items-center justify-between hover:border-slate-300 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-base"
                          style={{ backgroundColor: `${cat.cor || '#6b7280'}18` }}
                        >
                          {cat.icone || <Tag className="h-4 w-4 text-gray-500" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-gray-800 text-sm">{cat.nome}</h4>
                            {cat.codigo && (
                              <span className="text-[10px] font-mono text-gray-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                {cat.codigo}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                cat.tipo_movimento === 'entrada'
                                  ? 'bg-green-100 text-green-800'
                                  : cat.tipo_movimento === 'saida'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {cat.tipo_movimento}
                            </span>
                            {cat.is_sistema ? (
                              <span className="text-[10px] text-gray-400 font-medium bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                Sistema
                              </span>
                            ) : (
                              <span className="text-[10px] text-indigo-600 font-medium bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                Personalizada
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {isTenantCat && (
                        <div className="flex items-center gap-1">
                          {t.scope.canWrite && (
                            <button
                              onClick={() => t.handleEditCat(cat)}
                              title="Editar Categoria"
                              className="p-1.5 text-gray-500 hover:text-[#123b63] hover:bg-slate-100 rounded-lg transition"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {t.scope.canDelete && (
                            <button
                              onClick={() => t.setConfirmDelCat(cat.id)}
                              title="Excluir Categoria"
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
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
              categoriasFull={t.finCategorias}
            />

            {(() => {
              const catParaExcluir = t.finCategorias.find((c) => c.id === t.confirmDelCat);
              return (
                <ConfirmDeleteModal
                  isOpen={!!t.confirmDelCat}
                  onClose={() => t.setConfirmDelCat(null)}
                  onConfirm={() => t.handleDeleteCat(t.confirmDelCat!)}
                  title="Excluir Categoria"
                  description={
                    catParaExcluir
                      ? `Tem certeza que deseja excluir a categoria "${catParaExcluir.nome}"?`
                      : 'Esta ação não pode ser desfeita.'
                  }
                  warningText="Categorias com lançamentos ou subcategorias ativas não poderão ser excluídas para manter a integridade."
                  confirmText="Excluir Categoria"
                />
              );
            })()}
          </div>
        )}

        {/* ─── ABA: ARRECADAÇÃO DIGITAL ─── */}
        {t.aba === 'arrecadacao' && (
          <ArrecadacaoDigitalContent
            congregacoes={t.congregacoes}
            fmtBRL={t.fmtBRL}
            fmtDate={t.fmtDate}
            showModal={t.showModal}
            onOpenNovoDestino={() => {
              t.setDestinoEditId(null);
              t.setShowDestinoModal(true);
            }}
            onOpenQrModal={(destino) => {
              t.setQrDestino(destino as any);
              t.setShowQrModal(true);
            }}
            destinosUpdatedKey={t.destinosUpdatedKey ?? 0}
            nomenclaturas={t.nomenclaturas}
            isFinanceiroLocal={t.scope.isFinanceiroLocal}
            exportarCSV={t.exportarCSV}
            ministerio={t.ministerio}
            congNome={t.congNome}
          />
        )}

        {/* ─── ABA: FATURAS ─── */}
        {t.aba === 'faturas' && (
          <FaturasContent />
        )}
      </div>

      {/* Modais de Arrecadação Digital */}
      <DestinoModal
        isOpen={t.showDestinoModal}
        onClose={() => {
          t.setShowDestinoModal(false);
          t.setDestinoEditId(null);
        }}
        destinoId={t.destinoEditId}
        congregacoes={t.congregacoes}
        contas={t.contasFull}
        categorias={t.categoriasFull}
        onSuccess={() => {
          t.setDestinosUpdatedKey((k: number) => (k ?? 0) + 1);
        }}
        showModal={t.showModal}
      />

      <DestinoQrModal
        isOpen={t.showQrModal}
        onClose={() => {
          t.setShowQrModal(false);
          t.setQrDestino(null);
        }}
        destino={t.qrDestino as any}
        fmtBRL={t.fmtBRL}
      />

      {/* Modal Dedicado de Reclassificação Restrita de Lançamento (Tipo & Dizimista) */}
      <EditarClassificacaoLancamentoModal
        isOpen={Boolean(t.lancamentoEditandoClassificacao)}
        onClose={() => t.setLancamentoEditandoClassificacao(null)}
        lancamento={t.lancamentoEditandoClassificacao}
        onSuccess={() => {
          t.loadLancamentosMes(t.filtroMes);
          t.loadDizimistasData();
        }}
        showModal={t.showModal}
        fmtDate={t.fmtDate}
        fmtBRL={t.fmtBRL}
        congNome={t.congNome}
        finContas={t.contasFull}
        finCategorias={t.categoriasFull}
      />

      {/* Bloco Exclusivo de Impressão de Relatórios (Exibido no @media print APENAS nas abas de relatórios/dizimistas) */}
      {(t.aba === 'relatorios' || t.aba === 'dizimistas') && (
        <div className="print-only hidden p-8 bg-white text-black space-y-6">
          {t.aba === 'relatorios' && (
            <style
              dangerouslySetInnerHTML={{
                __html: `
                  @page {
                    size: A4 landscape !important;
                    margin: 10mm 12mm !important;
                  }
                `,
              }}
            />
          )}

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

        {t.aba === 'dizimistas' ? (
          /* ─── MODELO IMPRESSÃO: RELATÓRIO DE DIZIMISTAS ─── */
          <>
            {/* Título e Filtros Aplicados */}
            <div className="space-y-1">
              <h2 className="text-base font-bold uppercase tracking-wider text-gray-700">
                Relatório de Dizimistas
              </h2>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-600 font-medium">
                <p>
                  Mês de Referência: <span className="font-bold text-gray-800">{t.abaDizimistaMes}</span>
                </p>
                <p>
                  Congregação:{' '}
                  <span className="font-bold text-gray-800">
                    {t.filtroCongDiz ? t.congNome(t.filtroCongDiz) : 'Todas as Congregações'}
                  </span>
                </p>
                <p>
                  Status de Adimplência:{' '}
                  <span className="font-bold text-gray-800">
                    {t.filtroStatusDiz === 'pago'
                      ? 'Adimplentes (Pago)'
                      : t.filtroStatusDiz === 'pendente'
                      ? 'Inadimplentes (Pendente)'
                      : 'Todos os Status'}
                  </span>
                </p>
                {t.filtroNomeDiz && (
                  <p>
                    Busca por Nome: <span className="font-bold text-gray-800">"{t.filtroNomeDiz}"</span>
                  </p>
                )}
              </div>
            </div>

            {/* Tabela de Dizimistas Formato A4 */}
            <table className="w-full border-collapse text-xs text-left">
              <thead>
                <tr className="border-b border-gray-300 bg-gray-50">
                  <th className="py-2.5 px-2 font-bold text-gray-600">Nome do Dizimista</th>
                  <th className="py-2.5 px-2 font-bold text-gray-600">Vínculo / Cargo</th>
                  <th className="py-2.5 px-2 font-bold text-gray-600">Congregação / Caixa</th>
                  <th className="py-2.5 px-2 font-bold text-gray-600 text-center">Status no Mês</th>
                  <th className="py-2.5 px-2 font-bold text-gray-600 text-right">Valor Contribuído</th>
                </tr>
              </thead>
              <tbody>
                {t.dizimistasFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-gray-400">
                      Nenhum dizimista encontrado para os filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  t.dizimistasFiltrados.map((d) => (
                    <tr key={d.id} className="border-b border-gray-100">
                      <td className="py-2 px-2 font-semibold text-gray-800">{d.nome}</td>
                      <td className="py-2 px-2 capitalize text-gray-600">{d.tipoCadastro || 'Membro'}</td>
                      <td className="py-2 px-2 uppercase text-gray-600">{d.congregacaoNome}</td>
                      <td className="py-2 px-2 text-center">
                        <span
                          className={`font-semibold px-2 py-0.5 rounded text-[10px] ${
                            d.pagoNoMes ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50'
                          }`}
                        >
                          {d.pagoNoMes ? 'Adimplente (Pago)' : 'Inadimplente (Pendente)'}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right font-bold text-gray-800">
                        {d.pagoNoMes ? t.fmtBRL(d.valorPago) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 font-bold bg-gray-50 text-xs">
                  <td colSpan={3} className="py-2.5 px-2 text-gray-700">
                    Total: {t.dizimistasFiltrados.length} dizimista(s) | Adimplentes:{' '}
                    {t.dizimistasFiltrados.filter((d) => d.pagoNoMes).length} | Inadimplentes:{' '}
                    {t.dizimistasFiltrados.filter((d) => !d.pagoNoMes).length}
                  </td>
                  <td className="py-2.5 px-2 text-right text-gray-700">Total Contribuído:</td>
                  <td className="py-2.5 px-2 text-right text-[#123b63]">
                    {t.fmtBRL(
                      t.dizimistasFiltrados
                        .filter((d) => d.pagoNoMes)
                        .reduce((acc, curr) => acc + curr.valorPago, 0)
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </>
        ) : (
          /* ─── MODELO IMPRESSÃO: RELATÓRIO FINANCEIRO GERAL ─── */
          <>
            {/* Título do Relatório */}
            <div className="space-y-1">
              <h2 className="text-base font-bold uppercase tracking-wider text-gray-700">
                Relatório de Movimentação Financeira — Tesouraria
              </h2>
              <p className="text-xs text-gray-400">
                Período de Referência: <span className="font-semibold text-gray-600">{t.relMes}</span>
              </p>
            </div>

            {/* Tabela do Relatório Formato A4 Landscape */}
            <table className="w-full border-collapse text-xs text-left">
              <thead>
                <tr className="border-b border-gray-300 bg-gray-50">
                  <th className="py-2.5 px-3 font-bold text-gray-600 whitespace-nowrap">ID / Data</th>
                  <th className="py-2.5 px-3 font-bold text-gray-600">Caixa</th>
                  <th className="py-2.5 px-3 font-bold text-gray-600">Categoria Financeira</th>
                  <th className="py-2.5 px-3 font-bold text-gray-600">Tipo</th>
                  <th className="py-2.5 px-3 font-bold text-gray-600">Descrição / Ref.</th>
                  <th className="py-2.5 px-3 font-bold text-gray-600 text-right whitespace-nowrap">Valor</th>
                </tr>
              </thead>
              <tbody>
                {t.lancsRelatorioFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-gray-400">
                      Nenhum lançamento encontrado no período selecionado.
                    </td>
                  </tr>
                ) : (
                  t.lancsRelatorioFiltrados.map((l) => (
                    <tr key={l.id} className="border-b border-gray-100">
                      <td className="py-2 px-3 whitespace-nowrap">
                        {l.codigo_registro && (
                          <div className="font-mono text-[10px] font-bold text-[#123b63]">
                            {l.codigo_registro}
                          </div>
                        )}
                        <div className="text-gray-500">{t.fmtDate(l.data_lancamento)}</div>
                      </td>
                      <td className="py-2 px-3 uppercase font-medium">{t.congNome(l.congregacao_id)}</td>
                      <td className="py-2 px-3 text-gray-700">
                        {(() => {
                          const cat = t.finCategorias.find((c) => c.id === l.categoria_id);
                          if (cat) {
                            return `${cat.icone ? `${cat.icone} ` : ''}${cat.nome}`;
                          }
                          return l.categoria_nome || '—';
                        })()}
                      </td>
                      <td className="py-2 px-3 font-medium capitalize">
                        {t.tipoLabel(l.tipo_recebimento || l.tipo_movimento)}
                      </td>
                      <td className="py-2 px-3 text-gray-500">{l.referencia || l.observacoes || '—'}</td>
                      <td
                        className={`py-2 px-3 text-right font-bold whitespace-nowrap ${
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
                  <td colSpan={5} className="py-2.5 px-3 text-right text-gray-700">Totalizadores:</td>
                  <td className="py-2.5 px-3 text-right text-[#123b63] whitespace-nowrap">
                    {t.fmtBRL(t.entradasRelatorio - t.saidasRelatorio)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </>
        )}

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
      )}

      {/* Modal para Adicionar Dizimista */}
      <AdicionarDizimistaModal
        isOpen={t.showAddDizimistaModal}
        onClose={() => t.setShowAddDizimistaModal(false)}
        ministryId={t.ministryId}
        onSuccess={t.loadDizimistasData}
        showModal={t.showModal}
      />

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
