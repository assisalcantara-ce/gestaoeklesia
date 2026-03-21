# 📊 Análise Detalhada: Módulo Configurações/Cartões

**Data:** 14 de janeiro de 2026  
**Status:** Exploração e Documentação  
**Objetivo:** Entender funcionamento atual antes de sugerir mudanças

---

## 🎯 Visão Geral

O módulo `Configurações/Cartões` (`/configuracoes/cartoes`) permite que o usuário:
1. **Selecionar** modelos de cartão predefinidos
2. **Personalizar** cartões com editor visual (canvas + sidebar)
3. **Ativar** um cartão de cada tipo
4. **Usar** os cartões ativados no módulo "Secretaria/Membros" para impressão

---

## 🏗️ Arquitetura: 4 Tipos de Cartão

### 1️⃣ **MEMBRO** (Tipo: `membro`)

| Modelo | ID | Variação | Descrição | Elementos |
|--------|----|---------|-----------| |----------|
| **Modelo 01** | `membro-classico` | classico | Design clássico com frente e verso | Complexos (customizados) |
| **Modelo 02** | `membro-02` | classico | Layout personalizado frente/verso | Complexos (customizados) |
| **Modelo Branco** | `membro-branco` | branco | Layout 100% personalizável | Vazio (Criar do zero) |

**Cores:**
- Cor Principal: #6b7280 (Cinza)
- Cor Secundária: #e5e7eb (Cinza claro)
- Cor Texto: #000000 (Preto)

---

### 2️⃣ **CONGREGADO** (Tipo: `congregado`)

| Modelo | ID | Variação | Descrição | Elementos |
|--------|----|---------|-----------| |----------|
| **Modelo 01** | `congregado-01` | classico | Layout horizontal com logo/foto | Padrão |
| **Modelo 02** | `congregado-02` | classico | Design premium frente/verso | Padrão |
| **Modelo Branco** | `congregado-branco` | branco | Layout 100% personalizável | Vazio |

**Cores:**
- Cor Principal: #1e40af (Azul escuro)
- Cor Secundária: #3b82f6 (Azul)
- Cor Texto: #000000 (Preto)

---

### 3️⃣ **MINISTRO** (Tipo: `ministro`)

| Modelo | ID | Variação | Descrição | Elementos |
|--------|----|---------|-----------| |----------|
| **Modelo 01** | `ministro-classico` | branco | Layout 100% personalizável | Complexos (customizados) |
| **Modelo 02** | `ministro-02` | branco | Layout 100% personalizável | Complexos (customizados) |
| **Modelo 03** | `ministro-branco` | branco | Layout 100% personalizável | Vazio |

**Cores:**
- Cor Principal: #d97706 (Laranja)
- Cor Secundária: #9ca3af (Cinza)
- Cor Texto: #ffffff (Branco)

---

### 4️⃣ **FUNCIONÁRIO** (Tipo: `funcionario`)

| Modelo | ID | Variação | Descrição | Elementos |
|--------|----|---------|-----------| |----------|
| **Modelo 01** | `funcionario-customizado` | classico | Layout personalizado portrait | Padrão |
| **Modelo Branco** | `funcionario-branco` | branco | Layout 100% personalizável | Vazio |

**Cores:**
- Cor Principal: #7c3aed (Roxo)
- Cor Secundária: #a78bfa (Roxo claro)
- Cor Texto: #ffffff (Branco)

---

## 🔄 Fluxo de Funcionamento

### **1. Carregamento Inicial**

```javascript
// Ao entrar em /configuracoes/cartoes:

1. ✅ Busca templates do localStorage (chave: 'cartoes_templates_v2')
2. ✅ Carrega templates nativos dos 4 tipos (membro, congregado, ministro, funcionario)
3. ✅ Mescla templates salvos com os templates nativos
4. ✅ Valida integridade (verifica se templates estão corrompidos)
5. ✅ Define templates em UI (TemplatesSidebar)
6. ✅ Seleciona tipo inicial: 'membro'
7. ✅ Carrega template ativo do tipo 'membro' no editor canvas
```

### **2. Estrutura de Armazenamento**

```javascript
// localStorage: 'cartoes_templates_v2'
{
  // Exemplo de template salvo
  {
    id: 'membro-classico',
    nome: 'Membro Modelo 01',
    tipoCadastro: 'membro',
    ativo: true,                    // ← CHAVE: Marca qual é o ativo
    backgroundUrl: '/img/...',
    elementos: [...],              // Array de elementos do canvas
    elementosVerso: [...],          // Array de elementos do verso
    backgroundUrlVerso: '/img/...',
    corTitulo: '#6b7280',
    temVerso: true,
    criadoEm: '2025-12-25...',
    atualizadoEm: '2026-01-14...',
    variacao: 'classico',
    foiEditado: false,             // true se usuário editou
    criado_pelo_usuario: false     // true se foi criado do zero
  }
}
```

### **3. Seleção/Ativação de Template**

