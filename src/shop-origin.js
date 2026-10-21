const productionOrigin = 'https://shop.yggmetro.com';

export function isShopSandbox(env = {}) {
  return env.SHOP_ENVIRONMENT === 'sandbox' || env.SHOP_SANDBOX_ORIGIN !== undefined;
}

// A configured sandbox is a separate host, never an alias for the live shop.
// Missing or invalid configuration has no production fallback.
export function shopOrigin(env = {}) {
  if (!isShopSandbox(env)) return productionOrigin;
  if (env.SHOP_ENVIRONMENT !== 'sandbox' ||
      ![undefined, 'test'].includes(env.STRIPE_CHECKOUT_MODE)) return null;
  const value = env.SHOP_SANDBOX_ORIGIN;
  if (typeof value !== 'string' || !/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.origin !== value || url.hostname === 'yggmetro.com' ||
        url.hostname.endsWith('.yggmetro.com') || /^\d+(?:\.\d+){3}$/.test(url.hostname) ||
        url.hostname.split('.').some(label => !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) return null;
    return value;
  } catch { return null; }
}

export function isShopRequest(request, env = {}) {
  const origin = shopOrigin(env);
  return origin !== null && new URL(request.url).origin === origin;
}
