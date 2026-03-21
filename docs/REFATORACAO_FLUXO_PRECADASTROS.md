# 🔄 Refatoração do Fluxo de Pré-Cadastros (Trial)

**Data:** 8 de janeiro de 2026  
**Status:** ✅ Implementado

---

## 📋 O Que Mudou

### ❌ Removido
- **Botão "Contrato"** do modal de detalhes de pré-cadastros
  - Contrato só faz sentido após o cliente escolher um plano pago
  - Será acessível depois na área de gerenciamento de ministérios

- **Função `handleGenerateContract`**
  - Geração de contrato será movida para após assinatura

- **Modal de Contrato**
  - Removido do fluxo de pré-cadastros

### ✅ Alterado
- **Botão "Aprovar"** agora redireciona para página de cadastro completo
  - Antes: Simplesmente aprovava o pré-cadastro
  - Depois: Redireciona para `/admin/ministerios` com dados pré-preenchidos

### ✅ Mantido
- **Botão "Credenciais"**
  - Continua gerando credenciais de teste
  - Mantém o email do pré-cadastro
  - Libera 7 dias novos (mesmo que anterior tenha expirado)

---

## 🔄 Novo Fluxo de Conversão

```
1. Lead preenche pré-cadastro no site
   ↓ (dados salvos em pre_registrations)
   ↓
2. Admin vê em /admin/ministerios → Aba "Pré-Cadastros"
   ↓
3. Admin clica "Detalhes"
   ↓
4. Escolhe uma de 2 opções:
   │
   ├─→ Opção A: Testar Sistema (SEM CUSTO)
   │  └─→ Clica "🔑 Credenciais"
   │  └─→ Gera usuário temporário
   │  └─→ 7 dias de acesso ao sistema
   │  └─→ Lead testa
   │  └─→ Volta para atualizar status em /admin/atendimento
   │
   └─→ Opção B: Começar Assinatura (COM CUSTO)
      └─→ Clica "✓ Aprovar"
      └─→ Redireciona para /admin/ministerios
      └─→ Formulário pré-preenchido com dados do lead
      └─→ Admin escolhe plano
      └─→ Cria ministério ativo
      └─→ Começa assinatura paga
      └─→ Acesso imediato (sem teste)
```

---

## 🎯 Mudanças Técnicas

### 1. Botão "Aprovar" Antes
```typescript
// ❌ ANTES: Chamava API simples
const handleApprove = async (preRegId: string) => {
  const response = await fetch('/api/v1/admin/approve-trial', {
    method: 'POST',
    body: JSON.stringify({ pre_registration_id: preRegId, approve: true })
  })
  // Remove da lista
}
```

### 2. Botão "Aprovar" Depois
```typescript
// ✅ DEPOIS: Redireciona com contexto
const handleApprove = async (preRegId: string) => {
  const preReg = signups.find(s => s.id === preRegId)
  
  const params = new URLSearchParams({
    pre_registration_id: preRegId,
    ministry_name: preReg.ministry_name,
    pastor_name: preReg.pastor_name,
    email: preReg.email,
    whatsapp: preReg.whatsapp,
    cpf_cnpj: preReg.cpf_cnpj,
    quantity_temples: preReg.quantity_temples.toString(),
    quantity_members: preReg.quantity_members.toString(),
  })

  // Redireciona para cadastro completo
  window.location.href = `/admin/ministerios?${params.toString()}`
}
```

### 3. Removidos do Componente
```typescript
❌ const [showContractModal, setShowContractModal] = useState(false)
❌ const [generatingContract, setGeneratingContract] = useState(false)
❌ const handleGenerateContract = async () => { ... }
❌ import { FileText } from 'lucide-react'
❌ Modal de contrato (JSX)
```

---

## 📱 Interface Antes vs Depois

### ANTES ❌
```
[Modal de Detalhes]
├── ✓ Aprovar      (aprovava apenas)
├── 🔑 Credenciais (gerava credenciais)
└── 📄 Contrato    (gerava contrato)
```

### DEPOIS ✅
```
[Modal de Detalhes]
├── ✓ Aprovar      (redireciona para cadastro completo)
└── 🔑 Credenciais (gera credenciais com email mantido)
```

---

## 🎯 Próximas Etapas

