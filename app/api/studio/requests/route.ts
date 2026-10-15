import { sendStudioRequestEmail } from "@/lib/studio-request-mail"
import { studioAdmin, type StudioAdmin } from "@/lib/studio/admin-firebase"
import { isPlainObject, parseChecks } from "@/lib/studio/checks"
import { RECORDING_EXTENSIONS, SUBMISSION_ID } from "@/lib/studio/project"
import { asEmail, fullName, identifier, isoDate, LIMITS, seconds, text } from "@/lib/studio/request-json"
import { StorageError } from "@/lib/studio/storage"

const RECORDING_FILE = new RegExp(`^recording\\.(${RECORDING_EXTENSIONS.join("|")})$`)

// Someone took their portrait photo, recorded on /start and picked a topic.
// Nobody signs in there: the photo and the recording are already in
// studio/{submissionId}/ (the storage rules let a browser create only
// those), and this checks they are there, keeps what was sent as
// request.json next to them and tells the team. request.json
// is created only once, so the same submission is never mailed twice.
export async function POST(request: Request) {
  let parsed: unknown
  try {
    parsed = await request.json()
  } catch (error) {
    console.error("Unreadable studio request body", error)
    return Response.json({ error: "Invalid request body." }, { status: 400 })
  }
  if (!isPlainObject(parsed)) {
    console.error("Studio request body isn't an object", JSON.stringify(parsed)?.slice(0, 300))
    return Response.json({ error: "Invalid request body." }, { status: 400 })
  }
  const body = parsed

  const submissionId = identifier(body.submissionId, LIMITS.submissionId) ?? ""
  const recordingPath = identifier(body.recordingPath, LIMITS.recordingPath) ?? ""
  const folder = `studio/${submissionId}/`
  const validPath = SUBMISSION_ID.test(submissionId) && recordingPath.startsWith(folder) && RECORDING_FILE.test(recordingPath.slice(folder.length))
  if (!validPath) {
    // Our own client never sends this, so it is a client bug or someone probing.
    console.error("Rejected a studio request's recording path", { submissionId: body.submissionId, recordingPath: body.recordingPath })
    return Response.json({ error: "That isn't a recording we know." }, { status: 400 })
  }
  // A page from before the portrait photo sends none; one that does names
  // this submission's photo.jpg and nothing else.
  const sentPhoto = body.photoPath === undefined ? undefined : (identifier(body.photoPath, LIMITS.recordingPath) ?? "")
  if (sentPhoto !== undefined && sentPhoto !== `${folder}photo.jpg`) {
    console.error("Rejected a studio request's photo path", { submissionId, photoPath: body.photoPath })
    return Response.json({ error: "That isn't a photo we know." }, { status: 400 })
  }

  // The client sends these only once they are set, so a refusal here is a
  // client bug worth a line too.
  const email = asEmail(body.email)
  const firstName = text(body.firstName)
  const lastName = text(body.lastName)
  const firm = text(body.firm)
  if (!email || !firstName || !lastName || !firm) {
    console.error(`Rejected studio request ${submissionId}: missing details`, { email: body.email, firstName: !!firstName, lastName: !!lastName, firm: !!firm })
    return Response.json({ error: "Fill in your email, name and firm first." }, { status: 400 })
  }
  const topicTitle = text(body.topicTitle, LIMITS.topicTitle)
  if (!topicTitle) {
    console.error(`Rejected studio request ${submissionId}: no topic`, { topicTitle: body.topicTitle })
    return Response.json({ error: "Pick a topic first." }, { status: 400 })
  }
  const consentAt = isoDate(body.consentAt)
  if (!consentAt) {
    console.error(`Rejected studio request ${submissionId}: bad consent time`, { consentAt: body.consentAt })
    return Response.json({ error: "Agree to the consent first." }, { status: 400 })
  }

  // This client always sends a checks object; one that doesn't parse is a
  // client bug worth a line, but not worth losing the request over.
  const checks = parseChecks(body.checks)
  if (body.checks !== undefined && !checks) console.error(`Unreadable checks in studio request ${submissionId}`, JSON.stringify(body.checks)?.slice(0, 300))
  const recordingSeconds = seconds(body.recordingSeconds) ?? 0
  const name = fullName(firstName, lastName) ?? ""

  let bucket: StudioAdmin["bucket"]
  try {
    bucket = studioAdmin().bucket
  } catch (error) {
    console.error("Studio requests can't reach the bucket", error)
    return Response.json({ error: "We saved your recording but couldn't send the request. Try again." }, { status: 500 })
  }

  for (const [path, what] of [[recordingPath, "recording"], ...(sentPhoto ? [[sentPhoto, "photo"]] : [])]) {
    try {
      await bucket.meta(path)
    } catch (error) {
      if (!(error instanceof StorageError && error.status === 404)) {
        console.error(`Could not check the ${what} of studio request ${submissionId}`, error)
        return Response.json({ error: "We couldn't send the request. Try again." }, { status: 500 })
      }
      console.error(`Rejected studio request ${submissionId}: no ${what} at ${path}`)
      return Response.json({ error: `We couldn't find your ${what}. Take it again, then send.` }, { status: 404 })
    }
  }

  // Already sent (a double click, or a retry after the answer got lost): it
  // went to the team then. create() below refuses an overwrite too, which
  // covers two sends at once; this check is what the Storage emulator, which
  // ignores that precondition, also honours.
  const requestJson = `${folder}request.json`
  try {
    await bucket.meta(requestJson)
    return Response.json({ ok: true })
  } catch (error) {
    if (!(error instanceof StorageError && error.status === 404)) {
      console.error(`Could not check request.json of studio request ${submissionId}`, error)
      return Response.json({ error: "We couldn't send the request. Try again." }, { status: 500 })
    }
  }

  const record = {
    submissionId,
    recordingPath,
    recordingSeconds,
    recordingSource: "camera",
    checks,
    photoPath: sentPhoto,
    email,
    firstName,
    lastName,
    name,
    firm,
    topicId: text(body.topicId),
    topicTitle,
    consent: text(body.consent, LIMITS.consent),
    consentAt,
    createdAt: new Date().toISOString(),
  }
  try {
    await bucket.create(requestJson, JSON.stringify(record, null, 2), "application/json")
  } catch (error) {
    // Created since the check above: another send of the same submission won.
    if (error instanceof StorageError && error.status === 412) return Response.json({ ok: true })
    console.error(`Could not save request.json for studio request ${submissionId}`, error)
    return Response.json({ error: "We saved your recording but couldn't send the request. Try again." }, { status: 500 })
  }

  try {
    await sendStudioRequestEmail({
      email,
      name,
      firm,
      topicTitle,
      submissionId,
      recordingPath,
      recordingSeconds,
      recordingSource: "camera",
      checks,
      photoPath: sentPhoto,
      consentAt,
      adminUrl: new URL(`/admin/${submissionId}`, request.url).toString(),
    })
  } catch (error) {
    console.error(`Failed to email studio request ${submissionId}`, error)
    // Take request.json back so a retry sends the email instead of finding
    // the submission already sent.
    await bucket.remove(requestJson).catch((removeError: unknown) => console.error(`Could not remove ${requestJson} after the email failed`, removeError))
    return Response.json({ error: "We saved your recording but couldn't send the request. Try again." }, { status: 500 })
  }

  return Response.json({ ok: true })
}
