# 🎯 Botões Dinâmicos por Status do Atendimento

## ✅ O que foi implementado

Agora, ao selecionar diferentes status no dropdown "Estágio do Atendimento", botões de ação diferentes aparecem automaticamente:

---

## 📊 Mapeamento de Status → Botão

### 1️⃣ **Status: "💰 Orçamento Enviado"**
**Botão que aparece:** `💰 Gerar Orçamento`

```
Quando o admin escolhe "Orçamento Enviado", um botão amarelo aparece
Ao clicar:
- Gera documento de orçamento
- Envia para o email do ministério
- Confirma com mensagem de sucesso
```

---

### 2️⃣ **Status: "📄 Gerando Contrato"**
**Botão que aparece:** `📄 Gerar Contrato`

```
Quando o admin escolhe "Gerando Contrato", um botão laranja aparece
Ao clicar:
- Gera contrato personalizado
- Envia para o email do ministério
- Confirma com mensagem de sucesso
```

---

### 3️⃣ **Status: "✅ Finalizado - Positivo"**
**Botão que aparece:** `🔐 Gerar Credenciais Definitivas`

```
Quando o admin escolhe "Finalizado - Positivo", um botão verde aparece
Ao clicar:
- Gera credenciais DEFINITIVAS (não são de teste)
- Sem limite de 7 dias
- Acesso permanente ao sistema
- Exibe email e senha
- Envia para o email do ministério
- Confirma com mensagem de sucesso
```

---

## 🎨 Comportamento Visual

```
Modal de Atendimento:

┌─────────────────────────────────────────┐
│ [formulário com 8 seções]               │
│                                         │
│ 🎯 Status do Atendimento                │
│ [Dropdown: Estágio]                     │
│ ▼ Selecione um status...                │
│   ❌ Não Atendido                       │
│   📞 Em Atendimento                     │
│   💰 Orçamento Enviado         ← Escolha
│   📄 Gerando Contrato                   │
│   ✅ Finalizado - Positivo              │
│   ❌ Finalizado - Negativo              │
│                                         │
│ ⚡ Ações Disponíveis  ← APARECE AQUI!  │
│ [💰 Gerar Orçamento]                    │
│                                         │
│ [Cancelar] [Salvar Mudanças]           │
└─────────────────────────────────────────┘
```

---

## 🔄 Fluxo Completo de Uso

### Cenário 1: Enviar Orçamento

```
1. Admin abre modal de atendimento
2. Preenche/atualiza dados do ministério
3. Seleciona status: "💰 Orçamento Enviado"
4. Botão "💰 Gerar Orçamento" aparece
5. Clica no botão
6. Sistema chama API: POST /api/v1/admin/contracts
7. Contrato tipo "budget" é gerado
8. Email enviado para ministério
9. Alert confirma sucesso
10. Admin pode fechar modal ou continuar editando
```

---

### Cenário 2: Enviar Contrato

```
1. Admin abre modal de atendimento
2. Preenche/atualiza dados do ministério
3. Seleciona status: "📄 Gerando Contrato"
4. Botão "📄 Gerar Contrato" aparece
5. Clica no botão
6. Sistema chama API: POST /api/v1/admin/contracts
7. Contrato tipo "contract" é gerado
8. Email enviado para ministério
9. Alert confirma sucesso
10. Admin pode fechar modal ou continuar editando
```

---

### Cenário 3: Ativar Credenciais Definitivas

```
1. Admin abre modal de atendimento
2. Preenche/atualiza dados do ministério
3. Seleciona status: "✅ Finalizado - Positivo"
4. Botão "🔐 Gerar Credenciais Definitivas" aparece
5. Clica no botão
6. Sistema chama API: POST /api/v1/admin/test-credentials
7. Cria user PERMANENTE (não teste!)
8. Gera email e senha
9. Alert exibe credenciais
10. Email enviado para ministério
11. Ministério agora tem acesso completo ao sistema
```

---

## 💻 Implementação Técnica

### Novo Estado (se necessário)
Não foi necessário adicionar novos estados, apenas usar o `modalStatus` existente.

### Novas Funções Criadas

#### 1. `handleGenerateBudget()`
```typescript
- Valida se há pre_registration_id
- Chama POST /api/v1/admin/contracts
- type: 'budget'
- Passa dados: ministry_name, email, plan, etc
- Mostra alert de sucesso/erro
- Recarrega lista de atendimentos
```

#### 2. `handleGenerateContract()`
```typescript
- Valida se há pre_registration_id
- Chama POST /api/v1/admin/contracts
- type: 'contract'
- Passa dados: ministry_name, email, plan, etc
- Mostra alert de sucesso/erro
- Recarrega lista de atendimentos
```

#### 3. `handleGenerateCredentials()`
```typescript
- Valida se há pre_registration_id
- Chama POST /api/v1/admin/test-credentials
- is_permanent: true (credenciais definitivas!)
- trial_days: null (sem limite de teste)
- Passa dados: ministry_name, email, whatsapp
- Exibe email e senha no alert
- Mostra alert de sucesso/erro
- Recarrega lista de atendimentos
```

### Renderização Condicional no JSX

