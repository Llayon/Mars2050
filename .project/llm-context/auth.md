# Auth Domain — Mars2050

## Файлы домена
- `src/domains/auth/auth.types.ts` — Типы авторизации
- `src/domains/auth/auth.service.ts` — Обертка Supabase Auth

## API Routes
- `src/app/api/(auth)/login/route.ts` — Вход
- `src/app/api/(auth)/register/route.ts` — Регистрация

## Hooks
- `src/hooks/useAuth.ts` — Хук авторизации

## Components
- `src/components/game/AuthModal.tsx` — Модалка входа/регистрации

## Типы (ключевые)
- `AuthUser`: Пользователь Supabase
- `AuthSession`: Сессия авторизации
- `LoginCredentials`: Данные для входа
- `RegisterCredentials`: Данные для регистрации

## Сервис (auth.service.ts)
- `signIn()`: Вход через Supabase Auth
- `signUp()`: Регистрация через Supabase Auth
- `signOut()`: Выход
- `getSession()`: Получить текущую сессию

## Особенности
- Supabase Auth (email/password)
- После регистрации автоматически создается колония
- RLS политики привязаны к `auth.uid()`

## Паттерны
- Использование Supabase Auth напрямую (не изобретать велосипед)
- `lib/supabase.ts`: Браузерный клиент (anon key)
- `resource.server.ts`: Серверный клиент (service_role)
- Лимит: service ≤250 строк
