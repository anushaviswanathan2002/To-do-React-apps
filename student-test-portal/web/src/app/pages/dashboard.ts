import { Component, OnInit, inject, signal } from '@angular/core';
import { AuthService } from '../core/auth.service';
import { ApiService, errorMessage } from '../core/api.service';

@Component({
  template: `
    <h1>Welcome, {{ auth.user()?.name }}</h1>
    @if (error()) { <p role="alert" class="error">{{ error() }}</p> }
    <dl class="stats">
      @for (s of stats(); track s[0]) {
        <div><dt>{{ s[0] }}</dt><dd>{{ s[1] }}</dd></div>
      }
    </dl>
  `,
})
export class DashboardPage implements OnInit {
  auth = inject(AuthService);
  private api = inject(ApiService);
  stats = signal<[string, number | string][]>([]);
  error = signal('');

  async ngOnInit() {
    try {
      const d = await this.api.dashboard();
      this.stats.set(
        this.auth.hasRole('student')
          ? [['Available tests', d['available']], ['Completed', d['completed']], ['Passed', d['passed']], ['Average score', d['average'] + '%']]
          : [['Tests', d['tests']], ['Published', d['published']], ['Students', d['students']], ['Submissions', d['submissions']], ['In progress', d['inProgress']]],
      );
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
