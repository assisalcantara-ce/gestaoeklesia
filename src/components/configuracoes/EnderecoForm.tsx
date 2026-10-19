'use client';

import React, { useState } from 'react';
import { formatCep, onlyDigits } from '@/lib/mascaras';

export const ESTADOS_BRASIL = [
  { sigla: 'AC', nome: 'Acre' },
  { sigla: 'AL', nome: 'Alagoas' },
  { sigla: 'AP', nome: 'Amapá' },
  { sigla: 'AM', nome: 'Amazonas' },
  { sigla: 'BA', nome: 'Bahia' },
  { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'DF', nome: 'Distrito Federal' },
  { sigla: 'ES', nome: 'Espírito Santo' },
  { sigla: 'GO', nome: 'Goiás' },
  { sigla: 'MA', nome: 'Maranhão' },
  { sigla: 'MT', nome: 'Mato Grosso' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  { sigla: 'MG', nome: 'Minas Gerais' },
  { sigla: 'PA', nome: 'Pará' },
  { sigla: 'PB', nome: 'Paraíba' },
  { sigla: 'PR', nome: 'Paraná' },
  { sigla: 'PE', nome: 'Pernambuco' },
  { sigla: 'PI', nome: 'Piauí' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' },
  { sigla: 'RN', nome: 'Rio de Grande do Norte' },
  { sigla: 'RS', nome: 'Rio Grande do Sul' },
  { sigla: 'RO', nome: 'Rondônia' },
  { sigla: 'RR', nome: 'Roraima' },
  { sigla: 'SC', nome: 'Santa Catarina' },
  { sigla: 'SP', nome: 'São Paulo' },
  { sigla: 'SE', nome: 'Sergipe' },
  { sigla: 'TO', nome: 'Tocantins' },
];

export interface EnderecoFormValues {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
}

interface EnderecoFormProps {
  values: EnderecoFormValues;
  onChange: (field: keyof EnderecoFormValues, value: string) => void;
  onBulkChange?: (updates: Partial<EnderecoFormValues>) => void;
  isEditing: boolean;
}

export function EnderecoForm({ values, onChange, onBulkChange, isEditing }: EnderecoFormProps) {
  const [loadingCep, setLoadingCep] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);

  const buscarCep = async () => {
    const rawCep = onlyDigits(values.cep || '');
    if (rawCep.length !== 8) {
      setCepError('Informe um CEP válido com 8 dígitos.');
      return;
    }

    setLoadingCep(true);
    setCepError(null);

    try {
      const response = await fetch(`https://viacep.com.br/ws/${rawCep}/json/`);
      if (!response.ok) {
        throw new Error('Serviço de CEP temporariamente indisponível.');
      }
      const data = await response.json();

      if (data.erro) {
        setCepError('CEP não encontrado. Preencha o endereço manualmente.');
        return;
      }

      // Preenchimento automático sem apagar número ou complemento
      const updates: Partial<EnderecoFormValues> = {
        cep: formatCep(rawCep),
        logradouro: data.logradouro || values.logradouro || '',
        bairro: data.bairro || values.bairro || '',
        cidade: data.localidade || values.cidade || '',
        estado: (data.uf || values.estado || '').toUpperCase(),
      };

      if (onBulkChange) {
        onBulkChange(updates);
      } else {
        Object.entries(updates).forEach(([key, val]) => {
          onChange(key as keyof EnderecoFormValues, val || '');
        });
      }
    } catch (err: any) {
      console.error('Erro ao consultar ViaCEP:', err);
      setCepError(err?.message || 'Falha na consulta ao CEP. Preencha manualmente.');
    } finally {
      setLoadingCep(false);
    }
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCep(e.target.value);
    onChange('cep', formatted);
    if (cepError) setCepError(null);
  };

  const handleKeyDownCep = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      buscarCep();
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Linha 1: CEP + Botão Buscar ── */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          CEP
        </label>
        <div className="flex flex-col sm:flex-row gap-2 max-w-md">
          <div className="relative flex-1">
            <input
              type="text"
              name="cep"
              value={values.cep || ''}
              onChange={handleCepChange}
              onKeyDown={handleKeyDownCep}
              disabled={!isEditing || loadingCep}
              placeholder="00000-000"
              maxLength={9}
              className={`w-full px-4 py-2 border rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                cepError ? 'border-red-400 bg-red-50/20' : 'border-gray-300'
              }`}
            />
          </div>
          <button
            type="button"
            onClick={buscarCep}
            disabled={!isEditing || loadingCep}
            className="inline-flex items-center justify-center px-5 py-2 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition shrink-0 shadow-sm"
            title="Buscar dados do endereço no ViaCEP"
          >
            {loadingCep ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                Buscando...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                🔍 Buscar
              </span>
            )}
          </button>
        </div>
        {cepError && (
          <p className="mt-1 text-xs text-red-600 font-medium">{cepError}</p>
        )}
      </div>

      {/* ── Linha 2: Rua / Logradouro + Número ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-3">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Rua / Logradouro
          </label>
          <input
            type="text"
            name="logradouro"
            value={values.logradouro || ''}
            onChange={(e) => onChange('logradouro', e.target.value)}
            disabled={!isEditing}
            placeholder="Avenida, Rua, Travessa, etc."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Número
          </label>
          <input
            type="text"
            name="numero"
            value={values.numero || ''}
            onChange={(e) => onChange('numero', e.target.value)}
            disabled={!isEditing}
            placeholder="Ex: 123 ou S/N"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      {/* ── Linha 3: Complemento + Bairro ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Complemento <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <input
            type="text"
            name="complemento"
            value={values.complemento || ''}
            onChange={(e) => onChange('complemento', e.target.value)}
            disabled={!isEditing}
            placeholder="Sala, Bloco, Andar, etc."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Bairro
          </label>
          <input
            type="text"
            name="bairro"
            value={values.bairro || ''}
            onChange={(e) => onChange('bairro', e.target.value)}
            disabled={!isEditing}
            placeholder="Bairro"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      {/* ── Linha 4: Cidade + Estado (UF) ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-3">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Cidade
          </label>
          <input
            type="text"
            name="cidade"
            value={values.cidade || ''}
            onChange={(e) => onChange('cidade', e.target.value)}
            disabled={!isEditing}
            placeholder="Cidade"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Estado (UF)
          </label>
          <select
            name="estado"
            value={values.estado || ''}
            onChange={(e) => onChange('estado', e.target.value.toUpperCase())}
            disabled={!isEditing}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
          >
            <option value="">Selecione a UF</option>
            {ESTADOS_BRASIL.map((uf) => (
              <option key={uf.sigla} value={uf.sigla}>
                {uf.sigla} - {uf.nome}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
