'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
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
  Loader2,
  Clock,
  Printer,
  ShieldAlert,
  Lock,
  RefreshCw,
  Phone,
  Building,
  MapPin,
  Calendar,
} from 'lucide-react';

interface CultoInfo {
  id: string;
  tipo_culto: string;
  data_culto: string;
  horario_culto: string;
  dirigente?: string | null;
  pregador?: string | null;
  status: string;
  congregacao_nome: string;
}

interface Visitante {
  id: string;
  nome: string;
  telefone?: string | null;
  cidade?: string | null;
  bairro?: string | null;
  igreja_origem?: string | null;
  primeira_visita: boolean;
  is_ministro: boolean;
  cargo_ministerial?: string | null;
  observacoes?: string | null;
}

interface Autoridade {
  id: string;
  nome: string;
  cargo_funcao: string;
  instituicao?: string | null;
  observacoes?: string | null;
}

interface Oracao {
  id: string;
  nome: string;
  tipo: 'pedido' | 'acao_de_gracas';
  categoria?: string | null;
  motivo: string;
  observacoes?: string | null;
  is_privado: boolean;
}

interface Aviso {
  id: string;
  titulo: string;
  conteudo: string;
  ordem: number;
}

interface Familia {
  id: string;
  responsavel: string;
  membros_familia?: string | null;
  total_membros: number;
  origem?: string | null;
  contato?: string | null;
  intencao_congregar: boolean;
  observacoes?: string | null;
}

interface Resumo {
  totais: {
    visitantes: number;
    visitantes_primeira_vez: number;
    autoridades: number;
    pedidos_oracao: number;
    acoes_de_gracas: number;
    oracoes_privadas: number;
    oracoes_publicas: number;
    familias: number;
    total_pessoas_familias: number;
    intencoes_congregar: number;
    avisos: number;
  };
  autoridades_mencao: Array<{
    id: string;
    nome: string;
    cargo_funcao: string;
    instituicao?: string | null;
    observacoes?: string | null;
  }>;
  avisos_ordenados: Array<{
    id: string;
    titulo: string;
    conteudo: string;
    ordem: number;
  }>;
  oracoes_publicas: Array<{
    id: string;
    nome: string;
    tipo: 'pedido' | 'acao_de_gracas';
    categoria?: string | null;
    motivo: string;
    observacoes?: string | null;
  }>;
  familias_acolhimento: Array<{
    id: string;
    responsavel: string;
    membros_familia?: string | null;
    total_membros: number;
    origem?: string | null;
    intencao_congregar: boolean;
  }>;
}

type TabType = 'visitantes' | 'autoridades' | 'oracoes' | 'avisos' | 'familias' | 'resumo';

