# ПРОМПТ: Подключить Canton Participant к Synchronizer (Domain)

## ЗАДАЧА
Подключить работающий Canton Participant к Canton Network DevNet Global Synchronizer через gRPC Admin API. Без этого подключения невозможно создавать parties и контракты (ошибка PARTY_ALLOCATION_WITHOUT_CONNECTED_SYNCHRONIZER).

## ТЕКУЩЕЕ СОСТОЯНИЕ (всё проверено, актуально)

### Participant работает в K8s:
- **Pod**: `participant-5c8bc8496b-hnspj` (namespace: `validator`, node: `canton-node-65-108-15-30`)
- **Image**: `ghcr.io/digital-asset/decentralized-canton-sync/docker/canton-participant:0.5.7`
- **Canton Version**: `3.4.11-snapshot.20260120.17521.0.vf11c8b1e` (Enterprise)
- **Protocol Version**: 34
- **Admin API**: `participant.validator.svc.cluster.local:5002` (gRPC, plaintext внутри кластера)
- **Ledger API**: `participant.validator.svc.cluster.local:5001`
- **Статус**: Running 17 дней, healthy
- **Egress IP**: `65.108.15.30` (whitelisted для DevNet)

### Конфигурация participant (важные факты из app.conf):
```
init.generate-topology-transactions-and-keys = false
init.identity.type = manual
parameters.initial-protocol-version = 34
```
Это означает что participant инициализирован в **manual** режиме через Splice Helm chart. Топология и ключи управляются внешне.

### Sequencer endpoints для DevNet (проверенные):
```
sequencer-1.sv-1.dev.global.canton.network.sync.global
sequencer-0.sv-1.dev.global.canton.network.digitalasset.com
sequencer-1.sv-1.dev.global.canton.network.digitalasset.com
sequencer-1.sv-1.dev.global.canton.network.sync.global
```

### Инфраструктура:
- K3s кластер на Hetzner
- Namespace `validator` - Canton participant + PostgreSQL + validator-app
- Namespace `canton-otc` - Rust API server + Next.js frontend

## ТОЧНАЯ СХЕМА gRPC API (проверено через grpcurl describe)

### Метод ConnectSynchronizer:
```protobuf
rpc ConnectSynchronizer(ConnectSynchronizerRequest) returns (ConnectSynchronizerResponse)

message ConnectSynchronizerRequest {
  SynchronizerConnectionConfig config = 1;
  SequencerConnectionValidation sequencer_connection_validation = 2;  // это enum, не message
}

message ConnectSynchronizerResponse {
  bool connected_successfully = 1;
}
```

### Метод RegisterSynchronizer:
```protobuf
rpc RegisterSynchronizer(RegisterSynchronizerRequest) returns (RegisterSynchronizerResponse)

message RegisterSynchronizerRequest {
  SynchronizerConnectionConfig config = 1;
  SynchronizerConnection synchronizer_connection = 2;  // enum: NONE=1, HANDSHAKE=2
  SequencerConnectionValidation sequencer_connection_validation = 3;
}
```

### SynchronizerConnectionConfig (ВСЕ поля):
```protobuf
message SynchronizerConnectionConfig {
  string synchronizer_alias = 1;
  SequencerConnections sequencer_connections = 2;
  bool manual_connect = 3;
  string physical_synchronizer_id = 4;
  int32 priority = 5;
  google.protobuf.Duration initial_retry_delay = 6;
  google.protobuf.Duration max_retry_delay = 7;
  SynchronizerTimeTrackerConfig time_tracker = 8;
  bool initialize_from_trusted_synchronizer = 10;
}
```

### SequencerConnections (ВСЕ обязательные поля):
```protobuf
message SequencerConnections {
  repeated SequencerConnection sequencer_connections = 1;
  uint32 sequencer_trust_threshold = 2;          // ОБЯЗАТЕЛЬНО > 0
  SubmissionRequestAmplification submission_request_amplification = 3;  // ОБЯЗАТЕЛЬНО
  uint32 sequencer_liveness_margin = 4;
  SequencerConnectionPoolDelays sequencer_connection_pool_delays = 5;   // ОБЯЗАТЕЛЬНО
}
```

### SequencerConnection:
```protobuf
message SequencerConnection {
  oneof type { Grpc grpc = 2; }
  string alias = 3;
  optional string sequencer_id = 4;
  message Grpc {
    repeated string connections = 1;    // формат: "https://host" (НЕ host:port!)
    bool transport_security = 2;
    optional bytes custom_trust_certificates = 3;
  }
}
```

### SubmissionRequestAmplification:
```protobuf
message SubmissionRequestAmplification {
  uint32 factor = 1;           // минимум 1
  google.protobuf.Duration patience = 2;
}
```

