// Serviço de Email para Gestão Eclesial

export interface EmailValidacao {
  ministryId: string;
  email: string;
  token: string;
  expiresAt: string;
  criadoEm: string;
}

// Simular armazenamento de tokens de validação (em produção seria banco de dados)
let tokensValidacao: EmailValidacao[] = [];

/**
 * Gera um token único para validação de email
 */
export function gerarTokenValidacao(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15) +
         Date.now().toString(36);
}

/**
 * Armazena token de validação
 */
export function armazenarTokenValidacao(
  ministryId: string,
  email: string,
  token: string,
  diasExpiracao: number = 7
): EmailValidacao {
  const dataAtual = new Date();
  const dataExpiracao = new Date(dataAtual.getTime() + diasExpiracao * 24 * 60 * 60 * 1000);

  const validacao: EmailValidacao = {
    ministryId,
    email,
    token,
    expiresAt: dataExpiracao.toISOString(),
    criadoEm: dataAtual.toISOString()
  };

  tokensValidacao.push(validacao);

  return validacao;
}

/**
 * Valida um token
 */
export function validarToken(ministryId: string, token: string): boolean {
  const validacao = tokensValidacao.find(
    v => v.ministryId === ministryId && v.token === token
  );

  if (!validacao) return false;

  const agora = new Date();
  const dataExpiracao = new Date(validacao.expiresAt);

  if (agora > dataExpiracao) {
    // Token expirado - remover
    tokensValidacao = tokensValidacao.filter(v => v.token !== token);
    return false;
  }

  return true;
}

/**
 * Remove token após validação
 */
export function removerTokenValidacao(token: string): void {
  tokensValidacao = tokensValidacao.filter(v => v.token !== token);
}

/**
 * Gera HTML do email de boas-vindas
 */
