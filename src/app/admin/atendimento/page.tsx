'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { Phone, Clock, DollarSign, FileText, CheckCircle, XCircle, Search, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useAppDialog } from '@/providers/AppDialogProvider';
import { formatCpfOrCnpj, formatPhone } from '@/lib/mascaras';

interface PreRegistration {
  id: string;
  ministry_name: string;
  pastor_name: string;
  responsible_name?: string;
  email: string;
  whatsapp: string;
  phone?: string;
  website?: string;
  cpf_cnpj: string;
  quantity_temples: number;
  quantity_members: number;
  status: string;
  trial_expires_at: string;
  created_at: string;
  address_zip?: string;
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_city?: string;
  address_state?: string;
  description?: string;
  plan?: string;
}

interface AttendanceRecord {
  id: string;
  pre_registration_id: string;
  status: string;
  notes: string | null;
  assigned_to: string | null;
  last_contact_at: string | null;
  next_followup_at: string | null;
  created_at: string;
  updated_at: string;
  pre_registration: PreRegistration;
  attendance_history: Array<{ id: string; to_status: string; changed_by: string; created_at: string }>;
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  not_contacted: {
    label: '❌ Não Atendido',
    color: 'bg-gray-100 text-gray-800 border border-gray-300',
    icon: <Clock className="w-4 h-4" />,
  },
  in_progress: {
    label: '📞 Em Atendimento',
    color: 'bg-blue-100 text-blue-800 border border-blue-300',
    icon: <Phone className="w-4 h-4" />,
  },
  budget_sent: {
    label: '💰 Orçamento Enviado',
    color: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
    icon: <DollarSign className="w-4 h-4" />,
  },
  contract_generating: {
    label: '📄 Gerando Contrato',
    color: 'bg-purple-100 text-purple-800 border border-purple-300',
    icon: <FileText className="w-4 h-4" />,
  },
  finalized_positive: {
    label: '✅ Finalizado - Positivo',
    color: 'bg-green-100 text-green-800 border border-green-300',
    icon: <CheckCircle className="w-4 h-4" />,
  },
  finalized_negative: {
    label: '❌ Finalizado - Negativo',
    color: 'bg-red-100 text-red-800 border border-red-300',
    icon: <XCircle className="w-4 h-4" />,
  },
};

