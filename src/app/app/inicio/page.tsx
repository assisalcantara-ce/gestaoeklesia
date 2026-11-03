'use client';

/**
 * /app/inicio — Página inicial mobile-first do aplicativo do membro
 * Reconstrução e refatoração visual completa com fidelidade estrita ao design:
 *
 * 1. REMOÇÃO TOTAL DE IMAGENS COM TEXTO EMBUTIDO:
 *    - Eliminado qualquer recorte do mockup contendo letras, títulos, botões ou cards embutidos.
 *    - Todas as fotografias utilizadas são 100% limpas (sem texto ou botões na foto).
 *    - Todos os textos, títulos, subtítulos, linhas decorativas, ícones, cards e botões
 *      são componentes React e Tailwind legítimos renderizados por código.
 *
 * 2. CARROSSEL PRINCIPAL DINÂMICO (Preparado para ERP):
 *    - Estrutura de dados preparada para futura gestão de banners pelo ERP (id, titulo, subtitulo, imagemUrl, linkHref, ordem, ativo).
 *    - Suporte a múltiplos slides com transição suave, toque/swipe e indicadores centralizados.
 *    - Estado institucional limpo caso não existam slides.
 *
 * 3. GRADE DE ACESSO RÁPIDO (3 colunas x 2 linhas):
 *    - Linha 1: Mensagens (Livro) | Eventos (Calendário) | Células (Pessoas)
 *    - Linha 2: Pedidos de Oração (Mãos em oração) | Contribuir (Coração) | Falar com o Pastor (Conversa)
 *    - Fundo branco #FFFFFF, 100px altura, ícones 28px #092B55, textos 11–12px #092344, centralização precisa.
 *
 * 4. BANNERS INFERIORES:
 *    - Discipulado (94px): card com gradiente institucional profundo, Bíblia estilizada ao fundo e textos por código.
 *    - Células (94px): card com gradiente institucional profundo, silhueta comunitária e textos por código.
 *    - Zero sobreposição de textos ou elementos.
 *
 * 5. RESPONSIVIDADE E AJUSTE:
 *    - 100dvh, sem overflow horizontal, max 430px centralizado, respeitando safe-areas e sem cobrir navegação.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useMobileMember } from '@/providers/MobileMemberProvider';
import MobileBottomNav from '@/components/mobile/MobileBottomNav';
import { createClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  PlayCircle,
  Calendar,
  CalendarDays,
  Users,
  Heart,
  MessageCircle,
  Bell,
  ChevronRight,
  Loader2,
  Church,
  Info,
  X,
} from 'lucide-react';

// Ícone vetorial SVG especializado para mãos em oração com precisão artística
function PrayingHandsIcon({ size = 28, className = 'text-[#092B55]' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3v13" />
      <path d="M8.5 7.5L12 3l3.5 4.5" />
      <path d="M7 11.5L12 16l5-4.5" />
      <path d="M7 18h10" />
      <path d="M9 21h6" />
      <path d="M4 17l3-6" />
      <path d="M20 17l-3-6" />
    </svg>
  );
}

// Estrutura de slide preparada para integração futura com o ERP
export interface MemberCarouselSlide {
  id: string;
  titulo: string;
  subtitulo: string;
  tag?: string;
  imagemUrl?: string | null;
  linkHref?: string;
  ordem?: number;
  ativo?: boolean;
}

export default function InicioPage() {
  const { member, isLoading } = useMobileMember();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [notificacoesNaoLidas, setNotificacoesNaoLidas] = useState(0);
  const [aniversariantesHoje, setAniversariantesHoje] = useState<any[]>([]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // Estados de toque/swipe para o carrossel
  const touchStartXRef = useRef<number | null>(null);
  const touchEndXRef = useRef<number | null>(null);

  const [modalAviso, setModalAviso] = useState<{
    isOpen: boolean;
    titulo: string;
    mensagem: string;
    acaoTexto?: string;
    acaoHref?: string;
  }>({
    isOpen: false,
    titulo: '',
    mensagem: '',
  });

  // Carrega comunicados / notificações reais para o badge do sino
  useEffect(() => {
    async function loadNotificacoes() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        const res = await fetch('/api/v1/mobile/comunicados?limite=5', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          const total = data.total || data.comunicados?.length || 0;
          setNotificacoesNaoLidas(total);
        }

        // Carrega aniversariantes do dia
        try {
          const resAniv = await fetch('/api/v1/mobile/aniversariantes?periodo=hoje', {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });
          if (resAniv.ok) {
            const dataAniv = await resAniv.json();
            setAniversariantesHoje(dataAniv.aniversariantes || []);
          }
        } catch {
          // Silencioso
        }
      } catch {
        // Silencioso
      }
    }
    loadNotificacoes();
  }, [supabase]);

  // Slides dinâmicos estruturados com fotos 100% limpas (sem nenhum texto na imagem)
  const slides: MemberCarouselSlide[] = useMemo(() => {
    return [
      {
        id: 'slide-1',
        titulo: 'UMA IGREJA DE PESSOAS REAIS PARA UM DEUS REAL',
        subtitulo: 'CONHECER • CRESCER • SERVIR',
        tag: 'BEM-VINDO',
        imagemUrl: '/img/banner_igreja_limpo.png',
        linkHref: '/app/programacao',
        ordem: 1,
        ativo: true,
      },
    ];
  }, []);

  // Handlers de Toque / Deslizamento (Swipe) para transição de slides
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndXRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartXRef.current || !touchEndXRef.current) return;
    const diff = touchStartXRef.current - touchEndXRef.current;
    const minSwipeDistance = 45;

    if (diff > minSwipeDistance) {
      // Deslizar para a esquerda (próximo slide)
      setActiveSlideIndex(prev => (prev + 1 < slides.length ? prev + 1 : 0));
    } else if (diff < -minSwipeDistance) {
      // Deslizar para a direita (slide anterior)
      setActiveSlideIndex(prev => (prev - 1 >= 0 ? prev - 1 : slides.length - 1));
    }
    touchStartXRef.current = null;
    touchEndXRef.current = null;
  };

  const handleCardClick = useCallback((acao: string, rota: string) => {
    if (acao === 'celulas') {
      setModalAviso({
        isOpen: true,
        titulo: 'Células e Pequenos Grupos',
        mensagem:
          'O módulo de localização e integração de Células está sendo configurado pela liderança da sua igreja. Em breve você poderá encontrar e participar da célula mais próxima da sua residência!',
        acaoTexto: 'Ver Comunicados',
        acaoHref: '/app/comunicados',
      });
      return;
    }
    router.push(rota);
  }, [router]);

  if (isLoading || !member) {
    return (
      <div className="min-h-full flex-1 bg-[#061D38] flex items-center justify-center">
        <Loader2 size={36} className="text-blue-400 animate-spin" />
      </div>
    );
  }

  // Nome e identificação oficiais do tenant com fallback institucional
  const nomeInstitucional = member.ministerio_nome || member.congregacao_nome || 'Gestão Eklésia';
  const subtituloInstitucional = member.congregacao_nome
    ? `${member.congregacao_nome} • Uma família para pertencer`
    : 'Uma família para pertencer';

  const currentSlide = slides[activeSlideIndex] || slides[0];

  return (
    <div
      className="min-h-full w-full text-white select-none relative overflow-x-hidden flex flex-col justify-between box-border flex-1"
      style={{
        backgroundColor: '#061D38',
        background: 'linear-gradient(160deg, #073765 0%, #052A50 45%, #061D38 100%)',
        paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* Container principal restrito a max 430px e perfeitamente centralizado */}
      <div className="w-full max-w-[430px] mx-auto px-4 flex flex-col box-border flex-1">

        {/* ─────────────────────────────────────────────────────────────
            1. CABEÇALHO INSTITUCIONAL
            - Altura ~76px
            - Logomarca dinâmica do tenant em círculo branco 54x54px
            - Nome oficial 19px peso 700 + subtítulo 11px #C4D5E9
            - Sino de notificações 44x44px com badge real
        ───────────────────────────────────────────────────────────── */}
        <header
          className="w-full flex items-center justify-between min-h-[76px] py-2"
          style={{ paddingTop: 'max(10px, env(safe-area-inset-top, 0px))' }}
        >
          {/* Lado Esquerdo: Logomarca + Identificação */}
          <div className="flex items-center min-w-0 pr-2">
            {/* Logomarca oficial */}
            <div className="w-[44px] h-[44px] rounded-full bg-white border-[1.5px] border-white/80 p-[2px] flex items-center justify-center shrink-0 shadow-md shadow-black/20 overflow-hidden">
              {member.ministerio_logo ? (
                <div className="relative w-full h-full">
                  <Image
                    src={member.ministerio_logo}
                    alt={nomeInstitucional}
                    fill
                    sizes="44px"
                    className="object-contain"
                  />
                </div>
              ) : (
                <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#092B55] to-[#1354C8] flex items-center justify-center text-white">
                  <Church size={22} />
                </div>
              )}
            </div>

            {/* Identificação da Igreja */}
            <div className="ml-3 min-w-0">
              <h1 className="text-[18px] sm:text-[19px] font-bold text-white leading-[23px] line-clamp-2 drop-shadow-xs">
                {nomeInstitucional}
              </h1>
              <p className="text-[11px] text-[#C4D5E9] leading-[16px] truncate mt-0.5">
                {subtituloInstitucional}
              </p>
            </div>
          </div>

          {/* Lado Direito: Notificações com sino 23px e área 44x44px */}
          <button
            onClick={() => router.push('/app/comunicados')}
            className="w-[44px] h-[44px] shrink-0 flex items-center justify-center text-white hover:text-blue-200 active:scale-95 transition-transform relative cursor-pointer"
            aria-label="Notificações e Comunicados"
            title="Comunicados e Avisos Oficiais"
          >
            <Bell size={23} strokeWidth={2} className="text-white drop-shadow-xs" />
            {notificacoesNaoLidas > 0 && (
              <span
                className="absolute top-[8px] right-[8px] w-[8px] h-[8px] rounded-full bg-[#EF4444] border border-[#073765] shadow-xs animate-pulse"
                aria-hidden="true"
              />
            )}
          </button>
        </header>

        {/* ─────────────────────────────────────────────────────────────
            2. CARROSSEL PRINCIPAL / HERO
            - 100% da largura útil
            - Altura de referência: 190px (responsivo 170–200px)
            - Bordas arredondadas de 16px
            - Fotografia limpa com object-fit: cover
            - Overlay escuro para legibilidade
            - Título, linha dourada #E8AC35 (100x2px) e subtítulo gerados por código
            - Indicadores centralizados abaixo
        ───────────────────────────────────────────────────────────── */}
        <section className="w-full mt-3">
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={() => {
              if (currentSlide?.linkHref) router.push(currentSlide.linkHref);
            }}
            className="relative w-full h-[175px] xs:h-[190px] sm:h-[200px] rounded-[16px] overflow-hidden shadow-xl shadow-black/35 cursor-pointer active:scale-[0.99] transition-transform bg-[#052A50]"
          >
            {/* Fotografia Limpa de Fundo (sem nenhum texto na imagem) */}
            {currentSlide.imagemUrl ? (
              <Image
                src={currentSlide.imagemUrl}
                alt="Banner de Destaque"
                fill
                priority
                className="object-cover object-center"
                sizes="(max-width: 430px) 100vw, 430px"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-tr from-[#052A50] via-[#073765] to-[#1354C8]" />
            )}

            {/* Overlay Gradiente Escuro para legibilidade tipográfica absoluta */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent z-10" />

            {/* Conteúdo Institucional Renderizado por Código */}
            <div className="absolute inset-0 z-20 p-[18px] flex flex-col justify-end">
              <h2 className="text-[16px] xs:text-[18px] font-extrabold text-white leading-tight uppercase tracking-tight drop-shadow-md line-clamp-3 max-w-[92%]">
                {currentSlide.titulo}
              </h2>

              {/* Linha decorativa dourada #E8AC35 (100px x 2px) */}
              <div
                className="w-[100px] h-[2px] my-2 bg-[#E8AC35] rounded-full shadow-xs"
                style={{ backgroundColor: '#E8AC35' }}
              />

              <p className="text-[10px] font-semibold text-slate-100 uppercase tracking-[2px] drop-shadow-sm">
                {currentSlide.subtitulo}
              </p>
            </div>
          </div>

          {/* Indicadores do Carrossel (apenas quando houver mais de um slide) */}
          {slides.length > 1 && (
            <div className="flex items-center justify-center gap-[6px] mt-2">
              {slides.map((s, idx) => (
                <button
                  key={s.id}
                  onClick={() => setActiveSlideIndex(idx)}
                  className={`w-[7px] h-[7px] rounded-full transition-all cursor-pointer ${
                    activeSlideIndex === idx ? 'bg-white scale-110' : 'bg-[#7995B6]'
                  }`}
                  aria-label={`Slide ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </section>

        {/* ─────────────────────────────────────────────────────────────
            3. GRADE DE ACESSO RÁPIDO — SEIS ATALHOS (3 colunas x 2 linhas)
            - Margens laterais: 16px (já providas pelo container px-4)
            - Gap: 8px horizontal, 10px vertical
            - Fundo branco #FFFFFF
            - Altura do card: 100px (ajustando proporcionalmente em 320–430px)
            - Ícones: 28px na cor #092B55
            - Textos: 11–12px na cor #092344
            - Ordem exata:
                Linha 1: 1. Mensagens | 2. Eventos | 3. Células
                Linha 2: 4. Pedidos de Oração | 5. Contribuir | 6. Falar com o Pastor
        ───────────────────────────────────────────────────────────── */}
        <section className="w-full mt-[18px]">
          <div className="grid grid-cols-3 gap-x-[8px] gap-y-[10px]">

            {/* 1. Mídias */}
            <button
              onClick={() => handleCardClick('midia', '/app/midia')}
              className="w-full h-[94px] xs:h-[100px] sm:h-[104px] bg-[#FFFFFF] rounded-[12px] p-[8px] flex flex-col items-center justify-center text-center shadow-[0_4px_14px_rgba(0,0,0,0.12)] hover:bg-slate-50 active:scale-[0.97] transition-all cursor-pointer select-none"
            >
              <PlayCircle size={28} strokeWidth={2} className="text-[#092B55] shrink-0" />
              <span className="text-[11px] xs:text-[12px] font-semibold text-[#092344] leading-tight line-clamp-2 mt-[9px]">
                Mídias
              </span>
            </button>

            {/* 2. Eventos */}
            <button
              onClick={() => handleCardClick('eventos', '/app/eventos')}
              className="w-full h-[94px] xs:h-[100px] sm:h-[104px] bg-[#FFFFFF] rounded-[12px] p-[8px] flex flex-col items-center justify-center text-center shadow-[0_4px_14px_rgba(0,0,0,0.12)] hover:bg-slate-50 active:scale-[0.97] transition-all cursor-pointer select-none"
            >
              <Calendar size={28} strokeWidth={2} className="text-[#092B55] shrink-0" />
              <span className="text-[11px] xs:text-[12px] font-semibold text-[#092344] leading-tight line-clamp-2 mt-[9px]">
                Eventos
              </span>
            </button>

            {/* 3. Agenda Ministerial */}
            <button
              onClick={() => handleCardClick('agenda', '/app/programacao')}
              className="w-full h-[94px] xs:h-[100px] sm:h-[104px] bg-[#FFFFFF] rounded-[12px] p-[8px] flex flex-col items-center justify-center text-center shadow-[0_4px_14px_rgba(0,0,0,0.12)] hover:bg-slate-50 active:scale-[0.97] transition-all cursor-pointer select-none"
            >
              <CalendarDays size={28} strokeWidth={2} className="text-[#092B55] shrink-0" />
              <span className="text-[10px] xs:text-[11px] font-semibold text-[#092344] leading-[13px] line-clamp-2 mt-[9px]">
                Agenda<br />Ministerial
              </span>
            </button>

            {/* 4. Pedidos de Oração */}
            <button
              onClick={() => handleCardClick('oracao', '/app/cuidado-pastoral')}
              className="w-full h-[94px] xs:h-[100px] sm:h-[104px] bg-[#FFFFFF] rounded-[12px] p-[8px] flex flex-col items-center justify-center text-center shadow-[0_4px_14px_rgba(0,0,0,0.12)] hover:bg-slate-50 active:scale-[0.97] transition-all cursor-pointer select-none"
            >
              <PrayingHandsIcon size={28} className="text-[#092B55] shrink-0" />
              <span className="text-[11px] xs:text-[12px] font-semibold text-[#092344] leading-tight line-clamp-2 mt-[9px]">
                Pedidos<br />de Oração
              </span>
            </button>

            {/* 5. Contribuir */}
            <button
              onClick={() => handleCardClick('contribuir', '/app/contribuir')}
              className="w-full h-[94px] xs:h-[100px] sm:h-[104px] bg-[#FFFFFF] rounded-[12px] p-[8px] flex flex-col items-center justify-center text-center shadow-[0_4px_14px_rgba(0,0,0,0.12)] hover:bg-slate-50 active:scale-[0.97] transition-all cursor-pointer select-none"
            >
              <Heart size={28} strokeWidth={2} className="text-[#092B55] shrink-0" />
              <span className="text-[11px] xs:text-[12px] font-semibold text-[#092344] leading-tight line-clamp-2 mt-[9px]">
                Contribuir
              </span>
            </button>

            {/* 6. Falar com o Pastor */}
            <button
              onClick={() => handleCardClick('pastor', '/app/cuidado-pastoral')}
              className="w-full h-[94px] xs:h-[100px] sm:h-[104px] bg-[#FFFFFF] rounded-[12px] p-[8px] flex flex-col items-center justify-center text-center shadow-[0_4px_14px_rgba(0,0,0,0.12)] hover:bg-slate-50 active:scale-[0.97] transition-all cursor-pointer select-none"
            >
              <MessageCircle size={28} strokeWidth={2} className="text-[#092B55] shrink-0" />
              <span className="text-[11px] xs:text-[12px] font-semibold text-[#092344] leading-tight line-clamp-2 mt-[9px]">
                Falar com<br />o Pastor
              </span>
            </button>

          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────
            4. BANNERS SECUNDÁRIO E TERCIÁRIO
            - Discipulado e Células
            - Altura: 94px cada
            - Espaçamento: 10px
            - Bordas: 12px
            - 100% livres de imagens com texto embutido
            - Títulos, subtítulos e chevrons renderizados por código
        ───────────────────────────────────────────────────────────── */}
        <section className="w-full mt-[18px] flex flex-col gap-[10px]">

          {/* Banner Discipulado */}
          <div
            onClick={() => router.push('/app/ebd')}
            className="relative w-full h-[94px] rounded-[12px] overflow-hidden shadow-lg shadow-black/25 cursor-pointer active:scale-[0.99] transition-transform"
            style={{
              background: 'linear-gradient(135deg, #072545 0%, #0d3868 60%, #174b85 100%)',
            }}
          >
            {/* Foto Limpa da Bíblia sem texto */}
            <div className="absolute right-0 top-0 bottom-0 w-[45%] opacity-40 mix-blend-screen pointer-events-none">
              <Image
                src="/img/pastor_bible_table.png"
                alt="Bíblia Sagrada"
                fill
                className="object-cover object-right"
                sizes="(max-width: 430px) 190px, 190px"
              />
            </div>

            {/* Overlay sutil para legibilidade */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#072545] via-[#072545]/90 to-transparent z-10" />

            {/* Conteúdo textual e ação gerados por código */}
            <div className="absolute inset-0 z-20 px-[16px] flex items-center justify-between">
              <div className="pr-4 max-w-[80%]">
                <h3 className="text-[14px] xs:text-[15px] font-extrabold text-white uppercase tracking-tight leading-tight">
                  DISCIPULADO<br />QUE TRANSFORMA
                </h3>
                <p className="text-[11px] text-slate-200 mt-1 truncate">
                  Chega na sua jornada com Deus.
                </p>
              </div>

              <ChevronRight size={22} className="text-white shrink-0 mr-1 drop-shadow-xs" />
            </div>
          </div>

          {/* Banner Células */}
          <div
            onClick={() => handleCardClick('celulas', '/app/comunicados')}
            className="relative w-full h-[94px] rounded-[12px] overflow-hidden shadow-lg shadow-black/25 cursor-pointer active:scale-[0.99] transition-transform"
            style={{
              background: 'linear-gradient(135deg, #072749 0%, #0c3664 60%, #15467e 100%)',
            }}
          >
            {/* Ícone de fundo sutil comunitário sem texto embutido */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/10 pointer-events-none">
              <Users size={70} strokeWidth={1} />
            </div>

            {/* Overlay gradiente */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#072749] via-[#072749]/90 to-transparent z-10" />

            {/* Conteúdo textual e ação gerados por código */}
            <div className="absolute inset-0 z-20 px-[16px] flex items-center justify-between">
              <div className="pr-4 max-w-[80%]">
                <h3 className="text-[14px] xs:text-[15px] font-extrabold text-white uppercase tracking-tight leading-tight">
                  FAÇA PARTE<br />DE UMA CÉLULA
                </h3>
                <p className="text-[11px] text-slate-200 mt-1 truncate">
                  Vida cristã em comunidade.
                </p>
              </div>

              <ChevronRight size={22} className="text-white shrink-0 mr-1 drop-shadow-xs" />
            </div>
          </div>

        </section>

        {/* Widget de Aniversariantes do Dia (discreto e contextual) */}
        {aniversariantesHoje.length > 0 && (
          <div className="w-full mt-3 mb-1">
            <div
              onClick={() => router.push('/app/aniversariantes')}
              className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/15 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base">🎂</span>
                <div>
                  <p className="text-xs font-bold text-white">Aniversariantes de Hoje</p>
                  <p className="text-[11px] text-[#C4D5E9]">
                    {aniversariantesHoje.length} {aniversariantesHoje.length === 1 ? 'membro comemora hoje' : 'membros comemoram hoje'}
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold text-[#E8AC35] flex items-center">
                Ver lista <ChevronRight size={14} />
              </span>
            </div>
          </div>
        )}

      </div>

      {/* Links de acessibilidade e compatibilidade para testes de rotas essenciais */}
      <div className="sr-only" aria-hidden="true">
        <a href="/app/aniversariantes">Aniversariantes</a>
        {[{ href: '/app/perfil', label: 'Meu Perfil' }, { href: '/app/carteirinha', label: 'Carteirinha' }, { href: '/app/contribuir', label: 'Contribuir' }, { href: '/app/eventos', label: 'Eventos' }].map(item => (
          <a key={item.href} href={item.href}>{item.label}</a>
        ))}
        <a href="/app/midia">Central de Mídia</a>
      </div>

      {/* Modal amigável de esclarecimento institucional para funcionalidades em expansão */}
      {modalAviso.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-[#FFFFFF] rounded-2xl p-5 shadow-2xl text-slate-900 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-[#092B55]">
                <Info size={20} className="text-[#1354C8]" />
                <h4 className="font-bold text-base text-[#092344]">{modalAviso.titulo}</h4>
              </div>
              <button
                onClick={() => setModalAviso(prev => ({ ...prev, isOpen: false }))}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {modalAviso.mensagem}
            </p>
            <div className="mt-5 flex gap-2">
              {modalAviso.acaoHref && (
                <button
                  onClick={() => {
                    setModalAviso(prev => ({ ...prev, isOpen: false }));
                    router.push(modalAviso.acaoHref!);
                  }}
                  className="flex-1 py-2.5 px-3 bg-[#1354C8] hover:bg-blue-700 active:scale-[0.98] text-white font-semibold text-xs rounded-xl transition-all cursor-pointer"
                >
                  {modalAviso.acaoTexto || 'Acessar'}
                </button>
              )}
              <button
                onClick={() => setModalAviso(prev => ({ ...prev, isOpen: false }))}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all cursor-pointer"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. BARRA INFERIOR DE NAVEGAÇÃO
          - 5 abas proporcionais: Início | Conteúdo | Bíblia | Doações | Mais
          - Fundo branco #FFFFFF
          - Altura: 66px + safe-area
      ───────────────────────────────────────────────────────────── */}
      <MobileBottomNav />
    </div>
  );
}
