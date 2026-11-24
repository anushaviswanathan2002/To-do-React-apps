import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ApiService, errorMessage } from '../core/api.service';
import { Test } from '../core/models';

@Component({
  imports: [RouterLink, FormsModule, DatePipe],
  template: `
    <h1>{{ isStudent ? 'Available tests' : 'Manage tests' }}</h1>
    @if (error()) { <p role="alert" class="error">{{ error() }}</p> }
    @if (!isStudent) {
      <form class="row" (ngSubmit)="create()">
        <input name="title" aria-label="New test title" placeholder="New test title" [(ngModel)]="title" required />
        <input name="dur" type="number" aria-label="Duration in minutes" min="1" max="600" [(ngModel)]="duration" />
        <button type="submit" [disabled]="!title.trim()">Create test</button>
      </form>
    }
    <table>
      <thead><tr><th>Title</th><th>Subject</th><th>Questions</th><th>Duration</th>
        @if (isStudent) { <th>Attempts</th> } @else { <th>Status</th> }<th>Actions</th></tr></thead>
      <tbody>
        @for (t of tests(); track t.id) {
          <tr>
            <td>{{ t.title }}@if (t.closes_at) { <br /><small>Closes {{ t.closes_at | date: 'medium' }}</small> }</td>
            <td>{{ t.subject }}</td><td>{{ t.question_count }}</td><td>{{ t.duration_minutes }} min</td>
            @if (isStudent) { <td>{{ t.attempts_used }}/{{ t.max_attempts }}</td> }
            @else { <td>{{ t.published ? 'Published' : 'Draft' }}</td> }
            <td>
              @if (isStudent) {
                <button type="button" (click)="start(t)" [disabled]="!t.open_now || (t.attempts_used ?? 0) >= t.max_attempts">
                  {{ t.open_now ? 'Start / resume' : 'Not open' }}
                </button>
              } @else {
                <a [routerLink]="['/manage', t.id]">Edit</a>
                <a [routerLink]="['/analytics', t.id]">Analytics</a>
                <button type="button" class="link" (click)="remove(t)">Delete</button>
              }
            </td>
          </tr>
        } @empty { <tr><td colspan="6">No tests.</td></tr> }
      </tbody>
    </table>
  `,
})
export class TestsPage implements OnInit {
  private auth = inject(AuthService);
  private api = inject(ApiService);
  private router = inject(Router);
  isStudent = this.auth.hasRole('student');
  tests = signal<Test[]>([]);
  error = signal('');
  title = '';
  duration = 30;

  ngOnInit() { return this.load(); }

  async load() {
    try { this.tests.set(await this.api.tests()); } catch (e) { this.error.set(errorMessage(e)); }
  }
  async create() {
    this.error.set('');
    try {
      const t = await this.api.createTest({ title: this.title, durationMinutes: this.duration });
      await this.router.navigate(['/manage', t.id]);
    } catch (e) { this.error.set(errorMessage(e)); }
  }
  async remove(t: Test) {
    if (!confirm(`Delete "${t.title}"?`)) return;
    try { await this.api.deleteTest(t.id); await this.load(); } catch (e) { this.error.set(errorMessage(e)); }
  }
  async start(t: Test) {
    if (confirm(`Start "${t.title}"? The timer (${t.duration_minutes} min) begins immediately.`)) await this.router.navigate(['/take', t.id]);
  }
}
