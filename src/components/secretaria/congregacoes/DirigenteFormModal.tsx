'use client';

interface MemberLookup {
  id: string;
  name: string;
  cpf: string | null;
  data_nascimento: string | null;
  role: string | null;
  occupation: string | null;
  profissao?: string | null;
  phone: string | null;
  custom_fields: Record<string, any> | null;
}

interface DirigenteFormModalProps {
  dirigenteValue: string;
  dirigenteStatus: 'idle' | 'loading' | 'selected' | 'not_found' | 'error';
  dirigenteMsg: string;
  dirigenteSelected: { id: string; name: string } | null;
  dirigenteResults: MemberLookup[];
  getMinisterCargo: (m: MemberLookup) => string;
  onDirigenteInputChange: (val: string) => void;
  onSelectDirigente: (member: MemberLookup) => void;
}

export default function DirigenteFormModal({
  dirigenteValue,
  dirigenteStatus,
  dirigenteMsg,
  dirigenteSelected,
  dirigenteResults,
  getMinisterCargo,
  onDirigenteInputChange,
  onSelectDirigente,
}: DirigenteFormModalProps) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        Dirigente
      </label>
      <input
        type="text"
        value={dirigenteValue}
        onChange={(e) => onDirigenteInputChange(e.target.value)}
        placeholder="Ex: Pr. João Silva"
        className="w-full px-4 py-2 border-2 border-teal-500 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <p className="text-xs text-gray-600 mt-2">
        {dirigenteStatus === 'loading'
          ? 'Buscando...'
          : dirigenteMsg || (dirigenteSelected ? 'Dirigente selecionado.' : 'Digite pelo menos 2 letras para buscar na lista de ministros.')}
      </p>

      {dirigenteResults.length > 0 && !dirigenteSelected && (
        <div className="mt-2 border border-gray-200 rounded-lg bg-white overflow-hidden">
          {dirigenteResults.map(m => {
            const cargo = String(getMinisterCargo(m) || '').trim();
            return (
              <button
                type="button"
                key={m.id}
                onClick={() => onSelectDirigente(m)}
                className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm"
              >
                <span className="font-semibold text-gray-800">{m.name}</span>
                {cargo ? <span className="text-gray-500"> — {cargo}</span> : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
