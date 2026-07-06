import { ExperienceFeature, IExperienceService, ExperienceWidget } from './types'

export class ExperienceRegistry {
  private services = new Map<ExperienceFeature, IExperienceService>()
  private widgets: ExperienceWidget[] = []

  public register(service: IExperienceService): void {
    if (this.services.has(service.feature)) {
      console.warn(`Serviço de experiência para a feature '${service.feature}' já está registrado e será sobrescrito.`)
    }
    this.services.set(service.feature, service)
  }

  public get(feature: ExperienceFeature): IExperienceService | undefined {
    return this.services.get(feature)
  }

  public getAll(): IExperienceService[] {
    return Array.from(this.services.values())
  }

  // --- Controle de Widgets ---

  public registerWidget(widget: ExperienceWidget): void {
    if (this.widgets.find(w => w.id === widget.id)) {
      console.warn(`Widget '${widget.id}' já registrado.`)
      return
    }
    this.widgets.push(widget)
  }

  public getWidgets(): ExperienceWidget[] {
    return this.widgets
  }
}
