import { SupabaseClient } from '@supabase/supabase-js';

// ─── TYPES & INTERFACES ────────────────────────────────────────────────────────

export interface ExecutiveMetrics {
  totalMembros: number;
  membrosAtivos: number;
  membrosInativos: number;
  membrosTransferidos: number;
  membrosFalecidos: number;
  totalCongregados: number;
  totalCriancas: number;
  totalMinistros: number;
  novosMembrosMes: number;
  novosMembrosAno: number;
  batismosAno: number;
  alertas: {
    semCpf: number;
    semDataNascimento: number;
    semTelefone: number;
    semEndereco: number;
    semFoto: number;
    cartasPendentes: number;
  };
}

export interface FaixaEtariaCount {
  faixa: '0-11' | '12-17' | '18-29' | '30-59' | '60+' | 'nao_informado';
  label: string;
  total: number;
  percentual: number;
}

export interface DemographicsSummary {
  totalGeral: number;
  porSexo: {
    masculino: number;
    feminino: number;
    naoInformado: number;
  };
  porEstadoCivil: Record<string, number>;
  porTipoCadastro: Record<string, number>;
  porCargoMinisterial: Record<string, number>;
  porFaixaEtaria: FaixaEtariaCount[];
}

export interface IncompleteProfileItem {
  id: string;
  name: string;
  tipo_cadastro: string | null;
  cargo_ministerial: string | null;
  congregacao_nome?: string | null;
  pendencias: ('cpf' | 'data_nascimento' | 'telefone' | 'endereco' | 'foto')[];
}

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface GrowthTrendItem {
  mesKey: string; // YYYY-MM
  label: string;  // MMM/YY
  novosCadastros: number;
}

export interface BirthdayItem {
  id: string;
  name: string;
  data_nascimento: string;
  idadeAtual: number;
  idadeCompletara: number;
  dia: number;
  mes: number;
  telefone: string;
  congregacao_id: string | null;
  congregacao_nome: string | null;
  isHoje: boolean;
}

export interface BirthdaysSummaryData {
  hoje: BirthdayItem[];
  semana: BirthdayItem[];
  mes: BirthdayItem[];
  proximos_30: BirthdayItem[];
  todos: BirthdayItem[];
  contagemPorMes: Record<number, number>;
  totalAnual: number;
}

export interface LettersStats {
  pedidos: {
    total: number;
    pendentes: number;
    autorizados: number;
    rejeitados: number;
  };
  registrosEmitidos: {
    total: number;
    emitidas: number;
    canceladas: number;
  };
  porTipo: Record<string, number>;
}

export interface BaptismsAndActsStats {
  batismos: {
    total: number;
    registrados: number;
    batizados: number;
    cancelados: number;
  };
  apresentacoesCriancas: {
    total: number;
    agendadas: number;
    apresentadas: number;
    canceladas: number;
  };
  casamentos: {
    total: number;
    registrados: number;
    realizados: number;
    cancelados: number;
  };
  consagracoes: {
    total: number;
    emProcesso: number;
    aprovadas: number;
    concluidas: number;
    rejeitadas: number;
  };
}

