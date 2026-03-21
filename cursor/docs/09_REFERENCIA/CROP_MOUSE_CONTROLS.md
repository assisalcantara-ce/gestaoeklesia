# 🖼️ Crop de Foto - Controles de Mouse Implementados

## ✅ Novo Sistema de Enquadramento (3x4)

A funcionalidade de crop de foto foi significativamente melhorada com **controles intuitivos de mouse** para uma melhor experiência do usuário.

---

## 📱 Como Usar

### **1. Abrir Modal de Crop**
- Clique no campo de foto do membro
- Selecione uma imagem do seu computador
- O modal de enquadramento abrirá automaticamente

### **2. Controles de Mouse**

#### **🔍 ZOOM (Scroll do Mouse)**
```
Gire o scroll do mouse na área de preview
↑ Scroll para cima = Aumenta zoom (até 3x)
↓ Scroll para baixo = Diminui zoom (mínimo 1x)
```
- **Incremento**: 0.1x por movimento de scroll
- **Limite**: 1x (tamanho real) até 3x (ampliado)

#### **🖱️ MOVER IMAGEM (Arrastar com Mouse)**
```
Clique + arraste na área de preview
← → Movimento horizontal
↑ ↓ Movimento vertical
```
- **Sensibilidade**: Proporcional ao movimento do mouse
- **Limite**: -200 a +200px em cada eixo
- **Feedback visual**: Cursor muda para "grab"/"grabbing"

#### **↺ RESETAR POSIÇÃO (Botão)**
```
Clique em "↺ Resetar" para voltar ao estado padrão
```
- Zoom volta para 1x
- Posição volta para centro (0, 0)

---

## 🎛️ Controles Alternativos (Sliders)

Se preferir ajustes mais precisos, use os sliders:

| Controle | Range | Step | Função |
|----------|-------|------|--------|
| **Zoom** | 1x - 3x | 0.1 | Aumenta/diminui tamanho |
| **Horizontal** | -200 a +200px | 5px | Move esquerda/direita |
| **Vertical** | -200 a +200px | 5px | Move cima/baixo |

---

## 🎨 Recursos da Interface

### **Design Responsivo**
- Modal adapta-se ao tamanho da tela
- Proporção 3x4 mantida automaticamente
- Altura máxima de 400px com scroll interno

### **Instruções Visuais**
- **Topo do modal**: Dicas de uso
- **Botão "Resetar"**: Volta aos valores padrão
- **Zoom badge**: Mostra valor atual (ex: 1.5x)
- **Info box**: Resumo dos controles disponíveis

### **Estados Visuais**
```
Hover na área = cursor: grab (avisando que pode arrastar)
Durante arrasto = cursor: grabbing (arrastando)
Fora da imagem = transition suave (sem saltos)
```

---

## 🔧 Estados Adicionados (React)

```typescript
// Controles de crop
const [mostrarCropModal, setMostrarCropModal] = useState(false);
const [fotoCropZoom, setFotoCropZoom] = useState(1);
const [fotoCropPositionX, setFotoCropPositionX] = useState(0);
const [fotoCropPositionY, setFotoCropPositionY] = useState(0);

// Rastreamento de mouse
const [isDragging, setIsDragging] = useState(false);
const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
const previewAreaRef = useRef<HTMLDivElement>(null);
```

---

## 📐 Eventos de Mouse Implementados

### **1. onWheel (Zoom com Scroll)**
```typescript
const handleCropWheel = (e: React.WheelEvent<HTMLDivElement>) => {
  e.preventDefault();
  const zoomAmount = e.deltaY > 0 ? -0.1 : 0.1;
  const newZoom = Math.max(1, Math.min(3, fotoCropZoom + zoomAmount));
  setFotoCropZoom(newZoom);
};
```

### **2. onMouseDown (Iniciar Arrasto)**
```typescript
const handleCropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
  setIsDragging(true);
  setDragStart({ x: e.clientX, y: e.clientY });
};
```

### **3. onMouseMove (Mover Imagem)**
```typescript
const handleCropMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
  if (!isDragging) return;
  
  const deltaX = e.clientX - dragStart.x;
  const deltaY = e.clientY - dragStart.y;
  
  setFotoCropPositionX(prev => 
    Math.max(-200, Math.min(200, prev + deltaX / 2))
  );
  setFotoCropPositionY(prev => 
    Math.max(-200, Math.min(200, prev + deltaY / 2))
  );
  
  setDragStart({ x: e.clientX, y: e.clientY });
};
```

### **4. onMouseUp / onMouseLeave (Parar Arrasto)**
```typescript
const handleCropMouseUp = () => {
  setIsDragging(false);
};
```

---

## 🎯 Fluxo Completo do Crop

```
1. Usuário seleciona foto
   ↓
2. Modal abre com imagem original
   ↓
3. OPÇÃO A: Usar mouse
   - Scroll para zoom
   - Arrasta para mover
   ↓
4. OPÇÃO B: Usar sliders
   - Slider de zoom
   - Sliders de posição
   - Botão resetar
   ↓
5. Clica "Confirmar Enquadramento"
   ↓
6. Canvas renderiza versão cortada (JPEG, qualidade 0.95)
   ↓
7. Foto salva no campo fotoMembro
   ↓
8. Modal fecha automaticamente
```

---

## 🖥️ Arquivo Modificado

**Localização**: `src/app/secretaria/membros/page.tsx`

**Mudanças**:
- ✅ Adicionados 8 novos estados e refs
- ✅ Adicionadas 4 funções de controle de mouse
- ✅ Atualizado modal com event handlers
- ✅ Adicionadas instruções visuais
- ✅ Botão "Resetar" para voltar ao padrão
- ✅ Feedback visual (cursor grab/grabbing)
- ✅ Zoom badge mostrando valor atual

---

## 🚀 Tecnologias Utilizadas

| Tecnologia | Uso |
|------------|-----|
| **React Hooks** | useState, useRef para gerenciar estado |
| **Event Handlers** | onWheel, onMouseDown, onMouseMove, onMouseUp |
| **Canvas API** | Renderizar versão final cropped |
| **Tailwind CSS** | Styling responsivo |
| **CSS Transform** | scale, translateX, translateY para preview |

---

## 📋 Checklist de Funcionalidade

- ✅ Zoom com scroll do mouse
- ✅ Mover imagem com arrastar
- ✅ Sliders como alternativa
- ✅ Botão resetar
- ✅ Canvas renderiza corretamente
- ✅ Proporção 3x4 mantida
- ✅ JPEG salvo com qualidade 0.95
- ✅ Feedback visual (cursor)
- ✅ Instruções claras na UI
- ✅ Compatível com localStorage

---

## 💡 Dicas de Uso

1. **Para aumentar zoom**: Posicione o mouse sobre o rosto e gire scroll para cima
2. **Para posicionar**: Clique e arraste para mover a foto até enquadrar melhor
3. **Para afastar**: Use scroll para baixo ou reduza o zoom com o slider
4. **Para começar de novo**: Clique em "↺ Resetar"
5. **Para descartar**: Clique em "✕ Cancelar"

---

**Status**: ✅ COMPLETO E TESTADO

**Data**: 1º de Janeiro de 2026
