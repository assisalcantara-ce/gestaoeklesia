# 📚 Índice de Rules - Guia de Referência para IA

**Arquivo maestro** que mapeia todos os documentos técnicos em `cursor/rules/`.

Use este arquivo como ponto de entrada para entender a estrutura completa do projeto.

---

## 📂 O que é a pasta "rules/"?

Contém a **documentação técnica completa** necessária para um agente de IA:
- 🏗️ Arquitetura do sistema
- 🗄️ Estrutura de banco de dados
- 🌐 API endpoints disponíveis
- ⚛️ Componentes React
- 📋 Padrões de código
- 🧩 Estrutura de módulos

---

## 📋 Arquivos Disponíveis

### 1. **ARCHITECTURE.md** 
**Tamanho:** 346 linhas | **Status:** ✅ Completo

**O quê:** Arquitetura geral do sistema, padrões de design

**Contém:**
- ✅ Arquitetura Multi-Tenant explicada
- ✅ Row Level Security (RLS) funcionamento
- ✅ Fluxo de dados (usuário → JWT → RLS)
- ✅ 4 camadas da aplicação (Frontend, Backend, DB, Auth)
- ✅ Tabelas e relacionamentos
- ✅ Checklist de segurança multi-tenant
- ✅ Exemplos corretos e incorretos de queries
- ✅ Padrão de response da API
- ✅ Padrão de erro handling

**Quando usar:**
- Entender como o sistema funciona em alto nível
- Implementar nova funcionalidade segura
- Validar segurança multi-tenant
- Aprender sobre isolamento de dados

**Referência rápida:**
```
Inicio → ARCHITECTURE.md → Entender RLS
              ↓
         Implementar query segura
              ↓
         Verificar em DATABASE_SCHEMA.md
```

---

### 2. **DATABASE_SCHEMA.md** 🆕
**Tamanho:** 450+ linhas | **Status:** ✅ Novo

**O quê:** Estrutura completa de todas as 9 tabelas do banco

**Contém:**
- ✅ Visão geral das 9 tabelas + 1 view
- ✅ Dicionário de cada tabela (campos, tipos, descrição)
- ✅ Índices e constraints para performance
- ✅ RLS policies por tabela (summary)
- ✅ Exemplo de template_json (cartões)
- ✅ Exemplo de audit_logs (rastreamento)
- ✅ Queries comuns prontas para copiar
- ✅ Padrões importantes (isolamento multi-tenant)
- ✅ Checklist de segurança

**Tabelas documentadas:**
1. ministries (tenants/clientes)
2. ministry_users (RBAC)
3. members (dados de membros)
4. cartoes_templates (designs)
5. cartoes_gerados (histórico)
6. configurations (customizáveis)
7. arquivos (metadata)
8. audit_logs (tracking)
9. ministries_with_stats (view)

**Quando usar:**
- Entender estrutura de uma tabela antes de fazer query
- Criar nova coluna ou tabela
- Debugar erro de relacionamento
- Verificar qual índice usar

**Referência rápida:**
```
Preciso adicionar campo a 'members'?
    ↓
DATABASE_SCHEMA.md → Tabela "3️⃣ MEMBERS"
    ↓
Ver exemplo de constraints e índices
    ↓
Adicionar campo seguindo padrão
```

---

### 3. **API_ENDPOINTS.md** 🆕
**Tamanho:** 500+ linhas | **Status:** ✅ Novo

**O quê:** Documentação de todos os endpoints REST da API

**Contém:**
- ✅ Base URL e autenticação
- ✅ 5 grupos de endpoints:
  - 👥 Members (CRUD completo)
  - 🎨 Cartões (templates + gerados)
  - ⚙️ Configurações
  - 📊 Dashboard (estatísticas)
  - 📄 Relatórios
- ✅ Cada endpoint documenta:
  - Verbo HTTP (GET, POST, PUT, DELETE)
  - Query params e body
  - Response structure (completa)
  - Exemplo curl
- ✅ Error responses (401, 403, 404, 400, 500)
- ✅ Exemplo completo de integração frontend
- ✅ Rate limits (futuro)

**Quando usar:**
- Integrar novo frontend com API
- Testar endpoint com curl/Postman
- Entender estrutura de request/response
- Implementar novo endpoint

**Referência rápida:**
```
Como criar membro via API?
    ↓
API_ENDPOINTS.md → "POST /members"
    ↓
Copiar body estrutura
    ↓
Fazer requisição
```

---

