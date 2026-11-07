"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LocaleProvider, useLocaleSettings } from "@/i18n/locale-provider";
import { isRetryable } from "@/lib/api/errors";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        retry: (count, error) => isRetryable(error) && count < 2,
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  });
}

function LocalizedToaster() {
  const { dir } = useLocaleSettings();
  return <Toaster dir={dir} position={dir === "rtl" ? "bottom-left" : "bottom-right"} richColors closeButton />;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={client}>
      <LocaleProvider>
        <TooltipProvider delayDuration={200}>
          {children}
          <LocalizedToaster />
        </TooltipProvider>
      </LocaleProvider>
    </QueryClientProvider>
  );
}
