import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Role, User } from './models';

const KEY = 'portal_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  readonly token = signal<string | null>(sessionStorage.getItem(KEY));
  readonly user = signal<User | null>(null);
  readonly isLoggedIn = computed(() => !!this.token());

  async restore(): Promise<void> {
    if (!this.token() || this.user()) return;
    try {
      this.user.set((await firstValueFrom(this.http.get<{ user: User }>('/api/auth/me'))).user);
    } catch {
      this.clear();
    }
  }

  async authenticate(mode: 'login' | 'register', body: Record<string, string>): Promise<void> {
    const res = await firstValueFrom(this.http.post<{ token: string; user: User }>(`/api/auth/${mode}`, body));
    sessionStorage.setItem(KEY, res.token);
    this.token.set(res.token);
    this.user.set(res.user);
  }

  hasRole(...roles: Role[]): boolean {
    const u = this.user();
    return !!u && roles.includes(u.role);
  }

  private clear() {
    sessionStorage.removeItem(KEY);
    this.token.set(null);
    this.user.set(null);
  }

  logout() {
    this.clear();
    this.router.navigate(['/login']);
  }
}
