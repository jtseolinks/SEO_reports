export const dynamic = "force-dynamic";

import { getAgencySettings, maskSecrets } from "@/lib/agency-settings";
import { SettingsClient } from "./settings-client";
import { requireAgencyPage } from "@/lib/authz";

export default async function SettingsPage() {
  const ctx = await requireAgencyPage();
  // Mask secrets (e.g. smtpPass) before handing settings to the client component.
  const settings = maskSecrets(await getAgencySettings(ctx.agencyId));
  return <SettingsClient initialSettings={settings} />;
}
