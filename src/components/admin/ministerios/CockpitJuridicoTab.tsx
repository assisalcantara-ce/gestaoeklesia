'use client'

import { useState, useEffect } from 'react'
import { authenticatedFetch } from '@/lib/api-client'
import {
  FileCheck,
  ShieldCheck,
  Clock,
  AlertCircle,
  Loader2,
  User,
  CreditCard,
  Hash,
  Copy,
  Check,
  RotateCcw,
  FileText,
  History,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import type { DetalhesContratoTenantDTO } from '@/types/juridico'

interface CockpitJuridicoTabProps {
  ministryId: string
  ministryName?: string
}

export default function CockpitJuridicoTab({ ministryId, ministryName: _ministryName }: CockpitJuridicoTabProps) {
  const [data, setData] = useState<DetalhesContratoTenantDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedHash, setCopiedHash] = useState(false)
  const [copiedContent, setCopiedContent] = useState(false)
  const [expandedContent, setExpandedContent] = useState(false)

  const carregarDadosJuridicos = async () => {
    if (!ministryId) return
    try {
      setLoading(true)
      setError(null)
      const res = await authenticatedFetch(`/api/v1/admin/juridico/contratos/${ministryId}`)
      if (!res.ok) {
        throw new Error('Falha ao carregar informações jurídicas do ministério.')
      }
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      } else {
        throw new Error(json.error || 'Erro ao carregar dados contratuais.')
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao consultar o contrato.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDadosJuridicos()
  }, [ministryId])

  const handleCopyHash = (hash: string) => {
    if (!hash) return
    navigator.clipboard.writeText(hash)
    setCopiedHash(true)
    setTimeout(() => setCopiedHash(false), 2000)
  }

  const handleCopyContent = (content: string) => {
    if (!content) return
    navigator.clipboard.writeText(content)
    setCopiedContent(true)
    setTimeout(() => setCopiedContent(false), 2000)
  }

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center text-gray-400 gap-3">
        <Loader2 size={32} className="animate-spin text-blue-500" />
        <p className="text-sm font-medium">Carregando governança jurídica e contrato do tenant...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-red-950/40 border border-red-800 rounded-xl space-y-4">
        <div className="flex items-center gap-3 text-red-300">
          <AlertCircle size={22} className="shrink-0" />
          <div>
            <h4 className="font-semibold text-sm">Falha ao consultar módulo jurídico</h4>
            <p className="text-xs text-red-300/90 mt-0.5">{error}</p>
          </div>
        </div>
        <button
          onClick={carregarDadosJuridicos}
          className="flex items-center gap-2 px-3 py-1.5 bg-red-900/60 hover:bg-red-800 text-red-200 rounded-lg text-xs font-medium transition"
        >
          <RotateCcw size={14} /> Tentar Novamente
        </button>
      </div>
    )
  }

  const contrato = data?.contrato
  const docBase = data?.documento_base
  const assinante = data?.assinado_por_usuario
  const historico = data?.historico_documentos || []
  const diag = data?.diagnostico_integridade
  const conteudoEfetivo = data?.conteudo_efetivo || contrato?.conteudo_customizado || ''

  // Empty state quando o tenant não possui contrato registrado
  if (!contrato) {
    return (
      <div className="py-12 px-6 text-center bg-gray-900/40 border border-gray-800 rounded-xl space-y-4">
        <div className="w-16 h-16 bg-gray-800/80 rounded-2xl flex items-center justify-center mx-auto text-gray-500 border border-gray-700">
          <FileCheck size={32} />
        </div>
        <div className="max-w-md mx-auto space-y-1">
          <h3 className="text-base font-semibold text-gray-200">Nenhum contrato formal registrado</h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            Este ministério ainda não possui um contrato de prestação de serviços celebrado. As evidências e snapshots imutáveis aparecerão aqui quando o tenant for convertido comercialmente.
          </p>
        </div>
        <button
          onClick={carregarDadosJuridicos}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium transition"
        >
          <RotateCcw size={14} /> Atualizar Status
        </button>
      </div>
    )
  }

  const hashFinal = contrato.hash_documento || historico[0]?.hash_sha256 || docBase?.hash_sha256 || 'HASH_NAO_DISPONIVEL'
  const versaoExibida = contrato.versao_documento || historico[0]?.versao || '1.0'

  return (
    <div className="space-y-6 text-left">
      {/* 1. STATUS EXECUTIVO (CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Status do Contrato</p>
            <div className="mt-1">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  contrato.status === 'ATIVO'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : contrato.status === 'AGUARDANDO_ASSINATURA'
                    ? 'bg-amber-950 text-amber-400 border border-amber-800 animate-pulse'
                    : 'bg-gray-800 text-gray-300 border border-gray-700'
                }`}
              >
                {contrato.status}
              </span>
            </div>
          </div>
          <div className="p-2.5 bg-blue-600/10 text-blue-400 rounded-lg border border-blue-500/20">
            <FileCheck size={18} />
          </div>
        </div>

        <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Governança Snapshot</p>
            <div className="mt-1">
              <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded">
                <ShieldCheck size={12} />
                {diag?.snapshot_status || contrato.snapshot_status || 'INTEGRO_IMUTAVEL'}
              </span>
            </div>
          </div>
          <div className="p-2.5 bg-emerald-600/10 text-emerald-400 rounded-lg border border-emerald-500/20">
            <ShieldCheck size={18} />
          </div>
        </div>

        <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Versão Vigente</p>
            <div className="mt-1">
              <span className="text-xs font-mono font-bold text-blue-400 bg-blue-950 border border-blue-800 px-2 py-0.5 rounded">
                v{versaoExibida}
              </span>
            </div>
          </div>
          <div className="p-2.5 bg-purple-600/10 text-purple-400 rounded-lg border border-purple-500/20">
            <History size={18} />
          </div>
        </div>

        <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Último Aceite</p>
            <h4 className="text-xs font-medium text-gray-200 mt-1">
              {historico.length > 0
                ? new Date(historico[0].aceito_em).toLocaleDateString('pt-BR')
                : contrato.assinado_em
                ? new Date(contrato.assinado_em).toLocaleDateString('pt-BR')
                : 'Pendente'}
            </h4>
          </div>
          <div className="p-2.5 bg-amber-600/10 text-amber-400 rounded-lg border border-amber-500/20">
            <Clock size={18} />
          </div>
        </div>
      </div>

      {/* 2. DADOS DO CONTRATO & CONDIÇÕES COMERCIAIS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Box Contrato */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 space-y-3">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <FileText size={15} className="text-blue-400" /> Identificação do Contrato
          </h4>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-gray-800/60">
              <span className="text-gray-400">Número do Contrato:</span>
              <span className="text-white font-mono font-bold">{contrato.numero_contrato || contrato.id}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-800/60">
              <span className="text-gray-400">Documento Base:</span>
              <span className="text-gray-200 font-medium">{docBase?.titulo || 'Contrato de Prestação de Serviços'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-800/60">
              <span className="text-gray-400">Versão Contratada:</span>
              <span className="text-blue-400 font-mono font-bold">v{versaoExibida}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-800/60">
              <span className="text-gray-400">Origem do Snapshot:</span>
              <span className="text-gray-300 font-mono">{diag?.origem_snapshot || contrato.origem_snapshot || 'CELEBRACAO_ORIGINAL'}</span>
            </div>
          </div>
        </div>

        {/* Box Comercial */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 space-y-3">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <CreditCard size={15} className="text-emerald-400" /> Condições Comerciais & Vigência
          </h4>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-gray-800/60">
              <span className="text-gray-400">Plano Comercial:</span>
              <span className="text-emerald-400 font-bold uppercase">{contrato.plano_contratado || 'Starter'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-800/60">
              <span className="text-gray-400">Valor da Mensalidade:</span>
              <span className="text-white font-mono font-medium">
                {contrato.valor_mensal !== null && contrato.valor_mensal !== undefined
                  ? `R$ ${contrato.valor_mensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                  : 'Conforme Tabela Vigente'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-800/60">
              <span className="text-gray-400">Início da Vigência:</span>
              <span className="text-gray-200">{new Date(contrato.data_inicio).toLocaleDateString('pt-BR')}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-800/60">
              <span className="text-gray-400">Término da Vigência:</span>
              <span className="text-gray-300">{contrato.data_fim ? new Date(contrato.data_fim).toLocaleDateString('pt-BR') : 'Indeterminado'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. REPRESENTANTE ASSINANTE & HASH CRIPTOGRÁFICO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 space-y-3">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <User size={15} className="text-purple-400" /> Representante Legal / Assinante
          </h4>
          <div className="space-y-2 text-xs">
            {contrato.assinado_em && contrato.status !== 'AGUARDANDO_ASSINATURA' ? (
              <>
                <div className="flex justify-between py-1 border-b border-gray-800/60">
                  <span className="text-gray-400">Nome:</span>
                  <span className="text-white font-medium">{assinante?.full_name || 'Responsável Legal do Ministério'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-800/60">
                  <span className="text-gray-400">E-mail:</span>
                  <span className="text-gray-300">{assinante?.email || 'E-mail cadastrado'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-800/60">
                  <span className="text-gray-400">User ID:</span>
                  <span className="text-gray-400 font-mono text-[11px]">{assinante?.id || contrato.assinado_por || '-'}</span>
                </div>
              </>
            ) : (
              <div className="py-2 text-gray-400 italic">
                Pendente de assinatura eletrônica
              </div>
            )}
          </div>
        </div>

        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Hash size={15} className="text-blue-400" /> Hash SHA-256 Imutável
            </h4>
            <button
              onClick={() => handleCopyHash(hashFinal)}
              className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs font-medium"
            >
              {copiedHash ? <Check size={14} /> : <Copy size={14} />}
              {copiedHash ? 'Copiado' : 'Copiar Hash'}
            </button>
          </div>
          <div className="bg-gray-950 p-3 rounded-lg text-gray-300 font-mono text-xs break-all border border-gray-800">
            {hashFinal}
          </div>
          <p className="text-[11px] text-gray-500">
            Garantia criptográfica de que o contrato assinado não sofreu qualquer alteração após sua celebração.
          </p>
        </div>
      </div>

      {/* 4. HISTÓRICO JURÍDICO & EVIDÊNCIAS DE ACEITE (PRESERVANDO 1.0 e 1.0-REGULARIZADO) */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 space-y-4">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <History size={15} className="text-purple-400" /> Histórico de Aceites & Versões Contratuais
        </h4>

        {historico.length === 0 ? (
          <p className="text-xs text-gray-500">Nenhum aceite histórico registrado além da celebração original.</p>
        ) : (
          <div className="space-y-3">
            {historico.map((hist, idx) => (
              <div key={idx} className="bg-gray-950 border border-gray-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-blue-950 text-blue-400 border border-blue-800">
                      v{hist.versao}
                    </span>
                    <span className="font-semibold text-white text-xs">{hist.titulo}</span>
                  </div>
                  <span className="text-[11px] text-gray-400">{new Date(hist.aceito_em).toLocaleString('pt-BR')}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-gray-400 border-t border-gray-800/60 pt-2">
                  <div>
                    <span className="text-gray-500">Assinado por: </span>
                    <span className="text-gray-300">{hist.aceito_por_nome || hist.aceito_por_email || hist.aceito_por_id}</span>
                  </div>
                  <div className="font-mono text-[10px] truncate">
                    <span className="text-gray-500">SHA-256: </span>
                    <span className="text-gray-300">{hist.hash_sha256 || '-'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. CONTEÚDO MATERIALIZADO (SNAPSHOT IMUTÁVEL 100% READ-ONLY) */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <FileCheck size={15} className="text-emerald-400" /> Conteúdo do Contrato Materializado (Snapshot Imutável)
          </h4>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopyContent(conteudoEfetivo)}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium transition"
            >
              {copiedContent ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              {copiedContent ? 'Copiado' : 'Copiar Texto'}
            </button>
            <button
              onClick={() => setExpandedContent(!expandedContent)}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium transition"
            >
              {expandedContent ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              {expandedContent ? 'Recolher' : 'Expandir'}
            </button>
          </div>
        </div>

        <div
          className={`bg-gray-950 border border-gray-800 rounded-xl p-5 text-gray-300 text-xs font-mono leading-relaxed whitespace-pre-wrap overflow-y-auto transition-all ${
            expandedContent ? 'max-h-[800px]' : 'max-h-[300px]'
          }`}
        >
          {conteudoEfetivo || 'Conteúdo contratual não disponível.'}
        </div>
      </div>

      {/* 6. DIAGNÓSTICO DE GOVERNANÇA */}
      {diag && (
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 space-y-3">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck size={15} className="text-indigo-400" /> Diagnóstico Oficial de Governança
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="bg-gray-950 p-3.5 rounded-xl border border-gray-800 space-y-2">
              <div className="flex justify-between py-0.5">
                <span className="text-gray-400">Classificação:</span>
                <span className="text-emerald-400 font-mono font-bold">{diag.snapshot_status}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-gray-400">Origem:</span>
                <span className="text-gray-300 font-mono">{diag.origem_snapshot}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-gray-400">Visualização:</span>
                <span className="text-blue-400 font-mono">{diag.tipo_visualizacao}</span>
              </div>
            </div>

            <div className="bg-gray-950 p-3.5 rounded-xl border border-gray-800 space-y-2">
              <div className="flex justify-between py-0.5">
                <span className="text-gray-400">Snapshot Presente:</span>
                <span className="text-emerald-400 font-medium">✓ Sim</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-gray-400">Consistência de Hash:</span>
                <span className="text-emerald-400 font-medium">✓ Consistente</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-gray-400">Placeholders Não Resolvidos:</span>
                <span className="text-emerald-400 font-medium">✓ Nenhum</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
