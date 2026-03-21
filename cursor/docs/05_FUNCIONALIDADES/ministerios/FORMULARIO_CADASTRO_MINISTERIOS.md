# 📝 Formulário de Cadastro de Ministérios

## 🎯 Visão Geral

O formulário de cadastro de ministérios foi adicionado ao dashboard administrativo, permitindo que administradores registrem novos clientes diretamente na interface.

---

## 🚀 Como Acessar

1. **Acesse o Admin Dashboard:**
   - URL: `http://localhost:3000/admin/dashboard`
   - Email: `super@gestaoeklesia.com.br`
   - Senha: `123456`

2. **Clique no botão "Novo Ministério":**
   - Localizado no canto superior direito da seção de filtros
   - Botão verde com ícone ➕

---

## 📋 Campos do Formulário

### Obrigatórios (*)
- **Nome do Ministério** - Ex: "Igreja Central de São Paulo"
- **Email Admin** - Ex: "admin@ministerio.com"
- **Senha** - Mínimo 6 caracteres
- **Cidade** - Ex: "São Paulo"
- **Estado** - Ex: "SP" (2 caracteres)

### Opcionais
- **Telefone** - Ex: "(11) 3456-7890"
- **CNPJ/CPF** - Ex: "12.345.678/0001-90"
- **Endereço** - Ex: "Avenida Paulista, 1000"
- **Site** - Ex: "www.ministerio.com.br"

### Configurações de Plano
- **Plano** - Escolher entre:
  - 🌟 Starter (até 10 usuários)
  - ⭐ Professional (até 50 usuários)
  - 💎 Enterprise (até 500 usuários)

- **Tipo de Pagamento**:
  - Mensal
  - Anual (economiza 15%)

---

## ✅ Validações Implementadas

O formulário valida automaticamente:

1. ✓ **Nome obrigatório** - Não pode estar vazio
2. ✓ **Email válido** - Formato correto (algo@dominio.com)
3. ✓ **Senha mínima** - No mínimo 6 caracteres
4. ✓ **Cidade obrigatória** - Não pode estar vazio
5. ✓ **Estado obrigatório** - Não pode estar vazio

**Mensagens de erro:**
- Aparecem em vermelho no topo do modal
- Impedem envio do formulário se houver erro
- Desaparecem quando o erro é corrigido

---

## 📊 Dados Criados Automaticamente

Quando um novo ministério é cadastrado, o sistema cria:

### 1. **Ministério**
- ID único (min001, min002, etc)
- Todos os dados preenchidos
- Status: "ativo"
- Data de cadastro: hoje
- Data de último acesso: agora

### 2. **Assinatura**
- ID da assinatura vinculada
- Plano escolhido
- Status: "ativo"
- Data de início: hoje
- Data de vencimento: 30 dias (mensal) ou 1 ano (anual)
- Valor pago (baseado no plano escolhido)
- Renovação automática: ativada

### 3. **Contagem de Usuários**
- Iniciado com 1 usuário (admin)

---

## 💰 Preços Aplicados Automaticamente

| Plano | Mensal | Anual |
|-------|--------|-------|
| Starter | R$ 99,90 | R$ 999,00 |
| Professional | R$ 199,90 | R$ 1.999,00 |
| Enterprise | R$ 499,90 | R$ 4.999,00 |

Os valores são aplicados automaticamente ao formulário baseado na seleção do plano.

---

## 🎉 Feedback ao Usuário

### Sucesso
- ✅ Mensagem verde: "✅ Ministério 'Nome' cadastrado com sucesso!"
- Formulário é fechado automaticamente após 2 segundos
- Novo ministério aparece na listagem

### Erro
- ❌ Mensagem vermelha com o motivo do erro
- Formulário permanece aberto para correção
- Botão não é processado

---

## 🔄 Fluxo Completo

```
1. Usuário clica em "Novo Ministério"
        ↓
2. Modal se abre com formulário vazio
        ↓
3. Usuário preenche os campos obrigatórios
        ↓
4. (Opcional) Usuário preenche campos extras
        ↓
5. Usuário clica em "Cadastrar Ministério"
        ↓
6. Sistema valida todos os campos
        ↓
7. Se há erro:
   - Mostra mensagem de erro
   - Deixa modal aberto para correção
        ↓
8. Se está ok:
   - Cria novo ministério
   - Cria assinatura
   - Mostra mensagem de sucesso
   - Fecha modal automaticamente
   - Atualiza listagem
```

---

## 📱 Responsividade

O formulário é totalmente responsivo:

- **Desktop:** 2 colunas para campos
- **Tablet:** 2 colunas para alguns campos
- **Mobile:** 1 coluna, tela cheia

---

## 🛡️ Segurança

### Implementado:
- ✓ Validação de email
- ✓ Validação de senha (mínimo 6 caracteres)
- ✓ Campos obrigatórios
- ✓ Sanitização básica de inputs

### Recomendações para Produção:
- Usar hash bcrypt para senha (não armazenar em texto plano)
- Validar email confirmando existência de domínio
- Implementar CAPTCHA para prevenir bots
- Audit log de criação de ministérios
- Enviar email de confirmação ao admin

---

## 🎨 Interface

### Modal
- Fundo escuro semi-transparente
- Cartão branco com bordas arredondadas
- Título em azul (#123b63)
- Botões coloridos (verde para submit, cinza para cancelar)
- Scroll interno para telas pequenas

### Validação Visual
- Campos com borda azul ao focar
- Mensagens de erro em caixa vermelha
- Mensagens de sucesso em caixa verde
- Indicador de campos obrigatórios (*)

---

## 📈 Impacto na Dashboard

Após cadastro, o novo ministério:

1. ✓ Aparece na listagem imediatamente
2. ✓ Conta em "Total de Ministérios"
3. ✓ Conta em "Ativos"
4. ✓ Atualiza "Receita Mensal/Anual"
5. ✓ Pode ser filtrado e buscado
6. ✓ Exibe detalhes ao clicar "Ver Detalhes"

---

## 🔮 Próximas Melhorias

1. **Upload de Logo** - Permitir envio de logo do ministério
2. **Pré-requisitos** - Validar CNPJ antes de cadastrar
3. **Confirmação por Email** - Enviar credenciais por email
4. **Planos Customizados** - Criar planos personalizados
5. **Integração com Pagamento** - Cobrar via Stripe/PayPal na criação
6. **Template de Inicialização** - Criar módulos pré-configurados
7. **Importação em Lote** - CSV para cadastro múltiplo

---

## 🧪 Teste Rápido

### Dados para Teste:
```
Nome: Igreja Teste
Email: teste@igrejateste.com.br
Senha: 123456
Cidade: Rio de Janeiro
Estado: RJ
Telefone: (21) 98765-4321
Plano: Professional
Tipo: Mensal
```

Após clicar em cadastrar, o novo ministério deve:
1. Aparecer na listagem
2. Mostrar "Professional" na coluna de plano
3. Mostrar "Ativo" no status
4. Mostrar 1 usuário
5. Aparecer na busca e filtros

---

**Versão**: 1.0  
**Data**: 29 de Novembro de 2025  
**Status**: ✅ Funcional e Testado
