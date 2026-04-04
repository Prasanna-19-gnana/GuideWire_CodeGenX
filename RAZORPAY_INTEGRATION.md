# Razorpay Autopayout Integration Guide

## Overview
This document outlines the Razorpay autopayout integration for automatic claim disbursements in ZyroSafe.

## Architecture

### Flow Diagram
```
Claim Approved → Risk Score < 70 → Calculate Payout Amount 
    ↓
Record Transaction in MongoDB 
    ↓
Trigger Razorpay Payout API Endpoint 
    ↓
Razorpay Service (Test/Live Mode) 
    ↓
Fund Transfer to Recipient 
    ↓
Update Transaction with Payout Status
```

## Implementation Details

### 1. Backend Integration

#### Environment Variables (`server/.env`)
```env
# Razorpay Configuration
RAZORPAY_KEY_ID=rzp_test_1DP5mmOlF5G5ag           # Test Key ID
RAZORPAY_KEY_SECRET=w6pLP4zuDcnd1Bl06u82FY7g     # Test Key Secret
RAZORPAY_MODE=test                                 # test or live
```

#### Backend Endpoint: `/api/razorpay-payout`

**Method:** POST

**Request Body:**
```json
{
  "email": "user@example.com",                    // User email
  "transactionId": "txn_abc123",                  // Transaction ID from MongoDB
  "amount": 500,                                   // Payout amount in ₹
  "description": "Insurance claim autopayout",    // Payout description
  "recipientPhone": "9876543210",                 // Optional: recipient phone
  "recipientUPI": "user@upi"                      // Optional: VPA for UPI payouts
}
```

**Response (Success):**
```json
{
  "success": true,
  "payout": {
    "id": "payout_xyz789",                        // Razorpay Payout ID
    "amount": 500,
    "status": "processed",                         // or "queued", "reversed"
    "entity": "payout",
    "mode": "test"                                 // or "live"
  },
  "message": "Payout of ₹500 initiated via Razorpay (Status: processed)"
}
```

**Response (Fallback/Simulation):**
```json
{
  "success": true,
  "payout": {
    "id": "payout_fallback_abc123",
    "amount": 500,
    "status": "simulated",
    "entity": "payout",
    "mode": "FALLBACK"
  },
  "message": "Payout processed in fallback mode (Razorpay keys not configured)"
}
```

#### Key Features:
- **Automatic Fallback**: If Razorpay keys not configured, payouts are simulated
- **Amount Validation**: Minimum payout amount: ₹10
- **Mode Auto-detection**: Switches between test and live mode based on env config
- **Transaction Tracking**: Razorpay payout ID stored in transaction metadata
- **Error Handling**: Graceful fallback with simulation payout on API errors

### 2. Frontend Integration

#### Modified Component: `src/components/Dashboard.jsx`

**Claim Approval Flow:**
1. Risk score calculated
2. If score < 70 and amount > 0:
   - Payout recorded in MongoDB transaction
   - Razorpay payout endpoint triggered automatically
   - Payout status tracked in transaction metadata

**Code Implementation:**
```javascript
// In triggerSystem() function, after claim approved:
if (created && payoutAmount > 0) {
  try {
    const payoutRes = await fetchWithTimeout(`${API_BASE}/razorpay-payout`, {
      method: 'POST',
      body: JSON.stringify({
        email: userEmail,
        transactionId: created.id,
        amount: payoutAmount,
        description: 'Insurance claim autopayout - Weather disruption',
        recipientPhone: profileState?.phone,
        recipientUPI: profileState?.upi,
      }),
    }, API_TIMEOUT);

    if (payoutRes.ok) {
      const payoutData = await payoutRes.json();
      console.log('Razorpay payout initiated:', payoutData);
    }
  } catch (err) {
    console.warn('Razorpay payout request failed:', err.message);
  }
}
```

### 3. Database Schema Updates

**MongoDB Collection: `transactions`**

Transaction document structure with Razorpay metadata:
```javascript
{
  id: "txn_unique_id",
  email: "user@example.com",
  userId: "user_123",
  type: "autopayout",
  status: "completed",
  amount: 500,
  description: "Model autopayout released",
  timestamp: "2024-04-02T10:30:00.000Z",
  metadata: {
    score: 35,
    sim: {
      mode: "SIMULATION",
      rainfall: 80,
      temperature: 42,
      event: "Heat Wave"
    },
    geoPosition: { lat: 12.9716, lng: 77.5946 },
    fraud: { score: 18, action: "approved" },
    
    // NEW: Razorpay payout details
    razorpayPayoutId: "payout_xyz789",
    razorpayStatus: "processed",           // processed, queued, reversed, failed
    payoutProcessedAt: "2024-04-02T10:30:05.000Z"
  }
}
```

## Modes of Operation

### Test Mode (Default for Development)
- **Environment**: `RAZORPAY_MODE=test`
- **API Keys**: Test keys from Razorpay dashboard
- **Behavior**: Payouts are processed in test environment
- **Funds**: Virtual test funds only
- **Use Case**: Development, staging, and demos

### Simulation Mode (Fallback)
- **When**: Razorpay keys not configured
- **Behavior**: Simulates payout without calling Razorpay API
- **Status**: `"simulated"` or `"fallback"`
- **Use Case**: Quick demos without API setup

