import { loadFont as loadBebas } from "@remotion/google-fonts/BebasNeue"
import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins"

// The landing samples' type: Poppins for captions, labels and sentences,
// Bebas Neue for the big numbers. Loaded once per bundle.
const poppins = loadPoppins("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] })
const bebas = loadBebas("normal", { weights: ["400"], subsets: ["latin"] })

export const FONTS = {
  body: `${poppins.fontFamily}, 'Helvetica Neue', Arial, sans-serif`,
  display: `${bebas.fontFamily}, 'Arial Narrow', Impact, sans-serif`,
}
