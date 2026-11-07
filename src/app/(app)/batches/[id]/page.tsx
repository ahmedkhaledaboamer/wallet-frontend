import type { Metadata } from "next";
import { Suspense } from "react";
import { BatchDetailsView } from "@/components/batches/batch-details-view";

export const metadata: Metadata = { title: "Batch details" };

export default function BatchDetailsPage() {
  return (
    <Suspense>
      <BatchDetailsView />
    </Suspense>
  );
}
