'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import { fetchConfiguracaoIgrejaFromSupabase, updateConfiguracaoIgrejaInSupabase, formatarEnderecoCompleto } from '@/lib/igreja-config-utils';
import { formatCnpj, formatPhone } from '@/lib/mascaras';
import { useUserContext } from '@/hooks/useUserContext';
import { EnderecoForm } from '@/components/configuracoes/EnderecoForm';

export default function PerfilMinisterioPage() {

  const [formData, setFormData] = useState({
    nomeMinisterio: '',
    cnpj: '',
    email: '',
    telefone: '',
    website: '',
    endereco: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    responsavel: '',
    dataCadastro: ''
  });

  const supabase = createClient();
  // Fonte oficial do tenant — garantida pelo contexto da aplicação.
  // Em sessões de impersonação reflete o ministério impersonado, não o Super Admin.
  const { ministryId } = useUserContext();

  useEffect(() => {
    console.log('[DIAGNOSTICO ROTA DEDICADA PERFIL] useEffect disparado. ministryId:', ministryId);
    if (!ministryId) return;
    fetchConfiguracaoIgrejaFromSupabase(supabase, ministryId)
      .then((config) => {
        console.log('[DIAGNOSTICO ROTA DEDICADA PERFIL] Config recebido:', config);
        const novoState = {
          nomeMinisterio: config.nome || 'Ministério',
          cnpj: config.cnpj || '',
          email: config.email || '',
          telefone: config.telefone || '',
          website: config.website || '',
          endereco: config.endereco || '',
          cep: config.cep || '',
          logradouro: config.logradouro || '',
          numero: config.numero || '',
          complemento: config.complemento || '',
          bairro: config.bairro || '',
          cidade: config.cidade || '',
          estado: config.estado || '',
          responsavel: config.responsavel || '',
          dataCadastro: ''
        };
        console.log('[DIAGNOSTICO ROTA DEDICADA PERFIL] setFormData com:', novoState);
        setFormData(novoState);
      })
      .catch((err) => console.error('[DIAGNOSTICO ROTA DEDICADA PERFIL] Erro:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ministryId]);

  console.log('[DIAGNOSTICO ROTA DEDICADA PERFIL] Render de PerfilMinisterioPage. formData atual:', formData);

  const [isEditing, setIsEditing] = useState(false);

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

  const handleAddressChange = (field: string, value: string) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      const computedEndereco = formatarEnderecoCompleto({
        logradouro: next.logradouro,
        numero: next.numero,
        complemento: next.complemento,
        bairro: next.bairro,
        cidade: next.cidade,
        estado: next.estado,
        cep: next.cep,
      });
      return {
        ...next,
        endereco: computedEndereco || next.endereco,
      };
    });
  };

  const handleAddressBulkChange = (updates: Partial<{ cep: string; logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; estado: string }>) => {
    setFormData(prev => {
      const next = { ...prev, ...updates };
      const computedEndereco = formatarEnderecoCompleto({
        logradouro: next.logradouro,
        numero: next.numero,
        complemento: next.complemento,
        bairro: next.bairro,
        cidade: next.cidade,
        estado: next.estado,
        cep: next.cep,
      });
      return {
        ...next,
        endereco: computedEndereco || next.endereco,
      };
    });
  };

  const handleSave = async () => {
    try {
      const enderecoSincronizado = formatarEnderecoCompleto({
        logradouro: formData.logradouro,
        numero: formData.numero,
        complemento: formData.complemento,
        bairro: formData.bairro,
        cidade: formData.cidade,
        estado: formData.estado,
        cep: formData.cep,
      }) || formData.endereco;

      await updateConfiguracaoIgrejaInSupabase(supabase, {
        nome: formData.nomeMinisterio,
        cnpj: formData.cnpj,
        email: formData.email,
        telefone: formData.telefone,
        website: formData.website,
        endereco: enderecoSincronizado,
        cep: formData.cep,
        logradouro: formData.logradouro,
        numero: formData.numero,
        complemento: formData.complemento,
        bairro: formData.bairro,
        cidade: formData.cidade,
        estado: formData.estado,
        responsavel: formData.responsavel
      }, ministryId);
      alert('Dados do ministério atualizados com sucesso!');
      setIsEditing(false);
    } catch (err: any) {
      console.error('Erro ao salvar perfil:', err);
      alert(err?.message || 'Erro ao salvar alterações.');
    }
  };

  return (
    <div className="flex-1 overflow-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-800">🏛️ Perfil do Ministério</h1>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`px-6 py-2 rounded-lg transition font-semibold ${
                isEditing
                  ? 'bg-gray-500 text-white hover:bg-gray-600'
                  : 'bg-teal-600 text-white hover:bg-teal-700'
              }`}
            >
              {isEditing ? '❌ Cancelar' : '✏️ Editar'}
            </button>
          </div>

          {/* Formulário */}
          <div className="bg-white rounded-lg shadow-md p-6 max-w-4xl">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nome do Ministério</label>
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
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Responsável</label>
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

              <div className="pt-2 border-t border-gray-100">
                <h3 className="text-base font-bold text-gray-800 mb-3">Endereço da Sede</h3>
                <EnderecoForm
                  values={{
                    cep: formData.cep,
                    logradouro: formData.logradouro,
                    numero: formData.numero,
                    complemento: formData.complemento,
                    bairro: formData.bairro,
                    cidade: formData.cidade,
                    estado: formData.estado,
                  }}
                  onChange={handleAddressChange}
                  onBulkChange={handleAddressBulkChange}
                  isEditing={isEditing}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Data de Cadastro</label>
                <input
                  type="date"
                  name="dataCadastro"
                  value={formData.dataCadastro}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
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
        </div>
      </div>
  );
}
