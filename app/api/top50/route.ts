import { parseAttribution } from "@/lib/attribution";
import { sendTop50Email } from "@/lib/top50-mail";
import { EMAIL_PATTERN, INVALID_EMAIL_MESSAGE } from "@/lib/waitlist";

const MAX_EMAIL_LENGTH = 254;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const input = body as { email?: unknown; attribution?: unknown } | null;
  const raw = input?.email;
  const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    return Response.json({ error: INVALID_EMAIL_MESSAGE }, { status: 400 });
  }

  try {
    await sendTop50Email(email, new URL(request.url).origin, parseAttribution(input?.attribution));
  } catch (error) {
    console.error("Failed to email the Top 50 chart", error);
    return Response.json(
      { error: "We couldn't send the chart. Please try again." },
      { status: 500 },
    );
  }

  return Response.json({ ok: true });
}
