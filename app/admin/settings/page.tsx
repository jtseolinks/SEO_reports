export const dynamic = "force-dynamic";

import { getAgencySettings } from "@/lib/agency-settings";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const settings = await getAgencySettings();
  return <SettingsClient initialSettings={settings} />;
}
