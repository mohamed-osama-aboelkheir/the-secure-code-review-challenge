FROM maven:3.9-eclipse-temurin-21 AS build

WORKDIR /build

COPY pom.xml .

RUN mvn -q -B dependency:go-offline

COPY src ./src

RUN mvn -q -B package -DskipTests

FROM eclipse-temurin:21-jre

WORKDIR /app

COPY --from=build /build/target/projecthub.jar app.jar

RUN useradd -m -u 1001 appuser && chown -R appuser:appuser /app

USER appuser

EXPOSE 3000

CMD ["java", "-jar", "app.jar"]
