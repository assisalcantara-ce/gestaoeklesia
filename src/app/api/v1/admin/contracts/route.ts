import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

// Gerar número de contrato
function generateContractNumber() {
  const date = new Date();
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `CT-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}-${timestamp}${random}`;
}

// Gerar conteúdo do contrato em HTML
function generateContractHTML(contractData: any): string {
  const {
    contractNumber,
    contractDate,
    ministryName,
    pastorName,
    cpfCnpj,
    quantityTemples,
    quantityMembers,
    planName = 'Plano Standard',
    monthlyPrice = 'Consultar',
    trialDays = 7,
  } = contractData;

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contrato de Serviço - GestãoEclesial</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            background-color: white;
            padding: 40px;
            border: 1px solid #ddd;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #0066cc;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #0066cc;
            margin: 0;
            font-size: 28px;
        }
        .header p {
            color: #666;
            margin: 5px 0 0 0;
            font-size: 12px;
        }
        .contract-number {
            text-align: right;
            color: #666;
            font-size: 12px;
            margin-bottom: 20px;
        }
        .section {
            margin-bottom: 25px;
        }
        .section-title {
            background-color: #f0f0f0;
            padding: 10px 15px;
            font-weight: bold;
            color: #0066cc;
            margin-bottom: 15px;
            border-left: 4px solid #0066cc;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 15px;
        }
        .info-item {
            padding: 10px;
            background-color: #fafafa;
            border: 1px solid #eee;
            border-radius: 4px;
        }
        .info-label {
            color: #666;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
            margin-bottom: 5px;
        }
        .info-value {
            color: #333;
            font-size: 14px;
            word-break: break-word;
        }
        .terms {
            line-height: 1.8;
            color: #333;
            font-size: 13px;
        }
        .terms p {
            margin: 12px 0;
            text-align: justify;
        }
        .terms li {
            margin: 8px 0;
        }
        .signature-section {
            margin-top: 40px;
            padding-top: 40px;
            border-top: 1px solid #ddd;
        }
        .signature-line {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin-top: 40px;
        }
        .sig-box {
            text-align: center;
        }
        .sig-line {
            border-top: 1px solid #333;
            margin-top: 40px;
            padding-top: 5px;
            font-size: 12px;
        }
        .highlight {
            background-color: #fffacd;
            padding: 15px;
            border-left: 4px solid #ffd700;
            margin: 15px 0;
            border-radius: 4px;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #666;
            font-size: 11px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🙏 GestãoEclesial</h1>
            <p>Sistema de Gestão Administrativa para Igrejas e Ministérios</p>
        </div>

        <div class="contract-number">
            <strong>Contrato Nº:</strong> ${contractNumber}<br>
            <strong>Data:</strong> ${new Date(contractDate).toLocaleDateString('pt-BR')}
        </div>

        <!-- DADOS DO CLIENTE -->
        <div class="section">
            <div class="section-title">📋 Dados do Cliente</div>
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">Ministério / Igreja</div>
                    <div class="info-value">${ministryName}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Responsável / Pastor(a)</div>
                    <div class="info-value">${pastorName}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">CPF / CNPJ</div>
                    <div class="info-value">${cpfCnpj}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Quantidade de Templos</div>
                    <div class="info-value">${quantityTemples}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Quantidade de Membros</div>
                    <div class="info-value">${quantityMembers}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Plano Contratado</div>
                    <div class="info-value">${planName}</div>
                </div>
            </div>
        </div>

        <!-- TERMOS DE SERVIÇO -->
        <div class="section">
            <div class="section-title">📄 Termos de Serviço</div>
            <div class="terms">
                <p><strong>1. OBJETO DO CONTRATO</strong></p>
                <p>
                    A GestãoEclesial ("PRESTADORA") se compromete a fornecer acesso ao sistema de gestão administrativa para igrejas e ministérios ("SERVIÇO") ao cliente acima identificado ("CONTRATANTE") conforme as características e funcionalidades descritas no plano contratado.
                </p>

                <p><strong>2. PERÍODO DE TESTE</strong></p>
                <p>
                    O CONTRATANTE terá direito a um período de teste de <strong>${trialDays} (${trialDays === 7 ? 'sete' : trialDays === 14 ? 'quatorze' : trialDays}) dias</strong> para avaliar o SERVIÇO sem custos. Após este período, o SERVIÇO será cobrado conforme tabela de preços vigente.
                </p>

                <div class="highlight">
                    <strong>⚠️ Importante:</strong> O acesso ao período de teste é pessoal e intransferível. Qualquer uso não autorizado resultará no cancelamento imediato do acesso.
                </div>

                <p><strong>3. PREÇO E CONDIÇÕES DE PAGAMENTO</strong></p>
                <ul>
                    <li>Plano: <strong>${planName}</strong></li>
                    <li>Valor mensal: <strong>R\$ ${monthlyPrice}</strong></li>
                    <li>Faturamento: Mensal, com vencimento no primeiro dia do mês seguinte</li>
                    <li>Forma de pagamento: PIX, Cartão de Crédito ou Boleto Bancário</li>
                    <li>Multa por atraso: 2% ao mês ou taxa SELIC, o que for maior</li>
                </ul>

                <p><strong>4. OBRIGAÇÕES DA PRESTADORA</strong></p>
                <ul>
                    <li>Manter o SERVIÇO disponível 24/7 com no mínimo 99,5% de uptime</li>
                    <li>Prestar suporte técnico via email, WhatsApp ou telefone</li>
                    <li>Manter a segurança e confidencialidade dos dados do CONTRATANTE</li>
                    <li>Realizar backups regulares dos dados</li>
                    <li>Implementar atualizações de segurança conforme necessário</li>
                </ul>

                <p><strong>5. OBRIGAÇÕES DO CONTRATANTE</strong></p>
                <ul>
                    <li>Utilizar o SERVIÇO de forma legal e em conformidade com as leis aplicáveis</li>
                    <li>Não reproduzir, modificar ou distribuir o SERVIÇO sem autorização</li>
                    <li>Manter confidencialidade das credenciais de acesso</li>
                    <li>Informar à PRESTADORA sobre qualquer uso não autorizado</li>
                    <li>Efetuar o pagamento das faturas dentro dos prazos establecidos</li>
                </ul>

                <p><strong>6. PRIVACIDADE E PROTEÇÃO DE DADOS</strong></p>
                <p>
                    O CONTRATANTE consente com a coleta e processamento de dados conforme a Lei Geral de Proteção de Dados (LGPD). A PRESTADORA se compromete a manter todos os dados em sigilo absoluto e utilizá-los exclusivamente para prestação do SERVIÇO.
                </p>

                <p><strong>7. CANCELAMENTO E RESCISÃO</strong></p>
                <ul>
                    <li>O CONTRATANTE pode cancelar a qualquer momento após o período de teste</li>
                    <li>Cancelamentos dentro do período de teste não geram custos</li>
                    <li>Cancelamentos após o período de teste seguem as regras contratadas</li>
                    <li>Após cancelamento, o acesso será desativado imediatamente</li>
                </ul>

                <p><strong>8. LIMITAÇÃO DE RESPONSABILIDADE</strong></p>
                <p>
                    A PRESTADORA não será responsável por danos indiretos, perdas de lucros ou dados resultantes do uso ou impossibilidade de uso do SERVIÇO. A responsabilidade máxima será limitada ao valor pago no último mês.
                </p>

                <p><strong>9. DISPOSIÇÕES GERAIS</strong></p>
                <p>
                    Este contrato é regido pela lei brasileira. Qualquer modificação deve ser feita por escrito e assinada por ambas as partes. A invalidade de qualquer cláusula não afeta as demais.
                </p>
            </div>
        </div>

        <!-- ASSINATURAS -->
        <div class="signature-section">
            <div class="section-title">✍️ Assinaturas</div>
            <div class="signature-line">
                <div class="sig-box">
                    <p>Pela PRESTADORA:</p>
                    <div class="sig-line">GestãoEclesial</div>
                </div>
                <div class="sig-box">
                    <p>Pelo CONTRATANTE:</p>
                    <div class="sig-line">${pastorName}</div>
                </div>
            </div>
        </div>

        <div class="footer">
            <p>
                Este é um documento oficial gerado automaticamente pelo sistema GestãoEclesial.<br>
                Para verificação de autenticidade, entre em contato conosco.
            </p>
        </div>
    </div>
</body>
</html>
  `;
}

// POST /api/v1/admin/contracts - Gerar contrato
export async function POST(request: NextRequest) {
  try {
    const guard = await requireAdmin(request, { requiredRole: 'admin' });
    if (!guard.ok) return guard.response;

    const body = await request.json();
    const {
      pre_registration_id,
      plan_name = 'Plano Standard',
      monthly_price = 'Consultar',
      trial_days = 7,
    } = body;

    if (!pre_registration_id) {
      return NextResponse.json(
        { success: false, error: 'pre_registration_id é obrigatório' },
        { status: 400 }
      );
    }

    // Obter dados do pré-registro
    const { data: preReg, error: preRegError } = await supabaseAdmin
      .from('pre_registrations')
      .select('*')
      .eq('id', pre_registration_id)
      .single();

    if (preRegError || !preReg) {
      return NextResponse.json(
        { success: false, error: 'Pré-registro não encontrado' },
        { status: 404 }
      );
    }

    // Gerar número de contrato
    const contractNumber = generateContractNumber();

    // Preparar dados do contrato
    const contractData = {
      contractNumber,
      contractDate: new Date().toISOString(),
      ministryName: preReg.ministry_name,
      pastorName: preReg.pastor_name,
      cpfCnpj: preReg.cpf_cnpj,
      quantityTemples: preReg.quantity_temples || 1,
      quantityMembers: preReg.quantity_members || 0,
      planName: plan_name,
      monthlyPrice: monthly_price,
      trialDays: trial_days,
    };

    // Gerar HTML do contrato
    const contractHTML = generateContractHTML(contractData);

    // Salvar contrato no banco (sem arquivo, apenas HTML)
    const { data: contract, error: contractError } = await supabaseAdmin
      .from('generated_contracts')
      .insert({
        pre_registration_id,
        contract_number: contractNumber,
        contract_type: 'standard',
        status: 'draft',
        contract_data: contractData,
        generated_by: 'system', // Em produção, usar auth.uid()
      })
      .select()
      .single();

    if (contractError) {
      console.error('Error creating contract record:', contractError);
      return NextResponse.json(
        { success: false, error: 'Erro ao salvar contrato' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: contract.id,
        contract_number: contractNumber,
        status: 'draft',
        html_content: contractHTML,
        download_url: `/api/v1/admin/contracts/${contract.id}/download`,
      },
      message: 'Contrato gerado com sucesso!',
    });
  } catch (error) {
    console.error('Unexpected error in POST /api/v1/admin/contracts:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/v1/admin/contracts/:id - Obter contrato
export async function GET(request: NextRequest) {
  try {
    const guard = await requireAdmin(request, { requiredRole: 'admin' });
    if (!guard.ok) return guard.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID do contrato é obrigatório' },
        { status: 400 }
      );
    }

    const { data: contract, error } = await supabaseAdmin
      .from('generated_contracts')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !contract) {
      return NextResponse.json(
        { success: false, error: 'Contrato não encontrado' },
        { status: 404 }
      );
    }

    // Regenerar HTML do contrato
    const contractHTML = generateContractHTML(contract.contract_data);

    return NextResponse.json({
      success: true,
      data: {
        ...contract,
        html_content: contractHTML,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/v1/admin/contracts:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
