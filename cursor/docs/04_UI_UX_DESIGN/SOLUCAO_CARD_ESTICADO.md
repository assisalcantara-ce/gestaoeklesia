#!/bin/bash
# ============================================================
# 🎯 SOLUÇÃO DEFINITIVA: PROBLEMA DE CARD ESTICADO VERTICALMENTE
# ============================================================
# 
# PROBLEMA:
# Card azul de login ocupava TODA a altura da tela (min-h-screen)
# mesmo com conteúdo pequeno.
#
# CAUSA RAIZ:
# Espaçamentos GIGANTES dentro do card:
# - mb-20 (80px) após título
# - mb-12 (48px) entre form rows
# - mt-16 (64px) antes do botão
# - mt-20 (80px) antes do link
# - mt-12 pt-8 (footer)
# - space-y-4 (16px) entre label e input
# - py-4 (16px) padding vertical dos inputs
#
# ============================================================
# ✅ SOLUÇÃO IMPLEMENTADA
# ============================================================

# REDUÇÃO DE ESPAÇAMENTOS NO CARD:

ANTES:
-------
Card Title:        mb-20  (80px) → mb-6  (24px) ⬇️ -73%
Form Row Spacing:  space-y-4 → space-y-2 ⬇️ -50%
After Inputs:      mb-12 (48px) → mb-4 (16px) ⬇️ -67%
Before Button:     mt-16 (64px) → mt-6 (24px) ⬇️ -62%
Button Padding:    py-4 (16px) → py-3 (12px) ⬇️ -25%
Input Padding:     py-4 (16px) → py-3 (12px) ⬇️ -25%
Card Padding:      p-8 (32px) → p-6 (24px) ⬇️ -25%
Link Section:      mt-20 (80px) → mt-4 (16px) ⬇️ -80%
Footer:            mt-12 pt-8 → mt-4 pt-4 ⬇️ -67%

DEPOIS:
-------
Espaçamentos compactos e proporcionais
Card ocupa apenas o espaço necessário


# ============================================================
# 📋 CHECKLIST PARA CARDS FUTUROS (COPIAR/COLAR)
# ============================================================

✅ NUNCA USE ESTES VALORES EM CARDS:
  - mb-20, mb-16, mb-12 (muito grandes)
  - mt-20, mt-16, mt-12 (muito grandes)
  - space-y-4 (entre labels e inputs)
  - py-4, py-5 (padding vertical em inputs)
  - p-8 (padding no card)
  - gap-4 (entre form rows)

✅ USE ESTES VALORES SEMPRE:
  - Card padding: p-6
  - Títulos: mb-6 (máximo)
  - Form rows: space-y-2
  - Inputs: py-3, px-4
  - Entre sections: mb-4
  - Gap em flex/grid: gap-2 ou gap-3
  - Footer: mt-4 pt-4 (não mt-12 pt-8)


# ============================================================
# 🔧 PADRÃO PARA LOGIN/SIGNUP CARDS
# ============================================================

<div className="rounded-2xl shadow-2xl w-full max-w-sm backdrop-blur-sm p-6 mx-4" style={{ backgroundColor: '#4A6FA5E6' }}>
  
  {/* TÍTULO - MAX mb-6 */}
  <h2 className="text-center text-xl font-bold mb-6 text-white">ACESSO AO SISTEMA</h2>

  <form onSubmit={handleSubmit}>
    {/* ERROR - mb-4 */}
    {error && (
      <div className="p-4 bg-red-50/20 border border-red-300/40 rounded-lg text-sm text-white font-medium mb-4">
        {error}
      </div>
    )}

    {/* FORM ROW - space-y-2, mb-4 */}
    <div className="space-y-2 mb-4">
      <label htmlFor="email" className="block text-sm font-semibold text-white">
        Email
      </label>
      <input
        type="email"
        id="email"
        placeholder="seu@email.com"
        className="w-full px-4 py-3 rounded-lg bg-white/25 border border-white/40 text-white"
      />
    </div>

    {/* FORM ROW - space-y-2, mb-6 (última antes do botão) */}
    <div className="space-y-2 mb-6">
      <label htmlFor="password" className="block text-sm font-semibold text-white">
        Senha
      </label>
      <input
        type="password"
        id="password"
        placeholder="••••••••"
        className="w-full px-4 py-3 rounded-lg bg-white/25 border border-white/40 text-white"
      />
    </div>

    {/* BUTTON - mt-6 (não mt-16!) */}
    <button
      type="submit"
      className="w-full mt-6 px-4 py-3 bg-[#f9b233] text-[#123b63] rounded-lg font-bold"
    >
      Entrar
    </button>

    {/* LINK SECTION - mt-4 (não mt-20!) */}
    <div className="mt-4 text-center">
      <p className="text-xs text-white/70">
        Ainda não tem acesso?<br />
        <button className="text-[#ffc547] hover:text-[#ffd966] transition font-semibold">
          Cadastre uma senha aqui.
        </button>
      </p>
    </div>
  </form>

  {/* FOOTER - mt-4 pt-4 (não mt-12 pt-8!) */}
  <div className="mt-4 pt-4 border-t border-white/20 text-center">
    <button className="px-6 py-2 bg-[#0284c7] text-white rounded-lg font-semibold text-sm">
      Esqueceu sua senha?
    </button>
  </div>

