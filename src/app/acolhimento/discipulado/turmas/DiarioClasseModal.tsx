import React, { useState } from 'react';
import { X, CheckSquare, Square, Loader2 } from 'lucide-react';
import { LicaoCpad, TurmaAlunoMatricula } from '@/services/discipulado-pedagogico-service';

interface DiarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  turma: any;
  alunos: TurmaAlunoMatricula[];
  catalogoLicoes: LicaoCpad[];
  onSalvarDiario: (payload: any) => Promise<void>;
}

export default function DiarioClasseModal({
  isOpen,
  onClose,
  turma,
  alunos,
  catalogoLicoes,
  onSalvarDiario,
}: DiarioModalProps) {
  const [licaoId, setLicaoId] = useState('');
  const [dataAula, setDataAula] = useState(new Date().toISOString().slice(0, 10));
  const [statusAula, setStatusAula] = useState<'realizada' | 'cancelada'>('realizada');
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [conteudoMinistrado, setConteudoMinistrado] = useState('');
  const [validarPedagogico, setValidarPedagogico] = useState(false);
  const [chamadas, setChamadas] = useState<{ [jornadaId: string]: 'presente' | 'ausente' | 'falta_justificada' }>(() => {
    const initial: any = {};
    alunos.forEach((a) => {
      initial[a.jornada_id] = 'presente';
    });
    return initial;
  });
  const [salvando, setSalvando] = useState(false);

  if (!isOpen || !turma) return null;

  const handleTogglePresenca = (jornadaId: string) => {
    setChamadas((prev) => ({
      ...prev,
      [jornadaId]: prev[jornadaId] === 'presente' ? 'ausente' : 'presente',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licaoId) {
      alert('Selecione a lição ministrada.');
      return;
    }

    setSalvando(true);
    try {
      const payloadChamadas = alunos.map((aluno) => ({
        jornada_id: aluno.jornada_id,
        member_id: aluno.member_id,
        status: chamadas[aluno.jornada_id] || 'presente',
      }));

      await onSalvarDiario({
        turmaId: turma.id,
        licaoId,
        professorId: turma.professor_titular_id,
        dataAula,
        statusAula,
        motivoCancelamento: statusAula === 'cancelada' ? motivoCancelamento : null,
        chamadas: payloadChamadas,
        validarPedagogicoPresentes: validarPedagogico,
        conteudoMinistrado: conteudoMinistrado || null,
      });
      onClose();
    } catch (err: any) {
      alert(err.message || 'Erro ao registrar diário de aula.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl border border-slate-200/90 shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Diário de Classe & Frequência — {turma.nome}
            </h3>
            <p className="text-xs text-slate-500">
              Professor Titular: <strong className="text-slate-700">{turma.professor_titular?.name || 'Não informado'}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                Lição do Currículo CPAD *
              </label>
              <select
                value={licaoId}
                onChange={(e) => setLicaoId(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
              >
                <option value="">Selecione a lição...</option>
                {catalogoLicoes.map((lic) => (
                  <option key={lic.id} value={lic.id}>
                    {lic.identificador_referencia} — {lic.titulo_padrao}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                Data do Encontro *
              </label>
              <input
                type="date"
                value={dataAula}
                onChange={(e) => setDataAula(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                Situação da Aula
              </label>
              <select
                value={statusAula}
                onChange={(e) => setStatusAula(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
              >
                <option value="realizada">Aula Realizada com Sucesso</option>
                <option value="cancelada">Aula Cancelada (Feriado/Evento)</option>
              </select>
            </div>

            {statusAula === 'cancelada' && (
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  Motivo do Cancelamento
                </label>
                <input
                  type="text"
                  value={motivoCancelamento}
                  onChange={(e) => setMotivoCancelamento(e.target.value)}
                  placeholder="Ex: Feriado congregacional ou congresso"
                  required={statusAula === 'cancelada'}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
              Conteúdo / Resumo Ministrado (Opcional)
            </label>
            <input
              type="text"
              value={conteudoMinistrado}
              onChange={(e) => setConteudoMinistrado(e.target.value)}
              placeholder="Ex: Ênfase em oração e leitura bíblica diária..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
            />
          </div>

          {statusAula === 'realizada' && (
            <>
              {/* Lista de Chamada dos Alunos */}
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Chamada dos Alunos Matriculados ({alunos.length})
                </label>
                {alunos.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-xl border border-slate-200">
                    Nenhum aluno matriculado nesta turma ainda.
                  </p>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-48 overflow-y-auto">
                    {alunos.map((a) => {
                      const isPresente = chamadas[a.jornada_id] === 'presente';
                      return (
                        <div
                          key={a.id}
                          onClick={() => handleTogglePresenca(a.jornada_id)}
                          className="p-3 bg-white hover:bg-slate-50 cursor-pointer flex items-center justify-between transition text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            {isPresente ? (
                              <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300 shrink-0" />
                            )}
                            <span className="font-semibold text-slate-900">{a.member?.name || 'Aluno'}</span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              isPresente ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {isPresente ? 'Presente' : 'Ausente'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Opção Expressa de Validação Pedagógica */}
              <div className="p-3.5 bg-teal-50/70 border border-teal-200/90 rounded-xl">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={validarPedagogico}
                    onChange={(e) => setValidarPedagogico(e.target.checked)}
                    className="mt-0.5 rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-teal-950 block">
                      Validar conclusão pedagógica desta lição para os presentes agora?
                    </span>
                    <span className="text-[11px] text-teal-800 block leading-relaxed mt-0.5">
                      Presença em aula registra apenas a assiduidade. Marque esta opção caso os alunos presentes já tenham cumprido os exercícios e a compreensão exigida pelo currículo.
                    </span>
                  </div>
                </label>
              </div>
            </>
          )}

          {/* Rodapé de Ações */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {salvando && <Loader2 size={13} className="animate-spin text-white" />}
              <span>Salvar Diário de Classe</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
