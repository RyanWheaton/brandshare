import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Add initialization logging
console.log('Initializing React application...');

const rootElement = document.getElementById("root");

// Verify root element exists
if (!rootElement) {
  console.error('Root element not found! Check if the HTML contains a div with id="root"');
  throw new Error('Root element not found');
}

// Create root with error handling
try {
  console.log('Creating React root...');
  const root = createRoot(rootElement);

  console.log('Starting React render...');
  root.render(<App />);
  console.log('React render completed');
} catch (error) {
  console.error('Failed to initialize React application:', error);
  // Display error to user
  rootElement.innerHTML = `
    <div style="color: red; padding: 20px;">
      <h1>Application Error</h1>
      <pre>${error instanceof Error ? error.message : 'Unknown error occurred'}</pre>
    </div>
  `;
}