'use client';

import { useEffect, useState, useRef } from 'react';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { substituirPlaceholders } from '@/lib/cartoes-utils';
import { createClient } from '@/lib/supabase-client';
import { loadOrgNomenclaturasFromSupabaseOrMigrate } from '@/lib/org-nomenclaturas';
import { loadTemplatesForCurrentUser } from '@/lib/cartoes-templates-sync';
import { fetchConfiguracaoIgrejaFromSupabase } from '@/lib/igreja-config-utils';

interface Membro {
  id: string;
  uniqueId: string;
  matricula: string;
  nome: string;
  cpf: string;
  rg?: string;
  tipoCadastro: 'membro' | 'congregado' | 'ministro' | 'crianca' | 'funcionario';
  cargo?: string;
  supervisao?: string;
  campo?: string;
  dataNascimento?: string;
  dataBatismo?: string;
  filiacao?: string;
  nomePai?: string;
  nomeMae?: string;
  naturalidade?: string;
  nacionalidade?: string;
  estadoCivil?: string;
  tipoSanguineo?: string;
  validade?: string;
  email?: string;
  celular?: string;
  whatsapp?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  qualFuncao?: string;
  dataBatismoAguas?: string;
  dataBatismoEspiritoSanto?: string;
  status: 'ativo' | 'inativo';
  fotoUrl?: string;
  [key: string]: any;
}

interface CartãoMembroProps {
  membro: Membro;
  onClose?: () => void;
}

interface ElementoCartao {
  id: string;
  tipo: 'texto' | 'qrcode' | 'logo' | 'foto-membro' | 'chapa' | 'imagem';
  x: number;
  y: number;
  largura: number;
  altura: number;
  fontSize?: number;
  cor?: string;
  fonte?: string;
  transparencia?: number;
  borderRadius?: number;
  texto?: string;
  alinhamento?: 'left' | 'center' | 'right';
  negrito?: boolean;
  italico?: boolean;
  sublinhado?: boolean;
  visivel: boolean;
  backgroundColor?: string;
  imagemUrl?: string;
  sombreado?: boolean;
}

interface TemplateCartao {
  id: string;
  nome: string;
  tipoCadastro: 'membro' | 'congregado' | 'ministro' | 'funcionario';
  backgroundUrl?: string;
  elementos: ElementoCartao[];
  temVerso?: boolean;
  elementosVerso?: ElementoCartao[];
  backgroundUrlVerso?: string;
  orientacao?: 'landscape' | 'portrait';
  [key: string]: any;
}

