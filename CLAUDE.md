@AGENTS.md

Общие правила, начало и завершение задачи — в `AGENTS.md`.
Состояние — `docs/STATUS.md`, зоны и отчёты — `docs/modules/`, процесс — `docs/session-orchestration.md`.

Особенности Claude Code:
- Новую тему начинать в новой сессии или после `/clear`; перед `/compact` сохранять состояние в документации.
- Локальные разрешения и запуск — `.claude/settings.local.json` и `.claude/launch.json` (не коммитятся).
- Имена моделей и инструменты Claude не являются требованиями к Codex.
