import React, { useState } from 'react';
import { X, Loader2, Sparkles } from 'lucide-react';
import { LicaoCpad } from '@/services/discipulado-pedagogico-service';

interface ReposicaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  licao: LicaoCpad | null;
  jornadaId: string;
  professores: any[];
  onSalvarValidacao: (payload: any) => Promise<void>;
}

export default function ReposicaoLicaoModal({
  isOpen,
  onClose,
  licao,
  jornadaId,
  professores,
  onSalvarValidacao,
}: ReposicaoModalProps) {
  const [validadorId, setValidadorId] = useState('');
  const [modalidade, setModalidade] = useState<string>('reposicao_individual');
  const [dataValidacao, setDataValidacao] = useState(new Date().toISOString().slice(0, 10));
  const [nota, setNota] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);

  if (!isOpen || !licao) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validadorId) {
      alert('Selecione o discipulador ou professor responsável pela validação.');
      return;
    }

    setSalvando(true);
    try {
      await onSalvarValidacao({
        jornadaId,
        licaoId: licao.id,
        validadorId,
        modalidade,
        dataValidacao,
        aproveitamentoNota: nota ? Number(nota) : null,
        observacoes: observacoes || null,
      });
      onClose();
    } catch (err: any) {
      alert(err.message || 'Erro ao validar lição.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white rounded-2xl border border-slate-200/90 shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-teal-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Validar Conclusão da Lição
              </h3>
              <p className="text-xs text-slate-600 font-medium">
                {licao.identificador_referencia} — {licao.titulo_padrao}
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

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
              Professor / Discipulador Validador *
            </label>
            <select
              value={validadorId}
              onChange={(e) => setValidadorId(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
            >
              <option value="">Selecione o membro autorizado da equipe...</option>
              {professores.map((p) => (
                <option key={p.member_id} value={p.member_id}>
                  {p.member?.name || 'Membro'} ({p.papel})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                Modalidade de Conclusão *
              </label>
              <select
                value={modalidade}
                onChange={(e) => setModalidade(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
              >
                <option value="reposicao_individual">Reposição Individual 1 a 1</option>
                <option value="discipulado_individual">Discipulado Individual Regular</option>
                <option value="reposicao_turma_externa">Reposição em Turma Externa</option>
                <option value="aproveitamento_estudos">Aproveitamento de Estudos</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                Data de Validação *
              </label>
              <input
                type="date"
                value={dataValidacao}
                onChange={(e) => setDataValidacao(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
              Nota / Avaliação (Opcional, 0 a 10)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="10"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ex: 9.5"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
              Observações Pedagógicas (Opcional)
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
              placeholder="Ex: Lição reposta na congregação polo ou após o culto..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition resize-none"
            />
          </div>

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
              <span>Confirmar Validação</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
