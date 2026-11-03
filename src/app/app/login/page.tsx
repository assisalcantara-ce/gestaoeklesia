'use client';

/**
 * /app/login — Acesso do Membro via CPF + Data de Nascimento
 *
 * Reconstrução Visual Fiel ao Mockup Oficial Aprovado:
 * - Background: /img/bg_membro1.png (background-size: cover, center top, sem deformação).
 * - Logomarca: /icons/icon-mask2.png independente, centralizada, sem moldura ou fundo escuro.
 * - Título ("Portal do Membro") e Subtítulo ("Acesso exclusivo para membros da igreja")
 *   posicionados FORA do card, logo abaixo dos rostos da família e acima do card.
 * - Linha decorativa dourada 65x2px entre subtítulo e card.
 * - Card translúcido com borda superior em gradiente #1677FF -> #673BFF,
 *   posicionado na metade inferior da tela para preservar a visão da família.
 * - Formulário rigorosamente estilizado: campos com labels brancos 11px 700,
 *   inputs de 44px com font-size 16px (zero autozoom no iPhone).
 * - Botão com gradiente #1464FF -> #6236FF, feedback tátil ativo (scale 0.97).
 * - Rodapé sutil com copyright centralizado e safe-area.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { useMobileMember } from '@/providers/MobileMemberProvider';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { formatCpf, formatData } from '@/lib/mascaras';
import { Loader2, AlertCircle, LogIn } from 'lucide-react';
import Image from 'next/image';

export default function MobileLoginPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { refresh, isLinked } = useMobileMember();
  const router = useRouter();

  const [cpf, setCpf] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Capturar mensagens de erro vindas de redirecionamentos de outras rotas
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const err = params.get('error');
      if (err) {
        setError(err);
      }
    }
  }, []);

  // Se já autenticado e com cadastro de membro reconhecido, redireciona para a tela inicial
  useEffect(() => {
    if (!authLoading && user && isLinked) {
      router.replace('/app/inicio');
    }
  }, [user, authLoading, isLinked, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      setError('Informe um CPF válido com 11 dígitos.');
      return;
    }

    if (!dataNascimento || dataNascimento.length < 10) {
      setError('Informe sua data de nascimento completa no formato DD/MM/AAAA.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/v1/mobile/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          cpf: cleanCpf,
          data_nascimento: dataNascimento,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(
          data.error ||
            'Não encontramos um cadastro ativo com os dados informados. Verifique o CPF e a data de nascimento.'
        );
        return;
      }

      // Sincronizar sessão no cliente Supabase se retornada
      if (data.session) {
        try {
          const supabase = createClient();
          await supabase.auth.setSession(data.session);
          // Forçar atualização do MobileMemberContext para reconhecer o vínculo sem esperar
          await refresh();
        } catch (sessionErr) {
          console.error('[MOBILE_LOGIN] Erro ao sincronizar sessão cliente:', sessionErr);
        }
      }

      // Redireciona diretamente para o início do aplicativo
      router.replace('/app/inicio');
    } catch {
      setError('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-full flex-1 flex items-center justify-center bg-[#071D36]">
        <Loader2 size={36} className="text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh] w-full flex flex-col justify-between overflow-x-hidden select-none bg-[#071D36]">
      {/* ── BACKGROUND OFICIAL: bg_membro1.png ── */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <Image
          src="/img/bg_membro1.png"
          alt="Gestão Eklésia — Portal do Membro"
          fill
          priority
          quality={95}
          className="object-cover object-top"
          sizes="(max-width: 430px) 100vw, 430px"
        />
        {/* Degradê azul-marinho transparente sobre a região inferior preservando a família */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#061B35]/40 to-[#05162B]/95" />
      </div>

      {/* ── CONTEÚDO PRINCIPAL (Z-INDEX 10) ── */}
      <div
        className="relative z-10 flex-1 flex flex-col justify-between w-full max-w-[430px] mx-auto box-border"
        style={{
          paddingTop: 'calc(max(20px, env(safe-area-inset-top, 0px)) + 15px)',
          paddingBottom: 'max(14px, env(safe-area-inset-bottom, 0px))',
        }}
      >
        {/* ── 1. LOGOMARCA SUPERIOR INDEPENDENTE ── */}
        <div className="w-full flex justify-center pt-2 sm:pt-4">
          <div className="relative w-[112px] h-[80px]">
            <Image
              src="/icons/icon-mask2.png"
              alt="Logomarca Gestão Eklésia"
              fill
              priority
              className="object-contain drop-shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
              sizes="112px"
            />
          </div>
        </div>

        {/* ── 2. SEÇÃO INFERIOR: TÍTULO, SUBTÍTULO, DETALHE E CARD DE LOGIN ── */}
        <div className="w-full px-[18px] flex flex-col items-center mt-auto">
          {/* Título & Subtítulo (fora do card, posicionados entre 40% e 48% da viewport) */}
          <div className="w-full text-center mb-4">
            <h1 className="text-[25px] font-[800] text-[#FFFFFF] leading-tight tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]">
              Portal do Membro
            </h1>
            <p className="text-[12.5px] text-[#F1F5F9] font-medium mt-[7px] leading-snug drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]">
              Acesso exclusivo para membros da igreja
            </p>
            {/* Detalhe Dourado Decorativo 65px x 2px */}
            <div
              className="w-[65px] h-[2px] mx-auto mt-[12px] rounded-full shadow-sm"
              style={{
                background: 'linear-gradient(90deg, #D7A73B 0%, #FFE7A0 50%, #D7A73B 100%)',
              }}
            />
          </div>

          {/* ── 3. CARD DE LOGIN ── */}
          <div
            className="w-full rounded-[20px] p-[18px] relative overflow-hidden shadow-[0_14px_36px_rgba(5,22,43,0.55)] border border-slate-400/25"
            style={{
              backgroundColor: 'rgba(8, 25, 49, 0.88)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            {/* Borda superior de destaque: 3px gradiente horizontal #1677FF -> #673BFF */}
            <div
              className="absolute top-0 left-0 right-0 h-[3px]"
              style={{
                background: 'linear-gradient(90deg, #1677FF 0%, #673BFF 100%)',
              }}
            />

            {/* Cabeçalho do Card */}
            <div className="text-left mb-[17px]">
              <h2 className="text-[17px] font-[700] text-white tracking-tight leading-snug">
                Acesse sua conta
              </h2>
              <p className="text-[11px] text-[#CBD5E1] mt-[5px] leading-relaxed">
                Informe seu CPF e data de nascimento cadastrados na sua igreja.
              </p>
            </div>

            {/* Formulário Oficial */}
            <form onSubmit={handleSubmit} className="w-full flex flex-col">
              {/* Campo CPF */}
              <div className="w-full">
                <label
                  htmlFor="cpf"
                  className="block text-[11px] font-[700] text-white uppercase tracking-wider mb-[7px]"
                >
                  CPF
                </label>
                <input
                  id="cpf"
                  type="text"
                  inputMode="numeric"
                  autoComplete="username"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  className="w-full h-[44px] px-[13px] rounded-[10px] text-[16px] text-white placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#1677FF]/60 focus:border-[#1677FF] transition font-mono tracking-wide"
                  style={{
                    backgroundColor: '#081A32',
                    border: '1px solid #344762',
                  }}
                  required
                />
              </div>

              {/* Campo Data de Nascimento */}
              <div className="w-full mt-[13px]">
                <label
                  htmlFor="dataNascimento"
                  className="block text-[11px] font-[700] text-white uppercase tracking-wider mb-[7px]"
                >
                  Data de nascimento
                </label>
                <input
                  id="dataNascimento"
                  type="text"
                  inputMode="numeric"
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(formatData(e.target.value))}
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                  className="w-full h-[44px] px-[13px] rounded-[10px] text-[16px] text-white placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#1677FF]/60 focus:border-[#1677FF] transition font-mono tracking-wide"
                  style={{
                    backgroundColor: '#081A32',
                    border: '1px solid #344762',
                  }}
                  required
                />
              </div>

              {/* Mensagem de Erro */}
              {error && (
                <div className="mt-[13px] flex items-start gap-2 bg-rose-950/80 border border-rose-500/70 text-rose-200 text-xs p-2.5 rounded-xl">
                  <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-300" />
                  <span className="leading-tight">{error}</span>
                </div>
              )}

              {/* Botão Entrar no Aplicativo */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-[46px] mt-[17px] rounded-[11px] font-[700] text-[13px] text-white flex items-center justify-center gap-[8px] shadow-[0_4px_16px_rgba(20,100,255,0.35)] transition-all cursor-pointer active:scale-[0.97] disabled:opacity-50"
                style={{
                  background: 'linear-gradient(90deg, #1464FF 0%, #6236FF 100%)',
                }}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Acessando...</span>
                  </>
                ) : (
                  <>
                    <LogIn size={15} className="shrink-0" />
                    <span>Entrar no Aplicativo</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* ── 4. RODAPÉ INSTITUCIONAL ── */}
        <p className="text-center text-[#CBD5E1] text-[10px] pt-4 px-4 shrink-0 drop-shadow">
          © 2026 Gestão Eklésia • Aplicativo Oficial do Membro
        </p>
      </div>
    </div>
  );
}
