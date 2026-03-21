# Cartão de Funcionário - Implementação

## 📋 Resumo

Foi implementado suporte completo para o novo tipo de cartão **Funcionário** no sistema de gestão de cartões. Este cartão possui características únicas em relação aos demais tipos (Membro, Congregado, Ministro).

## ✨ Características Principais

### Tipo de Cartão
- **Nome**: Cartão de Funcionário
- **ID do Tipo**: `funcionario`
- **Cor de Identificação**: `#6b21a8` (roxo)
- **Orientação**: **PORTRAIT** (vertical - 210mm x 297mm)
- **Dimensões Padrão**: Mesmas dos demais cartões, apenas com rotação de 90°

### Modelos Disponíveis

#### 1. **Funcionário em Branco** (`funcionario-branco`)
- Template 100% personalizável
- Layout completamente em branco
- Permite adicionar qualquer elemento
- Cor principal: `#7c3aed`
- Ideal para design personalizado

#### 2. **Funcionário Customizado** (`funcionario-customizado`)
- Template disponível para receber JSON customizado do usuário
- Cor principal: `#6b21a8`
- **Status**: Aguardando JSON do usuário

## 🔧 Implementação Técnica

### Arquivos Modificados

#### 1. **`src/lib/custom-card-templates.ts`** ✅
- Adicionado `'funcionario'` ao tipo `tipoCadastro`
- Adicionado campo `orientacao?: 'landscape' | 'portrait'`
- Criados 2 templates customizados:
  - `TEMPLATE_FUNCIONARIO_BRANCO`
  - `TEMPLATE_FUNCIONARIO_CUSTOMIZADO`
- Atualizados `TEMPLATES_CUSTOMIZADOS` array com novos templates

**Código de Exemplo**:
```typescript
export const TEMPLATE_FUNCIONARIO_BRANCO: TemplateCartaoCustomizado = {
  id: 'funcionario-branco',
  nome: 'Funcionário em Branco',
  tipoCadastro: 'funcionario',
  corTitulo: '#1e40af',
  temVerso: false,
  orientacao: 'portrait',  // ← PORTRAIT
  elementos: [
    // Espaço em branco para preenchimento
  ]
} as TemplateCartaoCustomizado;
```

#### 2. **`src/lib/card-templates.ts`** ✅
- Atualizado tipo `TipoCartao` para incluir `'funcionario'`
- Criados 2 templates CardTemplate:
  - `TEMPLATE_FUNCIONARIO_BRANCO`
  - `TEMPLATE_FUNCIONARIO_CUSTOMIZADO`
- Atualizados `TEMPLATES_DISPONIVEIS` com novos templates
- Campo `orientacao` na interface `CardTemplate.layout`

#### 3. **`src/components/CartãoMembro.tsx`** ✅
- Atualizada interface `Membro` com tipo `'funcionario'`
- Atualizada interface `TemplateCartao` com:
  - Tipo `'funcionario'`
  - Campo `orientacao?: 'landscape' | 'portrait'`
- Implementada função `getDimensoesCSSCartao()` para ajustar dimensões CSS baseado na orientação
- Atualizado cálculo de dimensões PDF (MM) conforme orientação
- Aplicado suporte para ambos visual e PDF

**Dimensões CSS Dinâmicas**:
```typescript
const getDimensoesCSSCartao = (orientacao?: string) => {
  if (orientacao === 'portrait') {
    return { width: '291px', height: '465px' };  // Portrait
  }
  return { width: '465px', height: '291px' };     // Landscape (padrão)
};
```

#### 4. **`src/app/configuracoes/cartoes/page.tsx`** ✅
- Atualizada interface `TemplateCartao` com tipo `'funcionario'` e campo `orientacao`
- Atualizado array `TEMPLATES_NATIVOS_IDS` com IDs dos templates funcionário
- Atualizado estado `tipoCadastroAtivo` para aceitar tipo `'funcionario'`

#### 5. **`src/components/TemplatesSidebar.tsx`** ✅
- Adicionada opção "Cartão de Funcionário" com cor roxo (`#6b21a8`)
- Atualizado array `TIPOS_CARTAO` com novo tipo

## 📐 Dimensões e Conversões

### Portrait (Funcionário)
```
Físico:     210mm (largura) × 297mm (altura)
CSS:        291px × 465px
PDF (MM):   53.98mm × 85.6mm
```

### Landscape (Membro, Congregado, Ministro)
```
Físico:     297mm (largura) × 210mm (altura)
CSS:        465px × 291px
PDF (MM):   85.6mm × 53.98mm
```

