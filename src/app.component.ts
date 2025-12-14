import { Component, ChangeDetectionStrategy, signal, computed, inject, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService, ProposalResult, OutputFormat } from './services/gemini.service';
import { LoadingSpinnerComponent } from './components/loading-spinner/loading-spinner.component';
import { ProcessingSpinnerComponent } from './components/processing-spinner/processing-spinner.component';
import { PdfViewerComponent } from './components/pdf-viewer/pdf-viewer.component';
import * as pdfjsLib from 'pdfjs-dist';
import { type TextItem } from 'pdfjs-dist/types/src/display/api';

interface ChatHistoryItem {
  question: string;
  result: ProposalResult;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, LoadingSpinnerComponent, ProcessingSpinnerComponent, PdfViewerComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private geminiService = inject(GeminiService);

  // FIX: Removed API Key signal as it should be handled by environment variables.
  knowledgeBase: WritableSignal<string> = signal('');
  question: WritableSignal<string> = signal('');
  generating: WritableSignal<boolean> = signal(false);
  error: WritableSignal<string | null> = signal(null);
  
  chatHistory: WritableSignal<ChatHistoryItem[]> = signal([]);
  latestResult = computed(() => this.chatHistory()[0] ?? null);
  history = computed(() => this.chatHistory().slice(1));
  
  showFollowUps: WritableSignal<boolean> = signal(true);
  showHistory: WritableSignal<boolean> = signal(false);
  showAbout: WritableSignal<boolean> = signal(false);

  outputFormat: WritableSignal<OutputFormat> = signal('json');
  
  // PDF Viewer state
  pdfToView: WritableSignal<File | null> = signal(null);

  // File processing state
  selectedFiles: WritableSignal<FileList | null> = signal(null);
  processedFileNames: WritableSignal<string[]> = signal([]);
  processingFiles: WritableSignal<boolean> = signal(false);
  currentlyProcessingFile: WritableSignal<string | null> = signal(null);
  processingSuccess: WritableSignal<string | null> = signal(null);
  fileError: WritableSignal<string | null> = signal(null);
  isDraggingOver: WritableSignal<boolean> = signal(false);
  
  // Helper for template
  arrayFrom = Array.from;

  constructor() {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();
  }

  // FIX: Removed API Key check from form validation logic.
  isFormInvalid = computed(() => 
    this.knowledgeBase().trim().length === 0 || 
    this.question().trim().length < 10 || 
    this.generating()
  );

  async generate(): Promise<void> {
    if (this.isFormInvalid()) {
      return;
    }

    this.pdfToView.set(null); // Hide viewer
    this.generating.set(true);
    this.error.set(null);

    try {
      // FIX: Removed API Key from service call.
      const response = await this.geminiService.generateProposal(
        this.knowledgeBase(),
        this.question(),
        this.outputFormat()
      );
      
      const newHistoryItem: ChatHistoryItem = { question: this.question(), result: response };
      this.chatHistory.update(history => [newHistoryItem, ...history]);

      this.showFollowUps.set(true);
    } catch (e: any) {
      this.error.set(e.message || 'An unknown error occurred.');
    } finally {
      this.generating.set(false);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingOver.set(false);
    const files = event.dataTransfer?.files;
    if (files) {
      this.handleFiles(files);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.handleFiles(input.files);
  }

  private handleFiles(files: FileList | null): void {
    if (!files || files.length === 0) {
      return;
    }

    const nonPdfFiles = Array.from(files).filter(file => !file.name.toLowerCase().endsWith('.pdf'));

    if (nonPdfFiles.length > 0) {
      this.fileError.set(`Please upload only PDF files. The following files were ignored: ${nonPdfFiles.map(f => f.name).join(', ')}`);
      this.selectedFiles.set(null);
      return;
    }
    
    this.pdfToView.set(null);
    this.selectedFiles.set(files);
    this.processingSuccess.set(null);
    this.knowledgeBase.set('');
    this.processedFileNames.set([]);
    this.chatHistory.set([]);
    this.showHistory.set(false);
    this.error.set(null);
    this.fileError.set(null);
  }


  async processFiles(): Promise<void> {
    const files = this.selectedFiles();
    if (!files || files.length === 0) return;

    this.pdfToView.set(null);
    this.processingFiles.set(true);
    this.error.set(null);
    this.chatHistory.set([]);
    this.fileError.set(null);
    this.processingSuccess.set(null);
    this.knowledgeBase.set('');
    
    let combinedText = '';
    const fileNames: string[] = [];

    try {
        for (const file of Array.from(files)) {
            this.currentlyProcessingFile.set(file.name);
            fileNames.push(file.name);
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => (item as TextItem).str).join(' ');
                combinedText += pageText + '\n\n';
            }
        }

        this.knowledgeBase.set(combinedText);
        this.processedFileNames.set(fileNames);
        this.processingSuccess.set(`Successfully processed ${files.length} document(s).`);
        this.selectedFiles.set(null);
    } catch (e) {
        console.error('Error processing PDF files:', e);
        this.error.set('Failed to read or parse one or more PDF files. Please ensure they are valid and not corrupted.');
        this.selectedFiles.set(null);
    } finally {
        this.processingFiles.set(false);
        this.currentlyProcessingFile.set(null);
    }
  }

