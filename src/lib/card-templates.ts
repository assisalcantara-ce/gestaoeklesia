// Utilitário para gerenciar templates de cartões

export type TipoCartao = 'membro' | 'congregado' | 'ministro' | 'funcionario';
export type VariacaoTemplate = 'classico' | 'moderno' | 'branco';

export interface CardTemplate {
    id: string;
    nome: string;
    tipo: TipoCartao;
    variacao: VariacaoTemplate;
    descricao: string;
    corPrincipal: string;
    corSecundaria: string;
    corTexto: string;
    backgroundUrl?: string; // URL da imagem de fundo padrão
    previewImage?: string; // Caminho para a imagem de preview/miniatura
    layout: {
        mostrarFoto: boolean;
        mostrarQRCode: boolean;
        mostrarMatricula: boolean;
        mostrarCargo: boolean;
        mostrarBadge: boolean;
        textoBadge?: string;
        orientacao: 'horizontal' | 'vertical';
    };
}

// ========== CARTÃO DE MEMBRO ==========

// Modelo 1: Membro Modelo 01 (Restaurado)
export const TEMPLATE_MEMBRO_CLASSICO: CardTemplate = {
    id: 'membro-classico',
    nome: 'Membro Modelo 01',
    tipo: 'membro',
    variacao: 'classico',
    descricao: 'Layout clássico com frente e verso completo',
    corPrincipal: '#6b7280',
    corSecundaria: '#e5e7eb',
    corTexto: '#000000',
    backgroundUrl: '/img/card_membro1f.png',
    previewImage: '/img/card1m.jpg',
    layout: {
        mostrarFoto: true,
        mostrarQRCode: true,
        mostrarMatricula: true,
        mostrarCargo: true,
        mostrarBadge: false,
        orientacao: 'horizontal'
    }
};

// Modelo 1: Congregado Modelo 01 (Layout Clássico que era de Membros)
export const TEMPLATE_CONGREGADO_01: CardTemplate = {
    id: 'congregado-01',
    nome: 'Congregado Modelo 01',
    tipo: 'congregado',
    variacao: 'classico',
    descricao: 'Layout horizontal com logo, foto do membro, QR code e informações principais',
    corPrincipal: '#1e40af',
    corSecundaria: '#3b82f6',
    corTexto: '#000000',
    backgroundUrl: '/img/bgcard_membro1.jpg',
    previewImage: '/img/card1c.jpg',
    layout: {
        mostrarFoto: true,
        mostrarQRCode: true,
        mostrarMatricula: true,
        mostrarCargo: true,
        mostrarBadge: false,
        orientacao: 'horizontal'
    }
};



// Modelo 2: Membro Modelo 02 (Personalizado)
export const TEMPLATE_MEMBRO_02: CardTemplate = {
    id: 'membro-02',
    nome: 'Membro Modelo 02',
    tipo: 'membro',
    variacao: 'classico',
    descricao: 'Layout personalizado com frente e verso completo',
    corPrincipal: '#6b7280',
    corSecundaria: '#e5e7eb',
    corTexto: '#000000',
    backgroundUrl: '/img/card_membro2f.png',
    previewImage: '/img/card2m.jpg',
    layout: {
        mostrarFoto: true,
        mostrarQRCode: true,
        mostrarMatricula: true,
        mostrarCargo: true,
        mostrarBadge: false,
        orientacao: 'horizontal'
    }
};

// Modelo 2: Congregado Modelo 02 (Frente e Verso - Design Premium)
export const TEMPLATE_CONGREGADO_02: CardTemplate = {
    id: 'congregado-02',
    nome: 'Congregado Modelo 02',
    tipo: 'congregado',
    variacao: 'classico',
    descricao: 'Design premium com frente e verso, incluindo novos campos como Filiação e Batismo',
    corPrincipal: '#1e40af',
    corSecundaria: '#eab308',
    corTexto: '#000000',
    backgroundUrl: '/img/bgcard_membro2_frente.jpg',
    previewImage: '/img/card2c.jpg',
    layout: {
        mostrarFoto: true,
        mostrarQRCode: true,
        mostrarMatricula: true,
        mostrarCargo: true,
        mostrarBadge: false,
        orientacao: 'horizontal'
    }
};

// ========== CARTÃO DE CONGREGADO ==========


// Modelo 2: Congregado Moderno (Vertical)
export const TEMPLATE_CONGREGADO_MODERNO: CardTemplate = {
    id: 'congregado-moderno',
    nome: 'Congregado Moderno',
    tipo: 'congregado',
    variacao: 'moderno',
    descricao: 'Layout vertical com foto centralizada no topo',
    corPrincipal: '#10b981',
    corSecundaria: '#34d399',
    corTexto: '#ffffff',
    layout: {
        mostrarFoto: true,
        mostrarQRCode: true,
        mostrarMatricula: true,
        mostrarCargo: false,
        mostrarBadge: true,
        textoBadge: 'CONGREGADO',
        orientacao: 'vertical'
    }
};

// ========== CREDENCIAL DE MINISTRO ==========

// Modelo 1: Ministro Clássico (Horizontal)
// Modelo 1: Ministro em Branco 01 (Antigo Clássico)
export const TEMPLATE_MINISTRO_CLASSICO: CardTemplate = {
    id: 'ministro-classico',
    nome: 'Ministro em Branco 01',
    tipo: 'ministro',
    variacao: 'branco',
    descricao: 'Layout 100% personalizável (Frente e Verso)',
    corPrincipal: '#6b7280',
    corSecundaria: '#9ca3af',
    corTexto: '#ffffff',
    backgroundUrl: '/img/card_branco.png',
    layout: {
        mostrarFoto: true,
        mostrarQRCode: true,
        mostrarMatricula: true,
        mostrarCargo: true,
        mostrarBadge: true,
        textoBadge: 'MINISTRO',
        orientacao: 'horizontal'
    }
};

// Modelo 2: Ministro em Branco 02 (Antigo Premium)
export const TEMPLATE_MINISTRO_02: CardTemplate = {
    id: 'ministro-02',
    nome: 'Ministro em Branco 02',
    tipo: 'ministro',
    variacao: 'branco',
    descricao: 'Layout 100% personalizável (Frente e Verso)',
    corPrincipal: '#6b7280',
    corSecundaria: '#9ca3af',
    corTexto: '#ffffff',
    backgroundUrl: '/img/card_branco.png',
    previewImage: undefined,
    layout: {
        mostrarFoto: true,
        mostrarQRCode: true,
        mostrarMatricula: true,
        mostrarCargo: true,
        mostrarBadge: true,
        textoBadge: 'MINISTRO',
        orientacao: 'horizontal'
    }
};

