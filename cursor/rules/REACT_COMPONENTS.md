# ⚛️ React Components & Hooks - Referência

Documentação dos componentes React principais e custom hooks.

---

## 📋 Índice de Componentes

| Componente | Localização | Propósito | Status |
|------------|------------|----------|--------|
| `FichaMembro` | src/components/ | Form CRUD de membros | ✅ Produção |
| `CartaoBatchPrinter` | src/components/ | Impressão em lote de cartões | ✅ Produção |
| `CartãoMembro` | src/components/ | Renderização individual de cartão | ✅ Produção |
| `NotificationModal` | src/components/ | Modal de notificações | ✅ Produção |
| `Sidebar` | src/components/ | Menu lateral de navegação | ✅ Produção |
| `TemplatesSidebar` | src/components/ | Seletor de templates | ✅ Produção |
| `RichTextEditor` | src/components/ | Editor de rich text | ✅ Produção |
| `InteractiveCanvas` | src/components/ | Canvas para crop de imagens | ✅ Desenvolvimento |

---

## 🎨 Componentes Principais

### 1. FichaMembro
**Arquivo:** `src/components/FichaMembro.tsx`

**Propósito:** Formulário completo de cadastro/edição de membro

**Props:**
```typescript
interface FichaMebroProps {
  member?: Member; // Se não fornecido, é novo cadastro
  onSave: (member: Member) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}
```

**Campos:**
- Nome (obrigatório)
- Email
- Telefone
- CPF
- Data de nascimento
- Gênero
- Estado civil
- Profissão
- Endereço
- Cidade/Estado
- Status
- Foto (upload)
- Observações (rich text)

**Validações:**
- ✅ Email válido
- ✅ CPF formato
- ✅ Telefone 10-11 dígitos
- ✅ Nome mínimo 3 caracteres

**Exemplo:**
```tsx
<FichaMembro
  member={selectedMember}
  onSave={async (member) => {
    await supabase.from('members').insert(member);
  }}
  onCancel={() => setShowForm(false)}
/>
```

---

### 2. CartaoBatchPrinter
**Arquivo:** `src/components/CartaoBatchPrinter.tsx`

**Propósito:** Gerar e imprimir múltiplos cartões em PDF

**Props:**
```typescript
interface CartaoBatchPrinterProps {
  selectedMembers: Member[];
  templateId: string;
  onPrintComplete?: (pdfUrl: string) => void;
  onError?: (error: Error) => void;
}
```

**Funcionalidades:**
- ✅ Seleção múltipla de membros
- ✅ Preview de cartões
- ✅ Geração de PDF em lote
- ✅ Download automático
- ✅ Impressão direta
- ✅ Armazenamento de histórico

**Exemplo:**
```tsx
<CartaoBatchPrinter
  selectedMembers={selectedMembers}
  templateId="template-uuid"
  onPrintComplete={(pdfUrl) => {
    console.log('PDF gerado:', pdfUrl);
  }}
/>
```

---

### 3. CartãoMembro
**Arquivo:** `src/components/CartãoMembro.tsx`

**Propósito:** Renderizar cartão individual para visualização/impressão

**Props:**
```typescript
interface CartaoMembroProps {
  member: Member;
  template?: CartaoTemplate;
  size?: 'small' | 'medium' | 'large';
  showBack?: boolean;
}
```

**Recursos:**
- ✅ Renderização HTML/Canvas
- ✅ Suporte a múltiplas faces (frente/verso)
- ✅ Zoom e rotação
- ✅ Impressão de alta qualidade
- ✅ **NOVO:** Suporte a orientação Portrait para cartões de funcionário
  - Landscape (padrão): 297mm × 210mm
  - Portrait: 210mm × 297mm
  - Detecção automática via campo `template.orientacao`

**Implementação de Orientação:**
```typescript
// No template, defina a orientação:
interface TemplateCartao {
  id: string;
  nome: string;
  orientacao?: 'landscape' | 'portrait'; // 'landscape' é padrão
  elementos: ElementoCartao[];
  // ... outros campos
}

// O componente calcula dimensões automaticamente:
const getDimensoesCSSCartao = (orientacao?: string) => {
  if (orientacao === 'portrait') {
    return { width: '291px', height: '465px' };  // 210x297mm
  }
  return { width: '465px', height: '291px' };    // 297x210mm (padrão)
};
```

