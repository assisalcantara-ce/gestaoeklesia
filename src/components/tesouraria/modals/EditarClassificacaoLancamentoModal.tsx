'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Lock,
  Search,
  UserCheck,
  User,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Building2,
  Calendar,
  CreditCard,
  Tag,
  QrCode,
  Banknote,
} from 'lucide-react';
import { createClient } from '@/lib/supabase-client';

const TIPOS_RECEBIMENTO_OPCOES = [
  { value: 'dizimo', label: 'Dízimo', cor: 'bg-blue-100 text-blue-800' },
  { value: 'oferta', label: 'Oferta', cor: 'bg-[#123b63]/10 text-[#123b63]' },
  { value: 'oferta_especial', label: 'Oferta Especial', cor: 'bg-amber-100 text-amber-800' },
  { value: 'missoes', label: 'Missões / Oferta Missionária', cor: 'bg-emerald-100 text-emerald-800' },
  { value: 'contribuicao', label: 'Doação / Contribuição', cor: 'bg-purple-100 text-purple-800' },
  { value: 'campanha', label: 'Campanha Local / Projeto', cor: 'bg-indigo-100 text-indigo-800' },
  { value: 'evento', label: 'Inscrição / Evento Local', cor: 'bg-rose-100 text-rose-800' },
  { value: 'outros', label: 'Outros Recebimentos', cor: 'bg-gray-100 text-gray-800' },
];

export interface EditarClassificacaoLancamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  lancamento: any | null;
  onSuccess: () => void;
  showModal: (title: string, message: string, type?: 'success' | 'error' | 'info') => void;
  fmtDate: (dateStr: string) => string;
  fmtBRL: (val: number) => string;
  congNome?: (id?: string | null) => string;
  finContas?: Array<{ id: string; nome: string }>;
  finCategorias?: Array<{ id: string; nome: string; icone?: string | null }>;
}

