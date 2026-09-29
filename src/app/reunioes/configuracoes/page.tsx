'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import PageLayout from '@/components/PageLayout';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import {
  CHIPS_VARIAVEIS_DISPONIVEIS,
  CONFIG_ADVERTENCIA_PADRAO,
  ConfigAdvertenciaMinisterial,
  interpolarVariaveisAdvertencia,
} from '@/lib/reunioes-config-advertencia';
import {
  ArrowLeft,
  Save,
  RotateCcw,
  Sparkles,
  Eye,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Info,
} from 'lucide-react';

export default function ReunioesConfiguracoesPage() {
  const { ctx, bloqueado } = useRequireModulo('reunioes');
  const planFeatures = usePlanFeatures();

  // Estados dos 4 campos de texto
  const [textoAbertura, setTextoAbertura] = useState(CONFIG_ADVERTENCIA_PADRAO.texto_abertura);
  const [fundamentacaoEstatutaria, setFundamentacaoEstatutaria] = useState(CONFIG_ADVERTENCIA_PADRAO.fundamentacao_estatutaria);
  const [textoComplementar, setTextoComplementar] = useState(CONFIG_ADVERTENCIA_PADRAO.texto_complementar);
  const [textoEncerramento, setTextoEncerramento] = useState(CONFIG_ADVERTENCIA_PADRAO.texto_encerramento);

  // Estados de controle da página
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro'; mensagem: string } | null>(null);
  const [campoFocado, setCampoFocado] = useState<'abertura' | 'fundamentacao' | 'complementar' | 'encerramento'>('abertura');

  // Referências para os textareas para inserção de chips no cursor
  const textareaAberturaRef = useRef<HTMLTextAreaElement>(null);
  const textareaFundamentacaoRef = useRef<HTMLTextAreaElement>(null);
  const textareaComplementarRef = useRef<HTMLTextAreaElement>(null);
  const textareaEncerramentoRef = useRef<HTMLTextAreaElement>(null);

  // Carregar configurações do tenant
  useEffect(() => {
    async function carregarConfiguracoes() {
      try {
        setCarregando(true);
        const res = await fetch('/api/v1/reunioes/configuracoes/advertencia');
        if (!res.ok) {
          throw new Error('Falha ao carregar configurações.');
        }
        const json = await res.json();
        const config: ConfigAdvertenciaMinisterial = json.data;

        if (config) {
          setTextoAbertura(config.texto_abertura ?? CONFIG_ADVERTENCIA_PADRAO.texto_abertura);
          setFundamentacaoEstatutaria(config.fundamentacao_estatutaria ?? '');
          setTextoComplementar(config.texto_complementar ?? CONFIG_ADVERTENCIA_PADRAO.texto_complementar);
          setTextoEncerramento(config.texto_encerramento ?? CONFIG_ADVERTENCIA_PADRAO.texto_encerramento);
        }
      } catch (err: any) {
        console.error('Erro ao buscar configurações:', err);
        setFeedback({
          tipo: 'erro',
          mensagem: 'Não foi possível carregar as configurações personalizadas. Exibindo valores padrão.',
        });
      } finally {
        setCarregando(false);
      }
    }

    if (ctx.ministryId) {
      carregarConfiguracoes();
    }
  }, [ctx.ministryId]);

  // Inserir tag dinâmica no campo ativo
  const handleInserirVariavel = (tag: string) => {
    let textareaRef: React.RefObject<HTMLTextAreaElement | null> | null = null;
    let valorAtual = '';
    let setValor: (v: string) => void = () => {};

    if (campoFocado === 'abertura') {
      textareaRef = textareaAberturaRef;
      valorAtual = textoAbertura;
      setValor = setTextoAbertura;
    } else if (campoFocado === 'fundamentacao') {
      textareaRef = textareaFundamentacaoRef;
      valorAtual = fundamentacaoEstatutaria;
      setValor = setFundamentacaoEstatutaria;
    } else if (campoFocado === 'complementar') {
      textareaRef = textareaComplementarRef;
      valorAtual = textoComplementar;
      setValor = setTextoComplementar;
    } else if (campoFocado === 'encerramento') {
      textareaRef = textareaEncerramentoRef;
      valorAtual = textoEncerramento;
      setValor = setTextoEncerramento;
    }

    const el = textareaRef?.current;
    if (el) {
      const start = el.selectionStart || 0;
      const end = el.selectionEnd || 0;
      const novoTexto = valorAtual.substring(0, start) + tag + valorAtual.substring(end);
      setValor(novoTexto);

      // Restaurar foco e cursor logo após a tag inserida
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + tag.length, start + tag.length);
      }, 0);
    } else {
      // Caso não tenha cursor específico, concatena ao final
      setValor(valorAtual ? `${valorAtual} ${tag}` : tag);
    }
  };

  // Restaurar padrão institucional seguro
  const handleRestaurarPadrao = () => {
    if (
      window.confirm(
        'Tem certeza que deseja restaurar os textos padrão do sistema? Suas alterações não salvas serão substituídas pelos textos normativos padrão.'
      )
    ) {
      setTextoAbertura(CONFIG_ADVERTENCIA_PADRAO.texto_abertura);
      setFundamentacaoEstatutaria(CONFIG_ADVERTENCIA_PADRAO.fundamentacao_estatutaria);
      setTextoComplementar(CONFIG_ADVERTENCIA_PADRAO.texto_complementar);
      setTextoEncerramento(CONFIG_ADVERTENCIA_PADRAO.texto_encerramento);
      setFeedback({
        tipo: 'sucesso',
        mensagem: 'Textos padrão restaurados na tela. Clique em "Salvar Alterações" para confirmar.',
      });
    }
  };

  // Salvar configurações no backend
  const handleSalvar = async () => {
    setFeedback(null);
    setSalvando(true);

    try {
      const payload: ConfigAdvertenciaMinisterial = {
        texto_abertura: textoAbertura.trim(),
        fundamentacao_estatutaria: fundamentacaoEstatutaria.trim(),
        texto_complementar: textoComplementar.trim(),
        texto_encerramento: textoEncerramento.trim(),
      };

      const res = await fetch('/api/v1/reunioes/configuracoes/advertencia', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Erro ao salvar configurações.');
      }

      setFeedback({
        tipo: 'sucesso',
        mensagem: 'Configurações da Carta de Advertência salvas com sucesso no seu ministério!',
      });
    } catch (err: any) {
      setFeedback({
        tipo: 'erro',
        mensagem: err.message || 'Ocorreu um erro ao salvar as configurações.',
      });
    } finally {
      setSalvando(false);
    }
  };

  // Dados de amostra para pré-visualização em tempo real
  const dadosExemplo = {
    nome_ministro: 'Pr. Carlos Eduardo de Alencar',
    cargo: 'Pastor Auxiliar',
    matricula: 'MIN-0042',
    ministerio: 'IGREJA EVANGÉLICA ASSEMBLEIA DE DEUS',
    data_reuniao: '28/09/2026',
    data_falta: '28/09/2026',
    protocolo: 'ADV-2026-0001',
    responsavel: 'Pr. Presidente João Silva',
  };

  const previewAbertura = interpolarVariaveisAdvertencia(textoAbertura, dadosExemplo);
  const previewFundamentacao = fundamentacaoEstatutaria.trim()
    ? interpolarVariaveisAdvertencia(fundamentacaoEstatutaria, dadosExemplo)
    : null;
  const previewComplementar = interpolarVariaveisAdvertencia(textoComplementar, dadosExemplo);
  const previewEncerramento = interpolarVariaveisAdvertencia(textoEncerramento, dadosExemplo);

  // Verificação de plano ou bloqueio
  if (bloqueado) return null;

  if (ctx.loading || planFeatures.loading) {
    return (
      <PageLayout
        title="Configurações de Reuniões"
        description="Configuração de textos normativos e modelo da Carta de Advertência"
        activeMenu="reunioes"
      >
        <div className="flex flex-col items-center justify-center p-20 text-slate-500 gap-3">
          <RefreshCw className="w-7 h-7 animate-spin text-teal-600" />
          <span className="text-sm font-semibold">Carregando configurações...</span>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Configurações de Reuniões"
      description="Personalize os textos normativos institucionais emitidos na Carta de Advertência Ministerial"
      activeMenu="reunioes"
      headerExtra={
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/reunioes"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl transition border border-slate-200 shadow-sm active:scale-95"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
            <span>Voltar para Reuniões</span>
          </Link>

          <button
            type="button"
            onClick={handleRestaurarPadrao}
            disabled={salvando || carregando}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition border border-slate-300 shadow-sm active:scale-95 disabled:opacity-50"
            title="Restaurar textos padrão do sistema"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Restaurar Padrão</span>
          </button>

          <button
            type="button"
            onClick={handleSalvar}
            disabled={salvando || carregando}
            className="inline-flex items-center gap-2 px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50"
          >
            {salvando ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
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
      }
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Banner de Feedback */}
        {feedback && (
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 shadow-sm transition-all ${
              feedback.tipo === 'sucesso'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            {feedback.tipo === 'sucesso' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="text-sm font-medium leading-relaxed flex-1">{feedback.mensagem}</div>
            <button
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              Fechar
            </button>
          </div>
        )}

        {/* ─── BARRA DE VARIÁVEIS DINÂMICAS (CHIPS) ─── */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-slate-800">
              <Sparkles className="w-5 h-5 text-teal-600" />
              <h3 className="text-sm font-bold">Variáveis Dinâmicas Disponíveis</h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Clique em uma variável para inseri-la no campo com foco ativo
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {CHIPS_VARIAVEIS_DISPONIVEIS.map((chip) => (
              <button
                key={chip.tag}
                type="button"
                onClick={() => handleInserirVariavel(chip.tag)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-teal-50 text-slate-700 hover:text-teal-800 text-xs font-mono font-medium rounded-lg border border-slate-200 hover:border-teal-300 transition shadow-2xs group"
                title={`${chip.descricao}`}
              >
                <code className="text-teal-700 font-bold group-hover:text-teal-900">{chip.tag}</code>
                <span className="text-slate-400 text-[11px]">| {chip.label}</span>
              </button>
            ))}
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs text-slate-600 flex items-center gap-2">
            <Info className="w-4 h-4 text-teal-600 flex-shrink-0" />
            <span>
              <strong>Dica:</strong> As variáveis acima são substituídas automaticamente pelos dados reais da convocação, participante e ministério no momento exato em que o PDF é gerado.
            </span>
          </div>
        </section>

        {/* ─── GRID PRINCIPAL: FORMULÁRIO (ESQUERDA) + PRÉ-VISUALIZAÇÃO (DIREITA) ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Coluna da Esquerda: Editores dos 4 Blocos (7 colunas) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Bloco 1: Texto de Abertura / Fundamentação Inicial */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-teal-500" />
                    1. Texto de Abertura / Fundamentação Inicial
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Parágrafo inicial que comunica formalmente a ausência na reunião convocada.
                  </p>
                </div>
                {campoFocado === 'abertura' && (
                  <span className="px-2 py-0.5 bg-teal-100 text-teal-800 text-[10px] font-bold rounded-md uppercase">
                    Foco ativo
                  </span>
                )}
              </div>
              <textarea
                ref={textareaAberturaRef}
                value={textoAbertura}
                onChange={(e) => setTextoAbertura(e.target.value)}
                onFocus={() => setCampoFocado('abertura')}
                rows={4}
                className="w-full text-xs text-slate-800 font-sans border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition leading-relaxed bg-white resize-y"
                placeholder="Ex: Serve a presente para notificar o(a) ministro(a) {{nome_ministro}}..."
              />
            </div>

            {/* Bloco 2: Fundamentação Estatutária / Regimental (Opcional) */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    2. Fundamentação Estatutária / Regimental
                    <span className="text-[10px] font-semibold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md">
                      Opcional
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Cite artigos específicos do Estatuto ou Regimento Interno da sua igreja (deixe em branco se não desejar citar artigos).
                  </p>
                </div>
                {campoFocado === 'fundamentacao' && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-md uppercase">
                    Foco ativo
                  </span>
                )}
              </div>
              <textarea
                ref={textareaFundamentacaoRef}
                value={fundamentacaoEstatutaria}
                onChange={(e) => setFundamentacaoEstatutaria(e.target.value)}
                onFocus={() => setCampoFocado('fundamentacao')}
                rows={3}
                className="w-full text-xs text-slate-800 font-sans border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition leading-relaxed bg-white resize-y"
                placeholder="Ex: Nos termos do Art. 45, § 2º do Estatuto Social e do Regimento Interno deste Ministério, o comparecimento às convocações oficiais constitui dever estatutário do corpo ministerial..."
              />
            </div>

            {/* Bloco 3: Texto Complementar / Orientações */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    3. Texto Complementar / Orientações
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Instruções sobre prazos para apresentar justificativa formal ou contatar a Secretaria Geral.
                  </p>
                </div>
                {campoFocado === 'complementar' && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-md uppercase">
                    Foco ativo
                  </span>
                )}
              </div>
              <textarea
                ref={textareaComplementarRef}
                value={textoComplementar}
                onChange={(e) => setTextoComplementar(e.target.value)}
                onFocus={() => setCampoFocado('complementar')}
                rows={4}
                className="w-full text-xs text-slate-800 font-sans border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition leading-relaxed bg-white resize-y"
                placeholder="Ex: Solicitamos a apresentação formal de justificativa fundamentada à Secretaria Geral no prazo regulamentar de até 5 (cinco) dias úteis..."
              />
            </div>

            {/* Bloco 4: Texto de Encerramento */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    4. Texto de Encerramento / Despedida
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Fórmula ministerial de encerramento, votos fraternais e bênçãos.
                  </p>
                </div>
                {campoFocado === 'encerramento' && (
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded-md uppercase">
                    Foco ativo
                  </span>
                )}
              </div>
              <textarea
                ref={textareaEncerramentoRef}
                value={textoEncerramento}
                onChange={(e) => setTextoEncerramento(e.target.value)}
                onFocus={() => setCampoFocado('encerramento')}
                rows={3}
                className="w-full text-xs text-slate-800 font-sans border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition leading-relaxed bg-white resize-y"
                placeholder="Ex: Na certeza de podermos contar com a sua valiosa dedicação ministerial, subscrevemo-nos fraternalmente em Cristo Jesus."
              />
            </div>
          </div>

          {/* Coluna da Direita: Pré-visualização do Documento em A4 (5 colunas) */}
          <div className="lg:col-span-5 sticky top-6 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-300 shadow-md p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <Eye className="w-4 h-4 text-teal-600" />
                  <span>Pré-visualização do PDF Oficial</span>
                </div>
                <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                  Layout A4 Oficial
                </span>
              </div>

              {/* Simulação visual do papel A4 */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-5 text-slate-800 text-xs shadow-inner space-y-4 leading-relaxed font-serif">
                {/* Cabeçalho da Carta */}
                <div className="text-center pb-3 border-b border-slate-200 space-y-1">
                  <p className="font-sans font-bold text-xs uppercase tracking-wider text-slate-900">
                    {dadosExemplo.ministerio}
                  </p>
                  <p className="font-sans text-[11px] text-slate-600 font-semibold">
                    Secretaria Geral / Mesa Diretora Ministerial
                  </p>
                  <div className="pt-2">
                    <span className="inline-block px-3 py-0.5 bg-slate-200/70 text-slate-800 font-sans font-black text-[11px] uppercase tracking-wider rounded">
                      CARTA DE ADVERTÊNCIA MINISTERIAL
                    </span>
                  </div>
                  <p className="font-sans text-[10px] text-slate-500 pt-0.5">
                    Protocolo: <strong>{dadosExemplo.protocolo}</strong>
                  </p>
                </div>

                {/* Bloco de Destinatário */}
                <div className="bg-white p-3 rounded-lg border border-slate-200 text-[11px] font-sans space-y-1">
                  <div>
                    <span className="text-slate-500">Ao(À) Ministro(a): </span>
                    <strong className="text-slate-900">{dadosExemplo.nome_ministro}</strong>
                  </div>
                  <div className="flex justify-between text-slate-600 text-[10px]">
                    <span>Cargo: <strong>{dadosExemplo.cargo}</strong></span>
                    <span>Matrícula: <strong>{dadosExemplo.matricula}</strong></span>
                  </div>
                </div>

                {/* Corpo do Texto 1: Abertura */}
                <div className="text-justify text-slate-800 text-[11.5px] leading-relaxed">
                  <p>{previewAbertura || <span className="text-slate-400 italic">(Texto de abertura vazio)</span>}</p>
                </div>

                {/* Corpo do Texto 2: Fundamentação Estatutária (se houver) */}
                {previewFundamentacao && (
                  <div className="text-justify text-slate-800 text-[11.5px] leading-relaxed bg-amber-50/50 p-2.5 rounded border-l-2 border-amber-400">
                    <p>{previewFundamentacao}</p>
                  </div>
                )}

                {/* Corpo do Texto 3: Complementar */}
                <div className="text-justify text-slate-800 text-[11.5px] leading-relaxed">
                  <p>{previewComplementar || <span className="text-slate-400 italic">(Texto complementar vazio)</span>}</p>
                </div>

                {/* Corpo do Texto 4: Encerramento */}
                <div className="text-justify text-slate-800 text-[11.5px] leading-relaxed italic">
                  <p>{previewEncerramento || <span className="text-slate-400 italic">(Texto de encerramento vazio)</span>}</p>
                </div>

                {/* Assinaturas Simuladas */}
                <div className="pt-6 grid grid-cols-2 gap-4 text-center font-sans text-[10px] border-t border-slate-200">
                  <div>
                    <div className="border-t border-slate-400 w-3/4 mx-auto pt-1">
                      <strong className="block text-slate-800">{dadosExemplo.responsavel}</strong>
                      <span className="text-slate-500">Pastor Presidente / Secretaria</span>
                    </div>
                  </div>
                  <div>
                    <div className="border-t border-slate-400 w-3/4 mx-auto pt-1">
                      <strong className="block text-slate-800">{dadosExemplo.nome_ministro}</strong>
                      <span className="text-slate-500">Ministro Convocado (Ciente)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 text-center flex items-center justify-center gap-1.5 pt-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                <span>Renderizado dinamicamente via jsPDF com tipografia oficial</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
