# Video Playbook lead magnet

The landing page displays the Video Playbook banner directly below the Top 50 banner. `/playbook` opens the same landing page with the playbook email dialog already open and includes a dedicated social preview image.

Submitting a valid email to `/api/playbook` sends the 16-page October 2026 PDF and a research-kit ZIP through the existing SendGrid account. Both attachments live in `assets/` and are explicitly traced into the serverless function. The public cover image is the first page of the PDF; the PDF itself is not served from `public/`.

The guide uses research collected on 30 September 2026: 50 channels, 7,558 recent upload records and 179 title/thumbnail examples. October 2026 is the publication edition. The research kit retains the original ranking cohorts and includes the searchable research library; it does not include raw comment or caption dumps.

The existing lead attribution and analytics pipeline records dialog opens as `playbook_dialog_open` and successful requests as `generate_lead` with `lead_type: video_playbook`. The recipient email is passed only to the existing Mixpanel identification flow, not GA4 event properties. A failure of the internal team notification does not turn a successfully delivered reader email into a failed response.

## Validation

- ESLint, TypeScript and the production Next.js build passed.
- The built API file trace includes both private attachment files.
- API/mail checks intercepted SendGrid requests: invalid input, exact attachment bytes, recipient normalization, attribution, provider failure and internal-notice failure were verified without sending real email.
- All 16 PDF pages were rendered and visually checked.
- Aside was used to verify the dialog and form behavior in the browser.

Production uses the existing `SENDGRID_API_KEY` and optional `WAITLIST_TO` configuration, just like Top 50. Updating a guide requires replacing the PDF, research kit and cover together.
