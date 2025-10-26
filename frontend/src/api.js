import axios from "axios";

const DEFAULT_PROD_BASE = "https://selfserv-1.onrender.com/api";

function normalizeUrl(url) {
    return url.replace(/\/+$/, "");
}

function ensureApiSuffix(url) {
    const normalized = normalizeUrl(url);
    if (normalized.toLowerCase().endsWith("/api")) {
        return normalized;
    }
    return `${normalized}/api`;
}

function resolveBaseUrl() {
    const envUrl = (process.env.REACT_APP_API_BASE_URL || "").trim();
    if (envUrl) {
        return ensureApiSuffix(envUrl);
    }

    if (typeof window !== "undefined") {
        const { hostname } = window.location;
        if (/^localhost$|^127(\.\d+){3}$/.test(hostname)) {
            return "http://localhost:5000/api";
        }
    }

    return DEFAULT_PROD_BASE;
}

const api = axios.create({
    baseURL: resolveBaseUrl(),
    withCredentials: true,
});

export default api;
