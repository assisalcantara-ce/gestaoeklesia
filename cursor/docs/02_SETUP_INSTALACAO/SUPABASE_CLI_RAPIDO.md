# ⚡ SUPABASE CLI: INSTALAÇÃO RÁPIDA (5 MIN)

## ✅ Opção 1: NPM (Mais Fácil)

```bash
npm install -g supabase
```

## ✅ Verificar Instalação

```bash
supabase --version
```

Saída esperada:
```
supabase-cli 1.x.x
```

---

## ✅ Fazer Login

```bash
supabase login
```

Pressione **Enter** → browser abrirá

1. Vá para: https://supabase.com/dashboard
2. Settings → Access Tokens
3. "Generate new token"
4. Copie token (começa com `sbp_`)
5. Cole no terminal

Pronto!

---

## ✅ Próximas Ações

### Se quer desenvolvimento LOCAL:

```bash
# Ir para pasta do projeto
cd c:\BACKUP\DESENVOLVIMENTO\gestaoeklesia

# Inicializar
supabase init

# Subir banco local
supabase start
```

Copia as credenciais para `.env.local`

### Se quer usar projeto REMOTO:

```bash
# Link ao projeto existente
supabase link --project-ref seu-project-id

# Ver migrations
supabase migration list
```

---

## 📖 Próximo Passo

Leia: **SUPABASE_CLI_GUIA_COMPLETO.md** para comandos avançados

---

**Tempo total: ~5 minutos** ⏱️