**Exemplo:**
```tsx
<CartãoMembro
  member={member}
  template={template} // Detecta orientação automaticamente
  size="large"
  showBack={false}
/>
```

---

### 4. NotificationModal
**Arquivo:** `src/components/NotificationModal.tsx`

**Propósito:** Exibir notificações de mudanças (CREATE, UPDATE, DELETE, EXPORT)

**Props:**
```typescript
interface NotificationModalProps {
  isOpen: boolean;
  type: 'create' | 'update' | 'delete' | 'export';
  title: string;
  message: string;
  timestamp?: Date;
  onClose: () => void;
}
```

**Estados:**
- 🟢 Success (verde)
- 🔵 Info (azul)
- 🟡 Warning (amarelo)
- 🔴 Error (vermelho)

**Exemplo:**
```tsx
<NotificationModal
  isOpen={showNotification}
  type="create"
  title="Membro criado com sucesso"
  message="João Silva foi adicionado ao sistema"
  onClose={() => setShowNotification(false)}
/>
```

---

### 5. Sidebar
**Arquivo:** `src/components/Sidebar.tsx`

**Propósito:** Menu de navegação lateral

**Funcionalidades:**
- ✅ Links para módulos
- ✅ Badge de notificações
- ✅ Logout
- ✅ Info do usuário

**Rotas:**
```
/dashboard - Dashboard
/secretaria/membros - Membros
/secretaria/fichas - Fichas
/configuracoes/cartoes - Cartões
/admin - Admin (super admin)
```

---

### 6. TemplatesSidebar
**Arquivo:** `src/components/TemplatesSidebar.tsx`

**Propósito:** Seletor de templates de cartões

**Funcionalidades:**
- ✅ Listar templates disponíveis
- ✅ Preview em thumbnail
- ✅ Filtro por tipo
- ✅ Seleção ativa

---

### 7. RichTextEditor
**Arquivo:** `src/components/RichTextEditor.tsx`

**Propósito:** Editor de texto rico para observações

**Recursos:**
- ✅ Bold, Italic, Underline
- ✅ Listas (bullet, numbered)
- ✅ Links
- ✅ Undo/Redo

**Exemplo:**
```tsx
<RichTextEditor
  value={notes}
  onChange={setNotes}
  placeholder="Observações sobre o membro"
/>
```

---

### 8. InteractiveCanvas
**Arquivo:** `src/components/InteractiveCanvas.tsx`

**Propósito:** Canvas interativo para crop/posicionamento de imagens

**Props:**
```typescript
interface InteractiveCanvasProps {
  imageUrl: string;
  width: number;
  height: number;
  onCropComplete: (croppedImage: Blob) => void;
  showGrid?: boolean;
}
```

**Funcionalidades:**
- 🔄 Rotação
- 🔍 Zoom
- 📍 Pan (arrastar)
- ✂️ Crop
- ↩️ Reset

---

## 🪝 Custom Hooks

### useMembers()
**Arquivo:** `src/app/secretaria/membros/hooks/useMembers.ts`

**Propósito:** CRUD de membros com estado

```typescript
const {
  members,
  loading,
  error,
  fetchMembers,
  createMember,
  updateMember,
  deleteMember,
  searchMembers
} = useMembers();
```

**Exemplo:**
```typescript
const { members, createMember } = useMembers();

const handleSave = async (memberData) => {
  const newMember = await createMember(memberData);
  console.log('Membro criado:', newMember);
};
```

---

### useNotification()
**Arquivo:** `src/hooks/useNotification.ts`

**Propósito:** Gerenciar estado de notificações

```typescript
const {
  notifications,
  addNotification,
  removeNotification,
  clearAll
} = useNotification();
```

**Exemplo:**
```typescript
const { addNotification } = useNotification();

const handleUpdate = async () => {
  await updateMember(data);
  addNotification({
    type: 'update',
    title: 'Sucesso',
    message: 'Membro atualizado'
  });
};
```

---

