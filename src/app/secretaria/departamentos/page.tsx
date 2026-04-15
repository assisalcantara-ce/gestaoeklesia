'use client';

import { useEffect, useMemo, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import Tabs from '@/components/Tabs';
import Section from '@/components/Section';
import NotificationModal from '@/components/NotificationModal';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import { Pencil, Plus, Trash2, X } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CargoCoord {
  cargo: string;
  nome: string;
}

interface Departamento {
  id: string;
  ministry_id: string;
  sigla: string;
  nome: string;
  slug: string;
  descricao?: string | null;
  logo_url?: string | null;
  coordenacao: CargoCoord[];
  ativo: boolean;
  ordem: number;
  created_at?: string | null;
  updated_at?: string | null;
}

type FormDep = Omit<Departamento, 'id' | 'ministry_id' | 'created_at' | 'updated_at'>;

const TABS = [
  { id: 'lista', label: 'Departamentos', icon: '🏷️' },
  { id: 'cadastro', label: 'Cadastro', icon: '➕' },
];

const emptyForm = (): FormDep => ({
  sigla: '',
  nome: '',
  slug: '',
  descricao: '',
  logo_url: null,
  coordenacao: [],
  ativo: true,
  ordem: 0,
});

const compressImageToBase64 = (file: File, maxSize = 200): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ratio = img.width / img.height;
        let w = maxSize, h = maxSize;
        if (ratio > 1) h = Math.round(maxSize / ratio);
        else w = Math.round(maxSize * ratio);
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const slugify = (str: string) =>
  str.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DepartamentosPage() {
  const { loading } = useRequireSupabaseAuth();
  const supabase = useMemo(() => createClient(), []);


  const [activeTab, setActiveTab] = useState('lista');
  const [loadingData, setLoadingData] = useState(true);
  const [ministryId, setMinistryId] = useState<string | null>(null);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [form, setForm] = useState<FormDep>(emptyForm());
  const [editId, setEditId] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ open: boolean; title: string; message: string; type: 'success' | 'error' | 'info' }>({
    open: false, title: '', message: '', type: 'success',
  });

  const showModal = (title: string, message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setModal({ open: true, title, message, type });
  };

  // ── Carrega dados ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (loading) return;
    (async () => {
      setLoadingData(true);
      const mid = await resolveMinistryId(supabase);
      setMinistryId(mid);
      if (!mid) { setLoadingData(false); return; }
      const { data } = await supabase
        .from('departamentos')
        .select('*')
        .eq('ministry_id', mid)
        .order('ordem', { ascending: true })
        .order('nome', { ascending: true });
      setDepartamentos((data as Departamento[]) || []);
      setLoadingData(false);
    })();
  }, [loading, supabase]);

  // ── Form helpers ───────────────────────────────────────────────────────────

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await compressImageToBase64(file, 200);
    setLogoPreview(b64);
    setForm((p) => ({ ...p, logo_url: b64 }));
  };

  const handleLogoRemove = () => {
    setLogoPreview(null);
    setForm((p) => ({ ...p, logo_url: null }));
  };

  const handleNomeChange = (nome: string) => {
    setForm((prev) => ({
      ...prev,
      nome,
      slug: editId ? prev.slug : slugify(nome),
    }));
  };

  const handleCoordenacaoAdd = () => {
    setForm((prev) => ({
      ...prev,
      coordenacao: [...prev.coordenacao, { cargo: '', nome: '' }],
    }));
  };

  const handleCoordenacaoChange = (index: number, field: keyof CargoCoord, value: string) => {
    setForm((prev) => {
      const next = [...prev.coordenacao];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, coordenacao: next };
    });
  };

  const handleCoordenacaoRemove = (index: number) => {
    setForm((prev) => ({
      ...prev,
      coordenacao: prev.coordenacao.filter((_, i) => i !== index),
    }));
  };

  // ── Salvar ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!ministryId) return;
    if (!form.sigla.trim() || !form.nome.trim() || !form.slug.trim()) {
      showModal('Campos obrigatórios', 'Preencha Sigla, Nome e Slug.', 'error');
      return;
    }
    setSaving(true);
    const now = new Date().toISOString();
    const payload = {
      ministry_id: ministryId,
      sigla: form.sigla.trim().toUpperCase(),
      nome: form.nome.trim(),
      slug: form.slug.trim(),
      descricao: form.descricao?.trim() || null,
      logo_url: form.logo_url || null,
      coordenacao: form.coordenacao.filter((c) => c.cargo.trim()),
      ativo: form.ativo,
      ordem: form.ordem,
      updated_at: now,
    };

    if (editId) {
      const { error } = await supabase
        .from('departamentos')
        .update(payload)
        .eq('id', editId);
      if (error) { showModal('Erro', error.message, 'error'); setSaving(false); return; }
      setDepartamentos((prev) => prev.map((d) => d.id === editId ? { ...d, ...payload } : d));
      showModal('Salvo!', 'Departamento atualizado com sucesso.');
    } else {
      const { data, error } = await supabase
        .from('departamentos')
        .insert({ ...payload, created_at: now })
        .select()
        .single();
      if (error) { showModal('Erro', error.message, 'error'); setSaving(false); return; }
      setDepartamentos((prev) => [...prev, data as Departamento]);
      showModal('Cadastrado!', 'Departamento cadastrado com sucesso.');
    }
    setSaving(false);
    setForm(emptyForm());
    setEditId(null);
    setActiveTab('lista');
  };

  // ── Editar ─────────────────────────────────────────────────────────────────

  const handleEdit = (dep: Departamento) => {
    setForm({
      sigla: dep.sigla,
      nome: dep.nome,
      slug: dep.slug,
      descricao: dep.descricao || '',
      logo_url: dep.logo_url || null,
      coordenacao: dep.coordenacao || [],
      ativo: dep.ativo,
      ordem: dep.ordem,
    });
    setLogoPreview(dep.logo_url || null);
    setEditId(dep.id);
    setActiveTab('cadastro');
  };

  const handleCancelEdit = () => {
    setForm(emptyForm());
    setLogoPreview(null);
    setEditId(null);
    setActiveTab('lista');
  };

  // ── Excluir ────────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('departamentos').delete().eq('id', id);
    if (error) { showModal('Erro', error.message, 'error'); return; }
    setDepartamentos((prev) => prev.filter((d) => d.id !== id));
    setConfirmDeleteId(null);
    showModal('Excluído!', 'Departamento removido com sucesso.');
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading || loadingData) return <div className="p-8 text-gray-500">Carregando...</div>;

  return (
    <PageLayout
      title="Departamentos"
      description="Gerencie os departamentos e suas equipes de coordenação."
      activeMenu="departamentos"
    >
      <div className="max-w-4xl mx-auto space-y-4">
        <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}>

        {/* ─── Lista ─────────────────────────────────────────────────────────── */}
        {activeTab === 'lista' && (
          <Section title="">
            <div className="flex justify-end mb-4">
              <button
                onClick={() => { setForm(emptyForm()); setEditId(null); setActiveTab('cadastro'); }}
                className="flex items-center gap-2 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition"
              >
                <Plus className="h-4 w-4" /> Novo Departamento
              </button>
            </div>

            {departamentos.length === 0 ? (
              <p className="text-center text-gray-400 py-12">Nenhum departamento cadastrado.</p>
            ) : (
              <div className="space-y-3">
                {departamentos.map((dep) => (
                  <div
                    key={dep.id}
                    className="flex items-start justify-between gap-4 p-4 border border-gray-200 rounded-lg bg-white hover:shadow-sm transition"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                      {dep.logo_url ? (
                        <img
                          src={dep.logo_url}
                          alt={dep.sigla}
                          className="h-10 w-10 rounded-full object-cover border border-gray-200 shrink-0"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-[#123b63]/10 flex items-center justify-center shrink-0">
                          <span className="text-[#123b63] text-xs font-bold">{dep.sigla.charAt(0)}</span>
                        </div>
                      )}
                      <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#123b63]/10 text-[#123b63] text-xs font-bold tracking-wide">
                          {dep.sigla}
                        </span>
                        <span className="font-semibold text-gray-800 text-sm">{dep.nome}</span>
                        {!dep.ativo && (
                          <span className="text-xs text-gray-400 italic">inativo</span>
                        )}
                      </div>
                      {dep.descricao && (
                        <p className="text-xs text-gray-500 mt-1">{dep.descricao}</p>
                      )}
                      {dep.coordenacao && dep.coordenacao.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {dep.coordenacao.map((c, i) => (
                            <span key={i} className="text-xs bg-gray-100 rounded px-2 py-0.5 text-gray-600">
                              <span className="font-semibold">{c.cargo}:</span> {c.nome}
                            </span>
                          ))}
                        </div>
                      )}
                      </div>
                    </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        title="Editar"
                        onClick={() => handleEdit(dep)}
                        className="p-1.5 rounded hover:bg-blue-50 text-blue-600 transition"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        title="Excluir"
                        onClick={() => setConfirmDeleteId(dep.id)}
                        className="p-1.5 rounded hover:bg-red-50 text-red-500 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* ─── Cadastro ──────────────────────────────────────────────────────── */}
        {activeTab === 'cadastro' && (
          <Section title={editId ? 'Editar Departamento' : 'Novo Departamento'}>
            <div className="space-y-5">
              {/* Sigla + Nome */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Sigla <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm uppercase tracking-widest"
                    placeholder="Ex: UMADMI"
                    maxLength={20}
                    value={form.sigla}
                    onChange={(e) => setForm((p) => ({ ...p, sigla: e.target.value }))}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Nome <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="Ex: União de Mocidade da AD Missões"
                    value={form.nome}
                    onChange={(e) => handleNomeChange(e.target.value)}
                  />
                </div>
              </div>

              {/* Slug + Ordem */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Slug <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-600"
                    placeholder="Ex: grupo-de-jovens"
                    value={form.slug}
                    onChange={(e) => setForm((p) => ({ ...p, slug: slugify(e.target.value) }))}
                  />
                  <p className="text-xs text-gray-400 mt-1">Identificador único. Gerado automaticamente a partir do nome.</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Ordem</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    value={form.ordem}
                    onChange={(e) => setForm((p) => ({ ...p, ordem: Number(e.target.value) }))}
                  />
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Descrição</label>
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
                  rows={2}
                  placeholder="Descrição opcional do departamento..."
                  value={form.descricao || ''}
                  onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
                />
              </div>

              {/* Logo */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Logo do Departamento</label>
                <div className="flex items-center gap-4">
                  {logoPreview ? (
                    <div className="relative">
                      <img
                        src={logoPreview}
                        alt="Logo"
                        className="h-16 w-16 rounded-full object-cover border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={handleLogoRemove}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                      <span className="text-2xl text-gray-300">🏷️</span>
                    </div>
                  )}
                  <div>
                    <label
                      htmlFor="dep-logo"
                      className="cursor-pointer px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition"
                    >
                      {logoPreview ? 'Trocar imagem' : 'Selecionar imagem'}
                    </label>
                    <input
                      id="dep-logo"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoChange}
                    />
                    <p className="text-xs text-gray-400 mt-1">JPG, PNG ou WebP. Redimensionado para 200×200px.</p>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="dep-ativo"
                  checked={form.ativo}
                  onChange={(e) => setForm((p) => ({ ...p, ativo: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-[#123b63]"
                />
                <label htmlFor="dep-ativo" className="text-sm text-gray-700">Departamento ativo</label>
              </div>

              {/* Equipe de Coordenação */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-gray-700">Equipe de Coordenação</label>
                  <button
                    type="button"
                    onClick={handleCoordenacaoAdd}
                    className="flex items-center gap-1 text-xs text-[#123b63] hover:underline font-semibold"
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar cargo
                  </button>
                </div>

                {form.coordenacao.length === 0 && (
                  <p className="text-xs text-gray-400 italic">Nenhum cargo adicionado ainda.</p>
                )}

                <div className="space-y-2">
                  {form.coordenacao.map((item, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        className="w-1/3 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                        placeholder="Cargo (Ex: Líder)"
                        value={item.cargo}
                        onChange={(e) => handleCoordenacaoChange(i, 'cargo', e.target.value)}
                      />
                      <input
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                        placeholder="Nome do responsável"
                        value={item.nome}
                        onChange={(e) => handleCoordenacaoChange(i, 'nome', e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => handleCoordenacaoRemove(i)}
                        className="p-1.5 text-red-400 hover:text-red-600 transition"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Botões */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : editId ? 'Atualizar' : 'Cadastrar'}
                </button>
                {editId && (
                  <button
                    onClick={handleCancelEdit}
                    className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          </Section>
        )}
        </Tabs>
      </div>

      {/* ─── Confirm Delete ──────────────────────────────────────────────────── */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-base font-bold text-gray-800 mb-2">Excluir Departamento</h3>
            <p className="text-sm text-gray-600 mb-5">
              Tem certeza? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition"
              >
                Excluir
              </button>
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Notification Modal ───────────────────────────────────────────────── */}
      <NotificationModal
        isOpen={modal.open}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        onClose={() => setModal((p) => ({ ...p, open: false }))}
      />
    </PageLayout>
  );
}
