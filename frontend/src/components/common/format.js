// src/components/common/format.js
// Small shared helpers used across Menu, Cart and MenuItem.
export const PLACEHOLDER =
    "https://dummyimage.com/160x120/eaeaea/555&text=%F0%9F%8D%BA";

export const fmtMKD = (n) => `${Math.round(Number(n || 0))} MKD`;
