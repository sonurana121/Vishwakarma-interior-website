import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { GoogleGenAI, Modality, type LiveServerMessage } from '@google/genai';
import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { WebSocketServer } from 'ws';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };
import { DEFAULT_PROJECTS } from './src/data/seedCatalog.ts';

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const ADMIN_OWNER_EMAIL = 'sonurana9lenovo@gmail.com';
const FIREBASE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let cachedCerts: Record<string, string> | null = null;
let cachedCertsExpiresAt = 0;

async function getFirebasePublicCerts(): Promise<Record<string, string>> {
  if (cachedCerts && Date.now() < cachedCertsExpiresAt) {
    return cachedCerts;
  }
  const resp = await fetch(FIREBASE_CERTS_URL);
  if (!resp.ok) {
    throw new Error('Failed to retrieve Firebase token signing certificates.');
  }
  const cacheControl = resp.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const ttlMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 3600 * 1000;
  cachedCerts = (await resp.json()) as Record<string, string>;
  cachedCertsExpiresAt = Date.now() + ttlMs;
  return cachedCerts;
}

interface VerifiedFirebaseUser {
  uid: string;
  email: string;
  email_verified: boolean;
}

async function verifyFirebaseIdToken(token: string): Promise<VerifiedFirebaseUser> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed Firebase ID token.');
  }
  const [headerB64, payloadB64, signatureB64] = parts;
  const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8')) as {
    alg?: string;
    kid?: string;
  };
  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Invalid token header.');
  }

  const certs = await getFirebasePublicCerts();
  const certPem = certs[header.kid];
  if (!certPem) {
    throw new Error('Unknown signing key.');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();
  const signatureValid = verifier.verify(certPem, Buffer.from(signatureB64, 'base64url'));
  if (!signatureValid) {
    throw new Error('Invalid token signature.');
  }

  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
    aud?: string;
    iss?: string;
    sub?: string;
    exp?: number;
    iat?: number;
    email?: string;
    email_verified?: boolean;
  };

  const nowSec = Math.floor(Date.now() / 1000);
  const expectedIssuer = `https://securetoken.google.com/${firebaseConfig.projectId}`;
  if (payload.aud !== firebaseConfig.projectId || payload.iss !== expectedIssuer) {
    throw new Error('Token project or issuer mismatch.');
  }
  if (!payload.sub || typeof payload.exp !== 'number' || payload.exp <= nowSec) {
    throw new Error('Token expired or missing subject.');
  }
  if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) {
    throw new Error('Token issued in the future.');
  }

  return {
    uid: payload.sub,
    email: String(payload.email || '').toLowerCase(),
    email_verified: Boolean(payload.email_verified),
  };
}

async function requireAdminFirebaseAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please sign in with Google.' });
    return;
  }
  const token = authHeader.slice(7).trim();
  try {
    const user = await verifyFirebaseIdToken(token);
    if (!user.email_verified || user.email !== ADMIN_OWNER_EMAIL) {
      res.status(403).json({ error: 'Only the verified business owner account may upload files.' });
      return;
    }
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = MIME_TO_EXT[file.mimetype.toLowerCase()] || '.jpg';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (MIME_TO_EXT[file.mimetype.toLowerCase()]) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, and WebP images are supported.'));
    }
  },
});