export default function EditarClassificacaoLancamentoModal({
  isOpen,
  onClose,
  lancamento,
  onSuccess,
  showModal,
  fmtDate,
  fmtBRL,
  congNome,
  finContas = [],
  finCategorias = [],
}: EditarClassificacaoLancamentoModalProps) {
  const supabase = createClient();

  // Estados editáveis
  const [tipoRecebimento, setTipoRecebimento] = useState('dizimo');
  const [selectedMember, setSelectedMember] = useState<{ id: string; name: string; cpf?: string; matricula?: string; congregacaoNome?: string } | null>(null);

  // Estados de busca dinâmica
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Estados de submissão e erro
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Inicializar dados do lançamento ao abrir o modal
  useEffect(() => {
    if (isOpen && lancamento) {
      setTipoRecebimento(lancamento.tipo_recebimento || 'dizimo');
      setFormError(null);
      setSearchQuery('');
      setSearchResults([]);
      setHasSearched(false);
      setIsDropdownOpen(false);

      if (lancamento.member_id) {
        // Se já tiver membro associado, carregar dados para exibição
        const carregarMembroExistente = async () => {
          try {
            const { data, error } = await supabase
              .from('members')
              .select('id, name, cpf, matricula, custom_fields')
              .eq('id', lancamento.member_id)
              .maybeSingle();

            if (!error && data) {
              setSelectedMember({
                id: data.id,
                name: data.name,
                cpf: data.cpf,
                matricula: data.matricula || data.custom_fields?.matricula,
              });
            } else {
              setSelectedMember({
                id: lancamento.member_id,
                name: lancamento.member_nome || 'Membro Vinculado',
              });
            }
          } catch {
            setSelectedMember({
              id: lancamento.member_id,
              name: lancamento.member_nome || 'Membro Vinculado',
            });
          }
        };
        carregarMembroExistente();
      } else {
        setSelectedMember(null);
      }
    }
  }, [isOpen, lancamento, supabase]);

  // Busca dinâmica com debounce de 300ms
  const executarBuscaMembros = async (termo: string) => {
    const cleanTerm = termo.trim();
    if (!cleanTerm) {
      setSearchResults([]);
      setIsSearching(false);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      // 1. Tentar buscar via endpoint /api/v1/members
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      let membrosEncontrados: any[] = [];

      if (token) {
        const res = await fetch(`/api/v1/members?search=${encodeURIComponent(cleanTerm)}&limit=10`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.ok) {
          const json = await res.json();
          membrosEncontrados = json.data || [];
        }
      }

      // Fallback: busca direta no Supabase com tenant filter
      if (membrosEncontrados.length === 0 && lancamento?.ministry_id) {
        const { data: directData } = await supabase
          .from('members')
          .select('id, name, cpf, matricula, role, tipo_cadastro, custom_fields, congregacao_id')
          .eq('ministry_id', lancamento.ministry_id)
          .or(`name.ilike.%${cleanTerm}%,cpf.ilike.%${cleanTerm}%,matricula.ilike.%${cleanTerm}%`)
          .limit(10);

        if (directData && directData.length > 0) {
          membrosEncontrados = directData;
        }
      }

      setSearchResults(membrosEncontrados);
      setIsDropdownOpen(true);
    } catch (err) {
      console.error('Erro na busca de membros:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value;
    setSearchQuery(valor);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!valor.trim()) {
      setSearchResults([]);
      setIsDropdownOpen(false);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    debounceTimerRef.current = setTimeout(() => {
      executarBuscaMembros(valor);
    }, 300);
  };

  const handleSelectMember = (membro: any) => {
    setSelectedMember({
      id: membro.id,
      name: membro.name || membro.nome,
      cpf: membro.cpf,
      matricula: membro.matricula || membro.custom_fields?.matricula,
      congregacaoNome: membro.congregacoes?.nome || membro.congregacao_nome,
    });
    setSearchQuery('');
    setIsDropdownOpen(false);
    setSearchResults([]);
    setHasSearched(false);
    setFormError(null);
  };

  const handleClearMember = () => {
    setSelectedMember(null);
    setSearchQuery('');
    setSearchResults([]);
    setHasSearched(false);
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lancamento?.id) return;

    setSaving(true);
    setFormError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      const res = await fetch(`/api/v1/tesouraria/lancamentos?id=${lancamento.id}&action=classificacao`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tipo_recebimento: tipoRecebimento,
          member_id: selectedMember ? selectedMember.id : null,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Erro ao salvar a reclassificação do lançamento.');
      }

      showModal(
        'Classificação Atualizada!',
        `Lançamento reclassificado com sucesso como "${TIPOS_RECEBIMENTO_OPCOES.find((t) => t.value === tipoRecebimento)?.label || tipoRecebimento}"${selectedMember ? ` vinculado a ${selectedMember.name}` : ''}.`,
        'success'
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar classificação:', err);
      setFormError(err?.message || 'Falha ao salvar as alterações.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !lancamento) return null;

  const isDigitalPix = lancamento.origem_modulo === 'gateway' || lancamento.forma_pagamento === 'pix';
  const conta = finContas.find((c) => c.id === lancamento.conta_id);
  const categoria = finCategorias.find((c) => c.id === lancamento.categoria_id);
  const congregacaoTexto = congNome ? congNome(lancamento.congregacao_id) : (lancamento.congregacao_nome || 'Sede / Geral');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Cabeçalho */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#123b63]/10 border border-[#123b63]/20 flex items-center justify-center text-[#123b63]">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Reclassificar Lançamento</h2>
              <p className="text-xs text-slate-500">Defina o tipo de recebimento e identifique o dizimista/membro</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Alerta de erro no formulário */}
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <span>{formError}</span>
            </div>
          )}

          {/* Painel Somente-Leitura dos Dados Financeiros Originais (Bloqueados) */}
          <div className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                Dados Financeiros Auditados (Imutáveis)
              </span>
              <span className="text-[10px] font-medium text-slate-400 bg-slate-200/60 px-2 py-0.5 rounded">
                Somente Leitura
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              {/* Valor */}
              <div className="bg-white p-2 rounded-lg border border-slate-200/60 shadow-xs">
                <span className="text-[10px] text-slate-400 block">Valor</span>
                <span className="font-bold text-[#123b63] text-sm">
                  {fmtBRL(Number(lancamento.valor) || 0)}
                </span>
              </div>

              {/* Data */}
              <div className="bg-white p-2 rounded-lg border border-slate-200/60 shadow-xs">
                <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" /> Data
                </span>
                <span className="font-semibold text-slate-700">
                  {fmtDate(lancamento.data_lancamento)}
                </span>
              </div>

              {/* Caixa / Congregação */}
              <div className="bg-white p-2 rounded-lg border border-slate-200/60 shadow-xs col-span-2 sm:col-span-1">
                <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-slate-400" /> Caixa / Congregação
                </span>
                <span className="font-semibold text-slate-700 truncate block" title={congregacaoTexto}>
                  {congregacaoTexto}
                </span>
              </div>

              {/* Conta Financeira */}
              <div className="bg-white p-2 rounded-lg border border-slate-200/60 shadow-xs">
                <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                  <CreditCard className="w-3 h-3 text-slate-400" /> Conta Financeira
                </span>
                <span className="font-medium text-slate-700 truncate block">
                  {conta?.nome || 'Caixa Geral'}
                </span>
              </div>

              {/* Categoria / Depto */}
              <div className="bg-white p-2 rounded-lg border border-slate-200/60 shadow-xs">
                <span className="text-[10px] text-slate-400 block">Categoria</span>
                <span className="font-medium text-slate-700 truncate block">
                  {categoria?.nome || lancamento.departamento_nome || 'Geral'}
                </span>
              </div>

              {/* Origem / Modalidade */}
              <div className="bg-white p-2 rounded-lg border border-slate-200/60 shadow-xs">
                <span className="text-[10px] text-slate-400 block">Origem</span>
                <span className="font-medium text-slate-700 flex items-center gap-1">
                  {isDigitalPix ? (
                    <>
                      <QrCode className="w-3 h-3 text-[#123b63]" /> PIX (ASAAS)
                    </>
                  ) : (
                    <>
                      <Banknote className="w-3 h-3 text-slate-500" /> Manual / Espécie
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Código / Descrição */}
            <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
              {lancamento.codigo_registro && (
                <span className="font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded font-bold text-slate-700">
                  ID: {lancamento.codigo_registro}
                </span>
              )}
              {(lancamento.descricao || lancamento.referencia) && (
                <span className="truncate max-w-xs italic text-slate-600">
                  "{lancamento.descricao || lancamento.referencia}"
                </span>
              )}
            </div>
          </div>

          <form onSubmit={handleSalvar} className="space-y-4">
            {/* Campo 1: Tipo de Recebimento */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#123b63]" />
                Tipo de Recebimento *
              </label>
              <select
                value={tipoRecebimento}
                onChange={(e) => setTipoRecebimento(e.target.value)}
                disabled={saving}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#123b63]/20 focus:border-[#123b63] transition"
              >
                {TIPOS_RECEBIMENTO_OPCOES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                {tipoRecebimento === 'dizimo'
                  ? 'Classifique como Dízimo e identifique o membro abaixo para compor o histórico de dizimistas.'
                  : 'Selecione a classificação correta para o lançamento de entrada.'}
              </p>
            </div>

            {/* Campo 2: Identificação do Dizimista / Membro com Busca Dinâmica */}
            <div ref={searchContainerRef} className="relative">
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                  Identificação do Dizimista / Membro
                  {tipoRecebimento === 'dizimo' && (
                    <span className="text-teal-600 font-normal text-[11px]">(Recomendado)</span>
                  )}
                </span>
                {selectedMember && (
                  <button
                    type="button"
                    onClick={handleClearMember}
                    disabled={saving}
                    className="text-[11px] font-medium text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                  >
                    Desvincular membro
                  </button>
                )}
              </label>

              {/* Se membro já está selecionado: exibe Badge destacado */}
              {selectedMember ? (
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl flex items-center justify-between gap-2 transition">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-teal-950 truncate">
                        {selectedMember.name}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-teal-700">
                        {selectedMember.matricula && (
                          <span>Matrícula: {selectedMember.matricula}</span>
                        )}
                        {selectedMember.cpf && (
                          <span>CPF: {selectedMember.cpf}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMember(null);
                      setSearchQuery('');
                      setIsDropdownOpen(true);
                    }}
                    disabled={saving}
                    className="px-2.5 py-1 text-xs font-medium text-teal-800 bg-teal-100 hover:bg-teal-200 rounded-lg transition shrink-0 cursor-pointer"
                  >
                    Alterar
                  </button>
                </div>
              ) : (
                /* Campo de Busca Dinâmica */
                <div className="relative">
                  <div className="relative flex items-center">
                    <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={handleSearchChange}
                      onFocus={() => {
                        if (searchQuery.trim().length > 0) {
                          setIsDropdownOpen(true);
                        }
                      }}
                      disabled={saving}
                      placeholder="Buscar membro por nome, CPF ou matrícula..."
                      className="w-full pl-10 pr-9 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#123b63]/20 focus:border-[#123b63] transition"
                    />
                    {isSearching ? (
                      <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-[#123b63]" />
                    ) : searchQuery ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setSearchResults([]);
                          setIsDropdownOpen(false);
                        }}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    ) : null}
                  </div>

                  {/* Dropdown de Resultados da Busca */}
                  {isDropdownOpen && searchQuery.trim().length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-100">
                      {isSearching ? (
                        <div className="p-4 text-xs text-slate-500 text-center flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-[#123b63]" />
                          <span>Localizando membros...</span>
                        </div>
                      ) : searchResults.length === 0 ? (
                        <div className="p-4 text-xs text-slate-400 text-center">
                          {hasSearched ? (
                            <span>Nenhum membro encontrado com o termo "{searchQuery}".</span>
                          ) : (
                            <span>Digite o nome do membro...</span>
                          )}
                        </div>
                      ) : (
                        searchResults.map((m) => {
                          const matricula = m.matricula || m.custom_fields?.matricula;
                          const tipo = m.tipo_cadastro || m.role || 'Membro';

                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => handleSelectMember(m)}
                              className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-slate-50 flex items-center justify-between transition cursor-pointer group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-full bg-slate-100 group-hover:bg-[#123b63]/10 text-slate-600 group-hover:text-[#123b63] flex items-center justify-center shrink-0 transition">
                                  <User className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-800 truncate group-hover:text-[#123b63] transition">
                                    {m.name || m.nome}
                                  </p>
                                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                    {matricula && <span>Matrícula: {matricula}</span>}
                                    {m.cpf && <span>CPF: {m.cpf}</span>}
                                  </div>
                                </div>
                              </div>
                              <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded capitalize shrink-0 ml-2">
                                {tipo}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Rodapé / Ações */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 text-xs font-bold text-white bg-[#123b63] hover:bg-[#0f2e4d] active:bg-[#0b243d] rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Salvar Reclassificação</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
