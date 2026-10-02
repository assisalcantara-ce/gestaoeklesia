'use client';

import { useEffect, useState, useRef } from 'react';
import { CreditCard, Download, Loader2, X } from 'lucide-react';
import { BRAND } from '@/config/brand';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import html2canvas from 'html2canvas-pro';
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
        <div className="bg-white p-6 rounded-2xl shadow-xl flex items-center gap-3 text-slate-700">
          <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
          <p className="text-sm font-semibold">Carregando credencial...</p>
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
      case 'qrcode': {
        const uniqueId = membro.uniqueId || membro.id || '';
        const baseUrl =
          typeof window !== 'undefined' && window.location.origin
            ? window.location.origin
            : (process.env.NEXT_PUBLIC_APP_URL || 'https://www.gestaoeklesia.com.br');
        const qrUrl = `${baseUrl}/validar/credencial/${encodeURIComponent(uniqueId)}`;

        return (
          <div key={elemento.id} style={estilo}>
            <QRCode
              value={qrUrl}
              size={Math.min(elemento.largura, elemento.altura)}
              level="H"
              includeMargin={false}
            />
          </div>
        );
      }

      case 'imagem': {
        const isTransparentBg = !elemento.backgroundColor || elemento.backgroundColor === 'transparent';
        const bg = isTransparentBg ? (elemento.imagemUrl ? 'transparent' : '#f3f4f6') : elemento.backgroundColor;
        const styleContainer: React.CSSProperties = {
          ...estilo,
          overflow: 'hidden',
          borderRadius: `${elemento.borderRadius || 0}px`,
          opacity: elemento.transparencia ?? 1,
          backgroundColor: bg,
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
        const logoUrl = configIgreja?.logo || BRAND.logoHorizontal;
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

  // Compõe background em alta resolução (carregado diretamente como Image) com os elementos
  const compositeWithBackground = (
    foreground: HTMLCanvasElement,
    bgUrl: string | undefined
  ): Promise<HTMLCanvasElement> => {
    if (!bgUrl) return Promise.resolve(foreground);
    return new Promise((resolve) => {
      const out = document.createElement('canvas');
      out.width = foreground.width;
      out.height = foreground.height;
      const ctx = out.getContext('2d')!;
      const img = new Image();
      // crossOrigin só em URLs externas; data: URLs não suportam crossOrigin
      if (!bgUrl.startsWith('data:')) img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.drawImage(img, 0, 0, out.width, out.height);
        ctx.drawImage(foreground, 0, 0);
        resolve(out);
      };
      img.onerror = () => resolve(foreground);
      img.src = bgUrl;
    });
  };

  const gerarPDF = async () => {
    if (!printRef.current || gerandoPDF) return;

    setGerandoPDF(true);

    try {
      const frenteEl = printRef.current.querySelector('#print-frente') as HTMLElement;
      if (!frenteEl) throw new Error('Elemento da frente não encontrado');

      // Capturar elementos sem backgroundImage CSS (evita desfoque do html2canvas)
      const bgFrente = frenteEl.style.backgroundImage;
      const bgColorFrente = frenteEl.style.backgroundColor;
      frenteEl.style.backgroundImage = 'none';
      frenteEl.style.backgroundColor = 'transparent';
      const captFrente = await html2canvas(frenteEl, {
        scale: 4,
        useCORS: true,
        backgroundColor: null,
        logging: false
      });
      frenteEl.style.backgroundImage = bgFrente;
      frenteEl.style.backgroundColor = bgColorFrente;
      // Compor background em alta resolução por cima dos elementos
      const canvasFrente = await compositeWithBackground(captFrente, template.backgroundUrl);

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
            const bgVerso = versoEl.style.backgroundImage;
            const bgColorVerso = versoEl.style.backgroundColor;
            versoEl.style.backgroundImage = 'none';
            versoEl.style.backgroundColor = 'transparent';
            const captVerso = await html2canvas(versoEl, {
              scale: 4,
              useCORS: true,
              backgroundColor: null,
              logging: false
            });
            versoEl.style.backgroundImage = bgVerso;
            versoEl.style.backgroundColor = bgColorVerso;
            const canvasVerso = await compositeWithBackground(captVerso, template.backgroundUrlVerso);

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
            const bgVerso = versoEl.style.backgroundImage;
            const bgColorVerso = versoEl.style.backgroundColor;
            versoEl.style.backgroundImage = 'none';
            versoEl.style.backgroundColor = 'transparent';
            const captVerso = await html2canvas(versoEl, {
              scale: 4,
              useCORS: true,
              backgroundColor: null,
              logging: false
            });
            versoEl.style.backgroundImage = bgVerso;
            versoEl.style.backgroundColor = bgColorVerso;
            const canvasVerso = await compositeWithBackground(captVerso, template.backgroundUrlVerso);
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

  const tipoLabel = membro.tipoCadastro === 'ministro'
    ? 'Credencial de Ministro'
    : membro.tipoCadastro === 'funcionario'
    ? 'Crachá de Funcionário'
    : membro.tipoCadastro === 'crianca'
    ? 'Cartão Infantil'
    : 'Credencial de Membro';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* ── HEADER ────────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 bg-teal-700 border-b border-teal-800 flex items-center justify-between shrink-0 text-white shadow-xs">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0 shadow-2xs">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-white tracking-tight truncate">
                {tipoLabel}
              </h2>
              <p className="text-xs text-teal-100 font-medium truncate">
                Modelo Ativo: {template.nome || 'Credencial Padrão — Modelo 01'}
              </p>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
              aria-label="Fechar modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* ── ÁREA DE VISUALIZAÇÃO (Lado a Lado / Empilhado) ──────────────── */}
        <div className="flex-1 overflow-y-auto modal-scrollbar p-6 sm:p-8 bg-slate-50/60 flex flex-col items-center justify-center">
          <div className="flex flex-col lg:flex-row items-center justify-center gap-6 sm:gap-8 w-full">
            
            {/* Frente do cartão */}
            <div className="flex flex-col items-center">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
                Frente da Credencial
              </span>
              <div
                id={`cartao-${membro.id}`}
                className="bg-white relative shadow-md transition-shadow hover:shadow-lg"
                style={{
                  ...getDimensoesCSSCartao(template?.orientacao),
                  padding: '0',
                  fontFamily: 'Arial, sans-serif',
                  backgroundImage: template.backgroundUrl ? `url(${template.backgroundUrl})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  borderRadius: '14px',
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  overflow: 'hidden'
                }}
              >
                {template.elementos.map((elemento) => renderizarElemento(elemento, false))}
              </div>
            </div>

            {/* Verso do cartão */}
            {temVerso && (
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
                  Verso da Credencial
                </span>
                <div
                  id={`cartao-verso-${membro.id}`}
                  className="bg-white relative shadow-md transition-shadow hover:shadow-lg"
                  style={{
                    ...getDimensoesCSSCartao(template?.orientacao),
                    padding: '0',
                    fontFamily: 'Arial, sans-serif',
                    backgroundImage: template.backgroundUrlVerso ? `url(${template.backgroundUrlVerso})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    borderRadius: '14px',
                    border: '1px solid rgba(0, 0, 0, 0.08)',
                    overflow: 'hidden'
                  }}
                >
                  {template.elementosVerso?.map((elemento) => renderizarElemento(elemento, false))}
                </div>
              </div>
            )}

          </div>

          <p className="text-xs text-slate-400 mt-6 text-center">
            Gestão Eklésia • Documento oficial de identificação institucional
          </p>
        </div>

        {/* ── FOOTER ────────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl border border-slate-300 transition cursor-pointer"
          >
            Fechar
          </button>

          <button
            type="button"
            onClick={gerarPDF}
            disabled={gerandoPDF}
            className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs flex items-center gap-2 transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {gerandoPDF ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Gerando PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Baixar PDF</span>
              </>
            )}
          </button>
        </div>

        {/* ÁREA DE IMPRESSÃO OCULTA PARA PDF (Inalterada) */}
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
            overflow: 'hidden'
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
    </div>
  );
}
