import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  template: `
    <div class="flex flex-col items-center justify-center gap-4">
      <div
        class="h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-500 border-t-transparent"
      ></div>
      <p class="text-blue-300">Generating response...</p>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingSpinnerComponent {}
