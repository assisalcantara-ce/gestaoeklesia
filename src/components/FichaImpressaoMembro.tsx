'use client';

import { useRef } from 'react';
import { QRCodeSVG as QRCode } from 'qrcode.react';

interface Membro {
  id: string;
  matricula: string;
  nome: string;
  cpf: string;
  tipoCadastro: 'membro' | 'congregado' | 'ministro' | 'crianca';
  cargo: string;
  supervisao: string;
  campo: string;
  status: 'ativo' | 'inativo';
}

interface DadosIgreja {
  nome: string;
  logotipo: string;
  endereco: string;
  telefone: string;
}

interface FichaImpressaoMembroProps {
  membro: Membro;
  dadosIgreja: DadosIgreja;
  fotoMembro?: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function FichaImpressaoMembro({
  membro,
  dadosIgreja,
  fotoMembro,
  isOpen,
  onClose,
}: FichaImpressaoMembroProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (printRef.current) {
      const printWindow = window.open('', '', 'height=800,width=600');
      if (printWindow) {
        printWindow.document.write(printRef.current.innerHTML);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full my-8">
        {/* Header Modal */}
        <div className="flex justify-between items-center px-6 py-4 border-b-2 border-teal-500 bg-gradient-to-r from-teal-600 to-teal-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>🖨️</span> Ficha de Impressão
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-100 text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Conteúdo para Impressão */}
        <div
          ref={printRef}
          className="p-8 bg-white"
          style={{ 
            width: '100%',
            fontFamily: 'Arial, sans-serif'
          }}
        >
          {/* Cabeçalho com Logo e Dados da Igreja */}
          <div className="flex items-start gap-6 mb-8 pb-6 border-b-2 border-gray-300">
            {/* Logo à Esquerda */}
            <div className="flex-shrink-0">
              <img
                src={dadosIgreja.logotipo}
                alt="Logo"
                style={{ width: '80px', height: '80px', objectFit: 'contain' }}
              />
            </div>

            {/* Dados da Igreja */}
            <div className="flex-1">
              <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0d9488', margin: '0 0 8px 0' }}>
                {dadosIgreja.nome}
              </h1>
              <p style={{ fontSize: '12px', color: '#666', margin: '4px 0' }}>
                <span style={{ fontWeight: 'bold' }}>Endereço:</span> {dadosIgreja.endereco}
              </p>
              <p style={{ fontSize: '12px', color: '#666', margin: '4px 0' }}>
                <span style={{ fontWeight: 'bold' }}>Telefone:</span> {dadosIgreja.telefone}
              </p>
              <p style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                Ficha de Cadastro de Membro
              </p>
            </div>
          </div>

          {/* Conteúdo da Ficha */}
          <div className="grid grid-cols-3 gap-6 mb-6">
            {/* Foto do Membro */}
            <div className="col-span-1 flex flex-col items-center">
              {fotoMembro ? (
                <img
                  src={fotoMembro}
                  alt={membro.nome}
                  style={{
                    width: '120px',
                    height: '150px',
                    objectFit: 'cover',
                    border: '2px solid #0d9488',
                    borderRadius: '4px',
                    marginBottom: '12px'
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '120px',
                    height: '150px',
                    backgroundColor: '#e5e7eb',
                    border: '2px solid #d1d5db',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '12px',
                    fontSize: '32px'
                  }}
                >
                  📷
                </div>
              )}
              <p style={{ fontSize: '11px', textAlign: 'center', color: '#666' }}>
                Foto 3x4
              </p>
            </div>

            {/* Dados do Membro */}
            <div className="col-span-2">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '6px 0', fontSize: '12px' }}>
                      <span style={{ fontWeight: 'bold' }}>Matrícula:</span>
                    </td>
                    <td style={{ padding: '6px 0', fontSize: '12px', fontWeight: 'bold', color: '#0d9488' }}>
                      {membro.matricula}
                    </td>
                    <td style={{ padding: '6px 12px', fontSize: '12px' }}>
                      <span style={{ fontWeight: 'bold' }}>Status:</span>
                    </td>
                    <td style={{ padding: '6px 0', fontSize: '12px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: membro.status === 'ativo' ? '#dcfce7' : '#fee2e2',
                          color: membro.status === 'ativo' ? '#166534' : '#991b1b',
                          fontWeight: 'bold',
                          fontSize: '11px'
                        }}
                      >
                        {membro.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 0', fontSize: '12px' }}>
                      <span style={{ fontWeight: 'bold' }}>Nome:</span>
                    </td>
                    <td colSpan={3} style={{ padding: '6px 0', fontSize: '12px' }}>
                      {membro.nome}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 0', fontSize: '12px' }}>
                      <span style={{ fontWeight: 'bold' }}>CPF:</span>
                    </td>
                    <td style={{ padding: '6px 0', fontSize: '12px' }}>
                      {membro.cpf}
                    </td>
                    <td style={{ padding: '6px 12px', fontSize: '12px' }}>
                      <span style={{ fontWeight: 'bold' }}>Tipo:</span>
                    </td>
                    <td style={{ padding: '6px 0', fontSize: '12px' }}>
                      {membro.tipoCadastro.charAt(0).toUpperCase() + membro.tipoCadastro.slice(1)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 0', fontSize: '12px' }}>
                      <span style={{ fontWeight: 'bold' }}>Cargo:</span>
                    </td>
                    <td colSpan={3} style={{ padding: '6px 0', fontSize: '12px' }}>
                      {membro.cargo}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 0', fontSize: '12px' }}>
                      <span style={{ fontWeight: 'bold' }}>Supervisão:</span>
                    </td>
                    <td colSpan={3} style={{ padding: '6px 0', fontSize: '12px' }}>
                      {membro.supervisao}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 0', fontSize: '12px' }}>
                      <span style={{ fontWeight: 'bold' }}>Campo:</span>
                    </td>
                    <td colSpan={3} style={{ padding: '6px 0', fontSize: '12px' }}>
                      {membro.campo}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* QRCode e Assinatura */}
          <div className="grid grid-cols-2 gap-8 mt-8 pt-8 border-t border-gray-300">
            {/* QRCode */}
            <div className="flex flex-col items-center">
              <div style={{ backgroundColor: '#f3f4f6', padding: '12px', borderRadius: '4px' }}>
                <QRCode
                  value={membro.id}
                  size={120}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <p style={{ fontSize: '10px', color: '#666', marginTop: '8px' }}>
                ID: {membro.id}
              </p>
            </div>

            {/* Assinatura */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{
                  borderTop: '1px solid #000',
                  paddingTop: '32px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  margin: '0'
                }}>
                  ___________________________
                </p>
                <p style={{ fontSize: '10px', color: '#666', margin: '4px 0 0 0' }}>
                  Assinatura do Responsável
                </p>
              </div>
            </div>
          </div>

          {/* Rodapé */}
          <div style={{
            marginTop: '24px',
            paddingTop: '12px',
            borderTop: '1px solid #e5e7eb',
            textAlign: 'center',
            fontSize: '9px',
            color: '#999'
          }}>
            <p style={{ margin: '0' }}>
              Documento impresso em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}
            </p>
          </div>
        </div>

        {/* Botões */}
        <div className="flex gap-4 px-6 py-4 border-t border-gray-300 bg-gray-50">
          <button
            onClick={handlePrint}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition font-semibold text-sm flex items-center justify-center gap-2"
          >
            <span>🖨️</span> Imprimir
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-semibold text-sm"
          >
            ✕ Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
