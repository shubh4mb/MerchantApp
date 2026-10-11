/**
 * Utility to extract and format the exact ID/SKU that the merchant originally entered
 * (e.g., during product creation or from Telegram caption), hiding system prefixes and size suffixes.
 */

const STANDARD_SIZES = new Set([
  'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL', '5XL', '6XL',
  'FS', 'FREE', 'DEFAULT', 'ONESIZE', 'FREE-SIZE', 'REGULAR',
  '24', '26', '28', '30', '32', '34', '36', '38', '40', '42', '44', '46', '48', '50', '52', '54',
  '6', '7', '8', '9', '10', '11', '12'
]);

function cleanCodeString(
  code: string,
  sizes?: Array<{ size?: string; merchantSizeCode?: string }>
): string {
  const raw = (code || '').trim();
  if (!raw) return '';

  // If it's a 24-character MongoDB hex ObjectId, don't show the whole string
  if (/^[a-f\d]{24}$/i.test(raw)) {
    return `#${raw.slice(-6).toUpperCase()}`;
  }

  // Tokenize by hyphen
  let tokens = raw.split('-');

  // Step 1: Strip warehouse prefix if present (e.g. WH-...)
  if (tokens[0]?.toUpperCase() === 'WH' && tokens.length > 2) {
    tokens.shift();
  }

  // Step 2: Strip system merchant prefix: `${shopName}-${last4}`
  // In FlashFits, shop prefix is followed by a 4-character hex code (from merchant._id.slice(-4))
  // e.g. ["DORI", "67C1", "DRS117", "S", "S"] -> remove ["DORI", "67C1"]
  if (tokens.length >= 3 && /^[A-Z0-9]{4}$/i.test(tokens[1])) {
    tokens.splice(0, 2);
  }

  // Build known sizes set from standard sizes + any custom size names in sizes array
  const knownSizes = new Set(STANDARD_SIZES);
  if (Array.isArray(sizes)) {
    sizes.forEach(s => {
      if (s?.size) {
        const sz = String(s.size).trim().toUpperCase();
        if (sz) knownSizes.add(sz);
      }
    });
  }

  // Step 3: Strip trailing size suffix if present (e.g. "DRS117-S" -> "DRS117", "DRS117-S-S" -> "DRS117")
  while (tokens.length > 1) {
    const lastToken = tokens[tokens.length - 1].trim().toUpperCase();
    if (knownSizes.has(lastToken)) {
      tokens.pop();
    } else {
      break;
    }
  }

  const result = tokens.join('-');
  return result || raw;
}

export function getMerchantEnteredSku(
  productCode?: string | null,
  merchantSizeCode?: string | null,
  sizes?: Array<{ size?: string; merchantSizeCode?: string }>
): string {
  // 1. If merchantSizeCode is directly present on product or sizes
  if (merchantSizeCode && typeof merchantSizeCode === 'string' && merchantSizeCode.trim()) {
    const cleaned = cleanCodeString(merchantSizeCode, sizes);
    if (cleaned && !cleaned.startsWith('PRD-') && !cleaned.startsWith('WH-') && cleaned.length < 32) {
      return cleaned;
    }
  }

  if (Array.isArray(sizes)) {
    const found = sizes.find(s => s?.merchantSizeCode && typeof s.merchantSizeCode === 'string' && s.merchantSizeCode.trim());
    if (found?.merchantSizeCode) {
      const cleaned = cleanCodeString(found.merchantSizeCode, sizes);
      if (cleaned && !cleaned.startsWith('PRD-') && !cleaned.startsWith('WH-') && cleaned.length < 32) {
        return cleaned;
      }
    }
  }

  const raw = (productCode || '').trim();
  if (!raw) return '—';

  return cleanCodeString(raw, sizes) || raw;
}
