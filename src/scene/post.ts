/** Ponte entre o compositor de pós-processamento (quando ativo) e a captura de PNG. */
export const post: { render: (() => void) | null } = { render: null };
