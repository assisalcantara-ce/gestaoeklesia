import { ExperienceFeature, IExperienceService } from './types'

export class AssistantService implements IExperienceService {
  public readonly feature: ExperienceFeature = 'onboarding' // Compartilha ou usa onboarding/implantação
  private center: any

  public init(center: any): void {
    this.center = center
  }

  public hideAssistant(userId: string): void {
    const state = this.center.getState(userId)
    state.hideAssistant = true
    this.center.saveState(userId, state)
    this.center.emit('experience:assistant.hidden', { userId })
  }

  public shouldShowAssistant(userId: string): boolean {
    return !this.center.getState(userId).hideAssistant
  }
}
