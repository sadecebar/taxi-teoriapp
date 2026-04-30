# Taxi Teori

A mobile-first study app for Swedish taxi driver theory preparation.

Taxi Teori is a modern study app built for learners preparing for the Swedish taxi driver theory exam. The goal is to provide a more structured, focused, and premium-feeling learning experience than a simple quiz website.

The app combines guided study progression, quiz practice, exam-style preparation, progress tracking, bilingual content, and a polished mobile-first interface.

---

## Live Demo

[Open Taxi Teori](https://sadecebar.github.io/taxi-teoriapp/)

**Best experience:** Taxi Teori is designed primarily for mobile use.  
For the best experience, open the app on a mobile device. If testing on desktop, use your browser’s developer tools, press `F12`, and enable mobile device preview.

---

## Overview

Taxi Teori is designed specifically for people studying for **taxiförarlegitimation** in Sweden.

Unlike a generic driving-license app, Taxi Teori focuses on taxi-specific learning areas such as:

- professional driver responsibility
- customer service and communication
- passenger safety
- accessibility and special passenger needs
- working time and rest rules
- navigation and route planning
- city driving in taxi work
- taxi-specific regulations
- risk awareness and professional driving behavior

The app is built to feel like a real study companion: clear, calm, mobile-friendly, and focused on helping the user understand what to study next.

---

## Features

### Guided Study Path

The **Plugga** section provides a structured learning path with locked progression between subjects and steps. Each subject is built as a guided course rather than a simple list of questions.

Each subject can include:

- lessons
- quick checks
- exercises
- scenarios
- mini-quizzes
- review exercises
- subject tests

### Quiz and Exam Practice

The app includes different quiz-based study modes for both quick practice and exam-style preparation.

Examples include:

- quick quizzes
- Delprov 1 practice
- Delprov 2 practice
- image-based questions
- scenario questions
- subject-based tests

### Progress Tracking

The app tracks learning progress so users can see what they have practiced and what still needs work.

Question status can include:

- not practiced
- needs more practice
- in progress
- mastered

The goal is to make progress visible and useful, not just show a final score.

### Bilingual Support

Taxi Teori supports both:

- Swedish
- English

Swedish is the main content language, while English support makes the app more accessible for learners who prefer explanations in English.

### Mobile-First Design

The interface is designed primarily for mobile use, with an app-like experience suitable for short study sessions.

The design direction is:

- clean
- modern
- serious
- premium
- focused on readability and learning

### PWA Support

Taxi Teori is built as a Progressive Web App, meaning it can be installed and used like an app from supported browsers.

---

## Tech Stack

- React
- Vite
- JavaScript
- CSS
- PWA
- GitHub Pages
- Local storage for progress and app state
- Structured question bank using JavaScript data files

---

## Project Structure

```txt
src/
  assets/
    plugga/                 # Images and assets used in guided lessons
    question-images/        # Images connected to specific questions

  lessons/                  # Plugga lesson and step content
  locales/                  # Language files and translations

  App.jsx                   # Main app shell and routing logic
  PluggaView.jsx            # Guided study path UI
  questions.js              # Question-bank aggregation
  progress.js               # Progress and mastery logic

  taxiyrket-1.js            # Taxi profession question set
  sakerhet-*.js             # Safety-related question sets
  lagstiftning-*.js         # Law/regulation question sets
  navigering-1.js           # Navigation-related questions```
