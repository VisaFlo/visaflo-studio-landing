import { Config } from "@remotion/cli/config"

// Fixture media for the Studio preview lives with the composition, not in
// Next's public/ folder.
Config.setPublicDir("remotion/fixtures")
Config.setVideoImageFormat("jpeg")
Config.setOverwriteOutput(true)
