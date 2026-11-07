"use client";

import { Check, ChevronDown, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDemoUsers } from "@/lib/api/queries";
import { useSession, useSessionActions } from "@/lib/session";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./user-avatar";

/** Demo-only: jump between maker / checker / executor without a login form. */
export function RoleSwitcher({ className }: { className?: string }) {
  const t = useTranslations();
  const session = useSession();
  const { data: users, isLoading, isError, refetch } = useDemoUsers();
  const { signIn } = useSessionActions();
  if (!session) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn("h-10 gap-2 rounded-xl ps-1.5 pe-2.5", className)}
          aria-label={`${t("demo.switchRole")}: ${session.user.name}, ${t(`roles.${session.user.role}`)}`}
          data-testid="role-switcher"
        >
          <span className="rounded-md bg-testnet-bg px-1.5 py-0.5 text-[0.625rem] font-bold tracking-wider text-testnet-fg uppercase">
            {t("demo.label")}
          </span>
          <span className="hidden flex-col items-start text-start leading-tight sm:flex">
            <span className="text-xs font-semibold">{session.user.name}</span>
            <span className="text-[0.6875rem] text-muted-foreground">{t(`roles.${session.user.role}`)}</span>
          </span>
          <span className="text-xs font-semibold sm:hidden">{t(`roles.${session.user.role}`)}</span>
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-xs text-muted-foreground">{t("demo.switchRole")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isLoading && (
          <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> {t("app.loading")}
          </div>
        )}
        {isError && (
          <DropdownMenuItem onSelect={(e) => (e.preventDefault(), void refetch())} className="text-destructive">
            {t("demo.loadFailed")} {t("common.retry")}
          </DropdownMenuItem>
        )}
        {users?.map((u) => {
          const active = u.id === session.user.id;
          return (
            <DropdownMenuItem
              key={u.id}
              onSelect={() => !active && signIn(u)}
              className="gap-3 py-2"
              data-testid={`switch-role-${u.role}`}
            >
              <UserAvatar name={u.name} className="size-8" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{u.name}</span>
                <span className="text-xs text-muted-foreground">
                  {t(`roles.${u.role}`)} · {t(`roles.${u.role}Hint`)}
                </span>
              </span>
              {active && <Check className="size-4 text-primary" aria-label={t("demo.signedInAs")} />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
