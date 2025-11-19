export function buildNonoShareLink(seedString) {
  if (!seedString) {
    return "";
  }
  return `https://othertab.com/nono/?${seedString}`;
}
