'use client';

import { useEffect, useRef, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { formatCpfOrCnpj, formatPhone, onlyDigits } from '@/lib/mascaras';

const PLAN_OPTIONS = [
  { value: 'starter', label: 'Starter' },
  { value: 'intermediario', label: 'Intermediário' },
  { value: 'profissional', label: 'Profissional' },
  { value: 'expert', label: 'Expert' }
];

const PLAN_DETAILS = {
  starter: {
    priceMonthly: 'R$ 149,99',
    priceYearly: 'R$ 1.499,99/ano',
    description: 'Ideal para instituições pequenas iniciando na plataforma',
    highlights: ['Até 5 Campos', 'Até 50 Igrejas', 'Até 500 Membros', 'Até 3 Usuários Administrativos']
  },
  intermediario: {
    priceMonthly: 'R$ 299,99',
    priceYearly: 'R$ 2.999,99/ano',
    description: 'Solução completa para instituições de grande porte e em crescimento.',
    highlights: ['Até 20 Campos', 'Até 250 Igrejas', 'Até 3.000 Membros', 'Até 10 Usuários Administrativos']
  },
  profissional: {
    priceMonthly: 'R$ 499,99',
    priceYearly: 'R$ 4.999,99/ano',
    description: 'Solução completa para instituições em fase de expansão acelerada',
    highlights: ['Até 50 Campos', 'Até 600 Igrejas', 'Até 7.000 Membros', 'Até 25 Usuários Administrativos']
  },
  expert: {
    priceMonthly: 'R$ 999,00',
    priceYearly: 'R$ 9.999,99/ano',
    description: 'Personalizado para grandes instituições com alto fluxo de atividades.',
    highlights: ['Até 999 Campos', 'Até 999 Igrejas', 'Até 99.999 Membros', 'Até 999 Usuários Administrativos']
  }
} as const;

const resolvePlan = (value: string | null) => {
  const normalized = (value || '').toLowerCase();
  return PLAN_OPTIONS.some((plan) => plan.value === normalized) ? normalized : 'starter';
};

const formatCep = (value: string) => {
  const digits = onlyDigits(value).slice(0, 8);
  if (!digits) return '';
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

export default function PreCadastroPage() {
  const searchParams = useSearchParams();
  const initialPlan = useMemo(() => resolvePlan(searchParams.get('plan')), [searchParams]);

  const [formData, setFormData] = useState({
    ministry_name: '',
    responsible_name: '',
    cpf_cnpj: '',
    email: '',
    password: '',
    whatsapp: '',
    phone: '',
    website: '',
    quantity_temples: '1',
    quantity_members: '0',
    address_zip: '',
    address_street: '',
    address_number: '',
    address_complement: '',
    address_city: '',
    address_state: '',
    description: '',
    plan: initialPlan
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const successMessageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      plan: initialPlan
    }));
  }, [initialPlan]);

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
          quantity_temples: formData.quantity_temples,
          quantity_members: formData.quantity_members,
          address_zip: formData.address_zip,
          address_street: formData.address_street,
          address_number: formData.address_number,
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
        quantity_temples: '1',
        quantity_members: '0',
        address_zip: '',
        address_street: '',
        address_number: '',
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
    <div
      className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#0b2a4a] to-[#0b2a4a] text-white"
      style={{
        ['--brand-primary' as any]: '#3b82f6',
        ['--brand-accent' as any]: '#fbbf24'
      }}
    >
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] items-start">
          <div className="space-y-6">
            <a
              href="/"
              className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-yellow-300 hover:text-yellow-200 transition"
            >
              <span aria-hidden="true">←</span>
              Voltar ao inicio
            </a><br></br>
            <span className="inline-flex items-center px-4 py-1 rounded-full bg-white/10 text-xs uppercase tracking-[0.4em]">
              Pré-cadastro
            </span>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">
              Sua instituição pronta + 07 dias para testar.
            </h1>
            <p className="text-lg text-blue-100">
              Preencha os dados da instituição e cadastre um Email e Senha para começar o período de teste.
            </p>

            <div className="rounded-2xl bg-white/10 border border-white/10 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm uppercase tracking-[0.3em] text-blue-100">Plano escolhido</span>
                <span className="text-sm text-blue-50">07 dias grátis</span>
              </div>
              <p className="text-3xl font-bold">
                {PLAN_OPTIONS.find((plan) => plan.value === formData.plan)?.label || 'Starter'}
              </p>
              <div className="space-y-3">
                <p className="text-sm text-blue-100">
                  {PLAN_DETAILS[formData.plan as keyof typeof PLAN_DETAILS].description}
                </p>
                <ul className="space-y-2 text-xs text-blue-100">
                  {PLAN_DETAILS[formData.plan as keyof typeof PLAN_DETAILS].highlights.map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-yellow-300" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-2xl bg-white/5 border border-white/10 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm uppercase tracking-[0.3em] text-blue-100">Valores após o período</span>
              </div>
              <p className="text-sm text-blue-100">
                Após o período de testes, você poderá assinar um dos planos abaixo.
              </p>
              <div className="space-y-3">
                {PLAN_OPTIONS.map((plan) => (
                  <div key={plan.value} className="flex items-center justify-between text-blue-50 text-sm">
                    <span className="font-semibold">{plan.label}</span>
                    <span>{PLAN_DETAILS[plan.value].priceMonthly}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-blue-100">
                Valores anuais a partir de {PLAN_DETAILS.starter.priceYearly}.
              </p>
            </div>

            <a
              href="https://wa.me/5591981755021"
              target="_blank"
              rel="noreferrer"
              className="block rounded-2xl bg-white/5 border border-white/10 p-4 hover:border-white/20 hover:bg-white/10 transition"
            >
              <p className="text-sm font-semibold flex items-center gap-2">
                <img
                  src="/img/zap1.png"
                  alt="WhatsApp"
                  className="h-4 w-4"
                />
                DÚVIDAS? Deixe uma mensagem para nossa equipe comercial.
              </p>
              <p className="text-xs text-blue-100 mt-2">Fale com nosso time: (91) 98175-5021</p>
            </a>
          </div>

          <form onSubmit={handleSubmit} className="bg-white text-slate-900 rounded-3xl p-8 shadow-2xl space-y-6">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Dados da instituição</p>
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
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nome da instituição *</label>
                <input
                  name="ministry_name"
                  value={formData.ministry_name}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="Ex: Igreja Assembleia de Deus"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">CPF / CNPJ *</label>
                <input
                  name="cpf_cnpj"
                  value={formData.cpf_cnpj}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Plano</label>
                <select
                  name="plan"
                  value={formData.plan}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
                >
                  {PLAN_OPTIONS.map((plan) => (
                    <option key={plan.value} value={plan.value}>
                      {plan.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Nome do responsável *</label>
              <input
                name="responsible_name"
                value={formData.responsible_name}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="Nome completo"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Email de acesso *</label>
                <input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="acesso@ministerio.com"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Senha de teste *</label>
                <input
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="Crie uma senha segura"
                />
                <p className="text-xs text-slate-500 mt-1">Senha de teste expira em 7 dias.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">WhatsApp *</label>
                <input
                  name="whatsapp"
                  value={formData.whatsapp}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="(11) 99000-0000"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Telefone</label>
                <input
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="(11) 3000-0000"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Website</label>
                <input
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="https://"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Igrejas/Templos</label>
                  <input
                    name="quantity_temples"
                    type="number"
                    min="1"
                    value={formData.quantity_temples}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Membros</label>
                  <input
                    name="quantity_members"
                    type="number"
                    min="0"
                    value={formData.quantity_members}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">CEP</label>
                <input
                  name="address_zip"
                  value={formData.address_zip}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="00000-000"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Cidade</label>
                <input
                  name="address_city"
                  value={formData.address_city}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="Cidade"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1">Rua</label>
                <input
                  name="address_street"
                  value={formData.address_street}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="Rua das Flores"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Número</label>
                <input
                  name="address_number"
                  value={formData.address_number}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="123"
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
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="Apto 42"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Estado (UF)</label>
                <select
                  name="address_state"
                  value={formData.address_state}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
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
                <label className="block text-sm font-semibold text-slate-700 mb-1">Descrição</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
                rows={4}
                placeholder="Conte um pouco sobre a instituição"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-60"
            >
              {loading ? 'Enviando...' : 'Enviar pré-cadastro'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
