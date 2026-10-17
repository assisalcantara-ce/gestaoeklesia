import fs from 'fs';
import path from 'path';
import { createServerClient } from '@/lib/supabase-server';
import { normalizeBrazilianPhone, getPhoneSearchVariants } from '@/lib/telefone-utils';

export interface RecepcaoVisitante {
  id: string;
  culto_id: string;
  ministry_id: string;
  congregacao_id: string;
  nome: string;
  telefone?: string | null;
  cidade?: string | null;
  bairro?: string | null;
  igreja_origem?: string | null;
  primeira_visita: boolean;
  is_ministro: boolean;
  cargo_ministerial?: string | null;
  observacoes?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface RecepcaoAutoridade {
  id: string;
  culto_id: string;
  ministry_id: string;
  congregacao_id: string;
  nome: string;
  cargo_funcao: string;
  instituicao?: string | null;
  observacoes?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface RecepcaoOracao {
  id: string;
  culto_id: string;
  ministry_id: string;
  congregacao_id: string;
  nome: string;
  tipo: 'pedido' | 'acao_de_gracas';
  categoria?: string | null;
  motivo: string;
  observacoes?: string | null;
  is_privado: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface RecepcaoAviso {
  id: string;
  culto_id: string;
  ministry_id: string;
  congregacao_id: string;
  titulo: string;
  conteudo: string;
  ordem: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface RecepcaoFamilia {
  id: string;
  culto_id: string;
  ministry_id: string;
  congregacao_id: string;
  responsavel: string;
  membros_familia?: string | null;
  total_membros: number;
  origem?: string | null;
  contato?: string | null;
  intencao_congregar: boolean;
  observacoes?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface RecepcaoResumo {
  totais: {
    visitantes: number;
    visitantes_primeira_vez: number;
    autoridades: number;
    pedidos_oracao: number;
    acoes_de_gracas: number;
    oracoes_privadas: number;
    oracoes_publicas: number;
    familias: number;
    total_pessoas_familias: number;
    intencoes_congregar: number;
    avisos: number;
  };
  autoridades_mencao: Array<{
    id: string;
    nome: string;
    cargo_funcao: string;
    instituicao?: string | null;
    observacoes?: string | null;
  }>;
  avisos_ordenados: Array<{
    id: string;
    titulo: string;
    conteudo: string;
    ordem: number;
  }>;
  oracoes_publicas: Array<{
    id: string;
    nome: string;
    tipo: 'pedido' | 'acao_de_gracas';
    categoria?: string | null;
    motivo: string;
    observacoes?: string | null;
  }>;
  familias_acolhimento: Array<{
    id: string;
    responsavel: string;
    membros_familia?: string | null;
    total_membros: number;
    origem?: string | null;
    intencao_congregar: boolean;
  }>;
}

export interface TokenRecepcaoRecord {
  id: string;
  ministry_id: string;
  congregacao_id: string;
  culto_id: string;
  token_hash: string;
  expira_em: string;
  revogado_em?: string | null;
  revogado_por?: string | null;
  criado_por?: string | null;
  ultimo_acesso_em?: string | null;
  created_at: string;
  updated_at: string;
}

// Store persistente local em arquivo e memória para desenvolvimento e testes antes da execução da migration
interface CultoRecepcaoStorage {
  tokens: Record<string, TokenRecepcaoRecord>;
  autoridades: Record<string, RecepcaoAutoridade>;
  oracoes: Record<string, RecepcaoOracao>;
  avisos: Record<string, RecepcaoAviso>;
  familias: Record<string, RecepcaoFamilia>;
}

let lastStoreMtime = 0;

function getStorageFilePath(): string {
  try {
    const nextDir = path.join(process.cwd(), '.next');
    if (fs.existsSync(nextDir)) {
      return path.join(nextDir, 'culto_recepcao_store.json');
    }
  } catch {
    // ignore
  }
  return path.join(process.cwd(), '.culto_recepcao_store.json');
}

function loadStore(): CultoRecepcaoStorage {
  const filePath = getStorageFilePath();
  let parsed: any = null;
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const globalStore = (globalThis as any).__cultoRecepcaoStore as CultoRecepcaoStorage | undefined;
      if (!globalStore || stats.mtimeMs > lastStoreMtime) {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (content && content.trim()) {
          parsed = JSON.parse(content);
          lastStoreMtime = stats.mtimeMs;
        }
      } else {
        parsed = globalStore;
      }
    }
  } catch {
    // fallback
  }

  if (!parsed) {
    parsed = (globalThis as any).__cultoRecepcaoStore;
  }

  const safeStore: CultoRecepcaoStorage = {
    tokens: parsed?.tokens && typeof parsed.tokens === 'object' ? parsed.tokens : {},
    autoridades: parsed?.autoridades && typeof parsed.autoridades === 'object' ? parsed.autoridades : {},
    oracoes: parsed?.oracoes && typeof parsed.oracoes === 'object' ? parsed.oracoes : {},
    avisos: parsed?.avisos && typeof parsed.avisos === 'object' ? parsed.avisos : {},
    familias: parsed?.familias && typeof parsed.familias === 'object' ? parsed.familias : {},
  };
  (globalThis as any).__cultoRecepcaoStore = safeStore;
  return safeStore;
}

function saveStore(store: CultoRecepcaoStorage): void {
  (globalThis as any).__cultoRecepcaoStore = store;
  try {
    const filePath = getStorageFilePath();
    fs.writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf-8');
    const stats = fs.statSync(filePath);
    lastStoreMtime = stats.mtimeMs;
  } catch (err) {
    console.error('Falha ao persistir store local de recepção:', err);
  }
}

export class CultoRecepcaoService {
  private admin: ReturnType<typeof createServerClient>;

  constructor(customClient?: ReturnType<typeof createServerClient>) {
    this.admin = customClient || createServerClient();
  }

  /**
   * Salva ou atualiza um token na tabela culto_recepcao_tokens
   */
  async salvarToken(params: {
    ministry_id: string;
    congregacao_id: string;
    culto_id: string;
    token_hash: string;
    expira_em: string;
    criado_por?: string | null;
  }): Promise<TokenRecepcaoRecord> {
    const payload = {
      ministry_id: params.ministry_id,
      congregacao_id: params.congregacao_id,
      culto_id: params.culto_id,
      token_hash: params.token_hash,
      expira_em: params.expira_em,
      revogado_em: null,
      revogado_por: null,
      criado_por: params.criado_por || null,
      updated_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await this.admin
        .from('culto_recepcao_tokens')
        .upsert(payload, { onConflict: 'culto_id' })
        .select('*')
        .single();

      if (!error && data) {
        return data as TokenRecepcaoRecord;
      }
    } catch {
      // Falha se tabela ainda não criada no banco
    }

    // Fallback store
    const store = loadStore();
    const existing = store.tokens[params.culto_id];
    const record: TokenRecepcaoRecord = {
      id: existing?.id || `fbt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ministry_id: params.ministry_id,
      congregacao_id: params.congregacao_id,
      culto_id: params.culto_id,
      token_hash: params.token_hash,
      expira_em: params.expira_em,
      revogado_em: null,
      revogado_por: null,
      criado_por: params.criado_por || null,
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    store.tokens[params.culto_id] = record;
    saveStore(store);
    return record;
  }

  /**
   * Busca token por hash
   */
  async buscarTokenPorHash(tokenHash: string): Promise<TokenRecepcaoRecord | null> {
    try {
      const { data, error } = await this.admin
        .from('culto_recepcao_tokens')
        .select('*')
        .eq('token_hash', tokenHash)
        .maybeSingle();

      if (!error && data) {
        return data as TokenRecepcaoRecord;
      }
    } catch {
      // Continua para fallback
    }

    const store = loadStore();
    for (const record of Object.values(store.tokens)) {
      if (record.token_hash === tokenHash) {
        return record;
      }
    }
    return null;
  }

  /**
   * Busca token por culto_id
   */
  async buscarTokenPorCulto(cultoId: string): Promise<TokenRecepcaoRecord | null> {
    try {
      const { data, error } = await this.admin
        .from('culto_recepcao_tokens')
        .select('*')
        .eq('culto_id', cultoId)
        .maybeSingle();

      if (!error && data) {
        return data as TokenRecepcaoRecord;
      }
    } catch {
      // Continua para fallback
    }

    const store = loadStore();
    return store.tokens[cultoId] || null;
  }

  /**
   * Revoga um token ativo
   */
  async revogarToken(cultoId: string, revogadoPor?: string | null): Promise<boolean> {
    const revogadoEm = new Date().toISOString();
    try {
      const { error } = await this.admin
        .from('culto_recepcao_tokens')
        .update({
          revogado_em: revogadoEm,
          revogado_por: revogadoPor || null,
          updated_at: revogadoEm,
        })
        .eq('culto_id', cultoId);

      if (!error) return true;
    } catch {
      // Continua para fallback
    }

    const store = loadStore();
    const record = store.tokens[cultoId];
    if (record) {
      record.revogado_em = revogadoEm;
      record.revogado_por = revogadoPor || null;
      record.updated_at = revogadoEm;
      saveStore(store);
      return true;
    }
    return false;
  }

  /**
   * Registra último acesso ao link da recepção
   */
  async registrarAcessoToken(cultoId: string): Promise<void> {
    const nowIso = new Date().toISOString();
    try {
      await this.admin
        .from('culto_recepcao_tokens')
        .update({ ultimo_acesso_em: nowIso })
        .eq('culto_id', cultoId);
    } catch {
      const store = loadStore();
      const rec = store.tokens[cultoId];
      if (rec) {
        rec.ultimo_acesso_em = nowIso;
        saveStore(store);
      }
    }
  }

  /**
   * Lista todos os dados da recepção para um culto
   */
  async listarDadosRecepcao(cultoId: string): Promise<{
    visitantes: RecepcaoVisitante[];
    autoridades: RecepcaoAutoridade[];
    oracoes: RecepcaoOracao[];
    avisos: RecepcaoAviso[];
    familias: RecepcaoFamilia[];
    resumo: RecepcaoResumo;
  }> {
    // 1. Visitantes (tabela nativa existente: culto_visitantes)
    let visitantes: RecepcaoVisitante[] = [];
    try {
      const { data, error } = await this.admin
        .from('culto_visitantes')
        .select('*')
        .eq('culto_id', cultoId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        visitantes = (data as any[]).filter(v => !v.deleted_at);
      }
    } catch (e) {
      console.error('Erro ao buscar visitantes:', e);
    }

    // 2. Autoridades
    let autoridades: RecepcaoAutoridade[] = [];
    try {
      const { data, error } = await this.admin
        .from('culto_recepcao_autoridades')
        .select('*')
        .eq('culto_id', cultoId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        autoridades = (data as any[]).filter(a => !a.deleted_at);
      } else {
        throw new Error('Fallback autoridades');
      }
    } catch {
      const store = loadStore();
      autoridades = Object.values(store.autoridades)
        .filter(a => a.culto_id === cultoId && !a.deleted_at);
    }

    // 3. Orações
    let oracoes: RecepcaoOracao[] = [];
    try {
      const { data, error } = await this.admin
        .from('culto_recepcao_oracoes')
        .select('*')
        .eq('culto_id', cultoId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        oracoes = (data as any[]).filter(o => !o.deleted_at);
      } else {
        throw new Error('Fallback oracoes');
      }
    } catch {
      const store = loadStore();
      oracoes = Object.values(store.oracoes)
        .filter(o => o.culto_id === cultoId && !o.deleted_at);
    }

    // 4. Avisos
    let avisos: RecepcaoAviso[] = [];
    try {
      const { data, error } = await this.admin
        .from('culto_recepcao_avisos')
        .select('*')
        .eq('culto_id', cultoId)
        .order('ordem', { ascending: true })
        .order('created_at', { ascending: true });

      if (!error && data) {
        avisos = (data as any[]).filter(av => !av.deleted_at);
      } else {
        throw new Error('Fallback avisos');
      }
    } catch {
      const store = loadStore();
      avisos = Object.values(store.avisos)
        .filter(av => av.culto_id === cultoId && !av.deleted_at)
        .sort((a, b) => a.ordem - b.ordem);
    }

    // 5. Famílias
    let familias: RecepcaoFamilia[] = [];
    try {
      const { data, error } = await this.admin
        .from('culto_recepcao_familias')
        .select('*')
        .eq('culto_id', cultoId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        familias = (data as any[]).filter(f => !f.deleted_at);
      } else {
        throw new Error('Fallback familias');
      }
    } catch {
      const store = loadStore();
      familias = Object.values(store.familias)
        .filter(f => f.culto_id === cultoId && !f.deleted_at);
    }

    // 6. Resumo Executivo Consolidado
    const resumo: RecepcaoResumo = {
      totais: {
        visitantes: visitantes.length,
        visitantes_primeira_vez: visitantes.filter(v => v.primeira_visita).length,
        autoridades: autoridades.length,
        pedidos_oracao: oracoes.filter(o => o.tipo === 'pedido').length,
        acoes_de_gracas: oracoes.filter(o => o.tipo === 'acao_de_gracas').length,
        oracoes_privadas: oracoes.filter(o => o.is_privado).length,
        oracoes_publicas: oracoes.filter(o => !o.is_privado).length,
        familias: familias.length,
        total_pessoas_familias: familias.reduce((acc, f) => acc + (Number(f.total_membros) || 1), 0),
        intencoes_congregar: familias.filter(f => f.intencao_congregar).length,
        avisos: avisos.length,
      },
      autoridades_mencao: autoridades.map(a => ({
        id: a.id,
        nome: a.nome,
        cargo_funcao: a.cargo_funcao,
        instituicao: a.instituicao,
        observacoes: a.observacoes,
      })),
      avisos_ordenados: [...avisos].sort((a, b) => a.ordem - b.ordem).map(av => ({
        id: av.id,
        titulo: av.titulo,
        conteudo: av.conteudo,
        ordem: av.ordem,
      })),
      oracoes_publicas: oracoes.filter(o => !o.is_privado).map(o => ({
        id: o.id,
        nome: o.nome,
        tipo: o.tipo,
        categoria: o.categoria,
        motivo: o.motivo,
        observacoes: o.observacoes,
      })),
      familias_acolhimento: familias.map(f => ({
        id: f.id,
        responsavel: f.responsavel,
        membros_familia: f.membros_familia,
        total_membros: f.total_membros,
        origem: f.origem,
        intencao_congregar: f.intencao_congregar,
      })),
    };

    return {
      visitantes,
      autoridades,
      oracoes,
      avisos,
      familias,
      resumo,
    };
  }

  /**
   * Adiciona ou atualiza visitante com anti-duplicação contra QR Code
   */
  async salvarVisitante(params: {
    culto_id: string;
    ministry_id: string;
    congregacao_id: string;
    nome: string;
    telefone?: string | null;
    cidade?: string | null;
    bairro?: string | null;
    igreja_origem?: string | null;
    primeira_visita?: boolean;
    is_ministro?: boolean;
    cargo_ministerial?: string | null;
    observacoes?: string | null;
    id?: string;
  }): Promise<{ item: RecepcaoVisitante; ja_existia: boolean }> {
    const cleanNome = params.nome.trim();
    const cleanTelefone = params.telefone?.trim() || null;
    const primeiraVisita = params.primeira_visita ?? true;
    const isMinistro = params.is_ministro ?? false;
    const cargoMinisterial = isMinistro ? (params.cargo_ministerial?.trim() || 'Pastor') : null;

    // Se forneceu ID para edição direta
    if (params.id) {
      const { data, error } = await this.admin
        .from('culto_visitantes')
        .update({
          nome: cleanNome,
          telefone: cleanTelefone,
          cidade: params.cidade?.trim() || null,
          bairro: params.bairro?.trim() || null,
          igreja_origem: params.igreja_origem?.trim() || null,
          primeira_visita: primeiraVisita,
          is_ministro: isMinistro,
          cargo_ministerial: cargoMinisterial,
          observacoes: params.observacoes?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.id)
        .eq('culto_id', params.culto_id)
        .select('*')
        .single();

      if (!error && data) {
        return { item: data as RecepcaoVisitante, ja_existia: false };
      }
    }

    // Prevenção de duplicidade: verificar por telefone ou nome no mesmo culto
    let existingId: string | null = null;
    let existingRecord: any = null;

    if (cleanTelefone) {
      const phoneNorm = normalizeBrazilianPhone(cleanTelefone);
      const searchVariants = phoneNorm.valid ? getPhoneSearchVariants(phoneNorm.digits) : [cleanTelefone];
      const { data: dupPhone } = await this.admin
        .from('culto_visitantes')
        .select('*')
        .eq('culto_id', params.culto_id)
        .in('telefone', searchVariants)
        .limit(1)
        .maybeSingle();

      if (dupPhone) {
        existingId = dupPhone.id;
        existingRecord = dupPhone;
      }
    }

    if (!existingId && cleanNome) {
      const { data: dupName } = await this.admin
        .from('culto_visitantes')
        .select('*')
        .eq('culto_id', params.culto_id)
        .ilike('nome', cleanNome)
        .limit(1)
        .maybeSingle();

      if (dupName) {
        existingId = dupName.id;
        existingRecord = dupName;
      }
    }

    if (existingId && existingRecord) {
      // Atualiza suavemente em vez de duplicar
      const { data: updated } = await this.admin
        .from('culto_visitantes')
        .update({
          cidade: params.cidade?.trim() || existingRecord.cidade,
          bairro: params.bairro?.trim() || existingRecord.bairro,
          igreja_origem: params.igreja_origem?.trim() || existingRecord.igreja_origem,
          is_ministro: isMinistro || existingRecord.is_ministro,
          cargo_ministerial: cargoMinisterial || existingRecord.cargo_ministerial,
          observacoes: params.observacoes?.trim() || existingRecord.observacoes,
          deleted_at: null, // Restaura se estava logicamente deletado
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingId)
        .select('*')
        .single();

      return {
        item: (updated || existingRecord) as RecepcaoVisitante,
        ja_existia: true,
      };
    }

    // Inserção nova
    const { data: inserted, error: insertErr } = await this.admin
      .from('culto_visitantes')
      .insert({
        culto_id: params.culto_id,
        ministry_id: params.ministry_id,
        congregacao_id: params.congregacao_id,
        nome: cleanNome,
        telefone: cleanTelefone,
        cidade: params.cidade?.trim() || null,
        bairro: params.bairro?.trim() || null,
        igreja_origem: params.igreja_origem?.trim() || null,
        primeira_visita: primeiraVisita,
        is_ministro: isMinistro,
        cargo_ministerial: cargoMinisterial,
        observacoes: params.observacoes?.trim() || null,
      })
      .select('*')
      .single();

    if (insertErr || !inserted) {
      throw new Error(insertErr?.message || 'Falha ao salvar visitante na recepção.');
    }

    return { item: inserted as RecepcaoVisitante, ja_existia: false };
  }

  /**
   * Salva ou atualiza autoridade
   */
  async salvarAutoridade(params: {
    culto_id: string;
    ministry_id: string;
    congregacao_id: string;
    nome: string;
    cargo_funcao: string;
    instituicao?: string | null;
    observacoes?: string | null;
    id?: string;
  }): Promise<RecepcaoAutoridade> {
    const payload = {
      culto_id: params.culto_id,
      ministry_id: params.ministry_id,
      congregacao_id: params.congregacao_id,
      nome: params.nome.trim(),
      cargo_funcao: params.cargo_funcao.trim(),
      instituicao: params.instituicao?.trim() || null,
      observacoes: params.observacoes?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (params.id) {
      try {
        const { data, error } = await this.admin
          .from('culto_recepcao_autoridades')
          .update(payload)
          .eq('id', params.id)
          .eq('culto_id', params.culto_id)
          .select('*')
          .single();

        if (!error && data) return data as RecepcaoAutoridade;
      } catch {
        // Fallback
      }

      const store = loadStore();
      const item = store.autoridades[params.id];
      if (item) {
        Object.assign(item, payload);
        saveStore(store);
        return item;
      }
    }

    // Inserção nova
    try {
      const { data, error } = await this.admin
        .from('culto_recepcao_autoridades')
        .insert(payload)
        .select('*')
        .single();

      if (!error && data) return data as RecepcaoAutoridade;
    } catch {
      // Fallback
    }

    const id = `aut_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const novo: RecepcaoAutoridade = {
      id,
      ...payload,
      created_at: new Date().toISOString(),
    };
    const store = loadStore();
    store.autoridades[id] = novo;
    saveStore(store);
    return novo;
  }

  /**
   * Salva ou atualiza pedido de oração
   */
  async salvarOracao(params: {
    culto_id: string;
    ministry_id: string;
    congregacao_id: string;
    nome: string;
    tipo?: 'pedido' | 'acao_de_gracas';
    categoria?: string | null;
    motivo: string;
    observacoes?: string | null;
    is_privado?: boolean;
    id?: string;
  }): Promise<RecepcaoOracao> {
    const payload = {
      culto_id: params.culto_id,
      ministry_id: params.ministry_id,
      congregacao_id: params.congregacao_id,
      nome: params.nome.trim(),
      tipo: params.tipo || 'pedido',
      categoria: params.categoria?.trim() || null,
      motivo: params.motivo.trim(),
      observacoes: params.observacoes?.trim() || null,
      is_privado: params.is_privado ?? false,
      updated_at: new Date().toISOString(),
    };

    if (params.id) {
      try {
        const { data, error } = await this.admin
          .from('culto_recepcao_oracoes')
          .update(payload)
          .eq('id', params.id)
          .eq('culto_id', params.culto_id)
          .select('*')
          .single();

        if (!error && data) return data as RecepcaoOracao;
      } catch {
        // Fallback
      }

      const store = loadStore();
      const item = store.oracoes[params.id];
      if (item) {
        Object.assign(item, payload);
        saveStore(store);
        return item;
      }
    }

    // Inserção nova
    try {
      const { data, error } = await this.admin
        .from('culto_recepcao_oracoes')
        .insert(payload)
        .select('*')
        .single();

      if (!error && data) return data as RecepcaoOracao;
    } catch {
      // Fallback
    }

    const id = `ora_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const novo: RecepcaoOracao = {
      id,
      ...payload,
      created_at: new Date().toISOString(),
    };
    const store = loadStore();
    store.oracoes[id] = novo;
    saveStore(store);
    return novo;
  }

  /**
   * Salva ou atualiza aviso
   */
  async salvarAviso(params: {
    culto_id: string;
    ministry_id: string;
    congregacao_id: string;
    titulo: string;
    conteudo: string;
    ordem?: number;
    id?: string;
  }): Promise<RecepcaoAviso> {
    const payload = {
      culto_id: params.culto_id,
      ministry_id: params.ministry_id,
      congregacao_id: params.congregacao_id,
      titulo: params.titulo.trim(),
      conteudo: params.conteudo.trim(),
      ordem: Number(params.ordem) || 1,
      updated_at: new Date().toISOString(),
    };

    if (params.id) {
      try {
        const { data, error } = await this.admin
          .from('culto_recepcao_avisos')
          .update(payload)
          .eq('id', params.id)
          .eq('culto_id', params.culto_id)
          .select('*')
          .single();

        if (!error && data) return data as RecepcaoAviso;
      } catch {
        // Fallback
      }

      const store = loadStore();
      const item = store.avisos[params.id];
      if (item) {
        Object.assign(item, payload);
        saveStore(store);
        return item;
      }
    }

    // Inserção nova
    try {
      const { data, error } = await this.admin
        .from('culto_recepcao_avisos')
        .insert(payload)
        .select('*')
        .single();

      if (!error && data) return data as RecepcaoAviso;
    } catch {
      // Fallback
    }

    const id = `avi_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const novo: RecepcaoAviso = {
      id,
      ...payload,
      created_at: new Date().toISOString(),
    };
    const store = loadStore();
    store.avisos[id] = novo;
    saveStore(store);
    return novo;
  }

  /**
   * Salva ou atualiza família
   */
  async salvarFamilia(params: {
    culto_id: string;
    ministry_id: string;
    congregacao_id: string;
    responsavel: string;
    membros_familia?: string | null;
    total_membros?: number;
    origem?: string | null;
    contato?: string | null;
    intencao_congregar?: boolean;
    observacoes?: string | null;
    id?: string;
  }): Promise<RecepcaoFamilia> {
    const payload = {
      culto_id: params.culto_id,
      ministry_id: params.ministry_id,
      congregacao_id: params.congregacao_id,
      responsavel: params.responsavel.trim(),
      membros_familia: params.membros_familia?.trim() || null,
      total_membros: Math.max(1, Number(params.total_membros) || 1),
      origem: params.origem?.trim() || null,
      contato: params.contato?.trim() || null,
      intencao_congregar: params.intencao_congregar ?? false,
      observacoes: params.observacoes?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (params.id) {
      try {
        const { data, error } = await this.admin
          .from('culto_recepcao_familias')
          .update(payload)
          .eq('id', params.id)
          .eq('culto_id', params.culto_id)
          .select('*')
          .single();

        if (!error && data) return data as RecepcaoFamilia;
      } catch {
        // Fallback
      }

      const store = loadStore();
      const item = store.familias[params.id];
      if (item) {
        Object.assign(item, payload);
        saveStore(store);
        return item;
      }
    }

    // Inserção nova
    try {
      const { data, error } = await this.admin
        .from('culto_recepcao_familias')
        .insert(payload)
        .select('*')
        .single();

      if (!error && data) return data as RecepcaoFamilia;
    } catch {
      // Fallback
    }

    const id = `fam_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const novo: RecepcaoFamilia = {
      id,
      ...payload,
      created_at: new Date().toISOString(),
    };
    const store = loadStore();
    store.familias[id] = novo;
    saveStore(store);
    return novo;
  }

  /**
   * Exclusão lógica (soft delete) uniforme para qualquer seção
   */
  async removerItem(secao: 'visitantes' | 'autoridades' | 'oracoes' | 'avisos' | 'familias', id: string, cultoId: string): Promise<boolean> {
    const nowIso = new Date().toISOString();

    if (secao === 'visitantes') {
      // Para visitantes, se a coluna deleted_at existir usa update soft-delete, caso contrário delete físico
      try {
        const { error } = await this.admin
          .from('culto_visitantes')
          .update({ deleted_at: nowIso, updated_at: nowIso })
          .eq('id', id)
          .eq('culto_id', cultoId);

        if (!error) return true;
      } catch {
        // Fallback
      }

      // Se der erro por falta da coluna deleted_at antes da migration, faz delete seguro
      const { error: delErr } = await this.admin
        .from('culto_visitantes')
        .delete()
        .eq('id', id)
        .eq('culto_id', cultoId);
      return !delErr;
    }

    const tableMap = {
      autoridades: 'culto_recepcao_autoridades',
      oracoes: 'culto_recepcao_oracoes',
      avisos: 'culto_recepcao_avisos',
      familias: 'culto_recepcao_familias',
    };

    const tableName = tableMap[secao];
    try {
      const { error } = await this.admin
        .from(tableName)
        .update({ deleted_at: nowIso, updated_at: nowIso })
        .eq('id', id)
        .eq('culto_id', cultoId);

      if (!error) return true;
    } catch {
      // Fallback
    }

    // Fallback store soft delete
    const store = loadStore();
    if (secao === 'autoridades') {
      const item = store.autoridades[id];
      if (item && item.culto_id === cultoId) {
        item.deleted_at = nowIso;
        saveStore(store);
        return true;
      }
    } else if (secao === 'oracoes') {
      const item = store.oracoes[id];
      if (item && item.culto_id === cultoId) {
        item.deleted_at = nowIso;
        saveStore(store);
        return true;
      }
    } else if (secao === 'avisos') {
      const item = store.avisos[id];
      if (item && item.culto_id === cultoId) {
        item.deleted_at = nowIso;
        saveStore(store);
        return true;
      }
    } else if (secao === 'familias') {
      const item = store.familias[id];
      if (item && item.culto_id === cultoId) {
        item.deleted_at = nowIso;
        saveStore(store);
        return true;
      }
    }

    return false;
  }
}
