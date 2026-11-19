# 📚 Intranet Quiz Platform: Local Setup & Complete User Guide

This guide provides a comprehensive, step-by-step walkthrough for configuring, launching, and using the **Intranet Quiz Platform** on your local machine and local area network (LAN/Intranet). No changes to the project source code are required.

---

## 📑 Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [Database Setup (Supabase)](#2-database-setup-supabase)
3. [Local Configuration](#3-local-configuration)
4. [How to Run the Application Locally](#4-how-to-run-the-application-locally)
5. [Running on a Local Intranet (Classroom / Lab Setup)](#5-running-on-a-local-intranet-classroom--lab-setup)
6. [Teacher Walkthrough (Step-by-Step)](#6-teacher-walkthrough-step-by-step)
   - [Teacher Registration & Sign In](#step-1-teacher-registration--sign-in)
   - [Managing Question Bank](#step-2-managing-the-question-bank)
   - [Managing Syllabus Tags & Subjects](#step-3-managing-syllabus-tags--subjects)
   - [Creating & Publishing a Quiz](#step-4-creating--publishing-a-quiz)
   - [Teacher Dashboard & Settings](#step-5-teacher-dashboard--settings)
   - [Viewing Reports & Grading Submissions](#step-6-viewing-reports--grading-submissions)
7. [Student Walkthrough (Step-by-Step)](#7-student-walkthrough-step-by-step)
   - [Joining a Quiz](#step-1-joining-a-quiz)
   - [Offline Mode Verification (Start OTP)](#step-2-offline-mode-verification-start-otp)
   - [Taking the Quiz](#step-3-taking-the-quiz)
   - [Submitting Answers (Submit OTP)](#step-4-submitting-answers)
   - [Viewing Results](#step-5-viewing-results)
8. [The Two-OTP Offline Exam Mode Explained](#8-the-two-otp-offline-exam-mode-explained)
9. [Troubleshooting & FAQs](#9-troubleshooting--faqs)

---

## 1. Prerequisites

Before starting, ensure you have the following installed on your computer:

- **Node.js**: Version 18.x or 20.x+ (Includes `npm` and `npx`).  
  Verify in your terminal:
  ```bash
  node -v
  npm -v
  ```
- **Web Browser**: Google Chrome, Microsoft Edge, Mozilla Firefox, or Brave.
- **Supabase Account**: A free cloud account at [https://supabase.com](https://supabase.com).

---

## 2. Database Setup (Supabase)

The platform uses Supabase (PostgreSQL + Row-Level Security) for storing questions, quizzes, teacher profiles, student results, and attachments.

### Step 2.1: Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) and log in.
2. Click **New Project**.
3. Choose your organization, assign a project name (e.g., `Intranet-Quiz`), set a database password, and select the region closest to you.
4. Click **Create new project** and wait 1–2 minutes for the database to provision.

### Step 2.2: Run the Database Schema
1. In your Supabase dashboard, open the left sidebar and click **SQL Editor**.
2. Click **New Query**.
3. Open the file `supabase_schema.sql` from your local project repository in any text editor, copy its entire contents, and paste it into the Supabase SQL Editor.
4. Click **Run** (or press `Ctrl + Enter`).
5. Verify that all tables were created successfully:
   - `profiles`
   - `question_bank`
   - `quizzes`
   - `quiz_questions`
   - `student_results`
   - `student_responses`
   - Storage bucket: `quiz-attachments`

### Step 2.3: Disable Email Confirmations (Recommended for Local / Intranet Use)
To allow teachers to sign up and immediately log in without setting up an SMTP email server:
1. In Supabase, go to **Authentication** (icon in left navigation) → **Providers** → **Email**.
2. Scroll to **Confirm email** and toggle it **OFF**.
3. Click **Save**.

### Step 2.4: Copy Your API Keys
1. Go to **Project Settings** (gear icon at the bottom of the left sidebar) → **API**.
2. Note down the following values:
   - **Project URL** (e.g. `https://xyzcompany.supabase.co`)
   - **Project API Keys** → `anon` `public` (e.g. `eyJhbGci...`)
   - **Project API Keys** → `service_role` `secret` (used by backend `server.js` for administrative tasks)

---

## 3. Local Configuration

The application supports configuration via environment variables for the Node.js backend server, and browser storage / configuration files for the frontend.

### Option A: Server Environment File (Recommended)
1. In the project root directory, locate `.env.example`.
2. Create a new file named `.env` in the root folder (or duplicate `.env.example` and rename it to `.env`).
3. Fill in your Supabase credentials:
   ```env
   # Supabase Configuration
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=your-supabase-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key-here
   PORT=3000
   ```

### Option B: Frontend Configuration File (`config.js`)
If you want the frontend pages to automatically connect to your Supabase project even when served by a lightweight static server, open `config.js` and set:
```javascript
window.DEFAULT_SUPABASE_URL = "https://your-project-id.supabase.co";
window.DEFAULT_SUPABASE_ANON_KEY = "your-supabase-anon-key-here";
```

### Option C: In-Browser PIN / Config Modal
You can also connect any client browser by navigating to `http://localhost:3000/config.html` and fetching or storing your database settings.

---

## 4. How to Run the Application Locally

### Method 1: Using the Express Backend Server (Recommended)
The built-in Express server serves both the static frontend and provides backend API endpoints for configuration sharing, secure attachment uploads, and teacher grade persistence.

1. Open your terminal (PowerShell, Command Prompt, or Bash) in the project directory:
   ```bash
   cd D:\projects\html_intranet_quiz
   ```
2. Install project dependencies (if running for the first time):
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
   *(Alternatively: `node server.js`)*
4. You will see:
   ```text
   Supabase integrated auth server running on port 3000
   ```
5. Open your web browser and navigate to:
   - **Student Portal**: [http://localhost:3000](http://localhost:3000) (or `http://localhost:3000/index.html`)
   - **Teacher Login**: [http://localhost:3000/login.html](http://localhost:3000/login.html)
   - **Teacher Dashboard**: [http://localhost:3000/dashboard.html](http://localhost:3000/dashboard.html)

---

### Method 2: Using a Lightweight Static Server (Alternative)
If you only need to run the client pages without the backend API:
```bash
npx -y serve . -l 8080
```
Then access the app at [http://localhost:8080](http://localhost:8080).  
*(Ensure `config.js` has your `DEFAULT_SUPABASE_URL` and `DEFAULT_SUPABASE_ANON_KEY` populated when using this method).*

---

## 5. Running on a Local Intranet (Classroom / Lab Setup)

To allow students across a local Wi-Fi router or computer lab network to take the quiz from their own laptops, tablets, or phones without requiring an internet connection during the quiz:

1. **Find the Host Computer's Local IP Address**:
   - On Windows: Run `ipconfig` in Command Prompt or PowerShell and look for **IPv4 Address** (e.g., `192.168.1.45`).
   - On macOS/Linux: Run `ifconfig` or `ip a` (e.g., `192.168.1.45`).
2. **Start the Server on the Host Computer**:
   ```bash
   npm start
   ```
3. **Allow Port 3000 in Windows Defender Firewall**:
   - When prompted, click **Allow access** for Node.js on Private networks.
4. **Student Connection**:
   - Connect student devices to the same local Wi-Fi router / LAN switch.
   - Instruct students to open their browser and visit:
     ```text
     http://192.168.1.45:3000
     ```
     *(Replace `192.168.1.45` with your host machine's actual IP address)*.

---

## 6. Teacher Walkthrough (Step-by-Step)

### Step 1: Teacher Registration & Sign In
1. Go to `http://localhost:3000/login.html`.
2. If visiting for the first time:
   - Click **"register for a new account"**.
   - Enter your **Full Name**, **Email Address**, and **Password**.
   - Click **Sign up**.
   - With email confirmations disabled in Supabase, your account is immediately verified and redirects to the **Teacher Dashboard**.
3. For subsequent visits, enter your email and password under **Sign in as a Teacher** and click **Sign in**.

---

### Step 2: Managing the Question Bank
The Question Bank stores your reusable question repository, categorized by syllabus topic tags.

1. From the navigation header, click **Question Bank** (or go to `http://localhost:3000/questions.html`).
2. Click **+ Add Question** to open the creation panel:
   - **Question Type**: Choose **MCQ (Multiple Choice)**, **Fill in the Blanks (FIB)**, or **Short Answer**.
   - **Syllabus / Topic Tag**: Enter a topic name (e.g., `HTML Basics`, `CSS Grid`, `JavaScript DOM`).
   - **Question Text**: Type the question. Supports:
     - **Code blocks**: Use backticks like \`const x = 10;\`
     - **Math formatting**: LaTeX fractions `\frac{numerator}{denominator}`, overlines `\overline{AB}`
     - **Markdown Tables**: Tables are rendered with clean borders, zebra stripes, and interactive "Copy Data" and "Load into Table Editor" buttons.
   - **Options & Answers**:
     - For **MCQ**: Provide Option A, Option B, Option C, Option D, and choose the correct answer letter.
     - For **FIB / Short Answer**: Enter the expected reference answer or key terms.
3. Click **Save Question to Bank**.

#### Bulk Importing Questions via CSV:
1. In the Question Bank page, click **Import CSV**.
2. You can upload a `.csv` file or toggle to **Direct Paste**.
3. Standard CSV Header format:
   ```csv
   Type,Syllabus Tag,Question Text,Option A,Option B,Option C,Option D,Correct Answer
   MCQ,HTML,What does HTML stand for?,HyperText Markup Language,Home Tool Markup Language,Hyperlinks Text Management Language,None of above,A
   FIB,CSS,The CSS property used to change text color is ________.,,,,color
   ```
4. Click **Copy AI Prompt**:
   - This copies a prompt template you can paste directly into ChatGPT or Claude to format syllabus notes into an importable CSV table.

---

### Step 3: Managing Syllabus Tags & Subjects
1. In the Question Bank, click **View All Syllabus Tags** (or navigate to `http://localhost:3000/subjects.html`).
2. View the list of all topics with question counts.
3. Use the search bar to find topics or batch-delete outdated subjects.

---

### Step 4: Creating & Publishing a Quiz
1. In the header navigation, click **Create Quiz** (or go to `http://localhost:3000/create.html`).
2. Fill in the quiz configuration:
   - **Quiz Title**: (e.g., `HTML5 Midterm Examination`)
   - **Rounds**: Defaults to `1`.
   - **Duration (Minutes)**: Test time limit (e.g., `30`).
   - **Questions to Ask**: Total number of questions presented to each student. If left blank, all selected questions are used.
   - **Randomize Questions**: When checked, questions are shuffled within each section (**MCQ → FIB → Short Answer**).
   - **Randomize MCQ Options**: When checked, multiple-choice options (A, B, C, D) are shuffled differently for each student, while scoring retains the correct answer mapping.
   - **Offline Mode (OTP Secured)**: Toggle this **ON** for exam environments where internet access is turned off. The system automatically creates a 6-digit **Start OTP** and **Submit OTP**.
3. **Select Questions**:
   - Use the subject filter dropdown to locate questions.
   - Check the checkboxes next to the questions you want to include.
4. Click **Create & Publish Quiz**.
5. The system generates a unique **Quiz Access Code** (e.g. `HTML99`).

---

### Step 5: Teacher Dashboard & Settings
1. Go to `http://localhost:3000/dashboard.html`.
2. The dashboard displays:
   - Summary statistics (Active Quizzes, Total Questions Bank, Total Submissions).
   - Quiz Cards with **Access Code**, duration, question count, and average score.
   - **Copy Code** button for sharing with students.
   - **Settings Modal** (gear icon): View or copy the **Start OTP** and **Submit OTP**.
   - **Launch Quiz**: Open the student lobby pre-loaded with this quiz.
   - **Export to CSV / Excel**: Export all student results for offline recordkeeping.
   - **Delete Quiz**: Remove the quiz and its associated results.

---

### Step 6: Viewing Reports & Grading Submissions
1. In the dashboard or header, click **Reports** (or go to `http://localhost:3000/reports.html`).
2. Filter submissions by specific quiz or view all.
3. Review metrics:
   - Total Students Attended
   - Average Score & Passing Rates
   - Highest / Lowest Scores
4. **Individual Grading**:
   - Click on any student submission to view their complete response snapshot.
   - Review answers for MCQs, Fill-in-the-Blank, Short Answers, or Code submissions.
   - Adjust scores and enter grading feedback if necessary.

---

## 7. Student Walkthrough (Step-by-Step)

### Step 1: Joining a Quiz
1. Student opens `http://localhost:3000` (or `http://<teacher-ip>:3000`).
2. Enter **Your Full Name**.
3. Enter the **Quiz Access Code** provided by the teacher (e.g., `HTML99`).
4. Click **Start Quiz**.
   *(The system validates that the quiz exists and ensures this student name has not already submitted an attempt).*

---

### Step 2: Offline Mode Verification (Start OTP)
- If the quiz has **Offline Mode** enabled:
  - An OTP prompt appears asking for the **Start OTP**.
  - Once the teacher writes the Start OTP on the whiteboard, the student enters it and clicks **Verify & Begin**.

---

### Step 3: Taking the Quiz
1. **Section Delivery**:
   - Questions appear in sequence: **MCQ** → **Fill in the Blanks** → **Short Answer**.
2. **Interactive Tools**:
   - **Code Questions (CodeStudio)**: Click to open the embedded or fullscreen code studio to test HTML/CSS/JS code before submitting.
   - **Table Questions**: Click **Copy Data** to copy table data formatted for Excel, or **Load into Table Editor** to view and manipulate rows in an Excel-like grid.
3. **Navigation & Auto-Save**:
   - Click **Next** or **Previous** to move between questions.
   - All chosen answers are saved immediately in the browser's local memory.
   - A timer at the top indicates the remaining time.

---

### Step 4: Submitting Answers
1. On reaching the last question, click **Submit Quiz**.
2. A confirmation modal summarizes answered vs. unanswered questions.
3. **Offline Mode Submit OTP**:
   - If offline mode was activated, students reconnect to the Wi-Fi/network and enter the **Submit OTP** announced by the teacher.
4. Click **Confirm & Submit**. Answers are securely uploaded to Supabase.

---

### Step 5: Viewing Results
1. Immediately upon submission, students are redirected to `result.html`.
2. Displays:
   - Final Score and Accuracy Percentage.
   - Total Time Spent.
   - Question review breakdown (shows student answer, correctness, and explanations).

---

## 8. The Two-OTP Offline Exam Mode Explained

The Offline Mode is designed for exam environments where internet access must be cut off to prevent cheating.

| Phase | Who | Action | Network State |
|---|---|---|---|
| **1. Preparation** | Teacher | Creates quiz with **Offline Mode** enabled. Views Start OTP & Submit OTP in dashboard settings. | Wi-Fi / LAN **ON** |
| **2. Lobby Join** | Student | Enters Name & Access Code, clicks **Start Quiz** to pre-cache questions in browser memory. | Wi-Fi / LAN **ON** |
| **3. Lock Network** | Teacher | Turns off the classroom Wi-Fi router or disconnects cables. Writes **Start OTP** on the whiteboard. | Wi-Fi / Internet **OFF** |
| **4. Quiz Session** | Student | Enters **Start OTP**. Quiz unlocks. Answers are stored in browser localStorage. | Wi-Fi / Internet **OFF** |
| **5. Quiz Conclusion**| Teacher | Announces time is up, turns Wi-Fi / router back ON. Writes **Submit OTP** on the whiteboard. | Wi-Fi / LAN **ON** |
| **6. Upload Results**| Student | Enters **Submit OTP** and clicks Submit. Results upload to Supabase and lock against editing. | Wi-Fi / LAN **ON** |

---

## 9. Troubleshooting & FAQs

### Q1: The terminal says `Port 3000 is already in use`
- **Cause**: Another application or previous Node instance is using port 3000.
- **Solution**:
  - In your `.env` file, change `PORT=3000` to `PORT=3001` or another open port.
  - Or terminate the existing process using PowerShell:
    ```powershell
    Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
    ```

### Q2: I get an error "Supabase client not configured" or "Database error"
- **Cause**: The `.env` file is missing or has placeholder credentials.
- **Solution**: Ensure your `.env` contains the exact `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` copied from your Supabase dashboard.

### Q3: When registering a teacher, it says "Please check your email for confirmation"
- **Cause**: Email confirmation is enabled in Supabase by default.
- **Solution**: Go to your Supabase Dashboard → **Authentication** → **Providers** → **Email** → toggle **Confirm email** to **OFF**, then register again.

### Q4: Students get "Student name has already attempted this quiz"
- **Cause**: The platform enforces unique student names per quiz to prevent duplicate submissions or score overwrites.
- **Solution**: If testing, use a different name (e.g., `John Doe 2`) or clear the submission from the Teacher **Reports** panel.

### Q5: Can I rebuild CSS if I make UI changes in the future?
- **Command**: Run `npm run build:css` to trigger the Tailwind CSS compiler.
