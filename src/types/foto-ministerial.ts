/**
 * Tipos e Definições para o Editor de Foto Ministerial
 * Gestão Eklésia
 */

export interface TrajeMinisterial {
  id: string;
  nome: string;
  descricao?: string;
  preview: string; // URL ou SVG/data placeholder para visualização na seleção
  overlay: string | null; // URL do PNG transparente com o traje (ou null para 'nenhum')
  ativo: boolean;
  corDestaque?: string;
}

export interface ComposicaoFotoCamadas {
  /** Foto original preservada, sem cortes destrutivos ou overlays gravados */
  fotoOriginal: string | null;
  /** Traje selecionado para compor sobre a foto */
  trajeId: string;
  /** Transformações da foto dentro da viewport 3x4 */
  transform: {
    zoom: number; // 1x a 3x
    posX: number; // deslocamento horizontal (-150px a +150px)
    posY: number; // deslocamento vertical (-150px a +150px)
    rotacao: number; // 0, 90, 180, 270 graus
  };
  /** Composição final rasterizada resultante para preview / upload */
  fotoCompostaPreview: string | null;
}

export const TRAJES_MINISTERIAIS_PRESET: TrajeMinisterial[] = [
  {
    id: 'nenhum',
    nome: 'Nenhum',
    descricao: 'Foto original sem sobreposição',
    preview: '',
    overlay: null,
    ativo: true,
    corDestaque: '#94a3b8',
  },
  {
    id: 'terno-preto',
    nome: 'Terno Preto',
    descricao: 'Traje clássico escuro com gravata',
    preview: '/img/terno-preto.png',
    overlay: '/img/terno-preto.png',
    ativo: true,
    corDestaque: '#0f172a',
  },
  {
    id: 'terno-azul',
    nome: 'Terno Azul',
    descricao: 'Traje executivo azul marinho',
    preview: '/img/terno-azul.png',
    overlay: '/img/terno-azul.png',
    ativo: true,
    corDestaque: '#1e3a8a',
  },
  {
    id: 'terno-cinza',
    nome: 'Terno Cinza',
    descricao: 'Traje formal cinza grafite',
    preview: '/img/terno-cinza.png',
    overlay: '/img/terno-cinza.png',
    ativo: true,
    corDestaque: '#475569',
  },
];
