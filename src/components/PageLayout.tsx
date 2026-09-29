import { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface PageLayoutProps {
  title: string;
  description: string;
  children: ReactNode;
  activeMenu?: string;
  headerExtra?: ReactNode;
  backHref?: string;
  backLabel?: string;
}

export default function PageLayout({
  title,
  description,
  children,
  headerExtra,
  backHref,
  backLabel,
}: PageLayoutProps) {
  return (
    <div className="flex flex-col h-full min-w-0 overflow-x-hidden">
      {/* HEADER */}
      <div className="bg-white shadow-sm border-b border-gray-200 p-6">
        {backHref && (
          <div className="mb-3">
            <Link
              href={backHref}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition border border-slate-200 shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-600" />
              <span>{backLabel || 'Voltar'}</span>
            </Link>
          </div>
        )}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-[#123b63]">{title}</h1>
            <p className="text-gray-600 text-sm mt-1">{description}</p>
          </div>
          {headerExtra && <div className="self-center">{headerExtra}</div>}
        </div>
      </div>

      {/* CONTENT */}
      <div id="page-scroll-container" className="flex-1 min-w-0 w-full overflow-y-auto overflow-x-hidden p-6">
        {children}
      </div>
    </div>
  );
}

