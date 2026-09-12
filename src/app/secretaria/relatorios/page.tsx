'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  Cake,
  MailCheck,
  Cross,
  SlidersHorizontal,
  RefreshCw,
  Building2,
} from 'lucide-react';
import PageLayout from '@/components/PageLayout';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { useUserContext } from '@/hooks/useUserContext';
import { createClient } from '@/lib/supabase-client';
import { authenticatedFetch } from '@/lib/api-client';
import { obterEstruturaOrganizacionalService } from '@/services/estrutura-organizacional-service';
import ExecutiveOverviewTab from '@/components/secretaria/relatorios/ExecutiveOverviewTab';
import BirthdaysReportTab from '@/components/secretaria/relatorios/BirthdaysReportTab';
import MembersDemographicsTab from '@/components/secretaria/relatorios/MembersDemographicsTab';
import GrowthMovementTab from '@/components/secretaria/relatorios/GrowthMovementTab';
import MinisterialLettersReportTab from '@/components/secretaria/relatorios/MinisterialLettersReportTab';
import BaptismsAndActsReportTab from '@/components/secretaria/relatorios/BaptismsAndActsReportTab';
import CustomReportBuilderTab from '@/components/secretaria/relatorios/CustomReportBuilderTab';

// ─── DEFINIÇÃO DE ABAS ─────────────────────────────────────────────────────────

type TabId =
  | 'executiva'
  | 'membros'
  | 'crescimento'
  | 'aniversariantes'
  | 'cartas'
  | 'batismos'
  | 'personalizados';

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: 'executiva', label: 'Visão Executiva', icon: LayoutDashboard },
  { id: 'membros', label: 'Membros & Demografia', icon: Users },
  { id: 'crescimento', label: 'Crescimento & Movimentação', icon: TrendingUp },
  { id: 'aniversariantes', label: 'Aniversariantes', icon: Cake },
  { id: 'cartas', label: 'Cartas Ministeriais', icon: MailCheck },
  { id: 'batismos', label: 'Batismos & Atos', icon: Cross },
  { id: 'personalizados', label: 'Relatórios Personalizados', icon: SlidersHorizontal },
];

