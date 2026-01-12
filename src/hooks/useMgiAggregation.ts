import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationPermissions } from "./useOrganizationPermissions";

interface Organization {
  id: string;
  name: string;
  org_type: string | null;
}

interface AggregatedOrg {
  id: string;
  name: string;
  isAggregate: boolean;
  originalIds?: string[];
}

/**
 * Hook for Gateway users to see MGI M and MGI C as a single "MGI" entity.
 * For non-Gateway users, organizations are returned as-is.
 */
export function useMgiAggregation() {
  const { permissions } = useOrganizationPermissions();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [aggregatedOrgs, setAggregatedOrgs] = useState<AggregatedOrg[]>([]);
  const [mgiOrgIds, setMgiOrgIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchOrganizations() {
      setIsLoading(true);
      try {
        const { data: orgsData } = await supabase
          .from("organizations")
          .select("id, name, org_type")
          .order("name");

        if (orgsData) {
          setOrganizations(orgsData as Organization[]);

          // For Gateway users, aggregate MGI M and MGI C into "MGI"
          if (permissions.isGateway) {
            const mgiOrgs = orgsData.filter(
              (org) => org.org_type === "mgi_media" || org.org_type === "mgi_communications"
            );
            const gatewayOrg = orgsData.find((org) => org.org_type === "gateway");
            const otherOrgs = orgsData.filter(
              (org) =>
                org.org_type !== "mgi_media" &&
                org.org_type !== "mgi_communications" &&
                org.org_type !== "gateway"
            );

            const mgiIds = mgiOrgs.map((org) => org.id);
            setMgiOrgIds(mgiIds);

            const aggregated: AggregatedOrg[] = [];

            // Add combined MGI if there are MGI orgs
            if (mgiOrgs.length > 0) {
              aggregated.push({
                id: "mgi-combined",
                name: "MGI",
                isAggregate: true,
                originalIds: mgiIds,
              });
            }

            // Add Gateway
            if (gatewayOrg) {
              aggregated.push({
                id: gatewayOrg.id,
                name: "Gateway",
                isAggregate: false,
              });
            }

            // Add other orgs
            otherOrgs.forEach((org) => {
              aggregated.push({
                id: org.id,
                name: org.name,
                isAggregate: false,
              });
            });

            setAggregatedOrgs(aggregated);
          } else {
            // For non-Gateway users, just use organizations as-is
            setAggregatedOrgs(
              orgsData.map((org) => ({
                id: org.id,
                name: getOrgDisplayName(org),
                isAggregate: false,
              }))
            );
            setMgiOrgIds([]);
          }
        }
      } catch (error) {
        console.error("Error fetching organizations:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchOrganizations();
  }, [permissions.isGateway]);

  const getOrgDisplayName = (org: Organization): string => {
    if (org.org_type === "mgi_media") return "MGI Media";
    if (org.org_type === "mgi_communications") return "MGI Communications";
    if (org.org_type === "gateway") return "Gateway";
    return org.name;
  };

  /**
   * For Gateway users viewing OPEX/data, filter by MGI org IDs
   * when the aggregated "MGI" is selected.
   */
  const getFilterOrgIds = useCallback(
    (selectedAggregatedId: string): string[] => {
      if (selectedAggregatedId === "mgi-combined" && permissions.isGateway) {
        return mgiOrgIds;
      }
      return [selectedAggregatedId];
    },
    [mgiOrgIds, permissions.isGateway]
  );

  /**
   * Get the display name for an organization, with MGI aggregation for Gateway.
   */
  const getDisplayNameForOrg = useCallback(
    (orgId: string | null): string => {
      if (!orgId) return "–";

      const org = organizations.find((o) => o.id === orgId);
      if (!org) return "–";

      // For Gateway users, show "MGI" for both MGI M and MGI C
      if (permissions.isGateway && (org.org_type === "mgi_media" || org.org_type === "mgi_communications")) {
        return "MGI";
      }

      return getOrgDisplayName(org);
    },
    [organizations, permissions.isGateway]
  );

  /**
   * Check if an organization belongs to MGI (for aggregation purposes).
   */
  const isMgiOrg = useCallback(
    (orgId: string): boolean => {
      return mgiOrgIds.includes(orgId);
    },
    [mgiOrgIds]
  );

  return {
    organizations,
    aggregatedOrgs,
    mgiOrgIds,
    isLoading,
    getFilterOrgIds,
    getDisplayNameForOrg,
    isMgiOrg,
    isGatewayUser: permissions.isGateway,
  };
}
