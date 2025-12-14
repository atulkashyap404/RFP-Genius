import {
  Component,
  ChangeDetectionStrategy,
  input,
  signal,
  viewChild,
  ElementRef,
  effect,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';

@Component({
  selector: 'app-pdf-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="w-full h-full flex flex-col bg-gray-900/50 rounded-lg overflow-hidden border border-gray-700">
      @if (isLoading()) {
        <div class="flex-grow flex items-center justify-center">
          <p class="text-gray-400">Loading PDF...</p>
        </div>
      } @else if (error()) {
        <div class="flex-grow flex items-center justify-center p-4">
          <p class="text-red-400 text-center">{{ error() }}</p>
        </div>
      } @else {
        <div class="flex-grow relative overflow-auto p-2">
          <canvas #pdfCanvas class="mx-auto"></canvas>
        </div>
        <div class="flex-shrink-0 bg-gray-800/70 p-2 flex items-center justify-center gap-2 sm:gap-4 border-t border-gray-700">
          <!-- Pagination -->
          <button (click)="prevPage()" [disabled]="currentPage() <= 1" class="px-3 py-1 rounded-md bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors" title="Go to previous page">
            Prev
          </button>
          <span class="text-sm font-medium text-center w-24">
            Page {{ currentPage() }} of {{ totalPages() }}
          </span>
          <button (click)="nextPage()" [disabled]="currentPage() >= totalPages()" class="px-3 py-1 rounded-md bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors" title="Go to next page">
            Next
          </button>
          
          <div class="w-px h-6 bg-gray-600 mx-1 sm:mx-2"></div>

          <!-- Zoom -->
          <button (click)="zoomOut()" [disabled]="scale() <= minScale" title="Zoom Out" class="p-1 rounded-full bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clip-rule="evenodd" />
            </svg>
          </button>
          <span class="text-sm font-medium w-16 text-center tabular-nums">
            {{ scale() * 100 | number:'1.0-0' }}%
          </span>
          <button (click)="zoomIn()" [disabled]="scale() >= maxScale" title="Zoom In" class="p-1 rounded-full bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfViewerComponent implements OnDestroy {
  file = input.required<File>();
  canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('pdfCanvas');

  isLoading = signal(true);
  error = signal<string | null>(null);
  currentPage = signal(1);
  totalPages = signal(0);
  scale = signal(1.5);

  private pdfDoc: PDFDocumentProxy | null = null;
  private renderTask: pdfjsLib.RenderTask | null = null;
  
  readonly minScale = 0.5;
  readonly maxScale = 3.0;

  constructor() {
    effect(() => {
      // When the file input changes, load the new PDF
      this.loadPdf(this.file());
    });
  }

  ngOnDestroy(): void {
    this.pdfDoc?.destroy();
  }

  private async loadPdf(file: File): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    this.currentPage.set(1);
    this.totalPages.set(0);
    this.scale.set(1.5); // Reset scale on new file

    // Clean up previous document
    if (this.pdfDoc) {
      await this.pdfDoc.destroy();
      this.pdfDoc = null;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      this.pdfDoc = await pdfjsLib.getDocument(arrayBuffer).promise;
      this.totalPages.set(this.pdfDoc.numPages);
      this.renderPage(this.currentPage());
    } catch (e) {
      console.error('Error loading PDF:', e);
      this.error.set('Failed to load or parse the PDF file.');
    } finally {
      this.isLoading.set(false);
    }
  }

  private async renderPage(pageNum: number): Promise<void> {
    if (!this.pdfDoc || pageNum < 1 || pageNum > this.totalPages()) {
      return;
    }
    
    // If a render is already in progress, cancel it
    if (this.renderTask) {
        this.renderTask.cancel();
    }

    const page = await this.pdfDoc.getPage(pageNum);
    const canvasEl = this.canvas().nativeElement;
    const canvasContext = canvasEl.getContext('2d');
    
    if (!canvasContext) return;

    const scale = this.scale();
    const viewport = page.getViewport({ scale });
    canvasEl.height = viewport.height;
    canvasEl.width = viewport.width;

    const renderContext = {
      canvasContext,
      viewport,
    };
    
    this.renderTask = page.render(renderContext);
    await this.renderTask.promise;
    this.renderTask = null;
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
      this.renderPage(this.currentPage());
    }
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
      this.renderPage(this.currentPage());
    }
  }

  zoomIn(): void {
    if (this.scale() < this.maxScale) {
      this.scale.update(s => Math.min(this.maxScale, s + 0.25));
      this.renderPage(this.currentPage());
    }
  }

  zoomOut(): void {
    if (this.scale() > this.minScale) {
      this.scale.update(s => Math.max(this.minScale, s - 0.25));
      this.renderPage(this.currentPage());
    }
  }
}
