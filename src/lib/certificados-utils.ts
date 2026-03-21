export const CERTIFICADO_PLACEHOLDERS = [
  { campo: 'crianca_nome', placeholder: '{crianca_nome}', label: 'Nome da Crianca' },
  { campo: 'pai_nome', placeholder: '{pai_nome}', label: 'Nome do Pai' },
  { campo: 'mae_nome', placeholder: '{mae_nome}', label: 'Nome da Mae' },
  { campo: 'responsavel_nome', placeholder: '{responsavel_nome}', label: 'Responsavel' },
  { campo: 'responsavel_telefone', placeholder: '{responsavel_telefone}', label: 'Telefone do Responsavel' },
  { campo: 'data_apresentacao', placeholder: '{data_apresentacao}', label: 'Data da Apresentacao' },
  { campo: 'local_apresentacao', placeholder: '{local_apresentacao}', label: 'Local da Apresentacao' },
  { campo: 'batizando_nome', placeholder: '{batizando_nome}', label: 'Nome do Batizando' },
  { campo: 'data_batismo', placeholder: '{data_batismo}', label: 'Data do Batismo' },
  { campo: 'local_batismo', placeholder: '{local_batismo}', label: 'Local do Batismo' },
  { campo: 'noivo_nome', placeholder: '{noivo_nome}', label: 'Nome do Noivo' },
  { campo: 'noiva_nome', placeholder: '{noiva_nome}', label: 'Nome da Noiva' },
  { campo: 'data_casamento', placeholder: '{data_casamento}', label: 'Data do Casamento' },
  { campo: 'local_casamento', placeholder: '{local_casamento}', label: 'Local do Casamento' },
  { campo: 'celebrante_nome', placeholder: '{celebrante_nome}', label: 'Celebrante' },
  { campo: 'data_emissao', placeholder: '{data_emissao}', label: 'Data de Emissao' },
  { campo: 'nome_igreja', placeholder: '{nome_igreja}', label: 'Nome da Igreja' }
];

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [ano, mes, dia] = str.split('-');
    return `${dia}/${mes}/${ano}`;
  }
  return str;
};

export function substituirPlaceholdersCertificado(texto: string, dados: Record<string, any>): string {
  if (!texto) return texto;

  let resultado = texto;
  const today = new Date();
  const dataEmissao = dados.data_emissao || `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

  const base: Record<string, any> = {
    ...dados,
    data_emissao: dataEmissao,
    data_apresentacao: formatDate(dados.data_apresentacao || dados.data_evento || ''),
    data_batismo: formatDate(dados.data_batismo || ''),
    data_casamento: formatDate(dados.data_casamento || '')
  };

  CERTIFICADO_PLACEHOLDERS.forEach((ph) => {
    const regex = new RegExp(ph.placeholder.replace(/[{}]/g, '\\$&'), 'g');
    const valor = base[ph.campo] ?? '';
    resultado = resultado.replace(regex, String(valor));
  });

  return resultado;
}

export function obterPreviewTextoCertificado(texto: string): string {
  if (!texto) return 'Texto';

  let preview = texto;
  CERTIFICADO_PLACEHOLDERS.forEach((ph) => {
    const regex = new RegExp(ph.placeholder.replace(/[{}]/g, '\\$&'), 'g');
    preview = preview.replace(regex, `[${ph.label}]`);
  });

  return preview;
}
