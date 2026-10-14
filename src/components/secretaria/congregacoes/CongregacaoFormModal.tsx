'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Loader2,
  Church,
  Building2,
  Network,
  User,
  Image as ImageIcon,
} from 'lucide-react';

interface Divisao1 {
  id: string;
  codigo?: number | null;
  nome: string;
  uf?: string | null;
  supervisao_id?: string;
  supervisor_member_id?: string | null;
  supervisor_matricula?: string | null;
  supervisor_nome?: string | null;
  supervisor_cpf?: string | null;
  supervisor_data_nascimento?: string | null;
  supervisor_cargo?: string | null;
  supervisor_celular?: string | null;
  is_active: boolean;
  created_at: string;
}

interface Divisao2 {
  id: string;
  ministry_id: string;
  supervisao_id?: string | null;
  nome: string;
  is_sede: boolean;
  pastor_member_id?: string | null;
  pastor_nome?: string | null;
  pastor_data_posse?: string | null;
  cep?: string | null;
  municipio?: string | null;
  uf?: string | null;
  is_active: boolean;
  created_at: string;
}

interface Divisao3 {
  id: string;
  ministry_id: string;
  supervisao_id?: string | null;
  campo_id?: string | null;
  nome: string;
  dirigente?: string | null;
  dirigente_cpf?: string | null;
  dirigente_cargo?: string | null;
  dirigente_matricula?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status_imovel?: 'PROPRIO' | 'ALUGADO' | 'CEDIDO' | null;
  foto_url?: string | null;
  foto_bucket?: string | null;
  foto_path?: string | null;
  is_active: boolean;
  created_at: string;
}

interface MemberLookup {
  id: string;
  name: string;
  cpf: string | null;
  data_nascimento: string | null;
  role: string | null;
  occupation: string | null;
  profissao?: string | null;
  phone: string | null;
  custom_fields: Record<string, any> | null;
}

type FotoIgrejaChange =
  | { kind: 'none' }
  | { kind: 'file'; file: File; previewUrl: string }
  | { kind: 'url'; url: string };

interface CongregacaoFormModalProps {
  activeTab: string;
  nomeD1: string;
  nomeD2: string;
  nomeD3: string;
  showFormD1: boolean;
  showFormD2: boolean;
  showFormD3: boolean;
  editingD1: Divisao1 | null;
  editingD2: Divisao2 | null;
  editingD3: Divisao3 | null;
  formD1: any;
  formD2: any;
  formD3: any;
  setFormD1: React.Dispatch<React.SetStateAction<any>>;
  setFormD2: React.Dispatch<React.SetStateAction<any>>;
  setFormD3: React.Dispatch<React.SetStateAction<any>>;
  dirigenteStatus: string;
  dirigenteMsg: string;
  dirigenteSelected: { id: string; name: string } | null;
  dirigenteResults: MemberLookup[];
  pastorStatus: string;
  pastorMsg: string;
  pastorResults: MemberLookup[];
  geoPreview: { latitude: number; longitude: number; address: string } | null;
  fotoIgrejaChange: FotoIgrejaChange;
  fotoIgrejaUrlInput: string;
  setFotoIgrejaUrlInput: React.Dispatch<React.SetStateAction<string>>;
  setFotoIgrejaChange: React.Dispatch<React.SetStateAction<FotoIgrejaChange>>;
  availableDivisoes3ForCurrentD2: (Divisao3 | Divisao1)[];
  availableDivisoes2ForCurrentD1: Divisao2[];
  selectedD1IdsForD2: string[];
  setSelectedD1IdsForD2: React.Dispatch<React.SetStateAction<string[]>>;
  selectedD2IdsForD3: string[];
  setSelectedD2IdsForD3: React.Dispatch<React.SetStateAction<string[]>>;
  getMinisterCargo: (m: MemberLookup) => string;
  formatCpf: (cpf: string) => string;
  handleSaveD1: () => void | Promise<void>;
  handleSaveD2: () => void | Promise<void>;
  handleSaveD3: () => void | Promise<void>;
  onCancelD1: () => void;
  onCancelD2: () => void;
  onCancelD3: () => void;
  onSelectDirigente: (m: MemberLookup) => void;
  onSelectPastor: (m: MemberLookup) => void;
}