export interface CustomMembersQueryParams {
  search?: string;
  status?: string;
  tipo_cadastro?: string;
  congregacao_id?: string;
  sexo?: string;
  estado_civil?: string;
  cargo_ministerial?: string;
  tem_funcao_igreja?: boolean;
  batizado_aguas?: boolean;
  batizado_espirito_santo?: boolean;
  tem_curso_teologico?: boolean;
  procedencia?: string;
  qualidade_cadastral?: 'completo' | 'pendencias' | 'sem_cpf' | 'sem_telefone' | 'sem_data_nascimento' | 'sem_endereco' | 'sem_foto';
  faixa_etaria?: '0-11' | '12-17' | '18-29' | '30-59' | '60+' | 'nao_informado';
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ─── PURE HELPER FUNCTIONS FOR CALCULATIONS & LOGIC ─────────────────────────────

/**
 * Calcula a idade de uma pessoa baseada na data de nascimento (YYYY-MM-DD).
 */
export function calculateAge(birthDateStr?: string | null, referenceDate = new Date()): number | null {
  if (!birthDateStr) return null;
  const parts = birthDateStr.split('T')[0].split('-');
  if (parts.length !== 3) return null;
  const birthYear = parseInt(parts[0], 10);
  const birthMonth = parseInt(parts[1], 10) - 1;
  const birthDay = parseInt(parts[2], 10);

  let age = referenceDate.getFullYear() - birthYear;
  const m = referenceDate.getMonth() - birthMonth;
  if (m < 0 || (m === 0 && referenceDate.getDate() < birthDay)) {
    age--;
  }
  return age >= 0 ? age : null;
}

/**
 * Classifica a idade em uma faixa etária oficial da Eklésia.
 */
export function categorizeAge(age: number | null): '0-11' | '12-17' | '18-29' | '30-59' | '60+' | 'nao_informado' {
  if (age === null || age === undefined || isNaN(age)) return 'nao_informado';
  if (age <= 11) return '0-11';
  if (age <= 17) return '12-17';
  if (age <= 29) return '18-29';
  if (age <= 59) return '30-59';
  return '60+';
}

/**
 * Verifica se uma data de aniversário ocorre dentro do intervalo de próximos dias (ex: 30 dias),
 * considerando corretamente a virada de mês e de ano.
 */
export function isBirthdayInNextDays(
  birthDateStr: string | null | undefined,
  daysCount: number,
  referenceDate = new Date()
): boolean {
  if (!birthDateStr) return false;
  const parts = birthDateStr.split('T')[0].split('-');
  if (parts.length !== 3) return false;
  const birthMonth = parseInt(parts[1], 10) - 1; // 0-indexed
  const birthDay = parseInt(parts[2], 10);

  const refYear = referenceDate.getFullYear();
  // Aniversário no ano corrente
  let nextBday = new Date(refYear, birthMonth, birthDay);
  
  // Normalizar referências para meia-noite
  const refMidnight = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  
  // Se já passou este ano, avaliar no próximo ano (para tratar virada de ano)
  if (nextBday < refMidnight) {
    nextBday = new Date(refYear + 1, birthMonth, birthDay);
  }

  const diffTime = nextBday.getTime() - refMidnight.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  return diffDays >= 0 && diffDays <= daysCount;
}

/**
 * Verifica se a data de nascimento cai na mesma semana da data de referência (Domingo a Sábado).
 */
export function isBirthdayInCurrentWeek(
  birthDateStr: string | null | undefined,
  referenceDate = new Date()
): boolean {
  if (!birthDateStr) return false;
  const parts = birthDateStr.split('T')[0].split('-');
  if (parts.length !== 3) return false;
  const birthMonth = parseInt(parts[1], 10) - 1;
  const birthDay = parseInt(parts[2], 10);

  const refMidnight = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const dayOfWeek = refMidnight.getDay(); // 0 (Dom) a 6 (Sáb)
  
  const startOfWeek = new Date(refMidnight);
  startOfWeek.setDate(refMidnight.getDate() - dayOfWeek);
  
  const endOfWeek = new Date(refMidnight);
  endOfWeek.setDate(refMidnight.getDate() + (6 - dayOfWeek));

  const yearsToCheck = [referenceDate.getFullYear(), referenceDate.getFullYear() + 1];
  for (const yr of yearsToCheck) {
    const bday = new Date(yr, birthMonth, birthDay);
    if (bday >= startOfWeek && bday <= endOfWeek) {
      return true;
    }
  }
  return false;
}

// ─── SERVICE CLASS ─────────────────────────────────────────────────────────────

export class SecretaryReportsService {
  private readonly supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * 1. Métricas Executivas da Secretaria (Visão Geral e Alertas)
   */
  async getExecutiveMetrics(ministryId: string, congregacaoId?: string | null): Promise<ExecutiveMetrics> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const startOfYear = `${currentYear}-01-01T00:00:00.000Z`;
    const startOfMonth = `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}-01T00:00:00.000Z`;

    // Consulta de membros com escopo
    let membersQuery = this.supabase
      .from('members')
      .select('id, status, tipo_cadastro, created_at, member_since, cpf, data_nascimento, phone, celular, whatsapp, logradouro, cep, foto_url')
      .eq('ministry_id', ministryId);

    if (congregacaoId) {
      membersQuery = membersQuery.eq('congregacao_id', congregacaoId);
    }

    const { data: membersData, error: membersError } = await membersQuery;
    if (membersError) {
      throw new Error(`Erro ao buscar métricas de membros: ${membersError.message}`);
    }

    const members = membersData || [];

    let totalMembros = 0;
    let membrosAtivos = 0;
    let membrosInativos = 0;
    let membrosTransferidos = 0;
    let membrosFalecidos = 0;
    let totalCongregados = 0;
    let totalCriancas = 0;
    let totalMinistros = 0;
    let novosMembrosMes = 0;
    let novosMembrosAno = 0;

    let semCpf = 0;
    let semDataNascimento = 0;
    let semTelefone = 0;
    let semEndereco = 0;
    let semFoto = 0;

