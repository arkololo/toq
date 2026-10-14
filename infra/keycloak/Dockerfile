# Build context: repository root.
FROM quay.io/keycloak/keycloak:26.7.4@sha256:82a77884f3af238beab1e7afd63b5f530e1b5c0590bd7aa60b40a40463e29b2c AS build
ENV KC_DB=postgres KC_HEALTH_ENABLED=true
RUN /opt/keycloak/bin/kc.sh build

FROM quay.io/keycloak/keycloak:26.7.4@sha256:82a77884f3af238beab1e7afd63b5f530e1b5c0590bd7aa60b40a40463e29b2c
COPY --from=build /opt/keycloak/ /opt/keycloak/
COPY --chown=keycloak:keycloak infra/keycloak/realm-import/TOQ-realm.json /opt/keycloak/data/import/TOQ-realm.json
ENV KC_DB=postgres KC_HEALTH_ENABLED=true
EXPOSE 8080
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
CMD ["start", "--optimized", "--import-realm", "--http-enabled=true", "--proxy-headers=xforwarded"]
