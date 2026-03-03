# Что нужно для старта реализации Canton OmniChain SDK

> Основа: `cantonnet-omnichain-sdk/DEVELOPMENT_PROMPT.md`, research 01–08, `08-sdk-architecture-design.md`.

---

## 1. Окружение и инструменты

| Требование | Детали |
|------------|--------|
| **Rust** | rustup, stable (1.75+ для edition 2024). `rust-toolchain.toml` с фиксированной версией. |
| **Cargo** | Workspace для crates: canton-sdk, canton-core, canton-ledger-api, canton-crypto, canton-transport, canton-reliability, canton-observability, canton-omnichain, canton-testing. |
| **Прото Ledger API** | Файлы `com/daml/ledger/api/v1` или `v2`: [daml/ledger-api/grpc-definitions](https://github.com/digital-asset/daml/tree/main/ledger-api/grpc-definitions) или архив `protobufs-*.zip` из [releases](https://github.com/digital-asset/daml/releases). Нужны: command_service, command_submission_service, command_completion_service, transaction_service, active_contracts_service, party_management_service, package_service, ledger_identity_service, плюс commands/transaction/event/value.proto. |
| **Сборка proto** | `tonic-build` в `build.rs` у `canton-ledger-api`; зависимости: `tonic`, `prost`, `prost-types`. |

---

## 2. Где лежит код SDK

- **Вариант A:** новый репозиторий/workspace внутри `cantonnet-omnichain-sdk/` (например `cantonnet-omnichain-sdk/crates/`), чтобы design и код были рядом.
- **Вариант B:** отдельный репо только под Rust SDK, а `cantonnet-omnichain-sdk` остаётся research/design.
- **Сейчас:** в проекте нет ни `Cargo.toml`, ни Rust-кода — нужен первичный `cargo init --lib` и разложение по crates по схеме из `08-sdk-architecture-design.md` (§2 Crate Structure).

Решение: выбрать A или B и один раз зафиксировать (в т.ч. в `DEVELOPMENT_PROMPT.md`).

---

## 3. Внешние зависимости и доступ

| Ресурс | Назначение |
|--------|------------|
| **Canton Participant (Ledger API)** | Реальный или sandbox-конец для интеграционных тестов LedgerClient (submit, stream, active_contracts, parties). У вас уже есть validator в `/Users/Gyber/KIKIMORA/canton_validator` — нужен доступный адрес/порт Ledger API (обычно 6865 или 7575) и при необходимости TLS. |
| **Proto-пакет Daml** | Скачать/клонировать `ledger-api/grpc-definitions` или `protobufs-*.zip`, положить в `canton-ledger-api/proto/` (сохраняя дерево `com/daml/ledger/api/...`) и настроить пути в `build.rs`. |
| **Опционально: тестовые цепи** | Для фазы OmniChain (Phase 4): Ethereum testnet (Sepolia), Cosmos/Substrate — только если сразу закладываем адаптеры; для Phase 1–3 не обязательны. |

---

## 4. Команда и компетенции

- **Обязательно:** разработчик(и) с опытом Rust (async, Tokio, error handling, трейты).
- **Желательно:** знакомство с gRPC/Tonic и protobuf; хотя бы поверхностное понимание Daml/Canton (контракты, party, command, transaction).
- **Можно восполнить по ходу:** Ledger API и Daml — по [docs.daml.com](https://docs.daml.com/app-dev/grpc/index.html), [daml/grpc-definitions](https://github.com/digital-asset/daml/tree/main/ledger-api/grpc-definitions) и по `cantonnet-omnichain-sdk/research/04-daml-ledger-api.md`.

---

## 5. Минимальный первый шаг (Phase 1 по DEVELOPMENT_PROMPT)

Чтобы «приступить к реализации SDK» в смысле написания кода, достаточно:

1. **Принять место жительства кода** — каталог/репо (см. п. 2).
2. **Поставить окружение** — Rust stable, создать workspace и crates по схеме из §2 в `08-sdk-architecture-design.md`.
3. **Раздобыть прото** — скопировать нужные `.proto` Ledger API в `canton-ledger-api/proto/` и сделать так, чтобы `cargo build` их компилировал через `tonic-build` (как в `05-grpc-protobuf-rust.md` и в `DEVELOPMENT_PROMPT` — раздел canton-ledger-api).
4. **Реализовать canton-core** — типы (DamlValue, Identifier, PartyId, ContractId, Command, Commands, Event, TransactionFilter, LedgerOffset), error (SdkError), config — по §3 в `08-sdk-architecture-design.md` и по Canton Core в `DEVELOPMENT_PROMPT`.
5. **Опционально, но полезно для ранних тестов** — поднять или указать уже поднятый Canton Participant с Ledger API и записать его адрес в конфиг/примеры для будущего `LedgerClient::connect()`.

Дальше по тому же промпту: Phase 2 — transport + ledger-api client; Phase 3 — reliability + observability; Phase 4 — omnichain; Phase 5 — полировка, доки, примеры.

---

## 6. Чеклист «можно приступать»

- [ ] Выбрано и зафиксировано место кода SDK (репо/папка).
- [ ] Установлен Rust (rustup, stable), создан Cargo workspace и заготовки crates.
- [ ] Proto Ledger API лежат в `canton-ledger-api/proto/`, `build.rs` их успешно компилирует.
- [ ] Реализован `canton-core` (типы, ошибки, конфиг) и по нему есть тесты.
- [ ] Известен адрес Canton Ledger API для интеграционных тестов (текущий validator или sandbox).
- [ ] Есть хотя бы один разработчик с Rust и готовность опираться на `DEVELOPMENT_PROMPT.md` и research 01–08.

После выполнения пунктов выше можно считать, что к реализации SDK приступили, и вести работу по фазам из `DEVELOPMENT_PROMPT.md`.