    for (const m of members) {
      const tipo = (m.tipo_cadastro || '').toLowerCase();
      const status = (m.status || '').toLowerCase();

      // Contagem por Tipo
      if (tipo === 'congregado') totalCongregados++;
      else if (tipo === 'crianca') totalCriancas++;
      else if (tipo === 'ministro') totalMinistros++;
      else totalMembros++; // 'membro' ou padrão

      // Contagem por Status
      if (status === 'active') membrosAtivos++;
      else if (status === 'inactive') membrosInativos++;
      else if (status === 'transferred') membrosTransferidos++;
      else if (status === 'deceased') membrosFalecidos++;

      // Novos membros no período (baseado em member_since ou created_at)
      const dataEntrada = m.member_since || m.created_at;
      if (dataEntrada) {
        if (dataEntrada >= startOfMonth) novosMembrosMes++;
        if (dataEntrada >= startOfYear) novosMembrosAno++;
      }

      // Alertas de Qualidade Cadastral (apenas membros e congregados ativos)
      if (status === 'active' || !status) {
        if (!m.cpf || m.cpf.trim() === '') semCpf++;
        if (!m.data_nascimento) semDataNascimento++;
        const temFone = Boolean((m.phone && m.phone.trim()) || (m.celular && m.celular.trim()) || (m.whatsapp && m.whatsapp.trim()));
        if (!temFone) semTelefone++;
        const temEnd = Boolean((m.logradouro && m.logradouro.trim()) || (m.cep && m.cep.trim()));
        if (!temEnd) semEndereco++;
        if (!m.foto_url || m.foto_url.trim() === '') semFoto++;
      }
    }

    // Consulta de Pedidos de Cartas Pendentes
    let cartasQuery = this.supabase
      .from('carta_pedidos')
      .select('id', { count: 'exact', head: true })
      .eq('ministry_id', ministryId)
      .eq('status', 'pendente');

    if (congregacaoId) {
      cartasQuery = cartasQuery.eq('congregacao_id', congregacaoId);
    }
    const { count: cartasPendentesCount } = await cartasQuery;

    // Consulta de Batismos realizados no ano
    let batismosQuery = this.supabase
      .from('batismo_aguas_registros')
      .select('id', { count: 'exact', head: true })
      .eq('ministry_id', ministryId)
      .eq('status', 'batizado')
      .gte('data_batismo', `${currentYear}-01-01`);

    const { count: batismosCount } = await batismosQuery;

    return {
      totalMembros,
      membrosAtivos,
      membrosInativos,
      membrosTransferidos,
      membrosFalecidos,
      totalCongregados,
      totalCriancas,
      totalMinistros,
      novosMembrosMes,
      novosMembrosAno,
      batismosAno: batismosCount || 0,
      alertas: {
        semCpf,
        semDataNascimento,
        semTelefone,
        semEndereco,
        semFoto,
        cartasPendentes: cartasPendentesCount || 0,
      },
    };
  }

