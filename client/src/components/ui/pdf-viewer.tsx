import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import 'pdfjs-dist/web/pdf_viewer.css';

// Set worker path to use CDN version matching the installed version
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface PDFViewerProps {
  url: string;
  className?: string;
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

        // Load the PDF document
        pdfDoc = await pdfjsLib.getDocument(url).promise;

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
          setError('Failed to load PDF. Please try again later.');
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