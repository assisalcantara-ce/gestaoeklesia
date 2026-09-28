import { Resend } from 'resend';
import { gerarCartaAdvertenciaPDF } from '@/lib/reunioes-advertencia-pdf';

export interface EnviarAdvertenciaParams {
  advertenciaId: string;
  protocolo: string;
  emailDestinatario: string;
  nomeMinistro: string;
  matriculaMinistro?: string | null;
  cargoMinistro: string;
  nomeCongregacao: string;
  setorArea?: string | null;
  tituloReuniao: string;
  dataReuniao: string;
  horarioInicio: string;
  localReuniao: string;
  nomeMinisterio: string;
  cnpjMinisterio?: string | null;
  cidadeUf?: string | null;
  nomePresidente?: string | null;
  dataEmissao: string;
  ministryId: string;
  supabaseAdmin?: any;
}

export interface EnviarAdvertenciaResult {
  sucesso: boolean;
  mensagemId?: string;
  erro?: string;
}

/**
 * Monta o template HTML institucional para notificação de advertência ministerial
 */
function gerarTemplateEmailAdvertencia(params: EnviarAdvertenciaParams): string {
  const anoAtual = new Date().getFullYear();

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Carta de Advertência Ministerial</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.6;
          color: #334155;
          background-color: #f8fafc;
          margin: 0;
          padding: 0;
        }
        .wrapper {
          max-width: 600px;
          margin: 20px auto;
          background-color: #ffffff;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        }
        .header {
          background: linear-gradient(135deg, #123b63 0%, #0a233c 100%);
          color: #ffffff;
          padding: 32px 24px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 18px;
          letter-spacing: 0.5px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .header p {
          margin: 6px 0 0 0;
          font-size: 12px;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .content {
          padding: 32px 24px;
        }
        .badge {
          display: inline-block;
          background-color: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fecaca;
          padding: 6px 14px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          margin-bottom: 20px;
        }
        .card {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px;
          margin: 20px 0;
        }
        .card-row {
          display: flex;
          justify-content: space-between;
          padding: 6px 0;
          font-size: 13px;
          border-bottom: 1px dashed #e2e8f0;
        }
        .card-row:last-child {
          border-bottom: none;
        }
        .card-label {
          color: #64748b;
          font-weight: 600;
        }
        .card-val {
          color: #0f172a;
          font-weight: 700;
          text-align: right;
        }
        .warning-box {
          background-color: #fffbeb;
          border-left: 4px solid #f59e0b;
          padding: 14px 16px;
          border-radius: 8px;
          margin: 24px 0;
          font-size: 12px;
          color: #78350f;
          line-height: 1.5;
        }
        .footer {
          background-color: #f8fafc;
          border-top: 1px solid #e2e8f0;
          padding: 20px 24px;
          text-align: center;
          font-size: 11px;
          color: #94a3b8;
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <h1>${params.nomeMinisterio.toUpperCase()}</h1>
          <p>Secretaria Geral • Notificação Oficial</p>
        </div>
        <div class="content">
          <div style="text-align: center;">
            <span class="badge">Notificação de Ausência Ministerial</span>
          </div>

          <p style="font-size: 14px; margin-top: 0;">
            Prezado(a) Ministro(a) <strong>${params.nomeMinistro}</strong>,
          </p>

          <p style="font-size: 13px; color: #475569;">
            Comunicamos que foi registrada ausência de Vossa Senhoria na convocação ministerial abaixo discriminada:
          </p>

          <div class="card">
            <div class="card-row">
              <span class="card-label">Protocolo Oficial:</span>
              <span class="card-val" style="color: #b91c1c;">${params.protocolo}</span>
            </div>
            <div class="card-row">
              <span class="card-label">Reunião:</span>
              <span class="card-val">${params.tituloReuniao}</span>
            </div>
            <div class="card-row">
              <span class="card-label">Data e Horário:</span>
              <span class="card-val">${params.dataReuniao} às ${params.horarioInicio}</span>
            </div>
            <div class="card-row">
              <span class="card-label">Local:</span>
              <span class="card-val">${params.localReuniao}</span>
            </div>
            <div class="card-row">
              <span class="card-label">Congregação de Origem:</span>
              <span class="card-val">${params.nomeCongregacao}</span>
            </div>
          </div>

          <div class="warning-box">
            <strong>Orientações para Justificativa:</strong><br>
            Segue em anexo a <strong>Carta de Advertência</strong> oficial gerada pelo sistema em formato PDF. Conforme o regimento interno, caso deseje apresentar justificativa, preencha o campo de próprio punho (manuscrito) ou procure a Secretaria Geral dentro do prazo regulamentar.
          </div>
        </div>
        <div class="footer">
          <p><strong>GESTÃO EKLÉSIA™</strong> — Sistema de Gestão Eclesiástica</p>
          <p>© ${anoAtual} ${params.nomeMinisterio}. Todos os direitos reservados.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Valida formato básico de e-mail RFC 5322 simplificado
 */
export function validarEmailDestinatario(email?: string | null): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed);
}

/**
 * Envia a Carta de Advertência Ministerial por e-mail anexando o PDF gerado dinamicamente com dados reais do obreiro.
 */
export async function enviarEmailCartaAdvertencia(params: EnviarAdvertenciaParams): Promise<EnviarAdvertenciaResult> {
  const emailDestino = params.emailDestinatario?.trim();

  if (!validarEmailDestinatario(emailDestino)) {
    return {
      sucesso: false,
      erro: `Endereço de e-mail inválido ou ausente: "${params.emailDestinatario || ''}"`,
    };
  }

  if (!params.ministryId) {
    return {
      sucesso: false,
      erro: 'Identificador do ministério (tenant) ausente para despacho da advertência.',
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('⚠️ RESEND_API_KEY não configurada. Simulação de envio seguro.');
    return {
      sucesso: false,
      erro: 'Serviço de e-mail não configurado (RESEND_API_KEY ausente).',
    };
  }

  try {
    // 1. Gerar PDF dinâmico com os dados reais do ministro e ministério
    const uint8Pdf = await gerarCartaAdvertenciaPDF({
      protocolo: params.protocolo,
      nomeMinisterio: params.nomeMinisterio,
      cnpjMinisterio: params.cnpjMinisterio,
      cidadeUf: params.cidadeUf,
      nomeMinistro: params.nomeMinistro,
      matriculaMinistro: params.matriculaMinistro,
      cargoMinistro: params.cargoMinistro,
      nomeCongregacao: params.nomeCongregacao,
      setorArea: params.setorArea,
      tituloReuniao: params.tituloReuniao,
      dataReuniao: params.dataReuniao,
      horarioInicio: params.horarioInicio,
      localReuniao: params.localReuniao,
      dataEmissao: params.dataEmissao,
      nomePresidente: params.nomePresidente,
    });

    const pdfBuffer = Buffer.from(uint8Pdf);
    const filename = `Carta_Advertencia_${params.protocolo.replace(/[/\\?%*:|"<>]/g, '_')}.pdf`;

    // 2. Inicializar cliente Resend
    const resend = new Resend(apiKey);
    const fromAddress = process.env.RESEND_FROM || 'Gestão Eklésia <notificacoes@gestaoeklesia.com.br>';

    const htmlBody = gerarTemplateEmailAdvertencia(params);

    const response = await resend.emails.send({
      from: fromAddress,
      to: [emailDestino],
      subject: `Notificação Oficial: Carta de Advertência — ${params.protocolo}`,
      html: htmlBody,
      attachments: [
        {
          filename,
          content: pdfBuffer,
        },
      ],
    });

    if (response.error) {
      return {
        sucesso: false,
        erro: response.error.message || 'Erro retornado pelo provedor de e-mail.',
      };
    }

    return {
      sucesso: true,
      mensagemId: response.data?.id,
    };
  } catch (err: any) {
    return {
      sucesso: false,
      erro: err?.message || 'Exceção inesperada ao despachar e-mail.',
    };
  }
}
