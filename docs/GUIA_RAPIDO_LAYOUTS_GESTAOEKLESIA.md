# Guia Rápido de Layouts - GestãoEklesia
## Reference Card para Implementação Rápida - Paleta Dark Blue

---

## 🎯 Estrutura Básica de uma Página Admin

```jsx
'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';

export default function MinhaPage() {
  const [formData, setFormData] = useState({});
  const [message, setMessage] = useState({ type: '', text: '' });

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar activeMenu="menu" setActiveMenu={setActiveMenu} />
      
      <div className="flex-1 overflow-auto">
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          {/* Cabeçalho */}
          {/* Abas */}
          {/* Formulário ou Tabela */}
        </div>
      </div>
    </div>
  );
}
```

---

## 🎨 Componentes Mais Usados

### Input Texto
```jsx
<input
  className="w-full px-3 py-2 text-sm border border-[#4A6FA5] rounded-lg focus:outline-none focus:border-[#0284c7] bg-blue-50"
/>
```

### Select
```jsx
<select className="w-full px-3 py-2 text-sm border border-[#4A6FA5] rounded-lg focus:outline-none focus:border-[#0284c7] bg-white">
  <option>Opção 1</option>
</select>
```

### Botão Primário
```jsx
<button className="px-6 py-2 bg-[#123b63] hover:bg-[#0d2a47] text-white rounded-lg font-semibold transition">
  Salvar
</button>
```

### Checkbox
```jsx
<input
  type="checkbox"
  className="w-5 h-5 text-[#123b63] rounded cursor-pointer"
/>
```

---

## 📐 Grids Comuns

| Uso | Classes Tailwind |
|-----|-----------------|
| 2 colunas | `grid grid-cols-1 md:grid-cols-2 gap-4` |
| 3 colunas | `grid grid-cols-1 md:grid-cols-3 gap-4` |
| 4 colunas | `grid grid-cols-1 md:grid-cols-4 gap-4` |

---

## 🎨 Cores Principais (GestãoEklesia)

| Uso | Cor | Classes/Hex |
|-----|-----|---------|
| Primária | Dark Blue | `[#123b63]` |
| Border | Medium Blue | `[#4A6FA5]` |
| Focus/Hover | Light Blue | `[#0284c7]` |
| Fundo input | Blue claro | `bg-blue-50` |
| Sucesso | Verde | `bg-green-600`, `text-green-700` |
| Erro | Vermelho | `bg-red-600`, `text-red-700` |
| Aviso | Amarelo | `bg-yellow-500` |

---

## 📋 Abas de Navegação

```jsx
<div className="mb-6 flex gap-2 border-b border-gray-300">
  <button className="px-6 py-3 text-[#123b63] border-b-2 border-[#123b63] font-semibold">
    📋 Ativa
  </button>
  <button className="px-6 py-3 text-gray-500 hover:text-[#123b63] font-semibold">
    ➕ Inativa
  </button>
</div>
```

---

## 🔍 Filtro Simples (3 campos)

```jsx
<div className="bg-blue-50 border border-[#4A6FA5] rounded-lg p-4 md:p-6 mb-6">
  <h2 className="text-lg font-semibold text-gray-700 mb-4">🔍 Filtro de Busca</h2>
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    <select className="w-full px-3 py-2 text-sm border border-[#4A6FA5] rounded-lg bg-white">
      <option>Opção 1</option>
    </select>
    <input placeholder="Buscar..." className="w-full px-3 py-2 text-sm border border-[#4A6FA5] rounded-lg bg-white" />
    <button className="px-4 py-2 bg-[#123b63] hover:bg-[#0d2a47] text-white rounded-lg font-semibold">LIMPAR</button>
  </div>
</div>
```

---

## 📊 Tabela Simples

```jsx
<div className="bg-white rounded-lg shadow-md overflow-hidden">
  <table className="w-full border-collapse">
    <thead>
      <tr className="bg-blue-100 border-b border-[#4A6FA5]">
        <th className="text-left px-4 py-3 text-xs font-semibold text-[#123b63]">#</th>
        <th className="text-left px-4 py-3 text-xs font-semibold text-[#123b63]">Nome</th>
        <th className="text-center px-4 py-3 text-xs font-semibold text-[#123b63]">Ações</th>
      </tr>
    </thead>
    <tbody>
      <tr className="border-b border-gray-200 hover:bg-blue-50">
        <td className="px-4 py-3 text-sm text-gray-700">1</td>
        <td className="px-4 py-3 text-sm text-gray-700">Item</td>
        <td className="px-4 py-3 text-center">✏️ ❌</td>
      </tr>
    </tbody>
  </table>
</div>
```

---

## 🎓 Seção de Formulário

