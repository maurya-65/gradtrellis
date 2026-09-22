import { Router } from "express";
import { z } from "zod";
import { searchCourses } from "../catalog.ts";

const SearchQuery = z.object({
  q: z.string().default(""),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const coursesRouter = Router();

coursesRouter.get("/", (req, res) => {
  const { q, limit } = SearchQuery.parse(req.query);
  res.json({ courses: searchCourses(q, limit) });
});
