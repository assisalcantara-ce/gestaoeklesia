import { Metadata } from 'next';
import Image from 'next/image';
import {
  ShieldCheck,
  ShieldAlert,
  FileText,
  Church,
  Calendar,
  User,
  CheckCircle2,
  XCircle,
  Hash,
  MapPin,
  Award,
} from 'lucide-react';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function generateMetadata(
  props: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await props.params;
  return {
    title: `Validação de Carta Ministerial | Gestão Eklésia`,
    description: `Verificação de autenticidade e validade de carta ministerial oficial (${id})`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return dateStr;
  }
}

export default async function ValidarCartaPage({ params }: PageProps) {
  const { id } = await params;
  const cleanId = decodeURIComponent(id || '').trim();

  let carta: any = null;
  let instituicaoNome: string | null = null;
  let instituicaoLogo: string | null = null;
  let isFound = false;

  if (cleanId) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanId);
      if (isUuid) {
        const admin = createServerClient();

        const { data, error } = await admin
          .from('cartas_registros')
          .select(`
            id,
            ministry_id,
            member_id,
            template_title,
            categoria,
            status,
            payload_snapshot,
            issued_at,
            created_at
          `)
          .eq('id', cleanId)
          .maybeSingle();

        if (!error && data) {
          carta = data;
          isFound = true;

          if (carta.ministry_id) {
            const { data: ministry } = await admin
              .from('ministries')
              .select('name, logo_url')
              .eq('id', carta.ministry_id)
              .maybeSingle();

            if (ministry) {
              instituicaoNome = ministry.name || null;
              instituicaoLogo = ministry.logo_url || null;
            }
          }
        }
      }
    } catch (err) {
      console.error('Erro ao consultar autenticidade da carta:', err);
    }
  }

  // Snapshot de dados da emissão
  const snapshot = (carta?.payload_snapshot && typeof carta.payload_snapshot === 'object')
    ? (carta.payload_snapshot as Record<string, any>)
    : {};

  const nomePortador = snapshot['membro.nome'] || snapshot['membro.nome_completo'] || null;
  const destino = snapshot['carta.destino'] || snapshot['destino'] || null;
  const pastorResponsavel = snapshot['pastor.responsavel'] || snapshot['pastor_responsavel'] || null;
  const cargoMembro = snapshot['membro.cargo'] || snapshot['cargo'] || null;

  const isCancelada = isFound && (carta?.status === 'cancelada' || carta?.status === 'inativa' || carta?.status === 'revogada');
  const isValida = isFound && !isCancelada;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between items-center p-4 sm:p-6 selection:bg-indigo-500 selection:text-white">
      {/* Background Decorativo */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 right-1/4 w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md my-auto relative z-10 space-y-6">
        {/* Top Header Institucional */}
        <div className="flex flex-col items-center text-center space-y-3">
          {instituicaoLogo ? (
            <div className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-indigo-500/30 bg-slate-900 shadow-xl p-1">
              <Image
                src={instituicaoLogo}
                alt={instituicaoNome || 'Igreja'}
                width={64}
                height={64}
                className="w-full h-full object-contain rounded-xl"
              />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-lg">
              <Church size={28} />
            </div>
          )}

          <div>
            <p className="text-xs font-semibold tracking-wider uppercase text-indigo-400">
              Validação Documental Oficial
            </p>
            <h1 className="text-lg font-bold text-white leading-snug">
              {instituicaoNome || 'Gestão Eklésia'}
            </h1>
          </div>
        </div>

        {/* Card Principal de Validação */}
        {isFound ? (
          <div className="bg-slate-900/90 backdrop-blur-md rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
            {/* Faixa de Status */}
            {isValida ? (
              <div className="px-6 py-4 flex items-center justify-center gap-2 text-sm font-bold tracking-wide border-b bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                <span>DOCUMENTO OFICIAL AUTÊNTICO</span>
              </div>
            ) : (
              <div className="px-6 py-4 flex items-center justify-center gap-2 text-sm font-bold tracking-wide border-b bg-rose-500/15 text-rose-400 border-rose-500/30">
                <XCircle size={18} className="text-rose-400 shrink-0" />
                <span>DOCUMENTO CANCELADO / REVOGADO</span>
              </div>
            )}

            <div className="p-6 space-y-6">
              {/* Título do Documento e Categoria */}
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 shrink-0 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <FileText size={24} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="inline-block text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700">
                    {carta.categoria === 'declaracao' ? 'Declaração' : 'Carta Ministerial'}
                  </span>
                  <h2 className="text-base font-bold text-white leading-snug mt-1">
                    {carta.template_title || 'Carta Ministerial'}
                  </h2>
                </div>
              </div>

              {/* Informações Oficiais Auditadas */}
              <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800/80 space-y-3 text-xs">
                {nomePortador && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                    <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                      <User size={14} className="text-slate-500" />
                      Destinatário / Portador
                    </span>
                    <span className="font-semibold text-slate-200 text-right max-w-[55%] truncate">
                      {nomePortador}
                    </span>
                  </div>
                )}

                {cargoMembro && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                    <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                      <Award size={14} className="text-slate-500" />
                      Cargo / Função
                    </span>
                    <span className="font-semibold text-slate-200 text-right">
                      {cargoMembro}
                    </span>
                  </div>
                )}

                {destino && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                    <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                      <MapPin size={14} className="text-slate-500" />
                      Igreja / Cidade de Destino
                    </span>
                    <span className="font-semibold text-slate-200 text-right max-w-[55%] truncate">
                      {destino}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                    <Calendar size={14} className="text-slate-500" />
                    Data e Hora de Emissão
                  </span>
                  <span className="font-semibold text-slate-200">
                    {formatDateTime(carta.issued_at || carta.created_at)}
                  </span>
                </div>

                {pastorResponsavel && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                    <span className="text-slate-400 font-medium">Assinante / Pastor</span>
                    <span className="font-semibold text-slate-200 text-right max-w-[55%] truncate">
                      {pastorResponsavel}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                    <Hash size={14} className="text-slate-500" />
                    Código de Autenticidade
                  </span>
                  <span className="font-mono text-[11px] text-indigo-400 font-semibold truncate max-w-[50%]">
                    {carta.id}
                  </span>
                </div>
              </div>

              {/* Mensagem de Garantia de Integridade */}
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/40 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
                <ShieldCheck size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                <span>
                  {isValida &&
                    'Este documento foi emitido e registrado no livro digital oficial da secretaria eclesiástica com integridade garantida.'}
                  {isCancelada &&
                    'Este documento foi formalmente cancelado ou revogado pela administração e não possui mais validade canônica ou jurídica.'}
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
              <h2 className="text-lg font-bold text-white">Documento Não Localizado</h2>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Não foi possível encontrar nenhum registro oficial de carta ou declaração correspondente ao identificador fornecido.
              </p>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-slate-500 break-all">
              {cleanId || 'Nenhum identificador fornecido'}
            </div>
          </div>
        )}

        {/* Rodapé Seguro */}
        <div className="text-center space-y-1">
          <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
            <span>🛡️</span> Gestão Eklésia — Plataforma de Governança Eclesiástica
          </p>
          <p className="text-[10px] text-slate-600">
            Validação documental em tempo real • Integridade garantida sem exposição de dados sensíveis
          </p>
        </div>
      </div>
    </div>
  );
}
