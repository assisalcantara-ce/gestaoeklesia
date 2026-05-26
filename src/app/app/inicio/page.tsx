'use client';

/**
 * /app/inicio — Página inicial do portal do membro
 */

import { useMobileMember } from '@/providers/MobileMemberProvider';
import MobileHeader from '@/components/mobile/MobileHeader';
import MobileBottomNav from '@/components/mobile/MobileBottomNav';
import { useRouter } from 'next/navigation';
import {
  User,
  CreditCard,
  DollarSign,
  CalendarDays,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
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
  { href: '/app/perfil', label: 'Meu Perfil', icon: User, enabled: true },
  { href: '/app/carteirinha', label: 'Carteirinha', icon: CreditCard, enabled: true },
  { href: '#', label: 'Contribuir', icon: DollarSign, enabled: false },
  { href: '#', label: 'Eventos', icon: CalendarDays, enabled: false },
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

export default function InicioPage() {
  const { member, isLoading } = useMobileMember();
  const router = useRouter();

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
