# Nomenclaturas Dinâmicas - Implementação Completa v2.0

## Resumo da Solução

Implementação de um sistema completo onde as nomeclaturas (rótulos de divisões organizacionais) são definidas nas Configurações e aplicadas dinamicamente nos cartões de membros.

## 🔧 Componentes Implementados

### 1. **Página de Nomenclaturas** (`src/app/configuracoes/nomenclaturas/page.tsx`)
- ✅ Salva as nomenclaturas em `localStorage` com chave `'nomenclaturas'`
- ✅ Carrega nomenclaturas ao montar o componente
- ✅ Estrutura de dados:
  ```typescript
  {
    divisaoPrincipal: { opcao1: 'SUPERVISÃO', opcao2: 'REGIONAL' },
    divisaoSecundaria: { opcao1: 'CAMPO', opcao2: 'SETOR' },
    divisaoTerciaria: { opcao1: 'IGREJA', opcao2: 'CONGREGAÇÃO' }
  }
  ```

### 2. **Placeholders Disponíveis** (`src/app/configuracoes/cartoes/page.tsx`)
- ✅ `{divisao1}` → Supervisão/Regional (rótulo dinâmico)
- ✅ `{divisao2}` → Campo/Setor (rótulo dinâmico)
- ✅ `{divisao3}` → Igreja/Congregação (rótulo dinâmico) **NOVO - v2.0 CORRIGIDO**
- ✅ `{divisao3_valor}` → Nome da Igreja/Congregação (valor do membro) **NOVO**

### 3. **Função de Substituição Frontend** (`src/lib/cartoes-utils.ts`) - v2.0 CORRIGIDO
- ✅ **TRATAMENTO ESPECIAL para `{divisao3}` ANTES do forEach**
- ✅ Carrega nomenclaturas do `localStorage`
- ✅ Substitui `{divisao3}` pelo rótulo dinâmico (ex: "IGREJA" ou "CONGREGAÇÃO")
- ✅ Substitui `{divisao3_valor}` pelo valor do campo `congregacao` do membro
- ✅ Mantém compatibilidade com `{congregacao}`

**Exemplo de substituição:**
```
Texto do template: "Local: {divisao3}: {divisao3_valor}"
Com nomenclatura:  { divisaoTerciaria: { opcao1: 'IGREJA' } }
Com membro:        { congregacao: 'Templo Graça' }
Resultado final:   "Local: IGREJA: Templo Graça" ✅
```

### 4. **API de Substituição** (`src/app/api/cartoes/substituir-placeholders/route.ts`) - v2.0 CORRIGIDO
- ✅ **TRATAMENTO ESPECIAL para `{divisao3}` ANTES do forEach**
- ✅ Atualizada para aceitar nomenclaturas via request
- ✅ Implementa o mesmo tratamento que o frontend
- ✅ Suporta substituição em batch printing

## 📊 Fluxo de Funcionamento

### 1️⃣ **Configuração das Nomenclaturas**
```
Usuário acessa: Configurações → Nomenclaturas
Define: divisaoTerciaria = "Igreja"
Clica: "✓ Salvar Nomenclaturas"
Resultado: localStorage['nomenclaturas'] = JSON.stringify({...})
```

### 2️⃣ **Edição de Cartão com Placeholders Dinâmicos**
```
Usuário acessa: Configurações → Cartões
Edita um template e adiciona texto:
"Local: {divisao3}"
"Nome da Igreja: {divisao3_valor}"

Clica em Salvar
```

### 3️⃣ **Renderização do Cartão**
```
CartãoMembro.tsx carrega o membro (ex: { congregacao: 'Templo Vida' })
Chama: substituirPlaceholders(template.texto, membro)

PROCESSAMENTO (v2.0):
  1. **ANTES do forEach**: Tratamento ESPECIAL para {divisao3}
     - Carrega nomenclaturas do localStorage
     - {divisao3} → "IGREJA" (do localStorage['nomenclaturas'].divisaoTerciaria.opcao1)
  
  2. **No forEach**: Itera PLACEHOLDERS_CONFIG
     - {divisao3_valor} → "Templo Vida" (do membro.congregacao)
     - Outros placeholders normalmente

Resultado exibido no cartão: "Local: IGREJA: Templo Vida" ✅
```

