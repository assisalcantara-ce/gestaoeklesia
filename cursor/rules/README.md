# 📚 cursor/rules - Base de Conhecimento Técnica

**Centro de referência técnica** para desenvolvimento, integração e continuidade do projeto Gestão Eklesia.

Esta pasta contém toda a documentação estruturada que um agente de IA (Cursor, GitHub Copilot, etc) precisa para entender o sistema e continuar o desenvolvimento.

---

## 🎯 Propósito

Responder perguntas como:
- "Como adicionar novo campo ao banco?"
- "Qual é o padrão de código do projeto?"
- "Como criar novo componente React?"
- "Quais endpoints da API existem?"
- "Como garantir segurança multi-tenant?"
- "Qual a estrutura de um novo módulo?"

---

## 📂 Arquivos Disponíveis

```
cursor/rules/
├── README.md                      (Este arquivo - sumário)
├── INDEX_RULES.md                 (📍 COMECE AQUI - Guia de navegação)
├── ARCHITECTURE.md                (Arquitetura e design)
├── DATABASE_SCHEMA.md             (9 tabelas e schema)
├── API_ENDPOINTS.md               (Endpoints REST)
├── CODE_STYLE.md                  (Padrões de código)
├── MODULE_PATTERNS.md             (Como estruturar módulos)
└── REACT_COMPONENTS.md            (Componentes e hooks)
```

---

## 🚀 Começar Rápido

### 1️⃣ Para Entender o Sistema

```
COMECE AQUI: INDEX_RULES.md
         ↓
DEPOIS: ARCHITECTURE.md (10 min)
```

### 2️⃣ Para Implementar Nova Funcionalidade

```
COMECE: MODULE_PATTERNS.md
    ↓
DEPOIS: CODE_STYLE.md
    ↓
DEPOIS: DATABASE_SCHEMA.md (se tiver banco)
    ↓
DEPOIS: API_ENDPOINTS.md (se tiver API)
```

### 3️⃣ Para Entender Componentes

```
COMECE: REACT_COMPONENTS.md
```

---

## 📋 Matriz Rápida

**"Preciso fazer X"** → **Leia Y**

| Tarefa | Documento |
|--------|-----------|
| Entender tudo | INDEX_RULES.md |
| Começar a desenvolver | ARCHITECTURE.md |
| Adicionar campo em tabela | DATABASE_SCHEMA.md |
| Chamar API | API_ENDPOINTS.md |
| Criar componente novo | REACT_COMPONENTS.md |
| Escrever código | CODE_STYLE.md |
| Organizar novo módulo | MODULE_PATTERNS.md |

---

## 📊 O Que Cada Arquivo Contém

### **INDEX_RULES.md** 📍
**Seu ponto de entrada!**

- Guia de navegação completo
- Matriz de decisão ("qual documento para minha tarefa?")
- Fluxo de onboarding (30 min)
- Checklist de cobertura
- Referências cruzadas

**Leia PRIMEIRO →** [INDEX_RULES.md](./INDEX_RULES.md)

---

### **ARCHITECTURE.md** 🏗️
Arquitetura geral: multi-tenant, RLS, fluxos de dados

- Arquitetura SaaS multi-tenant
- Row Level Security (RLS) explicado
- 4 camadas (Frontend, Backend, DB, Auth)
- Fluxo de dados completo
- Segurança multi-tenant
- Exemplo correto de queries seguras
- Response pattern
- Error handling

**Tamanho:** 346 linhas | **Tempo:** 15 min

---

### **DATABASE_SCHEMA.md** 🗄️ 🆕
Documentação completa de todas as 9 tabelas

Contém:
- Visão geral das tabelas e relacionamentos
- **9 Tabelas documentadas:**
  1. ministries (tenants)
  2. ministry_users (RBAC)
  3. members (dados)
  4. cartoes_templates (designs)
  5. cartoes_gerados (histórico)
  6. configurations (customizáveis)
  7. arquivos (metadata)
  8. audit_logs (tracking)
  9. ministries_with_stats (view)

- Cada tabela contém:
  - Todos os campos com tipos
  - Descrição de cada campo
  - Índices (para performance)
  - Constraints (para integridade)
  - RLS policies
  - Exemplos de valores

- Padrões importantes
- Queries comuns prontas
- RLS summary

**Tamanho:** 450+ linhas | **Tempo:** 20 min

---

### **API_ENDPOINTS.md** 🌐 🆕
Referência de todos os endpoints REST

- Base URL e autenticação
- 5 grupos de endpoints:
  - 👥 Members (CRUD)
  - 🎨 Cartões (templates + gerados)
  - ⚙️ Configurações
  - 📊 Dashboard
  - 📄 Relatórios

- Para cada endpoint:
  - Verbo HTTP
  - Query params e body
  - Response structure (completa)
  - Exemplo curl
  - Error codes

- Exemplo completo de integração

**Tamanho:** 500+ linhas | **Tempo:** 20 min

---

### **CODE_STYLE.md** 📝
Padrões de código e convenções

- TypeScript (tipos, interfaces, strictness)
- Discriminated unions para responses
- Nomeação de variáveis/funções
- Componentes React
- Custom hooks
- Async/await padrão
- Error handling
- Comentários
- Imports

- Exemplo lado a lado: ❌ vs ✅

**Tamanho:** 491 linhas | **Tempo:** 15 min

---

### **MODULE_PATTERNS.md** 🧩
Como estruturar módulos/features

