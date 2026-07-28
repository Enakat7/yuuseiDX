import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";

// 発注書・支払通知書などの帳票PDFで共有するヘッダー/フッターのシェル。
// 実際の帳票デザイン（クライアント提供の紙のひな形）は未確定のため、
// デザイン確定後に各帳票コンポーネント側の中身だけ差し替えられるようにしてある。

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    borderBottom: "2pt solid #000",
    paddingBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
  },
  meta: {
    textAlign: "right",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 32,
    right: 32,
    textAlign: "center",
    fontSize: 8,
    color: "#666",
  },
});

export function PdfLayout({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: ReactNode;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {meta && <Text style={styles.meta}>{meta}</Text>}
        </View>
        {children}
        <Text style={styles.footer} fixed>
          YOU SAY!!
        </Text>
      </Page>
    </Document>
  );
}
