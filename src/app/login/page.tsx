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
  const [successModal, setSuccessModal] = useState<any>({ isOpen: false, email: '' });
  const [errorModal, setErrorModal] = useState<any>({ isOpen: false, email: '' });
  const [loginErrorModal, setLoginErrorModal] = useState({ isOpen: false });
  const [contactData, setContactData] = useState({ ministerio: '', pastor: '', cpf: '', whatsapp: '', email: '' });

  useEffect(() => { if (error) { const t = setTimeout(() => setError(''), 3000); return () => clearTimeout(t); } }, [error]);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      if (!email || !password) { setError('Preencha todos os campos'); setLoading(false); return; }
      if (!supabaseRef.current) supabaseRef.current = createClient();
      const { data, error: err } = await supabaseRef.current!.auth.signInWithPassword({ email, password });
      if (!err && data?.user) {
        // Mantém loading=true durante a navegação para o botão ficar como "Entrando..."
        const token = data.session?.access_token;
        if (token) {
          try {
            const res = await fetch('/api/v1/trial/status', { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) { const trial = await res.json(); if (trial?.expired) { router.push('/trial-expirado'); return; } }
          } catch {}
        }
        router.push('/dashboard');
        return;
      }
      setLoginErrorModal({ isOpen: true });
      setLoading(false);
    } catch (e) { setError('Erro ao fazer login'); setLoading(false); }
  };

  const handleContactChange = (e: any) => {
    const { name, value } = e.target;
    const v = name === 'cpf' ? formatCpfOrCnpj(value) : name === 'whatsapp' ? formatPhone(value) : value;
    setContactData(p => ({ ...p, [name]: v }));
  };

  const handleContactSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (!contactData.ministerio || !contactData.pastor || !contactData.cpf || !contactData.whatsapp || !contactData.email) { setError('Preencha todos os campos'); return; }
      const resp = await fetch('/api/v1/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(contactData) });
      const r = await resp.json();
      if (!resp.ok) { if (r.error?.includes('existe')) { setErrorModal({ isOpen: true, email: contactData.email }); return; } setError(r.error); return; }
      setSuccessModal({ isOpen: true, email: contactData.email });
      setShowSignup(false);
      setContactData({ ministerio: '', pastor: '', cpf: '', whatsapp: '', email: '' });
    } catch (e) { setError('Erro ao registrar'); } finally { setLoading(false); }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        backgroundImage: 'url(/img/login2-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Serif+Display&display=swap');
      `}</style>

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/5"></div>

      <NotificationModal isOpen={successModal.isOpen} type="success" title="Sucesso!" message={`Email: ${successModal.email}`} onClose={() => { setSuccessModal({ isOpen: false, email: '' }); router.push('/'); }} autoClose={5000} />
      <NotificationModal isOpen={errorModal.isOpen} type="error" title="Email já registrado" message={errorModal.email} onClose={() => setErrorModal({ isOpen: false, email: '' })} showButton autoClose={4000} />
      <NotificationModal isOpen={loginErrorModal.isOpen} type="error" title="Credenciais incorretas" message="Email ou senha inválidos" onClose={() => setLoginErrorModal({ isOpen: false })} showButton autoClose={3500} />

      {/* Container do formulário */}
      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img src="/img/logo_modal.png" alt="Gestão Eklesia" className="h-16" />
        </div>

        {!showSignup && (
          <div className="rounded-3xl shadow-xl w-full bg-white/95 border border-slate-200 p-8">
            <h2 className="text-center text-xl font-bold mb-2 text-slate-900">ACESSO AO SISTEMA</h2>
            <p className="text-center text-sm text-slate-500 mb-6">Use suas credenciais cadastradas</p>
            <form onSubmit={handleSubmit}>
              {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" className="w-full px-4 py-3 border border-slate-200 rounded-lg bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 outline-none transition" />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Senha</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="*****" className="w-full px-4 py-3 border border-slate-200 rounded-lg bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 outline-none transition" />
              </div>
              <button type="submit" disabled={loading} className="w-full py-3 bg-emerald-700 text-white rounded-lg font-bold hover:bg-emerald-800 transition disabled:opacity-50">{loading ? 'Entrando...' : 'Entrar'}</button>
              <button type="button" onClick={() => router.push('/')} className="w-full mt-3 text-emerald-700 text-sm font-semibold hover:text-emerald-800">Voltar à Página Inicial</button>
            </form>
          </div>
        )}

        {showSignup && (
          <div className="rounded-3xl shadow-xl w-full bg-white/95 border border-slate-200 p-8">
            <h2 className="text-center text-xl font-bold mb-2 text-slate-900">SOLICITAR CONTATO</h2>
            <p className="text-center text-emerald-700 text-sm font-semibold mb-6">Apresentação + Teste Gratuito</p>
            <form onSubmit={handleContactSubmit}>
              {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}
              <input type="text" name="ministerio" value={contactData.ministerio} onChange={handleContactChange} placeholder="Nome da Instituição" className="w-full px-4 py-2 mb-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-200 outline-none text-sm" />
              <input type="text" name="pastor" value={contactData.pastor} onChange={handleContactChange} placeholder="Seu Nome Completo" className="w-full px-4 py-2 mb-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-200 outline-none text-sm" />
              <input type="text" name="cpf" value={contactData.cpf} onChange={handleContactChange} placeholder="CPF / CNPJ" className="w-full px-4 py-2 mb-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-200 outline-none text-sm" />
              <input type="text" name="whatsapp" value={contactData.whatsapp} onChange={handleContactChange} placeholder="WhatsApp (com DDD)" className="w-full px-4 py-2 mb-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-200 outline-none text-sm" />
              <input type="email" name="email" value={contactData.email} onChange={handleContactChange} placeholder="Email para contato" className="w-full px-4 py-2 mb-4 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-200 outline-none text-sm" />
              <div className="flex gap-3">
                <button type="submit" disabled={loading} className="flex-1 py-3 bg-emerald-700 text-white rounded-lg font-bold hover:bg-emerald-800 text-sm transition disabled:opacity-50">{loading ? 'Enviando...' : 'ENVIAR'}</button>
                <button type="button" onClick={() => { setShowSignup(false); setContactData({ ministerio: '', pastor: '', cpf: '', whatsapp: '', email: '' }); }} className="flex-1 py-3 border border-emerald-700 text-emerald-700 rounded-lg font-bold text-sm hover:bg-emerald-50 transition">VOLTAR</button>
              </div>
            </form>
          </div>
        )}

        <button type="button" onClick={() => router.push('/admin/login')} className="w-full mt-6 py-3 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-semibold transition">Acessar Área Admin</button>
      </div>
    </div>
  );
}
