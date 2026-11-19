import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const VALID_CATEGORIES = new Set([
  'Mammal',
  'Bird',
  'Reptile',
  'Amphibian',
  'Fish',
  'Invertebrate',
  'Unknown',
]);

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY_MISSING');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const status = (err as { status?: number })?.status;
      const isRetryable = status === 503 || status === 500 || status === 429;
      if (!isRetryable || attempt === maxRetries) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 600 * Math.pow(2, attempt)));
    }
  }
  throw lastError;
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '15mb' }));

  const mediapipeWasmDir = path.resolve(__dirname, 'node_modules/@mediapipe/tasks-vision/wasm');
  if (fs.existsSync(mediapipeWasmDir)) {
    app.use('/mediapipe/wasm', express.static(mediapipeWasmDir));
  }

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'signify-ai' });
  });

  app.post('/api/analyze-animal', async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body ?? {};

      if (typeof imageBase64 !== 'string' || !imageBase64.trim()) {
        res.status(400).json({ error: 'Please provide a valid base64-encoded image.' });
        return;
      }

      const normalizedMime = typeof mimeType === 'string' ? mimeType.toLowerCase().trim() : '';
      if (!ALLOWED_MIME_TYPES.has(normalizedMime)) {
        res.status(400).json({
          error: 'Unsupported file format. Please upload a JPG, JPEG, PNG, or WEBP image.',
        });
        return;
      }

      // Strip data URL prefix if present
      const cleanBase64 = imageBase64.includes(',')
        ? imageBase64.slice(imageBase64.indexOf(',') + 1)
        : imageBase64;

      const ai = getGeminiClient();

      const prompt = [
        'You are an expert wildlife zoologist and computer vision analyst.',
        'Examine the provided photograph carefully.',
        'If an animal is clearly visible, set animalDetected to true and provide accurate zoological details.',
        'If NO real animal is visible (for example: landscapes without animals, vehicles, objects, text, food, or people only), set animalDetected to false, commonName to "No Animal Detected", scientificName to "", category to "Unknown", confidence to 0, and explain clearly what was seen in uncertaintyNote.',
        'Classify category strictly as one of: Mammal, Bird, Reptile, Amphibian, Fish, Invertebrate, or Unknown.',
        'Set confidence as an integer from 0 to 100 reflecting visual certainty (lower if blurry, occluded, partial, or ambiguous, and explain any uncertainty in uncertaintyNote).',
        'Provide concise, accurate entries for habitat, diet, lifespan, conservationStatus, summary (2 sentences), and 3 to 4 genuinely interesting zoological facts.',
      ].join(' ');

      const response = await generateWithRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: normalizedMime === 'image/jpg' ? 'image/jpeg' : normalizedMime,
                  data: cleanBase64,
                },
              },
              { text: prompt },
            ],
          },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                animalDetected: {
                  type: Type.BOOLEAN,
                  description: 'True if at least one non-human animal is visible in the photograph.',
                },
                commonName: {
                  type: Type.STRING,
                  description: 'Common English name of the identified animal, or "No Animal Detected".',
                },
                scientificName: {
                  type: Type.STRING,
                  description: 'Binomial Latin scientific name (e.g. Panthera uncia). Empty string if none detected.',
                },
                category: {
                  type: Type.STRING,
                  description: 'Strictly one of: Mammal, Bird, Reptile, Amphibian, Fish, Invertebrate, Unknown.',
                },
                confidence: {
                  type: Type.NUMBER,
                  description: 'Confidence score between 0 and 100.',
                },
                uncertaintyNote: {
                  type: Type.STRING,
                  description: 'Note explaining visual certainty, lighting/occlusion caveats, or why no animal was detected.',
                },
                habitat: {
                  type: Type.STRING,
                  description: 'Primary natural geographic range and ecosystem.',
                },
                diet: {
                  type: Type.STRING,
                  description: 'Typical diet and feeding classification.',
                },
                lifespan: {
                  type: Type.STRING,
                  description: 'Typical lifespan in the wild (and captivity if relevant).',
                },
                conservationStatus: {
                  type: Type.STRING,
                  description: 'IUCN Red List conservation status (e.g. Least Concern, Vulnerable, Endangered).',
                },
                summary: {
                  type: Type.STRING,
                  description: 'Concise 2-sentence overview of the species.',
                },
                interestingFacts: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '3 to 4 distinct, verifiable biological or behavioral facts.',
                },
              },
              required: [
                'animalDetected',
                'commonName',
                'scientificName',
                'category',
                'confidence',
                'uncertaintyNote',
                'habitat',
                'diet',
                'lifespan',
                'conservationStatus',
                'summary',
                'interestingFacts',
              ],
            },
          },
        }),
      );

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({ error: 'The AI model returned an empty response. Please try again.' });
        return;
      }

      const parsed = JSON.parse(rawText);
      const safeCategory = VALID_CATEGORIES.has(parsed.category) ? parsed.category : 'Unknown';
      const clampedConfidence = Math.max(0, Math.min(100, Math.round(Number(parsed.confidence) || 0)));

      res.json({
        animalDetected: Boolean(parsed.animalDetected),
        commonName: String(parsed.commonName || 'Unknown'),
        scientificName: String(parsed.scientificName || ''),
        category: safeCategory,
        confidence: clampedConfidence,
        uncertaintyNote: String(parsed.uncertaintyNote || ''),
        habitat: String(parsed.habitat || ''),
        diet: String(parsed.diet || ''),
        lifespan: String(parsed.lifespan || ''),
        conservationStatus: String(parsed.conservationStatus || ''),
        summary: String(parsed.summary || ''),
        interestingFacts: Array.isArray(parsed.interestingFacts)
          ? parsed.interestingFacts.map((f: unknown) => String(f)).slice(0, 5)
          : [],
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const status = (err as { status?: number })?.status;

      if (message === 'GEMINI_API_KEY_MISSING') {
        res.status(503).json({
          error: 'Gemini API key is not configured on the server. Please add GEMINI_API_KEY in Settings > Secrets.',
        });
        return;
      }
      if (status === 401 || status === 403) {
        res.status(403).json({
          error: 'Gemini API authentication failed. Please verify your API key in Settings > Secrets.',
        });
        return;
      }
      if (status === 429) {
        res.status(429).json({
          error: 'Gemini API rate limit reached. Please wait a moment and try analyzing the image again.',
        });
        return;
      }

      console.error('Animal analysis error:', err);
      res.status(500).json({
        error: 'Unable to analyze this photograph right now. Please try another image or retry shortly.',
      });
    }
  });

  const distDir = path.resolve(__dirname, 'dist');
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(distDir);

  if (isProd) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`SIGNIFY AI server listening on http://localhost:${port}`);
  });
}

startServer();
