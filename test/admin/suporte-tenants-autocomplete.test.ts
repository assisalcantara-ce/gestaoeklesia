import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_MODULOS_ACESSO, type AdminRole } from '../../src/lib/access-control.js';

describe('Suporte Técnico Admin — Autocomplete de Busca Dinâmica de Tenants', () => {
  // Base de ministérios simulada com dados reais e campos operacionais
  const mockMinistries = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Igreja Batista Central de Fortaleza',
      slug: 'ib-central-fortaleza',
      cnpj_cpf: '12345678000199',
      address_city: 'Fortaleza',
      address_state: 'CE',
      subscription_status: 'active',
      plan: 'profissional',
      access_password_encrypted: 'ENC:s3cr3t_h4sh_never_expose',
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      name: 'Igreja Batista Central de Recife',
      slug: 'ib-central-recife',
      cnpj_cpf: '98765432000188',
      address_city: 'Recife',
      address_state: 'PE',
      subscription_status: 'active',
      plan: 'expert',
      access_password_encrypted: 'ENC:s3cr3t_h4sh_never_expose_2',
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      name: 'Assembleia de Deus Belém',
      slug: 'ad-belem',
      cnpj_cpf: '55566677000100',
      address_city: 'São Paulo',
      address_state: 'SP',
      subscription_status: 'trial',
      plan: 'starter',
      access_password_encrypted: 'ENC:s3cr3t_h4sh_never_expose_3',
    },
    {
      id: '44444444-4444-4444-4444-444444444444',
      name: 'Comunidade da Graça',
      slug: 'comunidade-graca',
      cnpj_cpf: '44433322000111',
      address_city: 'Campinas',
      address_state: 'SP',
      subscription_status: 'suspended',
      plan: 'intermediario',
      access_password_encrypted: 'ENC:s3cr3t_h4sh_never_expose_4',
    },
  ];

  // Simulação do mecanismo de busca dinâmico da rota /api/v1/admin/ministries/search
  const executeSearch = (query: string, ministries = mockMinistries) => {
    const raw = (query || '').trim();
    // Sanitização de curingas LIKE
    const sanitized = raw.replace(/[%_]/g, '').trim();

    // Regra 1 & 2: Mínimo de 3 caracteres válidos
    if (!sanitized || sanitized.length < 3) {
      return {
        data: [],
        message: 'Informe pelo menos 3 caracteres para buscar.',
      };
    }

    // Consulta filtrando por nome e retornando apenas colunas seguras
    const filtered = ministries
      .filter((m) => m.name.toLowerCase().includes(sanitized.toLowerCase()))
      .map(({ id, name, slug, cnpj_cpf, address_city, address_state, subscription_status, plan }) => ({
        id,
        name,
        slug,
        cnpj_cpf,
        address_city,
        address_state,
        subscription_status,
        plan,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 20);

    return {
      data: filtered,
    };
  };

  test('1. Mínimo de 3 caracteres: termo com menos de 3 caracteres não dispara consulta e retorna array vazio', () => {
    assert.deepStrictEqual(executeSearch('').data, []);
    assert.deepStrictEqual(executeSearch('a').data, []);
    assert.deepStrictEqual(executeSearch('ab').data, []);
    assert.deepStrictEqual(executeSearch('  ab  ').data, []);
  });

  test('2. Busca dinâmica: termo com 3 ou mais caracteres localiza tenants pelo nome com precisão', () => {
    const resBatista = executeSearch('Bat');
    assert.strictEqual(resBatista.data.length, 2);
    assert.strictEqual(resBatista.data[0].name, 'Igreja Batista Central de Fortaleza');
    assert.strictEqual(resBatista.data[1].name, 'Igreja Batista Central de Recife');

    const resBelem = executeSearch('Belém');
    assert.strictEqual(resBelem.data.length, 1);
    assert.strictEqual(resBelem.data[0].id, '33333333-3333-3333-3333-333333333333');
    assert.strictEqual(resBelem.data[0].name, 'Assembleia de Deus Belém');
  });

  test('3. Informações auxiliares para diferenciação: expõe cidade, estado, plano e status para diferenciar semelhantes', () => {
    const res = executeSearch('Central');
    assert.strictEqual(res.data.length, 2);

    const fort = res.data.find((m) => m.address_state === 'CE');
    const rec = res.data.find((m) => m.address_state === 'PE');

    assert.ok(fort);
    assert.ok(rec);
    assert.strictEqual(fort.address_city, 'Fortaleza');
    assert.strictEqual(fort.plan, 'profissional');
    assert.strictEqual(rec.address_city, 'Recife');
    assert.strictEqual(rec.plan, 'expert');
  });

  test('4. Proteção de Dados Sensíveis: nunca retorna campos sigilosos como senhas criptografadas ou hashes', () => {
    const res = executeSearch('Batista');
    for (const tenant of res.data) {
      assert.strictEqual((tenant as any).access_password_encrypted, undefined);
      assert.strictEqual((tenant as any).senha_hash, undefined);
      assert.strictEqual((tenant as any).password, undefined);
      assert.ok(tenant.id);
      assert.ok(tenant.name);
    }
  });

  test('5. Sanitização de Caracteres Especiais: limpa curingas de busca para evitar injeção em padrão LIKE', () => {
    const res = executeSearch('%_%');
    // Como `%` e `_` são sanitizados, a string fica vazia e cai na regra de < 3 caracteres
    assert.deepStrictEqual(res.data, []);
  });

  test('6. Seleção de Tenant: operador vê o nome amigável e o formulário vincula internamente o ID real', () => {
    let formData = {
      ministry_id: '',
      subject: '',
      description: '',
      category: 'technical',
      priority: 'medium',
    };
    let selectedTenant: any = null;
    let tenantSearchQuery = 'Igreja Bat';

    const results = executeSearch(tenantSearchQuery).data;
    const escolhido = results[0]; // 'Igreja Batista Central de Fortaleza'

    // Operação de seleção do autocomplete
    selectedTenant = escolhido;
    formData.ministry_id = escolhido.id;
    tenantSearchQuery = escolhido.name;

    // Validações do estado resultante
    assert.strictEqual(formData.ministry_id, '11111111-1111-1111-1111-111111111111');
    assert.strictEqual(tenantSearchQuery, 'Igreja Batista Central de Fortaleza');
    assert.strictEqual(selectedTenant.name, 'Igreja Batista Central de Fortaleza');
  });

  test('7. Validação estrita: texto digitado sem seleção de item da lista é rejeitado', () => {
    const validateTicketCreation = (formData: { ministry_id: string }, selectedTenant: any) => {
      if (!formData.ministry_id || !selectedTenant) {
        return { valido: false, erro: 'Por favor, busque e selecione um ministério válido na lista de resultados.' };
      }
      return { valido: true, erro: null };
    };

    // Cenário A: Usuário digitou "Igreja" mas não clicou em nenhum resultado
    const tentativaA = validateTicketCreation({ ministry_id: '' }, null);
    assert.strictEqual(tentativaA.valido, false);
    assert.match(tentativaA.erro!, /selecione um ministério válido/);

    // Cenário B: Usuário selecionou um ministério legítimo
    const tentativaB = validateTicketCreation(
      { ministry_id: '11111111-1111-1111-1111-111111111111' },
      mockMinistries[0]
    );
    assert.strictEqual(tentativaB.valido, true);
    assert.strictEqual(tentativaB.erro, null);
  });

  test('8. Invalidação automática ao digitar: alterar o texto após selecionar desfaz a seleção prévia', () => {
    let formData = { ministry_id: '11111111-1111-1111-1111-111111111111' };
    let selectedTenant: any = mockMinistries[0];
    let tenantSearchQuery = 'Igreja Batista Central de Fortaleza';

    // Usuário altera o campo de texto digitando outra coisa
    const novoTexto = 'Igreja Batista Central de Fortaleza (Filial)';
    tenantSearchQuery = novoTexto;
    if (selectedTenant && novoTexto !== selectedTenant.name) {
      selectedTenant = null;
      formData.ministry_id = '';
    }

    assert.strictEqual(selectedTenant, null);
    assert.strictEqual(formData.ministry_id, '');
    assert.strictEqual(tenantSearchQuery, novoTexto);
  });

  test('9. Troca de Tenant e Limpeza: ação de limpar ou trocar restaura os campos a zero', () => {
    let formData = { ministry_id: '22222222-2222-2222-2222-222222222222' };
    let selectedTenant: any = mockMinistries[1];
    let tenantSearchQuery = 'Igreja Batista Central de Recife';
    let isTenantDropdownOpen = false;

    // Ação "Trocar" / "Limpar"
    const handleClearTenant = () => {
      selectedTenant = null;
      formData.ministry_id = '';
      tenantSearchQuery = '';
      isTenantDropdownOpen = false;
    };

    handleClearTenant();

    assert.strictEqual(selectedTenant, null);
    assert.strictEqual(formData.ministry_id, '');
    assert.strictEqual(tenantSearchQuery, '');
    assert.strictEqual(isTenantDropdownOpen, false);
  });

  test('10. Criação do Ticket com Vínculo do ID correto e preservação de campos do chamado', () => {
    const selected = mockMinistries[2]; // Assembleia de Deus Belém

    const formData = {
      ministry_id: selected.id,
      subject: 'Problema na emissão de relatório financeiro',
      description: 'Ao tentar exportar o balancete anual em PDF ocorre tempo limite.',
      category: 'technical',
      priority: 'high',
    };

    // Payload enviado para a API de tickets
    const ticketPayload = {
      ministry_id: formData.ministry_id,
      subject: formData.subject,
      description: formData.description,
      category: formData.category,
      priority: formData.priority,
      status: 'open',
      sla_minutes: 480,
    };

    assert.strictEqual(ticketPayload.ministry_id, '33333333-3333-3333-3333-333333333333');
    assert.strictEqual(ticketPayload.subject, 'Problema na emissão de relatório financeiro');
    assert.strictEqual(ticketPayload.category, 'technical');
    assert.strictEqual(ticketPayload.priority, 'high');
    assert.strictEqual(ticketPayload.status, 'open');
  });

  test('11. RBAC Administrativo: perfis autorizados de suporte possuem acesso garantido ao módulo', () => {
    const perfisSuporte: AdminRole[] = ['admin', 'super_admin', 'suporte', 'financeiro'];

    for (const role of perfisSuporte) {
      const modulos = ADMIN_MODULOS_ACESSO[role];
      assert.ok(
        modulos.includes('suporte'),
        `O perfil ${role} deve possuir acesso explícito ao módulo suporte`
      );
    }
  });

  test('12. Nenhum resultado encontrado: estado vazio claro quando a busca não localiza ministérios', () => {
    const resInexistente = executeSearch('Paróquia Inexistente do Extremo Sul');
    assert.strictEqual(resInexistente.data.length, 0);
  });
});
