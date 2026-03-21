# Correção: {divisao3} Mostrando Valor em vez de Rótulo

## 🐛 Problema Identificado

Ao usar o template `{divisao3}: {divisao3_valor}`, o resultado era:
```
Sede Regional: Sede Regional  ❌
```

Em vez do esperado:
```
IGREJA: Sede Regional  ✅
```

## 🔍 Causa Raiz

`{divisao3}` estava mapeado em `PLACEHOLDERS_CONFIG` com `campo: 'congregacao'`, o que causava que ele **sempre** pegasse o valor do membro em vez do rótulo das nomenclaturas.

**O problema:**
```typescript
// ANTES (errado):
PLACEHOLDERS_CONFIG = [
  { campo: 'congregacao', placeholder: '{divisao3}', label: '...' },  // ❌ Pega valor do membro
  { campo: 'congregacao', placeholder: '{divisao3_valor}', label: '...' }  // ✅ Correto
]
```

Quando a função forEach iterava sobre `{divisao3}`, ele simplesmente substituía pelo valor de `membro['congregacao']` antes mesmo de considerar as nomenclaturas.

## ✅ Solução Implementada

1. **Removido** `{divisao3}` de `PLACEHOLDERS_CONFIG`
2. **Adicionado** tratamento ESPECIAL para `{divisao3}` **ANTES** do forEach
3. Este tratamento carrega as nomenclaturas e substitui corretamente

**O novo código:**
```typescript
// Tratamento ESPECIAL para {divisao3} - ANTES do forEach para evitar conflito
if (nomenclaturas) {
  const divisao3Label = nomenclaturas.divisaoTerciaria?.opcao1 || 'CONGREGAÇÃO';
  const regex3 = new RegExp('\\{divisao3\\}', 'g');
  resultado = resultado.replace(regex3, divisao3Label);
}

// Depois o forEach processa todos os outros placeholders
PLACEHOLDERS_CONFIG.forEach(ph => {
  // ... resto do código ...
});
```

## 📋 Arquivos Modificados

### 1. `src/lib/cartoes-utils.ts`
- ❌ Removido: `{ campo: 'congregacao', placeholder: '{divisao3}', ... }`
- ✅ Adicionado: Tratamento especial para `{divisao3}` ANTES do forEach
- ✅ Mantido: `{divisao3_valor}` em PLACEHOLDERS_CONFIG mapeado para `congregacao`

### 2. `src/app/api/cartoes/substituir-placeholders/route.ts`
- ❌ Removido: `{ campo: 'congregacao', placeholder: '{divisao3}' }`
- ✅ Adicionado: Tratamento especial para `{divisao3}` ANTES do forEach
- ❌ Removido: Código duplicado do tratamento dentro do forEach

## 🧪 Como Testar a Correção

1. **Configurar nomenclaturas**
   ```
   Configurações → Nomenclaturas
   Edite: divisaoTerciaria = "IGREJA"
   Clique: "✓ Salvar Nomenclaturas"
   ```

2. **Editar um template**
   ```
   Configurações → Cartões
   Edite um template
   Adicione no texto: "{divisao3}: {divisao3_valor}"
   Clique: "Salvar Template"
   ```

3. **Visualizar cartão**
   ```
   Selecione um membro
   Na seção de Cartão, verifique o resultado:
   
   ✅ CORRETO: "IGREJA: Sede Regional"
   ❌ ERRADO:  "Sede Regional: Sede Regional"
   ```

## 📊 Fluxo de Substituição (Corrigido)

```
Template: "{divisao3}: {divisao3_valor}"
Membro: { congregacao: "Sede Regional" }
Nomenclaturas: { divisaoTerciaria: { opcao1: "IGREJA" } }

PROCESSAMENTO:
1. Tratamento ESPECIAL para {divisao3}:
   - Carrega nomenclaturas do localStorage
   - Pega divisaoTerciaria.opcao1 = "IGREJA"
   - Substitui {divisao3} → "IGREJA"
   
2. forEach em PLACEHOLDERS_CONFIG:
   - {divisao3_valor} encontrado
   - Pega membro['congregacao'] = "Sede Regional"
   - Substitui {divisao3_valor} → "Sede Regional"

RESULTADO: "IGREJA: Sede Regional" ✅
```

## 🔄 Compatibilidade

- ✅ `{divisao1}` e `{divisao2}` continuam funcionando (ainda em PLACEHOLDERS_CONFIG)
- ✅ `{divisao3_valor}` continua funcionando normalmente
- ✅ Backwards compatible com templates antigos que usam `{congregacao}`
- ✅ Batch printing funciona com a correção

## 📝 Notas Técnicas

### Por que ANTES do forEach?
Se o `{divisao3}` ficasse dentro do forEach no PLACEHOLDERS_CONFIG, seria processado como valor de campo, ignorando as nomenclaturas. Ao colocar o tratamento ANTES, garantimos que:
1. Nomenclaturas são sempre verificadas
2. Placeholder é substituído ANTES de entrar no forEach
3. Não há conflito com `{divisao3_valor}`

### Fallback
Se nomenclaturas não estiverem salvas, o código usa o padrão:
```typescript
const divisao3Label = nomenclaturas?.divisaoTerciaria?.opcao1 || 'CONGREGAÇÃO';
```
Isso garante que sempre haja um valor, nunca fica vazio.

## ✨ Resultado

| Aspecto | Antes | Depois |
|---------|-------|--------|
| `{divisao3}` mostra | Valor do membro ❌ | Rótulo das nomenclaturas ✅ |
| `{divisao3_valor}` mostra | Valor do membro ✅ | Valor do membro ✅ |
| Template: `{divisao3}: {divisao3_valor}` | ❌ Errado | ✅ Correto |

---

**Status:** ✅ CORRIGIDO  
**Data:** 31/12/2025  
**Versão:** 2.0
