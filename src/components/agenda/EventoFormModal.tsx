'use client';

import { X, Trash2 } from 'lucide-react';
import { AgendaEvento } from './AgendaCalendar';
import { AgendaTipo } from './AgendaToolbar';

export interface EventoFormState {
  titulo: string;
  descricao: string;
  tipo_id: string;
  data_inicio: string;
  data_fim: string;
  local: string;
  visibilidade: AgendaEvento['visibilidade'];
  church_id: string;
  status: AgendaEvento['status'];
  escopo: AgendaEvento['escopo'];
  calendario_oficial: boolean;
  gera_bloqueio: boolean;
  regra_posicionamento: string;
}

interface EventoFormModalProps {
  showModal: boolean;
  editEvento: AgendaEvento | null;
  form: EventoFormState;
  saving: boolean;
  showAdvancedFormFields: boolean;
  tiposAgrupados: Record<string, AgendaTipo[]>;
  CATEGORIAS_LABEL: Record<string, string>;
  orgHelper: any;
  isAdmin: boolean;
  onCloseModal: () => void;
  onSave: (e: React.FormEvent) => void;
  onFormChange: (fields: Partial<EventoFormState>) => void;
  onTipoChange: (tipoId: string) => void;
  onToggleAdvancedFields: () => void;
  onOpenTiposModal: () => void;
  // Modal de gerenciamento de tipos
  showTiposModal: boolean;
  tipos: (AgendaTipo & { cor?: string | null; sistema?: boolean; gera_bloqueio?: boolean })[];
  novoTipoNome: string;
  novoTipoCategoria: 'culto' | 'reuniao' | 'evento' | 'missoes' | 'departamento' | 'administrativo';
  novoTipoCor: string;
  novoTipoBloqueio: boolean;
  isSalvandoTipo: boolean;
  onCloseTiposModal: () => void;
  onNovoTipoNomeChange: (val: string) => void;
  onNovoTipoCategoriaChange: (val: any) => void;
  onNovoTipoCorChange: (val: string) => void;
  onNovoTipoBloqueioChange: (val: boolean) => void;
  onCriarTipo: () => void;
  onDeletarTipo: (id: string) => void;
}