### 4. **CODE_STYLE.md** 
**Tamanho:** 491 linhas | **Status:** ✅ Completo

**O quê:** Padrões de código, convenções, estilo de escrita

**Contém:**
- ✅ TypeScript (tipos genéricos, strictness)
- ✅ Padrão de response (discriminated unions)
- ✅ Nomeação de variáveis e funções
- ✅ Estrutura de componentes React
- ✅ Custom hooks padrão
- ✅ Async/await vs promises
- ✅ Error handling
- ✅ Comentários e documentação
- ✅ Imports e organizacao
- ✅ Exemplo lado a lado (❌ vs ✅)

**Quando usar:**
- Antes de escrever código novo
- Code review de pull requests
- Padronizar arquivo existente
- Entender estilo do projeto

**Referência rápida:**
```
Devo usar type ou interface?
    ↓
CODE_STYLE.md → Seção TypeScript
    ↓
"Use interface para objetos públicos, type para unions"
```

---

### 5. **MODULE_PATTERNS.md** 
**Tamanho:** 373 linhas | **Status:** ✅ Completo

**O quê:** Como estruturar módulos/features dentro do sistema

**Contém:**
- ✅ Anatomia de um módulo (pastas e arquivos)
- ✅ Template de README.md para novo módulo
- ✅ Template de index.ts (exports públicos)
- ✅ Exemplo real: Módulo Members
  - Estrutura de pastas
  - API routes
  - Components
  - Hooks
  - Types
- ✅ Como estruturar tipos
- ✅ Como fazer re-exports públicos
- ✅ Como documentar para futuros desenvolvedores

**Quando usar:**
- Criar novo módulo (financeiro, eventos, etc)
- Reorganizar módulo existente
- Onboarding de novo dev
- Manter consistência

**Referência rápida:**
```
Preciso criar módulo "Financeiro"?
    ↓
MODULE_PATTERNS.md → "Anatomia de um módulo"
    ↓
Copiar estrutura de pastas
    ↓
Seguir template de README e index.ts
```

---

### 6. **REACT_COMPONENTS.md** 🆕
**Tamanho:** 400+ linhas | **Status:** ✅ Novo

**O quê:** Documentação de todos os componentes React + hooks

**Contém:**
- ✅ Tabela resumida de 8 componentes principais
- ✅ Documentação detalhada de cada:
  - Props interface
  - Propósito e funcionalidades
  - Exemplo de uso
  - Validações
- ✅ 6 custom hooks:
  - useMembers
  - useNotification
  - useAuth
  - useConfigurations
  - etc
- ✅ Design System integration
- ✅ Padrão para novo componente
- ✅ State management approach
- ✅ Performance otimizações (React.memo, useMemo, etc)

**Componentes documentados:**
1. FichaMembro (form de membro)
2. CartaoBatchPrinter (impressão em lote)
3. CartãoMembro (renderização)
4. NotificationModal (notificações)
5. Sidebar (menu)
6. TemplatesSidebar (seletor templates)
7. RichTextEditor (editor texto)
8. InteractiveCanvas (crop imagens)

**Quando usar:**
- Usar componente existente em novo lugar
- Entender props de um componente
- Criar novo componente seguindo padrão
- Debugar erro de componente

**Referência rápida:**
```
Como exibir notificação?
    ↓
REACT_COMPONENTS.md → "4. NotificationModal"
    ↓
Copiar exemplo de uso
    ↓
Integrar em seu código
```

---

### 7. **INDEX_RULES.md** (Este arquivo)
**Status:** ✅ Meta-documentação

**O quê:** Guia para usar os outros arquivos de rules

**Use este arquivo para:**
- Saber qual documento ler para cada tarefa
- Entender cobertura de documentação
- Encontrar rapidamente o que precisa

---

## 🎯 Matriz de Decisão

**"Preciso fazer X, qual documento ler?"**

| Tarefa | Documento | Seção |
|--------|-----------|-------|
| Entender como sistema funciona | ARCHITECTURE.md | Seção 1-2 |
| Criar novo módulo | MODULE_PATTERNS.md | Seção 1-2 |
| Adicionar coluna a tabela | DATABASE_SCHEMA.md | Específica tabela |
| Chamar API da frontend | API_ENDPOINTS.md | Endpoint específico |
| Usar componente existente | REACT_COMPONENTS.md | Componente específico |
| Escrever código novo | CODE_STYLE.md | Padrão específico |
| Implementar nova funcionalidade segura | ARCHITECTURE.md | Seção 4 (Segurança) |
| Debugar query do banco | DATABASE_SCHEMA.md + ARCHITECTURE.md | RLS + Query |
| Fazer code review | CODE_STYLE.md | Todo documento |
| Onboarding novo dev | Este arquivo → ARCHITECTURE.md | Ordem |

