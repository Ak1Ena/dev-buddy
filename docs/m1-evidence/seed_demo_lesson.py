"""Seed one ready-made lesson for a test user, so the mentor chat can be shown in the
M1 self-check video without generating a lesson through an LLM first.

Dev/evidence only, not used by the app. Lives in docs/m1-evidence/ next to the video it
supports, not in backend/, because it writes straight into a dev SQLite DB.

    python3 docs/m1-evidence/seed_demo_lesson.py backend/devbuddy.db kit-video@example.com

Prints the lesson id. Running it again adds another lesson.
"""
import json
import sqlite3
import sys
import uuid
from datetime import datetime, timezone

CODE = 'fruits = ["apple", "kiwi", "mango"]\nfor fruit in fruits:\n    print(fruit)'

CONTENT = {
    "concept_hook": "A for loop lets you do the same thing once for every item in a list.",
    "summary": "for item in list: runs the indented block once per item, in order.",
    "deep_dive": {
        "title": "How the loop walks the list",
        "content": "Each pass, Python puts the next item into the loop variable and runs the body.",
        "concepts": ["iteration", "loop variable"],
    },
    "key_concepts": ["iteration", "loop variable", "indentation"],
    "code_walkthrough": [
        {"code": 'fruits = ["apple", "kiwi", "mango"]', "plain_english": "Make a list of three fruits.",
         "why": "The loop needs something to walk through."},
        {"code": "for fruit in fruits:", "plain_english": "Take each fruit in turn and call it fruit.",
         "why": "The loop variable holds the current item."},
        {"code": "    print(fruit)", "plain_english": "Show the current fruit.",
         "why": "The indented line runs once per item."},
    ],
    "viz": {
        "kind": "flow",
        "steps": [
            {"id": "s1", "label": "Make the list", "summary": "Three fruits", "code_ref": {"walkthrough_index": 0}},
            {"id": "s2", "label": "Take the next fruit", "summary": "fruit = next item",
             "code_ref": {"walkthrough_index": 1}},
            {"id": "s3", "label": "Print it", "summary": "Runs once per fruit", "code_ref": {"walkthrough_index": 2}},
        ],
    },
    "animation_frames": [
        {"frame": 1, "title": "The list", "code_state": CODE, "narration": "We start with three fruits."},
        {"frame": 2, "title": "First pass", "code_state": CODE, "narration": "fruit is apple, so apple is printed."},
    ],
    "workshops": [
        {"type": "predict_output", "title": "What prints?", "description": "Predict the output.",
         "code": CODE, "answer": "apple\nkiwi\nmango", "hints": ["One line per item."],
         "explanation": "The body runs once for each fruit, in list order."},
    ],
}


def main(db_path: str, email: str) -> None:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    con = sqlite3.connect(db_path)
    row = con.execute("select id from users where email = ?", (email,)).fetchone()
    if not row:
        sys.exit(f"no user {email}")
    user_id = row[0]
    # Skip the assessment redirect for this test user.
    con.execute("update users set assessment_completed = 1 where id = ?", (user_id,))
    space_id, path_id, lesson_id = (str(uuid.uuid4()) for _ in range(3))
    con.execute(
        "insert into learning_spaces (id, user_id, name, is_active, created_at) values (?,?,?,1,?)",
        (space_id, user_id, "Python basics (demo)", now),
    )
    con.execute(
        "insert into learning_paths (id, user_id, learning_space_id, title, description, language, skill_level,"
        " source_code, extracted_concepts, total_lessons, completed_lessons, is_active, created_at, updated_at)"
        " values (?,?,?,?,?,?,?,?,?,1,0,1,?,?)",
        (path_id, user_id, space_id, "Python loops (demo)", "Seeded for the M1 self-check.", "python",
         "beginner", CODE, json.dumps(["for loop"]), now, now),
    )
    con.execute(
        "insert into lessons (id, learning_path_id, title, description, topic, order_index, estimated_minutes,"
        " difficulty, content, is_remedial, created_at) values (?,?,?,?,?,0,10,?,?,0,?)",
        (lesson_id, path_id, "Looping over a list", "Walk a list with a for loop.", "for loop", "beginner",
         json.dumps(CONTENT), now),
    )
    con.commit()
    print(lesson_id)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
