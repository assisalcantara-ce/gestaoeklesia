'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

import { createClient } from '@/lib/supabase-client';

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [dataAtual, setDataAtual] = useState('');
  const [usuarioLogado, setUsuarioLogado] = useState<{
    nome: string;
    email: string;
    nivel: string;
  } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const { data } = await supabase.auth.getUser();

        if (!data.user) {
          router.push('/');
          return;
        }

        // Tentar buscar role do usuário no ministério (quando existir)
        const { data: mu } = await supabase
          .from('ministry_users')
          .select('role')
          .eq('user_id', data.user.id)
          .maybeSingle();

        const nivel = mu?.role ? String(mu.role) : 'viewer';

        setUsuarioLogado({
          nome: data.user.user_metadata?.full_name || data.user.email || 'Usuário',
          email: data.user.email || '',
          nivel,
        });
      } finally {
        setAuthLoading(false);
      }
    };

    run();
  }, [router]);

  useEffect(() => {
    const formatarData = () => {
      const agora = new Date();
      const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
      const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
      
      const diaSemana = dias[agora.getDay()];
      const dia = agora.getDate();
      const mes = meses[agora.getMonth()];
      const ano = agora.getFullYear();
      const horas = String(agora.getHours()).padStart(2, '0');
      const minutos = String(agora.getMinutes()).padStart(2, '0');
      
      return `${diaSemana}, ${dia} de ${mes} de ${ano} - ${horas}:${minutos}`;
    };
    
    setDataAtual(formatarData());
    
    // Atualizar a cada minuto
    const intervalo = setInterval(() => {
      setDataAtual(formatarData());
    }, 60000);
    
    return () => clearInterval(intervalo);
  }, []);

  const handleLogout = () => {
    supabase.auth.signOut().finally(() => router.push('/'));
  };

  const getNivelExibicao = (nivel: string) => {
    const mapeamento: { [key: string]: string } = {
      'admin': 'Administrador',
      'manager': 'Gerente',
      'operator': 'Operador',
      'viewer': 'Visualizador'
    };
    return mapeamento[nivel] || nivel;
  };

  const getCorNivel = (nivel: string) => {
    const cores: { [key: string]: string } = {
      'admin': 'bg-red-100 text-red-800',
      'manager': 'bg-green-100 text-green-800',
      'operator': 'bg-blue-100 text-blue-800',
      'viewer': 'bg-gray-100 text-gray-800'
    };
    return cores[nivel] || 'bg-gray-100 text-gray-800';
  };

  if (authLoading) return <div className="p-8">Carregando...</div>;

  const statsCards = [
    { title: 'Tesouraria', value: 'R$ 0,00', subtitle: 'Saldo total', icon: '💰', color: 'bg-orange-100' },
    { title: 'Achados e Perdidos', value: '0', subtitle: 'itens registrados', icon: '🔍', color: 'bg-green-100' },
    { title: 'Financeiro', value: 'R$ 0,00', subtitle: 'Receitas', icon: '💳', color: 'bg-cyan-100' },
    { title: 'Comissão', value: '0', subtitle: 'membros ativos', icon: '👥', color: 'bg-yellow-100' },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} />

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {/* HEADER */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-[#123b63]">Bem-vindo ao Dashboard</h1>
              <p className="text-gray-600 mt-1">{dataAtual}</p>
            </div>
            {usuarioLogado && (
              <div className="flex items-center gap-6 bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                <div className="text-right">
                  <p className="text-sm font-semibold text-[#123b63]">{usuarioLogado.nome}</p>
                  <p className="text-xs text-gray-600 mt-1">{usuarioLogado.email}</p>
                  <div className="mt-2 flex justify-end">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${getCorNivel(usuarioLogado.nivel)}`}>
                      {getNivelExibicao(usuarioLogado.nivel)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold text-sm whitespace-nowrap"
                >
                  Sair
                </button>
              </div>
            )}
          </div>

          {/* STATS CARDS */}
          <div className="mb-12">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {statsCards.map((card, index) => (
                <div
                  key={index}
                  className={`${card.color} rounded-2xl p-6 hover:shadow-md transition cursor-pointer border-2 border-gray-300 shadow-sm hover:scale-105`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-gray-700 text-sm font-semibold">{card.title}</p>
                      <h3 className="text-2xl font-bold text-[#123b63] mt-2">{card.value}</h3>
                      <p className="text-gray-600 text-xs mt-2">{card.subtitle}</p>
                    </div>
                    <span className="text-4xl">{card.icon}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RECENT ACTIVITY SECTION */}
          <div className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* MISSÕES */}
            <div className="bg-white rounded-2xl p-8 shadow-md hover:shadow-lg transition">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-lg font-bold text-[#123b63]">Missões</h3>
                  <p className="text-gray-600 text-xs mt-2">Atividades em andamento</p>
                </div>
                <span className="text-3xl">✈️</span>
              </div>
              <p className="text-3xl font-bold text-[#123b63] mt-4">0</p>
            </div>

            {/* PATRIMÔNIO */}
            <div className="bg-white rounded-2xl p-8 shadow-md hover:shadow-lg transition">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-lg font-bold text-[#123b63]">Patrimônio</h3>
                  <p className="text-gray-600 text-xs mt-2">Bens da instituição</p>
                </div>
                <span className="text-3xl">🏢</span>
              </div>
              <p className="text-3xl font-bold text-[#123b63] mt-4">0</p>
            </div>

            {/* EVENTOS */}
            <div className="bg-white rounded-2xl p-8 shadow-md hover:shadow-lg transition">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-lg font-bold text-[#123b63]">Eventos</h3>
                  <p className="text-gray-600 text-xs mt-2">Próximos eventos</p>
                </div>
                <span className="text-3xl">📅</span>
              </div>
              <p className="text-3xl font-bold text-[#123b63] mt-4">0</p>
            </div>
            </div>
          </div>

          {/* SECOND ROW - MORE OPTIONS */}
          <div className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* SECRETARIA */}
            <div className="bg-white rounded-2xl p-8 shadow-md hover:shadow-lg transition">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-lg font-bold text-[#123b63]">Secretaria</h3>
                  <p className="text-gray-600 text-xs mt-2">Documentos</p>
                </div>
                <span className="text-3xl">📝</span>
              </div>
              <p className="text-3xl font-bold text-[#123b63] mt-4">0</p>
            </div>

            {/* REUNIÕES */}
            <div className="bg-white rounded-2xl p-8 shadow-md hover:shadow-lg transition">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-lg font-bold text-[#123b63]">Reuniões</h3>
                  <p className="text-gray-600 text-xs mt-2">Agendadas</p>
                </div>
                <span className="text-3xl">🤝</span>
              </div>
              <p className="text-3xl font-bold text-[#123b63] mt-4">0</p>
            </div>

            {/* PRESIDÊNCIA */}
            <div className="bg-white rounded-2xl p-8 shadow-md hover:shadow-lg transition">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-lg font-bold text-[#123b63]">Presidência</h3>
                  <p className="text-gray-600 text-xs mt-2">Atividades</p>
                </div>
                <span className="text-3xl">👑</span>
              </div>
              <p className="text-3xl font-bold text-[#123b63] mt-4">0</p>
            </div>
            </div>
          </div>

          {/* THIRD ROW - FINAL OPTIONS */}
          <div className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* EBD */}
            <div className="bg-white rounded-2xl p-8 shadow-md hover:shadow-lg transition">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-lg font-bold text-[#123b63]">EBD</h3>
                  <p className="text-gray-600 text-xs mt-2">Escola Bíblica</p>
                </div>
                <span className="text-3xl">📚</span>
              </div>
              <p className="text-3xl font-bold text-[#123b63] mt-4">0</p>
            </div>

            {/* FUNCIONÁRIOS */}
            <div className="bg-white rounded-2xl p-8 shadow-md hover:shadow-lg transition">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-lg font-bold text-[#123b63]">Funcionários</h3>
                  <p className="text-gray-600 text-xs mt-2">Equipe</p>
                </div>
                <span className="text-3xl">👔</span>
              </div>
              <p className="text-3xl font-bold text-[#123b63] mt-4">0</p>
            </div>

            {/* AUDITORIA */}
            <div className="bg-white rounded-2xl p-8 shadow-md hover:shadow-lg transition">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-lg font-bold text-[#123b63]">Auditoria</h3>
                  <p className="text-gray-600 text-xs mt-2">Registros</p>
                </div>
                <span className="text-3xl">✅</span>
              </div>
              <p className="text-3xl font-bold text-[#123b63] mt-4">0</p>
            </div>
            </div>
          </div>

          {/* KIDS */}
          <div className="mb-6">
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-white rounded-2xl p-8 shadow-md hover:shadow-lg transition">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-[#123b63]">KIDs</h3>
                    <p className="text-gray-600 text-xs mt-2">Ministério Infantil</p>
                  </div>
                  <span className="text-3xl">👶</span>
                </div>
                <p className="text-3xl font-bold text-[#123b63] mt-4">0</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
