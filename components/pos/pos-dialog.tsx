"use client";

import type { ComponentProps } from "react";

import {
  Dialog,
  DialogClose,
  DialogContent as BaseDialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const POS_OVERLAY_Z_CLASS = "z-[110]";
export const POS_SURFACE_Z_CLASS = "z-[120]";
export const POS_KEYBOARD_Z_CLASS = "z-[120]";
export const POS_NESTED_OVERLAY_Z_CLASS = "z-[130]";
export const POS_NESTED_SURFACE_Z_CLASS = "z-[140]";

type PosDialogContentProps = ComponentProps<typeof BaseDialogContent>;

export function PosDialogContent({ className, ...props }: PosDialogContentProps) {
  return (
    <BaseDialogContent
      overlayClassName={POS_OVERLAY_Z_CLASS}
      className={cn(POS_SURFACE_Z_CLASS, className)}
      {...props}
    />
  );
}

/** Dialog opened on top of another POS dialog (e.g. update from history). */
export function PosNestedDialogContent({
  className,
  ...props
}: PosDialogContentProps) {
  return (
    <BaseDialogContent
      overlayClassName={POS_NESTED_OVERLAY_Z_CLASS}
      className={cn(POS_NESTED_SURFACE_Z_CLASS, className)}
      {...props}
    />
  );
}

export {
  Dialog as PosDialog,
  DialogClose as PosDialogClose,
  DialogDescription as PosDialogDescription,
  DialogFooter as PosDialogFooter,
  DialogHeader as PosDialogHeader,
  DialogTitle as PosDialogTitle,
  DialogTrigger as PosDialogTrigger,
};
