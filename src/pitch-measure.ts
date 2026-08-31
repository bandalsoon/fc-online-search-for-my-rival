export type CompositeBounds = { width: number; height: number; offsetX: number; offsetY: number };

// Include overflowing descendants and text, not just the nominal marker width.
// The approved MOM ring extends 2px beyond its face; text shadows are covered too.
export function measureComposite(element: HTMLElement): CompositeBounds {
  const root = element.getBoundingClientRect();
  const rects = [root];
  for (const node of [element, ...element.querySelectorAll<HTMLElement>("*")]) {
    const rect = node.getBoundingClientRect();
    if (rect.width && rect.height) rects.push(rect);
    for (const child of node.childNodes) if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
      const range = document.createRange();
      range.selectNodeContents(child);
      rects.push(...range.getClientRects());
    }
  }
  const left = Math.min(...rects.map((r) => r.left)) - 2, right = Math.max(...rects.map((r) => r.right)) + 2;
  const top = Math.min(...rects.map((r) => r.top)) - 2, bottom = Math.max(...rects.map((r) => r.bottom)) + 2;
  return { width: right - left, height: bottom - top, offsetX: (left + right - root.left - root.right) / 2, offsetY: (top + bottom - root.top - root.bottom) / 2 };
}

