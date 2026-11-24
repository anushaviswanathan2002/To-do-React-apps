import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect } from 'vitest';
import { LoginPage } from './login';

describe('LoginPage', () => {
  it('shows the server error on failed sign in', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    const fixture = TestBed.createComponent(LoginPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    c.email = 'a@b.c';
    c.password = 'wrongpass1';
    const p = c.submit();
    http.expectOne('/api/auth/login').flush({ error: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });
    await p;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain('Invalid credentials');
  });

  it('toggles to registration', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    fixture.componentInstance.toggle();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Create account');
  });
});
