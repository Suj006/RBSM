import { SectionTabs } from "@/components/section-tabs";

const TABS = [["", "Live monitor"], ["/published", "Published schedule"], ["/pavilions", "Pavilions"], ["/nodal", "Nodal officers"]] as const;

export default function EventLayout({ children }: { children: React.ReactNode }) {
  return <><SectionTabs base="/fieo/event" tabs={TABS} label="Event days" />{children}</>;
}