### Passo 1: Page Ministerios Precisa Receber Parâmetros
A página `/admin/ministerios` precisa ser atualizada para:
- Detectar parâmetros de URL (`pre_registration_id`, `ministry_name`, etc)
- Pré-preencher o formulário com esses dados
- Marcar que é um pré-cadastro sendo convertido

**Arquivo a modificar:** `src/app/admin/ministerios/page.tsx`

**O que fazer:**
```typescript
// No useEffect, detectar parâmetros
const searchParams = useSearchParams()
const preRegistrationId = searchParams.get('pre_registration_id')
const ministryName = searchParams.get('ministry_name')
const pastorName = searchParams.get('pastor_name')
// ... etc

// Pré-preencher formData
if (preRegistrationId) {
  setFormData({
    name: ministryName || '',
    responsible_name: pastorName || '',
    contact_email: searchParams.get('email') || '',
    whatsapp: searchParams.get('whatsapp') || '',
    cnpj: searchParams.get('cpf_cnpj') || '',
    quantity_temples: parseInt(searchParams.get('quantity_temples') || '1'),
    // ... outros campos
  })
}
```

### Passo 2: Após Criar Ministério
- Marcar o pré-cadastro como "convertido"
- Deletar ou arquivar o pré-cadastro
- Redirecionar para dashboard do novo ministério

---

## 📊 Comparação de Funcionalidades

| Funcionalidade | ANTES | DEPOIS |
|---|---|---|
| Aprova pré-cadastro | Via API simples | Via página de cadastro |
| Coleta dados completos | Não | Sim (em /admin/ministerios) |
| Escolhe plano | Não | Sim (em /admin/ministerios) |
| Cria ministério ativo | Não | Sim (ao confirmar formulário) |
| Gera credenciais | Sim | Sim (independente) |
| Gera contrato | Sim | Não (após pagar) |
| Fluxo intuitivo | Parcial | ✅ Completo |

---

## 🧪 Como Testar

### Teste 1: Fluxo de Aprovação
```
1. Abra /admin/ministerios
2. Aba "Pré-Cadastros"
3. Clique "Detalhes" em um pré-cadastro
4. Clique "✓ Aprovar"
5. ✅ Deve redirecionar para /admin/ministerios
6. ✅ Formulário deve estar pré-preenchido
7. ✅ Parâmetros na URL devem aparecer
```

### Teste 2: Fluxo de Credenciais (Mantém Email)
```
1. Gere credenciais uma vez
2. Feche o modal
3. Gere credenciais novamente
4. ✅ Deve funcionar (credencial anterior desativada)
5. ✅ Email mantém-se o mesmo (do pré-cadastro)
6. ✅ 7 dias novos desde agora
```

### Teste 3: URL com Parâmetros
```
http://localhost:3000/admin/ministerios?
pre_registration_id=abc-123&
ministry_name=Igreja%20Teste&
pastor_name=João%20Silva&
email=joao@test.com&
whatsapp=11999999999&
cpf_cnpj=12345678901234&
quantity_temples=2&
quantity_members=50

✅ Todos os campos devem ser pré-preenchidos
```

---

## ✨ Benefícios da Mudança

1. **Fluxo Mais Natural**
   - Lead testa → Admin vê interesse → Começa assinatura

2. **Menos Cliques**
   - Antes: 3 botões para decidir
   - Depois: 2 botões (testar OU assinar)

3. **Melhor UX**
   - Cada botão tem um propósito claro
   - Nenhuma ação confusa

4. **Sem Contrato Prematuro**
   - Contrato só após decidirem pagar
   - Menos paperwork desnecessário

5. **Dados Automáticos**
   - Formulário vem pré-preenchido
   - Admin não digita tudo de novo

---

## 📝 Arquivos Modificados

| Arquivo | Mudanças |
|---------|----------|
| `src/components/TrialSignupsWidget.tsx` | Removido botão contrato, alterado handleApprove |

---

## 🚀 Próximo Passo

**Implementar suporte a parâmetros em `/admin/ministerios`:**
- [Criar tarefa para isto]

---

**Status:** ✅ **Frontend Refatorado**  
**Dependência:** ⏳ Aguardando atualização de `/admin/ministerios` para receber parâmetros
