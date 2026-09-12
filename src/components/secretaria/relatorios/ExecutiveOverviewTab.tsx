'use client';

import Link from 'next/link';
import {
  Users,
  UserCheck,
  UserPlus,
  Calendar,
  Baby,
  Cross,
  Award,
  AlertTriangle,
  FileText,
  PhoneCall,
  MapPin,
  Camera,
  MailCheck,
  ChevronRight,
} from 'lucide-react';
import type { ExecutiveMetrics } from '@/services/secretary-reports-service';

interface ExecutiveOverviewTabProps {
  metrics: ExecutiveMetrics;
  congregacaoNome?: string | null;
  onNavigateToTab?: (tabId: string) => void;
}

export default function ExecutiveOverviewTab({
  metrics,
  congregacaoNome,
}: ExecutiveOverviewTabProps) {
  const {
    totalMembros,
    membrosAtivos,
    membrosInativos,
    membrosTransferidos,
    membrosFalecidos,
    totalCongregados,
    totalCriancas,
    totalMinistros,
    novosMembrosMes,
    novosMembrosAno,
    batismosAno,
    alertas,
  } = metrics;

  const totalGeralPessoas = totalMembros + totalCongregados + totalCriancas + totalMinistros;
  const percentAtivos = totalGeralPessoas > 0 ? ((membrosAtivos / totalGeralPessoas) * 100).toFixed(1) : '100';

  const totalAlertas =
    alertas.semCpf +
    alertas.semDataNascimento +
    alertas.semTelefone +
    alertas.semEndereco +
    alertas.semFoto +
    alertas.cartasPendentes;

  return (
    <div className="space-y-6">
      {/* ─── BANNER EXECUTIVO & ESCOPO ────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#123b63] to-[#1c558c] rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white backdrop-blur-sm">
              Visão Gerencial
            </span>
            {congregacaoNome && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">
                {congregacaoNome}
              </span>
            )}
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">
            Painel Executivo da Secretaria
          </h2>
          <p className="text-sm text-blue-100 mt-1">
            Métricas de membros, distribuição eclesiástica e alertas de integridade cadastral.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/15 text-center min-w-[110px]">
            <p className="text-xs text-blue-200 font-medium">Engajamento</p>
            <p className="text-xl font-bold text-white mt-0.5">{percentAtivos}%</p>
            <p className="text-[10px] text-blue-200">ativos</p>
          </div>
        </div>
      </div>

      {/* ─── LINHA 1: KPIS PRINCIPAIS DE MEMBRESIA ────────────────────────────── */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-[#123b63]" />
          Corpo de Membros & Movimentação
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Membros */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Total de Membros
              </span>
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-[#123b63] mt-2">{totalMembros}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
              <span className="text-emerald-600 font-medium">{membrosAtivos} ativos</span>
              <span>•</span>
              <span className="text-gray-400">{membrosInativos} inativos</span>
              {(membrosTransferidos > 0 || membrosFalecidos > 0) && (
                <>
                  <span>•</span>
                  <span className="text-blue-500">{membrosTransferidos} transf.</span>
                  {membrosFalecidos > 0 && <span className="text-gray-400">/ {membrosFalecidos} falec.</span>}
                </>
              )}
            </div>
          </div>

          {/* Membros Ativos */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Membros Ativos
              </span>
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <UserCheck className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-emerald-600 mt-2">{membrosAtivos}</p>
            <p className="mt-2 text-xs text-gray-500">
              Regularizados na comunhão
            </p>
          </div>

          {/* Novos no Mês */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Novos no Mês
              </span>
              <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <UserPlus className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-indigo-600 mt-2">{novosMembrosMes}</p>
            <p className="mt-2 text-xs text-gray-500">
              Cadastrados neste mês corrente
            </p>
          </div>

          {/* Novos no Ano */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Novos no Ano
              </span>
              <div className="w-9 h-9 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-cyan-700 mt-2">{novosMembrosAno}</p>
            <p className="mt-2 text-xs text-gray-500">
              Acumulado no ano atual
            </p>
          </div>
        </div>
      </div>

      {/* ─── LINHA 2: KPIS ECLESIÁSTICOS E DE CLASSE ──────────────────────────── */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
          <Award className="w-4 h-4 text-[#123b63]" />
          Segmentação Eclesiástica & Atos Pastorais
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Congregados */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Congregados
              </span>
              <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-amber-600 mt-2">{totalCongregados}</p>
            <p className="mt-2 text-xs text-gray-500">
              Frequentadores em integração
            </p>
          </div>

          {/* Crianças */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Crianças
              </span>
              <div className="w-9 h-9 rounded-lg bg-pink-50 text-pink-600 flex items-center justify-center">
                <Baby className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-pink-600 mt-2">{totalCriancas}</p>
            <p className="mt-2 text-xs text-gray-500">
              Menores de 12 anos cadastrados
            </p>
          </div>

          {/* Ministros / Oficiais */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Ministros / Liderança
              </span>
              <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <Award className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-purple-600 mt-2">{totalMinistros}</p>
            <p className="mt-2 text-xs text-gray-500">
              Corpo pastoral e ministerial
            </p>
          </div>

          {/* Batismos no Ano */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Batismos no Ano
              </span>
              <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                <Cross className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-teal-600 mt-2">{batismosAno}</p>
            <p className="mt-2 text-xs text-gray-500">
              Atos de batismo realizados
            </p>
          </div>
        </div>
      </div>

      {/* ─── PAINEL DE ALERTAS ADMINISTRATIVOS E PENDÊNCIAS ──────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                Painel de Alertas e Integridade Cadastral
              </h3>
              <p className="text-xs text-gray-500">
                Monitoramento contínuo de pendências nos registros dos membros
              </p>
            </div>
          </div>

          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              totalAlertas === 0
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {totalAlertas === 0 ? 'Base 100% Completa' : `${totalAlertas} pendências detectadas`}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Sem CPF */}
          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/60 hover:bg-gray-50 transition-colors flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Cadastros sem CPF</p>
                <p className="text-lg font-bold text-gray-900 mt-0.5">{alertas.semCpf}</p>
              </div>
            </div>
            {alertas.semCpf > 0 && (
              <span className="text-[11px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded">
                Atenção
              </span>
            )}
          </div>

          {/* Sem Nascimento */}
          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/60 hover:bg-gray-50 transition-colors flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Sem Data de Nascimento</p>
                <p className="text-lg font-bold text-gray-900 mt-0.5">{alertas.semDataNascimento}</p>
              </div>
            </div>
            {alertas.semDataNascimento > 0 && (
              <span className="text-[11px] font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                Incompleto
              </span>
            )}
          </div>

          {/* Sem Telefone */}
          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/60 hover:bg-gray-50 transition-colors flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <PhoneCall className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Sem Telefone / WhatsApp</p>
                <p className="text-lg font-bold text-gray-900 mt-0.5">{alertas.semTelefone}</p>
              </div>
            </div>
            {alertas.semTelefone > 0 && (
              <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                Sem contato
              </span>
            )}
          </div>

          {/* Sem Endereço */}
          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/60 hover:bg-gray-50 transition-colors flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Sem Endereço / CEP</p>
                <p className="text-lg font-bold text-gray-900 mt-0.5">{alertas.semEndereco}</p>
              </div>
            </div>
            {alertas.semEndereco > 0 && (
              <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                Sem endereço
              </span>
            )}
          </div>

          {/* Sem Foto */}
          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/60 hover:bg-gray-50 transition-colors flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <Camera className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Cadastros sem Foto</p>
                <p className="text-lg font-bold text-gray-900 mt-0.5">{alertas.semFoto}</p>
              </div>
            </div>
            {alertas.semFoto > 0 && (
              <span className="text-[11px] font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                Sem foto
              </span>
            )}
          </div>

          {/* Cartas Pendentes */}
          <Link
            href="/secretaria/cartas"
            className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-100/60 transition-colors flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center">
                <MailCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-amber-900 font-semibold">Pedidos de Cartas Pendentes</p>
                <p className="text-lg font-bold text-amber-950 mt-0.5">{alertas.cartasPendentes}</p>
              </div>
            </div>
            <div className="flex items-center text-xs font-semibold text-amber-800 group-hover:translate-x-0.5 transition-transform">
              Ver
              <ChevronRight className="w-4 h-4 ml-0.5" />
            </div>
          </Link>
        </div>

        {/* Rodapé informativo */}
        <div className="mt-5 pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-gray-500 gap-2">
          <p>
            ℹ️ Os alertas refletem cadastros ativos que necessitam de atualização na Secretaria.
          </p>
          <Link
            href="/secretaria/membros"
            className="text-[#123b63] font-semibold hover:underline flex items-center gap-1 self-start sm:self-auto"
          >
            Acessar Ficha de Membros
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
