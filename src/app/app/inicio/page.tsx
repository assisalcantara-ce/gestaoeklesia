'use client';

/**
 * /app/inicio — Página inicial mobile-first do aplicativo do membro
 * Reconstrução com fidelidade estrita ao mockup de referência:
 * - Viewport mobile de 390x844 CSS (responsivo 320px–430px, max 430px centralizado).
 * - Fundo geral: azul-marinho profundo #061D38 com gradiente superior linear-gradient(160deg, #073765 0%, #052A50 45%, #061D38 100%).
 * - Cabeçalho: logomarca dinâmica do tenant em avatar circular 54x54px branco, nome e subtítulo oficiais, sino de notificações (44x44px) com badge real.
 * - Banner principal / Hero: ratio 190px (em 390px), border-radius 16px, título em caixa alta, linha dourada #E8AC35 (100x2px), subtítulo com letter-spacing.
 * - Grade de acesso rápido (3 colunas x 2 linhas, cards 100px brancos, sombra suave, ícones 29px #092B55):
 *     1. Mensagens (Livro aberto)
 *     2. Eventos (Calendário)
 *     3. Células (Grupo de pessoas)
 *     4. Pedidos de Oração (Mãos em oração)
 *     5. Contribuir (Coração)
 *     6. Falar com o Pastor (Conversa / Cuidado Pastoral)
 * - Banners secundário (Discipulado) e terciário (Células): 94px de altura, bordas arredondadas 12px, overlay lateral e chevron.
 * - Barra inferior de navegação com 5 abas em branco e azul royal #1354C8:
 *     Início | Conteúdo | Bíblia | Doações | Mais.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useMobileMember } from '@/providers/MobileMemberProvider';
import MobileBottomNav from '@/components/mobile/MobileBottomNav';
import { createClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  BookOpen,
  Calendar,
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
function PrayingHandsIcon({ size = 29, className = 'text-[#092B55]' }: { size?: number; className?: string }) {
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

interface BannerSlide {
  id: string;
  titulo: string;
  subtitulo: string;
  imagemUrl: string;
  linkHref?: string;
}

export default function InicioPage() {
  const { member, isLoading } = useMobileMember();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [notificacoesNaoLidas, setNotificacoesNaoLidas] = useState(0);
  const [aniversariantesHoje, setAniversariantesHoje] = useState<any[]>([]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
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
        // Silencioso em caso de rede instável
      }
    }
    loadNotificacoes();
  }, [supabase]);

  // Slides dinâmicos do Hero Banner
  const bannerSlides: BannerSlide[] = useMemo(() => {
    return [
      {
        id: 'hero-1',
        titulo: 'UMA IGREJA DE PESSOAS REAIS PARA UM DEUS REAL',
        subtitulo: 'CONHECER • CRESCER • SERVIR',
        imagemUrl: '/img/membro_banner_hero.png',
        linkHref: '/app/programacao',
      },
    ];
  }, []);

  const handleCardClick = useCallback((acao: string, rota: string) => {
    if (acao === 'celulas') {
      setModalAviso({
        isOpen: true,
        titulo: 'Células e Pequenos Grupos',
        mensagem:
          'O módulo de localização e integração de Células está sendo configurado pela liderança da sua igreja. Em breve você poderá encontrar e participar da célula mais próxima da sua casa!',
        acaoTexto: 'Ver Comunicados',
        acaoHref: '/app/comunicados',
      });
      return;
    }
    router.push(rota);
  }, [router]);

  if (isLoading || !member) {
    return (
      <div className="min-h-screen bg-[#061D38] flex items-center justify-center">
        <Loader2 size={36} className="text-blue-400 animate-spin" />
      </div>
    );
  }

  // Nome e subtítulo institucionais do tenant com fallback neutro
  const nomeInstitucional = member.ministerio_nome || member.congregacao_nome || 'Gestão Eklésia';
  const subtituloInstitucional = member.congregacao_nome
    ? `${member.congregacao_nome} • Uma família para pertencer`
    : 'Uma família para pertencer';

  return (
    <div
      className="min-h-screen w-full text-white select-none relative overflow-x-hidden"
      style={{
        backgroundColor: '#061D38',
        background: 'linear-gradient(160deg, #073765 0%, #052A50 45%, #061D38 100%)',
        paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* Container principal estritamente centralizado com largura máxima de 430px */}
      <div className="w-full max-w-[430px] mx-auto px-3 sm:px-4 flex flex-col box-border">

        {/* ─────────────────────────────────────────────────────────────
            2. CABEÇALHO INSTITUCIONAL
            - Altura ~76px
            - Logomarca dinâmica em círculo 54x54px branco
            - Nome oficial 19px bold + subtítulo 11px #C4D5E9
            - Sino 44x44px com badge real
        ───────────────────────────────────────────────────────────── */}
        <header
          className="w-full flex items-center justify-between pt-2 pb-2 min-h-[76px]"
          style={{ paddingTop: 'max(10px, env(safe-area-inset-top, 0px))' }}
        >
          {/* Lado Esquerdo: Logomarca + Identificação */}
          <div className="flex items-center min-w-0 pr-2">
            {/* Logomarca oficial com fallback circular */}
            <div className="w-[54px] h-[54px] rounded-full bg-white border border-white/20 p-[5px] flex items-center justify-center shrink-0 shadow-md shadow-black/20 overflow-hidden">
              {member.ministerio_logo ? (
                <Image
                  src={member.ministerio_logo}
                  alt={nomeInstitucional}
                  width={44}
                  height={44}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#092B55] to-[#1354C8] flex items-center justify-center text-white">
                  <Church size={24} />
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

          {/* Lado Direito: Botão de Notificações com sino 23px e área clicável 44x44px */}
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
            3. BANNER PRINCIPAL / HERO
            - 190px de altura (responsivo 170–200px)
            - border-radius 16px
            - Título 18px bold caixa alta (máx 3 linhas)
            - Linha dourada #E8AC35 (100x2px)
            - Subtítulo 10px peso 600, letter-spacing 2px
            - Dots carrossel centralizados abaixo
        ───────────────────────────────────────────────────────────── */}
        <section className="w-full mt-3">
          <div
            onClick={() => {
              const currentSlide = bannerSlides[activeSlideIndex];
              if (currentSlide?.linkHref) router.push(currentSlide.linkHref);
            }}
            className="relative w-full h-[170px] xs:h-[185px] sm:h-[195px] rounded-[16px] overflow-hidden shadow-xl shadow-black/35 cursor-pointer active:scale-[0.99] transition-transform bg-[#052A50]"
          >
            {/* Imagem de Fundo Oficial do Banner */}
            <Image
              src={bannerSlides[activeSlideIndex]?.imagemUrl || '/img/membro_banner_hero.png'}
              alt={bannerSlides[activeSlideIndex]?.titulo || 'Banner Institucional'}
              fill
              priority
              className="object-cover object-center"
              sizes="(max-width: 430px) 100vw, 430px"
            />

            {/* Overlay Gradiente Escuro na metade inferior para legibilidade absoluta */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent z-10" />

            {/* Conteúdo Institucional Alinhado à Esquerda */}
            <div className="absolute inset-0 z-20 p-[18px] flex flex-col justify-end">
              <h2 className="text-[16px] xs:text-[18px] font-extrabold text-white leading-tight uppercase tracking-tight drop-shadow-md line-clamp-3 max-w-[90%]">
                {bannerSlides[activeSlideIndex]?.titulo}
              </h2>

              {/* Linha decorativa dourada #E8AC35 */}
              <div
                className="w-[100px] h-[2px] my-2 bg-[#E8AC35] rounded-full shadow-xs"
                style={{ backgroundColor: '#E8AC35' }}
              />

              <p className="text-[10px] font-semibold text-slate-100 uppercase tracking-[2px] drop-shadow-sm">
                {bannerSlides[activeSlideIndex]?.subtitulo}
              </p>
            </div>
          </div>

          {/* Indicadores do Carrossel (mostra apenas se houver > 1 slide) */}
          {bannerSlides.length > 1 && (
            <div className="flex items-center justify-center gap-[6px] mt-2">
              {bannerSlides.map((slide, idx) => (
                <button
                  key={slide.id}
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
            4. GRADE DE ACESSO RÁPIDO — SEIS CARDS (3 colunas x 2 linhas)
            - Gap horizontal: 8px | Gap vertical: 10px
            - Card: Fundo #FFFFFF, border-radius 12px, altura 94–106px
            - Sombra: 0 4px 14px rgba(0,0,0,0.12)
            - Ícone: 29x29px azul #092B55
            - Texto: 12px peso 600 cor #092344
            - Ordem exata:
                1. Mensagens (Livro aberto)
                2. Eventos (Calendário)
                3. Células (Grupo de pessoas)
                4. Pedidos de Oração (Mãos em oração)
                5. Contribuir (Coração)
                6. Falar com o Pastor (Conversa)
        ───────────────────────────────────────────────────────────── */}
        <section className="w-full mt-[18px]">
          <div className="grid grid-cols-3 gap-x-[8px] gap-y-[10px]">

            {/* 1. Mensagens */}
            <button
              onClick={() => handleCardClick('mensagens', '/app/midia')}
              className="w-full h-[94px] xs:h-[100px] sm:h-[106px] bg-[#FFFFFF] rounded-[12px] p-[8px] flex flex-col items-center justify-center text-center shadow-[0_4px_14px_rgba(0,0,0,0.12)] hover:bg-slate-50 active:scale-[0.97] transition-all cursor-pointer select-none"
            >
              <BookOpen size={29} strokeWidth={2} className="text-[#092B55] shrink-0" />
              <span className="text-[11px] xs:text-[12px] font-semibold text-[#092344] leading-tight line-clamp-2 mt-[9px]">
                Mensagens
              </span>
            </button>

            {/* 2. Eventos */}
            <button
              onClick={() => handleCardClick('eventos', '/app/eventos')}
              className="w-full h-[94px] xs:h-[100px] sm:h-[106px] bg-[#FFFFFF] rounded-[12px] p-[8px] flex flex-col items-center justify-center text-center shadow-[0_4px_14px_rgba(0,0,0,0.12)] hover:bg-slate-50 active:scale-[0.97] transition-all cursor-pointer select-none"
            >
              <Calendar size={29} strokeWidth={2} className="text-[#092B55] shrink-0" />
              <span className="text-[11px] xs:text-[12px] font-semibold text-[#092344] leading-tight line-clamp-2 mt-[9px]">
                Eventos
              </span>
            </button>

            {/* 3. Células */}
            <button
              onClick={() => handleCardClick('celulas', '/app/comunicados')}
              className="w-full h-[94px] xs:h-[100px] sm:h-[106px] bg-[#FFFFFF] rounded-[12px] p-[8px] flex flex-col items-center justify-center text-center shadow-[0_4px_14px_rgba(0,0,0,0.12)] hover:bg-slate-50 active:scale-[0.97] transition-all cursor-pointer select-none"
            >
              <Users size={29} strokeWidth={2} className="text-[#092B55] shrink-0" />
              <span className="text-[11px] xs:text-[12px] font-semibold text-[#092344] leading-tight line-clamp-2 mt-[9px]">
                Células
              </span>
            </button>

            {/* 4. Pedidos de Oração */}
            <button
              onClick={() => handleCardClick('oracao', '/app/cuidado-pastoral')}
              className="w-full h-[94px] xs:h-[100px] sm:h-[106px] bg-[#FFFFFF] rounded-[12px] p-[8px] flex flex-col items-center justify-center text-center shadow-[0_4px_14px_rgba(0,0,0,0.12)] hover:bg-slate-50 active:scale-[0.97] transition-all cursor-pointer select-none"
            >
              <PrayingHandsIcon size={29} className="text-[#092B55] shrink-0" />
              <span className="text-[11px] xs:text-[12px] font-semibold text-[#092344] leading-tight line-clamp-2 mt-[9px]">
                Pedidos<br />de Oração
              </span>
            </button>

            {/* 5. Contribuir */}
            <button
              onClick={() => handleCardClick('contribuir', '/app/contribuir')}
              className="w-full h-[94px] xs:h-[100px] sm:h-[106px] bg-[#FFFFFF] rounded-[12px] p-[8px] flex flex-col items-center justify-center text-center shadow-[0_4px_14px_rgba(0,0,0,0.12)] hover:bg-slate-50 active:scale-[0.97] transition-all cursor-pointer select-none"
            >
              <Heart size={29} strokeWidth={2} className="text-[#092B55] shrink-0" />
              <span className="text-[11px] xs:text-[12px] font-semibold text-[#092344] leading-tight line-clamp-2 mt-[9px]">
                Contribuir
              </span>
            </button>

            {/* 6. Falar com o Pastor */}
            <button
              onClick={() => handleCardClick('pastor', '/app/cuidado-pastoral')}
              className="w-full h-[94px] xs:h-[100px] sm:h-[106px] bg-[#FFFFFF] rounded-[12px] p-[8px] flex flex-col items-center justify-center text-center shadow-[0_4px_14px_rgba(0,0,0,0.12)] hover:bg-slate-50 active:scale-[0.97] transition-all cursor-pointer select-none"
            >
              <MessageCircle size={29} strokeWidth={2} className="text-[#092B55] shrink-0" />
              <span className="text-[11px] xs:text-[12px] font-semibold text-[#092344] leading-tight line-clamp-2 mt-[9px]">
                Falar com<br />o Pastor
              </span>
            </button>

          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────
            5. BANNER SECUNDÁRIO — DISCIPULADO
            - Posição: 18px abaixo da grade
            - Altura: 94px, border-radius 12px
            - Imagem de Bíblia aberta com overlay escuro à esquerda
            - Título: "DISCIPULADO QUE TRANSFORMA" 15px peso 800 branco
            - Subtítulo: "Chega na sua jornada com Deus." 11px branco suave
            - Chevron direito 22px
        ───────────────────────────────────────────────────────────── */}
        <section className="w-full mt-[18px]">
          <div
            onClick={() => router.push('/app/ebd')}
            className="relative w-full h-[94px] rounded-[12px] overflow-hidden shadow-lg shadow-black/25 cursor-pointer active:scale-[0.99] transition-transform bg-[#092344]"
          >
            <Image
              src="/img/membro_banner_discipulado.png"
              alt="Discipulado que Transforma"
              fill
              className="object-cover object-right"
              sizes="(max-width: 430px) 100vw, 430px"
            />
            {/* Overlay gradiente escuro à esquerda */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent z-10" />

            {/* Conteúdo textual e ação */}
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
        </section>

        {/* ─────────────────────────────────────────────────────────────
            6. BANNER TERCIÁRIO — CÉLULAS
            - Posição: 10px abaixo do banner de discipulado
            - Altura: 94px, border-radius 12px
            - Fotografia de comunhão com overlay à esquerda
            - Título: "FAÇA PARTE DE UMA CÉLULA" 15px peso 800 branco
            - Subtítulo: "Vida cristã em comunidade." 11px
            - Chevron direito 22px
        ───────────────────────────────────────────────────────────── */}
        <section className="w-full mt-[10px] mb-4">
          <div
            onClick={() => handleCardClick('celulas', '/app/comunicados')}
            className="relative w-full h-[94px] rounded-[12px] overflow-hidden shadow-lg shadow-black/25 cursor-pointer active:scale-[0.99] transition-transform bg-[#092344]"
          >
            <Image
              src="/img/membro_banner_celula.png"
              alt="Faça parte de uma Célula"
              fill
              className="object-cover object-right"
              sizes="(max-width: 430px) 100vw, 430px"
            />
            {/* Overlay gradiente escuro à esquerda */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent z-10" />

            {/* Conteúdo textual e ação */}
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

      </div>

      {/* Acesso rápido secundário / aniversariantes */}
      {aniversariantesHoje.length > 0 && (
        <div className="w-full max-w-[430px] mx-auto px-3 sm:px-4 mb-2">
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

      {/* Links de navegação e compatibilidade */}
      <div className="sr-only" aria-hidden="true">
        <a href="/app/aniversariantes">Aniversariantes</a>
        {/* Compatibilidade de atalhos MVP */}
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
          7. BARRA INFERIOR DE NAVEGAÇÃO
          - Fundo branco #FFFFFF
          - 5 abas: Início | Conteúdo | Bíblia | Doações | Mais
      ───────────────────────────────────────────────────────────── */}
      <MobileBottomNav />
    </div>
  );
}
