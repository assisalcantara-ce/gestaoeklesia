'use client';

import React, { useEffect, useState } from 'react';
import {
  Users,
  Award,
  HeartHandshake,
  Megaphone,
  Home,
  FileText,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Printer,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  X,
  Lock,
} from 'lucide-react';

interface CultoRegistro {
  id: string;
  data_culto: string;
  horario_culto: string;
  tipo_culto: string;
  dirigente?: string | null;
  pregador?: string | null;
  status: string;
  congregacoes?: {
    nome: string;
  } | null;
}

interface Props {
  culto: CultoRegistro;
  onClose: () => void;
  onVisitantesUpdated?: () => void;
}

type TabType = 'visitantes' | 'autoridades' | 'oracoes' | 'avisos' | 'familias' | 'resumo';

export default function CentralRecepcaoAdminModal({ culto, onClose, onVisitantesUpdated }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('visitantes');
  const [loading, setLoading] = useState(true);
  const [loadingToken, setLoadingToken] = useState(false);

  // Status do Token
  const [tokenInfo, setTokenInfo] = useState<{
    has_token: boolean;
    valido?: boolean;
    motivo?: string;
    mensagem?: string;
    expira_em?: string;
    revogado_em?: string | null;
  } | null>(null);

  // URL pública ativa gerada nesta sessão ou carregada
  const [activeUrl, setActiveUrl] = useState<string>('');
  const [linkCopied, setLinkCopied] = useState(false);

  // Dados das seções
  const [visitantes, setVisitantes] = useState<any[]>([]);
  const [autoridades, setAutoridades] = useState<any[]>([]);
  const [oracoes, setOracoes] = useState<any[]>([]);
  const [avisos, setAvisos] = useState<any[]>([]);
  const [familias, setFamilias] = useState<any[]>([]);
  const [resumo, setResumo] = useState<any | null>(null);

  // Sub-modal de criação / edição administrativa
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [subModalSecao, setSubModalSecao] = useState<TabType>('visitantes');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states
  const [formVisitante, setFormVisitante] = useState({
    nome: '',
    telefone: '',
    cidade: '',
    bairro: '',
    igreja_origem: '',
    primeira_visita: true,
    is_ministro: false,
    cargo_ministerial: 'Pastor',
    observacoes: '',
  });

  const [formAutoridade, setFormAutoridade] = useState({
    nome: '',
    cargo_funcao: '',
    instituicao: '',
    observacoes: '',
  });

  const [formOracao, setFormOracao] = useState({
    nome: '',
    tipo: 'pedido' as 'pedido' | 'acao_de_gracas',
    categoria: 'Saúde / Enfermidade',
    motivo: '',
    observacoes: '',
    is_privado: false,
  });

  const [formAviso, setFormAviso] = useState({
    titulo: '',
    conteudo: '',
    ordem: 1,
  });

  const [formFamilia, setFormFamilia] = useState({
    responsavel: '',
    membros_familia: '',
    total_membros: 1,
    origem: '',
    contato: '',
    intencao_congregar: false,
    observacoes: '',
  });

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const loadTokenStatus = async () => {
    setLoadingToken(true);
    try {
      const res = await fetch(`/api/v1/secretaria/cultos/${culto.id}/recepcao/token`);
      const data = await res.json();
      if (res.ok) {
        setTokenInfo(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingToken(false);
    }
  };

  const loadDados = async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    try {
      const res = await fetch(`/api/v1/secretaria/cultos/${culto.id}/recepcao`);
      const data = await res.json();
      if (res.ok) {
        setVisitantes(data.visitantes || []);
        setAutoridades(data.autoridades || []);
        setOracoes(data.oracoes || []);
        setAvisos(data.avisos || []);
        setFamilias(data.familias || []);
        setResumo(data.resumo || null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (!silencioso) setLoading(false);
    }
  };

  useEffect(() => {
    loadTokenStatus();
    loadDados();
  }, [culto.id]);

  // Gerar ou regenerar token
  const handleGerarToken = async () => {
    setLoadingToken(true);
    try {
      const res = await fetch(`/api/v1/secretaria/cultos/${culto.id}/recepcao/token`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao gerar link.');

      const fullUrl = `${window.location.origin}${data.path}`;
      setActiveUrl(fullUrl);
      setTokenInfo({
        has_token: true,
        valido: true,
        expira_em: data.expira_em,
      });
      showFeedback('success', 'Link temporário gerado com sucesso!');
    } catch (err: any) {
      showFeedback('error', err?.message || 'Erro ao gerar link.');
    } finally {
      setLoadingToken(false);
    }
  };

  // Revogar token
  const handleRevogarToken = async () => {
    if (!confirm('Deseja realmente revogar o acesso público deste culto? A equipe da recepção não poderá mais registrar novos visitantes pela página temporária.')) {
      return;
    }
    setLoadingToken(true);
    try {
      const res = await fetch(`/api/v1/secretaria/cultos/${culto.id}/recepcao/token`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao revogar link.');

      setActiveUrl('');
      setTokenInfo(prev => prev ? { ...prev, valido: false, motivo: 'TOKEN_REVOGADO', revogado_em: new Date().toISOString() } : null);
      showFeedback('success', 'Link de recepção revogado com êxito.');
    } catch (err: any) {
      showFeedback('error', err?.message || 'Erro ao revogar link.');
    } finally {
      setLoadingToken(false);
    }
  };

  // Copiar link
  const handleCopyLink = async () => {
    if (!activeUrl) return;
    await navigator.clipboard.writeText(activeUrl);
    setLinkCopied(true);
    showFeedback('success', 'Link copiado para a área de transferência!');
    setTimeout(() => setLinkCopied(false), 2500);
  };

  // Abertura do modal de criação
  const handleOpenNew = (secao: TabType) => {
    setSubModalSecao(secao);
    setEditingId(null);
    if (secao === 'visitantes') {
      setFormVisitante({
        nome: '',
        telefone: '',
        cidade: '',
        bairro: '',
        igreja_origem: '',
        primeira_visita: true,
        is_ministro: false,
        cargo_ministerial: 'Pastor',
        observacoes: '',
      });
    } else if (secao === 'autoridades') {
      setFormAutoridade({ nome: '', cargo_funcao: '', instituicao: '', observacoes: '' });
    } else if (secao === 'oracoes') {
      setFormOracao({
        nome: '',
        tipo: 'pedido',
        categoria: 'Saúde / Enfermidade',
        motivo: '',
        observacoes: '',
        is_privado: false,
      });
    } else if (secao === 'avisos') {
      setFormAviso({ titulo: '', conteudo: '', ordem: avisos.length + 1 });
    } else if (secao === 'familias') {
      setFormFamilia({
        responsavel: '',
        membros_familia: '',
        total_membros: 1,
        origem: '',
        contato: '',
        intencao_congregar: false,
        observacoes: '',
      });
    }
    setSubModalOpen(true);
  };

  // Abertura do modal de edição
  const handleOpenEdit = (secao: TabType, item: any) => {
    setSubModalSecao(secao);
    setEditingId(item.id);
    if (secao === 'visitantes') {
      setFormVisitante({
        nome: item.nome || '',
        telefone: item.telefone || '',
        cidade: item.cidade || '',
        bairro: item.bairro || '',
        igreja_origem: item.igreja_origem || '',
        primeira_visita: item.primeira_visita ?? true,
        is_ministro: item.is_ministro ?? false,
        cargo_ministerial: item.cargo_ministerial || 'Pastor',
        observacoes: item.observacoes || '',
      });
    } else if (secao === 'autoridades') {
      setFormAutoridade({
        nome: item.nome || '',
        cargo_funcao: item.cargo_funcao || '',
        instituicao: item.instituicao || '',
        observacoes: item.observacoes || '',
      });
    } else if (secao === 'oracoes') {
      setFormOracao({
        nome: item.nome || '',
        tipo: item.tipo || 'pedido',
        categoria: item.categoria || 'Saúde / Enfermidade',
        motivo: item.motivo || '',
        observacoes: item.observacoes || '',
        is_privado: item.is_privado ?? false,
      });
    } else if (secao === 'avisos') {
      setFormAviso({
        titulo: item.titulo || '',
        conteudo: item.conteudo || '',
        ordem: item.ordem || 1,
      });
    } else if (secao === 'familias') {
      setFormFamilia({
        responsavel: item.responsavel || '',
        membros_familia: item.membros_familia || '',
        total_membros: item.total_membros || 1,
        origem: item.origem || '',
        contato: item.contato || '',
        intencao_congregar: item.intencao_congregar ?? false,
        observacoes: item.observacoes || '',
      });
    }
    setSubModalOpen(true);
  };

  // Exclusão
  const handleDeleteItem = async (secao: TabType, id: string) => {
    if (!confirm('Deseja realmente remover este registro?')) return;
    try {
      const res = await fetch(`/api/v1/secretaria/cultos/${culto.id}/recepcao?secao=${secao}&id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao remover.');
      showFeedback('success', 'Registro removido!');
      await loadDados(true);
      if (secao === 'visitantes' && onVisitantesUpdated) onVisitantesUpdated();
    } catch (err: any) {
      showFeedback('error', err?.message || 'Erro ao remover.');
    }
  };

  // Salvar registro administrativo
  const handleSubmitSubModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let dados: any = {};
      if (subModalSecao === 'visitantes') dados = formVisitante;
      else if (subModalSecao === 'autoridades') dados = formAutoridade;
      else if (subModalSecao === 'oracoes') dados = formOracao;
      else if (subModalSecao === 'avisos') dados = formAviso;
      else if (subModalSecao === 'familias') dados = formFamilia;

      const method = editingId ? 'PUT' : 'POST';
      const bodyPayload = editingId
        ? { secao: subModalSecao, id: editingId, dados }
        : { secao: subModalSecao, dados };

      const res = await fetch(`/api/v1/secretaria/cultos/${culto.id}/recepcao`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao salvar.');

      showFeedback('success', data.ja_existia ? 'Visitante já cadastrado! Dados atualizados.' : 'Registro salvo com sucesso!');
      setSubModalOpen(false);
      await loadDados(true);
      if (subModalSecao === 'visitantes' && onVisitantesUpdated) onVisitantesUpdated();
    } catch (err: any) {
      showFeedback('error', err?.message || 'Erro ao salvar.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDateDisplay = (dateStr?: string | null) => {
    if (!dateStr) return '';
    const clean = dateStr.slice(0, 10);
    const parts = clean.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5 transition-all">
      <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[92vh] shadow-2xl flex flex-col overflow-hidden border border-slate-100">
        {/* Header Superior */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-teal-800 via-teal-700 to-cyan-800 text-white flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest font-black text-teal-200">Central de Recepção Oficial</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-white/10 text-teal-100 border border-white/20">
                {culto.congregacoes?.nome || 'Sede'}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black flex items-center gap-2 mt-0.5">
              <Users className="w-5 h-5 text-teal-200" />
              {culto.tipo_culto} · {formatDateDisplay(culto.data_culto)}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                loadTokenStatus();
                loadDados(true);
              }}
              className="p-2 text-teal-100 hover:text-white hover:bg-white/10 rounded-xl transition"
              title="Atualizar dados"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-teal-100 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Bar */}
        {feedbackMsg && (
          <div className={`px-5 py-2.5 text-xs font-bold flex items-center gap-2 ${
            feedbackMsg.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
          }`}>
            {feedbackMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {feedbackMsg.text}
          </div>
        )}

        {/* Banner de Gerenciamento do Acesso Público Temporário */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-800">Acesso Público da Recepção (Sem Login):</span>
                {tokenInfo?.valido ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <ShieldCheck className="w-3.5 h-3.5" /> Link Ativo até 23h59
                  </span>
                ) : tokenInfo?.motivo === 'TOKEN_REVOGADO' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300">
                    <ShieldAlert className="w-3.5 h-3.5" /> Link Revogado
                  </span>
                ) : tokenInfo?.motivo === 'TOKEN_EXPIRADO' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300">
                    <Clock className="w-3.5 h-3.5" /> Link Expirado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-slate-200 text-slate-700">
                    Nenhum link ativo
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Gere um link temporário seguro para os voluntários da recepção registrarem visitantes, autoridades, pedidos e famílias pelo celular.
              </p>

              {/* URL ativa para cópia imediata */}
              {activeUrl && tokenInfo?.valido && (
                <div className="mt-2.5 flex items-center gap-2 max-w-xl">
                  <div className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-700 truncate select-all shadow-inner">
                    {activeUrl}
                  </div>
                  <button
                    onClick={handleCopyLink}
                    className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0 shadow-sm"
                  >
                    {linkCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {linkCopied ? 'Copiado!' : 'Copiar'}
                  </button>
                  <a
                    href={activeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl transition cursor-pointer"
                    title="Abrir Página Pública em Nova Aba"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>

            {/* Ações do Link */}
            <div className="flex items-center gap-2 shrink-0">
              {tokenInfo?.valido ? (
                <>
                  <button
                    onClick={handleRevogarToken}
                    disabled={loadingToken}
                    className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" /> Revogar Link
                  </button>
                  <button
                    onClick={handleGerarToken}
                    disabled={loadingToken}
                    className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="Invalidar anterior e gerar novo"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Regenerar
                  </button>
                </>
              ) : (
                <button
                  onClick={handleGerarToken}
                  disabled={loadingToken}
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                >
                  {loadingToken && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Gerar Link da Recepção
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Abas Administrativas de Gestão */}
        <div className="flex border-b border-slate-200 px-6 bg-slate-50/70 overflow-x-auto no-scrollbar">
          {[
            { key: 'visitantes', label: 'Visitantes', icon: Users, count: visitantes.length },
            { key: 'autoridades', label: 'Autoridades', icon: Award, count: autoridades.length },
            { key: 'oracoes', label: 'Oração', icon: HeartHandshake, count: oracoes.length },
            { key: 'avisos', label: 'Avisos', icon: Megaphone, count: avisos.length },
            { key: 'familias', label: 'Famílias', icon: Home, count: familias.length },
            { key: 'resumo', label: 'Resumo do Culto', icon: FileText },
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as TabType)}
                className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
                  active
                    ? 'border-teal-700 text-teal-800 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {typeof tab.count === 'number' && (
                  <span className={`px-2 py-0.2 rounded-full text-[10px] font-black ${
                    active ? 'bg-teal-100 text-teal-900' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Conteúdo da Aba */}
        <div className="flex-1 p-5 sm:p-6 overflow-y-auto">
          {loading ? (
            <div className="min-h-[35vh] flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
            </div>
          ) : activeTab === 'visitantes' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-800">Visitantes Presentes no Culto</h3>
                  <p className="text-xs text-slate-500">Sincronizados com o QR Code e com a Central de Recepção</p>
                </div>
                <button
                  onClick={() => handleOpenNew('visitantes')}
                  className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Novo Visitante
                </button>
              </div>

              {visitantes.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <Users className="w-10 h-10 text-slate-350 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm font-bold">Nenhum visitante registrado para este culto</p>
                  <p className="text-xs text-slate-400 mt-1">Registros via QR Code ou recepção pública aparecem aqui automaticamente.</p>
                </div>
              ) : (
                <div className="overflow-hidden border border-slate-200 rounded-2xl shadow-sm">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <th className="p-3">Nome / Ministro</th>
                        <th className="p-3">Contato / Localização</th>
                        <th className="p-3">Origem / Status</th>
                        <th className="p-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visitantes.map(v => (
                        <tr key={v.id} className="hover:bg-slate-50/60 transition">
                          <td className="p-3">
                            <div className="font-bold text-slate-900">{v.nome}</div>
                            {v.is_ministro && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 mt-0.5 rounded text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                                {v.cargo_ministerial || 'Ministro'}
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="text-slate-700 font-medium">{v.telefone || 'Sem telefone'}</div>
                            <div className="text-[10px] text-slate-400">
                              {[v.bairro, v.cidade].filter(Boolean).join(', ') || 'Sem localização'}
                            </div>
                          </td>
                          <td className="p-3">
                            <div>
                              {v.primeira_visita ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-teal-50 text-teal-700 border border-teal-200">
                                  1ª Visita
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400">Já visitou</span>
                              )}
                            </div>
                            {v.igreja_origem && (
                              <div className="text-[11px] text-slate-500 mt-0.5 truncate max-w-xs">
                                {v.igreja_origem}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleOpenEdit('visitantes', v)}
                                className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-slate-100 rounded-lg transition"
                                title="Editar"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteItem('visitantes', v.id)}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                title="Inativar / Remover"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : activeTab === 'autoridades' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-800">Autoridades e Pastores Presentes</h3>
                  <p className="text-xs text-slate-500">Líderes de outros ministérios e autoridades públicas</p>
                </div>
                <button
                  onClick={() => handleOpenNew('autoridades')}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Nova Autoridade
                </button>
              </div>

              {autoridades.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <Award className="w-10 h-10 text-slate-350 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm font-bold">Nenhuma autoridade registrada</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {autoridades.map(a => (
                    <div key={a.id} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-start justify-between gap-3">
                      <div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase">
                          {a.cargo_funcao}
                        </span>
                        <h4 className="text-sm font-black text-slate-900 mt-1">{a.nome}</h4>
                        {a.instituicao && <p className="text-xs text-slate-500 mt-0.5">Instituição: {a.instituicao}</p>}
                        {a.observacoes && <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-xl mt-2 italic">"{a.observacoes}"</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleOpenEdit('autoridades', a)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteItem('autoridades', a.id)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'oracoes' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-800">Pedidos de Oração e Ações de Graças</h3>
                  <p className="text-xs text-slate-500">Motivos recebidos pela recepção com distinção de privacidade</p>
                </div>
                <button
                  onClick={() => handleOpenNew('oracoes')}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Novo Pedido
                </button>
              </div>

              {oracoes.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <HeartHandshake className="w-10 h-10 text-slate-350 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm font-bold">Nenhum pedido de oração registrado</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {oracoes.map(o => (
                    <div key={o.id} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            o.tipo === 'acao_de_gracas' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'
                          }`}>
                            {o.tipo === 'acao_de_gracas' ? 'Ação de Graças' : 'Oração'}
                          </span>
                          {o.is_privado && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                              <Lock className="w-3 h-3" /> Confidencial
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-black text-slate-900 mt-1">{o.nome}</h4>
                        <p className="text-xs text-slate-700 mt-1 bg-slate-50 p-2 rounded-xl">{o.motivo}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleOpenEdit('oracoes', o)} className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteItem('oracoes', o.id)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'avisos' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-800">Avisos do Culto</h3>
                  <p className="text-xs text-slate-500">Avisos e recados para leitura oficial no púlpito</p>
                </div>
                <button
                  onClick={() => handleOpenNew('avisos')}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Novo Aviso
                </button>
              </div>

              {avisos.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <Megaphone className="w-10 h-10 text-slate-350 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm font-bold">Nenhum aviso registrado</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {avisos.sort((a, b) => a.ordem - b.ordem).map((av, idx) => (
                    <div key={av.id} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-900 text-xs font-black flex items-center justify-center shrink-0">
                          {av.ordem || idx + 1}
                        </span>
                        <div>
                          <h4 className="text-sm font-black text-slate-900">{av.titulo}</h4>
                          <p className="text-xs text-slate-700 mt-1 whitespace-pre-line bg-slate-50 p-2.5 rounded-xl">{av.conteudo}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleOpenEdit('avisos', av)} className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteItem('avisos', av.id)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'familias' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-800">Famílias Recebidas</h3>
                  <p className="text-xs text-slate-500">Acompanhamento e acolhimento conjunto de famílias</p>
                </div>
                <button
                  onClick={() => handleOpenNew('familias')}
                  className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Nova Família
                </button>
              </div>

              {familias.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <Home className="w-10 h-10 text-slate-350 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm font-bold">Nenhuma família registrada</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {familias.map(f => (
                    <div key={f.id} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-black text-slate-900">{f.responsavel}</h4>
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-50 text-purple-700 border border-purple-200">
                            {f.total_membros} pessoas
                          </span>
                          {f.intencao_congregar && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Quer Congregar
                            </span>
                          )}
                        </div>
                        {f.membros_familia && <p className="text-xs text-slate-600 mt-1">Membros: {f.membros_familia}</p>}
                        {f.origem && <p className="text-xs text-slate-500 mt-0.5">Origem: {f.origem}</p>}
                        {f.contato && <p className="text-xs text-slate-500 mt-0.5">Contato: {f.contato}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleOpenEdit('familias', f)} className="p-1.5 text-slate-400 hover:text-purple-600 rounded-lg">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteItem('familias', f.id)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'resumo' && resumo ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Briefing Executivo para o Altar</h3>
                  <p className="text-xs text-slate-500">Relatório consolidado para leitura e acolhimento durante o culto</p>
                </div>
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Imprimir Resumo
                </button>
              </div>

              {/* Indicadores */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-teal-50 p-3.5 rounded-2xl border border-teal-200">
                  <span className="text-xs font-bold text-teal-800">Visitantes</span>
                  <p className="text-2xl font-black text-teal-900">{resumo.totais.visitantes}</p>
                  <span className="text-[11px] text-teal-700">{resumo.totais.visitantes_primeira_vez} de 1ª vez</span>
                </div>
                <div className="bg-indigo-50 p-3.5 rounded-2xl border border-indigo-200">
                  <span className="text-xs font-bold text-indigo-800">Autoridades</span>
                  <p className="text-2xl font-black text-indigo-900">{resumo.totais.autoridades}</p>
                  <span className="text-[11px] text-indigo-700">Presentes</span>
                </div>
                <div className="bg-purple-50 p-3.5 rounded-2xl border border-purple-200">
                  <span className="text-xs font-bold text-purple-800">Famílias</span>
                  <p className="text-2xl font-black text-purple-900">{resumo.totais.familias}</p>
                  <span className="text-[11px] text-purple-700">{resumo.totais.total_pessoas_familias} pessoas total</span>
                </div>
                <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-200">
                  <span className="text-xs font-bold text-emerald-800">Orações</span>
                  <p className="text-2xl font-black text-emerald-900">{resumo.totais.pedidos_oracao + resumo.totais.acoes_de_gracas}</p>
                  <span className="text-[11px] text-emerald-700">{resumo.totais.oracoes_publicas} públicas</span>
                </div>
              </div>

              {/* Seção Autoridades */}
              <div>
                <h4 className="text-xs font-black uppercase text-indigo-800 tracking-wider mb-2 flex items-center gap-1.5">
                  <Award className="w-4 h-4" /> Autoridades para Acolhimento
                </h4>
                {resumo.autoridades_mencao.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Nenhuma autoridade registrada.</p>
                ) : (
                  <div className="space-y-1.5">
                    {resumo.autoridades_mencao.map((a: any) => (
                      <div key={a.id} className="p-2.5 bg-indigo-50/50 rounded-xl text-xs text-slate-800">
                        <strong>{a.nome}</strong> ({a.cargo_funcao}) {a.instituicao && `· ${a.instituicao}`}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Seção Avisos */}
              <div>
                <h4 className="text-xs font-black uppercase text-amber-800 tracking-wider mb-2 flex items-center gap-1.5">
                  <Megaphone className="w-4 h-4" /> Avisos Oficiais em Ordem
                </h4>
                {resumo.avisos_ordenados.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Nenhum aviso registrado.</p>
                ) : (
                  <div className="space-y-2">
                    {resumo.avisos_ordenados.map((av: any, i: number) => (
                      <div key={av.id} className="p-2.5 bg-amber-50/50 rounded-xl text-xs text-slate-800 flex items-start gap-2">
                        <span className="w-5 h-5 bg-amber-200 text-amber-900 rounded-full font-black flex items-center justify-center shrink-0">
                          {av.ordem || i + 1}
                        </span>
                        <div>
                          <strong>{av.titulo}:</strong> {av.conteudo}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Seção Clamor */}
              <div>
                <h4 className="text-xs font-black uppercase text-emerald-800 tracking-wider mb-2 flex items-center gap-1.5">
                  <HeartHandshake className="w-4 h-4" /> Pedidos para Oração da Igreja
                </h4>
                {resumo.oracoes_publicas.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Nenhum pedido público registrado.</p>
                ) : (
                  <div className="space-y-2">
                    {resumo.oracoes_publicas.map((o: any) => (
                      <div key={o.id} className="p-2.5 bg-emerald-50/50 rounded-xl text-xs text-slate-800">
                        <strong>{o.nome}:</strong> {o.motivo}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer do Modal Principal */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <p className="text-[11px] text-slate-400">
            Os dados permanecem registrados no histórico oficial do culto mesmo após a expiração do link público.
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer"
          >
            Fechar Recepção
          </button>
        </div>
      </div>

      {/* Sub-modal de Edição / Inclusão Administrativa */}
      {subModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200">
            <div className="p-4 bg-gradient-to-r from-teal-700 to-cyan-800 text-white flex items-center justify-between">
              <h4 className="text-sm font-black">
                {editingId ? 'Editar Registro' : 'Novo Registro na Recepção'}
              </h4>
              <button onClick={() => setSubModalOpen(false)} className="text-teal-200 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSubmitSubModal} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {subModalSecao === 'visitantes' && (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nome Completo *</label>
                    <input
                      type="text"
                      required
                      value={formVisitante.nome}
                      onChange={e => setFormVisitante(prev => ({ ...prev, nome: e.target.value }))}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Telefone / WhatsApp</label>
                    <input
                      type="tel"
                      value={formVisitante.telefone}
                      onChange={e => setFormVisitante(prev => ({ ...prev, telefone: e.target.value }))}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Cidade</label>
                      <input
                        type="text"
                        value={formVisitante.cidade}
                        onChange={e => setFormVisitante(prev => ({ ...prev, cidade: e.target.value }))}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Bairro</label>
                      <input
                        type="text"
                        value={formVisitante.bairro}
                        onChange={e => setFormVisitante(prev => ({ ...prev, bairro: e.target.value }))}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Igreja de Origem</label>
                    <input
                      type="text"
                      value={formVisitante.igreja_origem}
                      onChange={e => setFormVisitante(prev => ({ ...prev, igreja_origem: e.target.value }))}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formVisitante.primeira_visita}
                        onChange={e => setFormVisitante(prev => ({ ...prev, primeira_visita: e.target.checked }))}
                        className="w-4 h-4 text-teal-600 rounded"
                      />
                      1ª Visita
                    </label>
                    <label className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formVisitante.is_ministro}
                        onChange={e => setFormVisitante(prev => ({ ...prev, is_ministro: e.target.checked }))}
                        className="w-4 h-4 text-teal-600 rounded"
                      />
                      Ministro
                    </label>
                  </div>
                  {formVisitante.is_ministro && (
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Cargo Ministerial</label>
                      <select
                        value={formVisitante.cargo_ministerial}
                        onChange={e => setFormVisitante(prev => ({ ...prev, cargo_ministerial: e.target.value }))}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white"
                      >
                        <option value="Pastor">Pastor</option>
                        <option value="Evangelista">Evangelista</option>
                        <option value="Presbítero">Presbítero</option>
                        <option value="Diácono">Diácono</option>
                        <option value="Missionário">Missionário</option>
                        <option value="Outro">Outro</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Observações</label>
                    <textarea
                      rows={2}
                      value={formVisitante.observacoes}
                      onChange={e => setFormVisitante(prev => ({ ...prev, observacoes: e.target.value }))}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2"
                    />
                  </div>
                </>
              )}

              {subModalSecao === 'autoridades' && (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nome Completo *</label>
                    <input
                      type="text"
                      required
                      value={formAutoridade.nome}
                      onChange={e => setFormAutoridade(prev => ({ ...prev, nome: e.target.value }))}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Cargo / Função *</label>
                    <input
                      type="text"
                      required
                      value={formAutoridade.cargo_funcao}
                      onChange={e => setFormAutoridade(prev => ({ ...prev, cargo_funcao: e.target.value }))}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Instituição / Ministério</label>
                    <input
                      type="text"
                      value={formAutoridade.instituicao}
                      onChange={e => setFormAutoridade(prev => ({ ...prev, instituicao: e.target.value }))}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Observações</label>
                    <textarea
                      rows={2}
                      value={formAutoridade.observacoes}
                      onChange={e => setFormAutoridade(prev => ({ ...prev, observacoes: e.target.value }))}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2"
                    />
                  </div>
                </>
              )}

              {subModalSecao === 'oracoes' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Tipo</label>
                      <select
                        value={formOracao.tipo}
                        onChange={e => setFormOracao(prev => ({ ...prev, tipo: e.target.value as any }))}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white"
                      >
                        <option value="pedido">Pedido</option>
                        <option value="acao_de_gracas">Ação de Graças</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Categoria</label>
                      <input
                        type="text"
                        value={formOracao.categoria}
                        onChange={e => setFormOracao(prev => ({ ...prev, categoria: e.target.value }))}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nome *</label>
                    <input
                      type="text"
                      required
                      value={formOracao.nome}
                      onChange={e => setFormOracao(prev => ({ ...prev, nome: e.target.value }))}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Motivo *</label>
                    <textarea
                      rows={3}
                      required
                      value={formOracao.motivo}
                      onChange={e => setFormOracao(prev => ({ ...prev, motivo: e.target.value }))}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2"
                    />
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-rose-800">
                      <input
                        type="checkbox"
                        checked={formOracao.is_privado}
                        onChange={e => setFormOracao(prev => ({ ...prev, is_privado: e.target.checked }))}
                        className="w-4 h-4 text-rose-600 rounded"
                      />
                      <Lock className="w-3.5 h-3.5" /> Pedido Confidencial / Pastores
                    </label>
                  </div>
                </>
              )}

              {subModalSecao === 'avisos' && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="block font-bold text-slate-700 mb-1">Título *</label>
                      <input
                        type="text"
                        required
                        value={formAviso.titulo}
                        onChange={e => setFormAviso(prev => ({ ...prev, titulo: e.target.value }))}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Ordem</label>
                      <input
                        type="number"
                        min={1}
                        value={formAviso.ordem}
                        onChange={e => setFormAviso(prev => ({ ...prev, ordem: Number(e.target.value) || 1 }))}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Conteúdo do Aviso *</label>
                    <textarea
                      rows={4}
                      required
                      value={formAviso.conteudo}
                      onChange={e => setFormAviso(prev => ({ ...prev, conteudo: e.target.value }))}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2"
                    />
                  </div>
                </>
              )}

              {subModalSecao === 'familias' && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="block font-bold text-slate-700 mb-1">Responsável *</label>
                      <input
                        type="text"
                        required
                        value={formFamilia.responsavel}
                        onChange={e => setFormFamilia(prev => ({ ...prev, responsavel: e.target.value }))}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Total Pessoas</label>
                      <input
                        type="number"
                        min={1}
                        value={formFamilia.total_membros}
                        onChange={e => setFormFamilia(prev => ({ ...prev, total_membros: Number(e.target.value) || 1 }))}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Integrantes da Família</label>
                    <input
                      type="text"
                      value={formFamilia.membros_familia}
                      onChange={e => setFormFamilia(prev => ({ ...prev, membros_familia: e.target.value }))}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Origem / Bairro</label>
                      <input
                        type="text"
                        value={formFamilia.origem}
                        onChange={e => setFormFamilia(prev => ({ ...prev, origem: e.target.value }))}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Contato</label>
                      <input
                        type="tel"
                        value={formFamilia.contato}
                        onChange={e => setFormFamilia(prev => ({ ...prev, contato: e.target.value }))}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-purple-900">
                    <input
                      type="checkbox"
                      checked={formFamilia.intencao_congregar}
                      onChange={e => setFormFamilia(prev => ({ ...prev, intencao_congregar: e.target.checked }))}
                      className="w-4 h-4 text-purple-600 rounded"
                    />
                    Tem intenção de congregar na igreja
                  </label>
                </>
              )}

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSubModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingId ? 'Salvar' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
