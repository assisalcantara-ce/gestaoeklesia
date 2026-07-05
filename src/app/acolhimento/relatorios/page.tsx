'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react';
import PageLayout from '@/components/PageLayout';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { createClient } from '@/lib/supabase-client';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer
} from 'recharts';

interface LocalOption {
  id: string;
  nome: string;
}

interface RelatorioEspiritualRegistro {
  id: string;
  ministry_id: string;
  congregacao_id: string | null;
  data_atividade: string;
  tipo_atividade: 'Culto' | 'Santa Ceia' | 'Visita' | 'Evangelismo' | 'Outro';
  cultos_realizados: number;
  visitas_realizadas: number;
  almas_alcancadas: number;
  biblias_doadas: number;
  literaturas_entregues: number;
  membros_cearam: number;
  visitantes_presentes: number;
  reconciliacoes: number;
  batismos_espirito_santo: number;
  curas_divinas: number;
}

interface MinistryData {
  name: string;
  logo_url: string | null;
  phone: string | null;
  email_admin: string | null;
}

const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function RelatoriosAcolhimentoPage() {
  const { ctx, bloqueado } = useRequireModulo('gestao');
  const supabase = useMemo(() => createClient(), []);

  // Filtros
  const [dashMes, setDashMes] = useState<number>(new Date().getMonth() + 1);
  const [dashAno, setDashAno] = useState<number>(new Date().getFullYear());
  const [selectedCongregacao, setSelectedCongregacao] = useState<string>('');

  // Estados de dados
  const [locais, setLocais] = useState<LocalOption[]>([]);
  const [registros, setRegistros] = useState<RelatorioEspiritualRegistro[]>([]);
  const [ministry, setMinistry] = useState<MinistryData | null>(null);
  const [tipoRelatorio, setTipoRelatorio] = useState<'geral' | 'congregacao' | 'crescimento'>('geral');
  const [cultosDetalhe, setCultosDetalhe] = useState<any[]>([]);

  const isLocalUser = useMemo(() => {
    return !!(ctx?.nivel && ['admin_local', 'financeiro_local', 'secretaria_local'].includes(ctx.nivel));
  }, [ctx?.nivel]);

  // Carregar dados iniciais
  useEffect(() => {
    if (ctx?.loading || !ctx?.ministryId) return;

    const loadLocais = async () => {
      const { data, error } = await supabase
        .from('congregacoes')
        .select('id, nome')
        .eq('ministry_id', ctx.ministryId)
        .order('nome');

      if (!error && data) {
        setLocais(data as LocalOption[]);
        if (isLocalUser && ctx.congregacaoId) {
          setSelectedCongregacao(ctx.congregacaoId);
        } else if (data.length > 0) {
          setSelectedCongregacao(data[0].id);
        }
      }
    };

    const loadMinistry = async () => {
      const { data, error } = await supabase
        .from('ministries')
        .select('name, logo_url, phone, email_admin')
        .eq('id', ctx.ministryId)
        .single();
      if (!error && data) {
        setMinistry(data as MinistryData);
      }
    };

    loadLocais();
    loadMinistry();
  }, [ctx?.loading, ctx?.ministryId, isLocalUser, ctx?.congregacaoId, supabase]);

  // Carregar registros de todo o ano/mês para comparar e compilar
  useEffect(() => {
    if (ctx?.loading || !ctx?.ministryId) return;

    const loadRegistros = async () => {
      let query = supabase
        .from('relatorio_espiritual_registros')
        .select('*')
        .eq('ministry_id', ctx.ministryId);

      if (isLocalUser && ctx.congregacaoId) {
        query = query.eq('congregacao_id', ctx.congregacaoId);
      }

      const { data, error } = await query;
      if (!error && data) {
        setRegistros(data as RelatorioEspiritualRegistro[]);
      }
    };

    const loadCultos = async () => {
      let query = supabase
        .from('culto_registros')
        .select('id, data_culto, tipo_culto, dirigente, pregador, status, visitantes_presentes, almas_alcancadas, reconciliacoes, batismos_espirito_santo, membros_cearam, congregacao_id')
        .eq('ministry_id', ctx.ministryId);

      if (isLocalUser && ctx.congregacaoId) {
        query = query.eq('congregacao_id', ctx.congregacaoId);
      }

      const { data, error } = await query.order('data_culto', { ascending: true });
      if (!error && data) {
        setCultosDetalhe(data);
      }
    };

    loadRegistros();
    loadCultos();
  }, [ctx?.loading, ctx?.ministryId, isLocalUser, ctx?.congregacaoId, supabase]);

  // Filtrar registros do mês selecionado
  const registrosMesAtual = useMemo(() => {
    return registros.filter(r => {
      const actDate = new Date(r.data_atividade);
      const m = actDate.getUTCMonth() + 1;
      const y = actDate.getUTCFullYear();
      return m === dashMes && y === dashAno;
    });
  }, [registros, dashMes, dashAno]);

  // Filtrar registros do mês anterior para comparativo de crescimento
  const registrosMesAnterior = useMemo(() => {
    const prevMes = dashMes === 1 ? 12 : dashMes - 1;
    const prevAno = dashMes === 1 ? dashAno - 1 : dashAno;
    return registros.filter(r => {
      const actDate = new Date(r.data_atividade);
      const m = actDate.getUTCMonth() + 1;
      const y = actDate.getUTCFullYear();
      return m === prevMes && y === prevAno;
    });
  }, [registros, dashMes, dashAno]);

  // Consolidar totais mês atual
  const totalAtual = useMemo(() => {
    const res = { cultos: 0, visitas: 0, almas: 0, batismos: 0, reconciliacoes: 0, visitantes: 0, cearam: 0, biblias: 0, literaturas: 0, curas: 0 };
    registrosMesAtual.forEach(r => {
      res.cultos += r.cultos_realizados || 0;
      res.visitas += r.visitas_realizadas || 0;
      res.almas += r.almas_alcancadas || 0;
      res.batismos += r.batismos_espirito_santo || 0;
      res.reconciliacoes += r.reconciliacoes || 0;
      res.visitantes += r.visitantes_presentes || 0;
      res.cearam += r.membros_cearam || 0;
      res.biblias += r.biblias_doadas || 0;
      res.literaturas += r.literaturas_entregues || 0;
      res.curas += r.curas_divinas || 0;
    });
    return res;
  }, [registrosMesAtual]);

  // Consolidar totais mês anterior
  const totalAnterior = useMemo(() => {
    const res = { cultos: 0, visitas: 0, almas: 0, batismos: 0, reconciliacoes: 0, visitantes: 0, cearam: 0, biblias: 0, literaturas: 0, curas: 0 };
    registrosMesAnterior.forEach(r => {
      res.cultos += r.cultos_realizados || 0;
      res.visitas += r.visitas_realizadas || 0;
      res.almas += r.almas_alcancadas || 0;
      res.batismos += r.batismos_espirito_santo || 0;
      res.reconciliacoes += r.reconciliacoes || 0;
      res.visitantes += r.visitantes_presentes || 0;
      res.cearam += r.membros_cearam || 0;
      res.biblias += r.biblias_doadas || 0;
      res.literaturas += r.literaturas_entregues || 0;
      res.curas += r.curas_divinas || 0;
    });
    return res;
  }, [registrosMesAnterior]);

  // Tabela consolidada por congregação
  const consolidadoPorCongregacao = useMemo(() => {
    return locais.map(l => {
      let cultos = 0, almas = 0, batismos = 0, reconciliacoes = 0, visitantes = 0, visitas = 0, cearam = 0;
      registrosMesAtual.forEach(r => {
        if (r.congregacao_id === l.id) {
          cultos += r.cultos_realizados || 0;
          almas += r.almas_alcancadas || 0;
          batismos += r.batismos_espirito_santo || 0;
          reconciliacoes += r.reconciliacoes || 0;
          visitantes += r.visitantes_presentes || 0;
          visitas += r.visitas_realizadas || 0;
          cearam += r.membros_cearam || 0;
        }
      });
      return { id: l.id, nome: l.nome, cultos, almas, batismos, reconciliacoes, visitantes, visitas, cearam };
    });
  }, [locais, registrosMesAtual]);

  // Dados para Relatório por Congregação
  const congregacaoSelecionadaData = useMemo(() => {
    const local = locais.find(l => l.id === selectedCongregacao);
    const regs = registrosMesAtual.filter(r => r.congregacao_id === selectedCongregacao);
    
    const totais = { cultos: 0, visitas: 0, almas: 0, batismos: 0, reconciliacoes: 0, visitantes: 0, cearam: 0, biblias: 0, literaturas: 0, curas: 0 };
    regs.forEach(r => {
      totais.cultos += r.cultos_realizados || 0;
      totais.visitas += r.visitas_realizadas || 0;
      totais.almas += r.almas_alcancadas || 0;
      totais.batismos += r.batismos_espirito_santo || 0;
      totais.reconciliacoes += r.reconciliacoes || 0;
      totais.visitantes += r.visitantes_presentes || 0;
      totais.cearam += r.membros_cearam || 0;
      totais.biblias += r.biblias_doadas || 0;
      totais.literaturas += r.literaturas_entregues || 0;
      totais.curas += r.curas_divinas || 0;
    });

    const cultosList = cultosDetalhe.filter(c => {
      const d = new Date(c.data_culto);
      const m = d.getUTCMonth() + 1;
      const y = d.getUTCFullYear();
      return c.congregacao_id === selectedCongregacao && m === dashMes && y === dashAno;
    });

    return { local, totais, cultos: cultosList };
  }, [locais, selectedCongregacao, registrosMesAtual, cultosDetalhe, dashMes, dashAno]);

  // Conclusão automática baseada nas métricas do Mês anterior vs Atual
  const conclusaoCrescimento = useMemo(() => {
    const diffAlmas = totalAtual.almas - totalAnterior.almas;
    const diffVisitantes = totalAtual.visitantes - totalAnterior.visitantes;
    
    let texto = `Durante o mês de ${MESES_PT[dashMes - 1]} de ${dashAno}, observamos um desenvolvimento importante nas ações pastorais e de evangelismo do ministério. `;
    
    if (diffAlmas > 0) {
      texto += `Com um aumento de ${diffAlmas} novas decisões por Cristo comparado ao mês anterior, as frentes evangelísticas demonstram alta eficácia de conversão. `;
    } else if (diffAlmas < 0) {
      texto += `Houve uma oscilação na captação de novas almas (redução de ${Math.abs(diffAlmas)} decisões), sugerindo a necessidade de intensificar campanhas de evangelismo locais. `;
    } else {
      texto += `O número de almas salvas se manteve estável em relação ao período anterior. `;
    }

    if (diffVisitantes > 0) {
      texto += `O acolhimento foi fortalecido, resultando em um crescimento de ${diffVisitantes} visitas recebidas nas congregações. `;
    } else if (diffVisitantes < 0) {
      texto += `Notou-se um recuo no volume de novos visitantes, sendo recomendado revisar os fluxos de integração e convites das redes locais. `;
    }

    return texto + " Recomenda-se manter o acompanhamento contínuo dos novos convertidos e fortalecer a consolidação por meio das ferramentas do Gestão Eklésia.";
  }, [totalAtual, totalAnterior, dashMes, dashAno]);

  // Percentual de variação
  const calcPercent = (atual: number, anterior: number) => {
    if (anterior === 0) return atual > 0 ? '+100%' : '0%';
    const pct = ((atual - anterior) / anterior) * 100;
    return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
  };

  if (bloqueado) return null;

  return (
    <PageLayout
      title="📋 Relatórios Oficiais"
      description="Relatórios institucionais para impressão e reuniões ministeriais."
      activeMenu="relatorios-acolhimento"
      headerExtra={
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition shadow-md print:hidden flex items-center gap-1.5 cursor-pointer"
        >
          🖨️ Imprimir PDF
        </button>
      }
    >
      {/* Estilo para impressão A4 */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print-no-break {
            page-break-inside: avoid;
          }
          .print-header {
            border-bottom: 2px solid #062e6f !important;
          }
          .print-footer {
            border-top: 1px solid #e2e8f0 !important;
            position: running(footer);
          }
        }
      `}</style>

      {/* Controles de Filtros da Tela (Escondidos na Impressão) */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4 mb-6 print:hidden">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Mês / Ano</label>
            <div className="flex gap-2">
              <select
                value={dashMes}
                onChange={e => setDashMes(parseInt(e.target.value))}
                className="border border-slate-300 rounded-xl px-3 py-2 text-sm bg-slate-50 font-bold focus:bg-white transition cursor-pointer"
              >
                {MESES_PT.map((nome, index) => (
                  <option key={index + 1} value={index + 1}>{nome}</option>
                ))}
              </select>
              <select
                value={dashAno}
                onChange={e => setDashAno(parseInt(e.target.value))}
                className="border border-slate-300 rounded-xl px-3 py-2 text-sm bg-slate-50 font-bold focus:bg-white transition cursor-pointer"
              >
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
                <option value={2027}>2027</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Tipo de Relatório</label>
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setTipoRelatorio('geral')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${tipoRelatorio === 'geral' ? 'bg-white text-[#062E6F] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Geral do Ministério
              </button>
              <button
                onClick={() => setTipoRelatorio('congregacao')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${tipoRelatorio === 'congregacao' ? 'bg-white text-[#062E6F] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Por Congregação
              </button>
              <button
                onClick={() => setTipoRelatorio('crescimento')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${tipoRelatorio === 'crescimento' ? 'bg-white text-[#062E6F] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Gráfico & Crescimento
              </button>
            </div>
          </div>

          {tipoRelatorio === 'congregacao' && (
            <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
              <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Congregação</label>
              <select
                value={selectedCongregacao}
                onChange={e => setSelectedCongregacao(e.target.value)}
                className="border border-slate-300 rounded-xl px-3 py-2 text-sm bg-slate-50 font-bold focus:bg-white transition cursor-pointer w-full"
              >
                {locais.map(l => (
                  <option key={l.id} value={l.id}>{l.nome}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ÁREA DE IMPRESSÃO / PRÉ-VISUALIZAÇÃO */}
      <div id="print-area" className="bg-white border border-slate-200 rounded-3xl p-8 md:p-12 shadow-md min-h-[1123px] text-slate-800">
        
        {/* Cabeçalho Institucional */}
        <div className="print-header pb-6 border-b-2 border-[#062E6F] flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {ministry?.logo_url ? (
              <img src={ministry.logo_url} alt="Logo" className="h-16 w-auto object-contain" />
            ) : (
              <div className="h-14 w-14 bg-[#062E6F] text-white rounded-xl flex items-center justify-center font-black text-xl">
                EK
              </div>
            )}
            <div>
              <h2 className="text-xl font-black text-[#062E6F] uppercase tracking-wide">{ministry?.name || 'Gestão Eklésia'}</h2>
              <p className="text-xs font-bold text-slate-400">SECRETARIA GERAL DE ACOLHIMENTO</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Competência</span>
            <strong className="text-base font-extrabold text-[#062E6F]">{MESES_PT[dashMes - 1]} de {dashAno}</strong>
          </div>
        </div>

        {/* ─── TIPO 1: RELATÓRIO GERAL DO MINISTÉRIO ─── */}
        {tipoRelatorio === 'geral' && (
          <div className="mt-8 space-y-8">
            <div>
              <h3 className="text-lg font-black text-[#062E6F] uppercase tracking-wider mb-4">Relatório Consolidado do Ministério</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Este documento apresenta a consolidação espiritual e de atividades de todas as congregações pertencentes ao ministério durante a competência selecionada. Os dados representam decisões de fé, Santa Ceia e frentes pastorais.
              </p>
            </div>

            {/* Resumo Executivo KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Decisões / Almas</span>
                <strong className="text-2xl font-black text-[#062E6F]">{totalAtual.almas}</strong>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Novos Visitantes</span>
                <strong className="text-2xl font-black text-[#062E6F]">{totalAtual.visitantes}</strong>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Total de Cultos</span>
                <strong className="text-2xl font-black text-[#062E6F]">{totalAtual.cultos}</strong>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Reconciliações</span>
                <strong className="text-2xl font-black text-[#062E6F]">{totalAtual.reconciliacoes}</strong>
              </div>
            </div>

            {/* Outros KPIs Menores */}
            <div className="grid grid-cols-3 gap-4 text-xs font-semibold text-slate-650">
              <div className="border border-slate-100 rounded-xl p-3 flex justify-between items-center">
                <span>Batismos no Espírito:</span>
                <strong className="font-extrabold text-[#062E6F]">{totalAtual.batismos}</strong>
              </div>
              <div className="border border-slate-100 rounded-xl p-3 flex justify-between items-center">
                <span>Curas Divinas:</span>
                <strong className="font-extrabold text-[#062E6F]">{totalAtual.curas}</strong>
              </div>
              <div className="border border-slate-100 rounded-xl p-3 flex justify-between items-center">
                <span>Membros Cearam:</span>
                <strong className="font-extrabold text-[#062E6F]">{totalAtual.cearam}</strong>
              </div>
              <div className="border border-slate-100 rounded-xl p-3 flex justify-between items-center">
                <span>Bíblias Doadas:</span>
                <strong className="font-extrabold text-[#062E6F]">{totalAtual.biblias}</strong>
              </div>
              <div className="border border-slate-100 rounded-xl p-3 flex justify-between items-center">
                <span>Literaturas Entregues:</span>
                <strong className="font-extrabold text-[#062E6F]">{totalAtual.literaturas}</strong>
              </div>
              <div className="border border-slate-100 rounded-xl p-3 flex justify-between items-center">
                <span>Evangelismos/Visitas:</span>
                <strong className="font-extrabold text-[#062E6F]">{totalAtual.visitas}</strong>
              </div>
            </div>

            {/* Tabela de congregações */}
            <div className="print-no-break">
              <h4 className="text-sm font-bold text-[#062E6F] uppercase tracking-wide mb-3">Tabela Consolidada por Unidade</h4>
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500">
                      <th className="p-3">Congregação</th>
                      <th className="p-3 text-center">Cultos</th>
                      <th className="p-3 text-center">Almas</th>
                      <th className="p-3 text-center">Visitantes</th>
                      <th className="p-3 text-center">Reconciliações</th>
                      <th className="p-3 text-center">Batismos Espírito</th>
                      <th className="p-3 text-center">Cearam</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {consolidadoPorCongregacao.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-semibold text-slate-800">{c.nome}</td>
                        <td className="p-3 text-center">{c.cultos}</td>
                        <td className="p-3 text-center">{c.almas}</td>
                        <td className="p-3 text-center">{c.visitantes}</td>
                        <td className="p-3 text-center">{c.reconciliacoes}</td>
                        <td className="p-3 text-center">{c.batismos}</td>
                        <td className="p-3 text-center">{c.cearam}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── TIPO 2: RELATÓRIO POR CONGREGAÇÃO ─── */}
        {tipoRelatorio === 'congregacao' && (
          <div className="mt-8 space-y-8">
            <div>
              <h3 className="text-lg font-black text-[#062E6F] uppercase tracking-wider mb-1">
                Relatório de Acolhimento — {congregacaoSelecionadaData.local?.nome || 'Unidade Selecionada'}
              </h3>
              <p className="text-xs text-slate-500">
                Resumo específico e histórico de reuniões e cultos realizados nesta congregação.
              </p>
            </div>

            {/* Totais do Mês */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Cultos Realizados</span>
                <strong className="text-xl font-bold text-[#062E6F]">{congregacaoSelecionadaData.totais.cultos}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Visitantes Recebidos</span>
                <strong className="text-xl font-bold text-[#062E6F]">{congregacaoSelecionadaData.totais.visitantes}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Almas Alcançadas</span>
                <strong className="text-xl font-bold text-[#062E6F]">{congregacaoSelecionadaData.totais.almas}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Reconciliados</span>
                <strong className="text-xl font-bold text-[#062E6F]">{congregacaoSelecionadaData.totais.reconciliacoes}</strong>
              </div>
            </div>

            {/* Detalhe da lista de cultos */}
            <div className="print-no-break">
              <h4 className="text-sm font-bold text-[#062E6F] uppercase tracking-wide mb-3">Lista de Cultos na Competência</h4>
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500">
                      <th className="p-3">Data</th>
                      <th className="p-3">Tipo</th>
                      <th className="p-3">Pregador</th>
                      <th className="p-3 text-center">Visitantes</th>
                      <th className="p-3 text-center">Almas</th>
                      <th className="p-3 text-center">Cearam</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {congregacaoSelecionadaData.cultos.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-slate-400">Nenhum culto registrado para esta competência.</td>
                      </tr>
                    ) : (
                      congregacaoSelecionadaData.cultos.map((c: any) => (
                        <tr key={c.id}>
                          <td className="p-3 font-semibold">{new Date(c.data_culto + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                          <td className="p-3 font-bold text-[#062E6F]">{c.tipo_culto}</td>
                          <td className="p-3 text-slate-650">{c.pregador || '—'}</td>
                          <td className="p-3 text-center">{c.visitantes_presentes}</td>
                          <td className="p-3 text-center">{c.almas_alcancadas}</td>
                          <td className="p-3 text-center">{c.membros_cearam}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── TIPO 3: RELATÓRIO DE CRESCIMENTO & COMPARATIVOS ─── */}
        {tipoRelatorio === 'crescimento' && (
          <div className="mt-8 space-y-8">
            <div>
              <h3 className="text-lg font-black text-[#062E6F] uppercase tracking-wider mb-2">Relatório de Evolução e Crescimento Espiritual</h3>
              <p className="text-xs text-slate-500">
                Análise de crescimento comparativa com a competência do mês anterior.
              </p>
            </div>

            {/* Tabela de Variação Mês Anterior vs Atual */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500">
                    <th className="p-3">Indicador</th>
                    <th className="p-3 text-center">Mês Anterior</th>
                    <th className="p-3 text-center">Mês Atual</th>
                    <th className="p-3 text-center">Variação %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="p-3 font-bold text-[#062E6F]">Decisões (Almas)</td>
                    <td className="p-3 text-center">{totalAnterior.almas}</td>
                    <td className="p-3 text-center">{totalAtual.almas}</td>
                    <td className={`p-3 text-center font-bold ${totalAtual.almas >= totalAnterior.almas ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {calcPercent(totalAtual.almas, totalAnterior.almas)}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-[#062E6F]">Visitantes Presentes</td>
                    <td className="p-3 text-center">{totalAnterior.visitantes}</td>
                    <td className="p-3 text-center">{totalAtual.visitantes}</td>
                    <td className={`p-3 text-center font-bold ${totalAtual.visitantes >= totalAnterior.visitantes ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {calcPercent(totalAtual.visitantes, totalAnterior.visitantes)}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-[#062E6F]">Batismos Espírito Santo</td>
                    <td className="p-3 text-center">{totalAnterior.batismos}</td>
                    <td className="p-3 text-center">{totalAtual.batismos}</td>
                    <td className={`p-3 text-center font-bold ${totalAtual.batismos >= totalAnterior.batismos ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {calcPercent(totalAtual.batismos, totalAnterior.batismos)}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-[#062E6F]">Membros Cearam</td>
                    <td className="p-3 text-center">{totalAnterior.cearam}</td>
                    <td className="p-3 text-center">{totalAtual.cearam}</td>
                    <td className={`p-3 text-center font-bold ${totalAtual.cearam >= totalAnterior.cearam ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {calcPercent(totalAtual.cearam, totalAnterior.cearam)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Gráficos para impressão (usando SVG simples de barras em Recharts) */}
            <div className="print-no-break grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
                <span className="text-[10px] text-slate-400 font-bold block uppercase mb-2">Decisões & Reconciliações</span>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: 'Almas', Anterior: totalAnterior.almas, Atual: totalAtual.almas },
                      { name: 'Reconciliados', Anterior: totalAnterior.reconciliacoes, Atual: totalAtual.reconciliacoes }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Bar dataKey="Anterior" fill="#94a3b8" />
                      <Bar dataKey="Atual" fill="#062e6f" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
                <span className="text-[10px] text-slate-400 font-bold block uppercase mb-2">Fluxo de Visitantes</span>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: 'Visitantes', Anterior: totalAnterior.visitantes, Atual: totalAtual.visitantes }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Bar dataKey="Anterior" fill="#94a3b8" />
                      <Bar dataKey="Atual" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Conclusão automática baseada em dados */}
            <div className="print-no-break bg-slate-50 border border-slate-100 rounded-2xl p-5">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">Conclusão Analítica</h4>
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                {conclusaoCrescimento}
              </p>
            </div>
          </div>
        )}

        {/* Rodapé Institucional */}
        <div className="print-footer mt-12 pt-4 border-t border-slate-200 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          <span>Emitido em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
          <span>Gestão Eklésia — Acolhimento v1.0</span>
        </div>
      </div>
    </PageLayout>
  );
}
