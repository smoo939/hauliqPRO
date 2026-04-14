# Telemetry & Behavioral Analytics System

Complete guide to the PostHog-based telemetry and behavioral analytics system for Hauliq.

## Setup

### 1. Environment Configuration

Copy `.env.example` to `.env.local` and add your PostHog API key:

```env
VITE_POSTHOG_API_KEY=phc_your_api_key_here
```

### 2. Initialize TelemetryProvider

Wrap your app with `TelemetryProvider` in your root component (typically `App.tsx` or `main.tsx`):

```tsx
import { TelemetryProvider } from './context/TelemetryContext';

function App() {
  const userId = getUserIdFromAuth(); // From your auth system
  const userRole = getUserRole(); // 'Carrier' or 'Shipper'

  return (
    <TelemetryProvider distinctId={userId} userRole={userRole}>
      {/* Your app routes */}
    </TelemetryProvider>
  );
}
```

---

## Core Components

### TelemetryContext (`src/context/TelemetryContext.tsx`)
Global context providing telemetry functions to entire app.

**Usage:**
```tsx
import { useTelemetry } from '../context/TelemetryContext';

function MyComponent() {
  const { trackEvent, setUserProperties } = useTelemetry();

  const handleAction = async () => {
    await trackEvent('my_event', { key: 'value' });
  };

  return <button onClick={handleAction}>Track Event</button>;
}
```

---

## Behavioral Tracking Hooks

### Base Hooks (`src/hooks/useBehaviorTracking.ts`)

#### `useTimerTracking`
Tracks how long a user stays before taking an action.

```tsx
import { useTimerTracking } from '../hooks/useBehaviorTracking';

function LoadDetails() {
  const { resetTimer, cancelTimer } = useTimerTracking({
    eventName: 'bid_hesitation_alert',
    threshold: 60000, // 60 seconds
    enabled: true,
  });

  const submitBid = () => {
    cancelTimer(); // Don't log hesitation
  };

  return <button onClick={submitBid}>Submit Bid</button>;
}
```

#### `useChangeCounter`
Counts value changes (e.g., bid revisions).

```tsx
import { useChangeCounter } from '../hooks/useBehaviorTracking';

function BidInput() {
  const { handleChange, logAndReset } = useChangeCounter({
    eventName: 'bid_revision_count',
  });

  const handleBidChange = (e) => {
    handleChange();
  };

  const submitBid = async () => {
    await logAndReset(); // Logs revision count to PostHog
  };

  return <input onChange={handleBidChange} />;
}
```

#### `useScrollDepth`
Tracks how far users scroll with customizable thresholds.

```tsx
import { useScrollDepth } from '../hooks/useBehaviorTracking';

function LoadBoard() {
  const { scrollContainerRef } = useScrollDepth({
    eventName: 'load_board_scroll_depth',
    thresholds: [25, 50, 75, 100],
  });

  return <div ref={scrollContainerRef} className="overflow-y-auto">...</div>;
}
```

#### `useClickRate`
Detects rapid clicks for rage click detection.

```tsx
import { useClickRate } from '../hooks/useBehaviorTracking';

function MyButton() {
  const { handleClick } = useClickRate({
    eventName: 'rage_click_detected',
    threshold: 5,
    onThresholdReached: () => console.log('Rage click detected!'),
  });

  return <button onClick={handleClick}>Click Me</button>;
}
```

---

### Carrier Behavioral Hooks (`src/hooks/useCarrierBehavior.ts`)

#### `useBidHesitation`
Tracks time before bidding on a load.

```tsx
import { useBidHesitation } from '../hooks/useCarrierBehavior';

function LoadDetailsPage() {
  const { submitBid } = useBidHesitation(true);

  return (
    <button onClick={() => submitBid({ amount: 500 })}>
      Submit Bid
    </button>
  );
}
```

#### `useBidRevisionTracking`
Counts bid value changes before submission.

```tsx
import { useBidRevisionTracking } from '../hooks/useCarrierBehavior';

function BidForm() {
  const { handleBidInputChange, submitBid } = useBidRevisionTracking();

  return (
    <>
      <input onChange={(e) => handleBidInputChange(e.target.value)} />
      <button onClick={() => submitBid({ amount: 500 })}>Submit</button>
    </>
  );
}
```

