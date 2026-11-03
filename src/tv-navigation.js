// Prefer aligned controls before diagonals; one linear pass, no sort per key repeat.
export function directionalTarget(current, candidates, key) {
    const vertical = key === 'ArrowDown' || key === 'ArrowUp',
        sign = key === 'ArrowDown' || key === 'ArrowRight' ? 1 : -1;
    let best = null,
        bestScore = Infinity;
    for (const candidate of candidates) {
        const r = candidate.rect,
            dx = r.x + r.width / 2 - current.x - current.width / 2,
            dy = r.y + r.height / 2 - current.y - current.height / 2;
        const forward = (vertical ? dy : dx) * sign;
        if (forward <= 1) continue;
        const across = Math.abs(vertical ? dx : dy),
            overlap = vertical
                ? r.x < current.x + current.width && r.x + r.width > current.x
                : r.y < current.y + current.height && r.y + r.height > current.y;
        const score = forward + across * 3 + (overlap ? 0 : 10000);
        if (score < bestScore) {
            bestScore = score;
            best = candidate;
        }
    }
    return best;
}
export function focusControl(element) {
    if (!element) return;
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
}
export function moveFocus(key, root = document) {
    const current = document.activeElement;
    const candidates = [...root.querySelectorAll('button,a[href],input,select,[tabindex="0"]')].filter(
        (el) =>
            !el.disabled &&
            !el.closest('[inert],.concealed') &&
            el.getClientRects().length &&
            getComputedStyle(el).visibility !== 'hidden',
    );
    if (!candidates.length) return;
    if (!candidates.includes(current)) {
        focusControl(candidates[0]);
        return;
    }
    const result = directionalTarget(
        current.getBoundingClientRect(),
        candidates.filter((el) => el !== current).map((el) => ({ el, rect: el.getBoundingClientRect() })),
        key,
    );
    if (result) focusControl(result.el);
}
export function pageWindow(total, page, size = 24) {
    const pages = Math.max(1, Math.ceil(total / size)),
        index = Math.min(Math.max(0, page), pages - 1);
    return { index, pages, start: index * size, end: Math.min(total, (index + 1) * size) };
}