// Modelo 3: Ministro em Branco 03
export const TEMPLATE_MINISTRO_BRANCO: CardTemplate = {
    id: 'ministro-branco',
    nome: 'Ministro em Branco 03',
    tipo: 'ministro',
    variacao: 'branco',
    descricao: 'Layout 100% personalizável (Frente e Verso)',
    corPrincipal: '#6b7280',
    corSecundaria: '#9ca3af',
    corTexto: '#ffffff',
    backgroundUrl: '/img/card_branco.png',
    layout: {
        mostrarFoto: true,
        mostrarQRCode: true,
        mostrarMatricula: true,
        mostrarCargo: true,
        mostrarBadge: true,
        textoBadge: 'MINISTRO',
        orientacao: 'horizontal'
    }
};

// Modelo 2: Ministro Executivo (Vertical)
export const TEMPLATE_MINISTRO_EXECUTIVO: CardTemplate = {
    id: 'ministro-executivo',
    nome: 'Ministro Executivo',
    tipo: 'ministro',
    variacao: 'moderno',
    descricao: 'Layout vertical elegante com dados ministeriais',
    corPrincipal: '#b45309',
    corSecundaria: '#d97706',
    corTexto: '#ffffff',
    layout: {
        mostrarFoto: true,
        mostrarQRCode: true,
        mostrarMatricula: true,
        mostrarCargo: true,
        mostrarBadge: true,
        textoBadge: 'MINISTRO',
        orientacao: 'vertical'
    }
};

// ========== MODELO EM BRANCO ==========

// Modelo em Branco - MEMBRO
export const TEMPLATE_MEMBRO_BRANCO: CardTemplate = {
    id: 'membro-branco',
    nome: 'Membro Modelo em Branco',
    tipo: 'membro',
    variacao: 'branco',
    descricao: 'Layout 100% personalizável (Frente e Verso)',
    corPrincipal: '#6b7280',
    corSecundaria: '#9ca3af',
    corTexto: '#ffffff',
    backgroundUrl: '/img/card_branco.png',
    layout: {
        mostrarFoto: true,
        mostrarQRCode: true,
        mostrarMatricula: true,
        mostrarCargo: true,
        mostrarBadge: false,
        orientacao: 'horizontal'
    }
};

// Modelo em Branco - CONGREGADO
export const TEMPLATE_CONGREGADO_BRANCO: CardTemplate = {
    id: 'congregado-branco',
    nome: 'Congregado Modelo em Branco',
    tipo: 'congregado',
    variacao: 'branco',
    descricao: 'Layout 100% personalizável (Frente e Verso)',
    corPrincipal: '#6b7280',
    corSecundaria: '#9ca3af',
    corTexto: '#ffffff',
    backgroundUrl: '/img/card_branco.png',
    layout: {
        mostrarFoto: true,
        mostrarQRCode: true,
        mostrarMatricula: true,
        mostrarCargo: true,
        mostrarBadge: false,
        orientacao: 'horizontal'
    }
};

// ========== CARTÃO DE FUNCIONÁRIO ==========

// Modelo em Branco - FUNCIONÁRIO (Orientação Portrait)
export const TEMPLATE_FUNCIONARIO_BRANCO: CardTemplate = {
    id: 'funcionario-branco',
    nome: 'Funcionário em Branco',
    tipo: 'funcionario',
    variacao: 'branco',
    descricao: 'Layout 100% personalizável em orientação vertical (Portrait)',
    corPrincipal: '#7c3aed',
    corSecundaria: '#a78bfa',
    corTexto: '#ffffff',
    backgroundUrl: '/img/card_branco.png',
    layout: {
        mostrarFoto: true,
        mostrarQRCode: true,
        mostrarMatricula: true,
        mostrarCargo: true,
        mostrarBadge: false,
        orientacao: 'vertical'
    }
};

// Modelo Customizado - FUNCIONÁRIO (Aguardando JSON do usuário)
export const TEMPLATE_FUNCIONARIO_CUSTOMIZADO: CardTemplate = {
    id: 'funcionario-customizado',
    nome: 'Funcionário Customizado',
    tipo: 'funcionario',
    variacao: 'classico',
    descricao: 'Layout personalizável em orientação vertical (Portrait)',
    corPrincipal: '#6b21a8',
    corSecundaria: '#9333ea',
    corTexto: '#ffffff',
    backgroundUrl: '/img/card_funcionario.png',
    previewImage: '/img/card1f.jpg',
    layout: {
        mostrarFoto: true,
        mostrarQRCode: true,
        mostrarMatricula: true,
        mostrarCargo: true,
        mostrarBadge: false,
        orientacao: 'vertical'
    }
};



// Array com todos os templates disponíveis
export const TEMPLATES_DISPONIVEIS: CardTemplate[] = [
    // Membro
    TEMPLATE_MEMBRO_CLASSICO,
    TEMPLATE_MEMBRO_02,
    TEMPLATE_MEMBRO_BRANCO,
    // Congregado
    TEMPLATE_CONGREGADO_01,
    TEMPLATE_CONGREGADO_02,
    TEMPLATE_CONGREGADO_BRANCO,
    // Ministro
    TEMPLATE_MINISTRO_CLASSICO,
    TEMPLATE_MINISTRO_02,
    TEMPLATE_MINISTRO_BRANCO,
    // Funcionário
    TEMPLATE_FUNCIONARIO_CUSTOMIZADO,
    TEMPLATE_FUNCIONARIO_BRANCO
];


/**
 * Obtém templates por tipo
 */
export function getTemplatesPorTipo(tipo: TipoCartao): CardTemplate[] {
    return TEMPLATES_DISPONIVEIS.filter(t => t.tipo === tipo);
}

/**
 * Converte template padrão em template editável do canvas
 */
