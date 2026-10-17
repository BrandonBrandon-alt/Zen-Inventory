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

# Comando de inicio optimizado
ENTRYPOINT ["java", "-jar", "app.jar"]