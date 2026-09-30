import type { Metadata } from "next";
import { ApprovedListPage } from "@/components/staff/approved-list-page";

export const metadata: Metadata = { title: "RBSM buyer list" };
export default function Page() { return <ApprovedListPage base="/admin" />; }
