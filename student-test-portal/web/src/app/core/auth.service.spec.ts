import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let svc: AuthService;
  let http: HttpTestingController;
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    svc = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  it('stores token and user after login and evaluates roles', async () => {
    const p = svc.authenticate('login', { email: 'a@b.c', password: 'password1' });
    const req = http.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    req.flush({ token: 'tok', user: { id: 1, name: 'A', email: 'a@b.c', role: 'teacher' } });
    await p;
    expect(svc.token()).toBe('tok');
    expect(sessionStorage.getItem('portal_token')).toBe('tok');
    expect(svc.hasRole('teacher', 'admin')).toBe(true);
    expect(svc.hasRole('student')).toBe(false);
  });

  it('clears the session when restore fails', async () => {
    svc.token.set('stale');
    const p = svc.restore();
    http.expectOne('/api/auth/me').flush({ error: 'x' }, { status: 401, statusText: 'Unauthorized' });
    await p;
    expect(svc.token()).toBeNull();
    expect(svc.user()).toBeNull();
  });
});
