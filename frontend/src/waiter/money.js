export function formatMoney(value) {
    const num = Number(value) || 0;
    const rounded = Math.round(num * 100) / 100;
    return Number.isInteger(rounded) ? `${rounded} MKD` : `${rounded.toFixed(2)} MKD`;
}
