# 📋 DAILY BRIEFING - GestãoEklesia

**Data de Última Atualização:** 15 de fevereiro de 2026  
**Última Sessão:** Fluxos (Operacao) com formularios amigaveis + template "Apresentacao de Criancas" com form.fields + Estrutura Hierarquica sem geolocalizacao na Divisao 2

---

## 🎯 PROJETO EM UMA LINHA

**GestãoEklesia** é um **SaaS multi-tenant** para gerenciar igrejas/ministérios com painel admin, geolocalização, cartões de membros e relatórios.

---

## 📊 INFORMAÇÕES CRÍTICAS

### Stack Tecnológico
- **Frontend:** Next.js 16 + React 19 + TypeScript
- **Backend:** Supabase (PostgreSQL + Auth + RLS)
- **UI:** Tailwind CSS + Lucide Icons (Dark theme)
- **Deploy:** Vercel + GitHub
- **Email:** Resend
- **Mapas:** Google Maps API
- **Relatórios:** jsPDF + html2canvas

### ID Único por Cliente
- ✅ **Multi-tenant implementado**
- Campo: `ministry_id` (UUID)
- Isolamento: RLS (Row-Level Security) em PostgreSQL
- Tabela principal: `ministries` (clientes)
- Acesso controlado via JWT + Supabase Auth

### Nomenclaturas de Divisões (1ª, 2ª, 3ª)
- **As nomenclaturas variam por tenant** (ex: 1ª divisão = IGREJA, 2ª = ÁREA, 3ª = NENHUMA).
- **Nunca fixar nomes** como "Supervisão", "Campo", "Congregação" no schema ou na lógica.
- **Trabalhar sempre com colunas genéricas** de 1ª/2ª/3ª divisão e renderizar labels via configuração do tenant.
- Quando uma divisão estiver configurada como **NENHUMA**, ela deve ser ocultada na UI.

### Credenciais Supabase
As credenciais **não devem ficar em documentação**.

Use as variáveis em `.env.local` (e mantenha `.env.local.template` atualizado):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### Admin de Teste
Para ambiente local/staging, mantenha usuário admin de teste, mas **não registre senha em .md**.

```
Email: admin@gestaoeklesia.local
Senha: (definir via seed/manager/env)
```

---

## 🗂️ ESTRUTURA DO PROJETO

```
.
├── docs/                    ← 105 arquivos .md (documentação)
│   ├── sql/                ← 12 scripts SQL (setup banco)
│   ├── COMECE_AQUI.md      ← Guia para novos
│   ├── README.md           ← Índice geral
│   ├── TLDR.md             ← Resumo executivo
│   └── STATUS_FINAL.md     ← Status atual
│
├── src/
│   ├── app/
│   │   ├── admin/          ← Painel administrativo
│   │   ├── api/v1/         ← APIs REST
│   │   └── ...
│   ├── components/         ← Componentes React
│   ├── lib/                ← Utilitários (supabase-rls.ts, etc)
│   └── config/
│
├── supabase/
│   ├── migrations/         ← Migrações PostgreSQL
│   ├── config.toml         ← Config local
│   └── ...
│
├── public/                 ← Assets (imagens, etc)
├── package.json            ← Dependências
├── tsconfig.json           ← Config TypeScript
├── .env.local              ← Credenciais (NÃO commitar)
└── .env.local.template     ← Template

```

---

## 🔧 ACESSO ÀS CLIs

### ✅ Supabase CLI
```bash
# Atualizar schema do banco
npx supabase db pull

# Aplicar migrações locais
npx supabase db push

# Status do projeto
npx supabase status -o env

# Gerar tipos TypeScript
npx supabase gen types typescript > types.ts

# Executar SQL direto
npx supabase db execute -f docs/sql/seu_script.sql
```

### ✅ Vercel CLI
```bash
# Deploy em produção
vercel deploy --prod

# Variáveis de ambiente
vercel env list
vercel env add NOVA_VAR

# Logs
vercel logs

# Status
vercel inspect
```

### ✅ Git CLI
```bash
# Status
git status

# Commit e push
git add .
git commit -m "tipo: descrição"
git push origin main

# Branches
git checkout -b feature/nova-feature
git merge feature/nova-feature
```

