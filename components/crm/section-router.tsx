"use client";

import { useMemo, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import type { WorkspacePreferences } from "@/types";
import { Card, CardContent } from "@/components/ui/card";

import { DashboardSection } from "./dashboard-section";
import { OpportunitiesSection } from "./opportunities-section";
import { EventsSection } from "./events-section";
import { CompaniesSection } from "./companies-section";
import { PeopleSection } from "./people-section";
import { LeadsSection } from "./leads-section";
import { DealsSection } from "./deals-section";
import { SequenceSection } from "./sequence-section";
import { AutomationSection } from "./automation-section";
import { AnalyticsSection } from "./analytics-section";
import { IntegrationsSection } from "./integrations-section";
import { DeliverabilitySection } from "./deliverability-section";
import { TeamSection } from "./team-section";
import { SettingsSection } from "./settings-section";
import { ProfileSection } from "./profile-section";
import { BillingSection } from "./billing-section";
import { AuditLogSection } from "./audit-log-board";

function SectionFallback({ title }: { title: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20"
    >
      <Card className="max-w-md w-full border-border/60">
        <CardContent className="flex items-center gap-4 p-6">
          <div className="rounded-xl bg-muted/10 p-2.5">
            <AlertCircle className="size-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold">{title}</p>
            <p className="text-sm text-muted-foreground">
              This section is not available or the route was not recognized.
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface Props {
  slug?: string[];
}

export function AppSectionRouter({ slug }: Props) {
  const section = slug?.[0] || "dashboard";
  const sub = slug?.[1];

  const [preferences, setPreferences] = useState<WorkspacePreferences | undefined>();

  useEffect(() => {
    fetch("/api/settings/localization")
      .then((res) => res.json())
      .then((data) => setPreferences(data.preferences))
      .catch(() => { });
  }, []);

  return useMemo(() => {
    if (section === "dashboard") return <DashboardSection />;
    if (section === "opportunities") return <OpportunitiesSection />;
    if (section === "events") return <EventsSection eventId={sub} preferences={preferences} />;
    if (section === "target-events") return <EventsSection eventId={sub} preferences={preferences} mode="target" />;
    if (section === "companies") return <CompaniesSection />;
    if (section === "people") return <PeopleSection />;
    if (section === "leads") return <LeadsSection />;
    if (section === "deals") return <DealsSection />;
    if (section === "sequences") return <SequenceSection />;
    if (section === "automation") return <AutomationSection />;
    if (section === "analytics") return <AnalyticsSection />;
    if (section === "integrations") return <IntegrationsSection />;
    if (section === "deliverability") return <DeliverabilitySection />;
    if (section === "team") return <TeamSection />;
    if (section === "settings") return <SettingsSection />;
    if (section === "profile") return <ProfileSection />;
    if (section === "billing") return <BillingSection />;
    if (section === "audit-log") return <AuditLogSection />;
    return <SectionFallback title="Unknown route" />;
  }, [section, sub, preferences]);
}
