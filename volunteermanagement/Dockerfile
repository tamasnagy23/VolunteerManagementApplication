# 1. Építési fázis (Build stage) - Opcionális, de profibb, ha itt buildelünk
# Ha már van kész .jar fájlod, ezt kihagyhatod, de így tisztább:
FROM maven:3.8.5-openjdk-17 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
# Buildeljük le a projektet, teszteket most kihagyva a gyorsaság miatt
RUN mvn clean package -DskipTests

# 2. Futtatási fázis (Run stage)
FROM openjdk:17-jdk-slim
WORKDIR /app
# Átmtásoljuk a build fázisból az elkészült .jar fájlt
COPY --from=build /app/target/*.jar app.jar

# Ez a port lesz nyitva a konténeren belül
EXPOSE 8080

# Indítási parancs
ENTRYPOINT ["java", "-jar", "app.jar"]