import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, Validators } from '@angular/forms';
import { registerIcons } from '../../core/icons';
import { TextFieldComponent } from './text-field.component';

@Component({
  imports: [TextFieldComponent],
  template: `<app-text-field label="E-mail" type="email" [control]="control" />`,
})
class HostComponent {
  control = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] });
}

describe('TextFieldComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  const note = () => (fixture.nativeElement as HTMLElement).querySelector('.note')!.textContent!.trim();

  beforeEach(async () => {
    registerIcons();
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
  });

  it('shows no error until the field has been touched', async () => {
    expect(note()).toBe('');

    fixture.componentInstance.control.markAsTouched();
    await fixture.whenStable();
    expect(note()).toBe('E-mail is required.');
  });

  it('explains an invalid e-mail address', async () => {
    const control = fixture.componentInstance.control;
    control.setValue('not-an-email');
    control.markAsTouched();
    await fixture.whenStable();

    expect(note()).toBe('Enter a valid e-mail address.');
  });

  it('shows a message that came back from the server', async () => {
    const control = fixture.componentInstance.control;
    control.setValue('ana@example.test');
    control.setErrors({ server: 'An account with this e-mail already exists.' });
    control.markAsTouched();
    await fixture.whenStable();

    expect(note()).toBe('An account with this e-mail already exists.');
  });

  it('clears the error once the value is fixed', async () => {
    const control = fixture.componentInstance.control;
    control.markAsTouched();
    await fixture.whenStable();
    expect(note()).not.toBe('');

    control.setValue('ana@example.test');
    await fixture.whenStable();
    expect(note()).toBe('');
  });

  it('can reveal a password', async () => {
    @Component({ imports: [TextFieldComponent], template: `<app-text-field label="Password" type="password" [control]="control" />` })
    class PasswordHostComponent {
      control = new FormControl('', { nonNullable: true });
    }
    const passwordFixture = TestBed.createComponent(PasswordHostComponent);
    await passwordFixture.whenStable();

    const root = passwordFixture.nativeElement as HTMLElement;
    const input = root.querySelector('input')!;
    expect(input.type).toBe('password');

    root.querySelector<HTMLButtonElement>('.toggle')!.click();
    await passwordFixture.whenStable();
    expect(input.type).toBe('text');
  });
});
