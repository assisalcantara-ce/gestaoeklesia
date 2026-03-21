'use client';

export const dynamic = 'force-dynamic';

import { useState, useRef, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { TemplatesSidebar } from '@/components/TemplatesSidebar';
import InteractiveCanvas from '@/components/InteractiveCanvas';
import { RichTextEditor } from '@/components/RichTextEditor';
import { createClient } from '@/lib/supabase-client';
import { loadOrgNomenclaturasFromSupabaseOrMigrate } from '@/lib/org-nomenclaturas';
import {
  persistTemplatesSnapshotToSupabase,
  loadTemplatesForCurrentUser,
  type TipoCartao,
} from '@/lib/cartoes-templates-sync';

interface ElementoCartao {
  id: string;
  tipo: 'texto' | 'qrcode' | 'logo' | 'foto-membro' | 'chapa' | 'imagem';
  x: number;
  y: number;
  largura: number;
  altura: number;
  fontSize?: number;
  cor?: string;
  backgroundColor?: string;
  fonte?: string;
  transparencia?: number;
  borderRadius?: number;
  texto?: string;
  alinhamento?: 'left' | 'center' | 'right';
  negrito?: boolean;
  italico?: boolean;
  sublinhado?: boolean;
  sombreado?: boolean;
  imagemUrl?: string; // URL da imagem carregada
  foto?: string; // URL da foto do membro (base64)
  visivel: boolean;
}

interface TemplateCartao {
  id: string;
  nome: string;
  tipoCadastro: 'membro' | 'congregado' | 'ministro' | 'funcionario';
  backgroundUrl?: string;
  backgroundFile?: File;
  elementos: ElementoCartao[];
  corTitulo: string;
  temVerso: boolean;
  elementosVerso?: ElementoCartao[];
  backgroundUrlVerso?: string;
  backgroundFileVerso?: File;
  criadoEm: Date;
  atualizadoEm: Date;
  ativo?: boolean;
  validadeAnos?: number;
  tipoImpressao?: 'pvc' | 'a4';
  orientacao?: 'landscape' | 'portrait';
  previewImage?: string;
  variacao?: string; // 'branco' = layout em branco (design), NÃO marcação de edição
  foiEditado?: boolean; // true quando usuário salva edições (diferente de variacao!)
  criado_pelo_usuario?: boolean; // true apenas para 3º modelo criado pelo usuário
}

// const TIPOS_CARTAO = [
//   { valor: 'membro', label: 'Cartão de Membro', cor: '#1e40af' },
//   { valor: 'congregado', label: 'Cartão de Congregado', cor: '#0891b2' },
//   { valor: 'ministro', label: 'Credencial de Ministro', cor: '#d97706' }
// ];

const FONTES_DISPONIVEIS = [
  { valor: 'Arial', label: 'Arial' },
  { valor: 'Georgia', label: 'Georgia' },
  { valor: 'Times New Roman', label: 'Times New Roman' },
  { valor: 'Courier New', label: 'Courier New' },
  { valor: 'Verdana', label: 'Verdana' },
  { valor: 'Trebuchet MS', label: 'Trebuchet MS' },
  { valor: 'Comic Sans MS', label: 'Comic Sans MS' },
  { valor: 'Impact', label: 'Impact' }
];

const ELEMENTOS_DISPONIVEIS = [
  { tipo: 'texto', label: 'Texto', icone: '📝' },
  { tipo: 'qrcode', label: 'QR Code', icone: '📱' },
  { tipo: 'logo', label: 'Logo', icone: '🏛️' },
  { tipo: 'foto-membro', label: 'Foto do Membro', icone: '📸' },
  { tipo: 'imagem', label: 'Imagem', icone: '🖼️' },
  { tipo: 'chapa', label: 'Chapa', icone: '🔴' }
];

const PLACEHOLDERS_DISPONIVEIS = [
  { campo: 'nome', label: 'Nome', placeholder: '{nome}' },
  { campo: 'matricula', label: 'Matrícula', placeholder: '{matricula}' },
  { campo: 'cpf', label: 'CPF', placeholder: '{cpf}' },
  { campo: 'rg', label: 'RG', placeholder: '{rg}' },
  { campo: 'cargo', label: 'Cargo', placeholder: '{cargo}' },
  { campo: 'supervisao', label: 'Supervisão', placeholder: '{supervisao}' },
  { campo: 'campo', label: 'Campo', placeholder: '{campo}' },
  { campo: 'dataNascimento', label: 'Data de Nascimento', placeholder: '{dataNascimento}' },
  { campo: 'dataBatismo', label: 'Data de Batismo', placeholder: '{dataBatismo}' },
  { campo: 'validade', label: 'Validade', placeholder: '{validade}' },
  { campo: 'filiacao', label: 'Filiação (Pai/Mãe)', placeholder: '{filiacao}' },
  { campo: 'estadoCivil', label: 'Estado Civil', placeholder: '{estadoCivil}' },
  { campo: 'tipoSanguineo', label: 'Tipo Sanguíneo', placeholder: '{tipoSanguineo}' },
  { campo: 'naturalidade', label: 'Naturalidade', placeholder: '{naturalidade}' },
  { campo: 'nacionalidade', label: 'Nacionalidade', placeholder: '{nacionalidade}' },
  { campo: 'email', label: 'Email', placeholder: '{email}' },
  { campo: 'celular', label: 'Celular', placeholder: '{celular}' },
  { campo: 'whatsapp', label: 'WhatsApp', placeholder: '{whatsapp}' },
  { campo: 'endereco', label: 'Endereço Completo', placeholder: '{endereco}' },
  { campo: 'uniqueId', label: 'ID Único (QR Code)', placeholder: '{uniqueId}' },
  // Placeholders de divisões - atualizados dinamicamente com nomenclaturas
  { campo: 'divisao1', label: 'Rótulo da Primeira Divisão', placeholder: '{divisao1}' },
  { campo: 'divisao1_valor', label: 'Valor da Primeira Divisão', placeholder: '{divisao1_valor}' },
  { campo: 'divisao2', label: 'Rótulo da Segunda Divisão', placeholder: '{divisao2}' },
  { campo: 'divisao2_valor', label: 'Valor da Segunda Divisão', placeholder: '{divisao2_valor}' },
  { campo: 'divisao3', label: 'Rótulo da Terceira Divisão', placeholder: '{divisao3}' },
  { campo: 'divisao3_valor', label: 'Valor da Terceira Divisão', placeholder: '{divisao3_valor}' }
];

export default function ConfiguracaoCartoesPage() {
  const supabase = createClient();

  const [activeMenu, setActiveMenu] = useState('cartoes');
  const [tipoCadastroAtivo, setTipoCadastroAtivo] = useState<'membro' | 'congregado' | 'ministro' | 'funcionario'>('membro');
  const [_nomenclaturas, setNomenclaturasState] = useState<any>(null);
  const [placeholdersDisponiveis, setPlaceholdersDisponiveis] = useState(PLACEHOLDERS_DISPONIVEIS);

  const [ministryId, setMinistryId] = useState<string | null>(null);

  const [templates, setTemplates] = useState<TemplateCartao[]>([]);
  const [templateEmEdicao, setTemplateEmEdicao] = useState<TemplateCartao | null>(null);
  const [elementoSelecionado, setElementoSelecionado] = useState<ElementoCartao | null>(null);
  const [elementosSelecionados, setElementosSelecionados] = useState<ElementoCartao[]>([]);
  const [editandoVerso, setEditandoVerso] = useState(false);
  const [loaded, setLoaded] = useState(false); // Flag para evitar efeitos antes do load inicial
  const [mensagemSucesso, setMensagemSucesso] = useState('');
  const [modalSucesso, setModalSucesso] = useState<{ isOpen: boolean; titulo: string; mensagem: string }>({ isOpen: false, titulo: '', mensagem: '' });



  const fileInputRefFrente = useRef<HTMLInputElement>(null);
  const fileInputRefVerso = useRef<HTMLInputElement>(null);

  const generateId = () => {
    try {
      if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
        return (crypto as any).randomUUID() as string;
      }
    } catch {
      // ignore
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  // Carregar templates (Supabase é a fonte de verdade; migração única do localStorage)
  useEffect(() => {
    (async () => {
      if (typeof window === 'undefined') return;

      const { templates: loadedTemplates, ministryId: resolvedMinistryId } = await loadTemplatesForCurrentUser(
        supabase,
        { allowLocalMigration: true }
      );

      setMinistryId(resolvedMinistryId);
      setTemplates(loadedTemplates as any);

      const ativo = (loadedTemplates as any[]).find((t: any) => t.ativo && t.tipoCadastro === 'membro');
      if (ativo) {
        setTemplateEmEdicao(ativo);
      } else {
        const { getTemplatesPorTipo, converterParaTemplateEditavel } = require('@/lib/card-templates');
        const padroes = getTemplatesPorTipo('membro');
        const fallback = padroes.length > 0 ? padroes[0] : null;
        if (fallback) setTemplateEmEdicao(converterParaTemplateEditavel(fallback));
      }

      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Trocar o template em exibição quando mudar o tipo de cadastro (Membro/Congregado/Ministro)
  useEffect(() => {
    if (loaded) {
      console.log('🔄 [EFFECT tipoCadastroAtivo] Mudou para:', tipoCadastroAtivo);
      
      const ativoDoTipo = templates.find((t: any) => t.ativo && t.tipoCadastro === tipoCadastroAtivo);
      if (ativoDoTipo) {
        // NÃO limpar variacao aqui - deixar persistir se foi legitimamente salvo
        console.log('🔄 [EFFECT tipoCadastroAtivo] Encontrou ativo do tipo:', ativoDoTipo.id);
        setTemplateEmEdicao(ativoDoTipo);
      } else {
        // Se não tiver nenhum ativo do tipo, carrega o modelo padrão para aquele tipo
        // PRIORIZAR template customizado se existir
        console.log('🔄 [EFFECT tipoCadastroAtivo] Nenhum ativo encontrado, carregando fallback');
        const { TEMPLATES_CUSTOMIZADOS } = require('@/lib/custom-card-templates');
        const { getTemplatesPorTipo, converterParaTemplateEditavel } = require('@/lib/card-templates');
        const padroes = getTemplatesPorTipo(tipoCadastroAtivo);
        const fallback = padroes.length > 0 ? padroes[0] : null;

        if (fallback) {
          const customizado = TEMPLATES_CUSTOMIZADOS.find((t: any) => t.id === fallback.id);
          const templateParaUsar = customizado || fallback;
          setTemplateEmEdicao(converterParaTemplateEditavel(templateParaUsar));
        }
      }
    }
  }, [tipoCadastroAtivo, loaded, templates]);

  // NOTA: Usamos foiEditado para marcar edições, não variacao
  // variacao é uma propriedade de design (ex: 'branco' = layout em branco)
  // foiEditado marca templates que o usuário salvou com edições




  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && templateEmEdicao) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        console.log('Upload verso:', editandoVerso, 'URL:', dataUrl.substring(0, 50));

        if (editandoVerso) {
          const novoTemplate = {
            ...templateEmEdicao,
            backgroundFileVerso: file,
            backgroundUrlVerso: dataUrl
          };
          setTemplateEmEdicao(novoTemplate);
        } else {
          const novoTemplate = {
            ...templateEmEdicao,
            backgroundFile: file,
            backgroundUrl: dataUrl
          };
          setTemplateEmEdicao(novoTemplate);
        }
      };
      reader.readAsDataURL(file);

      // Limpar o valor do input para permitir re-upload do mesmo arquivo
      e.target.value = '';
    }
  };

  const adicionarElemento = (tipo: ElementoCartao['tipo']) => {
    if (!templateEmEdicao) return;

    // Valores padrão para cada tipo
    let larguraDefault = 90;
    let alturaDefault = 16;
    let fontSizeDefault = 10;

    if (tipo === 'qrcode') {
      larguraDefault = 50;
      alturaDefault = 50;
    } else if (tipo === 'logo') {
      larguraDefault = 40;
      alturaDefault = 40;
    } else if (tipo === 'chapa') {
      larguraDefault = 50;
      alturaDefault = 50;
    } else if (tipo === 'foto-membro') {
      larguraDefault = 35;
      alturaDefault = 45;
    } else if (tipo === 'imagem') {
      larguraDefault = 80;
      alturaDefault = 80;
    }

    const novoElemento: ElementoCartao = {
      id: generateId(),
      tipo,
      x: 15,
      y: 15,
      largura: larguraDefault,
      altura: alturaDefault,
      fontSize: fontSizeDefault,
      cor: tipo === 'chapa' ? '#ff0000' : '#000',
      fonte: 'Arial',
      transparencia: (tipo === 'chapa' || tipo === 'logo' || tipo === 'imagem') ? 1 : undefined,
      borderRadius: tipo === 'chapa' ? 4 : undefined,
      texto: tipo === 'chapa' ? 'CHAPA' : undefined,
      alinhamento: 'left',
      negrito: false,
      italico: false,
      sublinhado: false,
      visivel: true
    };

    if (editandoVerso) {
      const elementosVerso = [...(templateEmEdicao.elementosVerso || []), novoElemento];
      setTemplateEmEdicao({
        ...templateEmEdicao,
        elementosVerso,
        atualizadoEm: new Date()
      });
    } else {
      const elementosAtualizados = [...templateEmEdicao.elementos, novoElemento];
      setTemplateEmEdicao({
        ...templateEmEdicao,
        elementos: elementosAtualizados,
        atualizadoEm: new Date()
      });
    }

    setElementoSelecionado(novoElemento);
  };

  const removerElemento = (elementoId: string) => {
    if (!templateEmEdicao) return;

    if (editandoVerso) {
      const elementosVersoAtualizados = (templateEmEdicao.elementosVerso || []).filter(e => e.id !== elementoId);
      setTemplateEmEdicao({
        ...templateEmEdicao,
        elementosVerso: elementosVersoAtualizados,
        atualizadoEm: new Date()
      });
    } else {
      const elementosAtualizados = templateEmEdicao.elementos.filter(e => e.id !== elementoId);
      setTemplateEmEdicao({
        ...templateEmEdicao,
        elementos: elementosAtualizados,
        atualizadoEm: new Date()
      });
    }

    if (elementoSelecionado?.id === elementoId) {
      setElementoSelecionado(null);
    }
  };

  const adicionarMultiplosElementos = (novoElementos: ElementoCartao[]) => {
    if (!templateEmEdicao || novoElementos.length === 0) return;

    if (editandoVerso) {
      const elementosVerso = [...(templateEmEdicao.elementosVerso || []), ...novoElementos];
      setTemplateEmEdicao({
        ...templateEmEdicao,
        elementosVerso,
        atualizadoEm: new Date()
      });
    } else {
      const elementosAtualizados = [...templateEmEdicao.elementos, ...novoElementos];
      setTemplateEmEdicao({
        ...templateEmEdicao,
        elementos: elementosAtualizados,
        atualizadoEm: new Date()
      });
    }
  };

  // Atalho de Teclado para Deletar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Se a tecla for Delete e houver um elemento selecionado
      if (e.key === 'Delete' && elementoSelecionado) {
        // Verificar se o foco não está em um input ou editor de texto
        const activeElement = document.activeElement as HTMLElement;
        const isInputActive = activeElement && (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.isContentEditable
        );

        if (!isInputActive) {
          removerElemento(elementoSelecionado.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [elementoSelecionado, templateEmEdicao, editandoVerso]);

  const applyNomenclaturasToPlaceholders = (parsed: any) => {
    setNomenclaturasState(parsed);

    const label1 = parsed?.divisaoPrincipal?.opcao1 || 'IGREJA';
    const label2 = parsed?.divisaoSecundaria?.opcao1 || 'CAMPO';
    const label3 = parsed?.divisaoTerciaria?.opcao1 || 'NENHUMA';

    const updated = PLACEHOLDERS_DISPONIVEIS.map(ph => {
      if (ph.placeholder === '{divisao1}') return { ...ph, label: `Rótulo: ${label1}` };
      if (ph.placeholder === '{divisao1_valor}') return { ...ph, label: `Valor: ${label1}` };
      if (ph.placeholder === '{divisao2}') return { ...ph, label: `Rótulo: ${label2}` };
      if (ph.placeholder === '{divisao2_valor}') return { ...ph, label: `Valor: ${label2}` };
      if (ph.placeholder === '{divisao3}') return { ...ph, label: `Rótulo: ${label3}` };
      if (ph.placeholder === '{divisao3_valor}') return { ...ph, label: `Valor: ${label3}` };
      return ph;
    });

    setPlaceholdersDisponiveis(updated);
  };

  const refreshNomenclaturas = async () => {
    const parsed = await loadOrgNomenclaturasFromSupabaseOrMigrate(supabase, { syncLocalStorage: false });
    applyNomenclaturasToPlaceholders(parsed);
  };

  // Carregar nomenclaturas e atualizar labels dos placeholders dinâmicos
  useEffect(() => {
    refreshNomenclaturas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Revalidar quando alguma página sincronizar as nomenclaturas
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'nomenclaturas') {
        refreshNomenclaturas();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const atualizarElemento = (elementoId: string, propriedades: Partial<ElementoCartao>) => {
    if (!templateEmEdicao) return;

    if (editandoVerso) {
      const elementosVersoAtualizados = (templateEmEdicao.elementosVerso || []).map(e =>
        e.id === elementoId ? { ...e, ...propriedades } : e
      );

      setTemplateEmEdicao({
        ...templateEmEdicao,
        elementosVerso: elementosVersoAtualizados,
        atualizadoEm: new Date()
      });
    } else {
      const elementosAtualizados = templateEmEdicao.elementos.map(e =>
        e.id === elementoId ? { ...e, ...propriedades } : e
      );

      setTemplateEmEdicao({
        ...templateEmEdicao,
        elementos: elementosAtualizados,
        atualizadoEm: new Date()
      });
    }

    if (elementoSelecionado?.id === elementoId) {
      setElementoSelecionado({ ...elementoSelecionado, ...propriedades });
    }
  };

  const atualizarMultiplosElementos = (atualizacoes: Array<{ id: string; propriedades: Partial<ElementoCartao> }>) => {
    if (!templateEmEdicao) return;

    // Criar um mapa de atualizações para acesso rápido
    const mapaAtualizacoes = new Map(atualizacoes.map(a => [a.id, a.propriedades]));

    if (editandoVerso) {
      const elementosVersoAtualizados = (templateEmEdicao.elementosVerso || []).map(e => {
        const atualizacao = mapaAtualizacoes.get(e.id);
        return atualizacao ? { ...e, ...atualizacao } : e;
      });

      setTemplateEmEdicao({
        ...templateEmEdicao,
        elementosVerso: elementosVersoAtualizados,
        atualizadoEm: new Date()
      });
    } else {
      const elementosAtualizados = templateEmEdicao.elementos.map(e => {
        const atualizacao = mapaAtualizacoes.get(e.id);
        return atualizacao ? { ...e, ...atualizacao } : e;
      });

      setTemplateEmEdicao({
        ...templateEmEdicao,
        elementos: elementosAtualizados,
        atualizadoEm: new Date()
      });
    }

    // Atualizar elementoSelecionado se ele estiver nas atualizações
    if (elementoSelecionado) {
      const atualizacao = mapaAtualizacoes.get(elementoSelecionado.id);
      if (atualizacao) {
        setElementoSelecionado({ ...elementoSelecionado, ...atualizacao });
      }
    }

    // Atualizar elementosSelecionados
    const novosElementosSelecionados = elementosSelecionados.map(e => {
      const atualizacao = mapaAtualizacoes.get(e.id);
      return atualizacao ? { ...e, ...atualizacao } : e;
    });
    setElementosSelecionados(novosElementosSelecionados);
  };

  const moverCamada = (id: string, direcao: 'para-frente' | 'para-tras' | 'subir' | 'descer') => {
    if (!templateEmEdicao) return;

    const lista = editandoVerso ? (templateEmEdicao.elementosVerso || []) : templateEmEdicao.elementos;
    const index = lista.findIndex(e => e.id === id);
    if (index === -1) return;

    const novosElementos = [...lista];
    const [elemento] = novosElementos.splice(index, 1);

    switch (direcao) {
      case 'para-frente':
        novosElementos.push(elemento);
        break;
      case 'para-tras':
        novosElementos.unshift(elemento);
        break;
      case 'subir':
        novosElementos.splice(Math.min(index + 1, novosElementos.length), 0, elemento);
        break;
      case 'descer':
        novosElementos.splice(Math.max(index - 1, 0), 0, elemento);
        break;
    }

    if (editandoVerso) {
      setTemplateEmEdicao({
        ...templateEmEdicao,
        elementosVerso: novosElementos,
        atualizadoEm: new Date()
      });
    } else {
      setTemplateEmEdicao({
        ...templateEmEdicao,
        elementos: novosElementos,
        atualizadoEm: new Date()
      });
    }
  };


  const resetarTemplate = () => {
    if (!templateEmEdicao) return;

    // Encontrar o template nativo correspondente
    const { TEMPLATES_DISPONIVEIS, converterParaTemplateEditavel } = require('@/lib/card-templates');
    const { TEMPLATES_CUSTOMIZADOS } = require('@/lib/custom-card-templates');
    
    // Priorizar templates customizados que são nativos (templates de ministro), depois os nativos
    let nativoCorrespondente = TEMPLATES_CUSTOMIZADOS.find((t: any) => t.id === templateEmEdicao.id);
    if (!nativoCorrespondente) {
      nativoCorrespondente = TEMPLATES_DISPONIVEIS.find((t: any) => t.id === templateEmEdicao.id);
    }

    if (!nativoCorrespondente) {
      alert('Não foi possível encontrar o template nativo para restaurar.');
      return;
    }

    // Restaurar para a versão nativa padrão
    const templateRestaurado = converterParaTemplateEditavel(nativoCorrespondente);
    // IMPORTANTE: Preservar tipoCadastro do template original
    templateRestaurado.tipoCadastro = templateEmEdicao.tipoCadastro;
    delete templateRestaurado.foiEditado; // Remove marcação de editado ao restaurar
    
    console.log('🔄 Resetando template para modelo nativo:', templateEmEdicao.id, '- tipoCadastro:', templateRestaurado.tipoCadastro);

    // Atualizar templates com a versão restaurada
    let novasTemplates = templates.map(t => {
      if (t.id === templateEmEdicao.id) {
        // Ativa o template restaurado, preservando tipoCadastro
        return { 
          ...templateRestaurado, 
          ativo: true, 
          atualizadoEm: new Date(),
          tipoCadastro: t.tipoCadastro || templateEmEdicao.tipoCadastro // Preservar tipo
        };
      }

      // Desativa outros do MESMO tipo (comparar com o template original para ter certeza do tipo)
      if (t.tipoCadastro && t.tipoCadastro === (templateEmEdicao.tipoCadastro || templateRestaurado.tipoCadastro)) {
        return { ...t, ativo: false };
      }
      return t;
    });

    setTemplates(novasTemplates);
    if (ministryId) {
      persistTemplatesSnapshotToSupabase(supabase, ministryId, (templateEmEdicao.tipoCadastro as TipoCartao) || 'membro', novasTemplates)
        .catch(() => null);
    }
    
    // Garantir que templateEmEdicao tenha tipoCadastro correto
    const templateParaExibir = { 
      ...templateRestaurado, 
      tipoCadastro: templateEmEdicao.tipoCadastro,
      tipo: templateEmEdicao.tipoCadastro
    };
    setTemplateEmEdicao(templateParaExibir);

    // Disparar evento de storage
    if (typeof window !== 'undefined') {
      setTimeout(() => window.dispatchEvent(new Event('storage')), 100);
    }

    // Mostrar mensagem de sucesso
    setMensagemSucesso('Template resetado para o modelo nativo com sucesso!');
    setTimeout(() => setMensagemSucesso(''), 3000);
  };

  const salvarTemplate = () => {
    if (!templateEmEdicao) return;

    // DEBUG MASSIVO
    console.log('🔍 [SALVAR] templateEmEdicao.tipoCadastro:', templateEmEdicao.tipoCadastro);
    console.log('🔍 [SALVAR] tipoCadastroAtivo:', tipoCadastroAtivo);

    // Preparar o objeto base com data atualizada
    const novoTemplate = {
      ...templateEmEdicao,
      atualizadoEm: new Date()
    };

    // PRESERVAR TIPO: O template deve manter seu tipo original
    let templateCorrigido = {
      ...novoTemplate,
      // NÃO forçar tipo da aba ativa - manter tipo original do template
      tipoCadastro: novoTemplate.tipoCadastro || tipoCadastroAtivo, // Preserva original, fallback para aba ativa se vazio
      foiEditado: true // Marca como editado (diferente de variacao que é design)
    };

    console.log('✅ [SALVAR] templateCorrigido.tipoCadastro:', templateCorrigido.tipoCadastro);
    console.log('✅ [SALVAR] templateCorrigido.id:', templateCorrigido.id);

    // --- PROTEÇÃO DE PREVIEW ---
    // Se for um template nativo e perdeu o previewImage, restaurar da fábrica
    if ((templateCorrigido.id === 'congregado-01' || templateCorrigido.id === 'congregado-02' || templateCorrigido.id === 'membro-02' || templateCorrigido.id === 'membro-classico') && !templateCorrigido.previewImage) {
      // Importação dinâmica para evitar referência circular no topo se houver
      // PRIORIZAR template customizado
      const { TEMPLATES_CUSTOMIZADOS } = require('@/lib/custom-card-templates');
      const { TEMPLATES_DISPONIVEIS } = require('@/lib/card-templates');
      const customizado = TEMPLATES_CUSTOMIZADOS.find((t: any) => t.id === templateCorrigido.id);
      const nativo = customizado || TEMPLATES_DISPONIVEIS.find((t: any) => t.id === templateCorrigido.id);
      if (nativo && nativo.previewImage) {
        console.log(`🖼️ Restaurando previewImage para ${templateCorrigido.id}: ${nativo.previewImage}`);
        templateCorrigido.previewImage = nativo.previewImage;
      }
    }

    console.log('💾 Salvando template:', templateCorrigido);

    let templateParaSalvarId = templateCorrigido.id;
    let novasTemplates = [...templates];
    console.log('📊 Estado antes de salvar - Templates no state:', novasTemplates.map(t => ({ id: t.id, variacao: t.variacao, ativo: t.ativo })));

    // Verificar se já existe um template com esse ID
    const indexExistente = novasTemplates.findIndex(t => t.id === templateCorrigido.id);

    // Se for um ID de template oficial/editável (podem ser salvos como branco), remover qualquer versão antiga antes de adicionar a nova
    const TEMPLATES_EDITABLE = ['membro-01', 'membro-02', 'membro-classico', 'congregado-01', 'congregado-02', 'congregado-branco', 'congregado-moderno', 'ministro-classico', 'ministro-02'];
    if (TEMPLATES_EDITABLE.includes(templateCorrigido.id)) {
      if (indexExistente >= 0) {
        console.log('🧹 Removendo versão antiga do template para garantir integridade...');
        novasTemplates.splice(indexExistente, 1);
      }
      // Adicionar como novo (limpo)
      novasTemplates.push(templateCorrigido);
    } else {
      // Lógica padrão para outros templates
      if (indexExistente >= 0) {
        novasTemplates[indexExistente] = { ...templateCorrigido };
      } else {
        const novaId = (!templateCorrigido.id || templateCorrigido.id === 'branco') ? Date.now().toString() : templateCorrigido.id;
        const novoComId = { ...templateCorrigido, id: novaId, criadoEm: new Date() };
        novasTemplates.push(novoComId);
        templateParaSalvarId = novaId;
      }
    }

    // Desativar outros templates do MESMO tipo e ativar o atual
    novasTemplates = novasTemplates.map(t => {
      // Se for o template sendo salvo, ativa
      if (t.id === templateParaSalvarId) {
        return { ...t, ativo: true };
      }

      // Se for de OUTRO tipo, MANTÉM o estado (não mexe)
      if (t.tipoCadastro !== templateCorrigido.tipoCadastro) {
        return t;
      }

      // Se for do MESMO tipo e não é o clicado, desativa
      return { ...t, ativo: false };
    });

    // Atualizar estado
    console.log('📦 [SALVAR] Salvando templates no state:', novasTemplates.map(t => ({ id: t.id, tipoCadastro: t.tipoCadastro, ativo: t.ativo })));
    setTemplates(novasTemplates);
    if (ministryId) {
      persistTemplatesSnapshotToSupabase(
        supabase,
        ministryId,
        (templateCorrigido.tipoCadastro as TipoCartao) || 'membro',
        novasTemplates
      ).catch(() => null);
    }

    // Atualizar template em edição com o template que foi preparado para salvar (garantindo tipoCadastro correto)
    console.log('📝 [SALVAR] templateCorrigido:', { id: templateCorrigido.id, tipoCadastro: templateCorrigido.tipoCadastro, foiEditado: templateCorrigido.foiEditado });
    setTemplateEmEdicao(templateCorrigido);

    // Disparar evento de storage para atualizar outras abas
    if (typeof window !== 'undefined') {
      setTimeout(() => window.dispatchEvent(new Event('storage')), 100);
    }

    // Mostrar mensagem de sucesso
    setMensagemSucesso('Template salvo e ativado com sucesso!');
    setTimeout(() => setMensagemSucesso(''), 3000);
  };

  const copiarJSON = () => {
    if (!templateEmEdicao) return;

    // Preparar JSON limpo (sem arquivos ou objetos circulares)
    const jsonStr = JSON.stringify(templateEmEdicao, (key, value) => {
      if (key === 'backgroundFile' || key === 'backgroundFileVerso') return undefined;
      return value;
    }, 2);

    navigator.clipboard.writeText(jsonStr).then(() => {
      setMensagemSucesso('JSON copiado para a área de transferência!');
      setTimeout(() => setMensagemSucesso(''), 3000);
    }).catch(err => {
      console.error('Erro ao copiar JSON:', err);
      alert('Erro ao copiar para a área de transferência');
    });
  };

  const duplicarTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    const novoTemplate: TemplateCartao = {
      ...template,
      id: generateId(),
      nome: `${template.nome} (Cópia)`,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
      elementos: template.elementos.map(e => ({ ...e, id: generateId() }))
    };

    const next = [...templates, novoTemplate];
    setTemplates(next);
    if (ministryId) {
      persistTemplatesSnapshotToSupabase(supabase, ministryId, (novoTemplate.tipoCadastro as TipoCartao) || 'membro', next)
        .catch(() => null);
    }
    setTemplateEmEdicao(novoTemplate);
  };

  const deletarTemplate = (templateId: string) => {
    // Encontrar o template a deletar
    const templateADeletar = templates.find(t => t.id === templateId);
    if (!templateADeletar) return;

    // Lista de IDs de templates nativos que NÃO podem ser deletados
    const TEMPLATES_NATIVOS = [
      'membro-01', 'membro-branco', 'membro-classico', 'membro-02',
      'congregado-01', 'congregado-branco', 'congregado-02', 'congregado-moderno',
      'ministro-branco', 'ministro-classico', 'ministro-02'
    ];

    // Impedir deleção de templates nativos
    if (TEMPLATES_NATIVOS.includes(templateId)) {
      alert('❌ Não é possível deletar um modelo nativo!\n\nPara resetar este modelo ao estado original, use o botão "🔄 Resetar para Nativo".');
      return;
    }

    // Se chegou aqui, é um modelo personalizado criado pelo usuário
    console.log('🗑️ Deletando template personalizado:', templateId);

    const novasTemplates = templates.filter(t => t.id !== templateId);
    setTemplates(novasTemplates);
    if (ministryId) {
      persistTemplatesSnapshotToSupabase(supabase, ministryId, (templateADeletar.tipoCadastro as TipoCartao) || 'membro', novasTemplates)
        .catch(() => null);
    }

    // Se o template deletado era o que estava em edição, carrega outro
    if (templateEmEdicao?.id === templateId) {
      // Tenta carregar o primeiro template do mesmo tipo, senão qualquer um
      const mesmoTipo = novasTemplates.find(t => t.tipoCadastro === templateADeletar.tipoCadastro);
      setTemplateEmEdicao(mesmoTipo || novasTemplates[0] || null);
      setElementoSelecionado(null);
    }

    // Mostrar mensagem de sucesso
    setMensagemSucesso('Modelo personalizado deletado com sucesso!');
    setTimeout(() => setMensagemSucesso(''), 3000);

    // Disparar evento de storage
    if (typeof window !== 'undefined') {
      setTimeout(() => window.dispatchEvent(new Event('storage')), 100);
    }
  };

  const ativarTemplate = (templateId: string) => {
    console.log('🔄 [ativarTemplate] Ativando template:', templateId);
    // Encontrar o template alvo para saber o tipo
    let targetTemplate = templates.find(t => t.id === templateId);
    console.log('🔄 [ativarTemplate] Encontrado em templates?', !!targetTemplate);
    
    // Se não estiver em templates (é um template nativo não salvo), buscar dos nativos
    if (!targetTemplate) {
      console.log('🔄 [ativarTemplate] Buscando em templates nativos...');
      const { getTemplatesPorTipo } = require('@/lib/card-templates');
      
      // Procurar em TODOS os tipos (incluindo funcionario)
      const tipos = ['membro', 'congregado', 'ministro', 'funcionario'];
      for (const tipo of tipos) {
        const nativosDoTipo = getTemplatesPorTipo(tipo);
        targetTemplate = nativosDoTipo.find((t: any) => t.id === templateId);
        if (targetTemplate) {
          console.log('🔄 [ativarTemplate] Encontrado em nativas do tipo:', tipo);
          // Converter para formato editável
          const { converterParaTemplateEditavel } = require('@/lib/card-templates');
          targetTemplate = {
            ...converterParaTemplateEditavel(targetTemplate),
            tipoCadastro: tipo,
            tipo: tipo,
            ativo: true
          };
          break;
        }
      }
    }
    
    if (!targetTemplate) {
      console.error('❌ [ativarTemplate] Template não encontrado em nenhum lugar:', templateId);
      return;
    }

    const tipoAlvo = targetTemplate.tipoCadastro;
    console.log('🔄 [ativarTemplate] Tipo alvo:', tipoAlvo);

    let novasTemplates = templates.map(t => {
      // Se for o template clicado, ativa
      if (t.id === templateId) {
        const ativado = { ...t, ativo: true };
        console.log('🔄 [ativarTemplate] Ativando:', ativado.id);
        // NÃO remove variacao ao ativar - deixa persistir se foi editado
        return ativado;
      }

      // Se for de outro tipo, MANTÉM o estado atual (não mexe)
      const tipoAtual = t.tipoCadastro;
      if (tipoAtual !== tipoAlvo) {
        return t;
      }

      // Se for do MESMO tipo e não é o clicado, desativa
      console.log('🔄 [ativarTemplate] Desativando:', t.id);
      return { ...t, ativo: false };
    });
    
    // Se targetTemplate não estava em templates, adicionar agora
    if (!templates.find(t => t.id === templateId)) {
      console.log('🔄 [ativarTemplate] Adicionando template nativo ao array:', templateId);
      novasTemplates.push(targetTemplate);
    }
    
    console.log('🔄 [ativarTemplate] Salvando novas templates:', novasTemplates.map(t => ({ id: t.id, ativo: t.ativo })));
    setTemplates(novasTemplates);
    if (ministryId) {
      persistTemplatesSnapshotToSupabase(supabase, ministryId, (tipoAlvo as TipoCartao) || 'membro', novasTemplates)
        .catch(() => null);
    }

    const template = novasTemplates.find(t => t.id === templateId);
    if (template) {
      console.log('🔄 [ativarTemplate] Definindo templateEmEdicao:', template.id);
      setTemplateEmEdicao(template);
    } else {
      console.error('❌ [ativarTemplate] Não conseguiu encontrar template após ativar:', templateId);
    }
  };

  const desativarTemplate = (templateId: string) => {
    const novasTemplates = templates.map(t => {
      if (t.id === templateId) {
        return { ...t, ativo: false };
      }
      return t;
    });
    setTemplates(novasTemplates);
    if (ministryId) {
      const t = templates.find(tt => tt.id === templateId);
      const tipo = (t?.tipoCadastro as TipoCartao) || (t?.tipo as TipoCartao) || 'membro';
      persistTemplatesSnapshotToSupabase(supabase, ministryId, tipo, novasTemplates).catch(() => null);
    }

    if (templateEmEdicao?.id === templateId) {
      // Se o template sendo desativado é o que está no canvas, volta para um modelo em branco limpo
      // PRIORIZAR template customizado se existir
      const { TEMPLATES_CUSTOMIZADOS } = require('@/lib/custom-card-templates');
      const { TEMPLATE_MEMBRO_01, converterParaTemplateEditavel } = require('@/lib/card-templates');
      const customizado = TEMPLATES_CUSTOMIZADOS.find((t: any) => t.id === 'membro-01');
      const templateParaUsar = customizado || TEMPLATE_MEMBRO_01;
      setTemplateEmEdicao(converterParaTemplateEditavel(templateParaUsar));
    }
  };

  const obterLabelTipo = (tipo: ElementoCartao['tipo']) => {
    return ELEMENTOS_DISPONIVEIS.find(e => e.tipo === tipo)?.label || tipo;
  };

  // const obterTituloCor = (tipoCadastro: 'membro' | 'congregado' | 'ministro') => {
  //   return TIPOS_CARTAO.find(t => t.valor === tipoCadastro)?.cor || '#1e40af';
  // };

  // const obterPreviewTexto = (texto: string): string => {
  //   // Mostra um preview com os valores padrão dos placeholders
  //   if (!texto) return 'Texto';

  //   let preview = texto;
  //   PLACEHOLDERS_DISPONIVEIS.forEach(ph => {
  //     const regex = new RegExp(ph.placeholder.replace(/[{}]/g, '\\$&'), 'g');
  //     preview = preview.replace(regex, `[${ph.label}]`);
  //   });

  //   return preview;
  // };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} />

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-6">
          <h1 className="text-3xl font-bold text-gray-800">⚙️ Configuração de Cartões</h1>
          <p className="text-gray-600 mt-1">Personalize os cartões de membro, congregado e ministro</p>
        </div>

        {/* Conteúdo Principal */}
        <div className="flex-1 overflow-auto flex">
          {/* Sidebar Esquerdo - Templates */}
          <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
            <TemplatesSidebar
              tipoCadastroAtivo={tipoCadastroAtivo}
              setTipoCadastroAtivo={setTipoCadastroAtivo}
              templates={templates}
              setTemplates={setTemplates}
              templateEmEdicao={templateEmEdicao}
              setTemplateEmEdicao={setTemplateEmEdicao}
              ativarTemplate={ativarTemplate}
              desativarTemplate={desativarTemplate}
              duplicarTemplate={duplicarTemplate}
              deletarTemplate={deletarTemplate}
              setModalSucesso={setModalSucesso}
            />
          </div>


          {/* Painel Central - Canvas de Edição */}
          <div className="flex-1 p-6 overflow-y-auto">
            {templateEmEdicao ? (
              <div className="space-y-4">
                {/* Informações do Template */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-gray-800">Editar Template</h2>
                    <button
                      onClick={copiarJSON}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-semibold flex items-center gap-2 border border-gray-300"
                      title="Copiar configurações em formato JSON"
                    >
                      📋 Copiar JSON
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-4 items-end">
                    <div className="col-span-1">
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Validade do Cartão
                      </label>
                      <select
                        value={templateEmEdicao.validadeAnos ?? 1}
                        onChange={(e) => setTemplateEmEdicao({ ...templateEmEdicao, validadeAnos: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      >
                        <option value={1}>01 ano</option>
                        <option value={2}>02 anos</option>
                        <option value={3}>03 anos</option>
                        <option value={4}>04 anos</option>
                        <option value={5}>05 anos</option>
                      </select>
                    </div>

                    <div className="col-span-1">
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Tipo de Impressão
                      </label>
                      <select
                        value={templateEmEdicao.tipoImpressao ?? 'pvc'}
                        onChange={(e) => setTemplateEmEdicao({
                          ...templateEmEdicao,
                          tipoImpressao: e.target.value as 'pvc' | 'a4'
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      >
                        <option value="pvc">Impressora PVC</option>
                        <option value="a4">Folha A4 (Jato de Tinta)</option>
                      </select>
                    </div>

                    <div className="col-span-1">
                      <div className="flex items-center gap-2 justify-start h-[42px]">
                        <input
                          type="checkbox"
                          id="temVerso"
                          checked={templateEmEdicao.temVerso ?? false}
                          onChange={(e) => {
                            setTemplateEmEdicao({
                              ...templateEmEdicao,
                              temVerso: e.target.checked,
                              elementosVerso: e.target.checked ? (templateEmEdicao.elementosVerso || []) : undefined
                            });
                            if (!e.target.checked) {
                              setEditandoVerso(false);
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <label htmlFor="temVerso" className="text-sm font-semibold text-gray-700 cursor-pointer">
                          🔄 Cartão com Verso
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Upload de Background */}
                  <div className="mt-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Imagem de Fundo {editandoVerso ? '(Verso)' : '(Frente)'}
                    </label>
                    <div
                      onClick={() => (editandoVerso ? fileInputRefVerso.current?.click() : fileInputRefFrente.current?.click())}
                      className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50 cursor-pointer hover:bg-gray-100 transition"
                    >
                      <input
                        ref={fileInputRefFrente}
                        type="file"
                        accept="image/*"
                        onChange={handleBackgroundUpload}
                        className="hidden"
                      />
                      <input
                        ref={fileInputRefVerso}
                        type="file"
                        accept="image/*"
                        onChange={handleBackgroundUpload}
                        className="hidden"
                      />
                      <div className="text-blue-600 font-semibold mb-2">
                        {editandoVerso
                          ? (templateEmEdicao.backgroundUrlVerso ? '🖼️ Alterar Imagem' : '📤 Fazer Upload')
                          : (templateEmEdicao.backgroundUrl ? '🖼️ Alterar Imagem' : '📤 Fazer Upload')}
                      </div>
                      <p className="text-xs text-gray-500">Formato landscape (85mm × 55mm recomendado)</p>
                    </div>

                    {editandoVerso
                      ? (templateEmEdicao.backgroundUrlVerso && (
                        <button
                          onClick={() => {
                            setTemplateEmEdicao({ ...templateEmEdicao, backgroundUrlVerso: undefined, backgroundFileVerso: undefined });
                            if (fileInputRefVerso.current) fileInputRefVerso.current.value = '';
                          }}
                          className="mt-2 text-xs text-red-600 hover:text-red-700 font-semibold"
                        >
                          ❌ Remover Imagem
                        </button>
                      ))
                      : (templateEmEdicao.backgroundUrl && (
                        <button
                          onClick={() => {
                            setTemplateEmEdicao({ ...templateEmEdicao, backgroundUrl: undefined, backgroundFile: undefined });
                            if (fileInputRefFrente.current) fileInputRefFrente.current.value = '';
                          }}
                          className="mt-2 text-xs text-red-600 hover:text-red-700 font-semibold"
                        >
                          ❌ Remover Imagem
                        </button>
                      ))
                    }
                  </div>

                  {/* Botões Frente/Verso */}
                  {templateEmEdicao.temVerso && (
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => setEditandoVerso(false)}
                        className={`flex-1 py-2 px-3 rounded text-sm font-semibold transition ${!editandoVerso
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                      >
                        📄 Frente
                      </button>
                      <button
                        onClick={() => setEditandoVerso(true)}
                        className={`flex-1 py-2 px-3 rounded text-sm font-semibold transition ${editandoVerso
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                      >
                        📄 Verso
                      </button>
                    </div>
                  )}
                </div>

                {/* Canvas de Edição */}
                <div className="bg-white rounded-lg border border-gray-200 p-4 mt-4">
                  <h3 className="text-base font-bold text-gray-800 mb-6">Canvas de Edição {editandoVerso ? '(Verso)' : '(Frente)'} {templateEmEdicao?.orientacao === 'portrait' ? '🔲 (Portrait)' : '◻️ (Landscape)'}</h3>

                  {/* Simulação do Cartão */}
                  <div className="flex justify-center items-start">
                    <InteractiveCanvas
                      elementos={editandoVerso ? (templateEmEdicao.elementosVerso || []) : (templateEmEdicao.elementos || [])}
                      elementoSelecionado={elementoSelecionado}
                      elementosSelecionados={elementosSelecionados || []}
                      nomenclaturas={_nomenclaturas}
                      backgroundUrl={editandoVerso ? templateEmEdicao.backgroundUrlVerso : templateEmEdicao.backgroundUrl}
                      onElementoSelecionado={setElementoSelecionado}
                      onElementosSelecionados={setElementosSelecionados}
                      onElementoAtualizado={atualizarElemento}
                      onMultiplosElementosAtualizados={atualizarMultiplosElementos}
                      onElementosAdicionados={adicionarMultiplosElementos}
                      onElementoRemovido={removerElemento}
                      larguraCanvas={templateEmEdicao?.orientacao === 'portrait' ? 291 : 465}
                      alturaCanvas={templateEmEdicao?.orientacao === 'portrait' ? 465 : 291}
                    />
                  </div>
                </div>

                {/* Botões de Ação */}
                <div className="flex gap-4 mt-4">
                  <button
                    onClick={salvarTemplate}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
                  >
                    💾 Salvar Template
                  </button>
                  <button
                    onClick={resetarTemplate}
                    disabled={!templateEmEdicao?.foiEditado}
                    className={`flex-1 px-4 py-2 rounded-lg transition font-semibold ${
                      !templateEmEdicao?.foiEditado
                        ? 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-50'
                        : 'bg-orange-600 text-white hover:bg-orange-700'
                    }`}
                    title={!templateEmEdicao?.foiEditado ? 'Este é um template nativo - nada a resetar' : 'Resetar para a versão nativa'}
                  >
                    🔄 Resetar para Nativo
                  </button>
                </div>

                {/* Mensagem de Sucesso */}
                {mensagemSucesso && (
                  <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded-lg text-green-700 font-semibold text-center animate-pulse">
                    ✅ {mensagemSucesso}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500 text-lg">Selecione um template para editar</p>
              </div>
            )}
          </div>

          {/* Sidebar Direito - Propriedades do Elemento */}
          {elementoSelecionado && templateEmEdicao && (
            <div className="w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800">Propriedades</h3>
                <button
                  onClick={() => setElementoSelecionado(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              {/* Tipo */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-700 mb-1 uppercase">
                  Tipo
                </label>
                <div className="text-sm font-medium text-gray-800">
                  {obterLabelTipo(elementoSelecionado.tipo)}
                </div>
              </div>

              {/* Posição e Tamanho - Grid Compacto */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-700 mb-2">Posição e Tamanho</label>
                <div className="grid grid-cols-4 gap-2">
                  {/* Largura */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 mb-1">W</label>
                    <input
                      key="input-largura"
                      type="number"
                      min="15"
                      max="450"
                      value={elementoSelecionado.largura ?? 15}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val)) {
                          atualizarElemento(elementoSelecionado.id, { largura: val });
                        }
                      }}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-500 bg-gray-700 text-white text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>

                  {/* Altura */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 mb-1">H</label>
                    <input
                      key="input-altura"
                      type="number"
                      min="12"
                      max="270"
                      value={elementoSelecionado.altura ?? 12}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val)) {
                          atualizarElemento(elementoSelecionado.id, { altura: val });
                        }
                      }}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-500 bg-gray-700 text-white text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>

                  {/* Posição X */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 mb-1">X</label>
                    <input
                      key="input-x"
                      type="number"
                      min="0"
                      max="465"
                      value={elementoSelecionado.x ?? 0}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val)) {
                          atualizarElemento(elementoSelecionado.id, { x: val });
                        }
                      }}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-500 bg-gray-700 text-white text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>

                  {/* Posição Y */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 mb-1">Y</label>
                    <input
                      key="input-y"
                      type="number"
                      min="0"
                      max="291"
                      value={elementoSelecionado.y ?? 0}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val)) {
                          atualizarElemento(elementoSelecionado.id, { y: val });
                        }
                      }}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-500 bg-gray-700 text-white text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>
              </div>

              {/* Ordenação de Camadas */}
              <div className="mb-6 border-t pt-4">
                <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wider">
                  Ordenação (Camadas)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => moverCamada(elementoSelecionado.id, 'para-frente')}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300 transition text-xs font-bold"
                    title="Trazer para o topo de tudo"
                  >
                    ⏫ Frente
                  </button>
                  <button
                    onClick={() => moverCamada(elementoSelecionado.id, 'para-tras')}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300 transition text-xs font-bold"
                    title="Enviar para o fundo de tudo"
                  >
                    ⏬ Trás
                  </button>
                  <button
                    onClick={() => moverCamada(elementoSelecionado.id, 'subir')}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300 transition text-xs font-bold"
                    title="Subir uma camada"
                  >
                    🔼 Subir
                  </button>
                  <button
                    onClick={() => moverCamada(elementoSelecionado.id, 'descer')}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300 transition text-xs font-bold"
                    title="Descer uma camada"
                  >
                    🔽 Descer
                  </button>
                </div>
              </div>

              {/* Font Size */}
              {!['qrcode', 'logo', 'foto-membro', 'chapa', 'imagem'].includes(elementoSelecionado.tipo) && (
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Tamanho da Fonte: {elementoSelecionado.fontSize}px
                  </label>
                  <input
                    type="range"
                    min="8"
                    max="32"
                    value={elementoSelecionado.fontSize ?? 12}
                    onChange={(e) => atualizarElemento(elementoSelecionado.id, { fontSize: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>
              )}

              {/* Fonte */}
              {!['qrcode', 'logo', 'foto-membro', 'chapa', 'imagem'].includes(elementoSelecionado.tipo) && (
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-700 mb-2">Fonte</label>
                  <select
                    value={elementoSelecionado.fonte ?? 'Arial'}
                    onChange={(e) => atualizarElemento(elementoSelecionado.id, { fonte: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                  >
                    {FONTES_DISPONIVEIS.map((fonte) => (
                      <option key={fonte.valor} value={fonte.valor}>
                        {fonte.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Conteúdo do Texto - Editor Rico */}
              {elementoSelecionado.tipo === 'texto' && (
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Conteúdo e Formatação
                  </label>
                  <RichTextEditor
                    initialValue={elementoSelecionado.texto || ''}
                    onChange={(html) => atualizarElemento(elementoSelecionado.id, { texto: html })}
                    placeholder="Digite o texto aqui..."
                    bold={elementoSelecionado.negrito}
                    onToggleBold={() => atualizarElemento(elementoSelecionado.id, { negrito: !elementoSelecionado.negrito })}
                    italic={elementoSelecionado.italico}
                    onToggleItalic={() => atualizarElemento(elementoSelecionado.id, { italico: !elementoSelecionado.italico })}
                    underline={elementoSelecionado.sublinhado}
                    onToggleUnderline={() => atualizarElemento(elementoSelecionado.id, { sublinhado: !elementoSelecionado.sublinhado })}
                    shadow={elementoSelecionado.sombreado}
                    onToggleShadow={() => atualizarElemento(elementoSelecionado.id, { sombreado: !elementoSelecionado.sombreado })}
                    align={elementoSelecionado.alinhamento || 'left'}
                    onSetAlign={(align) => atualizarElemento(elementoSelecionado.id, { alinhamento: align })}
                    color={elementoSelecionado.cor}
                    onSetColor={(color) => atualizarElemento(elementoSelecionado.id, { cor: color })}
                  />

                  {/* Cor de Fundo - Apenas para tipo 'texto' */}
                  <div className="mb-4 mt-4 border-t pt-4">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Cor de Fundo do Elemento
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={elementoSelecionado.backgroundColor ?? '#ffffff'}
                        onChange={(e) => atualizarElemento(elementoSelecionado.id, { backgroundColor: e.target.value })}
                        className="h-8 w-12 border border-gray-300 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={elementoSelecionado.backgroundColor ?? 'transparent'}
                        onChange={(e) => atualizarElemento(elementoSelecionado.id, { backgroundColor: e.target.value })}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
                        placeholder="transparent"
                      />
                    </div>
                  </div>

                  {/* Cantos Arredondados */}
                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Cantos Arredondados: {elementoSelecionado.borderRadius || 0}px
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      value={elementoSelecionado.borderRadius ?? 0}
                      onChange={(e) => atualizarElemento(elementoSelecionado.id, { borderRadius: parseInt(e.target.value) })}
                      className="w-full accent-blue-600 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Placeholders Disponíveis */}
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-xs font-semibold text-blue-900 mb-2">📌 Placeholders Disponíveis:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {placeholdersDisponiveis.map((ph) => (
                        <button
                          key={ph.campo}
                          onClick={() => {
                            const novoTexto = (elementoSelecionado.texto || '') + ph.placeholder;
                            atualizarElemento(elementoSelecionado.id, { texto: novoTexto });
                          }}
                          className="text-left text-xs px-2 py-1 bg-white border border-blue-200 rounded hover:bg-blue-100 transition cursor-pointer"
                          title={`Clique para adicionar ${ph.placeholder}`}
                        >
                          <span className="font-semibold text-blue-600">{ph.placeholder}</span>
                          <span className="text-gray-600 text-[10px] block">{ph.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Cor */}
              {!['qrcode', 'foto-membro', 'imagem', 'texto', 'logo'].includes(elementoSelecionado.tipo) && (
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {elementoSelecionado.tipo === 'chapa' ? 'Cor da Chapa' : 'Cor do Texto'}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={elementoSelecionado.cor ?? '#000'}
                      onChange={(e) => atualizarElemento(elementoSelecionado.id, { cor: e.target.value })}
                      className="h-10 w-16 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={elementoSelecionado.cor ?? '#000'}
                      onChange={(e) => atualizarElemento(elementoSelecionado.id, { cor: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
              )}



              {/* Transparência - Para Chapa, Logo e Imagem */}
              {(elementoSelecionado.tipo === 'chapa' || elementoSelecionado.tipo === 'logo' || elementoSelecionado.tipo === 'imagem') && (
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Transparência: {Math.round((elementoSelecionado.transparencia || 1) * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={elementoSelecionado.transparencia ?? 1}
                    onChange={(e) => atualizarElemento(elementoSelecionado.id, { transparencia: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">0% = Invisível, 100% = Opaco</p>
                </div>
              )}

              {/* Upload de Imagem - Apenas para elemento tipo 'imagem' */}
              {elementoSelecionado.tipo === 'imagem' && (
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-700 mb-2">
                    Imagem
                  </label>

                  {elementoSelecionado.imagemUrl ? (
                    <div className="space-y-2">
                      {/* Preview da imagem */}
                      <div className="w-full h-32 rounded border-2 border-gray-300 overflow-hidden bg-gray-100 flex items-center justify-center">
                        <img
                          src={elementoSelecionado.imagemUrl}
                          alt="Preview"
                          className="max-w-full max-h-full object-contain"
                          style={{ opacity: elementoSelecionado.transparencia || 1 }}
                        />
                      </div>

                      {/* Botões */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = (e: any) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  const dataUrl = event.target?.result as string;
                                  atualizarElemento(elementoSelecionado.id, { imagemUrl: dataUrl });
                                };
                                reader.readAsDataURL(file);
                              }
                            };
                            input.click();
                          }}
                          className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-xs font-semibold"
                        >
                          🖼️ Alterar
                        </button>
                        <button
                          onClick={() => atualizarElemento(elementoSelecionado.id, { imagemUrl: undefined })}
                          className="flex-1 px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition text-xs font-semibold"
                        >
                          🗑️ Remover
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = (e: any) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const dataUrl = event.target?.result as string;
                              atualizarElemento(elementoSelecionado.id, { imagemUrl: dataUrl });
                            };
                            reader.readAsDataURL(file);
                          }
                        };
                        input.click();
                      }}
                      className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50 cursor-pointer hover:bg-gray-100 transition"
                    >
                      <div className="text-4xl mb-2">📤</div>
                      <div className="text-sm font-semibold text-gray-700">Fazer Upload</div>
                      <p className="text-xs text-gray-500 mt-1">Clique para selecionar uma imagem</p>
                    </div>
                  )}
                </div>
              )}

              {/* Cantos Arredondados - Apenas para Chapa */}
              {elementoSelecionado.tipo === 'chapa' && (
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Cantos: {elementoSelecionado.borderRadius || 4}px
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="25"
                    step="1"
                    value={elementoSelecionado.borderRadius || 4}
                    onChange={(e) => atualizarElemento(elementoSelecionado.id, { borderRadius: parseInt(e.target.value) })}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">0px = Quadrado, 25px = Totalmente Arredondado</p>
                </div>
              )}

              {/* Visibilidade */}
              <div className="mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={elementoSelecionado.visivel}
                    onChange={(e) => atualizarElemento(elementoSelecionado.id, { visivel: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-gray-700">Visível</span>
                </label>
              </div>

              {/* Remover Elemento */}
              <button
                onClick={() => removerElemento(elementoSelecionado.id)}
                className="w-full px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition font-semibold text-sm"
              >
                🗑️ Remover Elemento
              </button>
            </div>
          )}

          {/* Sidebar Direito - Adicionar Elementos */}
          {!elementoSelecionado && templateEmEdicao && (
            <div className="w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Adicionar Elementos</h3>

              <div className="grid grid-cols-2 gap-2">
                {ELEMENTOS_DISPONIVEIS.map((elem) => (
                  <button
                    key={elem.tipo}
                    onClick={() => adicionarElemento(elem.tipo as any)}
                    className="flex flex-col items-center gap-2 p-3 border border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
                  >
                    <span className="text-2xl">{elem.icone}</span>
                    <span className="text-xs font-semibold text-gray-700 text-center">{elem.label}</span>
                  </button>
                ))}
              </div>

              <hr className="my-4" />

              <h4 className="font-semibold text-gray-800 mb-3">Dicas de Uso</h4>
              <ul className="text-xs text-gray-600 space-y-2">
                <li>• Clique nos elementos para selecioná-los</li>
                <li>• Arraste elementos para reposicioná-los</li>
                <li>• Use os sliders para ajustar tamanho e posição</li>
                <li>• QR Code será gerado automaticamente com o ID único</li>
                <li>• Use preview para ver como ficará com dados reais</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Sucesso Customizado */}
      {
        modalSucesso.isOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative animate-fade-in">
              {/* Ícone de Sucesso */}
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>

              {/* Título */}
              <h2 className="text-2xl font-bold text-gray-800 text-center mb-3">
                {modalSucesso.titulo}
              </h2>

              {/* Mensagem */}
              <p className="text-gray-600 text-center mb-8 leading-relaxed">
                {modalSucesso.mensagem}
              </p>

              {/* Botão */}
              <button
                onClick={() => setModalSucesso({ isOpen: false, titulo: '', mensagem: '' })}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition font-semibold text-lg shadow-lg"
              >
                Entendi!
              </button>
            </div>
          </div>
        )
      }
    </div >
  );
}
