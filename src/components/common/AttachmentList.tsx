'use client';

import { AttachmentItem } from './AttachmentUploader';

interface AttachmentListProps {
  attachments: AttachmentItem[] | string | null | undefined;
}

export default function AttachmentList({ attachments }: AttachmentListProps) {
  let parsed: AttachmentItem[] = [];

  if (Array.isArray(attachments)) {
    parsed = attachments;
  } else if (typeof attachments === 'string') {
    try {
      const json = JSON.parse(attachments);
      if (Array.isArray(json)) parsed = json;
    } catch {
      // Ignorar erros de parse
    }
  }

  if (!parsed || parsed.length === 0) return null;

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="mt-3 pt-2 border-t border-gray-100 space-y-2">
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
        Anexos ({parsed.length})
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {parsed.map((item, idx) => {
          const isImage = item.type?.startsWith('image/');
          return (
            <div
              key={idx}
              className="flex items-center justify-between p-2 rounded-lg border border-gray-200 bg-gray-50/80 hover:bg-white transition text-xs gap-2 shadow-2xs"
            >
              <div className="flex items-center gap-2 overflow-hidden flex-1">
                {isImage ? (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                    <img
                      src={item.url}
                      alt={item.name}
                      className="w-10 h-10 rounded object-cover border border-gray-300 hover:opacity-90 transition"
                    />
                  </a>
                ) : (
                  <span className="text-xl flex-shrink-0">📄</span>
                )}
                <div className="truncate flex-1">
                  <p className="font-semibold text-gray-800 truncate" title={item.name}>
                    {item.name}
                  </p>
                  {item.size ? (
                    <p className="text-[10px] text-gray-500">{formatFileSize(item.size)}</p>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1 bg-white border border-gray-300 rounded text-[11px] text-gray-700 hover:bg-gray-100 font-semibold transition"
                  title="Visualizar anexo"
                >
                  Ver 👁️
                </a>
                <a
                  href={item.url}
                  download={item.name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1 bg-[#123b63] text-white rounded text-[11px] hover:bg-blue-900 font-semibold transition"
                  title="Baixar anexo"
                >
                  ⬇️
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
