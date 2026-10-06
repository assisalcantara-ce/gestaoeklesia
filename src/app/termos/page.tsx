import type { Metadata } from 'next'
import Link from 'next/link'
import { BRAND } from '@/config/brand'
import {
  FileText,
  ArrowLeft,
  CheckCircle2,
  Layers,
  UserCheck,
  ShieldAlert,
  Users,
  Database,
  Activity,
  Award,
  AlertTriangle,
  Scale,
  RefreshCw,
  Mail,
  ShieldCheck,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Termos de Uso | Gestão Eklésia',
  description: 'Conheça os Termos de Uso e Condições Gerais de Prestação de Serviços da plataforma Gestão Eklésia.',
}

export default function TermosPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col selection:bg-teal-500 selection:text-white">
      {/* ── CABEÇALHO INSTITUCIONAL ── */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group transition">
            <div className="w-10 h-10 rounded-xl bg-[#0B3B82] flex items-center justify-center text-white shadow-sm shadow-blue-900/20 group-hover:bg-[#08295b] transition">
              <FileText className="w-5 h-5 text-teal-300" />
            </div>
            <div>
              <span className="text-lg font-bold text-slate-900 tracking-tight block leading-tight">
                {BRAND.name}
              </span>
              <span className="text-[11px] font-semibold text-teal-700 uppercase tracking-wider block">
                Termos & Condições
              </span>
            </div>
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:text-[#0B3B82] bg-slate-100 hover:bg-slate-200/80 rounded-xl transition border border-slate-200/80 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para o início</span>
          </Link>
        </div>
      </header>

      {/* ── HERO BANNER INSTITUCIONAL ── */}
      <section className="bg-gradient-to-b from-[#091a3e] via-[#0B2559] to-[#0d2f6f] text-white py-14 sm:py-20 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-500/10 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-500/15 border border-teal-400/30 text-teal-300 text-xs font-semibold tracking-wide uppercase">
            <Scale className="w-3.5 h-3.5" />
            <span>Condições Gerais de Serviço</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white">
            Termos de Uso
          </h1>
          <p className="text-sm sm:text-base text-blue-100/90 max-w-2xl mx-auto leading-relaxed">
            Regras, diretrizes e responsabilidades para a utilização da plataforma {BRAND.name} por instituições religiosas, líderes e membros.
          </p>
          <p className="text-xs text-blue-200/70 pt-2">
            Última atualização: Outubro de 2026
          </p>
        </div>
      </section>

      {/* ── CONTEÚDO PRINCIPAL (LEITURA CONFORTÁVEL) ── */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-8">

        {/* 1. Aceitação dos Termos */}
        <section className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-[#0B3B82]">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0B3B82]">
              <CheckCircle2 className="w-5 h-5 text-teal-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">1. Aceitação dos Termos</h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Estes Termos de Uso regulam o acesso e a utilização dos serviços oferecidos pela plataforma <strong>{BRAND.name}</strong>, de propriedade da <strong>{BRAND.company}</strong>.
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">
            Ao se cadastrar, navegar ou utilizar qualquer funcionalidade do sistema, você ou a instituição eclesiástica que você representa declara expressamente que leu, compreendeu e concorda com todas as disposições destes Termos de Uso e de nossa Política de Privacidade.
          </p>
        </section>

        {/* 2. Definição da Plataforma */}
        <section className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-[#0B3B82]">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0B3B82]">
              <Layers className="w-5 h-5 text-teal-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">2. Definição da Plataforma</h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            A {BRAND.name} é um software disponibilizado na modalidade de <em>Software as a Service</em> (SaaS), desenvolvido especialmente para a gestão eclesiástica integrada.
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">
            A plataforma inclui recursos de gestão de membros, secretarias, relatórios de cultos, reuniões ministeriais, controle patrimonial, emissão de credenciais com validação pública por QR Code, cartas de recomendação e acompanhamento administrativo.
          </p>
        </section>

        {/* 3. Cadastro e Responsabilidades do Usuário */}
        <section className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-[#0B3B82]">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0B3B82]">
              <UserCheck className="w-5 h-5 text-teal-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">3. Cadastro e Responsabilidades do Usuário</h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            O usuário e a instituição contratante são integralmente responsáveis por:
          </p>
          <ul className="list-disc pl-5 text-sm text-slate-600 space-y-2">
            <li>Fornecer dados cadastrais autênticos, precisos e devidamente atualizados;</li>
            <li>Manter o sigilo e a confidencialidade de suas credenciais de login e senhas pessoais;</li>
            <li>Não compartilhar contas ou acessos entre pessoas distintas, utilizando usuários individuais nomeados;</li>
            <li>Notificar prontamente a equipe de suporte caso suspeite de qualquer uso não autorizado de sua conta.</li>
          </ul>
        </section>

        {/* 4. Uso Adequado do Sistema */}
        <section className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-[#0B3B82]">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0B3B82]">
              <ShieldAlert className="w-5 h-5 text-teal-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">4. Uso Adequado do Sistema</h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            O uso da plataforma é estritamente condicionado à finalidade legítima de administração da igreja e de suas congregações. É expressamente proibido:
          </p>
          <ul className="list-disc pl-5 text-sm text-slate-600 space-y-2">
            <li>Tentar violar a segurança, autenticação ou integridade dos servidores e bancos de dados;</li>
            <li>Executar engenharia reversa, descompilação ou cópia indevida do código-fonte ou da arquitetura do software;</li>
            <li>Utilizar o sistema para envio de comunicações em massa não solicitadas (SPAM) ou conteúdos ilícitos;</li>
            <li>Inserir dados sabidamente falsos, fraudulentos ou que violem direitos de terceiros.</li>
          </ul>
        </section>

        {/* 5. Contas e Níveis de Acesso */}
        <section className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-[#0B3B82]">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0B3B82]">
              <Users className="w-5 h-5 text-teal-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">5. Contas e Níveis de Acesso</h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            A plataforma opera sob controle rigoroso de papéis e permissões (RBAC). A Igreja contratante possui controle soberano para designar seus operadores, tais como administradores, supervisores, secretários, tesoureiros e lideranças de congregações.
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">
            A delegação de acessos e a concessão de permissões administrativas aos seus próprios colaboradores e voluntários é de inteira responsabilidade da liderança institucional da igreja contratante.
          </p>
        </section>

        {/* 6. Dados e Informações Inseridos pelo Usuário */}
        <section className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-[#0B3B82]">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0B3B82]">
              <Database className="w-5 h-5 text-teal-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">6. Dados e Informações Inseridos pelo Usuário</h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            A Igreja contratante mantém a titularidade e o controle dos dados eclesiásticos, cadastrais e financeiros inseridos na plataforma. A {BRAND.company} atua exclusivamente na prestação do suporte tecnológico e na hospedagem das informações.
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">
            Cabe à Igreja assegurar que a coleta e o registro dos dados de seus membros e congregados estejam em consonância com as hipóteses legais da LGPD e com as normas internas de sua denominação.
          </p>
        </section>

        {/* 7. Disponibilidade da Plataforma */}
        <section className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-[#0B3B82]">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0B3B82]">
              <Activity className="w-5 h-5 text-teal-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">7. Disponibilidade da Plataforma</h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Empregamos esforços contínuos e padrões profissionais de engenharia de software para assegurar a máxima disponibilidade e estabilidade da plataforma.
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">
            Poderão ocorrer interrupções temporárias decorrentes de manutenções técnicas programadas, melhorias evolutivas, atualizações emergenciais de segurança ou falhas externas de operadoras de telecomunicações e provedores de infraestrutura global em nuvem.
          </p>
        </section>

        {/* 8. Propriedade Intelectual */}
        <section className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-[#0B3B82]">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0B3B82]">
              <Award className="w-5 h-5 text-teal-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">8. Propriedade Intelectual</h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Todos os direitos de propriedade intelectual sobre o software, marcas, layout, design de interfaces, logotipos, documentações e tecnologias correlatas à marca <strong>{BRAND.name}</strong> pertencem exclusivamente à <strong>{BRAND.company}</strong>.
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">
            A contratação do plano concede à Igreja uma licença de uso temporária, revogável, não exclusiva e intransferível pelo período de vigência da assinatura.
          </p>
        </section>

        {/* 9. Suspensão e Encerramento */}
        <section className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-[#0B3B82]">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0B3B82]">
              <AlertTriangle className="w-5 h-5 text-teal-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">9. Suspensão e Encerramento</h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            O acesso aos serviços poderá ser suspenso ou rescindido nas seguintes circunstâncias:
          </p>
          <ul className="list-disc pl-5 text-sm text-slate-600 space-y-2">
            <li>Violação comprovada de quaisquer cláusulas destes Termos de Uso ou da legislação em vigor;</li>
            <li>Inadimplência financeira reiterada referente às mensalidades pactuadas do plano contratado;</li>
            <li>Término do período de avaliação gratuita (Trial) sem contratação de plano correspondente;</li>
            <li>Solicitação formal de cancelamento pelo representante legal da igreja cadastrada.</li>
          </ul>
        </section>

        {/* 10. Limitações de Responsabilidade */}
        <section className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-[#0B3B82]">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0B3B82]">
              <Scale className="w-5 h-5 text-teal-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">10. Limitações de Responsabilidade</h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            A plataforma constitui uma ferramenta de apoio tecnológico e operacional. A {BRAND.company} não interfere nem possui responsabilidade sobre decisões eclesiásticas, pastorais, doutrinárias, disciplinares ou financeiras tomadas pelas igrejas e seus respectivos ministérios.
          </p>
        </section>

        {/* 11. Alterações dos Termos */}
        <section className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-[#0B3B82]">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0B3B82]">
              <RefreshCw className="w-5 h-5 text-teal-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">11. Alterações dos Termos</h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Reservamo-nos o direito de modificar estes Termos de Uso a qualquer tempo para adequação legal, melhorias de serviço ou novas funcionalidades. Alterações relevantes serão comunicadas pelos canais institucionais ou notificadas diretamente na plataforma.
          </p>
        </section>

        {/* 12. Contato e Esclarecimentos */}
        <section className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-[#0B3B82]">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0B3B82]">
              <Mail className="w-5 h-5 text-teal-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">12. Contato e Dúvidas</h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Para dirimir quaisquer dúvidas a respeito destes Termos de Uso ou do funcionamento da plataforma, entre em contato com nossa equipe:
          </p>
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 text-sm text-slate-800 space-y-1">
            <p><strong>Suporte ao Cliente:</strong> suporte@gestaoeklesia.com.br</p>
            <p><strong>Privacidade e Dados:</strong> privacidade@gestaoeklesia.com.br</p>
            <p><strong>Empresa Responsável:</strong> {BRAND.company}</p>
          </div>
        </section>

        {/* Botão de retorno inferior */}
        <div className="pt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-[#0B3B82] hover:bg-[#08295b] rounded-xl transition shadow-md shadow-blue-900/10 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para a Página Inicial</span>
          </Link>
        </div>

      </main>

      {/* ── RODAPÉ INSTITUCIONAL ── */}
      <footer className="bg-[#020d24] border-t border-blue-950 py-8 px-4 sm:px-6 lg:px-8 text-xs text-blue-200/60 mt-12">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-white/90 font-medium">
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            <span>{BRAND.name} — {BRAND.company}</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <Link href="/" className="hover:text-blue-300 transition">
              Início
            </Link>
            <Link href="/suporte" className="hover:text-blue-300 transition">
              Suporte
            </Link>
            <Link href="/termos" className="text-teal-400 font-semibold transition">
              Termos de Uso
            </Link>
            <Link href="/privacidade" className="hover:text-blue-300 transition">
              Política de Privacidade
            </Link>
          </div>

          <div>
            © {new Date().getFullYear()} {BRAND.name}. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  )
}