export default function AttendancePanelPage() {
  const dialog = useAppDialog();
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAttendance, setSelectedAttendance] = useState<AttendanceRecord | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalStatus, setModalStatus] = useState('');
  const [modalNotes, setModalNotes] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [editingData, setEditingData] = useState<any>({
    // Informações Básicas
    ministry_name: '',
    cpf_cnpj: '',
    
    // Contatos
    phone: '',
    email: '',
    whatsapp: '',
    website: '',
    
    // Responsável
    responsible_name: '',
    pastor_name: '',
    
    // Endereço
    address_zip: '',
    address_street: '',
    address_number: '',
    address_complement: '',
    address_city: '',
    address_state: '',
    
    // Estrutura
    quantity_temples: 0,
    quantity_members: 0,
    
    // Informações Adicionais
    description: '',
    plan: 'starter'
  });

  const fetchAttendances = async (status?: string) => {
    try {
      setLoading(true);
      let url = '/api/v1/admin/attendance?limit=50';
      if (status) {
        url += `&status=${status}`;
      }

      const response = await fetch(url);
      const result = await response.json();

      if (result.success) {
        setAttendances(result.data || []);
      } else {
        setError(result.error || 'Erro ao carregar atendimentos');
      }
    } catch (err) {
      console.error('Error fetching attendances:', err);
      setError('Erro ao conectar com servidor');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendances();
    
    // Se tem parâmetro "focus", abre o modal automaticamente
    const params = new URLSearchParams(window.location.search);
    const focusId = params.get('focus');
    
    if (focusId) {
      // Aguardar um pouco para os dados carregarem
      setTimeout(() => {
        const focusedAttendance = attendances.find(a => a.pre_registration_id === focusId);
        if (focusedAttendance) {
          handleOpenModal(focusedAttendance);
        }
      }, 500);
    }
  }, []);

  const handleStatusFilter = (status: string) => {
    setSelectedStatus(status);
    setCurrentPage(1); // Reset para primeira página ao filtrar
    fetchAttendances(status || undefined);
  };

  const handleOpenModal = (attendance: AttendanceRecord) => {
    setSelectedAttendance(attendance);
    setModalStatus(attendance.status);
    setModalNotes(attendance.notes || '');
    setEditingData({
      // Informações Básicas
      ministry_name: attendance.pre_registration?.ministry_name || '',
      cpf_cnpj: attendance.pre_registration?.cpf_cnpj || '',
      
      // Contatos
      phone: attendance.pre_registration?.phone || '',
      email: attendance.pre_registration?.email || '',
      whatsapp: attendance.pre_registration?.whatsapp || '',
      website: attendance.pre_registration?.website || '',
      
      // Responsável
      responsible_name: attendance.pre_registration?.responsible_name || '',
      pastor_name: attendance.pre_registration?.pastor_name || '',
      
      // Endereço
      address_zip: attendance.pre_registration?.address_zip || '',
      address_street: attendance.pre_registration?.address_street || '',
      address_number: attendance.pre_registration?.address_number || '',
      address_complement: attendance.pre_registration?.address_complement || '',
      address_city: attendance.pre_registration?.address_city || '',
      address_state: attendance.pre_registration?.address_state || '',
      
      // Estrutura
      quantity_temples: attendance.pre_registration?.quantity_temples || 0,
      quantity_members: attendance.pre_registration?.quantity_members || 0,
      
      // Informações Adicionais
      description: attendance.pre_registration?.description || '',
      plan: attendance.pre_registration?.plan || 'starter'
    });
    setShowModal(true);
  };

  const handleUpdateAttendance = async () => {
    if (!selectedAttendance) return;

    try {
      // Primeiro, atualiza o attendance_status
      const attendanceResponse = await fetch('/api/v1/admin/attendance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedAttendance.id,
          status: modalStatus,
          notes: modalNotes,
          last_contact_at: new Date().toISOString(),
        }),
      });

      const attendanceResult = await attendanceResponse.json();
      if (!attendanceResult.success) {
        await dialog.alert({ title: 'Erro', type: 'error', message: 'Erro ao atualizar: ' + attendanceResult.error });
        return;
      }

      // Depois, atualiza os dados do pré-registro se foram editados
      if (selectedAttendance.pre_registration_id) {
        const preRegResponse = await fetch('/api/v1/admin/pre-registrations', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: selectedAttendance.pre_registration_id,
            ministry_name: editingData.ministry_name,
            pastor_name: editingData.pastor_name,
            email: editingData.email,
            whatsapp: editingData.whatsapp,
            quantity_temples: parseInt(editingData.quantity_temples) || 0,
            quantity_members: parseInt(editingData.quantity_members) || 0,
          }),
        });

        const preRegResult = await preRegResponse.json();
        if (!preRegResult.success) {
          console.warn('Aviso: dados do assinante não foram atualizados:', preRegResult.error);
        }
      }

      setShowModal(false);
      fetchAttendances(selectedStatus || undefined);
    } catch (error) {
      console.error('Error updating attendance:', error);
      await dialog.alert({ title: 'Erro', type: 'error', message: 'Erro ao conectar com servidor' });
    }
  };

  const handleGenerateBudget = async () => {
    if (!selectedAttendance) return;

    try {
      const response = await fetch('/api/v1/admin/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pre_registration_id: selectedAttendance.pre_registration_id,
          type: 'budget',
          ministry_name: editingData.ministry_name,
          pastor_name: editingData.pastor_name,
          email: editingData.email,
          quantity_temples: editingData.quantity_temples,
          quantity_members: editingData.quantity_members,
          plan: editingData.plan,
        }),
      });

      const result = await response.json();
      if (result.success) {
        await dialog.alert({ title: 'Sucesso', type: 'success', message: '✅ Orçamento gerado com sucesso! Enviado para ' + editingData.email });
        // Recarregar atendimentos
        fetchAttendances(selectedStatus || undefined);
      } else {
        await dialog.alert({ title: 'Erro', type: 'error', message: '❌ Erro ao gerar orçamento: ' + result.error });
      }
    } catch (error) {
      console.error('Error generating budget:', error);
      await dialog.alert({ title: 'Erro', type: 'error', message: '❌ Erro ao conectar com servidor' });
    }
  };

  const handleGenerateContract = async () => {
    if (!selectedAttendance) return;

    try {
      const response = await fetch('/api/v1/admin/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pre_registration_id: selectedAttendance.pre_registration_id,
          type: 'contract',
          ministry_name: editingData.ministry_name,
          pastor_name: editingData.pastor_name,
          email: editingData.email,
          quantity_temples: editingData.quantity_temples,
          quantity_members: editingData.quantity_members,
          plan: editingData.plan,
        }),
      });

      const result = await response.json();
      if (result.success) {
        await dialog.alert({ title: 'Sucesso', type: 'success', message: '✅ Contrato gerado com sucesso! Enviado para ' + editingData.email });
        // Recarregar atendimentos
        fetchAttendances(selectedStatus || undefined);
      } else {
        await dialog.alert({ title: 'Erro', type: 'error', message: '❌ Erro ao gerar contrato: ' + result.error });
      }
    } catch (error) {
      console.error('Error generating contract:', error);
      await dialog.alert({ title: 'Erro', type: 'error', message: '❌ Erro ao conectar com servidor' });
    }
  };

  const handleGenerateCredentials = async () => {
    if (!selectedAttendance) return;

    try {
      const response = await fetch('/api/v1/admin/test-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pre_registration_id: selectedAttendance.pre_registration_id,
          ministry_name: editingData.ministry_name,
          email: editingData.email,
          whatsapp: editingData.whatsapp,
          is_permanent: true, // Credenciais definitivas, não teste!
          trial_days: null, // Sem limite de trial
        }),
      });

      const result = await response.json();
      if (result.success) {
        await dialog.alert({
          title: 'Sucesso',
          type: 'success',
          message: '✅ Credenciais DEFINITIVAS geradas com sucesso!\n\nEmail: ' + result.data?.email + '\nSenha: ' + result.data?.password + '\n\nCredenciais enviadas para ' + editingData.email,
        });
        // Recarregar atendimentos
        fetchAttendances(selectedStatus || undefined);
      } else {
        await dialog.alert({ title: 'Erro', type: 'error', message: '❌ Erro ao gerar credenciais: ' + result.error });
      }
    } catch (error) {
      console.error('Error generating credentials:', error);
      await dialog.alert({ title: 'Erro', type: 'error', message: '❌ Erro ao conectar com servidor' });
    }
  };

  const filteredAttendances = attendances.filter((att) => {
    const query = searchQuery.toLowerCase();
    const preReg = att.pre_registration;
    return (
      preReg.ministry_name.toLowerCase().includes(query) ||
      preReg.pastor_name.toLowerCase().includes(query) ||
      preReg.email.toLowerCase().includes(query) ||
      preReg.whatsapp.includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Top Navigation Bar */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/dashboard" className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium">
              <ArrowLeft className="w-5 h-5" />
              Voltar ao Dashboard
            </Link>
            <div className="text-gray-300">|</div>
            <h1 className="text-xl font-bold text-gray-900">🎯 Painel de Atendimento</h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8">
        {/* Description */}
        <p className="text-gray-600 mb-8">Gerencie o processo de venda e conversão de novos assinantes</p>
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
          {Object.entries(STATUS_LABELS).map(([key, { label }]) => {
            const count = attendances.filter((a) => a.status === key).length;
            return (
              <div key={key} className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
                <div className="text-2xl font-bold text-gray-900">{count}</div>
                <div className="text-xs text-gray-600 mt-1">{label}</div>
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por ministério, pastor, email ou WhatsApp..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1); // Reset para primeira página ao buscar
                  }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={selectedStatus}
                onChange={(e) => handleStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              >
                <option value="">📊 Todos os Status</option>
                <option value="not_contacted">❌ Não Atendido</option>
                <option value="in_progress">📞 Em Atendimento</option>
                <option value="budget_sent">💰 Orçamento Enviado</option>
                <option value="contract_generating">📄 Gerando Contrato</option>
                <option value="finalized_positive">✅ Finalizado - Positivo</option>
                <option value="finalized_negative">❌ Finalizado - Negativo</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-8">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-gray-600">Carregando atendimentos...</p>
          </div>
        ) : filteredAttendances.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">Nenhum atendimento encontrado</p>
          </div>
        ) : (
          <>
            {/* Tabela Responsiva */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Ministério</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Pastor/Responsável</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Email</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Telefone</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Status</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Estrutura</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredAttendances
                      .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                      .map((attendance) => (
                        <tr key={attendance.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4 text-sm text-gray-900 font-medium">{attendance.pre_registration.ministry_name}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{attendance.pre_registration.pastor_name}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            <a href={`mailto:${attendance.pre_registration.email}`} className="text-blue-600 hover:underline">
                              {attendance.pre_registration.email}
                            </a>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            <a href={`https://wa.me/${attendance.pre_registration.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">
                              {attendance.pre_registration.whatsapp}
                            </a>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${STATUS_LABELS[attendance.status]?.color || 'bg-gray-100'}`}>
                              {STATUS_LABELS[attendance.status]?.label || attendance.status}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            <div className="flex gap-3">
                              <div>
                                <span className="text-gray-500">🏛️</span> {attendance.pre_registration.quantity_temples}
                              </div>
                              <div>
                                <span className="text-gray-500">👥</span> {attendance.pre_registration.quantity_members}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <button
                              onClick={() => handleOpenModal(attendance)}
                              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-xs font-medium whitespace-nowrap"
                            >
                              ✏️ Editar
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-gray-200">
                {filteredAttendances
                  .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                  .map((attendance) => (
                    <div key={attendance.id} className="p-4 hover:bg-gray-50 transition">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 text-sm">{attendance.pre_registration.ministry_name}</h4>
                          <p className="text-xs text-gray-600">{attendance.pre_registration.pastor_name}</p>
                        </div>
                        <div
                          className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                            STATUS_LABELS[attendance.status]?.color || 'bg-gray-100'
                          }`}
                        >
                          {STATUS_LABELS[attendance.status]?.label?.split(' ')[0] || attendance.status}
                        </div>
                      </div>
                      <div className="space-y-1 mb-3 text-xs text-gray-600">
                        <p>📧 {attendance.pre_registration.email}</p>
                        <p>📱 {attendance.pre_registration.whatsapp}</p>
                        <p>🏛️ {attendance.pre_registration.quantity_temples} | 👥 {attendance.pre_registration.quantity_members}</p>
                      </div>
                      <button
                        onClick={() => handleOpenModal(attendance)}
                        className="w-full px-2 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition"
                      >
                        ✏️ Editar
                      </button>
                    </div>
                  ))}
              </div>
            </div>

            {/* Pagination */}
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Mostrando{' '}
                <strong>
                  {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredAttendances.length)}
                </strong>{' '}
                de <strong>{filteredAttendances.length}</strong> registros
              </p>
              <div className="flex gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm font-medium"
                >
                  ← Anterior
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.ceil(filteredAttendances.length / itemsPerPage) }).map((_, i) => (
                    <button
                      key={i + 1}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                        currentPage === i + 1
                          ? 'bg-blue-600 text-white'
                          : 'border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button
                  disabled={currentPage === Math.ceil(filteredAttendances.length / itemsPerPage)}
                  onClick={() => setCurrentPage(currentPage + 1)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm font-medium"
                >
                  Próxima →
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal de Atualização */}
      {showModal && selectedAttendance && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-8 max-h-[95vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">
              Atualizar Atendimento
            </h2>
            <p className="text-gray-600 mb-6">
              Ministério: <strong>{selectedAttendance.pre_registration?.ministry_name || 'N/A'}</strong>
            </p>

            <form className="space-y-8">
              {/* SEÇÃO 1: Informações Básicas */}
              <div className="border-b border-gray-200 pb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-blue-500">ℹ️ Informações Básicas</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nome do Ministério *</label>
                    <input
                      type="text"
                      value={editingData.ministry_name || ''}
                      onChange={(e) => setEditingData({ ...editingData, ministry_name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      placeholder="Ex: Igreja Assembleia de Deus"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">CPF/CNPJ</label>
                    <input
                      type="text"
                      value={editingData.cpf_cnpj || ''}
                      onChange={(e) => setEditingData({ ...editingData, cpf_cnpj: formatCpfOrCnpj(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      placeholder="00.000.000/0000-00"
                    />
                  </div>
                </div>
              </div>

              {/* SEÇÃO 2: Dados de Contato */}
              <div className="border-b border-gray-200 pb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-blue-500">📞 Dados de Contato</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                    <input
                      type="email"
                      value={editingData.email || ''}
                      onChange={(e) => setEditingData({ ...editingData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      placeholder="contato@ministerio.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Telefone</label>
                    <input
                      type="tel"
                      value={editingData.phone || ''}
                      onChange={(e) => setEditingData({ ...editingData, phone: formatPhone(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      placeholder="(11) 3000-0000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">WhatsApp</label>
                    <input
                      type="tel"
                      value={editingData.whatsapp || ''}
                      onChange={(e) => setEditingData({ ...editingData, whatsapp: formatPhone(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      placeholder="(11) 99000-0000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
                    <input
                      type="url"
                      value={editingData.website || ''}
                      onChange={(e) => setEditingData({ ...editingData, website: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      placeholder="https://www.ministerio.com"
                    />
                  </div>
                </div>
              </div>

              {/* SEÇÃO 3: Responsável */}
              <div className="border-b border-gray-200 pb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-blue-500">👨‍💼 Responsável</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nome do Pastor/Responsável</label>
                    <input
                      type="text"
                      value={editingData.pastor_name || ''}
                      onChange={(e) => setEditingData({ ...editingData, pastor_name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      placeholder="Ex: Pastor João Silva"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nome Completo do Responsável</label>
                    <input
                      type="text"
                      value={editingData.responsible_name || ''}
                      onChange={(e) => setEditingData({ ...editingData, responsible_name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      placeholder="Ex: João da Silva Santos"
                    />
                  </div>
                </div>
              </div>

              {/* SEÇÃO 4: Endereço */}
              <div className="border-b border-gray-200 pb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-blue-500">📍 Endereço</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">CEP</label>
                    <input
                      type="text"
                      value={editingData.address_zip || ''}
                      onChange={(e) => setEditingData({ ...editingData, address_zip: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      placeholder="00000-000"
                      maxLength={8}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Rua</label>
                    <input
                      type="text"
                      value={editingData.address_street || ''}
                      onChange={(e) => setEditingData({ ...editingData, address_street: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      placeholder="Rua das Flores"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Número</label>
                    <input
                      type="text"
                      value={editingData.address_number || ''}
                      onChange={(e) => setEditingData({ ...editingData, address_number: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      placeholder="123"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Complemento</label>
                    <input
                      type="text"
                      value={editingData.address_complement || ''}
                      onChange={(e) => setEditingData({ ...editingData, address_complement: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      placeholder="Apto 42, Bloco A"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Cidade</label>
                    <input
                      type="text"
                      value={editingData.address_city || ''}
                      onChange={(e) => setEditingData({ ...editingData, address_city: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      placeholder="São Paulo"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Estado (UF)</label>
                    <select
                      value={editingData.address_state || ''}
                      onChange={(e) => setEditingData({ ...editingData, address_state: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    >
                      <option value="">Selecione...</option>
                      <option value="SP">São Paulo (SP)</option>
                      <option value="RJ">Rio de Janeiro (RJ)</option>
                      <option value="MG">Minas Gerais (MG)</option>
                      <option value="BA">Bahia (BA)</option>
                      <option value="RS">Rio Grande do Sul (RS)</option>
                      <option value="PR">Paraná (PR)</option>
                      <option value="PE">Pernambuco (PE)</option>
                      <option value="CE">Ceará (CE)</option>
                      <option value="SC">Santa Catarina (SC)</option>
                      <option value="GO">Goiás (GO)</option>
                      <option value="PB">Paraíba (PB)</option>
                      <option value="PA">Pará (PA)</option>
                      <option value="ES">Espírito Santo (ES)</option>
                      <option value="PI">Piauí (PI)</option>
                      <option value="RN">Rio Grande do Norte (RN)</option>
                      <option value="AL">Alagoas (AL)</option>
                      <option value="MT">Mato Grosso (MT)</option>
                      <option value="DF">Distrito Federal (DF)</option>
                      <option value="MS">Mato Grosso do Sul (MS)</option>
                      <option value="AM">Amazonas (AM)</option>
                      <option value="RO">Rondônia (RO)</option>
                      <option value="AC">Acre (AC)</option>
                      <option value="AP">Amapá (AP)</option>
                      <option value="RR">Roraima (RR)</option>
                      <option value="TO">Tocantins (TO)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SEÇÃO 5: Informações de Estrutura */}
              <div className="border-b border-gray-200 pb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-blue-500">📊 Informações de Estrutura</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Quantidade de Igrejas/Templos</label>
                    <input
                      type="number"
                      value={editingData.quantity_temples || 0}
                      onChange={(e) => setEditingData({ ...editingData, quantity_temples: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      placeholder="1"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Quantidade de Membros</label>
                    <input
                      type="number"
                      value={editingData.quantity_members || 0}
                      onChange={(e) => setEditingData({ ...editingData, quantity_members: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      placeholder="0"
                      min="0"
                    />
                  </div>
                </div>
              </div>

              {/* SEÇÃO 6: Informações Adicionais */}
              <div className="border-b border-gray-200 pb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-blue-500">📝 Informações Adicionais</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Descrição do Ministério</label>
                    <textarea
                      value={editingData.description || ''}
                      onChange={(e) => setEditingData({ ...editingData, description: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
                      placeholder="Descreva brevemente o ministério..."
                      rows={4}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Plano de Inscrição</label>
                    <select
                      value={editingData.plan || 'starter'}
                      onChange={(e) => setEditingData({ ...editingData, plan: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    >
                      <option value="starter">Starter</option>
                      <option value="intermediario">Intermediario</option>
                      <option value="profissional">Profissional</option>
                      <option value="expert">Expert</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SEÇÃO 7: Status do Atendimento */}
              <div className="border-b border-gray-200 pb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-blue-500">🎯 Status do Atendimento</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Estágio do Atendimento</label>
                    <select
                      value={modalStatus}
                      onChange={(e) => setModalStatus(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    >
                      <option value="not_contacted">❌ Não Atendido</option>
                      <option value="in_progress">📞 Em Atendimento</option>
                      <option value="budget_sent">💰 Orçamento Enviado</option>
                      <option value="contract_generating">📄 Gerando Contrato</option>
                      <option value="finalized_positive">✅ Finalizado - Positivo</option>
                      <option value="finalized_negative">❌ Finalizado - Negativo</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SEÇÃO 8: Observações */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-blue-500">💬 Observações e Notas</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Anotações sobre este atendimento</label>
                  <textarea
                    value={modalNotes}
                    onChange={(e) => setModalNotes(e.target.value)}
                    placeholder="Registre os detalhes da conversa, próximos passos, informações importantes..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
                    rows={5}
                  />
                </div>
              </div>

              {/* SEÇÃO 9: Ações Dinâmicas por Status */}
              {(modalStatus === 'budget_sent' || modalStatus === 'contract_generating' || modalStatus === 'finalized_positive') && (
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-green-500">⚡ Ações Disponíveis</h3>
                  <div className="space-y-3">
                    {/* Botão: Gerar Orçamento */}
                    {modalStatus === 'budget_sent' && (
                      <button
                        onClick={handleGenerateBudget}
                        className="w-full px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition font-medium"
                      >
                        💰 Gerar Orçamento
                      </button>
                    )}

                    {/* Botão: Gerar Contrato */}
                    {modalStatus === 'contract_generating' && (
                      <button
                        onClick={handleGenerateContract}
                        className="w-full px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition font-medium"
                      >
                        📄 Gerar Contrato
                      </button>
                    )}

                    {/* Botão: Gerar Credenciais (Definitivas) */}
                    {modalStatus === 'finalized_positive' && (
                      <button
                        onClick={handleGenerateCredentials}
                        className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition font-medium"
                      >
                        🔐 Gerar Credenciais Definitivas
                      </button>
                    )}
                  </div>
                </div>
              )}
            </form>

            {/* Buttons */}
            <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
              >
                ✕ Cancelar
              </button>
              <button
                onClick={handleUpdateAttendance}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              >
                💾 Salvar Mudanças
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

