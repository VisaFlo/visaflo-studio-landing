// First-party proxy for Mixpanel (see lib/analytics.ts), so ad blockers that
// block api.mixpanel.com don't drop visits. Only the SDK's own endpoints are
// forwarded; anything else is a 404, so this can't be used as an open proxy.
const UPSTREAM = "https://api.mixpanel.com"
const ROUTES = new Set(["track", "engage", "groups", "record", "flags", "settings"])

async function forward(request: Request, ctx: RouteContext<"/mp/[...path]">) {
  const { path } = await ctx.params
  if (path.length !== 1 || !ROUTES.has(path[0])) {
    return new Response("Not found", { status: 404 })
  }

  const url = new URL(request.url)
  const headers = new Headers()
  const contentType = request.headers.get("content-type")
  if (contentType) headers.set("content-type", contentType)
  const userAgent = request.headers.get("user-agent")
  if (userAgent) headers.set("user-agent", userAgent)
  // Mixpanel geolocates from the client IP; without this every visit would
  // show up at Vercel's data center.
  const clientIp =
    request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  if (clientIp) headers.set("x-forwarded-for", clientIp)

  const upstream = await fetch(`${UPSTREAM}/${path[0]}/${url.search}`, {
    method: request.method,
    headers,
    body: request.method === "GET" ? undefined : await request.arrayBuffer(),
    cache: "no-store",
  })

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "text/plain",
      "cache-control": "no-store",
    },
  })
}

export { forward as GET, forward as POST }
