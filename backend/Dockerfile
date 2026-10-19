# ==========================================
# Etapa 1: Construcción (Builder)
# ==========================================
FROM maven:3.9.6-eclipse-temurin-21-alpine AS builder
WORKDIR /app

# Copiar solo el pom.xml primero para aprovechar la caché de Docker.
# --mount=type=cache conserva ~/.m2 entre construcciones: aunque cambie el pom.xml, no se vuelve a bajar todo.
COPY pom.xml .
RUN --mount=type=cache,target=/root/.m2 mvn dependency:go-offline -B

# Copiar el código fuente y compilar
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 mvn clean package -DskipTests -B

# ==========================================
# Etapa 2: Ejecución (Runner)
# ==========================================
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Copiar el .jar compilado desde la etapa anterior
COPY --from=builder /app/target/*.jar app.jar

# Exponer el puerto
EXPOSE 8080

# Comando de inicio. La JVM se ajusta a la memoria del contenedor (los planes gratuitos dan ~512 MB):
# usa hasta el 70 % como heap y el recolector serial, que gasta menos que el G1 en instancias pequeñas.
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=70", "-XX:+UseSerialGC", "-jar", "app.jar"]