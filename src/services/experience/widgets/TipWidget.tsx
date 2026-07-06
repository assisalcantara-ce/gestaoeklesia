import { ExperienceWidget, WidgetContext } from '../types'
import { Compass, X } from 'lucide-react'

export const TipWidget: ExperienceWidget = {
  id: 'widget_tip_congregacao',
  type: 'tip',
  priority: 50,

  canDisplay(context: WidgetContext): boolean {
    return !context.hasCongregacao
  },

  render(_context: WidgetContext, onDismiss: () => void) {
    return (
      <div className="bg-amber-50/70 border border-amber-200/60 rounded-2xl p-5 shadow-sm flex items-start gap-4 animate-fade-in relative">
        <div className="p-2 bg-amber-100/80 rounded-xl text-amber-700 shrink-0">
          <Compass className="h-5 w-5" />
        </div>
        <div className="space-y-1 flex-1">
          <h4 className="text-sm font-bold text-amber-950">Dica de Configuração</h4>
          <p className="text-xs text-amber-850 leading-relaxed">
            Cadastre sua primeira congregação para começar a usar todos os módulos e organizar a secretaria da sua igreja local.
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 rounded-full text-amber-400 hover:bg-amber-100 transition absolute top-4 right-4"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }
}
