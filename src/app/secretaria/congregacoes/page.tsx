'use client';

import PageLayout from '@/components/PageLayout';
import Tabs from '@/components/Tabs';
import Section from '@/components/Section';
import CongregacoesToolbar from '@/components/secretaria/congregacoes/CongregacoesToolbar';
import CongregacoesTable from '@/components/secretaria/congregacoes/CongregacoesTable';
import CongregacaoFormModal from '@/components/secretaria/congregacoes/CongregacaoFormModal';
import { useCongregacoes } from '@/hooks/secretaria/useCongregacoes';

export default function CongregacoesPage() {
  const {
    loading,
    activeTab,
    setActiveTab,
    nomeD1,
    nomeD2,
    nomeD3,
    d1Enabled,
    d2Enabled,
    d3Enabled,
    hierarchyLabel,
    tabs,
    divisoes1,
    divisoes2,
    divisoes3,
    planLimits,
    showFormD1,
    setShowFormD1,
    showFormD2,
    setShowFormD2,
    showFormD3,
    setShowFormD3,
    editingD1,
    setEditingD1,
    editingD2,
    setEditingD2,
    editingD3,
    setEditingD3,
    formD1,
    setFormD1,
    formD2,
    setFormD2,
    formD3,
    setFormD3,
    dirigenteStatus,
    setDirigenteStatus,
    dirigenteMsg,
    setDirigenteMsg,
    dirigenteSelected,
    setDirigenteSelected,
    dirigenteResults,
    setDirigenteResults,
    pastorStatus,
    setPastorStatus,
    pastorMsg,
    setPastorMsg,
    pastorResults,
    setPastorResults,
    geoPreview,
    setGeoPreview,
    fotoIgrejaChange,
    setFotoIgrejaChange,
    fotoIgrejaUrlInput,
    setFotoIgrejaUrlInput,
    availableDivisoes3ForCurrentD2,
    availableDivisoes2ForCurrentD1,
    selectedD1IdsForD2,
    setSelectedD1IdsForD2,
    selectedD2IdsForD3,
    setSelectedD2IdsForD3,
    getMinisterCargo,
    formatCpf,
    formatCampoLabel,
    formatSupervisaoLabel,
    handleSaveD1,
    handleSaveD2,
    handleSaveD3,
    handleDeleteD1,
    handleDeleteD2,
    handleDeleteD3,
    openNewD1,
    setSupervisorStatus,
    setSupervisorMsg,
  } = useCongregacoes();

  if (loading) return <div className="p-8">Carregando...</div>;

  return (
    <PageLayout
      title={`Estrutura Hierárquica - ${hierarchyLabel}`}
      description={
        tabs.length
          ? `Gerenciar a hierarquia do ministério: ${tabs.map(t => t.label).join(', ')}`
          : 'Nenhuma divisão habilitada nas nomenclaturas.'
      }
      activeMenu="estrutura-hierarquica"
    >
      <div className="w-full max-w-7xl mx-auto px-1 sm:px-2 lg:px-4 overflow-x-hidden">
        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
          {tabs.length === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
              <p className="text-yellow-900 font-semibold">⚠️ Nenhuma divisão habilitada</p>
              <p className="text-yellow-700 text-sm mt-2">
                Vá em Configurações → Nomenclaturas e escolha uma divisão diferente de “NENHUMA”.
              </p>
            </div>
          )}

          {/* TAB: 1ª Divisão (Congregações / Igreja) */}
          {d1Enabled && activeTab === 'divisao1' && (
            <Section icon="1️⃣" title={`${nomeD1}s`}>
              <div className="grid grid-cols-1 gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
                  <p className="text-gray-600 text-sm">Total de {nomeD1}s</p>
                  <p className="text-2xl font-bold text-blue-600">{divisoes3.length}</p>
                </div>
              </div>

              <CongregacoesToolbar
                activeTab={activeTab}
                nomeD1={nomeD1}
                nomeD2={nomeD2}
                nomeD3={nomeD3}
                showFormD1={showFormD1}
                showFormD2={showFormD2}
                showFormD3={showFormD3}
                planLimits={planLimits}
                divisoes2Length={divisoes2.length}
                divisoes3Length={divisoes3.length}
                onOpenNewD1={openNewD1}
                onOpenNewD2={() => {
                  if (planLimits.max_divisao2 === 0) return;
                  if (planLimits.max_divisao2 > 0 && divisoes2.length >= planLimits.max_divisao2) return;
                  setShowFormD2(true);
                  setEditingD2(null);
                  setFormD2({
                    supervisao_id: '',
                    nome: '',
                    is_sede: false,
                    informar_pastor: false,
                    pastor_nome_input: '',
                    pastor_member_id: '',
                    pastor_nome: '',
                    pastor_data_posse: '',
                    cep: '',
                    municipio: '',
                    uf: ''
                  });
                  setPastorResults([]);
                  setPastorStatus('idle');
                  setPastorMsg('');
                  setSelectedD1IdsForD2([]);
                }}
                onOpenNewD3={() => {
                  if (planLimits.max_divisao3 === 0) return;
                  if (planLimits.max_divisao3 > 0 && divisoes3.length >= planLimits.max_divisao3) return;
                  setShowFormD3(true);
                  setEditingD3(null);
                  setGeoPreview(null);
                  setDirigenteResults([]);
                  setDirigenteStatus('idle');
                  setDirigenteMsg('');
                  setDirigenteSelected(null);
                  setFormD3({
                    supervisao_id: '',
                    campo_id: '',
                    nome: '',
                    dirigente: '',
                    dirigente_cpf: '',
                    dirigente_cargo: '',
                    dirigente_matricula: '',
                    endereco: '',
                    cep: '',
                    municipio: '',
                    uf: '',
                    status_imovel: '' as any,
                    is_active: true,
                  });
                  if (fotoIgrejaChange.kind === 'file') {
                    try { URL.revokeObjectURL(fotoIgrejaChange.previewUrl); } catch { /* noop */ }
                  }
                  setFotoIgrejaChange({ kind: 'none' });
                  setFotoIgrejaUrlInput('');
                }}
              />

              <CongregacaoFormModal
                activeTab={activeTab}
                nomeD1={nomeD1}
                nomeD2={nomeD2}
                nomeD3={nomeD3}
                showFormD1={showFormD1}
                showFormD2={showFormD2}
                showFormD3={showFormD3}
                editingD1={editingD1}
                editingD2={editingD2}
                editingD3={editingD3}
                formD1={formD1}
                formD2={formD2}
                formD3={formD3}
                setFormD1={setFormD1}
                setFormD2={setFormD2}
                setFormD3={setFormD3}
                dirigenteStatus={dirigenteStatus}
                dirigenteMsg={dirigenteMsg}
                dirigenteSelected={dirigenteSelected}
                dirigenteResults={dirigenteResults}
                pastorStatus={pastorStatus}
                pastorMsg={pastorMsg}
                pastorResults={pastorResults}
                geoPreview={geoPreview}
                fotoIgrejaChange={fotoIgrejaChange}
                fotoIgrejaUrlInput={fotoIgrejaUrlInput}
                setFotoIgrejaUrlInput={setFotoIgrejaUrlInput}
                setFotoIgrejaChange={setFotoIgrejaChange}
                availableDivisoes3ForCurrentD2={availableDivisoes3ForCurrentD2}
                availableDivisoes2ForCurrentD1={availableDivisoes2ForCurrentD1}
                selectedD1IdsForD2={selectedD1IdsForD2}
                setSelectedD1IdsForD2={setSelectedD1IdsForD2}
                selectedD2IdsForD3={selectedD2IdsForD3}
                setSelectedD2IdsForD3={setSelectedD2IdsForD3}
                getMinisterCargo={getMinisterCargo}
                formatCpf={formatCpf}
                handleSaveD1={handleSaveD1}
                handleSaveD2={handleSaveD2}
                handleSaveD3={handleSaveD3}
                onCancelD1={() => {
                  setShowFormD1(false);
                  setEditingD1(null);
                  setFormD1({
                    codigo: '',
                    nome: '',
                    uf: '',
                    informar_supervisor: false,
                    supervisor_cpf_input: '',
                    supervisor_member_id: '',
                    supervisor_matricula: '',
                    supervisor_nome: '',
                    supervisor_cpf: '',
                    supervisor_data_nascimento: '',
                    supervisor_cargo: '',
                    supervisor_celular: ''
                  });
                  setSupervisorStatus('idle');
                  setSupervisorMsg('');
                  setSelectedD2IdsForD3([]);
                }}
                onCancelD2={() => {
                  setShowFormD2(false);
                  setEditingD2(null);
                  setFormD2({
                    supervisao_id: '',
                    nome: '',
                    is_sede: false,
                    informar_pastor: false,
                    pastor_nome_input: '',
                    pastor_member_id: '',
                    pastor_nome: '',
                    pastor_data_posse: '',
                    cep: '',
                    municipio: '',
                    uf: ''
                  });
                  setPastorResults([]);
                  setPastorStatus('idle');
                  setPastorMsg('');
                  setSelectedD1IdsForD2([]);
                }}
                onCancelD3={() => {
                  setShowFormD3(false);
                  setEditingD3(null);
                  setGeoPreview(null);
                  setDirigenteResults([]);
                  setDirigenteStatus('idle');
                  setDirigenteMsg('');
                  setDirigenteSelected(null);
                  setFormD3({
                    supervisao_id: '',
                    campo_id: '',
                    nome: '',
                    dirigente: '',
                    dirigente_cpf: '',
                    dirigente_cargo: '',
                    dirigente_matricula: '',
                    endereco: '',
                    cep: '',
                    municipio: '',
                    uf: '',
                    status_imovel: '' as any,
                    is_active: true,
                  });
                }}
                onSelectDirigente={(m) => {
                  setFormD3((prev: any) => ({
                    ...prev,
                    dirigente: m.name,
                    dirigente_cpf: String(m.cpf || '').trim(),
                    dirigente_cargo: String(getMinisterCargo(m) || '').trim(),
                    dirigente_matricula: String(m.custom_fields?.matricula || '').trim(),
                  }));
                  setDirigenteSelected({ id: m.id, name: m.name });
                  setDirigenteResults([]);
                  setDirigenteStatus('selected');
                  setDirigenteMsg('Dirigente selecionado.');
                }}
                onSelectPastor={(m) => {
                  setFormD2((prev: any) => ({
                    ...prev,
                    pastor_member_id: m.id,
                    pastor_nome: m.name,
                    pastor_nome_input: m.name
                  }));
                  setPastorResults([]);
                  setPastorStatus('selected');
                  setPastorMsg('Pastor selecionado.');
                }}
              />

              <CongregacoesTable
                activeTab={activeTab}
                nomeD1={nomeD1}
                nomeD2={nomeD2}
                nomeD3={nomeD3}
                d2Enabled={d2Enabled}
                d3Enabled={d3Enabled}
                divisoes1={divisoes1}
                divisoes2={divisoes2}
                divisoes3={divisoes3}
                formatCampoLabel={formatCampoLabel}
                formatSupervisaoLabel={formatSupervisaoLabel}
                onEditD1={(d) => {
                  setEditingD1(d);
                  setFormD1({
                    codigo: d.codigo ? String(d.codigo) : '',
                    nome: d.nome || '',
                    uf: '',
                    informar_supervisor: !!(d.supervisor_nome || d.supervisor_member_id),
                    supervisor_cpf_input: '',
                    supervisor_member_id: '',
                    supervisor_matricula: '',
                    supervisor_nome: d.supervisor_nome || '',
                    supervisor_cpf: '',
                    supervisor_data_nascimento: '',
                    supervisor_cargo: '',
                    supervisor_celular: ''
                  });
                  setSelectedD2IdsForD3(divisoes2.filter(c => c.supervisao_id === d.id).map(c => c.id));
                  setSupervisorStatus('idle');
                  setSupervisorMsg('');
                  setShowFormD1(true);
                }}
                onDeleteD1={handleDeleteD1}
                onEditD2={(c) => {
                  setEditingD2(c);
                  setShowFormD2(true);
                  setFormD2({
                    supervisao_id: (c.supervisao_id as any) || '',
                    nome: c.nome || '',
                    is_sede: !!c.is_sede,
                    informar_pastor: !!c.pastor_member_id,
                    pastor_nome_input: c.pastor_nome || '',
                    pastor_member_id: c.pastor_member_id || '',
                    pastor_nome: c.pastor_nome || '',
                    pastor_data_posse: (c.pastor_data_posse as any) || '',
                    cep: '',
                    municipio: (c.municipio as any) || '',
                    uf: ''
                  });
                  setSelectedD1IdsForD2(divisoes3.filter(cg => cg.campo_id === c.id).map(cg => cg.id));
                  setPastorResults([]);
                  setPastorStatus(c.pastor_member_id ? 'selected' : 'idle');
                  setPastorMsg(c.pastor_member_id ? 'Pastor selecionado.' : '');
                }}
                onDeleteD2={handleDeleteD2}
                onEditD3={(cg) => {
                  setEditingD3(cg);
                  setShowFormD3(true);
                  setGeoPreview(null);
                  setDirigenteResults([]);
                  setDirigenteStatus('idle');
                  setDirigenteMsg('');
                  setFormD3({
                    supervisao_id: (cg.supervisao_id as any) || '',
                    campo_id: (cg.campo_id as any) || '',
                    nome: cg.nome || '',
                    dirigente: (cg as any).dirigente || '',
                    dirigente_cpf: (cg as any).dirigente_cpf || '',
                    dirigente_cargo: (cg as any).dirigente_cargo || '',
                    dirigente_matricula: (cg as any).dirigente_matricula || '',
                    endereco: (cg.endereco as any) || '',
                    cep: (cg.cep as any) || '',
                    municipio: (cg.cidade as any) || '',
                    uf: (cg.uf as any) || '',
                    status_imovel: (cg.status_imovel as any) || '',
                    is_active: !!cg.is_active,
                  });
                  const existingDirigente = String((cg as any).dirigente || '').trim();
                  setDirigenteSelected(existingDirigente ? { id: 'existing', name: existingDirigente } : null);
                  if (fotoIgrejaChange.kind === 'file') {
                    try { URL.revokeObjectURL(fotoIgrejaChange.previewUrl); } catch { /* noop */ }
                  }
                  setFotoIgrejaChange({ kind: 'none' });
                  setFotoIgrejaUrlInput('');
                }}
                onDeleteD3={handleDeleteD3}
              />
            </Section>
          )}

          {/* TAB: 2ª Divisão (Campo) */}
          {d2Enabled && activeTab === 'divisao2' && (
            <Section icon="2️⃣" title={`${nomeD2}s`}>
              <div className="grid grid-cols-1 gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
                  <p className="text-gray-600 text-sm">Total de {nomeD2}s</p>
                  <p className="text-2xl font-bold text-blue-600">{divisoes2.length}</p>
                </div>
              </div>

              <CongregacoesToolbar
                activeTab={activeTab}
                nomeD1={nomeD1}
                nomeD2={nomeD2}
                nomeD3={nomeD3}
                showFormD1={showFormD1}
                showFormD2={showFormD2}
                showFormD3={showFormD3}
                planLimits={planLimits}
                divisoes2Length={divisoes2.length}
                divisoes3Length={divisoes3.length}
                onOpenNewD1={openNewD1}
                onOpenNewD2={() => {
                  if (planLimits.max_divisao2 === 0) return;
                  if (planLimits.max_divisao2 > 0 && divisoes2.length >= planLimits.max_divisao2) return;
                  setShowFormD2(true);
                  setEditingD2(null);
                  setFormD2({
                    supervisao_id: '',
                    nome: '',
                    is_sede: false,
                    informar_pastor: false,
                    pastor_nome_input: '',
                    pastor_member_id: '',
                    pastor_nome: '',
                    pastor_data_posse: '',
                    cep: '',
                    municipio: '',
                    uf: ''
                  });
                  setPastorResults([]);
                  setPastorStatus('idle');
                  setPastorMsg('');
                  setSelectedD1IdsForD2([]);
                }}
                onOpenNewD3={() => {
                  if (planLimits.max_divisao3 === 0) return;
                  if (planLimits.max_divisao3 > 0 && divisoes3.length >= planLimits.max_divisao3) return;
                  setShowFormD3(true);
                  setEditingD3(null);
                  setGeoPreview(null);
                  setDirigenteResults([]);
                  setDirigenteStatus('idle');
                  setDirigenteMsg('');
                  setDirigenteSelected(null);
                  setFormD3({
                    supervisao_id: '',
                    campo_id: '',
                    nome: '',
                    dirigente: '',
                    dirigente_cpf: '',
                    dirigente_cargo: '',
                    dirigente_matricula: '',
                    endereco: '',
                    cep: '',
                    municipio: '',
                    uf: '',
                    status_imovel: '' as any,
                    is_active: true,
                  });
                  if (fotoIgrejaChange.kind === 'file') {
                    try { URL.revokeObjectURL(fotoIgrejaChange.previewUrl); } catch { /* noop */ }
                  }
                  setFotoIgrejaChange({ kind: 'none' });
                  setFotoIgrejaUrlInput('');
                }}
              />

              <CongregacaoFormModal
                activeTab={activeTab}
                nomeD1={nomeD1}
                nomeD2={nomeD2}
                nomeD3={nomeD3}
                showFormD1={showFormD1}
                showFormD2={showFormD2}
                showFormD3={showFormD3}
                editingD1={editingD1}
                editingD2={editingD2}
                editingD3={editingD3}
                formD1={formD1}
                formD2={formD2}
                formD3={formD3}
                setFormD1={setFormD1}
                setFormD2={setFormD2}
                setFormD3={setFormD3}
                dirigenteStatus={dirigenteStatus}
                dirigenteMsg={dirigenteMsg}
                dirigenteSelected={dirigenteSelected}
                dirigenteResults={dirigenteResults}
                pastorStatus={pastorStatus}
                pastorMsg={pastorMsg}
                pastorResults={pastorResults}
                geoPreview={geoPreview}
                fotoIgrejaChange={fotoIgrejaChange}
                fotoIgrejaUrlInput={fotoIgrejaUrlInput}
                setFotoIgrejaUrlInput={setFotoIgrejaUrlInput}
                setFotoIgrejaChange={setFotoIgrejaChange}
                availableDivisoes3ForCurrentD2={availableDivisoes3ForCurrentD2}
                availableDivisoes2ForCurrentD1={availableDivisoes2ForCurrentD1}
                selectedD1IdsForD2={selectedD1IdsForD2}
                setSelectedD1IdsForD2={setSelectedD1IdsForD2}
                selectedD2IdsForD3={selectedD2IdsForD3}
                setSelectedD2IdsForD3={setSelectedD2IdsForD3}
                getMinisterCargo={getMinisterCargo}
                formatCpf={formatCpf}
                handleSaveD1={handleSaveD1}
                handleSaveD2={handleSaveD2}
                handleSaveD3={handleSaveD3}
                onCancelD1={() => {
                  setShowFormD1(false);
                  setEditingD1(null);
                  setFormD1({
                    codigo: '',
                    nome: '',
                    uf: '',
                    informar_supervisor: false,
                    supervisor_cpf_input: '',
                    supervisor_member_id: '',
                    supervisor_matricula: '',
                    supervisor_nome: '',
                    supervisor_cpf: '',
                    supervisor_data_nascimento: '',
                    supervisor_cargo: '',
                    supervisor_celular: ''
                  });
                  setSupervisorStatus('idle');
                  setSupervisorMsg('');
                  setSelectedD2IdsForD3([]);
                }}
                onCancelD2={() => {
                  setShowFormD2(false);
                  setEditingD2(null);
                  setFormD2({
                    supervisao_id: '',
                    nome: '',
                    is_sede: false,
                    informar_pastor: false,
                    pastor_nome_input: '',
                    pastor_member_id: '',
                    pastor_nome: '',
                    pastor_data_posse: '',
                    cep: '',
                    municipio: '',
                    uf: ''
                  });
                  setPastorResults([]);
                  setPastorStatus('idle');
                  setPastorMsg('');
                  setSelectedD1IdsForD2([]);
                }}
                onCancelD3={() => {
                  setShowFormD3(false);
                  setEditingD3(null);
                  setGeoPreview(null);
                  setDirigenteResults([]);
                  setDirigenteStatus('idle');
                  setDirigenteMsg('');
                  setDirigenteSelected(null);
                  setFormD3({
                    supervisao_id: '',
                    campo_id: '',
                    nome: '',
                    dirigente: '',
                    dirigente_cpf: '',
                    dirigente_cargo: '',
                    dirigente_matricula: '',
                    endereco: '',
                    cep: '',
                    municipio: '',
                    uf: '',
                    status_imovel: '' as any,
                    is_active: true,
                  });
                }}
                onSelectDirigente={(m) => {
                  setFormD3((prev: any) => ({
                    ...prev,
                    dirigente: m.name,
                    dirigente_cpf: String(m.cpf || '').trim(),
                    dirigente_cargo: String(getMinisterCargo(m) || '').trim(),
                    dirigente_matricula: String(m.custom_fields?.matricula || '').trim(),
                  }));
                  setDirigenteSelected({ id: m.id, name: m.name });
                  setDirigenteResults([]);
                  setDirigenteStatus('selected');
                  setDirigenteMsg('Dirigente selecionado.');
                }}
                onSelectPastor={(m) => {
                  setFormD2((prev: any) => ({
                    ...prev,
                    pastor_member_id: m.id,
                    pastor_nome: m.name,
                    pastor_nome_input: m.name
                  }));
                  setPastorResults([]);
                  setPastorStatus('selected');
                  setPastorMsg('Pastor selecionado.');
                }}
              />

              <CongregacoesTable
                activeTab={activeTab}
                nomeD1={nomeD1}
                nomeD2={nomeD2}
                nomeD3={nomeD3}
                d2Enabled={d2Enabled}
                d3Enabled={d3Enabled}
                divisoes1={divisoes1}
                divisoes2={divisoes2}
                divisoes3={divisoes3}
                formatCampoLabel={formatCampoLabel}
                formatSupervisaoLabel={formatSupervisaoLabel}
                onEditD1={(d) => {
                  setEditingD1(d);
                  setFormD1({
                    codigo: d.codigo ? String(d.codigo) : '',
                    nome: d.nome || '',
                    uf: '',
                    informar_supervisor: !!(d.supervisor_nome || d.supervisor_member_id),
                    supervisor_cpf_input: '',
                    supervisor_member_id: '',
                    supervisor_matricula: '',
                    supervisor_nome: d.supervisor_nome || '',
                    supervisor_cpf: '',
                    supervisor_data_nascimento: '',
                    supervisor_cargo: '',
                    supervisor_celular: ''
                  });
                  setSelectedD2IdsForD3(divisoes2.filter(c => c.supervisao_id === d.id).map(c => c.id));
                  setSupervisorStatus('idle');
                  setSupervisorMsg('');
                  setShowFormD1(true);
                }}
                onDeleteD1={handleDeleteD1}
                onEditD2={(c) => {
                  setEditingD2(c);
                  setShowFormD2(true);
                  setFormD2({
                    supervisao_id: (c.supervisao_id as any) || '',
                    nome: c.nome || '',
                    is_sede: !!c.is_sede,
                    informar_pastor: !!c.pastor_member_id,
                    pastor_nome_input: c.pastor_nome || '',
                    pastor_member_id: c.pastor_member_id || '',
                    pastor_nome: c.pastor_nome || '',
                    pastor_data_posse: (c.pastor_data_posse as any) || '',
                    cep: '',
                    municipio: (c.municipio as any) || '',
                    uf: ''
                  });
                  setSelectedD1IdsForD2(divisoes3.filter(cg => cg.campo_id === c.id).map(cg => cg.id));
                  setPastorResults([]);
                  setPastorStatus(c.pastor_member_id ? 'selected' : 'idle');
                  setPastorMsg(c.pastor_member_id ? 'Pastor selecionado.' : '');
                }}
                onDeleteD2={handleDeleteD2}
                onEditD3={(cg) => {
                  setEditingD3(cg);
                  setShowFormD3(true);
                  setGeoPreview(null);
                  setDirigenteResults([]);
                  setDirigenteStatus('idle');
                  setDirigenteMsg('');
                  setFormD3({
                    supervisao_id: (cg.supervisao_id as any) || '',
                    campo_id: (cg.campo_id as any) || '',
                    nome: cg.nome || '',
                    dirigente: (cg as any).dirigente || '',
                    dirigente_cpf: (cg as any).dirigente_cpf || '',
                    dirigente_cargo: (cg as any).dirigente_cargo || '',
                    dirigente_matricula: (cg as any).dirigente_matricula || '',
                    endereco: (cg.endereco as any) || '',
                    cep: (cg.cep as any) || '',
                    municipio: (cg.cidade as any) || '',
                    uf: (cg.uf as any) || '',
                    status_imovel: (cg.status_imovel as any) || '',
                    is_active: !!cg.is_active,
                  });
                  const existingDirigente = String((cg as any).dirigente || '').trim();
                  setDirigenteSelected(existingDirigente ? { id: 'existing', name: existingDirigente } : null);
                  if (fotoIgrejaChange.kind === 'file') {
                    try { URL.revokeObjectURL(fotoIgrejaChange.previewUrl); } catch { /* noop */ }
                  }
                  setFotoIgrejaChange({ kind: 'none' });
                  setFotoIgrejaUrlInput('');
                }}
                onDeleteD3={handleDeleteD3}
              />
            </Section>
          )}

          {/* TAB: 3ª Divisão (Supervisão) */}
          {d3Enabled && activeTab === 'divisao3' && (
            <Section icon="3️⃣" title={`${nomeD3}s`}>
              <div className="grid grid-cols-1 gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
                  <p className="text-gray-600 text-sm">Total de {nomeD3}s</p>
                  <p className="text-2xl font-bold text-blue-600">{divisoes1.length}</p>
                </div>
              </div>

              <CongregacoesToolbar
                activeTab={activeTab}
                nomeD1={nomeD1}
                nomeD2={nomeD2}
                nomeD3={nomeD3}
                showFormD1={showFormD1}
                showFormD2={showFormD2}
                showFormD3={showFormD3}
                planLimits={planLimits}
                divisoes2Length={divisoes2.length}
                divisoes3Length={divisoes3.length}
                onOpenNewD1={openNewD1}
                onOpenNewD2={() => {
                  if (planLimits.max_divisao2 === 0) return;
                  if (planLimits.max_divisao2 > 0 && divisoes2.length >= planLimits.max_divisao2) return;
                  setShowFormD2(true);
                  setEditingD2(null);
                  setFormD2({
                    supervisao_id: '',
                    nome: '',
                    is_sede: false,
                    informar_pastor: false,
                    pastor_nome_input: '',
                    pastor_member_id: '',
                    pastor_nome: '',
                    pastor_data_posse: '',
                    cep: '',
                    municipio: '',
                    uf: ''
                  });
                  setPastorResults([]);
                  setPastorStatus('idle');
                  setPastorMsg('');
                  setSelectedD1IdsForD2([]);
                }}
                onOpenNewD3={() => {
                  if (planLimits.max_divisao3 === 0) return;
                  if (planLimits.max_divisao3 > 0 && divisoes3.length >= planLimits.max_divisao3) return;
                  setShowFormD3(true);
                  setEditingD3(null);
                  setGeoPreview(null);
                  setDirigenteResults([]);
                  setDirigenteStatus('idle');
                  setDirigenteMsg('');
                  setDirigenteSelected(null);
                  setFormD3({
                    supervisao_id: '',
                    campo_id: '',
                    nome: '',
                    dirigente: '',
                    dirigente_cpf: '',
                    dirigente_cargo: '',
                    dirigente_matricula: '',
                    endereco: '',
                    cep: '',
                    municipio: '',
                    uf: '',
                    status_imovel: '' as any,
                    is_active: true,
                  });
                  if (fotoIgrejaChange.kind === 'file') {
                    try { URL.revokeObjectURL(fotoIgrejaChange.previewUrl); } catch { /* noop */ }
                  }
                  setFotoIgrejaChange({ kind: 'none' });
                  setFotoIgrejaUrlInput('');
                }}
              />

              <CongregacaoFormModal
                activeTab={activeTab}
                nomeD1={nomeD1}
                nomeD2={nomeD2}
                nomeD3={nomeD3}
                showFormD1={showFormD1}
                showFormD2={showFormD2}
                showFormD3={showFormD3}
                editingD1={editingD1}
                editingD2={editingD2}
                editingD3={editingD3}
                formD1={formD1}
                formD2={formD2}
                formD3={formD3}
                setFormD1={setFormD1}
                setFormD2={setFormD2}
                setFormD3={setFormD3}
                dirigenteStatus={dirigenteStatus}
                dirigenteMsg={dirigenteMsg}
                dirigenteSelected={dirigenteSelected}
                dirigenteResults={dirigenteResults}
                pastorStatus={pastorStatus}
                pastorMsg={pastorMsg}
                pastorResults={pastorResults}
                geoPreview={geoPreview}
                fotoIgrejaChange={fotoIgrejaChange}
                fotoIgrejaUrlInput={fotoIgrejaUrlInput}
                setFotoIgrejaUrlInput={setFotoIgrejaUrlInput}
                setFotoIgrejaChange={setFotoIgrejaChange}
                availableDivisoes3ForCurrentD2={availableDivisoes3ForCurrentD2}
                availableDivisoes2ForCurrentD1={availableDivisoes2ForCurrentD1}
                selectedD1IdsForD2={selectedD1IdsForD2}
                setSelectedD1IdsForD2={setSelectedD1IdsForD2}
                selectedD2IdsForD3={selectedD2IdsForD3}
                setSelectedD2IdsForD3={setSelectedD2IdsForD3}
                getMinisterCargo={getMinisterCargo}
                formatCpf={formatCpf}
                handleSaveD1={handleSaveD1}
                handleSaveD2={handleSaveD2}
                handleSaveD3={handleSaveD3}
                onCancelD1={() => {
                  setShowFormD1(false);
                  setEditingD1(null);
                  setFormD1({
                    codigo: '',
                    nome: '',
                    uf: '',
                    informar_supervisor: false,
                    supervisor_cpf_input: '',
                    supervisor_member_id: '',
                    supervisor_matricula: '',
                    supervisor_nome: '',
                    supervisor_cpf: '',
                    supervisor_data_nascimento: '',
                    supervisor_cargo: '',
                    supervisor_celular: ''
                  });
                  setSupervisorStatus('idle');
                  setSupervisorMsg('');
                  setSelectedD2IdsForD3([]);
                }}
                onCancelD2={() => {
                  setShowFormD2(false);
                  setEditingD2(null);
                  setFormD2({
                    supervisao_id: '',
                    nome: '',
                    is_sede: false,
                    informar_pastor: false,
                    pastor_nome_input: '',
                    pastor_member_id: '',
                    pastor_nome: '',
                    pastor_data_posse: '',
                    cep: '',
                    municipio: '',
                    uf: ''
                  });
                  setPastorResults([]);
                  setPastorStatus('idle');
                  setPastorMsg('');
                  setSelectedD1IdsForD2([]);
                }}
                onCancelD3={() => {
                  setShowFormD3(false);
                  setEditingD3(null);
                  setGeoPreview(null);
                  setDirigenteResults([]);
                  setDirigenteStatus('idle');
                  setDirigenteMsg('');
                  setDirigenteSelected(null);
                  setFormD3({
                    supervisao_id: '',
                    campo_id: '',
                    nome: '',
                    dirigente: '',
                    dirigente_cpf: '',
                    dirigente_cargo: '',
                    dirigente_matricula: '',
                    endereco: '',
                    cep: '',
                    municipio: '',
                    uf: '',
                    status_imovel: '' as any,
                    is_active: true,
                  });
                }}
                onSelectDirigente={(m) => {
                  setFormD3((prev: any) => ({
                    ...prev,
                    dirigente: m.name,
                    dirigente_cpf: String(m.cpf || '').trim(),
                    dirigente_cargo: String(getMinisterCargo(m) || '').trim(),
                    dirigente_matricula: String(m.custom_fields?.matricula || '').trim(),
                  }));
                  setDirigenteSelected({ id: m.id, name: m.name });
                  setDirigenteResults([]);
                  setDirigenteStatus('selected');
                  setDirigenteMsg('Dirigente selecionado.');
                }}
                onSelectPastor={(m) => {
                  setFormD2((prev: any) => ({
                    ...prev,
                    pastor_member_id: m.id,
                    pastor_nome: m.name,
                    pastor_nome_input: m.name
                  }));
                  setPastorResults([]);
                  setPastorStatus('selected');
                  setPastorMsg('Pastor selecionado.');
                }}
              />

              <CongregacoesTable
                activeTab={activeTab}
                nomeD1={nomeD1}
                nomeD2={nomeD2}
                nomeD3={nomeD3}
                d2Enabled={d2Enabled}
                d3Enabled={d3Enabled}
                divisoes1={divisoes1}
                divisoes2={divisoes2}
                divisoes3={divisoes3}
                formatCampoLabel={formatCampoLabel}
                formatSupervisaoLabel={formatSupervisaoLabel}
                onEditD1={(d) => {
                  setEditingD1(d);
                  setFormD1({
                    codigo: d.codigo ? String(d.codigo) : '',
                    nome: d.nome || '',
                    uf: '',
                    informar_supervisor: !!(d.supervisor_nome || d.supervisor_member_id),
                    supervisor_cpf_input: '',
                    supervisor_member_id: '',
                    supervisor_matricula: '',
                    supervisor_nome: d.supervisor_nome || '',
                    supervisor_cpf: '',
                    supervisor_data_nascimento: '',
                    supervisor_cargo: '',
                    supervisor_celular: ''
                  });
                  setSelectedD2IdsForD3(divisoes2.filter(c => c.supervisao_id === d.id).map(c => c.id));
                  setSupervisorStatus('idle');
                  setSupervisorMsg('');
                  setShowFormD1(true);
                }}
                onDeleteD1={handleDeleteD1}
                onEditD2={(c) => {
                  setEditingD2(c);
                  setShowFormD2(true);
                  setFormD2({
                    supervisao_id: (c.supervisao_id as any) || '',
                    nome: c.nome || '',
                    is_sede: !!c.is_sede,
                    informar_pastor: !!c.pastor_member_id,
                    pastor_nome_input: c.pastor_nome || '',
                    pastor_member_id: c.pastor_member_id || '',
                    pastor_nome: c.pastor_nome || '',
                    pastor_data_posse: (c.pastor_data_posse as any) || '',
                    cep: '',
                    municipio: (c.municipio as any) || '',
                    uf: ''
                  });
                  setSelectedD1IdsForD2(divisoes3.filter(cg => cg.campo_id === c.id).map(cg => cg.id));
                  setPastorResults([]);
                  setPastorStatus(c.pastor_member_id ? 'selected' : 'idle');
                  setPastorMsg(c.pastor_member_id ? 'Pastor selecionado.' : '');
                }}
                onDeleteD2={handleDeleteD2}
                onEditD3={(cg) => {
                  setEditingD3(cg);
                  setShowFormD3(true);
                  setGeoPreview(null);
                  setDirigenteResults([]);
                  setDirigenteStatus('idle');
                  setDirigenteMsg('');
                  setFormD3({
                    supervisao_id: (cg.supervisao_id as any) || '',
                    campo_id: (cg.campo_id as any) || '',
                    nome: cg.nome || '',
                    dirigente: (cg as any).dirigente || '',
                    dirigente_cpf: (cg as any).dirigente_cpf || '',
                    dirigente_cargo: (cg as any).dirigente_cargo || '',
                    dirigente_matricula: (cg as any).dirigente_matricula || '',
                    endereco: (cg.endereco as any) || '',
                    cep: (cg.cep as any) || '',
                    municipio: (cg.cidade as any) || '',
                    uf: (cg.uf as any) || '',
                    status_imovel: (cg.status_imovel as any) || '',
                    is_active: !!cg.is_active,
                  });
                  const existingDirigente = String((cg as any).dirigente || '').trim();
                  setDirigenteSelected(existingDirigente ? { id: 'existing', name: existingDirigente } : null);
                  if (fotoIgrejaChange.kind === 'file') {
                    try { URL.revokeObjectURL(fotoIgrejaChange.previewUrl); } catch { /* noop */ }
                  }
                  setFotoIgrejaChange({ kind: 'none' });
                  setFotoIgrejaUrlInput('');
                }}
                onDeleteD3={handleDeleteD3}
              />
            </Section>
          )}
        </Tabs>
      </div>
    </PageLayout>
  );
}
