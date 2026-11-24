import { Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, errorMessage } from '../core/api.service';
import { ReviewItem, Result } from '../core/models';

@Component({
  imports: [RouterLink],
  template: `
    <p><a routerLink="/results">← All results</a></p>
    @if (error()) { <p role="alert" class="error">{{ error() }}</p> }
    @if (r(); as r) {
      <h1>{{ r.test_title }}</h1>
      <p class="score"><strong>{{ r.score }}/{{ r.max_score }}</strong> ({{ r.percent }}%) —
        <span [class]="r.passed ? 'badge ok' : 'badge bad'">{{ r.passed ? 'Passed' : 'Failed' }}</span>
        <small> (pass mark {{ r.pass_percent }}%)</small></p>
      @for (q of r.review; track q.id; let i = $index) {
        <section class="card" [attr.aria-label]="'Question ' + (i + 1)">
          <h2>{{ i + 1 }}. {{ q.text }} <small>{{ q.earned }}/{{ q.points }} pt</small></h2>
          <p>Your answer: <strong>{{ show(q, q.answer) }}</strong></p>
          <p>Correct answer: <strong>{{ show(q, q.correct) }}</strong></p>
        </section>
      }
    }
  `,
})
export class ResultDetailPage implements OnInit {
  id = input.required<string>();
  private api = inject(ApiService);
  r = signal<Result | null>(null);
  error = signal('');
  async ngOnInit() { try { this.r.set(await this.api.result(Number(this.id()))); } catch (e) { this.error.set(errorMessage(e)); } }

  show(q: ReviewItem, v: unknown): string {
    if (v === null || v === undefined || v === '') return '(no answer)';
    if (q.type === 'short') return Array.isArray(v) ? v.join(' / ') : String(v);
    const idx = Array.isArray(v) ? v : [v];
    return idx.map((i) => q.options[Number(i)] ?? '?').join(', ') || '(no answer)';
  }
}
