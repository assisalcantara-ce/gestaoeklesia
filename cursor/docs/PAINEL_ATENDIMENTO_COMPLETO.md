# 🎯 Painel de Atendimento - Documentação

## 📋 Visão Geral

O Painel de Atendimento é um sistema completo de gerenciamento de leads e conversão de novos assinantes no GestãoEklesia. Permite rastrear o status de cada pré-cadastro através do funil de vendas, gerando credenciais de teste e contratos.

## 🗂️ Estrutura de Arquivos

### Tabelas de Banco de Dados
```
supabase/migrations/20260105_attendance_management_schema.sql
├── attendance_status         → Status atual de cada lead
├── attendance_history        → Histórico de mudanças
├── test_credentials          → Credenciais de teste geradas
└── generated_contracts       → Contratos armazenados
```

### APIs
```
src/app/api/v1/admin/
├── attendance/route.ts       → GET/POST/PUT para atendimentos
├── test-credentials/route.ts → POST para gerar credenciais
└── contracts/route.ts        → POST para gerar contratos
```

### Frontend
```
src/app/admin/
├── atendimento/page.tsx      → 🆕 Painel visual de atendimento
└── ministerios/page.tsx       → Widget atualizado com novos botões

src/components/
└── TrialSignupsWidget.tsx     → ✨ Melhorado com modais
```

## 🔄 Fluxo de Atendimento

### 6 Estados do Atendimento

1. **❌ Não Atendido** (`not_contacted`)
   - Lead acabou de chegar
   - Nenhum contato feito ainda

2. **📞 Em Atendimento** (`in_progress`)
   - Contato inicial realizado
   - Discutindo necessidades

3. **💰 Orçamento Enviado** (`budget_sent`)
   - Orçamento foi compartilhado
   - Aguardando resposta

4. **📄 Gerando Contrato** (`contract_generating`)
   - Contrato sendo preparado
   - Pronto para assinatura

5. **✅ Finalizado - Positivo** (`finalized_positive`)
   - Conversão bem-sucedida
   - Novo assinante ativo

6. **❌ Finalizado - Negativo** (`finalized_negative`)
   - Lead descartado
   - Sem interesse ou indisponível

## 🎮 Como Usar

### Acessar o Painel
```
Navegue até: /admin/atendimento
```

### 1️⃣ Visualizar Leads
- Lista todos os pré-cadastros com status atual
- Cards mostram informações principais:
  - Nome do ministério
  - Pastor responsável
  - Email e WhatsApp
  - Quantidade de templos e membros
  - Último contato registrado

### 2️⃣ Filtrar por Status
```
📊 Todos os Status        (Padrão)
❌ Não Atendido
📞 Em Atendimento
💰 Orçamento Enviado
📄 Gerando Contrato
✅ Finalizado - Positivo
❌ Finalizado - Negativo
```

### 3️⃣ Buscar Leads
- Busca por ministério, pastor, email ou WhatsApp
- Tempo real

### 4️⃣ Atualizar Status
- Clique em "✏️ Atualizar Status" em qualquer card
- Modal mostra:
  - Seletor de novo status
  - Campo para observações
- Histórico é salvo automaticamente

## 🔑 Gerar Credenciais de Teste

### No Widget (Pré-Cadastros)
1. Vá para `/admin/ministerios`
2. Encontre o pré-cadastro na seção "Pré-Cadastros"
3. Clique em "Detalhes"
4. Clique em "🔑 Credenciais"
5. Confirme geração

### O que é gerado:
```
✓ Usuário único (test_TIMESTAMP)
✓ Senha aleatória de 12 caracteres
✓ Ministério temporário com 7 dias de acesso
✓ Acesso completo ao sistema
✓ 1GB de armazenamento
```

### Compartilhar com Lead:
```
Usuário:    test_1234567890
Senha:      a7x3k9p2q8v1
URL:        https://seuapp.com/auth/login
Válido até: 12/01/2026
```

## 📄 Gerar Contrato