---

## 📚 DOCUMENTAÇÃO IMPORTANTE

| Arquivo | Proposição | Leitura |
|---------|-----------|---------|
| **docs/COMECE_AQUI.md** | Guia inicial do projeto | 10 min |
| **docs/README.md** | Índice completo | 5 min |
| **docs/TLDR.md** | Resumo executivo | 2 min |
| **docs/STATUS_FINAL.md** | Status atual do sistema | 5 min |
| **docs/DESIGN_SYSTEM_GUIDE.md** | Padrões de UI | 15 min |
| **docs/DOCUMENTACAO_TECNICA_PAINEL_V2.md** | Arquitetura APIs | 30 min |

---

## 🚀 COMO INICIAR A SESSÃO DIÁRIA

1. **Leia este arquivo** (você está aqui)
2. **Verifique a estrutura:**
   ```bash
   cd c:\BACKUP\DESENVOLVIMENTO\gestaoeklesia
   npm run dev
   # Acessa: http://localhost:3000/admin/login
   ```
3. **Status do repositório:**
   ```bash
   git status
   git pull origin main
   ```
4. **Próxima ação:** Verifique a seção "ÚLTIMAS IMPLEMENTAÇÕES" abaixo

---

## ✨ ÚLTIMAS IMPLEMENTAÇÕES

### 📅 15 de Fevereiro de 2026 — Fluxos (Operacao) + Estrutura Hierarquica

#### ✅ Concluído
- [x] Fluxos (Operacao):
    - Tela de detalhe com status humano, erros amigaveis e labels de acao.
    - CTA unico quando ha apenas 1 acao disponivel.
    - Dados da instancia exibidos de forma amigavel (sem JSON cru).
    - Edicao de dados antes de `em_analise` (OPERADOR/ADMIN) via PATCH.
- [x] "Novo Fluxo": formulario inicial a partir do template e salvando `data_json`.
- [x] Template "Apresentacao de Criancas" com `form.fields` reais (label/required/type).
- [x] Script para atualizar o template existente no banco: `scripts/update-apresentacao-template.cjs`.
- [x] Estrutura Hierarquica (Divisao 2): removidos campos/validacoes de UF, municipio e CEP; coluna "Municipio/UF" removida da lista.

#### ▶️ Próximo passo (amanhã)
- Executar o script de update do template no Supabase e revalidar o fluxo:
    - Criar instancia de "Apresentacao de Criancas" com dados preenchidos.
    - Abrir detalhe e confirmar exibicao dos dados.
    - Executar "Enviar para analise" e verificar historico.

### 📅 07 de Fevereiro de 2026 — Geolocalização (0 coordenadas) + persistência lat/lng

#### ✅ Concluído
- [x] Corrigida a causa do modal “Nenhum membro ou congregação com coordenadas encontrado” quando havia registros:
    - O módulo estava lendo `members` via client Supabase sem sessão (RLS) e retornando vazio.
    - Havia inconsistências em filtros/campos: `cidade` vs `city`, e status UI (`ativo`) vs DB (`active`).
- [x] `src/lib/geolocation-utils.ts` agora usa o client autenticado do browser (`src/lib/supabase-client.ts`) e:
    - Normaliza status UI ⇄ DB (`ativo/inativo` ⇄ `active/inactive`).
    - Faz fallback de coordenadas via `custom_fields.latitude/longitude`.
- [x] `src/app/geolocalizacao/page.tsx` ficou mais resiliente:
    - Normaliza status de congregações quando existe `ativo: boolean`.
    - Valida coords com parse (string → number) antes de filtrar.
- [x] Persistência: cadastro de membros passa a enviar `latitude/longitude` para a API (além de `address/city/state/zipcode`).
- [x] API: `/api/v1/members` (POST) aceita `latitude/longitude` com fallback para bases sem coluna.
- [x] Migração adicionada para garantir colunas `latitude/longitude` em `public.members`.
- [x] `npm run build` OK.
- [x] `npm run lint` OK (warnings apenas).

#### 🐛 Problemas Encontrados (e solução)
- “Sem coordenadas” no mapa mesmo com dados: origem principal foi leitura não autenticada + status/campos divergentes.

