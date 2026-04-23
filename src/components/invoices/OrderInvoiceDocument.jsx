import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 28, fontFamily: 'Helvetica', fontSize: 10, color: '#1f2937' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, paddingBottom: 14, borderBottom: '2px solid #16a34a' },
  brandTitle: { fontSize: 22, fontWeight: 'bold', color: '#16a34a' },
  brandSubtitle: { fontSize: 8, color: '#6b7280', marginTop: 4 },
  docTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'right' },
  docMeta: { fontSize: 9, color: '#6b7280', textAlign: 'right', marginTop: 4 },
  twoCol: { flexDirection: 'row', gap: 16, marginBottom: 14 },
  panel: { flex: 1, border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, backgroundColor: '#f9fafb' },
  panelTitle: { fontSize: 11, fontWeight: 'bold', color: '#16a34a', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontSize: 9, color: '#6b7280' },
  value: { fontSize: 10, fontWeight: 'bold', color: '#111827' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#ecfdf5', borderTop: '1px solid #a7f3d0', borderBottom: '1px solid #a7f3d0', paddingVertical: 8, paddingHorizontal: 6, fontSize: 9, fontWeight: 'bold', color: '#065f46' },
  tableRow: { flexDirection: 'row', borderBottom: '1px solid #e5e7eb', paddingVertical: 8, paddingHorizontal: 6, fontSize: 9 },
  colName: { flex: 3 },
  colQty: { flex: 1, textAlign: 'center' },
  colPrice: { flex: 1.2, textAlign: 'right' },
  totalsBox: { marginTop: 16, marginLeft: 'auto', width: 240, border: '1px solid #d1fae5', borderRadius: 8, padding: 12, backgroundColor: '#f0fdf4' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  grandRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '1px solid #a7f3d0' },
  grandLabel: { fontSize: 11, fontWeight: 'bold', color: '#047857' },
  grandValue: { fontSize: 12, fontWeight: 'bold', color: '#047857' },
  footer: { marginTop: 24, paddingTop: 12, borderTop: '1px solid #e5e7eb', fontSize: 8, color: '#6b7280', textAlign: 'center' },
})

const formatMoney = (value) => `${Number(value || 0).toFixed(2)} MAD`

const formatDate = (value) => {
  if (!value) return 'N/A'
  return new Date(value).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

const resolveBuyerName = (order) => {
  const fullName = `${order?.buyer?.first_name || ''} ${order?.buyer?.last_name || ''}`.trim()
  return fullName || order?.shipping_name || 'Buyer'
}

const OrderInvoiceDocument = ({ order, invoice }) => {
  const items = order?.items || []
  const productTotal = invoice?.subtotal ?? order?.vendor_product_total ?? order?.subtotal ?? order?.total
  const deliveryFee = invoice?.shipping_total ?? order?.delivery_fee_total ?? order?.shipping_cost ?? order?.shipping_total
  const totalPaid = invoice?.grand_total ?? order?.grand_total ?? order?.buyer_total ?? order?.total
  const platformCommissionRate = Number(invoice?.metadata?.platform_commission_rate_snapshot ?? order?.platform_commission_rate_snapshot ?? 0.03)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brandTitle}>Qotoof</Text>
            <Text style={styles.brandSubtitle}>Official Marketplace Invoice</Text>
          </View>
          <View>
            <Text style={styles.docTitle}>INVOICE</Text>
            <Text style={styles.docMeta}>{invoice?.invoice_number || order?.invoice_number || 'Pending'}</Text>
            <Text style={styles.docMeta}>Issued {formatDate(invoice?.issued_at || order?.invoice_generated_at || order?.created_at)}</Text>
          </View>
        </View>

        <View style={styles.twoCol}>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Order Information</Text>
            <View style={styles.row}><Text style={styles.label}>Order Number</Text><Text style={styles.value}>{order?.order_number || order?.id?.slice(0, 8) || 'N/A'}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Order Date</Text><Text style={styles.value}>{formatDate(order?.created_at)}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Order Status</Text><Text style={styles.value}>{String(order?.status || 'pending').toUpperCase()}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Payment Type</Text><Text style={styles.value}>{order?.payment_type || order?.payment_method || 'N/A'}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Delivery Fee Payment</Text><Text style={styles.value}>{invoice?.metadata?.driver_delivery_payment_method || order?.driver_delivery_payment_method || 'cash'}</Text></View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Invoice Parties</Text>
            <View style={styles.row}><Text style={styles.label}>Vendor</Text><Text style={styles.value}>{order?.vendor?.store_name || 'Vendor'}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Buyer</Text><Text style={styles.value}>{resolveBuyerName(order)}</Text></View>
            <View style={styles.row}><Text style={styles.label}>City</Text><Text style={styles.value}>{order?.shipping_city || order?.vendor?.city || 'N/A'}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Currency</Text><Text style={styles.value}>{invoice?.currency || order?.currency || 'MAD'}</Text></View>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Delivery Address</Text>
          <Text style={styles.value}>{order?.shipping_address || 'N/A'}</Text>
        </View>

        <View style={{ marginTop: 16 }}>
          <View style={styles.tableHeader}>
            <Text style={styles.colName}>Product</Text>
            <Text style={styles.colQty}>Qty</Text>
            <Text style={styles.colPrice}>Unit Price</Text>
            <Text style={styles.colPrice}>Line Total</Text>
          </View>
          {items.map((item, index) => {
            const unitPrice = Number(item.unit_price || item.price || item.price_per_unit || 0)
            const lineTotal = Number(item.quantity || 0) * unitPrice

            return (
              <View key={item.id || index} style={styles.tableRow}>
                <Text style={styles.colName}>{item.product?.name || item.name || 'Product'}</Text>
                <Text style={styles.colQty}>{item.quantity}</Text>
                <Text style={styles.colPrice}>{formatMoney(unitPrice)}</Text>
                <Text style={styles.colPrice}>{formatMoney(lineTotal)}</Text>
              </View>
            )
          })}
        </View>

        <View style={styles.totalsBox}>
          <View style={styles.totalRow}><Text style={styles.label}>Agricultural Products</Text><Text style={styles.value}>{formatMoney(productTotal)}</Text></View>
          <View style={styles.totalRow}><Text style={styles.label}>TVA</Text><Text style={styles.value}>Exempt</Text></View>
          <View style={styles.totalRow}><Text style={styles.label}>Delivery Fee</Text><Text style={styles.value}>{formatMoney(deliveryFee)}</Text></View>
          <View style={styles.totalRow}><Text style={styles.label}>Discounts</Text><Text style={styles.value}>{formatMoney(invoice?.discount_total ?? order?.discount_total)}</Text></View>
          <View style={styles.grandRow}><Text style={styles.grandLabel}>Total Due</Text><Text style={styles.grandValue}>{formatMoney(totalPaid)}</Text></View>
        </View>

        <View style={styles.footer}>
          <Text>Agricultural products sold through Qotoof are exempt from TVA according to the applicable Moroccan treatment for this flow.</Text>
          <Text>Platform commission note: {(platformCommissionRate * 100).toFixed(0)}% is settled separately with the vendor at month-end and is not a TVA line for the buyer invoice.</Text>
          <Text>Invoice status: {String(invoice?.status || order?.invoice_status || 'generated').toUpperCase()}</Text>
        </View>
      </Page>
    </Document>
  )
}

export default OrderInvoiceDocument