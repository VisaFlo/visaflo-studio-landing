import { parseWaitlistEntry } from "@/lib/waitlist";
import { sendWaitlistEmail } from "@/lib/waitlist-mail";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = parseWaitlistEntry(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  try {
    await sendWaitlistEmail(parsed.entry);
  } catch (error) {
    console.error("Failed to email waitlist entry", error);
    return Response.json(
      { error: "We couldn't save your request. Please try again." },
      { status: 500 },
    );
  }

  return Response.json({ ok: true });
}
