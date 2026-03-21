import ComingSoon from "@/components/ComingSoon";
import HomePage from "@/components/HomePage";

const COMING_SOON = process.env.NEXT_PUBLIC_COMING_SOON !== "false";

export default function RootPage() {
  if (COMING_SOON) {
    return <ComingSoon />;
  }
  return <HomePage />;
}
