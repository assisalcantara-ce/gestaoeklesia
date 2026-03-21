<!-- Exemplo de Uso do NotificationModal -->

## 🎉 Notificação Modal - Exemplos de Uso

### Tipo: SUCCESS (Sucesso)
```
┌─────────────────────────────────────────────────┐
│                                                 │
│          [🏢 Logo Gestão Eklesia]              │
│                                                 │
│                    ✓ (em verde)                │
│                                                 │
│             Sucesso                            │
│   Cadastro salvo com sucesso!                 │
│                                                 │
│          [      OK (verde)      ]              │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Cores:**
- Fundo: bg-green-50
- Borda: border-green-200
- Título: text-green-900
- Mensagem: text-green-700
- Botão: bg-green-600 hover:bg-green-700
- Ícone: ✓ (texto-green-600)

### Tipo: WARNING (Aviso)
```
┌─────────────────────────────────────────────────┐
│                                                 │
│          [🏢 Logo Gestão Eklesia]              │
│                                                 │
│                   ⚠️ (amarelo)                 │
│                                                 │
│              Aviso                             │
│   A imagem deve ter no mínimo 200x200px      │
│                                                 │
│         [      OK (amarelo)     ]              │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Cores:**
- Fundo: bg-yellow-50
- Borda: border-yellow-200
- Título: text-yellow-900
- Mensagem: text-yellow-700
- Botão: bg-yellow-600 hover:bg-yellow-700
- Ícone: ⚠️ (text-yellow-600)

### Tipo: ERROR (Erro)
```
┌─────────────────────────────────────────────────┐
│                                                 │
│          [🏢 Logo Gestão Eklesia]              │
│                                                 │
│                    ✕ (vermelho)                │
│                                                 │
│              Erro                              │
│          Operação não foi concluída             │
│                                                 │
│         [      OK (vermelho)    ]              │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Cores:**
- Fundo: bg-red-50
- Borda: border-red-200
- Título: text-red-900
- Mensagem: text-red-700
- Botão: bg-red-600 hover:bg-red-700
- Ícone: ✕ (text-red-600)

### Tipo: INFO (Informação)
```
┌─────────────────────────────────────────────────┐
│                                                 │
│          [🏢 Logo Gestão Eklesia]              │
│                                                 │
│                   ℹ️ (azul)                    │
│                                                 │
│           Informação                           │
│      Versão 1.0.0 agora disponível             │
│                                                 │
│          [      OK (azul)       ]              │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Cores:**
- Fundo: bg-blue-50
- Borda: border-blue-200
- Título: text-blue-900
- Mensagem: text-blue-700
- Botão: bg-blue-600 hover:bg-blue-700
- Ícone: ℹ️ (text-blue-600)

## 📱 Responsividade

O modal é completamente responsivo:
- Em dispositivos pequenos: usa 100% da largura com padding
- Em dispositivos médios: largura máxima de 448px (md:max-w-md)
- Altura dinâmica: escala automaticamente com o conteúdo
- Scroll automático se conteúdo for muito longo (max-h-screen overflow-y-auto)

## 🎨 Características CSS

```css
/* Fundo escuro do overlay */
fixed inset-0 bg-black/50 z-50

/* Container do modal */
max-w-md w-full p-6 max-h-screen overflow-y-auto
rounded-lg shadow-2xl

/* Logo */
h-12 object-contain

/* Ícone */
text-5xl text-center

/* Título */
text-xl font-bold

/* Mensagem */
text-sm

/* Botão */
w-full px-6 py-3 rounded-lg transition font-bold
```

## 🔄 Estado e Controle

O componente é controlado via props:

```typescript
// Estado na página pai
const [notification, setNotification] = useState({
  isOpen: false,
  title: '',
  message: '',
  type: 'success'
});

// Exibir notificação
const showSuccess = () => {
  setNotification({
    isOpen: true,
    title: 'Sucesso',
    message: 'Operação realizada!',
    type: 'success'
  });
};

// Fechar notificação
const closeNotification = () => {
  setNotification({ ...notification, isOpen: false });
};
```

## 🎯 Uso em Diferentes Contextos

### Salvar Formulário
```typescript
const handleSave = () => {
  try {
    // salvar dados...
    setNotification({
      isOpen: true,
      title: 'Sucesso',
      message: 'Dados salvos com sucesso!',
      type: 'success'
    });
  } catch (error) {
    setNotification({
      isOpen: true,
      title: 'Erro',
      message: 'Falha ao salvar dados',
      type: 'error'
    });
  }
};
```

### Validação de Formulário
```typescript
const validateImage = (file: File) => {
  if (file.size > 5242880) { // 5MB
    setNotification({
      isOpen: true,
      title: 'Aviso',
      message: 'O arquivo deve ter no máximo 5MB',
      type: 'warning'
    });
    return false;
  }
  return true;
};
```

### Operações Assíncronas
```typescript
const handleUpgrade = async () => {
  try {
    await upgradeUser();
    setNotification({
      isOpen: true,
      title: 'Sucesso',
      message: 'Upgrade realizado com sucesso!',
      type: 'success'
    });
  } catch (error) {
    setNotification({
      isOpen: true,
      title: 'Erro',
      message: 'Falha ao fazer upgrade',
      type: 'error'
    });
  }
};
```
