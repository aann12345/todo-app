// Мини-шина событий для снекбара «Отменить» — без лишнего контекста.

export interface SnackbarMessage {
  text: string
  actionLabel?: string
  onAction?: () => void
}

type Listener = (msg: SnackbarMessage) => void

let listener: Listener | null = null

export function onSnackbar(l: Listener): () => void {
  listener = l
  return () => {
    if (listener === l) listener = null
  }
}

export function showSnackbar(msg: SnackbarMessage) {
  listener?.(msg)
}
