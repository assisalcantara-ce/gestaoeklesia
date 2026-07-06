import { ExperienceWidget, WidgetContext } from '../types'
import { Sparkles, X } from 'lucide-react'

export const AchievementWidget: ExperienceWidget = {
  id: 'widget_achievement_impl_complete',
  type: 'achievement',
  priority: 80,

  canDisplay(context: WidgetContext): boolean {
    return context.progressPercent === 100
  },

  render(_context: WidgetContext, onDismiss: () => void) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 shadow-sm flex items-start gap-4 animate-fade-in relative">
        <div className="p-2 bg-emerald-100 rounded-xl text-emerald-700 shrink-0">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="space-y-1 flex-1">
          <h4 className="text-sm font-bold text-emerald-950">Conquista Desbloqueada! 🎉</h4>
          <p className="text-xs text-emerald-800 leading-relaxed">
            Parabéns! Seu ministério está 100% implantado no Gestão Eklésia. Todas as tarefas do checklist de implantação foram concluídas.
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 rounded-full text-emerald-400 hover:bg-emerald-100 transition absolute top-4 right-4"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }
}