```jsx
<div className="bg-white rounded-lg shadow-md p-4 md:p-6">
  <h2 className="text-lg font-bold text-[#123b63] mb-4">Dados Principais</h2>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label className="text-xs font-medium text-[#123b63] mb-1 block">Nome</label>
      <input placeholder="Digite..." className="w-full px-3 py-2 text-sm border border-[#4A6FA5] rounded-lg bg-blue-50" />
    </div>
  </div>
</div>
```

---

## ✅ Mensagem de Feedback

```jsx
{message.text && (
  <div className={`p-4 rounded-lg mb-4 ${
    message.type === 'error' 
      ? 'bg-red-50 border-l-4 border-l-red-400 text-red-700'
      : 'bg-green-50 border-l-4 border-l-green-400 text-green-700'
  }`}>
    {message.text}
  </div>
)}
```

---

## 🔘 Botões de Ação

```jsx
<div className="flex gap-3 justify-end mt-6">
  <button className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold">
    Cancelar
  </button>
  <button className="px-6 py-2 bg-[#123b63] hover:bg-[#0d2a47] text-white rounded-lg font-semibold">
    Salvar
  </button>
</div>
```

---

## 📱 Responsive Breakpoints

| Dispositivo | Tailwind | Resolução |
|------------|----------|-----------|
| Mobile | `col-span-1` | < 768px |
| Desktop | `md:col-span-2` | ≥ 768px |

---

## 🎯 Propriedades CSS Comuns

| Propriedade | Valor | Tailwind |
|------------|-------|----------|
| Padding | 4 | `p-4` ou `px-4 py-4` |
| Padding (desktop) | 6 | `md:p-6` |
| Margin bottom | 4 | `mb-4` |
| Margin bottom | 6 | `mb-6` |
| Gap entre elementos | 4 | `gap-4` |
| Border radius | 8px | `rounded-lg` |
| Sombra | - | `shadow-md` |
| Font size | 14px | `text-sm` |
| Font size | 12px | `text-xs` |
| Font weight | 600 | `font-semibold` |
| Font weight | 700 | `font-bold` |

---

## 🚀 Máscaras de Entrada

### CPF: `XXX.XXX.XXX-XX`
```jsx
value.replace(/\D/g, '')
  .replace(/(\d{3})(\d)/, '$1.$2')
  .replace(/(\d{3})(\d)/, '$1.$2')
  .replace(/(\d{3})(\d{1,2})/, '$1-$2')
```

### Telefone: `(XX) XXXXX-XXXX`
```jsx
value.replace(/\D/g, '')
  .replace(/(\d{2})(\d)/, '($1) $2')
  .replace(/(\d{5})(\d)/, '$1-$2')
```

### CEP: `XXXXX-XXX`
```jsx
value.replace(/\D/g, '')
  .replace(/(\d{5})(\d)/, '$1-$2')
```

---

## 🎨 Substituição Rápida de Cores

| De (CREESER) | Para (GestãoEklesia) |
|-----------|-----------|
| `bg-teal-600` | `bg-[#123b63]` |
| `text-teal-600` | `text-[#123b63]` |
| `border-teal-300` | `border-[#4A6FA5]` |
| `focus:border-teal-500` | `focus:border-[#0284c7]` |
| `bg-teal-50` | `bg-blue-50` |
| `bg-teal-100` | `bg-blue-100` |
| `text-teal-800` | `text-[#123b63]` |
| `hover:bg-teal-700` | `hover:bg-[#0d2a47]` |

---

## 💡 Dicas Rápidas

✅ Sempre use `Sidebar` como container lateral
✅ Seções em `bg-white rounded-lg shadow-md p-4 md:p-6`
✅ Inputs sempre com `border-[#4A6FA5]` e `bg-blue-50`
✅ Buttons com estados `:hover` para melhor UX
✅ Use `transition` em botões/links para animação suave
✅ Responsive: `grid-cols-1 md:grid-cols-X`
✅ Máscara de entrada para CPF, Telefone, CEP
✅ Feedback visual de sucesso/erro
✅ Overflow em tabelas: `overflow-x-auto`
✅ Header padrão: `text-[#123b63]`

---

## 📚 Arquivos de Referência

- [LAYOUT_FORMULARIOS_E_TABELAS_GESTAOEKLESIA.md](LAYOUT_FORMULARIOS_E_TABELAS_GESTAOEKLESIA.md) - Documentação completa
- [EXEMPLOS_CODIGO_COMPONENTES_GESTAOEKLESIA.md](EXEMPLOS_CODIGO_COMPONENTES_GESTAOEKLESIA.md) - Exemplos detalhados

---

**Última atualização**: 14 de janeiro de 2026
**Versão**: 1.0 - GestãoEklesia
