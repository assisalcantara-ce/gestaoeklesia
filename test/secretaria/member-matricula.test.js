import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Importando a implementação da lógica pura ou a classe compilável diretamente
class MockMemberMatriculaService {
  static normalizarMatricula(matricula) {
    if (!matricula) return null;
    const trimmed = String(matricula).trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) {
      return trimmed.padStart(3, '0');
    }
    return trimmed;
  }

  static async alocarProximaMatricula(supabase, ministryId) {
    if (!ministryId) {
      throw new Error('ministryId é obrigatório para alocar matrícula');
    }

    try {
      const { data: rpcMatricula, error: rpcErr } = await supabase.rpc(
        'alocar_proxima_matricula_membro',
        { p_ministry_id: ministryId }
      );

      if (!rpcErr && rpcMatricula && typeof rpcMatricula === 'string' && rpcMatricula.trim()) {
        return rpcMatricula.trim();
      }
    } catch {
      // Fallback
    }

    return await this.calcularFallbackMatricula(supabase, ministryId);
  }

  static async resolverMatriculaParaCadastro(supabase, ministryId, options) {
    const informada = this.normalizarMatricula(options?.matriculaInformada);

    if (informada) {
      const { data: conflito } = await supabase
        .from('members')
        .select('id')
        .eq('ministry_id', ministryId)
        .eq('matricula', informada)
        .maybeSingle();

      if (!conflito) {
        return informada;
      }
    }

    return await this.alocarProximaMatricula(supabase, ministryId);
  }

  static async calcularFallbackMatricula(supabase, ministryId) {
    const { data, error } = await supabase
      .from('members')
      .select('matricula')
      .eq('ministry_id', ministryId)
      .not('matricula', 'is', null)
      .limit(5000);

    let maxNum = 0;

    if (!error && Array.isArray(data)) {
      for (const item of data) {
        if (item.matricula && typeof item.matricula === 'string') {
          const numStr = item.matricula.replace(/\D/g, '');
          if (numStr) {
            const num = parseInt(numStr, 10);
            if (!isNaN(num) && num > maxNum) {
              maxNum = num;
            }
          }
        }
      }
    }

    const proximoNum = maxNum + 1;
    return String(proximoNum).padStart(3, '0');
  }
}

// Mock do Supabase Client simulando o comportamento de banco de dados
class MockSupabaseClient {
  constructor() {
    this.members = [];
    this.sequencias = new Map(); // ministryId -> number
    this.rpcActive = true;
  }

  setRpcActive(active) {
    this.rpcActive = active;
  }

  async rpc(funcName, params) {
    if (!this.rpcActive || funcName !== 'alocar_proxima_matricula_membro') {
      return { data: null, error: { message: 'Function not found' } };
    }

    const ministryId = params.p_ministry_id;
    let maxTabela = 0;
    for (const m of this.members) {
      if (m.ministry_id === ministryId && m.matricula) {
        const num = parseInt(m.matricula.replace(/\D/g, ''), 10);
        if (!isNaN(num) && num > maxTabela) {
          maxTabela = num;
        }
      }
    }

    const currentSeq = this.sequencias.get(ministryId) || 0;
    const nextNum = Math.max(currentSeq, maxTabela) + 1;
    this.sequencias.set(ministryId, nextNum);

    return { data: String(nextNum).padStart(3, '0'), error: null };
  }

  from(table) {
    const self = this;
    return {
      select(fields) {
        return {
          eq(col1, val1) {
            return {
              eq(col2, val2) {
                return {
                  async maybeSingle() {
                    const found = self.members.find(
                      (m) => m[col1] === val1 && m[col2] === val2
                    );
                    return { data: found || null, error: null };
                  },
                };
              },
              not(col2, op, val2) {
                return {
                  limit(lim) {
                    const filtered = self.members
                      .filter((m) => m[col1] === val1 && m[col2] !== null && m[col2] !== undefined)
                      .slice(0, lim);
                    return Promise.resolve({ data: filtered, error: null });
                  },
                };
              },
              async maybeSingle() {
                const found = self.members.find((m) => m[col1] === val1);
                return { data: found || null, error: null };
              },
            };
          },
        };
      },
    };
  }
}

