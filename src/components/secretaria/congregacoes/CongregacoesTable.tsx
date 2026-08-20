'use client';

interface Divisao1 {
  id: string;
  codigo?: number | null;
  nome: string;
  uf?: string | null;
  supervisao_id?: string;
  campo_id?: string | null;
  dirigente?: string | null;
  status_imovel?: 'PROPRIO' | 'ALUGADO' | 'CEDIDO' | null;
  supervisor_member_id?: string | null;
  supervisor_matricula?: string | null;
  supervisor_nome?: string | null;
  supervisor_cpf?: string | null;
  supervisor_data_nascimento?: string | null;
  supervisor_cargo?: string | null;
  supervisor_celular?: string | null;
  is_active: boolean;
  created_at: string;
}

interface Divisao2 {
  id: string;
  ministry_id: string;
  supervisao_id?: string | null;
  nome: string;
  is_sede: boolean;
  pastor_member_id?: string | null;
  pastor_nome?: string | null;
  pastor_data_posse?: string | null;
  cep?: string | null;
  municipio?: string | null;
  uf?: string | null;
  is_active: boolean;
  created_at: string;
}

interface Divisao3 {
  id: string;
  ministry_id: string;
  supervisao_id?: string | null;
  campo_id?: string | null;
  nome: string;
  dirigente?: string | null;
  dirigente_cpf?: string | null;
  dirigente_cargo?: string | null;
  dirigente_matricula?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status_imovel?: 'PROPRIO' | 'ALUGADO' | 'CEDIDO' | null;
  foto_url?: string | null;
  foto_bucket?: string | null;
  foto_path?: string | null;
  is_active: boolean;
  created_at: string;
}

interface CongregacoesTableProps {
  activeTab: string;
  nomeD1: string;
  nomeD2: string;
  nomeD3: string;
  d2Enabled: boolean;
  d3Enabled: boolean;
  divisoes1: Divisao1[];
  divisoes2: Divisao2[];
  divisoes3: Divisao3[];
  formatCampoLabel: (c: Divisao2) => string;
  formatSupervisaoLabel: (s: Divisao1) => string;
  onEditD1: (d: Divisao1) => void;
  onDeleteD1: (id: string) => void;
  onEditD2: (c: Divisao2) => void;
  onDeleteD2: (id: string) => void;
  onEditD3: (cg: Divisao3) => void;
  onDeleteD3: (id: string) => void;
}

