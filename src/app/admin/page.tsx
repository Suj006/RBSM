import type { Metadata } from "next";
import { StaffDashboard } from "@/components/staff/dashboard";

export const metadata: Metadata = { title: "Admin dashboard" };
export default function Page() { return <StaffDashboard role="ADMIN" base="/admin" />; }