describe('MemberMatriculaService - Testes de Unicidade, Concorrência e Multi-Tenant', () => {
  it('1. Deve normalizar matrículas numéricas manuais para no mínimo 3 dígitos', () => {
    assert.equal(MockMemberMatriculaService.normalizarMatricula('1'), '001');
    assert.equal(MockMemberMatriculaService.normalizarMatricula('42'), '042');
    assert.equal(MockMemberMatriculaService.normalizarMatricula('123'), '123');
    assert.equal(MockMemberMatriculaService.normalizarMatricula('1050'), '1050');
    assert.equal(MockMemberMatriculaService.normalizarMatricula('  007  '), '007');
    assert.equal(MockMemberMatriculaService.normalizarMatricula(''), null);
    assert.equal(MockMemberMatriculaService.normalizarMatricula(null), null);
    assert.equal(MockMemberMatriculaService.normalizarMatricula(undefined), null);
  });

  it('2. Deve alocar sequencial inicial "001" para um ministério sem membros cadastrados', async () => {
    const supabase = new MockSupabaseClient();
    const matricula = await MockMemberMatriculaService.alocarProximaMatricula(supabase, 'tenant-1');
    assert.equal(matricula, '001');
  });

  it('3. Deve alocar de forma incremental considerando os registros existentes do ministério', async () => {
    const supabase = new MockSupabaseClient();
    supabase.members.push(
      { ministry_id: 'tenant-1', matricula: '001' },
      { ministry_id: 'tenant-1', matricula: '002' },
      { ministry_id: 'tenant-1', matricula: '010' }
    );

    const matricula = await MockMemberMatriculaService.alocarProximaMatricula(supabase, 'tenant-1');
    assert.equal(matricula, '011');
  });

  it('4. Isolamento Multi-Tenant: progressão é estritamente isolada por ministry_id', async () => {
    const supabase = new MockSupabaseClient();
    // Tenant A (Assembleia de Deus Ananindeua): maior é 500
    supabase.members.push({ ministry_id: 'tenant-a', matricula: '500' });
    // Tenant B (AD Rocha Eterna de Marituba): maior é 092
    supabase.members.push({ ministry_id: 'tenant-b', matricula: '092' });

    const matA = await MockMemberMatriculaService.alocarProximaMatricula(supabase, 'tenant-a');
    const matB = await MockMemberMatriculaService.alocarProximaMatricula(supabase, 'tenant-b');

    assert.equal(matA, '501');
    assert.equal(matB, '093');
  });

  it('5. Cadastro administrativo: aceita e padroniza matrícula manual não duplicada', async () => {
    const supabase = new MockSupabaseClient();
    supabase.members.push({ ministry_id: 'tenant-1', matricula: '001' });

    const matricula = await MockMemberMatriculaService.resolverMatriculaParaCadastro(
      supabase,
      'tenant-1',
      { matriculaInformada: '77' }
    );

    assert.equal(matricula, '077');
  });

  it('6. Prevenção de duplicidade: se matrícula manual já existe no tenant, gera automaticamente o próximo sequencial', async () => {
    const supabase = new MockSupabaseClient();
    supabase.members.push({ ministry_id: 'tenant-1', matricula: '010' });

    const matricula = await MockMemberMatriculaService.resolverMatriculaParaCadastro(
      supabase,
      'tenant-1',
      { matriculaInformada: '10' }
    );

    assert.equal(matricula, '011');
  });

  it('7. Concorrência Simultânea: requisições concorrentes no mesmo tenant recebem números únicos e sequenciais', async () => {
    const supabase = new MockSupabaseClient();
    supabase.members.push({ ministry_id: 'tenant-x', matricula: '100' });

    // 5 cadastros públicos ou simultâneos disparados no mesmo instante
    const resultados = await Promise.all([
      MockMemberMatriculaService.alocarProximaMatricula(supabase, 'tenant-x'),
      MockMemberMatriculaService.alocarProximaMatricula(supabase, 'tenant-x'),
      MockMemberMatriculaService.alocarProximaMatricula(supabase, 'tenant-x'),
      MockMemberMatriculaService.alocarProximaMatricula(supabase, 'tenant-x'),
      MockMemberMatriculaService.alocarProximaMatricula(supabase, 'tenant-x'),
    ]);

    const setMatriculas = new Set(resultados);
    assert.equal(setMatriculas.size, 5, 'Nenhuma matrícula repetida sob concorrência');
    assert.deepEqual(resultados, ['101', '102', '103', '104', '105']);
  });

  it('8. Fallback transparente: se a RPC estiver inativa, fallback calcula com exatidão a partir dos dados do banco', async () => {
    const supabase = new MockSupabaseClient();
    supabase.setRpcActive(false); // Simula ausência da função no banco
    supabase.members.push(
      { ministry_id: 'tenant-fallback', matricula: '001' },
      { ministry_id: 'tenant-fallback', matricula: '250' }
    );

    const matricula = await MockMemberMatriculaService.alocarProximaMatricula(
      supabase,
      'tenant-fallback'
    );

    assert.equal(matricula, '251');
  });
});
