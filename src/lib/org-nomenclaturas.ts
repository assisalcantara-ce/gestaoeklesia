export const NOMENCLATURAS_SCHEMA_VERSION_KEY = 'nomenclaturas_schema_version';
export const NOMENCLATURAS_SCHEMA_VERSION = '2';

export const ORG_NOMENCLATURAS_KEY = 'divisoes_organizacionais';
export const ORG_NOMENCLATURAS_SCHEMA_VERSION = 3;

export type DivisionKey = 'divisaoPrincipal' | 'divisaoSecundaria' | 'divisaoTerciaria';
export type DivisionConfig = { opcao1: string; custom?: string[] };
export type OrgNomenclaturasState = Record<DivisionKey, DivisionConfig>;

const NATIVE_OPTIONS: Record<DivisionKey, string[]> = {
	divisaoPrincipal: ['CONGREGAÇÃO', 'IGREJA', 'TEMPLO', 'NENHUMA'],
	divisaoSecundaria: ['CAMPO', 'SETOR', 'GRUPO', 'ÁREA', 'NENHUMA'],
	divisaoTerciaria: ['NENHUMA'],
};

export function getDefaultOrgNomenclaturas(): OrgNomenclaturasState {
	return {
		divisaoPrincipal: { opcao1: 'IGREJA', custom: [] },
		divisaoSecundaria: { opcao1: 'CAMPO', custom: [] },
		divisaoTerciaria: { opcao1: 'NENHUMA', custom: [] },
	};
}

function normalizeCustomList(custom: unknown): string[] {
	if (!Array.isArray(custom)) return [];
	return custom
		.map(v => (typeof v === 'string' ? v.trim() : ''))
		.filter(Boolean)
		.map(v => v.toUpperCase());
}

function normalizeDivision(key: DivisionKey, value: any, legacyThirdDivision = false): DivisionConfig {
	const native = NATIVE_OPTIONS[key];
	const base = getDefaultOrgNomenclaturas()[key];

	if (!value) return base;

	if (typeof value === 'string') {
		const selected = value.trim().toUpperCase() || base.opcao1;
		if (key === 'divisaoTerciaria') {
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
		if (legacyThirdDivision) return { opcao1: 'NENHUMA', custom: [] };
		const hasSelectedInCustom = customDedup.some(v => v.toUpperCase() === selected);
		if (!native.includes(selected) && !hasSelectedInCustom) selected = 'NENHUMA';
	}

	const all = new Set([...native, ...customDedup]);
	if (!all.has(selected) && key !== 'divisaoTerciaria') customDedup.push(selected);

	return { opcao1: selected, custom: Array.from(new Set(customDedup)) };
}

export function normalizeOrgNomenclaturas(raw: any): OrgNomenclaturasState {
	const legacyThirdDivision = !!raw?.__legacyThirdDivision;
	return {
		divisaoPrincipal: normalizeDivision('divisaoPrincipal', raw?.divisaoPrincipal, legacyThirdDivision),
		divisaoSecundaria: normalizeDivision('divisaoSecundaria', raw?.divisaoSecundaria, legacyThirdDivision),
		divisaoTerciaria: normalizeDivision('divisaoTerciaria', raw?.divisaoTerciaria, legacyThirdDivision),
	};
}

async function resolveMinistryId(supabase: any): Promise<string | null> {
	try {
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return null;

		const mu = await supabase
			.from('ministry_users')
			.select('ministry_id')
			.eq('user_id', user.id)
			.limit(1);
		const ministryIdFromMu = (mu.data as any)?.[0]?.ministry_id as string | undefined;
		if (ministryIdFromMu) return ministryIdFromMu;

		const m = await supabase.from('ministries').select('id').eq('user_id', user.id).limit(1);
		const ministryIdFromOwner = (m.data as any)?.[0]?.id as string | undefined;
		return ministryIdFromOwner || null;
	} catch {
		return null;
	}
}

function buildOrgPayload(state: OrgNomenclaturasState) {
	return {
		schemaVersion: ORG_NOMENCLATURAS_SCHEMA_VERSION,
		divisaoPrincipal: state.divisaoPrincipal,
		divisaoSecundaria: state.divisaoSecundaria,
		divisaoTerciaria: state.divisaoTerciaria,
	};
}

async function upsertOrgNomenclaturas(supabase: any, ministryId: string, state: OrgNomenclaturasState) {
	const { data: existingRow } = await supabase
		.from('configurations')
		.select('nomenclaturas')
		.eq('ministry_id', ministryId)
		.maybeSingle();

	const existingNomenclaturas = (existingRow as any)?.nomenclaturas || {};
	const payload = buildOrgPayload(state);

	await supabase
		.from('configurations')
		.upsert(
			{
				ministry_id: ministryId,
				nomenclaturas: { ...existingNomenclaturas, [ORG_NOMENCLATURAS_KEY]: payload },
				updated_at: new Date().toISOString(),
			} as any,
			{ onConflict: 'ministry_id' }
		);
}

export async function loadOrgNomenclaturasFromSupabaseOrMigrate(
	supabase: any,
	options?: { syncLocalStorage?: boolean }
): Promise<OrgNomenclaturasState> {
	const syncLocalStorage = options?.syncLocalStorage ?? true;

	try {
		const ministryId = await resolveMinistryId(supabase);
		if (!ministryId) return getDefaultOrgNomenclaturas();

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
				const normalized = normalizeOrgNomenclaturas({
					divisaoPrincipal: org?.divisaoPrincipal,
					divisaoSecundaria: org?.divisaoSecundaria,
					divisaoTerciaria: org?.divisaoTerciaria,
					__legacyThirdDivision: schemaVersion < ORG_NOMENCLATURAS_SCHEMA_VERSION,
				});

				if (syncLocalStorage && typeof window !== 'undefined') {
					try {
						localStorage.setItem('nomenclaturas', JSON.stringify(normalized));
						localStorage.setItem(NOMENCLATURAS_SCHEMA_VERSION_KEY, NOMENCLATURAS_SCHEMA_VERSION);
					} catch {
						// ignore
					}
				}

				return normalized;
			}
		}

		let nextState: OrgNomenclaturasState | null = null;

		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem('nomenclaturas');
			const version = localStorage.getItem(NOMENCLATURAS_SCHEMA_VERSION_KEY);

			if (saved) {
				try {
					let parsed = JSON.parse(saved);

					if (version !== NOMENCLATURAS_SCHEMA_VERSION) {
						parsed = {
							...parsed,
							divisaoPrincipal: parsed?.divisaoTerciaria,
							divisaoTerciaria: parsed?.divisaoPrincipal,
						};
					}

					nextState = normalizeOrgNomenclaturas({ ...parsed, __legacyThirdDivision: true });
				} catch {
					// ignore
				}
			}
		}

		if (!nextState) nextState = getDefaultOrgNomenclaturas();

		await upsertOrgNomenclaturas(supabase, ministryId, nextState);

		if (syncLocalStorage && typeof window !== 'undefined') {
			try {
				localStorage.setItem('nomenclaturas', JSON.stringify(nextState));
				localStorage.setItem(NOMENCLATURAS_SCHEMA_VERSION_KEY, NOMENCLATURAS_SCHEMA_VERSION);
			} catch {
				// ignore
			}
		}

		return nextState;
	} catch {
		return getDefaultOrgNomenclaturas();
	}
}
