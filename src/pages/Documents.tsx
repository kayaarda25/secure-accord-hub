import { Layout } from "@/components/layout/Layout";
import {
  FileText,
  Folder,
  Upload,
  Search,
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
  Building2,
  Share2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAuditLog } from "@/hooks/useAuditLog";
import { toast } from "sonner";
import { SignatureDisplay } from "@/components/documents/SignatureDisplay";
import { DocumentDetailDialog } from "@/components/documents/DocumentDetailDialog";
import { SignaturePositionSelector, SignaturePosition } from "@/components/documents/SignaturePositionSelector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Profile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  organization_id: string | null;
  signature_data?: string | null;
  signature_type?: string | null;
  signature_initials?: string | null;
}

interface Organization {
  id: string;
  name: string;
  org_type: string | null;
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
  signature_image: string | null;
  signature_position?: string | null;
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
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  
  // Signature position selector state
  const [showPositionSelector, setShowPositionSelector] = useState(false);
  const [pendingSignAction, setPendingSignAction] = useState<{
    type: 'self' | 'pending';
    documentId?: string;
    signatureId?: string;
    documentName?: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    type: "contract",
    description: "",
    expires_at: "",
    signers: [] as string[],
    sharedWithOrgs: [] as string[],
    sharedWithUsers: [] as string[],
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
        .select("*, signature_data, signature_type, signature_initials")
        .eq("is_active", true);

      if (profilesData) {
        setProfiles(profilesData as Profile[]);
      }

      // Fetch organizations for sharing
      const { data: orgsData } = await supabase
        .from("organizations")
        .select("id, name, org_type")
        .order("name");

      if (orgsData) {
        setOrganizations(orgsData as Organization[]);
      }

      // Fetch documents with signatures - only documents without folder_id (not in Explorer)
      // OR documents that have signature requests
      const { data: docsData } = await supabase
        .from("documents")
        .select(`
          *,
          signatures:document_signatures(*, signature_image, signature_position)
        `)
        .is("folder_id", null)
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

      // Create signature requests and send email notifications
      if (formData.signers.length > 0 && docData) {
        const signatureRequests = formData.signers.map((signerId) => ({
          document_id: docData.id,
          signer_id: signerId,
          requested_by: user.id,
          status: "pending",
        }));

        const { error: signaturesError } = await supabase
          .from("document_signatures")
          .insert(signatureRequests);

        if (signaturesError) throw signaturesError;

        // Get current user's profile for requester name
        const currentUserProfile = profiles.find(p => p.user_id === user.id);
        const requesterName = currentUserProfile 
          ? `${currentUserProfile.first_name || ''} ${currentUserProfile.last_name || ''}`.trim() || currentUserProfile.email
          : user.email || 'Ein Benutzer';

        // Send email notifications to each signer
        for (const signerId of formData.signers) {
          const signerProfile = profiles.find(p => p.user_id === signerId);
          if (signerProfile) {
            try {
              await supabase.functions.invoke('send-signature-request', {
                body: {
                  signerEmail: signerProfile.email,
                  signerName: `${signerProfile.first_name || ''} ${signerProfile.last_name || ''}`.trim(),
                  documentName: formData.name || selectedFile.name,
                  requesterName,
                  documentUrl: `${window.location.origin}/documents`,
                },
              });
            } catch (emailError) {
              console.error('Error sending signature request email:', emailError);
              // Continue even if email fails
            }
          }
        }
      }

      // Create document shares for organizations
      if (formData.sharedWithOrgs.length > 0 && docData) {
        const orgShares = formData.sharedWithOrgs.map((orgId) => ({
          document_id: docData.id,
          shared_with_organization_id: orgId,
          shared_by: user.id,
        }));
        await supabase.from("document_shares").insert(orgShares);
      }

      // Create document shares for individual users
      if (formData.sharedWithUsers.length > 0 && docData) {
        const userShares = formData.sharedWithUsers.map((userId) => ({
          document_id: docData.id,
          shared_with_user_id: userId,
          shared_by: user.id,
        }));
        await supabase.from("document_shares").insert(userShares);
      }

      await logAction("CREATE", "documents", docData?.id);

      toast.success(
        formData.signers.length > 0
          ? "Document uploaded and signature requests sent"
          : "Document uploaded"
      );

      // Reset form
      setFormData({
        name: "",
        type: "contract",
        description: "",
        expires_at: "",
        signers: [],
        sharedWithOrgs: [],
        sharedWithUsers: [],
      });
      setSelectedFile(null);
      setShowUploadModal(false);
      fetchData();
    } catch (error) {
      console.error("Error uploading document:", error);
      toast.error("Upload failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDocument = async (doc: Document, download = false) => {
    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(doc.file_path, 60);

      if (error) throw error;
      if (!data?.signedUrl) throw new Error("Could not create access link");

      if (download) {
        const a = document.createElement("a");
        a.href = data.signedUrl;
        a.download = doc.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }

      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Error opening document:", error);
      toast.error("Failed to open document");
    }
  };

