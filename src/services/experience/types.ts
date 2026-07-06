import { ReactNode } from 'react'

export type ExperienceFeature =
  | 'onboarding'
  | 'guided_tour'
  | 'tips'
  | 'news'
  | 'feedback'
  | 'upgrade'
  | 'achievements'

export type ExperienceEvent =
  | 'experience:onboarding.completed'
  | 'experience:tour.completed'
  | 'experience:assistant.hidden'
  | 'experience:progress.updated'

export type ExperienceListener = (data?: any) => void

export interface ExperienceState {
  tourCompleted: boolean
  hideAssistant: boolean
  onboardingCompleted: boolean
  dismissedTips: string[]
  completedAchievements: string[]
  lastSeenVersion: string | null
}

export interface IExperienceService {
  feature: ExperienceFeature
  init(center: any): void
}

export interface WidgetContext {
  userId: string
  trialDaysRemaining: number
  progressPercent: number
  hasCongregacao: boolean
}

export interface ExperienceWidget {
  id: string
  type: 'tip' | 'news' | 'achievement' | 'trial' | 'upgrade' | 'survey'
  priority: number
  canDisplay(context: WidgetContext): boolean
  render(context: WidgetContext, onDismiss: () => void): ReactNode
  onDismiss?(): void
}
