import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/guards';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login').then((m) => m.LoginPage), title: 'Sign in' },
  {
    path: '',
    loadComponent: () => import('./pages/shell').then((m) => m.Shell),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', loadComponent: () => import('./pages/dashboard').then((m) => m.DashboardPage), title: 'Dashboard' },
      { path: 'tests', loadComponent: () => import('./pages/tests').then((m) => m.TestsPage), title: 'Tests' },
      { path: 'manage/:id', canActivate: [roleGuard('admin', 'teacher')], loadComponent: () => import('./pages/test-editor').then((m) => m.TestEditorPage), title: 'Edit test' },
      { path: 'analytics/:id', canActivate: [roleGuard('admin', 'teacher')], loadComponent: () => import('./pages/analytics').then((m) => m.AnalyticsPage), title: 'Analytics' },
      { path: 'results', loadComponent: () => import('./pages/results').then((m) => m.ResultsPage), title: 'Results' },
      { path: 'results/:id', loadComponent: () => import('./pages/result-detail').then((m) => m.ResultDetailPage), title: 'Result' },
      { path: 'users', canActivate: [roleGuard('admin')], loadComponent: () => import('./pages/users').then((m) => m.UsersPage), title: 'Users' },
    ],
  },
  { path: 'take/:testId', canActivate: [authGuard, roleGuard('student')], loadComponent: () => import('./pages/take-test').then((m) => m.TakeTestPage), title: 'Taking test' },
  { path: '**', redirectTo: '' },
];
