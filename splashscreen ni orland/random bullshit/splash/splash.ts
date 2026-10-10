import { Component, OnInit, output, signal } from '@angular/core';

@Component({
  selector: 'app-splash',
  standalone: true,
  templateUrl: './splash.html',
  styleUrls: ['./splash.css'],
})
export class Splash implements OnInit {
  finished = output<void>();
  leaving = signal(false);

  ngOnInit() {
    console.log('SPLASH ALIVE');
    setTimeout(() => this.leaving.set(true), 2800); // start fade-out
    setTimeout(() => this.finished.emit(), 3300);   // remove from DOM
  }
} 