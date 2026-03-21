# 🚀 GUIA PRÁTICO - PAINEL DE ATENDIMENTO

## ⚡ Quick Start (5 minutos)

### Passo 1: Copiar arquivo de migração
```
De: supabase/migrations/20260105_attendance_management_schema.sql
Para: Seu banco Supabase (painel → SQL Editor)
Executar: Ctrl+Enter ou clique em "RUN"
```

### Passo 2: Verificar criação das tabelas
```
No painel Supabase:
Home → Tabelas → Procure por:
✓ attendance_status
✓ attendance_history
✓ test_credentials
✓ generated_contracts
```

### Passo 3: Acessar o painel
```
URL: http://localhost:3000/admin/atendimento
Login: Sua conta admin
```

### Passo 4: Testar fluxo completo
Veja seção "Teste Prático" abaixo ↓

---

## 🧪 Teste Prático (10 minutos)

### Cenário: Você é um gerenciador de vendas

#### 1. Vá para a lista de pré-cadastros
```
URL: http://localhost:3000/admin/ministerios
Aba: "Pré-Cadastros"
```

#### 2. Encontre um pré-cadastro pendente
```
Procure por status "Pendente" (laranja)
Coluna "Ações" → Botão "Detalhes"
```

#### 3. Abra o modal de detalhes
```
Vê informações:
✓ Nome do ministério
✓ Pastor
✓ Email / WhatsApp
✓ Quantidade de templos
✓ Quantidade de membros
✓ Status atual
```

#### 4. Aprove o pré-cadastro (opcional)
```
Clique em "Aprovar"
Status muda de "Pendente" para "Aprovado"
```

#### 5. Gere credenciais de teste
```
Clique em "🔑 Credenciais"
Modal abre com opção "Gerar"
Clique em "Gerar"
⏳ Aguarde processamento
```

#### 6. Copie as credenciais
```
Três campos aparecem:
1. Usuário (Clique 📋 para copiar)
2. Senha (Clique 📋 para copiar)
3. URL de Acesso (Clique 📋 para copiar)
```

#### 7. Compartilhe com o lead
```
Via WhatsApp:
"Olá! Suas credenciais de teste:
User: test_1234567890
Senha: a7x3k9p2q8v1
URL: https://app.com/auth/login
Válido até: 12/01/2026"
```

#### 8. Gere um contrato
```
Volte ao modal de detalhes
Clique em "📄 Contrato"
Confirme na janela
⏳ Novo documento abre em aba nova
```

#### 9. Veja o contrato
```
✓ Dados do cliente preenchidos
✓ Plano e preços
✓ Termos de serviço
✓ Espaço para assinatura
```

#### 10. Imprima ou salve como PDF
```
Pressione Ctrl+P
Escolha impressora ou "Salvar como PDF"
Salve com nome: "CT-202601-XXX - [Nome].pdf"
```

#### 11. Atualize status no painel
```
URL: http://localhost:3000/admin/atendimento
Encontre o lead
Clique "✏️ Atualizar Status"
Mude para: "💰 Orçamento Enviado"
Adicione nota: "Contrato enviado via email"
Clique "💾 Salvar Mudanças"
```

#### 12. Veja dashboard
```
Card no topo mostra atualizações:
"Orçamento Enviado: 1" (aumentou)
"Não Atendido" (diminuiu)
```

---

## 🎮 Guia de Interface

### Painel Principal (/admin/atendimento)

#### Top - Estatísticas
```
┌─────────────────────────────────────┐
│ ❌ 3  │  📞 5  │  💰 2  │  📄 1   │
│ ✅ 8  │  ❌ 2  │  Total: 21        │
└─────────────────────────────────────┘
```

#### Busca
```
🔍 "Buscar por ministério, pastor..."
- Tempo real
- Busca em 4 campos
- Case-insensitive
```

#### Filtro por Status
```
📊 Dropdown:
├─ Todos (padrão)
├─ ❌ Não Atendido
├─ 📞 Em Atendimento
├─ 💰 Orçamento Enviado
├─ 📄 Gerando Contrato
├─ ✅ Finalizado - Positivo
└─ ❌ Finalizado - Negativo
```

#### Cards de Lead
```
┌──────────────────────────────────┐
│ Igreja Pentecostal do Bairro  [📞]│
│ Pastor: João Silva              │
│                                  │
│ Email: joao@example.com         │
│ WhatsApp: 85988887777           │
│ Templos: 3  │  Membros: 450     │
│                                  │
│ Observações:                    │
│ "Cliente muito interessado..."  │
│                                  │
│ Último contato: 05/01/2026     │
│ [✏️ Atualizar Status]           │
└──────────────────────────────────┘
```

#### Modal de Atualização
```
┌─────────────────────────────────┐
│ Atualizar Atendimento           │
├─────────────────────────────────┤
│ Status:                         │
│ [📞 Em Atendimento          ▼] │
│                                 │
│ Observações:                    │
│ [________________]  (textarea)  │
│                                 │
│ [Cancelar]  [💾 Salvar]       │
└─────────────────────────────────┘
```

---

## 🎯 Atalhos Rápidos

