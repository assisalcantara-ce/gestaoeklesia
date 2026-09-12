'use client';

import { useState, useMemo, useEffect } from 'react';
import { Cake, Mail, Image as ImageIcon, CheckCircle, AlertCircle, Save, Trash2, Loader2, Sparkles } from 'lucide-react';
import { Membro } from '@/hooks/secretaria/useMembros';
import { authenticatedFetch } from '@/lib/api-client';

interface MembrosAniversariantesViewProps {
  membros: Membro[];
  setMembroImprimindo?: (membro: Membro) => void;
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const DEFAULT_TEMPLATE = `Feliz Aniversário, {nome}! 🎉\n\nA equipe deseja que Deus te abençoe grandemente neste dia tão especial!\n\nCom carinho,\nSecretaria do Ministério`;

export default function MembrosAniversariantesView({
  membros,
}: MembrosAniversariantesViewProps) {
  const [mesSelecionado, setMesSelecionado] = useState<number>(() => new Date().getMonth() + 1);

  // Estados da Mensagem e Imagem
  const [mensagemTemplate, setMensagemTemplate] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('@gestaoeklesia/aniversario_msg_template');
      if (saved) return saved;
    }
    return DEFAULT_TEMPLATE;
  });

  const [imagemMensagem, setImagemMensagem] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('@gestaoeklesia/aniversario_msg_imagem') || null;
    }
    return null;
  });

  // Estados para controle de Dirty State (Alterações Não Salvas)
  const [savedMensagem, setSavedMensagem] = useState<string>(mensagemTemplate);
  const [savedImagem, setSavedImagem] = useState<string | null>(imagemMensagem);

  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Carregar configurações oficiais do backend na montagem
  useEffect(() => {
    let isMounted = true;
    async function loadBackendConfig() {
      try {
        const res = await authenticatedFetch('/api/v1/configuracoes/perfil', {
          method: 'GET',
          cache: 'no-store',
        });
        if (!res.ok) return;
        const json = await res.json();
        if (json?.data && isMounted) {
          const remoteMsg = json.data.mensagem_aniversario;
          const remoteImg = json.data.imagem_aniversario;

          if (remoteMsg && typeof remoteMsg === 'string' && remoteMsg.trim()) {
            setMensagemTemplate(remoteMsg);
            setSavedMensagem(remoteMsg);
            localStorage.setItem('@gestaoeklesia/aniversario_msg_template', remoteMsg);
          }
          if (remoteImg !== undefined) {
            setImagemMensagem(remoteImg || null);
            setSavedImagem(remoteImg || null);
            if (remoteImg) {
              localStorage.setItem('@gestaoeklesia/aniversario_msg_imagem', remoteImg);
            } else {
              localStorage.removeItem('@gestaoeklesia/aniversario_msg_imagem');
            }
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar configurações de aniversário do backend:', err);
      }
    }

    loadBackendConfig();
    return () => {
      isMounted = false;
    };
  }, []);

  // Calcular se há alterações não salvas (dirty state)
  const hasUnsavedChanges = useMemo(() => {
    return mensagemTemplate !== savedMensagem || imagemMensagem !== savedImagem;
  }, [mensagemTemplate, imagemMensagem, savedMensagem, savedImagem]);

  // Função para Salvar Alterações
  const handleSalvarAlteracoes = async () => {
    if (saving) return;
    setSaving(true);
    setSaveFeedback(null);

    try {
      // 1. Persistir no backend
      const res = await authenticatedFetch('/api/v1/configuracoes/perfil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensagem_aniversario: mensagemTemplate,
          imagem_aniversario: imagemMensagem,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.detail || `Erro HTTP ${res.status}`);
      }

      // 2. Atualizar cache do localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('@gestaoeklesia/aniversario_msg_template', mensagemTemplate);
        if (imagemMensagem) {
          localStorage.setItem('@gestaoeklesia/aniversario_msg_imagem', imagemMensagem);
        } else {
          localStorage.removeItem('@gestaoeklesia/aniversario_msg_imagem');
        }
      }

      // 3. Atualizar estados de controle
      setSavedMensagem(mensagemTemplate);
      setSavedImagem(imagemMensagem);
      setSaveFeedback({ type: 'success', message: 'Configurações salvas com sucesso.' });

      // Limpar toast de sucesso após 4 segundos
      setTimeout(() => {
        setSaveFeedback((current) => (current?.type === 'success' ? null : current));
      }, 4000);
    } catch (err: any) {
      console.error('Erro ao salvar mensagem de aniversário:', err);
      setSaveFeedback({
        type: 'error',
        message: err.message || 'Falha ao salvar configurações. Tente novamente.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Contagem de aniversariantes por mês para os cards superiores
  const contagemPorMes = useMemo(() => {
    const contagem: Record<number, number> = {
      1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0,
      7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0
    };

    membros.forEach(m => {
      if (!m.dataNascimento) return;
      let mesMembro = 0;
      const raw = m.dataNascimento.trim();
      if (raw.includes('-')) {
        const parts = raw.split('-');
        mesMembro = parseInt(parts[1], 10);
      } else if (raw.includes('/')) {
        const parts = raw.split('/');
        mesMembro = parseInt(parts[1], 10);
      }
      if (mesMembro >= 1 && mesMembro <= 12) {
        contagem[mesMembro] += 1;
      }
    });

    return contagem;
  }, [membros]);

  // Lista de aniversariantes filtrados do mês selecionado
  const aniversariantesDoMes = useMemo(() => {
    return membros.filter(membro => {
      if (!membro.dataNascimento) return false;
      let mesMembro = 0;
      const raw = membro.dataNascimento.trim();
      if (raw.includes('-')) {
        const parts = raw.split('-');
        mesMembro = parseInt(parts[1], 10);
      } else if (raw.includes('/')) {
        const parts = raw.split('/');
        mesMembro = parseInt(parts[1], 10);
      }
      return mesMembro === mesSelecionado;
    }).sort((a, b) => {
      const getDia = (dt: string) => {
        if (dt.includes('-')) return parseInt(dt.split('-')[2], 10) || 0;
        if (dt.includes('/')) return parseInt(dt.split('/')[0], 10) || 0;
        return 0;
      };
      return getDia(a.dataNascimento || '') - getDia(b.dataNascimento || '');
    });
  }, [membros, mesSelecionado]);

  const formatarDia = (dataNascimento?: string) => {
    if (!dataNascimento) return '-';
    let dia = '-';
    if (dataNascimento.includes('-')) {
      const parts = dataNascimento.split('-');
      dia = parts[2];
    } else if (dataNascimento.includes('/')) {
      dia = dataNascimento.split('/')[0];
    }
    return dia.padStart(2, '0');
  };

  const handleUploadImagem = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800 * 1024) {
      alert('A imagem é muito grande. Escolha uma imagem de até 800KB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setImagemMensagem(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Gerar mensagem formatada para um membro específico com substituição de variáveis
  const gerarTextoMensagem = (membroNome: string, campo?: string, supervisao?: string) => {
    return (mensagemTemplate || '')
      .replace(/{nome}/gi, membroNome || 'Irmão(ã)')
      .replace(/{campo}/gi, campo || 'Sede')
      .replace(/{supervisao}/gi, supervisao || 'Geral')
      .replace(/{supervisor}/gi, supervisao || 'Geral');
  };

  // Enviar WhatsApp via web API nativa
  const handleEnviarWhatsApp = (membro: Membro) => {
    const celularOuZap = (membro.whatsapp || membro.celular || '').replace(/\D/g, '');
    if (!celularOuZap) {
      alert(`O membro ${membro.nome} não possui número de celular/WhatsApp cadastrado.`);
      return;
    }

    const numeroCompleto = celularOuZap.length <= 11 ? `55${celularOuZap}` : celularOuZap;
    const texto = encodeURIComponent(gerarTextoMensagem(membro.nome, membro.campo, membro.supervisao));
    
    // Abre a API do WhatsApp Web / Desktop conectada no PC
    window.open(`https://web.whatsapp.com/send?phone=${numeroCompleto}&text=${texto}`, '_blank');
  };

  // Enviar E-mail nativo
  const handleEnviarEmail = (membro: Membro) => {
    if (!membro.email) {
      alert(`O membro ${membro.nome} não possui e-mail cadastrado.`);
      return;
    }
    const assunto = encodeURIComponent(`Feliz Aniversário, ${membro.nome}! 🎉`);
    const corpo = encodeURIComponent(gerarTextoMensagem(membro.nome, membro.campo, membro.supervisao));
    window.open(`mailto:${membro.email}?subject=${assunto}&body=${corpo}`, '_blank');
  };

  // Dados demonstrativos para a pré-visualização
  const primeiroMembro = aniversariantesDoMes[0];
  const previewMembro = {
    nome: primeiroMembro?.nome || 'JOÃO DA SILVA',
    campo: primeiroMembro?.campo || 'Sede Principal',
    supervisao: primeiroMembro?.supervisao || 'Supervisão Central',
  };

  return (
    <div className="space-y-6">
      {/* 1. Grid de Meses (Card 4x3) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {MESES.map((nomeMes, index) => {
          const numMes = index + 1;
          const isSelected = mesSelecionado === numMes;
          const qtd = contagemPorMes[numMes] || 0;

          return (
            <button
              key={nomeMes}
              onClick={() => setMesSelecionado(numMes)}
              className={`p-4 rounded-xl border transition-all text-left flex flex-col justify-between ${
                isSelected
                  ? 'border-teal-500 bg-teal-50/50 shadow-md ring-2 ring-teal-500/20'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <span className={`text-xs font-semibold ${isSelected ? 'text-teal-700 font-bold' : 'text-gray-500'}`}>
                {nomeMes}
              </span>
              <span className={`text-2xl font-bold mt-2 ${isSelected ? 'text-teal-900' : 'text-gray-800'}`}>
                {qtd}
              </span>
            </button>
          );
        })}
      </div>

      {/* 2. Conteúdo Principal: Tabela de Aniversariantes + Configurador de Mensagem */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Lado Esquerdo: Lista de Aniversariantes */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <h3 className="font-bold text-gray-800 flex items-center gap-2 text-base">
              <Cake className="w-5 h-5 text-teal-600" />
              Aniversariantes de {MESES[mesSelecionado - 1]} ({aniversariantesDoMes.length})
            </h3>
          </div>

          {aniversariantesDoMes.length === 0 ? (
            <div className="p-12 text-center text-gray-500 space-y-3">
              <Cake className="w-12 h-12 text-gray-300 mx-auto" />
              <p className="font-semibold text-gray-600">Nenhum aniversariante em {MESES[mesSelecionado - 1]}</p>
              <p className="text-xs text-gray-400">Não há membros com data de nascimento cadastrada neste mês.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-100/80 text-gray-600 font-semibold border-b border-gray-200 text-xs">
                  <tr>
                    <th className="px-4 py-3 text-center w-14">Dia</th>
                    <th className="px-4 py-3">Nome</th>
                    <th className="px-4 py-3">Campo / Congregação</th>
                    <th className="px-4 py-3">Contato</th>
                    <th className="px-4 py-3 text-center">Enviar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {aniversariantesDoMes.map(membro => {
                    const dia = formatarDia(membro.dataNascimento);
                    const temContato = !!(membro.whatsapp || membro.celular);

                    return (
                      <tr key={membro.id} className="hover:bg-gray-50/80 transition">
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-teal-100 text-teal-800 font-bold text-xs">
                            {dia}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-gray-800 uppercase text-xs">{membro.nome}</div>
                          <div className="text-[11px] text-gray-400 capitalize">{membro.tipoCadastro || 'membro'}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {membro.campo || membro.congregacao || '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          <div>{membro.whatsapp || membro.celular || '—'}</div>
                          {membro.email && (
                            <div className="text-[10px] text-gray-400 truncate max-w-[140px]">{membro.email}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleEnviarWhatsApp(membro)}
                              title={temContato ? "Enviar WhatsApp conectado" : "Sem contato cadastrado"}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white transition flex items-center gap-1 ${
                                temContato
                                  ? 'bg-emerald-500 hover:bg-emerald-600 shadow-sm'
                                  : 'bg-gray-300 cursor-not-allowed'
                              }`}
                            >
                              <span>WhatsApp</span>
                            </button>
                            <button
                              onClick={() => handleEnviarEmail(membro)}
                              title={membro.email ? "Enviar E-mail" : "Sem e-mail cadastrado"}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white transition flex items-center gap-1 ${
                                membro.email
                                  ? 'bg-blue-600 hover:bg-blue-700 shadow-sm'
                                  : 'bg-gray-300 cursor-not-allowed'
                              }`}
                            >
                              <span>E-mail</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Lado Direito: Painel de Configuração da Mensagem Padrão */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5 space-y-5">
          <div className="border-b border-gray-100 pb-3 flex items-start justify-between gap-2">
            <div>
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                <Mail className="w-4 h-4 text-teal-600" />
                Configurar Mensagem Padrão
              </h3>
              <p className="text-[11px] text-gray-500 mt-1">
                Personalize o modelo institucional com as variáveis <code className="text-teal-600 font-semibold">{'{nome}'}</code>, <code className="text-teal-600 font-semibold">{'{campo}'}</code> e <code className="text-teal-600 font-semibold">{'{supervisao}'}</code>.
              </p>
            </div>
            {hasUnsavedChanges && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 whitespace-nowrap border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Não salvo
              </span>
            )}
          </div>

          {/* Campo de Texto da Mensagem */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-700">
              Texto da Mensagem
            </label>
            <textarea
              rows={5}
              value={mensagemTemplate}
              onChange={(e) => setMensagemTemplate(e.target.value)}
              className="w-full p-3 border-2 border-teal-400/80 rounded-xl text-xs text-gray-800 focus:outline-none focus:border-teal-600 leading-relaxed font-sans shadow-inner transition-colors"
              placeholder="Digite o modelo da mensagem de aniversário..."
            />
          </div>

          {/* Imagem da Mensagem (Upload/Preview) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-gray-700">
                Imagem da Mensagem (Opcional)
              </label>
              {imagemMensagem && (
                <button
                  type="button"
                  onClick={() => setImagemMensagem(null)}
                  className="text-[11px] font-semibold text-red-600 hover:text-red-700 flex items-center gap-1 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remover Imagem
                </button>
              )}
            </div>

            {imagemMensagem ? (
              <div className="relative rounded-xl border border-gray-200 overflow-hidden bg-gray-50 group">
                <img
                  src={imagemMensagem}
                  alt="Imagem da mensagem"
                  className="w-full h-32 object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <label className="px-3 py-1.5 bg-white/90 hover:bg-white text-gray-800 text-xs font-bold rounded-lg cursor-pointer transition shadow-sm">
                    Alterar Imagem
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleUploadImagem}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setImagemMensagem(null)}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition shadow-sm"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition group">
                <div className="flex flex-col items-center justify-center pt-2 pb-2">
                  <ImageIcon className="w-5 h-5 text-gray-400 group-hover:text-teal-600 mb-1 transition-colors" />
                  <p className="text-xs text-gray-600 font-medium">Clique para adicionar uma imagem</p>
                  <p className="text-[10px] text-gray-400">PNG, JPG, GIF até 800KB</p>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handleUploadImagem} />
              </label>
            )}
          </div>

          {/* Card de Pré-Visualização Fiel */}
          <div className="bg-gray-50/80 border border-gray-200 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                Pré-visualização
              </span>
              <span className="text-[10px] text-gray-400 italic">
                Simulação real da mensagem
              </span>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
              {/* Imagem na Pré-Visualização (se configurada) */}
              {imagemMensagem && (
                <div className="w-full bg-gray-100 overflow-hidden flex items-center justify-center max-h-48">
                  <img
                    src={imagemMensagem}
                    alt="Pré-visualização da imagem"
                    className="w-full h-auto max-h-48 object-cover"
                  />
                </div>
              )}

              {/* Texto com variáveis substituídas */}
              <div className="p-3.5 text-xs text-gray-800 whitespace-pre-wrap leading-relaxed font-sans">
                {gerarTextoMensagem(previewMembro.nome, previewMembro.campo, previewMembro.supervisao)}
              </div>
            </div>
          </div>

          {/* Feedback de Notificação / Toast Inline */}
          {saveFeedback && (
            <div
              className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-medium transition-all ${
                saveFeedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-red-50 text-red-800 border-red-200'
              }`}
            >
              {saveFeedback.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{saveFeedback.message}</span>
            </div>
          )}

          {/* Rodapé de Ações com Botão Salvar */}
          <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-3">
            <div>
              {hasUnsavedChanges ? (
                <span className="text-[11px] font-medium text-amber-700 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Alterações não salvas
                </span>
              ) : (
                <span className="text-[11px] font-medium text-gray-400 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  Tudo atualizado
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleSalvarAlteracoes}
              disabled={saving || !hasUnsavedChanges}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm ${
                saving
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : hasUnsavedChanges
                  ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/20 shadow-md ring-2 ring-teal-600/30'
                  : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
              }`}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Salvar Alterações</span>
                </>
              )}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}

