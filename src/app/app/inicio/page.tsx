'use client';

/**
 * /app/inicio — Página inicial do portal do membro
 */

import { useState, useEffect, useMemo } from 'react';
import { useMobileMember } from '@/providers/MobileMemberProvider';
import MobileHeader from '@/components/mobile/MobileHeader';
import MobileBottomNav from '@/components/mobile/MobileBottomNav';
import { createClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import {
  User,
  CreditCard,
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  BookOpen,
  Flame,
  ChevronRight,
  MapPin,
  Sparkles,
  HeartHandshake,
  FileText,
  Megaphone,
  Cake,
  Tv,
} from 'lucide-react';
import Image from 'next/image';

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  active: { label: 'Ativo', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  inactive: { label: 'Inativo', color: 'bg-gray-100 text-gray-600', icon: XCircle },
  pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  visitante: { label: 'Visitante', color: 'bg-blue-100 text-blue-700', icon: User },
};

const SHORTCUTS = [
  { href: '/app/midia', label: 'Central de Mídia', icon: Tv, enabled: true },
  { href: '/app/comunicados', label: 'Comunicados', icon: Megaphone, enabled: true },
  { href: '/app/aniversariantes', label: 'Aniversariantes', icon: Cake, enabled: true },
  { href: '/app/programacao', label: 'Programação', icon: Calendar, enabled: true },
  { href: '/app/cuidado-pastoral', label: 'Cuidado Pastoral', icon: HeartHandshake, enabled: true },
  { href: '/app/documentos', label: 'Meus Documentos', icon: FileText, enabled: true },
  { href: '/app/ebd', label: 'Minha EBD', icon: BookOpen, enabled: true },
  { href: '/app/carteirinha', label: 'Carteirinha', icon: CreditCard, enabled: true },
  { href: '/app/contribuir', label: 'Contribuir', icon: DollarSign, enabled: true },
  { href: '/app/eventos', label: 'Eventos', icon: Sparkles, enabled: true },
  { href: '/app/perfil', label: 'Meu Perfil', icon: User, enabled: true },
];

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    color: 'bg-gray-100 text-gray-600',
    icon: User,
  };
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.color}`}
    >
      <Icon size={12} />
      {cfg.label}
    </span>
  );
}

function formatHoraData(dateStr: string) {
  const d = new Date(dateStr);
  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const diaSemana = diasSemana[d.getDay()];
  const dia = d.getDate();
  const mes = meses[d.getMonth()];
  const hora = String(d.getHours()).padStart(2, '0');
  const minuto = String(d.getMinutes()).padStart(2, '0');
  return `${diaSemana}, ${dia} ${mes} às ${hora}:${minuto}`;
}

export default function InicioPage() {
  const { member, isLoading } = useMobileMember();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [proximoCulto, setProximoCulto] = useState<any | null>(null);
  const [aniversariantesHoje, setAniversariantesHoje] = useState<any[]>([]);
  const [aoVivoDestaque, setAoVivoDestaque] = useState<any | null>(null);

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
    <div className="min-h-screen bg-[#0f172a] text-slate-100 pb-28">
      <MobileHeader
        title="Início"
        rightSlot={
          <div className="flex items-center gap-2">
            <Image
              src="/brand/logo-white.png"
              alt="Gestão Eklésia"
              width={80}
              height={22}
              className="h-5 w-auto object-contain opacity-90"
              priority
            />
          </div>
        }
      />

      {/* Hero */}
      <div className="bg-gradient-to-b from-[#111827] to-[#0f172a] pt-20 pb-6 px-5 border-b border-slate-800/50">
        <div className="flex items-center gap-4">
          {member.foto_url ? (
            <Image
              src={member.foto_url}
              alt={member.name}
              width={56}
              height={56}
              className="w-14 h-14 rounded-2xl object-cover border-2 border-blue-500/30 shadow-md"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center border border-slate-700 shadow-md">
              <User size={24} className="text-blue-400" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-slate-400 text-xs font-medium">Bem-vindo(a),</p>
            <p className="text-white text-lg font-bold leading-tight truncate">{firstName}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <StatusBadge status={member.status} />
              {member.congregacao_nome && (
                <span className="text-slate-400 text-xs truncate">
                  • {member.congregacao_nome}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Card Destaque: Culto Ao Vivo (desaparece quando offline) */}
      {aoVivoDestaque && (
        <div className="px-5 mt-4">
          <div
            onClick={() => router.push('/app/midia')}
            className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 rounded-2xl p-4 shadow-lg text-white cursor-pointer active:scale-[0.98] transition-all relative overflow-hidden border border-red-500/40"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white text-red-600 shadow-sm animate-pulse">
                <span className="w-2 h-2 rounded-full bg-red-600" />
                AO VIVO AGORA
              </span>
              <span className="text-[11px] font-semibold text-red-100 flex items-center gap-1">
                Assistir <ChevronRight size={14} />
              </span>
            </div>

            <h3 className="text-sm font-bold text-white line-clamp-1">
              {aoVivoDestaque.titulo || 'Culto Ao Vivo na Igreja'}
            </h3>

            {aoVivoDestaque.descricao && (
              <p className="text-xs text-red-100 line-clamp-1 mt-0.5 opacity-90">
                {aoVivoDestaque.descricao}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Card Destaque: Próximo Culto */}
      {proximoCulto && (
        <div className="px-5 mt-4">
          <div
            onClick={() => router.push(`/app/programacao/${proximoCulto.id}`)}
            className="bg-[#111827] rounded-2xl p-4 shadow-md border border-slate-800 hover:border-slate-700 transition-all cursor-pointer active:scale-[0.98]"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-950/80 text-blue-400 border border-blue-800/50">
                <Flame size={12} className="text-blue-400 fill-blue-400" />
                Próximo Culto
              </span>
              <span className="text-[11px] font-semibold text-blue-400">
                {formatHoraData(proximoCulto.data_inicio)}
              </span>
            </div>

            <h3 className="text-sm font-bold text-slate-100 truncate">
              {proximoCulto.titulo}
            </h3>

            <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-slate-800 text-xs text-slate-400">
              <span className="truncate flex items-center gap-1.5">
                <MapPin size={13} className="text-slate-500 shrink-0" />
                {proximoCulto.congregacoes?.nome || proximoCulto.local || 'Na Igreja'}
              </span>
              <ChevronRight size={14} className="text-slate-500 shrink-0" />
            </div>
          </div>
        </div>
      )}

      {/* Widget: Aniversariantes */}
      <div className="px-5 mt-3">
        <div
          onClick={() => router.push('/app/aniversariantes')}
          className={`rounded-2xl p-4 shadow-sm border transition-all cursor-pointer active:scale-[0.98] ${
            aniversariantesHoje.length > 0
              ? 'bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-slate-900 border-amber-500/30 hover:border-amber-500/50'
              : 'bg-[#111827] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  aniversariantesHoje.length > 0
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                    : 'bg-slate-800 text-amber-400 border border-slate-700'
                }`}
              >
                <Cake size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-slate-100 truncate">
                  {aniversariantesHoje.length > 0
                    ? `🎂 ${aniversariantesHoje.length} ${
                        aniversariantesHoje.length === 1
                          ? 'aniversariante hoje!'
                          : 'aniversariantes hoje!'
                      }`
                    : 'Aniversariantes'}
                </h3>
                <p className="text-[11px] text-slate-400 truncate">
                  {aniversariantesHoje.length > 0
                    ? aniversariantesHoje
                        .map((a: any) => a.nome.split(' ')[0])
                        .slice(0, 3)
                        .join(', ') + (aniversariantesHoje.length > 3 ? ' e mais...' : '')
                    : 'Celebre a vida dos irmãos em Cristo'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-amber-400 shrink-0">
              <span className="hidden sm:inline">Ver todos</span>
              <ChevronRight size={14} />
            </div>
          </div>
        </div>
      </div>

      {/* Atalhos Rápidos */}
      <div className="px-5 mt-6">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3.5 flex items-center gap-1.5">
          <Sparkles size={13} className="text-blue-400" />
          Menu Rápido
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          {SHORTCUTS.map(({ href, label, icon: Icon, enabled }) =>
            enabled ? (
              <button
                key={label}
                onClick={() => router.push(href)}
                className="bg-[#111827] rounded-2xl p-4 flex flex-col items-start gap-3 shadow-xs border border-slate-800 active:scale-[0.97] transition-all hover:border-slate-700 hover:bg-[#172033]"
              >
                <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center">
                  <Icon size={20} className="text-blue-400" />
                </div>
                <span className="text-xs font-semibold text-slate-200">{label}</span>
              </button>
            ) : (
              <div
                key={label}
                className="bg-[#111827] rounded-2xl p-4 flex flex-col items-start gap-3 shadow-xs border border-slate-800 opacity-40 cursor-not-allowed"
              >
                <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center">
                  <Icon size={20} className="text-slate-500" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-400">{label}</span>
                  <span className="block text-[10px] text-slate-500 mt-0.5">Em breve</span>
                </div>
              </div>
            ),
          )}
        </div>
      </div>

      {/* Ministério */}
      {member.ministerio_nome && (
        <div className="px-5 mt-6">
          <div className="bg-[#111827] rounded-2xl p-4 border border-slate-800 shadow-sm flex items-center gap-3.5">
            {member.ministerio_logo ? (
              <Image
                src={member.ministerio_logo}
                alt={member.ministerio_nome}
                width={40}
                height={40}
                className="w-10 h-10 rounded-xl object-cover border border-slate-700"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <span className="text-blue-400 font-bold text-sm">
                  {member.ministerio_nome.charAt(0)}
                </span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-slate-400 font-medium">Igreja / Ministério</p>
              <p className="text-sm font-bold text-slate-200 truncate">{member.ministerio_nome}</p>
            </div>
          </div>
        </div>
      )}

      <MobileBottomNav />
    </div>
  );
}