### SequencerConnectionPoolDelays:
```protobuf
message SequencerConnectionPoolDelays {
  google.protobuf.Duration min_restart_delay = 1;
  google.protobuf.Duration max_restart_delay = 2;
  google.protobuf.Duration subscription_request_delay = 3;
  google.protobuf.Duration warn_validation_delay = 4;
}
```

### SynchronizerTimeTrackerConfig (ОБЯЗАТЕЛЬНО - пустой объект {} вызывает ошибку):
```protobuf
message SynchronizerTimeTrackerConfig {
  google.protobuf.Duration observation_latency = 1;
  google.protobuf.Duration patience_duration = 2;
  google.protobuf.Duration min_observation_duration = 3;
  TimeProofRequestConfig time_proof_request = 4;
}

message TimeProofRequestConfig {
  google.protobuf.Duration initial_retry_delay = 1;
  google.protobuf.Duration max_retry_delay = 2;
  google.protobuf.Duration max_sequencing_delay = 3;
}
```

## ОШИБКИ КОТОРЫЕ МЫ УЖЕ ПОЛУЧАЛИ

1. **`sequencer_trust_threshold` = 0** → `InvariantViolation: Received the non-positive 0 as argument`
2. **Без `submission_request_amplification`** → `FieldNotSet(submission_request_amplification)`
3. **`connections: ["host:443"]`** → `Scheme 'host' is invalid` (нужен `https://host` формат)
4. **Без `sequencer_connection_pool_delays`** → `FieldNotSet(sequencer_connection_pool_delays)`
5. **`time_tracker: {}`** → `FieldNotSet(timeTracker)` - пустой объект не проходит валидацию
6. **Canton `run` command** — это не для интерактивных команд, это для скриптов с конфигом
7. **Canton `daemon -c "command"`** — `-c` это для config файлов, не для команд
8. **Remote participant** — `RemoteParticipantReference` НЕ имеет метода `domains` (только локальный participant)
9. **fullstorydev/grpcurl image** — НЕ имеет `/bin/sh` (только бинарник grpcurl)

## ЧТО НУЖНО СДЕЛАТЬ

### Вариант A (приоритет): Прямой gRPC вызов ConnectSynchronizer
Создать Kubernetes Job в namespace `validator` который:
1. Использует образ с grpcurl и sh (например `nicolaka/netshoot` или alpine + wget grpcurl)
2. Вызывает `ConnectSynchronizer` с ПОЛНОСТЬЮ заполненным запросом включая:
   - `sequencer_trust_threshold: 1`
   - `submission_request_amplification: {factor: 1, patience: "5s"}`
   - `sequencer_connection_pool_delays: {min_restart_delay: "1s", max_restart_delay: "30s", ...}`
   - `time_tracker` со всеми вложенными полями (observation_latency, patience_duration, min_observation_duration, time_proof_request)
3. Проверяет результат через `ListConnectedSynchronizers`

**КРИТИЧНО**: Значения для `time_tracker` нужно исследовать — какие дефолтные значения использует Canton для DevNet. Посмотри в Canton документации или исходниках дефолтные значения для SynchronizerTimeTrackerConfig.

### Вариант B (альтернатива): RegisterSynchronizer + ReconnectSynchronizer
1. Сначала `RegisterSynchronizer` с `synchronizer_connection: SYNCHRONIZER_CONNECTION_HANDSHAKE`
2. Потом `ReconnectSynchronizer` если нужно

### Вариант C (если DevNet не работает): Локальный Canton Domain
Развернуть минимальный Canton synchronizer (sequencer + mediator + domain manager) в K8s:
- Image: `digitalasset/canton-open-source:2.9.3` или Splice image
- В том же кластере, namespace `validator`
- Memory storage достаточно для тестирования
- Подключить participant к локальному domain

## ПОСЛЕ ПОДКЛЮЧЕНИЯ К SYNCHRONIZER

1. **Создать party**:
```bash
grpcurl -plaintext -d '{"party_id_hint":"otc_operator","display_name":"OTC Operator"}' \
  participant.validator.svc.cluster.local:5002 \
  com.digitalasset.canton.admin.participant.v30.PartyManagementService.AllocateParty
```

2. **Выдать права пользователю** `canton-otc-platform` (уже создан как ledger-api user)

3. **Проверить что Rust API server** (`canton-api-server` в namespace `canton-otc`) может создавать контракты

## ДОСТУП К КЛАСТЕРУ

kubectl доступен напрямую. Для запуска pod с grpcurl в namespace validator:
```bash
kubectl -n validator run PODNAME --image=IMAGE --rm -i --restart=Never -- COMMAND
```

Или через Kubernetes Job для надёжности.

## ТРЕБОВАНИЯ
- Только боевое решение, никаких заглушек и mock'ов
- Каждый шаг проверять
- При ошибке — анализировать и исправлять
- Результат: `ListConnectedSynchronizers` возвращает подключённый synchronizer, `AllocateParty` работает
