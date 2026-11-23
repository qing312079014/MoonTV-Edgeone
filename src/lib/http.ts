/**
 * 安全读取 JSON 响应。
 *
 * 背景：EdgeOne 等边缘平台对单次响应体有上限，超出后会直接截断 body（仍返回 200）。
 * 此时前端 `response.json()` 只会抛出
 *   "Unterminated string in JSON at position 1542387 (line 1 column 1542388)"
 * 这类无意义错误码，用户完全无法判断原因。
 *
 * 这里做两件事：
 * 1. 先按文本读取，比较 Content-Length 与实际收到的字节数，识别「传输层截断」；
 * 2. JSON.parse 失败时，把原始报错包装成人能看懂的中文提示。
 */
export async function readJsonSafe<T>(res: Response): Promise<T> {
  const text = await res.text();

  const declaredHeader = res.headers.get('content-length');
  const declared = declaredHeader ? Number(declaredHeader) : null;
  const encoding = (res.headers.get('content-encoding') || '').toLowerCase();
  const received = new TextEncoder().encode(text).length;

  // Content-Length 描述的是压缩前的长度，只有未压缩时才能直接比较
  const lengthMismatch =
    declared !== null &&
    Number.isFinite(declared) &&
    (!encoding || encoding === 'identity') &&
    declared > received;

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);

    if (lengthMismatch) {
      throw new Error(
        `接口响应被截断：服务器声明 ${declared} 字节，实际只收到 ${received} 字节。` +
          `这通常是单次返回数据量过大，被边缘节点（EdgeOne）的响应体上限截断，` +
          `请减少启用的视频源数量后重试。`
      );
    }

    throw new Error(
      `接口返回内容不完整（已接收 ${received} 字节，原始错误：${detail}）。` +
        `请刷新页面重试；若持续出现，说明该接口返回数据过大，需要精简视频源。`
    );
  }
}
