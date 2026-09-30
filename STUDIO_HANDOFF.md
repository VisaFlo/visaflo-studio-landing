# Studio landing page handoff

Branch: `preview/studio-dynamic-conversion`

The user asked to push this preview so Claude can finish it. Do not merge into
`main` or deploy to production until the user explicitly approves.

## Implemented

- Three-line hero with animated TikTok, Instagram, YouTube and LinkedIn icons.
- Numbered content sources: Regulatory Monitor, ATIP insights, and Your insights.
  The third option turns the practitioner's own perspective on any immigration
  topic into a video script.
- Three visual workflow steps: set up once, draft, review and post.
  Step 1 uses the user's supplied photo; step 3 uses the existing
  `work-permit-study-selfie` video and matching poster. Step 2 matches its topic.
- Revised sample-video CTA copy, sample spacing, and small-screen navigation.
- GA4 events for CTA clicks, sample clicks, and successful sample requests.
  Existing GA4 initialization is reused; no form values are sent to analytics.

## User decisions to preserve

- Audience: “For busy immigration lawyers & RCICs”.
- Hero: “Fresh immigration news / ready to upload, / in your own face and voice.”
  Keep the same font weight across all three lines.
- Primary CTA: “Get my sample video”. Avoid “pilot” and “AI” in marketing copy.
- Emphasize Regulatory Monitor and ATIP sources without delivery-time guarantees.
- Finish the design/copy review with the user before proposing a main merge.

## Validation and preview

- `npm run build`, `npm run lint`, and `git diff --check` passed.
- Desktop/mobile layouts checked, including the new three-source section.
- Workflow sample video playback checked.
- Conversion events previously checked with a mocked successful form response.
- Local preview: `http://127.0.0.1:5196/` while the existing dev server is running.
  To start another instance: `npm run dev -- --port 5196`.

The `/api/waitlist` route sends real email. Mock it when testing the form, and
block analytics collection in automated QA. Preserve the existing Top 50 banner
and `/chart` behavior.
