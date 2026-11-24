import { Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, errorMessage } from '../core/api.service';
import { Analytics } from '../core/models';

@Component({
  imports: [RouterLink],
  template: `
    <p><a routerLink="/tests">← All tests</a></p>
    <h1>Test analytics</h1>
    @if (error()) { <p role="alert" class="error">{{ error() }}</p> }
    @if (a(); as a) {
      <dl class="stats">
        <div><dt>Submissions</dt><dd>{{ a.attempts }}</dd></div>
        <div><dt>Average</dt><dd>{{ a.average }}%</dd></div>
        <div><dt>Median</dt><dd>{{ a.median }}%</dd></div>
        <div><dt>Pass rate</dt><dd>{{ a.passRate }}%</dd></div>
        <div><dt>Flagged</dt><dd>{{ a.flagged }}</dd></div>
      </dl>
      <h2>Score distribution</h2>
      <div class="chart" role="img" aria-label="Score distribution histogram">
        @for (b of a.distribution; track b.from) {
          <div class="bar-col"><div class="bar" [style.height.%]="max() ? (b.count / max()) * 100 : 0" [title]="b.count + ' students'"></div>
            <small>{{ b.from }}</small></div>
        }
      </div>
      <h2>Question difficulty</h2>
      <table><thead><tr><th>Question</th><th>% correct</th></tr></thead><tbody>
        @for (q of a.questions; track q.id) { <tr><td>{{ q.text }}</td><td>{{ q.percentCorrect }}%</td></tr> }
      </tbody></table>
      <button type="button" (click)="download()">Export CSV</button>
    }
  `,
})
export class AnalyticsPage implements OnInit {
  id = input.required<string>();
  private api = inject(ApiService);
  a = signal<Analytics | null>(null);
  error = signal('');
  max = () => Math.max(0, ...(this.a()?.distribution.map((d) => d.count) ?? []));

  async ngOnInit() { try { this.a.set(await this.api.analytics(Number(this.id()))); } catch (e) { this.error.set(errorMessage(e)); } }

  async download() {
    try {
      const url = URL.createObjectURL(new Blob([await this.api.csv(Number(this.id()))], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `test-${this.id()}-results.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) { this.error.set(errorMessage(e)); }
  }
}
