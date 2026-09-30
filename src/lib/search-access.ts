export function searchDenialResponse(canSearchPeople: boolean, canSearchEvents: boolean, canSearchProperties: boolean): Response | null {
  if (canSearchPeople || canSearchEvents || canSearchProperties) return null;
  return Response.json({ error: "Forbidden" }, { status: 403 });
}
