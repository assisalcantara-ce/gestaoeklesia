'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  Search,
  Plus,
  RefreshCw,
  Loader2,
  ClipboardList,
  ChevronRight,
  School,
} from 'lucide-react';
import {
  TurmaDiscipuladoItem,
  TurmaAlunoMatricula,
  LicaoCpad,
  EquipeDiscipuladoItem,
} from '@/services/discipulado-pedagogico-service';
import DiarioClasseModal from './DiarioClasseModal';
import ProntuarioPedagogicoModal from './ProntuarioPedagogicoModal';
import ReposicaoLicaoModal from './ReposicaoLicaoModal';

interface TabTurmasProps {
  ministryId: string;
  onNotification: (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => void;
}

export default function TabTurmas({ ministryId, onNotification }: TabTurmasProps) {
  const [turmas, setTurmas] = useState<TurmaDiscipuladoItem[]>([]);
  const [equipe, setEquipe] = useState<EquipeDiscipuladoItem[]>([]);
  const [catalogoLicoes, setCatalogoLicoes] = useState<LicaoCpad[]>([]);
  const [loading, setLoading] = useState(true);

  const [buscaTexto, setBuscaTexto] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');

  const [turmaSelecionada, setTurmaSelecionada] = useState<TurmaDiscipuladoItem | null>(null);
  const [alunosTurma, setAlunosTurma] = useState<TurmaAlunoMatricula[]>([]);
  const [loadingAlunos, setLoadingAlunos] = useState(false);

  const [modalNovaTurmaOpen, setModalNovaTurmaOpen] = useState(false);
  const [modalDiarioOpen, setModalDiarioOpen] = useState(false);
  const [modalProntuarioOpen, setModalProntuarioOpen] = useState(false);
  const [modalReposicaoOpen, setModalReposicaoOpen] = useState(false);
  const [licaoParaReposicao, setLicaoParaReposicao] = useState<LicaoCpad | null>(null);
  const [jornadaSelecionadaId, setJornadaSelecionadaId] = useState<string>('');
  const [progressoSelecionado, setProgressoSelecionado] = useState<any>(null);

  const [nomeTurma, setNomeTurma] = useState('');
  const [profTitularId, setProfTitularId] = useState('');
  const [isIntercongregacional, setIsIntercongregacional] = useState(false);
  const [diasHorarios, setDiasHorarios] = useState('');
  const [localSala, setLocalSala] = useState('');
  const [capacidade, setCapacidade] = useState('30');
  const [criandoTurma, setCriandoTurma] = useState(false);

  const carregarDados = useCallback(async () => {
    if (!ministryId) return;
    setLoading(true);
    try {
      const [resTurmas, resEquipe, resLicoes] = await Promise.all([
        fetch('/api/v1/discipulado/turmas'),
        fetch('/api/v1/discipulado/equipe'),
        fetch('/api/v1/discipulado/licoes'),
      ]);

      if (resTurmas.ok) {
        const dataT = await resTurmas.json();
        setTurmas(dataT.turmas || []);
      }
      if (resEquipe.ok) {
        const dataE = await resEquipe.json();
        setEquipe(dataE.equipe || []);
      }
      if (resLicoes.ok) {
        const dataL = await resLicoes.json();
        setCatalogoLicoes(dataL.licoes || []);
      }
    } catch (err: any) {
      console.error('[carregarDados]', err);
      onNotification('error', 'Erro', 'Falha ao carregar dados das turmas.');
    } finally {
      setLoading(false);
    }
  }, [ministryId, onNotification]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const selecionarTurma = async (turma: TurmaDiscipuladoItem) => {
    setTurmaSelecionada(turma);
    setLoadingAlunos(true);
    try {
      const res = await fetch(`/api/v1/discipulado/turmas/${turma.id}/matriculas`);
      if (res.ok) {
        const data = await res.json();
        setAlunosTurma(data.matriculas || []);
      }
    } catch (err) {
      console.error('[selecionarTurma]', err);
    } finally {
      setLoadingAlunos(false);
    }
  };

  const handleAbrirProntuario = async (jornadaId: string) => {
    setJornadaSelecionadaId(jornadaId);
    try {
      const res = await fetch(`/api/v1/discipulado/jornadas/${jornadaId}/progresso`);
      if (res.ok) {
        const data = await res.json();
        setProgressoSelecionado(data);
        setModalProntuarioOpen(true);
      } else {
        const err = await res.json();
        onNotification('error', 'Erro', err.error || 'Falha ao buscar prontuário.');
      }
    } catch (err: any) {
      onNotification('error', 'Erro', 'Falha na conexão ao buscar prontuário.');
    }
  };

  const handleCriarTurma = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeTurma || !profTitularId) {
      onNotification('warning', 'Atenção', 'Informe o nome da turma e selecione o professor titular.');
      return;
    }

    setCriandoTurma(true);
    try {
      const res = await fetch('/api/v1/discipulado/turmas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nomeTurma,
          professorTitularId: profTitularId,
          isIntercongregacional,
          diasHorarios,
          localSala,
          capacidade: capacidade ? Number(capacidade) : 30,
        }),
      });

      if (res.ok) {
        onNotification('success', 'Sucesso', 'Turma criada com sucesso!');
        setModalNovaTurmaOpen(false);
        setNomeTurma('');
        setProfTitularId('');
        setDiasHorarios('');
        setLocalSala('');
        carregarDados();
      } else {
        const err = await res.json();
        onNotification('error', 'Erro', err.error || 'Falha ao criar turma.');
      }
    } catch (err: any) {
      onNotification('error', 'Erro', err.message || 'Falha ao criar turma.');
    } finally {
      setCriandoTurma(false);
    }
  };

  const handleSalvarDiario = async (payload: any) => {
    const res = await fetch(`/api/v1/discipulado/turmas/${payload.turmaId}/aulas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Falha ao registrar diário de aula.');
    }

    onNotification('success', 'Diário Registrado', 'A aula e frequência foram processadas com segurança.');
    if (turmaSelecionada) {
      selecionarTurma(turmaSelecionada);
    }
  };

  const handleSalvarValidacao = async (payload: any) => {
    const res = await fetch(`/api/v1/discipulado/jornadas/${payload.jornadaId}/progresso`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Falha ao registrar lição.');
    }

    onNotification('success', 'Lição Validada', 'A lição foi concluída e validada no prontuário do discípulo.');
    handleAbrirProntuario(payload.jornadaId);
  };

  const turmasFiltradas = useMemo(() => {
    return turmas.filter((t) => {
      const matchesBusca =
        !buscaTexto ||
        t.nome.toLowerCase().includes(buscaTexto.toLowerCase()) ||
        t.professor_titular?.name.toLowerCase().includes(buscaTexto.toLowerCase());
      const matchesStatus = filtroStatus === 'todos' || t.status === filtroStatus;
      return matchesBusca && matchesStatus;
    });
  }, [turmas, buscaTexto, filtroStatus]);

  return (
    <div className="space-y-6">
      {/* TOOLBAR E FILTROS */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-4 items-end">
          <div className="sm:col-span-2 lg:col-span-7">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Buscar Turma ou Professor
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-slate-400" />
              </div>
              <input
                type="text"
                value={buscaTexto}
                onChange={(e) => setBuscaTexto(e.target.value)}
                placeholder="Nome da turma ou professor..."
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
              />
            </div>
          </div>

          <div className="lg:col-span-3">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Status da Turma
            </label>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition cursor-pointer"
            >
              <option value="todos">Todos os Status</option>
              <option value="planejada">Planejada</option>
              <option value="ativa">Ativa</option>
              <option value="concluida">Concluída</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setModalNovaTurmaOpen(true)}
              className="w-full px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus size={16} />
              <span>+ Nova Turma</span>
            </button>
          </div>
        </div>
      </div>

      {/* LAYOUT EM DUAS COLUNAS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50/70">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <School className="w-4 h-4 text-teal-700" />
                Turmas Cadastradas ({turmasFiltradas.length})
              </h3>
              <button
                type="button"
                onClick={carregarDados}
                disabled={loading}
                className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg transition cursor-pointer"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin text-teal-600' : ''} />
              </button>
            </div>

            {loading ? (
              <div className="py-16 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-teal-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Carregando turmas...</p>
              </div>
            ) : turmasFiltradas.length === 0 ? (
              <div className="py-16 text-center p-6">
                <p className="text-xs text-slate-500">Nenhuma turma encontrada. Clique em &quot;+ Nova Turma&quot; para iniciar.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {turmasFiltradas.map((t) => {
                  const isSelected = turmaSelecionada?.id === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => selecionarTurma(t)}
                      className={`p-4 transition cursor-pointer flex items-center justify-between ${
                        isSelected ? 'bg-teal-50/60 border-l-4 border-teal-600' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900 truncate">{t.nome}</h4>
                          {t.is_intercongregacional && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Intercongregacional
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Prof: <strong className="text-slate-700">{t.professor_titular?.name || 'Não atribuído'}</strong> • Horário: {t.dias_horarios || 'A definir'}
                        </p>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                          <span>Sala: {t.local_sala || 'Padrão'}</span>
                          <span>Capacidade: {t.capacidade || 30}</span>
                          <span className="capitalize font-semibold text-teal-700">{t.status}</span>
                        </div>
                      </div>

                      <ChevronRight className={`w-5 h-5 shrink-0 ${isSelected ? 'text-teal-600' : 'text-slate-300'}`} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5">
          {turmaSelecionada ? (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden sticky top-20">
              <div className="p-4 border-b border-slate-200 bg-teal-50/40 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{turmaSelecionada.nome}</h3>
                  <p className="text-xs text-slate-500">
                    {alunosTurma.length} {alunosTurma.length === 1 ? 'aluno matriculado' : 'alunos matriculados'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalDiarioOpen(true)}
                  className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <ClipboardList size={14} />
                  <span>Diário / Chamada</span>
                </button>
              </div>

              {loadingAlunos ? (
                <div className="py-12 text-center">
                  <Loader2 className="w-5 h-5 animate-spin text-teal-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Carregando alunos...</p>
                </div>
              ) : alunosTurma.length === 0 ? (
                <div className="py-12 text-center p-6 space-y-2">
                  <Users className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-500">Nenhum aluno matriculado nesta turma.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                  {alunosTurma.map((mat) => (
                    <div key={mat.id} className="p-3.5 hover:bg-slate-50 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-900 block">{mat.member?.name || 'Aluno'}</span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {mat.jornada?.licoes_concluidas || 0}/26 lições • Fase: {mat.jornada?.fase?.replace('_', ' ')}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAbrirProntuario(mat.jornada_id)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-teal-50 hover:text-teal-800 text-slate-700 rounded-lg font-bold text-[11px] border border-slate-200 transition cursor-pointer"
                      >
                        Ver Prontuário
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-50/70 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-400">
              <School className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-xs font-medium">Selecione uma turma ao lado para gerenciar o diário de classe e ver os alunos matriculados.</p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: NOVA TURMA */}
      {modalNovaTurmaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Cadastrar Nova Turma</h3>
              <button
                type="button"
                onClick={() => setModalNovaTurmaOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCriarTurma} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  Nome da Turma *
                </label>
                <input
                  type="text"
                  value={nomeTurma}
                  onChange={(e) => setNomeTurma(e.target.value)}
                  required
                  placeholder="Ex: Turma Ágape - Sede Geral"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  Professor Titular *
                </label>
                <select
                  value={profTitularId}
                  onChange={(e) => setProfTitularId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                >
                  <option value="">Selecione o professor da equipe autorizada...</option>
                  {equipe
                    .filter((e) => e.ativo && e.papel === 'professor')
                    .map((p) => (
                      <option key={p.member_id} value={p.member_id}>
                        {p.member?.name || 'Professor'} ({p.congregacao?.nome || 'Geral'})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                    Dias e Horários
                  </label>
                  <input
                    type="text"
                    value={diasHorarios}
                    onChange={(e) => setDiasHorarios(e.target.value)}
                    placeholder="Ex: Domingos 09:00"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                    Sala / Local
                  </label>
                  <input
                    type="text"
                    value={localSala}
                    onChange={(e) => setLocalSala(e.target.value)}
                    placeholder="Ex: Sala 02 - Anexo"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                    Capacidade (Vagas)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={capacidade}
                    onChange={(e) => setCapacidade(e.target.value)}
                    placeholder="Ex: 30"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isIntercongregacional}
                    onChange={(e) => setIsIntercongregacional(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    Turma Intercongregacional (Recebe discípulos de várias congregações)
                  </span>
                </label>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalNovaTurmaOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={criandoTurma}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {criandoTurma && <Loader2 size={13} className="animate-spin text-white" />}
                  <span>Salvar Turma</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DIÁRIO DE CLASSE */}
      {modalDiarioOpen && turmaSelecionada && (
        <DiarioClasseModal
          isOpen={modalDiarioOpen}
          onClose={() => setModalDiarioOpen(false)}
          turma={turmaSelecionada}
          alunos={alunosTurma}
          catalogoLicoes={catalogoLicoes}
          onSalvarDiario={handleSalvarDiario}
        />
      )}

      {/* MODAL: PRONTUÁRIO PEDAGÓGICO */}
      {modalProntuarioOpen && progressoSelecionado && (
        <ProntuarioPedagogicoModal
          isOpen={modalProntuarioOpen}
          onClose={() => setModalProntuarioOpen(false)}
          progressoData={progressoSelecionado}
          catalogoLicoes={catalogoLicoes}
          onOpenReposicao={(licao) => {
            setLicaoParaReposicao(licao);
            setModalReposicaoOpen(true);
          }}
        />
      )}

      {/* MODAL: REPOSIÇÃO DE LIÇÃO */}
      {modalReposicaoOpen && licaoParaReposicao && (
        <ReposicaoLicaoModal
          isOpen={modalReposicaoOpen}
          onClose={() => setModalReposicaoOpen(false)}
          licao={licaoParaReposicao}
          jornadaId={jornadaSelecionadaId}
          professores={equipe.filter((e) => e.ativo)}
          onSalvarValidacao={handleSalvarValidacao}
        />
      )}
    </div>
  );
}
