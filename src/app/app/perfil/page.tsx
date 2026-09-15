'use client';

/**
 * /app/perfil — Perfil do membro (view + edit + logout)
 *
 * Campos READ-ONLY: CPF (mascarado), data_nascimento, matrícula, cargo, status, congregação
 * Campos EDITÁVEIS: email, telefone, celular, whatsapp, foto_url, endereço completo
 * Ação de Logout: encerra sessão oficial no Supabase Auth e redireciona para /app/login
 */

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMobileMember, MemberData } from '@/providers/MobileMemberProvider';
import { useAuth } from '@/providers/AuthProvider';
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
  LogOut,
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
    <div className="flex flex-col gap-1">
      <span className="text-xs text-slate-400 font-medium">{label}</span>
      <div className="text-sm text-slate-200 font-medium bg-[#172033]/60 px-3.5 py-2.5 rounded-xl border border-slate-800/80">
        {value || '—'}
      </div>
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
      <label className="block text-xs font-medium text-slate-300 mb-1">{label}</label>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(field, e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 bg-[#172033] border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
      />
    </div>
  );
}

export default function PerfilPage() {
  const router = useRouter();
  const { member, isLoading, refresh } = useMobileMember();
  const { user } = useAuth();
  const sbRef = useRef(createClient());
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
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

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await sbRef.current.auth.signOut();
      router.replace('/app/login');
    } catch (err) {
      console.error('Erro ao encerrar sessão:', err);
      setLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  };

  if (isLoading || !member) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <Loader2 size={32} className="text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 pb-28">
      <MobileHeader
        title="Meu Perfil"
        rightSlot={
          !editMode ? (
            <button
              onClick={enterEdit}
              className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-sm font-medium transition cursor-pointer"
            >
              <Edit3 size={15} />
              Editar
            </button>
          ) : (
            <button
              onClick={cancelEdit}
              className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-sm transition cursor-pointer"
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
              className="w-20 h-20 rounded-full object-cover border-2 border-blue-500/50 shadow-lg"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-[#172033] border-2 border-slate-700 flex items-center justify-center shadow-lg">
              <User size={36} className="text-blue-400" />
            </div>
          )}
          <h2 className="mt-3 text-lg font-bold text-slate-100">{member.name}</h2>
          {member.cargo_ministerial && (
            <p className="text-sm text-blue-400/90 font-medium">{member.cargo_ministerial}</p>
          )}
        </div>

        {/* Feedback global */}
        {feedback && (
          <div
            className={`flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/10 border border-red-500/30 text-red-300'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-400" />
            ) : (
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
            )}
            {feedback.msg}
          </div>
        )}

        {/* Dados fixos */}
        <div className="bg-[#111827] rounded-2xl border border-slate-800 shadow-sm p-5 space-y-4">
          <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
            Dados Cadastrais
          </h3>
          <ReadOnlyField label="CPF" value={member.cpf} />
          <ReadOnlyField label="Matrícula" value={member.matricula} />
          <ReadOnlyField label="Status" value={member.status} />
          <ReadOnlyField label="Congregação" value={member.congregacao_nome} />
          <ReadOnlyField label="Tipo de Cadastro" value={member.tipo_cadastro} />
        </div>

        {/* Contato */}
        <div className="bg-[#111827] rounded-2xl border border-slate-800 shadow-sm p-5 space-y-4">
          <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
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
        <div className="bg-[#111827] rounded-2xl border border-slate-800 shadow-sm p-5 space-y-4">
          <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
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
            className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30 transition disabled:opacity-60 cursor-pointer"
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

        {/* Seção de Sessão e Logout */}
        {!editMode && (
          <div className="bg-[#111827] rounded-2xl border border-slate-800 shadow-sm p-5 space-y-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Acesso e Sessão
            </h3>
            
            {user?.email && (
              <div className="flex items-center justify-between text-xs text-slate-400 bg-[#172033]/60 px-3.5 py-2.5 rounded-xl border border-slate-800/60">
                <span>Conectado como</span>
                <span className="text-slate-200 font-medium">{user.email}</span>
              </div>
            )}

            {showLogoutConfirm ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-3">
                <p className="text-sm font-medium text-red-200 text-center">
                  Deseja realmente sair do aplicativo?
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowLogoutConfirm(false)}
                    disabled={loggingOut}
                    className="w-full py-2.5 px-3 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="w-full py-2.5 px-3 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white flex items-center justify-center gap-1.5 shadow transition disabled:opacity-50 cursor-pointer"
                  >
                    {loggingOut ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Saindo...</span>
                      </>
                    ) : (
                      <>
                        <LogOut size={14} />
                        <span>Confirmar saída</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full py-3 px-4 rounded-xl text-sm font-semibold border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer"
              >
                <LogOut size={16} />
                <span>Sair do aplicativo</span>
              </button>
            )}
          </div>
        )}
      </div>

      <MobileBottomNav />
    </div>
  );
}