### useAuth()
**Arquivo:** `src/hooks/useAuth.ts`

**Propósito:** Gerenciar autenticação

```typescript
const {
  user,
  session,
  loading,
  signIn,
  signOut,
  isAuthenticated
} = useAuth();
```

---

### useConfigurations()
**Arquivo:** `src/hooks/useConfigurations.ts`

**Propósito:** Buscar e cachear configurações customizadas

```typescript
const {
  config,
  loading,
  updateConfig,
  getValue
} = useConfigurations();
```

**Exemplo:**
```typescript
const { getValue } = useConfigurations();
const statusValues = getValue('member_status_values');
// ["Ativo", "Inativo", "Falecido", "Transferido"]
```

---

## 🎯 Design System Integration

Todos os componentes usam o design system:

```typescript
import { SPACING, COLORS, COMPONENTS, PATTERNS } from '@/config/design-system';

export function MyComponent() {
  return (
    <div className={`${SPACING.containerPadding} bg-white`}>
      <h1 style={{ color: COLORS.darkBlue }}>Título</h1>
      <button className={COMPONENTS.button.primary}>
        Clique aqui
      </button>
    </div>
  );
}
```

---

## 📦 Padrão de Componente Novo

```tsx
// 1. Type definitions
interface MyComponentProps {
  title: string;
  onClose: () => void;
  isLoading?: boolean;
}

// 2. Component
export function MyComponent({
  title,
  onClose,
  isLoading = false
}: MyComponentProps) {
  const [state, setState] = useState('');
  
  return (
    <div className={`${SPACING.containerPadding} bg-white`}>
      <h1>{title}</h1>
      {isLoading && <LoadingSpinner />}
    </div>
  );
}

// 3. Export
export default MyComponent;
```

---

## 🔗 Estrutura de Pastas

```
src/components/
├── README.md                    # Guia de componentes
├── CartaoBatchPrinter.tsx       # Impressão em lote
├── CartãoMembro.tsx             # Cartão renderizado
├── FichaMembro.tsx              # Form de membro
├── NotificationModal.tsx        # Notificações
├── RichTextEditor.tsx           # Editor de texto
├── Sidebar.tsx                  # Menu lateral
├── TemplatesSidebar.tsx         # Seletor de templates
└── InteractiveCanvas.tsx        # Canvas de crop

src/hooks/
├── useAuth.ts                   # Autenticação
├── useConfigurations.ts         # Configurações
├── useNotification.ts           # Notificações
└── useMembersFilter.ts          # Filtro de membros
```

---

## 📊 State Management

Atualmente usando:
- **React Hooks** (useState, useContext)
- **localStorage** para sessão (SERÁ REMOVIDO)
- **Supabase Client** para dados

**Plano futuro:**
- TanStack Query para caching
- Zustand para estado global
- Jotai para estado complexo

---

## 🎨 Padrões CSS

Usar Tailwind + inline styles do design-system:

```tsx
// ✅ BOM
<div className={`${SPACING.containerPadding} bg-white rounded-lg shadow`}>
  <h1 style={{ color: COLORS.darkBlue }}>Título</h1>
</div>

// ❌ RUIM
<div style={{ padding: '24px', backgroundColor: 'white' }}>
  <h1 style={{ color: '#123b63' }}>Título</h1>
</div>
```

---

## 🧪 Testes

Padrão para testes de componentes:

```typescript
// MyComponent.test.tsx
import { render, screen } from '@testing-library/react';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('deve renderizar o título', () => {
    render(<MyComponent title="Test" onClose={() => {}} />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```

---

## 🚀 Performance

### Otimizações aplicadas:
- ✅ React.memo para componentes puros
- ✅ useMemo para cálculos custosos
- ✅ useCallback para funções estáveis
- ✅ Lazy loading de imagens
- ✅ Code splitting por rota

### Exemplo:
```tsx
const CartãoMembro = React.memo(({ member, template }) => {
  return <div>Renderizar cartão</div>;
});
```

---

## 📞 Suporte

Para dúvidas:
- Componentes: `src/components/README.md`
- Hooks: `src/hooks/README.md`
- Design System: `src/config/design-system.ts`