```javascript
// Quando usuário clica "Usar este Modelo":

ativarTemplate(templateId) {
  // 1. Encontra o template na lista (ou busca nos nativos se não estiver salvo)
  // 2. Desativa todos os outros templates do MESMO TIPO
  // 3. Ativa apenas este template (set ativo = true)
  // 4. Salva no localStorage
  // 5. Carrega no editor canvas (setTemplateEmEdicao)
  
  // IMPORTANTE: Pode haver até 4 templates ativos SIMULTANEAMENTE
  // (um de cada tipo)
}
```

### **4. Fluxo Visual na UI**

```
┌─────────────────────────────────────────────────────────┐
│         SIDEBAR ESQUERDA (TemplatesSidebar)             │
├─────────────────────────────────────────────────────────┤
│ Botões de Tipo:                                         │
│  [Cartão de Membro]  ← Selecionado                     │
│  [Cartão de Congregado]                                 │
│  [Credencial de Ministro]                               │
│  [Cartão de Funcionário]                                │
├─────────────────────────────────────────────────────────┤
│ Modelos Disponíveis (para tipo selecionado):           │
│                                                         │
│  ┌─────────────────────────────────┐                   │
│  │ [Preview do Modelo 01]          │                   │
│  │ Nome: Membro Modelo 01          │                   │
│  │ ID: membro-cl... | 45 elementos │                   │
│  │                                 │                   │
│  │ [✓ Ativo (Clique para Editar)] │ ← MEMBRO-CLASSICO│
│  └─────────────────────────────────┘                   │
│                                                         │
│  ┌─────────────────────────────────┐                   │
│  │ [Preview do Modelo 02]          │                   │
│  │ Nome: Membro Modelo 02          │                   │
│  │ ID: membro-02 | 32 elementos    │                   │
│  │                                 │                   │
│  │ [Usar este Modelo]              │                   │
│  └─────────────────────────────────┘                   │
│                                                         │
│  ┌─────────────────────────────────┐                   │
│  │ [Preview Branco]                │                   │
│  │ Nome: Modelo em Branco          │                   │
│  │ ID: membro-br... | 0 elementos  │                   │
│  │                                 │                   │
│  │ [✨ Criar Novo]                 │                   │
│  └─────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────┘
        ↓ Usuário clica em um
┌─────────────────────────────────────────────────────────┐
│         ÁREA DE EDIÇÃO (Canvas Principal)              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │                                                 │  │
│  │    VISUALIZAÇÃO DO CARTÃO (Frente)              │  │
│  │    Com elementos editáveis                      │  │
│  │                                                 │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
│  [Verso] [+ Adicionar Elemento] [Salvar] [Descartar]   │
└─────────────────────────────────────────────────────────┘
```

---

## 🎨 Elementos do Cartão

Cada modelo pode conter estes tipos de elementos:

```javascript
interface ElementoCartao {
  id: string;
  tipo: 'texto' | 'qrcode' | 'logo' | 'foto-membro' | 'chapa' | 'imagem';
  x: number;           // Posição X
  y: number;           // Posição Y
  largura: number;     // Largura
  altura: number;      // Altura
  fontSize?: number;   // Tamanho fonte (texto)
  cor?: string;        // Cor
  backgroundColor?: string;
  fonte?: string;      // Fonte (Arial, Georgia, etc)
  transparencia?: number;
  borderRadius?: number;
  texto?: string;      // Conteúdo (se tipo = 'texto')
  alinhamento?: 'left' | 'center' | 'right';
  negrito?: boolean;
  italico?: boolean;
  sublinhado?: boolean;
  sombreado?: boolean;
  visivel: boolean;    // Mostrar/ocultar elemento
}
```

---

## 💾 Sistema de Armazenamento

### **Dois Níveis de Dados:**

#### **Nível 1: Templates Nativos (Código)**
```typescript
// src/lib/card-templates.ts
// Defines: TEMPLATE_MEMBRO_CLASSICO, TEMPLATE_MEMBRO_BRANCO, etc
// Status: Imutáveis, vêm do servidor

// src/lib/custom-card-templates.ts
// Customized versions com frente/verso detalhados
```

#### **Nível 2: Templates Salvos (localStorage)**
```javascript
// localStorage key: 'cartoes_templates_v2'
// Status: Mutável, criado pelo usuário + modificações
// Contém: estado completo de cada cartão com elementos, cores, etc
```

---

## 🔑 Conceitos Importantes

### **Propriedade: `ativo`**
- **Significado:** Marca qual template está ATIVADO para este tipo
- **Valor:** `true` ou `false`
- **Limite:** Apenas 1 template por tipo pode ser `ativo = true`
- **Resultado:** Template ativo fica disponível em "Secretaria/Membros" para impressão

### **Propriedade: `variacao`**
- **Significado:** Classifica o tipo de layout
- **Valores:**
  - `'classico'` = Modelo pronto com design
  - `'branco'` = Layout vazio para personalizar
  - `'moderno'` = Outro estilo (não muito usado)

### **Propriedade: `foiEditado`**
- **Significado:** Marca se usuário SALVOU edições no editor
- **Valor:** `true` ou `false`
- **Uso:** Determina se elementos devem ser preservados ou resetados

