# Padrões de Código e Qualidade

## 📌 1. Integridade de Tipos com TypeScript

- Sempre mantenha os tipos atualizados em `src/types/admin.ts` e `src/types/supabase.ts`.
- Evite o uso de `any` explícito quando a interface formal já existir no sistema.
- Execute a verificação `npx tsc --noEmit` antes de realizar commits.

---

## 📜 2. Registro Obrigatorio de Auditoria (`admin_audit_logs`)

Toda ação administrativa de mutação crítica (cancelamento de cobranças, regeneração em lote, envio de faturas por WhatsApp, alteração de status) DEVE gravar um registro estruturado na tabela `admin_audit_logs`:

```typescript
await supabase.from('admin_audit_logs').insert([
  {
    action: 'nome_da_acao',
    entity_type: 'tabela_afetada',
    entity_id: entityId,
    changes: {
      operator: user.email,
      cliente: ministryName,
      data_hora: new Date().toISOString(),
      detalhes: payload,
    },
    status: 'success',
  },
])
```

---

## 🚫 3. Proibição de Mascaramento de Erros

- NUNCA silencie exceções com blocos `try/catch` vazios em rotas de mutação sem registrar a causa raiz.
- Sempre retorne mensagens de erro amigáveis ao usuário via interface sem derrubar o componente.
- Em builds de produção, confirme a ausência de warnings graves e valide com `npm run build`.
