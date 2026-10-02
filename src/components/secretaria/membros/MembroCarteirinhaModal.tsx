'use client';

import { FileText, X } from 'lucide-react';
import FichaMembro from '@/components/FichaMembro';
import CartãoMembro from '@/components/CartãoMembro';
import CartaoBatchPrinter from '@/components/CartaoBatchPrinter';

export interface MembroCarteirinhaModalProps {
  membroImprimindo: any;
  setMembroImprimindo: (membro: any) => void;
  membroImprimindoCartao: any;
  setMembroImprimindoCartao: (membro: any) => void;
  imprimindoLote: boolean;
  setImprimindoLote: (lote: boolean) => void;
  membrosSelecionados: Set<string>;
  setMembrosSelecionados: React.Dispatch<React.SetStateAction<Set<string>>>;
  membros: any[];
  configIgreja: any;
  setNotification: (notif: any) => void;
}

export default function MembroCarteirinhaModal({
  membroImprimindo,
  setMembroImprimindo,
  membroImprimindoCartao,
  setMembroImprimindoCartao,
  imprimindoLote,
  setImprimindoLote,
  membrosSelecionados,
  setMembrosSelecionados,
  membros,
  configIgreja,
  setNotification,
}: MembroCarteirinhaModalProps) {
  return (
    <>
      {/* Modal de Impressão - Ficha do Membro */}
      {membroImprimindo && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 md:p-6 overflow-y-auto modal-scrollbar animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl lg:max-w-5xl w-full my-auto flex flex-col max-h-[94vh] overflow-hidden">
            {/* Header Moderno */}
            <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-700 border border-teal-200/80 flex items-center justify-center shrink-0 shadow-xs">
                  <FileText className="w-5 h-5 text-teal-700" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight truncate">
                    Ficha do Membro
                  </h2>
                  <p className="text-xs sm:text-sm font-semibold text-teal-700 truncate">
                    {membroImprimindo.nome || 'Identificação Cadastral'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMembroImprimindo(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                aria-label="Fechar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo da Ficha com scroll fino e suave */}
            <div className="flex-1 overflow-y-auto modal-scrollbar p-4 sm:p-6 bg-slate-50/50">
              <FichaMembro
                membro={{
                  matricula: membroImprimindo.matricula,
                  id: membroImprimindo.id,
                  uniqueId: membroImprimindo.uniqueId || membroImprimindo.unique_id || membroImprimindo.id,
                  nome: membroImprimindo.nome,
                  cpf: membroImprimindo.cpf,
                  tipoCadastro: membroImprimindo.tipoCadastro || membroImprimindo.tipo_cadastro || 'membro',
                  status: membroImprimindo.status || (membroImprimindo.is_active === false ? 'inativo' : 'ativo'),
                  cargo: membroImprimindo.cargo || membroImprimindo.cargo_ministerial || membroImprimindo.dadosCargos?.cargo || '',
                  dataConsagracao: membroImprimindo.dataConsagracao || membroImprimindo.data_consagracao || '',
                  dataBatismo: membroImprimindo.dataBatismo || membroImprimindo.dataBatismoAguas || membroImprimindo.data_batismo || '',
                  dataValidadeCredencial: membroImprimindo.dataValidadeCredencial || membroImprimindo.data_validade_credencial || membroImprimindo.validade || '',
                  congregacao: membroImprimindo.congregacao || membroImprimindo.congregacaoNome || membroImprimindo.congregacoes?.nome || '',
                  dataNascimento: membroImprimindo.dataNascimento || '',
                  sexo: membroImprimindo.sexo || '',
                  tipoSanguineo: membroImprimindo.tipoSanguineo || '',
                  escolaridade: membroImprimindo.escolaridade || '',
                  estadoCivil: membroImprimindo.estadoCivil || '',
                  rg: membroImprimindo.rg || '',
                  nacionalidade: membroImprimindo.nacionalidade || '',
                  naturalidade: membroImprimindo.naturalidade || '',
                  uf: membroImprimindo.uf || '',
                  cep: membroImprimindo.cep || '',
                  logradouro: membroImprimindo.logradouro || '',
                  numero: membroImprimindo.numero || '',
                  bairro: membroImprimindo.bairro || '',
                  complemento: membroImprimindo.complemento || '',
                  cidade: membroImprimindo.cidade || '',
                  nomeConjuge: membroImprimindo.nomeConjuge || '',
                  cpfConjuge: membroImprimindo.cpfConjuge || '',
                  dataNascimentoConjuge: membroImprimindo.dataNascimentoConjuge || '',
                  nomePai: membroImprimindo.nomePai || '',
                  nomeMae: membroImprimindo.nomeMae || '',
                  email: membroImprimindo.email || '',
                  celular: membroImprimindo.celular || '',
                  whatsapp: membroImprimindo.whatsapp || '',
                  qualFuncao: membroImprimindo.qualFuncao || '',
                  setorDepartamento: membroImprimindo.setorDepartamento || '',
                }}
                dadosIgreja={{
                  nomeIgreja: configIgreja?.nome || 'Igreja',
                  endereco: configIgreja?.endereco || '',
                  telefone: configIgreja?.telefone || '',
                  email: configIgreja?.email || '',
                  logoUrl: configIgreja?.logo || undefined,
                }}
                fotoUrl={membroImprimindo.fotoUrl || undefined}
                onClose={() => setMembroImprimindo(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal de Impressão - Cartão do Membro */}
      {membroImprimindoCartao && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <CartãoMembro membro={membroImprimindoCartao} onClose={() => setMembroImprimindoCartao(null)} />
        </div>
      )}

      {/* Modal de Impressão em Lote - Cartões */}
      {imprimindoLote && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b-2 border-purple-500 bg-gradient-to-r from-purple-600 to-purple-700">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>🎫</span> Impressão em Lote
              </h2>
              <button onClick={() => setImprimindoLote(false)} className="text-white hover:text-gray-100 text-2xl">
                ✕
              </button>
            </div>

            {/* Conteúdo */}
            <div className="p-6">
              <div className="mb-4">
                <p className="text-gray-700 font-semibold mb-4">
                  Pronto para imprimir cartões de {membrosSelecionados.size} membro
                  {membrosSelecionados.size !== 1 ? 's' : ''}?
                </p>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-gray-600">
                    Os cartões serão gerados em PDF e otimizados para impressão em lote.
                  </p>
                </div>

                {/* Listagem dos membros selecionados */}
                <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto mb-4">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Membros selecionados:</p>
                  <ul className="text-xs text-gray-600 space-y-1">
                    {membros
                      .filter((m) => membrosSelecionados.has(m.id))
                      .map((m) => (
                        <li key={m.id}>
                          • {m.nome} ({m.matricula})
                        </li>
                      ))}
                  </ul>
                </div>
              </div>

              {/* Botões */}
              <div className="flex gap-4">
                <button
                  onClick={() => setImprimindoLote(false)}
                  className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-semibold"
                >
                  ✕ Cancelar
                </button>
                <CartaoBatchPrinter
                  membros={membros.filter((m) => membrosSelecionados.has(m.id))}
                  onComplete={() => {
                    setImprimindoLote(false);
                    setMembrosSelecionados(new Set());
                    setNotification({
                      isOpen: true,
                      title: 'Sucesso',
                      message: 'PDF de cartões gerado com sucesso!',
                      type: 'success',
                      autoClose: 2000,
                      showButton: false,
                    });
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
