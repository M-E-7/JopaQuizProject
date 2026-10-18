import { useEffect, useRef, type ReactNode } from 'react'

/** Modal yes/no question. Esc (and Android's back gesture, where supported) counts as cancel. */
export default function ConfirmDialog({
  open,
  children,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  children: ReactNode
  confirmLabel: string
  cancelLabel: string
  /** The confirm button destroys data: shown in the "wrong" colour instead of the accent. */
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // The safe choice gets focus, so Enter doesn't confirm by accident.
      cancelRef.current?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="panel dialog"
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
    >
      {children}
      <div className="actions">
        <button type="button" className={danger ? 'button danger' : 'button primary'} onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button type="button" className="button" ref={cancelRef} onClick={onCancel}>
          {cancelLabel}
        </button>
      </div>
    </dialog>
  )
}