const VOICE_SYSTEM_INSTRUCTION = `You are the friendly, knowledgeable interior design and carpentry voice consultant for Vishwakarma Interior Services Centre in Cuttack, Odisha, India.
Business Owner: Bipin Kumar (over 25 years of experience and 10,000+ completed residential and commercial sites).
Workshop & Studio: Link Road, Madhupatna, Cuttack, Odisha 753010 (Mon–Sat, 9:30 AM – 9:00 PM).
Direct Phone & WhatsApp: +91 8270123438.
Emails: bipinkumarrana1122@gmail.com and vishwakarmaservice28@gmail.com.
Core Services:
1. Home Interior Design (6–10 weeks turnkey)
2. Modular Kitchen (3–4 weeks, HDHMR / BWR 710 Marine Ply, quartz countertops, Hettich/Ebco soft-close)
3. Bedroom Interior (3–5 weeks, hydraulic storage beds, fluted headboards, cove lighting)
4. Living Room Interior (3–4 weeks, fluted Burma teak wall paneling, TV units)
5. Office Interior (4–6 weeks, acoustic oak slats, conference rooms, workstations)
6. Furniture Manufacturing & Custom Furniture (2–4 weeks, kiln-seasoned Burma & CP teak)
7. Carpentry Work (1–3 weeks, teak doors, paneling, stair handrails)
8. Wardrobe Design (2–3 weeks, sliding & fluted glass wardrobes)
9. False Ceiling (1–2 weeks, Saint-Gobain gypsum & recessed 3000K LED coves)
Service Areas: CDA Sectors (Cuttack), Badambadi, College Square, Link Road Madhupatna, Choudwar, Chauliaganj, Tulasipur, Buxi Bazaar, Mahanadi Vihar, and Bhubaneswar.
Keep answers warm, practical, and concise (2–4 spoken sentences). Never invent fake prices—explain that Bipin Kumar provides transparent itemized quotes after a laser measurement site visit, and invite callers to book via the inquiry form or call/WhatsApp +91 8270123438.`;

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));

  // Dynamic SEO sitemap & robots.txt
  app.get('/robots.txt', (req, res) => {
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    res.type('text/plain').send(
      `User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${baseUrl}/sitemap.xml\n`
    );
  });

  app.get('/sitemap.xml', (req, res) => {
    const baseUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const staticPaths = ['/', '/projects', '/locations', '/services', '/about', '/contact'];
    const urls = [
      ...staticPaths.map((p) => `<url><loc>${baseUrl}${p}</loc><changefreq>weekly</changefreq></url>`),
      ...DEFAULT_PROJECTS.map(
        (proj) =>
          `<url><loc>${baseUrl}/projects/${encodeURIComponent(proj.slug)}</loc><changefreq>monthly</changefreq></url>`
      ),
    ];
    res.type('application/xml').send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`
    );
  });

  // Public runtime config (Google Maps key)
  app.get('/api/config', (_req, res) => {
    const mapsApiKey =
      process.env.VITE_GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      '';
    res.json({ mapsApiKey });
  });

  // Protected image upload endpoint verified by Firebase ID token
  app.post('/api/admin/upload', requireAdminFirebaseAuth, (req, res) => {
    upload.array('images', 10)(req, res, (err: unknown) => {
      if (err) {
        const message = err instanceof Error ? err.message : 'Image upload failed.';
        res.status(400).json({ error: message });
        return;
      }
      const files = (req.files as Express.Multer.File[]) || [];
      if (files.length === 0) {
        res.status(400).json({ error: 'No image files received.' });
        return;
      }
      const urls = files.map((f) => `/uploads/${f.filename}`);
      res.status(201).json({ urls });
    });
  });

  // Vite dev middleware or static production serving
  if (!IS_PRODUCTION) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir, { maxAge: '1d' }));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    if (req.url && req.url.startsWith('/api/live-voice')) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', async (clientWs) => {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      clientWs.send(
        JSON.stringify({ error: 'Gemini API key is not configured for live voice consultations.' })
      );
      clientWs.close();
      return;
    }

    const ai = new GoogleGenAI({ apiKey });
    let liveSession: Awaited<ReturnType<typeof ai.live.connect>> | null = null;

    try {
      liveSession = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          systemInstruction: VOICE_SYSTEM_INSTRUCTION,
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            if (clientWs.readyState !== clientWs.OPEN) return;

            const parts = message.serverContent?.modelTurn?.parts || [];
            for (const part of parts) {
              if (part.inlineData?.data) {
                clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
              }
            }
            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
            const userText = message.serverContent?.inputTranscription?.text;
            if (userText) {
              clientWs.send(JSON.stringify({ userTranscript: userText }));
            }
            const assistantText = message.serverContent?.outputTranscription?.text;
            if (assistantText) {
              clientWs.send(JSON.stringify({ assistantTranscript: assistantText }));
            }
          },
          onerror: (err) => {
            console.error('Gemini Live error:', err);
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.send(JSON.stringify({ error: 'Live voice session encountered an error.' }));
            }
          },
          onclose: () => {
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.close();
            }
          },
        },
      });
    } catch (err) {
      console.error('Failed to establish Gemini Live connection:', err);
      if (clientWs.readyState === clientWs.OPEN) {
        clientWs.send(
          JSON.stringify({
            error:
              err instanceof Error ? err.message : 'Unable to connect to the live voice service.',
          })
        );
        clientWs.close();
      }
      return;
    }

    clientWs.on('message', (raw) => {
      if (!liveSession) return;
      try {
        const parsed = JSON.parse(raw.toString()) as { audio?: string; text?: string };
        if (parsed.audio) {
          liveSession.sendRealtimeInput({
            audio: { data: parsed.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        } else if (parsed.text) {
          liveSession.sendRealtimeInput({
            text: String(parsed.text).slice(0, 500),
          });
        }
      } catch {
        // ignore invalid client frame
      }
    });

    clientWs.on('close', () => {
      if (liveSession) {
        try {
          liveSession.close();
        } catch {
          // ignore
        }
        liveSession = null;
      }
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Vishwakarma Interior Services Centre server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
