import type { ReactNode } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** Actions at the bottom (one primary). */
  footer?: ReactNode;
}

/**
 * Bottom sheet (shadcn Drawer, UI guidelines §5.2): drag handle, title, one
 * primary action. Traps focus; closes with Esc, swipe, or overlay tap.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: BottomSheetProps) {
  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          {description ? (
            <DrawerDescription>{description}</DrawerDescription>
          ) : (
            <DrawerDescription className="sr-only">{title}</DrawerDescription>
          )}
        </DrawerHeader>
        {children && <div className="overflow-y-auto px-4 pb-2">{children}</div>}
        {footer && <DrawerFooter>{footer}</DrawerFooter>}
      </DrawerContent>
    </Drawer>
  );
}
