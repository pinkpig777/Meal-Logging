# ADR-0007: Use shadcn/ui as the base component layer

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-10-21 |
| **Deciders** | Charlie Chiu |

## Context

The starter UI used hand-built components. Five people will build screens in parallel. Without shared, accessible primitives, sheets, dialogs, tabs, and form controls will look different on each screen and handle focus inconsistently. The app already uses Tailwind CSS v4.

## Decision

Use **shadcn/ui** for base components (Button, Card, Drawer/bottom sheet, Dialog, Tabs, Progress, Skeleton, Sonner toast, form controls), themed with the tokens in [UI guidelines](../06-ux/ui-guidelines.md).

- Components are copied into `web/src/components/ui/` with the shadcn CLI and committed to the repo; they are our code.
- Icons come from `lucide-react`.
- No other component library may be added.

## Alternatives considered

| Option | Pros | Cons |
|---|---|---|
| Keep hand-built components | No dependencies | Each person reimplements accessibility for sheets, focus, and keyboard |
| shadcn/ui (chosen) | Accessible Radix primitives; Tailwind-native; fully customizable source | Generated code to maintain; some Radix dependencies |
| MUI / Mantine / Chakra | Complete kits | Their own theming systems fight Tailwind; heavier; harder to make look custom |

## Consequences

- `web/components.json` configures the CLI; tokens in `web/src/index.css` drive every component.
- Existing starter components (Button, Card, Sheet, etc.) are replaced by, or rebuilt on, shadcn equivalents.
- Upgrading a shadcn component means re-running the CLI and re-applying local changes; keep local edits minimal.