  /**
   * 2. Resumo Demográfico (Gênero, Estado Civil, Faixas Etárias, Cargos)
   */
  async getDemographicsSummary(ministryId: string, congregacaoId?: string | null): Promise<DemographicsSummary> {
    let query = this.supabase
      .from('members')
      .select('sexo, estado_civil, tipo_cadastro, cargo_ministerial, data_nascimento')
      .eq('ministry_id', ministryId)
      .eq('status', 'active');

    if (congregacaoId) {
      query = query.eq('congregacao_id', congregacaoId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Erro ao buscar dados demográficos: ${error.message}`);
    }

    const members = data || [];
    const totalGeral = members.length;

    const porSexo = { masculino: 0, feminino: 0, naoInformado: 0 };
    const porEstadoCivil: Record<string, number> = {};
    const porTipoCadastro: Record<string, number> = {};
    const porCargoMinisterial: Record<string, number> = {};

    const faixaCounts: Record<string, number> = {
      '0-11': 0,
      '12-17': 0,
      '18-29': 0,
      '30-59': 0,
      '60+': 0,
      'nao_informado': 0,
    };

    for (const m of members) {
      // Sexo
      const sexo = (m.sexo || '').toUpperCase();
      if (sexo === 'M' || sexo === 'MASCULINO') porSexo.masculino++;
      else if (sexo === 'F' || sexo === 'FEMININO') porSexo.feminino++;
      else porSexo.naoInformado++;

      // Estado Civil
      const estCivil = (m.estado_civil || 'nao_informado').toLowerCase();
      porEstadoCivil[estCivil] = (porEstadoCivil[estCivil] || 0) + 1;

      // Tipo de Cadastro
      const tipo = (m.tipo_cadastro || 'membro').toLowerCase();
      porTipoCadastro[tipo] = (porTipoCadastro[tipo] || 0) + 1;

      // Cargo Ministerial
      if (m.cargo_ministerial && m.cargo_ministerial.trim()) {
        const cargo = m.cargo_ministerial.trim();
        porCargoMinisterial[cargo] = (porCargoMinisterial[cargo] || 0) + 1;
      }

      // Faixa Etária
      const age = calculateAge(m.data_nascimento);
      const cat = categorizeAge(age);
      faixaCounts[cat] = (faixaCounts[cat] || 0) + 1;
    }

    const faixasLabels: Record<string, string> = {
      '0-11': 'Crianças (0 a 11 anos)',
      '12-17': 'Adolescentes (12 a 17 anos)',
      '18-29': 'Jovens (18 a 29 anos)',
      '30-59': 'Adultos (30 a 59 anos)',
      '60+': 'Idosos (60+ anos)',
      'nao_informado': 'Data não informada',
    };

    const porFaixaEtaria: FaixaEtariaCount[] = (['0-11', '12-17', '18-29', '30-59', '60+', 'nao_informado'] as const).map(
      (faixa) => {
        const count = faixaCounts[faixa] || 0;
        return {
          faixa,
          label: faixasLabels[faixa],
          total: count,
          percentual: totalGeral > 0 ? Number(((count / totalGeral) * 100).toFixed(1)) : 0,
        };
      }
    );

    return {
      totalGeral,
      porSexo,
      porEstadoCivil,
      porTipoCadastro,
      porCargoMinisterial,
      porFaixaEtaria,
    };
  }

  /**
   * 3. Auditoria de Cadastros Incompletos (Paginada)
   */
  async getIncompleteProfiles(
    ministryId: string,
    params: {
      congregacaoId?: string | null;
      pendencia?: 'cpf' | 'data_nascimento' | 'telefone' | 'endereco' | 'foto' | 'qualquer';
      page?: number;
      limit?: number;
    } = {}
  ): Promise<PaginatedResult<IncompleteProfileItem>> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));

    let query = this.supabase
      .from('members')
      .select('id, name, tipo_cadastro, cargo_ministerial, cpf, data_nascimento, phone, celular, whatsapp, logradouro, cep, foto_url, congregacoes(nome)', { count: 'exact' })
      .eq('ministry_id', ministryId)
      .eq('status', 'active');

    if (params.congregacaoId) {
      query = query.eq('congregacao_id', params.congregacaoId);
    }

    if (params.pendencia === 'cpf') {
      query = query.or('cpf.is.null,cpf.eq.""');
    } else if (params.pendencia === 'data_nascimento') {
      query = query.is('data_nascimento', null);
    } else if (params.pendencia === 'foto') {
      query = query.or('foto_url.is.null,foto_url.eq.""');
    }

    const { data, error } = await query.order('name', { ascending: true });
    if (error) {
      throw new Error(`Erro ao buscar cadastros incompletos: ${error.message}`);
    }

    const allMembers = data || [];
    const incompleteItems: IncompleteProfileItem[] = [];

    for (const m of allMembers) {
      const pendencias: ('cpf' | 'data_nascimento' | 'telefone' | 'endereco' | 'foto')[] = [];

      if (!m.cpf || m.cpf.trim() === '') pendencias.push('cpf');
      if (!m.data_nascimento) pendencias.push('data_nascimento');
      const temFone = Boolean((m.phone && m.phone.trim()) || (m.celular && m.celular.trim()) || (m.whatsapp && m.whatsapp.trim()));
      if (!temFone) pendencias.push('telefone');
      const temEnd = Boolean((m.logradouro && m.logradouro.trim()) || (m.cep && m.cep.trim()));
      if (!temEnd) pendencias.push('endereco');
      if (!m.foto_url || m.foto_url.trim() === '') pendencias.push('foto');

      if (pendencias.length > 0) {
        if (!params.pendencia || params.pendencia === 'qualquer' || pendencias.includes(params.pendencia)) {
          incompleteItems.push({
            id: m.id,
            name: m.name || 'Sem Nome',
            tipo_cadastro: m.tipo_cadastro,
            cargo_ministerial: m.cargo_ministerial,
            congregacao_nome: (m.congregacoes as any)?.nome || null,
            pendencias,
          });
        }
      }
    }

    const total = incompleteItems.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const start = (page - 1) * limit;
    const paginatedData = incompleteItems.slice(start, start + limit);

    return {
      data: paginatedData,
      page,
      limit,
      total,
      totalPages,
    };
  }

  /**
   * 4. Evolução de Novos Cadastros (Últimos 12 ou N meses)
   */
  async getGrowthTrends(ministryId: string, monthsCount = 12): Promise<GrowthTrendItem[]> {
    const now = new Date();
    const months: { key: string; label: string; start: string; end: string }[] = [];

    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      months.push({
        key,
        label: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        start: d.toISOString(),
        end: nextMonth.toISOString(),
      });
    }

    const oldestStart = months[0].start;

    const { data, error } = await this.supabase
      .from('members')
      .select('member_since, created_at')
      .eq('ministry_id', ministryId)
      .or(`member_since.gte.${oldestStart.slice(0, 10)},created_at.gte.${oldestStart}`);

    if (error) {
      throw new Error(`Erro ao buscar evolução de crescimento: ${error.message}`);
    }

    const grouped: Record<string, number> = {};
    for (const m of data || []) {
      const dateStr = m.member_since || m.created_at;
      if (!dateStr) continue;
      const key = dateStr.slice(0, 7); // YYYY-MM
      grouped[key] = (grouped[key] || 0) + 1;
    }

    return months.map((m) => ({
      mesKey: m.key,
      label: m.label,
      novosCadastros: grouped[m.key] || 0,
    }));
  }

  /**
   * 5. Aniversariantes do Período (Hoje, Semana, Mês, Próximos 30 dias, Todos/Ano)
   */
  async getBirthdays(
    ministryId: string,
    params: {
      tipo: 'hoje' | 'semana' | 'mes' | 'proximos_30' | 'todos' | 'ano';
      mesSelecionado?: number;
      congregacaoId?: string | null;
    }
  ): Promise<BirthdayItem[]> {
    let query = this.supabase
      .from('members')
      .select('id, name, data_nascimento, phone, celular, whatsapp, congregacao_id, congregacoes(nome)')
      .eq('ministry_id', ministryId)
      .eq('status', 'active')
      .not('data_nascimento', 'is', null);

    if (params.congregacaoId) {
      query = query.eq('congregacao_id', params.congregacaoId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Erro ao consultar aniversariantes: ${error.message}`);
    }

    const members = data || [];
    const now = new Date();
    const currentMonth = params.mesSelecionado || (now.getMonth() + 1);
    const currentDay = now.getDate();

    const results: BirthdayItem[] = [];

    for (const m of members) {
      if (!m.data_nascimento) continue;
      const parts = m.data_nascimento.split('T')[0].split('-');
      if (parts.length !== 3) continue;

      const birthMonth = parseInt(parts[1], 10);
      const birthDay = parseInt(parts[2], 10);

      let match = false;
      const isHoje = birthMonth === (now.getMonth() + 1) && birthDay === currentDay;

      if (params.tipo === 'hoje') {
        match = isHoje;
      } else if (params.tipo === 'semana') {
        match = isBirthdayInCurrentWeek(m.data_nascimento, now);
      } else if (params.tipo === 'mes') {
        match = birthMonth === currentMonth;
      } else if (params.tipo === 'proximos_30') {
        match = isBirthdayInNextDays(m.data_nascimento, 30, now);
      } else if (params.tipo === 'todos' || params.tipo === 'ano') {
        match = true;
      }

      if (match) {
        const idadeAtual = calculateAge(m.data_nascimento, now) || 0;
        const jaFezEsteAno =
          birthMonth < now.getMonth() + 1 ||
          (birthMonth === now.getMonth() + 1 && birthDay <= currentDay);
        const idadeCompletara = jaFezEsteAno ? idadeAtual : idadeAtual + 1;

        const telefone = m.whatsapp || m.celular || m.phone || '';

        results.push({
          id: m.id,
          name: m.name || 'Sem Nome',
          data_nascimento: m.data_nascimento,
          idadeAtual,
          idadeCompletara,
          dia: birthDay,
          mes: birthMonth,
          telefone,
          congregacao_id: m.congregacao_id,
          congregacao_nome: (m.congregacoes as any)?.nome || null,
          isHoje,
        });
      }
    }

    return results.sort((a, b) => {
      if (params.tipo === 'proximos_30') {
        const getDiffDays = (item: BirthdayItem) => {
          let bday = new Date(now.getFullYear(), item.mes - 1, item.dia);
          const ref = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          if (bday < ref) bday = new Date(now.getFullYear() + 1, item.mes - 1, item.dia);
          return bday.getTime() - ref.getTime();
        };
        return getDiffDays(a) - getDiffDays(b);
      }
      if (a.mes !== b.mes) return a.mes - b.mes;
      return a.dia - b.dia;
    });
  }