```tsx
{(modalStatus === 'budget_sent' || 
  modalStatus === 'contract_generating' || 
  modalStatus === 'finalized_positive') && (
  <div className="border-t border-gray-200 pt-6">
    <h3>⚡ Ações Disponíveis</h3>
    
    {modalStatus === 'budget_sent' && (
      <button onClick={handleGenerateBudget}>
        💰 Gerar Orçamento
      </button>
    )}
    
    {modalStatus === 'contract_generating' && (
      <button onClick={handleGenerateContract}>
        📄 Gerar Contrato
      </button>
    )}
    
    {modalStatus === 'finalized_positive' && (
      <button onClick={handleGenerateCredentials}>
        🔐 Gerar Credenciais Definitivas
      </button>
    )}
  </div>
)}
```

---

## 🎨 Cores dos Botões

| Status | Botão | Cor | Hover |
|--------|-------|-----|-------|
| Orçamento Enviado | 💰 Gerar Orçamento | Amarelo (yellow-500) | yellow-600 |
| Gerando Contrato | 📄 Gerar Contrato | Laranja (orange-500) | orange-600 |
| Finalizado Positivo | 🔐 Credenciais | Verde (green-600) | green-700 |

---

## 📡 APIs Chamadas

### POST `/api/v1/admin/contracts`
```json
Request:
{
  "pre_registration_id": "uuid",
  "type": "budget|contract",
  "ministry_name": "Igreja XYZ",
  "pastor_name": "Pastor João",
  "email": "contato@ministerio.com",
  "quantity_temples": 3,
  "quantity_members": 250,
  "plan": "professional"
}

Response (Success):
{
  "success": true,
  "data": {
    "id": "uuid",
    "type": "budget|contract",
    "status": "generated",
    "sent_to": "contato@ministerio.com"
  }
}
```

### POST `/api/v1/admin/test-credentials`
```json
Request:
{
  "pre_registration_id": "uuid",
  "ministry_name": "Igreja XYZ",
  "email": "contato@ministerio.com",
  "whatsapp": "(11) 99999-9999",
  "is_permanent": true,
  "trial_days": null
}

Response (Success):
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "ministério@gestaoeklesia.com",
    "password": "senhaGerada123",
    "is_permanent": true,
    "sent_to": "contato@ministerio.com"
  }
}
```

---

## ✨ Características Principais

✅ **Renderização Dinâmica**
- Botões aparecem/desaparecem conforme status selecionado

✅ **Feedback Visual**
- Cores diferentes para cada ação
- Emojis informativos
- Estados hover claros

✅ **Validação**
- Verifica se pre_registration_id existe
- Trata erros de API

✅ **User Experience**
- Alerts com mensagens claras
- Recarrega dados automaticamente
- Modal permanece aberto se desejado

✅ **Segurança**
- Credenciais definitivas distintas de teste
- trial_days=null para acesso permanente
- Validações em ambos os lados

---

## 🧪 Como Testar

### Teste 1: Gerar Orçamento
```
1. /admin/ministerios > Pré-Cadastros > Detalhes > Atualizar Status
2. Selecione: "💰 Orçamento Enviado"
3. Veja o botão "💰 Gerar Orçamento" aparecer
4. Clique nele
5. Verifique alert de sucesso
6. Verifique email enviado (ou log de API)
```

### Teste 2: Gerar Contrato
```
1. /admin/ministerios > Pré-Cadastros > Detalhes > Atualizar Status
2. Selecione: "📄 Gerando Contrato"
3. Veja o botão "📄 Gerar Contrato" aparecer
4. Clique nele
5. Verifique alert de sucesso
6. Verifique email enviado (ou log de API)
```

### Teste 3: Ativar Credenciais Definitivas
```
1. /admin/ministerios > Pré-Cadastros > Detalhes > Atualizar Status
2. Selecione: "✅ Finalizado - Positivo"
3. Veja o botão "🔐 Gerar Credenciais Definitivas" aparecer
4. Clique nele
5. Alert exibe email e senha
6. Tente fazer login com essas credenciais
7. Acesso deve ser permanente (sem expiração de trial)
```

---

## 📋 Dados que os Botões Enviam

Todos os botões enviam os dados preenchidos no formulário:

```javascript
{
  ministry_name: editingData.ministry_name,
  pastor_name: editingData.pastor_name,
  email: editingData.email,
  whatsapp: editingData.whatsapp,
  quantity_temples: editingData.quantity_temples,
  quantity_members: editingData.quantity_members,
  plan: editingData.plan
}
```

Isso garante que os documentos/credenciais geradas têm todos os dados corretos.

---

## 🔮 Próximas Melhorias

1. ⏳ Adicionar loading/spinner enquanto gera
2. ⏳ Mostrar preview do documento antes de enviar
3. ⏳ Histórico de documentos/credenciais gerados
4. ⏳ Resend: reenviar documento/credenciais
5. ⏳ Integração com WhatsApp (enviar via WA)

---

## 👤 Implementação

**Data**: 08 de Janeiro de 2026
**Versão**: 1.0
**Arquivo**: `src/app/admin/atendimento/page.tsx`
**Linhas**: +3 handlers + ~50 linhas de JSX
