# � Documentação Organizada - cursor/docs/

Bem-vindo à documentação centralizada do Gestão Eklesia! Documentação organizada em 6 categorias.

## 🎯 Comece Aqui

### Novo no projeto?
```
1. Leia: COMECE_AQUI.md (15 min)
2. Acesse: ../../cursor/INDEX.md (visão geral)
3. Use: ../../MODULES_INDEX.md (referência)
```

### Vou fazer setup?
```
1. SETUP_RAPIDO_CLOUD.md (20 min - Cloud)
2. SUPABASE_CLI_RAPIDO.md (5 min - CLI local)
3. TESTE_API_EXEMPLO.md (validar)
```

### Vou desenvolver?
```
1. ../../cursor/rules/ARCHITECTURE.md (design)
2. ../../cursor/rules/CODE_STYLE.md (padrões)
3. Consulte ../../MODULES_INDEX.md (quando precisar)
```

---

## 📑 Índice Completo

👉 **Ver**: [INDEX_DOCS.md](INDEX_DOCS.md) - Índice detalhado com matriz de consulta

Resumo das categorias:

### 🚀 Setup (6 arquivos)
- COMECE_AQUI.md
- SETUP_RAPIDO_CLOUD.md
- SUPABASE_CLI_RAPIDO.md
- COMECE_AQUI_CLI.md
- 20_MINUTOS_PRONTO.md
- SEU_PROJETO_PROXIMO_PASSO.md

### ⚙️ Supabase (8 arquivos)
- SUPABASE_SETUP_GUIA.md
- SUPABASE_PASSO_A_PASSO.md
- SUPABASE_SCHEMA_COMPLETO.sql
- EXECUTAR_SQL_DASHBOARD.md
- E mais...

### 📊 Análise & Arquitetura (4 arquivos)
- ANALISE_MULTI_TENANT_2026.md
- ARQUITETURA_PRODUCAO.md
- DECISOES_ARQUITETURAIS.md
- ROADMAP_PRODUCAO.md

### 📖 Referência (19+ arquivos)
- CHECKLIST_VOCE_TEM.md
- TESTE_API_EXEMPLO.md
- VALORES_PERMITIDOS.md
- E mais...
- **docs/05_PDF_RELATORIOS/TEST_PDF_GENERATION.md** - Testes

### 06. Nomenclaturas Dinâmicas
- **docs/06_NOMENCLATURAS_DINAMICAS/INDEX_v2.md** - Índice v2
- **docs/06_NOMENCLATURAS_DINAMICAS/MAPA_PLACEHOLDERS.md** - Mapa

---

## 🎯 Começar Por Aqui

### 1️⃣ Primeiro Acesso
```
1. Leia: RESUMO_EXECUTIVO.md
2. Leia: cursor/INDEX.md
3. Leia: MODULES_INDEX.md
```

### 2️⃣ Setup do Projeto
```
1. Leia: SUPABASE_SETUP.md
2. Execute: EXECUTAR_SQL_DASHBOARD.md
3. Teste: TESTE_API_EXEMPLO.md
```

### 3️⃣ Desenvolvimento
```
1. Leia: cursor/rules/ARCHITECTURE.md
2. Leia: cursor/rules/CODE_STYLE.md
3. Consulte: MODULES_INDEX.md quando precisar
```

---

## 📚 Análise & Decisões

- **ANALISE_MULTI_TENANT_2026.md** - Análise completa
- **ARQUITETURA_PRODUCAO.md** - Arquitetura de produção
- **DECISOES_ARQUITETURAIS.md** - Decisões arquiteturais
- **PLANO_ACAO_DETALHADO.md** - Plano de ação

---

## 🔍 Referência Rápida

### Tabelas de Dados
- ministries (tenants)
- ministry_users (usuários)
- members (membros)
- cartoes_templates
- cartoes_gerados
- configurations
- audit_logs
- arquivos

### Endpoints API
- GET /api/v1/members
- POST /api/v1/members
- GET /api/v1/members/{id}
- PUT /api/v1/members/{id}
- DELETE /api/v1/members/{id}

### Componentes Principais
- FichaMembro - Formulário de membro
- CartãoMembro - Cartão visual
- CartaoBatchPrinter - Impressão em lote
- NotificationModal - Notificações
- RichTextEditor - Editor de texto

### Hooks
- useMembers() - CRUD de membros

---

## 🚀 Deploy & Produção

- **ROADMAP_PRODUCAO.md** - Roadmap para produção
- **CHECKLIST_VOCE_TEM.md** - Status de preparação
- **SUPABASE_ENTREGA_FINAL.md** - Entrega final

---

## 📝 Rascunhos & Notas

- **docs/99_RASCUNHOS/CHEAT_SHEET.md** - Cola na parede
- **docs/99_RASCUNHOS/COLA_NA_PAREDE.txt** - Referências

---

## 🎯 Matriz de Consulta

| Preciso de... | Leia... |
|---|---|
| Entender a arquitetura | cursor/rules/ARCHITECTURE.md |
| Ver exemplo de código | cursor/rules/CODE_STYLE.md |
| Encontrar um módulo | MODULES_INDEX.md |
| Configurar Supabase | SUPABASE_SETUP.md |
| Entender RLS | cursor/rules/ARCHITECTURE.md§RLS |
| Criar novo módulo | cursor/rules/MODULE_PATTERNS.md |
| Saber status do projeto | CHECKLIST_VOCE_TEM.md |
| Exemplos de API | TESTE_API_EXEMPLO.md |

---

## 📞 Suporte

### Problemas Comuns

**"Não consigo instalar Supabase CLI"**
→ Leia: cursor/docs/SUPABASE_SETUP.md

**"Não entendo RLS"**
→ Leia: cursor/rules/ARCHITECTURE.md seção 1

**"Preciso adicionar novo campo"**
→ Leia: cursor/rules/MODULE_PATTERNS.md

**"Código não segue padrão"**
→ Leia: cursor/rules/CODE_STYLE.md

---

## 🗂️ Estrutura de Pastas

```
docs/
├── 00_INDEX.md                          # Este arquivo
├── RESUMO_EXECUTIVO.md                  # Resumo geral
├── MODULES_INDEX.md                     # ⭐ Índice de módulos
│
├── 01_VISAO_GERAL/
├── 02_UI_UX_DESIGN/
├── 03_FUNCIONALIDADES/
├── 04_NOTIFICACOES/
├── 05_PDF_RELATORIOS/
├── 06_NOMENCLATURAS_DINAMICAS/
├── 99_RASCUNHOS/
│
└── cursor/                              # ← NOVO
    ├── INDEX.md                         # Guia do cursor
    ├── docs/                            # Docs específicas
    └── rules/                           # Regras para IA
        ├── ARCHITECTURE.md
        ├── CODE_STYLE.md
        └── MODULE_PATTERNS.md
```

---

## ✅ Checklist de Leitura

- [ ] Leia RESUMO_EXECUTIVO.md
- [ ] Leia cursor/INDEX.md
- [ ] Leia MODULES_INDEX.md
- [ ] Leia cursor/rules/ARCHITECTURE.md
- [ ] Leia cursor/rules/CODE_STYLE.md
- [ ] Explore docs/03_FUNCIONALIDADES/

---

**Última atualização:** 2 jan 2026
**Versão:** 1.0
**Status:** Em desenvolvimento ✅
