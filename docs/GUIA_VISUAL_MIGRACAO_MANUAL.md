# 📋 Guia Visual: Aplicar Migração Manual no Supabase

## 🎯 Objetivo
Copiar o arquivo SQL e executar no Supabase Dashboard em 5 minutos.

---

## ✅ Passo 1: Abrir o Arquivo SQL

Abra o arquivo:
```
supabase/migrations/20260105_attendance_management_schema.sql
```

📁 **Caminho completo:**
```
c:\BACKUP\DESENVOLVIMENTO\gestaoeklesia\supabase\migrations\20260105_attendance_management_schema.sql
```

### Como abrir:
- **VS Code**: Abra o arquivo Explorer e navegue até ele
- **Ou**: Arquivo → Abrir → Procure pelo caminho acima

---

## 📋 Passo 2: Copiar Tudo

Com o arquivo aberto:

```
Ctrl + A  (Selecionar tudo)
Ctrl + C  (Copiar)
```

✅ Você copiou ~180 linhas de SQL

---

## 🌐 Passo 3: Acessar Supabase Dashboard

### 3.1 Abra seu navegador:
```
https://supabase.com/dashboard
```

### 3.2 Faça login
- Email: seu email
- Senha: sua senha

### 3.3 Selecione seu projeto
Procure pelo projeto **GestãoEklesia** (ou o nome que você deu)

---

## 📝 Passo 4: Abrir SQL Editor

Você vai estar em algo assim:

```
Dashboard → Seu Projeto
```

Na barra lateral esquerda, procure por:

```
SQL Editor (ou "Desenvolvimento" → "SQL")
```

Clique nela.

---

## ➕ Passo 5: Criar Nova Query

Você vai ver dois botões na parte superior:

```
[New Query]  [Saved Queries]
```

Clique em **New Query**

---

## 📌 Passo 6: Colar o SQL

Você agora tem uma **caixa vazia** para escrever SQL.

**Cole o código:**
```
Ctrl + V  (Colar)
```

Você vai ver ~180 linhas aparecerem (em várias cores = é normal, é syntax highlighting)

### Deve parecer assim:
```sql
-- Painel de Atendimento - Tabela de Status
CREATE TABLE IF NOT EXISTS public.attendance_status (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  pre_registration_id UUID REFERENCES public.pre_registrations(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  ...
  
-- E mais ~175 linhas abaixo
```

---

## ▶️ Passo 7: Executar SQL

### 7.1 Procure pelo botão **RUN**

Está **no canto superior direito** da caixa de SQL.

Parece assim:
```
[▶ RUN]  ou [Run Query]
```

### 7.2 Clique nele

Você vai ver:
```
⏳ Executing...
```

Espere 2-5 segundos...

### 7.3 Veja o resultado

Se tudo correu bem, você vai ver:

```
✅ Query executed successfully
0 ms
```

---

## ✔️ Passo 8: Verificar se Funcionou

### Opção A: Visualmente

Na barra lateral esquerda, clique em:
```
Table Editor (ou "Dados" → "Tabelas")
```

Procure por estas 4 **novas tabelas**:
- ✅ `attendance_status`
- ✅ `attendance_history`
- ✅ `test_credentials`
- ✅ `generated_contracts`

Se vir estas 4, **sucesso!** 🎉

### Opção B: Executar Query de Verificação

No SQL Editor, em um **New Query**, cole isso:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'attendance_status', 
  'attendance_history', 
  'test_credentials', 
  'generated_contracts'
);
```

Clique **RUN**.

Se retornar **4 linhas**, está perfeito! ✅

---

## ⚠️ Erros Comuns

### "Syntax Error na linha X"
**Solução:**
- Verifique se você copiou **tudo** do arquivo
- Se alguns caracteres ficaram fora, copy/paste novamente
- Limpe a query (Ctrl+A, Delete) e tente novamente

### "Permission Denied"
**Solução:**
- Você precisa estar logado como admin do projeto
- Verifique em: Projeto → Configurações → API Keys
- Use a chave que tem acesso total (geralmente `service_role`)

### "Table already exists"
**Solução:**
- A migração já foi aplicada antes ✅ (é normal)
- Você pode executar novamente, não vai quebrar nada
- As tabelas já existentes serão ignoradas (`IF NOT EXISTS`)

---

## 🎉 Sucesso!

Agora você pode:

### 1️⃣ Iniciar o servidor:
```bash
npm run dev
```

### 2️⃣ Acessar o painel:
```
http://localhost:3000/admin/atendimento
```

### 3️⃣ Testar as funcionalidades:
- Vá para `/admin/ministerios`
- Aba "Pré-Cadastros"
- Clique "Detalhes"
- Teste "Gerar Credenciais" e "Gerar Contrato"

---

## 📞 Próximos Passos

Depois você quer explorar:
- ✅ Acesso total à API do Supabase
- ✅ Autenticação automática
- ✅ Integração de dados

Para isso, vamos usar as credenciais que estão em `.env`:
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Avise quando estiver pronto! 🚀
