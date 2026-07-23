# REGRA 02 — Design System & Modais/Dropdowns

## 📌 Diretrizes Principais

1. **Eliminação de Clipping de Elementos Flutuantes:** É estritamente proibido colocar `overflow-hidden` no card principal de um componente caso o cabeçalho ou o próprio card necessitem exibir elementos flutuantes (ex: Dropdowns de Ações em Lote, Menus `⋮`, Tooltips, Popovers ou Autocomplete).
2. **Isolamento de Wrapper Interno:** Aplique a propriedade `overflow-hidden` apenas em um container wrapper interno (`ContentWrapper`) dedicado para tabelas ou listas expansíveis que necessitem de arredondamento de bordas inferiores (`rounded-b-xl`).
3. **Elevado Z-Index e Posicionamento Absoluto:** Todos os menus flutuantes e dropdowns devem utilizar `position: absolute` e `z-index` padronizado em `z-50` ou superior para garantir sobreposição limpa sobre cards e tabelas vizinhas.

---

## 🏗️ Padrão Estrutural Obrigatório

```tsx
{/* Card Principal: Mantém position relative e permite expansão de filhos */}
<div className="border border-gray-800 rounded-xl bg-gray-900/50 backdrop-blur shadow-xl transition-all relative z-10 hover:z-20">
  
  {/* Cabeçalho do Card (Contém botão e Dropdown de Ações) */}
  <div className="flex items-center justify-between p-5">
    <h3>Nome do Cliente</h3>

    {/* Menu de Ações (Absoluto com z-50) */}
    <div className="relative">
      <button onClick={() => setMenuOpen(!menuOpen)}>
        Ações
      </button>

      {menuOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl py-1 z-50 text-left">
          <button className="w-full px-4 py-2 text-xs font-semibold text-blue-400 hover:bg-blue-950/40">
            Ação 1
          </button>
        </div>
      )}
    </div>
  </div>

  {/* Wrapper Interno: Recebe overflow-hidden e rounded-b-xl para conter a tabela */}
  {isExpanded && (
    <div className="overflow-hidden rounded-b-xl border-t border-gray-800">
      <table className="w-full text-left border-collapse">
        {/* Conteúdo da Tabela */}
      </table>
    </div>
  )}
</div>
```

---

## 🎨 Paleta e Estilização Dark Theme Corporativa

- **Bordas Discretas:** `border border-gray-800` ou `border-gray-700/50`.
- **Fundo Eletrônico:** `bg-gray-950` / `bg-gray-900/90`.
- **Sombreamento Elevado:** `shadow-2xl` para dropdowns.
- **Tipografia Modernizada:** Uso de fontes limpas com hierarquia visual clara (`text-xs`, `text-sm`, `font-semibold`).
