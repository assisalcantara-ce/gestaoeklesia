import os

filepath = "src/app/agenda/page.tsx"
if not os.path.exists(filepath):
    print("File not found")
    exit(1)

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Normalize line endings
content = content.replace("\r\n", "\n")

# 1. Metric Cards Grid definition
metrics_grid = """        {/* ─── INDICADORES COMPACTOS MINISTERIAIS ESTILIZADOS (Centro de Comando) ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <ExecutiveMetricCard
            title="Oficiais"
            value={totalEventosOficiais}
            icon={ShieldCheck}
            color="indigo"
            subtitle="Calendário Oficial da Igreja"
          />

          <ExecutiveMetricCard
            title="Compromissos"
            value={eventos.length}
            icon={Calendar}
            color="slate"
            subtitle="Agendados para este mês"
          />

          <ExecutiveMetricCard
            title="Cultos & Reuniões"
            value={totalCultos + totalReunioes}
            icon={Flame}
            color="emerald"
            subtitle={`${totalCultos} Cultos e ${totalReunioes} Reuniões`}
          />

          <ExecutiveMetricCard
            title="Sincronizados"
            value={totalEventosSincronizados}
            icon={Lock}
            color="rose"
            subtitle="Integrados de outros módulos"
          />
        </div>
"""

# Insert metrics grid at the top of DashboardContent if not already there
if "INDICADORES COMPACTOS MINISTERIAIS ESTILIZADOS" not in content:
    target_dc = '      <DashboardContent>'
    replacement_dc = '      <DashboardContent>\n' + metrics_grid
    if target_dc in content:
        content = content.replace(target_dc, replacement_dc, 1)
        print("Inserted metrics grid successfully")
    else:
        print("Could not find DashboardContent start")
else:
    print("Metrics grid already inserted")

# 2. Reorganize Calendario tab using markers
start_marker = "      {activeTab === 'calendario' && (\n        <div className=\"flex flex-col lg:flex-row gap-4\">"
end_marker = "      {/* ═══════════════════════════════════════════════════════════════════ */}\n      {/* TAB 2: DASHBOARD / VISÃO GERAL                                      */}"

