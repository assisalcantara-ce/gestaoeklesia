'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Building2,
  Calendar,
  Clock,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  Printer,
  Plus,
  Search,
  Shield,
  UserCheck,
  Package,
  History,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  Lock,
  Loader2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { useUserContext } from '@/hooks/useUserContext';
import { fetchConfiguracaoIgrejaFromSupabase, type ConfiguracaoIgreja } from '@/lib/igreja-config-utils';
import NotificationModal from '@/components/NotificationModal';
import { DirigentesService, type CriarPropostaInput } from '@/services/dirigentes-service';
import type {
  CongregacaoLiderancaView,
  DirigenteMovimentacao,
  TipoMovimentacao,
  DirigenteDesignacao,
  MinistroElegivelBusca,
} from '@/types/dirigentes';

function formatCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined) return 'R$ 0,00';
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatTempoMandato(meses: number): string {
  if (meses <= 0) return 'Recém-empossado';
  if (meses < 12) return `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
  const anos = Math.floor(meses / 12);
  const restoMeses = meses % 12;
  if (restoMeses === 0) return `${anos} ${anos === 1 ? 'ano' : 'anos'}`;
  return `${anos}a ${restoMeses}m`;
}

function formatDataPtBr(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function getPaginationRange(current: number, total: number): (number | string)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 3) {
    return [1, 2, 3, 4, '...', total];
  }
  if (current >= total - 2) {
    return [1, '...', total - 3, total - 2, total - 1, total];
  }
  return [1, '...', current - 1, current, current + 1, '...', total];
}

export default function DirigentesPage() {
  const supabase = useMemo(() => createClient(), []);
  const userCtx = useUserContext();

  const [activeTab, setActiveTab] = useState<'liderancas' | 'movimentacoes' | 'rodizio' | 'historico'>('liderancas');
  const [loading, setLoading] = useState(true);

  // Dados
  const [liderancas, setLiderancas] = useState<CongregacaoLiderancaView[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<DirigenteMovimentacao[]>([]);
  const [historico, setHistorico] = useState<DirigenteDesignacao[]>([]);
  const [configIgreja, setConfigIgreja] = useState<ConfiguracaoIgreja>({
    nome: '',
    endereco: '',
    cnpj: '',
    telefone: '',
    email: '',
    logo: '',
  });

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroTipoMov, setFiltroTipoMov] = useState('');
  const [filtroStatusMov, setFiltroStatusMov] = useState('');
  const [paginaAtualLiderancas, setPaginaAtualLiderancas] = useState(1);
  const [detalheCongregacao, setDetalheCongregacao] = useState<CongregacaoLiderancaView | null>(null);

  // Modais e Proposta Contextualizada
  const [modalPropostaOpen, setModalPropostaOpen] = useState(false);
  const [congregacaoProposta, setCongregacaoProposta] = useState<CongregacaoLiderancaView | null>(null);
  const [termoBuscaMinistro, setTermoBuscaMinistro] = useState('');
  const [buscandoMinistros, setBuscandoMinistros] = useState(false);
  const [ministrosSugestoes, setMinistrosSugestoes] = useState<MinistroElegivelBusca[]>([]);
  const [erroBuscaMinistros, setErroBuscaMinistros] = useState<string | null>(null);
  const [ministroSelecionado, setMinistroSelecionado] = useState<MinistroElegivelBusca | null>(null);

  const [propostaForm, setPropostaForm] = useState<CriarPropostaInput>({
    tipo_movimentacao: 'rodizio_anual',
    congregacao_destino_id: '',
    dirigente_novo_member_id: '',
    dirigente_novo_nome: '',
    dirigente_novo_cargo: '',
    dirigente_novo_cpf: '',
    dirigente_novo_matricula: '',
    dirigente_anterior_member_id: null,
    dirigente_anterior_nome: null,
    dirigente_anterior_cargo: null,
    motivo: '',
    data_prevista: new Date().toISOString().slice(0, 10),
    ano_referencia: new Date().getFullYear(),
  });

  const [notification, setNotification] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  const showNotif = (type: typeof notification.type, title: string, message: string) => {
    setNotification({ isOpen: true, title, message, type });
  };

  const mid = userCtx.ministryId;

  // Carregamento de dados
  const loadData = useCallback(async () => {
    if (!mid) return;
    setLoading(true);
    try {
      // 1. Configuração da igreja
      const cfg = await fetchConfiguracaoIgrejaFromSupabase(mid, supabase);
      setConfigIgreja(cfg);

      // 2. Visão geral das lideranças
      const views = await DirigentesService.carregarVisaoGeral(supabase, mid);
      setLiderancas(views);

      // 3. Movimentações
      const { data: movs } = await supabase
        .from('dirigentes_movimentacoes')
        .select('*')
        .eq('ministry_id', mid)
        .order('created_at', { ascending: false });
      setMovimentacoes(movs || []);

      // 4. Histórico
      const { data: hist } = await supabase
        .from('dirigentes_designacoes')
        .select('*')
        .eq('ministry_id', mid)
        .order('data_posse', { ascending: false });
      setHistorico(hist || []);
    } catch (err: any) {
      console.error('Erro ao carregar dados do módulo Dirigentes:', err);
      showNotif('error', 'Erro', err.message || 'Falha ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }, [mid, supabase]);

  useEffect(() => {
    if (!userCtx.loading && mid) {
      loadData();
    }
  }, [userCtx.loading, mid, loadData]);

  // Contexto de autorização do usuário atual
  const authUser = useMemo(() => {
    return {
      userId: userCtx.userId || '',
      userName: 'Usuário do Sistema',
      ministryId: mid || '',
      nivel: userCtx.nivel,
      isAdmin: userCtx.isAdmin,
    };
  }, [userCtx, mid]);

  const podeAprovar = DirigentesService.podeAprovarMovimentacao(authUser);
  const podePropor = DirigentesService.podeProporMovimentacao(authUser);

  // Ações de Proposta e Aprovação
  const abrirPropostaParaCongregacao = (item: CongregacaoLiderancaView) => {
    if (item.movimentacao_em_andamento) {
      setNotification({
        isOpen: true,
        title: 'Mudança em Análise',
        message: `Já existe uma movimentação em análise para a congregação "${item.congregacao_nome}" (Novo proposto: ${item.movimentacao_em_andamento.dirigente_novo_nome}). Aguarde a deliberação da Presidência antes de propor nova mudança.`,
        type: 'warning',
      });
      return;
    }

    setCongregacaoProposta(item);
    setPropostaForm({
      tipo_movimentacao: 'rodizio_anual',
      congregacao_destino_id: item.congregacao_id,
      dirigente_novo_member_id: '',
      dirigente_novo_nome: '',
      dirigente_novo_cargo: '',
      dirigente_novo_cpf: '',
      dirigente_novo_matricula: '',
      dirigente_anterior_member_id: item.dirigente_atual_member_id || null,
      dirigente_anterior_nome: item.dirigente_atual_nome || null,
      dirigente_anterior_cargo: item.dirigente_atual_cargo || null,
      motivo: '',
      data_prevista: new Date().toISOString().slice(0, 10),
      ano_referencia: new Date().getFullYear(),
    });
    setMinistroSelecionado(null);
    setTermoBuscaMinistro('');
    setMinistrosSugestoes([]);
    setErroBuscaMinistros(null);
    setModalPropostaOpen(true);
  };

  const handleSelecionarMinistro = (m: MinistroElegivelBusca) => {
    setMinistroSelecionado(m);
    setPropostaForm((prev) => ({
      ...prev,
      dirigente_novo_member_id: m.id,
      dirigente_novo_nome: m.nome,
      dirigente_novo_cargo: m.cargo_ministerial || 'Pastor',
      dirigente_novo_cpf: m.cpf || '',
      dirigente_novo_matricula: m.matricula || '',
    }));
    setTermoBuscaMinistro('');
    setMinistrosSugestoes([]);
    setErroBuscaMinistros(null);
  };

  const handleTrocarMinistro = () => {
    setMinistroSelecionado(null);
    setPropostaForm((prev) => ({
      ...prev,
      dirigente_novo_member_id: '',
      dirigente_novo_nome: '',
      dirigente_novo_cargo: '',
      dirigente_novo_cpf: '',
      dirigente_novo_matricula: '',
    }));
    setTermoBuscaMinistro('');
  };

  // Efeito de busca de ministros elegíveis com debounce (300ms) após 3 caracteres
  useEffect(() => {
    if (!modalPropostaOpen || ministroSelecionado || !mid) {
      setMinistrosSugestoes([]);
      return;
    }

    const t = termoBuscaMinistro.trim();
    if (t.length < 3) {
      setMinistrosSugestoes([]);
      setErroBuscaMinistros(null);
      setBuscandoMinistros(false);
      return;
    }

    let isCancelled = false;
    setBuscandoMinistros(true);
    setErroBuscaMinistros(null);

    const timer = setTimeout(async () => {
      try {
        const resultados = await DirigentesService.buscarMinistrosElegiveis(supabase, mid, t);
        if (!isCancelled) {
          setMinistrosSugestoes(resultados);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error('Erro ao buscar ministros elegíveis:', err);
          setErroBuscaMinistros(err.message || 'Falha ao consultar ministros elegíveis.');
        }
      } finally {
        if (!isCancelled) {
          setBuscandoMinistros(false);
        }
      }
    }, 300);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [termoBuscaMinistro, modalPropostaOpen, ministroSelecionado, supabase, mid]);

  const handleSalvarProposta = async () => {
    if (!mid) return;
    if (!propostaForm.congregacao_destino_id) {
      showNotif('warning', 'Atenção', 'Congregação não identificada para a proposta.');
      return;
    }
    if (!propostaForm.dirigente_novo_member_id) {
      showNotif('warning', 'Atenção', 'Selecione o novo dirigente elegível através da pesquisa de ministros.');
      return;
    }
    if (!propostaForm.motivo.trim()) {
      showNotif('warning', 'Atenção', 'Informe a justificativa ou motivo da proposta de substituição.');
      return;
    }

    try {
      await DirigentesService.criarProposta(supabase, authUser, propostaForm);
      showNotif('success', 'Proposta Registrada', 'A proposta de substituição foi enviada para apreciação da Presidência.');
      setModalPropostaOpen(false);
      setCongregacaoProposta(null);
      setMinistroSelecionado(null);
      setTermoBuscaMinistro('');
      setMinistrosSugestoes([]);
      setPropostaForm({
        tipo_movimentacao: 'rodizio_anual',
        congregacao_destino_id: '',
        dirigente_novo_member_id: '',
        dirigente_novo_nome: '',
        dirigente_novo_cargo: '',
        dirigente_novo_cpf: '',
        dirigente_novo_matricula: '',
        dirigente_anterior_member_id: null,
        dirigente_anterior_nome: null,
        dirigente_anterior_cargo: null,
        motivo: '',
        data_prevista: new Date().toISOString().slice(0, 10),
        ano_referencia: new Date().getFullYear(),
      });
      loadData();
    } catch (err: any) {
      showNotif('error', 'Falha ao Registrar', err.message);
    }
  };

  const handleAprovar = async (movId: string) => {
    if (!confirm('Deseja realmente aprovar esta movimentação de liderança?')) return;
    try {
      await DirigentesService.aprovarProposta(supabase, authUser, { movimentacao_id: movId });
      showNotif('success', 'Aprovada', 'A proposta foi aprovada pela Presidência e está pronta para posse/efetivação.');
      loadData();
    } catch (err: any) {
      showNotif('error', 'Erro ao Aprovar', err.message);
    }
  };

  const handleEfetivar = async (mov: DirigenteMovimentacao) => {
    // Se a congregação possuir bens e não houver termo formalizado
    if (mov.requer_termo_patrimonial && !mov.termo_patrimonial_id) {
      const resp = confirm(
        'Esta congregação possui bens patrimoniais cadastrados. Deseja emitir e formalizar o Termo de Transferência Patrimonial agora?'
      );
      if (resp) {
        imprimirTermoPatrimonialTransferencia(mov);
        return;
      }
    }

    if (!confirm(`Confirmar a posse e efetivação definitiva de ${mov.dirigente_novo_nome}? O histórico da liderança anterior será encerrado e preservado.`)) {
      return;
    }

    try {
      await DirigentesService.efetivarMovimentacao(supabase, authUser, {
        movimentacao_id: mov.id,
        data_efetiva: new Date().toISOString().slice(0, 10),
      });
      showNotif('success', 'Efetivação Concluída', 'A liderança da congregação foi oficialmente atualizada e o histórico registrado.');
      loadData();
    } catch (err: any) {
      showNotif('error', 'Erro ao Efetivar', err.message);
    }
  };

  // Impressão Oficial do Termo de Transferência Patrimonial
  const imprimirTermoPatrimonialTransferencia = async (mov: DirigenteMovimentacao) => {
    try {
      // Busca todos os bens da congregação
      const { data: bens } = await supabase
        .from('patrimonio_itens')
        .select('*')
        .eq('ministry_id', mid)
        .eq('congregacao_id', mov.congregacao_destino_id)
        .neq('status', 'baixado')
        .order('numero_tombamento');

      const cong = liderancas.find((l) => l.congregacao_id === mov.congregacao_destino_id);
      const congNome = cong?.congregacao_nome || 'Congregação';
      const itensSnapshot = (bens || []).map((b: any) => ({
        id: b.id,
        numero_tombamento: b.numero_tombamento || '—',
        descricao: b.descricao,
        categoria: b.categoria,
        estado_conservacao: b.estado_conservacao,
        valor_aquisicao: b.valor_aquisicao,
        status: b.status,
      }));

      const totalItens = itensSnapshot.length;
      const valorTotal = itensSnapshot.reduce((acc: number, i: any) => acc + (i.valor_aquisicao || 0), 0);
      const hoje = new Date().toLocaleDateString('pt-BR');

      // Gera ou registra o termo no banco
      const { data: termoCriado } = await supabase
        .from('dirigentes_termos_patrimoniais')
        .insert({
          ministry_id: mid,
          movimentacao_id: mov.id,
          congregacao_id: mov.congregacao_destino_id,
          data_emissao: new Date().toISOString().slice(0, 10),
          dirigente_transmitente_nome: mov.dirigente_anterior_nome || 'Liderança Anterior',
          dirigente_recebedor_nome: mov.dirigente_novo_nome,
          secretario_geral_nome: 'Secretaria Geral',
          total_itens: totalItens,
          valor_total_estimado: valorTotal,
          itens_snapshot: itensSnapshot,
          status_termo: 'assinado_e_homologado',
        })
        .select()
        .single();

      if (termoCriado) {
        await supabase
          .from('dirigentes_movimentacoes')
          .update({
            termo_patrimonial_id: termoCriado.id,
            status_conferencia_patrimonial: 'conferido_sem_divergencias',
          })
          .eq('id', mov.id);
      }

      // Abre janela de impressão profissional A4
      const linhasHtml = itensSnapshot
        .map(
          (item: any, idx: number) => `
        <tr style="border-bottom:1px solid #e2e8f0;${idx % 2 === 0 ? 'background:#f8fafc' : ''}">
          <td style="padding:6px 8px;font-size:10px;text-align:center;font-weight:bold;">${item.numero_tombamento}</td>
          <td style="padding:6px 8px;font-size:10px;font-weight:600;">${item.descricao}</td>
          <td style="padding:6px 8px;font-size:10px;text-align:center;">${item.categoria}</td>
          <td style="padding:6px 8px;font-size:10px;text-align:center;text-transform:capitalize;">${item.estado_conservacao}</td>
          <td style="padding:6px 8px;font-size:10px;text-align:right;font-weight:bold;">${formatCurrency(item.valor_aquisicao)}</td>
        </tr>
      `
        )
        .join('');

      const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>Termo de Transferência Patrimonial — ${congNome}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  @page{size:A4 portrait;margin:14mm 12mm 16mm 12mm}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#0f172a;font-size:11px;line-height:1.4}
  .header{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #0f766e;padding-bottom:12px;margin-bottom:14px}
  .header h1{font-size:16px;font-weight:800;color:#0f766e}
  .header p{font-size:10px;color:#475569}
  .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin-bottom:14px}
  table{width:100%;border-collapse:collapse;margin-bottom:16px}
  thead th{background:#0f766e;color:#fff;padding:6px 8px;font-size:9px;text-transform:uppercase;text-align:left}
  .termos{background:#fafafa;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-top:16px;font-size:10px;text-align:justify}
  .signatures{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-top:40px;page-break-inside:avoid}
  .sig{text-align:center}
  .sig-line{border-top:1px solid #0f172a;padding-top:4px;font-size:10px;font-weight:bold}
  .sig-sub{font-size:9px;color:#64748b}
</style>
</head><body>
  <div class="header">
    <div>
      <h1>TERMO OFICIAL DE TRANSFERÊNCIA E ENTREGA PATRIMONIAL</h1>
      <p>${configIgreja.nome || 'Ministério Eklésia'} · Gestão de Lideranças</p>
    </div>
    <div style="text-align:right">
      <div style="font-size:11px;font-weight:bold;color:#0f766e">DOCUMENTO HOMOLOGADO</div>
      <div style="font-size:9px;color:#64748b">Emissão: ${hoje}</div>
    </div>
  </div>

  <div class="box">
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;font-size:10px">
      <div><strong>Congregação:</strong> ${congNome}</div>
      <div><strong>Dirigente Transmitente:</strong> ${mov.dirigente_anterior_nome || '—'}</div>
      <div><strong>Dirigente Recebedor:</strong> ${mov.dirigente_novo_nome}</div>
      <div><strong>Total de Itens:</strong> ${totalItens} bens</div>
      <div><strong>Valor Estimado:</strong> ${formatCurrency(valorTotal)}</div>
      <div><strong>Tipo de Mudança:</strong> ${mov.tipo_movimentacao.replace('_', ' ').toUpperCase()}</div>
    </div>
  </div>

  <p style="font-size:10px;color:#475569;margin-bottom:8px"><strong>INVENTÁRIO COMPLETO CONFERIDO:</strong></p>
  <table>
    <thead>
      <tr>
        <th style="text-align:center;width:80px">Tombamento</th>
        <th>Descrição do Bem</th>
        <th style="text-align:center">Categoria</th>
        <th style="text-align:center">Estado</th>
        <th style="text-align:right">Valor Estimado</th>
      </tr>
    </thead>
    <tbody>${linhasHtml}</tbody>
  </table>

  <div class="termos">
    <strong>DECLARAÇÃO FORMAL DE RESPONSABILIDADE:</strong><br/>
    Pelo presente instrumento, o <strong>Dirigente Transmitente</strong> declara haver entregue e o <strong>Dirigente Recebedor</strong> declara haver recebido sob sua guarda e administração todos os bens patrimoniais acima discriminados e conferidos. Ambos comprometem-se a zelar pelo patrimônio de acordo com o estatuto eclesiástico.
  </div>

  <div class="signatures">
    <div class="sig">
      <div class="sig-line">${mov.dirigente_anterior_nome || 'Dirigente Anterior'}</div>
      <div class="sig-sub">Dirigente Transmitente</div>
    </div>
    <div class="sig">
      <div class="sig-line">${mov.dirigente_novo_nome}</div>
      <div class="sig-sub">Dirigente Recebedor</div>
    </div>
    <div class="sig">
      <div class="sig-line">Secretaria Geral</div>
      <div class="sig-sub">Homologação da Secretaria</div>
    </div>
  </div>
</body></html>`;

      const w = window.open('', '_blank');
      if (w) {
        w.document.write(html);
        w.document.close();
        setTimeout(() => {
          w.print();
        }, 300);
      }
      loadData();
    } catch (err: any) {
      showNotif('error', 'Falha ao emitir termo', err.message);
    }
  };

  // Impressão da Lista Atual de Dirigentes por Congregação
  const handleImprimirListaDirigentes = () => {
    if (liderancas.length === 0) {
      showNotif('info', 'Sem Dados', 'Não há congregações cadastradas para emitir a lista de dirigentes.');
      return;
    }

    // 1. Ordena alfabeticamente todas as congregações ativas do ministério
    const listaOrdenada = [...liderancas].sort((a, b) =>
      (a.congregacao_nome || '').localeCompare(b.congregacao_nome || '', 'pt-BR', {
        sensitivity: 'base',
      })
    );

    // 2. Estatísticas consolidadas
    const totalCongregacoes = listaOrdenada.length;
    const totalDesignados = listaOrdenada.filter((l) => Boolean(l.dirigente_atual_nome?.trim())).length;
    const totalSemDirigente = totalCongregacoes - totalDesignados;

    const dataHoraEmissao =
      new Date().toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }) +
      ' às ' +
      new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });

    const linhasHtml = listaOrdenada
      .map((item, idx) => {
        const temDirigente = Boolean(item.dirigente_atual_nome?.trim());
        const nomeDirigente = temDirigente
          ? `<span style="font-weight:700;color:#0f172a;">${item.dirigente_atual_nome}</span>`
          : `<span style="color:#b91c1c;font-weight:600;font-style:italic;">Não designado</span>`;

        const matricula = item.dirigente_atual_matricula?.trim() || '—';
        const cargo = temDirigente ? (item.dirigente_atual_cargo?.trim() || '—') : '—';
        const dataPosse = temDirigente && item.data_posse_atual ? formatDataPtBr(item.data_posse_atual) : '—';
        const bgCor = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

        return `
          <tr style="border-bottom:1px solid #e2e8f0;background-color:${bgCor};page-break-inside:avoid;">
            <td style="padding:6px 8px;text-align:center;font-weight:bold;color:#475569;width:38px;">${idx + 1}</td>
            <td style="padding:6px 8px;font-weight:700;color:#1e293b;">
              ${item.congregacao_nome}
              ${item.is_acumulacao ? '<span style="font-size:8.5px;color:#d97706;font-weight:bold;margin-left:4px;">(Acumulação)</span>' : ''}
            </td>
            <td style="padding:6px 8px;">${nomeDirigente}</td>
            <td style="padding:6px 8px;text-align:center;font-weight:600;color:#334155;">${matricula}</td>
            <td style="padding:6px 8px;color:#334155;">${cargo}</td>
            <td style="padding:6px 8px;text-align:center;color:#334155;white-space:nowrap;">${dataPosse}</td>
          </tr>
        `;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Lista Atual de Dirigentes por Congregação</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page {
      size: A4 portrait;
      margin: 12mm 10mm 14mm 10mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      font-size: 10.5px;
      line-height: 1.35;
      padding: 0;
    }
    .header-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #0f766e;
      padding-bottom: 10px;
      margin-bottom: 12px;
      gap: 16px;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .header-logo {
      height: 50px;
      max-width: 110px;
      object-fit: contain;
    }
    .header-titles h1 {
      font-size: 15px;
      font-weight: 800;
      color: #0f766e;
      letter-spacing: -0.2px;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .header-titles h2 {
      font-size: 12px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 1px;
    }
    .header-titles p {
      font-size: 9.5px;
      color: #64748b;
    }
    .header-badge {
      text-align: right;
      background: #f0fdfa;
      border: 1px solid #ccfbf1;
      border-radius: 8px;
      padding: 6px 12px;
      flex-shrink: 0;
    }
    .header-badge strong {
      display: block;
      font-size: 10px;
      color: #0f766e;
      text-transform: uppercase;
      font-weight: 800;
      letter-spacing: 0.3px;
    }
    .header-badge span {
      font-size: 9px;
      color: #475569;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 14px;
      margin-bottom: 12px;
      page-break-inside: avoid;
    }
    .summary-item strong {
      display: block;
      font-size: 8.5px;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.4px;
      font-weight: 700;
    }
    .summary-item span {
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
    }
    thead {
      display: table-header-group;
    }
    thead th {
      background-color: #0f766e;
      color: #ffffff;
      padding: 6px 8px;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      text-align: left;
      border: 1px solid #0f766e;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    tbody td {
      border: 1px solid #e2e8f0;
      font-size: 9.5px;
    }
    tr {
      page-break-inside: avoid;
    }
    .footer-note {
      margin-top: 14px;
      border-top: 1px solid #cbd5e1;
      padding-top: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 8.5px;
      color: #64748b;
      page-break-inside: avoid;
    }
    @media print {
      body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>
  <div class="header-container">
    <div class="header-left">
      ${configIgreja.logo ? `<img class="header-logo" src="${configIgreja.logo}" alt="Logo" />` : ''}
      <div class="header-titles">
        <h1>${configIgreja.nome || 'Ministério Eklésia'}</h1>
        <h2>Lista Atual de Dirigentes por Congregação</h2>
        <p>Secretaria Geral · Governança e Liderança Eclesiástica</p>
      </div>
    </div>
    <div class="header-badge">
      <strong>Relatório Oficial</strong>
      <span>Emissão: ${dataHoraEmissao}</span>
    </div>
  </div>

  <div class="summary-grid">
    <div class="summary-item">
      <strong>Total de Congregações</strong>
      <span>${totalCongregacoes}</span>
    </div>
    <div class="summary-item">
      <strong>Dirigentes Designados</strong>
      <span style="color:#0f766e;">${totalDesignados}</span>
    </div>
    <div class="summary-item">
      <strong>Congregações Não Designadas</strong>
      <span style="color:${totalSemDirigente > 0 ? '#b91c1c' : '#475569'};">${totalSemDirigente}</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="text-align:center;width:38px;">Nº</th>
        <th>Congregação</th>
        <th>Nome Completo do Dirigente Vigente</th>
        <th style="text-align:center;width:110px;">Matrícula</th>
        <th style="width:130px;">Cargo</th>
        <th style="text-align:center;width:95px;">Data da Posse</th>
      </tr>
    </thead>
    <tbody>
      ${linhasHtml}
    </tbody>
  </table>

  <div class="footer-note">
    <span>Gestão Eklésia · Sistema de Gestão Eclesiástica Integrada</span>
    <span>Documento gerado para controle e governança da Secretaria Geral</span>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 300);
    };
  <\/script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    } else {
      showNotif(
        'warning',
        'Pop-up Bloqueado',
        'O navegador bloqueou a abertura da janela de impressão. Por favor, permita pop-ups para este site para gerar o relatório impresso.'
      );
    }
  };

  // Memos e Métricas
  const totalCongregacoes = liderancas.length;
  const comDirigenteCount = liderancas.filter((l) => Boolean(l.dirigente_atual_nome)).length;
  const acumulacoesCount = liderancas.filter((l) => l.is_acumulacao).length;
  const propostasPendentes = movimentacoes.filter((m) => m.status === 'proposta').length;

  const liderancasFiltradas = useMemo(() => {
    const t = busca.toLowerCase().trim();
    if (!t) return liderancas;
    return liderancas.filter(
      (l) =>
        l.congregacao_nome.toLowerCase().includes(t) ||
        (l.dirigente_atual_nome || '').toLowerCase().includes(t) ||
        (l.dirigente_atual_cargo || '').toLowerCase().includes(t)
    );
  }, [liderancas, busca]);

  const ITEMS_PER_PAGE_LIDERANCAS = 15;
  const totalItensLiderancas = liderancasFiltradas.length;
  const totalPaginasLiderancas = Math.max(1, Math.ceil(totalItensLiderancas / ITEMS_PER_PAGE_LIDERANCAS));
  const paginaValidaLiderancas = Math.min(Math.max(1, paginaAtualLiderancas), totalPaginasLiderancas);

  useEffect(() => {
    if (paginaAtualLiderancas > totalPaginasLiderancas) {
      setPaginaAtualLiderancas(totalPaginasLiderancas);
    }
  }, [paginaAtualLiderancas, totalPaginasLiderancas]);

  const liderancasPaginadas = useMemo(() => {
    const inicio = (paginaValidaLiderancas - 1) * ITEMS_PER_PAGE_LIDERANCAS;
    return liderancasFiltradas.slice(inicio, inicio + ITEMS_PER_PAGE_LIDERANCAS);
  }, [liderancasFiltradas, paginaValidaLiderancas]);

  const inicioRegistroLiderancas =
    totalItensLiderancas === 0 ? 0 : (paginaValidaLiderancas - 1) * ITEMS_PER_PAGE_LIDERANCAS + 1;
  const fimRegistroLiderancas = Math.min(
    paginaValidaLiderancas * ITEMS_PER_PAGE_LIDERANCAS,
    totalItensLiderancas
  );

  const movimentacoesFiltradas = useMemo(() => {
    return movimentacoes.filter((m) => {
      const matchTipo = !filtroTipoMov || m.tipo_movimentacao === filtroTipoMov;
      const matchStatus = !filtroStatusMov || m.status === filtroStatusMov;
      const t = busca.toLowerCase().trim();
      const matchBusca =
        !t ||
        m.dirigente_novo_nome.toLowerCase().includes(t) ||
        (m.dirigente_anterior_nome || '').toLowerCase().includes(t) ||
        m.motivo.toLowerCase().includes(t);
      return matchTipo && matchStatus && matchBusca;
    });
  }, [movimentacoes, filtroTipoMov, filtroStatusMov, busca]);

  if (userCtx.loading || loading) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#f4f7fa] min-h-screen flex items-center justify-center p-8">
        <div className="flex items-center gap-3 text-slate-500 font-semibold text-sm bg-white px-6 py-4 rounded-2xl shadow-xs border border-slate-200">
          <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          <span>Carregando dados dos Dirigentes...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#f4f7fa] min-h-screen">
      <NotificationModal
        isOpen={notification.isOpen}
        onClose={() => setNotification((prev) => ({ ...prev, isOpen: false }))}
        title={notification.title}
        message={notification.message}
        type={notification.type}
      />

      {/* ── Header Principal do Módulo ─────────────────────────────────── */}
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-100 mb-2">
              <Shield className="w-3.5 h-3.5" />
              <span>Secretaria · Governança Ministerial</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Módulo Dirigentes
            </h1>
            <p className="text-sm text-slate-500 font-medium mt-0.5">
              Gestão de lideranças congregais, planejamento anual de rodízio e transferências patrimoniais
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleImprimirListaDirigentes}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 shadow-xs border border-slate-300 hover:border-slate-400 transition cursor-pointer"
              title="Imprimir lista oficial de dirigentes de todas as congregações"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Imprimir Lista de Dirigentes</span>
            </button>

            {podePropor && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('liderancas');
                  setNotification({
                    isOpen: true,
                    title: 'Selecione a Congregação',
                    message:
                      'Para propor uma substituição de liderança, localize a congregação desejada na lista abaixo e clique em "Propor Mudança" na respectiva linha.',
                    type: 'info',
                  });
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-teal-700 hover:bg-teal-800 shadow-sm border border-teal-800 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Proposta de Mudança</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Cards de Indicadores Superiores (KPIs) ────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 block uppercase tracking-wider">
                Total de Congregações
              </span>
              <p className="text-3xl font-black text-slate-900 mt-1">{totalCongregacoes}</p>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Templos locais mapeados</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-700 border border-teal-100 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 block uppercase tracking-wider">
                Com Dirigente Definido
              </span>
              <p className="text-3xl font-black text-slate-900 mt-1">{comDirigenteCount}</p>
              <p className="text-xs text-emerald-600 font-bold mt-0.5">
                {totalCongregacoes > 0 ? `${((comDirigenteCount / totalCongregacoes) * 100).toFixed(0)}% de cobertura` : '0%'}
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 block uppercase tracking-wider">
                Dirigentes com Acumulação
              </span>
              <p className="text-3xl font-black text-amber-700 mt-1">{acumulacoesCount}</p>
              <p className="text-xs text-amber-600 font-bold mt-0.5">Regime excepcional</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-700 border border-amber-100 flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 block uppercase tracking-wider">
                Propostas em Análise
              </span>
              <p className="text-3xl font-black text-indigo-700 mt-1">{propostasPendentes}</p>
              <p className="text-xs text-indigo-600 font-bold mt-0.5">Aguardando Presidência</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* ── Navegação de Abas (Padrão Pills) ─────────────────────────── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('liderancas')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'liderancas'
                ? 'bg-teal-700 text-white shadow-sm border border-teal-800'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Lideranças Vigentes ({totalCongregacoes})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('movimentacoes')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'movimentacoes'
                ? 'bg-teal-700 text-white shadow-sm border border-teal-800'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Movimentações & Propostas ({movimentacoes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rodizio')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'rodizio'
                ? 'bg-teal-700 text-white shadow-sm border border-teal-800'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Planejamento Anual de Rodízio</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('historico')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'historico'
                ? 'bg-teal-700 text-white shadow-sm border border-teal-800'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Histórico de Designações</span>
          </button>
        </div>

        {/* ═══════════════ ABA 1: LIDERANÇAS VIGENTES (LISTA COMPACTA COM PAGINAÇÃO DE 15 ITENS) ═══════════════ */}
        {activeTab === 'liderancas' && (
          <div className="space-y-4">
            {/* Toolbar de Busca e Indicador de Paginação */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => {
                    setBusca(e.target.value);
                    setPaginaAtualLiderancas(1);
                  }}
                  placeholder="Buscar por congregação, dirigente ou cargo..."
                  className="w-full pl-10 pr-10 py-2 bg-slate-50/70 border border-slate-300 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                />
                {busca && (
                  <button
                    type="button"
                    onClick={() => {
                      setBusca('');
                      setPaginaAtualLiderancas(1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                    title="Limpar busca"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end text-xs font-semibold text-slate-500">
                <span>
                  {totalItensLiderancas}{' '}
                  {totalItensLiderancas === 1 ? 'congregação listada' : 'congregações listadas'}
                </span>
                {totalPaginasLiderancas > 1 && (
                  <span className="text-slate-400 font-normal">
                    · Página {paginaValidaLiderancas} de {totalPaginasLiderancas}
                  </span>
                )}
              </div>
            </div>

            {/* Container da Lista Compacta */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
              {liderancasFiltradas.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-bold text-slate-800">
                    {busca ? 'Nenhuma congregação ou dirigente encontrado' : 'Nenhuma congregação cadastrada'}
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    {busca
                      ? `Não encontramos registros para o termo "${busca}". Tente pesquisar com outro nome ou cargo.`
                      : 'Cadastre as congregações no módulo de Igrejas/Congregações para iniciar a gestão de lideranças.'}
                  </p>
                  {busca && (
                    <button
                      type="button"
                      onClick={() => {
                        setBusca('');
                        setPaginaAtualLiderancas(1);
                      }}
                      className="px-4 py-2 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-xl border border-teal-200 transition cursor-pointer"
                    >
                      Limpar filtro de busca
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Visualização Desktop (Tabela compacta horizontal) */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          <th className="py-3 px-4">Congregação</th>
                          <th className="py-3 px-4">Dirigente Vigente</th>
                          <th className="py-3 px-4">Cargo</th>
                          <th className="py-3 px-4">Tempo de Mandato</th>
                          <th className="py-3 px-4">Patrimônio</th>
                          <th className="py-3 px-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {liderancasPaginadas.map((item) => (
                          <tr key={item.congregacao_id} className="hover:bg-slate-50/70 transition group">
                            {/* Congregação */}
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900 leading-snug">{item.congregacao_nome}</div>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                {item.is_acumulacao && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                                    Acumulação
                                  </span>
                                )}
                                {item.movimentacao_em_andamento && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    Mudança em análise
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Dirigente Vigente */}
                            <td className="py-3 px-4">
                              {item.dirigente_atual_nome ? (
                                <div className="font-semibold text-slate-800">{item.dirigente_atual_nome}</div>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                  Não designado
                                </span>
                              )}
                            </td>

                            {/* Cargo */}
                            <td className="py-3 px-4">
                              <span className="font-medium text-teal-700">{item.dirigente_atual_cargo || '—'}</span>
                            </td>

                            {/* Tempo de Mandato */}
                            <td className="py-3 px-4">
                              {item.data_posse_atual ? (
                                <div>
                                  <span className="font-semibold text-slate-800">
                                    {formatTempoMandato(item.tempo_mandato_meses)}
                                  </span>
                                  <span className="text-[11px] text-slate-400 block font-normal">
                                    Posse: {new Date(item.data_posse_atual).toLocaleDateString('pt-BR')}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>

                            {/* Patrimônio */}
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-800">
                                {item.total_bens_patrimonio} {item.total_bens_patrimonio === 1 ? 'bem' : 'bens'}
                              </div>
                              <div className="text-[11px] text-slate-500 font-medium">
                                {formatCurrency(item.valor_patrimonio_estimado)}
                              </div>
                            </td>

                            {/* Ações */}
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setDetalheCongregacao(item)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer border border-transparent hover:border-slate-200"
                                  title="Ver detalhes da congregação"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>

                                {item.movimentacao_em_andamento ? (
                                  <button
                                    type="button"
                                    disabled
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-400 bg-slate-100 border border-slate-200/90 cursor-not-allowed select-none opacity-80"
                                    title={`Já existe uma mudança em análise para esta congregação (Novo proposto: ${item.movimentacao_em_andamento.dirigente_novo_nome}).`}
                                  >
                                    <ArrowRightLeft className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Propor Mudança</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => abrirPropostaParaCongregacao(item)}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100/70 border border-teal-200/80 transition cursor-pointer"
                                  >
                                    <ArrowRightLeft className="w-3.5 h-3.5" />
                                    <span>Propor Mudança</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Visualização Mobile (Lista vertical compacta) */}
                  <div className="md:hidden divide-y divide-slate-100">
                    {liderancasPaginadas.map((item) => (
                      <div key={item.congregacao_id} className="p-4 hover:bg-slate-50/60 transition space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm leading-snug">{item.congregacao_nome}</h4>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {item.is_acumulacao && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                                  Acumulação
                                </span>
                              )}
                              {item.movimentacao_em_andamento && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  Mudança em análise
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setDetalheCongregacao(item)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg border border-slate-200 hover:bg-slate-100 cursor-pointer"
                            title="Ver detalhes"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">Dirigente</span>
                            {item.dirigente_atual_nome ? (
                              <div>
                                <p className="font-semibold text-slate-800 truncate">{item.dirigente_atual_nome}</p>
                                <p className="text-[11px] text-teal-700 font-medium truncate">{item.dirigente_atual_cargo || '—'}</p>
                              </div>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200/70 text-slate-600 mt-0.5">
                                Não designado
                              </span>
                            )}
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">Mandato</span>
                            {item.data_posse_atual ? (
                              <div>
                                <p className="font-semibold text-slate-800">{formatTempoMandato(item.tempo_mandato_meses)}</p>
                                <p className="text-[11px] text-slate-400">{new Date(item.data_posse_atual).toLocaleDateString('pt-BR')}</p>
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </div>

                          <div className="col-span-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between">
                            <span className="text-slate-500 font-medium flex items-center gap-1">
                              <Package className="w-3.5 h-3.5 text-slate-400" />
                              {item.total_bens_patrimonio} {item.total_bens_patrimonio === 1 ? 'bem' : 'bens'}
                            </span>
                            <span className="font-bold text-slate-800">{formatCurrency(item.valor_patrimonio_estimado)}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-end pt-1">
                          {item.movimentacao_em_andamento ? (
                            <button
                              type="button"
                              disabled
                              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed select-none opacity-80"
                              title={`Já existe uma mudança em análise para esta congregação (Novo proposto: ${item.movimentacao_em_andamento.dirigente_novo_nome}).`}
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5 text-slate-400" />
                              <span>Propor Mudança</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => abrirPropostaParaCongregacao(item)}
                              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition cursor-pointer"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                              <span>Propor Mudança</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Rodapé com Navegação Paginada (15 por página) */}
                  <div className="px-4 py-3 bg-white border-t border-slate-200/90 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                    <div className="text-slate-600 font-medium text-center sm:text-left">
                      Mostrando <span className="font-bold text-slate-900">{inicioRegistroLiderancas}</span> a{' '}
                      <span className="font-bold text-slate-900">{fimRegistroLiderancas}</span> de{' '}
                      <span className="font-bold text-slate-900">{totalItensLiderancas}</span> congregações
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Botão Anterior */}
                      <button
                        type="button"
                        onClick={() => setPaginaAtualLiderancas((p) => Math.max(1, p - 1))}
                        disabled={paginaValidaLiderancas <= 1}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold border transition ${
                          paginaValidaLiderancas <= 1
                            ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 cursor-pointer shadow-2xs'
                        }`}
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span className="hidden sm:inline">Anterior</span>
                      </button>

                      {/* Números das Páginas */}
                      <div className="flex items-center gap-1 px-1">
                        {getPaginationRange(paginaValidaLiderancas, totalPaginasLiderancas).map((p, idx) => {
                          if (p === '...') {
                            return (
                              <span key={`dots-${idx}`} className="px-2 py-1 text-slate-400 select-none">
                                ...
                              </span>
                            );
                          }
                          const pageNum = Number(p);
                          const isAtiva = pageNum === paginaValidaLiderancas;
                          return (
                            <button
                              key={`page-${pageNum}`}
                              type="button"
                              onClick={() => setPaginaAtualLiderancas(pageNum)}
                              className={`min-w-8 h-8 rounded-lg text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                                isAtiva
                                  ? 'bg-teal-700 text-white shadow-xs'
                                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>

                      {/* Botão Próxima */}
                      <button
                        type="button"
                        onClick={() => setPaginaAtualLiderancas((p) => Math.min(totalPaginasLiderancas, p + 1))}
                        disabled={paginaValidaLiderancas >= totalPaginasLiderancas}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold border transition ${
                          paginaValidaLiderancas >= totalPaginasLiderancas
                            ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 cursor-pointer shadow-2xs'
                        }`}
                      >
                        <span className="hidden sm:inline">Próxima</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════ ABA 2: MOVIMENTAÇÕES & PROPOSTAS ═══════════════ */}
        {activeTab === 'movimentacoes' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <select
                  value={filtroTipoMov}
                  onChange={(e) => setFiltroTipoMov(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
                >
                  <option value="">Todos os Tipos</option>
                  <option value="rodizio_anual">Rodízio Anual</option>
                  <option value="transferencia_extraordinaria">Transferência Extraordinária</option>
                  <option value="substituicao_temporaria">Substituição Temporária</option>
                </select>

                <select
                  value={filtroStatusMov}
                  onChange={(e) => setFiltroStatusMov(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
                >
                  <option value="">Todos os Status</option>
                  <option value="proposta">Proposta (Pendente)</option>
                  <option value="aprovada">Aprovada (Aguardando Posse)</option>
                  <option value="efetivada">Efetivada (Concluída)</option>
                  <option value="rejeitada">Rejeitada</option>
                </select>
              </div>

              <div className="text-xs font-semibold text-slate-500">
                {movimentacoesFiltradas.length} movimentações encontradas
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
              {movimentacoesFiltradas.length === 0 ? (
                <div className="p-12 text-center text-slate-400 font-semibold">
                  <ArrowRightLeft className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>Nenhuma movimentação de dirigente encontrada com os filtros selecionados.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/80 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Congregação / Tipo
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Novo Dirigente
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Dirigente Anterior
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Data Prevista
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Patrimônio
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {movimentacoesFiltradas.map((m) => {
                        const cong = liderancas.find((l) => l.congregacao_id === m.congregacao_destino_id);
                        return (
                          <tr key={m.id} className="hover:bg-slate-50/70 transition">
                            <td className="px-4 py-3.5">
                              <div className="font-bold text-slate-900">
                                {cong?.congregacao_nome || 'Congregação'}
                              </div>
                              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                {m.tipo_movimentacao.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="font-bold text-slate-900">{m.dirigente_novo_nome}</div>
                              {m.dirigente_novo_cargo && (
                                <div className="text-xs text-slate-500 font-medium">
                                  {m.dirigente_novo_cargo}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="font-medium text-slate-700">
                                {m.dirigente_anterior_nome || '—'}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-slate-600 font-medium whitespace-nowrap">
                              {new Date(m.data_prevista).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                  m.status === 'efetivada'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : m.status === 'aprovada'
                                    ? 'bg-blue-100 text-blue-800'
                                    : m.status === 'proposta'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {m.status.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              {m.requer_termo_patrimonial ? (
                                m.termo_patrimonial_id ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Termo Homologado
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    Termo Pendente
                                  </span>
                                )
                              ) : (
                                <span className="text-xs text-slate-400 font-medium">Não requer</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                {m.requer_termo_patrimonial && (
                                  <button
                                    type="button"
                                    title="Emitir Termo Patrimonial de Transferência"
                                    onClick={() => imprimirTermoPatrimonialTransferencia(m)}
                                    className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                                  >
                                    <Printer className="w-4 h-4" />
                                  </button>
                                )}

                                {podeAprovar && m.status === 'proposta' && (
                                  <button
                                    type="button"
                                    onClick={() => handleAprovar(m.id)}
                                    className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition cursor-pointer"
                                  >
                                    Aprovar
                                  </button>
                                )}

                                {podeAprovar && m.status === 'aprovada' && (
                                  <button
                                    type="button"
                                    onClick={() => handleEfetivar(m)}
                                    className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition cursor-pointer"
                                  >
                                    Efetivar Posse
                                  </button>
                                )}
                              </div>
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
        )}

        {/* ═══════════════ ABA 3: PLANEJAMENTO ANUAL DE RODÍZIO ═══════════════ */}
        {activeTab === 'rodizio' && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Planejamento Estratégico de Rodízio Anual
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Coordenação de propostas de transição de liderança preparadas pela Secretaria e submetidas para aprovação da Presidência
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-bold text-slate-500 block">Etapa 1: Preparação</span>
                <p className="text-xs text-slate-600 mt-1">
                  A Secretaria Geral mapeia congregações com mandatos extensos e prepara as propostas de rodízio.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-bold text-slate-500 block">Etapa 2: Deliberação</span>
                <p className="text-xs text-slate-600 mt-1">
                  A Presidência analisa o quadro geral, ajusta datas previstas e aprova formalmente as movimentações.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-bold text-slate-500 block">Etapa 3: Posse & Patrimônio</span>
                <p className="text-xs text-slate-600 mt-1">
                  Na data estipulada, realiza-se a conferência patrimonial in loco, assinatura do termo e posse do dirigente.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Total de propostas de rodízio registradas para este ciclo:{' '}
                <strong>
                  {movimentacoes.filter((m) => m.tipo_movimentacao === 'rodizio_anual').length}
                </strong>
              </span>
              {podePropor && (
                <button
                  type="button"
                  onClick={() => {
                    setPropostaForm((prev) => ({ ...prev, tipo_movimentacao: 'rodizio_anual' }));
                    setModalPropostaOpen(true);
                  }}
                  className="px-3.5 py-2 text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 rounded-xl hover:bg-teal-100 transition cursor-pointer"
                >
                  Adicionar ao Rodízio
                </button>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════ ABA 4: HISTÓRICO DE DESIGNAÇÕES ═══════════════ */}
        {activeTab === 'historico' && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            {historico.length === 0 ? (
              <div className="p-12 text-center text-slate-400 font-semibold">
                <History className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>Nenhuma designação histórica registrada até o momento.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/80 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Congregação
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Dirigente
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Período / Mandato
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Tipo
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Situação
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Motivo de Saída
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {historico.map((h) => {
                      const cong = liderancas.find((l) => l.congregacao_id === h.congregacao_id);
                      return (
                        <tr key={h.id} className="hover:bg-slate-50/70 transition">
                          <td className="px-4 py-3.5 font-bold text-slate-900">
                            {cong?.congregacao_nome || 'Congregação'}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-slate-900">{h.nome_dirigente}</div>
                            {h.cargo_ministerial && (
                              <div className="text-xs text-slate-500 font-medium">
                                {h.cargo_ministerial}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-slate-600 font-medium whitespace-nowrap">
                            {new Date(h.data_posse).toLocaleDateString('pt-BR')} até{' '}
                            {h.data_termino
                              ? new Date(h.data_termino).toLocaleDateString('pt-BR')
                              : 'Vigente'}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className="text-xs font-bold text-slate-600 uppercase">
                              {h.tipo_designacao}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                h.status === 'ativo'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {h.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-slate-500">
                            {h.motivo_saida || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modal de Proposta de Substituição de Liderança (Contextualizada) ── */}
      {modalPropostaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Proposta de Substituição de Liderança
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Secretaria Geral · Submissão de substituição para deliberação da Presidência
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalPropostaOpen(false);
                  setCongregacaoProposta(null);
                  setMinistroSelecionado(null);
                  setTermoBuscaMinistro('');
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Congregação Contextualizada (Bloqueada) */}
              <div className="p-3.5 bg-slate-100/90 border border-slate-200 rounded-2xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-600" />
                    Congregação da Substituição
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                    <Lock className="w-3 h-3 text-slate-500" />
                    Bloqueado para edição
                  </span>
                </div>
                <div className="font-bold text-sm text-slate-900">
                  {congregacaoProposta?.congregacao_nome || 'Congregação Selecionada'}
                </div>
              </div>

              {/* Identificação Clara da Liderança Atual */}
              <div
                className={`p-3.5 rounded-2xl border text-xs space-y-1.5 transition ${
                  congregacaoProposta?.dirigente_atual_nome
                    ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider block ${
                    congregacaoProposta?.dirigente_atual_nome ? 'text-amber-800' : 'text-slate-400'
                  }`}
                >
                  Liderança Atual da Congregação
                </span>
                {congregacaoProposta?.dirigente_atual_nome ? (
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-bold text-slate-900 text-sm block">
                        {congregacaoProposta.dirigente_atual_nome}
                      </span>
                      <span className="text-slate-600 text-[11px] block mt-0.5">
                        Cargo: <strong>{congregacaoProposta.dirigente_atual_cargo || '—'}</strong>
                        {congregacaoProposta.tempo_mandato_meses > 0 && (
                          <span> · Mandato: {formatTempoMandato(congregacaoProposta.tempo_mandato_meses)}</span>
                        )}
                        {congregacaoProposta.data_posse_atual && (
                          <span> (desde {new Date(congregacaoProposta.data_posse_atual).toLocaleDateString('pt-BR')})</span>
                        )}
                      </span>
                    </div>
                    <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                      A ser substituído
                    </span>
                  </div>
                ) : (
                  <div className="text-slate-600 italic">
                    Sem dirigente formalmente designado no momento (congregação vaga). Esta proposta registrará o titular da congregação.
                  </div>
                )}
              </div>

              {/* Tipo de Movimentação e Data Prevista */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tipo de Movimentação *
                  </label>
                  <select
                    value={propostaForm.tipo_movimentacao}
                    onChange={(e) =>
                      setPropostaForm({
                        ...propostaForm,
                        tipo_movimentacao: e.target.value as TipoMovimentacao,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800"
                  >
                    <option value="rodizio_anual">Rodízio Anual</option>
                    <option value="transferencia_extraordinaria">Transferência Extraordinária</option>
                    <option value="substituicao_temporaria">Substituição Temporária</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Data Prevista *</label>
                  <input
                    type="date"
                    value={propostaForm.data_prevista}
                    onChange={(e) =>
                      setPropostaForm({ ...propostaForm, data_prevista: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800"
                  />
                </div>
              </div>

              {/* Busca e Autocomplete de Novo Dirigente (Exclusivo para Ministros) */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">
                  Novo Dirigente Proposto *
                  <span className="font-normal text-slate-400 text-[11px] ml-1.5">
                    (Apenas ministros ordenados/credenciados ativos)
                  </span>
                </label>

                {ministroSelecionado ? (
                  <div className="p-3 bg-emerald-50/80 border border-emerald-300 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <UserCheck className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-sm truncate">{ministroSelecionado.nome}</div>
                        <div className="text-[11px] text-slate-600 flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-teal-800 bg-teal-100/70 px-1.5 py-0.5 rounded">
                            {ministroSelecionado.cargo_ministerial || 'Ministro'}
                          </span>
                          {ministroSelecionado.matricula && (
                            <span className="font-mono">Mat: {ministroSelecionado.matricula}</span>
                          )}
                          <span className="truncate">· Origem: {ministroSelecionado.congregacao_nome || 'Sem congregação'}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleTrocarMinistro}
                      className="px-2.5 py-1 text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition cursor-pointer shrink-0"
                    >
                      Trocar
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={termoBuscaMinistro}
                        onChange={(e) => setTermoBuscaMinistro(e.target.value)}
                        placeholder="Digite ao menos 3 letras para pesquisar ministro (nome, matrícula ou CPF)..."
                        className="w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                      />
                      {buscandoMinistros && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Loader2 className="w-4 h-4 text-teal-600 animate-spin" />
                        </div>
                      )}
                    </div>

                    {/* Dropdown de Resultados */}
                    {termoBuscaMinistro.trim().length >= 3 && !buscandoMinistros && (
                      <div className="mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-y-auto divide-y divide-slate-100 z-30 relative">
                        {ministrosSugestoes.length === 0 ? (
                          <div className="p-3 text-center text-slate-500 text-xs">
                            Nenhum ministro elegível encontrado para &ldquo;{termoBuscaMinistro}&rdquo;. Apenas membros cadastrados no perfil de ministro ativo são elegíveis.
                          </div>
                        ) : (
                          ministrosSugestoes.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => handleSelecionarMinistro(m)}
                              className="w-full p-2.5 text-left hover:bg-teal-50/60 transition flex items-center justify-between cursor-pointer group"
                            >
                              <div className="min-w-0 pr-2">
                                <div className="font-bold text-slate-900 group-hover:text-teal-900 truncate">{m.nome}</div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className="font-medium text-teal-700">{m.cargo_ministerial || 'Ministro'}</span>
                                  {m.matricula && <span className="font-mono">Mat: {m.matricula}</span>}
                                  <span className="truncate">· {m.congregacao_nome || 'Sem congregação'}</span>
                                </div>
                              </div>
                              <span className="text-[11px] font-bold text-teal-700 opacity-0 group-hover:opacity-100 transition shrink-0">
                                Selecionar →
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}

                    {erroBuscaMinistros && (
                      <div className="mt-1 p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-[11px]">
                        {erroBuscaMinistros}
                      </div>
                    )}

                    {termoBuscaMinistro.trim().length > 0 && termoBuscaMinistro.trim().length < 3 && (
                      <p className="text-[11px] text-slate-400 mt-1">
                        Digite pelo menos 3 caracteres para iniciar a consulta de ministros no banco de dados.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Justificativa / Motivo da Proposta */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Justificativa / Motivo da Proposta *
                </label>
                <textarea
                  rows={3}
                  value={propostaForm.motivo}
                  onChange={(e) => setPropostaForm({ ...propostaForm, motivo: e.target.value })}
                  placeholder="Descreva a motivação da substituição para apreciação da Presidência..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setModalPropostaOpen(false);
                  setCongregacaoProposta(null);
                  setMinistroSelecionado(null);
                  setTermoBuscaMinistro('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSalvarProposta}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 transition shadow-sm cursor-pointer"
              >
                Submeter Proposta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de Detalhes da Congregação e Liderança ─────────────────── */}
      {detalheCongregacao && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200/90 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200 mb-1">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Congregação</span>
                </div>
                <h3 className="text-lg font-black text-slate-900">{detalheCongregacao.congregacao_nome}</h3>
              </div>
              <button
                type="button"
                onClick={() => setDetalheCongregacao(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Card Dirigente */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Liderança Atual
                </span>
                {detalheCongregacao.dirigente_atual_nome ? (
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-slate-900">
                      {detalheCongregacao.dirigente_atual_nome}
                    </div>
                    {detalheCongregacao.dirigente_atual_cargo && (
                      <div className="text-teal-700 font-semibold">{detalheCongregacao.dirigente_atual_cargo}</div>
                    )}
                    {detalheCongregacao.dirigente_atual_telefone && (
                      <div className="text-slate-500">Contato: {detalheCongregacao.dirigente_atual_telefone}</div>
                    )}
                    {detalheCongregacao.data_posse_atual && (
                      <div className="text-slate-600 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                        <span>Data de Posse:</span>
                        <span className="font-semibold">
                          {new Date(detalheCongregacao.data_posse_atual).toLocaleDateString('pt-BR')} (
                          {formatTempoMandato(detalheCongregacao.tempo_mandato_meses)})
                        </span>
                      </div>
                    )}
                    {detalheCongregacao.is_acumulacao && (
                      <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        Acumula congregação adicional
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-rose-600 font-semibold py-1">
                    Nenhum dirigente formalmente designado nesta congregação.
                  </div>
                )}
              </div>

              {/* Card Patrimônio */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Patrimônio Vinculado à Congregação
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-slate-400" />
                    Total de Itens:
                  </span>
                  <span className="font-bold text-slate-900 text-sm">
                    {detalheCongregacao.total_bens_patrimonio}{' '}
                    {detalheCongregacao.total_bens_patrimonio === 1 ? 'bem' : 'bens'}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                  <span className="text-slate-600 font-medium">Valor Total Estimado:</span>
                  <span className="font-bold text-teal-800 text-sm">
                    {formatCurrency(detalheCongregacao.valor_patrimonio_estimado)}
                  </span>
                </div>
                {detalheCongregacao.total_bens_patrimonio > 0 ? (
                  <p className="text-[11px] text-slate-500">
                    * Qualquer movimentação exigirá conferência e homologação do Termo Patrimonial.
                  </p>
                ) : (
                  <p className="text-[11px] text-emerald-700 font-medium">
                    Sem bens registrados (mudança de liderança dispensada de termo patrimonial).
                  </p>
                )}
              </div>

              {/* Card Movimentação em Andamento */}
              {detalheCongregacao.movimentacao_em_andamento && (
                <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200/80 space-y-1.5 text-indigo-900">
                  <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">
                    Movimentação em Curso
                  </span>
                  <div className="font-bold text-sm">
                    Novo proposto: {detalheCongregacao.movimentacao_em_andamento.dirigente_novo_nome}
                  </div>
                  <div className="text-xs text-indigo-700">
                    Status: {detalheCongregacao.movimentacao_em_andamento.status.toUpperCase()} · Previsto:{' '}
                    {new Date(detalheCongregacao.movimentacao_em_andamento.data_prevista).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDetalheCongregacao(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
              >
                Fechar
              </button>
              {detalheCongregacao.movimentacao_em_andamento ? (
                <button
                  type="button"
                  disabled
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed select-none opacity-80 flex items-center gap-1.5"
                  title={`Já existe uma mudança em análise para esta congregação (Novo proposto: ${detalheCongregacao.movimentacao_em_andamento.dirigente_novo_nome}).`}
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-slate-400" />
                  <span>Propor Mudança</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const targetCong = detalheCongregacao;
                    setDetalheCongregacao(null);
                    if (targetCong) {
                      abrirPropostaParaCongregacao(targetCong);
                    }
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 transition shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Propor Mudança</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
