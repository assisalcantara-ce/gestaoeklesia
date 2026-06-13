'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { useAuth } from '@/providers/AuthProvider';
import { useUserContext } from '@/hooks/useUserContext';
import { GRADIENTS } from '@/config/tokens';
import { THEME } from '@/config/theme';

const NIVEL_LABEL: Record<string, string> = {
  administrador: 'Administrador',
  financeiro: 'Financeiro',
  admin_local: 'Admin Local',
  financeiro_local: 'Fin. Local',
  supervisor: 'Supervisor',
  viewer: 'Visualizador',
  presidencia: 'Presidência',
  conselho_fiscal: 'Conselho Fiscal',
};

export default function AppHeader() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { user } = useAuth();
  const userCtx = useUserContext();
  const [dataAtual, setDataAtual] = useState('');
  const [ministryName, setMinistryName] = useState('');

  // Atualização da data/hora
  useEffect(() => {
    const formatDateTime = () => {
      const d = new Date();
      const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
      const meses = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
      ];
      return `${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()} - ${String(
        d.getHours()
      ).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };
    setDataAtual(formatDateTime());
    const interval = setInterval(() => setDataAtual(formatDateTime()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Busca o nome do ministério
  useEffect(() => {
    if (!userCtx.ministryId) return;
    const fetchMinistryName = async () => {
      const { data } = await supabase
        .from('ministries')
        .select('nome')
        .eq('id', userCtx.ministryId)
        .maybeSingle();
      if (data?.nome) {
        setMinistryName(data.nome);
      }
    };
    fetchMinistryName();
  }, [userCtx.ministryId, supabase]);

  const handleLogout = () => {
    supabase.auth.signOut().finally(() => router.push('/'));
  };

  const userDisplayName = user?.user_metadata?.full_name || user?.email || 'Usuário';
  const userEmail = user?.email || '';
  const nivel = userCtx.nivel || 'viewer';

  // Obter a primeira letra para o avatar
  const avatarLetter = userDisplayName.charAt(0).toUpperCase();

  return (
    <header
      className="sticky top-0 z-20 px-6 py-4 shadow-md text-white shrink-0 flex items-center justify-between gap-4"
      style={{ background: GRADIENTS.HEADER_BACKGROUND }}
    >
      <div>
        <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest leading-none">
          Seja bem-vindo(a)
        </p>
        <h1 className="text-base font-extrabold tracking-tight mt-1 leading-tight select-none">
          {ministryName || 'Carregando ministério...'}
        </h1>
        <p className="text-[10px] text-white/60 font-medium mt-1">
          {dataAtual}
        </p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {/* User Info (Desktop only) */}
        <div className="text-right hidden md:block select-none">
          <p className="text-xs font-bold leading-tight">{userDisplayName}</p>
          <p className="text-[10px] text-white/60 font-semibold mt-0.5">{userEmail}</p>
        </div>

        {/* Nível de Acesso (Badge) */}
        <span
          className="text-[10px] font-extrabold px-3 py-1 rounded-full text-white/90 shrink-0 select-none border border-white/20 bg-white/10"
        >
          {NIVEL_LABEL[nivel] ?? nivel}
        </span>

        {/* Avatar */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-slate-800 border border-white/20 select-none shadow-sm shrink-0"
          style={{ backgroundColor: THEME.colors.golden }}
        >
          {avatarLetter}
        </div>

        {/* Sair Button */}
        <button
          onClick={handleLogout}
          className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600 border border-red-500/30 hover:border-red-600 text-white rounded-lg text-[11px] font-bold tracking-wide transition-all duration-150 active:scale-95"
        >
          Sair
        </button>
      </div>
    </header>
  );
}
