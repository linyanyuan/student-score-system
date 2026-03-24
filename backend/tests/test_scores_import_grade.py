import unittest

from app.routers.scores import (
    _build_header_index,
    _detect_header_row_from_preview,
    _infer_class_name_columns,
    _normalize_class_text,
    _normalize_header_text,
    _parse_exam_grades,
    _resolve_class_ids_by_name,
    _resolve_subject_columns,
    _should_use_explicit_ranks,
)


class ScoreImportGradeTests(unittest.TestCase):
    def test_parse_exam_grades_supports_multiple_separators(self):
        grades = _parse_exam_grades("七年级, 八年级，九年级")
        self.assertEqual(grades, {"七年级", "八年级", "九年级"})

    def test_header_aliases_are_recognized(self):
        headers = ["学生学号", "学生姓名", "班级名称", "总分班名", "总分校名"]
        header_index = _build_header_index(headers)
        self.assertEqual(header_index.get("学号"), 0)
        self.assertEqual(header_index.get("姓名"), 1)
        self.assertEqual(header_index.get("班级"), 2)
        self.assertEqual(header_index.get("班级排名"), 3)
        self.assertEqual(header_index.get("年级排名"), 4)

    def test_class_rank_alias_banming_is_recognized(self):
        headers = ["班级", "姓名", "班名", "校名"]
        header_index = _build_header_index(headers)
        self.assertEqual(header_index.get("班级排名"), 2)
        self.assertEqual(header_index.get("年级排名"), 3)

    def test_total_rank_alias_should_not_map_to_grade_rank(self):
        headers = ["学生学号", "学生姓名", "总分总名"]
        header_index = _build_header_index(headers)
        self.assertIsNone(header_index.get("年级排名"))

    def test_should_use_explicit_ranks_requires_both_ranks(self):
        rank_data = {
            1: {"rank_class": 1, "rank_grade": 2},
            2: {"rank_class": None, "rank_grade": 3},
        }
        self.assertFalse(_should_use_explicit_ranks(rank_data, success_count=2))

    def test_subject_aliases_are_resolved(self):
        headers = ["学号", "姓名", "班级", "道法(政治)", "政治", "化学"]
        subject_map = {"道法": object(), "化学": object()}
        subject_cols = _resolve_subject_columns(headers, subject_map)
        col_indexes = [idx for idx, _ in subject_cols]
        self.assertIn(3, col_indexes)
        self.assertIn(4, col_indexes)
        self.assertIn(5, col_indexes)

    def test_single_header_row_subject_columns_not_filtered_out(self):
        headers = ["班级", "姓名", "总分", "语文", "数学", "英语", "政治"]
        sub_headers = ["3班", "牛可昕", 598, 98, 119, 105, 54]
        subject_map = {"语文": object(), "数学": object(), "英语": object(), "道法": object()}
        subject_cols = _resolve_subject_columns(headers, subject_map, sub_headers=sub_headers)
        col_indexes = [idx for idx, _ in subject_cols]
        self.assertEqual(col_indexes, [3, 4, 5, 6])

    def test_infer_class_and_name_columns_from_sample_rows(self):
        headers = ["列1", "列2", "列3"]
        sample_rows = [
            ["3班", "牛可昕", 598],
            ["4班", "王嘉佑", 595],
            ["8班", "卢优泽", 582],
        ]
        class_col, name_col = _infer_class_name_columns(headers, sample_rows)
        self.assertEqual(class_col, 0)
        self.assertEqual(name_col, 1)

    def test_header_alias_kaohao_is_recognized_as_student_no(self):
        headers = ["市", "班级", "姓名", "考号", "唯一号"]
        header_index = _build_header_index(headers)
        self.assertEqual(header_index.get("学号"), 3)

    def test_detect_header_row_with_title_row(self):
        preview_rows = [
            ["总分汇总表", None, None, None],
            ["市", "班级", "姓名", "考号"],
            [None, None, None, None],
        ]
        header_row = _detect_header_row_from_preview(preview_rows)
        self.assertEqual(header_row, 2)

    def test_class_name_normalization(self):
        self.assertEqual(_normalize_class_text(" 八三班 "), "83班")
        self.assertEqual(_normalize_class_text("3班"), "3班")

    def test_resolve_class_ids_by_name_suffix_match(self):
        class_name_map = {
            1: "八一班",
            2: "八三班",
            3: "八十班",
        }
        resolved = _resolve_class_ids_by_name("3班", class_name_map)
        self.assertEqual(resolved, [2])

    def test_normalize_header_text(self):
        self.assertEqual(_normalize_header_text("  道法（政治）  "), "道法(政治)")


if __name__ == "__main__":
    unittest.main()
