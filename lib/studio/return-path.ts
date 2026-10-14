// Sign-in is only for the admin pages now (/start needs no account). The
// admin page someone came from, or null: anything that isn't one of our own
// admin paths (an external URL, a path with "..", no `next` at all, an old
// email's plain /signin link) isn't a place to return to.
export function returnPath(next: string | string[] | null | undefined): string | null {
  return typeof next === "string" && /^\/admin(\/[\w-]+)*$/.test(next) ? next : null
}
