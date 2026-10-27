'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Calendar, Layers, RotateCcw } from 'lucide-react';
import { AgendaEvento } from './AgendaCalendar';

export type ModoExclusaoRecorrencia = 'somente_esta' | 'esta_e_proximas' | 'toda_serie';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  evento?: AgendaEvento | null;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: (modo?: ModoExclusaoRecorrencia) => void;
  onCancel: () => void;
}

export default function ConfirmDeleteModal({
  isOpen,
  evento,
  title = 'Confirmar Exclusão',
  message,
  confirmText = 'Excluir',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
}: ConfirmDeleteModalProps) {
  const [modo, setModo] = useState<ModoExclusaoRecorrencia>('somente_esta');

  // Resetar modo ao abrir para um novo evento
  useEffect(() => {
    if (isOpen) {
      setModo('somente_esta');
    }
  }, [isOpen, evento?.id]);

  if (!isOpen) return null;

  const isRecorrente = Boolean(
    evento && (
      evento.recorrente ||
      evento.recorrencia_pai_id ||
      (evento.recorrencia_tipo && evento.recorrencia_tipo !== 'nenhuma')
    )
  );

  const defaultMessage = isRecorrente
    ? 'Este compromisso faz parte de uma série recorrente. Escolha como deseja aplicar a exclusão:'
    : `Tem certeza que deseja excluir o compromisso "${evento?.titulo || ''}"? Esta ação não poderá ser desfeita.`;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className={`bg-white rounded-2xl w-full p-6 shadow-xl border border-slate-100 space-y-4 ${isRecorrente ? 'max-w-md' : 'max-w-sm'}`}>
        <div className="flex items-center gap-3 text-rose-600">
          <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-100">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">{title}</h3>
            {evento?.titulo && (
              <p className="text-[11px] font-medium text-slate-500 line-clamp-1">{evento.titulo}</p>
            )}
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          {message || defaultMessage}
        </p>

        {isRecorrente && (
          <div className="space-y-2 pt-1">
            <label
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition select-none ${
                modo === 'somente_esta'
                  ? 'border-rose-400 bg-rose-50/40 text-slate-850 shadow-2xs'
                  : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
              }`}
            >
              <input
                type="radio"
                name="modo_exclusao_agenda"
                value="somente_esta"
                checked={modo === 'somente_esta'}
                onChange={() => setModo('somente_esta')}
                className="mt-0.5 text-rose-600 focus:ring-rose-500 h-4 w-4"
              />
              <div className="space-y-0.5 min-w-0 flex-1">
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Calendar className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                  <span>Somente esta ocorrência</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Exclui apenas o evento desta data específica ({evento?.data_inicio ? new Date(evento.data_inicio).toLocaleDateString('pt-BR') : 'selecionada'}). As demais datas da série permanecem inalteradas.
                </p>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition select-none ${
                modo === 'esta_e_proximas'
                  ? 'border-rose-400 bg-rose-50/40 text-slate-850 shadow-2xs'
                  : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
              }`}
            >
              <input
                type="radio"
                name="modo_exclusao_agenda"
                value="esta_e_proximas"
                checked={modo === 'esta_e_proximas'}
                onChange={() => setModo('esta_e_proximas')}
                className="mt-0.5 text-rose-600 focus:ring-rose-500 h-4 w-4"
              />
              <div className="space-y-0.5 min-w-0 flex-1">
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Layers className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span>Esta e as próximas ocorrências</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Exclui este evento e todas as ocorrências futuras da série a partir desta data. Ocorrências passadas são mantidas no histórico.
                </p>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition select-none ${
                modo === 'toda_serie'
                  ? 'border-rose-500 bg-rose-50/70 text-slate-900 shadow-2xs'
                  : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
              }`}
            >
              <input
                type="radio"
                name="modo_exclusao_agenda"
                value="toda_serie"
                checked={modo === 'toda_serie'}
                onChange={() => setModo('toda_serie')}
                className="mt-0.5 text-rose-600 focus:ring-rose-500 h-4 w-4"
              />
              <div className="space-y-0.5 min-w-0 flex-1">
                <div className="flex items-center gap-1.5 font-bold text-xs text-rose-700">
                  <RotateCcw className="h-3.5 w-3.5 text-rose-700 shrink-0" />
                  <span>Toda a série</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Remove todas as ocorrências pertencentes a esta recorrência (passadas, presentes e futuras em todos os meses/anos).
                </p>
              </div>
            </label>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-lg hover:bg-slate-50 transition text-xs"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(isRecorrente ? modo : undefined)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-xs transition text-xs"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
