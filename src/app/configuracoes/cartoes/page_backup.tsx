'use client';

import { useState, useRef, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';

interface ElementoCartao {
  id: string;
  tipo: 'texto' | 'qrcode' | 'logo' | 'foto-membro' | 'chapa';
  x: number;
  y: number;
  largura: number;
  altura: number;
  fontSize?: number;
  cor?: string;
  fonte?: string;
  transparencia?: number;
  borderRadius?: number;
  texto?: string;
  alinhamento?: 'left' | 'center' | 'right';
  negrito?: boolean;
  italico?: boolean;
  sublinhado?: boolean;
  visivel: boolean;
}

interface TemplateCartao {
  id: string;
  nome: string;
  tipoCadastro: 'membro' | 'congregado' | 'ministro';
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
}

const TIPOS_CARTAO = [
  { valor: 'membro', label: 'Cartão de Membro', cor: '#1e40af' },
  { valor: 'congregado', label: 'Cartão de Congregado', cor: '#0891b2' },
  { valor: 'ministro', label: 'Credencial de Ministro', cor: '#d97706' }
];

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
  { tipo: 'chapa', label: 'Chapa', icone: '🔴' }
];

const PLACEHOLDERS_DISPONIVEIS = [
  { campo: 'nome', label: 'Nome', placeholder: '{nome}' },
  { campo: 'matricula', label: 'Matrícula', placeholder: '{matricula}' },
  { campo: 'cpf', label: 'CPF', placeholder: '{cpf}' },
  { campo: 'cargo', label: 'Cargo', placeholder: '{cargo}' },
  { campo: 'supervisao', label: 'Supervisão', placeholder: '{supervisao}' },
  { campo: 'campo', label: 'Campo', placeholder: '{campo}' },
  { campo: 'dataNascimento', label: 'Data de Nascimento', placeholder: '{dataNascimento}' },
  { campo: 'email', label: 'Email', placeholder: '{email}' },
  { campo: 'celular', label: 'Celular', placeholder: '{celular}' },
  { campo: 'whatsapp', label: 'WhatsApp', placeholder: '{whatsapp}' },
  { campo: 'endereco', label: 'Endereço Completo', placeholder: '{endereco}' },
  { campo: 'uniqueId', label: 'ID Único (QR Code)', placeholder: '{uniqueId}' }
];

