// Professional legal terms library for contract templates
// Supports DE, EN, FR, PT

export type ContractType = "service" | "consulting" | "nda" | "payment_order" | "partnership" | "license" | "employment";
export type DocLanguage = "de" | "en" | "fr" | "pt";

interface LegalLabels {
  contractTitle: Record<ContractType, string>;
  parties: string;
  partyA: string;
  partyB: string;
  address: string;
  representative: string;
  preamble: string;
  terms: string;
  contractValue: string;
  duration: string;
  specialClauses: string;
  signatures: string;
  date: string;
  signature: string;
  page: string;
  of: string;
  confidential: string;
  paymentInstruction: string;
  beneficiary: string;
  amount: string;
  reference: string;
  purpose: string;
  dueDate: string;
  authorizedBy: string;
  bank: string;
}

export const LABELS: Record<DocLanguage, LegalLabels> = {
  de: {
    contractTitle: {
      service: "DIENSTLEISTUNGSVERTRAG",
      consulting: "BERATUNGSVERTRAG",
      nda: "VERTRAULICHKEITSVEREINBARUNG (NDA)",
      payment_order: "ZAHLUNGSANWEISUNG",
      partnership: "PARTNERSCHAFTSVERTRAG",
      license: "LIZENZVERTRAG",
      employment: "ARBEITSVERTRAG",
    },
    parties: "VERTRAGSPARTEIEN",
    partyA: "Auftraggeber",
    partyB: "Auftragnehmer",
    address: "Adresse",
    representative: "Vertreten durch",
    preamble: "PRÄAMBEL",
    terms: "VERTRAGSBEDINGUNGEN",
    contractValue: "VERGÜTUNG",
    duration: "VERTRAGSLAUFZEIT",
    specialClauses: "BESONDERE BESTIMMUNGEN",
    signatures: "UNTERSCHRIFTEN",
    date: "Datum",
    signature: "Unterschrift",
    page: "Seite",
    of: "von",
    confidential: "Vertraulich",
    paymentInstruction: "ZAHLUNGSANWEISUNG",
    beneficiary: "Begünstigter",
    amount: "Betrag",
    reference: "Referenz",
    purpose: "Verwendungszweck",
    dueDate: "Fälligkeitsdatum",
    authorizedBy: "Autorisiert durch",
    bank: "Bank",
  },
  en: {
    contractTitle: {
      service: "SERVICE AGREEMENT",
      consulting: "CONSULTING AGREEMENT",
      nda: "NON-DISCLOSURE AGREEMENT (NDA)",
      payment_order: "PAYMENT ORDER",
      partnership: "PARTNERSHIP AGREEMENT",
      license: "LICENSE AGREEMENT",
      employment: "EMPLOYMENT AGREEMENT",
    },
    parties: "CONTRACTING PARTIES",
    partyA: "Client",
    partyB: "Contractor",
    address: "Address",
    representative: "Represented by",
    preamble: "PREAMBLE",
    terms: "TERMS AND CONDITIONS",
    contractValue: "COMPENSATION",
    duration: "TERM AND DURATION",
    specialClauses: "SPECIAL PROVISIONS",
    signatures: "SIGNATURES",
    date: "Date",
    signature: "Signature",
    page: "Page",
    of: "of",
    confidential: "Confidential",
    paymentInstruction: "PAYMENT INSTRUCTION",
    beneficiary: "Beneficiary",
    amount: "Amount",
    reference: "Reference",
    purpose: "Purpose",
    dueDate: "Due Date",
    authorizedBy: "Authorized by",
    bank: "Bank",
  },
  fr: {
    contractTitle: {
      service: "CONTRAT DE PRESTATION DE SERVICES",
      consulting: "CONTRAT DE CONSEIL",
      nda: "ACCORD DE CONFIDENTIALITÉ (NDA)",
      payment_order: "ORDRE DE PAIEMENT",
      partnership: "CONTRAT DE PARTENARIAT",
      license: "CONTRAT DE LICENCE",
      employment: "CONTRAT DE TRAVAIL",
    },
    parties: "PARTIES CONTRACTANTES",
    partyA: "Donneur d'ordre",
    partyB: "Prestataire",
    address: "Adresse",
    representative: "Représenté par",
    preamble: "PRÉAMBULE",
    terms: "CONDITIONS CONTRACTUELLES",
    contractValue: "RÉMUNÉRATION",
    duration: "DURÉE DU CONTRAT",
    specialClauses: "DISPOSITIONS PARTICULIÈRES",
    signatures: "SIGNATURES",
    date: "Date",
    signature: "Signature",
    page: "Page",
    of: "de",
    confidential: "Confidentiel",
    paymentInstruction: "ORDRE DE PAIEMENT",
    beneficiary: "Bénéficiaire",
    amount: "Montant",
    reference: "Référence",
    purpose: "Objet",
    dueDate: "Date d'échéance",
    authorizedBy: "Autorisé par",
    bank: "Banque",
  },
  pt: {
    contractTitle: {
      service: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS",
      consulting: "CONTRATO DE CONSULTORIA",
      nda: "ACORDO DE CONFIDENCIALIDADE (NDA)",
      payment_order: "ORDEM DE PAGAMENTO",
      partnership: "CONTRATO DE PARCERIA",
      license: "CONTRATO DE LICENÇA",
      employment: "CONTRATO DE TRABALHO",
    },
    parties: "PARTES CONTRATANTES",
    partyA: "Contratante",
    partyB: "Contratado",
    address: "Endereço",
    representative: "Representado por",
    preamble: "PREÂMBULO",
    terms: "TERMOS E CONDIÇÕES",
    contractValue: "REMUNERAÇÃO",
    duration: "DURAÇÃO DO CONTRATO",
    specialClauses: "DISPOSIÇÕES ESPECIAIS",
    signatures: "ASSINATURAS",
    date: "Data",
    signature: "Assinatura",
    page: "Página",
    of: "de",
    confidential: "Confidencial",
    paymentInstruction: "ORDEM DE PAGAMENTO",
    beneficiary: "Beneficiário",
    amount: "Valor",
    reference: "Referência",
    purpose: "Finalidade",
    dueDate: "Data de vencimento",
    authorizedBy: "Autorizado por",
    bank: "Banco",
  },
};

