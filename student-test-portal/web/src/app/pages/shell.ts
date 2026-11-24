import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <a class="skip" href="#main">Skip to content</a>
    <header class="bar">
      <strong>Test Portal</strong>
      <nav aria-label="Main">
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Dashboard</a>
        <a routerLink="/tests" routerLinkActive="active">{{ auth.hasRole('student') ? 'Available tests' : 'Manage tests' }}</a>
        <a routerLink="/results" routerLinkActive="active">Results</a>
        @if (auth.hasRole('admin')) { <a routerLink="/users" routerLinkActive="active">Users</a> }
      </nav>
      <span class="spacer"></span>
      <span>{{ auth.user()?.name }} ({{ auth.user()?.role }})</span>
      <button type="button" (click)="auth.logout()">Sign out</button>
    </header>
    <main id="main" class="page"><router-outlet /></main>
  `,
})
export class Shell {
  auth = inject(AuthService);
}
