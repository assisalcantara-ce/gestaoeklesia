'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { createClient } from '@/lib/supabase-client';
import { resolveEbdScope } from '@/lib/cartoes-templates-sync';
import { Plus, Pencil, Trash2, X, BookOpen, Sparkles } from 'lucide-react';
import { useAppDialog } from '@/providers/AppDialogProvider';

interface EbdClasse {
  id: string; ministry_id: string; nome: string;
  faixa_etaria_min: number | null; faixa_etaria_max: number | null;
  descricao: string | null; cor: string; ordem: number;
  padrao: boolean; ativo: boolean;
}

const CORES_CLASSE = [
  '#ec4899','#f97316','#eab308','#22c55e',
  '#3b82f6','#8b5cf6','#123b63','#6b7280',
  '#ef4444','#14b8a6','#f59e0b','#06b6d4',
];

export default function EbdClassesPage() {
  const { user } = useRequireSupabaseAuth();
  const { bloqueado } = useRequireModulo('ebd');
  const supabase  = useMemo(() => createClient(), []);
  const dialog    = useAppDialog();

  const [ministryId, setMinistryId] = useState<string | null>(null);
  const [classes,    setClasses]    = useState<EbdClasse[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [seeding,    setSeeding]    = useState(false);
  const [msg,        setMsg]        = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  const [showForm,   setShowForm]   = useState(false);
  const [editClasse, setEditClasse] = useState<EbdClasse | null>(null);
  const [form,       setForm]       = useState({ nome: '', faixa_etaria_min: '', faixa_etaria_max: '', descricao: '', cor: '#3b82f6', ordem: 0 });

  const flash = (tipo: 'ok' | 'erro', texto: string) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 4000);
  };

  const load = useCallback(async (mid: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('ebd_classes')
      .select('*')
      .eq('ministry_id', mid)
      .order('ordem')
      .order('nome');
    setClasses(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (!user || bloqueado) return;
    resolveEbdScope(supabase).then(scope => {
      if (scope.ministryId) {
        setMinistryId(scope.ministryId);
        load(scope.ministryId);
      }
    });
  }, [user, bloqueado, supabase, load]);

  const handleSeedClasses = async () => {
    if (!ministryId) return;
    setSeeding(true);
    const { error } = await supabase.rpc('ebd_seed_classes_padrao', { p_ministry_id: ministryId });
    if (error) flash('erro', error.message);
    else { flash('ok', 'Classes padrão importadas com sucesso!'); load(ministryId); }
    setSeeding(false);
  };

  const abrirForm = (c?: EbdClasse) => {
    setEditClasse(c ?? null);
    setForm(c
      ? { nome: c.nome, faixa_etaria_min: c.faixa_etaria_min?.toString() ?? '', faixa_etaria_max: c.faixa_etaria_max?.toString() ?? '', descricao: c.descricao ?? '', cor: c.cor, ordem: c.ordem }
      : { nome: '', faixa_etaria_min: '', faixa_etaria_max: '', descricao: '', cor: '#3b82f6', ordem: 0 });
    setShowForm(true);
  };

  const salvar = async () => {
    if (!ministryId || !form.nome.trim()) return;
    const payload = {
      ministry_id: ministryId,
      nome: form.nome.trim().toUpperCase(),
      faixa_etaria_min: form.faixa_etaria_min ? parseInt(form.faixa_etaria_min) : null,
      faixa_etaria_max: form.faixa_etaria_max ? parseInt(form.faixa_etaria_max) : null,
      descricao: form.descricao || null,
      cor: form.cor,
      ordem: form.ordem,
    };
    const { error } = editClasse
      ? await supabase.from('ebd_classes').update(payload).eq('id', editClasse.id)
      : await supabase.from('ebd_classes').insert(payload);
    if (error) flash('erro', error.message);
    else { flash('ok', editClasse ? 'Classe atualizada!' : 'Classe criada!'); setShowForm(false); load(ministryId); }
  };

  const excluir = async (id: string) => {
    if (!ministryId) return;
    const ok = await dialog.confirm({ title: 'Excluir classe', type: 'warning', message: 'Tem certeza que deseja excluir esta classe?', confirmText: 'Excluir', cancelText: 'Cancelar' });
    if (!ok) return;
    const { error } = await supabase.from('ebd_classes').delete().eq('id', id);
    if (error) flash('erro', error.message);
    else { flash('ok', 'Classe excluída.'); load(ministryId); }
  };

  if (bloqueado) return null;

  return (
    <PageLayout title="EBD — Classes" description="Cadastro e gerenciamento de classes da Escola Bíblica Dominical" activeMenu="ebd-cadastro-classes">
      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${msg.tipo === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.texto}
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-base font-bold text-gray-700">Classes EBD ({classes.length})</h2>
        <div className="flex gap-2">
          {classes.length === 0 && (
            <button onClick={handleSeedClasses} disabled={seeding}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 transition disabled:opacity-60">
              <Sparkles className="h-4 w-4" />
              {seeding ? 'Importando...' : 'Importar classes padrão'}
            </button>
          )}
          <button onClick={() => abrirForm()}
            className="flex items-center gap-2 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition">
            <Plus className="h-4 w-4" /> Nova Classe
          </button>
        </div>
      </div>

      {loading && <p className="text-gray-400 text-sm py-8 text-center">Carregando...</p>}

      {!loading && classes.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma classe cadastrada.</p>
          <p className="text-xs mt-1">Use &quot;Importar classes padrão&quot; para começar rapidamente.</p>
        </div>
      )}

      {!loading && classes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {classes.map(c => {
            const hasAge = c.faixa_etaria_min !== null || c.faixa_etaria_max !== null;
            const ageLabel = hasAge ? `${c.faixa_etaria_min ?? '0'} – ${c.faixa_etaria_max ?? '∞'} anos` : null;
            return (
              <div key={c.id} className="group relative bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-all duration-200">
                <div className="h-1.5 w-full" style={{ backgroundColor: c.cor }} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-11 w-11 rounded-xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0 shadow-sm"
                        style={{ backgroundColor: c.cor }}
                      >
                        {c.nome.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-gray-800 text-sm leading-tight">{c.nome}</p>
                        {c.descricao && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[120px]">{c.descricao}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => abrirForm(c)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-[#123b63] hover:bg-blue-50 transition"
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => excluir(c.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {ageLabel && (
                    <div
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium mb-3"
                      style={{ backgroundColor: `${c.cor}18`, color: c.cor }}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {ageLabel}
                    </div>
                  )}

                  {c.padrao && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      Padrão
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-[#123b63] text-lg">{editClasse ? 'Editar Classe' : 'Nova Classe'}</h3>
              <button onClick={() => setShowForm(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Nome da classe *</label>
                <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value.toUpperCase() }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Ex: Adolescentes" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Idade mínima</label>
                  <input type="number" value={form.faixa_etaria_min} onChange={e => setForm(f => ({ ...f, faixa_etaria_min: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Ex: 12" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Idade máxima</label>
                  <input type="number" value={form.faixa_etaria_max} onChange={e => setForm(f => ({ ...f, faixa_etaria_max: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Ex: 17 (vazio = sem limite)" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Cor identificadora</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {CORES_CLASSE.map(cor => (
                    <button key={cor} onClick={() => setForm(f => ({ ...f, cor }))}
                      className={`h-7 w-7 rounded-full transition ${form.cor === cor ? 'ring-2 ring-offset-2 ring-gray-600 scale-110' : ''}`}
                      style={{ backgroundColor: cor }} />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Descrição</label>
                <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Opcional" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">Cancelar</button>
              <button onClick={salvar} className="flex-1 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
