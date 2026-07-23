# REGRA 03 — Consultas ao Banco & Integridade do Schema

## 📌 Diretrizes Principais

1. **Validação Estrita de Colunas:** Nunca incluir colunas em seleções SQL ou PostgREST/Supabase que não pertençam ao schema oficial da tabela.
2. **Consultas Relacionais Seguras:** Ao realizar junções relacionais (ex: `.select('..., ministries(name, phone)')`), certifique-se de que cada coluna especificada existe na tabela relacionada.
3. **Gerenciamento de Schema Cache:** Após aplicar novas migrations de banco, reinicie ou recarregue o Schema Cache do Supabase/PostgREST para evitar desencontros na API REST.

---

## 🚫 Prevenção contra Erros PGRST200 e HTTP 400

O PostgREST (camada de API REST do Supabase) retorna o erro `PGRST200` (*Could not find column in schema cache*) e responde com status HTTP 400 Bad Request sempre que uma consulta solicita uma coluna inexistente.

### Anti-Padrão ❌
```typescript
// Tentar buscar responsavel_phone e contact_phone na tabela ministries provoca erro 400
const { data, error } = await supabase
  .from('platform_billing_invoices')
  .select(`
    id,
    ministries (
      name,
      phone,
      responsavel_phone,
      contact_phone
    )
  `)
```

### Padrão Correto ✅
```typescript
// Consultar apenas colunas confirmadas no schema oficial da tabela ministries
const { data, error } = await supabase
  .from('platform_billing_invoices')
  .select(`
    id,
    ministries (
      name,
      phone
    )
  `)
```

---

## 📝 Boas Práticas para Migrations

- Mantenha scripts de migration versionados na pasta `supabase/migrations/` ou `migrations/`.
- Sempre execute testes de integridade com `npx tsc --noEmit` e testes de API antes de enviar alterações de schema para produção.