export function converterParaTemplateEditavel(template: CardTemplate): any {
    if (!template) {
        console.error('converterParaTemplateEditavel: template is undefined');
        return null; // ou throw new Error('Template is undefined');
    }

    // Verificar se existe template customizado para este ID
    const { getTemplateCustomizado } = require('@/lib/custom-card-templates');
    const customizado = getTemplateCustomizado(template.id);
    
    if (customizado) {
        console.log('✨ Carregando template customizado:', template.id, 'previewImage:', customizado.previewImage);
        return {
            ...customizado,
            criadoEm: new Date(),
            atualizadoEm: new Date()
        };
    }

    // Modelo em Branco (Template Editável) - Agora inclui TODOS os de Ministro e TODOS de Membro
    if (template.id === 'membro-branco' || template.id === 'congregado-branco' ||
        template.id === 'ministro-branco' || template.id === 'membro-01') {
        return {
            id: template.id,
            nome: template.nome,
            tipoCadastro: template.tipo,
            corTitulo: '#6b7280',
            temVerso: true,
            criadoEm: new Date(),
            atualizadoEm: new Date(),
            backgroundUrl: '/img/card_branco.png',
            elementos: [],
            elementosVerso: [],
            backgroundUrlVerso: '/img/card_branco.png'
        };
    }

    // Modelo: Ministro Classico (Personalizado)
    if (template.id === 'ministro-classico') {
        return {
            id: template.id,
            nome: template.nome,
            tipoCadastro: template.tipo,
            corTitulo: '#d97706',
            temVerso: true,
            criadoEm: new Date(),
            atualizadoEm: new Date(),
            backgroundUrl: '/img/card_ministro1f.png',
            backgroundUrlVerso: '/img/card_ministro1c.png',
            previewImage: '/img/card1o.jpg',
            elementos: [],
            elementosVerso: []
        };
    }

    // Modelo: Ministro 02 (Personalizado)
    if (template.id === 'ministro-02') {
        return {
            id: template.id,
            nome: template.nome,
            tipoCadastro: template.tipo,
            corTitulo: '#d97706',
            temVerso: true,
            criadoEm: new Date(),
            atualizadoEm: new Date(),
            backgroundUrl: '/img/card_ministro2f.png',
            backgroundUrlVerso: '/img/card_ministro2c.png',
            previewImage: '/img/card2o.jpg',
            elementos: [],
            elementosVerso: []
        };
    }

    // Modelo: Membro Modelo 02 (Personalizado)
    if (template.id === 'membro-02') {
        return {
            id: template.id,
            nome: template.nome,
            tipoCadastro: template.tipo,
            corTitulo: '#6b7280',
            temVerso: true,
            criadoEm: new Date("2025-12-25T22:21:06.016Z"),
            atualizadoEm: new Date("2025-12-26T20:29:38.683Z"),
            backgroundUrl: '/img/card_membro2f.png',
            backgroundUrlVerso: '/img/card_membro2c.png',
            elementos: [
                {"id": "1766698021395", "tipo": "logo", "x": 15, "y": 15, "largura": 90, "altura": 90, "fontSize": 10, "cor": "#000", "fonte": "Arial", "transparencia": 1, "alinhamento": "left", "negrito": false, "italico": false, "sublinhado": false, "visivel": true},
                {"id": "1766698031393", "tipo": "foto-membro", "x": 319, "y": 112, "largura": 130, "altura": 165, "fontSize": 10, "cor": "#000", "fonte": "Arial", "alinhamento": "left", "negrito": false, "italico": false, "sublinhado": false, "visivel": true},
                {"id": "1766698059049", "tipo": "texto", "x": 104, "y": 15, "largura": 345, "altura": 53, "fontSize": 20, "cor": "#000", "fonte": "Verdana", "texto": "NOME&nbsp;<div>DA IGREJA</div>", "alinhamento": "center", "negrito": true, "italico": false, "sublinhado": false, "visivel": true},
                {"id": "1766698112979", "tipo": "texto", "x": 104, "y": 67, "largura": 345, "altura": 38, "fontSize": 10, "cor": "#ef4444", "fonte": "Arial", "texto": "ENDEREÇO DA IGREJA<div>DADOS DE CONTATO</div><div>SITE/EMAIL</div>", "alinhamento": "center", "negrito": true, "italico": false, "sublinhado": false, "visivel": true},
                {"id": "1766698201325", "tipo": "texto", "x": 15, "y": 180, "largura": 295, "altura": 30, "fontSize": 13, "cor": "#000000", "fonte": "Arial", "borderRadius": 6, "backgroundColor": "#ffffff", "texto": "MATRÍCULA:&nbsp;<font color=\"#ef4444\">{matricula}</font>", "alinhamento": "left", "negrito": true, "italico": false, "sublinhado": false, "visivel": true},
                {"id": "1766698310205", "tipo": "texto", "x": 15, "y": 213, "largura": 295, "altura": 30, "fontSize": 13, "cor": "#000", "fonte": "Arial", "borderRadius": 6, "backgroundColor": "#ffffff", "texto": "{divisao3}:", "alinhamento": "left", "negrito": true, "italico": false, "sublinhado": false, "visivel": true},
                {"id": "1766698417605", "tipo": "texto", "x": 15, "y": 247, "largura": 295, "altura": 30, "fontSize": 13, "cor": "#000", "fonte": "Arial", "borderRadius": 6, "backgroundColor": "#ffffff", "texto": "NOME:&nbsp;<font color=\"#ef4444\">{nome}</font>", "alinhamento": "left", "negrito": true, "italico": false, "sublinhado": false, "visivel": true},
                {"id": "1766698534212", "tipo": "texto", "x": 15, "y": 128, "largura": 295, "altura": 35, "fontSize": 20, "cor": "#000", "fonte": "Verdana", "texto": "CARTÃO DE MEMBRO", "alinhamento": "center", "negrito": true, "italico": false, "sublinhado": false, "visivel": true}
            ],
            elementosVerso: [
                {"id": "1766780864615", "tipo": "chapa", "x": 131, "y": 82, "largura": 304, "altura": 23, "fontSize": 10, "cor": "#ffffff", "fonte": "Arial", "transparencia": 0.6, "borderRadius": 4, "texto": "CHAPA", "alinhamento": "left", "negrito": false, "italico": false, "sublinhado": false, "visivel": true},
                {"id": "1766780571636jo0z4pwnl", "tipo": "chapa", "x": 317, "y": 169, "largura": 126, "altura": 35, "fontSize": 10, "cor": "#ffffff", "fonte": "Arial", "transparencia": 1, "borderRadius": 6, "texto": "CHAPA", "alinhamento": "left", "negrito": false, "italico": false, "sublinhado": false, "visivel": true},
                {"id": "17667805716366m1aowyxu", "tipo": "chapa", "x": 151, "y": 169, "largura": 160, "altura": 35, "fontSize": 10, "cor": "#ffffff", "fonte": "Arial", "transparencia": 1, "borderRadius": 6, "texto": "CHAPA", "alinhamento": "left", "negrito": false, "italico": false, "sublinhado": false, "visivel": true},
                {"id": "1766780571636bvwf59de0", "tipo": "chapa", "x": 19, "y": 168, "largura": 126, "altura": 35, "fontSize": 10, "cor": "#ffffff", "fonte": "Arial", "transparencia": 1, "borderRadius": 6, "texto": "CHAPA", "alinhamento": "left", "negrito": false, "italico": false, "sublinhado": false, "visivel": true},
                {"id": "1766780578164ar5unopkq", "tipo": "chapa", "x": 317, "y": 124, "largura": 126, "altura": 35, "fontSize": 10, "cor": "#ffffff", "fonte": "Arial", "transparencia": 1, "borderRadius": 6, "texto": "CHAPA", "alinhamento": "left", "negrito": false, "italico": false, "sublinhado": false, "visivel": true},
                {"id": "1766780578164d9mgr31d0", "tipo": "chapa", "x": 19, "y": 123, "largura": 292, "altura": 35, "fontSize": 10, "cor": "#ffffff", "fonte": "Arial", "transparencia": 1, "borderRadius": 6, "texto": "CHAPA", "alinhamento": "left", "negrito": false, "italico": false, "sublinhado": false, "visivel": true},
                {"id": "1766780219376", "tipo": "chapa", "x": 20, "y": 215, "largura": 126, "altura": 35, "fontSize": 10, "cor": "#ffffff", "fonte": "Arial", "transparencia": 1, "borderRadius": 6, "texto": "CHAPA", "alinhamento": "left", "negrito": false, "italico": false, "sublinhado": false, "visivel": true},
                {"id": "1766780463162runssoccu", "tipo": "chapa", "x": 318, "y": 216, "largura": 126, "altura": 35, "fontSize": 10, "cor": "#ffffff", "fonte": "Arial", "transparencia": 1, "borderRadius": 6, "texto": "CHAPA", "alinhamento": "left", "negrito": false, "italico": false, "sublinhado": false, "visivel": true},
                {"id": "1766780318914sb40je7js", "tipo": "chapa", "x": 152, "y": 216, "largura": 160, "altura": 35, "fontSize": 10, "cor": "#ffffff", "fonte": "Arial", "transparencia": 1, "borderRadius": 6, "texto": "CHAPA", "alinhamento": "left", "negrito": false, "italico": false, "sublinhado": false, "visivel": true},
                {"id": "1766701435750", "tipo": "qrcode", "x": 35, "y": 17, "largura": 90, "altura": 90, "fontSize": 10, "cor": "#000", "fonte": "Arial", "alinhamento": "left", "negrito": false, "italico": false, "sublinhado": false, "visivel": true},
                {"id": "1766701497174", "tipo": "texto", "x": 10, "y": 252, "largura": 442, "altura": 30, "fontSize": 10, "cor": "#ffffff", "fonte": "Arial", "backgroundColor": "#000000", "texto": "Ide por todo o mundo e pregai o evangelho a toda a criatura. MC 16:15<div><font color=\"#ef4444\">Válido somente enquanto o portador se manter fiel a Deus e a Doutrina desta Igreja.</font></div>", "alinhamento": "center", "negrito": true, "italico": false, "sublinhado": false, "visivel": true},
                {"id": "1766779482593a8nkcpczi", "tipo": "texto", "x": 26, "y": 134, "largura": 282, "altura": 24, "fontSize": 10, "cor": "#000", "fonte": "Arial", "texto": "<font color=\"#ef4444\">{filiacao}</font>", "alinhamento": "left", "negrito": true, "italico": false, "sublinhado": false, "visivel": true},
                {"id": "17667794825933nfyrfhmg", "tipo": "texto", "x": 26, "y": 124, "largura": 90, "altura": 18, "fontSize": 10, "cor": "#000", "fonte": "Arial", "texto": "Filiação", "alinhamento": "left", "negrito": true, "italico": false, "sublinhado": false, "visivel": true},
                {"id": "17667794825931t3s1esri", "tipo": "texto", "x": 158, "y": 84, "largura": 250, "altura": 20, "fontSize": 12, "cor": "#000", "fonte": "Arial", "texto": "Data de Validade:&nbsp;<font color=\"#ef4444\">{validade}</font>", "alinhamento": "center", "negrito": true, "italico": false, "sublinhado": false, "visivel": true},
                {"id": "1766779482593u1foluglk", "tipo": "texto", "x": 26, "y": 168, "largura": 90, "altura": 18, "fontSize": 10, "cor": "#000", "fonte": "Arial", "texto": "RG", "alinhamento": "left", "negrito": true, "italico": false, "sublinhado": false, "visivel": true},
                {"id": "1766779482593uv8wintn3", "tipo": "texto", "x": 26, "y": 182, "largura": 115, "altura": 20, "fontSize": 10, "cor": "#000", "fonte": "Arial", "texto": "<font color=\"#ef4444\">{rg}</font>", "alinhamento": "left", "negrito": true, "italico": false, "sublinhado": false, "visivel": true},
                {"id": "1766779482593g72ekzpt9", "tipo": "texto", "x": 158, "y": 168, "largura": 90, "altura": 18, "fontSize": 10, "cor": "#000", "fonte": "Arial", "texto": "Naturalidade", "alinhamento": "left", "negrito": true, "italico": false, "sublinhado": false, "visivel": true},
                {"id": "1766779482593mh9ikg3o4", "tipo": "texto", "x": 158, "y": 182, "largura": 150, "altura": 20, "fontSize": 10, "cor": "#000", "fonte": "Arial", "texto": "<font color=\"#ef4444\">{naturalidade}</font>", "alinhamento": "left", "negrito": true, "italico": false, "sublinhado": false, "visivel": true},
                {"id": "1766779482593yo3zf3noz", "tipo": "texto", "x": 325, "y": 168, "largura": 102, "altura": 18, "fontSize": 10, "cor": "#000", "fonte": "Arial", "texto": "Data de Nascimento", "alinhamento": "left", "negrito": true, "italico": false, "sublinhado": false, "visivel": true},
                {"id": "1766779482593dup9z5b60", "tipo": "texto", "x": 325, "y": 182, "largura": 110, "altura": 20, "fontSize": 10, "cor": "#000", "fonte": "Arial", "texto": "<font color=\"#ef4444\">{dataNascimento}</font>", "alinhamento": "left", "negrito": true, "italico": false, "sublinhado": false, "visivel": true},
                {"id": "17667794825939iiatm79s", "tipo": "texto", "x": 25, "y": 216, "largura": 90, "altura": 18, "fontSize": 10, "cor": "#000", "fonte": "Arial", "texto": "CPF", "alinhamento": "left", "negrito": true, "italico": false, "sublinhado": false, "visivel": true},
                {"id": "1766779482593lp1rmlz7r", "tipo": "texto", "x": 26, "y": 229, "largura": 117, "altura": 20, "fontSize": 10, "cor": "#000", "fonte": "Arial", "texto": "<font color=\"#ef4444\">{cpf}</font>", "alinhamento": "left", "negrito": true, "italico": false, "sublinhado": false, "visivel": true},
                {"id": "176677948259349a37k9o5", "tipo": "texto", "x": 158, "y": 229, "largura": 150, "altura": 20, "fontSize": 10, "cor": "#000", "fonte": "Arial", "texto": "<font color=\"#ef4444\">{nacionalidade}</font>", "alinhamento": "left", "negrito": true, "italico": false, "sublinhado": false, "visivel": true},
                {"id": "1766779482593tlhj4bod3", "tipo": "texto", "x": 158, "y": 216, "largura": 100, "altura": 18, "fontSize": 10, "cor": "#000", "fonte": "Arial", "texto": "Nacionalidade", "alinhamento": "left", "negrito": true, "italico": false, "sublinhado": false, "visivel": true},
                {"id": "1766779482593ayzm2h2ob", "tipo": "texto", "x": 325, "y": 124, "largura": 90, "altura": 18, "fontSize": 10, "cor": "#000", "fonte": "Arial", "texto": "Data de Batismo", "alinhamento": "left", "negrito": true, "italico": false, "sublinhado": false, "visivel": true},
                {"id": "1766779482593b2q5e6zg6", "tipo": "texto", "x": 325, "y": 134, "largura": 110, "altura": 20, "fontSize": 10, "cor": "#000", "fonte": "Arial", "texto": "<font color=\"#ef4444\">{dataBatismo}</font>", "alinhamento": "left", "negrito": true, "italico": false, "sublinhado": false, "visivel": true},
                {"id": "17667794825939fugeylyp", "tipo": "texto", "x": 324, "y": 216, "largura": 90, "altura": 18, "fontSize": 10, "cor": "#000", "fonte": "Arial", "texto": "Estadi Civil", "alinhamento": "left", "negrito": true, "italico": false, "sublinhado": false, "visivel": true},
                {"id": "1766779482593eplbssa6n", "tipo": "texto", "x": 325, "y": 229, "largura": 115, "altura": 20, "fontSize": 10, "cor": "#000", "fonte": "Arial", "texto": "<font color=\"#ef4444\">{estadoCivil}</font>", "alinhamento": "left", "negrito": true, "italico": false, "sublinhado": false, "visivel": true},
                {"id": "1766779482593hl4yxyxdx", "tipo": "texto", "x": 131, "y": 47, "largura": 150, "altura": 32, "fontSize": 10, "cor": "#000", "fonte": "Arial", "texto": "____________________<div>Pastor Presidente</div>", "alinhamento": "center", "negrito": true, "italico": false, "sublinhado": false, "visivel": true},
                {"id": "1766779482593x1v89fgsu", "tipo": "texto", "x": 284, "y": 47, "largura": 150, "altura": 32, "fontSize": 10, "cor": "#000", "fonte": "Arial", "texto": "____________________<div>Secretário(a)</div>", "alinhamento": "center", "negrito": true, "italico": false, "sublinhado": false, "visivel": true}
            ]
        };
    }

    // Modelo Restaurado: Membro Modelo 01 (Membro Clássico)
    if (template.id === 'membro-classico') {
        return {
            id: template.id,
            nome: template.nome,
            tipoCadastro: template.tipo,
            corTitulo: template.corPrincipal,
            temVerso: true,
            criadoEm: new Date(),
            atualizadoEm: new Date(),
            backgroundUrl: '/img/card_membro1f.png',
            previewImage: '/img/card1m.jpg',
            elementos: [
                {
                    "id": "1766346657985",
                    "tipo": "logo",
                    "x": 15,
                    "y": 15,
                    "largura": 90,
                    "altura": 90,
                    "fontSize": 10,
                    "cor": "#000",
                    "fonte": "Arial",
                    "transparencia": 1,
                    "alinhamento": "left",
                    "negrito": false,
                    "italico": false,
                    "sublinhado": false,
                    "visivel": true
                },
                {
                    "id": "1766346671092",
                    "tipo": "texto",
                    "x": 104,
                    "y": 15,
                    "largura": 340,
                    "altura": 52,
                    "fontSize": 20,
                    "cor": "#000",
                    "fonte": "Verdana",
                    "texto": "NOME<div>DA IGREJA</div>",
                    "alinhamento": "center",
                    "negrito": true,
                    "italico": false,
                    "sublinhado": false,
                    "visivel": true
                },
                {
                    "id": "1766346742639",
                    "tipo": "texto",
                    "x": 104,
                    "y": 66,
                    "largura": 340,
                    "altura": 39,
                    "fontSize": 10,
                    "cor": "#000",
                    "fonte": "Trebuchet MS",
                    "texto": "ENDEREÇO DA IGREJA<div>DADOS DE CONTATO</div><div><font color=\"#ef4444\">SITE/EMAIL</font></div>",
                    "alinhamento": "center",
                    "negrito": true,
                    "italico": false,
                    "sublinhado": false,
                    "visivel": true
                },
                {
                    "id": "1766347097203",
                    "tipo": "texto",
                    "x": 15,
                    "y": 116,
                    "largura": 305,
                    "altura": 42,
                    "fontSize": 18,
                    "cor": "#000",
                    "fonte": "Verdana",
                    "texto": "CARTÃO DE MEMBRO",
                    "alinhamento": "center",
                    "negrito": true,
                    "italico": false,
                    "sublinhado": false,
                    "visivel": true
                },
                {
                    "id": "1766347232433",
                    "tipo": "foto-membro",
                    "x": 329,
                    "y": 111,
                    "largura": 115,
                    "altura": 133,
                    "fontSize": 10,
                    "cor": "#000",
                    "fonte": "Arial",
                    "alinhamento": "left",
                    "negrito": false,
                    "italico": false,
                    "sublinhado": false,
                    "visivel": true
                },
                {
                    "id": "1766347341575",
                    "tipo": "texto",
                    "x": 329,
                    "y": 251,
                    "largura": 115,
                    "altura": 25,
                    "fontSize": 14,
                    "cor": "#000",
                    "fonte": "Impact",
                    "texto": "MATRICULA:&nbsp;<font color=\"#ef4444\">{matricula}</font>",
                    "alinhamento": "center",
                    "negrito": false,
                    "italico": false,
                    "sublinhado": false,
                    "visivel": true
                },
                {
                    "id": "1766347458452",
                    "tipo": "texto",
                    "x": 15,
                    "y": 251,
                    "largura": 305,
                    "altura": 25,
                    "fontSize": 14,
                    "cor": "#000",
                    "fonte": "Arial",
                    "texto": "NOME:&nbsp;<font color=\"#ef4444\">{nome}</font>",
                    "alinhamento": "left",
                    "negrito": true,
                    "italico": false,
                    "sublinhado": false,
                    "visivel": true
                },
                {
                    "id": "1766347582558",
                    "tipo": "texto",
                    "x": 15,
                    "y": 221,
                    "largura": 305,
                    "altura": 25,
                    "fontSize": 14,
                    "cor": "#000",
                    "fonte": "Arial",
                    "texto": "CONGREGAÇÃO:&nbsp;<font color=\"#ef4444\">{divisao3}</font>",
                    "alinhamento": "left",
                    "negrito": true,
                    "italico": false,
                    "sublinhado": false,
                    "visivel": true
                }
            ],
            elementosVerso: [
                {
                    "id": "1766347657388",
                    "tipo": "texto",
                    "x": 26,
                    "y": 11,
                    "largura": 90,
                    "altura": 18,
                    "fontSize": 10,
                    "cor": "#000",
                    "fonte": "Arial",
                    "texto": "Filiação",
                    "alinhamento": "left",
                    "negrito": true,
                    "italico": false,
                    "sublinhado": false,
                    "visivel": true
                },
                {
                    "id": "1766347710122",
                    "tipo": "texto",
                    "x": 339,
                    "y": 11,
                    "largura": 90,
                    "altura": 18,
                    "fontSize": 10,
                    "cor": "#000",
                    "fonte": "Arial",
                    "texto": "Data de Validade",
                    "alinhamento": "left",
                    "negrito": true,
                    "italico": false,
                    "sublinhado": false,
                    "visivel": true
                },
                {
                    "id": "1766347790784",
                    "tipo": "texto",
                    "x": 26,
                    "y": 51,
                    "largura": 90,
                    "altura": 18,
                    "fontSize": 10,
                    "cor": "#000",
                    "fonte": "Arial",
                    "texto": "RG",
                    "alinhamento": "left",
                    "negrito": true,
                    "italico": false,
                    "sublinhado": false,
                    "visivel": true
                },
                {
                    "id": "1766347825166",
                    "tipo": "texto",
                    "x": 152,
                    "y": 51,
                    "largura": 90,
                    "altura": 18,
                    "fontSize": 10,
                    "cor": "#000",
                    "fonte": "Arial",
                    "texto": "Naturalidade",
                    "alinhamento": "left",
                    "negrito": true,
                    "italico": false,
                    "sublinhado": false,
                    "visivel": true
                },
                {
                    "id": "1766347861420",
                    "tipo": "texto",
                    "x": 338,
                    "y": 51,
                    "largura": 102,
                    "altura": 18,
                    "fontSize": 10,
                    "cor": "#000",
                    "fonte": "Arial",
                    "texto": "Data de Nascimento",
                    "alinhamento": "left",
                    "negrito": true,
                    "italico": false,
                    "sublinhado": false,
                    "visivel": true
                },
                {
                    "id": "1766347897822",
                    "tipo": "texto",
                    "x": 26,
                    "y": 90,
                    "largura": 90,
                    "altura": 18,
                    "fontSize": 10,
                    "cor": "#000",
                    "fonte": "Arial",
                    "texto": "CPF",
                    "alinhamento": "left",
                    "negrito": true,
                    "italico": false,
                    "sublinhado": false,
                    "visivel": true
                },
                {
                    "id": "1766347923046",
                    "tipo": "texto",
                    "x": 152,
                    "y": 90,
                    "largura": 77,
                    "altura": 18,
                    "fontSize": 10,
                    "cor": "#000",
                    "fonte": "Arial",
                    "texto": "Nacionalidade",
                    "alinhamento": "left",
                    "negrito": true,
                    "italico": false,
                    "sublinhado": false,
                    "visivel": true
                },
                {
                    "id": "1766347979340",
                    "tipo": "texto",
                    "x": 234,
                    "y": 90,
                    "largura": 90,
                    "altura": 18,
                    "fontSize": 10,
                    "cor": "#000",
                    "fonte": "Arial",
                    "texto": "Data de Batismo",
                    "alinhamento": "left",
                    "negrito": true,
                    "italico": false,
                    "sublinhado": false,
                    "visivel": true
                },
                {
                    "id": "1766348020924",
                    "tipo": "texto",
                    "x": 339,
                    "y": 90,
                    "largura": 90,
                    "altura": 18,
                    "fontSize": 10,
                    "cor": "#000",
                    "fonte": "Arial",
                    "texto": "Estadi Civil",
                    "alinhamento": "left",
                    "negrito": true,
                    "italico": false,
                    "sublinhado": false,
                    "visivel": true
                },
                {
                    "id": "1766348048832",
                    "tipo": "texto",
                    "x": 27,
                    "y": 157,
                    "largura": 200,
                    "altura": 32,
                    "fontSize": 10,
                    "cor": "#000",
                    "fonte": "Arial",
                    "texto": "_______________________________<div>Pastor Presidente</div>",
                    "alinhamento": "center",
                    "negrito": true,
                    "italico": false,
                    "sublinhado": false,
                    "visivel": true
                },
                {
                    "id": "1766348102353",
                    "tipo": "texto",
                    "x": 238,
                    "y": 157,
                    "largura": 200,
                    "altura": 32,
                    "fontSize": 10,
                    "cor": "#000",
                    "fonte": "Arial",
                    "texto": "_______________________________<div>Secretário(a)</div>",
                    "alinhamento": "center",
                    "negrito": true,
                    "italico": false,
                    "sublinhado": false,
                    "visivel": true
                },
                {
                    "id": "1766348163099",
                    "tipo": "qrcode",
                    "x": 27,
                    "y": 196,
                    "largura": 80,
                    "altura": 80,
                    "fontSize": 10,
                    "cor": "#000",
                    "fonte": "Arial",
                    "alinhamento": "left",
                    "negrito": false,
                    "italico": false,
                    "sublinhado": false,
                    "visivel": true
                },
                {
                    "id": "1766348203424",
                    "tipo": "texto",
                    "x": 118,
                    "y": 208,
                    "largura": 322,
                    "altura": 62,
                    "fontSize": 12,
                    "cor": "#000",
                    "fonte": "Arial",
                    "texto": "<font color=\"#ef4444\">Ide por todo o mundo e pregai o evangelho a toda a criatura. MC 16:15</font><div>Válido somente enquanto o portador se manter fiel a Deus e a doutrina desta Igreja.</div>",
                    "alinhamento": "center",
                    "negrito": true,
                    "italico": false,
                    "sublinhado": false,
                    "visivel": true
                },
                {
                    "id": "1766419478657",
                    "tipo": "texto",
                    "x": 26,
                    "y": 21,
                    "largura": 303,
                    "altura": 24,
                    "fontSize": 10,
                    "cor": "#000",
                    "fonte": "Arial",
                    "texto": "<font color=\"#ef4444\">{filiacao}</font>",
                    "alinhamento": "left",
                    "negrito": true,
                    "italico": false,
                    "sublinhado": false,
                    "visivel": true
                },
                {
                    "id": "1766419520217",
                    "tipo": "texto",
                    "x": 26,
                    "y": 65,
                    "largura": 119,
                    "altura": 20,
                    "fontSize": 10,
                    "cor": "#000",
                    "fonte": "Arial",
                    "texto": "<font color=\"#ef4444\">{rg}</font>",
                    "alinhamento": "left",
                    "negrito": true,
                    "italico": false,
                    "sublinhado": false,
                    "visivel": true
                },
                {
                    "id": "1766419576088",
                    "tipo": "texto",
                    "x": 340,
                    "y": 25,
                    "largura": 99,
                    "altura": 22,
                    "fontSize": 10,
                    "cor": "#000",
                    "fonte": "Arial",
                    "texto": "<font color=\"#ef4444\">{validade}</font>",
                    "alinhamento": "left",
                    "negrito": true,
                    "italico": false,
                    "sublinhado": false,
                    "visivel": true
                },
                {
                    "id": "1766419625921",
                    "tipo": "texto",
                    "x": 154,
                    "y": 65,
                    "largura": 177,
                    "altura": 20,
                    "fontSize": 10,
                    "cor": "#000",
                    "fonte": "Arial",
                    "texto": "<font color=\"#ef4444\">{naturalidade}</font>",
                    "alinhamento": "left",
                    "negrito": true,
                    "italico": false,
                    "sublinhado": false,
                    "visivel": true
                },
                {
                    "id": "1766419667083",
                    "tipo": "texto",
                    "x": 340,
                    "y": 65,
                    "largura": 90,
                    "altura": 20,
                    "fontSize": 10,
                    "cor": "#000",
                    "fonte": "Arial",
                    "texto": "<font color=\"#ef4444\">{dataNascimento}</font>",
                    "alinhamento": "left",
                    "negrito": true,
                    "italico": false,
                    "sublinhado": false,
                    "visivel": true
                },
                {
                    "id": "1766419689211",
                    "tipo": "texto",
                    "x": 27,
                    "y": 104,
                    "largura": 117,
                    "altura": 20,
                    "fontSize": 10,
                    "cor": "#000",
                    "fonte": "Arial",
                    "texto": "<font color=\"#ef4444\">{cpf}</font>",
                    "alinhamento": "left",
                    "negrito": true,
                    "italico": false,
                    "sublinhado": false,
                    "visivel": true
                },
                {
                    "id": "1766419716175",
                    "tipo": "texto",
                    "x": 152,
                    "y": 104,
                    "largura": 75,
                    "altura": 20,
                    "fontSize": 10,
                    "cor": "#000",
                    "fonte": "Arial",
                    "texto": "<font color=\"#ef4444\">{nacionalidade}</font>",
                    "alinhamento": "left",
                    "negrito": true,
                    "italico": false,
                    "sublinhado": false,
                    "visivel": true
                },
                {
                    "id": "1766419741891",
                    "tipo": "texto",
                    "x": 233,
                    "y": 104,
                    "largura": 99,
                    "altura": 20,
                    "fontSize": 10,
                    "cor": "#000",
                    "fonte": "Arial",
                    "texto": "<font color=\"#ef4444\">{dataBatismo}</font>",
                    "alinhamento": "left",
                    "negrito": true,
                    "italico": false,
                    "sublinhado": false,
                    "visivel": true
                },
                {
                    "id": "1766419775695",
                    "tipo": "texto",
                    "x": 340,
                    "y": 105,
                    "largura": 99,
                    "altura": 20,
                    "fontSize": 10,
                    "cor": "#000",
                    "fonte": "Arial",
                    "texto": "<font color=\"#ef4444\">{estadoCivil}</font>",
                    "alinhamento": "left",
                    "negrito": true,
                    "italico": false,
                    "sublinhado": false,
                    "visivel": true
                }
            ],
            backgroundUrlVerso: '/img/card_membro1c.png',
            backgroundFileVerso: undefined
        };
    }

    // Modelo 01 (Clássico) - CONGREGADO
    if (template.id === 'congregado-01') {
        return {
            id: template.id,
            nome: template.nome,
            tipoCadastro: template.tipo,
            corTitulo: template.corPrincipal,
            temVerso: false,
            criadoEm: new Date(),
            atualizadoEm: new Date(),
            backgroundUrl: '/img/bgcard_membro1.jpg',
            previewImage: '/img/card1c.jpg',
            elementos: [
                { id: "1", tipo: "logo", x: 15, y: 15, largura: 90, altura: 90, cor: "#000", visivel: true, transparencia: 1 },
                { id: "2", tipo: "texto", x: 104, y: 15, largura: 257, altura: 35, fontSize: 14, cor: "#000", fonte: "Arial", visivel: true, alinhamento: "center", negrito: true, texto: "NOME<div>DA IGREJA</div>" },
                { id: "3", tipo: "texto", x: 104, y: 49, largura: 257, altura: 38, fontSize: 8, cor: "#333", fonte: "Arial", visivel: true, alinhamento: "center", texto: "ENDEREÇO DA IGREJA&nbsp;<div>CONTATOS</div>" },
                { id: "4", tipo: "qrcode", x: 360, y: 15, largura: 90, altura: 90, visivel: true },
                { id: "5", tipo: "texto", x: 15, y: 115, largura: 300, altura: 30, fontSize: 20, cor: "#000", fonte: "Arial", visivel: true, alinhamento: "center", negrito: true, sombreado: true, texto: "CARTÃO DE CONGREGADO" },
                { id: "6", tipo: "foto-membro", x: 323, y: 119, largura: 128, altura: 161, visivel: true },
                { id: "7", tipo: "texto", x: 15, y: 252, largura: 300, altura: 30, fontSize: 13, cor: "#8B0000", backgroundColor: "#ffffff", borderRadius: 6, fonte: "Arial", visivel: true, alinhamento: "left", negrito: true, texto: "<font color=\"#000000\"> CPF:&nbsp;</font><font color=\"#ef4444\">{cpf}</font>" },
                { id: "8", tipo: "texto", x: 15, y: 153, largura: 300, altura: 30, fontSize: 13, cor: "#8B0000", backgroundColor: "#ffffff", borderRadius: 6, fonte: "Arial", visivel: true, alinhamento: "left", negrito: true, texto: "<font color=\"#000000\">MATRICULA:&nbsp;</font><font color=\"#ef4444\">{matricula}</font>" },
                { id: "9", tipo: "texto", x: 15, y: 219, largura: 300, altura: 30, fontSize: 13, cor: "#8B0000", backgroundColor: "#ffffff", borderRadius: 6, fonte: "Arial", visivel: true, alinhamento: "left", negrito: true, texto: "<font color=\"#000000\"> DATA NASCIMENTO:&nbsp;</font><font color=\"#ef4444\">{dataNascimento}</font>" },
                { id: "1766281909275", tipo: "texto", x: 15, y: 186, largura: 300, altura: 30, fontSize: 13, cor: "#000", fonte: "Arial", borderRadius: 6, texto: "NOME:&nbsp;<font color=\"#ef4444\">{nome}</font>", alinhamento: "left", negrito: true, italico: false, sublinhado: false, visivel: true, backgroundColor: "#ffffff" }
            ],
            elementosVerso: [],
            backgroundUrlVerso: undefined,
            backgroundFileVerso: undefined
        };
    }



    // (Este bloco do ministro-02 não é mais necessário pois ele cai no bloco de 'Branco' acima)


    // Modelo 02 - CONGREGADO PREMIUM (Personalizado)
    if (template.id === 'congregado-02') {
        return {
            id: template.id,
            nome: template.nome,
            tipoCadastro: template.tipo,
            corTitulo: template.corPrincipal,
            temVerso: false,
            criadoEm: new Date(),
            atualizadoEm: new Date(),
            backgroundUrl: '/img/bgcard_membro2_frente.jpg',
            previewImage: '/img/card2c.jpg',
            elementos: [
                { id: "1766265746697", tipo: "logo", x: 15, y: 15, largura: 90, altura: 90, fontSize: 10, cor: "#000", fonte: "Arial", transparencia: 1, alinhamento: "left", negrito: false, italico: false, sublinhado: false, visivel: true },
                { id: "1766265760628", tipo: "texto", x: 113, y: 15, largura: 338, altura: 50, fontSize: 19, cor: "#000", fonte: "Arial", texto: "NOME DA IGREJA<div>OU MINISTÉRIO</div>", alinhamento: "center", negrito: true, italico: false, sublinhado: false, visivel: true },
                { id: "1766265808644", tipo: "texto", x: 113, y: 64, largura: 338, altura: 40, fontSize: 10, cor: "#000", fonte: "Arial", texto: "ENDEREÇO DA IGREJA<div>DADOS DE CONTATO</div><div>SITE/EMAIL</div>", alinhamento: "center", negrito: false, italico: false, sublinhado: false, visivel: true },
                { id: "1766265894547", tipo: "texto", x: 15, y: 120, largura: 300, altura: 35, fontSize: 20, cor: "#000000", fonte: "Arial", texto: "CARTÃO DE CONGREGADO", alinhamento: "center", negrito: true, italico: false, sublinhado: false, visivel: true, sombreado: false },
                { id: "1766265944527", tipo: "foto-membro", x: 325, y: 119, largura: 126, altura: 155, fontSize: 10, cor: "#000", fonte: "Arial", alinhamento: "left", negrito: false, italico: false, sublinhado: false, visivel: true },
                { id: "1766265962519", tipo: "texto", x: 16, y: 248, largura: 300, altura: 31, fontSize: 14, cor: "#ffffff", fonte: "Arial", borderRadius: 7, texto: "NOME:&nbsp;<font color=\"#eab308\">{nome}</font>", alinhamento: "left", negrito: true, italico: false, sublinhado: false, visivel: true, backgroundColor: "" },
                { id: "1766266412259", tipo: "texto", x: 15, y: 154, largura: 300, altura: 23, fontSize: 14, cor: "#000", fonte: "Arial", texto: "MATRICULA:&nbsp;<font color=\"#ef4444\">{matricula}</font>", alinhamento: "center", negrito: true, italico: false, sublinhado: false, visivel: true },
                { id: "1766343842504", tipo: "texto", x: 15, y: 176, largura: 300, altura: 23, fontSize: 14, cor: "#000", fonte: "Arial", texto: "DATA NASCIMENTO:&nbsp;<font color=\"#ef4444\">{dataNascimento}</font>", alinhamento: "center", negrito: true, italico: false, sublinhado: false, visivel: true },
                { id: "1766343956332", tipo: "texto", x: 15, y: 198, largura: 300, altura: 23, fontSize: 14, cor: "#000", fonte: "Arial", texto: "CPF:&nbsp;<font color=\"#ef4444\">{cpf}</font>", alinhamento: "center", negrito: true, italico: false, sublinhado: false, visivel: true }
            ],
            elementosVerso: [],
            backgroundUrlVerso: "/img/bgcard_membro2_costa.jpg"
        };
    }


    // Se já estiver no formato editável (com elementos), retorna direto
    if ((template as any).elementos && Array.isArray((template as any).elementos)) {
        return template as any;
    }

    // Layout Horizontal (Clássico)
    // 3. Layouts Dinâmicos (Clássicos)
    if (template.layout && template.layout.orientacao === 'horizontal') {
        const elementos: any[] = [
            { id: '1', tipo: 'logo', x: 15, y: 15, largura: 90, altura: 90, cor: '#000', visivel: true, transparencia: 1 },
            { id: '2', tipo: 'texto', x: 104, y: 15, largura: 257, altura: 35, fontSize: 14, cor: '#000', fonte: 'Arial', visivel: true, alinhamento: 'center', negrito: true, texto: 'NOME<div>DA IGREJA</div>' },
            { id: '3', tipo: 'texto', x: 104, y: 49, largura: 257, altura: 38, fontSize: 8, cor: '#333', fonte: 'Arial', visivel: true, alinhamento: 'center', texto: 'ENDEREÇO DA IGREJA&nbsp;<div>CONTATOS</div>' },
            { id: '4', tipo: 'qrcode', x: 360, y: 15, largura: 90, altura: 90, visivel: template.layout.mostrarQRCode },
            { id: '5', tipo: 'texto', x: 15, y: 130, largura: 300, altura: 30, fontSize: 20, cor: '#000', fonte: 'Arial', visivel: true, alinhamento: 'center', negrito: true, sombreado: true, texto: 'CARTÃO DE MEMBRO' },
            { id: '6', tipo: 'foto-membro', x: 323, y: 120, largura: 128, altura: 161, visivel: template.layout.mostrarFoto },
            { id: '7', tipo: 'texto', x: 15, y: 187, largura: 300, altura: 30, fontSize: 13, cor: '#8B0000', backgroundColor: '#ffffff', borderRadius: 6, fonte: 'Arial', visivel: template.layout.mostrarMatricula, alinhamento: 'left', negrito: true, texto: '<font color="#000000"> MATRÍCULA:</font> {matricula}' },
            { id: '8', tipo: 'texto', x: 15, y: 251, largura: 300, altura: 30, fontSize: 13, cor: '#8B0000', backgroundColor: '#ffffff', borderRadius: 6, fonte: 'Arial', visivel: true, alinhamento: 'left', negrito: true, texto: '<font color="#000000"> NOME:</font> {nome}' }
        ];

        if (template.layout.mostrarCargo) {
            elementos.push({ id: '9', tipo: 'texto', x: 15, y: 219, largura: 300, altura: 30, fontSize: 13, cor: '#8B0000', backgroundColor: '#ffffff', borderRadius: 6, fonte: 'Arial', visivel: true, alinhamento: 'left', negrito: true, texto: '<font color="#000000"> CARGO:</font> {cargo}' });
        }

        return {
            id: template.id,
            nome: template.nome,
            tipoCadastro: template.tipo,
            corTitulo: template.corPrincipal,
            temVerso: false,
            criadoEm: new Date(),
            atualizadoEm: new Date(),
            backgroundFile: undefined,
            backgroundUrl: template.backgroundUrl,
            previewImage: template.previewImage,
            elementos: elementos,
            elementosVerso: [],
            backgroundUrlVerso: undefined,
            backgroundFileVerso: undefined
        };
    } else {
        // Layout Vertical padrão (Fallback)
        const elementos: any[] = [
            { id: '1', tipo: 'logo', x: 15, y: 15, largura: 40, altura: 40, visivel: true, transparencia: 1 },
            { id: '2', tipo: 'texto', x: 65, y: 20, largura: 320, altura: 18, fontSize: 12, negrito: true, texto: 'NOME DA IGREJA' },
            { id: '3', tipo: 'qrcode', x: 390, y: 15, largura: 60, altura: 60, visivel: template.layout.mostrarQRCode },
            { id: '4', tipo: 'foto-membro', x: 165, y: 65, largura: 120, altura: 150, visivel: template.layout.mostrarFoto },
            { id: '6', tipo: 'texto', x: 55, y: 260, largura: 350, altura: 14, fontSize: 12, alinhamento: 'center', negrito: true, texto: '{nome}' }
        ];

        return {
            id: template.id,
            nome: template.nome,
            tipoCadastro: template.tipo,
            corTitulo: template.corPrincipal,
            temVerso: false,
            criadoEm: new Date(),
            atualizadoEm: new Date(),
            backgroundFile: undefined,
            backgroundUrl: template.backgroundUrl,
            previewImage: template.previewImage,
            elementos: elementos,
            elementosVerso: [],
            backgroundUrlVerso: undefined,
            backgroundFileVerso: undefined
        };
    }
}