// Professional legal preambles per contract type
function getPreamble(type: ContractType, lang: DocLanguage): string {
  const preambles: Record<DocLanguage, Record<ContractType, string>> = {
    de: {
      service: "Die nachstehend bezeichneten Vertragsparteien schliessen in gegenseitigem Einvernehmen und in Kenntnis der beiderseitigen Rechte und Pflichten den folgenden Dienstleistungsvertrag ab. Dieser Vertrag regelt die Erbringung von Dienstleistungen sowie die damit verbundenen Rechte, Pflichten und Vergütungen der Vertragsparteien.",
      consulting: "Die nachstehend bezeichneten Vertragsparteien schliessen in gegenseitigem Einvernehmen den folgenden Beratungsvertrag ab. Dieser Vertrag definiert den Umfang, die Konditionen und die Vergütung der zu erbringenden Beratungsleistungen und bildet die verbindliche Grundlage der Zusammenarbeit.",
      nda: "Die nachstehend bezeichneten Vertragsparteien beabsichtigen, vertrauliche Informationen zum Zweck der geschäftlichen Zusammenarbeit auszutauschen. Um den Schutz dieser Informationen sicherzustellen, vereinbaren die Parteien die nachfolgenden Bestimmungen zur Geheimhaltung.",
      payment_order: "Die nachstehend bezeichnete zahlungspflichtige Partei erteilt hiermit die folgende unwiderrufliche Zahlungsanweisung gemäss den untenstehenden Bedingungen.",
      partnership: "Die nachstehend bezeichneten Vertragsparteien vereinbaren in gegenseitigem Interesse und auf der Grundlage beiderseitigen Vertrauens die Begründung einer Partnerschaft gemäss den nachfolgenden Bestimmungen.",
      license: "Die nachstehend bezeichneten Vertragsparteien schliessen in gegenseitigem Einvernehmen den folgenden Lizenzvertrag ab. Dieser Vertrag regelt die Einräumung von Nutzungsrechten sowie die damit verbundenen Bedingungen.",
      employment: "Die nachstehend bezeichneten Vertragsparteien vereinbaren das folgende Arbeitsverhältnis. Dieser Vertrag bildet die Grundlage für die Zusammenarbeit und regelt die gegenseitigen Rechte und Pflichten.",
    },
    en: {
      service: "The contracting parties identified below enter into this Service Agreement by mutual consent and with full knowledge of their respective rights and obligations. This Agreement governs the provision of services and the associated rights, obligations, and compensation of the parties.",
      consulting: "The contracting parties identified below enter into this Consulting Agreement by mutual consent. This Agreement defines the scope, terms, and compensation of the consulting services to be provided and constitutes the binding basis of the engagement.",
      nda: "The contracting parties identified below intend to exchange confidential information for the purpose of business cooperation. To ensure the protection of such information, the parties agree to the following confidentiality provisions.",
      payment_order: "The paying party identified below hereby issues the following irrevocable payment instruction in accordance with the terms and conditions set forth herein.",
      partnership: "The contracting parties identified below agree, in mutual interest and on the basis of mutual trust, to establish a partnership in accordance with the following provisions.",
      license: "The contracting parties identified below enter into this License Agreement by mutual consent. This Agreement governs the grant of usage rights and the associated terms and conditions.",
      employment: "The contracting parties identified below agree to the following employment relationship. This Agreement forms the basis for cooperation and governs the mutual rights and obligations of the parties.",
    },
    fr: {
      service: "Les parties contractantes désignées ci-dessous concluent d'un commun accord le présent contrat de prestation de services. Ce contrat régit la fourniture de services ainsi que les droits, obligations et rémunérations des parties contractantes.",
      consulting: "Les parties contractantes désignées ci-dessous concluent d'un commun accord le présent contrat de conseil. Ce contrat définit l'étendue, les conditions et la rémunération des prestations de conseil à fournir.",
      nda: "Les parties contractantes désignées ci-dessous entendent échanger des informations confidentielles aux fins de coopération commerciale. Afin d'assurer la protection de ces informations, les parties conviennent des dispositions de confidentialité suivantes.",
      payment_order: "La partie débitrice désignée ci-dessous donne par la présente l'ordre de paiement irrévocable suivant conformément aux conditions énoncées ci-après.",
      partnership: "Les parties contractantes désignées ci-dessous conviennent, dans leur intérêt mutuel et sur la base d'une confiance réciproque, d'établir un partenariat conformément aux dispositions suivantes.",
      license: "Les parties contractantes désignées ci-dessous concluent d'un commun accord le présent contrat de licence. Ce contrat régit l'octroi de droits d'utilisation ainsi que les conditions associées.",
      employment: "Les parties contractantes désignées ci-dessous conviennent de la relation de travail suivante. Ce contrat constitue la base de la coopération et régit les droits et obligations mutuels des parties.",
    },
    pt: {
      service: "As partes contratantes abaixo identificadas celebram, de comum acordo e com pleno conhecimento dos seus direitos e obrigações recíprocos, o presente contrato de prestação de serviços. Este contrato rege a prestação de serviços e os direitos, obrigações e remunerações associados.",
      consulting: "As partes contratantes abaixo identificadas celebram, de comum acordo, o presente contrato de consultoria. Este contrato define o âmbito, as condições e a remuneração dos serviços de consultoria a prestar.",
      nda: "As partes contratantes abaixo identificadas pretendem trocar informações confidenciais para efeitos de cooperação comercial. Para garantir a proteção dessas informações, as partes acordam as seguintes disposições de confidencialidade.",
      payment_order: "A parte devedora abaixo identificada emite a presente ordem de pagamento irrevogável de acordo com os termos e condições estabelecidos.",
      partnership: "As partes contratantes abaixo identificadas acordam, no interesse mútuo e com base na confiança recíproca, estabelecer uma parceria de acordo com as disposições seguintes.",
      license: "As partes contratantes abaixo identificadas celebram, de comum acordo, o presente contrato de licença. Este contrato rege a concessão de direitos de utilização e as condições associadas.",
      employment: "As partes contratantes abaixo identificadas acordam a seguinte relação de trabalho. Este contrato constitui a base da cooperação e rege os direitos e obrigações mútuos das partes.",
    },
  };
  return preambles[lang][type];
}