export default function ConfiguracaoCartoesPage() {
  const [activeMenu, setActiveMenu] = useState('cartoes');
  const [tipoCadastroAtivo, setTipoCadastroAtivo] = useState<'membro' | 'congregado' | 'ministro'>('membro');

  const [templates, setTemplates] = useState<TemplateCartao[]>([
    {
      id: '1',
      nome: 'Template Padrão - Membro',
      tipoCadastro: 'membro',
      corTitulo: '#1e40af',
      temVerso: false,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
      backgroundFile: undefined,
      backgroundUrl: undefined,
      elementos: [
        { id: '1', tipo: 'logo', x: 15, y: 15, largura: 40, altura: 40, cor: '#000', visivel: true, transparencia: 1 },
        { id: '2', tipo: 'texto', x: 70, y: 15, largura: 280, altura: 20, fontSize: 14, cor: '#000', fonte: 'Arial', visivel: true, alinhamento: 'center', negrito: true, italico: false, sublinhado: false, texto: 'NOME DA IGREJA' },
        { id: '3', tipo: 'texto', x: 70, y: 35, largura: 280, altura: 18, fontSize: 8, cor: '#333', fonte: 'Arial', visivel: true, alinhamento: 'center', negrito: false, italico: false, sublinhado: false, texto: 'ENDEREÇO DA IGREJA\nCONTATOS' },
        { id: '4', tipo: 'qrcode', x: 370, y: 15, largura: 80, altura: 80, visivel: true },
        { id: '5', tipo: 'texto', x: 15, y: 110, largura: 435, altura: 14, fontSize: 10, cor: '#000', fonte: 'Arial', visivel: true, alinhamento: 'left', negrito: true, italico: false, sublinhado: false, texto: 'MATRÍCULA: {matricula}' },
        { id: '6', tipo: 'texto', x: 15, y: 130, largura: 435, altura: 14, fontSize: 10, cor: '#000', fonte: 'Arial', visivel: true, alinhamento: 'left', negrito: true, italico: false, sublinhado: false, texto: 'CARGO: {cargo}' },
        { id: '7', tipo: 'texto', x: 15, y: 150, largura: 435, altura: 14, fontSize: 10, cor: '#000', fonte: 'Arial', visivel: true, alinhamento: 'left', negrito: true, italico: false, sublinhado: false, texto: 'NOME: {nome}' }
      ],
      elementosVerso: [],
      backgroundUrlVerso: undefined,
      backgroundFileVerso: undefined
    }
  ]);

  const [templateEmEdicao, setTemplateEmEdicao] = useState<TemplateCartao | null>(templates[0]);
  const [elementoSelecionado, setElementoSelecionado] = useState<ElementoCartao | null>(null);
  const [editandoVerso, setEditandoVerso] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState('');
  const [modalSucesso, setModalSucesso] = useState<{ isOpen: boolean; titulo: string; mensagem: string }>({ isOpen: false, titulo: '', mensagem: '' });

  const fileInputRefFrente = useRef<HTMLInputElement>(null);
  const fileInputRefVerso = useRef<HTMLInputElement>(null);

  // Carregar templates do localStorage ao montar
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const templatesArmazenados = localStorage.getItem('cartoes_templates');
      if (templatesArmazenados) {
        try {
          const parsed = JSON.parse(templatesArmazenados);
          setTemplates(parsed);
          setTemplateEmEdicao(parsed[0] || null);
        } catch (error) {
          console.error('Erro ao carregar templates:', error);
        }
      }
    }
  }, []);

  // Salvar templates no localStorage sempre que mudar
  useEffect(() => {
    if (typeof window !== 'undefined' && templates.length > 0) {
      localStorage.setItem('cartoes_templates', JSON.stringify(templates));
    }
  }, [templates]);

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
    }

    const novoElemento: ElementoCartao = {
      id: Date.now().toString(),
      tipo,
      x: 15,
      y: 15,
      largura: larguraDefault,
      altura: alturaDefault,
      fontSize: fontSizeDefault,
      cor: tipo === 'chapa' ? '#ff0000' : '#000',
      fonte: 'Arial',
      transparencia: (tipo === 'chapa' || tipo === 'logo') ? 1 : undefined,
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

  const salvarTemplate = () => {
    if (!templateEmEdicao) return;

    const templateIndex = templates.findIndex(t => t.id === templateEmEdicao.id);
    const novoTemplate = {
      ...templateEmEdicao,
      atualizadoEm: new Date()
    };

    let novasTemplates: TemplateCartao[];
    if (templateIndex >= 0) {
      novasTemplates = [...templates];
      novasTemplates[templateIndex] = novoTemplate;
    } else {
      novasTemplates = [...templates, { ...novoTemplate, id: Date.now().toString(), criadoEm: new Date() }];
    }

    // Atualizar estado (vai disparar useEffect que salva no localStorage)
    setTemplates(novasTemplates);

    // Mostrar mensagem de sucesso
    setMensagemSucesso('Template salvo com sucesso!');
    setTimeout(() => setMensagemSucesso(''), 3000);
  };

  const duplicarTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    const novoTemplate: TemplateCartao = {
      ...template,
      id: Date.now().toString(),
      nome: `${template.nome} (Cópia)`,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
      elementos: template.elementos.map(e => ({ ...e, id: Date.now().toString() }))
    };

    setTemplates([...templates, novoTemplate]);
    setTemplateEmEdicao(novoTemplate);
  };

  const deletarTemplate = (templateId: string) => {
    const novasTemplates = templates.filter(t => t.id !== templateId);
    setTemplates(novasTemplates);

    if (templateEmEdicao?.id === templateId) {
      setTemplateEmEdicao(novasTemplates[0] || null);
      setElementoSelecionado(null);
    }
  };

  const obterLabelTipo = (tipo: ElementoCartao['tipo']) => {
    return ELEMENTOS_DISPONIVEIS.find(e => e.tipo === tipo)?.label || tipo;
  };

  const obterTituloCor = (tipoCadastro: 'membro' | 'congregado' | 'ministro') => {
    return TIPOS_CARTAO.find(t => t.valor === tipoCadastro)?.cor || '#1e40af';
  };

  const obterPreviewTexto = (texto: string): string => {
    // Mostra um preview com os valores padrão dos placeholders
    if (!texto) return 'Texto';

    let preview = texto;
    PLACEHOLDERS_DISPONIVEIS.forEach(ph => {
      const regex = new RegExp(ph.placeholder.replace(/[{}]/g, '\\$&'), 'g');
      preview = preview.replace(regex, `[${ph.label}]`);
    });

    return preview;
  };

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
            <div className="p-4">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Templates</h2>

              {/* Modelos Padrão do Sistema */}
              <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border-2 border-blue-200">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">✨</span>
                  <h3 className="text-sm font-bold text-gray-800">Modelos Padrão</h3>
                </div>
                <p className="text-xs text-gray-600 mb-3">
                  Use nossos modelos profissionais prontos!
                </p>

                {(() => {
                  const { TEMPLATES_DISPONIVEIS, saveTemplateSelecionado } = require('@/lib/card-templates');
                  const templatePadrao = TEMPLATES_DISPONIVEIS.find((t: any) => t.tipo === tipoCadastroAtivo);

                  if (!templatePadrao) return null;

                  return (
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <div
                        className="w-full h-24 rounded mb-2 flex items-center justify-center text-white font-bold text-sm shadow-sm"
                        style={{
                          background: `linear-gradient(135deg, ${templatePadrao.corPrincipal} 0%, ${templatePadrao.corSecundaria} 100%)`
                        }}
                      >
                        <div className="text-center">
                          <div className="text-2xl mb-1">
                            {templatePadrao.tipo === 'membro' && '👥'}
                            {templatePadrao.tipo === 'congregado' && '🤝'}
                            {templatePadrao.tipo === 'ministro' && '⛪'}
                          </div>
                          <div className="text-xs opacity-90">{templatePadrao.layout.textoBadge}</div>
                        </div>
                      </div>
                      <h4 className="font-semibold text-xs text-gray-800 mb-1">{templatePadrao.nome}</h4>
                      <p className="text-xs text-gray-600 mb-2">{templatePadrao.descricao}</p>
                      <button
                        onClick={() => {
                          const { converterParaTemplateEditavel } = require('@/lib/card-templates');

                          // Converter template padrão em template editável
                          const templateEditavel = converterParaTemplateEditavel(templatePadrao);

                          // Verificar se já existe um template com este ID
                          const jaExiste = templates.some(t => t.id === templateEditavel.id);

                          if (!jaExiste) {
                            // Adicionar à lista de templates
                            const novosTemplates = [...templates, templateEditavel];
                            setTemplates(novosTemplates);
                          }

                          // Definir como template em edição
                          setTemplateEmEdicao(templateEditavel);

                          // Salvar seleção
                          saveTemplateSelecionado(templatePadrao);

                          // Mostrar modal de sucesso
                          setModalSucesso({
                            isOpen: true,
                            titulo: 'Template Ativado!',
                            mensagem: `O template "${templatePadrao.nome}" foi ativado e está pronto para uso. Você pode editá-lo no canvas ou usá-lo diretamente para impressão.`
                          });
                        }}
                        className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition font-semibold text-xs"
                      >
                        ✓ Usar Este Modelo
                      </button>
                    </div>
                  );
                })()}
              </div>

              <hr className="my-4" />

              <h3 className="text-sm font-bold text-gray-800 mb-3">🎨 Meus Templates</h3>

              {/* Abas de Tipos */}
              <div className="space-y-2 mb-4">
                {TIPOS_CARTAO.map((tipo) => (
                  <button
                    key={tipo.valor}
                    onClick={() => setTipoCadastroAtivo(tipo.valor as any)}
                    className={`w-full text-left px-4 py-2 rounded-lg transition ${tipoCadastroAtivo === tipo.valor
                      ? 'bg-blue-100 text-blue-700 border-2 border-blue-400'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    {tipo.label}
                  </button>
                ))}
              </div>

              <hr className="my-4" />

              {/* Lista de Templates */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {templates
                  .filter(t => t.tipoCadastro === tipoCadastroAtivo)
                  .map((template) => (
                    <div
                      key={template.id}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition ${templateEmEdicao?.id === template.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      onClick={() => setTemplateEmEdicao(template)}
                    >
                      <h3 className="font-semibold text-sm text-gray-800">{template.nome}</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {template.elementos.length} elemento{template.elementos.length !== 1 ? 's' : ''}
                      </p>

                      {/* Botões de Ação */}
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicarTemplate(template.id);
                          }}
                          className="flex-1 text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition"
                        >
                          📋 Duplicar
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Tem certeza que deseja deletar "${template.nome}"?`)) {
                              deletarTemplate(template.id);
                            }
                          }}
                          className="flex-1 text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
                        >
                          🗑️ Deletar
                        </button>
                      </div>
                    </div>
                  ))}
              </div>

              <button className="w-full mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold text-sm">
                ➕ Novo Template
              </button>
            </div>
          </div>

          {/* Painel Central - Canvas de Edição */}
          <div className="flex-1 p-6 overflow-y-auto">
            {templateEmEdicao ? (
              <div className="space-y-4">
                {/* Informações do Template */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h2 className="text-lg font-bold text-gray-800 mb-4">Editar Template</h2>

                  <div className="grid grid-cols-3 gap-4 items-end">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Nome do Template
                      </label>
                      <input
                        type="text"
                        value={templateEmEdicao.nome}
                        onChange={(e) => setTemplateEmEdicao({ ...templateEmEdicao, nome: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Tipo
                      </label>
                      <select
                        value={templateEmEdicao.tipoCadastro}
                        onChange={(e) => {
                          const novoTipo = e.target.value as 'membro' | 'congregado' | 'ministro';
                          setTemplateEmEdicao({
                            ...templateEmEdicao,
                            tipoCadastro: novoTipo,
                            corTitulo: obterTituloCor(novoTipo)
                          });
                          setTipoCadastroAtivo(novoTipo);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      >
                        {TIPOS_CARTAO.map(tipo => (
                          <option key={tipo.valor} value={tipo.valor}>{tipo.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2 justify-start pt-6">
                      <input
                        type="checkbox"
                        id="temVerso"
                        checked={templateEmEdicao.temVerso}
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
                          onClick={() => setTemplateEmEdicao({ ...templateEmEdicao, backgroundUrlVerso: undefined, backgroundFileVerso: undefined })}
                          className="mt-2 text-xs text-red-600 hover:text-red-700 font-semibold"
                        >
                          ❌ Remover Imagem
                        </button>
                      ))
                      : (templateEmEdicao.backgroundUrl && (
                        <button
                          onClick={() => setTemplateEmEdicao({ ...templateEmEdicao, backgroundUrl: undefined, backgroundFile: undefined })}
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
                  <h3 className="text-base font-bold text-gray-800 mb-6">Canvas de Edição {editandoVerso ? '(Verso)' : '(Frente)'}</h3>

                  {/* Simulação do Cartão */}
                  <div className="flex justify-center items-start">
                    <div
                      className="relative bg-gray-100 mx-auto transition-all"
                      style={{
                        width: '465px',
                        height: '300px',
                        aspectRatio: '85 / 55',
                        backgroundColor: (editandoVerso ? templateEmEdicao.backgroundUrlVerso : templateEmEdicao.backgroundUrl) ? 'transparent' : '#f3f4f6',
                        backgroundImage: editandoVerso
                          ? (templateEmEdicao.backgroundUrlVerso ? `url('${templateEmEdicao.backgroundUrlVerso}')` : 'none')
                          : (templateEmEdicao.backgroundUrl ? `url('${templateEmEdicao.backgroundUrl}')` : 'none'),
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        borderRadius: '16px',
                        boxShadow: '0 8px 16px rgba(100, 116, 139, 0.15)',
                        border: '1px solid rgba(0, 0, 0, 0.08)'
                      }}
                    >
                      {/* Cabeçalho - Removido */}
                      {/* Deixar apenas os elementos, sem barra azul como no verso */}

                      {/* Elementos */}
                      {(editandoVerso ? (templateEmEdicao.elementosVerso || []) : templateEmEdicao.elementos).map((elemento) => (
                        <div
                          key={elemento.id}
                          onClick={() => setElementoSelecionado(elemento)}
                          className={`absolute cursor-move flex items-center justify-center text-xs overflow-hidden transition font-medium ${elemento.tipo === 'chapa'
                            ? ''
                            : (elementoSelecionado?.id === elemento.id
                              ? 'border-2 border-blue-500 bg-blue-50'
                              : 'border border-gray-300 bg-white hover:border-gray-400')
                            }`}
                          style={{
                            left: `${elemento.x}px`,
                            top: `${elemento.y}px`,
                            width: `${elemento.largura}px`,
                            height: `${elemento.altura}px`,
                            fontSize: elemento.tipo === 'logo' ? '24px' : `${elemento.fontSize || 12}px`,
                            color: elemento.tipo === 'chapa' ? 'transparent' : elemento.cor,
                            fontFamily: elemento.fonte || 'Arial',
                            fontWeight: elemento.negrito ? 'bold' : 'normal',
                            fontStyle: elemento.italico ? 'italic' : 'normal',
                            textDecoration: elemento.sublinhado ? 'underline' : 'none',
                            textAlign: (elemento.alinhamento || 'left') as any,
                            userSelect: 'none',
                            lineHeight: '1.2',
                            borderRadius: elemento.tipo === 'chapa' ? `${elemento.borderRadius || 4}px` : '4px',
                            backgroundColor: elemento.tipo === 'chapa' ? elemento.cor : (elemento.tipo === 'texto' ? 'transparent' : (elementoSelecionado?.id === elemento.id ? undefined : 'white')),
                            opacity: (elemento.tipo === 'chapa' || elemento.tipo === 'logo') ? (elemento.transparencia || 1) : 1,
                            border: elemento.tipo === 'chapa' ? (elementoSelecionado?.id === elemento.id ? '2px solid #3b82f6' : 'none') : undefined,
                            boxShadow: elemento.tipo === 'chapa' && elementoSelecionado?.id !== elemento.id ? '0 2px 4px rgba(0,0,0,0.1)' : undefined
                          }}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                            const novoX = e.clientX - rect.left - elemento.largura / 2;
                            const novoY = e.clientY - rect.top - elemento.altura / 2;
                            atualizarElemento(elemento.id, {
                              x: Math.max(0, novoX),
                              y: Math.max(40, novoY)
                            });
                          }}
                        >
                          {elemento.tipo === 'logo' ? (
                            <span className="text-2xl leading-none">🏛️</span>
                          ) : elemento.tipo === 'chapa' ? (
                            null
                          ) : elemento.tipo === 'foto-membro' ? (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-gray-300 to-gray-400 text-gray-600 text-xs">📸</div>
                          ) : elemento.tipo === 'texto' ? (
                            <div className="w-full h-full px-1 whitespace-pre-wrap break-words flex flex-col justify-center" style={{ textAlign: elemento.alinhamento || 'left', fontSize: `${elemento.fontSize || 12}px` }}>{obterPreviewTexto(elemento.texto || '') || 'Texto'}</div>
                          ) : (
                            <span>{obterLabelTipo(elemento.tipo)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Botões de Ação */}
                <div className="flex gap-4">
                  <button
                    onClick={salvarTemplate}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
                  >
                    💾 Salvar Template
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

              {/* Posição X */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Posição X: {elementoSelecionado.x}px
                </label>
                <input
                  type="range"
                  min="0"
                  max="465"
                  value={elementoSelecionado.x}
                  onChange={(e) => atualizarElemento(elementoSelecionado.id, { x: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>

              {/* Posição Y */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Posição Y: {elementoSelecionado.y}px
                </label>
                <input
                  type="range"
                  min="30"
                  max="300"
                  value={elementoSelecionado.y}
                  onChange={(e) => atualizarElemento(elementoSelecionado.id, { y: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>

              {/* Largura */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Largura: {elementoSelecionado.largura}px
                </label>
                <input
                  type="range"
                  min="15"
                  max="450"
                  value={elementoSelecionado.largura}
                  onChange={(e) => atualizarElemento(elementoSelecionado.id, { largura: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>

              {/* Altura */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Altura: {elementoSelecionado.altura}px
                </label>
                <input
                  type="range"
                  min="12"
                  max="270"
                  value={elementoSelecionado.altura}
                  onChange={(e) => atualizarElemento(elementoSelecionado.id, { altura: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>

              {/* Font Size */}
              {!['qrcode', 'logo', 'foto-membro', 'chapa'].includes(elementoSelecionado.tipo) && (
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Tamanho da Fonte: {elementoSelecionado.fontSize}px
                  </label>
                  <input
                    type="range"
                    min="8"
                    max="32"
                    value={elementoSelecionado.fontSize || 12}
                    onChange={(e) => atualizarElemento(elementoSelecionado.id, { fontSize: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>
              )}

              {/* Fonte */}
              {!['qrcode', 'logo', 'foto-membro', 'chapa'].includes(elementoSelecionado.tipo) && (
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-700 mb-2">Fonte</label>
                  <select
                    value={elementoSelecionado.fonte || 'Arial'}
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

              {/* Conteúdo do Texto - Apenas para tipo 'texto' */}
              {elementoSelecionado.tipo === 'texto' && (
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Conteúdo do Texto
                  </label>
                  <textarea
                    value={elementoSelecionado.texto || ''}
                    onChange={(e) => atualizarElemento(elementoSelecionado.id, { texto: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    rows={3}
                    placeholder="Digite o texto aqui..."
                  />

                  {/* Placeholders Disponíveis */}
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-xs font-semibold text-blue-900 mb-2">📌 Placeholders Disponíveis:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {PLACEHOLDERS_DISPONIVEIS.map((ph) => (
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

              {/* Alinhamento - Apenas para tipo 'texto' */}
              {elementoSelecionado.tipo === 'texto' && (
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-700 mb-2">Alinhamento</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => atualizarElemento(elementoSelecionado.id, { alinhamento: 'left' })}
                      className={`flex-1 px-3 py-2 rounded text-sm font-semibold transition ${elementoSelecionado.alinhamento === 'left' || !elementoSelecionado.alinhamento
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                    >
                      ⬅️ Esquerda
                    </button>
                    <button
                      onClick={() => atualizarElemento(elementoSelecionado.id, { alinhamento: 'center' })}
                      className={`flex-1 px-3 py-2 rounded text-sm font-semibold transition ${elementoSelecionado.alinhamento === 'center'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                    >
                      ↕️ Centro
                    </button>
                    <button
                      onClick={() => atualizarElemento(elementoSelecionado.id, { alinhamento: 'right' })}
                      className={`flex-1 px-3 py-2 rounded text-sm font-semibold transition ${elementoSelecionado.alinhamento === 'right'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                    >
                      ➡️ Direita
                    </button>
                  </div>
                </div>
              )}

              {/* Estilos de Texto - Apenas para tipo 'texto' */}
              {elementoSelecionado.tipo === 'texto' && (
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-700 mb-2">Estilo</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => atualizarElemento(elementoSelecionado.id, { negrito: !elementoSelecionado.negrito })}
                      className={`flex-1 px-3 py-2 rounded font-bold text-sm transition ${elementoSelecionado.negrito
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                    >
                      B
                    </button>
                    <button
                      onClick={() => atualizarElemento(elementoSelecionado.id, { italico: !elementoSelecionado.italico })}
                      className={`flex-1 px-3 py-2 rounded italic text-sm transition ${elementoSelecionado.italico
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                    >
                      I
                    </button>
                    <button
                      onClick={() => atualizarElemento(elementoSelecionado.id, { sublinhado: !elementoSelecionado.sublinhado })}
                      className={`flex-1 px-3 py-2 rounded underline text-sm transition ${elementoSelecionado.sublinhado
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                    >
                      U
                    </button>
                  </div>
                </div>
              )}

              {/* Cor */}
              {!['qrcode', 'foto-membro'].includes(elementoSelecionado.tipo) && (
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {elementoSelecionado.tipo === 'chapa' ? 'Cor da Chapa' : 'Cor do Texto'}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={elementoSelecionado.cor || '#000'}
                      onChange={(e) => atualizarElemento(elementoSelecionado.id, { cor: e.target.value })}
                      className="h-10 w-16 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={elementoSelecionado.cor || '#000'}
                      onChange={(e) => atualizarElemento(elementoSelecionado.id, { cor: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Transparência - Para Chapa e Logo */}
              {(elementoSelecionado.tipo === 'chapa' || elementoSelecionado.tipo === 'logo') && (
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Transparência: {Math.round((elementoSelecionado.transparencia || 1) * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={elementoSelecionado.transparencia || 1}
                    onChange={(e) => atualizarElemento(elementoSelecionado.id, { transparencia: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">0% = Invisível, 100% = Opaco</p>
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
      {modalSucesso.isOpen && (
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
      )}
    </div>
  );
}
