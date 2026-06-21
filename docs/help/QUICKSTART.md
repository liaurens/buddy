# Quickstart Guide

This guide will help you set up the **Student Buddy App** locally for development.

## Prerequisites
- **Node.js**: Ensure you have Node.js installed (v18+ recommended).
- **npm**: Comes with Node.js.

## Installation

1.  **Clone the Repository**
    ```bash
    git clone <repository-url>
    cd buddy-app
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

## Configuration

1.  **Environment Variables**
    Duplicate the `.env.example` file and rename it to `.env`:
    ```bash
    cp .env.example .env
    ```

2.  **Supabase Setup**
    - Create a project on [Supabase](https://supabase.com/).
    - Get your **Project URL** and **Anon Key** from the Supabase Dashboard (Settings > API).
    - Update your `.env` file:
        ```env
        VITE_SUPABASE_URL=https://your-project.supabase.co
        VITE_SUPABASE_ANON_KEY=your-anon-key-here
        ```

## Running the App

Start the development server:
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:5173` (or the port shown in your terminal).

## Building for Production

To create a production build:
```bash
npm run build
```
The output will be in the `dist/` directory.

To preview the production build locally:
```bash
npm run preview
```
