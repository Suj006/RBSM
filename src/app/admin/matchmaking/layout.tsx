import { MatchTabs } from "@/components/match/tabs";

export default function MatchmakingLayout({ children }: { children: React.ReactNode }) {
  return <><MatchTabs base="/admin/matchmaking" />{children}</>;
}