#### ▶️ Próximo passo (amanhã)
- Aplicar migração no Supabase: `supabase/migrations/20260208120000_ensure_members_geolocation_columns.sql`.
- Se já existir lat/lng no `custom_fields`, rodar um backfill (copiar para colunas) ou re-salvar os registros pela UI.
- Se o `npm run dev` falhar no Windows: checar processo na porta 3000 e remover `.next/dev/lock`.

### 📅 06 de Fevereiro de 2026 — Estrutura Hierárquica (Divisões) e ponto de parada

#### ✅ Concluído
- [x] Refatoração da tela de divisões (Estrutura Hierárquica) sem depender de registros anteriores:
    - D2 (2ª divisão) não exige mais que exista D1.
    - D1/D3 não travam mais por falta de D2.
- [x] Troca do conteúdo das abas conforme solicitado:
    - 1ª divisão agora usa o CRUD/formulário de congregações.
    - 3ª divisão agora usa o CRUD/formulário de supervisões (CPF do supervisor etc).
- [x] Implementada associação “adicionar X itens da divisão anterior” sem criar schema novo:
    - No cadastro/edição de D2: seleção múltipla de D1 gravando via `congregacoes.campo_id`.
    - No cadastro/edição de D3: seleção múltipla de D2 gravando via `campos.supervisao_id`.
- [x] `npm run build` OK.

#### 📍 Ponto atual (onde paramos)
- Arquivo principal alterado: `src/app/secretaria/congregacoes/page.tsx` (rota `/secretaria/congregacoes` e alias `/secretaria/estrutura-hierarquica`).
- Pendência de produto/UX: **novo formulário da 1ª divisão “conforme imagem”** ainda não foi implementado (falta a imagem/campos detalhados).
- Pendência ambiente: `npm run dev` no Windows está falhando de forma recorrente (lock/processo/porta). Build segue funcionando, então a validação por build está ok.

#### ▶️ Próximo passo (amanhã)
- Ajustar a 1ª divisão para o formulário completo baseado na imagem (campos, validações e, se necessário, migração/Storage).
- Rodar validação manual em navegador assim que o `npm run dev` estiver estabilizado.

### 📅 05 de Fevereiro de 2026 — Hardening mínimo antes dos módulos

#### ✅ Concluído
- [x] Middleware cobrindo `/admin/:path*` e liberando apenas `/admin/login`
- [x] Verificação de admin sem depender de RLS em `admin_users` (server-only)
- [x] Separação de clients Supabase (browser / server RLS / server elevated)
- [x] Rate limit persistente nos endpoints públicos (`/api/v1/signup`, `/api/v1/contact`)
- [x] Anti-duplicidade robusta em `pre_registrations` (email/CPF/CNPJ) + retorno HTTP 409
- [x] Sanitização de docs/templates com placeholders (sem tokens/chaves em .md)
- [x] Hardening de endpoints admin sensíveis:
    - `run-migration` exige `ADMIN_RUN_MIGRATIONS_ENABLED=true` + rate limit
    - `test-credentials` com rate limit

#### ▶️ Próxima etapa: Módulos
- Implementar módulos assumindo `ministry_id` como tenant canônico.
- Observação: há fluxo legado com `empresa_id` em auditoria; tratar quando evoluir esse módulo.

### 📅 16 de Janeiro de 2026 - SESSÃO 3

#### ✅ Concluído
- [x] **Integração Supabase 100% completa** no módulo Congregações
- [x] Cliente Supabase inicializado na página
- [x] Autenticação via JWT do usuário logado
- [x] Busca automática de `ministry_id` do usuário no banco
- [x] CRUD (Create, Read, Update, Delete) implementado:
  - ✅ Carregar lista de Supervisões (Divisão 1)
  - ✅ Criar nova Supervisão
  - ✅ Editar Supervisão existente
  - ✅ Deletar Supervisão
- [x] Busca dinâmica de Ministros (apenas supervisores/admins)
- [x] Interface totalmente funcional com Supabase
- [x] **Código compila sem erros** ✓ Ready in 1765ms

