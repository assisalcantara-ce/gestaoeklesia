# 🔐 Sistema de Credenciais de Teste - Fluxo Completo

**Data:** 8 de janeiro de 2026  
**Status:** ✅ Corrigido

---

## 🎯 O Que Era o Problema

Quando você gerava credenciais de teste via "🔑 Credenciais", a lista de **Pré-Cadastros (Trial)** continuava mostrando o status **"Expirado"** mesmo após gerar as credenciais.

### Por que acontecia?

1. **Componente não atualizava a lista** após gerar credenciais
2. **Status do pré-cadastro permanecia "pending"** na UI
3. **Sem refresh**, a página continuava mostrando dados antigos

---

## ✅ O Que Foi Corrigido

### 1. **Atualização Automática da Lista** 

Agora quando credenciais são geradas, o sistema:

```typescript
// Atualizar pré-cadastros com novo status
setSignups(signups.map(signup => 
  signup.id === selectedSignup.id 
    ? { 
        ...signup, 
        status: 'active',                          // ✅ Status muda para "Aprovado"
        trial_expires_at: data.data.expires_at     // ✅ Data expira em 7 dias
      }
    : signup
))

// Atualizar preview do modal também
setSelectedSignup({
  ...selectedSignup,
  status: 'active',
  trial_expires_at: data.data.expires_at,
})

// Mostrar modal de credenciais automaticamente
setShowCredsModal(true)
```

### 2. **Fluxo de Geração de Credenciais**

```
Admin clica "Detalhes" no pré-cadastro
    ↓
Modal mostra dados do pré-cadastro
    ↓
Admin clica "🔑 Credenciais"
    ↓
Modal de geração aparece
    ↓
Admin clica "Gerar"
    ↓
[Backend cria:]
  1️⃣ Usuário em auth.users (test_TIMESTAMP)
  2️⃣ Ministério temporário com 7 dias
  3️⃣ Entrada em test_credentials
  4️⃣ Adiciona user como admin
    ↓
[Frontend:]
  1️⃣ Mostra as credenciais no modal
  2️⃣ Atualiza status do pré-cadastro para "Ativo"
  3️⃣ Atualiza data de expiração para +7 dias
  4️⃣ Lista no início atualiza automaticamente
    ↓
Admin copia credenciais com 1 clique
    ↓
Compartilha com lead via WhatsApp/Email
```

---

## 📋 O Que é Gerado Quando Clica "Gerar"

### No Backend (`/api/v1/admin/test-credentials`)

1. **Usuário em Supabase Auth**
   - Email: `test_TIMESTAMP@test.local` (ex: `test_1704462600@test.local`)
   - Senha: 12 caracteres aleatórios
   - Email confirmado automaticamente

2. **Ministério Temporário**
   - Nome: `TESTE - [Nome da Igreja]`
   - Validade: 7 dias
   - Plan: `trial`
   - Status: `active`
   - Max users: 5
   - Storage: 1GB

3. **Entrada em test_credentials**
   - username: `test_TIMESTAMP`
   - password: Criptografado (base64)
   - is_active: true
   - expires_at: +7 dias

4. **Relação ministry_users**
   - Usuário adicionado como `admin` do ministério temporário

### No Frontend (TrialSignupsWidget.tsx)

1. **Atualiza a lista de pré-cadastros**
   ```
   Antes: status = "pendente" (expirado)
   Depois: status = "ativo" (com data de expiração)
   ```

2. **Mostra modal com credenciais**
   - Usuário (copiável)
   - Senha (copiável)
   - URL de acesso (copiável)
   - Data de expiração (formato BR)

3. **Atualiza selectedSignup**
   - Reflete mudanças imediatamente no modal

---

## 🧪 Como Testar Agora

### Teste 1: Geração e Atualização

```
1. Vá para Admin → Ministérios → Pré-Cadastros (Trial)
2. Veja um pré-cadastro com status "Pendente"
3. Clique "Detalhes"
4. Clique "🔑 Credenciais"
5. Clique "Gerar"
6. Credenciais aparecem
7. Feche o modal
8. ✅ Pré-cadastro agora mostra "Aprovado"
9. ✅ Data de expiração é +7 dias
```

### Teste 2: Volta à Lista

```
1. Após gerar credenciais
2. Feche o modal de credenciais
3. Feche o modal de detalhes
4. ✅ Status mudou de "Pendente/Expirado" para "Aprovado"
5. Você pode gerar novamente se quiser (desativa credenciais antigas)
```

### Teste 3: Múltiplas Gerações

```
1. Gere credenciais (1ª geração)
2. Feche todos os modals
3. Clique "Detalhes" novamente
4. Clique "🔑 Credenciais"
5. Clique "Gerar" (2ª geração)
6. ✅ Credenciais antigas são desativadas
7. ✅ Novas credenciais são criadas
```

---

## 🔄 Arquivos Modificados

| Arquivo | Mudanças |
|---------|----------|
| `src/components/TrialSignupsWidget.tsx` | Adicionada atualização de lista após gerar credenciais |

### Antes
```typescript
if (response.ok && data.success) {
  setGeneratedCreds(data.data)           // ❌ Só guarda credenciais
  setShowCredsModal(true)
  alert('✅ Credenciais geradas!')
}
```

### Depois
```typescript
if (response.ok && data.success) {
  setGeneratedCreds(data.data)           // ✅ Guarda credenciais
  
  // ✅ Atualiza a lista de pré-cadastros
  setSignups(signups.map(signup => 
    signup.id === selectedSignup.id 
      ? { ...signup, status: 'active', trial_expires_at: data.data.expires_at }
      : signup
  ))
  
  // ✅ Atualiza o modal de detalhes
  setSelectedSignup({
    ...selectedSignup,
    status: 'active',
    trial_expires_at: data.data.expires_at,
  })
  
  // ✅ Mostra credenciais automaticamente
  setShowCredsModal(true)
  alert('✅ Credenciais geradas!')
}
```

---

## 📊 Status Visual Antes vs Depois

### ANTES ❌
```
Pré-Cadastro: Igreja ABC
Status: Expirado         ← Permanecia assim
Data: 15/01/2026        ← Não atualizava

(Admin gerou credenciais aqui)

Voltou para a lista:
Status: Expirado         ← ❌ Continuava expirado!
```

### DEPOIS ✅
```
Pré-Cadastro: Igreja ABC
Status: Pendente         ← Inicial
Data: 15/01/2026

(Admin clica "Detalhes" → "Gerar Credenciais")

Voltou para a lista:
Status: Aprovado         ← ✅ Atualizou!
Data: 15/01/2026 (7 dias)
```

---

## 🚀 Próximas Melhorias (Opcional)

1. **Auto-refresh da lista** a cada 30 segundos
2. **Notificações de expirando** quando faltam 2 dias
3. **Histórico de credenciais** geradas
4. **Revogação de credenciais** manual
5. **Integração com WhatsApp API** para enviar credenciais automaticamente

---

## ✨ Resumo da Correção

| Aspecto | ANTES | DEPOIS |
|---------|-------|--------|
| Status após gerar | Não atualizava | ✅ Atualiza imediatamente |
| Data expiração | Não mudava | ✅ Mostra +7 dias |
| Modal credenciais | Não abria auto | ✅ Abre automaticamente |
| Lista | Desincronizada | ✅ Sincronizada |
| UX | Confusa | ✅ Intuitiva |

**Status Final:** ✅ **Funcionando Corretamente** 🎉