### Processo
1. Vá para `/admin/ministerios`
2. Encontre o pré-cadastro
3. Clique em "Detalhes"
4. Clique em "📄 Contrato"
5. Confirme geração

### Contrato inclui:
```
✓ Dados do cliente (ministério, pastor, CPF/CNPJ)
✓ Quantidade de templos e membros
✓ Plano contratado
✓ Preço mensal
✓ Período de teste (7 dias)
✓ Termos de serviço completos
✓ Assinaturas (prestadora + cliente)
```

### Ações possíveis:
- 📰 Imprimir contrato
- 💾 Salvar como PDF
- ✉️ Enviar por email
- ✍️ Assinar eletronicamente (futuro)

## 📊 Estatísticas

O painel mostra contadores em tempo real:
```
❌ Não Atendido       3
📞 Em Atendimento     5
💰 Orçamento          2
📄 Contrato           1
✅ Positivos          8
❌ Negativos          2
```

## 🔗 APIs Disponíveis

### GET /api/v1/admin/attendance
Listar atendimentos com filtros
```bash
curl "http://localhost:3000/api/v1/admin/attendance?status=in_progress&page=1&limit=10"
```

Retorna:
```json
{
  "success": true,
  "data": [{
    "id": "uuid",
    "status": "in_progress",
    "notes": "...",
    "last_contact_at": "2026-01-05T10:30:00Z",
    "pre_registration": { ... },
    "attendance_history": [ ... ]
  }],
  "meta": { "total": 10, "page": 1, "limit": 10 }
}
```

### PUT /api/v1/admin/attendance
Atualizar status de atendimento
```json
{
  "id": "attendance-uuid",
  "status": "budget_sent",
  "notes": "Orçamento enviado via email",
  "last_contact_at": "2026-01-05T10:30:00Z"
}
```

### POST /api/v1/admin/test-credentials
Gerar credenciais de teste
```json
{
  "pre_registration_id": "uuid",
  "email": "pastor@example.com"
}
```

Retorna:
```json
{
  "success": true,
  "data": {
    "username": "test_1704462600",
    "password": "a7x3k9p2q8v1",
    "email": "test_1704462600@test.local",
    "access_url": "https://app.com/auth/login",
    "expires_at": "2026-01-12T10:30:00Z"
  }
}
```

### POST /api/v1/admin/contracts
Gerar contrato
```json
{
  "pre_registration_id": "uuid",
  "plan_name": "Plano Professional",
  "monthly_price": "R$ 199,90",
  "trial_days": 7
}
```

Retorna:
```json
{
  "success": true,
  "data": {
    "id": "contract-uuid",
    "contract_number": "CT-202601-123456ABC",
    "status": "draft",
    "html_content": "...",
    "download_url": "/api/v1/admin/contracts/uuid/download"
  }
}
```

## 🔐 Segurança

- ✅ Apenas admins podem acessar o painel
- ✅ RLS policies garantem isolamento de dados
- ✅ Senhas de teste são criptografadas em base64
- ✅ Histórico completo de mudanças
- ✅ Credenciais expiram após 7 dias

## 📈 Próximas Melhorias

- [ ] Integração com WhatsApp para envio automático de credenciais
- [ ] Email automático com contrato e credenciais
- [ ] Assinatura eletrônica de contratos
- [ ] Analytics e funil de conversão visual
- [ ] Lembretes automáticos de follow-up
- [ ] Atribuição de atendentes
- [ ] Templates customizáveis de contrato

## 🐛 Troubleshooting

### Erro ao gerar credenciais
**Problema:** "Erro ao criar usuário de teste"
**Solução:** Verifique se a SERVICE_ROLE_KEY está configurada corretamente

### Contrato não aparece
**Problema:** Página em branco ao tentar abrir contrato
**Solução:** Verifique o console do navegador (F12) para erros

### Status não atualiza
**Problema:** Mudança de status não reflete na lista
**Solução:** Atualize a página (F5) ou aguarde poucos segundos

## 📞 Suporte

Para dúvidas ou problemas, verifique:
1. Logs do servidor no terminal
2. Console do navegador (F12)
3. Painel Supabase para erros de RLS
