# Razorpay Integration: Test Verification Checklist

## Pre-Test Verification

Run this to ensure everything is ready:

```bash
# 1. Verify Razorpay package installed
npm list razorpay
# Should show: razorpay@2.9.2 (or similar)

# 2. Check backend is running on port 3001
curl -s http://localhost:3001/api/transactions?email=test@test.com
# Should return JSON with list of transactions (possibly empty)

# 3. Check frontend is running on port 5173
curl -s http://localhost:5173 | head -5
# Should return HTML starting with <!DOCTYPE html>

# 4. Verify .env has Razorpay keys
grep RAZORPAY server/.env
# Should show three lines with RAZORPAY_* variables
```

## Test 1: Direct Endpoint Test (No Frontend)

**Purpose**: Verify the `/api/razorpay-payout` endpoint works

**Steps**:
```bash
# Make a direct payout request
curl -X POST http://localhost:3001/api/razorpay-payout \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-user@example.com",
    "transactionId": "txn_test_001",
    "amount": 500,
    "description": "Test payout - Weather disruption claim",
    "recipientPhone": "9876543210"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "payout": {
    "id": "payout_fallback_abc123xyz",
    "amount": 500,
    "status": "simulated",
    "entity": "payout",
    "mode": "FALLBACK"
  },
  "message": "Payout processed in fallback mode (Razorpay keys not configured)"
}
```

**✅ Pass Criteria**:
- ✓ HTTP 200 status
- ✓ `"success": true`
- ✓ Payout ID returned
- ✓ Mode is "FALLBACK" (expected without real keys) or "test"/"live"

---

## Test 2: Invalid Request Handling

**Purpose**: Verify error handling

### Test 2a: Missing Required Fields
```bash
curl -X POST http://localhost:3001/api/razorpay-payout \
  -H "Content-Type: application/json" \
  -d '{"amount": 100}'
```

**Expected**: HTTP 400 error about missing email/transactionId/amount

### Test 2b: Amount Too Low
```bash
curl -X POST http://localhost:3001/api/razorpay-payout \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@test.com",
    "transactionId": "txn_low_amount",
    "amount": 5
  }'
```

**Expected**: HTTP 400 error "Payout amount must be at least ₹10"

**✅ Pass Criteria**:
- ✓ Proper error messages returned
- ✓ No payout initiated
- ✓ HTTP 4xx status codes used

---

## Test 3: Full Claim Pipeline (With Frontend)

**Purpose**: Verify payout is triggered during actual claim approval

**Prerequisites**:
- Backend running (`npm run server`)
- Frontend running (`npm run dev`)
- Browser open to http://localhost:5173

**Steps**:
1. **Login**:
   - Enter email: `demo@weather-protect.co.in`
   - Click "Send OTP"
   - Check terminal: OTP printed to console
   - Enter OTP

2. **Profile Setup**:
   - Wait for location to auto-fill
   - Fill profile: Income ₹5000/week, Hours 40/week
   - Select plan: "Premium"
   - Save profile

3. **Trigger Claim**:
   - Dashboard loads with weather card
   - Click "Moderate Rain" preset
   - Observe timeline:
     - "Event Triggered 🌧️"
     - "Fraud Validation 🔍"
     - "Risk Scoring 📊"
     - "Approved ✓" (green checkmark)

4. **Verify Payout**:
   - Look at backend logs:
     ```bash
     tail -30 /tmp/backend.log | grep -i razorpay
     ```
   - Should see: `[RAZORPAY SIMULATION] Payout simulated: demo@... | Amount: ₹xxx`

5. **Check Transaction Record**:
   ```bash
   curl 'http://localhost:3001/api/transactions?email=demo@weather-protect.co.in' | jq '.transactions[0]'
   ```
   - Should include in metadata:
     ```json
     {
       "razorpayPayoutId": "payout_sim_...",
       "razorpayStatus": "simulated",
       "payoutProcessedAt": "2024-04-02T10:30:05.000Z"
     }
     ```

**✅ Pass Criteria**:
- ✓ Claim shows "Approved ✓" on dashboard
- ✓ Payout log message appears with amount
- ✓ Transaction includes Razorpay metadata
- ✓ Status/ID not null

---

## Test 4: Dashboard Transaction History

**Purpose**: Verify payout details visible in transaction list

**Steps**:
1. Dashboard → Transactions page
2. Look at "Recent Transactions" card
3. Find the claim you just triggered
4. Verify it shows:
   - Status: "Completed" ✓
   - Amount: Calculated payout (e.g., ₹480 for Premium with 3 lost hours)
   - Type: "Autopayout"