- Anatomia de um módulo (pastas/arquivos)
- Template de README.md
- Template de index.ts
- Exemplo real: módulo Members
- Como estruturar tipos
- Como fazer exports públicos

**Tamanho:** 373 linhas | **Tempo:** 10 min

---

### **REACT_COMPONENTS.md** ⚛️ 🆕
Componentes React e custom hooks

- Tabela de 8 componentes principais
- Documentação detalhada de cada:
  - Props
  - Funcionalidades
  - Exemplo de uso
  - Validações

- 6 custom hooks documentados
- Design System integration
- Padrão para novo componente
- State management approach
- Performance otimizações

**Tamanho:** 400+ linhas | **Tempo:** 15 min

---

## 🎓 Fluxo de Aprendizado (1 hora)

Para onboarding de novo dev:

1. **Leia INDEX_RULES.md** (5 min)
   - Entender o propósito dessa pasta

2. **Leia ARCHITECTURE.md** (15 min)
   - Entender como tudo se conecta
   - Compreender multi-tenant e RLS

3. **Leia CODE_STYLE.md** (10 min)
   - Aprender o estilo de código
   - Ver exemplos ❌ vs ✅

4. **Leia DATABASE_SCHEMA.md** (10 min)
   - Entender as 9 tabelas
   - Conhecer fields principais

5. **Leia MODULE_PATTERNS.md** (5 min)
   - Saber como organizar código novo

6. **Leia REACT_COMPONENTS.md** (10 min)
   - Conhecer componentes disponíveis
   - Ver padrões de hooks

7. **Leia API_ENDPOINTS.md** (5 min)
   - Saber quais APIs existem

**Total:** ~1 hora para entender todo o sistema

---

## 🤖 Para Agentes de IA

Se você é um agente de IA (Cursor, GitHub Copilot, Claude):

1. **Primeiro**, leia [INDEX_RULES.md](./INDEX_RULES.md)
2. **Depois**, use a matriz de decisão para encontrar o documento certo
3. **Consulte** o documento específico para sua tarefa
4. **Siga** os padrões documentados
5. **Mantenha** a consistência com exemplos fornecidos

**Exemplo:**
- Tarefa: "Criar novo componente para filtro de membros"
- Leia: REACT_COMPONENTS.md → "Padrão de componente novo"
- Leia: CODE_STYLE.md → "Padrões de componentes React"
- Implemente seguindo padrão

---

## ✅ Cobertura Técnica

| Aspecto | Status | Documento |
|---------|--------|-----------|
| Arquitetura | ✅ 100% | ARCHITECTURE.md |
| Database | ✅ 100% | DATABASE_SCHEMA.md |
| API Endpoints | ✅ 100% | API_ENDPOINTS.md |
| Componentes React | ✅ 100% | REACT_COMPONENTS.md |
| Padrões de Código | ✅ 100% | CODE_STYLE.md |
| Estrutura de Módulos | ✅ 100% | MODULE_PATTERNS.md |
| **DevOps/Deploy** | ❌ 0% | - |
| **Testes** | ❌ 0% | - |
| **Troubleshooting** | ❌ 0% | - |

---

## 🔄 Como Manter Atualizado

Quando algo muda no projeto:

1. **Novo endpoint?** → Atualizar `API_ENDPOINTS.md`
2. **Novo campo em tabela?** → Atualizar `DATABASE_SCHEMA.md`
3. **Novo componente?** → Atualizar `REACT_COMPONENTS.md`
4. **Novo padrão de código?** → Atualizar `CODE_STYLE.md`
5. **Mudança arquitetural?** → Atualizar `ARCHITECTURE.md`
6. **Qualquer mudança?** → Atualizar `INDEX_RULES.md` com referência cruzada

---

## 📞 FAQ

### **P: Por onde começo?**
A: Leia [INDEX_RULES.md](./INDEX_RULES.md) (2 min)

### **P: Como usar isso para desenvolvimento?**
A: Use a matriz de decisão em [INDEX_RULES.md](./INDEX_RULES.md)

### **P: Qual a ordem de leitura?**
A: Veja "Fluxo de Aprendizado" acima (1 hora total)

### **P: Isso substitui outras documentações?**
A: Não. Complementa. Veja `cursor/docs/` para documentação do usuário/geral

### **P: Posso copiar exemplos?**
A: SIM! Os exemplos são para copiar e adaptar

### **P: Onde fico se não encontrar resposta?**
A: Verifique o documento correspondente em [INDEX_RULES.md](./INDEX_RULES.md)

---

## 🚀 Próximo Passo

**Clique aqui →** [**INDEX_RULES.md**](./INDEX_RULES.md)

Esse arquivo é seu mapa para navegador tudo que você precisa!

---

## 📊 Estatísticas

- **Total de arquivos:** 7 documentos técnicos
- **Total de linhas:** ~2500+
- **Componentes documentados:** 8
- **Endpoints documentados:** 15+
- **Tabelas documentadas:** 9
- **Padrões de código:** 50+
- **Exemplos de código:** 100+

---

## 🎯 Objetivo Final

Um agente de IA (ou novo desenvolvedor) pode:
- ✅ Entender a arquitetura completa
- ✅ Criar novo módulo seguindo padrões
- ✅ Escrever código consistente
- ✅ Implementar funcionalidades seguras (multi-tenant)
- ✅ Integrar com API corretamente
- ✅ Consultar documentação autossuficientemente

---

**Status:** ✅ Documentação Técnica Completa  
**Última atualização:** 2 de janeiro de 2026  
**Próxima revisão:** Q1 2026