  /**
   * 5.1 Resumo Completo Anual de Aniversariantes com Contagens por Mês
   */
  async getBirthdaysSummary(
    ministryId: string,
    congregacaoId?: string | null
  ): Promise<BirthdaysSummaryData> {
    let query = this.supabase
      .from('members')
      .select('id, name, data_nascimento, phone, celular, whatsapp, congregacao_id, congregacoes(nome)')
      .eq('ministry_id', ministryId)
      .eq('status', 'active')
      .not('data_nascimento', 'is', null);

    if (congregacaoId) {
      query = query.eq('congregacao_id', congregacaoId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Erro ao consultar resumo de aniversariantes: ${error.message}`);
    }

    const members = data || [];
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();

    const contagemPorMes: Record<number, number> = {
      1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0,
      7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0,
    };

    const todos: BirthdayItem[] = [];
    const hoje: BirthdayItem[] = [];
    const semana: BirthdayItem[] = [];
    const mes: BirthdayItem[] = [];
    const proximos_30: BirthdayItem[] = [];

    for (const m of members) {
      if (!m.data_nascimento) continue;
      const parts = m.data_nascimento.split('T')[0].split('-');
      if (parts.length !== 3) continue;

      const birthMonth = parseInt(parts[1], 10);
      const birthDay = parseInt(parts[2], 10);

      if (birthMonth >= 1 && birthMonth <= 12) {
        contagemPorMes[birthMonth] = (contagemPorMes[birthMonth] || 0) + 1;
      }

      const isHoje = birthMonth === currentMonth && birthDay === currentDay;
      const idadeAtual = calculateAge(m.data_nascimento, now) || 0;
      const jaFezEsteAno =
        birthMonth < currentMonth ||
        (birthMonth === currentMonth && birthDay <= currentDay);
      const idadeCompletara = jaFezEsteAno ? idadeAtual : idadeAtual + 1;
      const telefone = m.whatsapp || m.celular || m.phone || '';

      const item: BirthdayItem = {
        id: m.id,
        name: m.name || 'Sem Nome',
        data_nascimento: m.data_nascimento,
        idadeAtual,
        idadeCompletara,
        dia: birthDay,
        mes: birthMonth,
        telefone,
        congregacao_id: m.congregacao_id,
        congregacao_nome: (m.congregacoes as any)?.nome || null,
        isHoje,
      };

      todos.push(item);

      if (isHoje) {
        hoje.push(item);
      }

      if (isBirthdayInCurrentWeek(m.data_nascimento, now)) {
        semana.push(item);
      }

      if (birthMonth === currentMonth) {
        mes.push(item);
      }

      if (isBirthdayInNextDays(m.data_nascimento, 30, now)) {
        proximos_30.push(item);
      }
    }

    const sortFn = (a: BirthdayItem, b: BirthdayItem) => {
      if (a.mes !== b.mes) return a.mes - b.mes;
      return a.dia - b.dia;
    };

    todos.sort(sortFn);
    hoje.sort(sortFn);
    semana.sort(sortFn);
    mes.sort(sortFn);

    proximos_30.sort((a, b) => {
      const getDiffDays = (item: BirthdayItem) => {
        let bday = new Date(now.getFullYear(), item.mes - 1, item.dia);
        const ref = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (bday < ref) bday = new Date(now.getFullYear() + 1, item.mes - 1, item.dia);
        return bday.getTime() - ref.getTime();
      };
      return getDiffDays(a) - getDiffDays(b);
    });

    return {
      hoje,
      semana,
      mes,
      proximos_30,
      todos,
      contagemPorMes,
      totalAnual: todos.length,
    };
  }

  /**
   * 6. Estatísticas de Cartas Ministeriais
   */
  async getLettersStats(ministryId: string, congregacaoId?: string | null): Promise<LettersStats> {
    let pedidosQuery = this.supabase
      .from('carta_pedidos')
      .select('status, tipo_carta')
      .eq('ministry_id', ministryId);

    if (congregacaoId) {
      pedidosQuery = pedidosQuery.eq('congregacao_id', congregacaoId);
    }

    const { data: pedidosData, error: pedidosError } = await pedidosQuery;
    if (pedidosError) {
      throw new Error(`Erro ao buscar pedidos de cartas: ${pedidosError.message}`);
    }

    const pedidosList = pedidosData || [];
    let pendentes = 0;
    let autorizados = 0;
    let rejeitados = 0;
    const porTipo: Record<string, number> = {};

    for (const p of pedidosList) {
      const s = (p.status || '').toLowerCase();
      if (s === 'pendente') pendentes++;
      else if (s === 'autorizado') autorizados++;
      else if (s === 'rejeitado') rejeitados++;

      if (p.tipo_carta) {
        porTipo[p.tipo_carta] = (porTipo[p.tipo_carta] || 0) + 1;
      }
    }

    const { data: registrosData, error: registrosError } = await this.supabase
      .from('cartas_registros')
      .select('status')
      .eq('ministry_id', ministryId);

    if (registrosError) {
      throw new Error(`Erro ao buscar registros de cartas emitidas: ${registrosError.message}`);
    }

    const registrosList = registrosData || [];
    let emitidas = 0;
    let canceladas = 0;

    for (const r of registrosList) {
      const s = (r.status || '').toLowerCase();
      if (s === 'emitida') emitidas++;
      else if (s === 'cancelada') canceladas++;
    }

    return {
      pedidos: {
        total: pedidosList.length,
        pendentes,
        autorizados,
        rejeitados,
      },
      registrosEmitidos: {
        total: registrosList.length,
        emitidas,
        canceladas,
      },
      porTipo,
    };
  }

  /**
   * 7. Estatísticas de Batismos e Atos Pastorais
   */
  async getBaptismsAndActsStats(
    ministryId: string,
    params: { year?: number; congregacaoId?: string | null } = {}
  ): Promise<BaptismsAndActsStats> {
    const year = params.year || new Date().getFullYear();
    const yearPrefix = String(year);

    const { data: batismosData, error: batismosError } = await this.supabase
      .from('batismo_aguas_registros')
      .select('status, data_batismo')
      .eq('ministry_id', ministryId)
      .gte('data_batismo', `${yearPrefix}-01-01`)
      .lte('data_batismo', `${yearPrefix}-12-31`);

    if (batismosError) throw new Error(`Erro ao buscar batismos: ${batismosError.message}`);

    let batRegistrados = 0;
    let batBatizados = 0;
    let batCancelados = 0;
    for (const b of batismosData || []) {
      const s = (b.status || '').toLowerCase();
      if (s === 'batizado') batBatizados++;
      else if (s === 'registrado') batRegistrados++;
      else if (s === 'cancelado') batCancelados++;
    }

    const { data: criancasData, error: criancasError } = await this.supabase
      .from('apresentacao_criancas_registros')
      .select('status, data_apresentacao')
      .eq('ministry_id', ministryId)
      .gte('data_apresentacao', `${yearPrefix}-01-01`)
      .lte('data_apresentacao', `${yearPrefix}-12-31`);

    if (criancasError) throw new Error(`Erro ao buscar apresentações: ${criancasError.message}`);

    let criAgendadas = 0;
    let criApresentadas = 0;
    let criCanceladas = 0;
    for (const c of criancasData || []) {
      const s = (c.status || '').toLowerCase();
      if (s === 'apresentado') criApresentadas++;
      else if (s === 'agendado') criAgendadas++;
      else if (s === 'cancelado') criCanceladas++;
    }

    const { data: casamentosData, error: casamentosError } = await this.supabase
      .from('casamento_registros')
      .select('status, data_casamento')
      .eq('ministry_id', ministryId)
      .gte('data_casamento', `${yearPrefix}-01-01`)
      .lte('data_casamento', `${yearPrefix}-12-31`);

    if (casamentosError) throw new Error(`Erro ao buscar casamentos: ${casamentosError.message}`);

    let casRegistrados = 0;
    let casRealizados = 0;
    let casCancelados = 0;
    for (const cs of casamentosData || []) {
      const s = (cs.status || '').toLowerCase();
      if (s === 'realizado') casRealizados++;
      else if (s === 'registrado') casRegistrados++;
      else if (s === 'cancelado') casCancelados++;
    }

    const { data: consagracoesData, error: consagracoesError } = await this.supabase
      .from('consagracao_registros')
      .select('status_processo, data_processo')
      .eq('ministry_id', ministryId)
      .gte('data_processo', `${yearPrefix}-01-01`)
      .lte('data_processo', `${yearPrefix}-12-31`);

    if (consagracoesError) throw new Error(`Erro ao buscar consagrações: ${consagracoesError.message}`);

    let conEmProcesso = 0;
    let conAprovadas = 0;
    let conConcluidas = 0;
    let conRejeitadas = 0;
    for (const cg of consagracoesData || []) {
      const s = (cg.status_processo || '').toLowerCase();
      if (s === 'em_processo') conEmProcesso++;
      else if (s === 'aprovado') conAprovadas++;
      else if (s === 'concluido') conConcluidas++;
      else if (s === 'rejeitado') conRejeitadas++;
    }

    return {
      batismos: {
        total: (batismosData || []).length,
        registrados: batRegistrados,
        batizados: batBatizados,
        cancelados: batCancelados,
      },
      apresentacoesCriancas: {
        total: (criancasData || []).length,
        agendadas: criAgendadas,
        apresentadas: criApresentadas,
        canceladas: criCanceladas,
      },
      casamentos: {
        total: (casamentosData || []).length,
        registrados: casRegistrados,
        realizados: casRealizados,
        cancelados: casCancelados,
      },
      consagracoes: {
        total: (consagracoesData || []).length,
        emProcesso: conEmProcesso,
        aprovadas: conAprovadas,
        concluidas: conConcluidas,
        rejeitadas: conRejeitadas,
      },
    };
  }

  /**
   * 8. Consulta Customizada e Paginada de Membros (Construtor de Relatórios)
   */
  async queryCustomMembersList(
    ministryId: string,
    params: CustomMembersQueryParams = {}
  ): Promise<PaginatedResult<any>> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(200, Math.max(1, params.limit || 25));
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('members')
      .select(
        'id, name, email, cpf, rg, matricula, tipo_cadastro, status, cargo_ministerial, data_nascimento, sexo, estado_civil, phone, celular, whatsapp, logradouro, numero, bairro, cidade, estado, cep, foto_url, data_batismo_aguas, data_batismo_espirito_santo, curso_teologico, instituicao_teologica, procedencia, tem_funcao_igreja, qual_funcao, setor_departamento, congregacao_id, congregacoes(nome), member_since, created_at',
        { count: 'exact' }
      )
      .eq('ministry_id', ministryId);

    if (params.search && params.search.trim()) {
      const term = `%${params.search.trim()}%`;
      query = query.or(`name.ilike.${term},cpf.ilike.${term},matricula.ilike.${term}`);
    }

    if (params.status) {
      query = query.eq('status', params.status);
    }
    if (params.tipo_cadastro) {
      query = query.eq('tipo_cadastro', params.tipo_cadastro);
    }
    if (params.congregacao_id) {
      query = query.eq('congregacao_id', params.congregacao_id);
    }
    if (params.sexo) {
      query = query.eq('sexo', params.sexo);
    }
    if (params.estado_civil) {
      query = query.eq('estado_civil', params.estado_civil);
    }
    if (params.cargo_ministerial) {
      query = query.eq('cargo_ministerial', params.cargo_ministerial);
    }
    if (params.tem_funcao_igreja !== undefined) {
      query = query.eq('tem_funcao_igreja', params.tem_funcao_igreja);
    }
    if (params.batizado_aguas === true) {
      query = query.not('data_batismo_aguas', 'is', null);
    } else if (params.batizado_aguas === false) {
      query = query.is('data_batismo_aguas', null);
    }
    if (params.batizado_espirito_santo === true) {
      query = query.not('data_batismo_espirito_santo', 'is', null);
    } else if (params.batizado_espirito_santo === false) {
      query = query.is('data_batismo_espirito_santo', null);
    }
    if (params.tem_curso_teologico === true) {
      query = query.not('curso_teologico', 'is', null);
    } else if (params.tem_curso_teologico === false) {
      query = query.is('curso_teologico', null);
    }
    if (params.procedencia) {
      query = query.ilike('procedencia', `%${params.procedencia.trim()}%`);
    }

    // Qualidade Cadastral rápida (server-side onde possível)
    if (params.qualidade_cadastral === 'sem_cpf') {
      query = query.or('cpf.is.null,cpf.eq.""');
    } else if (params.qualidade_cadastral === 'sem_data_nascimento') {
      query = query.or('data_nascimento.is.null,data_nascimento.eq.""');
    } else if (params.qualidade_cadastral === 'sem_endereco') {
      query = query.or('logradouro.is.null,logradouro.eq.""');
    } else if (params.qualidade_cadastral === 'sem_foto') {
      query = query.or('foto_url.is.null,foto_url.eq.""');
    }

    const sortColumn = params.sortBy || 'name';
    const ascending = params.sortOrder !== 'desc';

    const { data, count, error } = await query
      .order(sortColumn, { ascending })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Erro ao executar consulta customizada de membros: ${error.message}`);
    }

    let items = (data || []).map((m: any) => ({
      ...m,
      congregacao_nome: m.congregacoes?.nome || null,
      idade: calculateAge(m.data_nascimento),
    }));

    if (params.faixa_etaria) {
      items = items.filter((m) => categorizeAge(m.idade) === params.faixa_etaria);
    }

    if (params.qualidade_cadastral === 'sem_telefone') {
      items = items.filter((m) => {
        return (!m.phone || !m.phone.trim()) && (!m.celular || !m.celular.trim()) && (!m.whatsapp || !m.whatsapp.trim());
      });
    } else if (params.qualidade_cadastral === 'pendencias') {
      items = items.filter((m) => {
        const hasNoCpf = !m.cpf || !m.cpf.trim();
        const hasNoBirth = !m.data_nascimento || !m.data_nascimento.trim();
        const hasNoPhone = (!m.phone || !m.phone.trim()) && (!m.celular || !m.celular.trim()) && (!m.whatsapp || !m.whatsapp.trim());
        const hasNoAddr = !m.logradouro || !m.logradouro.trim();
        const hasNoPhoto = !m.foto_url || !m.foto_url.trim();
        return hasNoCpf || hasNoBirth || hasNoPhone || hasNoAddr || hasNoPhoto;
      });
    } else if (params.qualidade_cadastral === 'completo') {
      items = items.filter((m) => {
        const hasNoCpf = !m.cpf || !m.cpf.trim();
        const hasNoBirth = !m.data_nascimento || !m.data_nascimento.trim();
        const hasNoPhone = (!m.phone || !m.phone.trim()) && (!m.celular || !m.celular.trim()) && (!m.whatsapp || !m.whatsapp.trim());
        const hasNoAddr = !m.logradouro || !m.logradouro.trim();
        const hasNoPhoto = !m.foto_url || !m.foto_url.trim();
        return !hasNoCpf && !hasNoBirth && !hasNoPhone && !hasNoAddr && !hasNoPhoto;
      });
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: items,
      page,
      limit,
      total,
      totalPages,
    };
  }
}
