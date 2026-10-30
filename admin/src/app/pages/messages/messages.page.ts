import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AdminApi, errorMessage } from '../../core/api';
import { AgoPipe, initials } from '../../core/format';
import type { ContactMessage } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';
import { UiService } from '../../shared/ui.service';

/** Messages sent from the shop's contact page. */
@Component({
  selector: 'app-messages',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, AgoPipe],
  template: `
    <div class="page">
      <header class="page-head">
        <div>
          <h1>Inbox</h1>
          <p>Messages from the contact page. Reply by e-mail.</p>
        </div>
      </header>

      @if (error()) {
        <div class="alert" role="alert">{{ error() }}</div>
      }

      <div class="wall">
        @for (m of messages(); track m.id) {
          <article class="card note">
            <header class="who">
              <span class="avatar">{{ initials(m.name) }}</span>
              <span>
                <b>{{ m.name }}</b>
                <small>{{ m.email }} · {{ m.createdAt | ago }}</small>
              </span>
            </header>
            <p>{{ m.message }}</p>
            <footer>
              <a class="btn btn-sm btn-primary" [href]="mailtoUrl(m)"><app-icon name="mail" [size]="14" /> Reply</a>
              <a class="btn btn-sm" [href]="gmailUrl(m)" target="_blank" rel="noopener" title="Reply in Gmail (opens in a new tab)">Gmail</a>
              <button class="btn btn-sm btn-danger" type="button" (click)="remove(m)"><app-icon name="trash" [size]="14" /> Delete</button>
            </footer>
          </article>
        } @empty {
          @if (!loading()) {
            <div class="card empty">
              <app-icon name="inbox" [size]="32" />
              <b>All caught up</b>
              <span>New messages from the contact page show up here.</span>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: `
    .wall {
      columns: 340px;
      column-gap: 16px;
    }
    .note,
    .empty {
      break-inside: avoid;
      margin-bottom: 16px;
    }
    .note p {
      margin: 14px 0 16px;
      white-space: pre-line;
      color: var(--ink-2);
    }
    footer {
      display: flex;
      gap: 8px;
    }
  `,
})
export class MessagesPage {
  private readonly api = inject(AdminApi);
  private readonly ui = inject(UiService);

  protected readonly messages = signal<ContactMessage[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly initials = initials;
  private readonly replySubject = 'Re: your message to ScenTop';

  private replyBody(m: ContactMessage) {
    const quoted = m.message.split('\n').map((line) => `> ${line}`).join('\n');
    return `Hi ${m.name},\n\n\n\nOn ${new Date(m.createdAt).toLocaleString()} you wrote:\n${quoted}`;
  }

  /** `mailto:` link for the visitor's address, with the subject and a quoted copy of their message. */
  protected mailtoUrl(m: ContactMessage) {
    return `mailto:${encodeURIComponent(m.email).replace('%40', '@')}?subject=${encodeURIComponent(this.replySubject)}&body=${encodeURIComponent(this.replyBody(m))}`;
  }

  /** Web-mail fallback for machines with no mail app registered for `mailto:`. */
  protected gmailUrl(m: ContactMessage) {
    const q = new URLSearchParams({ view: 'cm', fs: '1', to: m.email, su: this.replySubject, body: this.replyBody(m) });
    return `https://mail.google.com/mail/?${q}`;
  }

  constructor() {
    void this.load();
  }

  private async load() {
    try {
      this.messages.set(await this.api.messages());
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected async remove(m: ContactMessage) {
    const ok = await this.ui.confirm({ title: 'Delete this message?', text: `From ${m.name}. This cannot be undone.`, action: 'Delete', danger: true });
    if (!ok) return;
    try {
      await this.api.deleteMessage(m.id);
      this.messages.update((list) => list.filter((x) => x.id !== m.id));
      this.ui.toast('Message deleted');
    } catch (error) {
      this.ui.toast(errorMessage(error), 'error');
    }
  }
}
