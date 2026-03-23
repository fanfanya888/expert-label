from __future__ import annotations

RUBRIC_VERSION = "v1"

TASK_CATEGORIES = [
    "Academic Writing",
    "Summarization",
    "Question Answering",
    "Translation",
    "Code Explanation",
    "Content Moderation",
    "Style Rewriting",
    "Other",
]

ANSWER_RATINGS = [
    "Gold Response",
    "Good Response",
    "Average Response",
    "Poor Response",
]


def get_review_rubric() -> dict[str, object]:
    return {
        "title": "Review Rubric",
        "version": RUBRIC_VERSION,
        "intro": "Review the model response as a whole and choose the single best rating.",
        "levels": [
            {
                "rating": "Gold Response",
                "guidance": "Accurate, complete, well-structured, and directly useful with no material issues.",
            },
            {
                "rating": "Good Response",
                "guidance": "Mostly correct and helpful, with only minor omissions or wording issues.",
            },
            {
                "rating": "Average Response",
                "guidance": "Partially helpful but incomplete, vague, or uneven in quality.",
            },
            {
                "rating": "Poor Response",
                "guidance": "Incorrect, misleading, unsafe, or not responsive to the request.",
            },
        ],
        "review_notes": [
            "Use one overall rating only.",
            "Judge the response by user usefulness, accuracy, and clarity.",
            "Explain the main reason for the rating in concise but specific language.",
        ],
    }
