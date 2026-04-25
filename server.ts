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
