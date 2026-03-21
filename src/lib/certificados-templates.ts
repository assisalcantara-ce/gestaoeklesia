export interface ElementoCertificado {
  id: string;
  tipo: 'texto' | 'logo' | 'imagem' | 'chapa';
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
  imagemUrl?: string;
  visivel: boolean;
}

export interface CertificadoTemplate {
  id: string;
  nome: string;
  backgroundUrl?: string;
  elementos: ElementoCertificado[];
  orientacao?: 'landscape' | 'portrait';
  variacao?: 'branco';
  categoria?: 'apresentacao-criancas' | 'batismo' | 'casamento';
  ativo?: boolean;
  criado_pelo_usuario?: boolean;
}

const baseId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const CERTIFICADOS_TEMPLATES_BASE: CertificadoTemplate[] = [
  {
    id: 'certificado-classico',
    nome: 'Certificado Classico',
    orientacao: 'landscape',
    categoria: 'apresentacao-criancas',
    ativo: true,
    elementos: [
      {
        id: baseId(),
        tipo: 'logo',
        x: 380,
        y: 30,
        largura: 80,
        altura: 80,
        transparencia: 1,
        visivel: true
      },
      {
        id: baseId(),
        tipo: 'texto',
        x: 80,
        y: 120,
        largura: 680,
        altura: 50,
        fontSize: 28,
        cor: '#111827',
        fonte: 'Georgia',
        texto: 'Certificado de Apresentacao de Crianca',
        alinhamento: 'center',
        negrito: true,
        visivel: true
      },
      {
        id: baseId(),
        tipo: 'texto',
        x: 90,
        y: 200,
        largura: 660,
        altura: 120,
        fontSize: 16,
        cor: '#111827',
        fonte: 'Georgia',
        texto: 'Certificamos que <b>{crianca_nome}</b>, filho(a) de {pai_nome} e {mae_nome}, foi apresentado(a) na {nome_igreja}.',
        alinhamento: 'center',
        visivel: true
      },
      {
        id: baseId(),
        tipo: 'texto',
        x: 90,
        y: 320,
        largura: 660,
        altura: 40,
        fontSize: 14,
        cor: '#374151',
        fonte: 'Georgia',
        texto: 'Data: {data_apresentacao} | Local: {local_apresentacao}',
        alinhamento: 'center',
        visivel: true
      },
      {
        id: baseId(),
        tipo: 'texto',
        x: 90,
        y: 430,
        largura: 300,
        altura: 30,
        fontSize: 13,
        cor: '#111827',
        fonte: 'Georgia',
        texto: '____________________________',
        alinhamento: 'center',
        visivel: true
      },
      {
        id: baseId(),
        tipo: 'texto',
        x: 90,
        y: 455,
        largura: 300,
        altura: 20,
        fontSize: 12,
        cor: '#6b7280',
        fonte: 'Georgia',
        texto: 'Responsavel',
        alinhamento: 'center',
        visivel: true
      },
      {
        id: baseId(),
        tipo: 'texto',
        x: 450,
        y: 430,
        largura: 300,
        altura: 30,
        fontSize: 13,
        cor: '#111827',
        fonte: 'Georgia',
        texto: '____________________________',
        alinhamento: 'center',
        visivel: true
      },
      {
        id: baseId(),
        tipo: 'texto',
        x: 450,
        y: 455,
        largura: 300,
        altura: 20,
        fontSize: 12,
        cor: '#6b7280',
        fonte: 'Georgia',
        texto: 'Ministro Responsavel',
        alinhamento: 'center',
        visivel: true
      },
      {
        id: baseId(),
        tipo: 'texto',
        x: 540,
        y: 510,
        largura: 250,
        altura: 20,
        fontSize: 11,
        cor: '#6b7280',
        fonte: 'Georgia',
        texto: 'Emitido em {data_emissao}',
        alinhamento: 'right',
        visivel: true
      }
    ]
  },
  {
    id: 'certificado-moderno',
    nome: 'Certificado Moderno',
    orientacao: 'landscape',
    categoria: 'apresentacao-criancas',
    elementos: [
      {
        id: baseId(),
        tipo: 'chapa',
        x: 0,
        y: 0,
        largura: 840,
        altura: 70,
        cor: '#0f172a',
        transparencia: 0.9,
        visivel: true
      },
      {
        id: baseId(),
        tipo: 'texto',
        x: 40,
        y: 18,
        largura: 760,
        altura: 40,
        fontSize: 24,
        cor: '#ffffff',
        fonte: 'Verdana',
        texto: 'Certificado de Apresentacao',
        alinhamento: 'left',
        negrito: true,
        visivel: true
      },
      {
        id: baseId(),
        tipo: 'texto',
        x: 80,
        y: 140,
        largura: 680,
        altura: 140,
        fontSize: 18,
        cor: '#111827',
        fonte: 'Verdana',
        texto: 'A {nome_igreja} certifica que <b>{crianca_nome}</b> foi apresentado(a) ao Senhor em {data_apresentacao}.',
        alinhamento: 'center',
        visivel: true
      },
      {
        id: baseId(),
        tipo: 'texto',
        x: 100,
        y: 300,
        largura: 640,
        altura: 40,
        fontSize: 14,
        cor: '#374151',
        fonte: 'Verdana',
        texto: 'Pais/Responsaveis: {pai_nome} e {mae_nome}',
        alinhamento: 'center',
        visivel: true
      },
      {
        id: baseId(),
        tipo: 'texto',
        x: 100,
        y: 350,
        largura: 640,
        altura: 30,
        fontSize: 13,
        cor: '#6b7280',
        fonte: 'Verdana',
        texto: 'Local: {local_apresentacao}',
        alinhamento: 'center',
        visivel: true
      },
      {
        id: baseId(),
        tipo: 'texto',
        x: 120,
        y: 445,
        largura: 250,
        altura: 25,
        fontSize: 12,
        cor: '#111827',
        fonte: 'Verdana',
        texto: '_______________________',
        alinhamento: 'center',
        visivel: true
      },
      {
        id: baseId(),
        tipo: 'texto',
        x: 120,
        y: 470,
        largura: 250,
        altura: 20,
        fontSize: 11,
        cor: '#6b7280',
        fonte: 'Verdana',
        texto: 'Assinatura',
        alinhamento: 'center',
        visivel: true
      },
      {
        id: baseId(),
        tipo: 'logo',
        x: 680,
        y: 430,
        largura: 100,
        altura: 100,
        transparencia: 1,
        visivel: true
      }
    ]
  },
  {
    id: 'certificado-batismo-modelo-01',
    nome: 'Batismo Modelo 01',
    orientacao: 'landscape',
    categoria: 'batismo',
    elementos: [
      {
        id: baseId(),
        tipo: 'logo',
        x: 380,
        y: 30,
        largura: 80,
        altura: 80,
        transparencia: 1,
        visivel: true
      },
      {
        id: baseId(),
        tipo: 'texto',
        x: 80,
        y: 120,
        largura: 680,
        altura: 50,
        fontSize: 28,
        cor: '#111827',
        fonte: 'Georgia',
        texto: 'Certificado de Batismo',
        alinhamento: 'center',
        negrito: true,
        visivel: true
      },
      {
        id: baseId(),
        tipo: 'texto',
        x: 90,
        y: 200,
        largura: 660,
        altura: 120,
        fontSize: 16,
        cor: '#111827',
        fonte: 'Georgia',
        texto: 'Certificamos que <b>{batizando_nome}</b> recebeu o sacramento do batismo na {nome_igreja}.',
        alinhamento: 'center',
        visivel: true
      },
      {
        id: baseId(),
        tipo: 'texto',
        x: 90,
        y: 320,
        largura: 660,
        altura: 40,
        fontSize: 14,
        cor: '#374151',
        fonte: 'Georgia',
        texto: 'Data: {data_batismo} | Local: {local_batismo}',
        alinhamento: 'center',
        visivel: true
      },
      {
        id: baseId(),
        tipo: 'texto',
        x: 90,
        y: 430,
        largura: 300,
        altura: 30,
        fontSize: 13,
        cor: '#111827',
        fonte: 'Georgia',
        texto: '____________________________',
        alinhamento: 'center',
        visivel: true
      },
      {
        id: baseId(),
        tipo: 'texto',
        x: 90,
        y: 455,
        largura: 300,
        altura: 20,
        fontSize: 12,
        cor: '#6b7280',
        fonte: 'Georgia',
        texto: 'Ministro Responsavel',
        alinhamento: 'center',
        visivel: true
      }
    ]
  },
  {
    id: 'certificado-batismo-branco',
    nome: 'Batismo em Branco',
    orientacao: 'landscape',
    categoria: 'batismo',
    variacao: 'branco',
    elementos: []
  },
  {
    id: 'certificado-casamento-modelo-01',
    nome: 'Casamento Modelo 01',
    orientacao: 'landscape',
    categoria: 'casamento',
    elementos: [
      {
        id: baseId(),
        tipo: 'logo',
        x: 380,
        y: 30,
        largura: 80,
        altura: 80,
        transparencia: 1,
        visivel: true
      },
      {
        id: baseId(),
        tipo: 'texto',
        x: 80,
        y: 120,
        largura: 680,
        altura: 50,
        fontSize: 28,
        cor: '#111827',
        fonte: 'Georgia',
        texto: 'Certificado de Casamento',
        alinhamento: 'center',
        negrito: true,
        visivel: true
      },
      {
        id: baseId(),
        tipo: 'texto',
        x: 90,
        y: 200,
        largura: 660,
        altura: 120,
        fontSize: 16,
        cor: '#111827',
        fonte: 'Georgia',
        texto: 'Certificamos que <b>{noivo_nome}</b> e <b>{noiva_nome}</b> uniram-se em matrimônio na {nome_igreja}.',
        alinhamento: 'center',
        visivel: true
      },
      {
        id: baseId(),
        tipo: 'texto',
        x: 90,
        y: 320,
        largura: 660,
        altura: 40,
        fontSize: 14,
        cor: '#374151',
        fonte: 'Georgia',
        texto: 'Data: {data_casamento} | Local: {local_casamento}',
        alinhamento: 'center',
        visivel: true
      },
      {
        id: baseId(),
        tipo: 'texto',
        x: 90,
        y: 430,
        largura: 300,
        altura: 30,
        fontSize: 13,
        cor: '#111827',
        fonte: 'Georgia',
        texto: '____________________________',
        alinhamento: 'center',
        visivel: true
      },
      {
        id: baseId(),
        tipo: 'texto',
        x: 90,
        y: 455,
        largura: 300,
        altura: 20,
        fontSize: 12,
        cor: '#6b7280',
        fonte: 'Georgia',
        texto: '{celebrante_nome}',
        alinhamento: 'center',
        visivel: true
      }
    ]
  },
  {
    id: 'certificado-casamento-branco',
    nome: 'Casamento em Branco',
    orientacao: 'landscape',
    categoria: 'casamento',
    variacao: 'branco',
    elementos: []
  },
  {
    id: 'certificado-branco',
    nome: 'Certificado em Branco',
    orientacao: 'landscape',
    categoria: 'apresentacao-criancas',
    variacao: 'branco',
    ativo: false,
    criado_pelo_usuario: true,
    elementos: []
  }
];

export function buildDefaultCertificadosSnapshot(): CertificadoTemplate[] {
  return CERTIFICADOS_TEMPLATES_BASE.map((t) => ({
    ...t,
    elementos: t.elementos.map((el) => ({ ...el }))
  }));
}
