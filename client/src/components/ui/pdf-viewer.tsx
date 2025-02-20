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

// Function to validate and sanitize PDF URL
const validatePDFUrl = (url: string): string => {
  try {
    const sanitizedUrl = new URL(url);
    return sanitizedUrl.toString();
  } catch (error) {
    throw new Error('Invalid URL format');
  }
};

// Function to fetch PDF data with enhanced error handling
const fetchPDFData = async (pdfUrl: string): Promise<ArrayBuffer> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    const validatedUrl = validatePDFUrl(pdfUrl);
    console.log('Fetching PDF from validated URL:', validatedUrl);

    const response = await fetch(validatedUrl, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      signal: controller.signal,
      headers: {
        'Accept': 'application/pdf,*/*',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      throw new Error('Received empty PDF data');
    }

    return arrayBuffer;
  } catch (error: unknown) {
    clearTimeout(timeout);
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      console.error('PDF fetch error:', error);
      throw error;
    }
    throw new Error('An unknown error occurred while fetching the PDF');
  }
};

// Enhanced Dropbox URL conversion
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
      }

      // Add dl=1 parameter for direct download
      convertedUrl += '?dl=1';
    }

    console.log('Converted Dropbox URL:', convertedUrl);
    return convertedUrl;
  } catch (err) {
    console.error('Error converting Dropbox URL:', err);
    return originalUrl;
  }
};

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

  // Calculate optimal scale
  const calculateOptimalScale = (viewport: { width: number; height: number }) => {
    if (!containerRef.current) return 1;

    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;

    const scaleX = (containerWidth - 40) / viewport.width;
    const scaleY = (containerHeight - 80) / viewport.height;

    return Math.min(scaleX, scaleY, 2);
  };

  // Enhanced page rendering
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

  // Load PDF with enhanced error handling and retry logic
  useEffect(() => {
    let isSubscribed = true;
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    async function loadPDF() {
      if (loadingTaskRef.current) {
        loadingTaskRef.current.destroy();
        loadingTaskRef.current = null;
      }

      if (pdfDoc) {
        pdfDoc.destroy();
      }

      try {
        setIsLoading(true);
        setError(null);
        setLoadingProgress(0);

        const pdfUrl = convertDropboxUrl(url);
        console.log(`Attempting to load PDF (attempt ${retryCount + 1}/${maxRetries}):`, pdfUrl);

        const pdfData = await fetchPDFData(pdfUrl);

        if (!isSubscribed) return;

        loadingTaskRef.current = getDocument({
          data: pdfData,
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.4.120/cmaps/',
          cMapPacked: true,
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

        if (retryCount < maxRetries - 1) {
          const delay = Math.min(baseDelay * Math.pow(2, retryCount), 8000);
          console.log(`Retrying in ${delay}ms...`);

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

  // Handle page changes
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