'use client';

interface Divisao1 {
  id: string;
  codigo?: number | null;
  nome: string;
  uf?: string | null;
  supervisao_id?: string;
  supervisor_member_id?: string | null;
  supervisor_matricula?: string | null;
  supervisor_nome?: string | null;
  supervisor_cpf?: string | null;
  supervisor_data_nascimento?: string | null;
  supervisor_cargo?: string | null;
  supervisor_celular?: string | null;
  is_active: boolean;
  created_at: string;
}

interface Divisao2 {
  id: string;
  ministry_id: string;
  supervisao_id?: string | null;
  nome: string;
  is_sede: boolean;
  pastor_member_id?: string | null;
  pastor_nome?: string | null;
  pastor_data_posse?: string | null;
  cep?: string | null;
  municipio?: string | null;
  uf?: string | null;
  is_active: boolean;
  created_at: string;
}

interface Divisao3 {
  id: string;
  ministry_id: string;
  supervisao_id?: string | null;
  campo_id?: string | null;
  nome: string;
  dirigente?: string | null;
  dirigente_cpf?: string | null;
  dirigente_cargo?: string | null;
  dirigente_matricula?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status_imovel?: 'PROPRIO' | 'ALUGADO' | 'CEDIDO' | null;
  foto_url?: string | null;
  foto_bucket?: string | null;
  foto_path?: string | null;
  is_active: boolean;
  created_at: string;
}

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

type FotoIgrejaChange =
  | { kind: 'none' }
  | { kind: 'file'; file: File; previewUrl: string }
  | { kind: 'url'; url: string };

interface CongregacaoFormModalProps {
  activeTab: string;
  nomeD1: string;
  nomeD2: string;
  nomeD3: string;
  showFormD1: boolean;
  showFormD2: boolean;
  showFormD3: boolean;
  editingD1: Divisao1 | null;
  editingD2: Divisao2 | null;
  editingD3: Divisao3 | null;
  formD1: any;
  formD2: any;
  formD3: any;
  setFormD1: React.Dispatch<React.SetStateAction<any>>;
  setFormD2: React.Dispatch<React.SetStateAction<any>>;
  setFormD3: React.Dispatch<React.SetStateAction<any>>;
  dirigenteStatus: string;
  dirigenteMsg: string;
  dirigenteSelected: { id: string; name: string } | null;
  dirigenteResults: MemberLookup[];
  pastorStatus: string;
  pastorMsg: string;
  pastorResults: MemberLookup[];
  geoPreview: { latitude: number; longitude: number; address: string } | null;
  fotoIgrejaChange: FotoIgrejaChange;
  fotoIgrejaUrlInput: string;
  setFotoIgrejaUrlInput: React.Dispatch<React.SetStateAction<string>>;
  setFotoIgrejaChange: React.Dispatch<React.SetStateAction<FotoIgrejaChange>>;
  availableDivisoes3ForCurrentD2: Divisao3[];
  availableDivisoes2ForCurrentD1: Divisao2[];
  selectedD1IdsForD2: string[];
  setSelectedD1IdsForD2: React.Dispatch<React.SetStateAction<string[]>>;
  selectedD2IdsForD3: string[];
  setSelectedD2IdsForD3: React.Dispatch<React.SetStateAction<string[]>>;
  getMinisterCargo: (m: MemberLookup) => string;
  formatCpf: (cpf: string) => string;
  handleSaveD1: () => void;
  handleSaveD2: () => void;
  handleSaveD3: () => void;
  onCancelD1: () => void;
  onCancelD2: () => void;
  onCancelD3: () => void;
  onSelectDirigente: (m: MemberLookup) => void;
  onSelectPastor: (m: MemberLookup) => void;
}

