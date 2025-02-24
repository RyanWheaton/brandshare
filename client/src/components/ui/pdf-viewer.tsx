import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';
import 'pdfjs-dist/web/pdf_viewer.css';

// Configure PDF.js worker with a reliable CDN
GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Function to validate PDF URL with S3 specific checks
const validatePDFUrl = (url: string): string => {
  try {
    const parsedUrl = new URL(url);
    // Verify it's a valid S3 or application URL
    if (!parsedUrl.protocol.startsWith('http')) {
      throw new Error('Invalid URL protocol');
    }
    return parsedUrl.toString();
  } catch (error) {
    console.error('URL validation error:', error);
    throw new Error('Invalid PDF URL');
  }
};

// Enhanced fetch implementation with S3 support
const fetchPDFData = async (validatedUrl: string) => {
  let attempts = 0;
  const maxAttempts = 3;
  const baseDelay = 1000;

  const handleFetchError = async (error: any, attempt: number) => {
    console.error(`PDF fetch attempt ${attempt}/${maxAttempts} failed:`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      attempt: attempt,
      url: validatedUrl,
      timestamp: new Date().toISOString()
    });

    if (attempt >= maxAttempts) {
      throw new Error(`Failed to fetch PDF after ${maxAttempts} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const jitter = Math.random() * 200;
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1) + jitter, 8000);
    console.log(`Retrying in ${Math.round(delay)}ms...`);
    await new Promise(resolve => setTimeout(resolve, delay));
  };

  while (attempts < maxAttempts) {
    try {
      attempts++;
      console.log(`Attempt ${attempts}/${maxAttempts} - Fetching PDF from: ${validatedUrl}`);

      // Make the request through our backend proxy to handle CORS
      const proxyUrl = `/api/proxy-pdf?url=${encodeURIComponent(validatedUrl)}`;
      const response = await fetch(proxyUrl, {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/pdf, */*',
        },
      });

      if (!response.ok) {
        const errorDetails = {
          status: response.status,
          statusText: response.statusText,
          url: validatedUrl,
          headers: Object.fromEntries(response.headers.entries())
        };
        console.error("PDF fetch failed:", errorDetails);

        if (response.status === 403 || response.status === 401) {
          throw new Error(`Access denied (${response.status}). Please check file permissions.`);
        }
        if (response.status === 404) {
          throw new Error('PDF not found. The file may have been moved or deleted.');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('Empty PDF data received');
      }

      console.log(`Successfully fetched PDF data (${arrayBuffer.byteLength} bytes)`);
      return arrayBuffer;
    } catch (error) {
      await handleFetchError(error, attempts);
    }
  }

  throw new Error('Failed to fetch PDF after maximum retries');
};

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

        console.log(`Attempting to load PDF (attempt ${retryCount + 1}/${maxRetries}):`, url);

        const validatedUrl = validatePDFUrl(url);
        const pdfData = await fetchPDFData(validatedUrl);

        if (!isSubscribed) return;

        loadingTaskRef.current = getDocument({
          data: pdfData,
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.4.120/cmaps/',
          cMapPacked: true,
          enableXfa: true,
          useSystemFonts: true
        });

        loadingTaskRef.current.onProgress = function (progress: ProgressData) {
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
          setError(`Failed to load PDF. Please try again later. Error: ${errorMessage}`);
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