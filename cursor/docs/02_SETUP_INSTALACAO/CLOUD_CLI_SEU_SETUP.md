# 🎊 SEU SETUP: CLOUD + CLI (18 min)

Você tem conta Cloud? Ótimo! Aqui seu path exato:

---

## 📋 O QUE VOCÊ VAI FAZER

```
┌─────────────────────────────────────────┐
│  PASSO 1: Novo Projeto no Cloud         │
│  https://supabase.com/dashboard          │
│  (5 minutos)                             │
│                                          │
│  → "+ New Project"                       │
│  → Name: gestaoeklesia                   │
│  → Create                                │
│                                          │
│  Resultado: seu-project-id               │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  PASSO 2: Copiar Credenciais             │
│  Settings → API                          │
│  (1 minuto)                              │
│                                          │
│  Project URL                             │
│  Anon Key                                │
│  Service Role Key                        │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  PASSO 3: CLI + Link                     │
│  npm install -g supabase                 │
│  supabase login                          │
│  supabase link --project-ref seu-id     │
│  (3 minutos)                             │
│                                          │
│  Resultado: CLI conectado ao Cloud       │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  PASSO 4: .env.local                     │
│  NEXT_PUBLIC_SUPABASE_URL=...            │
│  NEXT_PUBLIC_SUPABASE_ANON_KEY=...       │
│  SUPABASE_SERVICE_ROLE_KEY=...           │
│  (2 minutos)                             │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  PASSO 5: Migrations                     │
│  supabase migration new initial_schema   │
│  (Copiar SQL de SCHEMA_COMPLETO.sql)    │
│  supabase db push                        │
│  (4 minutos)                             │
│                                          │
│  Resultado: ✅ Tabelas no Cloud!         │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  PASSO 6: Tipos + Teste                  │
│  supabase gen types typescript...        │
│  npm run dev                             │
│  (3 minutos)                             │
│                                          │
│  Resultado: 🚀 Tudo rodando!             │
└─────────────────────────────────────────┘
```

---

## ✅ CHECKLIST RÁPIDO

- [ ] Projeto Cloud criado (seu-project-id)
- [ ] Credenciais copiadas (3 valores)
- [ ] CLI instalado + login
- [ ] Projeto linkado ao CLI
- [ ] .env.local preenchido
- [ ] Migration criada + SQL importado
- [ ] supabase db push executado
- [ ] Tipos gerados
- [ ] npm run dev rodando

---

## 📞 PRÓXIMOS PASSOS APÓS SETUP

### Depois que tudo estiver pronto (tabelas no Cloud):

1. **Criar Primeiro Usuário**
   ```bash
   # No Supabase Dashboard → Auth → Users
   # "+ Add user" → preencha email/senha
   ```

2. **Criar Primeiro Ministry**
   ```bash
   # SQL ou API:
   curl -X POST http://localhost:3000/api/v1/ministries \
     -H "Content-Type: application/json" \
     -d '{"name":"Meu Ministry","...":"..."}'
   ```

3. **Testar API**
   ```bash
   curl http://localhost:3000/api/v1/members
   ```

4. **Conectar Frontend**
   ```typescript
   import { useMembers } from '@/hooks/useMembers'
   ```

---

## 🎯 SEUS DOCUMENTOS

| Documento | Usa? | Quando? |
|-----------|------|---------|
| SETUP_RAPIDO_CLOUD.md | ✅ | Agora! |
| SUPABASE_CLOUD_NOVO_PROJETO.md | ✅ | Referência |
| CLI_NA_PRATICA.md | ✅ | Depois (migrations) |
| SUPABASE_CLI_GUIA_COMPLETO.md | ✅ | Quando tiver dúvidas |
| TESTE_API_EXEMPLO.md | ✅ | Testar |
| Outros | Opcional | Conforme precisa |

---

## 💡 IMPORTANTE

```
⚠️  Service Role Key
   Nunca compartilhe!
   Guarde em .env.local
   Nunca commit!

✅ Anon Key
   Pode ficar no .env.local (público)
   Seguro usar no frontend

✅ Project URL
   Público também
   Fica em NEXT_PUBLIC_
```

---

## 🚀 COMEÇAR AGORA!

1. Abra: `SETUP_RAPIDO_CLOUD.md`
2. Siga os 9 passos (18 min)
3. Volte aqui quando terminar

---

**Você já tem uma vantagem: conta Cloud pronta!** 🎉

