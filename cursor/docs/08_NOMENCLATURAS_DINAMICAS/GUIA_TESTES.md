# Guia de Testes - Nomenclaturas Dinâmicas

## Teste 1: Salvar e Recuperar Nomenclaturas

### Pré-requisitos
- Aplicação rodando em `http://localhost:3000`
- Browser com console aberto (F12)

### Passo a Passo

1. **Limpar localStorage** (opcional - para teste limpo)
   ```javascript
   // No console:
   localStorage.removeItem('nomenclaturas');
   location.reload();
   ```

2. **Acessar página de Nomenclaturas**
   - Navegue: `Configurações → Nomenclaturas`
   - Verifique que mostra valores padrão

3. **Modificar uma nomenclatura**
   - Clique no botão de editar (ícone de lápis)
   - Mude "IGREJA" para "TEMPLO"
   - Mude "CAMPO" para "FILIAL"
   - Clique "✓ Salvar Nomenclaturas"
   - Verifique alerta de confirmação

4. **Verificar persistência**
   - Recarregue a página (F5 ou Ctrl+R)
   - Verifique que "TEMPLO" e "FILIAL" permanecem
   - Abra console e execute:
     ```javascript
     JSON.parse(localStorage.getItem('nomenclaturas'))
     ```
   - Deve retornar o objeto com suas alterações

### Resultado Esperado
✅ Nomenclaturas são salvas e recuperadas corretamente após reload

---

## Teste 2: Placeholders em Cartões

### Pré-requisitos
- Teste 1 já completado (nomenclaturas salvas)
- Um template de cartão configurado

### Passo a Passo

1. **Editar um template**
   - Navegue: `Configurações → Cartões`
   - Selecione o template "Membro 01"
   - Clique em "Editar" para entrar no editor

2. **Adicionar placeholders dinâmicos**
   - No editor de **Frente**, adicione uma linha:
     ```
     LOCALIDADE: {divisao3}
     ```
   - Logo abaixo, adicione:
     ```
     CONGREGAÇÃO: {divisao3_valor}
     ```
   - Clique em "Salvar Template"

3. **Visualizar cartão com placeholders**
   - Clique em "Voltar para Visualização"
   - Selecione um membro (ex: "JOÃO SILVA")
   - Na seção de Cartão, verifique se exibe:
     ```
     LOCALIDADE: TEMPLO
     CONGREGAÇÃO: Templo Graça
     ```

### Resultado Esperado
✅ Cartão mostra rótulo dinâmico (TEMPLO) e valor real (Templo Graça)

---

## Teste 3: Alteração de Nomenclatura Reflete no Cartão

### Pré-requisitos
- Teste 2 já completado

### Passo a Passo

1. **Mudar nomenclatura**
   - Navegue: `Configurações → Nomenclaturas`
   - Clique editar
   - Mude divisão terciária de "TEMPLO" para "IGREJA"
   - Clique "✓ Salvar Nomenclaturas"

2. **Voltar para Cartões**
   - Navegue: `Configurações → Cartões`
   - Selecione o template
   - Na seção de Preview, visualize o cartão novamente

3. **Verificar mudança**
   - Cartão deve agora exibir:
     ```
     LOCALIDADE: IGREJA
     CONGREGAÇÃO: Templo Graça
     ```

### Resultado Esperado
✅ Cartão reflete automaticamente a mudança de nomenclatura

---

## Teste 4: Impressão em Lote (Batch Printing)

### Pré-requisitos
- Testes anteriores completados
- Template com `{divisao3}` e `{divisao3_valor}`

### Passo a Passo

1. **Acessar Secretaria de Membros**
   - Navegue: `Secretaria → Membros`
   - Lista de membros deve ser exibida

2. **Selecionar múltiplos membros**
   - Marque checkbox de pelo menos 2 membros

3. **Acessar impressão em lote**
   - Procure por botão "Imprimir Cartões em Lote" ou similar
   - Ou abra: `Configurações → Cartões → Seção de Batch Print`

