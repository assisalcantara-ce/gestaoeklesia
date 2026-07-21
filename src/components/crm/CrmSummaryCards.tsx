'use client';

import { useCrmSummary } from '@/hooks/useCrmSummary';
import ExecutiveMetricCard from '@/components/dashboard/ExecutiveMetricCard';
import { 
  Users, 
  Flame, 
  CheckCircle2, 
  RefreshCw, 
  Clock, 
  Briefcase, 
  XCircle 
} from 'lucide-react';

export default function CrmSummaryCards() {
  const { data, loading, error } = useCrmSummary();

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-800 rounded-xl border border-gray-700/50"></div>
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 bg-red-950/30 border border-red-900/50 text-red-400 rounded-xl text-sm">
        Erro ao carregar indicadores executivos do CRM comercial.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-6">
      <ExecutiveMetricCard
        value={data.totalLeads}
        title="Leads"
        subtitle="Pré-cadastros sem negociação"
        color="indigo"
        icon={Users}
      />
      <ExecutiveMetricCard
        value={data.totalTrials}
        title="Trials"
        subtitle="Período experimental ativo"
        color="blue"
        icon={Flame}
      />
      <ExecutiveMetricCard
        value={data.totalClientesAtivos}
        title="Clientes Ativos"
        subtitle="Ministérios em produção"
        color="emerald"
        icon={CheckCircle2}
      />
      <ExecutiveMetricCard
        value={data.totalRenovacoes}
        title="Renovações"
        subtitle="Vencimento nos próximos 30 dias"
        color="amber"
        icon={RefreshCw}
      />
      <ExecutiveMetricCard
        value={data.totalCobrancasPendentes}
        title="Cobranças Pendentes"
        subtitle="Faturas in aberto"
        color="rose"
        icon={Clock}
      />
      <ExecutiveMetricCard
        value={data.totalNegociacoes}
        title="Negociações"
        subtitle="Funil comercial ativo"
        color="indigo"
        icon={Briefcase}
      />
      <ExecutiveMetricCard
        value={data.totalCancelados}
        title="Cancelados / Expirados"
        subtitle="Trials encerrados ou assinaturas canceladas"
        color="slate"
        icon={XCircle}
      />
    </div>
  );
}
