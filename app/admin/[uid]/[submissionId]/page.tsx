import type { Metadata } from "next"

import { SubmissionPage } from "@/components/studio/submission-page"

export const metadata: Metadata = {
  title: "Submission | VisaFlo Studio",
  robots: { index: false },
}

export default async function AdminSubmissionPage({ params }: { params: Promise<{ uid: string; submissionId: string }> }) {
  const { uid, submissionId } = await params
  return <SubmissionPage id={`${uid}/${submissionId}`} />
}
