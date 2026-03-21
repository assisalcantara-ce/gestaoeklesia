# Mapa de Placeholders - Nomenclaturas Dinâmicas

## Visão Geral dos Placeholders

Existem dois tipos de placeholders no sistema:

### Tipo 1: Rótulos Dinâmicos (Nomenclaturas)
Estes placeholders substituem os rótulos/etiquetas baseado no que foi configurado em **Configurações → Nomenclaturas**.

| Placeholder | Campo | Padrão | Configurável | Origem |
|------------|-------|--------|--------------|--------|
| `{divisao1}` | supervisao | SUPERVISÃO | Sim (opcao1/opcao2) | nomenclaturas.divisaoPrincipal |
| `{divisao2}` | campo | CAMPO | Sim (opcao1/opcao2) | nomenclaturas.divisaoSecundaria |
| `{divisao3}` | congregacao | CONGREGAÇÃO | Sim (opcao1/opcao2) | nomenclaturas.divisaoTerciaria |

### Tipo 2: Valores de Membro (Dados Reais)
Estes placeholders substituem pelos dados reais do membro.

| Placeholder | Campo Membro | Valor Exemplo | Tipo |
|------------|-------------|---------------|------|
| `{divisao3_valor}` | congregacao | Templo Vida | Novo ⭐ |
| `{congregacao}` | congregacao | Templo Vida | Legado |
| `{nome}` | nome | JOÃO SILVA | Existente |
| `{supervisao}` | supervisao | PA | Existente |
| `{campo}` | campo | Belém | Existente |
| `{cpf}` | cpf | 123.456.789-10 | Existente |

## Fluxo de Substituição

### Exemplo Prático

**Configuração:**
```
Nomenclaturas:
  divisaoTerciaria = { opcao1: 'CONGREGAÇÃO', opcao2: 'TEMPLO' }

Membro:
  nome: 'JOÃO SILVA'
  congregacao: 'Templo Graça'
  campo: 'Belém'

Template de Cartão:
  "Membro: {nome}
   Localidade: {campo}
   Tipo: {divisao3}
   Igreja: {divisao3_valor}"
```

**Processo de Substituição (em cartoes-utils.ts):**

```typescript
1. Carregar nomenclaturas do localStorage
   → { divisaoTerciaria: { opcao1: 'CONGREGAÇÃO', opcao2: 'TEMPLO' } }

2. Para cada placeholder no PLACEHOLDERS_CONFIG:
   {divisao1} → não há no template, pula
   {divisao2} → não há no template, pula
   {divisao3} → encontrado!
      - ph.placeholder === '{divisao3}' ✓
      - nomenclaturas existe ✓
      - valor = nomenclaturas.divisaoTerciaria.opcao1
      - valor = 'CONGREGAÇÃO'
      - substitui {divisao3} por 'CONGREGAÇÃO'
   
   {divisao3_valor} → encontrado!
      - membro['congregacao'] = 'Templo Graça'
      - substitui {divisao3_valor} por 'Templo Graça'
   
   {nome} → encontrado!
      - membro['nome'] = 'JOÃO SILVA'
      - substitui {nome} por 'JOÃO SILVA'
   
   {campo} → encontrado!
      - membro['campo'] = 'Belém'
      - substitui {campo} por 'Belém'
```

**Resultado Final:**
```
Membro: JOÃO SILVA
Localidade: Belém
Tipo: CONGREGAÇÃO
Igreja: Templo Graça
```

## Diferenças Entre Placeholders Similares

### `{divisao3}` vs `{divisao3_valor}`

| Aspecto | `{divisao3}` | `{divisao3_valor}` |
|--------|------------|------------------|
| **O que mostra** | Rótulo/etiqueta | Valor real |
| **Origem dos dados** | localStorage['nomenclaturas'] | membro.congregacao |
| **Exemplo** | CONGREGAÇÃO | Templo Graça |
| **Muda quando** | Altera nomenclaturas | Altera dados membro |
| **Caso de uso** | Label na frente do cartão | Valor da congregação |

### `{divisao3_valor}` vs `{congregacao}`

