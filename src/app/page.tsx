'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { BRAND } from '@/config/brand';
import NotificationModal from '@/components/NotificationModal';
import { formatPhone } from '@/lib/mascaras';
import { createClient } from '@/lib/supabase-client';
import { formatarPreco } from '@/config/plans';

const pillars = [
  {
    title: 'Secretaria que organiza',
    text: 'Documentos, certificados e cadastros sempre atualizados e prontos para consulta.'
  },
  {
    title: 'Finanças sob controle',
    text: 'Tesouraria, receitas, despesas e relatórios em um fluxo confiável e simples.'
  },
  {
    title: 'Pessoas no centro',
    text: 'Membros, congregados e ministros com histórico ministerial completo.'
  }
];

const modules = [
  {
    title: 'Secretaria Geral',
    text: 'Documentos, cadastros e processos administrativos em um só lugar.',
    bullets: ['Cartas e certificados', 'Registro unificado', 'Fluxo documental'],
    icon: '🗂️'
  },
  {
    title: 'Achados e Perdidos',
    text: 'Controle de itens encontrados e devoluções com histórico.',
    bullets: ['Registro rápido', 'Contato com membros', 'Devoluções'],
    icon: '🧾'
  },
  {
    title: 'Patrimônio',
    text: 'Inventário de bens com status, localização e manutenção.',
    bullets: ['Cadastro de bens', 'Controle por setor', 'Relatórios'],
    icon: '🏛️'
  },
  {
    title: 'Comissão',
    text: 'Gestão de comissões, equipes e atas com clareza.',
    bullets: ['Membros e cargos', 'Reuniões registradas', 'Decisões'],
    icon: '🧩'
  },
  {
    title: 'Missões',
    text: 'Projetos missionários acompanhados com dados e metas.',
    bullets: ['Campos e projetos', 'Relatórios de campo', 'Equipe envolvida'],
    icon: '✈️'
  },
  {
    title: 'Kids',
    text: 'Ministério infantil com turmas, presença e segurança.',
    bullets: ['Turmas e líderes', 'Check-in seguro', 'Comunicações'],
    icon: '🧸'
  },
  {
    title: 'Eventos',
    text: 'Agenda completa com inscrições e listas de presença.',
    bullets: ['Calendário', 'Inscrições', 'Relatórios'],
    icon: '📅'
  },
  {
    title: 'Geolocalização',
    text: 'Mapa de igrejas e congregações com visão regional.',
    bullets: ['Endereços no mapa', 'Rotas e regiões', 'Visão por campo'],
    icon: '🗺️'
  },
  {
    title: 'Funcionarios',
    text: 'Controle de equipe com dados, cargos e situação.',
    bullets: ['Dados e documentos', 'Cargos e setores', 'Status ativo'],
    icon: '👔'
  },
  {
    title: 'Reuniões',
    text: 'Pautas, atas e participantes em um fluxo simples.',
    bullets: ['Convocações', 'Atas', 'Participantes'],
    icon: '🤝'
  },
  {
    title: 'Presidência',
    text: 'Visão executiva com indicadores e aprovações.',
    bullets: ['Indicadores-chave', 'Aprovações', 'Visão consolidada'],
    icon: '👑'
  },
  {
    title: 'Financeiro',
    text: 'Receitas, despesas e relatórios com transparência.',
    bullets: ['Fluxo de caixa', 'Categorias', 'Exportações'],
    icon: '💳'
  },
  {
    title: 'Tesouraria',
    text: 'Lançamentos e conciliações organizadas.',
    bullets: ['Entradas e saídas', 'Conferencia', 'Histórico'],
    icon: '💼'
  },
  {
    title: 'EBD',
    text: 'Escola bíblica dominical com classes e presença.',
    bullets: ['Classes e professores', 'Presenca', 'Conteúdos'],
    icon: '📘'
  },
  {
    title: 'Auditoria',
    text: 'Rastreabilidade completa de acessos e ações.',
    bullets: ['Registro de ações', 'Alertas', 'Conformidade'],
    icon: '✅'
  },
  {
    title: 'Chat Interno',
    text: 'Comunicação rápida entre setores e equipes.',
    bullets: ['Canais por area', 'Mensagens rápidas', 'Histórico'],
    icon: '💬'
  }
];

