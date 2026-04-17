'use client';

import { useEffect, useRef, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { formatCpfOrCnpj, formatPhone, onlyDigits } from '@/lib/mascaras';
import { formatarPreco } from '@/config/plans';

type PlanoDB = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  price_annually: number | null;
  max_users: number;
  max_members: number;
  max_ministerios: number;
  additional_church_monthly_fee: number;
  additional_admin_users_per_church: number;
  has_advanced_reports: boolean;
  has_api_access: boolean;
  has_priority_support: boolean;
  has_custom_domain: boolean;
  has_white_label: boolean;
  has_automation: boolean;
  has_modulo_financeiro: boolean;
  has_modulo_eventos: boolean;
  has_modulo_reunioes: boolean;
  modulos: string[] | null;
};

function buildHighlights(plan: PlanoDB): string[] {
  const h: string[] = [];
  if (plan.max_users > 0) h.push(`Até ${plan.max_users} Usuários Administrativos`);
  if (plan.max_members > 0) h.push(`Até ${plan.max_members.toLocaleString('pt-BR')} Membros`);
  else h.push('Membros ilimitados');
  if (plan.max_ministerios > 0) h.push(`Até ${plan.max_ministerios} Igrejas inclusas`);
  if (plan.additional_church_monthly_fee > 0) {
    h.push(`R$ ${plan.additional_church_monthly_fee.toFixed(2).replace('.', ',')}/mês por igreja adicional`);
  }
  if (plan.additional_admin_users_per_church > 0) {
    h.push(`+${plan.additional_admin_users_per_church} admins por igreja adicional`);
  }
  // Módulos registrados no banco (coluna modulos)
  if (plan.modulos && plan.modulos.length > 0) {
    plan.modulos.forEach(m => h.push(m));
  } else {
    // fallback por booleans
    if (plan.has_modulo_financeiro) h.push('Módulo Financeiro');
    if (plan.has_modulo_eventos) h.push('Módulo Eventos');
    if (plan.has_modulo_reunioes) h.push('Módulo Reuniões');
    if (plan.has_advanced_reports) h.push('Relatórios Avançados');
    if (plan.has_priority_support) h.push('Suporte Prioritário');
  }
  return h;
}

