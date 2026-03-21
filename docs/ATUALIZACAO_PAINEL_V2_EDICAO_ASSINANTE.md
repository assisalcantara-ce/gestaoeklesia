# 📋 Atualização: Painel de Atendimento v2 - Edição de Dados do Assinante

## 🎯 Mudanças Implementadas (8 de Janeiro de 2026)

### 1. **Modal Expandido com Campos Editáveis**
O modal de atendimento agora permite editar dados do assinante diretamente:

**Campos Editáveis:**
- ✏️ Nome do Ministério
- ✏️ Nome do Pastor
- ✏️ Email
- ✏️ WhatsApp
- ✏️ Quantidade de Templos
- ✏️ Quantidade de Membros

**Campos Não-Editáveis (no modal):**
- Status (dropdown com 6 opções)
- Observações (textarea)

### 2. **Nova Rota API: PUT /api/v1/admin/pre-registrations**

Endpoint para atualizar dados do pré-registro:

```bash
PUT /api/v1/admin/pre-registrations
Content-Type: application/json

{
  "id": "uuid-do-registro",
  "ministry_name": "Novo Nome",
  "pastor_name": "Novo Pastor",
  "email": "novo@email.com",
  "whatsapp": "+55 11 99999-9999",
  "quantity_temples": 5,
  "quantity_members": 150
}
```

**Resposta de Sucesso:**
```json
{
  "success": true,
  "data": { /* pre_registration atualizado */ },
  "meta": { "updated_at": "2026-01-08T10:30:00Z" }
}
```

### 3. **Atualização Automática Dupla**
Quando você clica em "Salvar Mudanças":

1. **Primeiro**: Atualiza o `attendance_status` com novo status e observações
2. **Depois**: Atualiza o `pre_registrations` com novos dados do assinante

Se a primeira atualização falhar, a segunda não é executada (validação).

### 4. **Histórico de Mudanças Preservado**
Cada mudança de status é registrada automaticamente em `attendance_history` com:
- Data/hora exata
- Usuário que fez a mudança
- Status antigo → novo status
- Observações

## 🔄 Fluxo Completo da Aprovação

```
1. Admin vê pré-cadastro em TrialSignupsWidget
                ↓
2. Clica em "Aprovar"
                ↓
3. Sistema chama POST /api/v1/admin/attendance/init
                ↓
4. Cria registro em attendance_status com status = 'in_progress'
                ↓
5. Redireciona para /admin/atendimento?focus={preRegId}
                ↓
6. Dashboard carrega e auto-abre modal do registro
                ↓
7. Admin pode editar dados do assinante e mudar status
                ↓
8. Clica "Salvar Mudanças"
                ↓
9. Ambas as tabelas são atualizadas (attendance_status + pre_registrations)
                ↓
10. Modal fecha e dashboard recarrega com dados novos
```

## 📊 Estrutura do Modal Expandido

```
┌─────────────────────────────────────┐
│ Atualizar Atendimento: [Nome]       │
├─────────────────────────────────────┤
│ 📋 DADOS DO ASSINANTE               │
│ [input] Nome do Ministério          │
│ [input] Nome do Pastor              │
│ [input] Email                       │
│ [input] WhatsApp                    │
│ [input] Qty Templos [input] Qty Membros │
├─────────────────────────────────────┤
│ [dropdown] Status                   │
│ [textarea] Observações              │
├─────────────────────────────────────┤
│ [Cancelar]  [💾 Salvar Mudanças]    │
└─────────────────────────────────────┘
```

## 🛠️ Arquivos Modificados

1. **`src/app/admin/atendimento/page.tsx`**
   - Added: `editingData` state
   - Updated: `handleOpenModal()` para carregar dados do assinante
   - Updated: `handleUpdateAttendance()` para fazer dupla atualização
   - Updated: Modal JSX com 6 campos editáveis

2. **`src/app/api/v1/admin/pre-registrations/route.ts`** (NOVO)
   - Endpoint PUT para atualizar dados do pré-registro
   - Valida presença do `id`
   - Atualiza apenas campos fornecidos

## ✅ Checklist de Testes

- [ ] Aprovar um pré-cadastro (verifica criação em attendance_status)
- [ ] Dashboard redireciona com focus automático
- [ ] Modal abre automaticamente no novo registro
- [ ] Editar nome do ministério e clicar "Salvar"
- [ ] Verificar que dados foram atualizados em pre_registrations
- [ ] Mudar status para "📞 Em Atendimento"
- [ ] Adicionar observação e salvar
- [ ] Verificar que attendance_history tem novo registro
- [ ] Fechar e reabrir modal - dados devem estar salvos

## 📝 Observações Técnicas

### Delay de Auto-Focus
O modal auto-abre com um setTimeout de 500ms para garantir que os dados estejam carregados antes de abrir:

```typescript
setTimeout(() => {
  handleOpenModal(focusedAttendance);
}, 500);
```

### Validação na Atualização
Se a atualização do attendance_status falhar, a atualização do pré-registro não é executada:

```typescript
if (!attendanceResult.success) {
  alert('Erro ao atualizar: ' + attendanceResult.error);
  return; // ← Para aqui
}
```

### Estado Editável vs Display
O `editingData` mantém uma cópia dos dados originais que podem ser modificados sem afetar o display até salvar.

## 🚀 Próximas Melhorias Planejadas

1. **Visualizar Histórico Completo**
   - Nova aba no modal mostrando todas as mudanças de status
   - Timeline visual com datas e responsáveis

2. **Automação de Mensagens**
   - Enviar email automático ao mudar status
   - Enviar WhatsApp com atualizações

3. **Campos Adicionais**
   - Endereço completo (rua, cidade, estado)
   - Telefone alternativo
   - Data de visita/reunião agendada

4. **Impressão de Ficha**
   - Gerar PDF com dados atualizados
   - Incluir histórico de atendimento

## 🔧 Debugging

Se o modal não salvar os dados:

1. Abrir DevTools (F12)
2. Ir para Network tab
3. Tentar salvar e verificar requisição PUT
4. Procurar por erros 400/500 nas respostas

Logs estão disponíveis em:
- `console.error()` no navegador
- Logs do servidor Next.js
- Supabase dashboard → Logs

## 📞 Suporte

Qualquer dúvida sobre o novo fluxo, consulte:
- `cursor/docs/PAINEL_ATENDIMENTO_COMPLETO.md`
- `cursor/rules/ATTENDANCE_API_REFERENCE.md`