// Professional legal terms per contract type
export function getDefaultTerms(type: ContractType, lang: DocLanguage): string[] {
  const terms: Record<DocLanguage, Record<ContractType, string[]>> = {
    de: {
      service: [
        "Gegenstand des Vertrags\nDer Auftragnehmer verpflichtet sich, die im Anhang näher beschriebenen Dienstleistungen fachgerecht, sorgfältig und nach bestem Wissen und Gewissen zu erbringen. Art, Umfang und Qualität der Leistungen richten sich nach den zwischen den Parteien vereinbarten Spezifikationen. Der Auftragnehmer schuldet eine Leistung, die dem Stand der Technik und den anerkannten Regeln seines Fachgebiets entspricht.",
        "Vergütung und Zahlungsbedingungen\nDie Vergütung für die erbrachten Dienstleistungen wird gemäss der im Vertrag festgelegten Konditionen entrichtet. Rechnungen sind innerhalb von dreissig (30) Kalendertagen nach Rechnungsstellung ohne Abzug zahlbar. Bei Zahlungsverzug ist der Auftragnehmer berechtigt, Verzugszinsen in Höhe von 5% p.a. zu berechnen. Sämtliche Beträge verstehen sich zuzüglich der gesetzlich geschuldeten Mehrwertsteuer.",
        "Vertragslaufzeit und Kündigung\nDieser Vertrag tritt mit Unterzeichnung durch beide Parteien in Kraft und gilt für die vereinbarte Vertragsdauer. Er kann von jeder Partei unter Einhaltung einer Kündigungsfrist von drei (3) Monaten zum Monatsende ordentlich gekündigt werden. Das Recht zur fristlosen Kündigung aus wichtigem Grund bleibt hiervon unberührt. Eine Kündigung bedarf der Schriftform.",
        "Gewährleistung und Haftung\nDer Auftragnehmer gewährleistet, dass die erbrachten Dienstleistungen den vereinbarten Anforderungen entsprechen. Die Haftung für leichte Fahrlässigkeit ist ausgeschlossen, sofern nicht Pflichten verletzt werden, deren Erfüllung die ordnungsgemässe Durchführung des Vertrags überhaupt erst ermöglicht. Die Haftung ist in jedem Fall auf den Vertragswert begrenzt. Weitergehende Schadensersatzansprüche, insbesondere auf entgangenen Gewinn, sind ausgeschlossen.",
        "Vertraulichkeit\nBeide Parteien verpflichten sich, sämtliche im Rahmen dieses Vertragsverhältnisses erhaltenen vertraulichen Informationen streng geheim zu halten und ausschliesslich für die Zwecke der Vertragserfüllung zu verwenden. Diese Verpflichtung besteht auch nach Beendigung des Vertragsverhältnisses für einen Zeitraum von fünf (5) Jahren fort.",
        "Geistiges Eigentum\nSämtliche im Rahmen der Leistungserbringung erstellten Arbeitsergebnisse, Dokumente und Unterlagen gehen mit vollständiger Bezahlung in das Eigentum des Auftraggebers über, sofern nicht ausdrücklich etwas anderes vereinbart wurde. Vorbestehende Rechte des Auftragnehmers bleiben unberührt.",
        "Höhere Gewalt\nKeine der Parteien haftet für die Nichterfüllung oder verspätete Erfüllung ihrer Verpflichtungen aus diesem Vertrag, soweit dies auf Umstände höherer Gewalt zurückzuführen ist. Als höhere Gewalt gelten insbesondere Naturkatastrophen, Krieg, Epidemien, behördliche Massnahmen sowie vergleichbare unvorhersehbare und unabwendbare Ereignisse.",
        "Schlussbestimmungen\nÄnderungen und Ergänzungen dieses Vertrags bedürfen der Schriftform. Sollte eine Bestimmung dieses Vertrags unwirksam oder undurchführbar sein oder werden, so wird die Wirksamkeit der übrigen Bestimmungen hiervon nicht berührt. An die Stelle der unwirksamen Bestimmung tritt eine wirksame Regelung, die dem wirtschaftlichen Zweck der unwirksamen Bestimmung am nächsten kommt. Dieser Vertrag unterliegt dem Recht der Schweizerischen Eidgenossenschaft. Gerichtsstand ist Zürich.",
      ],
      consulting: [
        "Gegenstand und Umfang der Beratung\nDer Berater verpflichtet sich, den Auftraggeber in den nachstehend definierten Fachbereichen zu beraten. Die Beratungsleistungen umfassen die Analyse bestehender Strukturen, die Erarbeitung von Handlungsempfehlungen sowie die Begleitung bei der Umsetzung vereinbarter Massnahmen. Der Berater erbringt seine Leistungen mit der Sorgfalt eines ordentlichen Kaufmanns und unter Einsatz seiner fachlichen Expertise.",
        "Unabhängigkeit des Beraters\nDer Berater erbringt seine Leistungen als unabhängiger Auftragnehmer und unterliegt keinem Weisungsrecht des Auftraggebers hinsichtlich der Art und Weise der Leistungserbringung. Der Berater ist frei in der Gestaltung seiner Arbeitszeit und seines Arbeitsortes, sofern nicht ausdrücklich Präsenzpflichten vereinbart wurden.",
        "Vergütung\nDie Vergütung erfolgt auf der Grundlage der vereinbarten Honorarsätze. Reisekosten und sonstige Auslagen werden nach vorheriger Absprache gesondert erstattet. Rechnungen sind innerhalb von dreissig (30) Tagen nach Zugang zahlbar. Sämtliche Beträge verstehen sich netto zuzüglich der gesetzlich geschuldeten Mehrwertsteuer.",
        "Vertraulichkeit und Datenschutz\nDer Berater verpflichtet sich, alle ihm im Zusammenhang mit der Beratungstätigkeit zugänglich gemachten Informationen, Unterlagen und Daten streng vertraulich zu behandeln. Er wird diese Informationen nicht an Dritte weitergeben und sie ausschliesslich für die Zwecke der Vertragserfüllung verwenden. Die datenschutzrechtlichen Bestimmungen werden vollumfänglich eingehalten.",
        "Haftung und Gewährleistung\nDer Berater haftet für Schäden, die er dem Auftraggeber durch vorsätzliche oder grob fahrlässige Pflichtverletzung zufügt. Die Haftung ist auf den Betrag der für den jeweiligen Auftrag vereinbarten Vergütung begrenzt. Eine Haftung für mittelbare Schäden, entgangenen Gewinn oder Folgeschäden ist ausgeschlossen.",
        "Laufzeit und Kündigung\nDieser Vertrag wird für die vereinbarte Laufzeit geschlossen. Er kann von jeder Partei mit einer Frist von dreissig (30) Tagen zum Monatsende ordentlich gekündigt werden. Das Recht zur ausserordentlichen Kündigung aus wichtigem Grund bleibt unberührt. Im Falle der Kündigung sind bis dahin erbrachte Leistungen anteilig zu vergüten.",
        "Schlussbestimmungen\nDieser Vertrag stellt die gesamte Vereinbarung zwischen den Parteien dar und ersetzt alle vorherigen mündlichen oder schriftlichen Vereinbarungen. Änderungen bedürfen der Schriftform. Es gilt Schweizer Recht. Gerichtsstand ist der Sitz des Auftraggebers.",
      ],
      nda: [
        "Definition vertraulicher Informationen\nAls vertrauliche Informationen im Sinne dieser Vereinbarung gelten sämtliche Informationen technischer, geschäftlicher, finanzieller oder sonstiger Natur, die von einer Partei (der «offenlegenden Partei») der anderen Partei (der «empfangenden Partei») zugänglich gemacht werden, unabhängig davon, ob sie schriftlich, mündlich, elektronisch oder in sonstiger Form übermittelt werden. Dies umfasst insbesondere Geschäftsgeheimnisse, Know-how, Kundendaten, Geschäftspläne, Finanzinformationen, technische Zeichnungen, Software, Prototypen und alle damit zusammenhängenden Unterlagen.",
        "Pflichten der empfangenden Partei\nDie empfangende Partei verpflichtet sich: (a) die vertraulichen Informationen mit derselben Sorgfalt zu behandeln wie ihre eigenen vertraulichen Informationen, mindestens jedoch mit angemessener Sorgfalt; (b) die vertraulichen Informationen ausschliesslich für den vereinbarten Zweck zu verwenden; (c) den Zugang zu den vertraulichen Informationen auf diejenigen Mitarbeiter und Berater zu beschränken, die diese zur Erfüllung des vereinbarten Zwecks benötigen und die ihrerseits zur Vertraulichkeit verpflichtet sind; (d) die vertraulichen Informationen ohne vorherige schriftliche Zustimmung der offenlegenden Partei nicht an Dritte weiterzugeben.",
        "Ausnahmen\nDie Vertraulichkeitsverpflichtung gilt nicht für Informationen, die: (a) zum Zeitpunkt der Offenlegung bereits allgemein bekannt waren oder danach ohne Verschulden der empfangenden Partei allgemein bekannt werden; (b) der empfangenden Partei bereits vor der Offenlegung ohne Vertraulichkeitsverpflichtung bekannt waren; (c) der empfangenden Partei von einem Dritten ohne Verletzung einer Vertraulichkeitsverpflichtung rechtmässig mitgeteilt werden; (d) von der empfangenden Partei unabhängig und ohne Rückgriff auf die vertraulichen Informationen entwickelt werden.",
        "Laufzeit der Vertraulichkeitsverpflichtung\nDiese Vereinbarung tritt mit Unterzeichnung in Kraft. Die Vertraulichkeitsverpflichtung gilt für einen Zeitraum von fünf (5) Jahren ab dem Datum der jeweiligen Offenlegung. Für Geschäftsgeheimnisse im Sinne des anwendbaren Rechts gilt die Vertraulichkeitsverpflichtung zeitlich unbegrenzt, solange die betreffenden Informationen als Geschäftsgeheimnis geschützt sind.",
        "Rückgabe und Vernichtung\nAuf Verlangen der offenlegenden Partei oder bei Beendigung dieser Vereinbarung hat die empfangende Partei sämtliche vertraulichen Informationen einschliesslich aller Kopien, Notizen und Zusammenfassungen unverzüglich zurückzugeben oder zu vernichten. Die empfangende Partei hat die vollständige Rückgabe oder Vernichtung schriftlich zu bestätigen.",
        "Rechtsfolgen bei Verstoss\nDie empfangende Partei erkennt an, dass ein Verstoss gegen diese Vereinbarung einen irreparablen Schaden verursachen kann, der durch Schadensersatz allein nicht angemessen kompensiert werden könnte. Die offenlegende Partei ist daher berechtigt, neben Schadensersatzansprüchen auch einstweiligen Rechtsschutz und Unterlassungsansprüche geltend zu machen.",
        "Anwendbares Recht und Gerichtsstand\nDiese Vereinbarung unterliegt dem materiellen Recht der Schweizerischen Eidgenossenschaft unter Ausschluss des Kollisionsrechts und des UN-Kaufrechts. Für alle Streitigkeiten aus oder im Zusammenhang mit dieser Vereinbarung ist ausschliesslich das zuständige Gericht am Sitz der offenlegenden Partei zuständig.",
      ],
      payment_order: [
        "Zahlungsauftrag\nDer Auftraggeber erteilt hiermit die unwiderrufliche Anweisung, den nachstehend bezeichneten Betrag an den genannten Begünstigten zu überweisen. Die Zahlung erfolgt vorbehaltlos und ist nach Ausführung endgültig.",
        "Ausführungsfrist\nDie Zahlung ist innerhalb der angegebenen Frist auszuführen. Bei Nichtangabe eines Fälligkeitsdatums ist die Zahlung unverzüglich, spätestens jedoch innerhalb von drei (3) Bankarbeitstagen nach Erteilung dieser Anweisung auszuführen.",
        "Haftung\nDer Auftraggeber bestätigt die Richtigkeit der angegebenen Zahlungsdaten. Für Verzögerungen oder Fehler, die auf unrichtige oder unvollständige Angaben des Auftraggebers zurückzuführen sind, übernimmt die ausführende Stelle keine Haftung.",
      ],
      partnership: [
        "Gegenstand der Partnerschaft\nDie Parteien vereinbaren eine strategische Partnerschaft zum Zweck der gemeinsamen Geschäftsentwicklung in den vereinbarten Bereichen. Die Zusammenarbeit basiert auf den Grundsätzen der Gleichberechtigung, des gegenseitigen Respekts und der Transparenz.",
        "Rechte und Pflichten der Partner\nJede Partei bringt ihre spezifischen Kompetenzen, Ressourcen und Netzwerke in die Partnerschaft ein. Die Parteien verpflichten sich, die gemeinsamen Ziele aktiv zu verfolgen, einander über wesentliche Entwicklungen zu informieren und sich gegenseitig bei der Erreichung der Partnerschaftsziele zu unterstützen.",
        "Gewinn- und Kostenteilung\nDie Verteilung von Erträgen und Kosten aus der partnerschaftlichen Zusammenarbeit erfolgt gemäss dem im Anhang festgelegten Verteilungsschlüssel. Änderungen des Verteilungsschlüssels bedürfen der schriftlichen Zustimmung beider Parteien.",
        "Vertraulichkeit\nBeide Parteien verpflichten sich, alle im Rahmen der Partnerschaft erhaltenen vertraulichen Informationen, Geschäftsgeheimnisse und proprietären Daten streng vertraulich zu behandeln und nicht ohne vorherige schriftliche Zustimmung der anderen Partei an Dritte weiterzugeben.",
        "Laufzeit und Beendigung\nDiese Partnerschaft wird auf unbestimmte Zeit geschlossen und kann von jeder Partei unter Einhaltung einer Kündigungsfrist von sechs (6) Monaten zum Quartalsende gekündigt werden. Bei Beendigung sind laufende Projekte nach Treu und Glauben abzuwickeln.",
        "Wettbewerbsverbot\nWährend der Laufzeit dieser Vereinbarung und für einen Zeitraum von zwölf (12) Monaten nach deren Beendigung verpflichten sich die Parteien, keine mit der Partnerschaft konkurrierenden Aktivitäten in den vereinbarten Geschäftsbereichen zu betreiben.",
        "Schlussbestimmungen\nÄnderungen und Ergänzungen dieses Vertrags bedürfen der Schriftform. Sollte eine Bestimmung unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt. Es gilt Schweizer Recht. Gerichtsstand ist Zürich.",
      ],
      license: [
        "Lizenzgegenstand\nDer Lizenzgeber räumt dem Lizenznehmer das nicht ausschliessliche, nicht übertragbare Recht ein, den im Anhang näher bezeichneten Lizenzgegenstand im vereinbarten Umfang zu nutzen.",
        "Nutzungsumfang\nDie Lizenz berechtigt den Lizenznehmer zur Nutzung des Lizenzgegenstands ausschliesslich für den vereinbarten Zweck und im vereinbarten Territorium. Eine Unterlizenzierung ist ohne vorherige schriftliche Zustimmung des Lizenzgebers nicht gestattet.",
        "Lizenzgebühren\nDer Lizenznehmer verpflichtet sich zur Zahlung der vereinbarten Lizenzgebühren. Die Zahlungen sind quartalsweise im Voraus fällig.",
        "Gewährleistung\nDer Lizenzgeber gewährleistet, dass er zur Vergabe der Lizenz berechtigt ist und dass der Lizenzgegenstand keine Rechte Dritter verletzt, soweit ihm bekannt.",
        "Schlussbestimmungen\nDieser Vertrag unterliegt Schweizer Recht. Gerichtsstand ist Zürich.",
      ],
      employment: [
        "Arbeitsantritt und Tätigkeit\nDer Arbeitnehmer tritt die Stelle zum vereinbarten Datum an. Er verpflichtet sich, die ihm übertragenen Aufgaben gewissenhaft und nach bestem Wissen und Gewissen zu erfüllen.",
        "Arbeitszeit und Arbeitsort\nDie wöchentliche Arbeitszeit beträgt die vereinbarte Stundenanzahl. Der Arbeitsort ist am Sitz des Arbeitgebers, sofern nicht anders vereinbart.",
        "Vergütung\nDer Arbeitnehmer erhält die vereinbarte monatliche Bruttovergütung, zahlbar am Ende eines jeden Monats. Die Vergütung versteht sich inklusive aller gesetzlichen Sozialabgaben.",
        "Probezeit\nDie ersten drei (3) Monate gelten als Probezeit. Während der Probezeit kann das Arbeitsverhältnis von beiden Seiten mit einer Frist von sieben (7) Tagen gekündigt werden.",
        "Ferien\nDer Arbeitnehmer hat Anspruch auf die gesetzlich vorgeschriebene Ferienzeit von mindestens vier (4) Wochen pro Kalenderjahr.",
        "Geheimhaltung\nDer Arbeitnehmer verpflichtet sich, über alle geschäftlichen Angelegenheiten und Betriebsgeheimnisse auch nach Beendigung des Arbeitsverhältnisses Stillschweigen zu bewahren.",
        "Schlussbestimmungen\nEs gilt Schweizer Arbeitsrecht. Gerichtsstand ist der Arbeitsort.",
      ],
    },
    en: {
      service: [
        "Subject Matter of the Agreement\nThe Contractor undertakes to provide the services described in detail in the annex hereto with due care, diligence, and to the best of its knowledge and ability. The nature, scope, and quality of the services shall be determined by the specifications agreed upon between the parties. The Contractor shall provide services that comply with the current state of the art and the recognized standards of its professional field.",
        "Compensation and Payment Terms\nCompensation for services rendered shall be paid in accordance with the terms set forth in this Agreement. Invoices shall be payable within thirty (30) calendar days of the invoice date without deduction. In the event of late payment, the Contractor shall be entitled to charge default interest at a rate of 5% per annum. All amounts are exclusive of any applicable value added tax.",
        "Term and Termination\nThis Agreement shall enter into force upon execution by both parties and shall remain in effect for the agreed term. Either party may terminate this Agreement by giving three (3) months' written notice to the end of any calendar month. The right to terminate for cause without notice remains unaffected. Any notice of termination must be in writing.",
        "Warranty and Liability\nThe Contractor warrants that the services provided shall conform to the agreed-upon requirements. Liability for ordinary negligence is excluded, except in cases where obligations are breached whose fulfillment is essential for the proper performance of this Agreement. Liability shall in any event be limited to the contract value. Further claims for damages, in particular for lost profits, are excluded.",
        "Confidentiality\nBoth parties undertake to keep strictly confidential all confidential information received in the course of this contractual relationship and to use such information exclusively for the purposes of performing this Agreement. This obligation shall survive the termination of this Agreement for a period of five (5) years.",
        "Intellectual Property\nAll work products, documents, and materials created in the course of providing the services shall become the property of the Client upon full payment, unless expressly agreed otherwise. Pre-existing rights of the Contractor shall remain unaffected.",
        "Force Majeure\nNeither party shall be liable for failure to perform or delayed performance of its obligations under this Agreement to the extent that such failure or delay is attributable to circumstances of force majeure. Force majeure includes, but is not limited to, natural disasters, war, epidemics, governmental measures, and comparable unforeseeable and unavoidable events.",
        "Final Provisions\nAmendments and supplements to this Agreement must be in writing. Should any provision of this Agreement be or become invalid or unenforceable, the validity of the remaining provisions shall not be affected. The invalid provision shall be replaced by a valid provision that most closely approximates the economic purpose of the invalid provision. This Agreement shall be governed by the laws of Switzerland. The place of jurisdiction shall be Zurich.",
      ],
      consulting: [
        "Scope of Consulting Services\nThe Consultant undertakes to advise the Client in the subject areas defined herein. The consulting services include the analysis of existing structures, the development of recommendations for action, and support in the implementation of agreed measures. The Consultant shall perform its services with the diligence of a prudent businessperson and applying its professional expertise.",
        "Independence of the Consultant\nThe Consultant shall perform its services as an independent contractor and shall not be subject to any instructions from the Client regarding the manner of service delivery. The Consultant shall be free to organize its working time and place of work, unless specific attendance obligations have been expressly agreed.",
        "Compensation\nCompensation shall be based on the agreed fee rates. Travel expenses and other disbursements shall be reimbursed separately upon prior agreement. Invoices shall be payable within thirty (30) days of receipt. All amounts are net of any applicable value added tax.",
        "Confidentiality and Data Protection\nThe Consultant undertakes to treat all information, documents, and data made available to it in connection with the consulting engagement as strictly confidential. The Consultant shall not disclose such information to third parties and shall use it exclusively for the purposes of performing this Agreement. All applicable data protection regulations shall be fully observed.",
        "Liability and Warranty\nThe Consultant shall be liable for damages caused to the Client through intentional or grossly negligent breach of duty. Liability shall be limited to the amount of the fee agreed for the respective engagement. Liability for indirect damages, lost profits, or consequential damages is excluded.",
        "Term and Termination\nThis Agreement is entered into for the agreed term. Either party may terminate this Agreement by giving thirty (30) days' written notice to the end of any calendar month. The right to extraordinary termination for cause remains unaffected. In the event of termination, services rendered up to that point shall be compensated on a pro rata basis.",
        "Final Provisions\nThis Agreement constitutes the entire agreement between the parties and supersedes all prior oral or written agreements. Amendments must be in writing. Swiss law shall apply. The place of jurisdiction shall be the domicile of the Client.",
      ],
      nda: [
        "Definition of Confidential Information\nConfidential Information within the meaning of this Agreement shall mean all information of a technical, commercial, financial, or other nature disclosed by one party (the \"Disclosing Party\") to the other party (the \"Receiving Party\"), regardless of whether such information is communicated in writing, orally, electronically, or in any other form. This includes, without limitation, trade secrets, know-how, customer data, business plans, financial information, technical drawings, software, prototypes, and all related documentation.",
        "Obligations of the Receiving Party\nThe Receiving Party undertakes to: (a) treat the Confidential Information with the same degree of care as its own confidential information, but in no event less than reasonable care; (b) use the Confidential Information solely for the agreed purpose; (c) restrict access to the Confidential Information to those employees and advisors who require it for the agreed purpose and who are themselves bound by confidentiality obligations; (d) not disclose the Confidential Information to any third party without the prior written consent of the Disclosing Party.",
        "Exceptions\nThe confidentiality obligation shall not apply to information that: (a) was publicly available at the time of disclosure or subsequently becomes publicly available through no fault of the Receiving Party; (b) was already known to the Receiving Party prior to disclosure without any confidentiality obligation; (c) is lawfully communicated to the Receiving Party by a third party without breach of any confidentiality obligation; (d) is independently developed by the Receiving Party without reference to the Confidential Information.",
        "Term of Confidentiality Obligation\nThis Agreement shall enter into force upon execution. The confidentiality obligation shall remain in effect for a period of five (5) years from the date of each respective disclosure. For trade secrets within the meaning of applicable law, the confidentiality obligation shall apply without time limitation for as long as the information in question qualifies as a trade secret.",
        "Return and Destruction\nUpon the request of the Disclosing Party or upon termination of this Agreement, the Receiving Party shall promptly return or destroy all Confidential Information, including all copies, notes, and summaries. The Receiving Party shall confirm the complete return or destruction in writing.",
        "Consequences of Breach\nThe Receiving Party acknowledges that any breach of this Agreement may cause irreparable harm that cannot be adequately compensated by monetary damages alone. The Disclosing Party shall therefore be entitled to seek, in addition to damages, injunctive relief and specific performance.",
        "Governing Law and Jurisdiction\nThis Agreement shall be governed by the substantive laws of Switzerland, excluding its conflict of laws provisions and the United Nations Convention on Contracts for the International Sale of Goods. The exclusive place of jurisdiction for all disputes arising out of or in connection with this Agreement shall be the courts at the domicile of the Disclosing Party.",
      ],
      payment_order: [
        "Payment Instruction\nThe Principal hereby issues the irrevocable instruction to transfer the amount specified below to the named beneficiary. The payment shall be made unconditionally and shall be final upon execution.",
        "Execution Period\nThe payment shall be executed within the specified period. If no due date is specified, the payment shall be executed without delay, but in no event later than three (3) business days after the issuance of this instruction.",
        "Liability\nThe Principal confirms the accuracy of the payment details provided. The executing institution shall not be liable for delays or errors attributable to incorrect or incomplete information provided by the Principal.",
      ],
      partnership: [
        "Subject Matter of the Partnership\nThe parties agree to establish a strategic partnership for the purpose of joint business development in the agreed areas. The collaboration shall be based on the principles of equality, mutual respect, and transparency.",
        "Rights and Obligations of the Partners\nEach party shall contribute its specific competencies, resources, and networks to the partnership. The parties undertake to actively pursue the common objectives, to inform each other of material developments, and to support each other in achieving the partnership goals.",
        "Profit and Cost Sharing\nThe distribution of revenues and costs arising from the partnership shall be in accordance with the distribution key set forth in the annex. Any changes to the distribution key shall require the written consent of both parties.",
        "Confidentiality\nBoth parties undertake to treat all confidential information, trade secrets, and proprietary data received in the course of the partnership as strictly confidential and not to disclose them to third parties without the prior written consent of the other party.",
        "Term and Termination\nThis partnership is entered into for an indefinite term and may be terminated by either party by giving six (6) months' written notice to the end of any calendar quarter. Upon termination, ongoing projects shall be wound down in good faith.",
        "Non-Competition\nDuring the term of this Agreement and for a period of twelve (12) months following its termination, the parties undertake not to engage in any activities that compete with the partnership in the agreed business areas.",
        "Final Provisions\nAmendments and supplements to this Agreement must be in writing. Should any provision be invalid, the validity of the remaining provisions shall not be affected. Swiss law shall apply. The place of jurisdiction shall be Zurich.",
      ],
      license: [
        "Licensed Subject Matter\nThe Licensor hereby grants to the Licensee a non-exclusive, non-transferable right to use the licensed subject matter described in the annex within the agreed scope.",
        "Scope of Use\nThe license entitles the Licensee to use the licensed subject matter exclusively for the agreed purpose and within the agreed territory. Sublicensing is not permitted without the prior written consent of the Licensor.",
        "License Fees\nThe Licensee undertakes to pay the agreed license fees. Payments are due quarterly in advance.",
        "Warranty\nThe Licensor warrants that it is entitled to grant the license and that, to its knowledge, the licensed subject matter does not infringe any third-party rights.",
        "Final Provisions\nThis Agreement shall be governed by Swiss law. The place of jurisdiction shall be Zurich.",
      ],
      employment: [
        "Commencement and Duties\nThe Employee shall commence employment on the agreed date and undertakes to perform the assigned duties conscientiously and to the best of their knowledge and ability.",
        "Working Hours and Place of Work\nThe weekly working hours shall be as agreed. The place of work shall be at the Employer's registered office, unless otherwise agreed.",
        "Compensation\nThe Employee shall receive the agreed gross monthly salary, payable at the end of each month. The compensation is inclusive of all statutory social security contributions.",
        "Probationary Period\nThe first three (3) months shall constitute the probationary period. During the probationary period, either party may terminate the employment with seven (7) days' notice.",
        "Vacation\nThe Employee shall be entitled to the statutory minimum vacation of four (4) weeks per calendar year.",
        "Confidentiality\nThe Employee undertakes to maintain strict confidentiality regarding all business matters and trade secrets, both during and after the termination of the employment relationship.",
        "Final Provisions\nSwiss employment law shall apply. The place of jurisdiction shall be the place of work.",
      ],
    },
    fr: {
      service: [
        "Objet du contrat\nLe prestataire s'engage à fournir les services décrits en annexe avec diligence, professionnalisme et au meilleur de ses connaissances. La nature, l'étendue et la qualité des prestations sont déterminées par les spécifications convenues entre les parties.",
        "Rémunération et conditions de paiement\nLa rémunération des services rendus est versée conformément aux conditions stipulées dans le présent contrat. Les factures sont payables dans les trente (30) jours calendaires suivant la date de facturation, sans déduction. En cas de retard de paiement, le prestataire est en droit de facturer des intérêts moratoires au taux de 5% par an.",
        "Durée et résiliation\nLe présent contrat entre en vigueur dès sa signature par les deux parties et est conclu pour la durée convenue. Chaque partie peut résilier le contrat moyennant un préavis de trois (3) mois pour la fin d'un mois calendaire. Le droit de résiliation immédiate pour justes motifs demeure réservé.",
        "Garantie et responsabilité\nLe prestataire garantit que les services fournis sont conformes aux exigences convenues. La responsabilité pour faute légère est exclue. La responsabilité est en tout état de cause limitée à la valeur du contrat.",
        "Confidentialité\nLes deux parties s'engagent à garder strictement confidentielles toutes les informations reçues dans le cadre de cette relation contractuelle. Cette obligation subsiste pendant cinq (5) ans après la fin du contrat.",
        "Dispositions finales\nToute modification du présent contrat doit être faite par écrit. Le droit suisse est applicable. Le for juridique est à Zurich.",
      ],
      consulting: [
        "Étendue des prestations de conseil\nLe consultant s'engage à conseiller le donneur d'ordre dans les domaines définis. Les prestations comprennent l'analyse des structures existantes, l'élaboration de recommandations et l'accompagnement dans la mise en œuvre des mesures convenues.",
        "Indépendance du consultant\nLe consultant fournit ses prestations en qualité de prestataire indépendant. Il est libre dans l'organisation de son temps de travail et de son lieu de travail.",
        "Rémunération\nLa rémunération s'effectue sur la base des taux d'honoraires convenus. Les frais de déplacement sont remboursés séparément après accord préalable.",
        "Confidentialité\nLe consultant s'engage à traiter de manière strictement confidentielle toutes les informations portées à sa connaissance dans le cadre de sa mission.",
        "Responsabilité\nLa responsabilité du consultant est limitée au montant des honoraires convenus pour la mission concernée.",
        "Dispositions finales\nLe droit suisse est applicable. Le for juridique est au siège du donneur d'ordre.",
      ],
      nda: [
        "Définition des informations confidentielles\nSont considérées comme confidentielles toutes les informations de nature technique, commerciale, financière ou autre, transmises par une partie à l'autre, quel que soit leur support.",
        "Obligations de la partie réceptrice\nLa partie réceptrice s'engage à traiter les informations confidentielles avec le même degré de soin que ses propres informations confidentielles et à en limiter l'accès aux seules personnes ayant besoin d'en connaître.",
        "Exceptions\nL'obligation de confidentialité ne s'applique pas aux informations déjà publiques, déjà connues de la partie réceptrice, ou développées indépendamment.",
        "Durée\nL'obligation de confidentialité s'applique pendant cinq (5) ans à compter de la divulgation.",
        "Restitution\nSur demande, la partie réceptrice restituera ou détruira toutes les informations confidentielles.",
        "Droit applicable\nLe droit suisse est applicable. Le for juridique est au siège de la partie divulgatrice.",
      ],
      payment_order: [
        "Ordre de paiement\nLe donneur d'ordre donne par la présente l'instruction irrévocable de transférer le montant indiqué au bénéficiaire désigné.",
        "Délai d'exécution\nLe paiement doit être exécuté dans le délai indiqué ou, à défaut, dans les trois (3) jours ouvrables.",
        "Responsabilité\nLe donneur d'ordre confirme l'exactitude des données de paiement fournies.",
      ],
      partnership: [
        "Objet du partenariat\nLes parties conviennent d'un partenariat stratégique pour le développement commercial commun dans les domaines convenus.",
        "Droits et obligations\nChaque partie apporte ses compétences et ressources spécifiques au partenariat.",
        "Partage des bénéfices\nLa répartition des revenus et des coûts s'effectue selon la clé de répartition convenue.",
        "Confidentialité\nLes parties s'engagent à traiter confidentiellement toutes les informations reçues dans le cadre du partenariat.",
        "Durée et résiliation\nLe partenariat est conclu pour une durée indéterminée avec un préavis de résiliation de six (6) mois.",
        "Dispositions finales\nLe droit suisse est applicable. Le for juridique est à Zurich.",
      ],
      license: [
        "Objet de la licence\nLe concédant accorde au licencié un droit non exclusif et non transférable d'utiliser l'objet de la licence dans le cadre convenu.",
        "Étendue de l'utilisation\nLa licence autorise l'utilisation exclusivement aux fins convenues et dans le territoire convenu.",
        "Redevances\nLe licencié s'engage à payer les redevances convenues trimestriellement à l'avance.",
        "Dispositions finales\nLe droit suisse est applicable. Le for juridique est à Zurich.",
      ],
      employment: [
        "Prise de fonction\nL'employé prend ses fonctions à la date convenue et s'engage à accomplir les tâches qui lui sont confiées avec diligence.",
        "Temps de travail\nLe temps de travail hebdomadaire est celui convenu. Le lieu de travail est au siège de l'employeur.",
        "Rémunération\nL'employé perçoit le salaire mensuel brut convenu, payable à la fin de chaque mois.",
        "Période d'essai\nLes trois (3) premiers mois constituent la période d'essai avec un préavis de sept (7) jours.",
        "Confidentialité\nL'employé s'engage à garder le secret sur toutes les affaires commerciales, même après la fin de la relation de travail.",
        "Dispositions finales\nLe droit du travail suisse est applicable.",
      ],
    },
    pt: {
      service: [
        "Objeto do Contrato\nO Contratado compromete-se a prestar os serviços descritos no anexo com diligência, profissionalismo e de acordo com os melhores conhecimentos. A natureza, âmbito e qualidade dos serviços são determinados pelas especificações acordadas entre as partes.",
        "Remuneração e Condições de Pagamento\nA remuneração pelos serviços prestados será paga de acordo com as condições estabelecidas neste contrato. As faturas são pagáveis no prazo de trinta (30) dias úteis após a data de emissão. Em caso de atraso no pagamento, o Contratado tem direito a cobrar juros de mora à taxa de 5% ao ano.",
        "Duração e Rescisão\nO presente contrato entra em vigor na data da sua assinatura por ambas as partes. Cada parte pode rescindir o contrato mediante aviso prévio de três (3) meses para o final de cada mês civil.",
        "Garantia e Responsabilidade\nO Contratado garante que os serviços prestados estão em conformidade com os requisitos acordados. A responsabilidade é limitada ao valor do contrato.",
        "Confidencialidade\nAmbas as partes comprometem-se a manter estritamente confidenciais todas as informações recebidas no âmbito desta relação contratual, durante um período de cinco (5) anos após o término do contrato.",
        "Disposições Finais\nQuaisquer alterações a este contrato devem ser feitas por escrito. Aplica-se o direito suíço. O foro competente é Zurique.",
      ],
      consulting: [
        "Âmbito dos Serviços de Consultoria\nO Consultor compromete-se a aconselhar o Contratante nas áreas definidas. Os serviços incluem a análise de estruturas existentes e a elaboração de recomendações.",
        "Independência do Consultor\nO Consultor presta os seus serviços como prestador independente, sendo livre na organização do seu tempo e local de trabalho.",
        "Remuneração\nA remuneração baseia-se nas taxas de honorários acordadas. As despesas de viagem são reembolsadas separadamente.",
        "Confidencialidade\nO Consultor compromete-se a tratar confidencialmente todas as informações disponibilizadas no âmbito da consultoria.",
        "Responsabilidade\nA responsabilidade do Consultor é limitada ao montante dos honorários acordados.",
        "Disposições Finais\nAplica-se o direito suíço. O foro competente é a sede do Contratante.",
      ],
      nda: [
        "Definição de Informações Confidenciais\nSão consideradas confidenciais todas as informações de natureza técnica, comercial, financeira ou outra, transmitidas por uma parte à outra, independentemente do suporte.",
        "Obrigações da Parte Receptora\nA parte receptora compromete-se a tratar as informações confidenciais com o mesmo grau de cuidado que as suas próprias informações confidenciais.",
        "Exceções\nA obrigação de confidencialidade não se aplica a informações já públicas, já conhecidas da parte receptora, ou desenvolvidas independentemente.",
        "Duração\nA obrigação de confidencialidade aplica-se durante cinco (5) anos a partir da divulgação.",
        "Restituição\nA pedido, a parte receptora devolverá ou destruirá todas as informações confidenciais.",
        "Direito Aplicável\nAplica-se o direito suíço. O foro competente é a sede da parte divulgadora.",
      ],
      payment_order: [
        "Ordem de Pagamento\nO ordenante emite a presente instrução irrevogável de transferência do montante indicado para o beneficiário designado.",
        "Prazo de Execução\nO pagamento deve ser executado no prazo indicado ou, na sua ausência, dentro de três (3) dias úteis.",
        "Responsabilidade\nO ordenante confirma a exatidão dos dados de pagamento fornecidos.",
      ],
      partnership: [
        "Objeto da Parceria\nAs partes acordam uma parceria estratégica para o desenvolvimento comercial conjunto nas áreas acordadas.",
        "Direitos e Obrigações\nCada parte contribui com as suas competências e recursos específicos para a parceria.",
        "Partilha de Resultados\nA distribuição de receitas e custos segue a chave de repartição acordada.",
        "Confidencialidade\nAs partes comprometem-se a tratar confidencialmente todas as informações recebidas no âmbito da parceria.",
        "Duração e Rescisão\nA parceria é celebrada por tempo indeterminado com um pré-aviso de rescisão de seis (6) meses.",
        "Disposições Finais\nAplica-se o direito suíço. O foro competente é Zurique.",
      ],
      license: [
        "Objeto da Licença\nO Licenciante concede ao Licenciado um direito não exclusivo e intransferível de utilizar o objeto da licença no âmbito acordado.",
        "Âmbito de Utilização\nA licença autoriza a utilização exclusivamente para os fins acordados e no território acordado.",
        "Taxas de Licença\nO Licenciado compromete-se a pagar as taxas de licença acordadas trimestralmente e antecipadamente.",
        "Disposições Finais\nAplica-se o direito suíço. O foro competente é Zurique.",
      ],
      employment: [
        "Início de Funções\nO trabalhador inicia funções na data acordada e compromete-se a desempenhar as tarefas atribuídas com diligência.",
        "Horário de Trabalho\nO horário semanal de trabalho é o acordado. O local de trabalho é na sede do empregador.",
        "Remuneração\nO trabalhador recebe o salário mensal bruto acordado, pagável no final de cada mês.",
        "Período Experimental\nOs primeiros três (3) meses constituem o período experimental com um pré-aviso de sete (7) dias.",
        "Confidencialidade\nO trabalhador compromete-se a manter sigilo sobre todos os assuntos comerciais, mesmo após o término da relação de trabalho.",
        "Disposições Finais\nAplica-se o direito do trabalho suíço.",
      ],
    },
  };

  return terms[lang][type];
}

