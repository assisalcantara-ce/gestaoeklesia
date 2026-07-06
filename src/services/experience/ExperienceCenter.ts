import { ExperienceRegistry } from './ExperienceRegistry'
import { OnboardingService } from './OnboardingService'
import { GuidedTourService } from './GuidedTourService'
import { AssistantService } from './AssistantService'
import { TrialWidget } from './widgets/TrialWidget'
import { TipWidget } from './widgets/TipWidget'
import { AchievementWidget } from './widgets/AchievementWidget'
import { NewsWidget } from './widgets/NewsWidget'
import {
  ExperienceEvent,
  ExperienceListener,
  ExperienceState,
  ExperienceWidget,
  WidgetContext
} from './types'

const STORAGE_PREFIX = 'eklesia_experience_'

export class ExperienceCenter {
  private static instance: ExperienceCenter
  private registry = new ExperienceRegistry()
  private listeners = new Map<ExperienceEvent, Set<ExperienceListener>>()

  private constructor() {
    // Registra os serviços core da plataforma
    this.registry.register(new OnboardingService())
    this.registry.register(new GuidedTourService())
    this.registry.register(new AssistantService())

    // Registra os widgets iniciais
    this.registry.registerWidget(TrialWidget)
    this.registry.registerWidget(TipWidget)
    this.registry.registerWidget(AchievementWidget)
    this.registry.registerWidget(NewsWidget)

    // Inicializa todos os serviços registrados
    this.registry.getAll().forEach(service => service.init(this))
  }

  public static getInstance(): ExperienceCenter {
    if (!ExperienceCenter.instance) {
      ExperienceCenter.instance = new ExperienceCenter()
    }
    return ExperienceCenter.instance
  }

  // --- Sistema de Estado ---

  private getStorageKey(userId: string): string {
    return `${STORAGE_PREFIX}${userId}`
  }

  public getState(userId: string): ExperienceState {
    if (typeof window === 'undefined') {
      return this.getDefaultState()
    }
    try {
      const data = localStorage.getItem(this.getStorageKey(userId))
      if (data) {
        return { ...this.getDefaultState(), ...JSON.parse(data) }
      }
    } catch (e) {
      console.error('Erro ao ler estado do ExperienceCenter:', e)
    }
    return this.getDefaultState()
  }

  public saveState(userId: string, state: ExperienceState): void {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(this.getStorageKey(userId), JSON.stringify(state))
      this.emit('experience:progress.updated', { userId, state })
    } catch (e) {
      console.error('Erro ao salvar estado do ExperienceCenter:', e)
    }
  }

  private getDefaultState(): ExperienceState {
    return {
      tourCompleted: false,
      hideAssistant: false,
      onboardingCompleted: false,
      dismissedTips: [],
      completedAchievements: [],
      lastSeenVersion: null
    }
  }

  // --- Sistema de Eventos ---

  public on(event: ExperienceEvent, listener: ExperienceListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(listener)
  }

  public off(event: ExperienceEvent, listener: ExperienceListener): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.delete(listener)
    }
  }

  public emit(event: ExperienceEvent, data?: any): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach(listener => {
        try {
          listener(data)
        } catch (e) {
          console.error(`Erro ao disparar listener para evento ${event}:`, e)
        }
      })
    }
  }

  // --- Acesso aos Serviços ---

  public get onboarding(): OnboardingService {
    return this.registry.get('onboarding') as OnboardingService
  }

  public get tour(): GuidedTourService {
    return this.registry.get('guided_tour') as GuidedTourService
  }

  public get assistant(): AssistantService {
    return this.registry.get('onboarding') as unknown as AssistantService
  }

  // --- Sistema de Widgets ---

  public registerWidget(widget: ExperienceWidget): void {
    this.registry.registerWidget(widget)
  }

  public getActiveWidgets(context: WidgetContext): ExperienceWidget[] {
    const state = this.getState(context.userId)
    return this.registry
      .getWidgets()
      .filter(w => {
        // Se já foi dispensado pelo usuário, não exibe
        if (state.dismissedTips.includes(w.id)) {
          return false
        }
        return w.canDisplay(context)
      })
      .sort((a, b) => b.priority - a.priority)
  }

  public dismissWidget(userId: string, widgetId: string): void {
    const state = this.getState(userId)
    if (!state.dismissedTips.includes(widgetId)) {
      state.dismissedTips.push(widgetId)
      this.saveState(userId, state)
    }
    // Executa callback opcional se existir
    const widget = this.registry.getWidgets().find(w => w.id === widgetId)
    if (widget?.onDismiss) {
      widget.onDismiss()
    }
  }

  // Compatibilidade com lógica legada de dicas e conquistas
  public completeAchievement(userId: string, achievementId: string): void {
    const state = this.getState(userId)
    if (!state.completedAchievements.includes(achievementId)) {
      state.completedAchievements.push(achievementId)
      this.saveState(userId, state)
    }
  }

  public dismissTip(userId: string, tipId: string): void {
    this.dismissWidget(userId, tipId)
  }
}
