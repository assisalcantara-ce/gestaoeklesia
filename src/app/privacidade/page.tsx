import type { Metadata } from 'next'
import Link from 'next/link'
import { BRAND } from '@/config/brand'
import {
  ShieldCheck,
  ArrowLeft,
  Lock,
  Eye,
  Database,
  UserCheck,
  Cookie,
  Mail,
  RefreshCw,
  FileText,
  Building,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Política de Privacidade | Gestão Eklésia',
  description: 'Conheça a Política de Privacidade e proteção de dados da plataforma Gestão Eklésia em conformidade com a LGPD.',
}

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col selection:bg-teal-500 selection:text-white">
      {/* ── CABEÇALHO INSTITUCIONAL ── */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group transition">
            <div className="w-10 h-10 rounded-xl bg-[#0B3B82] flex items-center justify-center text-white shadow-sm shadow-blue-900/20 group-hover:bg-[#08295b] transition">
              <ShieldCheck className="w-5 h-5 text-teal-300" />
            </div>
            <div>
              <span className="text-lg font-bold text-slate-900 tracking-tight block leading-tight">
                {BRAND.name}
              </span>
              <span className="text-[11px] font-semibold text-teal-700 uppercase tracking-wider block">
                Privacidade & Segurança
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
            <Lock className="w-3.5 h-3.5" />
            <span>Conformidade com a LGPD (Lei nº 13.709/2018)</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white">
            Política de Privacidade
          </h1>
          <p className="text-sm sm:text-base text-blue-100/90 max-w-2xl mx-auto leading-relaxed">
            Transparência, integridade e respeito no tratamento dos dados pessoais e eclesiásticos gerenciados na plataforma {BRAND.name}.
          </p>
          <p className="text-xs text-blue-200/70 pt-2">
            Última atualização: Outubro de 2026
          </p>
        </div>
      </section>

      {/* ── CONTEÚDO PRINCIPAL (LEITURA CONFORTÁVEL) ── */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-8">
        
        {/* Card 1: Apresentação */}
        <section className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-[#0B3B82]">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0B3B82]">
              <FileText className="w-5 h-5 text-teal-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">1. Apresentação e Escopo</h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Esta Política de Privacidade estabelece o compromisso da plataforma <strong>{BRAND.name}</strong>, mantida pela <strong>{BRAND.company}</strong>, com a proteção dos dados pessoais, a privacidade e a segurança das informações de nossos clientes, igrejas parceiras, membros, ministros e visitantes.
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">
            Ao utilizar nossos serviços, você concorda com os termos aqui apresentados. A plataforma atua primordialmente como <em>Operadora</em> de dados no contexto eclesiástico, sob instruções da Igreja ou Ministério contratante (que figura como <em>Controladora</em>), em total conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD — Lei Federal nº 13.709/2018).
          </p>
        </section>

        {/* Card 2: Dados Coletados */}
        <section className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-[#0B3B82]">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0B3B82]">
              <Database className="w-5 h-5 text-teal-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">2. Dados Coletados</h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Para o regular funcionamento das rotinas de secretaria, tesouraria, ministério e membresia, podem ser processados os seguintes tipos de dados:
          </p>
          <ul className="list-disc pl-5 text-sm text-slate-600 space-y-2">
            <li>
              <strong>Dados Cadastrais Básicos:</strong> nome completo, CPF, RG, data de nascimento, estado civil, sexo, endereço, telefone e e-mail.
            </li>
            <li>
              <strong>Dados Eclesiásticos:</strong> data de batismo, data de consagração, congregação de vínculo, cargos ministeriais, presenças em cultos e reuniões.
            </li>
            <li>
              <strong>Fotografia e Credencial:</strong> imagem fotográfica inserida para emissão de ficha cadastral e carteirinha institucional de membro ou ministro.
            </li>
            <li>
              <strong>Registros de Acesso e Auditoria:</strong> endereço IP, data e hora de acesso, navegador utilizado, identificadores de sessão e logs de operações administrativas para salvaguarda de integridade.
            </li>
          </ul>
        </section>

        {/* Card 3: Finalidade do Tratamento */}
        <section className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-[#0B3B82]">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0B3B82]">
              <Eye className="w-5 h-5 text-teal-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">3. Finalidade do Tratamento</h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Os dados pessoais tratados na plataforma destinam-se exclusivamente às seguintes finalidades legítimas:
          </p>
          <ul className="list-disc pl-5 text-sm text-slate-600 space-y-2">
            <li>Organização e gestão administrativa, pastoral e eclesiástica da instituição religiosa contratante;</li>
            <li>Emissão de documentos oficiais, fichas de membresia, certificados, credenciais e carteirinhas com validação por QR Code público;</li>
            <li>Comunicação institucional, avisos de reuniões e eventos oficiais da comunidade eclesiástica;</li>
            <li>Autenticação segura, controle de permissões de acesso por perfil e prevenção a fraudes ou acessos indevidos;</li>
            <li>Cumprimento de obrigações legais, regulatórias ou fiscais atribuíveis à instituição.</li>
          </ul>
        </section>

        {/* Card 4: Uso e Armazenamento */}
        <section className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-[#0B3B82]">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0B3B82]">
              <Building className="w-5 h-5 text-teal-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">4. Uso e Armazenamento dos Dados</h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Os dados são armazenados em servidores em nuvem de alta segurança e disponibilidade, com redundância de dados e rotinas periódicas de backup.
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">
            As informações permanecem armazenadas pelo tempo estritamente necessário para o cumprimento das finalidades pactuadas no contrato de prestação de serviços com a instituição ou até que haja solicitação formal de exclusão pelo titular ou pela Igreja controladora, ressalvadas as hipóteses de guarda obrigatória por lei.
          </p>
        </section>

        {/* Card 5: Segurança da Informação */}
        <section className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-[#0B3B82]">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0B3B82]">
              <Lock className="w-5 h-5 text-teal-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">5. Segurança da Informação</h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Adotamos medidas técnicas, administrativas e organizacionais rígidas para resguardar os dados sob nossa custódia contra acessos não autorizados, perdas, destruição ou qualquer forma de tratamento ilícito:
          </p>
          <ul className="list-disc pl-5 text-sm text-slate-600 space-y-2">
            <li>Criptografia de ponta a ponta em trânsito (HTTPS/TLS) e criptografia em repouso nos bancos de dados;</li>
            <li>Controle rigoroso de níveis de acesso por função (Secretário, Pastor, Supervisor, Tesoureiro, Administrador);</li>
            <li>Trilhas de auditoria contínua registrando alterações em cadastros e acessos sensíveis;</li>
            <li>Políticas internas de segregação de ambientes e monitoramento contínuo de vulnerabilidades.</li>
          </ul>
        </section>

        {/* Card 6: Compartilhamento */}
        <section className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-[#0B3B82]">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0B3B82]">
              <ShieldCheck className="w-5 h-5 text-teal-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">6. Compartilhamento de Dados</h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            <strong>A {BRAND.name} não vende, não aluga e não comercializa dados pessoais sob nenhuma circunstância.</strong>
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">
            O compartilhamento de dados ocorre exclusivamente:
          </p>
          <ul className="list-disc pl-5 text-sm text-slate-600 space-y-2">
            <li>Com parceiros de infraestrutura de tecnologia homologados (hospedagem em nuvem, disparo de e-mails transacionais e processamento de pagamentos quando contratado);</li>
            <li>Para validação pública de autenticidade de credenciais e certificados, exibindo exclusivamente os dados mínimos necessários quando o QR Code correspondente for escaneado;</li>
            <li>Mediante ordem judicial fundamentada ou exigência legal de autoridade pública competente.</li>
          </ul>
        </section>

        {/* Card 7: Direitos do Titular */}
        <section className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-[#0B3B82]">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0B3B82]">
              <UserCheck className="w-5 h-5 text-teal-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">7. Direitos do Titular de Dados</h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Nos termos do artigo 18 da LGPD, os titulares de dados pessoais podem solicitar a qualquer momento:
          </p>
          <ul className="list-disc pl-5 text-sm text-slate-600 space-y-2">
            <li>Confirmação da existência de tratamento e acesso aos dados existentes;</li>
            <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
            <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos;</li>
            <li>Informações sobre as entidades públicas ou privadas com as quais houve compartilhamento;</li>
            <li>Revogação de consentimento, nas hipóteses aplicáveis.</li>
          </ul>
          <p className="text-xs text-slate-500 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <strong>Nota:</strong> Como a Igreja contratante é a Controladora dos registros de membresia, requisições de titulares vinculados a uma congregação devem ser direcionadas prioritariamente à secretaria de sua igreja local ou ao nosso canal de privacidade.
          </p>
        </section>

        {/* Card 8: Cookies */}
        <section className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-[#0B3B82]">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0B3B82]">
              <Cookie className="w-5 h-5 text-teal-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">8. Cookies e Tecnologias Semelhantes</h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Utilizamos cookies estritamente necessários para viabilizar a autenticação do usuário, persistência de preferências de sessão e garantia de segurança da aplicação. Não empregamos cookies para fins de comercialização de dados ou publicidade comportamental de terceiros.
          </p>
        </section>

        {/* Card 9: Contato e Encarregado */}
        <section className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-[#0B3B82]">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0B3B82]">
              <Mail className="w-5 h-5 text-teal-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">9. Contato e Encarregado (DPO)</h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Para dúvidas relativas a esta política, pedidos de esclarecimento ou exercício de direitos de titularidade perante a plataforma, entre em contato através de nossos canais de suporte e privacidade:
          </p>
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 text-sm text-slate-800 space-y-1">
            <p><strong>Canal de Privacidade:</strong> privacidade@gestaoeklesia.com.br</p>
            <p><strong>Canal de Suporte Técnico:</strong> suporte@gestaoeklesia.com.br</p>
            <p><strong>Mantenedor:</strong> {BRAND.company}</p>
          </div>
        </section>

        {/* Card 10: Atualizações */}
        <section className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-[#0B3B82]">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0B3B82]">
              <RefreshCw className="w-5 h-5 text-teal-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">10. Atualizações Desta Política</h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Esta Política de Privacidade poderá ser revisada e atualizada periodicamente para refletir aprimoramentos técnicos de segurança ou mudanças regulatórias. Recomendamos a consulta regular desta página para manter-se informado sobre como protegemos seus dados.
          </p>
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
            <Link href="/termos" className="hover:text-blue-300 transition">
              Termos de Uso
            </Link>
            <Link href="/privacidade" className="text-teal-400 font-semibold transition">
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
