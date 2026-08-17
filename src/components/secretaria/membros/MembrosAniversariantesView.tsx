'use client';

import { useState, useMemo, useEffect } from 'react';
import { Cake, Mail, Image as ImageIcon } from 'lucide-react';
import { Membro } from '@/hooks/secretaria/useMembros';

interface MembrosAniversariantesViewProps {
  membros: Membro[];
  setMembroImprimindo?: (membro: Membro) => void;
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function MembrosAniversariantesView({
  membros,
}: MembrosAniversariantesViewProps) {
  const [mesSelecionado, setMesSelecionado] = useState<number>(() => new Date().getMonth() + 1);

  // Configuração da mensagem de Aniversário
  const [mensagemTemplate, setMensagemTemplate] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('@gestaoeklesia/aniversario_msg_template');
      if (saved) return saved;
    }
    return `Feliz Aniversário, {nome}! 🎉\n\nA equipe deseja que Deus te abençoe grandemente neste dia tão especial!\n\nCom carinho,\nSecretaria do Ministério`;
  });

  const [imagemMensagem, setImagemMensagem] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('@gestaoeklesia/aniversario_msg_imagem') || null;
    }
    return null;
  });

  // Salvar no localStorage sempre que a mensagem ou imagem mudar
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('@gestaoeklesia/aniversario_msg_template', mensagemTemplate);
    }
  }, [mensagemTemplate]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (imagemMensagem) {
        localStorage.setItem('@gestaoeklesia/aniversario_msg_imagem', imagemMensagem);
      } else {
        localStorage.removeItem('@gestaoeklesia/aniversario_msg_imagem');
      }
    }
  }, [imagemMensagem]);

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
    const reader = new FileReader();
    reader.onload = (event) => {
      setImagemMensagem(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Gerar mensagem formatada para um membro específico
  const gerarTextoMensagem = (membroNome: string, campo?: string, supervisao?: string) => {
    return mensagemTemplate
      .replace(/{nome}/gi, membroNome || 'Irmão(ã)')
      .replace(/{campo}/gi, campo || '')
      .replace(/{supervisao}/gi, supervisao || '');
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

  // Exemplo de pré-visualização do primeiro membro da lista ou de um nome genérico
  const exemploMembroNome = aniversariantesDoMes.length > 0 ? aniversariantesDoMes[0].nome : 'JOÃO DA SILVA';

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
          <div className="border-b border-gray-100 pb-3">
            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
              <Mail className="w-4 h-4 text-teal-600" />
              Configurar Mensagem Padrão
            </h3>
            <p className="text-[11px] text-gray-400 mt-1">
              Use <code className="text-teal-600 font-semibold">{'{nome}'}</code>, <code className="text-teal-600 font-semibold">{'{campo}'}</code> e <code className="text-teal-600 font-semibold">{'{supervisao}'}</code> como variáveis.
            </p>
          </div>

          {/* Campo de Texto da Mensagem */}
          <div>
            <textarea
              rows={6}
              value={mensagemTemplate}
              onChange={(e) => setMensagemTemplate(e.target.value)}
              className="w-full p-3 border-2 border-teal-400/80 rounded-xl text-xs text-gray-800 focus:outline-none focus:border-teal-600 leading-relaxed font-sans shadow-inner"
              placeholder="Digite o modelo da mensagem de aniversário..."
            />
          </div>

          {/* Imagem da Mensagem (Upload/Preview) */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-700">Imagem da mensagem</label>
            {imagemMensagem ? (
              <div className="relative rounded-xl border border-gray-200 overflow-hidden bg-gray-50 group">
                <img src={imagemMensagem} alt="Imagem da mensagem" className="w-full h-32 object-cover" />
                <button
                  onClick={() => setImagemMensagem(null)}
                  className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded-md shadow hover:bg-red-700 transition"
                >
                  Remover
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition">
                <div className="flex flex-col items-center justify-center pt-3 pb-3">
                  <ImageIcon className="w-6 h-6 text-gray-400 mb-1" />
                  <p className="text-xs text-gray-500 font-medium">Clique para adicionar uma imagem</p>
                  <p className="text-[10px] text-gray-400">PNG, JPG, GIF</p>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handleUploadImagem} />
              </label>
            )}
          </div>

          {/* Card de Pré-Visualização */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">PRÉ-VISUALIZAÇÃO</span>
            <div className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-sans bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
              {gerarTextoMensagem(exemploMembroNome)}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