const journey = [
  {
    step: '01',
    title: 'Organize sua base',
    text: 'Cadastre membros, congregados e ministros com dados completos e hierarquia definida.'
  },
  {
    step: '02',
    title: 'Gerencie o dia a dia',
    text: 'Fluxos de secretaria, financeiro e eventos conectados em tempo real.'
  },
  {
    step: '03',
    title: 'Acompanhe resultados',
    text: 'Relatórios, auditoria e indicadores para tomada de decisao segura.'
  }
];

const metrics = [
  { value: '16', label: 'Módulos integrados' },
  { value: '24h', label: 'Suporte em dias úteis' },
  { value: 'LGPD', label: 'Conformidade e segurança' }
];



const faqs = [
  {
    question: 'Quanto tempo leva para implementar?',
    answer: 'O setup inicial pode ser feito em poucas horas. A equipe de onboarding acompanha sua igreja na implantação.'
  },
  {
    question: 'Consigo personalizar documentos e cartoes?',
    answer: 'Sim. Você pode configurar modelos, cores, logotipo e documentos com QR Code.'
  },
  {
    question: 'O suporte esta incluso?',
    answer: 'Sim. Todos os planos incluem suporte e acompanhamento na implantação.'
  },
  {
    question: 'Os dados estão seguros?',
    answer: 'Sim. Uso Supabase (PostgreSQL enterprise), criptografia SSL/TLS, backup diário e conformidade LGPD.'
  }
];

const gallery = [
  { src: '/img/img1.png', alt: 'Tela do dashboard do sistema' },
  { src: '/img/img2.png', alt: 'Tela de gestão de membros' },
  { src: '/img/img3.png', alt: 'Tela de cartões e credenciais' },
  { src: '/img/img4.png', alt: 'Tela de relatórios e indicadores' }
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
  additional_church_monthly_fee: number;
  additional_admin_users_per_church: number;
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
  modulos: string[];
  is_price_on_request?: boolean;
};

function buildHighlights(plan: PlanoDB): string[] {
  const h: string[] = [];
  if (plan.max_members > 0) {
    h.push(`Até ${plan.max_members.toLocaleString('pt-BR')} Membros`);
  } else {
    h.push('Membros ilimitados');
  }
  if (plan.max_ministerios > 0) {
    h.push(`Até ${plan.max_ministerios} Igrejas inclusas`);
  }
  return h;
}

function buildModuleHighlights(plan: PlanoDB): { modules: string[]; label: string } {
  return {
    modules: Array.isArray(plan.modulos) ? plan.modulos : [],
    label: 'Módulos inclusos',
  };
}

