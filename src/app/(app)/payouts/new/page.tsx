import type { Metadata } from "next";
import { NewPayoutView } from "@/components/payout/new-payout-view";

export const metadata: Metadata = { title: "New payout" };

export default function NewPayoutPage() {
  return <NewPayoutView />;
}
