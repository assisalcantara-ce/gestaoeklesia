'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import PageLayout from '@/components/PageLayout';
import Tabs from '@/components/Tabs';
import Section from '@/components/Section';
import NotificationModal from '@/components/NotificationModal';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { useCurrentMinistry } from '@/providers/CurrentMinistryProvider';
import { comissoesService } from '@/services/comissoes-service';
import jsPDF from 'jspdf';
import {
  Comissao,
  ComissaoInput,
  ComissaoIntegrante,
  MinistroDisponivel,
  StatusComissao,
} from '@/types/comissoes';

export default function ComissaoPage() {
  const { ctx, bloqueado } = useRequireModulo('comissao');
  const { ministry } = useCurrentMinistry();
  const planFeatures = usePlanFeatures();

  // Estados de navegação e filtros da lista principal
  const [activeTab, setActiveTab] = useState<'todas' | 'ativas' | 'inativas'>('todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [comissoes, setComissoes] = useState<Comissao[]>([]);

  // Estados dos modais de formulário e confirmação de Comissão
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingComissao, setEditingComissao] = useState<Comissao | null>(null);
  const [formNome, setFormNome] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formStatus, setFormStatus] = useState<StatusComissao>('ativa');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deletingComissao, setDeletingComissao] = useState<Comissao | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Estados do Modal de Gestão de Integrantes da Comissão
  const [selectedComissao, setSelectedComissao] = useState<Comissao | null>(null);
  const [integrantes, setIntegrantes] = useState<ComissaoIntegrante[]>([]);
  const [loadingIntegrantes, setLoadingIntegrantes] = useState(false);
  const [ministrosDisponiveis, setMinistrosDisponiveis] = useState<MinistroDisponivel[]>([]);
  const [loadingMinistros, setLoadingMinistros] = useState(false);

  // Estados de Adicionar Integrante
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [cargoComissao, setCargoComissao] = useState('Membro');
  const [searchMemberFilter, setSearchMemberFilter] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [memberActionError, setMemberActionError] = useState('');

  // Estados de Edição de Cargo do Integrante
  const [editingIntegrante, setEditingIntegrante] = useState<ComissaoIntegrante | null>(null);
  const [editCargoNome, setEditCargoNome] = useState('');
  const [savingCargo, setSavingCargo] = useState(false);

  // Estados de Exclusão de Integrante
  const [deletingIntegrante, setDeletingIntegrante] = useState<ComissaoIntegrante | null>(null);
  const [removingMember, setRemovingMember] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Modal de Notificação
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

  const ministryId = ctx.ministryId;

  // Carregar dados de comissões
  const carregarComissoes = async () => {
    if (!ministryId) return;
    try {
      setLoading(true);
      const data = await comissoesService.listarComissoes(ministryId);
      setComissoes(data);
    } catch (error: any) {
      console.error('Erro ao carregar comissões:', error);
      setNotification({
        isOpen: true,
        title: 'Erro ao carregar',
        message: error?.message || 'Não foi possível carregar a lista de comissões.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ctx.loading && !bloqueado && ministryId) {
      carregarComissoes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.loading, bloqueado, ministryId]);

  // Carregar integrantes da comissão selecionada
  const carregarIntegrantes = async (comissaoId: string) => {
    if (!ministryId) return;
    try {
      setLoadingIntegrantes(true);
      setMemberActionError('');
      const data = await comissoesService.listarIntegrantes(comissaoId, ministryId);
      setIntegrantes(data);
    } catch (error: any) {
      console.error('Erro ao carregar integrantes:', error);
      setMemberActionError('Não foi possível carregar os integrantes da comissão.');
    } finally {
      setLoadingIntegrantes(false);
    }
  };

  // Carregar ministros disponíveis para a comissão
  const carregarMinistrosDisponiveis = async (comissaoId: string) => {
    if (!ministryId) return;
    try {
      setLoadingMinistros(true);
      const data = await comissoesService.listarMinistrosDisponiveis(ministryId, comissaoId);
      setMinistrosDisponiveis(data);
    } catch (error: any) {
      console.error('Erro ao buscar ministros elegíveis:', error);
    } finally {
      setLoadingMinistros(false);
    }
  };

  // Abrir modal de gestão de integrantes
  const handleOpenIntegrantesModal = (comissao: Comissao) => {
    setSelectedComissao(comissao);
    setShowAddMember(false);
    setSelectedMemberId('');
    setCargoComissao('Membro');
    setSearchMemberFilter('');
    setMemberActionError('');
    setEditingIntegrante(null);
    setDeletingIntegrante(null);
    carregarIntegrantes(comissao.id);
    carregarMinistrosDisponiveis(comissao.id);
  };

  // Fechar modal de integrantes e atualizar contagem da lista principal
  const handleCloseIntegrantesModal = async () => {
    setSelectedComissao(null);
    setShowAddMember(false);
    setEditingIntegrante(null);
    setDeletingIntegrante(null);
    await carregarComissoes();
  };

  // Adicionar integrante à comissão
  const handleAddIntegrante = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComissao || !ministryId) return;
    if (!selectedMemberId) {
      setMemberActionError('Selecione um ministro da lista.');
      return;
    }
    if (!cargoComissao.trim()) {
      setMemberActionError('Informe o cargo ou atribuição do ministro nesta comissão.');
      return;
    }

    setAddingMember(true);
    setMemberActionError('');

    try {
      await comissoesService.adicionarIntegrante(ministryId, {
        comissao_id: selectedComissao.id,
        member_id: selectedMemberId,
        cargo: cargoComissao.trim(),
      });

      setNotification({
        isOpen: true,
        title: 'Ministro vinculado',
        message: 'O ministro foi adicionado à comissão com sucesso.',
        type: 'success',
      });

      setSelectedMemberId('');
      setCargoComissao('Membro');
      setShowAddMember(false);

      // Recarregar integrantes e lista de disponíveis
      await carregarIntegrantes(selectedComissao.id);
      await carregarMinistrosDisponiveis(selectedComissao.id);
    } catch (error: any) {
      console.error('Erro ao adicionar integrante:', error);
      setMemberActionError(error?.message || 'Erro ao vincular ministro à comissão.');
    } finally {
      setAddingMember(false);
    }
  };

  // Iniciar edição de cargo de um integrante
  const handleStartEditCargo = (integrante: ComissaoIntegrante) => {
    setEditingIntegrante(integrante);
    setEditCargoNome(integrante.cargo);
    setMemberActionError('');
  };

  // Salvar novo cargo de um integrante
  const handleSaveCargo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIntegrante || !ministryId || !selectedComissao) return;
    if (!editCargoNome.trim()) {
      setMemberActionError('O cargo na comissão não pode ficar vazio.');
      return;
    }

    setSavingCargo(true);
    setMemberActionError('');

    try {
      await comissoesService.atualizarCargoIntegrante(
        editingIntegrante.id,
        ministryId,
        editCargoNome.trim()
      );

      setNotification({
        isOpen: true,
        title: 'Cargo atualizado',
        message: 'O cargo do integrante na comissão foi atualizado com sucesso.',
        type: 'success',
      });

      setEditingIntegrante(null);
      await carregarIntegrantes(selectedComissao.id);
    } catch (error: any) {
      console.error('Erro ao atualizar cargo do integrante:', error);
      setMemberActionError(error?.message || 'Erro ao atualizar cargo.');
    } finally {
      setSavingCargo(false);
    }
  };

  // Confirmar remoção de integrante
  const handleConfirmRemoveIntegrante = async () => {
    if (!deletingIntegrante || !ministryId || !selectedComissao) return;

    setRemovingMember(true);
    setMemberActionError('');

    try {
      await comissoesService.removerIntegrante(deletingIntegrante.id, ministryId);
      setNotification({
        isOpen: true,
        title: 'Integrante desvinculado',
        message: `O ministro foi removido da comissão "${selectedComissao.nome}".`,
        type: 'success',
      });

      setDeletingIntegrante(null);
      await carregarIntegrantes(selectedComissao.id);
      await carregarMinistrosDisponiveis(selectedComissao.id);
    } catch (error: any) {
      console.error('Erro ao remover integrante:', error);
      setMemberActionError(error?.message || 'Erro ao remover integrante da comissão.');
    } finally {
      setRemovingMember(false);
    }
  };

  // Gerar PDF A4 de Identificação da Comissão (para afixação em porta / mural)
  const handleGerarPdf = async () => {
    if (!selectedComissao) return;

    try {
      setGeneratingPdf(true);

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;

      // Dados do Tenant / Ministério
      const tenantNome = (ministry?.name || ministry?.nome || 'CONVENÇÃO / MINISTÉRIO').toUpperCase();
      const tenantCidadeUf = [ministry?.city || ministry?.cidade, ministry?.state || ministry?.estado]
        .filter(Boolean)
        .join(' - ');
      const tenantCnpj = ministry?.cnpj ? `CNPJ: ${ministry.cnpj}` : '';

      // Moldura externa elegante (Borda dupla)
      doc.setDrawColor(18, 59, 99); // #123b63 (Navy)
      doc.setLineWidth(1.2);
      doc.roundedRect(margin, margin, contentWidth, pageHeight - margin * 2, 4, 4, 'S');

      doc.setDrawColor(203, 213, 225); // Slate 300
      doc.setLineWidth(0.4);
      doc.roundedRect(margin + 2.5, margin + 2.5, contentWidth - 5, pageHeight - margin * 2 - 5, 2.5, 2.5, 'S');

      // Topo / Faixa Superior Institucional do Tenant
      doc.setFillColor(18, 59, 99);
      doc.roundedRect(margin + 4, margin + 4, contentWidth - 8, 30, 2, 2, 'F');

      // Título Institucional (Nome do Tenant)
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      const tenantHeaderLines = doc.splitTextToSize(tenantNome, contentWidth - 20);
      doc.text(tenantHeaderLines, pageWidth / 2, margin + 13, { align: 'center' });

      // Subtítulo da Faixa
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(200, 225, 255);
      const subFaixa = [tenantCidadeUf, tenantCnpj].filter(Boolean).join('  •  ') || 'CONVENÇÃO / MINISTÉRIO';
      doc.text(subFaixa, pageWidth / 2, margin + 21, { align: 'center' });

      doc.setFontSize(7.5);
      doc.setTextColor(224, 242, 254);
      doc.text('IDENTIFICAÇÃO DE SALA DE ATENDIMENTO E AVALIAÇÃO', pageWidth / 2, margin + 27, { align: 'center' });

      let currentY = margin + 44;

      // TÍTULO DA COMISSÃO EM DESTAQUE
      doc.setTextColor(18, 59, 99);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      const titleLines = doc.splitTextToSize(selectedComissao.nome.toUpperCase(), contentWidth - 20);
      doc.text(titleLines, pageWidth / 2, currentY, { align: 'center' });
      currentY += titleLines.length * 9;

      // Linha decorativa abaixo do título
      doc.setDrawColor(18, 59, 99);
      doc.setLineWidth(1);
      doc.line(pageWidth / 2 - 40, currentY, pageWidth / 2 + 40, currentY);
      currentY += 6;

      // Descrição / Objetivo da Comissão (se houver)
      if (selectedComissao.descricao) {
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(10);
        const descLines = doc.splitTextToSize(`"${selectedComissao.descricao}"`, contentWidth - 30);
        doc.text(descLines, pageWidth / 2, currentY, { align: 'center' });
        currentY += descLines.length * 5 + 4;
      } else {
        currentY += 4;
      }

      // Banner / Cabeçalho da Seção de Integrantes
      doc.setFillColor(241, 245, 249); // slate-100
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin + 8, currentY, contentWidth - 16, 10, 2, 2, 'FD');

      doc.setTextColor(30, 41, 59); // slate-800
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('MEMBROS INTEGRANTES DA COMISSÃO', pageWidth / 2, currentY + 6.8, { align: 'center' });

      currentY += 15;

      // Listagem dos Integrantes
      if (integrantes.length === 0) {
        doc.setTextColor(148, 163, 184);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(11);
        doc.text('Nenhum integrante vinculado no momento.', pageWidth / 2, currentY + 10, { align: 'center' });
      } else {
        const itemHeight = 22;
        const itemWidth = contentWidth - 16;
        const startX = margin + 8;

        integrantes.forEach((int, index) => {
          // Fundo do card do integrante (alternado suave)
          if (index % 2 === 0) {
            doc.setFillColor(255, 255, 255);
          } else {
            doc.setFillColor(248, 250, 252);
          }

          doc.setDrawColor(226, 232, 240); // slate-200
          doc.setLineWidth(0.4);
          doc.roundedRect(startX, currentY, itemWidth, itemHeight, 2, 2, 'FD');

          // Faixa lateral de destaque no card
          doc.setFillColor(18, 59, 99);
          doc.roundedRect(startX, currentY, 3, itemHeight, 1, 1, 'F');

          // Nome do Ministro
          doc.setTextColor(15, 23, 42); // slate-900
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11.5);
          const nomeText = int.member?.name ? int.member.name.toUpperCase() : 'MINISTRO NÃO INFORMADO';
          doc.text(nomeText, startX + 7, currentY + 8.5);

          // Cargo Ministerial (se houver)
          const cargoMin = int.member?.cargo_ministerial ? int.member.cargo_ministerial.toUpperCase() : 'MINISTRO';
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(71, 85, 105);
          doc.text(`Cargo Ministerial: ${cargoMin}`, startX + 7, currentY + 16.5);

          // Badge com o Cargo na Comissão (à direita)
          const funcaoText = (int.cargo || 'Membro').toUpperCase();
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          const badgeWidth = Math.max(doc.getTextWidth(funcaoText) + 8, 28);
          const badgeX = startX + itemWidth - badgeWidth - 5;
          const badgeY = currentY + 5.5;

          // Fundo azul claro da Badge
          doc.setFillColor(224, 242, 254); // sky-100
          doc.setDrawColor(186, 230, 253); // sky-200
          doc.setLineWidth(0.3);
          doc.roundedRect(badgeX, badgeY, badgeWidth, 10, 2, 2, 'FD');

          // Texto da Badge
          doc.setTextColor(3, 105, 161); // sky-700
          doc.text(funcaoText, badgeX + badgeWidth / 2, badgeY + 6.8, { align: 'center' });

          currentY += itemHeight + 3.5;
        });
      }

      // Rodapé da Folha (Data e Orientação com Identificação do Tenant)
      const footerY = pageHeight - margin - 10;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.line(margin + 8, footerY - 4, pageWidth - margin - 8, footerY - 4);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      const dataEmissao = new Date().toLocaleDateString('pt-BR');
      doc.text(`Documento de Afixação Oficial  •  Emitido em ${dataEmissao}`, margin + 8, footerY + 2);
      doc.text(tenantNome, pageWidth - margin - 8, footerY + 2, { align: 'right' });

      // Salvar / Abrir PDF
      const sanitizedName = selectedComissao.nome.toLowerCase().replace(/[^a-z0-9]/g, '_');
      doc.save(`comissao_${sanitizedName}_porta_a4.pdf`);
    } catch (err: any) {
      console.error('Erro ao gerar PDF da comissão:', err);
      setNotification({
        isOpen: true,
        title: 'Erro ao gerar PDF',
        message: err?.message || 'Não foi possível gerar o PDF da comissão.',
        type: 'error',
      });
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Contadores para os cards do topo
  const totalAtivas = useMemo(
    () => comissoes.filter((c) => c.status === 'ativa').length,
    [comissoes]
  );
  const totalInativas = useMemo(
    () => comissoes.filter((c) => c.status === 'inativa').length,
    [comissoes]
  );
  const totalMembrosEnvolvidos = useMemo(
    () => comissoes.reduce((acc, curr) => acc + (curr.integrantes_count || 0), 0),
    [comissoes]
  );

  // Lista filtrada de comissões
  const comissoesFiltradas = useMemo(() => {
    return comissoes.filter((c) => {
      // Filtro por Tab
      if (activeTab === 'ativas' && c.status !== 'ativa') return false;
      if (activeTab === 'inativas' && c.status !== 'inativa') return false;

      // Filtro por Busca
      if (searchTerm.trim() !== '') {
        const termo = searchTerm.toLowerCase();
        const nomeMatch = c.nome.toLowerCase().includes(termo);
        const descMatch = (c.descricao || '').toLowerCase().includes(termo);
        if (!nomeMatch && !descMatch) return false;
      }

      return true;
    });
  }, [comissoes, activeTab, searchTerm]);

  // Ministros disponíveis filtrados por texto
  const ministrosFiltrados = useMemo(() => {
    if (!searchMemberFilter.trim()) return ministrosDisponiveis;
    const termo = searchMemberFilter.toLowerCase();
    return ministrosDisponiveis.filter(
      (m) =>
        m.name.toLowerCase().includes(termo) ||
        (m.cargo_ministerial && m.cargo_ministerial.toLowerCase().includes(termo))
    );
  }, [ministrosDisponiveis, searchMemberFilter]);

  // Ministro selecionado para vínculo
  const selectedMember = useMemo(() => {
    if (!selectedMemberId) return null;
    return ministrosDisponiveis.find((m) => m.id === selectedMemberId) || null;
  }, [ministrosDisponiveis, selectedMemberId]);

  // Abertura do modal para nova comissão
  const handleOpenNewModal = () => {
    setEditingComissao(null);
    setFormNome('');
    setFormDescricao('');
    setFormStatus('ativa');
    setFormError('');
    setShowFormModal(true);
  };

  // Abertura do modal para edição
  const handleOpenEditModal = (comissao: Comissao) => {
    setEditingComissao(comissao);
    setFormNome(comissao.nome);
    setFormDescricao(comissao.descricao || '');
    setFormStatus(comissao.status);
    setFormError('');
    setShowFormModal(true);
  };

  // Salvar Comissão (Criar ou Atualizar)
  const handleSaveComissao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ministryId) {
      setFormError('Ministério não identificado na sessão.');
      return;
    }

    if (!formNome.trim()) {
      setFormError('O nome da comissão é obrigatório.');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      const payload: ComissaoInput = {
        nome: formNome.trim(),
        descricao: formDescricao.trim() || null,
        status: formStatus,
      };

      if (editingComissao) {
        await comissoesService.atualizarComissao(editingComissao.id, ministryId, payload);
        setNotification({
          isOpen: true,
          title: 'Comissão atualizada',
          message: `A comissão "${payload.nome}" foi atualizada com sucesso.`,
          type: 'success',
        });
      } else {
        await comissoesService.criarComissao(ministryId, payload);
        setNotification({
          isOpen: true,
          title: 'Comissão criada',
          message: `A comissão "${payload.nome}" foi cadastrada com sucesso.`,
          type: 'success',
        });
      }

      setShowFormModal(false);
      await carregarComissoes();
    } catch (error: any) {
      console.error('Erro ao salvar comissão:', error);
      setFormError(error?.message || 'Ocorreu um erro ao salvar a comissão.');
    } finally {
      setSaving(false);
    }
  };

  // Alternar status (Ativar / Inativar diretamente)
  const handleToggleStatus = async (comissao: Comissao) => {
    if (!ministryId) return;
    const novoStatus: StatusComissao = comissao.status === 'ativa' ? 'inativa' : 'ativa';

    try {
      await comissoesService.atualizarComissao(comissao.id, ministryId, {
        status: novoStatus,
      });
      setNotification({
        isOpen: true,
        title: 'Status atualizado',
        message: `A comissão "${comissao.nome}" agora está ${novoStatus === 'ativa' ? 'ativa' : 'inativa'}.`,
        type: 'success',
      });
      await carregarComissoes();
    } catch (error: any) {
      console.error('Erro ao alterar status:', error);
      setNotification({
        isOpen: true,
        title: 'Erro ao atualizar status',
        message: error?.message || 'Não foi possível alterar o status da comissão.',
        type: 'error',
      });
    }
  };

  // Confirmar exclusão de Comissão
  const handleConfirmDelete = async () => {
    if (!deletingComissao || !ministryId) return;

    setDeleting(true);
    try {
      await comissoesService.excluirComissao(deletingComissao.id, ministryId);
      setNotification({
        isOpen: true,
        title: 'Comissão excluída',
        message: `A comissão "${deletingComissao.nome}" foi removida com sucesso.`,
        type: 'success',
      });
      setDeletingComissao(null);
      await carregarComissoes();
    } catch (error: any) {
      console.error('Erro ao excluir comissão:', error);
      setNotification({
        isOpen: true,
        title: 'Erro ao excluir',
        message: error?.message || 'Não foi possível excluir a comissão selecionada.',
        type: 'error',
      });
    } finally {
      setDeleting(false);
    }
  };

  if (ctx.loading || planFeatures.loading) {
    return (
      <PageLayout title="Comissões" description="Gestão de comissões e grupos de trabalho" activeMenu="comissoes">
        <div className="flex items-center justify-center p-16">
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <div className="w-8 h-8 border-4 border-[#123b63] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-medium">Carregando módulo...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!planFeatures.has_modulo_comissao || !planFeatures.hasFeature('ordination_module')) {
    return (
      <PageLayout title="Comissões" description="Gestão de comissões e grupos de trabalho" activeMenu="comissoes">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center max-w-2xl mx-auto space-y-5 my-10">
          <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto text-purple-600 shadow-sm border border-purple-200/60">
            <span className="text-3xl">👥</span>
          </div>
          <div>
            <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 text-xs font-bold rounded-full mb-3">
              Recurso do Plano Intermediário
            </span>
            <h2 className="text-xl font-bold text-slate-800">Módulo Comissões Indisponível no seu Plano</h2>
          </div>
          <p className="text-slate-600 text-base font-semibold leading-relaxed max-w-lg mx-auto">
            A Gestão de Comissões e Grupos de Trabalho está disponível a partir do Plano Intermediário.
          </p>
          <p className="text-slate-500 text-xs leading-relaxed max-w-md mx-auto">
            Faça o upgrade para criar e gerenciar comissões especiais, acompanhamento de processos e equipes ministeriais.
          </p>
          <div className="pt-3">
            <a
              href="/configuracoes"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#123b63] text-white text-sm font-semibold rounded-xl hover:bg-[#1a4f85] transition shadow-md hover:shadow-lg"
            >
              Fazer Upgrade / Conhecer Planos
            </a>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (bloqueado) return null;

  const tabs = [
    { id: 'todas', label: 'Todas as Comissões', icon: '📋' },
    { id: 'ativas', label: 'Ativas', icon: '✅' },
    { id: 'inativas', label: 'Inativas', icon: '❌' },
  ];

  return (
    <PageLayout
      title="Comissões"
      description="Gestão de comissões e grupos de trabalho institucionais"
      activeMenu="comissoes"
    >
      <div className="max-w-7xl mx-auto w-full space-y-6">
        {/* CARDS DE INDICADORES */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 border-l-4 border-l-emerald-500">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Comissões Ativas</p>
            <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-1">{totalAtivas}</p>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 border-l-4 border-l-blue-500">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Integrantes Vinculados</p>
            <p className="text-2xl sm:text-3xl font-bold text-[#123b63] mt-1">{totalMembrosEnvolvidos}</p>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 border-l-4 border-l-slate-400">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Comissões Inativas</p>
            <p className="text-2xl sm:text-3xl font-bold text-slate-600 mt-1">{totalInativas}</p>
          </div>
        </div>

        {/* TABS E ÁREA PRINCIPAL */}
        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as any)}>
          <Section icon="👥" title="Comissões Cadastradas">
            {/* BARRA DE AÇÕES: BUSCA E BOTÃO NOVO */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
              <div className="relative flex-1 max-w-md">
                <input
                  type="text"
                  placeholder="Buscar por nome ou finalidade..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63] focus:border-transparent"
                />
                <span className="absolute left-3 top-2.5 text-slate-400 text-sm">🔍</span>
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                onClick={handleOpenNewModal}
                className="inline-flex items-center justify-center gap-2 bg-[#123b63] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition shadow-sm hover:shadow"
              >
                <span>➕</span> Nova Comissão
              </button>
            </div>

            {/* TABELA / LISTAGEM */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-2">
                <div className="w-8 h-8 border-3 border-[#123b63] border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm">Carregando comissões...</p>
              </div>
            ) : comissoesFiltradas.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-10 text-center space-y-3 my-4">
                <div className="text-4xl">👥</div>
                <p className="text-base font-semibold text-slate-700">
                  {searchTerm
                    ? 'Nenhuma comissão encontrada para a busca informada.'
                    : activeTab === 'ativas'
                    ? 'Nenhuma comissão ativa cadastrada.'
                    : activeTab === 'inativas'
                    ? 'Nenhuma comissão inativa.'
                    : 'Nenhuma comissão cadastrada no ministério.'}
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {searchTerm
                    ? 'Tente pesquisar por outro termo ou limpe o campo de busca.'
                    : 'Clique no botão acima para registrar a primeira comissão (ex: Comissão de Ética, Avaliação, Eventos).'}
                </p>
                {!searchTerm && (
                  <div className="pt-2">
                    <button
                      onClick={handleOpenNewModal}
                      className="bg-[#123b63] text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#0f2a45] transition"
                    >
                      + Cadastrar Comissão
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-slate-700 font-semibold">
                    <tr>
                      <th className="px-4 py-3.5">Nome da Comissão</th>
                      <th className="px-4 py-3.5">Finalidade / Descrição</th>
                      <th className="px-4 py-3.5 text-center">Integrantes</th>
                      <th className="px-4 py-3.5 text-center">Status</th>
                      <th className="px-4 py-3.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {comissoesFiltradas.map((comissao) => {
                      const isAtiva = comissao.status === 'ativa';
                      return (
                        <tr key={comissao.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3.5 font-medium text-slate-900 whitespace-nowrap">
                            {comissao.nome}
                          </td>
                          <td className="px-4 py-3.5 text-slate-600 max-w-xs md:max-w-md truncate">
                            {comissao.descricao || <span className="text-slate-400 italic">Sem descrição</span>}
                          </td>
                          <td className="px-4 py-3.5 text-center whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              <span>👥</span> {comissao.integrantes_count || 0}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center whitespace-nowrap">
                            <button
                              onClick={() => handleToggleStatus(comissao)}
                              title="Clique para alternar o status"
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition ${
                                isAtiva
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${isAtiva ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                              {isAtiva ? 'Ativa' : 'Inativa'}
                            </button>
                          </td>
                          <td className="px-4 py-3.5 text-right whitespace-nowrap space-x-1">
                            <button
                              onClick={() => handleOpenIntegrantesModal(comissao)}
                              className="text-emerald-700 hover:text-emerald-900 font-medium text-xs p-1.5 hover:bg-emerald-50 rounded inline-flex items-center gap-1"
                              title="Gerenciar ministros da comissão"
                            >
                              👥 Integrantes
                            </button>
                            <button
                              onClick={() => handleOpenEditModal(comissao)}
                              className="text-blue-600 hover:text-blue-800 font-medium text-xs p-1.5 hover:bg-blue-50 rounded"
                              title="Editar dados da comissão"
                            >
                              ✏️ Editar
                            </button>
                            <button
                              onClick={() => setDeletingComissao(comissao)}
                              className="text-red-600 hover:text-red-800 font-medium text-xs p-1.5 hover:bg-red-50 rounded"
                              title="Excluir comissão"
                            >
                              🗑️ Excluir
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </Tabs>

        {/* MODAL DE GESTÃO DA COMPOSIÇÃO DE INTEGRANTES */}
        {selectedComissao && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
              {/* Header do Modal */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">👥</span>
                    <h3 className="text-base font-bold text-slate-800">
                      Composição: {selectedComissao.nome}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        selectedComissao.status === 'ativa'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {selectedComissao.status === 'ativa' ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>
                  {selectedComissao.descricao && (
                    <p className="text-xs text-slate-500 max-w-2xl truncate">
                      {selectedComissao.descricao}
                    </p>
                  )}
                </div>
                <button
                  onClick={handleCloseIntegrantesModal}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg text-sm transition hover:bg-slate-100"
                >
                  ✕
                </button>
              </div>

              {/* Corpo do Modal */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {memberActionError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-medium text-red-700 flex items-center justify-between">
                    <span>{memberActionError}</span>
                    <button
                      onClick={() => setMemberActionError('')}
                      className="text-red-500 hover:text-red-800 font-bold ml-2"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Bloco: Adicionar Ministro */}
                {!showAddMember ? (
                  <div className="flex items-center justify-between bg-blue-50/60 border border-blue-100 rounded-xl p-4">
                    <div>
                      <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                        Adicionar Ministro à Comissão
                      </h4>
                      <p className="text-xs text-blue-700">
                        Vincule ministros cadastrados no ministério e defina a função exercida.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setShowAddMember(true);
                        setMemberActionError('');
                      }}
                      className="inline-flex items-center gap-1.5 bg-[#123b63] text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#0f2a45] transition shadow-xs"
                    >
                      <span>➕</span> Vincular Ministro
                    </button>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Vincular Ministro Existente
                      </h4>
                      <button
                        onClick={() => {
                          setShowAddMember(false);
                          setSelectedMemberId('');
                          setCargoComissao('Membro');
                          setMemberActionError('');
                        }}
                        className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
                      >
                        Cancelar
                      </button>
                    </div>

                    <form onSubmit={handleAddIntegrante} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Seleção Integrada do Ministro */}
                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                            Ministro a Vincular <span className="text-red-500">*</span>
                          </label>
                          {loadingMinistros ? (
                            <div className="flex items-center gap-2 text-xs text-slate-500 py-3">
                              <div className="w-4 h-4 border-2 border-[#123b63] border-t-transparent rounded-full animate-spin"></div>
                              <span>Carregando ministros disponíveis...</span>
                            </div>
                          ) : ministrosDisponiveis.length === 0 ? (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                              Não há outros ministros cadastrados disponíveis para esta comissão.
                            </div>
                          ) : selectedMember ? (
                            /* Ministro Selecionado - Visualização de Confirmação e Troca */
                            <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-8 h-8 rounded-full bg-[#123b63] text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                                    {selectedMember.foto_url ? (
                                      <Image
                                        src={selectedMember.foto_url}
                                        alt={selectedMember.name}
                                        width={32}
                                        height={32}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      selectedMember.name.charAt(0) || 'M'
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-900 truncate">
                                      {selectedMember.name}
                                    </p>
                                    <p className="text-[11px] text-blue-700">
                                      {selectedMember.cargo_ministerial || 'Ministro'}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setSelectedMemberId('')}
                                  className="text-xs text-blue-700 hover:text-blue-900 font-semibold px-2 py-1 hover:bg-blue-100 rounded transition shrink-0"
                                >
                                  Trocar ministro
                                </button>
                              </div>
                              <div className="text-[10px] text-emerald-700 font-medium flex items-center gap-1 pt-0.5 border-t border-blue-100">
                                <span>✓</span> Ministro selecionado e pronto para vínculo
                              </div>
                            </div>
                          ) : (
                            /* Campo de Busca Integrado com Lista Imediata de Resultados */
                            <div className="space-y-2">
                              <div className="relative">
                                <input
                                  type="text"
                                  placeholder="Digite o nome ou cargo do ministro..."
                                  value={searchMemberFilter}
                                  onChange={(e) => setSearchMemberFilter(e.target.value)}
                                  className="w-full pl-8 pr-7 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#123b63] focus:border-transparent bg-white shadow-2xs"
                                />
                                <span className="absolute left-2.5 top-2.5 text-slate-400 text-xs">🔍</span>
                                {searchMemberFilter && (
                                  <button
                                    type="button"
                                    onClick={() => setSearchMemberFilter('')}
                                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>

                              {/* Lista de Resultados Imediatos */}
                              <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-slate-100 bg-white shadow-inner">
                                {ministrosFiltrados.length === 0 ? (
                                  <div className="p-4 text-center text-xs text-slate-500 space-y-1">
                                    <p className="font-semibold text-slate-700">Nenhum ministro encontrado</p>
                                    <p className="text-[11px] text-slate-400">
                                      Verifique se o nome digitado está correto.
                                    </p>
                                  </div>
                                ) : (
                                  ministrosFiltrados.map((m) => (
                                    <button
                                      key={m.id}
                                      type="button"
                                      onClick={() => {
                                        setSelectedMemberId(m.id);
                                        setMemberActionError('');
                                      }}
                                      className="w-full text-left px-3 py-2 flex items-center justify-between hover:bg-blue-50/70 transition group"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0 overflow-hidden">
                                          {m.foto_url ? (
                                            <Image
                                              src={m.foto_url}
                                              alt={m.name}
                                              width={24}
                                              height={24}
                                              className="w-full h-full object-cover"
                                            />
                                          ) : (
                                            m.name.charAt(0) || 'M'
                                          )}
                                        </div>
                                        <div className="min-w-0">
                                          <p className="text-xs font-medium text-slate-800 group-hover:text-blue-950 truncate">
                                            {m.name}
                                          </p>
                                          {m.cargo_ministerial && (
                                            <p className="text-[10px] text-slate-500 group-hover:text-blue-700">
                                              {m.cargo_ministerial}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                      <span className="text-[11px] text-blue-600 font-semibold opacity-0 group-hover:opacity-100 transition shrink-0 ml-2">
                                        Selecionar ➔
                                      </span>
                                    </button>
                                  ))
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400">
                                {searchMemberFilter
                                  ? `${ministrosFiltrados.length} ministro(s) encontrado(s). Clique para selecionar.`
                                  : `Exibindo ${ministrosDisponiveis.length} ministro(s) disponível(is). Digite para filtrar ou selecione na lista.`}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Cargo na Comissão */}
                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                            Cargo nesta Comissão <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Ex: Presidente, Relator, Secretário, Membro..."
                            value={cargoComissao}
                            onChange={(e) => setCargoComissao(e.target.value)}
                            list="cargos-comissao-sugestoes"
                            className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#123b63]"
                          />
                          <datalist id="cargos-comissao-sugestoes">
                            <option value="Presidente" />
                            <option value="Vice-Presidente" />
                            <option value="Relator" />
                            <option value="Secretário" />
                            <option value="Vogal" />
                            <option value="Membro" />
                            <option value="Consultor" />
                          </datalist>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Este cargo é específico desta comissão e não altera o cargo ministerial global do ministro.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowAddMember(false)}
                          className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={addingMember || !selectedMemberId}
                          className="px-4 py-1.5 bg-[#123b63] text-white rounded-lg text-xs font-semibold hover:bg-[#0f2a45] transition flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {addingMember ? 'Adicionando...' : 'Adicionar à Comissão'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Lista de Integrantes Atuais */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Integrantes Atuais ({integrantes.length})
                    </h4>
                  </div>

                  {loadingIntegrantes ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
                      <div className="w-6 h-6 border-2 border-[#123b63] border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-xs">Carregando integrantes...</p>
                    </div>
                  ) : integrantes.length === 0 ? (
                    <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center space-y-2">
                      <div className="text-3xl">👥</div>
                      <p className="text-xs font-semibold text-slate-700">Nenhum integrante vinculado ainda.</p>
                      <p className="text-[11px] text-slate-500">
                        Utilize o botão acima para adicionar os ministros participantes e seus respectivos cargos.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                        <thead className="bg-slate-50 text-slate-700 font-semibold">
                          <tr>
                            <th className="px-4 py-3">Ministro</th>
                            <th className="px-4 py-3">Cargo Ministerial</th>
                            <th className="px-4 py-3">Cargo na Comissão</th>
                            <th className="px-4 py-3 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {integrantes.map((int) => {
                            const isEditingThis = editingIntegrante?.id === int.id;
                            return (
                              <tr key={int.id} className="hover:bg-slate-50/60 transition-colors">
                                <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold overflow-hidden shrink-0">
                                      {int.member?.foto_url ? (
                                        <Image
                                          src={int.member.foto_url}
                                          alt={int.member.name}
                                          width={28}
                                          height={28}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        int.member?.name?.charAt(0) || 'M'
                                      )}
                                    </div>
                                    <div>
                                      <p className="font-semibold text-slate-800">{int.member?.name || 'Ministro'}</p>
                                      {int.member?.email && (
                                        <p className="text-[10px] text-slate-400">{int.member.email}</p>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                                    {int.member?.cargo_ministerial || 'Ministro'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-slate-800 whitespace-nowrap">
                                  {isEditingThis ? (
                                    <form onSubmit={handleSaveCargo} className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        required
                                        value={editCargoNome}
                                        onChange={(e) => setEditCargoNome(e.target.value)}
                                        className="px-2 py-1 border border-blue-400 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-36"
                                        autoFocus
                                      />
                                      <button
                                        type="submit"
                                        disabled={savingCargo}
                                        className="text-emerald-600 hover:text-emerald-800 font-bold text-xs"
                                        title="Salvar cargo"
                                      >
                                        ✓
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingIntegrante(null)}
                                        className="text-slate-400 hover:text-slate-600 font-bold text-xs"
                                        title="Cancelar"
                                      >
                                        ✕
                                      </button>
                                    </form>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 font-semibold text-blue-900 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                                      🏷️ {int.cargo}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                                  {!isEditingThis && (
                                    <>
                                      <button
                                        onClick={() => handleStartEditCargo(int)}
                                        className="text-blue-600 hover:text-blue-800 font-medium text-xs p-1 hover:bg-blue-50 rounded"
                                        title="Editar cargo nesta comissão"
                                      >
                                        ✏️ Editar Cargo
                                      </button>
                                      <button
                                        onClick={() => setDeletingIntegrante(int)}
                                        className="text-red-600 hover:text-red-800 font-medium text-xs p-1 hover:bg-red-50 rounded"
                                        title="Remover integrante da comissão"
                                      >
                                        🗑️ Remover
                                      </button>
                                    </>
                                  )}
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

              {/* Footer do Modal */}
              <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-slate-50/50">
                <span className="text-xs text-slate-500">
                  Total de {integrantes.length} ministro(s) vinculado(s)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleGerarPdf}
                    disabled={generatingPdf}
                    className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-xs transition disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    <span>📄</span>
                    <span>Gerar PDF (A4)</span>
                  </button>
                  <button
                    onClick={handleCloseIntegrantesModal}
                    className="px-4 py-1.5 bg-[#123b63] text-white rounded-lg text-xs font-semibold hover:bg-[#0f2a45] transition"
                  >
                    Concluir / Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DE CONFIRMAÇÃO DE REMOÇÃO DE INTEGRANTE */}
        {deletingIntegrante && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 border border-slate-100 space-y-4">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto text-lg font-bold">
                ⚠️
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-sm font-bold text-slate-900">Remover Integrante</h3>
                <p className="text-xs text-slate-600">
                  Deseja desvincular o ministro <strong className="text-slate-800">{deletingIntegrante.member?.name}</strong> da comissão <strong className="text-slate-800">{selectedComissao?.nome}</strong>?
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  O histórico e cadastro do ministro no sistema continuarão intactos.
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingIntegrante(null)}
                  disabled={removingMember}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRemoveIntegrante}
                  disabled={removingMember}
                  className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition"
                >
                  {removingMember ? 'Removendo...' : 'Sim, Remover'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DE CADASTRO / EDIÇÃO DE COMISSÃO */}
        {showFormModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-100">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-base font-bold text-slate-800">
                  {editingComissao ? 'Editar Comissão' : 'Nova Comissão'}
                </h3>
                <button
                  onClick={() => setShowFormModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg text-sm"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveComissao} className="p-6 space-y-4">
                {formError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-medium text-red-700">
                    {formError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Nome da Comissão <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Comissão de Avaliação Ministerial"
                    value={formNome}
                    onChange={(e) => setFormNome(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63] focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Finalidade / Descrição
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Descreva a finalidade, atribuições e objetivos desta comissão..."
                    value={formDescricao}
                    onChange={(e) => setFormDescricao(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63] focus:border-transparent resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as StatusComissao)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63] focus:border-transparent bg-white"
                  >
                    <option value="ativa">Ativa</option>
                    <option value="inativa">Inativa</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowFormModal(false)}
                    disabled={saving}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 bg-[#123b63] text-white rounded-lg text-xs font-semibold hover:bg-[#0f2a45] transition flex items-center gap-2"
                  >
                    {saving ? 'Salvando...' : editingComissao ? 'Salvar Alterações' : 'Criar Comissão'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE COMISSÃO */}
        {deletingComissao && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-slate-100 space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto text-xl font-bold">
                ⚠️
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-base font-bold text-slate-900">Confirmar Exclusão</h3>
                <p className="text-sm text-slate-600">
                  Tem certeza que deseja excluir a comissão <strong className="text-slate-800">"{deletingComissao.nome}"</strong>?
                </p>
                {deletingComissao.integrantes_count && deletingComissao.integrantes_count > 0 ? (
                  <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                    Atenção: esta comissão possui {deletingComissao.integrantes_count} integrante(s) vinculado(s). A exclusão removerá esses vínculos.
                  </p>
                ) : null}
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingComissao(null)}
                  disabled={deleting}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  className="px-5 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition"
                >
                  {deleting ? 'Excluindo...' : 'Sim, Excluir'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DE NOTIFICAÇÃO PADRÃO */}
        <NotificationModal
          isOpen={notification.isOpen}
          title={notification.title}
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification((prev) => ({ ...prev, isOpen: false }))}
        />
      </div>
    </PageLayout>
  );
}