| Ação | Atalho |
|------|--------|
| Abrir painel | `/admin/atendimento` |
| Pré-cadastros | `/admin/ministerios` (aba 2) |
| Login | `/admin/login` |
| Voltar ao início | `/` |
| Abrir dev tools | `F12` |
| Buscar na página | `Ctrl+F` |
| Imprimir | `Ctrl+P` |
| Copiar | `Ctrl+C` |
| Colar | `Ctrl+V` |

---

## 🔧 Troubleshooting

### ❌ Erro: "Não encontrado" ao acessar /admin/atendimento
```
Solução:
1. Verifique se está logado em /admin/login
2. Verifique se é usuário admin
3. Limpe cache: Ctrl+Shift+Delete
4. Reinicie navegador
```

### ❌ Erro: "Erro ao conectar com servidor"
```
Solução:
1. Verifique se servidor está rodando: npm run dev
2. Verifique console (F12) para erros
3. Veja logs do servidor no terminal
4. Reinicie servidor: Ctrl+C, depois npm run dev
```

### ❌ Credenciais não foram geradas
```
Solução:
1. Verifique SUPABASE_SERVICE_ROLE_KEY está configurada
2. Verifique se pre_registration_id é válido
3. Veja logs de erro no F12
4. Tente novamente em 30 segundos
```

### ❌ Contrato aparece em branco
```
Solução:
1. Aguarde carregamento (⏳ pode demorar)
2. Atualize página (F5)
3. Verifique se tem bloqueador de pop-ups
4. Abra dev tools (F12) → aba Console → procure erros
```

### ❌ Status não atualiza
```
Solução:
1. Atualize página (F5)
2. Aguarde 3 segundos após salvar
3. Verifique se clicou em "Salvar"
4. Veja console para erros
5. Tente status diferente
```

---

## 📊 Dados de Teste

Se quiser testar com dados fictícios:

### Lead 1: Igreja Batista
```
Ministério: Igreja Batista Central
Pastor: João Silva
Email: joao@batista.com
WhatsApp: 85988881111
CPF: 111.222.333-44
Templos: 2
Membros: 350
```

### Lead 2: Assembleia de Deus
```
Ministério: Assembleia de Deus Brasil
Pastor: Maria Santos
Email: maria@assemblepeia.com
WhatsApp: 85988882222
CPF: 555.666.777-88
Templos: 5
Membros: 800
```

### Lead 3: Igreja Evangélica
```
Ministério: Igreja Evangélica da Graça
Pastor: Pedro Oliveira
Email: pedro@graca.com
WhatsApp: 85988883333
CPF: 999.000.111-22
Templos: 1
Membros: 150
```

---

## 💡 Dicas Profissionais

### 📞 Ao gerar credenciais
```
✓ Gere IMEDIATAMENTE após aprovação
✓ Compartilhe via WhatsApp (mais rápido)
✓ Acompanhe acesso (dá feedback se lead entrou)
✓ Renove se expirar (click no botão novamente)
```

### 📄 Ao gerar contrato
```
✓ Revise dados antes de enviar
✓ Imprima e guarde cópia em PDF
✓ Envie sempre em nome de quem assina
✓ Deixe espaço claro para assinatura
✓ Guarde registro da data de envio
```

### 🎯 Ao atualizar status
```
✓ SEMPRE adicione observação
✓ Registre data/hora do contato
✓ Anote próximo follow-up
✓ Documente motivos de rejeição
✓ Acompanhe tendências
```

### 📊 Análise
```
✓ Contadores no topo são KPIs
✓ Taxa conversão = Positivos / Total
✓ Tempo médio = (Mais recente - Mais antigo) / Total
✓ Estrangulamento = Onde mais fica preso
```

---

## 🔒 Segurança

### Nunca compartilhe:
```
❌ Senhas de admin
❌ SERVICE_ROLE_KEY
❌ SUPABASE_URL privada
❌ Credenciais do banco
```

### Sempre:
```
✅ Use HTTPS em produção
✅ Altere senha padrão
✅ Guarde credenciais de teste
✅ Revise contratos antes de enviar
✅ Mantenha backup de documentos
```

---

## 📈 Métricas para Acompanhar

```
📊 Taxa de Conversão
= (Finalizados Positivos / Total Leads) × 100
Meta: > 25%

⏱️ Tempo Médio de Atendimento
= (Última atualização - Criação) em dias
Meta: < 7 dias

📞 Taxa de Contato
= (Em Atendimento + Adiante / Total) × 100
Meta: > 80%

💰 Valor Médio
= (Total faturado / Conversões) em R$
Meta: > R$ 150/mês
```

---

## 🎓 Próximas Aulas

1. **Integração WhatsApp** - Envio automático de credenciais
2. **Emails Automáticos** - Templates e campaigning
3. **Analytics Avançada** - Gráficos e relatórios
4. **Assinatura Eletrônica** - Contratos assinados online
5. **CRM Integration** - Sincronizar com outras plataformas

---

## 📞 Suporte

Problemas? Verifique:
1. `cursor/docs/PAINEL_ATENDIMENTO_COMPLETO.md` - Documentação técnica
2. `PAINEL_ATENDIMENTO_RESUMO.md` - Visão geral
3. Console F12 - Erros JavaScript
4. Terminal - Logs do servidor
5. Painel Supabase - Logs de banco

---

**Status: PRONTO PARA USAR ✅**

Comece agora em: `http://localhost:3000/admin/atendimento`
