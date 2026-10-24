import type { NextRequest } from "next/server";
import { apiHandler, ok, readJson } from "@/lib/api";
import { getOwnerId } from "@/lib/db/owner";
import { createTopic, listTopics } from "@/lib/repo/topics";
import { topicQuerySchema, topicSchema } from "@/lib/validation";
import { AppError } from "@/lib/errors";

export const GET = apiHandler(async (request: NextRequest) => {
  const parsed = topicQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) throw new AppError("VALIDATION_FAILED", "فلتر غير صالح");
  return ok({ topics: await listTopics(await getOwnerId(), parsed.data.category) });
});

export const POST = apiHandler(async (request: NextRequest) => {
  const body = await readJson(request, topicSchema);
  const topic = await createTopic(await getOwnerId(), body);
  return ok({ topic }, 201);
});
