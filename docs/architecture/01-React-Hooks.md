# REGRA 01 — React Hooks & Gerenciamento de Estado

## 📌 Diretrizes Principais

1. **Declaração Incondicional no Topo:** Todos os React Hooks (`useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`, etc.) devem ser declarados obrigatoriamente no topo do componente React.
2. **Proibição de Condicionais:** Nenhum Hook pode ser inserido após cláusulas de retorno (`return`), dentro de condicionais (`if`/`else`), declarações `switch`, loops (`for`/`while`), iterações (`map`) ou funções internas.
3. **Resiliência e Fallbacks em `useMemo`:** Todo `useMemo` deve prever estados nulos ou não carregados, retornando fallbacks seguros (ex: `[]` ou objetos zerados por padrão).
4. **Posicionamento de Retornos Antecipados:** Verificações de `isLoading`, `isAuthenticated`, `isAdmin` ou redirecionamentos de acesso devem ser posicionados exclusivamente **após a declaração incondicional de todos os Hooks**.

---

## 💻 Padrão de Código

```tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAdminAuth } from '@/providers/AdminAuthProvider'

export default function ExemploPage() {
  // 1. Invocação de Hooks Customizados e Estados Primários
  const { isLoading, isAuthenticated, adminUser } = useAdminAuth()
  const [data, setData] = useState<any[]>([])

  // 2. Declaração Incondicional de useEffect
  useEffect(() => {
    if (isAuthenticated) {
      // Carregar dados...
    }
  }, [isAuthenticated])

  // 3. Declaração Incondicional de useMemo com Fallbacks Seguros
  const processedData = useMemo(() => {
    const list = data || []
    if (!list.length) return []
    return list.filter((item) => item.active)
  }, [data])

  const stats = useMemo(() => {
    const list = data || []
    return {
      total: list.length,
      activeCount: list.filter((i) => i.active).length,
    }
  }, [data])

  // 4. Retornos Antecipados (Early Returns) APENAS AQUI!
  if (isLoading) {
    return <LoadingState />
  }

  if (!isAuthenticated) {
    return null
  }

  // 5. Retorno Principal do Componente
  return (
    <div>
      <h1>Painel ({stats.total})</h1>
    </div>
  )
}
```

---

## 🚫 Prevenção contra React Error #310

O erro `React Error #310` (*Rendered more/fewer hooks than during the previous render*) ocorre quando a ordem ou a quantidade de Hooks chamados se altera entre duas renderizações sucessivas. 

Ao mover retornos condicionais (`if (isLoading) return ...`) para depois da declaração de todos os Hooks, garantimos estabilidade total nos ciclos de vida do React.
