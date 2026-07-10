export function generatedFileName(
  prefix: string,
  text: string,
  extension = 'png',
): string {
  const stem = Array.from(text.trim().replace(/\s+/g, '-'))
    .filter((char) => !isInvalidFileNameChar(char))
    .join('')
    .replace(/[.-]+$/g, '')
    .slice(0, 32)

  return `${prefix}-${stem || 'untitled'}.${extension.replace(/^\./, '')}`
}

function isInvalidFileNameChar(char: string): boolean {
  return char.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(char)
}
