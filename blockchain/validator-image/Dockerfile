# syntax=docker/dockerfile:1.7

ARG BASE_IMAGE=eclipse-temurin:21-jre
FROM ${BASE_IMAGE} AS runtime

ARG CANTON_VERSION=0.5.3
ARG CANTON_RELEASE_URL=https://github.com/digital-asset/decentralized-canton-sync/releases/download/v${CANTON_VERSION}/${CANTON_VERSION}_splice-node.tar.gz

ENV CANTON_HOME=/opt/canton \
    CANTON_VERSION=${CANTON_VERSION} \
    JAVA_OPTS="-XX:+UseG1GC -XX:MaxGCPauseMillis=200"

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends curl ca-certificates bash tini jq; \
    # Установка docker CLI (статический бинарник) - версия 26.1.0 для поддержки API 1.44+
    curl -fsSL https://download.docker.com/linux/static/stable/x86_64/docker-26.1.0.tgz | tar -xz -C /tmp && \
    mv /tmp/docker/docker /usr/local/bin/ && \
    chmod +x /usr/local/bin/docker && \
    rm -rf /tmp/docker; \
    # Установка docker-compose v2 (как плагин)
    mkdir -p /usr/local/lib/docker/cli-plugins && \
    curl -fsSL https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-linux-x86_64 -o /usr/local/lib/docker/cli-plugins/docker-compose && \
    chmod +x /usr/local/lib/docker/cli-plugins/docker-compose && \
    ln -s /usr/local/lib/docker/cli-plugins/docker-compose /usr/local/bin/docker-compose; \
    rm -rf /var/lib/apt/lists/*; \
    mkdir -p ${CANTON_HOME} /opt/downloads /opt/canton/data /opt/canton/logs /opt/canton/config; \
    curl -fsSL ${CANTON_RELEASE_URL} -o /opt/downloads/splice-node.tar.gz; \
    tar -xzf /opt/downloads/splice-node.tar.gz -C /opt/downloads; \
    # ожидание стандартной структуры splice-node/docker-compose/validator
    cp -R /opt/downloads/splice-node/docker-compose/validator/* ${CANTON_HOME}/; \
    # Копируем VERSION файл в правильное место для start.sh
    cp /opt/downloads/splice-node/VERSION /opt/VERSION; \
    # ИСПРАВЛЕНИЕ: Убираем проблемный bind mount для postgres-entrypoint.sh
    # Проблема: В Docker-in-Docker bind mount ищет файл на хосте, а не в контейнере
    # Решение: Используем абсолютный путь внутри контейнера и копируем файл в volume через init
    # Или лучше: создаем кастомный postgres образ с встроенным entrypoint (но это требует сборки образа)
    # Временное решение: убираем bind mount и используем стандартный postgres entrypoint
    # с передачей команд через environment variables или command override
    sed -i '/postgres-entrypoint.sh:\/postgres-entrypoint.sh/d' ${CANTON_HOME}/compose.yaml; \
    sed -i 's|\.\/postgres-entrypoint.sh:\/postgres-entrypoint.sh||g' ${CANTON_HOME}/compose.yaml; \
    # Если postgres-entrypoint.sh нужен для инициализации БД, можно использовать init container
    # или изменить command postgres для выполнения скрипта из volume
    chmod +x ${CANTON_HOME}/start.sh || true

# Конфиги будут монтироваться извне; оставляем каталоги и права
# Создаем пользователя canton и добавляем в группу docker для доступа к Docker socket
RUN adduser --system --home /nonexistent --shell /usr/sbin/nologin --group canton && \
    chown -R canton:canton ${CANTON_HOME} && \
    # VERSION файл уже скопирован из splice-node релиза
    chown root:root /opt/VERSION && \
    # Создаем группу docker с GID 999 (стандартный GID для docker группы на хосте)
    groupadd -g 999 docker 2>/dev/null || true && \
    usermod -aG docker canton || true

WORKDIR ${CANTON_HOME}

COPY --chmod=0755 entrypoint.sh /usr/local/bin/entrypoint.sh

# Запускаем от root для доступа к Docker socket
# USER canton

EXPOSE 8080 8081 8082 6865

ENTRYPOINT ["/usr/bin/tini","--","/usr/local/bin/entrypoint.sh"]