4. **Gerar visualização**
   - Clique para visualizar/imprimir cartões
   - Verifique que cada membro mostra seu valor correto:
     ```
     Membro 1: LOCALIDADE: IGREJA, CONGREGAÇÃO: Templo Graça
     Membro 2: LOCALIDADE: IGREJA, CONGREGAÇÃO: Templo Central
     ```

### Resultado Esperado
✅ Todos os cartões em lote mostram placeholders corretamente substituídos

---

## Teste 5: Compatibilidade com Outros Placeholders

### Pré-requisitos
- Teste anterior completado

### Passo a Passo

1. **Editar template com múltiplos placeholders**
   - Navegue: `Configurações → Cartões`
   - Editar template
   - Crie um texto com:
     ```
     Nome: {nome}
     Supervisão: {supervisao}
     Campo: {campo}
     Localidade: {divisao3}
     Igreja: {divisao3_valor}
     CPF: {cpf}
     ```
   - Salve o template

2. **Visualizar cartão**
   - Selecione um membro
   - Verifique que TODOS os placeholders são substituídos corretamente

### Resultado Esperado
✅ Placeholders coexistem e funcionam juntos

---

## Teste 6: Edge Cases

### Teste 6a: Membro sem congregação
1. Crie um novo membro sem preenchimento do campo `congregacao`
2. Visualize cartão com `{divisao3_valor}`
3. Campo deve aparecer vazio ou com valor padrão

### Teste 6b: Nomenclatura não salva
1. Limpe localStorage: `localStorage.removeItem('nomenclaturas')`
2. Reload página
3. Visualize cartão com `{divisao3}`
4. Deve exibir valor padrão: "CONGREGAÇÃO"

### Teste 6c: Caracteres especiais
1. Salve nomenclatura com caracteres especiais: "CONGREGAÇÃO/TEMPLO"
2. Visualize no cartão
3. Deve exibir corretamente

---

## Verificação de Console

### Verificar Nomenclaturas Salvas
```javascript
// No console do navegador (F12):
const notas = localStorage.getItem('nomenclaturas');
console.log('Nomenclaturas salvas:', JSON.parse(notas));
```

### Verificar Membros Saltos
```javascript
const membros = localStorage.getItem('membros');
const membrosArray = JSON.parse(membros);
console.log('Primeiros membros:', membrosArray.slice(0, 2));
```

### Testar Função de Substituição (Frontend)
```javascript
// Importar função diretamente (se possível)
// Ou testar via componente que a usa
const membro = {
  nome: 'TEST',
  congregacao: 'Templo Teste',
  supervisao: 'PA'
};
// Resultado deve conter: "Templo Teste"
```

---

## Checklist de Validação

- [ ] Nomenclaturas salvam e persistem após reload
- [ ] Placeholders `{divisao1}`, `{divisao2}`, `{divisao3}` mostram valores corretos
- [ ] Placeholder `{divisao3_valor}` mostra nome real da congregação
- [ ] Mudança de nomenclatura reflete nos cartões sem recarregar
- [ ] Batch printing funciona com placeholders dinâmicos
- [ ] Placeholders coexistem com outros placeholders do sistema
- [ ] Edge cases (vazio, caracteres especiais) funcionam corretamente
- [ ] localStorage não corrompe com valores especiais

---

## Problemas Conhecidos e Soluções

### Problema: "divisao3_valor aparece como texto literal"
**Causa:** Placeholder não reconhecido  
**Solução:** Verificar se está salvo em `PLACEHOLDERS_CONFIG` em `cartoes-utils.ts`

### Problema: "Nomenclatura volta ao padrão após reload"
**Causa:** localStorage não salva ou não carrega  
**Solução:** 
```javascript
// Verificar se localStorage está habilitado:
try { localStorage.setItem('test', '1'); localStorage.removeItem('test'); console.log('localStorage OK'); } catch(e) { console.error('localStorage desabilitado'); }
```

### Problema: "Batch printing não substitui placeholders"
**Causa:** API não recebe nomenclaturas  
**Solução:** Passar nomenclaturas no corpo da requisição na função que faz batch printing

---

## Documentação das Mudanças

Veja [IMPLEMENTACAO_COMPLETA.md](IMPLEMENTACAO_COMPLETA.md) para detalhes técnicos das modificações de código.
