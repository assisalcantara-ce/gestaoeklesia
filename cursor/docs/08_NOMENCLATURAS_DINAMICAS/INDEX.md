# 06 - Nomenclaturas Dinâmicas 🏷️

## 📋 Índice de Documentação

### 🚀 Comece Aqui
1. **[README.md](README.md)** - Resumo rápido e como usar
   - Para usuários que querem entender rapidamente
   - 5 minutos de leitura

### 📖 Documentação Completa
2. **[IMPLEMENTACAO_COMPLETA.md](IMPLEMENTACAO_COMPLETA.md)** - Detalhes técnicos
   - Para desenvolvedores que querem entender a implementação
   - Arquivos modificados, estrutura de dados, testes realizados
   - 15 minutos de leitura

3. **[MAPA_PLACEHOLDERS.md](MAPA_PLACEHOLDERS.md)** - Referência técnica dos placeholders
   - Para quem precisa entender como funcionam os placeholders
   - Fluxo de substituição, casos de uso, diferenças
   - 10 minutos de leitura

### 🧪 Testes e Validação
4. **[GUIA_TESTES.md](GUIA_TESTES.md)** - Passo a passo de testes
   - Para validar se tudo funciona corretamente
   - 6 cenários diferentes com instruções detalhadas
   - 30 minutos para executar

---

## 🎯 O Que Foi Implementado?

**Nomenclaturas Dinâmicas** - Um sistema onde os rótulos de divisões organizacionais (Supervisão/Regional, Campo/Setor, Igreja/Congregação) são:

1. ✅ **Configuráveis** em `Configurações → Nomenclaturas`
2. ✅ **Persistentes** - salvos em localStorage
3. ✅ **Dinâmicos** - refletem automaticamente nos cartões
4. ✅ **Placeholders Novos** - `{divisao3}` (rótulo) e `{divisao3_valor}` (valor)

---

## 📚 Documentação por Perfil

### 👤 **Usuário Final**
Quer usar o sistema de nomenclaturas:
- Comece com: [README.md](README.md)
- Depois leia: [GUIA_TESTES.md](GUIA_TESTES.md) - seção "Como usar"

### 👨‍💻 **Desenvolvedor**
Quer entender como funciona ou fazer manutenção:
- Comece com: [IMPLEMENTACAO_COMPLETA.md](IMPLEMENTACAO_COMPLETA.md)
- Depois consulte: [MAPA_PLACEHOLDERS.md](MAPA_PLACEHOLDERS.md)
- Para testar: [GUIA_TESTES.md](GUIA_TESTES.md)

### 🔧 **QA / Testador**
Quer validar a funcionalidade:
- Vá direto para: [GUIA_TESTES.md](GUIA_TESTES.md)
- Use o checklist de validação

---

## 🔄 Fluxo Rápido

```
1. Configurar Nomenclaturas
   Configurações → Nomenclaturas
   Editar → Salvar

2. Adicionar Placeholders em Template
   Configurações → Cartões
   Editar template → Adicionar {divisao3} ou {divisao3_valor}

3. Visualizar no Cartão
   Selecionar membro → Ver resultado
```

---

## 📝 Arquivos Modificados

| Arquivo | O Que Mudou |
|---------|-----------|
| `src/app/configuracoes/nomenclaturas/page.tsx` | Adicionada persistência em localStorage |
| `src/app/configuracoes/cartoes/page.tsx` | Adicionado `{divisao3_valor}` a PLACEHOLDERS_DISPONIVEIS |
| `src/lib/cartoes-utils.ts` | Adicionada lógica de substituição dinâmica |
| `src/app/api/cartoes/substituir-placeholders/route.ts` | Atualizada para suportar {divisao3_valor} |

---

## ✅ Status da Implementação

- [x] Nomenclaturas salvam em localStorage
- [x] Nomenclaturas carregam ao montar página
- [x] Placeholders `{divisao1}`, `{divisao2}`, `{divisao3}` funcionam
- [x] Novo placeholder `{divisao3_valor}` implementado
- [x] Frontend substitui dinamicamente
- [x] Backend suporta substituição
- [x] Documentação completa criada
- [x] Testes validados

**Status Geral: ✅ PRONTO PARA PRODUÇÃO**

---

## 🚨 Troubleshooting Rápido

| Problema | Solução |
|----------|---------|
| Nomenclaturas não salvam | Verificar localStorage habilitado |
| `{divisao3}` aparece literal | Recarregar página |
| Placeholders não substituem | Consultar [MAPA_PLACEHOLDERS.md](MAPA_PLACEHOLDERS.md) |
| Dúvida sobre funcionamento | Ler [IMPLEMENTACAO_COMPLETA.md](IMPLEMENTACAO_COMPLETA.md) |

---

## 📞 Suporte

Para dúvidas ou problemas:
1. Consulte a documentação relevante acima
2. Execute os testes em [GUIA_TESTES.md](GUIA_TESTES.md)
3. Verifique o console do navegador para erros

---

**Última atualização:** 2024  
**Versão:** 1.0  
**Status:** ✅ Estável
