'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { createClient } from '@/lib/supabase-client';
import { fetchConfiguracaoIgrejaFromSupabase, updateConfiguracaoIgrejaInSupabase } from '@/lib/igreja-config-utils';
import { formatCnpj, formatPhone } from '@/lib/mascaras';

export default function PerfilMinisterioPage() {
  const [activeMenu, setActiveMenu] = useState('perfil-ministerio');
  const [formData, setFormData] = useState({
    nomeMinisterio: '',
    cnpj: '',
    email: '',
    telefone: '',
    website: '',
    endereco: '',
    responsavel: '',
    dataCadastro: ''
  });

  const supabase = createClient();

  useEffect(() => {
    fetchConfiguracaoIgrejaFromSupabase(supabase)
      .then((config) => {
        setFormData({
          nomeMinisterio: config.nome || 'Ministério',
          cnpj: config.cnpj || '',
          email: config.email || '',
          telefone: config.telefone || '',
          website: config.website || '',
          endereco: config.endereco || '',
          responsavel: config.responsavel || '',
          dataCadastro: ''
        });
      })
      .catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleSave = async () => {
    await updateConfiguracaoIgrejaInSupabase(supabase, {
      nome: formData.nomeMinisterio,
      cnpj: formData.cnpj,
      email: formData.email,
      telefone: formData.telefone,
      website: formData.website,
      endereco: formData.endereco,
      responsavel: formData.responsavel
    });
    alert('Dados do ministério atualizados com sucesso!');
    setIsEditing(false);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} />

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

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Endereço</label>
                <textarea
                  name="endereco"
                  value={formData.endereco}
                  onChange={handleChange}
                  disabled={!isEditing}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-teal-500"
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
    </div>
  );
}
