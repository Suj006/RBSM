import type { Metadata } from "next";
import { StaffDashboard } from "@/components/staff/dashboard";

export const metadata: Metadata = { title: "FIEO dashboard" };
export default function Page() { return <StaffDashboard role="FIEO" base="/fieo" />; }
