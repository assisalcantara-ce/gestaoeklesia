# Controle de Acesso e Permissões Administrativas

## 📌 Perfis de Acesso da Plataforma (`AdminRole`)

O painel administrativo possui a seguinte hierarquia de perfis definida em `src/lib/access-control.ts`:

- `super_admin`: Acesso total e ilimitado a todas as funções, configurações de infraestrutura, exclusões físicas e gerenciamento de administradores.
- `admin`: Acesso administrativo completo de gestão.
- `financeiro`: Acesso completo aos módulos **Dashboard**, **Clientes**, **Comercial**, **Financeiro/Pagamentos**, **Planos** e **Suporte**.
- `suporte`: Acesso restrito aos módulos de atendimento de chamados, navegação de clientes e dashboard.

---

## 🗺️ Mapa de Módulos (`ADMIN_MODULOS_ACESSO`)

```typescript
export const ADMIN_MODULOS_ACESSO: Record<AdminRole, string[]> = {
  admin: [
    'dashboard',
    'ministerios',
    'comercial',
    'pagamentos',
    'planos',
    'suporte',
    'configuracoes_supabase',
    'configuracoes_usuarios',
    'configuracoes_gateway',
  ],
  super_admin: [
    'dashboard',
    'ministerios',
    'comercial',
    'pagamentos',
    'planos',
    'suporte',
    'configuracoes_supabase',
    'configuracoes_usuarios',
    'configuracoes_gateway',
  ],
  financeiro: [
    'dashboard',
    'ministerios',
    'comercial',
    'pagamentos',
    'planos',
    'suporte',
  ],
  suporte: [
    'dashboard',
    'ministerios',
    'suporte',
  ],
};
```

---

## 🛡️ Regras de Proteção de Funcionalidades Críticas

1. **Exclusões Permanentes:** Ações de remoção física (`DELETE` no banco) de clientes, cobranças ou usuários são restritas **exclusivamente ao Super Admin** (`adminUser.role === 'admin' || adminUser.role === 'super_admin'`).
2. **Autorização em APIs Backend:** Utilizar a helper `requireAdmin(request, { requiredModule: 'nome_do_modulo' })` para que perfis operacionais (como `financeiro`) possam executar ações do seu escopo funcional sem barrar requisições em `requiredRole: 'admin'`.
3. **Menu Lateral Dinâmico:** O componente `AdminSidebar` utiliza `temAcessoAdmin(role, modulo)` para ocultar links de navegação para páginas não autorizadas ao perfil do operador logado.
