# 📚 Documentação - Nomenclaturas Dinâmicas v2.0

## 🎯 Documentos por Caso de Uso

### 👤 **Usuário Final - Quero Usar o Sistema**
1. Comece por: **[README.md](README.md)** - 5 min
2. Depois: **[GUIA_TESTES.md](GUIA_TESTES.md)** - 30 min (executar testes)
3. Referência rápida: **[COMPARACAO_v1_vs_v2.md](COMPARACAO_v1_vs_v2.md)**

### 👨‍💻 **Desenvolvedor - Quero Entender a Implementação**
1. Comece por: **[SUMARIO_CORRECAO.md](SUMARIO_CORRECAO.md)** - 5 min (visão geral da v2.0)
2. Depois: **[IMPLEMENTACAO_COMPLETA_v2.md](IMPLEMENTACAO_COMPLETA_v2.md)** - 15 min
3. Aprofundar: **[MAPA_PLACEHOLDERS.md](MAPA_PLACEHOLDERS.md)** - 10 min
4. Detalhes técnicos: **[CORRECAO_DIVISAO3.md](CORRECAO_DIVISAO3.md)** - 10 min

### 🐛 **QA / Testador - Validar Funcionalidade**
1. Ir direto: **[GUIA_TESTES.md](GUIA_TESTES.md)** - Teste tudo
2. Referência: **[COMPARACAO_v1_vs_v2.md](COMPARACAO_v1_vs_v2.md)**
3. Checklist: Seção "Checklist de Validação" em GUIA_TESTES.md

### 🔧 **Manutenção / Debugging - Algo Não Funciona**
1. Checklist rápido: **[SUMARIO_CORRECAO.md](SUMARIO_CORRECAO.md)** - Troubleshooting
2. Detalhes: **[CORRECAO_DIVISAO3.md](CORRECAO_DIVISAO3.md)** - Seção Troubleshooting
3. Verificar dados: **[MAPA_PLACEHOLDERS.md](MAPA_PLACEHOLDERS.md)** - Estrutura de dados

---

## 📑 Lista de Documentos

| # | Documento | Objetivo | Tempo |
|---|-----------|----------|-------|
| 1 | [**INDEX.md**](INDEX.md) | Índice geral da documentação | 2 min |
| 2 | [**README.md**](README.md) | Resumo rápido de como usar | 5 min |
| 3 | [**SUMARIO_CORRECAO.md**](SUMARIO_CORRECAO.md) | Resumo da correção v2.0 | 5 min |
| 4 | [**COMPARACAO_v1_vs_v2.md**](COMPARACAO_v1_vs_v2.md) | Visual: antes vs depois | 5 min |
| 5 | [**CORRECAO_DIVISAO3.md**](CORRECAO_DIVISAO3.md) | Detalhes técnicos da correção | 10 min |
| 6 | [**IMPLEMENTACAO_COMPLETA_v2.md**](IMPLEMENTACAO_COMPLETA_v2.md) | Documentação técnica completa v2.0 | 15 min |
| 7 | [**MAPA_PLACEHOLDERS.md**](MAPA_PLACEHOLDERS.md) | Referência de placeholders | 10 min |
| 8 | [**GUIA_TESTES.md**](GUIA_TESTES.md) | 6 cenários de teste passo a passo | 30 min |

---

## 🚀 Quick Start

### Para Usuários
```
1. Ir em: Configurações → Nomenclaturas
2. Configurar: divisaoPrincipal, divisaoSecundaria, divisaoTerciaria
3. Clicar: "✓ Salvar Nomenclaturas"
4. Ir em: Configurações → Cartões
5. Editar template e usar: {divisao3}, {divisao3_valor}
6. Resultado: Nomenclaturas dinâmicas funcionando! ✅
```

### Para Desenvolvedores
```
PROBLEMA v1.0: {divisao3} pegava valor em vez de rótulo
CAUSA: {divisao3} estava em PLACEHOLDERS_CONFIG com campo: 'congregacao'
SOLUÇÃO v2.0: Removido de PLACEHOLDERS_CONFIG + tratamento especial ANTES forEach
RESULTADO: {divisao3} agora mostra rótulo, {divisao3_valor} mostra valor ✅
```

---

## 📊 O Que Funciona Agora (v2.0)

### ✅ Nomenclaturas
- Salvam em localStorage
- Persistem após reload
- Carregam ao montar página

### ✅ Placeholders
- `{divisao1}` → rótulo dinâmico
- `{divisao2}` → rótulo dinâmico
- `{divisao3}` → rótulo dinâmico **[CORRIGIDO v2.0]**
- `{divisao3_valor}` → valor real do membro

### ✅ Cartões
- Mostram placeholders substituídos corretamente
- Refletem mudanças de nomenclaturas
- Funcionam em visualização e batch printing

### ✅ API Backend
- Processa nomenclaturas
- Substitui placeholders corretamente
- Suporta batch printing

### ✅ Sem Erros
- Nenhum erro de compilação
- Nenhuma duplicação de código
- Sem conflitos de placeholders

---

## 🔍 Estrutura de Arquivos

