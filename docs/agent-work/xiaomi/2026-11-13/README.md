# CARZO — Agent Work Log: Xiaomi MiMo

- **Проект:** CARZO (carzo-storefront) — интернет-магазин автоаксессуаров (кейсы в багажник, автоковрики).
- **Дата начала работы:** 13 ноября 2026 года.
- **Исполнитель:** Xiaomi MiMo (главный агент) + 4 субагента (SEO, Security/CMS, Catalog/Media, Vercel Infra).
- **Источник задания:** безопасные исправления по итогам независимого технического аудита Antigravity 2026-11-13.

## Цель пакета изменений

Выполнить ограниченный набор разрешённых исправлений по аудиту, полностью документировать
работу отдельно от изменений других агентов и подготовить материалы для независимой проверки
OpenAI Codex по Git diff.

## Исходное состояние (зафиксировано ДО изменений)

| Параметр | Значение |
| --- | --- |
| Исходная ветка | `main` |
| HEAD SHA на момент старта | `f8e0e63c9cda807d13a30b0b90970d4717298893` (на 1 коммит впереди origin/main) |
| origin/main SHA | `baf997e4359bfd41cdacf315ceefdc15ce956c82` |
| Незакоммиченные изменения | только untracked `docs/audits/` (материалы аудита Antigravity, чужие) |
| Незапушенный коммит `f8e0e63` | `chore: organize Carzo agent workflow and gitignore` (только `AGENTS.md`, `.gitignore`) — **не включён** в работу Xiaomi |
| Рабочая ветка изменений | `fix/xiaomi-audit-2026-11-13` (создана от `origin/main`) |
| Git worktree | `/Users/qq/Documents/GitHub/carzo-xiaomi-audit-2026-11-13` |

Примечание: рабочая ветка ответвлена от `origin/main` (`baf997e`), а не от локального `main`
(`f8e0e63`), чтобы в PR не попали незапушенные изменения других агентов.

## Разрешённые задачи

| ID | Тема | Статус |
| --- | --- | --- |
| C-07 | Фильтр `status=published` для `discount_tiers` + тест | **выполнено** |
| NEW-04 | `/catalog-carmat` в `sitemap.xml` и `llms.txt` | **выполнено** |
| C-09 | Определение Preview через `VERCEL_ENV` в `robots.ts` / `next.config.js` + тесты | **выполнено** |
| NEW-06 | Безопасная валидация URL в `CmsLink` (`PageRenderer.tsx`) + тесты | **выполнено** |
| C-16 | Базовые HTTP security headers в `next.config.js` | **выполнено** |
| NEW-10 | Проверка/коррекция JSON-LD Product микроразметки | **выполнено** (исправлено) |
| C-11 | Только диагностика изображений (без массовой оптимизации) | **выполнено** (диагностика; предложение в CODEX_HANDOFF) |
| Vercel | Только READ-ONLY проверка конфигурации `yevgens-projects/carzo-storefront` | **выполнено** (изменений не было) |

## Запрещённые изменения (не выполняются)

- C-02, C-03, C-06, NEW-03 — решение владельца: не исправлять сейчас.
- C-04, C-05 (идемпотентность checkout), NEW-01, NEW-02 (кеширование), C-08 (webhook keyCRM),
  C-10 (миграции PostgreSQL), C-12 (Новая почта), C-14 (RPC-права Supabase), NEW-05 (DOM
  карточки товара), NEW-12 (GitHub CI/CD) — переданы Codex / отдельной разработке.
- Юридические страницы `/privacy-policy`, `/public-offer` не переделываются.
- Directus и Railway не удаляются.
- Не выполнять: push в `main`, merge в `main`/`dev`, Production деплой, изменения Production
  credentials Supabase, создание тестовых заказов в боевой БД, смену Function Region без
  разрешения.

## Ссылка на аудит

- Директория аудита: [`docs/audits/antigravity/2026-11-13/`](../../../../audits/antigravity/2026-11-13/README.md)
  (в основном репозитории, untracked на момент старта; не входит в PR Xiaomi).
- Основные файлы: `CARZO_FINAL_TECHNICAL_AUDIT.md`, `CARZO_CODEX_FINDINGS_VERIFICATION.md`,
  `CARZO_REMEDIATION_ROADMAP.md`, `evidence/VERCEL_INFRASTRUCTURE_VERIFICATION.md`.

## Структура документации Xiaomi

- [README.md](./README.md) — этот файл (контекст и статус).
- [CHANGELOG.md](./CHANGELOG.md) — журнал каждого изменения.
- [VERIFICATION.md](./VERIFICATION.md) — протоколы проверок и их результаты.
- [SUBAGENTS_REPORT.md](./SUBAGENTS_REPORT.md) — результаты четырёх субагентов.
- [CODEX_HANDOFF.md](./CODEX_HANDOFF.md) — пакет для независимой проверки OpenAI Codex.

## Статус выполнения

**Работа завершена** — 2026-11-13. Все разрешённые исправления выполнены, верификация
пройдена (см. VERIFICATION.md), изменения изолированы в ветке `fix/xiaomi-audit-2026-11-13`,
подготовлен Pull Request для проверки Codex.