export default function CongregacoesTable({
  activeTab,
  nomeD1,
  nomeD2,
  nomeD3,
  d2Enabled,
  d3Enabled,
  divisoes1,
  divisoes2,
  divisoes3,
  formatCampoLabel,
  formatSupervisaoLabel,
  onEditD1,
  onDeleteD1,
  onEditD2,
  onDeleteD2,
  onEditD3,
  onDeleteD3,
}: CongregacoesTableProps) {
  // TAB D1 (Congregações/Igrejas)
  if (activeTab === 'divisao1') {
    return (
      <>
        {/* Mobile Cards */}
        <div className="md:hidden space-y-3 mb-6">
          {divisoes1.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-4 text-center text-gray-500">
              Nenhuma {nomeD1} cadastrada
            </div>
          ) : (
            divisoes1.map(cg => {
              const campo = d2Enabled && cg.campo_id
                ? divisoes2.find(c => c.id === cg.campo_id) || null
                : null;
              const supervisao = campo?.supervisao_id
                ? divisoes1.find(s => s.id === campo.supervisao_id) || null
                : (!d2Enabled && cg.supervisao_id
                  ? divisoes1.find(s => s.id === cg.supervisao_id) || null
                  : null);
              const statusImovel = cg.status_imovel === 'PROPRIO'
                ? 'Própria'
                : cg.status_imovel === 'ALUGADO'
                  ? 'Alugada'
                  : cg.status_imovel === 'CEDIDO'
                    ? 'Cedida'
                    : '-';
              const statusAtivo = cg.is_active ? 'Ativo' : 'Inativo';
              return (
                <div key={cg.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm border-l-4 border-teal-500">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 break-words">{cg.nome}</p>
                      <p className="text-xs text-gray-500">{d2Enabled ? nomeD2 : (d3Enabled ? nomeD3 : 'Vínculo')}: {campo ? formatCampoLabel(campo) : (supervisao ? formatSupervisaoLabel(supervisao) : '-')}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold flex-shrink-0 ${
                      cg.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {statusAtivo}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-gray-600 break-words">
                    <p><span className="font-semibold">Dirigente:</span> {String((cg as any).dirigente || '').trim() || '-'}</p>
                    <p><span className="font-semibold">Campo:</span> {campo?.nome || '-'}</p>
                    <p><span className="font-semibold">Supervisão:</span> {supervisao?.nome || '-'}</p>
                    <p><span className="font-semibold">Status:</span> {statusImovel}</p>
                  </div>
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <button
                      onClick={() => onEditD3(cg as any)}
                      className="flex-1 min-w-[90px] px-3 py-2 bg-blue-500 text-white rounded-lg text-xs font-semibold hover:bg-blue-600 transition"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => onDeleteD3(cg.id)}
                      className="flex-1 min-w-[90px] px-3 py-2 bg-red-500 text-white rounded-lg text-xs font-semibold hover:bg-red-600 transition"
                    >
                      Deletar
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block bg-white rounded-lg shadow-md p-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-gray-200 text-gray-800">
                  <th className="px-4 py-3 text-left font-semibold">
                    {d2Enabled ? nomeD2.toUpperCase() : (d3Enabled ? nomeD3.toUpperCase() : 'VÍNCULO')}
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">NOME</th>
                  <th className="px-4 py-3 text-left font-semibold">DIRIGENTE</th>
                  <th className="px-4 py-3 text-left font-semibold">CONDIÇÃO</th>
                  <th className="px-4 py-3 text-center font-semibold">AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {divisoes1.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                      Nenhuma {nomeD1} cadastrada
                    </td>
                  </tr>
                ) : (
                  divisoes1.map(cg => {
                    const campo = d2Enabled && cg.campo_id
                      ? divisoes2.find(c => c.id === cg.campo_id) || null
                      : null;
                    const sup = (!d2Enabled && d3Enabled && cg.supervisao_id)
                      ? divisoes1.find(s => s.id === cg.supervisao_id) || null
                      : null;

                    return (
                      <tr key={cg.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-700">
                          {campo ? formatCampoLabel(campo) : (sup ? formatSupervisaoLabel(sup) : '-')}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-800">{cg.nome}</td>
                        <td className="px-4 py-3 text-gray-700">{String((cg as any).dirigente || '').trim() || '-'}</td>
                        <td className="px-4 py-3 text-gray-700">
                          {cg.status_imovel === 'PROPRIO'
                            ? 'Própria'
                            : cg.status_imovel === 'ALUGADO'
                              ? 'Alugada'
                              : cg.status_imovel === 'CEDIDO'
                                ? 'Cedida'
                                : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => onEditD3(cg as any)}
                            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition text-xs font-semibold"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => onDeleteD3(cg.id)}
                            className="ml-2 px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition text-xs font-semibold"
                          >
                            Deletar
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  }

  // TAB D2 (Campos)
  if (activeTab === 'divisao2') {
    return (
      <>
        {/* Mobile Cards */}
        <div className="md:hidden space-y-3 mb-6">
          {divisoes2.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-4 text-center text-gray-500">
              Nenhum {nomeD2} cadastrado
            </div>
          ) : (
            divisoes2.map(c => {
              const sup = d3Enabled && c.supervisao_id
                ? divisoes1.find(s => s.id === c.supervisao_id) || null
                : null;
              const qtdCongregacoes = divisoes1.filter(cg => cg.campo_id === c.id).length;
              return (
                <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm border-l-4 border-blue-500">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 break-words">{c.nome}</p>
                      {d3Enabled && <p className="text-xs text-gray-500">{nomeD3}: {sup ? formatSupervisaoLabel(sup) : '-'}</p>}
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold flex-shrink-0 ${
                      c.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {c.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-gray-600 break-words">
                    <p><span className="font-semibold">Responsável:</span> {c.pastor_nome || '-'}</p>
                    <p><span className="font-semibold">Município:</span> {c.municipio || '-'}</p>
                    <p><span className="font-semibold">Qtd. {nomeD1}s:</span> {qtdCongregacoes}</p>
                    <p><span className="font-semibold">Sede:</span> {c.is_sede ? 'Sim' : 'Não'}</p>
                  </div>
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <button
                      onClick={() => onEditD2(c)}
                      className="flex-1 min-w-[90px] px-3 py-2 bg-blue-500 text-white rounded-lg text-xs font-semibold hover:bg-blue-600 transition"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => onDeleteD2(c.id)}
                      className="flex-1 min-w-[90px] px-3 py-2 bg-red-500 text-white rounded-lg text-xs font-semibold hover:bg-red-600 transition"
                    >
                      Deletar
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block bg-white rounded-lg shadow-md p-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr>
                  {d3Enabled && (
                    <th className="px-4 py-3 text-left font-semibold bg-gray-200 text-gray-800">
                      {nomeD3.toUpperCase()}
                    </th>
                  )}
                  <th className="px-4 py-3 text-left font-semibold bg-gray-200 text-gray-800">NOME</th>
                  <th className="px-4 py-3 text-left font-semibold bg-gray-200 text-gray-800">PASTOR/SUPERVISOR</th>
                  <th className="px-4 py-3 text-left font-semibold bg-gray-200 text-gray-800">MUNICÍPIO</th>
                  <th className="px-4 py-3 text-left font-semibold bg-gray-200 text-gray-800">QTD. {`${nomeD1.toUpperCase()}S`}</th>
                  <th className="px-4 py-3 text-center font-semibold bg-gray-200 text-gray-800">Ações</th>
                </tr>
              </thead>
              <tbody>
                {divisoes2.length === 0 ? (
                  <tr>
                    <td colSpan={d3Enabled ? 6 : 5} className="px-4 py-6 text-center text-gray-500">
                      Nenhum {nomeD2} cadastrado
                    </td>
                  </tr>
                ) : (
                  divisoes2.map(c => {
                    const sup = d3Enabled && c.supervisao_id
                      ? divisoes1.find(s => s.id === c.supervisao_id) || null
                      : null;
                    const qtdCongregacoes = divisoes1.filter(cg => cg.campo_id === c.id).length;
                    return (
                      <tr key={c.id} className="border-b border-gray-200 hover:bg-gray-50">
                        {d3Enabled && (
                          <td className="px-4 py-3 text-gray-700">{sup ? formatSupervisaoLabel(sup) : '-'}</td>
                        )}
                        <td className="px-4 py-3 text-gray-700 font-semibold">{c.nome}</td>
                        <td className="px-4 py-3 text-gray-700">{c.pastor_nome || '-'}</td>
                        <td className="px-4 py-3 text-gray-700">{c.municipio || '-'}</td>
                        <td className="px-4 py-3 text-gray-700 font-semibold">{qtdCongregacoes}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => onEditD2(c)}
                            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition text-xs font-semibold"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => onDeleteD2(c.id)}
                            className="ml-2 px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition text-xs font-semibold"
                          >
                            Deletar
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  }

  // TAB D3 (Supervisões)
  if (activeTab === 'divisao3') {
    return (
      <>
        {/* Mobile Cards */}
        <div className="md:hidden space-y-3 mb-6">
          {divisoes1.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-4 text-center text-gray-500">
              Nenhuma {nomeD3} cadastrada
            </div>
          ) : (
            divisoes1.map(d => {
              const campos = divisoes2.filter(c => c.supervisao_id === d.id);
              const camposIds = new Set(campos.map(c => c.id));
              const qtdCongregacoes = divisoes3.filter(cg => (cg.campo_id && camposIds.has(cg.campo_id)) || (!cg.campo_id && cg.supervisao_id === d.id)).length;
              return (
                <div key={d.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm border-l-4 border-purple-500">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 break-words">{d.nome}</p>
                      <p className="text-xs text-gray-500">Responsável: {d.supervisor_nome || '-'}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold flex-shrink-0 ${
                      d.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {d.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-gray-600 break-words">
                    <p><span className="font-semibold">Campos:</span> {campos.length}</p>
                    <p><span className="font-semibold">Congregações:</span> {qtdCongregacoes}</p>
                  </div>
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <button
                      onClick={() => onEditD1(d)}
                      className="flex-1 min-w-[90px] px-3 py-2 bg-blue-500 text-white rounded-lg text-xs font-semibold hover:bg-blue-600 transition"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => onDeleteD1(d.id)}
                      className="flex-1 min-w-[90px] px-3 py-2 bg-red-500 text-white rounded-lg text-xs font-semibold hover:bg-red-600 transition"
                    >
                      Deletar
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block bg-white rounded-lg shadow-md p-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[540px] text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left font-semibold bg-gray-200 text-gray-800">NOME</th>
                  <th className="px-4 py-3 text-left font-semibold bg-gray-200 text-gray-800">PASTOR/SUPERVISOR</th>
                  <th className="px-4 py-3 text-left font-semibold bg-gray-200 text-gray-800">QTD DE SETOR</th>
                  <th className="px-4 py-3 text-center font-semibold bg-gray-200 text-gray-800">Ações</th>
                </tr>
              </thead>
              <tbody>
                {divisoes1.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                      Nenhuma {nomeD3} cadastrada
                    </td>
                  </tr>
                ) : (
                  divisoes1.map(d => {
                    const qtdSetor = divisoes2.filter(c => c.supervisao_id === d.id).length;

                    return (
                      <tr key={d.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-700 font-semibold">{d.nome}</td>
                        <td className="px-4 py-3 text-gray-700">{d.supervisor_nome || '-'}</td>
                        <td className="px-4 py-3 text-gray-700 font-semibold">{qtdSetor}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => onEditD1(d)}
                            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition text-xs font-semibold"
                          >
                            Editar
                          </button>
                          <button onClick={() => onDeleteD1(d.id)} className="ml-2 px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition text-xs font-semibold">
                            Deletar
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  }

  return null;
}
