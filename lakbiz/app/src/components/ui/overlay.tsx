"use client";

/** Drawer / Dialog / ConfirmDialog — Phase 1 overlay primitives, extended in
 * the UI premium-polish pass (see docs/UI_POLISH_AUDIT.md part 1).
 *
 * Both Drawer and Dialog: trap Escape-to-close, trap Tab focus inside the
 * panel, lock body scroll while open, move initial focus into the panel on
 * open, and restore focus to the trigger on close. When `unsavedChanges` is
 * true, Escape and overlay-click ask for confirmation instead of closing
 * silently — "protect against accidental closing when there are unsaved
 * changes." Drawer is the default for quick create/edit (right-side panel,
 * header/footer stay outside the scrollable body so they can never be
 * scrolled out of view — see the `size` variants below); Dialog is for
 * short focused tasks / confirmations.
 */
import {
  useEffect,
  useRef,
  type PropsWithChildren,
  type ReactNode,
  type RefObject,
} from "react";
import { CloseIcon } from "@/components/ui/icons";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null,
  );
}

/** Shared open/close lifecycle for Drawer and Dialog: body-scroll lock,
 * Escape-to-close (guarded when `guardMessage` is set — unsaved changes),
 * a real Tab focus trap inside `containerRef`, initial focus moved into the
 * panel on open, and focus restored to the trigger element on close. */
function useOverlayLifecycle(
  open: boolean,
  onClose: () => void,
  containerRef: RefObject<HTMLElement | null>,
  guardMessage?: string,
) {
  const triggerRef = useRef<HTMLElement | null>(null);

  const guardedClose = () => {
    if (guardMessage && typeof window !== "undefined" && !window.confirm(guardMessage)) return;
    onClose();
  };

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Move focus into the panel once it mounts open, and set up the Tab trap.
  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    if (container) {
      const [first] = focusableIn(container);
      first?.focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        guardedClose();
        return;
      }
      if (e.key !== "Tab") return;
      const el = containerRef.current;
      if (!el) return;
      const list = focusableIn(el);
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (!el.contains(active)) {
        // Focus somehow escaped the panel — pull it back in.
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, guardMessage]);

  useEffect(() => {
    if (open) return;
    triggerRef.current?.focus?.();
  }, [open]);

  return { guardedClose };
}

export type OverlaySize = "sm" | "md" | "lg" | "xl";

/** Drawer widths — sm for a short confirmation-style panel, md (default)
 * for a single-column form, lg for a sectioned form, xl for a tabbed
 * detail workspace (e.g. Job Detail).
 *
 * `xl` — global premium UI phase, Part 14: "recommended large desktop
 * width: approximately 48-55% viewport." The old flat `sm:max-w-4xl`
 * (896px) was a *fixed* pixel cap, not viewport-relative — on a 1440px
 * screen that's already 62%, and on a common 1366px laptop it's 66%, both
 * well past the target. `clamp(520px, 52vw, 896px)` makes it track the
 * viewport (52% on anything in between), keeps the same 896px ceiling for
 * ultra-wide monitors (unchanged from before), and floors at 520px so the
 * tabbed layout stays usable on a narrower `sm:`-range viewport (tablets
 * in landscape) instead of getting squeezed by a pure percentage. */
const DRAWER_SIZE_CLASS: Record<OverlaySize, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-2xl",
  xl: "sm:w-[clamp(520px,52vw,896px)]",
};

type DrawerProps = PropsWithChildren<{
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** Optional status pill rendered next to the title (e.g. job status). */
  statusBadge?: ReactNode;
  footer?: ReactNode;
  /** sm/md/lg/xl preset width. Ignored if `widthClassName` is passed
   * (kept for the handful of existing call sites with a bespoke width). */
  size?: OverlaySize;
  /** @deprecated prefer `size` — kept for backward compatibility. */
  widthClassName?: string;
  /** When true, Escape and overlay-click confirm before discarding. */
  unsavedChanges?: boolean;
  unsavedChangesMessage?: string;
}>;

