'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import NotificationModal from '@/components/NotificationModal';
import { formatCpfOrCnpj, formatPhone } from '@/lib/mascaras';

export default function LoginPage() {
  const router = useRouter();
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSignup, setShowSignup] = useState(false);
  const [successModal, setSuccessModal] = useState<{
    isOpen: boolean;
    email: string;
    expiry: string;
  }>({
    isOpen: false,
    email: '',
    expiry: ''
  });
  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    email: string;
  }>({
    isOpen: false,
    email: ''
  });
  const [loginErrorModal, setLoginErrorModal] = useState<{
    isOpen: boolean;
  }>({
    isOpen: false
  });
  const [contactData, setContactData] = useState({
    ministerio: '',
    pastor: '',
    cpf: '',
    whatsapp: '',
    email: ''
  });

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!email || !password) {
        setError('Por favor, preencha todos os campos');
        setLoading(false);
        return;
      }

      if (!supabaseRef.current) {
        supabaseRef.current = createClient();
      }

      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        console.error('[LOGIN]  Variveis de ambiente do Supabase nao configuradas');
        setError('Aplicacao nao esta configurada corretamente. Contate o administrador.');
        setLoading(false);
        return;
      }

      const { data: authData, error: authError } = await supabaseRef.current.auth.signInWithPassword({
        email,
        password,
      });

      if (!authError && authData?.user) {
        router.push('/dashboard');
        return;
      }

      setLoginErrorModal({ isOpen: true });
      setLoading(false);
      return;
    } catch (err) {
      console.error('[LOGIN] Erro geral:', err);
      setError('Erro ao fazer login. Verifique a conexao e tente novamente.');
      setLoading(false);
    }
  };

  const handleContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const nextValue = name === 'cpf'
      ? formatCpfOrCnpj(value)
      : name === 'whatsapp'
        ? formatPhone(value)
        : value;
    setContactData(prev => ({
      ...prev,
      [name]: nextValue
    }));
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!contactData.ministerio.trim()) {
        setError('Nome do Ministerio e obrigatorio');
        setLoading(false);
        return;
      }

      if (!contactData.pastor.trim()) {
        setError('Nome do Pastor e obrigatorio');
        setLoading(false);
        return;
      }

      if (!contactData.cpf.trim()) {
        setError('CPF e obrigatorio');
        setLoading(false);
        return;
      }

      if (!contactData.whatsapp.trim()) {
        setError('WhatsApp e obrigatorio');
        setLoading(false);
        return;
      }

      if (!contactData.email.trim()) {
        setError('Email e obrigatorio');
        setLoading(false);
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactData.email)) {
        setError('Email invalido');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/v1/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ministerio: contactData.ministerio,
          pastor: contactData.pastor,
          cpf: contactData.cpf,
          whatsapp: contactData.whatsapp,
          email: contactData.email,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.error?.includes('ja foi registrado') || result.error?.includes('already been registered') || result.error?.includes('ja existe')) {
          setErrorModal({
            isOpen: true,
            email: contactData.email
          });
          setLoading(false);
          return;
        }

        setError(result.error || 'Erro ao registrar contato');
        setLoading(false);
        return;
      }

      setError('');
      setSuccessModal({
        isOpen: true,
        email: contactData.email,
        expiry: ''
      });

      setShowSignup(false);
      setContactData({ ministerio: '', pastor: '', cpf: '', whatsapp: '', email: '' });
      setLoading(false);
    } catch (err) {
      console.error('Erro ao registrar contato:', err);
      setError('Erro ao registrar contato. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className="login-hero flex flex-col items-center justify-center min-h-screen px-4">
      <NotificationModal
        isOpen={successModal.isOpen}
        type="success"
        title="Solicitacao Recebida com Sucesso!"
        message={`Obrigado por se interessar no Gestao Servus!\n\nNossa equipe entrara em contato em breve.\n\nEmail: ${successModal.email}`}
        onClose={() => {
          setSuccessModal({ isOpen: false, email: '', expiry: '' });
          router.push('/');
        }}
        autoClose={5000}
      />

      <NotificationModal
        isOpen={errorModal.isOpen}
        type="error"
        title="Email ja Registrado"
        message={`O email ${errorModal.email} ja foi registrado.`}
        onClose={() => setErrorModal({ isOpen: false, email: '' })}
        showButton={true}
        autoClose={4000}
      />

      <NotificationModal
        isOpen={loginErrorModal.isOpen}
        type="error"
        title="Credenciais incorretas"
        message="Email ou senha incorretos."
        onClose={() => setLoginErrorModal({ isOpen: false })}
        showButton={true}
        autoClose={3500}
      />

      <div className="md:hidden flex justify-center items-center mb-6">
        <img
          src="/img/logo44.png"
          alt="Gestao Servus"
          className="w-[200px] drop-shadow-xl logo-animate"
        />
      </div>

      <div className="flex w-full max-w-6xl items-center justify-center gap-8">
        <div className="hidden md:flex md:w-1/2 justify-center items-center">
          <img
            src="/img/logo44.png"
            alt="Gestao Servus"
            className="w-[350px] drop-shadow-xl logo-animate"
          />
        </div>

        <div className="w-full md:w-1/2 flex flex-col items-center justify-center">
          {!showSignup && (
            <div className="rounded-2xl shadow-2xl w-full max-w-sm backdrop-blur-sm p-6 mx-4" style={{ backgroundColor: '#4A6FA5E6', color: 'white' }}>
              <h2 className="text-center text-xl font-bold mb-6 text-white">ACESSO AO SISTEMA</h2>

              <form onSubmit={handleSubmit}>
                {error && (
                  <div className="mb-6 p-4 bg-red-500/90 border-2 border-red-300 rounded-xl shadow-lg flex items-start gap-3">
                    <span className="text-white text-xl font-bold flex-shrink-0 mt-0.5">!</span>
                    <div>
                      <p className="text-white font-bold text-sm">Erro de Acesso</p>
                      <p className="text-white/90 text-sm mt-1">{error}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-2 mb-4">
                  <label htmlFor="email" className="block text-sm font-semibold text-white">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full px-4 py-3 rounded-lg bg-white/25 border border-white/40 text-white placeholder:text-white/50 focus:border-[#f9b233] focus:outline-none focus:ring-2 focus:ring-[#f9b233]/60 transition text-base font-medium"
                  />
                </div>

                <div className="space-y-2 mb-6">
                  <label htmlFor="password" className="block text-sm font-semibold text-white">
                    Senha
                  </label>
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="********"
                    className="w-full px-4 py-3 rounded-lg bg-white/25 border border-white/40 text-white placeholder:text-white/50 focus:border-[#f9b233] focus:outline-none focus:ring-2 focus:ring-[#f9b233]/60 transition text-base font-medium"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-6 px-4 py-3 bg-[#f9b233] text-[#123b63] rounded-lg font-bold text-base hover:bg-[#f5a800] transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {loading ? 'Entrando...' : 'Entrar'}
                </button>

                <div className="mt-4 text-center">
                  <p className="text-xs text-white/70">
                    <button
                      type="button"
                      onClick={() => {
                        router.push('/');
                      }}
                      className="text-[#ffc547] hover:text-[#ffd966] transition font-semibold"
                    >
                      Voltar a Pagina Inicial
                    </button>
                  </p>
                </div>
              </form>
            </div>
          )}

          {showSignup && (
            <div className="bg-[#4A6FA5] text-white rounded-2xl shadow-2xl w-full max-w-sm backdrop-blur-sm p-8 mx-4">
              <h2 className="text-center text-2xl font-bold mb-2 text-white">SOLICITAR CONTATO</h2>
              <p className="text-center text-[#ffc547] text-sm font-semibold mb-6">Apresentacao + Teste Gratuito</p>

              <form onSubmit={handleContactSubmit}>
                {error && (
                  <div className="p-4 bg-red-50/20 border border-red-300/40 rounded-lg text-sm text-white font-medium mb-5">
                    {error}
                  </div>
                )}

                <div className="space-y-3 mb-4">
                  <input
                    type="text"
                    name="ministerio"
                    value={contactData.ministerio}
                    onChange={handleContactChange}
                    placeholder="Nome da Instituição"
                    className="w-full px-4 py-3 rounded-lg bg-white text-[#123b63] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f9b233] transition text-sm font-medium"
                  />
                </div>

                <div className="space-y-3 mb-4">
                  <input
                    type="text"
                    name="pastor"
                    value={contactData.pastor}
                    onChange={handleContactChange}
                    placeholder="Seu Nome Completo"
                    className="w-full px-4 py-3 rounded-lg bg-white text-[#123b63] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f9b233] transition text-sm font-medium"
                  />
                </div>

                <div className="space-y-3 mb-4">
                  <input
                    type="text"
                    name="cpf"
                    value={contactData.cpf}
                    onChange={handleContactChange}
                    placeholder="CPF / CNPJ"
                    className="w-full px-4 py-3 rounded-lg bg-white text-[#123b63] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f9b233] transition text-sm font-medium"
                  />
                </div>

                <div className="space-y-3 mb-4">
                  <input
                    type="text"
                    name="whatsapp"
                    value={contactData.whatsapp}
                    onChange={handleContactChange}
                    placeholder="WhatsApp (com DDD)"
                    className="w-full px-4 py-3 rounded-lg bg-white text-[#123b63] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f9b233] transition text-sm font-medium"
                  />
                </div>

                <div className="space-y-3 mb-5">
                  <input
                    type="email"
                    name="email"
                    value={contactData.email}
                    onChange={handleContactChange}
                    placeholder="Email para contato"
                    className="w-full px-4 py-3 rounded-lg bg-white text-[#123b63] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f9b233] transition text-sm font-medium"
                  />
                </div>

                <div className="flex gap-3 mt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-3 bg-[#f9b233] text-[#123b63] rounded-lg font-bold text-sm hover:bg-[#f5a800] transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    {loading ? 'Enviando...' : 'SOLICITAR CONTATO'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSignup(false);
                      setContactData({ ministerio: '', pastor: '', cpf: '', whatsapp: '', email: '' });
                      setError('');
                    }}
                    className="flex-1 px-4 py-3 bg-[#0284c7] text-white rounded-lg font-bold text-sm hover:bg-[#0369a1] transition shadow-lg"
                  >
                    VOLTAR
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="w-full max-w-sm mx-4 mt-6">
            <button
              type="button"
              onClick={() => router.push('/admin/login')}
              className="w-full px-4 py-3 bg-[#123b63] text-white rounded-xl border border-white/10 hover:bg-[#0f2a45] transition font-semibold"
            >
              Acessar Area Admin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
