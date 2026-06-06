import { z } from 'zod'

export const telegramUserSchema = z.object({
  id: z.number(),
  first_name: z.string().min(1),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional(),
  photo_url: z.string().optional(),
})

export const telegramAuthSchema = z.object({
  initData: z.string().min(1),
})

export type TelegramAuthInput = z.infer<typeof telegramAuthSchema>
