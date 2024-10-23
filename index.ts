import path from "path";
import express, { Request, Response, NextFunction } from "express";
import morgan from "morgan";
import * as yup from "yup";
import monk from "monk";
import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";
import { nanoid } from "nanoid";
import dotenv from "dotenv";

// Initialize environment variables
dotenv.config();

// Database setup
const db = monk(process.env.MONGODB_URI || "");
const urls = db.get("urls");
urls.createIndex({ slug: 1 }, { unique: true });

// Express app setup
const app = express();
const port = process.env.PORT || 3000;

// Middleware setup
app.use(morgan(process.env.NODE_ENV === "production" ? "common" : "dev"));
app.use(express.json());
app.use(express.static("./public"));

// Path to the 404 error page
const notFoundPath = path.join(__dirname, "public/404.html");

// Route to handle URL redirection
app.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  const { id: slug } = req.params;
  try {
    const url = await urls.findOne({ slug });
    if (url) {
      return res.redirect(url.url);
    }
    return res.status(404).sendFile(notFoundPath);
  } catch (error) {
    return res.status(404).sendFile(notFoundPath);
  }
});

// Validation schema using Yup
const schema = yup.object().shape({
  slug: yup
    .string()
    .trim()
    .matches(/^[\w\-]+$/i)
    .min(5)
    .max(20),
  url: yup.string().trim().url().required(),
});

// Route to handle URL shortening
app.post(
  "/url",
  slowDown({
    windowMs: 30 * 1000, // 30 seconds
    delayAfter: 2, // allow 2 requests per 30 sec, then...
    delayMs: 500, // begin adding 500ms of delay per request above 2
  }),
  rateLimit({
    windowMs: 30 * 1000, // 30 seconds
    max: 2, // limit each IP to 2 requests per windowMs
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    let { slug, url }: { slug: string; url: string } = req.body;
    try {
      await schema.validate({
        slug,
        url,
      });

      if (!slug) {
        slug = nanoid(5);
      } else {
        const existing = await urls.findOne({ slug });
        if (existing) {
          throw new Error("Slug is in use. 😔");
        }
      }

      const newUrl = {
        url,
        slug,
      };

      const created = await urls.insert(newUrl);
      res.json(created);
    } catch (error) {
      next(error);
    }
  }
);

// Not Found Handler
app.use((req: Request, res: Response) => {
  res.status(404).sendFile(notFoundPath);
});

// Error Handler
app.use((error: any, req: Request, res: Response, next: NextFunction) => {
  res.status(error.status || 500).json({
    success: false,
    message: error.message,
    stack: process.env.NODE_ENV === "production" ? "🥞" : error.stack,
  });
});

// Server Listening
app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
