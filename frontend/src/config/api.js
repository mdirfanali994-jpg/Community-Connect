const getEnv = (key) => {
  const v = import.meta?.env?.[key];
  return v === undefined ? undefined : v;
};

console.log("VITE_API_BASE_URL:", import.meta.env.VITE_API_BASE_URL);

export const API_BASE_URL =
  getEnv("VITE_API_BASE_URL") ||
  "http://localhost:5001/api";

export const SOCKET_URL =
  getEnv("VITE_SOCKET_URL") ||
  "http://localhost:5001";

export const apiUrl = (path = "") => {
  if (!path) return API_BASE_URL;
  const p = String(path).startsWith("/") ? String(path).slice(1) : String(path);
  return `${API_BASE_URL}/${p}`;
};