export default function LandingPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [planosLanding, setPlanosLanding] = useState<PlanoDB[]>([]);
  const [showAllPlanos] = useState(false);
  const [successModal, setSuccessModal] = useState({
    isOpen: false,
    email: ''
  });
  const [errorModal, setErrorModal] = useState({
    isOpen: false,
    email: ''
  });
  const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [showModules, setShowModules] = useState(false);
  const [contactData, setContactData] = useState({
    ministerio: '',
    pastor: '',
    mensagem: '',
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
      .select('id,name,slug,description,price_monthly,price_annually,max_users,max_members,max_ministerios,additional_church_monthly_fee,additional_admin_users_per_church,max_divisao2,max_divisao3,is_active,display_order,has_api_access,has_advanced_reports,has_priority_support,has_custom_domain,has_white_label,has_automation,has_modulo_financeiro,has_modulo_eventos,has_modulo_reunioes,modulos,is_price_on_request')
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

  const handleContactChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const nextValue = name === 'whatsapp'
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
          mensagem: contactData.mensagem,
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
      if (result.resent) {
        setSuccessModal({
          isOpen: true,
          email: `${contactData.email} (Link reenviado!)`
        });
      } else {
        setSuccessModal({ isOpen: true, email: contactData.email });
      }
      setContactData({ ministerio: '', pastor: '', mensagem: '', whatsapp: '', email: '' });
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
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=DM+Serif+Display&display=swap');
        :root {
          --landing-bg: #f6f2ea;
          --landing-card: #ffffff;
          --landing-ink: #1f1b16;
          --landing-muted: #5f6b66;
          --landing-accent: #0f766e;
          --landing-warm: #c26b2b;
          --landing-line: #e7e0d6;
        }
        body {
          font-family: 'Space Grotesk', 'Segoe UI', sans-serif;
          background: radial-gradient(circle at top, #f8f5ef 0%, #eef5f2 55%, #f6f2ea 100%);
          color: var(--landing-ink);
        }
        .landing-title {
          font-family: 'DM Serif Display', 'Georgia', serif;
          letter-spacing: -0.01em;
        }
        .landing-orb {
          position: absolute;
          border-radius: 9999px;
          filter: blur(70px);
          opacity: 0.6;
          animation: float 12s ease-in-out infinite;
        }
        .landing-orb.orb-a {
          width: 420px;
          height: 420px;
          background: #ccebe3;
          top: -140px;
          left: -120px;
        }
        .landing-orb.orb-b {
          width: 520px;
          height: 520px;
          background: #f3d8bf;
          bottom: -200px;
          right: -140px;
        }
        .reveal {
          animation: rise 0.7s ease both;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(18px); }
        }
        @keyframes rise {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <NotificationModal
        isOpen={successModal.isOpen}
        type="success"
        title="Solicitação recebida!"
        message={`Solicitação recebida! Enviamos para seu e-mail o link para iniciar seu teste grátis de 7 dias.\n\nEmail: ${successModal.email}`}
        onClose={() => setSuccessModal({ isOpen: false, email: '' })}
        autoClose={7000}
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
            <Image
              src={BRAND.logoHorizontal}
              alt="Gestão Eklésia"
              width={180}
              height={52}
              priority
              sizes="180px"
              className="h-[52px] w-auto object-contain"
            />
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-600">
            <a href="#visao" className="hover:text-slate-900 transition">Visão</a>
            <a href="#dores" className="hover:text-slate-900 transition">Dores</a>
            <a href="#modulos" className="hover:text-slate-900 transition">Módulos</a>
            <a href="#fluxo" className="hover:text-slate-900 transition">Fluxo</a>
            <a href="#telas" className="hover:text-slate-900 transition">Telas</a>
            <a href="#planos" className="hover:text-slate-900 transition">Planos</a>
            <a href="#faq" className="hover:text-slate-900 transition">FAQ</a>
            <a href="#contato" className="hover:text-slate-900 transition">Contato</a>
          </nav>
          <a
            href={`${process.env.NEXT_PUBLIC_APP_URL || 'https://app.gestaoeklesia.com.br'}/login`}
            className="px-4 py-2 bg-emerald-700 text-white rounded-lg font-semibold hover:bg-emerald-800 transition"
          >
            Acesso ao Sistema
          </a>
        </div>
      </header>

      <section
        id="visao"
        className="relative overflow-hidden"
        style={{
          backgroundImage: "url('/img/bgslider.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div className="relative max-w-6xl mx-auto px-6 py-20 grid gap-12 lg:grid-cols-[1.05fr_0.95fr] items-center">
          <div className="space-y-6 reveal" style={{ animationDelay: '0.05s' }}>
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">
              Para ministérios
            </span>
            <h1 className="landing-title text-4xl md:text-6xl">
              Tenha controle total da sua igreja em um único painel
            </h1>
            <p className="text-lg text-slate-600">
              Organize membros, finanças, ministérios e relatórios com transparência, segurança e sem retrabalho.
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="/pre-cadastro?plan=starter&trial=true"
                className="px-6 py-3 bg-emerald-700 text-white rounded-full font-bold hover:bg-emerald-800 transition"
              >
                Teste grátis por 7 dias — sem compromisso
              </a>
              <a
                href="#contato"
                className="px-6 py-3 border-2 border-emerald-700 text-emerald-800 rounded-full font-semibold hover:bg-emerald-50 transition"
              >
                Agendar demonstração
              </a>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-slate-600">
              <span className="px-3 py-1 bg-white/70 border border-[#e7e0d6] rounded-full">Membros organizados</span>
              <span className="px-3 py-1 bg-white/70 border border-[#e7e0d6] rounded-full">Finanças transparentes</span>
              <span className="px-3 py-1 bg-white/70 border border-[#e7e0d6] rounded-full">Tudo em um painel</span>
            </div>
          </div>
          <div className="bg-white/90 border border-[#e7e0d6] rounded-3xl p-8 shadow-xl backdrop-blur reveal" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">Painel da igreja</p>
              <span className="text-xs text-slate-500">Visão em tempo real</span>
            </div>
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Secretaria</span>
                <span className="text-slate-900 font-semibold">Documentos organizados</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Financeiro</span>
                <span className="text-slate-900 font-semibold">Entradas e saídas claras</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Pessoas</span>
                <span className="text-slate-900 font-semibold">Histórico completo</span>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[#e7e0d6] bg-emerald-50/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">Rotina</p>
                <p className="text-lg font-semibold text-slate-900 mt-2">Agenda integrada</p>
              </div>
              <div className="rounded-2xl border border-[#e7e0d6] bg-amber-50/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-amber-700">Controle</p>
                <p className="text-lg font-semibold text-slate-900 mt-2">Segurança e transparência</p>
              </div>
            </div>
          </div>
        </div>
        <div className="relative max-w-6xl mx-auto px-6 pb-14">
          <div className="grid gap-4 md:grid-cols-3">
            {metrics.map((metric, index) => (
              <div
                key={metric.label}
                className="bg-white/80 border border-[#e7e0d6] rounded-2xl p-5 shadow-sm reveal"
                style={{ animationDelay: `${0.25 + index * 0.1}s` }}
              >
                <p className="text-2xl font-bold text-slate-900">{metric.value}</p>
                <p className="text-sm text-slate-600 mt-1">{metric.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="dores" className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-700">Problemas que resolvemos</p>
            <h2 className="landing-title text-3xl">Sua igreja não precisa depender de planilhas, cadernos e informações espalhadas.</h2>
            <p className="text-slate-600 mt-3">
              O Gestão Eklesia centraliza a rotina administrativa para que líderes tenham mais clareza, equipes trabalhem com menos retrabalho e a igreja cresça com organização.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ['Membros sem acompanhamento', 'Cadastre, acompanhe histórico ministerial e mantenha dados sempre atualizados.'],
              ['Finanças pouco transparentes', 'Registre entradas, saídas, categorias e relatórios com mais segurança.'],
              ['Documentos dispersos', 'Organize cartas, certificados, atas e registros em um único lugar.'],
              ['Liderança sem visão geral', 'Acompanhe indicadores, auditoria e módulos estratégicos em tempo real.'],
            ].map(([title, text]) => (
              <div key={title} className="bg-white border border-[#e7e0d6] rounded-2xl p-5 shadow-sm hover:shadow-lg transition">
                <h3 className="font-bold text-slate-900">{title}</h3>
                <p className="text-sm text-slate-600 mt-2">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="telas" className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-700">Veja na pratica</p>
          <h2 className="landing-title text-3xl">Veja o Gestão Eklesia em funcionamento</h2>
          <p className="text-slate-600 mt-3">Conheça as telas que ajudam sua equipe a organizar membros, finanças, eventos e relatórios no dia a dia.</p>
        </div>
        <div
          className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory md:justify-center touch-manipulation rounded-2xl border border-slate-200 p-4"
          style={{
            backgroundImage: "url('/img/bgslider.png')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            minHeight: '220px',
          }}
        >
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

      <section
        id="modulos"
        className="max-w-6xl mx-auto px-6 py-16 rounded-3xl"
        style={{
          backgroundImage: 'linear-gradient(135deg, rgba(15,118,110,0.06), rgba(194,107,43,0.06))',
        }}
      >
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-700">Nossos pilares</p>
          <h2 className="landing-title text-3xl">Tudo que sua igreja precisa, em um único sistema</h2>
          <p className="text-slate-600 mt-3">Da secretaria ao financeiro, tudo conectado para sua igreja crescer com organização, segurança e transparência.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3 mb-14">
          {pillars.map((card) => (
            <div key={card.title} className="bg-white border border-[#e7e0d6] rounded-2xl p-6 shadow-sm hover:shadow-lg transition duration-300">
              <h3 className="text-lg font-bold text-slate-900">{card.title}</h3>
              <p className="text-sm text-slate-600 mt-2">{card.text}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setShowModules((value) => !value)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-emerald-700 text-emerald-700 font-semibold hover:bg-emerald-700 hover:text-white transition"
          >
            {showModules ? 'Ocultar módulos' : 'Ver todos os módulos'}
            <span className={`transition-transform ${showModules ? 'rotate-180' : ''}`}>▾</span>
          </button>
        </div>
        <div className={`mt-10 ${showModules ? '' : 'hidden'}`}>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {modules.map((feature) => (
              <div key={feature.title} className="bg-gradient-to-br from-white to-emerald-50 border border-[#e7e0d6] rounded-2xl p-6 hover:shadow-lg hover:border-emerald-200 transition duration-300">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900">{feature.title}</h3>
                  <span className="text-2xl">{feature.icon}</span>
                </div>
                <p className="text-sm text-slate-600 mt-2">{feature.text}</p>
                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  {feature.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-600" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="fluxo" className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-700">Fluxo de trabalho</p>
            <h2 className="landing-title text-3xl">Uma jornada simples, clara e previsível</h2>
            <p className="text-slate-600 mt-3">
              Do cadastro inicial aos relatórios finais. Tudo conectado e com visibilidade para líderes e equipes.
            </p>
            <div className="mt-8 space-y-5">
              {journey.map((item) => (
                <div key={item.step} className="flex gap-4">
                  <div className="h-10 w-10 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold">
                    {item.step}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                    <p className="text-sm text-slate-600 mt-1">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white border border-[#e7e0d6] rounded-3xl p-8 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Resumo operacional</h3>
            <p className="text-sm text-slate-600 mt-2">O que sua equipe acompanha em um único painel.</p>
            <div className="mt-6 grid gap-4">
              {['Secretaria ativa', 'Financeiro consolidado', 'Indicadores de crescimento'].map((item) => (
                <div key={item} className="flex items-center justify-between rounded-2xl border border-[#e7e0d6] p-4">
                  <span className="text-slate-700 font-semibold">{item}</span>
                  <span className="text-emerald-700 text-sm font-semibold">OK</span>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-amber-700">Acompanhamento</p>
              <p className="text-lg font-semibold text-slate-900 mt-2">Equipe alinhada e sem retrabalho</p>
            </div>
          </div>
        </div>
      </section>

      <section id="planos" className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-700">Planos que crescem com você</p>
          <h2 className="landing-title text-3xl">Escolha o plano ideal</h2>
          <p className="text-slate-600 mt-3">Todos incluem suporte, onboarding e 7 dias de teste gratuito.</p>
        </div>
        {planosLanding.length === 0 && (
          <p className="text-center text-slate-400 text-sm py-8">Carregando planos...</p>
        )}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 items-start">
          {planosVisiveis.map((plan, idx) => {
            const featured = idx === 1;
            const highlights = buildHighlights(plan);
            const modulePack = buildModuleHighlights(plan);
            const modules = modulePack.modules;
            const isExpanded = expandedPlanId === plan.id;
            return (
              <div
                key={plan.id}
                className={`rounded-2xl p-6 border transition duration-300 self-start ${
                  featured
                    ? 'bg-gradient-to-br from-emerald-700 to-emerald-800 text-white border-emerald-700 shadow-xl scale-105'
                    : 'bg-white text-slate-900 border-[#e7e0d6] hover:shadow-lg'
                }`}
              >
                {featured && (
                  <span className="inline-flex text-xs font-semibold bg-amber-300 text-slate-900 px-2 py-1 rounded-full">
                    Mais popular
                  </span>
                )}
                <h3 className="text-xl font-bold mt-4">{plan.name}</h3>
                <p className={`text-sm mt-2 ${featured ? 'text-blue-100' : 'text-slate-600'}`}>
                  {plan.description || ''}
                </p>
                <div className="mt-4">
                  {plan.is_price_on_request ? (
                    <p className="text-2xl font-bold">Consulte-nos</p>
                  ) : (
                    <>
                      <p className="text-3xl font-bold">{formatarPreco(plan.price_monthly)}</p>
                      {Number(plan.price_annually) > 0 && (
                        <p className={`text-xs mt-1 ${featured ? 'text-blue-100' : 'text-slate-500'}`}>
                          {formatarPreco(plan.price_annually ?? 0)}/ano
                        </p>
                      )}
                    </>
                  )}
                </div>
                <ul className="mt-6 space-y-2 text-sm">
                  {highlights.map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${featured ? 'bg-amber-200' : 'bg-emerald-600'}`} />
                      {item}
                    </li>
                  ))}
                </ul>
                <a
                  href={plan.is_price_on_request ? '#contato' : `/pre-cadastro?plan=${plan.slug}`}
                  className={`mt-6 inline-flex w-full justify-center px-4 py-2 rounded-full font-semibold transition ${
                    featured
                      ? 'bg-amber-300 text-slate-900 hover:bg-amber-200'
                      : plan.is_price_on_request
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-emerald-700 text-white hover:bg-emerald-800'
                  }`}
                >
                  {plan.is_price_on_request ? 'Falar com consultor' : 'Teste grátis por 7 dias'}
                </a>
                <button
                  type="button"
                  onClick={() => setExpandedPlanId(isExpanded ? null : plan.id)}
                  className={`mt-3 flex w-fit items-center justify-center gap-2 text-sm mx-auto ${
                    featured ? 'text-blue-100 hover:text-white' : 'text-slate-500 hover:text-slate-700'
                  }`}
                  aria-expanded={isExpanded}
                >
                  Módulos inclusos
                  <span className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
                </button>
                <div className={`mt-4 overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[360px] opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className={`rounded-xl border p-4 space-y-4 ${
                    featured ? 'bg-white/90 border-white/30 text-slate-900' : 'bg-white border-slate-200'
                  }`}>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{modulePack.label}</p>
                      {modules.length > 0 ? (
                        <ul className="mt-2 space-y-2 text-sm text-slate-600">
                          {modules.map((item) => (
                            <li key={item} className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-emerald-600" />
                              <span className={item.startsWith('Todos do ') ? 'font-semibold text-slate-900' : ''}>
                                {item}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-slate-500">Sem módulos adicionais incluídos.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section id="faq" className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-700">Perguntas frequentes</p>
          <h2 className="landing-title text-3xl">Tire suas dúvidas</h2>
        </div>
        <div className="grid gap-4">
          {faqs.map((faq) => (
            <details key={faq.question} className="bg-white border border-[#e7e0d6] rounded-xl p-5 hover:shadow-md transition cursor-pointer group">
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
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-700">Fale com nossa equipe</p>
            <h2 className="landing-title text-3xl">Atendimento consultivo, do início ao fim</h2>
            <p className="text-slate-600 mt-3">
              Nosso time está pronto para entender a realidade da sua igreja e ajudar você a tirar o máximo do Gestão Eklésia — desde a demonstração até a implantação completa.
            </p>
            <div className="mt-8 space-y-4 text-sm text-slate-700">
              <div className="flex items-start gap-3">
                <span className="text-emerald-600 text-base mt-0.5">✦</span>
                <div>
                  <p className="font-semibold">Demonstração personalizada</p>
                  <p className="text-slate-500 text-xs mt-0.5">Mostramos o sistema funcionando com os dados da sua realidade — via videochamada, sem compromisso.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-emerald-600 text-base mt-0.5">✦</span>
                <div>
                  <p className="font-semibold">Trial de 7 dias acompanhado</p>
                  <p className="text-slate-500 text-xs mt-0.5">Você experimenta o sistema completo enquanto nossa equipe te guia nas configurações iniciais.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-emerald-600 text-base mt-0.5">✦</span>
                <div>
                  <p className="font-semibold">Implantação estruturada</p>
                  <p className="text-slate-500 text-xs mt-0.5">Apoio no cadastro de membros, configuração de módulos e treinamento da equipe administrativa.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-emerald-600 text-base mt-0.5">✦</span>
                <div>
                  <p className="font-semibold">Suporte contínuo</p>
                  <p className="text-slate-500 text-xs mt-0.5">Segunda a sexta, 9h às 18h (Brasília). Respondemos em até 24h úteis.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white border border-[#e7e0d6] rounded-2xl p-6 shadow-lg">
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
                placeholder="Nome da sua igreja ou ministério"
                className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <input
                type="text"
                name="pastor"
                value={contactData.pastor}
                onChange={handleContactChange}
                placeholder="Seu nome completo"
                className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  name="whatsapp"
                  value={contactData.whatsapp}
                  onChange={handleContactChange}
                  placeholder="WhatsApp (com DDD)"
                  className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="email"
                  name="email"
                  value={contactData.email}
                  onChange={handleContactChange}
                  placeholder="Email para contato"
                  className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <textarea
                name="mensagem"
                value={contactData.mensagem}
                onChange={handleContactChange}
                rows={4}
                placeholder="Conte-nos um pouco sobre sua igreja ou como podemos ajudar..."
                className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-3 bg-emerald-700 text-white rounded-lg font-bold hover:bg-emerald-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Enviando...' : 'Quero falar com um consultor'}
              </button>
              <p className="text-xs text-slate-500">
                Ao enviar, você concorda com nossa política de privacidade.
              </p>
            </form>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-10 text-center text-xs text-slate-500">
        Gestão Eklesia — tecnologia para igrejas. Desenvolvido por Moove Sistemas.
      </footer>
    </div>
  );
}
