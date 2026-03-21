# 🔧 Troubleshooting - Sistema de Suporte

## ❓ Problema: Tabela não encontrada

### Sintomas
```
⚠️ Tabela de suporte ainda não foi criada. 
Clique no painel de migração para criar.
```

Ou em console:
```
[SUPORTE] Erro ao carregar tickets: {
  "codigo": "PGRST116",
  "mensagem": "Could not find the table 'public.tickets_suporte'..."
}
```

### Causas
1. ✗ Tabela não foi criada automaticamente
2. ✗ Painel de migração nunca foi clicado
3. ✗ Sistema está em produção (painel não aparece)
4. ✗ Tabela foi acidentalmente deletada

### Solução - Opção 1️⃣ (Automática - Recomendada)

#### Passo 1: Localizar o Painel
- Abra http://localhost:3000/suporte
- Olhe para o **canto inferior direito** da tela
- Você deve ver um painel **azul** com botões

#### Passo 2: Criar Tabela
```
Painel de Migração
┌─────────────────────────────┐
│ 🔍 Verificar Tabela         │
│ ✨ Criar Tabela             │
└─────────────────────────────┘
```

- Clique em **"✨ Criar Tabela"**
- Veja a animação de carregamento
- Aguarde a mensagem de sucesso ✅

#### Passo 3: Recarregar
- Pressione **F5** ou **Ctrl + R** (Windows)
- Ou **Cmd + R** (Mac)
- Pronto! Tabela criada

### Solução - Opção 2️⃣ (Manual - Fallback)

Se o painel não funcionar ou não aparecer:

#### Passo 1: Acessar Supabase Console
1. Acesse https://app.supabase.com
2. Selecione seu projeto
3. Vá para **SQL Editor**

#### Passo 2: Copiar SQL
Copie este SQL completo:

```sql
-- Criar tabela tickets_suporte
CREATE TABLE IF NOT EXISTS public.tickets_suporte (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo VARCHAR(100) NOT NULL,
  descricao VARCHAR(500) NOT NULL,
  categoria VARCHAR(50) NOT NULL DEFAULT 'Geral',
  prioridade VARCHAR(20) NOT NULL DEFAULT 'media',
  status VARCHAR(20) NOT NULL DEFAULT 'aberto',
  resposta_admin TEXT,
  respondido_em TIMESTAMP WITH TIME ZONE,
  data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  data_atualizacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_status CHECK (status IN ('aberto', 'em_progresso', 'resolvido', 'fechado')),
  CONSTRAINT valid_priority CHECK (prioridade IN ('baixa', 'media', 'alta', 'critica')),
  CONSTRAINT valid_category CHECK (categoria IN ('Geral', 'Bugs/Erros', 'Funcionalidade', 'Performance', 'Segurança', 'Dados', 'Integração', 'Outro'))
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_tickets_usuario ON public.tickets_suporte(usuario_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets_suporte(status);
CREATE INDEX IF NOT EXISTS idx_tickets_data ON public.tickets_suporte(data_criacao DESC);

-- Habilitar RLS
ALTER TABLE public.tickets_suporte ENABLE ROW LEVEL SECURITY;

-- Política: usuários podem ver apenas seus próprios tickets
CREATE POLICY "Usuários veem seus próprios tickets"
  ON public.tickets_suporte
  FOR SELECT
  USING (auth.uid() = usuario_id);

-- Política: usuários podem inserir seus próprios tickets
CREATE POLICY "Usuários criam seus próprios tickets"
  ON public.tickets_suporte
  FOR INSERT
  WITH CHECK (auth.uid() = usuario_id);

-- Política: usuários podem atualizar seus próprios tickets
CREATE POLICY "Usuários atualizam seus próprios tickets"
  ON public.tickets_suporte
  FOR UPDATE
  USING (auth.uid() = usuario_id);

-- Conceder permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets_suporte TO authenticated;
GRANT SELECT ON public.tickets_suporte TO anon;
```

