import { generateDashboardData } from "@/lib/dashboard/metrics";
import { DASHBOARD_SAMPLE_DATA } from "@/lib/dashboard/mock-data";
import { MOCK_ADMIN_PROFILE, MOCK_RESTRICTED_USER_PROFILE } from "@/lib/auth/mock";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function runAdminScenario() {
  const result = generateDashboardData(DASHBOARD_SAMPLE_DATA, MOCK_ADMIN_PROFILE);

  assert(result.kpis.activeCampaigns === DASHBOARD_SAMPLE_DATA.length, "Admin should see all campaigns");
  assert(
    result.byCreative.length > 0 && result.byAgency.length > 0,
    "Admin should receive distributions with spend data",
  );

  return result;
}

function runRestrictedScenario() {
  const result = generateDashboardData(DASHBOARD_SAMPLE_DATA, MOCK_RESTRICTED_USER_PROFILE);

  assert(result.kpis.activeCampaigns === 2, "Restricted user should only see scoped campaigns");
  assert(result.kpis.periodSpend === null, "Restricted user without spend permission should not see spend");
  assert(result.byCreative.length === 0 && result.byAgency.length === 0, "Spend-restricted user should not receive distributions");

  return result;
}

function main() {
  const admin = runAdminScenario();
  const restricted = runRestrictedScenario();

  console.log("✅ Dashboard verification passed.");
  console.log(`Admin campaigns: ${admin.kpis.activeCampaigns}`);
  console.log(`Restricted campaigns: ${restricted.kpis.activeCampaigns}`);
}

main();

