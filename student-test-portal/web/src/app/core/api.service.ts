import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Analytics, Attempt, Result, Test, User, Question } from './models';

export const errorMessage = (e: unknown): string =>
  e instanceof HttpErrorResponse ? (e.error?.error ?? `Request failed (${e.status})`) : 'Unexpected error';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private get = <T>(u: string) => firstValueFrom(this.http.get<T>(`/api${u}`));
  private post = <T>(u: string, b: unknown = {}) => firstValueFrom(this.http.post<T>(`/api${u}`, b));

  dashboard = () => this.get<Record<string, number>>('/dashboard');
  tests = () => this.get<Test[]>('/tests');
  test = (id: number) => this.get<Test>(`/tests/${id}`);
  createTest = (b: unknown) => this.post<Test>('/tests', b);
  updateTest = (id: number, b: unknown) => firstValueFrom(this.http.put<Test>(`/api/tests/${id}`, b));
  publish = (id: number, published: boolean) => this.post<Test>(`/tests/${id}/publish`, { published });
  deleteTest = (id: number) => firstValueFrom(this.http.delete(`/api/tests/${id}`));
  addQuestion = (testId: number, q: Question) => this.post(`/tests/${testId}/questions`, q);
  updateQuestion = (id: number, q: Question) => firstValueFrom(this.http.put(`/api/questions/${id}`, q));
  deleteQuestion = (id: number) => firstValueFrom(this.http.delete(`/api/questions/${id}`));
  start = (testId: number) => this.post<Attempt>(`/tests/${testId}/start`);
  saveAnswers = (id: number, answers: Record<string, unknown>) => firstValueFrom(this.http.put(`/api/attempts/${id}/answers`, { answers }));
  event = (id: number, kind: string) => this.post(`/attempts/${id}/events`, { kind });
  submit = (id: number, answers: Record<string, unknown>) => this.post<Result>(`/attempts/${id}/submit`, { answers });
  results = (testId?: number) => this.get<Result[]>(`/results${testId ? `?testId=${testId}` : ''}`);
  result = (id: number) => this.get<Result>(`/results/${id}`);
  analytics = (id: number) => this.get<Analytics>(`/tests/${id}/analytics`);
  csv = (id: number) => firstValueFrom(this.http.get(`/api/tests/${id}/export.csv`, { responseType: 'text' }));
  users = () => this.get<User[]>('/users');
  patchUser = (id: number, b: unknown) => firstValueFrom(this.http.patch<User>(`/api/users/${id}`, b));
  audit = () => this.get<{ id: number; action: string; detail: string; created_at: string }[]>('/audit');
}
