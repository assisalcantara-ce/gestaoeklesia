import { X, CheckCircle2, Clock, UserCheck } from 'lucide-react';
import { LicaoCpad } from '@/services/discipulado-pedagogico-service';

interface ProntuarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  progressoData: {
    jornada: any;
    total_validadas: number;
    licoes_validadas: any[];
    historico_chamadas: any[];
  } | null;
  catalogoLicoes: LicaoCpad[];
  onOpenReposicao: (licao: LicaoCpad) => void;
}

export default function ProntuarioPedagogicoModal({
  isOpen,
  onClose,
  progressoData,
  catalogoLicoes,
  onOpenReposicao,
}: ProntuarioModalProps) {
  if (!isOpen || !progressoData) return null;

  const { jornada, total_validadas, licoes_validadas, historico_chamadas } = progressoData;
  const isCompletoPedagogico = total_validadas >= 26;

  // Mapa de lições concluídas para lookup O(1)
  const concluidasMap = new Map<number, any>();
  licoes_validadas.forEach((item) => {
    if (item.licao?.numero) {
      concluidasMap.set(item.licao.numero, item);
    }
  });

  const vol1 = catalogoLicoes.filter((l) => l.volume === 1);
  const vol2 = catalogoLicoes.filter((l) => l.volume === 2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl border border-slate-200/90 shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-800 border border-teal-200 flex items-center justify-center font-bold text-sm shadow-2xs">
              {jornada.member?.name ? jornada.member.name.slice(0, 2).toUpperCase() : 'DC'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Prontuário Pedagógico — {jornada.member?.name || 'Discípulo'}
                </h3>
                {isCompletoPedagogico ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Formação Completa (26/26)
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1">
                    <Clock size={12} /> {total_validadas}/26 Lições
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Fase: <strong className="text-slate-700 capitalize">{jornada.fase.replace('_', ' ')}</strong> • Status da Jornada: <strong className="text-slate-700 capitalize">{jornada.status}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Banner Informativo sobre Não Encerramento da Jornada */}
        {isCompletoPedagogico && (
          <div className="mx-5 mt-4 p-3.5 bg-emerald-50 border border-emerald-200/90 rounded-xl text-emerald-900 text-xs flex items-start gap-2.5">
            <UserCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Formação Pedagógica Concluída!</p>
              <p className="text-emerald-800 text-[11px] leading-relaxed mt-0.5">
                O discípulo completou as 26 lições canônicas. <strong>A jornada permanece ATIVA</strong> aguardando aprovação na Entrevista Pastoral, realização do Batismo/Aclamação e homologação pela Secretaria.
              </p>
            </div>
          </div>
        )}

        {/* Conteúdo com Scroll */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          {/* Volume 1 */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-teal-600" />
                Volume 1: O Início da Caminhada Cristã (Lições 01 a 13)
              </h4>
              <span className="text-xs font-semibold text-slate-500">
                {vol1.filter((l) => concluidasMap.has(l.numero)).length} de 13 validadas
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {vol1.map((licao) => {
                const conclusao = concluidasMap.get(licao.numero);
                const isConcluida = Boolean(conclusao);

                return (
                  <div
                    key={licao.id}
                    className={`p-3 rounded-xl border transition ${
                      isConcluida
                        ? 'bg-teal-50/40 border-teal-200'
                        : 'bg-slate-50/70 border-slate-200 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-[11px] font-bold text-slate-600">
                        {licao.identificador_referencia}
                      </span>
                      {isConcluida ? (
                        <span className="text-[10px] font-bold text-teal-800 bg-teal-100/80 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <CheckCircle2 size={10} /> Validada
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onOpenReposicao(licao)}
                          className="text-[10px] font-bold text-teal-700 hover:text-teal-900 bg-white border border-teal-300 px-1.5 py-0.5 rounded shadow-2xs hover:bg-teal-50 transition cursor-pointer"
                        >
                          + Validar
                        </button>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-slate-900 mt-1 line-clamp-1">
                      {licao.titulo_padrao}
                    </p>
                    {isConcluida && (
                      <p className="text-[10px] text-slate-500 mt-1">
                        Em {new Date(conclusao.data_validacao).toLocaleDateString('pt-BR')} • {conclusao.modalidade_conclusao.replace('_', ' ')}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Volume 2 */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-600" />
                Volume 2: O Amadurecimento Cristão (Lições 14 a 26)
              </h4>
              <span className="text-xs font-semibold text-slate-500">
                {vol2.filter((l) => concluidasMap.has(l.numero)).length} de 13 validadas
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {vol2.map((licao) => {
                const conclusao = concluidasMap.get(licao.numero);
                const isConcluida = Boolean(conclusao);

                return (
                  <div
                    key={licao.id}
                    className={`p-3 rounded-xl border transition ${
                      isConcluida
                        ? 'bg-teal-50/40 border-teal-200'
                        : 'bg-slate-50/70 border-slate-200 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-[11px] font-bold text-slate-600">
                        {licao.identificador_referencia}
                      </span>
                      {isConcluida ? (
                        <span className="text-[10px] font-bold text-teal-800 bg-teal-100/80 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <CheckCircle2 size={10} /> Validada
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onOpenReposicao(licao)}
                          className="text-[10px] font-bold text-teal-700 hover:text-teal-900 bg-white border border-teal-300 px-1.5 py-0.5 rounded shadow-2xs hover:bg-teal-50 transition cursor-pointer"
                        >
                          + Validar
                        </button>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-slate-900 mt-1 line-clamp-1">
                      {licao.titulo_padrao}
                    </p>
                    {isConcluida && (
                      <p className="text-[10px] text-slate-500 mt-1">
                        Em {new Date(conclusao.data_validacao).toLocaleDateString('pt-BR')} • {conclusao.modalidade_conclusao.replace('_', ' ')}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Histórico de Frequência e Chamadas */}
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5">
              Histórico de Assiduidade e Chamadas
            </h4>
            {historico_chamadas.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Nenhum registro de chamada em turma para este discípulo.</p>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                {historico_chamadas.map((ch: any) => (
                  <div key={ch.id} className="p-3 bg-white text-xs flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800">
                        {ch.aula?.licao?.titulo_padrao || 'Lição de Turma'}
                      </span>
                      <span className="text-slate-500 ml-2">
                        Turma: {ch.aula?.turma?.nome || '—'}
                      </span>
                      {ch.justificativa && (
                        <p className="text-[11px] text-amber-700 mt-0.5">Motivo: {ch.justificativa}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          ch.status_presenca === 'presente'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ch.status_presenca === 'falta_justificada'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {ch.status_presenca.replace('_', ' ')}
                      </span>
                      <span className="block text-[10px] text-slate-400 mt-0.5">
                        {ch.aula?.data_aula ? new Date(ch.aula.data_aula).toLocaleDateString('pt-BR') : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Rodapé */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-xs transition cursor-pointer"
          >
            Fechar Prontuário
          </button>
        </div>
      </div>
    </div>
  );
}
