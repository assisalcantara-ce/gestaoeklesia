'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageLayout from '@/components/PageLayout';
import Section from '@/components/Section';
import NotificationModal from '@/components/NotificationModal';
import InteractiveCanvas from '@/components/InteractiveCanvas';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { useUserContext } from '@/hooks/useUserContext';
import { createClient } from '@/lib/supabase-client';
import type {
  TemplateCategoria,
  TemplateTipo,
  CartaCanvasElement,
  CartaCanvasData,
  CartaTemplate,
} from '@/types/supabase';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpToLine,
  Bold,
  ChevronDown,
  ChevronUp,
  Copy,
  Eraser,
  FileText,
  Image,
  Italic,
  Lock,
  Minus,
  Paintbrush,
  Plus,
  RotateCcw,
  Save,
  Shield,
  Square,
  Trash2,
  Type,
  Underline,
  Unlock,
  Upload,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';
import {
  CANVAS_A4,
  CANVAS_FONTES,
  CANVAS_ELEMENT_LABELS,
  PLACEHOLDER_GROUPS,
  createElementId,
  createDefaultCanvas,
  normalizeTemplateKey,
  parseTemplateToCanvas,
  serializeCanvasContent,
  getCanvasPreviewText,
} from '@/lib/cartas-constants';
import {
  DEFAULT_SYSTEM_TEMPLATES,
  loadCartasTemplatesFromSupabase,
} from '@/lib/cartas-templates-padrao';
import {
  buildCartaTemplateExportJson,
  formatCartaTemplateJson,
  copyTextToClipboard,
} from '@/lib/cartas-export-json';

