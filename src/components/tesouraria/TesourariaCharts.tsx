'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from 'recharts';

interface Lancamento {
  id: string;
  data_lancamento: string;
  tipo_movimento: 'entrada' | 'saida';
  tipo_recebimento: string;
  valor: number;
}

interface TesourariaChartsProps {
  lancamentos: Lancamento[];
  fmtBRL: (val: number) => string;
  filtroMes: string;
}

export default function TesourariaCharts({ lancamentos, fmtBRL, filtroMes }: TesourariaChartsProps) {
  // Processar dados agrupados por dia do mês
  const chartData = useMemo(() => {
    const [ano, mes] = filtroMes.split('-').map(Number);
    const diasNoMes = new Date(ano, mes, 0).getDate();
    
    // Inicializar mapa de dias
    const mapDias: Record<number, { dia: string; entradas: number; saidas: number; dizimos: number }> = {};
    for (let d = 1; d <= diasNoMes; d++) {
      const diaStr = String(d).padStart(2, '0');
      mapDias[d] = {
        dia: `${diaStr}/${String(mes).padStart(2, '0')}`,
        entradas: 0,
        saidas: 0,
        dizimos: 0,
      };
    }

    // Acumular valores dos lançamentos
    lancamentos.forEach((l) => {
      const data = new Date(l.data_lancamento + 'T00:00:00');
      const dia = data.getDate();
      
      if (mapDias[dia]) {
        const valor = Number(l.valor) || 0;
        if (l.tipo_movimento === 'entrada') {
          mapDias[dia].entradas += valor;
          if (l.tipo_recebimento === 'dizimo') {
            mapDias[dia].dizimos += valor;
          }
        } else if (l.tipo_movimento === 'saida') {
          mapDias[dia].saidas += valor;
        }
      }
    });

    return Object.values(mapDias);
  }, [lancamentos, filtroMes]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Gráfico 1: Evolução da Arrecadação Geral (Entradas vs Saídas) */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-5 transition hover:shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 border border-teal-100 text-teal-700">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 tracking-wide uppercase">
                Fluxo de Arrecadação Geral
              </h3>
              <p className="text-xs text-slate-500 font-medium">Evolução diária de Entradas vs Saídas</p>
            </div>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 border border-slate-200">
            Período Mensal
          </span>
        </div>
        <div className="h-72 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorEntradas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorSaidas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#e11d48" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#e11d48" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="dia"
                tickLine={false}
                axisLine={false}
                stroke="#64748b"
                fontSize={11}
                fontWeight={500}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                stroke="#64748b"
                fontSize={11}
                fontWeight={500}
                tickFormatter={(v) => `R$ ${v}`}
              />
              <Tooltip
                formatter={(value: any) => [fmtBRL(Number(value)), '']}
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.03)',
                  padding: '10px 14px',
                  fontWeight: 600,
                  color: '#0f172a',
                }}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" />
              <Area
                name="Entradas"
                type="monotone"
                dataKey="entradas"
                stroke="#16a34a"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorEntradas)"
              />
              <Area
                name="Saídas"
                type="monotone"
                dataKey="saidas"
                stroke="#e11d48"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorSaidas)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gráfico 2: Evolução dos Dízimos */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-5 transition hover:shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 border border-purple-100 text-purple-700">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 tracking-wide uppercase">
                Evolução de Dízimos
              </h3>
              <p className="text-xs text-slate-500 font-medium">Distribuição diária de contribuições</p>
            </div>
          </div>
          <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700 border border-purple-200">
            Dizimistas
          </span>
        </div>
        <div className="h-72 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="dia"
                tickLine={false}
                axisLine={false}
                stroke="#64748b"
                fontSize={11}
                fontWeight={500}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                stroke="#64748b"
                fontSize={11}
                fontWeight={500}
                tickFormatter={(v) => `R$ ${v}`}
              />
              <Tooltip
                formatter={(value: any) => [fmtBRL(Number(value)), 'Dízimos']}
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.03)',
                  padding: '10px 14px',
                  fontWeight: 600,
                  color: '#0f172a',
                }}
              />
              <Bar
                name="Dízimos"
                dataKey="dizimos"
                fill="#7c3aed"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