export default function CentralRecepcaoPublicPage() {
  const params = useParams();
  const rawParam = Array.isArray(params?.token) ? params.token[0] : params?.token;
  const token = typeof rawParam === 'string' ? decodeURIComponent(rawParam).trim() : '';

  const [loading, setLoading] = useState(true);
  const [errorInfo, setErrorInfo] = useState<{ title: string; message: string; code?: string } | null>(null);

  const [igrejaNome, setIgrejaNome] = useState('Gestão Eklésia');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [culto, setCulto] = useState<CultoInfo | null>(null);
  const [expiraEm, setExpiraEm] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabType>('visitantes');

  const [visitantes, setVisitantes] = useState<Visitante[]>([]);
  const [autoridades, setAutoridades] = useState<Autoridade[]>([]);
  const [oracoes, setOracoes] = useState<Oracao[]>([]);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);

  // Modais de Criação e Edição
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSecao, setModalSecao] = useState<TabType>('visitantes');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Forms states
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

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const loadData = async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    try {
      const res = await fetch(`/api/v1/public/recepcao/${token}`);
      const data = await res.json();

      if (!res.ok) {
        let title = 'Acesso Indisponível';
        if (data.code === 'TOKEN_EXPIRADO') title = 'Link Expirado';
        else if (data.code === 'TOKEN_REVOGADO') title = 'Link Revogado';
        else if (data.code === 'CULTO_CANCELADO') title = 'Culto Cancelado';
        else if (data.code === 'TOKEN_NAO_ENCONTRADO') title = 'Link Não Encontrado';
        else if (data.code === 'TOKEN_INVALIDO') title = 'Link Inválido';
        else if (data.code === 'ERRO_INTERNO' || res.status === 500) title = 'Instabilidade no Servidor';
        else if (data.code === 'RATE_LIMIT_EXCEEDED' || res.status === 429) title = 'Limite de Requisições Excedido';

        setErrorInfo({
          title,
          message: data.error || 'Não foi possível acessar a Central de Recepção.',
          code: data.code,
        });
        return;
      }

      setIgrejaNome(data.igreja_nome || 'Gestão Eklésia');
      setLogoUrl(data.logo_url || null);
      setCulto(data.culto);
      setExpiraEm(data.expira_em);
      setVisitantes(data.visitantes || []);
      setAutoridades(data.autoridades || []);
      setOracoes(data.oracoes || []);
      setAvisos(data.avisos || []);
      setFamilias(data.familias || []);
      setResumo(data.resumo || null);
      setErrorInfo(null);
    } catch {
      setErrorInfo({
        title: 'Erro de Conexão',
        message: 'Verifique sua conexão com a internet e tente novamente.',
      });
    } finally {
      if (!silencioso) setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadData();
  }, [token]);

  // Abertura do modal para novo item
  const handleOpenNew = (secao: TabType) => {
    setModalSecao(secao);
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
    setModalOpen(true);
  };

  // Abertura do modal para edição
  const handleEdit = (secao: TabType, item: any) => {
    setModalSecao(secao);
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
    setModalOpen(true);
  };

  // Exclusão de item
  const handleDelete = async (secao: TabType, id: string) => {
    if (!confirm('Deseja realmente remover este registro da recepção?')) return;
    try {
      const res = await fetch(`/api/v1/public/recepcao/${token}?secao=${secao}&id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao remover registro.');
      showToast(data.mensagem || 'Registro removido com sucesso!');
      await loadData(true);
    } catch (err: any) {
      alert(err?.message || 'Falha ao remover.');
    }
  };

  // Submissão do formulário
  const handleSubmitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let dados: any = {};
      if (modalSecao === 'visitantes') dados = formVisitante;
      else if (modalSecao === 'autoridades') dados = formAutoridade;
      else if (modalSecao === 'oracoes') dados = formOracao;
      else if (modalSecao === 'avisos') dados = formAviso;
      else if (modalSecao === 'familias') dados = formFamilia;

      const method = editingId ? 'PUT' : 'POST';
      const bodyPayload = editingId
        ? { secao: modalSecao, id: editingId, dados }
        : { secao: modalSecao, dados };

      const res = await fetch(`/api/v1/public/recepcao/${token}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao salvar registro.');

      showToast(data.mensagem || 'Salvo com sucesso!');
      setModalOpen(false);
      await loadData(true);
    } catch (err: any) {
      alert(err?.message || 'Ocorreu um erro.');
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-teal-600 animate-spin mb-4" />
        <h2 className="text-base font-bold text-slate-800">Carregando Central de Recepção...</h2>
        <p className="text-xs text-slate-500 mt-1">Conectando ao culto com acesso seguro</p>
      </div>
    );
  }

  if (errorInfo) {
    const isExpirado = errorInfo.code === 'TOKEN_EXPIRADO';
    const isRevogado = errorInfo.code === 'TOKEN_REVOGADO';
    const isCancelado = errorInfo.code === 'CULTO_CANCELADO';
    const isServidor = errorInfo.code === 'ERRO_INTERNO';

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-xl border border-slate-200 text-center">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
            isExpirado ? 'bg-amber-50 text-amber-600' : (isRevogado || isCancelado ? 'bg-slate-100 text-slate-600' : 'bg-rose-50 text-rose-600')
          }`}>
            {isExpirado ? <Clock className="w-8 h-8" /> : (isRevogado ? <Lock className="w-8 h-8" /> : <ShieldAlert className="w-8 h-8" />)}
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">{errorInfo.title}</h2>
          <p className="text-sm text-slate-600 mb-6">{errorInfo.message}</p>
          <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-500 mb-6 text-left">
            <p><strong>Observação de Segurança:</strong></p>
            <p className="mt-1">
              {isExpirado
                ? 'Os links da Central de Recepção expiram às 23h59 do dia do culto para proteger a privacidade dos visitantes. Para novos registros, use o painel administrativo ou solicite novo link à secretaria.'
                : (isRevogado
                  ? 'Este link foi revogado pela administração e não aceita mais consultas nem novos registros.'
                  : (isServidor
                    ? 'Houve uma instabilidade temporária de comunicação com o servidor. Tente novamente em instantes.'
                    : 'Os links da Central de Recepção são temporários, válidos estritamente até às 23h59 do dia do culto para proteção de dados.'))}
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition cursor-pointer flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col antialiased">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-sm font-bold border border-slate-700 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {toastMsg}
        </div>
      )}

      {/* Header Mobile-First */}
      <header className="bg-gradient-to-r from-teal-800 via-teal-700 to-cyan-800 text-white shadow-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={igrejaNome} className="w-10 h-10 object-contain rounded-xl bg-white/10 p-1" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center font-black text-base">
                ✝
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-widest font-black text-teal-200">Central de Recepção</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-200 border border-emerald-400/30" title={expiraEm ? `Válido até ${new Date(expiraEm).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : undefined}>
                  <Clock className="w-3 h-3" /> Até 23h59
                </span>
              </div>
              <h1 className="text-sm sm:text-base font-black truncate max-w-[220px] sm:max-w-sm">
                {culto?.tipo_culto || 'Culto Oficial'}
              </h1>
            </div>
          </div>

          <button
            onClick={() => loadData(true)}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition text-white"
            title="Atualizar dados em tempo real"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-bar com detalhes do culto */}
        <div className="bg-teal-900/50 border-t border-white/10 px-4 py-2 text-[11px] text-teal-100">
          <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-teal-300" />
                {formatDateDisplay(culto?.data_culto)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-teal-300" />
                {culto?.horario_culto || '19:00'}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-teal-300" />
                {culto?.congregacao_nome || 'Sede'}
              </span>
            </div>
            {culto?.dirigente && (
              <span className="truncate max-w-[200px]">
                Dirigente: <strong>{culto.dirigente}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Abas de Navegação (Rolagem Horizontal Suave para Mobile) */}
        <div className="max-w-4xl mx-auto px-2 overflow-x-auto no-scrollbar border-t border-white/10 flex">
          {[
            { key: 'visitantes', label: 'Visitantes', icon: Users, count: visitantes.length },
            { key: 'autoridades', label: 'Autoridades', icon: Award, count: autoridades.length },
            { key: 'oracoes', label: 'Oração', icon: HeartHandshake, count: oracoes.length },
            { key: 'avisos', label: 'Avisos', icon: Megaphone, count: avisos.length },
            { key: 'familias', label: 'Famílias', icon: Home, count: familias.length },
            { key: 'resumo', label: 'Resumo', icon: FileText },
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as TabType)}
                className={`flex items-center gap-1.5 px-3.5 py-3 text-xs font-bold whitespace-nowrap transition border-b-2 cursor-pointer ${
                  active
                    ? 'border-white text-white bg-white/10'
                    : 'border-transparent text-teal-200 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {typeof tab.count === 'number' && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    active ? 'bg-white text-teal-900' : 'bg-teal-900/60 text-teal-200'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 pb-24">
        {/* TAB 1: VISITANTES */}
        {activeTab === 'visitantes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-800">Visitantes do Culto</h2>
                <p className="text-xs text-slate-500">Reutiliza a lista do Acolhimento e sincroniza com o QR Code</p>
              </div>
              <button
                onClick={() => handleOpenNew('visitantes')}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Cadastrar Visitante
              </button>
            </div>

            {visitantes.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-slate-200">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-700">Nenhum visitante registrado ainda</p>
                <p className="text-xs text-slate-400 mt-1">Visitantes registrados pelo QR Code ou inseridos pela recepção aparecerão aqui em tempo real.</p>
                <button
                  onClick={() => handleOpenNew('visitantes')}
                  className="mt-4 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar Primeiro Visitante
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {visitantes.map(v => (
                  <div key={v.id} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm relative hover:border-teal-300 transition">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-sm font-black text-slate-900">{v.nome}</h3>
                          {v.primeira_visita && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-50 text-teal-700 border border-teal-200">
                              1ª Vez
                            </span>
                          )}
                          {v.is_ministro && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {v.cargo_ministerial || 'Ministro'}
                            </span>
                          )}
                        </div>
                        {v.telefone && (
                          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" /> {v.telefone}
                          </p>
                        )}
                        {(v.bairro || v.cidade) && (
                          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" /> {[v.bairro, v.cidade].filter(Boolean).join(', ')}
                          </p>
                        )}
                        {v.igreja_origem && (
                          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                            <Building className="w-3 h-3 text-slate-400" /> {v.igreja_origem}
                          </p>
                        )}
                        {v.observacoes && (
                          <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-xl mt-2 italic">
                            "{v.observacoes}"
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit('visitantes', v)}
                          className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"
                          title="Editar Visitante"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete('visitantes', v.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Remover"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: AUTORIDADES E PASTORES */}
        {activeTab === 'autoridades' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-800">Autoridades e Pastores</h2>
                <p className="text-xs text-slate-500">Lideranças civis, eclesiásticas e visitantes ilustres</p>
              </div>
              <button
                onClick={() => handleOpenNew('autoridades')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Registrar Autoridade
              </button>
            </div>

            {autoridades.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-slate-200">
                <Award className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-700">Nenhuma autoridade registrada</p>
                <p className="text-xs text-slate-400 mt-1">Pastores visitantes, líderes municipais e autoridades presentes podem ser listados aqui.</p>
                <button
                  onClick={() => handleOpenNew('autoridades')}
                  className="mt-4 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar Autoridade
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {autoridades.map(a => (
                  <div key={a.id} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm relative hover:border-indigo-300 transition">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase">
                          {a.cargo_funcao}
                        </span>
                        <h3 className="text-sm font-black text-slate-900 mt-1">{a.nome}</h3>
                        {a.instituicao && (
                          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                            <Building className="w-3 h-3 text-slate-400" /> {a.instituicao}
                          </p>
                        )}
                        {a.observacoes && (
                          <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-xl mt-2 italic">
                            "{a.observacoes}"
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit('autoridades', a)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete('autoridades', a.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ORAÇÃO E AÇÕES DE GRAÇAS */}
        {activeTab === 'oracoes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-800">Pedidos de Oração e Gratidão</h2>
                <p className="text-xs text-slate-500">Clamor da igreja e ações de graças recebidas na recepção</p>
              </div>
              <button
                onClick={() => handleOpenNew('oracoes')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Adicionar Pedido
              </button>
            </div>

            {oracoes.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-slate-200">
                <HeartHandshake className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-700">Nenhum pedido de oração registrado</p>
                <p className="text-xs text-slate-400 mt-1">Pedidos de oração por saúde, causas ou vitórias podem ser anotados para o clamor.</p>
                <button
                  onClick={() => handleOpenNew('oracoes')}
                  className="mt-4 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar Pedido de Oração
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {oracoes.map(o => (
                  <div key={o.id} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm relative hover:border-emerald-300 transition">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            o.tipo === 'acao_de_gracas'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {o.tipo === 'acao_de_gracas' ? 'Ação de Graças' : 'Oração'}
                          </span>
                          {o.categoria && (
                            <span className="text-[11px] font-bold text-slate-500">
                              · {o.categoria}
                            </span>
                          )}
                          {o.is_privado && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded-md text-[10px] font-bold border border-rose-200">
                              <Lock className="w-3 h-3" /> Confidencial / Pastores
                            </span>
                          )}
                        </div>

                        <h3 className="text-sm font-black text-slate-900 mt-1.5">{o.nome}</h3>
                        <p className="text-xs text-slate-700 mt-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          {o.motivo}
                        </p>
                        {o.observacoes && (
                          <p className="text-[11px] text-slate-500 mt-1 italic">
                            Obs: {o.observacoes}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit('oracoes', o)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete('oracoes', o.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: AVISOS */}
        {activeTab === 'avisos' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-800">Avisos da Recepção</h2>
                <p className="text-xs text-slate-500">Comunicações e recados na ordem de apresentação</p>
              </div>
              <button
                onClick={() => handleOpenNew('avisos')}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Novo Aviso
              </button>
            </div>

            {avisos.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-slate-200">
                <Megaphone className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-700">Nenhum aviso registrado</p>
                <p className="text-xs text-slate-400 mt-1">Cadastre recados urgentes ou avisos que devem ser lidos pelo dirigente.</p>
                <button
                  onClick={() => handleOpenNew('avisos')}
                  className="mt-4 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Criar Aviso
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {avisos.sort((a, b) => a.ordem - b.ordem).map((av, idx) => (
                  <div key={av.id} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-start justify-between gap-3 hover:border-amber-300 transition">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 flex items-center justify-center text-xs font-black shrink-0">
                        {av.ordem || idx + 1}
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900">{av.titulo}</h3>
                        <p className="text-xs text-slate-600 mt-1 whitespace-pre-line bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          {av.conteudo}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit('avisos', av)}
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete('avisos', av.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: FAMÍLIAS RECEBIDAS */}
        {activeTab === 'familias' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-800">Famílias Recebidas</h2>
                <p className="text-xs text-slate-500">Famílias visitantes e intenção de congregar</p>
              </div>
              <button
                onClick={() => handleOpenNew('familias')}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Registrar Família
              </button>
            </div>

            {familias.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-slate-200">
                <Home className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-700">Nenhuma família registrada</p>
                <p className="text-xs text-slate-400 mt-1">Famílias que chegam juntas à igreja podem ser registradas para acompanhamento conjunto.</p>
                <button
                  onClick={() => handleOpenNew('familias')}
                  className="mt-4 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar Família
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {familias.map(f => (
                  <div key={f.id} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm relative hover:border-purple-300 transition">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-black text-slate-900">Família {f.responsavel}</h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-50 text-purple-700 border border-purple-200">
                            {f.total_membros} {f.total_membros === 1 ? 'membro' : 'membros'}
                          </span>
                          {f.intencao_congregar && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Quer Congregar
                            </span>
                          )}
                        </div>

                        {f.membros_familia && (
                          <p className="text-xs text-slate-600 mt-1">
                            Integrantes: <strong>{f.membros_familia}</strong>
                          </p>
                        )}
                        {f.origem && (
                          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" /> Origem: {f.origem}
                          </p>
                        )}
                        {f.contato && (
                          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" /> {f.contato}
                          </p>
                        )}
                        {f.observacoes && (
                          <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-xl mt-2 italic">
                            "{f.observacoes}"
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit('familias', f)}
                          className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete('familias', f.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: RESUMO DA RECEPÇÃO (PARA O DIRIGENTE / PASTOR NO ALTAR) */}
        {activeTab === 'resumo' && resumo && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div>
                  <span className="text-[10px] font-black tracking-wider uppercase text-teal-600">Briefing em Tempo Real</span>
                  <h2 className="text-lg font-black text-slate-900">Resumo da Recepção do Culto</h2>
                  <p className="text-xs text-slate-500">Dados consolidados para consulta da liderança durante o culto</p>
                </div>
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Imprimir
                </button>
              </div>

              {/* Indicadores Principais */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-teal-50/70 border border-teal-200/60 p-3.5 rounded-2xl">
                  <span className="text-xs font-bold text-teal-800">Visitantes</span>
                  <p className="text-2xl font-black text-teal-900 mt-0.5">{resumo.totais.visitantes}</p>
                  <span className="text-[11px] text-teal-700 font-medium">
                    {resumo.totais.visitantes_primeira_vez} de 1ª vez
                  </span>
                </div>

                <div className="bg-indigo-50/70 border border-indigo-200/60 p-3.5 rounded-2xl">
                  <span className="text-xs font-bold text-indigo-800">Autoridades</span>
                  <p className="text-2xl font-black text-indigo-900 mt-0.5">{resumo.totais.autoridades}</p>
                  <span className="text-[11px] text-indigo-700 font-medium">Presentes</span>
                </div>

                <div className="bg-purple-50/70 border border-purple-200/60 p-3.5 rounded-2xl">
                  <span className="text-xs font-bold text-purple-800">Famílias</span>
                  <p className="text-2xl font-black text-purple-900 mt-0.5">{resumo.totais.familias}</p>
                  <span className="text-[11px] text-purple-700 font-medium">
                    {resumo.totais.total_pessoas_familias} pessoas total
                  </span>
                </div>

                <div className="bg-emerald-50/70 border border-emerald-200/60 p-3.5 rounded-2xl">
                  <span className="text-xs font-bold text-emerald-800">Orações</span>
                  <p className="text-2xl font-black text-emerald-900 mt-0.5">{resumo.totais.pedidos_oracao + resumo.totais.acoes_de_gracas}</p>
                  <span className="text-[11px] text-emerald-700 font-medium">
                    {resumo.totais.oracoes_publicas} para o púlpito
                  </span>
                </div>
              </div>

              {/* Bloco 1: Autoridades para Menção Pública */}
              <div className="mt-6 pt-6 border-t border-slate-100">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5 mb-3">
                  <Award className="w-4 h-4 text-indigo-600" />
                  Autoridades e Pastores para Menção e Acolhimento
                </h3>
                {resumo.autoridades_mencao.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Nenhuma autoridade registrada neste culto.</p>
                ) : (
                  <div className="space-y-2">
                    {resumo.autoridades_mencao.map(a => (
                      <div key={a.id} className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-black text-indigo-950">{a.nome}</span>
                          <span className="text-xs text-indigo-700 font-bold ml-2">({a.cargo_funcao})</span>
                          {a.instituicao && <span className="text-xs text-slate-500 ml-1">· {a.instituicao}</span>}
                          {a.observacoes && <p className="text-[11px] text-slate-500 italic mt-0.5">Obs: {a.observacoes}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bloco 2: Avisos Oficiais em Ordem */}
              <div className="mt-6 pt-6 border-t border-slate-100">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5 mb-3">
                  <Megaphone className="w-4 h-4 text-amber-600" />
                  Avisos do Culto (Ordem de Leitura)
                </h3>
                {resumo.avisos_ordenados.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Nenhum aviso registrado.</p>
                ) : (
                  <div className="space-y-2">
                    {resumo.avisos_ordenados.map((av, i) => (
                      <div key={av.id} className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 text-xs font-black flex items-center justify-center shrink-0">
                          {av.ordem || i + 1}
                        </span>
                        <div>
                          <strong className="text-xs text-slate-900">{av.titulo}:</strong>
                          <span className="text-xs text-slate-700 ml-1 whitespace-pre-line">{av.conteudo}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bloco 3: Pedidos de Oração Públicos (Para o Momento de Oração da Igreja) */}
              <div className="mt-6 pt-6 border-t border-slate-100">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5 mb-3">
                  <HeartHandshake className="w-4 h-4 text-emerald-600" />
                  Pedidos de Oração e Gratidão para Clamor da Igreja
                </h3>
                {resumo.oracoes_publicas.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Nenhum pedido de oração público registrado.</p>
                ) : (
                  <div className="space-y-2">
                    {resumo.oracoes_publicas.map(o => (
                      <div key={o.id} className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                            o.tipo === 'acao_de_gracas' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {o.tipo === 'acao_de_gracas' ? 'Ação de Graças' : 'Oração'}
                          </span>
                          <strong className="text-xs text-slate-900">{o.nome}</strong>
                          {o.categoria && <span className="text-xs text-slate-500">· {o.categoria}</span>}
                        </div>
                        <p className="text-xs text-slate-700 mt-1">{o.motivo}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bloco 4: Pedidos Reservados (Apenas Pastores) */}
              {resumo.totais.oracoes_privadas > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-100">
                  <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5 mb-3 text-rose-800">
                    <Lock className="w-4 h-4 text-rose-600" />
                    Pedidos de Oração Reservados ({resumo.totais.oracoes_privadas})
                  </h3>
                  <p className="text-xs text-rose-700 mb-2">
                    Estes pedidos foram marcados como confidenciais e NÃO devem ser lidos publicamente no microfone.
                  </p>
                  <div className="space-y-2">
                    {oracoes.filter(o => o.is_privado).map(o => (
                      <div key={o.id} className="p-3 bg-rose-50/50 rounded-xl border border-rose-100">
                        <strong className="text-xs text-slate-900">{o.nome}:</strong>
                        <span className="text-xs text-slate-700 ml-1">{o.motivo}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* MODAL RESPONSIVO DE FORMULÁRIO (ADD / EDIT) */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-teal-700 to-cyan-800 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-teal-200">
                  {editingId ? 'Editar Registro' : 'Novo Registro'}
                </span>
                <h3 className="text-base font-black">
                  {modalSecao === 'visitantes' && 'Visitante do Culto'}
                  {modalSecao === 'autoridades' && 'Autoridade / Pastor Visitante'}
                  {modalSecao === 'oracoes' && 'Pedido de Oração / Gratidão'}
                  {modalSecao === 'avisos' && 'Aviso da Recepção'}
                  {modalSecao === 'familias' && 'Família Recebida'}
                </h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-teal-200 hover:bg-white/10 transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitModal} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
              {/* FORM: VISITANTES */}
              {modalSecao === 'visitantes' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nome Completo *</label>
                    <input
                      type="text"
                      required
                      value={formVisitante.nome}
                      onChange={e => setFormVisitante(prev => ({ ...prev, nome: e.target.value }))}
                      placeholder="Ex: João da Silva"
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Telefone / WhatsApp</label>
                      <input
                        type="tel"
                        value={formVisitante.telefone}
                        onChange={e => setFormVisitante(prev => ({ ...prev, telefone: e.target.value }))}
                        placeholder="(00) 00000-0000"
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Bairro</label>
                      <input
                        type="text"
                        value={formVisitante.bairro}
                        onChange={e => setFormVisitante(prev => ({ ...prev, bairro: e.target.value }))}
                        placeholder="Ex: Centro"
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Cidade</label>
                      <input
                        type="text"
                        value={formVisitante.cidade}
                        onChange={e => setFormVisitante(prev => ({ ...prev, cidade: e.target.value }))}
                        placeholder="Ex: São Paulo"
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Igreja de Origem</label>
                      <input
                        type="text"
                        value={formVisitante.igreja_origem}
                        onChange={e => setFormVisitante(prev => ({ ...prev, igreja_origem: e.target.value }))}
                        placeholder="Ex: Assembleia de Deus"
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={formVisitante.primeira_visita}
                        onChange={e => setFormVisitante(prev => ({ ...prev, primeira_visita: e.target.checked }))}
                        className="w-4 h-4 text-teal-600 rounded"
                      />
                      1ª Vez neste culto
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={formVisitante.is_ministro}
                        onChange={e => setFormVisitante(prev => ({ ...prev, is_ministro: e.target.checked }))}
                        className="w-4 h-4 text-teal-600 rounded"
                      />
                      É Ministro / Oficial
                    </label>
                  </div>

                  {formVisitante.is_ministro && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Cargo Ministerial</label>
                      <select
                        value={formVisitante.cargo_ministerial}
                        onChange={e => setFormVisitante(prev => ({ ...prev, cargo_ministerial: e.target.value }))}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      >
                        <option value="Pastor">Pastor</option>
                        <option value="Evangelista">Evangelista</option>
                        <option value="Presbítero">Presbítero</option>
                        <option value="Diácono">Diácono</option>
                        <option value="Missionário">Missionário</option>
                        <option value="Cooperador">Cooperador</option>
                        <option value="Outro">Outro</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Observações</label>
                    <textarea
                      rows={2}
                      value={formVisitante.observacoes}
                      onChange={e => setFormVisitante(prev => ({ ...prev, observacoes: e.target.value }))}
                      placeholder="Informações adicionais para a recepção..."
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                  </div>
                </>
              )}

              {/* FORM: AUTORIDADES */}
              {modalSecao === 'autoridades' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nome Completo *</label>
                    <input
                      type="text"
                      required
                      value={formAutoridade.nome}
                      onChange={e => setFormAutoridade(prev => ({ ...prev, nome: e.target.value }))}
                      placeholder="Ex: Pr. Carlos Eduardo / Prefeito José"
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Cargo / Função *</label>
                    <input
                      type="text"
                      required
                      value={formAutoridade.cargo_funcao}
                      onChange={e => setFormAutoridade(prev => ({ ...prev, cargo_funcao: e.target.value }))}
                      placeholder="Ex: Pastor Presidente, Prefeito, Vereador, Juiz"
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Igreja / Instituição / Órgão</label>
                    <input
                      type="text"
                      value={formAutoridade.instituicao}
                      onChange={e => setFormAutoridade(prev => ({ ...prev, instituicao: e.target.value }))}
                      placeholder="Ex: Ministério Bethel / Prefeitura Municipal"
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Observações de Protocolo</label>
                    <textarea
                      rows={2}
                      value={formAutoridade.observacoes}
                      onChange={e => setFormAutoridade(prev => ({ ...prev, observacoes: e.target.value }))}
                      placeholder="Ex: Convidado especial, acompanhado da esposa, sentar na tribuna..."
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </>
              )}

              {/* FORM: ORAÇÕES */}
              {modalSecao === 'oracoes' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Tipo de Registro *</label>
                      <select
                        value={formOracao.tipo}
                        onChange={e => setFormOracao(prev => ({ ...prev, tipo: e.target.value as any }))}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      >
                        <option value="pedido">Pedido de Oração</option>
                        <option value="acao_de_gracas">Ação de Graças / Vitória</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Categoria</label>
                      <select
                        value={formOracao.categoria}
                        onChange={e => setFormOracao(prev => ({ ...prev, categoria: e.target.value }))}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      >
                        <option value="Saúde / Enfermidade">Saúde / Enfermidade</option>
                        <option value="Família / Casamento">Família / Casamento</option>
                        <option value="Causas na Justiça">Causas na Justiça</option>
                        <option value="Finanças / Emprego">Finanças / Emprego</option>
                        <option value="Libertação / Espiritual">Libertação / Espiritual</option>
                        <option value="Ação de Graças / Vitória">Ação de Graças / Vitória</option>
                        <option value="Outro">Outro</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nome do Solicitante / Irmão(ã) *</label>
                    <input
                      type="text"
                      required
                      value={formOracao.nome}
                      onChange={e => setFormOracao(prev => ({ ...prev, nome: e.target.value }))}
                      placeholder="Ex: Maria Aparecida"
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Motivo do Pedido / Ação de Graças *</label>
                    <textarea
                      rows={3}
                      required
                      value={formOracao.motivo}
                      onChange={e => setFormOracao(prev => ({ ...prev, motivo: e.target.value }))}
                      placeholder="Descreva o motivo para a oração ou agradecimento..."
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={formOracao.is_privado}
                        onChange={e => setFormOracao(prev => ({ ...prev, is_privado: e.target.checked }))}
                        className="w-4 h-4 text-rose-600 rounded"
                      />
                      <span className="flex items-center gap-1 text-rose-800">
                        <Lock className="w-3.5 h-3.5" /> Pedido Confidencial (Não ler publicamente)
                      </span>
                    </label>
                    <p className="text-[11px] text-slate-500 mt-1 pl-6">
                      Se marcado, este pedido será direcionado exclusivamente para a oração pastoral reservada.
                    </p>
                  </div>
                </>
              )}

              {/* FORM: AVISOS */}
              {modalSecao === 'avisos' && (
                <>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="col-span-3">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Título do Aviso *</label>
                      <input
                        type="text"
                        required
                        value={formAviso.titulo}
                        onChange={e => setFormAviso(prev => ({ ...prev, titulo: e.target.value }))}
                        placeholder="Ex: Reunião de Oração na Terça"
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Ordem</label>
                      <input
                        type="number"
                        min={1}
                        value={formAviso.ordem}
                        onChange={e => setFormAviso(prev => ({ ...prev, ordem: Number(e.target.value) || 1 }))}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Conteúdo do Aviso *</label>
                    <textarea
                      rows={4}
                      required
                      value={formAviso.conteudo}
                      onChange={e => setFormAviso(prev => ({ ...prev, conteudo: e.target.value }))}
                      placeholder="Descreva claramente o aviso a ser lido no microfone..."
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </>
              )}

              {/* FORM: FAMÍLIAS */}
              {modalSecao === 'familias' && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Nome do Responsável *</label>
                      <input
                        type="text"
                        required
                        value={formFamilia.responsavel}
                        onChange={e => setFormFamilia(prev => ({ ...prev, responsavel: e.target.value }))}
                        placeholder="Ex: Família Souza (Marcos Souza)"
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Qtd Pessoas</label>
                      <input
                        type="number"
                        min={1}
                        value={formFamilia.total_membros}
                        onChange={e => setFormFamilia(prev => ({ ...prev, total_membros: Math.max(1, Number(e.target.value) || 1) }))}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Membros da Família</label>
                    <input
                      type="text"
                      value={formFamilia.membros_familia}
                      onChange={e => setFormFamilia(prev => ({ ...prev, membros_familia: e.target.value }))}
                      placeholder="Ex: Esposa Luciana, Filhos Pedro (10) e Lucas (6)"
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Origem / Bairro / Cidade</label>
                      <input
                        type="text"
                        value={formFamilia.origem}
                        onChange={e => setFormFamilia(prev => ({ ...prev, origem: e.target.value }))}
                        placeholder="Ex: Jardim das Flores"
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Contato (Opcional)</label>
                      <input
                        type="tel"
                        value={formFamilia.contato}
                        onChange={e => setFormFamilia(prev => ({ ...prev, contato: e.target.value }))}
                        placeholder="(00) 00000-0000"
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-purple-50/70 rounded-xl border border-purple-200">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-purple-900">
                      <input
                        type="checkbox"
                        checked={formFamilia.intencao_congregar}
                        onChange={e => setFormFamilia(prev => ({ ...prev, intencao_congregar: e.target.checked }))}
                        className="w-4 h-4 text-purple-600 rounded"
                      />
                      Esta família manifestou intenção de congregar na igreja
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Observações</label>
                    <textarea
                      rows={2}
                      value={formFamilia.observacoes}
                      onChange={e => setFormFamilia(prev => ({ ...prev, observacoes: e.target.value }))}
                      placeholder="Informações adicionais sobre o atendimento..."
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                </>
              )}

              {/* Botoes de Ação */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingId ? 'Salvar Alterações' : 'Cadastrar Registro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
