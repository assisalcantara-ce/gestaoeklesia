'use client';

import { useState, useRef, useEffect } from 'react';
import { obterPreviewTexto } from '@/lib/cartoes-utils';
import { createClient } from '@/lib/supabase-client';
import { fetchConfiguracaoIgrejaFromSupabase } from '@/lib/igreja-config-utils';

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
    imagemUrl?: string;
    foto?: string; // URL da foto do membro (base64)
    visivel: boolean;
}

interface InteractiveCanvasProps {
    elementos: ElementoCartao[];
    elementoSelecionado: ElementoCartao | null;
    elementosSelecionados: ElementoCartao[];
    nomenclaturas?: any;
    getPreviewText?: (text: string) => string;
    backgroundUrl?: string;
    onElementoSelecionado: (elemento: ElementoCartao | null) => void;
    onElementosSelecionados: (elementos: ElementoCartao[]) => void;
    onElementoAtualizado: (elementoId: string, propriedades: Partial<ElementoCartao>) => void;
    onMultiplosElementosAtualizados?: (atualizacoes: Array<{ id: string; propriedades: Partial<ElementoCartao> }>) => void;
    onElementosAdicionados?: (novoElementos: ElementoCartao[]) => void;
    onElementoRemovido?: (elementoId: string) => void;
    larguraCanvas?: number;
    alturaCanvas?: number;
}

