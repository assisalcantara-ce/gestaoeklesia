'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { BRAND } from '@/config/brand';
import NotificationModal from '@/components/NotificationModal';
import { formatPhone } from '@/lib/mascaras';
import { createClient } from '@/lib/supabase-client';
import { formatarPreco } from '@/config/plans';
import { Users, CircleDollarSign, Calendar, BarChart3, ArrowRight, Play, CheckCircle2, ShieldCheck, Target, ChevronDown, Sparkles, Check } from 'lucide-react';

const pillars = [
  {
    title: 'Secretaria que organiza',
    text: 'Documentos, certificados e cadastros sempre atualizados e prontos para consulta.'
  },
  {
    title: 'Finanças sob controle',
    text: 'Tesouraria, receitas, despesas e relatórios em um fluxo confiável, transparente e simples.'
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
    text: 'Controle de itens encontrados e devoluções com registro de histórico.',
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
    title: 'Comissões',
    text: 'Gestão de comissões, equipes e atas com total clareza.',
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
    title: 'Funcionários',
    text: 'Controle de equipe com dados, cargos e situação cadastral.',
    bullets: ['Dados e documentos', 'Cargos e setores', 'Status ativo'],
    icon: '👔'
  },
  {
    title: 'Reuniões',
    text: 'Pautas, atas e participantes em um fluxo simples e integrado.',
    bullets: ['Convocações', 'Atas', 'Participantes'],
    icon: '🤝'
  },
  {
    title: 'Presidência',
    text: 'Visão executiva com indicadores consolidados e aprovações.',
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
    text: 'Lançamentos e conciliações financeiras organizadas.',
    bullets: ['Entradas e saídas', 'Conferência', 'Histórico'],
    icon: '💼'
  },
  {
    title: 'EBD',
    text: 'Escola Bíblica Dominical com classes, professores e presença.',
    bullets: ['Classes e professores', 'Presença', 'Conteúdos'],
    icon: '📘'
  },
  {
    title: 'Auditoria',
    text: 'Rastreabilidade completa de acessos e ações no sistema.',
    bullets: ['Registro de ações', 'Alertas', 'Conformidade'],
    icon: '✅'
  },
  {
    title: 'Chat Interno',
    text: 'Comunicação rápida e segura entre setores e equipes.',
    bullets: ['Canais por área', 'Mensagens rápidas', 'Histórico'],
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
    text: 'Relatórios, auditoria e indicadores para tomada de decisão segura.'
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
    answer: 'A configuração inicial pode ser feita em poucas horas. A nossa equipe de integração acompanha a sua igreja durante toda a implantação.'
  },
  {
    question: 'Consigo personalizar documentos e cartões de membro?',
    answer: 'Sim. Você pode configurar modelos oficiais, cores, logotipo e documentos com validação por QR Code.'
  },
  {
    question: 'O suporte técnico está incluso?',
    answer: 'Sim. Todos os planos incluem suporte contínuo e acompanhamento dedicado na implantação.'
  },
  {
    question: 'Os dados da minha igreja estão seguros?',
    answer: 'Sim. Utilizamos infraestrutura enterprise (PostgreSQL/Supabase), criptografia ponta a ponta SSL/TLS, rotinas de backup diário e total conformidade com a LGPD.'
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
    <div className="min-h-screen bg-[#021815] text-slate-100 selection:bg-emerald-500 selection:text-black">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=DM+Serif+Display&display=swap');
        :root {
          --landing-bg: #021815;
          --landing-card: #03231f;
          --landing-ink: #f1f5f9;
          --landing-muted: #94a3b8;
          --landing-accent: #10b981;
          --landing-warm: #f59e0b;
          --landing-line: rgba(16, 185, 129, 0.15);
        }
        body {
          font-family: 'Space Grotesk', 'Segoe UI', sans-serif;
          background: #021815;
          color: #f1f5f9;
        }
        .landing-title {
          font-family: 'DM Serif Display', 'Georgia', serif;
          letter-spacing: -0.01em;
        }
        .landing-orb {
          position: absolute;
          border-radius: 9999px;
          filter: blur(70px);
          opacity: 0.25;
          animation: float 12s ease-in-out infinite;
        }
        .landing-orb.orb-a {
          width: 420px;
          height: 420px;
          background: #059669;
          top: -140px;
          left: -120px;
        }
        .landing-orb.orb-b {
          width: 520px;
          height: 520px;
          background: #0f766e;
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

      {/* Cabeçalho Horizontal no Topo */}
      <header className="sticky top-0 z-40 bg-[#021815]/90 backdrop-blur-md border-b border-emerald-900/40">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src={BRAND.logoHorizontal}
              alt="Gestão Eklésia"
              width={160}
              height={44}
              priority
              sizes="160px"
              className="h-9 sm:h-10 w-auto object-contain brightness-110 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]"
            />
          </div>
          
          <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-emerald-100/70">
            <a href="#visao" className="text-emerald-400 font-semibold border-b-2 border-emerald-400 pb-0.5 transition">Início</a>
            <a href="#modulos" className="hover:text-emerald-300 transition">Funcionalidades</a>
            <a href="#planos" className="hover:text-emerald-300 transition">Planos</a>
            <a href="#telas" className="hover:text-emerald-300 transition">Demonstração</a>
            <a href="#contato" className="hover:text-emerald-300 transition">Contato</a>
          </nav>

          <div className="flex items-center gap-3">
            <a
              href={`${process.env.NEXT_PUBLIC_APP_URL || 'https://app.gestaoeklesia.com.br'}/login`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-600/50 hover:border-emerald-400 text-xs sm:text-sm font-medium transition shadow-lg shadow-emerald-950/50 group"
            >
              <span>Entrar no Sistema</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section Reformulada com a Imagem de Alta Definição hero3.png */}
      <section
        id="visao"
        className="relative min-h-[640px] lg:min-h-[720px] overflow-hidden bg-[#021815] text-white border-b border-emerald-950 flex flex-col justify-between"
      >
        {/* Imagem de Fundo Oficial com Laptop e Ambiente */}
        <div 
          className="pointer-events-none absolute inset-0 bg-cover bg-[75%_center] sm:bg-right lg:bg-center z-0"
          style={{
            backgroundImage: "url('/img/hero3.png')",
          }}
        />

        {/* Gradiente Escuro Suave no Lado Esquerdo para Legibilidade Perfeita dos Textos */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#021815] via-[#021815]/95 sm:via-[#021815]/85 md:via-[#021815]/70 lg:via-[#021815]/50 to-transparent z-0" />
        
        {/* Iluminação Esmeralda de Fundo */}
        <div className="pointer-events-none absolute top-0 left-0 w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-3xl z-0" />
        <div className="pointer-events-none absolute bottom-0 right-10 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-3xl z-0" />

        <div className="relative z-10 max-w-7xl w-full mx-auto px-5 sm:px-8 pt-12 pb-16 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          
          {/* Coluna Esquerda: Conteúdo Institucional com Contraste Perfeito */}
          <div className="lg:col-span-7 xl:col-span-6 flex flex-col justify-center space-y-6">
            
            {/* Tag / Badge com detalhe luminoso */}
            <div className="inline-flex items-center gap-2.5">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.25em] text-emerald-400">
                TECNOLOGIA A SERVIÇO DO REINO
              </span>
              <span className="h-0.5 w-8 bg-emerald-500/60 rounded-full" />
            </div>

            {/* Título Principal */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.25rem] font-extrabold text-white tracking-tight leading-[1.12]">
              Gestão completa <br />
              para uma igreja <br />
              <span className="text-emerald-400 drop-shadow-[0_0_25px_rgba(52,211,153,0.35)]">
                mais forte
              </span>
            </h1>

            {/* Descrição */}
            <p className="text-sm sm:text-base text-emerald-100/85 leading-relaxed max-w-xl font-normal">
              O Gestão Eklésia é a plataforma ideal para igrejas, ministérios e campos que desejam organizar sua administração, fortalecer a comunhão e cumprir sua missão com excelência.
            </p>

            {/* Grid de 4 Benefícios com Ícones em Cards Verdes Escuros */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              <div className="p-3 rounded-xl bg-[#021815]/85 border border-emerald-800/40 hover:border-emerald-500/50 transition backdrop-blur-md">
                <div className="w-8 h-8 rounded-lg bg-emerald-950/90 border border-emerald-700/50 flex items-center justify-center text-emerald-400 mb-2">
                  <Users className="w-4 h-4" />
                </div>
                <h2 className="text-xs font-bold text-white tracking-wide">Membros</h2>
                <p className="text-[11px] text-emerald-200/70 leading-tight mt-0.5">Cadastro e acompanhamento</p>
              </div>

              <div className="p-3 rounded-xl bg-[#021815]/85 border border-emerald-800/40 hover:border-emerald-500/50 transition backdrop-blur-md">
                <div className="w-8 h-8 rounded-lg bg-emerald-950/90 border border-emerald-700/50 flex items-center justify-center text-emerald-400 mb-2">
                  <CircleDollarSign className="w-4 h-4" />
                </div>
                <h2 className="text-xs font-bold text-white tracking-wide">Financeiro</h2>
                <p className="text-[11px] text-emerald-200/70 leading-tight mt-0.5">Dízimos, ofertas e relatórios</p>
              </div>

              <div className="p-3 rounded-xl bg-[#021815]/85 border border-emerald-800/40 hover:border-emerald-500/50 transition backdrop-blur-md">
                <div className="w-8 h-8 rounded-lg bg-emerald-950/90 border border-emerald-700/50 flex items-center justify-center text-emerald-400 mb-2">
                  <Calendar className="w-4 h-4" />
                </div>
                <h2 className="text-xs font-bold text-white tracking-wide">Eventos</h2>
                <p className="text-[11px] text-emerald-200/70 leading-tight mt-0.5">Cultos, reuniões e atividades</p>
              </div>

              <div className="p-3 rounded-xl bg-[#021815]/85 border border-emerald-800/40 hover:border-emerald-500/50 transition backdrop-blur-md">
                <div className="w-8 h-8 rounded-lg bg-emerald-950/90 border border-emerald-700/50 flex items-center justify-center text-emerald-400 mb-2">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <h2 className="text-xs font-bold text-white tracking-wide">Relatórios</h2>
                <p className="text-[11px] text-emerald-200/70 leading-tight mt-0.5">Informações para decisões</p>
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href="/pre-cadastro?plan=starter&trial=true"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition shadow-lg shadow-emerald-900/50 cursor-pointer group"
              >
                <span>Comece agora</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </a>

              <a
                href="#telas"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#021815]/80 hover:bg-emerald-950 text-emerald-100 border border-emerald-700/40 hover:border-emerald-500/60 font-medium text-sm transition backdrop-blur-md cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                <span>Conheça a plataforma</span>
              </a>
            </div>

            {/* Versículo / Citação Bíblica em destaque */}
            <div className="pt-2 border-l-2 border-emerald-500/60 pl-3">
              <p className="text-xs text-emerald-200/90 italic">
                “Todas as coisas cooperam para o bem daqueles que amam a Deus.”
              </p>
              <p className="text-[11px] font-semibold text-emerald-400 mt-0.5">
                Romanos 8:28
              </p>
            </div>
          </div>

          {/* Coluna Direita: Badges Flutuantes Discretos sobre o Fundo do Laptop */}
          <div className="hidden lg:flex lg:col-span-5 xl:col-span-6 relative h-full min-h-[380px] flex-col justify-between items-end pointer-events-none">
            
            {/* Badge Superior Direito */}
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#021815]/80 border border-emerald-500/40 backdrop-blur-md shadow-2xl text-xs font-medium text-emerald-100">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Dados seguros e confiáveis</span>
            </div>

            {/* Badge Inferior Direito */}
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#021815]/80 border border-emerald-500/40 backdrop-blur-md shadow-2xl text-xs font-medium text-emerald-100">
              <Target className="w-4 h-4 text-emerald-400" />
              <span>Mais tempo para a missão</span>
            </div>

          </div>
        </div>

        {/* Faixa de Métricas Rápidas */}
        <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 pb-12">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-emerald-900/40">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="bg-[#03231f]/60 border border-emerald-800/30 rounded-2xl p-4 sm:p-5 flex items-center justify-between"
              >
                <div>
                  <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{metric.value}</p>
                  <p className="text-xs sm:text-sm text-emerald-200/70 mt-0.5">{metric.label}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Seção Dores / Problemas que resolvemos */}
      <section id="dores" className="max-w-7xl mx-auto px-5 sm:px-8 py-20 border-b border-emerald-950/60">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] items-center">
          <div>
            <div className="inline-flex items-center gap-2.5 mb-3">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.25em] text-emerald-400">
                PROBLEMAS QUE RESOLVEMOS
              </span>
              <span className="h-0.5 w-8 bg-emerald-500/60 rounded-full" />
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Sua igreja não precisa depender de planilhas, cadernos e informações espalhadas.
            </h2>
            <p className="text-emerald-100/75 mt-4 text-sm sm:text-base leading-relaxed">
              O Gestão Eklésia centraliza a rotina administrativa para que líderes tenham mais clareza, equipes trabalhem com menos retrabalho e a igreja cresça com organização.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ['Membros sem acompanhamento', 'Cadastre, acompanhe o histórico ministerial e mantenha dados sempre atualizados.'],
              ['Finanças pouco transparentes', 'Registre entradas, saídas, categorias e relatórios com total segurança.'],
              ['Documentos dispersos', 'Organize cartas, certificados, atas e registros em um único lugar seguro.'],
              ['Liderança sem visão geral', 'Acompanhe indicadores, auditoria e módulos estratégicos em tempo real.'],
            ].map(([title, text]) => (
              <div
                key={title}
                className="bg-[#03231f]/70 border border-emerald-800/40 hover:border-emerald-500/50 rounded-2xl p-5 sm:p-6 transition duration-300 backdrop-blur-sm group hover:-translate-y-0.5 shadow-lg shadow-black/20"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-700/50 flex items-center justify-center text-emerald-400 mb-3 group-hover:scale-105 transition">
                  <Check className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-white text-base group-hover:text-emerald-300 transition">{title}</h3>
                <p className="text-xs sm:text-sm text-emerald-200/70 mt-2 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Seção Telas / Galeria Demonstrativa */}
      <section id="telas" className="max-w-7xl mx-auto px-5 sm:px-8 py-20 border-b border-emerald-950/60">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.25em] text-emerald-400">
              VEJA NA PRÁTICA
            </span>
            <span className="h-0.5 w-8 bg-emerald-500/60 rounded-full" />
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
            Veja o Gestão Eklésia em funcionamento
          </h2>
          <p className="text-emerald-100/75 mt-3 text-sm sm:text-base">
            Conheça as telas que ajudam sua equipe a organizar membros, finanças, eventos e relatórios no dia a dia.
          </p>
        </div>
        
        <div
          className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory md:justify-center touch-manipulation rounded-3xl border border-emerald-800/40 p-5 bg-[#021815]/90 backdrop-blur-md shadow-2xl"
          style={{
            backgroundImage: "url('/img/bgslider.png')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            minHeight: '230px',
          }}
        >
          {gallery.map((item) => (
            <div
              key={item.src}
              className="bg-[#03231f]/90 border border-emerald-800/50 hover:border-emerald-400/70 rounded-2xl p-2.5 shadow-xl transition-all duration-300 shrink-0 min-w-[160px] sm:min-w-[200px] lg:min-w-[240px] max-w-[240px] snap-start select-none touch-manipulation cursor-pointer group hover:-translate-y-1"
              onClick={() => setSelectedImage(item)}
            >
              <img
                src={item.src}
                alt={item.alt}
                className="w-full h-32 sm:h-36 lg:h-40 object-cover rounded-xl border border-emerald-900/60 group-hover:brightness-105 transition"
                loading="lazy"
                draggable={false}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Seção Módulos e Pilares */}
      <section id="modulos" className="max-w-7xl mx-auto px-5 sm:px-8 py-20 border-b border-emerald-950/60">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.25em] text-emerald-400">
              NOSSOS PILARES
            </span>
            <span className="h-0.5 w-8 bg-emerald-500/60 rounded-full" />
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
            Tudo o que sua igreja precisa, em um único sistema
          </h2>
          <p className="text-emerald-100/75 mt-3 text-sm sm:text-base">
            Da secretaria ao financeiro, tudo conectado para sua igreja crescer com organização, segurança e transparência.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 mb-12">
          {pillars.map((card) => (
            <div
              key={card.title}
              className="bg-[#03231f]/70 border border-emerald-800/40 hover:border-emerald-500/50 rounded-2xl p-6 sm:p-7 shadow-xl transition duration-300 backdrop-blur-sm hover:-translate-y-1"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-700/50 flex items-center justify-center text-emerald-400 mb-4 shadow-md">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white tracking-wide">{card.title}</h3>
              <p className="text-sm text-emerald-200/75 mt-2.5 leading-relaxed">{card.text}</p>
            </div>
          ))}
        </div>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setShowModules((value) => !value)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-600/50 hover:border-emerald-400 font-semibold text-sm transition shadow-lg shadow-emerald-950/50 cursor-pointer"
          >
            <span>{showModules ? 'Ocultar módulos' : 'Ver todos os módulos'}</span>
            <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${showModules ? 'rotate-180' : ''}`} />
          </button>
        </div>

        <div className={`mt-10 ${showModules ? '' : 'hidden'}`}>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {modules.map((feature) => (
              <div
                key={feature.title}
                className="bg-gradient-to-br from-[#03231f] to-[#021815] border border-emerald-800/40 hover:border-emerald-500/50 rounded-2xl p-5 sm:p-6 transition duration-300 shadow-xl"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base font-bold text-white">{feature.title}</h3>
                  <span className="text-2xl">{feature.icon}</span>
                </div>
                <p className="text-xs text-emerald-200/70 mt-1 leading-relaxed">{feature.text}</p>
                <ul className="mt-4 space-y-1.5 text-xs text-emerald-100/80">
                  {feature.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Seção Fluxo de Trabalho */}
      <section id="fluxo" className="max-w-7xl mx-auto px-5 sm:px-8 py-20 border-b border-emerald-950/60">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] items-center">
          <div>
            <div className="inline-flex items-center gap-2.5 mb-3">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.25em] text-emerald-400">
                FLUXO DE TRABALHO
              </span>
              <span className="h-0.5 w-8 bg-emerald-500/60 rounded-full" />
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
              Uma jornada simples, clara e previsível
            </h2>
            <p className="text-emerald-100/75 mt-4 text-sm sm:text-base leading-relaxed">
              Do cadastro inicial aos relatórios finais. Tudo conectado e com visibilidade para líderes e equipes.
            </p>
            <div className="mt-8 space-y-6">
              {journey.map((item) => (
                <div key={item.step} className="flex gap-4 items-start">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-emerald-900/90 border border-emerald-600/50 text-emerald-300 flex items-center justify-center font-bold text-sm shadow-md">
                    {item.step}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">{item.title}</h3>
                    <p className="text-xs sm:text-sm text-emerald-200/70 mt-1 leading-relaxed">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#03231f]/80 border border-emerald-800/40 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
            <h3 className="text-lg font-bold text-white tracking-wide">Resumo operacional</h3>
            <p className="text-xs sm:text-sm text-emerald-200/70 mt-1.5">O que sua equipe acompanha em um único painel integrado.</p>
            <div className="mt-6 space-y-3">
              {['Secretaria ativa e organizada', 'Financeiro consolidado com auditoria', 'Indicadores de crescimento em tempo real'].map((item) => (
                <div key={item} className="flex items-center justify-between rounded-xl border border-emerald-800/30 bg-[#021815]/60 p-4">
                  <span className="text-sm font-medium text-emerald-100">{item}</span>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-emerald-950 border border-emerald-600/40 text-emerald-400">
                    CONECTADO
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-xl border border-emerald-700/40 bg-gradient-to-r from-emerald-950/60 to-[#02211c] p-4 flex items-center gap-3.5">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-400 font-bold">Acompanhamento contínuo</p>
                <p className="text-sm font-semibold text-white mt-0.5">Equipe alinhada, dados seguros e sem retrabalho</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Seção Planos */}
      <section id="planos" className="max-w-7xl mx-auto px-5 sm:px-8 py-20 border-b border-emerald-950/60">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.25em] text-emerald-400">
              PLANOS QUE CRESCEM COM VOCÊ
            </span>
            <span className="h-0.5 w-8 bg-emerald-500/60 rounded-full" />
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
            Escolha o plano ideal para sua igreja
          </h2>
          <p className="text-emerald-100/75 mt-3 text-sm sm:text-base">
            Todos incluem suporte dedicado, onboarding e 7 dias de teste gratuito sem compromisso.
          </p>
        </div>

        {planosLanding.length === 0 && (
          <p className="text-center text-emerald-300/50 text-sm py-8">Carregando planos disponíveis...</p>
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
                className={`rounded-2xl p-6 border transition duration-300 self-start backdrop-blur-md ${
                  featured
                    ? 'bg-gradient-to-b from-[#04332c] to-[#02211c] text-white border-2 border-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.2)] lg:-translate-y-2 relative'
                    : 'bg-[#03231f]/70 text-white border-emerald-800/40 hover:border-emerald-500/50 shadow-xl'
                }`}
              >
                {featured && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="inline-flex text-[11px] font-bold uppercase tracking-wider bg-amber-400 text-slate-950 px-3 py-1 rounded-full shadow-md">
                      Mais popular
                    </span>
                  </div>
                )}
                <h3 className="text-xl font-bold mt-2 text-white">{plan.name}</h3>
                <p className="text-xs text-emerald-200/70 mt-2 min-h-[36px]">
                  {plan.description || ''}
                </p>
                <div className="mt-4 pt-3 border-t border-emerald-800/40">
                  {plan.is_price_on_request ? (
                    <p className="text-2xl font-bold text-white">Consulte-nos</p>
                  ) : (
                    <>
                      <p className="text-3xl font-extrabold text-white tracking-tight">{formatarPreco(plan.price_monthly)}</p>
                      {Number(plan.price_annually) > 0 && (
                        <p className="text-xs mt-1 text-emerald-300/70">
                          {formatarPreco(plan.price_annually ?? 0)}/ano
                        </p>
                      )}
                    </>
                  )}
                </div>

                <ul className="mt-6 space-y-2.5 text-xs text-emerald-100/90">
                  {highlights.map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${featured ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]' : 'bg-emerald-400'}`} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href={plan.is_price_on_request ? '#contato' : `/pre-cadastro?plan=${plan.slug}`}
                  className={`mt-6 inline-flex w-full justify-center px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer shadow-lg ${
                    featured
                      ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-amber-950/50'
                      : plan.is_price_on_request
                        ? 'bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-600/50'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50'
                  }`}
                >
                  {plan.is_price_on_request ? 'Falar com consultor' : 'Teste grátis por 7 dias'}
                </a>

                <button
                  type="button"
                  onClick={() => setExpandedPlanId(isExpanded ? null : plan.id)}
                  className="mt-3.5 flex w-fit items-center justify-center gap-1.5 text-xs mx-auto text-emerald-300/80 hover:text-emerald-200 transition cursor-pointer"
                  aria-expanded={isExpanded}
                >
                  <span>Módulos inclusos</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                </button>

                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[360px] opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
                  <div className="rounded-xl border border-emerald-800/40 bg-[#021815]/90 p-3.5 space-y-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">{modulePack.label}</p>
                      {modules.length > 0 ? (
                        <ul className="mt-2 space-y-1.5 text-xs text-emerald-200/80">
                          {modules.map((item) => (
                            <li key={item} className="flex items-center gap-2">
                              <span className="h-1 w-1 rounded-full bg-emerald-400" />
                              <span className={item.startsWith('Todos do ') ? 'font-bold text-white' : ''}>
                                {item}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-xs text-emerald-400/50">Sem módulos adicionais incluídos.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Seção Perguntas Frequentes (FAQ) */}
      <section id="faq" className="max-w-4xl mx-auto px-5 sm:px-8 py-20 border-b border-emerald-950/60">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.25em] text-emerald-400">
              PERGUNTAS FREQUENTES
            </span>
            <span className="h-0.5 w-8 bg-emerald-500/60 rounded-full" />
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
            Tire suas dúvidas
          </h2>
        </div>
        <div className="grid gap-3.5">
          {faqs.map((faq) => (
            <details
              key={faq.question}
              className="bg-[#03231f]/60 border border-emerald-800/30 hover:border-emerald-500/40 rounded-xl p-5 transition duration-200 text-white group"
            >
              <summary className="font-semibold text-white cursor-pointer flex justify-between items-center text-sm sm:text-base select-none">
                <span>{faq.question}</span>
                <ChevronDown className="w-4 h-4 ml-2 text-emerald-400 group-open:rotate-180 transition-transform duration-300 shrink-0" />
              </summary>
              <p className="text-xs sm:text-sm text-emerald-100/75 mt-3 leading-relaxed border-t border-emerald-800/30 pt-3">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* Seção Contato */}
      <section id="contato" className="max-w-7xl mx-auto px-5 sm:px-8 py-20 border-b border-emerald-950/60">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr] items-start">
          <div>
            <div className="inline-flex items-center gap-2.5 mb-3">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.25em] text-emerald-400">
                FALE COM NOSSA EQUIPE
              </span>
              <span className="h-0.5 w-8 bg-emerald-500/60 rounded-full" />
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
              Atendimento consultivo, do início ao fim
            </h2>
            <p className="text-emerald-100/75 mt-4 text-sm sm:text-base leading-relaxed">
              Nosso time está pronto para entender a realidade da sua igreja e ajudar você a tirar o máximo proveito do Gestão Eklésia — desde a demonstração até a implantação completa.
            </p>
            <div className="mt-8 space-y-4 text-sm">
              <div className="flex items-start gap-3.5 bg-[#03231f]/40 border border-emerald-800/30 rounded-xl p-3.5">
                <span className="text-emerald-400 font-bold text-base mt-0.5">✦</span>
                <div>
                  <p className="font-semibold text-white">Demonstração personalizada</p>
                  <p className="text-emerald-200/70 text-xs mt-0.5 leading-relaxed">Mostramos o sistema funcionando com foco na realidade da sua igreja — via videochamada, sem compromisso.</p>
                </div>
              </div>
              <div className="flex items-start gap-3.5 bg-[#03231f]/40 border border-emerald-800/30 rounded-xl p-3.5">
                <span className="text-emerald-400 font-bold text-base mt-0.5">✦</span>
                <div>
                  <p className="font-semibold text-white">Trial de 7 dias com acompanhamento</p>
                  <p className="text-emerald-200/70 text-xs mt-0.5 leading-relaxed">Você experimenta o sistema completo enquanto nossa equipe guia sua igreja nas configurações iniciais.</p>
                </div>
              </div>
              <div className="flex items-start gap-3.5 bg-[#03231f]/40 border border-emerald-800/30 rounded-xl p-3.5">
                <span className="text-emerald-400 font-bold text-base mt-0.5">✦</span>
                <div>
                  <p className="font-semibold text-white">Implantação estruturada</p>
                  <p className="text-emerald-200/70 text-xs mt-0.5 leading-relaxed">Apoio no cadastro inicial de membros, configuração de módulos e capacitação da equipe administrativa.</p>
                </div>
              </div>
              <div className="flex items-start gap-3.5 bg-[#03231f]/40 border border-emerald-800/30 rounded-xl p-3.5">
                <span className="text-emerald-400 font-bold text-base mt-0.5">✦</span>
                <div>
                  <p className="font-semibold text-white">Suporte contínuo</p>
                  <p className="text-emerald-200/70 text-xs mt-0.5 leading-relaxed">De segunda a sexta, das 9h às 18h (horário de Brasília). Atendimento ágil e atencioso.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#03231f]/80 border border-emerald-800/50 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
            <form onSubmit={handleContactSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-950/80 border border-red-500/50 text-sm text-red-200 p-3.5 rounded-xl">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-emerald-300/80 mb-1">Nome da Igreja / Ministério</label>
                <input
                  type="text"
                  name="ministerio"
                  value={contactData.ministerio}
                  onChange={handleContactChange}
                  placeholder="Ex: Igreja Batista Central"
                  className="w-full px-4 py-3 rounded-xl bg-[#021815]/90 border border-emerald-800/50 text-white placeholder:text-emerald-300/30 text-sm focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-emerald-300/80 mb-1">Seu Nome Completo</label>
                <input
                  type="text"
                  name="pastor"
                  value={contactData.pastor}
                  onChange={handleContactChange}
                  placeholder="Ex: Pr. João Silva"
                  className="w-full px-4 py-3 rounded-xl bg-[#021815]/90 border border-emerald-800/50 text-white placeholder:text-emerald-300/30 text-sm focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-emerald-300/80 mb-1">WhatsApp</label>
                  <input
                    type="text"
                    name="whatsapp"
                    value={contactData.whatsapp}
                    onChange={handleContactChange}
                    placeholder="(00) 00000-0000"
                    className="w-full px-4 py-3 rounded-xl bg-[#021815]/90 border border-emerald-800/50 text-white placeholder:text-emerald-300/30 text-sm focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-emerald-300/80 mb-1">E-mail</label>
                  <input
                    type="email"
                    name="email"
                    value={contactData.email}
                    onChange={handleContactChange}
                    placeholder="contato@igreja.com.br"
                    className="w-full px-4 py-3 rounded-xl bg-[#021815]/90 border border-emerald-800/50 text-white placeholder:text-emerald-300/30 text-sm focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-emerald-300/80 mb-1">Mensagem (opcional)</label>
                <textarea
                  name="mensagem"
                  value={contactData.mensagem}
                  onChange={handleContactChange}
                  rows={3}
                  placeholder="Conte-nos sobre a estrutura da sua igreja ou suas dúvidas..."
                  className="w-full px-4 py-3 rounded-xl bg-[#021815]/90 border border-emerald-800/50 text-white placeholder:text-emerald-300/30 text-sm focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition shadow-lg shadow-emerald-950 cursor-pointer disabled:opacity-50 text-sm"
              >
                {loading ? 'Enviando...' : 'Quero falar com um consultor'}
              </button>
              <p className="text-[11px] text-emerald-300/50 text-center">
                Ao enviar, você concorda com nossa política de privacidade. Seus dados estão seguros.
              </p>
            </form>
          </div>
        </div>
      </section>

      {/* Rodapé Oficial */}
      <footer className="border-t border-emerald-950/80 py-10 text-center text-xs text-emerald-300/60 bg-[#011210]">
        Gestão Eklésia — Tecnologia para igrejas. Desenvolvido por {BRAND.company}.
      </footer>
    </div>
  );
}
