'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase-client';

export interface AttachmentItem {
  name: string;
  size: number;
  type: string;
  url: string;
  path: string;
}

interface AttachmentUploaderProps {
  attachments: AttachmentItem[];
  onChange: (attachments: AttachmentItem[]) => void;
  maxFiles?: number;
  disabled?: boolean;
}

export default function AttachmentUploader({
  attachments,
  onChange,
  maxFiles = 5,
  disabled = false,
}: AttachmentUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const uploadFile = async (file: File) => {
    if (attachments.length >= maxFiles) {
      setErrorMessage(`Limite máximo de ${maxFiles} arquivos atingido.`);
      return;
    }

    setUploading(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setErrorMessage('Sessão expirada ou não autenticada. Faça login novamente para anexar arquivos.');
        setUploading(false);
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/v1/suporte/uploads', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao enviar anexo.');
      }

      onChange([...attachments, data]);
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao carregar arquivo.');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      uploadFile(file);
    });
  };

  const handleRemove = (index: number) => {
    const next = [...attachments];
    next.splice(index, 1);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {/* Área Drag & Drop / Seleção */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled) handleFileSelect(e.dataTransfer.files);
        }}
        className={`border-2 border-dashed rounded-xl p-4 text-center transition-all ${
          dragOver ? 'border-[#123b63] bg-blue-50/50 scale-[0.99]' : 'border-gray-300 hover:border-gray-400 bg-gray-50/50'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept="image/png,image/jpeg,image/webp,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
          onChange={(e) => handleFileSelect(e.target.files)}
          disabled={disabled || uploading || attachments.length >= maxFiles}
        />
        <div className="flex flex-col items-center justify-center gap-1">
          <span className="text-2xl">📎</span>
          <p className="text-xs font-semibold text-[#123b63]">
            {uploading ? 'Enviando anexo...' : 'Clique ou arraste arquivos para anexar'}
          </p>
          <p className="text-[11px] text-gray-500">
            Imagens (PNG, JPG, WEBP) e Documentos (PDF, DOC, XLS, TXT, CSV) até 10MB
          </p>
        </div>
      </div>

      {errorMessage && (
        <p className="text-xs text-red-600 font-semibold bg-red-50 p-2 rounded-md border border-red-200">
          ⚠️ {errorMessage}
        </p>
      )}

      {/* Lista de Anexos Selecionados */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-700">Anexos ({attachments.length}):</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {attachments.map((item, idx) => {
              const isImage = item.type?.startsWith('image/');
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-lg border border-gray-200 bg-white shadow-sm text-xs gap-2"
                >
                  <div className="flex items-center gap-2 overflow-hidden flex-1">
                    {isImage ? (
                      <img src={item.url} alt={item.name} className="w-8 h-8 rounded object-cover border flex-shrink-0" />
                    ) : (
                      <span className="text-base flex-shrink-0">📄</span>
                    )}
                    <div className="truncate flex-1">
                      <p className="font-semibold text-gray-800 truncate" title={item.name}>
                        {item.name}
                      </p>
                      <p className="text-[10px] text-gray-500">{formatFileSize(item.size)}</p>
                    </div>
                  </div>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => handleRemove(idx)}
                      className="text-red-500 hover:text-red-700 p-1 text-xs font-bold transition rounded hover:bg-red-50"
                      title="Remover anexo"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
