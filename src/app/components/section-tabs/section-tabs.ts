import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-section-tabs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './section-tabs.html',
  styleUrl: './section-tabs.scss'
})
export class SectionTabsComponent {
  @Input({ required: true }) tabs: { id: string, label: string }[] = [];
  @Input() activeId?: string;
  @Output() activeIdChange = new EventEmitter<string>();

  selectTab(id: string) {
    this.activeId = id;
    this.activeIdChange.emit(id);
  }
}
