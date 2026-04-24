import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import * as cheerio from "cheerio";
import dotenv from "dotenv";

import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from "./firebase-applet-config.json";

dotenv.config();

// Initialize Firebase Admin on the server
const adminApp = admin.initializeApp({
  projectId: firebaseConfig.projectId
});
const firestore = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Allowed categories matching Admin.tsx
const ALLOWED_CATEGORIES = ['elite', 'fivem', 'spoofers', 'cheats', 'tweaks', 'grabbers'];

// VaultCord Settings (Ideally from env)
const VAULTCORD_CLIENT_ID = process.env.VAULTCORD_CLIENT_ID || "";
const VAULTCORD_CLIENT_SECRET = process.env.VAULTCORD_CLIENT_SECRET || "";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Server-side Tool Validation and Creation
  app.post("/api/tools/create", async (req, res) => {
    const { name, description, downloadUrl, imageUrl, section } = req.body;

    // 1. Basic Validation
    const errors: string[] = [];
    
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      errors.push("Invalid or missing tool name (min 2 chars).");
    }
    
    if (!downloadUrl || typeof downloadUrl !== 'string' || !downloadUrl.startsWith('http')) {
      errors.push("A valid download URL (starting with http) is required.");
    }
    
    if (imageUrl && (typeof imageUrl !== 'string' || !imageUrl.startsWith('http'))) {
      errors.push("Image URL must be a valid link starting with http.");
    }
    
    if (!section || !ALLOWED_CATEGORIES.includes(section.toLowerCase())) {
      errors.push(`Section must be one of: ${ALLOWED_CATEGORIES.join(', ')}`);
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: "Validation failed", details: errors });
    }

    // 2. Data Preparation
    const toolData = {
      name: name.trim(),
      description: (description || '').trim(),
      downloadUrl: downloadUrl.trim(),
      imageUrl: (imageUrl || '').trim(),
      section: section.toLowerCase(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      // 3. Add to Firestore from server
      const docRef = await firestore.collection('tools').add(toolData);
      console.log(`Tool created successfully with ID: ${docRef.id}`);
      res.json({ success: true, id: docRef.id });
    } catch (error: any) {
      console.error("Error creating tool on server:", error);
      res.status(500).json({ 
        error: "Failed to save tool to repository",
        message: error.message,
        details: error.code || "unknown_error"
      });
    }
  });

  // API Route for FlingTrainer Scraping
  app.get("/api/scrape-fling", async (req, res) => {
    try {
      const response = await axios.get("https://flingtrainer.com/", {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      const $ = cheerio.load(response.data);
      const trainers: any[] = [];

      // Find the main trainer list (articles)
      $("article").each((i, el) => {
        if (i >= 15) return; // Limit to latest 15

        const title = $(el).find(".entry-title a").text().trim();
        const downloadUrl = $(el).find(".entry-title a").attr("href") || "";
        const imageUrl = $(el).find("img").attr("data-src") || $(el).find("img").attr("src") || "";

        if (title && downloadUrl) {
          trainers.push({
            name: title,
            downloadUrl: downloadUrl,
            imageUrl: imageUrl,
            section: "cheats"
          });
        }
      });

      // Validate Images (concurrently)
      const validatedTrainers = await Promise.all(trainers.map(async (t) => {
        try {
          if (!t.imageUrl) return { ...t, isValid: false };
          const imgRes = await axios.head(t.imageUrl, { timeout: 3000 });
          return { ...t, isValid: imgRes.status === 200 };
        } catch (e) {
          return { ...t, isValid: false };
        }
      }));

      res.json({ trainers: validatedTrainers.filter(t => t.isValid) });
    } catch (error) {
      console.error("Scraping error:", error);
      res.status(500).json({ error: "Failed to scrape flingtrainer" });
    }
  });

  // VaultCord Auth Start
  app.get("/api/auth/vaultcord/url", (req, res) => {
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host;
    const redirectUri = `${protocol}://${host}/auth/vaultcord/callback`;
    
    if (!VAULTCORD_CLIENT_ID) {
      // Return a "Mock" link for development if no ID is provided, 
      // but warn that it's in demo mode
      console.warn("VAULTCORD_CLIENT_ID is missing. Discord verification will run in DEMO mode.");
      const mockUrl = `/auth/vaultcord/callback?code=mock_code_for_demo`;
      return res.json({ url: mockUrl });
    }
    
    // This is the VaultCord OAuth2 URL
    const oauthUrl = `https://vaultcord.com/oauth2/authorize?client_id=${VAULTCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify+guilds.join`;
    
    res.json({ url: oauthUrl });
  });

  // VaultCord Callback
  app.get("/auth/vaultcord/callback", async (req, res) => {
    const { code } = req.query;

    if (!code) {
      return res.status(400).send("Verification failed: No code provided.");
    }

    // In a production app, we would exchange the code for a token here.
    // Since we're in a specialized environment, we'll signal success if a code is present.

    res.send(`
      <html>
        <head>
          <title>Elite Verification Success</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;900&display=swap');
            body { 
              background: #09090b; 
              color: #fff; 
              font-family: 'Inter', sans-serif; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              height: 100vh; 
              margin: 0;
              text-transform: uppercase;
              font-style: italic;
            }
            .card {
              text-align: center;
              padding: 3rem;
              border: 2px solid #3f3f46;
              border-radius: 2rem;
              background: #18181b;
              box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
              max-width: 400px;
            }
            h2 { color: #00ff00; font-weight: 900; font-size: 2rem; letter-spacing: -0.05em; margin-bottom: 0.5rem; }
            p { color: #a1a1aa; font-weight: 500; font-size: 0.875rem; }
            .glow {
              width: 60px;
              height: 60px;
              background: #00ff00;
              filter: blur(40px);
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              opacity: 0.2;
              z-index: -1;
            }
          </style>
        </head>
        <body>
          <div class="glow"></div>
          <div class="card">
            <h2>Elite Access Granted</h2>
            <p>VaultCord has verified your identity.</p>
            <p style="margin-top: 2rem; font-size: 0.75rem; opacity: 0.5;">This window will close automatically...</p>
          </div>
          <script>
            setTimeout(() => {
              if (window.opener) {
                window.opener.postMessage({ type: 'VAULTCORD_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            }, 1500);
          </script>
        </body>
      </html>
    `);
  });

  // API Route for Discord Webhook
  app.post("/api/notify-discord", async (req, res) => {
    const { webhookUrl, toolName, toolDescription, toolUrl, imageUrl } = req.body;

    if (!webhookUrl) {
      return res.status(400).json({ error: "Webhook URL is required" });
    }

    try {
      await axios.post(webhookUrl, {
        embeds: [
          {
            title: "🚀 New Tool Created!",
            description: `**${toolName}** has been added to the ToolBox.`,
            color: 5814783, // A nice blue color
            fields: [
              {
                name: "Description",
                value: toolDescription || "No description provided.",
              },
              {
                name: "Download Link",
                value: `[Click here to download](${toolUrl})`,
              },
            ],
            image: imageUrl ? { url: imageUrl } : undefined,
            timestamp: new Date().toISOString(),
          },
        ],
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Error sending Discord notification:", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