#### `useDocumentUploadTracking`
Tracks camera recording duration and upload friction.

```tsx
import { useDocumentUploadTracking } from '../hooks/useCarrierBehavior';

function PODUpload() {
  const { startCamera, stopCamera } = useDocumentUploadTracking();

  return (
    <>
      <button onClick={startCamera}>Start Recording</button>
      <button onClick={() => stopCamera(true)}>Upload</button>
    </>
  );
}
```

#### `useDistractedDrivingDetection`
Monitors speed via geolocation API.

```tsx
import { useDistractedDrivingDetection } from '../hooks/useCarrierBehavior';

function ActiveDelivery() {
  const { startMonitoring, triggerVoiceModePrompt } = useDistractedDrivingDetection();

  useEffect(() => {
    startMonitoring();
    return () => stopMonitoring();
  }, []);

  return <div>Monitoring speed...</div>;
}
```

---

### Shipper Behavioral Hooks (`src/hooks/useShipperBehavior.ts`)

#### `useRateShoppingTracking`
Tracks price viewing and draft abandonment.

```tsx
import { useRateShoppingTracking } from '../hooks/useShipperBehavior';

function PostLoadForm() {
  const { startLoadDraft, viewSuggestedPrice, submitLoad } = useRateShoppingTracking();

  return (
    <>
      <button onClick={startLoadDraft}>New Load</button>
      <button onClick={() => viewSuggestedPrice(5000)}>View Price</button>
      <button onClick={() => submitLoad({})}>Submit</button>
    </>
  );
}
```

#### `useSelectionDepthTracking`
Counts carrier profiles viewed before accepting bid.

```tsx
import { useSelectionDepthTracking } from '../hooks/useShipperBehavior';

function CarrierProfiles() {
  const { viewCarrierProfile, acceptBid } = useSelectionDepthTracking();

  return (
    <>
      <div onClick={() => viewCarrierProfile('carrier_1', {})}>Profile</div>
      <button onClick={() => acceptBid('carrier_1', {})}>Accept</button>
    </>
  );
}
```

#### `useLeakagePreventionTracking`
Monitors Contact/Call button clicks and app closure.

```tsx
import { useLeakagePreventionTracking } from '../hooks/useShipperBehavior';

function CarrierCard() {
  const { handleContactClick, handleAppClose } = useLeakagePreventionTracking();

  useEffect(() => {
    window.addEventListener('beforeunload', handleAppClose);
    return () => window.removeEventListener('beforeunload', handleAppClose);
  }, []);

  return (
    <button onClick={() => handleContactClick('call', 'carrier_1')}>Call</button>
  );
}
```

#### `useUrgencySensingTracking`
Tracks app opens for active loads.

```tsx
import { useUrgencySensingTracking } from '../hooks/useShipperBehavior';

function Dashboard() {
  const { trackAppOpen } = useUrgencySensingTracking();

  useEffect(() => {
    trackAppOpen(hasActiveLoad);
  }, []);

  return <div>Dashboard</div>;
}
```

---

### Global Performance Hooks (`src/hooks/useGlobalPerformanceTracking.ts`)

#### `useLoadBoardScrollTracking`
Tracks scroll depth on Load Board.

```tsx
import { useLoadBoardScrollTracking } from '../hooks/useGlobalPerformanceTracking';

function LoadBoard() {
  const loadBoardRef = useRef();
  const { recordLoadClicked, recordBottomReachedWithoutClick } = useLoadBoardScrollTracking(loadBoardRef);

  return <div ref={loadBoardRef}>...</div>;
}
```

#### `useNetworkHealthTracking`
Logs API calls exceeding 2000ms latency.

```tsx
import { useNetworkHealthTracking } from '../hooks/useGlobalPerformanceTracking';

function MyComponent() {
  const { wrapApiCall } = useNetworkHealthTracking();

  const fetchLoads = async () => {
    await wrapApiCall(
      () => fetch('/api/loads').then(r => r.json()),
      '/api/loads',
      'us-east-1'
    );
  };

  return <button onClick={fetchLoads}>Fetch</button>;
}
```

#### `useSearchIntentTracking`
Logs search queries and null results.

