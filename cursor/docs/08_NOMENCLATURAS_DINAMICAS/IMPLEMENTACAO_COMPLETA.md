# Nomenclaturas Dinâmicas - Implementação Completa

## Resumo da Solução

Implementação de um sistema completo onde as nomeclaturas (rótulos de divisões organizacionais) são definidas nas Configurações e aplicadas dinamicamente nos cartões de membros.

## Componentes Implementados

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
- ✅ `{divisao3}` → Igreja/Congregação (rótulo dinâmico) **NOVO**
- ✅ `{divisao3_valor}` → Nome da Igreja/Congregação (valor do membro) **NOVO**

### 3. **Função de Substituição Frontend** (`src/lib/cartoes-utils.ts`)
- ✅ Carrega nomenclaturas do `localStorage`
- ✅ Substitui `{divisao3}` pelo rótulo dinâmico (ex: "IGREJA" ou "CONGREGAÇÃO")
- ✅ Substitui `{divisao3_valor}` pelo valor do campo `congregacao` do membro
- ✅ Mantém compatibilidade com `{congregacao}` para compatibilidade

**Exemplo de substituição:**
```
Texto do template: "Local: {divisao3}: {divisao3_valor}"
Com nomenclatura:  { divisaoTerciaria: { opcao1: 'Igreja' } }
Com membro:        { congregacao: 'Templo Graça' }
Resultado final:   "Local: IGREJA: Templo Graça"
```

### 4. **API de Substituição** (`src/app/api/cartoes/substituir-placeholders/route.ts`)
- ✅ Atualizada para aceitar nomenclaturas via request
- ✅ Implemente o mesmo tratamento que o frontend
- ✅ Suporta substituição em batch printing

## Fluxo de Funcionamento

### 1️⃣ **Configuração das Nomenclaturas**
```
Usuário acessa: Configurações → Nomenclaturas
Define: divisaoTerciaria = "CONGREGAÇÃO" (em vez de "IGREJA")
Clica: "✓ Salvar Nomenclaturas"
Resultado: localStorage['nomenclaturas'] = JSON.stringify({...})
```

### 2️⃣ **Edição de Cartão com Placeholders Dinâmicos**
```
Usuário acessa: Configurações → Cartões
Edita um template e adiciona texto:
"Local: {divisao3}"
"Nome da Congregação: {divisao3_valor}"

Clica em Salvar
```

### 3️⃣ **Renderização do Cartão**
```
CartãoMembro.tsx carrega o membro (ex: { congregacao: 'Templo Vida' })
Chama: substituirPlaceholders(template.texto, membro)
Função:
  1. Carrega nomenclaturas do localStorage
  2. Substitui {divisao3} → "CONGREGAÇÃO" (do localStorage)
  3. Substitui {divisao3_valor} → "Templo Vida" (do membro)
Resultado exibido no cartão
```

## Estrutura de Dados

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

## Testes Realizados

### ✅ Nomenclaturas Persistem
1. Abrir Configurações → Nomenclaturas
2. Alterar "IGREJA" para "TEMPLO"
3. Clicar "✓ Salvar Nomenclaturas"
4. Recarregar página (F5)
5. Verificar que "TEMPLO" permanece salvo ✓

### ✅ Placeholders Dinâmicos Funcionam
1. Editar template com `{divisao3}: {divisao3_valor}`
2. Salvar template
3. Visualizar cartão de membro
4. Verificar que exibe: "TEMPLO: Templo Graça" ✓

### ✅ Compatibilidade com Batches
1. Usar função `CartaoBatchPrinter`
2. Selecionar múltiplos membros
3. Imprimir cartões
4. Verificar que `{divisao3}` mostra rótulo correto para todos ✓

## Arquivos Modificados

1. **`src/lib/cartoes-utils.ts`**
   - Adicionado `{divisao3_valor}` ao PLACEHOLDERS_CONFIG
   - Adicionada lógica para carregar nomenclaturas
   - Adicionada substituição dinâmica de `{divisao3}`

2. **`src/app/api/cartoes/substituir-placeholders/route.ts`**
   - Adicionado suporte para `{divisao3_valor}`
   - Atualizada função `substituirPlaceholders` com parâmetro nomenclaturas
   - Implementada lógica de substituição dinâmica

3. **`src/app/configuracoes/nomenclaturas/page.tsx`**
   - Adicionado `useEffect` para carregar do localStorage
   - Adicionada persistência em `handleSave`
   - Adicionado guard `if (!loaded) return null`

4. **`src/app/configuracoes/cartoes/page.tsx`**
   - Adicionado `{divisao3_valor}` ao PLACEHOLDERS_DISPONIVEIS

## Próximos Passos (Opcional)

- [ ] Adicionar validação para nomenclaturas vazias
- [ ] Criar endpoint GET para recuperar nomenclaturas via API
- [ ] Implementar fallback automático se nomenclatura não estiver salva
- [ ] Adicionar histórico de mudanças de nomenclaturas

## Troubleshooting

### Problema: Placeholders não substituem
**Solução:** Verificar se nomenclaturas estão salvas em localStorage
```javascript
// No console do navegador:
JSON.parse(localStorage.getItem('nomenclaturas'))
```

### Problema: Nomenclaturas não persistem após reload
**Solução:** Verificar se o handler `handleSave` está sendo chamado
```javascript
// Adicione console.log em handleSave para debug
localStorage.setItem('nomenclaturas', JSON.stringify(temp));
console.log('Salvo:', temp);
```

### Problema: Diferença entre Frontend e API
**Solução:** Passar nomenclaturas no corpo da requisição
```typescript
fetch('/api/cartoes/substituir-placeholders', {
  method: 'POST',
  body: JSON.stringify({
    texto: '...',
    membro: {...},
    nomenclaturas: JSON.parse(localStorage.getItem('nomenclaturas'))
  })
})
```
