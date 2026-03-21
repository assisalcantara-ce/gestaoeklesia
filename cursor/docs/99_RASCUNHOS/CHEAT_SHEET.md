# ⚡ CHEAT SHEET - Gestão Eklesia

## 🚨 PROBLEMA: Card Esticado (100vh)

### ❌ Causa Raiz
```
mb-20  mb-16  mb-12  (muito grande)
mt-20  mt-16  mt-12  (muito grande)
space-y-4 (entre label e input)
py-4 (padding input)
p-8 (padding card)
```

### ✅ Solução
```
mb-6   mb-4   (máximo)
mt-6   mt-4   (máximo)
space-y-2 (entre label e input)
py-3 (padding input)
p-6 (padding card)
```

### 📏 Redução %
- mb-20 → mb-6: **-73%**
- mb-12 → mb-4: **-67%**
- mt-16 → mt-6: **-62%**
- mt-20 → mt-4: **-80%**

---

## 📋 Card Padrão (Copiar/Colar)

```tsx
<div className="rounded-2xl shadow-sm p-6 mx-4" style={{ backgroundColor: '#4A6FA5E6' }}>
  {/* Título */}
  <h2 className="text-center text-xl font-bold mb-6">Título</h2>
  
  {/* Form Row */}
  <div className="space-y-2 mb-4">
    <label>Email</label>
    <input className="w-full px-4 py-3 rounded-lg" />
  </div>
  
  {/* Última row - maior spacing */}
  <div className="space-y-2 mb-6">
    <label>Senha</label>
    <input className="w-full px-4 py-3 rounded-lg" />
  </div>
  
  {/* Botão */}
  <button className="w-full mt-6 py-3 px-4">Entrar</button>
  
  {/* Link/Footer */}
  <div className="mt-4 text-center">Link ou footer</div>
</div>
```

---

## 🎨 Grid Padrão (Cards)

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
  {items.map(item => (
    <div className="rounded-2xl shadow-sm p-6 hover:shadow-md transition cursor-pointer">
      {item.content}
    </div>
  ))}
</div>
```

---

## 🔴 NUNCA USE

```
❌ shadow-lg          (use shadow-sm)
❌ shadow-2xl         (use shadow-sm)
❌ mb-20, mb-16, mb-12   (use mb-6, mb-4)
❌ mt-20, mt-16, mt-12   (use mt-6, mt-4)
❌ space-y-4          (use space-y-2)
❌ py-4 em inputs     (use py-3)
❌ py-4 em buttons    (use py-3)
❌ p-8 em cards       (use p-6)
❌ px-5 em inputs     (use px-4)
```

---

## 🟢 SEMPRE USE

```
✅ shadow-sm              (cards)
✅ hover:shadow-md        (hover)
✅ mb-6, mb-4             (margens)
✅ mt-6, mt-4             (top margin)
✅ space-y-2              (form spacing)
✅ py-3                   (input/button padding)
✅ px-4                   (input padding)
✅ p-6                    (card padding)
✅ rounded-2xl            (cards)
✅ rounded-lg             (inputs/buttons)
✅ gap-4                  (grid/flex)
```

---

## 📦 Importar Design System

```tsx
import { SPACING, COLORS, COMPONENTS, PATTERNS } from '@/config/design-system';

// Usar:
<div className={SPACING.containerPadding}>
  <div className={`${COMPONENTS.card} ${COMPONENTS.cardHover}`}>
    Conteúdo
  </div>
</div>
```

---

## 🎯 3 Documentos Essenciais

1. **`SOLUCAO_CARD_ESTICADO.md`** - Problem & Solution
2. **`DESIGN_SYSTEM_GUIDE.md`** - Values & Patterns
3. **`src/config/design-system.ts`** - Source Code

---

## 🚀 Novo Módulo em 15min

```
1. cp src/app/template/page.tsx src/app/novo/page.tsx
2. Editar: trocar "NovoModuloTemplate" pelo nome real
3. Copiar conteúdo dos cards do template
4. Manter classes: SPACING.*, COLORS.*, RADIUS.*
5. Testar em mobile/tablet/desktop
```

---

## 🔍 Se o Card Ficar Estranho

| Problema | Solução |
|----------|---------|
| Card muito grande | Reduzir mb-*, mt-*, space-y-* |
| Card muito pequeno | Aumentar p-6 ou gap-4 |
| Sombra muito pronunciada | Usar shadow-sm (não shadow-lg) |
| Texto muito junto | Adicionar space-y-2 |
| Espaço vertical gigante | Reduzir mt-20 para mt-4 |

---

## 💾 Arquivo Importante

**`src/config/design-system.ts`** tem:
- SPACING (20+ valores)
- COLORS (10+ cores)
- SHADOWS (3 níveis)
- TYPOGRAPHY
- COMPONENTS (combinações padrão)
- PATTERNS (layouts prontos)

**Abra este arquivo antes de:**
- Criar novo módulo
- Usar cor aleatória
- Adicionar margem/padding
- Criar card

---

## ⚡ Regra de Ouro

> **"Quando em dúvida sobre espaçamento, reduzir ao invés de aumentar!"**

- Cards grandes demais? Reduzir mb-20 → mb-6
- Inputs estranhos? Reduzir py-4 → py-3
- Espaço vazio? gap-4 é máximo em grids

---

## 📞 Quick Reference

```
ESPAÇAMENTO MÁXIMO NO CARD:    mb-6
ESPAÇAMENTO MÁXIMO BUTTONS:    mt-6
ESPAÇAMENTO MÁXIMO FOOTER:     mt-4
INPUT PADDING:                 px-4 py-3
BUTTON PADDING:                px-6 py-3
CARD PADDING:                  p-6
SOMBRA CARDS:                  shadow-sm
SOMBRA HOVER:                  hover:shadow-md
BORDA CARDS:                   rounded-2xl
BORDA INPUTS:                  rounded-lg
```

---

## 🎓 Aprendizado

O projeto levou muitas iterações tentando consertar espaçamentos aleatoriamente. A solução foi criar um **design system centralizado** onde:

- ✅ Todos os valores estão em 1 arquivo
- ✅ Novos módulos copiam padrão existente
- ✅ Mudanças globais afetam tudo
- ✅ Sem duplicação de código
- ✅ Escalável para 100+ páginas

**Tempo antes:** 2h por módulo
**Tempo depois:** 15min por módulo

🚀 **Ganho de 88% em produtividade!**

