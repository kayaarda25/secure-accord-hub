import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Globe, MoreHorizontal, Inbox } from "lucide-react";

interface Organization {
  id: string;
  name: string;
  type: string;
  country: string | null;
  status: string | null;
}

export function PartnerOverview() {
  const [partners, setPartners] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPartners();
  }, []);

  const fetchPartners = async () => {
    try {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .in("type", ["partner", "authority"])
        .order("name")
        .limit(5);

      if (error) throw error;
      setPartners(data || []);
    } catch (error) {
      console.error("Error fetching partners:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "active":
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded status-success">
            Active
          </span>
        );
      case "pending":
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded status-warning">
            Pending
          </span>
        );
      case "inactive":
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded status-info">
            Inactive
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded status-info">
            {status || "-"}
          </span>
        );
    }
  };

  return (
    <div className="card-state p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">Partners & Authorities</h3>
        <button className="text-sm text-accent hover:text-accent/80 transition-colors">
          All Partners
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : partners.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            No partners or authorities available
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Partner
                </th>
                <th className="text-left py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                  Country
                </th>
                <th className="text-left py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {partners.map((partner, index) => (
                <tr
                  key={partner.id}
                  className="table-row-state animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        {partner.type === "authority" ? (
                          <Globe size={14} className="text-muted-foreground" />
                        ) : (
                          <Building2 size={14} className="text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {partner.name}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {partner.type === "authority" ? "Authority" : "Partner"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 hidden md:table-cell">
                    <span className="text-sm text-muted-foreground">
                      {partner.country || "-"}
                    </span>
                  </td>
                  <td className="py-3">{getStatusBadge(partner.status)}</td>
                  <td className="py-3">
                    <button className="p-1 rounded hover:bg-muted text-muted-foreground">
                      <MoreHorizontal size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
