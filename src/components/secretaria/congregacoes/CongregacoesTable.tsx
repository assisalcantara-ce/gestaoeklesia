'use client';

import { Edit3, Trash2 } from 'lucide-react';

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
  const renderCondicaoBadge = (status?: string | null) => {
    if (status === 'PROPRIO') {
      return (
        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200/90 rounded-full text-xs font-bold">
          Própria
        </span>
      );
    }
    if (status === 'ALUGADO') {
      return (
        <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200/90 rounded-full text-xs font-bold">
          Alugada
        </span>
      );
    }
    if (status === 'CEDIDO') {
      return (
        <span className="px-2.5 py-1 bg-sky-50 text-sky-800 border border-sky-200/90 rounded-full text-xs font-bold">
          Cedida
        </span>
      );
    }
    return <span className="text-slate-400 font-medium">—</span>;
  };

  // TAB D1 (Congregações/Igrejas)
  if (activeTab === 'divisao1') {
    return (
      <div className="space-y-4">
        {/* Mobile Cards */}
        <div className="md:hidden space-y-3">
          {divisoes1.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center text-slate-500 font-medium">
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
              const statusAtivo = cg.is_active ? 'Ativo' : 'Inativo';
              return (
                <div key={cg.id} className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 break-words text-sm">{cg.nome}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {d2Enabled ? nomeD2 : (d3Enabled ? nomeD3 : 'Vínculo')}: {campo ? formatCampoLabel(campo) : (supervisao ? formatSupervisaoLabel(supervisao) : '—')}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                      cg.is_active ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80' : 'bg-rose-50 text-rose-700 border border-rose-200/80'
                    }`}>
                      {statusAtivo}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                    <p><span className="font-semibold text-slate-800">Dirigente:</span> {String((cg as any).dirigente || '').trim() || '—'}</p>
                    <p><span className="font-semibold text-slate-800">Condição:</span> {cg.status_imovel ? cg.status_imovel : '—'}</p>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => onEditD3(cg as any)}
                      className="flex-1 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200/80 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-teal-700" />
                      <span>Editar</span>
                    </button>
                    <button
                      onClick={() => onDeleteD3(cg.id)}
                      className="flex-1 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Deletar</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block border border-slate-200/90 rounded-2xl overflow-hidden bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200/90 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                  <th className="px-5 py-3.5 text-left">
                    {d2Enabled ? nomeD2.toUpperCase() : (d3Enabled ? nomeD3.toUpperCase() : 'VÍNCULO')}
                  </th>
                  <th className="px-5 py-3.5 text-left">NOME</th>
                  <th className="px-5 py-3.5 text-left">DIRIGENTE</th>
                  <th className="px-5 py-3.5 text-left">CONDIÇÃO</th>
                  <th className="px-5 py-3.5 text-center">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {divisoes1.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-500 font-medium">
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
                      <tr key={cg.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-4 text-slate-600 font-medium">
                          {campo ? formatCampoLabel(campo) : (sup ? formatSupervisaoLabel(sup) : '—')}
                        </td>
                        <td className="px-5 py-4 font-bold text-slate-900">{cg.nome}</td>
                        <td className="px-5 py-4 text-slate-700 font-medium">{String((cg as any).dirigente || '').trim() || '—'}</td>
                        <td className="px-5 py-4 text-slate-700">
                          {renderCondicaoBadge(cg.status_imovel)}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => onEditD3(cg as any)}
                              className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200/80 rounded-xl transition text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-teal-700" />
                              <span>Editar</span>
                            </button>
                            <button
                              onClick={() => onDeleteD3(cg.id)}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 rounded-xl transition text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                              <span>Deletar</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // TAB D2 (Campos)
  if (activeTab === 'divisao2') {
    return (
      <div className="space-y-4">
        {/* Mobile Cards */}
        <div className="md:hidden space-y-3">
          {divisoes2.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center text-slate-500 font-medium">
              Nenhum {nomeD2} cadastrado
            </div>
          ) : (
            divisoes2.map(c => {
              const sup = d3Enabled && c.supervisao_id
                ? divisoes1.find(s => s.id === c.supervisao_id) || null
                : null;
              const qtdCongregacoes = divisoes1.filter(cg => cg.campo_id === c.id).length;
              return (
                <div key={c.id} className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 break-words text-sm">{c.nome}</p>
                      {d3Enabled && <p className="text-xs text-slate-500 mt-0.5">{nomeD3}: {sup ? formatSupervisaoLabel(sup) : '—'}</p>}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                      c.is_active ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80' : 'bg-rose-50 text-rose-700 border border-rose-200/80'
                    }`}>
                      {c.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                    <p><span className="font-semibold text-slate-800">Responsável:</span> {c.pastor_nome || '—'}</p>
                    <p><span className="font-semibold text-slate-800">Município:</span> {c.municipio || '—'}</p>
                    <p><span className="font-semibold text-slate-800">Qtd. {nomeD1}s:</span> {qtdCongregacoes}</p>
                    <p><span className="font-semibold text-slate-800">Sede:</span> {c.is_sede ? 'Sim' : 'Não'}</p>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => onEditD2(c)}
                      className="flex-1 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200/80 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-teal-700" />
                      <span>Editar</span>
                    </button>
                    <button
                      onClick={() => onDeleteD2(c.id)}
                      className="flex-1 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Deletar</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block border border-slate-200/90 rounded-2xl overflow-hidden bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200/90 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                  {d3Enabled && (
                    <th className="px-5 py-3.5 text-left">
                      {nomeD3.toUpperCase()}
                    </th>
                  )}
                  <th className="px-5 py-3.5 text-left">NOME</th>
                  <th className="px-5 py-3.5 text-left">PASTOR/SUPERVISOR</th>
                  <th className="px-5 py-3.5 text-left">MUNICÍPIO</th>
                  <th className="px-5 py-3.5 text-left">QTD. {`${nomeD1.toUpperCase()}S`}</th>
                  <th className="px-5 py-3.5 text-center">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {divisoes2.length === 0 ? (
                  <tr>
                    <td colSpan={d3Enabled ? 6 : 5} className="px-5 py-8 text-center text-slate-500 font-medium">
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
                      <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                        {d3Enabled && (
                          <td className="px-5 py-4 text-slate-600 font-medium">{sup ? formatSupervisaoLabel(sup) : '—'}</td>
                        )}
                        <td className="px-5 py-4 text-slate-900 font-bold">{c.nome}</td>
                        <td className="px-5 py-4 text-slate-700 font-medium">{c.pastor_nome || '—'}</td>
                        <td className="px-5 py-4 text-slate-700 font-medium">{c.municipio || '—'}</td>
                        <td className="px-5 py-4 text-slate-900 font-bold">{qtdCongregacoes}</td>
                        <td className="px-5 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => onEditD2(c)}
                              className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200/80 rounded-xl transition text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-teal-700" />
                              <span>Editar</span>
                            </button>
                            <button
                              onClick={() => onDeleteD2(c.id)}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 rounded-xl transition text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                              <span>Deletar</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // TAB D3 (Supervisões)
  if (activeTab === 'divisao3') {
    return (
      <div className="space-y-4">
        {/* Mobile Cards */}
        <div className="md:hidden space-y-3">
          {divisoes1.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center text-slate-500 font-medium">
              Nenhuma {nomeD3} cadastrada
            </div>
          ) : (
            divisoes1.map(d => {
              const campos = divisoes2.filter(c => c.supervisao_id === d.id);
              const camposIds = new Set(campos.map(c => c.id));
              const qtdCongregacoes = divisoes3.filter(cg => (cg.campo_id && camposIds.has(cg.campo_id)) || (!cg.campo_id && cg.supervisao_id === d.id)).length;
              return (
                <div key={d.id} className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 break-words text-sm">{d.nome}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Responsável: {d.supervisor_nome || '—'}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                      d.is_active ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80' : 'bg-rose-50 text-rose-700 border border-rose-200/80'
                    }`}>
                      {d.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                    <p><span className="font-semibold text-slate-800">Campos:</span> {campos.length}</p>
                    <p><span className="font-semibold text-slate-800">Congregações:</span> {qtdCongregacoes}</p>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => onEditD1(d)}
                      className="flex-1 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200/80 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-teal-700" />
                      <span>Editar</span>
                    </button>
                    <button
                      onClick={() => onDeleteD1(d.id)}
                      className="flex-1 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Deletar</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block border border-slate-200/90 rounded-2xl overflow-hidden bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[540px] text-sm">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200/90 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                  <th className="px-5 py-3.5 text-left">NOME</th>
                  <th className="px-5 py-3.5 text-left">PASTOR/SUPERVISOR</th>
                  <th className="px-5 py-3.5 text-left">QTD DE SETOR</th>
                  <th className="px-5 py-3.5 text-center">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {divisoes1.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-slate-500 font-medium">
                      Nenhuma {nomeD3} cadastrada
                    </td>
                  </tr>
                ) : (
                  divisoes1.map(d => {
                    const qtdSetor = divisoes2.filter(c => c.supervisao_id === d.id).length;

                    return (
                      <tr key={d.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-4 text-slate-900 font-bold">{d.nome}</td>
                        <td className="px-5 py-4 text-slate-700 font-medium">{d.supervisor_nome || '—'}</td>
                        <td className="px-5 py-4 text-slate-900 font-bold">{qtdSetor}</td>
                        <td className="px-5 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => onEditD1(d)}
                              className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200/80 rounded-xl transition text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-teal-700" />
                              <span>Editar</span>
                            </button>
                            <button
                              onClick={() => onDeleteD1(d.id)}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 rounded-xl transition text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                              <span>Deletar</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
