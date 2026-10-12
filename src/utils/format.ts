export const fmtM = (n: number, d = 2) => n.toFixed(d).replace('.', ',');
export const fmtArea = (n: number) => `${fmtM(n, 1)} m²`;
export function downloadText(name: string, text: string, mime = 'application/json') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