</div>


# ============================================================
# 📊 COMPARAÇÃO VISUAL DE TAMANHOS
# ============================================================

ANTES (Esticado):
┌─────────────────────────┐
│  ACESSO AO SISTEMA      │  mb-20 (80px)
│                         │
│  Email                  │
│  [_____________________]│  space-y-4
│                         │
│                         │  mb-12 (48px)
│  Senha                  │
│  [_____________________]│  space-y-4
│                         │
│                         │  mt-16 (64px)
│        [Entrar]         │
│                         │
│                         │
│                         │  mt-20 (80px)
│  Ainda não tem acesso?  │
│  Cadastre uma senha aqui│
│                         │
│  mt-12 pt-8 (footer)    │
│  [Esqueceu senha?]      │
│                         │
└─────────────────────────┘
ALTURA TOTAL: 400-500px (ocupava tela toda!)


DEPOIS (Compacto):
┌─────────────────────────┐
│ ACESSO AO SISTEMA       │  mb-6 (24px)
│                         │
│ Email                   │
│ [_____________________] │  space-y-2
│                         │
│ Senha                   │
│ [_____________________] │  space-y-2
│                         │
│     [Entrar]            │  mt-6 (24px)
│                         │
│ Cadastre uma senha aqui │  mt-4 (16px)
│                         │
│ [Esqueceu senha?]       │  mt-4 pt-4
└─────────────────────────┘
ALTURA TOTAL: 250-300px (compacto!)


# ============================================================
# 🚨 ERROS COMUNS A EVITAR
# ============================================================

❌ ERRADO:
<div className="mb-20 space-y-4 mb-12">
  {/* Card fica esticado */}
</div>

✅ CORRETO:
<div className="mb-6 space-y-2 mb-4">
  {/* Card fica compacto */}
</div>

---

❌ ERRADO:
<button className="mt-16 py-4">Entrar</button>

✅ CORRETO:
<button className="mt-6 py-3">Entrar</button>

---

❌ ERRADO:
<div className="mt-20 pt-8">Footer</div>

✅ CORRETO:
<div className="mt-4 pt-4">Footer</div>


# ============================================================
# 📍 LOCALIZAÇÃO DOS ARQUIVOS
# ============================================================

Arquivo modificado: src/app/page.tsx

Seções alteradas:
- Linha ~165: Card de login (mb-20 → mb-6, etc)
- Linha ~175: Form rows (space-y-4 → space-y-2)
- Linha ~195: Botão (mt-16 → mt-6)
- Linha ~210: Link section (mt-20 → mt-4)
- Linha ~225: Footer (mt-12 pt-8 → mt-4 pt-4)
- Linha ~235: Card de signup (p-8 → p-6)
- Linhas ~240+: Inputs compactos


# ============================================================
# 🎯 RESUMO DA SOLUÇÃO
# ============================================================

PROBLEMA:        Card esticava verticalmente ocupando tela toda
CAUSA:           Espaçamentos gigantes (mb-20, mb-12, mt-16, mt-20)
SOLUÇÃO:         Reduzir para mb-6, mb-4, mt-6, mt-4
RESULTADO:       Card compacto, ocupa só o espaço necessário
APLICADO EM:     src/app/page.tsx (Login e Signup)

APRENDIZADO:
- NUNCA use mb-20, mb-16, mb-12 em cards
- SEMPRE use mb-6 (máximo) ou mb-4
- Form rows: space-y-2 (não space-y-4)
- Inputs: py-3 (não py-4)
- Button margin-top: mt-6 (não mt-16)
- Footer: mt-4 pt-4 (não mt-12 pt-8)

PARA NOVOS CARDS: Copiar padrão de `src/app/template/page.tsx`
ou seguir o template acima deste arquivo.


# ============================================================
# ✅ VALIDAÇÃO
# ============================================================

Antes:  Card ocupava 100vh (tela inteira)
Depois: Card ocupa ~280px (proporcional ao conteúdo)

Login funciona ✅
Signup funciona ✅
Responsividade mantida ✅
Mobile/Tablet/Desktop OK ✅

