'use client';

import { useState, useEffect } from 'react';
import { Search, UserCheck, CheckCircle2, AlertCircle, Loader2, X, UserPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';

interface MemberSearchItem {
  id: string;
  name: string;
  tipo_cadastro?: string | null;
  is_dizimista?: boolean | null;
  congregacao_id?: string | null;
  congregacoes?: { nome: string } | null;
}

interface AdicionarDizimistaModalProps {
  isOpen: boolean;
  onClose: () => void;
  ministryId: string | null;
  onSuccess: () => Promise<void> | void;
  showModal: (title: string, message: string, type?: 'success' | 'error' | 'info') => void;
}

export default function AdicionarDizimistaModal({
  isOpen,
  onClose,
  ministryId,
  onSuccess,
  showModal,
}: AdicionarDizimistaModalProps) {
  const supabase = createClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<MemberSearchItem[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberSearchItem | null>(null);
  const [isCheckboxChecked, setIsCheckboxChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  // Resetar estados quando a modal abre ou fecha
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setSearchResults([]);
      setSelectedMember(null);
      setIsCheckboxChecked(false);
      setSearching(false);
      setSaving(false);
    }
  }, [isOpen]);

  // Busca dinâmica com limite mínimo de 3 caracteres
  useEffect(() => {
    const term = searchTerm.trim();
    if (term.length < 3 || !ministryId) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const { data, error } = await supabase
          .from('members')
          .select('id, name, tipo_cadastro, is_dizimista, congregacao_id, congregacoes(nome)')
          .eq('ministry_id', ministryId)
          .ilike('name', `%${term}%`)
          .limit(10);

        if (error) {
          console.error('Erro ao pesquisar membros:', error);
          setSearchResults([]);
        } else {
          setSearchResults(data || []);
        }
      } catch (err) {
        console.error('Erro na requisição de busca de membros:', err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, ministryId, supabase]);

  if (!isOpen) return null;

  const handleSelectMember = (member: MemberSearchItem) => {
    setSelectedMember(member);
    setIsCheckboxChecked(false);
  };

  const handleConfirm = async () => {
    if (!selectedMember || !isCheckboxChecked || !ministryId) return;

    if (selectedMember.is_dizimista) {
      showModal('Aviso', `O membro "${selectedMember.name}" já está cadastrado como dizimista.`, 'info');
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .from('members')
        .update({ is_dizimista: true })
        .eq('id', selectedMember.id)
        .eq('ministry_id', ministryId);

      if (error) throw error;

      await onSuccess();
      showModal('Sucesso', `Membro "${selectedMember.name}" cadastrado como dizimista com sucesso!`, 'success');
      onClose();
    } catch (err: any) {
      console.error('Erro ao atualizar status de dizimista:', err);
      showModal('Erro', 'Não foi possível cadastrar o dizimista. Tente novamente.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabeçalho */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#123b63]/10 text-[#123b63] flex items-center justify-center font-bold">
              <UserPlus className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Adicionar Dizimista</h3>
              <p className="text-xs text-gray-500">Selecione um membro do ministério para ser dizimista</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200/50 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corpo da Modal */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Campo de Pesquisa */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Pesquisar membro <span className="text-red-500">*</span>
            </label>
            <div className="relative flex items-center">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Digite pelo menos 3 caracteres..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#123b63] transition"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-2.5 h-4 w-4 text-gray-400 animate-spin" />
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              {searchTerm.trim().length > 0 && searchTerm.trim().length < 3
                ? 'Digite pelo menos 3 caracteres para iniciar a busca.'
                : 'Pesquise pelo nome do membro cadastrado.'}
            </p>
          </div>

          {/* Lista de Resultados de Busca */}
          {searchTerm.trim().length >= 3 && (
            <div className="border border-gray-100 rounded-xl max-h-48 overflow-y-auto bg-slate-50/50 divide-y divide-gray-100">
              {searching ? (
                <div className="p-4 text-xs text-center text-gray-400 flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Buscando membros...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-4 text-xs text-center text-gray-400">
                  Nenhum membro encontrado com este nome.
                </div>
              ) : (
                searchResults.map((membro) => {
                  const isSelected = selectedMember?.id === membro.id;
                  const congNome = membro.congregacoes?.nome || 'Sede / Geral';
                  const tipoCad = membro.tipo_cadastro || 'Membro';

                  return (
                    <button
                      key={membro.id}
                      type="button"
                      onClick={() => handleSelectMember(membro)}
                      className={`w-full text-left p-3 text-xs flex justify-between items-center transition ${
                        isSelected
                          ? 'bg-[#123b63]/10 border-l-4 border-[#123b63]'
                          : 'hover:bg-slate-100'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-gray-800 truncate flex items-center gap-1.5">
                          <UserCheck className="h-3.5 w-3.5 text-[#123b63] shrink-0" />
                          {membro.name}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5">{congNome}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] bg-slate-200 text-slate-700 font-semibold px-2 py-0.5 rounded capitalize">
                          {tipoCad}
                        </span>
                        {membro.is_dizimista && (
                          <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded">
                            Já Dizimista
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* Dados do Membro Selecionado */}
          {selectedMember && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Membro Selecionado</span>
                  <h4 className="font-bold text-gray-800 text-sm mt-0.5">{selectedMember.name}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Congregação: <span className="font-semibold text-gray-700">{selectedMember.congregacoes?.nome || 'Sede / Geral'}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    Tipo de Cadastro: <span className="font-semibold text-gray-700 capitalize">{selectedMember.tipo_cadastro || 'Membro'}</span>
                  </p>
                </div>

                {selectedMember.is_dizimista ? (
                  <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>Já é Dizimista</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-lg">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>Disponível</span>
                  </div>
                )}
              </div>

              {selectedMember.is_dizimista ? (
                <div className="text-xs text-amber-800 bg-amber-100/70 p-2.5 rounded-lg border border-amber-200/80">
                  Este membro já possui o cadastro de dizimista ativo. Não é necessário adicioná-lo novamente.
                </div>
              ) : (
                <label className="flex items-center gap-2.5 pt-2 border-t border-slate-200 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isCheckboxChecked}
                    onChange={(e) => setIsCheckboxChecked(e.target.checked)}
                    className="w-4 h-4 text-[#123b63] rounded border-gray-300 focus:ring-[#123b63]"
                  />
                  <span className="text-xs font-semibold text-gray-700">
                    Tornar este membro um dizimista
                  </span>
                </label>
              )}
            </div>
          )}
        </div>

        {/* Rodapé / Botões de Ação */}
        <div className="p-4 border-t border-gray-100 bg-slate-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-100 transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedMember || !isCheckboxChecked || selectedMember?.is_dizimista === true || saving}
            className="px-5 py-2 bg-[#123b63] text-white rounded-xl text-xs font-semibold hover:bg-[#0f2a45] transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...
              </>
            ) : (
              'Confirmar Dizimista'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
