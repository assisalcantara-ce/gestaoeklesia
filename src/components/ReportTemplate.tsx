'use client';

import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface ReportTemplateProps {
  title: string;
  competencia: string;
  dadosIgreja?: {
    name: string;
    logo_url?: string | null;
    phone?: string | null;
    email_admin?: string | null;
  };
  usuarioResponsavel?: string;
  children: React.ReactNode;
}

export interface ReportTemplateRef {
  exportToPDF: (filename?: string) => Promise<void>;
}

const ReportTemplate = forwardRef<ReportTemplateRef, ReportTemplateProps>(
  ({ title, competencia, dadosIgreja, usuarioResponsavel, children }, ref) => {
    const reportRef = useRef<HTMLDivElement>(null);

    const exportToPDF = async (filename?: string) => {
      if (!reportRef.current) return;

      // Sanitizar temporariamente regras CSS contendo a função de cor 'lab('
      // que o parser do html2canvas não suporta.
      const problemRules: { sheet: CSSStyleSheet; index: number; ruleText: string }[] = [];
      try {
        for (let i = 0; i < document.styleSheets.length; i++) {
          try {
            const sheet = document.styleSheets[i];
            const rules = sheet.cssRules || sheet.rules;
            if (!rules) continue;
            for (let j = rules.length - 1; j >= 0; j--) {
              const rule = rules[j];
              // Também busca oklab para garantir cobertura total contra cores modernas
              if (rule.cssText.includes('lab(') || rule.cssText.includes('oklab(')) {
                problemRules.push({ sheet, index: j, ruleText: rule.cssText });
                sheet.deleteRule(j);
              }
            }
          } catch {
            // Ignora folhas de estilo externas protegidas por CORS
          }
        }
      } catch (err) {
        console.warn('Erro ao varrer folhas de estilo para sanitização:', err);
      }

      try {
        // Pequeno timeout para garantir que os gráficos e imagens estejam prontos
        await new Promise((resolve) => setTimeout(resolve, 300));

        const canvas = await html2canvas(reportRef.current, {
          scale: 2, // Melhor qualidade
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
          windowWidth: 1024 // Largura fixa para manter proporção perfeita no PDF
        });

        const imgWidth = 210; // Largura A4 em mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const imgData = canvas.toDataURL('image/png');

        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
          compress: true
        });

        const pageHeight = 297; // Altura A4 em mm
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 2) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }

        const fallbackName = `${title.toLowerCase().replace(/\s+/g, '_')}_${competencia.replace('/', '_')}.pdf`;
        pdf.save(filename || fallbackName);
      } catch (error) {
        console.error('Erro ao gerar PDF do relatório:', error);
      } finally {
        // Restaura as regras CSS removidas para não afetar o visual da aplicação na tela
        for (const item of problemRules.reverse()) {
          try {
            item.sheet.insertRule(item.ruleText, item.index);
          } catch (e) {
            // Falha silenciosa na restauração de regras individuais
          }
        }
      }
    };

    useImperativeHandle(ref, () => ({
      exportToPDF
    }));

    return (
      <div className="bg-slate-100 p-4 rounded-3xl border border-slate-200 shadow-sm print:bg-white print:border-none print:shadow-none print:p-0">
        <div
          ref={reportRef}
          className="bg-white mx-auto w-full max-w-[850px] p-10 md:p-14 text-slate-800 flex flex-col justify-between"
          style={{ minHeight: '1123px', boxSizing: 'border-box' }}
        >
          {/* Topo / Header */}
          <div className="pb-6 border-b-2 border-[#062E6F] flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {dadosIgreja?.logo_url ? (
                <img src={dadosIgreja.logo_url} alt="Logo" className="h-16 w-auto object-contain" />
              ) : (
                <div className="h-14 w-14 bg-[#062E6F] text-white rounded-xl flex items-center justify-center font-black text-xl">
                  EK
                </div>
              )}
              <div>
                <h2 className="text-xl font-black text-[#062E6F] uppercase tracking-wide">
                  {dadosIgreja?.name || 'Gestão Eklésia'}
                </h2>
                <p className="text-xs font-bold text-slate-400">RELATÓRIO OFICIAL INSTITUCIONAL</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Competência</span>
              <strong className="text-base font-extrabold text-[#062E6F]">{competencia}</strong>
            </div>
          </div>

          {/* Área de Conteúdo */}
          <div className="flex-1 py-8 space-y-6">
            <div>
              <h3 className="text-lg font-black text-[#062E6F] uppercase tracking-wider mb-2">{title}</h3>
              <div className="h-1 w-12 bg-indigo-600 rounded-full mb-4"></div>
            </div>

            {children}
          </div>

          {/* Rodapé / Footer */}
          <div className="pt-4 border-t border-slate-250 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-12">
            <span>
              Emitido em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
            {usuarioResponsavel && (
              <span>Responsável: {usuarioResponsavel}</span>
            )}
            <span>Gestão Eklésia v1.0</span>
          </div>
        </div>
      </div>
    );
  }
);

ReportTemplate.displayName = 'ReportTemplate';

export default ReportTemplate;
