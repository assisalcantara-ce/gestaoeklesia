# Documentação de Layouts de Formulários e Tabelas
## Sistema GestãoEklesia - Paleta Dark Blue

---

## 📋 Índice
1. [Layout do Formulário Padrão](#layout-do-formulário-padrão)
2. [Layout das Tabelas de Listagem](#layout-das-tabelas-de-listagem)
3. [Padrões de Design](#padrões-de-design)
4. [Componentes Reutilizáveis](#componentes-reutilizáveis)

---

## Layout do Formulário Padrão

### 📍 Localização Padrão
- **URL**: `/admin/[modulo]/novo` ou `/configuracoes/[secao]`
- **Layout Container**: `<Sidebar />` + conteúdo flexível
- **Estrutura**: Sidebar + Conteúdo Principal

### 🎨 Estrutura Geral

#### Cabeçalho
- **Ícone**: Emoji opcional
- **Título**: Título da página (ex: "Novo Usuário", "Editar Configurações")
- **Classes Tailwind**: `text-3xl md:text-4xl font-bold text-[#123b63]`

#### Abas de Navegação (se aplicável)
- **Padrão de Tab Ativa**: 
  - Cor do texto: `text-[#123b63]`
  - Border inferior: `border-b-3 border-[#123b63]`
  - Peso da fonte: `font-semibold`
- **Padrão de Tab Inativa**:
  - Cor do texto: `text-gray-600`
  - Hover: `hover:text-[#123b63]`
  - Transição: `transition`

#### Divisor das Abas
- Borda inferior: `border-b border-gray-300`
- Espaçamento entre abas: `gap-2`
- Padding das abas: `px-6 py-3`

---

### 📦 Seções do Formulário

#### **Padrão: Seção com Título**

**Container**:
- Background: `bg-white`
- Sombra: `shadow-md`
- Padding: `p-4 md:p-6`
- Border radius: `rounded-lg`

**Título da Seção**:
- Font size: `text-lg`
- Font weight: `font-bold`
- Cor: `text-[#123b63]`
- Margin bottom: `mb-4`

**Campos**:

Exemplo de grid com 2 colunas:
```
grid-cols-1 md:grid-cols-2 gap-4
```

Exemplo de grid com 3 colunas:
```
grid-cols-1 md:grid-cols-3 gap-4
```

Exemplo de grid com 4 colunas:
```
grid-cols-1 md:grid-cols-4 gap-4
```

**Estilo dos Inputs**:
- Padding: `px-3 py-2`
- Font size: `text-sm`
- Border: `border border-[#4A6FA5]`
- Border radius: `rounded-lg`
- Background: `bg-blue-50`
- Focus: `focus:outline-none focus:border-[#0284c7]`

**Estilo dos Labels**:
- Font size: `text-xs`
- Font weight: `font-medium`
- Cor: `text-[#123b63]`
- Margin bottom: `mb-1 block`

---

### 🔘 Botões do Formulário

**Container de Botões**:
- Flex layout: `flex gap-3 justify-end`
- Margin top: `mt-6`

**Botão: Cancelar**
- Cor do texto: `text-gray-700`
- Cor de fundo: `bg-gray-200`
- Hover: `hover:bg-gray-300`
- Padding: `px-6 py-2`
- Border radius: `rounded-lg`
- Font weight: `font-semibold`
- Transição: `transition`

**Botão: Salvar**
- Cor de fundo: `bg-[#123b63]`
- Hover: `hover:bg-[#0d2a47]`
- Cor do texto: `text-white`
- Padding: `px-6 py-2`
- Border radius: `rounded-lg`
- Font weight: `font-semibold`
- Transição: `transition`

---

### 💬 Feedback do Usuário

**Mensagem de Sucesso/Erro**:
- Margin bottom: `mb-4`
- Padding: `px-4 py-3`
- Border radius: `rounded-lg`
- Font size: `text-sm`
- Border: `border-l-4`

**Sucesso**:
- Background: `bg-green-50`
- Border color: `border-l-green-400`
- Texto: `text-green-700`

**Erro**:
- Background: `bg-red-50`
- Border color: `border-l-red-400`
- Texto: `text-red-700`

---

## Layout das Tabelas de Listagem

### 📍 Localização Padrão
- **URL**: `/admin/[modulo]` ou `/[secao]`
- **Layout Container**: `<Sidebar />` + conteúdo
- **Padrão**: Header com title + Abas + Filtro + Tabela

### 🎨 Estrutura Geral

#### Cabeçalho
- **Ícone**: Emoji (📋, 👥, 📚, etc)
- **Título**: Titulo da listagem (ex: "Gerenciar Usuários", "Listar Tickets")
- **Classes Tailwind**: `text-3xl md:text-4xl font-bold text-[#123b63]`
- **Container**: `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6`

---

### 📌 Seção de Abas

**Estrutura**:
- Flex layout: `flex gap-2 border-b border-gray-300`
- Margin bottom: `mb-6`

**Tab Ativa**:
- Ícone + Texto: `📋 Listar`
- Cor do texto: `text-[#123b63]`
- Border bottom: `border-b-2 border-[#123b63]`
- Padding: `px-6 py-3`
- Font weight: `font-semibold`

**Tab Inativa**:
- Ícone + Texto: `➕ Inserir` ou outro
- Cor do texto: `text-gray-500`
- Hover: `hover:text-[#123b63]`
- Transição: `transition`
- Padding: `px-6 py-3`
- Font weight: `font-semibold`

---

### 🔍 Seção: Filtro de Busca

**Container**:
- Background: `bg-blue-50`
- Border: `border border-[#4A6FA5]`
- Border radius: `rounded-lg`
- Padding: `p-4 md:p-6`
- Margin bottom: `mb-6`

**Título do Filtro**:
- Ícone: 🔍
- Font size: `text-lg`
- Font weight: `font-semibold`
- Cor: `text-gray-700`
- Display: `flex items-center gap-2 mb-4`

**Estrutura do Filtro**:
- Múltiplas linhas de filtros (conforme necessário)
- Cada linha com 3 colunas: `grid grid-cols-1 md:grid-cols-3 gap-4`
- Space between linhas: `space-y-4`

**Select/Input Styles**:
- Width: `w-full`
- Padding: `px-3 py-2`
- Font size: `text-sm`
- Border: `border border-[#4A6FA5]`
- Border radius: `rounded-lg`
- Focus: `focus:outline-none focus:border-[#0284c7]`
- Background: `bg-white`

**Botão LIMPAR/BUSCAR**:
- Width: `w-full`
- Padding: `px-4 py-2`
- Background: `bg-[#123b63]`
- Hover: `hover:bg-[#0d2a47]`
- Cor do texto: `text-white`
- Border radius: `rounded-lg`
- Font weight: `font-semibold`
- Font size: `text-sm`
- Transição: `transition`

---

### 📊 Seção: Listagem de Dados

**Container da Tabela**:
- Background: `bg-white`
- Border radius: `rounded-lg`
- Sombra: `shadow-md`
- Overflow: `overflow-hidden`

**Cabeçalho da Tabela**:
- Flex layout: `flex items-center justify-between`
- Padding: `p-4 md:p-6`
- Border bottom: `border-b border-gray-200`

**Título**: `text-lg font-semibold text-gray-700`

---

#### **Tabela HTML**

**Table Header (thead)**:
- Background: `bg-blue-100`
- Border bottom: `border-b border-[#4A6FA5]`
- Texto: `text-xs font-semibold text-[#123b63]`
- Border right: `border-r border-[#4A6FA5]` (em cada th)
- Padding: `px-4 py-3`

**Table Body (tbody)**:

**Row Styles**:
- Border bottom: `border-b border-gray-200`
- Hover: `hover:bg-blue-50 transition`

**Cell Styles**:
- Padding: `px-4 py-3`
- Font size: `text-sm`
- Cor: `text-gray-700`
- Border right: `border-r border-gray-200`

---

#### **Coluna: Ações**

**Layout**:
- Flex: `flex items-center justify-center gap-2`
- Padding: `px-4 py-3 text-center`

**Botões de Ação** (ícones padrão):

| Ícone | Ação | Título | Cor |
|-------|------|--------|-----|
| 📝 | Imprimir | "Imprimir" | `text-orange-600` |
| 🔗 | Link/Visualizar | "Link" | `text-blue-600` |
| ⚙️ | Configurar | "Configurar" | `text-gray-600` |
| ☁️ | Cloud/Upload | "Cloud" | `text-purple-600` |
| ✏️ | Editar | "Editar" | `text-[#0284c7]` |
| ❌ | Deletar | "Deletar" | `text-red-600` |

**Button Styles**:
- Padding: `p-2`
- Hover: `hover:text-{color}-800 transition`
- Cursor: `cursor-pointer`
- Font size: `text-lg`

---

### 📝 Estados Vazios

**Quando não há dados**:
- Padding: `p-6`
- Text align: `text-center`
- Cor: `text-gray-500`
- Mensagem: "Nenhum registro encontrado"

**Quando está carregando**:
- Padding: `p-6`
- Text align: `text-center`
- Cor: `text-gray-500`
- Mensagem: "Carregando..."

---

## Padrões de Design

### 🎨 Paleta de Cores - GestãoEklesia

| Cor | Uso | Hex | Tailwind |
|-----|-----|-----|----------|
| Dark Blue | Primária (Headers, Botões) | `#123b63` | `[#123b63]` |
| Medium Blue | Borders, Backgrounds secundários | `#4A6FA5` | `[#4A6FA5]` |
| Light Blue | Destaque, Hover, Focus | `#0284c7` | `[#0284c7]` |
| Blue Light | Background inputs | `rgb(219, 234, 254)` | `blue-50` |
| Cinza | Textos neutros | `#374151` | `gray-700` |
| Verde | Sucesso | `#16a34a` | `green-600` |
| Vermelho | Erro/Deletar | `#dc2626` | `red-600` |
| Amarelo | Avisos | `#eab308` | `yellow-500` |
| Laranja | Ações alternativas | `#ea580c` | `orange-600` |

### 📐 Espaçamento Padrão

| Elemento | Padding/Margin | Tailwind |
|----------|----------------|----------|
| Container principal | 4-6 lateral | `p-4 md:p-6` |
| Seção/Card | 4-6 | `p-4 md:p-6` |
| Grid gap | 4 (normal), 2 (compacto) | `gap-4`, `gap-2` |
| Margin bottom (títulos) | 4 | `mb-4` |
| Margin bottom (seções) | 6 | `mb-6` |

### 📏 Tipografia

| Elemento | Tamanho | Peso | Tailwind |
|----------|---------|------|----------|
| Título principal | 32-48px | 700 | `text-3xl md:text-4xl font-bold` |
| Título seção | 18px | 700 | `text-lg font-bold` |
| Label | 12px | 500 | `text-xs font-medium` |
| Input/Select | 14px | 400 | `text-sm` |
| Tabela header | 12px | 600 | `text-xs font-semibold` |
| Tabela body | 14px | 400 | `text-sm` |

### 🔄 Responsive Design

- **Mobile**: 1 coluna, padding `p-4`
- **Tablet/Desktop**: Múltiplas colunas, padding `p-6`
- **Breakpoint**: `md:` (768px)

Exemplo:
```tailwind
grid-cols-1 md:grid-cols-3  /* 1 coluna em mobile, 3 em desktop */
p-4 md:p-6                   /* Padding 4 em mobile, 6 em desktop */
text-3xl md:text-4xl         /* Tamanho menor em mobile, maior em desktop */
```

---

## Componentes Reutilizáveis

### Input Padrão
```jsx
<div>
  <label className="text-xs font-medium text-[#123b63] mb-1 block">
    LABEL
  </label>
  <input
    type="text"
    placeholder="Placeholder"
    className="w-full px-3 py-2 text-sm border border-[#4A6FA5] rounded-lg focus:outline-none focus:border-[#0284c7] bg-blue-50"
  />
</div>
```

### Select Padrão
```jsx
<div>
  <label className="text-xs font-medium text-[#123b63] mb-1 block">
    LABEL
  </label>
  <select className="w-full px-3 py-2 text-sm border border-[#4A6FA5] rounded-lg focus:outline-none focus:border-[#0284c7] bg-white">
    <option>Opção 1</option>
  </select>
</div>
```

### Checkbox Padrão
```jsx
<div className="flex items-center gap-3">
  <input
    type="checkbox"
    id="campo"
    className="w-5 h-5 text-[#123b63] rounded cursor-pointer"
  />
  <label htmlFor="campo" className="text-xs font-medium text-[#123b63]">
    Label do Checkbox
  </label>
</div>
```

### Botão Primário
```jsx
<button className="px-6 py-2 bg-[#123b63] hover:bg-[#0d2a47] text-white rounded-lg font-semibold transition">
  Ação
</button>
```

### Seção de Card
```jsx
<div className="bg-white rounded-lg shadow-md p-4 md:p-6">
  <h2 className="text-lg font-bold text-[#123b63] mb-4">Título</h2>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {/* Conteúdo */}
  </div>
</div>
```

---

**Paleta de Cores - Guia Rápido**:
- ✅ Substitua `teal-` por `[#123b63]` para cor primária
- ✅ Substitua `teal-` borders por `[#4A6FA5]` para cor média
- ✅ Substitua `teal-` focus/hover por `[#0284c7]` para cor clara

Última atualização: 14 de janeiro de 2026
Versão: 1.0 - GestãoEklesia
