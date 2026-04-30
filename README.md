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
  navigering-1.js           # Navigation-related questions

Key Technical Highlights

This project demonstrates:

building a mobile-first React app with Vite
structuring a large question bank into maintainable data files
creating reusable quiz and study flows
managing local progress and user state
designing a guided learning path with locked progression
supporting bilingual UI and question content
handling question images and scenario-based learning
building a PWA-style app experience
deploying a frontend project through GitHub Pages

Deployment

The app is deployed using GitHub Pages.

Production builds are generated with Vite and published from the project’s build output.

Current Status

Taxi Teori is under active development.

Current focus areas include:

expanding the guided Plugga study path
improving taxi-specific lesson content
refining quiz and subject-test flows
improving light and dark mode polish
strengthening question quality and explanations
preparing the project for a more complete mobile app experience
Roadmap

Planned improvements include:

completing all Plugga subjects
adding more taxi-specific scenarios
improving lesson visuals and image-based learning
expanding bilingual content
polishing the full mobile UI
preparing for future App Store and Google Play distribution
adding optional account/sync support in the future
adding premium access features later
About the Project

Taxi Teori was created as a focused study tool for the Swedish taxi theory exam. The project is both a real product idea and a portfolio project showing frontend development, product thinking, UI/UX design, structured content work, and learning-flow implementation.

The goal is to build something that feels more useful, modern, and trustworthy than a basic question-practice website.

Author

Baran Kizilca

DevOps / Cloud student with an interest in frontend development, product design, automation, and AI-assisted development workflows.

GitHub: sadecebar
