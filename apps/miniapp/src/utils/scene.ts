/**
 * 扫码 scene 解析
 * 与服务端 SceneCodec 对应：base64("merchant_id=xxx")，也兼容已解码的明文形态
 */

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64Decode(input: string): string | null {
  const clean = input.replace(/=+$/, '');
  if (!/^[A-Za-z0-9+/]+$/.test(clean) || clean.length % 4 === 1) return null;
  let bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    const idx = B64_CHARS.indexOf(ch);
    if (idx < 0) return null;
    buffer = (buffer << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  // UTF-8 解码
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    if (b < 0x80) {
      out += String.fromCharCode(b);
      i += 1;
    } else if (b >= 0xc0 && b < 0xe0) {
      out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f));
      i += 2;
    } else if (b >= 0xe0 && b < 0xf0) {
      out += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f));
      i += 3;
    } else {
      const cp =
        ((b & 0x07) << 18) |
        ((bytes[i + 1] & 0x3f) << 12) |
        ((bytes[i + 2] & 0x3f) << 6) |
        (bytes[i + 3] & 0x3f);
      out += String.fromCodePoint(cp);
      i += 4;
    }
  }
  return out;
}

/** 从 scene（base64 或明文）提取 merchantId，无效返回 null */
export function extractMerchantId(scene: string | undefined | null): string | null {
  if (!scene) return null;
  let text = scene;
  if (/^[A-Za-z0-9+/]+=*$/.test(scene)) {
    const decoded = base64Decode(scene);
    if (decoded) text = decoded;
  }
  const match = text.match(/merchant_id=([^&\s]+)/);
  return match ? match[1] : null;
}
