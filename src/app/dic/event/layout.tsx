import { SectionTabs } from "@/components/section-tabs";

const TABS = [["", "Overview"], ["/settings", "Dates & hours"], ["/pavilions", "Pavilions"], ["/nodal", "Nodal officers"], ["/schedule", "Draft schedule"], ["/published", "Published schedule"], ["/live", "Live monitor"]] as const;

export default function EventLayout({ children }: { children: React.ReactNode }) {
  return <><SectionTabs base="/dic/event" tabs={TABS} label="Event days" />{children}</>;
}
