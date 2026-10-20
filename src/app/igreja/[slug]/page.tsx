'use client';

/**
 * /igreja/[slug] — Página Inicial Pública do Aplicativo do Membro por Tenant
 *
 * Objetivo:
 * - Acesso imediato sem login, sem CPF, sem senha.
 * - Carrega identidade visual (nome, logotipo, cores) do ministério.
 * - Disponibiliza cultos, eventos abertos, notícias/comunicados, pedido de oração,
 *   contato e localização da igreja.
 * - Memoriza o tenant no dispositivo (localStorage) e oferece 'Trocar de Igreja'.
 * - Protege áreas privadas (Minha Credencial, Meus Dados, Histórico) através do AuthGateModal.
 */

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  Church,
  Calendar,
  Sparkles,
  Megaphone,
  HeartHandshake,
  CreditCard,
  User,
  MapPin,
  Phone,
  Mail,
  Globe,
  Share2,
  ExternalLink,
  ChevronRight,
  Clock,
  AlertCircle,
  Loader2,
  RefreshCw,
  Check,
} from 'lucide-react';
import MobilePublicBottomNav from '@/components/mobile/MobilePublicBottomNav';
import AuthGateModal from '@/components/mobile/AuthGateModal';
import ModalPedidoOracaoPublico from '@/components/mobile/ModalPedidoOracaoPublico';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

interface IgrejaInfo {
  id: string;
  slug: string;
  nome: string;
  descricao?: string;
  logo?: string | null;
  telefone?: string;
  email?: string;
  website?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  responsavel?: string;
}

interface CultoItem {
  id: string;
  titulo: string;
  descricao?: string | null;
  data_inicio: string;
  data_fim?: string | null;
  local?: string | null;
  agenda_tipos?: { nome: string; cor: string } | null;
  congregacoes?: { nome: string } | null;
}

interface EventoItem {
  id: string;
  titulo: string;
  descricao?: string | null;
  data_inicio: string;
  data_fim?: string | null;
  local_nome?: string | null;
  capacidade?: number | null;
  valor_inscricao?: number | null;
  aceita_inscricao?: boolean;
  slug: string;
}

interface ComunicadoItem {
  id: string;
  titulo: string;
  conteudo: string;
  categoria?: string;
  imagem_url?: string | null;
  fixado?: boolean;
  publicado_em: string;
  departamentos?: { nome: string; sigla: string } | null;
}

