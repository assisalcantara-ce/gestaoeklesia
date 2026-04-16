'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import NotificationModal from '@/components/NotificationModal';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import { Pencil, Plus, Trash2, X, TrendingUp, Building2, Tag, Printer, Users, CalendarDays, Lock, Unlock } from 'lucide-react';
import { fetchConfiguracaoIgrejaFromSupabase } from '@/lib/igreja-config-utils';
import type { ConfiguracaoIgreja } from '@/lib/igreja-config-utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Congregacao { id: string; nome: string; }
interface Departamento { id: string; nome: string; sigla: string; }

interface Dizimista {
  id: string;
  nome: string;
  congregacao_id: string | null;
  congregacao_nome: string;
}

interface Lancamento {
  id: string;
  ministry_id: string;
  congregacao_id: string | null;
  departamento_id: string | null;
  tipo_recebimento: TipoRecebimento;
  tipo_movimento: TipoMovimento;
  descricao: string | null;
  referencia: string | null;
  valor: number;
  forma_pagamento: FormaPagamento;
  data_lancamento: string;
  observacoes: string | null;
  criado_por: string | null;
  created_at: string;
  // joined
  congregacao_nome?: string;
  departamento_nome?: string;
}

type TipoRecebimento = 'oferta' | 'dizimo' | 'evento' | 'campanha' | 'contribuicao' | 'outros' | 'missoes';
type FormaPagamento  = 'dinheiro' | 'pix' | 'cartao' | 'transferencia' | 'cheque';
type TipoMovimento  = 'entrada' | 'saida';
type Aba = 'dashboard' | 'lancamentos' | 'caixa' | 'relatorio' | 'dizimistas';

const TIPOS_SAIDA: { value: string; label: string; cor: string }[] = [
  { value: 'aluguel',         label: 'Aluguel',              cor: 'bg-red-100 text-red-800'     },
  { value: 'utilidades',      label: 'Água / Luz / Internet', cor: 'bg-orange-100 text-orange-800'},
  { value: 'material',        label: 'Material',              cor: 'bg-yellow-100 text-yellow-800'},
  { value: 'pessoal',         label: 'Pessoal / Salários',    cor: 'bg-rose-100 text-rose-800'   },
  { value: 'manutencao',      label: 'Manutenção',            cor: 'bg-amber-100 text-amber-800' },
  { value: 'missoes_saida',   label: 'Missões (repasse)',     cor: 'bg-teal-100 text-teal-800'  },
  { value: 'eventos_despesa', label: 'Eventos (despesa)',     cor: 'bg-purple-100 text-purple-800'},
  { value: 'outros_despesa',  label: 'Outros',                cor: 'bg-gray-100 text-gray-700'  },
];

interface Fechamento {
  id: string;
  ministry_id: string;
  mes_referencia: string;
  saldo_inicial: number;
  total_entradas: number;
  total_saidas: number;
  saldo_final: number;
  status: 'aberto' | 'fechado';
  observacoes: string | null;
  fechado_por: string | null;
  fechado_em: string | null;
}

const TIPOS: { value: TipoRecebimento; label: string; cor: string }[] = [
  { value: 'oferta',       label: 'Oferta',       cor: 'bg-blue-100 text-blue-800'    },
  { value: 'dizimo',       label: 'Dízimo',        cor: 'bg-green-100 text-green-800'  },
  { value: 'evento',       label: 'Evento',        cor: 'bg-purple-100 text-purple-800'},
  { value: 'campanha',     label: 'Campanha',      cor: 'bg-orange-100 text-orange-800'},
  { value: 'contribuicao', label: 'Contribuição',  cor: 'bg-pink-100 text-pink-800'   },
  { value: 'missoes',      label: 'Missões',       cor: 'bg-teal-100 text-teal-800'   },
  { value: 'outros',       label: 'Outros',        cor: 'bg-gray-100 text-gray-700'   },
];

