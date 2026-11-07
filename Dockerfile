FROM eclipse-temurin:21-jre

WORKDIR /app
RUN groupadd --system tabletop && useradd --system --gid tabletop tabletop
COPY --chown=tabletop:tabletop backend/target/table-top-backend-1.0.0.jar /app/app.jar
COPY --chown=tabletop:tabletop dist/ /app/dist/

ENV TABLE_TOP_STATIC_DIR=/app/dist
EXPOSE 8787
USER tabletop
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
