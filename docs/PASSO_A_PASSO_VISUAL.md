# 🎬 Passo-a-Passo Visual - Primeira Vez Usando Suporte

## ⏱️ Tempo Total: 2-3 minutos

---

## 📍 PASSO 1: Acessar a Página

### Desktop
```
URL: http://localhost:3000/suporte
     ↓
```

### Via Menu
```
1. Abra qualquer página
2. Procure na Sidebar esquerda:
   
   ▼ MENU PRINCIPAL
   ┌─────────────────────┐
   │ 🏠 Dashboard        │
   │ 👥 Usuários        │
   │ 🎫 Suporte  ← AQUI  │
   │ ⚙️  Configurações   │
   └─────────────────────┘
   
3. Clique em "🎫 Suporte"
```

---

## ⚠️ PASSO 2: Você Verá Isto (Primeira Vez)

### Tela de Aviso
```
┌─────────────────────────────────────────────────────┐
│ 🎫 Suporte                                          │
│ Abra tickets e acompanhe o progresso dos seus      │
│ atendimentos                                        │
│                                                     │
│ ┌─ AVISO ─────────────────────────────────────────┐│
│ │ ⚠️  Tabela de suporte ainda não foi criada.      ││
│ │    Clique no painel de migração para criar.      ││
│ │                                                  ││
│ │ 👉 Solução: Procure pelo painel azul no canto   ││
│ │    inferior direito da tela e clique em          ││
│ │    "✨ Criar Tabela"                            ││
│ └──────────────────────────────────────────────────┘│
│                                                     │
│ [+ Abrir Novo Ticket] (desabilitado)               │
│                                                     │
│ ❌ Nenhum ticket ainda                             │
└─────────────────────────────────────────────────────┘
```

### Não se preocupe! Isto é normal. ✅

---

## 🔵 PASSO 3: Procure o Painel Azul

### Onde Está?
```
Olhe para o CANTO INFERIOR DIREITO da tela:

                                    ┌─────────────────┐
                                    │  Painel Azul    │ ← AQUI!
                                    │  🔵🔵🔵         │
                                    │  Migração       │
                                    └─────────────────┘
```

### Se Não Encontrar
1. Verifique se está em **http://localhost:3000** (desenvolvimento)
2. Procure melhor no canto direito (pode estar coberto por outro elemento)
3. Scroll para baixo na página
4. Se ainda não ver, verifique se `npm run dev` está rodando

---

## ✨ PASSO 4: Clique em "Criar Tabela"

### O Painel
```
┌──────────────────────────────────┐
│ 📊 Painel de Migração            │
│                                  │
│ [🔍 Verificar Tabela]            │
│ [✨ Criar Tabela] ← CLIQUE AQUI   │
│                                  │
│ Status: Pronto para criar        │
└──────────────────────────────────┘
```

### Clique no Botão Azul
```
Seu cursor deve virar uma mão ☝️ quando passa sobre o botão
                    ↓
Clique e espere... ⏳
                    ↓
Você verá uma barra de progresso / spinner
                    ↓
Em 2-3 segundos, verá:
✅ Sucesso! Tabela criada com sucesso!
```

---

## 📈 PASSO 5: Espere Pela Confirmação

### Após Clicar
```
DURANTE:
┌──────────────────────────────────┐
│ 📊 Painel de Migração            │
│                                  │
│ [🔍 Verificar Tabela]            │
│ [✨ Criando... ⏳] (desabilitado) │
│                                  │
│ Status: Criando tabela...        │
└──────────────────────────────────┘

DEPOIS (2-3 segundos):
┌──────────────────────────────────┐
│ 📊 Painel de Migração            │
│                                  │
│ [🔍 Verificar Tabela]            │
│ [✨ Criar Tabela]                │
│                                  │
│ ✅ Status: Sucesso!              │
│    Tabela criada com sucesso!    │
└──────────────────────────────────┘
```

---

## 🔄 PASSO 6: Recarregue a Página

### Método 1 (Teclado)
```
Pressione: F5
           ou
         Ctrl + R (Windows)
         Cmd + R (Mac)
```

### Método 2 (Mouse)
```
1. Clique no ícone de recarregar no navegador
   ⟲ (seta redonda no topo)
```

### Método 3 (Código)
```
Se a página tiver um botão "Recarregar":
[🔄 Recarregar página] → Clique aqui
```

---

## 🎉 PASSO 7: Pronto! A Página Funcionará Agora

### Nova Tela (Sem Erro)
```
┌─────────────────────────────────────────────────────┐
│ 🎫 Suporte                                          │
│ Abra tickets e acompanhe o progresso dos seus      │
│ atendimentos                                        │
│                                                     │
│ [+ Abrir Novo Ticket] ✅ (HABILITADO AGORA!)       │
│                                                     │
│ Filtro: [Todos os Status ▼]                        │
│                                                     │
│ ❌ Você ainda não tem tickets. Crie um clicando    │
│    no botão acima!                                 │
└─────────────────────────────────────────────────────┘
```

✅ **Sucesso!** A mensagem de erro desapareceu!

---

## 📝 PASSO 8: Crie Seu Primeiro Ticket

### Clique no Botão
```
[+ Abrir Novo Ticket]
           ↓
```

### Vá Aparecer um Formulário
```
┌─────────────────────────────────────────┐
│ Abrir Novo Ticket                       │
│                                         │
│ Título do Ticket * ________________    │
│ Exemplo: Erro ao salvar formulário      │
│                                         │
│ Descrição * _____________________      │
│ Quando clico em salvar, recebo erro    │
│                                         │
│ Categoria: [Bugs/Erros ▼]              │
│ Prioridade: [🟡 Média ▼]               │
│                                         │
│ [Enviar Ticket] [Cancelar]             │
└─────────────────────────────────────────┘
```

