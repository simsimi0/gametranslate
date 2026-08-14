FROM maven:3.9.12-eclipse-temurin-21 AS build

WORKDIR /workspace
COPY result/MVP/server/pom.xml result/MVP/server/pom.xml
COPY result/MVP/server/src result/MVP/server/src
COPY result/MVP/java/src/main/java result/MVP/java/src/main/java
COPY result/MVP/index.html result/MVP/styles.css result/MVP/server/src/main/resources/static/
COPY result/MVP/src result/MVP/server/src/main/resources/static/src
RUN mvn -f result/MVP/server/pom.xml -DskipTests package

FROM eclipse-temurin:21-jre

WORKDIR /app
COPY --from=build /workspace/result/MVP/server/target/game-localizer-server.jar app.jar

ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
