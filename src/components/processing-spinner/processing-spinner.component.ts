import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'app-processing-spinner',
  standalone: true,
  template: `
    <div class="flex flex-col items-center justify-center gap-4 text-center">
      <div
        class="h-12 w-12 animate-spin rounded-full border-4 border-solid border-green-500 border-t-transparent"
      ></div>
      <p class="text-green-300 font-semibold">Processing Documents</p>
      @if (fileName(); as name) {
        <p class="text-sm text-gray-400 mt-1">
          Extracting text from: <br> <span class="font-medium text-gray-300">{{ name }}</span>
        </p>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessingSpinnerComponent {
  fileName = input<string | null>(null);
}
