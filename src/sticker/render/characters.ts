const CJK_PATTERN =
  /\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}/u
const COMMON_HAN_PATTERN = /^[\u3007\u4E00-\u9FFF]$/u
const LATIN_PATTERN = /\p{Script=Latin}/u
const NUMBER_PATTERN = /\p{Number}/u
const WORD_SYMBOL_PATTERN = /['’._:+/@#&%-]/u

export function isCjkGrapheme(grapheme: string): boolean {
  return CJK_PATTERN.test(grapheme)
}

export function isCommonHanGrapheme(grapheme: string): boolean {
  return COMMON_HAN_PATTERN.test(grapheme)
}

export function isLatinGrapheme(grapheme: string): boolean {
  return LATIN_PATTERN.test(grapheme)
}

export function isNumberGrapheme(grapheme: string): boolean {
  return NUMBER_PATTERN.test(grapheme)
}

export function isWesternWordGrapheme(grapheme: string): boolean {
  return isLatinGrapheme(grapheme) || isNumberGrapheme(grapheme)
}

export function isWordSymbolGrapheme(grapheme: string): boolean {
  return WORD_SYMBOL_PATTERN.test(grapheme)
}
