# Payment Edge Functions - Deployment Guide

## Overview

This guide covers the deployment and configuration of Supabase Edge Functions for the Qotoof payment system.

## Functions Created

| Function | Purpose | Authentication |
|----------|---------|----------------|
| `create-cmi-session` | Creates CMI 3D Secure payment sessions | No JWT required |
| `verify-cmi-callback` | Verifies CMI payment callbacks | No JWT required |
| `refund-cmi-payment` | Processes CMI payment refunds | JWT required |
| `confirm-bank-transfer` | Handles bank transfer confirmations | Mixed (GET: no, POST: yes) |

## Prerequisites

1. **Supabase CLI installed**
   ```bash
   npm install -g supabase
   ```

2. **Logged into Supabase**
   ```bash
   supabase login
   ```

3. **Environment variables configured** (see `.env.example`)

## Environment Variables Setup

### CMI Payment Gateway

Get these from your CMI merchant account at https://www.cmi.co.ma:

```bash
# Merchant credentials
CMI_MERCHANT_ID=your_merchant_id
CMI_STORE_KEY=your_store_key

# API endpoints (usually don't need to change)
CMI_API_URL=https://payment.cmi.co.ma/fim/api
CMI_REFUND_URL=https://payment.cmi.co.ma/fim/Refund

# Callback URLs (update with your domain)
CMI_SUCCESS_URL=https://yourdomain.ma/payment/success
CMI_FAIL_URL=https://yourdomain.ma/payment/fail

# Language: en, fr, ar
CMI_LANG=en
```

### Bank Transfer

Configure your business bank account details:

```bash
BANK_NAME=Attijariwafa Bank
BANK_ACCOUNT_NUMBER=your_account_number
BANK_RIB=your_rib
BANK_IBAN=your_iban
BANK_BENEFICIARY=Your Company SARL
BANK_TRANSFER_DETAILS=Include your order ID as transfer reference
```

### Supabase (Required for all functions)

```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

⚠️ **Security Note**: Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend code. It's only for edge functions.

## Deployment

### Deploy All Functions

```bash
# Deploy all payment functions
supabase functions deploy create-cmi-session --no-verify-jwt
supabase functions deploy verify-cmi-callback --no-verify-jwt
supabase functions deploy refund-cmi-payment
supabase functions deploy confirm-bank-transfer
```

### Deploy with Environment Variables

```bash
# Set secrets for each function
supabase secrets set CMI_MERCHANT_ID=your_id
supabase secrets set CMI_STORE_KEY=your_key
supabase secrets set CMI_API_URL=https://payment.cmi.co.ma/fim/api
supabase secrets set CMI_REFUND_URL=https://payment.cmi.co.ma/fim/Refund
supabase secrets set CMI_SUCCESS_URL=https://yourdomain.ma/payment/success
supabase secrets set CMI_FAIL_URL=https://yourdomain.ma/payment/fail
supabase secrets set CMI_LANG=en
supabase secrets set BANK_NAME="Attijariwafa Bank"
supabase secrets set BANK_ACCOUNT_NUMBER=your_account
supabase secrets set BANK_RIB=your_rib
supabase secrets set BANK_IBAN=your_iban
supabase secrets set BANK_BENEFICIARY="Your Company SARL"
```

### Verify Deployment

```bash
# List all deployed functions
supabase functions list

# Test a function
curl -X POST https://your-project-id.supabase.co/functions/v1/create-cmi-session \
  -H "Content-Type: application/json" \
  -d '{"orderId":"test-123","amount":100}'
```

## Function Details

### 1. create-cmi-session

**Endpoint**: `POST /functions/v1/create-cmi-session`

**Purpose**: Creates a CMI 3D Secure payment session and returns the payment URL and form data.

**Request Body**:
```json
{
  "orderId": "order-uuid-here",
  "amount": 250.00,
  "currency": "MAD",
  "customerName": "John Doe",
  "customerEmail": "john@example.com",
  "customerPhone": "+212612345678",
  "billingAddress": {
    "street": "123 Main St",
    "city": "Casablanca",
    "postalCode": "20000",
    "country": "MA"
  },
  "installment": "0",
  "transactionType": "Auth",
  "metadata": {
    "userId": "user-uuid",
    "cartId": "cart-uuid"
  }
}
```

**Response**:
```json
{
  "success": true,
  "paymentUrl": "https://payment.cmi.co.ma/fim/api",
  "formData": {
    "oid": "QTO-order-uuid-1234567890",
    "amount": "25000",
    "okUrl": "https://yourdomain.ma/payment/success",
    "failUrl": "https://yourdomain.ma/payment/fail",
    "transactionType": "Auth",
    "installment": "0",
    "currency": "944",
    "merchantId": "your_merchant_id",
    "hash": "base64-encoded-signature",
    "lang": "en",
    "email": "john@example.com",
    "DATA_ORDER_ID": "order-uuid-here",
    "DATA_PLATFORM": "qotoof"
  },
  "cmiOrderId": "QTO-order-uuid-1234567890",
  "message": "Redirect to CMI payment page"
}
```

**Frontend Integration**:
```javascript
// 1. Create CMI session
const response = await fetch(`${SUPABASE_URL}/functions/v1/create-cmi-session`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ orderId, amount, currency: 'MAD', customerName, customerEmail }),
})

