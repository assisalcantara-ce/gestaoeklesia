'use client';

import { useEffect, useMemo, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import Tabs from '@/components/Tabs';
import Section from '@/components/Section';
import NotificationModal from '@/components/NotificationModal';
import { useRequireModulo } from '@/hooks/useRequireModulo';
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
  const { ctx, bloqueado } = useRequireModulo('secretaria_local');
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
    if (ctx.loading || bloqueado) return;
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
  }, [ctx.loading, bloqueado, supabase]);

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

  if (ctx.loading) return <div className="p-8 text-slate-500 font-medium">Carregando...</div>;
  if (bloqueado) return null;
  if (loadingData) return <div className="p-8 text-slate-500 font-medium">Carregando...</div>;

  return (
    <PageLayout
      title="Departamentos"
      description="Gerencie os departamentos e suas equipes de coordenação."
      activeMenu="departamentos"
    >
      <div className="max-w-5xl mx-auto space-y-4">
        <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}>

        {/* ─── Lista ─────────────────────────────────────────────────────────── */}
        {activeTab === 'lista' && (
          <Section title="">
            <div className="flex justify-end mb-5">
              <button
                onClick={() => { setForm(emptyForm()); setEditId(null); setActiveTab('cadastro'); }}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition border border-emerald-700 cursor-pointer active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" /> Novo Departamento
              </button>
            </div>

            {departamentos.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-10 text-center text-slate-500 font-medium">
                Nenhum departamento cadastrado.
              </div>
            ) : (
              <div className="space-y-3.5">
                {departamentos.map((dep) => (
                  <div
                    key={dep.id}
                    className="p-4 sm:p-5 border border-slate-200/90 rounded-2xl bg-white hover:border-slate-300 shadow-xs hover:shadow-sm transition flex flex-col sm:flex-row items-start justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      {dep.logo_url ? (
                        <img
                          src={dep.logo_url}
                          alt={dep.sigla}
                          className="h-12 w-12 rounded-2xl object-cover border border-slate-200 shadow-xs shrink-0"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-2xl bg-teal-50 text-teal-800 border border-teal-200/80 flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
                          {dep.sigla.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-teal-50 text-teal-800 border border-teal-200/90 text-xs font-bold tracking-wide">
                            {dep.sigla}
                          </span>
                          <span className="font-bold text-slate-900 text-sm sm:text-base">{dep.nome}</span>
                          {!dep.ativo && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                              Inativo
                            </span>
                          )}
                        </div>
                        {dep.descricao && (
                          <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">{dep.descricao}</p>
                        )}
                        {dep.coordenacao && dep.coordenacao.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {dep.coordenacao.map((c, i) => (
                              <span key={i} className="text-xs bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1 text-slate-700 flex items-center gap-1">
                                <span className="font-bold text-slate-900">{c.cargo}:</span>
                                <span className="text-slate-600 font-medium">{c.nome}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0 self-end sm:self-start">
                      <button
                        title="Editar Departamento"
                        onClick={() => handleEdit(dep)}
                        className="p-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200/80 transition cursor-pointer shadow-xs"
                      >
                        <Pencil className="h-3.5 w-3.5 text-teal-700" />
                      </button>
                      <button
                        title="Excluir Departamento"
                        onClick={() => setConfirmDeleteId(dep.id)}
                        className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 transition cursor-pointer shadow-xs"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-rose-600" />
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
            <div className="space-y-6">
              {/* Sigla + Nome */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Sigla <span className="text-rose-500">*</span>
                  </label>
                  <input
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-bold uppercase tracking-widest text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition bg-white"
                    placeholder="Ex: UMADMI"
                    maxLength={20}
                    value={form.sigla}
                    onChange={(e) => setForm((p) => ({ ...p, sigla: e.target.value }))}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nome do Departamento <span className="text-rose-500">*</span>
                  </label>
                  <input
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition bg-white"
                    placeholder="Ex: União de Mocidade da Assembleia de Deus"
                    value={form.nome}
                    onChange={(e) => handleNomeChange(e.target.value)}
                  />
                </div>
              </div>

              {/* Slug + Ordem */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Slug <span className="text-rose-500">*</span>
                  </label>
                  <input
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-mono text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                    placeholder="Ex: grupo-de-jovens"
                    value={form.slug}
                    onChange={(e) => setForm((p) => ({ ...p, slug: slugify(e.target.value) }))}
                  />
                  <p className="text-[11px] text-slate-400 font-medium mt-1">Identificador único no sistema, gerado automaticamente a partir do nome.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Ordem de Exibição</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                    value={form.ordem}
                    onChange={(e) => setForm((p) => ({ ...p, ordem: Number(e.target.value) }))}
                  />
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Descrição / Finalidade</label>
                <textarea
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition resize-none bg-white"
                  rows={2}
                  placeholder="Descrição opcional das atividades do departamento..."
                  value={form.descricao || ''}
                  onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
                />
              </div>

              {/* Logo */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">Logo do Departamento</label>
                <div className="flex items-center gap-4 p-4 border border-slate-200 rounded-2xl bg-slate-50/60">
                  {logoPreview ? (
                    <div className="relative">
                      <img
                        src={logoPreview}
                        alt="Logo"
                        className="h-16 w-16 rounded-2xl object-cover border border-slate-200 shadow-xs"
                      />
                      <button
                        type="button"
                        onClick={handleLogoRemove}
                        className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white rounded-full p-1 hover:bg-rose-700 transition shadow-xs cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-16 w-16 rounded-2xl bg-white border-2 border-dashed border-slate-300 flex items-center justify-center shadow-xs">
                      <span className="text-2xl text-slate-400">🏷️</span>
                    </div>
                  )}
                  <div>
                    <label
                      htmlFor="dep-logo"
                      className="cursor-pointer px-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-xs inline-block"
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
                    <p className="text-[11px] text-slate-400 font-medium mt-1.5">JPG, PNG ou WebP (redimensionado automaticamente).</p>
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
                  className="h-4.5 w-4.5 rounded-md border-slate-300 text-teal-700 focus:ring-teal-600 cursor-pointer"
                />
                <label htmlFor="dep-ativo" className="text-xs sm:text-sm font-semibold text-slate-700 cursor-pointer select-none">
                  Departamento ativo e visível na igreja
                </label>
              </div>

              {/* Equipe de Coordenação */}
              <div className="p-4 border border-slate-200 rounded-2xl bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Equipe de Coordenação</h3>
                    <p className="text-[11px] text-slate-500 font-medium">Líderes, conselheiros e secretários responsáveis</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCoordenacaoAdd}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200/80 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 text-teal-700" /> Adicionar cargo
                  </button>
                </div>

                {form.coordenacao.length === 0 && (
                  <p className="text-xs text-slate-400 italic py-2">Nenhum cargo adicionado ainda.</p>
                )}

                <div className="space-y-2.5">
                  {form.coordenacao.map((item, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        className="w-1/3 px-3.5 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                        placeholder="Cargo (Ex: Coordenador)"
                        value={item.cargo}
                        onChange={(e) => handleCoordenacaoChange(i, 'cargo', e.target.value)}
                      />
                      <input
                        className="flex-1 px-3.5 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                        placeholder="Nome do responsável"
                        value={item.nome}
                        onChange={(e) => handleCoordenacaoChange(i, 'nome', e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => handleCoordenacaoRemove(i)}
                        className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Botões */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                {editId && (
                  <button
                    onClick={handleCancelEdit}
                    className="px-5 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs sm:text-sm transition shadow-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-sm transition border border-emerald-700 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
                >
                  {saving ? 'Salvando...' : editId ? 'Atualizar Departamento' : 'Cadastrar Departamento'}
                </button>
              </div>
            </div>
          </Section>
        )}
        </Tabs>
      </div>

      {/* ─── Modal de Confirmação de Exclusão ──────────────────────────────────── */}
      <NotificationModal
        isOpen={!!confirmDeleteId}
        title="Excluir Departamento"
        message="Tem certeza que deseja excluir este departamento? Esta ação não pode ser desfeita."
        type="warning"
        primaryLabel="Excluir"
        secondaryLabel="Cancelar"
        onClose={() => confirmDeleteId && handleDelete(confirmDeleteId)}
        onSecondary={() => setConfirmDeleteId(null)}
      />

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