export default function CongregacaoFormModal({
  activeTab,
  nomeD1,
  nomeD2,
  nomeD3,
  showFormD1,
  showFormD2,
  showFormD3,
  editingD1,
  editingD2,
  editingD3,
  formD1,
  formD2,
  formD3,
  setFormD1,
  setFormD2,
  setFormD3,
  dirigenteStatus,
  dirigenteMsg,
  dirigenteSelected,
  dirigenteResults,
  pastorStatus,
  pastorMsg,
  pastorResults,
  geoPreview,
  fotoIgrejaChange,
  fotoIgrejaUrlInput,
  setFotoIgrejaUrlInput,
  setFotoIgrejaChange,
  availableDivisoes3ForCurrentD2,
  availableDivisoes2ForCurrentD1,
  selectedD1IdsForD2,
  setSelectedD1IdsForD2,
  selectedD2IdsForD3,
  setSelectedD2IdsForD3,
  getMinisterCargo,
  formatCpf,
  handleSaveD1,
  handleSaveD2,
  handleSaveD3,
  onCancelD1,
  onCancelD2,
  onCancelD3,
  onSelectDirigente,
  onSelectPastor,
}: CongregacaoFormModalProps) {
  // FORMULÁRIO D1 (Igreja/Congregação - usa formD3)
  if (activeTab === 'divisao1' && showFormD3) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">
          {editingD3 ? `Editar ${nomeD1}` : `Nova ${nomeD1}`}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Nome da {nomeD1}
            </label>
            <input
              type="text"
              value={formD3.nome}
              onChange={(e) => setFormD3((prev: any) => ({ ...prev, nome: e.target.value }))}
              placeholder={`Ex: ${nomeD1} Central`}
              className="w-full px-4 py-2 border-2 border-teal-500 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Dirigente
            </label>
            <input
              type="text"
              value={formD3.dirigente}
              onChange={(e) => {
                const v = e.target.value;
                setFormD3((prev: any) => ({
                  ...prev,
                  dirigente: v,
                  dirigente_cpf: '',
                  dirigente_cargo: '',
                  dirigente_matricula: '',
                }));
              }}
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

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm font-semibold text-gray-800 mb-3">Dados do Dirigente</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">CPF</label>
                <input
                  type="text"
                  value={formD3.dirigente_cpf}
                  onChange={(e) => setFormD3((prev: any) => ({ ...prev, dirigente_cpf: formatCpf(e.target.value) }))}
                  placeholder="Ex: 00000000000"
                  className="w-full px-4 py-2 border-2 border-teal-500 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Cargo</label>
                <input
                  type="text"
                  value={formD3.dirigente_cargo}
                  onChange={(e) => setFormD3((prev: any) => ({ ...prev, dirigente_cargo: e.target.value }))}
                  placeholder="Ex: Pastor"
                  className="w-full px-4 py-2 border-2 border-teal-500 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Matrícula</label>
                <input
                  type="text"
                  value={formD3.dirigente_matricula}
                  onChange={(e) => setFormD3((prev: any) => ({ ...prev, dirigente_matricula: e.target.value }))}
                  placeholder="Ex: 12345"
                  className="w-full px-4 py-2 border-2 border-teal-500 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Endereço</label>
            <input
              type="text"
              value={formD3.endereco}
              onChange={(e) => setFormD3((prev: any) => ({ ...prev, endereco: e.target.value }))}
              placeholder="Ex: Rua X, 123"
              className="w-full px-4 py-2 border-2 border-teal-500 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">CEP</label>
              <input
                type="text"
                value={formD3.cep}
                onChange={(e) => setFormD3((prev: any) => ({ ...prev, cep: e.target.value }))}
                placeholder="Somente números"
                className="w-full px-4 py-2 border-2 border-teal-500 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Município</label>
              <input
                type="text"
                value={formD3.municipio}
                onChange={(e) => setFormD3((prev: any) => ({ ...prev, municipio: e.target.value }))}
                placeholder="Ex: Santos"
                className="w-full px-4 py-2 border-2 border-teal-500 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">UF</label>
              <input
                type="text"
                value={formD3.uf}
                onChange={(e) => setFormD3((prev: any) => ({ ...prev, uf: e.target.value.toUpperCase().slice(0, 2) }))}
                placeholder="Ex: SP"
                maxLength={2}
                className="w-full px-4 py-2 border-2 border-teal-500 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Status do imóvel
            </label>
            <select
              value={formD3.status_imovel}
              onChange={(e) => setFormD3((prev: any) => ({ ...prev, status_imovel: e.target.value as any }))}
              className="w-full px-4 py-2 border-2 border-teal-500 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecione</option>
              <option value="PROPRIO">Próprio</option>
              <option value="ALUGADO">Alugado</option>
              <option value="CEDIDO">Cedido</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Geolocalização</label>
            <input
              type="text"
              value={
                geoPreview
                  ? `${geoPreview.latitude}, ${geoPreview.longitude}`
                  : (editingD3?.latitude != null && editingD3?.longitude != null
                    ? `${editingD3.latitude}, ${editingD3.longitude}`
                    : '')
              }
              disabled
              placeholder="Gerado automaticamente ao salvar"
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg bg-gray-100 text-gray-700"
            />
            <p className="text-xs text-gray-600 mt-1">
              Este campo é preenchido automaticamente com base no endereço e não pode ser editado aqui.
            </p>
          </div>

          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="text-sm font-semibold text-gray-700 text-center">Foto da Igreja</div>
                <div className="text-xs text-gray-600 mt-1 text-center">
                  Envie um arquivo ou informe uma URL. A imagem será redimensionada e comprimida automaticamente.
                </div>

                <div className="mt-4 flex flex-col items-center gap-4">
                  <input
                    id="foto-igreja-file"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      if (!file) return;

                      if (fotoIgrejaChange.kind === 'file') {
                        try { URL.revokeObjectURL(fotoIgrejaChange.previewUrl); } catch { /* noop */ }
                      }

                      const previewUrl = URL.createObjectURL(file);
                      setFotoIgrejaChange({ kind: 'file', file, previewUrl });
                    }}
                    className="hidden"
                  />

                  <div className="w-full flex flex-col items-center gap-2">
                    <label
                      htmlFor="foto-igreja-file"
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold cursor-pointer"
                    >
                      Selecionar foto
                    </label>
                    <div className="w-full text-center text-sm text-gray-700 truncate">
                      {fotoIgrejaChange.kind === 'file'
                        ? fotoIgrejaChange.file.name
                        : 'Nenhum arquivo selecionado'}
                    </div>
                  </div>

                  <div className="w-full flex flex-col items-center gap-2">
                    <input
                      type="url"
                      value={fotoIgrejaUrlInput}
                      onChange={(e) => setFotoIgrejaUrlInput(e.target.value)}
                      placeholder="(opcional) URL da foto"
                      className="w-full px-4 py-2 border-2 border-teal-500 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const url = fotoIgrejaUrlInput.trim();
                        if (!url) return;
                        if (fotoIgrejaChange.kind === 'file') {
                          try { URL.revokeObjectURL(fotoIgrejaChange.previewUrl); } catch { /* noop */ }
                        }
                        setFotoIgrejaChange({ kind: 'url', url });
                      }}
                      className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition font-semibold"
                    >
                      Usar URL
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="text-sm font-semibold text-gray-700 text-center">Pré-visualização</div>
                <div className="mt-4 flex items-center justify-center">
                  <div className="w-full h-52 border border-gray-200 rounded-lg bg-gray-50 p-3 flex items-center justify-center">
                    {(() => {
                      const preview =
                        fotoIgrejaChange.kind === 'file'
                          ? fotoIgrejaChange.previewUrl
                          : fotoIgrejaChange.kind === 'url'
                            ? fotoIgrejaChange.url
                            : (editingD3?.foto_url || '');

                      if (!preview) {
                        return <div className="text-sm text-gray-500">Sem foto</div>;
                      }

                      return (
                        <img
                          src={preview}
                          alt="Pré-visualização"
                          className="max-w-full max-h-full object-contain rounded-md"
                          loading="lazy"
                        />
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSaveD3}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
            >
              {editingD3 ? '💾 Atualizar' : '✓ Salvar'}
            </button>
            <button
              onClick={onCancelD3}
              className="flex-1 px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition font-semibold"
            >
              ✕ Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // FORMULÁRIO D2 (Campo - usa formD2)
  if (activeTab === 'divisao2' && showFormD2) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">
          {editingD2 ? `Editar ${nomeD2}` : `Novo ${nomeD2}`}
        </h3>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nome do {nomeD2}
              </label>
              <input
                type="text"
                value={formD2.nome}
                onChange={(e) => setFormD2((prev: any) => ({ ...prev, nome: e.target.value }))}
                placeholder={`Ex: ${nomeD2} Baixada Santista`}
                className="w-full px-4 py-2 border-2 border-teal-500 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Município
              </label>
              <input
                type="text"
                value={formD2.municipio}
                onChange={(e) => setFormD2((prev: any) => ({ ...prev, municipio: e.target.value }))}
                placeholder="Ex: São Paulo"
                className="w-full px-4 py-2 border-2 border-teal-500 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="inline-flex items-center gap-3">
              <input
                type="checkbox"
                checked={!!formD2.informar_pastor}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setFormD2((prev: any) => ({
                    ...prev,
                    informar_pastor: checked,
                    pastor_nome_input: checked ? prev.pastor_nome_input : '',
                    pastor_member_id: checked ? prev.pastor_member_id : '',
                    pastor_nome: checked ? prev.pastor_nome : '',
                    pastor_data_posse: checked ? prev.pastor_data_posse : ''
                  }));
                }}
                className="h-5 w-5"
              />
              <span className="text-sm font-semibold text-gray-800">Informar Pastor/Supervisor</span>
            </label>
          </div>

          {formD2.informar_pastor && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-800 mb-3">Dados do Pastor</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nome</label>
                  <input
                    type="text"
                    value={formD2.pastor_nome_input}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFormD2((prev: any) => ({
                        ...prev,
                        pastor_nome_input: v,
                        pastor_member_id: '',
                        pastor_nome: ''
                      }));
                    }}
                    placeholder="Digite para buscar..."
                    className="w-full px-4 py-2 border-2 border-teal-500 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-600 mt-2">
                    {pastorStatus === 'loading'
                      ? 'Buscando...'
                      : pastorMsg || (formD2.pastor_member_id ? 'Pastor selecionado.' : 'Digite pelo menos 2 letras para buscar.')}
                  </p>

                  {pastorResults.length > 0 && !formD2.pastor_member_id && (
                    <div className="mt-2 border border-gray-200 rounded-lg bg-white overflow-hidden">
                      {pastorResults.map(m => (
                        <button
                          type="button"
                          key={m.id}
                          onClick={() => onSelectPastor(m)}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm"
                        >
                          <span className="font-semibold text-gray-800">{m.name}</span>
                          {m.role ? <span className="text-gray-500"> — {m.role}</span> : null}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Data da posse</label>
                  <input
                    type="date"
                    value={formD2.pastor_data_posse}
                    onChange={(e) => setFormD2((prev: any) => ({ ...prev, pastor_data_posse: e.target.value }))}
                    className="w-full px-4 py-2 border-2 border-teal-500 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm font-semibold text-gray-800 mb-2">Adicionar {nomeD1}s (opcional)</p>
            <p className="text-xs text-gray-600 mb-3">
              Selecionados: {selectedD1IdsForD2.length}
            </p>
            {availableDivisoes3ForCurrentD2.length === 0 ? (
              <p className="text-sm text-gray-600">Nenhuma {nomeD1} disponível para este {nomeD2}.</p>
            ) : (
              <div className="max-h-48 overflow-auto border border-gray-200 rounded-lg bg-white">
                {availableDivisoes3ForCurrentD2.map(cg => {
                  const checked = selectedD1IdsForD2.includes(cg.id);
                  return (
                    <label key={cg.id} className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setSelectedD1IdsForD2((prev: string[]) => {
                            if (isChecked) return prev.includes(cg.id) ? prev : [...prev, cg.id];
                            return prev.filter(id => id !== cg.id);
                          });
                        }}
                        className="h-4 w-4"
                      />
                      <span className="text-gray-800 font-semibold">{cg.nome}</span>
                      <span className="text-gray-500">{`${cg.cidade || '-'} / ${cg.uf || '-'}`}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSaveD2}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
            >
              {editingD2 ? '💾 Atualizar' : '✓ Salvar'}
            </button>
            <button
              onClick={onCancelD2}
              className="flex-1 px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition font-semibold"
            >
              ✕ Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // FORMULÁRIO D3 (Supervisão - usa formD1)
  if (activeTab === 'divisao3' && showFormD1) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">
          {editingD1 ? `Editar ${nomeD3}` : `Nova ${nomeD3}`}
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Nome da {nomeD3}</label>
            <input
              type="text"
              value={formD1.nome}
              onChange={(e) => setFormD1((prev: any) => ({ ...prev, nome: e.target.value }))}
              placeholder={`Ex: ${nomeD3} Norte`}
              className="w-full px-4 py-2 border-2 border-teal-500 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="inline-flex items-center gap-3">
              <input
                type="checkbox"
                checked={!!formD1.informar_supervisor}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setFormD1((prev: any) => ({
                    ...prev,
                    informar_supervisor: checked,
                    supervisor_nome: checked ? prev.supervisor_nome : '',
                    supervisor_cpf_input: '',
                    supervisor_member_id: '',
                    supervisor_matricula: '',
                    supervisor_cpf: '',
                    supervisor_data_nascimento: '',
                    supervisor_cargo: '',
                    supervisor_celular: '',
                  }));
                }}
                className="h-5 w-5"
              />
              <span className="text-sm font-semibold text-gray-800">Informar Pastor/Supervisor</span>
            </label>
          </div>

          {formD1.informar_supervisor && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Nome do Supervisor</label>
              <input
                type="text"
                value={formD1.supervisor_nome}
                onChange={(e) => setFormD1((prev: any) => ({ ...prev, supervisor_nome: e.target.value }))}
                placeholder="Ex: Pr. João Silva"
                className="w-full px-4 py-2 border-2 border-teal-500 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm font-semibold text-gray-800 mb-2">Adicionar {nomeD2}s (opcional)</p>
            <p className="text-xs text-gray-600 mb-3">Selecionados: {selectedD2IdsForD3.length}</p>
            {availableDivisoes2ForCurrentD1.length === 0 ? (
              <p className="text-sm text-gray-600">Nenhum {nomeD2} disponível para esta {nomeD3}.</p>
            ) : (
              <div className="max-h-48 overflow-auto border border-gray-200 rounded-lg bg-white">
                {availableDivisoes2ForCurrentD1.map(c => {
                  const checked = selectedD2IdsForD3.includes(c.id);
                  return (
                    <label key={c.id} className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setSelectedD2IdsForD3((prev: string[]) => {
                            if (isChecked) return prev.includes(c.id) ? prev : [...prev, c.id];
                            return prev.filter(id => id !== c.id);
                          });
                        }}
                        className="h-4 w-4"
                      />
                      <span className="text-gray-800 font-semibold">{c.nome}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button onClick={handleSaveD1} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold">
              {editingD1 ? '💾 Atualizar' : '✓ Salvar'}
            </button>
            <button
              onClick={onCancelD1}
              className="flex-1 px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition font-semibold"
            >
              ✕ Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
