import { ExperienceFeature, IExperienceService } from './types'

export class GuidedTourService implements IExperienceService {
  public readonly feature: ExperienceFeature = 'guided_tour'
  private center: any

  public init(center: any): void {
    this.center = center
  }

  public completeTour(userId: string): void {
    const state = this.center.getState(userId)
    state.tourCompleted = true
    this.center.saveState(userId, state)
    this.center.emit('experience:tour.completed', { userId })
  }

  public isTourCompleted(userId: string): boolean {
    return this.center.getState(userId).tourCompleted
  }
}
