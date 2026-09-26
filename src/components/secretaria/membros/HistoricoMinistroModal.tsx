'use client';

import { useEffect, useState, useMemo } from 'react';
import { consacracaoService } from '@/services/consagracao-service';
import { HistoricoProcessoItem } from '@/types/consagracao';
import { createClient } from '@/lib/supabase-client';

export interface HistoricoMinistroModalProps {
  membro: any | null;
  onClose: () => void;
  configIgreja?: {
    nome?: string;
    logo?: string;
    logoUrl?: string;
    responsavel?: string;
  };
}

export default function HistoricoMinistroModal({
  membro,
  onClose,
  configIgreja,
}: HistoricoMinistroModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historicoData, setHistoricoData] = useState<{
    ministro: {
      id: string;
      nome: string;
      matricula: string;
      cpf: string;
      cargo_atual: string;
      data_consagracao_atual: string | null;
      foto_url: string | null;
      congregacao_nome?: string | null;
    };
    eventos: HistoricoProcessoItem[];
  } | null>(null);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let isMounted = true;

    async function carregarHistorico() {
      if (!membro || !membro.id) return;
      try {
        setLoading(true);
        setError(null);

        // Obter ministry_id do usuário autenticado para segurança e isolamento multi-tenant
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('Sessão expirada. Faça login novamente.');
        }

        const { data: ministryUser } = await supabase
          .from('ministry_users')
          .select('ministry_id')
          .eq('user_id', user.id)
          .maybeSingle();

        const ministryId = ministryUser?.ministry_id;
        if (!ministryId) {
          throw new Error('Ministério não identificado para o usuário autenticado.');
        }

        const data = await consacracaoService.obterHistoricoCompletoMinistro(membro.id, ministryId);
        if (isMounted) {
          setHistoricoData(data);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Erro ao carregar histórico do ministro:', err);
          setError(err.message || 'Não foi possível carregar o histórico ministerial.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    carregarHistorico();

    return () => {
      isMounted = false;
    };
  }, [membro, supabase]);

  if (!membro) return null;

  const ministroInfo = historicoData?.ministro || {
    id: membro.id,
    nome: membro.nome || membro.name || 'Ministro',
    matricula: membro.matricula || '-',
    cpf: membro.cpf || '-',
    cargo_atual: membro.cargoMinisterial || membro.cargo_ministerial || 'Não informado',
    data_consagracao_atual: membro.dataConsagracao || membro.data_consagracao || null,
    foto_url: membro.fotoUrl || membro.foto_url || null,
    congregacao_nome: membro.congregacao || null,
  };

  const eventos = historicoData?.eventos || [];

  const formatarDataBr = (dataStr?: string | null) => {
    if (!dataStr) return '-';
    const clean = dataStr.slice(0, 10);
    const parts = clean.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return clean;
  };

  const formatarCpf = (cpf?: string | null) => {
    if (!cpf) return '-';
    const digits = cpf.replace(/\D/g, '');
    if (digits.length === 11) {
      return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return cpf;
  };

  const getBadgeInfo = (tipoEvento: string, decisao?: string | null) => {
    switch (tipoEvento) {
      case 'homologacao':
        return {
          label: 'Homologação',
          bg: 'bg-purple-100 text-purple-800 border-purple-300',
          dot: 'bg-purple-600',
          icon: '📜',
        };
      case 'decisao_comissao':
        if (decisao === 'indeferir') {
          return {
            label: 'Parecer Indeferido',
            bg: 'bg-red-100 text-red-800 border-red-300',
            dot: 'bg-red-600',
            icon: '❌',
          };
        }
        return {
          label: 'Parecer Deferido',
          bg: 'bg-green-100 text-green-800 border-green-300',
          dot: 'bg-green-600',
          icon: '✅',
        };
      case 'reabertura':
        return {
          label: 'Reabertura',
          bg: 'bg-amber-100 text-amber-800 border-amber-300',
          dot: 'bg-amber-600',
          icon: '🔄',
        };
      case 'cancelamento':
      case 'exclusao_processo':
        return {
          label: 'Cancelamento / Exclusão',
          bg: 'bg-slate-100 text-slate-700 border-slate-300',
          dot: 'bg-slate-500',
          icon: '🗑️',
        };
      case 'marco_ministerial':
      case 'mudanca_cargo':
        return {
          label: 'Ordenação / Recebimento',
          bg: 'bg-blue-100 text-blue-800 border-blue-300',
          dot: 'bg-blue-600',
          icon: '🎖️',
        };
      case 'inicio_processo':
      default:
        return {
          label: 'Início de Processo',
          bg: 'bg-teal-100 text-teal-800 border-teal-300',
          dot: 'bg-teal-600',
          icon: '📝',
        };
    }
  };

  const handleImprimir = () => {
    const win = window.open('', '_blank');
    if (!win) {
      alert('Por favor, permita popups para imprimir o histórico.');
      return;
    }

    const churchNome = configIgreja?.nome || 'Gestão Eklésia';
    const churchLogo = configIgreja?.logoUrl || configIgreja?.logo || '';
    const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const timelineHtml = eventos.length === 0
      ? `<div style="text-align: center; padding: 30px; color: #64748b; font-size: 13px;">Nenhum histórico ministerial registrado para este ministro.</div>`
      : eventos.map((ev, index) => {
          const badge = getBadgeInfo(ev.tipo_evento, ev.decisao);
          const dataFormatada = formatarDataBr(ev.data);
          const isProgressao = ev.cargo_anterior && (ev.cargo_resultante || ev.cargo_pretendido);
          const cargoDestacado = isProgressao
            ? `${ev.cargo_anterior} → ${ev.cargo_resultante || ev.cargo_pretendido}`
            : (ev.cargo_resultante || ev.cargo || ev.cargo_pretendido || '');

          return `
            <div style="display: flex; gap: 14px; margin-bottom: 18px; position: relative;">
              <div style="display: flex; flex-direction: column; align-items: center; width: 24px;">
                <div style="width: 14px; height: 14px; border-radius: 50%; background: #0f766e; border: 2px solid #ccfbf1; z-index: 2;"></div>
                ${index !== eventos.length - 1 ? `<div style="width: 2px; flex: 1; background: #e2e8f0; margin-top: 4px;"></div>` : ''}
              </div>
              <div style="flex: 1; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 16px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
                  <div>
                    <span style="display: inline-block; font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 2px 8px; border-radius: 4px; background: #ccfbf1; color: #0f766e; border: 1px solid #99f6e4;">
                      ${badge.label}
                    </span>
                    ${ev.numero_processo ? `<span style="font-family: monospace; font-size: 11px; font-weight: 700; color: #334155; margin-left: 8px;">Processo nº ${ev.numero_processo}</span>` : ''}
                  </div>
                  <div style="font-size: 11px; font-weight: 700; color: #64748b;">${dataFormatada}</div>
                </div>

                ${cargoDestacado ? `
                  <div style="margin-bottom: 6px; font-size: 12px;">
                    <strong style="color: #0f766e;">Progressão / Cargo:</strong> <span style="font-weight: 800; color: #0f172a;">${cargoDestacado}</span>
                  </div>
                ` : ''}

                <div style="font-size: 11px; color: #334155; margin-bottom: 6px;">
                  ${ev.descricao || '-'}
                </div>

                ${ev.comissao_nome || ev.pastor_solicitante || ev.local ? `
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 10.5px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 10px; margin-top: 6px;">
                    ${ev.comissao_nome ? `<div><strong>Comissão:</strong> ${ev.comissao_nome}</div>` : ''}
                    ${ev.pastor_solicitante ? `<div><strong>Indicação / Solicitante:</strong> ${ev.pastor_solicitante}</div>` : ''}
                    ${ev.local ? `<div><strong>Local / Congregação:</strong> ${ev.local}</div>` : ''}
                    ${ev.local_origem ? `<div><strong>Origem:</strong> ${ev.local_origem}</div>` : ''}
                  </div>
                ` : ''}

                ${ev.parecer ? `
                  <div style="margin-top: 8px; background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 6px; padding: 8px 10px;">
                    <div style="font-size: 9.5px; font-weight: 800; color: #0f766e; text-transform: uppercase; margin-bottom: 2px;">PARECER DA COMISSÃO:</div>
                    <div style="font-size: 11px; color: #134e4a; font-style: italic; white-space: pre-wrap;">${ev.parecer}</div>
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }).join('');

    win.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Histórico Ministerial - ${ministroInfo.nome}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            background: #fff;
            padding: 24px 32px;
            font-size: 12px;
            line-height: 1.4;
          }
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #0f766e;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .header-left {
            display: flex;
            align-items: center;
            gap: 14px;
          }
          .header-logo {
            width: 56px;
            height: 56px;
            object-fit: contain;
            border-radius: 8px;
          }
          .header-title h1 {
            font-size: 17px;
            font-weight: 800;
            color: #0f172a;
          }
          .header-title h2 {
            font-size: 13px;
            font-weight: 700;
            color: #0f766e;
            text-transform: uppercase;
          }
          .header-right {
            text-align: right;
            font-size: 11px;
            color: #64748b;
          }
          .profile-card {
            display: flex;
            gap: 16px;
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 12px 16px;
            margin-bottom: 20px;
            align-items: center;
          }
          .photo-box {
            width: 70px;
            height: 85px;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f1f5f9;
            flex-shrink: 0;
          }
          .photo-box img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .section-title {
            font-size: 12px;
            font-weight: 800;
            color: #0f766e;
            text-transform: uppercase;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 4px;
            margin-bottom: 14px;
            letter-spacing: 0.5px;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 10px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
            padding-top: 8px;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none !important; }
            @page { size: A4 portrait; margin: 1.5cm; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 16px; display: flex; justify-content: flex-end; gap: 8px;">
          <button onclick="window.print()" style="padding: 8px 18px; font-size: 12px; font-weight: bold; background: #0f766e; color: white; border: none; border-radius: 6px; cursor: pointer;">
            🖨️ Imprimir Histórico
          </button>
          <button onclick="window.close()" style="padding: 8px 14px; font-size: 12px; font-weight: 600; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer;">
            Fechar
          </button>
        </div>

        <div class="header">
          <div class="header-left">
            ${churchLogo ? `<img src="${churchLogo}" class="header-logo" alt="Logo" />` : ''}
            <div class="header-title">
              <h1>${churchNome}</h1>
              <h2>HISTÓRICO MINISTERIAL</h2>
            </div>
          </div>
          <div class="header-right">
            <div><strong>Emissão:</strong> ${hoje} às ${hora}</div>
            <div>Documento Oficial do Sistema de Gestão Eklésia</div>
          </div>
        </div>

        <div class="profile-card">
          <div class="photo-box">
            ${ministroInfo.foto_url ? `<img src="${ministroInfo.foto_url}" alt="Foto" />` : `<span style="color:#94a3b8; font-weight:bold; font-size:10px;">FOTO</span>`}
          </div>
          <div style="flex: 1; display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
            <div style="grid-column: span 2;">
              <span style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Nome Completo</span>
              <div style="font-size: 14px; font-weight: 800; color: #0f172a;">${ministroInfo.nome}</div>
            </div>
            <div>
              <span style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Matrícula</span>
              <div style="font-size: 12px; font-weight: 600; font-family: monospace;">${ministroInfo.matricula}</div>
            </div>
            <div>
              <span style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">CPF</span>
              <div style="font-size: 12px; font-weight: 600; font-family: monospace;">${formatarCpf(ministroInfo.cpf)}</div>
            </div>
            <div>
              <span style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Cargo Ministerial Atual</span>
              <div style="font-size: 12px; font-weight: 800; color: #0f766e;">${ministroInfo.cargo_atual}</div>
            </div>
            <div>
              <span style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Data Consagração Atual</span>
              <div style="font-size: 12px; font-weight: 600;">${formatarDataBr(ministroInfo.data_consagracao_atual)}</div>
            </div>
          </div>
        </div>

        <div class="section-title">Linha do Tempo e Marcos Ministeriais</div>

        <div>
          ${timelineHtml}
        </div>

        <div class="footer">
          Documento oficial do Sistema de Gestão Eklésia | Emitido em ${hoje} às ${hora}
        </div>
      </body>
      </html>
    `);

    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 400);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full my-6 flex flex-col max-h-[90vh] border border-slate-200 animate-in zoom-in-95 duration-150">
        
        {/* Cabeçalho do Modal */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-teal-700 via-teal-800 to-slate-900 rounded-t-2xl flex-shrink-0 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl shadow-inner border border-white/20">
              📜
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">Histórico do Ministro</h2>
              <p className="text-xs text-teal-100">Linha do tempo ministerial e processos de consagração</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleImprimir}
              disabled={loading || Boolean(error)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-500 hover:bg-teal-400 disabled:bg-teal-800 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
              title="Imprimir Histórico em PDF"
            >
              <span>🖨️</span>
              <span>Imprimir Histórico</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition text-lg cursor-pointer"
              title="Fechar"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Informações do Ministro (Cabeçalho Fixo) */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-14 h-16 rounded-xl bg-white border border-slate-300 overflow-hidden flex items-center justify-center shadow-xs flex-shrink-0">
              {ministroInfo.foto_url ? (
                <img src={ministroInfo.foto_url} alt={ministroInfo.nome} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl text-slate-400">👤</span>
              )}
            </div>

            <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Nome do Ministro</span>
                <p className="text-sm font-bold text-slate-900 truncate">{ministroInfo.nome}</p>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                  <span>Matrícula: <strong className="text-slate-700 font-mono">{ministroInfo.matricula}</strong></span>
                  <span>CPF: <strong className="text-slate-700 font-mono">{formatarCpf(ministroInfo.cpf)}</strong></span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Cargo Atual</span>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200 mt-0.5">
                  {ministroInfo.cargo_atual}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Data Consagração</span>
                <p className="text-xs font-semibold text-slate-700 mt-0.5">{formatarDataBr(ministroInfo.data_consagracao_atual)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Conteúdo com Scroll da Timeline */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 space-y-3">
              <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-medium">Carregando histórico ministerial...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <p className="font-bold">Erro ao carregar histórico</p>
              <p className="text-xs mt-1">{error}</p>
            </div>
          ) : eventos.length === 0 ? (
            <div className="text-center py-16 px-4 bg-slate-50 border border-dashed border-slate-300 rounded-2xl">
              <span className="text-4xl block mb-2">📜</span>
              <p className="text-sm font-semibold text-slate-700">Nenhum histórico ministerial registrado para este ministro.</p>
              <p className="text-xs text-slate-500 mt-1">Os processos de consagração e homologações realizadas serão exibidos aqui.</p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {eventos.map((ev, idx) => {
                const badge = getBadgeInfo(ev.tipo_evento, ev.decisao);
                const isProgressao = ev.cargo_anterior && (ev.cargo_resultante || ev.cargo_pretendido);
                const cargoDestacado = isProgressao
                  ? `${ev.cargo_anterior} → ${ev.cargo_resultante || ev.cargo_pretendido}`
                  : (ev.cargo_resultante || ev.cargo || ev.cargo_pretendido || '');

                return (
                  <div key={ev.id || `${ev.tipo_evento}_${idx}`} className="relative group">
                    {/* Marcador da timeline */}
                    <div className={`absolute -left-[30px] top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-xs ${badge.dot} flex items-center justify-center`}>
                    </div>

                    {/* Card do Evento */}
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-teal-300 transition space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${badge.bg}`}>
                            <span>{badge.icon}</span>
                            <span>{badge.label}</span>
                          </span>
                          {ev.numero_processo && (
                            <span className="text-xs font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                              Proc. nº {ev.numero_processo}
                            </span>
                          )}
                        </div>

                        <span className="text-xs font-semibold text-slate-500">
                          📅 {formatarDataBr(ev.data)}
                        </span>
                      </div>

                      {/* Destaque para Progressão de Cargo */}
                      {cargoDestacado && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-500 font-medium">Cargo / Progressão:</span>
                          <span className="font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded">
                            {cargoDestacado}
                          </span>
                        </div>
                      )}

                      {/* Descrição do Evento */}
                      {ev.descricao && (
                        <p className="text-xs text-slate-700 leading-relaxed">
                          {ev.descricao}
                        </p>
                      )}

                      {/* Metadados adicionais: Comissão, Solicitante, Local */}
                      {(ev.comissao_nome || ev.pastor_solicitante || ev.local || ev.local_origem) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-600">
                          {ev.comissao_nome && (
                            <div>
                              <span className="font-semibold text-slate-700">Comissão:</span> {ev.comissao_nome}
                            </div>
                          )}
                          {ev.pastor_solicitante && (
                            <div>
                              <span className="font-semibold text-slate-700">Pastor Solicitante / Indicação:</span> {ev.pastor_solicitante}
                            </div>
                          )}
                          {ev.local && (
                            <div>
                              <span className="font-semibold text-slate-700">Local / Congregação:</span> {ev.local}
                            </div>
                          )}
                          {ev.local_origem && (
                            <div>
                              <span className="font-semibold text-slate-700">Origem:</span> {ev.local_origem}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Parecer / Despacho da Comissão */}
                      {ev.parecer && (
                        <div className="bg-teal-50/70 border border-teal-200 rounded-lg p-3 text-xs">
                          <span className="block font-bold text-teal-900 uppercase tracking-wide text-[10px] mb-1">
                            Parecer da Comissão:
                          </span>
                          <p className="italic text-teal-950 font-normal whitespace-pre-wrap leading-relaxed">
                            &ldquo;{ev.parecer}&rdquo;
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Rodapé do Modal */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center rounded-b-2xl flex-shrink-0 text-xs text-slate-500">
          <span>Total de eventos registrados: <strong>{eventos.length}</strong></span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-xl transition cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