export function getContractPreamble(type: ContractType, lang: DocLanguage): string {
  return getPreamble(type, lang);
}

export const CONTRACT_TYPES: Array<{ id: ContractType; nameKey: string; names: Record<DocLanguage, string>; descriptions: Record<DocLanguage, string> }> = [
  {
    id: "service",
    nameKey: "service",
    names: { de: "Dienstleistungsvertrag", en: "Service Agreement", fr: "Contrat de services", pt: "Contrato de serviços" },
    descriptions: { de: "Für Dienstleistungen aller Art", en: "For services of all kinds", fr: "Pour tous types de services", pt: "Para serviços de todos os tipos" },
  },
  {
    id: "consulting",
    nameKey: "consulting",
    names: { de: "Beratungsvertrag", en: "Consulting Agreement", fr: "Contrat de conseil", pt: "Contrato de consultoria" },
    descriptions: { de: "Für Beratung und Expertise", en: "For consulting and expertise", fr: "Pour le conseil et l'expertise", pt: "Para consultoria e expertise" },
  },
  {
    id: "nda",
    nameKey: "nda",
    names: { de: "Vertraulichkeitsvereinbarung (NDA)", en: "Non-Disclosure Agreement (NDA)", fr: "Accord de confidentialité (NDA)", pt: "Acordo de confidencialidade (NDA)" },
    descriptions: { de: "Geheimhaltungsvertrag", en: "Confidentiality agreement", fr: "Accord de secret professionnel", pt: "Acordo de sigilo" },
  },
  {
    id: "partnership",
    nameKey: "partnership",
    names: { de: "Partnerschaftsvertrag", en: "Partnership Agreement", fr: "Contrat de partenariat", pt: "Contrato de parceria" },
    descriptions: { de: "Für Kooperationen und Joint Ventures", en: "For cooperations and joint ventures", fr: "Pour les coopérations et joint ventures", pt: "Para cooperações e joint ventures" },
  },
  {
    id: "license",
    nameKey: "license",
    names: { de: "Lizenzvertrag", en: "License Agreement", fr: "Contrat de licence", pt: "Contrato de licença" },
    descriptions: { de: "Für Lizenzierung von Rechten", en: "For licensing of rights", fr: "Pour la concession de droits", pt: "Para licenciamento de direitos" },
  },
  {
    id: "employment",
    nameKey: "employment",
    names: { de: "Arbeitsvertrag", en: "Employment Agreement", fr: "Contrat de travail", pt: "Contrato de trabalho" },
    descriptions: { de: "Für Arbeitsverhältnisse", en: "For employment relationships", fr: "Pour les relations de travail", pt: "Para relações de trabalho" },
  },
];

export const LANGUAGE_OPTIONS: Array<{ value: DocLanguage; label: string; flag: string }> = [
  { value: "de", label: "Deutsch", flag: "🇩🇪" },
  { value: "en", label: "English", flag: "🇬🇧" },
  { value: "fr", label: "Français", flag: "🇫🇷" },
  { value: "pt", label: "Português", flag: "🇵🇹" },
];
