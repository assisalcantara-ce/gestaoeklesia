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
  Layers,
  MapPin,
  Car,
  Music,
  Tv,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
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
  dados_especificos?: Record<string, any> | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const CATEGORIAS = [
  { value: 'imovel', label: 'Imóveis', desc: 'Prédio, templo, salão, casa pastoral e edificações' },
  { value: 'terreno', label: 'Terrenos', desc: 'Terrenos sem edificação, medidas e localização' },
  { value: 'movel', label: 'Móveis e utensílios', desc: 'Mesas, cadeiras, armários, bancos e mobiliário' },
  { value: 'equipamento', label: 'Equipamentos', desc: 'Computadores, impressoras, projetores e uso geral' },
  { value: 'instrumento', label: 'Instrumentos musicais', desc: 'Teclados, baterias, violões, guitarras, microfones' },
  { value: 'som_imagem', label: 'Equipamentos de som e imagem', desc: 'Mesas de som, caixas acústicas, amplificadores, câmeras' },
  { value: 'veiculo', label: 'Veículos', desc: 'Carros, motos, vans, ônibus e outros veículos' },
  { value: 'outros', label: 'Outros', desc: 'Bens não enquadrados nas categorias anteriores' },
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
  categoria: 'imovel',
  descricao: '',
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

  // Campos dinâmicos específicos
  // Imóveis
  tipo_imovel: '',
  endereco_imovel: '',
  area_construida: '',
  matricula_imovel: '',
  observacoes_imovel: '',

  // Terrenos
  endereco_terreno: '',
  area_terreno: '',
  medidas_frente: '',
  medidas_fundos: '',
  medidas_laterais: '',
  matricula_terreno: '',
  observacoes_terreno: '',

  // Móveis e utensílios
  quantidade_movel: '1',
  material_movel: '',
  localizacao_interna_movel: '',

  // Equipamentos
  quantidade_equipamento: '1',

  // Instrumentos musicais
  tipo_instrumento: '',
  quantidade_instrumento: '1',

  // Som e imagem
  tipo_som_imagem: '',
  quantidade_som_imagem: '1',

  // Veículos
  ano_veiculo: '',
  placa_veiculo: '',
  renavam_veiculo: '',
  km_veiculo: '',

  // Outros
  quantidade_outros: '1',
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

// ─── Impressão de Relatório Patrimonial Oficial por Congregação ───────────────

function imprimirRelatorioPatrimonial(opts: {
  itens: PatrimonioItem[];
  local: LocalOption;
  configIgreja: ConfiguracaoIgreja;
}) {
  const { itens, local, configIgreja } = opts;
  const hoje = new Date().toLocaleDateString('pt-BR');

  const dirigenteNome = local.tipo === 'congregacao'
    ? (local.dirigente?.trim() || '')
    : (local.pastor_nome?.trim() || '');
  const dirigenteCargo = local.tipo === 'congregacao'
    ? (local.dirigente_cargo?.trim() || 'Dirigente Responsável')
    : 'Pastor Responsável';

  const linhasHtml = itens.map((item, i) => {
    const catLabel = CATEGORIAS.find(c => c.value === item.categoria)?.label || 
      (item.categoria === 'eletronico' ? 'Equipamentos de som e imagem' : item.categoria);
    const estadoLabel = ESTADOS.find(e => e.value === item.estado_conservacao)?.label || item.estado_conservacao;
    const statusLabel = STATUS_OPTIONS.find(s => s.value === item.status)?.label || item.status;

    return `
      <tr style="border-bottom:1px solid #e2e8f0;${i % 2 === 0 ? 'background:#f8fafc' : ''}">
        <td style="padding:6px 8px;font-size:10px;text-align:center;font-weight:bold;">${item.numero_tombamento || (i + 1)}</td>
        <td style="padding:6px 8px;font-size:10px;font-weight:600;">
          ${item.descricao}
          ${item.marca_modelo ? `<div style="font-size:9px;color:#64748b;font-weight:normal;">${item.marca_modelo}</div>` : ''}
        </td>
        <td style="padding:6px 8px;font-size:10px;text-align:center;">${catLabel}</td>
        <td style="padding:6px 8px;font-size:10px;text-align:center;">${item.local_descricao || local.nome}</td>
        <td style="padding:6px 8px;font-size:10px;text-align:center;">${estadoLabel}</td>
        <td style="padding:6px 8px;font-size:10px;text-align:right;font-weight:600;">${formatCurrency(item.valor_aquisicao)}</td>
        <td style="padding:6px 8px;font-size:10px;text-align:center;">
          <span style="display:inline-block;padding:1px 6px;border-radius:9999px;font-size:9px;font-weight:bold;text-transform:uppercase;background:#e2e8f0;color:#334155;">
            ${statusLabel}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  const totalValor = itens.reduce((acc, i) => acc + (i.valor_aquisicao || 0), 0);

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório Patrimonial — ${local.nome}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  @page{
    size:A4 portrait;
    margin:14mm 12mm 16mm 12mm;
  }
  body{
    font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    color:#0f172a;
    font-size:11px;
    line-height:1.4;
  }
  .header{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:16px;
    border-bottom:2px solid #0f766e;
    padding-bottom:12px;
    margin-bottom:14px;
  }
  .header-left{display:flex;align-items:center;gap:14px}
  .header img{height:58px;max-width:120px;object-fit:contain}
  .header-text h1{font-size:16px;font-weight:800;color:#0f766e;letter-spacing:-0.3px}
  .header-text p{font-size:10px;color:#475569;margin-top:2px}
  .doc-badge{
    text-align:right;
    background:#f0fdfa;
    border:1px solid #ccfbf1;
    border-radius:8px;
    padding:6px 12px;
  }
  .doc-badge strong{display:block;font-size:11px;color:#0f766e;text-transform:uppercase}
  .doc-badge span{font-size:9px;color:#64748b}
  .meta-grid{
    display:grid;
    grid-template-columns:repeat(4, 1fr);
    gap:8px;
    background:#f8fafc;
    border:1px solid #e2e8f0;
    border-radius:8px;
    padding:8px 12px;
    margin-bottom:14px;
  }
  .meta-item strong{display:block;font-size:9px;text-transform:uppercase;color:#64748b;letter-spacing:0.5px}
  .meta-item span{font-size:11px;font-weight:700;color:#1e293b}
  table{width:100%;border-collapse:collapse;margin-bottom:16px}
  thead{display:table-header-group}
  tr{page-break-inside:avoid}
  thead tr{background:#0f766e;color:#fff}
  thead th{
    padding:7px 8px;
    font-size:9px;
    text-transform:uppercase;
    letter-spacing:.5px;
    text-align:left;
  }
  .total-row{
    font-weight:800;
    background:#f1f5f9;
    border-top:2px solid #cbd5e1;
  }
  .termos-box{
    background:#fafafa;
    border:1px solid #e2e8f0;
    border-radius:8px;
    padding:10px 14px;
    margin-top:14px;
    page-break-inside:avoid;
  }
  .termos-title{font-size:10px;font-weight:800;text-transform:uppercase;color:#0f766e;margin-bottom:4px}
  .termos-texto{font-size:9.5px;color:#475569;line-height:1.45}
  .assinaturas{
    display:flex;
    gap:36px;
    margin-top:24px;
    page-break-inside:avoid;
  }
  .assinatura-box{flex:1;text-align:center}
  .assinatura-linha{border-top:1.5px solid #334155;margin-top:38px}
  .assinatura-nome{font-size:11px;font-weight:800;color:#0f172a;margin-top:4px}
  .assinatura-cargo{font-size:9.5px;color:#64748b;font-weight:600}
  .rodape{
    margin-top:20px;
    text-align:center;
    font-size:9px;
    color:#94a3b8;
    border-top:1px solid #e2e8f0;
    padding-top:8px;
  }
  @media print{
    body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  }
</style></head><body>
  <div class="header">
    <div class="header-left">
      ${configIgreja.logo ? `<img src="${configIgreja.logo}" alt="Logo" />` : ''}
      <div class="header-text">
        <h1>${configIgreja.nome || 'Igreja / Ministério'}</h1>
        <p>${configIgreja.endereco || ''}</p>
        ${configIgreja.cnpj ? `<p>CNPJ: ${configIgreja.cnpj}</p>` : ''}
        ${configIgreja.telefone ? `<p>Contato: ${configIgreja.telefone}</p>` : ''}
      </div>
    </div>
    <div class="doc-badge">
      <strong>Relatório Patrimonial</strong>
      <span>Inventário Oficial</span>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-item">
      <strong>Congregação / Local</strong>
      <span>${local.nome}</span>
    </div>
    <div class="meta-item">
      <strong>Dirigente Responsável</strong>
      <span>${dirigenteNome || 'Não informado'}</span>
    </div>
    <div class="meta-item">
      <strong>Data de Emissão</strong>
      <span>${hoje}</span>
    </div>
    <div class="meta-item">
      <strong>Total de Itens Cadastrados</strong>
      <span>${itens.length} ${itens.length === 1 ? 'bem' : 'bens'}</span>
    </div>
  </div>

  <table>
    <thead><tr>
      <th style="width:70px;text-align:center">Tombamento</th>
      <th>Descrição do Bem</th>
      <th style="width:110px;text-align:center">Categoria</th>
      <th style="width:110px;text-align:center">Localização</th>
      <th style="width:75px;text-align:center">Estado</th>
      <th style="width:85px;text-align:right">Valor Estimado</th>
      <th style="width:70px;text-align:center">Status</th>
    </tr></thead>
    <tbody>
      ${linhasHtml || '<tr><td colspan="7" style="padding:16px;text-align:center;color:#64748b;">Nenhum bem patrimonial cadastrado para este local.</td></tr>'}
      <tr class="total-row">
        <td colspan="5" style="padding:8px;font-size:10px;text-align:right;text-transform:uppercase;">Valor Total Estimado do Patrimônio:</td>
        <td style="padding:8px;font-size:11px;text-align:right;color:#0f766e;">${formatCurrency(totalValor)}</td>
        <td></td>
      </tr>
    </tbody>
  </table>

  <div class="termos-box">
    <div class="termos-title">Declaração e Termo de Responsabilidade</div>
    <p class="termos-texto">
      Declaramos para os devidos fins que a relação acima reflete com exatidão os bens móveis e imóveis tombados e sob guarda e responsabilidade da referida congregação, cabendo aos responsáveis zelar pela sua conservação, proteção e uso adequado de acordo com as normas estatutárias do ministério.
    </p>
  </div>

  <div class="assinaturas">
    <div class="assinatura-box">
      <div class="assinatura-linha"></div>
      <div class="assinatura-nome">${dirigenteNome || 'Dirigente Responsável'}</div>
      <div class="assinatura-cargo">${dirigenteCargo}</div>
    </div>
    <div class="assinatura-box">
      <div class="assinatura-linha"></div>
      <div class="assinatura-nome">Secretaria Geral</div>
      <div class="assinatura-cargo">Secretário(a) Geral / Administração do Patrimônio</div>
    </div>
  </div>

  <div class="rodape">
    Documento emitido eletronicamente em ${hoje} · ${configIgreja.nome || 'Gestão Eklésia'} · Sistema Integrado de Gestão Eclesiástica
  </div>
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

  // Estado para expansão sanfonada e paginação individual por congregação
  const [expandedLocais, setExpandedLocais] = useState<Record<string, boolean>>({});
  const [pagesLocais, setPagesLocais] = useState<Record<string, number>>({});

  const toggleExpandLocal = (localKey: string) => {
    setExpandedLocais((prev) => {
      const willOpen = !prev[localKey];
      if (willOpen) {
        // Ao expandir pela primeira vez ou reabrir, inicia na página 1
        setPagesLocais((p) => ({ ...p, [localKey]: 1 }));
      }
      return { ...prev, [localKey]: willOpen };
    });
  };

  const changePageLocal = (localKey: string, newPage: number) => {
    setPagesLocais((prev) => ({ ...prev, [localKey]: newPage }));
  };

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

  // ─── Helpers de Limpeza e Migração de Campos Específicos ────────────────────
  const clearSpecificFieldsForCategory = (cat: string) => {
    return {
      // Imóveis
      ...(cat !== 'imovel' ? {
        tipo_imovel: '',
        endereco_imovel: '',
        area_construida: '',
        matricula_imovel: '',
        observacoes_imovel: '',
      } : {}),

      // Terrenos
      ...(cat !== 'terreno' ? {
        endereco_terreno: '',
        area_terreno: '',
        medidas_frente: '',
        medidas_fundos: '',
        medidas_laterais: '',
        matricula_terreno: '',
        observacoes_terreno: '',
      } : {}),

      // Móveis e utensílios
      ...(cat !== 'movel' ? {
        quantidade_movel: '1',
        material_movel: '',
        localizacao_interna_movel: '',
      } : {}),

      // Equipamentos
      ...(cat !== 'equipamento' ? {
        quantidade_equipamento: '1',
      } : {}),

      // Instrumentos musicais
      ...(cat !== 'instrumento' ? {
        tipo_instrumento: '',
        quantidade_instrumento: '1',
      } : {}),

      // Som e imagem
      ...(cat !== 'som_imagem' ? {
        tipo_som_imagem: '',
        quantidade_som_imagem: '1',
      } : {}),

      // Veículos
      ...(cat !== 'veiculo' ? {
        ano_veiculo: '',
        placa_veiculo: '',
        renavam_veiculo: '',
        km_veiculo: '',
      } : {}),

      // Outros
      ...(cat !== 'outros' ? {
        quantidade_outros: '1',
      } : {}),

      // Campos genéricos padrão
      ...(cat === 'imovel' || cat === 'terreno' ? {
        marca_modelo: '',
        numero_serie: '',
        cor: '',
      } : {}),
    };
  };

  const handleSubmit = async () => {
    if (!ministryId || !validate()) return;

    // Constrói os dados específicos ativos para a categoria selecionada
    let dadosEspecificosAtivos: Record<string, any> = {};
    if (formData.categoria === 'imovel') {
      dadosEspecificosAtivos = {
        tipo_imovel: formData.tipo_imovel.trim() || null,
        endereco: formData.endereco_imovel.trim() || null,
        area_construida_m2: formData.area_construida ? Number(formData.area_construida) || formData.area_construida : null,
        numero_registro_matricula: formData.matricula_imovel.trim() || null,
        observacoes_imovel: formData.observacoes_imovel.trim() || null,
      };
    } else if (formData.categoria === 'terreno') {
      dadosEspecificosAtivos = {
        endereco_localizacao: formData.endereco_terreno.trim() || null,
        area_total_m2: formData.area_terreno ? Number(formData.area_terreno) || formData.area_terreno : null,
        medidas_frente: formData.medidas_frente.trim() || null,
        medidas_fundos: formData.medidas_fundos.trim() || null,
        medidas_laterais: formData.medidas_laterais.trim() || null,
        matricula: formData.matricula_terreno.trim() || null,
        observacoes_terreno: formData.observacoes_terreno.trim() || null,
      };
    } else if (formData.categoria === 'movel') {
      dadosEspecificosAtivos = {
        quantidade: formData.quantidade_movel ? parseInt(formData.quantidade_movel, 10) || 1 : 1,
        material: formData.material_movel.trim() || null,
        localizacao_interna: formData.localizacao_interna_movel.trim() || null,
        estado_conservacao: formData.estado_conservacao,
      };
    } else if (formData.categoria === 'equipamento') {
      dadosEspecificosAtivos = {
        quantidade: formData.quantidade_equipamento ? parseInt(formData.quantidade_equipamento, 10) || 1 : 1,
        marca: formData.marca_modelo.trim() || null,
        modelo: formData.marca_modelo.trim() || null,
        numero_serie: formData.numero_serie.trim() || null,
        estado_conservacao: formData.estado_conservacao,
      };
    } else if (formData.categoria === 'instrumento') {
      dadosEspecificosAtivos = {
        instrumento: formData.tipo_instrumento.trim() || null,
        quantidade: formData.quantidade_instrumento ? parseInt(formData.quantidade_instrumento, 10) || 1 : 1,
        marca: formData.marca_modelo.trim() || null,
        modelo: formData.marca_modelo.trim() || null,
        numero_serie: formData.numero_serie.trim() || null,
        estado_conservacao: formData.estado_conservacao,
      };
    } else if (formData.categoria === 'som_imagem') {
      dadosEspecificosAtivos = {
        tipo_equipamento: formData.tipo_som_imagem.trim() || null,
        quantidade: formData.quantidade_som_imagem ? parseInt(formData.quantidade_som_imagem, 10) || 1 : 1,
        marca: formData.marca_modelo.trim() || null,
        modelo: formData.marca_modelo.trim() || null,
        numero_serie: formData.numero_serie.trim() || null,
        estado_conservacao: formData.estado_conservacao,
      };
    } else if (formData.categoria === 'veiculo') {
      dadosEspecificosAtivos = {
        marca_modelo: formData.marca_modelo.trim() || null,
        ano: formData.ano_veiculo ? parseInt(formData.ano_veiculo, 10) || null : null,
        placa: formData.placa_veiculo.trim() || formData.numero_serie.trim() || null,
        renavam: formData.renavam_veiculo.trim() || null,
        quilometragem: formData.km_veiculo ? Number(formData.km_veiculo) || null : null,
      };
    } else if (formData.categoria === 'outros') {
      dadosEspecificosAtivos = {
        quantidade: formData.quantidade_outros ? parseInt(formData.quantidade_outros, 10) || 1 : 1,
        estado_conservacao: formData.estado_conservacao,
      };
    }

    // Marca/modelo e número de série ajustados por categoria
    let finalMarcaModelo = formData.marca_modelo.trim() || null;
    let finalNumeroSerie = formData.numero_serie.trim() || null;

    if (formData.categoria === 'veiculo') {
      finalNumeroSerie = formData.placa_veiculo.trim() || formData.numero_serie.trim() || null;
    } else if (formData.categoria === 'imovel') {
      finalMarcaModelo = formData.tipo_imovel.trim() || null;
      finalNumeroSerie = formData.matricula_imovel.trim() || null;
    } else if (formData.categoria === 'terreno') {
      finalMarcaModelo = null;
      finalNumeroSerie = formData.matricula_terreno.trim() || null;
    }

    const payload: any = {
      ministry_id: ministryId,
      congregacao_id: localSelecionado?.tipo === 'congregacao' ? localSelecionado.id : null,
      campo_id: localSelecionado?.tipo === 'campo' ? localSelecionado.id : null,
      local_descricao: !localSelecionado ? formData.local_descricao.trim() || null : null,
      numero_tombamento: formData.numero_tombamento.trim() || null,
      descricao: formData.descricao.trim(),
      categoria: formData.categoria,
      marca_modelo: finalMarcaModelo,
      numero_serie: finalNumeroSerie,
      cor: ['imovel', 'terreno'].includes(formData.categoria) ? null : formData.cor.trim() || null,
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
      dados_especificos: dadosEspecificosAtivos,
      updated_at: new Date().toISOString(),
    };

    let data: any = null;
    let error: any = null;
    let fallbackUsed = false;

    if (editingId) {
      const itemAnterior = itens.find((i) => i.id === editingId);
      const res = await supabase
        .from('patrimonio_itens')
        .update(payload)
        .eq('id', editingId)
        .select('*')
        .single();
      data = res.data;
      error = res.error;

      // Fallback gracioso caso a migration de dados_especificos ainda não tenha sido aplicada no banco
      if (error && error.message && error.message.includes('dados_especificos')) {
        const { dados_especificos: _, ...fallbackPayload } = payload;
        const retryRes = await supabase
          .from('patrimonio_itens')
          .update(fallbackPayload)
          .eq('id', editingId)
          .select('*')
          .single();
        data = retryRes.data;
        error = retryRes.error;
        if (!error) fallbackUsed = true;
      }

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
      if (fallbackUsed) {
        showNotif(
          'warning',
          'Atualizado com ressalva',
          'Bem atualizado com sucesso. Para salvar os campos específicos da categoria, execute a migração pendente no Supabase.',
          7000
        );
      } else {
        showNotif('success', 'Atualizado', 'Bem atualizado com sucesso.', 3000);
      }
    } else {
      const res = await supabase
        .from('patrimonio_itens')
        .insert({ ...payload, created_at: new Date().toISOString() })
        .select('*')
        .single();
      data = res.data;
      error = res.error;

      // Fallback gracioso caso a migration de dados_especificos ainda não tenha sido aplicada no banco
      if (error && error.message && error.message.includes('dados_especificos')) {
        const { dados_especificos: _, ...fallbackPayload } = payload;
        const retryRes = await supabase
          .from('patrimonio_itens')
          .insert({ ...fallbackPayload, created_at: new Date().toISOString() })
          .select('*')
          .single();
        data = retryRes.data;
        error = retryRes.error;
        if (!error) fallbackUsed = true;
      }

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
      if (fallbackUsed) {
        showNotif(
          'warning',
          'Cadastrado com ressalva',
          'Bem registrado com sucesso. Para salvar os campos específicos da categoria, execute a migração pendente no Supabase.',
          7000
        );
      } else {
        showNotif('success', 'Cadastrado', 'Bem registrado com sucesso.', 3000);
      }
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
    const esp = item.dados_especificos || {};

    // Normaliza categoria caso venha de 'eletronico' legado
    const catNormalizada = item.categoria === 'eletronico' ? 'som_imagem' : item.categoria;

    setFormData({
      local_id: item.congregacao_id || item.campo_id || '',
      local_descricao: item.local_descricao || '',
      numero_tombamento: item.numero_tombamento || '',
      categoria: catNormalizada || 'imovel',
      descricao: item.descricao,
      marca_modelo: item.marca_modelo || esp.marca || esp.marca_modelo || '',
      numero_serie: item.numero_serie || esp.numero_serie || '',
      cor: item.cor || '',
      estado_conservacao: item.estado_conservacao || 'bom',
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

      // Imóveis
      tipo_imovel: esp.tipo_imovel || '',
      endereco_imovel: esp.endereco || '',
      area_construida: esp.area_construida_m2 ? String(esp.area_construida_m2) : '',
      matricula_imovel: esp.numero_registro_matricula || item.numero_serie || '',
      observacoes_imovel: esp.observacoes_imovel || '',

      // Terrenos
      endereco_terreno: esp.endereco_localizacao || '',
      area_terreno: esp.area_total_m2 ? String(esp.area_total_m2) : '',
      medidas_frente: esp.medidas_frente || '',
      medidas_fundos: esp.medidas_fundos || '',
      medidas_laterais: esp.medidas_laterais || '',
      matricula_terreno: esp.matricula || item.numero_serie || '',
      observacoes_terreno: esp.observacoes_terreno || '',

      // Móveis e utensílios
      quantidade_movel: esp.quantidade ? String(esp.quantidade) : '1',
      material_movel: esp.material || '',
      localizacao_interna_movel: esp.localizacao_interna || '',

      // Equipamentos
      quantidade_equipamento: esp.quantidade ? String(esp.quantidade) : '1',

      // Instrumentos musicais
      tipo_instrumento: esp.instrumento || '',
      quantidade_instrumento: esp.quantidade ? String(esp.quantidade) : '1',

      // Som e imagem
      tipo_som_imagem: esp.tipo_equipamento || '',
      quantidade_som_imagem: esp.quantidade ? String(esp.quantidade) : '1',

      // Veículos
      ano_veiculo: esp.ano ? String(esp.ano) : '',
      placa_veiculo: esp.placa || item.numero_serie || '',
      renavam_veiculo: esp.renavam || '',
      km_veiculo: esp.quilometragem ? String(esp.quilometragem) : '',

      // Outros
      quantidade_outros: esp.quantidade ? String(esp.quantidade) : '1',
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
    imprimirRelatorioPatrimonial({ itens: itensFicha, local, configIgreja });
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
        const matchCat =
          !filterCategoria ||
          item.categoria === filterCategoria ||
          (filterCategoria === 'som_imagem' && item.categoria === 'eletronico');
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

  // ─── Agrupamento por Congregação / Local para a Lista Sanfonada ───────────────
  const gruposCongregacoes = useMemo(() => {
    // 1. Cria um mapa para cada local cadastrado
    const map = new Map<string, {
      id: string;
      localKey: string;
      nome: string;
      tipo: 'congregacao' | 'campo';
      dirigenteNome: string;
      dirigenteCargo: string;
      localObj: LocalOption;
      itensFiltrados: PatrimonioItem[];
      totalFiltrado: number;
      valorTotalFiltrado: number;
      totalInventarioGeral: number;
      valorInventarioGeral: number;
    }>();

    // Registra locais conhecidos
    locais.forEach((loc) => {
      const key = `${loc.tipo}_${loc.id}`;
      const dirigente = loc.tipo === 'congregacao' ? (loc.dirigente || '') : (loc.pastor_nome || '');
      const cargo = loc.tipo === 'congregacao' ? (loc.dirigente_cargo || 'Dirigente') : 'Pastor';

      // Totais gerais do inventário desse local (sem filtros de busca/categoria/status)
      const itensGerais = itens.filter((i) =>
        loc.tipo === 'congregacao' ? i.congregacao_id === loc.id : i.campo_id === loc.id
      );
      const valorGeral = itensGerais.reduce((acc, i) => acc + (i.valor_aquisicao || 0), 0);

      map.set(key, {
        id: loc.id,
        localKey: key,
        nome: loc.nome,
        tipo: loc.tipo,
        dirigenteNome: dirigente,
        dirigenteCargo: cargo,
        localObj: loc,
        itensFiltrados: [],
        totalFiltrado: 0,
        valorTotalFiltrado: 0,
        totalInventarioGeral: itensGerais.length,
        valorInventarioGeral: valorGeral,
      });
    });

    // 2. Agrupa os itens filtrados dentro do respectivo local
    const semLocalFiltrados: PatrimonioItem[] = [];

    itensFiltrados.forEach((item) => {
      let key: string | null = null;
      if (item.congregacao_id) {
        key = `congregacao_${item.congregacao_id}`;
      } else if (item.campo_id) {
        key = `campo_${item.campo_id}`;
      }

      if (key && map.has(key)) {
        const grp = map.get(key)!;
        grp.itensFiltrados.push(item);
        grp.totalFiltrado += 1;
        grp.valorTotalFiltrado += (item.valor_aquisicao || 0);
      } else {
        semLocalFiltrados.push(item);
      }
    });

    // Cria o grupo especial "Outros / Sem Local Definido" se houver itens ou se estiver cadastrado
    const itensSemLocalGerais = itens.filter((i) => !i.congregacao_id && !i.campo_id);
    if (itensSemLocalGerais.length > 0) {
      const valorGeralSemLocal = itensSemLocalGerais.reduce((acc, i) => acc + (i.valor_aquisicao || 0), 0);
      const valorFiltradoSemLocal = semLocalFiltrados.reduce((acc, i) => acc + (i.valor_aquisicao || 0), 0);
      map.set('sem_local', {
        id: 'sem_local',
        localKey: 'sem_local',
        nome: 'Sede / Sem Local Definido',
        tipo: 'congregacao',
        dirigenteNome: '',
        dirigenteCargo: 'Administração',
        localObj: {
          id: 'sem_local',
          nome: 'Sede / Sem Local Definido',
          tipo: 'congregacao',
          dirigente: null,
          dirigente_cargo: null,
          pastor_nome: null,
        },
        itensFiltrados: semLocalFiltrados,
        totalFiltrado: semLocalFiltrados.length,
        valorTotalFiltrado: valorFiltradoSemLocal,
        totalInventarioGeral: itensSemLocalGerais.length,
        valorInventarioGeral: valorGeralSemLocal,
      });
    }

    // 3. Converte para array
    const lista = Array.from(map.values());

    // Se houver filtros ativos (busca, categoria, status, local), exibe apenas congregações que possuem bens filtrados
    const temFiltroAtivo = Boolean(filterSearch || filterCategoria || (filterStatus && filterStatus !== 'ativo') || filterLocal);
    if (temFiltroAtivo) {
      return lista.filter((g) => g.totalFiltrado > 0);
    }

    // Sem filtros, ordena primeiro as que têm bens cadastrados, depois por ordem alfabética
    return lista.sort((a, b) => {
      if (a.totalInventarioGeral > 0 && b.totalInventarioGeral === 0) return -1;
      if (a.totalInventarioGeral === 0 && b.totalInventarioGeral > 0) return 1;
      return a.nome.localeCompare(b.nome);
    });
  }, [locais, itens, itensFiltrados, filterSearch, filterCategoria, filterStatus, filterLocal]);

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
                        <span>Relatório Patrimonial — {local.nome}</span>
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

            {/* Listagem Agrupada por Congregação (Acordeão Sanfonado com Paginação Individual de 10 por Página) */}
            {gruposCongregacoes.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-12 text-center text-slate-400 font-semibold">
                <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-slate-600 font-bold mb-1">Nenhum bem patrimonial encontrado com os filtros aplicados.</p>
                <p className="text-xs text-slate-400">Tente ajustar a busca, congregação, categoria ou status selecionados.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {gruposCongregacoes.map((grupo) => {
                  const isExpanded = !!expandedLocais[grupo.localKey];
                  const totalItensGrupo = grupo.itensFiltrados.length;
                  const ITENS_POR_PAGINA = 10;
                  const totalPaginas = Math.max(1, Math.ceil(totalItensGrupo / ITENS_POR_PAGINA));
                  const paginaAtual = Math.min(Math.max(1, pagesLocais[grupo.localKey] || 1), totalPaginas);
                  const startIndex = (paginaAtual - 1) * ITENS_POR_PAGINA;
                  const endIndex = Math.min(startIndex + ITENS_POR_PAGINA, totalItensGrupo);
                  const itensPaginados = grupo.itensFiltrados.slice(startIndex, endIndex);

                  return (
                    <div
                      key={grupo.localKey}
                      className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden transition-all duration-200 hover:border-slate-300"
                    >
                      {/* Cabeçalho do Painel Sanfonado */}
                      <div
                        onClick={() => toggleExpandLocal(grupo.localKey)}
                        className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none bg-slate-50/50 hover:bg-slate-50/90 transition border-b border-transparent data-[expanded=true]:border-slate-200"
                        data-expanded={isExpanded}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <button
                            type="button"
                            className="w-9 h-9 rounded-xl bg-white border border-slate-200/90 text-slate-600 flex items-center justify-center flex-shrink-0 shadow-xs hover:text-teal-700 hover:border-teal-300 transition"
                            aria-label={isExpanded ? 'Recolher' : 'Expandir'}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-5 h-5 text-teal-700" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-slate-400" />
                            )}
                          </button>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-base font-bold text-slate-900 truncate">
                                {grupo.nome}
                              </h4>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200/60">
                                {grupo.tipo === 'campo' ? 'Campo' : grupo.localKey === 'sem_local' ? 'Geral' : 'Congregação'}
                              </span>
                            </div>
                            {grupo.dirigenteNome ? (
                              <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                                <span className="font-semibold text-slate-700">{grupo.dirigenteCargo || 'Responsável'}:</span>{' '}
                                {grupo.dirigenteNome}
                              </p>
                            ) : (
                              <p className="text-xs text-slate-400 font-medium truncate mt-0.5">
                                Inventário oficial do local
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Indicadores do cabeçalho e Botão de Ação */}
                        <div className="flex items-center gap-3 sm:gap-4 flex-wrap justify-between sm:justify-end">
                          <div className="flex items-center gap-3">
                            {/* Badge de Quantidade */}
                            <div className="text-right">
                              <span className="text-[11px] font-semibold text-slate-500 block uppercase tracking-wider">
                                Bens
                              </span>
                              <span className="text-sm font-bold text-slate-900">
                                {grupo.totalFiltrado}{' '}
                                <span className="text-xs text-slate-500 font-normal">
                                  {grupo.totalFiltrado === 1 ? 'item' : 'itens'}
                                </span>
                              </span>
                            </div>

                            <div className="h-7 w-px bg-slate-200" />

                            {/* Badge de Valor Estimado */}
                            <div className="text-right">
                              <span className="text-[11px] font-semibold text-slate-500 block uppercase tracking-wider">
                                Valor Estimado
                              </span>
                              <span className="text-sm font-black text-emerald-700 whitespace-nowrap">
                                {formatCurrency(grupo.valorTotalFiltrado)}
                              </span>
                            </div>
                          </div>

                          {/* Ação: Imprimir Relatório Patrimonial Oficial */}
                          <button
                            type="button"
                            title="Imprimir Relatório Patrimonial Oficial desta Congregação"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Relação completa de todos os bens da congregação (não cortada pela paginação de 10)
                              const bensCongregacao = grupo.id === 'sem_local'
                                ? itens.filter((i) => !i.congregacao_id && !i.campo_id)
                                : itens.filter((i) =>
                                    grupo.tipo === 'congregacao'
                                      ? i.congregacao_id === grupo.id
                                      : i.campo_id === grupo.id
                                  );

                              if (bensCongregacao.length === 0) {
                                showNotif(
                                  'warning',
                                  'Aviso',
                                  `Não há bens cadastrados para ${grupo.nome}.`,
                                  3000
                                );
                                return;
                              }
                              imprimirRelatorioPatrimonial({
                                itens: bensCongregacao,
                                local: grupo.localObj,
                                configIgreja,
                              });
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal-100 hover:border-teal-300 transition shadow-2xs cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5 text-teal-600" />
                            <span className="hidden sm:inline">Relatório Oficial</span>
                            <span className="sm:hidden">Relatório</span>
                          </button>
                        </div>
                      </div>

                      {/* Tabela de Bens e Paginação Individual quando Expandido */}
                      {isExpanded && (
                        <div className="border-t border-slate-200">
                          {totalItensGrupo === 0 ? (
                            <div className="p-8 text-center text-slate-400 font-semibold bg-white">
                              <Package className="w-9 h-9 mx-auto mb-2 text-slate-300" />
                              <p className="text-sm">Nenhum bem patrimonial encontrado para esta congregação com os filtros aplicados.</p>
                            </div>
                          ) : (
                            <>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead className="bg-slate-50/80 border-b border-slate-200">
                                    <tr>
                                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider w-28">
                                        Tombamento
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider min-w-[220px]">
                                        Descrição / Categoria
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                                        Localização
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                                        Responsável
                                      </th>
                                      <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">
                                        Estado
                                      </th>
                                      <th className="px-4 py-3 text-right text-xs font-bold text-slate-700 uppercase tracking-wider">
                                        Valor
                                      </th>
                                      <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">
                                        Status
                                      </th>
                                      <th className="px-4 py-3 text-right text-xs font-bold text-slate-700 uppercase tracking-wider w-24">
                                        Ações
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 bg-white">
                                    {itensPaginados.map((item) => {
                                      const estadoOpt = ESTADOS.find((e) => e.value === item.estado_conservacao);
                                      const statusOpt = STATUS_OPTIONS.find((s) => s.value === item.status);
                                      return (
                                        <tr key={item.id} className="hover:bg-slate-50/70 transition">
                                          <td className="px-4 py-3.5 font-bold text-slate-900 whitespace-nowrap">
                                            {item.numero_tombamento || '—'}
                                          </td>
                                          <td className="px-4 py-3.5">
                                            <div
                                              className="font-bold text-slate-900 max-w-[260px] truncate"
                                              title={item.descricao}
                                            >
                                              {item.descricao}
                                            </div>
                                            <div className="text-xs text-slate-500 font-medium">
                                              {CATEGORIAS.find((c) => c.value === item.categoria)?.label || (item.categoria === 'eletronico' ? 'Equipamentos de som e imagem' : item.categoria)}
                                              {item.marca_modelo && ` · ${item.marca_modelo}`}
                                              {item.categoria === 'veiculo' && item.numero_serie && ` · Placa: ${item.numero_serie}`}
                                              {item.categoria === 'imovel' && (item.dados_especificos as any)?.area_construida_m2 && ` · ${(item.dados_especificos as any).area_construida_m2}m²`}
                                              {item.categoria === 'terreno' && (item.dados_especificos as any)?.area_total_m2 && ` · ${(item.dados_especificos as any).area_total_m2}m²`}
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
                                          <td className="px-4 py-3.5 text-center">
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
                                                type="button"
                                                title="Editar"
                                                onClick={() => handleEdit(item)}
                                                className="p-1.5 text-slate-400 hover:text-teal-700 hover:bg-slate-50 rounded-lg transition cursor-pointer"
                                              >
                                                <Pencil className="w-4 h-4" />
                                              </button>
                                              <button
                                                type="button"
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
                                </table>
                              </div>

                              {/* Barra de Paginação Individual por Congregação (máx 10 por página) */}
                              <div className="p-3.5 sm:px-5 sm:py-3.5 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                                <div className="font-semibold text-slate-600">
                                  Mostrando <span className="font-bold text-slate-900">{startIndex + 1}–{endIndex}</span> de{' '}
                                  <span className="font-bold text-slate-900">{totalItensGrupo}</span> {totalItensGrupo === 1 ? 'bem' : 'bens'}
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-slate-500 mr-1">
                                    Página <strong className="text-slate-800">{paginaAtual}</strong> de{' '}
                                    <strong className="text-slate-800">{totalPaginas}</strong>
                                  </span>

                                  <button
                                    type="button"
                                    disabled={paginaAtual <= 1}
                                    onClick={() => changePageLocal(grupo.localKey, paginaAtual - 1)}
                                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
                                  >
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                    <span>Anterior</span>
                                  </button>

                                  <button
                                    type="button"
                                    disabled={paginaAtual >= totalPaginas}
                                    onClick={() => changePageLocal(grupo.localKey, paginaAtual + 1)}
                                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
                                  >
                                    <span>Próxima</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Card Consolidado de Rodapé com Totais Filtrados */}
                {itensFiltrados.length > 0 && (
                  <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-xs font-semibold text-slate-500">
                      Total do inventário filtrado:{' '}
                      <strong className="text-slate-900 font-bold">
                        {itensFiltrados.length} {itensFiltrados.length === 1 ? 'bem' : 'bens'}
                      </strong>{' '}
                      em <strong className="text-slate-900 font-bold">{gruposCongregacoes.length}</strong> {gruposCongregacoes.length === 1 ? 'congregação / local' : 'congregações / locais'}
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Valor Total Estimado:
                      </span>
                      <span className="text-lg font-black text-emerald-700">
                        {formatCurrency(totalValorFiltrado)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
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

            {/* Seção 2: Especificações do Bem com Campos Dinâmicos por Categoria */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                2. Especificações do Bem
              </h4>

              {/* Grid Principal: Tombamento e Categoria */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
                  <label className={labelCls}>Categoria do Bem *</label>
                  <select
                    value={formData.categoria}
                    onChange={(e) => {
                      const novaCat = e.target.value;
                      setFormData((p) => ({
                        ...p,
                        categoria: novaCat,
                        ...clearSpecificFieldsForCategory(novaCat),
                      }));
                    }}
                    className={inputCls}
                  >
                    {CATEGORIAS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label} {c.desc ? `— ${c.desc}` : ''}
                      </option>
                    ))}
                  </select>
                  {(() => {
                    const catInfo = CATEGORIAS.find((c) => c.value === formData.categoria);
                    return catInfo ? (
                      <p className="text-[11px] text-teal-700 font-semibold mt-1">
                        {catInfo.desc}
                      </p>
                    ) : null;
                  })()}
                </div>
              </div>

              {/* Descrição do Bem (posicionada logo após a Categoria) */}
              <div className="mb-4">
                <label className={labelCls}>Descrição do bem *</label>
                <input
                  value={formData.descricao}
                  onChange={(e) => setFormData((p) => ({ ...p, descricao: e.target.value }))}
                  placeholder={
                    formData.categoria === 'imovel'
                      ? 'Ex: Templo Sede Central, Salão Anexo, Casa Pastoral...'
                      : formData.categoria === 'terreno'
                      ? 'Ex: Loteamento Boa Vista - Terreno anexo para estacionamento...'
                      : formData.categoria === 'movel'
                      ? 'Ex: Mesa de reunião em madeira maciça, Conjunto de 20 bancos...'
                      : formData.categoria === 'instrumento'
                      ? 'Ex: Teclado Yamaha Motif XF8, Bateria acústica Nagano...'
                      : formData.categoria === 'som_imagem'
                      ? 'Ex: Mesa de Som Digital 32 Canais, Projetor Laser 5000 lumens...'
                      : formData.categoria === 'veiculo'
                      ? 'Ex: Van Renault Master 16 Lugares, Fiat Ducato...'
                      : 'Ex: Computador All-in-One, Impressora Laser...'
                  }
                  className={`${inputCls} ${
                    fieldErrors.descricao ? 'border-rose-400 focus:border-rose-500' : ''
                  }`}
                />
                {fieldErrors.descricao && (
                  <p className="text-xs font-bold text-rose-600 mt-1">{fieldErrors.descricao}</p>
                )}
              </div>

              {/* ─────────────────────────────────────────────────────────── */}
              {/* BLOCOS DINÂMICOS CONFORME A CATEGORIA SELECIONADA          */}
              {/* ─────────────────────────────────────────────────────────── */}

              {/* 1. IMÓVEIS: tipo, endereço, área construída m², matrícula, observações */}
              {formData.categoria === 'imovel' && (
                <div className="p-4 sm:p-5 bg-teal-50/50 border border-teal-200/80 rounded-2xl mb-4 space-y-4">
                  <div className="flex items-center gap-2 text-teal-900 font-bold text-xs uppercase tracking-wider">
                    <Building2 className="w-4 h-4 text-teal-700" />
                    <span>Campos Específicos para Imóvel</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={labelCls}>Tipo de Imóvel</label>
                      <input
                        value={formData.tipo_imovel}
                        onChange={(e) => setFormData((p) => ({ ...p, tipo_imovel: e.target.value }))}
                        placeholder="Ex: Templo, Salão, Casa Pastoral, Prédio Comercial"
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Área Construída (m²)</label>
                      <input
                        type="number"
                        step="any"
                        value={formData.area_construida}
                        onChange={(e) => setFormData((p) => ({ ...p, area_construida: e.target.value }))}
                        placeholder="Ex: 350"
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Nº Registro / Matrícula</label>
                      <input
                        value={formData.matricula_imovel}
                        onChange={(e) => setFormData((p) => ({ ...p, matricula_imovel: e.target.value }))}
                        placeholder="Ex: Matrícula nº 12.345 do 1º Ofício"
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Endereço do Imóvel</label>
                    <input
                      value={formData.endereco_imovel}
                      onChange={(e) => setFormData((p) => ({ ...p, endereco_imovel: e.target.value }))}
                      placeholder="Rua, número, bairro, cidade e ponto de referência"
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Observações do Imóvel</label>
                    <textarea
                      value={formData.observacoes_imovel}
                      onChange={(e) => setFormData((p) => ({ ...p, observacoes_imovel: e.target.value }))}
                      placeholder="Detalhes sobre habite-se, IPTU, escritura pública ou benfeitorias..."
                      className={`${inputCls} min-h-[60px]`}
                    />
                  </div>
                </div>
              )}

              {/* 2. TERRENOS: endereço/localização, área total m², medidas (frente, fundos, laterais), matrícula, observações */}
              {formData.categoria === 'terreno' && (
                <div className="p-4 sm:p-5 bg-amber-50/50 border border-amber-200/80 rounded-2xl mb-4 space-y-4">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
                    <MapPin className="w-4 h-4 text-amber-700" />
                    <span>Campos Específicos para Terreno</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Endereço / Localização do Terreno</label>
                      <input
                        value={formData.endereco_terreno}
                        onChange={(e) => setFormData((p) => ({ ...p, endereco_terreno: e.target.value }))}
                        placeholder="Rua, loteamento, quadra, lote..."
                        className={inputCls}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Área Total (m²)</label>
                        <input
                          type="number"
                          step="any"
                          value={formData.area_terreno}
                          onChange={(e) => setFormData((p) => ({ ...p, area_terreno: e.target.value }))}
                          placeholder="Ex: 600"
                          className={inputCls}
                        />
                      </div>

                      <div>
                        <label className={labelCls}>Nº Matrícula / Registro</label>
                        <input
                          value={formData.matricula_terreno}
                          onChange={(e) => setFormData((p) => ({ ...p, matricula_terreno: e.target.value }))}
                          placeholder="Ex: 45.678"
                          className={inputCls}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={labelCls}>Medida de Frente</label>
                      <input
                        value={formData.medidas_frente}
                        onChange={(e) => setFormData((p) => ({ ...p, medidas_frente: e.target.value }))}
                        placeholder="Ex: 15m de frente"
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Medida de Fundos</label>
                      <input
                        value={formData.medidas_fundos}
                        onChange={(e) => setFormData((p) => ({ ...p, medidas_fundos: e.target.value }))}
                        placeholder="Ex: 15m de fundos"
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Medidas Laterais</label>
                      <input
                        value={formData.medidas_laterais}
                        onChange={(e) => setFormData((p) => ({ ...p, medidas_laterais: e.target.value }))}
                        placeholder="Ex: 40m lado direito, 40m lado esquerdo"
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Observações do Terreno</label>
                    <textarea
                      value={formData.observacoes_terreno}
                      onChange={(e) => setFormData((p) => ({ ...p, observacoes_terreno: e.target.value }))}
                      placeholder="Confrontações, topografia, existência de cerca ou muramento..."
                      className={`${inputCls} min-h-[60px]`}
                    />
                  </div>
                </div>
              )}

              {/* 3. MÓVEIS E UTENSÍLIOS: quantidade, material, estado de conservação e localização interna */}
              {formData.categoria === 'movel' && (
                <div className="p-4 sm:p-5 bg-blue-50/50 border border-blue-200/80 rounded-2xl mb-4 space-y-4">
                  <div className="flex items-center gap-2 text-blue-900 font-bold text-xs uppercase tracking-wider">
                    <Layers className="w-4 h-4 text-blue-700" />
                    <span>Campos Específicos para Móveis e Utensílios</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={labelCls}>Quantidade</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.quantidade_movel}
                        onChange={(e) => setFormData((p) => ({ ...p, quantidade_movel: e.target.value }))}
                        placeholder="1"
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Material / Acabamento</label>
                      <input
                        value={formData.material_movel}
                        onChange={(e) => setFormData((p) => ({ ...p, material_movel: e.target.value }))}
                        placeholder="Ex: Madeira maciça, Aço, MDF, Estofado"
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Localização Interna</label>
                      <input
                        value={formData.localizacao_interna_movel}
                        onChange={(e) => setFormData((p) => ({ ...p, localizacao_interna_movel: e.target.value }))}
                        placeholder="Ex: Nave do templo, Sala pastoral, Gabinete, Cozinha"
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 4. EQUIPAMENTOS: marca, modelo, número de série, quantidade e estado de conservação */}
              {formData.categoria === 'equipamento' && (
                <div className="p-4 sm:p-5 bg-slate-50 border border-slate-200/80 rounded-2xl mb-4 space-y-4">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                    <Package className="w-4 h-4 text-slate-600" />
                    <span>Campos Específicos para Equipamentos</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={labelCls}>Marca / Modelo</label>
                      <input
                        value={formData.marca_modelo}
                        onChange={(e) => setFormData((p) => ({ ...p, marca_modelo: e.target.value }))}
                        placeholder="Ex: Dell Inspiron 15, Epson EcoTank..."
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Número de Série</label>
                      <input
                        value={formData.numero_serie}
                        onChange={(e) => setFormData((p) => ({ ...p, numero_serie: e.target.value }))}
                        placeholder="Nº de série de fábrica"
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Quantidade</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.quantidade_equipamento}
                        onChange={(e) => setFormData((p) => ({ ...p, quantidade_equipamento: e.target.value }))}
                        placeholder="1"
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 5. INSTRUMENTOS MUSICAIS: instrumento, marca, modelo, número de série, quantidade e estado */}
              {formData.categoria === 'instrumento' && (
                <div className="p-4 sm:p-5 bg-indigo-50/50 border border-indigo-200/80 rounded-2xl mb-4 space-y-4">
                  <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs uppercase tracking-wider">
                    <Music className="w-4 h-4 text-indigo-700" />
                    <span>Campos Específicos para Instrumentos Musicais</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className={labelCls}>Instrumento</label>
                      <input
                        value={formData.tipo_instrumento}
                        onChange={(e) => setFormData((p) => ({ ...p, tipo_instrumento: e.target.value }))}
                        placeholder="Ex: Teclado, Bateria, Violão, Contrabaixo..."
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Marca / Modelo</label>
                      <input
                        value={formData.marca_modelo}
                        onChange={(e) => setFormData((p) => ({ ...p, marca_modelo: e.target.value }))}
                        placeholder="Ex: Yamaha Motif XF8, Roland XPS-30"
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Número de Série</label>
                      <input
                        value={formData.numero_serie}
                        onChange={(e) => setFormData((p) => ({ ...p, numero_serie: e.target.value }))}
                        placeholder="Nº de série"
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Quantidade</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.quantidade_instrumento}
                        onChange={(e) => setFormData((p) => ({ ...p, quantidade_instrumento: e.target.value }))}
                        placeholder="1"
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 6. SOM E IMAGEM: tipo de equipamento, marca, modelo, número de série, quantidade e estado */}
              {formData.categoria === 'som_imagem' && (
                <div className="p-4 sm:p-5 bg-violet-50/50 border border-violet-200/80 rounded-2xl mb-4 space-y-4">
                  <div className="flex items-center gap-2 text-violet-900 font-bold text-xs uppercase tracking-wider">
                    <Tv className="w-4 h-4 text-violet-700" />
                    <span>Campos Específicos para Som e Imagem</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className={labelCls}>Tipo de Equipamento</label>
                      <input
                        value={formData.tipo_som_imagem}
                        onChange={(e) => setFormData((p) => ({ ...p, tipo_som_imagem: e.target.value }))}
                        placeholder="Ex: Mesa de som, Caixa acústica, Projetor, Câmera PTZ..."
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Marca / Modelo</label>
                      <input
                        value={formData.marca_modelo}
                        onChange={(e) => setFormData((p) => ({ ...p, marca_modelo: e.target.value }))}
                        placeholder="Ex: Behringer X32, JBL EON 615"
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Número de Série</label>
                      <input
                        value={formData.numero_serie}
                        onChange={(e) => setFormData((p) => ({ ...p, numero_serie: e.target.value }))}
                        placeholder="Nº de série"
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Quantidade</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.quantidade_som_imagem}
                        onChange={(e) => setFormData((p) => ({ ...p, quantidade_som_imagem: e.target.value }))}
                        placeholder="1"
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 7. VEÍCULOS: marca, modelo, ano, placa, Renavam e quilometragem */}
              {formData.categoria === 'veiculo' && (
                <div className="p-4 sm:p-5 bg-sky-50/50 border border-sky-200/80 rounded-2xl mb-4 space-y-4">
                  <div className="flex items-center gap-2 text-sky-900 font-bold text-xs uppercase tracking-wider">
                    <Car className="w-4 h-4 text-sky-700" />
                    <span>Campos Específicos para Veículo</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={labelCls}>Marca / Modelo</label>
                      <input
                        value={formData.marca_modelo}
                        onChange={(e) => setFormData((p) => ({ ...p, marca_modelo: e.target.value }))}
                        placeholder="Ex: Renault Master 16L, Fiat Ducato..."
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Ano / Fabricação</label>
                      <input
                        type="number"
                        value={formData.ano_veiculo}
                        onChange={(e) => setFormData((p) => ({ ...p, ano_veiculo: e.target.value }))}
                        placeholder="Ex: 2022"
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Placa</label>
                      <input
                        value={formData.placa_veiculo}
                        onChange={(e) => setFormData((p) => ({ ...p, placa_veiculo: e.target.value.toUpperCase() }))}
                        placeholder="Ex: ABC-1D23"
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Renavam</label>
                      <input
                        value={formData.renavam_veiculo}
                        onChange={(e) => setFormData((p) => ({ ...p, renavam_veiculo: e.target.value }))}
                        placeholder="Ex: 00123456789"
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Quilometragem (km)</label>
                      <input
                        type="number"
                        value={formData.km_veiculo}
                        onChange={(e) => setFormData((p) => ({ ...p, km_veiculo: e.target.value }))}
                        placeholder="Ex: 45000"
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 8. OUTROS: descrição detalhada (já no topo), quantidade e estado de conservação */}
              {formData.categoria === 'outros' && (
                <div className="p-4 sm:p-5 bg-slate-50 border border-slate-200/80 rounded-2xl mb-4 space-y-4">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                    <HelpCircle className="w-4 h-4 text-slate-600" />
                    <span>Campos Específicos para Outros Bens</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={labelCls}>Quantidade</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.quantidade_outros}
                        onChange={(e) => setFormData((p) => ({ ...p, quantidade_outros: e.target.value }))}
                        placeholder="1"
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Marca / Referência (Opcional)</label>
                      <input
                        value={formData.marca_modelo}
                        onChange={(e) => setFormData((p) => ({ ...p, marca_modelo: e.target.value }))}
                        placeholder="Se aplicável"
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Nº de Série / Identificador (Opcional)</label>
                      <input
                        value={formData.numero_serie}
                        onChange={(e) => setFormData((p) => ({ ...p, numero_serie: e.target.value }))}
                        placeholder="Se aplicável"
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────── */}
              {/* CAMPOS COMUNS A TODAS AS CATEGORIAS                         */}
              {/* ─────────────────────────────────────────────────────────── */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {!['imovel', 'terreno'].includes(formData.categoria) && (
                  <div>
                    <label className={labelCls}>Cor Predominante</label>
                    <input
                      value={formData.cor}
                      onChange={(e) => setFormData((p) => ({ ...p, cor: e.target.value }))}
                      placeholder="Ex: Preto, Branco, Prata, Madeira..."
                      className={inputCls}
                    />
                  </div>
                )}

                <div>
                  <label className={labelCls}>Estado de conservação *</label>
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
                  <label className={labelCls}>Status Operacional *</label>
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
