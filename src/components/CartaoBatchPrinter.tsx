'use client';

import { useRef, useEffect, useState } from 'react';
import { BRAND } from '@/config/brand';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { QRCodeSVG as QRCode } from 'qrcode.react';
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
  tipoCadastro: 'membro' | 'congregado' | 'ministro' | 'crianca';
  cargo?: string;
  filiacao?: string;
  nomePai?: string;
  nomeMae?: string;
  dataBatismo?: string;
  naturalidade?: string;
  nacionalidade?: string;
  estadoCivil?: string;
  validade?: string;
  qualFuncao?: string;
  dataBatismoAguas?: string;
  dataBatismoEspiritoSanto?: string;
  status: 'ativo' | 'inativo';
  fotoUrl?: string;
  [key: string]: any;
}

interface CartaoBatchPrinterProps {
  membros: Membro[];
  onComplete?: () => void;
}

export default function CartaoBatchPrinter({ membros, onComplete }: CartaoBatchPrinterProps) {
  const supabase = createClient();

  const containerRef = useRef<HTMLDivElement>(null);
  const [orgNomenclaturas, setOrgNomenclaturas] = useState<any>(null);
  const [gerandoPDF, setGerandoPDF] = useState(false);

  useEffect(() => {
    loadOrgNomenclaturasFromSupabaseOrMigrate(supabase, { syncLocalStorage: false })
      .then(setOrgNomenclaturas)
      .catch(() => setOrgNomenclaturas(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Função para carregar template ativo
  const carregarTemplateAtivo = (templates: any[], tipo: string) => {
    if (!templates || templates.length === 0) return null;
    try {
      console.log('📋 Templates disponíveis:', templates.map((t: any) => ({ id: t.id, tipo: t.tipoCadastro || t.tipo, ativo: t.ativo })));
      
      const tipoBusca = (tipo === 'crianca' ? 'membro' : tipo).toLowerCase().trim();
      console.log('🔍 Buscando template para tipo:', tipoBusca);

      const template = templates.find((t: any) => {
        const tTipo = (t.tipoCadastro || t.tipo || '').toLowerCase().trim();
        return tTipo === tipoBusca && t.ativo === true;
      });

      if (template) {
        console.log('✅ Template ativo encontrado:', { id: template.id, tipo: template.tipoCadastro, ativo: template.ativo });
        return template;
      }

      const templateFallback = templates.find((t: any) => {
        const tTipo = (t.tipoCadastro || t.tipo || '').toLowerCase().trim();
        return tTipo === tipoBusca;
      });

      if (templateFallback) {
        console.log('⚠️ Template encontrado mas não está ativo:', { id: templateFallback.id, tipo: templateFallback.tipoCadastro, ativo: templateFallback.ativo });
      } else {
        console.warn('❌ Nenhum template encontrado para tipo:', tipoBusca);
      }

      return templateFallback;
    } catch (e) {
      console.error("❌ Erro ao carregar template", e);
      return null;
    }
  };

  const gerarPDFLote = async () => {
    if (gerandoPDF || !containerRef.current || membros.length === 0) return;

    try {
      setGerandoPDF(true);
      const { templates } = await loadTemplatesForCurrentUser(supabase, { allowLocalMigration: true });

    let configIgreja: any = {};
    try {
      configIgreja = await fetchConfiguracaoIgrejaFromSupabase(supabase);
    } catch (e) {
      console.error('Erro ao carregar config da igreja:', e);
    }

    // Enriquecer dados dos membros direto do banco para garantir integridade total (CPF, RG, Filiação, etc.)
    const memberIds = membros.map((m) => m.id).filter(Boolean);
    let mapaDbMembers: Record<string, any> = {};
    if (memberIds.length > 0) {
      try {
        const { data: dbRows } = await supabase
          .from('members')
          .select('*')
          .in('id', memberIds);
        if (dbRows) {
          dbRows.forEach((r: any) => {
            mapaDbMembers[r.id] = r;
          });
        }
      } catch (enrichErr) {
        console.warn('Não foi possível buscar dados adicionais dos membros:', enrichErr);
      }
    }

    const membrosPreparados: Membro[] = membros.map((membro) => {
      const dbRow = mapaDbMembers[membro.id] || {};
      const cf = (dbRow.custom_fields && typeof dbRow.custom_fields === 'object') ? dbRow.custom_fields : {};
      return {
        ...membro,
        ...cf,
        ...(membro as any),
        nome: membro.nome || dbRow.name || cf.nome || '',
        cpf: membro.cpf || dbRow.cpf || cf.cpf || '',
        rg: membro.rg || dbRow.rg || cf.rg || '',
        nomePai: membro.nomePai || dbRow.nome_pai || cf.nomePai || cf.nome_pai || '',
        nomeMae: membro.nomeMae || dbRow.nome_mae || cf.nomeMae || cf.nome_mae || '',
        dataNascimento: membro.dataNascimento || dbRow.data_nascimento || cf.dataNascimento || cf.data_nascimento || '',
        naturalidade: membro.naturalidade || dbRow.naturalidade || cf.naturalidade || '',
        nacionalidade: membro.nacionalidade || dbRow.nacionalidade || cf.nacionalidade || 'BRASILEIRA',
        estadoCivil: membro.estadoCivil || dbRow.estado_civil || cf.estadoCivil || cf.estado_civil || '',
        cargoMinisterial: membro.cargoMinisterial || dbRow.cargo_ministerial || cf.cargoMinisterial || cf.cargo_ministerial || '',
        tipoCadastro: (membro.tipoCadastro || dbRow.tipo_cadastro || dbRow.role || 'membro') as any,
      };
    });

    // Pega o tipo de impressão do primeiro template encontrado
    const tempTemplate = carregarTemplateAtivo(templates, membrosPreparados[0].tipoCadastro) || carregarTemplateAtivo(templates, 'membro');
    const tipoImpressao = tempTemplate?.tipoImpressao || 'pvc';
    const orientacao = tempTemplate?.orientacao || 'landscape';

    // Dimensões do cartão CR80 - suportar portrait e landscape
    const largCartaoMM = orientacao === 'portrait' ? 53.98 : 85.6;   // Portrait: 210mm ÷ escala / Landscape: 297mm ÷ escala
    const altCartaoMM = orientacao === 'portrait' ? 85.6 : 53.98;    // Portrait: 297mm ÷ escala / Landscape: 210mm ÷ escala

    let pdf: jsPDF;

    if (tipoImpressao === 'a4') {
      pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    } else {
      pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [largCartaoMM, altCartaoMM] });
    }

    // Compõe background em alta resolução com os elementos capturados pelo html2canvas
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

    const renderizarLado = async (membro: Membro, template: any, elementos: any[], bgUrl?: string, isVerso = false) => {
      const cartaoHTML = document.createElement('div');
      cartaoHTML.style.position = 'absolute';
      cartaoHTML.style.left = '-9999px';
      cartaoHTML.style.top = '0';
      cartaoHTML.style.width = orientacao === 'portrait' ? '291px' : '465px';
      cartaoHTML.style.height = orientacao === 'portrait' ? '465px' : '291px';

      const container = document.createElement('div');
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.position = 'relative';
      container.style.overflow = 'hidden';
      container.style.backgroundColor = 'transparent';
      // backgroundImage não aplicado via CSS — será composto em alta resolução após html2canvas
      cartaoHTML.appendChild(container);

      // Injetar validadeAnos do template no membro para o substituidor usar
      const membroComConfig = {
        ...membro,
        validadeAnos: template.validadeAnos || 1,
        nomeIgreja: configIgreja?.nome || 'Igreja',
        dataEmissao: template.dataEmissao || membro.dataEmissao
      };

      container.innerHTML = elementos.filter((el: any) => el.visivel).map((el: any) => {
        if (el.tipo === 'qrcode') {
          const style = `position: absolute; left: ${el.x}px; top: ${el.y}px; width: ${el.largura}px; height: ${el.altura}px; display: flex; align-items: center; justify-content: center;`;
          return `<div style="${style}"><div id="batch-qrcode-${membro.id}-${isVerso ? 'v' : 'f'}" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;"></div></div>`;
        }
        if (el.tipo === 'logo') {
          const style = `position: absolute; left: ${el.x}px; top: ${el.y}px; width: ${el.largura}px; height: ${el.altura}px; opacity: ${el.transparencia || 1};`;
          const logoUrl = configIgreja?.logo || BRAND.logoHorizontal;
          return `<div style="${style}"><img src="${logoUrl}" style="width: 100%; height: 100%; object-fit: contain;" /></div>`;
        }
        if (el.tipo === 'imagem') {
          const opacity = (el.transparencia ?? 1);
          const radius = (el.borderRadius ?? 0);
          const isTransparentBg = !el.backgroundColor || el.backgroundColor === 'transparent';
          const bg = isTransparentBg ? (el.imagemUrl ? 'transparent' : '#f3f4f6') : el.backgroundColor;
          const style = `position: absolute; left: ${el.x}px; top: ${el.y}px; width: ${el.largura}px; height: ${el.altura}px; opacity: ${opacity}; border-radius: ${radius}px; overflow: hidden; background: ${bg}; ${el.imagemUrl ? '' : 'border: 1px dashed #d1d5db;'} display: flex; align-items: center; justify-content: center;`;
          if (el.imagemUrl) {
            return `<div style="${style}"><img src="${el.imagemUrl}" style="width: 100%; height: 100%; object-fit: contain; display: block;" /></div>`;
          }
          return `<div style="${style}"><span style="font-size: ${Math.min(el.largura, el.altura) * 0.35}px; color: #9ca3af;">🖼️</span></div>`;
        }
        if (el.tipo === 'foto-membro') {
          const style = `position: absolute; left: ${el.x}px; top: ${el.y}px; width: ${el.largura}px; height: ${el.altura}px; overflow: hidden; background: ${membro.fotoUrl ? '#fff' : '#f3f4f6'}; display: flex; align-items: center; justify-content: center; ${membro.fotoUrl ? '' : 'border: 1px solid #d1d5db;'}`;
          if (membro.fotoUrl) {
            return `<div style="${style}"><img src="${membro.fotoUrl}" style="width: 100%; height: 100%; object-fit: cover;" /></div>`;
          } else {
            return `<div style="${style}"><span style="font-size: ${Math.min(el.largura, el.altura) * 0.4}px; color: #9ca3af;">👤</span></div>`;
          }
        }
        if (el.tipo === 'chapa') {
          const style = `position: absolute; left: ${el.x}px; top: ${el.y}px; width: ${el.largura}px; height: ${el.altura}px; background-color: ${el.cor || '#ff0000'}; border-radius: ${el.borderRadius || 0}px; opacity: ${el.transparencia || 1};`;
          return `<div style="${style}"></div>`;
        }
        if (el.tipo === 'texto') {
          console.log('🖨️ BatchPrinter - Membro processado:', {
            nome: membro.nome,
            congregacao: membro.congregacao,
            id: membro.id,
            membroComConfigKeys: Object.keys(membroComConfig)
          });
          const content = substituirPlaceholders(el.texto || '', membroComConfig, orgNomenclaturas);
          console.log('🖨️ BatchPrinter - Texto original:', el.texto);
          console.log('🖨️ BatchPrinter - Texto substituído:', content);
          const fontSize = el.fontSize || 10;
          const lift = fontSize > 16 ? '-15px' : '-8px';
          const style = `position: absolute; left: ${el.x}px; top: ${el.y}px; width: ${el.largura}px; height: ${el.altura}px; display: flex; flex-direction: column; justify-content: center; align-items: stretch; background-color: ${el.backgroundColor || 'transparent'}; border-radius: ${el.borderRadius || 0}px; overflow: visible;`;
          const textStyle = `width: 100%; position: relative; top: ${lift}; padding-left: ${el.backgroundColor ? '10px' : '0'}; padding-right: ${el.backgroundColor ? '5px' : '0'}; box-sizing: border-box; color: ${el.cor || '#000'}; font-size: ${fontSize}px; font-family: ${el.fonte || 'Arial'}; text-align: ${el.alinhamento || 'left'}; font-weight: ${el.negrito ? 'bold' : 'normal'}; font-style: ${el.italico ? 'italic' : 'normal'}; text-decoration: ${el.sublinhado ? 'underline' : 'none'}; white-space: pre-wrap; word-break: break-word; line-height: 1.2; display: block; ${el.sombreado ? 'text-shadow: 1px 1px 2px rgba(0,0,0,0.5);' : ''}`;
          return `<div style="${style}"><div style="${textStyle}">${content}</div></div>`;
        }
        return '';
      }).join('');

      document.body.appendChild(cartaoHTML);

      const qrContainer = cartaoHTML.querySelector(`#batch-qrcode-${membro.id}-${isVerso ? 'v' : 'f'}`);
      if (qrContainer) {
        const sourceQr = document.getElementById(`source-qr-${membro.id}`);
        if (sourceQr) {
          const svg = sourceQr.querySelector('svg');
          if (svg) {
            const clonedSvg = svg.cloneNode(true) as SVGElement;
            clonedSvg.setAttribute('width', '100%');
            clonedSvg.setAttribute('height', '100%');
            clonedSvg.style.display = 'block';
            qrContainer.appendChild(clonedSvg);
          }
        }
      }

      const captCanvas = await html2canvas(cartaoHTML, {
        scale: 4,
        backgroundColor: null,
        logging: false,
        useCORS: true
      });

      document.body.removeChild(cartaoHTML);
      // Compor background em alta resolução sobre os elementos capturados
      const finalCanvas = await compositeWithBackground(captCanvas, bgUrl);
      return finalCanvas.toDataURL('image/png', 1.0);
    };

    if (tipoImpressao === 'a4') {
      const cartoesPorPagina = 10;
      const margemSuperior = 12;
      const margemEsquerda = 18.5; // Centralizar aprox (210 - (85.6*2)) / 2
      const espacamentoH = 2; // Pequeno respiro entre colunas

      for (let i = 0; i < membrosPreparados.length; i += cartoesPorPagina) {
        const fatiaMembros = membrosPreparados.slice(i, i + cartoesPorPagina);
        if (i > 0) pdf.addPage();

        const imagensFrente: (string | null)[] = [];
        const imagensVerso: (string | null)[] = [];
        let temVersoGeral = false;

        // Gerar todas as imagens da página atual
        for (const membro of fatiaMembros) {
          const template = carregarTemplateAtivo(templates, membro.tipoCadastro) || carregarTemplateAtivo(templates, 'membro');
          if (template) {
            const imgF = await renderizarLado(membro, template, template.elementos, template.backgroundUrl, false);
            imagensFrente.push(imgF);
            if (template.temVerso) {
              const imgV = await renderizarLado(membro, template, template.elementosVerso || [], template.backgroundUrlVerso, true);
              imagensVerso.push(imgV);
              temVersoGeral = true;
            } else {
              imagensVerso.push(null);
            }
          } else {
            // Fallback imagens vázias se sem template
            imagensFrente.push(null);
            imagensVerso.push(null);
          }
        }

        // Posicionar Frentes na Página Impar (ou atual)
        fatiaMembros.forEach((_, idx) => {
          const col = idx % 2;
          const row = Math.floor(idx / 2);
          const x = margemEsquerda + (col * (largCartaoMM + espacamentoH));
          const y = margemSuperior + (row * altCartaoMM);
          if (imagensFrente[idx]) {
            pdf.addImage(imagensFrente[idx]!, 'PNG', x, y, largCartaoMM, altCartaoMM);
          }
        });

        // Se houver versos, criar página seguinte e ESPELHAR
        if (temVersoGeral) {
          pdf.addPage();
          fatiaMembros.forEach((_, idx) => {
            const col = idx % 2;
            const row = Math.floor(idx / 2);
            // ESPELHAMENTO: O que era coluna 0 (esquerda) na frente, vira coluna 1 (direita) no verso
            // para que ao virar a folha, coincida.
            const colVerso = col === 0 ? 1 : 0;
            const x = margemEsquerda + (colVerso * (largCartaoMM + espacamentoH));
            const y = margemSuperior + (row * altCartaoMM);
            if (imagensVerso[idx]) {
              pdf.addImage(imagensVerso[idx]!, 'PNG', x, y, largCartaoMM, altCartaoMM);
            }
          });
        }
      }
    } else {
      // Modo PVC Original
      let membroIdx = 0;
      for (const membro of membrosPreparados) {
        const template = carregarTemplateAtivo(templates, membro.tipoCadastro) || carregarTemplateAtivo(templates, 'membro');
        if (template) {
          if (membroIdx > 0) pdf.addPage([largCartaoMM, altCartaoMM], 'landscape');
          const imgF = await renderizarLado(membro, template, template.elementos, template.backgroundUrl, false);
          pdf.addImage(imgF, 'PNG', 0, 0, largCartaoMM, altCartaoMM);

          if (template.temVerso) {
            pdf.addPage([largCartaoMM, altCartaoMM], 'landscape');
            const imgV = await renderizarLado(membro, template, template.elementosVerso || [], template.backgroundUrlVerso, true);
            pdf.addImage(imgV, 'PNG', 0, 0, largCartaoMM, altCartaoMM);
          }
        }
        membroIdx++;
      }
    }

    const dataAtual = new Date();
    const nomeArquivo = `cartoes_${tipoImpressao}_${dataAtual.getTime()}.pdf`;
    pdf.save(nomeArquivo);

    if (onComplete) onComplete();
    } catch (err) {
      console.error('Erro ao gerar PDF em lote:', err);
    } finally {
      setGerandoPDF(false);
    }
  };

  return (
    <div ref={containerRef}>
      <button
        onClick={gerarPDFLote}
        disabled={gerandoPDF}
        className={`px-4 py-2 bg-blue-600 text-white rounded-lg transition font-semibold flex items-center justify-center gap-2 ${
          gerandoPDF ? 'opacity-70 cursor-not-allowed bg-blue-500' : 'hover:bg-blue-700'
        }`}
      >
        {gerandoPDF ? (
          <>
            <svg
              className="animate-spin h-4 w-4 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Gerando PDF...</span>
          </>
        ) : (
          <span>🖨️ Gerar PDF em Lote ({membros.length})</span>
        )}
      </button>

      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        {membros.map((membro) => {
          const uniqueId = membro.uniqueId || membro.id || '';
          const baseUrl =
            typeof window !== 'undefined' && window.location.origin
              ? window.location.origin
              : (process.env.NEXT_PUBLIC_APP_URL || 'https://www.gestaoeklesia.com.br');
          const qrUrl = `${baseUrl}/validar/credencial/${encodeURIComponent(uniqueId)}`;

          return (
            <div key={`qr-${membro.id}`} id={`source-qr-${membro.id}`}>
              <QRCode value={qrUrl} size={128} level="H" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
