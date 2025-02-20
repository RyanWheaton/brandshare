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
  const loadingTaskRef = useRef<pdfjsLib.PDFDocumentLoadingTask | null>(null);

  // Enhanced Dropbox URL conversion with more robust handling
  const convertDropboxUrl = (originalUrl: string): string => {
    if (!originalUrl.includes('dropbox.com')) return originalUrl;

    try {
      let convertedUrl = originalUrl;

      // Handle various Dropbox URL formats
      if (originalUrl.includes('www.dropbox.com')) {
        // Convert to dl.dropboxusercontent.com
        convertedUrl = originalUrl
          .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
          .replace('?dl=0', '')
          .replace('?dl=1', '')
          .replace('?raw=1', '');

        // Special handling for /s/ links
        if (convertedUrl.includes('/s/')) {
          convertedUrl = convertedUrl.replace('dl.dropboxusercontent.com/s/', 'dl.dropboxusercontent.com/s/raw/');
        } else {
          // Add raw=1 parameter for direct download
          convertedUrl += (convertedUrl.includes('?') ? '&' : '?') + 'raw=1';
        }
      }

      console.log('Converted Dropbox URL:', convertedUrl);
      return convertedUrl;
    } catch (err) {
      console.error('Error converting Dropbox URL:', err);
      return originalUrl;
    }
  };

  // Function to calculate optimal scale
  const calculateOptimalScale = (viewport: { width: number; height: number }) => {
    if (!containerRef.current) return 1;

    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;

    const scaleX = (containerWidth - 40) / viewport.width;
    const scaleY = (containerHeight - 80) / viewport.height;

    return Math.min(scaleX, scaleY, 2);
  };

  // Enhanced page rendering with error handling
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

      const renderContext = {
        canvasContext: context,
        viewport: scaledViewport,
      };

      try {
        await page.render(renderContext).promise;
      } catch (renderError) {
        console.error('Error rendering page:', renderError);
        throw new Error('Failed to render PDF page');
      }
    } catch (err) {
      console.error('Error in renderPage:', err);
      setError('Error rendering page. Please try refreshing the page.');
    }
  };

  // Enhanced PDF loading with retry mechanism
  useEffect(() => {
    let isSubscribed = true;
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    async function loadPDF() {
      // Cleanup previous loading task if exists
      if (loadingTaskRef.current) {
        loadingTaskRef.current.destroy();
        loadingTaskRef.current = null;
      }

      // Cleanup previous PDF document
      if (pdfDoc) {
        pdfDoc.destroy();
      }

      try {
        setIsLoading(true);
        setError(null);
        setLoadingProgress(0);
        setCurrentPage(1);

        const pdfUrl = convertDropboxUrl(url);
        console.log(`Attempting to load PDF (attempt ${retryCount + 1}/${maxRetries}):`, pdfUrl);

        loadingTaskRef.current = getDocument({
          url: pdfUrl,
          withCredentials: false,
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.4.120/cmaps/',
          cMapPacked: true,
          httpHeaders: {
            'Accept': '*/*',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
        });

        loadingTaskRef.current.onProgress = function(progress: ProgressData) {
          if (progress.total > 0 && isSubscribed) {
            setLoadingProgress(Math.round((progress.loaded / progress.total) * 100));
          }
        };

        const doc = await loadingTaskRef.current.promise;

        if (!isSubscribed) return;

        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setIsLoading(false);
        setRetryCount(0); // Reset retry count on success

        if (canvasRef.current) {
          await renderPage(1);
        }
      } catch (err) {
        console.error('PDF loading error:', err);

        if (!isSubscribed) return;

        const errorMessage = err instanceof Error ? err.message : 'Failed to load PDF';

        if (retryCount < maxRetries - 1 && (
          errorMessage.includes('403') ||
          errorMessage.includes('Failed to fetch') ||
          errorMessage.includes('network') ||
          errorMessage.includes('Unexpected server response')
        )) {
          // Calculate exponential backoff delay
          const delay = Math.min(baseDelay * Math.pow(2, retryCount), 8000);
          console.log(`Retrying in ${delay}ms...`);

          setError(`Loading failed. Retrying in ${Math.round(delay/1000)}s... (Attempt ${retryCount + 1}/${maxRetries})`);

          setTimeout(() => {
            if (isSubscribed) {
              setRetryCount(prev => prev + 1);
            }
          }, delay);
        } else {
          setIsLoading(false);
          if (errorMessage.includes('403')) {
            setError('Unable to access the PDF. The link may have expired or access is restricted.');
          } else {
            setError(`Failed to load PDF: ${errorMessage}`);
          }
        }
      }
    }

    loadPDF();

    return () => {
      isSubscribed = false;
      if (loadingTaskRef.current) {
        loadingTaskRef.current.destroy();
        loadingTaskRef.current = null;
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

  // Debounced window resize handler
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (pdfDoc && !isLoading) {
          renderPage(currentPage);
        }
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
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