export const TOKENS = {
  radius: {
    card: "20px",
    button: "14px",
    input: "12px",
  },
  spacing: {
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "32px",
    "2xl": "48px",
  },
  shadow: {
    card: "0 12px 30px rgba(15, 23, 42, 0.08)",
    cardHover: "0 18px 40px rgba(15, 23, 42, 0.14)",
    blue: "0 18px 50px rgba(6, 46, 111, 0.35)",
  },
  transition: {
    fast: "150ms",
    normal: "250ms",
    slow: "350ms",
  },
} as const;

export const GRADIENTS = {
  APP_BACKGROUND: "linear-gradient(135deg, #062E6F 0%, #154A92 45%, #5A9DDC 100%)",
  LOGIN_BACKGROUND: "linear-gradient(135deg, #062E6F 0%, #154A92 45%, #5A9DDC 100%)",
  HEADER_BACKGROUND: "linear-gradient(90deg, #062E6F 0%, #154A92 55%, #2563EB 100%)",
  SIDEBAR_BACKGROUND: "linear-gradient(180deg, #082B57 0%, #123F74 55%, #184E88 100%)",
  PRIMARY_BUTTON: "linear-gradient(90deg, #0B3B82 0%, #2563EB 100%)",
} as const;
