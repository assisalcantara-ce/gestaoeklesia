# Nomenclaturas Dinâmicas - Resumo Rápido

## O que foi implementado?

Sistema completo de nomenclaturas dinâmicas onde as etiquetas de divisões organizacionais (Supervisão/Regional, Campo/Setor, Igreja/Congregação) são configuráveis e refletem automaticamente nos cartões de membros.

## Como usar?

### 1. Configurar as Nomenclaturas
```
Configurações → Nomenclaturas
Clique no ícone de editar
Altere os rótulos conforme desejado:
  • Divisão 1: Supervisão / Regional
  • Divisão 2: Campo / Setor  
  • Divisão 3: Igreja / Congregação
Clique "✓ Salvar Nomenclaturas"
```

### 2. Usar nos Cartões
```
Configurações → Cartões
Edite um template
Adicione placeholders:
  • {divisao1} → mostra rótulo da Divisão 1
  • {divisao2} → mostra rótulo da Divisão 2
  • {divisao3} → mostra rótulo da Divisão 3 ⭐ NOVO
  • {divisao3_valor} → mostra nome real da congregação ⭐ NOVO
Exemplo:
  "Local: {divisao3}"
  "Nome: {divisao3_valor}"
Salve o template
```

### 3. Exemplo de Resultado
Se configurar:
- Nomenclatura: divisão 3 = "CONGREGAÇÃO"
- Membro: congregacao = "Templo Vida"

O cartão exibirá:
```
Local: CONGREGAÇÃO
Nome: Templo Vida
```

## Arquivos Modificados

| Arquivo | Modificação |
|---------|-------------|
| `src/app/configuracoes/nomenclaturas/page.tsx` | Adicionado localStorage para persistência |
| `src/app/configuracoes/cartoes/page.tsx` | Adicionado `{divisao3_valor}` ao PLACEHOLDERS_DISPONIVEIS |
| `src/lib/cartoes-utils.ts` | Adicionado `{divisao3_valor}` e lógica de substituição dinâmica |
| `src/app/api/cartoes/substituir-placeholders/route.ts` | Atualizado para suportar `{divisao3_valor}` |

## Testes Essenciais

✅ **Salvar nomenclatura** → Recarregar página → Verificar se persiste  
✅ **Adicionar `{divisao3}` a template** → Salvar → Visualizar em cartão  
✅ **Adicionar `{divisao3_valor}` a template** → Salvar → Verificar nome real aparece  
✅ **Alterar nomenclatura** → Cartão muda automaticamente  
✅ **Imprimir cartões em lote** → Todos mostram placeholders corretos  

## Troubleshooting

| Problema | Solução |
|----------|---------|
| Nomenclaturas não salvam | Verificar se localStorage está habilitado |
| `{divisao3}` aparece literal | Verificar se está em PLACEHOLDERS_CONFIG |
| Placeholders não substituem | Recarregar página e tentar novamente |
| Batch printing mostra `{divisao3}` | Passar nomenclaturas na requisição API |

## Estrutura de Dados

**localStorage['nomenclaturas']:**
```javascript
{
  divisaoPrincipal: { opcao1: 'SUPERVISÃO', opcao2: 'REGIONAL' },
  divisaoSecundaria: { opcao1: 'CAMPO', opcao2: 'SETOR' },
  divisaoTerciaria: { opcao1: 'IGREJA', opcao2: 'CONGREGAÇÃO' }
}
```

**Membro no localStorage:**
```javascript
{
  id: '1',
  nome: 'JOÃO SILVA',
  supervisao: 'PA',
  campo: 'Belém',
  congregacao: 'Templo Graça',  // ← usado por {divisao3_valor}
  ...
}
```

## Documentação Completa

- 📖 [IMPLEMENTACAO_COMPLETA.md](IMPLEMENTACAO_COMPLETA.md) - Detalhes técnicos
- 🧪 [GUIA_TESTES.md](GUIA_TESTES.md) - Testes passo a passo

---

**Status:** ✅ PRONTO PARA USAR

**Última atualização:** [DATA]  
**Versão:** 1.0
