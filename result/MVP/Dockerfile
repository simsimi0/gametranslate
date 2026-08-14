FROM maven:3.9.12-eclipse-temurin-21 AS build

WORKDIR /workspace
COPY server/pom.xml server/pom.xml
COPY server/src server/src
COPY java/src/main/java java/src/main/java
COPY index.html styles.css server/src/main/resources/static/
COPY src server/src/main/resources/static/src
RUN mvn -f server/pom.xml -DskipTests package

FROM eclipse-temurin:21-jre

WORKDIR /app
COPY --from=build /workspace/server/target/game-localizer-server.jar app.jar

ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