## 💾 Estrutura de Dados

### Membro (localStorage['membros'])
```typescript
{
  id: '1',
  nome: 'JOÃO SILVA',
  supervisao: 'PA',
  campo: 'Belém',
  congregacao: 'Templo Graça',  // ← Usado por {divisao3_valor}
  ...
}
```

### Nomenclaturas (localStorage['nomenclaturas'])
```typescript
{
  divisaoPrincipal: { opcao1: 'SUPERVISÃO', opcao2: 'REGIONAL' },
  divisaoSecundaria: { opcao1: 'CAMPO', opcao2: 'SETOR' },
  divisaoTerciaria: { opcao1: 'IGREJA', opcao2: 'CONGREGAÇÃO' }
}
```

## ✅ Histórico de Versões

### v1.0 - Implementação Inicial
- ❌ `{divisao3}` em PLACEHOLDERS_CONFIG causou bug (pegava valor em vez de rótulo)
- ✅ Nomenclaturas salvam em localStorage
- ✅ `{divisao3_valor}` implementado

### v2.0 - Correção (31/12/2025)
- ✅ **REMOVIDO** `{divisao3}` de PLACEHOLDERS_CONFIG
- ✅ **ADICIONADO** tratamento ESPECIAL para `{divisao3}` ANTES do forEach
- ✅ `{divisao3}` agora substitui corretamente pelo rótulo
- ✅ `{divisao3_valor}` continua funcionando para o valor
- ✅ Sem conflitos, sem duplicação
- ✅ **Funciona perfeitamente!**

## 📝 Arquivos Modificados

### 1. `src/lib/cartoes-utils.ts` (v2.0 - CORRIGIDO)
```typescript
// ❌ REMOVIDO de PLACEHOLDERS_CONFIG:
// { campo: 'congregacao', placeholder: '{divisao3}', label: '...' }

// ✅ ADICIONADO ANTES do forEach:
if (nomenclaturas) {
  const divisao3Label = nomenclaturas.divisaoTerciaria?.opcao1 || 'CONGREGAÇÃO';
  const regex3 = new RegExp('\\{divisao3\\}', 'g');
  resultado = resultado.replace(regex3, divisao3Label);
}
```

### 2. `src/app/api/cartoes/substituir-placeholders/route.ts` (v2.0 - CORRIGIDO)
```typescript
// ❌ REMOVIDO de PLACEHOLDERS:
// { campo: 'congregacao', placeholder: '{divisao3}' }

// ✅ ADICIONADO ANTES do forEach:
if (nomenclaturas) {
  const divisao3Label = nomenclaturas.divisaoTerciaria?.opcao1 || 'CONGREGAÇÃO';
  const regex3 = new RegExp('\\{divisao3\\}', 'g');
  resultado = resultado.replace(regex3, divisao3Label);
}
```

### 3. `src/app/configuracoes/nomenclaturas/page.tsx` (v1.0)
- ✅ Adicionado `useEffect` para carregar do localStorage
- ✅ Adicionada persistência em `handleSave`
- ✅ Adicionado guard `if (!loaded) return null`

### 4. `src/app/configuracoes/cartoes/page.tsx` (v1.0)
- ✅ Adicionado `{divisao3_valor}` ao PLACEHOLDERS_DISPONIVEIS

## 🧪 Testes Realizados

### ✅ Nomenclaturas Persistem
1. Abrir Configurações → Nomenclaturas
2. Alterar "IGREJA" para "TEMPLO"
3. Clicar "✓ Salvar Nomenclaturas"
4. Recarregar página (F5)
5. Verificar que "TEMPLO" permanece salvo ✓

