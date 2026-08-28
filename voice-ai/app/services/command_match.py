from rapidfuzz import fuzz


def compare_commands(
    expected_command: str,
    recognized_command: str
):
    """
    Compare spoken command with expected command.

    Drill command order matters, so this intentionally uses full-string
    similarity and does not normalize synonyms or English equivalents.
    """

    expected = expected_command.lower().strip()
    recognized = recognized_command.lower().strip()

    score = fuzz.ratio(
        expected,
        recognized
    )

    return {
        "expected": expected_command.strip(),
        "recognized": recognized_command.strip(),
        "accuracy": round(score, 2),
        "correct": bool(score >= 85)
    }
