'use client';

import { useEffect, useMemo, useState } from 'react';
import NotificationModal from '@/components/NotificationModal';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { useAuditLog } from '@/hooks/useAuditLog';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import { fetchConfiguracaoIgrejaFromSupabase, type ConfiguracaoIgreja } from '@/lib/igreja-config-utils';
import { obterEstruturaOrganizacionalService } from '@/services/estrutura-organizacional-service';
import {
  Package,
  Building2,
  Landmark,
  CheckCircle2,
  DollarSign,
  Search,
  Plus,
  Pencil,
  Trash2,
  Printer,
  Tag,
  ClipboardList,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';

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
  { value: 'otimo', label: 'Ótimo', color: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  { value: 'bom', label: 'Bom', color: 'bg-blue-50 text-blue-700 border border-blue-200' },
  { value: 'regular', label: 'Regular', color: 'bg-amber-50 text-amber-700 border border-amber-200' },
  { value: 'ruim', label: 'Ruim', color: 'bg-orange-50 text-orange-700 border border-orange-200' },
  { value: 'inservivel', label: 'Inservível', color: 'bg-rose-50 text-rose-700 border border-rose-200' },
];

const STATUS_OPTIONS = [
  { value: 'ativo', label: 'Ativo', color: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  { value: 'emprestado', label: 'Emprestado', color: 'bg-blue-50 text-blue-700 border border-blue-200' },
  { value: 'extraviado', label: 'Extraviado', color: 'bg-amber-50 text-amber-700 border border-amber-200' },
  { value: 'baixado', label: 'Baixado', color: 'bg-slate-100 text-slate-600 border border-slate-200' },
];

const ORIGENS = [
  { value: 'compra', label: 'Compra' },
  { value: 'doacao', label: 'Doação' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'outros', label: 'Outros' },
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

// ─── Impressão de Etiquetas ───────────────────────────────────────────────────

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

// ─── Impressão de Ficha ────────────────────────────────────────────────────────

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

// ─── Estilos de Input e Label Padrão Membros ───────────────────────────────────

const inputCls =
  'w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition';
const labelCls =
  'block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5';

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function PatrimonioPage() {
  const { ctx, bloqueado } = useRequireModulo('patrimonio');
  const { registrarAcao } = useAuditLog();
  const supabase = useMemo(() => createClient(), []);

  const [activeTab, setActiveTab] = useState<'inventario' | 'cadastro'>('inventario');
  const [ministryId, setMinistryId] = useState<string | null>(null);
  const [itens, setItens] = useState<PatrimonioItem[]>([]);
  const [locais, setLocais] = useState<LocalOption[]>([]);
  const [configIgreja, setConfigIgreja] = useState<ConfiguracaoIgreja>({
    nome: 'Igreja/Ministério',
    endereco: '',
    cnpj: '',
    telefone: '',
    email: '',
    logo: '',
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

  const [notification, setNotification] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    autoClose?: number;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'success',
    autoClose: 3000,
  });

  const showNotif = (
    type: typeof notification.type,
    title: string,
    message: string,
    autoClose: number | undefined = 3000
  ) => setNotification({ isOpen: true, title, message, type, autoClose });

  const resetForm = () => {
    setFormData({
      ...EMPTY_FORM,
      local_id: ctx.nivel === 'operador' && ctx.congregacaoId ? ctx.congregacaoId : '',
    });
    setEditingId(null);
    setFieldErrors({});
  };

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
      ? localSelecionado.dirigente || ''
      : localSelecionado.pastor_nome || ''
    : '';

  const cargoDirigente = localSelecionado
    ? localSelecionado.tipo === 'congregacao'
      ? localSelecionado.dirigente_cargo || 'Dirigente'
      : 'Pastor'
    : '';

  const loadLocais = async (mid: string) => {
    const orgService = await obterEstruturaOrganizacionalService(mid, supabase);
    const div1Regs = orgService.getDivisao1();
    const div2Regs = orgService.getDivisao2();

    let div1Filtrada = div1Regs;
    let div2Filtrada = div2Regs;

    if (ctx.nivel === 'operador' && ctx.congregacaoId) {
      div1Filtrada = div1Regs.filter((c) => c.id === ctx.congregacaoId);
      div2Filtrada = [];
    }

    const lista: LocalOption[] = [
      ...div2Filtrada.map((c: any) => ({
        id: c.id,
        nome: c.nome,
        tipo: 'campo' as const,
        pastor_nome: c.pastor_nome || null,
      })),
      ...div1Filtrada.map((c: any) => ({
        id: c.id,
        nome: c.nome,
        tipo: 'congregacao' as const,
        dirigente: c.dirigente || null,
        dirigente_cargo: c.dirigente_cargo || null,
      })),
    ];
    setLocais(lista);
  };

  const loadItens = async (mid: string) => {
    let query = supabase.from('patrimonio_itens').select('*').eq('ministry_id', mid);
    if (ctx.nivel === 'operador' && ctx.congregacaoId) {
      query = query.eq('congregacao_id', ctx.congregacaoId);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
      showNotif('error', 'Erro ao carregar', error.message, undefined);
      return;
    }
    setItens((data || []) as PatrimonioItem[]);
  };

  const generateNextTombamento = async (mid: string): Promise<string> => {
    const { data } = await supabase
      .from('patrimonio_itens')
      .select('numero_tombamento')
      .eq('ministry_id', mid)
      .not('numero_tombamento', 'is', null);
    let maxNum = 0;
    for (const row of data || []) {
      const m = (row.numero_tombamento as string)?.match(/(\d+)$/);
      if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
    }
    return `PAT-${String(maxNum + 1).padStart(3, '0')}`;
  };

  useEffect(() => {
    if (ctx.loading || bloqueado) return;
    const run = async () => {
      setLoadingData(true);
      const mid = await resolveMinistryId(supabase);
      setMinistryId(mid);
      const config = await fetchConfiguracaoIgrejaFromSupabase(supabase);
      setConfigIgreja(config);
      if (mid) {
        await Promise.all([loadLocais(mid), loadItens(mid)]);
        const nextTomb = await generateNextTombamento(mid);
        setFormData((p) => ({
          ...p,
          numero_tombamento: nextTomb,
          local_id: ctx.nivel === 'operador' && ctx.congregacaoId ? ctx.congregacaoId : p.local_id,
        }));
      }
      setLoadingData(false);
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.loading, bloqueado]);

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
      valor_aquisicao: formData.valor_aquisicao
        ? parseFloat(String(formData.valor_aquisicao).replace(/\./g, '').replace(',', '.'))
        : null,
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
      const itemAnterior = itens.find((i) => i.id === editingId);
      const { data, error } = await supabase
        .from('patrimonio_itens')
        .update(payload)
        .eq('id', editingId)
        .select('*')
        .single();
      if (error) {
        await registrarAcao({
          acao: 'editar',
          modulo: 'patrimonio',
          area: 'inventario',
          tabela_afetada: 'patrimonio_itens',
          registro_id: editingId,
          descricao: `Falha ao atualizar bem patrimonial: ${formData.descricao}`,
          status: 'erro',
          mensagem_erro: error.message,
        });
        showNotif('error', 'Erro', error.message, undefined);
        return;
      }
      await registrarAcao({
        acao: 'editar',
        modulo: 'patrimonio',
        area: 'inventario',
        tabela_afetada: 'patrimonio_itens',
        registro_id: editingId,
        descricao: `Bem patrimonial atualizado: ${data.descricao} (Tombamento: ${data.numero_tombamento || '-'})`,
        dados_anteriores: itemAnterior
          ? {
              descricao: itemAnterior.descricao,
              categoria: itemAnterior.categoria,
              estado_conservacao: itemAnterior.estado_conservacao,
              status: itemAnterior.status,
              numero_tombamento: itemAnterior.numero_tombamento,
            }
          : null,
        dados_novos: {
          descricao: data.descricao,
          categoria: data.categoria,
          estado_conservacao: data.estado_conservacao,
          status: data.status,
          numero_tombamento: data.numero_tombamento,
        },
        status: 'sucesso',
      });
      setItens((prev) => prev.map((i) => (i.id === editingId ? (data as PatrimonioItem) : i)));
      showNotif('success', 'Atualizado', 'Bem atualizado com sucesso.', 3000);
    } else {
      const { data, error } = await supabase
        .from('patrimonio_itens')
        .insert({ ...payload, created_at: new Date().toISOString() })
        .select('*')
        .single();
      if (error) {
        await registrarAcao({
          acao: 'criar',
          modulo: 'patrimonio',
          area: 'inventario',
          tabela_afetada: 'patrimonio_itens',
          descricao: `Falha ao cadastrar bem patrimonial: ${formData.descricao}`,
          status: 'erro',
          mensagem_erro: error.message,
        });
        showNotif('error', 'Erro', error.message, undefined);
        return;
      }
      await registrarAcao({
        acao: 'criar',
        modulo: 'patrimonio',
        area: 'inventario',
        tabela_afetada: 'patrimonio_itens',
        registro_id: data.id,
        descricao: `Novo bem patrimonial cadastrado: ${data.descricao} (Tombamento: ${data.numero_tombamento || '-'})`,
        dados_novos: {
          descricao: data.descricao,
          categoria: data.categoria,
          estado_conservacao: data.estado_conservacao,
          status: data.status,
          numero_tombamento: data.numero_tombamento,
        },
        status: 'sucesso',
      });
      setItens((prev) => [data as PatrimonioItem, ...prev]);
      showNotif('success', 'Cadastrado', 'Bem registrado com sucesso.', 3000);
    }

    const wasNew = !editingId;
    resetForm();
    if (wasNew && ministryId) {
      generateNextTombamento(ministryId).then((t) =>
        setFormData((p) => ({ ...p, numero_tombamento: t }))
      );
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
      valor_aquisicao:
        item.valor_aquisicao != null
          ? (() => {
              const n = Math.round(item.valor_aquisicao! * 100);
              const d = String(n).replace(/\D/g, '');
              const num = parseInt(d, 10) / 100;
              return num.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              });
            })()
          : '',
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
    const itemRemovido = itens.find((i) => i.id === id);
    const { error } = await supabase.from('patrimonio_itens').delete().eq('id', id);
    if (error) {
      await registrarAcao({
        acao: 'deletar',
        modulo: 'patrimonio',
        area: 'inventario',
        tabela_afetada: 'patrimonio_itens',
        registro_id: id,
        descricao: `Falha ao excluir bem patrimonial: ${itemRemovido?.descricao || id}`,
        status: 'erro',
        mensagem_erro: error.message,
      });
      showNotif('error', 'Erro', error.message, undefined);
      return;
    }
    await registrarAcao({
      acao: 'deletar',
      modulo: 'patrimonio',
      area: 'inventario',
      tabela_afetada: 'patrimonio_itens',
      registro_id: id,
      descricao: `Bem removido do patrimônio: ${itemRemovido?.descricao || id} (Tombamento: ${itemRemovido?.numero_tombamento || '-'})`,
      dados_anteriores: itemRemovido
        ? {
            descricao: itemRemovido.descricao,
            categoria: itemRemovido.categoria,
            numero_tombamento: itemRemovido.numero_tombamento,
          }
        : null,
      status: 'sucesso',
    });
    setItens((prev) => prev.filter((i) => i.id !== id));
    showNotif('success', 'Excluído', 'Bem removido do patrimônio.', 3000);
  };

  const getNomeLocal = (item: PatrimonioItem) => {
    if (item.congregacao_id)
      return locais.find((l) => l.id === item.congregacao_id)?.nome || item.local_descricao || '-';
    if (item.campo_id)
      return locais.find((l) => l.id === item.campo_id)?.nome || item.local_descricao || '-';
    return item.local_descricao || '-';
  };

  const handleImprimir = (localId: string, localTipo: 'campo' | 'congregacao') => {
    const local = locais.find((l) => l.id === localId && l.tipo === localTipo);
    if (!local) return;
    const itensFicha = itensFiltrados.filter((i) =>
      localTipo === 'congregacao' ? i.congregacao_id === localId : i.campo_id === localId
    );
    if (itensFicha.length === 0) {
      showNotif(
        'warning',
        'Aviso',
        'Nenhum bem encontrado com os filtros atuais para este local.',
        3000
      );
      return;
    }
    imprimirFichaPatrimonio({ itens: itensFicha, local, configIgreja });
  };

  // Memos de estatísticas
  const totalItens = itens.length;
  const itensAtivos = itens.filter((i) => i.status === 'ativo').length;
  const percentualAtivos = totalItens > 0 ? ((itensAtivos / totalItens) * 100).toFixed(0) : '0';
  const totalValorGeral = itens.reduce((acc, i) => acc + (i.valor_aquisicao || 0), 0);

  const locaisComBensCount = useMemo(() => {
    const set = new Set<string>();
    itens.forEach((i) => {
      if (i.congregacao_id) set.add(i.congregacao_id);
      if (i.campo_id) set.add(i.campo_id);
    });
    return set.size;
  }, [itens]);

  const itensFiltrados = useMemo(
    () =>
      itens.filter((item) => {
        const matchStatus = !filterStatus || item.status === filterStatus;
        const matchCat = !filterCategoria || item.categoria === filterCategoria;
        const matchLocal =
          !filterLocal || item.congregacao_id === filterLocal || item.campo_id === filterLocal;
        const termo = filterSearch.toLowerCase();
        const matchSearch =
          !termo ||
          item.descricao.toLowerCase().includes(termo) ||
          (item.numero_tombamento || '').toLowerCase().includes(termo) ||
          (item.marca_modelo || '').toLowerCase().includes(termo) ||
          (item.responsavel_nome || '').toLowerCase().includes(termo) ||
          getNomeLocal(item).toLowerCase().includes(termo);
        return matchStatus && matchCat && matchLocal && matchSearch;
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }),
    [itens, filterStatus, filterCategoria, filterLocal, filterSearch, locais]
  );

  const totalValorFiltrado = itensFiltrados.reduce(
    (acc, i) => acc + (i.valor_aquisicao || 0),
    0
  );

  if (ctx.loading || loadingData) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#f4f7fa] min-h-screen flex items-center justify-center p-8">
        <div className="flex items-center gap-3 text-slate-500 font-semibold text-sm bg-white px-6 py-4 rounded-2xl shadow-xs border border-slate-200">
          <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          <span>Carregando dados do Patrimônio...</span>
        </div>
      </div>
    );
  }

  if (bloqueado) return null;

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden bg-[#f4f7fa] min-h-screen">
      <NotificationModal
        isOpen={notification.isOpen}
        title={notification.title}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification((p) => ({ ...p, isOpen: false }))}
        autoClose={notification.autoClose}
      />

      <div className="p-4 sm:p-6 lg:p-8 max-w-[96rem] mx-auto w-full">
        {/* ── Header da Página (Padrão Membros) ────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-teal-700 text-white flex items-center justify-center border border-teal-800 shadow-sm flex-shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Patrimônio
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 font-medium mt-0.5">
                Gestão de bens, tombamento, conservação e inventário patrimonial das congregações.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => {
                resetForm();
                if (ministryId) {
                  generateNextTombamento(ministryId).then((t) =>
                    setFormData((p) => ({ ...p, numero_tombamento: t }))
                  );
                }
                setActiveTab('cadastro');
              }}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer text-xs sm:text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Bem</span>
            </button>
          </div>
        </div>

        {/* ── Cards Principais — KPIs Coloridos (Padrão Membros) ──────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Total de Bens (Azul) */}
          <div className="bg-[#ebf5ff] border border-[#d0e6ff] rounded-3xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-all flex items-center justify-between">
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              <div className="w-13 h-13 rounded-2xl bg-white text-[#2563eb] shadow-xs flex items-center justify-center flex-shrink-0 border border-[#dbeafe]">
                <Package className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 block truncate">
                  Total de Bens
                </span>
                <p className="text-3xl font-black text-slate-900 leading-tight mt-0.5">
                  {totalItens}
                </p>
                <p className="text-[11px] font-bold text-teal-700 mt-1 truncate">
                  Itens registrados
                </p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-[#dbeafe] text-[#2563eb] flex items-center justify-center flex-shrink-0 self-start">
              <Tag className="w-4 h-4" />
            </div>
          </div>

          {/* Bens Ativos (Verde) */}
          <div className="bg-[#ecfdf3] border border-[#cff7de] rounded-3xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-all flex items-center justify-between">
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              <div className="w-13 h-13 rounded-2xl bg-white text-[#16a34a] shadow-xs flex items-center justify-center flex-shrink-0 border border-[#dcfce7]">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 block truncate">
                  Bens em Atividade
                </span>
                <p className="text-3xl font-black text-slate-900 leading-tight mt-0.5">
                  {itensAtivos}
                </p>
                <p className="text-[11px] font-semibold text-slate-700 mt-1 truncate">
                  {percentualAtivos}% do inventário
                </p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-[#dcfce7] text-[#16a34a] flex items-center justify-center flex-shrink-0 self-start">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>

          {/* Valor Total Estimado (Âmbar / Laranja) */}
          <div className="bg-[#fff6ea] border border-[#fde4c4] rounded-3xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-all flex items-center justify-between">
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              <div className="w-13 h-13 rounded-2xl bg-white text-[#ea580c] shadow-xs flex items-center justify-center flex-shrink-0 border border-[#ffedd5]">
                <DollarSign className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 block truncate">
                  Valor Estimado
                </span>
                <p className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight mt-0.5 truncate">
                  {formatCurrency(totalValorGeral)}
                </p>
                <p className="text-[11px] font-semibold text-slate-700 mt-1 truncate">
                  Patrimônio total
                </p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-[#ffedd5] text-[#ea580c] flex items-center justify-center flex-shrink-0 self-start">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>

          {/* Locais Atendidos (Roxo / Violeta) */}
          <div className="bg-[#f3f0ff] border border-[#e3dbff] rounded-3xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-all flex items-center justify-between">
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              <div className="w-13 h-13 rounded-2xl bg-white text-[#7c3aed] shadow-xs flex items-center justify-center flex-shrink-0 border border-[#ede9fe]">
                <Landmark className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 block truncate">
                  Locais com Bens
                </span>
                <p className="text-3xl font-black text-slate-900 leading-tight mt-0.5">
                  {locaisComBensCount}
                </p>
                <p className="text-[11px] font-semibold text-slate-700 mt-1 truncate">
                  {locais.length} locais mapeados
                </p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-[#ede9fe] text-[#7c3aed] flex items-center justify-center flex-shrink-0 self-start">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* ── Navegação de Abas (Pills no Padrão Membros) ─────────────── */}
        <div className="flex items-center gap-2.5 mb-6 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('inventario')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'inventario'
                ? 'bg-teal-700 text-white shadow-sm border border-teal-800'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:text-slate-900 shadow-xs'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>Inventário</span>
          </button>

          <button
            onClick={() => setActiveTab('cadastro')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'cadastro'
                ? 'bg-teal-700 text-white shadow-sm border border-teal-800'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:text-slate-900 shadow-xs'
            }`}
          >
            <Pencil className="w-4 h-4" />
            <span>{editingId ? 'Editar Bem' : 'Cadastro de Bem'}</span>
          </button>
        </div>

        {/* ═══════════════ ABA INVENTÁRIO ═══════════════ */}
        {activeTab === 'inventario' && (
          <div className="space-y-6">
            {/* Card de Filtros (Padrão MembrosToolbar) */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
                {/* Busca */}
                <div className="sm:col-span-2 lg:col-span-4">
                  <label className={labelCls}>Buscar bens</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Search className="w-4 h-4" />
                    </div>
                    <input
                      value={filterSearch}
                      onChange={(e) => setFilterSearch(e.target.value)}
                      placeholder="Descrição, tombamento, local..."
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                    />
                  </div>
                </div>

                {/* Filtro Local */}
                <div className="lg:col-span-3">
                  <label className={labelCls}>Local / Congregação</label>
                  <select
                    value={filterLocal}
                    onChange={(e) => setFilterLocal(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Todos os locais</option>
                    {locais.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.nome} ({l.tipo === 'campo' ? 'Campo' : 'Congregação'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filtro Categoria */}
                <div className="lg:col-span-3">
                  <label className={labelCls}>Categoria</label>
                  <select
                    value={filterCategoria}
                    onChange={(e) => setFilterCategoria(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Todas as categorias</option>
                    {CATEGORIAS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filtro Status */}
                <div className="lg:col-span-2">
                  <label className={labelCls}>Status</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Todos os status</option>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Botões de Ação Secundários / Impressões */}
              <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {filterLocal && (() => {
                    const local = locais.find((l) => l.id === filterLocal);
                    if (!local) return null;
                    return (
                      <button
                        onClick={() => handleImprimir(filterLocal, local.tipo)}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100 transition cursor-pointer"
                      >
                        <Printer className="w-4 h-4" />
                        <span>Ficha de Patrimônio — {local.nome}</span>
                      </button>
                    );
                  })()}

                  {itensFiltrados.length > 0 && (
                    <button
                      onClick={() => imprimirEtiquetas(itensFiltrados, locais)}
                      className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition cursor-pointer"
                    >
                      <Printer className="w-4 h-4 text-slate-500" />
                      <span>Imprimir Etiquetas ({itensFiltrados.length})</span>
                    </button>
                  )}
                </div>

                <div className="text-xs font-bold text-slate-500">
                  <span>{itensFiltrados.length}</span>{' '}
                  {itensFiltrados.length === 1 ? 'bem encontrado' : 'bens encontrados'}
                </div>
              </div>
            </div>

            {/* Tabela do Inventário (Padrão MembrosTable) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
              {itensFiltrados.length === 0 ? (
                <div className="p-12 text-center text-slate-400 font-semibold">
                  <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>Nenhum bem patrimonial encontrado com os filtros aplicados.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/80 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Tombamento
                        </th>
                        <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Descrição / Categoria
                        </th>
                        <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Localização
                        </th>
                        <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Responsável
                        </th>
                        <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Estado
                        </th>
                        <th className="px-4 py-3.5 text-right text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Valor
                        </th>
                        <th className="px-4 py-3.5 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3.5 text-right text-xs font-bold text-slate-700 uppercase tracking-wider w-24">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {itensFiltrados.map((item) => {
                        const estadoOpt = ESTADOS.find((e) => e.value === item.estado_conservacao);
                        const statusOpt = STATUS_OPTIONS.find((s) => s.value === item.status);
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/70 transition">
                            <td className="px-4 py-3.5 font-bold text-slate-900 whitespace-nowrap">
                              {item.numero_tombamento || '—'}
                            </td>
                            <td className="px-4 py-3.5">
                              <div
                                className="font-bold text-slate-900 max-w-[220px] truncate"
                                title={item.descricao}
                              >
                                {item.descricao}
                              </div>
                              <div className="text-xs text-slate-500 font-medium">
                                {CATEGORIAS.find((c) => c.value === item.categoria)?.label}
                                {item.marca_modelo && ` · ${item.marca_modelo}`}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-slate-700 font-medium">
                              {getNomeLocal(item)}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="text-xs font-bold text-slate-800">
                                {item.responsavel_nome || '—'}
                              </div>
                              {item.responsavel_cargo && (
                                <div className="text-[11px] text-slate-500 font-medium">
                                  {item.responsavel_cargo}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                  estadoOpt?.color || 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {estadoOpt?.label || item.estado_conservacao}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right font-bold text-emerald-700 whitespace-nowrap">
                              {formatCurrency(item.valor_aquisicao)}
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                  statusOpt?.color || 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {statusOpt?.label || item.status}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  title="Editar"
                                  onClick={() => handleEdit(item)}
                                  className="p-1.5 text-slate-400 hover:text-teal-700 hover:bg-slate-50 rounded-lg transition cursor-pointer"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  title="Excluir"
                                  onClick={() => handleDelete(item.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 bg-slate-50/80">
                        <td
                          colSpan={5}
                          className="px-4 py-3.5 text-xs font-bold text-slate-700 uppercase tracking-wider text-right"
                        >
                          Total Estimado dos Itens Filtrados:
                        </td>
                        <td className="px-4 py-3.5 text-right font-black text-base text-emerald-700 whitespace-nowrap">
                          {formatCurrency(totalValorFiltrado)}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════ ABA CADASTRO ═══════════════ */}
        {activeTab === 'cadastro' && (
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-sm space-y-6">
            {/* Header do Card */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 border border-teal-100/80 flex items-center justify-center font-bold flex-shrink-0">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 tracking-tight">
                    {editingId ? 'Editar Bem Patrimonial' : 'Novo Bem Patrimonial'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {editingId
                      ? 'Atualize as informações do bem selecionado no sistema'
                      : 'Preencha os dados abaixo para registrar um novo item no inventário'}
                  </p>
                </div>
              </div>

              {editingId && (
                <button
                  onClick={resetForm}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancelar Edição</span>
                </button>
              )}
            </div>

            {/* Seção 1: Local / Congregação */}
            <div className="bg-slate-50/50 rounded-2xl p-4 sm:p-5 border border-slate-200/80">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                1. Localização e Responsabilidade
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Congregação / Igreja</label>
                  <select
                    disabled={ctx.nivel === 'operador'}
                    value={formData.local_id}
                    onChange={(e) => setFormData((p) => ({ ...p, local_id: e.target.value }))}
                    className={`${inputCls} disabled:bg-slate-100 disabled:cursor-not-allowed`}
                  >
                    <option value="">Selecione...</option>
                    {locais
                      .filter((l) => l.tipo === 'congregacao')
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Pastor / Dirigente Responsável</label>
                  <input
                    readOnly
                    value={
                      nomeDirigente
                        ? `${nomeDirigente}${cargoDirigente ? ' — ' + cargoDirigente : ''}`
                        : ''
                    }
                    placeholder="Preenchido automaticamente ao selecionar o local"
                    className={`${inputCls} bg-slate-100 text-slate-600 cursor-default`}
                  />
                </div>
              </div>
            </div>

            {/* Seção 2: Dados do Bem */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                2. Especificações do Bem
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Nº de tombamento</label>
                  <input
                    value={formData.numero_tombamento}
                    onChange={(e) =>
                      !editingId &&
                      setFormData((p) => ({ ...p, numero_tombamento: e.target.value }))
                    }
                    readOnly={!!editingId}
                    placeholder="Ex: PAT-001"
                    className={`${inputCls} ${
                      editingId ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''
                    }`}
                  />
                  {editingId && (
                    <p className="text-[11px] text-slate-400 font-medium mt-1">
                      O tombamento não pode ser alterado após o cadastro.
                    </p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className={labelCls}>Descrição do bem *</label>
                  <input
                    value={formData.descricao}
                    onChange={(e) => setFormData((p) => ({ ...p, descricao: e.target.value }))}
                    placeholder="Ex: Mesa de som 16 canais, Projetor Full HD..."
                    className={`${inputCls} ${
                      fieldErrors.descricao ? 'border-rose-400 focus:border-rose-500' : ''
                    }`}
                  />
                  {fieldErrors.descricao && (
                    <p className="text-xs font-bold text-rose-600 mt-1">{fieldErrors.descricao}</p>
                  )}
                </div>

                <div>
                  <label className={labelCls}>Categoria</label>
                  <select
                    value={formData.categoria}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((p) => ({
                        ...p,
                        categoria: val,
                        ...(val === 'imovel'
                          ? { marca_modelo: '', numero_serie: '', cor: '' }
                          : {}),
                      }));
                    }}
                    className={inputCls}
                  >
                    {CATEGORIAS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                {formData.categoria !== 'imovel' && (
                  <div>
                    <label className={labelCls}>Marca / Modelo</label>
                    <input
                      value={formData.marca_modelo}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, marca_modelo: e.target.value }))
                      }
                      placeholder="Ex: Yamaha MG16XU"
                      className={inputCls}
                    />
                  </div>
                )}

                {formData.categoria !== 'imovel' && (
                  <div>
                    <label className={labelCls}>
                      {formData.categoria === 'veiculo' ? 'Placa' : 'Nº de série'}
                    </label>
                    <input
                      value={formData.numero_serie}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, numero_serie: e.target.value }))
                      }
                      placeholder="Nº de série ou chassi"
                      className={inputCls}
                    />
                  </div>
                )}

                {formData.categoria !== 'imovel' && (
                  <div>
                    <label className={labelCls}>Cor</label>
                    <input
                      value={formData.cor}
                      onChange={(e) => setFormData((p) => ({ ...p, cor: e.target.value }))}
                      placeholder="Ex: Preto, Prata, Madeira..."
                      className={inputCls}
                    />
                  </div>
                )}

                <div>
                  <label className={labelCls}>Estado de conservação</label>
                  <select
                    value={formData.estado_conservacao}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, estado_conservacao: e.target.value }))
                    }
                    className={inputCls}
                  >
                    {ESTADOS.map((e) => (
                      <option key={e.value} value={e.value}>
                        {e.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelCls}>Valor de aquisição (R$)</label>
                  <input
                    inputMode="numeric"
                    value={formData.valor_aquisicao}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '');
                      if (!digits) {
                        setFormData((p) => ({ ...p, valor_aquisicao: '' }));
                        return;
                      }
                      const num = parseInt(digits, 10) / 100;
                      setFormData((p) => ({
                        ...p,
                        valor_aquisicao: num.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }),
                      }));
                    }}
                    placeholder="0,00"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Data de aquisição</label>
                  <input
                    type="date"
                    value={formData.data_aquisicao}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, data_aquisicao: e.target.value }))
                    }
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Origem</label>
                  <select
                    value={formData.origem}
                    onChange={(e) => setFormData((p) => ({ ...p, origem: e.target.value }))}
                    className={inputCls}
                  >
                    {ORIGENS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelCls}>Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value }))}
                    className={inputCls}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Campos de baixa */}
            {formData.status === 'baixado' && (
              <div className="bg-rose-50/50 rounded-2xl p-4 sm:p-5 border border-rose-200">
                <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wider mb-3">
                  Registro de Baixa do Bem
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Data da baixa</label>
                    <input
                      type="date"
                      value={formData.data_baixa}
                      onChange={(e) => setFormData((p) => ({ ...p, data_baixa: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Motivo da baixa</label>
                    <input
                      value={formData.motivo_baixa}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, motivo_baixa: e.target.value }))
                      }
                      placeholder="Ex: Danificado sem reparo, doado, etc."
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className={labelCls}>Observações adicionais</label>
              <textarea
                value={formData.observacoes}
                onChange={(e) => setFormData((p) => ({ ...p, observacoes: e.target.value }))}
                placeholder="Detalhes sobre garantia, procedência ou histórico..."
                className={`${inputCls} min-h-[80px]`}
              />
            </div>

            {/* Ações do Formulário */}
            <div className="flex flex-wrap gap-3 justify-end pt-4 border-t border-slate-100">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
              )}
              <button
                type="button"
                onClick={handleSubmit}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-bold shadow-xs transition cursor-pointer flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>{editingId ? 'Atualizar bem' : 'Salvar bem'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
