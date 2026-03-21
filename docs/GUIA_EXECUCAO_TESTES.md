# ▶️ GUIA DE EXECUÇÃO DE TESTES - Painel de Atendimento v2

**Data**: 8 de Janeiro de 2026  
**Versão**: 2.0  
**Tempo Estimado**: 30-60 minutos

---

## 🎯 Objetivo

Validar que o Painel de Atendimento v2 funciona corretamente em ambiente local.

---

## ⚙️ Pré-Requisitos

- [ ] Node.js instalado (v18+)
- [ ] npm atualizado
- [ ] Conta Supabase com credenciais em `.env.local`
- [ ] Browser moderno (Chrome, Firefox, Edge)
- [ ] Terminal aberto em: `c:\BACKUP\DESENVOLVIMENTO\gestaoeklesia`

---

## 🚀 Passo 1: Iniciar o Servidor de Desenvolvimento

**Terminal 1 (npm run dev)**:
```powershell
cd 'c:\BACKUP\DESENVOLVIMENTO\gestaoeklesia'
npm run dev
```

**Resultado Esperado**:
```
▲ Next.js 16.0.5 (Turbopack)
  - Local:        http://localhost:3000
  - Environments: .env.local

✓ Ready in 2.5s
```

✅ Se vir "Ready", o servidor está funcionando.  
❌ Se vir erro, verifique `.env.local`

---

## 🌐 Passo 2: Acessar a Aplicação

1. Abra seu navegador
2. Navegue para: `http://localhost:3000`
3. Faça login como admin
4. Clique em "Admin" ou acesse `/admin`

---

## 📋 Passo 3: Preparar Dados de Teste (2 opções)

### Opção A: Usar Pré-Cadastro Existente (Rápido)

1. Na página `/admin`, procure por seção "Pré-Cadastros Pendentes"
2. Se houver registros, continue para Passo 4
3. Se não houver, use Opção B

### Opção B: Criar Novo Pré-Cadastro via SQL

1. Abra Supabase Dashboard
2. Vá para SQL Editor
3. Cole este SQL:

```sql
INSERT INTO pre_registrations (
  id, 
  organization_id,
  ministry_name, 
  pastor_name, 
  email, 
  whatsapp,
  created_at
) VALUES (
  gen_random_uuid(),
  '550e8400-e29b-41d4-a716-446655440000', -- Seu organization_id
  'Ministério de Teste',
  'Pastor Test',
  'test@example.com',
  '+55 11 99999-9999',
  NOW()
);
```

4. Clique "Run"
5. Volte para `/admin` e recarregue

---

## 🧪 Passo 4: Teste 1 - Aprovação Básica

### O que fazer:
1. Na página `/admin`, localize o pré-cadastro de teste
2. Clique no botão **"Aprovar"**
3. Observe o que acontece

### O que esperar:
- ✅ Botão desaparece ou fica disabled
- ✅ Notificação "✓ Registrado no painel de atendimento!"
- ✅ Browser redireciona para `/admin/atendimento?focus=...`
- ✅ Modal abre automaticamente (dentro de 1-2 segundos)

### Se falhar:
- Abra F12 (DevTools)
- Vá para "Network" tab
- Procure pelo request `POST /api/v1/admin/attendance/init`
- Se houver erro 500, verifique logs do servidor (Terminal 1)

---

## ✏️ Passo 5: Teste 2 - Edição de Dados

### O que fazer:
1. Modal está aberto (da etapa anterior)
2. Edite o campo "Nome do Ministério"
   - Mudou de "Ministério de Teste" para "Ministério Editado"?
3. Edite o campo "Quantidade de Templos"
   - Mude para um número (ex: 5)
4. Edite o campo "Quantidade de Membros"
   - Mude para um número (ex: 150)

### O que esperar:
- ✅ Campos aceitam digitação
- ✅ Valores aparecem em tempo real
- ✅ Sem mensagens de erro
- ✅ Sem reload não solicitado

### Se falhar:
- Campos não aceitam input? Verifique se são readonly
- Erros no console (F12)? Documente o erro

---

## 📊 Passo 6: Teste 3 - Mudança de Status

### O que fazer:
1. Modal ainda aberto
2. Localize o dropdown "Status"
3. Mude de "Não Atendido" para "📞 Em Atendimento"

