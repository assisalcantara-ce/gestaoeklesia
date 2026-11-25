declare module 'page-flip' {
  export class PageFlip {
    constructor(htmlElement: HTMLElement, settings?: Record<string, any>);
    loadFromHTML(items: NodeListOf<HTMLElement> | HTMLElement[]): void;
    on(eventName: string, callback: (e: any) => void): void;
    flip(pageNum: number, corner?: 'top' | 'bottom'): void;
    getCurrentPageIndex(): number;
    destroy(): void;
  }
}
