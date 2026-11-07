import type { Messages } from "./config";

declare module "next-intl" {
  interface AppConfig {
    Messages: Messages;
  }
}
