'use client';

import { useEffect, useMemo, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import Tabs from '@/components/Tabs';
import Section from '@/components/Section';
import NotificationModal from '@/components/NotificationModal';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import { fetchConfiguracaoIgrejaFromSupabase, type ConfiguracaoIgreja } from '@/lib/igreja-config-utils';
import { Pencil, Trash2, Printer, Search } from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface LocalOption {
  id: string;
  nome: string;
  tipo: 'campo' | 'congregacao';
  dirigente?: string | null;
  dirigente_cargo?: string | null;
  pastor_nome?: string | null;
}

interface PatrimonioItem {
  id: string;
  ministry_id: string;
  congregacao_id?: string | null;
  campo_id?: string | null;
  local_descricao?: string | null;
  numero_tombamento?: string | null;
  descricao: string;
  categoria: string;
  marca_modelo?: string | null;
  numero_serie?: string | null;
  cor?: string | null;
  estado_conservacao: string;
  valor_aquisicao?: number | null;
  data_aquisicao?: string | null;
  origem?: string | null;
  responsavel_nome?: string | null;
  responsavel_cargo?: string | null;
  status: string;
  data_baixa?: string | null;
  motivo_baixa?: string | null;
  observacoes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const CATEGORIAS = [
  { value: 'equipamento', label: 'Equipamento' },
  { value: 'movel', label: 'Móvel / Utensílio' },
  { value: 'imovel', label: 'Imóvel / Prédio' },
  { value: 'veiculo', label: 'Veículo' },
  { value: 'instrumento', label: 'Instrumento Musical' },
  { value: 'eletronico', label: 'Eletrônico / Sonorização' },
  { value: 'outros', label: 'Outros' },
];

const ESTADOS = [
  { value: 'otimo', label: 'Ótimo', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'bom', label: 'Bom', color: 'bg-blue-100 text-blue-700' },
  { value: 'regular', label: 'Regular', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'ruim', label: 'Ruim', color: 'bg-orange-100 text-orange-700' },
  { value: 'inservivel', label: 'Inservível', color: 'bg-red-100 text-red-700' },
];

const STATUS_OPTIONS = [
  { value: 'ativo', label: 'Ativo', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'emprestado', label: 'Emprestado', color: 'bg-blue-100 text-blue-700' },
  { value: 'extraviado', label: 'Extraviado', color: 'bg-orange-100 text-orange-700' },
  { value: 'baixado', label: 'Baixado', color: 'bg-gray-100 text-gray-500' },
];

const ORIGENS = [
  { value: 'compra', label: 'Compra' },
  { value: 'doacao', label: 'Doação' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'outros', label: 'Outros' },
];

const TABS = [
  { id: 'cadastro', label: 'Cadastro', icon: '📝' },
  { id: 'inventario', label: 'Inventário', icon: '📋' },
];

const EMPTY_FORM = {
  local_id: '',
  local_descricao: '',
  numero_tombamento: '',
  descricao: '',
  categoria: 'equipamento',
  marca_modelo: '',
  numero_serie: '',
  cor: '',
  estado_conservacao: 'bom',
  valor_aquisicao: '',
  data_aquisicao: '',
  origem: 'compra',
  status: 'ativo',
  data_baixa: '',
  motivo_baixa: '',
  observacoes: '',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function imprimirEtiquetas(itens: PatrimonioItem[], locaisRef: LocalOption[]) {
  const getNome = (item: PatrimonioItem) => {
    if (item.congregacao_id) return locaisRef.find((l) => l.id === item.congregacao_id)?.nome || item.local_descricao || '';
    if (item.campo_id) return locaisRef.find((l) => l.id === item.campo_id)?.nome || item.local_descricao || '';
    return item.local_descricao || '';
  };

  const etiquetasHtml = itens.map((item, i) => {
    const localNome = getNome(item);
    const qrData = encodeURIComponent(
      [item.numero_tombamento || `#${i + 1}`, item.descricao, localNome].filter(Boolean).join('\n')
    );
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${qrData}&margin=2`;
    return `
      <div class="etiqueta">
        <img src="${qrUrl}" class="qr" alt="QR" loading="eager" />
        <div class="info">
          <div class="tomb">${item.numero_tombamento || '-'}</div>
          <div class="desc">${item.descricao}</div>
          <div class="local">${localNome}</div>
        </div>
      </div>
    `;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>Etiquetas de Patrimônio</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  @page{size:A4;margin:14mm 12mm}
  body{font-family:Arial,sans-serif;padding:14mm 12mm}
  .pagina{display:grid;grid-template-columns:1fr 1fr;gap:4mm;width:100%}
  .etiqueta{display:flex;align-items:center;gap:8px;border:1px solid #aaa;border-radius:4px;padding:6px 8px;height:38mm;overflow:hidden;page-break-inside:avoid}
  .qr{width:30mm;height:30mm;flex-shrink:0}
  .info{flex:1;overflow:hidden;display:flex;flex-direction:column;gap:3px;min-width:0}
  .tomb{font-size:15px;font-weight:700;color:#123b63;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .desc{font-size:12px;color:#333;line-height:1.35;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
  .local{font-size:11px;color:#555;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:auto;border-top:1px dotted #ccc;padding-top:3px}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
  <div class="pagina">${etiquetasHtml}</div>
  <script>window.onload=function(){setTimeout(function(){window.print()},1200)}<\/script>
</body></html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
}

const formatIso = (v?: string | null) => {
  if (!v) return '';
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
};

const formatCurrency = (v?: number | null) =>
  v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-';

// ─── Impressão ────────────────────────────────────────────────────────────────

function imprimirFichaPatrimonio(opts: {
  itens: PatrimonioItem[];
  local: LocalOption;
  configIgreja: ConfiguracaoIgreja;
}) {
  const { itens, local, configIgreja } = opts;
  const hoje = new Date().toLocaleDateString('pt-BR');

  const dirigente = local.tipo === 'congregacao'
    ? (local.dirigente || '-')
    : (local.pastor_nome || '-');
  const cargoDirigente = local.tipo === 'congregacao'
    ? (local.dirigente_cargo || 'Dirigente')
    : 'Pastor';

  const linhasHtml = itens.map((item, i) => `
    <tr style="border-bottom:1px solid #e5e7eb;${i % 2 === 0 ? 'background:#f9fafb' : ''}">
      <td style="padding:6px 8px;font-size:11px;text-align:center;">${item.numero_tombamento || (i + 1)}</td>
      <td style="padding:6px 8px;font-size:11px;">${item.descricao}</td>
      <td style="padding:6px 8px;font-size:11px;text-align:center;">${CATEGORIAS.find(c => c.value === item.categoria)?.label || item.categoria}</td>
      <td style="padding:6px 8px;font-size:11px;">${item.marca_modelo || '-'}</td>
      <td style="padding:6px 8px;font-size:11px;text-align:center;">${item.numero_serie || '-'}</td>
      <td style="padding:6px 8px;font-size:11px;text-align:center;">${ESTADOS.find(e => e.value === item.estado_conservacao)?.label || item.estado_conservacao}</td>
      <td style="padding:6px 8px;font-size:11px;text-align:right;">${formatCurrency(item.valor_aquisicao)}</td>
      <td style="padding:6px 8px;font-size:11px;">${item.observacoes || ''}</td>
    </tr>
  `).join('');

  const totalValor = itens.reduce((acc, i) => acc + (i.valor_aquisicao || 0), 0);

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>Ficha de Patrimônio</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  @page{size:A4;margin:16mm 14mm}
  body{font-family:Arial,sans-serif;color:#111;font-size:12px}
  .header{display:flex;align-items:center;gap:16px;border-bottom:2px solid #123b63;padding-bottom:12px;margin-bottom:14px}
  .header img{height:64px;object-fit:contain}
  .header-text h1{font-size:16px;font-weight:700;color:#123b63}
  .header-text p{font-size:11px;color:#555;margin-top:2px}
  .titulo{text-align:center;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:10px 0;color:#123b63}
  .meta{display:flex;gap:32px;flex-wrap:wrap;margin-bottom:12px;font-size:11px}
  .meta-item{display:flex;flex-direction:column}
  .meta-item strong{font-size:10px;text-transform:uppercase;color:#555}
  table{width:100%;border-collapse:collapse;margin-bottom:16px}
  thead tr{background:#123b63;color:#fff}
  thead th{padding:7px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.5px;text-align:left}
  .total-row{font-weight:700;background:#f3f4f6}
  .section-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#123b63;border-top:1px solid #123b63;padding-top:14px;margin-top:8px;margin-bottom:10px}
  .assinaturas{display:flex;gap:32px;margin-top:8px}
  .assinatura-box{flex:1}
  .assinatura-linha{border-top:1px solid #111;margin-top:40px}
  .assinatura-nome{font-size:11px;font-weight:700;margin-top:4px}
  .assinatura-cargo{font-size:10px;color:#555}
  .rodape{margin-top:20px;text-align:center;font-size:9px;color:#999;border-top:1px solid #e5e7eb;padding-top:8px}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
  <div class="header">
    ${configIgreja.logo ? `<img src="${configIgreja.logo}" alt="Logo" />` : ''}
    <div class="header-text">
      <h1>${configIgreja.nome}</h1>
      <p>${configIgreja.endereco || ''}</p>
      ${configIgreja.cnpj ? `<p>CNPJ: ${configIgreja.cnpj}</p>` : ''}
      ${configIgreja.telefone ? `<p>${configIgreja.telefone}</p>` : ''}
    </div>
  </div>
  <div class="titulo">Ficha de Patrimônio</div>
  <div class="meta">
    <div class="meta-item"><strong>Local</strong>${local.nome}</div>
    <div class="meta-item"><strong>Dirigente atual</strong>${dirigente}</div>
    <div class="meta-item"><strong>Cargo</strong>${cargoDirigente}</div>
    <div class="meta-item"><strong>Data de emissão</strong>${hoje}</div>
    <div class="meta-item"><strong>Total de itens</strong>${itens.length}</div>
  </div>
  <table>
    <thead><tr>
      <th style="width:48px">Nº</th><th>Descrição</th><th style="width:90px">Categoria</th>
      <th style="width:110px">Marca/Modelo</th><th style="width:90px">Nº Série</th>
      <th style="width:70px">Estado</th><th style="width:80px">Valor</th><th>Obs.</th>
    </tr></thead>
    <tbody>
      ${linhasHtml}
      <tr class="total-row">
        <td colspan="6" style="padding:6px 8px;font-size:11px;text-align:right;">Total estimado:</td>
        <td style="padding:6px 8px;font-size:11px;text-align:right;">${formatCurrency(totalValor)}</td>
        <td></td>
      </tr>
    </tbody>
  </table>
  <div class="section-title">Termos e Assinaturas</div>
  <p style="font-size:11px;margin-bottom:16px;">Eu, abaixo assinado(a), declaro ter recebido/entregado os bens acima relacionados, comprometendo-me a zelar pela sua conservação e uso adequado conforme as normas do ministério.</p>
  <div class="assinaturas">
    <div class="assinatura-box">
      <div class="assinatura-linha"></div>
      <div class="assinatura-nome">${dirigente}</div>
      <div class="assinatura-cargo">${cargoDirigente} — Saída / Entrega</div>
    </div>
    <div class="assinatura-box">
      <div class="assinatura-linha"></div>
      <div class="assinatura-nome">Novo Dirigente</div>
      <div class="assinatura-cargo">Dirigente — Entrada / Recebimento</div>
    </div>
    <div class="assinatura-box">
      <div class="assinatura-linha"></div>
      <div class="assinatura-nome">Pastor do Ministério</div>
      <div class="assinatura-cargo">Testemunha / Responsável</div>
    </div>
  </div>
  <div class="rodape">Documento gerado em ${hoje} · ${configIgreja.nome} · Gestão Eklesia</div>
</body></html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

// ─── Página ────────────────────────────────────────────────────────────────────

export default function PatrimonioPage() {
  const { loading } = useRequireSupabaseAuth();
  const supabase = useMemo(() => createClient(), []);

  const [activeTab, setActiveTab] = useState('inventario');
  const [ministryId, setMinistryId] = useState<string | null>(null);
  const [itens, setItens] = useState<PatrimonioItem[]>([]);
  const [locais, setLocais] = useState<LocalOption[]>([]);
  const [configIgreja, setConfigIgreja] = useState<ConfiguracaoIgreja>({
    nome: 'Igreja/Ministério', endereco: '', cnpj: '', telefone: '', email: '', logo: '',
  });
  const [loadingData, setLoadingData] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Filtros
  const [filterLocal, setFilterLocal] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('');
  const [filterStatus, setFilterStatus] = useState('ativo');
  const [filterSearch, setFilterSearch] = useState('');

  const [notification, setNotification] = useState({
    isOpen: false, title: '', message: '',
    type: 'success' as 'success' | 'error' | 'warning' | 'info', autoClose: 3000 as number | undefined,
  });

  const showNotif = (type: typeof notification.type, title: string, message: string, autoClose: number | undefined = 3000) =>
    setNotification({ isOpen: true, title, message, type, autoClose });

  const resetForm = () => { setFormData({ ...EMPTY_FORM }); setEditingId(null); setFieldErrors({}); };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formData.descricao.trim()) e.descricao = 'Informe a descrição do bem.';
    setFieldErrors(e);
    return Object.keys(e).length === 0;
  };

  const localSelecionado = useMemo(
    () => (formData.local_id ? locais.find((l) => l.id === formData.local_id) ?? null : null),
    [formData.local_id, locais]
  );

  const nomeDirigente = localSelecionado
    ? localSelecionado.tipo === 'congregacao'
      ? (localSelecionado.dirigente || '')
      : (localSelecionado.pastor_nome || '')
    : '';

  const cargoDirigente = localSelecionado
    ? localSelecionado.tipo === 'congregacao'
      ? (localSelecionado.dirigente_cargo || 'Dirigente')
      : 'Pastor'
    : '';

  const loadLocais = async (mid: string) => {
    const [camposRes, congRes] = await Promise.all([
      supabase.from('campos').select('id, nome, pastor_nome').eq('ministry_id', mid).eq('is_active', true).order('nome'),
      supabase.from('congregacoes').select('id, nome, dirigente, dirigente_cargo').eq('ministry_id', mid).eq('is_active', true).order('nome'),
    ]);
    const lista: LocalOption[] = [
      ...((camposRes.data || []).map((c: any) => ({ id: c.id, nome: c.nome, tipo: 'campo' as const, pastor_nome: c.pastor_nome }))),
      ...((congRes.data || []).map((c: any) => ({ id: c.id, nome: c.nome, tipo: 'congregacao' as const, dirigente: c.dirigente, dirigente_cargo: c.dirigente_cargo }))),
    ];
    setLocais(lista);
  };

  const loadItens = async (mid: string) => {
    const { data, error } = await supabase
      .from('patrimonio_itens').select('*').eq('ministry_id', mid).order('created_at', { ascending: false });
    if (error) { showNotif('error', 'Erro ao carregar', error.message, false); return; }
    setItens((data || []) as PatrimonioItem[]);
  };

  const generateNextTombamento = async (mid: string): Promise<string> => {
    const { data } = await supabase
      .from('patrimonio_itens')
      .select('numero_tombamento')
      .eq('ministry_id', mid)
      .not('numero_tombamento', 'is', null);
    let maxNum = 0;
    for (const row of (data || [])) {
      const m = (row.numero_tombamento as string)?.match(/(\d+)$/);
      if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
    }
    return `PAT-${String(maxNum + 1).padStart(3, '0')}`;
  };

  useEffect(() => {
    if (loading) return;
    const run = async () => {
      setLoadingData(true);
      const mid = await resolveMinistryId(supabase);
      setMinistryId(mid);
      const config = await fetchConfiguracaoIgrejaFromSupabase(supabase);
      setConfigIgreja(config);
      if (mid) {
        await Promise.all([loadLocais(mid), loadItens(mid)]);
        const nextTomb = await generateNextTombamento(mid);
        setFormData((p) => ({ ...p, numero_tombamento: nextTomb }));
      }
      setLoadingData(false);
    };
    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const handleSubmit = async () => {
    if (!ministryId || !validate()) return;

    const payload: any = {
      ministry_id: ministryId,
      congregacao_id: localSelecionado?.tipo === 'congregacao' ? localSelecionado.id : null,
      campo_id: localSelecionado?.tipo === 'campo' ? localSelecionado.id : null,
      local_descricao: !localSelecionado ? formData.local_descricao.trim() || null : null,
      numero_tombamento: formData.numero_tombamento.trim() || null,
      descricao: formData.descricao.trim(),
      categoria: formData.categoria,
      marca_modelo: formData.marca_modelo.trim() || null,
      numero_serie: formData.numero_serie.trim() || null,
      cor: formData.cor.trim() || null,
      estado_conservacao: formData.estado_conservacao,
      valor_aquisicao: formData.valor_aquisicao ? parseFloat(String(formData.valor_aquisicao).replace(',', '.')) : null,
      data_aquisicao: formData.data_aquisicao || null,
      origem: formData.origem,
      responsavel_nome: nomeDirigente || null,
      responsavel_cargo: cargoDirigente || null,
      status: formData.status,
      data_baixa: formData.status === 'baixado' ? formData.data_baixa || null : null,
      motivo_baixa: formData.status === 'baixado' ? formData.motivo_baixa.trim() || null : null,
      observacoes: formData.observacoes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      const { data, error } = await supabase.from('patrimonio_itens').update(payload).eq('id', editingId).select('*').single();
      if (error) { showNotif('error', 'Erro', error.message, false); return; }
      setItens((prev) => prev.map((i) => (i.id === editingId ? (data as PatrimonioItem) : i)));
      showNotif('success', 'Atualizado', 'Bem atualizado com sucesso.', true);
    } else {
      const { data, error } = await supabase
        .from('patrimonio_itens').insert({ ...payload, created_at: new Date().toISOString() }).select('*').single();
      if (error) { showNotif('error', 'Erro', error.message, false); return; }
      setItens((prev) => [data as PatrimonioItem, ...prev]);
      showNotif('success', 'Cadastrado', 'Bem registrado com sucesso.', true);
    }

    const wasNew = !editingId;
    resetForm();
    if (wasNew && ministryId) {
      generateNextTombamento(ministryId).then((t) => setFormData((p) => ({ ...p, numero_tombamento: t })));
    }
    setActiveTab('inventario');
  };

  const handleEdit = (item: PatrimonioItem) => {
    setEditingId(item.id);
    setFormData({
      local_id: item.congregacao_id || item.campo_id || '',
      local_descricao: item.local_descricao || '',
      numero_tombamento: item.numero_tombamento || '',
      descricao: item.descricao,
      categoria: item.categoria,
      marca_modelo: item.marca_modelo || '',
      numero_serie: item.numero_serie || '',
      cor: item.cor || '',
      estado_conservacao: item.estado_conservacao,
      valor_aquisicao: item.valor_aquisicao != null ? String(item.valor_aquisicao) : '',
      data_aquisicao: formatIso(item.data_aquisicao),
      origem: item.origem || 'compra',

      status: item.status,
      data_baixa: formatIso(item.data_baixa),
      motivo_baixa: item.motivo_baixa || '',
      observacoes: item.observacoes || '',
    });
    setActiveTab('cadastro');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este bem do patrimônio?')) return;
    const { error } = await supabase.from('patrimonio_itens').delete().eq('id', id);
    if (error) { showNotif('error', 'Erro', error.message, false); return; }
    setItens((prev) => prev.filter((i) => i.id !== id));
    showNotif('success', 'Excluído', 'Bem removido do patrimônio.', true);
  };

  const getNomeLocal = (item: PatrimonioItem) => {
    if (item.congregacao_id) return locais.find((l) => l.id === item.congregacao_id)?.nome || item.local_descricao || '-';
    if (item.campo_id) return locais.find((l) => l.id === item.campo_id)?.nome || item.local_descricao || '-';
    return item.local_descricao || '-';
  };

  const handleImprimir = (localId: string, localTipo: 'campo' | 'congregacao') => {
    const local = locais.find((l) => l.id === localId && l.tipo === localTipo);
    if (!local) return;
    const itensFicha = itensFiltrados.filter((i) =>
      localTipo === 'congregacao' ? i.congregacao_id === localId : i.campo_id === localId
    );
    if (itensFicha.length === 0) {
      showNotif('warning', 'Aviso', 'Nenhum bem encontrado com os filtros atuais para este local.', true);
      return;
    }
    imprimirFichaPatrimonio({ itens: itensFicha, local, configIgreja });
  };

  const itensFiltrados = useMemo(() => itens.filter((item) => {
    const matchStatus = !filterStatus || item.status === filterStatus;
    const matchCat = !filterCategoria || item.categoria === filterCategoria;
    const matchLocal = !filterLocal || item.congregacao_id === filterLocal || item.campo_id === filterLocal;
    const termo = filterSearch.toLowerCase();
    const matchSearch = !termo ||
      item.descricao.toLowerCase().includes(termo) ||
      (item.numero_tombamento || '').toLowerCase().includes(termo) ||
      (item.marca_modelo || '').toLowerCase().includes(termo) ||
      (item.responsavel_nome || '').toLowerCase().includes(termo) ||
      getNomeLocal(item).toLowerCase().includes(termo);
    return matchStatus && matchCat && matchLocal && matchSearch;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [itens, filterStatus, filterCategoria, filterLocal, filterSearch, locais]);

  const totalValorFiltrado = itensFiltrados.reduce((acc, i) => acc + (i.valor_aquisicao || 0), 0);

  if (loading || loadingData) return <div className="p-8">Carregando...</div>;

  return (
    <PageLayout title="Patrimônio" description="Gestão de bens das congregações e campos" activeMenu="patrimonio">
      <NotificationModal
        isOpen={notification.isOpen} title={notification.title} message={notification.message}
        type={notification.type} onClose={() => setNotification((p) => ({ ...p, isOpen: false }))}
        autoClose={notification.autoClose}
      />

      {/* Cards de resumo */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border-l-4 border-blue-500 p-4 w-56">
          <p className="text-xs text-gray-500">Itens cadastrados</p>
          <p className="text-xl font-bold text-[#123b63] mt-1">{itens.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border-l-4 border-purple-500 p-4 w-56">
          <p className="text-xs text-gray-500">Valor total estimado</p>
          <p className="text-xl font-bold text-[#123b63] mt-1">{formatCurrency(itens.reduce((a, i) => a + (i.valor_aquisicao || 0), 0))}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white/90 shadow-sm">
        <div className="p-4 md:p-6">
          <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}>

            {/* ═══════════════ ABA CADASTRO ═══════════════ */}
            {activeTab === 'cadastro' && (
              <Section icon="📝" title={editingId ? 'Editar Bem' : 'Registrar Bem'}>
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-5">

                  {/* Local */}
                  <fieldset className="border border-gray-200 rounded-xl p-4">
                    <legend className="text-xs font-semibold text-gray-500 px-1">Local / Congregação</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Congregação/Igreja</label>
                        <select
                          value={formData.local_id}
                          onChange={(e) => setFormData((p) => ({ ...p, local_id: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        >
                          <option value="">Selecione...</option>
                          {locais.filter((l) => l.tipo === 'congregacao').map((c) => (
                            <option key={c.id} value={c.id}>{c.nome}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Pastor/Dirigente</label>
                        <input
                          readOnly
                          value={nomeDirigente ? `${nomeDirigente}${cargoDirigente ? ' — ' + cargoDirigente : ''}` : ''}
                          placeholder="Preenchido ao selecionar o local"
                          className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 cursor-default"
                        />
                      </div>
                    </div>
                  </fieldset>

                  {/* Dados do bem */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Nº de tombamento</label>
                      <input
                        value={formData.numero_tombamento}
                        onChange={(e) => setFormData((p) => ({ ...p, numero_tombamento: e.target.value }))}
                        placeholder="Ex: PAT-001"
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs font-semibold text-gray-600">Descrição do bem *</label>
                      <input
                        value={formData.descricao}
                        onChange={(e) => setFormData((p) => ({ ...p, descricao: e.target.value }))}
                        placeholder="Ex: Cadeira giratória preta, Mesa de madeira..."
                        className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${fieldErrors.descricao ? 'border-red-400' : 'border-gray-200'}`}
                      />
                      {fieldErrors.descricao && <p className="text-xs text-red-600 mt-1">{fieldErrors.descricao}</p>}
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Categoria</label>
                      <select
                        value={formData.categoria}
                        onChange={(e) => setFormData((p) => ({ ...p, categoria: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      >
                        {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Marca / Modelo</label>
                      <input
                        value={formData.marca_modelo}
                        onChange={(e) => setFormData((p) => ({ ...p, marca_modelo: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Nº de série / Placa</label>
                      <input
                        value={formData.numero_serie}
                        onChange={(e) => setFormData((p) => ({ ...p, numero_serie: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Cor</label>
                      <input
                        value={formData.cor}
                        onChange={(e) => setFormData((p) => ({ ...p, cor: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Estado de conservação</label>
                      <select
                        value={formData.estado_conservacao}
                        onChange={(e) => setFormData((p) => ({ ...p, estado_conservacao: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      >
                        {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Valor de aquisição (R$)</label>
                      <input
                        type="number" min="0" step="0.01"
                        value={formData.valor_aquisicao}
                        onChange={(e) => setFormData((p) => ({ ...p, valor_aquisicao: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Data de aquisição</label>
                      <input
                        type="date"
                        value={formData.data_aquisicao}
                        onChange={(e) => setFormData((p) => ({ ...p, data_aquisicao: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Origem</label>
                      <select
                        value={formData.origem}
                        onChange={(e) => setFormData((p) => ({ ...p, origem: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      >
                        {ORIGENS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      >
                        {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Campos de baixa */}
                  {formData.status === 'baixado' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Data da baixa</label>
                        <input
                          type="date" value={formData.data_baixa}
                          onChange={(e) => setFormData((p) => ({ ...p, data_baixa: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Motivo da baixa</label>
                        <input
                          value={formData.motivo_baixa}
                          onChange={(e) => setFormData((p) => ({ ...p, motivo_baixa: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-semibold text-gray-600">Observações</label>
                    <textarea
                      value={formData.observacoes}
                      onChange={(e) => setFormData((p) => ({ ...p, observacoes: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm min-h-[72px]"
                    />
                  </div>

                  <div className="flex flex-wrap gap-3 justify-end">
                    {editingId && (
                      <button onClick={resetForm} className="px-4 py-2 rounded-lg border border-gray-200 text-sm">
                        Cancelar edição
                      </button>
                    )}
                    <button onClick={handleSubmit} className="px-4 py-2 rounded-lg bg-[#123b63] text-white text-sm font-semibold">
                      {editingId ? 'Atualizar bem' : 'Salvar bem'}
                    </button>
                  </div>
                </div>
              </Section>
            )}

            {/* ═══════════════ ABA INVENTÁRIO ═══════════════ */}
            {activeTab === 'inventario' && (
              <Section icon="📋" title="Inventário">
                {/* Filtros */}
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      value={filterSearch}
                      onChange={(e) => setFilterSearch(e.target.value)}
                      placeholder="Buscar descrição, local, responsável..."
                      className="pl-9 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <select
                    value={filterLocal}
                    onChange={(e) => setFilterLocal(e.target.value)}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm min-w-[160px]"
                  >
                    <option value="">Todos os locais</option>
                    {locais.map((l) => <option key={l.id} value={l.id}>{l.nome} ({l.tipo})</option>)}
                  </select>
                  <select
                    value={filterCategoria}
                    onChange={(e) => setFilterCategoria(e.target.value)}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm min-w-[140px]"
                  >
                    <option value="">Todas categorias</option>
                    {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm min-w-[120px]"
                  >
                    <option value="">Todos os status</option>
                    {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <button
                    onClick={async () => {
                      resetForm();
                      if (ministryId) {
                        const t = await generateNextTombamento(ministryId);
                        setFormData((p) => ({ ...p, numero_tombamento: t }));
                      }
                      setActiveTab('cadastro');
                    }}
                    className="px-4 py-2 rounded-lg bg-[#123b63] text-white text-sm font-semibold whitespace-nowrap"
                  >
                    + Novo bem
                  </button>
                </div>

                {/* Botões de impressão */}
                <div className="mb-3 flex flex-wrap gap-2">
                  {filterLocal && (() => {
                    const local = locais.find((l) => l.id === filterLocal);
                    if (!local) return null;
                    return (
                      <button
                        onClick={() => handleImprimir(filterLocal, local.tipo)}
                        className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                      >
                        <Printer className="h-4 w-4" />
                        Ficha de Patrimônio — {local.nome}
                      </button>
                    );
                  })()}
                  {itensFiltrados.length > 0 && (
                    <button
                      onClick={() => imprimirEtiquetas(itensFiltrados, locais)}
                      className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      <Printer className="h-4 w-4" />
                      Imprimir Etiquetas ({itensFiltrados.length})
                    </button>
                  )}
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  {itensFiltrados.length === 0 ? (
                    <p className="text-sm text-gray-500">Nenhum bem encontrado.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase text-gray-400 border-b">
                            <th className="py-2 pr-3">Nº</th>
                            <th className="py-2 pr-3">Bem</th>
                            <th className="py-2 pr-3">Local</th>
                            <th className="py-2 pr-3">Responsável</th>
                            <th className="py-2 pr-3">Estado</th>
                            <th className="py-2 pr-3">Valor</th>
                            <th className="py-2 pr-3">Status</th>
                            <th className="py-2">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itensFiltrados.map((item) => {
                            const estadoOpt = ESTADOS.find((e) => e.value === item.estado_conservacao);
                            const statusOpt = STATUS_OPTIONS.find((s) => s.value === item.status);
                            return (
                              <tr key={item.id} className="border-b last:border-b-0 hover:bg-gray-50">
                                <td className="py-3 pr-3 text-xs text-gray-500">{item.numero_tombamento || '-'}</td>
                                <td className="py-3 pr-3">
                                  <div className="font-semibold text-gray-800 max-w-[180px] truncate" title={item.descricao}>{item.descricao}</div>
                                  <div className="text-xs text-gray-400">{CATEGORIAS.find((c) => c.value === item.categoria)?.label}</div>
                                  {item.marca_modelo && <div className="text-xs text-gray-400">{item.marca_modelo}</div>}
                                </td>
                                <td className="py-3 pr-3 text-xs text-gray-600">{getNomeLocal(item)}</td>
                                <td className="py-3 pr-3">
                                  <div className="text-xs text-gray-700">{item.responsavel_nome || '-'}</div>
                                  {item.responsavel_cargo && <div className="text-[11px] text-gray-400">{item.responsavel_cargo}</div>}
                                </td>
                                <td className="py-3 pr-3">
                                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${estadoOpt?.color || 'bg-gray-100 text-gray-600'}`}>
                                    {estadoOpt?.label || item.estado_conservacao}
                                  </span>
                                </td>
                                <td className="py-3 pr-3 text-xs text-gray-600">{formatCurrency(item.valor_aquisicao)}</td>
                                <td className="py-3 pr-3">
                                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusOpt?.color || 'bg-gray-100 text-gray-600'}`}>
                                    {statusOpt?.label || item.status}
                                  </span>
                                </td>
                                <td className="py-3">
                                  <div className="flex items-center gap-2">
                                    <button title="Editar" onClick={() => handleEdit(item)} className="rounded-md border border-gray-200 p-2 text-gray-600 hover:bg-gray-50">
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                    <button title="Excluir" onClick={() => handleDelete(item.id)} className="rounded-md border border-gray-200 p-2 text-gray-600 hover:bg-gray-50">
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t">
                            <td colSpan={5} className="pt-3 text-xs font-semibold text-gray-500 text-right pr-3">
                              Total estimado dos itens filtrados:
                            </td>
                            <td className="pt-3 text-xs font-bold text-gray-800">{formatCurrency(totalValorFiltrado)}</td>
                            <td colSpan={2}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              </Section>
            )}
          </Tabs>
        </div>
      </div>
    </PageLayout>
  );
}
