'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import { Plus, Pencil, Trash2, X, BookOpen, ShoppingCart, ChevronDown, ChevronRight } from 'lucide-react';
import { useAppDialog } from '@/providers/AppDialogProvider';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Congregacao { id: string; nome: string; }
interface EbdClasse   { id: string; nome: string; cor: string; }

interface EbdRevista {
  id: string; ministry_id: string; classe_id: string | null;
  titulo: string; editora: string | null; trimestre: number | null;
  ano: number; preco_unitario: number | null; ativo: boolean;
}

interface PedidoItem {
  id?: string; revista_id: string; quantidade_solicitada: number;
  preco_unitario: number | null; revista_titulo?: string;
}

interface EbdPedido {
  id: string; ministry_id: string; church_id: string | null;
  tipo: 'local' | 'consolidado'; trimestre: number | null;
  ano: number; status: string; data_pedido: string | null;
  data_entrega_prevista: string | null; valor_total: number;
  observacoes: string | null;
  // joined
  church_nome?: string;
  itens?: PedidoItem[];
}

type Aba = 'catalogo' | 'pedidos';

const STATUS_MAP: Record<string, { label: string; cor: string }> = {
  rascunho:   { label: 'Rascunho',   cor: 'bg-gray-100 text-gray-600'   },
  enviado:    { label: 'Enviado',    cor: 'bg-blue-100 text-blue-700'   },
  confirmado: { label: 'Confirmado', cor: 'bg-amber-100 text-amber-700' },
  recebido:   { label: 'Recebido',   cor: 'bg-green-100 text-green-700' },
  cancelado:  { label: 'Cancelado',  cor: 'bg-red-100 text-red-600'     },
};

const STATUS_NEXT: Record<string, string> = {
  rascunho: 'enviado', enviado: 'confirmado', confirmado: 'recebido',
};

const fmtBRL = (v: number | null) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const anoAtual = () => new Date().getFullYear();

// ─── Componente ──────────────────────────────────────────────────────────────