const FORMAS: { value: FormaPagamento; label: string }[] = [
  { value: 'dinheiro',     label: 'Dinheiro'      },
  { value: 'pix',          label: 'PIX'           },
  { value: 'cartao',       label: 'Cartão'        },
  { value: 'transferencia',label: 'Transferência' },
  { value: 'cheque',       label: 'Cheque'        },
];

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (d: string) => {
  if (!d) return '';
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y}`;
};

const MESES = [
  '01','02','03','04','05','06','07','08','09','10','11','12'
];
const MESES_LABEL = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];

function MonthPicker({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const anoAtual = new Date().getFullYear();
  const anos = Array.from({ length: 6 }, (_, i) => anoAtual - 2 + i); // -2 a +3
  const [mes, ano] = value ? value.split('-') : [String(new Date().getMonth() + 1).padStart(2,'0'), String(anoAtual)];

  const update = (m: string, a: string) => onChange(`${a}-${m}`);

  return (
    <div className={`flex gap-1 ${className ?? ''}`}>
      <select
        value={mes}
        onChange={e => update(e.target.value, ano)}
        className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-sm"
      >
        {MESES.map((m, i) => <option key={m} value={m}>{MESES_LABEL[i]}</option>)}
      </select>
      <select
        value={ano}
        onChange={e => update(mes, e.target.value)}
        className="w-20 border border-gray-200 rounded-lg px-2 py-2 text-sm"
      >
        {anos.map(a => <option key={a} value={a}>{a}</option>)}
      </select>
    </div>
  );
}

const tipoLabel = (t: string) => TIPOS.find(x => x.value === t)?.label ?? t;
const tipoCor   = (t: string) => TIPOS.find(x => x.value === t)?.cor   ?? 'bg-gray-100 text-gray-700';

const mesAtual = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
};

type FormLanc = {
  congregacao_id: string;
  departamento_id: string;
  tipo_movimento: TipoMovimento;
  tipo_recebimento: TipoRecebimento | '';
  categoria_saida: string;
  descricao: string;
  referencia: string;
  valor: string;
  forma_pagamento: FormaPagamento;
  data_lancamento: string;
  observacoes: string;
};

const emptyForm = (): FormLanc => ({
  congregacao_id:   '',
  departamento_id:  '',
  tipo_movimento:   'entrada',
  tipo_recebimento: '',
  categoria_saida:  '',
  descricao:        '',
  referencia:       '',
  valor:            '',
  forma_pagamento:  'dinheiro',
  data_lancamento:  new Date().toISOString().split('T')[0],
  observacoes:      '',
});

// ─── Role helpers ─────────────────────────────────────────────────────────────

interface UserScope {
  isFinanceiroLocal: boolean;
  congregacaoId: string | null; // congregação vinculada (para financeiro_local)
  canWrite: boolean;
  canDelete: boolean;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TesourariaPage() {
  const { loading: authLoading } = useRequireSupabaseAuth();
  const supabase = useMemo(() => createClient(), []);

  const [ministryId,  setMinistryId]  = useState<string | null>(null);
  const [ministerio,   setMinisterio]  = useState<ConfiguracaoIgreja | null>(null);
  const [congregacoes, setCongregacoes] = useState<Congregacao[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [lancamentos, setLancamentos]   = useState<Lancamento[]>([]);
  const [scope, setScope] = useState<UserScope>({
    isFinanceiroLocal: false, congregacaoId: null, canWrite: true, canDelete: false,
  });

  const [loadingData, setLoadingData] = useState(true);
  const [aba, setAba] = useState<Aba>('dashboard');

  // Fechamentos
  const [fechamentos, setFechamentos] = useState<Fechamento[]>([]);
  const [abaFechaMes, setAbaFechaMes] = useState(mesAtual());
  const [showFechaModal, setShowFechaModal] = useState(false);
  const [fechaObs, setFechaObs] = useState('');
  const [fechaSaldoInicial, setFechaSaldoInicial] = useState('');
  const [salvandoFecha, setSalvandoFecha] = useState(false);

  // Dizimistas
  const [dizimistas, setDizimistas] = useState<Dizimista[]>([]);
  const [dizimistaPagamentos, setDizimistaPagamentos] = useState<{member_id: string; status: string}[]>([]);
  const [loadingDizimistas, setLoadingDizimistas] = useState(false);
  const [abaDizimistaMes, setAbaDizimistaMes] = useState(mesAtual());
  const [filtroNomeDiz, setFiltroNomeDiz] = useState('');
  const [filtroStatusDiz, setFiltroStatusDiz] = useState<'' | 'pago' | 'pendente'>('');
  const [filtroConsDiz, setFiltroConsDiz] = useState('');

  // Filtros
  const [filtroCong,  setFiltroCong]  = useState('');
  const [filtroTipo,  setFiltroTipo]  = useState('');
  const [filtroMes,   setFiltroMes]   = useState(mesAtual());
  const [relMes,           setRelMes]           = useState(mesAtual());
  const [relCong,          setRelCong]          = useState('');
  const [relMostrarDet,    setRelMostrarDet]    = useState(false);
  const [relTipoRel,       setRelTipoRel]       = useState<'entradas' | 'saidas' | 'ambos'>('entradas');

  // Formulário
  const [showForm,  setShowForm]  = useState(false);
  const [form,      setForm]      = useState<FormLanc>(emptyForm());
  const [editId,    setEditId]    = useState<string | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const [modal, setModal] = useState<{ open: boolean; title: string; message: string; type: 'success'|'error'|'info' }>({
    open: false, title: '', message: '', type: 'success',
  });
  const showModal = (title: string, message: string, type: 'success'|'error'|'info' = 'success') =>
    setModal({ open: true, title, message, type });

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (authLoading) return;
    setLoadingData(true);

    const mid = await resolveMinistryId(supabase);
    setMinistryId(mid);
    if (!mid) { setLoadingData(false); return; }

    // Dados do ministério (para timbre de impressão)
    const config = await fetchConfiguracaoIgrejaFromSupabase(supabase);
    setMinisterio(config);

    // Detectar role do usuário atual
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user.id;
    if (uid) {
      const { data: mu } = await supabase
        .from('ministry_users')
        .select('role, permissions, congregacao_id')
        .eq('ministry_id', mid)
        .eq('user_id', uid)
        .maybeSingle();
      if (mu) {
        const perms: string[] = Array.isArray(mu.permissions) ? mu.permissions : [];
        const isLocal  = perms.includes('FINANCEIRO_LOCAL');
        const isAdmin  = perms.includes('ADMINISTRADOR') || mu.role === 'admin';
        const isFin    = perms.includes('FINANCEIRO');
        setScope({
          isFinanceiroLocal: isLocal,
          congregacaoId:     mu.congregacao_id ?? null,
          canWrite:          isAdmin || isFin || isLocal,
          canDelete:         isAdmin || isFin,
        });
        // financeiro_local: pré-filtrar pela congregação
        if (isLocal && mu.congregacao_id) setFiltroCong(mu.congregacao_id);
      }
    }

    // Congregações
    const { data: congs } = await supabase
      .from('congregacoes')
      .select('id, nome')
      .eq('ministry_id', mid)
      .eq('is_active', true)
      .order('nome');
    setCongregacoes((congs as Congregacao[]) || []);

    // Departamentos
    const { data: deps } = await supabase
      .from('departamentos')
      .select('id, nome, sigla')
      .eq('ministry_id', mid)
      .eq('ativo', true)
      .order('ordem');
    setDepartamentos((deps as Departamento[]) || []);

    // Lançamentos
    const { data: lancs } = await supabase
      .from('tesouraria_lancamentos')
      .select('*')
      .eq('ministry_id', mid)
      .order('data_lancamento', { ascending: false });

    if (lancs) {
      // Enriquecer com nomes
      const congMap = new Map((congs as Congregacao[] || []).map(c => [c.id, c.nome]));
      const depMap  = new Map((deps as Departamento[] || []).map(d => [d.id, `${d.sigla} - ${d.nome}`]));
      setLancamentos((lancs as Lancamento[]).map(l => ({
        ...l,
        tipo_movimento:    (l as any).tipo_movimento ?? 'entrada',
        congregacao_nome:  l.congregacao_id  ? (congMap.get(l.congregacao_id)  ?? 'Sede') : 'Caixa Geral (Sede)',
        departamento_nome: l.departamento_id ? (depMap.get(l.departamento_id)  ?? '—')    : '—',
      })));
    }

    // Fechamentos
    const { data: fechs } = await supabase
      .from('tesouraria_fechamentos')
      .select('*')
      .eq('ministry_id', mid)
      .order('mes_referencia', { ascending: false });
    setFechamentos((fechs as Fechamento[]) || []);

    setLoadingData(false);
  }, [authLoading, supabase]);

  useEffect(() => { load(); }, [load]);

  // ── Filtro de lançamentos ─────────────────────────────────────────────────

  const lancsFiltrados = useMemo(() => lancamentos.filter(l => {
    if (filtroTipo && l.tipo_recebimento !== filtroTipo) return false;
    if (filtroCong && l.congregacao_id !== filtroCong) return false;
    if (filtroMes) {
      if (!l.data_lancamento.startsWith(filtroMes)) return false;
    }
    return true;
  }), [lancamentos, filtroTipo, filtroCong, filtroMes]);

  const totalFiltrado = useMemo(() =>
    lancsFiltrados.reduce((s, l) => s + Number(l.valor), 0),
    [lancsFiltrados]);

  // ── Dashboard stats ───────────────────────────────────────────────────────

  const dashStats = useMemo(() => {
    const mes = new Date().toISOString().slice(0, 7);
    const doMes = lancamentos.filter(l => l.data_lancamento.startsWith(mes));

    const totalGeral   = lancamentos.reduce((s, l) => s + Number(l.valor), 0);
    const totalMes     = doMes.filter(l => l.tipo_movimento === 'entrada').reduce((s, l) => s + Number(l.valor), 0);
    const totalSaidas  = doMes.filter(l => l.tipo_movimento === 'saida').reduce((s, l) => s + Number(l.valor), 0);
    const saldoMes     = totalMes - totalSaidas;

    const porTipo: Record<string, number> = {};
    doMes.filter(l => l.tipo_movimento === 'entrada').forEach(l => {
      porTipo[l.tipo_recebimento] = (porTipo[l.tipo_recebimento] ?? 0) + Number(l.valor);
    });

    const porCong: Record<string, number> = {};
    doMes.filter(l => l.tipo_movimento === 'entrada').forEach(l => {
      const k = l.congregacao_nome ?? 'Caixa Geral (Sede)';
      porCong[k] = (porCong[k] ?? 0) + Number(l.valor);
    });

    return { totalGeral, totalMes, totalSaidas, saldoMes, porTipo, porCong };
  }, [lancamentos]);

  // ── Salvar ────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!ministryId) return;
    const isSaida = form.tipo_movimento === 'saida';
    if (!isSaida && !form.tipo_recebimento) {
      showModal('Campos obrigatórios', 'Preencha o tipo de recebimento.', 'error'); return;
    }
    if (!form.valor || !form.data_lancamento) {
      showModal('Campos obrigatórios', 'Preencha valor e data.', 'error'); return;
    }
    if (!scope.isFinanceiroLocal && !form.congregacao_id) {
      showModal('Congregação obrigatória', 'Selecione a congregação do lançamento.', 'error'); return;
    }
    const valorNum = parseFloat(form.valor.replace(',', '.'));
    if (isNaN(valorNum) || valorNum <= 0) {
      showModal('Valor inválido', 'Informe um valor maior que zero.', 'error'); return;
    }
    setSaving(true);
    const now = new Date().toISOString();
    const payload: any = {
      ministry_id:      ministryId,
      congregacao_id:   form.congregacao_id  || null,
      departamento_id:  form.departamento_id || null,
      tipo_movimento:   form.tipo_movimento,
      tipo_recebimento: isSaida ? (form.categoria_saida || 'outros_despesa') : form.tipo_recebimento,
      descricao:        form.descricao.trim()  || null,
      referencia:       form.referencia.trim() || null,
      valor:            valorNum,
      forma_pagamento:  form.forma_pagamento,
      data_lancamento:  form.data_lancamento,
      observacoes:      form.observacoes.trim() || null,
      updated_at:       now,
    };

    if (editId) {
      const { error } = await supabase.from('tesouraria_lancamentos').update(payload).eq('id', editId);
      if (error) { showModal('Erro', error.message, 'error'); setSaving(false); return; }
      showModal('Atualizado!', 'Lançamento atualizado com sucesso.');
    } else {
      const { error } = await supabase.from('tesouraria_lancamentos').insert({ ...payload, created_at: now });
      if (error) { showModal('Erro', error.message, 'error'); setSaving(false); return; }
      showModal('Registrado!', 'Lançamento registrado com sucesso.');
    }
    setSaving(false);
    setForm(emptyForm());
    setEditId(null);
    setShowForm(false);
    load();
  };

  // ── Editar ────────────────────────────────────────────────────────────────

  const handleEdit = (l: Lancamento) => {
    const isSaida = l.tipo_movimento === 'saida';
    setForm({
      congregacao_id:   l.congregacao_id  ?? '',
      departamento_id:  l.departamento_id ?? '',
      tipo_movimento:   l.tipo_movimento,
      tipo_recebimento: isSaida ? '' : l.tipo_recebimento,
      categoria_saida:  isSaida ? l.tipo_recebimento : '',
      descricao:        l.descricao  ?? '',
      referencia:       l.referencia ?? '',
      valor:            String(l.valor),
      forma_pagamento:  l.forma_pagamento,
      data_lancamento:  l.data_lancamento,
      observacoes:      l.observacoes ?? '',
    });
    setEditId(l.id);
    setShowForm(true);
    setAba('lancamentos');
  };

  // ── Excluir ───────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('tesouraria_lancamentos').delete().eq('id', id);
    if (error) { showModal('Erro', error.message, 'error'); return; }
    setConfirmDel(null);
    showModal('Excluído!', 'Lançamento removido.');
    load();
  };

  // ── Fechar Mês ───────────────────────────────────────────────────

  const handleFecharMes = async () => {
    if (!ministryId) return;
    const saldoIni = parseFloat(fechaSaldoInicial.replace(',', '.')) || 0;
    const doMes   = lancamentos.filter(l => l.data_lancamento.startsWith(abaFechaMes));
    const entradas = doMes.filter(l => l.tipo_movimento === 'entrada').reduce((s, l) => s + Number(l.valor), 0);
    const saidas   = doMes.filter(l => l.tipo_movimento === 'saida').reduce((s, l) => s + Number(l.valor), 0);
    const saldoFinal = saldoIni + entradas - saidas;
    setSalvandoFecha(true);
    const { data: sd } = await supabase.auth.getSession();
    const uid = sd.session?.user.id;
    const { error } = await supabase.from('tesouraria_fechamentos').upsert({
      ministry_id:    ministryId,
      mes_referencia: abaFechaMes,
      saldo_inicial:  saldoIni,
      total_entradas: entradas,
      total_saidas:   saidas,
      saldo_final:    saldoFinal,
      status:         'fechado',
      observacoes:    fechaObs || null,
      fechado_por:    uid ?? null,
      fechado_em:     new Date().toISOString(),
    }, { onConflict: 'ministry_id,mes_referencia' });
    setSalvandoFecha(false);
    if (error) { showModal('Erro', error.message, 'error'); return; }
    const [ano, mon] = abaFechaMes.split('-');
    showModal('Mês fechado!', `Caixa de ${MESES_LABEL[Number(mon) - 1]}/${ano} fechado. Saldo: ${fmtBRL(saldoFinal)}.`);
    setShowFechaModal(false);
    setFechaObs('');
    setFechaSaldoInicial('');
    load();
  };

  // ── Relatório ─────────────────────────────────────────────────────────────

  const relFiltrado = useMemo(() => lancamentos.filter(l => {
    if (relMes && !l.data_lancamento.startsWith(relMes)) return false;
    if (relCong && l.congregacao_id !== relCong) return false;
    return true;
  }), [lancamentos, relMes, relCong]);

  const relEntradas = useMemo(() => relFiltrado.filter(l => l.tipo_movimento !== 'saida'), [relFiltrado]);
  const relSaidas   = useMemo(() => relFiltrado.filter(l => l.tipo_movimento === 'saida'),  [relFiltrado]);
  const relTotalEntradas = useMemo(() => relEntradas.reduce((s, l) => s + Number(l.valor), 0), [relEntradas]);
  const relTotalSaidas   = useMemo(() => relSaidas.reduce((s, l) => s + Number(l.valor), 0),   [relSaidas]);

  const relDados = useMemo(() =>
    relTipoRel === 'entradas' ? relEntradas :
    relTipoRel === 'saidas'   ? relSaidas   : relFiltrado
  , [relTipoRel, relEntradas, relSaidas, relFiltrado]);

  const relTotal = useMemo(() => relDados.reduce((s, l) => s + Number(l.valor), 0), [relDados]);

  const relPorTipo = useMemo(() => {
    const acc: Record<string, number> = {};
    relEntradas.forEach(l => {
      acc[l.tipo_recebimento] = (acc[l.tipo_recebimento] ?? 0) + Number(l.valor);
    });
    return acc;
  }, [relEntradas]);

  const relPorTipoSaida = useMemo(() => {
    const acc: Record<string, number> = {};
    relSaidas.forEach(l => {
      acc[l.tipo_recebimento] = (acc[l.tipo_recebimento] ?? 0) + Number(l.valor);
    });
    return acc;
  }, [relSaidas]);

  const handlePrint = () => window.print();

  // ── Dizimistas ────────────────────────────────────────────────────────────

  const carregarDizimistas = useCallback(async () => {
    if (!ministryId) return;
    setLoadingDizimistas(true);
    const congMap = new Map(congregacoes.map(c => [c.id, c.nome]));
    const { data: mems } = await supabase
      .from('members')
      .select('id, name, congregacao_id')
      .eq('ministry_id', ministryId)
      .eq('is_dizimista', true)
      .eq('status', 'active')
      .order('name');
    setDizimistas((mems || []).map((m: any) => ({
      id: m.id,
      nome: m.name,
      congregacao_id: m.congregacao_id,
      congregacao_nome: m.congregacao_id ? (congMap.get(m.congregacao_id) ?? '—') : 'Sede',
    })));

    const { data: pags } = await supabase
      .from('dizimistas_pagamentos')
      .select('member_id, status')
      .eq('ministry_id', ministryId)
      .eq('mes_referencia', abaDizimistaMes);
    setDizimistaPagamentos((pags || []) as {member_id: string; status: string}[]);

    setLoadingDizimistas(false);
  }, [ministryId, supabase, congregacoes, abaDizimistaMes]);

  useEffect(() => {
    if (aba === 'dizimistas' && ministryId) carregarDizimistas();
  }, [aba, abaDizimistaMes, ministryId, carregarDizimistas]);

  const dizimistasComStatus = useMemo(() => {
    const pagMap = new Map(dizimistaPagamentos.map(p => [p.member_id, p.status]));
    return dizimistas.map(d => ({ ...d, status: (pagMap.get(d.id) ?? 'pendente') as 'pago' | 'pendente' }));
  }, [dizimistas, dizimistaPagamentos]);

  const dizimistasVisiveis = useMemo(() => dizimistasComStatus.filter(d => {
    if (filtroNomeDiz && !d.nome.toLowerCase().includes(filtroNomeDiz.toLowerCase())) return false;
    if (filtroStatusDiz && d.status !== filtroStatusDiz) return false;
    if (filtroConsDiz && d.congregacao_id !== filtroConsDiz) return false;
    return true;
  }), [dizimistasComStatus, filtroNomeDiz, filtroStatusDiz, filtroConsDiz]);

  const totalPagos = useMemo(() => dizimistasComStatus.filter(d => d.status === 'pago').length, [dizimistasComStatus]);

  // ─────────────────────────────────────────────────────────────────────────

  if (authLoading || loadingData) return <div className="p-8 text-gray-500">Carregando...</div>;

  const congNome = (id: string | null) => {
    if (!id) return 'Caixa Geral (Sede)';
    return congregacoes.find(c => c.id === id)?.nome ?? '—';
  };

  return (
    <PageLayout title="Tesouraria" description="Gestão de arrecadação e caixas das congregações" activeMenu="tesouraria">

      {/* ── Estilos de impressão ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden !important; }
          #relatorio-print, #relatorio-print *, #dizimistas-print, #dizimistas-print * { visibility: visible !important; }
          #relatorio-print, #dizimistas-print {
            position: fixed !important;
            inset: 0 !important;
            width: 100% !important;
            padding: 24px 32px !important;
            background: white !important;
            font-size: 11pt !important;
          }
          .no-print { display: none !important; }
        }
      `}} />

      {/* ── Abas ── */}
      <div className="mb-6 border-b border-gray-200 flex gap-1 flex-wrap">
        {([
          { id: 'dashboard',   icon: <TrendingUp className="h-4 w-4" />,    label: 'Dashboard'     },
          { id: 'lancamentos', icon: <Tag className="h-4 w-4" />,           label: 'Lançamentos'   },
          { id: 'caixa',       icon: <CalendarDays className="h-4 w-4" />,  label: 'Caixa Mensal'  },
          { id: 'relatorio',   icon: <Printer className="h-4 w-4" />,       label: 'Relatório'     },
          { id: 'dizimistas',  icon: <Users className="h-4 w-4" />,         label: 'Dizimistas'    },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setAba(t.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition ${
              aba === t.id ? 'border-[#123b63] text-[#123b63]' : 'border-transparent text-gray-500 hover:text-[#123b63]'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          ABA: DASHBOARD
      ══════════════════════════════════════════════════════════════════════ */}
      {aba === 'dashboard' && (
        <div className="space-y-6">
          {/* Cards resumo */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Entradas (mês atual)</p>
              <p className="text-2xl font-bold text-green-600">{fmtBRL(dashStats.totalMes)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Saídas (mês atual)</p>
              <p className="text-2xl font-bold text-red-500">{fmtBRL(dashStats.totalSaidas)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Saldo do mês</p>
              <p className={`text-2xl font-bold ${dashStats.saldoMes >= 0 ? 'text-[#123b63]' : 'text-red-600'}`}>
                {fmtBRL(dashStats.saldoMes)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Congregações ativas</p>
              <p className="text-2xl font-bold text-[#123b63]">{congregacoes.length}</p>
            </div>
          </div>

          {/* Por tipo de recebimento */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Arrecadação do mês por tipo</h3>
            {Object.keys(dashStats.porTipo).length === 0 ? (
              <p className="text-sm text-gray-400">Nenhum lançamento no mês atual.</p>
            ) : (
              <div className="space-y-3">
                {TIPOS.map(t => {
                  const val = dashStats.porTipo[t.value] ?? 0;
                  if (val === 0) return null;
                  const pct = dashStats.totalMes > 0 ? (val / dashStats.totalMes) * 100 : 0;
                  return (
                    <div key={t.value}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${t.cor}`}>{t.label}</span>
                        <span className="font-semibold text-gray-800">{fmtBRL(val)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-2 bg-[#123b63] rounded-full" style={{ width: `${pct.toFixed(1)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Por congregação */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Arrecadação do mês por congregação / caixa</h3>
            {Object.keys(dashStats.porCong).length === 0 ? (
              <p className="text-sm text-gray-400">Nenhum lançamento no mês atual.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {Object.entries(dashStats.porCong)
                  .sort((a, b) => b[1] - a[1])
                  .map(([nome, val]) => (
                    <div key={nome} className="flex justify-between items-center py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-700">{nome}</span>
                      </div>
                      <span className="font-semibold text-[#123b63]">{fmtBRL(val)}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ABA: LANÇAMENTOS
      ══════════════════════════════════════════════════════════════════════ */}
      {aba === 'lancamentos' && (
        <div className="space-y-4">
          {/* Barra de filtros */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Mês</label>
                <MonthPicker
                  value={filtroMes}
                  onChange={setFiltroMes}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo</label>
                <select
                  value={filtroTipo}
                  onChange={e => setFiltroTipo(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Todos os tipos</option>
                  {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              {!scope.isFinanceiroLocal && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Caixa</label>
                  <select
                    value={filtroCong}
                    onChange={e => setFiltroCong(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Todas as congregações</option>
                    {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
              )}
              <div className="flex items-end">
                {scope.canWrite && (
                  <button
                    onClick={() => { setForm(emptyForm()); setEditId(null); setShowForm(true); }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition"
                  >
                    <Plus className="h-4 w-4" /> Novo
                  </button>
                )}
              </div>
            </div>

            {/* Totalizador */}
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500">{lancsFiltrados.length} lançamento(s)</span>
              <span className="text-sm font-bold text-[#123b63]">Total: {fmtBRL(totalFiltrado)}</span>
            </div>
          </div>

          {/* Formulário inline */}
          {showForm && (
            <div className="bg-white rounded-xl border-2 border-[#123b63] p-5 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-[#123b63]">
                  {editId ? 'Editar Lançamento' : 'Novo Lançamento'}
                </h3>
                <button onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm()); }}>
                  <X className="h-5 w-5 text-gray-400 hover:text-gray-700" />
                </button>
              </div>

              {/* Toggle Entrada / Saída */}
              <div className="flex gap-2 mb-4">
                {(['entrada', 'saida'] as const).map(mv => (
                  <button
                    key={mv}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, tipo_movimento: mv, tipo_recebimento: '', categoria_saida: '' }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition ${
                      form.tipo_movimento === mv
                        ? mv === 'entrada'
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-red-500 text-white border-red-500'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {mv === 'entrada' ? '↑ Entrada (Receita)' : '↓ Saída (Despesa)'}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Caixa / Congregação */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Caixa</label>
                  {scope.isFinanceiroLocal ? (
                    <input
                      readOnly
                      value={congNome(scope.congregacaoId)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500"
                    />
                  ) : (
                    <select
                      value={form.congregacao_id}
                      onChange={e => setForm(p => ({ ...p, congregacao_id: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">Selecione a congregação *</option>
                      {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  )}
                </div>

                {/* Tipo de Entrada ou Categoria de Saída */}
                {form.tipo_movimento === 'entrada' ? (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Tipo de recebimento <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={form.tipo_recebimento}
                      onChange={e => setForm(p => ({ ...p, tipo_recebimento: e.target.value as TipoRecebimento }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">Selecione</option>
                      {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Categoria da despesa</label>
                    <select
                      value={form.categoria_saida}
                      onChange={e => setForm(p => ({ ...p, categoria_saida: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">Selecione</option>
                      {TIPOS_SAIDA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                )}

                {/* Departamento */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Departamento</label>
                  <select
                    value={form.departamento_id}
                    onChange={e => setForm(p => ({ ...p, departamento_id: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Caixa da Igreja</option>
                    {departamentos.map(d => (
                      <option key={d.id} value={d.id}>{d.sigla} – {d.nome}</option>
                    ))}
                  </select>
                </div>

                {/* Valor */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Valor (R$) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={form.valor}
                    onChange={e => setForm(p => ({ ...p, valor: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                {/* Data */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Data <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.data_lancamento}
                    onChange={e => setForm(p => ({ ...p, data_lancamento: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                {/* Forma de pagamento */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Forma de pagamento</label>
                  <select
                    value={form.forma_pagamento}
                    onChange={e => setForm(p => ({ ...p, forma_pagamento: e.target.value as FormaPagamento }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  >
                    {FORMAS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>

                {/* Referência */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Referência (evento/campanha)</label>
                  <input
                    type="text"
                    placeholder="Ex: Festa das Nações"
                    value={form.referencia}
                    onChange={e => setForm(p => ({ ...p, referencia: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                {/* Descrição */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Descrição</label>
                  <input
                    type="text"
                    placeholder="Descrição livre..."
                    value={form.descricao}
                    onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                {/* Obs */}
                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Observações</label>
                  <textarea
                    rows={2}
                    value={form.observacoes}
                    onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
                  />
                </div>
              </div>

              <div className="mt-4 flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : editId ? 'Atualizar' : 'Registrar'}
                </button>
                <button
                  onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm()); }}
                  className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Tabela */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {lancsFiltrados.length === 0 ? (
              <p className="text-center text-gray-400 py-12 text-sm">Nenhum lançamento no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Data</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Caixa</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Departamento</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Descrição / Ref.</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Valor</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {lancsFiltrados.map(l => (
                      <tr key={l.id} className={`hover:bg-gray-50 transition ${l.tipo_movimento === 'saida' ? 'bg-red-50/30' : ''}`}>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(l.data_lancamento)}</td>
                        <td className="px-4 py-3 text-gray-700">{l.congregacao_nome}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{l.departamento_nome}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold w-fit ${
                              l.tipo_movimento === 'saida'
                                ? (TIPOS_SAIDA.find(t => t.value === l.tipo_recebimento)?.cor ?? 'bg-red-100 text-red-800')
                                : tipoCor(l.tipo_recebimento)
                            }`}>
                              {l.tipo_movimento === 'saida'
                                ? (TIPOS_SAIDA.find(t => t.value === l.tipo_recebimento)?.label ?? l.tipo_recebimento)
                                : tipoLabel(l.tipo_recebimento)}
                            </span>
                            <span className={`text-xs font-semibold ${l.tipo_movimento === 'saida' ? 'text-red-500' : 'text-green-600'}`}>
                              {l.tipo_movimento === 'saida' ? '↓ Saída' : '↑ Entrada'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">
                          {l.referencia || l.descricao || '—'}
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${l.tipo_movimento === 'saida' ? 'text-red-600' : 'text-[#123b63]'}`}>
                          {l.tipo_movimento === 'saida' ? '- ' : ''}{fmtBRL(Number(l.valor))}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 justify-center">
                            {scope.canWrite && (
                              <button onClick={() => handleEdit(l)} className="p-1.5 rounded hover:bg-blue-50 text-blue-600 transition">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {scope.canDelete && (
                              <button onClick={() => setConfirmDel(l.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500 transition">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#123b63]/5 border-t border-gray-200">
                      <td colSpan={5} className="px-4 py-3 text-xs font-semibold text-gray-600 text-right">Total</td>
                      <td className="px-4 py-3 text-right font-bold text-[#123b63]">{fmtBRL(totalFiltrado)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ABA: CAIXA MENSAL
      ══════════════════════════════════════════════════════════════════════ */}
      {aba === 'caixa' && (() => {
        const doMesSel   = lancamentos.filter(l => l.data_lancamento.startsWith(abaFechaMes));
        const entMes     = doMesSel.filter(l => l.tipo_movimento === 'entrada').reduce((s, l) => s + Number(l.valor), 0);
        const saiMes     = doMesSel.filter(l => l.tipo_movimento === 'saida').reduce((s, l)   => s + Number(l.valor), 0);
        const fechAtual  = fechamentos.find(f => f.mes_referencia === abaFechaMes);
        const isFechado  = fechAtual?.status === 'fechado';
        // Sugerir saldo_inicial = último fechamento anterior
        const fechAnterior = fechamentos
          .filter(f => f.mes_referencia < abaFechaMes && f.status === 'fechado')
          .sort((a, b) => b.mes_referencia.localeCompare(a.mes_referencia))[0];
        const saldoInicial = fechAtual?.saldo_inicial ?? fechAnterior?.saldo_final ?? 0;
        const saldoFinal   = fechAtual?.saldo_final   ?? (saldoInicial + entMes - saiMes);
        const [ano, mon]   = abaFechaMes.split('-');
        return (
          <div className="space-y-6">
            {/* Seletor de mês */}
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Mês / Ano</label>
                <MonthPicker value={abaFechaMes} onChange={setAbaFechaMes} />
              </div>
              {!isFechado && scope.canWrite && (
                <button
                  onClick={() => { setFechaSaldoInicial(String(saldoInicial)); setFechaObs(''); setShowFechaModal(true); }}
                  className="flex items-center gap-2 px-5 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition mt-4"
                >
                  <Lock className="h-4 w-4" /> Fechar Mês
                </button>
              )}
              {isFechado && (
                <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm font-semibold mt-4">
                  <Lock className="h-4 w-4" /> Mês fechado em {fechAtual!.fechado_em ? fmtDate(fechAtual!.fechado_em.slice(0,10)) : '—'}
                </div>
              )}
            </div>

            {/* Cards do mês */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Saldo Inicial</p>
                <p className="text-xl font-bold text-gray-700">{fmtBRL(saldoInicial)}</p>
                <p className="text-xs text-gray-400 mt-0.5">{fechAnterior ? `do fechamento de ${fechAnterior.mes_referencia.split('-').reverse().join('/')}` : 'não há fechamento anterior'}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Entradas</p>
                <p className="text-xl font-bold text-green-600">{fmtBRL(fechAtual?.total_entradas ?? entMes)}</p>
                <p className="text-xs text-gray-400 mt-0.5">{doMesSel.filter(l => l.tipo_movimento === 'entrada').length} lançamentos</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Saídas</p>
                <p className="text-xl font-bold text-red-500">{fmtBRL(fechAtual?.total_saidas ?? saiMes)}</p>
                <p className="text-xs text-gray-400 mt-0.5">{doMesSel.filter(l => l.tipo_movimento === 'saida').length} lançamentos</p>
              </div>
              <div className={`rounded-xl border p-4 shadow-sm ${isFechado ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Saldo Final</p>
                <p className={`text-xl font-bold ${saldoFinal >= 0 ? 'text-[#123b63]' : 'text-red-600'}`}>{fmtBRL(saldoFinal)}</p>
                {isFechado && <p className="text-xs text-green-600 mt-0.5 font-semibold">✓ Fechado</p>}
              </div>
            </div>

            {/* Modal de fechamento */}
            {showFechaModal && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-base font-bold text-[#123b63]">Fechar Caixa — {MESES_LABEL[Number(mon) - 1]}/{ano}</h3>
                    <button onClick={() => setShowFechaModal(false)}><X className="h-5 w-5 text-gray-400" /></button>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Saldo inicial do mês (R$)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={fechaSaldoInicial}
                      onChange={e => setFechaSaldoInicial(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                    {fechAnterior && (
                      <p className="text-xs text-gray-400 mt-1">
                        Sugerido: {fmtBRL(fechAnterior.saldo_final)} (saldo de {fechAnterior.mes_referencia.split('-').reverse().join('/')})
                      </p>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-gray-500">Entradas do mês:</span><span className="font-semibold text-green-600">{fmtBRL(entMes)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Saídas do mês:</span><span className="font-semibold text-red-500">{fmtBRL(saiMes)}</span></div>
                    <div className="flex justify-between border-t pt-1 mt-1">
                      <span className="text-gray-700 font-semibold">Saldo final:</span>
                      <span className={`font-bold ${(parseFloat(fechaSaldoInicial.replace(',', '.')) || 0) + entMes - saiMes >= 0 ? 'text-[#123b63]' : 'text-red-600'}`}>
                        {fmtBRL((parseFloat(fechaSaldoInicial.replace(',', '.')) || 0) + entMes - saiMes)}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Observações</label>
                    <textarea
                      rows={2}
                      value={fechaObs}
                      onChange={e => setFechaObs(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleFecharMes}
                      disabled={salvandoFecha}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition disabled:opacity-50"
                    >
                      <Lock className="h-4 w-4" /> {salvandoFecha ? 'Fechando...' : 'Confirmar Fechamento'}
                    </button>
                    <button onClick={() => setShowFechaModal(false)} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition">
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Histórico de fechamentos */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Histórico de fechamentos</h3>
              {fechamentos.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhum mês fechado ainda.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Mês</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Saldo Inicial</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-green-600">Entradas</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-red-500">Saídas</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Saldo Final</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {fechamentos.map(f => {
                        const [fy, fm] = f.mes_referencia.split('-');
                        return (
                          <tr key={f.id} className="hover:bg-gray-50 transition">
                            <td className="px-4 py-3 font-semibold text-gray-700">{MESES_LABEL[Number(fm) - 1]}/{fy}</td>
                            <td className="px-4 py-3 text-right text-gray-600">{fmtBRL(f.saldo_inicial)}</td>
                            <td className="px-4 py-3 text-right text-green-600 font-semibold">{fmtBRL(f.total_entradas)}</td>
                            <td className="px-4 py-3 text-right text-red-500 font-semibold">{fmtBRL(f.total_saidas)}</td>
                            <td className={`px-4 py-3 text-right font-bold ${f.saldo_final >= 0 ? 'text-[#123b63]' : 'text-red-600'}`}>{fmtBRL(f.saldo_final)}</td>
                            <td className="px-4 py-3 text-center">
                              {f.status === 'fechado'
                                ? <span className="flex items-center justify-center gap-1 text-green-700 text-xs font-semibold"><Lock className="h-3 w-3" /> Fechado</span>
                                : <span className="flex items-center justify-center gap-1 text-yellow-600 text-xs font-semibold"><Unlock className="h-3 w-3" /> Aberto</span>
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════════════════
          ABA: RELATÓRIO
      ══════════════════════════════════════════════════════════════════════ */}
      {aba === 'relatorio' && (
        <div className="space-y-4">
          {/* Filtros do relatório */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo de relatório</label>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                {(['entradas', 'saidas', 'ambos'] as const).map(v => (
                  <button key={v} onClick={() => setRelTipoRel(v)}
                    className={`px-3 py-1.5 font-medium transition ${
                      relTipoRel === v ? 'bg-[#123b63] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}>
                    {v === 'entradas' ? 'Entradas' : v === 'saidas' ? 'Saídas' : 'Ambos'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Mês de referência</label>
              <MonthPicker
                value={relMes}
                onChange={setRelMes}
              />
            </div>
            {!scope.isFinanceiroLocal && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Caixa</label>
                <select
                  value={relCong}
                  onChange={e => setRelCong(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Todas as congregações</option>
                  {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            )}
            <label className="no-print flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={relMostrarDet}
                onChange={e => setRelMostrarDet(e.target.checked)}
                className="w-4 h-4 accent-[#123b63] cursor-pointer"
              />
              <span className="text-sm text-gray-600">Incluir lançamentos detalhados</span>
            </label>
            <button
              onClick={handlePrint}
              className="no-print flex items-center gap-2 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition"
            >
              <Printer className="h-4 w-4" /> Imprimir
            </button>
          </div>

          {/* Resumo por tipo */}
          <div id="relatorio-print" className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-5">

            {/* Timbre (visível apenas na impressão) */}
            <div className="hidden print:block border-b border-gray-300 pb-4 mb-4">
              <div className="flex items-center gap-4">
                {ministerio?.logo && (
                  <img src={ministerio.logo} alt="Logo" className="h-16 w-16 object-contain" />
                )}
                <div className="flex-1 text-center">
                  <p className="text-xl font-bold text-gray-900">{ministerio?.nome}</p>
                  {ministerio?.endereco && <p className="text-xs text-gray-600 mt-0.5">{ministerio.endereco}</p>}
                  <p className="text-xs text-gray-600 mt-0.5">
                    {ministerio?.telefone && `Tel: ${ministerio.telefone}`}
                    {ministerio?.telefone && ministerio?.email && ' | '}
                    {ministerio?.email && `Email: ${ministerio.email}`}
                  </p>
                </div>
                {ministerio?.logo && <div className="w-16" />}
              </div>
            </div>
            <div className="flex justify-between items-start flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#123b63]">
                  {relTipoRel === 'entradas' ? 'Relatório de Entradas' : relTipoRel === 'saidas' ? 'Relatório de Saídas' : 'Relatório Financeiro'}
                </h2>
                <p className="text-sm text-gray-500">
                  {relMes ? `Período: ${relMes.split('-')[1]}/${relMes.split('-')[0]}` : 'Todos os períodos'}
                  {relCong ? ` • ${congNome(relCong)}` : ' • Todas as congregações'}
                </p>
              </div>
              {relTipoRel === 'ambos' ? (
                <div className="flex gap-3">
                  <div className="bg-green-50 rounded-lg px-4 py-2 text-center">
                    <p className="text-xs text-green-600 font-semibold">Entradas</p>
                    <p className="text-base font-bold text-green-700">{fmtBRL(relTotalEntradas)}</p>
                  </div>
                  <div className="bg-red-50 rounded-lg px-4 py-2 text-center">
                    <p className="text-xs text-red-500 font-semibold">Saídas</p>
                    <p className="text-base font-bold text-red-600">{fmtBRL(relTotalSaidas)}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg px-4 py-2 text-center">
                    <p className="text-xs text-[#123b63] font-semibold">Saldo</p>
                    <p className={`text-base font-bold ${relTotalEntradas - relTotalSaidas >= 0 ? 'text-[#123b63]' : 'text-red-600'}`}>
                      {fmtBRL(relTotalEntradas - relTotalSaidas)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className={`text-xl font-bold ${relTipoRel === 'saidas' ? 'text-red-600' : 'text-[#123b63]'}`}>{fmtBRL(relTotal)}</p>
              )}
            </div>

            {/* Por tipo — Entradas */}
            {(relTipoRel === 'entradas' || relTipoRel === 'ambos') && (
              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-2">Resumo de Entradas por tipo</h3>
                <div className="divide-y divide-gray-100">
                  {TIPOS.map(t => {
                    const val = relPorTipo[t.value] ?? 0;
                    const base = relTotalEntradas > 0 ? relTotalEntradas : 1;
                    const pct = ((val / base) * 100).toFixed(1);
                    return (
                      <div key={t.value} className="flex items-center justify-between py-2 text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${t.cor}`}>{t.label}</span>
                        <div className="flex gap-4 items-center">
                          <span className="text-gray-400 text-xs">{pct}%</span>
                          <span className="font-semibold text-gray-800 w-28 text-right">{fmtBRL(val)}</span>
                        </div>
                      </div>
                    );
                  })}
                  {relTipoRel === 'ambos' && (
                    <div className="flex items-center justify-between py-2 text-sm border-t border-gray-200">
                      <span className="text-xs font-bold text-gray-600">TOTAL ENTRADAS</span>
                      <span className="font-bold text-green-700 w-28 text-right">{fmtBRL(relTotalEntradas)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Por tipo — Saídas */}
            {(relTipoRel === 'saidas' || relTipoRel === 'ambos') && (
              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-2">Resumo de Saídas por categoria</h3>
                <div className="divide-y divide-gray-100">
                  {TIPOS_SAIDA.map(t => {
                    const val = relPorTipoSaida[t.value] ?? 0;
                    const base = relTotalSaidas > 0 ? relTotalSaidas : 1;
                    const pct = ((val / base) * 100).toFixed(1);
                    return (
                      <div key={t.value} className="flex items-center justify-between py-2 text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${t.cor}`}>{t.label}</span>
                        <div className="flex gap-4 items-center">
                          <span className="text-gray-400 text-xs">{pct}%</span>
                          <span className="font-semibold text-red-700 w-28 text-right">{fmtBRL(val)}</span>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between py-2 text-sm border-t border-gray-200">
                    <span className="text-xs font-bold text-gray-600">{relTipoRel === 'ambos' ? 'TOTAL SAÍDAS' : 'TOTAL'}</span>
                    <span className="font-bold text-red-600 w-28 text-right">{fmtBRL(relTotalSaidas)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Detalhado */}
            <div className={relMostrarDet ? '' : 'no-print'}>
              <h3 className="text-sm font-semibold text-gray-600 mb-2">Lançamentos detalhados</h3>
              {relDados.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhum lançamento no período.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-gray-100 rounded-lg overflow-hidden">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Data</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Caixa</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Departamento</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Tipo</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Referência</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Forma</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {relDados.map(l => (
                        <tr key={l.id} className={l.tipo_movimento === 'saida' ? 'bg-red-50/30' : ''}>
                          <td className="px-3 py-2 text-gray-600">{fmtDate(l.data_lancamento)}</td>
                          <td className="px-3 py-2 text-gray-700">{l.congregacao_nome}</td>
                          <td className="px-3 py-2 text-gray-500 text-xs">{l.departamento_nome}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${tipoCor(l.tipo_recebimento)}`}>
                              {tipoLabel(l.tipo_recebimento)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-500">{l.referencia || l.descricao || '—'}</td>
                          <td className="px-3 py-2 text-gray-500 capitalize">{l.forma_pagamento}</td>
                          <td className={`px-3 py-2 text-right font-semibold ${l.tipo_movimento === 'saida' ? 'text-red-600' : 'text-[#123b63]'}`}>
                            {l.tipo_movimento === 'saida' ? '−' : ''}{fmtBRL(Number(l.valor))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#123b63]/5 border-t border-gray-200">
                        <td colSpan={6} className="px-3 py-2 text-xs font-bold text-gray-600 text-right">TOTAL</td>
                        <td className={`px-3 py-2 text-right font-bold ${relTipoRel === 'saidas' ? 'text-red-600' : 'text-[#123b63]'}`}>{fmtBRL(relTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

            {/* Rodapé de impressão */}
            <div className="hidden print:block border-t border-gray-200 pt-3 mt-4 text-right text-xs text-gray-400">
              Impresso em: {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>

            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ABA: DIZIMISTAS
      ══════════════════════════════════════════════════════════════════════ */}
      {aba === 'dizimistas' && (
        <div className="space-y-5">

          {/* Filtros */}
          <div className="no-print bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Mês/Ano</label>
              <MonthPicker value={abaDizimistaMes} onChange={v => setAbaDizimistaMes(v)} />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Nome</label>
              <input
                type="text"
                placeholder="Buscar por nome..."
                value={filtroNomeDiz}
                onChange={e => setFiltroNomeDiz(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Congregação</label>
              <select
                value={filtroConsDiz}
                onChange={e => setFiltroConsDiz(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Todas</option>
                {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[130px]">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
              <select
                value={filtroStatusDiz}
                onChange={e => setFiltroStatusDiz(e.target.value as '' | 'pago' | 'pendente')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Todos</option>
                <option value="pago">Pago</option>
                <option value="pendente">Pendente</option>
              </select>
            </div>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0e2d4e] transition"
            >
              <Printer className="h-4 w-4" /> Imprimir
            </button>
          </div>

          {/* Cards resumo */}
          <div className="no-print grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Dizimistas</p>
              <p className="text-2xl font-bold text-[#123b63]">{dizimistas.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Deram dízimo este mês</p>
              <p className="text-2xl font-bold text-green-600">{totalPagos}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Não registrado</p>
              <p className="text-2xl font-bold text-yellow-600">{dizimistas.length - totalPagos}</p>
            </div>
          </div>

          {/* Área de impressão */}
          <div id="dizimistas-print" className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            {/* Timbre — visível apenas na impressão */}
            <div className="hidden print:block mb-6 border-b pb-4">
              {ministerio?.logo && (
                <img src={ministerio.logo} alt="Logo" className="h-16 mb-2" />
              )}
              <h1 className="text-xl font-bold text-gray-900">{ministerio?.nome ?? 'Ministério'}</h1>
              {ministerio?.endereco && <p className="text-xs text-gray-600">{ministerio.endereco}</p>}
              {(ministerio?.telefone || ministerio?.email) && (
                <p className="text-xs text-gray-600">
                  {[ministerio.telefone, ministerio.email].filter(Boolean).join(' | ')}
                </p>
              )}
              <h2 className="text-base font-semibold text-gray-700 mt-3">Lista de Dizimistas — {abaDizimistaMes.split('-').reverse().join('/')}</h2>
            </div>

            {loadingDizimistas ? (
              <div className="text-center py-8 text-gray-400">Carregando...</div>
            ) : dizimistasVisiveis.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                {dizimistas.length === 0
                  ? 'Nenhum dizimista cadastrado. Marque membros como dizimistas na tela de Membros.'
                  : 'Nenhum resultado para os filtros selecionados.'}
              </div>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">#</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">Nome</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">Congregação</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dizimistasVisiveis.map((d, i) => (
                    <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50 last:border-0">
                      <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-3 py-2 font-medium text-gray-800">{d.nome}</td>
                      <td className="px-3 py-2 text-gray-600">{d.congregacao_nome}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          d.status === 'pago'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {d.status === 'pago' ? 'Registrado' : 'Não registrado'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Rodapé de impressão */}
            <div className="hidden print:block border-t border-gray-200 pt-3 mt-4 text-right text-xs text-gray-400">
              Impresso em: {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Delete ─────────────────────────────────────────────────── */}
      {confirmDel && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-base font-bold text-gray-800 mb-2">Excluir Lançamento</h3>
            <p className="text-sm text-gray-600 mb-5">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(confirmDel)}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition"
              >
                Excluir
              </button>
              <button
                onClick={() => setConfirmDel(null)}
                className="flex-1 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Notification ──────────────────────────────────────────────────── */}
      <NotificationModal
        isOpen={modal.open}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        onClose={() => setModal(p => ({ ...p, open: false }))}
      />
    </PageLayout>
  );
}
