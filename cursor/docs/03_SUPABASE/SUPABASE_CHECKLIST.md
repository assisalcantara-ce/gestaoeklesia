# ✅ CHECKLIST: MIGRAÇÃO SUPABASE

## FASE 1: SETUP INICIAL (Hoje)

- [ ] Criar conta Supabase
- [ ] Criar novo projeto no Supabase (region = São Paulo)
- [ ] Copiar: Project URL
- [ ] Copiar: Anon Key  
- [ ] Copiar: Service Role Key
- [ ] Criar `.env.local` com 3 variáveis
- [ ] Testar: `npm install @supabase/supabase-js @supabase/ssr`
- [ ] Executar SQL schema (SUPABASE_SCHEMA_COMPLETO.sql)
- [ ] Verificar: 9 tabelas criadas no Supabase

---

## FASE 2: PRIMEIROS USUÁRIOS (Amanhã)

- [ ] Criar primeiro usuário via Supabase Auth
- [ ] Copiar: user_id do dashboard
- [ ] Criar primeiro ministry (SQL ou API)
- [ ] Linkar usuário ao ministry (ministry_users)
- [ ] Testar: Login no app com novo usuário

---

## FASE 3: API ROUTES (Esta Semana)

- [ ] Criar: `/api/v1/members/route.ts` (GET + POST)
- [ ] Criar: `/api/v1/members/[id]/route.ts` (GET + PUT + DELETE)
- [ ] Testar cada endpoint com Postman/curl
- [ ] Verificar RLS: Usuário só vê dados seu ministry

---

## FASE 4: FRONTEND INTEGRATION (Esta Semana)

- [ ] Criar: `src/hooks/useMembers.ts` 
- [ ] Criar: Página de membros conectada à API
- [ ] Criar: Formulário de criar membro
- [ ] Criar: Tabela de listar membros
- [ ] Testar: CRUD completo (Create, Read, Update, Delete)

---

## FASE 5: AUTENTICAÇÃO SUPABASE (Semana 2)

- [ ] Remover login hardcoded de `src/app/page.tsx`
- [ ] Implementar: Supabase Auth (signUp, signIn)
- [ ] Implementar: Session management com cookies
- [ ] Implementar: Middleware de autenticação
- [ ] Testar: Login/logout/registration

---

## FASE 6: OUTROS MÓDULOS (Semana 2-3)

- [ ] Migrar: Cartões (cartoes_gerados)
- [ ] Migrar: Templates (cartoes_templates)
- [ ] Migrar: Configurações (configurations)
- [ ] Criar: API routes para cada módulo
- [ ] Testar: Isolamento RLS em cada tabela

---

## FASE 7: SEGURANÇA & PRODUÇÃO (Semana 3-4)

- [ ] Audit Logs: Implementar logging de ações
- [ ] RLS: Revisar todas as policies
- [ ] Permissões: Implementar roles (admin, manager, etc)
- [ ] Rate Limiting: Adicionar proteção de API
- [ ] HTTPS: Verificar certificados (Supabase já tem)
- [ ] Secrets: Service Role Key nunca vaza

---

## ARQUIVO CRIADOS PARA VOCÊ

1. **SUPABASE_SCHEMA_COMPLETO.sql** - Schema com 9 tabelas
2. **SUPABASE_PASSO_A_PASSO.md** - Guia prático 10 passos
3. **src/lib/supabase-client.ts** - Cliente frontend
4. **src/lib/supabase-server.ts** - Cliente backend
5. **src/lib/supabase-rls.ts** - Cliente com RLS
6. **src/app/api/v1/members/route.ts** - API GET + POST
7. **src/app/api/v1/members/[id]/route.ts** - API GET + PUT + DELETE
8. **src/types/supabase.ts** - Tipos TypeScript
9. **src/hooks/useMembers.ts** - Hook React para CRUD
10. **SUPABASE_CHECKLIST.md** - Este arquivo!

---

## 🎯 PRÓXIMO PASSO RECOMENDADO

1. **Agora:** Siga o SUPABASE_PASSO_A_PASSO.md (criar conta + projeto)
2. **10 min depois:** `.env.local` criado e testado
3. **30 min depois:** SQL schema executado
4. **1h depois:** Primeiro usuário criado
5. **2h depois:** Primeira API route testando
6. **3h depois:** Primeira página conectada ao DB real

---

## ⚠️ PONTOS CRÍTICOS

✅ **Service Role Key**
- Guardar em `.env.local` (não vaza no git)
- NUNCA enviar ao frontend
- NUNCA commitar acidentalmente

✅ **RLS Policies**
- Automaticamente protegem dados
- Usuário A não vê ministry de usuário B
- Testar SEMPRE com usuários diferentes

✅ **Variáveis de Ambiente**
- `NEXT_PUBLIC_*` = pode ir pro browser
- Sem prefixo = fica privado no servidor

---

## 📞 DÚVIDAS?

Se algo não funcionar:

1. Verifique `.env.local` (copiar colas corretos)
2. Teste SQL direto no Supabase SQL Editor
3. Veja logs em Supabase → Logs
4. Use `console.log()` na API route para debug

**Pronto para começar?** 🚀

