/*
'use client';

import { useRef } from 'react';
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

export default function FichaMembro({ membro }: { membro: DadosMembro }) {
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
      alert('Erro: Ficha nÃ£o encontrada.');
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
          ðŸ“¥ Baixar PDF
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
          ðŸ–¨ï¸ Imprimir Ficha
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
      </div>
    </div>
  );
}
*/

export default function FichaMembro() {
  return <div>Componente temporário desabilitado</div>;
}