```
docs/06_NOMENCLATURAS_DINAMICAS/
├── INDEX.md                              ← Você está aqui
├── README.md                             ← Resumo rápido
├── SUMARIO_CORRECAO.md                   ← Correção v2.0 (resumido)
├── COMPARACAO_v1_vs_v2.md               ← Visual antes/depois
├── CORRECAO_DIVISAO3.md                  ← Detalhes técnicos correção
├── IMPLEMENTACAO_COMPLETA.md             ← Documentação v1.0 (legado)
├── IMPLEMENTACAO_COMPLETA_v2.md          ← Documentação v2.0 (ATUAL)
├── MAPA_PLACEHOLDERS.md                  ← Referência técnica
└── GUIA_TESTES.md                        ← Testes 6 cenários
```

---

## ⚡ Mudanças Principais v1.0 → v2.0

| Aspecto | v1.0 | v2.0 |
|---------|------|------|
| `{divisao3}` em PLACEHOLDERS_CONFIG | ✓ | ✗ |
| Tratamento especial para `{divisao3}` | ✗ | ✓ ANTES forEach |
| `{divisao3}` mostra | Valor ❌ | Rótulo ✅ |
| `{divisao3_valor}` mostra | Valor ✅ | Valor ✅ |
| Funciona | NÃO | SIM ✅ |

---

## 🎓 Leitura Recomendada por Tempo

### ⏱️ 5 minutos
- [README.md](README.md)
- [SUMARIO_CORRECAO.md](SUMARIO_CORRECAO.md)

### ⏱️ 15 minutos
- Anterior + [COMPARACAO_v1_vs_v2.md](COMPARACAO_v1_vs_v2.md)
- Anterior + [CORRECAO_DIVISAO3.md](CORRECAO_DIVISAO3.md)

### ⏱️ 30 minutos
- Anterior + [IMPLEMENTACAO_COMPLETA_v2.md](IMPLEMENTACAO_COMPLETA_v2.md)
- Anterior + [MAPA_PLACEHOLDERS.md](MAPA_PLACEHOLDERS.md)

### ⏱️ 1 hora
- Leia TODOS os documentos acima

### ⏱️ 1.5 horas
- Tudo anterior + [GUIA_TESTES.md](GUIA_TESTES.md) (executar testes)

---

## 📌 Pontos-Chave a Lembrar

1. **`{divisao3}` vs `{divisao3_valor}`**
   - `{divisao3}` = Rótulo dinâmico (IGREJA, CONGREGAÇÃO, TEMPLO)
   - `{divisao3_valor}` = Valor real do membro (Templo Graça, etc)

2. **Onde estão salvos**
   - Nomenclaturas: `localStorage['nomenclaturas']`
   - Membros: `localStorage['membros']`

3. **Como funciona v2.0**
   - Tratamento ESPECIAL ANTES do forEach para `{divisao3}`
   - Isso evita conflito com `{divisao3_valor}`

4. **Para testar**
   - Salvar nomenclaturas em Configurações
   - Usar `{divisao3}: {divisao3_valor}` em template
   - Ver resultado no cartão

---

## 🆘 Preciso de Ajuda

| Pergunta | Documento |
|----------|-----------|
| Como usar? | [README.md](README.md) |
| O que mudou? | [SUMARIO_CORRECAO.md](SUMARIO_CORRECAO.md) |
| Antes e depois? | [COMPARACAO_v1_vs_v2.md](COMPARACAO_v1_vs_v2.md) |
| Por que funciona? | [CORRECAO_DIVISAO3.md](CORRECAO_DIVISAO3.md) |
| Detalhes técnicos? | [IMPLEMENTACAO_COMPLETA_v2.md](IMPLEMENTACAO_COMPLETA_v2.md) |
| Qual placeholder usar? | [MAPA_PLACEHOLDERS.md](MAPA_PLACEHOLDERS.md) |
| Como testar? | [GUIA_TESTES.md](GUIA_TESTES.md) |

---

## ✨ Versão Atual

- **Versão:** 2.0
- **Status:** ✅ FUNCIONANDO PERFEITAMENTE
- **Última atualização:** 31/12/2025
- **Todos os testes:** ✅ PASSANDO
- **Erros de compilação:** ❌ NENHUM
- **Pronto para produção:** ✅ SIM

---

## 📞 Changelog

### v2.0 (31/12/2025) - CORREÇÃO IMPLEMENTADA
- ✅ Removido `{divisao3}` de PLACEHOLDERS_CONFIG
- ✅ Adicionado tratamento especial ANTES do forEach
- ✅ `{divisao3}` agora mostra rótulo corretamente
- ✅ Sem conflitos com `{divisao3_valor}`
- ✅ Funciona em Frontend e Backend
- ✅ Funciona em Batch Printing

### v1.0 (Inicial)
- ✓ Nomenclaturas salvam em localStorage
- ✗ `{divisao3}` mostra valor em vez de rótulo (BUG)
- ✓ `{divisao3_valor}` funciona

---

**Criado por:** Sistema de Documentação  
**Versão:** 2.0  
**Status:** ✅ ESTÁVEL
