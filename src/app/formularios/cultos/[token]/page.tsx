import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase-server';
import { isCultoAbertoHoje } from '@/lib/timezone-utils';
import { AlertCircle, Clock, Lock } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function RedirecionarFormularioCultoPage(props: PageProps) {
  const { token: rawToken } = await props.params;
  const token = rawToken?.trim();

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#062E6F] via-[#0A4499] to-[#1565C0] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <AlertCircle className="h-14 w-14 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Link Inválido</h2>
          <p className="text-slate-600 text-sm">Este link de recepção é inválido ou não foi informado.</p>
        </div>
      </div>
    );
  }

  const admin = createServerClient();

  // 1. Buscar token no banco com join nos dados do culto
  const { data: tokenRecord, error } = await admin
    .from('culto_tokens')
    .select(`
      id,
      token,
      is_active,
      expires_at,
      ministry_id,
      culto_id,
      culto_registros (
        id,
        tipo_culto,
        data_culto,
        horario_culto,
        status,
        congregacoes ( nome )
      )
    `)
    .eq('token', token)
    .maybeSingle();

  if (error || !tokenRecord) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#062E6F] via-[#0A4499] to-[#1565C0] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <AlertCircle className="h-14 w-14 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Link Não Encontrado</h2>
          <p className="text-slate-600 text-sm">
            Este link de recepção não foi encontrado ou já foi substituído por um novo.
          </p>
        </div>
      </div>
    );
  }

  // 2. Verificar se o token está ativo
  if (!tokenRecord.is_active) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#062E6F] via-[#0A4499] to-[#1565C0] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <Lock className="h-14 w-14 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Link Inativo</h2>
          <p className="text-slate-600 text-sm">
            Este link de recepção foi desativado. Solicite ao responsável pela recepção um link atualizado.
          </p>
        </div>
      </div>
    );
  }

  // 3. Verificar validade temporal do token (timestamp expires_at)
  if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) <= new Date()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#062E6F] via-[#0A4499] to-[#1565C0] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <Clock className="h-14 w-14 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Link Expirado</h2>
          <p className="text-slate-600 text-sm">
            O período de validade deste link de recepção expirou (limite de 24 horas). Solicite um novo link ao responsável.
          </p>
        </div>
      </div>
    );
  }

  const culto = tokenRecord.culto_registros as any;
  if (!culto) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#062E6F] via-[#0A4499] to-[#1565C0] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <AlertCircle className="h-14 w-14 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Culto Não Localizado</h2>
          <p className="text-slate-600 text-sm">
            O registro operacional do culto vinculado a este link não foi encontrado no sistema.
          </p>
        </div>
      </div>
    );
  }

  // 4. Validação estrita de janela do culto (Fuso Horário Oficial de Brasília GMT-3)
  const validacaoJanela = isCultoAbertoHoje(culto.data_culto, culto.status);

  if (!validacaoJanela.elegivel) {
    let motivoMsg = 'A janela de acolhimento para este culto não está ativa no momento.';
    if (validacaoJanela.motivo === 'CULTO_ENCERRADO') {
      const statusLabel = culto.status ? culto.status.toLowerCase() : 'finalizado';
      motivoMsg = `O culto já foi ${statusLabel} e não está mais aceitando novos registros de visitantes.`;
    } else if (validacaoJanela.motivo === 'CULTO_PASSADO') {
      motivoMsg = 'A janela de acolhimento para este culto já foi encerrada na data de realização.';
    } else if (validacaoJanela.motivo === 'CULTO_FUTURO') {
      motivoMsg = 'Este culto está programado para uma data futura. O acolhimento será liberado na data do culto.';
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-[#062E6F] via-[#0A4499] to-[#1565C0] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <Lock className="h-14 w-14 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Acolhimento Não Disponível</h2>
          <p className="text-slate-600 text-sm leading-relaxed">{motivoMsg}</p>
        </div>
      </div>
    );
  }

  // 5. Token e culto 100% elegíveis: Redirecionar com segurança para a nova experiência pública do Agente de Acolhimento
  redirect(`/acolhimento/${encodeURIComponent(token)}`);
}
