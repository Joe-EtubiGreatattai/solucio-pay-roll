// Mirrors backend/src/services/fees.js (the backend is the source of truth; this is for previews).
// Paystack transfer fee: ≤ ₦5,000 → ₦10, ≤ ₦50,000 → ₦25, above → ₦50.
// Stamp duty: ₦50 on each transfer of ₦10,000 or more.
export function transferCost(kobo) {
  const feeKobo = kobo <= 500_000 ? 1_000 : kobo <= 5_000_000 ? 2_500 : 5_000;
  const stampDutyKobo = kobo >= 1_000_000 ? 5_000 : 0;
  return { feeKobo, stampDutyKobo, totalKobo: feeKobo + stampDutyKobo };
}
export const transferFee = (kobo) => transferCost(kobo).totalKobo;

// Paystack's local charge fee when adding funds: 1.5%, plus ₦100 from ₦2,500, capped at ₦2,000.
export const chargeFee = (kobo) => Math.min(Math.round(kobo * 0.015) + (kobo >= 250_000 ? 10_000 : 0), 200_000);

// What to pay so exactly `net` lands after the charge fee
export function grossUpForNet(net) {
  let gross = Math.ceil((net + 10_000) / 0.985);
  if (gross < 250_000) gross = Math.ceil(net / 0.985);
  if (gross - chargeFee(gross) < net) gross += 1;
  if (chargeFee(gross) >= 200_000) gross = net + 200_000;
  return gross;
}

export const RECENT_BANK_CHANGE_DAYS = 7;
export const changedRecently = (d) => d && Date.now() - new Date(d).getTime() < RECENT_BANK_CHANGE_DAYS * 24 * 60 * 60 * 1000;
