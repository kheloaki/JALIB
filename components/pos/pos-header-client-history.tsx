"use client";

import { useState } from "react";
import { History } from "lucide-react";

import { PosClientPurchaseHistoryDialog } from "@/components/pos/pos-client-purchase-history-dialog";
import { Button } from "@/components/ui/button";
import type { Client } from "@/lib/clients/types";

type PosHeaderClientHistoryProps = {
  clients?: Client[];
  tr: (fr: string, ar: string) => string;
};

export function PosHeaderClientHistory({ clients = [], tr }: PosHeaderClientHistoryProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setOpen(true)}
        className="border-primary/20 text-primary bg-primary/5 hover:bg-primary/15 size-10 shrink-0 rounded-xl"
        aria-label={tr("Historique du magasin", "سجل المتجر")}
        title={tr("Historique du magasin", "سجل المتجر")}
      >
        <History className="size-5 stroke-[1.75]" aria-hidden />
      </Button>

      <PosClientPurchaseHistoryDialog
        clients={clients}
        open={open}
        onOpenChange={setOpen}
        tr={tr}
      />
    </>
  );
}