export function gerarEmailHTML(
  nomePastor: string,
  nomeMinisterio: string,
  linkValidacao: string,
  tipoCadastro: 'teste' | 'efetivo'
): string {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Bem-vindo ao Gestão Eclesial</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #f5f5f5;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 20px auto;
          background-color: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #123b63 0%, #0284c7 100%);
          color: white;
          padding: 40px 20px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 32px;
          font-weight: bold;
        }
        .logo {
          font-size: 48px;
          margin-bottom: 10px;
        }
        .content {
          padding: 40px;
        }
        .greeting {
          font-size: 20px;
          font-weight: bold;
          color: #123b63;
          margin-bottom: 20px;
        }
        .info-box {
          background-color: #f0f9ff;
          border-left: 4px solid #0284c7;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .info-box strong {
          color: #123b63;
        }
        .badge {
          display: inline-block;
          padding: 8px 16px;
          border-radius: 20px;
          font-weight: bold;
          margin-top: 10px;
          font-size: 12px;
        }
        .badge-teste {
          background-color: #ede9fe;
          color: #6d28d9;
        }
        .badge-efetivo {
          background-color: #dcfce7;
          color: #15803d;
        }
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          padding: 16px 40px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: bold;
          font-size: 16px;
          margin: 30px 0;
          text-align: center;
          transition: all 0.3s ease;
        }
        .cta-button:hover {
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
          text-decoration: none;
        }
        .steps {
          background-color: #f9fafb;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
        }
        .step {
          display: flex;
          margin: 15px 0;
          align-items: flex-start;
        }
        .step-number {
          background-color: #0284c7;
          color: white;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          flex-shrink: 0;
          margin-right: 15px;
        }
        .step-content {
          flex: 1;
        }
        .step-content strong {
          color: #123b63;
        }
        .step-content p {
          margin: 5px 0 0 0;
          color: #666;
          font-size: 14px;
        }
        .footer {
          background-color: #f9fafb;
          padding: 20px;
          text-align: center;
          font-size: 12px;
          color: #999;
          border-top: 1px solid #e5e7eb;
        }
        .footer p {
          margin: 5px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">⛪</div>
          <h1>Gestão Eclesial</h1>
          <p style="margin: 10px 0 0 0; font-size: 14px;">Sistema de Gestão para Igrejas e Ministérios</p>
        </div>

        <div class="content">
          <div class="greeting">
            Bem-vindo, ${nomePastor}! 🙏
          </div>

          <p style="color: #666; line-height: 1.6;">
            Sua organização <strong>${nomeMinisterio}</strong> foi cadastrada com sucesso em nosso sistema!
          </p>

          <div class="info-box">
            <strong>Tipo de Cadastro:</strong><br>
            ${tipoCadastro === 'teste' 
              ? '📅 <strong>Teste Gratuito</strong> - Você tem 7 dias para avaliar todas as funcionalidades sem custo.' 
              : '🚀 <strong>Cadastro Efetivo</strong> - Sua subscrição já está ativa e a cobrança será realizada conforme o plano contratado.'}
            <div class="badge ${tipoCadastro === 'teste' ? 'badge-teste' : 'badge-efetivo'}">
              ${tipoCadastro === 'teste' ? '7 DIAS DE TESTE' : 'COBRANÇA ATIVA'}
            </div>
          </div>

          <p style="color: #666; font-weight: bold; margin-top: 30px;">
            Próxima etapa: Validar sua senha
          </p>

          <p style="color: #666; line-height: 1.6;">
            Para ativar sua conta e acessar o sistema, clique no botão abaixo para criar/validar sua senha:
          </p>

          <center>
            <a href="${linkValidacao}" class="cta-button">
              ✅ Validar Senha e Acessar Sistema
            </a>
          </center>

          <div class="steps">
            <strong style="color: #123b63; display: block; margin-bottom: 15px;">Como usar seu conta:</strong>
            
            <div class="step">
              <div class="step-number">1</div>
              <div class="step-content">
                <strong>Clique no botão acima</strong>
                <p>Você será redirecionado para a página de validação de senha</p>
              </div>
            </div>

            <div class="step">
              <div class="step-number">2</div>
              <div class="step-content">
                <strong>Crie sua senha segura</strong>
                <p>Escolha uma senha forte com pelo menos 6 caracteres</p>
              </div>
            </div>

            <div class="step">
              <div class="step-number">3</div>
              <div class="step-content">
                <strong>Acesse o sistema</strong>
                <p>Use seu email e a nova senha para fazer login</p>
              </div>
            </div>

            <div class="step">
              <div class="step-number">4</div>
              <div class="step-content">
                <strong>Comece a usar!</strong>
                <p>Seu dashboard estará pronto para gerenciar ${nomeMinisterio}</p>
              </div>
            </div>
          </div>

          <p style="color: #999; font-size: 13px; margin-top: 30px;">
            <strong>⏰ Este link expira em 7 dias.</strong> Se você não ativou sua conta a tempo, 
            entre em contato com nosso suporte.
          </p>

          <p style="color: #666; line-height: 1.6; margin-top: 20px;">
            Se você não solicitou este cadastro ou tem dúvidas, entre em contato conosco no email 
            <strong>suporte@gestaoeclesial.com.br</strong>
          </p>
        </div>

        <div class="footer">
          <p><strong>Gestão Eclesial™</strong> - Sistema de Gestão para Igrejas e Ministérios</p>
          <p>© ${new Date().getFullYear()} Todos os direitos reservados.</p>
          <p>Este é um email automático. Favor não responder diretamente.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Simula envio de email (em produção usaria SendGrid, Mailgun, etc)
 */
export async function enviarEmailBoasVindas(
  nomePastor: string,
  nomeMinisterio: string,
  emailAdmin: string,
  ministryId: string,
  tipoCadastro: 'teste' | 'efetivo'
): Promise<{ sucesso: boolean; token?: string; mensagem: string }> {
  try {
    // Gerar token
    const token = gerarTokenValidacao();

    // Armazenar token
    armazenarTokenValidacao(ministryId, emailAdmin, token);

    // Gerar link de validação
    const linkValidacao = `${window.location.origin}/validar-senha?ministry_id=${ministryId}&token=${token}`;

    // Gerar HTML do email
    const htmlEmail = gerarEmailHTML(nomePastor, nomeMinisterio, linkValidacao, tipoCadastro);

    // Em produção, seria enviado via API
    console.log('📧 Email de boas-vindas preparado:', {
      para: emailAdmin,
      assunto: `Bem-vindo ao Gestão Eclesial - ${nomeMinisterio}`,
      html: htmlEmail,
      token
    });

    // Simular envio bem-sucedido
    return {
      sucesso: true,
      token,
      mensagem: `✅ Email de boas-vindas enviado para ${emailAdmin}`
    };
  } catch (erro) {
    console.error('❌ Erro ao enviar email:', erro);
    return {
      sucesso: false,
      mensagem: 'Erro ao enviar email de boas-vindas'
    };
  }
}

/**
 * Recuperar informações do token
 */
export function obterInfoToken(token: string): EmailValidacao | null {
  return tokensValidacao.find(v => v.token === token) || null;
}
