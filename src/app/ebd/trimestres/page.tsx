'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import { Calendar, Plus, Trash2, ToggleLeft, ToggleRight, ChevronDown, ChevronUp } from 'lucide-react';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Trimestre {
  id: string;
  numero: number;
  ano: number;
  descricao: string;
  data_inicio: string;
  data_fim: string;
  ativo: boolean;
  created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getSundays(inicio: string, fim: string): string[] {
  const sundays: string[] = [];
  const d = new Date(inicio + 'T12:00:00');
  const end = new Date(fim + 'T12:00:00');
  while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
  while (d <= end) {
    sundays.push(dateStr(d));
    d.setDate(d.getDate() + 7);
  }
  return sundays;
}

function sugerirDatas(numero: number, ano: number): { inicio: string; fim: string } {
  const ranges = [
    { inicio: `${ano}-01-01`, fim: `${ano}-03-31` },
    { inicio: `${ano}-04-01`, fim: `${ano}-06-30` },
    { inicio: `${ano}-07-01`, fim: `${ano}-09-30` },
    { inicio: `${ano}-10-01`, fim: `${ano}-12-31` },
  ];
  return ranges[numero - 1] ?? ranges[0];
}

const TRIM_LABELS = ['', '1º', '2º', '3º', '4º'];

const fmtDate = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');

// ─── Componente ──────────────────────────────────────────────────────────────

