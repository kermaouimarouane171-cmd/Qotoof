import { useState, useRef } from 'react'
import {
  CheckCircleIcon,
  ArrowDownTrayIcon,
  ShareIcon,
  PrinterIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline'
import { formatPrice } from '@/utils/currency'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'
import { APP_CONFIG } from '@/config/appConfig'

// @react-pdf/renderer is loaded dynamically inside handleDownloadPDF
// so its 643 kB bundle only downloads when the user clicks "Download PDF".

// Main Receipt Component
const Receipt = ({ order, className = '' }) => {
  const [generating, setGenerating] = useState(false)
  const receiptRef = useRef(null)
  const productTotal = Number(order?.vendor_product_total ?? order?.subtotal ?? order?.total ?? 0)
  const deliveryFee = Number(order?.delivery_fee_total ?? order?.shipping_cost ?? 0)
  const platformCommissionRate = Number(order?.platform_commission_rate_snapshot ?? 0.03)

  const handleDownloadPDF = async () => {
    setGenerating(true)
    try {
      // Dynamic import: @react-pdf/renderer only loads when user requests download
      const { pdf, Document, Page, Text, View, StyleSheet } = await import('@react-pdf/renderer')

      const styles = StyleSheet.create({
        page: { padding: 30, fontFamily: 'Helvetica', fontSize: 10 },
        header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 15, borderBottom: '2px solid #16a34a' },
        logo: { fontSize: 24, fontWeight: 'bold', color: '#16a34a' },
        receiptTitle: { fontSize: 18, fontWeight: 'bold', color: '#374151', textAlign: 'right' },
        section: { marginBottom: 15 },
        sectionTitle: { fontSize: 12, fontWeight: 'bold', color: '#16a34a', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid #e5e7eb' },
        row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
        label: { color: '#6b7280', fontSize: 9 },
        value: { color: '#374151', fontSize: 10, fontWeight: 'bold' },
        table: { marginTop: 10 },
        tableHeader: { flexDirection: 'row', backgroundColor: '#f3f4f6', padding: 8, fontWeight: 'bold', fontSize: 9 },
        tableRow: { flexDirection: 'row', padding: 8, borderBottom: '1px solid #e5e7eb', fontSize: 9 },
        col1: { flex: 3 }, col2: { flex: 1, textAlign: 'center' },
        col3: { flex: 1, textAlign: 'right' }, col4: { flex: 1, textAlign: 'right' },
        totalSection: { marginTop: 15, paddingTop: 10, borderTop: '2px solid #16a34a' },
        totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
        grandTotal: { fontSize: 14, fontWeight: 'bold', color: '#16a34a' },
        footer: { marginTop: 30, paddingTop: 15, borderTop: '1px solid #e5e7eb', textAlign: 'center', color: '#9ca3af', fontSize: 8 },
      })

      const ReceiptPDF = ({ order: o }) => (
        <Document>
          <Page size="A4" style={styles.page}>
            <View style={styles.header}>
              <View>
                <Text style={styles.logo}>Qotoof</Text>
                <Text style={{ fontSize: 8, color: '#6b7280', marginTop: 4 }}>B2B Wholesale Marketplace</Text>
              </View>
              <View>
                <Text style={styles.receiptTitle}>RECEIPT</Text>
                <Text style={{ fontSize: 9, color: '#6b7280', textAlign: 'right' }}>#{o?.id?.slice(0, 8) || 'N/A'}</Text>
              </View>
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Order Information</Text>
              <View style={styles.row}><Text style={styles.label}>Order Date:</Text><Text style={styles.value}>{o?.created_at ? new Date(o.created_at).toLocaleDateString() : 'N/A'}</Text></View>
              <View style={styles.row}><Text style={styles.label}>Status:</Text><Text style={[styles.value, { color: o?.status === 'delivered' ? '#16a34a' : '#d97706' }]}>{o?.status?.toUpperCase() || 'PENDING'}</Text></View>
              <View style={styles.row}><Text style={styles.label}>Payment Method:</Text><Text style={styles.value}>{o?.payment_method === 'cod' ? 'Cash on Delivery' : o?.payment_method || 'N/A'}</Text></View>
            </View>
            <View style={styles.section}>
              <View style={{ flexDirection: 'row', gap: 20 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Buyer</Text>
                  <Text style={styles.value}>{o?.buyer?.first_name || 'N/A'}</Text>
                  <Text style={{ fontSize: 9, color: '#6b7280' }}>{o?.buyer?.email || ''}</Text>
                  <Text style={{ fontSize: 9, color: '#6b7280' }}>{o?.buyer?.phone || ''}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Vendor</Text>
                  <Text style={styles.value}>{o?.vendor?.store_name || 'N/A'}</Text>
                  <Text style={{ fontSize: 9, color: '#6b7280' }}>{o?.vendor?.city || ''}</Text>
                </View>
              </View>
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Delivery Address</Text>
              <Text style={styles.value}>{o?.shipping_address || 'N/A'}</Text>
              <Text style={{ fontSize: 9, color: '#6b7280' }}>{o?.shipping_city || ''}{o?.shipping_city && o?.shipping_country ? ', ' : ''}{o?.shipping_country || 'Morocco'}</Text>
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Order Items</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={styles.col1}>Product</Text><Text style={styles.col2}>Qty</Text>
                  <Text style={styles.col3}>Price</Text><Text style={styles.col4}>Total</Text>
                </View>
                {o?.items?.map((item, index) => (
                  <View key={index} style={styles.tableRow}>
                    <Text style={styles.col1}>{item.product?.name || 'Product'}</Text>
                    <Text style={styles.col2}>{item.quantity}</Text>
                    <Text style={styles.col3}>MAD {item.price?.toFixed(2)}</Text>
                    <Text style={styles.col4}>MAD {(item.quantity * item.price).toFixed(2)}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.totalSection}>
              <View style={styles.totalRow}><Text style={styles.label}>Agricultural Products:</Text><Text style={styles.value}>MAD {(o?.vendor_product_total ?? o?.subtotal ?? o?.total ?? 0).toFixed(2)}</Text></View>
              <View style={styles.totalRow}><Text style={styles.label}>TVA:</Text><Text style={styles.value}>Exempt</Text></View>
              {Number(o?.delivery_fee_total ?? o?.shipping_cost ?? 0) > 0 && <View style={styles.totalRow}><Text style={styles.label}>Delivery Fee:</Text><Text style={styles.value}>MAD {(o?.delivery_fee_total ?? o?.shipping_cost ?? 0).toFixed(2)}</Text></View>}
              <View style={[styles.totalRow, { marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5e7eb' }]}><Text style={styles.grandTotal}>TOTAL DUE:</Text><Text style={styles.grandTotal}>MAD {o?.buyer_total?.toFixed(2) || o?.total?.toFixed(2)}</Text></View>
            </View>
            <View style={styles.footer}>
              <Text>Agricultural products are shown without TVA on this receipt.</Text>
              <Text style={{ marginTop: 4 }}>Platform commission {(Number(o?.platform_commission_rate_snapshot ?? 0.03) * 100).toFixed(0)}% is settled separately with the vendor at month-end.</Text>
              <Text style={{ marginTop: 4 }}>Available exclusively in Morocco</Text>
              <Text style={{ marginTop: 4 }}>{APP_CONFIG.supportEmail}</Text>
              <Text style={{ marginTop: 8, fontSize: 7 }}>Generated on {new Date().toLocaleString()}</Text>
            </View>
          </Page>
        </Document>
      )

      const blob = await pdf(<ReceiptPDF order={order} />).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Qotoof-Receipt-${order?.id?.slice(0, 8) || 'order'}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success('Receipt downloaded!')
    } catch (error) {
      logger.error('Error generating PDF:', error)
      toast.error('Failed to download receipt')
    } finally {
      setGenerating(false)
    }
  }

  const handlePrint = () => { window.print() }

  const handleCopyLink = async () => {
    const receiptUrl = `${window.location.origin}/orders/${order?.id}`
    try {
      await navigator.clipboard.writeText(receiptUrl)
      toast.success('Link copied to clipboard!')
    } catch {
      toast.error('Failed to copy link')
    }
  }

  const handleShare = async () => {
    const shareData = {
      title: 'Qotoof Order Receipt',
      text: `Order #${order?.id?.slice(0, 8)} - ${formatPrice(order?.total)}`,
      url: `${window.location.origin}/orders/${order?.id}`,
    }
    if (navigator.share) {
      try {
        await navigator.share(shareData)
        toast.success('Shared successfully!')
      } catch (err) {
        if (err.name !== 'AbortError') handleCopyLink()
      }
    } else {
      handleCopyLink()
    }
  }

  const handleShareWhatsApp = () => {
    const text = `Qotoof Order Receipt\nOrder #${order?.id?.slice(0, 8)}\nTotal: ${formatPrice(order?.total)}\nStatus: ${order?.status}\n\nView details: ${window.location.origin}/orders/${order?.id}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  const handleShareTelegram = () => {
    const text = `Qotoof Order #${order?.id?.slice(0, 8)} - ${formatPrice(order?.total)}`
    window.open(`https://t.me/share/url?url=${encodeURIComponent(`${window.location.origin}/orders/${order?.id}`)}&text=${encodeURIComponent(text)}`, '_blank')
  }

  const handleShareTwitter = () => {
    const text = `My Qotoof Order #${order?.id?.slice(0, 8)} - ${formatPrice(order?.total)}`
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank')
  }

  const handleShareFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${window.location.origin}/orders/${order?.id}`)}`, '_blank')
  }

  return (
    <div ref={receiptRef} className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${className}`}>
      {/* Receipt Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <CheckCircleIcon className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Order Receipt</h2>
              <p className="text-green-100 text-sm">#{order?.id?.slice(0, 8)}</p>
            </div>
          </div>
          <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
            order?.status === 'delivered' ? 'bg-green-400' :
            order?.status === 'pending' ? 'bg-yellow-400 text-yellow-900' :
            'bg-blue-400'
          }`}>
            {order?.status?.toUpperCase()}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleDownloadPDF} disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            {generating ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <ArrowDownTrayIcon className="w-4 h-4" />}
            Download PDF
          </button>
          <button onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors">
            <PrinterIcon className="w-4 h-4" />Print
          </button>
          <button onClick={handleCopyLink}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors">
            <ClipboardDocumentIcon className="w-4 h-4" />Copy Link
          </button>
          <button onClick={handleShare}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors">
            <ShareIcon className="w-4 h-4" />Share
          </button>
        </div>
      </div>

      {/* Order Details */}
      <div className="p-6">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Order Date</p>
            <p className="font-semibold text-gray-900">{order?.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A'}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Payment Method</p>
            <p className="font-semibold text-gray-900 capitalize">{order?.payment_method === 'cod' ? 'Cash on Delivery' : order?.payment_method || 'N/A'}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Buyer</h3>
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="font-medium text-gray-900">{order?.buyer?.first_name} {order?.buyer?.last_name}</p>
              <p className="text-sm text-gray-500">{order?.buyer?.email}</p>
              {order?.buyer?.phone && <p className="text-sm text-gray-500">{order.buyer.phone}</p>}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Vendor</h3>
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="font-medium text-gray-900">{order?.vendor?.store_name || 'Vendor'}</p>
              {order?.vendor?.city && <p className="text-sm text-gray-500">{order.vendor.city}</p>}
            </div>
          </div>
        </div>
        {order?.shipping_address && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Delivery Address</h3>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-gray-900">{order.shipping_address}</p>
              <p className="text-sm text-gray-500">{order.shipping_city}{order.shipping_city && order.shipping_country ? ', ' : ''}{order.shipping_country || 'Morocco'}</p>
            </div>
          </div>
        )}
        {order?.items && order.items.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Order Items</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-3 font-medium text-gray-500">Product</th>
                    <th className="text-center p-3 font-medium text-gray-500">Qty</th>
                    <th className="text-right p-3 font-medium text-gray-500">Price</th>
                    <th className="text-right p-3 font-medium text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {order.items.map((item, index) => (
                    <tr key={item.id || index}>
                      <td className="p-3 font-medium text-gray-900">{item.product?.name || 'Product'}</td>
                      <td className="p-3 text-center text-gray-600">{item.quantity}</td>
                      <td className="p-3 text-right text-gray-600">{formatPrice(item.price)}</td>
                      <td className="p-3 text-right font-semibold text-gray-900">{formatPrice(item.quantity * item.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div className="border-t border-gray-200 pt-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">قيمة المنتجات الفلاحية</span>
              <span className="font-medium">{formatPrice(productTotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">TVA</span>
              <span className="font-medium">معفاة</span>
            </div>
            {deliveryFee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">رسم التوصيل</span>
                <span className="font-medium">{formatPrice(deliveryFee)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-3">
              <span>الإجمالي المستحق</span>
              <span className="text-green-600">{formatPrice(order?.buyer_total || order?.total)}</span>
            </div>
            <div className="rounded-xl bg-gray-50 px-4 py-3 text-xs leading-6 text-gray-600">
              عمولة المنصة بنسبة {(platformCommissionRate * 100).toFixed(0)}% تُسوّى بشكل منفصل مع البائع في نهاية الشهر، ولا تُعرض كـ TVA على هذه الوثيقة.
            </div>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <ShareIcon className="w-4 h-4" />Share Receipt
          </h3>
          <div className="flex flex-wrap gap-2">
            <button onClick={handleShareWhatsApp} className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp
            </button>
            <button onClick={handleShareTelegram} className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
              Telegram
            </button>
            <button onClick={handleShareTwitter} className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              X
            </button>
            <button onClick={handleShareFacebook} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              Facebook
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Receipt
