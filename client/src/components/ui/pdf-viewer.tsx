import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';
import 'pdfjs-dist/web/pdf_viewer.css';

// Configure PDF.js worker with a reliable CDN
GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [scale, setScale] = useState(1);
  const [retryCount, setRetryCount] = useState(0);

  // Function to calculate optimal scale
  const calculateOptimalScale = (viewport: { width: number; height: number }) => {
    if (!containerRef.current) return 1;

    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;

    const scaleX = (containerWidth - 40) / viewport.width;
    const scaleY = (containerHeight - 80) / viewport.height;

    return Math.min(scaleX, scaleY, 2);
  };

  // Enhanced Dropbox URL conversion
  const convertDropboxUrl = (originalUrl: string): string => {
    if (!originalUrl.includes('dropbox.com')) return originalUrl;

    try {
      // First, try to use the raw=1 parameter approach
      let convertedUrl = originalUrl
        .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
        .replace('?dl=0', '')
        .replace('?dl=1', '')
        .replace('?raw=1', '');

      // Add raw=1 parameter
      convertedUrl += (convertedUrl.includes('?') ? '&' : '?') + 'raw=1';

      // If URL contains /s/, adjust it
      if (convertedUrl.includes('/s/')) {
        convertedUrl = convertedUrl
          .replace('dl.dropboxusercontent.com/s/', 'dl.dropboxusercontent.com/s/raw/');
      }

      console.log('Converted Dropbox URL:', convertedUrl);
      return convertedUrl;
    } catch (err) {
      console.error('Error converting Dropbox URL:', err);
      return originalUrl;
    }
  };

  // Function to render a specific page
  const renderPage = async (pageNumber: number) => {
    if (!pdfDoc || !canvasRef.current || !containerRef.current) return;

    try {
      const page = await pdfDoc.getPage(pageNumber);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Could not get canvas context');
      }

      const viewport = page.getViewport({ scale: 1.0 });
      const optimalScale = calculateOptimalScale(viewport);
      setScale(optimalScale);

      const scaledViewport = page.getViewport({ scale: optimalScale });

      canvas.height = scaledViewport.height;
      canvas.width = scaledViewport.width;

      await page.render({
        canvasContext: context,
        viewport: scaledViewport,
      }).promise;
    } catch (err) {
      console.error('Error rendering page:', err);
      setError('Error rendering page. Please try again.');
    }
  };

  // Effect for loading the PDF
  useEffect(() => {
    let isSubscribed = true;
    let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;

    async function loadPDF() {
      if (pdfDoc) {
        pdfDoc.destroy();
      }

      try {
        setIsLoading(true);
        setError(null);
        setLoadingProgress(0);
        setCurrentPage(1);

        const pdfUrl = convertDropboxUrl(url);
        console.log('Loading PDF from URL:', pdfUrl);

        loadingTask = getDocument({
          url: pdfUrl,
          withCredentials: false,
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.4.120/cmaps/',
          cMapPacked: true,
          httpHeaders: {
            'Accept': '*/*',
            'Cache-Control': 'no-cache',
          },
        });

        loadingTask.onProgress = function(progress: ProgressData) {
          if (progress.total > 0) {
            const percentage = (progress.loaded / progress.total) * 100;
            if (isSubscribed) {
              setLoadingProgress(Math.round(percentage));
            }
          }
        };

        const doc = await loadingTask.promise;

        if (!isSubscribed) return;

        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setIsLoading(false);
        setRetryCount(0);

        if (canvasRef.current) {
          await renderPage(1);
        }
      } catch (err) {
        console.error('PDF loading error:', err);
        if (isSubscribed) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load PDF';
          setError(errorMessage);
          setIsLoading(false);

          // Enhanced retry logic with clearer error messages
          if (retryCount < 3 && (
            errorMessage.includes('Failed to fetch') ||
            errorMessage.includes('network') ||
            errorMessage.includes('403') ||
            errorMessage.includes('Unexpected server response')
          )) {
            const delay = Math.min(1000 * Math.pow(2, retryCount), 8000);
            setTimeout(() => {
              if (isSubscribed) {
                setRetryCount(prev => prev + 1);
                loadPDF();
              }
            }, delay);
          } else if (errorMessage.includes('403')) {
            setError('Unable to access the PDF. This might be due to restricted access or an expired link.');
          }
        }
      }
    }

    loadPDF();

    return () => {
      isSubscribed = false;
      if (loadingTask) {
        loadingTask.destroy();
      }
      if (pdfDoc) {
        pdfDoc.destroy();
      }
    };
  }, [url, retryCount]);

  // Effect for handling page changes
  useEffect(() => {
    if (pdfDoc && !isLoading) {
      renderPage(currentPage);
    }
  }, [currentPage, pdfDoc]);

  // Effect for handling window resize
  useEffect(() => {
    const handleResize = () => {
      if (pdfDoc && !isLoading) {
        renderPage(currentPage);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [pdfDoc, isLoading, currentPage]);

  return (
    <div 
      ref={containerRef}
      className={`pdf-viewer relative flex flex-col items-center justify-center h-full ${className}`}
    >
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
          <p className="text-sm text-red-500 text-center">
            {error}
            {retryCount > 0 && retryCount < 3 && ` (Retry ${retryCount}/3)`}
          </p>
        </div>
      )}
      <div className="flex-1 overflow-auto w-full flex items-center justify-center">
        <canvas ref={canvasRef} className="max-w-full" />
      </div>

      {!isLoading && !error && numPages > 1 && (
        <div className="flex items-center justify-center gap-4 p-4 bg-background/80 backdrop-blur-sm w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">
            Page {currentPage} of {numPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(numPages, prev + 1))}
            disabled={currentPage >= numPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}