```tsx
import { useSearchIntentTracking } from '../hooks/useGlobalPerformanceTracking';

function SearchBar() {
  const { trackSearch } = useSearchIntentTracking();

  const handleSearch = async (query) => {
    const results = await fetchSearchResults(query);
    await trackSearch(query, results.length);
  };

  return <input onChange={(e) => handleSearch(e.target.value)} />;
}
```

#### `useShareMonitoringTracking`
Tracks WhatsApp shares and app returns.

```tsx
import { useShareMonitoringTracking } from '../hooks/useGlobalPerformanceTracking';

function ShareButton() {
  const { handleShareToWhatsApp, handleAppReturn } = useShareMonitoringTracking();

  useEffect(() => {
    window.addEventListener('focus', () => handleAppReturn());
    return () => window.removeEventListener('focus', () => handleAppReturn());
  }, []);

  return (
    <button onClick={() => handleShareToWhatsApp('share_1', {})}>Share</button>
  );
}
```

---

## UI Components

### RageClickToast (`src/components/feedback/RageClickToast.tsx`)
Auto-shows "Need Help?" toast after 5 rapid clicks.

```tsx
import { RageClickToast } from '../components/feedback/RageClickToast';

function App() {
  return (
    <>
      <YourContent />
      <RageClickToast onShowFeedback={() => openFeedbackForm()} />
    </>
  );
}
}
```

### FakeDoor (`src/components/feedback/FakeDoorComponent.tsx`)
Feature preview component for upcoming features.

```tsx
import { FakeDoor, FakeDoorPresets } from '../components/feedback/FakeDoorComponent';

function FeatureShowcase() {
  return (
    <>
      <FakeDoor feature={FakeDoorPresets.FUEL_ADVANCES} />
      <FakeDoor feature={FakeDoorPresets.GROUP_CONVOY_CHAT} />
      <FakeDoor feature={FakeDoorPresets.INSURANCE_MARKETPLACE} />
    </>
  );
}
}
```

---

## PII Masking

Sensitive data is automatically masked in session recordings:
- **Passwords**: Replaced with `********`
- **Payment Details**: Card numbers show only last 4 digits
- **Usernames**: Masked in recordings

All events include `user_role` property automatically.

---

## Event Examples

### Carrier Events
- `bid_hesitation_alert` - User inactive >60s on Load Details
- `bid_revision_count` - Number of bid input changes
- `doc_upload_friction` - Camera active >30s without capture
- `driving_distraction_event` - Speed >15mph while app active
- `voice_mode_prompt_triggered` - Prompt shown for safe driving

### Shipper Events
- `price_point_abandonment` - Draft abandoned after price view
- `shipper_due_diligence_count` - Number of profiles viewed
- `potential_platform_leakage` - App closed within 20s of contact
- `app_opened_with_active_load` - App open frequency tracking
- `urgency_metrics_reset` - Load filled or cancelled

### Global Events
- `load_board_scroll_depth` - Scroll tracking on Load Board
- `poor_match_signal` - Reached bottom without clicking
- `network_health` - API latency >2000ms
- `null_result_search` - Search with no results
- `social_validation_exit` - Left app after WhatsApp share
- `rage_click_detected` - 5 rapid clicks detected
- `fake_door_clicked` - Upcoming feature clicked
- `fake_door_interest_registered` - User wants notification

---

## Testing

For development, check PostHog dashboard in real-time:
1. Navigate to your PostHog project
2. Check "Live Events" tab for real-time event streaming
3. View session replays to see user interactions
4. Monitor heatmaps for click patterns

---

## Performance Considerations

- Events are sent asynchronously to avoid blocking UI
- Batch events when possible using `trackEventBatch`
- PII masking is applied automatically
- Use `$process_person_profile: false` for high-frequency events to reduce processing

---

## Troubleshooting

**Events not showing in PostHog?**
- Verify `VITE_POSTHOG_API_KEY` is set correctly
- Check browser console for errors
- Ensure `TelemetryProvider` wraps your app

**High latency events?**
- Consider batching related events
- Use `$process_person_profile: false` for non-critical events

**PII appearing in recordings?**
- Verify `piiMasking.ts` is processing sensitive fields
- Add new fields to mask in `maskSensitiveData` function