| Aspecto | `{divisao3_valor}` | `{congregacao}` |
|--------|-----------------|-----------------|
| **Função** | Placeholder novo, mesmo resultado | Placeholder legado |
| **Compatibilidade** | Novo (v2.0) | Legado (v1.0) |
| **Recomendação** | ✅ Usar este | ⚠️ Manter compatibilidade |
| **Flexibilidade** | Melhor (segue nomenclaturas) | Menos flexível |

## Configuração em localStorage

### Estrutura Completa

```javascript
// localStorage['nomenclaturas']
{
  divisaoPrincipal: {
    opcao1: 'SUPERVISÃO',      // padrão para {divisao1}
    opcao2: 'REGIONAL'         // opção alternativa
  },
  divisaoSecundaria: {
    opcao1: 'CAMPO',           // padrão para {divisao2}
    opcao2: 'SETOR'            // opção alternativa
  },
  divisaoTerciaria: {
    opcao1: 'CONGREGAÇÃO',     // padrão para {divisao3}
    opcao2: 'TEMPLO'           // opção alternativa
  }
}

// localStorage['membros']
[
  {
    id: '1',
    nome: 'JOÃO SILVA',
    supervisao: 'PA',           // usado por {supervisao} e {divisao1} label
    campo: 'Belém',             // usado por {campo} e {divisao2} label
    congregacao: 'Templo Vida', // usado por {congregacao} e {divisao3_valor}
    ...
  }
]
```

## Casos de Uso Comuns

### Case 1: Mostrar Hierarquia Completa
```
Template:
"{divisao1}: {supervisao}
 {divisao2}: {campo}
 {divisao3}: {divisao3_valor}"

Resultado:
"SUPERVISÃO: PA
 CAMPO: Belém
 CONGREGAÇÃO: Templo Vida"
```

### Case 2: Nomenclatura Dinâmica com Valor
```
Template (com nomenclaturas definidas como TEMPLO):
"Local de Adoração:
 {divisao3}: {divisao3_valor}"

Resultado:
"Local de Adoração:
 TEMPLO: Templo Vida"
```

### Case 3: Apenas Valores (sem rótulos)
```
Template:
"Supervisão: {supervisao}
 Campo: {campo}
 Congregação: {divisao3_valor}"

Resultado (nomenclaturas não afetam):
"Supervisão: PA
 Campo: Belém
 Congregação: Templo Vida"
```

## Funções que Processam Placeholders

### Frontend: `substituirPlaceholders()` 
**Local:** `src/lib/cartoes-utils.ts` linha 35

```typescript
export function substituirPlaceholders(texto: string, membro: any): string
```

**Características:**
- ✅ Carrega nomenclaturas do localStorage
- ✅ Substitui `{divisao3}` por rótulo dinâmico
- ✅ Substitui `{divisao3_valor}` por valor do membro
- ✅ Executa no navegador do usuário
- ✅ Múltiplos casos especiais (filiação, datas, endereço)

### Backend: `POST /api/cartoes/substituir-placeholders`
**Local:** `src/app/api/cartoes/substituir-placeholders/route.ts`

```typescript
export async function POST(request: NextRequest)
```

**Características:**
- ✅ Aceita nomenclaturas via body da requisição
- ✅ Processa substituições no servidor
- ✅ Usado para batch printing
- ✅ Retorna JSON com texto substituído

## Checklist de Implementação

- [x] `{divisao3}` mapeado em PLACEHOLDERS_CONFIG
- [x] `{divisao3_valor}` adicionado a PLACEHOLDERS_CONFIG
- [x] Frontend carrega nomenclaturas do localStorage
- [x] Frontend substitui `{divisao3}` dinamicamente
- [x] Backend aceita nomenclaturas via requisição
- [x] Backend substitui `{divisao3}` dinamicamente
- [x] Nomenclaturas persistem em localStorage
- [x] Placeholders aparecem na lista de configuração
- [x] Documentação criada

## Próximas Melhorias (Roadmap)

- [ ] Validar nomenclaturas vazias
- [ ] Adicionar fallback automático
- [ ] Historiar mudanças de nomenclaturas
- [ ] Suportar `{divisao1_valor}` e `{divisao2_valor}`
- [ ] Adicionar preview em tempo real
- [ ] API GET para recuperar nomenclaturas

---

**Referência:** Para exemplos práticos, veja [GUIA_TESTES.md](GUIA_TESTES.md)