### ✅ Placeholders Dinâmicos Funcionam Corretamente (v2.0)
1. Editar template com `{divisao3}: {divisao3_valor}`
2. Salvar template
3. Visualizar cartão de membro
4. **RESULTADO ESPERADO:** "IGREJA: Templo Graça" ✅
5. **ANTES (v1.0 BUG):** "Templo Graça: Templo Graça" ❌
6. **AGORA (v2.0 CORRIGIDO):** "IGREJA: Templo Graça" ✅

### ✅ Compatibilidade com Batches
1. Usar função `CartaoBatchPrinter`
2. Selecionar múltiplos membros
3. Imprimir cartões
4. Verificar que `{divisao3}` mostra rótulo correto para todos ✓

## 🚨 Bug Encontrado e Corrigido

### O Problema (v1.0)
```
Template: "{divisao3}: {divisao3_valor}"
Resultado: "Sede Regional: Sede Regional" ❌

Causa: {divisao3} estava em PLACEHOLDERS_CONFIG mapeado para 'congregacao'
       Isso fazia pegasse o valor do membro em vez do rótulo
```

### A Solução (v2.0)
```
✅ Removeu {divisao3} de PLACEHOLDERS_CONFIG
✅ Adicionou tratamento ESPECIAL ANTES do forEach
✅ Garante que SEMPRE pega o rótulo das nomenclaturas
✅ Resultado: "IGREJA: Sede Regional" ✓
```

## 🔗 Por Que Funciona Agora?

**Ordem de processamento (v2.0):**

1. **ANTES do forEach** (tratamento especial):
   ```typescript
   if (nomenclaturas) {
     const divisao3Label = nomenclaturas.divisaoTerciaria?.opcao1 || 'CONGREGAÇÃO';
     // Substitui {divisao3} por "IGREJA"
   }
   ```
   Resultado: `"{IGREJA}: {divisao3_valor}"`

2. **DURANTE o forEach** (processamento normal):
   ```typescript
   PLACEHOLDERS_CONFIG.forEach(ph => {
     // {divisao3_valor} → membro.congregacao = "Templo Graça"
   });
   ```
   Resultado: `"IGREJA: Templo Graça"` ✅

Isso evita conflito porque:
- `{divisao3}` é substituído **ANTES** de entrar no forEach
- `{divisao3_valor}` é processado **DURANTE** o forEach normalmente
- Sem duplicação, sem sobreposição

## 📚 Documentação Relacionada

- [CORRECAO_DIVISAO3.md](CORRECAO_DIVISAO3.md) - Detalhe técnico da correção
- [GUIA_TESTES.md](GUIA_TESTES.md) - Como testar
- [MAPA_PLACEHOLDERS.md](MAPA_PLACEHOLDERS.md) - Referência técnica
- [README.md](README.md) - Resumo rápido

## 🚀 Próximos Passos (Opcional)

- [ ] Adicionar validação para nomenclaturas vazias
- [ ] Criar endpoint GET para recuperar nomenclaturas via API
- [ ] Adicionar histórico de mudanças de nomenclaturas
- [ ] Suportar `{divisao1_valor}` e `{divisao2_valor}`
- [ ] Implementar UI melhorada para preview dinâmico

## 🆘 Troubleshooting

| Problema | Causa | Solução |
|----------|-------|---------|
| `{divisao3}` mostra valor | v1.0 desatualizada | Atualizar para v2.0 |
| Placeholders não substituem | Nomenclaturas não salvas | Salvar em Configurações → Nomenclaturas |
| Nomenclaturas não persistem | localStorage desabilitado | Ativar localStorage no navegador |
| Diferença Frontend/API | Nomenclaturas não passadas | Passar no corpo da requisição |

---

**Status:** ✅ **FUNCIONANDO PERFEITAMENTE (v2.0)**  
**Data da Correção:** 31/12/2025  
**Versão Atual:** 2.0  
**Todos os testes passando:** ✅
