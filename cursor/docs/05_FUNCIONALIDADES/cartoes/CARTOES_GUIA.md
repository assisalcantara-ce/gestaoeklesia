# 📋 Sistema de Impressão de Cartões - Documentação

## ✅ Módulo Completamente Implementado

Este documento detalha a implementação completa do sistema de impressão de cartões (individual e em lote) com configuração personalizada, incluindo o novo **Cartão de Funcionário** em orientação portrait.

---

## 🎯 Funcionalidades Implementadas

### 1️⃣ **Impressão Individual de Cartões**

**Localização:** `/secretaria/membros`

**Como usar:**
1. Navigate até a página de membros
2. Clique no botão 🎫 (cartão) ao lado de cada membro
3. O cartão será exibido em uma modal de impressão
4. Clique em "🖨️ Imprimir" para enviar para impressora ou salvar como PDF

**Características:**
- ✅ Layout landscape (297mm × 210mm)
- ✅ Suporte para 4 tipos de cartão:
  - Cartão de Membro (Azul #1e40af) - Landscape
  - Cartão de Congregado (Cyan #0891b2) - Landscape
  - Credencial de Ministro (Âmbar #d97706) - Landscape
  - **Cartão de Funcionário** (Roxo #6b21a8) - **PORTRAIT** ✨
    - Layout em pé (portrait: 210mm × 297mm)
    - Ideal para IDs de funcionários em orientação vertical
    - Mesmos elementos e placeholders disponíveis
  - 1 template customizado + 1 em branco
- ✅ Elementos inclusos:
  - Nome do membro
  - Matrícula
  - Tipo de cadastro
  - Função (se ministro)
  - CPF
  - ID Único (16 caracteres)
  - QR Code codificando o ID único
  - Datas de validade (1 ano)

---

### 2️⃣ **Cartão de Funcionário (Novo!)**

**Localização:** `/secretaria/membros` ou `/secretaria/funcionarios` (quando implementado)

**Características Especiais:**
- 📐 **Orientação Portrait:** 210mm × 297mm (em pé, diferente dos demais)
- 🎨 **Cor:** Azul #1e40af (mesmo do membro)
- 📑 **Templates:**
  - 1 Template Customizado (JSON fornecido)
  - 1 Modelo em Branco (para preenchimento manual)
- ✅ **Mesmos elementos disponíveis:**
  - Nome
  - Matrícula
  - Tipo de cadastro
  - Função
  - CPF
  - RG, Nacionalidade, Naturalidade
  - Data de Nascimento, Data de Batismo
  - Estado Civil, Tipo Sanguíneo
  - QR Code
  - E todos os outros placeholders do sistema

**Como usar:**
1. Navigate até a página de membros
2. Selecione um funcionário
3. Clique no botão 🎫 para exibir o cartão
4. O cartão será renderizado em orientação **portrait**
5. Configure o layout conforme necessário no módulo de configuração
6. Imprima ou salve como PDF

**Implementação do Template JSON:**
Para adicionar o template customizado do funcionário:
1. Acesse `/configuracoes/cartoes`
2. Selecione "Funcionário" na sidebar
3. Cole o JSON fornecido
4. Ajuste elementos conforme necessário
5. Clique em "💾 Salvar Template"

---

### 3️⃣ **Impressão em Lote**

**Localização:** `/secretaria/membros`

**Como usar:**
1. Na tabela de membros, marque o checkbox ao lado de cada membro
2. Use o checkbox no header da tabela para selecionar/desselecionar todos visíveis
3. Clique em "🎫 IMPRIMIR CARTÕES (N)" após selecioná-los
4. Uma modal de confirmação será exibida
5. Clique em "🖨️ Gerar PDF em Lote" para iniciar a geração
6. O navegador fará download do PDF com todos os cartões

**Características:**
- ✅ Seleção individual de membros
- ✅ Seleção em lote via checkbox do header
- ✅ Contador de membros selecionados
- ✅ Geração de PDF otimizado para impressão
- ✅ Layout de 2 cartões por linha, 4 por página
- ✅ Suporte para múltiplas páginas
- ✅ QR Codes inclusos em cada cartão

---

### 3️⃣ **Módulo de Configuração de Cartões**

**Localização:** `/configuracoes/cartoes`

**Como usar:**

#### Gerenciar Templates
1. Acesse as configurações de cartões
2. No sidebar esquerdo, selecione o tipo de cartão (Membro/Congregado/Ministro)
3. Clique em um template existente para editá-lo
4. Modifique o nome, tipo e elementos conforme desejado

#### Upload de Background
1. No painel de edição, localize "Imagem de Fundo"
2. Clique em "📤 Fazer Upload" ou "🖼️ Alterar Imagem"
3. Selecione uma imagem em formato landscape (297mm × 210mm recomendado)
4. A imagem será usada como fundo do cartão

#### Adicionar/Editar Elementos
1. No sidebar direito, clique em um elemento desejado (👤 Nome, 🔢 Matrícula, etc.)
2. O elemento será adicionado ao canvas com posição padrão
3. Clique no elemento para selecioná-lo
4. Use o panel de propriedades (direita) para:
   - Ajustar posição (X, Y) com sliders
   - Ajustar tamanho (largura, altura)
   - Modificar tamanho da fonte
   - Mudar cor do texto
   - Alternar visibilidade

#### Elementos Disponíveis
- 👤 **Nome** - Nome completo do membro
- 🔢 **Matrícula** - Número de matrícula
- 📋 **Condição** - Tipo de cadastro (Membro/Congregado/Ministro)
- 🆔 **CPF** - CPF do membro
- ⛪ **Função** - Função ministerial (se aplicável)
- 📱 **QR Code** - Código QR com ID único
- 📅 **Data de Validade** - Datas de início e término de validade

#### Salvando Templates
1. Após editar, clique em "💾 Salvar Template"
2. O template será atualizado e poderá ser usado para novos cartões

#### Duplicar Template
1. Clique em "📋 Duplicar" em um template existente
2. Uma cópia será criada com nome "(Cópia)"
3. Edite conforme necessário

#### Deletar Template
1. Clique em "🗑️ Deletar" em um template
2. Confirme a exclusão no diálogo

---

## 📁 Estrutura de Arquivos

```
src/
├── app/
│   ├── secretaria/membros/
│   │   └── page.tsx                    # Página principal de membros com impressão
│   └── configuracoes/cartoes/
│       └── page.tsx                    # Painel de configuração de cartões
│
└── components/
    ├── CartãoMembro.tsx                # Componente de renderização individual
    ├── CartaoBatchPrinter.tsx          # Componente de geração em lote em PDF
    ├── FichaMembro.tsx                 # (Existente) Ficha de cadastro
    └── ...
```

---

## 🛠️ Componentes Principais

### **CartãoMembro.tsx**
```tsx
interface CartãoMembroProps {
  membro: Membro;
  onClose?: () => void;
}
```
- Renderiza um cartão individual em layout landscape
- Suporta 3 tipos de cartão com cores diferentes
- Inclui QR Code, datas de validade
- Botões para imprimir e fechar

### **CartaoBatchPrinter.tsx**
```tsx
interface CartaoBatchPrinterProps {
  membros: Membro[];
  onComplete?: () => void;
}
```
- Gera PDF com múltiplos cartões
- Otimiza layout para impressão (2 por linha)
- Cria múltiplas páginas conforme necessário
- Retorna callback ao completar

### **Configuração de Cartões**
- Gerenciamento de templates por tipo de cartão
- Upload de imagens de fundo
- Editor visual com drag-and-drop
- Sliders para ajustes precisos de posição e tamanho

---

## 🎨 Sistema de Cores

| Tipo | Cor | Código | Orientação |
|------|-----|--------|-----------|
| Membro | Azul | #1e40af | Landscape |
| Congregado | Cyan | #0891b2 | Landscape |
| Ministro | Âmbar | #d97706 | Landscape |
| **Funcionário** | **Azul** | **#1e40af** | **Portrait** |

---

## 📊 Dados do Membro

O sistema utiliza os seguintes dados do membro:
- `uniqueId` - ID único de 16 caracteres (codificado no QR)
- `matricula` - Número de matrícula
- `nome` - Nome completo
- `tipoCadastro` - Tipo (membro/congregado/ministro/crianca)
- `cpf` - CPF (formatado ou não)
- `qualFuncao` - Função ministerial (se aplicável)

---

## 🖨️ Impressão

### Impressão Individual
1. O navegador abrirá a página de impressão do sistema operacional
2. Selecione a impressora desejada
3. Configure tamanho do papel (A4 landscape)
4. Clique em "Imprimir" ou "Salvar como PDF"

### Impressão em Lote
1. O navegador fará download automático do PDF
2. Abra o arquivo com seu leitor de PDF
3. Selecione a impressora e quantidade de cópias
4. Configure para impressão frente-e-verso se desejado

---

## 🔧 Configurações Recomendadas

### Papel
- **Tamanho:** A4 (210mm × 297mm)
- **Orientação:** Landscape (para cartões individuais)
- **Qualidade:** Alta (200+ DPI)

### Impressora
- **Tipo:** Jato de tinta ou laser
- **Bandeja:** Papel comum (80g) recomendado

### Software
- **Leitor PDF:** Adobe Reader, Chrome, Firefox
- **Navegador:** Chrome, Firefox, Edge, Safari

---

## 💾 Armazenamento de Templates

Os templates são armazenados no estado da aplicação. Para persistência permanente, implemente:

```typescript
// Salvar em localStorage
localStorage.setItem('cartoes_templates', JSON.stringify(templates));

// Recuperar do localStorage
const templates = JSON.parse(localStorage.getItem('cartoes_templates') || '[]');
```

Ou integre com banco de dados:
```typescript
// Exemplo com API
await fetch('/api/cartoes/templates', {
  method: 'POST',
  body: JSON.stringify(template)
});
```

---

## 🐛 Troubleshooting

### Cartão não aparece
- Verifique se o membro tem todos os dados necessários
- Confirme que `uniqueId` foi gerado

### QR Code não exibe
- Verifique a biblioteca `qrcode.react`
- Confirme que `uniqueId` tem 16 caracteres válidos

### PDF não é gerado
- Verifique se há espaço em disco
- Tente em outro navegador
- Desabilite bloqueadores de pop-up

### Imagem de fundo não aparece
- Confirme que o arquivo é uma imagem válida (PNG, JPG)
- Verifique o tamanho (recomendado: < 5MB)
- Tente redimensionar a imagem para o tamanho exato

---

## 📈 Melhorias Futuras

- [ ] Salvar templates em banco de dados
- [ ] Histórico de impressões
- [ ] Estatísticas de cartões impressos
- [ ] Validação de data de validade
- [ ] Integração com prestadores de impressão
- [ ] Cartões duplex (frente/verso)
- [ ] Códigos de barras (além de QR)
- [ ] Temas customizados por igreja

---

## 📞 Suporte

Para dúvidas ou problemas:
1. Verifique se o navegador está atualizado
2. Limpe o cache do navegador
3. Tente em modo anônimo/privado
4. Verifique o console do navegador (F12) para erros

---

**Versão:** 1.0.0  
**Data:** 8 de dezembro de 2025  
**Status:** ✅ Completo e Funcional
