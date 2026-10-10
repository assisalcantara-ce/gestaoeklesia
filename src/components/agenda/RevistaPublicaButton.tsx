'use client';

import { useState, useEffect, useRef } from 'react';
import { BookOpen, ExternalLink, Copy, Check, AlertCircle, ChevronDown } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';

interface RevistaPublicaButtonProps {
  ministryId?: string | null;
}

export default function RevistaPublicaButton({ ministryId }: RevistaPublicaButtonProps) {
  const [slug, setSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadMinistrySlug() {
      if (!ministryId) return;
      try {
        setLoading(true);
        const supabase = createClient();
        const { data } = await supabase
          .from('ministries')
          .select('slug')
          .eq('id', ministryId)
          .maybeSingle();

        if (data?.slug) {
          setSlug(data.slug);
        } else {
          setSlug(null);
        }
      } catch (err) {
        console.error('Erro ao buscar slug da revista:', err);
        setSlug(null);
      } finally {
        setLoading(false);
      }
    }

    loadMinistrySlug();
  }, [ministryId]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getPublicUrl = () => {
    if (!slug) return null;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/revista/${slug}`;
  };

  const handleOpenRevista = () => {
    if (!slug) {
      setFeedbackMsg('Ministério sem link público configurado.');
      setTimeout(() => setFeedbackMsg(null), 3000);
      return;
    }
    setOpenDropdown(false);
    window.open(`/revista/${slug}`, '_blank', 'noopener,noreferrer');
  };

  const handleCopyLink = async () => {
    const url = getPublicUrl();
    if (!url) {
      setFeedbackMsg('Ministério sem link público configurado.');
      setTimeout(() => setFeedbackMsg(null), 3000);
      return;
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFeedbackMsg('Não foi possível copiar o link.');
      setTimeout(() => setFeedbackMsg(null), 3000);
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <div className="inline-flex rounded-xl shadow-sm border border-slate-300 bg-white overflow-hidden">
        <button
          type="button"
          onClick={handleOpenRevista}
          disabled={loading}
          title="Abrir Revista Digital Pública"
          className="px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 hover:text-teal-800 hover:bg-slate-50 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-60"
        >
          <BookOpen className="h-4 w-4 text-teal-700" />
          <span>Revista Pública</span>
        </button>

        <button
          type="button"
          onClick={() => setOpenDropdown((prev) => !prev)}
          title="Mais opções da Revista Pública"
          className="px-2 py-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-50 border-l border-slate-200 transition-colors cursor-pointer"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {feedbackMsg && (
        <div className="absolute right-0 mt-1 z-50 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg shadow-md flex items-center gap-1.5 whitespace-nowrap">
          <AlertCircle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {openDropdown && (
        <div className="absolute right-0 mt-1.5 w-52 rounded-xl bg-white border border-slate-200 shadow-lg py-1.5 z-50 text-xs sm:text-sm">
          <button
            type="button"
            onClick={handleOpenRevista}
            className="w-full text-left px-3.5 py-2 text-slate-700 hover:bg-teal-50 hover:text-teal-900 flex items-center justify-between cursor-pointer transition-colors"
          >
            <span className="flex items-center gap-2">
              <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
              Abrir revista
            </span>
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            className="w-full text-left px-3.5 py-2 text-slate-700 hover:bg-teal-50 hover:text-teal-900 flex items-center justify-between cursor-pointer transition-colors"
          >
            <span className="flex items-center gap-2">
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-slate-500" />
              )}
              {copied ? 'Link copiado!' : 'Copiar link'}
            </span>
            {copied && (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                OK
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
