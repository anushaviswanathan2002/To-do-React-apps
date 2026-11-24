import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, errorMessage } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { Result } from '../core/models';

@Component({
  imports: [RouterLink, DatePipe],
  template: `
    <h1>Results</h1>
    @if (error()) { <p role="alert" class="error">{{ error() }}</p> }
    <table>
      <thead><tr><th>Test</th>@if (!isStudent) { <th>Student</th> }<th>Submitted</th><th>Score</th><th>Outcome</th>@if (!isStudent) { <th>Flags</th> }<th></th></tr></thead>
      <tbody>
        @for (r of results(); track r.id) {
          <tr>
            <td>{{ r.test_title }}</td>@if (!isStudent) { <td>{{ r.user_name }}</td> }
            <td>{{ r.submitted_at | date: 'medium' }}</td>
            <td>{{ r.score }}/{{ r.max_score }} ({{ r.percent }}%)</td>
            <td><span [class]="r.passed ? 'badge ok' : 'badge bad'">{{ r.passed ? 'Passed' : 'Failed' }}</span></td>
            @if (!isStudent) { <td>{{ r.flags || '—' }}</td> }
            <td><a [routerLink]="['/results', r.id]">Review</a></td>
          </tr>
        } @empty { <tr><td colspan="7">No results yet.</td></tr> }
      </tbody>
    </table>
  `,
})
export class ResultsPage implements OnInit {
  private api = inject(ApiService);
  isStudent = inject(AuthService).hasRole('student');
  results = signal<Result[]>([]);
  error = signal('');
  async ngOnInit() { try { this.results.set(await this.api.results()); } catch (e) { this.error.set(errorMessage(e)); } }
}
