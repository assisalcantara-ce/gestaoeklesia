const fs = require('fs');
const path = require('path');

/* -----------------------------------------------------------------------
   Apenas reescreve a função DashboardConteudo — mantém todo o resto
   (tipos, estado, lógica de dados, DashboardGeral, DashboardLocal,
    EbdDashboardPage) intacto.
----------------------------------------------------------------------- */

// Lê o arquivo atual
const file = path.join(__dirname, '..', 'src', 'app', 'ebd', 'dashboard', 'page.tsx');
let src = fs.readFileSync(file, 'utf8');

// Marcadores de início/fim da função DashboardConteudo no arquivo
const START_MARKER = '// ─── DashboardConteudo ────────────────────────────────────────────────────────';
const END_MARKER   = '// ─── DashboardGeral ───────────────────────────────────────────────────────────';

const startIdx = src.indexOf(START_MARKER);
const endIdx   = src.indexOf(END_MARKER);

if (startIdx === -1 || endIdx === -1) {
  console.error('Marcadores não encontrados. Abortando.');
  process.exit(1);
}

const novaDashboardConteudo = `// ─── DashboardConteudo ────────────────────────────────────────────────────────
// Renderização compartilhada entre DashboardGeral e DashboardLocal

function DashboardConteudo({
  loading, selTri, setSelTri, selAno, setSelAno,
  kpis, turmasRes, rankingAlunos, tendencia, barData, pieData,
}: DashboardConteudoProps) {
  return (
    <>
      {/* Seletor trimestre / ano */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Trimestre</label>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden shadow-sm">
            {[1, 2, 3, 4].map(t => (
              <button key={t} onClick={() => setSelTri(t)}
                className={\`px-4 py-2 text-sm font-semibold transition \${selTri === t ? 'bg-[#123b63] text-white' : 'bg-white text-gray-500 hover:bg-slate-50'}\`}>
                {t}º
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Ano</label>
          <select value={selAno} onChange={e => setSelAno(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm shadow-sm bg-white">
            {[anoAtual() - 1, anoAtual(), anoAtual() + 1].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="ml-auto self-end pb-1">
          <span className="text-sm font-semibold text-[#123b63]">{TRIM_LABEL[selTri - 1]} / {selAno}</span>
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center text-gray-400 text-sm animate-pulse">Carregando dados...</div>
      ) : (
        <div className="space-y-6">

          {/* ROW 1: 6 KPIs — gradient style */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">

            {/* Alunos */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-5 rounded-lg shadow-lg hover:shadow-xl transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-90 font-medium uppercase tracking-wide">Alunos ativos</p>
                  <p className="text-3xl font-bold mt-1">{kpis.total_alunos}</p>
                  <p className="text-xs opacity-75 mt-1">matriculados</p>
                </div>
                <svg className="w-10 h-10 opacity-50" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                </svg>
              </div>
            </div>

            {/* Turmas */}
            <div className="bg-gradient-to-br from-teal-500 to-teal-600 text-white p-5 rounded-lg shadow-lg hover:shadow-xl transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-90 font-medium uppercase tracking-wide">Turmas ativas</p>
                  <p className="text-3xl font-bold mt-1">{kpis.total_turmas}</p>
                  <p className="text-xs opacity-75 mt-1">em funcionamento</p>
                </div>
                <svg className="w-10 h-10 opacity-50" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"/>
                </svg>
              </div>
            </div>

            {/* Aulas */}
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white p-5 rounded-lg shadow-lg hover:shadow-xl transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-90 font-medium uppercase tracking-wide">Aulas no trim.</p>
                  <p className="text-3xl font-bold mt-1">{kpis.total_aulas_trimestre}</p>
                  <p className="text-xs opacity-75 mt-1">realizadas</p>
                </div>
                <svg className="w-10 h-10 opacity-50" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
                </svg>
              </div>
            </div>

            {/* Presença */}
            <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-5 rounded-lg shadow-lg hover:shadow-xl transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-90 font-medium uppercase tracking-wide">Média presença</p>
                  <p className="text-3xl font-bold mt-1">{kpis.media_presenca_geral}%</p>
                  <p className="text-xs opacity-75 mt-1">{kpis.media_presenca_geral >= 70 ? 'Excelente' : kpis.media_presenca_geral >= 50 ? 'Regular' : 'Atenção'}</p>
                </div>
                <svg className="w-10 h-10 opacity-50" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
              </div>
            </div>

            {/* Visitantes */}
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-5 rounded-lg shadow-lg hover:shadow-xl transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-90 font-medium uppercase tracking-wide">Visitantes</p>
                  <p className="text-3xl font-bold mt-1">{kpis.total_visitantes_trimestre}</p>
                  <p className="text-xs opacity-75 mt-1">no trimestre</p>
                </div>
                <svg className="w-10 h-10 opacity-50" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
              </div>
            </div>

            {/* Oferta */}
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white p-5 rounded-lg shadow-lg hover:shadow-xl transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-90 font-medium uppercase tracking-wide">Oferta trimestral</p>
                  <p className="text-2xl font-bold mt-1 leading-tight">{fmtBRL(kpis.oferta_trimestre)}</p>
                  <p className="text-xs opacity-75 mt-1">arrecadado</p>
                </div>
                <svg className="w-10 h-10 opacity-50" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
                </svg>
              </div>
            </div>
          </div>

          {/* ROW 2: BarChart (2/3) + Ranking Alunos (1/3) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-800">Presença por Turma</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{TRIM_LABEL[selTri - 1]} {selAno} · média de presença (%)</p>
                </div>
                <Link href="/ebd/historico" className="flex items-center gap-1 text-xs text-blue-600 font-semibold hover:underline">
                  Ver histórico <ChevronRight size={12} />
                </Link>
              </div>
              {barData.length === 0 ? (
                <div className="h-52 flex flex-col items-center justify-center text-gray-300 gap-2">
                  <BookOpen size={32} className="opacity-30" />
                  <span className="text-sm">Nenhuma turma com aulas no trimestre</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="nome" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tickFormatter={v => \`\${v}%\`} tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(v: any) => [\`\${v}%\`, 'Presença média']}
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', fontSize: 12 }}
                      labelStyle={{ color: '#374151' }}
                    />
                    <Bar dataKey="presenca" fill="#3b82f6" radius={[8, 8, 0, 0]} maxBarSize={48}>
                      {barData.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Ranking Alunos Mais Assíduos */}
            <div className="bg-white rounded-lg shadow-lg p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-800">Mais Assíduos</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Menor taxa de faltas no trimestre</p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Award className="h-5 w-5 text-amber-500" />
                </div>
              </div>
              {rankingAlunos.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-300 gap-2">
                  <Award size={32} className="opacity-30" />
                  <span className="text-sm">Sem frequências registradas</span>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 overflow-y-auto" style={{ maxHeight: 256 }}>
                  {rankingAlunos.map((a, i) => {
                    const medalBg   = i === 0 ? 'from-amber-400 to-amber-500' : i === 1 ? 'from-slate-400 to-slate-500' : i === 2 ? 'from-orange-600 to-orange-700' : 'from-gray-200 to-gray-300';
                    const medalText = i < 3 ? 'text-white' : 'text-slate-500';
                    const barColor  = a.pct >= 70 ? '#22c55e' : a.pct >= 50 ? '#f59e0b' : '#ef4444';
                    return (
                      <div key={a.id} className="py-2.5 flex items-center gap-2.5">
                        <div className={\`w-7 h-7 rounded-full bg-gradient-to-br \${medalBg} flex items-center justify-center text-xs font-bold flex-shrink-0 \${medalText}\`}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-700 truncate">{a.nome}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: \`\${a.pct}%\`, backgroundColor: barColor }} />
                            </div>
                            <span className="text-xs font-bold shrink-0" style={{ color: barColor }}>{a.pct}%</span>
                          </div>
                        </div>
                        <span className="text-xs text-gray-400 shrink-0">{a.presentes}/{a.total}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ROW 3: AreaChart tendencia (2/3) + PieChart alunos (1/3) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-lg shadow-lg p-6">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-800">Tendência de Presenças</h3>
                <p className="text-xs text-gray-400 mt-0.5">Total de presentes por domingo registrado no trimestre</p>
              </div>
              {tendencia.length < 2 ? (
                <div className="h-48 flex flex-col items-center justify-center text-gray-300 gap-2">
                  <TrendingUp size={32} className="opacity-30" />
                  <span className="text-sm">Registre mais aulas para ver a tendência</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={tendencia} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gPresenca" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="data" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(v: any) => [v, 'Presentes']}
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', fontSize: 12 }}
                      labelStyle={{ color: '#374151' }}
                    />
                    <Area type="monotone" dataKey="presentes" stroke="#3b82f6" strokeWidth={2.5} fill="url(#gPresenca)" dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-800">Alunos por Turma</h3>
                <p className="text-xs text-gray-400 mt-0.5">Distribuição de matrículas ativas</p>
              </div>
              {pieData.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-gray-300 gap-2">
                  <Users size={28} className="opacity-30" />
                  <span className="text-sm">Sem alunos matriculados</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={76} paddingAngle={3}>
                      {pieData.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                    </Pie>
                    <Tooltip
                      formatter={(v: any) => [v, 'alunos']}
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', fontSize: 12 }}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ROW 4: Ranking de turmas */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Ranking de Turmas</h3>
                <p className="text-xs text-gray-400 mt-0.5">Ordenado por média de presença — {TRIM_LABEL[selTri - 1]}</p>
              </div>
              <Link href="/ebd/turmas" className="flex items-center gap-1 text-xs text-blue-600 font-semibold hover:underline">
                Gerenciar turmas <ChevronRight size={12} />
              </Link>
            </div>
            {turmasRes.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhuma turma com aulas no período.</p>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {turmasRes.map((t, i) => {
                    const barCol = t.media_presenca >= 70 ? '#22c55e' : t.media_presenca >= 50 ? '#f59e0b' : '#ef4444';
                    return (
                      <div key={t.id} className="flex items-center gap-3 p-4 rounded-lg border border-gray-100 hover:shadow-md transition">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                          style={{ background: \`linear-gradient(135deg, \${CORES[i % CORES.length]}, \${CORES[(i + 1) % CORES.length]})\` }}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{t.nome}</p>
                          <p className="text-xs text-gray-400 truncate">
                            <Building2 className="h-3 w-3 inline mr-0.5" />{t.church_nome} · {t.total_alunos} aluno(s)
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: \`\${t.media_presenca}%\`, backgroundColor: barCol }} />
                            </div>
                            <span className="text-xs font-bold shrink-0" style={{ color: barCol }}>{t.media_presenca}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* mini-resumo */}
                <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <p className="text-gray-600 text-xs">Total de turmas</p>
                    <p className="text-2xl font-bold text-blue-600 mt-0.5">{turmasRes.length}</p>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                    <p className="text-gray-600 text-xs">Melhor presença</p>
                    <p className="text-2xl font-bold text-green-600 mt-0.5">{Math.max(0, ...turmasRes.map(t => t.media_presenca))}%</p>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                    <p className="text-gray-600 text-xs">Média geral</p>
                    <p className="text-2xl font-bold text-purple-600 mt-0.5">
                      {turmasRes.length > 0 ? Math.round(turmasRes.reduce((s, t) => s + t.media_presenca, 0) / turmasRes.length) : 0}%
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ROW 5: Atalhos rápidos */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Acesso Rápido</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: 'Chamada Dominical', icon: '✏️', path: '/ebd/chamada',      color: 'bg-blue-50 hover:bg-blue-100 border-blue-200'   },
                { label: 'Trimestres',        icon: '📅', path: '/ebd/trimestres',   color: 'bg-teal-50 hover:bg-teal-100 border-teal-200'   },
                { label: 'Turmas',            icon: '🏫', path: '/ebd/turmas',       color: 'bg-amber-50 hover:bg-amber-100 border-amber-200' },
                { label: 'Histórico',         icon: '📋', path: '/ebd/historico',    color: 'bg-purple-50 hover:bg-purple-100 border-purple-200' },
                { label: 'Certificados',      icon: '🏆', path: '/ebd/certificados', color: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200' },
              ].map(item => (
                <Link key={item.path} href={item.path}
                  className={\`border rounded-lg p-4 transition flex flex-col items-center gap-2 text-center \${item.color}\`}>
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-xs font-semibold text-gray-700">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>

        </div>
      )}
    </>
  );
}

`;

src = src.slice(0, startIdx) + novaDashboardConteudo + src.slice(endIdx);

fs.writeFileSync(file, src, 'utf8');
console.log('Done:', file);
