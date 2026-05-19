import path from "path";
import express from "express";
import { app, pollCliniko } from "./app";

const PORT = Number(process.env.PORT) || 3000;

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
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
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    // Start Pollers
    setInterval(pollCliniko, 60000);
    pollCliniko(); // Run immediately
  });
}

if (!process.env.VERCEL) {
  startServer();
}
