'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { createClient } from '@/lib/supabase-client';

export default function NomenclaturaPage() {
  const [activeMenu, setActiveMenu] = useState('nomenclaturas');
  const [isEditing, setIsEditing] = useState(false);

  const supabase = createClient();

  const NOMENCLATURAS_SCHEMA_VERSION_KEY = 'nomenclaturas_schema_version';
  const NOMENCLATURAS_SCHEMA_VERSION = '2';
  const ORG_NOMENCLATURAS_KEY = 'divisoes_organizacionais';
  const ORG_NOMENCLATURAS_SCHEMA_VERSION = 3;

  type DivisionKey = 'divisaoPrincipal' | 'divisaoSecundaria' | 'divisaoTerciaria';
  type DivisionConfig = { opcao1: string; custom?: string[] };
  type NomenclaturasState = Record<DivisionKey, DivisionConfig>;

  const NATIVE_OPTIONS: Record<DivisionKey, string[]> = {
    // Divisão 1 agora usa as opções que eram da Divisão 3
    divisaoPrincipal: ['CONGREGAÇÃO', 'IGREJA', 'TEMPLO', 'NENHUMA'],
    divisaoSecundaria: ['CAMPO', 'SETOR', 'GRUPO', 'ÁREA', 'NENHUMA'],
    // Divisão 3: deixar apenas "NENHUMA" (usuário pode adicionar manualmente)
    divisaoTerciaria: ['NENHUMA']
  };

  const getDefaultNomenclaturas = (): NomenclaturasState => ({
    divisaoPrincipal: { opcao1: 'IGREJA', custom: [] },
    divisaoSecundaria: { opcao1: 'CAMPO', custom: [] },
    divisaoTerciaria: { opcao1: 'NENHUMA', custom: [] }
  });

  const normalizeCustomList = (custom: unknown): string[] => {
    if (!Array.isArray(custom)) return [];
    return custom
      .map(v => (typeof v === 'string' ? v.trim() : ''))
      .filter(Boolean)
      .map(v => v.toUpperCase());
  };

  const normalizeDivision = (key: DivisionKey, value: any, legacyThirdDivision = false): DivisionConfig => {
    const native = NATIVE_OPTIONS[key];
    const base = getDefaultNomenclaturas()[key];

    if (!value) return base;

    if (typeof value === 'string') {
      const selected = value.trim().toUpperCase() || base.opcao1;
      if (key === 'divisaoTerciaria') {
        // Terceira divisão: por padrão, só "NENHUMA".
        // Em dados legados, não reaproveitar opções antigas.
        if (legacyThirdDivision) return { opcao1: 'NENHUMA', custom: [] };
        return { opcao1: native.includes(selected) ? selected : 'NENHUMA', custom: [] };
      }
      const custom = native.includes(selected) ? [] : [selected];
      return { opcao1: selected, custom };
    }

    const rawSelected = typeof value.opcao1 === 'string' ? value.opcao1 : base.opcao1;
    let selected = rawSelected.trim().toUpperCase() || base.opcao1;
    const custom = normalizeCustomList(value.custom);
    const customDedup = Array.from(new Set(custom));

    if (key === 'divisaoTerciaria') {
      if (legacyThirdDivision) {
        return { opcao1: 'NENHUMA', custom: [] };
      }
      const hasSelectedInCustom = customDedup.some(v => v.toUpperCase() === selected);
      if (!native.includes(selected) && !hasSelectedInCustom) selected = 'NENHUMA';
    }

    const all = new Set([...native, ...customDedup]);
    if (!all.has(selected) && key !== 'divisaoTerciaria') customDedup.push(selected);

    return { opcao1: selected, custom: Array.from(new Set(customDedup)) };
  };

  const normalizeNomenclaturas = (raw: any): NomenclaturasState => {
    const legacyThirdDivision = !!raw?.__legacyThirdDivision;
    return {
      divisaoPrincipal: normalizeDivision('divisaoPrincipal', raw?.divisaoPrincipal, legacyThirdDivision),
      divisaoSecundaria: normalizeDivision('divisaoSecundaria', raw?.divisaoSecundaria, legacyThirdDivision),
      divisaoTerciaria: normalizeDivision('divisaoTerciaria', raw?.divisaoTerciaria, legacyThirdDivision)
    };
  };

  const [nomenclaturas, setNomenclatura] = useState<NomenclaturasState>(() => getDefaultNomenclaturas());
  const [temp, setTemp] = useState<NomenclaturasState>(() => getDefaultNomenclaturas());
  const [loaded, setLoaded] = useState(false);
  const [novaOpcao, setNovaOpcao] = useState<Record<DivisionKey, string>>({
    divisaoPrincipal: '',
    divisaoSecundaria: '',
    divisaoTerciaria: ''
  });

  const resolveMinistryId = async (): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const mu = await supabase
        .from('ministry_users')
        .select('ministry_id')
        .eq('user_id', user.id)
        .limit(1);
      const ministryIdFromMu = (mu.data as any)?.[0]?.ministry_id as string | undefined;
      if (ministryIdFromMu) return ministryIdFromMu;

      const m = await supabase
        .from('ministries')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);
      const ministryIdFromOwner = (m.data as any)?.[0]?.id as string | undefined;
      return ministryIdFromOwner || null;
    } catch {
      return null;
    }
  };

  const buildOrgNomenclaturasPayload = (state: NomenclaturasState) => {
    return {
      schemaVersion: ORG_NOMENCLATURAS_SCHEMA_VERSION,
      divisaoPrincipal: state.divisaoPrincipal,
      divisaoSecundaria: state.divisaoSecundaria,
      divisaoTerciaria: state.divisaoTerciaria,
    };
  };

  const upsertOrgNomenclaturas = async (ministryId: string, state: NomenclaturasState) => {
    const { data: existingRow } = await supabase
      .from('configurations')
      .select('nomenclaturas')
      .eq('ministry_id', ministryId)
      .maybeSingle();

    const existingNomenclaturas = (existingRow as any)?.nomenclaturas || {};
    const payload = buildOrgNomenclaturasPayload(state);

    await supabase
      .from('configurations')
      .upsert({
        ministry_id: ministryId,
        nomenclaturas: { ...existingNomenclaturas, [ORG_NOMENCLATURAS_KEY]: payload },
        updated_at: new Date().toISOString(),
      } as any, { onConflict: 'ministry_id' });
  };

  const loadFromSupabaseOrMigrate = async () => {
    const ministryId = await resolveMinistryId();
    if (!ministryId) {
      setLoaded(true);
      return;
    }

    // 1) Carrega do Supabase
    const { data: configRow, error: configErr } = await supabase
      .from('configurations')
      .select('nomenclaturas')
      .eq('ministry_id', ministryId)
      .maybeSingle();

    if (!configErr) {
      const rawNomenclaturas = (configRow as any)?.nomenclaturas || {};
      const org = rawNomenclaturas?.[ORG_NOMENCLATURAS_KEY];
      if (org) {
        const schemaVersion = Number(org?.schemaVersion || 0);
        const normalized = normalizeNomenclaturas({
          divisaoPrincipal: org?.divisaoPrincipal,
          divisaoSecundaria: org?.divisaoSecundaria,
          divisaoTerciaria: org?.divisaoTerciaria,
          __legacyThirdDivision: schemaVersion < ORG_NOMENCLATURAS_SCHEMA_VERSION,
        });
        setNomenclatura(normalized);
        setTemp(normalized);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('nomenclaturas', JSON.stringify(normalized));
            localStorage.setItem(NOMENCLATURAS_SCHEMA_VERSION_KEY, NOMENCLATURAS_SCHEMA_VERSION);
          } catch {
            // ignore
          }
        }
        setLoaded(true);
        return;
      }
    }

    // 2) Migra localStorage -> Supabase (se existir)
    let nextState: NomenclaturasState | null = null;
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('nomenclaturas');
      const version = localStorage.getItem(NOMENCLATURAS_SCHEMA_VERSION_KEY);

      if (saved) {
        try {
          let parsed = JSON.parse(saved);

          // Migração v2 (legado): trocar Divisão 1 <-> Divisão 3
          if (version !== NOMENCLATURAS_SCHEMA_VERSION) {
            parsed = {
              ...parsed,
              divisaoPrincipal: parsed?.divisaoTerciaria,
              divisaoTerciaria: parsed?.divisaoPrincipal,
            };
          }

          nextState = normalizeNomenclaturas({
            ...parsed,
            __legacyThirdDivision: true,
          });
        } catch {
          // ignore
        }
      }
    }

    if (!nextState) nextState = getDefaultNomenclaturas();

    await upsertOrgNomenclaturas(ministryId, nextState);

    if (typeof window !== 'undefined') {
      try {
        // Mantém localStorage sincronizado para telas legadas que ainda leem de lá,
        // mas já com a 3ª divisão simplificada (sem opções antigas).
        localStorage.setItem('nomenclaturas', JSON.stringify(nextState));
        localStorage.setItem(NOMENCLATURAS_SCHEMA_VERSION_KEY, NOMENCLATURAS_SCHEMA_VERSION);
      } catch {
        // ignore
      }
    }

    setNomenclatura(nextState);
    setTemp(nextState);
    setLoaded(true);
  };

  useEffect(() => {
    loadFromSupabaseOrMigrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectChange = (nivel: DivisionKey, value: string) => {
    const selected = (value || '').trim().toUpperCase();
    setTemp(prev => ({
      ...prev,
      [nivel]: {
        ...prev[nivel],
        opcao1: selected
      }
    }));
  };

  const handleAddCustomOption = (nivel: DivisionKey) => {
    const raw = novaOpcao[nivel] || '';
    const value = raw.trim().toUpperCase();

    if (!value) {
      alert('Digite uma nomenclatura para adicionar.');
      return;
    }

    const native = NATIVE_OPTIONS[nivel];
    const currentCustom = temp[nivel].custom || [];
    const exists = [...native, ...currentCustom].some(v => v.toUpperCase() === value);
    if (exists) {
      alert('Essa opção já existe.');
      return;
    }

    setTemp(prev => ({
      ...prev,
      [nivel]: {
        ...prev[nivel],
        opcao1: value,
        custom: [...(prev[nivel].custom || []), value]
      }
    }));
    setNovaOpcao(prev => ({ ...prev, [nivel]: '' }));
  };

  const handleDeleteCustomOption = (nivel: DivisionKey, value: string) => {
    const toDelete = (value || '').trim().toUpperCase();
    setTemp(prev => {
      const custom = (prev[nivel].custom || []).filter(v => v.toUpperCase() !== toDelete);
      const nextSelected = prev[nivel].opcao1?.toUpperCase() === toDelete ? 'NENHUMA' : prev[nivel].opcao1;
      return {
        ...prev,
        [nivel]: {
          ...prev[nivel],
          opcao1: nextSelected,
          custom
        }
      };
    });
  };

  const handleSave = async () => {
    console.log('💾 handleSave chamado');
    console.log('📋 Dados a salvar:', temp);
    setNomenclatura(temp);
    const ministryId = await resolveMinistryId();
    if (ministryId) {
      await upsertOrgNomenclaturas(ministryId, temp);
    }
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('nomenclaturas', JSON.stringify(temp));
        localStorage.setItem(NOMENCLATURAS_SCHEMA_VERSION_KEY, NOMENCLATURAS_SCHEMA_VERSION);
      } catch {
        // ignore
      }
    }
    setIsEditing(false);
    alert('Nomenclaturas atualizadas com sucesso!');
  };

  const handleCancel = () => {
    setTemp(nomenclaturas);
    setIsEditing(false);
  };

  if (!loaded) return null;

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} />

      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-800">📝 Nomenclaturas da Organização</h1>
            <button
              onClick={() => {
                if (isEditing) {
                  console.log('❌ Cancelando edição');
                  handleCancel();
                } else {
                  console.log('✏️ Entrando em modo edição. temp atual:', temp);
                  setIsEditing(true);
                }
              }}
              className={`px-6 py-2 rounded-lg transition font-semibold ${
                isEditing
                  ? 'bg-gray-500 text-white hover:bg-gray-600'
                  : 'bg-teal-600 text-white hover:bg-teal-700'
              }`}
            >
              {isEditing ? '❌ Cancelar' : '✏️ Editar'}
            </button>
          </div>

          {/* Explicação */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-blue-900 text-sm">
              <strong>ℹ️ Informação:</strong> Customize os nomes das divisões internas do seu ministério. 
              Essas nomenclaturas serão utilizadas em toda a plataforma e nos documentos gerados.
            </p>
          </div>

          {/* Nomenclaturas */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl">
            {/* Primeira Divisão */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>1️⃣</span> Primeira Divisão
              </h2>

              <p className="text-sm text-gray-600 mb-4">
                Nível mais alto da organização. Escolha como você deseja chamar:
              </p>

              <div className="space-y-3">
                {isEditing ? (
                  <div className="space-y-3">
                    <select
                      value={temp.divisaoPrincipal.opcao1}
                      onChange={(e) => handleSelectChange('divisaoPrincipal', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                    >
                      {Array.from(new Set([...NATIVE_OPTIONS.divisaoPrincipal, ...(temp.divisaoPrincipal.custom || [])])).map(option => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>

                    <div className="flex gap-3">
                      <input
                        autoFocus
                        type="text"
                        value={novaOpcao.divisaoPrincipal}
                        onChange={(e) => setNovaOpcao(prev => ({ ...prev, divisaoPrincipal: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddCustomOption('divisaoPrincipal');
                        }}
                        placeholder="Digite um novo valor"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                      <button
                        onClick={() => handleAddCustomOption('divisaoPrincipal')}
                        className="px-5 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition font-semibold whitespace-nowrap"
                      >
                        ➕ Adicionar
                      </button>
                    </div>

                    {(temp.divisaoPrincipal.custom || []).length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-600">Opções personalizadas:</p>
                        <div className="space-y-2">
                          {(temp.divisaoPrincipal.custom || []).map(option => (
                            <div key={option} className="flex items-center justify-between p-2 border border-gray-200 rounded-lg bg-gray-50">
                              <span className="text-sm font-semibold text-gray-800">{option}</span>
                              <button
                                onClick={() => handleDeleteCustomOption('divisaoPrincipal', option)}
                                className="text-red-500 hover:text-red-700 transition"
                                title="Remover opção personalizada"
                              >
                                🗑️
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-lg font-semibold text-teal-700">{nomenclaturas.divisaoPrincipal.opcao1}</p>
                )}
              </div>
            </div>

            {/* Segunda Divisão */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>2️⃣</span> Segunda Divisão
              </h2>

              <p className="text-sm text-gray-600 mb-4">
                Divisão intermediária. Escolha como você deseja chamar:
              </p>

              <div className="space-y-3">
                {isEditing ? (
                  <div className="space-y-3">
                    <select
                      value={temp.divisaoSecundaria.opcao1}
                      onChange={(e) => handleSelectChange('divisaoSecundaria', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                    >
                      {Array.from(new Set([...NATIVE_OPTIONS.divisaoSecundaria, ...(temp.divisaoSecundaria.custom || [])])).map(option => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>

                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={novaOpcao.divisaoSecundaria}
                        onChange={(e) => setNovaOpcao(prev => ({ ...prev, divisaoSecundaria: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddCustomOption('divisaoSecundaria');
                        }}
                        placeholder="Digite um novo valor"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                      <button
                        onClick={() => handleAddCustomOption('divisaoSecundaria')}
                        className="px-5 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition font-semibold whitespace-nowrap"
                      >
                        ➕ Adicionar
                      </button>
                    </div>

                    {(temp.divisaoSecundaria.custom || []).length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-600">Opções personalizadas:</p>
                        <div className="space-y-2">
                          {(temp.divisaoSecundaria.custom || []).map(option => (
                            <div key={option} className="flex items-center justify-between p-2 border border-gray-200 rounded-lg bg-gray-50">
                              <span className="text-sm font-semibold text-gray-800">{option}</span>
                              <button
                                onClick={() => handleDeleteCustomOption('divisaoSecundaria', option)}
                                className="text-red-500 hover:text-red-700 transition"
                                title="Remover opção personalizada"
                              >
                                🗑️
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-lg font-semibold text-teal-700">{nomenclaturas.divisaoSecundaria.opcao1}</p>
                )}
              </div>
            </div>

            {/* Terceira Divisão */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>3️⃣</span> Terceira Divisão
              </h2>

              <p className="text-sm text-gray-600 mb-4">
                Nível mais baixo. Escolha como você deseja chamar:
              </p>

              <div className="space-y-3">
                {isEditing ? (
                  <div className="space-y-3">
                    <select
                      value={temp.divisaoTerciaria.opcao1}
                      onChange={(e) => handleSelectChange('divisaoTerciaria', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                    >
                      {Array.from(new Set([...NATIVE_OPTIONS.divisaoTerciaria, ...(temp.divisaoTerciaria.custom || [])])).map(option => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>

                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={novaOpcao.divisaoTerciaria}
                        onChange={(e) => setNovaOpcao(prev => ({ ...prev, divisaoTerciaria: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddCustomOption('divisaoTerciaria');
                        }}
                        placeholder="Digite um novo valor"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                      <button
                        onClick={() => handleAddCustomOption('divisaoTerciaria')}
                        className="px-5 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition font-semibold whitespace-nowrap"
                      >
                        ➕ Adicionar
                      </button>
                    </div>

                    {(temp.divisaoTerciaria.custom || []).length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-600">Opções personalizadas:</p>
                        <div className="space-y-2">
                          {(temp.divisaoTerciaria.custom || []).map(option => (
                            <div key={option} className="flex items-center justify-between p-2 border border-gray-200 rounded-lg bg-gray-50">
                              <span className="text-sm font-semibold text-gray-800">{option}</span>
                              <button
                                onClick={() => handleDeleteCustomOption('divisaoTerciaria', option)}
                                className="text-red-500 hover:text-red-700 transition"
                                title="Remover opção personalizada"
                              >
                                🗑️
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-lg font-semibold text-teal-700">{nomenclaturas.divisaoTerciaria.opcao1}</p>
                )}
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          {isEditing && (
            <div className="flex gap-4 mt-6 max-w-6xl">
              <button
                onClick={handleSave}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
              >
                ✓ Salvar Nomenclaturas
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-semibold"
              >
                ✕ Descartar Alterações
              </button>
            </div>
          )}

          {/* Resumo */}
          {!isEditing && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mt-6 max-w-6xl">
              <h3 className="text-lg font-bold text-gray-800 mb-4">📋 Resumo Atual</h3>
              <div className="space-y-2 text-gray-700">
                <p>• <strong>Primeira Divisão:</strong> {nomenclaturas.divisaoPrincipal.opcao1}</p>
                <p>• <strong>Segunda Divisão:</strong> {nomenclaturas.divisaoSecundaria.opcao1}</p>
                <p>• <strong>Terceira Divisão:</strong> {nomenclaturas.divisaoTerciaria.opcao1}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
