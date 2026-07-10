interface FontFaceLoadOptions {
  family: string
  source: string
  style: string
  weight: string
  featureSettings?: string
  verify?: {
    spec: string
    text: string
  }
}

export async function loadFontFace({
  family,
  source,
  style,
  weight,
  featureSettings,
  verify,
}: FontFaceLoadOptions): Promise<void> {
  if (typeof FontFace === 'undefined') return

  const fonts: FontFaceSet | undefined =
    typeof document !== 'undefined'
      ? document.fonts
      : (globalThis as unknown as { fonts?: FontFaceSet }).fonts
  if (!fonts) return

  const fontFace = new FontFace(family, source, {
    style,
    weight,
    featureSettings,
  })
  const loaded = await fontFace.load()
  fonts.add(loaded)

  if (verify) {
    await fonts.load(verify.spec, verify.text)
  }
}
