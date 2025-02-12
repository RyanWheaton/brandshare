import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';

const router = Router();

// In-memory cache for fonts with 24-hour expiration
let fontsCache: any = null;
let lastFetchTime: number | null = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

const getFonts = async () => {
  const now = Date.now();
  
  // Return cached fonts if available and not expired
  if (fontsCache && lastFetchTime && (now - lastFetchTime) < CACHE_DURATION) {
    return fontsCache;
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/webfonts/v1/webfonts?key=${process.env.GOOGLE_FONTS_API_KEY}&sort=popularity`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch fonts from Google API');
    }

    const data = await response.json();
    
    // Transform the response to include only necessary data
    const fonts = data.items.map((font: any) => ({
      family: font.family,
      variants: font.variants,
      category: font.category,
      previewText: 'The quick brown fox jumps over the lazy dog'
    }));

    // Update cache
    fontsCache = fonts;
    lastFetchTime = now;
    
    return fonts;
  } catch (error) {
    console.error('Error fetching fonts:', error);
    throw new Error('Failed to fetch fonts');
  }
};

// GET /api/fonts - Get all available Google Fonts
router.get('/', async (req, res) => {
  try {
    const fonts = await getFonts();
    res.json(fonts);
  } catch (error) {
    console.error('Error in /api/fonts:', error);
    res.status(500).json({ error: 'Failed to fetch fonts' });
  }
});

// GET /api/fonts/search - Search for fonts
router.get('/search', async (req, res) => {
  const query = (req.query.q as string || '').toLowerCase();
  
  try {
    const fonts = await getFonts();
    const filteredFonts = fonts.filter((font: any) => 
      font.family.toLowerCase().includes(query)
    );
    res.json(filteredFonts);
  } catch (error) {
    console.error('Error in /api/fonts/search:', error);
    res.status(500).json({ error: 'Failed to search fonts' });
  }
});

export default router;
