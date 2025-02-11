import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import 'pdfjs-dist/web/pdf_viewer.css';

// Initialize PDF.js worker
if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

interface PDFViewerProps {
  url: string;
  className?: string;
}

interface ProgressData {
  loaded: number;
  total: number;
}

export function PDFViewer({ url, className = "" }: PDFViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;
    let isSubscribed = true;

    async function loadPDF() {
      try {
        setIsLoading(true);
        setError(null);

        // Convert Dropbox URL if necessary
        let pdfUrl = url;
        if (url.includes('dropbox.com')) {
          pdfUrl = url
            .replace('?dl=0', '?dl=1')
            .replace('?raw=1', '?dl=1')
            .replace('www.dropbox.com', 'dl.dropboxusercontent.com');

          if (!pdfUrl.includes('dl=1')) {
            pdfUrl += pdfUrl.includes('?') ? '&dl=1' : '?dl=1';
          }
          console.log('Loading PDF from Dropbox URL:', pdfUrl);
        }

        // Load the PDF document
        const loadingTask = pdfjsLib.getDocument({
          url: pdfUrl,
          withCredentials: false,
        });

        // Add progress callback
        loadingTask.onProgress = function(progress: ProgressData) {
          if (progress.total > 0) {
            const percentage = (progress.loaded / progress.total) * 100;
            console.log(`Loading PDF: ${Math.round(percentage)}%`);
          }
        };

        pdfDoc = await loadingTask.promise;

        if (!isSubscribed) return;

        // Get the first page
        const page = await pdfDoc.getPage(1);

        if (!isSubscribed || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (!context) {
          throw new Error('Could not get canvas context');
        }

        // Calculate scale to fit the container while maintaining aspect ratio
        const viewport = page.getViewport({ scale: 1.0 });
        const containerWidth = canvas.parentElement?.clientWidth || viewport.width;
        const scale = containerWidth / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        // Set canvas dimensions
        canvas.height = scaledViewport.height;
        canvas.width = scaledViewport.width;

        // Render the PDF page
        await page.render({
          canvasContext: context,
          viewport: scaledViewport,
        }).promise;

        setIsLoading(false);
      } catch (err) {
        if (isSubscribed) {
          console.error('Error loading PDF:', err);
          let errorMessage = 'Failed to load PDF. ';

          if (err instanceof Error) {
            if (err.message.includes('CORS')) {
              errorMessage += 'CORS error: The PDF cannot be accessed due to security restrictions.';
            } else if (err.message.includes('Invalid PDF')) {
              errorMessage += 'The file appears to be corrupted or is not a valid PDF.';
            } else if (err.message.includes('Missing PDF')) {
              errorMessage += 'The PDF file could not be found at the specified location.';
            } else {
              errorMessage += err.message;
            }
          }

          setError(errorMessage);
          setIsLoading(false);
        }
      }
    }

    loadPDF();

    return () => {
      isSubscribed = false;
      if (pdfDoc) {
        pdfDoc.destroy();
      }
    };
  }, [url]);

  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-muted">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className={`pdf-viewer relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      )}
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}