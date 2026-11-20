# PR и статусы
| PR / автор | Проверенный HEAD | База | Результат | Merge / Preview / Production |
|---|---|---|---|---|
| #4 Xiaomi | 17cdb4efc5e4c5df536996001516f402694adadc | main | PASS C-07, NEW-04, C-09, C-16; NEW-06 оценён вместе с #5 | условно / изолированная / не подтверждено |
| #5 Argon | df322e1c05cafaf2ef903096f4ccd468d43ae1d3 | #4 HEAD | PASS URL; NEEDS_FOLLOWUP schema/галерея | с #4 / изолированная / не подтверждено |
| #6 Argon | 7ae433375d0d704fd3dd393beb6d693cb5fca480 | main | FAIL C-04/C-05; исправления #9 | нет исходному / с #9 / нет |
| #7 Argon | 6f9d0fbfe08eff8add6a5648cd474c88086b4e41 | main | PASS no-store и 60s policy; NEEDS_FOLLOWUP runtime/TTL/failure | после конфликта C-07 / да / не подтверждено |
| #8 Argon | dd8aaa60c1d148af73b108cc319362bc69a4c9ba | main | FAIL timeout тела; PASS auth; NEEDS_FOLLOWUP rate limit | с #10 / да / не подтверждено |

У #4, #6, #7, #8 merge-base main = baf997e4359bfd41cdacf315ceefdc15ce956c82; у #5 merge-base #4 = 17cdb4efc5e4c5df536996001516f402694adadc. Все пять PR открыты; GitHub сообщает mergeable для каждого отдельно. Commit combined status на каждом HEAD вернул один success-контекст Vercel; отдельный обязательный unit/E2E CI этим ответом не подтверждён.

Codex #9 HEAD: 8ca2de39bb06ae95dc460f01e36fb6b190eb1b58, base fix/antigravity-checkout-reliability. Codex #10 HEAD: 2dc495a43db6f28e7df01a52957371c08772399e, base fix/antigravity-integrations-hardening. Оба draft; НЕ слиты. Статусы PASS обозначают указанный уровень проверки, а не эксплуатационную готовность.

