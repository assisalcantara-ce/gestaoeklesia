# ⚡ REFERÊNCIA RÁPIDA - Valores Proibidos vs Permitidos

## 🚨 VALORES BLOQUEADOS (NUNCA USE)

### Margens Verticais
```
❌ BLOQUEADO:  mb-20, mb-16, mb-12
✅ PERMITIDO:  mb-6, mb-4, mb-3, mb-2, mb-1

❌ BLOQUEADO:  mt-20, mt-16, mt-12
✅ PERMITIDO:  mt-6, mt-4, mt-3, mt-2, mt-1

❌ BLOQUEADO:  py-5, py-4
✅ PERMITIDO:  py-3, py-2

❌ BLOQUEADO:  pt-8, pt-6
✅ PERMITIDO:  pt-4, pt-2

❌ BLOQUEADO:  pb-8, pb-6
✅ PERMITIDO:  pb-4, pb-2
```

### Gaps e Espaçamentos
```
❌ BLOQUEADO:  space-y-4 (entre label e input)
✅ PERMITIDO:  space-y-2, space-y-1

❌ BLOQUEADO:  gap-8
✅ PERMITIDO:  gap-6, gap-4, gap-3

❌ BLOQUEADO:  p-8
✅ PERMITIDO:  p-6, p-5, p-4
```

### Sombras
```
❌ BLOQUEADO:  shadow-lg, shadow-2xl, shadow-xl
✅ PERMITIDO:  shadow-sm, shadow-md
```

### Tamanhos
```
❌ BLOQUEADO:  text-2xl (em subtítulos)
✅ PERMITIDO:  text-xl, text-lg
```

---

## 📋 TABELA DE REFERÊNCIA RÁPIDA

| Elemento | ❌ Errado | ✅ Correto | Redução |
|----------|----------|-----------|---------|
| Card padding | p-8 | p-6 | -25% |
| Card title margin | mb-20 | mb-6 | -70% |
| Form row gap | space-y-4 | space-y-2 | -50% |
| Form row margin | mb-12 | mb-4 | -67% |
| Button top | mt-16 | mt-6 | -62% |
| Link/footer top | mt-20 | mt-4 | -80% |
| Input padding | py-4 | py-3 | -25% |
| Card shadow | shadow-lg | shadow-sm | menor |
| Card hover | hover:shadow-2xl | hover:shadow-md | menor |

---

## 💻 TEMPLATE - COPIAR E COLAR

```tsx
// ❌ ERRADO
<div className="p-8 mx-8">
  <h2 className="mb-20">Título</h2>
  <div className="space-y-4 mb-12">
    <input className="py-4" />
  </div>
  <button className="mt-16 py-4">OK</button>
  <div className="mt-20">Link</div>
  <div className="mt-12 pt-8">Footer</div>
</div>

// ✅ CORRETO
<div className="p-6 mx-4">
  <h2 className="mb-6">Título</h2>
  <div className="space-y-2 mb-4">
    <input className="py-3" />
  </div>
  <button className="mt-6 py-3">OK</button>
  <div className="mt-4">Link</div>
  <div className="mt-4 pt-4">Footer</div>
</div>
```

---

## 🎨 VALORES PADRÃO POR ELEMENTO

### Card
```tsx
<div className="rounded-2xl shadow-sm p-6 mx-4">
  {/* content */}
</div>
```

### Card Title
```tsx
<h2 className="text-center text-xl font-bold mb-6">Título</h2>
```

### Form Row
```tsx
<div className="space-y-2 mb-4">
  <label>Label</label>
  <input className="w-full px-4 py-3 rounded-lg" />
</div>
```

### Last Form Row (antes do botão)
```tsx
<div className="space-y-2 mb-6">
  <label>Label</label>
  <input className="w-full px-4 py-3 rounded-lg" />
</div>
```

### Button
```tsx
<button className="w-full mt-6 px-4 py-3 bg-blue-600 rounded-lg font-bold">
  Entrar
</button>
```

### Link/Footer
```tsx
<div className="mt-4 text-center">
  <p className="text-xs text-gray-600">
    <a href="#" className="text-blue-600 hover:text-blue-700">Link aqui</a>
  </p>
</div>
```

### Card Footer
```tsx
<div className="mt-4 pt-4 border-t border-gray-200 text-center">
  <button className="px-6 py-2 text-sm rounded-lg">Ação</button>
</div>
```

---

## 🔍 COMO VALIDAR SEU CÓDIGO

Antes de commitar, procure por:

```bash
# ❌ ENCONTRADO = PROBLEMA
grep -r "mb-20\|mb-16\|mb-12" src/
grep -r "mt-20\|mt-16\|mt-12" src/
grep -r "space-y-4" src/app/page.tsx
grep -r "py-4" src/app/page.tsx
grep -r "p-8" src/app/page.tsx
grep -r "shadow-lg\|shadow-2xl" src/app/page.tsx
```

Se encontrar algo, corrija!

---

## 📊 ALTURA DO CARD

```
Objetivo: Card nunca deve ultrapassar 350px

Se card > 350px:
  1. Reduzir mb- (máximo mb-6)
  2. Reduzir mt- (máximo mt-6)
  3. Reduzir space-y- (usar space-y-2)
  4. Reduzir p (usar p-6 máximo)
  5. Remover espaços vazios

Checklist:
  ☐ Nenhum mb-* > mb-6?
  ☐ Nenhum mt-* > mt-6?
  ☐ space-y-2 ou menor?
  ☐ py-3 em inputs?
  ☐ Card < 350px?
```

---

## 🎯 REGRA SIMPLES

**Quando em dúvida, reduzir é melhor que aumentar!**

```
"Espaço muito grande?" → Reduzir pela metade
"Ficou apertado?" → Aumentar um nível

Exemplo:
mb-20 → mb-12 → mb-6 → mb-4 → mb-2
```

---

## 📱 RESPONSIVIDADE

```tsx
// Mobile
<div className="px-4 py-6">

// Tablet
<div className="md:px-6 md:py-8">

// Desktop
<div className="lg:px-8 lg:py-10">
```

**Mas MÁXIMO no mobile é p-6, não ultrapassar!**

---

## 🚀 VALORES SEGUROS (Use sempre)

```
Padding:        px-4, py-3
Margin:         mb-6, mb-4, mt-6, mt-4
Gap:            gap-4, gap-3, gap-2
Space-y:        space-y-2, space-y-1
Border radius:  rounded-2xl (cards), rounded-lg (inputs)
Shadow:         shadow-sm, shadow-md
Text:           text-xl, text-lg, text-base, text-sm, text-xs
```

Se usar apenas esses valores, vai funcionar perfeito!

---

## 💾 ARQUIVO DE REFERÊNCIA

Quando precisar, consulte:

1. **Este arquivo** - Para valores proibidos/permitidos
2. **`CHEAT_SHEET.md`** - Para copiar/colar
3. **`src/config/design-system.ts`** - Para constantes
4. **`src/app/template/page.tsx`** - Para exemplo completo

---

## ✅ CHECKLIST PRÉ-COMMIT

- [ ] Nenhum `mb-20`, `mb-16`, `mb-12` encontrado?
- [ ] Nenhum `mt-20`, `mt-16`, `mt-12` encontrado?
- [ ] Nenhum `space-y-4` em form rows?
- [ ] Nenhum `py-4` em inputs/buttons?
- [ ] Nenhum `p-8` em cards?
- [ ] Nenhum `shadow-lg` ou `shadow-2xl` em cards?
- [ ] Card height < 350px?
- [ ] Testado em mobile/tablet/desktop?

Se todos ✅, pronto para dar push! 🚀

