# 📚 Índice - Cursor Rules & Docs

Bem-vindo ao sistema de instruções para desenvolvimento com IA!

## 🗂️ Estrutura Hierárquica

```
cursor/
│
├── 📁 docs/                        # TODA documentação do projeto
│   ├── 00_INDEX/
│   │   ├── README.md               ← Bem-vindo aqui
│   │   └── 00_INDEX.md             ← Índice completo
│   │
│   ├── 01_VISAO_GERAL/             (Análise/Arquitetura)
│   ├── 02_SETUP_INSTALACAO/        (Setup/CLI)
│   ├── 03_SUPABASE/                (Database PostgreSQL)
│   ├── 04_UI_UX_DESIGN/            (Design System)
│   ├── 05_FUNCIONALIDADES/         (Módulos - admin, cartoes, etc)
│   ├── 06_NOTIFICACOES/            (Sistema de Notificações)
│   ├── 07_PDF_RELATORIOS/          (Geração de PDFs)
│   ├── 08_NOMENCLATURAS_DINAMICAS/ (Campos Dinâmicos)
│   ├── 09_REFERENCIA/              (Checklists/API/Valores)
│   ├── 99_RASCUNHOS/               (Temporários)
│   │
│   └── rules/                      (3 PADRÕES - ESSENCIAL!)
│       ├── ARCHITECTURE.md         🔑 Design multi-tenant
│       ├── CODE_STYLE.md           🔑 Padrões TypeScript/React
│       └── MODULE_PATTERNS.md      🔑 Novo código
```

---

## 🎯 COMECE AQUI

### 👤 Novo Desenvolvedor (30 min)
1. Leia: `docs/02_SETUP_INSTALACAO/COMECE_AQUI.md`
2. Execute: `docs/02_SETUP_INSTALACAO/SETUP_RAPIDO_CLOUD.md`
3. Estude: `rules/ARCHITECTURE.md`
4. Consulte: `../../MODULES_INDEX.md`

### 👨‍💻 Dev Experiente (10 min)
1. Estude: `rules/ARCHITECTURE.md`
2. Consulte: `rules/CODE_STYLE.md`
3. Navegue: `docs/00_INDEX/00_INDEX.md`
4. Codifique!

### ⚙️ Setup Supabase (20 min)
1. Siga: `docs/03_SUPABASE/SUPABASE_PASSO_A_PASSO.md`
2. Execute: `docs/03_SUPABASE/EXECUTAR_SQL_DASHBOARD.md`
3. Teste: `docs/04_REFERENCIA/TESTE_API_EXEMPLO.md`

### 🤖 IA/Copilot
1. Use: `../../MODULES_INDEX.md` (contexto)
2. Consulte: `rules/` (padrões)
3. Detalhe: `docs/` (especificamente)

### Raiz

| Arquivo | Descrição |
|---------|-----------|
| `MODULES_INDEX.md` | **LEIA PRIMEIRO** - Índice de todos os módulos |
| `MODULES_INDEX.md` | Mapa de features → arquivos |
| `MODULES_INDEX.md` | Referências rápidas |

### cursor/rules/

| Arquivo | Descrição |
|---------|-----------|
| `ARCHITECTURE.md` | Design do sistema, multi-tenant, RLS |
| `CODE_STYLE.md` | Padrões TypeScript, React, API |
| `MODULE_PATTERNS.md` | Como documentar e referenciar módulos |

### cursor/docs/

| Arquivo | Descrição |
|---------|-----------|
| (a criar) | Documentação específica por módulo |

---

## 🎯 Casos de Uso

### Caso 1: "Preciso entender como membros funcionam"
```
1. Abra MODULES_INDEX.md (raiz)
2. Procure "Gerenciamento de Membros"
3. Abra arquivo principal: src/app/api/v1/members/route.ts
4. Consulte hook: src/hooks/useMembers.ts
5. Veja componente: src/components/FichaMembro.tsx
```

### Caso 2: "Vou adicionar novo campo a membro"
```
1. Leia cursor/rules/ARCHITECTURE.md (schema)
2. Leia cursor/rules/CODE_STYLE.md (padrões)
3. Modifique SQL schema
4. Atualize src/types/supabase-generated.ts
5. Atualize componente/API conforme necessário
6. Atualize MODULES_INDEX.md
```

### Caso 3: "Vou criar novo módulo"
```
1. Leia cursor/rules/MODULE_PATTERNS.md
2. Siga o checklist de novo módulo
3. Crie pasta com README.md
4. Adicione tag @see em arquivos
5. Atualize MODULES_INDEX.md
```

### Caso 4: "Preciso entender RLS"
```
1. Leia cursor/rules/ARCHITECTURE.md seção 1
2. Veja exemplos em supabase/migrations/...sql
3. Consulte src/lib/supabase-rls.ts
4. Leia comentários em src/app/api/v1/members/route.ts
```

---

## 🚀 Fluxo de Desenvolvimento com IA

### Prompt Eficaz:

```
"Vou adicionar um novo campo 'data_batismo' a membros.

Contexto:
- Consulte: MODULES_INDEX.md#gerenciamento-de-membros
- Arquivo: src/app/api/v1/members/route.ts
- Tipo: src/types/supabase-generated.ts
- Componente: src/components/FichaMembro.tsx

Tarefa:
1. Modifique schema SQL
2. Atualize tipos
3. Atualize componente
4. Atualize MODULES_INDEX.md

Siga cursor/rules/CODE_STYLE.md e MODULE_PATTERNS.md"
```

### Resposta Eficaz da IA:

A IA terá informações específicas do módulo, saberá os padrões do projeto e poderá fazer mudanças coerentes.

---

## 📋 Checklist Antes de Commitar

- [ ] Código segue `cursor/rules/CODE_STYLE.md`?
- [ ] Nova feature tem referência em `MODULES_INDEX.md`?
- [ ] Arquivo tem tag `@see`?
- [ ] Documentação atualizada?
- [ ] RLS policies corretas (se aplicável)?
- [ ] Auditoria registrada (se aplicável)?
- [ ] Testes adicionados?

---

## 📌 Próximos Passos

0. **Ponto atual (06 fev 2026): Estrutura Hierárquica (Divisões)**
   - Tela/fluxo principal: `src/app/secretaria/congregacoes/page.tsx` (inclui alias `/secretaria/estrutura-hierarquica`)
   - Situação: abas D1↔D3 trocadas, dependências removidas, seleção múltipla adicionada; falta implementar o novo formulário da 1ª divisão conforme imagem.

1. **Mover docs antigos para cursor/docs/**
   - EXECUTAR_SQL_DASHBOARD.md
   - SEU_PROJETO_PROXIMO_PASSO.md
   - etc

2. **Criar README.md para módulos principais:**
   - cursor/docs/MEMBERS.md
   - cursor/docs/CARTOES.md
   - cursor/docs/SUPABASE.md

3. **Adicionar @see tags em arquivos principais**

4. **Criar exemplos de uso para cada módulo**

---

## 💡 Dicas

- ✅ Use `MODULES_INDEX.md` como primeiro ponto de consulta
- ✅ `@see` tags ajudam IA a navegar
- ✅ README.md em cada módulo importante
- ✅ Atualize referências quando mudar código
- ✅ Use exemplos reais no README
- ✅ Documente o WHY, não só o WHAT

---

**Versão:** 1.0  
**Data:** 2 jan 2026  
**Propósito:** Guia de navegação do projeto
