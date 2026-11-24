import { Component, OnInit, inject, signal } from '@angular/core';
import { ApiService, errorMessage } from '../core/api.service';
import { Role, User } from '../core/models';

@Component({
  template: `
    <h1>Users</h1>
    @if (error()) { <p role="alert" class="error">{{ error() }}</p> }
    <table>
      <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
      <tbody>
        @for (u of users(); track u.id) {
          <tr>
            <td>{{ u.name }}</td><td>{{ u.email }}</td>
            <td><select [attr.aria-label]="'Role for ' + u.name" [value]="u.role" (change)="setRole(u, $any($event.target).value)">
              @for (r of roles; track r) { <option [value]="r" [selected]="r === u.role">{{ r }}</option> }
            </select></td>
            <td>{{ u.active ? 'Active' : 'Disabled' }}
              <button type="button" class="link" (click)="toggle(u)">{{ u.active ? 'Disable' : 'Enable' }}</button></td>
          </tr>
        }
      </tbody>
    </table>
    <h2>Recent activity</h2>
    <ul>@for (a of audit(); track a.id) { <li>{{ a.created_at }} — {{ a.action }} {{ a.detail }}</li> }</ul>
  `,
})
export class UsersPage implements OnInit {
  private api = inject(ApiService);
  roles: Role[] = ['student', 'teacher', 'admin'];
  users = signal<User[]>([]);
  audit = signal<{ id: number; action: string; detail: string; created_at: string }[]>([]);
  error = signal('');

  async ngOnInit() {
    try { this.users.set(await this.api.users()); this.audit.set((await this.api.audit()).slice(0, 20)); }
    catch (e) { this.error.set(errorMessage(e)); }
  }
  private async patch(u: User, body: unknown) {
    this.error.set('');
    try { await this.api.patchUser(u.id, body); await this.ngOnInit(); } catch (e) { this.error.set(errorMessage(e)); await this.ngOnInit(); }
  }
  setRole(u: User, role: Role) { return this.patch(u, { role }); }
  toggle(u: User) { return this.patch(u, { active: !u.active }); }
}