const { paymentUrl, formData } = await response.json()

// 2. Create and submit form to redirect to CMI
const form = document.createElement('form')
form.method = 'POST'
form.action = paymentUrl

Object.entries(formData).forEach(([key, value]) => {
  const input = document.createElement('input')
  input.type = 'hidden'
  input.name = key
  input.value = value
  form.appendChild(input)
})

document.body.appendChild(form)
form.submit()
```

### 2. verify-cmi-callback

**Endpoint**: `POST /functions/v1/verify-cmi-callback`

**Purpose**: Verifies CMI payment callback signature and updates order/payment status.

**Request Body** (sent by CMI after payment):
```json
{
  "oid": "QTO-order-uuid-1234567890",
  "Response": "Approved",
  "ResponseMsg": "Successfully authorized",
  "TransId": "12345678",
  "currency": "944",
  "amount": "25000",
  "transactionType": "Auth",
  "installment": "0",
  "hash": "base64-signature-from-cmi",
  "ProcReturnCode": "00",
  "DATA_ORDER_ID": "order-uuid-here",
  "DATA_PLATFORM": "qotoof"
}
```

**Response**:
```json
{
  "success": true,
  "orderId": "order-uuid-here",
  "cmiOrderId": "QTO-order-uuid-1234567890",
  "transactionId": "12345678",
  "status": "completed",
  "message": "Payment successful",
  "verified": true
}
```

**CMI Callback Configuration**:
- Set your success URL to: `https://yourdomain.ma/payment/success`
- Set your fail URL to: `https://yourdomain.ma/payment/fail`
- Both URLs should call this edge function and then redirect the user

### 3. refund-cmi-payment

**Endpoint**: `POST /functions/v1/refund-cmi-payment`

**Purpose**: Processes a refund for a completed CMI payment.

**Request Body**:
```json
{
  "orderId": "order-uuid-here",
  "amount": 250.00,
  "reason": "Customer requested cancellation",
  "refundType": "Credit",
  "requestedBy": "admin-user-id",
  "notes": "Full refund for order #12345"
}
```

**Response** (Success):
```json
{
  "success": true,
  "orderId": "order-uuid-here",
  "refundAmount": 250.00,
  "refundTransactionId": "REFUND-1234567890",
  "status": "refunded",
  "message": "Refund processed successfully",
  "cmiResponse": {
    "TransId": "87654321",
    "Response": "Approved",
    "ProcReturnCode": "00"
  }
}
```

**Response** (Error):
```json
{
  "error": "Refund declined by bank",
  "cmiResponse": {
    "Response": "Declined",
    "ProcReturnCode": "05"
  },
  "code": "05"
}
```

### 4. confirm-bank-transfer

**Endpoint**: `GET/POST /functions/v1/confirm-bank-transfer`

**Purpose**: 
- GET: Returns bank transfer details for an order
- POST: Confirms a bank transfer payment

**GET Request**:
```
GET /functions/v1/confirm-bank-transfer?orderId=order-uuid
```

**GET Response**:
```json
{
  "success": true,
  "orderId": "order-uuid",
  "amount": 250.00,
  "currency": "MAD",
  "bankDetails": {
    "bankName": "Attijariwafa Bank",
    "accountNumber": "123456789",
    "rib": "012345678901234567890123",
    "iban": "MA64012345678901234567890123",
    "beneficiary": "Qotoof SARL",
    "additionalInfo": "Include your order ID as transfer reference"
  },
  "instructions": [
    "Transfer the exact amount to the bank account above",
    "Use your order ID as transfer reference",
    "Upload the transfer receipt in your order dashboard",
    "Your order will be processed once payment is confirmed"
  ]
}
```