export default function CartãoMembro({ membro, onClose }: CartãoMembroProps) {
  const supabase = createClient();

  const [template, setTemplate] = useState<TemplateCartao | null>(null);
  const [configIgreja, setConfigIgreja] = useState<any>(null);
  const [orgNomenclaturas, setOrgNomenclaturas] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [gerandoPDF, setGerandoPDF] = useState(false);
  const [mostraVerso, setMostraVerso] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Função auxiliar para obter dimensões CSS baseado na orientação
  const getDimensoesCSSCartao = (orientacao?: string) => {
    if (orientacao === 'portrait') {
      return { width: '291px', height: '465px' };  // Portrait: 210x297mm convertido
    }
    return { width: '465px', height: '291px' };     // Landscape: 297x210mm convertido (padrão)
  };

  useEffect(() => {
    loadOrgNomenclaturasFromSupabaseOrMigrate(supabase, { syncLocalStorage: false })
      .then(setOrgNomenclaturas)
      .catch(() => setOrgNomenclaturas(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      const { templates: templatesSalvos } = await loadTemplatesForCurrentUser(supabase, { allowLocalMigration: true });

      // Carregar config da igreja
      try {
        const config = await fetchConfiguracaoIgrejaFromSupabase(supabase);
        setConfigIgreja(config);
      } catch (e) {
        console.error('Erro ao carregar config igreja', e);
      }

    console.log('📋 Templates salvos:', templatesSalvos);

    let templateCarregado: TemplateCartao | null = null;

    // Buscar template do tipo de cadastro atual
    const tipoMapeado = membro.tipoCadastro === 'crianca' ? 'membro' : (membro.tipoCadastro as any);

    // Primeiro: buscar template ATIVO do tipo
    const templateAtivo = templatesSalvos.find((t: any) =>
      t.tipoCadastro === tipoMapeado && t.ativo === true
    );

    // Segundo: buscar qualquer template do tipo
    const templateSalvo = templatesSalvos.find((t: any) => t.tipoCadastro === tipoMapeado);

    if (templateAtivo) {
      console.log('✅ Usando template ATIVO:', templateAtivo.nome);
      templateCarregado = templateAtivo;
    } else if (templateSalvo) {
      console.log('⚠️ Usando template salvo (não ativo):', templateSalvo.nome);
      templateCarregado = templateSalvo;
    } else {
      console.log('❌ Nenhum template encontrado, usando padrão');
      // Fallback: usar template padrão
      const { getTemplatesPorTipo, converterParaTemplateEditavel } = require('@/lib/card-templates');
      const padroes = getTemplatesPorTipo(tipoMapeado);
      const fallback = padroes.length > 0 ? padroes[0] : null;
      templateCarregado = fallback ? converterParaTemplateEditavel(fallback) : null;
    }

    // ✅ GARANTIR ORIENTAÇÃO PORTRAIT PARA FUNCIONÁRIO
    if (tipoMapeado === 'funcionario' && templateCarregado) {
      templateCarregado = {
        ...templateCarregado,
        orientacao: 'portrait'  // Forçar portrait para funcionário
      };
      console.log('🎨 Orientação ajustada para PORTRAIT (Funcionário)');
    }

    if (templateCarregado) {
      console.log('🎴 Template carregado:', {
        nome: templateCarregado.nome,
        backgroundUrl: templateCarregado.backgroundUrl,
        elementos: templateCarregado.elementos.length,
        orientacao: templateCarregado.orientacao || 'landscape'
      });
    }

      setTemplate(templateCarregado);
      setLoading(false);
    })();
  }, [membro.tipoCadastro]);

  if (loading || !template) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 p-4">
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <p className="text-gray-600">Carregando template do cartão...</p>
        </div>
      </div>
    );
  }



  const renderizarElemento = (elemento: ElementoCartao, isPdf = false) => {
    if (!elemento.visivel) return null;

    const fontSize = elemento.fontSize || 10;
    // Compensação apenas para o PDF, preview fica centralizado
    const lift = isPdf ? (fontSize > 16 ? '-15px' : '-8px') : '0px';
    const lineHeight = '1.2';

    const estilo: React.CSSProperties = {
      position: 'absolute',
      left: `${elemento.x}px`,
      top: `${elemento.y}px`,
      width: `${elemento.largura}px`,
      height: `${elemento.altura}px`,
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: elemento.alinhamento === 'right' ? 'flex-end' : elemento.alinhamento === 'center' ? 'center' : 'flex-start',
      fontFamily: elemento.fonte || 'Arial',
      fontSize: elemento.fontSize ? `${elemento.fontSize}px` : 'inherit',
      color: elemento.cor || '#000',
      fontWeight: elemento.negrito ? 'bold' : 'normal',
      fontStyle: elemento.italico ? 'italic' : 'normal',
      textDecoration: elemento.sublinhado ? 'underline' : 'none',
      textAlign: (elemento.alinhamento || 'left') as any,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      textTransform: 'uppercase',
    };

    switch (elemento.tipo) {
      case 'texto': {
        // Injetar validadeAnos do template e dados da igreja no membro
        const membroComConfig = {
          ...membro,
          validadeAnos: template.validadeAnos || 1,
          nomeIgreja: configIgreja?.nome || 'Igreja',
          dataEmissao: template.dataEmissao || membro.dataEmissao
        };
        const textoSubstituido = substituirPlaceholders(elemento.texto || '', membroComConfig, orgNomenclaturas);

        return (
          <div
            key={elemento.id}
            style={{
              ...estilo,
              backgroundColor: elemento.backgroundColor || 'transparent',
              borderRadius: `${elemento.borderRadius || 0}px`,
              padding: '0',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'stretch',
              overflow: 'visible' // Permitir pequeno transbordo para evitar cortes de renderização
            }}
          >
            <div style={{
              position: 'relative',
              top: lift,
              width: '100%',
              paddingLeft: elemento.backgroundColor ? '10px' : '0',
              paddingRight: elemento.backgroundColor ? '5px' : '0',
              boxSizing: 'border-box',
              lineHeight: lineHeight,
              textAlign: (elemento.alinhamento || 'left') as any,
              display: 'block'
            }}
              dangerouslySetInnerHTML={{ __html: textoSubstituido }}
            />
          </div>
        );
      }
      case 'qrcode':
        return (
          <div key={elemento.id} style={estilo}>
            <QRCode
              value={membro.uniqueId || membro.id}
              size={Math.min(elemento.largura, elemento.altura)}
              level="H"
              includeMargin={false}
            />
          </div>
        );

      case 'imagem': {
        const styleContainer: React.CSSProperties = {
          ...estilo,
          overflow: 'hidden',
          borderRadius: `${elemento.borderRadius || 0}px`,
          opacity: elemento.transparencia ?? 1,
          backgroundColor: '#f3f4f6',
          border: elemento.imagemUrl ? undefined : '1px dashed #d1d5db',
          alignItems: 'center',
          justifyContent: 'center',
        };

        if (!elemento.imagemUrl) {
          return (
            <div key={elemento.id} style={styleContainer}>
              <span style={{ color: '#9ca3af', fontSize: Math.min(elemento.largura, elemento.altura) * 0.35 }}>
                🖼️
              </span>
            </div>
          );
        }

        return (
          <div key={elemento.id} style={styleContainer}>
            <img
              src={elemento.imagemUrl}
              alt="Imagem"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </div>
        );
      }
      case 'logo':
        const logoUrl = configIgreja?.logo || '/img/logo_menu.png';
        return (
          <div
            key={elemento.id}
            style={{
              ...estilo,
              opacity: elemento.transparencia || 1,
            }}
          >
            <img
              src={logoUrl}
              alt="Logo"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain'
              }}
            />
          </div>
        );
      case 'foto-membro':
        return (
          <div
            key={elemento.id}
            style={{
              ...estilo,
              background: membro.fotoUrl ? '#fff' : 'linear-gradient(to bottom, #f3f4f6, #e5e7eb)',
              color: '#9ca3af',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              border: membro.fotoUrl ? 'none' : '1px solid #d1d5db'
            }}
          >
            {membro.fotoUrl ? (
              <img
                src={membro.fotoUrl}
                alt="Foto"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            ) : (
              <span style={{ fontSize: `${Math.min(elemento.largura, elemento.altura) * 0.4}px` }}>👤</span>
            )}
          </div>
        );
      case 'chapa':
        return (
          <div
            key={elemento.id}
            style={{
              ...estilo,
              backgroundColor: elemento.cor || '#ff0000',
              borderRadius: `${elemento.borderRadius || 4}px`,
              opacity: elemento.transparencia || 1,
            }}
          />
        );
      default:
        return null;
    }
  };

  const temVerso = template.temVerso && template.elementosVerso && template.elementosVerso.length > 0;

  const gerarPDF = async () => {
    if (!printRef.current || gerandoPDF) return;

    setGerandoPDF(true);

    try {
      const frenteEl = printRef.current.querySelector('#print-frente') as HTMLElement;
      if (!frenteEl) throw new Error('Elemento da frente não encontrado');

      // Capture Front
      const canvasFrente = await html2canvas(frenteEl, {
        scale: 4, // High Resolution for printing
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      // Determinar tipo de impressão
      const tipoImpressao = template.tipoImpressao || 'pvc';
      
      // Suportar orientação portrait (funcionário) e landscape (demais)
      const orientacao = template.orientacao || 'landscape';
      const largCartaoMM = orientacao === 'portrait' ? 53.98 : 85.6;  // Portrait: 210mm ÷ escala / Landscape: 297mm ÷ escala
      const altCartaoMM = orientacao === 'portrait' ? 85.6 : 53.98;   // Portrait: 297mm ÷ escala / Landscape: 210mm ÷ escala

      let pdf: jsPDF;

      if (tipoImpressao === 'a4') {
        // A4 Portrait
        pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        const margemSuperior = 12;
        const margemEsquerda = 18.5; // Centralizado para 2 colunas
        const espacamentoH = 2;

        // Página 1: Frente (Posição Esquerda/Coluna 0)
        pdf.addImage(canvasFrente.toDataURL('image/png'), 'PNG', margemEsquerda, margemSuperior, largCartaoMM, altCartaoMM);

        if (temVerso) {
          const versoEl = printRef.current.querySelector('#print-verso') as HTMLElement;
          if (versoEl) {
            const canvasVerso = await html2canvas(versoEl, {
              scale: 4,
              useCORS: true,
              backgroundColor: '#ffffff',
              logging: false
            });

            // Página 2: Verso (ESPELHADO -> Posição Direita/Coluna 1)
            pdf.addPage();

            // Posição espelhada: Margem + Largura + Espaço
            const xVerso = margemEsquerda + largCartaoMM + espacamentoH;

            pdf.addImage(canvasVerso.toDataURL('image/png'), 'PNG', xVerso, margemSuperior, largCartaoMM, altCartaoMM);
          }
        }

      } else {
        // PVC Standard (CR80)
        pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: [largCartaoMM, altCartaoMM]
        });

        pdf.addImage(canvasFrente.toDataURL('image/png'), 'PNG', 0, 0, largCartaoMM, altCartaoMM);

        if (temVerso) {
          const versoEl = printRef.current.querySelector('#print-verso') as HTMLElement;
          if (versoEl) {
            const canvasVerso = await html2canvas(versoEl, {
              scale: 4,
              useCORS: true,
              backgroundColor: '#ffffff',
              logging: false
            });
            pdf.addPage();
            pdf.addImage(canvasVerso.toDataURL('image/png'), 'PNG', 0, 0, largCartaoMM, altCartaoMM);
          }
        }
      }

      // Filename
      const nomeLimpo = membro.nome.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      pdf.save(`cartao_${nomeLimpo}.pdf`);

    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Ocorreu um erro ao gerar o PDF. Consulte o console para mais detalhes.');
    } finally {
      setGerandoPDF(false);
    }
  };

  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-gray-100 p-4 gap-8">
      {/* Seletor de Frente/Verso */}
      <div className="flex gap-4 mt-4">
        <button
          onClick={() => setMostraVerso(false)}
          className={`px-6 py-2 rounded-lg font-semibold transition ${!mostraVerso
            ? 'bg-blue-600 text-white'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
        >
          📄 Frente
        </button>
        {/* Botão Verso sempre visível */}
        <button
          onClick={() => setMostraVerso(true)}
          className={`px-6 py-2 rounded-lg font-semibold transition ${mostraVerso
            ? 'bg-blue-600 text-white'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
        >
          📄 Verso
        </button>
      </div>

      {/* Frente do cartão */}
      {!mostraVerso && (
        <div>
          <h3 className="text-center text-sm font-semibold text-gray-700 mb-2">Frente</h3>
          <div
            id={`cartao-${membro.id}`}
            className="bg-white shadow-2xl"
            style={{
              ...getDimensoesCSSCartao(template?.orientacao),
              padding: '0',
              fontFamily: 'Arial, sans-serif',
              position: 'relative',
              pageBreakAfter: 'always',
              backgroundImage: template.backgroundUrl ? `url(${template.backgroundUrl})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              borderRadius: '16px',
              boxShadow: '0 8px 16px rgba(100, 116, 139, 0.15)',
              border: '1px solid rgba(0, 0, 0, 0.08)',
            }}
          >
            {/* Renderizar elementos da frente */}
            {template.elementos.map((elemento) => renderizarElemento(elemento, false))}
          </div>
        </div>
      )}

      {/* Verso do cartão (se houver) */}
      {mostraVerso && temVerso && (
        <div>
          <h3 className="text-center text-sm font-semibold text-gray-700 mb-2">Verso</h3>
          <div
            id={`cartao-verso-${membro.id}`}
            className="bg-white shadow-2xl"
            style={{
              ...getDimensoesCSSCartao(template?.orientacao),
              padding: '0',
              fontFamily: 'Arial, sans-serif',
              position: 'relative',
              pageBreakAfter: 'always',
              backgroundImage: template.backgroundUrlVerso ? `url(${template.backgroundUrlVerso})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              borderRadius: '16px',
              boxShadow: '0 8px 16px rgba(100, 116, 139, 0.15)',
              border: '1px solid rgba(0, 0, 0, 0.08)',
            }}
          >
            {/* Renderizar elementos do verso */}
            {template.elementosVerso?.map((elemento) => renderizarElemento(elemento, false))}
          </div>
        </div>
      )}

      {/* Informações adicionais */}
      <div className="text-xs text-gray-500 max-w-xs text-center mt-4">
        <p>Gestão Eklésia - Sistema de Gerenciamento Eclesiástico</p>
        <p>Este cartão é documento de identificação junto à instituição</p>
      </div>

      {/* Botões de ação */}
      <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 1000, display: 'flex', gap: '10px' }}>
        <button
          onClick={gerarPDF}
          disabled={gerandoPDF}
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {gerandoPDF ? '⏳ Gerando...' : '📥 Baixar PDF'}
        </button>



        {onClose && (
          <button
            onClick={onClose}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded shadow cursor-pointer"
          >
            ✖️ Fechar
          </button>
        )}
      </div>

      {/* ÁREA DE IMPRESSÃO OCULTA PARA PDF (Fora da tela visual) */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }} ref={printRef}>
        {/* FRENTE PARA PDF */}
        <div id="print-frente" style={{
          ...getDimensoesCSSCartao(template?.orientacao),
          position: 'relative',
          fontFamily: 'Arial, sans-serif',
          backgroundImage: template.backgroundUrl ? `url(${template.backgroundUrl})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: 'white',
          overflow: 'hidden' // Garante que nada saia do card
        }}>
          {template.elementos.map((elemento) => renderizarElemento(elemento, true))}
        </div>

        {/* VERSO PARA PDF */}
        {temVerso && (
          <div id="print-verso" style={{
            ...getDimensoesCSSCartao(template?.orientacao),
            position: 'relative',
            fontFamily: 'Arial, sans-serif',
            backgroundImage: template.backgroundUrlVerso ? `url(${template.backgroundUrlVerso})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundColor: 'white',
            overflow: 'hidden'
          }}>
            {template.elementosVerso?.map((elemento) => renderizarElemento(elemento, true))}
          </div>
        )}
      </div>
    </div>
  );
}
