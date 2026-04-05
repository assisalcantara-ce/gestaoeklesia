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
  max_divisao1: number;
  has_advanced_reports: boolean;
  has_api_access: boolean;
  has_priority_support: boolean;
  has_custom_domain: boolean;
  has_white_label: boolean;
  has_automation: boolean;
  has_modulo_financeiro: boolean;
  has_modulo_eventos: boolean;
  has_modulo_reunioes: boolean;
};

function buildHighlights(plan: PlanoDB): string[] {
  const h: string[] = [];
  if (plan.max_users > 0) h.push(`Até ${plan.max_users} Usuários Administrativos`);
  if (plan.max_members > 0) h.push(`Até ${plan.max_members.toLocaleString('pt-BR')} Ministros`);
  if (plan.max_divisao1 > 0) h.push(`Até ${plan.max_divisao1} Campos`);
  if (plan.has_modulo_financeiro) h.push('Módulo Financeiro');
  if (plan.has_modulo_eventos) h.push('Módulo Eventos');
  if (plan.has_modulo_reunioes) h.push('Módulo Reuniões');
  if (plan.has_advanced_reports) h.push('Relatórios Avançados');
  if (plan.has_priority_support) h.push('Suporte Prioritário');
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

  // Busca planos ativos do banco
  useEffect(() => {
    supabase
      .from('subscription_plans')
      .select('id,name,slug,description,price_monthly,price_annually,max_users,max_members,max_divisao1,has_api_access,has_advanced_reports,has_priority_support,has_custom_domain,has_white_label,has_automation,has_modulo_financeiro,has_modulo_eventos,has_modulo_reunioes')
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
                {planoAtivo?.name || 'Carregando...'}
              </p>
              <div className="space-y-3">
                <p className="text-sm text-blue-100">
                  {planoAtivo?.description || ''}
                </p>
                {planoAtivo && (
                  <ul className="space-y-2 text-xs text-blue-100">
                    {buildHighlights(planoAtivo).map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-yellow-300" />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
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
                {planos.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-blue-50 text-sm">
                    <span className="font-semibold">{p.name}</span>
                    <span>{formatarPreco(p.price_monthly)}/mês</span>
                  </div>
                ))}
              </div>
              {(() => {
                const comAnual = planos.find((p) => p.price_annually && p.price_annually > 0);
                return comAnual ? (
                  <p className="text-xs text-blue-100">
                    Valores anuais a partir de {formatarPreco(comAnual.price_annually!)}/ano.
                  </p>
                ) : null;
              })()}
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
                  placeholder="Ex: Convenção Estadual de Ministros"
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
                  {planos.map((p) => (
                    <option key={p.id} value={p.slug || p.name.toLowerCase()}>
                      {p.name} — {formatarPreco(p.price_monthly)}/mês
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
            </div>

            <div className="grid gap-4 md:grid-cols-2">
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
