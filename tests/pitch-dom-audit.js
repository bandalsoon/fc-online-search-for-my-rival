// Read-only DOM check. Run this function through the browser's evaluate API.
// No React state, API response, credentials or stored records are accessed.
export function auditPitchDom() {
  const pitches = [...document.querySelectorAll('.pitch')];
  const boards = pitches.map((pitch) => {
    const pr = pitch.getBoundingClientRect();
    const gap = Number(pitch.dataset.gap || 0);
    const boxes = [...pitch.querySelectorAll('.pitch-player')].map((el) => {
      const rects = [el.getBoundingClientRect()];
      for (const node of [el, ...el.querySelectorAll('*')]) {
        const r = node.getBoundingClientRect();
        if (r.width && r.height) rects.push(r);
        for (const child of node.childNodes) if (child.nodeType === 3 && child.textContent?.trim()) {
          const range = document.createRange();
          range.selectNodeContents(child);
          rects.push(...range.getClientRects());
        }
      }
      const scale = Number(el.dataset.scale || 1), padding = 2 * scale;
      return { position: el.dataset.position, scale,
        left: Math.min(...rects.map(r => r.left)) - padding,
        right: Math.max(...rects.map(r => r.right)) + padding,
        top: Math.min(...rects.map(r => r.top)) - padding,
        bottom: Math.max(...rects.map(r => r.bottom)) + padding,
        face: !!el.querySelector('.face.round'), name: !!el.querySelector('.player-identity strong')?.textContent,
        rating: !!el.querySelector('.player-rating'), positionLabel: !!el.querySelector('.face-wrap > span'),
        salary: !!el.querySelector('.salary'), season: !!el.querySelector('.season-sprite,.season-fallback'), grade: !!el.querySelector('.player-identity em'),
      };
    });
    const collisions = [], unsafe = [], outside = [];
    let minimumClearance = Infinity;
    boxes.forEach((a, i) => {
      if (a.left < pr.left + 1 + gap - .1 || a.right > pr.right - 1 - gap + .1 || a.top < pr.top + 1 + gap - .1 || a.bottom > pr.bottom - 1 - gap + .1) outside.push(a.position);
      boxes.slice(i + 1).forEach((b) => {
        const dx = Math.max(b.left-a.right, a.left-b.right), dy = Math.max(b.top-a.bottom, a.top-b.bottom);
        minimumClearance = Math.min(minimumClearance, Math.max(dx,dy));
        if (dx < -.1 && dy < -.1) collisions.push([a.position,b.position]);
        if (dx < gap-.1 && dy < gap-.1) unsafe.push([a.position,b.position]);
      });
    });
    return { width: pr.width, height: pr.height, top: pr.top, left: pr.left, scale: Number(pitch.dataset.scale), box: pitch.dataset.box, gap,
      players: boxes.length, missingElements: boxes.filter(b=>!b.face||!b.name||!b.rating||!b.positionLabel||!b.salary||!b.season||!b.grade).length,
      collisions, unsafe, outside, minimumClearance, readabilityReview: pitch.dataset.readabilityReview,
      uniformScale: new Set(boxes.map(b=>b.scale)).size === 1,
    };
  });
  return { viewport: { width: innerWidth, height: innerHeight }, clientWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    fontStatus: document.fonts.status, boards,
    cards: [...document.querySelectorAll('.best-panel')].map(e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height,top:r.top,left:r.left,headerHeight:e.querySelector('.panel-head').getBoundingClientRect().height};}),
  };
}

