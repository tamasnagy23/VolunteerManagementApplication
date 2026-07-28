# Volunteer Management Application

> 🚧 **Work in Progress:** This project is currently under active development. The core backend structure, including a robust Multi-Tenant architecture, advanced RBAC, and the React frontend, is established. I am continuously refining the UI, adding complex management features, and optimizing database interactions.

## 📌 Overview
This is an Enterprise-Grade Full-Stack Volunteer Management Application designed to seamlessly connect volunteers with events while providing organizers with powerful, context-aware management tools. It features a highly scalable RESTful API backend built with Java Spring Boot (utilizing multi-tenancy) and a modern, interactive frontend built with React, TypeScript, and Material UI.

## 🛠️ Tech Stack

### Frontend
* **Framework:** React 19 (via Vite)
* **Language:** TypeScript
* **UI Library:** Material UI (MUI)
* **Routing:** React Router DOM
* **Rich Text & Media:** `react-quill-new` (Rich text editor), custom interactive Lightbox for images
* **State Management & Network:** Axios for secure API communication
* **Extra Features:** `react-big-calendar` (for scheduling), `xlsx` (data export/import)

### Backend
* **Language:** Java 17
* **Framework:** Spring Boot 3.2.2
* **Database:** PostgreSQL (Spring Data JPA) with **Multi-Tenant Architecture** (Master DB + Isolated Tenant DBs)
* **Security:** Spring Security & JWT (JSON Web Tokens)
* **Build Tool:** Maven

## ✨ Key Features
* **Multi-Tenant Architecture:** Data isolation ensures that different organizations can operate securely within their own database schemas or instances while maintaining a unified global identity.
* **Context-Aware RBAC (Role-Based Access Control):** A highly dynamic permission system that distinguishes roles not just globally (SysAdmin, User), but contextually (Organization Owner, Event Organizer, Area Coordinator), dynamically updating UI tools and API access based on the user's scope.
* **Interactive Social Feed:** A built-in communication hub allowing targeted announcements (Global, Org-wide, Event-specific, or Team-specific). Features include rich text, multiple image uploads with gallery view, nested recursive commenting, and emoji reactions.
* **Complex Shift & Event Logic:** Organizers can manage nested structures (Organizations ➔ Events ➔ Work Areas ➔ Shifts). The system features automatic conflict detection for scheduling, strictly distinguishing between organizational shifts and users' personal commitments.
* **Visual Dashboards & Scheduling:** User-friendly frontend built with MUI, allowing users to apply for events via dynamic questionnaires and organizers to manage applications visually (Kanban/List styles) and via Calendar views.
* **Comprehensive Audit Logging:** Every critical action is tracked and logged securely on the backend for accountability.

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
2. Create the necessary PostgreSQL databases for the application (e.g., master_db and tenant-specific databases if running locally).
3. Update the `application.properties` file with your database and JWT credentials:
    
    ```bash
    spring.datasource.url=jdbc:postgresql://localhost:5432/master_db
    spring.datasource.username=your_username
    spring.datasource.password=your_password
    spring.jpa.hibernate.ddl-auto=update
    # Add your JWT secret and expiration settings here
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
  
  * Authentication & Tenant Routing: Login, JWT generation, and dynamic database routing based on user context.
  
  * Social Feed (Announcements): Posting, media handling, and recursive comment tree management.
  
  * Events & Shifts: Managing hierarchical event data, work areas, capacity planning, and shift conflict validation.
  
  * Email Service: Integrated mailing for notifications and bulk announcements.
  
🔮 Future Improvements / Roadmap

  * Full test coverage using JUnit/Mockito (Backend) and Jest/React Testing Library (Frontend).
  
  * Dockerizing the application (Docker Compose for easy DB, Backend, and Frontend setup out of the box).
  
  * Enhancing the calendar view with drag-and-drop shift assignments.

  * Implementing WebSockets for real-time Social Feed updates and notifications.
