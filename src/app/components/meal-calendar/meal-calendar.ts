import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ConfirmationService } from 'primeng/api';
import { CalendarDay, CalendarSession, CalendarResponse } from '../../services/subscription.service';

interface SkipRequest {
  date: string;
  session: CalendarSession;
}

type GridDay = CalendarDay;

interface WeekRow {
  /** Label shown above this row when a new calendar month begins. Null for continuation rows. */
  monthLabel: string | null;
  days: (GridDay | null)[];
}

@Component({
  selector: 'app-meal-calendar',
  standalone: true,
  imports: [CommonModule, ButtonModule, DialogModule],
  templateUrl: './meal-calendar.html',
  styleUrl: './meal-calendar.scss'
})
export class MealCalendarComponent {
  @Input() calendar: CalendarResponse | null = null;
  @Output() skip = new EventEmitter<SkipRequest>();
  @Output() unskip = new EventEmitter<SkipRequest>();

  selectedDay: CalendarDay | null = null;
  showDialog = false;

  constructor(private confirm: ConfirmationService) {}

  /** Group the actual subscription days into Mon-Sun rows, padding only for grid alignment. */
  get weeks(): (GridDay | null)[][] {
    if (!this.calendar?.days?.length) return [];

    const first = this.parseDate(this.calendar.days[0].date);

    // Pad the front so the first cell is a Monday
    const frontDow = first.getDay(); // 0=Sun..6=Sat
    const padBefore = frontDow === 0 ? 6 : frontDow - 1;

    const cells: (GridDay | null)[] = [];
    for (let i = 0; i < padBefore; i++) cells.push(null);
    for (const d of this.calendar.days) cells.push(d);

    // Pad the tail so the last row is complete (7 cells)
    while (cells.length % 7 !== 0) cells.push(null);

    const out: (GridDay | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
    return out;
  }

  /**
   * Same grid as `weeks`, but each row carries a month label that the template can show
   * as a section header. Only emitted for monthly subs that span more than one calendar
   * month — weekly subs get null labels so the meta strip is enough.
   */
  get weekRows(): WeekRow[] {
    const rows = this.weeks;
    if (!rows.length) return [];

    const isMonthly = this.calendar?.subscription?.duration === 'monthly';

    // Find the calendar month for each row (using the first non-null day in the row)
    const monthKeys = rows.map(row => {
      const firstReal = row.find(d => d != null) as GridDay | undefined;
      if (!firstReal) return null;
      const d = this.parseDate(firstReal.date);
      return `${d.getFullYear()}-${d.getMonth()}`;
    });

    const distinctMonths = new Set(monthKeys.filter(k => k !== null)).size;
    const showHeaders = isMonthly && distinctMonths > 1;

    let prevKey: string | null = null;
    return rows.map((days, idx) => {
      const key = monthKeys[idx];
      let label: string | null = null;
      if (showHeaders && key && key !== prevKey) {
        const firstReal = days.find(d => d != null) as GridDay;
        const d = this.parseDate(firstReal.date);
        label = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      }
      prevKey = key;
      return { monthLabel: label, days };
    });
  }

  private parseDate(iso: string): Date {
    return new Date(iso + 'T00:00:00');
  }

  /**
   * Active validity window the customer paid for, independent of the working-day
   * delivery span. Monthly = start + 30 days, weekly = start + 7 days.
   * Falls back to the stored end_date if duration is unknown.
   */
  get activeWindowEnd(): Date | null {
    const startIso = this.calendar?.subscription?.start_date;
    if (!startIso) return null;
    const start = this.parseDate(startIso);
    const duration = this.calendar?.subscription?.duration;
    const span = duration === 'monthly' ? 30 : duration === 'weekly' ? 7 : null;
    if (span === null) {
      const endIso = this.calendar?.subscription?.end_date;
      return endIso ? this.parseDate(endIso) : null;
    }
    const end = new Date(start);
    end.setDate(end.getDate() + span);
    return end;
  }

  openDay(day: GridDay | null) {
    if (!day || day.is_weekend) return;
    this.selectedDay = day;
    this.showDialog = true;
  }

  closeDialog() {
    this.showDialog = false;
    this.selectedDay = null;
  }

  onSkip(session: CalendarSession) {
    if (!this.selectedDay || !session.cancellable) return;

    this.confirm.confirm({
      message: 'Skip this meal? You can undo it before 6 PM IST on the day before delivery.',
      header: 'Confirm Skip',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.skip.emit({ date: this.selectedDay!.date, session });
        this.closeDialog();
      }
    });
  }

  onUnskip(session: CalendarSession) {
    if (!this.selectedDay || !session.undoable) return;

    this.confirm.confirm({
      message: 'Cancel the skip and reinstate this meal?',
      header: 'Cancel Skip',
      icon: 'pi pi-undo',
      accept: () => {
        this.unskip.emit({ date: this.selectedDay!.date, session });
        this.closeDialog();
      }
    });
  }

  /** Returns the dominant status for a day (used to colour the day card). */
  dayStatus(day: GridDay | null): string {
    if (!day) return 'empty';
    if (day.is_weekend) return 'weekend';
    if (day.is_today) return 'today';
    if (day.is_past) {
      // If every session is skipped, treat the day as skipped overall.
      const allSkipped = day.sessions.length > 0 && day.sessions.every(s => s.status === 'skipped');
      return allSkipped ? 'skipped-past' : 'delivered';
    }
    // Future
    const allSkipped = day.sessions.length > 0 && day.sessions.every(s => s.status === 'skipped');
    return allSkipped ? 'skipped' : 'scheduled';
  }

  monthLabel(day: CalendarDay): string {
    const d = new Date(day.date + 'T00:00:00');
    return d.toLocaleDateString(undefined, { month: 'short' });
  }

  dayNumber(day: CalendarDay): number {
    const d = new Date(day.date + 'T00:00:00');
    return d.getDate();
  }

  /** True if any session on this day can be acted on (skip or undo-skip). */
  isInteractive(day: GridDay | null): boolean {
    if (!day || day.is_weekend) return false;
    return day.sessions.some(s => s.cancellable || s.undoable);
  }

  /** Cutoff hint derived from the actual cutoff timestamp sent by the backend. */
  cutoffHint(day: CalendarDay): string {
    if (!day || day.is_weekend || day.is_past) return '';
    const session = day.sessions.find(s => s.cutoff_at);
    if (!session) return '';
    const cutoff = new Date(session.cutoff_at);
    const passed = Date.now() >= cutoff.getTime();
    const label = cutoff.toLocaleString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    });
    return passed
      ? `Cutoff (${label} IST) has passed — no changes allowed.`
      : `Skip or undo before ${label} IST.`;
  }
}
