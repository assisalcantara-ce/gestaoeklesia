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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="text-dark-blue animate-spin" />
      </div>
    );
  }

  const firstName = member.name?.split(' ')[0] ?? 'Membro';

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <MobileHeader title="Início" />

      {/* Hero */}
      <div className="bg-dark-blue pt-20 pb-8 px-6">
        <div className="flex items-center gap-4">
          {member.foto_url ? (
            <Image
              src={member.foto_url}
              alt={member.name}
              width={56}
              height={56}
              className="w-14 h-14 rounded-full object-cover border-2 border-white/30"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center border-2 border-white/20">
              <User size={26} className="text-white/70" />
            </div>
          )}
          <div>
            <p className="text-white/60 text-sm">Olá,</p>
            <p className="text-white text-lg font-bold leading-tight">{firstName}</p>
            <div className="mt-1">
              <StatusBadge status={member.status} />
            </div>
          </div>
        </div>

        {/* Congregação */}
        {member.congregacao_nome && (
          <p className="text-white/50 text-xs mt-4">
            🏛 {member.congregacao_nome}
          </p>
        )}
      </div>

      {/* Card Destaque: Culto Ao Vivo (desaparece quando offline) */}
      {aoVivoDestaque && (
        <div className="px-6 -mt-4 mb-4">
          <div
            onClick={() => router.push('/app/midia')}
            className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 rounded-2xl p-4 shadow-lg text-white cursor-pointer active:scale-[0.98] transition-transform relative overflow-hidden"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white text-red-600 shadow-sm animate-pulse">
                <span className="w-2 h-2 rounded-full bg-red-600" />
                AO VIVO AGORA
              </span>
              <span className="text-[11px] font-semibold text-red-100 flex items-center gap-1">
                Assista no App <ChevronRight size={14} />
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
        <div className={`px-6 ${aoVivoDestaque ? 'mt-0' : '-mt-4'}`}>
          <div
            onClick={() => router.push(`/app/programacao/${proximoCulto.id}`)}
            className="bg-white rounded-2xl p-4 shadow-md border border-blue-100 hover:border-blue-300 transition-all cursor-pointer active:scale-[0.98]"
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                <Flame size={11} className="text-amber-600 fill-amber-500" />
                Próximo Culto
              </span>
              <span className="text-[11px] font-semibold text-blue-600">
                {formatHoraData(proximoCulto.data_inicio)}
              </span>
            </div>

            <h3 className="text-sm font-bold text-slate-900 truncate">
              {proximoCulto.titulo}
            </h3>

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
              <span className="truncate flex items-center gap-1">
                <MapPin size={12} className="text-slate-400 shrink-0" />
                {proximoCulto.congregacoes?.nome || proximoCulto.local || 'Na Igreja'}
              </span>
              <ChevronRight size={14} className="text-slate-400 shrink-0" />
            </div>
          </div>
        </div>
      )}

      {/* Widget: Aniversariantes */}
      <div className={`px-6 ${proximoCulto ? 'mt-3' : '-mt-4'}`}>
        <div
          onClick={() => router.push('/app/aniversariantes')}
          className={`rounded-2xl p-4 shadow-sm border transition-all cursor-pointer active:scale-[0.98] ${
            aniversariantesHoje.length > 0
              ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 hover:border-amber-300'
              : 'bg-white border-gray-100 hover:border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  aniversariantesHoje.length > 0
                    ? 'bg-amber-500 text-white'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                <Cake size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-gray-900 truncate">
                  {aniversariantesHoje.length > 0
                    ? `🎂 ${aniversariantesHoje.length} ${
                        aniversariantesHoje.length === 1
                          ? 'aniversariante hoje!'
                          : 'aniversariantes hoje!'
                      }`
                    : 'Aniversariantes'}
                </h3>
                <p className="text-[11px] text-gray-500 truncate">
                  {aniversariantesHoje.length > 0
                    ? aniversariantesHoje
                        .map((a: any) => a.nome.split(' ')[0])
                        .slice(0, 3)
                        .join(', ') + (aniversariantesHoje.length > 3 ? ' e mais...' : '')
                    : 'Celebre com a igreja a vida dos irmãos'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-amber-700 shrink-0">
              <span className="hidden sm:inline">Ver todos</span>
              <ChevronRight size={14} />
            </div>
          </div>
        </div>
      </div>

      {/* Atalhos */}
      <div className="px-6 mt-6">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Menu rápido
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {SHORTCUTS.map(({ href, label, icon: Icon, enabled }) =>
            enabled ? (
              <button
                key={label}
                onClick={() => router.push(href)}
                className="bg-white rounded-2xl p-5 flex flex-col items-start gap-3 shadow-sm border border-gray-100 active:scale-[0.97] transition-transform hover:shadow-md"
              >
                <div className="w-10 h-10 bg-dark-blue/10 rounded-xl flex items-center justify-center">
                  <Icon size={20} className="text-dark-blue" />
                </div>
                <span className="text-sm font-semibold text-gray-700">{label}</span>
              </button>
            ) : (
              <div
                key={label}
                className="bg-white rounded-2xl p-5 flex flex-col items-start gap-3 shadow-sm border border-gray-100 opacity-40 cursor-not-allowed"
              >
                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                  <Icon size={20} className="text-gray-400" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-gray-500">{label}</span>
                  <span className="block text-[10px] text-gray-400 mt-0.5">Em breve</span>
                </div>
              </div>
            ),
          )}
        </div>
      </div>

      {/* Ministério */}
      {member.ministerio_nome && (
        <div className="px-6 mt-6">
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
            {member.ministerio_logo ? (
              <Image
                src={member.ministerio_logo}
                alt={member.ministerio_nome}
                width={40}
                height={40}
                className="w-10 h-10 rounded-lg object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-dark-blue/10 flex items-center justify-center">
                <span className="text-dark-blue font-bold text-sm">
                  {member.ministerio_nome.charAt(0)}
                </span>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-400">Ministério</p>
              <p className="text-sm font-semibold text-gray-700">{member.ministerio_nome}</p>
            </div>
          </div>
        </div>
      )}

      <MobileBottomNav />
    </div>
  );
}
