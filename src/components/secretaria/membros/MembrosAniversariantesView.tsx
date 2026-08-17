'use client';

import { useState, useMemo } from 'react';
import { Cake, Calendar, Search, Phone, Printer } from 'lucide-react';
import { Membro } from '@/hooks/secretaria/useMembros';

interface MembrosAniversariantesViewProps {
  membros: Membro[];
  setMembroImprimindo?: (membro: Membro) => void;
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function MembrosAniversariantesView({
  membros,
  setMembroImprimindo,
}: MembrosAniversariantesViewProps) {
  const [mesSelecionado, setMesSelecionado] = useState<number>(() => new Date().getMonth() + 1);
  const [busca, setBusca] = useState('');
  const [filtroCongregacao, setFiltroCongregacao] = useState('TODAS');

  // Extrair congregações únicas
  const congregacoes = useMemo(() => {
    const setCong = new Set<string>();
    membros.forEach(m => {
      if (m.congregacao) setCong.add(m.congregacao);
    });
    return Array.from(setCong).sort();
  }, [membros]);

  // Filtrar membros aniversariantes do mês selecionado
  const aniversariantesDoMes = useMemo(() => {
    return membros.filter(membro => {
      if (!membro.dataNascimento) return false;
      
      let mesMembro = 0;
      const raw = membro.dataNascimento.trim();
      if (raw.includes('-')) {
        const parts = raw.split('-');
        mesMembro = parseInt(parts[1], 10);
      } else if (raw.includes('/')) {
        const parts = raw.split('/');
        mesMembro = parseInt(parts[1], 10);
      }

      if (mesMembro !== mesSelecionado) return false;

      // Filtro de busca (nome, cpf, matricula)
      if (busca) {
        const termo = busca.toLowerCase();
        const matchNome = (membro.nome || '').toLowerCase().includes(termo);
        const matchCpf = (membro.cpf || '').includes(termo);
        const matchMatricula = (membro.matricula || '').includes(termo);
        if (!matchNome && !matchCpf && !matchMatricula) return false;
      }

      // Filtro de congregação
      if (filtroCongregacao !== 'TODAS') {
        if ((membro.congregacao || '').toUpperCase() !== filtroCongregacao.toUpperCase()) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      const getDia = (dt: string) => {
        if (dt.includes('-')) return parseInt(dt.split('-')[2], 10) || 0;
        if (dt.includes('/')) return parseInt(dt.split('/')[0], 10) || 0;
        return 0;
      };
      return getDia(a.dataNascimento || '') - getDia(b.dataNascimento || '');
    });
  }, [membros, mesSelecionado, busca, filtroCongregacao]);

  const calcularIdade = (dataNascimento?: string) => {
    if (!dataNascimento) return null;
    let ano = 0, mes = 0, dia = 0;
    if (dataNascimento.includes('-')) {
      const parts = dataNascimento.split('-');
      ano = parseInt(parts[0], 10);
      mes = parseInt(parts[1], 10) - 1;
      dia = parseInt(parts[2], 10);
    } else if (dataNascimento.includes('/')) {
      const parts = dataNascimento.split('/');
      dia = parseInt(parts[0], 10);
      mes = parseInt(parts[1], 10) - 1;
      ano = parseInt(parts[2], 10);
    }
    if (!ano) return null;
    const nascimento = new Date(ano, mes, dia);
    const hoje = new Date();
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const m = hoje.getMonth() - nascimento.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) {
      idade--;
    }
    return idade >= 0 ? idade : null;
  };

  const formatarDia = (dataNascimento?: string) => {
    if (!dataNascimento) return '-';
    if (dataNascimento.includes('-')) {
      const parts = dataNascimento.split('-');
      return parts[2];
    } else if (dataNascimento.includes('/')) {
      return dataNascimento.split('/')[0];
    }
    return dataNascimento;
  };

  const hojeDia = new Date().getDate();
  const hojeMes = new Date().getMonth() + 1;

  return (
    <div className="space-y-6">
      {/* Barra de Filtros e Controles */}
      <div className="bg-white rounded-lg p-5 shadow-md border-t-4 border-teal-500">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-teal-800 flex items-center gap-2">
              <Cake className="w-6 h-6 text-pink-500" />
              Aniversariantes do Mês
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Consulte e acompanhe os membros que fazem aniversário no mês selecionado.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-teal-50 px-4 py-2 rounded-lg border border-teal-200">
            <span className="text-sm font-semibold text-teal-800">Total no mês:</span>
            <span className="px-2.5 py-0.5 bg-teal-600 text-white font-bold rounded-full text-sm">
              {aniversariantesDoMes.length}
            </span>
          </div>
        </div>

        {/* Seleção de Mês em Carrossel/Tabs */}
        <div className="flex overflow-x-auto gap-2 pb-2 mb-4 scrollbar-thin">
          {MESES.map((m, idx) => {
            const numMes = idx + 1;
            const isSelected = mesSelecionado === numMes;
            const isAtual = hojeMes === numMes;
            return (
              <button
                key={m}
                onClick={() => setMesSelecionado(numMes)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-teal-600 text-white shadow-md'
                    : isAtual
                    ? 'bg-pink-100 text-pink-800 border border-pink-300 hover:bg-pink-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span>{m}</span>
                {isAtual && <span className="text-xs bg-pink-500 text-white px-1.5 py-0.2 rounded-full">Atual</span>}
              </button>
            );
          })}
        </div>

        {/* Filtros de Busca e Congregação */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-gray-100">
          <div>
            <label className="block text-xs font-semibold text-teal-700 mb-1">Buscar Membro</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Nome, CPF ou Matrícula..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border-2 border-teal-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-teal-700 mb-1">Congregação</label>
            <select
              value={filtroCongregacao}
              onChange={(e) => setFiltroCongregacao(e.target.value)}
              className="w-full px-3 py-2 border-2 border-teal-200 rounded-lg bg-teal-50 text-sm focus:outline-none focus:border-teal-500"
            >
              <option value="TODAS">TODAS AS CONGREGAÇÕES</option>
              {congregacoes.map(c => (
                <option key={c} value={c}>{c.toUpperCase()}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setBusca('');
                setFiltroCongregacao('TODAS');
                setMesSelecionado(new Date().getMonth() + 1);
              }}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm font-semibold h-[42px]"
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Tabela de Aniversariantes */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
        <div className="px-6 py-4 bg-teal-700 text-white flex justify-between items-center">
          <h3 className="font-bold flex items-center gap-2 text-base">
            <Calendar className="w-5 h-5" />
            Lista de Aniversariantes — {MESES[mesSelecionado - 1]}
          </h3>
          <span className="text-xs bg-teal-800 text-teal-100 px-3 py-1 rounded-full font-medium">
            {aniversariantesDoMes.length} membro(s) encontrado(s)
          </span>
        </div>

        {aniversariantesDoMes.length === 0 ? (
          <div className="p-12 text-center text-gray-500 space-y-3">
            <Cake className="w-12 h-12 text-gray-300 mx-auto" />
            <p className="font-semibold text-lg text-gray-600">Nenhum aniversariante encontrado</p>
            <p className="text-sm">Não há membros aniversariando no mês de {MESES[mesSelecionado - 1]} com os filtros aplicados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 text-gray-700 font-semibold border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-center w-16">Dia</th>
                  <th className="px-4 py-3 text-center w-14">Foto</th>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Idade</th>
                  <th className="px-4 py-3">Cargo / Função</th>
                  <th className="px-4 py-3">Contato / WhatsApp</th>
                  <th className="px-4 py-3">Congregação</th>
                  {setMembroImprimindo && <th className="px-4 py-3 text-center">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {aniversariantesDoMes.map(membro => {
                  const dia = formatarDia(membro.dataNascimento);
                  const idade = calcularIdade(membro.dataNascimento);
                  const isHoje = hojeMes === mesSelecionado && parseInt(dia, 10) === hojeDia;

                  return (
                    <tr
                      key={membro.id}
                      className={`hover:bg-teal-50/50 transition ${
                        isHoje ? 'bg-pink-50/80 font-medium' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full font-bold text-sm ${
                          isHoje
                            ? 'bg-pink-600 text-white shadow-sm'
                            : 'bg-teal-100 text-teal-800'
                        }`}>
                          Dia {dia}
                        </span>
                        {isHoje && <span className="block text-[10px] text-pink-600 font-bold mt-0.5">HOJE! 🎉</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="w-9 h-10 bg-gray-100 rounded overflow-hidden flex items-center justify-center mx-auto border border-gray-200">
                          {membro.fotoUrl ? (
                            <img src={membro.fotoUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-lg text-gray-400">👤</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-800">{membro.nome}</div>
                        <div className="text-xs text-gray-500">Matrícula: {membro.matricula || '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {idade !== null ? `${idade} anos` : '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        <div className="font-medium text-gray-700">{membro.cargoMinisterial || 'Membro'}</div>
                        {membro.qualFuncao && <div className="text-teal-700">{membro.qualFuncao}</div>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {membro.celular || membro.whatsapp ? (
                          <a
                            href={`https://wa.me/55${(membro.whatsapp || membro.celular || '').replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-green-700 hover:text-green-800 hover:underline font-medium"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            {membro.whatsapp || membro.celular}
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {membro.congregacao || '-'}
                      </td>
                      {setMembroImprimindo && (
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setMembroImprimindo(membro)}
                            className="p-1.5 text-teal-700 hover:bg-teal-100 rounded-lg transition"
                            title="Imprimir Ficha do Membro"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
