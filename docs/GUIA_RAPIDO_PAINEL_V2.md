# 🚀 Guia Rápido: Usar o Painel de Atendimento v2

## Para o Admin (Você)

### Passo 1: Aprovar um Pré-Cadastro
1. Abra `/admin/` (dashboard de widgets)
2. Em "Pré-Cadastros Pendentes", clique em **"Aprovar"**
3. Sistema redireciona automaticamente para `/admin/atendimento`
4. Modal se abre automaticamente mostrando o novo registro

### Passo 2: Completar Dados do Assinante
No modal que abrir, você verá:
- **Nome do Ministério** (pode editar)
- **Nome do Pastor** (pode editar)
- **Email** (pode editar)
- **WhatsApp** (pode editar)
- **Quantidade de Templos** (pode editar - número)
- **Quantidade de Membros** (pode editar - número)

Se algum dado estiver errado ou incompleto, **edite agora**.

### Passo 3: Atualizar Status
No mesmo modal:
1. Selecione o status apropriado no dropdown:
   - ❌ Não Atendido
   - 📞 Em Atendimento
   - 💰 Orçamento Enviado
   - 📄 Gerando Contrato
   - ✅ Finalizado - Positivo
   - ❌ Finalizado - Negativo

2. Adicione observações (opcional):
   - "Cliente aguardando orçamento"
   - "Respondeu positivamente"
   - "Pediu para ligar depois"

### Passo 4: Salvar
Clique em **"💾 Salvar Mudanças"**

Sistema fará automaticamente:
1. ✅ Atualizar dados do assinante em `pre_registrations`
2. ✅ Atualizar status em `attendance_status`
3. ✅ Registrar mudança em `attendance_history` (com data/hora)
4. ✅ Recarregar dashboard
5. ✅ Fechar modal

## Status Guia Rápido

| Status | Significado | Próximo Passo |
|--------|------------|---------------|
| ❌ Não Atendido | Não conseguiu contato | Tentar novamente |
| 📞 Em Atendimento | Conversando/enviando info | Atualizar para próx status |
| 💰 Orçamento Enviado | Enviou proposta/preço | Aguardar resposta |
| 📄 Gerando Contrato | Preparando contrato | Enviar contrato |
| ✅ Finalizado - Positivo | Cliente fechou | Próximo de levar pra produção |
| ❌ Finalizado - Negativo | Cliente recusou | Arquivo/revisão |

## Botões Adicionais (Não Implementados em v1, mas prontos)

- 🎫 **Gerar Credenciais**: Criar usuário temporário para teste
- 📜 **Gerar Contrato**: Criar contrato HTML/PDF
- 🔍 **Detalhes**: Ver tudo que foi registrado

(Esses botões estão em TrialSignupsWidget, ainda não integrados ao painel principal)

## Como Saber se Funcionou

### ✅ Tudo OK:
1. Modal fechou
2. Dashboard recarregou
3. O registro aparece no status selecionado
4. Dados do assinante foram atualizados

### ❌ Deu Erro:
1. Você vê mensagem: "Erro ao atualizar: [motivo]"
2. Modal continua aberto
3. Nada foi salvo
4. Tente novamente

## Dicas

- 💡 **Sempre preencha email/WhatsApp**: Precisará para contato posterior
- 💡 **Atualize status conforme progride**: Para não perder rastreabilidade
- 💡 **Adicione observações úteis**: Ajudam na memória quando voltar
- 💡 **Números realistas**: Templos e membros devem ser quantidade real

## Próximas Funcionalidades Planejadas

- 📧 Auto-enviar emails ao mudar status
- 💬 Auto-enviar WhatsApp com updates
- 📊 Relatório visual de progresso
- 🔔 Notificação ao deixar task pendente

## Troubleshooting

**P: Modal não abre automaticamente após aprovar?**
A: Recarregue a página manualmente (`F5`) ou clique no card do registro.

**P: Dados não salvam?**
A: Verifique F12 → Console para erros. Certifique-se de que:
- Email tem formato válido (example@email.com)
- Números são inteiros positivos
- Não há campos vazios que sejam obrigatórios

**P: Como vejo o histórico de mudanças?**
A: Cada mudança é registrada em `attendance_history`. Relatório visual em desenvolvimento.

---

**Versão**: 2.0 (8 de Janeiro 2026)
**Última Atualização**: Adição de edição de dados do assinante
