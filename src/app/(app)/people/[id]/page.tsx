"use client";

import { use } from "react";
import { PersonProfile } from "@/components/people/PersonProfile";

export default function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <PersonProfile personId={id} standalone />;
}
