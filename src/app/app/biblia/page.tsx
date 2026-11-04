'use client';

/**
 * /app/biblia — Leitor Bíblico Oficial (Fase 1)
 *
 * Características da Arquitetura:
 * 1. Base Textual: Bíblia Livre (BLIVRE) — Tradução livre sob licença Creative Commons Atribuição 3.0 Brasil (CC BY 3.0 BR).
 * 2. Carregamento sob Demanda: O índice de 66 livros (/data/biblia/livros.json) e os livros individuais (/data/biblia/[livroId].json)
 *    são carregados estaticamente via cache local/PWA, sem requisições ao Supabase.
 * 3. Recursos:
 *    - Seletor intuitivo e responsivo de Livro (Antigo e Novo Testamento) e Capítulo.
 *    - Leitura fluida com versículos numerados.
 *    - Navegação rápida entre capítulos (Anterior / Próximo).
 *    - Controle de tipografia: tamanho da fonte ajustável (P, M, G, GG).
 *    - Histórico e persistência da última leitura em localStorage.
 *    - Favoritos locais: marcar e desmarcar versículos favoritos com persistência local.
 *    - Compartilhamento nativo: Web Share API com fallback para cópia de texto com créditos devidos à Bíblia Livre.
 *    - Aba de Favoritos salvos com leitura direta e remoção rápida.
 *    - Painel modal de Informações e Licença com créditos legais e oficiais da tradução.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import MobileHeader from '@/components/mobile/MobileHeader';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Type,
  Bookmark,
  Share2,
  Check,
  Search,
  Info,
  X,
  Sliders,
  BookMarked
} from 'lucide-react';

export interface LivroMeta {
  id: string;
  posicao: number;
  nome: string;
  nomeLongo: string;
  abrev: string;
  testamento: 'AT' | 'NT';
  grupo: string;
  totalCapitulos: number;
}

export interface LivroData {
  id: string;
  nome: string;
  nomeLongo: string;
  abrev: string;
  testamento: 'AT' | 'NT';
  grupo: string;
  totalCapitulos: number;
  capitulos: Record<string, Record<string, string>>;
}

export interface FavoritoItem {
  id: string; // ex: gn-1-1
  livroId: string;
  livroNome: string;
  abrev: string;
  capitulo: number;
  versiculo: number;
  texto: string;
  timestamp: number;
}

const STORAGE_LAST_READ = 'eklesia_biblia_last_read';
const STORAGE_FAVORITES = 'eklesia_biblia_favorites';
const STORAGE_FONT_SIZE = 'eklesia_biblia_font_size';

const FONT_SIZES = [
  { label: 'P', size: 'text-sm leading-relaxed', badge: '14px' },
  { label: 'M', size: 'text-base leading-relaxed', badge: '16px' },
  { label: 'G', size: 'text-lg leading-loose', badge: '18px' },
  { label: 'GG', size: 'text-xl leading-loose', badge: '20px' },
] as const;

export default function BibliaPage() {
  // Estado de metadados e carregamento de livros
  const [livros, setLivros] = useState<LivroMeta[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);

  // Livro e capítulo selecionados
  const [selectedBookId, setSelectedBookId] = useState<string>('jo'); // Padrão: Evangelho de João
  const [selectedCap, setSelectedCap] = useState<number>(3);           // Padrão: Capítulo 3

  // Dados do livro atual carregado sob demanda
  const [currentBookData, setCurrentBookData] = useState<LivroData | null>(null);
  const [loadingChapter, setLoadingChapter] = useState(false);

  // Modais e seletores
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [isCapModalOpen, setIsCapModalOpen] = useState(false);
  const [isFavoritesModalOpen, setIsFavoritesModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isFontModalOpen, setIsFontModalOpen] = useState(false);

  // Filtros no seletor de livros
  const [tabTestamento, setTabTestamento] = useState<'AT' | 'NT'>('NT');
  const [searchBookTerm, setSearchBookTerm] = useState('');

  // Preferências do leitor (Tamanho da fonte)
  const [fontIndex, setFontIndex] = useState<number>(1); // Padrão: M (16px)

  // Favoritos
  const [favoritos, setFavoritos] = useState<FavoritoItem[]>([]);
  const [copiedVersiculo, setCopiedVersiculo] = useState<string | null>(null);

  const contentRef = useRef<HTMLDivElement>(null);

  // 1. Carregar preferências salvas em localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const savedFont = localStorage.getItem(STORAGE_FONT_SIZE);
      if (savedFont !== null) {
        const parsed = parseInt(savedFont, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed < FONT_SIZES.length) {
          setFontIndex(parsed);
        }
      }

      const savedFavs = localStorage.getItem(STORAGE_FAVORITES);
      if (savedFavs) {
        setFavoritos(JSON.parse(savedFavs));
      }

      const savedLastRead = localStorage.getItem(STORAGE_LAST_READ);
      if (savedLastRead) {
        const { bookId, cap } = JSON.parse(savedLastRead);
        if (bookId && cap) {
          setSelectedBookId(bookId);
          setSelectedCap(cap);
        }
      }
    } catch (e) {
      console.warn('[BIBLIA] Erro ao recuperar preferências locais:', e);
    }
  }, []);

  // 2. Carregar índice geral de 66 livros da Bíblia Livre
  useEffect(() => {
    let isMounted = true;
    async function loadMeta() {
      try {
        setLoadingMeta(true);
        const res = await fetch('/data/biblia/livros.json', { cache: 'force-cache' });
        if (!res.ok) throw new Error('Não foi possível carregar os livros da Bíblia.');
        const data = await res.json();
        if (isMounted) {
          setLivros(data.livros || []);
        }
      } catch (err: any) {
        if (isMounted) {
          setMetaError(err?.message || 'Erro ao carregar índice bíblico.');
        }
      } finally {
        if (isMounted) setLoadingMeta(false);
      }
    }
    loadMeta();
    return () => { isMounted = false; };
  }, []);

  // 3. Carregar dados do livro sob demanda
  useEffect(() => {
    let isMounted = true;
    async function loadBook() {
      if (!selectedBookId) return;
      try {
        setLoadingChapter(true);
        const res = await fetch(`/data/biblia/${selectedBookId}.json`, { cache: 'force-cache' });
        if (!res.ok) throw new Error(`Não foi possível carregar o livro ${selectedBookId}`);
        const data: LivroData = await res.json();
        if (isMounted) {
          setCurrentBookData(data);
          // Salvar última leitura
          try {
            localStorage.setItem(
              STORAGE_LAST_READ,
              JSON.stringify({ bookId: selectedBookId, cap: selectedCap })
            );
          } catch {}
        }
      } catch (err) {
        console.error('[BIBLIA] Erro ao carregar livro:', err);
      } finally {
        if (isMounted) setLoadingChapter(false);
      }
    }

    loadBook();
    return () => { isMounted = false; };
  }, [selectedBookId, selectedCap]);

  // Rolar para o topo ao trocar de capítulo
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [selectedBookId, selectedCap]);

  // Metadados do livro atual selecionado
  const currentBookMeta = useMemo(() => {
    return livros.find((l) => l.id === selectedBookId) || null;
  }, [livros, selectedBookId]);

  // Lista de versículos do capítulo atual
  const versiculosCapitulo = useMemo(() => {
    if (!currentBookData || !currentBookData.capitulos) return [];
    const capObj = currentBookData.capitulos[String(selectedCap)];
    if (!capObj) return [];
    return Object.entries(capObj)
      .map(([v, texto]) => ({
        versiculo: parseInt(v, 10),
        texto,
      }))
      .sort((a, b) => a.versiculo - b.versiculo);
  }, [currentBookData, selectedCap]);

  // Navegação anterior / próximo capítulo
  const handlePrevChapter = useCallback(() => {
    if (selectedCap > 1) {
      setSelectedCap((c) => c - 1);
    } else {
      // Ir para o último capítulo do livro anterior
      if (!currentBookMeta) return;
      const currentIndex = livros.findIndex((l) => l.id === currentBookMeta.id);
      if (currentIndex > 0) {
        const prevBook = livros[currentIndex - 1];
        setSelectedBookId(prevBook.id);
        setSelectedCap(prevBook.totalCapitulos);
      }
    }
  }, [selectedCap, currentBookMeta, livros]);

  const handleNextChapter = useCallback(() => {
    if (!currentBookMeta) return;
    if (selectedCap < currentBookMeta.totalCapitulos) {
      setSelectedCap((c) => c + 1);
    } else {
      // Ir para o primeiro capítulo do próximo livro
      const currentIndex = livros.findIndex((l) => l.id === currentBookMeta.id);
      if (currentIndex < livros.length - 1) {
        const nextBook = livros[currentIndex + 1];
        setSelectedBookId(nextBook.id);
        setSelectedCap(1);
      }
    }
  }, [selectedCap, currentBookMeta, livros]);

  // Gerenciamento de Favoritos
  const toggleFavorito = useCallback((versiculoNum: number, texto: string) => {
    if (!currentBookMeta) return;
    const favId = `${currentBookMeta.id}-${selectedCap}-${versiculoNum}`;

    setFavoritos((prev) => {
      const exists = prev.some((f) => f.id === favId);
      let updated: FavoritoItem[];
      if (exists) {
        updated = prev.filter((f) => f.id !== favId);
      } else {
        const novo: FavoritoItem = {
          id: favId,
          livroId: currentBookMeta.id,
          livroNome: currentBookMeta.nome,
          abrev: currentBookMeta.abrev,
          capitulo: selectedCap,
          versiculo: versiculoNum,
          texto,
          timestamp: Date.now(),
        };
        updated = [novo, ...prev];
      }
      try {
        localStorage.setItem(STORAGE_FAVORITES, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, [currentBookMeta, selectedCap]);

  // Compartilhamento ou cópia de versículo com menção obrigatória à Bíblia Livre
  const handleShareVersiculo = async (versiculoNum: number, texto: string) => {
    if (!currentBookMeta) return;
    const refText = `${currentBookMeta.nome} ${selectedCap}:${versiculoNum}`;
    const fullText = `"${texto}" — ${refText} (BLIVRE)\n\nBíblia Livre (CC BY 3.0 BR) • Gestão Eklésia`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `${refText} — Bíblia Sagrada`,
          text: fullText,
        });
        return;
      } catch (e: any) {
        // Se o usuário cancelou o share nativo, não faz nada
        if (e.name === 'AbortError') return;
      }
    }

    // Fallback para cópia na área de transferência
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(fullText);
        setCopiedVersiculo(`${selectedCap}:${versiculoNum}`);
        setTimeout(() => setCopiedVersiculo(null), 2500);
      } catch {}
    }
  };

  // Alterar tamanho de fonte com persistência
  const handleSelectFontSize = (index: number) => {
    setFontIndex(index);
    try {
      localStorage.setItem(STORAGE_FONT_SIZE, String(index));
    } catch {}
  };

  // Filtragem dos livros por Testamento e Busca
  const filteredLivros = useMemo(() => {
    return livros.filter((l) => {
      const matchTestamento = l.testamento === tabTestamento;
      if (!searchBookTerm.trim()) return matchTestamento;
      const term = searchBookTerm.toLowerCase().trim();
      return (
        (matchTestamento || searchBookTerm.length > 2) &&
        (l.nome.toLowerCase().includes(term) ||
          l.abrev.toLowerCase().includes(term) ||
          l.grupo.toLowerCase().includes(term))
      );
    });
  }, [livros, tabTestamento, searchBookTerm]);

  return (
    <div className="min-h-full flex-1 flex flex-col bg-[#071D36] text-slate-100 select-text pb-20">
      {/* ── CABEÇALHO DO LEITOR BÍBLICO ── */}
      <MobileHeader
        title="Bíblia Sagrada"
        rightSlot={
          <div className="flex items-center gap-1.5">
            {/* Botão de Favoritos */}
            <button
              onClick={() => setIsFavoritesModalOpen(true)}
              className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 active:scale-95 transition relative cursor-pointer"
              title="Favoritos Salvos"
              aria-label="Versículos Favoritos"
            >
              <Bookmark size={18} className={favoritos.length > 0 ? 'text-amber-400 fill-amber-400' : ''} />
              {favoritos.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-black text-[9px] font-bold rounded-full flex items-center justify-center">
                  {favoritos.length > 99 ? '99+' : favoritos.length}
                </span>
              )}
            </button>

            {/* Botão de Ajuste de Fonte */}
            <button
              onClick={() => setIsFontModalOpen(true)}
              className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 active:scale-95 transition cursor-pointer"
              title="Ajuste de Tipografia"
              aria-label="Tamanho da Fonte"
            >
              <Type size={18} />
            </button>

            {/* Botão de Informações e Licença */}
            <button
              onClick={() => setIsInfoModalOpen(true)}
              className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 active:scale-95 transition cursor-pointer"
              title="Sobre a Tradução"
              aria-label="Sobre a Bíblia Livre"
            >
              <Info size={18} />
            </button>
          </div>
        }
      />

      {/* ── BARRA SUPERIOR DE SELEÇÃO: LIVRO & CAPÍTULO ── */}
      <div className="sticky top-14 z-30 px-3 py-2.5 bg-[#092242]/95 backdrop-blur-md border-b border-blue-900/40 shadow-xs">
        <div className="flex items-center justify-between gap-2 max-w-lg mx-auto">
          {/* Botão Seletor de Livro */}
          <button
            onClick={() => {
              setSearchBookTerm('');
              setIsBookModalOpen(true);
            }}
            className="flex-1 flex items-center justify-between px-3.5 py-2 bg-[#0c2a52] hover:bg-[#11386d] active:scale-[0.99] border border-blue-500/25 rounded-xl transition cursor-pointer"
          >
            <div className="flex items-center gap-2 truncate">
              <BookOpen size={16} className="text-blue-400 shrink-0" />
              <span className="text-sm font-bold text-white truncate">
                {currentBookMeta ? currentBookMeta.nome : 'Carregando...'}
              </span>
            </div>
            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
              {currentBookMeta?.testamento || 'BLIVRE'}
            </span>
          </button>

          {/* Botão Seletor de Capítulo */}
          <button
            onClick={() => setIsCapModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#0c2a52] hover:bg-[#11386d] active:scale-[0.99] border border-blue-500/25 rounded-xl transition cursor-pointer shrink-0"
          >
            <span className="text-xs text-slate-300 font-medium">Cap.</span>
            <span className="text-sm font-bold text-white font-mono">{selectedCap}</span>
          </button>

          {/* Setas de navegação rápida de capítulo */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handlePrevChapter}
              className="p-2 bg-[#0c2a52] hover:bg-[#11386d] active:scale-95 border border-blue-500/20 rounded-xl text-slate-300 hover:text-white transition cursor-pointer"
              title="Capítulo Anterior"
              aria-label="Capítulo Anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={handleNextChapter}
              className="p-2 bg-[#0c2a52] hover:bg-[#11386d] active:scale-95 border border-blue-500/20 rounded-xl text-slate-300 hover:text-white transition cursor-pointer"
              title="Próximo Capítulo"
              aria-label="Próximo Capítulo"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── ÁREA PRINCIPAL DO LEITOR DE TEXTO ── */}
      <main
        ref={contentRef}
        className="flex-1 px-4 py-6 max-w-lg mx-auto w-full overflow-y-auto"
      >
        {loadingMeta || loadingChapter ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-blue-300 font-medium animate-pulse">
              Carregando as Sagradas Escrituras...
            </p>
          </div>
        ) : metaError ? (
          <div className="p-4 bg-red-950/80 border border-red-500/50 rounded-2xl text-center text-xs text-red-200">
            {metaError}
          </div>
        ) : versiculosCapitulo.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <BookOpen size={36} className="mx-auto text-slate-500 mb-2" />
            <p className="text-sm font-medium">Capítulo não encontrado.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Título do Livro e Capítulo */}
            <div className="text-center pb-4 border-b border-blue-900/30">
              <h2 className="text-2xl font-black text-white tracking-tight">
                {currentBookMeta?.nome}
              </h2>
              <p className="text-xs font-semibold text-blue-300/80 uppercase tracking-widest mt-1">
                Capítulo {selectedCap} • Bíblia Livre
              </p>
            </div>

            {/* Feedback flutuante de cópia */}
            {copiedVersiculo && (
              <div className="sticky top-20 z-20 flex items-center justify-center">
                <div className="px-3.5 py-1.5 bg-emerald-600/95 text-white text-xs font-semibold rounded-full shadow-lg shadow-emerald-900/40 flex items-center gap-1.5 animate-bounce">
                  <Check size={14} />
                  <span>Versículo {copiedVersiculo} copiado com sucesso!</span>
                </div>
              </div>
            )}

            {/* Lista dos Versículos */}
            <div className={`space-y-3 ${FONT_SIZES[fontIndex].size}`}>
              {versiculosCapitulo.map(({ versiculo, texto }) => {
                const favId = `${selectedBookId}-${selectedCap}-${versiculo}`;
                const isFav = favoritos.some((f) => f.id === favId);

                return (
                  <div
                    key={versiculo}
                    className={`group relative p-2.5 rounded-xl transition-colors ${
                      isFav
                        ? 'bg-amber-400/10 border-l-2 border-amber-400'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <p className="text-slate-200 text-justify">
                      <sup className="text-blue-400 font-bold font-mono mr-1.5 text-xs select-none">
                        {versiculo}
                      </sup>
                      {texto}
                    </p>

                    {/* Barra de Ações Rápidas por Versículo */}
                    <div className="flex items-center justify-end gap-1.5 mt-1 pt-1 opacity-70 group-hover:opacity-100 transition-opacity">
                      {/* Favoritar */}
                      <button
                        onClick={() => toggleFavorito(versiculo, texto)}
                        className={`p-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
                          isFav
                            ? 'text-amber-300 bg-amber-400/20'
                            : 'text-slate-400 hover:text-amber-300 hover:bg-white/5'
                        }`}
                        title={isFav ? 'Remover dos favoritos' : 'Favoritar versículo'}
                        aria-label="Favoritar"
                      >
                        <Bookmark size={13} className={isFav ? 'fill-amber-400' : ''} />
                      </button>

                      {/* Compartilhar */}
                      <button
                        onClick={() => handleShareVersiculo(versiculo, texto)}
                        className="p-1.5 text-slate-400 hover:text-blue-300 hover:bg-white/5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1"
                        title="Compartilhar ou copiar versículo"
                        aria-label="Compartilhar Versículo"
                      >
                        <Share2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Rodapé de navegação do final da página */}
            <div className="pt-8 pb-4 flex items-center justify-between border-t border-blue-900/30">
              <button
                onClick={handlePrevChapter}
                className="px-4 py-2.5 bg-[#0c2a52] hover:bg-[#11386d] active:scale-95 text-slate-200 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-blue-500/20 cursor-pointer shadow-sm"
              >
                <ChevronLeft size={16} />
                <span>Capítulo Anterior</span>
              </button>

              <button
                onClick={handleNextChapter}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-blue-400/30 cursor-pointer shadow-md shadow-blue-900/30"
              >
                <span>Próximo Capítulo</span>
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Atribuição de Direitos no Rodapé */}
            <div className="pt-4 text-center">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Texto bíblico: <strong>Bíblia Livre (BLIVRE)</strong> • Licença CC BY 3.0 BR
              </p>
            </div>
          </div>
        )}
      </main>

      {/* ── MODAL 1: SELETOR DE LIVROS (AT & NT) ── */}
      {isBookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs p-0 sm:p-4">
          <div className="w-full max-w-lg bg-[#0b213f] border border-blue-900/50 rounded-t-3xl sm:rounded-2xl max-h-[85dvh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-5">
            {/* Cabeçalho do Modal */}
            <div className="flex items-center justify-between p-4 border-b border-blue-900/40">
              <div className="flex items-center gap-2">
                <BookOpen size={20} className="text-blue-400" />
                <h3 className="font-bold text-white text-base">Selecione o Livro</h3>
              </div>
              <button
                onClick={() => setIsBookModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            {/* Campo de Busca Rápida */}
            <div className="p-3 border-b border-blue-900/30">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={searchBookTerm}
                  onChange={(e) => setSearchBookTerm(e.target.value)}
                  placeholder="Pesquisar livro (ex: Salmos, João, Mt)..."
                  className="w-full bg-[#07162b] border border-blue-500/20 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>

            {/* Alternador Antigo Testamento / Novo Testamento */}
            <div className="flex p-2 bg-[#07162b] border-b border-blue-900/30">
              <button
                onClick={() => setTabTestamento('AT')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                  tabTestamento === 'AT'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Antigo Testamento (39)
              </button>
              <button
                onClick={() => setTabTestamento('NT')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                  tabTestamento === 'NT'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Novo Testamento (27)
              </button>
            </div>

            {/* Grade de Livros */}
            <div className="p-3 overflow-y-auto flex-1 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {filteredLivros.map((livro) => {
                const isCurrent = livro.id === selectedBookId;
                return (
                  <button
                    key={livro.id}
                    onClick={() => {
                      setSelectedBookId(livro.id);
                      setSelectedCap(1);
                      setIsBookModalOpen(false);
                    }}
                    className={`flex flex-col items-start p-2.5 rounded-xl text-left transition cursor-pointer border ${
                      isCurrent
                        ? 'bg-blue-600/30 border-blue-400 text-white'
                        : 'bg-[#0e2a4f]/70 border-blue-900/30 text-slate-200 hover:bg-[#133869]'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-xs truncate">{livro.nome}</span>
                      <span className="font-mono text-[10px] text-blue-300 font-bold">
                        {livro.abrev}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1">
                      {livro.totalCapitulos} {livro.totalCapitulos === 1 ? 'capítulo' : 'capítulos'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 2: SELETOR DE CAPÍTULOS ── */}
      {isCapModalOpen && currentBookMeta && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs p-0 sm:p-4">
          <div className="w-full max-w-md bg-[#0b213f] border border-blue-900/50 rounded-t-3xl sm:rounded-2xl max-h-[80dvh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-5">
            <div className="flex items-center justify-between p-4 border-b border-blue-900/40">
              <div>
                <h3 className="font-bold text-white text-base">
                  {currentBookMeta.nome}
                </h3>
                <p className="text-[11px] text-blue-300">Selecione o capítulo desejado</p>
              </div>
              <button
                onClick={() => setIsCapModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            {/* Grid dos Números de Capítulos */}
            <div className="p-4 overflow-y-auto flex-1 grid grid-cols-5 sm:grid-cols-6 gap-2">
              {Array.from({ length: currentBookMeta.totalCapitulos }, (_, i) => i + 1).map((capNum) => {
                const isCurrent = capNum === selectedCap;
                return (
                  <button
                    key={capNum}
                    onClick={() => {
                      setSelectedCap(capNum);
                      setIsCapModalOpen(false);
                    }}
                    className={`h-11 rounded-xl font-bold font-mono text-sm transition cursor-pointer flex items-center justify-center ${
                      isCurrent
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40 border border-blue-400'
                        : 'bg-[#0e2a4f] text-slate-200 hover:bg-[#133869] border border-blue-900/30'
                    }`}
                  >
                    {capNum}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 3: AJUSTE DE FONTE & TIPOGRAFIA ── */}
      {isFontModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-xs p-0 sm:p-4">
          <div className="w-full max-w-sm bg-[#0b213f] border border-blue-900/50 rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl animate-in slide-in-from-bottom-5 space-y-4">
            <div className="flex items-center justify-between border-b border-blue-900/40 pb-3">
              <div className="flex items-center gap-2">
                <Sliders size={18} className="text-blue-400" />
                <h3 className="font-bold text-white text-base">Tamanho do Texto</h3>
              </div>
              <button
                onClick={() => setIsFontModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Escolha a melhor legibilidade para sua leitura contínua no celular:
            </p>

            <div className="grid grid-cols-4 gap-2 pt-1">
              {FONT_SIZES.map((f, idx) => (
                <button
                  key={f.label}
                  onClick={() => handleSelectFontSize(idx)}
                  className={`py-3 rounded-xl flex flex-col items-center justify-center gap-1 transition cursor-pointer border ${
                    fontIndex === idx
                      ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-900/40'
                      : 'bg-[#0e2a4f] text-slate-300 hover:bg-[#133869] border-blue-900/30'
                  }`}
                >
                  <span className="font-bold text-base">{f.label}</span>
                  <span className="text-[10px] opacity-75">{f.badge}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsFontModalOpen(false)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer mt-2"
            >
              Aplicar e Fechar
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL 4: VERSÍCULOS FAVORITOS SALVOS ── */}
      {isFavoritesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs p-0 sm:p-4">
          <div className="w-full max-w-lg bg-[#0b213f] border border-blue-900/50 rounded-t-3xl sm:rounded-2xl max-h-[85dvh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-5">
            <div className="flex items-center justify-between p-4 border-b border-blue-900/40">
              <div className="flex items-center gap-2">
                <Bookmark size={20} className="text-amber-400 fill-amber-400" />
                <div>
                  <h3 className="font-bold text-white text-base">Meus Favoritos</h3>
                  <p className="text-[11px] text-slate-400">
                    {favoritos.length} {favoritos.length === 1 ? 'versículo salvo' : 'versículos salvos'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFavoritesModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {favoritos.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <Bookmark size={36} className="mx-auto text-slate-500 mb-2" />
                  <p className="text-sm font-semibold">Nenhum versículo favorito salvo ainda.</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                    Toque no ícone de marcador ao lado de qualquer versículo durante sua leitura para guardá-lo aqui.
                  </p>
                </div>
              ) : (
                favoritos.map((fav) => (
                  <div
                    key={fav.id}
                    className="p-3.5 bg-[#0e2a4f] border border-blue-900/40 rounded-xl space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => {
                          setSelectedBookId(fav.livroId);
                          setSelectedCap(fav.capitulo);
                          setIsFavoritesModalOpen(false);
                        }}
                        className="text-xs font-bold text-blue-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <span>{fav.livroNome} {fav.capitulo}:{fav.versiculo}</span>
                        <ChevronRight size={13} />
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleShareVersiculo(fav.versiculo, fav.texto)}
                          className="p-1.5 text-slate-400 hover:text-blue-300 rounded hover:bg-white/5 transition"
                          title="Compartilhar"
                        >
                          <Share2 size={13} />
                        </button>
                        <button
                          onClick={() => toggleFavorito(fav.versiculo, fav.texto)}
                          className="p-1.5 text-slate-400 hover:text-red-400 rounded hover:bg-white/5 transition"
                          title="Remover favorito"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-200 leading-relaxed italic">
                      "{fav.texto}"
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 5: INFORMAÇÕES E CRÉDITOS DA TRADUÇÃO (LICENÇA CC BY 3.0 BR) ── */}
      {isInfoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs p-0 sm:p-4">
          <div className="w-full max-w-md bg-[#0b213f] border border-blue-900/50 rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl animate-in slide-in-from-bottom-5 space-y-4">
            <div className="flex items-center justify-between border-b border-blue-900/40 pb-3">
              <div className="flex items-center gap-2">
                <BookMarked size={20} className="text-blue-400" />
                <h3 className="font-bold text-white text-base">Bíblia Livre (BLIVRE)</h3>
              </div>
              <button
                onClick={() => setIsInfoModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-3 leading-relaxed max-h-[60dvh] overflow-y-auto pr-1">
              <p>
                A <strong>Bíblia Livre (BLIVRE)</strong> é uma tradução em língua portuguesa das Sagradas Escrituras elaborada com base nos textos originais hebraicos, aramaicos e gregos (Textus Receptus), disponibilizada de forma aberta sob licença livre.
              </p>

              <div className="p-3 bg-[#07162b] border border-blue-500/20 rounded-xl space-y-1.5 text-[11px]">
                <p className="font-bold text-blue-300">Atribuição de Direitos:</p>
                <p className="text-slate-300">
                  Todas as Escrituras em português citadas são da Bíblia Livre (BLIVRE), Copyright © Diego Santos, Mario Sérgio, e Marco Teles.
                </p>
                <p className="text-slate-400">
                  Licença Creative Commons Atribuição 3.0 Brasil (CC BY 3.0 BR).
                </p>
                <p className="text-slate-400">
                  Projeto oficial: <span className="font-mono text-blue-300">https://github.com/blivre/BibliaLivre</span>
                </p>
              </div>

              <div className="space-y-1">
                <h4 className="font-bold text-white">Recursos do Aplicativo:</h4>
                <ul className="list-disc list-inside text-slate-400 text-[11px] space-y-0.5">
                  <li>Carregamento particionado e sob demanda por livro.</li>
                  <li>Cache estático offline pelo Service Worker (PWA).</li>
                  <li>Zero consultas ao banco de dados para leitura dos textos.</li>
                  <li>Favoritos e última leitura salvos no seu dispositivo.</li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => setIsInfoModalOpen(false)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              Compreendi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
