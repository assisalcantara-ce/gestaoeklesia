# 📱 GUIA VISUAL: Como Usar o Painel de Atendimento

---

## 🎯 Passo 1: Acessar o Painel

```
URL: http://localhost:3000/admin/ministerios

┌─────────────────────────────────────────┐
│ 📊 Ministérios                          │
│                                         │
│ [📋 Ministérios Ativos] [⏳ Pré-Cadastros]
│                                         │
│ Mostrando PRÉ-CADASTROS (Trial)        │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 🔔 Igreja Central                   │ │
│ │ Email: contato@igleja.com.br       │ │
│ │ Período: 7 dias (expires hoje)     │ │
│ │                                     │ │
│ │ [✏️ Detalhes] [👁️ Ver] [📝 Editar] │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 🔔 Ministério da Palavra            │ │
│ │ Email: contato@palavra.com.br      │ │
│ │ Período: 7 dias (expires amanhã)   │ │
│ │                                     │ │
│ │ [✏️ Detalhes] [👁️ Ver] [📝 Editar] │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

## 📝 Passo 2: Clique em "Detalhes"

```
Ao clicar em [✏️ Detalhes] do pré-registro:

┌─────────────────────────────────────────┐
│ [← Voltar] Igreja Central              │
│                                         │
│ TrialSignupsWidget                     │
│ ├─ Status: pending → active            │
│ ├─ Botão: [✏️ Editar] [🔑 Credenciais]│
│ ├─ Botão: [📄 Contrato]                │
│ └─ Botão: [📊 Dados]                   │
│                                         │
│ Informações do Pré-registro            │
│ ├─ Email: contato@igleja.com.br       │
│ ├─ Pastor: Pastor João                │
│ ├─ Templos: 2                         │
│ └─ Membros: 150                       │
│                                         │
│ [← Voltar ao Dashboard]               │
└─────────────────────────────────────────┘
```

---

## 🎯 Passo 3: Clique em "Atualizar Status"

```
Após clicar em [✏️ Atualizar Status]:

Modal abre GRANDE com 8 SEÇÕES:

┌─────────────────────────────────────────────────────┐
│ Atualizar Atendimento                               │
│ Ministério: Igreja Central                          │
│                                                     │
│ ℹ️ INFORMAÇÕES BÁSICAS                             │
│ [Nome Ministério      ] [CPF/CNPJ              ]   │
│ Igreja Central          12.345.678/0001-90         │
│                                                     │
│ 📞 DADOS DE CONTATO                                │
│ [Email                ] [Telefone              ]   │
│ contato@igleja.com.br   (11) 3000-0000            │
│ [WhatsApp             ] [Website               ]   │
│ (11) 98765-4321         https://igleja.com      │
│                                                     │
│ 👨‍💼 RESPONSÁVEL                                      │
│ [Pastor               ] [Responsável Completo]     │
│ Pastor João             João da Silva Santos       │
│                                                     │
│ 📍 ENDEREÇO                                        │
│ [CEP                  ] [Rua               ]       │
│ 01234-567               Rua das Flores            │
│ [Número               ] [Complemento         ]     │
│ 123                     Apto 42                    │
│ [Cidade               ] [Estado            ]      │
│ São Paulo               [SP ▼]                    │
│                                                     │
│ 📊 ESTRUTURA                                       │
│ [Qty Templos] [Qty Membros]                       │
│ [2        ] [150          ]                       │
│                                                     │
│ 📝 INFORMAÇÕES ADICIONAIS                          │
│ [Descrição...]                                     │
│ Ministério focado em educação cristã...           │
│ [Plano         ]                                   │
│ [professional ▼]                                  │
│                                                     │
│ 🎯 STATUS DO ATENDIMENTO                           │
│ [Estágio do Atendimento ▼]                        │
│ ▼ Selecione um status...                          │
│   ❌ Não Atendido                                 │
│   📞 Em Atendimento                               │
│   💰 Orçamento Enviado          ← ESCOLHA          │
│   📄 Gerando Contrato                             │
│   ✅ Finalizado - Positivo                        │
│   ❌ Finalizado - Negativo                        │
│                                                     │
│ ⚡ AÇÕES DISPONÍVEIS  ← APARECE AQ!               │
│ [💰 Gerar Orçamento]                              │
│                                                     │
│ 💬 OBSERVAÇÕES E NOTAS                             │
│ [Anotações...]                                     │
│ Cliente interessado em plano profissional          │
│                                                     │
│ [✕ Cancelar] [💾 Salvar Mudanças]                │
└─────────────────────────────────────────────────────┘
```

---

## 💡 Passo 4: Selecionar Status e Ver Botões

### Cenário 1: Orçamento Enviado

```
┌─────────────────────────────────────────┐
│ 🎯 STATUS DO ATENDIMENTO                │
│ [▼ 💰 Orçamento Enviado]                │
│                                         │
│ ⚡ AÇÕES DISPONÍVEIS                     │
│ ┌─────────────────────────────────────┐ │
│ │ 💰 Gerar Orçamento                  │ │
│ │ (Amarelo, hover mais escuro)        │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 📝 OBSERVAÇÕES                          │
│ [Anotações...]                          │
│                                         │
│ [✕ Cancelar] [💾 Salvar]              │
└─────────────────────────────────────────┘

