import express, { type ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { snapshot } from "./catalog.ts";
import { coursesRouter } from "./routes/courses.ts";
import { studentsRouter } from "./routes/students.ts";

export const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", calendarYear: snapshot.calendarYear });
});
app.use("/api/courses", coursesRouter);
app.use("/api/students", studentsRouter);

app.use((req, res) => {
  res.status(404).json({ error: { message: `no route for ${req.method} ${req.path}` } });
});

// every error comes back as { error: { message, details? } }
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    res.status(400).json({ error: { message: "invalid request", details } });
    return;
  }
  // malformed JSON from express.json()
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ error: { message: "request body is not valid JSON" } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { message: "internal server error" } });
};

app.use(errorHandler);