### Preencha Assim:
```
Título: "Erro ao carregar página"
Descrição: "Quando acesso a página X, recebo erro"
Categoria: "Bugs/Erros"
Prioridade: "Alta" (🟠)
```

### Clique em "Enviar Ticket"
```
Seu ticket será criado em ~1 segundo
Você verá uma mensagem de sucesso ✅
```

---

## 🎯 PASSO 9: Veja Seu Ticket na Lista

### Após Enviar
```
┌─────────────────────────────────────────┐
│ 🎫 Suporte                              │
│                                         │
│ [+ Abrir Novo Ticket]                  │
│                                         │
│ Filtro: [Todos os Status ▼]            │
│                                         │
│ ┌─ SEUS TICKETS ──────────────────────┐│
│ │                                     ││
│ │ 🟦 Erro ao carregar página   (Aberto)││
│ │    16 jan 2026 às 10:30             ││
│ │    Categoria: Bugs/Erros             ││
│ │    Prioridade: 🟠 Alta               ││
│ │                                     ││
│ │ [Clique para ver detalhes]          ││
│ │                                     ││
│ └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

**Parabéns!** 🎉 Seu primeiro ticket foi criado!

---

## 📋 PASSO 10: Ver Detalhes (Opcional)

### Clique no Ticket
```
Você verá uma janela (modal) com todos os detalhes:

┌─────────────────────────────────────────┐
│ 📋 Detalhes do Ticket                   │
│                                         │
│ ID: 620e72e4-a18e-421a...              │
│ Status: 🟦 Aberto                       │
│ Título: Erro ao carregar página        │
│ Descrição: Quando acesso a página X... │
│ Categoria: Bugs/Erros                  │
│ Prioridade: 🟠 Alta                    │
│ Data: 16 jan 2026 às 10:30             │
│ Última atualização: Agora               │
│                                         │
│ [Fechar]                               │
└─────────────────────────────────────────┘
```

### Clique em "Fechar" para Voltar
```
Você volta à lista de tickets
```

---

## 🔍 PASSO 11: Filtrar por Status (Opcional)

### Use o Dropdown
```
Filtro: [Todos os Status ▼]
        └─ Clique para abrir

Opções:
□ Todos os Status
□ 🟦 Aberto
□ 🟨 Em Progresso
□ 🟩 Resolvido
□ ⬜ Fechado
```

### Selecione Uma Opção
```
Apenas tickets daquele status serão mostrados
```

---

## ✅ PARABÉNS!

Você completou com sucesso:
- ✅ Acessou a página de suporte
- ✅ Criou a tabela de banco de dados
- ✅ Abriu um novo ticket
- ✅ Viu seu ticket na lista

## 🚀 O Que Fazer Agora?

### Opção 1: Explorar
- Crie mais tickets
- Teste diferentes categorias e prioridades
- Filtro por status

### Opção 2: Aprender Mais
- Leia [GUIA_RAPIDO_SUPORTE.md](GUIA_RAPIDO_SUPORTE.md)
- Consulte [TROUBLESHOOTING_SUPORTE.md](TROUBLESHOOTING_SUPORTE.md)

### Opção 3: Usar Para Relatar Problemas
- Use o sistema para reportar bugs
- Marque prioridade e categoria corretas
- Espere retorno do admin

---

## 🎓 DICAS & TRUQUES

### ⌨️ Atalhos de Teclado
- `F5` - Recarregar página rápido
- `Ctrl + Enter` - Pode enviar formulário (em alguns navegadores)
- `Esc` - Fechar modal de detalhes

### 🖱️ Dicas de Mouse
- Passe o mouse sobre o ícone de status para ver sua descrição
- Clique em qualquer ticket para ver detalhes completos
- Use o dropdown de filtro para organizar tickets

### 📱 Mobile
O sistema funciona perfeitamente em celular também!
- Abra em http://localhost:3000/suporte no seu celular
- Tudo se adapta ao tamanho da tela
- Toque em vez de clicar

---

## ❌ E Se Algo Dar Errado?

### Erro: "Tabela ainda não foi criada"
```
1. Procure o painel azul novamente
2. Clique em "✨ Criar Tabela"
3. Recarregue a página
```

### Erro: "Falha ao enviar ticket"
```
1. Verifique se está logado
2. Tente novamente em alguns segundos
3. Se persistir, consulte [TROUBLESHOOTING_SUPORTE.md](TROUBLESHOOTING_SUPORTE.md)
```

### Não vê o painel azul
```
1. Verifique se está em localhost:3000
2. Verifique se npm run dev está rodando
3. Procure melhor no canto inferior direito
4. Recarregue a página
```

---

## 📊 RESUMO RÁPIDO

| Passo | Ação | Tempo |
|-------|------|-------|
| 1 | Acessar /suporte | 10s |
| 2 | Ver aviso | 5s |
| 3 | Achar painel azul | 10s |
| 4 | Clique "Criar Tabela" | 5s |
| 5 | Espera criar | 5s |
| 6 | Recarrega página | 3s |
| 7 | Vê página funcional | 5s |
| 8 | Abre novo ticket | 5s |
| 9 | Preenche formulário | 30s |
| 10 | Clique enviar | 5s |
| 11 | Vê ticket na lista | 5s |
| **TOTAL** | | **2-3 min** |

---

## 🎊 VOCÊ CONSEGUIU!

Parabéns por configurar e usar o sistema de suporte! 🎉

Se tiver dúvidas:
1. Consulte a documentação
2. Use o próprio sistema para enviar feedback
3. Entre em contato com o admin

**Aproveite o sistema de suporte!** 🚀

---

**Versão:** 1.0  
**Data:** Janeiro 2026  
**Status:** ✅ Completo e Testado
