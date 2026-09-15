'use client';

/**
 * /app/inicio — Página inicial mobile-first do aplicativo do membro
 * Refinada rigorosamente conforme mockup aprovado (Dark + Blue Institucional).
 */

import { useState, useEffect, useMemo } from 'react';
import { useMobileMember } from '@/providers/MobileMemberProvider';
import MobileBottomNav from '@/components/mobile/MobileBottomNav';
import { createClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import {
  User,
  CreditCard,
  DollarSign,
  Calendar,
  Loader2,
  BookOpen,
  ChevronRight,
  Sparkles,
  HeartHandshake,
  FileText,
  Megaphone,
  Cake,
  Tv,
  Bell,
  Play,
  X,
  Compass,
} from 'lucide-react';
import Image from 'next/image';

const PRIMARY_SHORTCUTS = [
  {
    href: '/app/contribuir',
    label: 'Contribuir',
    icon: DollarSign,
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/15 border-blue-500/25',
  },
  {
    href: '/app/eventos',
    label: 'Eventos',
    icon: Sparkles,
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/15 border-emerald-500/25',
  },
  {
    href: '/app/carteirinha',
    label: 'Carteirinha',
    icon: CreditCard,
    iconColor: 'text-indigo-400',
    iconBg: 'bg-indigo-500/15 border-indigo-500/25',
  },
  {
    href: '/app/ebd',
    label: 'Minha EBD',
    icon: BookOpen,
    iconColor: 'text-cyan-400',
    iconBg: 'bg-cyan-500/15 border-cyan-500/25',
  },
  {
    href: '/app/documentos',
    label: 'Documentos',
    icon: FileText,
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/15 border-amber-500/25',
  },
  {
    href: '/app/programacao',
    label: 'Programação',
    icon: Calendar,
    iconColor: 'text-violet-400',
    iconBg: 'bg-violet-500/15 border-violet-500/25',
  },
];

const ALL_SHORTCUTS = [
  ...PRIMARY_SHORTCUTS,
  {
    href: '/app/midia',
    label: 'Central de Mídia',
    icon: Tv,
    iconColor: 'text-rose-400',
    iconBg: 'bg-rose-500/15 border-rose-500/25',
  },
  {
    href: '/app/comunicados',
    label: 'Comunicados',
    icon: Megaphone,
    iconColor: 'text-sky-400',
    iconBg: 'bg-sky-500/15 border-sky-500/25',
  },
  {
    href: '/app/cuidado-pastoral',
    label: 'Cuidado Pastoral',
    icon: HeartHandshake,
    iconColor: 'text-pink-400',
    iconBg: 'bg-pink-500/15 border-pink-500/25',
  },
  {
    href: '/app/aniversariantes',
    label: 'Aniversariantes',
    icon: Cake,
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/15 border-amber-500/25',
  },
  {
    href: '/app/perfil',
    label: 'Meu Perfil',
    icon: User,
    iconColor: 'text-slate-300',
    iconBg: 'bg-slate-700/30 border-slate-600/30',
  },
];

function formatHoraData(dateStr: string) {
  const d = new Date(dateStr);
  const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const diaSemana = diasSemana[d.getDay()];
  const dia = d.getDate();
  const mes = meses[d.getMonth()];
  const hora = String(d.getHours()).padStart(2, '0');
  const minuto = String(d.getMinutes()).padStart(2, '0');
  return `${diaSemana}, ${dia} de ${mes} às ${hora}:${minuto}`;
}

export default function InicioPage() {
  const { member, isLoading } = useMobileMember();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [proximoCulto, setProximoCulto] = useState<any | null>(null);
  const [aniversariantesHoje, setAniversariantesHoje] = useState<any[]>([]);
  const [aoVivoDestaque, setAoVivoDestaque] = useState<any | null>(null);
  const [showAllShortcuts, setShowAllShortcuts] = useState(false);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        // 1. Próximo Culto
        try {
          const res = await fetch('/api/v1/mobile/agenda?tipo=culto', {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });
          if (res.ok) {
            const resData = await res.json();
            if (resData.proximo_culto) {
              setProximoCulto(resData.proximo_culto);
            } else if (resData.hoje && resData.hoje.length > 0) {
              setProximoCulto(resData.hoje[0]);
            } else if (resData.esta_semana && resData.esta_semana.length > 0) {
              setProximoCulto(resData.esta_semana[0]);
            }
          }
        } catch {
          // Silently keep null
        }

        // 2. Aniversariantes de Hoje
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
          // Silently keep empty
        }

        // 3. Culto Ao Vivo Destaque
        try {
          const resAoVivo = await fetch('/api/v1/mobile/midia/aovivo', {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });
          if (resAoVivo.ok) {
            const dataAoVivo = await resAoVivo.json();
            if (dataAoVivo.is_aovivo) {
              setAoVivoDestaque(dataAoVivo);
            } else {
              setAoVivoDestaque(null);
            }
          }
        } catch {
          // Silently keep null
        }
      } catch {
        // Silently catch
      }
    }
    loadDashboardData();
  }, [supabase]);

  if (isLoading || !member) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <Loader2 size={32} className="text-blue-500 animate-spin" />
      </div>
    );
  }

  const firstName = member.name?.split(' ')[0] ?? 'Membro';

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 pb-28 select-none">
      {/* 1. Header Compacto e Pessoal */}
      <header className="pt-5 pb-3 px-5 flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          {/* Avatar com indicador de status ativo */}
          <div
            onClick={() => router.push('/app/perfil')}
            className="relative cursor-pointer group"
          >
            {member.foto_url ? (
              <Image
                src={member.foto_url}
                alt={member.name}
                width={48}
                height={48}
                className="w-12 h-12 rounded-full object-cover border-2 border-slate-700/80 group-hover:border-blue-500 transition-colors shadow-sm"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[#172033] border border-slate-700/80 flex items-center justify-center text-blue-400 group-hover:border-blue-500 transition-colors shadow-sm">
                <User size={22} />
              </div>
            )}
            <span
              className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[#0f172a] ${
                member.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              title={member.status === 'active' ? 'Membro Ativo' : 'Membro'}
            />
          </div>

          {/* Saudação */}
          <div>
            <p className="text-[11px] font-medium text-slate-400 leading-tight">Olá,</p>
            <h1 className="text-base font-black text-white leading-tight truncate max-w-[180px] sm:max-w-[220px]">
              {firstName}
            </h1>
            <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
              Que bom ter você aqui!
            </p>
          </div>
        </div>

        {/* Botões de Ação Topo (Notificações / Mural) */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/app/comunicados')}
            className="w-10 h-10 rounded-full bg-[#172033] border border-slate-700/60 flex items-center justify-center text-slate-300 hover:text-white hover:border-slate-600 transition-all active:scale-95 relative"
            title="Comunicados e Notificações"
          >
            <Bell size={18} />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-blue-500" />
          </button>
        </div>
      </header>

      {/* 2. Hero Principal (Ao Vivo se houver, ou Destaque da Semana) */}
      <section className="px-5 mt-3">
        {aoVivoDestaque ? (
          /* Card AO VIVO */
          <div className="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
            {/* Background com gradiente escuro e brilho */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/90 to-blue-950/40 z-0" />
            <div className="absolute top-0 right-0 w-48 h-48 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 p-5 pt-6 flex flex-col justify-between min-h-[190px]">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-600 text-white shadow-md shadow-rose-900/40 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-white" />
                  AO VIVO AGORA
                </span>
                <span className="text-[11px] font-medium text-slate-400">
                  {aoVivoDestaque.plataforma || 'Transmissão Oficial'}
                </span>
              </div>

              <div className="my-3">
                <h2 className="text-xl font-black text-white leading-snug drop-shadow-sm">
                  {aoVivoDestaque.titulo || 'Culto de Celebração'}
                </h2>
                <p className="text-xs text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                  {aoVivoDestaque.descricao || 'Participe conosco agora ao vivo e seja edificado pela palavra de Deus.'}
                </p>
              </div>

              <button
                onClick={() => router.push('/app/midia')}
                className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-bold text-sm py-3 px-4 rounded-2xl flex items-center justify-between shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Play size={16} className="fill-white" />
                  Assistir agora
                </span>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        ) : (
          /* Card Destaque Institucional / Palavra da Semana */
          <div className="relative overflow-hidden rounded-3xl bg-[#111827] border border-slate-800 shadow-xl">
            {/* Background com gradiente e ambientação */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-950/40 via-slate-900/90 to-[#111827] z-0" />
            <div className="absolute -top-10 -right-10 w-44 h-44 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 p-5 pt-6 flex flex-col justify-between min-h-[190px]">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <Compass size={13} className="text-blue-400" />
                  {member.congregacao_nome || 'Gestão Eklésia'}
                </span>
                <span className="text-[11px] font-semibold text-slate-400">
                  Igreja Conectada
                </span>
              </div>

              <div className="my-3">
                <h2 className="text-lg sm:text-xl font-black text-white leading-snug">
                  {proximoCulto ? proximoCulto.titulo : 'Culto de Celebração'}
                </h2>
                <p className="text-xs text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                  {proximoCulto
                    ? formatHoraData(proximoCulto.data_inicio)
                    : 'Acompanhe as mensagens, participe dos cultos e fique por dentro da vida da igreja.'}
                </p>
              </div>

              <button
                onClick={() => router.push(proximoCulto ? `/app/programacao/${proximoCulto.id}` : '/app/midia')}
                className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-bold text-sm py-3 px-4 rounded-2xl flex items-center justify-between shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Play size={16} className="fill-white" />
                  {proximoCulto ? 'Ver detalhes do culto' : 'Explorar Palavra e Mídia'}
                </span>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Indicadores sutis de carrossel (dots) */}
        <div className="flex items-center justify-center gap-1.5 mt-3">
          <span className="w-5 h-1.5 rounded-full bg-blue-500" />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
        </div>
      </section>

      {/* 3. Próximo Culto (Horizontal Card conforme Mockup) */}
      {proximoCulto && (
        <section className="px-5 mt-4">
          <div
            onClick={() => router.push(`/app/programacao/${proximoCulto.id}`)}
            className="bg-[#111827] rounded-2xl p-4 border border-slate-800 shadow-sm flex items-center justify-between gap-3 hover:border-slate-700 active:scale-[0.99] transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                <Calendar size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">
                  Próximo Culto
                </p>
                <h3 className="text-sm font-bold text-white truncate">
                  {proximoCulto.titulo}
                </h3>
                <p className="text-xs text-slate-400 truncate mt-0.5 flex items-center gap-1">
                  <span>{formatHoraData(proximoCulto.data_inicio)}</span>
                  <span>•</span>
                  <span className="truncate">{proximoCulto.congregacoes?.nome || proximoCulto.local || 'Templo Sede'}</span>
                </p>
              </div>
            </div>
            <div className="text-slate-500 shrink-0 pl-1">
              <ChevronRight size={18} />
            </div>
          </div>
        </section>
      )}

      {/* 4. Widget de Aniversariantes do Dia (se houver) */}
      {aniversariantesHoje.length > 0 && (
        <section className="px-5 mt-3">
          <div
            onClick={() => router.push('/app/aniversariantes')}
            className="bg-gradient-to-r from-amber-950/30 via-[#172033] to-[#111827] rounded-2xl p-3.5 border border-amber-500/30 shadow-sm flex items-center justify-between gap-3 active:scale-[0.99] transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 font-bold">
                <Cake size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-amber-300 truncate">
                  🎂 {aniversariantesHoje.length} {aniversariantesHoje.length === 1 ? 'aniversariante hoje!' : 'aniversariantes hoje!'}
                </p>
                <p className="text-[11px] text-slate-400 truncate">
                  {aniversariantesHoje
                    .map((a: any) => a.nome.split(' ')[0])
                    .slice(0, 3)
                    .join(', ') + (aniversariantesHoje.length > 3 ? ' e mais...' : '')}
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-amber-400 shrink-0 flex items-center">
              Parabenizar <ChevronRight size={14} />
            </span>
          </div>
        </section>
      )}

      {/* 5. Acesso Rápido (Grade com 6 atalhos + Link "Ver todos") */}
      <section className="px-5 mt-6">
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-sm font-bold text-white tracking-tight">
            Acesso Rápido
          </h2>
          <button
            onClick={() => setShowAllShortcuts(true)}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-0.5 cursor-pointer"
          >
            Ver todos
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {PRIMARY_SHORTCUTS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className="bg-[#111827] rounded-2xl p-3.5 flex flex-col items-center justify-center gap-2 border border-slate-800/80 shadow-xs hover:border-slate-700 hover:bg-[#172033] active:scale-[0.96] transition-all cursor-pointer"
              >
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center border ${item.iconBg}`}
                >
                  <Icon size={20} className={item.iconColor} />
                </div>
                <span className="text-xs font-semibold text-slate-200 text-center truncate max-w-full">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 6. Modal / Sheet "Todos os Atalhos" */}
      {showAllShortcuts && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full sm:max-w-md bg-[#111827] border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Sparkles size={16} />
                </div>
                <h3 className="text-base font-bold text-white">Todos os Atalhos</h3>
              </div>
              <button
                onClick={() => setShowAllShortcuts(false)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {ALL_SHORTCUTS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.href}
                    onClick={() => {
                      setShowAllShortcuts(false);
                      router.push(item.href);
                    }}
                    className="bg-[#172033] rounded-2xl p-3 flex flex-col items-center justify-center gap-2 border border-slate-700/60 hover:border-slate-600 active:scale-95 transition-all cursor-pointer"
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center border ${item.iconBg}`}
                    >
                      <Icon size={18} className={item.iconColor} />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-200 text-center truncate max-w-full">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 pt-4 border-t border-slate-800 text-center">
              <button
                onClick={() => setShowAllShortcuts(false)}
                className="w-full py-2.5 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/60 rounded-xl transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Bottom Navigation Homologada com 5 abas */}
      <MobileBottomNav />
    </div>
  );
}
