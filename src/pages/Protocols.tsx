import { Layout } from "@/components/layout/Layout";
import { ProtocolsPanel } from "@/components/documents/ProtocolsPanel";

export default function Protocols() {
  return (
    <Layout title="Protocols" subtitle="Meeting Protocols and Documentation">
      <ProtocolsPanel />
    </Layout>
  );
}
