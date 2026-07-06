import { ExperienceCenter } from '@/services/experience/ExperienceCenter'

// Ponte de compatibilidade legada apontando para o novo ExperienceCenter
export const ProductExperienceService = {
  completeTour(userId: string): void {
    ExperienceCenter.getInstance().tour.completeTour(userId)
  },

  isTourCompleted(userId: string): boolean {
    return ExperienceCenter.getInstance().tour.isTourCompleted(userId)
  },

  hideAssistant(userId: string): void {
    ExperienceCenter.getInstance().assistant.hideAssistant(userId)
  },

  shouldShowAssistant(userId: string): boolean {
    return ExperienceCenter.getInstance().assistant.shouldShowAssistant(userId)
  },

  dismissTip(userId: string, tipId: string): void {
    ExperienceCenter.getInstance().dismissTip(userId, tipId)
  },

  completeAchievement(userId: string, achievementId: string): void {
    ExperienceCenter.getInstance().completeAchievement(userId, achievementId)
  }
}
