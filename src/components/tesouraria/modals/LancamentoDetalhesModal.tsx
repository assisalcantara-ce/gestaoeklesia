'use client';

import {
  X,
  FileText,
  Calendar,
  Wallet,
  Tag,
  Bookmark,
  Building2,
  Users,
  ShieldCheck,
  QrCode,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Info,
} from 'lucide-react';
import type { FinConta, FinCategoria } from '@/hooks/tesouraria/useTesouraria';

export interface LancamentoDetalhesModalProps {
  isOpen: boolean;
  lancamento: any | null;
  chargeDetails?: any | null;
  finContas?: FinConta[];
  finCategorias?: FinCategoria[];
  onClose: () => void;
  fmtDate: (dateStr: string) => string;
  fmtBRL: (val: number) => string;
  tipoLabel: (tipo: string) => string;
  tipoCor?: (tipo: string) => string;
  TIPOS_SAIDA?: Array<{ value: string; label: string; cor?: string }>;
}

export default function LancamentoDetalhesModal({
  isOpen,
  lancamento,
  chargeDetails,
  finContas = [],
  finCategorias = [],
  onClose,
  fmtDate,
  fmtBRL,
  tipoLabel,
  TIPOS_SAIDA = [],
}: LancamentoDetalhesModalProps) {
  if (!isOpen || !lancamento) return null;

  const isSaida = lancamento.tipo_movimento === 'saida';
  const isDigitalPix = lancamento.origem_modulo === 'gateway' || lancamento.forma_pagamento === 'pix';

  // Resolução de nomes de entidades relacionadas
  const contaEncontrada = finContas.find((c) => c.id === lancamento.conta_id);
  const contaNome = contaEncontrada?.nome || (lancamento.conta_id ? 'Conta Vinculada' : 'Padrão do Ministério');

  const categoriaEncontrada = finCategorias.find((c) => c.id === lancamento.categoria_id);
  const categoriaNome = categoriaEncontrada
    ? `${categoriaEncontrada.icone ? `${categoriaEncontrada.icone} ` : ''}${categoriaEncontrada.nome}`
    : 'Sem categoria';

  const tipoNome = isSaida
    ? TIPOS_SAIDA.find((t) => t.value === lancamento.tipo_recebimento)?.label || lancamento.tipo_recebimento
    : tipoLabel(lancamento.tipo_recebimento);

  const formaNome =
    lancamento.forma_pagamento ||
    (isDigitalPix ? 'PIX (Gateway ASAAS)' : 'EM ESPÉCIE');

  const observacaoTexto =
    lancamento.observacoes || lancamento.descricao || null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[60] p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detalhes-lancamento-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col border border-slate-200 animate-in zoom-in-95 duration-150 overflow-hidden">
        {/* Cabeçalho */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isSaida ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {isSaida ? <TrendingDown className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <h3 id="detalhes-lancamento-title" className="text-base font-extrabold text-slate-800 truncate">
                Detalhes do Lançamento
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Visualização somente leitura do registro financeiro
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corpo com Scroll */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* Card Principal: Valor, Tipo e Código */}
          <div
            className={`rounded-2xl p-4 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              isSaida
                ? 'bg-red-50/50 border-red-200/70 text-red-950'
                : 'bg-emerald-50/50 border-emerald-200/70 text-emerald-950'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full text-[11px] uppercase tracking-wide ${
                    isSaida
                      ? 'bg-red-200/60 text-red-800'
                      : 'bg-emerald-200/60 text-emerald-800'
                  }`}
                >
                  {isSaida ? '↓ Saída Financeira' : '↑ Entrada Financeira'}
                </span>
                {isDigitalPix && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-[#123b63]/10 text-[#123b63] border border-[#123b63]/20 px-2 py-0.5 rounded-full">
                    <QrCode className="h-3 w-3" /> PIX Digital
                  </span>
                )}
              </div>
              <div
                className={`text-2xl font-black tracking-tight ${
                  isSaida ? 'text-red-600' : 'text-emerald-700'
                }`}
              >
                {isSaida ? '- ' : '+ '}
                {fmtBRL(Number(lancamento.valor))}
              </div>
            </div>

            {lancamento.codigo_registro && (
              <div className="bg-white/90 border border-slate-200 rounded-xl px-3 py-2 text-right self-start sm:self-center shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Código / ID Registro
                </span>
                <span className="font-mono text-xs font-black text-slate-800 tracking-wider">
                  {lancamento.codigo_registro}
                </span>
              </div>
            )}
          </div>

          {/* Grid de Informações Financeiras */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Data do Lançamento */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="h-3 w-3 text-slate-400" /> Data do Lançamento
              </span>
              <p className="font-bold text-slate-800 text-sm">
                {fmtDate(lancamento.data_lancamento)}
              </p>
            </div>

            {/* Tipo / Classificação */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Tag className="h-3 w-3 text-slate-400" /> {isSaida ? 'Tipo de Saída' : 'Tipo de Entrada'}
              </span>
              <p className="font-bold text-slate-800 text-sm">{tipoNome}</p>
            </div>

            {/* Conta / Caixa */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Wallet className="h-3 w-3 text-slate-400" /> Conta / Caixa
              </span>
              <p className="font-bold text-slate-800 text-sm">{contaNome}</p>
              {contaEncontrada?.banco && (
                <p className="text-[11px] text-slate-500 font-medium">
                  {contaEncontrada.banco}
                  {contaEncontrada.agencia ? ` • Ag: ${contaEncontrada.agencia}` : ''}
                  {contaEncontrada.conta ? ` • CC: ${contaEncontrada.conta}` : ''}
                </p>
              )}
            </div>

            {/* Forma de Entrada / Saída */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <FileText className="h-3 w-3 text-slate-400" />{' '}
                {isSaida ? 'Forma de Saída' : 'Forma de Entrada'}
              </span>
              <p className="font-bold text-slate-800 text-sm">{formaNome}</p>
            </div>

            {/* Categoria Financeira */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Bookmark className="h-3 w-3 text-slate-400" /> Categoria Financeira
              </span>
              <p className="font-bold text-slate-800 text-sm">{categoriaNome}</p>
            </div>

            {/* Referência (evento/campanha) */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Info className="h-3 w-3 text-slate-400" /> Referência (Evento/Campanha)
              </span>
              <p className="font-bold text-slate-800 text-sm">
                {lancamento.referencia || '—'}
              </p>
            </div>
          </div>

          {/* Unidade Organizacional */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Building2 className="h-3 w-3 text-slate-400" /> Congregação / Unidade
              </span>
              <p className="font-bold text-slate-800 text-sm">
                {lancamento.congregacao_nome || 'Sede / Geral'}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Users className="h-3 w-3 text-slate-400" /> Departamento
              </span>
              <p className="font-bold text-slate-800 text-sm">
                {lancamento.departamento_nome || 'Caixa da Igreja'}
              </p>
            </div>
          </div>

          {/* Observações */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Observações / Descrição
            </span>
            <p className="text-slate-700 text-xs whitespace-pre-wrap leading-relaxed">
              {observacaoTexto || 'Nenhuma observação informada.'}
            </p>
          </div>

          {/* Se for Arrecadação Digital PIX (Enriquecimento ASAAS) */}
          {isDigitalPix && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Auditoria & Gateway ASAAS
              </span>

              <div className="space-y-1 font-mono text-[11px] text-slate-600">
                <p>
                  <span className="text-slate-400 font-sans">ID Lançamento:</span>{' '}
                  {lancamento.id}
                </p>
                {lancamento.origem_id && (
                  <p>
                    <span className="text-slate-400 font-sans">ID Cobrança Digital:</span>{' '}
                    {lancamento.origem_id}
                  </p>
                )}
                {chargeDetails?.gateway_charge_id && (
                  <p>
                    <span className="text-slate-400 font-sans">ID Pagamento ASAAS:</span>{' '}
                    <strong className="text-slate-800">{chargeDetails.gateway_charge_id}</strong>
                  </p>
                )}
                {chargeDetails?.status && (
                  <p className="font-sans pt-1">
                    <span className="text-slate-400">Status Gateway:</span>{' '}
                    <span className="inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="h-3 w-3" /> {chargeDetails.status.toUpperCase()}
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé Somente Leitura com Botão Fechar */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition shadow-xs"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
