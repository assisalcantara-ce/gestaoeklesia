# Sistema de Placeholders para Cartões

## Visão Geral

O sistema de placeholders permite vincular dados da tabela de membros aos textos dos cartões. Você pode usar códigos de referência que serão automaticamente substituídos pelos valores reais do membro quando o cartão for impresso.

## Placeholders Disponíveis

| Placeholder | Campo | Descrição |
|---|---|---|
| `{nome}` | nome | Nome completo do membro |
| `{matricula}` | matricula | Número de matrícula |
| `{cpf}` | cpf | Número do CPF |
| `{cargo}` | cargo | Cargo/Função do membro |
| `{supervisao}` | supervisao | Supervisão atribuída |
| `{campo}` | campo | Campo/Distrito |
| `{dataNascimento}` | dataNascimento | Data de nascimento |
| `{email}` | email | Endereço de email |
| `{celular}` | celular | Número do celular |
| `{whatsapp}` | whatsapp | Número do WhatsApp |
| `{endereco}` | endereco | Endereço completo (Rua, número, bairro, cidade) |
| `{uniqueId}` | uniqueId | ID único do membro (para QR Code) |

## Como Usar

### 1. Na Configuração do Cartão

1. Acesse **Configurações → Cartões**
2. Crie ou edite um template
3. Adicione um elemento do tipo **Texto**
4. Na área de propriedades, digite o conteúdo usando placeholders

### 2. Exemplos de Uso

**Exemplo 1 - Cartão simples:**
```
{nome}
Matrícula: {matricula}
```

**Exemplo 2 - Cartão completo:**
```
{nome}
Matrícula: {matricula}
CPF: {cpf}
Cargo: {cargo}
```

**Exemplo 3 - Cartão com endereço:**
```
{nome}
{endereco}
Tel: {celular} | WhatsApp: {whatsapp}
```

### 3. No Editor de Template

Você verá:
- Os placeholders que você digitou
- Uma lista interativa de todos os placeholders disponíveis
- Cada placeholder pode ser clicado para adicionar automaticamente ao texto

### 4. Preview no Canvas

O canvas mostra um preview dos placeholders em formato `[Descrição]`, exemplo:
```
[Nome]
Matrícula: [Matrícula]
```

## Uso na API

### Endpoint: POST `/api/cartoes/substituir-placeholders`

**Request:**
```json
{
  "texto": "Nome: {nome}\nMatrícula: {matricula}",
  "membro": {
    "nome": "João da Silva",
    "matricula": "2024001",
    "cpf": "123.456.789-00",
    ...
  }
}
```

**Response:**
```json
{
  "sucesso": true,
  "textoOriginal": "Nome: {nome}\nMatrícula: {matricula}",
  "textoSubstituido": "Nome: João da Silva\nMatrícula: 2024001",
  "membro": { ... }
}
```

## Integração na Geração de PDF

Para gerar o PDF com os dados do membro, o sistema automaticamente:
1. Recupera o template do cartão
2. Obtém os dados do membro selecionado
3. Substitui todos os placeholders pelos valores reais
4. Renderiza o cartão no PDF

Exemplo de fluxo:
```typescript
// 1. Obter dados do membro
const membro = membros.find(m => m.id === membroId);

// 2. Para cada elemento de texto no template
const elementosComPlaceholders = template.elementos
  .filter(e => e.tipo === 'texto' && e.texto?.includes('{'));

// 3. Substituir placeholders
elementosComPlaceholders.forEach(elemento => {
  elemento.textoFinal = substituirPlaceholders(elemento.texto, membro);
});

// 4. Gerar PDF com textos finais
gerarPDF(template, elementosComPlaceholders);
```

## Notas Importantes

- Os placeholders são **case-sensitive** (diferenciam maiúsculas de minúsculas)
- Se um campo não existir ou estiver vazio no membro, o placeholder será substituído por uma string vazia
- Para endereço completo, o sistema monta automaticamente: `logradouro + número + bairro + cidade`
- Você pode misturar placeholders com texto fixo no mesmo elemento

## Arquivo de Utilidades

A função `substituirPlaceholders()` está disponível em:
- **Backend:** `/src/app/api/cartoes/substituir-placeholders/route.ts`
- **Frontend:** `/src/lib/cartoes-utils.ts` (funções `substituirPlaceholders` e `obterPreviewTexto`)
