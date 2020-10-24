const path = require("path");
const express = require("express");
const morgan = require("morgan");
const yup = require("yup");
const monk = require("monk");
const rateLimit = require("express-rate-limit");
const slowDown = require("express-slow-down");
const { nanoid } = require("nanoid");
require("dotenv").config();

const db = monk(process.env.MONGODB_URI);
const urls = db.get("urls");
urls.createIndex({ slug: 1 }, { unique: true });

const app = express();
const port = process.env.PORT || 3000;

app.use(morgan(process.env.NODE_ENV === "production" ? "common" : "dev"));
app.use(express.json());
app.use(express.static("./public"));

const notFoundPath = path.join(__dirname, "public/404.html");

app.get("/:id", async (req, res, next) => {
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

const schema = yup.object().shape({
   slug: yup
      .string()
      .trim()
      .matches(/^[\w\-]+$/i)
      .min(5)
      .max(20),
   url: yup.string().trim().url().required(),
});

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
   async (req, res, next) => {
      let { slug, url } = req.body;
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
app.use((req, res, next) => {
   res.status(404).sendFile(notFoundPath);
});

// Error Handler
app.use((error, req, res, next) => {
   if (error.status) {
      res.status(error.status);
   } else {
      res.status(500);
   }
   res.json({
      success: false,
      message: error.message,
      stack: process.env.NODE_ENV === "production" ? "🥞" : error.stack,
   });
});

// Server Listening
app.listen(port, () => {
   console.log(`Listening at http://localhost:${port}`);
});
