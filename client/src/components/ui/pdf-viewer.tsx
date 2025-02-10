import { useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import 'pdfjs-dist/web/pdf_viewer.css';

// Set worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface PDFViewerProps {
  url: string;
  className?: string;
}

export function PDFViewer({ url, className = "" }: PDFViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let pdf: pdfjsLib.PDFDocumentProxy | null = null;
    let cancelPrevRender = false;

    const loadingTask = pdfjsLib.getDocument(url);

    loadingTask.promise.then(
      (pdfDoc) => {
        pdf = pdfDoc;
        return pdf.getPage(1); // Get the first page
      }
    ).then((page) => {
      if (cancelPrevRender) return;
      
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const viewport = page.getViewport({ scale: 1.5 });
      
      // Set canvas dimensions
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Prepare canvas for rendering
      const context = canvas.getContext('2d');
      if (!context) return;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      page.render(renderContext);
    }).catch((error) => {
      console.error('Error loading PDF:', error);
    });

    return () => {
      cancelPrevRender = true;
      if (pdf) {
        pdf.destroy();
      }
    };
  }, [url]);

  return (
    <div ref={containerRef} className={`pdf-viewer ${className}`}>
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}
