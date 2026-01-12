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
  CheckCircle,
  AlertTriangle,
  XCircle,
  Lock,
  PenTool,
  Clock,
  Loader2,
  X,
  Users,
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAuditLog } from "@/hooks/useAuditLog";

interface Profile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  organization_id: string | null;
}

interface Document {
  id: string;
  name: string;
  type: string;
  file_path: string;
  file_size: number | null;
  description: string | null;
  expires_at: string | null;
  uploaded_by: string;
  created_at: string;
  signatures?: DocumentSignature[];
  uploader?: Profile;
}

interface DocumentSignature {
  id: string;
  document_id: string;
  signer_id: string;
  requested_by: string;
  status: string;
  signed_at: string | null;
  signer?: Profile;
}

const folders = [
  { name: "Contracts", count: 0, icon: FileText, type: "contract" },
  { name: "Licenses", count: 0, icon: Lock, type: "license" },
  { name: "Reports", count: 0, icon: FileText, type: "report" },
  { name: "Other", count: 0, icon: Folder, type: "other" },
];

export default function Documents() {
  const { user } = useAuth();
  const { logAction } = useAuditLog();
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    type: "contract",
    description: "",
    expires_at: "",
    signers: [] as string[],
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch all profiles first for lookups and signer selection
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_active", true);

      if (profilesData) {
        setProfiles(profilesData as Profile[]);
      }

      // Fetch documents with signatures
      const { data: docsData } = await supabase
        .from("documents")
        .select(`
          *,
          signatures:document_signatures(*)
        `)
        .order("created_at", { ascending: false });

      if (docsData && profilesData) {
        // Map profiles to documents and signatures
        const profileMap = new Map(profilesData.map(p => [p.user_id, p]));
        
        const docsWithProfiles = docsData.map(doc => ({
          ...doc,
          uploader: profileMap.get(doc.uploaded_by) || null,
          signatures: (doc.signatures || []).map((sig: { signer_id: string }) => ({
            ...sig,
            signer: profileMap.get(sig.signer_id) || null,
          })),
        }));
        
        setDocuments(docsWithProfiles as unknown as Document[]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedFile) return;

    setIsSubmitting(true);
    try {
      // Upload file to storage
      const filePath = `${user.id}/${Date.now()}_${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // Create document record
      const { data: docData, error: docError } = await supabase
        .from("documents")
        .insert({
          name: formData.name || selectedFile.name,
          type: formData.type,
          file_path: filePath,
          file_size: selectedFile.size,
          mime_type: selectedFile.type,
          description: formData.description || null,
          expires_at: formData.expires_at || null,
          uploaded_by: user.id,
        })
        .select()
        .single();

      if (docError) throw docError;

      // Create signature requests
      if (formData.signers.length > 0 && docData) {
        const signatureRequests = formData.signers.map((signerId) => ({
          document_id: docData.id,
          signer_id: signerId,
          requested_by: user.id,
          status: "pending",
        }));

        await supabase.from("document_signatures").insert(signatureRequests);
      }

      await logAction("CREATE", "documents", docData?.id);

      // Reset form
      setFormData({
        name: "",
        type: "contract",
        description: "",
        expires_at: "",
        signers: [],
      });
      setSelectedFile(null);
      setShowUploadModal(false);
      fetchData();
    } catch (error) {
      console.error("Error uploading document:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSign = async (signatureId: string) => {
    if (!user) return;

    try {
      await supabase
        .from("document_signatures")
        .update({
          status: "signed",
          signed_at: new Date().toISOString(),
        })
        .eq("id", signatureId);

      await logAction("SIGN", "document_signatures", signatureId);
      fetchData();
    } catch (error) {
      console.error("Error signing document:", error);
    }
  };

  const handleReject = async (signatureId: string) => {
    if (!user) return;

    try {
      await supabase
        .from("document_signatures")
        .update({
          status: "rejected",
          rejected_at: new Date().toISOString(),
        })
        .eq("id", signatureId);

      await logAction("REJECT", "document_signatures", signatureId);
      fetchData();
    } catch (error) {
      console.error("Error rejecting signature:", error);
    }
  };

  const toggleSigner = (userId: string) => {
    setFormData((prev) => ({
      ...prev,
      signers: prev.signers.includes(userId)
        ? prev.signers.filter((id) => id !== userId)
        : [...prev.signers, userId],
    }));
  };

  const getDocumentStatus = (doc: Document) => {
    const signatures = doc.signatures || [];
    const pendingCount = signatures.filter((s) => s.status === "pending").length;
    const signedCount = signatures.filter((s) => s.status === "signed").length;
    const rejectedCount = signatures.filter((s) => s.status === "rejected").length;

    if (rejectedCount > 0) return "rejected";
    if (signatures.length === 0) return "valid";
    if (pendingCount > 0) return "pending";
    if (signedCount === signatures.length) return "signed";
    return "valid";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "valid":
      case "signed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded status-success">
            <CheckCircle size={12} />
            {status === "signed" ? "Signed" : "Valid"}
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded status-warning">
            <Clock size={12} />
            Signature Pending
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded status-critical">
            <XCircle size={12} />
            Rejected
          </span>
        );
      case "expiring":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded status-warning animate-pulse-slow">
            <AlertTriangle size={12} />
            Expiring
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "–";
    return new Date(dateStr).toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "–";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "contract": return "Contract";
      case "license": return "License";
      case "report": return "Report";
      default: return "Other";
    }
  };

  // Filter documents
  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !selectedType || doc.type === selectedType;
    return matchesSearch && matchesType;
  });

  // Count documents per folder
  const folderCounts = folders.map((folder) => ({
    ...folder,
    count: documents.filter((d) => d.type === folder.type).length,
  }));

  // Get pending signatures for current user
  const pendingSignatures = documents
    .flatMap((doc) => 
      (doc.signatures || [])
        .filter((sig) => sig.signer_id === user?.id && sig.status === "pending")
        .map((sig) => ({ ...sig, document: doc }))
    );

  if (isLoading) {
    return (
      <Layout title="Contracts & Documents" subtitle="Document Management and Archive">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Contracts & Documents" subtitle="Document Management and Archive">
      {/* Pending Signatures Alert */}
      {pendingSignatures.length > 0 && (
        <div className="mb-6 p-4 bg-warning/10 border border-warning/30 rounded-lg">
          <div className="flex items-center gap-3 mb-3">
            <PenTool className="text-warning" size={20} />
            <span className="font-medium text-foreground">
              {pendingSignatures.length} document(s) awaiting your signature
            </span>
          </div>
          <div className="space-y-2">
            {pendingSignatures.map((sig) => (
              <div
                key={sig.id}
                className="flex items-center justify-between p-3 bg-background rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <FileText size={16} className="text-muted-foreground" />
                  <span className="text-sm font-medium">{sig.document.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSign(sig.id)}
                    className="px-3 py-1.5 bg-success text-success-foreground rounded text-sm font-medium hover:bg-success/90 transition-colors flex items-center gap-1"
                  >
                    <CheckCircle size={14} />
                    Sign
                  </button>
                  <button
                    onClick={() => handleReject(sig.id)}
                    className="px-3 py-1.5 bg-destructive text-destructive-foreground rounded text-sm font-medium hover:bg-destructive/90 transition-colors flex items-center gap-1"
                  >
                    <XCircle size={14} />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-muted rounded-lg text-sm text-foreground border-0 focus:ring-2 focus:ring-accent w-64"
            />
          </div>
          {selectedType && (
            <button
              onClick={() => setSelectedType(null)}
              className="px-3 py-2 bg-accent/10 text-accent rounded-lg text-sm font-medium flex items-center gap-2"
            >
              {getTypeLabel(selectedType)}
              <X size={14} />
            </button>
          )}
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
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-2 glow-gold"
          >
            <Upload size={16} />
            Upload
          </button>
        </div>
      </div>

      {/* Folders */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {folderCounts.map((folder, index) => (
          <button
            key={folder.name}
            onClick={() => setSelectedType(selectedType === folder.type ? null : folder.type)}
            className={`card-state p-4 text-left transition-colors animate-fade-in ${
              selectedType === folder.type ? "ring-2 ring-accent" : "hover:bg-muted/30"
            }`}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <folder.icon size={20} className="text-accent" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{folder.name}</p>
                <p className="text-xs text-muted-foreground">{folder.count} files</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Documents Table */}
      <div className="card-state">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Current Documents</h3>
          <span className="text-sm text-muted-foreground">
            {filteredDocuments.length} documents
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Document
                </th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                  Type
                </th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                  Signatures
                </th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                  Valid Until
                </th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {filteredDocuments.map((doc, index) => (
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
                          {formatFileSize(doc.file_size)} • {formatDate(doc.created_at)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 hidden md:table-cell">
                    <span className="badge-gold">{getTypeLabel(doc.type)}</span>
                  </td>
                  <td className="p-4 hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {(doc.signatures || []).map((sig) => (
                        <span
                          key={sig.id}
                          className={`px-2 py-0.5 text-xs rounded flex items-center gap-1 ${
                            sig.status === "signed"
                              ? "bg-success/10 text-success"
                              : sig.status === "rejected"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {sig.status === "signed" && <CheckCircle size={10} />}
                          {sig.status === "rejected" && <XCircle size={10} />}
                          {sig.status === "pending" && <Clock size={10} />}
                          {sig.signer?.first_name} {sig.signer?.last_name}
                        </span>
                      ))}
                      {(!doc.signatures || doc.signatures.length === 0) && (
                        <span className="text-xs text-muted-foreground">–</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">{getStatusBadge(getDocumentStatus(doc))}</td>
                  <td className="p-4 hidden md:table-cell text-sm text-muted-foreground">
                    {formatDate(doc.expires_at)}
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
              {filteredDocuments.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No documents available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="card-state w-full max-w-2xl p-6 animate-fade-in my-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  Upload Document
                </h2>
                <p className="text-sm text-muted-foreground">
                  Upload a document and select signers.
                </p>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X size={20} className="text-muted-foreground" />
              </button>
            </div>

            <form onSubmit={handleUpload} className="space-y-6">
              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                  File *
                </label>
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-accent/50 transition-colors cursor-pointer">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setSelectedFile(file);
                        if (!formData.name) {
                          setFormData({ ...formData, name: file.name });
                        }
                      }
                    }}
                    className="hidden"
                    id="doc-upload"
                  />
                  <label htmlFor="doc-upload" className="cursor-pointer">
                    {selectedFile ? (
                      <div className="flex items-center justify-center gap-2 text-accent">
                        <FileText size={24} />
                        <div className="text-left">
                          <p className="text-sm font-medium">{selectedFile.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(selectedFile.size)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Upload size={32} className="mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                          PDF, Word, Excel (max. 50MB)
                        </p>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {/* Document Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                    Document Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="e.g. Cooperation Agreement 2025"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                    Document Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="contract">Contract</option>
                    <option value="license">License</option>
                    <option value="report">Report</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                  Valid Until
                </label>
                <input
                  type="date"
                  value={formData.expires_at}
                  onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                  rows={2}
                  placeholder="Additional information about the document..."
                />
              </div>

              {/* Signer Selection */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                  <Users size={16} />
                  Select Signers
                </label>
                <p className="text-xs text-muted-foreground mb-3">
                  Select people who need to sign this document.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                  {profiles
                    .filter((p) => p.user_id !== user?.id)
                    .map((profile) => (
                      <button
                        key={profile.user_id}
                        type="button"
                        onClick={() => toggleSigner(profile.user_id)}
                        className={`p-3 rounded-lg border text-left transition-all flex items-center gap-3 ${
                          formData.signers.includes(profile.user_id)
                            ? "border-accent bg-accent/10 ring-2 ring-accent"
                            : "border-border bg-muted hover:border-accent/50"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-medium text-sm">
                          {profile.first_name?.[0] || profile.email[0].toUpperCase()}
                          {profile.last_name?.[0] || ""}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {profile.first_name} {profile.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {profile.email}
                          </p>
                        </div>
                        {formData.signers.includes(profile.user_id) && (
                          <CheckCircle size={16} className="text-accent flex-shrink-0" />
                        )}
                      </button>
                    ))}
                </div>
                {formData.signers.length > 0 && (
                  <p className="text-xs text-accent mt-2">
                    {formData.signers.length} person(s) selected
                  </p>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="flex-1 py-2.5 bg-muted text-foreground rounded-lg font-medium hover:bg-muted/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedFile}
                  className="flex-1 py-2.5 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  <Upload size={16} />
                  Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
