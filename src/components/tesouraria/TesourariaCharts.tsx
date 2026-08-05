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
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
            Fluxo de Arrecadação Geral
          </h3>
          <p className="text-xs text-gray-400">Evolução diária de Entradas vs Saídas no período</p>
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorEntradas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorSaidas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="dia"
                tickLine={false}
                axisLine={false}
                stroke="#94a3b8"
                fontSize={10}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                stroke="#94a3b8"
                fontSize={10}
                tickFormatter={(v) => `R$ ${v}`}
              />
              <Tooltip
                formatter={(value: any) => [fmtBRL(Number(value)), '']}
                contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" />
              <Area
                name="Entradas"
                type="monotone"
                dataKey="entradas"
                stroke="#16a34a"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorEntradas)"
              />
              <Area
                name="Saídas"
                type="monotone"
                dataKey="saidas"
                stroke="#ef4444"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorSaidas)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gráfico 2: Evolução dos Dízimos */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
            Evolução de Dízimos
          </h3>
          <p className="text-xs text-gray-400">Evolução diária de receitas classificadas como dízimo</p>
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="dia"
                tickLine={false}
                axisLine={false}
                stroke="#94a3b8"
                fontSize={10}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                stroke="#94a3b8"
                fontSize={10}
                tickFormatter={(v) => `R$ ${v}`}
              />
              <Tooltip
                formatter={(value: any) => [fmtBRL(Number(value)), 'Dízimos']}
                contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}
              />
              <Bar
                name="Dízimos"
                dataKey="dizimos"
                fill="#123b63"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
