import { parseWaitlistEntry } from "@/lib/waitlist";
import { saveWaitlistEntry } from "@/lib/waitlist-store";

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
    // A repeat signup is reported as success too, so the response never reveals
    // whether an email is already on the list.
    await saveWaitlistEntry(parsed.entry);
  } catch (error) {
    console.error("Failed to save waitlist entry", error);
    return Response.json(
      { error: "We couldn't save your signup. Please try again." },
      { status: 500 },
    );
  }

  return Response.json({ ok: true });
}
