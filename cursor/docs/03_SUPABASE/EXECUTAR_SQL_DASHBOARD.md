# 🚀 EXECUTAR SQL NO SUPABASE DASHBOARD (5 minutos)

A forma **mais rápida** é copiar o SQL direto no dashboard:

## Passo 1: Abrir SQL Editor

1. Acesse: https://drzafeksbddnoknvznnd.supabase.co
2. Menu esquerdo → **SQL Editor**
3. Clique em **"New query"**

---

## Passo 2: Copiar o SQL

Abra o arquivo na sua máquina:
```
c:\BACKUP\DESENVOLVIMENTO\gestaoeklesia\supabase\migrations\20260102200944_initial_schema.sql
```

Copie **TODO** o conteúdo (Ctrl+A, Ctrl+C)

---

## Passo 3: Colar e Executar

1. Na área branca do SQL Editor, **cole** (Ctrl+V)
2. Clique em **"RUN"** (canto superior direito, botão azul)
3. Aguarde execução...

---

## Passo 4: Verificar Sucesso

Você verá:
```
✓ 1 statement executed successfully
```

Ou pode ver as tabelas criadas:

1. Menu esquerdo → **Table Editor**
2. Você deve ver 9 tabelas:
   - [ ] ministries
   - [ ] ministry_users
   - [ ] members
   - [ ] audit_logs
   - [ ] cartoes_templates
   - [ ] cartoes_gerados
   - [ ] configurations
   - [ ] arquivos
   - [ ] (+ 1 view: ministries_with_stats)

---

## 🎉 Pronto!

Seu banco de dados está 100% criado e pronto para usar!

Próximos passos:
1. Instalar dependências: `npm install @supabase/supabase-js @supabase/ssr`
2. Gerar tipos: `npx supabase gen types typescript > src/types/supabase-generated.ts`
3. Iniciar servidor: `npm run dev`

---

**Tempo: ~5 minutos** ⏱️
