'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  Search,
  Plus,
  RefreshCw,
  Loader2,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { EquipeDiscipuladoItem } from '@/services/discipulado-pedagogico-service';

interface TabEquipeProps {
  ministryId: string;
  onNotification: (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => void;
}

interface MemberOption {
  id: string;
  name: string;
  phone?: string | null;
  celular?: string | null;
}

export default function TabEquipe({ ministryId: _ministryId, onNotification }: TabEquipeProps) {
  const [equipe, setEquipe] = useState<EquipeDiscipuladoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [buscaTexto, setBuscaTexto] = useState('');
  const [filtroPapel, setFiltroPapel] = useState<string>('todos');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');

  // Modal Novo Membro
  const [modalNovoMembroOpen, setModalNovoMembroOpen] = useState(false);
  const [membrosDisponiveis, setMembrosDisponiveis] = useState<MemberOption[]>([]);
  const [loadingMembros, setLoadingMembros] = useState(false);
  const [memberId, setMemberId] = useState('');
  const [papel, setPapel] = useState<'professor' | 'discipulador' | 'coordenador'>('professor');
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Modal Inativar
  const [modalInativarOpen, setModalInativarOpen] = useState(false);
  const [membroParaInativar, setMembroParaInativar] = useState<EquipeDiscipuladoItem | null>(null);
  const [motivoInativacao, setMotivoInativacao] = useState('');
  const [atualizandoStatus, setAtualizandoStatus] = useState(false);

  // Carregar Equipe
  const carregarEquipe = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/discipulado/equipe?ativo=false`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Erro ao carregar equipe de discipulado.');
      }
      const json = await res.json();
      setEquipe(json.equipe || []);
    } catch (err: any) {
      console.error('[carregarEquipe]', err);
      onNotification('error', 'Falha ao carregar equipe', err.message || 'Erro de conexão.');
    } finally {
      setLoading(false);
    }
  }, [onNotification]);

  useEffect(() => {
    carregarEquipe();
  }, [carregarEquipe]);

  // Carregar lista de membros para seleção
  const carregarMembros = async () => {
    setLoadingMembros(true);
    try {
      const res = await fetch('/api/v1/membros?limit=100');
      if (res.ok) {
        const data = await res.json();
        setMembrosDisponiveis(data.membros || data.data || []);
      }
    } catch (err) {
      console.error('[carregarMembros]', err);
    } finally {
      setLoadingMembros(false);
    }
  };

  const handleOpenNovoMembro = () => {
    setMemberId('');
    setPapel('professor');
    setObservacoes('');
    setModalNovoMembroOpen(true);
    if (membrosDisponiveis.length === 0) {
      carregarMembros();
    }
  };

  // Salvar novo membro na equipe
  const handleSalvarMembro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId) {
      onNotification('warning', 'Atenção', 'Selecione um membro da igreja para autorizar.');
      return;
    }

    setSalvando(true);
    try {
      const res = await fetch('/api/v1/discipulado/equipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          papel,
          autorizadoPorId: memberId, // vinculado ao ministério pelo backend
          observacoes,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Falha ao cadastrar na equipe.');
      }

      onNotification('success', 'Sucesso', 'Membro autorizado na equipe com êxito!');
      setModalNovoMembroOpen(false);
      carregarEquipe();
    } catch (err: any) {
      console.error('[handleSalvarMembro]', err);
      onNotification('error', 'Erro', err.message || 'Não foi possível cadastrar membro.');
    } finally {
      setSalvando(false);
    }
  };

  // Alterar status Ativo/Inativo
  const handleToggleAtivo = async (item: EquipeDiscipuladoItem) => {
    if (item.ativo) {
      // Inativar requer motivo
      setMembroParaInativar(item);
      setMotivoInativacao('');
      setModalInativarOpen(true);
    } else {
      // Reativar direto
      setAtualizandoStatus(true);
      try {
        const res = await fetch('/api/v1/discipulado/equipe', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id, ativo: true }),
        });
        const resJson = await res.json();
        if (!res.ok) {
          throw new Error(resJson.error || 'Falha ao reativar membro.');
        }
        onNotification('success', 'Sucesso', 'Membro reativado na equipe!');
        carregarEquipe();
      } catch (err: any) {
        onNotification('error', 'Erro', err.message || 'Falha ao reativar membro.');
      } finally {
        setAtualizandoStatus(false);
      }
    }
  };

  const handleConfirmarInativacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!membroParaInativar) return;

    setAtualizandoStatus(true);
    try {
      const res = await fetch('/api/v1/discipulado/equipe', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: membroParaInativar.id,
          ativo: false,
          motivoInativacao: motivoInativacao.trim() || 'Inativado pela liderança',
        }),
      });
      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Falha ao inativar membro.');
      }
      onNotification('success', 'Sucesso', 'Membro inativado na equipe.');
      setModalInativarOpen(false);
      setMembroParaInativar(null);
      carregarEquipe();
    } catch (err: any) {
      onNotification('error', 'Erro', err.message || 'Falha ao inativar membro.');
    } finally {
      setAtualizandoStatus(false);
    }
  };

  // Filtros
  const equipeFiltrada = useMemo(() => {
    return equipe.filter((item) => {
      const nome = item.member?.name?.toLowerCase() || '';
      const matchBusca = !buscaTexto.trim() || nome.includes(buscaTexto.toLowerCase());
      const matchPapel = filtroPapel === 'todos' || item.papel === filtroPapel;
      const matchStatus =
        filtroStatus === 'todos' ||
        (filtroStatus === 'ativo' && item.ativo) ||
        (filtroStatus === 'inativo' && !item.ativo);
      return matchBusca && matchPapel && matchStatus;
    });
  }, [equipe, buscaTexto, filtroPapel, filtroStatus]);

  // Contadores
  const contadores = useMemo(() => {
    const total = equipe.length;
    const ativos = equipe.filter((e) => e.ativo).length;
    const professores = equipe.filter((e) => e.ativo && e.papel === 'professor').length;
    const discipuladores = equipe.filter((e) => e.ativo && e.papel === 'discipulador').length;
    const coordenadores = equipe.filter((e) => e.ativo && e.papel === 'coordenador').length;
    return { total, ativos, professores, discipuladores, coordenadores };
  }, [equipe]);

  return (
    <div className="space-y-6">
      {/* Sub-cards de métricas de equipe */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Professores Ativos</p>
          <p className="text-2xl font-bold text-teal-700 mt-1">{contadores.professores}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Discipuladores</p>
          <p className="text-2xl font-bold text-indigo-700 mt-1">{contadores.discipuladores}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Coordenadores</p>
          <p className="text-2xl font-bold text-purple-700 mt-1">{contadores.coordenadores}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Ativos</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{contadores.ativos}</p>
        </div>
      </div>

      {/* Toolbar e Filtros */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-4 items-end">
          <div className="sm:col-span-2 lg:col-span-5">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Buscar na Equipe
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
              <input
                type="text"
                value={buscaTexto}
                onChange={(e) => setBuscaTexto(e.target.value)}
                placeholder="Nome do professor ou discipulador..."
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
              />
            </div>
          </div>

          <div className="lg:col-span-3">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Papel
            </label>
            <select
              value={filtroPapel}
              onChange={(e) => setFiltroPapel(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition cursor-pointer"
            >
              <option value="todos">Todos os Papéis</option>
              <option value="professor">Professor(a)</option>
              <option value="discipulador">Discipulador(a)</option>
              <option value="coordenador">Coordenador(a)</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Situação
            </label>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition cursor-pointer"
            >
              <option value="todos">Todos</option>
              <option value="ativo">Ativos</option>
              <option value="inativo">Inativos</option>
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-2 flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenNovoMembro}
              className="w-full px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white border border-teal-700 rounded-xl font-bold text-xs sm:text-sm transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Autorizar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Lista da Equipe */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200/80 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5 text-teal-700" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Lideranças e Professores Autorizados
              </h2>
              <p className="text-xs text-slate-500">
                Membros com atribuição para lecionar, validar lições e coordenar turmas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={carregarEquipe}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-teal-600' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto mb-3" />
            <p className="text-xs text-slate-500 font-semibold">Carregando equipe de discipulado...</p>
          </div>
        ) : equipeFiltrada.length === 0 ? (
          <div className="py-16 text-center space-y-3 p-6">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center mx-auto">
              <Users className="w-7 h-7 text-slate-400" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Nenhum membro encontrado</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Não há membros correspondentes aos filtros selecionados. Clique em <strong>&quot;+ Autorizar&quot;</strong> para cadastrar professores ou discipuladores.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-200/90 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Nome / Membro</th>
                  <th className="py-3 px-4">Papel Autorizado</th>
                  <th className="py-3 px-4 hidden md:table-cell">Congregação</th>
                  <th className="py-3 px-4 hidden sm:table-cell">Data Autorização</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80">
                {equipeFiltrada.map((item, index) => {
                  const papelBadge = {
                    coordenador: 'bg-purple-50 text-purple-800 border-purple-200',
                    professor: 'bg-teal-50 text-teal-800 border-teal-200',
                    discipulador: 'bg-indigo-50 text-indigo-800 border-indigo-200',
                  }[item.papel] || 'bg-slate-100 text-slate-700 border-slate-200';

                  const papelLabel = {
                    coordenador: 'Coordenador(a)',
                    professor: 'Professor(a)',
                    discipulador: 'Discipulador(a)',
                  }[item.papel] || item.papel;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        index % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-900 border border-teal-200 font-bold text-xs flex items-center justify-center shrink-0">
                            {item.member?.name ? item.member.name.slice(0, 2).toUpperCase() : 'ND'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm">
                              {item.member?.name || 'Membro não identificado'}
                            </p>
                            <p className="text-xs text-slate-500">
                              {item.member?.celular || item.member?.phone || 'Sem telefone'}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border ${papelBadge}`}>
                          {papelLabel}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 hidden md:table-cell text-xs text-slate-600 font-medium">
                        {item.congregacao?.nome || 'Sede / Todas'}
                      </td>

