import { config } from "dotenv"
import { z } from "zod"

config({ quiet: true })

const envSchema = z.object({
    WORKOS_API_KEY: z.string().optional(),
    WORKOS_CLIENT_ID: z.string().optional(),
    WORKOS_COOKIE_PASSWORD: z.string().min(32).optional(),
    PORT: z.coerce.number().default(3003),
    HOST: z.string().default("0.0.0.0"),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    FRONTEND_URL: z.url().default("http://localhost:5173"),
    BACKEND_URL: z.url().default("http://localhost:3003"),
    DATABASE_URL: z.string().default("./data/hiveborn.sqlite"),
    PUBLIC_POSTHOG_KEY: z.string().optional(),
    PUBLIC_POSTHOG_HOST: z.url().default("https://eu.i.posthog.com"),
})

export const env = envSchema.parse(process.env)

export const hasWorkosConfiguration = Boolean(env.WORKOS_API_KEY && env.WORKOS_CLIENT_ID && env.WORKOS_COOKIE_PASSWORD)
