# 🎯 Hierarquia de Usuários - Referência Rápida

## 🔐 6 Níveis de Acesso

### 1️⃣ **ADMINISTRADOR** 👑
- **Quem:** Pastor Presidente
- **Acesso:** 🟢 TUDO
- **Dados:** Vê tudo, sem filtro

### 2️⃣ **FINANCEIRO** 💳
- **Quem:** Gerente Financeiro / Tesouraria
- **Acesso:** 🟡 Apenas módulo Financeiro
- **Dados:** Apenas dados financeiros

### 3️⃣ **SUPERINTENDENTE** 📚 (EBD)
- **Quem:** Líder de EBD do ministério
- **Acesso:** 🟡 Apenas EBD (geral)
- **Dados:** Todas as classes de EBD
- **Restrição:** ❌ Sem acesso a Secretaria, Financeiro

### 4️⃣ **SUPERVISOR** 🗺️
- **Quem:** Regional/Área/Zona
- **Acesso:** 🟡 Secretaria (de suas congregações)
- **Dados:** Membros de sua Regional/Área
- **Gerencia:** Múltiplas congregações
- **Restrição:** ❌ Sem acesso a EBD, Financeiro

### 5️⃣ **OPERADOR** 🏢
- **Quem:** Pastor de congregação
- **Acesso:** 🟡 Secretaria (de sua congregação)
- **Dados:** Membros de sua congregação
- **Gerencia:** 1 congregação
- **Restrição:** ❌ Sem acesso a EBD, Financeiro

### 6️⃣ **COORDENADOR** 👥 (EBD)
- **Quem:** Líder EBD local
- **Acesso:** 🟡 Apenas EBD (local)
- **Dados:** Classes de sua congregação
- **Restrição:** ❌ Sem acesso a Secretaria, Financeiro

---

## 📊 Hierarquia Visual

```
┌─────────────────────────────────────────┐
│ ADMINISTRADOR                       👑  │  ← Acesso Total
├─────────────────────────────────────────┤
│ FINANCEIRO                         💳   │  ← Financeiro Only
├─────────────────────────────────────────┤
│                                         │
│  EBD Branch:          Secretaria Branch: │
│                                         │
│  SUPERINTENDENTE                  SUPERVISOR
│      📚                              🗺️
│       └─ COORDENADOR              └─ OPERADOR
│            👥                         🏢
│
└─────────────────────────────────────────┘
```

---

## 🗝️ Como Usar no Código

### Verificar Permissão:
```tsx
import { temAcesso } from '@/hooks/usePermissions';

if (temAcesso(nivelUsuario, 'secretaria')) {
  // Renderizar módulo Secretaria
}
```

### Obter Usuário Logado:
```tsx
import { useUsuario } from '@/providers/UsuarioContext';

const { usuario } = useUsuario();
console.log(usuario?.nivel);        // 'operador', 'supervisor', etc
console.log(usuario?.congregacao);  // 'Sede' (se operador)
console.log(usuario?.supervisao);   // 'Regional Sul' (se supervisor)
```

### Filtrar Dados:
```tsx
// Para Operador: ver apenas sua congregação
membros.filter(m => m.congregacao === usuario?.congregacao)

// Para Supervisor: ver apenas suas congregações
membros.filter(m => m.supervisao === usuario?.supervisao)

// Para Admin: ver tudo
membros
```

---

## 📁 Estrutura no Supabase

```
ministry_users (usuários com roles)
├─ role: 'administrador' | 'financeiro' | ...
├─ supervisao_id: (se supervisor)
└─ congregacao_id: (se operador/coordenador)

supervisoes (regionais/áreas)
├─ id
├─ nome: 'Regional Sul'
└─ congregacoes: [Sede, Filial, Anexo, ...]

congregacoes (igrejas)
├─ id
├─ nome: 'Sede'
├─ supervisao_id: (FK)
└─ membros: [...]

membros (pessoas)
├─ id
├─ nome
└─ congregacao_id: (FK)
```

---

## 🚀 Como Adicionar/Editar Permissões

### 1. **Adicionar novo nível:**
Edit: `src/app/usuarios/page.tsx`
```tsx
nivel: 'administrador' | 'financeiro' | 'novoNivel'
```

### 2. **Definir acesso do nível:**
Edit: `src/hooks/usePermissions.ts`
```tsx
const MODULOS_ACESSO: Record<NivelAcesso, string[]> = {
  novoNivel: ['modulo1', 'modulo2'],
};
```

### 3. **Atualizar Sidebar:**
Edit: `src/components/Sidebar.tsx`
- Adicionar verificação de permissão

---

## ✅ Checklist

- [x] Hierarquia 6 níveis criada
- [x] Hook usePermissions com funções
- [x] Context UsuarioContext implementado
- [x] Dashboard Membros filtrando por permissões
- [x] Página de Supervisões criada
- [x] Tipos TypeScript definidos
- [x] Documentação completa
- [ ] **Próximo: Aplicar migration ao Supabase**
- [ ] **Próximo: Implementar Module EBD**
- [ ] **Próximo: Testes de acesso**

---

## 🔗 Links Úteis

- Guia Completo: [`docs/GUIA_USUARIOS_PERMISSOES.md`](./GUIA_USUARIOS_PERMISSOES.md)
- Resumo: [`docs/IMPLEMENTACAO_USUARIOS_SUMMARY.md`](./IMPLEMENTACAO_USUARIOS_SUMMARY.md)
- Hook: [`src/hooks/usePermissions.ts`](../src/hooks/usePermissions.ts)
- Context: [`src/providers/UsuarioContext.tsx`](../src/providers/UsuarioContext.tsx)
- Tipos: [`src/types/usuarios.ts`](../src/types/usuarios.ts)
- Página: [`src/app/configuracoes/supervisoes/page.tsx`](../src/app/configuracoes/supervisoes/page.tsx)
