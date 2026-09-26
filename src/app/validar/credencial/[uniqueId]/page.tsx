import { Metadata } from 'next';
import Image from 'next/image';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  User,
  Church,
  Calendar,
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  Hash,
} from 'lucide-react';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function generateMetadata(
  props: { params: Promise<{ uniqueId: string }> }
): Promise<Metadata> {
  const { uniqueId } = await props.params;
  return {
    title: `Validação de Credencial Ministerial | Gestão Eklésia`,
    description: `Verificação de autenticidade e validade de credencial ministerial (${uniqueId})`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

interface PageProps {
  params: Promise<{
    uniqueId: string;
  }>;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}/${y}`;
    }
    return new Intl.DateTimeFormat('pt-BR').format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

export default async function ValidarCredencialPage({ params }: PageProps) {
  const { uniqueId } = await params;
  const cleanId = decodeURIComponent(uniqueId || '').trim();

  let member: any = null;
  let congregacaoNome: string | null = null;
  let ministerioNome: string | null = null;
  let ministerioLogo: string | null = null;
  let isFound = false;
  let hasProcessoHomologado = false;

  if (cleanId) {
    try {
      const admin = createServerClient();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanId);

      let query = admin
        .from('members')
        .select(
          `id, unique_id, name, matricula, foto_url,
           cargo_ministerial, tipo_cadastro, status,
           data_consagracao, data_validade_credencial,
           congregacao_id, ministry_id, dados_cargos, custom_fields`
        );

      if (isUuid) {
        query = query.or(`unique_id.eq.${cleanId},id.eq.${cleanId}`);
      } else {
        query = query.eq('unique_id', cleanId);
      }

      const { data, error } = await query.maybeSingle();

      if (!error && data) {
        member = data;
        isFound = true;

        if (member.ministry_id) {
          // Checar se há processo homologado
          const { data: procHomologado } = await admin
            .from('consagracao_registros')
            .select('id')
            .eq('member_id', member.id)
            .eq('ministry_id', member.ministry_id)
            .eq('status_processo', 'homologar')
            .limit(1)
            .maybeSingle();

          if (procHomologado) {
            hasProcessoHomologado = true;
          }

          // Buscar dados da congregação
          if (member.congregacao_id) {
            const { data: cong } = await admin
              .from('congregacoes')
              .select('nome')
              .eq('id', member.congregacao_id as string)
              .maybeSingle();
            congregacaoNome = (cong as any)?.nome ?? null;
          } else if (member.custom_fields && typeof member.custom_fields === 'object') {
            congregacaoNome = (member.custom_fields as any).congregacao || null;
          }

          // Buscar dados do ministério
          const { data: min } = await admin
            .from('ministries')
            .select('name, logo_url')
            .eq('id', member.ministry_id as string)
            .maybeSingle();
          ministerioNome = (min as any)?.name ?? null;
          ministerioLogo = (min as any)?.logo_url ?? null;
        }
      }
    } catch (err) {
      console.error('Erro ao consultar credencial ministerial:', err);
    }
  }

  // Avaliação rigorosa da evidência ministerial
  const cf = member?.custom_fields && typeof member.custom_fields === 'object' ? member.custom_fields : {};
  const historicoProc = Array.isArray((cf as any).historico_processos) ? (cf as any).historico_processos : [];
  const hasHistoricoHomologado = historicoProc.some(
    (ev: any) => ev.status_processo === 'homologar' || ev.tipo_evento === 'homologacao'
  );

  const cargo = String(member?.cargo_ministerial || (cf as any).cargoMinisterial || '').trim();
  const tipoCad = String(member?.tipo_cadastro || '').toLowerCase().trim();
  const dataConsagracao = member?.data_consagracao || (cf as any).dataConsagracao || null;
  const hasDadosCargos = member?.dados_cargos && typeof member.dados_cargos === 'object' && Object.keys(member.dados_cargos).length > 0;

  const isMinistroReconhecido =
    hasProcessoHomologado ||
    hasHistoricoHomologado ||
    tipoCad === 'ministro' ||
    (Boolean(cargo) && cargo.toLowerCase() !== 'membro' && cargo.toLowerCase() !== 'congregado' && (Boolean(dataConsagracao) || hasDadosCargos));

  let validadeStatus: 'valida' | 'inativa' | 'expirada' | 'sem_credencial' = 'valida';

  if (!isMinistroReconhecido) {
    validadeStatus = 'sem_credencial';
  } else if (member?.status !== 'active') {
    validadeStatus = 'inativa';
  } else if (member?.data_validade_credencial) {
    const hoje = new Date().toISOString().slice(0, 10);
    if (hoje > member.data_validade_credencial) {
      validadeStatus = 'expirada';
    }
  }

  const matricula = member?.matricula || (cf as any).matricula || null;
  const fotoUrl = member?.foto_url || null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between items-center p-4 sm:p-6 selection:bg-teal-500 selection:text-white">
      {/* Background Decorativo */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-teal-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 right-1/4 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md my-auto relative z-10 space-y-6">
        {/* Top Header Institucional */}
        <div className="flex flex-col items-center text-center space-y-3">
          {ministerioLogo ? (
            <div className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-teal-500/30 bg-slate-900 shadow-xl p-1">
              <Image
                src={ministerioLogo}
                alt={ministerioNome || 'Igreja'}
                width={64}
                height={64}
                className="w-full h-full object-contain rounded-xl"
              />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 shadow-lg">
              <Church size={28} />
            </div>
          )}

          <div>
            <p className="text-xs font-semibold tracking-wider uppercase text-teal-400">
              Autenticação Ministerial Oficial
            </p>
            <h1 className="text-lg font-bold text-white leading-snug">
              {ministerioNome || 'Gestão Eklésia'}
            </h1>
          </div>
        </div>

        {/* Card Principal de Validação */}
        {isFound ? (
          <div className="bg-slate-900/90 backdrop-blur-md rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
            {/* Faixa de Status em Tempo Real */}
            {validadeStatus === 'valida' && (
              <div className="px-6 py-4 flex items-center justify-center gap-2 text-sm font-bold tracking-wide border-b bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                <CheckCircle2 size={18} className="text-emerald-400" />
                <span>CREDENCIAL MINISTERIAL VÁLIDA</span>
              </div>
            )}

            {validadeStatus === 'inativa' && (
              <div className="px-6 py-4 flex items-center justify-center gap-2 text-sm font-bold tracking-wide border-b bg-rose-500/15 text-rose-400 border-rose-500/30">
                <XCircle size={18} className="text-rose-400" />
                <span>CREDENCIAL INATIVA / SUSPENSA</span>
              </div>
            )}

            {validadeStatus === 'expirada' && (
              <div className="px-6 py-4 flex items-center justify-center gap-2 text-sm font-bold tracking-wide border-b bg-amber-500/15 text-amber-400 border-amber-500/30">
                <Clock size={18} className="text-amber-400" />
                <span>CREDENCIAL MINISTERIAL EXPIRADA</span>
              </div>
            )}

            {validadeStatus === 'sem_credencial' && (
              <div className="px-6 py-4 flex items-center justify-center gap-2 text-xs font-bold tracking-wide border-b bg-slate-800 text-slate-300 border-slate-700 text-center">
                <ShieldX size={18} className="text-slate-400" />
                <span>SEM CONSAGRAÇÃO MINISTERIAL HOMOLOGADA</span>
              </div>
            )}

            <div className="p-6 space-y-6">
              {/* Foto e Nome */}
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20 shrink-0 rounded-2xl overflow-hidden border-2 border-slate-700 bg-slate-800 shadow-md flex items-center justify-center">
                  {fotoUrl ? (
                    <Image
                      src={fotoUrl}
                      alt={member.name}
                      width={80}
                      height={80}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User size={36} className="text-slate-500" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-bold text-white leading-snug truncate">
                    {member.name}
                  </h2>
                  <div className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-300 text-xs font-semibold">
                    <Award size={13} className="shrink-0" />
                    <span className="truncate">{cargo || 'Membro'}</span>
                  </div>
                </div>
              </div>

              {/* Informações Institucionais Permitidas */}
              <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800/80 space-y-3 text-xs">
                {congregacaoNome && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                    <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                      <Church size={14} className="text-slate-500" />
                      Congregação
                    </span>
                    <span className="font-semibold text-slate-200 text-right">
                      {congregacaoNome}
                    </span>
                  </div>
                )}

                {matricula && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                    <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                      <Hash size={14} className="text-slate-500" />
                      Matrícula
                    </span>
                    <span className="font-mono font-semibold text-slate-200">
                      {matricula}
                    </span>
                  </div>
                )}

                {dataConsagracao && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                    <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                      <Calendar size={14} className="text-slate-500" />
                      Data da Consagração
                    </span>
                    <span className="font-semibold text-slate-200">
                      {formatDate(dataConsagracao)}
                    </span>
                  </div>
                )}

                {member.data_validade_credencial && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                    <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                      <Calendar size={14} className="text-slate-500" />
                      Validade da Credencial
                    </span>
                    <span
                      className={`font-semibold ${
                        validadeStatus === 'expirada' ? 'text-amber-400' : 'text-slate-200'
                      }`}
                    >
                      {formatDate(member.data_validade_credencial)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-400 font-medium">ID de Autenticação</span>
                  <span className="font-mono text-[11px] text-teal-400 font-semibold">
                    {member.unique_id || member.id}
                  </span>
                </div>
              </div>

              {/* Mensagem de Garantia de Integridade */}
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/40 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
                <ShieldCheck size={16} className="text-teal-400 shrink-0 mt-0.5" />
                <span>
                  {validadeStatus === 'valida' &&
                    'Esta credencial ministerial é oficial e foi autenticada em tempo real diretamente na base de dados eclesiástica.'}
                  {validadeStatus === 'inativa' &&
                    'Este registro ministerial encontra-se inativo ou suspenso no sistema da instituição.'}
                  {validadeStatus === 'expirada' &&
                    'O prazo de validade desta credencial expirou. É necessária a renovação junto à Secretaria Geral.'}
                  {validadeStatus === 'sem_credencial' &&
                    'Este cadastro pertence a um membro da instituição sem processo de consagração ministerial homologado.'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900/90 backdrop-blur-md rounded-3xl border border-rose-500/30 shadow-2xl p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
              <ShieldAlert size={32} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-white">Credencial Não Localizada</h2>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Não foi possível encontrar nenhum registro ministerial ativo correspondente ao identificador fornecido.
              </p>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-slate-500 break-all">
              {cleanId || 'Nenhum identificador'}
            </div>
          </div>
        )}

        {/* Rodapé Seguro */}
        <div className="text-center space-y-1">
          <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
            <span>🛡️</span> Gestão Eklésia — Plataforma de Governança Eclesiástica
          </p>
          <p className="text-[10px] text-slate-600">
            Consulta pública em tempo real • Consulta segura sem exposição de dados sensíveis
          </p>
        </div>
      </div>
    </div>
  );
}
