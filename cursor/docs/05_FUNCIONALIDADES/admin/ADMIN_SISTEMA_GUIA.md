# 🎯 Sistema Admin - Painel de Controle Multi-Ministério

## 📋 Visão Geral

O **Sistema Admin** é um painel de controle separado para gerenciar múltiplos ministérios/empresas clientes que utilizam o Gestão Eklesia. Cada ministério cadastrado terá sua própria instância com usuários e dados isolados.

---

## 🏗️ Arquitetura do Sistema

### Dois Sistemas Independentes

```
ACESSO PÚBLICO (Link no site)
    ↓
┌─────────────────────────────────────────┐
│   GESTÃO EKLESIA (Cliente)              │
│   /                    → Login cliente   │
│   /dashboard           → Dashboard       │
│   /usuarios            → Gestão usuarios │
│   /[modulos]           → Outros modulos  │
└─────────────────────────────────────────┘
    ↑
    └── Senha criada em "Cadastre uma senha aqui"
        ↓
        Senha atrelada ao Ministério (Admin Dashboard)


ACESSO RESTRITO (URL própria - futuramente publicada)
    ↓
┌─────────────────────────────────────────┐
│   ADMIN DASHBOARD (Gestão)              │
│   /admin               → Login admin     │
│   /admin/dashboard     → Painel control  │
│   /admin/ministerios   → Listar clients  │
│   /admin/[funcoes]     → Gerenciar planos│
└─────────────────────────────────────────┘
    ↑
    └── Acesso apenas para Super Admin e Suporte
```

---

## 🔐 Fluxo de Autenticação

### 1. Cliente (Ministério) - Login Regular
```
Email + Senha → /dashboard → Acesso ao sistema
    ↓
    Dados armazenados em localStorage
    ↓
    Acesso isolado ao próprio ministério
```

### 2. Admin - Login Administrativo
```
Email Admin + Senha → /admin/dashboard → Painel de controle
    ↓
    Pode visualizar/gerenciar todos os ministérios
    ↓
    Pode alterar planos e status de assinatura
```

---

## 📂 Estrutura de Pastas

```
src/
├── app/
│   ├── admin/                      ← NOVO: Painel administrativo
│   │   ├── page.tsx               (Login admin)
│   │   └── dashboard/
│   │       └── page.tsx           (Dashboard admin)
│   ├── dashboard/
│   │   └── page.tsx               (Dashboard cliente existente)
│   ├── page.tsx                   (Login cliente existente)
│   ├── usuarios/                  (Gerenciamento de usuários cliente)
│   └── [outros modulos]/
│
├── config/
│   ├── design-system.ts           (Existente)
│   ├── plans.ts                   ← NOVO: Definição de planos
│   └── mock-data.ts               ← NOVO: Dados simulados
│
├── types/
│   └── ministry.ts                ← NOVO: Tipos TypeScript
│
└── ...outros arquivos
```

---

## 💰 Planos de Assinatura Disponíveis

### 1️⃣ **Plano Starter** - Pequenos Ministérios
- **Preço**: R$ 99,90/mês ou R$ 999,00/ano
- **Usuários**: Até 10
- **Armazenamento**: 5 GB
- **Recursos**:
  - Dashboard básico
  - Suporte por email
  - Relatórios simples
  - Backup semanal

### 2️⃣ **Plano Professional** - Ministérios em Crescimento
- **Preço**: R$ 199,90/mês ou R$ 1.999,00/ano
- **Usuários**: Até 50
- **Armazenamento**: 50 GB
- **Recursos**:
  - Dashboard avançado
  - Suporte email + chat
  - Relatórios detalhados
  - Backup diário
  - Integração com sistemas
  - API própria

### 3️⃣ **Plano Enterprise** - Redes de Ministérios
- **Preço**: R$ 499,90/mês ou R$ 4.999,00/ano
- **Usuários**: Até 500
- **Armazenamento**: 500 GB
- **Recursos**:
  - Dashboard customizável
  - Suporte 24/7 (phone + email + chat)
  - Relatórios em tempo real
  - Backup em tempo real
  - API ilimitada
  - Consultoria incluída
  - Custom branding
  - SSO (Single Sign-On)
  - Gestor de conta dedicado

---

## 👥 Usuários de Teste - Admin

### Super Admin (Acesso Total)
```
Email: super@gestaoeklesia.com.br
Senha: 123456
Role: Super Admin
```

### Suporte
```
Email: suporte@gestaoeklesia.com.br
Senha: 123456
Role: Suporte
```

---

## 📊 Dados de Teste - Ministérios

O sistema vem com 5 ministérios simulados:

1. **Igreja Central de São Paulo**
   - Plano: Professional (Anual)
   - Status: Ativo
   - Usuários: 28/50

2. **Ministério das Assembleias - RJ**
   - Plano: Starter (Mensal)
   - Status: Ativo
   - Usuários: 8/10

3. **Rede Nacional de Igrejas Evangélicas**
   - Plano: Enterprise (Anual)
   - Status: Ativo
   - Usuários: 145/500

4. **Comunidade de Fé Brasília**
   - Plano: Professional (Anual)
   - Status: Ativo (Assinatura Pendente)
   - Usuários: 35/50

