'use client';

/**
 * /pastor/mais — Configurações, perfil e links do App do Pastor
 * (Etapa 1: implementação funcional)
 *
 * Exibe perfil do pastor e links para módulos do ERP.
 */

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import PastorBottomNav from '@/components/pastor/PastorBottomNav';
import {
  ArrowLeft,
  User,
  Bell,
  BookOpen,
  FileText,
  BarChart2,
  Shield,
  Settings,
  Info,
  ChevronRight,
  LogOut,
  Loader2,
} from 'lucide-react';

interface MenuItem {
  icon: React.ElementType;
  iconColor: string;
  label: string;
  sub?: string;
  onClick: () => void;
  badge?: string;
}

export default function PastorMaisPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [nome, setNome] = useState<string>('');
  const [cargo, setCargo] = useState<string>('Presidência');
  const [ministerio, setMinisterio] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || cancelled) return;

        const { data: mu } = await supabase
          .from('ministry_users')
          .select('role, display_name, ministry_id')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (cancelled) return;

        if (mu?.display_name) setNome(mu.display_name);
        else setNome(session.user.email?.split('@')[0] || 'Pastor');

        const roleLabel: Record<string, string> = {
          presidencia: 'Presidência',
          administrador: 'Administrador',
        };
        setCargo(roleLabel[mu?.role || ''] || 'Liderança');

        if (mu?.ministry_id) {
          const { data: min } = await supabase
            .from('ministries')
            .select('name')
            .eq('id', mu.ministry_id)
            .maybeSingle();
          if (!cancelled && min?.name) setMinisterio(min.name);
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  const MENU_ITEMS: MenuItem[] = [
    {
      icon: Bell,
      iconColor: 'text-amber-400',
      label: 'Notificações',
      sub: 'Alertas e lembretes',
      onClick: () => {},
    },
    {
      icon: BookOpen,
      iconColor: 'text-emerald-400',
      label: 'Relatório Espiritual',
      sub: 'Cultos, visitantes e atividades',
      onClick: () => router.push('/secretaria/relatorio-espiritual'),
    },
    {
      icon: FileText,
      iconColor: 'text-blue-400',
      label: 'Prestação de Contas Oficial',
      sub: 'Fechamentos e demonstrativos',
      onClick: () => router.push('/presidencia/prestacao-contas-oficial'),
    },
    {
      icon: BarChart2,
      iconColor: 'text-violet-400',
      label: 'Conselho Fiscal',
      sub: 'Pareceres e análises',
      onClick: () => router.push('/presidencia/conselho-fiscal'),
    },
    {
      icon: Shield,
      iconColor: 'text-rose-400',
      label: 'Central de Decisões',
      sub: 'Deliberações e pareceres',
      onClick: () => router.push('/presidencia'),
    },
    {
      icon: Settings,
      iconColor: 'text-slate-400',
      label: 'Configurações',
      sub: 'Preferências e conta',
      onClick: () => router.push('/configuracoes'),
    },
    {
      icon: Info,
      iconColor: 'text-slate-400',
      label: 'Sobre o Aplicativo',
      sub: 'Versão e informações',
      onClick: () => {},
    },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#0a1628] text-slate-100 pb-24">
      {/* Header */}
      <header
        className="flex items-center gap-3 px-5 border-b border-slate-800/60 bg-[#0d1f3c]"
        style={{
          paddingTop: 'max(env(safe-area-inset-top, 16px), 16px)',
          paddingBottom: '16px',
        }}
      >
        <button
          onClick={() => router.push('/pastor')}
          className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer active:scale-95 transition-all"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-base font-black text-white leading-tight">Mais</h1>
          <p className="text-[11px] text-slate-400">Perfil e configurações</p>
        </div>
      </header>

      <main className="flex-1 px-5 pt-5 space-y-4">
        {/* Perfil */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="text-amber-400 animate-spin" />
          </div>
        ) : (
          <div
            onClick={() => router.push('/configuracoes')}
            className="flex items-center gap-4 bg-[#111e35]/80 rounded-2xl p-4 border border-slate-700/40 cursor-pointer hover:border-slate-600/60 active:scale-[0.99] transition-all"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-700/10 border border-amber-500/30 flex items-center justify-center shrink-0">
              <User size={26} className="text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-black text-white truncate">{nome}</p>
              <p className="text-xs text-amber-400 font-semibold">{cargo}</p>
              {ministerio && (
                <p className="text-xs text-slate-400 mt-0.5 truncate">{ministerio}</p>
              )}
            </div>
            <ChevronRight size={18} className="text-slate-500 shrink-0" />
          </div>
        )}

        {/* Menu de itens */}
        <div className="bg-[#111e35]/60 rounded-2xl border border-slate-700/30 overflow-hidden divide-y divide-slate-800/60">
          {MENU_ITEMS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                onClick={item.onClick}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 active:scale-[0.99] transition-all cursor-pointer text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center shrink-0">
                  <Icon size={18} className={item.iconColor} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-200">{item.label}</p>
                  {item.sub && (
                    <p className="text-[11px] text-slate-500 mt-0.5">{item.sub}</p>
                  )}
                </div>
                {item.badge && (
                  <span className="text-[10px] font-black bg-amber-500 text-[#0a1628] px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
                <ChevronRight size={16} className="text-slate-600 shrink-0" />
              </button>
            );
          })}
        </div>

        {/* Botão de Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 bg-rose-500/10 border border-rose-500/25 rounded-2xl p-4 text-sm font-bold text-rose-400 hover:bg-rose-500/15 active:scale-[0.99] transition-all cursor-pointer"
        >
          <LogOut size={18} />
          Sair da conta
        </button>

        <p className="text-center text-[10px] text-slate-600 pb-2">
          Gestão Eklésia — App do Pastor v1.0
        </p>
      </main>

      <PastorBottomNav />
    </div>
  );
}