## 🎨 Elementos e Placeholders Disponíveis

O cartão de funcionário suporta **todos os mesmos elementos e placeholders** disponíveis para outros cartões:

### Elementos Suportados
- ✅ Texto
- ✅ QR Code
- ✅ Logo
- ✅ Foto do funcionário
- ✅ Chapa/Matrícula
- ✅ Imagem

### Placeholders Disponíveis
- `{nome}` - Nome do funcionário
- `{matricula}` - Matrícula/Registro
- `{cpf}` - CPF
- `{rg}` - RG
- `{cargo}` - Cargo/Função
- `{dataNascimento}` - Data de nascimento
- `{validade}` - Data de validade
- E mais... (mesmo suporte de Membros)

## 📝 Próximos Passos

### 1. Fornecimento do JSON Customizado
Quando o usuário tiver pronto o JSON customizado para o cartão de funcionário, ele deverá:

1. Acessar a área de **Configuração de Cartões**
2. Selecionar tipo **"Funcionário"**
3. Editar o template **"Funcionário Customizado"**
4. Copiar o JSON e fornecer ao sistema
5. Usar o botão **"📋 Copiar JSON"** para exportar a configuração

### 2. Integração com Banco de Dados
- Garantir que tabela `members` aceita `funcionario` em `tipo_cadastro`
- Aplicar Row Level Security (RLS) apropriada
- Adicionar índices necessários

### 3. Testes
- ✅ Criação de cartão funcionário em branco
- ⏳ Importação de JSON customizado
- ⏳ Visualização em portrait
- ⏳ Geração de PDF em orientação vertical
- ⏳ Impressão em A4 e PVC

## 🔌 Interface de Usuário

### Seleção de Tipo
Na sidebar de configuração, agora aparece:
```
📋 Templates
  ├─ Cartão de Membro (#1e40af)
  ├─ Cartão de Congregado (#0891b2)
  ├─ Credencial de Ministro (#d97706)
  └─ Cartão de Funcionário (#6b21a8) ← NOVO
```

### Configuração
- Todos os cartões funcionário aparecem com orientação **PORTRAIT**
- Canvas de edição ajusta automaticamente as dimensões
- PDF e impressão respeitam a orientação configurada

## ⚙️ Configuração de Impressão

### Tipo A4 (Múltiplos por página)
- Suporta múltiplos cartões em portrait
- Ajusta margem e espaçamento automaticamente
- Permite impressão em 1, 2 ou mais cartões por página

### Tipo PVC (1 por página)
- Dimensões exatas: 210mm × 297mm
- Orientação portrait automática
- Pronto para importadora de cartões

## 📚 Documentação Relacionada

- [CARTOES_GUIA.md](CARTOES_GUIA.md) - Guia geral de cartões (atualizar conforme necessário)
- [custom-card-templates.ts](../../../../src/lib/custom-card-templates.ts) - Definições de templates
- [CartãoMembro.tsx](../../../../src/components/CartãoMembro.tsx) - Componente de renderização

## 🐛 Troubleshooting

### Cartão aparece comprimido
- Verificar se `orientacao: 'portrait'` está configurada
- Limpar localStorage: `localStorage.removeItem('cartoes_templates_v2')`
- Atualizar página (F5)

### PDF gerado em orientação errada
- Verificar template tem `orientacao: 'portrait'`
- Verificar `getDimensoesCSSCartao()` retorna valores corretos
- Console do navegador deve estar livre de erros

### Tipo não aparece na seleção
- Verificar se `TIPOS_CARTAO` em TemplatesSidebar foi atualizado
- Verificar se `tipoCadastroAtivo` estado aceita `'funcionario'`
- Limpar cache do navegador

## ✅ Checklist de Implementação

- [x] Adicionar tipo `'funcionario'` em todas as interfaces
- [x] Criar templates de funcionário em custom-card-templates.ts
- [x] Criar templates de funcionário em card-templates.ts
- [x] Atualizar componente CartãoMembro para suportar portrait
- [x] Implementar dimensões dinâmicas CSS
- [x] Implementar dimensões dinâmicas PDF
- [x] Atualizar página de configuração
- [x] Adicionar opção na sidebar
- [x] Documentação concluída
- [ ] Testes no navegador
- [ ] Testes de impressão
- [ ] Integração JSON customizado do usuário

---

**Data de Conclusão**: 02 de janeiro de 2026  
**Status**: ✅ Implementação Completa - Aguardando Testes e JSON Customizado
