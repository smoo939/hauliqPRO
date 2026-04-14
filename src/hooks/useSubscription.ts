// Subscription hook - disabled during free beta
// All users have full access during beta period
export function useSubscription() {
  return {
    subscription: null,
    isActive: true, // Always active during beta
    isPending: false,
    isFailed: false,
    isLoading: false,
  };
}