export function Drawer({
  open,
  onClose,
  title,
  description,
  statusBadge,
  footer,
  size = "md",
  widthClassName,
  unsavedChanges = false,
  unsavedChangesMessage = "You have unsaved changes. Discard them and close?",
  children,
}: DrawerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { guardedClose } = useOverlayLifecycle(
    open,
    onClose,
    containerRef,
    unsavedChanges ? unsavedChangesMessage : undefined,
  );
  const sizeClass = widthClassName ?? DRAWER_SIZE_CLASS[size];

  return (
    <div
      className={`fixed inset-0 z-[80] ${open ? "visible" : "invisible"}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close"
        tabIndex={open ? 0 : -1}
        onClick={guardedClose}
        className={`absolute inset-0 bg-slate-950/40 transition-opacity ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        aria-describedby={description ? "drawer-description" : undefined}
        className={`absolute inset-y-0 right-0 flex w-full ${sizeClass} flex-col bg-white shadow-2xl transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="drawer-title" className="truncate text-base font-semibold text-slate-900">
                {title}
              </h2>
              {statusBadge}
            </div>
            {description && (
              <p id="drawer-description" className="mt-0.5 truncate text-sm text-slate-500">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={guardedClose}
            aria-label="Close"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-slate-200 px-5 py-3.5 safe-area-pb">{footer}</div>
        )}
      </div>
    </div>
  );
}

/** Standard Cancel · [Save draft] · Primary footer layout for Drawer forms —
 * Primary is always last, always visible, never requires scrolling to
 * reach (the Drawer's footer sits outside the scrollable body). */
export function DrawerFooter({
  onCancel,
  cancelLabel = "Cancel",
  onSaveDraft,
  saveDraftLabel = "Save draft",
  primaryLabel,
  onPrimary,
  primaryType = "button",
  primaryForm,
  primaryDisabled = false,
  primaryLoading = false,
  primaryTone = "default",
}: {
  onCancel: () => void;
  cancelLabel?: string;
  onSaveDraft?: () => void;
  saveDraftLabel?: string;
  primaryLabel: string;
  onPrimary?: () => void;
  primaryType?: "button" | "submit";
  primaryForm?: string;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  primaryTone?: "default" | "danger";
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={onCancel}
        className="min-h-11 rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        {cancelLabel}
      </button>
      <div className="flex items-center gap-2">
        {onSaveDraft && (
          <button
            type="button"
            onClick={onSaveDraft}
            className="min-h-11 rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {saveDraftLabel}
          </button>
        )}
        <button
          type={primaryType}
          form={primaryForm}
          onClick={onPrimary}
          disabled={primaryDisabled}
          className={`min-h-11 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${
            primaryTone === "danger" ? "bg-rose-600 hover:bg-rose-700" : "bg-teal-600 hover:bg-teal-700"
          }`}
        >
          {primaryLoading ? "…" : primaryLabel}
        </button>
      </div>
    </div>
  );
}

type DialogProps = PropsWithChildren<{
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  footer?: ReactNode;
  size?: OverlaySize;
  unsavedChanges?: boolean;
  unsavedChangesMessage?: string;
}>;

const DIALOG_SIZE_CLASS: Record<OverlaySize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  footer,
  size = "md",
  unsavedChanges = false,
  unsavedChangesMessage = "You have unsaved changes. Discard them and close?",
  children,
}: DialogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { guardedClose } = useOverlayLifecycle(
    open,
    onClose,
    containerRef,
    unsavedChanges ? unsavedChangesMessage : undefined,
  );

  return (
    <div
      className={`fixed inset-0 z-[80] flex items-center justify-center p-4 ${open ? "visible" : "invisible"}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close"
        tabIndex={open ? 0 : -1}
        onClick={guardedClose}
        className={`absolute inset-0 bg-slate-950/40 transition-opacity ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby={description ? "dialog-description" : undefined}
        className={`relative flex max-h-[90vh] w-full ${DIALOG_SIZE_CLASS[size]} flex-col rounded-xl bg-white shadow-2xl transition-all duration-150 ${
          open ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 id="dialog-title" className="text-base font-semibold text-slate-900">
              {title}
            </h2>
            {description && (
              <p id="dialog-description" className="mt-0.5 text-sm text-slate-500">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={guardedClose}
            aria-label="Close"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-5 py-3.5 safe-area-pb">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`min-h-11 rounded-lg px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
              tone === "danger" ? "bg-rose-600 hover:bg-rose-700" : "bg-teal-600 hover:bg-teal-700"
            }`}
          >
            {loading ? "..." : confirmLabel}
          </button>
        </>
      }
    >
      {null}
    </Dialog>
  );
}
