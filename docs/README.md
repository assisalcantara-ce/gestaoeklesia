# 🎨 Gestão Eklesia - Sistema de Administração Ministerial

## ✅ Status: 95% Pronto para Desenvolvimento

Servidor rodando, database pronto, documentação organizada.

---

## 📍 **COMECE AQUI** (escolha rápido)

| Tempo | Opção | Link |
|---|---|---|
| ⚡ 30s | Quick Start | [cursor/docs/00_INDEX/QUICK_START.md](cursor/docs/00_INDEX/QUICK_START.md) |
| 5min | Guia Localização | [cursor/docs/00_INDEX/DOCUMENTACAO.md](cursor/docs/00_INDEX/DOCUMENTACAO.md) |
| 🗺️ Visual | Mapa Mental | [cursor/docs/00_INDEX/MAPA_NAVEGACAO.md](cursor/docs/00_INDEX/MAPA_NAVEGACAO.md) |
| 📚 Completo | Visão Geral | [cursor/INDEX.md](cursor/INDEX.md) |
| 🔍 Feature | Encontre | [MODULES_INDEX.md](MODULES_INDEX.md) |
| 📖 Toda Doc | Índice Completo | [cursor/docs/00_INDEX/README.md](cursor/docs/00_INDEX/README.md) |

---

## 📊 Sistema Operacional

✅ **Servidor**: http://localhost:3000 (Next.js rodando)  
✅ **Database**: Supabase Cloud (9 tabelas, RLS)  
✅ **Documentação**: 37 docs + 3 padrões (cursor/)  
✅ **Estrutura**: Escalável e pronta  
✅ **Padrões**: TypeScript, React, multi-tenant definidos  

---

---

## 📚 Documentação Importante

### 🎯 Arquivos de Referência (LEIA ANTES DE DESENVOLVER)

1. **`DESIGN_SYSTEM_GUIDE.md`** ⭐ PRINCIPAL
   - Valores de espaçamento padronizados
   - Cores do sistema
   - Componentes reutilizáveis
   - Padrões de layout
   - **USE ESTE ARQUIVO EM TODOS OS NOVOS MÓDULOS**

2. **`SOLUCAO_CARD_ESTICADO.md`**
   - Problema: Card ocupando 100vh
   - Causa: Espaçamentos gigantes (mb-20, mb-12, mt-16, mt-20)
   - Solução: Reduzir para mb-6, mb-4, mt-6, mt-4
   - Padrão para cards futuros

3. **`RESUMO_SOLUCAO.md`**
   - Resumo do design system
   - Impacto na escalabilidade
   - Exemplo pronto de novo módulo

4. **`src/config/design-system.ts`**
   - Código-fonte das constantes
   - Importar em novos componentes
   - 20+ valores padronizados

---

## 🚀 Como Criar Novo Módulo (15 minutos)

### Passo 1: Copiar Template
```bash
cp src/app/template/page.tsx src/app/meu-modulo/page.tsx
```

### Passo 2: Importar Design System
```tsx
import { SPACING, COLORS, COMPONENTS } from '@/config/design-system';
```

### Passo 3: Usar Valores Padrão
```tsx
<div className={`${SPACING.containerPadding} min-h-screen bg-white`}>
  <h1 className="text-4xl font-bold" style={{ color: COLORS.darkBlue }}>
    Meu Módulo
  </h1>
</div>
```

**Resultado:** Layout consistente em 15 minutos ✅

---

## ⚠️ SOLUÇÃO IMPORTANTE: Card Esticado

Se seu card ocupa toda a altura da tela:

**❌ ERRADO:**
```tsx
<div className="mb-20 space-y-4 mb-12 mt-16 mt-20">
  Card content
</div>
```

**✅ CORRETO:**
```tsx
<div className="mb-6 space-y-2 mb-4 mt-6">
  Card content
</div>
```

**Resumo:**
- `mb-20` → `mb-6` (-73%)
- `space-y-4` → `space-y-2` (-50%)
- `mt-16` → `mt-6` (-62%)
- `mt-20` → `mt-4` (-80%)