function formatHoraData(dateStr: string) {
  try {
    const d = new Date(dateStr);
    const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const diaSem = dias[d.getDay()];
    const dia = d.getDate();
    const mes = meses[d.getMonth()];
    const hora = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${diaSem}, ${dia} de ${mes} às ${hora}:${min}`;
  } catch {
    return dateStr;
  }
}

export default function IgrejaPublicaPage({ params }: PageProps) {
  const { slug } = use(params);
  const router = useRouter();

  // Estados principais da página
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [igreja, setIgreja] = useState<IgrejaInfo | null>(null);
  const [congregacoes, setCongregacoes] = useState<Array<{ id: string; nome: string }>>([]);
  const [cultos, setCultos] = useState<CultoItem[]>([]);
  const [eventos, setEventos] = useState<EventoItem[]>([]);
  const [comunicados, setComunicados] = useState<ComunicadoItem[]>([]);
  const [midia, setMidia] = useState<any | null>(null);

  // Navegação e Modais
  const [activeTab, setActiveTab] = useState<'inicio' | 'agenda' | 'oracao'>('inicio');
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [authFeatureName, setAuthFeatureName] = useState('Minha Credencial');
  const [oracaoModalOpen, setOracaoModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // 1. Carregar dados públicos da igreja pelo slug
  useEffect(() => {
    let isMounted = true;
    async function carregarIgreja() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/v1/public/igreja/${encodeURIComponent(slug)}`, {
          cache: 'no-store',
        });

        const data = await res.json();

        if (!isMounted) return;

        if (!res.ok) {
          setError(data.error || 'Igreja não encontrada ou link inativo.');
          return;
        }

        setIgreja(data.igreja);
        setCongregacoes(data.congregacoes || []);
        setCultos(data.cultos || []);
        setEventos(data.eventos || []);
        setComunicados(data.comunicados || []);
        setMidia(data.midia || null);

        // Memorizar no dispositivo a igreja selecionada
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(
              'eklesia_last_selected_church',
              JSON.stringify({
                slug: data.igreja.slug,
                nome: data.igreja.nome,
                logo: data.igreja.logo,
                updatedAt: new Date().toISOString(),
              })
            );
          } catch {}
        }
      } catch (err: any) {
        if (isMounted) setError('Erro ao conectar com a igreja. Verifique sua conexão.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (slug) {
      carregarIgreja();
    }
    return () => {
      isMounted = false;
    };
  }, [slug]);

  const handleOpenAuthGate = (feature: string) => {
    setAuthFeatureName(feature);
    setAuthGateOpen(true);
  };

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.share) {
      try {
        await navigator.share({
          title: igreja?.nome || 'Aplicativo da Igreja',
          text: `Acesse o aplicativo oficial da ${igreja?.nome || 'nossa igreja'}:`,
          url,
        });
        return;
      } catch {}
    }

    // Fallback: Copiar para área de transferência
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {}
  };

  const handleTrocarIgreja = () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('eklesia_last_selected_church');
      } catch {}
    }
    router.push('/app/login');
  };

  // Estado: Carregando
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0f172a] text-slate-100">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4 animate-pulse">
          <Church size={32} />
        </div>
        <Loader2 size={30} className="text-blue-500 animate-spin mb-3" />
        <p className="text-sm font-semibold text-slate-300">Carregando a sua igreja...</p>
        <span className="text-xs text-slate-500 mt-1">Conectando ao Eklésia</span>
      </div>
    );
  }

  // Estado: Erro / Igreja Não Encontrada
  if (error || !igreja) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0f172a] text-slate-100 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Igreja Não Encontrada</h2>
        <p className="text-xs text-slate-400 max-w-xs mb-6 leading-relaxed">
          {error || 'O link informado pode ter sido alterado ou estar temporariamente indisponível.'}
        </p>
        <div className="space-y-2 w-full max-w-xs">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition"
          >
            <RefreshCw size={14} />
            <span>Tentar Novamente</span>
          </button>
          <button
            type="button"
            onClick={handleTrocarIgreja}
            className="w-full py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-medium text-xs transition"
          >
            Buscar Outra Igreja
          </button>
        </div>
      </div>
    );
  }

  const proximoCulto = cultos[0] || null;

  return (
    <div className="pb-24 pt-4 px-4 text-slate-100 selection:bg-blue-600 selection:text-white">
      {/* ── Top Bar Institucional & Ações ─────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
            Portal Oficial
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleShare}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer relative"
            title="Compartilhar link da igreja"
          >
            {copiedLink ? <Check size={16} className="text-emerald-400" /> : <Share2 size={16} />}
          </button>
          <button
            type="button"
            onClick={handleTrocarIgreja}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition cursor-pointer"
            title="Trocar de Igreja"
          >
            Trocar
          </button>
        </div>
      </div>

      {/* ── Banner / Card Principal da Igreja ─────────────────────────────────── */}
      <div className="bg-gradient-to-b from-slate-800/90 to-slate-900/90 border border-slate-700/60 rounded-3xl p-5 mb-5 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-36 h-36 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center gap-4 relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-white p-2 shrink-0 shadow-md flex items-center justify-center overflow-hidden border border-slate-200/20">
            {igreja.logo ? (
              <img
                src={igreja.logo}
                alt={igreja.nome}
                className="w-full h-full object-contain"
              />
            ) : (
              <Church size={32} className="text-slate-800" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-black text-white tracking-tight truncate leading-tight">
              {igreja.nome}
            </h1>
            {igreja.cidade && (
              <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                <MapPin size={12} className="shrink-0 text-blue-400" />
                <span className="truncate">
                  {igreja.cidade}
                  {igreja.estado ? ` - ${igreja.estado}` : ''}
                </span>
              </div>
            )}
            <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
              Acesso livre e gratuito a todos os membros e visitantes
            </p>
          </div>
        </div>
      </div>

      {/* ── Atalhos de Ação Rápida ────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        <button
          type="button"
          onClick={() => setOracaoModalOpen(true)}
          className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-pink-500/40 hover:bg-slate-800/60 transition group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-pink-500/15 border border-pink-500/25 flex items-center justify-center text-pink-400 mb-1.5 group-hover:scale-105 transition">
            <HeartHandshake size={20} />
          </div>
          <span className="text-[11px] font-bold text-slate-200">Pedir Oração</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('agenda')}
          className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-violet-500/40 hover:bg-slate-800/60 transition group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center text-violet-400 mb-1.5 group-hover:scale-105 transition">
            <Calendar size={20} />
          </div>
          <span className="text-[11px] font-bold text-slate-200">Cultos</span>
        </button>

        <button
          type="button"
          onClick={() => handleOpenAuthGate('Minha Credencial Digital')}
          className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/40 hover:bg-slate-800/60 transition group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-400 mb-1.5 group-hover:scale-105 transition">
            <CreditCard size={20} />
          </div>
          <span className="text-[11px] font-bold text-slate-200">Credencial</span>
        </button>

        <button
          type="button"
          onClick={() => handleOpenAuthGate('Área Pessoal do Membro')}
          className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-blue-500/40 hover:bg-slate-800/60 transition group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-400 mb-1.5 group-hover:scale-105 transition">
            <User size={20} />
          </div>
          <span className="text-[11px] font-bold text-slate-200">Entrar</span>
        </button>
      </div>

      {/* ── Próximo Culto em Destaque ─────────────────────────────────────────── */}
      {proximoCulto && (
        <div className="bg-gradient-to-r from-blue-950/60 to-indigo-950/60 border border-blue-500/30 rounded-2xl p-4 mb-6 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
              <Clock size={12} />
              Próximo Culto
            </span>
            {proximoCulto.congregacoes?.nome && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-200 font-semibold border border-blue-700/50">
                {proximoCulto.congregacoes.nome}
              </span>
            )}
          </div>

          <h3 className="text-base font-bold text-white mb-1.5">{proximoCulto.titulo}</h3>

          <p className="text-xs font-semibold text-blue-200 mb-1">
            {formatHoraData(proximoCulto.data_inicio)}
          </p>

          {proximoCulto.local && (
            <div className="flex items-center gap-1 text-[11px] text-slate-300">
              <MapPin size={11} className="text-blue-400 shrink-0" />
              <span className="truncate">{proximoCulto.local}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Transmissão Ao Vivo / Rádio Gospel (se habilitado) ────────────────── */}
      {midia?.aovivo_habilitado && midia?.aovivo_url && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                Culto Ao Vivo
              </span>
            </div>
            <a
              href={midia.aovivo_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              Assistir
              <ExternalLink size={12} />
            </a>
          </div>
          <p className="text-xs text-slate-200 font-medium">
            {midia.aovivo_titulo || 'Acompanhe a transmissão oficial dos cultos ao vivo.'}
          </p>
        </div>
      )}

      {/* ── Eventos e Inscrições Abertas ──────────────────────────────────────── */}
      {eventos.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Sparkles size={16} className="text-emerald-400" />
              Eventos & Inscrições
            </h2>
            <span className="text-[11px] text-slate-500 font-semibold">
              {eventos.length} evento{eventos.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="space-y-3">
            {eventos.map((ev) => (
              <div
                key={ev.id}
                className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 hover:border-slate-700 transition"
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <h4 className="text-sm font-bold text-white leading-snug">{ev.titulo}</h4>
                  {ev.valor_inscricao && ev.valor_inscricao > 0 ? (
                    <span className="text-[11px] font-black text-emerald-400 px-2 py-0.5 rounded-md bg-emerald-950/50 border border-emerald-500/30 shrink-0">
                      R$ {ev.valor_inscricao.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-blue-400 px-2 py-0.5 rounded-md bg-blue-950/50 border border-blue-500/30 shrink-0">
                      Gratuito
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-300 mb-2 flex items-center gap-2">
                  <span className="font-medium text-slate-400">
                    {formatHoraData(ev.data_inicio)}
                  </span>
                </div>

                {ev.local_nome && (
                  <p className="text-[11px] text-slate-400 mb-3 flex items-center gap-1">
                    <MapPin size={11} className="text-slate-500 shrink-0" />
                    <span className="truncate">{ev.local_nome}</span>
                  </p>
                )}

                {ev.aceita_inscricao && (
                  <a
                    href={`/eventos/e/${ev.slug}`}
                    className="w-full py-2.5 rounded-xl bg-blue-600/90 hover:bg-blue-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <span>Inscrever-se no Evento</span>
                    <ChevronRight size={14} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Notícias e Comunicados Públicos ───────────────────────────────────── */}
      {comunicados.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Megaphone size={16} className="text-sky-400" />
              Avisos da Igreja
            </h2>
          </div>

          <div className="space-y-3">
            {comunicados.map((com) => (
              <div
                key={com.id}
                className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  {com.fixado && (
                    <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      Destaque
                    </span>
                  )}
                  {com.departamentos?.sigla && (
                    <span className="text-[10px] font-bold text-slate-400">
                      {com.departamentos.sigla}
                    </span>
                  )}
                </div>

                <h4 className="text-sm font-bold text-white mb-1.5">{com.titulo}</h4>

                <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                  {com.conteudo}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Contatos & Localização da Igreja ──────────────────────────────────── */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 mb-6">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
          <MapPin size={14} className="text-blue-400" />
          Localização e Atendimento
        </h3>

        <div className="space-y-2 text-xs text-slate-300">
          {igreja.endereco && (
            <div className="flex items-start gap-2">
              <MapPin size={14} className="text-slate-500 shrink-0 mt-0.5" />
              <span>{igreja.endereco}</span>
            </div>
          )}

          {igreja.telefone && (
            <div className="flex items-center gap-2">
              <Phone size={14} className="text-slate-500 shrink-0" />
              <a href={`tel:${igreja.telefone}`} className="hover:underline text-blue-400">
                {igreja.telefone}
              </a>
            </div>
          )}

          {igreja.email && (
            <div className="flex items-center gap-2">
              <Mail size={14} className="text-slate-500 shrink-0" />
              <a href={`mailto:${igreja.email}`} className="hover:underline text-blue-400">
                {igreja.email}
              </a>
            </div>
          )}

          {igreja.website && (
            <div className="flex items-center gap-2">
              <Globe size={14} className="text-slate-500 shrink-0" />
              <a
                href={igreja.website}
                target="_blank"
                rel="noreferrer"
                className="hover:underline text-blue-400 flex items-center gap-1"
              >
                <span>Site Oficial</span>
                <ExternalLink size={10} />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* ── Rodapé Minimalista ────────────────────────────────────────────────── */}
      <div className="text-center py-4 text-[11px] text-slate-500 border-t border-slate-800/60">
        <p className="font-semibold text-slate-400">{igreja.nome}</p>
        <p className="mt-0.5">Plataforma Oficial do Membro · Gestão Eklésia</p>
      </div>

      {/* ── Barra de Navegação Inferior Pública ──────────────────────────────── */}
      <MobilePublicBottomNav
        slug={slug}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          if (tab === 'oracao') {
            setOracaoModalOpen(true);
          } else {
            setActiveTab(tab as any);
          }
        }}
        onRequestAuth={handleOpenAuthGate}
      />

      {/* ── Modal de Proteção da Área Pessoal ───────────────────────────────── */}
      <AuthGateModal
        isOpen={authGateOpen}
        onClose={() => setAuthGateOpen(false)}
        featureName={authFeatureName}
        slug={slug}
        igrejaNome={igreja.nome}
      />

      {/* ── Modal de Pedido de Oração Público ────────────────────────────────── */}
      <ModalPedidoOracaoPublico
        isOpen={oracaoModalOpen}
        onClose={() => setOracaoModalOpen(false)}
        slug={slug}
        igrejaNome={igreja.nome}
        congregacoes={congregacoes}
      />
    </div>
  );
}
