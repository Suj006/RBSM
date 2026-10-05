import { SectionTabs } from "@/components/section-tabs";

const TABS = [["", "Dashboard"], ["/list", "All MoUs"]] as const;

export default function MouLayout({ children }: { children: React.ReactNode }) {
  return <><SectionTabs base="/dic/mou" tabs={TABS} label="MoUs" />{children}</>;
}
