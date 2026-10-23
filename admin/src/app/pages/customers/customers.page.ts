import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SparkComponent } from '../../charts/spark.component';
import { AdminApi, errorMessage } from '../../core/api';
import { AdminAuth } from '../../core/auth';
import { AgoPipe, PesoPipe, STATUS_LABEL, initials } from '../../core/format';
import type { AdminUser, CustomerDetail, Page, Role } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';
import { UiService } from '../../shared/ui.service';

const PAGE_SIZE = 20;
type Sort = 'newest' | 'oldest' | 'spent' | 'orders' | 'name';

@Component({
  selector: 'app-customers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, IconComponent, PesoPipe, AgoPipe, SparkComponent],
  templateUrl: './customers.page.html',
  styleUrl: './customers.page.scss',
})
export class CustomersPage {
  private readonly api = inject(AdminApi);
  private readonly ui = inject(UiService);
  private readonly router = inject(Router);
  protected readonly me = inject(AdminAuth);

  /** ?id=12 opens that customer */
  readonly id = input<string | undefined>();

  protected readonly initials = initials;
  protected readonly statusLabel = STATUS_LABEL;
  protected readonly sorts: { key: Sort; label: string }[] = [
    { key: 'newest', label: 'Newest' },
    { key: 'spent', label: 'Top spenders' },
    { key: 'orders', label: 'Most orders' },
    { key: 'name', label: 'Name' },
    { key: 'oldest', label: 'Oldest' },
  ];

  protected readonly page = signal<Page<AdminUser> | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly sort = signal<Sort>('newest');
  protected readonly role = signal<Role | ''>('');
  protected readonly offset = signal(0);
  protected query = '';

  protected readonly detail = signal<CustomerDetail | null>(null);
  protected readonly openOrder = signal<number | null>(null);
  protected readonly busy = signal(false);

  protected readonly range = computed(() => {
    const total = this.page()?.total ?? 0;
    return { from: total ? this.offset() + 1 : 0, to: Math.min(this.offset() + PAGE_SIZE, total), total };
  });

  protected readonly maxSpent = computed(() => Math.max(1, ...(this.page()?.items ?? []).map((u) => u.totalSpentCents)));

  /** Lifetime numbers for the open customer. */
  protected readonly stats = computed(() => {
    const d = this.detail();
    if (!d) return null;
    const kept = d.orders.filter((o) => o.status !== 'cancelled');
    const spent = kept.reduce((s, o) => s + o.totalCents, 0);
    const first = d.orders.at(-1)?.createdAt ?? null;
    const favourite = new Map<string, number>();
    for (const o of kept) for (const i of o.items) favourite.set(i.name, (favourite.get(i.name) ?? 0) + i.quantity);
    const fav = [...favourite].sort((a, b) => b[1] - a[1])[0];
    return {
      spent,
      orders: kept.length,
      average: kept.length ? Math.round(spent / kept.length) : 0,
      first,
      favourite: fav ? `${fav[0]} (${fav[1]})` : '—',
      // Oldest to newest, for the spending trend
      trend: [...kept].reverse().map((o) => o.totalCents),
      cartValue: d.cart.reduce((s, c) => s + c.priceCents * c.quantity, 0),
    };
  });

  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    void this.load();
    effect(() => {
      const id = Number(this.id());
      untracked(() => (id ? void this.open(id) : this.detail.set(null)));
    });
  }

  protected search() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.offset.set(0);
      void this.load();
    }, 250);
  }

  protected setSort(sort: Sort) {
    this.sort.set(sort);
    this.offset.set(0);
    void this.load();
  }

  protected setRole(role: Role | '') {
    this.role.set(role);
    this.offset.set(0);
    void this.load();
  }

  protected go(delta: number) {
    this.offset.update((o) => Math.max(0, o + delta * PAGE_SIZE));
    void this.load();
  }

  protected async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.page.set(await this.api.users({ q: this.query, sort: this.sort(), role: this.role(), limit: PAGE_SIZE, offset: this.offset() }));
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected select(user: AdminUser) {
    void this.router.navigate([], { queryParams: { id: user.id } });
  }

  protected close() {
    void this.router.navigate([], { queryParams: { id: null } });
  }

  private async open(id: number) {
    this.openOrder.set(null);
    try {
      this.detail.set(await this.api.user(id));
    } catch (error) {
      this.ui.toast(errorMessage(error), 'error');
      this.close();
    }
  }

  protected toggleOrder(id: number) {
    this.openOrder.update((current) => (current === id ? null : id));
  }

  private async update(changes: Parameters<AdminApi['updateUser']>[1], message: string) {
    const d = this.detail();
    if (!d) return;
    this.busy.set(true);
    try {
      const user = await this.api.updateUser(d.user.id, changes);
      this.detail.set({ ...d, user });
      this.page.update((p) => (p ? { ...p, items: p.items.map((u) => (u.id === user.id ? user : u)) } : p));
      this.ui.toast(message);
    } catch (error) {
      this.ui.toast(errorMessage(error), 'error');
    } finally {
      this.busy.set(false);
    }
  }

  protected async toggleAdmin(user: AdminUser) {
    const making = user.role !== 'admin';
    const ok = await this.ui.confirm({
      title: making ? `Make ${user.firstName} an admin?` : `Remove ${user.firstName}'s admin access?`,
      text: making ? 'They will be able to open this admin studio and change orders, products and customers.' : 'They will keep their shop account but can no longer open the admin studio.',
      action: making ? 'Make admin' : 'Remove access',
      danger: !making,
    });
    if (ok) await this.update({ role: making ? 'admin' : 'customer' }, making ? `${user.firstName} is now an admin` : `${user.firstName} is a customer again`);
  }

  protected async toggleDisabled(user: AdminUser) {
    if (!user.isDisabled) {
      const ok = await this.ui.confirm({
        title: `Disable ${user.firstName}'s account?`,
        text: 'They are logged out everywhere and cannot log in until you enable the account again. Their orders stay.',
        action: 'Disable account',
        danger: true,
      });
      if (!ok) return;
    }
    await this.update({ isDisabled: !user.isDisabled }, user.isDisabled ? 'Account enabled' : 'Account disabled');
  }

  protected async remove(user: AdminUser) {
    const ok = await this.ui.confirm({
      title: `Delete ${user.firstName} ${user.lastName}?`,
      text: 'The account, cart, wishlist and reviews are removed. Their orders stay for your records without name, phone or address. This cannot be undone.',
      action: 'Delete account',
      danger: true,
    });
    if (!ok) return;
    try {
      await this.api.deleteUser(user.id);
      this.ui.toast('Account deleted');
      this.close();
      await this.load();
    } catch (error) {
      this.ui.toast(errorMessage(error), 'error');
    }
  }
}