  const getUserSignatureImage = async (): Promise<string | null> => {
    const userProfile = profiles.find((p) => p.user_id === user?.id);
    if (!userProfile) return null;

    if (userProfile.signature_type === "image" && userProfile.signature_data) {
      // Check if it's already a base64 data URL (old format)
      if (userProfile.signature_data.startsWith("data:image")) {
        return userProfile.signature_data;
      }
      // Otherwise, get signed URL from storage (new format)
      const { data, error } = await supabase.storage
        .from("signatures")
        .createSignedUrl(userProfile.signature_data, 86400); // 24 hours
      if (error) {
        console.error("Error getting signature URL:", error);
        return null;
      }
      return data?.signedUrl || null;
    }
    if (userProfile.signature_type === "text" && userProfile.signature_initials) {
      // For text signatures, we'll store the initials prefixed with "text:"
      return `text:${userProfile.signature_initials}`;
    }
    // Fallback: generate initials
    const first = userProfile.first_name?.[0] || "";
    const last = userProfile.last_name?.[0] || "";
    return `text:${first}.${last}`.toUpperCase();
  };

  // Get user's signature preview for the position selector
  const getUserSignaturePreview = async (): Promise<{ image: string | null; initials: string | null }> => {
    const userProfile = profiles.find((p) => p.user_id === user?.id);
    if (!userProfile) return { image: null, initials: null };

    if (userProfile.signature_type === "image" && userProfile.signature_data) {
      // Check if it's already a base64 data URL (old format)
      if (userProfile.signature_data.startsWith("data:image")) {
        return { image: userProfile.signature_data, initials: null };
      }
      // Otherwise, get signed URL from storage (new format)
      const { data } = await supabase.storage
        .from("signatures")
        .createSignedUrl(userProfile.signature_data, 86400);
      return { image: data?.signedUrl || null, initials: null };
    }
    if (userProfile.signature_type === "text" && userProfile.signature_initials) {
      return { image: null, initials: userProfile.signature_initials };
    }
    const first = userProfile.first_name?.[0] || "";
    const last = userProfile.last_name?.[0] || "";
    return { image: null, initials: `${first}.${last}`.toUpperCase() };
  };

  // Open position selector for self-sign
  const openSelfSignSelector = async (doc: Document) => {
    setPendingSignAction({
      type: 'self',
      documentId: doc.id,
      documentName: doc.name,
    });
    setShowPositionSelector(true);
  };

  // Open position selector for pending signature
  const openSignSelector = async (signatureId: string, documentName: string) => {
    setPendingSignAction({
      type: 'pending',
      signatureId,
      documentName,
    });
    setShowPositionSelector(true);
  };

