export type Sample = {
  tag: string
  duration: string
  title: string
  /** Vertical 9:16 MP4 with captions and graphics burned in. */
  videoSrc?: string
  /** Still frame shown until the video starts playing. */
  poster?: string
}

export const SAMPLES: Sample[] = [
  {
    tag: "EXPRESS ENTRY",
    duration: "0:25",
    title: "CEC draw: 2,000 invitations, CRS 518",
    videoSrc: "/samples/express-entry-draw.mp4",
    poster: "/samples/express-entry-draw.jpg",
  },
  {
    tag: "WORK PERMIT",
    duration: "0:25",
    title: "Study for up to 6 months without a study permit",
    videoSrc: "/samples/work-permit-study.mp4",
    poster: "/samples/work-permit-study.jpg",
  },
  {
    tag: "STUDY PERMIT",
    duration: "0:22",
    title: "Proof of funds rises to $23,448",
    videoSrc: "/samples/study-permit-funds.mp4",
    poster: "/samples/study-permit-funds.jpg",
  },
  {
    tag: "FAMILY SPONSORSHIP",
    duration: "0:25",
    title: "Parents and grandparents: intake paused, super visa stays open",
    videoSrc: "/samples/pgp-super-visa.mp4",
    poster: "/samples/pgp-super-visa.jpg",
  },
  {
    tag: "PERMANENT RESIDENCE",
    duration: "0:35",
    title: "Almost 250,000 PR applications are waiting in line",
    videoSrc: "/samples/pr-backlog.mp4",
    poster: "/samples/pr-backlog.jpg",
  },
  {
    tag: "WORK PERMIT",
    duration: "0:25",
    title: "Two checks before you study on a work permit",
    videoSrc: "/samples/work-permit-study-selfie.mp4",
    poster: "/samples/work-permit-study-selfie.jpg",
  },
]
