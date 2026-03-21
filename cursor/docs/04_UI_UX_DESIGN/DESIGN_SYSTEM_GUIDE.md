# 🎨 Design System - Referência Rápida

## ⚠️ PROBLEMA IDENTIFICADO E RESOLVIDO

O projeto tinha **espaçamentos inconsistentes** porque não havia um **design system centralizado**. Cada página usava valores diferentes, causando problemas de manutenção e escalabilidade.

**SOLUÇÃO:** Sistema de design centralizado em `src/config/design-system.ts`

---

## 📏 SPACING SCALE (Use SEMPRE estes valores)

```
containerPadding  = p-6      (24px - para containers principais)
containerGap      = gap-6    (24px - espaço entre seções)

sectionMargin     = mb-6     (24px - margem vertical entre sections)
sectionGap        = gap-4    (16px - espaço horizontal entre items)
cardPadding       = p-6      (24px - dentro dos cards)

formRowMargin     = mb-4     (16px - entre linhas de form)
formRowGap        = gap-4    (16px - entre inputs na mesma linha)
inputPadding      = px-4 py-2 (forma padrão)

menuItemPadding   = py-2 px-4
menuItemSpacing   = space-y-1 (4px entre itens)

buttonPadding     = px-6 py-2
buttonMargin      = mb-4
```

**REGRA OURO:**
- Nunca use valores aleatórios
- Copie do design-system.ts
- Se precisar de novo valor → adicione lá, não inline

---

## 🎯 COMO USAR EM NOVOS MÓDULOS

### Opção 1: JavaScript/TypeScript (Recomendado)
```tsx
import { SPACING, COLORS, RADIUS, COMPONENTS } from '@/config/design-system';

export default function MinhaNovaPage() {
  return (
    <div className={SPACING.containerPadding}>
      <div className={`${COMPONENTS.card} ${COMPONENTS.cardHover}`}>
        Seu conteúdo
      </div>
    </div>
  );
}
```

### Opção 2: Tailwind Direto (Para pequenos componentes)
```tsx
<div className="p-6 gap-4 mb-6 rounded-2xl shadow-sm hover:shadow-md transition">
  Conteúdo
</div>
```

---

## 🎨 CORES PADRÃO

```
Azuis (usar para textos/backgrounds):
  #123b63 → darkBlue (primário)
  #4A6FA5 → mediumBlue
  #0284c7 → lightBlue (acentos)
  
Acentos:
  #FBBF24 → yellow (ênfase)
  #F97316 → orange (alertas)
```

---

## 🔲 SHADOWS (Regra Importante!)

```
❌ NUNCA use: shadow-lg, shadow-2xl (muito grandes)
✅ USE: shadow-sm (sutil em cards)
✅ USE: hover:shadow-md (leve aumento no hover)
✅ USE: shadow-xl (apenas em modals/dialogs)
```

---

## 📐 PADRÕES DE LAYOUT

### Grid de Cards (4 colunas em desktop)
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
  {items.map(item => (
    <div className="rounded-2xl shadow-sm p-6 hover:shadow-md transition cursor-pointer">
      {item.content}
    </div>
  ))}
</div>
```

### Form Row (inputs lado a lado)
```tsx
<div className="flex flex-col gap-2 mb-4">
  <label>Email</label>
  <input className="rounded-lg border border-gray-300 px-4 py-2" />
</div>
```

### Menu Item
```tsx
<div className="py-2 px-4 transition hover:bg-gray-100 rounded-lg cursor-pointer">
  Menu Item
</div>
```

---

## 🔍 CHECKLIST ANTES DE CRIAR NOVO MÓDULO

- [ ] Importei `design-system.ts`?
- [ ] Usei `SPACING.*` para margens/paddings?
- [ ] Usei `COLORS.*` para cores (não hex aleatório)?
- [ ] Usei `shadow-sm` em cards (não shadow-lg)?
- [ ] Responsividade: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`?
- [ ] Inputs têm classe padrão: `COMPONENTS.input`?
- [ ] Cards têm: `RADIUS.card` + `SHADOWS.cardShadow` + `SPACING.cardPadding`?
- [ ] Transitions adicionadas: `TRANSITIONS.default`?

---

## 📱 RESPONSIVIDADE PADRÃO

```
Mobile:    max-width: 100%
Tablet:    md:grid-cols-2, md:w-1/2
Desktop:   lg:grid-cols-4, lg:w-full
```

---

## 🚀 PRÓXIMOS MÓDULOS - USE ESTE PADRÃO

Quando criar novo módulo:

1. **Copie a estrutura HTML dos cards/sections** de `usuarios/page.tsx` ou `dashboard/page.tsx`
2. **Use as classes do design-system.ts** ao invés de criar suas próprias
3. **Se precisar adicionar novo valor** (ex: spacing diferente) → adicione em `design-system.ts` com documentação

Exemplo para novo módulo de **Financeiro**:
```tsx
import { SPACING, COLORS, COMPONENTS, PATTERNS } from '@/config/design-system';

export default function FinanceiroPage() {
  return (
    <div className={`${SPACING.containerPadding} min-h-screen bg-white`}>
      <h1 className="text-3xl font-bold mb-6">Módulo Financeiro</h1>
      
      {/* Grid de cards padrão */}
      <div className={PATTERNS.cardGrid}>
        {/* Seus cards aqui */}
      </div>
    </div>
  );
}
```

---

## ❓ TROUBLESHOOTING

**"Espaçamento muito grande"** → Use `mb-4` em vez de `mb-6`
**"Espaçamento muito pequeno"** → Use `mb-6` em vez de `mb-4`
**"Shadow muito pronunciado"** → Use `shadow-sm` em vez de `shadow-lg`
**"Card ficou feio"** → Adicione: `${RADIUS.card} ${SHADOWS.cardShadow} ${SPACING.cardPadding}`

---

## 📚 ESTRUTURA DO PROJETO ATUALIZADA

```
src/
├── config/
│   └── design-system.ts        ← ⭐ USE ESTE ARQUIVO
├── app/
│   ├── layout.tsx
│   ├── globals.css
│   ├── page.tsx               (Login - atualizado)
│   ├── dashboard/
│   │   └── page.tsx           (Dashboard - atualizado)
│   └── usuarios/
│       └── page.tsx           (Usuários - atualizado)
```

---

## 🎯 VALORES MAIS USADOS

Memorize estes 5:

```
ESPAÇAMENTO:     mb-6, gap-4, p-6
SOMBRAS:         shadow-sm, hover:shadow-md
RAIO BORDA:      rounded-2xl (cards), rounded-lg (inputs)
CORES TEXTO:     text-gray-700, text-gray-600
CORES BG:        bg-white, bg-gray-100
```

---

## 💾 COMO SALVAR ESTE ARQUIVO

Este arquivo deve ser consultado constantemente durante desenvolvimento.
**Caminho:** `src/config/design-system.ts`