#### 🏗️ Arquitetura Implementada
```
Frontend (React)
    ↓
Supabase Auth (JWT)
    ↓
Supabase Client (createClient)
    ↓
PostgreSQL Tables (supervisoes, ministry_users)
    ↓
RLS Policies (isolamento por ministry_id)
```

#### 🔍 Descobertas
- ✅ Tabelas já existem no Supabase: `supervisoes`, `congregacoes`
- ✅ RLS policies corretamente configuradas para isolamento
- ✅ Integração de autenticação funcional com JWT
- ✅ Dados carregam em tempo real do banco
- ✅ Operações CRUD funcionando perfeitamente

#### 🛠️ Próximos Passos
1. ⏳ Implementar **2ª Divisão** (dependente de Divisão 1)
2. ⏳ Implementar **3ª Divisão** (Congregações com geolocalização)
3. ⏳ Upload de fotos para prédios
4. ⏳ Integração com Google Maps API

#### 📊 Status Geral
- **Módulo Congregações:** ✅ 100% Integrado com Supabase
- **Divisão 1 (Supervisão):** ✅ CRUD Completo
- **Divisão 2 (Campo):** ⏳ Estrutura pronta
- **Divisão 3 (Congregação):** ⏳ Estrutura pronta
- **Servidor:** ✅ Compilando sem erros
- **Banco de Dados:** ✅ Sincronizado em tempo real

---

### 📅 16 de Janeiro de 2026 - SESSÃO 2

#### ✅ Concluído
- [x] Criado módulo **Estrutura Hierárquica** em `/secretaria/congregacoes`
- [x] Interface com 3 abas dinâmicas baseadas em nomenclaturas
- [x] Adicionado "Estrutura Hierárquica" no menu Secretaria
- [x] Interface base com formulários para as 3 divisões
- [x] Busca dinâmica de Ministros para cada nível
- [x] Suporte a nomenclaturas dinâmicas carregadas

#### 📊 Status
- **Módulo Base:** ✅ Criado
- **Menu Sidebar:** ✅ Atualizado

---

### 📅 16 de Janeiro de 2026 - SESSÃO 1

#### ✅ Concluído
- [x] Movido todos os 105 arquivos .md para `docs/`
- [x] Criado `docs/sql/` com 12 scripts
- [x] Verificação de multi-tenancy (100% implementado)
- [x] Confirmado acesso às CLIs (Supabase, Vercel, Git)
- [x] Criado arquivo DAILY_BRIEFING.md

---

## 🎯 PRÓXIMOS PASSOS RECOMENDADOS

1. **Revisar design system** - Padronizar novos componentes
2. **Testar RLS policies** - Validar isolamento de dados
3. **Deploy beta** - Enviado para Vercel quando pronto
4. **Documentação API** - Atualizar endpoints criados
5. **Testes** - QA completo antes de produção

---

## 📝 TEMPLATE PARA ATUALIZAÇÃO DIÁRIA

**AO FINAL DO DIA**, copie o template abaixo e atualize este arquivo:

```markdown
### 📅 DD de MÊS de 2026

#### ✅ Concluído
- [ ] Item 1
- [ ] Item 2

#### 🔍 Descobertas
- Item 1
- Item 2

#### 🐛 Problemas Encontrados
- Problema 1: Solução
- Problema 2: Solução

#### 📊 Status Geral
- Métrica 1: Valor
- Métrica 2: Valor
```

---

## 🔗 LINKS RÁPIDOS

- **Supabase Dashboard:** https://app.supabase.com
- **Vercel Dashboard:** https://vercel.com/dashboard
- **GitHub:** [seu-repo]
- **Localhost:** http://localhost:3000/admin/login
- **Docs Folder:** `docs/` (105 arquivos)

---

## ✅ BOAS PRÁTICAS

- Sempre aplicar máscaras em novos formulários (CPF, celular, CNPJ, etc)

---

## ⚠️ CHECKLIST ANTES DE COMMITAR

- [ ] Variáveis sensíveis removidas de commits
- [ ] `.env.local` não está no git
- [ ] TypeScript compila sem erros
- [ ] RLS policies validadas
- [ ] Testes básicos passando
- [ ] Documentação atualizada

---

**Última Atualização:** 16 de janeiro de 2026, 14:30  
**Próxima Atualização:** Ao final do dia de trabalho

