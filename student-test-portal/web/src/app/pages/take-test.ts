import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService, errorMessage } from '../core/api.service';
import { Attempt, AttemptQuestion } from '../core/models';

@Component({
  template: `
    @if (attempt(); as a) {
      <header class="bar">
        <strong>{{ a.test.title }}</strong>
        <span class="spacer"></span>
        <span>Answered {{ answeredCount() }}/{{ a.questions.length }}</span>
        <span role="timer" aria-live="off" [class.warn]="remaining() < 60" [attr.aria-label]="'Time remaining ' + clock()">{{ clock() }}</span>
        @if (remaining() === 300 || remaining() === 60) { <span class="sr-only" role="alert">{{ remaining() / 60 }} minute(s) remaining</span> }
      </header>
      <main class="page">
        @if (error()) { <p role="alert" class="error">{{ error() }}</p> }
        @if (saveState()) { <p class="hint" role="status">{{ saveState() }}</p> }
        @let q = current()!;
        <section class="card" [attr.aria-label]="'Question ' + (index() + 1)">
          <h2>Question {{ index() + 1 }} of {{ a.questions.length }} <small>({{ q.points }} pt)</small></h2>
          <p class="qtext">{{ q.text }}</p>
          @switch (q.type) {
            @case ('multiple') {
              <fieldset><legend>Select all that apply</legend>
                @for (o of q.options; track $index) {
                  <label class="check"><input type="checkbox" [checked]="isChecked(q, $index)" (change)="toggle(q, $index)" /> {{ o }}</label>
                }
              </fieldset>
            }
            @case ('short') {
              <label>Your answer <input type="text" maxlength="500" [value]="shortValue(q)" (input)="setShort(q, $any($event.target).value)" /></label>
            }
            @default {
              <fieldset><legend>Select one</legend>
                @for (o of q.options; track $index) {
                  <label class="check"><input type="radio" [name]="'q' + q.id" [checked]="answers()[q.id] === $index" (change)="setSingle(q, $index)" /> {{ o }}</label>
                }
              </fieldset>
            }
          }
        </section>
        <nav class="row" aria-label="Question navigation">
          <button type="button" (click)="go(-1)" [disabled]="index() === 0">Previous</button>
          <button type="button" (click)="go(1)" [disabled]="index() === a.questions.length - 1">Next</button>
          <span class="spacer"></span>
          @for (qq of a.questions; track qq.id; let i = $index) {
            <button type="button" class="pill" [class.done]="isAnswered(qq)" [attr.aria-current]="i === index() ? 'step' : null"
              [attr.aria-label]="'Go to question ' + (i + 1) + (isAnswered(qq) ? ' (answered)' : '')" (click)="index.set(i)">{{ i + 1 }}</button>
          }
        </nav>
        <button type="button" class="primary" (click)="finish()" [disabled]="submitting()">Submit test</button>
      </main>
    } @else if (error()) { <main class="page"><p role="alert" class="error">{{ error() }}</p><button type="button" (click)="back()">Back</button></main> }
    @else { <main class="page"><p>Loading…</p></main> }
  `,
})
export class TakeTestPage implements OnInit {
  testId = input.required<string>();
  private api = inject(ApiService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  attempt = signal<Attempt | null>(null);
  answers = signal<Record<string, unknown>>({});
  index = signal(0);
  remaining = signal(0);
  error = signal('');
  saveState = signal('');
  submitting = signal(false);
  private offset = 0; // serverTime - clientTime
  private deadline = 0;
  private dirty = false;
  private timers: ReturnType<typeof setInterval>[] = [];

  current = computed(() => this.attempt()?.questions[this.index()]);
  answeredCount = computed(() => this.attempt()?.questions.filter((q) => this.isAnswered(q)).length ?? 0);
  clock = computed(() => {
    const s = Math.max(0, this.remaining());
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  });

  private onVisibility = () => { if (document.hidden) this.flag('tab_hidden'); };
  private onBlur = () => this.flag('window_blur');
  private onPaste = () => this.flag('copy_paste');
  private onUnload = (e: BeforeUnloadEvent) => { if (this.attempt() && !this.submitting()) e.preventDefault(); };

  async ngOnInit() {
    try {
      const a = await this.api.start(Number(this.testId()));
      this.attempt.set(a);
      this.answers.set({ ...a.answers });
      this.offset = new Date(a.server_time).getTime() - Date.now();
      this.deadline = new Date(a.deadline).getTime();
      this.tick();
      this.timers.push(setInterval(() => this.tick(), 1000), setInterval(() => this.autosave(), 10000));
      document.addEventListener('visibilitychange', this.onVisibility);
      window.addEventListener('blur', this.onBlur);
      document.addEventListener('copy', this.onPaste);
      document.addEventListener('paste', this.onPaste);
      window.addEventListener('beforeunload', this.onUnload);
      this.destroyRef.onDestroy(() => this.cleanup());
    } catch (e) { this.error.set(errorMessage(e)); }
  }

  private cleanup() {
    this.timers.forEach(clearInterval);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('copy', this.onPaste);
    document.removeEventListener('paste', this.onPaste);
    window.removeEventListener('beforeunload', this.onUnload);
  }

  private tick() {
    const left = Math.round((this.deadline - (Date.now() + this.offset)) / 1000);
    this.remaining.set(left);
    if (left <= 0 && !this.submitting()) void this.finish(true);
  }

  private flag(kind: string) {
    const a = this.attempt();
    if (a && !this.submitting()) this.api.event(a.id, kind).catch(() => undefined);
  }

  isAnswered(q: AttemptQuestion) {
    const v = this.answers()[q.id];
    return Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.trim() !== '' : typeof v === 'number';
  }
  isChecked(q: AttemptQuestion, i: number) { const v = this.answers()[q.id]; return Array.isArray(v) && v.includes(i); }
  shortValue(q: AttemptQuestion) { const v = this.answers()[q.id]; return typeof v === 'string' ? v : ''; }
  private set(id: number, v: unknown) { this.answers.update((a) => ({ ...a, [id]: v })); this.dirty = true; }
  setSingle(q: AttemptQuestion, i: number) { this.set(q.id, i); void this.autosave(); }
  setShort(q: AttemptQuestion, v: string) { this.set(q.id, v); }
  toggle(q: AttemptQuestion, i: number) {
    const cur = (this.answers()[q.id] as number[] | undefined) ?? [];
    this.set(q.id, cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i].sort());
    void this.autosave();
  }
  go(d: number) { this.index.update((i) => i + d); void this.autosave(); }

  async autosave() {
    const a = this.attempt();
    if (!a || !this.dirty || this.submitting()) return;
    this.dirty = false;
    try { await this.api.saveAnswers(a.id, this.answers()); this.saveState.set('Progress saved'); }
    catch { this.dirty = true; this.saveState.set('Could not save — will retry'); }
  }

  async finish(auto = false) {
    const a = this.attempt();
    if (!a || this.submitting()) return;
    const unanswered = a.questions.length - this.answeredCount();
    if (!auto && !confirm(unanswered ? `${unanswered} question(s) unanswered. Submit anyway?` : 'Submit your test now?')) return;
    this.submitting.set(true);
    this.cleanup();
    try {
      const r = await this.api.submit(a.id, this.answers());
      await this.router.navigate(['/results', r.id], { replaceUrl: true });
    } catch (e) {
      this.submitting.set(false);
      this.error.set(errorMessage(e));
    }
  }

  back() { return this.router.navigate(['/tests']); }
}
