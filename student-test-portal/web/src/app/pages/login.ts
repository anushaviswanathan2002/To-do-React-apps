import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { errorMessage } from '../core/api.service';

@Component({
  imports: [FormsModule],
  template: `
    <main class="auth">
      <form class="card" (ngSubmit)="submit()" #f="ngForm">
        <h1>Student Test Portal</h1>
        <h2>{{ mode() === 'login' ? 'Sign in' : 'Create account' }}</h2>
        @if (mode() === 'register') {
          <label>Name <input name="name" [(ngModel)]="name" required /></label>
        }
        <label>Email <input name="email" type="email" [(ngModel)]="email" required /></label>
        <label>Password <input name="password" type="password" [(ngModel)]="password" required minlength="8" /></label>
        @if (error()) { <p role="alert" class="error">{{ error() }}</p> }
        <button type="submit" [disabled]="busy() || f.invalid">{{ mode() === 'login' ? 'Sign in' : 'Register' }}</button>
        <button type="button" class="link" (click)="toggle()">
          {{ mode() === 'login' ? 'Need an account? Register' : 'Have an account? Sign in' }}
        </button>
        <p class="hint">The first registered user becomes the administrator.</p>
      </form>
    </main>
  `,
})
export class LoginPage {
  private auth = inject(AuthService);
  private router = inject(Router);
  mode = signal<'login' | 'register'>('login');
  error = signal('');
  busy = signal(false);
  name = '';
  email = '';
  password = '';

  toggle() { this.mode.update((m) => (m === 'login' ? 'register' : 'login')); this.error.set(''); }

  async submit() {
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.authenticate(this.mode(), { name: this.name, email: this.email, password: this.password });
      await this.router.navigate(['/']);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
