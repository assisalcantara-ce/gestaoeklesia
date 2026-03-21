'use client'

// Componente de Sidebar Reorganizada para Seleção de Templates
// Este componente será integrado no page.tsx

import { useAppDialog } from '@/providers/AppDialogProvider';

export function TemplatesSidebar({
    tipoCadastroAtivo,
    setTipoCadastroAtivo,
    templates,
    setTemplates,
    templateEmEdicao,
    setTemplateEmEdicao,
    ativarTemplate,
    deletarTemplate,
    setModalSucesso
}: any) {
    const { getTemplatesPorTipo, converterParaTemplateEditavel } = require('@/lib/card-templates');

    // Derivar o template ativo do array de templates recebido via prop
    const templateAtivo = templates.find((t: any) => t.ativo && (t.tipoCadastro || t.tipo) === tipoCadastroAtivo);
    const dialog = useAppDialog();

    const templatesDisponiveis = getTemplatesPorTipo(tipoCadastroAtivo);

    // 1. Modelos Nativos (sempre aparecem primeiro, sincronizados com o estado se salvos)
    const todosTemplates = templatesDisponiveis.map((nativo: any) => {
        // Tentar encontrar uma versão "salva" deste modelo no estado pelo ID
        const salvo = templates.find((t: any) => t.id === nativo.id);
        // Se encontrou uma versão salva, mesclar com os dados nativos (especialmente previewImage)
        // para garantir que propriedades novas do nativo não se percam
        if (salvo) {
            return {
                ...salvo,
                previewImage: nativo.previewImage || salvo.previewImage, // Priorizar nativo
                backgroundUrl: nativo.backgroundUrl || salvo.backgroundUrl // Priorizar nativo
            };
        }
        return nativo;
    });

    // 2. Encontrar templates EXTRAS (Salvos com IDs que não são nativos)
    // Isso recupera templates que foram salvos com IDs aleatórios (bug anterior) ou personalizados
    const templatesExtras = templates.filter((t: any) =>
        (t.tipoCadastro || t.tipo) === tipoCadastroAtivo &&
        !templatesDisponiveis.some((n: any) => n.id === t.id)
    );

    // 3. Construir lista de exibição: Nativos + Extras
    const listaExibicao = [
        ...todosTemplates,
        ...templatesExtras
    ].filter(Boolean);

    const TIPOS_CARTAO = [
        { valor: 'membro', label: 'Cartão de Membro', cor: '#1e40af' },
        { valor: 'congregado', label: 'Cartão de Congregado', cor: '#0891b2' },
        { valor: 'ministro', label: 'Credencial de Ministro', cor: '#d97706' },
        { valor: 'funcionario', label: 'Cartão de Funcionário', cor: '#6b21a8' }
    ];

    return (
        <div className="p-4">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Templates</h2>

            {/* 1. SELETOR DE TIPO NO TOPO */}
            <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase">
                    Tipo de Cartão
                </label>
                <div className="space-y-2">
                    {TIPOS_CARTAO.map((tipo) => (
                        <button
                            key={tipo.valor}
                            onClick={() => setTipoCadastroAtivo(tipo.valor as any)}
                            className={`w-full text-left px-4 py-2.5 rounded-lg transition font-semibold text-sm ${tipoCadastroAtivo === tipo.valor
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            {tipo.label}
                        </button>
                    ))}
                </div>
            </div>

            <hr className="my-4 border-gray-300" />

            {/* 2. MODELOS PRONTOS (3 OPÇÕES) */}
            <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">✨</span>
                    <h3 className="text-sm font-bold text-gray-800">Modelos Disponíveis</h3>
                </div>

                <div className="space-y-3">
                    {listaExibicao.map((template: any) => {
                        const isAtivo = templateAtivo?.id === template.id;
                        const isSendoEditado = templateEmEdicao?.id === template.id;
                        const isFactory = template.id === 'branco'; // É o placeholder original?
                        const temPreview = template.previewImage !== undefined && template.previewImage !== null && template.previewImage !== '';
                        
                        // Debug para funcionario customizado
                        if (template.id === 'funcionario-customizado') {
                          console.log('🖼️ [TemplatesSidebar] Template:', template.id, 'previewImage:', template.previewImage, 'temPreview:', temPreview);
                        }

                        return (
                            <div
                                key={template.id}
                                className={`bg-white rounded-lg p-3 border-2 transition cursor-pointer hover:shadow-md ${isAtivo
                                    ? 'border-green-500 shadow-lg ring-1 ring-green-500/20'
                                    : isSendoEditado
                                        ? 'border-blue-500 shadow-md ring-1 ring-blue-500/10'
                                        : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                {/* Preview Compacto */}
                                <div
                                    className="w-full h-20 rounded mb-2 flex items-center justify-center text-white font-bold text-xs shadow-sm overflow-hidden"
                                    style={{
                                        background: isFactory
                                            ? 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)'
                                            : temPreview
                                                ? '#f9fafb'
                                                : `linear-gradient(135deg, ${template.corPrincipal} 0%, ${template.corSecundaria} 100%)`
                                    }}
                                >
                                    {temPreview && template.previewImage ? (
                                        <img
                                            src={template.previewImage}
                                            alt={template.nome}
                                            className="w-full h-full object-contain"
                                        />
                                    ) : isFactory ? (
                                        <div className="text-center">
                                            <div className="text-3xl mb-1 text-gray-400">🎨</div>
                                            <div className="text-xs text-gray-500">Criar Personalizado</div>
                                        </div>
                                    ) : (
                                        <div className="w-full h-full p-1.5 flex flex-col justify-between">
                                            {(template.layout?.orientacao || 'horizontal') === 'horizontal' ? (
                                                <>
                                                    <div className="flex items-start gap-0.5">
                                                        <div className="w-3 h-3 bg-white/30 rounded-sm"></div>
                                                        <div className="flex-1 h-2 bg-white/30 rounded"></div>
                                                        <div className="w-3 h-3 bg-white/30 rounded-sm"></div>
                                                    </div>
                                                    <div className="flex gap-0.5">
                                                        <div className="w-6 h-8 bg-white/40 rounded"></div>
                                                        <div className="flex-1 space-y-0.5">
                                                            <div className="h-2 bg-white/50 rounded"></div>
                                                            <div className="h-1.5 bg-white/30 rounded w-3/4"></div>
                                                            <div className="h-1.5 bg-white/30 rounded w-2/3"></div>
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="flex justify-between items-start">
                                                        <div className="w-2 h-2 bg-white/30 rounded-sm"></div>
                                                        <div className="w-3 h-3 bg-white/30 rounded-sm"></div>
                                                    </div>
                                                    <div className="flex flex-col items-center gap-0.5">
                                                        <div className="w-10 h-12 bg-white/40 rounded"></div>
                                                        <div className="w-full h-1.5 bg-white/50 rounded"></div>
                                                        <div className="w-3/4 h-1.5 bg-white/30 rounded"></div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Informações */}
                                <h4 className="font-semibold text-xs text-gray-800 mb-1">
                                    {isFactory ? 'Modelo em Branco' : template.nome}
                                    <span className="block text-[10px] text-gray-500 font-normal">
                                        ID: {template.id.slice(0, 8)}... | {template.elementos?.length || 0} elementos
                                    </span>
                                </h4>


                                {/* BOTOES DE AÇÃO */}
                                {isFactory ? (
                                    <div className="flex flex-col gap-1">
                                        <button
                                            onClick={() => {
                                                // Criar novo template a partir do modelo em branco
                                                const novoId = Date.now().toString();

                                                const templateEditavel = {
                                                    ...converterParaTemplateEditavel(template),
                                                    id: novoId,
                                                    nome: `Personalizado - ${tipoCadastroAtivo.charAt(0).toUpperCase() + tipoCadastroAtivo.slice(1)}`,
                                                    criadoEm: new Date(),
                                                    atualizadoEm: new Date(),
                                                    ativo: true
                                                };

                                                const novosTemplates = [...templates, templateEditavel];
                                                setTemplates(novosTemplates); // Page.tsx dispara o salvar no LocalStorage
                                                ativarTemplate(templateEditavel.id); // Ajusta o Ativo

                                                setModalSucesso({
                                                    isOpen: true,
                                                    titulo: 'Modelo Personalizado Criado!',
                                                    mensagem: `Seu modelo em branco foi criado. Edite e clique em Salvar.`
                                                });
                                            }}
                                            className="w-full px-2 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition font-bold text-xs shadow-sm flex items-center justify-center gap-1"
                                        >
                                            ✨ Criar Novo
                                        </button>

                                        {/* Botão de Recuperação para casos onde o dados foram salvos no template 'branco' por engano */}
                                        {template.elementos && template.elementos.length > 0 && (
                                            <button
                                                onClick={() => {
                                                    console.log('🚑 Recuperando dados para Membro Modelo 01...');

                                                    // Clona o conteúdo do template "bugado" (branco com dados)
                                                    const conteudoRecuperado = converterParaTemplateEditavel(template);

                                                    // Força o ID para o oficial 'membro-classico'
                                                    const templateRecuperado = {
                                                        ...conteudoRecuperado,
                                                        id: 'membro-classico',
                                                        nome: 'Membro Modelo 01', // Garante nome oficial
                                                        variacao: 'classico',     // Garante variação correta
                                                        ativo: true,
                                                        atualizadoEm: new Date()
                                                    };

                                                    // Remove o 'membro-classico' antigo (vazio) e adiciona o recuperado
                                                    // E TAMBÉM remove o template 'branco' bugado para limpar a lista
                                                    // E garante que nenhum outro do mesmo tipo esteja ativo
                                                    const novasTemplates = templates.filter((t: any) =>
                                                        t.id !== 'membro-classico' && t.id !== template.id
                                                    ).map((t: any) => {
                                                        if ((t.tipoCadastro || t.tipo) === tipoCadastroAtivo) {
                                                            return { ...t, ativo: false };
                                                        }
                                                        return t;
                                                    });

                                                    novasTemplates.push(templateRecuperado);

                                                    // ATUALIZAÇÃO ATÔMICA: atualiza a lista E o template em edição
                                                    // Não usamos ativarTemplate() aqui para evitar conflito de estado (stale closure)
                                                    setTemplates(novasTemplates);
                                                    setTemplateEmEdicao(templateRecuperado);

                                                    setModalSucesso({
                                                        isOpen: true,
                                                        titulo: 'Dados Recuperados!',
                                                        mensagem: 'Seus dados foram movidos para o "Membro Modelo 01".'
                                                    });
                                                }}
                                                className="w-full px-2 py-1.5 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition font-bold text-xs shadow-sm flex items-center justify-center gap-1"
                                            >
                                                🚑 Recuperar para Modelo 01
                                            </button>
                                        )}
                                    </div>
                                ) : isAtivo ? (
                                    <button
                                        onClick={() => {
                                            // Recarregar o template (útil se o canvas estiver vazio por bug)
                                            console.log('Recarregando template ativo:', template.id);
                                            ativarTemplate(template.id);
                                        }}
                                        className="w-full px-2 py-1.5 bg-green-100 text-green-700 border border-green-200 rounded font-semibold text-xs cursor-default"
                                    >
                                        ✓ Ativo (Clique para Editar)
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => {
                                            console.log('🔘 Botão "Usar este Modelo" clicado para:', template.id);
                                            console.log('📋 Template objeto completo:', template);
                                            console.log('📋 Função ativarTemplate:', typeof ativarTemplate);
                                            // Sem conversão automática - usar template como está no localStorage
                                            ativarTemplate(template.id);
                                            console.log('✅ ativarTemplate chamada para:', template.id);
                                        }}
                                        className="w-full px-2 py-1.5 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition font-semibold text-xs"
                                    >
                                        Usar este Modelo
                                    </button>
                                )}

                                {/* Se for criado pelo usuário (3º modelo), adicionar botão de excluir */}
                                {template.criado_pelo_usuario && (
                                    <button
                                            onClick={async (e) => {
                                            e.stopPropagation();
                                                const ok = await dialog.confirm({
                                                    title: 'Confirmar',
                                                    type: 'warning',
                                                    message: 'Deseja excluir seu modelo personalizado?',
                                                    confirmText: 'OK',
                                                    cancelText: 'Cancelar',
                                                });
                                                if (ok) {
                                                deletarTemplate(template.id);
                                            }
                                        }}
                                        className="w-full mt-2 text-[10px] text-red-500 hover:text-red-700 underline text-center"
                                    >
                                        Excluir Personalizado
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div >
    );
}
