const normalize = (s: string) => s.replace(/-/g, '+').replace(/_/g, '/')

export const base64urlDecodeToString = (s: string) => atob(normalize(s))

export const base64urlDecodeToBuffer = (s: string): ArrayBuffer =>
  Uint8Array.from(atob(normalize(s)), c => c.charCodeAt(0)).buffer
