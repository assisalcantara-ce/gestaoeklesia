import { ExperienceFeature, IExperienceService } from './types'

export class OnboardingService implements IExperienceService {
  public readonly feature: ExperienceFeature = 'onboarding'
  private center: any

  public init(center: any): void {
    this.center = center
  }

  public completeOnboarding(userId: string): void {
    const state = this.center.getState(userId)
    state.onboardingCompleted = true
    this.center.saveState(userId, state)
    this.center.emit('experience:onboarding.completed', { userId })
  }

  public isOnboardingCompleted(userId: string): boolean {
    return this.center.getState(userId).onboardingCompleted
  }
}