### Live Mode (Production)
- **Environment**: `RAZORPAY_MODE=live`
- **API Keys**: Production keys from Razorpay live dashboard
- **Behavior**: Real fund transfers
- **Funds**: Actual bank transfers
- **Use Case**: Production deployment

## Setup Instructions

### 1. Create Razorpay Account
1. Go to https://razorpay.com
2. Sign up or log in
3. Complete merchant onboarding

### 2. Get API Keys
1. Navigate to Settings → API Keys
2. Copy Key ID and Key Secret for test mode
3. Update `server/.env`:
   ```env
   RAZORPAY_KEY_ID=rzp_test_xxxxxxxx
   RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxx
   RAZORPAY_MODE=test
   ```

### 3. Enable Payout Feature
1. In Razorpay dashboard: Settings → Webhooks
2. Add webhook URL: `http://your-domain/razorpay-webhook`
3. Select: Payout events (payout.processed, payout.failed, etc.)

### 4. Configure Account for Payouts
1. In Razorpay dashboard: Payouts → Settings
2. Enable Payout API
3. Create a merchant bank account or link existing bank

### 5. Test Integration
```bash
# Terminal 1: Start backend
npm run server

# Terminal 2: Start frontend
npm run dev

# Terminal 3: Test payout endpoint
curl -X POST http://localhost:3001/api/razorpay-payout \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "transactionId": "txn_test_123",
    "amount": 100,
    "description": "Test payout"
  }'
```

## Webhook Handling (Optional Enhancement)

Razorpay sends webhook events for payout status updates:

```javascript
// Webhook endpoint example (to be added)
app.post('/razorpay-webhook', async (req, res) => {
  const event = req.body.event;
  const payload = req.body.payload;

  switch(event) {
    case 'payout.processed':
      // Update transaction status
      await mongoCollections.transactions.updateOne(
        { 'metadata.razorpayPayoutId': payload.payout.id },
        { $set: { 'metadata.razorpayStatus': 'processed' } }
      );
      break;
      
    case 'payout.failed':
      // Handle failed payout
      console.log('Payout failed:', payload);
      break;
  }

  res.json({ success: true });
});
```

## Error Handling & Fallback Behavior

| Scenario | Behavior | Response |
|----------|----------|----------|
| Razorpay keys not configured | Simulation mode | `"mode": "FALLBACK"` |
| Amount < ₹10 | Rejected | 400 error |
| API timeout | Fallback simulation | Payout ID with `"mode": "FALLBACK"` |
| Network error | Fallback simulation | Payout ID with `"mode": "FALLBACK"` |
| MongoDB unavailable | Still completes payout | Metadata not stored |
| Valid test payout | Succeeds | Razorpay payout ID returned |

## Monitoring & Debugging

### Check Payout Status in Dashboard
1. Go to Razorpay Dashboard → Payouts
2. Search by Payout ID
3. View: Amount, Status, Recipient, Timestamp

### Monitor Logs
```bash
# Backend logs
tail -f /tmp/backend.log

# Search for Razorpay logs
grep -i razorpay /tmp/backend.log

# Check specific transaction
curl http://localhost:3001/api/transactions?email=user@example.com
```

### Test Data
- **Test Amount**: Use any amount (₹1 to ₹100,000+)
- **Test UPI**: Use any UPI ID format (e.g., user@upi)
- **Test Phone**: Use any 10-digit number

## Migration to Live

When ready for production:

1. **Get Live Keys**
   - Switch to Live Keys in Razorpay dashboard
   - Copy new Key ID and Secret

2. **Update Environment**
   ```env
   RAZORPAY_KEY_ID=rzp_live_xxxxxxxx
   RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxx
   RAZORPAY_MODE=live
   ```

3. **Test with Real Amount**
   - Submit small test claim (₹50-100)
   - Verify payout in Razorpay dashboard
   - Check recipient bank account

4. **Enable Webhooks**
   - Configure webhook URL in production
   - Set: payout.processed, payout.failed events
   - Test webhook delivery

5. **Monitor First Week**
   - Watch claim volumes
   - Check payout success rate
   - Monitor customer support tickets

## API Reference

### Dependencies
```json
{
  "razorpay": "^2.9.2"
}
```

### Razorpay API Documentation
- https://razorpay.com/docs/api/payouts/
- https://razorpay.com/docs/webhooks/

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Cannot read properties of undefined (reading 'create')" | Razorpay keys not configured; enable simulation mode |
| Payout Amount Too Low | Minimum: ₹10; adjust claim payout logic |
| Account Not Ready | Razorpay dashboard: Complete merchant setup for Payouts |
| Webhook Not Received | Check webhook URL is public & accessible; verify port forwarding |
| Test Mode Transaction Failed | Use test payout limit (₹1-₹100,000), check balance |

## Next Steps

1. **Update User Profile** - Add UPI/Bank Account collection in signup
2. **Add Payout History UI** - Show payout status timeline to users
3. **Webhook Integration** - Auto-update UI when payout status changes
4. **Compliance** - Implement KYC/AML checks if required by RBI
5. **Reconciliation** - Daily reconciliation with Razorpay API

## Questions?
- Razorpay Support: https://support.razorpay.com
- API Docs: https://razorpay.com/docs
