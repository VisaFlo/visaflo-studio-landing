const START = "/start"

// Where sign-in sends someone afterwards. Only our own admin pages may ask
// to be returned to; anything else (an external URL, a path with "..")
// goes to the normal start page.
export function returnPath(next: string | null | undefined): string {
  if (!next) return START
  return /^\/admin(\/[\w-]+)*$/.test(next) ? next : START
}