export default function RelatoriosSecretariaPage() {
  const { bloqueado } = useRequireModulo('gestao');
  const userCtx = useUserContext();

  const [activeTab, setActiveTab] = useState<TabId>('executiva');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dados consolidados vindos do summary endpoint
  const [summaryData, setSummaryData] = useState<any>(null);

  // Lista de congregações para filtro
  const [congregacoes, setCongregacoes] = useState<{ id: string; nome: string }[]>([]);
  const [selectedCongregacao, setSelectedCongregacao] = useState<string>('todas');

  // Carregar lista de congregações
  useEffect(() => {
    if (!userCtx.ministryId) return;
    const supabase = createClient();

    obterEstruturaOrganizacionalService(userCtx.ministryId, supabase)
      .then((orgService) => {
        const div1Options = orgService.getOptionsFormatadas(1);
        setCongregacoes(div1Options.map((opt) => ({ id: opt.id, nome: opt.nome })));
      })
      .catch((err) => {
        console.error('Erro ao carregar estrutura organizacional:', err);
      });
  }, [userCtx.ministryId]);

  // Carregar dados agregados do endpoint /api/v1/secretaria/relatorios/summary
  const loadSummaryData = useCallback(async () => {
    try {
      setError(null);
      const url = new URL('/api/v1/secretaria/relatorios/summary', window.location.origin);
      if (selectedCongregacao && selectedCongregacao !== 'todas') {
        url.searchParams.set('congregacao_id', selectedCongregacao);
      }

      const res = await authenticatedFetch(url.toString(), {
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Erro HTTP ${res.status}`);
      }

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Falha ao carregar dados dos relatórios.');
      }

      setSummaryData(json.data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados da Central de Relatórios.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCongregacao]);

  useEffect(() => {
    if (userCtx.loading) return;
    setLoading(true);
    loadSummaryData();
  }, [userCtx.loading, loadSummaryData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadSummaryData();
  };

  if (bloqueado) return null;

  const currentCongregacaoNome =
    selectedCongregacao === 'todas'
      ? 'Todas as Congregações'
      : congregacoes.find((c) => c.id === selectedCongregacao)?.nome || null;

  return (
    <PageLayout
      title="📋 Central de Relatórios"
      description="Inteligência gerencial, demografia e relatórios administrativos da Secretaria"
      activeMenu="relatorios-secretaria"
      headerExtra={
        <div className="flex items-center gap-2 print:hidden">
          {/* Seletor de Congregação */}
          {congregacoes.length > 0 && (
            <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 shadow-sm">
              <Building2 className="w-4 h-4 text-gray-400" />
              <select
                value={selectedCongregacao}
                onChange={(e) => setSelectedCongregacao(e.target.value)}
                className="text-xs font-semibold text-gray-700 bg-transparent focus:outline-none cursor-pointer"
              >
                <option value="todas">Todas as Congregações</option>
                {congregacoes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Botão de Atualizar */}
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="p-2 text-gray-600 hover:text-[#123b63] hover:bg-gray-100 rounded-xl border border-gray-200 transition bg-white shadow-sm"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#123b63]' : ''}`} />
          </button>
        </div>
      }
    >
      {/* ─── NAVEGAÇÃO DE ABAS ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-6 border-b border-gray-200 print:hidden no-scrollbar">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-[#123b63] text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 hover:border-gray-300'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-400'}`} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ─── ESTADOS DE CARREGAMENTO & ERRO ─────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-10 h-10 rounded-full border-4 border-[#123b63] border-t-transparent animate-spin mb-3" />
          <p className="text-xs font-medium text-gray-500">Consolidando relatórios da Secretaria...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-700">
          <p className="font-semibold text-sm">Falha ao carregar relatórios</p>
          <p className="text-xs text-red-600 mt-1">{error}</p>
          <button
            onClick={loadSummaryData}
            className="mt-3 px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition"
          >
            Tentar Novamente
          </button>
        </div>
      ) : (
        <>
          {/* ─── ABA 1: VISÃO EXECUTIVA ─────────────────────────────────────── */}
          {activeTab === 'executiva' && summaryData && (
            <ExecutiveOverviewTab
              metrics={summaryData.executiveMetrics}
              congregacaoNome={currentCongregacaoNome}
            />
          )}

          {/* ─── ABA 2: MEMBROS & DEMOGRAFIA ────────────────────────────────── */}
          {activeTab === 'membros' && summaryData && (
            <MembersDemographicsTab
              initialDemographics={summaryData.demographics}
              congregacaoId={selectedCongregacao}
              congregacaoNome={currentCongregacaoNome}
            />
          )}

          {/* ─── ABA 3: CRESCIMENTO & MOVIMENTAÇÃO ────────────────────────── */}
          {activeTab === 'crescimento' && summaryData && (
            <GrowthMovementTab
              growthTrends={summaryData.growthTrends}
              metrics={summaryData.executiveMetrics}
              congregacaoNome={currentCongregacaoNome}
            />
          )}

          {/* ─── ABA 4: ANIVERSARIANTES ─────────────────────────────────────── */}
          {activeTab === 'aniversariantes' && summaryData && (
            <BirthdaysReportTab
              initialBirthdays={summaryData.aniversariantes}
              congregacaoNome={currentCongregacaoNome}
              ministryId={userCtx.ministryId || ''}
            />
          )}

          {/* ─── ABA 5: CARTAS MINISTERIAIS ─────────────────────────────────── */}
          {activeTab === 'cartas' && summaryData && (
            <MinisterialLettersReportTab
              initialLettersStats={summaryData.lettersStats}
              congregacaoId={selectedCongregacao}
              congregacaoNome={currentCongregacaoNome}
            />
          )}

          {/* ─── ABA 6: BATISMOS & ATOS ─────────────────────────────────────── */}
          {activeTab === 'batismos' && summaryData && (
            <BaptismsAndActsReportTab
              initialStats={summaryData.baptismsAndActs}
              congregacaoId={selectedCongregacao}
              congregacaoNome={currentCongregacaoNome}
            />
          )}

          {/* ─── ABA 7: RELATÓRIOS PERSONALIZADOS ──────────────────────────── */}
          {activeTab === 'personalizados' && (
            <CustomReportBuilderTab
              congregacaoId={selectedCongregacao}
              congregacaoNome={currentCongregacaoNome}
            />
          )}
        </>
      )}
    </PageLayout>
  );
}
