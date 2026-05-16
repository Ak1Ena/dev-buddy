# devBuddy AI — UI Design & Screenshot Specification

This document provides textual context for the attached screenshots to ensure the AI presentation accurately reflects the real product UI.

## Screenshot 1: Registration Screen (`flow_01_register_filled.png`)
- **Theme**: Dark Mode (Slate-900 background).
- **Elements**: 
  - Centered card with "Register" title.
  - Fields for Full Name, Email, Username, Password, and Preferred Language (Python/JavaScript).
  - High-contrast sky-blue borders on active fields.

## Screenshot 2: Dashboard Empty State (`flow_02_dashboard_new_user.png`)
- **State**: Fresh user dashboard.
- **Message**: "No learning spaces yet".
- **Action**: A prominent "Create First Space" button with an icon.

## Screenshot 3: New Space Modal (`flow_03_space_creation_modal.png`)
- **UI**: A modal overlay on the dashboard.
- **Header**: "Create New Learning Space".
- **Instructions**: "Paste your code below to begin".

## Screenshot 4: Code Input (`flow_03_code_pasted.png`)
- **Action**: User has pasted recursive factorial Python code.
- **Editor**: Monospace font on a dark background.
- **Primary Button**: "Analyze My Code" (Active state).

## Screenshot 5: AI Analysis Progress (`flow_04_analysis_bridge.png`)
- **UI**: Loading bridge.
- **Spinner**: A large animated sky-blue circle.
- **Text**: "Analyzing your code… AI is reading your code and generating 10 personalized questions".

## Screenshot 6: Interactive Assessment (`flow_assessment_q1_answered.png`)
- **UI**: The Socratic quiz interface.
- **Content**: Shows a multiple-choice question about the factorial code.
- **Feedback**: A correct answer is highlighted in emerald green with "Correct!" explanation.

## Screenshot 7: User Dashboard (`flow_07_dashboard_final.png`)
- **Main Heading**: "Welcome back, [Username]!"
- **Summary Statistics**: "1 space · 0 lessons completed".
- **Space Card**: A large button/card titled "Python Logic and Loop Mastery". 
- **Card Details**: Shows "Python", "0%", and "0/2 lessons" progress.
- **Background**: Deep slate with fuchsia and sky blue accents.

## Screenshot 8: Logic Visualization (`flow_08_space_detail.png`)
- **Page**: Space Detail view.
- **Visual**: A horizontal logic tree representing the Factorial function.
- **Nodes**: 
  - Root: "Factorial Logic".
  - Children: "Base Case (n==0)" and "Recursive Step".
  - Path: Sidebar showing "Understanding Your Code: Recursive Factorials".

## Screenshot 9 & 10: Interactive Lesson (`flow_09_learn_page.png` & `flow+09_learn_2_page.png`)
- **Layout**: Two-column view.
- **Left Column**: `CodeStepGraph` showing highlighted Python code for the Factorial function.
- **Right Column**: `AnimationPlayer` showing the "Cinematic Logic" animation.
- **Animation Primitives**: Sky-blue boxes for variables, fuchsia arrows for flow, and "Discovery Gates" (amber checkpoints) asking the user to predict the next state.
- **Footer**: "WHY" panel explaining architectural insights.

## Screenshot 11: Hands-on Workshop (`flow_10_workshop_page.png`)
- **Type**: "Predict Output" exercise.
- **Content**: A code block of the factorial function and a text input for the user's answer.
- **Status**: Showing hints and explanation for why `factorial(3)` equals `6`.
- **Primary Action**: "Submit Answer" button in bright sky-blue.
