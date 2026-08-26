import { WorkOS } from "@workos-inc/node"
import { env, hasWorkosConfiguration } from "./env.js"

export const workos = hasWorkosConfiguration ? new WorkOS(env.WORKOS_API_KEY!, { clientId: env.WORKOS_CLIENT_ID! }) : null