### O que esperar:
- ✅ Dropdown abre com 6 opções
- ✅ Status muda sem erro
- ✅ Sem reload não solicitado

### Testes Adicionais:
Tente selecionar cada status:
- ❌ Não Atendido
- 📞 Em Atendimento
- 💰 Orçamento Enviado
- 📄 Gerando Contrato
- ✅ Finalizado - Positivo
- ❌ Finalizado - Negativo

Todos devem aceitar seleção sem erro.

---

## 📝 Passo 7: Teste 4 - Adicionar Observação

### O que fazer:
1. Modal ainda aberto
2. Localize o campo "Observações" (textarea)
3. Digite uma nota:
   ```
   Teste da observação - 8 de janeiro
   ```

### O que esperar:
- ✅ Aceita múltiplas linhas
- ✅ Sem limite aparente de caracteres
- ✅ Texto aparece em tempo real

---

## 💾 Passo 8: Teste 5 - Salvar Mudanças

### O que fazer:
1. Modal com dados editados
2. Clique no botão **"💾 Salvar Mudanças"**
3. Observe o que acontece (leva ~2 segundos)

### O que esperar:
- ✅ Modal fecha automaticamente (após 2-3 segundos)
- ✅ Dashboard recarrega
- ✅ Sem mensagens de erro
- ✅ Registro aparece com novo status

### Se falhar:
- Modal não fecha? Verifique F12 → Console
- Procure por erro na aba "Network" → filtrar por `PUT`
- Deve haver 2 PUTs: attendance e pre-registrations

---

## 🔍 Passo 9: Validar Dados Salvos (Banco de Dados)

### 9A: Verificar attendance_status

1. Abra Supabase Dashboard
2. Vá para "Tables" → "attendance_status"
3. Procure pelo registro com seu pre_registration_id

Deve conter:
- ✅ status = "in_progress" (o que selecionou)
- ✅ notes = observação digitada
- ✅ updated_at = data/hora recente

### 9B: Verificar pre_registrations

1. Vá para "Tables" → "pre_registrations"
2. Procure pelo seu ID

Deve conter:
- ✅ ministry_name = "Ministério Editado"
- ✅ quantity_temples = 5
- ✅ quantity_members = 150
- ✅ updated_at = data/hora recente

### 9C: Verificar attendance_history

1. Vá para "Tables" → "attendance_history"
2. Procure pelos últimos registros

Deve ter 1 novo registro com:
- ✅ from_status = "not_contacted" (ou anterior)
- ✅ to_status = "in_progress"
- ✅ notes = observação digitada
- ✅ created_at = data/hora muito recente

---

## 🔄 Passo 10: Teste 6 - Reabrir e Verificar Persistência

### O que fazer:
1. Dashboard está visível
2. Clique no card do registro (qualquer parte)
3. Modal abre novamente

### O que esperar:
- ✅ Modal abre
- ✅ Todos os dados estão como salvos:
  - Nome do ministério = "Ministério Editado"
  - Templos = 5
  - Membros = 150
  - Status = "Em Atendimento"
  - Observação = texto que digitou
- ✅ Sem reloads não solicitados

---

## 📊 Passo 11: Teste 7 - Fluxo Completo Novamente

Repita os passos 4-10 com um **novo pré-cadastro**:

1. Crie outro pré-cadastro via SQL (copie o INSERT anterior)
2. Clique Aprovar
3. Preencha dados diferentes (nome, templos, membros, status)
4. Salve
5. Verifique no banco

Isso valida que o sistema funciona para **múltiplos registros**.

---

## 🧮 Passo 12: Teste 8 - Performance

Use F12 → Performance tab:

1. Faça um "Salvar Mudanças"
2. Clique no ícone "Record"
3. Salve novamente
4. Pare o recording

Deve completar em < 2 segundos:
- ✅ < 500ms: Muito bom
- ✅ < 1s: Bom
- ⚠️ 1-2s: Aceitável
- ❌ > 2s: Verificar logs

---

## ❌ Passo 13: Teste 9 - Testes de Erro

### 9A: Email Inválido

1. Edite campo "Email"
2. Digite: `invalido` (sem @)
3. Salve

Esperado:
- ✅ Pode salvar (validação é básica)
- ✅ Ou mostra erro (se implementado)

### 9B: Campo Vazio Obrigatório