export default function EbdRevistasPage() {
  const { user } = useRequireSupabaseAuth();
  const supabase  = useMemo(() => createClient(), []);

  const dialog = useAppDialog();
  const [ministryId,   setMinistryId]   = useState<string | null>(null);
  const [congregacoes, setCongregacoes] = useState<Congregacao[]>([]);
  const [classes,      setClasses]      = useState<EbdClasse[]>([]);
  const [revistas,     setRevistas]     = useState<EbdRevista[]>([]);
  const [pedidos,      setPedidos]      = useState<EbdPedido[]>([]);

  const [aba,     setAba]     = useState<Aba>('catalogo');
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  // Form Revista
  const [showRevForm, setShowRevForm] = useState(false);
  const [editRev,     setEditRev]     = useState<EbdRevista | null>(null);
  const [formRev, setFormRev] = useState({
    classe_id: '', titulo: '', editora: '', trimestre: '', ano: anoAtual().toString(), preco_unitario: '',
  });

  // Form Pedido
  const [showPedForm,  setShowPedForm]  = useState(false);
  const [pedExpandido, setPedExpandido] = useState<string | null>(null);
  const [formPed, setFormPed] = useState({
    tipo: 'local' as 'local' | 'consolidado',
    church_id: '', trimestre: '', ano: anoAtual().toString(),
    data_pedido: '', observacoes: '',
  });
  const [itensPed, setItensPed] = useState<{ revista_id: string; qtd: string }[]>([]);

  // ── Carregar dados ───────────────────────────────────────────────────────

  const load = useCallback(async (mid: string) => {
    setLoading(true);
    const [congsR, classsR, revsR, pedsR] = await Promise.all([
      supabase.from('congregacoes').select('id, nome').eq('ministry_id', mid).order('nome'),
      supabase.from('ebd_classes').select('id, nome, cor').eq('ministry_id', mid).order('ordem'),
      supabase.from('ebd_revistas').select('*').eq('ministry_id', mid).order('ano', { ascending: false }),
      supabase.from('ebd_pedidos_revistas').select('*').eq('ministry_id', mid).order('created_at', { ascending: false }),
    ]);
    setCongregacoes(congsR.data ?? []);
    setClasses(classsR.data ?? []);
    setRevistas(revsR.data ?? []);

    // Enriquece pedidos com nome da congregação
    const congMap = new Map((congsR.data ?? []).map((c: { id: string; nome: string }) => [c.id, c.nome]));
    setPedidos(((pedsR.data ?? []) as EbdPedido[]).map(p => ({ ...p, church_nome: (p.church_id ? congMap.get(p.church_id) : 'Consolidado') as string | undefined })));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (!user) return;
    resolveMinistryId(supabase).then(mid => { if (mid) { setMinistryId(mid); load(mid); } });
  }, [user, supabase, load]);

  const flash = (tipo: 'ok' | 'erro', texto: string) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 4000);
  };

  // ── CRUD Revistas ────────────────────────────────────────────────────────

  const abrirRevForm = (r?: EbdRevista) => {
    setEditRev(r ?? null);
    setFormRev(r
      ? { classe_id: r.classe_id ?? '', titulo: r.titulo, editora: r.editora ?? '', trimestre: r.trimestre?.toString() ?? '', ano: r.ano.toString(), preco_unitario: r.preco_unitario?.toString() ?? '' }
      : { classe_id: '', titulo: '', editora: '', trimestre: '', ano: anoAtual().toString(), preco_unitario: '' });
    setShowRevForm(true);
  };

  const salvarRevista = async () => {
    if (!ministryId || !formRev.titulo.trim()) return;
    const payload = {
      ministry_id: ministryId,
      classe_id: formRev.classe_id || null,
      titulo: formRev.titulo.trim(),
      editora: formRev.editora || null,
      trimestre: formRev.trimestre ? parseInt(formRev.trimestre) : null,
      ano: parseInt(formRev.ano) || anoAtual(),
      preco_unitario: formRev.preco_unitario ? parseFloat(formRev.preco_unitario) : null,
    };
    const { error } = editRev
      ? await supabase.from('ebd_revistas').update(payload).eq('id', editRev.id)
      : await supabase.from('ebd_revistas').insert(payload);
    if (error) flash('erro', error.message);
    else { flash('ok', editRev ? 'Revista atualizada!' : 'Revista cadastrada!'); setShowRevForm(false); load(ministryId); }
  };

  const excluirRevista = async (id: string) => {
    if (!ministryId) return;
    const ok = await dialog.confirm({ title: 'Excluir revista', type: 'warning', message: 'Tem certeza que deseja excluir esta revista?', confirmText: 'Excluir', cancelText: 'Cancelar' });
    if (!ok) return;
    const { error } = await supabase.from('ebd_revistas').delete().eq('id', id);
    if (error) flash('erro', error.message);
    else { flash('ok', 'Revista excluída.'); load(ministryId); }
  };

  // ── Pedidos ──────────────────────────────────────────────────────────────

  const abrirPedForm = () => {
    setFormPed({ tipo: 'local', church_id: '', trimestre: '', ano: anoAtual().toString(), data_pedido: new Date().toISOString().slice(0,10), observacoes: '' });
    setItensPed([{ revista_id: '', qtd: '' }]);
    setShowPedForm(true);
  };

  const salvarPedido = async () => {
    if (!ministryId) return;
    const itensFiltrados = itensPed.filter(i => i.revista_id && parseInt(i.qtd) > 0);
    if (itensFiltrados.length === 0) { flash('erro', 'Adicione pelo menos um item.'); return; }

    const revMap = new Map(revistas.map(r => [r.id, r.preco_unitario ?? 0]));
    const valorTotal = itensFiltrados.reduce((s, i) => s + (parseInt(i.qtd) * (revMap.get(i.revista_id) ?? 0)), 0);

    const { data: pedData, error: pedErr } = await supabase.from('ebd_pedidos_revistas').insert({
      ministry_id: ministryId,
      church_id: formPed.tipo === 'consolidado' ? null : (formPed.church_id || null),
      tipo: formPed.tipo,
      trimestre: formPed.trimestre ? parseInt(formPed.trimestre) : null,
      ano: parseInt(formPed.ano) || anoAtual(),
      status: 'rascunho',
      data_pedido: formPed.data_pedido || null,
      valor_total: valorTotal,
      observacoes: formPed.observacoes || null,
    }).select('id').single();
    if (pedErr) { flash('erro', pedErr.message); return; }

    const itensPayload = itensFiltrados.map(i => ({
      ministry_id: ministryId,
      pedido_id: pedData.id,
      revista_id: i.revista_id,
      quantidade_solicitada: parseInt(i.qtd),
      preco_unitario: revMap.get(i.revista_id) ?? null,
    }));
    const { error: itensErr } = await supabase.from('ebd_pedidos_itens').insert(itensPayload);
    if (itensErr) { flash('erro', itensErr.message); return; }

    flash('ok', 'Pedido criado com sucesso!');
    setShowPedForm(false);
    load(ministryId);
  };

  const avancarStatus = async (p: EbdPedido) => {
    if (!ministryId || !STATUS_NEXT[p.status]) return;
    const { error } = await supabase.from('ebd_pedidos_revistas').update({ status: STATUS_NEXT[p.status] }).eq('id', p.id);
    if (error) flash('erro', error.message);
    else load(ministryId);
  };

  const cancelarPedido = async (id: string) => {
    if (!ministryId) return;
    const ok = await dialog.confirm({ title: 'Cancelar pedido', type: 'warning', message: 'Tem certeza que deseja cancelar este pedido?', confirmText: 'Cancelar pedido', cancelText: 'Voltar' });
    if (!ok) return;
    await supabase.from('ebd_pedidos_revistas').update({ status: 'cancelado' }).eq('id', id);
    load(ministryId);
  };

  const carregarItens = useCallback(async (pedidoId: string) => {
    const { data } = await supabase.from('ebd_pedidos_itens')
      .select('id, revista_id, quantidade_solicitada, preco_unitario')
      .eq('pedido_id', pedidoId);
    const revMap = new Map(revistas.map(r => [r.id, r.titulo]));
    setPedidos(prev => prev.map(p => p.id === pedidoId
      ? { ...p, itens: ((data ?? []) as PedidoItem[]).map(i => ({ ...i, revista_titulo: revMap.get(i.revista_id) ?? '—' })) }
      : p));
  }, [supabase, revistas]);

  const toggleExpandir = (id: string) => {
    if (pedExpandido === id) { setPedExpandido(null); return; }
    setPedExpandido(id);
    carregarItens(id);
  };

  // ── Filtros ──────────────────────────────────────────────────────────────

  const TABS = [
    { id: 'catalogo'as Aba, label: 'Catálogo de Revistas', icon: <BookOpen className="h-4 w-4" />, count: revistas.length },
    { id: 'pedidos' as Aba, label: 'Pedidos',               icon: <ShoppingCart className="h-4 w-4" />, count: pedidos.length },
  ];

  return (
    <PageLayout title="EBD — Revistas" description="Catálogo de revistas e pedidos trimestrais" activeMenu="ebd-revistas">
      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${msg.tipo === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.texto}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setAba(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition ${
              aba === t.id ? 'bg-white text-[#123b63] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.icon} {t.label}
            <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${aba === t.id ? 'bg-[#123b63]/10 text-[#123b63]' : 'bg-gray-200 text-gray-500'}`}>{t.count}</span>
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-400 text-sm py-8 text-center">Carregando...</p>}

      {/* ══ ABA: CATÁLOGO ══ */}
      {aba === 'catalogo' && !loading && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => abrirRevForm()}
              className="flex items-center gap-2 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition">
              <Plus className="h-4 w-4" /> Nova Revista
            </button>
          </div>

          {revistas.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma revista cadastrada.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {revistas.map(r => {
                const cls = classes.find(c => c.id === r.classe_id);
                return (
                  <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-800 text-sm truncate">{r.titulo}</h4>
                        {r.editora && <p className="text-xs text-gray-400">{r.editora}</p>}
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button onClick={() => abrirRevForm(r)} className="text-gray-300 hover:text-[#123b63] transition"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => excluirRevista(r.id)} className="text-gray-300 hover:text-red-500 transition"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {cls && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: cls.cor + '20', color: cls.cor }}>
                          {cls.nome}
                        </span>
                      )}
                      {r.trimestre && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                          {r.trimestre}º Tri/{r.ano}
                        </span>
                      )}
                      {r.preco_unitario && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                          {fmtBRL(r.preco_unitario)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Form Revista */}
          {showRevForm && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="font-bold text-[#123b63] text-lg">{editRev ? 'Editar Revista' : 'Nova Revista'}</h3>
                  <button onClick={() => setShowRevForm(false)}><X className="h-5 w-5 text-gray-400" /></button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Título *</label>
                    <input value={formRev.titulo} onChange={e => setFormRev(f => ({ ...f, titulo: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Editora</label>
                      <input value={formRev.editora} onChange={e => setFormRev(f => ({ ...f, editora: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Classe EBD</label>
                      <select value={formRev.classe_id} onChange={e => setFormRev(f => ({ ...f, classe_id: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                        <option value="">Nenhuma</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Trimestre</label>
                      <select value={formRev.trimestre} onChange={e => setFormRev(f => ({ ...f, trimestre: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                        <option value="">Não definido</option>
                        {[1,2,3,4].map(t => <option key={t} value={t}>{t}º Trimestre</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Ano *</label>
                      <input type="number" value={formRev.ano} onChange={e => setFormRev(f => ({ ...f, ano: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Preço unitário (R$)</label>
                      <input type="number" step="0.01" value={formRev.preco_unitario} onChange={e => setFormRev(f => ({ ...f, preco_unitario: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="0,00" />
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setShowRevForm(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                  <button onClick={salvarRevista} className="flex-1 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45]">Salvar</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ ABA: PEDIDOS ══ */}
      {aba === 'pedidos' && !loading && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={abrirPedForm}
              className="flex items-center gap-2 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition">
              <Plus className="h-4 w-4" /> Novo Pedido
            </button>
          </div>

          {pedidos.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum pedido registrado.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pedidos.map(p => {
                const st = STATUS_MAP[p.status] ?? STATUS_MAP.rascunho;
                const prox = STATUS_NEXT[p.status];
                const expandido = pedExpandido === p.id;
                return (
                  <div key={p.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-4 px-5 py-4">
                      <button onClick={() => toggleExpandir(p.id)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                        {expandido ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-800 text-sm">
                            {p.tipo === 'consolidado' ? '📋 Pedido Consolidado' : `🏛 ${p.church_nome ?? '—'}`}
                          </span>
                          {p.trimestre && <span className="text-xs text-gray-400">{p.trimestre}º Tri/{p.ano}</span>}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {p.data_pedido ? new Date(p.data_pedido).toLocaleDateString('pt-BR') : 'Sem data'} · {fmtBRL(p.valor_total)}
                        </p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0 ${st.cor}`}>{st.label}</span>
                      <div className="flex gap-2 flex-shrink-0">
                        {prox && (
                          <button onClick={() => avancarStatus(p)}
                            className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg font-medium hover:bg-blue-100 transition">
                            → {STATUS_MAP[prox]?.label}
                          </button>
                        )}
                        {p.status !== 'cancelado' && p.status !== 'recebido' && (
                          <button onClick={() => cancelarPedido(p.id)} className="text-xs text-red-400 hover:text-red-600 transition">Cancelar</button>
                        )}
                      </div>
                    </div>

                    {expandido && (
                      <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50">
                        {p.itens == null ? (
                          <p className="text-sm text-gray-400">Carregando itens...</p>
                        ) : p.itens.length === 0 ? (
                          <p className="text-sm text-gray-400">Nenhum item neste pedido.</p>
                        ) : (
                          <table className="w-full text-sm">
                            <thead>
                              <tr>
                                <th className="text-left text-xs font-semibold text-gray-500 pb-2">Revista</th>
                                <th className="text-right text-xs font-semibold text-gray-500 pb-2">Qtd</th>
                                <th className="text-right text-xs font-semibold text-gray-500 pb-2">Preço</th>
                                <th className="text-right text-xs font-semibold text-gray-500 pb-2">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {p.itens.map(i => (
                                <tr key={i.revista_id} className="border-t border-gray-100">
                                  <td className="py-2 text-gray-700">{i.revista_titulo}</td>
                                  <td className="py-2 text-right text-gray-600">{i.quantidade_solicitada}</td>
                                  <td className="py-2 text-right text-gray-500">{fmtBRL(i.preco_unitario)}</td>
                                  <td className="py-2 text-right font-medium text-gray-800">
                                    {fmtBRL(i.preco_unitario != null ? i.quantidade_solicitada * i.preco_unitario : null)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                        {p.observacoes && <p className="text-xs text-gray-400 mt-3 italic">{p.observacoes}</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Form Pedido */}
          {showPedForm && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="font-bold text-[#123b63] text-lg">Novo Pedido de Revistas</h3>
                  <button onClick={() => setShowPedForm(false)}><X className="h-5 w-5 text-gray-400" /></button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo de pedido</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['local', 'consolidado'] as const).map(tipo => (
                        <button key={tipo} onClick={() => setFormPed(f => ({ ...f, tipo }))}
                          className={`py-2.5 rounded-lg text-sm font-semibold border transition ${formPed.tipo === tipo ? 'border-[#123b63] bg-[#123b63]/5 text-[#123b63]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                          {tipo === 'local' ? '🏛 Por Igreja' : '📋 Consolidado'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {formPed.tipo === 'local' && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Igreja *</label>
                      <select value={formPed.church_id} onChange={e => setFormPed(f => ({ ...f, church_id: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                        <option value="">Selecione...</option>
                        {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Trimestre</label>
                      <select value={formPed.trimestre} onChange={e => setFormPed(f => ({ ...f, trimestre: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                        <option value="">—</option>
                        {[1,2,3,4].map(t => <option key={t} value={t}>{t}º Tri</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Ano *</label>
                      <input type="number" value={formPed.ano} onChange={e => setFormPed(f => ({ ...f, ano: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Data do pedido</label>
                      <input type="date" value={formPed.data_pedido} onChange={e => setFormPed(f => ({ ...f, data_pedido: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-4">
                    <div className="flex justify-between items-center mb-3">
                      <p className="text-xs font-bold text-gray-600">Itens do pedido</p>
                      <button onClick={() => setItensPed(i => [...i, { revista_id: '', qtd: '' }])}
                        className="text-xs px-2.5 py-1 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200 transition flex items-center gap-1">
                        <Plus className="h-3 w-3" /> Linha
                      </button>
                    </div>
                    <div className="space-y-2">
                      {itensPed.map((item, idx) => (
                        <div key={idx} className="grid grid-cols-[1fr_80px_28px] gap-2 items-center">
                          <select value={item.revista_id} onChange={e => setItensPed(prev => prev.map((x, i) => i === idx ? { ...x, revista_id: e.target.value } : x))}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                            <option value="">Selecione a revista...</option>
                            {revistas.filter(r => r.ativo).map(r => <option key={r.id} value={r.id}>{r.titulo}</option>)}
                          </select>
                          <input type="number" min="1" placeholder="Qtd" value={item.qtd}
                            onChange={e => setItensPed(prev => prev.map((x, i) => i === idx ? { ...x, qtd: e.target.value } : x))}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-center" />
                          <button onClick={() => setItensPed(prev => prev.filter((_, i) => i !== idx))}
                            className="text-gray-300 hover:text-red-400 transition"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Observações</label>
                    <textarea value={formPed.observacoes} onChange={e => setFormPed(f => ({ ...f, observacoes: e.target.value }))}
                      rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setShowPedForm(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                  <button onClick={salvarPedido} className="flex-1 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45]">Criar Pedido</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </PageLayout>
  );
}
