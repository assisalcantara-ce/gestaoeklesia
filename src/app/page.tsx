'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import NotificationModal from '@/components/NotificationModal';
import { formatCpfOrCnpj, formatPhone } from '@/lib/mascaras';
import { createClient } from '@/lib/supabase-client';
import { formatarPreco } from '@/config/plans';

const benefits = [
  {
    title: 'Gestão multi-institucional',
    text: 'Gerencie uma ou várias instituições com usuários isolados e acesso controlado.'
  },
  {
    title: 'Estrutura hierárquica completa',
    text: 'Supervisões, congregações e departamentos com fluxo de autoridade definido.'
  },
  {
    title: 'Relatórios e métricas',
    text: 'Acompanhe indicadores, frequência, crescimento e dados escancaradamente úteis.'
  },
  {
    title: '100% na nuvem',
    text: 'Acesse de qualquer lugar, qualquer dispositivo, dados sempre sincronizados.'
  },
  {
    title: 'Conformidade LGPD',
    text: 'Dados protegidos com criptografia, controle de acesso e boas práticas legais.'
  },
  {
    title: 'Implementação rápida',
    text: 'Setup em horas, não semanas. Equipe de onboarding inclusa em todos os planos.'
  }
];

const features = [
  {
    title: 'Gestão de membros',
    text: 'Cadastro completo com fotos, CPF/RG, histórico ministerial e documentos.',
    bullets: ['Dados pessoais completos', 'Cargo e setor', 'Histórico de atividades']
  },
  {
    title: 'Credenciais e cartões',
    text: 'Gere cartões personalizados com logo, dados e QR Code para impressão em lote.',
    bullets: ['4 tipos de cartão', 'Templates customizáveis', 'Impressão em massa']
  },
  {
    title: 'Estrutura hierárquica',
    text: 'Supervisões, congregações e departamentos com fluxo de autoridade definido.',
    bullets: ['Múltiplos níveis', 'Acesso por departamento', 'Relatórios por área']
  },
  {
    title: 'Financeiro integrado',
    text: 'Controle de receitas, despesas, tesouraria com relatórios detalhados.',
    bullets: ['Fluxo de caixa', 'Categorias customizáveis', 'Relatórios por período']
  },
  {
    title: 'Suporte via tickets',
    text: 'Atendimento estruturado com equipe especializada para resolver demandas com rapidez.',
    bullets: ['Fila inteligente', 'Acompanhamento por status', 'Histórico completo']
  },
  {
    title: 'Eventos e reuniões',
    text: 'Agende eventos, cultos, reuniões com controle de frequência automático.',
    bullets: ['Eventos recorrentes', 'Listas de presença', 'Notificações']
  }
];



const faqs = [
  {
    question: 'Quanto tempo leva para implementar?',
    answer: 'Setup inicial em 1-2 horas. A equipe de onboarding acompanha toda a implantação no seu plano.'
  },
  {
    question: 'Os cartões podem ser customizados?',
    answer: 'Sim! Configure cores, logos, campos e templates. Imprima um ou centenas de cartões em lote.'
  },
  {
    question: 'Preciso contratar suporte extra?',
    answer: 'Não. Suporte está incluído em todos os planos. Professional já tem chat + email.'
  },
  {
    question: 'Os dados estão seguros?',
    answer: 'Sim. Uso Supabase (PostgreSQL enterprise), criptografia SSL/TLS, backup diário e conformidade LGPD.'
  }
];

const gallery = [
  { src: '/img/img1.png', alt: 'Tela do dashboard do sistema' },
  { src: '/img/img2.png', alt: 'Tela de gestao de membros' },
  { src: '/img/img3.png', alt: 'Tela de cartoes e credenciais' },
  { src: '/img/img4.png', alt: 'Tela de relatorios e indicadores' }
];

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
  max_divisao1: number;
  max_divisao2: number;
  max_divisao3: number;
  is_active: boolean;
  display_order: number;
  has_api_access: boolean;
  has_advanced_reports: boolean;
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
  if (plan.max_members > 0) h.push(`Até ${plan.max_members.toLocaleString('pt-BR')} Membros`);
  if (plan.has_advanced_reports) h.push('Relatórios Avançados');
  if (plan.has_api_access) h.push('Acesso à API');
  if (plan.has_priority_support) h.push('Suporte Prioritário');
  if (plan.has_custom_domain) h.push('Domínio Personalizado');
  if (plan.has_white_label) h.push('White Label');
  if (plan.has_automation) h.push('Automação');
  return h;
}

