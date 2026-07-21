'use client';

import { useState, useEffect } from 'react';
import { authenticatedFetch } from '@/lib/api-client';
import { Activity, Clock, ShieldAlert, User, ArrowRight, DollarSign, CheckCircle2 } from 'lucide-react';

export interface CrmTimelineData {
  id: string;
  data: string;
  evento: string;
  usuario: string;
  descricao: string;
  cliente?: string;
}

interface CrmTimelineProps {
  ministryId?: string;
}

export default function CrmTimeline({ ministryId }: CrmTimelineProps) {
  const [timeline, setTimeline] = useState<CrmTimelineData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchTimeline() {
      try {
        let url = '/api/v1/admin/crm/timeline';
        if (ministryId) {
          url += `?ministryId=${encodeURIComponent(ministryId)}`;
        }
        const res = await authenticatedFetch(url);
        if (!res.ok) {
          throw new Error('Erro ao obter linha do tempo comercial');
        }
        const data = await res.json();
        setTimeline(data);
      } catch (err: any) {
        setError(err instanceof Error ? err : new Error(err?.message || 'Erro desconhecido'));
      } finally {
        setLoading(false);
      }
    }

    fetchTimeline();
  }, [ministryId]);

  if (loading) {
    return (
      <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 bg-gray-950 flex items-center justify-between">
          <div className="h-4 w-52 bg-gray-800 rounded animate-pulse" />
          <div className="h-5 w-20 bg-gray-800 rounded-full animate-pulse" />
        </div>
        <div className="p-6 space-y-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-4 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-gray-800 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-800 rounded w-1/4" />
                <div className="h-16 bg-gray-800 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-950/30 border border-red-900/50 text-red-400 rounded-xl text-sm">
        Erro ao carregar linha do tempo comercial.
      </div>
    );
  }

  if (timeline.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-900 border border-gray-800 rounded-xl text-center">
        <ShieldAlert className="h-10 w-10 text-gray-500 mb-2" />
        <h4 className="text-white font-semibold text-sm">Nenhuma atividade registrada</h4>
        <p className="text-gray-400 text-xs mt-1">Nenhum evento cronológico foi localizado para este registro.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-800 bg-gray-950 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Activity className="text-blue-500 h-4 w-4" />
          Linha do Tempo de Interações Comerciais
        </h3>
        <span className="text-[10px] bg-blue-950 text-blue-400 border border-blue-900 font-bold px-2 py-0.5 rounded-full">
          {timeline.length} eventos
        </span>
      </div>

      <div className="p-6 relative">
        {/* Linha vertical decorativa da timeline */}
        <div className="absolute left-[31px] top-6 bottom-6 w-0.5 bg-gray-800"></div>

        <div className="space-y-8 relative">
          {timeline.map((item) => {
            const hasUser = item.usuario && item.usuario.toLowerCase() !== 'sistema';
            let iconColor = 'text-blue-500 bg-blue-950 border-blue-900';
            
            if (item.evento.includes('Ativada') || item.evento.includes('Compensada')) {
              iconColor = 'text-emerald-500 bg-emerald-950 border-emerald-900';
            } else if (item.evento.includes('Cobrança') || item.evento.includes('Emitida')) {
              iconColor = 'text-amber-500 bg-amber-950 border-amber-900';
            }

            return (
              <div key={item.id} className="flex gap-4 relative items-start group">
                {/* Indicador / Icon Node */}
                <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 z-10 ${iconColor}`}>
                  {item.evento.includes('Ativada') || item.evento.includes('Convertida') ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : item.evento.includes('Cobrança') || item.evento.includes('Emitida') || item.evento.includes('Pago') ? (
                    <DollarSign className="h-4 w-4" />
                  ) : item.evento.includes('Interação') || item.evento.includes('Registrada') ? (
                    <Activity className="h-4 w-4" />
                  ) : (
                    <Clock className="h-4 w-4" />
                  )}
                </div>

                <div className="flex-1 bg-gray-900/40 hover:bg-gray-900/70 border border-gray-800 rounded-xl p-4 transition duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-800 pb-2 mb-2.5">
                    <div>
                      <span className="text-xs font-bold text-gray-400 block tracking-wider uppercase">
                        {new Date(item.data).toLocaleString('pt-BR')}
                      </span>
                      <h4 className="text-sm font-bold text-white mt-0.5">{item.evento}</h4>
                    </div>

                    {hasUser && (
                      <span className="flex items-center gap-1.5 text-[10px] text-blue-400 font-bold bg-blue-950/40 border border-blue-900/50 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                        <User className="h-3 w-3" />
                        {item.usuario}
                      </span>
                    )}
                  </div>

                  <p className="text-gray-300 text-xs leading-relaxed">{item.descricao}</p>

                  {item.cliente && (
                    <div className="mt-2.5 pt-2 border-t border-gray-800 flex items-center gap-1 text-[10px] text-gray-500">
                      <ArrowRight className="h-3 w-3 text-blue-500" />
                      <span>Origem: <strong>{item.cliente}</strong></span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
