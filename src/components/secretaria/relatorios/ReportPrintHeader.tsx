'use client';

import Image from 'next/image';
import { BRAND } from '@/config/brand';

interface ReportPrintHeaderProps {
  title: string;
  subtitle?: string;
  periodoOuData?: string;
  congregacaoNome?: string | null;
}

export default function ReportPrintHeader({
  title,
  subtitle = 'Gestão Integrada para Igrejas e Ministérios',
  periodoOuData,
  congregacaoNome,
}: ReportPrintHeaderProps) {
  const dataEmissao = new Date().toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  return (
    <div className="hidden print:block mb-6 border-b border-gray-300 pb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-36 h-10">
            <Image
              src={BRAND.logoHorizontal}
              alt={BRAND.name}
              fill
              className="object-contain object-left"
              priority
            />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 tracking-tight leading-tight uppercase">
              {BRAND.name}
            </h1>
            <p className="text-xs text-gray-500 font-medium">
              {subtitle} • {BRAND.company}
            </p>
          </div>
        </div>

        <div className="text-right text-xs text-gray-500 space-y-0.5">
          <p>
            <span className="font-semibold text-gray-700">Emissão:</span> {dataEmissao}
          </p>
          {periodoOuData && (
            <p>
              <span className="font-semibold text-gray-700">Referência:</span> {periodoOuData}
            </p>
          )}
          {congregacaoNome && (
            <p>
              <span className="font-semibold text-gray-700">Unidade:</span> {congregacaoNome}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
          {title}
        </h2>
        <span className="text-[11px] font-medium bg-gray-100 px-2 py-0.5 rounded text-gray-600">
          Documento Oficial da Secretaria
        </span>
      </div>
    </div>
  );
}