export default function ConfiguracoesCartasPage() {
  const { loading: authLoading } = useRequireSupabaseAuth();
  const { ctx: moduloCtx, bloqueado } = useRequireModulo('configuracoes');
  const userCtx = useUserContext();
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [notification, setNotification] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    autoClose?: number;
  }>({ isOpen: false, title: '', message: '', type: 'success' });

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    variant: 'danger',
    onConfirm: () => {},
  });

  // Proteção de acesso: apenas perfil MASTER
  useEffect(() => {
    if (!userCtx.loading && !userCtx.isMaster) {
      router.replace('/acesso-negado');
    }
  }, [userCtx.loading, userCtx.isMaster, router]);

  const canvasImageInputRef = useRef<HTMLInputElement>(null);
  const canvasBackgroundInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const [templates, setTemplates] = useState<CartaTemplate[]>([]);
  const [systemTemplates, setSystemTemplates] = useState<Record<string, CartaTemplate>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<CartaTemplate | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftKey, setDraftKey] = useState('');
  const [draftTipo, setDraftTipo] = useState<TemplateTipo>('custom');
  const [draftCategoria, setDraftCategoria] = useState<TemplateCategoria>('carta');
  const [isDraftReady, setIsDraftReady] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'elementos' | 'variaveis' | 'camadas'>('elementos');
  const lastSavedSnapshotRef = useRef<string>('');
  const [canvasContent, setCanvasContent] = useState<CartaCanvasData>(() => createDefaultCanvas());
  const [categoriaFilter, setCategoriaFilter] = useState<'todas' | 'carta' | 'declaracao'>('todas');
  const [selectedCanvasElement, setSelectedCanvasElement] = useState<CartaCanvasElement | null>(null);
  const [selectedCanvasElements, setSelectedCanvasElements] = useState<CartaCanvasElement[]>([]);
  const [canvasImageTargetId, setCanvasImageTargetId] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  // Escala e zoom do canvas
  const [editorZoomMode, setEditorZoomMode] = useState<'auto' | '100%' | '75%' | '50%'>('auto');
  const [editorScale, setEditorScale] = useState(0.85);

  // Histórico de Undo / Redo
  const [history, setHistory] = useState<CartaCanvasData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isInternalHistoryUpdateRef = useRef(false);

  const isDirty = useMemo(() => {
    if (!lastSavedSnapshotRef.current) return false;
    const current = JSON.stringify({
      title: draftTitle,
      canvas: canvasContent,
    });
    return current !== lastSavedSnapshotRef.current;
  }, [draftTitle, canvasContent]);

  const loadTemplates = useCallback(async () => {
    try {
      const { templates: list, systemMap } = await loadCartasTemplatesFromSupabase(supabase);
      setTemplates(list);
      setSystemTemplates(systemMap);

      if (list.length > 0) {
        setSelectedTemplate((prev) => {
          if (!prev) return list[0];
          const matched = list.find((t) => t.id === prev.id || t.template_key === prev.template_key);
          return matched || list[0];
        });
      }
    } catch (err: any) {
      setNotification({
        isOpen: true,
        title: 'Erro',
        message: err?.message || 'Erro ao carregar templates',
        type: 'error',
      });
    }
  }, [supabase]);

  useEffect(() => {
    if (!authLoading && !moduloCtx.loading && !bloqueado && userCtx.isMaster) {
      loadTemplates();
    }
  }, [authLoading, moduloCtx.loading, bloqueado, userCtx.isMaster, loadTemplates]);

  // Carrega conteúdo no canvas ao selecionar template
  useEffect(() => {
    if (!selectedTemplate) return;
    const canvasData = parseTemplateToCanvas(selectedTemplate.content_json);
    setCanvasContent(canvasData);
    setDraftTitle(selectedTemplate.title);
    setDraftKey(selectedTemplate.template_key);
    setDraftTipo(selectedTemplate.tipo || 'custom');
    setDraftCategoria(selectedTemplate.categoria || 'carta');
    setIsDraftReady(true);
    setSelectedCanvasElement(null);
    setSelectedCanvasElements([]);
    setHistory([canvasData]);
    setHistoryIndex(0);

    lastSavedSnapshotRef.current = JSON.stringify({
      title: selectedTemplate.title,
      canvas: canvasData,
    });
  }, [selectedTemplate]);

  // Atualização de escala
  useEffect(() => {
    const updateScale = () => {
      if (editorZoomMode === '100%') {
        setEditorScale(1);
        return;
      }
      if (editorZoomMode === '75%') {
        setEditorScale(0.75);
        return;
      }
      if (editorZoomMode === '50%') {
        setEditorScale(0.5);
        return;
      }

      const container = canvasContainerRef.current;
      if (!container) return;
      const availableW = container.clientWidth - 32;
      if (availableW <= 0) return;
      const targetScale = Math.min(1, Math.max(0.35, availableW / CANVAS_A4.width));
      setEditorScale(Number(targetScale.toFixed(3)));
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [editorZoomMode]);

  // Histórico para Undo / Redo
  const pushToHistory = useCallback((newCanvas: CartaCanvasData) => {
    if (isInternalHistoryUpdateRef.current) {
      isInternalHistoryUpdateRef.current = false;
      return;
    }
    setHistory((prev) => {
      const upToNow = prev.slice(0, historyIndex + 1);
      const next = [...upToNow, newCanvas];
      if (next.length > 30) next.shift();
      return next;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 29));
  }, [historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      isInternalHistoryUpdateRef.current = true;
      const prevCanvas = history[historyIndex - 1];
      setHistoryIndex((prev) => prev - 1);
      setCanvasContent(prevCanvas);
      if (selectedCanvasElement) {
        const found = prevCanvas.elements.find((el) => el.id === selectedCanvasElement.id);
        setSelectedCanvasElement(found || null);
      }
    }
  }, [historyIndex, history, selectedCanvasElement]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isInternalHistoryUpdateRef.current = true;
      const nextCanvas = history[historyIndex + 1];
      setHistoryIndex((prev) => prev + 1);
      setCanvasContent(nextCanvas);
      if (selectedCanvasElement) {
        const found = nextCanvas.elements.find((el) => el.id === selectedCanvasElement.id);
        setSelectedCanvasElement(found || null);
      }
    }
  }, [historyIndex, history, selectedCanvasElement]);

  const updateCanvasElement = useCallback(
    (id: string, patch: Partial<CartaCanvasElement>) => {
      setCanvasContent((prev) => {
        const nextElements = prev.elements.map((el) => {
          if (el.id !== id) return el;
          return { ...el, ...patch };
        });
        const updatedCanvas = { ...prev, elements: nextElements };
        pushToHistory(updatedCanvas);
        return updatedCanvas;
      });

      setSelectedCanvasElement((prev) => {
        if (!prev || prev.id !== id) return prev;
        return { ...prev, ...patch };
      });
    },
    [pushToHistory]
  );

  const updateMultipleCanvasElements = useCallback(
    (updates: Array<{ id: string; propriedades?: Partial<CartaCanvasElement>; props?: Partial<CartaCanvasElement> }>) => {
      setCanvasContent((prev) => {
        const updateMap = new Map(updates.map((u) => [u.id, u.propriedades || u.props || {}]));
        const nextElements = prev.elements.map((el) => {
          const patch = updateMap.get(el.id);
          return patch ? { ...el, ...patch } : el;
        });
        const updatedCanvas = { ...prev, elements: nextElements };
        pushToHistory(updatedCanvas);
        return updatedCanvas;
      });
    },
    [pushToHistory]
  );

  const addCanvasElements = useCallback(
    (elements: CartaCanvasElement[]) => {
      setCanvasContent((prev) => {
        const updatedCanvas = { ...prev, elements: [...prev.elements, ...elements] };
        pushToHistory(updatedCanvas);
        return updatedCanvas;
      });
    },
    [pushToHistory]
  );

  const addCanvasElement = (tipo: CartaCanvasElement['tipo']) => {
    const defaultColor = '#111827';
    const newEl: CartaCanvasElement = {
      id: createElementId(),
      tipo,
      x: 100,
      y: 160 + canvasContent.elements.length * 20,
      largura: tipo === 'linha' ? 600 : tipo === 'forma' ? 300 : tipo === 'qrcode' ? 120 : 400,
      altura: tipo === 'linha' ? 3 : tipo === 'forma' ? 150 : tipo === 'qrcode' ? 120 : 60,
      fontSize: 18,
      fonte: 'Calibri',
      cor: defaultColor,
      backgroundColor: tipo === 'forma' ? '#f3f4f6' : undefined,
      borderColor: tipo === 'forma' ? '#374151' : undefined,
      borderWidth: tipo === 'forma' ? 1 : undefined,
      borderStyle: tipo === 'forma' ? 'solid' : undefined,
      alinhamento: 'left',
      negrito: false,
      italico: false,
      sublinhado: false,
      texto: tipo === 'texto' ? 'Novo Texto' : tipo === 'qrcode' ? '{{qrcode.link}}' : '',
      locked: false,
      visivel: true,
      borderRadius: tipo === 'forma' ? 4 : 0,
      transparencia: 1,
    };

    setCanvasContent((prev) => {
      const next = { ...prev, elements: [...prev.elements, newEl] };
      pushToHistory(next);
      return next;
    });
    setSelectedCanvasElement(newEl);
    setSelectedCanvasElements([newEl]);
  };

  const removeCanvasElement = (id: string) => {
    setCanvasContent((prev) => {
      const next = { ...prev, elements: prev.elements.filter((el) => el.id !== id) };
      pushToHistory(next);
      return next;
    });
    setSelectedCanvasElement(null);
    setSelectedCanvasElements([]);
  };

  const duplicateCanvasElement = (el: CartaCanvasElement) => {
    const clone: CartaCanvasElement = {
      ...el,
      id: createElementId(),
      x: el.x + 16,
      y: el.y + 16,
    };
    setCanvasContent((prev) => {
      const next = { ...prev, elements: [...prev.elements, clone] };
      pushToHistory(next);
      return next;
    });
    setSelectedCanvasElement(clone);
    setSelectedCanvasElements([clone]);
  };

  const toggleCanvasLock = (el: CartaCanvasElement) => {
    updateCanvasElement(el.id, { locked: !el.locked });
  };

  const bringToFront = (id: string) => {
    setCanvasContent((prev) => {
      const el = prev.elements.find((e) => e.id === id);
      if (!el) return prev;
      const next = { ...prev, elements: [...prev.elements.filter((e) => e.id !== id), el] };
      pushToHistory(next);
      return next;
    });
  };

  const sendToBack = (id: string) => {
    setCanvasContent((prev) => {
      const el = prev.elements.find((e) => e.id === id);
      if (!el) return prev;
      const next = { ...prev, elements: [el, ...prev.elements.filter((e) => e.id !== id)] };
      pushToHistory(next);
      return next;
    });
  };

  const moveLayerUp = (id: string) => {
    setCanvasContent((prev) => {
      const idx = prev.elements.findIndex((e) => e.id === id);
      if (idx === -1 || idx === prev.elements.length - 1) return prev;
      const list = [...prev.elements];
      const temp = list[idx];
      list[idx] = list[idx + 1];
      list[idx + 1] = temp;
      const next = { ...prev, elements: list };
      pushToHistory(next);
      return next;
    });
  };

  const moveLayerDown = (id: string) => {
    setCanvasContent((prev) => {
      const idx = prev.elements.findIndex((e) => e.id === id);
      if (idx <= 0) return prev;
      const list = [...prev.elements];
      const temp = list[idx];
      list[idx] = list[idx - 1];
      list[idx - 1] = temp;
      const next = { ...prev, elements: list };
      pushToHistory(next);
      return next;
    });
  };

  const handleToggleTextInlineFormat = (tag: 'b' | 'i' | 'u') => {
    if (!selectedCanvasElement) return;
    const textarea = textareaRef.current;
    if (textarea && textarea.selectionStart !== undefined && textarea.selectionEnd !== undefined && textarea.selectionStart !== textarea.selectionEnd) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const originalText = selectedCanvasElement.texto || '';
      const selectedText = originalText.substring(start, end);
      const openTag = `<${tag}>`;
      const closeTag = `</${tag}>`;

      let newText = '';
      if (selectedText.startsWith(openTag) && selectedText.endsWith(closeTag)) {
        newText = originalText.substring(0, start) + selectedText.substring(openTag.length, selectedText.length - closeTag.length) + originalText.substring(end);
      } else {
        newText = originalText.substring(0, start) + openTag + selectedText + closeTag + originalText.substring(end);
      }

      updateCanvasElement(selectedCanvasElement.id, { texto: newText });
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(start, start + openTag.length + selectedText.length + closeTag.length);
        }
      }, 50);
      return;
    }

    if (tag === 'b') updateCanvasElement(selectedCanvasElement.id, { negrito: !selectedCanvasElement.negrito });
    if (tag === 'i') updateCanvasElement(selectedCanvasElement.id, { italico: !selectedCanvasElement.italico });
    if (tag === 'u') updateCanvasElement(selectedCanvasElement.id, { sublinhado: !selectedCanvasElement.sublinhado });
  };

  const handleInsertPlaceholder = (placeholderKey: string) => {
    if (!selectedCanvasElement || selectedCanvasElement.tipo !== 'texto') {
      setNotification({
        isOpen: true,
        title: 'Selecione um texto',
        message: 'Selecione um elemento de texto no modelo para inserir a variável.',
        type: 'info',
        autoClose: 3000,
      });
      return;
    }

    const token = `{{${placeholderKey}}}`;
    const textarea = textareaRef.current;
    const originalText = selectedCanvasElement.texto || '';

    if (textarea && textarea.selectionStart !== undefined && textarea.selectionEnd !== undefined) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = originalText.substring(0, start) + token + originalText.substring(end);
      updateCanvasElement(selectedCanvasElement.id, { texto: newText });
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(start + token.length, start + token.length);
        }
      }, 50);
    } else {
      updateCanvasElement(selectedCanvasElement.id, {
        texto: originalText ? `${originalText} ${token}` : token,
      });
    }
  };

  const handleCanvasImageUpload = async (file: File, targetElementId?: string) => {
    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/v1/cartas/uploads', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao fazer upload da imagem');

      if (targetElementId) {
        updateCanvasElement(targetElementId, { imagemUrl: data.url });
      } else {
        const newEl: CartaCanvasElement = {
          id: createElementId(),
          tipo: 'imagem',
          x: 120,
          y: 200,
          largura: 160,
          altura: 160,
          visivel: true,
          locked: false,
          imagemUrl: data.url,
          transparencia: 1,
        };
        setCanvasContent((prev) => {
          const next = { ...prev, elements: [...prev.elements, newEl] };
          pushToHistory(next);
          return next;
        });
        setSelectedCanvasElement(newEl);
        setSelectedCanvasElements([newEl]);
      }
    } catch (err: any) {
      setNotification({
        isOpen: true,
        title: 'Erro de Upload',
        message: err.message || 'Falha ao carregar a imagem.',
        type: 'error',
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleCanvasBackgroundUpload = async (file: File) => {
    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/v1/cartas/uploads', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao fazer upload do fundo');

      setCanvasContent((prev) => {
        const next = { ...prev, backgroundUrl: data.url };
        pushToHistory(next);
        return next;
      });
    } catch (err: any) {
      setNotification({
        isOpen: true,
        title: 'Erro de Fundo',
        message: err.message || 'Falha ao carregar a imagem de fundo.',
        type: 'error',
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleCopyJson = async () => {
    try {
      const exportJson = buildCartaTemplateExportJson({
        title: draftTitle || selectedTemplate?.title,
        templateKey: draftKey || selectedTemplate?.template_key,
        tipo: draftTipo || selectedTemplate?.tipo,
        categoria: draftCategoria || selectedTemplate?.categoria,
        canvasContent,
      });
      const formatted = formatCartaTemplateJson(exportJson);
      const success = await copyTextToClipboard(formatted);
      if (success) {
        setCopiedJson(true);
        setTimeout(() => setCopiedJson(false), 3000);
      } else {
        throw new Error('Falha ao acessar área de transferência');
      }
    } catch (err: any) {
      setNotification({
        isOpen: true,
        title: 'Erro ao copiar JSON',
        message: err?.message || 'Não foi possível copiar o JSON para a área de transferência.',
        type: 'error',
        autoClose: 3500,
      });
    }
  };

  const handleSaveTemplate = async () => {
    const targetMinistryId = userCtx.ministryId;
    if (!targetMinistryId) {
      setNotification({
        isOpen: true,
        title: 'Ministério não identificado',
        message: 'Não foi possível identificar o ministério atual.',
        type: 'error',
      });
      return;
    }

    const baseKey = normalizeTemplateKey(draftKey || draftTitle || 'modelo_carta');
    if (!baseKey) {
      setNotification({
        isOpen: true,
        title: 'Título inválido',
        message: 'Informe um título válido para o modelo antes de salvar.',
        type: 'warning',
      });
      return;
    }

    const isCreatingNew = !selectedTemplate;
    const existingTenantKeys = new Set(
      templates.filter((tpl) => tpl.scope === 'tenant').map((tpl) => tpl.template_key)
    );
    const existingSystemKeys = new Set(Object.keys(systemTemplates));

    const buildUniqueKey = (key: string) => {
      let candidate = key;
      if (!existingTenantKeys.has(candidate) && !existingSystemKeys.has(candidate)) return candidate;
      candidate = `${key}-personalizado`;
      let counter = 2;
      while (existingTenantKeys.has(candidate) || existingSystemKeys.has(candidate)) {
        candidate = `${key}-personalizado-${counter}`;
        counter += 1;
      }
      return candidate;
    };

    const finalKey = isCreatingNew ? buildUniqueKey(baseKey) : baseKey;
    const inferredCategoria: TemplateCategoria =
      selectedTemplate?.categoria ||
      draftCategoria ||
      (['membro_ativo', 'batismo', 'cargo', 'apresentacao_crianca'].includes(draftTipo) ? 'declaracao' : 'carta');

    setIsSaving(true);
    try {
      const payload = {
        template_key: finalKey,
        title: draftTitle,
        tipo: draftTipo || 'custom',
        categoria: inferredCategoria,
        content_json: serializeCanvasContent(canvasContent),
        is_active: true,
      };

      const res = await fetch('/api/v1/cartas/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          selectedTemplate?.scope === 'tenant' ? { ...payload, id: selectedTemplate.id } : payload
        ),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Erro ao salvar modelo');

      lastSavedSnapshotRef.current = JSON.stringify({
        title: draftTitle,
        canvas: canvasContent,
      });

      setNotification({
        isOpen: true,
        title: 'Sucesso',
        message: 'Modelo salvo com sucesso!',
        type: 'success',
        autoClose: 3500,
      });

      setDraftKey(finalKey);
      await loadTemplates();
    } catch (err: any) {
      setNotification({
        isOpen: true,
        title: 'Erro',
        message: err?.message || 'Erro ao salvar modelo',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestoreNativeTemplate = (templateKey: string) => {
    const sysNative = DEFAULT_SYSTEM_TEMPLATES.find((s) => s.template_key === templateKey);
    if (!sysNative) return;

    setConfirmModal({
      isOpen: true,
      title: 'Restaurar Modelo Nativo',
      message: `Deseja restaurar "${sysNative.title}" para o modelo nativo padrão do sistema? Suas alterações salvas para este modelo serão descartadas.`,
      confirmText: 'Restaurar Padrão',
      cancelText: 'Cancelar',
      variant: 'warning',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          setIsSaving(true);
          const res = await fetch(`/api/v1/cartas/templates?template_key=${encodeURIComponent(templateKey)}`, {
            method: 'DELETE',
          });
          const resData = await res.json();
          if (!res.ok) throw new Error(resData.error || 'Erro ao restaurar modelo nativo');

          setNotification({
            isOpen: true,
            title: 'Modelo Restaurado',
            message: `O modelo "${sysNative.title}" foi restaurado para o padrão nativo com sucesso.`,
            type: 'success',
            autoClose: 3500,
          });

          setSelectedTemplate({ ...sysNative });
          await loadTemplates();
        } catch (err: any) {
          setNotification({
            isOpen: true,
            title: 'Erro',
            message: err?.message || 'Erro ao restaurar modelo nativo',
            type: 'error',
          });
        } finally {
          setIsSaving(false);
        }
      },
    });
  };

  const handleDeleteTenantTemplate = (templateId: string, title: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Modelo',
      message: `Tem certeza que deseja excluir permanentemente o modelo "${title}"? Esta ação não poderá ser desfeita.`,
      confirmText: 'Excluir Modelo',
      cancelText: 'Cancelar',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          setIsSaving(true);
          const res = await fetch(`/api/v1/cartas/templates?id=${encodeURIComponent(templateId)}`, {
            method: 'DELETE',
          });
          const resData = await res.json();
          if (!res.ok) throw new Error(resData.error || 'Erro ao excluir modelo');

          setNotification({
            isOpen: true,
            title: 'Modelo Excluído',
            message: `O modelo "${title}" foi excluído com sucesso.`,
            type: 'success',
            autoClose: 3000,
          });

          setSelectedTemplate(null);
          await loadTemplates();
        } catch (err: any) {
          setNotification({
            isOpen: true,
            title: 'Erro',
            message: err?.message || 'Erro ao excluir modelo',
            type: 'error',
          });
        } finally {
          setIsSaving(false);
        }
      },
    });
  };

  const handleSelectTemplate = (tpl: CartaTemplate) => {
    setSelectedTemplate(tpl);
  };

  const handleNewTemplate = () => {
    setDraftTitle('Novo Modelo Personalizado');
    setDraftKey(`modelo_${Date.now()}`);
    setDraftTipo('custom');
    setDraftCategoria('carta');
    setCanvasContent(createDefaultCanvas('Escreva aqui o conteúdo da sua nova carta oficial.'));
    setSelectedTemplate(null);
    setIsDraftReady(true);
    setSelectedCanvasElement(null);
    setSelectedCanvasElements([]);
  };

  if (authLoading || moduloCtx.loading || userCtx.loading) {
    return (
      <PageLayout
        title="Configurações — Cartas e Declarações"
        description="Carregando configurações institucionais"
        activeMenu="config-cartas"
      >
        <div className="p-8 text-center text-gray-500">Carregando editor de modelos...</div>
      </PageLayout>
    );
  }

  if (bloqueado || !userCtx.isMaster) {
    return (
      <PageLayout
        title="Acesso Negado"
        description="Acesso exclusivo ao perfil MASTER"
        activeMenu="config-cartas"
      >
        <div className="p-8 max-w-lg mx-auto bg-white rounded-2xl shadow-sm border border-red-200 text-center space-y-4 mt-8">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto text-2xl font-bold">
            🔒
          </div>
          <h2 className="text-xl font-bold text-gray-800">Acesso Exclusivo MASTER</h2>
          <p className="text-sm text-gray-600">
            A configuração e edição de modelos de cartas e declarações é restrita exclusivamente ao perfil MASTER da instituição.
          </p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Modelos de Cartas e Declarações"
      description="Gerenciamento visual completo de modelos de cartas e declarações institucionais (Acesso exclusivo MASTER)"
      activeMenu="config-cartas"
    >
      <NotificationModal
        isOpen={notification.isOpen}
        title={notification.title}
        message={notification.message}
        type={notification.type}
        autoClose={notification.autoClose}
        onClose={() => setNotification((prev) => ({ ...prev, isOpen: false }))}
      />

      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-100 space-y-4">
            <h4 className="text-base font-bold text-gray-800">{confirmModal.title}</h4>
            <p className="text-sm text-gray-600 leading-relaxed">{confirmModal.message}</p>
            <div className="flex justify-end gap-2.5 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
              >
                {confirmModal.cancelText || 'Cancelar'}
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className={`px-4 py-2 text-xs font-bold text-white rounded-xl transition ${
                  confirmModal.variant === 'warning' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {confirmModal.confirmText || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barra de cabeçalho e atalho para o módulo operacional */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-2xl bg-teal-50 border border-teal-200">
        <div>
          <h2 className="text-sm font-bold text-teal-900 flex items-center gap-2">
            <span>⚙️</span>
            <span>Configurações &gt; Cartas e Declarações (Exclusivo MASTER)</span>
          </h2>
          <p className="text-xs text-teal-700 mt-0.5">
            Os modelos configurados aqui ficam imediatamente disponíveis para emissão na Secretaria.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/secretaria/cartas')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-teal-100 text-teal-800 text-xs font-bold rounded-xl border border-teal-300 shadow-xs transition"
        >
          <span>Ir para Emissão de Cartas</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>

      <Section icon="🧩" title="Editor Visual de Modelos">
        {/* Cabeçalho da Seção de Modelos com Botão de Novo Modelo */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-gray-100">
            <div>
              <h3 className="text-base font-bold text-gray-800">Modelos Oficiais</h3>
              <p className="text-xs text-gray-500">
                Crie e personalize o layout A4 das cartas e declarações oficiais da sua igreja.
              </p>
            </div>
            <button
              type="button"
              onClick={handleNewTemplate}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition shadow-sm self-start sm:self-auto"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Novo Modelo</span>
            </button>
          </div>

          {/* Segmented Control de Categoria */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50/80 p-1.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCategoriaFilter('todas')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  categoriaFilter === 'todas'
                    ? 'bg-white text-teal-800 shadow-sm border border-gray-200'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Todos ({templates.length})
              </button>
              <button
                type="button"
                onClick={() => setCategoriaFilter('carta')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  categoriaFilter === 'carta'
                    ? 'bg-white text-blue-800 shadow-sm border border-blue-200'
                    : 'text-gray-600 hover:text-blue-800'
                }`}
              >
                <span>📜</span>
                <span>Cartas ({templates.filter((t) => (t.categoria || 'carta') === 'carta').length})</span>
              </button>
              <button
                type="button"
                onClick={() => setCategoriaFilter('declaracao')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  categoriaFilter === 'declaracao'
                    ? 'bg-white text-emerald-800 shadow-sm border border-emerald-200'
                    : 'text-gray-600 hover:text-emerald-800'
                }`}
              >
                <span>📄</span>
                <span>Declarações ({templates.filter((t) => t.categoria === 'declaracao').length})</span>
              </button>
            </div>
            <div className="text-xs text-gray-500 font-medium px-2">
              Exibindo {templates.filter((t) => categoriaFilter === 'todas' || (t.categoria || 'carta') === categoriaFilter).length} modelo(s)
            </div>
          </div>

          {/* Card: Modelo Selecionado */}
          <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm backdrop-blur">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex-1 space-y-1.5 min-w-[280px]">
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    Modelo Ativo para Edição
                  </label>
                  {selectedTemplate && (
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
                        selectedTemplate.categoria === 'declaracao'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-blue-50 text-blue-800 border border-blue-200'
                      }`}
                    >
                      {selectedTemplate.categoria === 'declaracao' ? '📄 DECLARAÇÃO OFICIAL' : '📜 CARTA MINISTERIAL'}
                    </span>
                  )}
                </div>
                <select
                  value={selectedTemplate?.id || ''}
                  onChange={(e) => {
                    const tpl = templates.find((t) => t.id === e.target.value);
                    if (tpl) handleSelectTemplate(tpl);
                  }}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 shadow-sm"
                >
                  <option value="" disabled>Selecione um modelo para editar</option>
                  {templates
                    .filter((t) => categoriaFilter === 'todas' || (t.categoria || 'carta') === categoriaFilter)
                    .map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.categoria === 'declaracao' ? '📄 [Declaração] ' : '📜 [Carta] '}{tpl.title}
                      </option>
                    ))}
                </select>
              </div>

              {selectedTemplate && (
                <div className="flex flex-wrap items-center gap-2 self-end lg:self-center">
                  {DEFAULT_SYSTEM_TEMPLATES.some((s) => s.template_key === selectedTemplate.template_key) ? (
                    <button
                      type="button"
                      onClick={() => handleRestoreNativeTemplate(selectedTemplate.template_key)}
                      disabled={isSaving}
                      className="text-xs px-3 py-2 rounded-xl font-medium transition flex items-center gap-1.5 bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200"
                      title="Restaurar este modelo para o padrão nativo do sistema"
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-amber-600" />
                      <span>Restaurar Nativo</span>
                    </button>
                  ) : (
                    selectedTemplate.scope === 'tenant' && (
                      <button
                        type="button"
                        onClick={() => handleDeleteTenantTemplate(selectedTemplate.id, selectedTemplate.title)}
                        disabled={isSaving}
                        className="text-xs px-3 py-2 rounded-xl font-medium transition flex items-center gap-1.5 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                        title="Excluir este modelo"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-600" />
                        <span>Excluir</span>
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Visualização de Edição Direta do Modelo */}
        {selectedTemplate || isDraftReady ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* COLUNA 1 (3 cols): PAINEL LATERAL ESQUERDO */}
              <div className="lg:col-span-3 space-y-3">
                <div className="flex bg-gray-100/80 p-1 rounded-xl border border-gray-200 gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveSidebarTab('elementos')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                      activeSidebarTab === 'elementos'
                        ? 'bg-white text-teal-800 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <span>➕ Elementos</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSidebarTab('variaveis')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                      activeSidebarTab === 'variaveis'
                        ? 'bg-white text-teal-800 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <span>{'{x}'} Variáveis</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSidebarTab('camadas')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 relative ${
                      activeSidebarTab === 'camadas'
                        ? 'bg-white text-teal-800 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <span>🥞 Camadas</span>
                    {canvasContent.elements.length > 0 && (
                      <span className="text-[10px] bg-teal-100 text-teal-800 font-bold px-1.5 py-0.2 rounded-full">
                        {canvasContent.elements.length}
                      </span>
                    )}
                  </button>
                </div>

                {activeSidebarTab === 'elementos' && (
                  <div className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-lg/10 backdrop-blur space-y-3">
                    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-100 pb-2">
                      Inserir no Canvas
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => addCanvasElement('texto')}
                        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-teal-50 hover:border-teal-300 transition shadow-sm"
                      >
                        <Type className="h-4 w-4 text-teal-600" />
                        <span>Texto</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => addCanvasElement('linha')}
                        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-teal-50 hover:border-teal-300 transition shadow-sm"
                      >
                        <Minus className="h-4 w-4 text-teal-600" />
                        <span>Linha</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => addCanvasElement('logo')}
                        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-teal-50 hover:border-teal-300 transition shadow-sm"
                      >
                        <Shield className="h-4 w-4 text-teal-600" />
                        <span>Logo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => addCanvasElement('imagem')}
                        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-teal-50 hover:border-teal-300 transition shadow-sm"
                      >
                        <Image className="h-4 w-4 text-teal-600" />
                        <span>Imagem</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => addCanvasElement('forma')}
                        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-teal-50 hover:border-teal-300 transition shadow-sm"
                      >
                        <Square className="h-4 w-4 text-teal-600" />
                        <span>Forma</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => addCanvasElement('qrcode')}
                        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-teal-50 hover:border-teal-300 transition shadow-sm"
                      >
                        <span className="text-sm">📱</span>
                        <span>QR Code</span>
                      </button>
                      <button
                        type="button"
                        disabled={isUploadingImage}
                        onClick={() => {
                          setCanvasImageTargetId(null);
                          canvasImageInputRef.current?.click();
                        }}
                        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-teal-50 hover:border-teal-300 transition shadow-sm disabled:opacity-50"
                      >
                        <Upload className="h-4 w-4 text-teal-600" />
                        <span>{isUploadingImage ? 'Enviando...' : 'Upload'}</span>
                      </button>
                    </div>

                    <div className="pt-2 border-t border-gray-100 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => canvasBackgroundInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition shadow-sm"
                      >
                        <Paintbrush className="h-3.5 w-3.5 text-teal-600" />
                        <span>Definir Imagem de Fundo</span>
                      </button>

                      {canvasContent.backgroundUrl && (
                        <button
                          type="button"
                          onClick={() => setCanvasContent((prev) => ({ ...prev, backgroundUrl: '' }))}
                          className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition"
                        >
                          <Eraser className="h-3.5 w-3.5" />
                          <span>Remover Fundo</span>
                        </button>
                      )}
                    </div>

                    <input
                      ref={canvasImageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        const targetId = canvasImageTargetId ?? undefined;
                        e.currentTarget.value = '';
                        setCanvasImageTargetId(null);
                        if (file) {
                          handleCanvasImageUpload(file, targetId);
                        }
                      }}
                    />
                    <input
                      ref={canvasBackgroundInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleCanvasBackgroundUpload(file);
                        }
                        e.currentTarget.value = '';
                      }}
                    />
                  </div>
                )}

                {activeSidebarTab === 'variaveis' && (
                  <div className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-lg/10 backdrop-blur space-y-3">
                    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-100 pb-2">
                      Variáveis Dinâmicas
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      Selecione um elemento de texto e clique no botão para inserir a variável.
                    </p>
                    <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                      {PLACEHOLDER_GROUPS.map((group) => (
                        <div key={group.title}>
                          <p className="text-[11px] font-bold text-teal-800 mb-1">{group.title}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {group.items.map((item) => (
                              <button
                                key={item.key}
                                onClick={() => handleInsertPlaceholder(item.key)}
                                className="text-[11px] px-2.5 py-1 rounded-full bg-gray-100 hover:bg-teal-100 hover:text-teal-800 text-gray-700 transition font-medium border border-gray-200"
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeSidebarTab === 'camadas' && (
                  <div className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-lg/10 backdrop-blur space-y-3">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                      <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Lista de Camadas
                      </h3>
                      <span className="text-[10px] text-gray-400 font-semibold">
                        Frente no topo
                      </span>
                    </div>

                    {canvasContent.elements.length === 0 ? (
                      <div className="py-8 text-center text-gray-400 space-y-1">
                        <p className="text-xs">Nenhuma camada criada.</p>
                        <p className="text-[10px]">Adicione um elemento na aba "Elementos".</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                        {canvasContent.elements.slice().reverse().map((el) => {
                          const isSelected = selectedCanvasElement?.id === el.id;
                          let labelResumido = CANVAS_ELEMENT_LABELS[el.tipo] || 'Elemento';
                          if (el.tipo === 'texto' && el.texto) {
                            labelResumido = el.texto.replace(/<[^>]*>?/gm, '').slice(0, 22) || 'Texto';
                          }

                          return (
                            <div
                              key={el.id}
                              onClick={() => {
                                setSelectedCanvasElement(el);
                                setSelectedCanvasElements([el]);
                              }}
                              className={`flex items-center justify-between p-2.5 rounded-xl text-xs cursor-pointer transition border ${
                                isSelected
                                  ? 'bg-teal-600 text-white font-bold border-teal-700 shadow-sm'
                                  : 'bg-white text-gray-700 border-gray-200 hover:bg-teal-50/50'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className={`p-1 rounded-md ${isSelected ? 'bg-teal-700 text-white' : 'bg-gray-100'}`}>
                                  {el.tipo === 'texto' && <Type className="h-3.5 w-3.5" />}
                                  {el.tipo === 'linha' && <Minus className="h-3.5 w-3.5" />}
                                  {el.tipo === 'logo' && <Shield className="h-3.5 w-3.5" />}
                                  {el.tipo === 'imagem' && <Image className="h-3.5 w-3.5" />}
                                  {el.tipo === 'qrcode' && <span>📱</span>}
                                  {el.tipo === 'forma' && <Square className="h-3.5 w-3.5" />}
                                </span>
                                <span className="truncate">{labelResumido}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    bringToFront(el.id);
                                  }}
                                  title="Trazer para a Frente Absoluta"
                                  className={`p-1 rounded hover:bg-black/10 transition ${isSelected ? 'text-white' : 'text-gray-500'}`}
                                >
                                  <ArrowUpToLine className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    moveLayerUp(el.id);
                                  }}
                                  title="Subir uma Camada"
                                  className={`p-1 rounded hover:bg-black/10 transition ${isSelected ? 'text-white' : 'text-gray-500'}`}
                                >
                                  <ChevronUp className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    moveLayerDown(el.id);
                                  }}
                                  title="Descer uma Camada"
                                  className={`p-1 rounded hover:bg-black/10 transition ${isSelected ? 'text-white' : 'text-gray-500'}`}
                                >
                                  <ChevronDown className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    sendToBack(el.id);
                                  }}
                                  title="Enviar para o Fundo Absoluto"
                                  className={`p-1 rounded hover:bg-black/10 transition ${isSelected ? 'text-white' : 'text-gray-500'}`}
                                >
                                  <ArrowDownToLine className="h-3 w-3" />
                                </button>
                                {el.locked && <Lock className="h-3 w-3 opacity-80 ml-1" />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* COLUNA 2 (6 cols): CANVAS CENTRAL */}
              <div className="lg:col-span-6 space-y-4">
                <div className="rounded-2xl border border-gray-300 bg-gray-100 p-4 shadow-inner space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-2.5">
                    <div className="flex items-center gap-1.5 text-xs text-gray-700 font-semibold">
                      <FileText className="h-4 w-4 text-teal-600 shrink-0" />
                      <span>Papel A4 Retrato</span>
                      <span className="text-[11px] font-normal text-gray-500">
                        (210 × 297 mm — {CANVAS_A4.width} × {CANVAS_A4.height} px)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-0.5 shadow-xs">
                        <button
                          type="button"
                          onClick={handleUndo}
                          disabled={historyIndex <= 0}
                          className="px-2 py-0.5 rounded text-[11px] font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Desfazer"
                        >
                          ↩ Desfazer
                        </button>
                        <button
                          type="button"
                          onClick={handleRedo}
                          disabled={historyIndex >= history.length - 1}
                          className="px-2 py-0.5 rounded text-[11px] font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Refazer"
                        >
                          ↪ Refazer
                        </button>
                      </div>
                      <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-0.5 shadow-xs">
                        <button
                          type="button"
                          onClick={() => setEditorZoomMode('auto')}
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                            editorZoomMode === 'auto' ? 'bg-teal-600 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          Ajustar ({Math.round(editorScale * 100)}%)
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditorZoomMode('100%')}
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                            editorZoomMode === '100%' ? 'bg-teal-600 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          100%
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditorZoomMode('75%')}
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                            editorZoomMode === '75%' ? 'bg-teal-600 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          75%
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditorZoomMode('50%')}
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                            editorZoomMode === '50%' ? 'bg-teal-600 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          50%
                        </button>
                      </div>
                    </div>
                  </div>

                  <div ref={canvasContainerRef} className="max-h-[820px] overflow-auto flex justify-center py-1">
                    <div
                      style={{
                        width: `${canvasContent.width * editorScale}px`,
                        height: `${canvasContent.height * editorScale}px`,
                        position: 'relative',
                        flexShrink: 0,
                        transition: 'width 0.15s ease, height 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          transform: `scale(${editorScale})`,
                          transformOrigin: 'top left',
                          width: `${canvasContent.width}px`,
                          height: `${canvasContent.height}px`,
                        }}
                      >
                        <InteractiveCanvas
                          elementos={canvasContent.elements}
                          elementoSelecionado={selectedCanvasElement}
                          elementosSelecionados={selectedCanvasElements}
                          getPreviewText={getCanvasPreviewText}
                          onElementoSelecionado={setSelectedCanvasElement}
                          onElementosSelecionados={setSelectedCanvasElements}
                          onElementoAtualizado={(id, props) => updateCanvasElement(id, props)}
                          onMultiplosElementosAtualizados={updateMultipleCanvasElements as any}
                          onElementosAdicionados={addCanvasElements}
                          onElementoRemovido={removeCanvasElement}
                          backgroundUrl={canvasContent.backgroundUrl}
                          showGrid
                          gridSize={24}
                          larguraCanvas={canvasContent.width}
                          alturaCanvas={canvasContent.height}
                          scale={editorScale}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* COLUNA 3 (3 cols): PROPRIEDADES */}
              <div className="lg:col-span-3 space-y-4">
                <div className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-lg/10 backdrop-blur space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Propriedades
                    </h3>
                    {selectedCanvasElement && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => duplicateCanvasElement(selectedCanvasElement)}
                          title="Duplicar Elemento"
                          className="p-1 text-gray-500 hover:text-teal-700 hover:bg-teal-50 rounded transition"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleCanvasLock(selectedCanvasElement)}
                          title={selectedCanvasElement.locked ? 'Desbloquear Elemento' : 'Bloquear Elemento'}
                          className={`p-1 rounded transition ${
                            selectedCanvasElement.locked ? 'text-amber-700 bg-amber-50' : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          {selectedCanvasElement.locked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeCanvasElement(selectedCanvasElement.id)}
                          title="Excluir Elemento"
                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {!selectedCanvasElement ? (
                    <div className="p-6 text-center text-gray-400 space-y-2">
                      <p className="text-xs font-semibold text-gray-500">Nenhum elemento selecionado.</p>
                      <p className="text-[11px]">Clique em um elemento no canvas para editar suas propriedades.</p>
                    </div>
                  ) : (
                    <div className="space-y-4 text-xs">
                      <div className="flex items-center justify-between bg-gray-50 p-2 rounded-lg border border-gray-100">
                        <div>
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">TIPO</span>
                          <p className="font-bold text-teal-900">{CANVAS_ELEMENT_LABELS[selectedCanvasElement.tipo]}</p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => duplicateCanvasElement(selectedCanvasElement)}
                            className="px-2 py-1 bg-white text-gray-700 border border-gray-200 rounded text-[10px] font-bold hover:bg-gray-50 transition"
                          >
                            Duplicar
                          </button>
                          <button
                            type="button"
                            onClick={() => removeCanvasElement(selectedCanvasElement.id)}
                            className="px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded text-[10px] font-bold hover:bg-red-100 transition"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>

                      {/* Posição e Dimensões */}
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">POSIÇÃO E TAMANHO</span>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-semibold text-gray-500">Largura (W)</label>
                            <input
                              type="number"
                              value={selectedCanvasElement.largura}
                              onChange={(e) => updateCanvasElement(selectedCanvasElement.id, { largura: Number(e.target.value) || 0 })}
                              className="w-full rounded border border-gray-200 px-2 py-1"
                              disabled={selectedCanvasElement.locked}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-gray-500">Altura (H)</label>
                            <input
                              type="number"
                              value={selectedCanvasElement.altura}
                              onChange={(e) => updateCanvasElement(selectedCanvasElement.id, { altura: Number(e.target.value) || 0 })}
                              className="w-full rounded border border-gray-200 px-2 py-1"
                              disabled={selectedCanvasElement.locked}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Propriedades de Texto */}
                      {selectedCanvasElement.tipo === 'texto' && (
                        <div className="space-y-3">
                          <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">CONTEÚDO DO TEXTO</label>
                            <textarea
                              ref={textareaRef}
                              rows={5}
                              value={selectedCanvasElement.texto || ''}
                              onChange={(e) => updateCanvasElement(selectedCanvasElement.id, { texto: e.target.value })}
                              className="w-full rounded-lg border border-gray-200 p-2 text-xs font-mono focus:border-teal-500 focus:outline-none"
                              disabled={selectedCanvasElement.locked}
                            />
                          </div>

                          {/* Formatação rápida de texto */}
                          <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg border border-gray-200">
                            <button
                              type="button"
                              onClick={() => handleToggleTextInlineFormat('b')}
                              className="p-1 rounded hover:bg-gray-200 font-bold"
                              title="Negrito"
                            >
                              <Bold className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleTextInlineFormat('i')}
                              className="p-1 rounded hover:bg-gray-200 italic"
                              title="Itálico"
                            >
                              <Italic className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleTextInlineFormat('u')}
                              className="p-1 rounded hover:bg-gray-200 underline"
                              title="Sublinhado"
                            >
                              <Underline className="h-3.5 w-3.5" />
                            </button>
                            <div className="h-4 w-px bg-gray-300 mx-1" />
                            <button
                              type="button"
                              onClick={() => updateCanvasElement(selectedCanvasElement.id, { alinhamento: 'left' })}
                              className={`p-1 rounded ${selectedCanvasElement.alinhamento === 'left' ? 'bg-teal-600 text-white' : 'hover:bg-gray-200'}`}
                            >
                              <AlignLeft className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => updateCanvasElement(selectedCanvasElement.id, { alinhamento: 'center' })}
                              className={`p-1 rounded ${selectedCanvasElement.alinhamento === 'center' ? 'bg-teal-600 text-white' : 'hover:bg-gray-200'}`}
                            >
                              <AlignCenter className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => updateCanvasElement(selectedCanvasElement.id, { alinhamento: 'right' })}
                              className={`p-1 rounded ${selectedCanvasElement.alinhamento === 'right' ? 'bg-teal-600 text-white' : 'hover:bg-gray-200'}`}
                            >
                              <AlignRight className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-semibold text-gray-500">Fonte</label>
                              <select
                                value={selectedCanvasElement.fonte || 'Calibri'}
                                onChange={(e) => updateCanvasElement(selectedCanvasElement.id, { fonte: e.target.value })}
                                className="w-full rounded border border-gray-200 px-2 py-1 bg-white"
                              >
                                {CANVAS_FONTES.map((f) => (
                                  <option key={f} value={f}>{f}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-gray-500">Tamanho ({selectedCanvasElement.fontSize || 18}px)</label>
                              <input
                                type="number"
                                min={8}
                                max={72}
                                value={selectedCanvasElement.fontSize || 18}
                                onChange={(e) => updateCanvasElement(selectedCanvasElement.id, { fontSize: Number(e.target.value) || 18 })}
                                className="w-full rounded border border-gray-200 px-2 py-1"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-semibold text-gray-500">Cor do Texto</label>
                            <div className="flex items-center gap-2 mt-1">
                              <input
                                type="color"
                                value={selectedCanvasElement.cor || '#111827'}
                                onChange={(e) => updateCanvasElement(selectedCanvasElement.id, { cor: e.target.value })}
                                className="h-7 w-10 rounded border border-gray-200 cursor-pointer p-0.5"
                              />
                              <input
                                type="text"
                                value={selectedCanvasElement.cor || '#111827'}
                                onChange={(e) => updateCanvasElement(selectedCanvasElement.id, { cor: e.target.value })}
                                className="flex-1 rounded border border-gray-200 px-2 py-1 uppercase"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Transparência para Imagem e Logo */}
                      {(selectedCanvasElement.tipo === 'imagem' || selectedCanvasElement.tipo === 'logo') && (
                        <div className="space-y-2 border-t border-gray-100 pt-3">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                              Transparência
                            </label>
                            <span className="text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
                              {Math.round((selectedCanvasElement.transparencia ?? 1) * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={selectedCanvasElement.transparencia ?? 1}
                            onChange={(e) => updateCanvasElement(selectedCanvasElement.id, { transparencia: Number(e.target.value) })}
                            className="w-full accent-teal-600 cursor-pointer"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Barra Inferior com "Copiar JSON" e "Salvar Modelo" */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-2xl border border-gray-200 bg-white/95 shadow-sm backdrop-blur">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                    isDirty
                      ? 'bg-amber-50 text-amber-800 border border-amber-300'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isDirty ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                  {isDirty ? 'Alterações não salvas' : 'Modelo atualizado'}
                </span>
                {selectedTemplate?.scope === 'system' && (
                  <span className="text-[11px] text-gray-500 font-medium">
                    (Modelo nativo — salvar criará sua versão personalizada)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {copiedJson && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                    JSON copiado com sucesso
                  </span>
                )}

                <button
                  type="button"
                  onClick={handleCopyJson}
                  title="Copiar JSON completo do modelo atualmente aberto no editor"
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border shadow-sm ${
                    copiedJson
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Copy className="h-4 w-4 text-gray-500" />
                  <span>{copiedJson ? 'Copiado!' : 'Copiar JSON'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  disabled={isSaving || (!isDirty && !isDraftReady)}
                  className={`px-6 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm ${
                    isSaving || (!isDirty && !isDraftReady)
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-300'
                      : 'bg-teal-600 hover:bg-teal-700 text-white shadow-md'
                  }`}
                >
                  <Save className="h-4 w-4" />
                  <span>
                    {isSaving
                      ? 'Salvando Modelo...'
                      : selectedTemplate?.scope === 'system'
                      ? 'Salvar como Modelo Personalizado'
                      : 'Salvar Modelo'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white/80 p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center mx-auto text-xl font-bold">
              🧩
            </div>
            <h4 className="text-base font-bold text-gray-800">Nenhum modelo selecionado</h4>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Selecione um modelo no seletor acima ou clique em <span className="font-semibold text-teal-700">+ Novo Modelo</span> para criar um novo documento personalizado.
            </p>
            <button
              type="button"
              onClick={handleNewTemplate}
              className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white text-xs font-bold rounded-xl hover:bg-teal-700 transition shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Novo Modelo</span>
            </button>
          </div>
        )}
      </Section>
    </PageLayout>
  );
}
