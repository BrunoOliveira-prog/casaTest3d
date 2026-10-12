// Ambiente mínimo para rodar a construção da cena em Node (sem navegador): canvas 2D "mudo" para as texturas procedurais.
const noop: unknown = new Proxy(function () { /* */ }, {
  get: (_t, p) => (p === 'addColorStop' ? () => undefined : noop),
  apply: () => noop,
  set: () => true,
});
const fakeCanvas = () => ({ width: 0, height: 0, getContext: () => noop, style: {}, addEventListener: () => undefined });
(globalThis as unknown as { document: unknown }).document = { createElement: fakeCanvas };
