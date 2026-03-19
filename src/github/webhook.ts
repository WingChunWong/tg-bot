/**
 * GitHub Webhook 验证相关功能
 */

/**
 * 时间安全的字符串比较，防止时序攻击
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * 验证 GitHub Webhook 签名
 * 使用 HMAC-SHA256 算法验证请求体
 */
export async function verifyGitHubSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  if (!signature.startsWith('sha256=')) {
    return false;
  }

  const expectedSignature = signature.slice(7);

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );

  const computedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return timingSafeEqual(computedSignature, expectedSignature);
}