function buildModuleHighlights(plan: PlanoDB): string[] {
  const modules: string[] = [];
  if (plan.has_modulo_financeiro) modules.push('Financeiro');
  if (plan.has_modulo_eventos) modules.push('Eventos');
  if (plan.has_modulo_reunioes) modules.push('Reuniões');
  return modules;
}

export default function LandingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [planosLanding, setPlanosLanding] = useState<PlanoDB[]>([]);
  const [showAllPlanos, setShowAllPlanos] = useState(false);
  const [successModal, setSuccessModal] = useState({
    isOpen: false,
    email: ''
  });
  const [errorModal, setErrorModal] = useState({
    isOpen: false,
    email: ''
  });
  const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null);
  const [contactData, setContactData] = useState({
    ministerio: '',
    pastor: '',
    cpf: '',
    whatsapp: '',
    email: ''
  });

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('subscription_plans')
      .select('id,name,slug,description,price_monthly,price_annually,max_users,max_members,max_ministerios,max_divisao1,max_divisao2,max_divisao3,is_active,display_order,has_api_access,has_advanced_reports,has_priority_support,has_custom_domain,has_white_label,has_automation,has_modulo_financeiro,has_modulo_eventos,has_modulo_reunioes')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('price_monthly', { ascending: true })
      .then(({ data }: { data: PlanoDB[] | null }) => { if (data) setPlanosLanding(data); });
  }, []);

  const normalizePlanKey = (value: string) =>
    value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim();

  const planosDestaque = ['basic', 'basico', 'starter', 'intermediario', 'profissional']
    .reduce((acc, key) => {
      const plan = planosLanding.find((item) =>
        normalizePlanKey(item.slug || item.name) === key || normalizePlanKey(item.name) === key
      );
      if (plan && !acc.some((existing) => existing.id === plan.id)) {
        acc.push(plan);
      }
      return acc;
    }, [] as PlanoDB[]);

  const planosVisiveis = showAllPlanos
    ? planosLanding
    : (planosDestaque.length > 0 ? planosDestaque : planosLanding.slice(0, 4));

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
        setError('Nome do Ministério é obrigatório');
        setLoading(false);
        return;
      }

      if (!contactData.pastor.trim()) {
        setError('Nome do Pastor é obrigatório');
        setLoading(false);
        return;
      }

      if (!contactData.cpf.trim()) {
        setError('CPF/CNPJ é obrigatório');
        setLoading(false);
        return;
      }

      if (!contactData.whatsapp.trim()) {
        setError('WhatsApp é obrigatório');
        setLoading(false);
        return;
      }

      if (!contactData.email.trim()) {
        setError('Email é obrigatório');
        setLoading(false);
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactData.email)) {
        setError('Email inválido');
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
          setErrorModal({ isOpen: true, email: contactData.email });
          setLoading(false);
          return;
        }
        setError(result.error || 'Erro ao registrar contato');
        setLoading(false);
        return;
      }

      setError('');
      setSuccessModal({ isOpen: true, email: contactData.email });
      setContactData({ ministerio: '', pastor: '', cpf: '', whatsapp: '', email: '' });
      setLoading(false);
    } catch (err) {
      console.error('Erro ao registrar contato:', err);
      setError('Erro ao registrar contato. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;700;800&family=DM+Serif+Display&display=swap');
        :root {
          --landing-bg: #ffffff;
          --landing-card: #f8fafb;
          --landing-accent: #0ea5e9;
          --landing-gold: #f59e0b;
          --landing-text: #1e293b;
        }
        body {
          font-family: 'Plus Jakarta Sans', 'Segoe UI', sans-serif;
          background: linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%);
        }
        .landing-title {
          font-family: 'DM Serif Display', 'Georgia', serif;
          color: #0f172a;
        }
      `}</style>

      <NotificationModal
        isOpen={successModal.isOpen}
        type="success"
        title="Solicitação recebida!"
        message={`Obrigado pelo interesse. Entraremos em contato em breve.\n\nEmail: ${successModal.email}`}
        onClose={() => setSuccessModal({ isOpen: false, email: '' })}
        autoClose={5000}
      />

      <NotificationModal
        isOpen={errorModal.isOpen}
        type="error"
        title="Email já registrado"
        message={`O email ${errorModal.email} já foi registrado.`}
        onClose={() => setErrorModal({ isOpen: false, email: '' })}
        showButton={true}
        autoClose={4000}
      />

      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          <div
            className="absolute inset-0"
            onClick={() => setSelectedImage(null)}
          />
          <div className="relative max-w-5xl w-full">
            <button
              className="absolute -top-12 right-0 text-white text-sm font-semibold"
              onClick={() => setSelectedImage(null)}
              aria-label="Fechar"
            >
              Fechar
            </button>
            <img
              src={selectedImage.src}
              alt={selectedImage.alt}
              className="w-full max-h-[80vh] object-contain rounded-2xl border border-white/20 shadow-2xl"
            />
          </div>
        </div>
      )}

      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/img/logo333-v2.png" alt="Gestão Servus" className="h-10" />
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-600">
            <a href="#beneficios" className="hover:text-slate-900 transition">Benefícios</a>
            <a href="#telas" className="hover:text-slate-900 transition">Telas</a>
            <a href="#funcionalidades" className="hover:text-slate-900 transition">Funcionalidades</a>
            <a href="#planos" className="hover:text-slate-900 transition">Planos</a>
            <a href="#faq" className="hover:text-slate-900 transition">FAQ</a>
            <a href="#contato" className="hover:text-slate-900 transition">Contato</a>
          </nav>
          <button
            onClick={() => router.push('/login')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Acesso ao Sistema
          </button>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/img/bgslider.jpg')" }} />
        <div className="absolute inset-0 bg-white/60" />
        <div className="relative max-w-6xl mx-auto px-6 py-20 grid gap-12 lg:grid-cols-[1.1fr_0.9fr] items-center">
          <div className="space-y-6">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">
              Gestão inteligente
            </span>
            <h1 className="landing-title text-4xl md:text-5xl">
              Gestão inteligente para instituições modernas.
            </h1>
            <p className="text-lg text-slate-600">
              Administre sua instituição com ferramentas para membros, financeiro, estrutura hierárquica, cartões e relatórios.
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="#planos"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition"
              >
                Começar agora - 7 dias grátis
              </a>
              <a
                href="#contato"
                className="px-6 py-3 border-2 border-slate-300 text-slate-900 rounded-lg font-semibold hover:border-slate-400 hover:bg-slate-50 transition"
              >
                Agendar demonstração
              </a>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-slate-600">
              <span className="px-3 py-1 bg-slate-100 rounded-full">7 dias grátis</span>
              <span className="px-3 py-1 bg-slate-100 rounded-full">Suporte especializado</span>
              <span className="px-3 py-1 bg-slate-100 rounded-full">Cancele quando quiser</span>
            </div>
          </div>
          <div className="bg-gradient-to-br from-white to-blue-50 border border-slate-200 rounded-2xl p-8 shadow-lg">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Resumo</p>
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Tempo de implantação</span>
                <span className="text-slate-900 font-semibold">~1 dia</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Módulo mais usado</span>
                <span className="text-slate-900 font-semibold">Secretaria</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Suporte</span>
                <span className="text-slate-900 font-semibold">24h úteis</span>
              </div>
              <div className="mt-6 bg-blue-500/10 border border-blue-200 rounded-xl p-4">
                <p className="text-xs font-semibold uppercase text-blue-600">Impacto</p>
                <p className="text-2xl font-bold text-slate-900">+45% produtividade</p>
                <p className="text-xs text-slate-600">Em gestão, relatórios e controle operacional.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="telas" className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Veja na prática</p>
          <h2 className="landing-title text-3xl">Telas do sistema</h2>
          <p className="text-slate-600 mt-3">Um panorama real do que sua equipe vai usar no dia a dia.</p>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory md:justify-center touch-manipulation">
          {gallery.map((item) => (
            <div
              key={item.src}
              className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm hover:shadow-lg transition shrink-0 min-w-[150px] sm:min-w-[190px] lg:min-w-[230px] max-w-[230px] snap-start select-none touch-manipulation cursor-pointer"
              onClick={() => setSelectedImage(item)}
            >
              <img
                src={item.src}
                alt={item.alt}
                className="w-full h-32 sm:h-36 lg:h-40 object-cover rounded-xl border border-slate-200"
                loading="lazy"
                draggable={false}
              />
            </div>
          ))}
        </div>
      </section>

      <section id="beneficios" className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Por que escolher</p>
          <h2 className="landing-title text-3xl">Gestão Servus</h2>
          <p className="text-slate-600 mt-3">Tudo que você precisa para gerir sua instituição de forma eficiente e segura.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {benefits.map((card) => (
            <div key={card.title} className="bg-gradient-to-br from-slate-50 to-blue-50 border border-blue-100 rounded-2xl p-6 hover:shadow-lg hover:border-blue-200 transition duration-300">
              <h3 className="text-lg font-bold text-slate-900">{card.title}</h3>
              <p className="text-sm text-slate-600 mt-2">{card.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="funcionalidades" className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Tudo que você precisa</p>
          <h2 className="landing-title text-3xl">Ferramentas completas</h2>
          <p className="text-slate-600 mt-3">Módulos integrados para administrar sua instituição de forma centralizada.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="bg-gradient-to-br from-slate-50 to-blue-50 border border-blue-100 rounded-2xl p-6 hover:shadow-lg hover:border-blue-200 transition duration-300">
              <h3 className="text-lg font-bold text-slate-900">{feature.title}</h3>
              <p className="text-sm text-slate-600 mt-2">{feature.text}</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                {feature.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    {bullet}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section id="planos" className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Planos que crescem com você</p>
          <h2 className="landing-title text-3xl">Escolha o plano ideal</h2>
          <p className="text-slate-600 mt-3">Todos incluem suporte, onboarding e 7 dias de teste gratuito.</p>
        </div>
        {planosLanding.length === 0 && (
          <p className="text-center text-slate-400 text-sm py-8">Carregando planos...</p>
        )}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {planosVisiveis.map((plan, idx) => {
            const featured = idx === 1;
            const highlights = buildHighlights(plan);
            const modules = buildModuleHighlights(plan);
            return (
              <div
                key={plan.id}
                className={`rounded-2xl p-6 border transition duration-300 ${
                  featured
                    ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white border-blue-600 shadow-xl scale-105'
                    : 'bg-white text-slate-900 border-slate-200 hover:shadow-lg'
                }`}
              >
                {featured && (
                  <span className="inline-flex text-xs font-semibold bg-yellow-400 text-slate-900 px-2 py-1 rounded-full">
                    Mais popular
                  </span>
                )}
                <h3 className="text-xl font-bold mt-4">{plan.name}</h3>
                <p className={`text-sm mt-2 ${featured ? 'text-blue-100' : 'text-slate-600'}`}>
                  {plan.description || ''}
                </p>
                <div className="mt-4">
                  <p className="text-3xl font-bold">{formatarPreco(plan.price_monthly)}</p>
                  {plan.price_annually && (
                    <p className={`text-xs mt-1 ${featured ? 'text-blue-100' : 'text-slate-500'}`}>
                      {formatarPreco(plan.price_annually)}/ano
                    </p>
                  )}
                </div>
                <ul className="mt-6 space-y-2 text-sm">
                  {highlights.map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${featured ? 'bg-yellow-300' : 'bg-blue-500'}`} />
                      {item}
                    </li>
                  ))}
                </ul>
                {modules.length > 0 && (
                  <div className="mt-6">
                    <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${featured ? 'text-blue-100' : 'text-slate-500'}`}>
                      Módulos
                    </p>
                    <ul className="mt-3 space-y-2 text-sm">
                      {modules.map((item) => (
                        <li key={item} className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${featured ? 'bg-yellow-300' : 'bg-blue-500'}`} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <a
                  href={`/pre-cadastro?plan=${plan.slug}`}
                  className={`mt-6 inline-flex w-full justify-center px-4 py-2 rounded-lg font-semibold transition ${
                    featured
                      ? 'bg-yellow-400 text-slate-900 hover:bg-yellow-300'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  Assinar agora
                </a>
              </div>
            );
          })}
        </div>
        {planosLanding.length > 0 && (
          <div className="text-center mt-10">
            <button
              onClick={() => setShowAllPlanos(v => !v)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-blue-600 text-blue-600 font-semibold hover:bg-blue-600 hover:text-white transition"
            >
              {showAllPlanos ? 'Mostrar menos' : 'Exibir todos os planos'}
              <span className={`transition-transform ${showAllPlanos ? 'rotate-180' : ''}`}>▾</span>
            </button>
          </div>
        )}
      </section>

      <section id="faq" className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Perguntas frequentes</p>
          <h2 className="landing-title text-3xl">Tire suas dúvidas</h2>
        </div>
        <div className="grid gap-4">
          {faqs.map((faq) => (
            <details key={faq.question} className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition cursor-pointer group">
              <summary className="font-semibold text-slate-900 cursor-pointer flex justify-between items-center">
                {faq.question}
                <span className="ml-2 group-open:rotate-180 transition duration-300">▾</span>
              </summary>
              <p className="text-sm text-slate-600 mt-2">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section id="contato" className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr] items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Ainda tem dúvidas?</p>
            <h2 className="landing-title text-3xl">Vamos conversar</h2>
            <p className="text-slate-600 mt-3">
              Nossa equipe responde em até 24h úteis. Agendamos uma demonstração, liberamos acesso ao trial e guiamos sua implementação.
            </p>
            <div className="mt-8 space-y-3 text-sm text-slate-600">
              <p>Atendimento: Segunda a sexta, 9h às 18h (horário Brasília)</p>
              <p>Demonstração via vídeo call - 30 minutos</p>
              <p>Consultoria de implementação incluída</p>
              <p>Onboarding com sua equipe</p>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-lg">
            <form onSubmit={handleContactSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-100 border border-red-300 text-sm text-red-900 p-3 rounded-lg">
                  {error}
                </div>
              )}
              <input
                type="text"
                name="ministerio"
                value={contactData.ministerio}
                onChange={handleContactChange}
                placeholder="Nome da Instituição"
                className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                name="pastor"
                value={contactData.pastor}
                onChange={handleContactChange}
                placeholder="Seu Nome Completo"
                className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                name="cpf"
                value={contactData.cpf}
                onChange={handleContactChange}
                placeholder="CPF / CNPJ"
                className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                name="whatsapp"
                value={contactData.whatsapp}
                onChange={handleContactChange}
                placeholder="WhatsApp (com DDD)"
                className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="email"
                name="email"
                value={contactData.email}
                onChange={handleContactChange}
                placeholder="Email para contato"
                className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Enviando...' : 'Enviar mensagem'}
              </button>
              <p className="text-xs text-slate-500">
                Ao enviar, você concorda com nossa política de privacidade.
              </p>
            </form>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-10 text-center text-xs text-slate-500">
        Gestão Servus - Tecnologia para instituições. Desenvolvido por Moove Sistemas.
      </footer>
    </div>
  );
}