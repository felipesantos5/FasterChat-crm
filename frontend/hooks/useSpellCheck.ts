// Removido — corretor ortográfico agora usa spellCheck nativo do browser (lang="pt-BR")
export interface SpellError {
  word: string
  start: number
  end: number
  suggestions: string[]
}