**POST Request**:
```json
{
  "orderId": "order-uuid-here",
  "transactionId": "bank-transfer-ref",
  "transferProofUrl": "https://storage.url/proof.jpg",
  "bankName": "BMCE Bank",
  "accountNumber": "customer-account",
  "transferDate": "2024-01-15",
  "notes": "Transfer completed"
}
```

**POST Response**:
```json
{
  "success": true,
  "orderId": "order-uuid-here",
  "status": "processing",
  "message": "Bank transfer confirmation submitted successfully",
  "nextSteps": "Your payment is being reviewed. You will receive a confirmation once verified."
}
```

## Security Considerations

### 1. Signature Verification
- All CMI callbacks are verified using SHA1 hash signatures
- Invalid signatures are rejected with 400 status

### 2. Environment Variables
- All secrets are stored in Supabase Secrets, not in code
- Never commit `.env` files to version control

### 3. Audit Logging
- All payment actions are logged to `financial_audit_log` table
- Includes: who performed the action, when, and why

### 4. Idempotency
- CMI order IDs include timestamps to prevent duplicates
- Refund checks prevent double-refunding

### 5. CORS
- All functions allow cross-origin requests from any origin
- Restrict this in production by updating CORS headers

## Testing

### Test CMI Payment Flow

```bash
# 1. Create payment session
curl -X POST https://your-project.supabase.co/functions/v1/create-cmi-session \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "orderId": "test-order-123",
    "amount": 100,
    "currency": "MAD",
    "customerEmail": "test@example.com"
  }'

# 2. Simulate CMI callback
curl -X POST https://your-project.supabase.co/functions/v1/verify-cmi-callback \
  -H "Content-Type: application/json" \
  -d '{
    "oid": "QTO-test-order-123-1234567890",
    "Response": "Approved",
    "TransId": "12345",
    "amount": "10000",
    "currency": "944",
    "hash": "calculate-hash-with-store-key",
    "ProcReturnCode": "00",
    "DATA_ORDER_ID": "test-order-123"
  }'
```

### Test Bank Transfer

```bash
# Get bank details
curl "https://your-project.supabase.co/functions/v1/confirm-bank-transfer?orderId=test-order-123"

# Submit transfer confirmation
curl -X POST https://your-project.supabase.co/functions/v1/confirm-bank-transfer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "orderId": "test-order-123",
    "transactionId": "TRF-12345",
    "transferProofUrl": "https://example.com/proof.jpg",
    "bankName": "BMCE",
    "transferDate": "2024-01-15"
  }'
```

## Troubleshooting

### Common Issues

1. **"Payment gateway not configured"**
   - Check that CMI_MERCHANT_ID and CMI_STORE_KEY are set
   - Run: `supabase secrets set CMI_MERCHANT_ID=xxx CMI_STORE_KEY=xxx`

2. **"Invalid signature"**
   - Verify CMI_STORE_KEY matches your CMI account
   - Check hash generation algorithm matches CMI spec

3. **"Order not found"**
   - Verify the orderId exists in the database
   - Check RLS policies allow the function to access the data

4. **CORS errors**
   - Ensure OPTIONS method is handled (it is in all functions)
   - Check browser console for specific CORS error

### View Function Logs

```bash
# View logs in Supabase dashboard
# Go to: https://app.supabase.com/project/_/logs

# Or use CLI
supabase functions logs create-cmi-session
supabase functions deploy verify-cmi-callback --no-verify-jwt
```

## Monitoring

### Key Metrics to Track

- Payment success rate
- Average payment processing time
- Refund rate
- Failed callback count
- Bank transfer confirmation time

### Database Queries

```sql
-- Payment success rate
SELECT 
  status,
  COUNT(*) as count,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage
FROM payments
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY status;

-- Average refund processing time
SELECT 
  AVG(EXTRACT(EPOCH FROM (refunded_at - paid_at))) / 3600 as avg_hours
FROM payments
WHERE status = 'refunded' AND refunded_at IS NOT NULL;

-- Bank transfer pending count
SELECT COUNT(*) 
FROM payments 
WHERE status = 'processing' AND payment_method = 'bank_transfer';
```

## Support

- **CMI Support**: contact@cmi.co.ma | +212 522 000 000
- **Supabase Docs**: https://supabase.com/docs/guides/functions
- **Project Issues**: https://github.com/your-org/qotoof/issues
