import { ExperienceWidget, WidgetContext } from '../types'
import { Megaphone, X } from 'lucide-react'

export const NewsWidget: ExperienceWidget = {
  id: 'widget_news_acolhimento_reports',
  type: 'news',
  priority: 30,

  canDisplay(_context: WidgetContext): boolean {
    return true // Sempre elegível (prioridade menor, exibe se não houver outros widgets superiores)
  },

  render(_context: WidgetContext, onDismiss: () => void) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 shadow-sm flex items-start gap-4 animate-fade-in relative">
        <div className="p-2 bg-blue-100 rounded-xl text-blue-700 shrink-0">
          <Megaphone className="h-5 w-5" />
        </div>
        <div className="space-y-1 flex-1">
          <h4 className="text-sm font-bold text-blue-950">Novidade na Plataforma 📢</h4>
          <p className="text-xs text-blue-800 leading-relaxed">
            Novo: Relatórios Oficiais do Acolhimento já estão disponíveis. Acompanhe a integração e fluxo de visitantes do seu ministério.
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 rounded-full text-blue-400 hover:bg-blue-100 transition absolute top-4 right-4"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }
}
