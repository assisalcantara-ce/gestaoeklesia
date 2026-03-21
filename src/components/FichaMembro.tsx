'use client';

import { useRef } from 'react';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface DadosMembro {
  matricula: string;
  id: string;
  uniqueId: string;
  nome: string;
  cpf: string;
  tipoCadastro: string;
  cargo?: string;
  status?: string;
  dataNascimento?: string;
  sexo?: string;
  tipoSanguineo?: string;
  escolaridade?: string;
  estadoCivil?: string;
  rg?: string;
  nacionalidade?: string;
  naturalidade?: string;
  uf?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  complemento?: string;
  cidade?: string;
  email?: string;
  celular?: string;
  whatsapp?: string;
  nomeConjuge?: string;
  cpfConjuge?: string;
  dataNascimentoConjuge?: string;
  nomePai?: string;
  nomeMae?: string;
  qualFuncao?: string;
  setorDepartamento?: string;
}

interface DadosIgreja {
  nomeIgreja: string;
  endereco: string;
  telefone: string;
  email: string;
  logoUrl?: string;
}

interface FichaMembroProps {
  membro: DadosMembro;
  dadosIgreja: DadosIgreja;
  fotoUrl?: string;
}

export default function FichaMembro({ membro, dadosIgreja, fotoUrl }: FichaMembroProps) {
  const fichaRef = useRef<HTMLDivElement>(null);

  const imprimirFicha = () => {
    if (fichaRef.current) {
      const printWindow = window.open('', '', 'height=1000,width=900');
      if (printWindow) {
        const html = fichaRef.current.innerHTML;
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <title>Ficha do Membro - ${membro.nome}</title>
              <style>
                * { margin: 0; padding: 0; }
                body { 
                  font-family: Arial, sans-serif; 
                  padding: 0;
                  background: white;
                }
              </style>
            </head>
            <body>
              ${html}
            </body>
          </html>
        `);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.print();
        }, 250);
      }
    }
  };

  const gerarPDF = async () => {
    if (!fichaRef.current) {
      alert('Erro: Ficha não encontrada.');
      return;
    }

    try {
      await new Promise(resolve => setTimeout(resolve, 500));

      const canvas = await html2canvas(fichaRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowHeight: fichaRef.current.scrollHeight,
        windowWidth: fichaRef.current.scrollWidth
      });

      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      let heightLeft = imgHeight;
      let position = 0;
      const pageHeight = 297;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const nomeArquivo = `Ficha_${membro.nome.replace(/\s+/g, '_')}_${membro.matricula}.pdf`;
      pdf.save(nomeArquivo);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={gerarPDF}
          style={{
            padding: '10px 20px',
            backgroundColor: '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px'
          }}
        >
          📥 Baixar PDF
        </button>
        <button
          onClick={imprimirFicha}
          style={{
            padding: '10px 20px',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px'
          }}
        >
          🖨️ Imprimir Ficha
        </button>
      </div>

      <div
        ref={fichaRef}
        style={{
          width: '210mm',
          height: '297mm',
          margin: '0 auto',
          padding: '15mm',
          fontFamily: 'Arial, sans-serif',
          fontSize: '12px',
          lineHeight: '1.4',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#fff',
          color: '#333',
          boxSizing: 'border-box'
        }}
      >
        {/* ===== CABEÇALHO PROFISSIONAL ===== */}
        <div style={{ marginBottom: '15px' }}>
          {/* Linha 1: Logo + Nome da Igreja Centralizado */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '15px',
            paddingBottom: '10px',
            borderBottom: '3px solid #003d7a',
            marginBottom: '12px'
          }}>
            {dadosIgreja.logoUrl && (
              <img
                src={dadosIgreja.logoUrl}
                alt="Logo"
                style={{ width: '70px', height: '70px', objectFit: 'contain' }}
              />
            )}
            <div style={{ textAlign: 'center' }}>
              <h1 style={{
                fontSize: '20px',
                fontWeight: 'bold',
                color: '#003d7a',
                margin: '0 0 4px 0',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {dadosIgreja.nomeIgreja}
              </h1>
              <p style={{ margin: '2px 0', fontSize: '11px', color: '#666' }}>
                {dadosIgreja.endereco}
              </p>
              <p style={{ margin: '2px 0', fontSize: '11px', color: '#666' }}>
                Tel: {dadosIgreja.telefone} | Email: {dadosIgreja.email}
              </p>
            </div>
          </div>

          {/* Linha 2: Matrícula/Nome + Foto/QR */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: '15px',
            alignItems: 'center'
          }}>
            {/* Matrícula e Nome em Caixa Horizontal */}
            <div style={{
              background: 'linear-gradient(135deg, #1e40af 0%, #003d7a 100%)',
              borderRadius: '8px',
              padding: '12px 16px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div>
                  <p style={{ margin: '0', fontSize: '10px', color: '#fff', opacity: 0.9, fontWeight: '600' }}>
                    MATRÍCULA
                  </p>
                  <p style={{ margin: '2px 0 0 0', fontSize: '18px', color: '#fff', fontWeight: 'bold' }}>
                    {membro.matricula}
                  </p>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0', fontSize: '10px', color: '#fff', opacity: 0.9, fontWeight: '600' }}>
                    NOME DO MEMBRO
                  </p>
                  <p style={{ margin: '2px 0 0 0', fontSize: '16px', color: '#fff', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                    {membro.nome}
                  </p>
                </div>
              </div>
            </div>

            {/* Foto e QR Code Lado a Lado */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {/* Foto */}
              <div style={{
                width: '100px',
                height: '120px',
                border: '3px solid #003d7a',
                background: '#f5f5f5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                borderRadius: '4px'
              }}>
                {fotoUrl ? (
                  <img src={fotoUrl} alt={membro.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '32px', color: '#999' }}>📷</span>
                )}
              </div>

              {/* QR Code */}
              <div style={{
                border: '2px solid #003d7a',
                padding: '4px',
                background: '#fff',
                borderRadius: '4px'
              }}>
                <QRCode
                  value={membro.uniqueId}
                  size={80}
                  level="L"
                  includeMargin={false}
                  fgColor="#003d7a"
                  bgColor="#ffffff"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ===== TABELA DE DADOS ===== */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px', fontSize: '11px' }}>
          <tbody>
            {/* DADOS PESSOAIS */}
            <tr>
              <td colSpan={4} style={{
                background: '#003d7a',
                color: '#fff',
                padding: '6px 10px',
                fontWeight: 'bold',
                fontSize: '12px'
              }}>
                DADOS PESSOAIS
              </td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #ddd', padding: '5px 8px', width: '15%', fontWeight: 'bold', background: '#f9f9f9' }}>CPF:</td>
              <td style={{ border: '1px solid #ddd', padding: '5px 8px', width: '35%' }}>{membro.cpf}</td>
              <td style={{ border: '1px solid #ddd', padding: '5px 8px', width: '15%', fontWeight: 'bold', background: '#f9f9f9' }}>RG:</td>
              <td style={{ border: '1px solid #ddd', padding: '5px 8px', width: '35%' }}>{membro.rg || '—'}</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 'bold', background: '#f9f9f9' }}>Nascimento:</td>
              <td style={{ border: '1px solid #ddd', padding: '5px 8px' }}>{membro.dataNascimento || '—'}</td>
              <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 'bold', background: '#f9f9f9' }}>Sexo:</td>
              <td style={{ border: '1px solid #ddd', padding: '5px 8px' }}>{membro.sexo || '—'}</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 'bold', background: '#f9f9f9' }}>Estado Civil:</td>
              <td style={{ border: '1px solid #ddd', padding: '5px 8px' }}>{membro.estadoCivil || '—'}</td>
              <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 'bold', background: '#f9f9f9' }}>Tipo Sanguíneo:</td>
              <td style={{ border: '1px solid #ddd', padding: '5px 8px' }}>{membro.tipoSanguineo || '—'}</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 'bold', background: '#f9f9f9' }}>Nacionalidade:</td>
              <td colSpan={3} style={{ border: '1px solid #ddd', padding: '5px 8px' }}>{membro.nacionalidade || '—'}</td>
            </tr>

            {/* DADOS FAMILIARES */}
            {(membro.nomePai || membro.nomeMae || membro.nomeConjuge) && (
              <>
                <tr>
                  <td colSpan={4} style={{
                    background: '#003d7a',
                    color: '#fff',
                    padding: '6px 10px',
                    fontWeight: 'bold',
                    fontSize: '12px'
                  }}>
                    DADOS FAMILIARES
                  </td>
                </tr>
                {membro.nomePai && (
                  <tr>
                    <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 'bold', background: '#f9f9f9' }}>Pai:</td>
                    <td colSpan={3} style={{ border: '1px solid #ddd', padding: '5px 8px' }}>{membro.nomePai}</td>
                  </tr>
                )}
                {membro.nomeMae && (
                  <tr>
                    <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 'bold', background: '#f9f9f9' }}>Mãe:</td>
                    <td colSpan={3} style={{ border: '1px solid #ddd', padding: '5px 8px' }}>{membro.nomeMae}</td>
                  </tr>
                )}
                {membro.nomeConjuge && (
                  <tr>
                    <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 'bold', background: '#f9f9f9' }}>Cônjuge:</td>
                    <td style={{ border: '1px solid #ddd', padding: '5px 8px' }}>{membro.nomeConjuge}</td>
                    <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 'bold', background: '#f9f9f9' }}>Nasc. Cônjuge:</td>
                    <td style={{ border: '1px solid #ddd', padding: '5px 8px' }}>{membro.dataNascimentoConjuge || '—'}</td>
                  </tr>
                )}
              </>
            )}

            {/* DADOS MINISTERIAIS */}
            {(membro.tipoCadastro === 'ministro' || membro.cargo) && (
              <>
                <tr>
                  <td colSpan={4} style={{
                    background: '#003d7a',
                    color: '#fff',
                    padding: '6px 10px',
                    fontWeight: 'bold',
                    fontSize: '12px'
                  }}>
                    DADOS MINISTERIAIS
                  </td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 'bold', background: '#f9f9f9' }}>Tipo:</td>
                  <td style={{ border: '1px solid #ddd', padding: '5px 8px' }}>{membro.tipoCadastro || '—'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 'bold', background: '#f9f9f9' }}>Cargo:</td>
                  <td style={{ border: '1px solid #ddd', padding: '5px 8px' }}>{membro.cargo || '—'}</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 'bold', background: '#f9f9f9' }}>Status:</td>
                  <td style={{ border: '1px solid #ddd', padding: '5px 8px' }}>{membro.status === 'ativo' ? 'ATIVO' : 'INATIVO'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 'bold', background: '#f9f9f9' }}>Função:</td>
                  <td style={{ border: '1px solid #ddd', padding: '5px 8px' }}>{membro.qualFuncao || '—'}</td>
                </tr>
                {membro.setorDepartamento && (
                  <tr>
                    <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 'bold', background: '#f9f9f9' }}>Setor:</td>
                    <td colSpan={3} style={{ border: '1px solid #ddd', padding: '5px 8px' }}>{membro.setorDepartamento}</td>
                  </tr>
                )}
              </>
            )}

            {/* ENDEREÇO */}
            <tr>
              <td colSpan={4} style={{
                background: '#003d7a',
                color: '#fff',
                padding: '6px 10px',
                fontWeight: 'bold',
                fontSize: '12px'
              }}>
                ENDEREÇO
              </td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 'bold', background: '#f9f9f9' }}>Logradouro:</td>
              <td colSpan={3} style={{ border: '1px solid #ddd', padding: '5px 8px' }}>{membro.logradouro || '—'}</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 'bold', background: '#f9f9f9' }}>Número:</td>
              <td style={{ border: '1px solid #ddd', padding: '5px 8px' }}>{membro.numero || '—'}</td>
              <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 'bold', background: '#f9f9f9' }}>Bairro:</td>
              <td style={{ border: '1px solid #ddd', padding: '5px 8px' }}>{membro.bairro || '—'}</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 'bold', background: '#f9f9f9' }}>Complemento:</td>
              <td style={{ border: '1px solid #ddd', padding: '5px 8px' }}>{membro.complemento || '—'}</td>
              <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 'bold', background: '#f9f9f9' }}>CEP:</td>
              <td style={{ border: '1px solid #ddd', padding: '5px 8px' }}>{membro.cep || '—'}</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 'bold', background: '#f9f9f9' }}>Cidade:</td>
              <td style={{ border: '1px solid #ddd', padding: '5px 8px' }}>{membro.cidade || '—'}</td>
              <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 'bold', background: '#f9f9f9' }}>UF:</td>
              <td style={{ border: '1px solid #ddd', padding: '5px 8px' }}>{membro.uf || '—'}</td>
            </tr>

            {/* CONTATO */}
            <tr>
              <td colSpan={4} style={{
                background: '#003d7a',
                color: '#fff',
                padding: '6px 10px',
                fontWeight: 'bold',
                fontSize: '12px'
              }}>
                CONTATO
              </td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 'bold', background: '#f9f9f9' }}>Celular:</td>
              <td style={{ border: '1px solid #ddd', padding: '5px 8px' }}>{membro.celular || '—'}</td>
              <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 'bold', background: '#f9f9f9' }}>WhatsApp:</td>
              <td style={{ border: '1px solid #ddd', padding: '5px 8px' }}>{membro.whatsapp || '—'}</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 'bold', background: '#f9f9f9' }}>Email:</td>
              <td colSpan={3} style={{ border: '1px solid #ddd', padding: '5px 8px' }}>{membro.email || '—'}</td>
            </tr>
          </tbody>
        </table>

        {/* ===== ESPAÇO FLEXÍVEL ===== */}
        <div style={{ flex: 1 }}></div>

        {/* ===== RODAPÉ ===== */}
        <div style={{
          borderTop: '2px solid #003d7a',
          paddingTop: '10px',
          fontSize: '11px',
          color: '#333',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '15px'
        }}>
          <div>
            <p style={{ margin: '0', fontWeight: 'bold', color: '#003d7a' }}>Data:</p>
            <p style={{ margin: '4px 0 0 0' }}>{new Date().toLocaleDateString('pt-BR')}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: '0', color: '#666', fontWeight: 'bold' }}>Gestão Eclesial</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: '0', fontWeight: 'bold', color: '#003d7a' }}>Assinatura:</p>
            <div style={{
              borderTop: '2px solid #333',
              marginTop: '12px',
              width: '100px',
              marginLeft: 'auto'
            }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}