export default function EbdTrimestresPage() {
  const { user } = useRequireSupabaseAuth();
  const supabase = useMemo(() => createClient(), []);

  const [ministryId, setMinistryId] = useState<string | null>(null);
  const [trimestres, setTrimestres] = useState<Trimestre[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const anoAtual = new Date().getFullYear();
  const [form, setForm] = useState({
    numero: '2',
    ano: anoAtual.toString(),
    descricao: '',
    data_inicio: '',
    data_fim: '',
  });

  const flash = (tipo: 'ok' | 'erro', texto: string) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 5000);
  };

  const load = useCallback(async (mid: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('ebd_trimestres')
      .select('*')
      .eq('ministry_id', mid)
      .order('ano', { ascending: false })
      .order('numero', { ascending: false });
    setTrimestres(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (!user) return;
    resolveMinistryId(supabase).then(mid => {
      if (mid) { setMinistryId(mid); load(mid); }
    });
  }, [user, supabase, load]);

  // Auto-sugere datas ao mudar número ou ano
  useEffect(() => {
    const n = parseInt(form.numero);
    const a = parseInt(form.ano);
    if (n >= 1 && n <= 4 && a >= 2000) {
      const { inicio, fim } = sugerirDatas(n, a);
      const desc = `${TRIM_LABELS[n]} Trimestre ${a}`;
      setForm(f => ({ ...f, data_inicio: inicio, data_fim: fim, descricao: desc }));
    }
  }, [form.numero, form.ano]);

  const handleSave = async () => {
    if (!ministryId) return;
    if (!form.data_inicio || !form.data_fim) { flash('erro', 'Informe as datas de início e fim.'); return; }
    if (form.data_inicio >= form.data_fim) { flash('erro', 'A data de início deve ser anterior ao fim.'); return; }
    setSaving(true);
    const { error } = await supabase.from('ebd_trimestres').insert({
      ministry_id: ministryId,
      numero: parseInt(form.numero),
      ano: parseInt(form.ano),
      descricao: form.descricao || `${TRIM_LABELS[parseInt(form.numero)]} Trimestre ${form.ano}`,
      data_inicio: form.data_inicio,
      data_fim: form.data_fim,
      ativo: true,
    });
    setSaving(false);
    if (error) { flash('erro', error.message); return; }
    flash('ok', 'Trimestre criado com sucesso!');
    setShowForm(false);
    load(ministryId);
  };

  const toggleAtivo = async (t: Trimestre) => {
    await supabase.from('ebd_trimestres').update({ ativo: !t.ativo }).eq('id', t.id);
    setTrimestres(prev => prev.map(x => x.id === t.id ? { ...x, ativo: !x.ativo } : x));
  };

  const deletar = async (t: Trimestre) => {
    if (!confirm(`Excluir "${t.descricao}"? As aulas vinculadas perderão a referência ao trimestre.`)) return;
    const { error } = await supabase.from('ebd_trimestres').delete().eq('id', t.id);
    if (error) flash('erro', error.message);
    else setTrimestres(prev => prev.filter(x => x.id !== t.id));
  };

  const hoje = dateStr(new Date());

  const previewSundays =
    form.data_inicio && form.data_fim && form.data_inicio < form.data_fim
      ? getSundays(form.data_inicio, form.data_fim)
      : [];

  return (
    <PageLayout
      title="EBD — Trimestres"
      description="Cadastre os trimestres para controlar os domingos de aula"
      activeMenu="ebd-trimestres"
    >
      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
          msg.tipo === 'ok'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {msg.texto}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div />
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />
          Novo Trimestre
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-5">
          <h3 className="text-sm font-bold text-gray-700 mb-4">Novo Trimestre</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Número</label>
              <select
                value={form.numero}
                onChange={e => setForm(f => ({ ...f, numero: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                {[1, 2, 3, 4].map(n => (
                  <option key={n} value={n}>{TRIM_LABELS[n]} Trimestre</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Ano</label>
              <input
                type="number"
                value={form.ano}
                onChange={e => setForm(f => ({ ...f, ano: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                min={2020} max={2099}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Início</label>
              <input
                type="date"
                value={form.data_inicio}
                onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Fim</label>
              <input
                type="date"
                value={form.data_fim}
                onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="col-span-2 md:col-span-4">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Descrição</label>
              <input
                value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Ex: 2º Trimestre 2026"
              />
            </div>
          </div>

          {previewSundays.length > 0 && (
            <p className="text-xs text-gray-500 mt-3">
              <span className="font-semibold text-blue-600">{previewSundays.length} domingos</span> neste período:{' '}
              {previewSundays.slice(0, 3).map(d =>
                new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
              ).join(', ')}
              {previewSundays.length > 3 ? ` ... ${new Date(previewSundays[previewSundays.length - 1] + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}` : ''}
            </p>
          )}

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Criar Trimestre'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Carregando...</div>
      ) : trimestres.length === 0 ? (
        <div className="text-center py-16">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhum trimestre cadastrado</p>
          <p className="text-gray-400 text-sm mt-1">
            Crie o primeiro trimestre para ativar o controle de chamadas por domingo.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {trimestres.map(t => {
            const sundays = getSundays(t.data_inicio, t.data_fim);
            const isExpanded = expandedId === t.id;
            const isCurrentPeriod = t.data_inicio <= hoje && hoje <= t.data_fim;
            const realizados = sundays.filter(d => d < hoje).length;
            const restantes = sundays.filter(d => d >= hoje).length;

            return (
              <div
                key={t.id}
                className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
                  isCurrentPeriod ? 'border-blue-300' : 'border-gray-200'
                }`}
              >
                <div className="flex items-center gap-4 p-4">
                  {/* Badge número */}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
                    t.ativo ? (isCurrentPeriod ? 'bg-blue-600' : 'bg-slate-500') : 'bg-gray-300'
                  }`}>
                    {t.numero}º
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800">{t.descricao}</span>
                      {isCurrentPeriod && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                          Período atual
                        </span>
                      )}
                      {!t.ativo && (
                        <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">
                          Inativo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {fmtDate(t.data_inicio)} a {fmtDate(t.data_fim)}
                      {' · '}<span className="font-medium">{sundays.length} domingos</span>
                      {isCurrentPeriod && ` · ${realizados} realizados · ${restantes} restantes`}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : t.id)}
                      className="p-2 text-gray-400 hover:text-gray-600 transition"
                      title="Ver domingos"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => toggleAtivo(t)}
                      title={t.ativo ? 'Desativar' : 'Ativar'}
                      className="p-2 text-gray-400 hover:text-blue-600 transition"
                    >
                      {t.ativo
                        ? <ToggleRight className="w-5 h-5 text-blue-600" />
                        : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => deletar(t)}
                      className="p-2 text-gray-400 hover:text-red-500 transition"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expansível: grade de domingos */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 p-4">
                    <p className="text-xs font-semibold text-gray-500 mb-3">
                      Domingos do trimestre
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {sundays.map((d, i) => {
                        const isPast = d < hoje;
                        const isToday = d === hoje;
                        return (
                          <span
                            key={d}
                            title={`Semana ${i + 1} — ${fmtDate(d)}`}
                            className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                              isToday
                                ? 'bg-blue-600 text-white'
                                : isPast
                                ? 'bg-slate-200 text-slate-600'
                                : 'bg-white border border-gray-200 text-gray-400'
                            }`}
                          >
                            {new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PageLayout>
  );
}
