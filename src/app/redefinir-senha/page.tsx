'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { BRAND } from '@/config/brand';
import { createClient } from '@/lib/supabase-client';
import PremiumCard from '@/components/ui/PremiumCard';
import PremiumButton from '@/components/ui/PremiumButton';
import PremiumInput from '@/components/ui/PremiumInput';
import { GRADIENTS } from '@/config/tokens';
import { Eye, EyeOff, Lock, CheckCircle, AlertCircle } from 'lucide-react';

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validatingSession, setValidatingSession] = useState(true);
  const [isSessionValid, setIsSessionValid] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!supabaseRef.current) {
      supabaseRef.current = createClient();
    }
    const supabase = supabaseRef.current;

    // Escuta evento PASSWORD_RECOVERY ou valida sessão de recovery ativa
    const checkRecoverySession = async () => {
      setValidatingSession(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setIsSessionValid(true);
      } else {
        // Aguarda um momento caso o Supabase Auth processe o hash da URL
        const { data: authListener } = supabase.auth.onAuthStateChange(
          async (_event: string, currentSession: unknown) => {
            if (_event === 'PASSWORD_RECOVERY' || currentSession) {
              setIsSessionValid(true);
            }
          }
        );

        setTimeout(async () => {
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          if (retrySession) {
            setIsSessionValid(true);
          } else {
            setIsSessionValid(false);
          }
          setValidatingSession(false);
          authListener?.subscription.unsubscribe();
        }, 1500);
        return;
      }
      setValidatingSession(false);
    };

    void checkRecoverySession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!password || !confirmPassword) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }

    if (password.length < 6) {
      setError('A nova senha deve possuir no mínimo 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (!supabaseRef.current) {
        supabaseRef.current = createClient();
      }
      const supabase = supabaseRef.current;

      // 1. Atualizar senha no Supabase Auth
      const { data: userData, error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        throw updateError;
      }

      const userEmail = userData.user?.email || 'desconhecido';

      // 2. Registrar auditoria do evento de alteração
      try {
        await fetch('/api/v1/audit-logs/public', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            acao: 'editar',
            modulo: 'autenticacao',
            descricao: 'Redefinição de senha concluída com sucesso',
            usuario_email: userEmail,
            status: 'sucesso',
          }),
        });
      } catch {
        // Ignora erro secundário de auditoria
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Erro ao redefinir a senha. O link pode ter expirado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: GRADIENTS.LOGIN_BACKGROUND }}
    >
      <div className="w-full max-w-md">
        {/* Header institucional */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/20 mb-3 shadow-xl">
            <Image
              src={BRAND.logoHorizontal}
              alt={BRAND.name}
              width={160}
              height={40}
              priority
              className="h-10 w-auto object-contain"
            />
          </div>
          <p className="text-white/80 text-xs font-semibold tracking-wide uppercase">
            Gestão que fortalece sua igreja
          </p>
        </div>

        {/* Card Principal */}
        <PremiumCard className="p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-[#0B3B82]">
              Redefinir Senha
            </h1>
            <p className="text-slate-500 text-xs mt-1">
              Crie uma nova senha de acesso para sua conta
            </p>
          </div>

          {validatingSession ? (
            <div className="py-12 text-center text-slate-500 text-xs font-semibold animate-pulse space-y-3">
              <div className="w-8 h-8 border-2 border-[#0B3B82] border-t-transparent rounded-full animate-spin mx-auto" />
              <p>Validando link de recuperação...</p>
            </div>
          ) : !isSessionValid ? (
            <div className="py-6 space-y-5 text-center">
              <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto text-2xl">
                <AlertCircle className="w-8 h-8 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Link Inválido ou Expirado
                </h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  O link de redefinição de senha é de uso único e pode ter expirado ou já ter sido utilizado.
                </p>
              </div>
              <div className="pt-2">
                <PremiumButton
                  type="button"
                  onClick={() => router.push('/login')}
                  className="w-full"
                >
                  Voltar para o Login
                </PremiumButton>
              </div>
            </div>
          ) : success ? (
            <div className="py-6 space-y-5 text-center">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Senha Alterada com Sucesso!
                </h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Sua senha foi redefinida com segurança. Você já pode acessar a plataforma utilizando suas novas credenciais.
                </p>
              </div>
              <div className="pt-2">
                <PremiumButton
                  type="button"
                  onClick={() => router.push('/login')}
                  className="w-full"
                >
                  Ir para o Login
                </PremiumButton>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
                  {error}
                </div>
              )}

              <PremiumInput
                type={showPassword ? 'text' : 'password'}
                label="Nova Senha"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={<Lock className="w-4 h-4" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-400 hover:text-slate-600 transition flex items-center justify-center"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                required
                disabled={loading}
              />

              <PremiumInput
                type={showPassword ? 'text' : 'password'}
                label="Confirmar Nova Senha"
                placeholder="Repita a nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                icon={<Lock className="w-4 h-4" />}
                required
                disabled={loading}
              />

              <PremiumButton
                type="submit"
                loading={loading}
                disabled={loading}
                className="w-full mt-2"
              >
                Salvar Nova Senha
              </PremiumButton>
            </form>
          )}
        </PremiumCard>

        {/* Rodapé institucional */}
        <div className="mt-8 text-center text-[10px] text-white/60 tracking-wider space-y-1 select-none">
          <p>© Gestão Eklésia. Todos os direitos reservados.</p>
          <p>Tecnologia Alcântara Sistemas</p>
        </div>
      </div>
    </div>
  );
}
