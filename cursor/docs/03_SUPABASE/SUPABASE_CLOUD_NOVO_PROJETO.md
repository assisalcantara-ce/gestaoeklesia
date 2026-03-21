# 🚀 SUPABASE CLOUD: Novo Projeto na Mesma Conta

Você já tem conta? Ótimo! Aqui como criar um novo projeto para Gestão Eklesia.

---

## PASSO 1: Criar Novo Projeto no Supabase Cloud

1. Acesse: https://supabase.com/dashboard
2. Você verá seus projetos existentes
3. Clique **"+ New Project"**
4. Preencha:
   - **Name:** `gestaoeklesia` (ou seu nome)
   - **Database Password:** Algo forte! (salve bem)
   - **Region:** `South America - São Paulo` (mais perto)
5. Clique **"Create new project"**
6. ⏳ Aguarde ~3 minutos

---

## PASSO 2: Copiar as Credenciais

1. Novo projeto criado ✅
2. Vá para: **Settings → API**
3. Copie (você verá):
   ```
   Project URL: https://seu-projeto-id.supabase.co
   Anon Key: eyJhbGc...
   Service Role Key: eyJhbGc...
   ```
4. **Guarde bem!** (vamos usar já)

---

## PASSO 3: Instalar CLI (Se não tem)

```bash
npm install -g supabase
```

Verifique:
```bash
supabase --version
```

---

## PASSO 4: Login com Sua Conta Existente

```bash
supabase login
```

Pressione **Enter** → Browser abrirá

- Você já está logado? Clique "Authorize"
- Pronto! CLI vinculado à sua conta

---

## PASSO 5: Linkar Seu Novo Projeto ao CLI

```bash
cd c:\BACKUP\DESENVOLVIMENTO\gestaoeklesia

supabase link --project-ref seu-projeto-id
```

**Onde está `seu-projeto-id`?**
- URL do projeto: `https://seu-projeto-id.supabase.co`
- ID é a parte antes de `.supabase.co`

Exemplo:
```bash
supabase link --project-ref abcdefghijklmnop
```

Saída esperada:
```
✓ Linked project abcdefghijklmnop
```

---

## PASSO 6: Preencher `.env.local`

```bash
# Copie de: Supabase Dashboard → Settings → API

NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

---

## PASSO 7: Criar Primeira Migration

```bash
supabase migration new initial_schema
```

Cria arquivo:
```
supabase/migrations/20240102120000_initial_schema.sql
```

---

## PASSO 8: Adicionar SQL Schema

Abra o arquivo criado e **copie tudo** de:
```
SUPABASE_SCHEMA_COMPLETO.sql
```

Cole no seu arquivo de migration.

---

## PASSO 9: Push para o Cloud

```bash
supabase db push
```

Saída:
```
Pushing migration 20240102120000_initial_schema.sql
✓ Migration complete!
```

✅ **Suas 9 tabelas foram criadas no Cloud!**

---

## PASSO 10: Gerar Tipos TypeScript

```bash
supabase gen types typescript --linked > src/types/supabase-generated.ts
```

Cria arquivo com TODOS os tipos do seu schema.

---

## PASSO 11: Testar Conexão

```bash
npm run dev
```

No terminal:
```bash
curl -X GET http://localhost:3000/api/v1/members \
  -H "Authorization: Bearer seu-anon-key"
```

Sucesso? ✅ Tudo funcionando!

---

## 🎯 RESUMO: 11 PASSOS

```
1. Criar projeto Cloud                      (3 min)
2. Copiar credenciais                       (1 min)
3. Instalar CLI (se não tem)                (2 min)
4. supabase login                           (2 min)
5. supabase link --project-ref seu-id      (1 min)
6. Preencher .env.local                     (2 min)
7. supabase migration new                   (1 min)
8. Copiar SQL schema                        (2 min)
9. supabase db push                         (2 min)
10. Gerar tipos                             (1 min)
11. Testar com npm run dev                  (1 min)

TOTAL: ~18 minutos ⏱️
```

---

## ✅ Checklist

- [ ] Projeto Cloud criado
- [ ] Credenciais copiadas
- [ ] CLI instalado
- [ ] Login feito
- [ ] Projeto linkado ao CLI
- [ ] .env.local preenchido
- [ ] Migration criada
- [ ] SQL importado
- [ ] Push executado (✅ tabelas no Cloud!)
- [ ] Tipos gerados
- [ ] npm run dev funcionando

---

## 📊 Diferenças vs Local

| Aspecto | Local | Cloud |
|---------|-------|-------|
| Onde roda | Seu PC | Supabase servers |
| Internet necessária | Não | Sim |
| Acesso múltiplo | Você só | Qualquer pessoa autorizada |
| Backup | Manual | Automático |
| Pronto produção | Não | Sim |
| Custo | Grátis | Grátis (até limite) |

**Você escolheu Cloud = Perfeito para produção!** ✅

---

## 🔗 Próximas Ações

1. ✅ Criar projeto Cloud (você faz)
2. ✅ Linkar ao CLI (você faz)
3. ✅ Criar schema (você faz)
4. ⏳ Criar primeiro usuário
5. ⏳ Criar primeiro ministry
6. ⏳ Testar API
7. ⏳ Conectar frontend

---

## 💡 Pro Tip

Depois de tudo pronto, você pode:

```bash
# Ver status
supabase status

# Ver migrations
supabase migration list

# Fazer backup
supabase db backup

# Pull schema remoto (em outro PC)
supabase db pull
```

---

**Pronto! Em 18 minutos você tem tudo no Cloud!** 🚀

