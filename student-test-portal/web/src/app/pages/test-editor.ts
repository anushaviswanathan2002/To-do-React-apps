import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, errorMessage } from '../core/api.service';
import { QType, Question, Test } from '../core/models';

const blank = (): Question => ({ type: 'single', text: '', options: ['', ''], correct: [], points: 1 });

@Component({
  imports: [FormsModule, RouterLink],
  template: `
    @if (test(); as t) {
      <h1>Edit test</h1>
      <p><a routerLink="/tests">← All tests</a></p>
      @if (error()) { <p role="alert" class="error">{{ error() }}</p> }
      @if (notice()) { <p role="status">{{ notice() }}</p> }
      <form class="card" (ngSubmit)="saveSettings()">
        <label>Title <input name="title" [(ngModel)]="t.title" required /></label>
        <label>Subject <input name="subject" [(ngModel)]="t.subject" /></label>
        <label>Description <textarea name="desc" [(ngModel)]="t.description"></textarea></label>
        <div class="row">
          <label>Duration (min) <input name="dur" type="number" min="1" max="600" [(ngModel)]="t.duration_minutes" /></label>
          <label>Pass % <input name="pass" type="number" min="0" max="100" [(ngModel)]="t.pass_percent" /></label>
          <label>Max attempts <input name="att" type="number" min="1" max="10" [(ngModel)]="t.max_attempts" /></label>
        </div>
        <div class="row">
          <label>Opens <input name="opens" type="datetime-local" [(ngModel)]="opens" /></label>
          <label>Closes <input name="closes" type="datetime-local" [(ngModel)]="closes" /></label>
          <label class="check"><input name="shuffle" type="checkbox" [(ngModel)]="t.shuffle" /> Shuffle questions</label>
        </div>
        <div class="row">
          <button type="submit">Save settings</button>
          <button type="button" (click)="togglePublish()">{{ t.published ? 'Unpublish' : 'Publish' }}</button>
          <span>Status: <strong>{{ t.published ? 'Published' : 'Draft' }}</strong></span>
        </div>
      </form>

      <h2>Questions ({{ t.questions?.length ?? 0 }})</h2>
      <ol>
        @for (q of t.questions; track q.id) {
          <li>
            <strong>{{ q.text }}</strong> <small>[{{ q.type }}, {{ q.points }} pt]</small>
            <button type="button" class="link" (click)="edit(q)">Edit</button>
            <button type="button" class="link" (click)="remove(q)">Delete</button>
          </li>
        } @empty { <li>No questions yet.</li> }
      </ol>

      <form class="card" (ngSubmit)="saveQuestion()" aria-label="Question editor">
        <h3>{{ q.id ? 'Edit question' : 'Add question' }}</h3>
        <label>Type
          <select name="type" [ngModel]="q.type" (ngModelChange)="setType($event)">
            <option value="single">Single choice</option><option value="multiple">Multiple choice</option>
            <option value="truefalse">True / False</option><option value="short">Short answer</option>
          </select>
        </label>
        <label>Question <textarea name="text" [(ngModel)]="q.text" required></textarea></label>
        <label>Points <input name="points" type="number" min="1" max="100" [(ngModel)]="q.points" /></label>
        @if (q.type === 'short') {
          <label>Accepted answers (comma separated, case-insensitive) <input name="acc" [(ngModel)]="accepted" /></label>
        } @else {
          <fieldset>
            <legend>Options — tick the correct {{ q.type === 'multiple' ? 'answers' : 'answer' }}</legend>
            @for (o of q.options; track $index) {
              <div class="row">
                <input [type]="q.type === 'multiple' ? 'checkbox' : 'radio'" name="correct" [attr.aria-label]="'Option ' + ($index + 1) + ' is correct'"
                  [checked]="q.correct.includes($index)" (change)="mark($index)" />
                @if (q.type === 'truefalse') { <span>{{ o }}</span> }
                @else {
                  <input [name]="'opt' + $index" [attr.aria-label]="'Option ' + ($index + 1)" [ngModel]="o" (ngModelChange)="q.options[$index] = $event" />
                  @if (q.options.length > 2) { <button type="button" class="link" (click)="dropOption($index)">Remove</button> }
                }
              </div>
            }
            @if (q.type !== 'truefalse' && q.options.length < 8) { <button type="button" (click)="q.options.push('')">Add option</button> }
          </fieldset>
        }
        <div class="row">
          <button type="submit">{{ q.id ? 'Update question' : 'Add question' }}</button>
          @if (q.id) { <button type="button" class="link" (click)="reset()">Cancel</button> }
        </div>
      </form>
    }
  `,
})
export class TestEditorPage implements OnInit {
  id = input.required<string>();
  private api = inject(ApiService);
  test = signal<Test | null>(null);
  error = signal('');
  notice = signal('');
  q: Question = blank();
  accepted = '';
  opens = '';
  closes = '';

  ngOnInit() { return this.load(); }

  private local = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  async load() {
    try {
      const t = await this.api.test(Number(this.id()));
      this.opens = this.local(t.opens_at);
      this.closes = this.local(t.closes_at);
      this.test.set(t);
    } catch (e) { this.error.set(errorMessage(e)); }
  }

  private async run(fn: () => Promise<unknown>, msg: string) {
    this.error.set(''); this.notice.set('');
    try { await fn(); this.notice.set(msg); await this.load(); } catch (e) { this.error.set(errorMessage(e)); }
  }

  saveSettings() {
    const t = this.test()!;
    return this.run(() => this.api.updateTest(t.id, {
      title: t.title, subject: t.subject, description: t.description, durationMinutes: t.duration_minutes,
      passPercent: t.pass_percent, maxAttempts: t.max_attempts, shuffle: t.shuffle,
      opensAt: this.opens || null, closesAt: this.closes || null,
    }), 'Settings saved');
  }
  togglePublish() { const t = this.test()!; return this.run(() => this.api.publish(t.id, !t.published), t.published ? 'Unpublished' : 'Published'); }

  setType(type: QType) {
    this.q = { ...this.q, type, correct: [], options: type === 'truefalse' ? ['True', 'False'] : type === 'short' ? [] : this.q.options.length >= 2 && this.q.type !== 'truefalse' ? this.q.options : ['', ''] };
  }
  mark(i: number) {
    if (this.q.type === 'multiple') {
      this.q.correct = this.q.correct.includes(i) ? this.q.correct.filter((c) => c !== i) : [...this.q.correct, i];
    } else this.q.correct = [i];
  }
  dropOption(i: number) {
    this.q.options.splice(i, 1);
    this.q.correct = (this.q.correct as number[]).filter((c) => c !== i).map((c) => (c > i ? c - 1 : c));
  }
  edit(q: Question) {
    this.q = { ...q, options: [...q.options], correct: [...q.correct] };
    if (q.type === 'short') this.accepted = q.correct.join(', ');
  }
  reset() { this.q = blank(); this.accepted = ''; }

  async saveQuestion() {
    const body: Question = { ...this.q, correct: this.q.type === 'short' ? this.accepted.split(',').map((s) => s.trim()).filter(Boolean) : this.q.correct };
    const t = this.test()!;
    await this.run(() => (this.q.id ? this.api.updateQuestion(this.q.id, body) : this.api.addQuestion(t.id, body)), 'Question saved');
    if (!this.error()) this.reset();
  }
  remove(q: Question) { return confirm('Delete this question?') ? this.run(() => this.api.deleteQuestion(q.id!), 'Question deleted') : undefined; }
}