  // Execute signing with selected position
  const handleSignWithPosition = async (position: SignaturePosition) => {
    if (!user || !pendingSignAction) return;

    const signatureImage = await getUserSignatureImage();

    try {
      if (pendingSignAction.type === 'self' && pendingSignAction.documentId) {
        const { error } = await supabase.from("document_signatures").insert({
          document_id: pendingSignAction.documentId,
          signer_id: user.id,
          requested_by: user.id,
          status: "signed",
          signed_at: new Date().toISOString(),
          signature_image: signatureImage,
          signature_position: position,
        });

        if (error) throw error;
        await logAction("SIGN", "document_signatures", pendingSignAction.documentId);
      } else if (pendingSignAction.type === 'pending' && pendingSignAction.signatureId) {
        const { error } = await supabase
          .from("document_signatures")
          .update({
            status: "signed",
            signed_at: new Date().toISOString(),
            signature_image: signatureImage,
            signature_position: position,
          })
          .eq("id", pendingSignAction.signatureId)
          .eq("signer_id", user.id);

        if (error) throw error;
        await logAction("SIGN", "document_signatures", pendingSignAction.signatureId);
      }

      toast.success("Dokument signiert");
      setPendingSignAction(null);
      fetchData();
    } catch (error) {
      console.error("Error signing document:", error);
      toast.error("Signieren fehlgeschlagen");
    }
  };

  // Legacy handlers (kept for backwards compatibility, now open selector)
  const handleSelfSign = async (documentId: string) => {
    const doc = documents.find(d => d.id === documentId);
    if (doc) {
      openSelfSignSelector(doc);
    }
  };

  const handleSign = async (signatureId: string) => {
    const sig = documents.flatMap(d => d.signatures || []).find(s => s.id === signatureId);
    const doc = documents.find(d => d.signatures?.some(s => s.id === signatureId));
    if (sig && doc) {
      openSignSelector(signatureId, doc.name);
    }
  };

