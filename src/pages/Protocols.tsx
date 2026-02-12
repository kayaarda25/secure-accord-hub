import { Layout } from "@/components/layout/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { ProtocolsPanel } from "@/components/documents/ProtocolsPanel";

export default function Protocols() {
  const { t } = useLanguage();
  return (
    <Layout title={t("page.protocols.title")} subtitle={t("page.protocols.subtitle")}>
      <ProtocolsPanel />
    </Layout>
  );
}
