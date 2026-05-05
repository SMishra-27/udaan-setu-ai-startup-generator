import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("startupforge.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    skills TEXT,
    experience TEXT,
    interests TEXT,
    industry TEXT,
    location TEXT,
    budget TEXT
  );

  CREATE TABLE IF NOT EXISTS startup_ideas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT,
    problem TEXT,
    target_users TEXT,
    solution TEXT,
    revenue_model TEXT,
    market_opportunity TEXT,
    competitors TEXT,
    score INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS business_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idea_id INTEGER,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(idea_id) REFERENCES startup_ideas(id)
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Mock Auth / User Session (for demo purposes)
  app.post("/api/user/profile", (req, res) => {
    const { email, skills, experience, interests, industry, location, budget } = req.body;
    const stmt = db.prepare(`
      INSERT INTO users (email, skills, experience, interests, industry, location, budget)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET
        skills=excluded.skills,
        experience=excluded.experience,
        interests=excluded.interests,
        industry=excluded.industry,
        location=excluded.location,
        budget=excluded.budget
      RETURNING id
    `);
    const info = stmt.get(email, skills, experience, interests, industry, location, budget) as { id: number };
    res.json({ id: info.id });
  });

  app.get("/api/user/:email/ideas", (req, res) => {
    const user = db.prepare("SELECT id FROM users WHERE email = ?").get(req.params.email) as { id: number };
    if (!user) return res.json([]);
    const ideas = db.prepare("SELECT * FROM startup_ideas WHERE user_id = ? ORDER BY created_at DESC").all(user.id);
    res.json(ideas);
  });

  app.post("/api/ideas", (req, res) => {
    const { user_id, ideas } = req.body;
    const stmt = db.prepare(`
      INSERT INTO startup_ideas (user_id, name, problem, target_users, solution, revenue_model, market_opportunity, competitors, score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertMany = db.transaction((ideasData) => {
      for (const idea of ideasData) {
        stmt.run(user_id, idea.name, idea.problem, idea.target_users, idea.solution, idea.revenue_model, idea.market_opportunity, idea.competitors, idea.score);
      }
    });

    insertMany(ideas);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
