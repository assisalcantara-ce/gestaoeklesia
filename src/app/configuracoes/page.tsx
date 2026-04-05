'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import NotificationModal from '@/components/NotificationModal';
import { getCargosMinisteriais, saveCargosMinisteriais, type CargoMinisterial } from '@/lib/cargos-utils';
import { useAppDialog } from '@/providers/AppDialogProvider'
import { useAuditLog } from '@/hooks/useAuditLog';
import { createClient } from '@/lib/supabase-client'
import { formatCnpj, formatPhone } from '@/lib/mascaras';
import { formatarPreco } from '@/config/plans';
import type { SubscriptionPlan } from '@/types/admin';
import { NOMENCLATURAS_SCHEMA_VERSION, NOMENCLATURAS_SCHEMA_VERSION_KEY } from '@/lib/org-nomenclaturas';

export const dynamic = 'force-dynamic';

export default function ConfiguracoesPage() {
  const [activeMenu, setActiveMenu] = useState('configuracoes');
  const [activeTab, setActiveTab] = useState('perfil');
  const [notification, setNotification] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  }>({ isOpen: false, title: '', message: '', type: 'success' });

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} />

      <NotificationModal
        title={notification.title}
        message={notification.message}
        type={notification.type}
        isOpen={notification.isOpen}
        onClose={() => setNotification({ ...notification, isOpen: false })}
      />

      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {/* Header */}
          <h1 className="text-3xl font-bold text-gray-800 mb-6">⚙️ Configurações da Instituição</h1>

          {/* Abas */}
          <div className="flex border-b border-gray-300 bg-white rounded-t-lg overflow-x-auto mb-6">
            <button
              onClick={() => setActiveTab('perfil')}
              className={`px-6 py-3 font-semibold transition whitespace-nowrap text-sm border-b-3 ${activeTab === 'perfil'
                ? 'text-teal-700 border-teal-600'
                : 'text-gray-600 border-transparent hover:text-teal-600'
                }`}
            >
              🏛️ Perfil da Instituição
            </button>
            <button
              onClick={() => setActiveTab('identidade')}
              className={`px-6 py-3 font-semibold transition whitespace-nowrap text-sm border-b-3 ${activeTab === 'identidade'
                ? 'text-teal-700 border-teal-600'
                : 'text-gray-600 border-transparent hover:text-teal-600'
                }`}
            >
              🎨 Identidade Visual
            </button>
            <button
              onClick={() => setActiveTab('faturas')}
              className={`px-6 py-3 font-semibold transition whitespace-nowrap text-sm border-b-3 ${activeTab === 'faturas'
                ? 'text-teal-700 border-teal-600'
                : 'text-gray-600 border-transparent hover:text-teal-600'
                }`}
            >
              📄 Faturas
            </button>
            <button
              onClick={() => setActiveTab('plano')}
              className={`px-6 py-3 font-semibold transition whitespace-nowrap text-sm border-b-3 ${activeTab === 'plano'
                ? 'text-teal-700 border-teal-600'
                : 'text-gray-600 border-transparent hover:text-teal-600'
                }`}
            >
              📋 Plano
            </button>
            <button
              onClick={() => setActiveTab('nomenclaturas')}
              className={`px-6 py-3 font-semibold transition whitespace-nowrap text-sm border-b-3 ${activeTab === 'nomenclaturas'
                ? 'text-teal-700 border-teal-600'
                : 'text-gray-600 border-transparent hover:text-teal-600'
                }`}
            >
              📝 Nomenclaturas
            </button>
          </div>

          {/* Conteúdo das Abas */}
          <div className="bg-white rounded-b-lg shadow-md p-6">
            {/* Aba: Perfil */}
            {activeTab === 'perfil' && (
              <PerfilContent onNotification={(title, message, type) => setNotification({ isOpen: true, title, message, type })} />
            )}

            {/* Aba: Identidade Visual */}
            {activeTab === 'identidade' && (
              <BrandingContent onNotification={(title, message, type) => setNotification({ isOpen: true, title, message, type })} />
            )}



            {/* Aba: Faturas */}
            {activeTab === 'faturas' && (
              <FaturasContent />
            )}

            {/* Aba: Plano */}
            {activeTab === 'plano' && (
              <PlanoContent onNotification={(title, message, type) => setNotification({ isOpen: true, title, message, type })} />
            )}

            {/* Aba: Nomenclaturas */}
            {activeTab === 'nomenclaturas' && (
              <NomenclaturaContent onNotification={(title, message, type) => setNotification({ isOpen: true, title, message, type })} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Componente Perfil
function PerfilContent({ onNotification }: { onNotification: (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info') => void }) {
  const supabase = createClient();
  const { fetchConfiguracaoIgrejaFromSupabase, updateConfiguracaoIgrejaInSupabase } = require('@/lib/igreja-config-utils');

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    nomeMinisterio: '',
    cnpj: '',
    email: '',
    telefone: '',
    website: '',
    endereco: '',
    descricao: '',
    responsavel: '',
    dataCadastro: ''
  });

  useEffect(() => {
    fetchConfiguracaoIgrejaFromSupabase(supabase)
      .then((config: any) => {
        setFormData({
          nomeMinisterio: config.nome || 'Instituição',
          cnpj: config.cnpj || '',
          email: config.email || '',
          telefone: config.telefone || '',
          website: config.website || '',
          endereco: config.endereco || '',
          descricao: config.descricao || '',
          responsavel: config.responsavel || '',
          dataCadastro: config.dataCadastro || ''
        });
      })
      .catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const nextValue = name === 'cnpj'
      ? formatCnpj(value)
      : name === 'telefone'
        ? formatPhone(value)
        : value;
    setFormData(prev => ({
      ...prev,
      [name]: nextValue
    }));
  };

  const handleSave = async () => {
    try {
      await updateConfiguracaoIgrejaInSupabase(supabase, {
        nome: formData.nomeMinisterio,
        cnpj: formData.cnpj,
        email: formData.email,
        telefone: formData.telefone,
        endereco: formData.endereco,
        descricao: formData.descricao,
        website: formData.website,
        responsavel: formData.responsavel
      });
      onNotification('Sucesso', 'Dados da instituição atualizados com sucesso!', 'success');
      setIsEditing(false);
    } catch (error: any) {
      console.error('❌ Erro ao salvar perfil:', error);
      onNotification('Erro', error?.message || 'Erro ao salvar. Tente novamente.', 'error');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Perfil da Instituição</h2>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className={`px-6 py-2 rounded-lg transition font-semibold ${isEditing
            ? 'bg-gray-500 text-white hover:bg-gray-600'
            : 'bg-teal-600 text-white hover:bg-teal-700'
            }`}
        >
          {isEditing ? '❌ Cancelar' : '✏️ Editar'}
        </button>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Nome da Instituição</label>
            <input
              type="text"
              name="nomeMinisterio"
              value={formData.nomeMinisterio}
              onChange={handleChange}
              disabled={!isEditing}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">CNPJ</label>
            <input
              type="text"
              name="cnpj"
              value={formData.cnpj}
              onChange={handleChange}
              disabled={!isEditing}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              disabled={!isEditing}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Telefone</label>
            <input
              type="tel"
              name="telefone"
              value={formData.telefone}
              onChange={handleChange}
              disabled={!isEditing}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Website</label>
            <input
              type="url"
              name="website"
              value={formData.website}
              onChange={handleChange}
              disabled={!isEditing}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Presidente</label>
            <input
              type="text"
              name="responsavel"
              value={formData.responsavel}
              onChange={handleChange}
              disabled={!isEditing}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Endereço</label>
          <textarea
            name="endereco"
            value={formData.endereco}
            onChange={handleChange}
            disabled={!isEditing}
            rows={2}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Descrição</label>
          <textarea
            name="descricao"
            value={formData.descricao}
            onChange={handleChange}
            disabled={!isEditing}
            rows={3}
            placeholder="Informações sobre sua instituição"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Data de Fundação</label>
          <input
            type="date"
            name="dataCadastro"
            value={formData.dataCadastro}
            onChange={handleChange}
            disabled={!isEditing}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {isEditing && (
          <div className="flex gap-4 pt-4">
            <button
              onClick={handleSave}
              className="flex-1 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
            >
              ✓ Salvar Alterações
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="flex-1 px-6 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition font-semibold"
            >
              ✕ Descartar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Componente Branding
function BrandingContent({ onNotification }: { onNotification: (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info') => void }) {
  const supabase = createClient();
  const { fetchConfiguracaoIgrejaFromSupabase, updateConfiguracaoIgrejaInSupabase } = require('@/lib/igreja-config-utils');

  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    fetchConfiguracaoIgrejaFromSupabase(supabase)
      .then((config: any) => setLogoPreview(config.logo || null))
      .catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          if (img.width < 200 || img.height < 200) {
            onNotification('Aviso', 'A imagem deve ter no mínimo 200x200 pixels', 'warning');
            return;
          }
          const logoBase64 = event.target?.result as string;
          setLogoPreview(logoBase64);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveLogo = async () => {
    if (logoPreview) {
      await updateConfiguracaoIgrejaInSupabase(supabase, { logo: logoPreview });
      onNotification('Sucesso', 'Configurações salvas com sucesso!', 'success');
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Identidade Visual - Logomarca</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-4">Upload da Logomarca</h3>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50 mb-4">
            <div className="text-5xl mb-3">📤</div>
            <p className="text-gray-600 text-sm mb-3">Clique ou arraste a imagem aqui</p>
            <p className="text-gray-500 text-xs mb-4">Dimensões recomendadas: 500x500px<br />Formatos: PNG, JPG, SVG | Máximo: 5MB</p>
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoChange}
              className="hidden"
              id="logo-input"
            />
            <label
              htmlFor="logo-input"
              className="inline-block px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 cursor-pointer font-semibold"
            >
              📁 Escolher Imagem
            </label>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-4">Prévia da Logomarca</h3>

          <div className="border border-gray-300 rounded-lg p-8 text-center bg-gray-50 mb-4 h-64 flex items-center justify-center">
            {logoPreview ? (
              <img src={logoPreview} alt="Logo Preview" className="max-h-full max-w-full object-contain" />
            ) : (
              <div className="text-gray-400">
                <div className="text-5xl mb-2">🖼️</div>
                <p>Nenhuma imagem selecionada</p>
              </div>
            )}
          </div>

          {logoPreview && (
            <button
              onClick={handleSaveLogo}
              className="w-full px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
            >
              ✓ Salvar Logomarca
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-gray-700">
          💡 <strong>Dica:</strong> As informações da chiesa (nome, endereço, CNPJ, telefone, email) são configuradas na aba <strong>"Perfil da Instituição"</strong> e serão exibidas automaticamente no cabeçalho dos relatórios em PDF.
        </p>
      </div>
    </div>
  );
}

// Componente Faturas
function FaturasContent() {
  const [filterStatus, setFilterStatus] = useState('TODAS');
  const [faturas, setFaturas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [baixandoId, setBaixandoId] = useState<string | null>(null);

  useEffect(() => {
    const carregarFaturas = async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          setFaturas([]);
          return;
        }

        // Usar API em vez de acessar Supabase direto (evita RLS issues)
        const response = await fetch('/api/v1/admin/payments-list', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.warn('Falha ao carregar faturas:', errorData.error);
          setFaturas([]);
          return;
        }

        const { payments } = await response.json();

        // Mapear dados
        const faturasFormatadas = (payments || []).map((payment: any, index: number) => ({
          id: payment.id,
          asaas_payment_id: payment.asaas_payment_id ?? null,
          payment_method: payment.payment_method ?? null,
          numero: `FAT-${new Date(payment.created_at).getFullYear()}-${String(index + 1).padStart(3, '0')}`,
          data: payment.created_at,
          vencimento: payment.due_date,
          valor: parseFloat(payment.amount),
          status: mapearStatusPagamento(payment.status),
          description: payment.description ?? '',
        }));

        setFaturas(faturasFormatadas);
      } catch (err) {
        console.error('Erro ao buscar faturas:', err);
        setFaturas([]);
      } finally {
        setLoading(false);
      }
    };

    carregarFaturas();
  }, []);

  const mapearStatusPagamento = (status: string) => {
    switch (status) {
      case 'paid':
        return 'paga';
      case 'overdue':
        return 'vencida';
      case 'pending':
        return 'vencer';
      case 'cancelled':
      case 'failed':
        return 'cancelada';
      default:
        return 'vencer';
    }
  };

  const faturasFiltered = filterStatus === 'TODAS' ? faturas : faturas.filter(f => f.status === filterStatus.toLowerCase());

  const handleBaixar = async (fatura: any) => {
    setBaixandoId(fatura.id);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        alert('Sessão expirada. Faça login novamente.');
        return;
      }

      const response = await fetch(`/api/v1/admin/payments-boleto?id=${fatura.id}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      if (!response.ok) {
        console.error('Erro ao buscar boleto:', await response.text());
        alert('Não foi possível obter o link do boleto. Tente novamente.');
        return;
      }

      const data = await response.json();

      // Abrir link ASAAS se disponível
      if (data.bankSlipUrl) {
        window.open(data.bankSlipUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      if (data.invoiceUrl) {
        window.open(data.invoiceUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      if (data.pixQrCodeUrl) {
        window.open(data.pixQrCodeUrl, '_blank', 'noopener,noreferrer');
        return;
      }

      // Fallback: comprovante local imprimível
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Fatura ${fatura.numero}</title>
        <style>body{font-family:sans-serif;padding:32px;max-width:600px;margin:0 auto}
        h2{color:#0d9488}table{width:100%;border-collapse:collapse;margin-top:16px}
        td{padding:8px 0;border-bottom:1px solid #eee}td:first-child{color:#666;width:140px}
        .valor{font-size:1.5rem;font-weight:700;color:#0d9488;margin:16px 0}
        .rodape{margin-top:32px;font-size:0.75rem;color:#999;border-top:1px solid #eee;padding-top:12px}
        </style></head><body>
        <h2>Fatura ${fatura.numero}</h2>
        <table>
          <tr><td>Descrição</td><td>${fatura.description || 'Assinatura'}</td></tr>
          <tr><td>Emissão</td><td>${new Date(fatura.data).toLocaleDateString('pt-BR')}</td></tr>
          <tr><td>Vencimento</td><td>${new Date(fatura.vencimento).toLocaleDateString('pt-BR')}</td></tr>
          <tr><td>Forma</td><td>${fatura.payment_method || '-'}</td></tr>
        </table>
        <div class="valor">R$ ${fatura.valor.toFixed(2).replace('.', ',')}</div>
        <div class="rodape">Gerado em ${new Date().toLocaleString('pt-BR')}</div>
        <script>window.print();</script>
        </body></html>`);
        win.document.close();
      }
    } catch (err) {
      console.error('Erro ao baixar fatura:', err);
      alert('Erro ao baixar fatura. Tente novamente.');
    } finally {
      setBaixandoId(null);
    }
  };

  const totalPago = faturas.filter(f => f.status === 'paga').reduce((sum, f) => sum + f.valor, 0);
  const totalVencida = faturas.filter(f => f.status === 'vencida').reduce((sum, f) => sum + f.valor, 0);
  const totalVencer = faturas.filter(f => f.status === 'vencer').reduce((sum, f) => sum + f.valor, 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paga': return 'bg-green-100 text-green-800';
      case 'vencida': return 'bg-red-100 text-red-800';
      case 'vencer': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paga': return '✓ Paga';
      case 'vencida': return '✕ Vencida';
      case 'vencer': return '⏰ A Vencer';
      default: return status;
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Faturas</h2>

      {loading ? (
        <p className="text-sm text-gray-500 mb-4">Carregando faturas...</p>
      ) : faturas.length === 0 ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <p className="text-gray-700 mb-2">Nenhuma fatura encontrada</p>
          <p className="text-sm text-gray-500">Quando houver faturas lançadas, elas aparecerão aqui.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-600">
          <p className="text-gray-600 text-sm font-semibold mb-1">FATURAS PAGAS</p>
          <p className="text-3xl font-bold text-green-600">R$ {totalPago.toFixed(2).replace('.', ',')}</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-600">
          <p className="text-gray-600 text-sm font-semibold mb-1">FATURAS VENCIDAS</p>
          <p className="text-3xl font-bold text-red-600">R$ {totalVencida.toFixed(2).replace('.', ',')}</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-600">
          <p className="text-gray-600 text-sm font-semibold mb-1">FATURAS A VENCER</p>
          <p className="text-3xl font-bold text-yellow-600">R$ {totalVencer.toFixed(2).replace('.', ',')}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {['TODAS', 'paga', 'vencida', 'vencer'].map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status === 'TODAS' ? 'TODAS' : status)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${filterStatus === (status === 'TODAS' ? 'TODAS' : status)
              ? 'bg-teal-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
          >
            {status === 'TODAS' ? 'Todas' : status === 'paga' ? 'Pagas' : status === 'vencida' ? 'Vencidas' : 'A Vencer'}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300">
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Número</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Emissão</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Vencimento</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Valor</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Ações</th>
            </tr>
          </thead>
          <tbody>
            {faturasFiltered.map((fatura) => (
              <tr key={fatura.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-6 py-3 text-sm text-gray-900 font-semibold">{fatura.numero}</td>
                <td className="px-6 py-3 text-sm text-gray-600">{new Date(fatura.data).toLocaleDateString('pt-BR')}</td>
                <td className="px-6 py-3 text-sm text-gray-600">{new Date(fatura.vencimento).toLocaleDateString('pt-BR')}</td>
                <td className="px-6 py-3 text-sm text-gray-900 font-semibold">R$ {fatura.valor.toFixed(2).replace('.', ',')}</td>
                <td className="px-6 py-3">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(fatura.status)}`}>
                    {getStatusLabel(fatura.status)}
                  </span>
                </td>
                <td className="px-6 py-3 text-sm">
                  <button
                    onClick={() => handleBaixar(fatura)}
                    disabled={baixandoId === fatura.id}
                    className="text-teal-600 hover:text-teal-800 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {baixandoId === fatura.id ? '⏳ Aguarde...' : '📥 Baixar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
        </>
      )}
    </div>
  );
}

// Componente Plano
function PlanoContent({ onNotification }: { onNotification: (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info') => void }) {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [planoSelecionado, setPlanoSelecionado] = useState<SubscriptionPlan | null>(null);
  const [criandoTicket, setCriandoTicket] = useState(false);
  const dialog = useAppDialog();
  const { registrarAcao } = useAuditLog();

  const [planosDB, setPlanosDB] = useState<SubscriptionPlan[]>([]);
  const [planoAtual, setPlanoAtual] = useState<SubscriptionPlan | null>(null);
  const [planoInicio, setPlanoInicio] = useState<string>('');
  const [planoRenovacao, setPlanoRenovacao] = useState<string>('');
  const [planoStatus, setPlanoStatus] = useState<string>('ativo');
  const [loading, setLoading] = useState(true);
  const [ministryId, setMinistryId] = useState<string>('');

  const buildRecursos = (plan: SubscriptionPlan & { max_divisao1?: number; max_divisao2?: number; max_divisao3?: number }): string[] => {
    const r: string[] = [];
    if (plan.max_users > 0) r.push(`Até ${plan.max_users} Usuários Administrativos`);
    if (plan.max_members > 0) r.push(`Até ${plan.max_members.toLocaleString('pt-BR')} Membros`);
    if (plan.has_advanced_reports) r.push('Relatórios Avançados');
    if (plan.has_api_access) r.push('Acesso à API');
    if (plan.has_priority_support) r.push('Suporte Prioritário');
    if (plan.has_custom_domain) r.push('Domínio Personalizado');
    if (plan.has_white_label) r.push('White Label');
    if (plan.has_automation) r.push('Automação');
    return r;
  };

  const buildModulos = (plan: SubscriptionPlan): string[] => {
    const m: string[] = [];
    if ((plan as any).has_modulo_financeiro) m.push('Financeiro');
    if ((plan as any).has_modulo_eventos) m.push('Eventos');
    if ((plan as any).has_modulo_reunioes) m.push('Reuniões');
    return m;
  };

  useEffect(() => {
    const supabase = createClient();

    const load = async () => {
      try {
        // 1) Carregar planos ativos diretamente do banco
        const { data: plansData } = await supabase
          .from('subscription_plans')
          .select('*, has_modulo_financeiro, has_modulo_eventos, has_modulo_reunioes')
          .eq('is_active', true)
          .order('price_monthly', { ascending: true });

        const plans = (plansData || []) as SubscriptionPlan[];
        setPlanosDB(plans);

        // 2) Resolver ministryId
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const muResult = await supabase.from('ministry_users').select('ministry_id').eq('user_id', user.id).maybeSingle();
        let mId = (muResult.data as any)?.ministry_id as string | undefined;
        if (!mId) {
          const mResult = await supabase.from('ministries').select('id').eq('user_id', user.id).maybeSingle();
          mId = (mResult.data as any)?.id as string | undefined;
        }
        if (!mId) return;
        setMinistryId(mId);

        // 3) Buscar dados do ministério com JOIN no plano (coluna subscription_plan_id existe após migration 20260403200000)
        const { data: mData } = await supabase
          .from('ministries')
          .select('plan, subscription_plan_id, subscription_status, subscription_start_date, subscription_end_date, created_at, subscription_plans:subscription_plan_id(id, slug, name, price_monthly, price_annually, description, max_users, max_members, max_ministerios, has_api_access, has_custom_domain, has_advanced_reports, has_priority_support, has_white_label, has_automation, has_modulo_financeiro, has_modulo_eventos, has_modulo_reunioes, is_active, display_order)')
          .eq('id', mId)
          .maybeSingle();

        setPlanoStatus(String((mData as any)?.subscription_status || 'ativo'));
        setPlanoInicio((mData as any)?.subscription_start_date || (mData as any)?.created_at || '');
        setPlanoRenovacao((mData as any)?.subscription_end_date || '');

        // 4) Plano atual: UUID via JOIN > slug exato no campo plan
        let found: SubscriptionPlan | null = null;
        const joinedPlan = (mData as any)?.subscription_plans;
        if (joinedPlan?.id) {
          found = plans.find(p => p.id === joinedPlan.id) || (joinedPlan as SubscriptionPlan);
        }
        if (!found) {
          const slug = String((mData as any)?.plan || '').toLowerCase().trim();
          if (slug) {
            found = plans.find(p => p.slug.toLowerCase() === slug)
              || plans.find(p => p.name.toLowerCase() === slug)
              || null;
          }
        }
        setPlanoAtual(found);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleUpgradeClick = (plano: SubscriptionPlan) => {
    setPlanoSelecionado(plano);
    setShowUpgradeModal(true);
  };

  const handleConfirmUpgrade = async () => {
    try {
      setCriandoTicket(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        await dialog.alert({ title: 'Erro', type: 'error', message: 'Você precisa estar logado para solicitar upgrade' });
        return;
      }

      let mId = ministryId;
      if (!mId) {
        const muResult = await supabase.from('ministry_users').select('ministry_id').eq('user_id', user.id).maybeSingle();
        mId = (muResult.data as any)?.ministry_id as string;
        if (!mId) {
          const mResult = await supabase.from('ministries').select('id').eq('user_id', user.id).maybeSingle();
          mId = (mResult.data as any)?.id as string;
        }
      }

      if (!mId) {
        await dialog.alert({ title: 'Erro', type: 'error', message: 'Ministério não encontrado' });
        return;
      }

      const titulo = `Solicitação de Upgrade de Plano: ${planoSelecionado?.name || 'Desconhecido'}`;
      const descricao = `Solicitação de upgrade do plano "${planoAtual?.name || 'Atual'}" para "${planoSelecionado?.name || 'Desconhecido'}".\n\nNovo plano: ${formatarPreco(planoSelecionado?.price_monthly || 0)}/mês\n\nFavor processar esta solicitação comercial.`;

      const { error: ticketError } = await supabase
        .from('support_tickets')
        .insert([{ ministry_id: mId, user_id: user.id, subject: titulo, description: descricao, category: 'Upgrade de Plano', priority: 'high', status: 'open' }])
        .select();

      if (ticketError) {
        await registrarAcao({ acao: 'criar', modulo: 'configuracoes', area: 'plano', tabela_afetada: 'support_tickets', descricao: 'Tentativa de criar ticket de upgrade falhou', status: 'erro', mensagem_erro: ticketError.message });
        await dialog.alert({ title: 'Erro', type: 'error', message: 'Erro ao criar ticket: ' + ticketError.message });
        return;
      }

      await registrarAcao({ acao: 'criar', modulo: 'configuracoes', area: 'plano', tabela_afetada: 'support_tickets', descricao: `Ticket de upgrade criado: ${titulo}`, dados_novos: { plano_atual: planoAtual?.slug, plano_solicitado: planoSelecionado?.slug, titulo }, status: 'sucesso' });

      setShowUpgradeModal(false);
      setPlanoSelecionado(null);
      onNotification('Sucesso!', 'Ticket comercial enviado com sucesso! Um membro da nossa equipe entrará em contato em breve para processar seu upgrade.', 'success');
    } catch (error: any) {
      console.error('Erro ao confirmar upgrade:', error);
      onNotification('Erro', 'Erro ao processar upgrade: ' + (error?.message || 'Erro desconhecido'), 'error');
    } finally {
      setCriandoTicket(false);
    }
  };

  // Plano recomendado = próximo nível acima do atual
  const recommendedPlanId = (() => {
    if (planosDB.length === 0) return null;
    if (!planoAtual) return planosDB[Math.floor(planosDB.length / 2)]?.id || null;
    const idx = planosDB.findIndex(p => p.id === planoAtual.id);
    return idx >= 0 && idx < planosDB.length - 1 ? planosDB[idx + 1].id : null;
  })();

  const recursosPlanAtual = planoAtual ? buildRecursos(planoAtual as any) : [];
  const modulosPlanAtual = planoAtual ? buildModulos(planoAtual) : [];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Plano de Assinatura</h2>

      {loading && <p className="text-sm text-gray-500 mb-4">Carregando dados do plano...</p>}

      {/* Plano não identificado */}
      {!loading && !planoAtual && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-6 text-yellow-800 text-sm">
          Plano atual não identificado. Entre em contato com o suporte para regularizar sua assinatura.
        </div>
      )}

      {/* Card plano atual */}
      {planoAtual && (
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-lg shadow-lg p-8 mb-8">
          <h3 className="text-2xl font-bold mb-2">Seu Plano Atual</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <p className="text-teal-100 text-sm mb-1">Plano</p>
              <p className="text-2xl font-bold">{planoAtual.name}</p>
              <p className="text-teal-100 text-xs">Status: {planoStatus}</p>
            </div>
            <div>
              <p className="text-teal-100 text-sm mb-1">Valor</p>
              <p className="text-2xl font-bold">{formatarPreco(planoAtual.price_monthly)}</p>
              {planoAtual.price_annually && (
                <p className="text-teal-100 text-xs">{formatarPreco(planoAtual.price_annually)}/ano</p>
              )}
            </div>
            <div>
              <p className="text-teal-100 text-sm mb-1">Ativo desde</p>
              <p className="text-lg font-semibold">{planoInicio ? new Date(planoInicio).toLocaleDateString('pt-BR') : '—'}</p>
            </div>
            <div>
              <p className="text-teal-100 text-sm mb-1">Próxima renovação</p>
              <p className="text-lg font-semibold">{planoRenovacao ? new Date(planoRenovacao).toLocaleDateString('pt-BR') : '—'}</p>
            </div>
          </div>
          {(recursosPlanAtual.length > 0 || modulosPlanAtual.length > 0) && (
            <div className="mt-6">
              <h4 className="text-lg font-bold mb-3">Seu Plano Inclui:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {recursosPlanAtual.map((feature, index) => (
                  <p key={index} className="text-teal-100">✓ {feature}</p>
                ))}
              </div>
              {modulosPlanAtual.length > 0 && (
                <div className="mt-4">
                  <p className="text-teal-200 text-xs font-semibold uppercase tracking-widest mb-2">Módulos Incluídos</p>
                  <div className="flex flex-wrap gap-2">
                    {modulosPlanAtual.map((m, i) => (
                      <span key={i} className="px-3 py-1 bg-white/20 text-white text-xs font-semibold rounded-full">✓ {m}</span>
                    ))}
                  </div>
                </div>
              )}
              {planoAtual.description && (
                <p className="text-teal-200 text-sm mt-3 italic">{planoAtual.description}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Lista de planos disponíveis */}
      {!loading && planosDB.length > 0 && (
        <>
          <h3 className="text-xl font-bold text-gray-800 mb-4">Planos Disponíveis</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {planosDB.map((plano) => {
              const isAtual = plano.id === planoAtual?.id;
              const isRecomendado = plano.id === recommendedPlanId && !isAtual;
              const recursos = buildRecursos(plano as any);
              const modulos = buildModulos(plano);
              return (
                <div key={plano.id} className={`rounded-lg shadow-lg overflow-hidden transition transform hover:scale-105 bg-white ${isRecomendado ? 'ring-2 ring-teal-500' : ''} ${isAtual ? 'ring-2 ring-blue-500' : ''}`}>
                  {isRecomendado && (
                    <div className="bg-teal-500 text-white px-4 py-2 text-center text-sm font-bold">⭐ RECOMENDADO</div>
                  )}
                  {isAtual && (
                    <div className="bg-blue-600 text-white px-4 py-2 text-center text-sm font-bold">✓ PLANO ATUAL</div>
                  )}
                  <div className="p-4">
                    <h4 className="text-lg font-bold text-gray-800 mb-1">{plano.name}</h4>
                    {plano.description && <p className="text-gray-500 text-xs mb-3">{plano.description}</p>}
                    <p className="text-2xl font-bold text-teal-600 mb-1">{formatarPreco(plano.price_monthly)}</p>
                    <p className="text-gray-600 text-sm">por mês</p>
                    {plano.price_annually && (
                      <p className="text-gray-500 text-xs mb-3">{formatarPreco(plano.price_annually)}/ano</p>
                    )}

                    {recursos.length > 0 && (
                      <div className="space-y-1 mb-3 mt-2">
                        {recursos.map((feature, idx) => (
                          <p key={idx} className="text-xs text-gray-700">✓ {feature}</p>
                        ))}
                      </div>
                    )}

                    {modulos.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Módulos</p>
                        <div className="flex flex-wrap gap-1">
                          {modulos.map((m, i) => (
                            <span key={i} className="px-2 py-0.5 bg-teal-50 border border-teal-200 text-teal-700 text-xs font-semibold rounded-full">{m}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => { if (!isAtual) handleUpgradeClick(plano); }}
                      disabled={isAtual}
                      className={`w-full py-2 rounded-lg font-semibold transition ${
                        isAtual ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-teal-600 text-white hover:bg-teal-700'
                      }`}
                    >
                      {isAtual ? '✓ Plano Atual' : 'Solicitar Upgrade'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modal upgrade */}
      {showUpgradeModal && planoSelecionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Solicitar Upgrade</h3>
            <p className="text-gray-600 mb-4">
              Um ticket comercial será criado e nossa equipe de suporte entrará em contato para processar seu upgrade para o plano <strong>{planoSelecionado.name}</strong>.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 mb-4 text-sm text-gray-700">
              <p>📦 <strong>{planoAtual?.name}</strong> → <strong>{planoSelecionado.name}</strong></p>
              <p className="mt-1">💰 {formatarPreco(planoSelecionado.price_monthly)}/mês</p>
            </div>
            <p className="text-sm text-gray-500 mb-6">Você receberá uma resposta por email em breve com os próximos passos.</p>
            <div className="flex gap-4">
              <button
                onClick={() => { setShowUpgradeModal(false); setPlanoSelecionado(null); }}
                disabled={criandoTicket}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-semibold disabled:opacity-50"
              >Cancelar</button>
              <button
                onClick={handleConfirmUpgrade}
                disabled={criandoTicket}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold disabled:opacity-50"
              >{criandoTicket ? 'Processando...' : 'Abrir Ticket'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



// Componente Nomenclaturas
function NomenclaturaContent({ onNotification }: { onNotification: (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info') => void }) {
  const dialog = useAppDialog();
  const [isEditing, setIsEditing] = useState(false);

  const supabase = createClient();

  const ORG_NOMENCLATURAS_KEY = 'divisoes_organizacionais';
  const CARGOS_MINISTERIAIS_KEY = 'cargos_ministeriais';
  const ORG_NOMENCLATURAS_SCHEMA_VERSION = 3;

  type DivisionKey = 'divisaoPrincipal' | 'divisaoSecundaria' | 'divisaoTerciaria';
  type DivisionConfig = { opcao1: string; custom?: string[] };
  type NomenclaturasState = Record<DivisionKey, DivisionConfig>;

  const NATIVE_OPTIONS: Record<DivisionKey, string[]> = {
    // Divisão 1 agora usa as opções que eram da Divisão 3
    divisaoPrincipal: ['CONGREGAÇÃO', 'IGREJA', 'TEMPLO', 'NENHUMA'],
    divisaoSecundaria: ['CAMPO', 'SETOR', 'GRUPO', 'ÁREA', 'NENHUMA'],
    // Divisão 3: deixar apenas "NENHUMA" (usuário pode adicionar manualmente)
    divisaoTerciaria: ['NENHUMA']
  };

  const getDefaultNomenclaturas = (): NomenclaturasState => ({
    divisaoPrincipal: { opcao1: 'IGREJA', custom: [] },
    divisaoSecundaria: { opcao1: 'CAMPO', custom: [] },
    divisaoTerciaria: { opcao1: 'NENHUMA', custom: [] }
  });

  const normalizeCustomList = (custom: unknown): string[] => {
    if (!Array.isArray(custom)) return [];
    return custom
      .map(v => (typeof v === 'string' ? v.trim() : ''))
      .filter(Boolean)
      .map(v => v.toUpperCase());
  };

  const normalizeDivision = (key: DivisionKey, value: any, legacyThirdDivision = false): DivisionConfig => {
    const native = NATIVE_OPTIONS[key];
    const base = getDefaultNomenclaturas()[key];

    if (!value) return base;

    // Estrutura antiga: string direta
    if (typeof value === 'string') {
      const selected = value.trim().toUpperCase() || base.opcao1;
      if (key === 'divisaoTerciaria') {
        if (legacyThirdDivision) return { opcao1: 'NENHUMA', custom: [] };
        return { opcao1: native.includes(selected) ? selected : 'NENHUMA', custom: [] };
      }
      const custom = native.includes(selected) ? [] : [selected];
      return { opcao1: selected, custom };
    }

    const rawSelected = typeof value.opcao1 === 'string' ? value.opcao1 : base.opcao1;
    let selected = rawSelected.trim().toUpperCase() || base.opcao1;
    const custom = normalizeCustomList(value.custom);
    const customDedup = Array.from(new Set(custom));

    if (key === 'divisaoTerciaria') {
      if (legacyThirdDivision) return { opcao1: 'NENHUMA', custom: [] };
      const hasSelectedInCustom = customDedup.some(v => v.toUpperCase() === selected);
      if (!native.includes(selected) && !hasSelectedInCustom) selected = 'NENHUMA';
    }

    // Se o selecionado não for nativo nem custom, tratá-lo como custom.
    const all = new Set([...native, ...customDedup]);
    if (!all.has(selected) && key !== 'divisaoTerciaria') customDedup.push(selected);

    return { opcao1: selected, custom: Array.from(new Set(customDedup)) };
  };

  const normalizeNomenclaturas = (raw: any): NomenclaturasState => {
    const legacyThirdDivision = !!raw?.__legacyThirdDivision;
    return {
      divisaoPrincipal: normalizeDivision('divisaoPrincipal', raw?.divisaoPrincipal, legacyThirdDivision),
      divisaoSecundaria: normalizeDivision('divisaoSecundaria', raw?.divisaoSecundaria, legacyThirdDivision),
      divisaoTerciaria: normalizeDivision('divisaoTerciaria', raw?.divisaoTerciaria, legacyThirdDivision)
    };
  };

  const [nomenclaturas, setNomenclaturasState] = useState<NomenclaturasState>(() => getDefaultNomenclaturas());
  const [temp, setTemp] = useState<NomenclaturasState>(() => getDefaultNomenclaturas());
  const [novaOpcao, setNovaOpcao] = useState<Record<DivisionKey, string>>({
    divisaoPrincipal: '',
    divisaoSecundaria: '',
    divisaoTerciaria: ''
  });

  const [cargosMinisteriais, setCargosMinisteriais] = useState<CargoMinisterial[]>(() => getCargosMinisteriais());
  const [novoCargo, setNovoCargo] = useState('');

  const resolveMinistryId = async (): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const mu = await supabase
        .from('ministry_users')
        .select('ministry_id')
        .eq('user_id', user.id)
        .limit(1);
      const ministryIdFromMu = (mu.data as any)?.[0]?.ministry_id as string | undefined;
      if (ministryIdFromMu) return ministryIdFromMu;

      const m = await supabase
        .from('ministries')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);
      const ministryIdFromOwner = (m.data as any)?.[0]?.id as string | undefined;
      return ministryIdFromOwner || null;
    } catch {
      return null;
    }
  };

  const buildOrgNomenclaturasPayload = (state: NomenclaturasState) => {
    return {
      schemaVersion: ORG_NOMENCLATURAS_SCHEMA_VERSION,
      divisaoPrincipal: state.divisaoPrincipal,
      divisaoSecundaria: state.divisaoSecundaria,
      divisaoTerciaria: state.divisaoTerciaria,
    };
  };

  const upsertOrgNomenclaturas = async (
    ministryId: string,
    state: NomenclaturasState,
    cargos: CargoMinisterial[]
  ) => {
    try {
      const { data: existingRow } = await supabase
        .from('configurations')
        .select('nomenclaturas')
        .eq('ministry_id', ministryId)
        .maybeSingle();

      const existingNomenclaturas = (existingRow as any)?.nomenclaturas || {};
      const payload = buildOrgNomenclaturasPayload(state);

      const { error: upsertErr } = await supabase
        .from('configurations')
        .upsert({
          ministry_id: ministryId,
          nomenclaturas: {
            ...existingNomenclaturas,
            [ORG_NOMENCLATURAS_KEY]: payload,
            [CARGOS_MINISTERIAIS_KEY]: cargos,
          },
          updated_at: new Date().toISOString(),
        } as any, { onConflict: 'ministry_id' });

      if (upsertErr) {
        console.error('❌ Erro ao salvar nomenclaturas:', upsertErr);
        throw new Error(upsertErr.message || 'Erro ao salvar nomenclaturas');
      }

      console.log('✅ Nomenclaturas salvas com sucesso!');
    } catch (error) {
      console.error('❌ Erro em upsertOrgNomenclaturas:', error);
      throw error;
    }
  };

  const loadFromSupabaseOrMigrate = async () => {
    const ministryId = await resolveMinistryId();
    if (!ministryId) return;

    const { data: configRow, error: configErr } = await supabase
      .from('configurations')
      .select('nomenclaturas')
      .eq('ministry_id', ministryId)
      .maybeSingle();

    if (!configErr) {
      const rawNomenclaturas = (configRow as any)?.nomenclaturas || {};
      const org = rawNomenclaturas?.[ORG_NOMENCLATURAS_KEY];
      const cargos = rawNomenclaturas?.[CARGOS_MINISTERIAIS_KEY];
      if (Array.isArray(cargos)) {
        setCargosMinisteriais(cargos as CargoMinisterial[]);
        saveCargosMinisteriais(cargos as CargoMinisterial[]);
      }
      if (org) {
        const schemaVersion = Number(org?.schemaVersion || 0);
        const normalized = normalizeNomenclaturas({
          divisaoPrincipal: org?.divisaoPrincipal,
          divisaoSecundaria: org?.divisaoSecundaria,
          divisaoTerciaria: org?.divisaoTerciaria,
          __legacyThirdDivision: schemaVersion < ORG_NOMENCLATURAS_SCHEMA_VERSION,
        });
        setNomenclaturasState(normalized);
        setTemp(normalized);
        return;
      }
    }

    let nextState = getDefaultNomenclaturas();
    await upsertOrgNomenclaturas(ministryId, nextState, cargosMinisteriais);
    setNomenclaturasState(nextState);
    setTemp(nextState);
  };

  useEffect(() => {
    loadFromSupabaseOrMigrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectChange = (nivel: DivisionKey, value: string) => {
    const selected = (value || '').trim().toUpperCase();
    setTemp(prev => ({
      ...prev,
      [nivel]: {
        ...prev[nivel],
        opcao1: selected
      }
    }));
  };

  const handleAddCustomOption = (nivel: DivisionKey) => {
    const raw = novaOpcao[nivel] || '';
    const value = raw.trim().toUpperCase();

    if (!value) {
      onNotification('Aviso', 'Digite uma nomenclatura para adicionar.', 'warning');
      return;
    }

    const native = NATIVE_OPTIONS[nivel];
    const currentCustom = temp[nivel].custom || [];
    const exists = [...native, ...currentCustom].some(v => v.toUpperCase() === value);
    if (exists) {
      onNotification('Aviso', 'Essa opção já existe.', 'warning');
      return;
    }

    setTemp(prev => ({
      ...prev,
      [nivel]: {
        ...prev[nivel],
        opcao1: value,
        custom: [...(prev[nivel].custom || []), value]
      }
    }));
    setNovaOpcao(prev => ({ ...prev, [nivel]: '' }));
  };

  const handleDeleteCustomOption = (nivel: DivisionKey, value: string) => {
    const toDelete = (value || '').trim().toUpperCase();
    setTemp(prev => {
      const custom = (prev[nivel].custom || []).filter(v => v.toUpperCase() !== toDelete);
      const nextSelected = prev[nivel].opcao1?.toUpperCase() === toDelete ? 'NENHUMA' : prev[nivel].opcao1;
      return {
        ...prev,
        [nivel]: {
          ...prev[nivel],
          opcao1: nextSelected,
          custom
        }
      };
    });
  };

  const handleSave = async () => {
    console.log('💾 handleSave chamado');
    console.log('📋 Dados a salvar:', temp);
    setNomenclaturasState(temp);

    try {
      const ministryId = await resolveMinistryId();
      if (!ministryId) {
        onNotification('Erro', 'Não foi possível identificar sua instituição.', 'error');
        return;
      }

      await upsertOrgNomenclaturas(ministryId, temp, cargosMinisteriais);

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('nomenclaturas', JSON.stringify(temp));
          localStorage.setItem(NOMENCLATURAS_SCHEMA_VERSION_KEY, NOMENCLATURAS_SCHEMA_VERSION);
        } catch {
          // ignore
        }
      }

      setIsEditing(false);
      onNotification('Sucesso', 'Nomenclaturas atualizadas com sucesso!', 'success');
    } catch (error: any) {
      console.error('❌ Erro ao salvar nomenclaturas:', error);
      onNotification('Erro', `Erro ao salvar: ${error?.message || 'Tente novamente'}`, 'error');
    }
  };

  const handleCancel = () => {
    console.log('❌ Cancelando edição, revertendo para:', nomenclaturas);
    setTemp(nomenclaturas);
    setIsEditing(false);
  };

  const toggleCargo = (id: number) => {
    const nextCargos = cargosMinisteriais.map(cargo =>
      cargo.id === id ? { ...cargo, ativo: !cargo.ativo } : cargo
    );
    setCargosMinisteriais(nextCargos);
    saveCargosMinisteriais(nextCargos);
  };

  const adicionarCargo = () => {
    const nomeNormalizado = novoCargo.trim();

    // Validações
    if (!nomeNormalizado) {
      onNotification('Aviso', 'Por favor, digite o nome do cargo.', 'warning');
      return;
    }

    // Verificar duplicados (case insensitive)
    const jaExiste = cargosMinisteriais.some(
      cargo => cargo.nome.toLowerCase() === nomeNormalizado.toLowerCase()
    );

    if (jaExiste) {
      onNotification('Aviso', 'Este cargo já existe na lista.', 'warning');
      return;
    }

    // Adicionar novo cargo
    const novoId = Math.max(...cargosMinisteriais.map(c => c.id), 0) + 1;
    const novoCargoObj: CargoMinisterial = {
      id: novoId,
      nome: nomeNormalizado,
      ativo: true
    };

    const nextCargos = [...cargosMinisteriais, novoCargoObj];
    setCargosMinisteriais(nextCargos);
    saveCargosMinisteriais(nextCargos);
    setNovoCargo('');
    onNotification('Sucesso', `Cargo "${nomeNormalizado}" adicionado com sucesso!`, 'success');
  };

  const removerCargo = async (id: number) => {
    const cargo = cargosMinisteriais.find(c => c.id === id);
    if (!cargo) return;

    const ok = await dialog.confirm({
      title: 'Confirmar',
      type: 'warning',
      message: `Deseja realmente remover o cargo "${cargo.nome}"?`,
      confirmText: 'OK',
      cancelText: 'Cancelar',
    })

    if (ok) {
      const nextCargos = cargosMinisteriais.filter(c => c.id !== id);
      setCargosMinisteriais(nextCargos);
      saveCargosMinisteriais(nextCargos);
      onNotification('Sucesso', `Cargo "${cargo.nome}" removido com sucesso!`, 'success');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Nomenclaturas da Organização</h2>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className={`px-6 py-2 rounded-lg transition font-semibold ${isEditing
            ? 'bg-gray-500 text-white hover:bg-gray-600'
            : 'bg-teal-600 text-white hover:bg-teal-700'
            }`}
        >
          {isEditing ? '❌ Cancelar' : '✏️ Editar'}
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-blue-900 text-sm">
          <strong>ℹ️</strong> Customize os nomes das divisões internas e os cargos ministeriais do seu ministério.
        </p>
      </div>

      {/* Seção: Divisões */}
      <div className="mb-8">
        <h3 className="text-xl font-bold text-gray-800 mb-4">🏢 Divisões Organizacionais</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {(['divisaoPrincipal', 'divisaoSecundaria', 'divisaoTerciaria'] as DivisionKey[]).map((key, index) => (
            <div key={key} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>{index + 1}️⃣</span> {index === 0 ? 'Primeira' : index === 1 ? 'Segunda' : 'Terceira'} Divisão
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nomenclatura</label>
                  {isEditing ? (
                    <div className="space-y-3">
                      <select
                        value={temp[key].opcao1}
                        onChange={(e) => handleSelectChange(key, e.target.value)}
                        autoFocus={index === 0}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                      >
                        {Array.from(
                          new Set([
                            ...NATIVE_OPTIONS[key],
                            ...(temp[key].custom || [])
                          ])
                        ).map(option => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>

                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={novaOpcao[key]}
                          onChange={(e) => setNovaOpcao(prev => ({ ...prev, [key]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddCustomOption(key);
                          }}
                          placeholder="Digite um novo valor"
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                        <button
                          onClick={() => handleAddCustomOption(key)}
                          className="px-5 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition font-semibold whitespace-nowrap"
                        >
                          ➕ Adicionar
                        </button>
                      </div>

                      {(temp[key].custom || []).length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs text-gray-600">Opções personalizadas:</p>
                          <div className="space-y-2">
                            {(temp[key].custom || []).map(option => (
                              <div key={option} className="flex items-center justify-between p-2 border border-gray-200 rounded-lg bg-gray-50">
                                <span className="text-sm font-semibold text-gray-800">{option}</span>
                                <button
                                  onClick={() => handleDeleteCustomOption(key, option)}
                                  className="text-red-500 hover:text-red-700 transition"
                                  title="Remover opção personalizada"
                                >
                                  🗑️
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-lg font-semibold text-teal-700">{nomenclaturas[key].opcao1}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Seção: Cargos Ministeriais */}
      <div className="mb-8">
        <h3 className="text-xl font-bold text-gray-800 mb-4">⛪ Cargos Ministeriais</h3>
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {cargosMinisteriais.map(cargo => (
              <div key={cargo.id} className={`flex items-center gap-3 p-3 border border-gray-300 rounded-lg ${isEditing ? 'hover:bg-gray-50' : 'bg-gray-50 opacity-75'}`}>
                <input
                  type="checkbox"
                  checked={cargo.ativo}
                  onChange={() => toggleCargo(cargo.id)}
                  disabled={!isEditing}
                  className={`w-5 h-5 ${isEditing ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                />
                <span className={`flex-1 font-semibold ${cargo.ativo ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                  {cargo.nome}
                </span>
                {isEditing && cargo.id > 8 && (
                  <button
                    onClick={() => removerCargo(cargo.id)}
                    className="text-red-500 hover:text-red-700 transition"
                    title="Remover cargo"
                  >
                    🗑️
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Campo para adicionar novo cargo */}
          {isEditing && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="text-sm font-bold text-gray-800 mb-3">➕ Adicionar Novo Cargo</h4>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={novoCargo}
                  onChange={(e) => setNovoCargo(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && adicionarCargo()}
                  placeholder="Ex: Cooperador, Obreiro, etc."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <button
                  onClick={adicionarCargo}
                  className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition font-semibold whitespace-nowrap"
                >
                  ➕ Adicionar
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                💡 Digite o nome do novo cargo e clique em "Adicionar". Você pode remover cargos personalizados clicando no ícone 🗑️.
              </p>
            </div>
          )}

          <p className="text-xs text-gray-600 mt-4">
            💡 Marque os cargos que deseja disponibilizar no sistema. Eles aparecerão no formulário de cadastro de ministros.
          </p>
        </div>
      </div>

      {isEditing && (
        <div className="flex gap-4 mt-6">
          <button
            onClick={handleSave}
            className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
          >
            ✓ Salvar
          </button>
          <button
            onClick={handleCancel}
            className="flex-1 px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-semibold"
          >
            ✕ Descartar
          </button>
        </div>
      )}
    </div>
  );
}
