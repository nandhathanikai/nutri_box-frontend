import { Component, EventEmitter, Input, Output, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-record-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './record-card.html',
  styleUrl: './record-card.scss'
})
export class RecordCardComponent {
  @Input({ required: true }) title!: string;
  @Input() subtitle?: string;
  @Input() status?: { label: string, tone: 'success' | 'warn' | 'danger' | 'info' | 'neutral' };
  
  @Input() fields: { label: string, value: string | TemplateRef<any> }[] = [];
  @Input() collapsibleFields?: { label: string, value: string | TemplateRef<any> }[];
  
  @Input() primaryAction?: { label: string, click: (e: Event) => void };
  @Input() secondaryActions?: { icon: string, label: string, click: (e: Event) => void }[];

  @Output() cardClick = new EventEmitter<void>();

  expanded = false;

  toggleExpand(event: Event) {
    event.stopPropagation();
    this.expanded = !this.expanded;
  }

  onCardClick() {
    this.cardClick.emit();
  }

  onActionClick(event: Event, action: { click: (e: Event) => void }) {
    event.stopPropagation();
    action.click(event);
  }

  isTemplate(value: any): value is TemplateRef<any> {
    return value instanceof TemplateRef;
  }
}
