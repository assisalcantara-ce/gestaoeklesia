'use client';

import { useState, useEffect } from 'react';
import { X, QrCode } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api-client';

interface Congregacao { id: string; nome: string }
interface FinConta { id: string; nome: string }
interface FinCategoria { id: string; nome: string }

interface DestinoModalProps {
  isOpen: boolean;
  onClose: () => void;
  destinoId: string | null;
  congregacoes: Congregacao[];
  contas: FinConta[];
  categorias: FinCategoria[];
  onSuccess: () => void;
  showModal: (title: string, message: string, type?: 'success' | 'error' | 'info') => void;
}

const TIPOS_RECEBIMENTO = [
  { value: 'dizimo', label: 'Dízimo' },
  { value: 'oferta', label: 'Oferta' },
  { value: 'missoes', label: 'Missões' },
  { value: 'doacao', label: 'Doação Generalizada' },
  { value: 'campanha_local', label: 'Campanha Local' },
  { value: 'evento_local', label: 'Evento Local' },
];

export default function DestinoModal({
  isOpen,
  onClose,
  destinoId,
  congregacoes,
  contas,
  categorias,
  onSuccess,
  showModal,
}: DestinoModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    label: '',
    tipo_recebimento: 'oferta',
    congregacao_id: '',
    conta_id: '',
    categoria_id: '',
    valor_fixo: '',
    descricao: '',
  });

  useEffect(() => {
    if (isOpen && destinoId) {
      setLoading(true);
      authenticatedFetch(`/api/v1/ministry/payment-destinations/${destinoId}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.data) {
            setForm({
              label: json.data.label ?? '',
              tipo_recebimento: json.data.tipo_recebimento ?? 'oferta',
              congregacao_id: json.data.congregacao_id ?? '',
              conta_id: json.data.conta_id ?? '',
              categoria_id: json.data.categoria_id ?? '',
              valor_fixo: json.data.valor_fixo ? String(json.data.valor_fixo) : '',
              descricao: json.data.descricao ?? '',
            });
          }
        })
        .catch(() => showModal('Erro', 'Não foi possível carregar os dados do destino.', 'error'))
        .finally(() => setLoading(false));
    } else if (isOpen) {
      setForm({
        label: '',
        tipo_recebimento: 'oferta',
        congregacao_id: '',
        conta_id: '',
        categoria_id: '',
        valor_fixo: '',
        descricao: '',
      });
    }
  }, [isOpen, destinoId, showModal]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.label.trim()) {
      showModal('Campo Obrigatório', 'Informe o nome/identificador do destino.', 'error');
      return;
    }

    try {
      setSaving(true);
      const url = destinoId
        ? `/api/v1/ministry/payment-destinations/${destinoId}`
        : '/api/v1/ministry/payment-destinations';
      const method = destinoId ? 'PUT' : 'POST';

      const payload = {
        label: form.label.trim(),
        tipo_recebimento: form.tipo_recebimento,
        congregacao_id: form.congregacao_id || null,
        conta_id: form.conta_id || null,
        categoria_id: form.categoria_id || null,
        valor_fixo: form.valor_fixo ? parseFloat(form.valor_fixo) : null,
        descricao: form.descricao.trim() || null,
      };

      const res = await authenticatedFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Erro ao salvar destino.');
      }

      showModal('Sucesso!', destinoId ? 'Destino atualizado com sucesso.' : 'Novo destino PIX criado com sucesso!');
      onSuccess();
      onClose();
    } catch (err: any) {
      showModal('Erro', err.message || 'Erro ao processar solicitação.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5 border border-slate-100 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition p-1 rounded-lg hover:bg-slate-100"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
          <div className="p-2.5 bg-[#123b63]/10 text-[#123b63] rounded-xl">
            <QrCode className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-slate-800">
              {destinoId ? 'Editar Destino de Arrecadação' : 'Novo Destino de Arrecadação PIX'}
            </h3>
            <p className="text-xs text-slate-500">Configure os parâmetros de lançamento e geração do QR Code</p>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400">Carregando informações...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nome do Destino / Identificador <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                placeholder="Ex: Oferta do Culto da Família, Dízimos Sede, etc."
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#123b63]"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de Recebimento</label>
                <select
                  value={form.tipo_recebimento}
                  onChange={(e) => setForm((p) => ({ ...p, tipo_recebimento: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#123b63]"
                >
                  {TIPOS_RECEBIMENTO.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Congregação Vínculo</label>
                <select
                  value={form.congregacao_id}
                  onChange={(e) => setForm((p) => ({ ...p, congregacao_id: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#123b63]"
                >
                  <option value="">Todas / Sede Geral</option>
                  {congregacoes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Conta / Caixa Destino</label>
                <select
                  value={form.conta_id}
                  onChange={(e) => setForm((p) => ({ ...p, conta_id: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#123b63]"
                >
                  <option value="">Caixa Geral Padrão</option>
                  {contas.map((ct) => (
                    <option key={ct.id} value={ct.id}>
                      {ct.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Categoria Financeira</label>
                <select
                  value={form.categoria_id}
                  onChange={(e) => setForm((p) => ({ ...p, categoria_id: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#123b63]"
                >
                  <option value="">Categoria Automática</option>
                  {categorias.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Valor Fixo Sugerido (Opcional - R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.valor_fixo}
                onChange={(e) => setForm((p) => ({ ...p, valor_fixo: e.target.value }))}
                placeholder="Deixe em branco para permitir qualquer valor"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#123b63]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Descrição / Instruções (Opcional)</label>
              <textarea
                rows={2}
                value={form.descricao}
                onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
                placeholder="Orientação exibida ao doador na página pública"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#123b63]"
              />
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 bg-[#123b63] hover:bg-[#1a4f85] text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar Destino PIX'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