replacement_calendario = """      {activeTab === 'calendario' && (
        <div className="flex flex-col lg:flex-row gap-5">
          
          {/* LADO ESQUERDO: Calendário Mensal Compacto */}
          <DashboardSection
            title="Calendário Mensal"
            icon={CalendarIcon}
            className="flex-1 min-w-0"
          >
            {/* Cabeçalho da grade de dias da semana */}
            <div className="grid grid-cols-7 gap-1 text-center font-black text-slate-400 text-[10px] tracking-wider mb-2">
              <span>DOM</span>
              <span>SEG</span>
              <span>TER</span>
              <span>QUA</span>
              <span>QUI</span>
              <span>SEX</span>
              <span>SÁB</span>
            </div>

            {/* Grade de Dias */}
            <div className="grid grid-cols-7 gap-1">
              {daysInMonthArray.map((day, idx) => {
                if (day.dayNum === null) {
                  return <div key={`empty-${idx}`} className="aspect-square bg-slate-50/50 rounded-lg" />;
                }

                const dateStr = day.dateStr!;
                const diaEventos = eventosPorDia[dateStr] ?? [];
                const isSelected = selectedDate === dateStr;
                const isToday = new Date().toISOString().split('T')[0] === dateStr;

                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                    className={`aspect-square p-1 rounded-xl flex flex-col justify-between border transition relative ${
                      isSelected 
                        ? 'bg-blue-600 border-blue-600 text-white shadow-xs' 
                        : isToday
                          ? 'bg-blue-50/50 border-blue-200 text-blue-800'
                          : 'bg-white border-slate-100 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {/* Número do dia */}
                    <span className="text-xs font-bold">{day.dayNum}</span>

                    {/* Dot indicators (Oficiais/Locais/Sincronizados) */}
                    <div className="flex gap-0.5 justify-center mt-auto w-full">
                      {diaEventos.slice(0, 3).map(e => {
                        let dotColor = 'bg-slate-400';
                        if (e.calendario_oficial) dotColor = 'bg-indigo-500';
                        else if (e.bloqueado) dotColor = 'bg-rose-500';
                        else dotColor = 'bg-emerald-500';

                        return (
                          <span
                            key={e.id}
                            className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/80' : dotColor}`}
                          />
                        );
                      })}
                      {diaEventos.length > 3 && (
                        <span className={`text-[8px] font-black leading-none ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                          +
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Legenda compacta */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 pt-3 border-t border-slate-100 text-[10px] text-slate-400 font-bold justify-center">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                Oficial
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Local
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Sincronizado/Bloqueado
              </span>
            </div>
          </DashboardSection>

          {/* LADO DIREITO: Agenda dos Próximos Dias & Apoio Lateral */}
          <DashboardSidebar className="w-full lg:w-80">
            
            {/* Próximos compromissos lateral */}
            <DashboardSection
              title={selectedDate ? `Eventos de ${new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')}` : 'Compromissos do Mês'}
              icon={CalendarRange}
              actions={
                selectedDate ? (
                  <button onClick={() => setSelectedDate(null)} className="text-[10px] text-blue-600 hover:text-blue-700 font-extrabold hover:underline">
                    Ver todos
                  </button>
                ) : undefined
              }
            >
              {loading ? (
                <div className="text-xs text-slate-400 text-center py-10">Carregando eventos...</div>
              ) : eventosColunaDireita.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center p-6 gap-2 my-auto min-h-[200px]">
                  <CalendarIcon className="h-8 w-8 text-slate-200" />
                  <p className="text-xs font-bold text-slate-500">Nenhum compromisso.</p>
                </div>
              ) : (
                <div className="space-y-3 overflow-y-auto max-h-[360px] pr-1">
                  {eventosColunaDireita.map(evt => {
                    const dateObj = new Date(evt.data_inicio);
                    const hora = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    const diaNum = dateObj.getDate();
                    const mesAbrev = dateObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();

                    return (
                      <div
                        key={evt.id}
                        className={`flex gap-3.5 p-3 rounded-xl border bg-white hover:bg-slate-55/30 shadow-xs hover:shadow-md transition-all duration-300 hover:translate-y-[-1px] group relative ${
                          evt.calendario_oficial ? 'border-indigo-100 hover:border-indigo-200 border-l-4 border-l-indigo-500' :
                          evt.bloqueado ? 'border-rose-100 hover:border-rose-200 border-l-4 border-l-rose-500' : 
                          'border-emerald-100 hover:border-emerald-200 border-l-4 border-l-emerald-500'
                        }`}
                      >
                        {/* Mini data block elevado */}
                        <div className={`w-11 h-11 rounded-xl border flex flex-col items-center justify-center shrink-0 shadow-xs transition-transform duration-200 group-hover:scale-105 ${
                          evt.calendario_oficial ? 'bg-gradient-to-b from-indigo-50 to-white border-indigo-250/70' :
                          evt.bloqueado ? 'bg-gradient-to-b from-rose-50 to-white border-rose-250/70' :
                          'bg-gradient-to-b from-emerald-50 to-white border-emerald-250/70'
                        }`}>
                          <span className={`text-[8px] font-black leading-none tracking-wider ${
                            evt.calendario_oficial ? 'text-indigo-600' :
                            evt.bloqueado ? 'text-rose-600' :
                            'text-emerald-600'
                          }`}>{mesAbrev}</span>
                          <span className="text-base font-black text-slate-850 leading-none mt-0.5">{diaNum}</span>
                        </div>

                        {/* Detalhes */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] font-extrabold text-slate-400 bg-slate-50 border border-slate-200/50 px-1.5 py-0.2 rounded">{hora}</span>
                            {evt.local && <span className="text-[10px] font-semibold text-slate-400 truncate max-w-[120px]">· {evt.local}</span>}
                          </div>
                          <p className="text-xs font-black text-slate-800 truncate leading-snug">{evt.titulo}</p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            {evt.calendario_oficial && (
                              <span className="text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full font-bold shadow-2xs">Oficial</span>
                            )}
                            {evt.bloqueado && (
                              <span className="text-[9px] bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded-full font-bold shadow-2xs">Bloqueado</span>
                            )}
                            <span className="text-[9px] bg-slate-50 text-slate-600 border border-slate-200/60 px-2 py-0.5 rounded-full font-bold shadow-2xs">{getEscopoLabel(evt.escopo)}</span>
                          </div>
                        </div>

                        {/* Ações Rápidas */}
                        {isEscritaPermitida && !evt.bloqueado && (
                          <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 flex items-center gap-1 shrink-0 self-center transition-all duration-200 bg-white/90 backdrop-blur-xs pl-2">
                            <button
                              onClick={() => openForm(evt)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 rounded-lg transition-all duration-200 shadow-2xs hover:shadow-xs"
                              title="Editar"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(evt)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-lg transition-all duration-200 shadow-2xs hover:shadow-xs"
                              title="Excluir"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </DashboardSection>

            {/* Linha do Tempo Ministerial (Apoio Lateral Secundário) */}
            <DashboardSection
              title="Linha do Tempo"
              icon={TrendingUp}
            >
              {proximosEventos.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                  <CalendarIcon className="h-8 w-8 text-slate-200" />
                  <span className="font-semibold text-slate-500">Nenhum compromisso.</span>
                </div>
              ) : (
                <div className="relative border-l-2 border-slate-100 ml-4 pl-4 space-y-4 py-1">
                  {proximosEventos.map(evt => {
                    const d = new Date(evt.data_inicio);
                    const isOficial = evt.calendario_oficial;
                    const isBlocked = evt.bloqueado;

                    let bulletColor = 'bg-emerald-500 ring-emerald-100';
                    if (isOficial) bulletColor = 'bg-indigo-500 ring-indigo-100';
                    else if (isBlocked) bulletColor = 'bg-rose-500 ring-rose-100';

                    return (
                      <div key={evt.id} className="relative group transition-all duration-200">
                        <span className={`absolute -left-[22px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white ring-4 transition ${bulletColor}`} />
                        <div className="bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-xl p-2.5 transition">
                          <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400">
                            <Clock className="h-3 w-3 text-slate-400" />
                            <span>{d.toLocaleDateString('pt-BR')} às {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <h4 className="font-black text-slate-800 text-xs mt-1 truncate">{evt.titulo}</h4>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </DashboardSection>
          </DashboardSidebar>
        </div>
      )}\n\n"""

# Find index of start_marker and end_marker
start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    # Replace everything from start_marker up to end_marker
    content = content[:start_idx] + replacement_calendario + content[end_idx:]
    print("Reorganized Calendario Tab successfully via markers!")
else:
    print(f"Could not find markers. start_idx={start_idx}, end_idx={end_idx}")

# Write output back
with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print("Saved file")