                      <td className="py-3.5 px-4 hidden sm:table-cell text-xs text-slate-600">
                        {item.data_autorizacao ? new Date(item.data_autorizacao).toLocaleDateString('pt-BR') : '—'}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {item.ativo ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200" title={item.motivo_inativacao || undefined}>
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                            Inativo
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleToggleAtivo(item)}
                          disabled={atualizandoStatus}
                          className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition cursor-pointer ${
                            item.ativo
                              ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {item.ativo ? 'Inativar' : 'Reativar'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL NOVO MEMBRO NA EQUIPE */}
      {modalNovoMembroOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-800 border border-teal-200 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Autorizar na Equipe</h3>
                  <p className="text-xs text-slate-500">Credencie um membro para o Discipulado</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalNovoMembroOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSalvarMembro} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Selecione o Membro da Igreja *
                </label>
                {loadingMembros ? (
                  <div className="py-3 text-xs text-slate-500 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                    Carregando membros cadastrados...
                  </div>
                ) : (
                  <select
                    value={memberId}
                    onChange={(e) => setMemberId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                  >
                    <option value="">-- Selecione o membro --</option>
                    {membrosDisponiveis.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} {m.celular ? `(${m.celular})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Papel no Discipulado *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'professor', label: 'Professor' },
                    { id: 'discipulador', label: 'Discipulador' },
                    { id: 'coordenador', label: 'Coordenador' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPapel(p.id as any)}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                        papel === p.id
                          ? 'bg-teal-50 border-teal-600 text-teal-800 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Observações / Ministério
                </label>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Ex: Formado em teologia básica, atua no templo sede..."
                  rows={2}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalNovoMembroOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>Confirmar Autorização</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL INATIVAR MEMBRO */}
      {modalInativarOpen && membroParaInativar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-rose-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-800 border border-rose-200 flex items-center justify-center font-bold">
                  <XCircle className="w-5 h-5 text-rose-700" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Inativar da Equipe</h3>
                  <p className="text-xs text-slate-500">Confirmação de alteração de status</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalInativarOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmarInativacao} className="p-5 space-y-4">
              <p className="text-sm text-slate-700 leading-relaxed">
                Tem certeza que deseja inativar <strong>{membroParaInativar.member?.name}</strong> como{' '}
                <strong>{membroParaInativar.papel}</strong>? O membro não poderá mais validar lições nem presidir chamadas.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Motivo da Inativação
                </label>
                <input
                  type="text"
                  value={motivoInativacao}
                  onChange={(e) => setMotivoInativacao(e.target.value)}
                  placeholder="Ex: Mudança de horário, viagem, transferência..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-600/20 focus:border-rose-600 transition"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalInativarOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={atualizandoStatus}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {atualizandoStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>Confirmar Inativação</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
