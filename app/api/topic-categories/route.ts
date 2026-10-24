import type { NextRequest } from "next/server";
import { apiHandler, ok, readJson } from "@/lib/api";
import { createCategory, listCategories } from "@/lib/repo/topics";
import { categorySchema } from "@/lib/validation";

export const GET = apiHandler(async () => {
  return ok({ categories: await listCategories() });
});

export const POST = apiHandler(async (request: NextRequest) => {
  const body = await readJson(request, categorySchema);
  return ok({ category: await createCategory(body.label) }, 201);
});
