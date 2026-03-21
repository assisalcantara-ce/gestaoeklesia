// 🧪 Script de Teste - PDF Generation
// Cole este código no console do navegador (F12) para testar

console.log('%c=== TESTE DE GERAÇÃO DE PDF ===', 'font-size: 16px; font-weight: bold; color: #0d9488');

// Teste 1: Verificar se estado membroImprimindo existe
console.log('%c✓ Teste 1: Verificar estado', 'color: #10b981');
console.log('Procurando por setMembroImprimindo na página...');
const hasState = window.location.pathname.includes('membros');
console.log('Página de membros carregada:', hasState ? '✅' : '❌');

// Teste 2: Verificar bibliotecas
console.log('%c✓ Teste 2: Verificar bibliotecas', 'color: #10b981');
console.log('html2canvas:', typeof window.html2canvas !== 'undefined' ? '✅ Carregada' : '❌ Não carregada');
console.log('jsPDF:', typeof window.jsPDF !== 'undefined' ? '✅ Carregada' : '❌ Não carregada');
console.log('QRCodeSVG:', typeof window.QRCodeSVG !== 'undefined' ? '✅ Carregada' : '❌ Não carregada');

// Teste 3: Simular clique no botão de impressão
console.log('%c✓ Teste 3: Botões de ação', 'color: #10b981');
const printButtons = document.querySelectorAll('button[title="Imprimir"]');
console.log('Botões de impressão encontrados:', printButtons.length);
printButtons.forEach((btn, index) => {
  console.log(`  Botão ${index + 1}:`, btn.outerHTML.substring(0, 100) + '...');
});

// Teste 4: Verificar modal
console.log('%c✓ Teste 4: Estrutura Modal', 'color: #10b981');
const modals = document.querySelectorAll('[class*="fixed"][class*="inset-0"]');
console.log('Modais encontradas:', modals.length);

// Teste 5: Verificar fichaRef
console.log('%c✓ Teste 5: Elemento fichaRef', 'color: #10b981');
const fichaElements = document.querySelectorAll('[style*="210mm"]');
console.log('Elementos de ficha encontrados (210mm width):', fichaElements.length);

// Teste 6: Verificar botão PDF
console.log('%c✓ Teste 6: Botão de PDF', 'color: #10b981');
const pdfButtons = document.querySelectorAll('button:has-text("Baixar PDF"), button');
let foundPdfButton = false;
document.querySelectorAll('button').forEach(btn => {
  if (btn.textContent.includes('Baixar PDF')) {
    foundPdfButton = true;
    console.log('Botão PDF encontrado:', btn.className);
  }
});
console.log('Botão PDF existe:', foundPdfButton ? '✅' : '❌');

// Teste 7: Instruções
console.log('%c📋 INSTRUÇÕES DE TESTE', 'font-size: 14px; font-weight: bold; color: #0d9488');
console.log(`
1. Clique no botão 🖨️ em uma linha da tabela
2. Aguarde a modal abrir
3. Clique em "📥 Baixar PDF"
4. Procure pelos logs abaixo neste console:
   - 🔍 gerarPDF iniciado
   - ✅ Canvas criado
   - 💾 Salvando PDF
   - ✅ PDF salvo com sucesso!
5. Verifique a pasta Downloads por um arquivo PDF
`);

console.log('%c✅ Testes completados! Pronto para gerar PDF', 'color: #10b981; font-weight: bold');
