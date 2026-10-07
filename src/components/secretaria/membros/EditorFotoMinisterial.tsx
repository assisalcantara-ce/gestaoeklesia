'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload,
  RotateCw,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Trash2,
  Check,
  Sparkles,
  Layers,
  Image as ImageIcon,
  User,
  Sliders,
  Wand2,
  Loader2,
  Undo2,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Move,
  Minus,
  Plus,
} from 'lucide-react';
import {
  TRAJES_MINISTERIAIS_PRESET,
} from '@/types/foto-ministerial';

export interface EditorFotoMinisterialProps {
  /** Foto atualmente gravada no membro */
  fotoMembro: string | null;
  /** Callback para atualizar o resultado composto final no formulário */
  onSaveComposicao: (fotoResultado: string | null) => void;
  /** Ref do input de arquivo oculto gerenciado pelo componente pai ou interno */
  fileInputRef?: React.RefObject<HTMLInputElement | null>;
  /** Callback opcional quando o arquivo for selecionado */
  onFileSelect?: (file: File) => void;
  /** Notificação ou mensagem opcional */
  className?: string;
}

export default function EditorFotoMinisterial({
  fotoMembro,
  onSaveComposicao,
  fileInputRef: externalFileInputRef,
  onFileSelect,
  className = '',
}: EditorFotoMinisterialProps) {
  // ── 1. Foto original SEMPRE preservada separadamente ──────────────────────────
  // Guarda a referência original imutável para não ser sobrescrita pelo callback de composição derivada
  const fotoBaseOriginalRef = useRef<string | null>(fotoMembro);
  const [fotoOriginal, setFotoOriginal] = useState<string | null>(fotoMembro);

  // ── 1.1 Versão processada com fundo transparente (PNG) ────────────────────────
  const [fotoSemFundo, setFotoSemFundo] = useState<string | null>(null);
  const [processandoFundo, setProcessandoFundo] = useState<boolean>(false);
  const [erroFundo, setErroFundo] = useState<string | null>(null);

  // ── 2. Camada de Traje Ministerial ──────────────────────────────────────────
  const [trajeSelecionado, setTrajeSelecionado] = useState<string>('nenhum');

  // Transformações independentes e proporcionais da camada do traje (Camada 2)
  const [trajeEscala, setTrajeEscala] = useState<number>(1.0); // 0.6x a 1.6x (100% padrão)
  const [trajePosX, setTrajePosX] = useState<number>(0); // Deslocamento horizontal em px (-100 a +100)
  const [trajePosY, setTrajePosY] = useState<number>(0); // Deslocamento vertical em px (-100 a +100)

  // ── 3. Transformações de enquadramento da Fotografia (Camada 1) ─────────────
  const [zoom, setZoom] = useState<number>(1);
  const [posX, setPosX] = useState<number>(0);
  const [posY, setPosY] = useState<number>(0);
  const [rotacao, setRotacao] = useState<number>(0);

  // ── 4. Estados de interação do mouse (Arrastar / Drag independente) ──────────
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'foto' | 'traje'>('foto');
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // ── 5. Refs para Canvas e Elementos ──────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const internalFileInputRef = useRef<HTMLInputElement>(null);
  const activeFileInputRef = externalFileInputRef || internalFileInputRef;
  const viewportRef = useRef<HTMLDivElement>(null);

  // Sincroniza SOMENTE se a foto inicial mudar externamente por troca de membro real
  useEffect(() => {
    if (fotoMembro && fotoMembro !== fotoBaseOriginalRef.current && !fotoMembro.startsWith('data:image/jpeg;base64')) {
      fotoBaseOriginalRef.current = fotoMembro;
      setFotoOriginal(fotoMembro);
      setFotoSemFundo(null);
      setErroFundo(null);
    }
  }, [fotoMembro]);

  // ── Resetar enquadramento mantendo a foto e o traje selecionado ─────────────
  const resetarEnquadramento = useCallback(() => {
    // Restaura enquadramento da fotografia
    setZoom(1);
    setPosX(0);
    setPosY(0);
    setRotacao(0);
    // Restaura posição e escala padrão do traje (mantendo o traje selecionado)
    setTrajeEscala(1.0);
    setTrajePosX(0);
    setTrajePosY(0);
  }, []);

  // ── Remover foto ────────────────────────────────────────────────────────────
  const removerFoto = useCallback(() => {
    setFotoOriginal(null);
    setFotoSemFundo(null);
    setErroFundo(null);
    setTrajeSelecionado('nenhum');
    resetarEnquadramento();
    onSaveComposicao(null);
    if (activeFileInputRef.current) {
      activeFileInputRef.current.value = '';
    }
  }, [resetarEnquadramento, onSaveComposicao, activeFileInputRef]);

  // ── Handler de Upload local ─────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (onFileSelect) {
      onFileSelect(file);
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      // Salva na foto original separada
      setFotoOriginal(dataUrl);
      setFotoSemFundo(null);
      setErroFundo(null);
      resetarEnquadramento();
    };
    reader.readAsDataURL(file);
  };

  // ── Remover fundo da foto com alta precisão (isnet_fp16) e refinamento de bordas ──
  const handleRemoverFundo = async () => {
    if (!fotoOriginal || processandoFundo) return;
    setProcessandoFundo(true);
    setErroFundo(null);

    try {
      const { removeBackground } = await import('@imgly/background-removal');
      
      // 1. Processamento via rede neural de alta precisão (isnet_fp16)
      const blob = await removeBackground(fotoOriginal, {
        model: 'isnet_fp16',
        output: {
          format: 'image/png',
          quality: 1.0,
        },
      });

      // 2. Refinamento de matização e descontinuidade de halo (Defringe / Matting)
      const rawUrl = URL.createObjectURL(blob);
      const tempImg = new Image();
      tempImg.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        tempImg.onload = () => resolve();
        tempImg.onerror = reject;
        tempImg.src = rawUrl;
      });

      const offCanvas = document.createElement('canvas');
      offCanvas.width = tempImg.width;
      offCanvas.height = tempImg.height;
      const ctx = offCanvas.getContext('2d');

      if (ctx) {
        ctx.drawImage(tempImg, 0, 0);
        const imgData = ctx.getImageData(0, 0, offCanvas.width, offCanvas.height);
        const data = imgData.data;

        // Limpeza suave de pixels semitransparentes com ruído de fundo (soft alpha threshold & edge defringe)
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3];
          if (alpha > 0 && alpha < 16) {
            // Elimina ruídos/fantasmas microscópicos do fundo
            data[i + 3] = 0;
          } else if (alpha >= 16 && alpha < 240) {
            // Suaviza a transição nas bordas dos fios de cabelo e ombros, evitando halo branco/cinza
            // Curva suave de preservação alfa
            const factor = Math.min(1, Math.pow(alpha / 255, 0.95));
            data[i + 3] = Math.round(factor * 255);
          }
        }

        ctx.putImageData(imgData, 0, 0);
        const refinedBlob = await new Promise<Blob | null>((res) =>
          offCanvas.toBlob(res, 'image/png')
        );

        if (refinedBlob) {
          const refinedUrl = URL.createObjectURL(refinedBlob);
          setFotoSemFundo(refinedUrl);
        } else {
          setFotoSemFundo(rawUrl);
        }
      } else {
        setFotoSemFundo(rawUrl);
      }
    } catch (err: any) {
      console.error('Erro ao remover fundo da imagem:', err);
      setErroFundo(
        'Não foi possível remover o fundo automaticamente. A fotografia original foi mantida intacta.'
      );
    } finally {
      setProcessandoFundo(false);
    }
  };

  // ── Restaurar fundo (voltar para a foto original) ───────────────────────────
  const handleRestaurarFundo = () => {
    setFotoSemFundo(null);
    setErroFundo(null);
  };

  // ── Rotação (Ajuste fino de 5° em 5°, limite -90° a +90°) ───────────────────
  const girarAntiHorario = () => setRotacao((prev) => Math.max(-90, prev - 5));
  const girarHorario = () => setRotacao((prev) => Math.min(90, prev + 5));
  const resetarRotacao = () => setRotacao(0);

  // ── Interação de Arrastar (Pan/Drag independente de Foto e Traje) ───────────
  const handleMouseDown = (e: React.MouseEvent, mode: 'foto' | 'traje' = 'foto') => {
    if (!fotoOriginal) return;
    setIsDragging(true);
    setDragMode(mode);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !fotoOriginal) return;
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    if (dragMode === 'traje') {
      // Arraste independente da camada do traje
      setTrajePosX((prev) => Math.max(-120, Math.min(120, prev + deltaX)));
      setTrajePosY((prev) => Math.max(-120, Math.min(120, prev + deltaY)));
    } else {
      // Arraste independente da fotografia
      setPosX((prev) => Math.max(-150, Math.min(150, prev + deltaX)));
      setPosY((prev) => Math.max(-150, Math.min(150, prev + deltaY)));
    }
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => setIsDragging(false);

  // ── Wheel para Zoom ─────────────────────────────────────────────────────────
  const handleWheel = (e: React.WheelEvent) => {
    if (!fotoOriginal) return;
    e.preventDefault();
    const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((prev) => Math.max(1, Math.min(3, parseFloat((prev + zoomDelta).toFixed(2)))));
  };

  // ── Gerar Composição Rasterizada no Canvas 3x4 (300 x 400 px padrão) ────────
  const renderizarComposicao = useCallback(() => {
    if (!fotoOriginal || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const targetWidth = 300;
    const targetHeight = 400; // Proporção 3x4 exata
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    // Fundo neutro limpo
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // ── CAMADA 1: Fotografia Original (com transformações) ───────────────────
      ctx.save();
      const centerX = targetWidth / 2;
      const centerY = targetHeight / 2;

      const previewWidth = 240;
      const ratio = targetWidth / previewWidth; // 1.25

      ctx.translate(centerX, centerY);
      ctx.rotate((rotacao * Math.PI) / 180);
      ctx.scale(zoom, zoom);
      ctx.translate(posX * ratio, posY * ratio);
      ctx.translate(-centerX, -centerY);

      // Enquadramento proporcional cover
      const imgAspect = img.width / img.height;
      const canvasAspect = targetWidth / targetHeight;

      let drawWidth, drawHeight, drawX, drawY;
      if (imgAspect > canvasAspect) {
        drawHeight = targetHeight;
        drawWidth = targetHeight * imgAspect;
        drawX = (targetWidth - drawWidth) / 2;
        drawY = 0;
      } else {
        drawWidth = targetWidth;
        drawHeight = targetWidth / imgAspect;
        drawX = 0;
        drawY = (targetHeight - drawHeight) / 2;
      }

      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
      ctx.restore();

      // ── CAMADA 2: Traje Ministerial PNG (Camada Independente - Idêntica ao Preview) ──
      const traje = TRAJES_MINISTERIAIS_PRESET.find((t) => t.id === trajeSelecionado);
      if (traje && traje.overlay) {
        const overlayImg = new Image();
        overlayImg.crossOrigin = 'anonymous';
        overlayImg.onload = () => {
          // Escala exata entre canvas (300x400) e preview (240x320): ratio = 300/240 = 1.25
          const previewWidth = 240;
          const ratio = targetWidth / previewWidth; // 1.25

          // No preview:
          // container do traje: absolute inset-0 flex flex-col justify-end items-center
          // img: width: `${108 * trajeEscala}%` (de previewWidth)
          // transform: `translate(${trajePosX}px, calc(17.5% + ${trajePosY}px))`
          // onde 17.5% no CSS transform de translateY(17.5%) é relativo à altura da própria imagem (overlayH)
          const suitAspect = overlayImg.width / overlayImg.height;
          const overlayW = targetWidth * 1.08 * trajeEscala;
          const overlayH = overlayW / suitAspect;

          // Posição X: centralizado horizontalmente no canvas + deslocamento escalado
          const overlayX = (targetWidth - overlayW) / 2 + (trajePosX * ratio);

          // Posição Y: alinhado à base inferior do canvas (targetHeight - overlayH)
          // + deslocamento translateY(17.5% de overlayH) + deslocamento manual escalado (trajePosY * ratio)
          const baseOffsetTranslateY = overlayH * 0.175;
          const overlayY = (targetHeight - overlayH) + baseOffsetTranslateY + (trajePosY * ratio);

          ctx.drawImage(overlayImg, overlayX, overlayY, overlayW, overlayH);
          const dataUrlComposta = canvas.toDataURL('image/jpeg', 0.92);
          onSaveComposicao(dataUrlComposta);
        };
        overlayImg.src = traje.overlay;
      } else {
        // Se 'nenhum' ou sem overlay png pronto, a composição é a foto enquadrada
        const dataUrlComposta = canvas.toDataURL('image/jpeg', 0.92);
        onSaveComposicao(dataUrlComposta);
      }
    };
    const fotoAtiva = fotoSemFundo || fotoOriginal;
    img.src = fotoAtiva;
  }, [
    fotoOriginal,
    fotoSemFundo,
    trajeSelecionado,
    trajeEscala,
    trajePosX,
    trajePosY,
    zoom,
    posX,
    posY,
    rotacao,
    onSaveComposicao,
  ]);

  // Atualiza composição quando os controles são alterados (com debounce suave)
  useEffect(() => {
    if (!fotoOriginal) return;
    const timer = setTimeout(() => {
      renderizarComposicao();
    }, 150);
    return () => clearTimeout(timer);
  }, [renderizarComposicao, fotoOriginal, fotoSemFundo, trajeEscala, trajePosX, trajePosY]);

  // Atualiza composição quando os controles são alterados (com debounce suave)
  useEffect(() => {
    if (!fotoOriginal) return;
    const timer = setTimeout(() => {
      renderizarComposicao();
    }, 150);
    return () => clearTimeout(timer);
  }, [renderizarComposicao, fotoOriginal, fotoSemFundo]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Input de arquivo nativo oculto */}
      <input
        type="file"
        ref={activeFileInputRef}
        onChange={handleFileChange}
        accept="image/png,image/jpeg,image/webp,image/jpg"
        className="hidden"
      />

      {/* Canvas invisível para processamento da composição final */}
      <canvas ref={canvasRef} className="hidden" />

      {/* ── CARD PRINCIPAL DO EDITOR ── */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Cabeçalho do Editor */}
        <div className="px-6 py-4.5 bg-slate-50/80 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center font-bold shadow-2xs">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Editor de Foto Ministerial (3x4)
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Enquadre a foto e selecione o traje institucional com sobreposição profissional
              </p>
            </div>
          </div>

          {fotoOriginal && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => activeFileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-xl text-xs font-semibold transition cursor-pointer shadow-2xs"
                title="Trocar imagem original"
              >
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span>Trocar Foto</span>
              </button>
              <button
                type="button"
                onClick={removerFoto}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-semibold transition cursor-pointer shadow-2xs"
                title="Remover fotografia"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Remover</span>
              </button>
            </div>
          )}
        </div>

        {/* Corpo do Editor: Grid responsivo (Preview 3x4 + Controles) */}
        <div className="p-6">
          {!fotoOriginal ? (
            /* Estado Inicial: Nenhum Arquivo Enviado */
            <div className="border-2 border-dashed border-slate-300 rounded-3xl p-10 text-center bg-slate-50/50 flex flex-col items-center justify-center min-h-[340px] transition hover:border-teal-500/80 hover:bg-teal-50/20">
              <div className="w-16 h-16 rounded-2xl bg-teal-50 text-teal-700 border border-teal-200/80 flex items-center justify-center mb-4 shadow-xs">
                <Upload className="w-8 h-8 text-teal-700" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-1">
                Selecione a Fotografia do Membro
              </h4>
              <p className="text-xs text-slate-500 max-w-md mb-6 leading-relaxed">
                Envie uma foto comum em formato JPG ou PNG. O sistema preservará a imagem original e permitirá enquadrá-la em padrão vertical 3x4 com ajuste de traje ministerial.
              </p>
              <button
                type="button"
                onClick={() => activeFileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-sm font-bold transition shadow-xs border border-teal-800 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Escolher Imagem</span>
              </button>
            </div>
          ) : (
            /* Estado Ativo: Foto Carregada com Ferramentas */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Lado Esquerdo: Área de Preview Vertical 3x4 */}
              <div className="lg:col-span-5 flex flex-col items-center">
                <div className="w-full flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-teal-600" />
                    Preview 3x4
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                    Arraste para posicionar
                  </span>
                </div>

                {/* Container Viewport Proporção 3x4 (240px x 320px) */}
                <div
                  ref={viewportRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onWheel={handleWheel}
                  className={`relative w-[240px] h-[320px] rounded-2xl overflow-hidden shadow-md border-2 border-slate-300 select-none ${
                    isDragging ? 'cursor-grabbing' : 'cursor-grab'
                  }`}
                  style={{
                    touchAction: 'none',
                    // Fundo quadriculado sutil para transparência (checkerboard)
                    backgroundColor: '#f8fafc',
                    backgroundImage: fotoSemFundo
                      ? 'linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)'
                      : 'none',
                    backgroundSize: '16px 16px',
                    backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                  }}
                >
                  {/* CAMADA 1: FOTO DO MEMBRO (Original ou sem fundo) */}
                  <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                    <img
                      src={fotoSemFundo || fotoOriginal}
                      alt="Fotografia do membro"
                      draggable={false}
                      className="max-w-none pointer-events-none transition-transform duration-75 origin-center object-cover"
                      style={{
                        transform: `rotate(${rotacao}deg) scale(${zoom}) translate(${posX}px, ${posY}px)`,
                        width: '100%',
                        height: '100%',
                      }}
                    />
                  </div>

                  {/* Indicador de Fundo Removido no Canto Superior Esquerdo */}
                  {fotoSemFundo && (
                    <div className="absolute top-2 left-2 z-20 px-2 py-0.5 rounded-md bg-teal-900/80 backdrop-blur-xs text-[10px] font-bold text-white border border-teal-500/40 shadow-xs flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 text-teal-300" />
                      <span>Fundo Removido</span>
                    </div>
                  )}

                  {/* CAMADA 2: OVERLAY VISUAL DE TRAJE MINISTERIAL (Camada Independente) */}
                  {trajeSelecionado !== 'nenhum' && (() => {
                    const traje = TRAJES_MINISTERIAIS_PRESET.find((t) => t.id === trajeSelecionado);
                    if (!traje?.overlay) return null;
                    return (
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleMouseDown(e, 'traje');
                        }}
                        className="absolute inset-0 flex flex-col justify-end items-center z-10 overflow-hidden cursor-grab active:cursor-grabbing"
                        title="Arraste para posicionar o traje"
                      >
                        {/* Imagem do traje com escala proporcional e posição X / Y manuais */}
                        <img
                          src={traje.overlay}
                          alt={traje.nome}
                          draggable={false}
                          className="max-w-none object-contain select-none pointer-events-none drop-shadow-sm transition-transform duration-75"
                          style={{
                            width: `${108 * trajeEscala}%`,
                            transform: `translate(${trajePosX}px, calc(17.5% + ${trajePosY}px))`,
                          }}
                        />

                        {/* Badge indicador da camada ativa */}
                        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-[10px] font-bold text-white border border-white/20 pointer-events-none">
                          {traje.nome} • {Math.round(trajeEscala * 100)}%
                        </div>
                      </div>
                    );
                  })()}

                  {/* Guia de corte sutil nos cantos */}
                  <div className="absolute inset-0 pointer-events-none border border-white/20 rounded-2xl" />
                </div>

                <p className="text-[11px] text-slate-400 font-medium mt-2.5 text-center">
                  Utilize o scroll do mouse ou os controles para aplicar zoom
                </p>
              </div>

              {/* Lado Direito: Controles de Ajuste e Seleção de Traje */}
              <div className="lg:col-span-7 space-y-6">
                {/* ── Painel de Ajustes de Enquadramento ── */}
                <div className="bg-slate-50/80 rounded-2xl border border-slate-200/90 p-4.5 space-y-4">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-teal-600" />
                      Ajustes de Enquadramento
                    </span>
                    <button
                      type="button"
                      onClick={resetarEnquadramento}
                      className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-800 hover:underline cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Resetar
                    </button>
                  </div>

                  {/* Controle de Zoom */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-700 flex items-center gap-1">
                        <ZoomIn className="w-3.5 h-3.5 text-slate-500" /> Zoom
                      </span>
                      <span className="font-extrabold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                        {zoom.toFixed(1)}x
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setZoom((z) => Math.max(1, parseFloat((z - 0.1).toFixed(2))))}
                        className="p-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 transition"
                        title="Diminuir zoom"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="range"
                        min="1"
                        max="3"
                        step="0.05"
                        value={zoom}
                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                      />
                      <button
                        type="button"
                        onClick={() => setZoom((z) => Math.min(3, parseFloat((z + 0.1).toFixed(2))))}
                        className="p-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 transition"
                        title="Aumentar zoom"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Controles de Rotação (Ajuste Fino de 5°) */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-semibold text-slate-700">Orientação</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={girarAntiHorario}
                        disabled={rotacao <= -90}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-xs font-semibold text-slate-700 transition shadow-2xs cursor-pointer"
                        title="Girar 5° à esquerda"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>-5°</span>
                      </button>
                      <button
                        type="button"
                        onClick={resetarRotacao}
                        className="text-xs font-extrabold text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-200 min-w-[52px] text-center transition cursor-pointer"
                        title="Clique para retornar a 0°"
                      >
                        {rotacao > 0 ? `+${rotacao}°` : `${rotacao}°`}
                      </button>
                      <button
                        type="button"
                        onClick={girarHorario}
                        disabled={rotacao >= 90}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-xs font-semibold text-slate-700 transition shadow-2xs cursor-pointer"
                        title="Girar 5° à direita"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        <span>+5°</span>
                      </button>
                    </div>
                  </div>

                  {/* ── Recurso: Remover / Restaurar Fundo ── */}
                  <div className="pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-slate-700">Fundo da Imagem</span>
                        <span className="text-[11px] text-slate-400">
                          {fotoSemFundo ? 'Fundo transparente ativo' : 'Remoção automática inteligente'}
                        </span>
                      </div>

                      {fotoSemFundo ? (
                        <button
                          type="button"
                          onClick={handleRestaurarFundo}
                          disabled={processandoFundo}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition shadow-2xs cursor-pointer"
                          title="Restaurar fundo original da foto"
                        >
                          <Undo2 className="w-3.5 h-3.5 text-slate-500" />
                          <span>Restaurar fundo</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleRemoverFundo}
                          disabled={processandoFundo}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-50 hover:bg-teal-100 border border-teal-300/80 text-teal-800 disabled:opacity-60 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
                          title="Remover fundo da foto mantendo o membro"
                        >
                          {processandoFundo ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 text-teal-700 animate-spin" />
                              <span>Removendo fundo...</span>
                            </>
                          ) : (
                            <>
                              <Wand2 className="w-3.5 h-3.5 text-teal-700" />
                              <span>Remover fundo</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Mensagem amigável de erro caso o processamento falhe */}
                    {erroFundo && (
                      <div className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] leading-relaxed">
                        {erroFundo}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── 4. Seção: Traje Ministerial ── */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                        Traje Ministerial
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Escolha uma composição institucional para sobrepor à fotografia
                      </p>
                    </div>
                  </div>

                  {/* Grid de Opções de Trajes */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {TRAJES_MINISTERIAIS_PRESET.map((traje) => {
                      const isSelected = trajeSelecionado === traje.id;
                      return (
                        <button
                          key={traje.id}
                          type="button"
                          onClick={() => {
                            if (isSelected && traje.id !== 'nenhum') {
                              setTrajeSelecionado('nenhum');
                            } else {
                              setTrajeSelecionado(traje.id);
                            }
                          }}
                          className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-center transition-all cursor-pointer relative ${
                            isSelected
                              ? 'bg-teal-50/80 border-teal-600 text-teal-900 shadow-xs ring-2 ring-teal-600/20'
                              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 shadow-2xs'
                          }`}
                        >
                          {/* Miniatura visual real do respectivo PNG */}
                          <div
                            className={`w-14 h-14 rounded-xl mb-2 flex items-center justify-center border overflow-hidden transition-all ${
                              isSelected ? 'border-teal-500 shadow-2xs' : 'border-slate-200'
                            }`}
                            style={{
                              backgroundColor: traje.id === 'nenhum' ? '#f1f5f9' : '#f8fafc',
                            }}
                          >
                            {traje.preview ? (
                              <img
                                src={traje.preview}
                                alt={traje.nome}
                                className="w-full h-full object-contain p-1 pointer-events-none"
                              />
                            ) : (
                              <User className="w-6 h-6 text-slate-400" />
                            )}
                          </div>

                          <span className="text-xs font-bold leading-tight">
                            {traje.nome}
                          </span>

                          {isSelected && (
                            <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-teal-600 text-white rounded-full flex items-center justify-center text-[10px] shadow-xs">
                              ✓
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* ── Controles de Tamanho e Posição do Traje (quando ativo) ── */}
                  {trajeSelecionado !== 'nenhum' && (
                    <div className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200/90 space-y-3.5 mt-2">
                      {/* Tamanho do traje */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                            <Move className="w-3.5 h-3.5 text-purple-600" />
                            Tamanho do traje
                          </span>
                          <span className="font-extrabold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                            {Math.round(trajeEscala * 100)}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() =>
                              setTrajeEscala((prev) =>
                                Math.max(0.6, parseFloat((prev - 0.05).toFixed(2)))
                              )
                            }
                            className="p-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 transition shadow-2xs"
                            title="Diminuir tamanho do traje"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="range"
                            min="0.6"
                            max="1.6"
                            step="0.02"
                            value={trajeEscala}
                            onChange={(e) => setTrajeEscala(parseFloat(e.target.value))}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setTrajeEscala((prev) =>
                                Math.min(1.6, parseFloat((prev + 0.05).toFixed(2)))
                              )
                            }
                            className="p-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 transition shadow-2xs"
                            title="Aumentar tamanho do traje"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Posição do traje */}
                      <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="text-xs font-semibold text-slate-700 block">
                            Posição do traje
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Ajuste fino ou arraste no preview
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setTrajePosX((prev) => Math.max(-120, prev - 4))}
                            className="p-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition shadow-2xs cursor-pointer"
                            title="Mover traje para a esquerda"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setTrajePosY((prev) => Math.max(-120, prev - 4))}
                            className="p-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition shadow-2xs cursor-pointer"
                            title="Mover traje para cima"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setTrajePosY((prev) => Math.min(120, prev + 4))}
                            className="p-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition shadow-2xs cursor-pointer"
                            title="Mover traje para baixo"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setTrajePosX((prev) => Math.min(120, prev + 4))}
                            className="p-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition shadow-2xs cursor-pointer"
                            title="Mover traje para a direita"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Ação clara de Remoção de Traje */}
                      <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                        <button
                          type="button"
                          onClick={() => {
                            setTrajeEscala(1.0);
                            setTrajePosX(0);
                            setTrajePosY(0);
                          }}
                          className="text-[11px] font-semibold text-purple-700 hover:underline cursor-pointer"
                        >
                          Restaurar posição padrão do traje
                        </button>
                        <button
                          type="button"
                          onClick={() => setTrajeSelecionado('nenhum')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-600 hover:text-slate-800 text-xs font-semibold transition cursor-pointer shadow-2xs"
                          title="Remover traje ministerial aplicado"
                        >
                          <span className="text-slate-400 text-sm leading-none">✕</span>
                          <span>Remover traje</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Aviso informativo de preservação */}
                <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-200/80 text-[11px] text-teal-900 font-medium flex items-center gap-2">
                  <Check className="w-4 h-4 text-teal-700 shrink-0" />
                  <span>
                    <strong>Fotografia original protegida:</strong> O arquivo original é mantido intacto e a composição 3x4 é gerada em camada separada.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