🖱️ Workflow:
1. Preencha dados se necessário
2. Selecione: "💰 Orçamento Enviado"
3. Clique: "💰 Gerar Orçamento"
4. Alert: "✅ Orçamento enviado para contato@igleja.com.br"
5. Email enviado com PDF do orçamento
```

---

### Cenário 2: Gerando Contrato

```
┌─────────────────────────────────────────┐
│ 🎯 STATUS DO ATENDIMENTO                │
│ [▼ 📄 Gerando Contrato]                 │
│                                         │
│ ⚡ AÇÕES DISPONÍVEIS                     │
│ ┌─────────────────────────────────────┐ │
│ │ 📄 Gerar Contrato                   │ │
│ │ (Laranja, hover mais escuro)        │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [✕ Cancelar] [💾 Salvar]              │
└─────────────────────────────────────────┘

🖱️ Workflow:
1. Preencha dados se necessário
2. Selecione: "📄 Gerando Contrato"
3. Clique: "📄 Gerar Contrato"
4. Alert: "✅ Contrato enviado para contato@igleja.com.br"
5. Email enviado com contrato personalizado
```

---

### Cenário 3: Finalizado - Positivo (Credenciais)

```
┌─────────────────────────────────────────┐
│ 🎯 STATUS DO ATENDIMENTO                │
│ [▼ ✅ Finalizado - Positivo]            │
│                                         │
│ ⚡ AÇÕES DISPONÍVEIS                     │
│ ┌─────────────────────────────────────┐ │
│ │ 🔐 Gerar Credenciais Definitivas    │ │
│ │ (Verde, hover mais escuro)          │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [✕ Cancelar] [💾 Salvar]              │
└─────────────────────────────────────────┘

🖱️ Workflow:
1. Preencha dados se necessário
2. Selecione: "✅ Finalizado - Positivo"
3. Clique: "🔐 Gerar Credenciais Definitivas"
4. Alert exibe:
   ✅ Credenciais DEFINITIVAS geradas!
   Email: ministerio@gestaoeklesia.com
   Senha: senhaGerada123
   Enviadas para: contato@igleja.com.br
5. Ministério agora tem acesso PERMANENTE ao sistema
6. SEM limite de 7 dias (diferente do trial)
```

---

## ✅ Passo 5: Salvar Mudanças

```
Ao clicar em [💾 Salvar Mudanças]:

SISTEMA FAZ:
1. Salva status em: attendance_status
2. Salva notas em: attendance_status
3. Atualiza 20+ campos em: pre_registrations
4. Registra última atualização em: attendance_history
5. Fecha modal automaticamente

VOCÊ VÊ:
┌────────────────────────────────┐
│ ✅ Dados atualizados com sucesso │
│                                │
│ Modal fecha                    │
│ Página retorna ao dashboard    │
└────────────────────────────────┘

DADOS SALVOS:
- ministry_name
- cpf_cnpj
- phone, email, whatsapp, website
- pastor_name, responsible_name
- address_* (7 campos)
- quantity_temples, quantity_members
- description, plan
- status, notes
```

---

## 📊 Resultado Final

```
Dashboard de Atendimento atualizado:

