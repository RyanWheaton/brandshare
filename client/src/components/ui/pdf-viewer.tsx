import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import 'pdfjs-dist/web/pdf_viewer.css';

// Set worker source path
GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

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
  const [loadingProgress, setLoadingProgress] = useState(0);

  useEffect(() => {
    let pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;
    let isSubscribed = true;

    async function loadPDF() {
      try {
        setIsLoading(true);
        setError(null);
        setLoadingProgress(0);

        // Convert Dropbox URL if necessary
        let pdfUrl = url;
        if (url.includes('dropbox.com')) {
          console.log('Original Dropbox URL:', url);
          pdfUrl = url
            .replace('dl=0', 'dl=1')
            .replace('raw=1', 'dl=1')
            .replace('www.dropbox.com', 'dl.dropboxusercontent.com');

          if (!pdfUrl.includes('dl=1')) {
            pdfUrl += pdfUrl.includes('?') ? '&dl=1' : '?dl=1';
          }
          console.log('Converted Dropbox URL:', pdfUrl);
        }

        console.log('Loading PDF from URL:', pdfUrl);
        const loadingTask = getDocument({
          url: pdfUrl,
          withCredentials: false,
        });

        loadingTask.onProgress = function(progress: ProgressData) {
          if (progress.total > 0) {
            const percentage = (progress.loaded / progress.total) * 100;
            if (isSubscribed) {
              setLoadingProgress(Math.round(percentage));
              console.log('Loading progress:', Math.round(percentage) + '%');
            }
          }
        };

        pdfDoc = await loadingTask.promise;
        console.log('PDF loaded successfully');

        if (!isSubscribed || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (!context) {
          throw new Error('Could not get canvas context');
        }

        console.log('Getting first page');
        const page = await pdfDoc.getPage(1);
        console.log('First page loaded');

        const viewport = page.getViewport({ scale: 1.0 });
        const containerWidth = canvas.parentElement?.clientWidth || viewport.width;
        const scale = containerWidth / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        canvas.height = scaledViewport.height;
        canvas.width = scaledViewport.width;

        console.log('Rendering page');
        await page.render({
          canvasContext: context,
          viewport: scaledViewport,
        }).promise;
        console.log('Page rendered successfully');

        setIsLoading(false);
      } catch (err) {
        console.error('PDF loading error:', err);
        if (isSubscribed) {
          let errorMessage = 'Could not load PDF: ';

          if (err instanceof Error) {
            console.error('Error details:', {
              message: err.message,
              stack: err.stack
            });
            errorMessage += err.message;
          } else {
            errorMessage += 'An unknown error occurred';
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

  return (
    <div className={`pdf-viewer relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/50">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mb-2" />
          {loadingProgress > 0 && (
            <p className="text-sm text-muted-foreground">Loading... {loadingProgress}%</p>
          )}
        </div>
      )}
      {error && (
        <div className="flex items-center justify-center w-full h-full bg-muted p-4">
          <p className="text-sm text-red-500 text-center">{error}</p>
        </div>
      )}
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}