  clearFiles(): void {
    this.selectedFiles.set(null);
    this.processedFileNames.set([]);
    this.processingSuccess.set(null);
    this.knowledgeBase.set('');
    this.fileError.set(null);
    this.chatHistory.set([]);
    this.showHistory.set(false);
    this.pdfToView.set(null);
    this.currentlyProcessingFile.set(null);

    // Reset the file input element so the user can re-select the same file(s)
    const fileInput = document.getElementById('pdf-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }
  
  viewPdf(file: File): void {
    this.chatHistory.set([]);
    this.error.set(null);
    this.generating.set(false);
    this.processingFiles.set(false);
    this.pdfToView.set(file);
  }

  // FIX: Removed onApiKeyInput method.
  
  onQuestionInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.question.set(target.value);
  }

  onFormatChange(format: OutputFormat): void {
    this.outputFormat.set(format);
  }
  
  toggleFollowUps(): void {
    this.showFollowUps.update(value => !value);
  }

  toggleHistory(): void {
    this.showHistory.update(value => !value);
  }

  toggleAbout(): void {
    this.showAbout.update(value => !value);
  }

  downloadResult(): void {
    const latest = this.latestResult();
    if (!latest) return;
    const { question, result } = latest;

    let content = `RFP Question:\n${question}\n\n---\n\nGenerated Answer:\n${result.answer}`;
    if (result.followUpQuestions.length > 0) {
      content += `\n\n---\n\nSuggested Follow-up Questions:\n- ${result.followUpQuestions.join('\n- ')}`;
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'proposal_draft.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  downloadHistory(): void {
    const history = this.chatHistory();
    if (history.length === 0) return;

    // Reverse the history to get chronological order (oldest first)
    const chronologicalHistory = [...history].reverse();

    let content = `RFP-Genius Conversation History\n\n`;
    content += `Generated on: ${new Date().toLocaleString()}\n`;
    content += `--- --- ---\n\n`;

    chronologicalHistory.forEach((item, index) => {
      content += `Conversation Turn ${index + 1}\n`;
      content += `-------------------------\n\n`;
      content += `RFP Question:\n${item.question}\n\n`;
      content += `Generated Answer:\n${item.result.answer}\n\n`;
      
      if (item.result.followUpQuestions && item.result.followUpQuestions.length > 0) {
        content += `Suggested Follow-up Questions:\n- ${item.result.followUpQuestions.join('\n- ')}\n\n`;
      }
      
      if (index < chronologicalHistory.length - 1) {
          content += `--- --- ---\n\n`;
      }
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'conversation_history.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