┌─────────────────────────────────────────────┐
│ 🎯 Painel de Atendimento                    │
│                                             │
│ ❌ Não Atendido: 2                          │
│ 📞 Em Atendimento: 3                        │
│ 💰 Orçamento Enviado: 1                     │
│ 📄 Gerando Contrato: 1                      │
│ ✅ Finalizado - Positivo: 1                 │
│ ❌ Finalizado - Negativo: 0                 │
│                                             │
│ [🔍 Buscar...] [📊 Todos os Status ▼]      │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ 📋 Igreja Central                       │ │
│ │ Pastor João | (11) 98765-4321          │ │
│ │ Status: ✅ Finalizado - Positivo       │ │
│ │ Templos: 2 | Membros: 150              │ │
│ │ Último contato: Hoje 15:30             │ │
│ │                                         │ │
│ │ [✏️ Atualizar Status]                  │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

---

## 🎨 Comportamento dos Botões

```
DINÂMICOS - Aparecem/desaparecem conforme status:

❌ Não Atendido
├─ Nenhum botão (apenas salvar)

📞 Em Atendimento
├─ Nenhum botão (apenas salvar)

💰 Orçamento Enviado
├─ 💰 Gerar Orçamento (amarelo)

📄 Gerando Contrato
├─ 📄 Gerar Contrato (laranja)

✅ Finalizado - Positivo
├─ 🔐 Gerar Credenciais Definitivas (verde)

❌ Finalizado - Negativo
├─ Nenhum botão (apenas salvar)
```

---

## 📱 Responsividade

### Desktop (width > 768px)
```
┌────────────────────────────────────────┐
│ Modal com 2 colunas                   │
│ [Campo 1] [Campo 2]                   │
│ [Campo 3] [Campo 4]                   │
│ [Campo 5 - Full Width]                │
└────────────────────────────────────────┘
```

### Mobile (width < 768px)
```
┌──────────────────┐
│ Modal com 1 coluna│
│ [Campo 1]        │
│ [Campo 2]        │
│ [Campo 3]        │
│ [Campo 4]        │
│ [Campo 5]        │
└──────────────────┘
```

---

## 🧪 Teste Rápido (2 minutos)

```
1. Acesse: http://localhost:3000/admin/ministerios
2. Clique em um pré-registro
3. Clique: "Detalhes"
4. Clique: "✏️ Atualizar Status"
5. Selecione: "💰 Orçamento Enviado"
6. Veja o botão amarelo aparecer
7. Clique nele
8. Veja o alert de sucesso
9. Pronto! ✅
```

---

## 🆘 Troubleshooting

### Problema: Modal não abre
**Solução**: Verifique F12 > Console para erros

### Problema: Campos vazios no formulário
**Solução**: 
- Migração não foi aplicada?
- Pré-registro não tem dados?

### Problema: Botões não aparecem
**Solução**:
- Você selecionou os status corretos?
- Verifique o console para erros

### Problema: Erro ao salvar
**Solução**:
- F12 > Network > veja o erro
- Supabase está online?

---

## 📊 Dados que são salvos

```json
{
  "id": "uuid",
  "ministry_name": "Igreja Central",
  "cpf_cnpj": "12.345.678/0001-90",
  "phone": "(11) 3000-0000",
  "email": "contato@igleja.com.br",
  "whatsapp": "(11) 98765-4321",
  "website": "https://igleja.com.br",
  "pastor_name": "Pastor João",
  "responsible_name": "João da Silva Santos",
  "address_zip": "01234-567",
  "address_street": "Rua das Flores",
  "address_number": "123",
  "address_complement": "Apto 42",
  "address_city": "São Paulo",
  "address_state": "SP",
  "quantity_temples": 2,
  "quantity_members": 150,
  "description": "Ministério focado em educação cristã",
  "plan": "professional",
  "status": "finalized_positive"
}
```

---

## ⏱️ Tempo por Ação

| Ação | Tempo |
|------|-------|
| Abrir modal | < 1s |
| Preencher campos | 2-5min |
| Selecionar status | 1s |
| Salvar dados | 1-2s |
| Gerar documento | 3-5s |

---

**Pronto para usar! 🚀**

*Data: 08 de Janeiro de 2026*
