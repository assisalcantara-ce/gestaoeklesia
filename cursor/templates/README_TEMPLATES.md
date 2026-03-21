# 📋 Guia de Templates de Cartão

## 📁 Estrutura de Templates

Esta pasta contém exemplos e templates para criar cartões personalizados no sistema.

### Arquivos Disponíveis

#### `TEMPLATE_FUNCIONARIO_EXEMPLO.json`
Template exemplo para cartão de funcionário em orientação **portrait** (210mm × 297mm em pé).

**Características:**
- Orientação: Portrait (vertical)
- Tipologia: funcionario
- Elementos: 10 campos organizados verticalmente
- Inclui: Nome, Cargo, Matrícula, CPF, QR Code

---

## 🛠️ Como Usar

### 1. Personalizar um Template

1. Copie o arquivo `TEMPLATE_FUNCIONARIO_EXEMPLO.json`
2. Abra em um editor de texto (VS Code, Notepad++, etc)
3. Modifique os elementos conforme desejado
4. Salve com um nome significativo

### 2. Importar no Sistema

1. Acesse `/configuracoes/cartoes`
2. Selecione o tipo de cartão (Funcionário)
3. Cole o conteúdo JSON no editor
4. Clique em "💾 Salvar Template"

### 3. Estrutura de um Elemento

Cada elemento tem a seguinte estrutura:

```json
{
  "id": "func-nome-unico",              // ID único do elemento
  "tipo": "texto",                      // Tipo: texto, qrcode, logo, foto-membro
  "x": 10,                              // Posição X em mm
  "y": 145,                             // Posição Y em mm
  "largura": 190,                       // Largura em mm
  "altura": 15,                         // Altura em mm
  "fontSize": 12,                       // Tamanho da fonte (pontos)
  "cor": "#1e40af",                    // Cor em hexadecimal
  "fonte": "Arial",                     // Nome da fonte
  "texto": "{nome}",                    // Texto ou placeholder
  "alinhamento": "center",              // left, center, right
  "negrito": true,                      // true ou false
  "italico": false,                     // true ou false
  "sublinhado": false,                  // true ou false
  "visivel": true                       // true ou false
}
```

### 4. Placeholders Disponíveis

Use chaves `{placeholder}` para substituir valores dinamicamente:

- `{nome}` - Nome completo do membro
- `{matricula}` - Número de matrícula
- `{cpf}` - CPF (formatado ou não)
- `{rg}` - RG
- `{email}` - Email
- `{celular}` - Telefone celular
- `{whatsapp}` - WhatsApp
- `{dataNascimento}` - Data de nascimento
- `{dataBatismo}` - Data de batismo
- `{filiacao}` - Filiação
- `{naturalidade}` - Naturalidade
- `{nacionalidade}` - Nacionalidade
- `{estadoCivil}` - Estado civil
- `{tipoSanguineo}` - Tipo sanguíneo
- `{qualFuncao}` - Função/Cargo
- `{cargo}` - Cargo (alias)
- `{tipoCadastro}` - Tipo (membro, congregado, ministro, funcionario)
- `{validade}` - Data de validade
- `{supervisao}` - Supervisão
- `{campo}` - Campo
- `{logradouro}` - Rua/Logradouro
- `{numero}` - Número
- `{bairro}` - Bairro
- `{cidade}` - Cidade
- `{status}` - Status (ativo/inativo)

### 5. Tipos de Elementos

| Tipo | Descrição | Exemplo |
|------|-----------|---------|
| `texto` | Texto fixo ou com placeholder | Nome, Matrícula |
| `qrcode` | Código QR com ID único | Código de rastreamento |
| `logo` | Logo ou imagem fixa | Logo da igreja |
| `foto-membro` | Foto do membro | Fotografia |
| `chapa` | Número de chapa | Numeração especial |

### 6. Orientações Suportadas

```json
{
  "orientacao": "landscape"  // 297mm × 210mm (padrão, deitado)
}

{
  "orientacao": "portrait"   // 210mm × 297mm (novo, em pé)
}
```

---

## 📐 Coordenadas e Dimensões

### Sistema de Referência

As coordenadas usam o **canto superior esquerdo** como origem (0, 0).

```
(0,0) ──────────────────── (210,0)
│                              │
│   PORTRAIT                    │
│   210mm × 297mm              │
│                              │
└────────────────────────── (210,297)
```

### Conversão de Unidades

- **Input:** Milímetros (mm) na interface
- **Render:** Pixels (px) = mm × escala
- **Escala padrão:** 1mm ≈ 3.78px

Exemplo:
```
X = 10mm → 37.8px
Y = 145mm → 548.1px
```

---

## 🎨 Guia de Cores

Use cores em formato hexadecimal (#RRGGBB):

| Cor | Código | Uso |
|-----|--------|-----|
| Azul (Padrão) | #1e40af | Títulos, labels |
| Cinza Escuro | #374151 | Texto normal |
| Cinza Médio | #666666 | Rótulos pequenos |
| Cinza Claro | #d1d5db | Elementos secundários |
| Vermelho | #ef4444 | Dados importantes |
| Verde | #16a34a | Sucesso/Aprovado |
| Âmbar | #d97706 | Aviso/Atenção |

---

## ✅ Template Validação

Antes de enviar um template, verifique:

- [ ] Todos os elementos têm `id` único
- [ ] Coordenadas (x, y) estão dentro dos limites
  - **Portrait:** 0-210 para X, 0-297 para Y
  - **Landscape:** 0-297 para X, 0-210 para Y
- [ ] Fontes usadas existem ou são genéricas (Arial, Helvetica, Times)
- [ ] Placeholders são válidos (existem nos dados)
- [ ] Cores são válidas (formato #RRGGBB)
- [ ] `tipoCadastro` corresponde ao tipo certo (membro, congregado, ministro, funcionario)

---

## 🔄 Exemplos Prontos

### Cartão Simples

```json
{
  "id": "simples-1",
  "elementos": [
    {
      "id": "titulo",
      "tipo": "texto",
      "x": 10,
      "y": 10,
      "largura": 190,
      "altura": 20,
      "fontSize": 16,
      "cor": "#1e40af",
      "texto": "MEU CARTÃO",
      "alinhamento": "center",
      "negrito": true,
      "visivel": true
    }
  ]
}
```

### Cartão Completo (com foto e QR)

```json
{
  "elementos": [
    {
      "id": "foto",
      "tipo": "foto-membro",
      "x": 55,
      "y": 40,
      "largura": 100,
      "altura": 100
    },
    {
      "id": "qrcode",
      "tipo": "qrcode",
      "x": 55,
      "y": 220,
      "largura": 100,
      "altura": 100
    }
  ]
}
```

---

## 📞 Suporte

Para adicionar um novo template:
1. Crie um arquivo `.json` nesta pasta
2. Siga a estrutura fornecida
3. Teste no módulo de configuração
4. Documente as mudanças

---

**Versão:** 1.0  
**Data:** 12 de dezembro de 2025  
**Status:** ✅ Funcional
