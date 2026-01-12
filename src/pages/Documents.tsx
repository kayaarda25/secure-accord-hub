import { Layout } from "@/components/layout/Layout";
import {
  FileText,
  Folder,
  Upload,
  Search,
  Filter,
  Grid,
  List,
  MoreHorizontal,
  Download,
  Eye,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Lock,
} from "lucide-react";
import { useState } from "react";

const folders = [
  { name: "Verträge", count: 24, icon: FileText },
  { name: "Lizenzen", count: 8, icon: Lock },
  { name: "Finanzberichte", count: 36, icon: FileText },
  { name: "Behörden", count: 12, icon: Folder },
];

const documents = [
  {
    id: 1,
    name: "Kooperationsvertrag_Phase_II_v3.pdf",
    type: "Vertrag",
    size: "2.4 MB",
    modified: "2024-10-18",
    status: "valid",
    signedBy: ["MGI AG", "URA"],
    expiresAt: "2025-12-31",
  },
  {
    id: 2,
    name: "Lizenz_Telekom_Uganda_2024.pdf",
    type: "Lizenz",
    size: "1.8 MB",
    modified: "2024-10-15",
    status: "expiring",
    signedBy: ["Ministry of ICT"],
    expiresAt: "2024-10-28",
  },
  {
    id: 3,
    name: "Finanzbericht_Q3_2024.xlsx",
    type: "Bericht",
    size: "4.2 MB",
    modified: "2024-10-10",
    status: "valid",
    signedBy: ["CFO"],
    expiresAt: null,
  },
  {
    id: 4,
    name: "NDA_Airtel_Africa.pdf",
    type: "Vertrag",
    size: "890 KB",
    modified: "2024-10-05",
    status: "valid",
    signedBy: ["MGI AG", "Airtel Africa"],
    expiresAt: "2026-03-15",
  },
  {
    id: 5,
    name: "Audit_Report_2024.pdf",
    type: "Bericht",
    size: "5.6 MB",
    modified: "2024-09-28",
    status: "valid",
    signedBy: ["KPMG"],
    expiresAt: null,
  },
];

export default function Documents() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "valid":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded status-success">
            <CheckCircle size={12} />
            Gültig
          </span>
        );
      case "expiring":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded status-warning animate-pulse-slow">
            <AlertTriangle size={12} />
            Läuft ab
          </span>
        );
      case "expired":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded status-critical">
            <XCircle size={12} />
            Abgelaufen
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "–";
    return new Date(dateStr).toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <Layout title="Verträge & Dokumente" subtitle="Dokumentenverwaltung und Archiv">
      {/* Action Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              placeholder="Dokumente suchen..."
              className="pl-10 pr-4 py-2 bg-muted rounded-lg text-sm text-foreground border-0 focus:ring-2 focus:ring-accent w-64"
            />
          </div>
          <button className="px-4 py-2 bg-muted rounded-lg text-sm font-medium text-foreground hover:bg-muted/80 transition-colors flex items-center gap-2">
            <Filter size={16} />
            Filter
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-muted rounded-lg p-1">
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded ${
                viewMode === "list" ? "bg-background text-foreground" : "text-muted-foreground"
              }`}
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded ${
                viewMode === "grid" ? "bg-background text-foreground" : "text-muted-foreground"
              }`}
            >
              <Grid size={16} />
            </button>
          </div>
          <button className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-2 glow-gold">
            <Upload size={16} />
            Hochladen
          </button>
        </div>
      </div>

      {/* Folders */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {folders.map((folder, index) => (
          <button
            key={folder.name}
            className="card-state p-4 text-left hover:bg-muted/30 transition-colors animate-fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <folder.icon size={20} className="text-accent" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{folder.name}</p>
                <p className="text-xs text-muted-foreground">{folder.count} Dateien</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Documents Table */}
      <div className="card-state">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Aktuelle Dokumente</h3>
          <span className="text-sm text-muted-foreground">
            {documents.length} Dokumente
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Dokument
                </th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                  Typ
                </th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                  Unterzeichnet von
                </th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                  Gültig bis
                </th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc, index) => (
                <tr
                  key={doc.id}
                  className="table-row-state animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        <FileText size={16} className="text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground truncate max-w-[200px]">
                          {doc.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {doc.size} • {formatDate(doc.modified)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 hidden md:table-cell">
                    <span className="badge-gold">{doc.type}</span>
                  </td>
                  <td className="p-4 hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {doc.signedBy.map((signer) => (
                        <span
                          key={signer}
                          className="px-2 py-0.5 text-xs bg-muted rounded text-muted-foreground"
                        >
                          {signer}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-4">{getStatusBadge(doc.status)}</td>
                  <td className="p-4 hidden md:table-cell text-sm text-muted-foreground">
                    {formatDate(doc.expiresAt)}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1">
                      <button className="p-2 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                        <Eye size={16} />
                      </button>
                      <button className="p-2 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                        <Download size={16} />
                      </button>
                      <button className="p-2 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                        <MoreHorizontal size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
