'use client';

/**
 * /app/perfil — Perfil do membro (view + edit)
 *
 * Campos READ-ONLY: CPF (mascarado), data_nascimento, matrícula, cargo, status, congregação
 * Campos EDITÁVEIS: email, telefone, celular, whatsapp, foto_url, endereço completo
 */

import { useState, useRef } from 'react';
import { useMobileMember, MemberData } from '@/providers/MobileMemberProvider';
import MobileHeader from '@/components/mobile/MobileHeader';
import MobileBottomNav from '@/components/mobile/MobileBottomNav';
import { createClient } from '@/lib/supabase-client';
import Image from 'next/image';
import {
  Edit3,
  Save,
  X,
  User,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

type EditableFields = Pick<
  MemberData,
  'email' | 'phone' | 'celular' | 'whatsapp' | 'foto_url'
> & {
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  complemento: string | null;
  cidade: string | null;
  estado: string | null;
};

function ReadOnlyField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-400 font-medium">{label}</span>
      <span className="text-sm text-gray-700">{value || '—'}</span>
    </div>
  );
}

function EditableInput({
  label,
  field,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  field: keyof EditableFields;
  value: string | null;
  onChange: (field: keyof EditableFields, value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(field, e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-dark-blue/30 focus:border-dark-blue transition"
      />
    </div>
  );
}

export default function PerfilPage() {
  const { member, isLoading, refresh } = useMobileMember();
  const sbRef = useRef(createClient());
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    msg: string;
  } | null>(null);
  const [form, setForm] = useState<EditableFields | null>(null);

  const enterEdit = () => {
    if (!member) return;
    setForm({
      email: member.email,
      phone: member.phone,
      celular: member.celular,
      whatsapp: member.whatsapp,
      foto_url: member.foto_url,
      cep: member.endereco.cep,
      logradouro: member.endereco.logradouro,
      numero: member.endereco.numero,
      bairro: member.endereco.bairro,
      complemento: member.endereco.complemento,
      cidade: member.endereco.cidade,
      estado: member.endereco.estado,
    });
    setFeedback(null);
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setForm(null);
    setFeedback(null);
  };

  const handleChange = (field: keyof EditableFields, value: string) => {
    setForm((prev) => (prev ? { ...prev, [field]: value || null } : prev));
  };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    setFeedback(null);

    const {
      data: { session },
    } = await sbRef.current.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setFeedback({ type: 'error', msg: 'Sessão expirada. Faça login novamente.' });
      setSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/v1/mobile/member/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        await refresh();
        setEditMode(false);
        setForm(null);
        setFeedback({ type: 'success', msg: 'Perfil atualizado com sucesso!' });
      } else {
        const data = await res.json();
        setFeedback({
          type: 'error',
          msg: data.error || 'Não foi possível salvar as alterações.',
        });
      }
    } catch {
      setFeedback({ type: 'error', msg: 'Erro de conexão. Tente novamente.' });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !member) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="text-dark-blue animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <MobileHeader
        title="Meu Perfil"
        rightSlot={
          !editMode ? (
            <button
              onClick={enterEdit}
              className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium"
            >
              <Edit3 size={15} />
              Editar
            </button>
          ) : (
            <button
              onClick={cancelEdit}
              className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm"
            >
              <X size={15} />
              Cancelar
            </button>
          )
        }
      />

      <div className="pt-20 px-6 space-y-4">
        {/* Avatar */}
        <div className="flex flex-col items-center py-4">
          {member.foto_url ? (
            <Image
              src={member.foto_url}
              alt={member.name}
              width={80}
              height={80}
              className="w-20 h-20 rounded-full object-cover border-4 border-white shadow"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-dark-blue/10 flex items-center justify-center border-4 border-white shadow">
              <User size={36} className="text-dark-blue/50" />
            </div>
          )}
          <h2 className="mt-3 text-lg font-bold text-gray-800">{member.name}</h2>
          {member.cargo_ministerial && (
            <p className="text-sm text-gray-500">{member.cargo_ministerial}</p>
          )}
        </div>

        {/* Feedback global */}
        {feedback && (
          <div
            className={`flex items-start gap-2 px-4 py-3 rounded-xl text-sm ${
              feedback.type === 'success'
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
            )}
            {feedback.msg}
          </div>
        )}

        {/* Dados fixos */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Dados Cadastrais
          </h3>
          <ReadOnlyField label="CPF" value={member.cpf} />
          <ReadOnlyField label="Matrícula" value={member.matricula} />
          <ReadOnlyField label="Status" value={member.status} />
          <ReadOnlyField label="Congregação" value={member.congregacao_nome} />
          <ReadOnlyField label="Tipo de Cadastro" value={member.tipo_cadastro} />
        </div>

        {/* Contato */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Contato
          </h3>
          {editMode && form ? (
            <>
              <EditableInput
                label="E-mail"
                field="email"
                value={form.email}
                onChange={handleChange}
                type="email"
                placeholder="seu@email.com"
              />
              <EditableInput
                label="Telefone"
                field="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="(11) 9999-9999"
              />
              <EditableInput
                label="Celular"
                field="celular"
                value={form.celular}
                onChange={handleChange}
                placeholder="(11) 99999-9999"
              />
              <EditableInput
                label="WhatsApp"
                field="whatsapp"
                value={form.whatsapp}
                onChange={handleChange}
                placeholder="(11) 99999-9999"
              />
            </>
          ) : (
            <>
              <ReadOnlyField label="E-mail" value={member.email} />
              <ReadOnlyField label="Telefone" value={member.phone} />
              <ReadOnlyField label="Celular" value={member.celular} />
              <ReadOnlyField label="WhatsApp" value={member.whatsapp} />
            </>
          )}
        </div>

        {/* Endereço */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Endereço
          </h3>
          {editMode && form ? (
            <>
              <EditableInput label="CEP" field="cep" value={form.cep} onChange={handleChange} placeholder="00000-000" />
              <EditableInput label="Logradouro" field="logradouro" value={form.logradouro} onChange={handleChange} />
              <div className="grid grid-cols-2 gap-3">
                <EditableInput label="Número" field="numero" value={form.numero} onChange={handleChange} />
                <EditableInput label="Bairro" field="bairro" value={form.bairro} onChange={handleChange} />
              </div>
              <EditableInput label="Complemento" field="complemento" value={form.complemento} onChange={handleChange} />
              <div className="grid grid-cols-2 gap-3">
                <EditableInput label="Cidade" field="cidade" value={form.cidade} onChange={handleChange} />
                <EditableInput label="Estado (UF)" field="estado" value={form.estado} onChange={handleChange} placeholder="SP" />
              </div>
            </>
          ) : (
            <>
              <ReadOnlyField label="CEP" value={member.endereco.cep} />
              <ReadOnlyField label="Logradouro" value={member.endereco.logradouro} />
              <ReadOnlyField label="Número" value={member.endereco.numero} />
              <ReadOnlyField label="Bairro" value={member.endereco.bairro} />
              <ReadOnlyField label="Cidade / Estado" value={
                [member.endereco.cidade, member.endereco.estado].filter(Boolean).join(' / ') || null
              } />
            </>
          )}
        </div>

        {/* Botão salvar */}
        {editMode && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-dark-blue text-white py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-dark-blue/90 active:scale-[0.98] transition disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save size={16} />
                Salvar alterações
              </>
            )}
          </button>
        )}
      </div>

      <MobileBottomNav />
    </div>
  );
}
