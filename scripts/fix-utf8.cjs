const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'app', 'ebd', 'dashboard', 'page.tsx');
let src = fs.readFileSync(file, 'utf8');

// Substitui sequências \uXXXX literais pelos caracteres reais
src = src.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
  String.fromCodePoint(parseInt(hex, 16))
);

// Também substitui pares surrogate \uD83x\uDCxx → emoji real
// (já tratados acima em dois passos; esta etapa garante pares)
src = src.replace(
  /[\uD800-\uDBFF][\uDC00-\uDFFF]/g,
  m => m // já são chars reais, não precisa fazer nada
);

fs.writeFileSync(file, src, 'utf8');
console.log('Fixed:', file);
