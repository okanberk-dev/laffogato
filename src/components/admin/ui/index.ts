// The admin panel's Filament-style kit. Import from here:
//
//   import { DataTable, FilterBar, StatusTabs, Pagination } from "@/components/admin/ui";
//
// Server-safe (no hooks): Badge, OrderStatusBadge, DataTable (without
// `selection`), StatusTabs, Pagination, Section, KeyValueGrid, Timeline,
// EmptyState. Client components, usable from a server page with plain props:
// FilterBar, ActionMenu (+ items), ActionModal, ConfirmButton, ToastProvider.
// Pure helpers live in lib/admin: list-params.ts (URL), action-result.ts,
// order-ui.ts, tone.ts, flash-core.ts (+ server-only flash.ts),
// text-fold.ts (Turkish-aware search). Forms that keep their own
// useActionState post through useHandPost / withPanelCatch
// (submit.ts, also exported from components/admin/action-form).

export { ADMIN_CHANGED_EVENT, announceAdminChange } from "./admin-changed";
export {
  ActionMenu,
  ActionMenuButton,
  ActionMenuLink,
  ActionMenuSeparator,
  type ActionMenuProps,
} from "./action-menu";
export {
  ActionModal,
  ConfirmButton,
  FieldError,
  useActionModalState,
  type ActionModalProps,
  type ActionModalState,
  type ConfirmButtonProps,
  type ModalAction,
} from "./action-modal";
export { Badge, OrderStatusBadge, type BadgeProps } from "./badge";
export {
  DataTable,
  type DataTableColumn,
  type DataTableProps,
} from "./data-table";
export {
  EmptyState,
  KeyValueGrid,
  Section,
  Timeline,
  type KeyValueItem,
  type SectionProps,
  type TimelineItem,
} from "./detail";
export { FilterBar, type FilterBarProps } from "./filter-bar";
export { Pagination } from "./pagination";
export { StatusTabs, type StatusTab } from "./status-tabs";
export { BUTTON, NUMERIC_STYLE, type ButtonVariant } from "./styles";
export { ToastProvider, useToast, type ToastApi } from "./toast";
export { type ToastInput, type ToastTone } from "./toast-core";
export { TONE_DOT, TONE_INK, TONE_SOFT } from "./tone";
