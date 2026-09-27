import crypto from 'crypto';

/**
 * Gera um token criptograficamente seguro com 256 bits de entropia (URL-safe).
 * Exemplo: ebd_7Kx9mQ2vLp1aZbCwR4yUnTe6_oHgFsD3jM0qV8xY...
 */
export function generateSecureEbdToken(): string {
  const random = crypto.randomBytes(32).toString('base64url');
  return `ebd_${random}`;
}

/**
 * Calcula o hash SHA-256 de um token bruto para armazenamento seguro no banco de dados.
 */
export function hashEbdToken(rawToken: string): string {
  if (!rawToken || typeof rawToken !== 'string') {
    throw new Error('Token inválido para hashing.');
  }
  return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
}

/**
 * Calcula a data/hora de expiração do link da chamada.
 * Por padrão: 48h a partir do momento atual ou 48h após o encerramento do dia da aula (o que for maior).
 */
export function calculateExpirationDate(dataAulaStr: string): string {
  const now = new Date();
  const baseAula = new Date(`${dataAulaStr}T23:59:59`);
  
  // 48 horas após o fim do dia da aula
  const expFromAula = new Date(baseAula.getTime() + 48 * 60 * 60 * 1000);
  // 48 horas a partir de agora
  const expFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const expDate = expFromAula > expFromNow ? expFromAula : expFromNow;
  return expDate.toISOString();
}

/**
 * Formata a mensagem padrão para compartilhamento via WhatsApp.
 */
export function formatWhatsappChamadaMessage(params: {
  professorNome?: string | null;
  turmaNome: string;
  classeNome?: string | null;
  dataAula: string;
  url: string;
}): string {
  const [ano, mes, dia] = params.dataAula.split('-');
  const dataFmt = `${dia}/${mes}/${ano}`;
  const saudacao = params.professorNome ? `Paz do Senhor, ${params.professorNome}!` : 'Paz do Senhor!';
  const classeInfo = params.classeNome ? ` (${params.classeNome})` : '';

  return (
    `${saudacao} 👋\n\n` +
    `Segue o link para realizar a *Chamada Dominical da EBD* da turma *${params.turmaNome}*${classeInfo} referente a *${dataFmt}*:\n\n` +
    `👉 ${params.url}\n\n` +
    `O link é individual, seguro e pode ser aberto direto pelo celular (não precisa de senha).\n\n` +
    `Deus abençoe sua aula!`
  );
}
