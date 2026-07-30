'use client';

import DashboardContainer from '@/components/dashboard/DashboardContainer';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import ExecutiveMetricCard from '@/components/dashboard/ExecutiveMetricCard';
import DashboardContent from '@/components/dashboard/DashboardContent';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';
import DashboardSection from '@/components/dashboard/DashboardSection';
import DashboardActions from '@/components/dashboard/DashboardActions';
import DashboardEmptyState from '@/components/dashboard/DashboardEmptyState';
import {
  Plus, Calendar as CalendarIcon,
  AlertTriangle, Check, Archive,
  LayoutDashboard, BookOpen, CheckCircle2, Gavel, ShieldCheck, Lock, Clock, Calendar, Flame,
  CalendarRange, Filter
} from 'lucide-react';
import { useAgenda } from '@/hooks/agenda/useAgenda';

import AgendaToolbar from '@/components/agenda/AgendaToolbar';
import AgendaCalendar from '@/components/agenda/AgendaCalendar';
import AgendaTimeline from '@/components/agenda/AgendaTimeline';
import EventoFormModal from '@/components/agenda/EventoFormModal';
import ConfirmDeleteModal from '@/components/agenda/ConfirmDeleteModal';

export default function AgendaPage() {
  const {
    ctx,
    bloqueado,
    planFeatures,
    activeTab,
    setActiveTab,
    currentDateFormatted,
    daysLeftInMonth,
    currentYear,
    currentMonth,
    MESES_PT,
    quickFilter,
    setQuickFilter,
    showAdvancedFilters,
    setShowAdvancedFilters,
    filtroTipoId,
    setFiltroTipoId,
    filtroCongregacao,
    setFiltroCongregacao,
    filtroVisibilidade,
    setFiltroVisibilidade,
    selectedDate,
    setSelectedDate,
    tiposAgrupados,
    CATEGORIAS_LABEL,
    STATUS_PLAN_INFO,
    TIPO_SOLICITACAO_LABEL,
    congregacoes,
    orgHelper,
    eventos,
    loading,
    msg,
    totalCultos,
    totalReunioes,
    totalEventosOficiais,
    totalEventosSincronizados,
    isEscritaPermitida,
    isAdmin,
    isPresidenciaOrAdmin,
    daysInMonthArray,
    eventosPorDia,
    eventosColunaDireita,
    proximosEventos,
    TABS,
    activePlanning,
    planningEventCount,
    responsibleEmail,
    solicitacoes,
    loadingSols,
    showModal,
    setShowModal,
    saving,
    editEvento,
    showAdvancedFormFields,
    setShowAdvancedFormFields,
    form,
    setForm,
    showTiposModal,
    setShowTiposModal,
    tipos,
    novoTipoNome,
    setNovoTipoNome,
    novoTipoCategoria,
    setNovoTipoCategoria,
    novoTipoCor,
    setNovoTipoCor,
    novoTipoBloqueio,
    setNovoTipoBloqueio,
    isSalvandoTipo,
    deleteConfirmTarget,
    setDeleteConfirmTarget,
    handlePrevMonth,
    handleNextMonth,
    handleGoToToday,
    openForm,
    handleTipoChange,
    handleSave,
    handleDelete,
    confirmDeleteAction,
    handleCriarTipo,
    handleDeletarTipo,
    handlePublishPlanning,
    handleArchivePlanning,
    handleDecidirSolicitacao,
    getEscopoLabel,
  } = useAgenda();

  if (ctx.loading || planFeatures.loading) {
    return <div className="p-8 text-gray-500">Carregando...</div>;
  }

  if (bloqueado || !planFeatures.has_modulo_agenda || !planFeatures.hasFeature('agenda_module')) {
    return (
      <DashboardContainer>
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center max-w-2xl mx-auto space-y-5 my-10">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto text-blue-600 shadow-sm border border-blue-200/60">
            <CalendarIcon className="h-8 w-8" />
          </div>
          <div>
            <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full mb-3">
              Recurso do Plano Starter
            </span>
            <h2 className="text-xl font-bold text-slate-800">Módulo Agenda Indisponível no seu Plano</h2>
          </div>

          <p className="text-slate-600 text-base font-semibold leading-relaxed max-w-lg mx-auto">
            A funcionalidade Agenda do Ministério está disponível a partir do Plano Starter.
          </p>

          <p className="text-slate-500 text-xs leading-relaxed max-w-md mx-auto">
            Faça o upgrade para liberar o calendário ministerial completo, sincronização com cultos e reuniões, além do planejamento anual de atividades da sua igreja.
          </p>

          <div className="pt-3">
            <a
              href="/configuracoes"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#123b63] text-white text-sm font-semibold rounded-xl hover:bg-[#1a4f85] transition shadow-md hover:shadow-lg"
            >
              Fazer Upgrade / Conhecer Planos
            </a>
          </div>
        </div>
      </DashboardContainer>
    );
  }

  return (
    <DashboardContainer>
      <DashboardHeader
        title="Agenda Ministerial"
        description="Planejamento e coordenação de datas e agendas integradas"
        contextSubtitle="Planejamento Ministerial"
        greeting="Gestão Ministerial"
        currentDate={currentDateFormatted}
        centerContent={
          <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500">
            <span className="text-slate-600 font-extrabold uppercase">
              {MESES_PT[currentMonth - 1].toUpperCase()} DE {currentYear}
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-400 font-semibold">
              <span className="font-bold text-slate-500">{eventos.length}</span> COMPROMISSOS
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-400 font-semibold">
              <span className="font-bold text-slate-500">{totalCultos}</span> CULTOS
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-400 font-semibold">
              <span className="font-bold text-slate-500">{totalReunioes}</span> REUNIÕES
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-400 font-semibold">
              <span className="font-bold text-slate-500">{totalEventosSincronizados}</span> SINCRONIZAÇÕES
            </span>
          </div>
        }
        actions={
          isEscritaPermitida ? (
            <DashboardActions>
              <button
                onClick={() => openForm(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Novo Compromisso
              </button>
            </DashboardActions>
          ) : undefined
        }
        extra={
          <div className="flex gap-1">
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setSelectedDate(null);
                  }}
                  className={`flex items-center gap-1.5 px-4 py-2.5 font-bold text-xs tracking-wide uppercase transition border-b-2 ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        }
      />

      <DashboardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ExecutiveMetricCard
            title="Oficiais"
            value={totalEventosOficiais}
            icon={ShieldCheck}
            color="indigo"
            subtitle="Calendário Oficial da Igreja"
          />

          <ExecutiveMetricCard
            title="Compromissos"
            value={eventos.length}
            icon={Calendar}
            color="slate"
            subtitle="Agendados para este mês"
          />

          <ExecutiveMetricCard
            title="Cultos & Reuniões"
            value={totalCultos + totalReunioes}
            icon={Flame}
            color="emerald"
            subtitle={`${totalCultos} Cultos e ${totalReunioes} Reuniões`}
          />

          <ExecutiveMetricCard
            title="Sincronizados"
            value={totalEventosSincronizados}
            icon={Lock}
            color="rose"
            subtitle="Integrados de outros módulos"
          />
        </div>

        <AgendaToolbar
          activeTab={activeTab}
          currentMonth={currentMonth}
          currentYear={currentYear}
          MESES_PT={MESES_PT}
          quickFilter={quickFilter}
          showAdvancedFilters={showAdvancedFilters}
          filtroTipoId={filtroTipoId}
          filtroCongregacao={filtroCongregacao}
          filtroVisibilidade={filtroVisibilidade}
          tiposAgrupados={tiposAgrupados}
          CATEGORIAS_LABEL={CATEGORIAS_LABEL}
          congregacoes={congregacoes}
          orgHelper={orgHelper}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onGoToToday={handleGoToToday}
          onQuickFilterChange={setQuickFilter}
          onToggleAdvancedFilters={() => setShowAdvancedFilters(v => !v)}
          onFiltroTipoChange={setFiltroTipoId}
          onFiltroCongregacaoChange={setFiltroCongregacao}
          onFiltroVisibilidadeChange={setFiltroVisibilidade}
        />

        {msg && (
          <div className={`p-3 mb-4 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
            msg.tipo === 'ok' ? 'bg-emerald-50 text-emerald-800 border-emerald-150' : 'bg-rose-50 text-rose-800 border-rose-150'
          }`}>
            {msg.tipo === 'ok' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-rose-600" />}
            {msg.texto}
          </div>
        )}

        {activeTab === 'calendario' && (
          <div className="flex flex-col lg:flex-row gap-5 items-start">
            <AgendaCalendar
              daysInMonthArray={daysInMonthArray}
              eventosPorDia={eventosPorDia}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />

            <DashboardSidebar className="w-full lg:w-[320px] lg:border-l lg:border-slate-200/50 lg:pl-5">
              <AgendaTimeline
                mode="sidebar"
                selectedDate={selectedDate}
                loading={loading}
                eventosColunaDireita={eventosColunaDireita}
                proximosEventos={proximosEventos}
                isEscritaPermitida={isEscritaPermitida}
                daysLeftInMonth={daysLeftInMonth}
                MESES_PT={MESES_PT}
                getEscopoLabel={getEscopoLabel}
                onClearSelectedDate={() => setSelectedDate(null)}
                onOpenForm={openForm}
                onDeleteEvento={handleDelete}
              />
            </DashboardSidebar>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="flex flex-col lg:flex-row gap-6">
            <AgendaTimeline
              mode="full"
              proximosEventos={proximosEventos}
              isEscritaPermitida={isEscritaPermitida}
              getEscopoLabel={getEscopoLabel}
              onOpenForm={openForm}
            />

            <DashboardSidebar className="w-full lg:w-80">
              <DashboardSection
                title="Visão Geral Consolidada"
                icon={LayoutDashboard}
                className="!p-5"
              >
                <div className="space-y-4 text-xs">
                  <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded-xl">
                    <h4 className="font-bold mb-1">Orientações Executivas</h4>
                    <p className="leading-relaxed text-slate-705">
                      Monitore a distribuição de datas para evitar sobrecarga de atividades nas congregações. Priorize sempre os eventos do calendário oficial.
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-bold text-slate-800 mb-2">Legenda de Cores</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-indigo-500 shrink-0" />
                        <span className="text-slate-600">Azul (Oficial): Eventos institucionais e prioritários.</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                        <span className="text-slate-600">Verde (Local): Atividades e reuniões locais.</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0" />
                        <span className="text-slate-600">Vermelho (Bloqueado): Datas gerenciadas por outros módulos.</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-3">
                    <h4 className="font-bold text-slate-800 mb-1.5">Instruções Rápidas</h4>
                    <ul className="list-disc pl-4 space-y-1 text-slate-505">
                      <li>Selecione um dia no Calendário para filtrar os compromissos específicos.</li>
                      <li>Aprovação de conflitos requer análise e parecer na aba de Solicitações.</li>
                      <li>O Planejamento publicado impede novas edições normais de datas.</li>
                    </ul>
                  </div>
                </div>
              </DashboardSection>
            </DashboardSidebar>
          </div>
        )}

        {activeTab === 'planejamento' && (
          <div className="flex flex-col lg:flex-row gap-6">
            <DashboardSection
              title={`Planejamento de Exercício Vigente - ${currentYear}`}
              icon={Calendar}
              className="flex-1 min-w-0"
            >
              {activePlanning ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="relative overflow-hidden bg-gradient-to-br from-indigo-50/40 to-white p-4 rounded-2xl border border-indigo-100/80 shadow-xs hover:shadow transition-all duration-200">
                      <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block">Status da Agenda</span>
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border inline-block mt-2 ${STATUS_PLAN_INFO[activePlanning.status].cor}`}>
                        {STATUS_PLAN_INFO[activePlanning.status].label}
                      </span>
                      <div className="absolute right-2 bottom-2 text-indigo-400 pointer-events-none opacity-20">
                        <ShieldCheck className="h-12 w-12" />
                      </div>
                    </div>

                    <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50/40 to-white p-4 rounded-2xl border border-emerald-100/80 shadow-xs hover:shadow transition-all duration-200">
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Total de Eventos no Exercício</span>
                      <p className="text-2xl font-black text-emerald-800 mt-1">{planningEventCount}</p>
                      <div className="absolute right-2 bottom-2 text-emerald-450 pointer-events-none opacity-20">
                        <CalendarRange className="h-12 w-12" />
                      </div>
                    </div>
                  </div>

                  <div className="relative overflow-hidden bg-gradient-to-br from-slate-50 to-white p-4 rounded-2xl border border-slate-200/60 shadow-xs hover:shadow transition-all duration-200 space-y-2 text-xs text-slate-650">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Publicação</span>
                    <div className="space-y-1 relative z-10">
                      <p className="font-semibold text-slate-700">Data de Publicação: <span className="font-bold text-slate-900">{activePlanning.published_at ? new Date(activePlanning.published_at).toLocaleString('pt-BR') : 'Ainda não publicado'}</span></p>
                      {responsibleEmail && <p className="font-semibold text-slate-700">Responsável: <span className="font-bold text-slate-900">{responsibleEmail}</span></p>}
                    </div>
                    <div className="absolute right-3 bottom-3 text-slate-400 pointer-events-none opacity-20">
                      <Clock className="h-12 w-12" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-xs gap-2">
                  <CalendarIcon className="h-8 w-8 text-slate-300" />
                  <p className="text-xs font-bold text-slate-500">Nenhum planejamento inicializado para o ano {currentYear}.</p>
                </div>
              )}
            </DashboardSection>

            <DashboardSidebar className="w-full lg:w-80">
              <DashboardSection
                title="Ações Estratégicas Anuais"
                icon={BookOpen}
                className="!p-5"
              >
                {activePlanning ? (
                  <div className="space-y-3">
                    {activePlanning.status === 'rascunho' && (
                      <button
                        onClick={handlePublishPlanning}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-extrabold text-xs rounded-xl shadow-sm hover:shadow-md border border-blue-700 transition duration-200"
                      >
                        <Check className="h-4 w-4" />
                        Publicar Planejamento
                      </button>
                    )}
                    {activePlanning.status !== 'arquivado' && (
                      <button
                        onClick={handleArchivePlanning}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-55 text-slate-700 font-extrabold text-xs rounded-xl shadow-xs hover:shadow border border-slate-200 hover:border-slate-300 transition duration-200"
                      >
                        <Archive className="h-4 w-4" />
                        Arquivar Planejamento
                      </button>
                    )}
                    {activePlanning.status === 'arquivado' && (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center">
                        <p className="text-xs text-slate-500 font-bold flex items-center justify-center gap-1.5">
                          <Lock className="h-4 w-4 text-slate-400" />
                          Este planejamento foi arquivado de forma definitiva.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-xs gap-2">
                    <CalendarIcon className="h-8 w-8 text-slate-300" />
                    <p className="text-xs font-bold text-slate-550">Nenhum rascunho ativo.</p>
                  </div>
                )}
              </DashboardSection>

              <DashboardSection
                title="Configurações de Tipos"
                icon={Filter}
                className="!p-5 mt-4"
              >
                <p className="text-[11px] text-slate-550 font-bold mb-3 leading-relaxed">
                  Personalize as cores, regras de bloqueio e categorias dos compromissos da igreja.
                </p>
                <button
                  onClick={() => setShowTiposModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-750 font-extrabold text-xs rounded-xl shadow-xs border border-slate-200 hover:border-slate-300 transition duration-200"
                >
                  <Plus className="h-3.5 w-3.5 text-slate-500" />
                  Gerenciar Tipos
                </button>
              </DashboardSection>
            </DashboardSidebar>
          </div>
        )}

        {activeTab === 'solicitacoes' && isPresidenciaOrAdmin && (
          <div className="flex flex-col lg:flex-row gap-6">
            <DashboardSection
              title="Solicitações de Exceção de Datas"
              icon={Gavel}
              className="flex-1 min-w-0"
            >
              {loadingSols ? (
                <div className="text-center py-6 text-slate-400 text-xs">Carregando solicitações...</div>
              ) : solicitacoes.length === 0 ? (
                <DashboardEmptyState
                  icon={Gavel}
                  title="Sem solicitações pendentes"
                  description="Nenhuma solicitação de alteração de datas ou exceções aguarda sua aprovação."
                />
              ) : (
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {solicitacoes.map(sol => {
                    const isPending = sol.status === 'pendente';
                    const statusCls = sol.status === 'aprovado' ? 'bg-emerald-50 text-emerald-700 border-emerald-150' :
                                      sol.status === 'rejeitado' ? 'bg-rose-50 text-rose-700 border-rose-150' :
                                      'bg-amber-50 text-amber-700 border-amber-150';

                    return (
                      <div key={sol.id} className="p-3 border border-slate-100 rounded-xl bg-slate-50/50 flex flex-col sm:flex-row justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap gap-1.5">
                            <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded-full border ${statusCls}`}>
                              {sol.status.toUpperCase()}
                            </span>
                            <span className="text-[8px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full border border-slate-200">
                              {TIPO_SOLICITACAO_LABEL[sol.tipo_solicitacao]}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-800">{sol.titulo}</h4>
                          <p className="text-[11px] text-slate-500">Justificativa: "{sol.justificativa}"</p>
                          {sol.parecer && <p className="text-[10px] text-blue-600 italic">Parecer: "{sol.parecer}"</p>}
                        </div>

                        {isPending && (
                          <div className="flex items-center gap-1.5 shrink-0 sm:self-center">
                            <button
                              onClick={() => {
                                const p = prompt('Parecer para aprovação:', '');
                                if (p !== null) handleDecidirSolicitacao(sol.id, 'aprovar', p);
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg transition"
                            >
                              Aprovar
                            </button>
                            <button
                              onClick={() => {
                                const p = prompt('Parecer para rejeição:', '');
                                if (p !== null) handleDecidirSolicitacao(sol.id, 'rejeitar', p);
                              }}
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] rounded-lg transition"
                            >
                              Rejeitar
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </DashboardSection>

            <DashboardSidebar className="w-full lg:w-80">
              <DashboardSection
                title="Políticas de Aprovação"
                icon={ShieldCheck}
                className="!p-5"
              >
                <div className="space-y-4 text-xs text-slate-600">
                  <div className="bg-amber-50 border border-amber-255 text-amber-850 p-3 rounded-xl">
                    <h4 className="font-bold mb-1 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Limites de Conflitos
                    </h4>
                    <p className="leading-relaxed text-slate-700">
                      O sistema impede o choque de datas para eventos oficiais ou bloqueantes no mesmo local e horário. Exceções devem ser justificadas sob a chancela da Presidência.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-800 mb-1.5">Processo de Aprovação</h4>
                    <ol className="list-decimal pl-4 space-y-1.5 text-slate-500">
                      <li>
                        <strong>Análise de Justificativa:</strong> Verifique se a relevância do evento justifica a coexistência ou alteração.
                      </li>
                      <li>
                        <strong>Parecer Obrigatório:</strong> Forneça observações e diretrizes claras ao deferir ou indeferir a exceção.
                      </li>
                      <li>
                        <strong>Publicação:</strong> A aprovação insere automaticamente o compromisso sob regime especial no calendário.
                      </li>
                    </ol>
                  </div>
                </div>
              </DashboardSection>
            </DashboardSidebar>
          </div>
        )}

        <EventoFormModal
          showModal={showModal}
          editEvento={editEvento}
          form={form}
          saving={saving}
          showAdvancedFormFields={showAdvancedFormFields}
          tiposAgrupados={tiposAgrupados}
          CATEGORIAS_LABEL={CATEGORIAS_LABEL}
          orgHelper={orgHelper}
          isAdmin={isAdmin}
          onCloseModal={() => setShowModal(false)}
          onSave={handleSave}
          onFormChange={(fields) => setForm(prev => ({ ...prev, ...fields }))}
          onTipoChange={handleTipoChange}
          onToggleAdvancedFields={() => setShowAdvancedFormFields(v => !v)}
          onOpenTiposModal={() => setShowTiposModal(true)}
          showTiposModal={showTiposModal}
          tipos={tipos}
          novoTipoNome={novoTipoNome}
          novoTipoCategoria={novoTipoCategoria}
          novoTipoCor={novoTipoCor}
          novoTipoBloqueio={novoTipoBloqueio}
          isSalvandoTipo={isSalvandoTipo}
          onCloseTiposModal={() => setShowTiposModal(false)}
          onNovoTipoNomeChange={setNovoTipoNome}
          onNovoTipoCategoriaChange={setNovoTipoCategoria}
          onNovoTipoCorChange={setNovoTipoCor}
          onNovoTipoBloqueioChange={setNovoTipoBloqueio}
          onCriarTipo={handleCriarTipo}
          onDeletarTipo={handleDeletarTipo}
        />

        <ConfirmDeleteModal
          isOpen={!!deleteConfirmTarget}
          title="Excluir Compromisso"
          message={`Tem certeza que deseja excluir o compromisso "${deleteConfirmTarget?.titulo || ''}"? Esta ação não poderá ser desfeita.`}
          confirmText="Excluir"
          cancelText="Cancelar"
          onConfirm={confirmDeleteAction}
          onCancel={() => setDeleteConfirmTarget(null)}
        />
      </DashboardContent>
    </DashboardContainer>
  );
}