export default function InteractiveCanvas({
    elementos = [],
    elementoSelecionado,
    elementosSelecionados = [],
    nomenclaturas,
    getPreviewText,
    backgroundUrl,
    onElementoSelecionado,
    onElementosSelecionados,
    onElementoAtualizado,
    onMultiplosElementosAtualizados,
    onElementosAdicionados,
    onElementoRemovido,
    larguraCanvas = 465,
    alturaCanvas = 291
}: InteractiveCanvasProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [configIgreja, setConfigIgreja] = useState<any>(null);
    const [clipboard, setClipboard] = useState<ElementoCartao[]>([]);

    useEffect(() => {
        const supabase = createClient();
        fetchConfiguracaoIgrejaFromSupabase(supabase)
            .then(setConfigIgreja)
            .catch(() => setConfigIgreja(null));
    }, []);

    const [isResizing, setIsResizing] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0, elementX: 0, elementY: 0 });
    const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, elementX: 0, elementY: 0 });
    const [resizeHandle, setResizeHandle] = useState<'tl' | 'tr' | 'bl' | 'br' | null>(null);
    const [multiDragStart, setMultiDragStart] = useState<Map<string, { x: number; y: number }>>(new Map());
    const [isBoxSelecting, setIsBoxSelecting] = useState(false);
    const [boxSelectionStart, setBoxSelectionStart] = useState({ x: 0, y: 0 });
    const [boxSelectionEnd, setBoxSelectionEnd] = useState({ x: 0, y: 0 });

    const canvasRef = useRef<HTMLDivElement>(null);

    const handleElementMouseDown = (e: React.MouseEvent, elemento: ElementoCartao) => {
        e.preventDefault();
        e.stopPropagation();

        // Focar canvas para permitir atalhos de teclado
        canvasRef.current?.focus();

        // Ctrl+Click para multi-seleção
        if (e.ctrlKey || e.metaKey) {
            const jaEstaSelecionado = elementosSelecionados.some(el => el.id === elemento.id);

            if (jaEstaSelecionado) {
                // Remove da seleção
                onElementosSelecionados(elementosSelecionados.filter(el => el.id !== elemento.id));
            } else {
                // Adiciona à seleção
                onElementosSelecionados([...elementosSelecionados, elemento]);
            }
            return;
        }

        // Click normal
        const elementoJaEstaSelecionado = elementosSelecionados.some(el => el.id === elemento.id);

        if (elementosSelecionados.length > 1 && elementoJaEstaSelecionado) {
            // Se há múltiplos selecionados e clicou em um deles, iniciar drag de todos
            setIsDragging(true);
            const startPositions = new Map();
            elementosSelecionados.forEach(el => {
                startPositions.set(el.id, { x: el.x, y: el.y });
            });
            setMultiDragStart(startPositions);
            setDragStart({
                x: e.clientX,
                y: e.clientY,
                elementX: 0,
                elementY: 0
            });
        } else {
            // Seleção única
            onElementoSelecionado(elemento);
            onElementosSelecionados([elemento]);
            setIsDragging(true);

            // Definir multiDragStart também para seleção única
            const startPositions = new Map();
            startPositions.set(elemento.id, { x: elemento.x, y: elemento.y });
            setMultiDragStart(startPositions);

            setDragStart({
                x: e.clientX,
                y: e.clientY,
                elementX: elemento.x,
                elementY: elemento.y
            });
        }
    };

    const handleResizeMouseDown = (e: React.MouseEvent, handle: 'tl' | 'tr' | 'bl' | 'br') => {
        e.preventDefault();
        e.stopPropagation();
        if (!elementoSelecionado) return;

        setIsResizing(true);
        setResizeHandle(handle);
        setResizeStart({
            x: e.clientX,
            y: e.clientY,
            width: elementoSelecionado.largura,
            height: elementoSelecionado.altura,
            elementX: elementoSelecionado.x,
            elementY: elementoSelecionado.y
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isBoxSelecting) {
            // Atualizar o retângulo de seleção
            const rect = e.currentTarget.getBoundingClientRect();
            setBoxSelectionEnd({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            });
        } else if (isDragging && elementosSelecionados.length > 0) {
            // Arrastar múltiplos elementos
            const deltaX = e.clientX - dragStart.x;
            const deltaY = e.clientY - dragStart.y;

            if (onMultiplosElementosAtualizados && elementosSelecionados.length > 1) {
                // Atualizar todos de uma vez para evitar condição de corrida
                const atualizacoes = elementosSelecionados.map(elemento => {
                    const startPos = multiDragStart.get(elemento.id);
                    if (startPos) {
                        const novoX = Math.max(0, Math.min(larguraCanvas - elemento.largura, startPos.x + deltaX));
                        const novoY = Math.max(0, Math.min(alturaCanvas - elemento.altura, startPos.y + deltaY));
                        return { id: elemento.id, propriedades: { x: novoX, y: novoY } };
                    }
                    return null;
                }).filter(Boolean) as Array<{ id: string; propriedades: Partial<ElementoCartao> }>;

                onMultiplosElementosAtualizados(atualizacoes);
            } else {
                // Fallback: atualizar um por um
                elementosSelecionados.forEach(elemento => {
                    const startPos = multiDragStart.get(elemento.id);
                    if (startPos) {
                        const novoX = Math.max(0, Math.min(larguraCanvas - elemento.largura, startPos.x + deltaX));
                        const novoY = Math.max(0, Math.min(alturaCanvas - elemento.altura, startPos.y + deltaY));
                        onElementoAtualizado(elemento.id, { x: novoX, y: novoY });
                    }
                });
            }
        } else if (isResizing && elementoSelecionado && resizeHandle) {
            const deltaX = e.clientX - resizeStart.x;
            const deltaY = e.clientY - resizeStart.y;

            let novaLargura = resizeStart.width;
            let novaAltura = resizeStart.height;
            let novoX = resizeStart.elementX;
            let novoY = resizeStart.elementY;

            if (resizeHandle === 'br') {
                novaLargura = Math.max(20, resizeStart.width + deltaX);
                novaAltura = Math.max(20, resizeStart.height + deltaY);
            } else if (resizeHandle === 'bl') {
                novaLargura = Math.max(20, resizeStart.width - deltaX);
                novaAltura = Math.max(20, resizeStart.height + deltaY);
                novoX = resizeStart.elementX + (resizeStart.width - novaLargura);
            } else if (resizeHandle === 'tr') {
                novaLargura = Math.max(20, resizeStart.width + deltaX);
                novaAltura = Math.max(20, resizeStart.height - deltaY);
                novoY = resizeStart.elementY + (resizeStart.height - novaAltura);
            } else if (resizeHandle === 'tl') {
                novaLargura = Math.max(20, resizeStart.width - deltaX);
                novaAltura = Math.max(20, resizeStart.height - deltaY);
                novoX = resizeStart.elementX + (resizeStart.width - novaLargura);
                novoY = resizeStart.elementY + (resizeStart.height - novaAltura);
            }

            onElementoAtualizado(elementoSelecionado.id, {
                x: Math.max(0, novoX),
                y: Math.max(0, novoY),
                largura: novaLargura,
                altura: novaAltura
            });
        }
    };

    const handleMouseUp = () => {
        if (isBoxSelecting) {
            // Finalizar seleção por área
            const minX = Math.min(boxSelectionStart.x, boxSelectionEnd.x);
            const maxX = Math.max(boxSelectionStart.x, boxSelectionEnd.x);
            const minY = Math.min(boxSelectionStart.y, boxSelectionEnd.y);
            const maxY = Math.max(boxSelectionStart.y, boxSelectionEnd.y);

            const elementosDentroDoBox = elementos.filter(elemento => {
                if (!elemento.visivel) return false;
                const elementoCenterX = elemento.x + elemento.largura / 2;
                const elementoCenterY = elemento.y + elemento.altura / 2;
                return elementoCenterX >= minX && elementoCenterX <= maxX &&
                    elementoCenterY >= minY && elementoCenterY <= maxY;
            });

            if (elementosDentroDoBox.length > 0) {
                onElementosSelecionados(elementosDentroDoBox);
                onElementoSelecionado(elementosDentroDoBox[0]);
            }

            setIsBoxSelecting(false);
        }
        setIsDragging(false);
        setIsResizing(false);
        setResizeHandle(null);
    };

    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget && !e.ctrlKey && !e.metaKey) {
            // Iniciar seleção por área
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            setBoxSelectionStart({ x, y });
            setBoxSelectionEnd({ x, y });
            setIsBoxSelecting(true);
            onElementoSelecionado(null);
            onElementosSelecionados([]);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Copiar: Ctrl+C ou Cmd+C
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            if (elementosSelecionados.length > 0) {
                e.preventDefault();
                setClipboard(elementosSelecionados);
                console.log(`📋 ${elementosSelecionados.length} elemento(s) copiado(s)`);
            }
            return;
        }

        // Colar: Ctrl+V ou Cmd+V
        if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
            if (clipboard.length > 0 && onElementosAdicionados) {
                e.preventDefault();
                
                // Criar cópias dos elementos com IDs novos e offset de posição
                const offset = 15;
                const elementosCopias: ElementoCartao[] = clipboard.map(el => ({
                    ...JSON.parse(JSON.stringify(el)), // Deep clone
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                    x: Math.min(el.x + offset, larguraCanvas - el.largura),
                    y: Math.min(el.y + offset, alturaCanvas - el.altura)
                }));

                onElementosAdicionados(elementosCopias);
                onElementosSelecionados(elementosCopias);
                console.log(`📌 ${elementosCopias.length} elemento(s) colado(s)`);
            }
            return;
        }

        // Deletar: Delete ou Backspace
        if ((e.key === 'Delete' || e.key === 'Backspace') && elementosSelecionados.length > 0) {
            e.preventDefault();
            elementosSelecionados.forEach(el => {
                if (onElementoRemovido) {
                    onElementoRemovido(el.id);
                }
            });
            return;
        }

        // Mover elementos selecionados com setas do teclado
        if (!elementoSelecionado && elementosSelecionados.length === 0) return;

        const arrows = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
        if (!arrows.includes(e.key)) return;

        e.preventDefault();

        // Shift + Seta = movimento de 10px (rápido)
        // Seta sozinha = movimento de 1px (preciso)
        const step = e.shiftKey ? 10 : 1;

        let deltaX = 0;
        let deltaY = 0;

        switch (e.key) {
            case 'ArrowUp':
                deltaY = -step;
                break;
            case 'ArrowDown':
                deltaY = step;
                break;
            case 'ArrowLeft':
                deltaX = -step;
                break;
            case 'ArrowRight':
                deltaX = step;
                break;
        }

        // Atualizar posição dos elementos selecionados
        if (onMultiplosElementosAtualizados && elementosSelecionados.length > 0) {
            const atualizacoes = elementosSelecionados.map(elemento => {
                const novoX = Math.max(0, Math.min(larguraCanvas - elemento.largura, elemento.x + deltaX));
                const novoY = Math.max(0, Math.min(alturaCanvas - elemento.altura, elemento.y + deltaY));
                return { id: elemento.id, propriedades: { x: novoX, y: novoY } };
            });
            onMultiplosElementosAtualizados(atualizacoes);
        }
    };

    const renderElemento = (elemento: ElementoCartao) => {
        const isSelected = elementoSelecionado?.id === elemento.id;
        const isInSelection = elementosSelecionados.some(el => el.id === elemento.id);
        const baseStyle: React.CSSProperties = {
            position: 'absolute',
            left: `${elemento.x}px`,
            top: `${elemento.y}px`,
            width: `${elemento.largura}px`,
            height: `${elemento.altura}px`,
            cursor: isDragging ? 'grabbing' : 'grab',
            border: isSelected ? '2px solid #3b82f6' : isInSelection ? '2px solid #60a5fa' : '1px dashed rgba(0,0,0,0.2)',
            outline: isInSelection && !isSelected ? '1px solid #93c5fd' : 'none',
            outlineOffset: '2px',
            boxSizing: 'border-box',
            userSelect: 'none'
        };

        let conteudo: React.ReactNode = null;

        switch (elemento.tipo) {
            case 'texto':
                conteudo = (

                    <div
                        style={{
                            width: '100%',
                            height: '100%',
                            backgroundColor: elemento.backgroundColor || 'transparent',
                            borderRadius: `${elemento.borderRadius || 0}px`,
                            padding: elemento.backgroundColor ? '0 10px' : '0',
                            boxSizing: 'border-box',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center', // Centralização vertical padrão
                        }}
                    >
                        <div
                            style={{
                                width: '100%',
                                fontSize: `${elemento.fontSize || 12}px`,
                                fontFamily: elemento.fonte || 'Arial',
                                fontWeight: elemento.negrito ? 'bold' : 'normal',
                                fontStyle: elemento.italico ? 'italic' : 'normal',
                                textDecoration: elemento.sublinhado ? 'underline' : 'none',
                                textShadow: elemento.sombreado ? '2px 2px 2px rgba(0,0,0,0.5)' : 'none',
                                color: elemento.cor || '#000',
                                textAlign: elemento.alinhamento || 'left',
                                lineHeight: '1.2',
                                wordBreak: 'break-word',
                                display: 'block' // Fluxo de texto normal
                            }}
                            dangerouslySetInnerHTML={{ __html: (getPreviewText ? getPreviewText(elemento.texto || 'Texto') : obterPreviewTexto(elemento.texto || 'Texto', nomenclaturas)) || 'Texto' }}
                        />
                    </div>
                );

                break;

            case 'qrcode':
                // Gerar QR code dinamicamente (placeholder por enquanto no editor)
                conteudo = (
                    <div
                        style={{
                            width: '100%',
                            height: '100%',
                            backgroundColor: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '10px',
                            color: '#666',
                            border: '1px solid #ddd'
                        }}
                    >
                        📱 QR Code
                    </div>
                );
                break;

            case 'logo':
                const logoUrl = configIgreja?.logo || elemento.imagemUrl;

                conteudo = logoUrl ? (
                    <img
                        src={logoUrl}
                        alt="Logo da Igreja"
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            opacity: elemento.transparencia || 1
                        }}
                    />
                ) : (
                    <div
                        style={{
                            width: '100%',
                            height: '100%',
                            backgroundColor: 'rgba(200,200,200,0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '10px',
                            color: '#666',
                            opacity: elemento.transparencia || 1
                        }}
                    >
                        🏛️ Logo
                    </div>
                );
                break;

            case 'foto-membro':
                // Renderizar foto do membro se disponível
                const fotoUrl = elemento.foto || elemento.imagemUrl;

                conteudo = fotoUrl ? (
                    <img
                        src={fotoUrl}
                        alt="Foto do Membro"
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            borderRadius: '4px'
                        }}
                    />
                ) : (
                    <div
                        style={{
                            width: '100%',
                            height: '100%',
                            backgroundColor: 'rgba(200,200,200,0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '10px',
                            color: '#666'
                        }}
                    >
                        📸 Foto
                    </div>
                );
                break;

            case 'imagem':
                conteudo = elemento.imagemUrl ? (
                    <img
                        src={elemento.imagemUrl}
                        alt="Imagem"
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            opacity: elemento.transparencia || 1
                        }}
                    />
                ) : (
                    <div
                        style={{
                            width: '100%',
                            height: '100%',
                            backgroundColor: 'rgba(200,200,200,0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '10px',
                            color: '#666',
                            opacity: elemento.transparencia || 1
                        }}
                    >
                        🖼️ Imagem
                    </div>
                );
                break;

            case 'chapa':
                conteudo = (
                    <div
                        style={{
                            width: '100%',
                            height: '100%',
                            backgroundColor: elemento.cor || '#ff0000',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontWeight: 'bold',
                            fontSize: '12px',
                            borderRadius: `${elemento.borderRadius || 0}px`,
                            opacity: elemento.transparencia || 1
                        }}
                    >
                        {elemento.texto || 'CHAPA'}
                    </div>
                );
                break;
        }

        return (
            <div
                key={elemento.id}
                style={baseStyle}
                onMouseDown={(e) => handleElementMouseDown(e, elemento)}
            >
                {conteudo}

                {/* Handles de redimensionamento */}
                {isSelected && (
                    <>
                        {/* Top-left */}
                        <div
                            onMouseDown={(e) => handleResizeMouseDown(e, 'tl')}
                            style={{
                                position: 'absolute',
                                left: '-4px',
                                top: '-4px',
                                width: '8px',
                                height: '8px',
                                backgroundColor: '#3b82f6',
                                border: '1px solid #fff',
                                cursor: 'nwse-resize',
                                zIndex: 10
                            }}
                        />
                        {/* Top-right */}
                        <div
                            onMouseDown={(e) => handleResizeMouseDown(e, 'tr')}
                            style={{
                                position: 'absolute',
                                right: '-4px',
                                top: '-4px',
                                width: '8px',
                                height: '8px',
                                backgroundColor: '#3b82f6',
                                border: '1px solid #fff',
                                cursor: 'nesw-resize',
                                zIndex: 10
                            }}
                        />
                        {/* Bottom-left */}
                        <div
                            onMouseDown={(e) => handleResizeMouseDown(e, 'bl')}
                            style={{
                                position: 'absolute',
                                left: '-4px',
                                bottom: '-4px',
                                width: '8px',
                                height: '8px',
                                backgroundColor: '#3b82f6',
                                border: '1px solid #fff',
                                cursor: 'nesw-resize',
                                zIndex: 10
                            }}
                        />
                        {/* Bottom-right */}
                        <div
                            onMouseDown={(e) => handleResizeMouseDown(e, 'br')}
                            style={{
                                position: 'absolute',
                                right: '-4px',
                                bottom: '-4px',
                                width: '8px',
                                height: '8px',
                                backgroundColor: '#3b82f6',
                                border: '1px solid #fff',
                                cursor: 'nwse-resize',
                                zIndex: 10
                            }}
                        />
                    </>
                )}
            </div>
        );
    };

    return (
        <div
            ref={canvasRef}
            tabIndex={0}
            style={{
                position: 'relative',
                width: `${larguraCanvas}px`,
                height: `${alturaCanvas}px`,
                backgroundColor: '#fff',
                backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                border: '1px solid #d1d5db',
                overflow: 'hidden',
                cursor: isDragging || isResizing ? 'default' : 'auto',
                outline: 'none'
            }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onMouseDown={handleCanvasMouseDown}
            onKeyDown={handleKeyDown}
            onClick={(e) => {
                if (e.target === e.currentTarget && !isBoxSelecting) {
                    onElementoSelecionado(null);
                    onElementosSelecionados([]);
                }
            }}
        >
            {elementos.filter(e => e.visivel).map(elemento => renderElemento(elemento))}

            {/* Box de seleção por área */}
            {isBoxSelecting && (
                <div
                    style={{
                        position: 'absolute',
                        left: `${Math.min(boxSelectionStart.x, boxSelectionEnd.x)}px`,
                        top: `${Math.min(boxSelectionStart.y, boxSelectionEnd.y)}px`,
                        width: `${Math.abs(boxSelectionEnd.x - boxSelectionStart.x)}px`,
                        height: `${Math.abs(boxSelectionEnd.y - boxSelectionStart.y)}px`,
                        border: '2px dashed #3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        pointerEvents: 'none',
                        zIndex: 1000
                    }}
                />
            )}
        </div>
    );
}
