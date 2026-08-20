# 📚 Intranet Quiz Platform

A lightweight, browser-based quiz platform for classrooms. Built with vanilla HTML, CSS, and JavaScript, with [Supabase](https://supabase.com) as the backend. Supports both **Online** and **Offline (OTP-secured)** quiz modes, designed to run entirely over a local network — no internet required during a quiz.

---

## ✨ Features

### 👩‍🏫 Teacher Portal
- **Create & Edit Quizzes** — Set title, number of rounds, duration, active question count, and randomization settings.
- **Sectioned Question Delivery** — Student quizzes are always presented in MCQ, FIB, then Short Answer order. Teachers can optionally randomize question order within each section.
- **MCQ Option Randomization** — Multiple-choice options are randomized per student by default, while scoring still uses the original correct answer key.
- **Question Bank** — Add MCQ and fill-in-the-blank questions, tagged by syllabus topic.
- **Online Mode** — Share an access code; students join and submit results instantly to the database.
- **Offline (OTP) Mode** — Two-OTP system for anti-cheating in intranet/exam environments:
  - **Start OTP** — Given to students before the quiz begins (after Wi-Fi is turned off).
  - **Submit OTP** — Given after the quiz to authorize uploading results (when Wi-Fi is turned back on).
- **Quiz Settings Modal** — View access code and OTPs for any created quiz directly from the dashboard.
- **Analytics** — See per-student scores and average performance for each quiz.

### 👨‍🎓 Student Portal
- Join a quiz using a **Full Name** and **Access Code**.
- Navigate questions with Previous / Next buttons.
- Answer sectioned quizzes in the order **MCQ → FIB → Short Answer**. If enabled by the teacher, questions inside each section and MCQ options may appear in a personalized randomized order.
- In offline mode:
  - Answers are stored **locally in the browser** during the quiz.
  - A **Submit OTP** is required to upload results, preventing early or unauthorized submission.
- Results are locked after submission — no editing allowed.

---

## 🗂️ Project Structure

```
html_intranet_quiz/
├── index.html          # Student join page
├── quiz.html           # Student quiz-taking page
├── dashboard.html      # Teacher quiz dashboard
├── create.html         # Teacher quiz creation & editing
├── questions.html      # Teacher question bank management
├── login.html          # Teacher authentication page
├── config.js           # Supabase URL and Anon Key
├── css/
│   └── style.css       # Global styles
├── js/
│   ├── auth.js         # Supabase auth helper (shared)
│   ├── quiz.js         # Student quiz logic (OTP, timer, submission)
│   ├── dashboard.js    # Teacher dashboard (quiz list, analytics, settings)
│   ├── create.js       # Quiz creation & editing logic
│   └── ...
└── supabase_schema.sql # Full database schema with RLS policies
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (for running the local server)
- A [Supabase](https://supabase.com) project

### 1. Clone the repository
```bash
git clone https://github.com/LokeshRagishetty/html_intranet_quiz.git
cd html_intranet_quiz
```

### 2. Set up Supabase
1. Create a new project on [supabase.com](https://supabase.com).
2. Go to **SQL Editor** and run the full contents of `supabase_schema.sql` to create all tables and RLS policies.
3. Go to **Project Settings → API** and copy your **Project URL** and **anon public key**.

### 3. Configure the app
Edit `config.js` and fill in your credentials:
```js
window.SUPABASE_URL = "https://your-project-id.supabase.co";
window.SUPABASE_ANON_KEY = "your-anon-public-key";
```

### 4. Run locally
```bash
npx -y serve . -l 8080
```
Then open [http://localhost:8080](http://localhost:8080) in your browser.

---

## 🔐 Offline OTP Mode — How It Works

This mode is designed for exam environments where internet access should be blocked during the quiz.

| Step | Who | Action |
|------|-----|--------|
| 1 | Teacher | Creates a quiz with **Offline Mode** enabled. OTPs are auto-generated. |
| 2 | Teacher | Views the **Start OTP** and **Submit OTP** from the dashboard Settings modal. |
| 3 | Student | Opens the app, enters name + access code, clicks **Start Quiz** (Wi-Fi still ON). |
| 4 | Teacher | Turns off the Wi-Fi/router. Writes the **Start OTP** on the board. |
| 5 | Student | Enters the Start OTP → quiz begins. Answers are saved locally. |
| 6 | Teacher | After quiz ends, turns Wi-Fi back on. Writes the **Submit OTP** on the board. |
| 7 | Student | Enters the Submit OTP → results are uploaded to Supabase. |

---

## 🎲 Quiz Randomization & Question Count

Teachers can select a larger pool of questions and set **Questions to Ask** to use only a subset. Leaving the field blank uses all selected questions.

During the student attempt:
- Questions are grouped as **MCQ**, then **FIB**, then **Short Answer**.
- When **Randomize Questions** is enabled, questions are shuffled only inside their own section.
- When **Randomize MCQ Options** is enabled, choices are shuffled per student by default.
- Scoring remains stable because shuffled options keep their original answer keys internally.

For existing Supabase projects, rerun the migration helpers in `supabase_schema.sql` so the `randomize_questions` and `randomize_options` columns are available.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, Vanilla CSS, Vanilla JavaScript |
| Icons | [Lucide Icons](https://lucide.dev/) |
| Backend / Database | [Supabase](https://supabase.com) (PostgreSQL + RLS) |
| Auth | Supabase Auth (Email/Password for teachers) |
| Local Server | `npx serve` |

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