#### Passo 3: Executar SQL
1. Cole todo o SQL acima no editor
2. Clique em **"Run"** ou pressione **Ctrl + Enter**
3. Veja a mensagem de sucesso

#### Passo 4: Verificar
Vá para **Tables** na sidebar e confirme que `tickets_suporte` aparece

#### Passo 5: Testar
- Volte para http://localhost:3000/suporte
- Recarregue a página
- Tente criar um novo ticket

---

## ❓ Problema: Painel de Migração não aparece

### Sintomas
- Você está em http://localhost:3000
- Não vê o painel azul no canto inferior direito
- Está em produção ou ambiente de staging

### Causas
1. ✗ Está em produção (painel apenas em desenvolvimento)
2. ✗ Você está logado como admin (painel escondido)
3. ✗ JavaScript desativado
4. ✗ Browser incompatível

### Solução

#### Opção 1: Verificar Ambiente
O painel aparece **APENAS** em:
- ✅ `NODE_ENV === 'development'`
- ✅ `localhost:3000`
- ✅ `npm run dev` rodando

Se está em **produção**, use a **Solução Manual** acima (copiar SQL no Supabase).

#### Opção 2: Ativar Desenvolvimento
```bash
# Terminal
cd c:\BACKUP\DESENVOLVIMENTO\gestaoeklesia
npm run dev
```

Abra http://localhost:3000 em novo navegador

#### Opção 3: JavaScript
1. Abra **F12** (DevTools)
2. Vá para **Console**
3. Procure por erros em vermelho
4. Se vir erro, reporte com screenshot

---

## ❓ Problema: Erro ao enviar ticket

### Sintomas
```
❌ Erro ao criar ticket
Erro ao enviar ticket
```

Ou em console:
```javascript
Error: Could not find the table 'public.tickets_suporte'
```

### Causas
1. ✗ Tabela ainda não foi criada
2. ✗ Você deslogou durante o processo
3. ✗ Problema de conexão com Supabase
4. ✗ RLS bloqueando acesso

### Solução

#### Passo 1: Verificar Login
1. Abra DevTools (F12)
2. Vá para **Application** → **Cookies**
3. Procure por `sb-*` cookies
4. Se não existem, você está deslogado

**Solução:** Faça login novamente

#### Passo 2: Verificar Tabela
1. Vá para https://app.supabase.com
2. Selecione seu projeto
3. Vá para **Tables**
4. Procure por `tickets_suporte`

**Se não existir:** Use solução manual acima

#### Passo 3: Testar Conexão
Abra DevTools e execute:
```javascript
// Teste de conexão
const response = await fetch('/api/v1/create-tickets-table');
const data = await response.json();
console.log(data);
```

Se vir erro, há problema com a API

#### Passo 4: Verificar RLS
No Supabase Console:
1. Vá para **Authentication** → **Policies**
2. Procure por políticas em `tickets_suporte`
3. Deve haver:
   - ✅ SELECT policy (usuários veem seus tickets)
   - ✅ INSERT policy (usuários criam tickets)
   - ✅ UPDATE policy (usuários atualizam tickets)

Se faltam, execute o SQL manual novamente

---

## ❓ Problema: Tickets não aparecem

### Sintomas
- Você criou um ticket
- A página mostra sucesso
- Mas não vê o ticket listado

### Causas
1. ✗ Filtro está escondendo seu ticket
2. ✗ RLS está bloqueando acesso
3. ✗ Ticket foi criado com outro usuário
4. ✗ Cache não foi atualizado

### Solução

#### Passo 1: Verificar Filtro
- Selecione **"Todos os Status"** no dropdown
- Se ainda não aparece, continuar

#### Passo 2: Verificar Identidade
```javascript
// F12 → Console
const { data: { user } } = await supabase.auth.getUser();
console.log('Usuário atual:', user?.email);
```

O ticket deve ter sido criado com este email

