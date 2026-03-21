// Importar e processar JSON do arquivo de template
import fs from 'fs';
import path from 'path';

export function loadTemplateMinistroFromJSON(): any {
  try {
    const filePath = path.join(process.cwd(), 'public/img/json_template_ministro01.txt');
    const jsonString = fs.readFileSync(filePath, 'utf-8');
    
    // Extrair JSON válido até o último }
    const lastBrace = jsonString.lastIndexOf('}');
    if (lastBrace > 0) {
      const cleanJson = jsonString.substring(0, lastBrace + 1);
      return JSON.parse(cleanJson);
    }
    
    return null;
  } catch (error) {
    console.error('Erro ao carregar template ministerial:', error);
    return null;
  }
}
