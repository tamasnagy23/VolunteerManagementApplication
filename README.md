# Volunteer Management Application

> 🚧 **Work in Progress:** This project is currently under active development. The core backend structure (RBAC, API endpoints) and the initial React frontend are set up. I am continuously refactoring, adding new UI components, and expanding features.

## 📌 Overview
This is a Full-Stack Volunteer Management Application designed to connect volunteers with events while providing organizers with powerful management tools. It features a robust RESTful API backend built with Java Spring Boot and a modern, interactive frontend built with React, TypeScript, and Material UI.

## 🛠️ Tech Stack

### Frontend
* **Framework:** React 19 (via Vite)
* **Language:** TypeScript
* **UI Library:** Material UI (MUI)
* **Routing:** React Router DOM
* **State Management & Network:** Axios for secure API communication
* **Extra Features:** `react-big-calendar` (for event scheduling views), `xlsx` (for data export/import)

### Backend
* **Language:** Java 17
* **Framework:** Spring Boot 3.2.2
* **Database:** PostgreSQL (with Spring Data JPA)
* **Security:** Spring Security & JWT (JSON Web Tokens)
* **Build Tool:** Maven

## ✨ Key Features
* **Interactive Dashboard:** A user-friendly frontend built with Material UI, allowing users to seamlessly apply for events and admins to manage applications visually.
* **Complex Event Application Logic:** Volunteers can apply for specific work areas within events, answer dynamic questionnaires, and view their schedules.
* **Role-Based Access Control (RBAC):** Strict authorization checks on both frontend (route protection) and backend, distinguishing between Global Admins, Organizers, and regular Volunteers.
* **Event Calendar:** Visual representation of events and shifts using React Big Calendar.
* **Bulk Operations & Excel Integration:** Admins can perform bulk status updates, send mass BCC emails, and potentially export data.
* **Comprehensive Audit Logging:** Every major action is tracked and logged securely on the backend.

## 🚀 Getting Started

### Prerequisites
* Java Development Kit (JDK) 17
* PostgreSQL installed and running
* Node.js and npm (for the frontend)
* Maven

### 1. Backend Setup
1. Clone the repository:
   
   ```bash
   git clone [https://github.com/tamasnagy23/VolunteerManagementApplication.git](https://github.com/tamasnagy23/VolunteerManagementApplication.git)
   ```
2. Create a PostgreSQL database for the application.
3. Update the  `application.properties` file with your database and JWT credentials:
    
    ```bash
    spring.datasource.url=jdbc:postgresql://localhost:5432/your_db_name
    spring.datasource.username=your_username
    spring.datasource.password=your_password
    spring.jpa.hibernate.ddl-auto=update
    ```
4. Run the API (from the backend directory):
    
    ```bash
    mvn spring-boot:run
    ```
The API will be accessible at `http://localhost:8080.`

### 2. Frontend Setup
1. Open a new terminal instance and navigate to the frontend directory (e.g., `volunteer-web`).
2. Install the necessary dependencies:
    
    ```bash
    npm install
    ```
3. Start the Vite development server:
  
    ```bash
    npm run dev
    ```
4. The frontend application will run on `http://localhost:5173` (default Vite port).
  
📡 Core API Modules
The backend serves several secure endpoints (requiring Bearer JWT tokens). Key modules include:
  
  * Authentication: Login and JWT generation.
  
  * Applications: CRUD operations for volunteer applications, bulk status updates, and admin notes.
  
  * Events & Work Areas: Managing festival/event data and specific shifts.
  
  * Email Service: Integrated mailing for notifications and bulk announcements.
  
🔮 Future Improvements / Roadmap

  * Full test coverage using JUnit/Mockito (Backend) and Jest/React Testing Library (Frontend).
  
  * Dockerizing the application (Docker Compose for easy DB, Backend, and Frontend setup).
  
  * Enhancing the calendar view with drag-and-drop shift assignments.
