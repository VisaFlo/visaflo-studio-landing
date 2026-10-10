import { openSample } from "@/lib/studio/sample/context"

export async function GET(request: Request) {
  const sample = await openSample(request)
  if (sample instanceof Response) return sample
  return Response.json(sample.status)
}