📖 **Leia:** `SOLUCAO_CARD_ESTICADO.md`

---

## 🎨 Valores Mais Usados (Memorizar)

```
ESPAÇAMENTO:    p-6, mb-6, gap-4
SOMBRAS:        shadow-sm, hover:shadow-md
RAIO BORDA:     rounded-2xl (cards), rounded-lg (inputs)
CORES:          #123b63 (dark), #4A6FA5 (medium), #0284c7 (light)
INPUTS:         px-4 py-3 (não py-4!)
BUTTONS:        py-3 (não py-4!)
CARDS:          p-6 (não p-8!)
```

---

## 📂 Estrutura do Projeto

```
src/
├── config/
│   └── design-system.ts        ← ⭐ USE ESTE ARQUIVO
├── app/
│   ├── layout.tsx
│   ├── globals.css
│   ├── page.tsx                (Login - compacto ✅)
│   ├── dashboard/
│   │   └── page.tsx            (Dashboard)
│   ├── usuarios/
│   │   └── page.tsx            (Usuários)
│   └── template/
│       └── page.tsx            (Template para novos módulos)
│
└── [NOVOS MÓDULOS AQUI]
    ├── financeiro/page.tsx
    ├── relatorios/page.tsx
    └── etc...

DOCUMENTAÇÃO:
├── DESIGN_SYSTEM_GUIDE.md      (Guia de estilo)
├── SOLUCAO_CARD_ESTICADO.md    (Solução problema card)
├── RESUMO_SOLUCAO.md            (Resumo executivo)
└── README.md                    (Este arquivo)
```

---

## 🔐 Credenciais de Teste

5 usuários cadastrados no sistema:

| Email | Senha | Nível |
|-------|-------|-------|
| presidente@eklesia.com | 123456 | Administrador |
| financeiro@eklesia.com | 123456 | Financeiro |
| pastor@eklesia.com | 123456 | Operador |
| superintendente@eklesia.com | 123456 | Superintendente |
| coordenador@eklesia.com | 123456 | Coordenador |

---

## 🛠️ Stack Técnico

- **Framework:** Next.js 16.0.5 (Turbopack)
- **UI:** React 19.2.0
- **Styling:** Tailwind CSS 4.0
- **TypeScript:** 5.7.2 (strict mode)
- **PostCSS:** 8.4.49

---

## 📝 Checklist Novo Módulo

Antes de commitar, verifique:

- [ ] Importou `design-system.ts`?
- [ ] Usou `SPACING.*` para margens/paddings?
- [ ] Usou `COLORS.*` para cores?
- [ ] Cards têm `shadow-sm` (não shadow-lg)?
- [ ] Inputs têm `py-3` (não py-4)?
- [ ] Títulos têm `mb-6` máximo (não mb-20)?
- [ ] Responsivo: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`?
- [ ] Testou em mobile/tablet/desktop?

---

## 🎯 Próximos Módulos Planejados

1. **Financeiro** - Receitas, despesas, relatórios
2. **Relatórios** - Exportação PDF, gráficos
3. **Eventos** - Cadastro e controle
4. **Membros** - Base de dados de membros
5. **Agendamentos** - Sistema de reservas

Use o template `src/app/template/page.tsx` para começar!

---

## 📞 Suporte

Para dúvidas sobre:
- **Espaçamentos:** `DESIGN_SYSTEM_GUIDE.md`
- **Layout quebrado:** `SOLUCAO_CARD_ESTICADO.md`
- **Novo módulo:** `src/app/template/page.tsx`
- **Constantes:** `src/config/design-system.ts`

---

## ✨ Lembrete Final

> **"O maior ganho foi centralizar TUDO em um único arquivo de design system. Agora qualquer novo módulo leva 15 minutos ao invés de 2 horas."**

Mantém as constantes atualizadas em `src/config/design-system.ts` e toda a aplicação cresce de forma consistente! 🚀