export default function EventoFormModal({
  showModal,
  editEvento,
  form,
  saving,
  showAdvancedFormFields,
  tiposAgrupados,
  CATEGORIAS_LABEL,
  orgHelper,
  isAdmin,
  onCloseModal,
  onSave,
  onFormChange,
  onTipoChange,
  onToggleAdvancedFields,
  onOpenTiposModal,
  showTiposModal,
  tipos,
  novoTipoNome,
  novoTipoCategoria,
  novoTipoCor,
  novoTipoBloqueio,
  isSalvandoTipo,
  onCloseTiposModal,
  onNovoTipoNomeChange,
  onNovoTipoCategoriaChange,
  onNovoTipoCorChange,
  onNovoTipoBloqueioChange,
  onCriarTipo,
  onDeletarTipo,
}: EventoFormModalProps) {
  return (
    <>
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-xl border border-slate-100 flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-black text-slate-800 text-sm">
                  {editEvento ? 'EDITAR COMPROMISSO' : 'NOVO COMPROMISSO'}
                </h3>
              </div>
              <button onClick={onCloseModal} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={onSave} className="flex-1 overflow-y-auto p-4 space-y-3">
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Título *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Reunião Geral de Obreiros"
                  value={form.titulo}
                  onChange={(e) => onFormChange({ titulo: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[9px] font-bold text-slate-500 uppercase">Tipo *</label>
                    <button
                      type="button"
                      onClick={onOpenTiposModal}
                      className="text-[9px] text-blue-600 hover:text-blue-750 font-extrabold hover:underline"
                    >
                      + Configurar
                    </button>
                  </div>
                  <select
                    value={form.tipo_id}
                    required
                    onChange={(e) => onTipoChange(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                  >
                    <option value="" disabled>Selecione</option>
                    {Object.entries(tiposAgrupados).map(([categoria, lista]) => {
                      if (lista.length === 0) return null;
                      return (
                        <optgroup key={categoria} label={CATEGORIAS_LABEL[categoria as keyof typeof CATEGORIAS_LABEL] || categoria}>
                          {lista.map(t => (
                            <option key={t.id} value={t.id}>{t.nome}</option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => onFormChange({ status: e.target.value as AgendaEvento['status'] })}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                  >
                    <option value="agendado">Agendado</option>
                    <option value="cancelado">Cancelado</option>
                    <option value="concluido">Concluído</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Início *</label>
                  <input
                    type="datetime-local"
                    required
                    value={form.data_inicio}
                    onChange={(e) => onFormChange({ data_inicio: e.target.value })}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Fim</label>
                  <input
                    type="datetime-local"
                    value={form.data_fim}
                    onChange={(e) => onFormChange({ data_fim: e.target.value })}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Local</label>
                <input
                  type="text"
                  placeholder="Templo Central, Sala 3..."
                  value={form.local}
                  onChange={(e) => onFormChange({ local: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={onToggleAdvancedFields}
                className="w-full text-center py-2 border border-dashed border-slate-200 rounded-lg text-[10px] font-bold text-slate-400 hover:bg-slate-50 transition"
              >
                {showAdvancedFormFields ? 'Ocultar Detalhes Avançados' : 'Mostrar Detalhes Avançados'}
              </button>

              {showAdvancedFormFields && (
                <div className="p-3 border border-slate-100 rounded-xl bg-slate-50/50 space-y-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Descrição</label>
                    <textarea
                      placeholder="Pauta ou pormenores..."
                      value={form.descricao}
                      onChange={(e) => onFormChange({ descricao: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Escopo</label>
                      <select
                        value={form.escopo}
                        onChange={(e) => onFormChange({ escopo: e.target.value as AgendaEvento['escopo'] })}
                        className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                      >
                        <option value="organizacao">{orgHelper ? orgHelper.label('organizacao') : 'Organização'}</option>
                        {orgHelper?.ativa('divisao3') && <option value="divisao3">{orgHelper.label('divisao3')}</option>}
                        {orgHelper?.ativa('divisao2') && <option value="divisao2">{orgHelper.label('divisao2')}</option>}
                        {orgHelper?.ativa('divisao1') && <option value="divisao1">{orgHelper.label('divisao1')}</option>}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Visibilidade</label>
                      <select
                        value={form.visibilidade}
                        onChange={(e) => onFormChange({ visibilidade: e.target.value as AgendaEvento['visibilidade'] })}
                        className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                      >
                        <option value="privado">Privado</option>
                        <option value="lideranca">Liderança</option>
                        <option value="igreja">Membros</option>
                        <option value="ministerio">Ministério</option>
                        <option value="publico">Público</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Regra de Posicionamento</label>
                    <select
                      value={form.regra_posicionamento}
                      onChange={(e) => onFormChange({ regra_posicionamento: e.target.value })}
                      className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                    >
                      <option value="">Nenhuma (Data Fixa)</option>
                      <option value="primeiro_domingo">Primeiro Domingo</option>
                      <option value="segundo_domingo">Segundo Domingo</option>
                      <option value="terceiro_domingo">Terceiro Domingo</option>
                      <option value="ultimo_domingo">Último Domingo</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-4 pt-1">
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.calendario_oficial}
                        onChange={(e) => onFormChange({ calendario_oficial: e.target.checked })}
                        className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 border-slate-300"
                      />
                      Oficial
                    </label>
                    <label className={`flex items-center gap-1.5 text-xs font-bold ${isAdmin ? 'text-slate-600 cursor-pointer' : 'text-slate-350 cursor-not-allowed select-none'}`}>
                      <input
                        type="checkbox"
                        disabled={!isAdmin}
                        checked={form.gera_bloqueio}
                        onChange={(e) => onFormChange({ gera_bloqueio: e.target.checked })}
                        className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 border-slate-300 disabled:opacity-40"
                      />
                      Gera Bloqueio
                    </label>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50 -mx-4 -mb-4 p-4 shrink-0 rounded-b-xl">
                <button
                  type="button"
                  onClick={onCloseModal}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-lg hover:bg-white transition text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs transition text-xs disabled:opacity-60"
                >
                  {saving ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTiposModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-2xl shadow-xl border border-slate-100 flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="font-black text-slate-800 text-sm">
                CONFIGURAR TIPOS DE COMPROMISSO
              </h3>
              <button 
                onClick={onCloseTiposModal} 
                className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">
              <div className="flex flex-col min-h-0">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Tipos Cadastrados</h4>
                <div className="flex-1 overflow-y-auto border border-slate-150 rounded-xl divide-y divide-slate-100 max-h-[300px] md:max-h-none bg-slate-50/20">
                  {tipos.length === 0 ? (
                    <p className="p-4 text-xs text-slate-400 text-center font-bold">Nenhum tipo cadastrado.</p>
                  ) : (
                    tipos.map(t => (
                      <div key={t.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-3.5 h-3.5 rounded-full shrink-0 border border-slate-205" style={{ backgroundColor: t.cor || '#cbd5e1' }} />
                          <div className="truncate">
                            <p className="font-extrabold text-slate-800 truncate">{t.nome}</p>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                              {CATEGORIAS_LABEL[t.categoria as keyof typeof CATEGORIAS_LABEL] || t.categoria} 
                              {t.gera_bloqueio ? ' · Bloqueia Agenda' : ''}
                            </span>
                          </div>
                        </div>

                        {!t.sistema ? (
                          <button
                            onClick={() => onDeletarTipo(t.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : (
                          <span className="text-[8px] font-black text-slate-400 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded uppercase select-none">Fixo</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Novo Tipo de Compromisso</h4>
                
                <div className="space-y-3 p-4 border border-slate-150 rounded-xl bg-slate-50/50">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Nome do Tipo *</label>
                    <input
                      type="text"
                      placeholder="Ex: Jantar de Casais, Batismo"
                      value={novoTipoNome}
                      onChange={(e) => onNovoTipoNomeChange(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Categoria Principal *</label>
                    <select
                      value={novoTipoCategoria}
                      onChange={(e) => onNovoTipoCategoriaChange(e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                    >
                      <option value="culto">Culto</option>
                      <option value="reuniao">Reunião</option>
                      <option value="evento">Evento</option>
                      <option value="missoes">Missões</option>
                      <option value="departamento">Departamento / Ministério</option>
                      <option value="administrativo">Administrativo / Outro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1.5">Cor do Tipo *</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        '#ef4444',
                        '#f97316',
                        '#f59e0b',
                        '#10b981',
                        '#06b6d4',
                        '#3b82f6',
                        '#6366f1',
                        '#8b5cf6',
                        '#ec4899',
                        '#64748b'
                      ].map(colorHex => (
                        <button
                          key={colorHex}
                          type="button"
                          onClick={() => onNovoTipoCorChange(colorHex)}
                          className={`w-6 h-6 rounded-full border transition-transform ${
                            novoTipoCor === colorHex ? 'scale-115 border-slate-600 ring-2 ring-slate-100' : 'border-transparent hover:scale-105'
                          }`}
                          style={{ backgroundColor: colorHex }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="pt-1">
                    <label className="flex items-center gap-1.5 text-xs text-slate-650 font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={novoTipoBloqueio}
                        onChange={(e) => onNovoTipoBloqueioChange(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-slate-300"
                      />
                      Gera Bloqueio na Agenda Geral
                    </label>
                    <p className="text-[9px] text-slate-450 mt-1 pl-5.5 leading-relaxed font-semibold">
                      Se ativado, outros departamentos não poderão marcar eventos que gerem choque de data neste mesmo dia/horário.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={isSalvandoTipo || !novoTipoNome.trim()}
                    onClick={onCriarTipo}
                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-extrabold text-xs rounded-xl shadow-xs transition duration-200"
                  >
                    {isSalvandoTipo ? 'Salvando...' : 'Adicionar Tipo'}
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end shrink-0 bg-slate-50/50 rounded-b-2xl">
              <button
                type="button"
                onClick={onCloseTiposModal}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-extrabold rounded-lg shadow-xs transition text-xs"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
