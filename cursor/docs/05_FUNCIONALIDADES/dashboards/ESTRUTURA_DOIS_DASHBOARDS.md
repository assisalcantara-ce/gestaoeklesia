# 🏛️ ESTRUTURA DO SISTEMA GESTÃO EKLESIA

## Dois Pontos de Entrada

### 1️⃣ PARA MINISTÉRIOS/CLIENTES
**URL**: `http://localhost:3000/`
- Login com credenciais do ministério
- Acesso ao dashboard próprio
- Gerenciamento de usuários internos
- Dados isolados por ministério

**Credenciais de Teste**:
- Email: `presidente@eklesia.com`
- Senha: `123456`

---

### 2️⃣ PARA ADMINISTRAÇÃO GESTÃO EKLESIA
**URL**: `http://localhost:3000/admin`
- Login administrativo
- Visualizar todos os ministérios cadastrados
- Gerenciar planos de assinatura
- Visualizar receitas
- Controlar status dos clientes

**Credenciais de Teste**:
- Email: `super@gestaoeklesia.com.br`
- Senha: `123456`

---

## 📊 Fluxo de Dados

```
NOVO MINISTÉRIO
       ↓
"Cadastre uma senha aqui" (Login Cliente)
       ↓
Cria novo ministério com plano
       ↓
Credenciais vinculadas ao Ministério
       ↓
Aparece em /admin/dashboard
       ↓
Admin pode gerenciar plano e assinatura
```

---

## 🔐 Isolamento Multi-Empresa

Cada ministério tem:
- ✅ Próprio email/senha de acesso
- ✅ Próprios usuários (Admin, Financeiro, etc)
- ✅ Próprios dados e módulos
- ✅ Próprio plano (Starter/Professional/Enterprise)
- ✅ Limite de usuários conforme plano

---

## 📚 Documentação Completa

Ver `ADMIN_SISTEMA_GUIA.md` para mais detalhes.
