'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  historicoMinisterialService,
  CategoriaHistoricoMinisterial,
  HistoricoMinisterialCompleto,
} from '@/services/historico-ministerial-service';
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
  const [historicoData, setHistoricoData] = useState<HistoricoMinisterialCompleto | null>(null);
  const [categoriaAtiva, setCategoriaAtiva] = useState<CategoriaHistoricoMinisterial>('todos');
  const [filtroTexto, setFiltroTexto] = useState('');

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

        const data = await historicoMinisterialService.obterHistoricoCompleto(membro.id, ministryId, supabase);
        if (isMounted) {
          setHistoricoData(data);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Erro ao carregar histórico ministerial unificado:', err);
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
    data_emissao_credencial: membro.data_emissao || null,
    data_validade_credencial: membro.data_validade_credencial || null,
    status_cadastro: membro.status || 'active',
  };

  const todosEventos = historicoData?.eventos || [];
  const contadores = historicoData?.contadores || {
    todos: 0,
    consagracao: 0,
    frequencia: 0,
    credencial: 0,
    lideranca: 0,
    documental: 0,
    espiritual: 0,
  };

  // Filtragem combinada por categoria e texto
  const eventosFiltrados = useMemo(() => {
    return todosEventos.filter((ev) => {
      // Filtro por Categoria
      if (categoriaAtiva !== 'todos' && ev.categoria !== categoriaAtiva) {
        return false;
      }
      // Filtro por Texto Livre
      if (filtroTexto.trim()) {
        const termo = filtroTexto.toLowerCase();
        const matchTitulo = ev.titulo.toLowerCase().includes(termo);
        const matchDesc = ev.descricao.toLowerCase().includes(termo);
        const matchData = ev.data.includes(termo);
        const matchProc = ev.numero_processo?.toLowerCase().includes(termo);
        const matchReuniao = ev.reuniao_titulo?.toLowerCase().includes(termo);
        const matchCargo = (ev.cargo_resultante || ev.cargo || ev.cargo_pretendido || '').toLowerCase().includes(termo);
        return matchTitulo || matchDesc || matchData || matchProc || matchReuniao || matchCargo;
      }
      return true;
    });
  }, [todosEventos, categoriaAtiva, filtroTexto]);

  const formatarDataBr = (dataStr?: string | null) => {
    if (!dataStr) return '-';
    const clean = String(dataStr).slice(0, 10);
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

  const categoriasTabs: { key: CategoriaHistoricoMinisterial; label: string; count: number; icon: string }[] = [
    { key: 'todos', label: 'Todos', count: contadores.todos, icon: '📜' },
    { key: 'frequencia', label: 'Reuniões & Presenças', count: contadores.frequencia, icon: '📅' },
    { key: 'consagracao', label: 'Consagrações & Cargos', count: contadores.consagracao, icon: '🎖️' },
    { key: 'credencial', label: 'Credenciais', count: contadores.credencial, icon: '🪪' },
    { key: 'lideranca', label: 'Liderança', count: contadores.lideranca, icon: '🏛️' },
    { key: 'documental', label: 'Documentos', count: contadores.documental, icon: '📄' },
    { key: 'espiritual', label: 'Marcos Espirituais', count: contadores.espiritual, icon: '🕊️' },
  ];

  // Impressão Institucional do Histórico Completo
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

    const timelineHtml = eventosFiltrados.length === 0
      ? `<div style="text-align: center; padding: 30px; color: #64748b; font-size: 13px;">Nenhum evento registrado nesta categoria.</div>`
      : eventosFiltrados.map((ev, index) => {
          const dataFormatada = formatarDataBr(ev.data);
          const isProgressao = ev.cargo_anterior && (ev.cargo_resultante || ev.cargo_pretendido);
          const cargoDestacado = isProgressao
            ? `${ev.cargo_anterior} → ${ev.cargo_resultante || ev.cargo_pretendido}`
            : (ev.cargo_resultante || ev.cargo || ev.cargo_pretendido || '');

          return `
            <div style="display: flex; gap: 14px; margin-bottom: 16px; position: relative;">
              <div style="display: flex; flex-direction: column; align-items: center; width: 22px;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background: #0f766e; border: 2px solid #ccfbf1; z-index: 2;"></div>
                ${index !== eventosFiltrados.length - 1 ? `<div style="width: 2px; flex: 1; background: #e2e8f0; margin-top: 4px;"></div>` : ''}
              </div>
              <div style="flex: 1; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 14px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
                  <div>
                    <span style="display: inline-block; font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 2px 8px; border-radius: 4px; background: #ccfbf1; color: #0f766e; border: 1px solid #99f6e4;">
                      ${ev.badge.label}
                    </span>
                    ${ev.numero_processo ? `<span style="font-family: monospace; font-size: 11px; font-weight: 700; color: #334155; margin-left: 8px;">Processo nº ${ev.numero_processo}</span>` : ''}
                    ${ev.reuniao_titulo ? `<span style="font-size: 11px; font-weight: 700; color: #0f766e; margin-left: 8px;">${ev.reuniao_titulo}</span>` : ''}
                  </div>
                  <div style="font-size: 11px; font-weight: 700; color: #64748b;">${dataFormatada}</div>
                </div>

                ${cargoDestacado ? `
                  <div style="margin-bottom: 4px; font-size: 11.5px;">
                    <strong style="color: #0f766e;">Cargo / Progressão:</strong> <span style="font-weight: 800; color: #0f172a;">${cargoDestacado}</span>
                  </div>
                ` : ''}

                <div style="font-size: 11px; color: #334155; margin-bottom: 4px;">
                  ${ev.descricao || '-'}
                </div>

                ${(ev.comissao_nome || ev.pastor_solicitante || ev.local || ev.local_origem || ev.responsavel) ? `
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 10px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 10px; margin-top: 6px;">
                    ${ev.comissao_nome ? `<div><strong>Comissão:</strong> ${ev.comissao_nome}</div>` : ''}
                    ${ev.pastor_solicitante ? `<div><strong>Indicação:</strong> ${ev.pastor_solicitante}</div>` : ''}
                    ${ev.local ? `<div><strong>Local:</strong> ${ev.local}</div>` : ''}
                    ${ev.responsavel ? `<div><strong>Homologado por:</strong> ${ev.responsavel}</div>` : ''}
                  </div>
                ` : ''}

                ${ev.parecer ? `
                  <div style="margin-top: 6px; background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 6px; padding: 6px 10px;">
                    <div style="font-size: 9px; font-weight: 800; color: #0f766e; text-transform: uppercase;">PARECER:</div>
                    <div style="font-size: 10.5px; color: #134e4a; font-style: italic;">${ev.parecer}</div>
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
        <title>Histórico Ministerial Oficial - ${ministroInfo.nome}</title>
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
            width: 52px;
            height: 52px;
            object-fit: contain;
          }
          .header-title h1 {
            font-size: 17px;
            font-weight: 800;
            color: #0f766e;
            text-transform: uppercase;
            letter-spacing: -0.3px;
          }
          .header-title p {
            font-size: 11px;
            color: #64748b;
            font-weight: 600;
          }
          .header-right {
            text-align: right;
            font-size: 10.5px;
            color: #64748b;
          }
          .summary-card {
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 12px 16px;
            margin-bottom: 20px;
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
          }
          .summary-field label {
            display: block;
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
            color: #64748b;
            margin-bottom: 2px;
          }
          .summary-field p {
            font-size: 12px;
            font-weight: 700;
            color: #0f172a;
          }
          .section-title {
            font-size: 13px;
            font-weight: 800;
            color: #0f766e;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 14px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 4px;
          }
          .footer {
            margin-top: 24px;
            border-top: 1px solid #cbd5e1;
            padding-top: 10px;
            display: flex;
            justify-content: space-between;
            font-size: 9.5px;
            color: #94a3b8;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            ${churchLogo ? `<img src="${churchLogo}" class="header-logo" alt="Logo" />` : ''}
            <div class="header-title">
              <h1>${churchNome}</h1>
              <p>Histórico Ministerial Oficial Unificado</p>
            </div>
          </div>
          <div class="header-right">
            <div>Emissão: <strong>${hoje}</strong> às ${hora}</div>
            <div>Total de Eventos: <strong>${eventosFiltrados.length}</strong></div>
          </div>
        </div>

        <div class="summary-card">
          <div class="summary-field" style="grid-column: span 2;">
            <label>Ministro</label>
            <p>${ministroInfo.nome}</p>
            <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">
              Matrícula: <strong>${ministroInfo.matricula}</strong> • CPF: <strong>${formatarCpf(ministroInfo.cpf)}</strong>
            </div>
          </div>
          <div class="summary-field">
            <label>Cargo Atual</label>
            <p style="color: #0f766e;">${ministroInfo.cargo_atual}</p>
          </div>
          <div class="summary-field">
            <label>Data Consagração</label>
            <p>${formatarDataBr(ministroInfo.data_consagracao_atual)}</p>
          </div>
          <div class="summary-field" style="grid-column: span 2;">
            <label>Congregação / Lotação</label>
            <p>${ministroInfo.congregacao_nome || 'Sede Central'}</p>
          </div>
          <div class="summary-field">
            <label>Validade Credencial</label>
            <p>${formatarDataBr(ministroInfo.data_validade_credencial)}</p>
          </div>
          <div class="summary-field">
            <label>Status Cadastral</label>
            <p style="text-transform: uppercase;">${ministroInfo.status_cadastro === 'active' ? 'Ativo' : ministroInfo.status_cadastro}</p>
          </div>
        </div>

        <div class="section-title">Linha do Tempo de Movimentações Ministeriais</div>
        <div class="timeline">
          ${timelineHtml}
        </div>

        <div class="footer">
          <span>Gestão Eklésia — Sistema de Gestão Eclesiástica e Secretaria Geral</span>
          <span>Ficha oficial de assentamento ministerial</span>
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-4 flex flex-col max-h-[92vh] border border-slate-200 animate-in zoom-in-95 duration-150 overflow-hidden">
        
        {/* Cabeçalho do Modal */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-teal-700 via-teal-800 to-slate-900 flex-shrink-0 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl shadow-inner border border-white/20">
              📜
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">Histórico do Ministro</h2>
              <p className="text-xs text-teal-100">Linha do tempo oficial unificada: consagrações, presenças, credenciais e liderança</p>
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
              <span className="hidden sm:inline">Imprimir Ficha</span>
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
        <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-13 h-15 rounded-xl bg-white border border-slate-300 overflow-hidden flex items-center justify-center shadow-xs flex-shrink-0">
              {ministroInfo.foto_url ? (
                <img src={ministroInfo.foto_url} alt={ministroInfo.nome} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl text-slate-400">👤</span>
              )}
            </div>

            <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              <div className="sm:col-span-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Nome do Ministro</span>
                <p className="text-sm font-bold text-slate-900 truncate">{ministroInfo.nome}</p>
                <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-500 mt-0.5">
                  <span>Matrícula: <strong className="text-slate-700 font-mono">{ministroInfo.matricula}</strong></span>
                  <span>CPF: <strong className="text-slate-700 font-mono">{formatarCpf(ministroInfo.cpf)}</strong></span>
                  {ministroInfo.congregacao_nome && (
                    <span className="hidden md:inline">• {ministroInfo.congregacao_nome}</span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Cargo Atual</span>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200 mt-0.5">
                  {ministroInfo.cargo_atual}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Consagração</span>
                <p className="text-xs font-semibold text-slate-700 mt-0.5">{formatarDataBr(ministroInfo.data_consagracao_atual)}</p>
                {ministroInfo.data_validade_credencial && (
                  <span className="text-[10px] text-slate-500 block">Validade: {formatarDataBr(ministroInfo.data_validade_credencial)}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Barra de Filtros por Categoria e Busca Textual */}
        <div className="px-6 py-2.5 bg-white border-b border-slate-200 flex-shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Abas de Categorias */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-xs">
            {categoriasTabs.map((tab) => {
              const ativa = categoriaAtiva === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setCategoriaAtiva(tab.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap cursor-pointer ${
                    ativa
                      ? 'bg-teal-700 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      ativa ? 'bg-teal-900 text-teal-100' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Campo de Busca Rápida */}
          <div className="relative min-w-[200px] sm:w-60">
            <input
              type="text"
              placeholder="Filtrar eventos..."
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 focus:bg-white focus:border-teal-600 focus:ring-1 focus:ring-teal-600 rounded-lg text-xs outline-none transition"
            />
            <span className="absolute left-2.5 top-2 text-slate-400 text-xs">🔍</span>
            {filtroTexto && (
              <button
                onClick={() => setFiltroTexto('')}
                className="absolute right-2.5 top-1.5 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Conteúdo com Scroll da Timeline */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 space-y-3">
              <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-medium">Consolidando linha do tempo ministerial...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <p className="font-bold">Erro ao carregar histórico</p>
              <p className="text-xs mt-1">{error}</p>
            </div>
          ) : eventosFiltrados.length === 0 ? (
            <div className="text-center py-16 px-4 bg-slate-50 border border-dashed border-slate-300 rounded-2xl">
              <span className="text-4xl block mb-2">📜</span>
              <p className="text-sm font-semibold text-slate-700">Nenhum evento localizado para o filtro selecionado.</p>
              <p className="text-xs text-slate-500 mt-1">
                {filtroTexto
                  ? 'Tente remover os termos de busca para visualizar os registros existentes.'
                  : 'As movimentações registradas neste módulo serão apresentadas em ordem cronológica aqui.'}
              </p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-5 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {eventosFiltrados.map((ev, idx) => {
                const isProgressao = ev.cargo_anterior && (ev.cargo_resultante || ev.cargo_pretendido);
                const cargoDestacado = isProgressao
                  ? `${ev.cargo_anterior} → ${ev.cargo_resultante || ev.cargo_pretendido}`
                  : (ev.cargo_resultante || ev.cargo || ev.cargo_pretendido || '');

                return (
                  <div key={ev.id || `${ev.tipo_evento}_${idx}`} className="relative group">
                    {/* Marcador da timeline */}
                    <div className={`absolute -left-[30px] top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-xs ${ev.badge.dot} flex items-center justify-center`}>
                    </div>

                    {/* Card do Evento */}
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-teal-300 hover:shadow-md transition space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${ev.badge.bg}`}>
                            <span>{ev.badge.icon}</span>
                            <span>{ev.badge.label}</span>
                          </span>

                          {ev.numero_processo && (
                            <span className="text-xs font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              Proc. nº {ev.numero_processo}
                            </span>
                          )}

                          {ev.reuniao_titulo && (
                            <span className="text-xs font-bold text-slate-800">
                              {ev.reuniao_titulo}
                            </span>
                          )}

                          {ev.subtitulo && !ev.reuniao_titulo && !ev.numero_processo && (
                            <span className="text-xs font-semibold text-slate-600">
                              {ev.subtitulo}
                            </span>
                          )}
                        </div>

                        <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
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
                        <p className="text-xs text-slate-700 leading-relaxed font-normal">
                          {ev.descricao}
                        </p>
                      )}

                      {/* Metadados adicionais: Comissão, Solicitante, Local, Responsável, Protocolo */}
                      {(ev.comissao_nome || ev.pastor_solicitante || ev.local || ev.local_origem || ev.responsavel || ev.advertencia_protocolo || ev.metodo_leitura) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-600">
                          {ev.comissao_nome && (
                            <div>
                              <span className="font-semibold text-slate-700">Comissão:</span> {ev.comissao_nome}
                            </div>
                          )}
                          {ev.pastor_solicitante && (
                            <div>
                              <span className="font-semibold text-slate-700">Indicação:</span> {ev.pastor_solicitante}
                            </div>
                          )}
                          {ev.local && (
                            <div>
                              <span className="font-semibold text-slate-700">Local / Lotação:</span> {ev.local}
                            </div>
                          )}
                          {ev.local_origem && (
                            <div>
                              <span className="font-semibold text-slate-700">Origem:</span> {ev.local_origem}
                            </div>
                          )}
                          {ev.responsavel && (
                            <div>
                              <span className="font-semibold text-slate-700">Homologado por:</span> {ev.responsavel}
                            </div>
                          )}
                          {ev.advertencia_protocolo && (
                            <div>
                              <span className="font-semibold text-slate-700">Protocolo Notificação:</span> {ev.advertencia_protocolo}
                            </div>
                          )}
                          {ev.metodo_leitura && (
                            <div>
                              <span className="font-semibold text-slate-700">Método de Presença:</span>{' '}
                              {ev.metodo_leitura === 'qrcode_carteirinha' ? 'Leitor QR Code' : ev.metodo_leitura === 'busca_nome' ? 'Busca Nominal' : ev.metodo_leitura}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Parecer / Despacho da Comissão */}
                      {ev.parecer && (
                        <div className="bg-teal-50/70 border border-teal-200 rounded-lg p-2.5 text-xs">
                          <span className="block font-bold text-teal-900 uppercase tracking-wide text-[10px] mb-0.5">
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
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-2 rounded-b-2xl flex-shrink-0 text-xs text-slate-500">
          <span>
            Exibindo <strong>{eventosFiltrados.length}</strong> de <strong>{todosEventos.length}</strong> eventos registrados
          </span>
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
