import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule, RouterLink, ButtonModule],
  template: `
    <div class="not-found-page">
      <div class="not-found-card">
        <div class="not-found-code">404</div>
        <h1>Page not found</h1>
        <p>The page you were looking for doesn't exist or has been moved.</p>
        <p-button routerLink="/home" label="Back to Home" icon="pi pi-arrow-left"></p-button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .not-found-page {
      min-height: 70vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
      font-family: var(--font-family);
    }

    .not-found-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-xl);
      padding: 3rem 2.5rem;
      max-width: 460px;
      text-align: center;
      box-shadow: var(--shadow-sm);
    }

    .not-found-code {
      font-size: 5rem;
      font-weight: 800;
      color: var(--primary-green);
      letter-spacing: -3px;
      line-height: 1;
      margin-bottom: 0.5rem;
    }

    h1 {
      font-size: 1.5rem;
      color: var(--heading-green);
      letter-spacing: -0.4px;
      margin: 0 0 0.6rem;
    }

    p {
      color: var(--text-muted);
      line-height: 1.55;
      margin: 0 0 1.5rem;
      font-size: 0.95rem;
    }
  `]
})
export class NotFoundComponent {}
