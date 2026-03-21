# 🔐 Estrutura de Usuários e Permissões - Gestão Eklesia

## 📋 Hierarquia de Acesso

```
ADMINISTRADOR (Acesso total ao sistema)
├─ FINANCEIRO (Acesso apenas a módulo financeiro)
├─ SUPERINTENDENTE (Acesso apenas a EBD - Geral)
│  └─ COORDENADOR (Acesso apenas a EBD - Local)
└─ SUPERVISOR (Responsável por grupo de congregações/Regional)
   └─ OPERADOR (Responsável por uma congregação)
```

## 🎯 Níveis de Acesso

### 1. **ADMINISTRADOR** 👑
- **Descrição:** Pastor Presidente / Sede do Ministério
- **Acesso:** Sistema completo
- **Módulos:** Secretaria, Financeiro, EBD, Usuários, Configurações, Auditoria, Dashboard, etc.
- **Filtro de Dados:** Vê tudo - sem filtros
- **Relacionamento:** Sem vínculo específico

### 2. **FINANCEIRO** 💳
- **Descrição:** Gerente financeiro/Tesouraria
- **Acesso:** Apenas módulo financeiro
- **Módulos:** Financeiro, Tesouraria
- **Filtro de Dados:** Vê apenas dados financeiros
- **Relacionamento:** Sem vínculo com congregação

### 3. **SUPERVISOR** 🗺️
- **Descrição:** Responsável por um grupo de congregações (Regional, Área)
- **Acesso:** Secretaria (de suas congregações)
- **Módulos:** Secretaria, Configurações (leitura)
- **Filtro de Dados:** Vê dados apenas de sua supervisão/grupo de congregações
- **Relacionamento:** Vínculado a `supervisao_id`
- **Congregações:** Gerencia múltiplas congregações

### 4. **OPERADOR** 🏢
- **Descrição:** Pastor de congregação
- **Acesso:** Secretaria (de sua congregação)
- **Módulos:** Secretaria, Configurações (leitura)
- **Filtro de Dados:** Vê dados apenas de sua congregação
- **Relacionamento:** Vínculado a `congregacao_id`
- **Congregações:** Gerencia 1 congregação

### 5. **SUPERINTENDENTE** 📚
- **Descrição:** Líder geral de EBD do ministério
- **Acesso:** EBD (geral)
- **Módulos:** EBD, Configurações (leitura)
- **Filtro de Dados:** Vê dados gerais de EBD (todas as classes)
- **Relacionamento:** Sem vínculo específico

### 6. **COORDENADOR** 👥
- **Descrição:** Líder local de EBD da congregação
- **Acesso:** EBD (local)
- **Módulos:** EBD, Configurações (leitura)
- **Filtro de Dados:** Vê dados de EBD apenas de sua congregação
- **Relacionamento:** Vínculado a `congregacao_id`

## 📊 Matriz de Acesso por Módulo

| Módulo | Admin | Financeiro | Supervisor | Operador | Superintendente | Coordenador |
|--------|-------|-----------|-----------|----------|-----------------|-----------|
| Secretaria | ✅ | ❌ | ✅ (seu grupo) | ✅ (sua cong) | ❌ | ❌ |
| Financeiro | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| EBD | ✅ | ❌ | ❌ | ❌ | ✅ (geral) | ✅ (local) |
| Usuários | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Configurações | ✅ | ❌ | 🔒 (leitura) | 🔒 (leitura) | 🔒 (leitura) | 🔒 (leitura) |
| Auditoria | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Eventos | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Patrimônio | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

## 📁 Estrutura de Dados no Supabase

### Tabelas principais:

```
ministries (tenant)
├─ ministry_users (usuários + roles)
│  ├─ role (admin, financeiro, operador, supervisor, etc)
│  ├─ supervisao_id (FK para supervisoes - se for supervisor)
│  └─ congregacao_id (FK para congregacoes - se for operador/coordenador)
│
├─ supervisoes (regionais/áreas)
│  ├─ id
│  ├─ nome (Regional Sul, Área Leste, etc)
│  └─ congregacoes (relação)
│
├─ congregacoes (igrejas/filiais)
│  ├─ id
│  ├─ nome
│  ├─ supervisao_id (FK para supervisoes)
│  └─ membros (relação)
│
└─ membros (pessoas)
   ├─ id
   ├─ nome
   ├─ congregacao_id (FK para congregacoes)
   └─ status
```

### RLS (Row Level Security) Policies:

1. **Administrador:** Acesso total
2. **Financeiro:** Apenas dados financeiros
3. **Supervisor:** Dados de suas congregações associadas
4. **Operador:** Dados de sua congregação
5. **Superintendente:** Dados de EBD (geral)
6. **Coordenador:** Dados de EBD de sua congregação

## 🔑 Fluxo de Autenticação

1. **Primeira vez:** Ministério cria conta com email + senha master (criada pela equipe)
2. **Login:** Admin do ministério entra com email + senha master
3. **Criar usuários:** Admin cria novos usuários com seus níveis e permissões
4. **Usuário faz login:** Com suas credenciais específicas
5. **Sistema carrega:** Nível, congregação/supervisão, permissões do usuário

## 🛠️ Implementação

### Hook para verificar permissões:
```typescript
import { temAcesso, podeAcessarSecretaria } from '@/hooks/usePermissions';

// Verificar acesso a módulo
if (temAcesso(nivel, 'secretaria')) {
  // Mostrar módulo
}

// Verificar acesso a secretaria
if (podeAcessarSecretaria(nivel)) {
  // Mostrar dados de secretaria
}
```

### Context para usuário logado:
```typescript
import { useUsuario } from '@/providers/UsuarioContext';

const { usuario, logout } = useUsuario();

// usuario.nivel = 'administrador' | 'financeiro' | ...
// usuario.congregacao = 'Sede' (se aplicável)
// usuario.supervisao = 'Regional Sul' (se aplicável)
```

### Filtrar dados na API:
```typescript
// No componente/página
if (usuario.nivel === 'operador') {
  // Filtrar membros por congregacao_id
} else if (usuario.nivel === 'supervisor') {
  // Filtrar por supervisao_id
}
```

## 📝 Configurações Editáveis

A nomenclatura de "Regional", "Área", "Supervisão" é editável em:
- **Configurações → Geral → Nomenclaturas**

Isso permite customizar para:
- Regional
- Área
- Zona
- Circunscrição
- Etc.

## ✅ Checklist de Implementação

- [ ] Criar migration para tabela `supervisoes`
- [ ] Adicionar colunas `supervisao_id`, `congregacao_id` em `ministry_users`
- [ ] Criar RLS policies para filtrar por nível
- [ ] Implementar hook `usePermissions`
- [ ] Criar context `UsuarioContext`
- [ ] Atualizar componentes para filtrar dados por nível
- [ ] Atualizar MembrosOverview para respeitar permissões
- [ ] Criar página para gerenciar Supervisões
- [ ] Atualizar página de Usuários para atribuir Supervisão
- [ ] Atualizar página de Configurações para nomenclatura editável
- [ ] Testes de acesso por nível

## 🚀 Próximas Etapas

1. Implementar module EBD (ainda não construído)
2. Filtrar páginas de EBD por superintendente/coordenador
3. Criar interface de gerenciamento de supervisões
4. Atualizar cadastro de congregações para vincular supervisão
5. Implementar auditoria de acesso (quem acessou o quê)
