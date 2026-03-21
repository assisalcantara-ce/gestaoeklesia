# 🎫 Guia Rápido - Sistema de Suporte

## Status Atual

✅ **Página de Suporte** está **100% funcional e pronta para uso**

## 🚀 Como Usar

### 1️⃣ Primeira Vez - Criar a Tabela de Suporte

Quando você acessar a página `/suporte`, se a tabela não existir, você verá uma mensagem de erro:

```
⚠️ Tabela de suporte ainda não foi criada. Clique no painel de migração para criar.
👉 Solução: Procure pelo painel azul no canto inferior direito da tela e clique em "✨ Criar Tabela"
```

**O que fazer:**
1. Procure pelo **painel azul** no **canto inferior direito** da tela
2. Clique no botão **"✨ Criar Tabela"**
3. Espere a mensagem de sucesso (✅)
4. **Recarregue a página** (F5 ou Ctrl+R)
5. Pronto! A tabela foi criada e a página funcionará normalmente

> **Nota:** Este é um processo **único** - você só precisa fazer isso uma vez.

### 2️⃣ Usar o Sistema de Suporte

Depois que a tabela for criada, você pode:

#### ✏️ Abrir um Novo Ticket
1. Clique no botão **"+ Abrir Novo Ticket"**
2. Preencha os campos:
   - **Título** (até 100 caracteres) - breve descrição do assunto
   - **Descrição** (até 500 caracteres) - detalhes do problema
   - **Categoria** - selecione a mais apropriada:
     - 🔷 Geral
     - 🔶 Bugs/Erros
     - 🔸 Funcionalidade
     - 🟠 Performance
     - 🔴 Segurança
     - 📊 Dados
     - 🔗 Integração
     - 📝 Outro
   - **Prioridade** - escolha o nível de urgência:
     - 🟢 Baixa
     - 🟡 Média
     - 🟠 Alta
     - 🔴 Crítica
3. Clique em **"Enviar Ticket"**
4. Seu ticket aparecerá na lista abaixo

#### 📋 Ver Seus Tickets
- **Listar todos:** Deixe o filtro em "Todos os Status"
- **Filtrar por status:** Use o dropdown para ver apenas:
  - 🟦 **Aberto** - ticket recém criado
  - 🟨 **Em Progresso** - sendo atendido
  - 🟩 **Resolvido** - problema solucionado
  - ⬜ **Fechado** - finalizado

#### 🔍 Ver Detalhes
Clique em qualquer ticket na lista para ver:
- Informações completas
- Status atual
- Data de criação
- Última atualização
- Modal com todos os detalhes

## 📋 Categorias Disponíveis

| Categoria | Descrição | Uso |
|-----------|-----------|-----|
| **Geral** | Dúvidas gerais | Perguntas simples |
| **Bugs/Erros** | Erros no sistema | Comportamento inesperado |
| **Funcionalidade** | Novas funcionalidades | Sugestões e melhorias |
| **Performance** | Lentidão | Sistema lento ou travado |
| **Segurança** | Problemas de segurança | Vulnerabilidades ou acesso indevido |
| **Dados** | Problemas com dados | Dados perdidos ou inconsistentes |
| **Integração** | Integração com sistemas | Problemas de sincronização |
| **Outro** | Outros assuntos | Não se encaixa nas opções acima |

## 🎯 Prioridades

- 🟢 **Baixa** - Pode esperar algumas semanas
- 🟡 **Média** - Importante, preferível resolver em dias
- 🟠 **Alta** - Urgente, impacta operação
- 🔴 **Crítica** - Emergencial, pede atenção imediata

## 🔧 Se Algo Não Funcionar

### Erro: "Tabela não encontrada"
**Solução:**
1. Clique em "✨ Criar Tabela" no painel azul
2. Se não ver o painel, verifique se está em **modo desenvolvimento**
3. Recarregue a página

### Erro: "Falha ao enviar ticket"
**Possíveis causas:**
1. Você não está autenticado - faça login primeiro
2. A tabela foi deletada - recrie com o painel de migração
3. Problema de conexão - tente novamente em alguns segundos

### Tickets não aparecem
1. Verifique o filtro de status
2. Crie um novo ticket como teste
3. Se ainda não funcionar, recarregue a página

## 📊 Verificação do Painel de Migração

O painel azul no canto inferior direito oferece:

- **🔍 Verificar Tabela**: Informa se a tabela existe
- **✨ Criar Tabela**: Cria a tabela automaticamente
- **Ver SQL**: Mostra o comando SQL usado (para poder executar manualmente se necessário)

## 🎓 Boas Práticas

✅ **Faça:**
- Descrever o problema detalhadamente
- Incluir passos para reproduzir o erro
- Indicar a prioridade corretamente
- Usar a categoria mais apropriada

❌ **Evite:**
- Títulos muito longos ou vagos
- Descrições sem detalhes
- Marcar tudo como "Crítico"
- Usar categorias erradas

## 🔐 Segurança & Privacidade

- ✅ Apenas você vê seus próprios tickets
- ✅ Dados criptografados no Supabase
- ✅ Controle de acesso via RLS (Row Level Security)
- ✅ Sem dados sensíveis são preservados em log

## 📞 Suporte Técnico

Se o sistema de suporte não funcionar:
1. Verifique se está logado
2. Abra o console do navegador (F12) e procure por erros
3. Tente em outro navegador
4. Limpe o cache e cookies do site
5. Entre em contato com o administrador do sistema

## 📱 Compatibilidade

- ✅ Desktop (Chrome, Firefox, Safari, Edge)
- ✅ Tablet (iPad, Android)
- ✅ Mobile (iOS, Android)

---

**Versão:** 1.0  
**Última atualização:** Janeiro 2026  
**Status:** ✅ Pronto para Produção
