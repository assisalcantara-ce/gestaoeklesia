'use client';

import { useState, useMemo } from 'react';
import {
  Cake,
  Calendar,
  Phone,
  MessageCircle,
  Search,
  Printer,
  Sparkles,
} from 'lucide-react';
import type { BirthdayItem } from '@/services/secretary-reports-service';
import ReportPrintHeader from './ReportPrintHeader';

interface BirthdaysReportTabProps {
  initialBirthdays: {
    hoje?: BirthdayItem[];
    semana?: BirthdayItem[];
    mes?: BirthdayItem[];
    proximos_30?: BirthdayItem[];
    todos?: BirthdayItem[];
    contagemPorMes?: Record<number, number>;
    totalAnual?: number;
  };
  congregacaoNome?: string | null;
  ministryId: string;
}

const MESES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function BirthdaysReportTab({
  initialBirthdays,
  congregacaoNome,
}: BirthdaysReportTabProps) {
  const [tipoFiltro, setTipoFiltro] = useState<'hoje' | 'semana' | 'mes' | 'proximos_30'>('mes');
  const [mesSelecionado, setMesSelecionado] = useState(() => new Date().getMonth() + 1);
  const [searchTerm, setSearchTerm] = useState('');

  const now = new Date();
  const currentMonthNum = now.getMonth() + 1;
  const currentDayNum = now.getDate();

  // Mapa de contagens seguras por mês
  const contagemPorMes = useMemo(() => {
    if (initialBirthdays.contagemPorMes) {
      return initialBirthdays.contagemPorMes;
    }
    const counts: Record<number, number> = {
      1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0,
      7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0,
    };
    const pool = initialBirthdays.todos || initialBirthdays.mes || [];
    pool.forEach((item) => {
      if (item.mes >= 1 && item.mes <= 12) {
        counts[item.mes] = (counts[item.mes] || 0) + 1;
      }
    });
    return counts;
  }, [initialBirthdays]);

  // Lista base filtrada de acordo com a seleção
  const listaBase = useMemo(() => {
    if (tipoFiltro === 'hoje') {
      return initialBirthdays.hoje || [];
    }
    if (tipoFiltro === 'semana') {
      return initialBirthdays.semana || [];
    }
    if (tipoFiltro === 'proximos_30') {
      if (initialBirthdays.proximos_30 && initialBirthdays.proximos_30.length > 0) {
        return initialBirthdays.proximos_30;
      }
      const pool = initialBirthdays.todos || initialBirthdays.mes || [];
      const getDiffDays = (item: BirthdayItem) => {
        let bday = new Date(now.getFullYear(), item.mes - 1, item.dia);
        const ref = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (bday < ref) bday = new Date(now.getFullYear() + 1, item.mes - 1, item.dia);
        return Math.round((bday.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));
      };

      return pool
        .map((item) => ({ ...item, diffDays: getDiffDays(item) }))
        .filter((item) => item.diffDays >= 0 && item.diffDays <= 30)
        .sort((a, b) => a.diffDays - b.diffDays);
    }
    // tipoFiltro === 'mes'
    const pool = initialBirthdays.todos || initialBirthdays.mes || [];
    return pool.filter((item) => item.mes === mesSelecionado);
  }, [tipoFiltro, mesSelecionado, initialBirthdays, now]);

  // Filtro de busca textual
  const listaExibicao = useMemo(() => {
    if (!searchTerm.trim()) return listaBase;
    const term = searchTerm.toLowerCase();
    return listaBase.filter(
      (item) =>
        item.name.toLowerCase().includes(term) ||
        (item.congregacao_nome && item.congregacao_nome.toLowerCase().includes(term))
    );
  }, [listaBase, searchTerm]);

  function getWhatsAppUrl(phone: string, nome: string) {
    const cleanPhone = phone.replace(/\D/g, '');
    const phoneWithDDI = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const msg = encodeURIComponent(
      `Graça e Paz, ${nome}! A igreja deseja a você um feliz aniversário! Que Deus abençoe ricamente a sua vida!`
    );
    return `https://wa.me/${phoneWithDDI}?text=${msg}`;
  }

  const getSubtituloPeriodo = () => {
    if (tipoFiltro === 'hoje') return `Aniversariantes de Hoje (${String(currentDayNum).padStart(2, '0')}/${String(currentMonthNum).padStart(2, '0')})`;
    if (tipoFiltro === 'semana') return 'Aniversariantes Desta Semana (Domingo a Sábado)';
    if (tipoFiltro === 'proximos_30') return 'Próximos 30 Dias';
    return `Mês de ${MESES_NOMES[mesSelecionado - 1]}`;
  };

  const totalHoje = initialBirthdays.hoje?.length || 0;
  const totalSemana = initialBirthdays.semana?.length || 0;
  const totalProximos30 = initialBirthdays.proximos_30?.length || 0;
  const totalAnual = initialBirthdays.totalAnual ?? (initialBirthdays.todos?.length || 0);

  return (
    <div className="space-y-6">
      {/* ─── CABEÇALHO OFICIAL DE IMPRESSÃO A4 (hidden na tela, visible no print) ─── */}
      <ReportPrintHeader
        title="Relação Oficial de Aniversariantes"
        periodoOuData={getSubtituloPeriodo()}
        congregacaoNome={congregacaoNome}
      />

      {/* ─── GRID DE MESES (12 MESES) - PRINT:HIDDEN ─────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 print:hidden">
        {MESES_NOMES.map((nomeMes, index) => {
          const numMes = index + 1;
          const isSelected = tipoFiltro === 'mes' && mesSelecionado === numMes;
          const isCurrent = currentMonthNum === numMes;
          const qtd = contagemPorMes[numMes] || 0;

          return (
            <button
              key={nomeMes}
              onClick={() => {
                setTipoFiltro('mes');
                setMesSelecionado(numMes);
              }}
              className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                isSelected
                  ? 'border-purple-600 bg-purple-50/80 shadow-sm ring-2 ring-purple-600/20'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold ${isSelected ? 'text-purple-900' : 'text-gray-700'}`}>
                  {nomeMes}
                </span>
                {isCurrent && (
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                    Mês Atual
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className={`text-xl font-black ${qtd > 0 ? (isSelected ? 'text-purple-700' : 'text-gray-900') : 'text-gray-300'}`}>
                  {qtd}
                </span>
                <span className="text-[10px] text-gray-400 font-medium">
                  {qtd === 1 ? 'membro' : 'membros'}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ─── CONTROLES DE TELA (PRINT:HIDDEN) ─────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm print:hidden space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Cake className="w-5 h-5 text-purple-600" />
              Mural de Aniversariantes
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Consulte e imprima listas de aniversários para boletins, murais e mensagens pastorais. Total anual cadastrado: <strong className="text-gray-800">{totalAnual}</strong>.
            </p>
          </div>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-[#123b63] hover:bg-[#0d2b4a] text-white text-sm font-semibold rounded-xl transition shadow-sm self-start md:self-auto"
          >
            <Printer className="w-4 h-4" />
            Imprimir Relação A4
          </button>
        </div>

        {/* Botões de Filtro Rápido */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
          <button
            onClick={() => setTipoFiltro('hoje')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              tipoFiltro === 'hoje'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Hoje ({totalHoje})
          </button>

          <button
            onClick={() => setTipoFiltro('semana')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              tipoFiltro === 'semana'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Esta Semana ({totalSemana})
          </button>

          <button
            onClick={() => setTipoFiltro('mes')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              tipoFiltro === 'mes'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Por Mês ({MESES_NOMES[mesSelecionado - 1]}: {contagemPorMes[mesSelecionado] || 0})
          </button>

          <button
            onClick={() => setTipoFiltro('proximos_30')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              tipoFiltro === 'proximos_30'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Próximos 30 Dias ({totalProximos30})
          </button>

          {/* Seletor de Mês (quando tipo === 'mes') */}
          {tipoFiltro === 'mes' && (
            <select
              value={mesSelecionado}
              onChange={(e) => setMesSelecionado(Number(e.target.value))}
              className="ml-auto text-xs font-semibold bg-gray-50 border border-gray-300 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {MESES_NOMES.map((m, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {m} ({contagemPorMes[idx + 1] || 0})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Campo de Busca Textual */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar por nome ou congregação..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-50/50"
          />
        </div>
      </div>

      {/* ─── LISTAGEM TABULAR & IMPRESSÃO ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden print:border-none print:shadow-none print:rounded-none">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
              {getSubtituloPeriodo()}
            </span>
            <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
              {listaExibicao.length} aniversariante(s)
            </span>
          </div>
        </div>

        {listaExibicao.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <Cake className="w-10 h-10 mx-auto text-gray-300 mb-2 stroke-1" />
            <p className="text-sm font-medium text-gray-500">
              Nenhum aniversariante encontrado para o período selecionado.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 uppercase tracking-wider font-semibold print:bg-gray-100 print:text-black">
                  <th className="py-3 px-4 w-20 text-center">Dia</th>
                  <th className="py-3 px-4">Nome do Membro</th>
                  <th className="py-3 px-4 text-center">Idade</th>
                  <th className="py-3 px-4">Congregação</th>
                  <th className="py-3 px-4">Contato</th>
                  <th className="py-3 px-4 text-right print:hidden">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {listaExibicao.map((item) => {
                  const isHoje = item.isHoje;
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-gray-50/80 transition-colors print:break-inside-avoid ${
                        isHoje ? 'bg-amber-50/60 font-medium' : ''
                      }`}
                    >
                      {/* Dia */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center justify-center font-bold px-2 py-0.5 rounded text-xs ${
                            isHoje
                              ? 'bg-amber-500 text-white shadow-sm'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {String(item.dia).padStart(2, '0')}/{String(item.mes).padStart(2, '0')}
                        </span>
                        {isHoje && (
                          <span className="block text-[10px] font-bold text-amber-700 mt-0.5">
                            HOJE! 🎂
                          </span>
                        )}
                      </td>

                      {/* Nome */}
                      <td className="py-3 px-4 font-semibold text-gray-900">
                        {item.name}
                      </td>

                      {/* Idade */}
                      <td className="py-3 px-4 text-center text-gray-600 whitespace-nowrap">
                        {item.idadeCompletara} anos
                      </td>

                      {/* Congregação */}
                      <td className="py-3 px-4 text-gray-600">
                        {item.congregacao_nome || 'Sede / Principal'}
                      </td>

                      {/* Telefone */}
                      <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                        {item.telefone ? (
                          <span className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-gray-400 print:hidden" />
                            {item.telefone}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">Não informado</span>
                        )}
                      </td>

                      {/* Ações (WhatsApp) */}
                      <td className="py-3 px-4 text-right whitespace-nowrap print:hidden">
                        {item.telefone ? (
                          <a
                            href={getWhatsAppUrl(item.telefone, item.name)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-semibold rounded-lg transition border border-emerald-200"
                            title="Enviar parabéns pelo WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            WhatsApp
                          </a>
                        ) : (
                          <span className="text-[11px] text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Rodapé institucional impresso */}
        <div className="hidden print:block mt-8 pt-4 border-t border-gray-300 text-[11px] text-gray-500 text-center">
          Documento emitido eletronicamente pela Secretaria da Igreja através da plataforma Gestão Eklésia.
        </div>
      </div>
    </div>
  );
}
