'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageLayout from '@/components/PageLayout';
import Tabs from '@/components/Tabs';
import Section from '@/components/Section';
import { createClient } from '@/lib/supabase-client';
import { loadOrgNomenclaturasFromSupabaseOrMigrate } from '@/lib/org-nomenclaturas';
import { useAppDialog } from '@/providers/AppDialogProvider';

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

interface Nomenclaturas {
  divisaoPrincipal?: { opcao1: string };
  divisaoSecundaria?: { opcao1: string };
  divisaoTerciaria?: { opcao1: string };
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

export default function CongregacoesPage() {
  const router = useRouter();
  const dialog = useAppDialog();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('divisao1');
  const [nomenclaturas, setNomenclaturasState] = useState<Nomenclaturas>({
    // Divisão 1 agora usa o conteúdo que era da Divisão 3
    divisaoPrincipal: { opcao1: 'Igreja' },
    divisaoSecundaria: { opcao1: 'Campo' },
    // Divisão 3 agora usa o conteúdo que era da Divisão 1
    divisaoTerciaria: { opcao1: 'Supervisão' }
  });

  const [divisoes1, setDivisoes1] = useState<Divisao1[]>([]);
  const [divisoes2, setDivisoes2] = useState<Divisao2[]>([]);
  const [divisoes3, setDivisoes3] = useState<Divisao3[]>([]);
  const [ministryId, setMinistryId] = useState<string>('');

  // Limites do plano para divisões hierárquicas
  // -1 = ilimitado, 0 = bloqueado, N = máximo N registros
  const [planLimits, setPlanLimits] = useState({
    max_divisao1: 999, // Supervisão
    max_divisao2: 999, // Campo
    max_divisao3: -1,  // Igreja/Congregação
    planName: '',
  });

  // Associações (seleção múltipla)
  // - D2 (campos) pode receber várias D1 (congregações) via congregacoes.campo_id
  // - D3 (supervisões) pode receber várias D2 (campos) via campos.supervisao_id
  const [selectedD1IdsForD2, setSelectedD1IdsForD2] = useState<string[]>([]);
  const [selectedD2IdsForD3, setSelectedD2IdsForD3] = useState<string[]>([]);

  // Form states
  const [formD1, setFormD1] = useState({
    codigo: '',
    nome: '',
    uf: '',
    informar_supervisor: false,
    supervisor_cpf_input: '',
    supervisor_member_id: '',
    supervisor_matricula: '',
    supervisor_nome: '',
    supervisor_cpf: '',
    supervisor_data_nascimento: '',
    supervisor_cargo: '',
    supervisor_celular: ''
  });
  const [editingD1, setEditingD1] = useState<Divisao1 | null>(null);
  const [showFormD1, setShowFormD1] = useState(false);

  const [, setSupervisorStatus] = useState<'idle' | 'loading' | 'found' | 'not_found' | 'error'>('idle');
  const [, setSupervisorMsg] = useState<string>('');

  const [, setSupervisorCpfResults] = useState<MemberLookup[]>([]);
  const [, setSupervisorCpfStatus] = useState<'idle' | 'loading' | 'selected' | 'not_found' | 'error'>('idle');
  const [, setSupervisorCpfMsg] = useState<string>('');

  // Divisão 02 (Campo) - Form states
  const [formD2, setFormD2] = useState({
    supervisao_id: '',
    nome: '',
    is_sede: false,
    informar_pastor: false,
    pastor_nome_input: '',
    pastor_member_id: '',
    pastor_nome: '',
    pastor_data_posse: '',
    cep: '',
    municipio: '',
    uf: ''
  });
  const [editingD2, setEditingD2] = useState<Divisao2 | null>(null);
  const [showFormD2, setShowFormD2] = useState(false);

  const [pastorResults, setPastorResults] = useState<MemberLookup[]>([]);
  const [pastorStatus, setPastorStatus] = useState<'idle' | 'loading' | 'selected' | 'not_found' | 'error'>('idle');
  const [pastorMsg, setPastorMsg] = useState<string>('');

  const [dirigenteResults, setDirigenteResults] = useState<MemberLookup[]>([]);
  const [dirigenteStatus, setDirigenteStatus] = useState<'idle' | 'loading' | 'selected' | 'not_found' | 'error'>('idle');
  const [dirigenteMsg, setDirigenteMsg] = useState<string>('');
  const [dirigenteSelected, setDirigenteSelected] = useState<{ id: string; name: string } | null>(null);

  // Divisão 03 (Congregação) - Form states
  const [formD3, setFormD3] = useState({
    supervisao_id: '',
    campo_id: '',
    nome: '',
    dirigente: '',
    dirigente_cpf: '',
    dirigente_cargo: '',
    dirigente_matricula: '',
    endereco: '',
    cep: '',
    municipio: '',
    uf: '',
    status_imovel: '' as '' | 'PROPRIO' | 'ALUGADO' | 'CEDIDO',
    is_active: true,
  });
  const [editingD3, setEditingD3] = useState<Divisao3 | null>(null);
  const [showFormD3, setShowFormD3] = useState(false);

  type FotoIgrejaChange =
    | { kind: 'none' }
    | { kind: 'file'; file: File; previewUrl: string }
    | { kind: 'url'; url: string };

  const [fotoIgrejaChange, setFotoIgrejaChange] = useState<FotoIgrejaChange>({ kind: 'none' });
  const [fotoIgrejaUrlInput, setFotoIgrejaUrlInput] = useState('');

  const [geoPreview, setGeoPreview] = useState<{ latitude: number; longitude: number; address: string } | null>(null);
  const [lastCepAutofill, setLastCepAutofill] = useState<string>('');

  const buildGeocodeQuery = (opts: { endereco: string; municipio: string; uf: string; cepDigits: string }) => {
    return [opts.endereco, opts.municipio, opts.uf, opts.cepDigits, 'Brasil']
      .map(v => (v || '').trim())
      .filter(Boolean)
      .join(', ');
  };

  const geocodeFromAddress = async (
    address: string,
    signal?: AbortSignal
  ): Promise<{ latitude: number; longitude: number } | null> => {
    const q = address.trim();
    if (!q) return null;

    // Se for um CEP (8 dígitos), use o parâmetro postalcode (melhor assertividade)
    const qDigits = onlyDigits(q);
    const isLikelyCep = qDigits.length === 8 && q.replace(/\D/g, '').length === 8;

    try {
      const url = isLikelyCep
        ? `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(qDigits)}&country=${encodeURIComponent('Brazil')}&format=json&limit=1`
        : `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
      const res = await fetch(url, signal ? { signal } : undefined);
      if (!res.ok) return null;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return null;
      const latitude = Number.parseFloat(data[0]?.lat);
      const longitude = Number.parseFloat(data[0]?.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
      return { latitude, longitude };
    } catch {
      return null;
    }
  };

  // Geolocalização: gerar preview automaticamente ao digitar o endereço (debounce + abort).
  useEffect(() => {
    if (!showFormD3) return;

    const enderecoTrim = (formD3.endereco || '').trim();
    const municipioTrim = (formD3.municipio || '').trim();
    const ufTrim = (formD3.uf || '').trim().toUpperCase();
    const cepDigits = onlyDigits(formD3.cep);

    // Permite geocode só com CEP (8 dígitos) ou (município + UF).
    // Isso atende o caso comum: usuário digita o CEP e espera a geolocalização preencher.
    const hasEnoughForGeocode = !!(
      (cepDigits && cepDigits.length === 8) ||
      (municipioTrim && ufTrim) ||
      (enderecoTrim && (municipioTrim || ufTrim || cepDigits))
    );
    if (!hasEnoughForGeocode) {
      setGeoPreview(null);
      return;
    }

    const addressForGeocode = buildGeocodeQuery({
      endereco: enderecoTrim,
      municipio: municipioTrim,
      uf: ufTrim,
      cepDigits,
    });

    const timer = window.setTimeout(() => {
      const controller = new AbortController();
      const signal = controller.signal;

      let cancelled = false;
      (async () => {
        const coords = await geocodeFromAddress(addressForGeocode, signal);
        if (cancelled) return;
        if (coords) {
          setGeoPreview({ ...coords, address: addressForGeocode });
        } else {
          setGeoPreview(null);
        }
      })();

      // Cleanup do timeout não tem acesso ao controller; então retornamos cleanup separado abaixo.
      // (A cada alteração de campos, o efeito roda novamente e aborta a request anterior.)
      (window as any).__geoAbortController__ = controller;

      return () => {
        cancelled = true;
        try { controller.abort(); } catch { /* noop */ }
      };
    }, 700);

    return () => {
      window.clearTimeout(timer);
      const prev = (window as any).__geoAbortController__ as AbortController | undefined;
      if (prev) {
        try { prev.abort(); } catch { /* noop */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFormD3, formD3.endereco, formD3.municipio, formD3.uf, formD3.cep]);

  // CEP autocomplete (ViaCEP): ao digitar 8 dígitos, completa endereço/município/UF.
  useEffect(() => {
    if (!showFormD3) return;

    const cepDigits = onlyDigits(formD3.cep);
    if (!cepDigits || cepDigits.length !== 8) return;
    if (cepDigits === lastCepAutofill) return;

    const timer = window.setTimeout(() => {
      const controller = new AbortController();
      const signal = controller.signal;

      (async () => {
        try {
          const resp = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`, { signal });
          if (!resp.ok) return;
          const data = await resp.json().catch(() => null as any);
          if (!data || data.erro) return;

          const logradouro = String(data.logradouro || '').trim();
          const bairro = String(data.bairro || '').trim();
          const localidade = String(data.localidade || '').trim();
          const uf = String(data.uf || '').trim().toUpperCase();
          const enderecoAutofill = [logradouro, bairro].filter(Boolean).join(' - ');

          setFormD3(prev => {
            const prevEndereco = (prev.endereco || '').trim();
            const nextEndereco = prevEndereco ? prevEndereco : enderecoAutofill;
            return {
              ...prev,
              endereco: nextEndereco,
              municipio: localidade || prev.municipio,
              uf: uf ? uf.slice(0, 2) : prev.uf,
            };
          });

          setGeoPreview(null);
          setLastCepAutofill(cepDigits);
        } catch {
          // silencioso (autocomplete best-effort)
        }
      })();

      (window as any).__cepAbortController__ = controller;
    }, 600);

    return () => {
      window.clearTimeout(timer);
      const prev = (window as any).__cepAbortController__ as AbortController | undefined;
      if (prev) {
        try { prev.abort(); } catch { /* noop */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFormD3, formD3.cep]);

  // Divisao 02 nao usa geolocalizacao.

  const getNextCodigo = () => {
    const codigos = divisoes1
      .map(d => (typeof d.codigo === 'number' ? d.codigo : null))
      .filter((v): v is number => v !== null && Number.isFinite(v));
    const max = codigos.length ? Math.max(...codigos) : 0;
    return max + 1;
  };

  // Garantir que o ID (código) apareça automaticamente ao abrir o formulário
  useEffect(() => {
    if (!showFormD1) return;
    if (editingD1) return;
    if (formD1.codigo) return;
    setFormD1(prev => ({ ...prev, codigo: String(getNextCodigo()) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFormD1, editingD1, divisoes1.length]);

  const nomeD1 = nomenclaturas.divisaoPrincipal?.opcao1 || 'Supervisão';
  const nomeD2 = nomenclaturas.divisaoSecundaria?.opcao1 || 'Campo';
  const nomeD3 = nomenclaturas.divisaoTerciaria?.opcao1 || 'Congregação';

  const normalizeLabel = (label: string) => label.trim().toUpperCase();
  const isEnabledDivision = (label: string) => normalizeLabel(label) !== 'NENHUMA';

  const d1Enabled = isEnabledDivision(nomeD1);
  const d2Enabled = isEnabledDivision(nomeD2);
  const d3Enabled = isEnabledDivision(nomeD3);

  const enabledTabIds = [
    d1Enabled ? 'divisao1' : null,
    d2Enabled ? 'divisao2' : null,
    d3Enabled ? 'divisao3' : null
  ].filter(Boolean) as string[];

  useEffect(() => {
    if (enabledTabIds.length === 0) return;
    if (!enabledTabIds.includes(activeTab)) {
      setActiveTab(enabledTabIds[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d1Enabled, d2Enabled, d3Enabled]);

  // Inicializar cliente Supabase (singleton)
  const supabase = createClient();

  // Ao trocar de aba, não manter formulários abertos.
  useEffect(() => {
    if (activeTab !== 'divisao1') {
      setShowFormD1(false);
      setEditingD1(null);
      setSupervisorStatus('idle');
      setSupervisorMsg('');
    }

    if (activeTab !== 'divisao2') {
      setShowFormD2(false);
      setEditingD2(null);
      setPastorResults([]);
      setPastorStatus('idle');
      setPastorMsg('');
    }

    if (activeTab !== 'divisao3') {
      setShowFormD3(false);
      setEditingD3(null);
    }
  }, [activeTab]);

  useEffect(() => {
    const initPage = async () => {
      try {
        // Obter usuário
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }

        // Carregar nomenclaturas a partir do Supabase (com fallback/migração controlados)
        const orgNomenclaturas = await loadOrgNomenclaturasFromSupabaseOrMigrate(supabase);
        setNomenclaturasState(orgNomenclaturas);

        if (user) {
          let resolvedMinistryId: string | null = null;

          // 1) Usuário associado via ministry_users (padrão multi-tenant)
          const { data: mu, error: muErr } = await supabase
            .from('ministry_users')
            .select('ministry_id')
            .eq('user_id', user.id)
            .maybeSingle();

          if (!muErr && mu?.ministry_id) {
            resolvedMinistryId = mu.ministry_id as any;
          }

          // 2) Fallback: usuário owner na tabela ministries
          if (!resolvedMinistryId) {
            const { data: ministries, error: mErr } = await supabase
              .from('ministries')
              .select('id')
              .eq('user_id', user.id)
              .maybeSingle();

            if (!mErr && ministries?.id) {
              resolvedMinistryId = ministries.id as any;
            }
          }

          if (resolvedMinistryId) {
            setMinistryId(resolvedMinistryId);

            // Carregar limites do plano
            const FALLBACK_LIMITS: Record<string, { max_divisao1: number; max_divisao2: number; max_divisao3: number }> = {
              basic:         { max_divisao1: 5,   max_divisao2: 0,  max_divisao3: 0  },
              starter:       { max_divisao1: 10,  max_divisao2: 1,  max_divisao3: -1 },
              intermediario: { max_divisao1: 25,  max_divisao2: 3,  max_divisao3: -1 },
              profissional:  { max_divisao1: 50,  max_divisao2: 10, max_divisao3: -1 },
              expert:        { max_divisao1: 100, max_divisao2: 20, max_divisao3: -1 },
            };

            try {
              const { data: ministryRow } = await supabase
                .from('ministries')
                .select('subscription_plan_id, plan_id')
                .eq('id', resolvedMinistryId)
                .maybeSingle();

              let limits = { max_divisao1: 999, max_divisao2: 999, max_divisao3: -1 };
              let planName = '';

              if ((ministryRow as any)?.subscription_plan_id) {
                const { data: planRow } = await supabase
                  .from('subscription_plans')
                  .select('max_divisao1, max_divisao2, max_divisao3, name')
                  .eq('id', (ministryRow as any).subscription_plan_id)
                  .maybeSingle();
                if (planRow) {
                  limits = {
                    max_divisao1: (planRow as any).max_divisao1 ?? 999,
                    max_divisao2: (planRow as any).max_divisao2 ?? 999,
                    max_divisao3: (planRow as any).max_divisao3 ?? -1,
                  };
                  planName = (planRow as any).name || '';
                }
              } else if ((ministryRow as any)?.plan_id) {
                const slug = String((ministryRow as any).plan_id).toLowerCase();
                const fb = FALLBACK_LIMITS[slug];
                if (fb) { limits = fb; planName = (ministryRow as any).plan_id; }
              }

              setPlanLimits({ ...limits, planName });
            } catch { /* sem limites adicionais */ }

            // Carregar dados do Supabase
            await Promise.all([
              loadDivisoes1(resolvedMinistryId),
              loadDivisoes2(resolvedMinistryId),
              loadDivisoes3(resolvedMinistryId),
            ]);
          }
        }

        setLoading(false);
      } catch (error) {
        console.error('Erro ao inicializar página:', error);
        setLoading(false);
      }
    };

    initPage();
  }, [router]);

  const onlyDigits = (value: string) => (value || '').replace(/\D/g, '');

  const getAccessToken = async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  };

  const compressImageToJpeg = async (file: File, maxBytes: number): Promise<File> => {
    const bitmap = await createImageBitmap(file);
    const maxSide = 1280;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const targetW = Math.max(1, Math.round(bitmap.width * scale));
    const targetH = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas não suportado');
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);

    const toBlob = (quality: number) =>
      new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Falha ao gerar imagem'))),
          'image/jpeg',
          quality
        );
      });

    let quality = 0.82;
    let blob = await toBlob(quality);
    while (blob.size > maxBytes && quality > 0.5) {
      quality = Math.max(0.5, quality - 0.08);
      blob = await toBlob(quality);
    }

    const outName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], outName, { type: 'image/jpeg' });
  };

  const uploadFotoIgreja = async (file: File, congregacaoId: string) => {
    const token = await getAccessToken();
    if (!token) throw new Error('Sessão expirada. Faça login novamente.');

    const compressed = await compressImageToJpeg(file, 600 * 1024);

    const form = new FormData();
    form.append('file', compressed);
    form.append('congregacaoId', congregacaoId);

    const resp = await fetch('/api/v1/secretaria/uploads/igreja-foto', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    const json = await resp.json().catch(() => null as any);
    if (!resp.ok) {
      const msg = json?.error || 'Falha ao enviar foto.';
      throw new Error(msg);
    }

    if (!json?.url || !json?.bucket || !json?.path) {
      throw new Error('Resposta inválida do upload.');
    }

    return { url: String(json.url), bucket: String(json.bucket), path: String(json.path) };
  };

  const deleteFotoIgreja = async (bucket: string, path: string) => {
    const token = await getAccessToken();
    if (!token) return;

    await fetch('/api/v1/secretaria/uploads/igreja-foto', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ bucket, path }),
    }).catch(() => null);
  };

  const formatCpf = (cpf: string) => {
    const digits = onlyDigits(cpf);
    if (digits.length !== 11) return cpf;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  };

  const getMinisterCargo = (member: MemberLookup) => {
    const cf = member.custom_fields || {};
    return (
      member.role ||
      cf.cargo ||
      cf.função ||
      cf.funcao ||
      ''
    );
  };

  const getMemberMatricula = (member: MemberLookup) => {
    const cf = member.custom_fields || {};
    return (
      (cf as any).matricula ||
      (cf as any).matrícula ||
      (cf as any).registration ||
      (cf as any).registro ||
      ''
    );
  };

  const isMinisterMember = (member: MemberLookup | null) => {
    if (!member) return false;
    const tipoCadastroRaw = (member.custom_fields as any)?.tipoCadastro ?? (member.custom_fields as any)?.tipo_cadastro;
    const tipoCadastro = String(tipoCadastroRaw || '').trim().toLowerCase();

    // Fonte oficial: select "Tipo de Cadastro" no cadastro de membros
    if (tipoCadastro) {
      return tipoCadastro === 'ministro' || tipoCadastro.includes('ministro');
    }

    // Fallback para bases antigas (sem tipoCadastro preenchido)
    const cargo = String(getMinisterCargo(member) || '').trim();
    return !!cargo;
  };

  const buscarMinistrosPorCpfPrefixo = async (cpfInput: string) => {
    const cpfDigits = onlyDigits(cpfInput);
    if (!ministryId) return;
    if (cpfDigits.length < 3 || cpfDigits.length >= 11) {
      setSupervisorCpfResults([]);
      setSupervisorCpfStatus('idle');
      setSupervisorCpfMsg('');
      return;
    }

    try {
      setSupervisorCpfStatus('loading');
      setSupervisorCpfMsg('Buscando sugestões...');

      const selectFields = 'id, name, cpf, data_nascimento, role, profissao, phone, custom_fields';
      const { data, error } = await supabase
        .from('members')
        .select(selectFields)
        .eq('ministry_id', ministryId)
        .like('cpf', `${cpfDigits}%`)
        .limit(8)
        .order('cpf');

      if (error) throw error;

      const all = ((data as any) || []) as MemberLookup[];
      const ministros = all.filter(m => m && m.cpf && isMinisterMember(m));

      if (!ministros.length) {
        setSupervisorCpfResults([]);
        setSupervisorCpfStatus('not_found');
        setSupervisorCpfMsg('Nenhum ministro encontrado com este início de CPF.');
        return;
      }

      setSupervisorCpfResults(ministros);
      setSupervisorCpfStatus('idle');
      setSupervisorCpfMsg('');
    } catch (error) {
      console.error('Erro ao buscar sugestões de CPF do supervisor:', error);
      setSupervisorCpfResults([]);
      setSupervisorCpfStatus('error');
      setSupervisorCpfMsg('Erro ao buscar sugestões.');
    }
  };

  const buscarSupervisorPorCpf = async (cpfInput: string) => {
    const cpfDigits = onlyDigits(cpfInput);
    if (!ministryId) return;

    if (cpfDigits.length !== 11) {
      setSupervisorStatus('idle');
      setSupervisorMsg('');
      setFormD1(prev => ({
        ...prev,
        supervisor_member_id: '',
        supervisor_matricula: '',
        supervisor_nome: '',
        supervisor_cpf: '',
        supervisor_data_nascimento: '',
        supervisor_cargo: '',
        supervisor_celular: ''
      }));
      return;
    }

    try {
      setSupervisorStatus('loading');
      setSupervisorMsg('Aguardando dados...');

      const selectFields = 'id, name, cpf, data_nascimento, role, profissao, phone, custom_fields';
      const { data: dataDigits, error: errDigits } = await supabase
        .from('members')
        .select(selectFields)
        .eq('ministry_id', ministryId)
        .eq('cpf', cpfDigits)
        .maybeSingle();

      if (errDigits) throw errDigits;

      let member: MemberLookup | null = (dataDigits as any) || null;
      if (!member) {
        const cpfRaw = (cpfInput || '').trim();
        if (cpfRaw && cpfRaw !== cpfDigits) {
          const { data: dataRaw, error: errRaw } = await supabase
            .from('members')
            .select(selectFields)
            .eq('ministry_id', ministryId)
            .eq('cpf', cpfRaw)
            .maybeSingle();
          if (errRaw) throw errRaw;
          member = (dataRaw as any) || null;
        }
      }

      if (!member) {
        setSupervisorStatus('not_found');
        setSupervisorMsg('Ministro não encontrado para este CPF.');
        setFormD1(prev => ({
          ...prev,
          supervisor_member_id: '',
          supervisor_matricula: '',
          supervisor_nome: '',
          supervisor_cpf: '',
          supervisor_data_nascimento: '',
          supervisor_cargo: '',
          supervisor_celular: ''
        }));
        return;
      }

      if (!isMinisterMember(member)) {
        setSupervisorStatus('not_found');
        setSupervisorMsg('Ministro não encontrado para este CPF.');
        setFormD1(prev => ({
          ...prev,
          supervisor_member_id: '',
          supervisor_matricula: '',
          supervisor_nome: '',
          supervisor_cpf: '',
          supervisor_data_nascimento: '',
          supervisor_cargo: '',
          supervisor_celular: ''
        }));
        return;
      }

      const matricula =
        (member.custom_fields && (member.custom_fields.matricula || member.custom_fields.matrícula)) ||
        (member.custom_fields && (member.custom_fields.registration || member.custom_fields.registro)) ||
        '';

      const cargo =
        member.role ||
        member.profissao ||
        (member.custom_fields && (member.custom_fields.cargo || member.custom_fields.função || member.custom_fields.funcao)) ||
        '';

      const celular =
        member.phone ||
        (member.custom_fields && (member.custom_fields.celular || member.custom_fields.whatsapp)) ||
        '';

      setFormD1(prev => ({
        ...prev,
        supervisor_member_id: member.id,
        supervisor_matricula: String(matricula || ''),
        supervisor_nome: member.name || '',
        supervisor_cpf: member.cpf || cpfDigits,
        supervisor_data_nascimento: member.data_nascimento || '',
        supervisor_cargo: String(cargo || ''),
        supervisor_celular: String(celular || '')
      }));

      setSupervisorStatus('found');
      setSupervisorMsg('Supervisor encontrado.');
    } catch (error: any) {
      console.error('Erro ao buscar supervisor por CPF:', error);
      setSupervisorStatus('error');
      setSupervisorMsg('Erro ao buscar supervisor.');
    }
  };

  useEffect(() => {
    if (!showFormD1) return;
    if (!formD1.supervisor_cpf_input) return;

    const t = setTimeout(() => {
      buscarSupervisorPorCpf(formD1.supervisor_cpf_input);
    }, 450);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formD1.supervisor_cpf_input, showFormD1, ministryId]);

  useEffect(() => {
    if (!showFormD1) {
      setSupervisorCpfResults([]);
      setSupervisorCpfStatus('idle');
      setSupervisorCpfMsg('');
      return;
    }

    if (!ministryId) return;

    const digits = onlyDigits(formD1.supervisor_cpf_input);
    if (digits.length < 3 || digits.length >= 11) {
      setSupervisorCpfResults([]);
      setSupervisorCpfStatus('idle');
      setSupervisorCpfMsg('');
      return;
    }

    const t = setTimeout(() => {
      buscarMinistrosPorCpfPrefixo(formD1.supervisor_cpf_input);
    }, 300);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formD1.supervisor_cpf_input, showFormD1, ministryId]);

  const loadDivisoes1 = async (ministryId: string) => {
    try {
      const { data, error } = await supabase
        .from('supervisoes')
        .select('*')
        .eq('ministry_id', ministryId)
        .order('nome');
      
      if (error) throw error;
      setDivisoes1(data || []);
    } catch (error) {
      setDivisoes1([]);
      const msg = (error as any)?.message || (error as any)?.error_description || '';
      console.warn('Falha ao carregar divisões (Divisão 01).', msg || error);
    }
  };

  const loadDivisoes2 = async (ministryId: string) => {
    try {
      const { data, error } = await supabase
        .from('campos')
        .select('*')
        .eq('ministry_id', ministryId)
        .order('nome');

      if (error) throw error;
      setDivisoes2((data as any) || []);
    } catch (error) {
      setDivisoes2([] as any);
      const msg = (error as any)?.message || (error as any)?.error_description || '';
      console.warn('Falha ao carregar divisões (Divisão 02).', msg || error);
    }
  };

  const loadDivisoes3 = async (ministryId: string) => {
    try {
      const { data, error } = await supabase
        .from('congregacoes')
        .select('*')
        .eq('ministry_id', ministryId)
        .order('nome');

      if (error) throw error;
      setDivisoes3((data as any) || []);
    } catch (error) {
      setDivisoes3([] as any);
      const msg = (error as any)?.message || (error as any)?.error_description || '';
      console.warn('Falha ao carregar divisões (Divisão 03).', msg || error);
    }
  };

  const formatSupervisaoLabel = (s: Divisao1) => {
    const codigo = typeof s.codigo === 'number' && Number.isFinite(s.codigo) ? s.codigo : null;
    return codigo ? `${codigo}-${s.nome}` : s.nome;
  };

  const formatCampoLabel = (c: Divisao2) => {
    if (!d3Enabled) return c.nome;
    if (!c.supervisao_id) return c.nome;
    const sup = divisoes1.find(s => s.id === c.supervisao_id) || null;
    return sup ? `${formatSupervisaoLabel(sup)} — ${c.nome}` : c.nome;
  };

  const buscarPastorPorNome = async (term: string) => {
    if (!ministryId) return;

    const q = (term || '').trim();
    if (q.length < 2) {
      setPastorResults([]);
      setPastorStatus('idle');
      setPastorMsg('');
      return;
    }

    try {
      setPastorStatus('loading');
      setPastorMsg('Buscando...');

      const { data, error } = await supabase
        .from('members')
        .select('id, name, cpf, data_nascimento, role, profissao, phone, custom_fields')
        .eq('ministry_id', ministryId)
        .ilike('name', `%${q}%`)
        .limit(7);

      if (error) throw error;

      const results = ((data as any) || []) as MemberLookup[];
      setPastorResults(results);

      if (!results.length) {
        setPastorStatus('not_found');
        setPastorMsg('Nenhum membro encontrado com este nome.');
      } else {
        setPastorStatus('idle');
        setPastorMsg('');
      }
    } catch (error: any) {
      console.error('Erro ao buscar pastor por nome:', error);
      setPastorResults([]);
      setPastorStatus('error');
      setPastorMsg('Erro ao buscar pastor.');
    }
  };

  useEffect(() => {
    if (!showFormD2) return;
    if (!formD2.informar_pastor) return;

    const t = setTimeout(() => {
      buscarPastorPorNome(formD2.pastor_nome_input);
    }, 350);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formD2.pastor_nome_input, formD2.informar_pastor, showFormD2, ministryId]);

  const buscarDirigentePorNome = async (term: string) => {
    if (!ministryId) return;

    const q = (term || '').trim();
    if (q.length < 2) {
      setDirigenteResults([]);
      setDirigenteStatus('idle');
      setDirigenteMsg('');
      return;
    }

    // Se já está selecionado e o texto bate, não precisa buscar de novo.
    if (dirigenteSelected && q === dirigenteSelected.name) return;

    try {
      setDirigenteStatus('loading');
      setDirigenteMsg('Buscando...');

      const { data, error } = await supabase
        .from('members')
        .select('id, name, cpf, data_nascimento, role, profissao, phone, custom_fields')
        .eq('ministry_id', ministryId)
        .ilike('name', `%${q}%`)
        .limit(8);

      if (error) throw error;

      const results = (((data as any) || []) as MemberLookup[])
        .filter(Boolean)
        .filter(isMinisterMember);

      setDirigenteResults(results);

      if (!results.length) {
        setDirigenteStatus('not_found');
        setDirigenteMsg('Nenhum ministro encontrado com este nome.');
      } else {
        setDirigenteStatus('idle');
        setDirigenteMsg('');
      }
    } catch (error: any) {
      console.error('Erro ao buscar dirigente por nome:', error);
      setDirigenteResults([]);
      setDirigenteStatus('error');
      setDirigenteMsg('Erro ao buscar dirigente.');
    }
  };

  useEffect(() => {
    if (!showFormD3) {
      setDirigenteResults([]);
      setDirigenteStatus('idle');
      setDirigenteMsg('');
      setDirigenteSelected(null);
      return;
    }

    if (!ministryId) return;

    const q = (formD3.dirigente || '').trim();
    if (dirigenteSelected && q === dirigenteSelected.name) return;

    const t = setTimeout(() => {
      buscarDirigentePorNome(formD3.dirigente);
    }, 350);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formD3.dirigente, showFormD3, ministryId, dirigenteSelected?.name]);

  const handleSaveD2 = async () => {
    if (!ministryId) {
      await dialog.alert({ title: 'Aguarde', message: 'Ainda estamos carregando o ministério do usuário.', type: 'info' });
      return;
    }

    if (!formD2.nome.trim()) {
      await dialog.alert({ title: 'Atenção', type: 'warning', message: 'Por favor, preencha o nome.' });
      return;
    }

    // Verificar limite do plano para 2ª divisão
    if (!editingD2) {
      if (planLimits.max_divisao2 === 0) {
        await dialog.alert({ title: 'Limite do Plano', type: 'error', message: `O plano atual não permite criação de ${nomeD2}. Faça upgrade para habilitar esta divisão.` });
        return;
      }
      if (planLimits.max_divisao2 > 0 && divisoes2.length >= planLimits.max_divisao2) {
        await dialog.alert({ title: 'Limite do Plano', type: 'error', message: `Limite atingido: o plano permite até ${planLimits.max_divisao2} ${nomeD2}(s). Faça upgrade para adicionar mais.` });
        return;
      }
    }


    // Regra nova: D2 não depende de existir D1.
    // Se houver divisão 3 (Supervisão) habilitada, o vínculo é opcional.
    if (d3Enabled && formD2.is_sede && !formD2.supervisao_id) {
      await dialog.alert({ title: 'Atenção', type: 'warning', message: `Selecione a ${nomeD3} para definir o campo sede.` });
      return;
    }

    if (formD2.informar_pastor) {
      if (!formD2.pastor_member_id) {
        await dialog.alert({ title: 'Atenção', type: 'warning', message: 'Selecione o Pastor do Campo a partir da busca por nome.' });
        return;
      }
      if (!formD2.pastor_data_posse) {
        await dialog.alert({ title: 'Atenção', type: 'warning', message: 'Informe a Data da posse.' });
        return;
      }
    }

    const payload: any = {
      ministry_id: ministryId,
      supervisao_id: d3Enabled ? (formD2.supervisao_id || null) : null,
      nome: formD2.nome.trim(),
      is_sede: d3Enabled ? !!formD2.is_sede : false,
      pastor_member_id: formD2.informar_pastor ? (formD2.pastor_member_id || null) : null,
      pastor_nome: formD2.informar_pastor ? (formD2.pastor_nome || formD2.pastor_nome_input || null) : null,
      pastor_data_posse: formD2.informar_pastor ? (formD2.pastor_data_posse || null) : null,
      updated_at: new Date().toISOString()
    };

    try {
      // Se marcar como sede, desmarcar os demais da mesma supervisão (best-effort)
      if (d3Enabled && payload.is_sede && payload.supervisao_id) {
        await supabase
          .from('campos')
          .update({ is_sede: false, updated_at: new Date().toISOString() })
          .eq('ministry_id', ministryId)
          .eq('supervisao_id', payload.supervisao_id);
      }

      let campoId = editingD2?.id || null;

      if (editingD2) {
        const { error } = await supabase
          .from('campos')
          .update(payload)
          .eq('id', editingD2.id)
          .eq('ministry_id', ministryId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('campos')
          .insert([{ ...payload }])
          .select('id')
          .single();
        if (error) throw error;
        campoId = (data as any)?.id || null;
      }

      const isMissingCongregacoesTableError = (err: any) => {
        const text = String(err?.message || err?.details || err?.hint || err || '');
        return /public\.congregacoes/i.test(text) && /could not find the table|schema cache|PGRST205/i.test(text);
      };

      // Associações D1 -> D2 (best-effort)
      if (campoId) {
        const nowIso = new Date().toISOString();
        const existing = divisoes3
          .filter(cg => cg.campo_id === campoId)
          .map(cg => cg.id);
        const availableIds = new Set(
          divisoes3
            .filter(cg => !cg.campo_id || cg.campo_id === campoId)
            .map(cg => cg.id)
        );
        const selected = selectedD1IdsForD2.filter(id => availableIds.has(id));
        const toAdd = selected.filter(id => !existing.includes(id));
        const toRemove = existing.filter(id => !selected.includes(id));

        if (toAdd.length) {
          const { error: addErr } = await supabase
            .from('congregacoes')
            .update({ campo_id: campoId, updated_at: nowIso })
            .eq('ministry_id', ministryId)
            .in('id', toAdd);
          if (addErr) {
            if (isMissingCongregacoesTableError(addErr)) {
              console.warn('Tabela public.congregacoes ausente; associação D1 -> D2 ignorada neste ambiente.');
            } else {
              throw addErr;
            }
          }
        }

        if (toRemove.length) {
          const { error: removeErr } = await supabase
            .from('congregacoes')
            .update({ campo_id: null, updated_at: nowIso })
            .eq('ministry_id', ministryId)
            .eq('campo_id', campoId)
            .in('id', toRemove);
          if (removeErr) {
            if (isMissingCongregacoesTableError(removeErr)) {
              console.warn('Tabela public.congregacoes ausente; desassociação D1 -> D2 ignorada neste ambiente.');
            } else {
              throw removeErr;
            }
          }
        }
      }

      await loadDivisoes2(ministryId);
      await loadDivisoes3(ministryId);

      setFormD2({
        supervisao_id: '',
        nome: '',
        is_sede: false,
        informar_pastor: false,
        pastor_nome_input: '',
        pastor_member_id: '',
        pastor_nome: '',
        pastor_data_posse: '',
        cep: '',
        municipio: '',
        uf: ''
      });
      setPastorResults([]);
      setPastorStatus('idle');
      setPastorMsg('');
      setSelectedD1IdsForD2([]);
      setEditingD2(null);
      setShowFormD2(false);
    } catch (error) {
      const err: any = error as any;
      const fallbackRaw = (() => {
        try {
          if (typeof error === 'string') return error;
          if (error instanceof Error) return error.message || error.name;
          if (error && typeof error === 'object') return JSON.stringify(error);
          return String(error || '');
        } catch {
          return '';
        }
      })();
      const parts = [
        err?.code ? `(${String(err.code)})` : '',
        err?.message ? String(err.message) : '',
        err?.details ? String(err.details) : '',
        err?.hint ? String(err.hint) : '',
        fallbackRaw
      ].filter(Boolean);
      const debugMsg = parts.join(' ');

      console.error('Erro ao salvar divisão 02:', {
        code: err?.code,
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        raw: error,
        rawKeys: err ? Object.getOwnPropertyNames(err) : null,
      });

      const missingTableMatch = debugMsg.match(/table\s+'([^']+)'/i);
      const missingTableName = missingTableMatch?.[1] || '';
      const tableMissing = /could not find the table|schema cache|PGRST205/i.test(debugMsg) && !!missingTableName;

      await dialog.alert({
        title: 'Erro',
        type: 'error',
        message: tableMissing
          ? `Erro ao salvar: a tabela ${missingTableName} não existe neste banco. Aplique as migrações pendentes da Estrutura Hierárquica e tente novamente.`
          : (debugMsg ? `Erro ao salvar: ${debugMsg}` : 'Erro ao salvar. Tente novamente.'),
      });
    }
  };

  const handleDeleteD2 = async (id: string) => {
    const ok = await dialog.confirm({ title: 'Confirmar', type: 'warning', message: 'Tem certeza que deseja deletar?', confirmText: 'OK', cancelText: 'Cancelar' });
    if (!ok) return;
    try {
      const { error } = await supabase
        .from('campos')
        .delete()
        .eq('id', id)
        .eq('ministry_id', ministryId);
      if (error) throw error;
      await loadDivisoes2(ministryId);
    } catch (error) {
      console.error('Erro ao deletar divisão 02:', error);
      await dialog.alert({ title: 'Erro', type: 'error', message: 'Erro ao deletar. Tente novamente.' });
    }
  };

  const handleSaveD3 = async () => {
    if (!ministryId) {
      await dialog.alert({ title: 'Aguarde', message: 'Ainda estamos carregando o ministério do usuário.', type: 'info' });
      return;
    }

    if (!formD3.nome.trim()) {
      await dialog.alert({ title: 'Atenção', message: 'Por favor, preencha o nome.', type: 'warning' });
      return;
    }

    // Verificar limite do plano para 3ª divisão (Igreja/Congregação)
    if (!editingD3) {
      if (planLimits.max_divisao3 === 0) {
        await dialog.alert({ title: 'Limite do Plano', type: 'error', message: `O plano atual não permite criação de ${nomeD1}. Faça upgrade para habilitar esta divisão.` });
        return;
      }
      if (planLimits.max_divisao3 > 0 && divisoes3.length >= planLimits.max_divisao3) {
        await dialog.alert({ title: 'Limite do Plano', type: 'error', message: `Limite atingido: o plano permite até ${planLimits.max_divisao3} ${nomeD1}(s). Faça upgrade para adicionar mais.` });
        return;
      }
    }

    if (!formD3.status_imovel) {
      await dialog.alert({ title: 'Atenção', message: 'Por favor, selecione o status do imóvel.', type: 'warning' });
      return;
    }

    const uf = (formD3.uf || '').trim().toUpperCase();
    if (uf && uf.length !== 2) {
      await dialog.alert({ title: 'Atenção', message: 'UF inválida. Informe 2 letras (ou deixe em branco).', type: 'warning' });
      return;
    }

    const cepDigits = onlyDigits(formD3.cep);
    if (cepDigits && cepDigits.length !== 8) {
      await dialog.alert({ title: 'Atenção', message: 'CEP inválido. Informe 8 dígitos (ou deixe em branco).', type: 'warning' });
      return;
    }

    // Regra nova: D1 (que usa este formulário) não depende de existir D2/D3.
    // Vínculos (campo/supervisão) são opcionais.

    const enderecoTrim = (formD3.endereco || '').trim();
    const dirigenteTrim = (formD3.dirigente || '').trim();
    const dirigenteCpfTrim = (formD3.dirigente_cpf || '').trim();
    const dirigenteCargoTrim = (formD3.dirigente_cargo || '').trim();
    const dirigenteMatriculaTrim = (formD3.dirigente_matricula || '').trim();
    const municipioTrim = (formD3.municipio || '').trim();

    const payload: any = {
      ministry_id: ministryId,
      nome: formD3.nome.trim(),
      dirigente: dirigenteTrim || null,
      dirigente_cpf: dirigenteCpfTrim || null,
      dirigente_cargo: dirigenteCargoTrim || null,
      dirigente_matricula: dirigenteMatriculaTrim || null,
      endereco: enderecoTrim || null,
      cidade: municipioTrim || null,
      uf: uf || null,
      cep: cepDigits || null,
      status_imovel: formD3.status_imovel || null,
      updated_at: new Date().toISOString(),
    };

    // Só enviar supervisao_id quando houver valor (evita erro em bases legadas / coluna ausente)
    // Observação: neste formulário (Igreja) os vínculos são opcionais.
    const supervisaoIdToSave = d2Enabled
      ? null
      : (d3Enabled ? (formD3.supervisao_id || null) : null);
    if (supervisaoIdToSave) {
      payload.supervisao_id = supervisaoIdToSave;
    }

    // Só enviar campo_id quando houver valor (evita erro em bases antigas / colunas ausentes)
    if (d2Enabled && formD3.campo_id) {
      payload.campo_id = formD3.campo_id;
    }

    // Se D2 está habilitado e D1 também, inferir supervisao_id a partir do campo (para facilitar filtros)
    if (d2Enabled && d3Enabled && payload.campo_id) {
      const campo = divisoes2.find(c => c.id === payload.campo_id) || null;
      payload.supervisao_id = campo?.supervisao_id || null;
    }

    const getMissingColumnFromError = (err: any): string | null => {
      const msg = String(err?.message || err?.error_description || '');
      const m = msg.match(/Could not find the '([^']+)' column/i);
      return m?.[1] ? String(m[1]) : null;
    };

    const formatDbError = (err: any) => {
      if (!err) return 'Erro desconhecido';
      if (typeof err === 'string') return err;

      const anyErr = err as any;
      const msg = anyErr?.message || anyErr?.error_description || anyErr?.details || anyErr?.hint || '';
      const code = anyErr?.code || anyErr?.status || '';
      const base = String(msg || 'Erro desconhecido');
      return code ? `${base} (${code})` : base;
    };

    const toDebugObject = (err: any) => {
      // Importante: alguns erros do Supabase/PostgREST possuem propriedades não-enumeráveis.
      // Este helper tenta capturar o máximo possível sem quebrar o console.
      try {
        if (!err) return { value: err };
        if (typeof err !== 'object') return { value: err, type: typeof err };

        const anyErr = err as any;
        const ownNames = (() => {
          try {
            return Object.getOwnPropertyNames(anyErr);
          } catch {
            return [] as string[];
          }
        })();

        const keys = Array.from(new Set([
          ...Object.keys(anyErr),
          ...ownNames,
          'name',
          'message',
          'code',
          'details',
          'hint',
          'status',
          'stack',
        ]));

        const out: Record<string, any> = {
          _string: (() => {
            try { return String(anyErr); } catch { return '[unstringifiable]'; }
          })(),
        };

        for (const k of keys) {
          try {
            out[k] = anyErr[k];
          } catch (e) {
            out[k] = `[threw: ${String((e as any)?.message || e)}]`;
          }
        }

        return out;
      } catch (e) {
        return { _debug_failed: String((e as any)?.message || e) };
      }
    };

    try {
      // Geolocalização automática: ao salvar, tenta preencher latitude/longitude a partir do endereço.
      // (Não é editável manualmente neste formulário.)
      const oldEndereco = (editingD3?.endereco || '').trim();
      const oldCidade = (editingD3?.cidade || '').trim();
      const oldUf = (editingD3?.uf || '').trim().toUpperCase();
      const oldCep = onlyDigits(editingD3?.cep || '');

      const addressChanged = editingD3
        ? (oldEndereco !== enderecoTrim || oldCidade !== municipioTrim || oldUf !== uf || oldCep !== cepDigits)
        : true;

      const hasSomeAddress = !!(enderecoTrim || municipioTrim || uf || cepDigits);
      if (addressChanged && hasSomeAddress) {
        const addressForGeocode = buildGeocodeQuery({
          endereco: enderecoTrim,
          municipio: municipioTrim,
          uf,
          cepDigits,
        });

        const coords = geoPreview?.address === addressForGeocode
          ? { latitude: geoPreview.latitude, longitude: geoPreview.longitude }
          : await geocodeFromAddress(addressForGeocode);
        if (coords) {
          payload.latitude = coords.latitude;
          payload.longitude = coords.longitude;
        }
      }

      const nowIso = new Date().toISOString();
      let savedId = editingD3?.id || null;

      const saveToDb = async (payloadToUse: any) => {
        if (editingD3) {
          return await supabase
            .from('congregacoes')
            .update(payloadToUse)
            .eq('id', editingD3.id)
            .eq('ministry_id', ministryId);
        }

        return await supabase
          .from('congregacoes')
          .insert([payloadToUse])
          .select('id')
          .single();
      };

      let saveResult: any = await saveToDb(payload);
      if (saveResult?.error) {
        const missingCol = getMissingColumnFromError(saveResult.error);
        if (missingCol && Object.prototype.hasOwnProperty.call(payload, missingCol)) {
          // Não permitir salvar sem ministry_id (multi-tenant); isso causará violação de RLS.
          if (missingCol === 'ministry_id') {
            await dialog.alert({
              title: 'Schema do Supabase',
              type: 'warning',
              message:
                `Sua base ainda não reconheceu a coluna "ministry_id" (schema/cache do Supabase).\n\n` +
                `Não é possível salvar sem "ministry_id" porque o sistema é multi-tenant.\n\n` +
                `Ações sugeridas:\n` +
                `- Recarregue a página e aguarde 1-2 minutos; ou\n` +
                `- No Supabase SQL Editor, rode: select pg_notify('pgrst','reload schema');`,
            });
            throw saveResult.error;
          }

          const shouldRetry = await dialog.confirm({
            title: 'Schema do Supabase',
            type: 'warning',
            message:
              `Sua base ainda não reconheceu a coluna "${missingCol}" (schema/cache do Supabase).\n\n` +
              `Se você aplicou migração agora, pode ser só cache; tente recarregar a página e aguardar 1-2 minutos.\n` +
              `Deseja salvar mesmo assim (sem esse campo) agora?`,
            confirmText: 'OK',
            cancelText: 'Cancelar',
          });

          if (shouldRetry) {
            const cleanPayload = { ...payload };
            delete (cleanPayload as any)[missingCol];
            saveResult = await saveToDb(cleanPayload);
          }
        } else {
          // Se for PGRST204 (cache) mas não conseguimos remover do payload,
          // tenta um retry simples após uma pequena espera.
          const msg = String(saveResult.error?.message || '');
          const isSchemaCache = /PGRST204/i.test(msg) || /schema cache/i.test(msg);
          if (isSchemaCache) {
            await new Promise(resolve => setTimeout(resolve, 1500));
            saveResult = await saveToDb(payload);
          }
        }
      }

      if (saveResult?.error) throw saveResult.error;

      if (editingD3) {
        savedId = editingD3.id;
      } else {
        const created = saveResult?.data;
        savedId = created?.id ? String(created.id) : null;
      }

      if (!savedId) throw new Error('Não foi possível salvar o registro.');

      // Foto: upload/URL (best-effort) + limpeza da foto antiga
      const oldBucket = editingD3?.foto_bucket || null;
      const oldPath = editingD3?.foto_path || null;
      let didChangePhoto = false;

      if (fotoIgrejaChange.kind === 'file') {
        const uploaded = await uploadFotoIgreja(fotoIgrejaChange.file, savedId);
        const { error: upErr } = await supabase
          .from('congregacoes')
          .update({
            foto_url: uploaded.url,
            foto_bucket: uploaded.bucket,
            foto_path: uploaded.path,
            updated_at: nowIso,
          })
          .eq('id', savedId)
          .eq('ministry_id', ministryId);
        if (upErr) throw upErr;
        didChangePhoto = true;
      }

      if (fotoIgrejaChange.kind === 'url') {
        const url = fotoIgrejaChange.url.trim();
        const { error: upErr } = await supabase
          .from('congregacoes')
          .update({
            foto_url: url,
            foto_bucket: null,
            foto_path: null,
            updated_at: nowIso,
          })
          .eq('id', savedId)
          .eq('ministry_id', ministryId);
        if (upErr) throw upErr;
        didChangePhoto = true;
      }

      if (didChangePhoto && oldBucket && oldPath) {
        await deleteFotoIgreja(oldBucket, oldPath);
      }

      await loadDivisoes3(ministryId);

      setFormD3({
        supervisao_id: '',
        campo_id: '',
        nome: '',
        dirigente: '',
        dirigente_cpf: '',
        dirigente_cargo: '',
        dirigente_matricula: '',
        endereco: '',
        cep: '',
        municipio: '',
        uf: '',
        status_imovel: '' as any,
        is_active: true,
      });
      setEditingD3(null);
      setShowFormD3(false);
      if (fotoIgrejaChange.kind === 'file') {
        try { URL.revokeObjectURL(fotoIgrejaChange.previewUrl); } catch { /* noop */ }
      }
      setFotoIgrejaChange({ kind: 'none' });
      setFotoIgrejaUrlInput('');
    } catch (error) {
      console.error('Erro ao salvar divisão 03 (raw):', error);
      console.error('Erro ao salvar divisão 03 (debug):', toDebugObject(error));
      const errText = formatDbError(error);
      const tableMissing = /public\.congregacoes/i.test(errText) && /could not find the table|schema cache|PGRST205/i.test(errText);
      await dialog.alert({
        title: 'Erro',
        type: 'error',
        message: tableMissing
          ? 'Erro ao salvar: a tabela public.congregacoes não existe neste banco. Aplique as migrações pendentes da Estrutura Hierárquica e tente novamente.'
          : `Erro ao salvar. ${errText}`,
      });
    }
  };

  const handleDeleteD3 = async (id: string) => {
    const ok = await dialog.confirm({ title: 'Confirmar', type: 'warning', message: 'Tem certeza que deseja deletar?', confirmText: 'OK', cancelText: 'Cancelar' });
    if (!ok) return;
    try {
      const { error } = await supabase
        .from('congregacoes')
        .delete()
        .eq('id', id)
        .eq('ministry_id', ministryId);
      if (error) throw error;
      await loadDivisoes3(ministryId);
    } catch (error) {
      console.error('Erro ao deletar divisão 03:', error);
      await dialog.alert({ title: 'Erro', type: 'error', message: 'Erro ao deletar. Tente novamente.' });
    }
  };

  const openNewD1 = () => {
    const nextCodigo = getNextCodigo();
    setActiveTab('divisao3');
    setShowFormD1(true);
    setEditingD1(null);
    setFormD1({
      codigo: String(nextCodigo),
      nome: '',
      uf: '',
      informar_supervisor: false,
      supervisor_cpf_input: '',
      supervisor_member_id: '',
      supervisor_matricula: '',
      supervisor_nome: '',
      supervisor_cpf: '',
      supervisor_data_nascimento: '',
      supervisor_cargo: '',
      supervisor_celular: ''
    });
    setSupervisorStatus('idle');
    setSupervisorMsg('');
  };

  const handleSaveD1 = async () => {
    if (!formD1.nome.trim()) {
      await dialog.alert({ title: 'Atenção', type: 'warning', message: 'Por favor, preencha o nome' });
      return;
    }

    // Verificar limite do plano para 1ª divisão (Supervisão/Regional)
    if (!editingD1) {
      if (planLimits.max_divisao1 === 0) {
        await dialog.alert({ title: 'Limite do Plano', type: 'error', message: `O plano atual não permite criação de ${nomeD3}. Faça upgrade para habilitar esta divisão.` });
        return;
      }
      if (planLimits.max_divisao1 > 0 && divisoes1.length >= planLimits.max_divisao1) {
        await dialog.alert({ title: 'Limite do Plano', type: 'error', message: `Limite atingido: o plano permite até ${planLimits.max_divisao1} ${nomeD3}(s). Faça upgrade para adicionar mais.` });
        return;
      }
    }

    const uf: string | null = null;

    const shouldSaveSupervisor = !!formD1.informar_supervisor;
    const supervisorPayload = shouldSaveSupervisor
      ? {
          supervisor_member_id: null,
          supervisor_matricula: null,
          supervisor_nome: (formD1.supervisor_nome || '').trim() || null,
          supervisor_cpf: null,
          supervisor_data_nascimento: null,
          supervisor_cargo: null,
          supervisor_celular: null,
        }
      : {
          supervisor_member_id: null,
          supervisor_matricula: null,
          supervisor_nome: null,
          supervisor_cpf: null,
          supervisor_data_nascimento: null,
          supervisor_cargo: null,
          supervisor_celular: null,
        };

    const codigoAuto = getNextCodigo();
    const codigoParsedRaw = formD1.codigo.trim() ? Number.parseInt(formD1.codigo.trim(), 10) : null;
    const codigoParsed = Number.isFinite(codigoParsedRaw as any) && (codigoParsedRaw as any) > 0 ? (codigoParsedRaw as number) : null;
    const codigoToSave = editingD1?.codigo && Number.isFinite(editingD1.codigo) ? editingD1.codigo : (codigoParsed ?? codigoAuto);

    try {
      let createdSupervisaoId: string | null = null;

      if (editingD1) {
        // Atualizar
        const { error } = await supabase
          .from('supervisoes')
          .update({
            codigo: codigoToSave,
            nome: formD1.nome,
            uf,
            ...supervisorPayload,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingD1.id)
          .eq('ministry_id', ministryId);
        
        if (error) throw error;
      } else {
        // Criar
        const { data: createdRow, error } = await supabase
          .from('supervisoes')
          .insert([{
            ministry_id: ministryId,
            codigo: codigoToSave,
            nome: formD1.nome,
            uf,
            ...supervisorPayload,
            is_active: true
          }])
          .select('id')
          .single();

        createdSupervisaoId = (createdRow as any)?.id || null;
        
        if (error) {
          // Em caso de corrida (código duplicado), recalcular e tentar 1 vez.
          const msg = (error as any)?.message || '';
          if (String(msg).includes('idx_supervisoes_ministry_codigo_unique') || String(msg).includes('duplicate key')) {
            await loadDivisoes1(ministryId);
            const retryCodigo = getNextCodigo();
            const { data: retryRow, error: retryErr } = await supabase
              .from('supervisoes')
              .insert([{
                ministry_id: ministryId,
                codigo: retryCodigo,
                nome: formD1.nome,
                uf,
                ...supervisorPayload,
                is_active: true
              }])
              .select('id')
              .single();
            if (retryErr) throw retryErr;
            createdSupervisaoId = (retryRow as any)?.id || null;
          } else {
            throw error;
          }
        }
      }

      // Associações D2 -> D3 (best-effort): campos.supervisao_id
      {
        const supervisaoId = editingD1?.id || createdSupervisaoId || null;
        // Se criou novo, precisamos descobrir o ID. Como esta tela usa o fluxo
        // de código auto-incremental + unique, a forma mais segura aqui é recarregar
        // e encontrar pelo (ministry_id, codigo).
        let resolvedId = supervisaoId;
        if (!resolvedId) {
          await loadDivisoes1(ministryId);
          const found = divisoes1.find(s => {
            const codigo = typeof s.codigo === 'number' && Number.isFinite(s.codigo) ? s.codigo : null;
            return codigo === codigoToSave && s.nome === formD1.nome;
          }) || null;
          resolvedId = found?.id || null;
        }

        if (resolvedId) {
          const nowIso = new Date().toISOString();
          const existing = divisoes2
            .filter(c => c.supervisao_id === resolvedId)
            .map(c => c.id);
          const availableIds = new Set(
            divisoes2
              .filter(c => !c.supervisao_id || c.supervisao_id === resolvedId)
              .map(c => c.id)
          );
          const selected = selectedD2IdsForD3.filter(id => availableIds.has(id));
          const toAdd = selected.filter(id => !existing.includes(id));
          const toRemove = existing.filter(id => !selected.includes(id));

          if (toAdd.length) {
            const { error: addErr } = await supabase
              .from('campos')
              .update({ supervisao_id: resolvedId, updated_at: nowIso })
              .eq('ministry_id', ministryId)
              .in('id', toAdd);
            if (addErr) throw addErr;
          }

          if (toRemove.length) {
            const { error: removeErr } = await supabase
              .from('campos')
              .update({ supervisao_id: null, updated_at: nowIso })
              .eq('ministry_id', ministryId)
              .eq('supervisao_id', resolvedId)
              .in('id', toRemove);
            if (removeErr) throw removeErr;
          }
        }
      }

      // Recarregar lista
      await loadDivisoes1(ministryId);
      await loadDivisoes2(ministryId);
      
      // Limpar form
      setFormD1({
        codigo: '',
        nome: '',
        uf: '',
        informar_supervisor: false,
        supervisor_cpf_input: '',
        supervisor_member_id: '',
        supervisor_matricula: '',
        supervisor_nome: '',
        supervisor_cpf: '',
        supervisor_data_nascimento: '',
        supervisor_cargo: '',
        supervisor_celular: ''
      });
      setSupervisorStatus('idle');
      setSupervisorMsg('');
      setSelectedD2IdsForD3([]);
      setEditingD1(null);
      setShowFormD1(false);
    } catch (error) {
      console.error('Erro ao salvar:', error);
      await dialog.alert({ title: 'Erro', type: 'error', message: 'Erro ao salvar. Tente novamente.' });
    }
  };

  const handleDeleteD1 = async (id: string) => {
    const ok = await dialog.confirm({ title: 'Confirmar', type: 'warning', message: 'Tem certeza que deseja deletar?', confirmText: 'OK', cancelText: 'Cancelar' });
    if (!ok) return;

    try {
      const { error } = await supabase
        .from('supervisoes')
        .delete()
        .eq('id', id)
        .eq('ministry_id', ministryId);
      
      if (error) throw error;
      
      await loadDivisoes1(ministryId);
    } catch (error) {
      console.error('Erro ao deletar:', error);
      await dialog.alert({ title: 'Erro', type: 'error', message: 'Erro ao deletar. Tente novamente.' });
    }
  };

  if (loading) return <div className="p-8">Carregando...</div>;

  const hierarchyParts = [
    d1Enabled ? nomeD1 : null,
    d2Enabled ? nomeD2 : null,
    d3Enabled ? nomeD3 : null
  ].filter(Boolean) as string[];

  const hierarchyLabel = hierarchyParts.length ? hierarchyParts.join('/') : 'Sem divisões';

  const tabs = [
    d1Enabled ? { id: 'divisao1', label: `${nomeD1}s (1ª)`, icon: '1️⃣' } : null,
    d2Enabled ? { id: 'divisao2', label: `${nomeD2}s (2ª)`, icon: '2️⃣' } : null,
    d3Enabled ? { id: 'divisao3', label: `${nomeD3}s (3ª)`, icon: '3️⃣' } : null
  ].filter(Boolean) as { id: string; label: string; icon: string }[];

  const availableDivisoes3ForCurrentD2 = divisoes3.filter(cg => !cg.campo_id || cg.campo_id === editingD2?.id);
  const availableDivisoes2ForCurrentD1 = divisoes2.filter(c => !c.supervisao_id || c.supervisao_id === editingD1?.id);

  return (
    <PageLayout
      title={`Estrutura Hierárquica - ${hierarchyLabel}`}
      description={
        hierarchyParts.length
          ? `Gerenciar a hierarquia do ministério: ${hierarchyParts.map(p => `${p}s`).join(', ')}`
          : 'Nenhuma divisão habilitada nas nomenclaturas.'
      }
      activeMenu="estrutura-hierarquica"
    >
      <div className="w-full max-w-7xl mx-auto px-1 sm:px-2 lg:px-4">
      {/* Abas */}
      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
        {tabs.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <p className="text-yellow-900 font-semibold">⚠️ Nenhuma divisão habilitada</p>
            <p className="text-yellow-700 text-sm mt-2">
              Vá em Configurações → Nomenclaturas e escolha uma divisão diferente de “NENHUMA”.
            </p>
          </div>
        )}

        {/* TAB: 1ª Divisão (Agora: Congregações / antigo formulário da Divisão 03) */}
        {d1Enabled && activeTab === 'divisao1' && (
          <Section icon="1️⃣" title={`${nomeD1}s`}>
            <div className="grid grid-cols-1 gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
                <p className="text-gray-600 text-sm">Total de {nomeD1}s</p>
                <p className="text-2xl font-bold text-blue-600">{divisoes3.length}</p>
              </div>
            </div>

            {showFormD3 && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">
                  {editingD3 ? `Editar ${nomeD1}` : `Nova ${nomeD1}`}
                </h3>

                <div className="space-y-4">
                  {/* Removido: CAMPO/SUPERVISÃO (conforme imagem/UX) */}

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Nome da {nomeD1}
                    </label>
                    <input
                      type="text"
                      value={formD3.nome}
                      onChange={(e) => setFormD3(prev => ({ ...prev, nome: e.target.value }))}
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
                        setFormD3(prev => ({
                          ...prev,
                          dirigente: v,
                          dirigente_cpf: '',
                          dirigente_cargo: '',
                          dirigente_matricula: '',
                        }));
                        setDirigenteSelected(null);
                        setDirigenteStatus('idle');
                        setDirigenteMsg('');
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
                          const matricula = String(getMemberMatricula(m) || '').trim();
                          const cpf = String(m.cpf || '').trim();
                          return (
                            <button
                              type="button"
                              key={m.id}
                              onClick={() => {
                                setFormD3(prev => ({
                                  ...prev,
                                  dirigente: m.name,
                                  dirigente_cpf: cpf,
                                  dirigente_cargo: cargo,
                                  dirigente_matricula: matricula,
                                }));
                                setDirigenteSelected({ id: m.id, name: m.name });
                                setDirigenteResults([]);
                                setDirigenteStatus('selected');
                                setDirigenteMsg('Dirigente selecionado.');
                              }}
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
                          onChange={(e) => setFormD3(prev => ({ ...prev, dirigente_cpf: formatCpf(e.target.value) }))}
                          placeholder="Ex: 00000000000"
                          className="w-full px-4 py-2 border-2 border-teal-500 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Cargo</label>
                        <input
                          type="text"
                          value={formD3.dirigente_cargo}
                          onChange={(e) => setFormD3(prev => ({ ...prev, dirigente_cargo: e.target.value }))}
                          placeholder="Ex: Pastor"
                          className="w-full px-4 py-2 border-2 border-teal-500 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Matrícula</label>
                        <input
                          type="text"
                          value={formD3.dirigente_matricula}
                          onChange={(e) => setFormD3(prev => ({ ...prev, dirigente_matricula: e.target.value }))}
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
                      onChange={(e) => setFormD3(prev => ({ ...prev, endereco: e.target.value }))}
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
                        onChange={(e) => setFormD3(prev => ({ ...prev, cep: e.target.value }))}
                        placeholder="Somente números"
                        className="w-full px-4 py-2 border-2 border-teal-500 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Município</label>
                      <input
                        type="text"
                        value={formD3.municipio}
                        onChange={(e) => setFormD3(prev => ({ ...prev, municipio: e.target.value }))}
                        placeholder="Ex: Santos"
                        className="w-full px-4 py-2 border-2 border-teal-500 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">UF</label>
                      <input
                        type="text"
                        value={formD3.uf}
                        onChange={(e) => setFormD3(prev => ({ ...prev, uf: e.target.value.toUpperCase().slice(0, 2) }))}
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
                      onChange={(e) => setFormD3(prev => ({ ...prev, status_imovel: e.target.value as any }))}
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
                      {/* Card: upload/URL */}
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

                      {/* Card: pré-visualização */}
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
                      onClick={() => {
                        setShowFormD3(false);
                        setEditingD3(null);
                        setGeoPreview(null);
                        setDirigenteResults([]);
                        setDirigenteStatus('idle');
                        setDirigenteMsg('');
                        setDirigenteSelected(null);
                        setFormD3({
                          supervisao_id: '',
                          campo_id: '',
                          nome: '',
                          dirigente: '',
                          dirigente_cpf: '',
                          dirigente_cargo: '',
                          dirigente_matricula: '',
                          endereco: '',
                          cep: '',
                          municipio: '',
                          uf: '',
                          status_imovel: '' as any,
                          is_active: true,
                        });
                      }}
                      className="flex-1 px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition font-semibold"
                    >
                      ✕ Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!showFormD3 && (
              <button
                onClick={() => {
                  if (planLimits.max_divisao3 === 0) return;
                  if (planLimits.max_divisao3 > 0 && divisoes3.length >= planLimits.max_divisao3) return;
                  setShowFormD3(true);
                  setEditingD3(null);
                  setGeoPreview(null);
                  setDirigenteResults([]);
                  setDirigenteStatus('idle');
                  setDirigenteMsg('');
                  setDirigenteSelected(null);
                  setFormD3({
                    supervisao_id: '',
                    campo_id: '',
                    nome: '',
                    dirigente: '',
                    dirigente_cpf: '',
                    dirigente_cargo: '',
                    dirigente_matricula: '',
                    endereco: '',
                    cep: '',
                    municipio: '',
                    uf: '',
                    status_imovel: '' as any,
                    is_active: true,
                  });
                  if (fotoIgrejaChange.kind === 'file') {
                    try { URL.revokeObjectURL(fotoIgrejaChange.previewUrl); } catch { /* noop */ }
                  }
                  setFotoIgrejaChange({ kind: 'none' });
                  setFotoIgrejaUrlInput('');
                }}
                disabled={planLimits.max_divisao3 === 0 || (planLimits.max_divisao3 > 0 && divisoes3.length >= planLimits.max_divisao3)}
                title={
                  planLimits.max_divisao3 === 0
                    ? `Plano atual não permite ${nomeD1}`
                    : planLimits.max_divisao3 > 0 && divisoes3.length >= planLimits.max_divisao3
                      ? `Limite do plano atingido (${planLimits.max_divisao3})`
                      : undefined
                }
                className={`mb-6 w-full px-6 py-3 font-bold rounded-lg transition shadow-md flex items-center justify-center gap-2 ${
                  planLimits.max_divisao3 === 0 || (planLimits.max_divisao3 > 0 && divisoes3.length >= planLimits.max_divisao3)
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-teal-500 text-white hover:bg-teal-600'
                }`}
              >
                + Adicionar {nomeD1}
                {planLimits.max_divisao3 > 0 && (
                  <span className="text-xs opacity-80">({divisoes3.length}/{planLimits.max_divisao3})</span>
                )}
                {planLimits.max_divisao3 === 0 && <span className="text-xs opacity-80">(bloqueado no plano)</span>}
              </button>
            )}

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-200 text-gray-800">
                      <th className="px-4 py-3 text-left font-semibold">SETOR</th>
                      <th className="px-4 py-3 text-left font-semibold">NOME</th>
                      <th className="px-4 py-3 text-left font-semibold">DIRIGENTE</th>
                      <th className="px-4 py-3 text-left font-semibold">CONDIÇÃO</th>
                      <th className="px-4 py-3 text-center font-semibold">AÇÕES</th>
                    </tr>
                  </thead>
                <tbody>
                  {divisoes3.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                        Nenhuma {nomeD1} cadastrada
                      </td>
                    </tr>
                  ) : (
                    divisoes3.map(cg => {
                      const campo = d2Enabled && cg.campo_id
                        ? divisoes2.find(c => c.id === cg.campo_id) || null
                        : null;
                      const sup = (!d2Enabled && d3Enabled && cg.supervisao_id)
                        ? divisoes1.find(s => s.id === cg.supervisao_id) || null
                        : null;

                      return (
                        <tr key={cg.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-700">
                            {campo ? formatCampoLabel(campo) : (sup ? formatSupervisaoLabel(sup) : '-')}
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-800">{cg.nome}</td>
                          <td className="px-4 py-3 text-gray-700">{String((cg as any).dirigente || '').trim() || '-'}</td>
                          <td className="px-4 py-3 text-gray-700">
                            {cg.status_imovel === 'PROPRIO'
                              ? 'Própria'
                              : cg.status_imovel === 'ALUGADO'
                                ? 'Alugada'
                                : cg.status_imovel === 'CEDIDO'
                                  ? 'Cedida'
                                  : '-'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => {
                                setEditingD3(cg);
                                setShowFormD3(true);
                                setGeoPreview(null);
                                setDirigenteResults([]);
                                setDirigenteStatus('idle');
                                setDirigenteMsg('');
                                setFormD3({
                                  supervisao_id: (cg.supervisao_id as any) || '',
                                  campo_id: (cg.campo_id as any) || '',
                                  nome: cg.nome || '',
                                  dirigente: (cg as any).dirigente || '',
                                  dirigente_cpf: (cg as any).dirigente_cpf || '',
                                  dirigente_cargo: (cg as any).dirigente_cargo || '',
                                  dirigente_matricula: (cg as any).dirigente_matricula || '',
                                  endereco: (cg.endereco as any) || '',
                                  cep: (cg.cep as any) || '',
                                  municipio: (cg.cidade as any) || '',
                                  uf: (cg.uf as any) || '',
                                  status_imovel: (cg.status_imovel as any) || '',
                                  is_active: !!cg.is_active,
                                });
                                const existingDirigente = String((cg as any).dirigente || '').trim();
                                setDirigenteSelected(existingDirigente ? { id: 'existing', name: existingDirigente } : null);
                                if (fotoIgrejaChange.kind === 'file') {
                                  try { URL.revokeObjectURL(fotoIgrejaChange.previewUrl); } catch { /* noop */ }
                                }
                                setFotoIgrejaChange({ kind: 'none' });
                                setFotoIgrejaUrlInput('');
                              }}
                              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition text-xs font-semibold"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteD3(cg.id)}
                              className="ml-2 px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition text-xs font-semibold"
                            >
                              Deletar
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                </table>
              </div>
            </div>
          </Section>
        )}

        {/* TAB: 2ª Divisão */}
        {d2Enabled && activeTab === 'divisao2' && (
          <Section icon="2️⃣" title={`${nomeD2}s`}>
            <div className="grid grid-cols-1 gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
                <p className="text-gray-600 text-sm">Total de {nomeD2}s</p>
                <p className="text-2xl font-bold text-blue-600">{divisoes2.length}</p>
              </div>
            </div>

            <>
              {showFormD2 && (
                  <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">
                      {editingD2 ? `Editar ${nomeD2}` : `Novo ${nomeD2}`}
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Nome do {nomeD2}
                        </label>
                        <input
                          type="text"
                          value={formD2.nome}
                          onChange={(e) => setFormD2(prev => ({ ...prev, nome: e.target.value }))}
                          placeholder={`Ex: ${nomeD2} Baixada Santista`}
                          className="w-full px-4 py-2 border-2 border-teal-500 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>


                      <div>
                        <label className="inline-flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={!!formD2.informar_pastor}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setFormD2(prev => ({
                                ...prev,
                                informar_pastor: checked,
                                pastor_nome_input: checked ? prev.pastor_nome_input : '',
                                pastor_member_id: checked ? prev.pastor_member_id : '',
                                pastor_nome: checked ? prev.pastor_nome : '',
                                pastor_data_posse: checked ? prev.pastor_data_posse : ''
                              }));
                              if (!checked) {
                                setPastorResults([]);
                                setPastorStatus('idle');
                                setPastorMsg('');
                              }
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
                                  setFormD2(prev => ({
                                    ...prev,
                                    pastor_nome_input: v,
                                    pastor_member_id: '',
                                    pastor_nome: ''
                                  }));
                                  setPastorStatus('idle');
                                  setPastorMsg('');
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
                                      onClick={() => {
                                        setFormD2(prev => ({
                                          ...prev,
                                          pastor_member_id: m.id,
                                          pastor_nome: m.name,
                                          pastor_nome_input: m.name
                                        }));
                                        setPastorResults([]);
                                        setPastorStatus('selected');
                                        setPastorMsg('Pastor selecionado.');
                                      }}
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
                                onChange={(e) => setFormD2(prev => ({ ...prev, pastor_data_posse: e.target.value }))}
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
                                      setSelectedD1IdsForD2(prev => {
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
                          onClick={() => {
                            setShowFormD2(false);
                            setEditingD2(null);
                            setFormD2({
                              supervisao_id: '',
                              nome: '',
                              is_sede: false,
                              informar_pastor: false,
                              pastor_nome_input: '',
                              pastor_member_id: '',
                              pastor_nome: '',
                              pastor_data_posse: '',
                              cep: '',
                              municipio: '',
                              uf: ''
                            });
                            setPastorResults([]);
                            setPastorStatus('idle');
                            setPastorMsg('');
                            setSelectedD1IdsForD2([]);
                          }}
                          className="flex-1 px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition font-semibold"
                        >
                          ✕ Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {!showFormD2 && (
                  <button
                    onClick={() => {
                      if (planLimits.max_divisao2 === 0) return;
                      if (planLimits.max_divisao2 > 0 && divisoes2.length >= planLimits.max_divisao2) return;
                      setShowFormD2(true);
                      setEditingD2(null);
                      setFormD2({
                        supervisao_id: '',
                        nome: '',
                        is_sede: false,
                        informar_pastor: false,
                        pastor_nome_input: '',
                        pastor_member_id: '',
                        pastor_nome: '',
                        pastor_data_posse: '',
                        cep: '',
                        municipio: '',
                        uf: ''
                      });
                      setPastorResults([]);
                      setPastorStatus('idle');
                      setPastorMsg('');
                      setSelectedD1IdsForD2([]);
                    }}
                    disabled={planLimits.max_divisao2 === 0 || (planLimits.max_divisao2 > 0 && divisoes2.length >= planLimits.max_divisao2)}
                    title={
                      planLimits.max_divisao2 === 0
                        ? `Plano atual não permite ${nomeD2}`
                        : planLimits.max_divisao2 > 0 && divisoes2.length >= planLimits.max_divisao2
                          ? `Limite do plano atingido (${planLimits.max_divisao2})`
                          : undefined
                    }
                    className={`mb-6 w-full px-6 py-3 font-bold rounded-lg transition shadow-md flex items-center justify-center gap-2 ${
                      planLimits.max_divisao2 === 0 || (planLimits.max_divisao2 > 0 && divisoes2.length >= planLimits.max_divisao2)
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-teal-500 text-white hover:bg-teal-600'
                    }`}
                  >
                    + Adicionar {nomeD2}
                    {planLimits.max_divisao2 > 0 && (
                      <span className="text-xs opacity-80">({divisoes2.length}/{planLimits.max_divisao2})</span>
                    )}
                    {planLimits.max_divisao2 === 0 && <span className="text-xs opacity-80">(bloqueado no plano)</span>}
                  </button>
                )}
            </>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold bg-gray-200 text-gray-800">REGIONAL</th>
                    <th className="px-4 py-3 text-left font-semibold bg-gray-200 text-gray-800">NOME</th>
                    <th className="px-4 py-3 text-left font-semibold bg-gray-200 text-gray-800">PASTOR/SUPERVISOR</th>
                    <th className="px-4 py-3 text-left font-semibold bg-gray-200 text-gray-800">MUNICÍPIO</th>
                    <th className="px-4 py-3 text-left font-semibold bg-gray-200 text-gray-800">QTD. {`${nomeD1.toUpperCase()}S`}</th>
                    <th className="px-4 py-3 text-center font-semibold bg-gray-200 text-gray-800">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {divisoes2.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                        Nenhum {nomeD2} cadastrado
                      </td>
                    </tr>
                  ) : (
                    divisoes2.map(c => {
                      const sup = d3Enabled && c.supervisao_id
                        ? divisoes1.find(s => s.id === c.supervisao_id) || null
                        : null;
                      const qtdCongregacoes = divisoes3.filter(cg => cg.campo_id === c.id).length;
                      return (
                        <tr key={c.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-700">{sup ? formatSupervisaoLabel(sup) : '-'}</td>
                          <td className="px-4 py-3 text-gray-700 font-semibold">{c.nome}</td>
                          <td className="px-4 py-3 text-gray-700">
                            {c.pastor_nome || '-'}
                          </td>
                          <td className="px-4 py-3 text-gray-700">{c.municipio || '-'}</td>
                          <td className="px-4 py-3 text-gray-700 font-semibold">{qtdCongregacoes}</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => {
                                setEditingD2(c);
                                setShowFormD2(true);
                                setFormD2({
                                  supervisao_id: (c.supervisao_id as any) || '',
                                  nome: c.nome || '',
                                  is_sede: !!c.is_sede,
                                  informar_pastor: !!c.pastor_member_id,
                                  pastor_nome_input: c.pastor_nome || '',
                                  pastor_member_id: c.pastor_member_id || '',
                                  pastor_nome: c.pastor_nome || '',
                                  pastor_data_posse: (c.pastor_data_posse as any) || '',
                                  cep: '',
                                  municipio: '',
                                  uf: ''
                                });
                                setSelectedD1IdsForD2(divisoes3.filter(cg => cg.campo_id === c.id).map(cg => cg.id));
                                setPastorResults([]);
                                setPastorStatus(c.pastor_member_id ? 'selected' : 'idle');
                                setPastorMsg(c.pastor_member_id ? 'Pastor selecionado.' : '');
                              }}
                              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition text-xs font-semibold"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteD2(c.id)}
                              className="ml-2 px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition text-xs font-semibold"
                            >
                              Deletar
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </Section>
        )}

        {/* TAB: 3ª Divisão (Congregações) */}
        {d3Enabled && activeTab === 'divisao3' && (
          <Section icon="3️⃣" title={`${nomeD3}s`}>
            <div className="grid grid-cols-1 gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
                <p className="text-gray-600 text-sm">Total de {nomeD3}s</p>
                <p className="text-2xl font-bold text-blue-600">{divisoes1.length}</p>
              </div>
            </div>
            {showFormD1 && (
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
                      onChange={(e) => setFormD1({ ...formD1, nome: e.target.value })}
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
                          setFormD1(prev => ({
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
                          setSupervisorStatus('idle');
                          setSupervisorMsg('');
                          setSupervisorCpfResults([]);
                          setSupervisorCpfStatus('idle');
                          setSupervisorCpfMsg('');
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
                        onChange={(e) => setFormD1(prev => ({ ...prev, supervisor_nome: e.target.value }))}
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
                                  setSelectedD2IdsForD3(prev => {
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
                      onClick={() => {
                        setShowFormD1(false);
                        setEditingD1(null);
                        setFormD1({
                          codigo: '',
                          nome: '',
                          uf: '',
                          informar_supervisor: false,
                          supervisor_cpf_input: '',
                          supervisor_member_id: '',
                          supervisor_matricula: '',
                          supervisor_nome: '',
                          supervisor_cpf: '',
                          supervisor_data_nascimento: '',
                          supervisor_cargo: '',
                          supervisor_celular: ''
                        });
                        setSupervisorStatus('idle');
                        setSupervisorMsg('');
                        setSelectedD2IdsForD3([]);
                      }}
                      className="flex-1 px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition font-semibold"
                    >
                      ✕ Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!showFormD1 && (
              <button
                onClick={() => {
                  if (planLimits.max_divisao1 === 0) return;
                  if (planLimits.max_divisao1 > 0 && divisoes1.length >= planLimits.max_divisao1) return;
                  openNewD1();
                }}
                disabled={planLimits.max_divisao1 === 0 || (planLimits.max_divisao1 > 0 && divisoes1.length >= planLimits.max_divisao1)}
                title={
                  planLimits.max_divisao1 === 0
                    ? `Plano atual não permite ${nomeD3}`
                    : planLimits.max_divisao1 > 0 && divisoes1.length >= planLimits.max_divisao1
                      ? `Limite do plano atingido (${planLimits.max_divisao1})`
                      : undefined
                }
                className={`mb-6 w-full px-6 py-3 font-bold rounded-lg transition shadow-md flex items-center justify-center gap-2 ${
                  planLimits.max_divisao1 === 0 || (planLimits.max_divisao1 > 0 && divisoes1.length >= planLimits.max_divisao1)
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-teal-500 text-white hover:bg-teal-600'
                }`}
              >
                + Adicionar {nomeD3}
                {planLimits.max_divisao1 > 0 && planLimits.max_divisao1 < 999 && (
                  <span className="text-xs opacity-80">({divisoes1.length}/{planLimits.max_divisao1})</span>
                )}
                {planLimits.max_divisao1 === 0 && <span className="text-xs opacity-80">(bloqueado no plano)</span>}
              </button>
            )}

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold bg-gray-200 text-gray-800">NOME</th>
                    <th className="px-4 py-3 text-left font-semibold bg-gray-200 text-gray-800">PASTOR/SUPERVISOR</th>
                    <th className="px-4 py-3 text-left font-semibold bg-gray-200 text-gray-800">QTD DE SETOR</th>
                    <th className="px-4 py-3 text-center font-semibold bg-gray-200 text-gray-800">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {divisoes1.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                        Nenhuma {nomeD3} cadastrada
                      </td>
                    </tr>
                  ) : (
                    divisoes1.map(d => {
                      const qtdSetor = divisoes2.filter(c => c.supervisao_id === d.id).length;

                      return (
                        <tr key={d.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-700 font-semibold">{d.nome}</td>
                          <td className="px-4 py-3 text-gray-700">{d.supervisor_nome || '-'}</td>
                          <td className="px-4 py-3 text-gray-700 font-semibold">{qtdSetor}</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => {
                                setEditingD1(d);
                                setFormD1({
                                  codigo: d.codigo ? String(d.codigo) : '',
                                  nome: d.nome || '',
                                  uf: '',
                                  informar_supervisor: !!(d.supervisor_nome || d.supervisor_member_id),
                                  supervisor_cpf_input: '',
                                  supervisor_member_id: '',
                                  supervisor_matricula: '',
                                  supervisor_nome: d.supervisor_nome || '',
                                  supervisor_cpf: '',
                                  supervisor_data_nascimento: '',
                                  supervisor_cargo: '',
                                  supervisor_celular: ''
                                });
                                setSelectedD2IdsForD3(divisoes2.filter(c => c.supervisao_id === d.id).map(c => c.id));
                                setSupervisorStatus('idle');
                                setSupervisorMsg('');
                                setShowFormD1(true);
                              }}
                              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition text-xs font-semibold"
                            >
                              Editar
                            </button>
                            <button onClick={() => handleDeleteD1(d.id)} className="ml-2 px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition text-xs font-semibold">
                              Deletar
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </Section>
        )}
      </Tabs>
      </div>
    </PageLayout>
  );
}
