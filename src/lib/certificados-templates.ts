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
  categoria?: 'ministerial';
  ativo?: boolean;
  criado_pelo_usuario?: boolean;
}

const baseId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const CERTIFICADOS_TEMPLATES_BASE: CertificadoTemplate[] = [
  {
    id: 'certificado-classico',
    nome: 'Certificado Ministerial Classico',
    orientacao: 'landscape',
    categoria: 'ministerial',
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
        texto: 'Certificado Ministerial',
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
        texto: 'Certificamos que <b>{ministro_nome}</b>, matrícula {matricula}, exerce o cargo de {cargo_ministerial} na {nome_igreja}.',
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
        texto: 'Congregação: {congregacao} | Data: {data_consagracao}',
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
        texto: 'Presidência',
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
        texto: '{presidente_nome}',
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
    nome: 'Certificado Ministerial Moderno',
    orientacao: 'landscape',
    categoria: 'ministerial',
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
        texto: 'Certificado Ministerial',
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
        texto: 'A {nome_igreja} certifica que <b>{ministro_nome}</b> está autorizado(a) a exercer o ministério de {cargo_ministerial}.',
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
        texto: 'Matrícula: {matricula} | Congregação: {congregacao}',
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
        texto: 'Data de consagração: {data_consagracao} | Emissão: {data_emissao}',
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
        texto: '{presidente_nome}',
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
    id: 'certificado-branco',
    nome: 'Certificado Ministerial em Branco',
    orientacao: 'landscape',
    categoria: 'ministerial',
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