export default function CongregacaoFormModal({
  activeTab,
  nomeD1,
  nomeD2,
  nomeD3,
  showFormD1,
  showFormD2,
  showFormD3,
  editingD1,
  editingD2,
  editingD3,
  formD1,
  formD2,
  formD3,
  setFormD1,
  setFormD2,
  setFormD3,
  dirigenteStatus,
  dirigenteMsg,
  dirigenteSelected,
  dirigenteResults,
  pastorStatus,
  pastorMsg,
  pastorResults,
  geoPreview,
  fotoIgrejaChange,
  fotoIgrejaUrlInput,
  setFotoIgrejaUrlInput,
  setFotoIgrejaChange,
  availableDivisoes3ForCurrentD2,
  availableDivisoes2ForCurrentD1,
  selectedD1IdsForD2,
  setSelectedD1IdsForD2,
  selectedD2IdsForD3,
  setSelectedD2IdsForD3,
  getMinisterCargo,
  formatCpf,
  handleSaveD1,
  handleSaveD2,
  handleSaveD3,
  onCancelD1,
  onCancelD2,
  onCancelD3,
  onSelectDirigente,
  onSelectPastor,
}: CongregacaoFormModalProps) {
  const [saving, setSaving] = useState(false);

  // Determina se algum dos formulários modais está aberto
  const isD1Open = activeTab === 'divisao1' && showFormD3;
  const isD2Open = activeTab === 'divisao2' && showFormD2;
  const isD3Open = activeTab === 'divisao3' && showFormD1;
  const isAnyOpen = isD1Open || isD2Open || isD3Open;

  const currentOnClose = isD1Open ? onCancelD3 : isD2Open ? onCancelD2 : onCancelD1;
  const currentSaveFn = isD1Open ? handleSaveD3 : isD2Open ? handleSaveD2 : handleSaveD1;

  // Fecha o modal via tecla Escape
  useEffect(() => {
    if (!isAnyOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) {
        currentOnClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAnyOpen, saving, currentOnClose]);

  if (!isAnyOpen) return null;

  const executeSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await currentSaveFn();
    } finally {
      setSaving(false);
    }
  };

  // Define títulos e ícones de acordo com a aba ativa
  let modalTitle = '';
  let modalSubtitle = '';
  let modalIcon = <Church className="w-5 h-5 text-teal-700" />;
  let saveButtonLabel = 'Salvar';

  if (isD1Open) {
    modalTitle = editingD3 ? `Editar ${nomeD1}` : `Nova ${nomeD1}`;
    modalSubtitle = editingD3
      ? (editingD3.nome || `Atualize as informações da ${nomeD1.toLowerCase()}`)
      : `Cadastre uma nova ${nomeD1.toLowerCase()} no seu ministério`;
    modalIcon = <Church className="w-5 h-5 text-teal-700" />;
    saveButtonLabel = editingD3 ? 'Salvar Alterações' : `Cadastrar ${nomeD1}`;
  } else if (isD2Open) {
    modalTitle = editingD2 ? `Editar ${nomeD2}` : `Novo ${nomeD2}`;
    modalSubtitle = editingD2
      ? (editingD2.nome || `Atualize as informações do ${nomeD2.toLowerCase()}`)
      : `Cadastre um novo ${nomeD2.toLowerCase()} no seu ministério`;
    modalIcon = <Building2 className="w-5 h-5 text-teal-700" />;
    saveButtonLabel = editingD2 ? 'Salvar Alterações' : `Cadastrar ${nomeD2}`;
  } else if (isD3Open) {
    modalTitle = editingD1 ? `Editar ${nomeD3}` : `Nova ${nomeD3}`;
    modalSubtitle = editingD1
      ? (editingD1.nome || `Atualize as informações da ${nomeD3.toLowerCase()}`)
      : `Cadastre uma nova ${nomeD3.toLowerCase()} no seu ministério`;
    modalIcon = <Network className="w-5 h-5 text-teal-700" />;
    saveButtonLabel = editingD1 ? 'Salvar Alterações' : `Cadastrar ${nomeD3}`;
  }

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 md:p-6 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="congregacao-form-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl sm:max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* ─── HEADER (Padrão Membros) ─── */}
        <div className="px-6 py-4.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-700 border border-teal-200/80 flex items-center justify-center shrink-0 shadow-xs">
              {modalIcon}
            </div>
            <div className="min-w-0">
              <h2 id="congregacao-form-modal-title" className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight truncate">
                {modalTitle}
              </h2>
              <p className="text-xs sm:text-sm font-medium text-slate-500 truncate">
                {modalSubtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={currentOnClose}
            disabled={saving}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer disabled:opacity-50"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ─── BODY SCROLLABLE ─── */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 modal-scrollbar">
          {/* FORMULÁRIO D1: Congregação */}
          {isD1Open && (
            <div className="space-y-4.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nome da {nomeD1} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formD3.nome}
                  onChange={(e) => setFormD3((prev: any) => ({ ...prev, nome: e.target.value }))}
                  placeholder={`Ex: ${nomeD1} Central`}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Dirigente
                </label>
                <input
                  type="text"
                  value={formD3.dirigente}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFormD3((prev: any) => ({
                      ...prev,
                      dirigente: v,
                      dirigente_cpf: '',
                      dirigente_cargo: '',
                      dirigente_matricula: '',
                    }));
                  }}
                  placeholder="Ex: Pr. João Silva"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition bg-white"
                />
                <p className="text-xs text-slate-500 mt-1.5">
                  {dirigenteStatus === 'loading'
                    ? 'Buscando ministros...'
                    : dirigenteMsg || (dirigenteSelected ? '✓ Dirigente selecionado.' : 'Digite pelo menos 2 letras para buscar na lista de ministros.')}
                </p>

                {dirigenteResults.length > 0 && !dirigenteSelected && (
                  <div className="mt-2 border border-slate-200 rounded-xl bg-white shadow-lg overflow-hidden divide-y divide-slate-100 max-h-48 overflow-y-auto">
                    {dirigenteResults.map((m) => {
                      const cargo = String(getMinisterCargo(m) || '').trim();
                      return (
                        <button
                          type="button"
                          key={m.id}
                          onClick={() => onSelectDirigente(m)}
                          className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-sm transition flex items-center justify-between cursor-pointer"
                        >
                          <span className="font-semibold text-slate-800">{m.name}</span>
                          {cargo && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200">
                              {cargo}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-slate-50/80 rounded-xl border border-slate-200/90 p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-4 h-4 text-teal-700" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Dados do Dirigente</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">CPF</label>
                    <input
                      type="text"
                      value={formD3.dirigente_cpf}
                      onChange={(e) => setFormD3((prev: any) => ({ ...prev, dirigente_cpf: formatCpf(e.target.value) }))}
                      placeholder="Ex: 000.000.000-00"
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Cargo</label>
                    <input
                      type="text"
                      value={formD3.dirigente_cargo}
                      onChange={(e) => setFormD3((prev: any) => ({ ...prev, dirigente_cargo: e.target.value }))}
                      placeholder="Ex: Pastor"
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Matrícula</label>
                    <input
                      type="text"
                      value={formD3.dirigente_matricula}
                      onChange={(e) => setFormD3((prev: any) => ({ ...prev, dirigente_matricula: e.target.value }))}
                      placeholder="Ex: 12345"
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition bg-white"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Endereço</label>
                <input
                  type="text"
                  value={formD3.endereco}
                  onChange={(e) => setFormD3((prev: any) => ({ ...prev, endereco: e.target.value }))}
                  placeholder="Ex: Rua das Flores, 123, Bairro"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition bg-white"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">CEP</label>
                  <input
                    type="text"
                    value={formD3.cep}
                    onChange={(e) => setFormD3((prev: any) => ({ ...prev, cep: e.target.value }))}
                    placeholder="Somente números"
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Município</label>
                  <input
                    type="text"
                    value={formD3.municipio}
                    onChange={(e) => setFormD3((prev: any) => ({ ...prev, municipio: e.target.value }))}
                    placeholder="Ex: Santos"
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">UF</label>
                  <input
                    type="text"
                    value={formD3.uf}
                    onChange={(e) => setFormD3((prev: any) => ({ ...prev, uf: e.target.value.toUpperCase().slice(0, 2) }))}
                    placeholder="Ex: SP"
                    maxLength={2}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Status do Imóvel <span className="text-red-500">*</span>
                </label>
                <select
                  value={formD3.status_imovel}
                  onChange={(e) => setFormD3((prev: any) => ({ ...prev, status_imovel: e.target.value as any }))}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition cursor-pointer"
                >
                  <option value="">Selecione o status do imóvel</option>
                  <option value="PROPRIO">Próprio</option>
                  <option value="ALUGADO">Alugado</option>
                  <option value="CEDIDO">Cedido</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Geolocalização</label>
                <input
                  type="text"
                  value={
                    geoPreview
                      ? `${geoPreview.latitude}, ${geoPreview.longitude}`
                      : (editingD3?.latitude != null && editingD3?.longitude != null
                        ? `${editingD3.latitude}, ${editingD3.longitude}`
                        : '')
                  }
                  disabled
                  placeholder="Gerado automaticamente ao salvar"
                  className="w-full px-3.5 py-2.5 border border-slate-200 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium cursor-not-allowed"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Este campo é preenchido automaticamente com base no endereço e não pode ser editado aqui.
                </p>
              </div>

              <div className="bg-slate-50/80 rounded-xl border border-slate-200/90 p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-3">
                  <ImageIcon className="w-4 h-4 text-teal-700" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Foto da Fachada / Templo</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col justify-between gap-4">
                    <p className="text-xs text-slate-500">
                      Envie um arquivo ou informe uma URL. A imagem será redimensionada e otimizada automaticamente.
                    </p>

                    <input
                      id="foto-igreja-file"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        if (!file) return;

                        if (fotoIgrejaChange.kind === 'file') {
                          try { URL.revokeObjectURL(fotoIgrejaChange.previewUrl); } catch { /* noop */ }
                        }

                        const previewUrl = URL.createObjectURL(file);
                        setFotoIgrejaChange({ kind: 'file', file, previewUrl });
                      }}
                      className="hidden"
                    />

                    <div className="flex flex-col gap-2">
                      <label
                        htmlFor="foto-igreja-file"
                        className="inline-flex items-center justify-center px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs sm:text-sm font-bold transition shadow-xs cursor-pointer gap-2"
                      >
                        <ImageIcon className="w-4 h-4" />
                        <span>Selecionar foto do computador</span>
                      </label>
                      <p className="text-center text-xs text-slate-600 truncate px-1">
                        {fotoIgrejaChange.kind === 'file'
                          ? fotoIgrejaChange.file.name
                          : 'Nenhum arquivo novo selecionado'}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex flex-col gap-2">
                      <label className="block text-xs font-semibold text-slate-700">Ou informe a URL direta da foto:</label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={fotoIgrejaUrlInput}
                          onChange={(e) => setFotoIgrejaUrlInput(e.target.value)}
                          placeholder="https://exemplo.com/foto.jpg"
                          className="flex-1 px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const url = fotoIgrejaUrlInput.trim();
                            if (!url) return;
                            if (fotoIgrejaChange.kind === 'file') {
                              try { URL.revokeObjectURL(fotoIgrejaChange.previewUrl); } catch { /* noop */ }
                            }
                            setFotoIgrejaChange({ kind: 'url', url });
                          }}
                          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                        >
                          Usar URL
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Pré-visualização */}
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-full h-48 border border-slate-200 rounded-xl bg-white p-2 flex items-center justify-center overflow-hidden shadow-2xs">
                      {(() => {
                        const preview =
                          fotoIgrejaChange.kind === 'file'
                            ? fotoIgrejaChange.previewUrl
                            : fotoIgrejaChange.kind === 'url'
                              ? fotoIgrejaChange.url
                              : (editingD3?.foto_url || '');

                        if (!preview) {
                          return (
                            <div className="flex flex-col items-center gap-1.5 text-slate-400">
                              <ImageIcon className="w-8 h-8 stroke-1" />
                              <span className="text-xs">Sem foto cadastrada</span>
                            </div>
                          );
                        }

                        return (
                          <img
                            src={preview}
                            alt="Pré-visualização"
                            className="max-w-full max-h-full object-contain rounded-lg"
                            loading="lazy"
                          />
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FORMULÁRIO D2: Campo / Grupo */}
          {isD2Open && (
            <div className="space-y-4.5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nome do {nomeD2} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formD2.nome}
                    onChange={(e) => setFormD2((prev: any) => ({ ...prev, nome: e.target.value }))}
                    placeholder={`Ex: ${nomeD2} Baixada Santista`}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Município
                  </label>
                  <input
                    type="text"
                    value={formD2.municipio}
                    onChange={(e) => setFormD2((prev: any) => ({ ...prev, municipio: e.target.value }))}
                    placeholder="Ex: São Paulo"
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition bg-white"
                  />
                </div>
              </div>

              <div className="pt-1">
                <label className="inline-flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!!formD2.informar_pastor}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setFormD2((prev: any) => ({
                        ...prev,
                        informar_pastor: checked,
                        pastor_nome_input: checked ? prev.pastor_nome_input : '',
                        pastor_member_id: checked ? prev.pastor_member_id : '',
                        pastor_nome: checked ? prev.pastor_nome : '',
                        pastor_data_posse: checked ? prev.pastor_data_posse : '',
                      }));
                    }}
                    className="w-4.5 h-4.5 rounded text-teal-700 focus:ring-teal-600/20 border-slate-300 transition cursor-pointer"
                  />
                  <span className="text-sm font-semibold text-slate-800">Informar Pastor / Supervisor Responsável</span>
                </label>
              </div>

              {formD2.informar_pastor && (
                <div className="bg-slate-50/80 rounded-xl border border-slate-200/90 p-4 sm:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="w-4 h-4 text-teal-700" />
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Dados do Pastor Responsável</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nome do Pastor</label>
                      <input
                        type="text"
                        value={formD2.pastor_nome_input}
                        onChange={(e) => {
                          const v = e.target.value;
                          setFormD2((prev: any) => ({
                            ...prev,
                            pastor_nome_input: v,
                            pastor_member_id: '',
                            pastor_nome: '',
                          }));
                        }}
                        placeholder="Digite para buscar na lista de ministros..."
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition bg-white"
                      />
                      <p className="text-xs text-slate-500 mt-1.5">
                        {pastorStatus === 'loading'
                          ? 'Buscando...'
                          : pastorMsg || (formD2.pastor_member_id ? '✓ Pastor selecionado.' : 'Digite pelo menos 2 letras para buscar.')}
                      </p>

                      {pastorResults.length > 0 && !formD2.pastor_member_id && (
                        <div className="mt-2 border border-slate-200 rounded-xl bg-white shadow-lg overflow-hidden divide-y divide-slate-100 max-h-44 overflow-y-auto">
                          {pastorResults.map((m) => (
                            <button
                              type="button"
                              key={m.id}
                              onClick={() => onSelectPastor(m)}
                              className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-sm transition flex items-center justify-between cursor-pointer"
                            >
                              <span className="font-semibold text-slate-800">{m.name}</span>
                              {m.role && (
                                <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200">
                                  {m.role}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Data da Posse</label>
                      <input
                        type="date"
                        value={formD2.pastor_data_posse}
                        onChange={(e) => setFormD2((prev: any) => ({ ...prev, pastor_data_posse: e.target.value }))}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-slate-50/80 rounded-xl border border-slate-200/90 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Church className="w-4 h-4 text-teal-700" />
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Vincular {nomeD1}s (opcional)</span>
                  </div>
                  <span className="text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full">
                    {selectedD1IdsForD2.length} selecionada(s)
                  </span>
                </div>
                {availableDivisoes3ForCurrentD2.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">Nenhuma {nomeD1.toLowerCase()} disponível para vincular a este {nomeD2.toLowerCase()}.</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl bg-white divide-y divide-slate-100 modal-scrollbar mt-3">
                    {availableDivisoes3ForCurrentD2.map((cg) => {
                      const checked = selectedD1IdsForD2.includes(cg.id);
                      return (
                        <label key={cg.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-sm cursor-pointer transition">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              setSelectedD1IdsForD2((prev: string[]) => {
                                if (isChecked) return prev.includes(cg.id) ? prev : [...prev, cg.id];
                                return prev.filter((id) => id !== cg.id);
                              });
                            }}
                            className="w-4 h-4 rounded text-teal-700 focus:ring-teal-600/20 border-slate-300 transition cursor-pointer"
                          />
                          <span className="text-slate-800 font-medium flex-1">{cg.nome}</span>
                          <span className="text-xs text-slate-400 font-medium">{`${(cg as any).cidade || (cg as any).municipio || '-'} / ${cg.uf || '-'}`}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* FORMULÁRIO D3: Supervisão */}
          {isD3Open && (
            <div className="space-y-4.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nome da {nomeD3} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formD1.nome}
                  onChange={(e) => setFormD1((prev: any) => ({ ...prev, nome: e.target.value }))}
                  placeholder={`Ex: ${nomeD3} Norte`}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition bg-white"
                />
              </div>

              <div className="pt-1">
                <label className="inline-flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!!formD1.informar_supervisor}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setFormD1((prev: any) => ({
                        ...prev,
                        informar_supervisor: checked,
                        supervisor_nome: checked ? prev.supervisor_nome : '',
                        supervisor_cpf_input: '',
                        supervisor_member_id: '',
                        supervisor_matricula: '',
                        supervisor_cpf: '',
                        supervisor_data_nascimento: '',
                        supervisor_cargo: '',
                        supervisor_celular: '',
                      }));
                    }}
                    className="w-4.5 h-4.5 rounded text-teal-700 focus:ring-teal-600/20 border-slate-300 transition cursor-pointer"
                  />
                  <span className="text-sm font-semibold text-slate-800">Informar Pastor / Supervisor Responsável</span>
                </label>
              </div>

              {formD1.informar_supervisor && (
                <div className="bg-slate-50/80 rounded-xl border border-slate-200/90 p-4 sm:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="w-4 h-4 text-teal-700" />
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Dados do Supervisor</span>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nome do Supervisor</label>
                    <input
                      type="text"
                      value={formD1.supervisor_nome}
                      onChange={(e) => setFormD1((prev: any) => ({ ...prev, supervisor_nome: e.target.value }))}
                      placeholder="Ex: Pr. João Silva"
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition bg-white"
                    />
                  </div>
                </div>
              )}

              <div className="bg-slate-50/80 rounded-xl border border-slate-200/90 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-teal-700" />
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Vincular {nomeD2}s (opcional)</span>
                  </div>
                  <span className="text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full">
                    {selectedD2IdsForD3.length} selecionado(s)
                  </span>
                </div>
                {availableDivisoes2ForCurrentD1.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">Nenhum {nomeD2.toLowerCase()} disponível para vincular a esta {nomeD3.toLowerCase()}.</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl bg-white divide-y divide-slate-100 modal-scrollbar mt-3">
                    {availableDivisoes2ForCurrentD1.map((c) => {
                      const checked = selectedD2IdsForD3.includes(c.id);
                      return (
                        <label key={c.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-sm cursor-pointer transition">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              setSelectedD2IdsForD3((prev: string[]) => {
                                if (isChecked) return prev.includes(c.id) ? prev : [...prev, c.id];
                                return prev.filter((id) => id !== c.id);
                              });
                            }}
                            className="w-4 h-4 rounded text-teal-700 focus:ring-teal-600/20 border-slate-300 transition cursor-pointer"
                          />
                          <span className="text-slate-800 font-medium">{c.nome}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── STICKY FOOTER (Padrão Membros) ─── */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50/80 backdrop-blur-xs shrink-0">
          <button
            type="button"
            onClick={currentOnClose}
            disabled={saving}
            className="px-5 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs sm:text-sm transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={executeSave}
            disabled={saving}
            className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold text-xs sm:text-sm transition shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="animate-spin w-4 h-4 text-white" />
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 text-white" />
                <span>{saveButtonLabel}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
