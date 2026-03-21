# Solução: Thumbnail Vazio na Sidebar de Templates

## 🔴 Problema
O card do template (ex: "Funcionário Customizado") aparece **vazio/branco** na sidebar de seleção de templates, mesmo quando o `previewImage` foi configurado.

```
❌ Card vazio na sidebar
❌ Nenhuma imagem de preview visível
❌ Mesmo após deletar cache e .next
```

## 🔍 Causa Raiz
Existem **2 definições diferentes** do mesmo template em arquivos diferentes:

1. **`src/lib/custom-card-templates.ts`** (tipo `TemplateCartaoCustomizado`)
   - Tem `previewImage` ✅
   - Tem `backgroundUrl` ✅
   - Tem todos os elementos ✅
   - **MAS não é a que é retornada por `getTemplatesPorTipo()`**

2. **`src/lib/card-templates.ts`** (tipo `CardTemplate`)
   - É a que é retornada por `getTemplatesPorTipo()` ✅
   - **MAS estava SEM `previewImage`** ❌
   - **MAS estava SEM `backgroundUrl`** ❌

## ✅ Solução (3 etapas)

### Etapa 1: Adicionar `previewImage` ao template nativo
**Arquivo:** `src/lib/card-templates.ts` (linhas ~303-320)

Adicionar `previewImage: '/img/card1f.jpg'` ao `TEMPLATE_FUNCIONARIO_CUSTOMIZADO`:

```typescript
export const TEMPLATE_FUNCIONARIO_CUSTOMIZADO: CardTemplate = {
    id: 'funcionario-customizado',
    nome: 'Funcionário Customizado',
    tipo: 'funcionario',
    variacao: 'customizado',
    descricao: 'Layout personalizável em orientação vertical (Portrait)',
    corPrincipal: '#6b21a8',
    corSecundaria: '#9333ea',
    corTexto: '#ffffff',
    backgroundUrl: '/img/card_funcionario.png',
    previewImage: '/img/card1f.jpg',  // ← ADICIONAR ISTO
    layout: {
        mostrarFoto: true,
        mostrarQRCode: true,
        mostrarMatricula: true,
        mostrarCargo: true,
        mostrarBadge: false,
        orientacao: 'vertical'
    }
};
```

### Etapa 2: Fazer merge inteligente de templates salvos com nativos
**Arquivo:** `src/components/TemplatesSidebar.tsx` (linhas ~22-26)

Quando o sidebar busca templates, ele tenta usar uma versão "salva" do estado. Mas se essa versão foi salva ANTES de adicionar `previewImage`, ela estará sem essa propriedade.

**Solução:** Fazer merge que prioriza dados nativos para `previewImage` e `backgroundUrl`:

```typescript
// 1. Modelos Nativos (sempre aparecem primeiro, sincronizados com o estado se salvos)
const todosTemplates = templatesDisponiveis.map((nativo: any) => {
    // Tentar encontrar uma versão "salva" deste modelo no estado pelo ID
    const salvo = templates.find((t: any) => t.id === nativo.id);
    // Se encontrou uma versão salva, mesclar com os dados nativos (especialmente previewImage)
    // para garantir que propriedades novas do nativo não se percam
    if (salvo) {
        return {
            ...salvo,
            previewImage: nativo.previewImage || salvo.previewImage, // Priorizar nativo
            backgroundUrl: nativo.backgroundUrl || salvo.backgroundUrl // Priorizar nativo
        };
    }
    return nativo;
});
```

### Etapa 3: Verificar condição de renderização
**Arquivo:** `src/components/TemplatesSidebar.tsx` (linhas ~93-94)

Garantir que a condição de `temPreview` seja robusta:

```typescript
const temPreview = template.previewImage !== undefined && template.previewImage !== null && template.previewImage !== '';
```

## 📋 Checklist para Novos Templates

Ao criar um novo template de card:

- [ ] Definir em `src/lib/card-templates.ts` com tipo `CardTemplate`
- [ ] Adicionar `previewImage: '/img/cardXX.jpg'`
- [ ] Adicionar `backgroundUrl: '/img/card_X.png'`
- [ ] Confirmar que a imagem existe em `public/img/`
- [ ] Adicionar à array `TEMPLATES_DISPONIVEIS`
- [ ] Adicionar tipo correspondente em `TEMPLATES_CUSTOMIZADOS` se necessário
- [ ] Testar reload da página (não apenas hot reload)

## 🧪 Como Testar

1. Abrir `http://localhost:3000/configuracoes/cartoes`
2. Clicar no tipo de cartão (ex: "Cartão de Funcionário")
3. Verificar se o thumbnail aparece no card da sidebar
4. Abrir console do navegador e procurar por logs como:
   ```
   🖼️ [TemplatesSidebar] Template: funcionario-customizado previewImage: /img/card1f.jpg
   ```

## 🔧 Debug
Se ainda estiver vazio, verificar:

1. **Arquivo existe?**
   ```powershell
   ls public/img/card1f.jpg
   ```

2. **Imagem é acessível?**
   ```
   http://localhost:3000/img/card1f.jpg
   ```

3. **localStorage contém dados antigos?**
   - DevTools → Application → LocalStorage → Limpar `cartoes_templates_v2`

4. **Cache do Next.js?**
   ```powershell
   rm -r .next
   npm run dev
   ```

## 📝 Notas Importantes

- **Sempre adicionar `previewImage` na definição nativa** (`card-templates.ts`), não apenas no customizado
- **O merge no sidebar é essencial** para garantir que updates futuros no template nativo se reflitam
- **Nomes de imagem devem ser convencionados**: `card1f.jpg` = card 1, funcionario
- **Evitar usar spread simples** (`...template`) sem merge explícito de propriedades críticas

## 🎯 Para Futuros Templates

Use este template como base:

```typescript
export const TEMPLATE_NOVO_TIPO: CardTemplate = {
    id: 'novo-tipo-id',
    nome: 'Novo Tipo',
    tipo: 'novo-tipo',
    variacao: 'customizado',
    descricao: 'Descrição clara',
    corPrincipal: '#cor-principal',
    corSecundaria: '#cor-secundaria',
    corTexto: '#ffffff',
    backgroundUrl: '/img/card_novo.png',      // ← Não esquecer!
    previewImage: '/img/cardXn.jpg',          // ← Não esquecer!
    layout: {
        mostrarFoto: true,
        mostrarQRCode: true,
        mostrarMatricula: true,
        mostrarCargo: true,
        mostrarBadge: false,
        orientacao: 'vertical' // ou 'landscape'
    }
};
```

---
**Status:** ✅ RESOLVIDO  
**Tempo investido:** ~30-45 min (mas poderia ter sido ~5 min com este guia)  
**Lições aprendidas:** Sempre sincronizar propriedades em múltiplas definições, não confiar apenas em spread operators
