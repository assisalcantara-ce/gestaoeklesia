'use client';

import { useEffect, useRef, useState } from 'react';

interface RichTextEditorProps {
    initialValue: string;
    onChange: (html: string) => void;
    placeholder?: string;
    // Props para controle externo (Elemento Cartão)
    bold?: boolean;
    onToggleBold?: () => void;
    italic?: boolean;
    onToggleItalic?: () => void;
    underline?: boolean;
    onToggleUnderline?: () => void;
    shadow?: boolean;
    onToggleShadow?: () => void;
    align?: 'left' | 'center' | 'right';
    onSetAlign?: (align: 'left' | 'center' | 'right') => void;
    color?: string;
    onSetColor?: (color: string) => void;
}

export function RichTextEditor({
    initialValue,
    onChange,
    placeholder,
    bold, onToggleBold,
    italic, onToggleItalic,
    underline, onToggleUnderline,
    shadow, onToggleShadow,
    align, onSetAlign,
    color, onSetColor
}: RichTextEditorProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const [isMounted, setIsMounted] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [colorPickerPos, setColorPickerPos] = useState({ top: 0, left: 0 });
    const colorButtonRef = useRef<HTMLDivElement>(null);
    const savedSelection = useRef<Range | null>(null);

    const saveSelection = () => {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            savedSelection.current = sel.getRangeAt(0);
        } else {
            savedSelection.current = null;
        }
    };

    const restoreSelection = () => {
        const sel = window.getSelection();
        if (sel && savedSelection.current) {
            sel.removeAllRanges();
            sel.addRange(savedSelection.current);
        }
    };

    // States for active functionality feedback could be added here if needed,
    // but execCommand doesn't always report state reliably without extra listeners.
    // For now, we focus on the visual "professional" look.

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (isMounted && editorRef.current) {
            if (editorRef.current.innerHTML !== initialValue) {
                editorRef.current.innerHTML = initialValue;
            }
        }
    }, [isMounted, initialValue]);

    const handleInput = () => {
        if (editorRef.current) {
            const html = editorRef.current.innerHTML;
            onChange(html);
        }
    };

    const execCommand = (command: string, value: string | undefined = undefined) => {
        document.execCommand(command, false, value);
        handleInput();
        if (editorRef.current) {
            editorRef.current.focus();
        }
    };

    if (!isMounted) return null;

    const ToolbarButton = ({ onClick, icon, title, isActive = false }: any) => (
        <button
            onClick={onClick}
            className={`p-1 rounded transition-colors duration-200 flex items-center justify-center w-7 h-7 
                ${isActive ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
            title={title}
            type="button"
        >
            {icon}
        </button>
    );

    return (
        <div className="border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm transition-all hover:border-blue-400 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
            {/* Toolbar */}
            <div className="flex flex-nowrap items-center gap-0.5 p-1.5 bg-gray-50 border-b border-gray-200 overflow-x-auto">
                {/* Estilo Básico */}
                <ToolbarButton
                    onClick={() => onToggleBold ? onToggleBold() : execCommand('bold')}
                    title="Negrito"
                    isActive={bold}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 12a4 4 0 0 0 0-8H6v8" /><path d="M15 20a4 4 0 0 0 0-8H6v8Z" /></svg>}
                />
                <ToolbarButton
                    onClick={() => onToggleItalic ? onToggleItalic() : execCommand('italic')}
                    title="Itálico"
                    isActive={italic}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="4" x2="10" y2="4" /><line x1="14" y1="20" x2="5" y2="20" /><line x1="15" y1="4" x2="9" y2="20" /></svg>}
                />
                <ToolbarButton
                    onClick={() => onToggleUnderline ? onToggleUnderline() : execCommand('underline')}
                    title="Sublinhado"
                    isActive={underline}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3" /><line x1="4" y1="21" x2="20" y2="21" /></svg>}
                />
                <ToolbarButton
                    onClick={() => onToggleShadow ? onToggleShadow() : undefined}
                    title="Sombreado"
                    isActive={shadow}
                    icon={<span style={{ fontWeight: 'bold', fontFamily: 'serif', textShadow: '2px 2px 2px rgba(0,0,0,0.4)' }}>S</span>}
                />


                <div className="w-px h-4 bg-gray-300 mx-1" />

                {/* Alinhamento */}
                <ToolbarButton
                    onClick={() => onSetAlign ? onSetAlign('left') : execCommand('justifyLeft')}
                    title="Alinhar à Esquerda"
                    isActive={align === 'left'}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="6" x2="3" y2="6" /><line x1="15" y1="12" x2="3" y2="12" /><line x1="17" y1="18" x2="3" y2="18" /></svg>}
                />
                <ToolbarButton
                    onClick={() => onSetAlign ? onSetAlign('center') : execCommand('justifyCenter')}
                    title="Centralizar"
                    isActive={align === 'center'}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="6" x2="3" y2="6" /><line x1="19" y1="12" x2="5" y2="12" /><line x1="21" y1="18" x2="3" y2="18" /></svg>}
                />
                <ToolbarButton
                    onClick={() => onSetAlign ? onSetAlign('right') : execCommand('justifyRight')}
                    title="Alinhar à Direita"
                    isActive={align === 'right'}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="12" x2="9" y2="12" /><line x1="21" y1="18" x2="7" y2="18" /></svg>}
                />

                <div className="w-px h-4 bg-gray-300 mx-1" />

                {/* Cor */}
                <div className="relative" ref={colorButtonRef}>
                    <ToolbarButton
                        onClick={() => {
                            saveSelection();
                            if (colorButtonRef.current) {
                                const rect = colorButtonRef.current.getBoundingClientRect();
                                // Aproximadamente 200px (192px do w-48 + padding/bordas)
                                const paletteWidth = 200;
                                let leftPos = rect.left;

                                // Se for estourar a tela à direita, alinha pela direita do botão
                                if (rect.left + paletteWidth > window.innerWidth) {
                                    leftPos = rect.right - paletteWidth;
                                }

                                setColorPickerPos({ top: rect.bottom + 5, left: leftPos });
                            }
                            setShowColorPicker(!showColorPicker);
                        }}
                        title="Cor do Texto"
                        isActive={showColorPicker}
                        icon={
                            <div className="flex flex-col items-center justify-center">
                                <span className="font-serif font-bold text-xs leading-none">A</span>
                                <div className="w-3 h-0.5 mt-0.5 rounded-full" style={{ backgroundColor: color || '#000000' }} />
                            </div>
                        }
                    />

                    {showColorPicker && (
                        <>
                            <div
                                className="fixed inset-0 z-[100]"
                                onClick={() => setShowColorPicker(false)}
                            />
                            <div
                                className="fixed z-[101] p-3 bg-white border border-gray-200 shadow-xl rounded-lg w-48 animate-in fade-in zoom-in duration-200"
                                style={{ top: colorPickerPos.top, left: colorPickerPos.left }}
                            >
                                <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Cores Básicas</div>
                                <div className="grid grid-cols-5 gap-2">
                                    {['#000000', '#444444', '#888888', '#cccccc', '#ffffff',
                                        '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
                                        '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#f43f5e'].map(color => (
                                            <button
                                                key={color}
                                                onClick={() => {
                                                    restoreSelection();
                                                    const sel = window.getSelection();
                                                    const hasSelection = sel && !sel.isCollapsed && editorRef.current?.contains(sel.anchorNode);

                                                    // Se houver seleção DENTRO do editor, aplica no texto
                                                    // Se não houver seleção, aplica no elemento inteiro (cor base)
                                                    if (hasSelection) {
                                                        execCommand('foreColor', color);
                                                    } else if (onSetColor) {
                                                        onSetColor(color);
                                                    }

                                                    setShowColorPicker(false);
                                                }}
                                                className="w-6 h-6 rounded-md hover:scale-110 transition border border-gray-200 shadow-sm"
                                                style={{ backgroundColor: color }}
                                                title={color}
                                            />
                                        ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Editor Area */}
            <div
                ref={editorRef}
                contentEditable
                onInput={handleInput}
                className="p-3 min-h-[100px] max-h-[180px] overflow-y-auto outline-none text-sm text-gray-800"
                style={{
                    fontFamily: 'inherit',
                    lineHeight: '1.5'
                }}
            />
            {placeholder && !initialValue && (
                <div className="absolute top-[46px] left-4 text-gray-400 text-sm pointer-events-none select-none">
                    {placeholder}
                </div>
            )}
        </div>
    );
}