5. **Igreja Vida Nova - Salvador**
   - Plano: Starter (Mensal)
   - Status: Inativo
   - Usuários: 5/10

---

## 🚀 Funcionalidades do Admin Dashboard

### 1. **Dashboard Principal**
- 📊 Estatísticas em tempo real:
  - Total de ministérios cadastrados
  - Quantidade de ministérios ativos
  - Receita mensal (pagamentos mensais)
  - Receita anual estimada (pagamentos anuais)

### 2. **Listagem de Ministérios**
- 🔍 Busca por nome ou email
- 🎯 Filtros por status (Ativos, Inativos, Bloqueados)
- 📋 Tabela com informações:
  - Nome do ministério
  - Email do admin
  - Plano (Starter/Professional/Enterprise)
  - Status
  - Uso de usuários
  - Status da assinatura
  - Data de vencimento

### 3. **Modal de Detalhes**
- Ver informações completas do ministério
- Dados de contato
- Endereço
- Data de cadastro e último acesso
- Informações da assinatura
- Botões de ação (Editar, Gerenciar Usuários)

### 4. **Gerenciamento de Assinatura** (Futuro)
- Alterar plano
- Renovar/cancelar assinatura
- Analisar faturamento
- Histórico de pagamentos

---

## 🔄 Fluxo de Cadastro de Novo Ministério

### Atualmente:
1. Cliente clica em "Cadastre uma senha aqui" (na página de login)
2. Sistema cria novo ministério com plano padrão
3. Senha do ministério é criada
4. Admin recebe notificação

### Futuro:
1. Página de registro com planos visíveis
2. Cliente escolhe plano e paga
3. Sistema cria ministério automaticamente
4. Email de boas-vindas enviado
5. Aparece no dashboard admin

---

## 🔗 URLs Principais

| URL | Descrição | Acesso |
|-----|-----------|--------|
| `/` | Login do cliente | Público |
| `/dashboard` | Dashboard do cliente | Cliente logado |
| `/usuarios` | Gestão de usuários cliente | Cliente logado |
| `/admin` | Login administrativo | Público |
| `/admin/dashboard` | Painel de controle | Admin logado |

---

## 💾 Isolamento de Dados

### Cada ministério tem:
- ✅ Suas próprias credenciais
- ✅ Seus próprios usuários (em `usuarios/`)
- ✅ Seus próprios dados
- ✅ Seu próprio plano e assinatura
- ✅ Seu próprio limite de usuários e armazenamento

### Segurança:
- Dados armazenados por ID do ministério
- localStorage isolado por domínio
- Validação de acesso em cada página
- Redirecionar automaticamente se não logado

---

## 📈 Próximos Passos

### Fase 1 (Implementado ✅)
- [x] Login admin
- [x] Dashboard admin com listagem
- [x] Visualizar detalhes de ministério
- [x] Definir planos de assinatura

### Fase 2 (Próximo)
- [ ] Página de cadastro de novo ministério
- [ ] Integração com sistema de pagamento
- [ ] Gerenciamento de usuários do cliente
- [ ] Relatórios avançados

### Fase 3 (Futuro)
- [ ] API para integração externa
- [ ] Webhook para pagamentos
- [ ] Dashboard customizável
- [ ] Multi-idioma
- [ ] SSO para Enterprise

---

## 🎨 Design & UX

- Cores consistentes com design system (azul #123b63)
- Layout responsivo (mobile, tablet, desktop)
- Modal para detalhes sem sair da página
- Badges coloridas por status
- Filtros e busca integrados
- Tabela rolável em dispositivos pequenos

---

## 🔐 Segurança

### Implementado:
- Autenticação por email + senha
- localStorage para sessão
- Validação de acesso em pages
- Diferentes roles (Super Admin, Admin, Suporte)

### Recomendações Futuras:
- JWT tokens em produção
- Refresh tokens
- 2FA (Autenticação de dois fatores)
- Logs de auditoria
- Backup automatizado de dados

---

## 📝 Notas Importantes

1. **Ministérios e Clientes**: O termo "ministério" refere-se a qualquer cliente (Igreja, Rede, Organização) usando o sistema

2. **Senhas em Produção**: Atualmente usando comparação simples "123456" para teste. Em produção, deve usar bcrypt ou similar.

3. **Dados Simulados**: `mock-data.ts` contém dados de teste. Em produção, conectar a banco de dados real.

4. **Pagamentos**: Sistema atual não integrado com gateway de pagamento. Adicionar Stripe/PayPal futuramente.

5. **Email**: Notificações via email ainda não implementadas.

---

## 🚀 Como Testar

1. **Acesso Cliente (Existente)**:
   - URL: `http://localhost:3000`
   - Email: `presidente@eklesia.com.br`
   - Senha: `123456`

2. **Acesso Admin (Novo)**:
   - URL: `http://localhost:3000/admin`
   - Email: `super@gestaoeklesia.com.br`
   - Senha: `123456`

3. **Explorar Dashboard Admin**:
   - Ver listagem de ministérios
   - Filtrar por status
   - Buscar por nome/email
   - Clicar em "Ver Detalhes" para ver modal
   - Logout com botão "Sair"

---

**Versão**: 1.0
**Data**: 29 de Novembro de 2025
**Status**: ✅ Funcional e Testado
