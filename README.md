# Menu Planner App

A simple full-stack web application for planning and displaying weekly dinner menus, enriched with historical weather data.

## 🧩 Project Overview

This app reads menu and weather data from an Excel spreadsheet, stores it in an in-memory H2 database, and displays it in a React frontend. Users can also retrieve historical weather for any day using a button that fetches data from the Open-Meteo API.

---

## ⚙️ Tech Stack

- **Backend**: Spring Boot (Java)
    - Reads spreadsheet via Apache POI
    - Inserts parsed data into H2
    - Serves data via REST endpoints
    - Fetches historical weather from Open-Meteo API
- **Frontend**: React + Vite
    - Displays weekly dinner menus
    - Weather is shown per day at ~5:30 PM
    - Button-triggered weather fetch for specific days
- **Database**: H2 (in-memory, for development)
- **External API**: [api.open-meteo.com](https://api.open-meteo.com)

---

## 🛠️ Setup Instructions

### Backend (Spring Boot)

1. Clone the repo.
2. Navigate to the backend directory.
3. Build and run the application:

```bash
./mvnw spring-boot:run
```

The app starts at `http://localhost:8080`.

### Frontend (React + Vite)

1. Navigate to the frontend directory.
2. Install dependencies and run dev server:

```bash
npm install
npm run dev
```

The app will run at `http://localhost:5173`.

Ensure your `vite.config.ts` includes a proxy for API calls:

```ts
server: {
  proxy: {
    '/weather': 'http://localhost:8080'
  }
}
```

---

## 📄 Features

- 📥 Load menus and weather into the database from an Excel file
- 🌦️ Retrieve ~5:30 PM weather from Open-Meteo by date
- 🖥️ Display menus and weather in a clean web interface
- ⚡ Fast local dev using Vite + H2

---

## 📌 Future Ideas

- PostgreSQL for persistent storage
- User accounts to manage personal menus
- Upload new spreadsheets through the UI
- AI-assisted meal recommendations based on weather

---

## 🧑‍🍳 Created With ❤️ by Rachel + ChatGPT
