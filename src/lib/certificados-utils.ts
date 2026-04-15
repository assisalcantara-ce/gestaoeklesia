export type CertificadoCategoria = 'ministerial' | 'apresentacao-criancas' | 'batismo-aguas';

export const CERTIFICADO_CATEGORIAS: Array<{ value: CertificadoCategoria; label: string }> = [
  { value: 'ministerial', label: 'Ministerial' },
  { value: 'apresentacao-criancas', label: 'Apresentacao de Criancas' },
  { value: 'batismo-aguas', label: 'Batismo nas Aguas' },
];

const CERTIFICADO_PLACEHOLDERS_POR_CATEGORIA: Record<CertificadoCategoria, Array<{ campo: string; placeholder: string; label: string }>> = {
  ministerial: [
    { campo: 'ministro_nome', placeholder: '{ministro_nome}', label: 'Nome do Ministro' },
    { campo: 'matricula', placeholder: '{matricula}', label: 'Matricula' },
    { campo: 'cargo_ministerial', placeholder: '{cargo_ministerial}', label: 'Cargo Ministerial' },
    { campo: 'congregacao', placeholder: '{congregacao}', label: 'Congregacao' },
    { campo: 'data_consagracao', placeholder: '{data_consagracao}', label: 'Data de Consagracao' },
    { campo: 'presidente_nome', placeholder: '{presidente_nome}', label: 'Presidente' },
    { campo: 'data_emissao', placeholder: '{data_emissao}', label: 'Data de Emissao' },
    { campo: 'nome_igreja', placeholder: '{nome_igreja}', label: 'Nome da Igreja' }
  ],
  'apresentacao-criancas': [
    { campo: 'crianca_nome', placeholder: '{crianca_nome}', label: 'Nome da Crianca' },
    { campo: 'crianca_data_nascimento', placeholder: '{crianca_data_nascimento}', label: 'Data de Nascimento' },
    { campo: 'crianca_sexo', placeholder: '{crianca_sexo}', label: 'Sexo' },
    { campo: 'pai_nome', placeholder: '{pai_nome}', label: 'Nome do Pai' },
    { campo: 'mae_nome', placeholder: '{mae_nome}', label: 'Nome da Mae' },
    { campo: 'responsavel_nome', placeholder: '{responsavel_nome}', label: 'Responsavel' },
    { campo: 'responsavel_telefone', placeholder: '{responsavel_telefone}', label: 'Telefone do Responsavel' },
    { campo: 'data_apresentacao', placeholder: '{data_apresentacao}', label: 'Data da Apresentacao' },
    { campo: 'local_apresentacao', placeholder: '{local_apresentacao}', label: 'Local da Apresentacao' },
    { campo: 'data_emissao', placeholder: '{data_emissao}', label: 'Data de Emissao' },
    { campo: 'nome_igreja', placeholder: '{nome_igreja}', label: 'Nome da Igreja' }
  ],
  'batismo-aguas': [
    { campo: 'candidato_nome', placeholder: '{candidato_nome}', label: 'Nome do Candidato' },
    { campo: 'candidato_data_nascimento', placeholder: '{candidato_data_nascimento}', label: 'Data de Nascimento' },
    { campo: 'candidato_sexo', placeholder: '{candidato_sexo}', label: 'Sexo' },
    { campo: 'data_batismo', placeholder: '{data_batismo}', label: 'Data do Batismo' },
    { campo: 'local_batismo', placeholder: '{local_batismo}', label: 'Local do Batismo' },
    { campo: 'pastor_nome', placeholder: '{pastor_nome}', label: 'Nome do Pastor' },
    { campo: 'data_emissao', placeholder: '{data_emissao}', label: 'Data de Emissao' },
    { campo: 'nome_igreja', placeholder: '{nome_igreja}', label: 'Nome da Igreja' },
  ],
};

export const CERTIFICADO_PLACEHOLDERS = CERTIFICADO_PLACEHOLDERS_POR_CATEGORIA.ministerial;

export const getCertificadoPlaceholders = (categoria?: string) => {
  if (!categoria) return CERTIFICADO_PLACEHOLDERS;
  return CERTIFICADO_PLACEHOLDERS_POR_CATEGORIA[categoria as CertificadoCategoria] || CERTIFICADO_PLACEHOLDERS;
};

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [ano, mes, dia] = str.split('-');
    return `${dia}/${mes}/${ano}`;
  }
  return str;
};

export function substituirPlaceholdersCertificado(
  texto: string,
  dados: Record<string, any>,
  categoria?: string
): string {
  if (!texto) return texto;

  let resultado = texto;
  const today = new Date();
  const dataEmissao = dados.data_emissao || `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

  const base: Record<string, any> = {
    ...dados,
    data_emissao: dataEmissao,
    data_consagracao: formatDate(dados.data_consagracao || dados.data_processo || dados.data_evento || '')
  };

  const placeholders = getCertificadoPlaceholders(categoria);
  placeholders.forEach((ph) => {
    const regex = new RegExp(ph.placeholder.replace(/[{}]/g, '\\$&'), 'g');
    const valor = base[ph.campo] ?? '';
    resultado = resultado.replace(regex, String(valor));
  });

  return resultado;
}

export function obterPreviewTextoCertificado(texto: string, categoria?: string): string {
  if (!texto) return 'Texto';

  let preview = texto;
  const placeholders = getCertificadoPlaceholders(categoria);
  placeholders.forEach((ph) => {
    const regex = new RegExp(ph.placeholder.replace(/[{}]/g, '\\$&'), 'g');
    preview = preview.replace(regex, `[${ph.label}]`);
  });

  return preview;
}
