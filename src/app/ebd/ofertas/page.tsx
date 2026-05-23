'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { createClient } from '@/lib/supabase-client';
import { resolveEbdScope } from '@/lib/cartoes-templates-sync';
import { fetchConfiguracaoIgrejaFromSupabase, type ConfiguracaoIgreja } from '@/lib/igreja-config-utils';
import { Plus, Printer, X, DollarSign } from 'lucide-react';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Congregacao  { id: string; nome: string; }
interface EbdTrimestre { id: string; numero: number; ano: number; descricao: string; data_inicio: string; data_fim: string; ativo: boolean; }
interface EbdTurma     { id: string; nome: string; church_id: string; }
interface EbdOferta {
  id: string;
  church_id: string;
  aula_id: string | null;
  data_oferta: string;
  trimestre: number | null;
  ano: number;
  valor: number;
  forma_pagamento: string;
  destino: string;
  observacoes: string | null;
  church_nome?: string;
  turma_id?: string | null;
  turma_nome?: string;
}

const FORMAS: Record<string, string> = {
  dinheiro:      'Dinheiro',
  pix:           'PIX',
  cartao:        'Cartão',
  transferencia: 'Transferência',
  cheque:        'Cheque',
};

const DESTINOS: Record<string, string> = {
  tesouraria_local: 'Tesouraria Local',
  tesouraria_geral: 'Tesouraria Geral',
  missoes:          'Missões',
};

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function EbdOfertasPage() {
  const { user } = useRequireSupabaseAuth();
  const { bloqueado } = useRequireModulo('ebd');
  const supabase  = useMemo(() => createClient(), []);

  const [ministryId,    setMinistryId]    = useState<string | null>(null);
  const [churchIdFixed, setChurchIdFixed] = useState<string | null>(null);
  const [congregacoes,  setCongregacoes]  = useState<Congregacao[]>([]);
  const [trimestres,    setTrimestres]    = useState<EbdTrimestre[]>([]);
  const [turmas,        setTurmas]        = useState<EbdTurma[]>([]);
  const [ofertas,       setOfertas]       = useState<EbdOferta[]>([]);
  const [configIgreja,  setConfigIgreja]  = useState<ConfiguracaoIgreja | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [msg,           setMsg]           = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  const [filtroCong,  setFiltroCong]  = useState('');
  const [filtroTrim,  setFiltroTrim]  = useState('');
  const [filtroTurma, setFiltroTurma] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState<string | null>(null);
  const [form, setForm] = useState({
    church_id: '', turma_id: '',
    data_oferta: new Date().toISOString().slice(0, 10),
    valor: '', forma_pagamento: 'dinheiro', destino: 'tesouraria_local',
    trimestre: '', ano: new Date().getFullYear().toString(), observacoes: '',
  });

  const flash = (tipo: 'ok' | 'erro', texto: string) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 4000);
  };

  const load = useCallback(async (mid: string, cid: string | null) => {
    setLoading(true);
    let congsQ = supabase.from('congregacoes').select('id, nome').eq('ministry_id', mid).order('nome');
    if (cid) congsQ = congsQ.eq('id', cid);
    const [congsR, trimsR, turmasR] = await Promise.all([
      congsQ,
      supabase.from('ebd_trimestres').select('*').eq('ministry_id', mid)
        .order('ano', { ascending: false }).order('numero', { ascending: false }),
      supabase.from('ebd_turmas').select('id, nome, church_id').eq('ministry_id', mid).eq('ativo', true).order('nome'),
    ]);
    const congs = congsR.data ?? [];
    setCongregacoes(congs);
    setTrimestres(trimsR.data ?? []);
    setTurmas((turmasR.data ?? []).filter((t: EbdTurma) => !cid || t.church_id === cid));

    let offQ = supabase
      .from('ebd_ofertas')
      .select('id, church_id, aula_id, data_oferta, trimestre, ano, valor, forma_pagamento, destino, observacoes, ebd_aulas(turma_id, ebd_turmas(id, nome))')
      .eq('ministry_id', mid)
      .order('data_oferta', { ascending: false });
    if (cid) offQ = offQ.eq('church_id', cid);
    const { data: offData } = await offQ;
    const congMap = new Map(congs.map((c: Congregacao) => [c.id, c.nome]));
    setOfertas((offData ?? []).map((o: any) => ({
      ...o,
      church_nome: congMap.get(o.church_id) ?? '---',
      turma_id:   o.ebd_aulas?.turma_id ?? null,
      turma_nome: o.ebd_aulas?.ebd_turmas?.nome ?? '(oferta avulsa)',
    })));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (!user || bloqueado) return;
    resolveEbdScope(supabase).then(async scope => {
      if (!scope.ministryId) return;
      setMinistryId(scope.ministryId);
      setChurchIdFixed(scope.churchId);
      if (scope.churchId) setFiltroCong(scope.churchId);
      const config = await fetchConfiguracaoIgrejaFromSupabase(supabase);
      setConfigIgreja(config);
      load(scope.ministryId, scope.churchId);
    });
  }, [user, bloqueado, supabase, load]);

  const abrirNovo = () => {
    setEditId(null);
    setForm({
      church_id: churchIdFixed || filtroCong || '', turma_id: filtroTurma || '',
      data_oferta: new Date().toISOString().slice(0, 10),
      valor: '', forma_pagamento: 'dinheiro', destino: 'tesouraria_local',
      trimestre: '', ano: new Date().getFullYear().toString(), observacoes: '',
    });
    setShowForm(true);
  };

  const abrirEditar = (o: EbdOferta) => {
    setEditId(o.id);
    setForm({
      church_id: o.church_id, turma_id: o.turma_id ?? '',
      data_oferta: o.data_oferta, valor: o.valor.toString(),
      forma_pagamento: o.forma_pagamento, destino: o.destino,
      trimestre: o.trimestre?.toString() ?? '', ano: o.ano.toString(),
      observacoes: o.observacoes ?? '',
    });
    setShowForm(true);
  };

  const salvar = async () => {
    if (!ministryId || !form.church_id || !form.data_oferta || !form.valor) return;
    const valor = parseFloat(form.valor.replace(',', '.'));
    if (isNaN(valor) || valor <= 0) { flash('erro', 'Valor inválido.'); return; }

    let aulaId: string | null = null;
    if (form.turma_id) {
      const { data: aulaData } = await supabase
        .from('ebd_aulas').select('id')
        .eq('turma_id', form.turma_id).eq('data_aula', form.data_oferta).maybeSingle();
      aulaId = aulaData?.id ?? null;
    }

    const payload = {
      ministry_id: ministryId, church_id: form.church_id, aula_id: aulaId,
      data_oferta: form.data_oferta, valor,
      forma_pagamento: form.forma_pagamento, destino: form.destino,
      trimestre: form.trimestre ? parseInt(form.trimestre) : null,
      ano: parseInt(form.ano) || new Date().getFullYear(),
      observacoes: form.observacoes || null,
    };

    if (editId) {
      const { error } = await supabase.from('ebd_ofertas').update(payload).eq('id', editId);
      if (error) { flash('erro', error.message); return; }
    } else {
      const { error } = await supabase.from('ebd_ofertas').insert(payload);
      if (error) { flash('erro', error.message); return; }
    }
    flash('ok', editId ? 'Oferta atualizada!' : 'Oferta registrada!');
    setShowForm(false);
    load(ministryId, churchIdFixed);
  };

  const excluir = async (id: string) => {
    if (!ministryId) return;
    const { error } = await supabase.from('ebd_ofertas').delete().eq('id', id);
    if (error) flash('erro', error.message);
    else { flash('ok', 'Oferta removida.'); load(ministryId, churchIdFixed); }
  };

  const ofertasFiltradas = ofertas.filter(o => {
    if (filtroCong  && o.church_id !== filtroCong)  return false;
    if (filtroTurma && o.turma_id  !== filtroTurma) return false;
    if (filtroTrim) {
      const trim = trimestres.find(t => t.id === filtroTrim);
      if (trim && (o.data_oferta < trim.data_inicio || o.data_oferta > trim.data_fim)) return false;
    }
    return true;
  });

  const totalGeral     = ofertasFiltradas.reduce((s, o) => s + Number(o.valor), 0);
  const totalPorCong   = congregacoes
    .map(c => ({ nome: c.nome, total: ofertasFiltradas.filter(o => o.church_id === c.id).reduce((s, o) => s + Number(o.valor), 0) }))
    .filter(x => x.total > 0);
  const turmaIdsUsados = [...new Set(ofertasFiltradas.map(o => o.turma_id).filter(Boolean))];
  const totalPorTurma  = turmaIdsUsados.map(tid => ({
    nome:  turmas.find(t => t.id === tid)?.nome ?? '(avulsa)',
    total: ofertasFiltradas.filter(o => o.turma_id === tid).reduce((s, o) => s + Number(o.valor), 0),
  }));

  const turmasFiltroForm  = turmas.filter(t => !form.church_id || t.church_id === form.church_id);
  const turmasFiltroLista = turmas.filter(t => !filtroCong || t.church_id === filtroCong);

  if (bloqueado) return null;

  return (
    <PageLayout title="EBD — Caixa" description="Controle de ofertas por turma e congregação" activeMenu="ebd-caixa">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #ofertas-print, #ofertas-print * { visibility: visible !important; }
          #ofertas-print { position: fixed; inset: 0; padding: 24px 32px; }
          .no-print { display: none !important; }
        }
      `}</style>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${msg.tipo === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.texto}
        </div>
      )}

      <div id="ofertas-print">
        {/* Cabeçalho de impressão */}
        <div className="hidden print:block mb-6 border-b pb-4">
          {configIgreja?.logo && <img src={configIgreja.logo} alt="" className="h-14 object-contain mb-2" />}
          <p className="font-bold text-lg">{configIgreja?.nome}</p>
          {configIgreja?.endereco && <p className="text-sm text-gray-500">{configIgreja.endereco}</p>}
          <h2 className="text-base font-bold mt-2">EBD — Relatório de Ofertas</h2>
          <p className="text-xs text-gray-400">Emitido em {new Date().toLocaleDateString('pt-BR')}</p>
        </div>

        {/* Filtros + ações */}
        <div className="flex flex-wrap gap-3 items-end justify-between mb-5 no-print">
          <div className="flex flex-wrap gap-3 items-end">
            {!churchIdFixed && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Igreja</label>
                <select value={filtroCong} onChange={e => { setFiltroCong(e.target.value); setFiltroTurma(''); }}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Todas</option>
                  {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Trimestre</label>
              <select value={filtroTrim} onChange={e => setFiltroTrim(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">Todos</option>
                {trimestres.map(t => <option key={t.id} value={t.id}>{t.descricao}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Turma</label>
              <select value={filtroTurma} onChange={e => setFiltroTurma(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">Todas</option>
                {turmasFiltroLista.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
              <Printer className="h-4 w-4" /> Imprimir
            </button>
            <button onClick={abrirNovo}
              className="flex items-center gap-2 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition">
              <Plus className="h-4 w-4" /> Registrar oferta
            </button>
          </div>
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 mb-1">Total arrecadado</p>
            <p className="text-2xl font-bold text-[#123b63]">{fmtBRL(totalGeral)}</p>
            <p className="text-xs text-gray-400 mt-1">{ofertasFiltradas.length} registro{ofertasFiltradas.length !== 1 ? 's' : ''}</p>
          </div>
          {totalPorCong.length > 1 && totalPorCong.map(x => (
            <div key={x.nome} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <p className="text-xs font-semibold text-gray-500 mb-1 truncate">{x.nome}</p>
              <p className="text-xl font-bold text-gray-800">{fmtBRL(x.total)}</p>
              {totalGeral > 0 && <p className="text-xs text-gray-400 mt-1">{Math.round((x.total / totalGeral) * 100)}% do total</p>}
            </div>
          ))}
        </div>

        {/* Totais por turma */}
        {totalPorTurma.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm mb-5">
            <p className="text-xs font-bold text-gray-500 mb-3">Por turma</p>
            <div className="flex flex-wrap gap-3">
              {totalPorTurma.sort((a, b) => b.total - a.total).map(x => (
                <div key={x.nome} className="bg-gray-50 rounded-lg px-3 py-2 flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-700">{x.nome}</span>
                  <span className="text-xs font-bold text-[#123b63]">{fmtBRL(x.total)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabela */}
        {loading && <p className="text-gray-400 text-sm py-8 text-center">Carregando...</p>}

        {!loading && ofertasFiltradas.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma oferta encontrada para os filtros selecionados.</p>
          </div>
        )}

        {!loading && ofertasFiltradas.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Data</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Turma</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Igreja</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Valor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Forma</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Destino</th>
                  <th className="px-4 py-3 no-print" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {ofertasFiltradas.map(o => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(o.data_oferta + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{o.turma_nome}</td>
                    <td className="px-4 py-3 text-gray-500">{o.church_nome}</td>
                    <td className="px-4 py-3 font-bold text-[#123b63]">{fmtBRL(Number(o.valor))}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{FORMAS[o.forma_pagamento] ?? o.forma_pagamento}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        o.destino === 'tesouraria_local' ? 'bg-blue-50 text-blue-700'  :
                        o.destino === 'missoes'          ? 'bg-green-50 text-green-700' :
                                                           'bg-purple-50 text-purple-700'
                      }`}>
                        {DESTINOS[o.destino] ?? o.destino}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right no-print">
                      <div className="flex gap-3 justify-end">
                        <button onClick={() => abrirEditar(o)} className="text-xs text-blue-500 hover:text-blue-700 font-medium transition">Editar</button>
                        <button onClick={() => excluir(o.id)} className="text-xs text-red-400 hover:text-red-600 font-medium transition">Excluir</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-xs font-bold text-gray-600 text-right">Total:</td>
                  <td className="px-4 py-3 font-bold text-[#123b63]">{fmtBRL(totalGeral)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-[#123b63] text-lg">{editId ? 'Editar Oferta' : 'Registrar Oferta'}</h3>
              <button onClick={() => setShowForm(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              {!churchIdFixed && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Igreja *</label>
                  <select value={form.church_id}
                    onChange={e => setForm(f => ({ ...f, church_id: e.target.value, turma_id: '' }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <option value="">Selecione...</option>
                    {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Turma</label>
                <select value={form.turma_id} onChange={e => setForm(f => ({ ...f, turma_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Avulsa / sem turma específica</option>
                  {turmasFiltroForm.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Data *</label>
                  <input type="date" value={form.data_oferta}
                    onChange={e => setForm(f => ({ ...f, data_oferta: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Valor (R$) *</label>
                  <input type="number" min="0.01" step="0.01" placeholder="0,00"
                    value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Forma de pagamento</label>
                  <select value={form.forma_pagamento} onChange={e => setForm(f => ({ ...f, forma_pagamento: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    {Object.entries(FORMAS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Destino</label>
                  <select value={form.destino} onChange={e => setForm(f => ({ ...f, destino: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    {Object.entries(DESTINOS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Trimestre</label>
                  <select value={form.trimestre} onChange={e => setForm(f => ({ ...f, trimestre: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <option value="">—</option>
                    <option value="1">1º Trimestre</option>
                    <option value="2">2º Trimestre</option>
                    <option value="3">3º Trimestre</option>
                    <option value="4">4º Trimestre</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Ano</label>
                  <input type="number" value={form.ano} onChange={e => setForm(f => ({ ...f, ano: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Observações</label>
                <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                  rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">
                Cancelar
              </button>
              <button onClick={salvar} disabled={!form.church_id || !form.data_oferta || !form.valor}
                className="flex-1 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition disabled:opacity-40 disabled:cursor-not-allowed">
                {editId ? 'Salvar' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