#### Passo 3: Forçar Recarregamento
1. Pressione **Ctrl + Shift + R** (força recarregar sem cache)
2. Aguarde carregar completamente
3. Veja se o ticket aparece

#### Passo 4: Verificar Banco Diretamente
No Supabase Console:
1. Vá para **Tables** → **tickets_suporte**
2. Clique em **"Browse"**
3. Procure pelo seu ticket
4. Verifique se `usuario_id` corresponde ao seu ID

Se vir o ticket lá mas não na página, é problema de RLS

#### Passo 5: Limpar Cache
```bash
# Terminal
# Parar servidor: Ctrl + C
npm run build  # Recompila
npm run dev    # Reinicia
```

---

## ❓ Problema: "Could not find the table" em produção

### Situação
Você fez deploy para Vercel e recebe erro de tabela não encontrada

### Causas
1. ✗ Variáveis de ambiente não estão corretas
2. ✗ Tabela não existe no banco de produção
3. ✗ Projeto Supabase diferente
4. ✗ RLS muito restritiva

### Solução

#### Passo 1: Verificar Variáveis
No Vercel:
1. Vá para **Settings** → **Environment Variables**
2. Verifique:
   - ✅ `NEXT_PUBLIC_SUPABASE_URL`
   - ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - ✅ `SUPABASE_SERVICE_ROLE_KEY`

Todos devem estar corretos e ativos

#### Passo 2: Criar Tabela em Produção
Você tem duas opções:

**Opção A:** Deploy versão dev localmente
```bash
# Terminal
npm run dev
# Visite http://localhost:3000
# Clique em "✨ Criar Tabela"
# Isso cria no mesmo banco que a produção usa
```

**Opção B:** Manual via Supabase
1. Acesse https://app.supabase.com
2. Selecione o **MESMO projeto** que usa em produção
3. Copie e execute o SQL manual (veja acima)

#### Passo 3: Reimplantar
```bash
# Terminal
git add -A
git commit -m "fix: Tabela de suporte criada"
git push origin main
# Vercel fará redeploy automaticamente
```

---

## ✅ Checklist de Diagnóstico

Se algo não funcionar, use este checklist:

```
VERIFICAÇÃO BÁSICA
□ Você está logado?
□ Está em http://localhost:3000 (dev) ou produção?
□ A tabela `tickets_suporte` existe?
  - Verificar em: https://app.supabase.com → Tables
□ Painel azul aparece no canto inferior direito?

VERIFICAÇÃO DE BANCO
□ Tabela `tickets_suporte` existe em Supabase
□ Tabela tem RLS habilitado
□ Existem políticas RLS corretas
□ Coluna `usuario_id` referencia `auth.users`

VERIFICAÇÃO DE CÓDIGO
□ `src/app/suporte/page.tsx` existe
□ `src/app/api/v1/create-tickets-table/route.ts` existe
□ `src/components/MigrationPanel.tsx` existe
□ Build compila sem erros (npm run build)

VERIFICAÇÃO DE AMBIENTE
□ Variáveis de ambiente corretas
□ Servidor rodando (npm run dev)
□ DevTools não mostra erros em vermelho
□ Cookies de autenticação existem
```

---

## 📞 Próximos Passos

Se nenhuma solução funcionar:

1. **Verifique os logs:**
   ```bash
   # Terminal
   npm run dev
   # Observe console para erros
   ```

2. **Procure por erros no console do navegador:**
   - F12 → Console
   - Procure por mensagens em vermelho
   - Anote a mensagem completa

3. **Teste a API diretamente:**
   ```bash
   curl http://localhost:3000/api/v1/create-tickets-table
   ```

4. **Entre em contato com suporte com:**
   - Descrição do erro
   - Screenshot da tela
   - Texto completo do erro no console
   - Seu ambiente (dev/produção)
   - Seu navegador e versão

---

**Versão:** 1.0  
**Última atualização:** Janeiro 2026  
**Status:** ✅ Documentação Completa
