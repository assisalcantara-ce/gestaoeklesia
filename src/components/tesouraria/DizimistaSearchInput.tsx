'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, UserCheck, X } from 'lucide-react';

interface DizimistaSearchInputProps {
  dizimistas: Array<{ id: string; nome: string; congregacaoNome?: string; tipoCadastro?: string }>;
  selectedNome: string;
  onSelectDizimista: (dizimista: { id: string; nome: string } | null) => void;
  disabled?: boolean;
}

export default function DizimistaSearchInput({
  dizimistas,
  selectedNome,
  onSelectDizimista,
  disabled = false,
}: DizimistaSearchInputProps) {
  const [query, setQuery] = useState(selectedNome || '');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(selectedNome || '');
  }, [selectedNome]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const sugestoes = dizimistas.filter((d) =>
    d.nome.toLowerCase().includes((query || '').toLowerCase())
  ).slice(0, 8);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar dizimista por nome..."
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            if (!e.target.value) {
              onSelectDizimista(null);
            }
          }}
          onFocus={() => !disabled && setIsOpen(true)}
          className={`w-full pl-9 pr-8 py-2 border rounded-lg text-sm focus:outline-none focus:border-[#123b63] ${
            disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200' : 'border-gray-200'
          }`}
        />
        {query && !disabled && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              onSelectDizimista(null);
            }}
            className="absolute right-2.5 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-gray-100">
          {sugestoes.length === 0 ? (
            <div className="p-3 text-xs text-gray-400 text-center">Nenhum dizimista encontrado.</div>
          ) : (
            sugestoes.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  setQuery(d.nome);
                  onSelectDizimista({ id: d.id, nome: d.nome });
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex justify-between items-center transition"
              >
                <div>
                  <p className="font-bold text-gray-800 flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5 text-teal-600" />
                    {d.nome}
                  </p>
                  <p className="text-[10px] text-gray-400">{d.congregacaoNome || 'Sede / Geral'}</p>
                </div>
                <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-1.5 py-0.5 rounded capitalize">
                  {d.tipoCadastro || 'membro'}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