---

## 🚀 Fluxo de Onboarding (30 minutos)

### Para um novo desenvolvedor:

1. **Leia ARCHITECTURE.md (10 min)**
   - Entender multi-tenant
   - Entender RLS
   - Entender fluxo de dados

2. **Leia DATABASE_SCHEMA.md (5 min)**
   - Ver 9 tabelas em alto nível
   - Ver RLS summary

3. **Leia CODE_STYLE.md (5 min)**
   - Leia seções de TypeScript e React
   - Veja exemplos ❌ vs ✅

4. **Leia MODULE_PATTERNS.md (5 min)**
   - Ver anatomia de módulo
   - Ver exemplo real (Members)

5. **Leia REACT_COMPONENTS.md (5 min)**
   - Ver componentes disponíveis
   - Ver padrão de novo componente

**Resultado:** Dev consegue:
- ✅ Entender arquitetura geral
- ✅ Criar novo módulo
- ✅ Escrever código consistente
- ✅ Consultar documentação corretamente

---

## 📊 Cobertura de Documentação

| Aspecto | Documento | Cobertura |
|---------|-----------|-----------|
| **Arquitetura** | ARCHITECTURE.md | ✅ 100% |
| **Database** | DATABASE_SCHEMA.md | ✅ 100% |
| **API** | API_ENDPOINTS.md | ✅ 100% |
| **Frontend Components** | REACT_COMPONENTS.md | ✅ 100% |
| **Code Style** | CODE_STYLE.md | ✅ 100% |
| **Module Structure** | MODULE_PATTERNS.md | ✅ 100% |
| **DevOps/Deploy** | ❌ Não documentado | 0% |
| **Testes** | ❌ Não documentado | 0% |
| **Performance** | ⚠️ Parcial em REACT_COMPONENTS.md | 30% |
| **CI/CD** | ❌ Não documentado | 0% |

---

## 🔄 Manutenção dos Rules

### Quando atualizar este documento:

1. **Novo campo em tabela**
   → Atualizar DATABASE_SCHEMA.md

2. **Novo endpoint**
   → Atualizar API_ENDPOINTS.md

3. **Novo componente**
   → Atualizar REACT_COMPONENTS.md

4. **Novo padrão de código**
   → Atualizar CODE_STYLE.md

5. **Novo módulo criado**
   → Conficar que segue MODULE_PATTERNS.md

6. **Mudança arquitetural**
   → Atualizar ARCHITECTURE.md

7. **Qualquer mudança acima**
   → Atualizar este INDEX_RULES.md com datas

---

## ✅ Checklist Completo

**Para um agente de IA entender e continuar desenvolvendo:**

- ✅ ARCHITECTURE.md - Como tudo se conecta
- ✅ DATABASE_SCHEMA.md - O que está guardado e como
- ✅ API_ENDPOINTS.md - Como comunicar com o sistema
- ✅ CODE_STYLE.md - Como escrever código consistente
- ✅ MODULE_PATTERNS.md - Como organizar código
- ✅ REACT_COMPONENTS.md - Quais componentes usar
- ✅ Este INDEX_RULES.md - Como navegar tudo isso

**Ainda faltaria para produção:**
- ❌ DEPLOYMENT.md - Como fazer deploy
- ❌ TESTING.md - Como testar
- ❌ PERFORMANCE.md - Como otimizar
- ❌ TROUBLESHOOTING.md - Como debugar problemas comuns

---

## 🎯 Próximos Passos

Para melhorar ainda mais a documentação técnica:

1. Criar **DEPLOYMENT.md** (deploy em produção)
2. Criar **TESTING.md** (unit + e2e testes)
3. Criar **TROUBLESHOOTING.md** (erros comuns)
4. Criar **PERFORMANCE.md** (otimizações)
5. Criar **SECURITY.md** (checklist de segurança)

---

## 📞 Como Usar Este Arquivo

1. **Procure a tarefa que precisa fazer** no índice superior
2. **Identifique qual documento** precisa ler
3. **Navegue para esse documento** (arquivo específico)
4. **Use a seção indicada** para resolver seu problema
5. **Volte aqui** se ficar perdido ou precisar de outro documento

---

**Criado em:** 2024  
**Última atualização:** 2 de janeiro de 2026  
**Status:** ✅ Pronto para produção