**Debug**: If not visible:
```bash
# Manual transaction fetch
curl 'http://localhost:3001/api/transactions?email=demo@weather-protect.co.in' | jq '.transactions | length'
# Should show > 0 if transaction was recorded
```

---

## Test 5: Duplicate Payout (Same Claim)

**Purpose**: Verify payout only processed once per claim

**Steps**:
1. Trigger same preset again immediately
2. Check logs for second payout initiation

**Expected**:
- New transaction created with new payout
- Each claim has unique `razorpayPayoutId`
- Total payout amount accounts for both

---

## Test 6: Razorpay Configuration (With Real Keys)

**Only if you have test keys**:

### Step 1: Update .env
```bash
# server/.env
# Replace with your test keys from https://dashboard.razorpay.com/app/keys
RAZORPAY_KEY_ID=rzp_test_YOUR_KEY_HERE
RAZORPAY_KEY_SECRET=YOUR_SECRET_HERE
RAZORPAY_MODE=test
```

### Step 2: Restart Backend
```bash
# Kill existing backend
lsof -ti :3001 | xargs kill -9

# Start fresh
npm run server
```

### Step 3: Verify Keys Loaded
```bash
curl -X POST http://localhost:3001/api/razorpay-payout \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-keys@example.com",
    "transactionId": "txn_real_keys_001",
    "amount": 100,
    "description": "Testing with real Razorpay keys"
  }'
```

**Expected Response** (with real keys):
```json
{
  "success": true,
  "payout": {
    "id": "payout_A1b2C3d4E5f6g7h8i",
    "amount": 100,
    "status": "processed",
    "entity": "payout",
    "mode": "test"
  },
  "message": "Payout of ₹100 initiated via Razorpay (Status: processed)"
}
```

**✅ Pass Criteria**:
- ✓ Mode shows "test" or "live" (NOT "FALLBACK")
- ✓ Payout ID starts with "payout_" (not "payout_sim_")
- ✓ Status is actual Razorpay status (not "simulated")

---

## Test 7: Error Scenarios

### Scenario A: Network Error Simulation
**Purpose**: Verify fallback works if API fails

**Current Behavior**: Automatically falls back to simulation on error
- Check logs for error message
- Verify payout still succeeds with fallback ID

### Scenario B: Invalid Amount
```bash
curl -X POST http://localhost:3001/api/razorpay-payout \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@test.com",
    "transactionId": "txn_invalid_amount",
    "amount": 0
  }'
```

**Expected**: Error response (400)

---

## Logging & Debugging

### View Backend Logs
```bash
# Real-time logs
tail -f /tmp/backend.log

# Filter for Razorpay
grep -i razorpay /tmp/backend.log

# Count payout requests
grep -c "razorpay-payout" /tmp/backend.log
```

### Enable Debug Logging (Optional)
Add to `server/index.js` in the payout endpoint:
```javascript
console.log('[PAYOUT DEBUG]', {
  email,
  transactionId,
  amount,
  mode: RAZORPAY_MODE,
  keysConfigured: RAZORPAY_ENABLED,
  timestamp: new Date().toISOString()
});
```

### Database Inspection
```bash
# List all transactions for debugging user
curl 'http://localhost:3001/api/transactions?email=demo@test.com' | jq '.transactions[] | {id, amount, status, metadata}'
```

---

## Success Checklist

- [ ] Test 1: Direct endpoint call returns success
- [ ] Test 2: Error handling works (invalid inputs rejected)
- [ ] Test 3: Full claim pipeline shows "Approved ✓"
- [ ] Test 4: Payout appears in backend logs
- [ ] Test 5: Transaction record includes Razorpay metadata
- [ ] Test 6: Dashboard shows transaction in history
- [ ] Build: `npm run build` completes with zero errors (✅ 416KB gzipped)

## Rollback (If Issues)

If something breaks, revert changes:
```bash
# Restore original files
git checkout -- src/components/Dashboard.jsx
git checkout -- server/index.js
git checkout -- package.json

# Reinstall
npm install

# Restart
npm run server
```

---

## Next Steps After Verification

1. ✅ **Verified simulation mode works** → Ready for demo!
2. 🔄 **Get Razorpay test keys** → Test with real backend
3. 🚀 **Deploy with live keys** → Go to production
4. 📊 **Monitor payout success** → Check dashboard daily
5. 🔔 **Setup webhooks** → Auto-update on payout status changes

---

**Status**: Ready to test! Run Test 1-3 now.
