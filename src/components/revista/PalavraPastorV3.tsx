'use client';

import { useState } from 'react';
import { Video } from 'lucide-react';
import type { PalavraPastorEdicao } from '@/lib/revista-digital-utils';

interface PalavraPastorV3Props {
  ano: number;
  numeroPagina: number;
  palavraPastor?: PalavraPastorEdicao | null;
  mensagemPastoral?: {
    titulo: string;
    conteudo_texto: string | null;
    video_url: string | null;
  } | null;
  playfairClassName: string;
  montserratClassName: string;
  loraClassName: string;
}

export default function PalavraPastorV3({
  ano,
  numeroPagina,
  palavraPastor,
  mensagemPastoral,
  playfairClassName,
  montserratClassName,
  loraClassName,
}: PalavraPastorV3Props) {
  const [fotoError, setFotoError] = useState(false);
  const isCustom = Boolean(palavraPastor?.publicada);

  const subtituloTema = isCustom
    ? palavraPastor?.titulo && palavraPastor.titulo !== 'Palavra do Pastor'
      ? palavraPastor.titulo
      : null
    : mensagemPastoral?.titulo || null;

  return (
    <div className="h-full overflow-y-auto revista-scroll bg-[#FAF8F2] text-[#263548] px-5 sm:px-10 py-6 sm:py-8">
      <div className="max-w-3xl mx-auto flex flex-col min-h-full justify-between space-y-6">
        <div className="space-y-6">
          {/* ─── CABEÇALHO EDITORIAL CENTRALIZADO ─────────────────── */}
          <header className="text-center space-y-2 pt-1">
            <p
              className={`${montserratClassName} text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.22em] text-[#C9A24D]`}
            >
              MENSAGEM PASTORAL • EDIÇÃO {ano}
            </p>
            <h2
              className={`${playfairClassName} font-bold text-[#031525] leading-tight`}
              style={{ fontSize: 'clamp(26px, 4.2vw, 40px)' }}
            >
              Palavra do Pastor
            </h2>
            {/* Ornamento horizontal dourado */}
            <div className="flex items-center justify-center gap-2 pt-1">
              <span className="h-[1px] w-12 bg-gradient-to-r from-transparent to-[#C9A24D]" />
              <span className="w-1.5 h-1.5 rotate-45 bg-[#C9A24D]" />
              <span className="h-[1px] w-12 bg-gradient-to-l from-transparent to-[#C9A24D]" />
            </div>
          </header>

          {/* ─── CONTEÚDO: FOTOGRAFIA + MENSAGEM ──────────────────── */}
          <div className="clearfix">
            {isCustom && palavraPastor?.foto_url && !fotoError && (
              <figure className="mx-auto md:float-left md:mr-7 md:mb-4 mb-5 w-fit max-w-[260px] sm:max-w-[290px] md:w-[36%]">
                <div className="rounded-xl overflow-hidden border border-[#C9A24D]/60 shadow-[0_8px_24px_rgba(3,21,37,0.1)] bg-white p-1">
                  <img
                    src={palavraPastor.foto_url}
                    alt="Pastor e Esposa"
                    onError={() => setFotoError(true)}
                    className="w-full max-h-[30vh] md:max-h-[32vh] object-contain mx-auto rounded-lg"
                  />
                </div>
                {(palavraPastor.nome_pastor || palavraPastor.nome_esposa) && (
                  <figcaption className="mt-2 text-center">
                    <p className={`${montserratClassName} text-[11px] font-bold text-[#031525]`}>
                      {palavraPastor.nome_pastor}
                      {palavraPastor.nome_pastor && palavraPastor.nome_esposa ? ' & ' : ''}
                      {palavraPastor.nome_esposa}
                    </p>
                  </figcaption>
                )}
              </figure>
            )}

            {subtituloTema && (
              <h3
                className={`${playfairClassName} text-lg sm:text-xl font-bold text-[#031525] mb-3 leading-snug border-l-2 border-[#C9A24D] pl-3`}
              >
                {subtituloTema}
              </h3>
            )}

            {isCustom ? (
              <div
                className={`${loraClassName} palavra-editorial-body text-[14.5px] sm:text-[16px] leading-[1.7] text-[#263548] space-y-3.5`}
                dangerouslySetInnerHTML={{
                  __html: palavraPastor?.conteudo_html || '',
                }}
              />
            ) : (
              <div
                className={`${loraClassName} palavra-editorial-body text-[14.5px] sm:text-[16px] leading-[1.7] text-[#263548] space-y-3.5 whitespace-pre-line`}
              >
                {mensagemPastoral?.conteudo_texto}
              </div>
            )}
          </div>
        </div>

        {/* ─── ASSINATURA PASTORAL ────────────────────────────────── */}
        <footer className="pt-5 mt-4 border-t border-[#C9A24D]/30 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          {isCustom && (palavraPastor?.nome_pastor || palavraPastor?.assinatura) ? (
            <div className="space-y-0.5">
              {palavraPastor.nome_pastor && (
                <p className={`${playfairClassName} text-base font-bold text-[#031525]`}>
                  {palavraPastor.nome_pastor}
                </p>
              )}
              {palavraPastor.assinatura && (
                <p className={`${montserratClassName} text-[11px] font-semibold text-[#C9A24D] uppercase tracking-wider`}>
                  {palavraPastor.assinatura}
                </p>
              )}
            </div>
          ) : !isCustom && mensagemPastoral?.video_url ? (
            <a
              href={mensagemPastoral.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className={`${montserratClassName} inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#031525] text-white font-bold text-xs transition hover:opacity-90 w-fit`}
            >
              <Video className="w-4 h-4 text-[#C9A24D]" /> Assistir Mensagem em Vídeo
            </a>
          ) : (
            <div />
          )}

          <span className={`${montserratClassName} text-[10px] font-bold text-[#C9A24D] tracking-widest`}>
            p.{numeroPagina}
          </span>
        </footer>
      </div>

      <style jsx global>{`
        .palavra-editorial-body p:first-of-type::first-letter {
          font-family: inherit;
          font-size: 2.4em;
          font-weight: 700;
          color: #031525;
          float: left;
          line-height: 0.85;
          margin-right: 0.35rem;
          margin-top: 0.1rem;
        }
        .palavra-editorial-body blockquote {
          background: rgba(201, 162, 77, 0.08);
          border-left: 3px solid #c9a24d;
          padding: 0.75rem 1rem;
          margin: 1rem 0;
          font-style: italic;
          color: #031525;
          border-radius: 0 0.5rem 0.5rem 0;
        }
      `}</style>
    </div>
  );
}