### **Propriedade: `temVerso`**
- **Significado:** Se o cartão tem frente E verso
- **Valor:** `true` ou `false`
- **Uso:** Alguns modelos têm design de frente + verso (2 lados)

---

## 🖼️ Preview e Background Images

Cada modelo tem:

```javascript
{
  previewImage: '/img/card1m.jpg',        // Imagem de preview na sidebar
  backgroundUrl: '/img/card_membro1f.png', // Background da FRENTE
  backgroundUrlVerso: '/img/card_membro1c.png' // Background do VERSO (se temVerso=true)
}
```

---

## 📂 Arquivos Relacionados

```
src/
├── app/
│   └── configuracoes/
│       └── cartoes/
│           ├── page.tsx                  ← Página principal (1958 linhas)
│           └── page_backup.tsx          ← Backup antigo
│
├── components/
│   ├── TemplatesSidebar.tsx            ← UI sidebar com lista de modelos
│   ├── InteractiveCanvas.tsx           ← Canvas principal de edição
│   ├── CartãoMembro.tsx                ← Componente para imprimir
│   └── RichTextEditor.tsx              ← Editor de texto
│
└── lib/
    ├── card-templates.ts                ← Templates nativos definidos
    ├── custom-card-templates.ts        ← Versões customizadas
    ├── cartoes-utils.ts                ← Utilitários (salvar, carregar, etc)
    └── cartoes-import-export.ts        ← Import/Export de templates
```

---

## ✅ Fluxo Completo: Do Zero até Impressão

```
1. USUÁRIO ACESSA /configuracoes/cartoes
   ↓
2. SIDEBAR CARREGA
   - Exibe 4 botões de tipo (Membro, Congregado, Ministro, Funcionário)
   - Tipo "Membro" é selecionado por padrão
   ↓
3. SIDEBAR CARREGA MODELOS DO TIPO "MEMBRO"
   - Membro Modelo 01 (classico) ← ATIVADO (ativo=true)
   - Membro Modelo 02 (classico)
   - Membro Modelo Branco (branco)
   ↓
4. USUÁRIO PODE:
   a) Clicar em outro tipo → Carrega modelos daquele tipo
   b) Clicar "Usar este Modelo" → Ativa e carrega no canvas
   c) Clicar "Criar Novo" (branco) → Cria template novo vazio
   d) Clica no ativo → Abre para editar no canvas
   ↓
5. USUÁRIO EDITA NO CANVAS
   - Adiciona/remove/modifica elementos
   - Edita frente e verso
   - Clica "Salvar"
   ↓
6. SALVA NO localStorage
   - Chave: 'cartoes_templates_v2'
   - Armazena estado completo do template com elementos
   ↓
7. USUÁRIO VAI PARA "Secretaria/Membros"
   - Seleciona membro/congregado/ministro/funcionário
   - Sistema busca template ativo DAQUELE TIPO
   - Exibe cartão com dados do membro preenchido
   - Usuário imprime!
```

---

## 🎯 Status Atual Por Tipo

### **MEMBRO** ✅
- Modelo 01: ✅ Completo com frente/verso
- Modelo 02: ✅ Completo com frente/verso
- Branco: ✅ Vazio para criar do zero
- **Ativo:** Um de cada vez

### **CONGREGADO** ✅
- Modelo 01: ✅ Completo
- Modelo 02: ✅ Completo com frente/verso
- Branco: ✅ Vazio
- **Ativo:** Um de cada vez

### **MINISTRO** ✅
- Modelo 01: ✅ Completo com frente/verso
- Modelo 02: ✅ Completo com frente/verso
- Branco: ✅ Vazio
- **Ativo:** Um de cada vez

### **FUNCIONÁRIO** ⚠️
- Modelo 01: ✅ Completo (portrait)
- Branco: ✅ Vazio
- **Ativo:** Um de cada vez

---

## 🔧 Fluxo de Dados Resumido

```
localStorage ('cartoes_templates_v2')
        ↓ (carrega ao init)
   Page State: templates[]
        ↓ (passa como prop)
   TemplatesSidebar
        ↓ (usuário clica)
   ativarTemplate(id)
        ↓ (atualiza)
   setTemplates() → localStorage
        ↓ (passa como prop)
   templateEmEdicao → Canvas
        ↓ (usuário edita)
   salvarTemplate()
        ↓
   localStorage ('cartoes_templates_v2')
        ↓
   [Pronto para usar em Secretaria/Membros]
```

---

## 📋 Resumo das Mudanças Necessárias

**Atualmente:**
- ✅ 4 tipos funcionando
- ✅ 2-3 modelos por tipo
- ✅ Editor visual completo
- ✅ Armazenamento em localStorage

**Pontos de Melhoria (aguardando sugestões do usuário):**
- ? Interface/UX
- ? Quantidade de modelos
- ? Fluxo de ativação
- ? Armazenamento/Persistência
- ? Outros...

---

**Pronto para sugerir mudanças!** 🚀