const formatCep = (value: string) => {
  const digits = onlyDigits(value).slice(0, 8);
  if (!digits) return '';
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

export default function PreCadastroPage() {
  const searchParams = useSearchParams();
  const planParam = useMemo(() => (searchParams.get('plan') || '').toLowerCase().trim(), [searchParams]);
  const supabase = useMemo(() => createClient(), []);

  const [planos, setPlanos] = useState<PlanoDB[]>([]);
  const [planoAtivo, setPlanoAtivo] = useState<PlanoDB | null>(null);

  const [formData, setFormData] = useState<{
    ministry_name: string;
    responsible_name: string;
    cpf_cnpj: string;
    email: string;
    password: string;
    whatsapp: string;
    phone: string;
    website: string;
    address_zip: string;
    address_street: string;
    address_number: string;
    address_neighborhood: string;
    address_complement: string;
    address_city: string;
    address_state: string;
    description: string;
    plan: string;
  }>({
    ministry_name: '',
    responsible_name: '',
    cpf_cnpj: '',
    email: '',
    password: '',
    whatsapp: '',
    phone: '',
    website: '',
    address_zip: '',
    address_street: '',
    address_number: '',
    address_neighborhood: '',
    address_complement: '',
    address_city: '',
    address_state: '',
    description: '',
    plan: planParam || 'basic'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const successMessageRef = useRef<HTMLDivElement>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState('');
  const lastCepLookup = useRef('');

  // Busca planos ativos do banco
  useEffect(() => {
    supabase
      .from('subscription_plans')
      .select('id,name,slug,description,price_monthly,price_annually,max_users,max_members,max_ministerios,additional_church_monthly_fee,additional_admin_users_per_church,has_api_access,has_advanced_reports,has_priority_support,has_custom_domain,has_white_label,has_automation,has_modulo_financeiro,has_modulo_eventos,has_modulo_reunioes,modulos')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('price_monthly', { ascending: true })
      .then(({ data }: { data: PlanoDB[] | null }) => {
        if (!data?.length) return;
        setPlanos(data);
        const matched =
          data.find((p) => p.slug?.toLowerCase() === planParam) ||
          data.find((p) => p.name?.toLowerCase() === planParam) ||
          data[0];
        setPlanoAtivo(matched);
        setFormData((prev) => ({ ...prev, plan: matched?.slug || matched?.name || prev.plan }));
      });
  }, [supabase, planParam]);

  // Sincroniza planoAtivo ao mudar select
  useEffect(() => {
    if (!planos.length) return;
    const matched = planos.find((p) => p.slug === formData.plan || p.name?.toLowerCase() === formData.plan);
    setPlanoAtivo(matched ?? null);
  }, [formData.plan, planos]);

  useEffect(() => {
    const cepDigits = onlyDigits(formData.address_zip);

    if (cepDigits.length !== 8) {
      setCepLoading(false);
      setCepError('');
      lastCepLookup.current = '';
      return;
    }

    if (cepDigits === lastCepLookup.current) return;

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setCepLoading(true);
      setCepError('');

      try {
        const res = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`, {
          signal: controller.signal
        });

        if (!res.ok) {
          throw new Error('Falha ao consultar CEP');
        }

        const data = await res.json();
        if (data?.erro) {
          setCepError('CEP nao encontrado');
          return;
        }

        lastCepLookup.current = cepDigits;
        setFormData((prev) => ({
          ...prev,
          address_street: data.logradouro || prev.address_street,
          address_neighborhood: data.bairro || prev.address_neighborhood,
          address_city: data.localidade || prev.address_city,
          address_state: data.uf || prev.address_state
        }));
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        setCepError('Nao foi possivel consultar o CEP');
      } finally {
        setCepLoading(false);
      }
    }, 350);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [formData.address_zip]);

  useEffect(() => {
    if (success && successMessageRef.current) {
      successMessageRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [success]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (name === 'cpf_cnpj') {
      setFormData((prev) => ({ ...prev, cpf_cnpj: formatCpfOrCnpj(value) }));
      return;
    }

    if (name === 'whatsapp' || name === 'phone') {
      setFormData((prev) => ({ ...prev, [name]: formatPhone(value) }));
      return;
    }

    if (name === 'address_zip') {
      setFormData((prev) => ({ ...prev, address_zip: formatCep(value) }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!formData.ministry_name.trim()) {
      setError('Nome da instituição é obrigatório.');
      return;
    }

    if (!formData.responsible_name.trim()) {
      setError('Nome do responsável é obrigatório.');
      return;
    }

    if (!formData.cpf_cnpj.trim()) {
      setError('CPF/CNPJ é obrigatório.');
      return;
    }

    if (!formData.whatsapp.trim()) {
      setError('WhatsApp é obrigatório.');
      return;
    }

    if (!formData.email.trim()) {
      setError('Email é obrigatório.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Email inválido.');
      return;
    }

    if (!formData.password.trim() || formData.password.length < 6) {
      setError('Senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/v1/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ministerio: formData.ministry_name,
          pastor: formData.responsible_name,
          cpf: formData.cpf_cnpj,
          whatsapp: formData.whatsapp,
          email: formData.email,
          senha: formData.password,
          phone: formData.phone,
          website: formData.website,
          responsible_name: formData.responsible_name,
          address_zip: formData.address_zip,
          address_street: formData.address_street,
          address_number: formData.address_number,
          address_neighborhood: formData.address_neighborhood,
          address_complement: formData.address_complement,
          address_city: formData.address_city,
          address_state: formData.address_state,
          description: formData.description,
          plan: formData.plan
        })
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data?.error || 'Erro ao enviar. Tente novamente.');
        setLoading(false);
        return;
      }

      setSuccess(true);
      setFormData((prev) => ({
        ...prev,
        ministry_name: '',
        responsible_name: '',
        cpf_cnpj: '',
        email: '',
        password: '',
        whatsapp: '',
        phone: '',
        website: '',
        address_zip: '',
        address_street: '',
        address_number: '',
        address_neighborhood: '',
        address_complement: '',
        address_city: '',
        address_state: '',
        description: ''
      }));
    } catch (err) {
      setError('Erro ao enviar. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f2ea] text-[#1f1b16] relative overflow-hidden">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Cormorant+Garamond:wght@500;600;700&display=swap');
        body {
          font-family: 'Space Grotesk', 'Segoe UI', sans-serif;
          background: radial-gradient(circle at top, #f8f5ef 0%, #eef5f2 55%, #f6f2ea 100%);
        }
        .landing-title {
          font-family: 'Cormorant Garamond', 'Georgia', serif;
          letter-spacing: -0.02em;
        }
        .landing-orb {
          position: absolute;
          border-radius: 9999px;
          filter: blur(80px);
          opacity: 0.55;
          pointer-events: none;
        }
        .landing-orb.orb-a {
          width: 420px;
          height: 420px;
          background: #ccebe3;
          top: -120px;
          left: -140px;
        }
        .landing-orb.orb-b {
          width: 520px;
          height: 520px;
          background: #f3d8bf;
          bottom: -220px;
          right: -160px;
        }
      `}</style>
      <div className="landing-orb orb-a" />
      <div className="landing-orb orb-b" />
      <div className="max-w-6xl mx-auto px-6 py-16 relative">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] items-start">
          <div className="space-y-6">
            <a
              href="/"
              className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700 hover:text-emerald-800 transition"
            >
              <span aria-hidden="true">←</span>
              Voltar ao site
            </a>
            <span className="inline-flex items-center px-4 py-1 rounded-full bg-emerald-50 text-xs uppercase tracking-[0.4em] text-emerald-700 border border-emerald-100">
              Pré-cadastro ministerial
            </span>
            <h1 className="landing-title text-4xl md:text-5xl font-bold leading-tight">
              Sua igreja pronta para crescer com organização e clareza.
            </h1>
            <p className="text-lg text-slate-600">
              Preencha os dados da igreja ou ministério e crie o acesso para iniciar o período de teste.
            </p>

            <div className="rounded-2xl bg-white/90 border border-[#e7e0d6] p-6 space-y-4 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm uppercase tracking-[0.3em] text-emerald-700">Plano escolhido</span>
                <span className="text-sm text-slate-500">07 dias grátis</span>
              </div>
              <p className="text-3xl font-bold text-slate-900">
                {planoAtivo?.name || 'Carregando...'}
              </p>
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  {planoAtivo?.description || ''}
                </p>
                {planoAtivo && (
                  <ul className="space-y-2 text-xs text-slate-600">
                    {buildHighlights(planoAtivo).map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-white/80 border border-[#e7e0d6] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm uppercase tracking-[0.3em] text-emerald-700">Valores após o período</span>
              </div>
              <p className="text-sm text-slate-600">
                Após o período de testes, você poderá assinar um dos planos abaixo.
              </p>
              <div className="space-y-3">
                {planos.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-slate-700 text-sm">
                    <span className="font-semibold text-slate-900">{p.name}</span>
                    <span>{formatarPreco(p.price_monthly)}/mês</span>
                  </div>
                ))}
              </div>
              {(() => {
                const comAnual = planos.find((p) => p.price_annually && p.price_annually > 0);
                return comAnual ? (
                  <p className="text-xs text-slate-500">
                    Valores anuais a partir de {formatarPreco(comAnual.price_annually!)}/ano.
                  </p>
                ) : null;
              })()}
            </div>

            <a
              href="https://wa.me/5591981755021"
              target="_blank"
              rel="noreferrer"
              className="block rounded-2xl bg-white/80 border border-[#e7e0d6] p-4 hover:border-emerald-200 hover:bg-emerald-50/60 transition"
            >
              <p className="text-sm font-semibold flex items-center gap-2 text-slate-900">
                <img
                  src="/img/zap1.png"
                  alt="WhatsApp"
                  className="h-4 w-4"
                />
                DÚVIDAS? Fale com nossa equipe comercial. Clique aqui...
              </p>
              <p className="text-xs text-slate-600 mt-2">Fale com nosso time: (91) 98175-5021</p>
            </a>
          </div>

          <form onSubmit={handleSubmit} className="bg-white/95 text-slate-900 rounded-3xl p-8 shadow-2xl space-y-6 border border-[#e7e0d6]">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-700">Dados da igreja</p>
              <h2 className="text-2xl font-bold text-slate-900 mt-2">Formulário de pré-cadastro</h2>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div ref={successMessageRef} className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                Dados enviados com sucesso! Nosso time vai entrar em contato.
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nome da igreja ou ministério *</label>
                <input
                  name="ministry_name"
                  value={formData.ministry_name}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 focus:outline-none"
                  placeholder="Ex: Igreja Comunidade Viva"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">CPF / CNPJ *</label>
                <input
                  name="cpf_cnpj"
                  value={formData.cpf_cnpj}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 focus:outline-none"
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Plano</label>
                <select
                  name="plan"
                  value={formData.plan}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 focus:outline-none"
                >
                  {planos.map((p) => (
                    <option key={p.id} value={p.slug || p.name.toLowerCase()}>
                      {p.name} — {formatarPreco(p.price_monthly)}/mês
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Nome do pastor ou dirigente *</label>
              <input
                name="responsible_name"
                value={formData.responsible_name}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 focus:outline-none"
                placeholder="Nome completo do responsavel"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Email do responsável *</label>
                <input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 focus:outline-none"
                  placeholder="contato@igreja.com"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Senha de acesso *</label>
                <input
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 focus:outline-none"
                  placeholder="Crie uma senha segura"
                />
                <p className="text-xs text-slate-500 mt-1">Senha do acesso expira em 7 dias se o plano nao for ativado.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">WhatsApp do responsável *</label>
                <input
                  name="whatsapp"
                  value={formData.whatsapp}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 focus:outline-none"
                  placeholder="(11) 99000-0000"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Telefone</label>
                <input
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 focus:outline-none"
                  placeholder="(11) 3000-0000"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Site ou rede social</label>
                <input
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 focus:outline-none"
                  placeholder="https://"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">CEP</label>
                <input
                  name="address_zip"
                  value={formData.address_zip}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 focus:outline-none"
                  placeholder="00000-000"
                />
                {cepLoading && <p className="text-xs text-slate-500 mt-1">Buscando endereco...</p>}
                {cepError && <p className="text-xs text-red-600 mt-1">{cepError}</p>}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1">Rua</label>
                <input
                  name="address_street"
                  value={formData.address_street}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 focus:outline-none"
                  placeholder="Rua das Flores"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Número</label>
                <input
                  name="address_number"
                  value={formData.address_number}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 focus:outline-none"
                  placeholder="123"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Bairro</label>
                <input
                  name="address_neighborhood"
                  value={formData.address_neighborhood}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 focus:outline-none"
                  placeholder="Bairro"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Cidade</label>
                <input
                  name="address_city"
                  value={formData.address_city}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 focus:outline-none"
                  placeholder="Cidade"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Complemento</label>
                <input
                  name="address_complement"
                  value={formData.address_complement}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 focus:outline-none"
                  placeholder="Apto 42"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Estado (UF)</label>
                <select
                  name="address_state"
                  value={formData.address_state}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 focus:outline-none"
                >
                  <option value="">Selecione...</option>
                  <option value="AC">AC</option>
                  <option value="AL">AL</option>
                  <option value="AP">AP</option>
                  <option value="AM">AM</option>
                  <option value="BA">BA</option>
                  <option value="CE">CE</option>
                  <option value="DF">DF</option>
                  <option value="ES">ES</option>
                  <option value="GO">GO</option>
                  <option value="MA">MA</option>
                  <option value="MT">MT</option>
                  <option value="MS">MS</option>
                  <option value="MG">MG</option>
                  <option value="PA">PA</option>
                  <option value="PB">PB</option>
                  <option value="PR">PR</option>
                  <option value="PE">PE</option>
                  <option value="PI">PI</option>
                  <option value="RJ">RJ</option>
                  <option value="RN">RN</option>
                  <option value="RS">RS</option>
                  <option value="RO">RO</option>
                  <option value="RR">RR</option>
                  <option value="SC">SC</option>
                  <option value="SP">SP</option>
                  <option value="SE">SE</option>
                  <option value="TO">TO</option>
                </select>
              </div>
            </div>

            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Conte sobre a igreja</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 focus:outline-none"
                rows={4}
                placeholder="Conte um pouco sobre a igreja e seus departamentos"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-emerald-700 px-4 py-3 text-white font-semibold hover:bg-emerald-800 transition disabled:opacity-60"
            >
              {loading ? 'Enviando...' : 'Enviar pré-cadastro'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
