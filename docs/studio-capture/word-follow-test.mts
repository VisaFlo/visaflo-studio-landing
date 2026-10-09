// Matcher checks for the karaoke prompter. Run: node docs/studio-capture/word-follow-test.mts
import { advancePointer, indexScript, lineOfWord, tokenize } from "../../lib/studio/word-follow.ts"
import { scriptLines } from "../../lib/studio/content.ts"
const lines = scriptLines("Maria Lopez", "Lopez Immigration")
const idx = indexScript(lines)
let fails = 0
const check = (name: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${JSON.stringify(got)}${ok ? "" : " want " + JSON.stringify(want)}`) }
// exact reading of line 0
let p = advancePointer(idx.words, 0, tokenize("Hi I'm Maria Lopez from Lopez Immigration"))
check("exact line 0", p, idx.lineStarts[1])
// recognizer variations: "Hi I am Maria Lopes from Lopez immigration"
p = advancePointer(idx.words, 0, tokenize("hi i am maria lopes from lopez immigration"))
check("variations line 0", p, idx.lineStarts[1])
// skipped words ok
p = advancePointer(idx.words, idx.lineStarts[1], tokenize("immigration rules change almost every week"))
check("skips 'in Canada'", p, idx.lineStarts[2])
// numbers
p = advancePointer(idx.words, idx.lineStarts[3], tokenize("so here are 3 things I tell every client before they apply"))
check("3 for three", p, idx.lineStarts[4])
// noise words shouldn't jump far
p = advancePointer(idx.words, idx.lineStarts[4], tokenize("um so uh"))
check("filler words don't move", p, idx.lineStarts[4])
// unrelated speech doesn't skip a line
p = advancePointer(idx.words, idx.lineStarts[4], tokenize("hello can you hear me okay"))
check("off-script speech stays put", p, idx.lineStarts[4])
// IRCC line
const ircc = lines.findIndex((l) => l.includes("If IRCC asks"))
p = advancePointer(idx.words, idx.lineStarts[ircc], tokenize("if irc asks a question later you will want to see exactly what you submitted"))
check("irc for IRCC", p, idx.lineStarts[ircc + 1])
check("lineOfWord mid", lineOfWord(idx, idx.lineStarts[2] + 2), 2)
check("lineOfWord end", lineOfWord(idx, idx.words.length), lines.length - 1)
console.log(fails ? `${fails} FAILED` : "all passed")
// natural reading with dropped short words still finishes the line
let q = advancePointer(idx.words, idx.lineStarts[4], tokenize("first check your passport stays valid for whole stay"))
check("drops short words, line 4 done", q, idx.lineStarts[5])
q = advancePointer(idx.words, idx.lineStarts[2], tokenize("and most people only hear about it when its too late"))
check("its for it's", q, idx.lineStarts[3])
console.log(fails ? `${fails} FAILED` : "all passed (2)")
