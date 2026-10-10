import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { userClient } from "@/lib/supabase/server";
import { enforceMutation, failure, rateLimit } from "@/server/http";
import {
  aiSettings,
  allowedAiSources,
  answerWithAi,
  hasPromptInjectionSignal,
  loadAiConversation,
  recordAiConversation,
} from "@/server/ai-support";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  question: z.string().trim().min(1).max(2000),
  visitor_id: z.uuid().nullable().optional(),
  conversation_id: z.uuid().nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    enforceMutation(request);
    if (!request.headers.get("content-type")?.includes("application/json"))
      throw new Error("Send a valid AI support question.");
    const raw = await request.text();
    if (raw.length > 20_000) throw new Error("That question is too large.");
    const values = requestSchema.parse(JSON.parse(raw));
    const db = await userClient();
    const auth = await db.auth.getUser();
    let viewer: { id?: string; role?: string; name?: string | null } = {};
    if (auth.data.user) {
      const profile = await db
        .from("profiles")
        .select("id,name,role,status")
        .eq("id", auth.data.user.id)
        .maybeSingle();
      if (profile.error || !profile.data)
        throw new Error("Your profile is being prepared. Please sign in again.");
      if (profile.data.status === "SUSPENDED")
        throw new Error("Your account is currently suspended. Please contact support.");
      viewer = {
        id: auth.data.user.id,
        role: profile.data.role,
        name: profile.data.name,
      };
    }
    const settings = await aiSettings();
    if (!settings.enabled) throw new Error("AI_SUPPORT_DISABLED");
    if (!viewer.id && !settings.public_enabled) throw new Error("AI_PUBLIC_DISABLED");
    if (viewer.id && !settings.learner_enabled) throw new Error("AI_LEARNER_DISABLED");
    const requester = viewer.id || request.headers.get("x-forwarded-for")?.split(",")[0] || "visitor";
    rateLimit(`ai-support:${requester}`, settings.max_requests_per_hour, 60 * 60 * 1000);
    const history = await loadAiConversation(
      values.conversation_id || null,
      viewer,
      values.visitor_id || null,
    );

    if (hasPromptInjectionSignal(values.question)) {
      return NextResponse.json(
        {
          ok: true,
          data: {
            answer: "I can help with Riches AI Network courses, learning, membership, and support. Please ask a direct question about the platform or your learning.",
            sources: [],
            model: null,
          },
        },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }

    const contextQuestion = [...history.map((item) => item.content), values.question]
      .slice(-6)
      .join("\n");
    const context = await allowedAiSources(contextQuestion, viewer);
    const sources = context.sources.slice(0, settings.max_context_sources);
    let result: { answer: string; model: string };
    try {
      result = await answerWithAi({
        question: values.question,
        settings,
        viewer,
        sources,
        learnerContext: context.learnerContext,
        history,
      });
    } catch (modelError) {
      console.error(
        "ai_support_model_unavailable",
        modelError instanceof Error ? modelError.message : "unknown",
      );
      result = { answer: settings.fallback_message, model: "unavailable" };
    }
    const conversationId = await recordAiConversation({
      viewer,
      visitorId: values.visitor_id || null,
      conversationId: values.conversation_id || null,
      model: result.model,
      question: values.question,
      answer: result.answer,
      sources,
    });
    return NextResponse.json(
      {
        ok: true,
        data: {
          answer: result.answer,
          sources: sources.map((source, index) => ({
            number: index + 1,
            id: source.id,
            title: source.title,
          })),
          model: result.model,
          conversation_id: conversationId,
        },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { ok: false, error: "Please enter a message before sending." },
        { status: 400, headers: { "Cache-Control": "private, no-store" } },
      );
    console.error(
      "ai_support_request_failed",
      error instanceof Error ? error.message : "unknown",
    );
    return failure(error);
  }
}
