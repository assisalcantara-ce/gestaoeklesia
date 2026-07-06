import { ExperienceWidget, WidgetContext } from '../types'
import { AlertCircle, X } from 'lucide-react'

export const TrialWidget: ExperienceWidget = {
  id: 'widget_trial_alert',
  type: 'trial',
  priority: 100, // Altíssima prioridade

  canDisplay(context: WidgetContext): boolean {
    return context.trialDaysRemaining > 0 && context.trialDaysRemaining <= 3
  },

  render(context: WidgetContext, onDismiss: () => void) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-5 shadow-sm flex items-start gap-4 animate-fade-in relative">
        <div className="p-2 bg-red-100 rounded-xl text-red-700 shrink-0">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div className="space-y-1 flex-1">
          <h4 className="text-sm font-bold text-red-950">Aviso do Período de Testes</h4>
          <p className="text-xs text-red-800 leading-relaxed">
            Atenção! Restam apenas <strong>{context.trialDaysRemaining} {context.trialDaysRemaining === 1 ? 'dia' : 'dias'}</strong> do seu período de teste do Gestão Eklésia. Fale com o nosso suporte para realizar o upgrade.
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 rounded-full text-red-400 hover:bg-red-100 transition absolute top-4 right-4"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }
}