  const handleReject = async (signatureId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("document_signatures")
        .update({
          status: "rejected",
          rejected_at: new Date().toISOString(),
        })
        .eq("id", signatureId)
        .eq("signer_id", user.id);

      if (error) throw error;

      toast.success("Signature rejected");
      await logAction("REJECT", "document_signatures", signatureId);
      fetchData();
    } catch (error) {
      console.error("Error rejecting signature:", error);
      toast.error("Reject failed");
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

  const toggleSharedOrg = (orgId: string) => {
    setFormData((prev) => ({
      ...prev,
      sharedWithOrgs: prev.sharedWithOrgs.includes(orgId)
        ? prev.sharedWithOrgs.filter((id) => id !== orgId)
        : [...prev.sharedWithOrgs, orgId],
    }));
  };

  const toggleSharedUser = (userId: string) => {
    setFormData((prev) => ({
      ...prev,
      sharedWithUsers: prev.sharedWithUsers.includes(userId)
        ? prev.sharedWithUsers.filter((id) => id !== userId)
        : [...prev.sharedWithUsers, userId],
    }));
  };

  // Get display name for organization
  const getOrgDisplayName = (org: Organization) => {
    if (org.org_type === "mgi_media") return "MGI Media";
    if (org.org_type === "mgi_communications") return "MGI Communications";
    if (org.org_type === "gateway") return "Gateway";
    return org.name;
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

      {/* Tabs */}
      <Tabs defaultValue="documents" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <FileText size={16} />
            Documents
          </TabsTrigger>
          <TabsTrigger value="signatures" className="flex items-center gap-2">
            <PenTool size={16} />
            Signatures
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents">
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
                  className="table-row-state animate-fade-in cursor-pointer"
                  style={{ animationDelay: `${index * 50}ms` }}
                  onClick={() => {
                    setSelectedDocument(doc);
                    setShowDetailDialog(true);
                  }}
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
                      <button
                        onClick={() => openDocument(doc)}
                        className="p-2 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="View"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => openDocument(doc, true)}
                        className="p-2 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Download"
                      >
                        <Download size={16} />
                      </button>

                      {(() => {
                        const myPending = (doc.signatures || []).find(
                          (s) => s.signer_id === user?.id && s.status === "pending"
                        );
                        const canSelfSign =
                          doc.uploaded_by === user?.id && (!doc.signatures || doc.signatures.length === 0);

                        if (myPending) {
                          return (
                            <button
                              onClick={() => handleSign(myPending.id)}
                              className="p-2 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="Sign"
                            >
                              <PenTool size={16} />
                            </button>
                          );
                        }

                        if (canSelfSign) {
                          return (
                            <button
                              onClick={() => handleSelfSign(doc.id)}
                              className="p-2 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="Sign"
                            >
                              <PenTool size={16} />
                            </button>
                          );
                        }

                        return null;
                      })()}

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

              {/* Document Sharing */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                  <Share2 size={16} />
                  Share Document
                </label>
                <p className="text-xs text-muted-foreground mb-3">
                  Select organizations and/or specific users who can view this document.
                </p>
                
                {/* Organization Sharing */}
                <div className="mb-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <Building2 size={12} />
                    Organizations
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {organizations.map((org) => (
                      <button
                        key={org.id}
                        type="button"
                        onClick={() => toggleSharedOrg(org.id)}
                        className={`px-3 py-1.5 rounded-lg border text-sm transition-all flex items-center gap-2 ${
                          formData.sharedWithOrgs.includes(org.id)
                            ? "border-accent bg-accent/10 text-accent"
                            : "border-border bg-muted text-muted-foreground hover:border-accent/50"
                        }`}
                      >
                        <Building2 size={14} />
                        {getOrgDisplayName(org)}
                        {formData.sharedWithOrgs.includes(org.id) && (
                          <CheckCircle size={12} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* User Sharing */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <Users size={12} />
                    Specific Users (optional)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto p-1">
                    {profiles
                      .filter((p) => p.user_id !== user?.id && !formData.signers.includes(p.user_id))
                      .map((profile) => (
                        <button
                          key={profile.user_id}
                          type="button"
                          onClick={() => toggleSharedUser(profile.user_id)}
                          className={`p-2 rounded-lg border text-left transition-all flex items-center gap-2 ${
                            formData.sharedWithUsers.includes(profile.user_id)
                              ? "border-accent bg-accent/10 ring-1 ring-accent"
                              : "border-border bg-muted hover:border-accent/50"
                          }`}
                        >
                          <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-accent font-medium text-xs">
                            {profile.first_name?.[0] || profile.email[0].toUpperCase()}
                          </div>
                          <span className="text-xs font-medium text-foreground truncate flex-1">
                            {profile.first_name} {profile.last_name}
                          </span>
                          {formData.sharedWithUsers.includes(profile.user_id) && (
                            <CheckCircle size={12} className="text-accent flex-shrink-0" />
                          )}
                        </button>
                      ))}
                  </div>
                </div>

                {(formData.sharedWithOrgs.length > 0 || formData.sharedWithUsers.length > 0) && (
                  <p className="text-xs text-accent mt-2">
                    Shared with {formData.sharedWithOrgs.length} organization(s) and {formData.sharedWithUsers.length} user(s)
                  </p>
                )}
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
        </TabsContent>

        <TabsContent value="signatures">
          <div className="space-y-6">
            {/* Documents with signature requests (pending or signed) */}
            {(() => {
              // Filter documents that have signature entries (either pending or signed)
              const documentsWithSignatures = documents.filter(
                doc => doc.signatures && doc.signatures.length > 0
              );

              // Get pending signatures for current user
              const myPendingSignatures = documentsWithSignatures
                .flatMap((doc) =>
                  (doc.signatures || [])
                    .filter((sig) => sig.signer_id === user?.id && sig.status === "pending")
                    .map((sig) => ({ ...sig, document: doc }))
                );

              // Get signed documents (where any signature is signed)
              const signedDocuments = documentsWithSignatures.filter(
                doc => doc.signatures?.some(s => s.status === "signed")
              );

              // Get documents with only pending signatures (not yet signed by anyone)
              const pendingOnlyDocuments = documentsWithSignatures.filter(
                doc => doc.signatures?.every(s => s.status === "pending")
              );

              if (documentsWithSignatures.length === 0) {
                return (
                  <div className="text-center py-12 text-muted-foreground">
                    <PenTool size={48} className="mx-auto mb-4 opacity-50" />
                    <p>Keine Dokumente mit Signaturanfragen vorhanden</p>
                    <p className="text-sm mt-2">Laden Sie ein Dokument im Documents-Tab hoch und wählen Sie Unterzeichner aus.</p>
                  </div>
                );
              }

              return (
                <>
                  {/* Pending Signatures for Current User */}
                  {myPendingSignatures.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <Clock size={20} className="text-warning" />
                        Ausstehende Signaturen ({myPendingSignatures.length})
                      </h3>
                      <div className="space-y-2">
                        {myPendingSignatures.map((sig) => (
                          <div
                            key={sig.id}
                            className="flex items-center justify-between p-4 card-state rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <FileText size={16} className="text-muted-foreground" />
                              <div>
                                <span className="text-sm font-medium">{sig.document.name}</span>
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(sig.document.created_at)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleSign(sig.id)}
                                className="px-3 py-1.5 bg-success text-success-foreground rounded text-sm font-medium hover:bg-success/90 transition-colors flex items-center gap-1"
                              >
                                <CheckCircle size={14} />
                                Signieren
                              </button>
                              <button
                                onClick={() => handleReject(sig.id)}
                                className="px-3 py-1.5 bg-destructive text-destructive-foreground rounded text-sm font-medium hover:bg-destructive/90 transition-colors flex items-center gap-1"
                              >
                                <XCircle size={14} />
                                Ablehnen
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Signed Documents */}
                  {signedDocuments.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <CheckCircle size={20} className="text-success" />
                        Signierte Dokumente ({signedDocuments.length})
                      </h3>
                      <div className="space-y-2">
                        {signedDocuments.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-4 card-state rounded-lg cursor-pointer hover:bg-muted/50"
                            onClick={() => {
                              setSelectedDocument(doc);
                              setShowDetailDialog(true);
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <FileText size={16} className="text-muted-foreground" />
                              <div>
                                <span className="text-sm font-medium">{doc.name}</span>
                                <p className="text-xs text-muted-foreground">
                                  {(doc.signatures || []).filter(s => s.status === "signed").length} Signatur(en)
                                </p>
                              </div>
                            </div>
                            {getStatusBadge(getDocumentStatus(doc))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pending Documents (waiting for others) */}
                  {pendingOnlyDocuments.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <Clock size={20} className="text-muted-foreground" />
                        Warten auf Signatur ({pendingOnlyDocuments.length})
                      </h3>
                      <div className="space-y-2">
                        {pendingOnlyDocuments.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-4 card-state rounded-lg cursor-pointer hover:bg-muted/50"
                            onClick={() => {
                              setSelectedDocument(doc);
                              setShowDetailDialog(true);
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <FileText size={16} className="text-muted-foreground" />
                              <div>
                                <span className="text-sm font-medium">{doc.name}</span>
                                <p className="text-xs text-muted-foreground">
                                  {(doc.signatures || []).filter(s => s.status === "pending").length} ausstehend
                                </p>
                              </div>
                            </div>
                            {getStatusBadge("pending")}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </TabsContent>
      </Tabs>

      {/* Document Detail Dialog */}
      <DocumentDetailDialog
        document={selectedDocument}
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
      />

      {/* Signature Position Selector */}
      <SignaturePositionSelector
        open={showPositionSelector}
        onOpenChange={(open) => {
          setShowPositionSelector(open);
          if (!open) setPendingSignAction(null);
        }}
        onConfirm={handleSignWithPosition}
        documentName={pendingSignAction?.documentName}
        signaturePreview={null}
        signatureInitials={profiles.find(p => p.user_id === user?.id)?.signature_initials || 
          `${profiles.find(p => p.user_id === user?.id)?.first_name?.[0] || ''}.${profiles.find(p => p.user_id === user?.id)?.last_name?.[0] || ''}`.toUpperCase()}
      />
    </Layout>
  );
}
