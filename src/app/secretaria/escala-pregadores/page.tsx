'use client';

import { useState } from 'react';
import { Mic, AlertTriangle, ShieldCheck, FileText } from 'lucide-react';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { useEscalaPregadores, AgendaEventoComEscala } from '@/hooks/secretaria/useEscalaPregadores';
import { EscalaFiltrosBar } from '@/components/secretaria/escala-pregadores/EscalaFiltrosBar';
import { EscalaEventosTable } from '@/components/secretaria/escala-pregadores/EscalaEventosTable';
import { EscalaPaginacao } from '@/components/secretaria/escala-pregadores/EscalaPaginacao';
import { ModalAtribuirPregador } from '@/components/secretaria/escala-pregadores/ModalAtribuirPregador';
import { ModalSubstituirPregador } from '@/components/secretaria/escala-pregadores/ModalSubstituirPregador';
import { ModalRemanejarPregador } from '@/components/secretaria/escala-pregadores/ModalRemanejarPregador';
import { ModalHistoricoEscala } from '@/components/secretaria/escala-pregadores/ModalHistoricoEscala';
import { ModalRelatorioEscala } from '@/components/secretaria/escala-pregadores/ModalRelatorioEscala';

export default function EscalaPregadoresPage() {
  const { bloqueado } = useRequireModulo('secretaria_local');

  const {
    isGlobalUser,
    filtros,
    setFiltros,
    setPagina,
    paginacao,
    congregacoes,
    eventos,
    loadingEventos,
    erroEventos,
    carregarEventos,
    ministros,
    loadingMinistros,
    carregarMinistros,
    eventoSelecionado,
    setEventoSelecionado,
    modalAtribuirAberto,
    setModalAtribuirAberto,
    modalSubstituirAberto,
    setModalSubstituirAberto,
    modalRemanejarAberto,
    setModalRemanejarAberto,
    modalHistoricoAberto,
    setModalHistoricoAberto,
    historicoEvento,
    loadingHistorico,
    carregarHistorico,
    atribuirPregador,
    substituirPregador,
    remanejarPregador,
    desfazerEscala,
  } = useEscalaPregadores();

  const [modalConfirmDesfazer, setModalConfirmDesfazer] = useState(false);
  const [modalRelatorioAberto, setModalRelatorioAberto] = useState(false);
  const [motivoDesfazer, setMotivoDesfazer] = useState('');
  const [desfazendo, setDesfazendo] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  if (bloqueado) {
    return (
      <div className="p-8 text-center text-slate-500">
        Módulo não habilitado para seu perfil ministerial.
      </div>
    );
  }

  // Handlers para ações de cada culto
  const handleAbrirAtribuir = (evento: AgendaEventoComEscala) => {
    setEventoSelecionado(evento);
    setModalAtribuirAberto(true);
  };

  const handleAbrirSubstituir = (evento: AgendaEventoComEscala) => {
    setEventoSelecionado(evento);
    setModalSubstituirAberto(true);
  };

  const handleAbrirRemanejar = (evento: AgendaEventoComEscala) => {
    setEventoSelecionado(evento);
    setModalRemanejarAberto(true);
  };

  const handleAbrirHistorico = (evento: AgendaEventoComEscala) => {
    setEventoSelecionado(evento);
    setModalHistoricoAberto(true);
    carregarHistorico(evento.id);
  };

  const handleAbrirDesfazer = (evento: AgendaEventoComEscala) => {
    setEventoSelecionado(evento);
    setMotivoDesfazer('');
    setErroAcao(null);
    setModalConfirmDesfazer(true);
  };

  const handleConfirmarDesfazer = async () => {
    if (!eventoSelecionado?.escala_ativa) return;
    if (!motivoDesfazer.trim()) {
      setErroAcao('Informe o motivo do cancelamento da escala.');
      return;
    }

    setDesfazendo(true);
    setErroAcao(null);
    try {
      await desfazerEscala(eventoSelecionado.escala_ativa.id, motivoDesfazer.trim());
      setModalConfirmDesfazer(false);
    } catch (err: any) {
      setErroAcao(err?.message || 'Falha ao desfazer escala.');
    } finally {
      setDesfazendo(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-100 text-blue-700">
              <Mic className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Escala de Pregadores
              </h1>
              <p className="text-sm text-slate-500">
                Gestão ministerial integrada aos cultos da Agenda Oficial
              </p>
            </div>
          </div>
        </div>

        {/* Botão de Relatórios & Badge de Integridade */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setModalRelatorioAberto(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-sm transition-colors"
          >
            <FileText className="w-4 h-4 text-blue-600" />
            <span>Relatórios / Impressão A4</span>
          </button>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg text-xs font-medium">
            <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span>Agenda Oficial Vinculada</span>
          </div>
        </div>
      </div>

      {/* Alerta de Erro Geral se houver */}
      {erroEventos && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm font-semibold text-red-700 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{erroEventos}</span>
        </div>
      )}

      {/* Barra de Filtros */}
      <EscalaFiltrosBar
        filtros={filtros}
        setFiltros={setFiltros}
        onResetPagina={() => setPagina(1)}
        congregacoes={congregacoes}
        isGlobalUser={isGlobalUser}
        loading={loadingEventos}
        onRefresh={carregarEventos}
      />

      {/* Lista de Cultos com Escalas */}
      <EscalaEventosTable
        eventos={eventos}
        loading={loadingEventos}
        onAtribuir={handleAbrirAtribuir}
        onSubstituir={handleAbrirSubstituir}
        onRemanejar={handleAbrirRemanejar}
        onDesfazer={handleAbrirDesfazer}
        onVerHistorico={handleAbrirHistorico}
      />

      {/* Paginação da Listagem */}
      <EscalaPaginacao
        paginacao={paginacao}
        onChangePagina={(p) => setPagina(p)}
        loading={loadingEventos}
      />

      {/* Modal: Relatório e Impressão A4 / PDF */}
      <ModalRelatorioEscala
        aberto={modalRelatorioAberto}
        eventos={eventos}
        congregacoes={congregacoes}
        anoMesAtual={filtros.anoMes}
        churchIdAtual={filtros.churchId}
        isGlobalUser={isGlobalUser}
        onFechar={() => setModalRelatorioAberto(false)}
      />

      {/* Modal: Atribuir Pregador */}
      <ModalAtribuirPregador
        aberto={modalAtribuirAberto}
        evento={eventoSelecionado}
        ministros={ministros}
        loadingMinistros={loadingMinistros}
        onBuscarMinistros={(termo) => carregarMinistros(termo, {
          agendaEventoId: eventoSelecionado?.id,
          dataInicio: eventoSelecionado?.data_inicio,
          dataFim: eventoSelecionado?.data_fim,
        })}
        onConfirmar={atribuirPregador}
        onFechar={() => setModalAtribuirAberto(false)}
      />

      {/* Modal: Substituir Pregador */}
      <ModalSubstituirPregador
        aberto={modalSubstituirAberto}
        evento={eventoSelecionado}
        ministros={ministros}
        loadingMinistros={loadingMinistros}
        onBuscarMinistros={(termo) => carregarMinistros(termo, {
          agendaEventoId: eventoSelecionado?.id,
          dataInicio: eventoSelecionado?.data_inicio,
          dataFim: eventoSelecionado?.data_fim,
          ignorarEscalaId: eventoSelecionado?.escala_ativa?.id,
        })}
        onConfirmar={substituirPregador}
        onFechar={() => setModalSubstituirAberto(false)}
      />

      {/* Modal: Remanejar Pregador */}
      <ModalRemanejarPregador
        aberto={modalRemanejarAberto}
        eventoOrigem={eventoSelecionado}
        todosEventos={eventos}
        onConfirmar={remanejarPregador}
        onFechar={() => setModalRemanejarAberto(false)}
      />

      {/* Modal: Histórico de Alterações */}
      <ModalHistoricoEscala
        aberto={modalHistoricoAberto}
        evento={eventoSelecionado}
        historico={historicoEvento}
        loading={loadingHistorico}
        onFechar={() => setModalHistoricoAberto(false)}
      />

      {/* Modal: Confirmação de Desfazer Escala */}
      {modalConfirmDesfazer && eventoSelecionado && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Desfazer Escala do Pregador
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              O ministro será desvinculado de &quot;{eventoSelecionado.titulo}&quot;. O evento ficará vago e
              disponível para nova escalação.
            </p>

            {erroAcao && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700 mb-3">
                {erroAcao}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Motivo do Cancelamento <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Ex: Cancelamento da escala por decisão pastoral..."
                value={motivoDesfazer}
                onChange={(e) => setMotivoDesfazer(e.target.value)}
                className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalConfirmDesfazer(false)}
                disabled={desfazendo}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmarDesfazer}
                disabled={desfazendo || !motivoDesfazer.trim()}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-lg shadow-sm transition-colors disabled:opacity-50"
              >
                {desfazendo ? 'Cancelando...' : 'Confirmar Cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