1. Edite campo "Nome do Ministério"
2. Deixe vazio
3. Salve

Esperado:
- ✅ Pode salvar (sem validação obrigatória)
- ✅ Ou mostra erro (se implementado)

### 9C: Número Negativo

1. Edite "Quantidade de Templos"
2. Digite: `-5`
3. Salve

Esperado:
- ✅ Pode salvar
- ✅ Ou converte para positivo
- ✅ Ou mostra erro

---

## 📋 Checklist de Testes Completo

```
[ ] 1. Servidor starts sem erros
[ ] 2. Página /admin carrega
[ ] 3. Widget de pré-cadastros aparece
[ ] 4. Botão "Aprovar" funciona
[ ] 5. Redireciona para dashboard
[ ] 6. Modal abre automaticamente
[ ] 7. Campos estão pré-populados
[ ] 8. Editar ministério funciona
[ ] 9. Editar templos funciona
[ ] 10. Editar membros funciona
[ ] 11. Editar email funciona
[ ] 12. Editar whatsapp funciona
[ ] 13. Mudança de status funciona
[ ] 14. Adicionar observação funciona
[ ] 15. Salvar mudanças funciona
[ ] 16. Modal fecha após salvar
[ ] 17. Dashboard recarrega
[ ] 18. Reabrir modal mostra dados salvos
[ ] 19. Banco: attendance_status atualizado
[ ] 20. Banco: pre_registrations atualizado
[ ] 21. Banco: attendance_history criado
[ ] 22. Teste com 2º pré-cadastro
[ ] 23. Performance < 2 segundos
[ ] 24. Teste de error handling
```

---

## 🔧 Troubleshooting

### Erro: "Modal não abre automaticamente"
**Solução**: 
- Recarregue F5
- Verifique URL tem `?focus=...`
- Abra F12 → Console, procure por erros

### Erro: "Dados não salvam"
**Solução**:
- F12 → Network tab
- Procure por PUT requests
- Verifique status (200 OK vs erro)
- Verifique console para mensagens

### Erro: "Campo não aceita input"
**Solução**:
- Verifique se é readonly: `readOnly={false}`
- Verifique se há JavaScript error
- Tente em outro navegador

### Erro: "Servidor não inicia"
**Solução**:
- Verifique `.env.local` tem SUPABASE_URL e SERVICE_ROLE_KEY
- Verifique porta 3000 não está ocupada
- Limpe `node_modules` e reinstale: `npm install`

---

## 📊 Relatório de Teste

Depois de completar todos os testes, preencha este relatório:

```
DATA: _____/_____/_____
TESTADOR: _________________
NAVEGADOR: Chrome / Firefox / Edge
VERSÃO: 2.0

RESULTADOS:
Aprovação funciona:         [ ] SIM  [ ] NÃO
Modal abre automático:      [ ] SIM  [ ] NÃO
Edição de dados funciona:   [ ] SIM  [ ] NÃO
Status muda corretamente:   [ ] SIM  [ ] NÃO
Observação salva:           [ ] SIM  [ ] NÃO
Banco atualiza correto:     [ ] SIM  [ ] NÃO
Performance adequada:       [ ] SIM  [ ] NÃO
Sem erros no console:       [ ] SIM  [ ] NÃO
Sem memory leaks:           [ ] SIM  [ ] NÃO
Histórico registrado:       [ ] SIM  [ ] NÃO

OVERALL STATUS: [ ] APROVADO ✅  [ ] COM FALHAS ⚠️  [ ] NÃO APROVADO ❌

OBSERVAÇÕES:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

---

## ✅ Sucesso!

Se todos os testes passaram:
1. Anote a data/hora
2. Documente qualquer aviso
3. Proceda para próxima fase (deploy em staging)

---

## 📞 Contato/Dúvidas

Consulte:
- `GUIA_RAPIDO_PAINEL_V2.md` - Como usar
- `DOCUMENTACAO_TECNICA_PAINEL_V2.md` - Detalhes técnicos
- `EXEMPLOS_TESTE_PAINEL_V2.json.md` - Payloads de exemplo

---

**Tempo Estimado**: 30-60 minutos  
**Dificuldade**: Baixa  
**Resultado Esperado**: ✅ Todos os testes passarem  

**Boa sorte! 🍀**
